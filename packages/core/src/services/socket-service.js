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
  let rejectConnection = null;

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

    // Assign the promise before starting the socket, so synchronous setup failures
    // and connection events cannot leave a rejected promise cached forever.
    let resolveConnection;
    const pending = new Promise((resolve, reject) => {
      resolveConnection = resolve;
      rejectConnection = reject;
    });
    connectionPromise = pending;

    const settle = (error) => {
      if (connectionPromise !== pending) return;
      const reject = rejectConnection;
      connectionPromise = null;
      rejectConnection = null;
      if (error) reject(error);
      else resolveConnection();
    };

    try {
      const currentSocket = ioClient(getApiBaseUrl() || undefined, {
        auth: (cb) => {
          Promise.resolve().then(getToken)
            .then((token) => cb({ token: token || '' }))
            .catch(() => cb({ token: '' }));
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 10,
        timeout: 20000,
        withCredentials: true,
        ...options,
        autoConnect: false,
      });
      socket = currentSocket;
      let authRecoveryAttempted = false;
      let authRecoveryInProgress = false;

      currentSocket.on('connect', () => {
        authRecoveryAttempted = false;
        settle();
      });

      currentSocket.on('connect_error', async (err) => {
        if (socket !== currentSocket) return;
        const isAuthError = err.message?.includes('SOCKET_AUTH_FAILED');
        if (isAuthError && onAuthError) {
          if (authRecoveryInProgress) return;
          if (!authRecoveryAttempted) {
            authRecoveryAttempted = true;
            authRecoveryInProgress = true;
            try {
              await onAuthError();
              // Middleware rejection disables Socket.IO's automatic reconnection.
              // Retry explicitly, but never revive a socket after disconnect().
              if (socket === currentSocket) currentSocket.connect();
              return;
            } catch (error) {
              err = error;
            } finally {
              authRecoveryInProgress = false;
            }
          }
        }
        settle(err);
        // Transport failures remain eligible for Socket.IO's automatic retries.
        if (isAuthError) currentSocket.disconnect();
      });

      currentSocket.connect();
    } catch (error) {
      settle(error);
      socket?.disconnect();
      socket = null;
    }

    return pending;
  };

  /**
   * Disconnect from the server and clean up.
   */
  const disconnect = () => {
    const reject = rejectConnection;
    connectionPromise = null;
    rejectConnection = null;
    reject?.(new Error('Socket connection cancelled'));
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
