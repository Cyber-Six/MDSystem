jest.mock('../../utils/logger.js', () => ({ debug: jest.fn() }));
jest.mock('./templates/medical-certificate.js', () => class MedicalCertificate { static type='medical-certificate'; static displayName='Certificate'; static persistToDatabase=true; static getSampleData=()=>({ sample: 1 }); constructor(options){this.options=options;} setData(data){this.data=data;} async build(){this.doc={ pdf: true };} getDocument(){return this.doc;} generateFilename(){return 'certificate.pdf';} streamToResponse(...args){this.stream=args;} downloadToResponse(...args){this.download=args;} async toBuffer(){return Buffer.from('%PDF');} });
jest.mock('./templates/prescription.js', () => class Prescription { static type='prescription'; static displayName='Prescription'; static persistToDatabase=true; static getSampleData=()=>({ rx: 1 }); constructor(options){this.options=options;} setData(data){this.data=data;} async build(){this.doc={ rx: true };} getDocument(){return this.doc;} generateFilename(){return 'rx.pdf';} streamToResponse(...args){this.stream=args;} downloadToResponse(...args){this.download=args;} async toBuffer(){return Buffer.from('%PDF');} });
jest.mock('./templates/diagnosis-report.js', () => class Diagnosis { static type='diagnosis-report'; static displayName='Diagnosis'; static persistToDatabase=false; static getSampleData=()=>({ report: 1 }); });
jest.mock('./templates/staff-report.js', () => class Staff { static type='staff-report'; static displayName='Staff report'; static persistToDatabase=false; static getSampleData=()=>({ staff: 1 }); });
const api = require('./index');

test('lists registered templates, metadata, lookups, samples, and persistence policy', () => {
  expect(api.getAvailableTemplates()).toEqual(['medical-certificate', 'prescription', 'diagnosis-report', 'staff-report']);
  expect(api.getTemplateMetadata()).toHaveLength(4);
  expect(api.getTemplate('unknown')).toBeNull();
  expect(api.getSampleData('unknown')).toBeNull();
  expect(api.getSampleData('prescription')).toEqual({ rx: 1 });
  expect(api.shouldPersist('medical-certificate')).toBe(true);
  expect(api.shouldPersist('diagnosis-report')).toBe(false);
  expect(api.shouldPersist('unknown')).toBe(false);
});

test('builds a document and rejects an unsupported template', async () => {
  const result = await api.generateDocument('medical-certificate', { patient: { id: 2 } }, { size: 'A5' });
  expect(result.doc).toEqual({ pdf: true });
  expect(result.template.options).toEqual({ size: 'A5' });
  await expect(api.generateDocument('bogus')).rejects.toThrow('Unknown template type: bogus');
});

test('previews and downloads the generated template under its filename', async () => {
  const response = {};
  await api.previewDocument('medical-certificate', {}, response);
  await api.downloadDocument('prescription', {}, response);
  expect(api.templates.MedicalCertificateTemplate).toBeDefined();
  const previewTemplate = await api.generateDocument('medical-certificate', {});
  previewTemplate.template.streamToResponse(response, previewTemplate.template.generateFilename());
  expect(previewTemplate.template.stream).toEqual([response, 'certificate.pdf']);
  const downloadTemplate = await api.generateDocument('prescription', {});
  downloadTemplate.template.downloadToResponse(response, downloadTemplate.template.generateFilename());
  expect(downloadTemplate.template.download).toEqual([response, 'rx.pdf']);
  expect(api.templates.PrescriptionTemplate.type).toBe('prescription');
});

test('returns a PDF buffer with persisted template and patient metadata', async () => {
  const result = await api.generateDocumentBuffer('medical-certificate', { patient: { id: 4 }, physician: { id: 5 } });
  expect(result).toMatchObject({ buffer: Buffer.from('%PDF'), filename: 'certificate.pdf', metadata: { templateType: 'medical-certificate', displayName: 'Certificate', persistToDatabase: true, patientId: 4, physicianId: 5 } });
  await expect(api.generateDocumentBuffer('missing', {})).rejects.toThrow('Unknown template type: missing');
});
