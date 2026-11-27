import { completeCatalogPages } from './catalog-pages';
test('loads unapproved choices beyond the first page and keeps labels with equivalent IDs', async () => {
  const request = jest.fn().mockResolvedValue({ rows: [{ id: '201', name: 'QA custom condition' }] });
  const rows = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, name: `Condition ${i}` }));
  const result = await completeCatalogPages({ medical: rows }, { medical: 'getDomainCatalogs(domain: MedicalCondition,' }, request);
  expect(result.medical).toHaveLength(201);
  expect(result.medical[200].name).toBe('QA custom condition');
  expect(request.mock.calls[0][0]).not.toContain('filterIsValid');
  expect(request.mock.calls[0][1]).toEqual({ offset: 200 });
});
test('fails clearly if a catalog endpoint repeats its first page', async () => {
  const rows = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, name: 'QA' }));
  await expect(completeCatalogPages({ medical: rows }, { medical: 'getDomainCatalogs(domain: MedicalCondition,' }, async () => ({ rows }))).rejects.toThrow('did not advance');
});
