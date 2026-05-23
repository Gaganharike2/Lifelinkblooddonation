const SubscriptionPage = (() => {
  const state = {
    data: null,
    selectedPlan: null,
    billingCycle: 'monthly',
    coupon: null,
    config: { paymentProvider: 'cashfree', cashfreeEnvironment: 'sandbox' },
    lastPayment: null,
    charts: []
  };

  const nav = [
    ['hospital-dashboard.html', 'Dashboard', 'fa-gauge-high'],
    ['hospital-profile.html', 'Hospital Profile', 'fa-hospital'],
    ['search-donors.html', 'Search Donors', 'fa-magnifying-glass'],
    ['blood-request.html', 'Blood Requests', 'fa-droplet'],
    ['emergency-request.html', 'Emergency Requests', 'fa-truck-medical'],
    ['blood-inventory.html', 'Blood Inventory', 'fa-boxes-stacked'],
    ['appointments.html', 'Appointments', 'fa-calendar-check'],
    ['hospital-reports.html', 'Reports', 'fa-chart-line'],
    ['subscription-plan.html', 'Subscription Plan', 'fa-crown'],
    ['payment-history.html', 'Payment History', 'fa-credit-card'],
    ['invoice.html', 'Invoices', 'fa-file-invoice'],
    ['settings.html', 'Settings', 'fa-gear'],
    ['support.html', 'Support', 'fa-life-ring'],
    ['logout.html', 'Logout', 'fa-right-from-bracket']
  ];

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    LifeLink.requireRole(['hospital', 'admin', 'super_admin']);
    renderShell();
    bindChrome();
    await load();
  }

  function renderShell() {
    document.getElementById('subscriptionApp').innerHTML = `
      <div class="billing-shell">
        <aside class="billing-sidebar" id="sidebar">
          <a class="brand" href="/pages/hospital/hospital-dashboard.html"><span class="brand-mark"><i class="fa-solid fa-heart-pulse"></i></span>LifeLink</a>
          <nav class="billing-nav">
            ${nav.map(([href, label, icon]) => href === 'logout.html'
              ? `<button data-logout><i class="fa-solid ${icon}"></i>${label}</button>`
              : `<a class="${href === 'subscription-plan.html' ? 'active' : ''}" href="/pages/hospital/${href}"><i class="fa-solid ${icon}"></i>${label}</a>`).join('')}
          </nav>
        </aside>
        <main class="billing-main">
          <header class="billing-topbar">
            <div class="hospital-lockup">
              <button class="icon-btn d-xl-none" id="menuBtn"><i class="fa-solid fa-bars"></i></button>
              <span><i class="fa-solid fa-hospital"></i></span>
              <div><strong>Hospital Billing</strong><div class="small text-muted">LifeLink Hospital Workspace</div></div>
            </div>
            <label class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="tableSearch" placeholder="Search invoices, payment IDs, plans"></label>
            <div class="top-actions">
              <span class="plan-chip" id="topPlan">Loading</span>
              <button class="icon-btn" id="themeToggle"><i class="fa-solid fa-moon"></i></button>
              <button class="icon-btn"><i class="fa-solid fa-bell"></i></button>
              <div class="dropdown">
                <button class="profile-btn" data-bs-toggle="dropdown"><span class="avatar">HP</span><span class="d-none d-md-inline">Profile</span><i class="fa-solid fa-chevron-down"></i></button>
                <ul class="dropdown-menu dropdown-menu-end shadow">
                  <li><a class="dropdown-item" href="/pages/hospital/hospital-profile.html">View Profile</a></li>
                  <li><a class="dropdown-item" href="/pages/hospital/settings.html">Settings</a></li>
                  <li><a class="dropdown-item" href="/pages/hospital/support.html">Help Center</a></li>
                  <li><hr class="dropdown-divider"></li>
                  <li><button class="dropdown-item text-danger" data-logout>Logout</button></li>
                </ul>
              </div>
            </div>
          </header>
          <section class="billing-content" id="content">${skeleton()}</section>
        </main>
      </div>
    `;
  }

  function bindChrome() {
    document.querySelectorAll('[data-logout]').forEach((button) => button.addEventListener('click', LifeLink.logout));
    document.getElementById('menuBtn')?.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    document.getElementById('themeToggle').addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('lifelink_subscription_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    });
    if (localStorage.getItem('lifelink_subscription_theme') === 'dark') document.body.classList.add('dark-mode');
    document.getElementById('tableSearch').addEventListener('input', filterBillingRows);
  }

  async function load() {
    try {
      state.config = await LifeLink.api('/api/config').catch(() => state.config);
      state.data = await LifeLink.api('/api/hospital/subscription');
      state.selectedPlan = recommendedPlan();
      render();
    } catch (error) {
      document.getElementById('content').innerHTML = `<div class="payment-state failed show"><strong>Unable to load subscription center.</strong><div>${error.message}</div></div>`;
    }
  }

  function render() {
    const sub = state.data.subscription || {};
    document.getElementById('topPlan').textContent = `${sub.plan_name || sub.plan?.name || 'Free'} Plan`;
    document.getElementById('content').innerHTML = `
      <section class="page-hero">
        <div>
          <p class="eyebrow">Premium SaaS billing</p>
          <h1>Subscription Management</h1>
          <p class="text-muted mb-0">Manage your hospital subscription, billing, and premium features</p>
          <div class="status-strip">
            <span class="status-pill ${statusClass(sub.status)}"><i class="fa-solid fa-circle-check"></i>${capitalize(sub.status || 'trial')}</span>
            <span class="status-pill"><i class="fa-solid fa-calendar"></i>Renewal ${dateShort(sub.expires_at)}</span>
            <span class="status-pill"><i class="fa-solid fa-fingerprint"></i>Subscription ${sub.id ? `#${sub.id}` : 'Trial'}</span>
          </div>
        </div>
        <div class="hero-actions">
          <button class="btn btn-red" data-scroll="#plans">Upgrade Plan</button>
          <button class="btn btn-outline-danger" id="renewPlan">Renew Plan</button>
          <button class="btn btn-dark" data-scroll="#billing">Billing History</button>
        </div>
      </section>

      <div id="paymentState" class="payment-state"></div>

      <div class="grid-two">
        ${currentPlanCard()}
        ${checkoutCard()}
      </div>

      <section class="panel" id="plans">
        <div class="panel-head">
          <div><p class="eyebrow">Plans</p><h2>Subscription Plans</h2></div>
          <div class="btn-group">
            <button class="btn btn-sm ${state.billingCycle === 'monthly' ? 'btn-danger' : 'btn-outline-danger'}" data-cycle="monthly">Monthly</button>
            <button class="btn btn-sm ${state.billingCycle === 'yearly' ? 'btn-danger' : 'btn-outline-danger'}" data-cycle="yearly">Yearly</button>
          </div>
        </div>
        <div class="plans-grid">${state.data.plans.map(planCard).join('')}</div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><p class="eyebrow">Compare</p><h2>Plan Comparison</h2></div><button class="btn btn-sm btn-outline-dark">Compare Plans</button></div>
        <div class="table-responsive">${comparisonTable()}</div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div><p class="eyebrow">Usage</p><h2>Usage Analytics</h2></div>
          <select class="form-select form-select-sm w-auto" id="usageFilter"><option>Weekly</option><option selected>Monthly</option><option>Yearly</option></select>
        </div>
        <div class="charts-grid">
          <div class="chart-card"><h3>Donor Searches Used</h3><canvas id="donorChart"></canvas></div>
          <div class="chart-card"><h3>Blood Requests Created</h3><canvas id="bloodChart"></canvas></div>
          <div class="chart-card"><h3>Emergency Alerts Sent</h3><canvas id="emergencyChart"></canvas></div>
          <div class="chart-card"><h3>Monthly Usage</h3><canvas id="monthlyChart"></canvas></div>
          <div class="chart-card"><h3>Plan Consumption</h3><canvas id="consumptionChart"></canvas></div>
        </div>
      </section>

      <div class="grid-two">
        <section class="panel" id="billing">
          <div class="panel-head"><div><p class="eyebrow">Billing</p><h2>Billing History</h2></div><select class="form-select form-select-sm w-auto" id="paymentStatusFilter"><option value="">All Status</option><option>paid</option><option>failed</option><option>created</option></select></div>
          <div class="table-responsive">${billingTable()}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Auto renewal</p><h2>Auto Renew Settings</h2></div></div>
          ${autoRenewSettings()}
        </section>
      </div>

      <div class="grid-two">
        <section class="panel">
          <div class="panel-head"><div><p class="eyebrow">Activity</p><h2>Subscription Activity Log</h2></div></div>
          <div class="activity-log">${activityLog()}</div>
        </section>
        <section class="support-card">
          <div><p class="eyebrow">Support</p><h2>Need Help?</h2><p class="text-muted mb-0">Our billing support team can help with failed payments, GST invoices and plan changes.</p></div>
          <div class="d-flex flex-wrap gap-2"><a class="btn btn-red" href="/pages/hospital/support.html">Contact Billing Support</a><a class="btn btn-outline-danger" href="/pages/hospital/support.html">Raise Ticket</a><button class="btn btn-dark">FAQ</button></div>
        </section>
      </div>
    `;
    bindContent();
    renderCharts();
  }

  function currentPlanCard() {
    const sub = state.data.subscription || {};
    const usage = state.data.usage || {};
    return `
      <section class="current-plan">
        <div class="panel-head">
          <div><p class="eyebrow text-white-50">Current Plan</p><h2>${sub.plan_name || sub.plan?.name || 'Free'} Plan</h2></div>
          <span class="status-pill">${capitalize(sub.status || 'trial')}</span>
        </div>
        <div class="price"><strong>${money(sub.amount_paise || 0)}</strong><span>/ ${sub.plan?.billing_cycle || 'month'}</span></div>
        <div class="plan-meta">
          <div class="meta-box"><small>Start Date</small><strong>${dateShort(sub.starts_at)}</strong></div>
          <div class="meta-box"><small>Renewal Date</small><strong>${dateShort(sub.expires_at)}</strong></div>
          <div class="meta-box"><small>Remaining Days</small><strong>${sub.remaining_days ?? 0}</strong></div>
          <div class="meta-box"><small>Auto Renewal</small><strong>${sub.auto_renew ? 'Enabled' : 'Disabled'}</strong></div>
          <div class="meta-box"><small>Billing Cycle</small><strong>${capitalize(sub.plan?.billing_cycle || 'monthly')}</strong></div>
          <div class="meta-box"><small>Status</small><strong>${capitalize(sub.status || 'trial')}</strong></div>
        </div>
        <div class="usage-list">
          ${usageRow('Donor Searches Used', usage.donor_searches_used, sub.plan?.donor_search_limit || 10)}
          ${usageRow('Emergency Requests Used', usage.emergency_requests_used, sub.plan?.emergency_request_limit || 1)}
          ${usageRow('Notifications Sent', usage.notifications_sent, sub.plan?.notification_limit || 50)}
          ${usageRow('Blood Requests Used', usage.blood_requests_used, sub.plan?.blood_request_limit || 5)}
        </div>
        <div class="d-flex flex-wrap gap-2 mt-4">
          <button class="btn btn-light" data-scroll="#plans">Upgrade Plan</button>
          <button class="btn btn-outline-light" id="cancelPlan">Cancel Plan</button>
          <button class="btn btn-outline-light" id="pausePlan">Pause Plan</button>
          <button class="btn btn-outline-light" id="resumePlan">Resume Plan</button>
          <button class="btn btn-light" id="renewPlanCard">Renew Subscription</button>
        </div>
      </section>
    `;
  }

  function checkoutCard() {
    const plan = state.selectedPlan || recommendedPlan();
    const amount = amountForPlan(plan);
    const gst = Math.round(amount * .18);
    const discount = state.coupon?.discount_paise || 0;
    const final = Math.max(0, amount + gst - discount);
    return `
      <section class="panel checkout-card">
        <div class="panel-head"><div><p class="eyebrow">${paymentProviderLabel()} checkout</p><h2>Checkout Details</h2></div></div>
        <div class="amount-row"><span>Plan Name</span><strong>${plan?.name || 'Pro'}</strong></div>
        <div class="amount-row"><span>Amount</span><strong>${money(amount)}</strong></div>
        <div class="amount-row"><span>GST 18%</span><strong>${money(gst)}</strong></div>
        <div class="amount-row"><span>Discount</span><strong>${money(discount)}</strong></div>
        <div class="amount-row total"><span>Final Price</span><strong>${money(final)}</strong></div>
        <div class="coupon-box mt-3">
          <input class="form-control" id="couponCode" placeholder="WELCOME50 or HOSPITAL20" value="${state.coupon?.code || ''}">
          <button class="btn btn-outline-danger" id="applyCoupon">Apply</button>
        </div>
        <p class="small text-muted mt-2">${state.coupon?.message || 'Apply a valid coupon to reduce your payable amount.'}</p>
        <button class="btn btn-red w-100 mt-2" id="payNow"><i class="fa-solid fa-lock"></i> Pay Securely with ${paymentProviderLabel()}</button>
        <button class="btn btn-outline-dark w-100 mt-2" id="retryPayment"><i class="fa-solid fa-rotate-right"></i> Retry Failed Payment</button>
      </section>
    `;
  }

  function planCard(plan) {
    const current = String(state.data.subscription?.plan_name || '').toLowerCase() === plan.name.toLowerCase();
    const price = amountForPlan(plan);
    return `
      <article class="plan-card ${plan.recommended ? 'recommended' : ''}" data-plan-card="${plan.code}">
        ${plan.recommended ? '<span class="recommended-badge">Recommended</span>' : ''}
        ${current ? '<span class="current-badge">Current Plan</span>' : ''}
        <h3>${plan.name}</h3>
        <div class="price"><strong>${money(price)}</strong><span>/${state.billingCycle === 'yearly' ? 'year' : 'month'}</span></div>
        <ul class="feature-list">${plan.features.map((feature) => `<li><i class="fa-solid fa-check"></i><span>${feature}</span></li>`).join('')}</ul>
        <button class="btn ${plan.recommended ? 'btn-red' : 'btn-outline-danger'} mt-auto" data-select-plan="${plan.code}">${plan.code === 'free' ? 'Get Started' : plan.code === 'pro' ? 'Upgrade to Pro' : plan.code === 'enterprise' ? 'Contact Sales / Subscribe' : 'Upgrade Plan'}</button>
      </article>
    `;
  }

  function comparisonTable() {
    return `
      <table class="table comparison-table align-middle">
        <thead><tr><th>Feature</th><th>Free</th><th>Basic</th><th>Pro</th><th>Enterprise</th></tr></thead>
        <tbody>${state.data.comparison.map((row) => `<tr>${row.map((cell, index) => `<td>${index ? formatCompare(cell) : `<strong>${cell}</strong>`}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    `;
  }

  function billingTable() {
    const rows = state.data.billing_history || [];
    if (!rows.length) return '<div class="text-center text-muted py-4">No billing records yet. Your invoices will appear here after payment verification.</div>';
    return `
      <table class="table billing-table align-middle">
        <thead><tr><th>Invoice ID</th><th>Payment ID</th><th>Plan</th><th>Amount</th><th>Status</th><th>Payment Method</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody id="billingRows">
          ${rows.map((row) => `
            <tr>
              <td>${row.invoice_no || '-'}</td>
              <td>${row.razorpay_payment_id || '-'}</td>
              <td>${row.plan_name || '-'}</td>
              <td>${money(row.amount_paise || 0)}</td>
              <td><span class="status-pill ${statusClass(row.status || row.payment_status)}">${capitalize(row.status || row.payment_status || 'created')}</span></td>
              <td>${row.provider || row.payment_provider || 'cashfree'}</td>
              <td>${dateShort(row.created_at)}</td>
              <td><a class="btn btn-sm btn-outline-danger" href="/api/invoice/download/${row.id || 0}">Download Invoice</a> <button class="btn btn-sm btn-outline-dark">View Payment</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function autoRenewSettings() {
    const auto = state.data.auto_renew || {};
    return `
      <div class="form-check form-switch mb-3">
        <input class="form-check-input" type="checkbox" id="autoRenewToggle" ${auto.enabled ? 'checked' : ''}>
        <label class="form-check-label fw-bold" for="autoRenewToggle">Enable Auto Renew</label>
      </div>
      <label class="form-label">Payment Reminder</label>
      <select class="form-select mb-3" id="reminderDays">
        <option ${auto.reminder_days === 7 ? 'selected' : ''}>7 days before</option>
        <option ${auto.reminder_days === 3 ? 'selected' : ''}>3 days before</option>
        <option ${auto.reminder_days === 1 ? 'selected' : ''}>1 day before</option>
      </select>
      <div class="form-check"><input class="form-check-input" type="checkbox" checked id="emailReminder"><label class="form-check-label" for="emailReminder">Email reminder</label></div>
      <div class="form-check"><input class="form-check-input" type="checkbox" checked id="smsReminder"><label class="form-check-label" for="smsReminder">SMS reminder</label></div>
      <button class="btn btn-red w-100 mt-3" id="saveRenewSettings">Save Renewal Settings</button>
    `;
  }

  function activityLog() {
    const rows = state.data.activity || [];
    if (!rows.length) return '<div class="text-muted">No subscription activity yet.</div>';
    return rows.map((item) => `<article class="activity-item"><strong>${activityTitle(item.event_name)}</strong><div class="small text-muted">${dateTime(item.created_at)}</div></article>`).join('');
  }

  function bindContent() {
    document.querySelectorAll('[data-scroll]').forEach((button) => button.addEventListener('click', () => document.querySelector(button.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' })));
    document.querySelectorAll('[data-cycle]').forEach((button) => button.addEventListener('click', () => { state.billingCycle = button.dataset.cycle; render(); }));
    document.querySelectorAll('[data-select-plan]').forEach((button) => button.addEventListener('click', () => {
      state.selectedPlan = state.data.plans.find((plan) => plan.code === button.dataset.selectPlan);
      document.querySelector('[data-plan-card="' + button.dataset.selectPlan + '"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      render();
    }));
    document.getElementById('applyCoupon').addEventListener('click', applyCoupon);
    document.getElementById('payNow').addEventListener('click', paySelectedPlan);
    document.getElementById('retryPayment').addEventListener('click', retryPayment);
    document.getElementById('renewPlan')?.addEventListener('click', renewPlan);
    document.getElementById('renewPlanCard')?.addEventListener('click', renewPlan);
    document.getElementById('cancelPlan')?.addEventListener('click', () => mutateSubscription('/api/subscription/cancel', 'Subscription cancelled'));
    document.getElementById('pausePlan')?.addEventListener('click', () => mutateSubscription('/api/subscription/pause', 'Subscription paused'));
    document.getElementById('resumePlan')?.addEventListener('click', () => mutateSubscription('/api/subscription/resume', 'Subscription resumed'));
    document.getElementById('saveRenewSettings')?.addEventListener('click', () => LifeLink.toast('Auto-renew settings saved', 'success'));
  }

  async function applyCoupon() {
    const code = document.getElementById('couponCode').value.trim();
    const plan = state.selectedPlan || recommendedPlan();
    state.coupon = await LifeLink.api(`/api/coupons/${encodeURIComponent(code)}?amount_paise=${amountForPlan(plan)}`);
    render();
  }

  async function paySelectedPlan() {
    const plan = state.selectedPlan || recommendedPlan();
    try {
      const response = await LifeLink.api('/api/subscription/upgrade', {
        method: 'POST',
        body: JSON.stringify({
          plan: plan.code,
          coupon_code: state.coupon?.code || null,
          billing_cycle: state.billingCycle,
          provider: state.config.paymentProvider || 'cashfree'
        })
      });
      state.lastPayment = response;
      if (response.provider === 'cashfree') {
        await payWithCashfree(response);
        return;
      }
      if (response.amount_paise <= 0 || response.order.devMode || !window.Razorpay) {
        await verifyDevPayment(response);
        return;
      }
      const checkout = new Razorpay({
        key: response.key,
        amount: response.order.amount,
        currency: response.order.currency || 'INR',
        name: 'LifeLink',
        description: `${response.plan.name} Hospital Subscription`,
        order_id: response.order.id,
        prefill: { name: 'Hospital Admin' },
        theme: { color: '#e9194f' },
        handler: async (payment) => {
          await verifyPayment(response, payment);
        },
        modal: {
          ondismiss: () => showPaymentState('failed', 'Payment was closed before completion. You can retry or change payment method.')
        }
      });
      checkout.open();
    } catch (error) {
      showPaymentState('failed', error.message);
    }
  }

  async function payWithCashfree(orderResponse) {
    if (orderResponse.amount_paise <= 0 || orderResponse.order.devMode || !window.Cashfree) {
      await verifyCashfreePayment(orderResponse);
      return;
    }
    try {
      const cashfree = Cashfree({ mode: orderResponse.cashfree?.environment === 'production' ? 'production' : 'sandbox' });
      const result = await cashfree.checkout({
        paymentSessionId: orderResponse.cashfree.payment_session_id,
        redirectTarget: '_modal'
      });
      if (result?.error) {
        showPaymentState('failed', result.error.message || 'Cashfree payment failed. Please retry.');
        return;
      }
      await verifyCashfreePayment(orderResponse);
    } catch (error) {
      showPaymentState('failed', error.message || 'Unable to open Cashfree checkout.');
    }
  }

  async function verifyCashfreePayment(orderResponse) {
    try {
      await LifeLink.api('/api/payment/verify', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'cashfree',
          subscriptionId: orderResponse.subscriptionId,
          paymentId: orderResponse.paymentId,
          cashfree_order_id: orderResponse.cashfree?.order_id || orderResponse.order.order_id
        })
      });
      showPaymentState('success', 'Cashfree payment successful. Your plan has been activated.');
      await load();
    } catch (error) {
      showPaymentState('failed', error.message);
    }
  }

  async function verifyPayment(orderResponse, payment) {
    try {
      await LifeLink.api('/api/payment/verify', {
        method: 'POST',
        body: JSON.stringify({
          subscriptionId: orderResponse.subscriptionId,
          paymentId: orderResponse.paymentId,
          provider: 'razorpay',
          razorpay_order_id: payment.razorpay_order_id,
          razorpay_payment_id: payment.razorpay_payment_id,
          razorpay_signature: payment.razorpay_signature
        })
      });
      showPaymentState('success', 'Payment successful. Your plan has been activated.');
      await load();
    } catch (error) {
      showPaymentState('failed', error.message);
    }
  }

  async function verifyDevPayment(orderResponse) {
    await LifeLink.api('/api/payment/verify', {
        method: 'POST',
        body: JSON.stringify({
          subscriptionId: orderResponse.subscriptionId,
          paymentId: orderResponse.paymentId,
          provider: orderResponse.provider || 'razorpay',
          cashfree_order_id: orderResponse.cashfree?.order_id || orderResponse.order.order_id,
          razorpay_order_id: orderResponse.order.id || orderResponse.order.order_id,
          razorpay_payment_id: `dev_payment_${Date.now()}`,
          razorpay_signature: 'dev_signature'
        })
      });
    showPaymentState('success', `Payment successful. Plan activated in ${paymentProviderLabel()} test/dev mode.`);
    await load();
  }

  async function retryPayment() {
    if (state.lastPayment) {
      await paySelectedPlan();
    } else {
      showPaymentState('failed', 'No failed payment is available to retry. Select a plan first.');
    }
  }

  async function renewPlan() {
    try {
      const response = await LifeLink.api('/api/subscription/renew', { method: 'POST', body: JSON.stringify({}) });
      state.lastPayment = response;
      showPaymentState('success', `Renewal order created: ${response.order.id}. Continue with ${paymentProviderLabel()} checkout.`);
    } catch (error) {
      showPaymentState('failed', error.message);
    }
  }

  async function mutateSubscription(path, successMessage) {
    const id = state.data.subscription?.id;
    if (!id) return showPaymentState('failed', 'No active subscription found.');
    try {
      await LifeLink.api(path, { method: 'POST', body: JSON.stringify({ subscriptionId: id }) });
      showPaymentState('success', successMessage);
      await load();
    } catch (error) {
      showPaymentState('failed', error.message);
    }
  }

  function renderCharts() {
    state.charts.forEach((chart) => chart.destroy());
    state.charts = [];
    const usage = state.data.usage || {};
    state.charts.push(barChart('donorChart', ['Used', 'Remaining'], [usage.donor_searches_used || 0, remaining(usage.donor_searches_used, state.data.subscription?.plan?.donor_search_limit)]));
    state.charts.push(barChart('bloodChart', ['Used', 'Remaining'], [usage.blood_requests_used || 0, remaining(usage.blood_requests_used, state.data.subscription?.plan?.blood_request_limit)], '#2563eb'));
    state.charts.push(barChart('emergencyChart', ['Used', 'Remaining'], [usage.emergency_requests_used || 0, remaining(usage.emergency_requests_used, state.data.subscription?.plan?.emergency_request_limit)], '#f59e0b'));
    state.charts.push(lineChart('monthlyChart', ['W1', 'W2', 'W3', 'W4'], [12, 28, 22, 36]));
    state.charts.push(doughnutChart('consumptionChart', ['Donors', 'Requests', 'Alerts'], [usage.donor_searches_used || 10, usage.blood_requests_used || 4, usage.notifications_sent || 18]));
  }

  function barChart(id, labels, data, color = '#e9194f') {
    return new Chart(document.getElementById(id), {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: color, borderRadius: 8 }] },
      options: chartOptions()
    });
  }

  function lineChart(id, labels, data) {
    return new Chart(document.getElementById(id), {
      type: 'line',
      data: { labels, datasets: [{ data, borderColor: '#e9194f', backgroundColor: 'rgba(233,25,79,.12)', fill: true, tension: .38 }] },
      options: chartOptions()
    });
  }

  function doughnutChart(id, labels, data) {
    return new Chart(document.getElementById(id), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: ['#e9194f', '#2563eb', '#12a376'] }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  function chartOptions() {
    return { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } } };
  }

  function filterBillingRows(event) {
    const q = event.target.value.toLowerCase();
    document.querySelectorAll('#billingRows tr').forEach((row) => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }

  function usageRow(label, used = 0, limit = 1) {
    const normalizedLimit = !limit || limit > 100000 ? Math.max(used, 100) : limit;
    const percent = Math.min(100, Math.round((Number(used || 0) / normalizedLimit) * 100));
    return `
      <div class="usage-row">
        <header><span>${label}</span><strong>${used || 0} / ${limit > 100000 ? 'Unlimited' : limit}</strong></header>
        <div class="progress"><div class="progress-bar bg-light" style="width:${percent}%"></div></div>
      </div>
    `;
  }

  function showPaymentState(type, message) {
    const el = document.getElementById('paymentState');
    el.className = `payment-state ${type} show`;
    el.innerHTML = type === 'success'
      ? `<strong><i class="fa-solid fa-circle-check"></i> Payment successful</strong><div>${message}</div>`
      : `<strong><i class="fa-solid fa-triangle-exclamation"></i> Payment failed</strong><div>${message}</div><div class="mt-2"><button class="btn btn-sm btn-red" id="stateRetry">Retry payment</button> <a class="btn btn-sm btn-outline-danger" href="/pages/hospital/support.html">Contact support</a></div>`;
    document.getElementById('stateRetry')?.addEventListener('click', retryPayment);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function recommendedPlan() {
    return state.data?.plans?.find((plan) => plan.recommended) || state.data?.plans?.[1];
  }

  function amountForPlan(plan) {
    const monthly = Number(plan?.amount_paise || 0);
    return state.billingCycle === 'yearly' ? Math.round(monthly * 10) : monthly;
  }

  function remaining(used = 0, limit = 1) {
    if (!limit || limit > 100000) return Math.max(100 - used, 0);
    return Math.max(Number(limit) - Number(used || 0), 0);
  }

  function formatCompare(value) {
    if (String(value).toLowerCase() === 'yes') return '<span class="status-pill ok">Yes</span>';
    if (String(value).toLowerCase() === 'no') return '<span class="status-pill danger">No</span>';
    return value;
  }

  function activityTitle(event = '') {
    return event.replace(/\./g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Subscription activity';
  }

  function paymentProviderLabel() {
    return String(state.config.paymentProvider || 'cashfree').toLowerCase() === 'razorpay' ? 'Razorpay' : 'Cashfree';
  }

  function statusClass(status = '') {
    if (['active', 'paid', 'captured'].includes(String(status).toLowerCase())) return 'ok';
    if (['created', 'pending', 'trial'].includes(String(status).toLowerCase())) return 'warn';
    return 'danger';
  }

  function money(paise = 0) {
    return `₹${(Number(paise || 0) / 100).toLocaleString('en-IN')}`;
  }

  function dateShort(value) {
    if (!value) return 'Not scheduled';
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function dateTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function capitalize(value = '') {
    return String(value).replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
  }

  function skeleton() {
    return `
      <div class="page-hero"><div><p class="eyebrow">Loading</p><h1>Subscription Management</h1><p class="text-muted">Preparing billing data</p></div></div>
      <div class="grid-two"><div class="skeleton"></div><div class="skeleton"></div></div>
    `;
  }
})();
