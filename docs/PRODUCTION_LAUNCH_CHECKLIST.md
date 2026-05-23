# LifeLink Production Launch Checklist

LifeLink can be deployed as a serious healthcare product only after both software readiness and operational readiness are complete. This checklist is the launch gate for a public hospital, donor, blood bank and NGO platform.

## 1. Infrastructure

- Deploy behind HTTPS on the final domain.
- Use a managed MySQL database with automated backups.
- Set `NODE_ENV=production`.
- Set a 64+ character random `JWT_SECRET`.
- Run the app behind a process manager such as PM2 or a managed Node runtime.
- Configure log retention, uptime monitoring and error alerts.
- Restrict database access to the application server only.
- Enable `DB_SSL=true` when the production database provider supports SSL.

## 2. Payments

- Use `PAYMENT_PROVIDER=cashfree` for Cashfree launch.
- Use `CASHFREE_ENV=production` only after Cashfree account approval.
- Configure the webhook URL: `https://your-domain.com/api/cashfree/webhook`.
- Test successful, failed and abandoned payments in sandbox.
- Reconcile every payment with `payment_logs`, `payments`, `subscriptions` and `invoices`.
- Keep Razorpay disabled unless `PAYMENT_PROVIDER=razorpay` is intentionally selected.

## 3. OTP And Notifications

- Configure real SMTP for email OTP and alerts.
- Configure Twilio Verify for global phone OTP.
- Verify SMS sender permissions for each launch country.
- Keep development OTP disabled: `ALLOW_DEV_OTP=0`.
- Test emergency donor email/SMS/WhatsApp flows with approved provider accounts.

## 4. Maps

- Use `MAP_PROVIDER=leaflet` for the free global map option.
- For high public traffic, use a production tile provider instead of relying on free public OpenStreetMap tiles.
- Store verified donor, hospital and blood bank latitude/longitude.
- Test search radius, route display and location privacy rules.

## 5. Healthcare Safety

- Verify hospital and blood bank accounts before approval.
- Require consent before exposing donor contact/location to hospitals.
- Add manual override for emergency requests.
- Add audit logs for admin, hospital staff and blood inventory updates.
- Review donor eligibility rules with a qualified medical advisor.
- Keep AI suggestions advisory; never make them the sole medical decision point.

## 6. Legal And Trust

- Publish privacy policy, terms, refund/cancellation policy and contact details.
- Add data deletion and account deactivation workflow.
- Define escalation and support process for emergency incidents.
- Review applicable healthcare, privacy and payment rules for each launch country.

## 7. Required Commands Before Launch

```bash
npm run check:production
npm run test:smoke
```

Do not launch publicly until both pass against the real production environment.
