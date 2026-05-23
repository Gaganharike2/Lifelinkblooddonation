const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { chromium } = require('playwright');

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'walkthrough');
const VIDEO_DIR = path.join(OUTPUT_DIR, 'raw');
const BASE_URL = process.env.APP_URL || 'http://localhost:4000';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await fs.mkdir(VIDEO_DIR, { recursive: true });
  await assertServer();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } }
  });
  const page = await context.newPage();

  await tourPublicRegistration(page);
  await loginAsAdmin(page);
  await tourAdmin(page);
  await tourHospital(page);
  await tourDonor(page);

  const video = page.video();
  await context.close();
  await browser.close();

  const webm = await video.path();
  const finalWebm = path.join(OUTPUT_DIR, 'lifelink-full-walkthrough.webm');
  const finalMp4 = path.join(OUTPUT_DIR, 'lifelink-full-walkthrough.mp4');
  await fs.copyFile(webm, finalWebm);

  let mp4Created = false;
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', finalWebm,
      '-vf', 'format=yuv420p',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-movflags', '+faststart',
      finalMp4
    ], { cwd: ROOT });
    mp4Created = true;
  } catch (error) {
    console.warn(`MP4 conversion skipped: ${error.message}`);
  }

  console.log(JSON.stringify({
    webm: finalWebm,
    mp4: mp4Created ? finalMp4 : null
  }, null, 2));
}

async function assertServer() {
  const response = await fetch(`${BASE_URL}/api/health`).catch(() => null);
  if (!response || !response.ok) {
    throw new Error(`LifeLink server is not running at ${BASE_URL}. Start it with npm start first.`);
  }
}

async function tourPublicRegistration(page) {
  await open(page, '/');
  await caption(page, 'LifeLink: a healthcare blood donation platform for donors, hospitals, NGOs, volunteers, and admins.');
  await slowScroll(page);

  await open(page, '/pages/register.html');
  await caption(page, 'Public registration: real users choose donor, patient, hospital, NGO, volunteer, blood bank, or camp organizer roles.');
  await fillIfVisible(page, 'input[name="name"]', 'Demo Hospital Partner');
  await fillIfVisible(page, 'input[name="email"]', 'demo-hospital@example.com');
  await fillIfVisible(page, 'input[name="mobile"]', '9876543210');
  await fillIfVisible(page, 'input[name="password"]', 'DemoPass@123');
  await selectIfVisible(page, 'select[name="role"]', 'hospital');
  await caption(page, 'Registration is shown only as a preview here. We do not submit a fake account during the video.');
  await delay(1100);
}

async function loginAsAdmin(page) {
  await open(page, '/pages/login.html');
  await caption(page, 'Secure login with JWT session and role-based redirects.');
  await page.locator('input[name="identifier"]').fill('admin@lifelink.local');
  await page.locator('input[name="password"]').fill('Admin@12345');
  await Promise.all([
    page.waitForURL(/admin-dashboard/, { timeout: 15000 }),
    page.getByRole('button', { name: 'Login' }).click()
  ]);
  await caption(page, 'Admin account authenticated. Opening the LifeLink command center.');
  await delay(1000);
}

async function tourAdmin(page) {
  await caption(page, 'Admin dashboard: real backend metrics, user controls, request monitoring, revenue, inventory, and activity logs.');
  await slowScroll(page);
  await clickFirst(page, '[data-view]');
  await caption(page, 'Record detail drawer: admins can inspect operational records without leaving the dashboard.');
  await delay(900);
  await clickIfVisible(page, '[data-close-details]');

  await open(page, '/pages/admin/admin-users.html');
  await caption(page, 'User management: search, verify, ban, unban, and audit platform accounts.');
  await delay(1200);

  await open(page, '/pages/admin/admin-blood-requests.html');
  await caption(page, 'Blood request monitoring: match, fulfill, or cancel patient blood requests from the admin panel.');
  await delay(1200);

  await open(page, '/pages/admin/admin-notifications.html');
  await caption(page, 'Notification management: broadcast in-app alerts to all users or a selected role.');
  await clickIfVisible(page, '[data-action="broadcast"]');
  await delay(1200);

  await open(page, '/pages/admin/admin-analytics.html');
  await caption(page, 'Analytics: user roles, blood demand, revenue trends, and platform metrics are loaded from APIs.');
  await slowScroll(page);
}

