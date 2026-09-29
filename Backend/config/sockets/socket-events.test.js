jest.mock('../../utils/logger', () => require('../../test-support/fixtures.cjs').loggerMock());
const { socketMock } = require('../../test-support/fixtures.cjs');
let events;
beforeEach(() => { jest.resetModules(); events = require('./socket-events'); });
test('validates, registers, and replaces event handlers', async () => {
  expect(() => events.registerHandler('invalid', null)).toThrow('must be a function');
  const original = jest.fn();
  const replacement = jest.fn();
  events.registerHandler('update', original);
  events.registerHandlers({ update: replacement, other: jest.fn() });
  expect(events.getRegisteredEvents()).toEqual(['update', 'other']);
  const socket = socketMock();
  events.bindHandlersToSocket(socket);
  const ack = jest.fn();
  await socket.handlers.update({ id: 1 }, ack);
  expect(replacement).toHaveBeenCalledWith(socket, { id: 1 }, ack);
  expect(original).not.toHaveBeenCalled();
});
test('converts handler failures to acknowledgements and tolerates missing callbacks', async () => {
  events.registerHandler('fail', async () => { throw new Error('failed'); });
  const socket = socketMock();
  events.bindHandlersToSocket(socket);
  const ack = jest.fn();
  await socket.handlers.fail({}, ack);
  expect(ack).toHaveBeenCalledWith({ error: 'INTERNAL_ERROR', message: 'failed' });
  await expect(socket.handlers.fail({})).resolves.toBeUndefined();
});
