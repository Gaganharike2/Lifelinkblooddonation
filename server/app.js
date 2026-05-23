require('express-async-errors');
require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { isProduction, validateProductionConfig } = require('./config/env');

validateProductionConfig();

const app = express();
const port = Number(process.env.PORT || 4000);
const server = http.createServer(app);
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.APP_URL || 'http://localhost:4000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const primaryOrigin = allowedOrigins[0] || 'http://localhost:4000';
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by LifeLink CORS policy'));
  },
  credentials: true
};
const io = new Server(server, { cors: { origin: allowedOrigins, credentials: true } });

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: isProduction() ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://code.jquery.com', 'https://checkout.razorpay.com', 'https://sdk.cashfree.com', 'https://maps.googleapis.com', 'https://unpkg.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com', 'https://unpkg.com'],
      fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https://maps.gstatic.com', 'https://maps.googleapis.com', 'https://*.tile.openstreetmap.org'],
      connectSrc: ["'self'", primaryOrigin, 'https://api.razorpay.com', 'https://sandbox.cashfree.com', 'https://api.cashfree.com', 'https://maps.googleapis.com', 'https://*.tile.openstreetmap.org', 'https://cdn.jsdelivr.net'],
      frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com', 'https://payments.cashfree.com', 'https://sandbox.cashfree.com', 'https://api.cashfree.com']
    }
  } : false
}));
app.use(cors(corsOptions));
app.use((req, res, next) => {
  res.setHeader('X-Request-Id', req.headers['x-request-id'] || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buffer) => {
    req.rawBody = buffer.toString('utf8');
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction() ? 300 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please wait a minute, then try again.' },
  skip: (req) => !isProduction() && (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/assets/') || req.path === '/healthz')
}));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction() ? 40 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login or OTP attempts. Please wait and try again.' }
}), require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/advanced', require('./routes/advanced')(io));
app.use('/api', require('./routes/subscription'));
app.use('/api/hospital', require('./routes/hospital')(io));
app.use('/api/donor', require('./routes/donor')(io));
app.use('/api/company', require('./routes/company'));

app.get('/api/config', (req, res) => {
  res.json({
    mapProvider: process.env.MAP_PROVIDER || 'leaflet',
    mapTileUrl: process.env.MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    mapAttribution: process.env.MAP_ATTRIBUTION || '&copy; OpenStreetMap contributors',
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    paymentProvider: process.env.PAYMENT_PROVIDER || 'cashfree',
    cashfreeEnvironment: process.env.CASHFREE_ENV || 'sandbox'
  });
});

app.get('/healthz', (req, res) => res.json({ ok: true, app: 'LifeLink', environment: process.env.NODE_ENV || 'development' }));
app.get('/readyz', async (req, res) => {
  const checks = {};
  try {
    await require('./config/db').query('SELECT 1');
    checks.database = true;
  } catch {
    checks.database = false;
  }
  checks.email = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS && !/your_|example\.com/i.test(process.env.EMAIL_USER));
  checks.payments = Boolean(
    (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) ||
    (process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET)
  );
  checks.maps = (process.env.MAP_PROVIDER || 'leaflet') === 'google'
    ? Boolean(process.env.GOOGLE_MAPS_API_KEY)
    : Boolean(process.env.MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
  checks.twilio = process.env.OTP_CHANNEL === 'phone'
    ? Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID)
    : true;
  const ok = Object.values(checks).every(Boolean);
  res.status(ok ? 200 : 503).json({ ok, checks });
});
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.use((error, req, res, next) => {
  console.error('[LifeLink API error]', error);
  const databaseCodes = ['ECONNREFUSED', 'ER_BAD_DB_ERROR', 'ER_ACCESS_DENIED_ERROR', 'PROTOCOL_CONNECTION_LOST'];
  if (databaseCodes.includes(error.code)) {
    return res.status(503).json({
      message: 'Database connection failed. Start XAMPP/MySQL, create/import lifelink_blood, then restart LifeLink.',
      code: error.code
    });
  }
  const status = error.status || 500;
  res.status(status).json({
    message: status >= 500 && isProduction() ? 'LifeLink server error' : (error.message || 'LifeLink server error'),
    requestId: res.getHeader('X-Request-Id')
  });
});

io.on('connection', (socket) => {
  socket.on('join-room', (room) => socket.join(room));
  socket.on('chat-message', (message) => {
    io.to(message.room || 'public').emit('chat-message', {
      ...message,
      created_at: new Date().toISOString()
    });
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Close the old LifeLink server or set PORT=4001 in .env.`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, () => console.log(`LifeLink running on http://localhost:${port}`));
