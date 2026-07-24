/**
 * apps/web/e2e/report-share.spec.ts (T41)
 *
 * Verifies the share-by-URL path:
 *
 *   1. Visit /report/<id> directly with the API mocked to return a
 *      known report payload.
 *   2. The page must render the title from the payload.
 *   3. A 404 must render the "报告不存在" empty state.
 *
 * This test does not need auth/seed-API — only the dev server + the
 * ability to intercept /api/report/:id. The route handler lives at
 * apps/api/src/routes/report.ts and the web client at
 * src/api/predictions.ts:getReport.
 */
import { test, expect } from '@playwright/test';

const REPORT_ID = `e2e-share-${Date.now()}`;
const REPORT_TITLE = 'E2E 分享报告 · 治愈系插画';

test.describe('report-share (T41)', () => {
  test('visiting /report/:id renders the title returned by the API', async ({
    page,
  }) => {
    await page.route(`**/api/report/${REPORT_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: REPORT_ID,
          title: REPORT_TITLE,
          status: 'done',
          report: { decision: '建议发布' },
          evidence: { diversity_score: '0.82', boost_count: '2' },
          created_at: 1_716_500_000,
          completed_at: 1_716_500_300,
        }),
      });
    });

    await page.goto(`/report/${REPORT_ID}`);

    // Title is the H1 (Report.tsx renders `data.title` as <h1>).
    await expect(
      page.getByRole('heading', { name: REPORT_TITLE, level: 1 }),
    ).toBeVisible({ timeout: 5_000 });

    // Decision text is rendered in the "决策结论" section.
    await expect(page.getByText('决策结论')).toBeVisible();
    await expect(page.getByText('建议发布')).toBeVisible();

    // Status badge: "已完成" for status === 'done'.
    await expect(page.getByText('已完成')).toBeVisible();

    // Evidence pack — show at least one item.
    await expect(page.getByText('证据包')).toBeVisible();
  });

  test('unknown report id → 报告不存在 empty state', async ({ page }) => {
    const missingId = `missing-${Date.now()}`;
    await page.route(`**/api/report/${missingId}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'NOT_FOUND',
          message: 'Report not found',
        }),
      });
    });

    await page.goto(`/report/${missingId}`);

    await expect(
      page.getByRole('heading', { name: '报告不存在', level: 1 }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('返回历史记录')).toBeVisible();
  });
});
