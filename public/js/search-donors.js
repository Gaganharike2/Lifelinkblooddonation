const SearchDonors = (() => {
  const state = { rows: [], total: 0, limit: 10, offset: 0, map: null, markers: [], timer: null, mapProvider: 'leaflet', mapConfig: null, mapCenter: null };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    LifeLink.requireRole(['hospital', 'admin', 'super_admin']);
    bindEvents();
    await loadMapProvider();
    await ensureLeaflet();
    await loadDonors();
  }

  function bindEvents() {
    document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', LifeLink.logout));
    document.getElementById('openSidebar')?.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('lifelink_search_donors_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });
    if (localStorage.getItem('lifelink_search_donors_theme') === 'dark') document.body.classList.add('dark-mode');

    document.getElementById('globalSearch').addEventListener('input', debounce(() => {
      state.offset = 0;
      loadDonors();
    }, 350));
    document.getElementById('filterForm').addEventListener('input', debounce(() => {
      state.offset = 0;
      loadDonors();
    }, 250));
    document.getElementById('pageSize').addEventListener('change', (event) => {
      state.limit = Number(event.target.value);
      state.offset = 0;
      loadDonors();
    });
    document.getElementById('prevPage').addEventListener('click', () => {
      state.offset = Math.max(0, state.offset - state.limit);
      loadDonors();
    });
    document.getElementById('nextPage').addEventListener('click', () => {
      if (state.offset + state.limit < state.total) {
        state.offset += state.limit;
        loadDonors();
      }
    });
    document.getElementById('resetBtn').addEventListener('click', () => {
      document.getElementById('filterForm').reset();
      document.getElementById('globalSearch').value = '';
      state.offset = 0;
      loadDonors();
    });
    document.getElementById('broadcastBtn').addEventListener('click', () => openAlertModal());
    document.getElementById('exportBtn').addEventListener('click', exportCsv);
    document.addEventListener('click', handleActionClick);
  }

  async function loadDonors() {
    showLoading();
    try {
      const query = buildQuery();
      const data = await LifeLink.api(`/api/hospital/donors?${query}`);
      state.rows = data.rows || [];
      state.total = Number(data.total || 0);
      state.mapCenter = data.map_center || null;
      render();
    } catch (error) {
      document.getElementById('donorList').innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
      LifeLink.toast(error.message, 'error');
    } finally {
      document.getElementById('pageLoader')?.classList.add('is-hidden');
    }
  }

  function buildQuery() {
    const params = new URLSearchParams();
    const formData = new FormData(document.getElementById('filterForm'));
    for (const [key, value] of formData.entries()) {
      if (value) params.set(key, value);
    }
    const q = document.getElementById('globalSearch').value.trim();
    if (q) params.set('q', q);
    params.set('limit', state.limit);
    params.set('offset', state.offset);
    return params.toString();
  }

  function render() {
    renderMetrics();
    renderDonors();
    renderBestMatch();
    renderMap();
    updatePager();
  }

  function renderMetrics() {
    const eligible = state.rows.filter((donor) => donor.eligibility === 'eligible').length;
    const available = state.rows.filter((donor) => donor.availability === 'available').length;
    const rare = state.rows.filter((donor) => ['O-', 'AB-', 'A-', 'B-'].includes(donor.blood_group)).length;
    const avgScore = state.rows.length ? Math.round(state.rows.reduce((sum, donor) => sum + Number(donor.match_score || 0), 0) / state.rows.length) : 0;
    document.getElementById('metrics').innerHTML = [
      ['fa-users', 'Total matches', state.total.toLocaleString('en-IN')],
      ['fa-user-check', 'Available on page', available],
      ['fa-shield-heart', 'Eligible on page', eligible],
      ['fa-brain', 'Avg AI score', `${avgScore}%`],
      ['fa-star-of-life', 'Rare groups', rare],
      ['fa-location-dot', 'Map pins', state.rows.filter((d) => d.latitude && d.longitude).length],
      ['fa-envelope-circle-check', 'Email ready', state.rows.filter((d) => d.email).length],
      ['fa-whatsapp', 'WhatsApp ready', state.rows.filter((d) => d.phone || d.mobile).length]
    ].map(([icon, label, value]) => `<article class="metric-card"><span><i class="fa-solid ${icon}"></i>${label}</span><strong>${value}</strong></article>`).join('');
  }

  function renderDonors() {
    const target = document.getElementById('donorList');
    document.getElementById('resultCount').textContent = `${state.total.toLocaleString('en-IN')} result${state.total === 1 ? '' : 's'}`;
    if (!state.rows.length) {
      target.innerHTML = '<div class="empty-state">No verified donors matched these filters. Try widening distance, city or blood group.</div>';
      return;
    }
    target.innerHTML = state.rows.map((donor) => `
      <article class="donor-card">
        <div class="donor-avatar">${initials(donor.name)}</div>
        <div class="donor-main">
          <h3>${escapeHtml(donor.name)} <span class="pill red">${escapeHtml(donor.blood_group || 'Any')}</span></h3>
          <div class="donor-meta">
            <span class="pill"><i class="fa-solid fa-location-dot"></i>${escapeHtml(donor.city || 'Unknown city')}</span>
            <span class="pill ${donor.availability === 'available' ? 'green' : 'amber'}">${escapeHtml(donor.availability || 'available')}</span>
            <span class="pill ${donor.eligibility === 'eligible' ? 'green' : 'amber'}">${escapeHtml(donor.eligibility || 'review')}</span>
            <span class="pill">${distanceText(donor.distance_km)}</span>
            <span class="pill">Age ${donor.age || '-'}</span>
            <span class="pill">Hb ${donor.hemoglobin || '-'}</span>
          </div>
          <div class="small text-muted">Last donation: ${dateText(donor.last_donation_date)} | Next eligible: ${dateText(donor.next_eligible_date)} | ${escapeHtml(donor.email || 'No email')}</div>
          <div class="score-bar mt-2"><span style="width:${Math.min(100, donor.match_score || 0)}%"></span></div>
        </div>
        <div class="donor-actions">
          <button class="btn btn-sm btn-danger" data-send-request="${donor.id}"><i class="fa-solid fa-hand-holding-droplet"></i> Send Request</button>
          <button class="btn btn-sm btn-outline-danger" data-alert="${donor.id}"><i class="fa-brands fa-whatsapp"></i> Email + WhatsApp</button>
          <a class="btn btn-sm btn-outline-dark" href="tel:${escapeAttr(donor.phone || donor.mobile || '')}"><i class="fa-solid fa-phone"></i> Call</a>
          <button class="btn btn-sm btn-outline-dark" data-view="${donor.id}"><i class="fa-solid fa-eye"></i> View</button>
        </div>
      </article>
    `).join('');
  }

  function renderBestMatch() {
    const best = [...state.rows].sort((a, b) => Number(b.match_score || 0) - Number(a.match_score || 0))[0];
    const target = document.getElementById('bestMatch');
    if (!best) {
      target.innerHTML = '<div class="empty-state">No AI recommendation available.</div>';
      return;
    }
    target.innerHTML = `
      <article class="best-card">
        <strong>${escapeHtml(best.name)}</strong>
        <div class="donor-meta"><span class="pill red">${escapeHtml(best.blood_group || '-')}</span><span class="pill green">${best.match_score || 0}% match</span><span class="pill">${distanceText(best.distance_km)}</span></div>
        <p class="text-muted small mb-3">Recommended because this donor is nearby, ${escapeHtml(best.availability || 'available')}, and currently ${escapeHtml(best.eligibility || 'eligible')}.</p>
        <button class="btn btn-danger w-100" data-alert="${best.id}"><i class="fa-brands fa-whatsapp"></i> Alert Best Donor</button>
      </article>
    `;
  }

  function renderMap() {
    const mapEl = document.getElementById('donorMap');
    const donorsWithLocation = state.rows.filter((donor) => isValidCoordinate(donor.latitude, donor.longitude));
    if (state.mapProvider === 'leaflet' && window.L && mapEl) {
      renderLeafletMap(mapEl, donorsWithLocation);
      return;
    }
    if (state.mapProvider === 'google' && window.google?.maps && mapEl) {
      const defaultCenter = donorsWithLocation[0]
        ? latLng(donorsWithLocation[0])
        : fallbackCenter();
      if (!state.map) {
        state.map = new google.maps.Map(document.getElementById('donorMap'), {
          center: defaultCenter,
          zoom: donorsWithLocation.length ? 13 : 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true
        });
      }
      state.markers.forEach((marker) => marker.setMap(null));
      state.markers = donorsWithLocation.map((donor) => new google.maps.Marker({
        map: state.map,
        position: latLng(donor),
        title: `${donor.name} (${donor.blood_group || '-'})`
      }));
      if (!state.markers.length) {
        state.map.setCenter(defaultCenter);
        state.map.setZoom(11);
      } else if (state.markers.length === 1) {
        state.map.setCenter(state.markers[0].getPosition());
        state.map.setZoom(13);
      } else {
        const bounds = new google.maps.LatLngBounds();
        state.markers.forEach((marker) => bounds.extend(marker.getPosition()));
        state.map.fitBounds(bounds, 72);
        google.maps.event.addListenerOnce(state.map, 'idle', () => {
          if (state.map.getZoom() < 9) state.map.setZoom(9);
          if (state.map.getZoom() > 14) state.map.setZoom(14);
        });
      }
      return;
    }
    mapEl.innerHTML = '<div class="map-empty">Map fallback view. Leaflet/OpenStreetMap CDN is not reachable, but donor coordinates still come from MySQL.</div>' + state.rows.slice(0, 14).map((donor, index) => {
      const x = 12 + ((index * 23) % 76);
      const y = 18 + ((index * 31) % 62);
      return `<span class="fake-pin ${donor.availability || ''}" style="left:${x}%;top:${y}%" title="${escapeAttr(donor.name)}"></span>`;
    }).join('');
  }

  function renderLeafletMap(mapEl, donorsWithLocation) {
    const center = fallbackCenter();
    const defaultCenter = donorsWithLocation[0] ? [Number(donorsWithLocation[0].latitude), Number(donorsWithLocation[0].longitude)] : [center.lat, center.lng];
    if (!state.map || !state.map._leaflet_id) {
      mapEl.innerHTML = '';
      state.map = L.map(mapEl, { scrollWheelZoom: true }).setView(defaultCenter, donorsWithLocation.length ? 13 : 11);
      L.tileLayer(state.mapConfig?.mapTileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: state.mapConfig?.mapAttribution || '&copy; OpenStreetMap contributors'
      }).addTo(state.map);
      setTimeout(() => state.map.invalidateSize(), 80);
    }
    state.markers.forEach((marker) => marker.remove());
    state.markers = donorsWithLocation.map((donor) => L.marker([Number(donor.latitude), Number(donor.longitude)])
      .addTo(state.map)
      .bindPopup(`<strong>${escapeHtml(donor.name)}</strong><br>${escapeHtml(donor.blood_group || '-')} | ${escapeHtml(donor.city || '')}<br>${escapeHtml(donor.availability || 'available')}`));
    if (!state.markers.length) {
      state.map.setView(defaultCenter, 11);
    } else if (state.markers.length === 1) {
      state.map.setView(state.markers[0].getLatLng(), 13);
    } else {
      state.map.fitBounds(L.featureGroup(state.markers).getBounds(), { padding: [32, 32], maxZoom: 14 });
    }
  }

  function isValidCoordinate(latitude, longitude) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  function latLng(row) {
    return { lat: Number(row.latitude), lng: Number(row.longitude) };
  }

  function fallbackCenter() {
    if (state.mapCenter?.latitude && state.mapCenter?.longitude) {
      return { lat: Number(state.mapCenter.latitude), lng: Number(state.mapCenter.longitude) };
    }
    return { lat: 30.2110, lng: 74.9455 };
  }

  async function handleActionClick(event) {
    const requestButton = event.target.closest('[data-send-request]');
    const alertButton = event.target.closest('[data-alert]');
    const viewButton = event.target.closest('[data-view]');
    if (requestButton) return sendRequest(Number(requestButton.dataset.sendRequest));
    if (alertButton) return openAlertModal(findDonor(Number(alertButton.dataset.alert)));
    if (viewButton) return openDonorDetails(findDonor(Number(viewButton.dataset.view)));
  }

  async function sendRequest(donorId) {
    const donor = findDonor(donorId);
    if (!donor) return;
    try {
      const response = await LifeLink.api('/api/hospital/donor-requests', {
        method: 'POST',
        body: JSON.stringify({
          donor_id: donor.id,
          blood_group: donor.blood_group || '',
          message: `LifeLink request: ${donor.blood_group || 'compatible'} donor support needed. Please confirm your availability.`
        })
      });
      LifeLink.toast(response.message);
    } catch (error) {
      LifeLink.toast(error.message, 'error');
    }
  }

  function openDonorDetails(donor) {
    if (!donor) return;
    showModal('Donor Details', `
      <div class="row g-3">
        <div class="col-md-6"><b>Name</b><div>${escapeHtml(donor.name)}</div></div>
        <div class="col-md-6"><b>Blood Group</b><div>${escapeHtml(donor.blood_group || '-')}</div></div>
        <div class="col-md-6"><b>Email</b><div>${escapeHtml(donor.email || '-')}</div></div>
        <div class="col-md-6"><b>Phone</b><div>${escapeHtml(donor.phone || donor.mobile || '-')}</div></div>
        <div class="col-md-6"><b>Eligibility</b><div>${escapeHtml(donor.eligibility || '-')}</div></div>
        <div class="col-md-6"><b>AI Match</b><div>${donor.match_score || 0}%</div></div>
      </div>
    `);
  }

  function openAlertModal(donor = null) {
    const formData = new FormData(document.getElementById('filterForm'));
    const bloodGroup = donor?.blood_group || formData.get('blood_group') || '';
    const city = donor?.city || formData.get('city') || '';
    const defaultMessage = donor
      ? `LifeLink hospital alert: ${donor.blood_group || 'compatible'} blood support is needed. Please confirm your availability from your LifeLink donor dashboard or contact the hospital.`
      : `LifeLink hospital alert: Blood donor support is needed for an active hospital request. Please confirm your availability from your LifeLink donor dashboard or contact the hospital.`;
    showModal(donor ? `Alert ${escapeHtml(donor.name)}` : 'Broadcast Donor Alert', `
      <form id="alertForm" class="row g-3">
        <div class="col-md-6"><label class="form-label">Blood group</label><input class="form-control" name="blood_group" value="${escapeAttr(bloodGroup)}" ${donor ? 'readonly' : ''}></div>
        <div class="col-md-6"><label class="form-label">City</label><input class="form-control" name="city" value="${escapeAttr(city)}"></div>
        <div class="col-md-8"><label class="form-label">Subject</label><input class="form-control" name="subject" value="LifeLink urgent blood donation request" required></div>
        <div class="col-md-4"><label class="form-label">Max donors</label><input class="form-control" type="number" name="limit" min="1" max="100" value="${donor ? 1 : 25}"></div>
        <div class="col-12"><label class="form-label">Message</label><textarea class="form-control" name="message" rows="5" minlength="12" required>${escapeHtml(defaultMessage)}</textarea></div>
        <div class="col-12 channel-grid">
          <label><input class="form-check-input me-2" type="checkbox" name="channels" value="email" checked>Email</label>
          <label><input class="form-check-input me-2" type="checkbox" name="channels" value="whatsapp" checked>WhatsApp</label>
        </div>
        <div class="col-12" id="alertResult"></div>
      </form>
    `, {
      saveText: 'Send Alert',
      onSave: () => sendAlert(donor)
    });
  }

  async function sendAlert(donor) {
    const form = document.getElementById('alertForm');
    const formData = new FormData(form);
    const payload = {
      donor_ids: donor ? [donor.id] : [],
      blood_group: formData.get('blood_group'),
      city: formData.get('city'),
      subject: formData.get('subject'),
      message: formData.get('message'),
      channels: formData.getAll('channels'),
      limit: Number(formData.get('limit') || 25)
    };
    const resultBox = document.getElementById('alertResult');
    resultBox.innerHTML = '<div class="alert alert-info mb-0">Sending donor alert...</div>';
    try {
      const response = await LifeLink.api('/api/dashboard/hospital/donor-alert', { method: 'POST', body: JSON.stringify(payload) });
      resultBox.innerHTML = `<div class="alert alert-success"><b>${escapeHtml(response.message)}</b></div><div class="delivery-list">${(response.results || []).map((row) => `<article><b>${escapeHtml(row.donor_name)}</b><div>${(row.delivery || []).map((item) => `<span class="delivery-pill ${item.status}">${escapeHtml(item.channel)}: ${escapeHtml(item.status.replace('_', ' '))}</span>`).join('')}</div></article>`).join('')}</div>`;
      LifeLink.toast(response.message);
    } catch (error) {
      resultBox.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(error.message)}</div>`;
      throw error;
    }
  }

  function showModal(title, body, options = {}) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `<div class="modal-dialog modal-lg modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">${title}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body">${body}</div><div class="modal-footer"><button class="btn btn-light" data-bs-dismiss="modal">Close</button>${options.onSave ? `<button class="btn btn-danger" id="modalSave">${options.saveText || 'Save'}</button>` : ''}</div></div></div>`;
    document.body.appendChild(modal);
    const instance = new bootstrap.Modal(modal);
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
    modal.querySelector('#modalSave')?.addEventListener('click', async () => {
      try {
        await options.onSave();
      } catch (error) {
        LifeLink.toast(error.message, 'error');
      }
    });
    instance.show();
  }

  async function loadMapProvider() {
    try {
      const config = await LifeLink.api('/api/config');
      state.mapConfig = config;
      state.mapProvider = config.mapProvider || 'leaflet';
      if (state.mapProvider !== 'google') return;
      if (!config.googleMapsApiKey || window.google?.maps) return;
      await new Promise((resolve, reject) => {
        window.initSearchDonorMap = resolve;
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.googleMapsApiKey)}&callback=initSearchDonorMap&loading=async`;
        script.async = true;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    } catch {
      return null;
    }
  }

  async function ensureLeaflet() {
    if (state.mapProvider !== 'leaflet' || window.L) return;
    await Promise.all([
      loadCssOnce('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css'),
      loadScriptOnce('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js')
    ]).catch(() => null);
  }

  function loadScriptOnce(src) {
    if (document.querySelector(`script[src="${src}"]`)) {
      return new Promise((resolve) => setTimeout(resolve, 600));
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function loadCssOnce(href) {
    if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    return Promise.resolve();
  }

  function exportCsv() {
    if (!state.rows.length) return LifeLink.toast('No donors to export', 'warning');
    const headers = ['Name', 'Blood Group', 'City', 'Phone', 'Email', 'Availability', 'Eligibility', 'Distance KM', 'AI Score'];
    const rows = state.rows.map((donor) => [donor.name, donor.blood_group, donor.city, donor.phone || donor.mobile, donor.email, donor.availability, donor.eligibility, donor.distance_km, donor.match_score]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `lifelink-donors-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function updatePager() {
    const page = Math.floor(state.offset / state.limit) + 1;
    const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    document.getElementById('pageInfo').textContent = `Page ${page} of ${totalPages}`;
    document.getElementById('prevPage').disabled = state.offset === 0;
    document.getElementById('nextPage').disabled = state.offset + state.limit >= state.total;
  }

  function showLoading() {
    document.getElementById('donorList').innerHTML = Array.from({ length: 5 }, () => '<div class="donor-card"><div class="donor-avatar"><i class="fa-solid fa-spinner fa-spin"></i></div><div class="donor-main"><h3>Loading donor</h3><div class="score-bar"><span style="width:75%"></span></div></div></div>').join('');
  }

  function findDonor(id) {
    return state.rows.find((donor) => Number(donor.id) === Number(id));
  }

  function debounce(fn, wait) {
    return (...args) => {
      clearTimeout(state.timer);
      state.timer = setTimeout(() => fn(...args), wait);
    };
  }

  function initials(name = '') {
    return String(name).split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'LL';
  }

  function dateText(value) {
    return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not recorded';
  }

  function distanceText(value) {
    return value === null || value === undefined ? 'Distance unavailable' : `${Number(value).toFixed(1)} km`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
  }
})();
