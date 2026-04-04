const Wrapper = require("../wrapper/wrapper.js");
const { isMedicalPermitted, permissions, isMedicalPermittedLocationBased, 
  isMedicalPermittedPatientBased, isMedicalAdmin } = require("../../../../services/permit.js");
const { getPatientIdFromChatId } = require("../wrapper/helper.js");

const Query = {
  getPendingTickets: async (_, { location='Both', offset, limit }, context) => {
    
    const isPermitted = await isMedicalPermittedLocationBased(user.id, permissions.health_chat_allow_access, args.location);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    return await Wrapper.Query._getPendingTickets(_, { location, offset, limit }, context);
  },

  getActiveTickets: async (_, { location='Both', offset, limit }, context) => {
    const isPermitted = await isMedicalPermittedLocationBased(user.id, permissions.health_chat_allow_access, args.location);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    return await Wrapper.Query._getActiveTickets(_, { location, offset, limit }, context);
  },

  getAllTickets: async (_, { location='Both', status, offset, limit }, context) => {
    const isPermitted = await isMedicalPermittedLocationBased(user.id, permissions.health_chat_allow_access, location);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    return await Wrapper.Query._getAllTickets(_, { location, status, offset, limit }, context);
  },

  getTicket: async (_, { chatId }, context) => {
    const patientId = await getPatientIdFromChatId(chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    return await Wrapper.Query._getTicket(_, { chatId }, context);
  },

  getMessages: async (_, { chatId }, context) => {
    const patientId = await getPatientIdFromChatId(chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Query._getMessages(_, { chatId }, context);
  },

  getPatientConversations: async (_, { location='Both', status, offset, limit}, context) => {
    const isPermitted = await isMedicalPermittedLocationBased(user.id, permissions.health_chat_allow_access, location);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Query._getPatientConversations(_, { location, status, offset, limit}, context);
  },

  getPatientMessages: async (_, args, context) => {
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, args.patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Query._getPatientMessages(_, args, context);
  }
};

const Mutation = {
  approveTicket: async (_, args, context) => {
    const patientId = await getPatientIdFromChatId(args.input.chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Mutation._approveTicket(_, args, context);
  },

  rejectTicket: async (_, args, context) => {
    const patientId = await getPatientIdFromChatId(args.chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Mutation._rejectTicket(_, args, context);
  },

  sendMedicalMessage: async (_, args, context) => {
    const patientId = await getPatientIdFromChatId(args.input.chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Mutation._sendMedicalMessage(_, args, context);
  },

  closeTicket: async (_, args, context) => {
    const patientId = await getPatientIdFromChatId(args.input.chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Mutation._closeTicket(_, args, context);
  },

  deleteArchivedTicket: async (_, args, context) => {
    const patientId = await getPatientIdFromChatId(args.chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    return await Wrapper.Mutation._deleteArchivedTicket(_, args, context);
  },

  transferTicket: async (_, { chatId, toMedicalId }, context) => {
    const patientId = await getPatientIdFromChatId(chatId);
    const isPermitted = await isMedicalPermittedPatientBased(user.id, permissions.health_chat_allow_access, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }
    
    const isNewPermitted = await isMedicalPermittedPatientBased(toMedicalId, permissions.health_chat_allow_access, patientId);
    if (!isNewPermitted) {
      throwGraphQLError(res).message("New Medical Personnel does not have enough permission to transfer").status(403).throw();
    }

    return await Wrapper.Mutation._transferTicket(_, { chatId, toMedicalId }, context);
  },

  takeoverOngoingTicket: async (_, { chatId }, context) => {
    const isPermitted = await isMedicalAdmin(user.id);
    if (!isPermitted) {
      throwGraphQLError(res).message("Access denied").status(403).throw();
    }

    return await Wrapper.Mutation._takeoverOngoingTicket(_, { chatId }, context);
  },

  expireOldTickets: async (_, args, context) => {
    return await Wrapper.Mutation._expireOldTickets(_, args, context);
  },

  extendSession: async (_, args, context) => {
    return await Wrapper.Mutation._extendSession(_, args, context);
  }
};

module.exports = { Query, Mutation };
