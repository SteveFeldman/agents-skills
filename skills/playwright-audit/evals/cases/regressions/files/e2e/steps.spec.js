import { test, expect } from '@playwright/test';

const cards = [{ cardType: 'VISA', token: '4012000033330026' }];

test.describe('conditional skip inside a test', () => {
  test('uses steps and a runtime skip', async ({ page }) => {
    test.skip(process.env.SKIP === '1', 'not applicable');
    await test.step('open the page', async () => {
      await page.goto('/');
    });
    await test.step('check the heading', async () => {
      await expect(page.getByRole('heading')).toBeVisible();
    });
  });

  test('second test also has an assertion', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    expect(cards).toHaveLength(1);
  });
});

test.describe('optional-element probes', () => {
  test('branch probe is low severity, probe right after an action is not', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading')).toBeVisible();
    if (await page.getByRole('button', { name: 'Accept' }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Accept' }).click();
    }
    await page.getByRole('link', { name: 'Next' }).click();
    if (await page.getByRole('dialog').isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
    }
  });
});
