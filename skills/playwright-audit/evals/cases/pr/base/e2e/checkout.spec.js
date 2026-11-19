import { test, expect } from '@playwright/test';

test.describe('Checkout', () => {
  test('legacy test with an old hard wait', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForTimeout(100);
    await expect(page.getByRole('heading')).toBeVisible();
  });
});
