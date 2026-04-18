const PRESCRIPTION_TEMPLATE_NAME = 'Prescription';
const PRESCRIPTION_DOC_TYPE = 'prescription';
const GENERIC_BINARY_TAG = 'payload';

const PRESCRIPTION_REQUIRED_TAGS = Object.freeze([
  'complaints',
  'diagnosis',
  'medications',
  'instructions',
  'follow_up',
]);

function normalizeTag(value) {
  return String(value || '').trim().toLowerCase();
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function parseJsonSafe(raw, fallback = null) {
  if (raw === undefined || raw === null) return fallback;
  const text = String(raw).trim();
  if (!text) return fallback;

  try {
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}

function normalizeQuantity(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMedications(medications = []) {
  if (!Array.isArray(medications)) return [];

  return medications
    .map((item) => {
      const name = pickFirstNonEmpty(item?.name, item?.medicineName);
      if (!name) return null;

      return {
        name,
        dosage: pickFirstNonEmpty(item?.dosage),
        frequency: pickFirstNonEmpty(item?.frequency),
        duration: pickFirstNonEmpty(item?.duration),
        qty: normalizeQuantity(item?.qty ?? item?.quantity),
        instructions: pickFirstNonEmpty(item?.instructions),
      };
    })
    .filter(Boolean);
}

function buildPrescriptionRequirementValues(documentPayload = {}) {
  const prescription = documentPayload?.prescription || {};

  const diagnosis = pickFirstNonEmpty(prescription.diagnosis) || 'Not specified';

  const complaintsPayload = {
    chiefComplaints: pickFirstNonEmpty(
      prescription.chiefComplaints,
      prescription.complaints
    ),
    peFindings: pickFirstNonEmpty(prescription.peFindings),
  };

  if (!complaintsPayload.chiefComplaints && !complaintsPayload.peFindings) {
    complaintsPayload.chiefComplaints = diagnosis;
  }

  const instructionsPayload = {
    specialInstructions: pickFirstNonEmpty(
      prescription.specialInstructions,
      prescription.instructions
    ),
    advice: pickFirstNonEmpty(prescription.advice),
  };

  const medications = normalizeMedications(prescription.medications);
  if (medications.length === 0) {
    const err = new Error('At least one medication with a name is required.');
    err.statusCode = 400;
    err.errorCode = 'MEDICATIONS_REQUIRED';
    throw err;
  }

  const followUpDate = pickFirstNonEmpty(
    prescription.followUpDate,
    prescription.follow_up,
    prescription.followUp
  );

  const requirementValues = {
    complaints: JSON.stringify(complaintsPayload),
    diagnosis,
    medications: JSON.stringify(medications),
    instructions: JSON.stringify(instructionsPayload),
    follow_up: followUpDate || 'Not specified',
  };

  const missingTags = PRESCRIPTION_REQUIRED_TAGS.filter(
    (tag) => !Object.prototype.hasOwnProperty.call(requirementValues, tag)
  );

  if (missingTags.length > 0) {
    const err = new Error(`Missing normalized values for tags: ${missingTags.join(', ')}`);
    err.statusCode = 500;
    err.errorCode = 'PRESCRIPTION_VALUES_INCOMPLETE';
    err.details = { missingTags };
    throw err;
  }

  return {
    requirementValues,
    normalizedPrescription: {
      ...prescription,
      diagnosis,
      chiefComplaints: complaintsPayload.chiefComplaints || undefined,
      peFindings: complaintsPayload.peFindings || undefined,
      medications,
      specialInstructions: instructionsPayload.specialInstructions || undefined,
      advice: instructionsPayload.advice || undefined,
      followUpDate: followUpDate || undefined,
    },
  };
}

function parsePrescriptionRequirementRows(rows = []) {
  const byTag = new Map();

  rows.forEach((row) => {
    const tag = normalizeTag(row?.vartag);
    if (!tag) return;
    byTag.set(tag, row?.data ?? '');
  });

  const missingTags = PRESCRIPTION_REQUIRED_TAGS.filter((tag) => !byTag.has(tag));
  if (missingTags.length > 0) {
    const err = new Error(`Normalized prescription data is missing tags: ${missingTags.join(', ')}`);
    err.statusCode = 500;
    err.errorCode = 'PRESCRIPTION_DATA_INCOMPLETE';
    err.details = { missingTags };
    throw err;
  }

  const rawComplaints = byTag.get('complaints') || '';
  const complaintsObj = parseJsonSafe(rawComplaints, null);

  const rawInstructions = byTag.get('instructions') || '';
  const instructionsObj = parseJsonSafe(rawInstructions, null);

  const rawMedications = byTag.get('medications') || '[]';
  const medicationsArray = parseJsonSafe(rawMedications, []);

  return {
    diagnosis: pickFirstNonEmpty(byTag.get('diagnosis')) || 'Not specified',
    chiefComplaints: complaintsObj
      ? pickFirstNonEmpty(complaintsObj.chiefComplaints, complaintsObj.complaints)
      : pickFirstNonEmpty(rawComplaints),
    peFindings: complaintsObj
      ? pickFirstNonEmpty(complaintsObj.peFindings)
      : undefined,
    medications: normalizeMedications(medicationsArray),
    specialInstructions: instructionsObj
      ? pickFirstNonEmpty(
          instructionsObj.specialInstructions,
          instructionsObj.instructions
        )
      : pickFirstNonEmpty(rawInstructions),
    advice: instructionsObj
      ? pickFirstNonEmpty(instructionsObj.advice)
      : undefined,
    followUpDate:
      pickFirstNonEmpty(byTag.get('follow_up')) === 'Not specified'
        ? undefined
        : pickFirstNonEmpty(byTag.get('follow_up')) || undefined,
  };
}

module.exports = {
  PRESCRIPTION_TEMPLATE_NAME,
  PRESCRIPTION_DOC_TYPE,
  PRESCRIPTION_REQUIRED_TAGS,
  GENERIC_BINARY_TAG,
  normalizeTag,
  parseJsonSafe,
  buildPrescriptionRequirementValues,
  parsePrescriptionRequirementRows,
};
