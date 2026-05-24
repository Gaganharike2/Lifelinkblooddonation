document.addEventListener('DOMContentLoaded', () => {
  LifeLink.initIcons();

  const loginForm = document.querySelector('#loginForm');
  const registerForm = document.querySelector('#registerForm');
  const otpForm = document.querySelector('#otpForm');
  const forgotPasswordForm = document.querySelector('#forgotPasswordForm');
  const resetPasswordForm = document.querySelector('#resetPasswordForm');
  const forgotPanel = document.querySelector('#forgotPanel');
  const showForgotPassword = document.querySelector('#showForgotPassword');
  let pendingUserId = null;
  let pendingPurpose = 'register';
  let pendingChannel = 'email';
  let resetIdentifier = null;
  let resetChannel = 'email';

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(loginForm));
      try {
        const data = await LifeLink.api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (data.needsOtp) {
          pendingUserId = data.userId;
          pendingPurpose = 'login';
          pendingChannel = data.channel || 'email';
          document.querySelector('#otpPanel').classList.remove('d-none');
          LifeLink.toast(data.devOtp ? `Dev OTP: ${data.devOtp}` : data.message, 'info');
          return;
        }
        LifeLink.setSession(data.token, data.user);
        redirectByRole(data.user.role);
      } catch (error) {
        LifeLink.toast(error.message, 'error');
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(registerForm));
      if (payload.mobile && !payload.phone) payload.phone = payload.mobile;
      try {
        const data = await LifeLink.api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        pendingUserId = data.userId;
        pendingPurpose = 'register';
        pendingChannel = data.channel || 'email';
        document.querySelector('#otpPanel').classList.remove('d-none');
        LifeLink.toast(data.devOtp ? `Dev OTP: ${data.devOtp}` : data.message, 'info');
      } catch (error) {
        LifeLink.toast(error.message, 'error');
      }
    });
  }

  if (otpForm) {
    otpForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const otp = new FormData(otpForm).get('otp');
      try {
        const data = await LifeLink.api('/api/auth/verify-otp', {
          method: 'POST',
          body: JSON.stringify({ userId: pendingUserId, otp, purpose: pendingPurpose, channel: pendingChannel })
        });
        LifeLink.setSession(data.token, data.user);
        redirectByRole(data.user.role);
      } catch (error) {
        LifeLink.toast(error.message, 'error');
      }
    });
  }

  if (showForgotPassword && forgotPanel) {
    showForgotPassword.addEventListener('click', () => {
      showForgotPanel();
    });
  }

  if (forgotPanel && /forgot|reset/i.test(`${location.hash} ${location.search}`)) {
    showForgotPanel();
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(forgotPasswordForm));
      try {
        const data = await LifeLink.api('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        resetIdentifier = payload.identifier;
        resetChannel = data.channel || 'email';
