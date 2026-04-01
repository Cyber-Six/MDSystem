/**
 * Consultation Service - Staff Side
 *
 * Handles all GraphQL queries and mutations for the consultation feature.
 * Endpoint: /consultation
 */

import { axiosRequest } from '../../packages-core-adapter';

const ENDPOINT = '/consultation';

/**
 * Send a GraphQL request to the consultation endpoint
 */
const sendGraphQL = async (query, variables = {}) => {
  const response = await axiosRequest.post(ENDPOINT, {
    query,
    variables
  });

  if (response.data.errors) {
    const firstError = response.data.errors[0];
    const error = new Error(firstError?.message || 'GraphQL error occurred');
    error.graphQLErrors = response.data.errors;
    if (response.data.data) {
      error.data = response.data.data;
    }
    throw error;
  }

  return response.data.data;
};

// ==================== QUERIES ====================

/**
 * Get all consultations for a patient
 */
export const getConsultations = async (patientId, offset = 0, limit = 50) => {
  const query = `
    query GetConsultations($patientId: ID!, $offset: Int, $limit: Int) {
      getConsultations(patientId: $patientId, offset: $offset, limit: $limit) {
        id
        followUpId
        patientId
        mode
        type
        status
        notes
        updatedAt
        createdAt
      }
    }
  `;

  const data = await sendGraphQL(query, { patientId: String(patientId), offset, limit });
  return data.getConsultations;
};

/**
 * Get outcomes for a consultation
 */
export const getOutcomes = async (consultationId, offset = 0, limit = 10) => {
  const query = `
    query GetOutcomes($consultationId: ID!, $offset: Int, $limit: Int) {
      getOutcomes(consultationId: $consultationId, offset: $offset, limit: $limit) {
        id
        consultationId
        remarks
        recordedBy
        recordedAt
        complaints {
          id
          outcomeId
          complaint
        }
        peFindings {
          id
          outcomeId
          finding
        }
        treatments {
          id
          outcomeId
          treatment
        }
        diagnoses {
          id
          outcomeId
          diagnosisName
          icdId
          diagnosisType
          notes
        }
      }
    }
  `;

  const data = await sendGraphQL(query, { consultationId: String(consultationId), offset, limit });
  return data.getOutcomes;
};

/**
 * Get complaints for an outcome
 */
export const getComplaints = async (outcomeId, offset = 0, limit = 20) => {
  const query = `
    query GetComplaints($outcomeId: ID!, $offset: Int, $limit: Int) {
      getComplaints(outcomeId: $outcomeId, offset: $offset, limit: $limit) {
        id
        outcomeId
        complaint
      }
    }
  `;

  const data = await sendGraphQL(query, { outcomeId: String(outcomeId), offset, limit });
  return data.getComplaints;
};

/**
 * Get PE findings for an outcome
 */
export const getPEFindings = async (outcomeId, offset = 0, limit = 20) => {
  const query = `
    query GetPEFindings($outcomeId: ID!, $offset: Int, $limit: Int) {
      getPEFindings(outcomeId: $outcomeId, offset: $offset, limit: $limit) {
        id
        outcomeId
        finding
      }
    }
  `;

  const data = await sendGraphQL(query, { outcomeId: String(outcomeId), offset, limit });
  return data.getPEFindings;
};

/**
 * Get treatments for an outcome
 */
export const getTreatments = async (outcomeId, offset = 0, limit = 20) => {
  const query = `
    query GetTreatments($outcomeId: ID!, $offset: Int, $limit: Int) {
      getTreatments(outcomeId: $outcomeId, offset: $offset, limit: $limit) {
        id
        outcomeId
        treatment
      }
    }
  `;

  const data = await sendGraphQL(query, { outcomeId: String(outcomeId), offset, limit });
  return data.getTreatments;
};

/**
 * Get diagnoses for an outcome
 */
