import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  server: {
    proxy: {
      '/api/mp': {
        target: 'https://api.streamvc.live',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mp/, ''),
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
        host: resolve(__dirname, 'host/index.html'),
        sellerPortal: resolve(__dirname, 'seller-portal/index.html'),
        miners: resolve(__dirname, 'miners/index.html'),
        buyers: resolve(__dirname, 'buyers/index.html'),
      },
    },
  },
});
