const redis = require('../redis');
const logger = require('../../utils/logger');

const NOTIF_PENDING_TTL = () => Number(process.env.NOTIF_PENDING_TTL) || 604800; // 7 days
const NOTIF_MAX_PENDING = () => Number(process.env.NOTIF_MAX_PENDING) || 100;

/**
 * Generate a lightweight unique notification ID without external dependencies.
 * @returns {string}
 */
function makeNotifId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Persist a notification for a user who is currently offline.
 *
 * Memory efficiency notes:
 * - One Redis key per user (`notif:pending:{userId}`), no sentinel keys.
 * - RPUSH + EXPIRE + LTRIM are batched into a single pipeline round trip.
 * - LTRIM always runs with a negative-index cap (`-max, -1`), keeping only
 *   the most recent N items with no conditional overhead.
 *
 * @param {string} userId
 * @param {string} event   - Socket event name (e.g. 'appointment:updated')
 * @param {*}      data    - Payload (must be JSON-serialisable)
 */
async function pushPending(userId, event, data) {
  const key = `notif:pending:${userId}`;
  const item = JSON.stringify({ id: makeNotifId(), event, data, ts: Date.now() });
  const max = NOTIF_MAX_PENDING();
  const ttl = NOTIF_PENDING_TTL();

  try {
    // Single pipeline: push → refresh TTL → trim to cap
    await redis.getClient().multi()
      .rPush(key, item)
      .expire(key, ttl)
      .lTrim(key, -max, -1) // keep the most recent `max` items; no-op when under cap
      .exec();

    logger.debug(`[NOTIF] Queued "${event}" for offline user:${userId}`);
  } catch (err) {
    logger.error(`[NOTIF] Failed to queue "${event}" for user:${userId}:`, err.message);
  }
}

/**
 * Atomically retrieve and delete all pending notifications for a user.
 * Uses MULTI/EXEC so concurrent flushes (e.g. user opens two tabs simultaneously)
 * cannot result in double-delivery — only the first caller gets the list.
 *
 * @param {string} userId
 * @returns {Promise<Array<{ id: string, event: string, data: *, ts: number }>>}
 */
async function flushPending(userId) {
  const key = `notif:pending:${userId}`;

  try {
    const raw = await redis.lRangeDelKey(key);
    if (!raw || raw.length === 0) return [];

    const notifications = raw.map((item) => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    }).filter(Boolean);

    if (notifications.length > 0) {
      logger.debug(`[NOTIF] Flushed ${notifications.length} pending notification(s) for user:${userId}`);
    }

    return notifications;
  } catch (err) {
    logger.error(`[NOTIF] Failed to flush pending notifications for user:${userId}:`, err.message);
    return [];
  }
}

/**
 * Return the number of pending notifications without removing them.
 * Useful for badge counts or health checks.
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function getPendingCount(userId) {
  try {
    return await redis.lLenKey(`notif:pending:${userId}`);
  } catch (err) {
    logger.error(`[NOTIF] Failed to get pending count for user:${userId}:`, err.message);
    return 0;
  }
}

module.exports = { pushPending, flushPending, getPendingCount };

// ── Expo Push Token Store ─────────────────────────────────────────────────────
// Tokens are stored in Redis with a 30-day TTL.
// Key format: push-token:{userId}

const PUSH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Persist an Expo push token for a user.
 * Overwrites any previously stored token.
 *
 * @param {string} userId
 * @param {string} token  - ExponentPushToken[...]
 */
async function savePushToken(userId, token) {
  try {
    await redis.getClient().set(`push-token:${userId}`, token, { EX: PUSH_TOKEN_TTL });
    logger.debug(`[PUSH_TOKEN] Saved token for user:${userId}`);
  } catch (err) {
    logger.error(`[PUSH_TOKEN] Failed to save token for user:${userId}: ${err.message}`);
  }
}

/**
 * Retrieve the stored Expo push token for a user.
 *
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
async function getPushToken(userId) {
  try {
    return await redis.getClient().get(`push-token:${userId}`);
  } catch (err) {
    logger.error(`[PUSH_TOKEN] Failed to get token for user:${userId}: ${err.message}`);
    return null;
  }
}

/**
 * Remove the stored Expo push token for a user (called on logout).
 *
 * @param {string} userId
 */
async function deletePushToken(userId) {
  try {
    await redis.getClient().del(`push-token:${userId}`);
    logger.debug(`[PUSH_TOKEN] Deleted token for user:${userId}`);
  } catch (err) {
    logger.error(`[PUSH_TOKEN] Failed to delete token for user:${userId}: ${err.message}`);
  }
}

Object.assign(module.exports, { savePushToken, getPushToken, deletePushToken });
