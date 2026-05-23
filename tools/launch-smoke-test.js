require('dotenv').config();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const root = path.join(__dirname, '..');
const baseUrl = process.env.SMOKE_BASE_URL || process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`;
const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
const checks = [];

function record(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text.slice(0, 160);
  }
  return { response, body };
}

async function checkPage(page) {
  const filePath = path.join(root, 'public', page.replace(/^\//, ''));
  record(`Page exists ${page}`, fs.existsSync(filePath), filePath);
  const { response } = await request(page);
  record(`Page serves ${page}`, response.ok, `HTTP ${response.status}`);
}

async function main() {
  const token = jwt.sign(
    { id: 1, role: 'hospital', name: 'LifeLink Hospital', email: 'hospital@example.com', phone: '9876543210' },
    jwtSecret,
    { expiresIn: '15m' }
  );
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const health = await request('/healthz');
  record('Health endpoint', health.response.ok && health.body.ok === true, `HTTP ${health.response.status}`);

  const config = await request('/api/config');
  record('Public config endpoint', config.response.ok && !!config.body.paymentProvider, `provider=${config.body.paymentProvider || 'missing'}`);

  await checkPage('/pages/login.html');
  await checkPage('/pages/hospital/hospital-dashboard.html');
  await checkPage('/pages/hospital/search-donors.html');
  await checkPage('/pages/hospital/subscription-plan.html');
  await checkPage('/pages/admin/admin-dashboard.html');

  const subscription = await request('/api/hospital/subscription', { headers: authHeaders });
  record('Hospital subscription API', subscription.response.ok, `HTTP ${subscription.response.status}`);

  const donors = await request('/api/hospital/donors?limit=5', { headers: authHeaders });
  record('Hospital donor search API', donors.response.ok, `HTTP ${donors.response.status}`);

  const inventory = await request('/api/hospital/inventory?limit=5', { headers: authHeaders });
  record('Hospital inventory API', inventory.response.ok, `HTTP ${inventory.response.status}`);

  const failed = checks.filter((check) => !check.ok);
  console.table(checks.map((check) => ({ Check: check.name, Status: check.ok ? 'PASS' : 'FAIL', Detail: check.detail })));
  if (failed.length) {
    console.error(`\nLaunch smoke test failed: ${failed.length} issue(s).`);
    process.exit(1);
  }
  console.log('\nLaunch smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
