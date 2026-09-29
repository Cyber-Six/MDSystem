jest.mock('../../rendering/pdfkit.js', () => ({
  DEFAULT_MARGINS: {}, FONT_SIZES: { body: 10, small: 8 }, COLORS: { text: '#111', secondary: '#555' },
  createDocument: jest.fn(() => ({ y: 100, page: { width: 612 }, addPage: jest.fn(), moveDown: jest.fn(), fontSize: jest.fn().mockReturnThis(), font: jest.fn().mockReturnThis(), fillColor: jest.fn().mockReturnThis(), text: jest.fn().mockReturnThis() })),
  addHeader: jest.fn(), addSectionHeading: jest.fn(), addField: jest.fn(), addTable: jest.fn(), embedImage: jest.fn(), addSignatureLine: jest.fn(),
}));
jest.mock('../../rendering/chart.js', () => ({ generatePieChart: jest.fn() }));
const pdf = require('../../rendering/pdfkit.js'); const chart = require('../../rendering/chart.js'); const Template = require('./diagnosis-report');
beforeEach(() => { jest.clearAllMocks(); });

test('exposes template metadata and builds a populated diagnosis report including generated chart', async () => {
  expect([Template.type, Template.displayName, Template.persistToDatabase]).toEqual(['diagnosis-report', 'Diagnosis Report', false]);
  chart.generatePieChart.mockResolvedValue(Buffer.from('chart'));
  const template = new Template().setData({ consultation: { id: 3, date: '2025-01-02', type: 'Dental', mode: 'Remote', status: 'Done' }, complaints: ['Pain'], peFindings: ['Normal'], diagnoses: [{ name: 'Dx', icdCode: 'A1', notes: null }], treatments: ['Rest'], remarks: 'Follow up', chartData: { show: true, labels: ['A'], data: [1] } });
  await expect(template.build()).resolves.toBe(template);
  expect(pdf.addHeader).toHaveBeenCalledWith(expect.anything(), 'DIAGNOSIS REPORT', 'Consultation #3', expect.any(Object));
  expect(pdf.addTable).toHaveBeenCalledWith(template.doc, ['Type', 'Diagnosis', 'ICD-10 Code', 'Notes'], [['N/A', 'Dx', 'A1', '-']], expect.any(Object));
  expect(chart.generatePieChart).toHaveBeenCalledWith(['A'], [1], expect.objectContaining({ width: 400 }));
  expect(pdf.embedImage).toHaveBeenCalled();
});

test('renders empty states without optional sections or charts', async () => {
  const template = new Template().setData({ patient: null, physician: null, consultation: null, complaints: [], peFindings: [], diagnoses: [], treatments: [], remarks: '', chartData: { show: false } });
  await template.build();
  expect(pdf.addTable).not.toHaveBeenCalled();
  expect(chart.generatePieChart).not.toHaveBeenCalled();
});

test('adds a chart page at the lower-page boundary and handles chart generation errors', async () => {
  const template = new Template().setData({ chartData: { show: true, title: 'Trend', labels: [], data: [] } });
  template.init(); template.doc.y = 501;
  chart.generatePieChart.mockRejectedValue(new Error('renderer unavailable'));
  await template._addChart();
  expect(template.doc.addPage).toHaveBeenCalled();
  expect(template.doc.text).toHaveBeenCalledWith('[Chart could not be generated]');
  expect(template._formatDate('not a date')).toContain('Invalid');
});

test('uses safe fallbacks when consultation ID or diagnosis identifiers are absent', async () => {
  const template = new Template().setData({ consultation: { id: 0, date: null }, diagnoses: [{ type: '', name: '', icdCode: '', notes: '' }], chartData: { show: false } });
  await template.build();
  expect(pdf.addField).toHaveBeenCalledWith(template.doc, 'Consultation ID', 'N/A');
  expect(pdf.addTable).toHaveBeenCalledWith(template.doc, ['Type', 'Diagnosis', 'ICD-10 Code', 'Notes'], [['N/A', 'N/A', 'N/A', '-']], expect.any(Object));
});
