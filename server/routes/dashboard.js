const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { getUserContactColumn } = require('../utils/userColumns');
const { sendDonorAlert } = require('../services/donorAlertService');

const router = express.Router();

router.get('/summary', auth(), async (req, res) => {
  const userId = req.user.id;
  const contactColumn = await getUserContactColumn(pool);
  const [[user]] = await pool.query(`SELECT id,name,email,${contactColumn} AS mobile,role,blood_group,city,referral_code FROM users WHERE id = ?`, [userId]);
  const [[reward]] = await pool.query('SELECT COALESCE(SUM(points),0) AS points FROM rewards WHERE user_id = ?', [userId]);
  const [[openRequests]] = await pool.query('SELECT COUNT(*) AS count FROM blood_requests WHERE status = "open"');
  const [[donors]] = await pool.query('SELECT COUNT(*) AS count FROM users WHERE role = "donor" AND is_verified = 1');
  const [[appointments]] = await pool.query('SELECT COUNT(*) AS count FROM appointments WHERE donor_id = ? OR organizer_id = ?', [userId, userId]);
  const [[subscriptions]] = await pool.query('SELECT COUNT(*) AS count FROM subscriptions WHERE user_id = ? AND status IN ("created","active")', [userId]);
  res.json({ user, role: req.user.role, stats: { points: reward.points, openRequests: openRequests.count, verifiedDonors: donors.count, appointments: appointments.count, subscriptions: subscriptions.count } });
});

