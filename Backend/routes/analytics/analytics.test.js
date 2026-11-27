jest.mock('../../utils/logger.js', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../config/middleware/jwtProtect.js', () => ({ jwtProtect: jest.fn(() => (_req, _res, next) => next?.()) }));
jest.mock('../../config/query.js', () => ({}));
jest.mock('../../config/db.js', () => ({ query: jest.fn() }));
jest.mock('../../services/analytics/analytics-query.js', () => ({
  getAvailableQueries: jest.fn(() => ['patients']), getFilterOptions: jest.fn(),
  hasQuery: jest.fn(), executeQuery: jest.fn(), executeBatchQueries: jest.fn(),
}));
jest.mock('../../services/analytics/analytics-export.js', () => ({ EXPORT_PRESETS: { monthly: { label: 'Monthly' } }, EXPORT_META: { patients: { label: 'Patients' } }, resolveDataTypes: jest.fn(), buildFilename: jest.fn(), fetchExportData: jest.fn(), generatePDF: jest.fn(), generateSingleMetricPDF: jest.fn() }));
jest.mock('../../services/analytics/analytics-matrix-export.js', () => ({ generateMatrixCsvFiles: jest.fn(), generateMatrixExcelWorkbook: jest.fn() }));
jest.mock('../../services/authorization/permit.js', () => ({
  getStaffBranch: jest.fn(),
  getStaffModulePermissions: jest.fn(),
  isMedicalAdmin: jest.fn(),
}));
jest.mock('archiver', () => jest.fn());

const router = require('./analytics.js');
const analytics = require('../../services/analytics/analytics-query.js');
const permit = require('../../services/authorization/permit.js');
const exportService = require('../../services/analytics/analytics-export.js');
const matrixExport = require('../../services/analytics/analytics-matrix-export.js');
const db = require('../../config/db.js');

function handler(method, path) {
  const layer = router.stack.find(item => item.route?.path === path && item.route.methods[method]);
  if (!layer) throw new Error(`Missing route ${method.toUpperCase()} ${path}`);
  return layer.route.stack.at(-1).handle;
}
function response() {
  const res = { status: jest.fn(), json: jest.fn(), send: jest.fn(), setHeader: jest.fn(), on: jest.fn(), end: jest.fn(), headersSent: false };
  res.status.mockReturnValue(res); return res;
}
const req = (overrides = {}) => ({ user: { id: 9 }, params: {}, query: {}, body: {}, ...overrides });

beforeEach(() => jest.clearAllMocks());

test.each([
  ['post', '/batch'],
  ['post', '/export'],
  ['post', '/export/single'],
  ['get', '/export/presets'],
  ['get', '/export/types'],
])('%s %s enforces Analytics module access for staff', async (method, path) => {
  const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route;
  const body = {
    branch: 'Manila', startDate: '2026-01-01', endDate: '2026-01-02',
    dataTypes: ['patients'], dataType: 'patients', format: 'pdf',
  };
  const pdf = Buffer.from('report');
  permit.isMedicalAdmin.mockResolvedValue(false);
  permit.getStaffModulePermissions.mockImplementation(async staffId => ({
    modules: [
      { moduleId: 'appointments', enabled: true },
      { moduleId: 'analytics', enabled: staffId === 10 },
    ],
  }));
  if (method === 'post') permit.getStaffBranch.mockResolvedValueOnce('Manila');
  if (path === '/batch') {
    analytics.hasQuery.mockReturnValueOnce(true);
    analytics.executeBatchQueries.mockResolvedValueOnce({ patients: { success: true } });
  }
  if (path === '/export' || path === '/export/single') {
    exportService.fetchExportData.mockResolvedValueOnce({ patients: [{ count: 1 }] });
    db.query.mockResolvedValueOnce({ rows: [] });
  }
  if (path === '/export') {
    exportService.resolveDataTypes.mockReturnValueOnce(['patients']);
    exportService.generatePDF.mockResolvedValueOnce({ buffer: pdf, filename: 'report.pdf' });
  }
  if (path === '/export/single') {
    exportService.generateSingleMetricPDF.mockResolvedValueOnce({ buffer: pdf, filename: 'report.pdf' });
  }

  function dispatch(staffId) {
    return new Promise((resolve, reject) => {
      const res = response();
      let status = 200;
      res.status.mockImplementation(code => {
        status = code;
        return res;
      });
      res.json.mockImplementation(payload => resolve({ status, payload }));
      res.send.mockImplementation(payload => resolve({ status, payload }));
      route.dispatch(req({ method: method.toUpperCase(), user: { id: staffId }, body }), res, reject);
    });
  }

  await expect(dispatch(9)).resolves.toEqual({
    status: 403, payload: { error: 'ANALYTICS_ACCESS_DENIED' },
  });
  expect(permit.getStaffBranch).not.toHaveBeenCalled();
  await expect(dispatch(10)).resolves.toMatchObject({ status: 200 });
  expect(permit.getStaffModulePermissions.mock.calls).toEqual([[9], [10]]);
});

test('serves query and filter metadata and handles service failures', async () => {
  const res = response();
  analytics.getAvailableQueries.mockReturnValueOnce(['patients']);
  await handler('get', '/queries')(req(), res);
  expect(res.json).toHaveBeenCalledWith({ success: true, queries: ['patients'] });
  analytics.getFilterOptions.mockResolvedValueOnce({ departments: ['Dental'] });
  await handler('get', '/filter-options')(req(), res);
  expect(res.json).toHaveBeenLastCalledWith({ success: true, departments: ['Dental'] });
  analytics.getFilterOptions.mockRejectedValueOnce(new Error('offline'));
  await handler('get', '/filter-options')(req(), res);
  expect(res.status).toHaveBeenLastCalledWith(500);
  analytics.getAvailableQueries.mockImplementationOnce(() => { throw new Error('query catalog failed'); });
  await handler('get', '/queries')(req(), res);
  expect(res.json).toHaveBeenLastCalledWith({ error: 'FETCH_FAILED' });
  analytics.getAvailableQueries.mockImplementationOnce(() => { throw new Error('query catalog failed'); });
  await handler('get', '/queries')(req(), res);
});

test('validates analytics query parameters, branch scope and aliases before returning data', async () => {
  const run = handler('get', '/query/:dataType');
  const res = response();
  await run(req({ params: { dataType: 'patients' } }), res); expect(res.status).toHaveBeenLastCalledWith(400);
  await run(req({ params: { dataType: 'patients' }, query: { branch: 'Manila', startDate: '2026-01-01' } }), res); expect(res.json).toHaveBeenLastCalledWith({ error: 'DATE_RANGE_REQUIRED' });
  await run(req({ params: { dataType: 'patients' }, query: { branch: 'Bad', startDate: '2026-01-01', endDate: '2026-01-02' } }), res); expect(res.json).toHaveBeenLastCalledWith({ error: 'INVALID_BRANCH' });
  await run(req({ params: { dataType: 'patients' }, query: { branch: 'Manila', startDate: 'bad', endDate: '2026-01-02' } }), res); expect(res.json).toHaveBeenLastCalledWith({ error: 'INVALID_DATE_FORMAT' });
  await run(req({ params: { dataType: 'patients' }, query: { branch: 'Manila', startDate: '2026-02-01', endDate: '2026-01-01' } }), res); expect(res.json).toHaveBeenLastCalledWith({ error: 'INVALID_DATE_RANGE' });
  analytics.hasQuery.mockReturnValueOnce(false);
  await run(req({ params: { dataType: 'missing' }, query: { branch: 'Manila', startDate: '2026-01-01', endDate: '2026-01-02' } }), res); expect(res.status).toHaveBeenLastCalledWith(404);
  analytics.hasQuery.mockReturnValue(true);
  permit.getStaffBranch.mockResolvedValueOnce('QuezonCity');
  await run(req({ params: { dataType: 'patients' }, query: { branch: 'Manila', startDate: '2026-01-01', endDate: '2026-01-02' } }), res); expect(res.status).toHaveBeenLastCalledWith(403);
  permit.getStaffBranch.mockResolvedValue('Both'); analytics.hasQuery.mockReturnValue(true); analytics.executeQuery.mockResolvedValue({ total: 1 });
  await run(req({ params: { dataType: 'Patient Credentials Status' }, query: { branch: 'Both', startDate: '2026-01-01', endDate: '2026-01-02', sex: ['F'], department: 'Dental' } }), res);
  expect(analytics.executeQuery).toHaveBeenCalledWith('patient-credential-status', 'Both', '2026-01-01', '2026-01-02', expect.objectContaining({ sex: 'F', department: 'Dental' }));
  expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ canonicalDataType: 'patient-credential-status', data: { total: 1 } }));
  const canonical = response();
  await run(req({ params: { dataType: 'patients' }, query: { branch: 'Both', startDate: '2026-01-01', endDate: '2026-01-02', group: 'all', department: ['Dental'], sex: [null], filters: null } }), canonical);
  expect(canonical.json).toHaveBeenLastCalledWith(expect.objectContaining({ dataType: 'patients' }));
  const missingType = response();
  await run(req({ params: { dataType: undefined }, query: { branch: 'Both', startDate: '2026-01-01', endDate: '2026-01-02' } }), missingType);
  expect(missingType.json).toHaveBeenLastCalledWith({ error: 'QUERY_NOT_FOUND', dataType: undefined });
  analytics.executeQuery.mockRejectedValueOnce(new Error('query backend failed'));
  const failed = response();
  await run(req({ params: { dataType: 'patients' }, query: { branch: 'Both', startDate: '2026-01-01', endDate: '2026-01-02' } }), failed);
  expect(failed.json).toHaveBeenLastCalledWith({ error: 'QUERY_FAILED', message: 'query backend failed' });
});

