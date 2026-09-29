jest.mock('../../utils/logger.js', () => ({ info: jest.fn() }));
const logger = require('../../utils/logger.js');
const m = require('./prescription-normalized');

const baseRows = () => [
  { vartag: 'complaints', data: JSON.stringify({ chiefComplaints: 'Headache', peFindings: 'Normal' }) },
  { vartag: 'diagnosis', data: 'Migraine' },
  { vartag: 'medications', data: JSON.stringify([{ medicineName: 'Drug', quantity: '2' }]) },
  { vartag: 'instructions', data: JSON.stringify({ instructions: 'Rest', advice: 'Hydrate' }) },
  { vartag: 'follow_up', data: '2026-03-01' },
];

test('normalizes tags, safe JSON, and clinician signatures', () => {
  expect(m.normalizeTag(' Diagnosis ')).toBe('diagnosis');
  expect(m.normalizeTag()).toBe('');
  expect(m.parseJsonSafe('{bad}', 3)).toBe(3);
  expect(m.parseJsonSafe('  ', 4)).toBe(4);
  expect(m.parseJsonSafe()).toBeNull();
  expect(m.parseJsonSafe(null, 'fallback')).toBe('fallback');
  expect(m.parseJsonSafe('null')).toBeNull();
  const prescription = { medications: [{ name: 'Pill' }] };
  expect(m.buildPrescriptionRequirementValues({ prescription, physician: { signatureBase64: 'abc', signaturePath: '/sig' } }).normalizedPhysician.signature).toEqual({ path: '/sig', hash: expect.any(String), base64: 'data:image/png;base64,abc', mimeType: 'image/png' });
  expect(m.buildPrescriptionRequirementValues({ prescription, physician: { doctorSignature: { dataUri: 'data:x', mimeType: 'image/svg+xml', filePath: '/p', hash: 'h' } } }).normalizedPhysician.signature).toEqual({ path: '/p', hash: 'h', base64: 'data:x', mimeType: 'image/svg+xml' });
  expect(m.buildPrescriptionRequirementValues({ prescription, physician: { signature: { data: 'b', type: 'image/gif', fsPath: '/f', sha256: 'sh' } } }).normalizedPhysician.signature).toEqual({ path: '/f', hash: 'sh', base64: 'data:image/gif;base64,b', mimeType: 'image/gif' });
  expect(m.buildPrescriptionRequirementValues({ prescription, physician: { signatureHash: 'h' } }).normalizedPhysician.signature.hash).toBe('h');
  expect(m.buildPrescriptionRequirementValues({ prescription }).normalizedPhysician.signature).toEqual({ path: null, hash: null, base64: null, mimeType: null });
});

test('validates and audits PDF content and context', () => {
  expect(() => m.assertPdfBuffer(Buffer.from('%PDF-1.7'))).not.toThrow();
  for (const value of [null, Buffer.alloc(0)]) expect(() => m.assertPdfBuffer(value)).toThrow(expect.objectContaining({ errorCode: 'PRESCRIPTION_PDF_BUFFER_INVALID' }));
  expect(() => m.assertPdfBuffer(Buffer.from('NOPE'))).toThrow(expect.objectContaining({ details: expect.objectContaining({ header: 'NOPE' }) }));
  expect(m.createPdfAuditRecord(Buffer.from('%PDF'), { documentId: 4 })).toMatchObject({ templateType: 'prescription', storagePath: 'PatientDocuments/4', filePath: 'PatientDocuments/4' });
  expect(m.createPdfAuditRecord(Buffer.from('%PDF'), { templateType: 'x', storagePath: '/a', filePath: '/b' })).toMatchObject({ templateType: 'x', storagePath: '/a', filePath: '/b' });
  expect(m.createPdfAuditRecord(Buffer.from('%PDF'))).toMatchObject({ templateType: 'prescription', storagePath: null, filePath: null });
  expect(logger.info).toHaveBeenCalledWith('Prescription PDF buffer audit', expect.any(Object));
});

test('normalizes medication aliases, quantities, and invalid entries', () => {
  expect(m.buildPrescriptionRequirementValues({ prescription: { medications: [{ name: ' A ', dosage: ' 5 ', qty: '3' }, { medicineName: 'B', quantity: 'bad' }, {}, null] } }).normalizedPrescription.medications).toEqual([
    { name: 'A', dosage: '5', frequency: '', duration: '', qty: 3, instructions: '' },
    { name: 'B', dosage: '', frequency: '', duration: '', qty: null, instructions: '' },
  ]);
  expect(m.buildPrescriptionRequirementValues({ prescription: { medications: [{ name: 'C', qty: null }, { name: 'D', qty: '' }, { name: 'E' }] } }).normalizedPrescription.medications.map(item => item.qty)).toEqual([null, null, null]);
  expect(() => m.buildPrescriptionRequirementValues({ prescription: { medications: null } })).toThrow(expect.objectContaining({ errorCode: 'MEDICATIONS_REQUIRED' }));
  expect(() => m.buildPrescriptionRequirementValues()).toThrow(expect.objectContaining({ errorCode: 'MEDICATIONS_REQUIRED' }));
});

