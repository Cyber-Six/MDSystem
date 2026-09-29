jest.mock('../../utils/logger.js', () => ({ info: jest.fn() }));
const logger = require('../../utils/logger.js');
const m = require('./medical-certificate-normalized');

test('publishes stable required tag definitions and normalizes tags and signatures', () => {
  expect(m.MEDICAL_CERTIFICATE_REQUIRED_TAGS).toContain('doctor_signature');
  expect(m.normalizeTag('  Valid_From ')).toBe('valid_from');
  expect(m.normalizeTag(null)).toBe('');
  expect(m.normalizeTag()).toBe('');
  expect(m.buildMedicalCertificateRequirementValues({ physician: { signatureBase64: 'YWJj', signaturePath: '/sig', licenseNo: 'L', ptrNo: 'P' } }).normalizedPhysician.signature).toEqual({
    path: '/sig', hash: expect.any(String), base64: 'data:image/png;base64,YWJj', mimeType: 'image/png',
  });
  expect(m.buildMedicalCertificateRequirementValues({ physician: { doctorSignature: { dataUri: 'data:image/svg+xml;base64,AA', type: 'image/svg+xml', fsPath: '/p', sha256: 'hash' } } }).normalizedPhysician.signature).toEqual({
    path: '/p', hash: 'hash', base64: 'data:image/svg+xml;base64,AA', mimeType: 'image/svg+xml',
  });
  expect(m.buildMedicalCertificateRequirementValues({ physician: { signature: { data: 'x', filePath: '/x', hash: 'given' } } }).normalizedPhysician.signature.hash).toBe('given');
  expect(m.buildMedicalCertificateRequirementValues({}).normalizedPhysician.signature).toEqual({ path: null, hash: null, base64: null, mimeType: null });
});

test('validates PDF bytes and records a deterministic audit hash and storage path', () => {
  expect(() => m.assertPdfBuffer(Buffer.from('%PDF-1.7'))).not.toThrow();
  for (const value of [null, Buffer.alloc(0)]) expect(() => m.assertPdfBuffer(value)).toThrow(expect.objectContaining({ errorCode: 'MEDICAL_CERTIFICATE_PDF_BUFFER_INVALID' }));
  expect(() => m.assertPdfBuffer(Buffer.from('NOPE'))).toThrow(expect.objectContaining({ details: expect.objectContaining({ header: 'NOPE' }) }));
  expect(() => m.assertPdfBuffer(null)).toThrow(expect.objectContaining({ details: { templateType: 'medical-certificate', stage: 'unknown' } }));
  const record = m.createPdfAuditRecord(Buffer.from('%PDF-1.7'), { documentId: 7, stage: 'stored' });
  expect(record).toMatchObject({ templateType: 'medical-certificate', storagePath: 'PatientDocuments/7', filePath: 'PatientDocuments/7', byteLength: 8 });
  expect(logger.info).toHaveBeenCalledWith('Medical certificate PDF buffer audit', expect.objectContaining({ stage: 'stored' }));
  expect(m.createPdfAuditRecord(Buffer.from('%PDF'), { templateType: 'custom', storagePath: '/x', filePath: '/y' })).toMatchObject({ templateType: 'custom', storagePath: '/x', filePath: '/y' });
  expect(m.createPdfAuditRecord(Buffer.from('%PDF'), {})).toMatchObject({ templateType: 'medical-certificate', storagePath: null, filePath: null });
  expect(m.createPdfAuditRecord(Buffer.from('%PDF'))).toMatchObject({ templateType: 'medical-certificate', storagePath: null, filePath: null });
});

