const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const {
  createOrder,
  createCashfreeOrder,
  fetchCashfreeOrder,
  createPlan,
  createSubscription,
  verifyPayment,
  verifySubscriptionPayment,
  verifyWebhook,
  verifyCashfreeWebhook,
  getCashfreeConfig
} = require('../services/paymentService');

const router = express.Router();
const hospitalOnly = auth(['hospital', 'admin', 'super_admin']);

const defaultPlans = [
  {
    code: 'free',
    name: 'Free',
    price: 0,
    amount_paise: 0,
    billing_cycle: 'monthly',
    donor_search_limit: 10,
    emergency_request_limit: 0,
    notification_limit: 50,
    blood_request_limit: 5,
    features: ['10 donor searches/month', 'Basic notifications', 'Limited inventory access', 'Limited blood requests']
  },
  {
    code: 'basic',
    name: 'Basic',
    price: 499,
    amount_paise: 49900,
    billing_cycle: 'monthly',
    donor_search_limit: 100,
    emergency_request_limit: 20,
    notification_limit: 500,
    blood_request_limit: 100,
    features: ['100 donor searches', 'Emergency requests', 'Inventory management', 'Appointment management', 'Email support']
  },
  {
    code: 'pro',
    name: 'Pro',
    price: 999,
    amount_paise: 99900,
    billing_cycle: 'monthly',
    donor_search_limit: 999999,
    emergency_request_limit: 999999,
    notification_limit: 10000,
    blood_request_limit: 999999,
    features: ['Unlimited donor searches', 'Smart donor matching', 'Advanced analytics', 'Live tracking', 'Priority emergency alerts', 'AI donor recommendations'],
    recommended: true
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    price: 2999,
    amount_paise: 299900,
    billing_cycle: 'monthly',
    donor_search_limit: 999999,
    emergency_request_limit: 999999,
    notification_limit: 999999,
    blood_request_limit: 999999,
    features: ['Multi-branch support', 'AI blood prediction', 'Unlimited everything', 'CEO dashboard', 'Dedicated support', 'Premium analytics']
  }
];

router.use(async (req, res, next) => {
  await ensureBillingTables();
  await seedPlans();
  next();
});

async function listPlans(req, res) {
  const [plans] = await pool.query('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order');
  res.json({ plans: plans.map(planDto), comparison: comparisonRows() });
}

router.get('/plans', hospitalOnly, listPlans);
router.get('/subscription/plans', hospitalOnly, listPlans);

router.get('/hospital/subscription', hospitalOnly, currentSubscription);
router.get('/payment/history', hospitalOnly, paymentHistory);
router.get('/invoice/download/:id', hospitalOnly, invoiceDownload);

router.post('/subscription/create', hospitalOnly, async (req, res) => {
  const plan = await getPlan(req.body.plan || 'basic');
  const coupon = await resolveCoupon(req.body.coupon_code, plan.amount_paise);
  const amount = Math.max(0, plan.amount_paise - coupon.discount_paise);
  const razorpayPlanId = await ensureRazorpayPlan(plan);
  const razorpaySubscription = amount > 0 ? await createSubscription(razorpayPlanId, { notes: { user_id: req.user.id, plan_code: plan.code } }) : { id: `free_sub_${Date.now()}`, status: 'active' };
  const [subscriptionResult] = await pool.query(
    `INSERT INTO subscriptions (user_id,plan_name,amount_paise,status,razorpay_order_id,starts_at,expires_at)
     VALUES (?,?,?,?,?,NOW(),DATE_ADD(NOW(), INTERVAL 1 MONTH))`,
    [req.user.id, plan.name, amount, amount > 0 ? 'created' : 'active', razorpaySubscription.id]
  );
  await upsertUsage(subscriptionResult.insertId, req.user.id, plan);
  await logPayment(req.user.id, subscriptionResult.insertId, null, 'subscription.created', { plan: plan.code, razorpaySubscription });
  res.status(201).json({
    key: process.env.RAZORPAY_KEY_ID || 'rzp_test_add_key_here',
    plan: planDto(plan),
    coupon,
    subscriptionId: subscriptionResult.insertId,
    razorpaySubscription,
    amount_paise: amount,
    message: amount > 0 ? 'Razorpay subscription created' : 'Free plan activated'
  });
});