test('builds prescription fields from aliases and defaults, requiring at least one named medicine', () => {
  expect(() => m.buildPrescriptionRequirementValues({ prescription: { medications: [{ name: ' ' }] } })).toThrow(expect.objectContaining({ statusCode: 400, errorCode: 'MEDICATIONS_REQUIRED' }));
  const result = m.buildPrescriptionRequirementValues({ prescription: { complaints: 'Pain', instructions: 'Take care', follow_up: 'tomorrow', medications: [{ name: 'Drug', quantity: 2 }] }, physician: { ptrNumber: 'P', licenseNumber: 'L' } });
  expect(JSON.parse(result.requirementValues.complaints)).toEqual({ chiefComplaints: 'Pain', peFindings: '' });
  expect(JSON.parse(result.requirementValues.instructions)).toEqual({ specialInstructions: 'Take care', advice: '' });
  expect(result.normalizedPrescription).toMatchObject({ diagnosis: 'Not specified', followUpDate: 'tomorrow', medications: [{ name: 'Drug', qty: 2 }] });
  expect(result.normalizedPhysician).toMatchObject({ ptrNo: 'P', licenseNo: 'L' });
  const defaults = m.buildPrescriptionRequirementValues({ prescription: { diagnosis: 'Dx', advice: 'advice', followUp: 'later', medications: [{ name: 'M', qty: 0, quantity: 3 }] } });
  expect(defaults.normalizedPrescription).toMatchObject({ diagnosis: 'Dx', advice: 'advice', followUpDate: 'later' });
  expect(JSON.parse(defaults.requirementValues.complaints).chiefComplaints).toBe('Dx');
  const peOnly = m.buildPrescriptionRequirementValues({ prescription: { peFindings: 'Clear', medications: [{ name: 'M' }] }, physician: null });
  expect(peOnly.normalizedPrescription).toMatchObject({ peFindings: 'Clear', chiefComplaints: undefined });
});

test('parses structured and legacy prescription rows and rejects missing core tags', () => {
  const rows = [...baseRows(), { vartag: 'doctor_signature', data: '{bad' }, { vartag: 'ptr_number', data: ' P ' }, { vartag: 'license_number', data: 'L' }, null];
  expect(m.parsePrescriptionRequirementRows(rows)).toMatchObject({ diagnosis: 'Migraine', chiefComplaints: 'Headache', peFindings: 'Normal', specialInstructions: 'Rest', advice: 'Hydrate', followUpDate: '2026-03-01', ptrNumber: 'P', licenseNumber: 'L', doctorSignature: null, medications: [{ name: 'Drug', qty: 2 }] });
  const legacy = baseRows().map(row => row.vartag === 'complaints' ? { ...row, data: 'Old complaints' } : row).map(row => row.vartag === 'instructions' ? { ...row, data: 'Old instructions' } : row).map(row => row.vartag === 'medications' ? { ...row, data: 'invalid' } : row);
  expect(m.parsePrescriptionRequirementRows(legacy)).toMatchObject({ chiefComplaints: 'Old complaints', peFindings: undefined, specialInstructions: 'Old instructions', advice: undefined, medications: [] });
  expect(m.parsePrescriptionRequirementRows([
    { vartag: 'complaints', data: '' }, { vartag: 'diagnosis', data: null },
    { vartag: 'medications', data: '' }, { vartag: 'instructions', data: '' },
    { vartag: 'follow_up', data: '' },
  ])).toMatchObject({ chiefComplaints: '', diagnosis: 'Not specified', specialInstructions: '', medications: [], followUpDate: undefined });
  expect(() => m.parsePrescriptionRequirementRows([])).toThrow(expect.objectContaining({ errorCode: 'PRESCRIPTION_DATA_INCOMPLETE' }));
  expect(() => m.parsePrescriptionRequirementRows()).toThrow(expect.objectContaining({ errorCode: 'PRESCRIPTION_DATA_INCOMPLETE' }));
  expect(m.parsePrescriptionRequirementRows(baseRows().map(r => r.vartag === 'follow_up' ? { ...r, data: 'Not specified' } : r)).followUpDate).toBeUndefined();
});
