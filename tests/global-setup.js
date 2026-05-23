const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const users = [
  ['LifeLink QA Admin', 'qa-admin@lifelink.local', '9100000000', 'AdminTest@123', 'admin', null, 'Delhi'],
  ['LifeLink QA Donor', 'qa-donor@lifelink.local', '9100000001', 'DonorTest@123', 'donor', 'O+', 'Delhi'],
  ['LifeLink QA Hospital', 'qa-hospital@lifelink.local', '9100000002', 'HospitalTest@123', 'hospital', null, 'Delhi'],
  ['LifeLink QA Blood Bank', 'qa-bloodbank@lifelink.local', '9100000003', 'BankTest@123', 'blood_bank', null, 'Delhi'],
  ['LifeLink QA NGO', 'qa-ngo@lifelink.local', '9100000004', 'NgoTest@123', 'ngo', null, 'Delhi'],
  ['LifeLink QA Patient', 'qa-patient@lifelink.local', '9100000005', 'PatientTest@123', 'patient', 'B+', 'Delhi']
];

function hash(password) {
  return `sha256:${crypto.createHash('sha256').update(password).digest('hex')}`;
}

async function globalSetup() {
  const db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'lifelink_blood',
    multipleStatements: true
  });

  for (const [name, email, mobile, password, role, bloodGroup, city] of users) {
    const passwordHash = hash(password);
    await db.execute(
      `INSERT INTO users (name,full_name,email,mobile,phone,password_hash,password,role,blood_group,city,address,latitude,longitude,is_verified,account_status,status,referral_code)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,'active','active',?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), full_name=VALUES(full_name), password_hash=VALUES(password_hash), password=VALUES(password), role=VALUES(role), blood_group=VALUES(blood_group), city=VALUES(city), is_verified=1, account_status='active', status='active'`,
      [name, name, email, mobile, mobile, passwordHash, passwordHash, role, bloodGroup, city, 'QA Test Address', 28.6139, 77.2090, `QA${mobile.slice(-4)}`]
    );
  }

  const [[donor]] = await db.execute('SELECT id FROM users WHERE email = ?', ['qa-donor@lifelink.local']);
  const [[hospital]] = await db.execute('SELECT id FROM users WHERE email = ?', ['qa-hospital@lifelink.local']);
  const [[bank]] = await db.execute('SELECT id FROM users WHERE email = ?', ['qa-bloodbank@lifelink.local']);
  const [[ngo]] = await db.execute('SELECT id FROM users WHERE email = ?', ['qa-ngo@lifelink.local']);
  const [[patient]] = await db.execute('SELECT id FROM users WHERE email = ?', ['qa-patient@lifelink.local']);

  await db.execute('INSERT IGNORE INTO donor_profiles (user_id,date_of_birth,weight_kg,hemoglobin,availability,emergency_opt_in) VALUES (?,?,?,?,?,1)', [donor.id, '1995-01-01', 72, 14.2, 'available']);
  await db.execute('INSERT IGNORE INTO hospitals (user_id,license_number,verification_status,emergency_capacity) VALUES (?,?,?,?)', [hospital.id, 'QA-HOSP-LIC', 'verified', 10]);
  await db.execute('INSERT IGNORE INTO blood_banks (user_id,license_number,storage_capacity_units,verification_status) VALUES (?,?,?,?)', [bank.id, 'QA-BANK-LIC', 500, 'verified']);
  await db.execute('INSERT IGNORE INTO ngos (user_id,registration_number,verification_status,focus_city) VALUES (?,?,?,?)', [ngo.id, 'QA-NGO-REG', 'verified', 'Delhi']);
  await db.execute('INSERT IGNORE INTO patients (user_id,medical_condition,preferred_hospital,emergency_contact,verification_status) VALUES (?,?,?,?,?)', [patient.id, 'QA condition', 'LifeLink QA Hospital', '9100000099', 'verified']);
  await db.execute('INSERT INTO blood_inventory (owner_id,blood_group,units,expires_on) VALUES (?,?,?,DATE_ADD(CURDATE(), INTERVAL 20 DAY))', [bank.id, 'O+', 20]);
  await db.end();
}

module.exports = globalSetup;
