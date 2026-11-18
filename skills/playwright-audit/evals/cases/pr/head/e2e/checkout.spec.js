import { test, expect } from '@playwright/test';

test.describe('Checkout', () => {
  test('legacy test with an old hard wait', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForTimeout(100);
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('new test added by the pull request', async ({ page }) => {
    await page.locator('//button[1]').click();
    await page.getByRole('button', { name: 'Checkout' })
      .first()
      .click();
    await page.waitForTimeout(500);
  });
});
