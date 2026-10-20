const { getLiveAccessTokens, recordAccessToken, isAccessTokenExpired } = require('./access-token-session');

test('retains overlapping JWTs across refreshes and prunes expired tokens', () => {
  const session = {};
  recordAccessToken(session, 60, 1000);
  const first = session.tokenId;
  recordAccessToken(session, 60, 2000);
  expect(session.tokenId).not.toBe(first);
  expect(getLiveAccessTokens(session, 2000).map(token => token.tokenId)).toEqual([first, session.tokenId]);
  expect(getLiveAccessTokens(session, 61000).map(token => token.tokenId)).toEqual([session.tokenId]);
  expect(getLiveAccessTokens(session, 62000)).toEqual([]);
});

test('legacy sessions acquire metadata on refresh without inventing their old JWT IDs', () => {
  const session = { refreshToken: 'legacy' };
  expect(isAccessTokenExpired(session, 1000)).toBe(false);
  recordAccessToken(session, 30, 1000);
  expect(session.accessTokens).toEqual([{ tokenId: session.tokenId, expiresAt: 31000 }]);
  expect(isAccessTokenExpired(session, 31000)).toBe(true);
});

test('supports sessions with only the earlier tokenId/expiry format', () => {
  expect(getLiveAccessTokens({ tokenId: 'previous', accessTokenExp: 5000 }, 1000))
    .toEqual([{ tokenId: 'previous', expiresAt: 5000 }]);
});
