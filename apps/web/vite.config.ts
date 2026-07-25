import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api/* to the wrangler dev server (default :8787) so the SPA can
// call `fetch('/api/...')` with relative URLs. Without this the browser
// would hit vite itself, get 404 for every /api route, and signup/login
// would silently fail.
//
// Production: Cloudflare Pages routes /api/* to the Workers API via
// _redirects or a custom domain — the same relative URL pattern works
// there too.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
});
