jest.mock('../../utils/logger', () => require('../../test-support/fixtures.cjs').loggerMock());
jest.mock('./socket-events', () => ({ registerHandlers: jest.fn() }));
jest.mock('./notification-acknowledgement', () => ({ acknowledgeNotification: jest.fn() }));
const { acknowledgeNotification } = require('./notification-acknowledgement');
const { registerHandlers } = require('./socket-events');
const { acknowledgementHandlers } = require('./acknowledgement-events');
const acknowledge = acknowledgementHandlers['notif:acknowledge'];
test('registers the notification acknowledgement handler', () => {
  expect(registerHandlers).toHaveBeenCalledWith(acknowledgementHandlers);
});
describe.each([true, false])('acknowledgement callback present: %s', present => {
  test.each([
    [{ userId: '12' }, {}, false, 'MISSING_ID'],
    [{}, { notificationId: 'n1' }, false, 'INVALID_USER'],
    [{ userId: '12' }, { notificationId: 'n1' }, false, 'ACK_FAILED'],
    [{ userId: '12' }, { notificationId: 'n1' }, true, null],
    [{ userId: '12' }, null, false, 'ACKNOWLEDGE_FAILED'],
  ])('validates and acknowledges %j / %j', async (socket, data, result, error) => {
    acknowledgeNotification.mockReset().mockResolvedValue(result);
    const ack = present ? jest.fn() : undefined;
    await acknowledge(socket, data, ack);
    if (present) expect(ack).toHaveBeenCalledWith(error ? expect.objectContaining({ error }) : { success: true, acknowledged: true, notificationId: 'n1' });
    if (data?.notificationId && socket.userId) expect(acknowledgeNotification).toHaveBeenCalledWith('n1', '12');
    else expect(acknowledgeNotification).not.toHaveBeenCalled();
  });
});
