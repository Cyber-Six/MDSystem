import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'
import { RoleProvider } from './context/role-context.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RoleProvider>
      <App />
    </RoleProvider>
  </StrictMode>,
)
