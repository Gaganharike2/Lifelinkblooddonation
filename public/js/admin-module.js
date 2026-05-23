const AdminModule = (() => {
  const D = document;
  const mod = D.body.dataset.module || 'dashboard';
  const title = D.body.dataset.title || 'Admin Dashboard';
  const subtitle = D.body.dataset.subtitle || 'Manage LifeLink operations from one secure workspace.';
  const apiBase = '/api/admin';
  const state = { rows: [], total: 0, offset: 0, limit: 12, charts: [], lastData: null };

  const nav = [
    ['admin-dashboard.html', 'Dashboard', 'fa-gauge-high'],
    ['admin-users.html', 'Users', 'fa-users'],
    ['admin-donors.html', 'Donors', 'fa-hand-holding-droplet'],
    ['admin-patients.html', 'Patients', 'fa-bed-pulse'],
    ['admin-hospitals.html', 'Hospitals', 'fa-hospital'],
    ['admin-blood-banks.html', 'Blood Banks', 'fa-warehouse'],
    ['admin-ngos.html', 'NGOs', 'fa-people-group'],
    ['admin-volunteers.html', 'Volunteers', 'fa-user-check'],
    ['admin-campaigns.html', 'Campaigns', 'fa-bullhorn'],
    ['admin-blood-requests.html', 'Blood Requests', 'fa-droplet'],
    ['admin-payments.html', 'Payments', 'fa-credit-card'],
    ['admin-transactions.html', 'Transactions', 'fa-receipt'],
    ['admin-subscriptions.html', 'Subscriptions', 'fa-crown'],
    ['admin-complaints.html', 'Complaints', 'fa-triangle-exclamation'],
    ['admin-feedback.html', 'Feedback', 'fa-star'],
    ['admin-notifications.html', 'Notifications', 'fa-bell'],
    ['admin-analytics.html', 'Analytics', 'fa-chart-line'],
    ['admin-settings.html', 'Settings', 'fa-gear'],
    ['admin-chat.html', 'Chat', 'fa-comments'],
    ['admin-reports.html', 'Reports', 'fa-file-export'],
    ['admin-emergency-requests.html', 'Emergency Requests', 'fa-truck-medical'],
    ['admin-blood-inventory.html', 'Blood Inventory', 'fa-boxes-stacked'],
    ['logout.html', 'Logout', 'fa-right-from-bracket']
  ];

  const endpoints = {
    dashboard: 'overview',
    users: 'users',
    donors: 'users/role/donor',
    patients: 'users/role/patient',
    hospitals: 'users/role/hospital',
    'blood-banks': 'users/role/blood_bank',
    ngos: 'users/role/ngo',
    volunteers: 'users/role/volunteer',
    campaigns: 'campaigns',
    'blood-requests': 'blood-requests',
    payments: 'payments',
    transactions: 'transactions',
    subscriptions: 'subscriptions',
    complaints: 'complaints',
    feedback: 'feedback',
    notifications: 'notifications',
    analytics: 'analytics',
    settings: 'settings',
    chat: 'chat',
    reports: 'reports',
    'emergency-requests': 'emergency-requests',
    'blood-inventory': 'blood-inventory'
  };

  D.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (mod === 'logout') return LifeLink.logout();
    LifeLink.requireRole(['admin', 'super_admin']);
    renderShell();
    bind();
    await load();
  }

  function renderShell() {
    D.getElementById('adminApp').innerHTML = `
      <div class="am-shell">
        <aside class="am-sidebar" id="side">
          <a class="am-brand" href="/pages/admin/admin-dashboard.html"><span><i class="fa-solid fa-heart-pulse"></i></span><b>LifeLink</b></a>
          <nav class="am-nav">${nav.map(([href,label,icon]) => href === 'logout.html'
            ? `<button data-logout><i class="fa-solid ${icon}"></i><span>${label}</span></button>`
            : `<a href="/pages/admin/${href}" class="${location.pathname.endsWith(href) ? 'active' : ''}" title="${label}"><i class="fa-solid ${icon}"></i><span>${label}</span></a>`).join('')}</nav>
        </aside>
        <main class="am-main">
          <header class="am-topbar">
            <div class="d-flex align-items-center gap-2"><button class="icon-btn d-xl-none" id="menuBtn"><i class="fa-solid fa-bars"></i></button><div><b>LifeLink Admin</b><div class="small text-muted">Secure command center</div></div></div>
            <label class="am-search"><i class="fa-solid fa-magnifying-glass"></i><input id="q" placeholder="Search ${escapeHtml(title).toLowerCase()}"></label>
            <div class="am-actions"><span class="admin-chip">Admin Access</span><select class="form-select form-select-sm language-select" aria-label="Language switch"><option value="en">EN</option><option value="hi">हिंदी</option><option value="pa">ਪੰਜਾਬੀ</option></select><button class="icon-btn" id="theme"><i class="fa-solid fa-moon"></i></button><button class="icon-btn"><i class="fa-solid fa-bell"></i></button><button class="icon-btn"><i class="fa-solid fa-user-shield"></i></button></div>
          </header>
          <section class="am-content">
            <div class="hero">
              <div><p class="eyebrow">Administration</p><h1>${escapeHtml(title)}</h1><p class="text-muted mb-0">${escapeHtml(subtitle)}</p></div>
              <div class="hero-side"><div class="clock" id="clock">--:--</div><span class="health-pill"><i class="fa-solid fa-shield-heart"></i> Live operations</span><div class="hero-actions">${heroButtons()}</div></div>
            </div>
            <div id="view"></div>
          </section>
        </main>
      </div>`;
    tickClock();
    setInterval(tickClock, 30000);
    LifeLink.initLanguageControls();
  }

  function heroButtons() {
    return `${mod === 'notifications' ? '<button class="btn btn-danger" data-action="broadcast">Broadcast</button>' : ''}<button class="btn btn-outline-danger" data-action="refresh">Refresh</button><button class="btn btn-dark" data-action="export">Export</button>`;
  }

  function bind() {
    D.querySelector('[data-action="refresh"]').addEventListener('click', load);
    D.querySelector('[data-action="export"]').addEventListener('click', exportCsv);
    D.querySelector('[data-action="broadcast"]')?.addEventListener('click', openBroadcast);
    D.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', LifeLink.logout));
    D.getElementById('theme').addEventListener('click', () => D.body.classList.toggle('dark-mode'));
    D.getElementById('menuBtn')?.addEventListener('click', () => D.getElementById('side').classList.toggle('open'));
    D.getElementById('q').addEventListener('input', debounce(() => {
      state.offset = 0;
      load();
    }, 350));
    D.addEventListener('click', handleAction);
    D.addEventListener('change', (event) => {
      if (event.target.id === 'statusFilter') {
        state.offset = 0;
        load();
      }
    });
  }

  async function load() {
    try {
      skeleton();
      destroyCharts();
      const params = new URLSearchParams({ limit: state.limit, offset: state.offset, q: D.getElementById('q')?.value || '' });
      const status = D.getElementById('statusFilter')?.value;
      if (status) params.set('status', status);
      const accountStatus = D.getElementById('accountStatusFilter')?.value;
      if (accountStatus) params.set('account_status', accountStatus);
      const data = await LifeLink.api(`${apiBase}/${endpoints[mod] || mod}?${params}`);
      state.lastData = data;
      state.rows = data.rows || data.latestUsers || [];
      state.total = Number(data.total || state.rows.length || 0);
      render(data);
      LifeLink.applyLanguage();
    } catch (error) {
      D.getElementById('view').innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    }
  }

  function render(data) {
    if (mod === 'dashboard') return renderDashboard(data);
    if (mod === 'analytics') return renderAnalytics(data);
    if (mod === 'reports') return renderReports(data);
    if (mod === 'settings') return renderSettings(data);
    if (mod === 'notifications') return renderNotifications(data.rows || []);
    return renderTable(data.rows || []);
  }

  function renderDashboard(data) {
    const stats = data.stats || {};
    D.getElementById('view').innerHTML = `
      <div class="metrics">
        ${metric('Total Users', stats.users, 'fa-users', '+ verified and pending')}
        ${metric('Pending Users', stats.pendingUsers, 'fa-user-clock', 'waiting for approval')}
        ${metric('Banned Users', stats.bannedUsers, 'fa-user-slash', 'restricted accounts')}
        ${metric('Registered Donors', stats.donors, 'fa-hand-holding-droplet', 'active donor network')}
        ${metric('Hospitals', stats.hospitals, 'fa-hospital', 'connected partners')}
        ${metric('Emergency Cases', stats.emergencies, 'fa-truck-medical', 'live monitoring')}
        ${metric('Blood Requests', stats.activeRequests, 'fa-droplet', 'open and approved')}
        ${metric('Blood Units', stats.bloodUnits, 'fa-boxes-stacked', 'available stock')}
        ${metric('Revenue', money(stats.revenue), 'fa-indian-rupee-sign', 'captured payments')}
        ${metric('Subscriptions', stats.activeSubscriptions, 'fa-crown', 'active plans')}
        ${metric('Failed Payments', stats.failedPayments, 'fa-circle-exclamation', 'billing attention')}
      </div>
      <div class="ops-grid mb-3">
        <div class="ops-card danger">
          <div><p class="eyebrow">Priority Queue</p><h2>${Number(stats.emergencies || 0) + Number(stats.activeRequests || 0)}</h2><span>requests need monitoring</span></div>
          <i class="fa-solid fa-truck-medical"></i>
        </div>
        <div class="ops-card warn">
          <div><p class="eyebrow">Low Stock Watch</p><h2>${(data.lowStock || []).length}</h2><span>${lowStockText(data.lowStock || [])}</span></div>
          <i class="fa-solid fa-vial-circle-check"></i>
        </div>
        <div class="ops-card ok">
          <div><p class="eyebrow">System Health</p><h2>${escapeHtml(data.systemHealth?.api || 'online')}</h2><span>DB ${escapeHtml(data.systemHealth?.database || 'connected')} | Maps ${escapeHtml(data.systemHealth?.maps || 'leaflet')}</span></div>
          <i class="fa-solid fa-server"></i>
        </div>
      </div>
      <div class="charts mb-3">
        <div class="chart-card"><canvas id="monthlyChart"></canvas></div>
        <div class="chart-card"><canvas id="inventoryChart"></canvas></div>
        <div class="chart-card"><canvas id="rolesMiniChart"></canvas></div>
        <div class="chart-card"><canvas id="statusMiniChart"></canvas></div>
      </div>
      <div class="row g-3">
        <div class="col-xl-6"><div class="panel"><div class="panel-head"><h2>Latest Users</h2></div>${table(data.latestUsers || [])}</div></div>
        <div class="col-xl-6"><div class="panel"><div class="panel-head"><h2>Recent Blood Requests</h2></div>${table(data.latestRequests || [])}</div></div>
        <div class="col-xl-5"><div class="panel"><div class="panel-head"><h2>Low Stock Alerts</h2><a class="btn btn-sm btn-outline-danger" href="/pages/admin/admin-blood-inventory.html">Open Inventory</a></div>${stockList(data.lowStock || [])}</div></div>
        <div class="col-xl-7"><div class="panel"><div class="panel-head"><h2>Recent Admin Activity</h2></div>${timeline(data.recentLogs || [])}</div></div>
      </div>`;
    chart('monthlyChart', 'line', (data.monthly || []).map((x) => x.label), (data.monthly || []).map((x) => Number(x.requests || 0)), 'Monthly requests');
    chart('inventoryChart', 'bar', (data.inventory || []).map((x) => x.blood_group), (data.inventory || []).map((x) => Number(x.units || 0)), 'Blood units');
    chart('rolesMiniChart', 'doughnut', (data.roleBreakdown || []).map((x) => x.role), (data.roleBreakdown || []).map((x) => Number(x.count || 0)), 'User roles');
    chart('statusMiniChart', 'bar', (data.requestStatus || []).map((x) => x.status), (data.requestStatus || []).map((x) => Number(x.count || 0)), 'Request status');
  }

  function renderAnalytics(data) {
    D.getElementById('view').innerHTML = `
      <div class="metrics">
        ${metric('Metrics Captured', data.total || 0, 'fa-database', 'analytics records')}
        ${metric('Roles Tracked', (data.roles || []).length, 'fa-layer-group', 'platform segments')}
        ${metric('Blood Groups', (data.demand || []).length, 'fa-droplet', 'demand signals')}
        ${metric('Revenue Months', (data.revenue || []).length, 'fa-chart-column', 'billing performance')}
      </div>
      <div class="charts">
        <div class="chart-card"><canvas id="rolesChart"></canvas></div>
        <div class="chart-card"><canvas id="demandChart"></canvas></div>
        <div class="chart-card"><canvas id="revenueChart"></canvas></div>
        <div class="panel">${table(data.rows || [])}</div>
      </div>`;
    chart('rolesChart', 'doughnut', (data.roles || []).map((x) => x.role), (data.roles || []).map((x) => Number(x.count || 0)), 'Users by role');
    chart('demandChart', 'bar', (data.demand || []).map((x) => x.blood_group), (data.demand || []).map((x) => Number(x.count || 0)), 'Blood demand');
    chart('revenueChart', 'line', (data.revenue || []).map((x) => x.label), (data.revenue || []).map((x) => Number(x.amount || 0)), 'Revenue');
  }

  function renderReports(data) {
    const summary = data.summary || {};
    D.getElementById('view').innerHTML = `
      <div class="metrics">
        ${metric('Users', summary.users?.total || 0, 'fa-users', `${summary.users?.donors || 0} donors`)}
        ${metric('Hospitals', summary.users?.hospitals || 0, 'fa-hospital', 'registered partners')}
        ${metric('Requests', summary.requests?.total || 0, 'fa-droplet', `${summary.requests?.completed || 0} completed`)}
        ${metric('Emergencies', summary.emergencies?.total || 0, 'fa-truck-medical', `${summary.emergencies?.resolved || 0} resolved`)}
      </div>
      <div class="panel"><div class="panel-head"><h2>Admin Activity Report</h2><button class="btn btn-sm btn-danger" data-action="export">Download CSV</button></div>${table(data.rows || [])}</div>`;
  }

  function renderSettings(data) {
    const settings = data.settings || {};
    const admin = settings.admin || {};
    D.getElementById('view').innerHTML = `
      <div class="row g-3">
        <div class="col-lg-5"><div class="panel">
          <div class="panel-head"><h2>Admin Account</h2></div>
          <p><b>${escapeHtml(admin.name || 'Admin')}</b><br><span class="text-muted">${escapeHtml(admin.email || '')}</span></p>
          <div class="d-grid gap-2">
            <button class="btn btn-danger" data-setting="Security review completed">Run Security Review</button>
            <button class="btn btn-outline-danger" data-setting="Session policy updated">Update Session Policy</button>
          </div>
        </div></div>
        <div class="col-lg-7"><div class="panel"><div class="panel-head"><h2>Audit Logs</h2></div>${timeline(settings.logs || data.rows || [])}</div></div>
      </div>`;
  }

  function renderNotifications(rows) {
    D.getElementById('view').innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>Notification Center</h2><button class="btn btn-sm btn-danger" data-action="broadcast">Broadcast</button></div>
        ${table(rows)}
      </div>`;
  }

  function renderTable(rows) {
    D.getElementById('view').innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>${escapeHtml(title)}</h2>${filters()}</div>
        ${table(rows)}
        ${pager()}
      </div>`;
  }

  function table(rows) {
    if (!rows.length) return '<div class="empty">No records found. Try changing the search or filters.</div>';
    const keys = Object.keys(rows[0]).filter((key) => !['password_hash'].includes(key)).slice(0, 8);
    return `<div class="table-responsive"><table class="table align-middle"><thead><tr>${keys.map((key) => `<th>${label(key)}</th>`).join('')}<th>Actions</th></tr></thead><tbody>${rows.map((row) => `<tr>${keys.map((key) => `<td>${cell(key, row[key])}</td>`).join('')}<td>${actions(row)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function actions(row) {
    const id = row.id;
    if (!id) return '';
    if (['users','donors','patients','hospitals','blood-banks','ngos','volunteers'].includes(mod)) {
      const banned = row.account_status === 'banned';
      return `<div class="action-row"><button class="btn btn-sm btn-light" data-view="${id}">View</button><button class="btn btn-sm btn-outline-danger" data-verify="${id}" data-value="${row.is_verified ? 0 : 1}">${row.is_verified ? 'Unverify' : 'Verify'}</button><button class="btn btn-sm ${banned ? 'btn-outline-success' : 'btn-outline-dark'}" data-account-status="${id}" data-value="${banned ? 'active' : 'banned'}">${banned ? 'Unban' : 'Ban'}</button></div>`;
    }
    if (mod === 'subscriptions') {
      return `<div class="action-row"><button class="btn btn-sm btn-light" data-view="${id}">View</button><button class="btn btn-sm btn-outline-success" data-status="${id}" data-value="active">Activate</button><button class="btn btn-sm btn-outline-warning" data-status="${id}" data-value="failed">Mark Failed</button><button class="btn btn-sm btn-outline-secondary" data-status="${id}" data-value="cancelled">Cancel</button></div>`;
    }
    if (mod === 'blood-requests') return `<div class="action-row"><button class="btn btn-sm btn-light" data-view="${id}">View</button><button class="btn btn-sm btn-outline-danger" data-status="${id}" data-value="matched">Match</button><button class="btn btn-sm btn-outline-success" data-status="${id}" data-value="fulfilled">Fulfill</button><button class="btn btn-sm btn-outline-secondary" data-status="${id}" data-value="cancelled">Cancel</button></div>`;
    if (mod === 'emergency-requests') return `<div class="action-row"><button class="btn btn-sm btn-light" data-view="${id}">View</button><button class="btn btn-sm btn-outline-danger" data-status="${id}" data-value="approved">Approve</button><button class="btn btn-sm btn-outline-warning" data-status="${id}" data-value="broadcasted">Broadcast</button><button class="btn btn-sm btn-outline-success" data-status="${id}" data-value="fulfilled">Fulfill</button><button class="btn btn-sm btn-outline-secondary" data-status="${id}" data-value="rejected">Reject</button></div>`;
    if (mod === 'complaints') return `<div class="action-row"><button class="btn btn-sm btn-light" data-view="${id}">View</button><button class="btn btn-sm btn-outline-warning" data-status="${id}" data-value="investigating">Investigate</button><button class="btn btn-sm btn-outline-success" data-status="${id}" data-value="resolved">Resolve</button><button class="btn btn-sm btn-outline-secondary" data-status="${id}" data-value="closed">Close</button></div>`;
    if (mod === 'feedback') return `<div class="action-row"><button class="btn btn-sm btn-light" data-view="${id}">View</button><button class="btn btn-sm btn-outline-danger" data-status="${id}" data-value="reviewed">Review</button><button class="btn btn-sm btn-outline-secondary" data-status="${id}" data-value="closed">Close</button></div>`;
    if (mod === 'notifications') return `<div class="action-row"><button class="btn btn-sm btn-light" data-view="${id}">View</button><button class="btn btn-sm btn-outline-danger" data-delete="${id}">Delete</button></div>`;
    return `<button class="btn btn-sm btn-light" data-view="${id}">View</button>`;
  }

  async function handleAction(event) {
    const target = event.target.closest('[data-view],[data-verify],[data-account-status],[data-status],[data-delete],[data-setting]');
    if (!target) return;
    try {
      if (target.dataset.view) {
        openDetails(target.dataset.view);
        return;
      }
      if (target.dataset.verify) {
        await LifeLink.api(`${apiBase}/users/${target.dataset.verify}/verify`, { method: 'PATCH', body: JSON.stringify({ is_verified: Number(target.dataset.value) }) });
      }
      if (target.dataset.accountStatus) {
        await LifeLink.api(`${apiBase}/users/${target.dataset.accountStatus}/status`, { method: 'PATCH', body: JSON.stringify({ account_status: target.dataset.value }) });
      }
      if (target.dataset.status) {
        await LifeLink.api(`${apiBase}/${endpoints[mod]}/${target.dataset.status}/status`, { method: 'PATCH', body: JSON.stringify({ status: target.dataset.value }) });
      }
      if (target.dataset.delete) {
        await LifeLink.api(`${apiBase}/notifications/${target.dataset.delete}`, { method: 'DELETE' });
      }
      if (target.dataset.setting) {
        await LifeLink.api(`${apiBase}/settings/audit-log`, { method: 'POST', body: JSON.stringify({ action: target.dataset.setting }) });
      }
      LifeLink.toast('Admin action completed');
      load();
    } catch (error) {
      LifeLink.toast(error.message, 'error');
    }
  }

  function openBroadcast() {
    D.getElementById('view').insertAdjacentHTML('afterbegin', `
      <div class="panel" id="broadcastBox">
        <div class="panel-head"><h2>Broadcast Notification</h2><button class="btn btn-sm btn-outline-secondary" onclick="this.closest('.panel').remove()">Close</button></div>
        <form id="broadcastForm" class="row g-2">
          <div class="col-md-3"><input class="form-control" name="title" placeholder="Title" required></div>
          <div class="col-md-4"><input class="form-control" name="message" placeholder="Message" required></div>
          <div class="col-md-2"><select class="form-select" name="role"><option value="all">All roles</option><option value="donor">Donors</option><option value="hospital">Hospitals</option><option value="patient">Patients</option><option value="blood_bank">Blood Banks</option><option value="ngo">NGOs</option><option value="volunteer">Volunteers</option><option value="camp_organizer">Camp Organizers</option></select></div>
          <div class="col-md-2"><select class="form-select" name="type"><option>info</option><option>success</option><option>warning</option><option>danger</option></select></div>
          <div class="col-md-1 d-grid"><button class="btn btn-danger">Send</button></div>
        </form>
      </div>`);
    D.getElementById('broadcastForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await LifeLink.api(`${apiBase}/notifications/broadcast`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
        LifeLink.toast('Broadcast sent');
        event.target.closest('.panel').remove();
        load();
      } catch (error) {
        LifeLink.toast(error.message, 'error');
      }
    }, { once: true });
  }

  function metric(name, value, icon, note) {
    return `<div class="metric"><i class="fa-solid ${icon}"></i><strong>${value ?? 0}</strong><small>${escapeHtml(name)}</small><div class="text-muted small mt-2">${escapeHtml(note || '')}</div></div>`;
  }

  function chart(id, type, labels, values, name) {
    const el = D.getElementById(id);
    if (!el || !window.Chart) return;
    state.charts.push(new Chart(el, { type, data: { labels, datasets: [{ label: name, data: values, borderColor: '#e9194f', backgroundColor: ['#e9194f','#2563eb','#12a376','#f59e0b','#7c3aed','#fb7185','#0ea5e9','#14b8a6'], tension: .38 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: type !== 'bar' } } } }));
  }

  function destroyCharts() {
    state.charts.splice(0).forEach((item) => item.destroy());
  }

  function filters() {
    return ['blood-requests','emergency-requests','complaints','feedback','subscriptions'].includes(mod)
      ? '<div class="filter-row"><select id="statusFilter" class="form-select"><option value="">All statuses</option><option value="open">Open</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="matched">Matched</option><option value="broadcasted">Broadcasted</option><option value="fulfilled">Fulfilled</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="active">Active</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option><option value="rejected">Rejected</option></select></div>'
      : ['users','donors','patients','hospitals','blood-banks','ngos','volunteers'].includes(mod)
        ? '<div class="filter-row"><select id="accountStatusFilter" class="form-select"><option value="">All accounts</option><option value="active">Active</option><option value="banned">Banned</option><option value="deactivated">Deactivated</option></select></div>'
        : '';
  }

  function pager() {
    return `<div class="pager"><span class="text-muted small">Showing ${state.rows.length} of ${state.total}</span><div class="d-flex gap-2"><button class="btn btn-sm btn-outline-danger" ${state.offset <= 0 ? 'disabled' : ''} onclick="AdminModule.page(-1)">Previous</button><button class="btn btn-sm btn-danger" ${(state.offset + state.limit) >= state.total ? 'disabled' : ''} onclick="AdminModule.page(1)">Next</button></div></div>`;
  }

  function page(direction) {
    state.offset = Math.max(0, state.offset + direction * state.limit);
    load();
  }

  function timeline(rows) {
    if (!rows.length) return '<div class="empty">No activity yet.</div>';
    return `<div class="timeline">${rows.map((row) => `<div class="timeline-item"><span class="dot"></span><div><b>${escapeHtml(row.action || row.title || row.message || 'Activity')}</b><div class="text-muted small">${escapeHtml(formatDate(row.created_at))}</div></div></div>`).join('')}</div>`;
  }

  function stockList(rows) {
    if (!rows.length) return '<div class="empty">No low stock alerts right now.</div>';
    return `<div class="stock-list">${rows.map((row) => `<div class="stock-row"><span>${escapeHtml(row.blood_group)}</span><div class="stock-bar"><i style="width:${Math.max(8, Math.min(100, Number(row.units || 0) * 8))}%"></i></div><b>${Number(row.units || 0)} units</b></div>`).join('')}</div>`;
  }

  function lowStockText(rows) {
    return rows.length ? rows.map((row) => `${row.blood_group}: ${row.units}`).join(' | ') : 'all groups above alert level';
  }

  function openDetails(id) {
    const row = state.rows.find((item) => String(item.id) === String(id))
      || Object.values(state.lastData || {}).flat().find((item) => item && String(item.id) === String(id));
    if (!row) return LifeLink.toast('Record not found', 'warning');
    D.querySelector('.detail-backdrop')?.remove();
    D.body.insertAdjacentHTML('beforeend', `
      <div class="detail-backdrop">
        <aside class="detail-drawer">
          <div class="panel-head"><div><p class="eyebrow">Record Details</p><h2>${escapeHtml(title)}</h2></div><button class="icon-btn" data-close-details><i class="fa-solid fa-xmark"></i></button></div>
          <div class="detail-grid">${Object.entries(row).map(([key, value]) => `<div><span>${label(key)}</span><b>${cell(key, value)}</b></div>`).join('')}</div>
        </aside>
      </div>`);
    D.querySelector('[data-close-details]').addEventListener('click', () => D.querySelector('.detail-backdrop')?.remove(), { once: true });
    D.querySelector('.detail-backdrop').addEventListener('click', (event) => {
      if (event.target.classList.contains('detail-backdrop')) event.currentTarget.remove();
    });
  }

  function tickClock() {
    const el = D.getElementById('clock');
    if (el) el.textContent = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function skeleton() {
    D.getElementById('view').innerHTML = '<div class="panel"><div class="placeholder-glow"><span class="placeholder col-7"></span><span class="placeholder col-4"></span><span class="placeholder col-10"></span><span class="placeholder col-6"></span></div></div>';
  }

  function exportCsv() {
    const rows = state.rows;
    if (!rows.length) return LifeLink.toast('No rows to export', 'warning');
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(','), ...rows.map((row) => keys.map((key) => `"${String(row[key] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');
    const link = D.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `${mod}-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function cell(key, value) {
    if (value === null || value === undefined || value === '') return '<span class="text-muted">-</span>';
    if (key.includes('status') || key === 'role') return `<span class="status ${statusClass(value)}">${escapeHtml(value)}</span>`;
    if (key === 'is_verified') return `<span class="status ${value ? 'ok' : 'warn'}">${value ? 'Verified' : 'Pending'}</span>`;
    if (key === 'amount_paise') return `Rs ${(Number(value || 0) / 100).toLocaleString('en-IN')}`;
    if (key.includes('amount')) return money(value);
    if (key.includes('created_at') || key.includes('date') || key.includes('expires_on') || key.includes('renewal')) return escapeHtml(formatDate(value));
    return escapeHtml(String(value).length > 80 ? `${String(value).slice(0, 80)}...` : String(value));
  }

  function statusClass(value) {
    const text = String(value).toLowerCase();
    if (['active','verified','approved','paid','captured','success','resolved','completed','fulfilled'].includes(text)) return 'ok';
    if (['critical','failed','rejected','cancelled','closed','expired'].includes(text)) return 'danger';
    if (['pending','open','trial','investigating','warning'].includes(text)) return 'warn';
    return 'dark';
  }

  function money(value) {
    return `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
  }

  function label(key) {
    return key.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }

  function debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  return { page };
})();
