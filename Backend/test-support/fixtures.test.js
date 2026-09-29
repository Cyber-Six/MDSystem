const { loggerMock, socketMock, withEnvironment } = require('./fixtures.cjs');

test('logger mock exposes independent jest spies for every severity', () => {
  const logger = loggerMock();
  logger.debug('trace'); logger.info('ready'); logger.warn('slow'); logger.error('failed');
  expect(Object.keys(logger)).toEqual(['debug', 'info', 'warn', 'error']);
  expect(logger.debug).toHaveBeenCalledWith('trace');
  expect(logger.info).toHaveBeenCalledWith('ready');
  expect(logger.warn).toHaveBeenCalledWith('slow');
  expect(logger.error).toHaveBeenCalledWith('failed');
});

test('socket mock records event handlers and supports identity overrides', () => {
  const socket = socketMock({ id: 'custom', userRole: 'medical' });
  const handler = jest.fn();
  socket.on('ping', handler);
  expect(socket.id).toBe('custom'); expect(socket.userRole).toBe('medical'); expect(socket.userId).toBe('12');
  expect(socket.handlers.ping).toBe(handler); expect(socket.on).toHaveBeenCalledWith('ping', handler);
  socket.emit('pong', { ok: true }); expect(socket.emit).toHaveBeenCalledWith('pong', { ok: true });
});

test('environment fixture restores changed, removed, and newly introduced variables', () => {
  const key = 'BACKEND_FIXTURE_TEST_VALUE'; const created = 'BACKEND_FIXTURE_TEST_CREATED';
  const prior = process.env[key]; const hadCreated = Object.hasOwn(process.env, created); const priorCreated = process.env[created];
  process.env[key] = 'before'; delete process.env[created];
  const restore = withEnvironment({ [key]: 'during', [created]: 'temporary', NODE_ENV: undefined });
  expect(process.env[key]).toBe('during'); expect(process.env[created]).toBe('temporary'); expect(process.env.NODE_ENV).toBeUndefined();
  restore();
  expect(process.env[key]).toBe('before'); expect(Object.hasOwn(process.env, created)).toBe(false);
  if (prior === undefined) delete process.env[key]; else process.env[key] = prior;
  if (hadCreated) process.env[created] = priorCreated;
});
