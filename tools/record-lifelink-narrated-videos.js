const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { chromium } = require('playwright');

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, '..');
const BASE_URL = process.env.APP_URL || 'http://localhost:4000';
const OUTPUT_DIR = path.join(ROOT, 'public', 'walkthrough');
const WORK_DIR = path.join(OUTPUT_DIR, 'narration-work');

const LANGUAGES = {
  english: {
    label: 'English',
    file: 'lifelink-slow-walkthrough-english',
    voiceText: {
      intro: 'Welcome to LifeLink. This is a complete blood donation management platform for donors, hospitals, blood banks, NGOs, volunteers, and administrators.',
      register: 'On the registration page, real users can create an account by selecting their role, entering contact details, and completing OTP verification.',
      login: 'The login system uses secure sessions and role based access. After login, each role opens its own dashboard.',
      admin: 'The admin panel is the command center. It shows users, blood requests, emergencies, revenue, inventory, activity logs, analytics, and account controls.',
      adminUsers: 'In user management, admins can search users, verify accounts, ban or unban risky accounts, and inspect records.',
      adminRequests: 'Blood request monitoring helps the operations team match, fulfill, reject, or close requests from one place.',
      hospital: 'The hospital dashboard is built for real hospital operations: emergency triage, inventory, donor matching, maps, appointments, notifications, reports, and AI prediction.',
      language: 'LifeLink supports language switching. The dashboard can change to Hindi or Punjabi and remembers the selected language.',
      donors: 'The search donor page shows real donor filtering, eligibility, contact actions, and nearby donor data.',
      matching: 'Smart donor matching ranks donors by blood group, distance, eligibility, availability, and urgency. Hospitals can send WhatsApp donor alerts.',
      inventory: 'Blood inventory supports stock management, expiry tracking, low stock warnings, and charts.',
      emergency: 'Emergency requests allow hospitals to create urgent cases and broadcast alerts to nearby donors.',
      maps: 'The map system uses a global map provider for nearby donors, hospitals, blood banks, and live tracking workflows.',
      subscription: 'Subscription management shows plan comparison, usage, billing history, and payment gateway integration.',
      reports: 'Reports and analytics provide export ready operational insights for hospital teams and admins.',
      settings: 'Settings control security, OTP, notification channels, language, WhatsApp, location sharing, and subscription preferences.',
      donor: 'The donor dashboard gives donors their health tracker, appointments, donation history, rewards, wallet, referrals, nearby hospitals, chat, and notifications.',
      end: 'This is LifeLink: a real working healthcare platform designed to make blood availability faster and safer during emergencies.'
    }
  },
  hindi: {
    label: 'Hindi',
    file: 'lifelink-slow-walkthrough-hindi',
    voiceText: {
      intro: 'Namaste. LifeLink ek complete blood donation management platform hai. Isme donors, hospitals, blood banks, NGOs, volunteers aur admins sab connect hote hain.',
      register: 'Register page par user apna role select karta hai, contact details fill karta hai, aur OTP verification ke baad account activate hota hai.',
      login: 'Login system secure session aur role based access use karta hai. Login ke baad har role ka alag dashboard open hota hai.',
      admin: 'Admin panel LifeLink ka command center hai. Yahan users, blood requests, emergencies, revenue, inventory, activity logs, analytics aur account controls dikhte hain.',
      adminUsers: 'User management me admin users ko search kar sakta hai, verify kar sakta hai, risky account ko ban ya unban kar sakta hai, aur records inspect kar sakta hai.',
      adminRequests: 'Blood request monitoring se operations team request ko match, fulfill, reject ya close kar sakti hai.',
      hospital: 'Hospital dashboard real hospital operations ke liye bana hai. Isme emergency triage, inventory, donor matching, maps, appointments, notifications, reports aur AI prediction hai.',
      language: 'LifeLink me language switching hai. Dashboard Hindi ya Punjabi me change hota hai aur selected language save rehti hai.',
      donors: 'Search donor page par donor filters, eligibility, contact actions aur nearby donor data real backend se load hota hai.',
      matching: 'Smart donor matching blood group, distance, eligibility, availability aur urgency ke base par donors rank karta hai. Hospital WhatsApp donor alert bhej sakta hai.',
      inventory: 'Blood inventory me stock management, expiry tracking, low stock warnings aur charts available hain.',
      emergency: 'Emergency requests se hospital urgent case create karta hai aur nearby donors ko alert broadcast kar sakta hai.',
      maps: 'Map system global map provider use karta hai. Isse nearby donors, hospitals, blood banks aur live tracking workflows dikhte hain.',
      subscription: 'Subscription management me plans, usage, billing history aur payment gateway integration available hai.',
      reports: 'Reports aur analytics hospital team aur admin ke liye export ready insights provide karte hain.',
      settings: 'Settings me security, OTP, notification channels, language, WhatsApp, location sharing aur subscription preferences control hote hain.',
      donor: 'Donor dashboard me health tracker, appointments, donation history, rewards, wallet, referrals, nearby hospitals, chat aur notifications hain.',
      end: 'Ye hai LifeLink: ek real working healthcare platform jo emergency me blood availability ko fast aur safe banane ke liye design kiya gaya hai.'
    }
  },
  punjabi: {
    label: 'Punjabi',
    file: 'lifelink-slow-walkthrough-punjabi',
    voiceText: {
      intro: 'Sat Sri Akal. LifeLink ik complete blood donation management platform hai. Is vich donors, hospitals, blood banks, NGOs, volunteers ate admins connect hunde ne.',
      register: 'Register page te user apna role select karda hai, contact details fill karda hai, te OTP verification ton baad account activate hunda hai.',
      login: 'Login system secure session ate role based access use karda hai. Login ton baad har role da apna dashboard open hunda hai.',
      admin: 'Admin panel LifeLink da command center hai. Itthe users, blood requests, emergencies, revenue, inventory, activity logs, analytics ate account controls dikhde ne.',
      adminUsers: 'User management vich admin users nu search, verify, ban ja unban kar sakda hai, te records inspect kar sakda hai.',
      adminRequests: 'Blood request monitoring naal operations team request nu match, fulfill, reject ja close kar sakdi hai.',
      hospital: 'Hospital dashboard real hospital operations layi banaya gaya hai. Is vich emergency triage, inventory, donor matching, maps, appointments, notifications, reports ate AI prediction hai.',
      language: 'LifeLink vich language switching hai. Dashboard Hindi ja Punjabi vich change hunda hai te selected language save rehndi hai.',
      donors: 'Search donor page te donor filters, eligibility, contact actions ate nearby donor data backend ton load hunda hai.',
      matching: 'Smart donor matching blood group, distance, eligibility, availability ate urgency de base te donors rank karda hai. Hospital WhatsApp donor alert bhej sakda hai.',
      inventory: 'Blood inventory vich stock management, expiry tracking, low stock warnings ate charts available ne.',
      emergency: 'Emergency requests naal hospital urgent case create karda hai ate nearby donors nu alert broadcast kar sakda hai.',
      maps: 'Map system global map provider use karda hai. Is naal nearby donors, hospitals, blood banks ate live tracking workflows dikhde ne.',
      subscription: 'Subscription management vich plans, usage, billing history ate payment gateway integration available hai.',
      reports: 'Reports ate analytics hospital team ate admin layi export ready insights provide karde ne.',
      settings: 'Settings vich security, OTP, notification channels, language, WhatsApp, location sharing ate subscription preferences control hunde ne.',
      donor: 'Donor dashboard vich health tracker, appointments, donation history, rewards, wallet, referrals, nearby hospitals, chat ate notifications ne.',
      end: 'Eh hai LifeLink: ik real working healthcare platform jo emergency vich blood availability nu fast ate safe banan layi design kita gaya hai.'
    }
  }
};

