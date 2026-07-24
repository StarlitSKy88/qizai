/**
 * apps/web/e2e/predict-stream.spec.ts (T38)
 *
 * Verifies the predict form submission path:
 *
 *   1. Visit /signup, register a new user (assumes API is up — see skip).
 *   2. Signup redirects to /predict.
 *   3. The form has id=predict-title; fill it and submit.
 *   4. The page issues POST /api/predict/stream — we wait for that
 *      request and confirm it fired, then mock the SSE response so the
 *      UI thinks the stream completed.
 *   5. After the complete event the app navigates to /report/<id>.
 *
 * Real SSE requires the API + LLM provider. We mock only the network
 * response (the route handler), not the in-page SSE consumer — that way
 * the full client-side code path (apiFetch → consumeSse → navigate) runs
 * against a synthetic stream, validating the wiring without needing a
 * real LLM.
 */
import { test, expect } from '@playwright/test';

const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@qizai.test`;

test.describe('predict-stream (T38)', () => {
  test('fill title + submit → fetch /api/predict/stream + navigate to /report/<id>', async ({
    page,
  }) => {
    const email = uniqueEmail();
    const password = 'correct-horse-battery-staple';

    // --- 1. Sign up via the real UI (gives us a JWT in localStorage). ---
    // If the API isn't up, the signup fetch never resolves — Playwright
    // will time out. Skip the test in that case so a unit-test CI pass
    // doesn't require the API.
    const signupFail = await page
      .goto('/signup')
      .then(async () => {
        // Probe: if the dev server replied 200 on /signup but the API
        // proxy isn't wired, /api/* requests will reject. We can't
        // tell from here with certainty, so we just attempt the path
        // and bail out via `test.skip` if /api responds with a
        // connection error.
        return false;
      });

    // Attempt to register. If /api/* 404s or the network fails, the
    // response status will be 0 (no response). Skip then.
    const signupResp = page.waitForResponse((r) =>
      r.url().includes('/api/auth/register'),
    );
    await page.getByLabel('邮箱').fill(email);
    await page.getByLabel('密码', { exact: true }).fill(password);
    await page.getByLabel('确认密码').fill(password);
    await page.getByRole('button', { name: '注册' }).click();
    const signedUp = await signupResp;
    test.skip(!signedUp.ok() && signedUp.status() === 0, 'requires API');

    // Should be on /predict now.
    await expect(page).toHaveURL(/\/predict$/);

    // --- 2. Mock the SSE endpoint so the form can complete. ---
    const fakeReportId = `e2e-report-${Date.now()}`;
    await page.route('**/api/predict/stream', async (route) => {
      // Synthesize a complete SSE block + close the stream.
      const body = `event: complete\ndata: ${JSON.stringify({
        report_id: fakeReportId,
      })}\n\n`;
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body,
      });
    });

    // --- 3. Fill the form and submit. ---
    await page.locator('#predict-title').fill('E2E 测试标题');
    const predictResp = page.waitForResponse((r) =>
      r.url().includes('/api/predict/stream'),
    );
    await page.getByRole('button').filter({ has: page.locator('svg') }).click();
    await predictResp;

    // --- 4. Expect navigation to /report/<id>. ---
    await expect(page).toHaveURL(new RegExp(`/report/${fakeReportId}`), {
      timeout: 10_000,
    });
  });
});
