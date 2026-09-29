const EventEmitter = require('events');

jest.mock('pdfkit', () => jest.fn());
jest.mock('../../utils/logger.js', () => ({ error: jest.fn() }));

const PDFDocument = require('pdfkit');
const pdf = require('./pdfkit.js');

function document() {
  const doc = new EventEmitter();
  doc.page = { width: 612, height: 792, margins: { top: 72, bottom: 72, left: 72, right: 72 } };
  doc.x = 72;
  doc.y = 72;
  for (const method of ['font', 'fontSize', 'fillColor', 'text', 'moveDown', 'image', 'strokeColor', 'lineWidth', 'moveTo', 'lineTo', 'stroke', 'rect', 'fill', 'addPage', 'switchToPage', 'pipe', 'end']) {
    doc[method] = jest.fn(function () { return this; });
  }
  doc.heightOfString = jest.fn(() => 10);
  doc.bufferedPageRange = jest.fn(() => ({ count: 2, start: 0 }));
  return doc;
}

beforeEach(() => jest.clearAllMocks());

test('creates a document with defaults and overrides', () => {
  PDFDocument.mockImplementation(document);
  expect(pdf.createDocument().font).toHaveBeenCalledWith('Helvetica');
  expect(PDFDocument).toHaveBeenCalledWith(expect.objectContaining({ size: 'letter', margins: pdf.DEFAULT_MARGINS, bufferPages: true }));
  pdf.createDocument({ size: 'a4', margins: { top: 1 }, autoFirstPage: false });
  expect(PDFDocument).toHaveBeenLastCalledWith(expect.objectContaining({ size: 'a4', margins: { top: 1 }, autoFirstPage: false }));
});

test('streams inline and download responses and completes documents', () => {
  const doc = document();
  const res = { setHeader: jest.fn() };
  pdf.streamToResponse(doc, res);
  expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'inline; filename="document.pdf"');
  pdf.downloadToResponse(doc, res, 'report.pdf');
  expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="report.pdf"');
  pdf.downloadToResponse(doc, res);
  expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="document.pdf"');
  expect(doc.pipe).toHaveBeenCalledTimes(3);
  expect(doc.end).toHaveBeenCalledTimes(3);
});

test('collects PDF chunks and propagates stream errors', async () => {
  const doc = document();
  const result = pdf.toBuffer(doc);
  doc.emit('data', Buffer.from('ab'));
  doc.emit('data', Buffer.from('cd'));
  doc.emit('end');
  await expect(result).resolves.toEqual(Buffer.from('abcd'));
  expect(doc.end).toHaveBeenCalled();
  const failed = document();
  const rejected = pdf.toBuffer(failed);
  failed.emit('error', new Error('stream failed'));
  await expect(rejected).rejects.toThrow('stream failed');
});

test('embeds images with defaults and selected sizing options', () => {
  const doc = document();
  pdf.embedImage(doc, Buffer.from('x'));
  expect(doc.image).toHaveBeenCalledWith(expect.any(Buffer), 72, 72, { align: 'center' });
  pdf.embedImage(doc, Buffer.from('y'), { x: 10, y: 20, width: 30, height: 40, fit: [30, 40], align: 'left' });
  expect(doc.image).toHaveBeenLastCalledWith(expect.any(Buffer), 10, 20, { width: 30, height: 40, fit: [30, 40], align: 'left' });
  pdf.embedImage(doc, Buffer.from('z'), { align: '' });
  expect(doc.image).toHaveBeenLastCalledWith(expect.any(Buffer), 72, 72, {});
});

test('header and footer render optional details while preserving page margin', () => {
  const doc = document();
  pdf.addHeader(doc, 'Title');
  expect(doc.text).toHaveBeenCalledWith('Title', { align: 'center' });
  pdf.addHeader(doc, 'Title', 'Subtitle', { logo: Buffer.from('logo'), clinicName: 'Clinic', address: 'Street', showLine: false });
  expect(doc.image).toHaveBeenCalled();
  expect(doc.text).toHaveBeenCalledWith('Subtitle', { align: 'center' });
  pdf.addHeader(doc, 'Title', '', { showLine: true });
  expect(doc.stroke).toHaveBeenCalled();
  doc.y = 800;
  pdf.addFooter(doc, { text: 'Confidential' });
  expect(doc.switchToPage).toHaveBeenCalledTimes(2);
  expect(doc.page.margins.bottom).toBe(72);
  expect(doc.y).toBe(718);
  doc.bufferedPageRange.mockReturnValue({ count: 1, start: 0 });
  pdf.addFooter(doc, { showDate: false, showPageNumbers: false });
  expect(doc.switchToPage).toHaveBeenCalledTimes(3);
  pdf.addFooter(doc);
  expect(doc.switchToPage).toHaveBeenCalledTimes(4);
});

test('renders headings, inline and stacked fields with missing values', () => {
  const doc = document();
  pdf.addSectionHeading(doc, 'Section');
  expect(doc.text).toHaveBeenCalledWith('Section');
  pdf.addField(doc, 'Name', 'Ada');
  expect(doc.text).toHaveBeenCalledWith('Ada', 192, 72, { width: 348 });
  pdf.addField(doc, 'Name', '', { inline: false });
  expect(doc.text).toHaveBeenCalledWith('N/A');
  pdf.addField(doc, 'Empty', '');
  expect(doc.text).toHaveBeenCalledWith('N/A', 192, 72, { width: 348 });
});

test('tables measure cell heights and break pages before overflowing', () => {
  const doc = document();
  pdf.addTable(doc, ['A', 'B'], [[1, 'short'], ['', 0]]);
  expect(doc.rect).toHaveBeenCalledWith(72, 72, 468, 20);
  expect(doc.heightOfString).toHaveBeenCalled();
  expect(doc.y).toBeGreaterThan(72);
  doc.y = 690;
  doc.heightOfString.mockReturnValue(50);
  pdf.addTable(doc, ['A'], [['long text']], { columnWidths: [468], cellPadding: 10, headerBg: 'blue' });
  expect(doc.addPage).toHaveBeenCalled();
  expect(doc.fill).toHaveBeenCalledWith('blue');
  doc.y = 72;
  pdf.addTable(doc, ['A'], [['ok']], { columnWidths: [468] });
});

test('signature renders optional title and date', () => {
  const doc = document();
  pdf.addSignatureLine(doc, 'Doctor', 'MD');
  expect(doc.text).toHaveBeenCalledWith('MD', { width: 200, align: 'center' });
  expect(doc.text).toHaveBeenCalledWith('Date: _________________', { width: 200, align: 'center' });
  pdf.addSignatureLine(doc, 'Doctor', '', { x: 20, width: 100, date: false });
  expect(doc.moveTo).toHaveBeenCalledWith(20, 72);
  pdf.addSignatureLine(doc, 'Doctor', 'MD', { x: 0, date: true });
  pdf.addSignatureLine(doc, 'Doctor');
});
