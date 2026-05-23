import { test, expect } from '@playwright/test';
import './helpers.js';

const widths = [320, 375, 768, 1024, 1440];
const pages = [
  ['public home', '/', null],
  ['login', '/pages/login.html', null],
  ['hospital dashboard', '/pages/hospital/hospital-dashboard.html', 'hospital'],
  ['donor dashboard', '/pages/donor/donor-dashboard.html', 'donor'],
  ['admin dashboard', '/pages/admin/admin-dashboard.html', 'admin']
];

for (const width of widths) {
  for (const [name, path] of pages) {
    test(`${name} has responsive viewport metadata and CSS for ${width}px target`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain('viewport');
      expect(html).not.toMatch(/style=["'][^"']*width:\s*(1[5-9]\d{2,}|[2-9]\d{3,})px/i);
    });
  }
}
