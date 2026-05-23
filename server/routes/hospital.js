const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { getUserContactColumn } = require('../utils/userColumns');
const { cityCenter, distanceKm, withLocationFallback } = require('../utils/locations');
const { createOrder, createCashfreeOrder, getCashfreeConfig } = require('../services/paymentService');

const uploadRoot = path.join(__dirname, '..', '..', 'uploads', 'hospital-documents');
fs.mkdirSync(uploadRoot, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadRoot,
    filename: (req, file, done) => done(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '-')}`)
  }),
  limits: { fileSize: 8 * 1024 * 1024 }
});

const plans = {
  basic: { name: 'Basic', amount: 49900 },
  pro: { name: 'Pro', amount: 199900 },
  enterprise: { name: 'Enterprise', amount: 499900 }
};

module.exports = (io) => {
  const router = express.Router();
  const hospitalAuth = auth(['hospital', 'admin', 'super_admin']);
  router.use(hospitalAuth);
  router.use(async (req, res, next) => {
    await ensureHospitalTables();
    next();
  });

  router.get('/profile', async (req, res) => {
    const contactColumn = await getUserContactColumn(pool);
    const [[user]] = await pool.query(`SELECT id,name,email,${contactColumn} AS phone,city,address,latitude,longitude FROM users WHERE id = ?`, [req.user.id]);
    const [[profile]] = await pool.query('SELECT * FROM hospital_profile WHERE hospital_id = ?', [req.user.id]);
    const [documents] = await pool.query('SELECT * FROM hospital_documents WHERE hospital_id = ? ORDER BY created_at DESC', [req.user.id]);
    const [[settings]] = await pool.query('SELECT * FROM hospital_settings WHERE hospital_id = ?', [req.user.id]);
    const [devices] = await pool.query('SELECT * FROM hospital_devices WHERE hospital_id = ? ORDER BY last_seen_at DESC LIMIT 20', [req.user.id]);
    res.json({
      profile: {
        ...emptyProfile(user),
        ...profile,
        name: profile?.hospital_name || user?.name,
        email: user?.email,
        phone: profile?.phone || user?.phone,
        city: profile?.city || user?.city,
        full_address: profile?.full_address || user?.address,
        latitude: profile?.latitude || user?.latitude,
        longitude: profile?.longitude || user?.longitude,
        logo_url: profile?.logo_path ? `/uploads/hospital-documents/${profile.logo_path}` : null,
        cover_url: profile?.cover_path ? `/uploads/hospital-documents/${profile.cover_path}` : null
      },
      documents: documents.map((doc) => ({ ...doc, file_url: `/uploads/hospital-documents/${doc.file_path}` })),
      settings: settings || {},
      devices
    });
  });

  router.put('/profile', async (req, res) => {
    const payload = pick(req.body, ['hospital_name', 'registration_number', 'license_number', 'gst_number', 'establishment_year', 'hospital_category', 'hospital_type', 'phone', 'whatsapp', 'emergency_helpline', 'website', 'country', 'state', 'city', 'pincode', 'full_address', 'latitude', 'longitude', 'monday_hours', 'tuesday_hours', 'wednesday_hours', 'thursday_hours', 'friday_hours', 'saturday_hours', 'sunday_hours', 'emergency_24x7']);
    requireFields(payload, ['hospital_name', 'license_number', 'city']);
    await upsert('hospital_profile', 'hospital_id', req.user.id, payload);
    await pool.query('UPDATE users SET name = ?, city = ?, address = ?, latitude = ?, longitude = ? WHERE id = ?', [payload.hospital_name, payload.city, payload.full_address || null, payload.latitude || null, payload.longitude || null, req.user.id]);
    res.json({ message: 'Hospital profile updated' });
  });

  router.post('/profile/media', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), async (req, res) => {
    const payload = {};
    if (req.files?.logo?.[0]) payload.logo_path = req.files.logo[0].filename;
    if (req.files?.cover?.[0]) payload.cover_path = req.files.cover[0].filename;
    if (!Object.keys(payload).length) return res.status(400).json({ message: 'Upload logo or cover image' });
    await ensureProfileRow(req.user.id);
    await upsert('hospital_profile', 'hospital_id', req.user.id, payload);
    res.status(201).json({ message: 'Hospital media updated', media: payload });
  });

  router.put('/profile/location', async (req, res) => {
    const { latitude, longitude, full_address } = req.body;
    if (!latitude || !longitude) return res.status(400).json({ message: 'Latitude and longitude are required' });
    await ensureProfileRow(req.user.id);
    await upsert('hospital_profile', 'hospital_id', req.user.id, { latitude, longitude, full_address });
    await pool.query('UPDATE users SET latitude = ?, longitude = ?, address = COALESCE(?, address) WHERE id = ?', [latitude, longitude, full_address || null, req.user.id]);
    res.json({ message: 'Location updated' });
  });

  router.post('/profile/documents', upload.single('document'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Document file is required' });
    const type = req.body.document_type || 'license';
    await pool.query('INSERT INTO hospital_documents (hospital_id,document_type,file_name,file_path,mime_type,verification_status) VALUES (?,?,?,?,?,"pending")', [req.user.id, type, req.file.originalname, req.file.filename, req.file.mimetype]);
    res.status(201).json({ message: 'Document uploaded', file: req.file.filename });
  });

  router.delete('/profile/documents/:id', async (req, res) => {
    const [[doc]] = await pool.query('SELECT * FROM hospital_documents WHERE id = ? AND hospital_id = ?', [req.params.id, req.user.id]);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    await pool.query('DELETE FROM hospital_documents WHERE id = ? AND hospital_id = ?', [req.params.id, req.user.id]);
    fs.promises.unlink(path.join(uploadRoot, doc.file_path)).catch(() => {});
    res.json({ message: 'Document deleted' });
  });

  router.post('/profile/security/password', async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ message: 'Current and new password are required' });
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(new_password)) {
      return res.status(400).json({ message: 'New password must be at least 8 characters and include uppercase, lowercase and number' });
    }
    const [[user]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const stored = user?.password_hash || '';
    const valid = stored.startsWith('sha256:')
      ? `sha256:${crypto.createHash('sha256').update(current_password).digest('hex')}` === stored
      : await bcrypt.compare(current_password, stored).catch(() => false);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    await pool.query('INSERT INTO hospital_devices (hospital_id,device_name,ip_address,user_agent,last_seen_at) VALUES (?,?,?,?,NOW())', [req.user.id, 'Password updated session', null, 'security-event']);
    res.json({ message: 'Password changed successfully' });
  });

  router.post('/profile/security/device', async (req, res) => {
    const deviceName = req.body.device_name || 'Current browser';
    await pool.query(
      'INSERT INTO hospital_devices (hospital_id,device_name,ip_address,user_agent,last_seen_at) VALUES (?,?,?,?,NOW())',
      [req.user.id, deviceName, req.ip, req.headers['user-agent'] || 'Unknown']
    );
    res.status(201).json({ message: 'Device tracked' });
  });

  router.get('/donors', async (req, res) => {
    const contactColumn = await getUserContactColumn(pool);
    const {
      blood_group,
      city,
      availability,
      eligibility,
      q,
      gender,
      age_min,
      age_max,
      distance_km,
      last_donation_from,
      last_donation_to
    } = req.query;
    const { limit, offset } = page(req);
    const [[hospitalLocationRow]] = await pool.query(
      `SELECT COALESCE(hp.latitude, u.latitude) AS latitude, COALESCE(hp.longitude, u.longitude) AS longitude,
              COALESCE(hp.city, u.city) AS city
       FROM users u LEFT JOIN hospital_profile hp ON hp.hospital_id = u.id WHERE u.id = ?`,
      [req.user.id]
    );
    const hospitalLocation = hospitalLocationRow?.latitude && hospitalLocationRow?.longitude
      ? hospitalLocationRow
      : cityCenter(city || hospitalLocationRow?.city || '');
    const hasHospitalLocation = hospitalLocation?.latitude && hospitalLocation?.longitude;
    const distanceExpr = hasHospitalLocation
      ? `(6371 * ACOS(LEAST(1, COS(RADIANS(?)) * COS(RADIANS(u.latitude)) * COS(RADIANS(u.longitude) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(u.latitude)))))`
      : 'NULL';
    const selectParams = hasHospitalLocation ? [hospitalLocation.latitude, hospitalLocation.longitude, hospitalLocation.latitude] : [];
    const params = [];
    let where = 'WHERE u.role = "donor" AND u.is_verified = 1';
    if (blood_group) { where += ' AND u.blood_group = ?'; params.push(blood_group); }
    if (city) { where += ' AND u.city LIKE ?'; params.push(`%${city}%`); }
    if (q) { where += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.${contactColumn} LIKE ? OR u.city LIKE ?)`; params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
    if (availability) { where += ' AND COALESCE(dp.availability,"available") = ?'; params.push(availability); }
    if (gender) { where += ' AND dp.gender = ?'; params.push(gender); }
    if (eligibility === 'eligible') where += ' AND (dp.next_eligible_date IS NULL OR dp.next_eligible_date <= CURDATE())';
    if (age_min) { where += ' AND dp.date_of_birth IS NOT NULL AND TIMESTAMPDIFF(YEAR, dp.date_of_birth, CURDATE()) >= ?'; params.push(Number(age_min)); }
    if (age_max) { where += ' AND dp.date_of_birth IS NOT NULL AND TIMESTAMPDIFF(YEAR, dp.date_of_birth, CURDATE()) <= ?'; params.push(Number(age_max)); }
    if (last_donation_from) { where += ' AND dp.last_donation_date >= ?'; params.push(last_donation_from); }
    if (last_donation_to) { where += ' AND dp.last_donation_date <= ?'; params.push(last_donation_to); }
    const sortColumn = safeSort(req.query.sort, ['name', 'city', 'blood_group', 'created_at', 'match_score', 'distance_km'], hasHospitalLocation ? 'distance_km' : 'name');
    const orderBy = sortColumn === 'distance_km' ? 'distance_km' : sortColumn === 'match_score' ? 'match_score' : `u.${sortColumn}`;
    const [rawRows] = await pool.query(
      `SELECT u.id,u.name,u.email,u.${contactColumn} AS phone,u.${contactColumn} AS mobile,u.blood_group,u.city,u.latitude,u.longitude,
              dp.gender,dp.date_of_birth,TIMESTAMPDIFF(YEAR, dp.date_of_birth, CURDATE()) AS age,
              dp.last_donation_date,dp.next_eligible_date,dp.hemoglobin,COALESCE(dp.availability,"available") AS availability,
              (CASE WHEN dp.next_eligible_date IS NULL OR dp.next_eligible_date <= CURDATE() THEN 42 ELSE 12 END +
               CASE WHEN COALESCE(dp.availability,"available") = "available" THEN 34 ELSE 10 END +
               LEAST(24, ROUND(COALESCE(dp.hemoglobin, 13)))) AS match_score,
              ${distanceExpr} AS distance_km
       FROM users u LEFT JOIN donor_profiles dp ON dp.user_id = u.id ${where}
       ORDER BY ${orderBy} ${safeDir(req.query.dir)}
       LIMIT ? OFFSET ?`,
      [...selectParams, ...params, limit, offset]
    );
    let rows = rawRows.map((row, index) => {
      const located = withLocationFallback(row, index);
      const realDistance = hasHospitalLocation ? distanceKm(hospitalLocation, located) : null;
      return realDistance === null ? located : { ...located, distance_km: realDistance };
    });
    if (distance_km && hasHospitalLocation) {
      rows = rows.filter((row) => Number(row.distance_km) <= Number(distance_km));
    }
    const [[total]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u LEFT JOIN donor_profiles dp ON dp.user_id = u.id ${where}`,
      params
    );
    res.json({ rows: rows.map(scoreDonor), total: distance_km && hasHospitalLocation ? rows.length : total.total, limit, offset, map_center: hospitalLocation || cityCenter(city || '') });
  });

  router.get('/donor-requests', listTable('donor_requests', 'hospital_id'));
  router.post('/donor-requests', async (req, res) => {
    requireFields(req.body, ['donor_id', 'blood_group']);
    const [result] = await pool.query('INSERT INTO donor_requests (hospital_id,donor_id,blood_group,message,status) VALUES (?,?,?,?, "pending")', [req.user.id, req.body.donor_id, req.body.blood_group, req.body.message || 'Hospital blood donation request']);
    await notify(req.body.donor_id, 'New donor request', 'A hospital requested your blood donation support.', 'info', io);
    res.status(201).json({ message: 'Donor request sent', id: result.insertId });
  });
  router.patch('/donor-requests/:id', updateTable('donor_requests', 'hospital_id', ['status', 'message']));
  router.delete('/donor-requests/:id', deleteTable('donor_requests', 'hospital_id'));

  router.get('/blood-requests', async (req, res) => {
    const { limit, offset } = page(req);
    const [rows] = await pool.query('SELECT * FROM blood_requests WHERE requester_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', [req.user.id, limit, offset]);
    res.json({ rows, limit, offset });
  });
  router.post('/blood-requests', async (req, res) => {
    requireFields(req.body, ['patient_name', 'blood_group', 'units_needed']);
    const [result] = await pool.query(
      'INSERT INTO blood_requests (requester_id,patient_name,blood_group,units_needed,urgency,hospital_name,city,contact_mobile,needed_by,status) VALUES (?,?,?,?,?,?,?,?,?,"open")',
      [req.user.id, req.body.patient_name, req.body.blood_group, req.body.units_needed, req.body.urgency || 'normal', req.body.hospital_name || req.user.name, req.body.city || null, req.body.contact_mobile || null, req.body.needed_by || null]
    );
    res.status(201).json({ message: 'Blood request created', id: result.insertId });
  });
  router.patch('/blood-requests/:id', async (req, res) => {
    await patchByOwner('blood_requests', 'requester_id', req.user.id, req.params.id, pick(req.body, ['patient_name', 'blood_group', 'units_needed', 'urgency', 'status', 'needed_by', 'city', 'contact_mobile']));
    res.json({ message: 'Blood request updated' });
  });
  router.delete('/blood-requests/:id', async (req, res) => {
    await pool.query('DELETE FROM blood_requests WHERE id = ? AND requester_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Blood request deleted' });
  });

  router.get('/emergency-requests', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM emergency_requests WHERE requester_id = ? ORDER BY priority_score DESC, created_at DESC', [req.user.id]);
    res.json({ rows });
  });
  router.post('/emergency-requests', async (req, res) => {
    requireFields(req.body, ['patient_name', 'blood_group', 'units_needed']);
    const priority = emergencyScore(req.body.emergency_level, req.body.time_limit_minutes);
    const [result] = await pool.query(
      'INSERT INTO emergency_requests (requester_id,patient_name,blood_group,units_needed,hospital_name,city,priority_score,status,contact_mobile,needed_by) VALUES (?,?,?,?,?,?,?,"approved",?,?)',
      [req.user.id, req.body.patient_name, req.body.blood_group, req.body.units_needed, req.body.hospital_name || req.user.name, req.body.city || null, priority, req.body.contact_mobile || null, req.body.needed_by || null]
    );
    await broadcastEmergency(req.user.id, req.body, io);
    res.status(201).json({ message: 'Emergency request created and broadcasted', id: result.insertId });
  });
  router.post('/emergency-requests/:id/broadcast', async (req, res) => {
    const [[request]] = await pool.query('SELECT * FROM emergency_requests WHERE id = ? AND requester_id = ?', [req.params.id, req.user.id]);
    if (!request) return res.status(404).json({ message: 'Emergency request not found' });
    await broadcastEmergency(req.user.id, request, io);
    await pool.query('UPDATE emergency_requests SET status = "broadcasted" WHERE id = ?', [req.params.id]);
    res.json({ message: 'Emergency broadcast sent' });
  });
  router.patch('/emergency-requests/:id', async (req, res) => {
    await patchByOwner('emergency_requests', 'requester_id', req.user.id, req.params.id, pick(req.body, ['patient_name', 'blood_group', 'units_needed', 'hospital_name', 'city', 'priority_score', 'status', 'contact_mobile', 'needed_by']));
    res.json({ message: 'Emergency request updated' });
  });
  router.delete('/emergency-requests/:id', async (req, res) => {
    await pool.query('DELETE FROM emergency_requests WHERE id = ? AND requester_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Emergency request deleted' });
  });

  router.get('/inventory', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM blood_inventory WHERE owner_id = ? ORDER BY blood_group, expires_on', [req.user.id]);
    res.json({ rows, summary: inventorySummary(rows) });
  });
  router.post('/inventory', async (req, res) => {
    requireFields(req.body, ['blood_group', 'units']);
    const [result] = await pool.query('INSERT INTO blood_inventory (owner_id,blood_group,units,expires_on) VALUES (?,?,?,?)', [req.user.id, req.body.blood_group, req.body.units, req.body.expires_on || null]);
    res.status(201).json({ message: 'Stock added', id: result.insertId });
  });
  router.patch('/inventory/:id', async (req, res) => {
    await patchByOwner('blood_inventory', 'owner_id', req.user.id, req.params.id, pick(req.body, ['blood_group', 'units', 'expires_on']));
    res.json({ message: 'Stock updated' });
  });
  router.delete('/inventory/:id', async (req, res) => {
    await pool.query('DELETE FROM blood_inventory WHERE id = ? AND owner_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Stock removed' });
  });

  router.get('/rare-blood', async (req, res) => {
    const [rows] = await pool.query('SELECT id,name,email,blood_group,city,latitude,longitude FROM users WHERE role = "donor" AND is_verified = 1 AND blood_group IN ("O-","AB-","A-","B-") ORDER BY blood_group, city LIMIT 100');
    res.json({ rows: rows.map(scoreDonor), ai: rows.slice(0, 5).map((row) => ({ donor_id: row.id, suggestion: `Prioritize ${row.name} for ${row.blood_group} rare blood readiness` })) });
  });

  router.get('/availability', async (req, res) => {
    const [rows] = await pool.query('SELECT blood_group, SUM(units) AS units FROM blood_inventory WHERE owner_id = ? GROUP BY blood_group ORDER BY blood_group', [req.user.id]);
    res.json({ rows, refreshed_at: new Date().toISOString() });
  });

  router.get('/appointments', listAppointments);
  router.post('/appointments', async (req, res) => {
    requireFields(req.body, ['donor_id', 'appointment_at']);
    const [result] = await pool.query('INSERT INTO appointments (donor_id,organizer_id,request_id,appointment_at,status,notes) VALUES (?,?,?,?, "scheduled", ?)', [req.body.donor_id, req.user.id, req.body.request_id || null, req.body.appointment_at, req.body.notes || null]);
    await notify(req.body.donor_id, 'Appointment scheduled', 'A hospital scheduled your donation appointment.', 'success', io);
    res.status(201).json({ message: 'Appointment created', id: result.insertId });
  });
  router.patch('/appointments/:id', async (req, res) => {
    await patchByOwner('appointments', 'organizer_id', req.user.id, req.params.id, pick(req.body, ['appointment_at', 'status', 'notes']));
    res.json({ message: 'Appointment updated' });
  });
  router.delete('/appointments/:id', async (req, res) => {
    await pool.query('DELETE FROM appointments WHERE id = ? AND organizer_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Appointment deleted' });
  });

  router.get('/donation-records', async (req, res) => {
    const [rows] = await pool.query(
      `SELECT d.*, u.name AS donor_name FROM donations d JOIN users u ON u.id = d.donor_id
       WHERE d.verified_by = ? OR d.appointment_id IN (SELECT id FROM appointments WHERE organizer_id = ?)
       ORDER BY d.donation_date DESC`,
      [req.user.id, req.user.id]
    );
    res.json({ rows });
  });
  router.post('/donation-records', async (req, res) => {
    requireFields(req.body, ['donor_id', 'donation_date']);
    const certificateCode = `LL-DON-${Date.now()}-${req.body.donor_id}`;
    const [result] = await pool.query(
      'INSERT INTO donations (donor_id,appointment_id,blood_group,units,donation_date,certificate_code,verified_by) VALUES (?,?,?,?,?,?,?)',
      [req.body.donor_id, req.body.appointment_id || null, req.body.blood_group || null, req.body.units || 1, req.body.donation_date, certificateCode, req.user.id]
    );
    await notify(req.body.donor_id, 'Donation recorded', 'Your hospital donation record has been verified.', 'success', io);
    res.status(201).json({ message: 'Donation record added', id: result.insertId, certificate_code: certificateCode });
  });
  router.patch('/donation-records/:id', async (req, res) => {
    await patchByOwner('donations', 'verified_by', req.user.id, req.params.id, pick(req.body, ['donor_id', 'appointment_id', 'blood_group', 'units', 'donation_date', 'certificate_code']));
    res.json({ message: 'Donation record updated' });
  });
  router.delete('/donation-records/:id', async (req, res) => {
    await pool.query('DELETE FROM donations WHERE id = ? AND verified_by = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Donation record deleted' });
  });

  router.get('/nearby-centers', async (req, res) => {
    const [rows] = await pool.query('SELECT id,name,role,city,address,latitude,longitude FROM users WHERE role IN ("hospital","blood_bank") AND id <> ? ORDER BY city,name LIMIT 100', [req.user.id]);
    res.json({ rows: rows.map(withLocationFallback) });
  });

  router.get('/smart-matching', async (req, res) => {
    req.query.eligibility = 'eligible';
    const contactColumn = await getUserContactColumn(pool);
    const [rows] = await pool.query(
      `SELECT u.id,u.name,u.${contactColumn} AS phone,u.blood_group,u.city,dp.last_donation_date,dp.next_eligible_date,dp.hemoglobin,COALESCE(dp.availability,"available") AS availability
       FROM users u LEFT JOIN donor_profiles dp ON dp.user_id = u.id
       WHERE u.role = "donor" AND u.is_verified = 1
       ORDER BY CASE WHEN dp.next_eligible_date IS NULL OR dp.next_eligible_date <= CURDATE() THEN 0 ELSE 1 END, dp.hemoglobin DESC
       LIMIT 20`
    );
    res.json({ rows: rows.map(scoreDonor) });
  });

  router.get('/live-tracking', async (req, res) => {
    const [rows] = await pool.query('SELECT id,name,blood_group,city,latitude,longitude FROM users WHERE role = "donor" LIMIT 50');
    res.json({ rows: rows.map(withLocationFallback), eta_minutes: 18, route_status: 'ready' });
  });

  router.get('/notifications', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [req.user.id]);
    res.json({ rows });
  });
  router.patch('/notifications/:id', async (req, res) => {
    await pool.query('UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Notification marked read' });
  });
  router.delete('/notifications/:id', async (req, res) => {
    await pool.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Notification deleted' });
  });

  router.get('/chat', async (req, res) => {
    const room = req.query.room || `hospital-${req.user.id}`;
    const [rows] = await pool.query('SELECT * FROM chats WHERE room = ? ORDER BY created_at ASC LIMIT 100', [room]);
    res.json({ rows, room });
  });
  router.post('/chat', async (req, res) => {
    const room = req.body.room || `hospital-${req.user.id}`;
    requireFields(req.body, ['message']);
    await pool.query('INSERT INTO chats (room,user_id,message) VALUES (?,?,?)', [room, req.user.id, req.body.message]);
    io?.to(room).emit('chat-message', { room, user_id: req.user.id, message: req.body.message, created_at: new Date().toISOString() });
    res.status(201).json({ message: 'Message sent' });
  });

  router.get('/reports', async (req, res) => {
    const [[requests]] = await pool.query('SELECT COUNT(*) AS total FROM blood_requests WHERE requester_id = ?', [req.user.id]);
    const [[emergencies]] = await pool.query('SELECT COUNT(*) AS total FROM emergency_requests WHERE requester_id = ?', [req.user.id]);
    const [inventory] = await pool.query('SELECT blood_group, SUM(units) AS units FROM blood_inventory WHERE owner_id = ? GROUP BY blood_group', [req.user.id]);
    res.json({ requests: requests.total, emergencies: emergencies.total, inventory, export_formats: ['pdf', 'excel'] });
  });

  router.get('/ai-prediction', async (req, res) => {
    const [inventory] = await pool.query('SELECT blood_group, SUM(units) AS units FROM blood_inventory WHERE owner_id = ? GROUP BY blood_group', [req.user.id]);
    const stock = new Map(inventory.map((item) => [item.blood_group, Number(item.units || 0)]));
    const groups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    res.json({
      rows: groups.map((bloodGroup) => {
        const units = stock.get(bloodGroup) || 0;
        const critical = units < 4;
        const low = units < 8;
        return {
          blood_group: bloodGroup,
          units,
          prediction: critical ? `${bloodGroup} shortage expected within 24 hours` : low ? `${bloodGroup} shortage expected in 3 days` : `${bloodGroup} stable for 7 days`,
          confidence: critical ? 94 : low ? 88 : 72,
          action: critical ? 'Broadcast emergency alert to eligible donors' : low ? 'Notify nearby eligible donors' : 'Maintain monitoring'
        };
      })
    });
  });

  router.get('/subscription', async (req, res) => {
    const [[subscription]] = await pool.query('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.user.id]);
    res.json({ subscription, plans });
  });
  router.post('/subscription/subscribe', async (req, res) => {
    const plan = plans[req.body.plan || 'basic'];
    if (!plan) return res.status(400).json({ message: 'Invalid plan' });
    const provider = String(req.body.provider || process.env.PAYMENT_PROVIDER || 'cashfree').toLowerCase() === 'razorpay' ? 'razorpay' : 'cashfree';
    const [result] = await pool.query('INSERT INTO subscriptions (user_id,plan_name,amount_paise,status) VALUES (?,?,?,"created")', [req.user.id, plan.name, plan.amount]);
    const order = provider === 'cashfree'
      ? await createCashfreeOrder({
        amountPaise: plan.amount,
        orderId: `lifelink_hospital_cf_${result.insertId}_${Date.now()}`,
        customer: req.user,
        returnUrl: `${process.env.APP_URL || 'http://localhost:4000'}/pages/hospital/subscription-plan.html`
      })
      : await createOrder(plan.amount, `lifelink_hospital_${result.insertId}`);
    const orderId = order.order_id || order.id;
    await pool.query('UPDATE subscriptions SET razorpay_order_id = ?, payment_provider = ?, cashfree_order_id = IF(?="cashfree",?,cashfree_order_id) WHERE id = ?', [orderId, provider, provider, orderId, result.insertId]);
    res.json({
      provider,
      key: provider === 'razorpay' ? (process.env.RAZORPAY_KEY_ID || 'rzp_test_add_key_here') : null,
      cashfree: provider === 'cashfree' ? { environment: getCashfreeConfig()?.environment || 'sandbox', payment_session_id: order.payment_session_id, order_id: order.order_id } : null,
      order,
      subscriptionId: result.insertId
    });
  });

  router.get('/payments', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ rows });
  });
  router.get('/invoices', async (req, res) => {
    const [rows] = await pool.query('SELECT id,plan_name,amount_paise,status,created_at,expires_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({ rows: rows.map((row) => ({ ...row, invoice_no: `LL-INV-${String(row.id).padStart(5, '0')}`, download_url: `/api/hospital/invoices/${row.id}/download` })) });
  });
  router.get('/invoices/:id/download', async (req, res) => {
    const [[invoice]] = await pool.query('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    const [[hospital]] = await pool.query('SELECT name,email,city,address FROM users WHERE id = ?', [req.user.id]);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="LL-INV-${String(invoice.id).padStart(5, '0')}.html"`);
    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>LifeLink Invoice</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111827}.brand{color:#e9194f;font-weight:800}.box{border:1px solid #e5e7eb;padding:18px;border-radius:8px;margin:18px 0}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #e5e7eb;text-align:left}</style></head><body><h1 class="brand">LifeLink Invoice</h1><div class="box"><b>Invoice:</b> LL-INV-${String(invoice.id).padStart(5, '0')}<br><b>Hospital:</b> ${escapeHtml(hospital?.name || 'Hospital')}<br><b>Email:</b> ${escapeHtml(hospital?.email || '')}<br><b>City:</b> ${escapeHtml(hospital?.city || '')}</div><table><tr><th>Plan</th><th>Status</th><th>Amount</th><th>Date</th></tr><tr><td>${escapeHtml(invoice.plan_name)}</td><td>${escapeHtml(invoice.status)}</td><td>Rs ${(Number(invoice.amount_paise || 0) / 100).toLocaleString('en-IN')}</td><td>${new Date(invoice.created_at).toLocaleDateString('en-IN')}</td></tr></table><p>Generated by LifeLink Hospital OS.</p></body></html>`);
  });

  router.get('/staff', listTable('staff_management', 'hospital_id'));
  router.post('/staff', async (req, res) => {
    requireFields(req.body, ['staff_name', 'role_title']);
    const [result] = await pool.query('INSERT INTO staff_management (hospital_id,staff_name,email,mobile,role_title,department,shift_name,status,tasks_completed,last_active_at) VALUES (?,?,?,?,?,?,?,?,0,NOW())', [req.user.id, req.body.staff_name, req.body.email || null, req.body.mobile || null, req.body.role_title, req.body.department || null, req.body.shift_name || null, req.body.status || 'active']);
    res.status(201).json({ message: 'Staff member added', id: result.insertId });
  });
  router.patch('/staff/:id', updateTable('staff_management', 'hospital_id', ['staff_name', 'email', 'mobile', 'role_title', 'department', 'shift_name', 'status', 'tasks_completed']));
  router.delete('/staff/:id', deleteTable('staff_management', 'hospital_id'));

  router.get('/branches', listTable('hospital_branches', 'hospital_id'));
  router.post('/branches', async (req, res) => {
    requireFields(req.body, ['branch_name', 'city']);
    const [result] = await pool.query('INSERT INTO hospital_branches (hospital_id,branch_name,branch_type,phone,city,address,latitude,longitude,status) VALUES (?,?,?,?,?,?,?,?,?)', [req.user.id, req.body.branch_name, req.body.branch_type || 'general', req.body.phone || null, req.body.city, req.body.address || null, req.body.latitude || null, req.body.longitude || null, req.body.status || 'active']);
    res.status(201).json({ message: 'Branch added', id: result.insertId });
  });
  router.patch('/branches/:id', updateTable('hospital_branches', 'hospital_id', ['branch_name', 'branch_type', 'phone', 'city', 'address', 'latitude', 'longitude', 'status']));
  router.delete('/branches/:id', deleteTable('hospital_branches', 'hospital_id'));

  router.get('/settings', async (req, res) => {
    const [[settings]] = await pool.query('SELECT * FROM hospital_settings WHERE hospital_id = ?', [req.user.id]);
    res.json({ settings: settings || {} });
  });
  router.put('/settings', async (req, res) => {
    await upsert('hospital_settings', 'hospital_id', req.user.id, pick(req.body, ['emergency_24x7', 'email_notifications', 'sms_notifications', 'whatsapp_notifications', 'two_factor_enabled', 'otp_channel', 'language', 'dark_mode', 'auto_renew', 'payment_reminder_days', 'location_sharing', 'staff_approval_required']));
    res.json({ message: 'Settings updated' });
  });

  router.get('/support', listTable('support_tickets', 'hospital_id'));
  router.post('/support', async (req, res) => {
    requireFields(req.body, ['subject', 'message']);
    const [result] = await pool.query('INSERT INTO support_tickets (hospital_id,subject,message,priority,status) VALUES (?,?,?,?, "open")', [req.user.id, escapeHtml(req.body.subject), escapeHtml(req.body.message), req.body.priority || 'medium']);
    res.status(201).json({ message: 'Support ticket raised', id: result.insertId });
  });
  router.patch('/support/:id', updateTable('support_tickets', 'hospital_id', ['subject', 'message', 'priority', 'status']));
  router.delete('/support/:id', deleteTable('support_tickets', 'hospital_id'));

  return router;
};

