const Wrapper = require('../wrapper/wrapper.js');
const permit = require('../../../../../services/permit.js');
const { throwGraphQLError } = require('../../../../../utils/graphql-helper.js');

// ─── PERMISSION CHECK HELPER ──────────────────────────────────────────────────

async function requireAdmin(user, res) {
  if (!user) {
    throwGraphQLError(res).message('Unauthorized').status(401).throw();
  }

  // Role management is strictly admin-only — only is_admin grants access
  const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.is_admin);
  if (!permitted) {
    throwGraphQLError(res).message('Admin access required.').status(403).throw();
  }
}

// ─── QUERIES ──────────────────────────────────────────────────────────────────

const Query = {
  listStaffAccounts: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._listStaffAccounts(_, args, context);
  },

  getStaffAccount: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._getStaffAccount(_, args, context);
  },

  searchUsers: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._searchUsers(_, args, context);
  },

  listMedicalPersonnel: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._listMedicalPersonnel(_, args, context);
  },

  getMedicalPersonnel: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._getMedicalPersonnel(_, args, context);
  },

  getStaffPermissions: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._getStaffPermissions(_, args, context);
  },

  getStaffModulePermissions: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._getStaffModulePermissions(_, args, context);
  },

  listStaffSessions: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._listStaffSessions(_, args, context);
  },

  countActiveRefreshTokens: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._countActiveRefreshTokens(_, args, context);
  },

  countActiveUsersInDays: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._countActiveUsersInDays(_, args, context);
  },

  countMaxActiveUsersInHours: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._countMaxActiveUsersInHours(_, args, context);
  },

  listUsers: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._listUsers(_, args, context);
  },

  listUserSessions: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._listUserSessions(_, args, context);
  },

  listUserLoginAttempts: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._listUserLoginAttempts(_, args, context);
  },

  listAllSessions: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._listAllSessions(_, args, context);
  },

  listPermissionTemplates: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._listPermissionTemplates(_, args, context);
  },

  getPermissionTemplate: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._getPermissionTemplate(_, args, context);
  },
};

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

const Mutation = {
  createMedicalPersonnel: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._createMedicalPersonnel(_, args, context);
  },

  updateMedicalPersonnel: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._updateMedicalPersonnel(_, args, context);
  },

  deleteMedicalPersonnel: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._deleteMedicalPersonnel(_, args, context);
  },

  setStaffPermissionsStandard: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._setStaffPermissionsStandard(_, args, context);
  },

  setStaffPermissionsExtended: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._setStaffPermissionsExtended(_, args, context);
  },

  setStaffModulePermissions: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._setStaffModulePermissions(_, args, context);
  },

  updateStaffAccount: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._updateStaffAccount(_, args, context);
  },

  rotateStaffAnchor: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._rotateStaffAnchor(_, args, context);
  },

  revokeUserSession: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._revokeUserSession(_, args, context);
  },

  setUserSessionRevoked: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._setUserSessionRevoked(_, args, context);
  },

  setUserAccountLocked: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._setUserAccountLocked(_, args, context);
  },

  setUserSuperior: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._setUserSuperior(_, args, context);
  },

  createPermissionTemplate: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._createPermissionTemplate(_, args, context);
  },

  updatePermissionTemplate: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._updatePermissionTemplate(_, args, context);
  },

  deletePermissionTemplate: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._deletePermissionTemplate(_, args, context);
  },

  applyTemplateToStaff: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._applyTemplateToStaff(_, args, context);
  },

  initiateAdminTransfer: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._initiateAdminTransfer(_, args, context);
  },

  confirmAdminTransfer: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._confirmAdminTransfer(_, args, context);
  },
};

module.exports = { Query, Mutation };
