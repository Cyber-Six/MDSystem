import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Staff portal always targets the staff backend
  const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3002';
  
  console.log(`🔗 Staff Portal — Backend proxy target: ${BACKEND_URL}`);

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
      },
    }
  }
});
