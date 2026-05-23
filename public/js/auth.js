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
  let resetIdentifier = null;

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
          body: JSON.stringify({ userId: pendingUserId, otp, purpose: pendingPurpose })
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
        resetPasswordForm?.classList.remove('d-none');
        LifeLink.toast(data.devOtp ? `Dev OTP: ${data.devOtp}` : data.message, 'info');
      } catch (error) {
        LifeLink.toast(error.message, 'error');
      }
    });
  }

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(resetPasswordForm));
      if (!resetIdentifier) return LifeLink.toast('Request a reset OTP first.', 'error');
      if (payload.password !== payload.confirm_password) return LifeLink.toast('Passwords do not match', 'error');
      try {
        await LifeLink.api('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ identifier: resetIdentifier, otp: payload.otp, password: payload.password })
        });
        resetPasswordForm.reset();
        forgotPasswordForm.reset();
        resetPasswordForm.classList.add('d-none');
        forgotPanel.classList.add('d-none');
        LifeLink.toast('Password updated. You can login with your new password.', 'success');
      } catch (error) {
        LifeLink.toast(error.message, 'error');
      }
    });
  }
});

function showForgotPanel() {
  const forgotPanel = document.querySelector('#forgotPanel');
  if (!forgotPanel) return;
  forgotPanel.classList.remove('d-none');
  forgotPanel.querySelector('input')?.focus();
  if (!location.hash) history.replaceState(null, '', `${location.pathname}#forgot-password`);
}

function redirectByRole(role) {
  const map = {
    donor: '/pages/donor/donor-dashboard.html',
    patient: '/pages/patient/patient-dashboard.html',
    hospital: '/pages/hospital/hospital-dashboard.html',
    blood_bank: '/pages/blood-bank/blood-bank-dashboard.html',
    camp_organizer: '/pages/camp-organizer/camp-organizer-dashboard.html',
    ngo: '/pages/ngo/ngo-dashboard.html',
    volunteer: '/pages/volunteer/volunteer-dashboard.html',
    admin: '/pages/admin/admin-dashboard.html',
    super_admin: '/pages/admin/admin-dashboard.html'
  };
  location.href = map[role] || '/';
}
