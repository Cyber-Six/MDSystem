import { useEffect, useRef, useCallback, useState } from 'react';
import { createSocketService } from '@mdsystem/core/services/socket-service';
import { apiBaseUrlProvider, tokenService } from '../../../packages-core-adapter';

/**
 * Custom hook for real-time medicine request updates via Socket.IO
 * 
 * Listens for:
 * - medicine:request:new - New medicine request submitted by patient
 * - medicine:request:updated - Request data updated
 * - medicine:request:status-changed - Request status changed (approved/rejected/cancelled)
 * 
 * @param {Function} onNewRequest - Callback when new request is created
 * @param {Function} onRequestUpdate - Callback when request is updated
 * @param {Function} onRequestStatusChange - Callback when request status changes
 * @returns {{ isConnected: boolean }} - Socket connection status
 */
export function useMedicineRequestSocket(onNewRequest, onRequestUpdate, onRequestStatusChange) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Track processed request IDs to prevent duplicate handling
  const processedRequestIds = useRef(new Set());
  
  // Use refs for callbacks to prevent socket reconnection on callback changes
  const onNewRequestRef = useRef(onNewRequest);
  const onRequestUpdateRef = useRef(onRequestUpdate);
  const onRequestStatusChangeRef = useRef(onRequestStatusChange);

  // Update refs when callbacks change
  useEffect(() => {
    onNewRequestRef.current = onNewRequest;
  }, [onNewRequest]);

  useEffect(() => {
    onRequestUpdateRef.current = onRequestUpdate;
  }, [onRequestUpdate]);

  useEffect(() => {
    onRequestStatusChangeRef.current = onRequestStatusChange;
  }, [onRequestStatusChange]);

  // Connect socket once on mount
  useEffect(() => {
    let isMounted = true;
    
    const socketService = createSocketService({
      getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
      getToken: () => tokenService.TokenStorage.getAccessToken(),
      onAuthError: async () => {
        await tokenService.refreshAccessToken();
      },
      options: {
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling'],
      }
    });

    socketService.connect().then(() => {
      if (!isMounted) {
        socketService.disconnect();
        return;
      }

      socketRef.current = socketService;
      setIsConnected(true);

      // Listen for new medicine requests (from patients)
      socketService.on('medicine:request:new', (data) => {
        if (!data || !data.requestId) return;
        
        const requestId = String(data.requestId);
        
        // Prevent duplicate processing
        if (processedRequestIds.current.has(requestId)) return;
        processedRequestIds.current.add(requestId);
        
        // Call callback if provided
        if (onNewRequestRef.current) {
          onNewRequestRef.current(data);
        }
      });

      // Listen for request updates
      socketService.on('medicine:request:updated', (data) => {
        if (!data || !data.requestId) return;
        
        if (onRequestUpdateRef.current) {
          onRequestUpdateRef.current(data);
        }
      });

      // Listen for status changes (approved/rejected/cancelled)
      socketService.on('medicine:request:status-changed', (data) => {
        if (!data || !data.requestId) return;
        
        if (onRequestStatusChangeRef.current) {
          onRequestStatusChangeRef.current(data);
        }
      });

      console.log('[MedicineRequestSocket] Connected and listening for events');
    }).catch((err) => {
      if (!isMounted) return;
      console.error('[MedicineRequestSocket] Connection failed:', err);
      setIsConnected(false);
    });

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      processedRequestIds.current.clear();
    };
  }, []); // Empty dependency array = connect once on mount

  return { isConnected };
}
