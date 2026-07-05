import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  server: {
    proxy: {
      '/auth': {
        target: 'https://api.streamvc.live',
        changeOrigin: true,
      },
      '/account': {
        target: 'https://api.streamvc.live',
        changeOrigin: true,
      },
      '/api/mp': {
        target: 'https://api.streamvc.live',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mp/, ''),
      },
      '/v1/rate-card': {
        target: 'https://coordinator.streamvc.live',
        changeOrigin: true,
      },
      '/v1/pool/check': {
        target: 'https://coordinator.streamvc.live',
        changeOrigin: true,
      },
      '^/providers/[^/]+/earnings$': {
        target: 'https://coordinator.streamvc.live',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        console: resolve(__dirname, 'console/index.html'),
        consoleDashboard: resolve(__dirname, 'console/dashboard/index.html'),
        consoleKeys: resolve(__dirname, 'console/keys/index.html'),
        consoleSettings: resolve(__dirname, 'console/settings/index.html'),
        consoleAgentDocs: resolve(__dirname, 'console/agent-docs/index.html'),
        host: resolve(__dirname, 'host/index.html'),
        network: resolve(__dirname, 'network/index.html'),
        sellerPortal: resolve(__dirname, 'seller-portal/index.html'),
      },
    },
  },
});