test('validates batch requests and maps aliases to shared execution results', async () => {
  const run = handler('post', '/batch'); const res = response();
  await run(req({ body: { dataTypes: [], branch: 'Both', startDate: '2026-01-01', endDate: '2026-01-02' } }), res);
  expect(res.json).toHaveBeenLastCalledWith({ error: 'DATA_TYPES_REQUIRED' });
  await run(req({ body: { dataTypes: null } }), res);
  expect(res.json).toHaveBeenLastCalledWith({ error: 'DATA_TYPES_REQUIRED' });
  await run(req({ body: {} }), res);
  expect(res.json).toHaveBeenLastCalledWith({ error: 'DATA_TYPES_REQUIRED' });
  await run(req({ body: { dataTypes: [null] } }), res);
  expect(res.json).toHaveBeenLastCalledWith({ error: 'DATA_TYPES_REQUIRED' });
  await run(req({ body: { dataTypes: Array(81).fill('patients'), branch: 'Both', startDate: '2026-01-01', endDate: '2026-01-02' } }), res);
  expect(res.json).toHaveBeenLastCalledWith({ error: 'TOO_MANY_QUERIES', message: 'Maximum 80 queries per batch' });
  await run(req({ body: { dataTypes: ['patients'] } }), res);
  expect(res.json).toHaveBeenLastCalledWith({ error: 'MISSING_PARAMS' });
  await run(req({ body: { dataTypes: ['patients'], branch: 'bad', startDate: '2026-01-01', endDate: '2026-01-02' } }), res);
  expect(res.json).toHaveBeenLastCalledWith({ error: 'INVALID_BRANCH' });
  await run(req({ body: { dataTypes: ['patients'], branch: 'Both', startDate: '2026-01-02', endDate: '2026-01-01' } }), res);
  expect(res.json).toHaveBeenLastCalledWith({ error: 'INVALID_DATE_RANGE' });
  analytics.hasQuery.mockReturnValue(false);
  await run(req({ body: { dataTypes: ['unknown'], branch: 'Both', startDate: '2026-01-01', endDate: '2026-01-02' } }), res);
  expect(res.json).toHaveBeenLastCalledWith({ error: 'INVALID_QUERY_TYPES', invalidTypes: ['unknown'] });
  analytics.hasQuery.mockReturnValue(true); permit.getStaffBranch.mockResolvedValue('Both');
  analytics.executeBatchQueries.mockResolvedValue({ 'appointments-accommodated-trends': { success: true } });
  await run(req({ body: { dataTypes: ['appointments-accomodated-trends', 'appointments-accommodated-trends'], branch: 'Both', startDate: '2026-01-01', endDate: '2026-01-02', filters: { groupBy: 'department' } }, query: { filters: { ageGroup: 'adult' } } }), res);
  expect(analytics.executeBatchQueries).toHaveBeenCalledWith(['appointments-accommodated-trends'], 'Both', '2026-01-01', '2026-01-02', expect.any(Object));
  expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ success: true, results: { 'appointments-accomodated-trends': { success: true }, 'appointments-accommodated-trends': { success: true } } }));
  analytics.executeBatchQueries.mockResolvedValueOnce({});
  const missingResult = response();
  await run(req({ body: { dataTypes: ['patients'], branch: 'Both', startDate: '2026-01-01', endDate: '2026-01-02' } }), missingResult);
  expect(missingResult.json).toHaveBeenLastCalledWith(expect.objectContaining({ results: { patients: { success: false, error: 'QUERY_NOT_FOUND' } } }));
  permit.getStaffBranch.mockResolvedValueOnce('Manila');
  await run(req({ body: { dataTypes: ['patients'], branch: 'QuezonCity', startDate: '2026-01-01', endDate: '2026-01-02' } }), res);
  expect(res.status).toHaveBeenLastCalledWith(403);
  permit.getStaffBranch.mockResolvedValue('Both');
  analytics.executeBatchQueries.mockRejectedValueOnce(new Error('batch backend failed'));
  const failed = response();
  await run(req({ body: { dataTypes: ['patients'], branch: 'Both', startDate: '2026-01-01', endDate: '2026-01-02' } }), failed);
  expect(failed.json).toHaveBeenLastCalledWith({ error: 'BATCH_QUERY_FAILED', message: 'batch backend failed' });
});

