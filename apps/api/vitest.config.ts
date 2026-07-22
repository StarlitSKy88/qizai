import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@qizai/shared': '/Users/opc-1/Library/pnpm/global/5/node_modules/@qizai/shared/src',
    },
  },
});
