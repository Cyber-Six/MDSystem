jest.mock('../../config/db', () => ({ query: jest.fn() }));
jest.mock('../../config/redis', () => ({ getKey: jest.fn().mockResolvedValue(null), setKey: jest.fn().mockResolvedValue('OK') }));

const analytics = require('./analytics-query');
const db = require('../../config/db');

test('exposes query metadata and distinguishes registered queries from unknown ones', async () => {
  expect(analytics.getAvailableQueries().length).toBeGreaterThan(0);
  expect(analytics.hasQuery('consultations-by-type')).toBe(true);
  expect(analytics.hasQuery('not-registered')).toBe(false);
  expect(analytics.getAvailableReports()).toEqual([]);
  expect(analytics.hasReport('not-registered')).toBe(false);
  await expect(analytics.executeQuery('not-registered', 'Both', 'a', 'b')).rejects.toThrow('Unknown query type');
});

test('batch execution isolates unknown metric failures and filter options are deduplicated', async () => {
  await expect(analytics.executeBatchQueries(['missing'], 'Both', 'a', 'b')).resolves.toEqual({ missing: { success: false, error: 'Unknown query type: missing' } });
  db.query.mockResolvedValue({ rows: [] });
  const options = await analytics.getFilterOptions();
  expect(options).toHaveProperty('departments');
  expect(options).toHaveProperty('sexes', ['Male', 'Female']);
  expect(options.ageGroups.length).toBeGreaterThan(0);
});
