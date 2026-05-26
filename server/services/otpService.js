const crypto = require('crypto');
const nodemailer = require('nodemailer');
const pool = require('../config/db');
const { allowDevOtp, isProduction } = require('../config/env');

function createOtp() {
  return String(crypto.randomInt(100000, 999999));
}

function cleanEmailValue(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

function emailTransportConfig() {
  const host = cleanEmailValue(process.env.EMAIL_HOST || 'smtp.gmail.com')
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/g, '');
  const port = Number(cleanEmailValue(process.env.EMAIL_PORT || 587));
  const user = cleanEmailValue(process.env.EMAIL_USER);
  const pass = cleanEmailValue(process.env.EMAIL_PASS).replace(/\s+/g, '');

  if (host === 'smtp.gmail.com') {
    return {
      service: 'gmail',
      auth: { user, pass }
    };
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  };
}

async function sendEmailOtp(email, code) {
  if (process.env.EMAIL_DISABLED === '1' || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    if (allowDevOtp()) {
      console.log(`[LifeLink dev OTP] ${email}: ${code}`);
      return { delivered: false, devCode: code };
    }
    if (isProduction()) throw new Error('Email OTP delivery is not configured for production.');
    return { delivered: false };
  }

  const transporter = nodemailer.createTransport(emailTransportConfig());

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'LifeLink <no-reply@lifelink.local>',
      to: email,
      subject: 'Your LifeLink verification OTP',
      html: `<p>Your LifeLink OTP is <strong>${code}</strong>. It expires soon.</p>`
    });
  } catch (error) {
    console.warn(`[LifeLink email disabled for this OTP] ${error.message}`);
    if (allowDevOtp()) {
      console.log(`[LifeLink dev OTP] ${email}: ${code}`);
      return { delivered: false, devCode: code };
    }
    if (isProduction()) throw new Error('Email OTP delivery failed.');
    return { delivered: false };
  }

  return { delivered: true };
}

async function issueOtp(userId, email, purpose = 'register', channel = 'email') {
  const code = createOtp();
  const minutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);
  await pool.query(
    'INSERT INTO otp_codes (user_id, channel, code, purpose, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
    [userId, channel, code, purpose, minutes]
  );
  return sendEmailOtp(email, code);
}

async function verifyOtp(userId, code, purpose) {
  const [rows] = await pool.query(
    `SELECT id FROM otp_codes
     WHERE user_id = ? AND code = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [userId, code, purpose]
  );
  if (!rows.length) return false;
  await pool.query('UPDATE otp_codes SET used_at = NOW() WHERE id = ?', [rows[0].id]);
  return true;
}

module.exports = { issueOtp, verifyOtp };
