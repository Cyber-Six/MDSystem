jest.mock('fs', () => ({ existsSync: jest.fn(), readFileSync: jest.fn() }));
jest.mock('../../rendering/pdfkit.js', () => ({ DEFAULT_MARGINS: {}, FONT_SIZES: { body: 10 }, COLORS: { text: '#111', secondary: '#555' }, createDocument: jest.fn(() => ({ y: 100, page: { margins: { left: 72 } }, moveDown: jest.fn(), font: jest.fn().mockReturnThis(), fontSize: jest.fn().mockReturnThis(), fillColor: jest.fn().mockReturnThis(), text: jest.fn().mockReturnThis(), image: jest.fn() })), addHeader: jest.fn(), addSectionHeading: jest.fn(), addField: jest.fn(), addSignatureLine: jest.fn() }));
const fs = require('fs'); const pdf = require('../../rendering/pdfkit.js'); const Template = require('./medical-certificate');
beforeEach(() => jest.clearAllMocks());

test('builds certificate sections and includes validity, restrictions, remarks, and clinician details', async () => {
  const template = new Template().setData({ certificate: { purpose: 'Work', diagnosis: 'Healthy', recommendations: 'Fit', validFrom: '2025-01-01', validUntil: null, restrictions: 'None', remarks: 'Review' }, physician: { firstName: 'Ada', lastName: 'Lovelace', specialization: 'Medicine', licenseNo: 'L1', ptrNo: 'P2' }, issuedDate: '2025-02-01' });
  await expect(template.build()).resolves.toBe(template);
  expect([Template.type, Template.displayName, Template.persistToDatabase]).toEqual(['medical-certificate', 'Medical Certificate', true]);
  expect(pdf.addField).toHaveBeenCalledWith(template.doc, 'Validity', expect.stringContaining('From:'));
  expect(template.doc.text).toHaveBeenCalledWith('Restrictions:');
  expect(template.doc.text).toHaveBeenCalledWith('Review');
  expect(pdf.addSignatureLine).toHaveBeenCalledWith(template.doc, 'Ada Lovelace, MD', 'Medicine | License No: L1 | PTR No: P2');
});

test('supports data URL, base64, file signatures and continues when images cannot load', () => {
  const template = new Template().setData({ physician: { signature: { base64: 'data:image/png;base64,QUJD' } } }).init();
  template._addPhysicianSignature();
  expect(template.doc.image).toHaveBeenCalledWith(Buffer.from('QUJD', 'base64'), 72, 100, expect.any(Object));
  template.data.physician.signature = { base64: 'QUJD' }; template._addPhysicianSignature();
  fs.existsSync.mockReturnValue(true); fs.readFileSync.mockReturnValue(Buffer.from('FILE'));
  template.data.physician.signature = { path: '/signature.png' }; template._addPhysicianSignature();
  template.doc.image.mockImplementationOnce(() => { throw new Error('bad image'); });
  template.data.physician.signature = { base64: 'QUJD' }; expect(() => template._addPhysicianSignature()).not.toThrow();
  fs.existsSync.mockImplementationOnce(() => { throw new Error('filesystem error'); });
  template.data.physician.signature = { path: '/broken' }; expect(() => template._addPhysicianSignature()).not.toThrow();
  expect(pdf.addSignatureLine).toHaveBeenCalled();
});

test('uses optional field defaults and handles absent certificate and physician', () => {
  const template = new Template().setData({ certificate: null, physician: null });
  template.data.certificate = null; template.data.physician = null; template.init();
  template._addCertificateDetails(); template._addPhysicianSignature();
  template.data.certificate = { diagnosis: '', recommendations: '', validUntil: '2025-01-01' };
  template._addCertificateDetails();
  expect(pdf.addField).toHaveBeenCalledWith(template.doc, 'Validity', expect.stringContaining('Until:'));
  expect(template.doc.text).toHaveBeenCalledWith('N/A');
  expect(fs.existsSync).not.toHaveBeenCalled();
});

test('handles empty signature payload, absent physician details, and certificates without validity dates', () => {
  const template = new Template().setData({ certificate: { purpose: '', diagnosis: '', recommendations: '', validFrom: '', validUntil: '' }, physician: {} }).init();
  template.data.physician = { signature: { base64: 'data:image/png;base64,' }, firstName: '', lastName: '', title: '', specialization: '', licenseNo: '', ptrNo: '' };
  template._addCertificateDetails();
  template._addPhysicianSignature();
  expect(pdf.addSignatureLine).toHaveBeenLastCalledWith(template.doc, 'MD', '');
});
