const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { createOrder, verifyPayment } = require('../services/paymentService');

const router = express.Router();

const plans = {
  basic: { name: 'Basic', amount: 49900 },
  pro: { name: 'Pro', amount: 199900 },
  enterprise: { name: 'Enterprise', amount: 499900 }
};

router.get('/plans', (req, res) => res.json({ plans }));

router.post('/create-order', auth(['hospital', 'blood_bank', 'camp_organizer', 'ngo', 'admin', 'super_admin']), async (req, res) => {
  const planKey = req.body.plan || 'basic';
  const plan = plans[planKey];
  if (!plan) return res.status(400).json({ message: 'Invalid plan' });

  const [result] = await pool.query('INSERT INTO subscriptions (user_id,plan_name,amount_paise,status) VALUES (?, ?, ?, "created")', [req.user.id, plan.name, plan.amount]);
  const order = await createOrder(plan.amount, `lifelink_sub_${result.insertId}`);
  await pool.query('UPDATE subscriptions SET razorpay_order_id = ? WHERE id = ?', [order.id, result.insertId]);
  res.json({ order, subscriptionId: result.insertId, key: process.env.RAZORPAY_KEY_ID || 'rzp_test_add_key_here' });
});

router.post('/verify', auth(), async (req, res) => {
  const { subscriptionId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const ok = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!ok) return res.status(400).json({ message: 'Payment verification failed' });

  await pool.query(
    `UPDATE subscriptions
     SET status="active", razorpay_payment_id=?, starts_at=NOW(), expires_at=DATE_ADD(NOW(), INTERVAL 1 MONTH)
     WHERE id=? AND user_id=?`,
    [razorpay_payment_id || 'dev_payment', subscriptionId, req.user.id]
  );
  res.json({ message: 'Subscription activated' });
});

module.exports = router;
