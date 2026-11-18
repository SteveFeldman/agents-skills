import { test, expect } from '@playwright/test';

test.describe('Locator and assertion violations', () => {
  test('xpath and class', async ({ page }) => {
    await page.locator('//div[@id="x"]/button').click();
    await page.locator('.btn-primary.submit-order').click();
    await expect(page.getByText('Done')).toBeVisible();
  });

  test('one-shot reads', async ({ page }) => {
    const text = await page.getByTestId('status').textContent();
    expect(text).toBe('Order received');
    const visible = await page.getByRole('alert').isVisible().catch(() => false);
    expect(visible).toBe(true);
  });

  test('no assertion at all', async ({ page }) => {
    await page.getByRole('button', { name: 'Save' }).click();
  });

  test('positional without reason', async ({ page }) => {
    await page.getByRole('listitem').first().click();
    await expect(page.getByRole('heading')).toBeVisible();
  });
});
