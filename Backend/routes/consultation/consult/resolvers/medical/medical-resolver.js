const path = require("path");
const dotenv = require("dotenv");
const Wrapper = require("../wrapper/wrapper.js");
const { throwGraphQLError } = require("../../../../../utils/graphql-helper.js");
const permit = require("../../../../../services/permit.js");

dotenv.config({ path: path.resolve(__dirname, "../../env") });

// creating of updateTicket
// In-progress do expire after nth time
// Unless if the user is unverified where the first ticket never expires

const Query = {
  getConsultations: async (_, { patientId, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const isPermitted = await permit.isMedicalPermittedPatientBased(user.id, permit.permissions.consultation_allow_view, patientId);
    if (!isPermitted) {
      throwGraphQLError(res).message("Not permitted to access medical data").status(403).throw();
    }

    return await Wrapper.Query._getConsultations(_, { patientId, offset, limit }, { user, res });
  },

  getOutcomes: async (_, { consultationId, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_view);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to access medical data").status(403).throw();
    }

    return await Wrapper.Query._getOutcomes(_, { consultationId, offset, limit }, { user, res });
  },

  getComplaints: async (_, { outcomeId, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_view);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to access medical data").status(403).throw();
    }

    return await Wrapper.Query._getComplaints(_, { outcomeId, offset, limit }, { user, res });
  },

  getPEFindings: async (_, { outcomeId, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_view);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to access medical data").status(403).throw();
    }

    return await Wrapper.Query._getPEFindings(_, { outcomeId, offset, limit }, { user, res });
  },

  getTreatments: async (_, { outcomeId, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_view);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to access medical data").status(403).throw();
    }

    return await Wrapper.Query._getTreatments(_, { outcomeId, offset, limit }, { user, res });
  },

  getDiagnoses: async (_, { outcomeId, offset, limit }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_view);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to access medical data").status(403).throw();
    }

    return await Wrapper.Query._getDiagnoses(_, { outcomeId, offset, limit }, { user, res });
  },

  getIcdViaCode: async (_, { code }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }

    return await Wrapper.Query._getIcdViaCode(_, { code }, { user, res });
  },

  getIcdViaTitle: async (_, { title }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getIcdViaTitle(_, { title }, { user, res });
  },

  getIcdDetails: async (_, { id }, { user, res }) => {
     if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    return await Wrapper.Query._getIcdDetails(_, { id }, { user, res });
  }
};

const Mutation = {

  createConsultation: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_edit);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to modify medical data").status(403).throw();
    }

    return await Wrapper.Mutation._createConsultation(_, { input }, { user, res });
  },

  openConsultation: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_edit);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to modify medical data").status(403).throw();
    }
    
    return await Wrapper.Mutation._OpenConsultation(_, { input, _status: "Open" }, { user, res });
  },

  submitConsultation: async (_, { consultationId, status }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_edit);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to modify medical data").status(403).throw();
    }

    return await Wrapper.Mutation._submitConsultation(_, { consultationId, status }, { user, res });
  },

  reOpenConsultation: async (_, { input }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_edit);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to modify medical data").status(403).throw();
    }

    return await Wrapper.Mutation._OpenConsultation(_, { input, _status: "ReOpen" }, { user, res });
  },

  updateConsultationNotes: async (_, { consultationId, notes }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_edit);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to modify medical data").status(403).throw();
    }

    return await Wrapper.Mutation._updateConsultationNotes(_, { consultationId, notes }, { user, res });
  },

  updateConsultationFollowUpId: async (_, { consultationId, followUpId }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_edit);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to modify medical data").status(403).throw();
    }

    return await Wrapper.Mutation._updateConsultationFollowUpId(_, { consultationId, followUpId }, { user, res });
  },

  updateOutcomeRemarks: async (_, { consultationId, remarks }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_edit);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to modify medical data").status(403).throw();
    }

    return await Wrapper.Mutation._updateOutcomeRemarks(_, { consultationId, remarks }, { user, res });
  },

  updateComplaints: async (_, { consultationId, complaints }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_edit);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to modify medical data").status(403).throw();
    }

    return await Wrapper.Mutation._updateComplaints(_, { consultationId, complaints }, { user, res });
  },

  updatePEFindings: async (_, { consultationId, peFindings }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_edit);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to modify medical data").status(403).throw();
    }

    return await Wrapper.Mutation._updatePEFindings(_, { consultationId, peFindings }, { user, res });
  },

  updateTreatments: async (_, { consultationId, treatments }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_edit);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to modify medical data").status(403).throw();
    }

    return await Wrapper.Mutation._updateTreatments(_, { consultationId, treatments }, { user, res });
  },

  updateDiagnoses: async (_, { consultationId, diagnoses }, { user, res }) => {
    if (!user) {
      throwGraphQLError(res).message("Unauthorized").status(401).throw();
    }
    
    const { permitted } = await permit.isMedicalPermitted(user.id, permit.permissions.consultation_allow_edit);
    if (!permitted) {
      throwGraphQLError(res).message("Not permitted to modify medical data").status(403).throw();
    }

    return await Wrapper.Mutation._updateDiagnoses(_, { consultationId, diagnoses }, { user, res });
  },
};

module.exports = { Query, Mutation };
