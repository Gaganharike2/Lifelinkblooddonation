import { test, expect } from '@playwright/test';
import { login, expectJsonOk } from './helpers.js';

test('hospital CRUD workflows work for profile, inventory, emergency and support', async ({ baseURL }) => {
  const hospital = await login('hospital', baseURL);
  const headers = { Authorization: `Bearer ${hospital.token}` };
  await expectJsonOk(await hospital.api.put('/api/hospital/profile', {
    headers,
    data: { hospital_name: 'LifeLink QA Hospital', license_number: 'QA-LIC-100', city: 'Delhi', full_address: 'QA Address' }
  }));
  await expectJsonOk(await hospital.api.post('/api/hospital/inventory', { headers, data: { blood_group: 'A+', units: 6, expires_on: '2030-01-01' } }), 201);
  await expectJsonOk(await hospital.api.post('/api/hospital/emergency-requests', {
    headers,
    data: { patient_name: 'Emergency QA', blood_group: 'A+', units_needed: 2, emergency_level: 'critical', city: 'Delhi' }
  }), 201);
  await expectJsonOk(await hospital.api.post('/api/hospital/support', { headers, data: { subject: 'QA support', message: 'Support message from automation.' } }), 201);

  const invalid = await hospital.api.post('/api/hospital/blood-requests', { headers, data: { blood_group: 'A+' } });
  expect(invalid.status()).toBe(400);
});
