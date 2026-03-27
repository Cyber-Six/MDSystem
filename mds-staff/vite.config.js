import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Portal → backend URL mapping
const PORTAL_URLS = {
  staff:  'https://staff.mdsystemtip.space',
  staff2: 'https://staff2.mdsystemtip.space',
  local:  'http://localhost:3001',
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
        '/dashboard': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
          bypass: function(req) {
            if (req.method === 'GET') {
              return '/index.html';
            }
          },
        },
        '/medical-update': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/profile-update': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
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
        '/consultation': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/profile': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/media': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/info': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/medical-inventory': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/admin': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/healthchat': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),  // Only use secure for HTTPS backends
        },
        '/rolemanagement': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),
        },
        '/staff': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: BACKEND_URL.startsWith('https'),
        },
      },
    }
  }
});
