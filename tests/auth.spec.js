const { test, expect } = require('@playwright/test');

test.describe('Authentication & Access Control', () => {
  test('unauthenticated users cannot access /admin/dashboard', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h2')).toContainText('Welcome back!');
  });

  test('unauthenticated users cannot access /pos', async ({ page }) => {
    await page.goto('/pos');
    await expect(page).toHaveURL(/\/login/);
  });

  test('invalid credentials show error flash', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'wronguser');
    await page.fill('input[name="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    await expect(page.locator('.alert-error')).toBeVisible();
    await expect(page.locator('.alert-error')).toContainText('Invalid username or password');
  });

  test('cashier can login, redirected to /pos, and blocked from /admin', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'cashier1');
    await page.fill('input[name="password"]', 'cashier123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/pos/);
    await expect(page.locator('.user-badge')).toContainText('Juana Cruz');
    await expect(page.locator('.user-badge')).toContainText('Sales Rep');

    // Try accessing admin dashboard as cashier
    await page.goto('/admin/dashboard');
    await expect(page.locator('h1')).toContainText('Forbidden');
  });

  test('admin can login, access dashboard, and logout', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.locator('.user-badge')).toContainText('Store Owner');
    await expect(page.locator('.user-badge')).toContainText('Admin');

    // Test logout
    await page.click('.logout-btn');
    await expect(page).toHaveURL(/\/login/);
  });
});

