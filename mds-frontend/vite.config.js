import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = process.cwd()
  
  // Load environment variables from .env files
  let env = loadEnv(mode, envDir, '')
  
  // If .env doesn't exist, manually load .env.example as fallback
  const envFile = resolve(envDir, '.env')
  const envExampleFile = resolve(envDir, '.env.example')
  
  if (!existsSync(envFile) && existsSync(envExampleFile)) {
    console.log('ℹ️  Using .env.example (no .env file found)')
    const exampleContent = readFileSync(envExampleFile, 'utf-8')
    
    // Simple env parser (supports KEY=VALUE format)
    exampleContent.split('\n').forEach(line => {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && !env[match[1]]) {
        env[match[1]] = match[2];
      } 
    });
  }
  
  // 🔧 DEVELOPER SWITCH: Change VITE_DEV_PORTAL in .env to 'www', 'www2', 'staff', 'staff2', or 'local'
  const DEV_PORTAL = env.VITE_DEV_PORTAL || 'www';
  
  // Determine backend URL based on DEV_PORTAL
  const PORTAL_URLS = {
    local: 'http://localhost:3001',
    www: 'https://www.mdsystemtip.space',
    www2: 'https://www2.mdsystemtip.space',
    staff: 'https://staff.mdsystemtip.space',
    staff2: 'https://staff2.mdsystemtip.space'
  };
  
  const BACKEND_URL = PORTAL_URLS[DEV_PORTAL] || PORTAL_URLS['www'];
  
  console.log(`🔗 Backend proxy target: ${BACKEND_URL} (DEV_PORTAL=${DEV_PORTAL})`);

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
