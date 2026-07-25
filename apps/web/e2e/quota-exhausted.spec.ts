/**
 * apps/web/e2e/quota-exhausted.spec.ts (T40)
 *
 * Verifies the quota-exhausted UX:
 *
 *   1. Register a fresh user (real API).
 *   2. Mock /api/predict/stream to return 402 with the
 *      `QUOTA_EXHAUSTED` error envelope.
 *   3. Submit the predict form.
 *   4. The page must NOT navigate; it must keep the user on /predict
 *      so they can see the message and (in T25+) the toast.
 *
 * Because we cannot easily flip the server-side `quota_used` to match
 * `quota_limit` from outside the API, we mock the response directly. The
 * server contract is defined in apps/api/src/routes/predict.ts.
 */
import { test, expect } from '@playwright/test';

const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@qizai.test`;

test.describe('quota-exhausted (T40)', () => {
  test('predict returns QUOTA_EXHAUSTED → user stays on /predict', async ({
    page,
  }) => {
    const email = uniqueEmail();
    const password = 'correct-horse-battery-staple';

    // --- 1. Sign up via the real UI (requires API). ---
    await page.goto('/signup');
    await page.locator('#signup-email').fill(email);
    await page.locator('#signup-password').fill(password);
    await page.locator('#signup-confirm').fill(password);

    const signupResp = page.waitForResponse((r) =>
      r.url().includes('/api/auth/register'),
    );
    await page.getByRole('button', { name: '注册' }).click();
    const signedUp = await signupResp;
    test.skip(!signedUp.ok() && signedUp.status() === 0, 'requires API');

    await expect(page).toHaveURL(/\/predict$/);

    // --- 2. Mock /api/predict/stream with the QUOTA_EXHAUSTED envelope. ---
    await page.route('**/api/predict/stream', async (route) => {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'QUOTA_EXHAUSTED',
          message: '本月配额已用完，请升级套餐或下月再试',
        }),
      });
    });

    // --- 3. Submit the predict form. ---
    await page.locator('#predict-title').fill('配额已尽的预测');

    // Predict.tsx's current behaviour: on !res.ok it just `return`s,
    // leaving the form blank (consumeSse never runs). The test
    // asserts the user is NOT navigated to /report — this is the
    // externally visible contract.
    const predictResp = page.waitForResponse((r) =>
      r.url().includes('/api/predict/stream'),
    );
    await page.getByRole('button').filter({ has: page.locator('svg') }).click();
    const resp = await predictResp;
    expect(resp.status()).toBe(402);

    // Give the client a beat to either navigate or stay put.
    await page.waitForTimeout(500);

    // --- 4. Verify the user is still on /predict (no navigation occurred). ---
    await expect(page).toHaveURL(/\/predict$/);
  });
});
