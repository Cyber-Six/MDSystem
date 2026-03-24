/**
 * Expo Push Token Route
 *
 * Allows the mobile app to register/unregister its Expo push token
 * so the backend can send remote push notifications when the patient is offline.
 *
 * POST   /auth/push-token  — Register or update the token for the authenticated patient
 * DELETE /auth/push-token  — Remove the token (call on logout)
 */

const express = require('express');
const { Expo } = require('expo-server-sdk');
const { jwtProtect } = require('../../../config/middleware/jwtProtect');
const { savePushToken, deletePushToken } = require('../../../config/sockets/notification-store');
const logger = require('../../../utils/logger');

const router = express.Router();

// POST /auth/push-token
router.post('/', jwtProtect('patient'), async (req, res) => {
  const { token } = req.body;
  const userId = req.user?.id;

  if (!token) {
    return res.status(400).json({ error: 'MISSING_TOKEN', message: 'Push token is required.' });
  }
  if (!Expo.isExpoPushToken(token)) {
    return res.status(400).json({ error: 'INVALID_TOKEN', message: 'Invalid Expo push token format.' });
  }

  await savePushToken(String(userId), token);
  logger.info(`[PUSH_TOKEN] Registered token for user:${userId}`);
  return res.json({ success: true });
});

// DELETE /auth/push-token
router.delete('/', jwtProtect('patient'), async (req, res) => {
  const userId = req.user?.id;
  await deletePushToken(String(userId));
  logger.info(`[PUSH_TOKEN] Unregistered token for user:${userId}`);
  return res.json({ success: true });
});

module.exports = router;
