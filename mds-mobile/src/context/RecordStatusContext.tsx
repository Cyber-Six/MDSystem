/**
 * RecordStatusContext — Gates the app on initial record / pending-approval status.
 *
 * After login, fetches checkInitialRecordStatus() and exposes:
 *   - recordStatus: the full RecordStatus result
 *   - isRecordLoading: true while the check runs
 *   - refreshRecordStatus(): re-fetch (e.g. after submitting the form)
 *
 * Screens use `useRecordStatus()` to conditionally show a blocking overlay.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { checkInitialRecordStatus, type RecordStatus } from '../services/emr-service';
import { useAuth } from './AuthContext';

interface RecordStatusContextType {
  recordStatus: RecordStatus | null;
  isRecordLoading: boolean;
  refreshRecordStatus: () => Promise<void>;
}

const RecordStatusContext = createContext<RecordStatusContextType | undefined>(undefined);

export const RecordStatusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [recordStatus, setRecordStatus] = useState<RecordStatus | null>(null);
  const [isRecordLoading, setIsRecordLoading] = useState(true);

  const refreshRecordStatus = useCallback(async () => {
    setIsRecordLoading(true);
    try {
      const result = await checkInitialRecordStatus();
      setRecordStatus(result);
    } catch {
      // If check fails, assume OK to avoid locking user out
      setRecordStatus({ needsInitialRecord: false, status: null });
    } finally {
      setIsRecordLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refreshRecordStatus();
    } else {
      setRecordStatus(null);
      setIsRecordLoading(false);
    }
  }, [isAuthenticated, refreshRecordStatus]);

  return (
    <RecordStatusContext.Provider value={{ recordStatus, isRecordLoading, refreshRecordStatus }}>
      {children}
    </RecordStatusContext.Provider>
  );
};

export const useRecordStatus = (): RecordStatusContextType => {
  const context = useContext(RecordStatusContext);
  if (context === undefined) {
    throw new Error('useRecordStatus must be used within a RecordStatusProvider');
  }
  return context;
};