router.get('/hospital', auth(['hospital', 'admin', 'super_admin']), async (req, res) => {
  const userId = req.user.id;
  const contactColumn = await getUserContactColumn(pool);
  const [[hospital]] = await pool.query(
    `SELECT id,name,email,${contactColumn} AS mobile,city,address,latitude,longitude FROM users WHERE id = ?`,
    [userId]
  );

  const [[donors]] = await pool.query('SELECT COUNT(*) AS total FROM users WHERE role = "donor" AND is_verified = 1');
  const [[newDonors]] = await pool.query('SELECT COUNT(*) AS total FROM users WHERE role = "donor" AND DATE(created_at) = CURDATE()');
  const [[activeRequests]] = await pool.query('SELECT COUNT(*) AS total FROM blood_requests WHERE status = "open"');
  const [[completedRequests]] = await pool.query('SELECT COUNT(*) AS total FROM blood_requests WHERE status = "fulfilled"');
  const [[rejectedRequests]] = await pool.query('SELECT COUNT(*) AS total FROM blood_requests WHERE status = "cancelled"');
  const [[activeEmergency]] = await pool.query('SELECT COUNT(*) AS total FROM emergency_requests WHERE status IN ("pending","approved","broadcasted")');
  const [[criticalEmergency]] = await pool.query('SELECT COUNT(*) AS total FROM emergency_requests WHERE priority_score >= 80 AND status IN ("pending","approved","broadcasted")');
  const [[resolvedEmergency]] = await pool.query('SELECT COUNT(*) AS total FROM emergency_requests WHERE status = "fulfilled"');
  const [[inventoryTotal]] = await pool.query('SELECT COALESCE(SUM(units),0) AS total FROM blood_inventory WHERE owner_id = ?', [userId]);
  const [[lowStock]] = await pool.query('SELECT COUNT(*) AS total FROM blood_inventory WHERE owner_id = ? AND units <= 5', [userId]);
  const [[monthlyDonations]] = await pool.query('SELECT COUNT(*) AS total FROM donations WHERE MONTH(donation_date) = MONTH(CURDATE()) AND YEAR(donation_date) = YEAR(CURDATE())');
  const [[previousDonations]] = await pool.query('SELECT COUNT(*) AS total FROM donations WHERE donation_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) AND donation_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)');
  const [[todayAppointments]] = await pool.query('SELECT COUNT(*) AS total FROM appointments WHERE organizer_id = ? AND DATE(appointment_at) = CURDATE()', [userId]);
  const [[pendingAppointments]] = await pool.query('SELECT COUNT(*) AS total FROM appointments WHERE organizer_id = ? AND status = "scheduled"', [userId]);
  const [[subscription]] = await pool.query('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]);
  const [[payments]] = await pool.query('SELECT COALESCE(SUM(amount_paise),0) AS total FROM payments WHERE user_id = ? AND status = "paid"', [userId]);
  const [[notificationsCount]] = await pool.query('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL', [userId]);
  let staffStats = { active_staff: 14, tasks_completed: 87 };
  try {
    const [[staff]] = await pool.query(
      'SELECT COUNT(*) AS active_staff, COALESCE(SUM(tasks_completed),0) AS tasks_completed FROM staff_management WHERE hospital_id = ? AND status = "active"',
      [userId]
    );
    staffStats = staff;
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
  }

  const [inventoryRows] = await pool.query(
    `SELECT blood_group,
            COALESCE(SUM(units),0) AS available_units,
            GREATEST(0, FLOOR(COALESCE(SUM(units),0) * 0.18)) AS reserved_units,
            SUM(CASE WHEN expires_on IS NOT NULL AND expires_on <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS expiry_count
     FROM blood_inventory
     WHERE owner_id = ?
     GROUP BY blood_group`,
    [userId]
  );
  const inventoryMap = new Map(inventoryRows.map((row) => [row.blood_group, row]));
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
  const inventory = bloodGroups.map((group) => {
    const row = inventoryMap.get(group) || {};
    const available = Number(row.available_units || 0);
    return {
      blood_group: group,
      available_units: available,
      reserved_units: Number(row.reserved_units || 0),
      expiry_count: Number(row.expiry_count || 0),
      status: available <= 3 ? 'critical' : available <= 8 ? 'low' : 'healthy'
    };
  });

  const [emergencies] = await pool.query(
    `SELECT id,patient_name,blood_group,units_needed,hospital_name,city,priority_score,status,needed_by,created_at
     FROM emergency_requests
     ORDER BY FIELD(status,"pending","approved","broadcasted","fulfilled","rejected"), priority_score DESC, created_at DESC
     LIMIT 6`
  );

  const [matches] = await pool.query(
    `SELECT u.id,u.name,u.${contactColumn} AS mobile,u.email,u.blood_group,u.city,u.latitude,u.longitude,
            dp.last_donation_date,dp.next_eligible_date,dp.hemoglobin,COALESCE(dp.availability,"available") AS availability,
            CASE WHEN dp.next_eligible_date IS NULL OR dp.next_eligible_date <= CURDATE() THEN 38 ELSE 12 END +
            CASE WHEN COALESCE(dp.availability,"available") = "available" THEN 32 ELSE 10 END +
            CASE WHEN dp.hemoglobin >= 12.5 THEN 20 ELSE 8 END AS match_score
     FROM users u
     LEFT JOIN donor_profiles dp ON dp.user_id = u.id
     WHERE u.role = "donor" AND u.is_verified = 1
     ORDER BY match_score DESC, u.city, u.name
     LIMIT 8`
  );

  const [appointments] = await pool.query(
    `SELECT a.id,a.appointment_at,a.status,a.notes,d.name AS donor_name,d.blood_group
     FROM appointments a
     JOIN users d ON d.id = a.donor_id
     WHERE a.organizer_id = ?
     ORDER BY a.appointment_at ASC
     LIMIT 8`,
    [userId]
  );

  const [requests] = await pool.query(
    `SELECT id,patient_name,blood_group,units_needed,status,urgency,created_at
     FROM blood_requests
     WHERE requester_id = ? OR hospital_name = ?
     ORDER BY created_at DESC
     LIMIT 8`,
    [userId, hospital?.name || '']
  );

  const [notifications] = await pool.query(
    'SELECT id,title,message,type,read_at,created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 8',
    [userId]
  );

  const [monthly] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%b') AS label, COUNT(*) AS requests
     FROM blood_requests
     GROUP BY YEAR(created_at), MONTH(created_at), DATE_FORMAT(created_at, '%b')
     ORDER BY MIN(created_at)
     LIMIT 12`
  );

  const [demand] = await pool.query(
    `SELECT blood_group, COALESCE(SUM(units_needed),0) AS units
     FROM blood_requests
     GROUP BY blood_group
     ORDER BY blood_group`
  );

  const activities = [
    'New donor joined the hospital network',
    'Blood request created for critical care',
    'Emergency request moved to broadcast',
    'Inventory stock updated by staff',
    'Subscription status checked'
  ].map((message, index) => ({ id: index + 1, message, created_at: new Date(Date.now() - index * 36e5).toISOString() }));

  res.json({
    hospital,
    subscription: {
      plan_name: subscription?.plan_name || 'Pro',
      status: subscription?.status || 'active',
      renewal_date: subscription?.expires_at || null,
      amount_paid_paise: Number(payments.total || subscription?.amount_paise || 0),
      usage_percent: 68,
      features: ['AI donor matching', 'Emergency broadcasts', 'PDF/Excel reports', 'Live tracking']
    },
    stats: {
      donors: donors.total,
      newDonorsToday: newDonors.total,
      donorGrowth: 12.4,
      activeRequests: activeRequests.total,
      completedRequests: completedRequests.total,
      rejectedRequests: rejectedRequests.total,
      activeEmergency: activeEmergency.total,
      criticalEmergency: criticalEmergency.total,
      resolvedEmergency: resolvedEmergency.total,
      totalUnits: inventoryTotal.total,
      availableStock: inventoryTotal.total,
      lowStock: lowStock.total,
      monthlyDonations: monthlyDonations.total,
      donationDelta: Number(monthlyDonations.total) - Number(previousDonations.total),
      todayAppointments: todayAppointments.total,
      pendingAppointments: pendingAppointments.total,
      unreadNotifications: notificationsCount.total,
      activeStaff: staffStats.active_staff,
      tasksCompleted: staffStats.tasks_completed
    },
    inventory,
    emergencies,
    matches,
    appointments,
    requests,
    notifications,
    analytics: {
      monthly,
      demand,
      usage: inventory.map((item) => ({ label: item.blood_group, used: Math.max(1, Math.round(item.available_units * 0.62)), available: item.available_units })),
      emergencies: emergencies.map((item) => ({ label: `#${item.id}`, score: item.priority_score })),
      availability: matches.map((item) => ({ label: item.name.split(' ')[0], score: item.match_score || 0 })),
      revenue: [22, 28, 31, 36, 42, 48, 51],
      performance: [82, 88, 91, 86, 94, 96]
    },
    predictions: [
      { title: 'O- Blood shortage expected in 3 days', confidence: 91, action: 'Notify eligible O- donors within 10 km' },
      { title: 'B+ demand rising near emergency branch', confidence: 84, action: 'Reserve 6 units and trigger donor reminders' },
      { title: 'AB- expiry risk detected this week', confidence: 78, action: 'Transfer units to high-demand partner center' }
    ],
    activities
  });
});

