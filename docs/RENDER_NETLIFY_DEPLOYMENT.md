# Render + Netlify Deployment

Use Netlify for the static frontend and Render for the Node/Express API.

## 1. Database

Create a remote MySQL database first. Import:

```bash
mysql -h DB_HOST -u DB_USER -p DB_NAME < database/schema.sql
```

## 2. Render API

Create a Render Web Service from this repository.

- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/healthz`

Set these Render environment variables:

```env
NODE_ENV=production
APP_URL=https://YOUR-NETLIFY-SITE.netlify.app
CORS_ORIGINS=https://YOUR-NETLIFY-SITE.netlify.app,https://YOUR-RENDER-SERVICE.onrender.com
JWT_SECRET=minimum-32-character-random-secret
DB_HOST=your-mysql-host
DB_PORT=3306
DB_USER=your-mysql-user
DB_PASSWORD=your-mysql-password
DB_NAME=lifelink_blood
PAYMENT_PROVIDER=cashfree
CASHFREE_ENV=production
CASHFREE_CLIENT_ID=your-live-cashfree-client-id
CASHFREE_CLIENT_SECRET=your-live-cashfree-client-secret
EMAIL_HOST=your-smtp-host
EMAIL_PORT=587
EMAIL_USER=your-smtp-user
EMAIL_PASS=your-smtp-password
EMAIL_FROM="LifeLink <no-reply@your-domain.com>"
MAP_PROVIDER=leaflet
MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
OTP_CHANNEL=email
```

For phone OTP, also set Twilio Verify variables.

## 3. Netlify Frontend

Copy `netlify.toml.example` to `netlify.toml`, then replace:

```text
https://YOUR-RENDER-SERVICE.onrender.com
```

with your real Render API URL.

Netlify settings:

- Base directory: project root
- Publish directory: `public`
- Build command: leave blank

## 4. Final Checks

Run locally before deploy:

```bash
npm test
npm run test:smoke
```

Run on Render shell or against Render environment:

```bash
npm run check:production
```

Public beta is acceptable only after `check:production` passes with real production env values.
