import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    // Exclude Playwright E2E specs from vitest — they live in ./e2e and
    // belong to the Playwright runner (pnpm e2e). Without this exclusion
    // vitest picks them up via its default **/*.spec.ts glob and fails
    // with "test.describe() called here" because @playwright/test's
    // test.describe is not the vitest one.
    //
    // We exclude `./e2e/**` (the precise directory) plus the standard
    // node_modules/dist/etc. The unit/integration suite under ./test/
    // uses *.test.ts(x), not *.spec.ts, so we deliberately don't add a
    // blanket `**/*.spec.ts` — that would silently swallow any future
    // .spec.ts a contributor might add inside ./test/.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      './e2e/**',
    ],
  },
});
