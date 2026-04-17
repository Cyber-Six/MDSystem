const Wrapper = require("../wrapper/wrapper.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const db = require("../../../../config/query.js");
const { isMedicalPermitted, permissions,
  isMedicalPermittedPatientBased, isMedicalAdmin, getStaffBranch } = require("../../../../services/permit.js");
const { getPatientIdFromChatId } = require("../wrapper/helper.js");

const HEALTH_CHAT_BRANCHES = Object.freeze(['Manila', 'QuezonCity']);

const branchToSet = (branch = 'Both') => {
  if (branch === 'Manila') return new Set(['Manila']);
  if (branch === 'QuezonCity') return new Set(['QuezonCity']);
  return new Set(HEALTH_CHAT_BRANCHES);
};

const setToBranch = (branchSet) => {
  const hasManila = branchSet.has('Manila');
  const hasQuezon = branchSet.has('QuezonCity');

  if (hasManila && hasQuezon) return 'Both';
  if (hasManila) return 'Manila';
  if (hasQuezon) return 'QuezonCity';
  return null;
};

const branchAllowsPatient = (staffBranch, patientBranch) => {
  return staffBranch === 'Both' || patientBranch === 'Both' || staffBranch === patientBranch;
};

async function getPatientBranch(patientId) {
  const result = await db.query(
    `SELECT branch
     FROM "UsersPersonal"
     WHERE id = $1
     LIMIT 1`,
    [patientId]
  );
  return result.rows[0]?.branch || null;
}

async function resolveEffectiveLocationScope({ userId, requestedLocation = 'Both', permissionBranch = 'Both' }) {
  const isAdminUser = await isMedicalAdmin(userId);
  if (isAdminUser) {
    return requestedLocation || 'Both';
  }

  const staffBranch = await getStaffBranch(userId);

  const requestedSet = branchToSet(requestedLocation || 'Both');
  const designationSet = branchToSet(staffBranch || 'Both');
  const permissionSet = branchToSet(permissionBranch || 'Both');

  const effectiveSet = new Set(
    [...requestedSet].filter((branch) => designationSet.has(branch) && permissionSet.has(branch))
  );

  return setToBranch(effectiveSet);
}

async function assertDesignationScopeForPatient({ userId, patientId, res }) {
  const isAdminUser = await isMedicalAdmin(userId);
  if (isAdminUser) {
    return;
  }

  const [staffBranch, patientBranch] = await Promise.all([
    getStaffBranch(userId),
    getPatientBranch(patientId),
  ]);

  if (!patientBranch) {
    throwGraphQLError(res).message("Patient not found").status(404).throw();
  }

  if (!branchAllowsPatient(staffBranch || 'Both', patientBranch)) {
    throwGraphQLError(res).message("Access denied by branch scope").status(403).throw();
  }
}

async function assertTargetDesignationScopeForPatient({ staffId, patientId, res }) {
  const [staffBranch, patientBranch] = await Promise.all([
    getStaffBranch(staffId),
    getPatientBranch(patientId),
  ]);

  if (!patientBranch) {
    throwGraphQLError(res).message("Patient not found").status(404).throw();
  }

  if (!branchAllowsPatient(staffBranch || 'Both', patientBranch)) {
    throwGraphQLError(res)
      .message("Target staff branch does not match the patient's branch scope")
      .status(403)
      .throw();
  }
}

const Query = {
  getPendingTickets: async (_, { location='Both', offset, limit }, { user, res }) => {
    const { permitted, branch } = await isMedicalPermitted(user.id, permissions.health_chat_allow_access);
    if (!permitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    const effectiveLoc = await resolveEffectiveLocationScope({
      userId: user.id,
      requestedLocation: location,
      permissionBranch: branch,
    });
    if (!effectiveLoc) {
      throwGraphQLError(res).message("Access denied by branch scope").status(403).throw();
    }

    return await Wrapper.Query._getPendingTickets(_, { location: effectiveLoc, offset, limit }, { user, res });
  },

  getActiveTickets: async (_, { location='Both', offset, limit }, { user, res }) => {
    const { permitted, branch } = await isMedicalPermitted(user.id, permissions.health_chat_allow_access);
    if (!permitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    const effectiveLoc = await resolveEffectiveLocationScope({
      userId: user.id,
      requestedLocation: location,
      permissionBranch: branch,
    });
    if (!effectiveLoc) {
      throwGraphQLError(res).message("Access denied by branch scope").status(403).throw();
    }

    return await Wrapper.Query._getActiveTickets(_, { location: effectiveLoc, offset, limit }, { user, res });
  },

  getAllTickets: async (_, { location='Both', status, offset, limit }, { user, res }) => {
    const { permitted, branch } = await isMedicalPermitted(user.id, permissions.health_chat_allow_access);
    if (!permitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    const effectiveLoc = await resolveEffectiveLocationScope({
      userId: user.id,
      requestedLocation: location,
      permissionBranch: branch,
    });
    if (!effectiveLoc) {
      throwGraphQLError(res).message("Access denied by branch scope").status(403).throw();
    }

    return await Wrapper.Query._getAllTickets(_, { location: effectiveLoc, status, offset, limit }, { user, res });
  },

  getTicket: async (_, { chatId }, { user, res }) => {
    const patientId = await getPatientIdFromChatId(chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    await assertDesignationScopeForPatient({ userId: user.id, patientId, res });

    return await Wrapper.Query._getTicket(_, { chatId }, { user, res });
  },

  getMessages: async (_, { chatId, offset, limit }, { user, res }) => {
    const patientId = await getPatientIdFromChatId(chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    await assertDesignationScopeForPatient({ userId: user.id, patientId, res });

    return await Wrapper.Query._getMessages(_, { chatId, offset, limit }, { user, res });
  },

  getPatientConversations: async (_, { location='Both', statuses, searchTerm, offset, limit}, { user, res }) => {
    const { permitted, branch } = await isMedicalPermitted(user.id, permissions.health_chat_allow_access);
    if (!permitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    const effectiveLoc = await resolveEffectiveLocationScope({
      userId: user.id,
      requestedLocation: location,
      permissionBranch: branch,
    });
    if (!effectiveLoc) {
      throwGraphQLError(res).message("Access denied by branch scope").status(403).throw();
    }

    return await Wrapper.Query._getPatientConversations(_, { location: effectiveLoc, statuses, searchTerm, offset, limit}, { user, res });
  },

  getPatientMessages: async (_, args, { user, res }) => {
    const isPermitted = await isMedicalPermittedPatientBased(
      user.id,
      permissions.health_chat_allow_access,
      args.patientId
    );
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    await assertDesignationScopeForPatient({ userId: user.id, patientId: args.patientId, res });

    return await Wrapper.Query._getPatientMessages(_, args, { user, res });
  },

  getTransferCandidates: async (_, { chatId }, { user, res }) => {
    const patientId = await getPatientIdFromChatId(chatId);
    if (patientId) {
      const isPermitted = await isMedicalPermittedPatientBased(
        user.id,
        permissions.health_chat_allow_access,
        patientId
      );
      if (!isPermitted) {
        throwGraphQLError(res).message("Access denied").status(403).throw();
      }

      await assertDesignationScopeForPatient({ userId: user.id, patientId, res });
    }

    return await Wrapper.Query._getTransferCandidates(_, { chatId }, { user, res });
  }
};

const Mutation = {
  approveTicket: async (_, args, { user, res }) => {
    const patientId = await getPatientIdFromChatId(args.input.chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    await assertDesignationScopeForPatient({ userId: user.id, patientId, res });

    return await Wrapper.Mutation._approveTicket(_, args, { user, res });
  },

  rejectTicket: async (_, args, { user, res }) => {
    const patientId = await getPatientIdFromChatId(args.chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    await assertDesignationScopeForPatient({ userId: user.id, patientId, res });

    return await Wrapper.Mutation._rejectTicket(_, args, { user, res });
  },

  sendMedicalMessage: async (_, args, { user, res }) => {
    const patientId = await getPatientIdFromChatId(args.input.chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    await assertDesignationScopeForPatient({ userId: user.id, patientId, res });

    return await Wrapper.Mutation._sendMedicalMessage(_, args, { user, res });
  },

  closeTicket: async (_, args, { user, res }) => {
    const patientId = await getPatientIdFromChatId(args.input.chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    await assertDesignationScopeForPatient({ userId: user.id, patientId, res });

    return await Wrapper.Mutation._closeTicket(_, args, { user, res });
  },

  transferTicket: async (_, { chatId, toMedicalId }, { user, res }) => {
    const patientId = await getPatientIdFromChatId(chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    await assertDesignationScopeForPatient({ userId: user.id, patientId, res });

    const isNewPermitted = await isMedicalPermittedPatientBased(toMedicalId, permissions.health_chat_allow_access, patientId);
    if (!isNewPermitted) {
      throwGraphQLError(res).message("New Medical Personnel does not have enough permission to transfer").status(403).throw();
    }

    await assertTargetDesignationScopeForPatient({ staffId: toMedicalId, patientId, res });

    return await Wrapper.Mutation._transferTicket(_, { chatId, toMedicalId }, { user, res });
  },

  takeoverOngoingTicket: async (_, { chatId }, { user, res }) => {
    const isPermitted = await isMedicalAdmin(user.id);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Mutation._takeoverOngoingTicket(_, { chatId }, { user, res });
  },

  expireOldTickets: async (_, args, { user, res }) => {
    return await Wrapper.Mutation._expireOldTickets(_, args, { user, res });
  },

  extendSession: async (_, args, { user, res }) => {
    return await Wrapper.Mutation._extendSession(_, args, { user, res });
  }
};

module.exports = { Query, Mutation };