const CAPTIONS = {
  english: {
    intro: 'LifeLink complete blood donation management platform',
    register: 'Register: role selection, OTP verification, secure onboarding',
    login: 'Login: JWT session and role-based dashboard access',
    admin: 'Admin command center: users, inventory, requests, revenue, analytics',
    adminUsers: 'User controls: search, verify, ban, unban, inspect records',
    adminRequests: 'Blood request monitoring: match, fulfill, cancel, audit',
    hospital: 'Hospital dashboard: emergency, stock, donors, maps, reports',
    language: 'Language switch: English, Hindi, Punjabi',
    donors: 'Search donors: filters, eligibility, nearby donors, contact actions',
    matching: 'Smart matching: AI ranking and WhatsApp donor alerts',
    inventory: 'Inventory: stock CRUD, expiry alerts, charts',
    emergency: 'Emergency requests: urgent cases and donor broadcast',
    maps: 'Maps: global donor, hospital, and blood bank locations',
    subscription: 'Subscription: plans, usage, billing, payments',
    reports: 'Reports: analytics and export-ready insights',
    settings: 'Settings: security, OTP, WhatsApp, language, notifications',
    donor: 'Donor dashboard: health, appointments, rewards, wallet, referrals',
    end: 'LifeLink helps make emergency blood availability faster and safer'
  },
  hindi: {
    intro: 'LifeLink: पूरा blood donation management platform',
    register: 'Register: role selection, OTP verification, secure onboarding',
    login: 'Login: secure session और role-based dashboard',
    admin: 'Admin command center: users, requests, inventory, analytics',
    adminUsers: 'User controls: search, verify, ban, unban',
    adminRequests: 'Blood request monitoring: match, fulfill, cancel',
    hospital: 'Hospital dashboard: emergency, stock, donors, maps, reports',
    language: 'Language switch: English, Hindi, Punjabi',
    donors: 'Search donors: filters, eligibility, nearby donors',
    matching: 'Smart matching: AI ranking और WhatsApp donor alerts',
    inventory: 'Inventory: stock CRUD, expiry alerts, charts',
    emergency: 'Emergency requests: urgent case और donor broadcast',
    maps: 'Maps: donors, hospitals और blood banks',
    subscription: 'Subscription: plans, usage, billing, payments',
    reports: 'Reports: analytics और export-ready insights',
    settings: 'Settings: security, OTP, WhatsApp, language',
    donor: 'Donor dashboard: health, appointments, rewards, referrals',
    end: 'LifeLink emergency blood availability को fast और safe बनाता है'
  },
  punjabi: {
    intro: 'LifeLink: complete blood donation management platform',
    register: 'Register: role selection, OTP verification, secure onboarding',
    login: 'Login: secure session ate role-based dashboard',
    admin: 'Admin command center: users, requests, inventory, analytics',
    adminUsers: 'User controls: search, verify, ban, unban',
    adminRequests: 'Blood request monitoring: match, fulfill, cancel',
    hospital: 'Hospital dashboard: emergency, stock, donors, maps, reports',
    language: 'Language switch: English, Hindi, Punjabi',
    donors: 'Search donors: filters, eligibility, nearby donors',
    matching: 'Smart matching: AI ranking ate WhatsApp donor alerts',
    inventory: 'Inventory: stock CRUD, expiry alerts, charts',
    emergency: 'Emergency requests: urgent case ate donor broadcast',
    maps: 'Maps: donors, hospitals ate blood banks',
    subscription: 'Subscription: plans, usage, billing, payments',
    reports: 'Reports: analytics ate export-ready insights',
    settings: 'Settings: security, OTP, WhatsApp, language',
    donor: 'Donor dashboard: health, appointments, rewards, referrals',
    end: 'LifeLink emergency blood availability nu fast ate safe banaunda hai'
  }
};

