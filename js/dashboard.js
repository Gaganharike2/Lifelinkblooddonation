async function loadSummary() {
  const data = await LifeLink.api('/api/dashboard/summary');
  document.querySelectorAll('[data-user-name]').forEach((el) => { el.textContent = data.user.name; });
  document.querySelectorAll('[data-referral-code]').forEach((el) => { el.textContent = data.user.referral_code || 'Not generated'; });
  setText('[data-points]', data.stats.points);
  setText('[data-open-requests]', data.stats.openRequests);
  setText('[data-donors]', data.stats.verifiedDonors);
  setText('[data-appointments]', data.stats.appointments);
  setText('[data-subscriptions]', data.stats.subscriptions);
  return data;
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((el) => { el.textContent = value; });
}

async function loadRequests() {
  const data = await LifeLink.api('/api/dashboard/requests');
  LifeLink.renderRows('#requestsRows', data.requests.map((r) => `
    <tr>
      <td>${r.patient_name}</td>
      <td><span class="badge text-bg-danger">${r.blood_group}</span></td>
      <td>${r.units_needed}</td>
      <td><span class="badge ${r.urgency === 'critical' ? 'text-bg-danger' : 'text-bg-warning'}">${r.urgency}</span></td>
      <td>${r.hospital_name || '-'}</td>
      <td>${r.city || '-'}</td>
      <td>${r.status}</td>
    </tr>
  `), 'No blood requests found');
}

async function loadRewards() {
  const data = await LifeLink.api('/api/dashboard/rewards');
  setText('[data-rewards-total]', data.total);
  LifeLink.renderRows('#rewardsRows', data.rewards.map((r) => `
    <tr><td>${r.reason}</td><td class="fw-bold text-success">+${r.points}</td><td>${new Date(r.created_at).toLocaleString()}</td></tr>
  `), 'No rewards yet');
}

async function loadAppointments() {
  const data = await LifeLink.api('/api/dashboard/appointments');
  LifeLink.renderRows('#appointmentsRows', data.appointments.map((a) => `
    <tr><td>${a.donor_name}</td><td>${a.organizer_name}</td><td>${new Date(a.appointment_at).toLocaleString()}</td><td>${a.status}</td></tr>
  `), 'No appointments yet');
}

async function loadHealth() {
  const data = await LifeLink.api('/api/dashboard/health');
  const p = data.profile || {};
  for (const [key, value] of Object.entries(p)) {
    const field = document.querySelector(`[name="${key}"]`);
    if (field && value) field.value = String(value).slice(0, 10);
  }
}

function bindHealthForm() {
  const form = document.querySelector('#healthForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await LifeLink.api('/api/dashboard/health', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      LifeLink.toast('Health tracker updated. 50 rewards points added.');
      await loadSummary();
      await loadRewards();
    } catch (error) {
      LifeLink.toast(error.message, 'error');
    }
  });
}

function bindRequestForm() {
  const form = document.querySelector('#requestForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await LifeLink.api('/api/dashboard/requests', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      LifeLink.toast('Blood request created.');
      form.reset();
      await loadSummary();
      await loadRequests();
    } catch (error) {
      LifeLink.toast(error.message, 'error');
    }
  });
}

function bindInventoryForm() {
  const form = document.querySelector('#inventoryForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await LifeLink.api('/api/dashboard/inventory', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      LifeLink.toast('Inventory updated.');
      form.reset();
      await loadInventory();
    } catch (error) {
      LifeLink.toast(error.message, 'error');
    }
  });
}

async function loadInventory() {
  const data = await LifeLink.api('/api/dashboard/inventory');
  LifeLink.renderRows('#inventoryRows', data.inventory.map((i) => `
    <tr><td><span class="badge text-bg-danger">${i.blood_group}</span></td><td>${i.units}</td><td>${i.expires_on ? String(i.expires_on).slice(0, 10) : '-'}</td></tr>
  `), 'No inventory entered');
}

function bindDonorSearch() {
  const form = document.querySelector('#donorSearchForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await loadNearbyDonors(new URLSearchParams(new FormData(form)).toString());
  });
}

async function loadNearbyDonors(query = '') {
  const data = await LifeLink.api(`/api/dashboard/nearby-donors?${query}`);
  LifeLink.renderRows('#nearbyDonorRows', data.donors.map((d) => `
    <tr>
      <td>${d.name}</td><td><span class="badge text-bg-danger">${d.blood_group || '-'}</span></td><td>${d.city || '-'}</td>
      <td>${d.hemoglobin || '-'}</td><td>${d.next_eligible_date ? String(d.next_eligible_date).slice(0, 10) : '-'}</td><td>${d.mobile}</td>
    </tr>
  `), 'No nearby donors match your search');
  drawFallbackMap(data.donors);
}

function drawFallbackMap(items) {
  const map = document.querySelector('#mapBox');
  if (!map) return;
  map.innerHTML = '<div class="position-absolute top-0 start-0 p-3 small text-muted">Global donor map view. Add verified latitude/longitude records to show live donor markers.</div>';
  items.slice(0, 8).forEach((_, index) => {
    const pin = document.createElement('span');
    pin.className = 'map-pin';
    pin.style.left = `${18 + (index * 13) % 70}%`;
    pin.style.top = `${24 + (index * 19) % 56}%`;
    map.appendChild(pin);
  });
}

function bindCampaignForm() {
  const form = document.querySelector('#campaignForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await LifeLink.api('/api/dashboard/campaigns', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      LifeLink.toast('Campaign created.');
      form.reset();
      await loadCampaigns();
    } catch (error) {
      LifeLink.toast(error.message, 'error');
    }
  });
}

async function loadCampaigns() {
  const data = await LifeLink.api('/api/dashboard/campaigns');
  LifeLink.renderRows('#campaignRows', data.campaigns.map((c) => `
    <tr><td>${c.title}</td><td>${c.ngo_name}</td><td>${c.city || '-'}</td><td>${String(c.campaign_date).slice(0, 10)}</td><td>${c.registered_donors}/${c.target_donors}</td><td>${c.status}</td></tr>
  `), 'No campaigns found');
}

function bindSubscriptionButtons() {
  document.querySelectorAll('[data-plan]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const data = await LifeLink.api('/api/payments/create-order', {
          method: 'POST',
          body: JSON.stringify({ plan: button.dataset.plan })
        });
        if (data.order.devMode || !window.Razorpay) {
          await LifeLink.api('/api/payments/verify', {
            method: 'POST',
            body: JSON.stringify({ subscriptionId: data.subscriptionId, razorpay_order_id: data.order.id, razorpay_payment_id: 'dev_payment', razorpay_signature: 'dev' })
          });
          LifeLink.toast('Subscription activated in dev mode. Add Razorpay keys for live payment.');
          await loadSummary();
          return;
        }
        const rz = new Razorpay({
          key: data.key,
          amount: data.order.amount,
          currency: data.order.currency,
          name: 'LifeLink',
          description: 'LifeLink subscription',
          order_id: data.order.id,
          handler: async (response) => {
            await LifeLink.api('/api/payments/verify', { method: 'POST', body: JSON.stringify({ ...response, subscriptionId: data.subscriptionId }) });
            LifeLink.toast('Subscription activated.');
            await loadSummary();
          }
        });
        rz.open();
      } catch (error) {
        LifeLink.toast(error.message, 'error');
      }
    });
  });
}

function bindLogout() {
  document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', LifeLink.logout));
}
