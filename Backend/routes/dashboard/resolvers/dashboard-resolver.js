const Wrapper = require('./wrapper.js');
const { throwGraphQLError } = require('../../../utils/graphql-helper.js');
const permit = require('../../../services/permit.js');

// ─── PERMISSION CHECK HELPER ──────────────────────────────────────────────────

async function requireStaff(user, res) {
  if (!user) {
    throwGraphQLError(res).message('Unauthorized').status(401).throw();
  }

  // Dashboard requires is_staff permission
  const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.is_staff);
  if (!permitted) {
    throwGraphQLError(res).message('Staff access required.').status(403).throw();
  }
}

// ─── QUERIES ──────────────────────────────────────────────────────────────────

const Query = {
  getDashboardStats: async (_, args, context) => {
    await requireStaff(context.user, context.res);
    return await Wrapper.Query._getDashboardStats(_, args, context);
  },
};

module.exports = { Query };