const FLOW = [
  ['intro', '/'],
  ['register', '/pages/register.html'],
  ['login', '/pages/login.html'],
  ['admin', '/pages/admin/admin-dashboard.html'],
  ['adminUsers', '/pages/admin/admin-users.html'],
  ['adminRequests', '/pages/admin/admin-blood-requests.html'],
  ['hospital', '/pages/hospital/hospital-dashboard.html'],
  ['language', '/pages/hospital/hospital-dashboard.html'],
  ['donors', '/pages/hospital/search-donors.html'],
  ['matching', '/pages/hospital/smart-matching.html'],
  ['inventory', '/pages/hospital/blood-inventory.html'],
  ['emergency', '/pages/hospital/emergency-request.html'],
  ['maps', '/pages/hospital/nearby-centers.html'],
  ['subscription', '/pages/hospital/subscription-plan.html'],
  ['reports', '/pages/hospital/hospital-reports.html'],
  ['settings', '/pages/hospital/settings.html'],
  ['donor', '/pages/donor/donor-dashboard.html'],
  ['end', '/pages/hospital/hospital-dashboard.html']
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await fs.mkdir(WORK_DIR, { recursive: true });
  await assertServer();
  const results = [];
  const requested = process.argv.slice(2).map((item) => item.toLowerCase());
  const entries = Object.entries(LANGUAGES).filter(([key]) => !requested.length || requested.includes(key));
  for (const [key, language] of entries) {
    results.push(await recordLanguage(key, language));
  }
  console.log(JSON.stringify(results, null, 2));
}

