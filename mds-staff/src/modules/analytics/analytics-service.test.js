import { axiosRequest } from '../../packages-core-adapter';
import {
  ACADEMIC_PROGRAM_FILTER_OPTIONS,
  CHART_TYPE_MAP,
  QUERY_CATEGORIES,
  exportAnalytics,
  exportSingleMetric,
  fetchAvailableQueries,
  fetchFilterOptions,
  fetchMultipleQueries,
  fetchQueryData,
  getDateRangeForPeriod,
} from './analytics-service';

jest.mock('../../packages-core-adapter', () => ({ axiosRequest: { get: jest.fn(), post: jest.fn() } }));

describe('analytics service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-26T12:00:00.000Z'));
    URL.createObjectURL = jest.fn(() => 'blob:report');
    URL.revokeObjectURL = jest.fn();
  });
  afterEach(() => jest.useRealTimers());

  it('exposes chart-category mapping and derives each supported period range', () => {
    expect(QUERY_CATEGORIES.consultations.queries).toContain('consultation-trends');
    expect(CHART_TYPE_MAP['diagnoses-sex-age']).toBe('heatmap');
    expect(getDateRangeForPeriod('daily')).toEqual({ startDate: '2026-09-19', endDate: '2026-09-26' });
    expect(getDateRangeForPeriod('weekly')).toEqual({ startDate: '2026-08-29', endDate: '2026-09-26' });
    expect(getDateRangeForPeriod('monthly')).toEqual({ startDate: '2026-03-26', endDate: '2026-09-26' });
    expect(getDateRangeForPeriod('quarterly')).toEqual({ startDate: '2025-09-26', endDate: '2026-09-26' });
    expect(getDateRangeForPeriod('yearly')).toEqual({ startDate: '2021-09-26', endDate: '2026-09-26' });
    expect(getDateRangeForPeriod('custom')).toEqual({ startDate: '2026-03-26', endDate: '2026-09-26' });
  });

  it('fetches available queries and normalized filter choices', async () => {
    axiosRequest.get
      .mockResolvedValueOnce({ data: { queries: ['top-diagnoses'] } })
      .mockResolvedValueOnce({ data: { departments: [' BSCS ', 'BSCS'], sexes: ['m', 'Female', 'other'] } });
    await expect(fetchAvailableQueries()).resolves.toEqual(['top-diagnoses']);
    const filters = await fetchFilterOptions();
    expect(filters.departments).toEqual(expect.arrayContaining(['BSCS', ...ACADEMIC_PROGRAM_FILTER_OPTIONS]));
    expect(filters.sexes).toEqual(['Male', 'Female']);
  });

  it('retains required filters when the backend filter request fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    axiosRequest.get.mockRejectedValue(new Error('offline'));
    await expect(fetchFilterOptions()).resolves.toEqual({
      departments: ACADEMIC_PROGRAM_FILTER_OPTIONS,
      sexes: ['Male', 'Female'],
    });
    console.error.mockRestore();
  });

  it('passes optional filters to individual query requests', async () => {
    axiosRequest.get.mockResolvedValue({ data: { total: 3 } });
    await expect(fetchQueryData('top diagnoses', 'Manila', '2026-01-01', '2026-01-31', 'monthly', {
      department: 'BSCS', sex: 'Female',
    })).resolves.toEqual({ total: 3 });
    expect(axiosRequest.get).toHaveBeenCalledWith('/analytics/query/top%20diagnoses', {
      params: { branch: 'Manila', startDate: '2026-01-01', endDate: '2026-01-31', groupBy: 'monthly', department: 'BSCS', sex: 'Female' },
    });
  });

  it('returns batch successes and explicit per-query failures', async () => {
    axiosRequest.post.mockResolvedValue({ data: { success: true, branch: 'Both', dateRange: {}, results: {
      good: { success: true, data: { total: 1 } }, bad: { success: false },
    } } });
    const results = await fetchMultipleQueries(['good', 'bad'], 'Both', '2026-01-01', '2026-01-31', 'monthly');
    expect(results.get('good')).toMatchObject({ success: true, dataType: 'good', data: { total: 1 } });
    expect(results.get('bad')).toEqual({ success: false, error: true, dataType: 'bad' });
  });

  it('marks invalid batch types and falls back for remaining types', async () => {
    axiosRequest.post.mockRejectedValue({ response: { data: { invalidTypes: ['bad'] } } });
    axiosRequest.get.mockResolvedValue({ data: { total: 2 } });
    const results = await fetchMultipleQueries(['bad', 'good'], 'Both', 'a', 'b', 'daily');
    expect(results.get('bad')).toMatchObject({ unsupported: true, error: true });
    expect(results.get('good')).toEqual({ total: 2 });
  });

  it('posts export filters and triggers named browser downloads', async () => {
    const anchor = document.createElement('a');
    const click = jest.spyOn(anchor, 'click').mockImplementation(() => {});
    jest.spyOn(anchor, 'remove').mockImplementation(() => {});
    jest.spyOn(document, 'createElement').mockReturnValue(anchor);
    axiosRequest.post.mockResolvedValue({ data: new Blob(['data']), headers: { 'content-disposition': 'attachment; filename="report.csv"' } });
    await exportAnalytics('csv', { branch: 'Both', startDate: 'a', endDate: 'b', dataTypes: ['x'], department: 'BSCS', sex: 'Female', ageGroup: '18-25' });
    await exportSingleMetric('top-diagnoses', { branch: 'Both', startDate: 'a', endDate: 'b' });
    expect(axiosRequest.post.mock.calls[0][1]).toMatchObject({ format: 'csv', department: 'BSCS', filters: { department: 'BSCS', sex: 'Female', ageGroup: '18-25' } });
    expect(axiosRequest.post.mock.calls[1][0]).toBe('/analytics/export/single');
    expect(click).toHaveBeenCalledTimes(2);
    document.createElement.mockRestore();
  });
});
