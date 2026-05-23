const nodemailer = require('nodemailer');
const twilio = require('twilio');

let emailTransporter;
let twilioClient;

function hasEmailConfig() {
  const user = String(process.env.EMAIL_USER || '');
  const pass = String(process.env.EMAIL_PASS || '');
  return Boolean(
    process.env.EMAIL_HOST &&
    user &&
    pass &&
    user !== 'your_email@example.com' &&
    pass !== 'your_email_app_password' &&
    process.env.EMAIL_DISABLED !== '1'
  );
}

function hasWhatsAppConfig() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_WHATSAPP_FROM || process.env.WHATSAPP_FROM));
}

function getEmailTransporter() {
  if (!emailTransporter) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: String(process.env.EMAIL_SECURE || '').toLowerCase() === 'true',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
  }
  return emailTransporter;
}

function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

function normalizeIndianPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (String(phone).trim().startsWith('+')) return String(phone).trim();
  return `+${digits}`;
}

function buildAlertMessage({ hospital, donor, message }) {
  return [
    `Dear ${donor.name},`,
    message,
    '',
    `Hospital: ${hospital?.name || 'LifeLink Hospital'}`,
    hospital?.city ? `City: ${hospital.city}` : '',
    hospital?.mobile ? `Contact: ${hospital.mobile}` : '',
    '',
    'Please respond from your LifeLink donor dashboard if you are available.'
  ].filter(Boolean).join('\n');
}

async function sendEmail({ hospital, donor, subject, message }) {
  if (!donor.email) return { channel: 'email', status: 'skipped', reason: 'Donor email not available' };
  if (!hasEmailConfig()) return { channel: 'email', status: 'not_configured', reason: 'SMTP credentials missing' };

  const text = buildAlertMessage({ hospital, donor, message });
  await getEmailTransporter().sendMail({
    from: process.env.EMAIL_FROM || 'LifeLink <no-reply@lifelink.local>',
    to: donor.email,
    subject,
    text,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827"><h2 style="color:#e11d48;margin:0 0 12px">LifeLink Blood Donation Alert</h2><p>${text.replace(/\n/g, '<br>')}</p></div>`
  });
  return { channel: 'email', status: 'sent', to: donor.email };
}

async function sendWhatsApp({ hospital, donor, message }) {
  const toPhone = normalizeIndianPhone(donor.mobile || donor.phone);
  if (!toPhone) return { channel: 'whatsapp', status: 'skipped', reason: 'Donor phone not available' };
  if (!hasWhatsAppConfig()) return { channel: 'whatsapp', status: 'not_configured', reason: 'Twilio WhatsApp credentials missing' };

  const from = process.env.TWILIO_WHATSAPP_FROM || process.env.WHATSAPP_FROM;
  const result = await getTwilioClient().messages.create({
    from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    to: `whatsapp:${toPhone}`,
    body: buildAlertMessage({ hospital, donor, message })
  });
  return { channel: 'whatsapp', status: 'sent', to: toPhone, provider_id: result.sid };
}

async function sendDonorAlert({ hospital, donor, subject, message, channels }) {
  const delivery = [];
  if (channels.includes('email')) {
    try {
      delivery.push(await sendEmail({ hospital, donor, subject, message }));
    } catch (error) {
      delivery.push({ channel: 'email', status: 'failed', reason: error.message });
    }
  }
  if (channels.includes('whatsapp')) {
    try {
      delivery.push(await sendWhatsApp({ hospital, donor, message }));
    } catch (error) {
      delivery.push({ channel: 'whatsapp', status: 'failed', reason: error.message });
    }
  }
  return delivery;
}

module.exports = { sendDonorAlert };