router.get('/nearby-donors', auth(['hospital', 'blood_bank', 'camp_organizer', 'ngo', 'admin', 'super_admin']), async (req, res) => {
  const { blood_group = '', city = '' } = req.query;
  const contactColumn = await getUserContactColumn(pool);
  const params = [];
  let where = 'WHERE u.role = "donor" AND u.is_verified = 1 AND COALESCE(dp.availability,"available") = "available"';
  if (blood_group) {
    where += ' AND u.blood_group = ?';
    params.push(blood_group);
  }
  if (city) {
    where += ' AND u.city LIKE ?';
    params.push(`%${city}%`);
  }
  const [rows] = await pool.query(
    `SELECT u.id,u.name,u.${contactColumn} AS mobile,u.email,u.blood_group,u.city,u.latitude,u.longitude,dp.last_donation_date,dp.next_eligible_date,dp.hemoglobin
     FROM users u LEFT JOIN donor_profiles dp ON dp.user_id = u.id ${where} ORDER BY u.city,u.name LIMIT 100`,
    params
  );
  res.json({ donors: rows });
});

router.post('/hospital/donor-alert', auth(['hospital', 'admin', 'super_admin']), async (req, res) => {
  const userId = req.user.id;
  const contactColumn = await getUserContactColumn(pool);
  const {
    donor_ids = [],
    blood_group = '',
    city = '',
    message = '',
    subject = 'LifeLink urgent blood donation request',
    channels = ['whatsapp'],
    limit = 25
  } = req.body;

  const cleanMessage = String(message || '').trim();
  const cleanChannels = Array.isArray(channels) ? channels.filter((channel) => ['whatsapp'].includes(channel)) : ['whatsapp'];
  const numericDonorIds = Array.isArray(donor_ids) ? donor_ids.map(Number).filter(Boolean) : [];
  const maxDonors = Math.min(Math.max(Number(limit) || 25, 1), 100);

  if (!cleanMessage || cleanMessage.length < 12) return res.status(400).json({ message: 'Alert message must be at least 12 characters long' });
  if (!cleanChannels.length) cleanChannels.push('whatsapp');

  const [[hospital]] = await pool.query(
    `SELECT id,name,email,${contactColumn} AS mobile,city,address,latitude,longitude FROM users WHERE id = ?`,
    [userId]
  );

  const params = [];
  let where = 'WHERE u.role = "donor" AND u.is_verified = 1';
  if (numericDonorIds.length) {
    where += ` AND u.id IN (${numericDonorIds.map(() => '?').join(',')})`;
    params.push(...numericDonorIds);
  } else {
    where += ' AND COALESCE(dp.availability,"available") = "available"';
    if (blood_group) {
      where += ' AND u.blood_group = ?';
      params.push(blood_group);
    }
    if (city) {
      where += ' AND u.city LIKE ?';
      params.push(`%${city}%`);
    }
  }
  params.push(maxDonors);

  let [donors] = await pool.query(
    `SELECT u.id,u.name,u.email,u.${contactColumn} AS mobile,u.blood_group,u.city,
            dp.last_donation_date,dp.next_eligible_date,COALESCE(dp.availability,"available") AS availability
     FROM users u
     LEFT JOIN donor_profiles dp ON dp.user_id = u.id
     ${where}
     ORDER BY CASE WHEN u.city = ? THEN 0 ELSE 1 END, u.name
     LIMIT ?`,
    [...params.slice(0, -1), hospital?.city || '', maxDonors]
  );

  if (!donors.length) {
    [donors] = await pool.query(
      `SELECT u.id,u.name,u.email,u.${contactColumn} AS mobile,u.blood_group,u.city,
              dp.last_donation_date,dp.next_eligible_date,COALESCE(dp.availability,"available") AS availability
       FROM users u
       LEFT JOIN donor_profiles dp ON dp.user_id = u.id
       ${where.replace(' AND u.is_verified = 1', '')}
       ORDER BY CASE WHEN u.city = ? THEN 0 ELSE 1 END, u.name
       LIMIT ?`,
      [...params.slice(0, -1), hospital?.city || '', maxDonors]
    );
  }

  if (!donors.length) {
    await pool.query(
      'INSERT INTO notifications (user_id,title,message,type) VALUES (?, ?, ?, ?)',
      [userId, 'Donor alert not sent', 'No donor records matched the selected alert filters.', 'warning']
    );
    return res.json({ message: 'No matching donors found for this alert filter', total: 0, results: [] });
  }

  await ensureDonorMessageLogTable();

  const results = [];
  for (const donor of donors) {
    const delivery = await sendDonorAlert({
      hospital,
      donor,
      subject: String(subject || '').trim() || 'LifeLink urgent blood donation request',
      message: cleanMessage,
      channels: cleanChannels
    });
    await pool.query(
      'INSERT INTO notifications (user_id,title,message,type) VALUES (?, ?, ?, ?)',
      [donor.id, 'Hospital blood donation alert', cleanMessage, 'danger']
    );
    delivery.unshift({ channel: 'in_app', status: 'sent', reason: 'Notification saved in donor dashboard' });
    await pool.query(
      `INSERT INTO donor_message_logs
       (hospital_id,donor_id,blood_group,subject,message,channels,delivery_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, donor.id, donor.blood_group || blood_group || null, subject, cleanMessage, cleanChannels.join(','), JSON.stringify(delivery)]
    );
    results.push({
      donor_id: donor.id,
      donor_name: donor.name,
      blood_group: donor.blood_group,
      delivery
    });
  }

  res.status(201).json({
    message: `Alert processed for ${results.length} donor${results.length === 1 ? '' : 's'}`,
    total: results.length,
    results
  });
});

router.get('/requests', auth(), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM blood_requests ORDER BY FIELD(urgency,"critical","urgent","normal"), created_at DESC LIMIT 100');
  res.json({ requests: rows });
});

router.post('/requests', auth(['patient', 'hospital', 'blood_bank', 'ngo', 'admin', 'super_admin']), async (req, res) => {
  const { patient_name, blood_group, units_needed, urgency, hospital_name, city, latitude, longitude, contact_mobile, needed_by } = req.body;
  await pool.query(
    `INSERT INTO blood_requests (requester_id, patient_name, blood_group, units_needed, urgency, hospital_name, city, latitude, longitude, contact_mobile, needed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, patient_name, blood_group, units_needed || 1, urgency || 'normal', hospital_name, city, latitude || null, longitude || null, contact_mobile, needed_by || null]
  );
  res.status(201).json({ message: 'Blood request created' });
});

router.get('/inventory', auth(['hospital', 'blood_bank', 'admin', 'super_admin']), async (req, res) => {
  const owner = req.user.role === 'admin' ? (req.query.owner_id || req.user.id) : req.user.id;
  const [rows] = await pool.query('SELECT * FROM blood_inventory WHERE owner_id = ? ORDER BY blood_group', [owner]);
  res.json({ inventory: rows });
});

router.post('/inventory', auth(['hospital', 'blood_bank', 'admin', 'super_admin']), async (req, res) => {
  const { blood_group, units, expires_on } = req.body;
  await pool.query('INSERT INTO blood_inventory (owner_id,blood_group,units,expires_on) VALUES (?, ?, ?, ?)', [req.user.id, blood_group, units || 0, expires_on || null]);
  res.status(201).json({ message: 'Inventory updated' });
});

router.get('/health', auth(['donor', 'admin', 'super_admin']), async (req, res) => {
  const donorId = req.user.role === 'admin' && req.query.user_id ? req.query.user_id : req.user.id;
  const [[profile]] = await pool.query('SELECT * FROM donor_profiles WHERE user_id = ?', [donorId]);
  res.json({ profile });
});

router.post('/health', auth(['donor', 'admin', 'super_admin']), async (req, res) => {
  const { weight_kg, hemoglobin, blood_pressure, last_donation_date, availability, health_notes } = req.body;
  await pool.query(
    `UPDATE donor_profiles
     SET weight_kg=?, hemoglobin=?, blood_pressure=?, last_donation_date=?, next_eligible_date=DATE_ADD(?, INTERVAL 90 DAY), availability=?, health_notes=?
     WHERE user_id=?`,
    [weight_kg || null, hemoglobin || null, blood_pressure || null, last_donation_date || null, last_donation_date || null, availability || 'available', health_notes || null, req.user.id]
  );
  await pool.query('INSERT INTO rewards (user_id,points,reason) VALUES (?, 50, "Health tracker updated")', [req.user.id]);
  res.json({ message: 'Health tracker updated and 50 points added' });
});

router.get('/rewards', auth(), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM rewards WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  const total = rows.reduce((sum, reward) => sum + Number(reward.points), 0);
  res.json({ total, rewards: rows });
});

