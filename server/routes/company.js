const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();
const operationalRoles = ['patient', 'blood_bank', 'ngo', 'volunteer', 'camp_organizer', 'hospital', 'admin', 'super_admin'];

const companyPlans = {
  basic: { name: 'Basic', amount: 49900, users: 3, features: ['Donor search', 'Requests', 'Email alerts'] },
  pro: { name: 'Pro', amount: 199900, users: 15, features: ['Smart matching', 'Live tracking', 'Analytics', 'Priority alerts'] },
  enterprise: { name: 'Enterprise', amount: 499900, users: 100, features: ['Multi-branch', 'AI prediction', 'Audit logs', 'Dedicated support'] }
};

router.get('/architecture', (req, res) => {
  res.json({
    product: 'LifeLink',
    company: 'LifeLink',
    assistant: 'Nexa Assistant',
    roles: ['admin', 'donor', 'hospital', 'blood_bank', 'patient', 'camp_organizer', 'super_admin'],
    modules: ['authentication', 'emergency_requests', 'donor_matching', 'inventory', 'subscriptions', 'payments', 'notifications', 'maps', 'analytics', 'ai']
  });
});

router.get('/plans', (req, res) => res.json({ plans: companyPlans }));

router.get('/control-center', auth(['admin', 'super_admin']), async (req, res) => {
  const [[users]] = await pool.query('SELECT COUNT(*) total FROM users');
  const [[revenue]] = await pool.query('SELECT COALESCE(SUM(amount_paise),0) total FROM subscriptions WHERE status = "active"');
  const [[emergency]] = await pool.query('SELECT COUNT(*) total FROM emergency_requests WHERE status IN ("pending","approved","broadcasted")');
  const [[feedback]] = await pool.query('SELECT COUNT(*) total FROM feedback WHERE status = "new"');
  const [roles] = await pool.query('SELECT role, COUNT(*) total FROM users GROUP BY role ORDER BY total DESC');
  const [inventory] = await pool.query('SELECT blood_group, SUM(units) units FROM blood_inventory GROUP BY blood_group ORDER BY blood_group');
  res.json({ stats: { users: users.total, revenuePaise: revenue.total, emergency: emergency.total, feedback: feedback.total }, roles, inventory });
});

router.get('/role-dashboard', auth(operationalRoles), async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  const [[user]] = await pool.query('SELECT id,name,email,mobile,role,blood_group,city,address,latitude,longitude,is_verified,referral_code FROM users WHERE id = ?', [userId]);
  const [[requests]] = await pool.query('SELECT COUNT(*) total, SUM(status = "open") open_count FROM blood_requests');
  const [[emergencies]] = await pool.query('SELECT COUNT(*) total, SUM(status IN ("pending","approved","broadcasted")) active_count FROM emergency_requests');
  const [[donors]] = await pool.query('SELECT COUNT(*) total FROM users WHERE role = "donor" AND is_verified = 1');
  const [[stock]] = await pool.query('SELECT COALESCE(SUM(units),0) units FROM blood_inventory');
  const [[appointments]] = await pool.query('SELECT COUNT(*) total FROM appointments WHERE donor_id = ? OR organizer_id = ?', [userId, userId]);
  const [[notifications]] = await pool.query('SELECT COUNT(*) total FROM notifications WHERE user_id = ? AND read_at IS NULL', [userId]);
  const [openRequests] = await pool.query('SELECT * FROM blood_requests ORDER BY FIELD(urgency,"critical","urgent","normal"), created_at DESC LIMIT 20');
  const [emergencyRows] = await pool.query('SELECT * FROM emergency_requests ORDER BY priority_score DESC, created_at DESC LIMIT 20');
  const [inventory] = await pool.query('SELECT blood_group, SUM(units) units, MIN(expires_on) nearest_expiry FROM blood_inventory GROUP BY blood_group ORDER BY blood_group');
  const [camps] = await pool.query(`
    SELECT bc.*, COALESCE(co.organization_name, u.name) organizer_name
    FROM blood_camps bc
    LEFT JOIN camp_organizers co ON co.id = bc.organizer_id
    LEFT JOIN users u ON u.id = co.user_id
    ORDER BY bc.camp_date DESC LIMIT 20
  `);
  const [campaigns] = await pool.query('SELECT c.*, u.name ngo_name FROM campaigns c JOIN users u ON u.id = c.ngo_id ORDER BY c.campaign_date DESC LIMIT 20');
  const [alerts] = await pool.query('SELECT id,title,message,type,read_at,created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [userId]);
  const [eligibleDonors] = await pool.query(`
    SELECT u.id,u.name,u.mobile,u.email,u.blood_group,u.city,dp.next_eligible_date,dp.hemoglobin,COALESCE(dp.availability,'available') availability
    FROM users u LEFT JOIN donor_profiles dp ON dp.user_id = u.id
    WHERE u.role='donor' AND u.is_verified=1
    ORDER BY CASE WHEN u.city = ? THEN 0 ELSE 1 END, u.name
    LIMIT 20
  `, [user?.city || '']);
  res.json({
    user,
    role,
    stats: {
      bloodRequests: requests.total || 0,
      openBloodRequests: requests.open_count || 0,
      emergencyRequests: emergencies.total || 0,
      activeEmergencies: emergencies.active_count || 0,
      verifiedDonors: donors.total || 0,
      bloodUnits: stock.units || 0,
      appointments: appointments.total || 0,
      unreadNotifications: notifications.total || 0
    },
    openRequests,
    emergencies: emergencyRows,
    inventory,
    camps,
    campaigns,
    notifications: alerts,
    eligibleDonors,
    actions: actionsFor(role)
  });
});

