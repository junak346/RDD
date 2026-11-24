import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));

// The dev server proxies /api to the backend so the browser only ever talks
// to one origin (see docs/ARCHITECTURE.md — deployment topology).
export default defineConfig(({ mode }) => {
  // The backend reads the repository-root .env. Read the same file here so a
  // custom PORT does not leave the browser proxy pointing at the wrong API.
  const rootEnv = loadEnv(mode, repoRoot, '');
  const apiTarget =
    process.env.VITE_API_URL ||
    rootEnv.VITE_API_URL ||
    `http://127.0.0.1:${process.env.PORT || rootEnv.PORT || '5000'}`;

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      // Dev-only: accept proxied preview hosts (production is served by nginx,
      // which does not use this allowlist).
      allowedHosts: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Keep chart/map code out of the initial bundle.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            maps: ['leaflet', 'react-leaflet'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  };
});
