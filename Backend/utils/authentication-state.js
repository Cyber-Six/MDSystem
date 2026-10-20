const { getCredentialLockStateByUserId, isActiveMedicalPersonnel } = require('../config/query');

// Unverified patients must still be able to complete registration. A manual
// account lock, deleted account or removed staff membership cannot renew access.
async function assertAccountAllowed(userId, role) {
  const account = await getCredentialLockStateByUserId(userId);
  if (!account) throw new Error('Account unavailable');
  if (String(account.status).toLowerCase() === 'locked') throw new Error('Account locked');
  if (role === 'medical' && !await isActiveMedicalPersonnel(userId)) {
    throw new Error('Staff session invalidated');
  }
}

module.exports = { assertAccountAllowed };
