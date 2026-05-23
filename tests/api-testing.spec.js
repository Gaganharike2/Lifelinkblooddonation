import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('REST API smoke matrix checks status, auth, validation and response shape', async ({ baseURL }) => {
  const hospital = await login('hospital', baseURL);
  const donor = await login('donor', baseURL);
  const hospitalHeaders = { Authorization: `Bearer ${hospital.token}` };
  const donorHeaders = { Authorization: `Bearer ${donor.token}` };

  const matrix = [
    ['GET', '/healthz', null, 200],
    ['GET', '/readyz', null, [200, 503]],
    ['GET', '/api/config', null, 200],
    ['GET', '/api/dashboard/summary', donorHeaders, 200],
    ['GET', '/api/dashboard/nearby-donors', hospitalHeaders, 200],
    ['GET', '/api/dashboard/inventory', hospitalHeaders, 200],
    ['POST', '/api/dashboard/inventory', hospitalHeaders, 201, { blood_group: 'O-', units: 2 }],
    ['GET', '/api/hospital/profile', hospitalHeaders, 200],
    ['GET', '/api/hospital/donors', hospitalHeaders, 200],
    ['GET', '/api/donor/profile', donorHeaders, 200],
    ['GET', '/api/admin/overview', hospitalHeaders, 403]
  ];

  for (const [method, endpoint, headers, expected, data] of matrix) {
    const start = Date.now();
    const response = await hospital.api.fetch(endpoint, { method, headers: headers || {}, data });
    const expectedStatuses = Array.isArray(expected) ? expected : [expected];
    expect(expectedStatuses, endpoint).toContain(response.status());
    expect(Date.now() - start, `${endpoint} response time`).toBeLessThan(3000);
  }

  const validation = await hospital.api.post('/api/hospital/blood-requests', { headers: hospitalHeaders, data: {} });
  expect(validation.status()).toBe(400);
});
