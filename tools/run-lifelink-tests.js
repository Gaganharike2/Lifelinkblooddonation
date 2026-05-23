const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const root = path.join(__dirname, '..');
const reportsDir = path.join(root, 'reports');
const screenshotDir = path.join(reportsDir, 'screenshots');
fs.mkdirSync(reportsDir, { recursive: true });
fs.mkdirSync(screenshotDir, { recursive: true });

process.env.NODE_ENV = 'test';
process.env.PORT = '4010';
process.env.APP_URL = 'http://localhost:4010';
process.env.CORS_ORIGINS = process.env.APP_URL;
process.env.OTP_CHANNEL = 'email';
process.env.ALLOW_DEV_OTP = '1';
process.env.EMAIL_DISABLED = '1';

const baseUrl = process.env.APP_URL;
const results = [];
const apiResults = [];
const securityResults = [];
const performance = [];
let db;

function record(name, ok, detail = '', severity = ok ? 'Low' : 'Medium') {
  results.push({ name, ok, detail, severity });
  if (!ok) console.error(`FAIL ${name}: ${detail}`);
}

async function timed(name, fn) {
  const start = Date.now();
  const value = await fn();
  performance.push({ name, ms: Date.now() - start });
  return value;
}

async function request(method, url, { token, data } = {}) {
  const started = Date.now();
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      ...(data ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: data ? JSON.stringify(data) : undefined
  });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }
  apiResults.push({ method, url, status: response.status, ms: Date.now() - started, ok: response.ok });
  return { response, body };
}

async function login(role, identifier, password) {
  const { response, body } = await request('POST', '/api/auth/login', { data: { identifier, password, channel: 'email' } });
  if (!response.ok || !body.token) throw new Error(`${role} login failed with HTTP ${response.status}`);
  return { token: body.token, user: body.user };
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const { response } = await request('GET', '/healthz');
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('LifeLink test server did not become healthy');
}

async function seed() {
  const setup = await import('../tests/global-setup.js');
  await setup.default();
  db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'lifelink_blood'
  });
}

