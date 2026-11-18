import { test, expect } from '@playwright/test';

test.describe('Cart', () => {
  test('shows an error banner when the API fails', async ({ page }) => {
    await page.route('**/api/cart', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) })
    );
    await page.goto('/cart');
    await expect(page.getByRole('alert')).toContainText(/error/i);
  });

  test('adds an item and updates the count', async ({ page }) => {
    await page.goto('/products');
    const added = page.waitForResponse('**/api/cart/items');
    await page.getByRole('button', { name: 'Add to cart' }).first().click(); // first card is the featured item
    await added;
    await expect(page.getByTestId('cart-count')).toHaveText('1');
  });
});
