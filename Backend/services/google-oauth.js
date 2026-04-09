const { OAuth2Client } = require('google-auth-library');
const logger = require('../utils/logger.js');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

let _client = null;

/**
 * Lazily create the OAuth2Client singleton.
 * This avoids instantiation at import time when GOOGLE_CLIENT_ID may not yet
 * be loaded from .env (dotenv runs later in the startup sequence).
 */
function getClient() {
  if (!_client) {
    const clientId = process.env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured');
    }
    _client = new OAuth2Client(clientId);
  }
  return _client;
}

/**
 * Verify a Google ID token returned by the client-side Google Sign-In flow.
 *
 * Security:
 *  - Validates token signature against Google's public keys (auto-fetched & cached)
 *  - Enforces audience === GOOGLE_CLIENT_ID (prevents token substitution attacks)
 *  - Checks `email_verified` claim (rejects unverified Google accounts)
 *  - Enforces `hd` (hosted domain) === 'tip.edu.ph' for institutional accounts
 *
 * @param {string} idToken - The credential string from Google Sign-In
 * @returns {Promise<{email: string, name: string, picture: string, googleId: string} | null>}
 *          Verified payload or null on failure
 */
async function verifyGoogleToken(idToken) {
  try {
    if (!idToken || typeof idToken !== 'string') {
      logger.warn('Google OAuth: missing or invalid idToken');
      return null;
    }

    const client = getClient();
    const clientId = process.env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;

    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });

    const payload = ticket.getPayload();

    // Reject unverified emails
    if (!payload.email_verified) {
      logger.warn(`Google OAuth: unverified email attempt — ${payload.email}`);
      return null;
    }

    // Enforce TIP institutional domain (hosted domain claim)
    if (payload.hd !== 'tip.edu.ph') {
      logger.warn(`Google OAuth: non-TIP domain rejected — hd=${payload.hd}, email=${payload.email}`);
      return null;
    }

    // Double-check email suffix (defense in depth — hd claim can be spoofed in edge cases)
    if (!payload.email.endsWith('@tip.edu.ph')) {
      logger.warn(`Google OAuth: email domain mismatch — ${payload.email}`);
      return null;
    }

    return {
      email: payload.email.toLowerCase(),
      name: payload.name || '',
      picture: payload.picture || '',
      googleId: payload.sub,
    };
  } catch (err) {
    logger.error('Google OAuth: token verification failed —', err.message);
    return null;
  }
}

module.exports = { verifyGoogleToken };