export const getDiagnoses = async (outcomeId, offset = 0, limit = 20) => {
  const query = `
    query GetDiagnoses($outcomeId: ID!, $offset: Int, $limit: Int) {
      getDiagnoses(outcomeId: $outcomeId, offset: $offset, limit: $limit) {
        id
        outcomeId
        diagnosisName
        icdId
        diagnosisType
        notes
      }
    }
  `;

  const data = await sendGraphQL(query, { outcomeId: String(outcomeId), offset, limit });
  return data.getDiagnoses;
};

/**
 * Search ICD by code
 */
export const getIcdViaCode = async (code) => {
  const query = `
    query SearchIcdByCode($code: String!) {
      getIcdViaCode(code: $code) {
        id
        code
        title
      }
    }
  `;

  const data = await sendGraphQL(query, { code });
  return data.getIcdViaCode;
};

/**
 * Search ICD by title
 */
export const getIcdViaTitle = async (title) => {
  const query = `
    query SearchIcdByTitle($title: String!) {
      getIcdViaTitle(title: $title) {
        id
        code
        title
      }
    }
  `;

  const data = await sendGraphQL(query, { title });
  return data.getIcdViaTitle;
};

// ==================== MUTATIONS ====================

/**
 * Create a new consultation
 */
export const createConsultation = async (input) => {
  const mutation = `
    mutation CreateConsultation($input: ConsultationInput) {
      createConsultation(input: $input) {
        id
        patientId
        mode
        type
        status
        notes
        createdAt
      }
    }
  `;

  const data = await sendGraphQL(mutation, { input });
  return data.createConsultation;
};

/**
 * Open a consultation with outcome data
 */
export const openConsultation = async (input) => {
  const mutation = `
    mutation OpenConsultation($input: ConsultationOutcomeInput!) {
      openConsultation(input: $input) {
        id
        consultationId
        remarks
        recordedAt
        complaints {
          id
          complaint
        }
        peFindings {
          id
          finding
        }
        treatments {
          id
          treatment
        }
        diagnoses {
          id
          diagnosisName
          icdId
          diagnosisType
          notes
        }
      }
    }
  `;

  const data = await sendGraphQL(mutation, { input });
  return data.openConsultation;
};

/**
 * Submit a consultation with a final status
 */
export const submitConsultation = async (consultationId, status) => {
  const mutation = `
    mutation SubmitConsultation($consultationId: ID!, $status: CONSULTATION_STATUS_INPUT!) {
      submitConsultation(consultationId: $consultationId, status: $status)
    }
  `;

  const data = await sendGraphQL(mutation, { consultationId: String(consultationId), status });
  return data.submitConsultation;
};

/**
 * Reopen a consultation
 */
export const reOpenConsultation = async (input) => {
  const mutation = `
    mutation ReOpenConsultation($input: ConsultationOutcomeInput!) {
      reOpenConsultation(input: $input) {
        id
        consultationId
        remarks
        recordedAt
        complaints {
          id
          complaint
        }
        peFindings {
          id
          finding
        }
        treatments {
          id
          treatment
        }
        diagnoses {
          id
          diagnosisName
          icdId
          diagnosisType
          notes
        }
      }
    }
  `;

  const data = await sendGraphQL(mutation, { input });
  return data.reOpenConsultation;
};

/**
 * Update consultation notes
 */
export const updateConsultationNotes = async (consultationId, notes) => {
  const mutation = `
    mutation UpdateConsultationNotes($consultationId: ID!, $notes: String!) {
      updateConsultationNotes(consultationId: $consultationId, notes: $notes)
    }
  `;

  const data = await sendGraphQL(mutation, { consultationId: String(consultationId), notes });
  return data.updateConsultationNotes;
};

/**
 * Update consultation follow-up ID
 */
