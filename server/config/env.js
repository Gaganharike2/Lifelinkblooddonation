function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isPlaceholder(value) {
  if (!value) return true;
  return /change-this|your_|example\.com|localhost|127\.0\.0\.1|dev-secret|add_key_here/i.test(String(value));
}

function allowDevOtp() {
  return !isProduction() && process.env.ALLOW_DEV_OTP === '1';
}

function paymentProvider() {
  const provider = String(process.env.PAYMENT_PROVIDER || 'cashfree').toLowerCase();
  return provider === 'razorpay' ? 'razorpay' : 'cashfree';
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (isProduction() && (isPlaceholder(secret) || String(secret).length < 32)) {
    throw new Error('Production JWT_SECRET must be a strong random value of at least 32 characters.');
  }
  return secret || 'dev-secret';
}

function validateProductionConfig() {
  if (!isProduction()) return;

  const provider = paymentProvider();
  const required = [
    'APP_URL',
    'JWT_SECRET',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'EMAIL_HOST',
    'EMAIL_USER',
    'EMAIL_PASS'
  ];
  if (provider === 'cashfree') {
    required.push('CASHFREE_CLIENT_ID', 'CASHFREE_CLIENT_SECRET');
  } else {
    required.push('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET');
  }
  if ((process.env.MAP_PROVIDER || 'leaflet') === 'google') {
    required.push('GOOGLE_MAPS_API_KEY');
  } else {
    required.push('MAP_TILE_URL');
  }
  if (process.env.OTP_CHANNEL === 'phone') {
    required.push('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID');
  }
  const missing = required.filter((key) => isPlaceholder(process.env[key]));
  if (missing.length) {
    throw new Error(`Production configuration is incomplete or unsafe: ${missing.join(', ')}`);
  }

  if (!/^https:\/\//i.test(process.env.APP_URL || '')) {
    throw new Error('Production APP_URL must use HTTPS.');
  }

  if (provider === 'cashfree' && process.env.CASHFREE_ENV !== 'production') {
    throw new Error('Production must use CASHFREE_ENV=production.');
  }

  if (provider === 'razorpay' && (process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_')) {
    throw new Error('Production must use Razorpay live keys, not test keys.');
  }
}

module.exports = { allowDevOtp, isProduction, jwtSecret, paymentProvider, validateProductionConfig };
