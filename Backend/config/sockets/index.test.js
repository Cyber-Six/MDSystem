jest.mock('./socket-server', () => ({ initSocket: jest.fn(), getIO: jest.fn() }));
jest.mock('./socket-emitter', () => Object.fromEntries(['emitToUser', 'emitToUsers', 'emitToAll', 'emitToRoom', 'emitToRole', 'emitToUserWithAck', 'notifyUser', 'notifyUsers'].map(name => [name, jest.fn()])));
jest.mock('./socket-store', () => Object.fromEntries(['isConnected', 'getSocketIds', 'getConnectedCount', 'isConnectedAnywhere'].map(name => [name, jest.fn()])));
jest.mock('./socket-events', () => Object.fromEntries(['registerHandler', 'registerHandlers', 'getRegisteredEvents'].map(name => [name, jest.fn()])));
jest.mock('./notification-store', () => ({ getPendingCount: jest.fn() }));
test('exposes exactly the supported socket public API with original function identities', () => {
  expect(require('./index')).toEqual({ ...require('./socket-server'), ...require('./socket-emitter'), ...require('./socket-store'), ...require('./socket-events'), ...require('./notification-store') });
});
