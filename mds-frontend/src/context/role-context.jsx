import { useState } from 'react';
import { RoleContext } from './role-context-object';
import { detectRoleFromHostname } from '@mdsystem/core/utils/role-detection';
import envExampleRaw from '../../.env.example?raw';

// Parse .env.example file to extract VITE_DEV_PORTAL value
const parseEnvExample = () => {
  const match = envExampleRaw.match(/VITE_DEV_PORTAL=(.+)/);
  return match ? match[1].trim() : 'www';
};

export function RoleProvider({ children }) {
  const getInitialRole = () => {
    const hostname = window.location.hostname;
    
    // In local development (localhost), use VITE_DEV_PORTAL to simulate subdomain
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Use .env value, fallback to .env.example value
      const devPortal = import.meta.env.VITE_DEV_PORTAL || parseEnvExample();
      // Simulate the subdomain for role detection
      return detectRoleFromHostname(`${devPortal}.mdsystemtip.space`);
    }
    
    // Production: use actual hostname
    return detectRoleFromHostname(hostname);
  };

  const [role] = useState(getInitialRole);

  return (
    <RoleContext.Provider value={{ role }}>
      {children}
    </RoleContext.Provider>
  );
}
