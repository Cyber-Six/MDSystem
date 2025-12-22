import { useContext } from 'react';
import { RoleContext } from '../context/role-context-object';

export function useDetectRoleFromSubdomain() {
  const context = useContext(RoleContext);
  if (!context) throw new Error('useDetectRoleFromSubdomain must be used within RoleProvider');
  return context;
}