async function run() {
  await seed();
  require('./start-test-server');
  await waitForServer();

  const sessions = {
    admin: await login('admin', 'qa-admin@lifelink.local', 'AdminTest@123'),
    donor: await login('donor', 'qa-donor@lifelink.local', 'DonorTest@123'),
    hospital: await login('hospital', 'qa-hospital@lifelink.local', 'HospitalTest@123'),
    blood_bank: await login('blood_bank', 'qa-bloodbank@lifelink.local', 'BankTest@123'),
    ngo: await login('ngo', 'qa-ngo@lifelink.local', 'NgoTest@123'),
    patient: await login('patient', 'qa-patient@lifelink.local', 'PatientTest@123')
  };
  record('All seeded roles can login', true, 'Admin, donor, hospital, blood bank, NGO and patient tokens issued');

  await timed('Auth negative cases', async () => {
    const wrong = await request('POST', '/api/auth/login', { data: { identifier: 'qa-donor@lifelink.local', password: 'Wrong@12345' } });
    record('Wrong password rejected', wrong.response.status === 401, `HTTP ${wrong.response.status}`, 'High');
    const invalid = await request('GET', '/api/auth/me', { token: 'invalid.token.value' });
    record('Invalid JWT rejected', invalid.response.status === 401, `HTTP ${invalid.response.status}`, 'Critical');
    const donorAdmin = await request('GET', '/api/admin/overview', { token: sessions.donor.token });
    record('Role-based admin access blocked for donor', donorAdmin.response.status === 403, `HTTP ${donorAdmin.response.status}`, 'Critical');
  });

  await timed('Password reset flow', async () => {
    const forgot = await request('POST', '/api/auth/forgot-password', { data: { identifier: 'qa-patient@lifelink.local', channel: 'email' } });
    record('Forgot password returns reset OTP in dev test mode', forgot.response.ok && /^\d{6}$/.test(forgot.body.devOtp || ''), `HTTP ${forgot.response.status}`, 'High');
    const reset = await request('POST', '/api/auth/reset-password', { data: { identifier: 'qa-patient@lifelink.local', otp: forgot.body.devOtp, password: 'PatientReset@123', channel: 'email' } });
    record('Reset password accepts valid reset OTP', reset.response.ok, `HTTP ${reset.response.status}`, 'High');
  });

  await timed('Dashboard and pages', async () => {
    const pageChecks = [
      ['/', 'LifeLink'],
      ['/pages/login.html', 'Login'],
      ['/pages/register.html', 'Create account'],
      ['/pages/admin/admin-dashboard.html', 'Admin Dashboard'],
      ['/pages/donor/donor-dashboard.html', 'Donor'],
      ['/pages/hospital/hospital-dashboard.html', 'Hospital'],
      ['/pages/blood-bank/blood-bank-dashboard.html', 'Blood Bank'],
      ['/pages/ngo/ngo-dashboard.html', 'NGO'],
      ['/pages/patient/patient-dashboard.html', 'Patient']
    ];
    for (const [url, text] of pageChecks) {
      const page = await request('GET', url);
      record(`Page loads ${url}`, page.response.ok && String(page.body).includes(text), `HTTP ${page.response.status}`);
    }
  });

  await timed('Dashboard APIs', async () => {
    const checks = [
      ['/api/admin/overview', sessions.admin.token],
      ['/api/donor/dashboard', sessions.donor.token],
      ['/api/dashboard/hospital', sessions.hospital.token],
      ['/api/dashboard/summary', sessions.blood_bank.token],
      ['/api/dashboard/summary', sessions.ngo.token],
      ['/api/dashboard/summary', sessions.patient.token]
    ];
    for (const [url, token] of checks) {
      const response = await request('GET', url, { token });
      record(`Dashboard API ${url}`, response.response.ok, `HTTP ${response.response.status}`);
    }
  });

  let flowRequestId;
  let flowDonorRequestId;
  await timed('Blood request flow', async () => {
    const inventory = await request('POST', '/api/dashboard/inventory', { token: sessions.blood_bank.token, data: { blood_group: 'O+', units: 5, expires_on: '2030-01-01' } });
    record('Blood bank can add inventory', inventory.response.status === 201, `HTTP ${inventory.response.status}`);
    const flow = await request('POST', '/api/hospital/blood-requests', { token: sessions.hospital.token, data: { patient_name: 'QA Flow Patient', blood_group: 'O+', units_needed: 2, urgency: 'critical', city: 'Delhi' } });
    flowRequestId = flow.body.id;
    record('Hospital creates blood request', flow.response.status === 201 && flowRequestId, `HTTP ${flow.response.status}`, 'High');
    const donorRequest = await request('POST', '/api/hospital/donor-requests', { token: sessions.hospital.token, data: { donor_id: sessions.donor.user.id, blood_group: 'O+', message: 'QA flow request' } });
    flowDonorRequestId = donorRequest.body.id;
    record('Hospital sends donor request notification', donorRequest.response.status === 201 && flowDonorRequestId, `HTTP ${donorRequest.response.status}`, 'High');
    const accept = await request('PATCH', `/api/donor/requests/${flowDonorRequestId}`, { token: sessions.donor.token, data: { status: 'accepted' } });
    record('Donor accepts request', accept.response.ok, `HTTP ${accept.response.status}`, 'High');
    const complete = await request('PATCH', `/api/hospital/blood-requests/${flowRequestId}`, { token: sessions.hospital.token, data: { status: 'fulfilled' } });
    record('Hospital completes request', complete.response.ok, `HTTP ${complete.response.status}`, 'High');
    const [[dbStatus]] = await db.execute('SELECT status FROM blood_requests WHERE id = ?', [flowRequestId]);
    record('Database stores completed request status', dbStatus?.status === 'fulfilled', `status=${dbStatus?.status}`, 'High');
  });

  await timed('Role workflows', async () => {
    record('Donor profile update works', (await request('PUT', '/api/donor/profile', { token: sessions.donor.token, data: { availability: 'available', hemoglobin: 14.1, weight_kg: 72 } })).response.ok);
    record('Hospital emergency request works', (await request('POST', '/api/hospital/emergency-requests', { token: sessions.hospital.token, data: { patient_name: 'Emergency QA', blood_group: 'A+', units_needed: 1, emergency_level: 'critical' } })).response.status === 201);
    record('NGO campaign creation works', (await request('POST', '/api/dashboard/campaigns', { token: sessions.ngo.token, data: { title: `QA Campaign ${Date.now()}`, city: 'Delhi', campaign_date: '2030-03-01', target_donors: 25 } })).response.status === 201);
    record('Patient request creation works', (await request('POST', '/api/dashboard/requests', { token: sessions.patient.token, data: { patient_name: 'QA Patient', blood_group: 'B+', units_needed: 1, urgency: 'urgent' } })).response.status === 201);
    record('Admin users endpoint works', (await request('GET', '/api/admin/users', { token: sessions.admin.token })).response.ok);
  });

  await timed('Security checks', async () => {
    const sql = await request('POST', '/api/auth/login', { data: { identifier: "' OR '1'='1", password: "' OR '1'='1" } });
    securityResults.push({ check: 'SQL injection login bypass', ok: sql.response.status === 401, detail: `HTTP ${sql.response.status}` });
    const unauth = await request('GET', '/api/dashboard/summary');
    securityResults.push({ check: 'Unauthenticated dashboard API', ok: unauth.response.status === 401, detail: `HTTP ${unauth.response.status}` });
    const xssPayload = '<img src=x onerror=alert(1)>';
    const xss = await request('POST', '/api/hospital/support', { token: sessions.hospital.token, data: { subject: xssPayload, message: xssPayload } });
    let storedSafely = false;
    if (xss.response.ok) {
      const [[ticket]] = await db.execute('SELECT subject,message FROM support_tickets WHERE hospital_id = ? ORDER BY id DESC LIMIT 1', [sessions.hospital.user.id]);
      storedSafely = !String(ticket?.subject || '').includes('<') && !String(ticket?.message || '').includes('<');
    }
    securityResults.push({ check: 'Stored XSS payload is encoded in support tickets', ok: xss.response.ok && storedSafely, detail: xss.response.ok ? `storedSafely=${storedSafely}` : `HTTP ${xss.response.status}` });
    for (const item of securityResults) record(`Security: ${item.check}`, item.ok, item.detail, item.ok ? 'Low' : 'High');
  });

  await timed('Database integrity', async () => {
    for (const table of ['users', 'donor_profiles', 'patients', 'hospitals', 'blood_banks', 'ngos', 'blood_inventory', 'blood_requests', 'donations', 'notifications']) {
      const [[row]] = await db.execute(`SELECT COUNT(*) AS total FROM ${table}`);
      record(`Database table ${table} readable`, Number.isFinite(Number(row.total)), `rows=${row.total}`);
    }
  });

  writeReports();
  const failed = results.filter((result) => !result.ok);
  if (db) await db.end();
  console.log(`LifeLink QA checks complete: ${results.length - failed.length} passed, ${failed.length} failed.`);
  process.exit(failed.length ? 1 : 0);
}

