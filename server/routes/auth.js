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