router.post('/emergency-requests', auth(['patient', 'hospital', 'blood_bank', 'admin', 'super_admin']), async (req, res) => {
  const { patient_name, blood_group, units_needed = 1, hospital_name, city, contact_mobile, needed_by, symptoms = '' } = req.body;
  if (!patient_name || !blood_group || !city) return res.status(400).json({ message: 'Patient name, blood group and city are required' });

  const urgentWords = ['accident', 'surgery', 'critical', 'icu', 'bleeding', 'child'];
  const priorityBoost = urgentWords.some((word) => symptoms.toLowerCase().includes(word)) ? 30 : 0;
  const priorityScore = Math.min(100, 50 + priorityBoost + Number(units_needed) * 5);

  const [result] = await pool.query(
    `INSERT INTO emergency_requests (requester_id,patient_name,blood_group,units_needed,hospital_name,city,priority_score,status,contact_mobile,needed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, "approved", ?, ?)`,
    [req.user.id, patient_name, blood_group, units_needed, hospital_name || null, city, priorityScore, contact_mobile || null, needed_by || null]
  );

  await pool.query(
    'INSERT INTO notifications (user_id,title,message,type) SELECT id,?,?,? FROM users WHERE role = "donor" AND blood_group = ? AND city = ?',
    ['Emergency blood request', `${blood_group} needed in ${city}. Please respond if available.`, 'danger', blood_group, city]
  );

  res.status(201).json({ message: 'Emergency request approved and broadcasted', id: result.insertId, priorityScore });
});

router.patch('/emergency-requests/:id/status', auth(['hospital', 'blood_bank', 'admin', 'super_admin']), async (req, res) => {
  const allowed = ['pending', 'approved', 'broadcasted', 'fulfilled', 'rejected'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Invalid emergency status' });
  await pool.query('UPDATE emergency_requests SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  res.json({ message: 'Emergency request status updated' });
});

router.get('/emergency-requests', auth(), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM emergency_requests ORDER BY priority_score DESC, created_at DESC LIMIT 100');
  res.json({ requests: rows });
});

router.get('/blood-banks/inventory-risk', auth(['blood_bank', 'hospital', 'admin', 'super_admin']), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT blood_group, SUM(units) units, MIN(expires_on) nearest_expiry,
      CASE
        WHEN SUM(units) < 5 THEN 'shortage'
        WHEN MIN(expires_on) <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'expiry_risk'
        ELSE 'stable'
      END AS risk
    FROM blood_inventory
    GROUP BY blood_group
    ORDER BY FIELD(risk, 'shortage', 'expiry_risk', 'stable'), blood_group
  `);
  res.json({ risks: rows });
});

router.post('/blood-camps', auth(['camp_organizer', 'ngo', 'admin', 'super_admin']), async (req, res) => {
  const { title, venue, city, camp_date, target_donors = 50 } = req.body;
  if (!title || !camp_date) return res.status(400).json({ message: 'Camp title and date are required' });
  const organizerId = await resolveCampOrganizerId(req.user.id);
  await pool.query(
    'INSERT INTO blood_camps (organizer_id,title,venue,city,camp_date,target_donors) VALUES (?, ?, ?, ?, ?, ?)',
    [organizerId, title, venue || null, city || null, camp_date, target_donors]
  );
  res.status(201).json({ message: 'Blood camp created' });
});

router.patch('/blood-camps/:id/status', auth(['camp_organizer', 'ngo', 'admin', 'super_admin']), async (req, res) => {
  const status = req.body.status === 'active' ? 'live' : req.body.status;
  const allowed = ['planned', 'live', 'completed', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid camp status' });
  const organizerId = ['admin', 'super_admin'].includes(req.user.role) ? null : await resolveCampOrganizerId(req.user.id);
  await pool.query(
    `UPDATE blood_camps SET status = ? WHERE id = ? AND (? IN ("admin","super_admin") OR organizer_id = ?)`,
    [status, req.params.id, req.user.role, organizerId]
  );
  res.json({ message: 'Camp status updated' });
});

router.get('/blood-camps', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT bc.*, COALESCE(co.organization_name, u.name) organizer_name
    FROM blood_camps bc
    LEFT JOIN camp_organizers co ON co.id = bc.organizer_id
    LEFT JOIN users u ON u.id = co.user_id
    ORDER BY camp_date DESC LIMIT 100
  `);
  res.json({ camps: rows });
});

