import { useContext } from 'react';
import { PortalContext } from './PortalContextObject';

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) throw new Error('usePortal must be used within PortalProvider');
  return context;
}