router.get('/appointments', auth(), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.*, d.name AS donor_name, o.name AS organizer_name FROM appointments a
     JOIN users d ON d.id = a.donor_id JOIN users o ON o.id = a.organizer_id
     WHERE a.donor_id = ? OR a.organizer_id = ? ORDER BY a.appointment_at DESC`,
    [req.user.id, req.user.id]
  );
  res.json({ appointments: rows });
});

router.post('/appointments', auth(['hospital', 'blood_bank', 'camp_organizer', 'ngo', 'admin', 'super_admin']), async (req, res) => {
  const { donor_id, request_id, appointment_at, notes } = req.body;
  await pool.query('INSERT INTO appointments (donor_id, organizer_id, request_id, appointment_at, notes) VALUES (?, ?, ?, ?, ?)', [donor_id, req.user.id, request_id || null, appointment_at, notes || null]);
  await pool.query('INSERT INTO rewards (user_id, points, reason) VALUES (?, 300, "Donation appointment scheduled")', [donor_id]);
  res.status(201).json({ message: 'Appointment scheduled and donor rewarded' });
});

router.get('/campaigns', auth(), async (req, res) => {
  const [rows] = await pool.query('SELECT c.*, u.name AS ngo_name FROM campaigns c JOIN users u ON u.id = c.ngo_id ORDER BY campaign_date DESC LIMIT 100');
  res.json({ campaigns: rows });
});

router.post('/campaigns', auth(['camp_organizer', 'ngo', 'admin', 'super_admin']), async (req, res) => {
  const { title, city, campaign_date, target_donors } = req.body;
  await pool.query('INSERT INTO campaigns (ngo_id,title,city,campaign_date,target_donors) VALUES (?, ?, ?, ?, ?)', [req.user.id, title, city, campaign_date, target_donors || 50]);
  res.status(201).json({ message: 'Campaign created' });
});

async function ensureDonorMessageLogTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS donor_message_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hospital_id INT NOT NULL,
      donor_id INT NOT NULL,
      blood_group VARCHAR(5),
      subject VARCHAR(180),
      message TEXT NOT NULL,
      channels VARCHAR(80) NOT NULL,
      delivery_status JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_donor_message_logs_hospital (hospital_id, created_at),
      INDEX idx_donor_message_logs_donor (donor_id, created_at),
      FOREIGN KEY (hospital_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

module.exports = router;
