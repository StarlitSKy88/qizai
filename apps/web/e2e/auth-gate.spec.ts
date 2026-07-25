/**
 * apps/web/e2e/auth-gate.spec.ts (T39)
 *
 * Verifies the auth gate on /predict:
 *
 *   - With NO JWT in localStorage, submitting the predict form must
 *     bounce the user to /login (Predict.tsx checks
 *     `localStorage.getItem('qizai_jwt')` before issuing the request
 *     and redirects with `?redirect=/predict`).
 *
 * We do NOT need the API for this test — the gate is purely
 * client-side. Only the dev server is required.
 */
import { test, expect } from '@playwright/test';

test.describe('auth-gate (T39)', () => {
  test('no JWT → submitting predict form redirects to /login?redirect=/predict', async ({
    page,
  }) => {
    // Ensure no JWT before we start. (Context starts with a fresh
    // storage state, but be explicit so the test is robust against
    // `--global-arg` overrides.)
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('qizai_jwt'));

    await page.goto('/predict');

    // Fill the input — auth gate fires on form submit, not on first
    // visit. Predict.tsx deliberately lets logged-out users *see* the
    // marketing page; it only bounces them when they try to predict.
    await page.locator('#predict-title').fill('未登录也想预测');

    await page.getByRole('button').filter({ has: page.locator('svg') }).click();

    // Expect redirect to /login with the deep-link return param.
    // The router stores the return path unencoded in `?redirect=/predict`
    // (URL-decoded form); the regex matches both encoded and decoded.
    await expect(page).toHaveURL(/\/login\?redirect=(?:%2F|\/)predict/, {
      timeout: 5_000,
    });

    // Login page should be visible — sanity check the H1.
    await expect(
      page.getByRole('heading', { name: '登录', level: 1 }),
    ).toBeVisible();

    // No JWT was set along the way.
    const jwt = await page.evaluate(() => localStorage.getItem('qizai_jwt'));
    expect(jwt).toBeNull();
  });

  test('predictions page with no JWT surfaces login link in nav', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('qizai_jwt'));

    await page.goto('/predict');

    // Marketing nav must still offer a path to login for an
    // unauthenticated visitor.
    const loginLink = page.getByRole('link', { name: '登录' });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', '/login');
  });
});