export const updateConsultationFollowUpId = async (consultationId, followUpId) => {
  const mutation = `
    mutation UpdateConsultationFollowUpId($consultationId: ID!, $followUpId: ID!) {
      updateConsultationFollowUpId(consultationId: $consultationId, followUpId: $followUpId)
    }
  `;

  const data = await sendGraphQL(mutation, {
    consultationId: String(consultationId),
    followUpId: String(followUpId)
  });
  return data.updateConsultationFollowUpId;
};

/**
 * Update outcome remarks
 */
export const updateOutcomeRemarks = async (consultationId, remarks) => {
  const mutation = `
    mutation UpdateOutcomeRemarks($consultationId: ID!, $remarks: String!) {
      updateOutcomeRemarks(consultationId: $consultationId, remarks: $remarks)
    }
  `;

  const data = await sendGraphQL(mutation, { consultationId: String(consultationId), remarks });
  return data.updateOutcomeRemarks;
};

/**
 * Update complaints for a consultation
 */
export const updateComplaints = async (consultationId, complaints) => {
  const mutation = `
    mutation UpdateComplaints($consultationId: ID!, $complaints: [String!]!) {
      updateComplaints(consultationId: $consultationId, complaints: $complaints) {
        id
        outcomeId
        complaint
      }
    }
  `;

  const data = await sendGraphQL(mutation, {
    consultationId: String(consultationId),
    complaints
  });
  return data.updateComplaints;
};

/**
 * Update PE findings for a consultation
 */
export const updatePEFindings = async (consultationId, findings) => {
  const mutation = `
    mutation UpdatePEFindings($consultationId: ID!, $findings: [String!]!) {
      updatePEFindings(consultationId: $consultationId, findings: $findings) {
        id
        outcomeId
        finding
      }
    }
  `;

  const data = await sendGraphQL(mutation, {
    consultationId: String(consultationId),
    findings
  });
  return data.updatePEFindings;
};

/**
 * Update treatments for a consultation
 */
export const updateTreatments = async (consultationId, treatments) => {
  const mutation = `
    mutation UpdateTreatments($consultationId: ID!, $treatments: [String!]!) {
      updateTreatments(consultationId: $consultationId, treatments: $treatments) {
        id
        outcomeId
        treatment
      }
    }
  `;

  const data = await sendGraphQL(mutation, {
    consultationId: String(consultationId),
    treatments
  });
  return data.updateTreatments;
};

/**
 * Update diagnoses for a consultation
 */
