const crypto = require('crypto');

const PRESCRIPTION_TEMPLATE_NAME = 'Prescription';
const PRESCRIPTION_DOC_TYPE = 'prescription';
const GENERIC_BINARY_TAG = 'payload';

const PRESCRIPTION_CORE_TAGS = Object.freeze([
  'complaints',
  'diagnosis',
  'medications',
  'instructions',
  'follow_up',
]);

const PRESCRIPTION_REQUIRED_TAGS = Object.freeze([
  ...PRESCRIPTION_CORE_TAGS,
  'doctor_signature',
  'ptr_number',
  'license_number',
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

function hashString(value = '') {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function toDataUrl(base64Value, mimeType = 'image/png') {
  const text = pickFirstNonEmpty(base64Value);
  if (!text) return '';
  if (text.startsWith('data:')) return text;
  return `data:${mimeType};base64,${text}`;
}

function normalizeDoctorSignature(physician = {}) {
  const signature = physician?.signature || physician?.doctorSignature || {};
  const base64Source = pickFirstNonEmpty(
    signature.base64,
    signature.data,
    signature.dataUri,
    physician.signatureBase64
  );

  const mimeType = pickFirstNonEmpty(signature.mimeType, signature.type, 'image/png');
  const dataUrl = toDataUrl(base64Source, mimeType);
  const signaturePath = pickFirstNonEmpty(
    signature.path,
    signature.fsPath,
    signature.filePath,
    physician.signaturePath
  );

  const signatureHash = pickFirstNonEmpty(
    signature.hash,
    signature.sha256,
    physician.signatureHash,
    dataUrl ? hashString(dataUrl) : ''
  );

  return {
    path: signaturePath || null,
    hash: signatureHash || null,
    base64: dataUrl || null,
    mimeType: dataUrl ? mimeType : null,
  };
}

function assertPdfBuffer(buffer, context = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error('Generated prescription PDF is empty or missing.');
    err.statusCode = 500;
    err.errorCode = 'PRESCRIPTION_PDF_BUFFER_INVALID';
    err.details = {
      templateType: context.templateType || PRESCRIPTION_DOC_TYPE,
      stage: context.stage || 'unknown',
    };
    throw err;
  }

  const header = buffer.slice(0, 4).toString('utf8');
  if (header !== '%PDF') {
    const err = new Error('Generated prescription payload is not a valid PDF buffer.');
    err.statusCode = 500;
    err.errorCode = 'PRESCRIPTION_PDF_BUFFER_INVALID';
    err.details = {
      templateType: context.templateType || PRESCRIPTION_DOC_TYPE,
      stage: context.stage || 'unknown',
      header,
    };
    throw err;
  }
}

function createPdfAuditRecord(buffer, context = {}) {
  assertPdfBuffer(buffer, context);

  const templateType = context.templateType || PRESCRIPTION_DOC_TYPE;
  const storagePath =
    context.storagePath ||
    (context.documentId ? `PatientDocuments/${context.documentId}` : null);
  const filePath = context.filePath || storagePath;

  return {
    templateType,
    storagePath,
    filePath,
    sha256: hashBuffer(buffer),
    byteLength: buffer.length,
  };
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
  const physician = documentPayload?.physician || {};

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

  const doctorSignature = normalizeDoctorSignature(physician);
  const ptrNumber = pickFirstNonEmpty(
    physician.ptrNo,
    physician.ptr_number,
    physician.ptrNumber
  ) || 'Not Provided';

  const licenseNumber = pickFirstNonEmpty(
    physician.licenseNo,
    physician.license_number,
    physician.licenseNumber
  ) || 'Not Provided';

  const requirementValues = {
    complaints: JSON.stringify(complaintsPayload),
    diagnosis,
    medications: JSON.stringify(medications),
    instructions: JSON.stringify(instructionsPayload),
    follow_up: followUpDate || 'Not specified',
    doctor_signature: JSON.stringify(doctorSignature),
    ptr_number: ptrNumber,
    license_number: licenseNumber,
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
    normalizedPhysician: {
      ...physician,
      licenseNo: licenseNumber === 'Not Provided' ? physician.licenseNo : licenseNumber,
      ptrNo: ptrNumber === 'Not Provided' ? physician.ptrNo : ptrNumber,
      signature: doctorSignature,
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

  const missingTags = PRESCRIPTION_CORE_TAGS.filter((tag) => !byTag.has(tag));
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

  const signatureRaw = byTag.get('doctor_signature') || '';
  const signatureObj = parseJsonSafe(signatureRaw, null);

  const ptrNumber = pickFirstNonEmpty(byTag.get('ptr_number'));
  const licenseNumber = pickFirstNonEmpty(byTag.get('license_number'));

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
    doctorSignature: signatureObj,
    ptrNumber: ptrNumber || undefined,
    licenseNumber: licenseNumber || undefined,
  };
}

module.exports = {
  PRESCRIPTION_TEMPLATE_NAME,
  PRESCRIPTION_DOC_TYPE,
  PRESCRIPTION_CORE_TAGS,
  PRESCRIPTION_REQUIRED_TAGS,
  GENERIC_BINARY_TAG,
  normalizeTag,
  parseJsonSafe,
  assertPdfBuffer,
  createPdfAuditRecord,
  buildPrescriptionRequirementValues,
  parsePrescriptionRequirementRows,
};
