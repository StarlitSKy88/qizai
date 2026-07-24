import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig, defineProject } from 'vitest/config';

const sharedAlias = {
  '@qizai/shared': path.resolve(__dirname, '../../packages/shared/src'),
};

// Two isolated projects:
//   unit        → Node runtime, no D1. Pure logic + route tests with mock LLM.
//   integration → Cloudflare Workers runtime + Miniflare D1. Real auth + DB.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));

  return {
    test: {
      projects: [
        // Node-environment tests: unit logic (parseEnv / jwt / password)
        // + route tests that run against Node with a mock LLM (no D1).
        defineProject({
          test: {
            name: 'unit',
            environment: 'node',
            include: [
              'test/unit/**/*.test.ts',
              'test/routes/**/*.test.ts',
            ],
          },
          resolve: { alias: sharedAlias },
        }),
        // Workers-runtime integration tests (auth route + D1).
        defineProject({
          test: {
            name: 'integration',
            include: ['test/integration/**/*.test.ts'],
            setupFiles: ['./test/setup-integration.ts'],
          },
          plugins: [
            cloudflareTest({
              wrangler: { configPath: './wrangler.test.toml' },
              miniflare: {
                bindings: {
                  // Migrations loaded from migrations/*.sql, applied in setup file.
                  TEST_MIGRATIONS: migrations,
                },
              },
            }),
          ],
          resolve: { alias: sharedAlias },
        }),
      ],
    },
  };
});
