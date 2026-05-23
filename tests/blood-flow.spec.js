import { test, expect } from '@playwright/test';
import { login, expectJsonOk } from './helpers.js';

test('hospital request to donor acceptance updates database-backed state', async ({ baseURL }) => {
  const hospital = await login('hospital', baseURL);
  const donor = await login('donor', baseURL);
  const bank = await login('blood_bank', baseURL);

  const inventoryBefore = await bank.api.post('/api/dashboard/inventory', {
    headers: { Authorization: `Bearer ${bank.token}` },
    data: { blood_group: 'O+', units: 4, expires_on: '2030-01-01' }
  });
  expect(inventoryBefore.status()).toBe(201);

  const request = await hospital.api.post('/api/hospital/blood-requests', {
    headers: { Authorization: `Bearer ${hospital.token}` },
    data: { patient_name: 'QA Patient', blood_group: 'O+', units_needed: 2, urgency: 'critical', city: 'Delhi' }
  });
  const createdRequest = await expectJsonOk(request, 201);
  expect(createdRequest.id).toBeTruthy();

  const donorRequest = await hospital.api.post('/api/hospital/donor-requests', {
    headers: { Authorization: `Bearer ${hospital.token}` },
    data: { donor_id: donor.user.id, blood_group: 'O+', message: 'QA urgent flow request' }
  });
  const createdDonorRequest = await expectJsonOk(donorRequest, 201);

  const accept = await donor.api.patch(`/api/donor/requests/${createdDonorRequest.id}`, {
    headers: { Authorization: `Bearer ${donor.token}` },
    data: { status: 'accepted' }
  });
  await expectJsonOk(accept);

  const donorRequests = await donor.api.get('/api/donor/requests', { headers: { Authorization: `Bearer ${donor.token}` } });
  const donorRows = await expectJsonOk(donorRequests);
  expect(donorRows.rows.some((row) => row.id === createdDonorRequest.id && row.status === 'accepted')).toBeTruthy();

  const closeRequest = await hospital.api.patch(`/api/hospital/blood-requests/${createdRequest.id}`, {
    headers: { Authorization: `Bearer ${hospital.token}` },
    data: { status: 'fulfilled' }
  });
  await expectJsonOk(closeRequest);
});

test('request status endpoints reject invalid owners and support cancellation', async ({ baseURL }) => {
  const hospital = await login('hospital', baseURL);
  const donor = await login('donor', baseURL);
  const create = await hospital.api.post('/api/hospital/blood-requests', {
    headers: { Authorization: `Bearer ${hospital.token}` },
    data: { patient_name: 'Cancel QA', blood_group: 'B+', units_needed: 1, urgency: 'normal' }
  });
  const body = await expectJsonOk(create, 201);
  const unauthorized = await donor.api.patch(`/api/hospital/blood-requests/${body.id}`, {
    headers: { Authorization: `Bearer ${donor.token}` },
    data: { status: 'cancelled' }
  });
  expect(unauthorized.status()).toBe(403);
});
