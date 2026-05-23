import { test, expect } from '@playwright/test';
import { login, expectJsonOk } from './helpers.js';

test('donor profile, availability, health and history endpoints work', async ({ baseURL }) => {
  const donor = await login('donor', baseURL);
  const headers = { Authorization: `Bearer ${donor.token}` };
  await expectJsonOk(await donor.api.put('/api/donor/profile', {
    headers,
    data: { availability: 'available', hemoglobin: 14.1, weight_kg: 73, date_of_birth: '1995-01-01' }
  }));
  const health = await expectJsonOk(await donor.api.get('/api/donor/health', { headers }));
  expect(['eligible', 'review', 'not_eligible']).toContain(health.eligibility);
  await expectJsonOk(await donor.api.post('/api/donor/health', {
    headers,
    data: { hemoglobin: 11.5, weight_kg: 60, blood_pressure: '120/80', availability: 'available' }
  }), 201);
  await expectJsonOk(await donor.api.get('/api/donor/donation-history', { headers }));
});
