jest.mock('./analytics-query', () => ({ getFilterOptions: jest.fn(), executeBatchQueries: jest.fn() }));
jest.mock('exceljs', () => ({ Workbook: jest.fn(() => ({ addWorksheet: jest.fn(() => ({ columns: [], addRow: jest.fn(() => ({ eachCell: jest.fn() })), getRow: jest.fn(() => ({ eachCell: jest.fn() })), mergeCells: jest.fn() })), xlsx: { writeBuffer: jest.fn().mockResolvedValue(Buffer.from('xlsx')) } })) }));

const analytics = require('./analytics-query');
const matrix = require('./analytics-matrix-export');

beforeEach(() => {
  jest.clearAllMocks();
  analytics.getFilterOptions.mockResolvedValue({ departments: ['Nursing'] });
  analytics.executeBatchQueries.mockResolvedValue({ 'patients-by-sex': { success: true, data: { labels: ['Patient'], values: [4], total: 4, chartContext: { title: 'Population', datasetContext: 'patientPopulation' } } } });
});

test('builds department-age-sex matrix cells and includes a flat export view', async () => {
  const data = await matrix.buildMatrixData({ branch: 'Manila', startDate: '2026-01-01', endDate: '2026-01-31', department: 'Nursing', ageGroup: '21-25', sex: 'Male' }, ['patients-by-sex']);
  expect(data.departments).toEqual(['Nursing']);
  expect(Object.keys(data.structured).length).toBeGreaterThan(0);
  expect([...data.flatRecords.values()].flat()).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'TOTAL', department: 'Nursing', sex: 'Male', value: 4 })]));
  expect(analytics.executeBatchQueries).toHaveBeenCalledTimes(1);
});

test('handles failed or unknown metrics as an empty structured export', async () => {
  analytics.executeBatchQueries.mockResolvedValue({});
  const data = await matrix.buildMatrixData({}, ['unknown-metric']);
  expect(data.structured).toEqual({});
  expect(data.summaryRows).toBeDefined();
});
