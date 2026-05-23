const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { getUserContactColumn } = require('../utils/userColumns');

const router = express.Router();
const adminAuth = auth(['admin', 'super_admin']);

router.use(adminAuth);

router.use(async (req, res, next) => {
  try {
    await ensureAdminCompatibility();
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/overview', async (req, res) => {
  const contactColumn = await getUserContactColumn(pool);
  const [[totalUsers]] = await pool.query('SELECT COUNT(*) AS count FROM users');
  const [[bannedUsers]] = await pool.query('SELECT COUNT(*) AS count FROM users WHERE account_status = "banned"');
  const [[pendingUsers]] = await pool.query('SELECT COUNT(*) AS count FROM users WHERE is_verified = 0');
  const [[donors]] = await pool.query('SELECT COUNT(*) AS count FROM users WHERE role = "donor"');
  const [[hospitals]] = await pool.query('SELECT COUNT(*) AS count FROM users WHERE role = "hospital"');
  const [[bloodRequests]] = await pool.query('SELECT COUNT(*) AS count FROM blood_requests WHERE status IN ("open","pending","approved")');
  const [[emergencies]] = await pool.query('SELECT COUNT(*) AS count FROM emergency_requests WHERE status IN ("open","pending","approved")');
  const [[stock]] = await pool.query('SELECT COALESCE(SUM(units),0) AS units FROM blood_inventory');
  const [[revenue]] = await pool.query('SELECT COALESCE(SUM(amount_paise),0) / 100 AS amount FROM payments WHERE status IN ("paid","captured","success")');
  const [[subscriptions]] = await pool.query('SELECT COUNT(*) AS count FROM subscriptions WHERE status = "active"');
  const [[failedPayments]] = await pool.query('SELECT COUNT(*) AS count FROM payments WHERE status IN ("failed","refunded")');
  const [latestUsers] = await pool.query(`SELECT id,name,email,${contactColumn} AS mobile,role,city,is_verified,account_status,created_at FROM users ORDER BY created_at DESC LIMIT 8`);
  const [latestRequests] = await pool.query('SELECT id,patient_name,blood_group,units_needed,urgency,status,city,created_at FROM blood_requests ORDER BY created_at DESC LIMIT 8');
  const [inventory] = await pool.query('SELECT blood_group, COALESCE(SUM(units),0) AS units FROM blood_inventory GROUP BY blood_group ORDER BY blood_group');
  const [lowStock] = await pool.query(`
    SELECT blood_group, COALESCE(SUM(units),0) AS units
    FROM blood_inventory
    GROUP BY blood_group
    HAVING units <= 10
    ORDER BY units ASC
    LIMIT 8
  `);
  const [roleBreakdown] = await pool.query('SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY count DESC');
  const [requestStatus] = await pool.query('SELECT status, COUNT(*) AS count FROM blood_requests GROUP BY status ORDER BY count DESC');
  const [recentLogs] = await pool.query(`
    SELECT al.action, al.entity_type, al.entity_id, al.created_at, u.name AS admin_name
    FROM admin_logs al
    LEFT JOIN users u ON u.id = al.admin_id
    ORDER BY al.created_at DESC
    LIMIT 8
  `);
  const [monthly] = await pool.query(`
    SELECT DATE_FORMAT(created_at, "%b") AS label, COUNT(*) AS requests
    FROM blood_requests
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY YEAR(created_at), MONTH(created_at), DATE_FORMAT(created_at, "%b")
    ORDER BY YEAR(created_at), MONTH(created_at)
  `);
  res.json({
    stats: {
      users: totalUsers.count,
      pendingUsers: pendingUsers.count,
      bannedUsers: bannedUsers.count,
      donors: donors.count,
      hospitals: hospitals.count,
      activeRequests: bloodRequests.count,
      emergencies: emergencies.count,
      bloodUnits: stock.units,
      revenue: revenue.amount,
      activeSubscriptions: subscriptions.count,
      failedPayments: failedPayments.count
    },
    latestUsers,
    latestRequests,
    inventory,
    lowStock,
    roleBreakdown,
    requestStatus,
    recentLogs,
    systemHealth: {
      api: 'online',
      database: 'connected',
      payments: process.env.PAYMENT_PROVIDER || 'cashfree',
      maps: process.env.MAP_PROVIDER || 'leaflet'
    },
    monthly
  });
});

router.get('/users', async (req, res) => {
  const contactColumn = await getUserContactColumn(pool);
  const { where, values } = buildSearch(req.query, ['name', 'email', 'city', 'role', 'blood_group', 'account_status']);
  const [rows] = await pool.query(
    `SELECT id,name,email,${contactColumn} AS mobile,role,blood_group,city,is_verified,account_status,created_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, limit(req), offset(req)]
  );
  const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM users ${where}`, values);
  res.json({ rows, total: count.total });
});

router.get('/users/role/:role', async (req, res) => {
  const allowed = ['donor', 'patient', 'hospital', 'blood_bank', 'ngo', 'volunteer', 'camp_organizer'];
  if (!allowed.includes(req.params.role)) return res.status(400).json({ message: 'Unsupported role' });
  const contactColumn = await getUserContactColumn(pool);
  const { where, values } = buildSearch(req.query, ['name', 'email', 'city', 'blood_group', 'account_status'], 'role = ?', [req.params.role]);
  const [rows] = await pool.query(
    `SELECT id,name,email,${contactColumn} AS mobile,role,blood_group,city,address,is_verified,account_status,created_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, limit(req), offset(req)]
  );
  const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM users ${where}`, values);
  res.json({ rows, total: count.total });
});

router.patch('/users/:id', async (req, res) => {
  const payload = pick(req.body, ['name', 'email', 'mobile', 'city', 'address', 'blood_group', 'is_verified']);
  if (!Object.keys(payload).length) return res.status(400).json({ message: 'No user fields to update' });
  await updateById('users', req.params.id, payload);
  await logAdmin(req, 'Updated user', 'users', req.params.id);
  res.json({ message: 'User updated' });
});

router.patch('/users/:id/verify', async (req, res) => {
  await pool.query('UPDATE users SET is_verified = ? WHERE id = ?', [req.body.is_verified ? 1 : 0, req.params.id]);
  await logAdmin(req, req.body.is_verified ? 'Verified user' : 'Unverified user', 'users', req.params.id);
  res.json({ message: 'User verification updated' });
});

router.patch('/users/:id/status', async (req, res) => {
  const allowed = ['active', 'banned', 'deactivated'];
  const status = String(req.body.account_status || '').toLowerCase();
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Unsupported account status' });
  if (Number(req.params.id) === Number(req.user.id) && status !== 'active') {
    return res.status(400).json({ message: 'You cannot disable your own admin account' });
  }
  await pool.query('UPDATE users SET account_status = ? WHERE id = ?', [status, req.params.id]);
  await logAdmin(req, `Set user account status to ${status}`, 'users', req.params.id);
  res.json({ message: 'User account status updated' });
});

router.get('/blood-requests', async (req, res) => listTable(req, res, 'blood_requests', ['patient_name', 'blood_group', 'hospital_name', 'city', 'status']));
router.patch('/blood-requests/:id/status', async (req, res) => updateStatus(req, res, 'blood_requests'));
router.patch('/requests/:id/status', async (req, res) => updateStatus(req, res, 'blood_requests'));

router.get('/emergency-requests', async (req, res) => listTable(req, res, 'emergency_requests', ['patient_name', 'blood_group', 'hospital_name', 'city', 'status']));
router.patch('/emergency-requests/:id/status', async (req, res) => updateStatus(req, res, 'emergency_requests'));

router.get('/blood-inventory', async (req, res) => {
  const clauses = [];
  const values = [];
  if (req.query.q) {
    clauses.push('(bi.blood_group LIKE ? OR u.name LIKE ? OR u.city LIKE ?)');
    values.push(...Array(3).fill(`%${req.query.q}%`));
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await pool.query(`
    SELECT bi.*, u.name AS owner_name, u.role AS owner_role, u.city
    FROM blood_inventory bi
    LEFT JOIN users u ON u.id = bi.owner_id
    ${where}
    ORDER BY bi.expires_on ASC, bi.id DESC
    LIMIT ? OFFSET ?
  `, [...values, limit(req), offset(req)]);
  const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM blood_inventory bi LEFT JOIN users u ON u.id = bi.owner_id ${where}`, values);
  res.json({ rows, total: count.total });
});

router.patch('/blood-inventory/:id', async (req, res) => {
  await updateById('blood_inventory', req.params.id, pick(req.body, ['blood_group', 'units', 'expires_on']));
  await logAdmin(req, 'Updated blood inventory', 'blood_inventory', req.params.id);
  res.json({ message: 'Inventory updated' });
});

router.get('/payments', async (req, res) => listTable(req, res, 'payments', ['razorpay_order_id', 'razorpay_payment_id', 'cashfree_order_id', 'cashfree_payment_id', 'payment_provider', 'purpose', 'status']));
router.get('/transactions', async (req, res) => listTable(req, res, 'transactions', ['provider', 'provider_payment_id', 'status']));
router.get('/subscriptions', async (req, res) => listTable(req, res, 'subscriptions', ['plan_name', 'status', 'razorpay_order_id', 'razorpay_payment_id', 'cashfree_order_id', 'cashfree_payment_id', 'payment_provider']));
router.patch('/subscriptions/:id/status', async (req, res) => updateStatus(req, res, 'subscriptions'));
router.get('/campaigns', async (req, res) => listTable(req, res, 'campaigns', ['title', 'city', 'status']));

router.get('/complaints', async (req, res) => listJoinedUser(req, res, 'complaints', ['subject', 'message', 'priority', 'status']));
router.patch('/complaints/:id/status', async (req, res) => updateStatus(req, res, 'complaints'));

router.get('/feedback', async (req, res) => listJoinedUser(req, res, 'feedback', ['message', 'status']));
router.patch('/feedback/:id/status', async (req, res) => updateStatus(req, res, 'feedback'));

router.get('/notifications', async (req, res) => listJoinedUser(req, res, 'notifications', ['title', 'message', 'type']));
router.post('/notifications/broadcast', async (req, res) => {
  const { title, message, type = 'info', role = 'all' } = req.body;
  if (!title || !message) return res.status(400).json({ message: 'Title and message are required' });
  const values = role === 'all' ? [] : [role];
  const [users] = await pool.query(`SELECT id FROM users ${role === 'all' ? '' : 'WHERE role = ?'}`, values);
  if (!users.length) return res.status(404).json({ message: 'No users matched this broadcast' });
  await pool.query(
    'INSERT INTO notifications (user_id,title,message,type) VALUES ?',
    [users.map((user) => [user.id, title, message, type])]
  );
  await logAdmin(req, 'Broadcast notification', 'notifications', null);
  res.status(201).json({ message: `Notification sent to ${users.length} user(s)` });
});

router.delete('/notifications/:id', async (req, res) => {
  await pool.query('DELETE FROM notifications WHERE id = ?', [req.params.id]);
  await logAdmin(req, 'Deleted notification', 'notifications', req.params.id);
  res.json({ message: 'Notification deleted' });
});

router.get('/analytics', async (req, res) => {
  const [metrics] = await pool.query('SELECT metric_name, metric_value, dimension_key, dimension_value, created_at FROM analytics ORDER BY created_at DESC LIMIT 40');
  const [roles] = await pool.query('SELECT role, COUNT(*) AS count FROM users GROUP BY role');
  const [demand] = await pool.query('SELECT blood_group, COUNT(*) AS count FROM blood_requests GROUP BY blood_group');
  const [revenue] = await pool.query(`
    SELECT DATE_FORMAT(created_at, "%b") AS label, COALESCE(SUM(amount_paise),0) / 100 AS amount
    FROM payments
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY YEAR(created_at), MONTH(created_at), DATE_FORMAT(created_at, "%b")
    ORDER BY YEAR(created_at), MONTH(created_at)
  `);
  res.json({ rows: metrics, roles, demand, revenue, total: metrics.length });
});

router.get('/reports', async (req, res) => {
  const [[users]] = await pool.query('SELECT COUNT(*) AS total, SUM(role="donor") AS donors, SUM(role="hospital") AS hospitals FROM users');
  const [[requests]] = await pool.query('SELECT COUNT(*) AS total, SUM(status IN ("completed","fulfilled")) AS completed FROM blood_requests');
  const [[emergencies]] = await pool.query('SELECT COUNT(*) AS total, SUM(status IN ("resolved","completed")) AS resolved FROM emergency_requests');
  const [rows] = await pool.query('SELECT action, entity_type, entity_id, created_at FROM admin_logs ORDER BY created_at DESC LIMIT 20');
  res.json({ rows, total: rows.length, summary: { users, requests, emergencies } });
});

router.get('/chat', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT c.id,c.room,c.message,c.created_at,u.name AS sender_name,u.role AS sender_role
    FROM chats c LEFT JOIN users u ON u.id = c.user_id
    ORDER BY c.created_at DESC LIMIT ? OFFSET ?
  `, [limit(req), offset(req)]);
  const [[count]] = await pool.query('SELECT COUNT(*) AS total FROM chats');
  res.json({ rows, total: count.total });
});

router.get('/settings', async (req, res) => {
  const [[admin]] = await pool.query('SELECT id,name,email,role,is_verified,created_at FROM users WHERE id = ?', [req.user.id]);
  const [logs] = await pool.query('SELECT * FROM admin_logs WHERE admin_id = ? ORDER BY created_at DESC LIMIT 12', [req.user.id]);
  res.json({ settings: { admin, security: { twoFactor: true, sessionTimeout: 30, auditLogs: true }, logs }, rows: logs, total: logs.length });
});

router.post('/settings/audit-log', async (req, res) => {
  await logAdmin(req, req.body.action || 'Admin settings updated', 'settings', null);
  res.status(201).json({ message: 'Admin setting saved' });
});

async function listTable(req, res, table, columns) {
  const { where, values } = buildSearch(req.query, columns);
  const [rows] = await pool.query(`SELECT * FROM ${table} ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...values, limit(req), offset(req)]);
  const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM ${table} ${where}`, values);
  res.json({ rows, total: count.total });
}

async function listJoinedUser(req, res, table, columns) {
  const { where, values } = buildSearch(req.query, columns.map((column) => `t.${column}`));
  const [rows] = await pool.query(`
    SELECT t.*, u.name AS user_name, u.email AS user_email, u.role AS user_role
    FROM ${table} t
    LEFT JOIN users u ON u.id = t.user_id
    ${where}
    ORDER BY t.created_at DESC LIMIT ? OFFSET ?
  `, [...values, limit(req), offset(req)]);
  const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM ${table} t ${where}`, values);
  res.json({ rows, total: count.total });
}

async function updateStatus(req, res, table) {
  if (!req.body.status) return res.status(400).json({ message: 'Status is required' });
  await pool.query(`UPDATE ${table} SET status = ? WHERE id = ?`, [req.body.status, req.params.id]);
  await logAdmin(req, `Updated ${table} status`, table, req.params.id);
  res.json({ message: 'Status updated' });
}

async function ensureAdminCompatibility() {
  await addColumnIfMissing('users', 'account_status', "ENUM('active','banned','deactivated') DEFAULT 'active'");
}

async function addColumnIfMissing(table, column, definition) {
  const [[existing]] = await pool.query(
    'SELECT COUNT(*) AS count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  if (!existing.count) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function buildSearch(query, columns, fixed = '', fixedValues = []) {
  const clauses = fixed ? [fixed] : [];
  const values = [...fixedValues];
  if (query.status) {
    clauses.push('status = ?');
    values.push(query.status);
  }
  if (query.account_status && columns.includes('account_status')) {
    clauses.push('account_status = ?');
    values.push(query.account_status);
  }
  if (query.role && !fixed.includes('role')) {
    clauses.push('role = ?');
    values.push(query.role);
  }
  if (query.q) {
    clauses.push(`(${columns.map((column) => `${column} LIKE ?`).join(' OR ')})`);
    values.push(...columns.map(() => `%${query.q}%`));
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
}

function limit(req) {
  return Math.min(Number(req.query.limit || 12), 100);
}

function offset(req) {
  return Math.max(Number(req.query.offset || 0), 0);
}

function pick(source, keys) {
  return keys.reduce((payload, key) => {
    if (source[key] !== undefined) payload[key] = source[key];
    return payload;
  }, {});
}

async function updateById(table, id, payload) {
  const entries = Object.entries(payload);
  if (!entries.length) return;
  const sql = entries.map(([key]) => `${key} = ?`).join(', ');
  await pool.query(`UPDATE ${table} SET ${sql} WHERE id = ?`, [...entries.map(([, value]) => value), id]);
}

async function logAdmin(req, action, entityType, entityId) {
  await pool.query(
    'INSERT INTO admin_logs (admin_id,action,entity_type,entity_id,ip_address) VALUES (?,?,?,?,?)',
    [req.user.id, action, entityType, entityId, req.ip]
  ).catch(() => {});
}

module.exports = router;
