import { useContext } from 'react';
import { PortalContext } from '../context/PortalContextObject';

export function useDetectPortalFromSubdomain() {
  const context = useContext(PortalContext);
  if (!context) throw new Error('useDetectPortalFromSubdomain must be used within PortalProvider');
  return context;
}
