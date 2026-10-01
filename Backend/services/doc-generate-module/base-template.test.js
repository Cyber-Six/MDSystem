jest.mock('../rendering/pdfkit.js', () => ({
  DEFAULT_MARGINS: { top: 1 }, createDocument: jest.fn(() => ({ marker: 'pdf', moveDown: jest.fn() })),
  addHeader: jest.fn(), addSectionHeading: jest.fn(), addField: jest.fn(), addSignatureLine: jest.fn(),
  addFooter: jest.fn(), streamToResponse: jest.fn(), downloadToResponse: jest.fn(), toBuffer: jest.fn().mockResolvedValue(Buffer.from('%PDF')),
}));
const pdf = require('../rendering/pdfkit.js');
const BaseTemplate = require('./base-template');
class ConcreteTemplate extends BaseTemplate { static get type() { return 'test'; } static get displayName() { return 'Test'; } async build() { return this; } }

beforeEach(() => { jest.clearAllMocks(); });

test('defines defaults, abstract contracts, and sample data', () => {
  const template = new BaseTemplate();
  expect(template.options).toEqual({ size: 'letter', margins: pdf.DEFAULT_MARGINS });
  expect(BaseTemplate.persistToDatabase).toBe(false);
  expect(BaseTemplate.getSampleData()).toMatchObject({ patient: { id: 12345 }, physician: { id: 1 }, clinic: { name: expect.any(String) } });
  expect(() => BaseTemplate.type).toThrow('Template must implement static type getter');
  expect(() => BaseTemplate.displayName).toThrow('Template must implement static displayName getter');
  expect(template.build()).rejects.toThrow('Template must implement build() method');
});

test('merges sample fields with supplied data, initializes, and adds header and patient section', () => {
  const template = new ConcreteTemplate({ size: 'A5' }).setData({ patient: { firstName: 'Ada', middleName: '', lastName: 'Lovelace', id: 0, dateOfBirth: '2000-01-01' }, clinic: { name: 'Clinic' } });
  expect(template.options).toMatchObject({ size: 'A5', margins: pdf.DEFAULT_MARGINS });
  expect(template.data.patient).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace', sex: 'Male' });
  expect(template.data.clinic).toMatchObject({ name: 'Clinic', address: expect.any(String) });
  expect(template.init()).toBe(template);
  expect(pdf.createDocument).toHaveBeenCalledWith(template.options);
  expect(template.addHeader('TITLE')).toBe(template);
  expect(pdf.addHeader).toHaveBeenCalledWith(template.doc, 'TITLE', '', expect.objectContaining({ clinicName: 'Clinic' }));
  expect(template.addPatientInfo()).toBe(template);
  expect(pdf.addField).toHaveBeenCalledWith(template.doc, 'Patient ID', 'N/A');
  expect(template._formatDate(null)).toBe('N/A');
  expect(template._formatDateForFilename(new Date('2025-03-04T00:00:00Z'))).toBe('2025-03-04');
  expect(template.generateFilename()).toMatch(/^test_Lovelace_Ada_\d{4}-\d{2}-\d{2}\.pdf$/);
});

test('handles missing patient and physician, footer options, and PDF output paths', async () => {
  const template = new ConcreteTemplate().setData({ patient: null, physician: null, clinic: null }).init();
  template.data.patient = null;
  template.data.physician = null;
  template.data.clinic = null;
  expect(template.addPatientInfo()).toBe(template);
  expect(template.addPhysicianSignature()).toBe(template);
  expect(template.generateFilename()).toMatch(/^test_document_\d{4}-\d{2}-\d{2}\.pdf$/);
  expect(template.addFooter({ page: 2 })).toBe(template);
  expect(pdf.addFooter).toHaveBeenCalledWith(template.doc, { text: 'MDSystem', page: 2 });
  const response = {};
  template.streamToResponse(response, 'a.pdf');
  template.downloadToResponse(response, 'b.pdf');
  await expect(template.toBuffer()).resolves.toEqual(Buffer.from('%PDF'));
  expect(template.getDocument()).toBe(template.doc);
  expect(pdf.streamToResponse).toHaveBeenCalledWith(template.doc, response, 'a.pdf');
  expect(pdf.downloadToResponse).toHaveBeenCalledWith(template.doc, response, 'b.pdf');
});

test('renders available physician signature details and computes age before birthdays', () => {
  const template = new ConcreteTemplate().setData({ physician: { firstName: 'Grace', lastName: 'Hopper', title: 'PhD', specialization: 'Computing', licenseNo: 'L-1' } }).init();
  expect(template.addPhysicianSignature()).toBe(template);
  expect(pdf.addSignatureLine).toHaveBeenCalledWith(template.doc, 'Grace Hopper, PhD', 'Computing | License No: L-1');
  jest.useFakeTimers().setSystemTime(new Date('2025-01-01T12:00:00Z'));
  expect(template._calculateAge('2000-02-01')).toBe(24);
  expect(template._calculateAge('2000-01-01')).toBe(25);
  expect(template._calculateAge('2000-01-02')).toBe(24);
  expect(template._calculateAge('2000-12-01')).toBe(24);
  jest.useRealTimers();
  template.data.patient = { id: 1, dateOfBirth: null };
  template.addPatientInfo();
  expect(pdf.addField).toHaveBeenCalledWith(template.doc, 'Age', 'N/A years old');
  template.data.physician = { firstName: 'Lin', lastName: 'Chen' };
  template.addPhysicianSignature();
  expect(pdf.addSignatureLine).toHaveBeenLastCalledWith(template.doc, 'Lin Chen, undefined', '');
});
