async function loadCompanyConsole() {
  const architecture = await LifeLink.api('/api/company/architecture', { auth: false });
  document.querySelectorAll('[data-company]').forEach((node) => { node.textContent = architecture.company; });
  document.querySelectorAll('[data-assistant]').forEach((node) => { node.textContent = architecture.assistant; });

  const roleList = document.querySelector('#roleList');
  if (roleList) {
    roleList.innerHTML = architecture.roles.map((role) => `<span class="role-chip">${role.replace('_', ' ')}</span>`).join('');
  }

  const planRows = document.querySelector('#companyPlanRows');
  if (planRows) {
    const { plans } = await LifeLink.api('/api/company/plans', { auth: false });
    planRows.innerHTML = Object.entries(plans).map(([key, plan]) => `
      <div class="col-md-4">
        <div class="surface p-4 h-100">
          <span class="badge badge-soft mb-3">${plan.name}</span>
          <h3 class="fw-bold">Rs ${(plan.amount / 100).toLocaleString('en-IN')}</h3>
          <p class="text-muted">${plan.users} team users</p>
          <ul class="clean-list">${plan.features.map((feature) => `<li>${feature}</li>`).join('')}</ul>
          <button class="btn ${key === 'pro' ? 'btn-lifelink' : 'btn-outline-lifelink'} w-100 mt-2" data-plan="${key}">Choose ${plan.name}</button>
        </div>
      </div>
    `).join('');
  }
}

async function loadEmergencyRequests() {
  const table = document.querySelector('#emergencyRows');
  if (!table) return;
  const { requests } = await LifeLink.api('/api/company/emergency-requests');
  table.innerHTML = requests.map((request) => `
    <tr>
      <td>${request.patient_name}</td>
      <td><span class="badge text-bg-danger">${request.blood_group}</span></td>
      <td>${request.units_needed}</td>
      <td>${request.city || '-'}</td>
      <td>${request.priority_score}</td>
      <td>${request.status}</td>
    </tr>
  `).join('');
}

function bindEmergencyForm() {
  const form = document.querySelector('#emergencyForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(form));
      const data = await LifeLink.api('/api/company/emergency-requests', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      LifeLink.toast(`Broadcast sent. Priority ${data.priorityScore}`, 'success');
      form.reset();
      await loadEmergencyRequests();
    } catch (error) {
      LifeLink.toast(error.message, 'error');
    }
  });
}

async function loadRiskAndLeaderboard() {
  const riskRows = document.querySelector('#riskRows');
  if (riskRows) {
    const { risks } = await LifeLink.api('/api/company/blood-banks/inventory-risk');
    riskRows.innerHTML = risks.map((risk) => `
      <tr><td>${risk.blood_group}</td><td>${risk.units}</td><td>${risk.nearest_expiry || '-'}</td><td>${risk.risk}</td></tr>
    `).join('');
  }

  const leaderboardRows = document.querySelector('#leaderboardRows');
  if (leaderboardRows) {
    const { leaderboard } = await LifeLink.api('/api/company/leaderboard', { auth: false });
    leaderboardRows.innerHTML = leaderboard.map((item, index) => `
      <tr><td>${index + 1}</td><td>${item.name}</td><td>${item.blood_group || '-'}</td><td>${item.points}</td><td>${item.badge}</td></tr>
    `).join('');
  }
}

async function loadGlobalRolePanel() {
  const panel = document.querySelector('#globalRolePanel');
  if (!panel) return;
  const data = await LifeLink.api('/api/company/role-dashboard');
  const stats = data.stats || {};
  panel.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
      <div><p class="text-muted mb-1">Global operations</p><h4 class="mb-0">${escapeHtml(data.user?.name || 'LifeLink workspace')}</h4></div>
      <span class="badge text-bg-danger p-2">${escapeHtml(String(data.role || '').replace('_', ' '))}</span>
    </div>
    <div class="row g-3 mb-3">
      ${roleMetric('Open requests', stats.openBloodRequests)}
      ${roleMetric('Active emergencies', stats.activeEmergencies)}
      ${roleMetric('Verified donors', stats.verifiedDonors)}
      ${roleMetric('Blood units', stats.bloodUnits)}
      ${roleMetric('Appointments', stats.appointments)}
      ${roleMetric('Unread alerts', stats.unreadNotifications)}
    </div>
    <div class="row g-3">
      <div class="col-xl-6">
        <h5>Critical emergency queue</h5>
        <div class="table-responsive">${miniTable(data.emergencies || [], ['patient_name','blood_group','units_needed','city','priority_score','status'])}</div>
      </div>
      <div class="col-xl-6">
        <h5>Eligible donor network</h5>
        <div class="table-responsive">${miniTable(data.eligibleDonors || [], ['name','blood_group','city','hemoglobin','availability'])}</div>
      </div>
    </div>
  `;
}

function roleMetric(label, value) {
  return `<div class="col-md-4 col-xl-2"><div class="surface metric p-3 h-100"><span class="text-muted">${escapeHtml(label)}</span><h3 class="mb-0">${Number(value || 0).toLocaleString('en-IN')}</h3></div></div>`;
}

function miniTable(rows, keys) {
  if (!rows.length) return '<div class="text-muted py-3">No records found.</div>';
  return `<table class="table align-middle"><thead><tr>${keys.map((key) => `<th>${label(key)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 8).map((row) => `<tr>${keys.map((key) => `<td>${escapeHtml(row[key] ?? '-')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function label(key) {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}
