import { useState } from 'react';
import { RoleContext } from './role-context-object';

export function RoleProvider({ children }) {
  const getInitialRole = () => {
    const hostname = window.location.hostname.toLowerCase();
    
    // Staff subdomain → medical role
    if (hostname.startsWith('staff.')) {
      return 'medical';
    }
    
    // Default to patient role (www, root domain, localhost, etc.)
    return 'patient';
  };

  const [role] = useState(getInitialRole);

  return (
    <RoleContext.Provider value={{ role }}>
      {children}
    </RoleContext.Provider>
  );
}
