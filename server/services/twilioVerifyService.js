const twilio = require('twilio');
const { allowDevOtp, isProduction } = require('../config/env');

function configured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);
}

function client() {
  if (!configured()) return null;
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function normalizePhone(phone) {
  const raw = String(phone || '').trim().replace(/[^\d+]/g, '');
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  if (raw.length === 10) return `+91${raw}`;
  return `+${raw}`;
}

async function sendPhoneOtp(phone) {
  const to = normalizePhone(phone);
  if (!/^\+[1-9]\d{9,14}$/.test(to)) {
    throw new Error('Enter a valid phone number with country code');
  }

  const api = client();
  if (!api) {
    if (isProduction()) throw new Error('Twilio Verify is not configured for production phone OTP.');
    if (allowDevOtp()) return { delivered: false, devCode: '123456', to };
    return { delivered: false, to };
  }

  await api.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verifications.create({ to, channel: process.env.TWILIO_VERIFY_CHANNEL || 'sms' });

  return { delivered: true, to };
}

async function verifyPhoneOtp(phone, code) {
  const to = normalizePhone(phone);
  if (!code) return false;

  const api = client();
  if (!api) {
    if (allowDevOtp()) return code === '123456';
    if (isProduction()) throw new Error('Twilio Verify is not configured for production phone OTP.');
    return false;
  }

  const result = await api.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks.create({ to, code });

  return result.status === 'approved';
}

module.exports = { configured, normalizePhone, sendPhoneOtp, verifyPhoneOtp };