test('builds normalized certificate and defaults optional dates, fields, and clinician identifiers', () => {
  expect(m.buildMedicalCertificateRequirementValues()).toMatchObject({ requirementValues: { purpose: 'General Medical Evaluation', diagnosis: 'Not specified', valid_from: 'Not specified' } });
  const { requirementValues, normalizedCertificate, normalizedPhysician } = m.buildMedicalCertificateRequirementValues({ certificate: { startDate: '2026-01-01', endDate: '2026-02-01', purpose: ' Work ', restrictions: '', remarks: ' note ' } });
  expect(requirementValues).toMatchObject({ purpose: 'Work', diagnosis: 'Not specified', recommendations: 'Follow physician instructions.', valid_from: '2026-01-01', valid_until: '2026-02-01', ptr_number: 'Not Provided', license_number: 'Not Provided' });
  expect(normalizedCertificate).toMatchObject({ purpose: 'Work', validFrom: '2026-01-01', restrictions: undefined, remarks: 'note' });
  expect(normalizedPhysician.signature).toEqual({ path: null, hash: null, base64: null, mimeType: null });
  const explicit = m.buildMedicalCertificateRequirementValues({ certificate: { valid_from: 'a', validityFrom: 'b', valid_until: 'c', validityUntil: 'd', diagnosis: 'D', recommendations: 'R' }, physician: { ptr_number: 'P', license_number: 'L' } });
  expect(explicit.normalizedCertificate).toMatchObject({ validFrom: 'a', validUntil: 'c' });
  expect(explicit.normalizedPhysician).toMatchObject({ ptrNo: 'P', licenseNo: 'L' });
  const physicianAliases = m.buildMedicalCertificateRequirementValues({ physician: { signature: { mimeType: 'image/jpeg', path: '/sig', sha256: 'sha' }, ptrNumber: 'PTR-2', licenseNumber: 'LIC-2' } });
  expect(physicianAliases.normalizedPhysician.signature).toEqual({ path: '/sig', hash: 'sha', base64: null, mimeType: null });
  expect(physicianAliases.normalizedPhysician).toMatchObject({ ptrNo: 'PTR-2', licenseNo: 'LIC-2' });
});

test('parses complete current and legacy certificate rows, and defaults optional blanks', () => {
  const rows = [null, { vartag: '  PURPOSE ', data: ' Fitness ' }, { vartag: 'diagnosis', data: null }, { vartag: 'recommendations', data: '' }, { vartag: 'validity', data: JSON.stringify({ validFrom: '2026-01', validUntil: 'not specified' }) }, { vartag: 'doctor_signature', data: '{bad' }, { vartag: 'restrictions', data: ' ' }];
  expect(m.parseMedicalCertificateRequirementRows(rows)).toEqual({ purpose: 'Fitness', diagnosis: 'Not specified', recommendations: 'Follow physician instructions.', validFrom: '2026-01', validUntil: undefined, restrictions: undefined, remarks: undefined, doctorSignature: null, ptrNumber: undefined, licenseNumber: undefined });
  expect(m.parseMedicalCertificateRequirementRows([{ vartag: 'purpose', data: 'P' }, { vartag: 'diagnosis', data: 'D' }, { vartag: 'recommendations', data: 'R' }, { vartag: 'valid_from', data: 'F' }]).validFrom).toBe('F');
  expect(m.parseMedicalCertificateRequirementRows([{ vartag: 'purpose' }, { vartag: 'diagnosis' }, { vartag: 'recommendations' }, { vartag: 'validity', data: '{bad json' }, { vartag: 'doctor_signature', data: 'null' }])).toMatchObject({ purpose: 'General Medical Evaluation', validFrom: undefined, validUntil: undefined, doctorSignature: null });
  expect(m.parseMedicalCertificateRequirementRows([{ vartag: 'purpose', data: 'P' }, { vartag: 'diagnosis', data: 'D' }, { vartag: 'recommendations', data: 'R' }, { vartag: 'validity', data: JSON.stringify({ validFrom: 'F', validUntil: 'U' }) }])).toMatchObject({ validFrom: 'F', validUntil: 'U' });
  expect(() => m.parseMedicalCertificateRequirementRows([])).toThrow(expect.objectContaining({ errorCode: 'MEDICAL_CERTIFICATE_DATA_INCOMPLETE' }));
  expect(() => m.parseMedicalCertificateRequirementRows()).toThrow(expect.objectContaining({ errorCode: 'MEDICAL_CERTIFICATE_DATA_INCOMPLETE' }));
  expect(() => m.parseMedicalCertificateRequirementRows([{ vartag: 'purpose' }, { vartag: 'diagnosis' }, { vartag: 'recommendations' }])).toThrow(expect.objectContaining({ details: { missingTags: ['valid_from', 'valid_until'] } }));
});
