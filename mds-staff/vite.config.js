import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Portal → backend URL mapping
const PORTAL_URLS = {
  staff:  'https://staff.mdsystemtip.space',
  staff2: 'https://staff2.mdsystemtip.space',
  local:  'http://localhost:3002',
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const DEV_PORTAL = env.VITE_DEV_PORTAL || 'staff';
  // Explicit VITE_BACKEND_URL overrides the auto-derived URL
  const BACKEND_URL = env.VITE_BACKEND_URL || PORTAL_URLS[DEV_PORTAL] || PORTAL_URLS['staff'];

  console.log(`🔗 Staff Portal — DEV_PORTAL=${DEV_PORTAL}  Backend proxy: ${BACKEND_URL}`);

  return {
    resolve: {
      alias: {
        '@core': resolve(__dirname, 'src'),
      },
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
        '/dashboard': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: true,
          bypass: function(req) {
            if (req.method === 'GET') {
              return '/index.html';
            }
          },
        },
        '/medical-update': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: true,
        },
        '/profile-update': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: true,
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
        '/info': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: true,
        },
      },
    }
  }
});
