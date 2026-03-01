import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Portal → backend URL mapping
const PORTAL_URLS = {
  www:    'https://www.mdsystemtip.space',
  www2:   'https://www2.mdsystemtip.space',
  local:  'http://localhost:3001',
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const DEV_PORTAL = env.VITE_DEV_PORTAL || 'www';
  // Explicit VITE_BACKEND_URL overrides the auto-derived URL
  const BACKEND_URL = env.VITE_BACKEND_URL || PORTAL_URLS[DEV_PORTAL] || PORTAL_URLS['www'];

  console.log(`🔗 Patient Portal — DEV_PORTAL=${DEV_PORTAL}  Backend proxy: ${BACKEND_URL}`);

  return {
    resolve: {
      alias: {
        '@core': resolve(__dirname, 'src'),
      },
      // Force a single copy of React regardless of how many packages import it.
      // Without this, workspace packages (e.g. @mdsystem/core) or pre-bundled
      // deps can resolve to a different React instance, causing the
      // "Cannot read properties of null (reading 'useRef')" hook error.
      dedupe: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
    },
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler']],
        },
      }),
    ],
    server: {
      proxy: {
        '/auth': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: true,
          bypass: function(req) {
            // Don't proxy GET requests (browser navigation) - let React Router handle them
            if (req.method === 'GET') {
              return '/index.html';
            }
          },
        },
        '/emr': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: true,
        },
        '/patient': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: true,
        },
        '/info': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: true,
        },
        '/econsultation': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: true,
          // SSE streaming support: disable response buffering and extend
          // timeout so the proxy doesn't kill the connection while LLaMA generates
          timeout: 300000,    // 5 minutes (matches backend CHATBOT_PROXY_TIMEOUT_MS)
          proxyTimeout: 300000,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
                // Disable response buffering for SSE
                proxyRes.headers['cache-control'] = 'no-cache, no-transform';
                proxyRes.headers['x-accel-buffering'] = 'no';
              }
            });
          },
        },
        '/appointment': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: true,
        },
        '/media': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: true,
        },
      },
    }
  }
});