async function tourHospital(page) {
  await open(page, '/pages/hospital/hospital-dashboard.html');
  await caption(page, 'Hospital dashboard: emergency triage, live inventory, smart donor matching, maps, appointments, and AI prediction.');
  await setLanguage(page, 'hi');
  await caption(page, 'Multi-language support: the same dashboard can switch to Hindi and remembers the selection.');
  await setLanguage(page, 'en');
  await slowScroll(page);

  await open(page, '/pages/hospital/search-donors.html');
  await caption(page, 'Search Donors: filters, eligibility, nearby donors, maps, WhatsApp/call actions, and backend donor APIs.');
  await fillIfVisible(page, '#q', 'A+');
  await delay(1200);

  await open(page, '/pages/hospital/smart-matching.html');
  await caption(page, 'Smart Matching: AI-ranked donors by eligibility, blood group, distance, and availability.');
  await clickIfVisible(page, '[data-whatsapp]');
  await caption(page, 'WhatsApp donor message flow: open WhatsApp manually or send/log through backend when provider keys are configured.');
  await delay(1200);

  await open(page, '/pages/hospital/blood-inventory.html');
  await caption(page, 'Blood Inventory: real stock CRUD, expiry tracking, low-stock warnings, and chart analytics.');
  await clickIfVisible(page, '[data-action="create"]');
  await delay(1000);

  await open(page, '/pages/hospital/emergency-request.html');
  await caption(page, 'Emergency Requests: create urgent cases, broadcast alerts, and track emergency status.');
  await delay(1200);

  await open(page, '/pages/hospital/nearby-centers.html');
  await caption(page, 'Global maps: free Leaflet/OpenStreetMap provider is integrated for live donor and center locations.');
  await delay(1400);

  await open(page, '/pages/hospital/subscription-plan.html');
  await caption(page, 'Subscription Plan: plan comparison, billing history, usage analytics, and payment provider integration.');
  await slowScroll(page);

  await open(page, '/pages/hospital/hospital-reports.html');
  await caption(page, 'Reports and analytics: export-ready operational data for hospital teams.');
  await delay(1200);

  await open(page, '/pages/hospital/settings.html');
  await caption(page, 'Settings: security, OTP, language, WhatsApp, notifications, location sharing, and renewal controls.');
  await delay(1200);
}

async function tourDonor(page) {
  await open(page, '/pages/donor/donor-dashboard.html');
  await caption(page, 'Donor dashboard: profile, appointments, camps, rewards, wallet, referrals, chat, notifications, and health tracking.');
  await slowScroll(page);

  await open(page, '/pages/donor/donor-health-tracker.html');
  await caption(page, 'Health tracker: hemoglobin, eligibility, medical readiness, and donation reminders.');
  await delay(1200);

  await open(page, '/pages/donor/donor-nearby-hospitals.html');
  await caption(page, 'Nearby hospitals: donors can find centers and navigate using the global map provider.');
  await delay(1200);

  await open(page, '/pages/donor/donor-rewards.html');
  await caption(page, 'Rewards and referrals encourage repeat donations and donor engagement.');
  await delay(1200);
}

async function open(page, url) {
  await page.goto(`${BASE_URL}${url}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await installCaptionStyle(page);
}

async function caption(page, text) {
  await installCaptionStyle(page);
  await page.evaluate((message) => {
    let banner = document.querySelector('#lifelinkWalkthroughCaption');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'lifelinkWalkthroughCaption';
      document.body.appendChild(banner);
    }
    banner.textContent = message;
  }, text);
  await delay(1500);
}

async function installCaptionStyle(page) {
  await page.addStyleTag({
    content: `
      #lifelinkWalkthroughCaption {
        position: fixed;
        left: 28px;
        right: 28px;
        bottom: 24px;
        z-index: 999999;
        padding: 16px 20px;
        border-radius: 8px;
        background: rgba(14, 18, 30, .92);
        color: #fff;
        box-shadow: 0 20px 70px rgba(0,0,0,.3);
        font: 800 20px/1.35 Inter, Segoe UI, Arial, sans-serif;
        backdrop-filter: blur(14px);
      }
      #lifelinkWalkthroughCaption:before {
        content: "LifeLink Walkthrough";
        display: block;
        margin-bottom: 4px;
        color: #ff6b8f;
        font-size: 12px;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
    `
  }).catch(() => {});
}

async function slowScroll(page) {
  await page.evaluate(async () => {
    const steps = [0.18, 0.38, 0.62, 0.88, 0];
    for (const step of steps) {
      window.scrollTo({ top: document.body.scrollHeight * step, behavior: 'smooth' });
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
  });
}

async function fillIfVisible(page, selector, value) {
  const locator = page.locator(selector);
  if (await locator.count()) await locator.first().fill(value).catch(() => {});
}

async function selectIfVisible(page, selector, value) {
  const locator = page.locator(selector);
  if (await locator.count()) await locator.first().selectOption(value).catch(() => {});
}

async function clickIfVisible(page, selector) {
  const locator = page.locator(selector);
  if (await locator.count()) await locator.first().click().catch(() => {});
}

async function clickFirst(page, selector) {
  const locator = page.locator(selector);
  if (await locator.count()) await locator.first().click({ timeout: 3000 }).catch(() => {});
}

async function setLanguage(page, language) {
  const locator = page.locator('.language-select');
  if (await locator.count()) {
    await locator.first().selectOption(language).catch(() => {});
    await delay(700);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
