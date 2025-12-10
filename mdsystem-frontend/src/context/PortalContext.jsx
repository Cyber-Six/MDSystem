
import { useState } from 'react';
import { PortalContext } from './PortalContextObject';

export function PortalProvider({ children }) {
  const getInitialPortal = () => {
    const hostname = window.location.hostname;
    return hostname.startsWith('staff.') ? 'medical' : 'patient';
  };

  const [portal] = useState(getInitialPortal);

  return (
    <PortalContext.Provider value={{ portal, isPatient: portal === 'patient', isMedical: portal === 'medical' }}>
      {children}
    </PortalContext.Provider>
  );
}