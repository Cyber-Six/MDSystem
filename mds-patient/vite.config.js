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
