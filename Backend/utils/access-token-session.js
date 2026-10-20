const crypto = require('node:crypto');

// Retain every unexpired JWT, including tokens issued before a refresh.
function getLiveAccessTokens(session, now = Date.now()) {
  const tokens = new Map();
  const records = Array.isArray(session?.accessTokens) ? session.accessTokens : [];
  for (const record of [...records, { tokenId: session?.tokenId, expiresAt: session?.accessTokenExp }]) {
    const expiresAt = Number(record?.expiresAt);
    if (typeof record?.tokenId === 'string' && record.tokenId && Number.isFinite(expiresAt) && expiresAt > now) {
      tokens.set(record.tokenId, { tokenId: record.tokenId, expiresAt });
    }
  }
  return [...tokens.values()];
}

function recordAccessToken(session, expirationSeconds, now = Date.now()) {
  const accessTokens = getLiveAccessTokens(session, now);
  session.tokenId = crypto.randomUUID();
  session.accessTokenIssuedAt = now;
  session.accessTokenExp = now + expirationSeconds * 1000;
  session.accessTokens = [...accessTokens, { tokenId: session.tokenId, expiresAt: session.accessTokenExp }];
}

function isAccessTokenExpired(session, now = Date.now()) {
  // Legacy sessions have no access-token expiry metadata: do not label them expired.
  const expiration = Number(session?.accessTokenExp);
  return Number.isFinite(expiration) && expiration > 0 && expiration <= now;
}

module.exports = { getLiveAccessTokens, recordAccessToken, isAccessTokenExpired };
