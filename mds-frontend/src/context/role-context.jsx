import { useState } from 'react';
import { RoleContext } from './role-context-object';
import { detectRoleFromHostname } from '@mdsystem/core/utils/role-detection';

export function RoleProvider({ children }) {
  const getInitialRole = () => {
    return detectRoleFromHostname(window.location.hostname);
  };

  const [role] = useState(getInitialRole);

  return (
    <RoleContext.Provider value={{ role }}>
      {children}
    </RoleContext.Provider>
  );
}