test('returns export presets and types from the configured catalog', () => {
  const res = response();
  handler('get', '/export/presets')(req(), res);
  expect(res.json).toHaveBeenCalledWith({ success: true, presets: { monthly: { label: 'Monthly' } } });
  handler('get', '/export/types')(req(), res);
  expect(res.json).toHaveBeenLastCalledWith({ success: true, types: { patients: { label: 'Patients' } } });
});

test('validates export requests and exercises CSV, Excel, PDF, and failure paths', async () => {
  const run = handler('post', '/export');
  const res = response();
  const valid = { format: 'csv', branch: 'Manila', startDate: '2026-01-01', endDate: '2026-01-31', dataTypes: ['patients'] };
  for (const body of [ {}, { format: 'csv' }, { ...valid, format: 'xml' }, { ...valid, branch: 'bad' }, { ...valid, startDate: 'bad' }, { ...valid, endDate: undefined } ]) {
    await run(req({ body }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  }
  exportService.resolveDataTypes.mockReturnValueOnce([]);
  await run(req({ body: valid }), res);
  expect(res.json).toHaveBeenLastCalledWith({ error: 'NO_VALID_DATA_TYPES' });
  exportService.resolveDataTypes.mockReturnValue(['patients']);
  permit.getStaffBranch.mockResolvedValueOnce('QuezonCity');
  await run(req({ body: valid }), res);
  expect(res.status).toHaveBeenLastCalledWith(403);

  permit.getStaffBranch.mockResolvedValue('Both');
  exportService.buildFilename.mockReturnValue('report.zip');
  matrixExport.generateMatrixCsvFiles.mockResolvedValue([{ filename: 'data.csv', content: 'a,b' }]);
  const csvResponse = response(); csvResponse.on.mockImplementation((event, callback) => { if (event === 'finish') callback(); });
  const archive = { on: jest.fn(), pipe: jest.fn(), append: jest.fn(), finalize: jest.fn() };
  require('archiver').mockReturnValueOnce(archive);
  await run(req({ body: valid }), csvResponse);
  expect(archive.append).toHaveBeenCalledWith('a,b', { name: 'data.csv' });

  const workbook = { xlsx: { write: jest.fn().mockResolvedValue(undefined) } };
  matrixExport.generateMatrixExcelWorkbook.mockResolvedValue(workbook);
  const excelResponse = response();
  await run(req({ body: { ...valid, format: 'excel' } }), excelResponse);
  expect(workbook.xlsx.write).toHaveBeenCalledWith(excelResponse);
  expect(excelResponse.end).toHaveBeenCalled();

  exportService.fetchExportData.mockResolvedValueOnce({});
  await run(req({ body: { ...valid, format: 'pdf' } }), res);
  expect(res.status).toHaveBeenLastCalledWith(404);
  exportService.fetchExportData.mockResolvedValueOnce({ patients: [{ count: 2 }] });
  db.query.mockResolvedValueOnce({ rows: [] });
  exportService.generatePDF.mockResolvedValue({ buffer: Buffer.from('pdf'), filename: 'report.pdf' });
  const pdfResponse = response();
  await run(req({ body: { ...valid, format: 'pdf', preset: 'monthly' } }), pdfResponse);
  expect(pdfResponse.send).toHaveBeenCalledWith(Buffer.from('pdf'));
  exportService.resolveDataTypes.mockReturnValue(['patients']);
  exportService.fetchExportData.mockResolvedValueOnce({ patients: [{ count: 2 }] });
  db.query.mockResolvedValueOnce({ rows: [] });
  exportService.generatePDF.mockResolvedValueOnce({ buffer: Buffer.from('pdf'), filename: 'report.pdf' });
  const noPresetPdf = response();
  await run(req({ body: { ...valid, format: 'pdf', dataTypes: [null, 'patients'] } }), noPresetPdf);
  expect(exportService.resolveDataTypes).toHaveBeenLastCalledWith(['patients'], undefined);
  exportService.resolveDataTypes.mockReturnValue(['patients']);
  exportService.fetchExportData.mockResolvedValueOnce({ patients: [{ count: 4 }] });
  db.query.mockResolvedValueOnce({ rows: [] });
  exportService.generatePDF.mockResolvedValueOnce({ buffer: Buffer.from('pdf'), filename: 'report.pdf' });
  const unknownPreset = response();
  await run(req({ body: { ...valid, format: 'pdf', dataTypes: 'patients', preset: 'unknown' } }), unknownPreset);
  expect(exportService.resolveDataTypes).toHaveBeenLastCalledWith('patients', 'unknown');

  matrixExport.generateMatrixCsvFiles.mockRejectedValueOnce(new Error('zip failed'));
  const failed = response();
  await run(req({ body: valid }), failed);
  expect(failed.json).toHaveBeenLastCalledWith({ error: 'EXPORT_FAILED', message: 'zip failed' });
  exportService.resolveDataTypes.mockReturnValue(['patients']);
  exportService.fetchExportData.mockRejectedValueOnce(new Error('PDF data failed'));
  const pdfFailure = response();
  await run(req({ body: { ...valid, format: 'pdf' } }), pdfFailure);
  expect(pdfFailure.json).toHaveBeenLastCalledWith({ error: 'EXPORT_FAILED', message: 'PDF data failed' });
  exportService.resolveDataTypes.mockReturnValue(['patients']);
  exportService.fetchExportData.mockRejectedValueOnce(new Error('headers already sent'));
  const streaming = response(); streaming.headersSent = true;
  await run(req({ body: { ...valid, format: 'pdf' } }), streaming);
  expect(streaming.status).not.toHaveBeenCalled();
});

test('validates and exports a single metric with empty, authorized, and successful outcomes', async () => {
  const run = handler('post', '/export/single');
  const res = response();
  const base = { dataType: 'patients', branch: 'Manila', startDate: '2026-01-01', endDate: '2026-01-31' };
  for (const body of [ {}, { ...base, branch: 'bad' }, { ...base, endDate: undefined }, { ...base, startDate: 'bad' } ]) {
    await run(req({ body }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  }
  permit.getStaffBranch.mockResolvedValueOnce('QuezonCity');
  await run(req({ body: base }), res);
  expect(res.status).toHaveBeenLastCalledWith(403);
  permit.getStaffBranch.mockResolvedValue('Both');
  exportService.fetchExportData.mockResolvedValueOnce({});
  await run(req({ body: base }), res);
  expect(res.status).toHaveBeenLastCalledWith(404);
  exportService.fetchExportData.mockResolvedValueOnce({ patients: { count: 1 } });
  db.query.mockResolvedValueOnce({ rows: [{ first_name: 'Ada', last_name: 'Lovelace', title: null }] });
  exportService.generateSingleMetricPDF.mockResolvedValue({ buffer: Buffer.from('single'), filename: 'single.pdf' });
  const success = response();
  await run(req({ body: base }), success);
  expect(exportService.generateSingleMetricPDF).toHaveBeenCalledWith('patients', { count: 1 }, expect.objectContaining({ physician: expect.objectContaining({ title: '' }) }));
  expect(success.send).toHaveBeenCalledWith(Buffer.from('single'));
  exportService.fetchExportData.mockResolvedValueOnce({ patients: { count: 2 } });
  db.query.mockResolvedValueOnce({ rows: [] });
  exportService.generateSingleMetricPDF.mockRejectedValueOnce(new Error('single PDF failed'));
  const failed = response();
  await run(req({ body: base }), failed);
  expect(failed.json).toHaveBeenLastCalledWith({ error: 'EXPORT_FAILED', message: 'single PDF failed' });
  exportService.fetchExportData.mockResolvedValueOnce({ patients: { count: 3 } });
  db.query.mockResolvedValueOnce({ rows: [] });
  exportService.generateSingleMetricPDF.mockRejectedValueOnce(new Error('already streaming'));
  const streaming = response(); streaming.headersSent = true;
  await run(req({ body: base }), streaming);
  expect(streaming.status).not.toHaveBeenCalled();
});
