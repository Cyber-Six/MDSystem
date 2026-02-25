import { RoleContext } from './role-context-object';

/**
 * Staff Portal RoleProvider
 * 
 * This app is always the staff portal, so the role is hardcoded to 'medical'.
 * No subdomain detection needed since the app is dedicated to staff.
 */
export function RoleProvider({ children }) {
  return (
    <RoleContext.Provider value={{ role: 'medical' }}>
      {children}
    </RoleContext.Provider>
  );
}
