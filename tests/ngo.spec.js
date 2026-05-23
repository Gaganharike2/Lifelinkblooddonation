import { test, expect } from '@playwright/test';
import { login, expectJsonOk } from './helpers.js';

test('NGO campaign workflow creates and lists campaigns', async ({ baseURL }) => {
  const ngo = await login('ngo', baseURL);
  const headers = { Authorization: `Bearer ${ngo.token}` };
  await expectJsonOk(await ngo.api.post('/api/dashboard/campaigns', {
    headers,
    data: { title: `QA Campaign ${Date.now()}`, city: 'Delhi', campaign_date: '2030-03-01', target_donors: 40 }
  }), 201);
  const campaigns = await expectJsonOk(await ngo.api.get('/api/dashboard/campaigns', { headers }));
  expect(Array.isArray(campaigns.campaigns)).toBeTruthy();
});
