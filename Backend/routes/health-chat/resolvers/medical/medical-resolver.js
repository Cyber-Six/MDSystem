const Wrapper = require("../wrapper/wrapper.js");

const Query = {
  getPendingTickets: async (_, args, context) => {
    return await Wrapper.Query._getPendingTickets(_, args, context);
  },

  getActiveTickets: async (_, args, context) => {
    return await Wrapper.Query._getActiveTickets(_, args, context);
  },

  getAllTickets: async (_, args, context) => {
    return await Wrapper.Query._getAllTickets(_, args, context);
  },

  getTicket: async (_, args, context) => {
    return await Wrapper.Query._getTicket(_, args, context);
  },

  getMessages: async (_, args, context) => {
    return await Wrapper.Query._getMessages(_, args, context);
  }
};

const Mutation = {
  approveTicket: async (_, args, context) => {
    return await Wrapper.Mutation._approveTicket(_, args, context);
  },

  rejectTicket: async (_, args, context) => {
    return await Wrapper.Mutation._rejectTicket(_, args, context);
  },

  sendMedicalMessage: async (_, args, context) => {
    return await Wrapper.Mutation._sendMedicalMessage(_, args, context);
  },

  closeTicket: async (_, args, context) => {
    return await Wrapper.Mutation._closeTicket(_, args, context);
  },

  expireOldTickets: async (_, args, context) => {
    return await Wrapper.Mutation._expireOldTickets(_, args, context);
  }
};

module.exports = { Query, Mutation };
