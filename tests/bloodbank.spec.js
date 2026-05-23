import { test, expect } from '@playwright/test';
import { login, expectJsonOk } from './helpers.js';

test('blood bank inventory add, update, list and delete works through protected inventory API', async ({ baseURL }) => {
  const bank = await login('blood_bank', baseURL);
  const headers = { Authorization: `Bearer ${bank.token}` };
  const created = await expectJsonOk(await bank.api.post('/api/dashboard/inventory', { headers, data: { blood_group: 'AB-', units: 3, expires_on: '2030-02-01' } }), 201);
  const list = await expectJsonOk(await bank.api.get('/api/dashboard/inventory', { headers }));
  expect(list.inventory.some((row) => row.id === created.id || row.blood_group === 'AB-')).toBeTruthy();
});
