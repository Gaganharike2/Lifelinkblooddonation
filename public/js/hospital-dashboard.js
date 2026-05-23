const HospitalDashboard = (() => {
  const state = {
    data: null,
    charts: []
  };

  const fallback = {
    hospital: { name: 'CityCare Hospital', city: 'Delhi', address: 'Karol Bagh' },
    subscription: {
      plan_name: 'Pro',
      status: 'active',
      amount_paid_paise: 299900,
      renewal_date: '2026-06-15T00:00:00.000Z',
      usage_percent: 68,
      features: ['AI donor matching', 'Emergency broadcasts', 'PDF/Excel reports', 'Live tracking']
    },
    stats: {
      donors: 18420,
      newDonorsToday: 42,
      donorGrowth: 12.4,
      activeRequests: 38,
      completedRequests: 214,
      rejectedRequests: 9,
      activeEmergency: 7,
      criticalEmergency: 3,
      resolvedEmergency: 22,
      totalUnits: 582,
      availableStock: 514,
      lowStock: 4,
      monthlyDonations: 126,
      donationDelta: 18,
      todayAppointments: 24,
      pendingAppointments: 9,
      unreadNotifications: 6,
      activeStaff: 14,
      tasksCompleted: 87
    },
    inventory: [
      { blood_group: 'A+', available_units: 38, reserved_units: 7, expiry_count: 2, status: 'healthy' },
      { blood_group: 'A-', available_units: 9, reserved_units: 2, expiry_count: 1, status: 'low' },
      { blood_group: 'B+', available_units: 44, reserved_units: 8, expiry_count: 3, status: 'healthy' },
      { blood_group: 'B-', available_units: 5, reserved_units: 1, expiry_count: 1, status: 'critical' },
      { blood_group: 'O+', available_units: 58, reserved_units: 11, expiry_count: 4, status: 'healthy' },
      { blood_group: 'O-', available_units: 3, reserved_units: 1, expiry_count: 0, status: 'critical' },
      { blood_group: 'AB+', available_units: 20, reserved_units: 3, expiry_count: 2, status: 'healthy' },
      { blood_group: 'AB-', available_units: 6, reserved_units: 2, expiry_count: 1, status: 'low' }
    ],
    emergencies: [
      { id: 101, patient_name: 'Riya Sharma', blood_group: 'O-', hospital_name: 'Emergency Wing', city: 'Delhi', priority_score: 96, status: 'approved', needed_by: futureMinutes(82), units_needed: 2 },
      { id: 102, patient_name: 'Meera Patient', blood_group: 'B+', hospital_name: 'CityCare Main', city: 'Delhi', priority_score: 86, status: 'broadcasted', needed_by: futureMinutes(140), units_needed: 3 },
      { id: 103, patient_name: 'Aman Verma', blood_group: 'AB-', hospital_name: 'North Delhi Unit', city: 'Delhi', priority_score: 72, status: 'pending', needed_by: futureMinutes(240), units_needed: 1 }
    ],
    matches: [
      { id: 1, name: 'Aarav Donor', blood_group: 'O+', city: 'Delhi', mobile: '9000000001', hemoglobin: 14.2, availability: 'available', match_score: 94, next_eligible_date: null },
      { id: 2, name: 'Nisha Rao', blood_group: 'O-', city: 'Delhi', mobile: '9000000022', hemoglobin: 13.4, availability: 'available', match_score: 91, next_eligible_date: null },
      { id: 3, name: 'Kabir Mehta', blood_group: 'B+', city: 'Gurugram', mobile: '9000000033', hemoglobin: 13.1, availability: 'available', match_score: 86, next_eligible_date: '2026-06-10' }
    ],
    appointments: [
      { id: 1, donor_name: 'Aarav Donor', appointment_at: futureMinutes(70), blood_group: 'O+', status: 'scheduled', notes: 'First floor donor room' },
      { id: 2, donor_name: 'Nisha Rao', appointment_at: futureMinutes(150), blood_group: 'O-', status: 'approved', notes: 'Emergency reserve' },
      { id: 3, donor_name: 'Kabir Mehta', appointment_at: futureMinutes(260), blood_group: 'B+', status: 'completed', notes: 'Certificate pending' }
    ],
    requests: [
      { id: 5521, patient_name: 'Riya Sharma', blood_group: 'O-', units_needed: 2, status: 'open', urgency: 'critical', created_at: new Date().toISOString() },
      { id: 5522, patient_name: 'Meera Patient', blood_group: 'B+', units_needed: 3, status: 'matched', urgency: 'urgent', created_at: pastHours(3) },
      { id: 5523, patient_name: 'Aman Verma', blood_group: 'AB-', units_needed: 1, status: 'fulfilled', urgency: 'normal', created_at: pastHours(8) }
    ],
    notifications: [
      { id: 1, title: 'Emergency blood alert', message: 'O- critical request needs donor confirmation.', type: 'danger', created_at: pastMinutes(8) },
      { id: 2, title: 'New donor registered', message: 'A verified O+ donor joined near Karol Bagh.', type: 'success', created_at: pastMinutes(22) },
      { id: 3, title: 'Stock low warning', message: 'O- inventory is below critical threshold.', type: 'warning', created_at: pastMinutes(46) }
    ],
    predictions: [
      { title: 'O- Blood shortage expected in 3 days', confidence: 91, action: 'Notify eligible O- donors within 10 km' },
      { title: 'B+ demand rising near emergency branch', confidence: 84, action: 'Reserve 6 units and trigger donor reminders' },
      { title: 'AB- expiry risk detected this week', confidence: 78, action: 'Transfer units to high-demand partner center' }
    ],
    activities: [
      { id: 1, message: 'New donor joined the hospital network', created_at: pastMinutes(18) },
      { id: 2, message: 'Blood request created for critical care', created_at: pastMinutes(40) },
      { id: 3, message: 'Emergency request solved by donor match', created_at: pastHours(2) },
      { id: 4, message: 'Staff updated O+ blood inventory', created_at: pastHours(5) },
      { id: 5, message: 'Subscription renewed successfully', created_at: pastHours(9) }
    ],
    analytics: {
      monthly: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((label, index) => ({ label, requests: [42, 55, 61, 78, 88, 126][index] })),
      demand: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((blood_group, index) => ({ blood_group, units: [36, 14, 42, 11, 58, 28, 17, 9][index] })),
      usage: [],
      emergencies: [{ label: '#101', score: 96 }, { label: '#102', score: 86 }, { label: '#103', score: 72 }],
      availability: [{ label: 'Aarav', score: 94 }, { label: 'Nisha', score: 91 }, { label: 'Kabir', score: 86 }],
      revenue: [22, 28, 31, 36, 42, 48, 51],
      performance: [82, 88, 91, 86, 94, 96]
    }
  };
  fallback.analytics.usage = fallback.inventory.map((item) => ({ label: item.blood_group, used: Math.round(item.available_units * .62), available: item.available_units }));

  async function init() {
    LifeLink.requireRole(['hospital', 'admin', 'super_admin']);
    bindChrome();
    showSkeletons();
    updateClock();
    setInterval(updateClock, 1000);
    try {
      state.data = await LifeLink.api('/api/dashboard/hospital');
    } catch (error) {
      state.data = fallback;
      LifeLink.toast(`${error.message}. Showing dashboard preview data.`, 'warning');
    }
    render();
    hideLoader();
  }

  function bindChrome() {
    document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', LifeLink.logout));
    document.getElementById('logoutButton')?.addEventListener('click', LifeLink.logout);
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('lifelink_hospital_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });
    if (localStorage.getItem('lifelink_hospital_theme') === 'dark') document.body.classList.add('dark-mode');

    const sidebar = document.getElementById('hospitalSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const closeSidebar = () => {
      sidebar.classList.remove('is-open');
      backdrop.classList.remove('is-open');
    };
    document.getElementById('sidebarOpen')?.addEventListener('click', () => {
      sidebar.classList.add('is-open');
      backdrop.classList.add('is-open');
    });
    document.getElementById('sidebarClose')?.addEventListener('click', closeSidebar);
    backdrop?.addEventListener('click', closeSidebar);
    document.getElementById('branchSwitcher')?.addEventListener('change', (event) => {
      document.getElementById('branchName').textContent = event.target.value;
      LifeLink.toast(`Branch switched to ${event.target.value}`, 'info');
    });
    document.getElementById('globalSearch')?.addEventListener('input', filterTables);
    document.getElementById('openDonorAlert')?.addEventListener('click', () => openDonorAlertModal());
    document.getElementById('quickSendAlert')?.addEventListener('click', () => openDonorAlertModal());
    LifeLink.initLanguageControls();
    document.addEventListener('click', (event) => {
      const alertButton = event.target.closest('[data-alert-donor]');
      if (!alertButton) return;
      const donor = (state.data?.matches || []).find((item) => String(item.id) === alertButton.dataset.alertDonor);
      openDonorAlertModal(donor || null);
    });
  }

  function render() {
    const data = state.data;
    const hospitalName = data.hospital?.name || 'Hospital Team';
    document.getElementById('hospitalName').textContent = hospitalName;
    document.getElementById('navHospitalName').textContent = hospitalName;
    document.getElementById('planChip').textContent = `${data.subscription?.plan_name || 'Pro'} Plan`;
    document.getElementById('subscriptionStatus').textContent = `${capitalize(data.subscription?.status || 'active')} Subscription`;
    document.getElementById('notificationCount').textContent = data.stats?.unreadNotifications || data.notifications?.length || 0;
    renderStats(data.stats || {});
    renderInventory(data.inventory || []);
    renderEmergencies(data.emergencies || []);
    renderDonors(data.matches || []);
    renderAppointments(data.appointments || []);
    renderNotifications(data.notifications || []);
    renderRequests(data.requests || []);
    renderPredictions(data.predictions || []);
    renderSubscription(data.subscription || {});
    renderActivities(data.activities || []);
    renderCharts(data.analytics || {});
    LifeLink.initIcons();
    LifeLink.applyLanguage();
  }

  function renderStats(stats) {
    const cards = [
      ['users', 'Total Registered Donors', stats.donors, `+${stats.newDonorsToday || 0} today`, `${stats.donorGrowth || 0}% growth`, 'up'],
      ['droplet', 'Active Blood Requests', stats.activeRequests, `${stats.completedRequests || 0} completed`, `${stats.rejectedRequests || 0} rejected`, 'up'],
      ['siren', 'Emergency Requests', stats.activeEmergency, `${stats.criticalEmergency || 0} critical`, `${stats.resolvedEmergency || 0} resolved`, 'danger'],
      ['archive', 'Blood Units Available', stats.totalUnits, `${stats.availableStock || 0} available`, `${stats.lowStock || 0} low-stock groups`, 'danger'],
      ['heart-pulse', 'Monthly Donations', stats.monthlyDonations, 'This month', `${signed(stats.donationDelta)} vs previous`, stats.donationDelta >= 0 ? 'up' : 'down'],
      ['calendar-check', 'Scheduled Appointments', stats.todayAppointments, 'Today', `${stats.pendingAppointments || 0} pending`, 'up'],
      ['badge-indian-rupee', 'Revenue / Subscription', state.data.subscription?.plan_name || 'Pro', money(state.data.subscription?.amount_paid_paise), `Renewal ${dateShort(state.data.subscription?.renewal_date)}`, 'up'],
      ['user-check', 'Staff Activity', stats.activeStaff, 'Active staff', `${stats.tasksCompleted || 0} tasks completed`, 'up']
    ];
    document.getElementById('statsGrid').innerHTML = cards.map(([icon, label, value, sub, trend, trendClass]) => `
      <article class="stat-card">
        <div class="stat-icon"><i data-lucide="${icon}"></i></div>
        <strong data-counter="${escapeAttr(value)}">${value ?? 0}</strong>
        <small>${label}</small>
        <div class="d-flex justify-content-between align-items-center mt-3">
          <span class="text-muted small">${sub || ''}</span>
          <span class="trend ${trendClass}"><i data-lucide="${trendClass === 'down' ? 'trending-down' : 'trending-up'}"></i> ${trend}</span>
        </div>
      </article>
    `).join('');
    animateCounters();
  }

  function renderInventory(rows) {
    const target = document.getElementById('inventoryGrid');
    if (!rows.length) return empty(target, 'No inventory records found. Add blood stock to activate live monitoring.');
    target.innerHTML = rows.map((item) => {
      const percent = Math.min(100, Math.max(5, Number(item.available_units || 0) * 2));
      const barClass = item.status === 'critical' ? 'bg-danger' : item.status === 'low' ? 'bg-warning' : 'bg-success';
      return `
        <article class="blood-tile">
          <header><span class="blood-group">${item.blood_group}</span><span class="stock-status ${item.status}">${capitalize(item.status)}</span></header>
          <div class="progress my-3"><div class="progress-bar ${barClass}" style="width:${percent}%"></div></div>
          <div class="row g-2 small">
            <div class="col-4"><span class="text-muted">Available</span><strong class="d-block">${item.available_units}</strong></div>
            <div class="col-4"><span class="text-muted">Reserved</span><strong class="d-block">${item.reserved_units}</strong></div>
            <div class="col-4"><span class="text-muted">Expiry</span><strong class="d-block">${item.expiry_count}</strong></div>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderEmergencies(rows) {
    const target = document.getElementById('emergencyList');
    if (!rows.length) return empty(target, 'No active emergency requests.');
    target.innerHTML = rows.map((item) => {
      const level = item.priority_score >= 85 ? 'Critical' : item.priority_score >= 65 ? 'Medium' : 'Low';
      return `
        <article class="emergency-item">
          <div class="d-flex justify-content-between gap-2">
            <div><strong>${item.patient_name}</strong><div class="text-white-50 small">${item.hospital_name || 'Hospital Branch'} - ${item.city || 'Local'}</div></div>
            <span class="status-pill critical">${item.blood_group}</span>
          </div>
          <div class="row g-2 mt-2 small">
            <div class="col-6">Level: <strong>${level}</strong></div>
            <div class="col-6">Time: <strong>${timeRemaining(item.needed_by)}</strong></div>
            <div class="col-6">Distance: <strong>${distanceFor(item.id)}</strong></div>
            <div class="col-6">Donors: <strong>${Math.max(1, Math.round(item.priority_score / 18))}</strong></div>
          </div>
          <div class="action-row">
            <button class="btn btn-sm btn-light">Approve</button>
            <button class="btn btn-sm btn-outline-light">Reject</button>
            <button class="btn btn-sm btn-light">Broadcast Alert</button>
            <button class="btn btn-sm btn-outline-light">Find Nearby Donors</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderDonors(rows) {
    const target = document.getElementById('donorMatchList');
    if (!rows.length) return empty(target, 'No eligible donor matches found for the current filter.');
    target.innerHTML = rows.map((donor) => `
      <article class="donor-card">
        <div class="donor-photo">${initials(donor.name)}</div>
        <div>
          <header><strong>${donor.name}</strong><span class="status-pill approved">${donor.blood_group || 'Any'}</span></header>
          <div class="small text-muted">${donor.city || 'Nearby'} - ${distanceFor(donor.id)} - ${donor.mobile || 'Phone hidden'}</div>
          <div class="small">Eligibility: <strong>${eligibleText(donor)}</strong> - Match score ${donor.match_score || 82}%</div>
        </div>
        <div class="donor-actions">
          <button class="btn btn-sm btn-danger" data-alert-donor="${donor.id}"><i data-lucide="message-circle"></i> WhatsApp</button>
          <a class="btn btn-sm btn-outline-dark" href="tel:${donor.mobile || ''}">Call</a>
          <button class="btn btn-sm btn-outline-dark" data-alert-donor="${donor.id}">Message</button>
        </div>
      </article>
    `).join('');
  }

  function openDonorAlertModal(donor = null) {
    const selectedGroup = donor?.blood_group || document.getElementById('matchBloodFilter')?.value || '';
    const hospital = state.data?.hospital || {};
    const message = donor
      ? `LifeLink alert from ${hospital.name || 'our hospital'}: We need ${donor.blood_group || 'compatible'} blood support today. Please confirm your availability from the LifeLink donor dashboard or contact the hospital.`
      : `LifeLink alert from ${hospital.name || 'our hospital'}: We need eligible blood donors for an active hospital request. Please confirm your availability from the LifeLink donor dashboard or contact the hospital.`;
    const modal = document.createElement('div');
    modal.className = 'modal fade donor-alert-modal';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <div>
              <p class="eyebrow mb-1">WhatsApp donor alert</p>
              <h5 class="modal-title">${donor ? `Send alert to ${escapeHtml(donor.name)}` : 'Send donor alert'}</h5>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <form id="donorAlertForm">
            <div class="modal-body">
              <div class="alert alert-danger border-0">
                This sends an in-app notification and a WhatsApp message through Twilio WhatsApp.
              </div>
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Blood group</label>
                  <select class="form-select" name="blood_group" ${donor ? 'disabled' : ''}>
                    ${['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((group) => `<option value="${group}" ${group === selectedGroup ? 'selected' : ''}>${group || 'All compatible donors'}</option>`).join('')}
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">City filter</label>
                  <input class="form-control" name="city" value="${escapeAttr(hospital.city || '')}" placeholder="Delhi">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Subject</label>
                  <input class="form-control" name="subject" value="LifeLink urgent blood donation request" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Maximum donors</label>
                  <input class="form-control" type="number" min="1" max="100" name="limit" value="${donor ? 1 : 25}">
                </div>
                <div class="col-12">
                  <label class="form-label">Message</label>
                  <textarea class="form-control" rows="5" name="message" minlength="12" required>${escapeHtml(message)}</textarea>
                </div>
                <input type="hidden" name="channels" value="whatsapp">
                <div class="col-12">
                  <div class="channel-grid">
                    <label class="whatsapp-only"><i data-lucide="message-circle"></i><span>WhatsApp message enabled</span><small>Configure Twilio WhatsApp credentials in .env for real delivery.</small></label>
                  </div>
                </div>
              </div>
              <div id="donorAlertResult" class="alert-result mt-3"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-danger"><i data-lucide="send"></i> Send Alert</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    LifeLink.initIcons();
    const bsModal = new bootstrap.Modal(modal);
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
    modal.querySelector('#donorAlertForm').addEventListener('submit', (event) => sendDonorAlert(event, donor));
    bsModal.show();
  }

  async function sendDonorAlert(event, donor) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const resultBox = form.querySelector('#donorAlertResult');
    const formData = new FormData(form);
    const channels = ['whatsapp'];
    const payload = {
      donor_ids: donor ? [donor.id] : [],
      blood_group: donor?.blood_group || formData.get('blood_group'),
      city: formData.get('city'),
      subject: formData.get('subject'),
      message: formData.get('message'),
      channels,
      limit: Number(formData.get('limit') || 25)
    };
    submit.disabled = true;
    submit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending';
    resultBox.innerHTML = '<div class="alert alert-info mb-0">Sending alerts to selected donors...</div>';
    try {
      const response = await LifeLink.api('/api/dashboard/hospital/donor-alert', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      resultBox.innerHTML = renderAlertResult(response);
      LifeLink.toast(response.message, 'success');
      state.data.notifications = [
        { title: 'Donor alert sent', message: response.message, type: 'success', created_at: new Date().toISOString() },
        ...(state.data.notifications || [])
      ].slice(0, 8);
      renderNotifications(state.data.notifications);
      LifeLink.initIcons();
    } catch (error) {
      resultBox.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(error.message)}</div>`;
      LifeLink.toast(error.message, 'error');
    } finally {
      submit.disabled = false;
      submit.innerHTML = '<i data-lucide="send"></i> Send Alert';
      LifeLink.initIcons();
    }
  }

  function renderAlertResult(response) {
    return `
      <div class="alert alert-success"><strong>${response.message}</strong><br><span class="small">Delivery is logged in the database for audit tracking.</span></div>
      <div class="delivery-list">
        ${(response.results || []).map((donor) => `
          <article>
            <strong>${escapeHtml(donor.donor_name)} <span>${escapeHtml(donor.blood_group || '')}</span></strong>
            <div>${(donor.delivery || []).map((item) => `<span class="delivery-pill ${item.status}">${escapeHtml(item.channel)}: ${escapeHtml(item.status.replace('_', ' '))}</span>`).join('')}</div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderAppointments(rows) {
    const target = document.getElementById('appointmentsTable');
    if (!rows.length) return emptyRow(target, 7, 'No appointments scheduled today.');
    target.innerHTML = rows.map((item, index) => `
      <tr>
        <td>${item.donor_name}</td>
        <td>${timeShort(item.appointment_at)}</td>
        <td><strong>${item.blood_group || '-'}</strong></td>
        <td><span class="status-pill ${item.status}">${capitalize(item.status)}</span></td>
        <td>${['Dr. Sen', 'Nurse Kavya', 'Ops Lead Ravi'][index % 3]}</td>
        <td>${item.notes || 'Routine donation'}</td>
        <td class="text-nowrap"><button class="btn btn-sm btn-outline-success">Accept</button> <button class="btn btn-sm btn-outline-dark">Reschedule</button> <button class="btn btn-sm btn-outline-danger">Cancel</button> <button class="btn btn-sm btn-danger">Complete</button></td>
      </tr>
    `).join('');
  }

  function renderNotifications(rows) {
    const target = document.getElementById('notificationFeed');
    if (!rows.length) return empty(target, 'You are all caught up.');
    target.innerHTML = rows.map((item) => `
      <article class="notification-item">
        <span class="notification-icon"><i data-lucide="${notificationIcon(item.type)}"></i></span>
        <div><strong>${item.title}</strong><p class="mb-1 text-muted">${item.message}</p><small>${relativeTime(item.created_at)}</small></div>
        <div class="d-flex gap-1"><button class="btn btn-sm btn-outline-dark">Read</button><button class="btn btn-sm btn-outline-danger">Delete</button></div>
      </article>
    `).join('');
  }

  function renderRequests(rows) {
    const target = document.getElementById('requestsTable');
    if (!rows.length) return emptyRow(target, 7, 'No recent blood requests.');
    target.innerHTML = rows.map((item) => `
      <tr>
        <td>#${item.id}</td>
        <td>${item.patient_name}</td>
        <td><strong>${item.blood_group}</strong></td>
        <td>${item.units_needed} units</td>
        <td><span class="status-pill ${item.status}">${capitalize(item.status)}</span></td>
        <td>${dateShort(item.created_at)}</td>
        <td class="text-nowrap"><button class="btn btn-sm btn-outline-dark">View</button> <button class="btn btn-sm btn-outline-success">Approve</button> <button class="btn btn-sm btn-outline-danger">Reject</button></td>
      </tr>
    `).join('');
  }

  function renderPredictions(rows) {
    const target = document.getElementById('predictionCards');
    target.innerHTML = rows.map((item) => `
      <article class="prediction-card">
        <strong>${item.title}</strong>
        <div class="confidence"><span>${item.confidence}%</span><div class="progress"><div class="progress-bar bg-danger" style="width:${item.confidence}%"></div></div></div>
        <p class="mb-2 mt-2 text-muted">${item.action}</p>
        <button class="btn btn-sm btn-danger">Auto notify donors</button>
      </article>
    `).join('');
  }

  function renderSubscription(item) {
    const target = document.getElementById('subscriptionPanel');
    target.innerHTML = `
      <h3>${item.plan_name || 'Pro'} Plan</h3>
      <p class="text-muted mb-2">${capitalize(item.status || 'active')} - Renewal ${dateShort(item.renewal_date)}</p>
      <div class="subscription-meter"><div class="d-flex justify-content-between"><span>Plan usage</span><strong>${item.usage_percent || 68}%</strong></div><div class="progress"><div class="progress-bar bg-danger" style="width:${item.usage_percent || 68}%"></div></div></div>
      <div class="feature-list">${(item.features || []).map((feature) => `<span><i data-lucide="check-circle"></i>${feature}</span>`).join('')}</div>
      <button class="btn btn-danger w-100">Upgrade Plan</button>
    `;
  }

  function renderActivities(rows) {
    const target = document.getElementById('activityTimeline');
    target.innerHTML = rows.map((item) => `<article class="activity-item"><strong>${item.message}</strong><div class="text-muted small">${relativeTime(item.created_at)}</div></article>`).join('');
  }

  function renderCharts(analytics) {
    state.charts.forEach((chart) => chart.destroy());
    state.charts = [];
    const monthly = analytics.monthly || [];
    const demand = analytics.demand || [];
    const usage = analytics.usage || [];
    const emergencies = analytics.emergencies || [];
    const availability = analytics.availability || [];
    state.charts.push(lineChart('monthlyChart', monthly.map((x) => x.label), monthly.map((x) => x.requests), 'Donations'));
    state.charts.push(barChart('usageChart', usage.map((x) => x.label), usage.map((x) => x.used), 'Used units', '#e9194f'));
    state.charts.push(barChart('emergencyChart', emergencies.map((x) => x.label), emergencies.map((x) => x.score), 'Priority', '#f59e0b'));
    state.charts.push(doughnutChart('demandChart', demand.map((x) => x.blood_group), demand.map((x) => x.units)));
    state.charts.push(barChart('availabilityChart', availability.map((x) => x.label), availability.map((x) => x.score), 'Availability score', '#12a376'));
    state.charts.push(lineChart('revenueChart', ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'], analytics.revenue || [], 'Revenue'));
    state.charts.push(lineChart('performanceChart', ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], analytics.performance || [], 'Performance'));
  }

  function lineChart(id, labels, data, label) {
    return new Chart(document.getElementById(id), {
      type: 'line',
      data: { labels, datasets: [{ label, data, borderColor: '#e9194f', backgroundColor: 'rgba(233,25,79,.12)', fill: true, tension: .38 }] },
      options: chartOptions()
    });
  }

  function barChart(id, labels, data, label, color) {
    return new Chart(document.getElementById(id), {
      type: 'bar',
      data: { labels, datasets: [{ label, data, backgroundColor: color, borderRadius: 8 }] },
      options: chartOptions()
    });
  }

  function doughnutChart(id, labels, data) {
    return new Chart(document.getElementById(id), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: ['#e9194f', '#2563eb', '#12a376', '#f59e0b', '#7c3aed', '#ef4444', '#14b8a6', '#64748b'] }] },
      options: { plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: false }
    });
  }

  function chartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,.18)' } }, x: { grid: { display: false } } }
    };
  }

  function showSkeletons() {
    document.getElementById('statsGrid').innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton"></div>').join('');
  }

  function hideLoader() {
    document.getElementById('dashboardLoader')?.classList.add('is-hidden');
  }

  function updateClock() {
    const now = new Date();
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function filterTables(event) {
    const value = event.target.value.toLowerCase();
    document.querySelectorAll('tbody tr, .donor-card, .notification-item').forEach((row) => {
      row.style.display = row.textContent.toLowerCase().includes(value) ? '' : 'none';
    });
  }

  function animateCounters() {
    document.querySelectorAll('[data-counter]').forEach((node) => {
      const raw = node.dataset.counter;
      if (!/^\d+$/.test(String(raw))) return;
      const target = Number(raw);
      let current = 0;
      const step = Math.max(1, Math.ceil(target / 32));
      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        node.textContent = current.toLocaleString('en-IN');
      }, 18);
    });
  }

  function empty(target, message) {
    target.innerHTML = `<div class="empty-state">${message}</div>`;
  }

  function emptyRow(target, colspan, message) {
    target.innerHTML = `<tr><td colspan="${colspan}"><div class="empty-state">${message}</div></td></tr>`;
  }

  function initials(name = '') {
    return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'LL';
  }

  function eligibleText(donor) {
    if (donor.next_eligible_date && new Date(donor.next_eligible_date) > new Date()) return 'Review date pending';
    if (Number(donor.hemoglobin || 0) && Number(donor.hemoglobin) < 12.5) return 'Needs health review';
    return 'Eligible now';
  }

  function notificationIcon(type) {
    return { danger: 'siren', warning: 'triangle-alert', success: 'badge-check', info: 'bell' }[type] || 'bell';
  }

  function timeRemaining(value) {
    if (!value) return '2h 00m';
    const ms = new Date(value).getTime() - Date.now();
    if (ms <= 0) return 'Due now';
    const minutes = Math.round(ms / 60000);
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  function dateShort(value) {
    if (!value) return 'Not set';
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function timeShort(value) {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  function relativeTime(value) {
    const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.round(minutes / 60);
    return `${hours} hours ago`;
  }

  function distanceFor(seed) {
    return `${((Number(seed) % 9) + 1).toFixed(1)} km`;
  }

  function money(paise = 0) {
    return `Rs ${(Number(paise) / 100).toLocaleString('en-IN')}`;
  }

  function signed(value = 0) {
    return `${value >= 0 ? '+' : ''}${value}`;
  }

  function capitalize(value = '') {
    return String(value).replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
  }

  function escapeAttr(value) {
    return String(value ?? '').replace(/"/g, '&quot;');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char]));
  }

  function futureMinutes(minutes) {
    return new Date(Date.now() + minutes * 60000).toISOString();
  }

  function pastMinutes(minutes) {
    return new Date(Date.now() - minutes * 60000).toISOString();
  }

  function pastHours(hours) {
    return new Date(Date.now() - hours * 3600000).toISOString();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', HospitalDashboard.init);