export const updateDiagnoses = async (consultationId, diagnoses) => {
  const mutation = `
    mutation UpdateDiagnoses($consultationId: ID!, $diagnoses: [ConsultationDiagnosisInput!]!) {
      updateDiagnoses(consultationId: $consultationId, diagnoses: $diagnoses) {
        id
        outcomeId
        diagnosisName
        icdId
        diagnosisType
        notes
      }
    }
  `;

  const data = await sendGraphQL(mutation, {
    consultationId: String(consultationId),
    diagnoses
  });
  return data.updateDiagnoses;
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Valid diagnosis types for backend
 */
export const DIAGNOSIS_TYPES = [
  'Primary',
  'Secondary',
  'Differential',
  'RuledOut',
  'Provisional',
  'Complication',
  'Chronic',
  'FollowUp'
];

/**
 * Map frontend diagnosis entry to backend format
 */
export const mapToBackendDiagnosis = (entry) => {
  const diagType = entry.diagnosisType || entry.type || 'Secondary';
  const validType = DIAGNOSIS_TYPES.includes(diagType) ? diagType : 'Secondary';

  return {
    outcomeId: "0", // Placeholder - Backend will populate the real outcomeId
    diagnosisName: entry.title || entry.diagnosisName,
    icdId: Number(entry.id || entry.icdId),
    diagnosisType: validType,
    notes: entry.notes?.trim() || null,
  };
};

/**
 * Fetch consultation with all details (OPTIMIZED - Batched Requests)
 */
export const getConsultationsWithDetailsOptimized = async (patientId, offset = 0, limit = 50) => {
  try {
    // Step 1: Get all consultations
    const consultations = await getConsultations(patientId, offset, limit);

    if (!consultations || consultations.length === 0) {
      return [];
    }

    // Step 2: Batch fetch all outcomes in parallel (instead of sequential)
    const outcomesPromises = consultations.map(consultation =>
      getOutcomes(consultation.id, 0, 10).catch(err => {
        console.error(`Error fetching outcomes for consultation ${consultation.id}:`, err);
        return []; // Return empty array on error
      })
    );

    // Wait for all outcome requests to complete in parallel
    const allOutcomes = await Promise.all(outcomesPromises);

    // Step 3: Process consultations with their outcomes
    const consultationsWithDetails = consultations.map((consultation, index) => {
      try {
        const outcomes = allOutcomes[index] || [];
        const latestOutcome = outcomes[0] || null;

        let diagnoses = [];
        if (latestOutcome?.diagnoses) {
          diagnoses = latestOutcome.diagnoses
            .filter((d) => d && d.diagnosisName)
            .map((d) => ({
              ...d,
              diagnosisType: d.diagnosisType || 'Secondary',
            }));
        }

        const primaryDiagnosis = diagnoses.find((d) => d.diagnosisType === 'Primary') || diagnoses[0];

        return {
          id: consultation.id,
          type: consultation.type,
          date: new Date(consultation.createdAt).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }),
          time: new Date(consultation.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
          diagnosis: primaryDiagnosis?.diagnosisName || 'General consultation',
          diagnoses: diagnoses,
          doctor: 'Clinic Staff',
          treatment: latestOutcome?.treatments?.[0]?.treatment || '',
          complaints: latestOutcome?.complaints || [],
          peFindings: latestOutcome?.peFindings || [],
          notes: consultation.notes || '',
          remarks: latestOutcome?.remarks || '',
          status: consultation.status,
          mode: consultation.mode,
          outcome: latestOutcome,
        };
      } catch (err) {
        console.error('Error processing consultation details:', err);
        return {
          id: consultation.id,
          type: consultation.type,
          date: new Date(consultation.createdAt).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }),
          time: new Date(consultation.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
          diagnosis: 'General consultation',
          diagnoses: [],
          doctor: 'Clinic Staff',
          treatment: '',
          complaints: [],
          peFindings: [],
          notes: consultation.notes || '',
          remarks: '',
          status: consultation.status,
          mode: consultation.mode,
          outcome: null,
        };
      }
    });

    return consultationsWithDetails;
  } catch (err) {
    console.error('Optimized consultation fetch failed, falling back to original method:', err);
    // Fallback to original method if optimized version fails
    return getConsultationWithDetails(patientId);
  }
};

// Add simple caching to reduce redundant calls
const consultationCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Fetch consultation with caching
 */
export const getCachedConsultationsWithDetails = async (patientId) => {
  const cacheKey = `consultations_${patientId}`;
  const cached = consultationCache.get(cacheKey);

  // Check if cache is still valid
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return cached.data;
  }

  // Fetch fresh data
  const consultations = await getConsultationsWithDetailsOptimized(patientId);

  // Cache the result
  consultationCache.set(cacheKey, {
    data: consultations,
    timestamp: Date.now()
  });

  return consultations;
};

/**
 * Clear consultation cache for a patient
 */
export const clearConsultationCache = (patientId) => {
  const cacheKey = `consultations_${patientId}`;
  consultationCache.delete(cacheKey);
};

// ICD search caching to reduce redundant searches
const icdCache = new Map();
const ICD_CACHE_DURATION = 300000; // 5 minutes (ICD data doesn't change frequently)

/**
 * Search ICD by code with caching
 */
export const getIcdViaCodeCached = async (code) => {
  const cacheKey = `icd_code_${code.toLowerCase()}`;
  const cached = icdCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < ICD_CACHE_DURATION)) {
    return cached.data;
  }

  const data = await getIcdViaCode(code);
  icdCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
};

