jest.mock('./analytics-query', () => ({ executeBatchQueries: jest.fn() }));
jest.mock('../rendering/chart', () => ({}));
jest.mock('../rendering/pdfkit', () => ({}));
jest.mock('../doc-generate-module/index', () => ({ generateDocument: jest.fn() }));

const analytics = require('./analytics-query');
const exporter = require('./analytics-export');

test('selects supported metrics from presets, lists, and default-all requests', () => {
  expect(exporter.resolveDataTypes([], 'consultations')).toEqual(exporter.EXPORT_PRESETS.consultations.dataTypes);
  expect(exporter.resolveDataTypes(['top-diagnoses', 'no-such-metric'])).toEqual(['top-diagnoses']);
  expect(exporter.resolveDataTypes()).toEqual(Object.keys(exporter.EXPORT_META));
  expect(exporter.branchLabel('Both')).toBe('All Branches');
  expect(exporter.branchLabel('QuezonCity')).toBe('Quezon City');
  expect(exporter.branchLabel('Manila')).toBe('Manila');
  expect(exporter.buildFilename('report', null, '2026-01-01', '2026-01-31', 'csv')).toBe('report_all_2026-01-01_to_2026-01-31.csv');
});

test('fetches only successful batches with data', async () => {
  analytics.executeBatchQueries.mockResolvedValue({ good: { success: true, data: { values: [1] } }, failed: { success: false }, empty: { success: true, data: null } });
  await expect(exporter.fetchExportData(['good', 'failed', 'empty'], 'Manila', 'a', 'b', { groupBy: 'weekly' })).resolves.toEqual({ good: { values: [1] } });
  expect(analytics.executeBatchQueries).toHaveBeenCalledWith(['good', 'failed', 'empty'], 'Manila', 'a', 'b', { groupBy: 'weekly' });
});

test('builds a CSV with escaped cells and useful filter metadata', () => {
  const result = exporter.generateCSV({ 'top-diagnoses': { labels: ['Caries, acute', 'Quote "x"'], values: [2, 3], total: 5 } }, { branch: 'Both', startDate: '2026-01-01', endDate: '2026-01-31' });
  expect(result).toContain('# Branch: All Branches');
  expect(result).toContain('Caries, acute');
  expect(result).toContain('"Quote ""x"""');
});
