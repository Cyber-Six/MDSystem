const { parseRefreshToken } = require('./refresh-token');
test.each([{}, [], 'Infinity:phone:token', '-1:phone:token', '1.2:phone:token', '9007199254740992:phone:token', '12::token', '12:phone:', `12:${'x'.repeat(257)}:token`])('rejects malformed refresh token %j', token => {
  expect(parseRefreshToken(token)).toBeNull();
});
test('parses canonical and legacy device identifiers without changing the wire format', () => {
  expect(parseRefreshToken('12:device-1:random-token')).toEqual({ userId: 12, deviceId: 'device-1', token: 'random-token' });
});
