const crypto = require('crypto');

const MEDICAL_CERTIFICATE_TEMPLATE_NAME = 'medical-certificate';
const MEDICAL_CERTIFICATE_DOC_TYPE = 'medical-certificate';
const MEDICAL_CERTIFICATE_VALIDITY_TAGS = Object.freeze(['valid_from', 'valid_until']);
const MEDICAL_CERTIFICATE_LEGACY_VALIDITY_TAG = 'validity';

const MEDICAL_CERTIFICATE_CORE_TAGS = Object.freeze([
  'purpose',
  'diagnosis',
  'recommendations',
  ...MEDICAL_CERTIFICATE_VALIDITY_TAGS,
]);

const MEDICAL_CERTIFICATE_REQUIRED_TAGS = Object.freeze([
  ...MEDICAL_CERTIFICATE_CORE_TAGS,
  'restrictions',
  'remarks',
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

function hashString(value = '') {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function toOptionalField(value) {
  const text = pickFirstNonEmpty(value);
  if (!text) return undefined;
  return text.toLowerCase() === 'not specified' ? undefined : text;
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

function buildMedicalCertificateRequirementValues(documentPayload = {}) {
  const certificate = documentPayload?.certificate || {};
  const physician = documentPayload?.physician || {};

  const purpose = pickFirstNonEmpty(certificate.purpose) || 'General Medical Evaluation';
  const diagnosis = pickFirstNonEmpty(certificate.diagnosis) || 'Not specified';
  const recommendations =
    pickFirstNonEmpty(certificate.recommendations) || 'Follow physician instructions.';

  const validFrom = pickFirstNonEmpty(
    certificate.validFrom,
    certificate.valid_from,
    certificate.validityFrom,
    certificate.startDate
  );

  const validUntil = pickFirstNonEmpty(
    certificate.validUntil,
    certificate.valid_until,
    certificate.validityUntil,
    certificate.endDate
  );

  const restrictions = pickFirstNonEmpty(certificate.restrictions);
  const remarks = pickFirstNonEmpty(certificate.remarks);

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
    purpose,
    diagnosis,
    recommendations,
    valid_from: validFrom || 'Not specified',
    valid_until: validUntil || 'Not specified',
    restrictions,
    remarks,
    doctor_signature: JSON.stringify(doctorSignature),
    ptr_number: ptrNumber,
    license_number: licenseNumber,
  };

  const missingTags = MEDICAL_CERTIFICATE_REQUIRED_TAGS.filter(
    (tag) => !Object.prototype.hasOwnProperty.call(requirementValues, tag)
  );

  if (missingTags.length > 0) {
    const err = new Error(`Missing normalized values for tags: ${missingTags.join(', ')}`);
    err.statusCode = 500;
    err.errorCode = 'MEDICAL_CERTIFICATE_VALUES_INCOMPLETE';
    err.details = { missingTags };
    throw err;
  }

  return {
    requirementValues,
    normalizedCertificate: {
      ...certificate,
      purpose,
      diagnosis,
      recommendations,
      validFrom: validFrom || undefined,
      validUntil: validUntil || undefined,
      restrictions: restrictions || undefined,
      remarks: remarks || undefined,
    },
    normalizedPhysician: {
      ...physician,
      licenseNo: licenseNumber === 'Not Provided' ? physician.licenseNo : licenseNumber,
      ptrNo: ptrNumber === 'Not Provided' ? physician.ptrNo : ptrNumber,
      signature: doctorSignature,
    },
  };
}

function parseMedicalCertificateRequirementRows(rows = []) {
  const byTag = new Map();

  rows.forEach((row) => {
    const tag = normalizeTag(row?.vartag);
    if (!tag) return;
    byTag.set(tag, row?.data ?? '');
  });

  const missingTags = ['purpose', 'diagnosis', 'recommendations'].filter(
    (tag) => !byTag.has(tag)
  );
  if (missingTags.length > 0) {
    const err = new Error(
      `Normalized medical certificate data is missing tags: ${missingTags.join(', ')}`
    );
    err.statusCode = 500;
    err.errorCode = 'MEDICAL_CERTIFICATE_DATA_INCOMPLETE';
    err.details = { missingTags };
    throw err;
  }

  const hasValidityRange = MEDICAL_CERTIFICATE_VALIDITY_TAGS.some((tag) => byTag.has(tag));
  const hasLegacyValidity = byTag.has(MEDICAL_CERTIFICATE_LEGACY_VALIDITY_TAG);
  if (!hasValidityRange && !hasLegacyValidity) {
    const err = new Error(
      'Normalized medical certificate data is missing validity tags: valid_from and valid_until'
    );
    err.statusCode = 500;
    err.errorCode = 'MEDICAL_CERTIFICATE_DATA_INCOMPLETE';
    err.details = { missingTags: MEDICAL_CERTIFICATE_VALIDITY_TAGS };
    throw err;
  }

  const validityObj = parseJsonSafe(
    byTag.get(MEDICAL_CERTIFICATE_LEGACY_VALIDITY_TAG) || '{}',
    {}
  );
  const signatureObj = parseJsonSafe(byTag.get('doctor_signature') || '', null);

  const ptrNumber = pickFirstNonEmpty(byTag.get('ptr_number'));
  const licenseNumber = pickFirstNonEmpty(byTag.get('license_number'));

  return {
    purpose: pickFirstNonEmpty(byTag.get('purpose')) || 'General Medical Evaluation',
    diagnosis: pickFirstNonEmpty(byTag.get('diagnosis')) || 'Not specified',
    recommendations:
      pickFirstNonEmpty(byTag.get('recommendations')) || 'Follow physician instructions.',
    validFrom: toOptionalField(
      pickFirstNonEmpty(byTag.get('valid_from'), validityObj?.validFrom)
    ),
    validUntil: toOptionalField(
      pickFirstNonEmpty(byTag.get('valid_until'), validityObj?.validUntil)
    ),
    restrictions: pickFirstNonEmpty(byTag.get('restrictions')) || undefined,
    remarks: pickFirstNonEmpty(byTag.get('remarks')) || undefined,
    doctorSignature: signatureObj,
    ptrNumber: ptrNumber || undefined,
    licenseNumber: licenseNumber || undefined,
  };
}

module.exports = {
  MEDICAL_CERTIFICATE_TEMPLATE_NAME,
  MEDICAL_CERTIFICATE_DOC_TYPE,
  MEDICAL_CERTIFICATE_VALIDITY_TAGS,
  MEDICAL_CERTIFICATE_CORE_TAGS,
  MEDICAL_CERTIFICATE_REQUIRED_TAGS,
  normalizeTag,
  buildMedicalCertificateRequirementValues,
  parseMedicalCertificateRequirementRows,
};