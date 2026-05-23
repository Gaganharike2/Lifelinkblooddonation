const HospitalProfilePage = (() => {
  const api = '/api/hospital';
  let data = null;

  const nav = [
    ['hospital-dashboard.html', 'Dashboard', 'fa-gauge-high'],
    ['hospital-profile.html', 'Hospital Profile', 'fa-hospital'],
    ['search-donors.html', 'Search Donors', 'fa-magnifying-glass'],
    ['blood-request.html', 'Blood Requests', 'fa-droplet'],
    ['emergency-request.html', 'Emergency Requests', 'fa-truck-medical'],
    ['blood-inventory.html', 'Blood Inventory', 'fa-boxes-stacked'],
    ['appointments.html', 'Appointments', 'fa-calendar-check'],
    ['subscription-plan.html', 'Subscription Plan', 'fa-crown'],
    ['settings.html', 'Settings', 'fa-gear'],
    ['support.html', 'Support', 'fa-life-ring'],
    ['logout.html', 'Logout', 'fa-right-from-bracket']
  ];

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    LifeLink.requireRole(['hospital', 'admin', 'super_admin']);
    renderShell();
    bindChrome();
    await trackDevice();
    await load();
  }

  function renderShell() {
    document.getElementById('profileApp').innerHTML = `
      <div class="shell">
        <aside class="sidebar" id="sidebar">
          <a class="brand" href="/pages/hospital/hospital-dashboard.html"><span><i class="fa-solid fa-heart-pulse"></i></span>LifeLink</a>
          <nav class="nav-menu">
            ${nav.map(([href, label, icon]) => href === 'logout.html'
              ? `<button data-logout><i class="fa-solid ${icon}"></i>${label}</button>`
              : `<a class="${href === 'hospital-profile.html' ? 'active' : ''}" href="/pages/hospital/${href}"><i class="fa-solid ${icon}"></i>${label}</a>`).join('')}
          </nav>
        </aside>
        <main>
          <header class="topbar">
            <div class="d-flex align-items-center gap-2">
              <button class="icon-btn d-xl-none" id="menuBtn"><i class="fa-solid fa-bars"></i></button>
              <div><strong>Hospital Profile</strong><div class="small text-muted">LifeLink Hospital Workspace</div></div>
            </div>
            <label class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="profileSearch" placeholder="Search profile, documents, devices"></label>
            <div class="top-actions">
              <button class="icon-btn" id="themeToggle"><i class="fa-solid fa-moon"></i></button>
              <button class="icon-btn"><i class="fa-solid fa-bell"></i></button>
              <div class="dropdown">
                <button class="profile-btn" data-bs-toggle="dropdown"><span class="avatar">HP</span><span class="d-none d-md-inline">Profile</span><i class="fa-solid fa-chevron-down"></i></button>
                <ul class="dropdown-menu dropdown-menu-end shadow">
                  <li><a class="dropdown-item" href="/pages/hospital/subscription-plan.html">Subscription</a></li>
                  <li><a class="dropdown-item" href="/pages/hospital/settings.html">Settings</a></li>
                  <li><a class="dropdown-item" href="/pages/hospital/support.html">Help Center</a></li>
                  <li><hr class="dropdown-divider"></li>
                  <li><button class="dropdown-item text-danger" data-logout>Logout</button></li>
                </ul>
              </div>
            </div>
          </header>
          <section class="content" id="content">
            <div class="panel"><div class="empty">Loading hospital profile...</div></div>
          </section>
        </main>
      </div>
    `;
  }

  function bindChrome() {
    document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', LifeLink.logout));
    document.getElementById('menuBtn')?.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    document.getElementById('themeToggle').addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('lifelink_profile_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });
    if (localStorage.getItem('lifelink_profile_theme') === 'dark') document.body.classList.add('dark-mode');
    document.getElementById('profileSearch').addEventListener('input', filterVisibleText);
  }

  async function load() {
    try {
      data = await LifeLink.api(`${api}/profile`);
      render();
    } catch (error) {
      document.getElementById('content').innerHTML = `<div class="panel"><div class="empty text-danger">${error.message}</div></div>`;
    }
  }

  async function trackDevice() {
    try {
      await LifeLink.api(`${api}/profile/security/device`, {
        method: 'POST',
        body: JSON.stringify({ device_name: navigator.platform || 'Current browser' })
      });
    } catch {
      // Device tracking should never block profile loading.
    }
  }

  function render() {
    const p = data.profile || {};
    document.getElementById('content').innerHTML = `
      <section class="hero">
        <div class="cover">${p.cover_url ? `<img src="${p.cover_url}" alt="Hospital cover">` : ''}</div>
        <div class="hero-body">
          <div>
            <div class="logo-preview">${p.logo_url ? `<img src="${p.logo_url}" alt="Hospital logo">` : '<i class="fa-solid fa-hospital"></i>'}</div>
            <p class="eyebrow mt-3">Verified healthcare profile</p>
            <h1>${escapeHtml(p.name || p.hospital_name || 'Hospital')}</h1>
            <p class="text-muted mb-0">${escapeHtml(p.full_address || 'Complete your hospital address')} · ${escapeHtml(p.city || 'City not set')}</p>
          </div>
          <div class="hero-actions">
            <button class="btn btn-red" id="saveTop">Save Changes</button>
            <button class="btn btn-outline-danger" id="gpsButton"><i class="fa-solid fa-location-crosshairs"></i> GPS Auto Detect</button>
            <a class="btn btn-dark" href="/pages/hospital/subscription-plan.html">Subscription</a>
          </div>
        </div>
      </section>

      <div class="grid-two">
        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Hospital details</p><h2>Editable Profile</h2></div><button class="btn btn-red" id="saveProfile">Save changes</button></div>
          <form id="profileForm" class="form-grid">
            ${input('hospital_name', 'Hospital name', p.hospital_name || p.name)}
            ${input('registration_number', 'Registration number', p.registration_number)}
            ${input('license_number', 'License number', p.license_number)}
            ${input('gst_number', 'GST number', p.gst_number)}
            ${input('establishment_year', 'Establishment year', p.establishment_year, 'number')}
            ${select('hospital_category', 'Hospital category', p.hospital_category, ['Multi-specialty', 'General', 'Cancer care', 'Cardiac', 'Trauma center'])}
            ${select('hospital_type', 'Hospital type', p.hospital_type, ['Private', 'Government', 'Trust', 'Clinic', 'Blood bank attached'])}
            ${input('phone', 'Phone', p.phone)}
            ${input('whatsapp', 'WhatsApp', p.whatsapp)}
            ${input('emergency_helpline', 'Emergency helpline', p.emergency_helpline)}
            ${input('website', 'Website', p.website)}
            ${input('country', 'Country', p.country || 'India')}
            ${input('state', 'State', p.state)}
            ${input('city', 'City', p.city)}
            ${input('pincode', 'Pincode', p.pincode)}
            ${input('full_address', 'Full address', p.full_address, 'text', 'wide')}
            ${input('latitude', 'Latitude', p.latitude)}
            ${input('longitude', 'Longitude', p.longitude)}
          </form>
        </section>

        <aside>
          <section class="panel">
            <div class="panel-head"><div><p class="eyebrow">Brand assets</p><h2>Logo & Cover</h2></div></div>
            <form id="mediaForm">
              <label class="form-label">Hospital logo</label>
              <input class="form-control mb-2" type="file" name="logo" accept="image/*">
              <label class="form-label">Cover image</label>
              <input class="form-control mb-3" type="file" name="cover" accept="image/*">
              <button class="btn btn-red w-100">Upload media</button>
            </form>
          </section>

          <section class="panel">
            <div class="panel-head"><div><p class="eyebrow">Verification</p><h2>License Documents</h2></div></div>
            <form id="documentForm">
              <input class="form-control mb-2" type="file" name="document" accept=".pdf,image/*" required>
              <select class="form-select mb-2" name="document_type"><option value="license">Hospital License</option><option value="registration">Registration Certificate</option><option value="gst">GST Certificate</option></select>
              <button class="btn btn-red w-100">Upload document</button>
            </form>
            <div class="doc-list mt-3" id="docList">${documentsHtml()}</div>
          </section>
        </aside>
      </div>

      <div class="grid-two">
        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Location</p><h2>Google Maps Location</h2></div><button class="btn btn-outline-danger" id="saveLocation">Save location</button></div>
          <div class="map-box" id="mapBox">
            <span class="pin" id="mapPin"></span>
            <div class="map-meta"><strong>Latitude:</strong> <span id="latText">${p.latitude || '-'}</span> · <strong>Longitude:</strong> <span id="lngText">${p.longitude || '-'}</span><br><span class="text-muted">Drag marker simulation or use GPS auto detect. Google Maps key is loaded through backend config when available.</span></div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Hours</p><h2>Hospital Hours</h2></div></div>
          <form id="hoursForm" class="form-grid">
            ${input('monday_hours', 'Monday', p.monday_hours || '09:00 - 18:00')}
            ${input('tuesday_hours', 'Tuesday', p.tuesday_hours || '09:00 - 18:00')}
            ${input('wednesday_hours', 'Wednesday', p.wednesday_hours || '09:00 - 18:00')}
            ${input('thursday_hours', 'Thursday', p.thursday_hours || '09:00 - 18:00')}
            ${input('friday_hours', 'Friday', p.friday_hours || '09:00 - 18:00')}
            ${input('saturday_hours', 'Saturday', p.saturday_hours || '10:00 - 16:00')}
            ${input('sunday_hours', 'Sunday', p.sunday_hours || 'Emergency only')}
            <label><span class="small text-muted">24x7 emergency</span><select class="form-select" name="emergency_24x7"><option value="1" ${Number(p.emergency_24x7 ?? 1) ? 'selected' : ''}>Enabled</option><option value="0" ${Number(p.emergency_24x7 ?? 1) ? '' : 'selected'}>Disabled</option></select></label>
          </form>
        </section>
      </div>

      <div class="grid-two">
        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Security</p><h2>Password & OTP</h2></div></div>
          <div class="security-card">
            <form id="passwordForm" class="form-grid">
              ${input('current_password', 'Current password', '', 'password')}
              ${input('new_password', 'New password', '', 'password')}
              ${input('confirm_password', 'Confirm password', '', 'password')}
              <button class="btn btn-red wide">Change password</button>
            </form>
          </div>
          <div class="security-card mt-3">
            <form id="settingsForm" class="form-grid">
              ${toggleSelect('two_factor_enabled', 'Two-factor authentication', data.settings?.two_factor_enabled)}
              ${toggleSelect('email_notifications', 'Email notifications', data.settings?.email_notifications ?? 1)}
              ${toggleSelect('sms_notifications', 'SMS notifications', data.settings?.sms_notifications ?? 1)}
              <label><span class="small text-muted">OTP channel</span><select class="form-select" name="otp_channel"><option>both</option><option>email</option><option>sms</option></select></label>
              <button class="btn btn-outline-danger wide">Save security settings</button>
            </form>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Device tracking</p><h2>Recent Devices</h2></div></div>
          <div class="device-list">${devicesHtml()}</div>
        </section>
      </div>
    `;
    bindContent();
  }

  function bindContent() {
    document.getElementById('saveProfile').addEventListener('click', saveProfile);
    document.getElementById('saveTop').addEventListener('click', saveProfile);
    document.getElementById('mediaForm').addEventListener('submit', uploadMedia);
    document.getElementById('documentForm').addEventListener('submit', uploadDocument);
    document.getElementById('gpsButton').addEventListener('click', detectLocation);
    document.getElementById('saveLocation').addEventListener('click', saveLocation);
    document.getElementById('passwordForm').addEventListener('submit', changePassword);
    document.getElementById('settingsForm').addEventListener('submit', saveSettings);
    document.querySelectorAll('[data-delete-doc]').forEach((button) => button.addEventListener('click', () => deleteDocument(button.dataset.deleteDoc)));
    bindMapDrag();
  }

  async function saveProfile() {
    const payload = { ...Object.fromEntries(new FormData(document.getElementById('profileForm'))), ...Object.fromEntries(new FormData(document.getElementById('hoursForm'))) };
    try {
      await LifeLink.api(`${api}/profile`, { method: 'PUT', body: JSON.stringify(payload) });
      LifeLink.toast('Hospital profile saved');
      await load();
    } catch (error) {
      LifeLink.toast(error.message, 'error');
    }
  }

  async function uploadMedia(event) {
    event.preventDefault();
    await uploadForm(`${api}/profile/media`, event.target, 'Hospital media updated');
  }

  async function uploadDocument(event) {
    event.preventDefault();
    await uploadForm(`${api}/profile/documents`, event.target, 'Document uploaded for verification');
  }

  async function uploadForm(url, form, success) {
    try {
      const response = await fetch(LifeLink.apiUrl(url), { method: 'POST', headers: LifeLink.authHeaders(), body: new FormData(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Upload failed');
      LifeLink.toast(success);
      form.reset();
      await load();
    } catch (error) {
      LifeLink.toast(error.message, 'error');
    }
  }

  async function deleteDocument(id) {
    if (!confirm('Delete this document?')) return;
    try {
      await LifeLink.api(`${api}/profile/documents/${id}`, { method: 'DELETE' });
      LifeLink.toast('Document deleted');
      await load();
    } catch (error) {
      LifeLink.toast(error.message, 'error');
    }
  }

  async function detectLocation() {
    if (!navigator.geolocation) return LifeLink.toast('GPS is not supported by this browser', 'error');
    navigator.geolocation.getCurrentPosition((position) => {
      setLocation(position.coords.latitude, position.coords.longitude);
      LifeLink.toast('GPS location detected');
    }, (error) => LifeLink.toast(error.message, 'error'));
  }

  async function saveLocation() {
    const form = document.getElementById('profileForm');
    const payload = {
      latitude: form.latitude.value,
      longitude: form.longitude.value,
      full_address: form.full_address.value
    };
    try {
      await LifeLink.api(`${api}/profile/location`, { method: 'PUT', body: JSON.stringify(payload) });
      LifeLink.toast('Location saved');
      await load();
    } catch (error) {
      LifeLink.toast(error.message, 'error');
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.target));
    if (payload.new_password !== payload.confirm_password) return LifeLink.toast('Passwords do not match', 'error');
    try {
      await LifeLink.api(`${api}/profile/security/password`, { method: 'POST', body: JSON.stringify(payload) });
      LifeLink.toast('Password changed successfully');
      event.target.reset();
    } catch (error) {
      LifeLink.toast(error.message, 'error');
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    try {
      await LifeLink.api(`${api}/settings`, { method: 'PUT', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
      LifeLink.toast('Security settings saved');
      await load();
    } catch (error) {
      LifeLink.toast(error.message, 'error');
    }
  }

  function bindMapDrag() {
    const pin = document.getElementById('mapPin');
    const box = document.getElementById('mapBox');
    let dragging = false;
    pin.addEventListener('pointerdown', (event) => { dragging = true; pin.setPointerCapture?.(event.pointerId); });
    window.addEventListener('pointerup', () => { dragging = false; });
    box.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const rect = box.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      pin.style.left = `${x * 100}%`;
      pin.style.top = `${y * 100}%`;
      const lat = (8 + (1 - y) * 28).toFixed(7);
      const lng = (68 + x * 30).toFixed(7);
      setLocation(lat, lng);
    });
  }

  function setLocation(lat, lng) {
    const form = document.getElementById('profileForm');
    form.latitude.value = lat;
    form.longitude.value = lng;
    document.getElementById('latText').textContent = lat;
    document.getElementById('lngText').textContent = lng;
  }

  function filterVisibleText(event) {
    const value = event.target.value.toLowerCase();
    document.querySelectorAll('.panel, .doc-card, .device-card').forEach((node) => {
      node.style.display = node.textContent.toLowerCase().includes(value) ? '' : 'none';
    });
  }

  function documentsHtml() {
    const documents = data.documents || [];
    if (!documents.length) return '<div class="empty">No license documents uploaded yet.</div>';
    return documents.map((doc) => `
      <article class="doc-card">
        <span class="doc-icon"><i class="fa-solid ${doc.mime_type?.includes('pdf') ? 'fa-file-pdf' : 'fa-file-image'}"></i></span>
        <div><strong>${escapeHtml(doc.document_type)}</strong><div class="small text-muted">${escapeHtml(doc.file_name)}</div><span class="status-pill ${doc.verification_status === 'verified' ? 'ok' : 'warn'}">${escapeHtml(doc.verification_status)}</span></div>
        <div class="d-flex gap-1"><a class="btn btn-sm btn-outline-dark" href="${doc.file_url}" target="_blank">Preview</a><button class="btn btn-sm btn-outline-danger" data-delete-doc="${doc.id}">Delete</button></div>
      </article>
    `).join('');
  }

  function devicesHtml() {
    const devices = data.devices || [];
    if (!devices.length) return '<div class="empty">No device activity yet.</div>';
    return devices.map((device) => `
      <article class="device-card">
        <span class="doc-icon"><i class="fa-solid fa-laptop-medical"></i></span>
        <div><strong>${escapeHtml(device.device_name || 'Browser')}</strong><div class="small text-muted">${escapeHtml(device.ip_address || 'IP hidden')}</div><div class="small text-muted">${escapeHtml(device.user_agent || '')}</div></div>
        <span class="status-pill ok">${dateTime(device.last_seen_at || device.created_at)}</span>
      </article>
    `).join('');
  }

  function input(name, label, value = '', type = 'text', className = '') {
    return `<label class="${className}"><span class="small text-muted">${label}</span><input class="form-control" name="${name}" type="${type}" value="${escapeAttr(value || '')}"></label>`;
  }

  function select(name, label, value, options) {
    return `<label><span class="small text-muted">${label}</span><select class="form-select" name="${name}">${options.map((option) => `<option ${option === value ? 'selected' : ''}>${option}</option>`).join('')}</select></label>`;
  }

  function toggleSelect(name, label, value) {
    return `<label><span class="small text-muted">${label}</span><select class="form-select" name="${name}"><option value="1" ${Number(value) ? 'selected' : ''}>Enabled</option><option value="0" ${Number(value) ? '' : 'selected'}>Disabled</option></select></label>`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
  }

  function dateTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
})();
