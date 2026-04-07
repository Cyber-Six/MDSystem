const Wrapper = require("../wrapper/wrapper.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const permit = require("../../../../../services/permit.js");
const logger = require("../../../../../utils/logger.js");

const { batchIdToBranch } = require("./../wrapper/helper.js");

const Query = {
  getMedicalItems: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_view);
    if (!permitted) {
      logger.warn("Unauthorized inventory view attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getMedicalItems(_, { active: true, ...args }, { user, res });
  },

  getMedicalItem: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_view);
    if (!permitted) {
      logger.warn("Unauthorized inventory view attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getMedicalItem(_, args, { user, res });
  },

  getMedicalSupply: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.inventory_allow_view, args.location);
    if (!isPermitted) {
      logger.warn("Unauthorized inventory view attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getMedicalSupply(_, { availableOnly: true, ...args }, { user, res });
  },

  getSupplyBatches: async (_, args, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.inventory_allow_view, args.location);
    if (!isPermitted) {
      logger.warn("Unauthorized inventory view attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getSupplyBatches(_, { availableOnly: true, ...args }, { user, res });
  },
};

const Mutation = {
  createMedicalItems: async (_, { input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_configure);
    if (!permitted) {
      logger.warn("Unauthorized inventory configure attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._createMedicalItems(_, { input }, { user, res });
  },

  updateMedicalItems: async (_, { id, input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_configure);
    if (!permitted) {
      logger.warn("Unauthorized inventory configure attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._updateMedicalItems(_, { id, input }, { user, res });
  },

  deleteMedicalItems: async (_, { id }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.inventory_allow_configure);
    if (!permitted) {
      logger.warn("Unauthorized inventory configure attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._deleteMedicalItems(_, { id }, { user, res });
  },

  addMedicalSupply: async (_, { input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.inventory_allow_edit, input.location);
    if (!isPermitted) {
      logger.warn("Unauthorized supply add attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._addMedicalSupply(_, { input, receivedBy: user.id }, { user, res });
  },

  addSupplyBatch: async (_, { input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.inventory_allow_edit, input.location);
    if (!isPermitted) {
      logger.warn("Unauthorized supply add attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._addSupplyBatch(_, { input, receivedBy: user.id }, { user, res });
  },

  splitMedicalSupply: async (_, { batchId, input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();
    
    let branch;
    try { // fetch branch for permission check
      branch = await batchIdToBranch("SupplyBatch", batchId);
      if (!branch) {
        logger.warn("Batch ID not found for supply batch", { batchId });
        throwGraphQLError(res).message("Invalid batch ID").status(400).throw();
      }
    } catch (err) {
      logger.error("Failed to retrieve branch for supply batch", { batchId, error: err.message });
      throwGraphQLError(res).message("Internal error retrieving batch information").status(500).throw();
    }
    
    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.inventory_allow_edit, branch);
    if (!isPermitted) {
      logger.warn("Unauthorized supply split attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._splitMedicalSupply(_, { batchId, input }, { user, res });
  },

  splitMedicineSupply: async (_, { batchId, input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();

    let branch;
    try { // fetch branch for permission check
      branch = await batchIdToBranch("MedicineBatch", batchId);
      if (!branch) {
        logger.warn("Batch ID not found for medicine batch", { batchId });
        throwGraphQLError(res).message("Invalid batch ID").status(400).throw();
      }
    } catch (err) {
      logger.error("Failed to retrieve branch for medicine batch", { batchId, error: err.message });
      throwGraphQLError(res).message("Internal error retrieving batch information").status(500).throw();
    }

    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.inventory_allow_edit, branch);
    if (!isPermitted) {
      logger.warn("Unauthorized medicine split attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._splitMedicineSupply(_, { batchId, input }, { user, res });
  },

  updateMedicalSupply: async (_, { batchId, input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();

    let branch;
    try { // fetch branch for permission check
      branch = await batchIdToBranch("MedicineBatch", batchId);
      if (!branch) {
        logger.warn("Batch ID not found for medicine batch", { batchId });
        throwGraphQLError(res).message("Invalid batch ID").status(400).throw();
      }
    } catch (err) {
      logger.error("Failed to retrieve branch for medicine batch", { batchId, error: err.message });
      throwGraphQLError(res).message("Internal error retrieving batch information").status(500).throw();
    }

    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.inventory_allow_edit, branch);
    if (!isPermitted) {
      logger.warn("Unauthorized medicine update attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._updateMedicalSupply(_, { batchId, input }, { user, res });
  },

  updateSupplyBatch: async (_, { batchId, input }, { user, res }) => {
    if (!user) throwGraphQLError(res).message("Unauthorized").status(401).throw();

    let branch;
    try { // fetch branch for permission check
      branch = await batchIdToBranch("SupplyBatch", batchId);
      if (!branch) {
        logger.warn("Batch ID not found for supply batch", { batchId });
        throwGraphQLError(res).message("Invalid batch ID").status(400).throw();
      }
    } catch (err) {
      logger.error("Failed to retrieve branch for supply batch", { batchId, error: err.message });
      throwGraphQLError(res).message("Internal error retrieving batch information").status(500).throw();
    }

    const isPermitted = await permit.isMedicalPermittedBranchBased(user.id, permit.permissions.inventory_allow_edit, branch);
    if (!isPermitted) {
      logger.warn("Unauthorized supply update attempt by staff " + user.id);
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Mutation._updateSupplyBatch(_, { batchId, input }, { user, res });
  },
};

module.exports = { Query, Mutation };