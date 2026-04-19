const mockDbQuery = jest.fn();
const mockRedisGetKey = jest.fn();
const mockRedisSetKey = jest.fn();

jest.mock('../../config/db.js', () => ({
  query: (...args) => mockDbQuery(...args),
}));

jest.mock('../../config/redis.js', () => ({
  getKey: (...args) => mockRedisGetKey(...args),
  setKey: (...args) => mockRedisSetKey(...args),
}));

jest.mock('../../utils/logger.js', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const analytics = require('../analytics-query.js');

describe('analytics-query chartContext and oral findings prevalence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisGetKey.mockResolvedValue(null);
    mockRedisSetKey.mockResolvedValue(undefined);
  });

  test('returns descriptive chartContext metadata for core consultation charts', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ type: 'Medical', count: '9' }, { type: 'Dental', count: '3' }] })
      .mockResolvedValueOnce({ rows: [{ mode: 'Onsite', count: '8' }, { mode: 'Virtual', count: '4' }] })
      .mockResolvedValueOnce({ rows: [{ period: '2026-01', count: '6' }, { period: '2026-02', count: '8' }] })
      .mockResolvedValueOnce({ rows: [{ diagnosis: 'Acute Bronchitis', icd_code: 'J20', count: '5' }] });

    const baseArgs = ['Both', '2026-01-01', '2026-03-31'];

    const byType = await analytics.executeQuery('consultations-by-type', ...baseArgs, {});
    const byMode = await analytics.executeQuery('consultations-by-mode', ...baseArgs, {});
    const trends = await analytics.executeQuery('consultation-trends', ...baseArgs, { groupBy: 'monthly' });
    const topDiagnoses = await analytics.executeQuery('top-diagnoses', ...baseArgs, {});

    expect(byType.chartContext).toMatchObject({
      key: 'serviceType',
      title: 'Consultations by Service Type (Medical vs Dental)',
      datasetContext: 'serviceType',
    });

    expect(byMode.chartContext).toMatchObject({
      key: 'deliveryMode',
      title: 'Consultations by Mode of Delivery (Onsite vs Virtual)',
      datasetContext: 'deliveryMode',
    });

    expect(trends.chartContext).toMatchObject({
      key: 'consultationTrends',
      title: 'Consultation Trends Over Time',
      datasetContext: 'consultationTimeline',
    });

    expect(topDiagnoses.chartContext).toMatchObject({
      key: 'diagnosisFrequency',
      title: 'Most Frequent Diagnoses Recorded',
      datasetContext: 'diagnosisFrequency',
    });
  });

  test('computes oral findings boolean prevalence and returns yes/no percentages', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ total_population: 20 }] })
      .mockResolvedValueOnce({
        rows: [
          { finding_name: 'Calculus', yes_count: 7, no_count: 13 },
          { finding_name: 'Gingivitis', yes_count: 4, no_count: 16 },
          { finding_name: 'Dental Caries', yes_count: 3, no_count: 17 },
        ],
      });

    const result = await analytics.executeQuery(
      'oral-findings-percentages',
      'Manila',
      '2025-10-19',
      '2026-04-19',
      { department: 'College of Nursing', sex: 'Female' }
    );

    expect(result.total).toBe(20);
    expect(result.unit).toBe('percentage');
    expect(result.labels).toEqual(['Calculus', 'Gingivitis', 'Dental Caries']);
    expect(result.values).toEqual([35, 20, 15]);
    expect(result.rawCounts).toEqual([7, 4, 3]);
    expect(result.noValues).toEqual([65, 80, 85]);

    expect(result.oralFindings.calculus).toMatchObject({
      label: 'Calculus',
      yes: 35,
      no: 65,
      yesCount: 7,
      noCount: 13,
    });

    expect(result.oralFindings.gingivitis).toMatchObject({
      label: 'Gingivitis',
      yes: 20,
      no: 80,
      yesCount: 4,
      noCount: 16,
    });

    expect(result.oralFindings.dentalCaries).toMatchObject({
      label: 'Dental Caries',
      yes: 15,
      no: 85,
      yesCount: 3,
      noCount: 17,
    });

    expect(result.chartContext).toMatchObject({
      key: 'oralFindings',
      title: 'Oral Findings Prevalence',
      datasetContext: 'booleanOralHealthPrevalence',
    });

    const [populationSql, populationParams] = mockDbQuery.mock.calls[0];
    expect(populationSql).toContain('dr.created_at BETWEEN $1 AND $2');
    expect(populationSql).toContain('up."branch" = $3');
    expect(populationSql).toContain('ep_df.department = $4 OR spg.label = $4');
    expect(populationSql).toContain('LOWER(up.sex::text) = LOWER($5)');
    expect(populationParams).toEqual(expect.arrayContaining([
      '2025-10-19',
      '2026-04-19',
      'Manila',
      'College of Nursing',
      'female',
    ]));
  });

  test('returns empty oral findings payload when filtered population is zero', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [{ total_population: 0 }] });

    const result = await analytics.executeQuery(
      'oral-findings-percentages',
      'Both',
      '2025-01-01',
      '2025-12-31',
      {}
    );

    expect(result).toMatchObject({
      labels: [],
      values: [],
      rawCounts: [],
      oralFindings: {},
      total: 0,
      unit: 'percentage',
      summary: 'Oral Findings Prevalence (Boolean-based percentages).',
    });
    expect(mockDbQuery).toHaveBeenCalledTimes(1);
  });
});