router.get('/leaderboard', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT u.name,u.city,u.blood_group,COALESCE(SUM(r.points),0) points,
      CASE
        WHEN COALESCE(SUM(r.points),0) >= 2500 THEN 'Gold'
        WHEN COALESCE(SUM(r.points),0) >= 1000 THEN 'Silver'
        ELSE 'Bronze'
      END badge
    FROM users u
    LEFT JOIN rewards r ON r.user_id = u.id
    WHERE u.role = 'donor'
    GROUP BY u.id,u.name,u.city,u.blood_group
    ORDER BY points DESC
    LIMIT 25
  `);
  res.json({ leaderboard: rows });
});

router.get('/ai/predictions', auth(['hospital', 'blood_bank', 'admin', 'super_admin']), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT br.blood_group,
      SUM(CASE WHEN br.urgency = 'critical' THEN br.units_needed * 3 WHEN br.urgency = 'urgent' THEN br.units_needed * 2 ELSE br.units_needed END) demand,
      COALESCE(inv.units,0) supply
    FROM blood_requests br
    LEFT JOIN (SELECT blood_group, SUM(units) units FROM blood_inventory GROUP BY blood_group) inv ON inv.blood_group = br.blood_group
    WHERE br.status = 'open'
    GROUP BY br.blood_group, inv.units
    ORDER BY demand DESC
  `);
  res.json({
    predictions: rows.map((row) => ({
      ...row,
      shortageRisk: Number(row.demand) > Number(row.supply) ? 'high' : 'normal',
      recommendation: Number(row.demand) > Number(row.supply) ? 'Launch donor alert and source from partner blood banks' : 'Maintain stock and monitor expiry'
    }))
  });
});

router.get('/notifications', auth(operationalRoles), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [req.user.id]);
  res.json({ notifications: rows });
});

router.patch('/notifications/:id/read', auth(operationalRoles), async (req, res) => {
  await pool.query('UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ message: 'Notification marked as read' });
});

function actionsFor(role) {
  const shared = ['view_emergency_requests', 'view_notifications', 'chat_support'];
  const map = {
    patient: ['create_emergency_request', 'track_request', 'find_nearby_hospital'],
    blood_bank: ['manage_inventory', 'expiry_tracking', 'fulfill_requests', 'ai_shortage_prediction'],
    ngo: ['create_campaign', 'find_donors', 'create_community_request', 'manage_camps'],
    volunteer: ['view_response_board', 'support_camps', 'donor_outreach'],
    camp_organizer: ['create_blood_camp', 'manage_registrations', 'attendance_tracking'],
    hospital: ['search_donors', 'manage_requests', 'manage_inventory'],
    admin: ['platform_control'],
    super_admin: ['platform_control']
  };
  return [...shared, ...(map[role] || [])];
}

async function resolveCampOrganizerId(userId) {
  const [[existing]] = await pool.query('SELECT id FROM camp_organizers WHERE user_id = ?', [userId]);
  if (existing) return existing.id;
  const [[user]] = await pool.query('SELECT name,mobile FROM users WHERE id = ?', [userId]);
  const [result] = await pool.query(
    'INSERT INTO camp_organizers (user_id,organization_name,contact_number,verification_status,premium_enabled) VALUES (?, ?, ?, "pending", 0)',
    [userId, user?.name || 'LifeLink Camp Organizer', user?.mobile || null]
  );
  return result.insertId;
}

module.exports = router;
