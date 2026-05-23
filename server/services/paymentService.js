const crypto = require('crypto');
const Razorpay = require('razorpay');

const cashfreeApiVersion = process.env.CASHFREE_API_VERSION || '2025-01-01';

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

function getCashfreeConfig() {
  if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET) return null;
  const environment = String(process.env.CASHFREE_ENV || 'sandbox').toLowerCase();
  return {
    environment,
    baseUrl: environment === 'production' ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com',
    clientId: process.env.CASHFREE_CLIENT_ID,
    clientSecret: process.env.CASHFREE_CLIENT_SECRET
  };
}

async function createOrder(amountPaise, receipt) {
  const razorpay = getRazorpay();
  if (!razorpay) {
    return { id: `dev_order_${Date.now()}`, amount: amountPaise, currency: 'INR', receipt, devMode: true };
  }
  return razorpay.orders.create({ amount: amountPaise, currency: 'INR', receipt });
}

async function createCashfreeOrder({ amountPaise, orderId, customer = {}, returnUrl, notes = {} }) {
  const config = getCashfreeConfig();
  if (!config) {
    return {
      order_id: orderId || `dev_cf_order_${Date.now()}`,
      order_amount: Number(amountPaise || 0) / 100,
      order_currency: 'INR',
      payment_session_id: `dev_cf_session_${Date.now()}`,
      order_status: 'ACTIVE',
      devMode: true
    };
  }

  const response = await fetch(`${config.baseUrl}/pg/orders`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-version': cashfreeApiVersion,
      'x-client-id': config.clientId,
      'x-client-secret': config.clientSecret
    },
    body: JSON.stringify({
      order_id: orderId,
      order_amount: Number((Number(amountPaise || 0) / 100).toFixed(2)),
      order_currency: 'INR',
      customer_details: {
        customer_id: String(customer.id || 'lifelink_customer'),
        customer_name: customer.name || 'LifeLink Hospital',
        customer_email: customer.email || 'billing@lifelink.local',
        customer_phone: normalizePhone(customer.phone)
      },
      order_meta: {
        return_url: returnUrl || `${process.env.APP_URL || 'http://localhost:4000'}/pages/hospital/subscription-plan.html?order_id={order_id}`,
        notify_url: `${process.env.APP_URL || 'http://localhost:4000'}/api/cashfree/webhook`,
        payment_methods: 'cc,dc,upi,nb,app,paylater,cardless_emi'
      },
      order_note: notes.note || 'LifeLink hospital subscription'
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.type || 'Cashfree order creation failed');
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function fetchCashfreeOrder(orderId) {
  const config = getCashfreeConfig();
  if (!config) return { order_id: orderId, order_status: 'PAID', devMode: true };
  const response = await fetch(`${config.baseUrl}/pg/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      'x-api-version': cashfreeApiVersion,
      'x-client-id': config.clientId,
      'x-client-secret': config.clientSecret
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.type || 'Cashfree order status check failed');
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function createPlan(plan) {
  const razorpay = getRazorpay();
  if (!razorpay) {
    return { id: `dev_plan_${plan.code}_${Date.now()}`, item: { name: plan.name }, devMode: true };
  }
  return razorpay.plans.create({
    period: plan.billing_cycle || 'monthly',
    interval: 1,
    item: {
      name: `LifeLink ${plan.name}`,
      amount: plan.amount_paise,
      currency: 'INR',
      description: plan.description || `LifeLink ${plan.name} hospital subscription`
    },
    notes: { plan_code: plan.code }
  });
}

async function createSubscription(planId, options = {}) {
  const razorpay = getRazorpay();
  if (!razorpay) {
    return {
      id: `dev_sub_${Date.now()}`,
      plan_id: planId,
      status: 'created',
      short_url: '',
      devMode: true
    };
  }
  return razorpay.subscriptions.create({
    plan_id: planId,
    total_count: options.total_count || 12,
    customer_notify: 1,
    quantity: 1,
    notes: options.notes || {}
  });
}

function verifyPayment(orderId, paymentId, signature) {
  if (!process.env.RAZORPAY_KEY_SECRET) return true;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');
  return expected === signature;
}

function verifySubscriptionPayment(paymentId, subscriptionId, signature) {
  if (!process.env.RAZORPAY_KEY_SECRET) return true;
  const body = `${paymentId}|${subscriptionId}`;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');
  return expected === signature;
}

function verifyWebhook(rawBody, signature) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET && !process.env.RAZORPAY_KEY_SECRET) return true;
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
}

function verifyCashfreeWebhook(rawBody, signature, timestamp) {
  const secret = process.env.CASHFREE_CLIENT_SECRET || process.env.CASHFREE_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature || !timestamp || !rawBody) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}${rawBody}`).digest('base64');
  if (Buffer.byteLength(expected) !== Buffer.byteLength(signature)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return '9999999999';
}

module.exports = {
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
};
