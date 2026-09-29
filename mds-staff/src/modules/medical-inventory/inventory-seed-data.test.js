import {
  CATEGORIES,
  LOCATIONS,
  SEED_BATCHES,
  SEED_ITEMS,
  STATUS_BADGES,
  computeItemStats,
  getExpiryStatus,
} from './inventory-seed-data';

describe('inventory seed helpers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('exposes UI catalogue constants', () => {
    expect(LOCATIONS).toEqual(['Casal', 'Arlegui', 'QuezonCity']);
    expect(CATEGORIES.map(({ value }) => value)).toEqual(['medicine', 'supply']);
    expect(STATUS_BADGES.Approved).toContain('success');
  });

  it.each([
    [null, 'No Expiry'],
    ['2026-02-28', 'Expired'],
    ['2026-03-20', '19d left'],
    ['2026-05-01', '61d left'],
    ['2026-12-01', 'Good'],
  ])('classifies %p as %s', (date, label) => {
    expect(getExpiryStatus(date).label).toBe(label);
  });

  it('computes normalized stock, branch warnings, expiry, and batch de-duplication', () => {
    const [item] = computeItemStats([{ id: 1, category: 'Medicine' }], [
      { medicalItemId: 1, batchNumber: 'B1', location: 'Casal', currentQuantity: 5, expiryDate: '2026-02-28' },
      { medicalItemId: 1, batchNumber: 'B1', location: 'Casal', currentQuantity: 3, expiryDate: '2026-02-28' },
      { medicalItemId: 1, batchNumber: 'B2', location: 'QuezonCity', availableQuantity: 20, expiryDate: '2026-03-20' },
    ]);
    expect(item).toMatchObject({ category: 'medicine', totalStock: 28, casalStock: 8, quezonCity: 20, batchCount: 2, isLowStock: true, hasExpired: true, hasExpiringSoon: true });
    expect(item.lowStockBranches).toEqual([{ location: 'Casal', stock: 8 }]);
  });

  it('keeps seed batches and items internally consistent', () => {
    const itemIds = new Set(SEED_ITEMS.map((item) => item.id));
    expect(SEED_BATCHES.every((batch) => itemIds.has(batch.medicalItemId))).toBe(true);
  });
});
