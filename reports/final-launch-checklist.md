# Final Launch Checklist

- [ ] Rotate .env secrets and issue new Twilio/Razorpay/Google keys.
- [ ] Set NODE_ENV=production.
- [ ] Use HTTPS APP_URL.
- [ ] Set a strong JWT_SECRET with at least 32 random characters.
- [ ] Configure live payment provider credentials and webhook secrets.
- [ ] Configure verified SMTP for OTP/email.
- [ ] Run npm run check:production until it passes.
- [ ] Run npm test in this workspace.
- [ ] Run npx playwright test in a normal browser-capable CI/workstation for screenshots.
- [ ] Review legal/privacy/healthcare operational requirements in docs/PRODUCTION_LAUNCH_CHECKLIST.md.
