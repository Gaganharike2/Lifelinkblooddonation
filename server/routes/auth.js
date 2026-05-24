const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const pool = require('../config/db');
const { issueOtp, verifyOtp } = require('../services/otpService');
const { sendPhoneOtp, verifyPhoneOtp } = require('../services/twilioVerifyService');
const auth = require('../middleware/auth');
const { getUserColumns, getUserContactColumn, hasUserColumn } = require('../utils/userColumns');
const { allowDevOtp, jwtSecret } = require('../config/env');

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile || user.phone,
    role: user.role,
    blood_group: user.blood_group,
    city: user.city,
    is_verified: !!user.is_verified,
    account_status: user.account_status || 'active',
    referral_code: user.referral_code
  };
}

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, jwtSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function otpResponse(base, otp) {
  return allowDevOtp() && otp?.devCode ? { ...base, devOtp: otp.devCode } : base;
}

function otpChannel(req) {
  const value = String(req.body.channel || req.body.otp_channel || process.env.OTP_CHANNEL || 'email').toLowerCase();
  return ['phone', 'mobile', 'sms', 'whatsapp'].includes(value) ? 'phone' : 'email';
}

async function sendAuthOtp(user, purpose, channel) {
  if (channel === 'phone') {
    return sendPhoneOtp(user.mobile || user.phone);
  }
  return issueOtp(user.id, user.email, purpose, 'email');
}

async function sendAuthOtpWithFallback(user, purpose, preferredChannel) {
  try {
    const result = await sendAuthOtp(user, purpose, preferredChannel);
    return { ...result, channel: preferredChannel, fallback: false };
  } catch (error) {
    if (preferredChannel !== 'phone' || !user.email || process.env.OTP_EMAIL_FALLBACK === '0') throw error;
    console.warn(`[LifeLink OTP fallback] Phone OTP failed for user ${user.id || user.email}: ${error.message}`);
    const result = await issueOtp(user.id, user.email, purpose, 'email');
    return { ...result, channel: 'email', fallback: true };
  }
}

async function passwordMatches(password, storedHash) {
  if (!storedHash) return false;
  if (storedHash.startsWith('sha256:')) {
    const digest = crypto.createHash('sha256').update(password).digest('hex');
    return `sha256:${digest}` === storedHash;
  }
  const bcryptMatch = await bcrypt.compare(password, storedHash).catch(() => false);
  return bcryptMatch || password === storedHash;
}

async function safeInsertRoleProfile(role, userId) {
  const roleTables = {
    donor: 'donor_profiles',
    patient: 'patients',
    hospital: 'hospitals',
    blood_bank: 'blood_banks',
    camp_organizer: 'camp_organizers',
    ngo: 'ngos',
    volunteer: 'volunteers'
  };
  const table = roleTables[role];
  if (!table) return;
  try {
    await pool.query(`INSERT INTO ${table} (user_id) VALUES (?)`, [userId]);
  } catch (error) {
    if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_NO_DEFAULT_FOR_FIELD'].includes(error.code)) throw error;
  }
}

