import { test, expect } from '@playwright/test';
import { login, expectJsonOk } from './helpers.js';

test('patient can create and track blood requests', async ({ baseURL }) => {
  const patient = await login('patient', baseURL);
  const headers = { Authorization: `Bearer ${patient.token}` };
  await expectJsonOk(await patient.api.post('/api/dashboard/requests', {
    headers,
    data: { patient_name: 'LifeLink QA Patient', blood_group: 'B+', units_needed: 1, urgency: 'urgent', hospital_name: 'QA Hospital', city: 'Delhi' }
  }), 201);
  const requests = await expectJsonOk(await patient.api.get('/api/dashboard/requests', { headers }));
  expect(Array.isArray(requests.requests)).toBeTruthy();
});
