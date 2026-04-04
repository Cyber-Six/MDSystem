const Wrapper = require("../wrapper/wrapper.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const { isMedicalPermitted, permissions, isMedicalPermittedLocationBased,
  isMedicalPermittedPatientBased, isMedicalAdmin } = require("../../../../services/permit.js");
const { getPatientIdFromChatId } = require("../wrapper/helper.js");

const Query = {
  getPendingTickets: async (_, { location='Both', offset, limit }, { user, res }) => {
    const isPermitted = await isMedicalPermittedLocationBased(user.id, permissions.health_chat_allow_access, location);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    return await Wrapper.Query._getPendingTickets(_, { location, offset, limit }, { user, res });
  },

  getActiveTickets: async (_, { location='Both', offset, limit }, { user, res }) => {
    const isPermitted = await isMedicalPermittedLocationBased(user.id, permissions.health_chat_allow_access, location);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    return await Wrapper.Query._getActiveTickets(_, { location, offset, limit }, { user, res });
  },

  getAllTickets: async (_, { location='Both', status, offset, limit }, { user, res }) => {
    const isPermitted = await isMedicalPermittedLocationBased(user.id, permissions.health_chat_allow_access, location);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    return await Wrapper.Query._getAllTickets(_, { location, status, offset, limit }, { user, res });
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
    const isPermitted = await isMedicalPermittedLocationBased(user.id, permissions.health_chat_allow_access, location);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Query._getPatientConversations(_, { location, statuses, offset, limit}, { user, res });
  },

  getPatientMessages: async (_, args, { user, res }) => {
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, args.patientId);
    if (!isPermitted) {
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

  deleteArchivedTicket: async (_, args, { user, res }) => {
    const patientId = await getPatientIdFromChatId(args.chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    return await Wrapper.Mutation._deleteArchivedTicket(_, args, { user, res });
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
