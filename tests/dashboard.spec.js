import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

const dashboards = [
  ['admin', '/pages/admin/admin-dashboard.html', 'Admin Dashboard', '/api/admin/overview'],
  ['donor', '/pages/donor/donor-dashboard.html', 'Donor', '/api/donor/dashboard'],
  ['hospital', '/pages/hospital/hospital-dashboard.html', 'Hospital', '/api/dashboard/hospital'],
  ['blood_bank', '/pages/blood-bank/blood-bank-dashboard.html', 'Blood Bank', '/api/dashboard/summary'],
  ['ngo', '/pages/ngo/ngo-dashboard.html', 'NGO', '/api/dashboard/summary'],
  ['patient', '/pages/patient/patient-dashboard.html', 'Patient', '/api/dashboard/summary']
];

for (const [role, path, title, apiPath] of dashboards) {
  test(`${role} dashboard page and data endpoint load`, async ({ request, baseURL }) => {
    const session = await login(role, baseURL);
    const page = await request.get(path);
    expect(page.status()).toBe(200);
    expect(await page.text()).toContain(title);
    const api = await session.api.get(apiPath, { headers: { Authorization: `Bearer ${session.token}` } });
    expect(api.ok(), `${apiPath} should return dashboard data`).toBeTruthy();
  });
}

test('protected dashboard APIs reject unauthenticated access', async ({ request }) => {
  const response = await request.get('/api/dashboard/hospital');
  expect(response.status()).toBe(401);
});