function requireFields(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      const error = new Error(`${field.replace(/_/g, ' ')} is required`);
      error.status = 400;
      throw error;
    }
  }
}

function page(req) {
  const limit = Math.min(Number(req.query.limit || 20), 100);
  const offset = Math.max(Number(req.query.offset || 0), 0);
  return { limit, offset };
}

function safeSort(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function safeDir(value) {
  return String(value).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function pick(source, keys) {
  return keys.reduce((out, key) => {
    if (source[key] !== undefined) out[key] = source[key];
    return out;
  }, {});
}

async function upsert(table, ownerColumn, ownerId, values) {
  const insertValues = { ...values };
  if (table === 'hospital_profile' && !insertValues.hospital_name) {
    const [[existing]] = await pool.query('SELECT hospital_name FROM hospital_profile WHERE hospital_id = ?', [ownerId]);
    if (existing?.hospital_name) {
      insertValues.hospital_name = existing.hospital_name;
    } else {
      const [[user]] = await pool.query('SELECT name FROM users WHERE id = ?', [ownerId]);
      insertValues.hospital_name = user?.name || 'Hospital';
    }
  }
  const columns = Object.keys(insertValues);
  if (!columns.length) return;
  const insertColumns = [ownerColumn, ...columns];
  const updateColumns = Object.keys(values);
  const updateSql = updateColumns.length ? updateColumns.map((column) => `${column}=VALUES(${column})`).join(',') : `${ownerColumn}=VALUES(${ownerColumn})`;
  await pool.query(
    `INSERT INTO ${table} (${insertColumns.join(',')}) VALUES (${insertColumns.map(() => '?').join(',')}) ON DUPLICATE KEY UPDATE ${updateSql}`,
    [ownerId, ...columns.map((column) => insertValues[column])]
  );
}

async function ensureProfileRow(userId) {
  const [[existing]] = await pool.query('SELECT hospital_id FROM hospital_profile WHERE hospital_id = ?', [userId]);
  if (existing) return;
  const [[user]] = await pool.query('SELECT name,city,address,latitude,longitude FROM users WHERE id = ?', [userId]);
  await pool.query(
    'INSERT INTO hospital_profile (hospital_id,hospital_name,city,full_address,latitude,longitude,country,hospital_category,hospital_type) VALUES (?,?,?,?,?,?,?,?,?)',
    [userId, user?.name || 'Hospital', user?.city || null, user?.address || null, user?.latitude || null, user?.longitude || null, 'India', 'Multi-specialty', 'Private']
  );
}

async function patchByOwner(table, ownerColumn, ownerId, id, values) {
  const columns = Object.keys(values).filter((key) => values[key] !== undefined);
  if (!columns.length) return;
  await pool.query(`UPDATE ${table} SET ${columns.map((column) => `${column}=?`).join(',')} WHERE id = ? AND ${ownerColumn} = ?`, [...columns.map((column) => values[column]), id, ownerId]);
}

function listTable(table, ownerColumn) {
  return async (req, res) => {
    const { limit, offset } = page(req);
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${ownerColumn} = ? ORDER BY id DESC LIMIT ? OFFSET ?`, [req.user.id, limit, offset]);
    const [[total]] = await pool.query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${ownerColumn} = ?`, [req.user.id]);
    res.json({ rows, total: total.total, limit, offset });
  };
}

function updateTable(table, ownerColumn, allowed) {
  return async (req, res) => {
    await patchByOwner(table, ownerColumn, req.user.id, req.params.id, pick(req.body, allowed));
    res.json({ message: 'Record updated' });
  };
}

function deleteTable(table, ownerColumn) {
  return async (req, res) => {
    await pool.query(`DELETE FROM ${table} WHERE id = ? AND ${ownerColumn} = ?`, [req.params.id, req.user.id]);
    res.json({ message: 'Record deleted' });
  };
}

async function listAppointments(req, res) {
  const { limit, offset } = page(req);
  const [rows] = await pool.query(
    `SELECT a.*, u.name AS donor_name, u.blood_group, u.mobile AS donor_mobile
     FROM appointments a JOIN users u ON u.id = a.donor_id
     WHERE a.organizer_id = ? ORDER BY a.appointment_at DESC LIMIT ? OFFSET ?`,
    [req.user.id, limit, offset]
  );
  res.json({ rows, limit, offset });
}

function scoreDonor(donor) {
  const eligible = !donor.next_eligible_date || new Date(donor.next_eligible_date) <= new Date();
  const hb = Number(donor.hemoglobin || 13);
  const realDistance = donor.distance_km === null || donor.distance_km === undefined ? null : Number(Number(donor.distance_km).toFixed(1));
  return {
    ...donor,
    distance_km: realDistance ?? null,
    eligibility: eligible && hb >= 12.5 ? 'eligible' : 'review',
    match_score: Number(donor.match_score || ((eligible ? 42 : 12) + (donor.availability === 'available' ? 34 : 10) + Math.min(24, Math.round(hb))))
  };
}

function emergencyScore(level = 'critical', minutes = 120) {
  const base = { critical: 92, high: 82, medium: 66, low: 44 }[String(level).toLowerCase()] || 80;
  return Math.min(100, base + (Number(minutes) <= 60 ? 8 : 0));
}

async function broadcastEmergency(hospitalId, request, io) {
  const [donors] = await pool.query('SELECT id FROM users WHERE role = "donor" AND is_verified = 1 AND (blood_group = ? OR ? = "") LIMIT 50', [request.blood_group || '', request.blood_group || '']);
  await Promise.all(donors.map((donor) => notify(donor.id, 'Emergency blood alert', `${request.blood_group} blood needed urgently.`, 'danger', io)));
  await notify(hospitalId, 'Emergency broadcast sent', `${donors.length} nearby donors notified.`, 'success', io);
}

async function notify(userId, title, message, type, io) {
  await pool.query('INSERT INTO notifications (user_id,title,message,type) VALUES (?,?,?,?)', [userId, title, message, type]);
  io?.to(`user-${userId}`).emit('notification', { title, message, type, created_at: new Date().toISOString() });
}

function inventorySummary(rows) {
  const groups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
  return groups.map((group) => {
    const units = rows.filter((row) => row.blood_group === group).reduce((sum, row) => sum + Number(row.units || 0), 0);
    return { blood_group: group, units, status: units <= 3 ? 'critical' : units <= 8 ? 'low' : 'healthy' };
  });
}

function emptyProfile(user) {
  return {
    hospital_name: user?.name || '',
    hospital_category: 'Multi-specialty',
    hospital_type: 'Private',
    country: 'India',
    state: '',
    city: user?.city || '',
    full_address: user?.address || '',
    emergency_helpline: '',
    website: ''
  };
}

async function ensureHospitalTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS hospital_profile (
    hospital_id INT PRIMARY KEY,
    hospital_name VARCHAR(160) NOT NULL,
    logo_path VARCHAR(255),
    cover_path VARCHAR(255),
    registration_number VARCHAR(100),
    license_number VARCHAR(100),
    gst_number VARCHAR(40),
    establishment_year INT,
    hospital_category VARCHAR(100),
    hospital_type VARCHAR(100),
    phone VARCHAR(30),
    whatsapp VARCHAR(30),
    emergency_helpline VARCHAR(30),
    website VARCHAR(180),
    country VARCHAR(80),
    state VARCHAR(100),
    city VARCHAR(100),
    pincode VARCHAR(20),
    full_address VARCHAR(255),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    monday_hours VARCHAR(80),
    tuesday_hours VARCHAR(80),
    wednesday_hours VARCHAR(80),
    thursday_hours VARCHAR(80),
    friday_hours VARCHAR(80),
    saturday_hours VARCHAR(80),
    sunday_hours VARCHAR(80),
    emergency_24x7 TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hospital_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    document_type VARCHAR(80) NOT NULL,
    file_name VARCHAR(180) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120),
    verification_status ENUM('pending','verified','rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hospital_settings (
    hospital_id INT PRIMARY KEY,
    emergency_24x7 TINYINT(1) DEFAULT 1,
    email_notifications TINYINT(1) DEFAULT 1,
    sms_notifications TINYINT(1) DEFAULT 1,
    whatsapp_notifications TINYINT(1) DEFAULT 1,
    two_factor_enabled TINYINT(1) DEFAULT 0,
    otp_channel ENUM('email','sms','both') DEFAULT 'both',
    language VARCHAR(12) DEFAULT 'en',
    dark_mode TINYINT(1) DEFAULT 0,
    auto_renew TINYINT(1) DEFAULT 1,
    payment_reminder_days INT DEFAULT 7,
    location_sharing TINYINT(1) DEFAULT 1,
    staff_approval_required TINYINT(1) DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await addColumnIfMissing('hospital_settings', 'whatsapp_notifications', 'TINYINT(1) DEFAULT 1');
  await addColumnIfMissing('hospital_settings', 'auto_renew', 'TINYINT(1) DEFAULT 1');
  await addColumnIfMissing('hospital_settings', 'payment_reminder_days', 'INT DEFAULT 7');
  await addColumnIfMissing('hospital_settings', 'location_sharing', 'TINYINT(1) DEFAULT 1');
  await addColumnIfMissing('hospital_settings', 'staff_approval_required', 'TINYINT(1) DEFAULT 1');
  await pool.query(`CREATE TABLE IF NOT EXISTS donor_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    donor_id INT NOT NULL,
    blood_group VARCHAR(5) NOT NULL,
    message TEXT,
    status ENUM('pending','accepted','rejected','cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS staff_management (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    staff_name VARCHAR(120) NOT NULL,
    email VARCHAR(160),
    mobile VARCHAR(24),
    role_title VARCHAR(80) NOT NULL,
    department VARCHAR(100),
    shift_name VARCHAR(60),
    status ENUM('active','inactive','on_leave') DEFAULT 'active',
    tasks_completed INT DEFAULT 0,
    last_active_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hospital_branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    branch_name VARCHAR(140) NOT NULL,
    branch_type VARCHAR(80),
    phone VARCHAR(30),
    city VARCHAR(100),
    address VARCHAR(255),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS support_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    subject VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
    status ENUM('open','in_progress','resolved','closed') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hospital_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    device_name VARCHAR(120),
    ip_address VARCHAR(80),
    user_agent VARCHAR(255),
    last_seen_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await addColumnIfMissing('hospital_profile', 'emergency_24x7', 'TINYINT(1) DEFAULT 1');
  await addColumnIfMissing('hospital_profile', 'logo_path', 'VARCHAR(255)');
  await addColumnIfMissing('hospital_profile', 'cover_path', 'VARCHAR(255)');
  await addColumnIfMissing('donor_profiles', 'gender', "ENUM('male','female','other') NULL");
  await addColumnIfMissing('donor_profiles', 'date_of_birth', 'DATE NULL');
  await addColumnIfMissing('donor_profiles', 'profile_image', 'VARCHAR(255) NULL');
}

async function addColumnIfMissing(table, column, definition) {
  try {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }
}
