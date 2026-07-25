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
    // test.describe is not the vitest one. E2E directory + any *.spec.ts
    // outside ./e2e are both excluded for belt-and-suspenders safety.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      './e2e/**',
      '**/*.spec.ts',
    ],
  },
});
