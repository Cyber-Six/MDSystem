import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@shared/styles/index.css'
import App from './App.jsx'
import { RoleProvider } from '@shared/context/role-context.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RoleProvider>
      <App />
    </RoleProvider>
  </StrictMode>,
)
