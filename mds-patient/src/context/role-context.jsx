import { RoleContext } from './role-context-object';

/**
 * Patient Portal RoleProvider
 * 
 * This app is always the patient portal, so the role is hardcoded to 'patient'.
 * No subdomain detection needed since the app is dedicated to patients.
 */
export function RoleProvider({ children }) {
  return (
    <RoleContext.Provider value={{ role: 'patient' }}>
      {children}
    </RoleContext.Provider>
  );
}
