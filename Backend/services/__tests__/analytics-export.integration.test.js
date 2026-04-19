const mockGenerateDocument = jest.fn();

jest.mock('../doc-generate-module/index.js', () => ({
  generateDocument: (...args) => mockGenerateDocument(...args),
}));

jest.mock('../chart.js', () => ({}));
jest.mock('../pdfkit.js', () => ({}));
jest.mock('../analytics-query.js', () => ({
  executeBatchQueries: jest.fn(),
}));

const analyticsExport = require('../analytics-export.js');

describe('analytics-export metadata and oral findings integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateDocument.mockResolvedValue({
      template: {
        toBuffer: async () => Buffer.from('pdf-bytes'),
      },
    });
  });

  test('uses updated descriptive labels for primary consultation charts', () => {
    expect(analyticsExport.EXPORT_META['consultations-by-type'].label)
      .toBe('Consultations by Service Type (Medical vs Dental)');
    expect(analyticsExport.EXPORT_META['consultations-by-mode'].label)
      .toBe('Consultations by Mode of Delivery (Onsite vs Virtual)');
    expect(analyticsExport.EXPORT_META['consultation-trends'].label)
      .toBe('Consultation Trends Over Time');
    expect(analyticsExport.EXPORT_META['top-diagnoses'].label)
      .toBe('Most Frequent Diagnoses Recorded');
  });

  test('includes oral findings metric in clinical preset resolution', () => {
    const dataTypes = analyticsExport.resolveDataTypes(undefined, 'clinical');
    expect(dataTypes).toEqual(expect.arrayContaining([
      'immunization-coverage',
      'dental-procedures',
      'oral-findings-percentages',
    ]));
  });

  test('injects oral findings section and metadata into generated PDF payload', async () => {
    const exportData = {
      'consultations-by-type': {
        labels: ['Medical', 'Dental'],
        values: [9, 3],
        total: 12,
        chartContext: {
          title: 'Consultations by Service Type (Medical vs Dental)',
          datasetContext: 'serviceType',
        },
      },
      'oral-findings-percentages': {
        labels: ['Calculus', 'Gingivitis', 'Dental Caries'],
        values: [35, 20, 15],
        rawCounts: [7, 4, 3],
        total: 20,
        unit: 'percentage',
        summary: 'Oral Findings Prevalence (Boolean-based percentages).',
        chartContext: {
          title: 'Oral Findings Prevalence',
          datasetContext: 'booleanOralHealthPrevalence',
          key: 'oralFindings',
        },
      },
    };

    const meta = {
      branch: 'Manila',
      startDate: '2025-10-19',
      endDate: '2026-04-19',
      groupBy: 'monthly',
      department: 'College of Nursing',
      sex: 'Female',
      ageGroup: 'All',
      title: 'Clinical Analytics Report',
    };

    const result = await analyticsExport.generatePDF(exportData, meta);

    expect(result.filename).toContain('analytics_report_manila_2025-10-19_to_2026-04-19.pdf');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);

    expect(mockGenerateDocument).toHaveBeenCalledTimes(1);
    const [templateName, docData] = mockGenerateDocument.mock.calls[0];

    expect(templateName).toBe('staff-report');
    expect(Array.isArray(docData.sections)).toBe(true);

    const oralSection = docData.sections.find((section) => section.title === 'Oral Findings Prevalence');
    expect(oralSection).toBeDefined();
    expect(oralSection.chartContext).toMatchObject({
      key: 'oralFindings',
      datasetContext: 'booleanOralHealthPrevalence',
    });
    expect(oralSection.filterParameters).toMatchObject({
      branch: 'Manila',
      groupBy: 'monthly',
      department: 'College of Nursing',
      sex: 'Female',
      ageGroup: 'All',
    });

    expect(docData.summary).toMatchObject({
      oralFindingsPrevalence: 'Oral Findings Prevalence (Boolean-based percentages).',
    });
    expect(docData.summary.appliedFilters).toContain('Age Group: All');
  });
});
