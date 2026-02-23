import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@core/styles/index.css'
import App from './App.jsx'
import { RoleProvider } from '@core/context/role-context.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RoleProvider>
      <App />
    </RoleProvider>
  </StrictMode>,
)
