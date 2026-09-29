function loggerMock() {
  return Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, jest.fn()]));
}

function socketMock(identity = {}) {
  const handlers = {};
  return {
    id: 'socket-test', userId: '12', userRole: 'patient', ...identity,
    handlers,
    on: jest.fn((event, handler) => { handlers[event] = handler; }),
    emit: jest.fn(), join: jest.fn(), leave: jest.fn(),
  };
}

function withEnvironment(values) {
  const original = { ...process.env };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  };
}

module.exports = { loggerMock, socketMock, withEnvironment };
