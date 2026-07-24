/**
 * apps/web/playwright.config.ts
 *
 * Playwright config for the web app's e2e suite.
 *
 * - Single browser project (chromium) — keeps the install footprint small
 *   and matches what CI will provision.
 * - `webServer` boots `pnpm dev` automatically, so `pnpm e2e` from a fresh
 *   clone just works. The dev server takes ~1s to come up on a warm box.
 * - `baseURL` is the Vite default (http://localhost:5173).
 *
 * Tests live under ./e2e — see each spec for the scenario it covers.
 *
 * Note: the dev server runs `predev` (fetch-video.sh + fetch-social-svgs.sh)
 * which talks to an external CDN. On an offline box the predev step would
 * fail. We bypass that by invoking `vite` directly through `--` so the script
 * pipeline still runs once at install time but the e2e webServer never
 * triggers it. If you need offline support later, set `command` to
 * `pnpm exec vite --port 5173 --strictPort`.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'pnpm exec vite --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
