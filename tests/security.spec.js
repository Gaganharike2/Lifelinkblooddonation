import { test, expect, request } from '@playwright/test';
import { login } from './helpers.js';

test('basic penetration checks: SQL injection, XSS reflection, JWT bypass and unauthenticated API abuse', async ({ baseURL }) => {
  const api = await request.newContext({ baseURL });
  const injection = await api.post('/api/auth/login', { data: { identifier: "' OR '1'='1", password: "' OR '1'='1" } });
  expect(injection.status()).toBe(401);

  const unauthenticated = await api.get('/api/dashboard/summary');
  expect(unauthenticated.status()).toBe(401);

  const forged = await api.get('/api/admin/overview', { headers: { Authorization: 'Bearer forged.jwt.token' } });
  expect(forged.status()).toBe(401);

  const hospital = await login('hospital', baseURL);
  const xss = '<img src=x onerror=alert(1)>';
  const created = await hospital.api.post('/api/hospital/support', {
    headers: { Authorization: `Bearer ${hospital.token}` },
    data: { subject: xss, message: xss }
  });
  expect(created.status()).toBe(201);
  const list = await hospital.api.get('/api/hospital/support', { headers: { Authorization: `Bearer ${hospital.token}` } });
  const body = await list.json();
  expect(JSON.stringify(body)).not.toContain(xss);
});
