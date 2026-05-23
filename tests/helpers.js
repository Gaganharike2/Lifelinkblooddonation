import { expect, request } from '@playwright/test';
import '../tools/start-test-server.js';

export const credentials = {
  admin: ['qa-admin@lifelink.local', 'AdminTest@123'],
  donor: ['qa-donor@lifelink.local', 'DonorTest@123'],
  hospital: ['qa-hospital@lifelink.local', 'HospitalTest@123'],
  blood_bank: ['qa-bloodbank@lifelink.local', 'BankTest@123'],
  ngo: ['qa-ngo@lifelink.local', 'NgoTest@123'],
  patient: ['qa-patient@lifelink.local', 'PatientTest@123']
};

export async function login(role, baseURL) {
  const api = await request.newContext({ baseURL });
  const [identifier, password] = credentials[role];
  const response = await api.post('/api/auth/login', { data: { identifier, password, channel: 'email' } });
  expect(response.ok(), `${role} login should succeed`).toBeTruthy();
  const body = await response.json();
  expect(body.token).toBeTruthy();
  return { api, token: body.token, user: body.user };
}

export async function authHeaders(role, baseURL) {
  const session = await login(role, baseURL);
  return { Authorization: `Bearer ${session.token}` };
}

export async function expectJsonOk(response, status = 200) {
  expect(response.status()).toBe(status);
  const contentType = response.headers()['content-type'] || '';
  expect(contentType).toContain('application/json');
  return response.json();
}

export async function setBrowserSession(page, role, baseURL) {
  const session = await login(role, baseURL);
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('lifelink_token', token);
    localStorage.setItem('lifelink_user', JSON.stringify(user));
  }, { token: session.token, user: session.user });
  return session;
}
