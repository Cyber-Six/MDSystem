const express = require("express");
const router = express.Router();

const { jwtProtect } = require("../../config/middleware/jwtProtect.js");
const query = require("../../config/query.js");
const redis = require("../../config/redis.js");
const logger = require("../../utils/logger.js");
const { invalidateNotifPrefCache } = require("../../config/sockets/notification-preferences.js");

// ========================================
// TABLE AUTO-CREATION
// ========================================
// Runs once on backend startup. Uses IF NOT EXISTS so it's safe to call repeatedly.
async function ensureTable() {
  try {
    await query.query(`
      CREATE TABLE IF NOT EXISTS "UsersPreferences" (
        id           INTEGER PRIMARY KEY REFERENCES "UserCredentials"(id) ON DELETE CASCADE,
        appearance   JSONB NOT NULL DEFAULT '{}'::jsonb,
        notification JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await query.query(
      `CREATE INDEX IF NOT EXISTS idx_users_preferences_id ON "UsersPreferences"(id)`
    );
    logger.info('[PREFS] UsersPreferences table ready');
  } catch (err) {
    logger.error('[PREFS] Failed to ensure UsersPreferences table:', err.message);
  }
}
ensureTable();

// ========================================
// CONFIGURATION
// ========================================

// Max size for all preferences combined (in bytes)
const MAX_TOTAL_SIZE = Number(process.env.PREF_MAX_TOTAL_SIZE) || 100 * 1024; // 100KB

// Cache TTL for preferences (in seconds)
const PREFERENCES_CACHE_TTL = Number(process.env.PREF_CACHE_TTL) || 3600; // 1 hour

// ========================================
// CACHE HELPERS
// ========================================

function getPreferencesCacheKey(userId) {
  return `prefs:${userId}`;
}

async function getCachedPreferences(userId) {
  try {
    const key = getPreferencesCacheKey(userId);
    const cached = await redis.getKey(key);
    if (cached) {
      logger.debug(`[PREFS] Cache HIT for userId=${userId}`);
      return JSON.parse(cached);
    }
  } catch (err) {
    logger.warn(`[PREFS] Cache retrieval failed for userId=${userId}:`, err.message);
  }
  return null;
}

async function setCachedPreferences(userId, preferences) {
  try {
    const key = getPreferencesCacheKey(userId);
    await redis.setKey(key, JSON.stringify(preferences), PREFERENCES_CACHE_TTL);
    logger.debug(`[PREFS] Cached preferences for userId=${userId}`);
  } catch (err) {
    logger.warn(`[PREFS] Cache write failed for userId=${userId}:`, err.message);
  }
}

async function invalidatePreferencesCache(userId) {
  try {
    const key = getPreferencesCacheKey(userId);
    await redis.delKey(key);
    logger.debug(`[PREFS] Invalidated cache for userId=${userId}`);
  } catch (err) {
    logger.warn(`[PREFS] Cache invalidation failed for userId=${userId}:`, err.message);
  }
}

// ========================================
// VALIDATION HELPERS
// ========================================

/**
 * Calculate size of an object in bytes (JSON string representation)
 */
function getSizeInBytes(obj) {
  if (!obj) return 0;
  return JSON.stringify(obj).length;
}

/**
 * Validate preference size limit
 */
function validatePreferencesSize(preferences) {
  const size = getSizeInBytes(preferences);
  if (size > MAX_TOTAL_SIZE) {
    return `Preferences exceed max size: ${size} bytes > ${MAX_TOTAL_SIZE} bytes`;
  }
  return null;
}

// ========================================
// ENDPOINTS
// ========================================

/**
 * GET /settings
 * Retrieve user preferences (appearance, notification settings)
 * Protected: jwtProtect("all")
 */
router.get("/", (req, res, next) => {
  // Detect browser navigation: no Authorization header + Accept includes text/html.
  // In that case skip the API handler so the SPA catch-all (app.get('*path')) can
  // serve index.html. This fixes hard-refreshing on the /settings SPA route.
  const hasAuth = Boolean(req.headers.authorization);
  const acceptsHtml = (req.headers.accept || '').includes('text/html');
  if (!hasAuth && acceptsHtml) {
    return next('router');
  }
  next();
}, jwtProtect("all"), async (req, res) => {
  const userId = req.user.id;

  try {
    logger.debug(`[PREFS] GET request userId=${userId}`);

    // Try cache first
    let preferences = await getCachedPreferences(userId);

    // If not cached, fetch from DB
    if (!preferences) {
      preferences = await query.getUserPreferences(userId);

      // If user has no preferences yet, create default empty ones
      if (!preferences) {
        preferences = {
          appearance: {},
          notification: {}
        };
        // Try to create the record in the background (don't fail if it errors)
        try {
          await query.setUserPreferences(userId, preferences);
        } catch (err) {
          logger.warn(`[PREFS] Failed to initialize preferences for userId=${userId}:`, err.message);
        }
      }

      // Cache the result
      await setCachedPreferences(userId, preferences);
    }

    logger.debug(`[PREFS] GET success userId=${userId}`);
    return res.status(200).json({
      ok: true,
      preferences
    });
  } catch (err) {
    logger.error(`[PREFS] GET error userId=${userId}:`, err);
    return res.status(500).json({
      error: "PREFERENCES_FETCH_FAILED",
      message: "Failed to retrieve preferences"
    });
  }
});

/**
 * PUT /settings
 * Update user preferences (appearance, notification settings)
 * Protected: jwtProtect("all")
 *
 * Request body:
 * {
 *   appearance?: { ... },
 *   notification?: { ... }
 * }
 */
router.put("/", jwtProtect("all"), async (req, res) => {
  const userId = req.user.id;
  const { appearance, notification } = req.body;

  try {
    logger.debug(`[PREFS] PUT request userId=${userId}`);

    // Validate input
    if (!appearance && !notification) {
      return res.status(400).json({
        error: "EMPTY_UPDATE",
        message: "At least one preference field (appearance or notification) must be provided"
      });
    }

    // Build updates object
    const updates = {};
    if (appearance !== undefined) updates.appearance = appearance;
    if (notification !== undefined) updates.notification = notification;

    // Validate sizes
    const sizeError = validatePreferencesSize(updates);
    if (sizeError) {
      logger.warn(`[PREFS] Size validation failed userId=${userId}:`, sizeError);
      return res.status(413).json({
        error: "PREFERENCES_TOO_LARGE",
        message: sizeError,
        limits: {
          maxTotalSize: MAX_TOTAL_SIZE
        }
      });
    }

    // Update in database
    const updated = await query.setUserPreferences(userId, updates);

    // Invalidate cache to force fresh fetch
    await invalidatePreferencesCache(userId);
    // Also invalidate the notification-specific cache used by the dispatch layer
    await invalidateNotifPrefCache(userId);

    logger.debug(`[PREFS] PUT success userId=${userId}`);
    return res.status(200).json({
      ok: true,
      preferences: updated,
      message: "Preferences updated successfully"
    });
  } catch (err) {
    logger.error(`[PREFS] PUT error userId=${userId}:`, err);
    return res.status(500).json({
      error: "PREFERENCES_UPDATE_FAILED",
      message: "Failed to update preferences"
    });
  }
});

/**
 * PATCH /settings
 * Partial update of user preferences
 * Protected: jwtProtect("all")
 *
 * Request body:
 * {
 *   appearance?: { ... },
 *   notification?: { ... }
 * }
 */
router.patch("/", jwtProtect("all"), async (req, res) => {
  const userId = req.user.id;
  const { appearance, notification } = req.body;

  try {
    logger.debug(`[PREFS] PATCH request userId=${userId}`);

    // Validate input
    if (!appearance && !notification) {
      return res.status(400).json({
        error: "EMPTY_UPDATE",
        message: "At least one preference field (appearance or notification) must be provided"
      });
    }

    // Fetch current preferences
    let current = await getCachedPreferences(userId);
    if (!current) {
      current = await query.getUserPreferences(userId);
      if (!current) {
        current = { appearance: {}, notification: {} };
      }
    }

    // Merge updates (deep merge for object fields)
    const merged = {
      appearance: appearance ? { ...current.appearance, ...appearance } : current.appearance,
      notification: notification ? { ...current.notification, ...notification } : current.notification
    };

    // Validate merged sizes
    const sizeError = validatePreferencesSize(merged);
    if (sizeError) {
      logger.warn(`[PREFS] Size validation failed userId=${userId}:`, sizeError);
      return res.status(413).json({
        error: "PREFERENCES_TOO_LARGE",
        message: sizeError,
        limits: {
          maxTotalSize: MAX_TOTAL_SIZE
        }
      });
    }

    // Update in database
    const updated = await query.setUserPreferences(userId, merged);

    // Invalidate cache
    await invalidatePreferencesCache(userId);
    await invalidateNotifPrefCache(userId);

    logger.debug(`[PREFS] PATCH success userId=${userId}`);
    return res.status(200).json({
      ok: true,
      preferences: updated,
      message: "Preferences partially updated successfully"
    });
  } catch (err) {
    logger.error(`[PREFS] PATCH error userId=${userId}:`, err);
    return res.status(500).json({
      error: "PREFERENCES_UPDATE_FAILED",
      message: "Failed to update preferences"
    });
  }
});

/**
 * DELETE /settings
 * Reset user preferences to empty defaults
 * Protected: jwtProtect("all")
 */
router.delete("/", jwtProtect("all"), async (req, res) => {
  const userId = req.user.id;

  try {
    logger.debug(`[PREFS] DELETE request userId=${userId}`);

    const reset = {
      appearance: {},
      notification: {}
    };

    await query.setUserPreferences(userId, reset);
    await invalidatePreferencesCache(userId);
    await invalidateNotifPrefCache(userId);

    logger.debug(`[PREFS] DELETE success userId=${userId}`);
    return res.status(200).json({
      ok: true,
      preferences: reset,
      message: "Preferences reset successfully"
    });
  } catch (err) {
    logger.error(`[PREFS] DELETE error userId=${userId}:`, err);
    return res.status(500).json({
      error: "PREFERENCES_RESET_FAILED",
      message: "Failed to reset preferences"
    });
  }
});

module.exports = router;
