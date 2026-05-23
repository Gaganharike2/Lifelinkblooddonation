const DonorModule = (() => {
  const D = document;
  const mod = D.body.dataset.module;
  const title = D.body.dataset.title;
  const subtitle = D.body.dataset.subtitle;
  const apiBase = '/api/donor';
  const state = { rows: [], data: {}, charts: [] };

  const nav = [
    ['donor-dashboard.html', 'Dashboard', 'fa-gauge-high'],
    ['donor-profile.html', 'Profile', 'fa-user'],
    ['donor-edit-profile.html', 'Edit Profile', 'fa-user-pen'],
    ['donor-nearby-hospitals.html', 'Nearby Hospitals', 'fa-hospital'],
    ['donor-blood-camps.html', 'Blood Camps', 'fa-tent'],
    ['donor-appointments.html', 'Appointments', 'fa-calendar-check'],
    ['donor-donation-history.html', 'Donation History', 'fa-clock-rotate-left'],
    ['donor-health-tracker.html', 'Health Tracker', 'fa-heart-pulse'],
    ['donor-medical-reports.html', 'Medical Reports', 'fa-file-medical'],
    ['donor-rewards.html', 'Rewards', 'fa-award'],
    ['donor-wallet.html', 'Wallet', 'fa-wallet'],
    ['donor-referrals.html', 'Referrals', 'fa-share-nodes'],
    ['donor-chat.html', 'Chat', 'fa-comments'],
    ['donor-notifications.html', 'Notifications', 'fa-bell'],
    ['donor-settings.html', 'Settings', 'fa-gear'],
    ['logout.html', 'Logout', 'fa-right-from-bracket']
  ];

  const endpoints = {
    dashboard: 'dashboard',
    profile: 'profile',
    'edit-profile': 'profile',
    'nearby-hospitals': 'nearby-hospitals',
    'blood-camps': 'blood-camps',
    appointments: 'appointments',
    'donation-history': 'donation-history',
    health: 'health',
    'medical-reports': 'medical-reports',
    rewards: 'rewards',
    wallet: 'wallet',
    referrals: 'referrals',
    chat: 'chat',
    notifications: 'notifications',
    settings: 'settings'
  };

  D.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (mod === 'logout') return LifeLink.logout();
    LifeLink.requireRole(['donor', 'admin', 'super_admin']);
    renderShell();
    bindChrome();
    await load();
  }

  function renderShell() {
    D.getElementById('donorApp').innerHTML = `
      <div class="dm-shell">
        <aside class="dm-sidebar" id="side">
          <a class="dm-brand" href="/pages/donor/donor-dashboard.html"><span><i class="fa-solid fa-heart-pulse"></i></span><b>LifeLink</b></a>
          <nav class="dm-nav">${nav.map(([href, label, icon]) => href === 'logout.html'
            ? `<button data-logout><i class="fa-solid ${icon}"></i>${label}</button>`
            : `<a class="${location.pathname.endsWith(href) ? 'active' : ''}" href="/pages/donor/${href}"><i class="fa-solid ${icon}"></i>${label}</a>`).join('')}</nav>
        </aside>
        <main class="dm-main">
          <header class="dm-topbar">
            <div class="d-flex align-items-center gap-2"><button class="icon-btn d-xl-none" id="menuBtn"><i class="fa-solid fa-bars"></i></button><div><b>LifeLink</b><div class="small text-muted">Donor Workspace</div></div></div>
            <label class="dm-search"><i class="fa-solid fa-magnifying-glass"></i><input id="q" placeholder="Search ${escapeHtml(title).toLowerCase()}"></label>
            <div class="dm-actions"><span class="plan-chip">Verified Donor</span><select class="form-select form-select-sm language-select" aria-label="Language switch"><option value="en">EN</option><option value="hi">हिंदी</option><option value="pa">ਪੰਜਾਬੀ</option></select><button class="icon-btn" id="theme"><i class="fa-solid fa-moon"></i></button><button class="icon-btn"><i class="fa-solid fa-bell"></i></button></div>
          </header>
          <section class="dm-content"><div class="hero-card"><div><p class="eyebrow">Donor module</p><h1>${escapeHtml(title)}</h1><p class="text-muted mb-0">${escapeHtml(subtitle)}</p></div><div class="quick-grid">${quickActions()}</div></div><div id="view"></div></section>
        </main>
      </div>`;
    LifeLink.initLanguageControls();
  }

  function quickActions() {
    if (mod === 'edit-profile') return '<button class="btn btn-danger" id="saveProfileTop">Save Profile</button>';
    if (mod === 'health') return '<button class="btn btn-danger" id="openHealth">Update Health</button>';
    if (mod === 'medical-reports') return '<button class="btn btn-danger" id="openReport">Upload Report</button>';
    if (mod === 'chat') return '<button class="btn btn-danger" id="focusChat">New Message</button>';
    return '<button class="btn btn-outline-danger" data-refresh>Refresh</button><a class="btn btn-dark" href="/pages/donor/donor-health-tracker.html">Update Health</a>';
  }

  function bindChrome() {
    D.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', LifeLink.logout));
    D.getElementById('menuBtn')?.addEventListener('click', () => D.getElementById('side').classList.toggle('open'));
    D.getElementById('theme').addEventListener('click', () => D.body.classList.toggle('dark-mode'));
    D.querySelector('[data-refresh]')?.addEventListener('click', load);
    D.getElementById('q').addEventListener('input', filterRows);
    D.addEventListener('click', handleClick);
  }

  async function load() {
    try {
      D.getElementById('view').innerHTML = '<div class="metrics"><div class="metric-card"><i class="fa-solid fa-spinner fa-spin"></i><strong>Loading</strong><span class="text-muted">Fetching donor data</span></div></div>';
      const data = await LifeLink.api(`${apiBase}/${endpoints[mod] || mod}`);
      state.data = data;
      state.rows = data.rows || data.tracker || data.rewards || [];
      render(data);
      LifeLink.applyLanguage();
    } catch (error) {
      D.getElementById('view').innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    }
  }

  function render(data) {
    if (mod === 'dashboard') return renderDashboard(data);
    if (mod === 'profile') return renderProfile(data.profile || {});
    if (mod === 'edit-profile') return renderEditProfile(data.profile || {});
    if (mod === 'health') return renderHealth(data);
    if (mod === 'medical-reports') return renderReports(data.rows || []);
    if (mod === 'chat') return renderChat(data.rows || [], data.room);
    if (mod === 'settings') return renderSettings(data.settings || {});
    if (mod === 'referrals') return renderReferrals(data);
    if (mod === 'wallet') return renderWallet(data);
    if (mod === 'rewards') return renderRewards(data);
    renderCards(data.rows || []);
  }

  function renderDashboard(data) {
    const stats = data.stats || {};
    D.getElementById('view').innerHTML = `
      <div class="metrics">${metric('Reward Points', stats.points || 0)}${metric('Appointments', stats.appointments || 0)}${metric('Pending Requests', stats.pendingRequests || 0)}${metric('Donations', stats.donations || 0)}${metric('Eligibility', stats.eligibility || 'review')}${metric('Unread Alerts', stats.unreadNotifications || 0)}</div>
      <div class="layout-grid">
        <section class="panel"><h2>Digital Donor Card</h2><div class="digital-card"><p class="eyebrow text-white-50">LifeLink verified donor</p><h3>${escapeHtml(data.user?.name || 'Donor')}</h3><p>${escapeHtml(data.user?.blood_group || 'Blood group pending')} | ${escapeHtml(data.user?.city || 'City pending')}</p><strong>${escapeHtml(data.card?.donor_id || '')}</strong><div class="small mt-2">QR: ${escapeHtml(data.card?.qr_value || '')}</div></div></section>
        <aside class="panel"><h2>Quick Health Status</h2>${table([data.profile || {}])}</aside>
      </div>`;
  }

  function renderProfile(p) {
    D.getElementById('view').innerHTML = `<section class="panel"><div class="panel-head"><h2>Profile Details</h2><a class="btn btn-danger" href="/pages/donor/donor-edit-profile.html">Edit Profile</a></div>${table([p])}</section>`;
  }

  function renderEditProfile(p) {
    D.getElementById('view').innerHTML = `<section class="panel"><div class="panel-head"><h2>Edit Donor Profile</h2><button class="btn btn-danger" id="saveProfile">Save</button></div><form class="form-grid" id="profileForm">${input('name','Name',p.name)}${input('email','Email',p.email,'email')}${input('mobile','Mobile',p.mobile)}${select('blood_group','Blood Group',p.blood_group,['A+','A-','B+','B-','O+','O-','AB+','AB-'])}${select('gender','Gender',p.gender,['male','female','other'])}${input('date_of_birth','Date of birth',p.date_of_birth,'date')}${input('city','City',p.city)}${input('address','Address',p.address,'text','wide')}${input('latitude','Latitude',p.latitude,'number')}${input('longitude','Longitude',p.longitude,'number')}${select('availability','Availability',p.availability || 'available',['available','busy','unavailable'])}${input('weight_kg','Weight kg',p.weight_kg,'number')}${input('hemoglobin','Hemoglobin',p.hemoglobin,'number')}${input('blood_pressure','Blood pressure',p.blood_pressure)}${input('last_donation_date','Last donation date',p.last_donation_date,'date')}${input('health_notes','Health notes',p.health_notes,'text','wide')}</form></section>`;
    D.getElementById('saveProfile')?.addEventListener('click', saveProfile);
    D.getElementById('saveProfileTop')?.addEventListener('click', saveProfile);
  }

  async function saveProfile() {
    await LifeLink.api(`${apiBase}/profile`, { method: 'PUT', body: JSON.stringify(Object.fromEntries(new FormData(D.getElementById('profileForm')))) });
    LifeLink.toast('Profile saved');
    load();
  }

  function renderHealth(data) {
    D.getElementById('view').innerHTML = `<div class="layout-grid"><section class="panel"><div class="panel-head"><h2>Health Tracker</h2><button class="btn btn-danger" id="saveHealth">Save Health</button></div><form class="form-grid" id="healthForm">${input('weight_kg','Weight kg',data.profile?.weight_kg,'number')}${input('hemoglobin','Hemoglobin',data.profile?.hemoglobin,'number')}${input('blood_pressure','Blood pressure',data.profile?.blood_pressure)}${input('pulse_rate','Pulse rate','','number')}${input('last_donation_date','Last donation date',data.profile?.last_donation_date,'date')}${select('availability','Availability',data.profile?.availability || 'available',['available','busy','unavailable'])}${input('health_notes','Health notes',data.profile?.health_notes,'text','wide')}</form></section><aside class="panel"><h2>Tracker History</h2>${table(data.tracker || [])}</aside></div>`;
    D.getElementById('saveHealth').addEventListener('click', saveHealth);
    D.getElementById('openHealth')?.addEventListener('click', saveHealth);
  }

  async function saveHealth() {
    await LifeLink.api(`${apiBase}/health`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(D.getElementById('healthForm')))) });
    LifeLink.toast('Health tracker updated');
    load();
  }

  function renderReports(rows) {
    D.getElementById('view').innerHTML = `<div class="layout-grid"><section class="panel"><div class="panel-head"><h2>Medical Reports</h2><button class="btn btn-danger" id="uploadReport">Upload</button></div>${table(rows)}</section><aside class="panel"><h2>Upload Report</h2><form id="reportForm"><input class="form-control mb-2" name="report_type" placeholder="Report type"><input class="form-control mb-2" type="file" name="report" required><button class="btn btn-danger w-100">Upload Report</button></form></aside></div>`;
    D.getElementById('reportForm').addEventListener('submit', uploadReport);
    D.getElementById('openReport')?.addEventListener('click', () => D.querySelector('[name="report"]').click());
  }

  async function uploadReport(event) {
    event.preventDefault();
    const response = await fetch(LifeLink.apiUrl(`${apiBase}/medical-reports`), { method: 'POST', headers: LifeLink.authHeaders(), body: new FormData(event.target) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Upload failed');
    LifeLink.toast('Report uploaded');
    load();
  }

  function renderChat(rows, room) {
    D.getElementById('view').innerHTML = `<section class="panel"><h2>Chat Support</h2><div class="card-list mb-3">${rows.length ? rows.map((m) => `<div class="record-card"><div class="avatar"><i class="fa-solid fa-user"></i></div><div>${escapeHtml(m.message)}<div class="small text-muted">${date(m.created_at)}</div></div></div>`).join('') : '<div class="empty">No messages yet.</div>'}</div><form id="chatForm" class="d-flex gap-2"><input class="form-control" name="message" placeholder="Type message" required><button class="btn btn-danger">Send</button></form><div class="small text-muted mt-2">Room: ${escapeHtml(room || '')}</div></section>`;
    D.getElementById('chatForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      await LifeLink.api(`${apiBase}/chat`, { method: 'POST', body: JSON.stringify({ message: new FormData(event.target).get('message') }) });
      event.target.reset();
      load();
    });
  }

  function renderSettings(settings) {
    D.getElementById('view').innerHTML = `<section class="panel"><h2>Donor Settings</h2><form class="form-grid" id="settingsForm">${['email_notifications','sms_notifications','whatsapp_notifications','emergency_alerts','dark_mode'].map((key) => select(key, label(key), settings[key] ?? 1, ['1','0'])).join('')}${select('language','Language',settings.language || 'en',['en','hi'])}<button class="btn btn-danger wide">Save Settings</button></form></section>`;
    D.getElementById('settingsForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      await LifeLink.api(`${apiBase}/settings`, { method: 'PUT', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
      LifeLink.toast('Settings saved');
    });
  }

  function renderReferrals(data) {
    D.getElementById('view').innerHTML = `<div class="metrics">${metric('Referral Code', data.referral_code || 'Not set')}${metric('Invite URL', data.invite_url || '-')}</div><section class="panel"><h2>Referral History</h2>${table(data.rows || [])}</section>`;
  }

  function renderWallet(data) {
    D.getElementById('view').innerHTML = `<div class="metrics">${metric('Wallet Points', data.balance_points || 0)}${metric('Estimated Value', `Rs ${data.balance_rupees || 0}`)}</div><section class="panel"><h2>Wallet Activity</h2>${table(data.rows || [])}</section>`;
  }

  function renderRewards(data) {
    D.getElementById('view').innerHTML = `<div class="metrics">${metric('Total Rewards', data.total || 0)}</div><section class="panel"><h2>Reward Activity</h2>${table(data.rows || [])}</section>`;
  }

  function renderCards(rows) {
    D.getElementById('view').innerHTML = `<div class="layout-grid"><section class="panel"><div class="panel-head"><h2>Live Records</h2><span class="small text-muted">${rows.length} records</span></div><div class="card-list">${rows.length ? rows.map(card).join('') : '<div class="empty">No records found.</div>'}</div></section><aside class="panel"><h2>Map / Context</h2>${mapBox(rows)}</aside></div>`;
    initLeafletMap(rows);
  }

  function card(row) {
    const name = row.title || row.name || row.hospital_name || row.organizer_name || row.reason || `Record #${row.id || ''}`;
    const actions = [];
    if (mod === 'blood-camps' && !Number(row.registered)) actions.push(`<button class="btn btn-sm btn-danger" data-register-camp="${row.id}">Register</button>`);
    if (mod === 'appointments') actions.push(`<button class="btn btn-sm btn-outline-danger" data-cancel-appointment="${row.id}">Cancel</button>`);
    if (mod === 'requests') actions.push(`<button class="btn btn-sm btn-danger" data-request-status="${row.id}" data-status="accepted">Accept</button><button class="btn btn-sm btn-outline-danger" data-request-status="${row.id}" data-status="rejected">Reject</button>`);
    if (mod === 'notifications') actions.push(`<button class="btn btn-sm btn-outline-success" data-read="${row.id}">Read</button><button class="btn btn-sm btn-outline-danger" data-delete="${row.id}">Delete</button>`);
    return `<article class="record-card"><div class="avatar">${initials(name)}</div><div><b>${escapeHtml(name)}</b><div class="small text-muted">${[row.blood_group,row.city,row.venue,row.status,row.appointment_at ? date(row.appointment_at) : ''].filter(Boolean).map(escapeHtml).join(' | ')}</div><span class="badge-soft ${badgeClass(row.status || row.eligibility)}">${escapeHtml(row.status || row.eligibility || row.role || 'active')}</span></div><div>${actions.join(' ')}</div></article>`;
  }

  async function handleClick(event) {
    const camp = event.target.closest('[data-register-camp]');
    const appt = event.target.closest('[data-cancel-appointment]');
    const req = event.target.closest('[data-request-status]');
    const read = event.target.closest('[data-read]');
    const del = event.target.closest('[data-delete]');
    if (camp) return post(`${apiBase}/blood-camps/${camp.dataset.registerCamp}/register`);
    if (appt) return patch(`${apiBase}/appointments/${appt.dataset.cancelAppointment}`, { status: 'cancelled' });
    if (req) return patch(`${apiBase}/requests/${req.dataset.requestStatus}`, { status: req.dataset.status });
    if (read) return patch(`${apiBase}/notifications/${read.dataset.read}`, {});
    if (del) return remove(`${apiBase}/notifications/${del.dataset.delete}`);
  }

  async function post(url) {
    const data = await LifeLink.api(url, { method: 'POST', body: JSON.stringify({}) });
    LifeLink.toast(data.message || 'Saved');
    load();
  }

  async function patch(url, payload) {
    const data = await LifeLink.api(url, { method: 'PATCH', body: JSON.stringify(payload) });
    LifeLink.toast(data.message || 'Updated');
    load();
  }

  async function remove(url) {
    const data = await LifeLink.api(url, { method: 'DELETE' });
    LifeLink.toast(data.message || 'Deleted');
    load();
  }

  function table(rows) {
    if (!rows.length) return '<div class="empty">No records found.</div>';
    const keys = Object.keys(rows[0]).filter((key) => typeof rows[0][key] !== 'object').slice(0, 8);
    return `<div class="table-responsive"><table class="table"><thead><tr>${keys.map((key) => `<th>${label(key)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${keys.map((key) => `<td>${format(row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function metric(name, value) { return `<div class="metric-card"><i class="fa-solid fa-chart-simple"></i><strong>${escapeHtml(value)}</strong><span class="text-muted">${escapeHtml(name)}</span></div>`; }
  function input(name, text, value = '', type = 'text', cls = '') { return `<label class="${cls}"><span class="small text-muted">${escapeHtml(text)}</span><input class="form-control" name="${name}" type="${type}" value="${escapeAttr(dateInput(value, type))}"></label>`; }
  function select(name, text, value, options) { return `<label><span class="small text-muted">${escapeHtml(text)}</span><select class="form-select" name="${name}">${options.map((option) => `<option value="${escapeAttr(option)}" ${String(option) === String(value) ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></label>`; }
  function mapBox(rows = []) { return `<div class="map-box" id="donorModuleMap">${rows.slice(0, 10).map((_, i) => `<span class="pin ${i % 3 === 1 ? 'blue' : i % 3 === 2 ? 'green' : ''}" style="left:${18 + (i * 17) % 70}%;top:${22 + (i * 23) % 60}%"></span>`).join('')}<div class="small text-muted p-3">Loading global map...</div></div>`; }
  async function initLeafletMap(rows = []) {
    const element = D.getElementById('donorModuleMap');
    if (!element) return;
    try {
      const config = await LifeLink.api('/api/config');
      if ((config.mapProvider || 'leaflet') !== 'leaflet') return;
      await ensureLeaflet();
      element.innerHTML = '';
      const points = rows
        .map((row, index) => ({
          lat: Number(row.latitude || row.lat),
          lng: Number(row.longitude || row.lng),
          label: row.name || row.hospital_name || row.title || row.venue || `Location ${index + 1}`,
          type: row.role || row.type || 'hospital'
        }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
      const center = points[0] || { lat: 28.6139, lng: 77.2090 };
      const map = L.map(element, { zoomControl: true }).setView([center.lat, center.lng], points.length ? 11 : 5);
      L.tileLayer(config.mapTileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: config.mapAttribution || '&copy; OpenStreetMap contributors'
      }).addTo(map);
      points.forEach((point) => {
        const color = point.type === 'blood_bank' ? '#12a376' : '#2563eb';
        L.circleMarker([point.lat, point.lng], { radius: 9, color, fillColor: color, fillOpacity: 0.9 }).addTo(map).bindPopup(escapeHtml(point.label));
      });
      if (points.length > 1) map.fitBounds(points.map((point) => [point.lat, point.lng]), { padding: [24, 24] });
      if (!points.length) L.popup().setLatLng([center.lat, center.lng]).setContent('Add hospital latitude and longitude to show live nearby markers.').openOn(map);
    } catch (error) {
      element.innerHTML = `<div class="empty">Map unavailable: ${escapeHtml(error.message)}</div>`;
    }
  }
  function ensureLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (!D.querySelector('link[data-leaflet]')) {
        const link = D.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
        link.dataset.leaflet = 'true';
        D.head.appendChild(link);
      }
      const existing = D.querySelector('script[data-leaflet]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = D.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
      script.dataset.leaflet = 'true';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Leaflet map library failed to load'));
      D.head.appendChild(script);
    });
  }
  function filterRows() { const q = D.getElementById('q').value.toLowerCase(); D.querySelectorAll('.record-card,tr').forEach((el) => { el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none'; }); }
  function badgeClass(value = '') { return ['accepted','completed','eligible','active','available'].includes(String(value)) ? 'ok' : ['pending','scheduled','review'].includes(String(value)) ? 'warn' : 'danger'; }
  function date(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value || '-') : d.toLocaleString('en-IN'); }
  function dateInput(value, type) { if (!value || !type.includes('date')) return value || ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toISOString().slice(0, 10); }
  function format(value) { if (value === null || value === undefined || value === '') return '-'; if (String(value).match(/T\d{2}:\d{2}/)) return date(value); return escapeHtml(String(value).slice(0, 90)); }
  function label(value) { return String(value).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()); }
  function initials(value = 'LL') { return String(value).split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase(); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
  function escapeAttr(value) { return escapeHtml(value).replace(/"/g, '&quot;'); }
})();
