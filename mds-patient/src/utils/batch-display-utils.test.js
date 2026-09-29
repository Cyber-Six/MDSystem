import {
  formatDateDisplay,
  formatBatchDisplay,
  getBatchDropdownText,
} from './batch-display-utils';

describe('batch display utilities', () => {
  test.each([
    [null, 'N/A'],
    ['', 'N/A'],
    ['not-a-date', 'N/A'],
    ['2026-05-01T12:00:00.000Z', 'May 1, 2026'],
    [1777636800, 'May 1, 2026'],
    [1777636800000, 'May 1, 2026'],
    [new Date('2026-05-01T12:00:00.000Z'), 'May 1, 2026'],
  ])('formatDateDisplay(%p) returns %s', (value, expected) => {
    expect(formatDateDisplay(value)).toBe(expected);
  });

  test('formats full, compact, and dropdown batch representations', () => {
    const batch = {
      batchNumber: 'A-12',
      availableQuantity: 8,
      expiryDate: '2026-05-01T12:00:00.000Z',
    };

    expect(formatBatchDisplay(batch)).toBe('Batch #A-12 — 8 available — Expires: May 1, 2026');
    expect(formatBatchDisplay(batch, { compact: true })).toBe('Batch #A-12 (8 units, Exp: May 1, 2026)');
    expect(formatBatchDisplay(batch, { compact: true, showUnit: false })).toBe('Batch #A-12 (8, Exp: May 1, 2026)');
    expect(getBatchDropdownText(batch)).toBe('#A-12 (Exp: May 1, 2026) — 8 avail');
  });

  test('uses fallback identifiers, quantities, and empty-state labels', () => {
    expect(formatBatchDisplay(null)).toBe('N/A');
    expect(getBatchDropdownText(null)).toBe('No batch');

    const fallbackBatch = { id: 'fallback', currentQuantity: 3, expiryDate: null };
    expect(formatBatchDisplay(fallbackBatch)).toBe('Batch #fallback — 3 available — Expires: N/A');
    expect(getBatchDropdownText(fallbackBatch)).toBe('#fallback (Exp: N/A) — 3 avail');
  });
});
