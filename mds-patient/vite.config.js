import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_ENV_DIR = resolve(__dirname, '..')

// Portal → backend URL mapping
const PORTAL_URLS = {
  www:    'https://www.mdsystemtip.space',
  www2:   'https://www2.mdsystemtip.space',
  local:  'http://localhost:3000',
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ROOT_ENV_DIR, '');

  const DEV_PORTAL = env.VITE_PATIENT_DEV_PORTAL || env.VITE_DEV_PORTAL || 'www';
  // Explicit VITE_BACKEND_URL overrides the auto-derived URL
  const BACKEND_URL = env.VITE_PATIENT_BACKEND_URL || env.VITE_BACKEND_URL || PORTAL_URLS[DEV_PORTAL] || PORTAL_URLS['www'];
  const GOOGLE_CLIENT_ID = env.VITE_GOOGLE_CLIENT_ID || env.SHARED_GOOGLE_WEB_CLIENT_ID || '';
  const RECAPTCHA_SITE_KEY = env.VITE_RECAPTCHA_SITE_KEY || env.SHARED_RECAPTCHA_SITE_KEY || '';

  console.log(`🔗 Patient Portal — DEV_PORTAL=${DEV_PORTAL}  Backend proxy: ${BACKEND_URL}`);

  return {
    envDir: ROOT_ENV_DIR,
    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(GOOGLE_CLIENT_ID),
      'import.meta.env.VITE_RECAPTCHA_SITE_KEY': JSON.stringify(RECAPTCHA_SITE_KEY),
    },
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
        // Socket.IO WebSocket proxy (must be first for proper WebSocket upgrade)
        '/socket.io': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
          ws: true, // Enable WebSocket proxying
        },
        '/auth': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
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
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/patient': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/info': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/econsultation': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
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
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
          bypass: function(req) {
            // Don't proxy GET requests (browser navigation) - let React Router handle them
            if (req.method === 'GET') {
              return '/index.html';
            }
          },
        },
        '/media': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/profile': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/medical-inventory': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/healthchat': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/dashboard': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),
        },
        '/announcement': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/documents': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),
        },
        '/settings': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),
          bypass: function(req) {
            // Let React Router handle browser navigation to /settings.
            // API requests to /settings (with Authorization header) should still be proxied.
            if (req.method === 'GET' && !req.headers.authorization) {
              return '/index.html';
            }
          },
        },
      },
    }
  }
});
