import { test, expect } from '@playwright/test';

test.describe('Profile-aware audit', () => {
  test('project test-id attribute is accepted', async ({ page }) => {
    await page.locator('[data-qa="submit"]').click();
    await expect(page.locator('[data-qa="result"]')).toHaveText('OK');
  });

  // pw-audit-ignore PW201 scan-only test, outcome is verified by an external report
  test('scan-only by design', async ({ page }) => {
    await page.goto('/');
  });
});
