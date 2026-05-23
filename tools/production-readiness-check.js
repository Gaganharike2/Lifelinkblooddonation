require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const root = path.join(__dirname, '..');
const checks = [];

function add(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function env(name) {
  return process.env[name] || '';
}

function placeholder(value) {
  return !value || /change-this|your_|example\.com|localhost|127\.0\.0\.1|dev-secret|add_key_here/i.test(value);
}

async function main() {
  add('NODE_ENV production', env('NODE_ENV') === 'production', `current=${env('NODE_ENV') || 'development'}`);
  add('HTTPS APP_URL', /^https:\/\//i.test(env('APP_URL')), env('APP_URL') || 'missing');
  add('Strong JWT secret', !placeholder(env('JWT_SECRET')) && env('JWT_SECRET').length >= 32, 'at least 32 random characters');
  const paymentProvider = env('PAYMENT_PROVIDER') || 'cashfree';
  add('Payment provider selected', ['cashfree', 'razorpay'].includes(paymentProvider), `current=${paymentProvider}`);
  add('Cashfree live credentials', paymentProvider !== 'cashfree' || (env('CASHFREE_ENV') === 'production' && !placeholder(env('CASHFREE_CLIENT_ID')) && !placeholder(env('CASHFREE_CLIENT_SECRET'))), 'required when PAYMENT_PROVIDER=cashfree');
  add('Razorpay live key', paymentProvider !== 'razorpay' || /^rzp_live_/.test(env('RAZORPAY_KEY_ID')), 'required when PAYMENT_PROVIDER=razorpay');
  add('Razorpay webhook secret', paymentProvider !== 'razorpay' || !placeholder(env('RAZORPAY_WEBHOOK_SECRET')), 'required for Razorpay webhooks');
  add('Email SMTP configured', !placeholder(env('EMAIL_USER')) && !placeholder(env('EMAIL_PASS')), 'required for OTP and notices');
  const mapProvider = env('MAP_PROVIDER') || 'leaflet';
  add('Map provider selected', ['leaflet', 'google'].includes(mapProvider), `current=${mapProvider}`);
  add('Maps configured', mapProvider === 'google' ? !placeholder(env('GOOGLE_MAPS_API_KEY')) : !placeholder(env('MAP_TILE_URL')), 'Google key or production tile URL required');
  add('Dev OTP disabled', env('ALLOW_DEV_OTP') !== '1', 'must be disabled in production');
  add('Twilio Verify configured for phone OTP', env('OTP_CHANNEL') !== 'phone' || (!placeholder(env('TWILIO_ACCOUNT_SID')) && !placeholder(env('TWILIO_AUTH_TOKEN')) && !placeholder(env('TWILIO_VERIFY_SERVICE_SID'))), 'required when OTP_CHANNEL=phone');
  add('Package lock present', fs.existsSync(path.join(root, 'package-lock.json')), 'npm ci reproducibility');
  add('Public privacy page present', fs.existsSync(path.join(root, 'public', 'pages', 'privacy.html')), 'public privacy policy required');
  add('Public terms page present', fs.existsSync(path.join(root, 'public', 'pages', 'terms.html')), 'public terms required');

  try {
    const db = await mysql.createConnection({
      host: env('MYSQL_HOST') || env('DB_HOST'),
      port: Number(env('MYSQL_PORT') || env('DB_PORT') || 3306),
      user: env('MYSQL_USER') || env('DB_USER'),
      password: env('MYSQL_PASSWORD') || env('DB_PASSWORD'),
      database: env('MYSQL_DATABASE') || env('DB_NAME')
    });
    await db.query('SELECT 1');
    await db.end();
    add('Database reachable', true, 'connected');
  } catch (error) {
    add('Database reachable', false, error.message);
  }

  const failed = checks.filter((check) => !check.ok);
  console.table(checks.map((check) => ({ Check: check.name, Status: check.ok ? 'PASS' : 'FAIL', Detail: check.detail })));
  if (failed.length) {
    console.error(`\nProduction readiness failed: ${failed.length} issue(s) must be fixed before public launch.`);
    process.exit(1);
  }
  console.log('\nProduction readiness passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
