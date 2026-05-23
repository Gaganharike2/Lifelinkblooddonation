const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { getUserContactColumn } = require('../utils/userColumns');

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'health-reports');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9.]/gi, '-')}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = (io) => {
  const router = express.Router();

  router.get('/analytics', auth(), async (req, res) => {
    const [[users]] = await pool.query('SELECT COUNT(*) AS total FROM users');
    const [[requests]] = await pool.query('SELECT COUNT(*) AS total FROM blood_requests');
    const [[critical]] = await pool.query('SELECT COUNT(*) AS total FROM blood_requests WHERE urgency = "critical" AND status = "open"');
    const [inventory] = await pool.query('SELECT blood_group, SUM(units) AS units FROM blood_inventory GROUP BY blood_group ORDER BY blood_group');
    const [growth] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%b') AS label, COUNT(*) AS count
      FROM users
      GROUP BY YEAR(created_at), MONTH(created_at), DATE_FORMAT(created_at, '%b')
      ORDER BY MIN(created_at)
      LIMIT 12
    `);
    res.json({ stats: { users: users.total, requests: requests.total, critical: critical.total }, inventory, growth });
  });

  router.get('/match-donors', auth(['hospital', 'blood_bank', 'camp_organizer', 'ngo', 'admin', 'super_admin']), async (req, res) => {
    const { blood_group = '', city = '' } = req.query;
    const contactColumn = await getUserContactColumn(pool);
    const params = [];
    let where = 'WHERE u.role = "donor" AND u.is_verified = 1';
    if (blood_group) {
      where += ' AND u.blood_group = ?';
      params.push(blood_group);
    }
    if (city) {
      where += ' AND u.city LIKE ?';
      params.push(`%${city}%`);
    }
    const [donors] = await pool.query(`
      SELECT u.id,u.name,u.${contactColumn} AS mobile,u.email,u.blood_group,u.city,u.latitude,u.longitude,
             dp.hemoglobin,dp.next_eligible_date,dp.availability,
             CASE
               WHEN dp.availability = 'available' THEN 40 ELSE 10
             END +
             CASE
               WHEN dp.next_eligible_date IS NULL OR dp.next_eligible_date <= CURDATE() THEN 35 ELSE 5
             END +
             CASE
               WHEN dp.hemoglobin >= 12.5 THEN 25 ELSE 5
             END AS match_score
      FROM users u
      LEFT JOIN donor_profiles dp ON dp.user_id = u.id
      ${where}
      ORDER BY match_score DESC, u.city, u.name
      LIMIT 50
    `, params);
    res.json({ donors });
  });

  router.post('/ai/assistant', auth(), async (req, res) => {
    const text = String(req.body.message || '').toLowerCase();
    let answer = 'I can help with donation eligibility, emergency request priority, blood stock risk, rewards and health reminders.';
    if (text.includes('eligible') || text.includes('donate')) {
      answer = 'Donation is usually considered when weight is healthy, hemoglobin is adequate, and the last donation was at least 90 days ago. Use the health tracker for a LifeLink eligibility estimate.';
    } else if (text.includes('emergency') || text.includes('urgent')) {
      answer = 'For emergency cases, create a critical blood request, search nearby donors by blood group and city, then schedule appointments from the hospital or NGO dashboard.';
    } else if (text.includes('stock') || text.includes('forecast')) {
      answer = 'LifeLink forecasts demand from open requests, critical cases, expiry dates and inventory units. Low-stock and rare-group alerts should be reviewed daily.';
    }
    res.json({ answer, confidence: 0.92, model: 'LifeLink rule-based AI v1' });
  });

  router.get('/ai/forecast', auth(['hospital', 'blood_bank', 'camp_organizer', 'ngo', 'admin', 'super_admin']), async (req, res) => {
    const [rows] = await pool.query(`
      SELECT blood_group,
        SUM(CASE WHEN urgency = 'critical' THEN units_needed * 2 ELSE units_needed END) AS demand_score,
        COUNT(*) AS open_cases
      FROM blood_requests
      WHERE status = 'open'
      GROUP BY blood_group
      ORDER BY demand_score DESC
    `);
    res.json({ forecast: rows.map((row) => ({ ...row, risk: Number(row.demand_score) >= 5 ? 'high' : 'normal' })) });
  });

  router.post('/notifications/broadcast', auth(['admin', 'super_admin']), async (req, res) => {
    const { title, message, type = 'info' } = req.body;
    await pool.query('INSERT INTO notifications (user_id,title,message,type) SELECT id,?,?,? FROM users', [title, message, type]);
    io.emit('notification', { title, message, type, created_at: new Date().toISOString() });
    res.status(201).json({ message: 'Notification broadcast sent' });
  });

  router.get('/notifications', auth(), async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json({ notifications: rows });
  });

  router.get('/chats/:room', auth(), async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM chats WHERE room = ? ORDER BY created_at DESC LIMIT 50', [req.params.room]);
    res.json({ messages: rows.reverse() });
  });

  router.post('/chats/:room', auth(), async (req, res) => {
    const { message } = req.body;
    await pool.query('INSERT INTO chats (room,user_id,message) VALUES (?, ?, ?)', [req.params.room, req.user.id, message]);
    io.to(req.params.room).emit('chat-message', { room: req.params.room, user_id: req.user.id, message, created_at: new Date().toISOString() });
    res.status(201).json({ message: 'Message sent' });
  });

  router.post('/health-reports', auth(['donor', 'admin', 'super_admin']), upload.single('report'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Please upload a report file' });
    await pool.query('INSERT INTO health_reports (user_id,file_name,file_path,notes) VALUES (?, ?, ?, ?)', [req.user.id, req.file.originalname, req.file.filename, req.body.notes || null]);
    res.status(201).json({ message: 'Health report uploaded', file: req.file.filename });
  });

  return router;
};