router.post('/subscription/upgrade', hospitalOnly, async (req, res) => {
  const plan = await getPlan(req.body.plan || 'pro');
  const coupon = await resolveCoupon(req.body.coupon_code, plan.amount_paise);
  const amount = Math.max(0, plan.amount_paise - coupon.discount_paise);
  const provider = normalizeProvider(req.body.provider || process.env.PAYMENT_PROVIDER || 'cashfree');
  const [subscriptionResult] = await pool.query(
     `INSERT INTO subscriptions (user_id,plan_name,amount_paise,status,starts_at,expires_at)
     VALUES (?,?,?,"created",NOW(),DATE_ADD(NOW(), INTERVAL 1 MONTH))`,
    [req.user.id, plan.name, amount]
  );
  const order = amount > 0
    ? await createProviderOrder(provider, amount, subscriptionResult.insertId, req.user, plan)
    : { id: `free_order_${Date.now()}`, order_id: `free_order_${Date.now()}`, amount: 0, order_amount: 0, currency: 'INR' };
  const providerOrderId = order.id || order.order_id;
  await pool.query(
    'UPDATE subscriptions SET razorpay_order_id = ?, payment_provider = ?, cashfree_order_id = IF(?="cashfree",?,cashfree_order_id) WHERE id = ?',
    [providerOrderId, provider, provider, providerOrderId, subscriptionResult.insertId]
  );
  const [paymentResult] = await pool.query(
    'INSERT INTO payments (user_id,subscription_id,razorpay_order_id,amount_paise,purpose,status,payment_provider,cashfree_order_id) VALUES (?,?,?,?, "subscription", "created", ?, ?)',
    [req.user.id, subscriptionResult.insertId, providerOrderId, amount, provider, provider === 'cashfree' ? providerOrderId : null]
  );
  await logPayment(req.user.id, subscriptionResult.insertId, paymentResult.insertId, `${provider}.payment.created`, { order, coupon });
  res.status(201).json({
    provider,
    key: provider === 'razorpay' ? (process.env.RAZORPAY_KEY_ID || 'rzp_test_add_key_here') : null,
    cashfree: provider === 'cashfree' ? {
      environment: getCashfreeConfig()?.environment || 'sandbox',
      payment_session_id: order.payment_session_id,
      order_id: order.order_id
    } : null,
    order,
    plan: planDto(plan),
    coupon,
    subscriptionId: subscriptionResult.insertId,
    paymentId: paymentResult.insertId,
    amount_paise: amount,
    message: provider === 'cashfree' ? 'Cashfree order created' : 'Razorpay order created'
  });
});

router.post('/subscription/cancel', hospitalOnly, async (req, res) => {
  const subscriptionId = req.body.subscriptionId || req.body.subscription_id;
  if (!subscriptionId) return res.status(400).json({ message: 'subscriptionId is required' });
  await pool.query('UPDATE subscriptions SET status = "cancelled" WHERE id = ? AND user_id = ?', [subscriptionId, req.user.id]);
  await logPayment(req.user.id, subscriptionId, null, 'subscription.cancelled', { subscriptionId });
  res.json({ message: 'Subscription cancelled' });
});

router.post('/subscription/pause', hospitalOnly, async (req, res) => {
  const subscriptionId = req.body.subscriptionId || req.body.subscription_id;
  await pool.query('UPDATE subscriptions SET status = "cancelled" WHERE id = ? AND user_id = ?', [subscriptionId, req.user.id]);
  await logPayment(req.user.id, subscriptionId, null, 'subscription.paused', {});
  res.json({ message: 'Subscription paused' });
});