/**
 * Search ICD by title with caching
 */
export const getIcdViaTitleCached = async (title) => {
  const cacheKey = `icd_title_${title.toLowerCase()}`;
  const cached = icdCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < ICD_CACHE_DURATION)) {
    return cached.data;
  }

  const data = await getIcdViaTitle(title);
  icdCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
};

/**
 * Fetch consultation with all details (ORIGINAL - kept for fallback)
 */
export const getConsultationWithDetails = async (patientId) => {
  const consultations = await getConsultations(patientId);

  const consultationsWithDetails = await Promise.all(
    consultations.map(async (consultation) => {
      try {
        const outcomes = await getOutcomes(consultation.id);
        const latestOutcome = outcomes[0] || null;

        let diagnoses = [];
        if (latestOutcome?.diagnoses) {
          diagnoses = latestOutcome.diagnoses
            .filter((d) => d && d.diagnosisName)
            .map((d) => ({
              ...d,
              diagnosisType: d.diagnosisType || 'Secondary',
            }));
        }

        const primaryDiagnosis = diagnoses.find((d) => d.diagnosisType === 'Primary') || diagnoses[0];

        return {
          id: consultation.id,
          type: consultation.type,
          date: new Date(consultation.createdAt).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }),
          time: new Date(consultation.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
          diagnosis: primaryDiagnosis?.diagnosisName || 'General consultation',
          diagnoses: diagnoses,
          doctor: 'Clinic Staff',
          treatment: latestOutcome?.treatments?.[0]?.treatment || '',
          complaints: latestOutcome?.complaints || [],
          peFindings: latestOutcome?.peFindings || [],
          notes: consultation.notes || '',
          remarks: latestOutcome?.remarks || '',
          status: consultation.status,
          mode: consultation.mode,
          outcome: latestOutcome,
        };
      } catch (err) {
        console.error('Error fetching consultation details:', err);
        return {
          id: consultation.id,
          type: consultation.type,
          date: new Date(consultation.createdAt).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }),
          time: new Date(consultation.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
          diagnosis: 'General consultation',
          diagnoses: [],
          doctor: 'Clinic Staff',
          treatment: '',
          complaints: [],
          peFindings: [],
          notes: consultation.notes || '',
          remarks: '',
          status: consultation.status,
          mode: consultation.mode,
          outcome: null,
        };
      }
    })
  );

  return consultationsWithDetails;
};

/**
 * Create vital signs for a patient (used during consultation)
 * Calls the EMR endpoint where vital signs live.
 */
export const createVitalSignsForConsultation = async (patientId, input) => {
  const mutation = `
    mutation CreateVitalSigns($patientId: ID!, $input: VitalSignsInput!) {
      createVitalSigns(patientId: $patientId, input: $input) {
        id
      }
    }
  `;

  const response = await axiosRequest.post('/staff/emr', {
    query: mutation,
    variables: { patientId: String(patientId), input },
  });

  if (response.data.errors) {
    const firstError = response.data.errors[0];
    throw new Error(firstError?.message || 'Failed to create vital signs');
  }

  return response.data.data.createVitalSigns;
};

/**
 * Create and submit a complete consultation
 */
export const createAndSubmitConsultation = async (consultationInput, outcomeInput, status = 'Completed') => {
  // Step 1: Create consultation
  const newConsultation = await createConsultation(consultationInput);

  if (!newConsultation) {
    throw new Error('Failed to create consultation');
  }

  // Step 2: Open consultation with outcome data
  const outcomeInputWithId = {
    ...outcomeInput,
    consultationId: newConsultation.id,
  };

  const outcome = await openConsultation(outcomeInputWithId);

  if (!outcome) {
    throw new Error('Failed to open consultation');
  }

  // Step 3: Submit consultation
  await submitConsultation(newConsultation.id, status);

  return {
    consultation: newConsultation,
    outcome: outcome,
  };
};