async function recordLanguage(key, language) {
  const languageDir = path.join(WORK_DIR, key);
  await fs.rm(languageDir, { recursive: true, force: true });
  await fs.mkdir(languageDir, { recursive: true });
  const audioPath = await buildNarrationAudio(key, language, languageDir);
  const durations = await probeSegmentDurations(key, languageDir);
  const rawDir = path.join(languageDir, 'raw-video');
  await fs.mkdir(rawDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: rawDir, size: { width: 1440, height: 900 } }
  });
  const page = await context.newPage();

  await login(page);
  for (const [segment, url] of FLOW) {
    await open(page, url);
    if (segment === 'language') await setLanguage(page, key === 'hindi' ? 'hi' : key === 'punjabi' ? 'pa' : 'en');
    if (segment === 'matching') await clickIfVisible(page, '[data-whatsapp]');
    if (segment === 'inventory') await clickIfVisible(page, '[data-action="create"]');
    await caption(page, CAPTIONS[key][segment] || language.voiceText[segment]);
    await slowPageMovement(page);
    await delay(Math.max(3600, Math.round((durations[segment] || 5) * 1000) + 1200));
  }

  const video = page.video();
  await context.close();
  await browser.close();

  const webmPath = await video.path();
  const silentMp4 = path.join(languageDir, `${language.file}-silent.mp4`);
  const finalMp4 = path.join(OUTPUT_DIR, `${language.file}.mp4`);
  const finalWebm = path.join(OUTPUT_DIR, `${language.file}.webm`);
  await fs.copyFile(webmPath, finalWebm);
  await execFileAsync('ffmpeg', ['-y', '-i', webmPath, '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-movflags', '+faststart', silentMp4]);
  await execFileAsync('ffmpeg', ['-y', '-i', silentMp4, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', finalMp4]);
  const duration = await mediaDuration(finalMp4);
  return { language: language.label, mp4: finalMp4, webm: finalWebm, duration: Number(duration.toFixed(1)) };
}

async function assertServer() {
  const response = await fetch(`${BASE_URL}/api/health`).catch(() => null);
  if (!response || !response.ok) throw new Error(`LifeLink server is not running at ${BASE_URL}.`);
}

async function buildNarrationAudio(key, language, languageDir) {
  const listPath = path.join(languageDir, 'audio-list.txt');
  const concatItems = [];
  for (const [segment] of FLOW) {
    const textPath = path.join(languageDir, `${segment}.txt`);
    const wavPath = path.join(languageDir, `${segment}.wav`);
    await fs.writeFile(textPath, language.voiceText[segment], 'utf8');
    await speakToWav(textPath, wavPath);
    concatItems.push(`file '${wavPath.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
  }
  await fs.writeFile(listPath, concatItems.join('\n'), 'utf8');
  const audioPath = path.join(languageDir, `${key}-narration.wav`);
  await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-ar', '44100', '-ac', '2', audioPath]);
  return audioPath;
}

async function speakToWav(textPath, wavPath) {
  const ps = `
    param([string]$TextPath,[string]$WavePath)
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.Rate = -2
    $synth.Volume = 100
    $synth.SetOutputToWaveFile($WavePath)
    $synth.Speak([System.IO.File]::ReadAllText($TextPath))
    $synth.Dispose()
  `;
  const psPath = path.join(WORK_DIR, 'speak.ps1');
  await fs.writeFile(psPath, ps, 'utf8');
  await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath, textPath, wavPath]);
}

async function probeSegmentDurations(key, languageDir) {
  const durations = {};
  for (const [segment] of FLOW) {
    durations[segment] = await mediaDuration(path.join(languageDir, `${segment}.wav`)).catch(() => 5);
  }
  return durations;
}

async function mediaDuration(filePath) {
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath]);
  return Number(stdout.trim()) || 0;
}

async function login(page) {
  await open(page, '/pages/login.html');
  await page.locator('input[name="identifier"]').fill('admin@lifelink.local');
  await page.locator('input[name="password"]').fill('Admin@12345');
  await Promise.all([
    page.waitForURL(/admin-dashboard/, { timeout: 15000 }),
    page.getByRole('button', { name: 'Login' }).click()
  ]);
}

async function open(page, url) {
  await page.goto(`${BASE_URL}${url}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {});
  await installCaptionStyle(page);
}

async function caption(page, text) {
  await installCaptionStyle(page);
  await page.evaluate((message) => {
    let banner = document.querySelector('#lifelinkNarrationCaption');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'lifelinkNarrationCaption';
      document.body.appendChild(banner);
    }
    banner.textContent = message;
  }, text);
}

async function installCaptionStyle(page) {
  await page.addStyleTag({
    content: `
      #lifelinkNarrationCaption {
        position: fixed;
        left: 28px;
        right: 28px;
        bottom: 24px;
        z-index: 999999;
        padding: 18px 22px;
        border-radius: 8px;
        background: rgba(14, 18, 30, .93);
        color: #fff;
        box-shadow: 0 20px 70px rgba(0,0,0,.34);
        font: 850 23px/1.35 Inter, Segoe UI, Arial, sans-serif;
        backdrop-filter: blur(14px);
      }
      #lifelinkNarrationCaption:before {
        content: "LifeLink Guided Tour";
        display: block;
        margin-bottom: 5px;
        color: #ff6b8f;
        font-size: 12px;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
    `
  }).catch(() => {});
}

async function slowPageMovement(page) {
  await page.evaluate(async () => {
    const max = Math.max(0, document.body.scrollHeight - window.innerHeight);
    const steps = [0, .18, .36, .54, .72, .9, .18];
    for (const step of steps) {
      window.scrollTo({ top: max * step, behavior: 'smooth' });
      await new Promise((resolve) => setTimeout(resolve, 560));
    }
  });
}

async function setLanguage(page, value) {
  const select = page.locator('.language-select');
  if (await select.count()) await select.first().selectOption(value).catch(() => {});
}

async function clickIfVisible(page, selector) {
  const target = page.locator(selector);
  if (await target.count()) await target.first().click({ timeout: 2500 }).catch(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
