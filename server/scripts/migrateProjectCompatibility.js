require('dotenv').config();
const pool = require('../config/db');

const tableColumns = {
  users: {
    name: 'VARCHAR(120) NULL',
    mobile: 'VARCHAR(24) NULL',
    password_hash: 'VARCHAR(255) NULL',
    blood_group: 'VARCHAR(5) NULL',
    city: 'VARCHAR(100) NULL',
    address: 'VARCHAR(255) NULL',
    latitude: 'DECIMAL(10,7) NULL',
    longitude: 'DECIMAL(10,7) NULL',
    is_verified: 'TINYINT(1) NOT NULL DEFAULT 0',
    referral_code: 'VARCHAR(24) NULL',
    referred_by: 'INT NULL',
    updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
  },
  otp_codes: {
    channel: "ENUM('email','mobile') NOT NULL DEFAULT 'email'",
    code: 'VARCHAR(12) NULL',
    purpose: "ENUM('register','login','reset') NOT NULL DEFAULT 'register'",
    used_at: 'DATETIME NULL'
  },
  donor_profiles: {
    last_donation_date: 'DATE NULL',
    next_eligible_date: 'DATE NULL',
    weight_kg: 'DECIMAL(5,2) NULL',
    hemoglobin: 'DECIMAL(4,1) NULL',
    blood_pressure: 'VARCHAR(20) NULL',
    availability: "ENUM('available','busy','unavailable') DEFAULT 'available'",
    emergency_opt_in: 'TINYINT(1) DEFAULT 1',
    health_notes: 'TEXT NULL'
  },
  patients: {
    medical_condition: 'VARCHAR(180) NULL',
    preferred_hospital: 'VARCHAR(160) NULL',
    verification_status: "ENUM('pending','verified','rejected') DEFAULT 'pending'"
  },
  hospitals: {
    verification_status: "ENUM('pending','verified','rejected') DEFAULT 'pending'",
    emergency_capacity: 'INT DEFAULT 0'
  },
  blood_banks: {
    storage_capacity_units: 'INT DEFAULT 0',
    verification_status: "ENUM('pending','verified','rejected') DEFAULT 'pending'",
    rare_group_monitoring: 'TINYINT(1) DEFAULT 1'
  },
  camp_organizers: {
    verification_status: "ENUM('pending','verified','rejected') DEFAULT 'pending'",
    premium_enabled: 'TINYINT(1) DEFAULT 0'
  },
  ngos: {
    verification_status: "ENUM('pending','verified','rejected') DEFAULT 'pending'",
    focus_city: 'VARCHAR(100) NULL'
  },
  rewards: {
    user_id: 'INT NULL',
    reason: 'VARCHAR(180) NULL'
  },
  subscriptions: {
    amount_paise: 'INT NULL',
    razorpay_order_id: 'VARCHAR(120) NULL',
    razorpay_payment_id: 'VARCHAR(120) NULL',
    starts_at: 'DATETIME NULL',
    expires_at: 'DATETIME NULL',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  blood_inventory: {
    owner_id: 'INT NULL',
    units: 'INT NOT NULL DEFAULT 0',
    expires_on: 'DATE NULL'
  },
  blood_requests: {
    requester_id: 'INT NULL',
    patient_name: 'VARCHAR(120) NULL',
    units_needed: 'INT NOT NULL DEFAULT 1',
    hospital_name: 'VARCHAR(160) NULL',
    city: 'VARCHAR(100) NULL',
    latitude: 'DECIMAL(10,7) NULL',
    longitude: 'DECIMAL(10,7) NULL',
    contact_mobile: 'VARCHAR(24) NULL',
    needed_by: 'DATETIME NULL'
  },
  emergency_requests: {
    patient_name: 'VARCHAR(120) NULL',
    units_needed: 'INT NOT NULL DEFAULT 1',
    city: 'VARCHAR(100) NULL',
    priority_score: 'INT DEFAULT 50',
    contact_mobile: 'VARCHAR(24) NULL',
    needed_by: 'DATETIME NULL'
  },
  appointments: {
    organizer_id: 'INT NULL',
    request_id: 'INT NULL',
    appointment_at: 'DATETIME NULL',
    notes: 'TEXT NULL',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  campaigns: {
    ngo_id: 'INT NULL',
    city: 'VARCHAR(100) NULL',
    campaign_date: 'DATE NULL',
    target_donors: 'INT DEFAULT 50',
    registered_donors: 'INT DEFAULT 0',
    status: "ENUM('planned','live','completed','cancelled') DEFAULT 'planned'",
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  blood_camps: {
    title: 'VARCHAR(180) NULL',
    venue: 'VARCHAR(180) NULL',
    city: 'VARCHAR(100) NULL',
    target_donors: 'INT DEFAULT 50',
    registered_donors: 'INT DEFAULT 0',
    status: "ENUM('planned','live','completed','cancelled') DEFAULT 'planned'",
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  camp_registration: {
    qr_code: 'VARCHAR(120) NULL',
    attended_at: 'DATETIME NULL',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  transactions: {
    subscription_id: 'INT NULL',
    amount_paise: 'INT NULL',
    provider: "VARCHAR(40) DEFAULT 'razorpay'",
    provider_payment_id: 'VARCHAR(120) NULL',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  payments: {
    subscription_id: 'INT NULL',
    razorpay_order_id: 'VARCHAR(120) NULL',
    razorpay_payment_id: 'VARCHAR(120) NULL',
    amount_paise: 'INT NULL',
    purpose: "ENUM('subscription','donation','camp_premium') DEFAULT 'subscription'",
    status: "ENUM('created','paid','failed','refunded','pending','completed') DEFAULT 'created'"
  },
  payment_history: {
    event_name: 'VARCHAR(80) NULL',
    event_payload: 'JSON NULL'
  },
  notifications: {
    title: 'VARCHAR(180) NULL',
    type: "ENUM('info','success','warning','danger') DEFAULT 'info'",
    read_at: 'DATETIME NULL'
  },
  analytics: {
    metric_name: 'VARCHAR(100) NULL',
    metric_value: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
    dimension_key: 'VARCHAR(80) NULL',
    dimension_value: 'VARCHAR(120) NULL'
  },
  chats: {
    room: 'VARCHAR(80) NULL',
    user_id: 'INT NULL'
  },
  health_reports: {
    user_id: 'INT NULL',
    file_name: 'VARCHAR(180) NULL',
    file_path: 'VARCHAR(255) NULL',
    notes: 'TEXT NULL'
  },
  health_tracker: {
    weight_kg: 'DECIMAL(5,2) NULL',
    hemoglobin: 'DECIMAL(4,1) NULL',
    blood_pressure: 'VARCHAR(20) NULL',
    pulse_rate: 'INT NULL',
    eligibility_status: "ENUM('eligible','review','not_eligible') DEFAULT 'review'",
    recorded_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  medical_reports: {
    user_id: 'INT NULL',
    request_id: 'INT NULL',
    file_name: 'VARCHAR(180) NULL',
    file_path: 'VARCHAR(255) NULL'
  },
  blood_expiry: {
    inventory_id: 'INT NULL',
    alert_date: 'DATE NULL',
    status: "ENUM('open','resolved','discarded') DEFAULT 'open'",
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  donations: {
    appointment_id: 'INT NULL',
    blood_group: 'VARCHAR(5) NULL',
    units: 'INT DEFAULT 1',
    certificate_code: 'VARCHAR(80) NULL',
    verified_by: 'INT NULL',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  referrals: {
    reward_points: 'INT DEFAULT 250',
    status: "ENUM('pending','rewarded') DEFAULT 'rewarded'",
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  chat_system: {
    room: 'VARCHAR(80) NULL',
    sender_id: 'INT NULL',
    receiver_id: 'INT NULL',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  otp_verification: {
    channel: "ENUM('email','mobile') DEFAULT 'email'",
    otp_code: 'VARCHAR(12) NULL',
    purpose: "ENUM('register','login','reset') DEFAULT 'register'",
    expires_at: 'DATETIME NULL',
    verified_at: 'DATETIME NULL'
  },
  admin_logs: {
    entity_type: 'VARCHAR(80) NULL',
    entity_id: 'INT NULL',
    ip_address: 'VARCHAR(60) NULL'
  },
  feedback: {
    status: "ENUM('new','reviewed','closed') DEFAULT 'new'"
  },
  complaints: {
    subject: 'VARCHAR(160) NULL',
    message: 'TEXT NULL',
    priority: "ENUM('low','medium','high') DEFAULT 'medium'"
  }
};

const enumChanges = [
  "ALTER TABLE users MODIFY role ENUM('admin','donor','patient','hospital','blood_bank','ngo','volunteer','camp_organizer','super_admin') NOT NULL DEFAULT 'donor'",
  "ALTER TABLE blood_requests MODIFY status ENUM('pending','approved','completed','rejected','open','matched','fulfilled','cancelled') DEFAULT 'open'",
  "ALTER TABLE emergency_requests MODIFY status ENUM('pending','approved','broadcasted','fulfilled','rejected','completed') DEFAULT 'pending'",
  "ALTER TABLE appointments MODIFY status ENUM('pending','approved','cancelled','scheduled','completed') DEFAULT 'scheduled'",
  "ALTER TABLE campaigns MODIFY status ENUM('planned','live','completed','cancelled') DEFAULT 'planned'",
  "ALTER TABLE blood_camps MODIFY status ENUM('planned','live','completed','cancelled') DEFAULT 'planned'",
  "ALTER TABLE subscriptions MODIFY status ENUM('created','active','failed','cancelled','expired') DEFAULT 'created'",
  "ALTER TABLE payments MODIFY status ENUM('created','paid','failed','refunded','pending','completed') DEFAULT 'created'",
  "ALTER TABLE transactions MODIFY status ENUM('created','paid','failed','refunded','pending','completed') DEFAULT 'created'",
  "ALTER TABLE notifications MODIFY status ENUM('read','unread') DEFAULT 'unread'",
  "ALTER TABLE blood_expiry MODIFY status ENUM('open','resolved','discarded') DEFAULT 'open'",
  "ALTER TABLE complaints MODIFY status ENUM('open','investigating','resolved','closed','pending') DEFAULT 'open'"
];

const createTables = [
  `CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    subscription_id INT NULL,
    amount_paise INT NULL,
    provider VARCHAR(40) DEFAULT 'razorpay',
    provider_payment_id VARCHAR(120) NULL,
    status ENUM('created','paid','failed','refunded','pending','completed') DEFAULT 'created',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`
];

async function tableExists(table) {
  const [rows] = await pool.query('SHOW TABLES LIKE ?', [table]);
  return rows.length > 0;
}

async function getColumns(table) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM ${table}`);
  return new Set(rows.map((row) => row.Field));
}

async function addMissingColumns() {
  for (const [table, columns] of Object.entries(tableColumns)) {
    if (!(await tableExists(table))) continue;
    const existing = await getColumns(table);
    for (const [column, definition] of Object.entries(columns)) {
      if (existing.has(column)) continue;
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`Added ${table}.${column}`);
    }
  }
}

async function createMissingTables() {
  for (const sql of createTables) {
    await pool.query(sql);
  }
}

async function copyLegacyValues() {
  const users = await getColumns('users');
  if (users.has('full_name') && users.has('name')) await pool.query('UPDATE users SET name = COALESCE(name, full_name)');
  if (users.has('phone') && users.has('mobile')) await pool.query('UPDATE users SET mobile = COALESCE(mobile, phone)');
  if (users.has('password') && users.has('password_hash')) await pool.query('UPDATE users SET password_hash = COALESCE(password_hash, password)');
  if (users.has('status') && users.has('is_verified')) {
    await pool.query("UPDATE users SET is_verified = CASE WHEN LOWER(COALESCE(status,'')) IN ('active','verified','approved','1') THEN 1 ELSE is_verified END");
  }

  const otp = await getColumns('otp_codes');
  if (otp.has('otp_code') && otp.has('code')) await pool.query('UPDATE otp_codes SET code = COALESCE(code, otp_code)');

  const rewards = await getColumns('rewards');
  if (rewards.has('donor_id') && rewards.has('user_id')) await pool.query('UPDATE rewards SET user_id = COALESCE(user_id, donor_id)');
  if (rewards.has('reward_type') && rewards.has('reason')) await pool.query('UPDATE rewards SET reason = COALESCE(reason, reward_type)');

  const subs = await getColumns('subscriptions');
  if (subs.has('amount') && subs.has('amount_paise')) await pool.query('UPDATE subscriptions SET amount_paise = COALESCE(amount_paise, ROUND(amount * 100))');
  if (subs.has('start_date') && subs.has('starts_at')) await pool.query('UPDATE subscriptions SET starts_at = COALESCE(starts_at, start_date)');
  if (subs.has('end_date') && subs.has('expires_at')) await pool.query('UPDATE subscriptions SET expires_at = COALESCE(expires_at, end_date)');

  const inventory = await getColumns('blood_inventory');
  if (inventory.has('hospital_id') && inventory.has('owner_id')) await pool.query('UPDATE blood_inventory SET owner_id = COALESCE(owner_id, hospital_id)');
  if (inventory.has('units_available') && inventory.has('units')) await pool.query('UPDATE blood_inventory SET units = COALESCE(units, units_available)');

  const requests = await getColumns('blood_requests');
  if (requests.has('patient_id') && requests.has('requester_id')) await pool.query('UPDATE blood_requests SET requester_id = COALESCE(requester_id, patient_id)');
  if (requests.has('units_required') && requests.has('units_needed')) await pool.query('UPDATE blood_requests SET units_needed = COALESCE(units_needed, units_required)');

  const camps = await getColumns('blood_camps');
  if (camps.has('camp_name') && camps.has('title')) await pool.query('UPDATE blood_camps SET title = COALESCE(title, camp_name)');
  if (camps.has('location') && camps.has('venue')) await pool.query('UPDATE blood_camps SET venue = COALESCE(venue, location)');

  const healthReports = await getColumns('health_reports');
  if (healthReports.has('donor_id') && healthReports.has('user_id')) await pool.query('UPDATE health_reports SET user_id = COALESCE(user_id, donor_id)');

  const medicalReports = await getColumns('medical_reports');
  if (medicalReports.has('donor_id') && medicalReports.has('user_id')) await pool.query('UPDATE medical_reports SET user_id = COALESCE(user_id, donor_id)');
  if (medicalReports.has('report_file') && medicalReports.has('file_path')) await pool.query('UPDATE medical_reports SET file_path = COALESCE(file_path, report_file)');

  const donations = await getColumns('donations');
  if (donations.has('units_donated') && donations.has('units')) await pool.query('UPDATE donations SET units = COALESCE(units, units_donated)');

  const referrals = await getColumns('referrals');
  if (referrals.has('bonus_points') && referrals.has('reward_points')) await pool.query('UPDATE referrals SET reward_points = COALESCE(reward_points, bonus_points)');

  const paymentHistory = await getColumns('payment_history');
  if (paymentHistory.has('transaction_id') && paymentHistory.has('event_name')) await pool.query('UPDATE payment_history SET event_name = COALESCE(event_name, transaction_id)');

  const complaints = await getColumns('complaints');
  if (complaints.has('complaint') && complaints.has('message')) await pool.query('UPDATE complaints SET message = COALESCE(message, complaint)');
}

async function applyEnumChanges() {
  for (const sql of enumChanges) {
    try {
      await pool.query(sql);
    } catch (error) {
      console.warn(`Skipped enum change: ${error.sqlMessage || error.message}`);
    }
  }
}

async function main() {
  await createMissingTables();
  await applyEnumChanges();
  await addMissingColumns();
  await applyEnumChanges();
  await copyLegacyValues();
  console.log('LifeLink database compatibility migration complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
