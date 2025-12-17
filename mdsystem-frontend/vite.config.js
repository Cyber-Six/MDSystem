import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  // 🔧 DEVELOPER SWITCH: Change VITE_DEV_PORTAL in .env.local to 'www' or 'staff'
  const DEV_PORTAL = env.VITE_DEV_PORTAL || 'www';
  
  // Determine backend URL based on DEV_PORTAL
  const BACKEND_URL = DEV_PORTAL === 'staff' 
    ? 'https://staff.mdsystemtip.space'
    : 'https://www.mdsystemtip.space';

  return {
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
        bypass: function(req, res, proxyOptions) {
          // Don't proxy GET requests (browser navigation) - let React Router handle them
          if (req.method === 'GET') {
            return '/index.html';
          }
          // Proxy all other methods (POST, etc.) to backend
        },
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
      '/dashboard': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: true,
        bypass: function(req, res, proxyOptions) {
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
    },
  }
}
});
