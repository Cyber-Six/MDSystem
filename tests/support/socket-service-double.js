// A shared consumer-level double: transport events preserve listeners, whereas
// service.disconnect() removes them, matching the shared service's lifecycle.
export const createSocketDouble = (pending = false) => {
  const handlers = new Map();
  let connected = !pending;
  let cancelled = false;
  let finish;
  const connection = pending ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve();
  const service = {
    connect: jest.fn(() => connection),
    disconnect: jest.fn(() => { connected = false; cancelled = true; handlers.clear(); }),
    on: jest.fn((event, handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(handler);
    }),
    off: jest.fn((event, handler) => {
      if (handler) handlers.get(event)?.delete(handler);
      else handlers.delete(event);
    }),
    emit: jest.fn(() => connected),
    isConnected: () => connected,
    getSocket: () => service,
  };
  return {
    service,
    handlers,
    finish: () => { connected = !cancelled; finish?.(); },
    fire: (event, value) => {
      if (event === 'connect') connected = true;
      if (event === 'disconnect') connected = false;
      for (const callback of handlers.get(event) || []) callback(value);
    },
    joins: () => service.emit.mock.calls.filter(([event]) => event === 'healthchat:join-room').map(([, data]) => data.chatId),
  };
};
