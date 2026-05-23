import { test, expect, request } from '@playwright/test';
import { credentials, login, expectJsonOk } from './helpers.js';

test.describe('authentication and authorization', () => {
  test('register, verify OTP, login, me, logout storage path', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const stamp = Date.now();
    const register = await api.post('/api/auth/register', {
      data: {
        name: 'QA Runtime Donor',
        role: 'donor',
        email: `qa-runtime-${stamp}@lifelink.local`,
        mobile: `91${String(stamp).slice(-10)}`,
        password: 'Runtime@1234',
        blood_group: 'A+',
        city: 'Delhi',
        channel: 'email'
      }
    });
    const created = await expectJsonOk(register, 201);
    expect(created.devOtp).toMatch(/^\d{6}$/);

    const verified = await api.post('/api/auth/verify-otp', {
      data: { userId: created.userId, otp: created.devOtp, purpose: 'register', channel: 'email' }
    });
    const body = await expectJsonOk(verified);
    expect(body.token).toBeTruthy();
    expect(body.user.role).toBe('donor');

    const me = await api.get('/api/auth/me', { headers: { Authorization: `Bearer ${body.token}` } });
    const profile = await expectJsonOk(me);
    expect(profile.user.email).toContain('qa-runtime-');
  });

  test('rejects wrong password, duplicate email, wrong OTP and invalid token', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const badLogin = await api.post('/api/auth/login', { data: { identifier: credentials.donor[0], password: 'Wrong@12345' } });
    expect(badLogin.status()).toBe(401);

    const duplicate = await api.post('/api/auth/register', {
      data: { name: 'Duplicate', role: 'donor', email: credentials.donor[0], mobile: '919100009999', password: 'Duplicate@123', channel: 'email' }
    });
    expect(duplicate.status()).toBe(409);

    const wrongOtp = await api.post('/api/auth/verify-otp', { data: { userId: 1, otp: '000000', purpose: 'register', channel: 'email' } });
    expect(wrongOtp.status()).toBeGreaterThanOrEqual(400);

    const invalidToken = await api.get('/api/auth/me', { headers: { Authorization: 'Bearer not-a-valid-token' } });
    expect(invalidToken.status()).toBe(401);
  });

  test('forgot password and reset password use OTP and new credentials', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const forgot = await api.post('/api/auth/forgot-password', { data: { identifier: credentials.patient[0], channel: 'email' } });
    const resetOtp = await expectJsonOk(forgot);
    expect(resetOtp.devOtp).toMatch(/^\d{6}$/);

    const reset = await api.post('/api/auth/reset-password', {
      data: { identifier: credentials.patient[0], otp: resetOtp.devOtp, password: 'PatientReset@123', channel: 'email' }
    });
    await expectJsonOk(reset);

    const loginAfterReset = await api.post('/api/auth/login', { data: { identifier: credentials.patient[0], password: 'PatientReset@123', channel: 'email' } });
    await expectJsonOk(loginAfterReset);
  });

  test('enforces role-based API access', async ({ baseURL }) => {
    const donor = await login('donor', baseURL);
    const adminOnly = await donor.api.get('/api/admin/overview', { headers: { Authorization: `Bearer ${donor.token}` } });
    expect(adminOnly.status()).toBe(403);

    const admin = await login('admin', baseURL);
    const overview = await admin.api.get('/api/admin/overview', { headers: { Authorization: `Bearer ${admin.token}` } });
    expect(overview.ok()).toBeTruthy();
  });
});
