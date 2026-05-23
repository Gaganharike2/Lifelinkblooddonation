require('dotenv').config();
const pool = require('../config/db');

async function main() {
  const [cols] = await pool.query('SHOW COLUMNS FROM users');
  const have = new Set(cols.map((column) => column.Field));

  async function addColumn(name, definition) {
    if (have.has(name)) return;
    await pool.query(`ALTER TABLE users ADD COLUMN ${definition}`);
    have.add(name);
    console.log(`Added users.${name}`);
  }

  await addColumn('name', 'name VARCHAR(120) NULL');
  await addColumn('mobile', 'mobile VARCHAR(24) NULL');
  await addColumn('password_hash', 'password_hash VARCHAR(255) NULL');
  await addColumn('blood_group', 'blood_group VARCHAR(5) NULL');
  await addColumn('city', 'city VARCHAR(100) NULL');
  await addColumn('address', 'address VARCHAR(255) NULL');
  await addColumn('latitude', 'latitude DECIMAL(10,7) NULL');
  await addColumn('longitude', 'longitude DECIMAL(10,7) NULL');
  await addColumn('is_verified', 'is_verified TINYINT(1) NOT NULL DEFAULT 0');
  await addColumn('referral_code', 'referral_code VARCHAR(24) NULL');
  await addColumn('referred_by', 'referred_by INT NULL');
  await addColumn('updated_at', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  if (have.has('full_name')) {
    await pool.query('UPDATE users SET name = COALESCE(name, full_name) WHERE full_name IS NOT NULL');
  }
  if (have.has('phone')) {
    await pool.query('UPDATE users SET mobile = COALESCE(mobile, phone) WHERE phone IS NOT NULL');
  }
  if (have.has('password')) {
    await pool.query('UPDATE users SET password_hash = COALESCE(password_hash, password) WHERE password IS NOT NULL');
  }
  if (have.has('status')) {
    await pool.query(`
      UPDATE users
      SET is_verified = CASE
        WHEN LOWER(COALESCE(status, '')) IN ('active', 'verified', 'approved', '1') THEN 1
        ELSE is_verified
      END
    `);
  }

  console.log('users table is compatible with LifeLink.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
