import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig, defineProject } from 'vitest/config';

// T08 will replace this with the canonical config. This is a stepping stone
// so T07's integration tests can run end-to-end against D1 + JWT.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, 'migrations'));

  return {
    test: {
      projects: [
        // Node-environment unit tests (parseEnv / jwt / password)
        // + legacy full-flow integration (mock LLM, no D1)
        defineProject({
          test: {
            name: 'unit',
            environment: 'node',
            include: [
              'test/unit/**/*.test.ts',
              'test/integration/full-flow.test.ts',
            ],
          },
          resolve: {
            alias: {
              '@qizai/shared': path.resolve(__dirname, '../../packages/shared/src'),
            },
          },
        }),
        // Workers-runtime integration tests (auth route + D1)
        defineProject({
          test: {
            name: 'integration',
            include: ['test/integration/auth.test.ts'],
            setupFiles: ['./test/setup-integration.ts'],
          },
          plugins: [
            cloudflareTest({
              wrangler: { configPath: './wrangler.toml' },
              miniflare: {
                bindings: {
                  // Migrations loaded from migrations/*.sql, applied in setup file.
                  TEST_MIGRATIONS: migrations,
                },
              },
            }),
          ],
          resolve: {
            alias: {
              '@qizai/shared': path.resolve(__dirname, '../../packages/shared/src'),
            },
          },
        }),
      ],
    },
  };
});