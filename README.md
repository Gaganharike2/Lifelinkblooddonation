# LifeLink

LifeLink is a modern full-stack blood donation SaaS platform. It supports donors, patients, hospitals, blood banks, camp organizers, NGOs, admins and super admins using HTML, CSS, Bootstrap 5, Vanilla JavaScript, AJAX, Node.js, Express, Cashfree/Razorpay payment integration, global map integration points and MySQL.

## Features

- Main public website with modern LifeLink branding
- Login, registration, email/mobile OTP verification flow
- Donor dashboard with health tracker, rewards points, referrals, appointments and nearby requests
- Hospital dashboard with blood inventory, donor search, requests and emergency alerts
- Blood bank dashboard with inventory, expiry risk and AI shortage prediction
- Patient dashboard with emergency blood request broadcasting and tracking
- Camp organizer dashboard with camp creation, donor leaderboard and subscription support
- NGO dashboard with campaigns, donor discovery, appointments and subscriptions
- Admin panel for users, blood requests, subscriptions, rewards and system stats
- Cashfree-first Basic, Pro and Enterprise subscription/order creation with payment verification endpoints; Razorpay remains available as an optional backup provider
- Leaflet/OpenStreetMap global maps by default, with optional Google Maps provider support
- Nexa Assistant AI endpoints for eligibility guidance, priority detection, blood demand prediction and shortage recommendations
- Real-time notification and chat foundations using Socket.IO
- MySQL schema with seed data

## Setup

1. Copy `.env.example` to `.env` and add your local database/API keys.
   Use `DB_USER=root` and set `DB_PASSWORD` to your MySQL/XAMPP root password. If your root account has no password, leave `DB_PASSWORD=` blank.
2. Import `database/schema.sql` into MySQL.
3. Run `npm install`.
4. Run `npm run dev` and open `http://localhost:4000`.

If you see `Access denied for user 'root'@'localhost' (using password: NO)`, the server is not reading a MySQL password. Create `.env` from `.env.example`, set `DB_PASSWORD`, then restart the Node server.

## Local Seed Access

- Admin: `admin@lifelink.local` / `Admin@12345`
- Donor: `donor@lifelink.local` / `Donor@12345`
- Hospital: `hospital@lifelink.local` / `Hospital@12345`
- NGO: `ngo@lifelink.local` / `Ngo@12345`
- Blood Bank: `bloodbank@lifelink.local` / `Donor@12345`
- Patient: `patient@lifelink.local` / `Donor@12345`
- Camp Organizer: `camp@lifelink.local` / `Donor@12345`

Add Cashfree, SMTP, Twilio and map provider credentials in `.env` when ready.

## API Map

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/verify-otp`
- `GET /api/dashboard/summary`, `/nearby-donors`, `/requests`, `/inventory`, `/appointments`, `/campaigns`
- `GET/POST/PATCH/DELETE /api/hospital/*` for hospital profile, donor search, donor requests, blood requests, emergency broadcasts, inventory, appointments, reports, AI prediction, subscriptions, payments, invoices, staff, branches, settings, support and chat.
- `GET /api/hospital/subscription`, `GET /api/subscription/plans`, `POST /api/subscription/create`, `POST /api/subscription/upgrade`, `POST /api/subscription/cancel`, `POST /api/payment/verify`, `POST /api/payment/webhook`, `GET /api/payment/history`, `GET /api/invoice/download/:id`.
- `POST /api/payments/create-order`, `POST /api/payments/verify`
- `GET /api/company/architecture`, `/plans`, `/control-center`, `/emergency-requests`, `/blood-banks/inventory-risk`, `/leaderboard`, `/ai/predictions`
- `POST /api/company/emergency-requests`, `/blood-camps`

## Hospital Module Pages

The hospital workspace includes separate responsive pages for profile, donor search, donor requests, blood requests, emergency requests, inventory, rare blood, availability, appointments, donation records, nearby centers, smart matching, live tracking, notifications, chat, reports, AI prediction, subscription, payment history, invoices, staff, branches, settings, support and logout.

Run `node tools/generate-hospital-pages.js` if you need to regenerate the shared hospital HTML/CSS/JS shell. The `/api/hospital` route creates missing hospital support tables automatically for existing databases; fresh installs also include those tables in `database/schema.sql`.

## Deployment Notes

- Use a managed MySQL database and import `database/schema.sql`.
- Set strong `JWT_SECRET`, SMTP, Cashfree live keys, Twilio credentials and map provider credentials in environment variables.
- Run behind HTTPS with a process manager such as PM2 and a reverse proxy such as Nginx.
- Keep Cashfree/Razorpay webhooks, SMS provider credentials, Google/Facebook OAuth credentials and CAPTCHA keys in environment variables only.

## Production Launch Gate

Run this before any public deployment:

```bash
npm run check:production
npm run test:smoke
```

Do not launch publicly until both commands pass in the real production environment. Use `.env.production.example` as the production configuration template and follow `docs/PRODUCTION_LAUNCH_CHECKLIST.md`. Production must use HTTPS, a strong random JWT secret, live Cashfree or Razorpay credentials, verified webhooks, real SMTP credentials for OTP delivery, production map credentials and real WhatsApp/SMS credentials if alerts are enabled.

The server now refuses unsafe production startup when required production settings are missing, weak, localhost-only or still using test payment settings.

## Healthcare Public Launch Requirements

LifeLink is software; public healthcare launch also needs operational and legal readiness:

- legal review for privacy policy, terms, consent, grievance workflow and data processing obligations
- hospital and blood bank onboarding verification
- clinical safety review for blood request, donor eligibility and emergency workflows
- encrypted database backups and disaster recovery
- HTTPS hosting, reverse proxy, monitoring, logs and alerts
- documented incident response process
- restricted admin/staff access
- payment webhook monitoring and duplicate payment prevention
- real email/SMS/WhatsApp provider accounts
- production support process for urgent healthcare incidents

## Twilio Phone OTP

For global phone OTP, create a Twilio Verify service and add these values to production environment variables:

```env
OTP_CHANNEL=phone
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid
TWILIO_VERIFY_CHANNEL=sms
```

Registration, login OTP and resend OTP support `otp_channel=phone` or the global `OTP_CHANNEL=phone` setting. In production, phone OTP fails safely if Twilio Verify is not configured.

## Future Upgrades

- Add production Razorpay webhooks, Twilio SMS delivery, Google/Facebook OAuth, CAPTCHA verification and Maps JavaScript live tracking.
- Add Sequelize/Knex migrations, automated tests, audit exports, invoice PDF generation and cloud backup jobs.
- Replace rule-based Nexa Assistant with an approved AI model and hospital-specific forecasting datasets.
