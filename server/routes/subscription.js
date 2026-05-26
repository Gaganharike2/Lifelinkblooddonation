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
    features: [
      '10 donor searches/month',
      'Basic notifications',
      'Limited inventory access',
      'Limited blood requests'
    ]
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
    features: [
      '100 donor searches',
      'Emergency requests',
      'Inventory management',
      'Appointment management',
      'Email support'
    ]
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
    features: [
      'Unlimited donor searches',
      'Smart donor matching',
      'Advanced analytics',
      'Live tracking',
      'Priority emergency alerts',
      'AI donor recommendations'
    ],
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
    features: [
      'Multi-branch support',
      'AI blood prediction',
      'Unlimited everything',
      'CEO dashboard',
      'Dedicated support',
      'Premium analytics'
    ]
  }
];

router.use(async (req, res, next) => {
  await ensureBillingTables();
  await seedPlans();
  next();
});

async function listPlans(req, res) {
  const [plans] = await pool.query(
    'SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order'
  );

  res.json({
    plans: plans.map(planDto),
    comparison: comparisonRows()
  });
}

router.get('/plans', hospitalOnly, listPlans);
router.get('/subscription/plans', hospitalOnly, listPlans);

router.get('/hospital/subscription', hospitalOnly, currentSubscription);
router.get('/payment/history', hospitalOnly, paymentHistory);
router.get('/invoice/download/:id', hospitalOnly, invoiceDownload);

router.post('/subscription/create', hospitalOnly, async (req, res) => {
  const plan = await getPlan(req.body.plan || 'basic');

  const coupon = await resolveCoupon(
    req.body.coupon_code,
    plan.amount_paise
  );

  const amount = Math.max(
    0,
    plan.amount_paise - coupon.discount_paise
  );

  const razorpayPlanId = await ensureRazorpayPlan(plan);

  const razorpaySubscription =
    amount > 0
      ? await createSubscription(razorpayPlanId, {
          notes: {
            user_id: req.user.id,
            plan_code: plan.code
          }
        })
      : {
          id: `free_sub_${Date.now()}`,
          status: 'active'
        };

  const [subscriptionResult] = await pool.query(
    `
    INSERT INTO subscriptions 
    (
      user_id,
      plan_name,
      amount_paise,
      status,
      razorpay_order_id,
      starts_at,
      expires_at
    ) 
    VALUES 
    (
      ?,
      ?,
      ?,
      ?,
      ?,
      NOW(),
      DATE_ADD(NOW(), INTERVAL 1 MONTH)
    )
    `,
    [
      req.user.id,
      plan.name,
      amount,
      amount > 0 ? 'created' : 'active',
      razorpaySubscription.id
    ]
  );
});
