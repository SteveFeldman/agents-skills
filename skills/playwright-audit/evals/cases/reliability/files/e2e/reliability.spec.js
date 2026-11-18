import { test, expect } from '@playwright/test';

test.describe('Reliability violations', () => {
  test.skip('DIG-101: ticketed skip', async ({ page }) => {});
  test.fixme('bare fixme', async ({ page }) => {});

  test('hard wait', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('legacy waits', async ({ page }) => {
    await page.waitForSelector('.card');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('forced click', async ({ page }) => {
    await page.getByRole('button', { name: 'Buy' }).click({ force: true });
    await expect(page.getByText('Thanks')).toBeVisible();
  });

  test.only('focused', async ({ page }) => {
    console.log('leftover debug output');
    console.log('[[PROPERTY|id=TC-1]]');
    await expect(page.getByRole('heading')).toBeVisible();
  });
});