router.post('/subscription/resume', hospitalOnly, async (req, res) => {
  const subscriptionId = req.body.subscriptionId || req.body.subscription_id;
  await pool.query('UPDATE subscriptions SET status = "active", expires_at = DATE_ADD(NOW(), INTERVAL 1 MONTH) WHERE id = ? AND user_id = ?', [subscriptionId, req.user.id]);
  await logPayment(req.user.id, subscriptionId, null, 'subscription.resumed', {});
  res.json({ message: 'Subscription resumed' });
});

router.post('/subscription/renew', hospitalOnly, async (req, res) => {
  const [[current]] = await pool.query('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.user.id]);
  if (!current) return res.status(404).json({ message: 'No subscription found' });
  const plan = await getPlan(current.plan_name.toLowerCase());
  const order = await createOrder(plan.amount_paise, `lifelink_renew_${current.id}_${Date.now()}`);
  await pool.query('UPDATE subscriptions SET status = "created", razorpay_order_id = ? WHERE id = ? AND user_id = ?', [order.id, current.id, req.user.id]);
  await logPayment(req.user.id, current.id, null, 'subscription.renewal.created', { order });
  res.json({ key: process.env.RAZORPAY_KEY_ID || 'rzp_test_add_key_here', order, subscriptionId: current.id, plan: planDto(plan) });
});

router.post('/payment/verify', hospitalOnly, async (req, res) => {
  const { subscriptionId, paymentId, provider: requestedProvider, cashfree_order_id, razorpay_order_id, razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;
  const provider = normalizeProvider(requestedProvider || (cashfree_order_id ? 'cashfree' : 'razorpay'));
  if (provider === 'cashfree') {
    const orderId = cashfree_order_id || razorpay_order_id;
    if (!orderId) return res.status(400).json({ message: 'Cashfree order id is required' });
    const status = await fetchCashfreeOrder(orderId);
    const paid = ['PAID', 'ACTIVE'].includes(String(status.order_status || '').toUpperCase()) || status.devMode;
    if (!paid) {
      await logPayment(req.user.id, subscriptionId, paymentId || null, 'cashfree.payment.not_paid', status);
      return res.status(400).json({ message: `Cashfree payment is ${status.order_status || 'not paid'}` });
    }
    await activateSubscription(req.user.id, subscriptionId, orderId, paymentId, 'cashfree', status);
    return res.json({ message: 'Cashfree payment verified and subscription activated', status });
  }

  const ok = razorpay_subscription_id
    ? verifySubscriptionPayment(razorpay_payment_id, razorpay_subscription_id, razorpay_signature)
    : verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!ok) return res.status(400).json({ message: 'Payment verification failed' });

  const [[subscription]] = await pool.query('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?', [subscriptionId, req.user.id]);
  if (!subscription) return res.status(404).json({ message: 'Subscription not found' });

  await activateSubscription(req.user.id, subscriptionId, razorpay_payment_id || 'dev_payment', paymentId, 'razorpay', req.body);
  await logPayment(req.user.id, subscriptionId, paymentId || null, 'payment.verified', req.body);
  res.json({ message: 'Payment verified and subscription activated' });
});

router.post('/payment/webhook', express.json({ type: '*/*' }), async (req, res) => {
  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const signature = req.headers['x-razorpay-signature'];
  if (!verifyWebhook(rawBody, signature)) return res.status(400).json({ message: 'Invalid webhook signature' });
  const event = req.body.event || 'unknown';
  const payload = req.body.payload || {};
  await pool.query('INSERT INTO payment_logs (user_id,event_name,event_payload,status) VALUES (NULL,?,?, "received")', [event, JSON.stringify(payload)]);
  if (event === 'subscription.cancelled') {
    const id = payload.subscription?.entity?.id;
    if (id) await pool.query('UPDATE subscriptions SET status = "cancelled" WHERE razorpay_order_id = ?', [id]);
  }
  if (event === 'subscription.activated' || event === 'subscription.charged' || event === 'payment.captured') {
    const subId = payload.subscription?.entity?.id;
    if (subId) await pool.query('UPDATE subscriptions SET status = "active" WHERE razorpay_order_id = ?', [subId]);
  }
  if (event === 'payment.failed') {
    const paymentId = payload.payment?.entity?.id;
    if (paymentId) await pool.query('UPDATE payments SET status = "failed" WHERE razorpay_payment_id = ?', [paymentId]);
  }
  res.json({ ok: true });
});

router.post('/cashfree/webhook', express.json({ type: '*/*' }), async (req, res) => {
  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  if (!verifyCashfreeWebhook(rawBody, signature, timestamp)) return res.status(400).json({ message: 'Invalid Cashfree webhook signature' });
  const event = req.body.type || req.body.event || 'cashfree.payment.event';
  const payload = req.body.data || req.body || {};
  const order = payload.order || payload;
  const payment = payload.payment || {};
  const orderId = order.order_id || payload.order_id;
  await pool.query('INSERT INTO payment_logs (user_id,event_name,event_payload,status) VALUES (NULL,?,?, "received")', [event, JSON.stringify(payload)]);
  if (orderId && ['PAYMENT_SUCCESS_WEBHOOK', 'payment.success', 'PAYMENT_CAPTURED'].includes(event)) {
    await activateSubscriptionByOrder(orderId, payment.cf_payment_id || payment.payment_id || orderId, 'cashfree', payload);
  }
  if (orderId && ['PAYMENT_FAILED_WEBHOOK', 'payment.failed', 'PAYMENT_USER_DROPPED_WEBHOOK'].includes(event)) {
    await pool.query('UPDATE payments SET status = "failed" WHERE razorpay_order_id = ?', [orderId]);
  }
  res.json({ ok: true });
});

router.get('/coupons/:code', hospitalOnly, async (req, res) => {
  const amount = Number(req.query.amount_paise || 0);
  res.json(await resolveCoupon(req.params.code, amount));
});

async function currentSubscription(req, res) {
  const [[subscription]] = await pool.query('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.user.id]);
  const [plans] = await pool.query('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order');
  const [history] = await pool.query(
    `SELECT i.id,i.invoice_no,i.amount_paise,i.status,i.created_at,p.razorpay_payment_id,p.cashfree_payment_id,p.payment_provider AS provider,p.status AS payment_status,s.plan_name
     FROM invoices i
     LEFT JOIN subscriptions s ON s.id = i.subscription_id
     LEFT JOIN payments p ON p.subscription_id = s.id AND p.user_id = i.user_id
     WHERE i.user_id = ?
     ORDER BY i.created_at DESC
     LIMIT 20`,
    [req.user.id]
  );
  const [[usage]] = subscription
    ? await pool.query('SELECT * FROM subscription_usage WHERE subscription_id = ? AND user_id = ?', [subscription.id, req.user.id])
    : [[null]];
  const [logs] = await pool.query('SELECT * FROM payment_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [req.user.id]);
  const plan = subscription ? plans.find((item) => item.name === subscription.plan_name) : plans.find((item) => item.code === 'free');
  res.json({
    subscription: subscriptionDto(subscription, plan),
    plans: plans.map(planDto),
    comparison: comparisonRows(),
    usage: usage || defaultUsage(plan),
    billing_history: history,
    activity: logs,
    auto_renew: { enabled: true, reminder_days: 7, email: true, sms: true }
  });
}

async function paymentHistory(req, res) {
  const [rows] = await pool.query(
    `SELECT p.*, p.payment_provider AS provider, s.plan_name, i.invoice_no
     FROM payments p
     LEFT JOIN subscriptions s ON s.id = p.subscription_id
     LEFT JOIN invoices i ON i.subscription_id = s.id AND i.user_id = p.user_id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC`,
    [req.user.id]
  );
  res.json({ rows });
}

async function invoiceDownload(req, res) {
  const [[invoice]] = await pool.query('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_no}.json"`);
  res.send(JSON.stringify(invoice, null, 2));
}

async function ensureBillingTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS subscription_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(255),
    amount_paise INT NOT NULL DEFAULT 0,
    billing_cycle ENUM('monthly','yearly') DEFAULT 'monthly',
    donor_search_limit INT DEFAULT 0,
    emergency_request_limit INT DEFAULT 0,
    notification_limit INT DEFAULT 0,
    blood_request_limit INT DEFAULT 0,
    features JSON NULL,
    razorpay_plan_id VARCHAR(120),
    is_recommended TINYINT(1) DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subscription_id INT NOT NULL,
    invoice_no VARCHAR(80) NOT NULL UNIQUE,
    amount_paise INT NOT NULL,
    tax_paise INT NOT NULL DEFAULT 0,
    status ENUM('draft','paid','failed','cancelled') DEFAULT 'paid',
    billing_details JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS billing_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    legal_name VARCHAR(160),
    gst_number VARCHAR(40),
    billing_email VARCHAR(160),
    billing_phone VARCHAR(30),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS subscription_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subscription_id INT NOT NULL,
    donor_searches_used INT DEFAULT 0,
    emergency_requests_used INT DEFAULT 0,
    notifications_sent INT DEFAULT 0,
    blood_requests_used INT DEFAULT 0,
    period_start DATE,
    period_end DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_usage_subscription (subscription_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS payment_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    subscription_id INT NULL,
    payment_id INT NULL,
    event_name VARCHAR(100) NOT NULL,
    event_payload JSON NULL,
    status VARCHAR(40) DEFAULT 'recorded',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_payment_logs_user (user_id, created_at)
  )`);
  await addColumnIfMissing('subscriptions', 'payment_provider', 'VARCHAR(40) DEFAULT "razorpay"');
  await addColumnIfMissing('subscriptions', 'cashfree_order_id', 'VARCHAR(120)');
  await addColumnIfMissing('subscriptions', 'cashfree_payment_id', 'VARCHAR(120)');
  await addColumnIfMissing('payments', 'payment_provider', 'VARCHAR(40) DEFAULT "razorpay"');
  await addColumnIfMissing('payments', 'cashfree_order_id', 'VARCHAR(120)');
  await addColumnIfMissing('payments', 'cashfree_payment_id', 'VARCHAR(120)');
}

async function seedPlans() {
  for (let index = 0; index < defaultPlans.length; index += 1) {
    const plan = defaultPlans[index];
    await pool.query(
      `INSERT INTO subscription_plans
       (code,name,description,amount_paise,billing_cycle,donor_search_limit,emergency_request_limit,notification_limit,blood_request_limit,features,is_recommended,sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), amount_paise=VALUES(amount_paise), features=VALUES(features), is_recommended=VALUES(is_recommended), sort_order=VALUES(sort_order)`,
      [plan.code, plan.name, `${plan.name} hospital subscription`, plan.amount_paise, plan.billing_cycle, plan.donor_search_limit, plan.emergency_request_limit, plan.notification_limit, plan.blood_request_limit, JSON.stringify(plan.features), plan.recommended ? 1 : 0, index + 1]
    );
  }
}

async function getPlan(code) {
  const [[plan]] = await pool.query('SELECT * FROM subscription_plans WHERE code = ? OR LOWER(name) = LOWER(?) LIMIT 1', [code, code]);
  if (!plan) {
    const error = new Error('Invalid subscription plan');
    error.status = 400;
    throw error;
  }
  return plan;
}

async function ensureRazorpayPlan(plan) {
  if (plan.razorpay_plan_id) return plan.razorpay_plan_id;
  const created = await createPlan(plan);
  await pool.query('UPDATE subscription_plans SET razorpay_plan_id = ? WHERE id = ?', [created.id, plan.id]);
  return created.id;
}

async function resolveCoupon(code, amountPaise) {
  const normalized = String(code || '').trim().toUpperCase();
  const discounts = { WELCOME50: 50, HOSPITAL20: 20 };
  const percent = discounts[normalized] || 0;
  const discount_paise = Math.round(Number(amountPaise || 0) * percent / 100);
  return {
    code: normalized || null,
    valid: !!percent,
    percent,
    discount_paise,
    message: percent ? `${percent}% discount applied` : normalized ? 'Coupon is not valid' : 'No coupon applied'
  };
}

async function upsertUsage(subscriptionId, userId, plan) {
  await pool.query(
    `INSERT INTO subscription_usage
     (user_id,subscription_id,donor_searches_used,emergency_requests_used,notifications_sent,blood_requests_used,period_start,period_end)
     VALUES (?,?,?,?,?,?,CURDATE(),DATE_ADD(CURDATE(), INTERVAL 1 MONTH))
     ON DUPLICATE KEY UPDATE period_end=VALUES(period_end)`,
    [userId, subscriptionId, 0, 0, 0, 0]
  );
}

async function createInvoice(userId, subscriptionId, paymentId) {
  const [[subscription]] = await pool.query('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?', [subscriptionId, userId]);
  if (!subscription) return;
  const tax = Math.round(Number(subscription.amount_paise || 0) * 0.18);
  const invoiceNo = `LL-INV-${String(subscriptionId).padStart(6, '0')}`;
  await pool.query(
    `INSERT INTO invoices (user_id,subscription_id,invoice_no,amount_paise,tax_paise,status,billing_details)
     VALUES (?,?,?,?,?,"paid",?)
     ON DUPLICATE KEY UPDATE amount_paise=VALUES(amount_paise), tax_paise=VALUES(tax_paise), status="paid"`,
    [userId, subscriptionId, invoiceNo, subscription.amount_paise, tax, JSON.stringify({ paymentId })]
  );
}

async function logPayment(userId, subscriptionId, paymentId, eventName, payload) {
  await pool.query(
    'INSERT INTO payment_logs (user_id,subscription_id,payment_id,event_name,event_payload,status) VALUES (?,?,?,?,?,"recorded")',
    [userId || null, subscriptionId || null, paymentId || null, eventName, JSON.stringify(payload || {})]
  );
}

async function createProviderOrder(provider, amount, subscriptionId, user, plan) {
  if (provider === 'cashfree') {
    const orderId = `lifelink_cf_${subscriptionId}_${Date.now()}`;
    return createCashfreeOrder({
      amountPaise: amount,
      orderId,
      customer: user,
      returnUrl: `${process.env.APP_URL || 'http://localhost:4000'}/pages/hospital/subscription-plan.html?order_id=${orderId}`,
      notes: { note: `LifeLink ${plan.name} hospital subscription` }
    });
  }
  return createOrder(amount, `lifelink_upgrade_${subscriptionId}`);
}

async function activateSubscription(userId, subscriptionId, providerPaymentId, paymentId, provider, payload) {
  const [[subscription]] = await pool.query('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?', [subscriptionId, userId]);
  if (!subscription) {
    const error = new Error('Subscription not found');
    error.status = 404;
    throw error;
  }
  await pool.query(
    `UPDATE subscriptions
     SET status="active", razorpay_payment_id=?, starts_at=COALESCE(starts_at,NOW()), expires_at=DATE_ADD(NOW(), INTERVAL 1 MONTH),
         payment_provider=?, cashfree_payment_id=IF(?="cashfree",?,cashfree_payment_id)
     WHERE id=? AND user_id=?`,
    [providerPaymentId, provider, provider, providerPaymentId, subscriptionId, userId]
  );
  await pool.query(
    `UPDATE payments
     SET status="paid", razorpay_payment_id=COALESCE(?, razorpay_payment_id), payment_provider=?,
         cashfree_payment_id=IF(?="cashfree",?,cashfree_payment_id)
     WHERE id = ? AND user_id = ?`,
    [providerPaymentId, provider, provider, providerPaymentId, paymentId || 0, userId]
  );
  await createInvoice(userId, subscriptionId, providerPaymentId);
  await logPayment(userId, subscriptionId, paymentId || null, `${provider}.payment.verified`, payload);
}

async function activateSubscriptionByOrder(orderId, providerPaymentId, provider, payload) {
  const [[subscription]] = await pool.query('SELECT * FROM subscriptions WHERE razorpay_order_id = ? OR cashfree_order_id = ? LIMIT 1', [orderId, orderId]);
  if (!subscription) return;
  const [[payment]] = await pool.query('SELECT * FROM payments WHERE subscription_id = ? ORDER BY created_at DESC LIMIT 1', [subscription.id]);
  await activateSubscription(subscription.user_id, subscription.id, providerPaymentId, payment?.id || null, provider, payload);
}

async function addColumnIfMissing(table, column, definition) {
  const [[existing]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (!existing.count) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function normalizeProvider(value) {
  return String(value || '').toLowerCase() === 'razorpay' ? 'razorpay' : 'cashfree';
}

function planDto(plan) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    price: Number(plan.amount_paise || 0) / 100,
    amount_paise: Number(plan.amount_paise || 0),
    billing_cycle: plan.billing_cycle,
    donor_search_limit: plan.donor_search_limit,
    emergency_request_limit: plan.emergency_request_limit,
    notification_limit: plan.notification_limit,
    blood_request_limit: plan.blood_request_limit,
    features: parseJson(plan.features, []),
    razorpay_plan_id: plan.razorpay_plan_id,
    recommended: !!plan.is_recommended
  };
}

function subscriptionDto(subscription, plan) {
  if (!subscription) {
    return {
      id: null,
      plan_name: plan?.name || 'Free',
      status: 'trial',
      amount_paise: 0,
      starts_at: null,
      expires_at: null,
      remaining_days: 0,
      auto_renew: true,
      plan: plan ? planDto(plan) : null
    };
  }
  const expires = subscription.expires_at ? new Date(subscription.expires_at) : null;
  const remaining = expires ? Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86400000)) : 0;
  return {
    ...subscription,
    remaining_days: remaining,
    auto_renew: true,
    plan: plan ? planDto(plan) : null
  };
}

function defaultUsage(plan = {}) {
  return {
    donor_searches_used: 0,
    emergency_requests_used: 0,
    notifications_sent: 0,
    blood_requests_used: 0,
    donor_search_limit: plan.donor_search_limit || 10,
    emergency_request_limit: plan.emergency_request_limit || 0,
    notification_limit: plan.notification_limit || 50,
    blood_request_limit: plan.blood_request_limit || 5
  };
}

function comparisonRows() {
  return [
    ['Donor Search Limit', '10/month', '100/month', 'Unlimited', 'Unlimited'],
    ['Emergency Requests', 'Limited', 'Included', 'Priority', 'Unlimited'],
    ['Live Tracking', 'No', 'No', 'Yes', 'Yes'],
    ['AI Matching', 'No', 'Basic', 'Advanced', 'Enterprise'],
    ['Notifications', 'Basic', 'Email', 'Email + SMS', 'Unlimited'],
    ['Analytics', 'Basic', 'Standard', 'Advanced', 'Premium'],
    ['Reports', 'No', 'PDF', 'PDF + Excel', 'Custom'],
    ['Multi Branch', 'No', 'No', 'No', 'Yes'],
    ['Premium Support', 'No', 'Email', 'Priority', 'Dedicated'],
    ['AI Prediction', 'No', 'No', 'Yes', 'Yes']
  ];
}

function parseJson(value, fallback) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value || fallback;
  } catch {
    return fallback;
  }
}

module.exports = router;
