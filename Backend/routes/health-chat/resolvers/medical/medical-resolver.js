const Wrapper = require("../wrapper/wrapper.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const { isMedicalPermitted, permissions,
  isMedicalPermittedPatientBased, isMedicalAdmin, getStaffBranch } = require("../../../../services/permit.js");
const { getPatientIdFromChatId } = require("../wrapper/helper.js");

/** Clamp a requested location to the staff member's actual branch designation.
 * Reads from MedicalPersonnel.designation (authoritative) rather than rolesMap.branch
 * so the restriction holds even when permissions were stored with branch='Both'.
 */
const clampLocationAsync = async (userId, requested) => {
  const staffBranch = await getStaffBranch(userId);
  return (staffBranch && staffBranch !== 'Both') ? staffBranch : (requested || 'Both');
};

/** Synchronous version kept for any call site that already has the branch value. */
const clampLocation = (requested, staffBranch) =>
  (staffBranch && staffBranch !== 'Both') ? staffBranch : (requested || 'Both');

const Query = {
  getPendingTickets: async (_, { location='Both', offset, limit }, { user, res }) => {
    const { permitted } = await isMedicalPermitted(user.id, permissions.health_chat_allow_access);
    if (!permitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    const effectiveLoc = await clampLocationAsync(user.id, location);
    return await Wrapper.Query._getPendingTickets(_, { location: effectiveLoc, offset, limit }, { user, res });
  },

  getActiveTickets: async (_, { location='Both', offset, limit }, { user, res }) => {
    const { permitted } = await isMedicalPermitted(user.id, permissions.health_chat_allow_access);
    if (!permitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    const effectiveLoc = await clampLocationAsync(user.id, location);
    return await Wrapper.Query._getActiveTickets(_, { location: effectiveLoc, offset, limit }, { user, res });
  },

  getAllTickets: async (_, { location='Both', status, offset, limit }, { user, res }) => {
    const { permitted } = await isMedicalPermitted(user.id, permissions.health_chat_allow_access);
    if (!permitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    const effectiveLoc = await clampLocationAsync(user.id, location);
    return await Wrapper.Query._getAllTickets(_, { location: effectiveLoc, status, offset, limit }, { user, res });
  },

  getTicket: async (_, { chatId }, { user, res }) => {
    const patientId = await getPatientIdFromChatId(chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    return await Wrapper.Query._getTicket(_, { chatId }, { user, res });
  },

  getMessages: async (_, { chatId, offset, limit }, { user, res }) => {
    const patientId = await getPatientIdFromChatId(chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Query._getMessages(_, { chatId, offset, limit }, { user, res });
  },

  getPatientConversations: async (_, { location='Both', statuses, offset, limit}, { user, res }) => {
    const { permitted } = await isMedicalPermitted(user.id, permissions.health_chat_allow_access);
    if (!permitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    const effectiveLoc = await clampLocationAsync(user.id, location);
    return await Wrapper.Query._getPatientConversations(_, { location: effectiveLoc, statuses, offset, limit}, { user, res });
  },

  getPatientMessages: async (_, args, { user, res }) => {
    // Use the non-patient-based check: health chat is globally accessible to any
    // staff with health_chat_allow_access. The branch restriction is already
    // enforced at the conversation-list level (getPatientConversations uses
    // clampLocationAsync) so an extra branch cross-match here would produce false
    // 403s when, e.g., a patient's UsersPersonal.branch differs from the staff's
    // rolesMap.branch (e.g. staff=Manila permission, patient assigned to Both).
    const { permitted } = await isMedicalPermitted(user.id, permissions.health_chat_allow_access);
    if (!permitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Query._getPatientMessages(_, args, { user, res });
  }
};

const Mutation = {
  approveTicket: async (_, args, { user, res }) => {
    const patientId = await getPatientIdFromChatId(args.input.chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Mutation._approveTicket(_, args, { user, res });
  },

  rejectTicket: async (_, args, { user, res }) => {
    const patientId = await getPatientIdFromChatId(args.chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Mutation._rejectTicket(_, args, { user, res });
  },

  sendMedicalMessage: async (_, args, { user, res }) => {
    const patientId = await getPatientIdFromChatId(args.input.chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Mutation._sendMedicalMessage(_, args, { user, res });
  },

  closeTicket: async (_, args, { user, res }) => {
    const patientId = await getPatientIdFromChatId(args.input.chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Mutation._closeTicket(_, args, { user, res });
  },

  transferTicket: async (_, { chatId, toMedicalId }, { user, res }) => {
    const patientId = await getPatientIdFromChatId(chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    const isNewPermitted = await isMedicalPermittedPatientBased(toMedicalId, permissions.health_chat_allow_access, patientId);
    if (!isNewPermitted) {
      throwGraphQLError(res).message("New Medical Personnel does not have enough permission to transfer").status(403).throw();
    }

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
