import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: { environment: 'node' },
  resolve: {
    alias: {
      '@qizai/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
