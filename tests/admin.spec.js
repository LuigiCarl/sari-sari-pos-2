const { test, expect } = require('@playwright/test');

test.describe('Admin Experience & Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('dashboard renders analytics cards, trend chart, and tables', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('.stat-label').first()).toContainText('Today');
    await expect(page.locator('.stat-profit-pill').first()).toBeVisible();
    await expect(page.locator('.stat-profit-pill').first()).toContainText('Tubo:');
    await expect(page.locator('#salesTrendChart')).toBeVisible();

    // Verify sections exist
    await expect(page.locator('h2', { hasText: 'Top Products' })).toBeVisible();
    await expect(page.locator('table', { hasText: 'Tubo' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Low Stock Alerts' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Recent Transactions' })).toBeVisible();
  });

  test('products management page displays products and category controls', async ({ page }) => {
    await page.click('nav a[href="/admin/products"]');
    await expect(page).toHaveURL(/\/admin\/products/);
    await expect(page.locator('h1')).toContainText('Products');

    // Check add product form
    await expect(page.locator('form[action="/admin/products"]')).toBeVisible();
    // Check add category form
    await expect(page.locator('form[action="/admin/categories"]')).toBeVisible();
    // Check products table
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('sales history displays receipts and allows viewing details', async ({ page }) => {
    await page.click('nav a[href="/admin/sales"]');
    await expect(page).toHaveURL(/\/admin\/sales/);
    await expect(page.locator('h1')).toContainText('Sales');

    // Check receipt links
    const firstReceipt = page.locator('table tbody tr td a').first();
    await expect(firstReceipt).toBeVisible();
    await firstReceipt.click();

    // Verify sale detail view
    await expect(page).toHaveURL(/\/admin\/sales\/\d+/);
    await expect(page.locator('h1')).toContainText('Receipt');
    await expect(page.locator('table')).toBeVisible();
  });

  test('inventory reports and users pages are accessible', async ({ page }) => {
    await page.click('nav a[href="/admin/inventory-reports"]');
    await expect(page).toHaveURL(/\/admin\/inventory-reports/);
    await expect(page.locator('h1')).toContainText('Inventory Reports');

    await page.click('nav a[href="/admin/users"]');
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.locator('h1')).toContainText('Users');
    await expect(page.locator('table')).toContainText('Juana Cruz');
  });
});

