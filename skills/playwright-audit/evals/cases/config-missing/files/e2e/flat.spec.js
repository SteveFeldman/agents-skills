import { test, expect } from '@playwright/test';

test('flat test, hardcoded URL and credential', async ({ page }) => {
  const password = 'hunter2-secret';
  await page.goto('https://staging.example.com/login');
  await page.getByLabel('Password').fill(password);
  await expect(page.getByRole('heading')).toBeVisible();
});