function table(rows) {
  if (!rows.length) return '| Item | Result |\n| --- | --- |\n';
  const keys = Object.keys(rows[0]);
  return `| ${keys.join(' | ')} |\n| ${keys.map(() => '---').join(' | ')} |\n${rows.map((row) => `| ${keys.map((key) => String(row[key] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`).join('\n')}\n`;
}

function writeReports() {
  const failed = results.filter((result) => !result.ok);
  const passed = results.filter((result) => result.ok);
  const score = Math.max(0, Math.round((passed.length / Math.max(results.length, 1)) * 100) - 15);
  const launchBlockers = [
    'Production readiness script fails until NODE_ENV, HTTPS APP_URL, strong JWT secret, live payment, SMTP and map settings are configured.',
    '.env contains live-looking local secrets; rotate exposed credentials before beta distribution.',
    'Browser screenshot tests could not run in this sandbox because Node child-process spawning is blocked; run npx playwright test on a normal workstation/CI for visual screenshots.'
  ];

  fs.writeFileSync(path.join(reportsDir, 'full-project-test-report.md'), `# LifeLink Full Project Test Report

Generated: ${new Date().toISOString()}

## Summary
- Verified checks: ${passed.length}
- Failed checks: ${failed.length}
- Beta readiness score: ${score}/100

## Findings
${table(results.map((r) => ({ Severity: r.severity, Check: r.name, Status: r.ok ? 'PASS' : 'FAIL', Detail: r.detail })))}

## Launch Blockers
${launchBlockers.map((item) => `- ${item}`).join('\n')}
`);

  fs.writeFileSync(path.join(reportsDir, 'api-testing-report.md'), `# API Testing Report

${table(apiResults.map((r) => ({ Method: r.method, Path: r.url, Status: r.status, TimeMs: r.ms, Result: r.ok ? 'PASS' : 'CHECK' })))}
`);

  fs.writeFileSync(path.join(reportsDir, 'security-report.md'), `# Security Testing Report

${table(securityResults.map((r) => ({ Check: r.check, Status: r.ok ? 'PASS' : 'FAIL', Detail: r.detail })))}

## Required Security Actions
- Rotate secrets found in local .env before beta launch.
- Add output encoding or sanitization anywhere support tickets, chats, campaign titles or user-generated content render as HTML.
- Keep rate limits enabled in production and add CAPTCHA for public auth endpoints.
`);

  fs.writeFileSync(path.join(reportsDir, 'performance-report.md'), `# Performance Report

${table(performance.map((r) => ({ Check: r.name, TimeMs: r.ms, Status: r.ms < 3000 ? 'PASS' : 'SLOW' })))}
`);

  fs.writeFileSync(path.join(reportsDir, 'bug-report.md'), `# Bug Report

${failed.length ? table(failed.map((r) => ({ Severity: r.severity, Bug: r.name, Detail: r.detail }))) : 'No failing automated checks remained in the in-process runner.\n'}

## Fixed During This Pass
- Added missing forgot-password and reset-password API endpoints.
- Replaced external placeholder tests with LifeLink-focused test specs.
- Added a working npm test command for this sandbox.
`);

  fs.writeFileSync(path.join(reportsDir, 'production-risk-report.md'), `# Production Risk Report

## Risk Level
High until production environment is configured and browser-based Playwright visual tests are run in CI.

## Risks
${launchBlockers.map((item) => `- ${item}`).join('\n')}
`);

  fs.writeFileSync(path.join(reportsDir, 'final-launch-checklist.md'), `# Final Launch Checklist

- [ ] Rotate .env secrets and issue new Twilio/Razorpay/Google keys.
- [ ] Set NODE_ENV=production.
- [ ] Use HTTPS APP_URL.
- [ ] Set a strong JWT_SECRET with at least 32 random characters.
- [ ] Configure live payment provider credentials and webhook secrets.
- [ ] Configure verified SMTP for OTP/email.
- [ ] Run npm run check:production until it passes.
- [ ] Run npm test in this workspace.
- [ ] Run npx playwright test in a normal browser-capable CI/workstation for screenshots.
- [ ] Review legal/privacy/healthcare operational requirements in docs/PRODUCTION_LAUNCH_CHECKLIST.md.
`);

  fs.writeFileSync(path.join(screenshotDir, 'README.md'), `# Screenshots

No failed browser screenshots were generated in this sandbox because browser process spawning is blocked before Chromium can launch. The Playwright spec files are present for browser-capable CI.
`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
