const Wrapper = require("../wrapper/wrapper.js");

const Query = {
  getMyTickets: async (_, args, context) => {
    return await Wrapper.Query._getMyTickets(_, args, context);
  },

  getMyTicket: async (_, args, context) => {
    return await Wrapper.Query._getMyTicket(_, args, context);
  },

  getTicketMessages: async (_, args, context) => {
    return await Wrapper.Query._getTicketMessages(_, args, context);
  }
};

const Mutation = {
  createTicket: async (_, args, context) => {
    return await Wrapper.Mutation._createTicket(_, args, context);
  },

  sendPatientMessage: async (_, args, context) => {
    return await Wrapper.Mutation._sendPatientMessage(_, args, context);
  },

  closeMyTicket: async (_, args, context) => {
    return await Wrapper.Mutation._closeMyTicket(_, args, context);
  }
};

module.exports = { Query, Mutation };
