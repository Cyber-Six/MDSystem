const Wrapper = require('../wrapper/wrapper.js');
const permit = require('../../../../services/permit.js');
const { throwGraphQLError } = require('../../../../utils/graphql-helper.js');

// ─── PERMISSION CHECK HELPER ──────────────────────────────────────────────────

async function requireAdmin(user, res) {
  if (!user) {
    throwGraphQLError(res).message('Unauthorized').status(401).throw();
  }

  const isAdmin = await permit.isMedicalPermitted(user.id, permit.permissions.is_admin, null);
  if (!isAdmin) {
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

  listStaffSessions: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Query._listStaffSessions(_, args, context);
  },
};

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

const Mutation = {
  updateStaffAccount: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._updateStaffAccount(_, args, context);
  },

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

  setStaffPermissions: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._setStaffPermissions(_, args, context);
  },

  rotateStaffAnchor: async (_, args, context) => {
    await requireAdmin(context.user, context.res);
    return await Wrapper.Mutation._rotateStaffAnchor(_, args, context);
  },
};

module.exports = { Query, Mutation };
