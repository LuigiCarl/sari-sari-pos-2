const { test, expect } = require('@playwright/test');

test.describe('Cashier POS Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'cashier1');
    await page.fill('input[name="password"]', 'cashier123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/pos/);
  });

  test('pos screen renders products, category pills, quick cash, and thermal receipt', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Point of Sale');
    await expect(page.locator('#productSearch')).toBeVisible();

    // Verify category pills are visible
    const pills = page.locator('.category-pill');
    await expect(pills.first()).toBeVisible();
    await expect(pills.first()).toContainText('All');

    // Click a category pill (e.g. second pill if available)
    if (await pills.count() > 1) {
      await pills.nth(1).click();
      await expect(pills.nth(1)).toHaveClass(/active/);
      // Return to All
      await pills.first().click();
    }

    const productTiles = page.locator('.product-tile');
    await expect(productTiles.first()).toBeVisible();

    // Click first product tile
    await productTiles.first().click();

    // Verify cart table row added
    const cartRow = page.locator('#cartBody tr').first();
    await expect(cartRow).toBeVisible();

    // Verify total is greater than 0
    const totalText = await page.locator('#cartTotal').innerText();
    expect(totalText).not.toBe('₱0.00');

    // Test Quick Cash button (₱500)
    const quickCash500 = page.locator('button.quick-cash-btn[data-cash="500"]');
    await expect(quickCash500).toBeVisible();
    await quickCash500.click();

    // Verify amount paid input was updated
    await expect(page.locator('#amountPaid')).toHaveValue('500.00');

    // Verify change is calculated
    const changeText = await page.locator('#changeAmount').innerText();
    expect(changeText).toContain('₱');

    // Verify checkout button is enabled
    const checkoutBtn = page.locator('#checkoutBtn');
    await expect(checkoutBtn).toBeEnabled();

    // Complete transaction
    await checkoutBtn.click();

    // Verify redirect to receipt page
    await expect(page).toHaveURL(/\/pos\/receipt\/\d+/);
    await expect(page.locator('.receipt-paper')).toBeVisible();
    await expect(page.locator('.receipt-store-name')).toContainText('SARI-SARI STORE');
    await expect(page.locator('.receipt-table')).toBeVisible();
    await expect(page.locator('a.btn[href="/pos"]')).toBeVisible();
  });

  test('inventory adjustment screen allows submitting reports', async ({ page }) => {
    await page.click('nav a[href="/pos/inventory"]');
    await expect(page).toHaveURL(/\/pos\/inventory/);
    await expect(page.locator('h1')).toContainText('Inventory');
    await expect(page.locator('table').first()).toBeVisible();
    await expect(page.locator('form[action="/pos/inventory/report"]')).toBeVisible();
  });
});
