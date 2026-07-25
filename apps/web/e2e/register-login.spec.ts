/**
 * apps/web/e2e/register-login.spec.ts (T37)
 *
 * Verifies the signup round-trip works end-to-end:
 *
 *   1. Visit /signup.
 *   2. Fill in email + password + confirm password.
 *   3. Submit.
 *   4. Expect to land on /predict (the post-signup redirect).
 *   5. JWT must be persisted to localStorage so the next request is
 *      authenticated.
 *
 * This test does NOT mock the API. To run it without a real backend, skip
 * with `test.skip(..., 'requires real API')` — see the Playwright config
 * note about offline boxes.
 */
import { test, expect } from '@playwright/test';

const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@qizai.test`;

test.describe('register-login (T37)', () => {
  test('signup with new email → redirected to /predict + JWT stored', async ({
    page,
  }) => {
    const email = uniqueEmail();
    const password = 'correct-horse-battery-staple';

    await page.goto('/signup');

    // Signup.tsx uses <label for="signup-X"> + <input id="signup-X"> as
    // sibling elements rather than the label wrapping the input. That's
    // valid HTML but Playwright's `getByLabel` prefers the wrapping form;
    // we target inputs by their stable id instead.
    await page.locator('#signup-email').fill(email);
    await page.locator('#signup-password').fill(password);
    await page.locator('#signup-confirm').fill(password);

    // Capture the API response so we can give a clearer failure if the
    // back-end rejects (e.g. EMAIL_TAKEN if a previous run leaked the
    // email into a long-lived dev DB).
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/auth/register'),
    );
    await page.getByRole('button', { name: '注册' }).click();
    const response = await responsePromise;

    // Skip (rather than fail) if no API is wired up — Playwright tests
    // run against a fresh `pnpm dev` which has no API process by
    // default. The test below verifies the *UI* routing path, which is
    // what T37 actually checks.
    test.skip(
      !response.ok() && response.status() === 0,
      'requires running API at /api/*',
    );

    // After successful signup, Signup.tsx navigates to /predict.
    await expect(page).toHaveURL(/\/predict$/, { timeout: 10_000 });
    await expect(page).toHaveTitle(/qizai/i);

    // JWT must be persisted to the canonical localStorage key.
    const jwt = await page.evaluate(() => localStorage.getItem('qizai_jwt'));
    expect(jwt, 'JWT should be set in localStorage after signup').toBeTruthy();
  });

  test('signup with mismatched passwords → inline error, no navigation', async ({
    page,
  }) => {
    await page.goto('/signup');

    await page.locator('#signup-email').fill(uniqueEmail());
    await page.locator('#signup-password').fill('hunter22');
    await page.locator('#signup-confirm').fill('different22');

    await page.getByRole('button', { name: '注册' }).click();

    // Inline alert — Signup.tsx renders the message in role="alert".
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('密码');
    await expect(page).toHaveURL(/\/signup$/);
  });
});
