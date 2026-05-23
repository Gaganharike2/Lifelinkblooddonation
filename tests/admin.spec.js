import { test, expect } from '@playwright/test';
import { login, expectJsonOk } from './helpers.js';

test('admin can view analytics, users, reports and approval lists', async ({ baseURL }) => {
  const admin = await login('admin', baseURL);
  const headers = { Authorization: `Bearer ${admin.token}` };
  for (const endpoint of ['/api/admin/overview', '/api/admin/users', '/api/admin/analytics', '/api/admin/reports', '/api/admin/blood-requests', '/api/admin/blood-inventory']) {
    const response = await admin.api.get(endpoint, { headers });
    expect(response.ok(), `${endpoint} should be available`).toBeTruthy();
  }
  const users = await expectJsonOk(await admin.api.get('/api/admin/users/role/hospital', { headers }));
  expect(Array.isArray(users.rows)).toBeTruthy();
});