router.post('/register', async (req, res) => {
  const { name, email, password, role = 'donor', blood_group, city, address, referral_code } = req.body;
  const mobile = req.body.mobile || req.body.phone;
  if (!name || !email || !mobile || !password) return res.status(400).json({ message: 'Name, email, mobile and password are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });
  if (!/^\+?[0-9]{10,15}$/.test(String(mobile))) return res.status(400).json({ message: 'Enter a valid mobile number' });
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(password)) {
    return res.status(400).json({ message: 'Password must be at least 10 characters and include uppercase, lowercase, number and symbol' });
  }
  const allowedRoles = ['donor', 'patient', 'hospital', 'blood_bank', 'camp_organizer', 'ngo', 'volunteer'];
  if (!allowedRoles.includes(role)) return res.status(400).json({ message: 'Invalid role' });
  const contactColumn = await getUserContactColumn(pool);
  const userColumns = await getUserColumns(pool);

  const [existing] = await pool.query(`SELECT id FROM users WHERE email = ? OR ${contactColumn} = ?`, [email, mobile]);
  if (existing.length) return res.status(409).json({ message: 'Email or mobile already registered' });

  let referredBy = null;
  const supportsReferrals = userColumns.has('referral_code') && userColumns.has('referred_by');
  if (referral_code && supportsReferrals) {
    const [ref] = await pool.query('SELECT id FROM users WHERE referral_code = ?', [referral_code]);
    if (ref.length) referredBy = ref[0].id;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const ownReferral = `LL${uuid().slice(0, 8).toUpperCase()}`;
  const insertData = {
    name,
    full_name: name,
    email,
    [contactColumn]: mobile,
    phone: mobile,
    password_hash: passwordHash,
    password: passwordHash,
    role,
    status: 'active',
    blood_group: blood_group || null,
    city: city || null,
    address: address || null,
    referral_code: ownReferral,
    referred_by: referredBy
  };
  const insertColumns = Object.keys(insertData).filter((column) => userColumns.has(column));
  const placeholders = insertColumns.map(() => '?').join(', ');
  const values = insertColumns.map((column) => insertData[column]);
  const [result] = await pool.query(
    `INSERT INTO users (${insertColumns.join(',')}) VALUES (${placeholders})`,
    values
  );

  await safeInsertRoleProfile(role, result.insertId);
  if (referredBy) {
    try {
      await pool.query('INSERT INTO rewards (user_id, points, reason) VALUES (?, 250, ?)', [referredBy, `Referral signup: ${name}`]);
    } catch (error) {
      if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
    }
  }

  const channel = otpChannel(req);
  const otp = await sendAuthOtpWithFallback({ id: result.insertId, email, mobile }, 'register', channel);
  res.status(201).json(otpResponse({ message: `Registered. Verify OTP sent to your ${otp.channel === 'phone' ? 'phone' : 'email'}.`, userId: result.insertId, channel: otp.channel }, otp));
});

router.post('/verify-otp', async (req, res) => {
  const { userId, otp, purpose = 'register' } = req.body;
  const [[pendingUser]] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (!pendingUser) return res.status(404).json({ message: 'User not found' });
  const channel = otpChannel(req);
  const ok = channel === 'phone'
    ? await verifyPhoneOtp(pendingUser.mobile || pendingUser.phone, otp)
    : await verifyOtp(userId, otp, purpose);
  if (!ok) return res.status(400).json({ message: 'Invalid or expired OTP' });

  await pool.query('UPDATE users SET is_verified = 1 WHERE id = ?', [userId]);
  const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  res.json({ message: 'Verification successful', token: sign(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;
  const contactColumn = await getUserContactColumn(pool);
  const [rows] = await pool.query(`SELECT * FROM users WHERE email = ? OR ${contactColumn} = ? LIMIT 1`, [identifier, identifier]);
  if (!rows.length) return res.status(401).json({ message: 'Invalid login details' });

  const user = rows[0];
  if (user.account_status && user.account_status !== 'active') {
    return res.status(403).json({ message: 'Your account is not active. Please contact support.' });
  }
  const valid = await passwordMatches(password, user.password_hash);
  if (!valid) return res.status(401).json({ message: 'Invalid login details' });

  if (!user.is_verified) {
    const channel = otpChannel(req);
    const otp = await sendAuthOtpWithFallback(user, 'login', channel);
    return res.status(202).json(otpResponse({ message: `OTP verification required. Code sent to your ${otp.channel === 'phone' ? 'phone' : 'email'}.`, userId: user.id, needsOtp: true, channel: otp.channel }, otp));
  }

  res.json({ token: sign(user), user: publicUser(user) });
});

router.post('/resend-otp', async (req, res) => {
  const { userId, purpose = 'register' } = req.body;
  const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const channel = otpChannel(req);
  const otp = await sendAuthOtpWithFallback(user, purpose, channel);
  res.json(otpResponse({ message: `OTP sent to your ${otp.channel === 'phone' ? 'phone' : 'email'}.`, channel: otp.channel }, otp));
});

router.post('/forgot-password', async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) return res.status(400).json({ message: 'Email or mobile is required' });
  const contactColumn = await getUserContactColumn(pool);
  const [rows] = await pool.query(`SELECT * FROM users WHERE email = ? OR ${contactColumn} = ? LIMIT 1`, [identifier, identifier]);
  if (!rows.length) {
    return res.json({ message: 'If the account exists, a reset OTP has been sent.' });
  }
  const user = rows[0];
  const channel = otpChannel(req);
  const otp = await sendAuthOtpWithFallback(user, 'reset', channel);
  res.json(otpResponse({ message: `If the account exists, a reset OTP has been sent to the registered ${otp.channel === 'phone' ? 'phone' : 'email'}.`, channel: otp.channel }, otp));
});

router.post('/reset-password', async (req, res) => {
  const { userId, identifier, otp, password } = req.body;
  if ((!userId && !identifier) || !otp || !password) return res.status(400).json({ message: 'Account, OTP and new password are required' });
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(password)) {
    return res.status(400).json({ message: 'Password must be at least 10 characters and include uppercase, lowercase, number and symbol' });
  }
  const contactColumn = await getUserContactColumn(pool);
  const [rows] = userId
    ? await pool.query('SELECT * FROM users WHERE id = ?', [userId])
    : await pool.query(`SELECT * FROM users WHERE email = ? OR ${contactColumn} = ? LIMIT 1`, [identifier, identifier]);
  const user = rows[0];
  if (!user) return res.status(404).json({ message: 'User not found' });
  const channel = otpChannel(req);
  const ok = channel === 'phone'
    ? await verifyPhoneOtp(user.mobile || user.phone, otp)
    : await verifyOtp(user.id, otp, 'reset');
  if (!ok) return res.status(400).json({ message: 'Invalid or expired OTP' });
  const passwordHash = await bcrypt.hash(password, 10);
  const userColumns = await getUserColumns(pool);
  if (userColumns.has('password')) {
    await pool.query('UPDATE users SET password_hash = ?, password = ? WHERE id = ?', [passwordHash, passwordHash, user.id]);
  } else {
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
  }
  res.json({ message: 'Password reset successful' });
});

router.get('/me', auth(), async (req, res) => {
  const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: publicUser(user) });
});

module.exports = router;
