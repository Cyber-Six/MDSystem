let mockDoc;
const mockText = jest.fn(() => mockDoc);
mockDoc = new Proxy({ y: 100, page: { width: 420, height: 595, margins: { top: 34, bottom: 40, left: 40, right: 40 } } }, {
  get(target, key) { if (key in target) return target[key]; if (key === 'heightOfString') return jest.fn(() => 12); if (key === 'text') return mockText; return jest.fn(() => mockDoc); },
});
jest.mock('fs', () => ({ existsSync: jest.fn(), readFileSync: jest.fn(() => { throw new Error('file missing'); }) }));
jest.mock('../../pdfkit', () => ({ DEFAULT_MARGINS: {}, createDocument: jest.fn(() => mockDoc), toBuffer: jest.fn().mockResolvedValue(Buffer.from('pdf')), streamToResponse: jest.fn(), downloadToResponse: jest.fn() }));

const pdf = require('../../pdfkit');
const fs = require('fs');
const Prescription = require('./prescription');

test('builds the prescription sections for clinical and medication data', async () => {
  const template = new Prescription().setData({ patient: { firstName: 'Ana', middleName: '', lastName: 'Cruz', dateOfBirth: '1990-01-01', sex: 'Female' }, issuedDate: '2026-01-02', prescription: { chiefComplaints: 'Headache', peFindings: 'Normal', diagnosis: 'Migraine', medications: [{ name: 'Drug', dosage: '1 tab', frequency: 'daily', duration: '5 days', quantity: 5, instructions: 'After meals' }], advice: 'Rest', followUpDate: '2026-01-10', specialInstructions: 'Finish course' }, physician: { firstName: 'Doc', lastName: 'Test', licenseNo: 'L1' } });
  await expect(template.build()).resolves.toBe(template);
  expect([Prescription.type, Prescription.displayName, Prescription.persistToDatabase]).toEqual(['prescription', 'Prescription', true]);
  expect(mockText).toHaveBeenCalledWith('Headache', expect.any(Number), expect.any(Number), expect.any(Object));
  expect(mockText).toHaveBeenCalledWith('  • Migraine', expect.any(Number), expect.any(Number), expect.any(Object));
  expect(mockText).toHaveBeenCalledWith('1. Drug', expect.any(Number), expect.any(Number), expect.any(Object));
});

test('supplies sample data and delegates buffer, stream, and download operations', async () => {
  expect(Prescription.getSampleData().prescription.medications).toHaveLength(2);
  const template = new Prescription().init();
  await expect(template.toBuffer()).resolves.toEqual(Buffer.from('pdf'));
  template.streamToResponse({}, 'rx.pdf'); template.downloadToResponse({}, 'rx.pdf');
  expect(pdf.streamToResponse).toHaveBeenCalled();
  expect(pdf.downloadToResponse).toHaveBeenCalled();
});

test('renders an available logo and signature across data URL, base64, file, empty, and failing-image cases', () => {
  mockDoc.image = jest.fn();
  const template = new Prescription().setData({ physician: { firstName: 'Doc', lastName: 'Test', licenseNo: 'L1', ptrNo: 'P2' } }).init();
  fs.readFileSync.mockReturnValueOnce(Buffer.from('logo')).mockReturnValueOnce(Buffer.from('signature'));
  fs.existsSync.mockReturnValue(true);
  template._drawHeader();
  template.data.physician.signature = { path: '/signature.png' };
  template._drawSignature();
  template.data.physician.signature = { base64: 'data:image/png;base64,QUJD' };
  template._drawSignature();
  template.data.physician.signature = { base64: 'QUJD' };
  template._drawSignature();
  template.data.physician.signature = { base64: 'data:image/png;base64,' };
  template._drawSignature();
  template.data.physician.signature = { path: '/broken.png' };
  fs.existsSync.mockReturnValueOnce(true);
  fs.readFileSync.mockImplementationOnce(() => { throw new Error('unreadable'); });
  template._drawSignature();
  template.data.physician.signature = { base64: 'QUJD' };
  mockDoc.image.mockImplementationOnce(() => { throw new Error('invalid signature image'); });
  template._drawSignature();
  expect(mockDoc.image).toHaveBeenCalled();
  expect(mockDoc.image.mock.calls[0][0]).toEqual(Buffer.from('logo'));
});

test('handles absent clinical sections and sparse medicine/physician data', () => {
  const template = new Prescription().setData({ prescription: { medications: [] } }).init();
  template.data.patient = null;
  template.data.physician = null;
  template._drawPatientInfo();
  template._drawClinicalTable();
  template.data.prescription.diagnosis = ';\n ';
  template._drawDiagnosis();
  template._drawMedicationTable();
  template._drawAdvice();
  template._drawFollowUp();
  template._drawSignature();

  template.data.prescription = {
    chiefComplaints: 'Pain', diagnosis: 'One; Two', specialInstructions: 'Return; if worse',
    medications: [{ name: 'Plain tablet', dosage: '', frequency: '', duration: '', quantity: 0, instructions: '' }],
  };
  template.data.patient = { firstName: '', middleName: '', lastName: '', suffix: '', age: 0, sex: '' };
  template.data.physician = { firstName: '', lastName: '', licenseNo: '', ptrNo: '', signature: {} };
  template._drawPatientInfo();
  template._drawClinicalTable();
  template._drawDiagnosis();
  template._drawMedicationTable();
  template._drawAdvice();
  template._drawSignature();

  template.data.prescription = { peFindings: 'Normal exam' };
  template._drawDiagnosis();
  template._drawMedicationTable();
  template.data.prescription.medications = [{ name: 'Named medicine', frequency: 'daily', quantity: 2 }];
  template._drawClinicalTable();
  template._drawMedicationTable();
  template.data.prescription.advice = 'Hydrate';
  template._drawAdvice();
  template.data.prescription.followUpDate = '2026-01-10';
  template._drawFollowUp();
});
