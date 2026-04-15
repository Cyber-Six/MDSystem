const express = require('express');
const router = express.Router();
const { jwtProtect } = require('../../../config/middleware/jwtProtect');
const { findUserByEmail, updateUserPasswordById, findEmailByUserId, query } = require('../../../config/query');
const { verifyPassword } = require('../../../utils/security');
const logger = require('../../../utils/logger');

// POST /auth/user/change-password
router.post('/change-password', jwtProtect('patient'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, message: 'Current password and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ ok: false, message: 'New password must be at least 8 characters.' });
    }

    const email = await findEmailByUserId(req.user.id);
    if (!email) {
      return res.status(404).json({ ok: false, message: 'User not found.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found.' });
    }

    const isMatch = await verifyPassword(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ ok: false, message: 'Current password is incorrect.' });
    }

    await updateUserPasswordById(req.user.id, newPassword);

    logger.info(`[AUTH] Password changed userId=${req.user.id}`);
    return res.json({ ok: true, message: 'Password changed successfully.' });
  } catch (err) {
    logger.error('[AUTH] Change password error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error.' });
  }
});

// GET /auth/user/login-activity
router.get('/login-activity', jwtProtect('patient'), async (req, res) => {
  try {
    const columnSql = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'UserLoginAttempt';
    `;
    const columnResult = await query(columnSql);
    const availableColumns = new Set(columnResult.rows.map((row) => row.column_name));

    const timestampColumn = availableColumns.has('attempted_at')
      ? 'attempted_at'
      : (availableColumns.has('created_at') ? 'created_at' : null);

    if (!timestampColumn) {
      logger.error('[AUTH] Login activity error: UserLoginAttempt has no attempted_at/created_at column.');
      return res.status(500).json({ ok: false, message: 'Internal server error.' });
    }

    const ipAddressSelect = availableColumns.has('ip_address')
      ? 'ip_address'
      : 'NULL::text AS ip_address';
    const userAgentSelect = availableColumns.has('user_agent')
      ? 'user_agent'
      : 'NULL::text AS user_agent';
    const typeFilter = availableColumns.has('type') ? `AND type = 'Patient'` : '';

    const sql = `
      SELECT id, was_successful, ${timestampColumn} AS login_at, ${ipAddressSelect}, ${userAgentSelect}
      FROM "UserLoginAttempt"
      WHERE user_id = $1
      ${typeFilter}
      ORDER BY login_at DESC
      LIMIT 50;
    `;
    const result = await query(sql, [req.user.id]);

    const sessions = result.rows.map((row) => ({
      id: String(row.id),
      wasSuccessful: Boolean(row.was_successful),
      timestamp: row.login_at,
      ipAddress: row.ip_address || null,
      userAgent: row.user_agent || null,
    }));

    return res.json({ ok: true, sessions });
  } catch (err) {
    logger.error('[AUTH] Login activity error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error.' });
  }
});

module.exports = router;
