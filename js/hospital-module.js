const HospitalModule = (() => {
  const D = document;
  const mod = D.body.dataset.module;
  const title = D.body.dataset.title;
  const subtitle = D.body.dataset.subtitle;
  const apiBase = '/api/hospital';
  const state = { rows: [], data: {}, total: 0, offset: 0, limit: 10, charts: [] };

  const nav = [
    ['hospital-dashboard.html', 'Dashboard', 'fa-gauge-high'],
    ['hospital-profile.html', 'Hospital Profile', 'fa-hospital'],
    ['search-donors.html', 'Search Donors', 'fa-magnifying-glass'],
    ['blood-request.html', 'Blood Requests', 'fa-droplet'],
    ['emergency-request.html', 'Emergency Requests', 'fa-truck-medical'],
    ['blood-inventory.html', 'Blood Inventory', 'fa-boxes-stacked'],
    ['rare-blood-group.html', 'Rare Blood Groups', 'fa-star-of-life'],
    ['appointments.html', 'Appointments', 'fa-calendar-check'],
    ['donation-records.html', 'Donation Records', 'fa-clipboard-list'],
    ['nearby-centers.html', 'Nearby Centers', 'fa-map-location-dot'],
    ['smart-matching.html', 'Smart Matching', 'fa-brain'],
    ['live-tracking.html', 'Live Tracking', 'fa-route'],
    ['notifications.html', 'Notifications', 'fa-bell'],
    ['chat-system.html', 'Chat System', 'fa-comments'],
    ['hospital-reports.html', 'Reports', 'fa-chart-line'],
    ['ai-prediction.html', 'AI Prediction', 'fa-wand-magic-sparkles'],
    ['subscription-plan.html', 'Subscription', 'fa-crown'],
    ['payment-history.html', 'Payments', 'fa-credit-card'],
    ['invoice.html', 'Invoices', 'fa-file-invoice'],
    ['staff-management.html', 'Staff', 'fa-users-gear'],
    ['branch-management.html', 'Branches', 'fa-building'],
    ['settings.html', 'Settings', 'fa-gear'],
    ['support.html', 'Support', 'fa-life-ring'],
    ['logout.html', 'Logout', 'fa-right-from-bracket']
  ];

  const endpoints = {
    inventory: 'inventory',
    availability: 'availability',
    'donor-requests': 'donor-requests',
    'blood-requests': 'blood-requests',
    'emergency-requests': 'emergency-requests',
    'rare-blood': 'rare-blood',
    appointments: 'appointments',
    'donation-records': 'donation-records',
    'nearby-centers': 'nearby-centers',
    'smart-matching': 'smart-matching',
    'live-tracking': 'live-tracking',
    notifications: 'notifications',
    chat: 'chat',
    reports: 'reports',
    'ai-prediction': 'ai-prediction',
    subscription: 'subscription',
    payments: 'payments',
    invoices: 'invoices',
    staff: 'staff',
    branches: 'branches',
    settings: 'settings',
    support: 'support'
  };

  const createFields = {
    inventory: [
      ['blood_group', 'Blood group', 'select', ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']],
      ['units', 'Units', 'number'],
      ['expires_on', 'Expiry date', 'date']
    ],
    'blood-requests': [
      ['patient_name', 'Patient name'],
      ['blood_group', 'Blood group', 'select', ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']],
      ['units_needed', 'Units needed', 'number'],
      ['urgency', 'Urgency', 'select', ['normal', 'urgent', 'critical']],
      ['needed_by', 'Required date/time', 'datetime-local'],
      ['city', 'City'],
      ['contact_mobile', 'Contact mobile']
    ],
    'donor-requests': [
      ['donor_id', 'Donor user ID', 'number'],
      ['blood_group', 'Blood group', 'select', ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']],
      ['message', 'Request message', 'textarea']
    ],
    'emergency-requests': [
      ['patient_name', 'Patient name'],
      ['blood_group', 'Blood group', 'select', ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']],
      ['units_needed', 'Units needed', 'number'],
      ['emergency_level', 'Emergency level', 'select', ['critical', 'high', 'medium', 'low']],
      ['time_limit_minutes', 'Time limit minutes', 'number'],
      ['city', 'City'],
      ['contact_mobile', 'Contact mobile'],
      ['needed_by', 'Needed by', 'datetime-local']
    ],
    appointments: [
      ['donor_id', 'Donor user ID', 'number'],
      ['request_id', 'Blood request ID', 'number'],
      ['appointment_at', 'Appointment date/time', 'datetime-local'],
      ['notes', 'Notes', 'textarea']
    ],
    'donation-records': [
      ['donor_id', 'Donor user ID', 'number'],
      ['appointment_id', 'Appointment ID', 'number'],
      ['blood_group', 'Blood group', 'select', ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']],
      ['units', 'Units', 'number'],
      ['donation_date', 'Donation date', 'date']
    ],
    chat: [['message', 'Message', 'textarea']],
    staff: [
      ['staff_name', 'Staff name'],
      ['role_title', 'Role', 'select', ['Doctor', 'Admin', 'Blood manager', 'Nurse', 'Lab technician']],
      ['email', 'Email', 'email'],
      ['mobile', 'Mobile'],
      ['department', 'Department'],
      ['shift_name', 'Shift'],
      ['status', 'Status', 'select', ['active', 'inactive', 'on_leave']]
    ],
    branches: [
      ['branch_name', 'Branch name'],
      ['branch_type', 'Branch type'],
      ['phone', 'Phone'],
      ['city', 'City'],
      ['address', 'Address', 'textarea'],
      ['latitude', 'Latitude', 'number'],
      ['longitude', 'Longitude', 'number'],
      ['status', 'Status', 'select', ['active', 'inactive']]
    ],
    support: [
      ['subject', 'Subject'],
      ['message', 'Message', 'textarea'],
      ['priority', 'Priority', 'select', ['low', 'medium', 'high', 'urgent']]
    ]
  };

  const editableFields = {
    inventory: ['blood_group', 'units', 'expires_on'],
    'donor-requests': ['status', 'message'],
    'blood-requests': ['patient_name', 'blood_group', 'units_needed', 'urgency', 'status', 'needed_by', 'city', 'contact_mobile'],
    'emergency-requests': ['patient_name', 'blood_group', 'units_needed', 'status', 'city', 'contact_mobile', 'needed_by'],
    appointments: ['appointment_at', 'status', 'notes'],
    'donation-records': ['donor_id', 'appointment_id', 'blood_group', 'units', 'donation_date'],
    staff: ['staff_name', 'email', 'mobile', 'role_title', 'department', 'shift_name', 'status', 'tasks_completed'],
    branches: ['branch_name', 'branch_type', 'phone', 'city', 'address', 'latitude', 'longitude', 'status'],
    support: ['subject', 'message', 'priority', 'status']
  };

  D.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (mod === 'logout') return LifeLink.logout();
    LifeLink.requireRole(['hospital', 'admin', 'super_admin']);
    renderShell();
    bindChrome();
    await load();
  }

  function renderShell() {
    D.getElementById('hospitalApp').innerHTML = `
      <div class="hm-shell">
        <aside class="hm-sidebar" id="side">
          <a class="hm-brand" href="/pages/hospital/hospital-dashboard.html"><span><i class="fa-solid fa-heart-pulse"></i></span><b>LifeLink</b></a>
          <nav class="hm-nav">${nav.map(([href, label, icon]) => href === 'logout.html'
            ? `<button data-logout><i class="fa-solid ${icon}"></i>${label}</button>`
            : `<a class="${location.pathname.endsWith(href) ? 'active' : ''}" href="/pages/hospital/${href}" title="${label}"><i class="fa-solid ${icon}"></i><span>${label}</span></a>`).join('')}</nav>
        </aside>
        <main class="hm-main">
          <header class="hm-topbar">
            <div class="d-flex align-items-center gap-2"><button class="icon-btn d-xl-none" id="menuBtn"><i class="fa-solid fa-bars"></i></button><div><b>LifeLink</b><div class="small text-muted">Hospital Workspace</div></div></div>
            <label class="hm-search"><i class="fa-solid fa-magnifying-glass"></i><input id="q" placeholder="Search ${escapeHtml(title).toLowerCase()}"></label>
            <div class="hm-actions"><span class="plan-chip">Pro Active</span><select class="form-select form-select-sm language-select" aria-label="Language switch"><option value="en">EN</option><option value="hi">हिंदी</option><option value="pa">ਪੰਜਾਬੀ</option></select><button class="icon-btn" id="theme"><i class="fa-solid fa-moon"></i></button><button class="icon-btn"><i class="fa-solid fa-bell"></i></button><button class="icon-btn"><i class="fa-solid fa-message"></i></button></div>
          </header>
          <section class="hm-content">
            <div class="hero-card">
              <div><p class="eyebrow">Hospital module</p><h1>${escapeHtml(title)}</h1><p class="text-muted mb-0">${escapeHtml(subtitle)}</p></div>
              <div class="quick-grid">${actionButtons()}</div>
            </div>
            <div id="view"></div>
          </section>
        </main>
      </div>`;
    LifeLink.initLanguageControls();
  }

  function actionButtons() {
    const canCreate = Boolean(createFields[mod]);
    return `${canCreate ? '<button class="btn btn-danger" data-action="create">Create</button>' : ''}<button class="btn btn-outline-danger" data-action="refresh">Refresh</button><button class="btn btn-dark" data-action="export">Export</button>`;
  }

  function bindChrome() {
    D.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', LifeLink.logout));
    D.getElementById('theme').addEventListener('click', () => D.body.classList.toggle('dark-mode'));
    D.getElementById('menuBtn')?.addEventListener('click', () => D.getElementById('side').classList.toggle('open'));
    D.getElementById('q').addEventListener('input', debounce(() => {
      state.offset = 0;
      load();
    }, 300));
    D.querySelector('[data-action="refresh"]').addEventListener('click', load);
    D.querySelector('[data-action="export"]').addEventListener('click', exportCsv);
    D.querySelector('[data-action="create"]')?.addEventListener('click', () => openCreate());
    D.addEventListener('click', handlePageAction);
  }

  async function load() {
    try {
      skeleton();
      const query = new URLSearchParams({ limit: state.limit, offset: state.offset, q: D.getElementById('q')?.value || '' });
      const data = await LifeLink.api(`${apiBase}/${endpoint()}?${query}`);
      state.data = data;
      state.rows = data.rows || data.inventory || data.summary || data.notifications || [];
      state.total = Number(data.total || state.rows.length || 0);
      render(data);
      LifeLink.applyLanguage();
    } catch (error) {
      D.getElementById('view').innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    }
  }

  function endpoint() {
    return endpoints[mod] || mod;
  }

  function render(data) {
    destroyCharts();
    if (mod === 'settings') return renderSettings(data.settings || {});
    if (mod === 'chat') return renderChat(data.rows || [], data.room);
    if (mod === 'reports') return renderReports(data);
    if (mod === 'ai-prediction') return renderPrediction(data.rows || []);
    if (mod === 'availability' || mod === 'inventory') return renderInventory(data.rows || data.summary || []);
    if (['rare-blood', 'smart-matching', 'live-tracking', 'nearby-centers'].includes(mod)) return renderCards(data.rows || []);
    if (mod === 'subscription') return renderSubscription(data);
    renderTable(data.rows || []);
  }

  function renderTable(rows) {
    D.getElementById('view').innerHTML = `
      <section class="panel">
        <div class="panel-head"><div><h2>${escapeHtml(title)} Records</h2><p class="text-muted mb-0 small">${state.total} records from MySQL</p></div></div>
        ${table(rows)}
        ${pager()}
      </section>`;
    bindPager();
  }

  function table(rows) {
    if (!rows.length) return '<div class="empty">No records found. Create the first record to begin.</div>';
    const keys = visibleKeys(rows[0]);
    return `<div class="table-responsive"><table class="table align-middle"><thead><tr>${keys.map((key) => `<th>${label(key)}</th>`).join('')}<th>Actions</th></tr></thead><tbody>${rows.map((row) => `<tr>${keys.map((key) => `<td>${formatValue(row[key], key)}</td>`).join('')}<td class="text-nowrap">${rowActions(row)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function rowActions(row) {
    const id = row.id;
    const actions = ['<button class="btn btn-sm btn-outline-dark" data-view="' + id + '">View</button>'];
    if (editableFields[mod]) actions.push('<button class="btn btn-sm btn-outline-danger" data-edit="' + id + '">Edit</button>', '<button class="btn btn-sm btn-outline-danger" data-delete="' + id + '">Delete</button>');
    if (mod === 'emergency-requests') actions.push('<button class="btn btn-sm btn-danger" data-broadcast="' + id + '">Broadcast</button>');
    if (mod === 'notifications') actions.push('<button class="btn btn-sm btn-outline-success" data-read="' + id + '">Mark Read</button>', '<button class="btn btn-sm btn-outline-danger" data-delete="' + id + '">Delete</button>');
    if (mod === 'invoices' && row.download_url) actions.push('<a class="btn btn-sm btn-danger" href="' + row.download_url + '">Download</a>');
    return actions.join(' ');
  }

  function renderInventory(rows) {
    const summary = mod === 'inventory' ? state.data.summary || [] : rows;
    D.getElementById('view').innerHTML = `
      <div class="metrics">${summary.map((item) => metric(item.blood_group, `${item.units ?? item.available_units ?? 0} units`, stockClass(item.units ?? item.available_units))).join('')}</div>
      <div class="layout-grid">
        <section class="panel"><div class="panel-head"><h2>${mod === 'inventory' ? 'Stock CRUD' : 'Live Availability'}</h2></div>${table(rows)}</section>
        <aside class="panel"><h2>Stock Analytics</h2><div class="chart-box"><canvas id="mainChart"></canvas></div></aside>
      </div>`;
    chart(summary.map((x) => x.blood_group), summary.map((x) => Number(x.units ?? x.available_units ?? 0)));
  }

  function renderCards(rows) {
    D.getElementById('view').innerHTML = `
      <div class="layout-grid">
        <section class="panel"><div class="panel-head"><div><h2>Live Results</h2><p class="text-muted mb-0 small">${rows.length} records</p></div></div><div class="card-list">${rows.length ? rows.map(card).join('') : '<div class="empty">No live records found.</div>'}</div>${pager()}</section>
        <aside class="panel"><h2>${mod === 'live-tracking' ? 'Live Route Map' : 'Map View'}</h2>${mapBox(rows)}${mod === 'smart-matching' ? '<div class="mt-3 alert alert-danger border-0">AI ranks donors by eligibility, availability, health score and urgency.</div>' : ''}</aside>
      </div>`;
    bindPager();
    initLeafletMap(rows);
  }

  function card(row) {
    const name = row.name || row.branch_name || row.blood_group || row.subject || `Record #${row.id || ''}`;
    const donorAction = ['smart-matching', 'rare-blood', 'live-tracking'].includes(mod) && row.id
      ? `<button class="btn btn-sm btn-success" data-whatsapp="${row.id}"><i class="fa-brands fa-whatsapp"></i> WhatsApp</button>`
      : '';
    return `<article class="record-card"><div class="avatar">${initials(name)}</div><div><b>${escapeHtml(name)}</b><div class="small text-muted">${[row.blood_group, row.city, row.role, row.distance_km ? `${row.distance_km} km` : '', row.eta_minutes ? `${row.eta_minutes} min ETA` : ''].filter(Boolean).map(escapeHtml).join(' | ')}</div><span class="badge-soft ${row.eligibility === 'eligible' || row.availability === 'available' ? 'ok' : 'warn'}">${escapeHtml(row.eligibility || row.availability || row.status || row.role || 'active')}</span></div><div class="d-flex flex-wrap gap-2 justify-content-end">${donorAction}${row.phone ? `<a class="btn btn-sm btn-outline-dark" href="tel:${escapeAttr(row.phone)}">Call</a>` : ''} ${row.id ? `<button class="btn btn-sm btn-danger" data-view="${row.id}">View</button>` : ''}</div></article>`;
  }

  function renderChat(rows, room) {
    D.getElementById('view').innerHTML = `<section class="panel"><div class="panel-head"><div><h2>Real-time Chat</h2><p class="small text-muted mb-0">Room: ${escapeHtml(room || '')}</p></div></div><div class="card-list mb-3" id="chatBox">${rows.length ? rows.map((m) => `<div class="record-card"><div class="avatar"><i class="fa-solid fa-user"></i></div><div>${escapeHtml(m.message)}<div class="small text-muted">${date(m.created_at)}</div></div></div>`).join('') : '<div class="empty">No messages yet.</div>'}</div><form id="chatForm" class="d-flex gap-2"><input class="form-control" name="message" placeholder="Type message" required><button class="btn btn-danger">Send</button></form></section>`;
    D.getElementById('chatForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      await LifeLink.api(`${apiBase}/chat`, { method: 'POST', body: JSON.stringify({ message: new FormData(event.target).get('message') }) });
      event.target.reset();
      load();
    });
  }

  function renderReports(data) {
    D.getElementById('view').innerHTML = `<div class="metrics">${metric('Blood Requests', data.requests || 0)}${metric('Emergencies', data.emergencies || 0)}${metric('Export', 'PDF / Excel')}${metric('Inventory Groups', (data.inventory || []).length)}</div><section class="panel"><div class="panel-head"><h2>Analytics</h2><button class="btn btn-danger" data-action="export">Export CSV</button></div><div class="chart-grid"><div class="chart-box"><canvas id="mainChart"></canvas></div><div class="chart-box"><canvas id="secondChart"></canvas></div></div></section>`;
    chart((data.inventory || []).map((x) => x.blood_group), (data.inventory || []).map((x) => x.units));
    chart(['Requests', 'Emergencies'], [data.requests || 0, data.emergencies || 0], 'secondChart', '#2563eb');
  }

  function renderPrediction(rows) {
    D.getElementById('view').innerHTML = `<div class="card-list">${rows.length ? rows.map((row) => `<article class="record-card"><div class="avatar">${escapeHtml(row.blood_group)}</div><div><b>${escapeHtml(row.prediction)}</b><div class="small text-muted">Confidence ${row.confidence}% | ${escapeHtml(row.action)}</div><div class="progress mt-2"><div class="progress-bar bg-danger" style="width:${row.confidence}%"></div></div></div><button class="btn btn-sm btn-danger">Notify Donors</button></article>`).join('') : '<div class="empty">No prediction data. Add inventory first.</div>'}</div>`;
  }

  function renderSubscription(data) {
    D.getElementById('view').innerHTML = `<div class="metrics">${Object.entries(data.plans || {}).map(([key, plan]) => `<div class="metric-card"><i class="fa-solid fa-crown"></i><strong>${escapeHtml(plan.name)}</strong><span class="text-muted">Rs ${(plan.amount / 100).toLocaleString('en-IN')}</span><button class="btn btn-danger mt-3" data-plan="${key}">Subscribe</button></div>`).join('')}</div><section class="panel"><h2>Current Subscription</h2>${table(data.subscription ? [data.subscription] : [])}</section>`;
    D.querySelectorAll('[data-plan]').forEach((button) => button.addEventListener('click', () => subscribe(button.dataset.plan)));
  }

  function renderSettings(settings) {
    D.getElementById('view').innerHTML = `<section class="panel"><div class="panel-head"><div><h2>Security & Notification Settings</h2><p class="small text-muted mb-0">Controls are saved to MySQL and used by hospital workflows.</p></div></div><form class="form-grid" id="settingsForm">${['emergency_24x7', 'email_notifications', 'sms_notifications', 'whatsapp_notifications', 'two_factor_enabled', 'dark_mode', 'auto_renew', 'location_sharing', 'staff_approval_required'].map((key) => selectInput(key, label(key), ['1', '0'], settings[key] ?? 1)).join('')}${selectInput('otp_channel', 'OTP channel', ['both', 'email', 'sms'], settings.otp_channel || 'both')}${selectInput('payment_reminder_days', 'Payment reminder days', ['7', '3', '1'], settings.payment_reminder_days || '7')}${selectInput('language', 'Language', ['en', 'hi'], settings.language || 'en')}<button class="btn btn-danger wide">Save Settings</button></form></section>`;
    D.getElementById('settingsForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      await LifeLink.api(`${apiBase}/settings`, { method: 'PUT', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
      LifeLink.toast('Settings saved');
      load();
    });
  }

  async function handlePageAction(event) {
    const view = event.target.closest('[data-view]');
    const edit = event.target.closest('[data-edit]');
    const del = event.target.closest('[data-delete]');
    const read = event.target.closest('[data-read]');
    const broadcast = event.target.closest('[data-broadcast]');
    const whatsapp = event.target.closest('[data-whatsapp]');
    if (whatsapp) return openWhatsAppModal(rowById(whatsapp.dataset.whatsapp));
    if (view) return openView(rowById(view.dataset.view));
    if (edit) return openEdit(rowById(edit.dataset.edit));
    if (del) return deleteRow(del.dataset.delete);
    if (read) return patchRow(read.dataset.read, { read_at: new Date().toISOString() }, 'notifications');
    if (broadcast) return broadcastEmergency(broadcast.dataset.broadcast);
  }

  function openCreate() {
    const fields = createFields[mod];
    if (!fields) return;
    openForm(`Create ${title}`, fields, {}, async (payload) => {
      await LifeLink.api(`${apiBase}/${endpoint()}`, { method: 'POST', body: JSON.stringify(payload) });
      LifeLink.toast('Record created');
      load();
    });
  }

  function openEdit(row) {
    if (!row) return;
    const fields = editableFields[mod].map((key) => [key, label(key), fieldType(key)]);
    openForm(`Edit ${title}`, fields, row, async (payload) => patchRow(row.id, payload));
  }

  function openView(row) {
    if (!row) return;
    modal('Record Details', `<div class="table-responsive"><table class="table">${Object.entries(row).map(([key, value]) => `<tr><th>${label(key)}</th><td>${formatValue(value, key)}</td></tr>`).join('')}</table></div>`);
  }

  async function patchRow(id, payload, forcedEndpoint) {
    await LifeLink.api(`${apiBase}/${forcedEndpoint || endpoint()}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    LifeLink.toast('Record updated');
    load();
  }

  async function deleteRow(id) {
    if (!confirm('Delete this record?')) return;
    await LifeLink.api(`${apiBase}/${endpoint()}/${id}`, { method: 'DELETE' });
    LifeLink.toast('Record deleted');
    load();
  }

  async function broadcastEmergency(id) {
    await LifeLink.api(`${apiBase}/emergency-requests/${id}/broadcast`, { method: 'POST', body: JSON.stringify({}) });
    LifeLink.toast('Emergency broadcast sent');
    load();
  }

  function openWhatsAppModal(donor) {
    if (!donor) return LifeLink.toast('Donor record not found', 'error');
    const message = `LifeLink urgent donor alert: ${donor.blood_group || 'Compatible'} blood support is needed. Please confirm your availability from your LifeLink donor dashboard or contact the hospital.`;
    const waUrl = whatsappUrl(donor.phone, message);
    modal('Send WhatsApp Message', `
      <form id="whatsappForm" class="form-grid">
        <label><span class="small text-muted">Donor</span><input class="form-control" value="${escapeAttr(donor.name || 'Donor')}" disabled></label>
        <label><span class="small text-muted">Phone</span><input class="form-control" value="${escapeAttr(donor.phone || 'Phone not available')}" disabled></label>
        <label><span class="small text-muted">Blood group</span><input class="form-control" value="${escapeAttr(donor.blood_group || '')}" disabled></label>
        <label class="wide"><span class="small text-muted">WhatsApp message</span><textarea class="form-control" name="message" rows="5" minlength="12" required>${escapeHtml(message)}</textarea></label>
        <div class="wide d-flex flex-wrap gap-2 align-items-center">
          ${waUrl ? `<a class="btn btn-success" id="openWhatsAppLink" href="${escapeAttr(waUrl)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Open WhatsApp</a>` : '<button class="btn btn-secondary" disabled>Phone number missing</button>'}
          <span class="small text-muted">This opens WhatsApp with the message ready. The red Save button also logs/sends via backend when Twilio is configured.</span>
        </div>
      </form>
      <div id="whatsappResult" class="mt-3"></div>
    `, async () => {
      const payload = {
        donor_ids: [donor.id],
        blood_group: donor.blood_group || '',
        message: new FormData(D.getElementById('whatsappForm')).get('message'),
        subject: 'LifeLink urgent blood donation request',
        channels: ['whatsapp'],
        limit: 1
      };
      const response = await LifeLink.api('/api/dashboard/hospital/donor-alert', { method: 'POST', body: JSON.stringify(payload) });
      const delivery = response.results?.[0]?.delivery || [];
      LifeLink.toast(response.message || 'WhatsApp alert processed', 'success');
      D.getElementById('whatsappResult').innerHTML = `<div class="alert alert-info mb-0">${delivery.map((item) => `${escapeHtml(item.channel)}: ${escapeHtml(item.status)}`).join('<br>') || escapeHtml(response.message)}</div>`;
    });
    setTimeout(() => {
      D.getElementById('whatsappForm')?.querySelector('[name="message"]')?.addEventListener('input', (event) => {
        const link = D.getElementById('openWhatsAppLink');
        if (link) link.href = whatsappUrl(donor.phone, event.target.value);
      });
    }, 0);
  }

  function whatsappUrl(phone, message) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    const normalized = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${normalized}?text=${encodeURIComponent(message || '')}`;
  }

  async function subscribe(plan) {
    const data = await LifeLink.api(`${apiBase}/subscription/subscribe`, { method: 'POST', body: JSON.stringify({ plan }) });
    LifeLink.toast(`${data.provider === 'cashfree' ? 'Cashfree' : 'Razorpay'} order created: ${data.order.order_id || data.order.id}`, 'info');
  }

  function openForm(heading, fields, values, onSave) {
    modal(heading, `<form id="moduleForm" class="form-grid">${fields.map(([name, text, type, options]) => field(name, text, type, values[name], options)).join('')}</form>`, onSave ? async () => {
      await onSave(Object.fromEntries(new FormData(D.getElementById('moduleForm'))));
    } : null);
  }

  function modal(heading, body, onSave) {
    const element = D.createElement('div');
    element.className = 'modal fade';
    element.innerHTML = `<div class="modal-dialog modal-lg modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5>${escapeHtml(heading)}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body">${body}</div><div class="modal-footer"><button class="btn btn-light" data-bs-dismiss="modal">Close</button>${onSave ? '<button class="btn btn-danger" id="modalSave">Save</button>' : ''}</div></div></div>`;
    D.body.appendChild(element);
    const instance = new bootstrap.Modal(element);
    element.addEventListener('hidden.bs.modal', () => element.remove());
    element.querySelector('#modalSave')?.addEventListener('click', async () => {
      await onSave();
      instance.hide();
    });
    instance.show();
  }

  function field(name, text, type = 'text', value = '', options = []) {
    if (type === 'textarea') return `<label class="wide"><span class="small text-muted">${escapeHtml(text)}</span><textarea class="form-control" name="${name}">${escapeHtml(value || '')}</textarea></label>`;
    if (type === 'select') return selectInput(name, text, options, value);
    return `<label><span class="small text-muted">${escapeHtml(text)}</span><input class="form-control" name="${name}" type="${type}" value="${escapeAttr(dateInput(value, type))}"></label>`;
  }

  function selectInput(name, text, options, value) {
    return `<label><span class="small text-muted">${escapeHtml(text)}</span><select class="form-select" name="${name}">${options.map((option) => `<option value="${escapeAttr(option)}" ${String(option) === String(value) ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></label>`;
  }

  function metric(labelText, value, cls = '') {
    return `<div class="metric-card"><i class="fa-solid fa-chart-simple"></i><strong>${escapeHtml(value)}</strong><span class="text-muted">${escapeHtml(labelText)} ${cls ? `(${cls})` : ''}</span></div>`;
  }

  function mapBox(rows = []) {
    return `<div class="map-box" id="moduleMap">${rows.slice(0, 10).map((row, index) => `<span class="pin ${index % 3 === 1 ? 'blue' : index % 3 === 2 ? 'green' : ''}" style="left:${18 + (index * 17) % 70}%;top:${22 + (index * 23) % 60}%"></span>`).join('')}<div class="small text-muted p-3">Loading global map...</div></div>`;
  }

  async function initLeafletMap(rows = []) {
    const element = D.getElementById('moduleMap');
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
          label: row.name || row.branch_name || row.hospital_name || row.blood_group || `Location ${index + 1}`,
          type: row.type || row.category || (mod === 'nearby-centers' ? 'center' : 'donor')
        }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
      const center = points[0] || { lat: 28.6139, lng: 77.2090 };
      const map = L.map(element, { zoomControl: true }).setView([center.lat, center.lng], points.length ? 11 : 5);
      L.tileLayer(config.mapTileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: config.mapAttribution || '&copy; OpenStreetMap contributors'
      }).addTo(map);
      points.forEach((point) => {
        L.circleMarker([point.lat, point.lng], {
          radius: 9,
          color: point.type === 'blood_bank' ? '#12a376' : point.type === 'hospital' || point.type === 'center' ? '#2563eb' : '#e9194f',
          fillColor: point.type === 'blood_bank' ? '#12a376' : point.type === 'hospital' || point.type === 'center' ? '#2563eb' : '#e9194f',
          fillOpacity: 0.88
        }).addTo(map).bindPopup(escapeHtml(point.label));
      });
      if (points.length > 1) map.fitBounds(points.map((point) => [point.lat, point.lng]), { padding: [24, 24] });
      if (!points.length) {
        L.popup().setLatLng([center.lat, center.lng]).setContent('Add verified latitude and longitude to show live markers.').openOn(map);
      }
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

  function chart(labels, data, id = 'mainChart', color = '#e9194f') {
    setTimeout(() => {
      const canvas = D.getElementById(id);
      if (!canvas || !window.Chart) return;
      state.charts.push(new Chart(canvas, { type: 'bar', data: { labels, datasets: [{ data, label: 'Live data', backgroundColor: color, borderRadius: 8 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } }));
    }, 0);
  }

  function destroyCharts() {
    state.charts.forEach((chart) => chart.destroy());
    state.charts = [];
  }

  function pager() {
    return `<div class="pagination-row"><button class="btn btn-outline-dark btn-sm" id="prevPage">Previous</button><span class="text-muted">Showing ${state.rows.length} of ${state.total}</span><button class="btn btn-outline-dark btn-sm" id="nextPage">Next</button></div>`;
  }

  function bindPager() {
    D.getElementById('prevPage')?.addEventListener('click', () => {
      state.offset = Math.max(0, state.offset - state.limit);
      load();
    });
    D.getElementById('nextPage')?.addEventListener('click', () => {
      if (state.offset + state.limit < state.total) {
        state.offset += state.limit;
        load();
      }
    });
  }

  function exportCsv() {
    const rows = state.rows.length ? state.rows : [state.data];
    if (!rows.length) return LifeLink.toast('No rows to export', 'warning');
    const keys = Object.keys(rows[0]).filter((key) => typeof rows[0][key] !== 'object');
    const csv = [keys, ...rows.map((row) => keys.map((key) => row[key]))].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = D.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `lifelink-${mod}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function visibleKeys(row) {
    return Object.keys(row).filter((key) => !['updated_at'].includes(key) && typeof row[key] !== 'object').slice(0, 8);
  }

  function rowById(id) {
    return state.rows.find((row) => String(row.id) === String(id));
  }

  function fieldType(key) {
    if (key.includes('date') || key.endsWith('_on')) return 'date';
    if (key.includes('_at') || key === 'needed_by' || key === 'appointment_at') return 'datetime-local';
    if (key.includes('units') || key.includes('latitude') || key.includes('longitude') || key.includes('tasks')) return 'number';
    if (key === 'status') return 'text';
    return 'text';
  }

  function dateInput(value, type) {
    if (!value || !String(type).includes('date')) return value || '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    if (type === 'datetime-local') return date.toISOString().slice(0, 16);
    return date.toISOString().slice(0, 10);
  }

  function formatValue(value, key) {
    if (value === null || value === undefined || value === '') return '-';
    if (String(key).includes('amount_paise')) return `Rs ${(Number(value) / 100).toLocaleString('en-IN')}`;
    if (String(key).includes('date') || String(key).includes('_at') || String(key).includes('_on')) return date(value);
    if (String(value).length > 70) return `${escapeHtml(String(value).slice(0, 70))}...`;
    return escapeHtml(value);
  }

  function stockClass(units = 0) {
    const n = Number(units || 0);
    if (n <= 3) return 'critical';
    if (n <= 8) return 'low';
    return 'healthy';
  }

  function skeleton() {
    D.getElementById('view').innerHTML = '<div class="metrics"><div class="metric-card"><i class="fa-solid fa-spinner fa-spin"></i><strong>Loading</strong><span class="text-muted">Fetching live data</span></div></div>';
  }

  function label(value) {
    return String(value).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function initials(value = 'LL') {
    return String(value).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }

  function date(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? escapeHtml(value) : d.toLocaleString('en-IN');
  }

  function debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
  }

  return { openCreate };
})();
