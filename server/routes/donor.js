const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { getUserContactColumn } = require('../utils/userColumns');
const { cityCenter, distanceKm, withLocationFallback } = require('../utils/locations');

const uploadRoot = path.join(__dirname, '..', '..', 'uploads', 'donor-reports');
fs.mkdirSync(uploadRoot, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadRoot,
    filename: (req, file, done) => done(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '-')}`)
  }),
  limits: { fileSize: 8 * 1024 * 1024 }
});

module.exports = (io) => {
  const router = express.Router();
  router.use(auth(['donor', 'admin', 'super_admin']));
  router.use(async (req, res, next) => {
    await ensureDonorTables();
    next();
  });

  router.get('/dashboard', async (req, res) => {
    const userId = donorId(req);
    const contactColumn = await getUserContactColumn(pool);
    const [[user]] = await pool.query(`SELECT id,name,email,${contactColumn} AS mobile,blood_group,city,address,latitude,longitude,referral_code,created_at FROM users WHERE id = ?`, [userId]);
    const [[profile]] = await pool.query('SELECT * FROM donor_profiles WHERE user_id = ?', [userId]);
    const [[points]] = await pool.query('SELECT COALESCE(SUM(points),0) AS total FROM rewards WHERE user_id = ?', [userId]);
    const [[appointments]] = await pool.query('SELECT COUNT(*) AS total FROM appointments WHERE donor_id = ?', [userId]);
    const [[requests]] = await pool.query('SELECT COUNT(*) AS total FROM donor_requests WHERE donor_id = ? AND status = "pending"', [userId]);
    const [[donations]] = await pool.query('SELECT COUNT(*) AS total FROM donations WHERE donor_id = ?', [userId]);
    const [[notifications]] = await pool.query('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL', [userId]);
    res.json({
      user,
      profile,
      stats: {
        points: points.total,
        appointments: appointments.total,
        pendingRequests: requests.total,
        donations: donations.total,
        unreadNotifications: notifications.total,
        eligibility: eligibility(profile)
      },
      card: {
        donor_id: `LL-DON-${String(user.id).padStart(5, '0')}`,
        qr_value: `${process.env.APP_URL || 'http://localhost:4000'}/verify/donor/${user.id}`,
        issued_at: user.created_at
      }
    });
  });

  router.get('/profile', async (req, res) => {
    const userId = donorId(req);
    const contactColumn = await getUserContactColumn(pool);
    const [[user]] = await pool.query(`SELECT id,name,email,${contactColumn} AS mobile,blood_group,city,address,latitude,longitude,referral_code FROM users WHERE id = ?`, [userId]);
    const [[profile]] = await pool.query('SELECT * FROM donor_profiles WHERE user_id = ?', [userId]);
    res.json({ profile: { ...user, ...profile, eligibility: eligibility(profile) } });
  });

  router.put('/profile', async (req, res) => {
    const userId = donorId(req);
    const contactColumn = await getUserContactColumn(pool);
    const userFields = pick(req.body, ['name', 'email', 'blood_group', 'city', 'address', 'latitude', 'longitude']);
    if (req.body.mobile) userFields[contactColumn] = req.body.mobile;
    await patchUser(userId, userFields);
    await upsertDonorProfile(userId, pick(req.body, ['gender', 'date_of_birth', 'weight_kg', 'hemoglobin', 'blood_pressure', 'last_donation_date', 'availability', 'emergency_opt_in', 'health_notes']));
    res.json({ message: 'Donor profile updated' });
  });

  router.get('/requests', async (req, res) => {
    const [rows] = await pool.query(
      `SELECT dr.*, h.name AS hospital_name, h.city AS hospital_city
       FROM donor_requests dr JOIN users h ON h.id = dr.hospital_id
       WHERE dr.donor_id = ? ORDER BY dr.created_at DESC`,
      [donorId(req)]
    );
    res.json({ rows });
  });

  router.patch('/requests/:id', async (req, res) => {
    const status = ['accepted', 'rejected', 'cancelled'].includes(req.body.status) ? req.body.status : 'accepted';
    await pool.query('UPDATE donor_requests SET status = ? WHERE id = ? AND donor_id = ?', [status, req.params.id, donorId(req)]);
    res.json({ message: `Request ${status}` });
  });

  router.get('/nearby-hospitals', async (req, res) => {
    const contactColumn = await getUserContactColumn(pool);
    const [[donor]] = await pool.query('SELECT city, latitude, longitude FROM users WHERE id = ?', [donorId(req)]);
    const donorLocation = donor?.latitude && donor?.longitude ? donor : cityCenter(donor?.city || req.query.city || '');
    const [rows] = await pool.query(`SELECT id,name,email,${contactColumn} AS phone,role,city,address,latitude,longitude FROM users WHERE role IN ("hospital","blood_bank") ORDER BY city,name LIMIT 100`);
    res.json({
      rows: rows.map((row, index) => {
        const located = withLocationFallback(row, index);
        const distance = donorLocation ? distanceKm(donorLocation, located) : null;
        return { ...located, distance_km: distance === null ? null : Number(distance.toFixed(1)) };
      }),
      map_center: donorLocation || cityCenter(req.query.city || '')
    });
  });

  router.get('/blood-camps', async (req, res) => {
    const [rows] = await pool.query(
      `SELECT bc.*, COALESCE(co.organization_name, u.name) AS organizer_name,
        EXISTS(SELECT 1 FROM camp_registration cr WHERE cr.camp_id = bc.id AND cr.donor_id = ?) AS registered
       FROM blood_camps bc
       LEFT JOIN camp_organizers co ON co.id = bc.organizer_id
       LEFT JOIN users u ON u.id = co.user_id
       ORDER BY bc.camp_date DESC LIMIT 100`,
      [donorId(req)]
    );
    res.json({ rows });
  });

  router.post('/blood-camps/:id/register', async (req, res) => {
    const qr = `LL-CAMP-${req.params.id}-${donorId(req)}`;
    await pool.query('INSERT IGNORE INTO camp_registration (camp_id,donor_id,qr_code) VALUES (?,?,?)', [req.params.id, donorId(req), qr]);
    await pool.query('UPDATE blood_camps SET registered_donors = registered_donors + 1 WHERE id = ?', [req.params.id]);
    res.status(201).json({ message: 'Blood camp registered', qr_code: qr });
  });

  router.get('/appointments', async (req, res) => {
    const [rows] = await pool.query(
      `SELECT a.*, u.name AS organizer_name, u.city AS organizer_city
       FROM appointments a JOIN users u ON u.id = a.organizer_id
       WHERE a.donor_id = ? ORDER BY a.appointment_at DESC`,
      [donorId(req)]
    );
    res.json({ rows });
  });

  router.patch('/appointments/:id', async (req, res) => {
    const status = ['scheduled', 'completed', 'cancelled'].includes(req.body.status) ? req.body.status : 'cancelled';
    await pool.query('UPDATE appointments SET status = ? WHERE id = ? AND donor_id = ?', [status, req.params.id, donorId(req)]);
    res.json({ message: 'Appointment updated' });
  });

  router.get('/donation-history', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM donations WHERE donor_id = ? ORDER BY donation_date DESC', [donorId(req)]);
    res.json({ rows });
  });

  router.get('/health', async (req, res) => {
    const [[profile]] = await pool.query('SELECT * FROM donor_profiles WHERE user_id = ?', [donorId(req)]);
    const [tracker] = await pool.query('SELECT * FROM health_tracker WHERE donor_id = ? ORDER BY recorded_at DESC LIMIT 30', [donorId(req)]);
    res.json({ profile, tracker, eligibility: eligibility(profile) });
  });

  router.post('/health', async (req, res) => {
    const userId = donorId(req);
    await upsertDonorProfile(userId, pick(req.body, ['weight_kg', 'hemoglobin', 'blood_pressure', 'last_donation_date', 'availability', 'health_notes']));
    const eligibilityStatus = Number(req.body.hemoglobin || 0) >= 12.5 ? 'eligible' : 'review';
    await pool.query('INSERT INTO health_tracker (donor_id,weight_kg,hemoglobin,blood_pressure,pulse_rate,eligibility_status) VALUES (?,?,?,?,?,?)', [userId, req.body.weight_kg || null, req.body.hemoglobin || null, req.body.blood_pressure || null, req.body.pulse_rate || null, eligibilityStatus]);
    await pool.query('INSERT INTO rewards (user_id,points,reason) VALUES (?,50,"Health tracker updated")', [userId]);
    res.status(201).json({ message: 'Health tracker updated' });
  });

  router.get('/medical-reports', async (req, res) => {
    const [rows] = await pool.query('SELECT *, CONCAT("/uploads/donor-reports/", file_path) AS file_url FROM medical_reports WHERE user_id = ? ORDER BY created_at DESC', [donorId(req)]);
    res.json({ rows });
  });

  router.post('/medical-reports', upload.single('report'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Report file is required' });
    const [result] = await pool.query('INSERT INTO medical_reports (user_id,file_name,file_path,report_type) VALUES (?,?,?,?)', [donorId(req), req.file.originalname, req.file.filename, req.body.report_type || 'general']);
    res.status(201).json({ message: 'Medical report uploaded', id: result.insertId });
  });

  router.get('/rewards', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM rewards WHERE user_id = ? ORDER BY created_at DESC', [donorId(req)]);
    res.json({ rows, total: rows.reduce((sum, row) => sum + Number(row.points || 0), 0) });
  });

  router.get('/wallet', async (req, res) => {
    const [rewards] = await pool.query('SELECT * FROM rewards WHERE user_id = ? ORDER BY created_at DESC', [donorId(req)]);
    const total = rewards.reduce((sum, row) => sum + Number(row.points || 0), 0);
    res.json({ balance_points: total, balance_rupees: Math.round(total / 10), rows: rewards });
  });

  router.get('/referrals', async (req, res) => {
    const [[user]] = await pool.query('SELECT referral_code FROM users WHERE id = ?', [donorId(req)]);
    const [rows] = await pool.query('SELECT r.*, u.name AS referred_name, u.role AS referred_role FROM referrals r JOIN users u ON u.id = r.referred_user_id WHERE r.referrer_id = ? ORDER BY r.created_at DESC', [donorId(req)]);
    res.json({ referral_code: user?.referral_code, invite_url: `${process.env.APP_URL || 'http://localhost:4000'}/pages/register.html?ref=${user?.referral_code || ''}`, rows });
  });

  router.get('/chat', async (req, res) => {
    const room = req.query.room || `donor-${donorId(req)}`;
    const [rows] = await pool.query('SELECT * FROM chats WHERE room = ? ORDER BY created_at ASC LIMIT 100', [room]);
    res.json({ rows, room });
  });

  router.post('/chat', async (req, res) => {
    const room = req.body.room || `donor-${donorId(req)}`;
    if (!req.body.message) return res.status(400).json({ message: 'Message is required' });
    await pool.query('INSERT INTO chats (room,user_id,message) VALUES (?,?,?)', [room, donorId(req), req.body.message]);
    io?.to(room).emit('chat-message', { room, user_id: donorId(req), message: req.body.message, created_at: new Date().toISOString() });
    res.status(201).json({ message: 'Message sent' });
  });

  router.get('/notifications', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [donorId(req)]);
    res.json({ rows });
  });

  router.patch('/notifications/:id', async (req, res) => {
    await pool.query('UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND user_id = ?', [req.params.id, donorId(req)]);
    res.json({ message: 'Notification marked read' });
  });

  router.delete('/notifications/:id', async (req, res) => {
    await pool.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, donorId(req)]);
    res.json({ message: 'Notification deleted' });
  });

  router.get('/settings', async (req, res) => {
    const [[settings]] = await pool.query('SELECT * FROM donor_settings WHERE donor_id = ?', [donorId(req)]);
    res.json({ settings: settings || {} });
  });

  router.put('/settings', async (req, res) => {
    await upsert('donor_settings', 'donor_id', donorId(req), pick(req.body, ['email_notifications', 'sms_notifications', 'whatsapp_notifications', 'emergency_alerts', 'dark_mode', 'language']));
    res.json({ message: 'Settings updated' });
  });

  return router;
};

function donorId(req) {
  return req.user.role === 'admin' && req.query.user_id ? Number(req.query.user_id) : req.user.id;
}

function pick(source, keys) {
  return keys.reduce((out, key) => {
    if (source[key] !== undefined && source[key] !== '') out[key] = source[key];
    return out;
  }, {});
}

async function patchUser(userId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  await pool.query(`UPDATE users SET ${keys.map((key) => `${key}=?`).join(',')} WHERE id = ?`, [...keys.map((key) => fields[key]), userId]);
}

async function upsertDonorProfile(userId, fields) {
  if (!Object.keys(fields).length) return;
  await upsert('donor_profiles', 'user_id', userId, fields);
}

async function upsert(table, ownerColumn, ownerId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  await pool.query(
    `INSERT INTO ${table} (${[ownerColumn, ...keys].join(',')}) VALUES (${[ownerColumn, ...keys].map(() => '?').join(',')}) ON DUPLICATE KEY UPDATE ${keys.map((key) => `${key}=VALUES(${key})`).join(',')}`,
    [ownerId, ...keys.map((key) => fields[key])]
  );
}

function eligibility(profile = {}) {
  if (!profile) return 'review';
  if (profile.next_eligible_date && new Date(profile.next_eligible_date) > new Date()) return 'not_eligible';
  if (Number(profile.hemoglobin || 0) && Number(profile.hemoglobin) < 12.5) return 'review';
  if (profile.availability === 'unavailable') return 'not_eligible';
  return 'eligible';
}

async function ensureDonorTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS donor_settings (
    donor_id INT PRIMARY KEY,
    email_notifications TINYINT(1) DEFAULT 1,
    sms_notifications TINYINT(1) DEFAULT 1,
    whatsapp_notifications TINYINT(1) DEFAULT 1,
    emergency_alerts TINYINT(1) DEFAULT 1,
    dark_mode TINYINT(1) DEFAULT 0,
    language VARCHAR(12) DEFAULT 'en',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
}
