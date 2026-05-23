process.env.NODE_ENV = 'test';
process.env.PORT = '4010';
process.env.APP_URL = `http://localhost:${process.env.PORT}`;
process.env.CORS_ORIGINS = process.env.APP_URL;
process.env.OTP_CHANNEL = 'email';
process.env.ALLOW_DEV_OTP = '1';
process.env.EMAIL_DISABLED = '1';

require('../server/app');
