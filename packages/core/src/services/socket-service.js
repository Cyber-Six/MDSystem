/**
 * Socket Service Factory
 * Platform-agnostic real-time communication via Socket.IO
 *
 * Manages connection lifecycle, authentication handshake with JWT,
 * and provides a simple on/off/emit API for consumers.
 *
 * @module socket-service
 */

import { io as ioClient } from 'socket.io-client';

/**
 * Creates a socket service with platform-specific dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} dependencies.getApiBaseUrl - Returns API base URL
 * @param {Function} dependencies.getToken - Returns current JWT access token (may be async for RN)
 * @param {Function} [dependencies.onAuthError] - Called on auth failure; opportunity to refresh token
 * @param {Object}   [dependencies.options] - Socket.IO client options override
 *
 * @returns {Object} Socket service methods
 *
 * @example
 * // Web
 * import { createSocketService } from '@mdsystem/core/services/socket-service';
 *
 * const socketService = createSocketService({
 *   getApiBaseUrl: apiBaseUrlProvider.getApiBaseUrl,
 *   getToken: () => tokenService.TokenStorage.getAccessToken(),
 *   onAuthError: async () => {
 *     await tokenService.refreshAccessToken();
 *   },
 * });
 *
 * await socketService.connect();
 * socketService.on('appointment:status-changed', (data) => { ... });
 */
export const createSocketService = ({
  getApiBaseUrl,
  getToken,
  onAuthError,
  options = {},
}) => {
  let socket = null;
  let connectionPromise = null;

  /**
   * Connect to the Socket.IO server.
   * Resolves when connected, rejects on auth failure.
   * Prevents duplicate connections by tracking in-progress connection.
   *
   * @returns {Promise<void>}
   */
  const connect = () => {
    // If already connected, resolve immediately
    if (socket?.connected) return Promise.resolve();

    // If connection is in progress, return existing promise
    if (connectionPromise) return connectionPromise;

    // If there's an existing socket that's not connected, clean it up first
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    connectionPromise = new Promise((resolve, reject) => {
      const baseUrl = getApiBaseUrl();
      let settled = false;

      // In development with relative URLs, Socket.IO will connect to the current origin.
      // The Vite proxy at /socket.io will forward requests to the backend.
      // In production, we use relative URLs to avoid CORS issues (same origin).
      const socketUrl = baseUrl ? baseUrl : undefined; // undefined = use current origin

      socket = ioClient(socketUrl, {
        // Auth function called on every connection/reconnection.
        // Ensures token is always fresh.
        auth: (cb) => {
          Promise.resolve(getToken())
            .then((token) => cb({ token: token || '' }))
            .catch(() => cb({ token: '' }));
        },
        // Use both WebSocket and polling for maximum compatibility
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 10,
        // Increase timeout for slow connections
        timeout: 20000,
        // Allow CORS for cross-origin connections
        withCredentials: true,
        ...options,
      });

      socket.once('connect', () => {
        if (!settled) {
          settled = true;
          connectionPromise = null;
          console.log('[SocketService] Connected successfully');
          resolve();
        }
      });

      socket.on('connect_error', async (err) => {
        console.error('[SocketService] Connection error:', err.message);
        if (err.message?.includes('SOCKET_AUTH_FAILED') && onAuthError) {
          try {
            await onAuthError();
            // Token refreshed; socket.io will auto-retry with fresh token
            return;
          } catch {
            // Refresh failed
          }
        }
        if (!settled) {
          settled = true;
          connectionPromise = null;
          reject(err);
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('[SocketService] Disconnected:', reason);
      });

      socket.on('error', (error) => {
        console.error('[SocketService] Socket error:', error);
      });
    });

    return connectionPromise;
  };

  /**
   * Disconnect from the server and clean up.
   */
  const disconnect = () => {
    connectionPromise = null;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
  };

  /**
   * Subscribe to a server event.
   * @param {string} event
   * @param {Function} handler
   */
  const on = (event, handler) => {
    if (!socket) {
      console.warn('[SocketService] Not connected. Call connect() first.');
      return;
    }
    socket.on(event, handler);
  };

  /**
   * Unsubscribe from a server event.
   * @param {string} event
   * @param {Function} [handler] - Specific handler, or omit to remove all
   */
  const off = (event, handler) => {
    if (!socket) return;
    if (handler) {
      socket.off(event, handler);
    } else {
      socket.off(event);
    }
  };

  /**
   * Emit an event to the server.
   * @param {string} event
   * @param {*} data
   * @param {Function} [callback] - Acknowledgement callback
   * @returns {boolean} true if emitted, false if not connected
   */
  const emit = (event, data, callback) => {
    if (!socket?.connected) {
      console.warn('[SocketService] Not connected, cannot emit:', event);
      return false;
    }
    if (callback) {
      socket.emit(event, data, callback);
    } else {
      socket.emit(event, data);
    }
    return true;
  };

  /**
   * Check connection status.
   * @returns {boolean}
   */
  const isConnected = () => socket?.connected ?? false;

  /**
   * Get raw Socket.IO socket instance (escape hatch).
   * @returns {import('socket.io-client').Socket|null}
   */
  const getSocket = () => socket;

  return {
    connect,
    disconnect,
    on,
    off,
    emit,
    isConnected,
    getSocket,
  };
};
