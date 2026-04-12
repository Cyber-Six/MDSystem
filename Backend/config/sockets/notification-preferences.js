const logger = require('../../utils/logger');
const query = require('../query');
const redis = require('../redis');

// ── Event-name → module-key mapping ─────────────────────────────────────────
// Maps Socket.IO event prefixes to the notification module keys used in
// user preferences. The first matching prefix wins.
const EVENT_MODULE_MAP = [
  ['appointment:',            'appointments'],
  ['healthchat:',             'healthChat'],
  ['medicine:request:',       'medicineRequests'],
  ['medicine:prescription:',  'medicineRequests'],
  ['document:',               'documents'],
  ['updateTicket',            'emr'],
  ['inventory:',              'inventory'],
  ['admin:notification',      'general'],
  ['staff:notification',      'general'],
  ['role:',                   'roleManagement'],
];

/**
 * Resolve socket event name to a notification module key.
 * Returns 'general' if no specific mapping is found.
 *
 * @param {string} eventName
 * @returns {string}
 */
function resolveModuleFromEvent(eventName) {
  for (const [prefix, moduleKey] of EVENT_MODULE_MAP) {
    if (eventName.startsWith(prefix)) return moduleKey;
  }
  return 'general';
}

// ── Default channel preferences ─────────────────────────────────────────────
const DEFAULT_CHANNELS = {
  web: true,          // Web/socket notifications enabled by default
  email: false,       // Direct email notifications off by default
  emailFallback: true // Email sent when user is offline — enabled by default
};

const MODULE_KEYS = [
  'appointments', 'healthChat', 'medicineRequests', 'documents',
  'emr', 'inventory', 'roleManagement', 'general',
];

/**
 * Build the default moduleChannels object.
 */
function getDefaultModuleChannels() {
  const mc = {};
  for (const key of MODULE_KEYS) {
    mc[key] = { ...DEFAULT_CHANNELS };
  }
  return mc;
}

// Cache TTL for notification preferences (seconds).
// Shorter than the general prefs cache since these are queried on every
// notification dispatch and must react to changes relatively quickly.
const NOTIF_PREF_CACHE_TTL = 300; // 5 minutes

function cacheKey(userId) {
  return `notif-pref:${userId}`;
}

/**
 * Retrieve effective notification channel preferences for a user.
 *
 * Resolution order:
 *   1. Redis cache (5 min TTL)
 *   2. DB (UsersPreferences.notification)
 *   3. Defaults (web + emailFallback on; email off)
 *
 * @param {string|number} userId
 * @returns {Promise<{ channels: object, moduleChannels: object }>}
 */
async function getNotificationPreferences(userId) {
  try {
    // 1. Try cache
    const cached = await redis.getKey(cacheKey(userId));
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.channels) return parsed;
    }
  } catch (err) {
    logger.warn(`[NOTIF_PREF] Cache read failed for userId=${userId}: ${err.message}`);
  }

  let channels = { ...DEFAULT_CHANNELS };
  let moduleChannels = getDefaultModuleChannels();

  try {
    // 2. Try DB
    const prefs = await query.getUserPreferences(userId);
    if (prefs?.notification) {
      const n = prefs.notification;

      // Global channels
      if (n.channels && typeof n.channels === 'object') {
        if (typeof n.channels.web === 'boolean')           channels.web = n.channels.web;
        if (typeof n.channels.email === 'boolean')         channels.email = n.channels.email;
        if (typeof n.channels.emailFallback === 'boolean') channels.emailFallback = n.channels.emailFallback;
      }

      // Per-module overrides
      if (n.moduleChannels && typeof n.moduleChannels === 'object') {
        for (const key of MODULE_KEYS) {
          if (n.moduleChannels[key] && typeof n.moduleChannels[key] === 'object') {
            const mc = n.moduleChannels[key];
            moduleChannels[key] = {
              web:           typeof mc.web === 'boolean' ? mc.web : channels.web,
              email:         typeof mc.email === 'boolean' ? mc.email : channels.email,
              emailFallback: typeof mc.emailFallback === 'boolean' ? mc.emailFallback : channels.emailFallback,
            };
          }
        }
      }
    }
  } catch (err) {
    logger.warn(`[NOTIF_PREF] DB read failed for userId=${userId}, using defaults: ${err.message}`);
  }

  const result = { channels, moduleChannels };

  // 3. Cache
  try {
    await redis.setKey(cacheKey(userId), JSON.stringify(result), NOTIF_PREF_CACHE_TTL);
  } catch (err) {
    logger.warn(`[NOTIF_PREF] Cache write failed for userId=${userId}: ${err.message}`);
  }

  return result;
}

/**
 * Invalidate the notification preferences cache for a user.
 * Called from the settings route when preferences are updated.
 *
 * @param {string|number} userId
 */
async function invalidateNotifPrefCache(userId) {
  try {
    await redis.delKey(cacheKey(userId));
  } catch (err) {
    logger.warn(`[NOTIF_PREF] Cache invalidation failed for userId=${userId}: ${err.message}`);
  }
}

/**
 * Determine which channels are allowed for a specific event and user.
 *
 * @param {string|number} userId
 * @param {string}        eventName
 * @returns {Promise<{ web: boolean, email: boolean, emailFallback: boolean }>}
 */
async function resolveChannelsForEvent(userId, eventName) {
  const moduleKey = resolveModuleFromEvent(eventName);
  const { channels, moduleChannels } = await getNotificationPreferences(userId);

  // Per-module settings override the global channels.
  // If the module has explicit settings, use those; otherwise fall back to global.
  const mc = moduleChannels[moduleKey] || channels;

  return {
    web: mc.web !== false,
    email: mc.email === true,
    emailFallback: mc.emailFallback !== false,
  };
}

module.exports = {
  resolveModuleFromEvent,
  getNotificationPreferences,
  invalidateNotifPrefCache,
  resolveChannelsForEvent,
  DEFAULT_CHANNELS,
  MODULE_KEYS,
  getDefaultModuleChannels,
};
