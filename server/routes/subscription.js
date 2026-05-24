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
  );ON DUPLICATE KEY UPDATE name=VALUES(name), amount_paise=VALUES(amount_paise), features=VALUES(features), is_recommended=VALUES(is_recommended), sort_order=VALUES(sort_order)`,
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
     VALUES (?,?,?,?,?,'paid',?)
     ON DUPLICATE KEY UPDATE amount_paise=VALUES(amount_paise), tax_paise=VALUES(tax_paise), status='paid'`,
    [userId, subscriptionId, invoiceNo, subscription.amount_paise, tax, JSON.stringify({ paymentId })]
  );
}

async function logPayment(userId, subscriptionId, paymentId, eventName, payload) {
  await pool.query(
    "INSERT INTO payment_logs (user_id,subscription_id,payment_id,event_name,event_payload,status) VALUES (?,?,?,?,?,'recorded')",
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
     SET status='active', razorpay_payment_id=?, starts_at=COALESCE(starts_at,NOW()), expires_at=DATE_ADD(NOW(), INTERVAL 1 MONTH),
         payment_provider=?, cashfree_payment_id=IF(?='cashfree',?,cashfree_payment_id)
     WHERE id=? AND user_id=?`,
    [providerPaymentId, provider, provider, providerPaymentId, subscriptionId, userId]
  );
  await pool.query(
    `UPDATE payments
     SET status='paid', razorpay_payment_id=COALESCE(?, razorpay_payment_id), payment_provider=?,
         cashfree_payment_id=IF(?='cashfree',?,cashfree_payment_id)
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
