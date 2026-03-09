const Wrapper = require("../wrapper/wrapper.js");
const { throwGraphQLError } = require("../../../../utils/graphql-helper.js");
const permit = require("../../../../services/permit.js");
const logger = require("../../../../utils/logger.js");

const Query = {
  getMedicalItems: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_view);
    if (!isPermitted) {
      logger.warn("Unauthorized inventory view attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getMedicalItems(_, args, { res });
  },

  getMedicalItem: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_view);
    if (!isPermitted) {
      logger.warn("Unauthorized inventory view attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getMedicalItem(_, args, { res });
  },

  getMedicalSupply: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_view);
    if (!isPermitted) {
      logger.warn("Unauthorized inventory view attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getMedicalSupply(_, args, { res });
  },

  getSupplyBatches: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_view);
    if (!isPermitted) {
      logger.warn("Unauthorized inventory view attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getSupplyBatches(_, args, { res });
  },
};

const Mutation = {
  createMedicalItems: async (_, { input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_edit);
    if (!isPermitted) {
      logger.warn("Unauthorized inventory edit attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._createMedicalItems(_, { input }, { res });
  },

  updateMedicalItems: async (_, { id, input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_edit);
    if (!isPermitted) {
      logger.warn("Unauthorized inventory edit attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._updateMedicalItems(_, { id, input }, { res });
  },

  deleteMedicalItems: async (_, { id }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_edit);
    if (!isPermitted) {
      logger.warn("Unauthorized inventory delete attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._deleteMedicalItems(_, { id }, { res });
  },

  addMedicalSupply: async (_, { input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_edit);
    if (!isPermitted) {
      logger.warn("Unauthorized supply add attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._addMedicalSupply(_, { input, receivedBy: user.id }, { res });
  },

  addSupplyBatch: async (_, { input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_edit);
    if (!isPermitted) {
      logger.warn("Unauthorized supply add attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._addSupplyBatch(_, { input, receivedBy: user.id }, { res });
  },

  splitMedicalSupply: async (_, { batchId, input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_edit);
    if (!isPermitted) {
      logger.warn("Unauthorized supply split attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._splitMedicalSupply(_, { batchId, input }, { res });
  },

  updateMedicalSupply: async (_, { batchId, input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_edit);
    if (!isPermitted) {
      logger.warn("Unauthorized supply update attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._updateMedicalSupply(_, { batchId, input }, { res });
  },

  updateSupplyBatch: async (_, { batchId, input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_edit);
    if (!isPermitted) {
      logger.warn("Unauthorized supply update attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._updateSupplyBatch(_, { batchId, input }, { res });
  },
};

module.exports = { Query, Mutation };