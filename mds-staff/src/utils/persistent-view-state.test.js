import { readPersistedViewState, writePersistedViewState } from './persistent-view-state';

describe('persisted view state', () => {
  beforeEach(() => localStorage.clear());

  test('returns the fallback for absent, invalid, and rejected values', () => {
    expect(readPersistedViewState('view', 'fallback')).toBe('fallback');
    localStorage.setItem('view', '{not json');
    expect(readPersistedViewState('view', 'fallback')).toBe('fallback');
    localStorage.setItem('view', JSON.stringify({ tab: 'admin' }));
    expect(readPersistedViewState('view', 'fallback', () => false)).toBe('fallback');
  });

  test('reads validated values and writes JSON to storage', () => {
    writePersistedViewState('view', { tab: 'dashboard' });
    expect(localStorage.getItem('view')).toBe('{"tab":"dashboard"}');
    expect(readPersistedViewState('view', null, (value) => value.tab === 'dashboard')).toEqual({ tab: 'dashboard' });
  });

  test('swallows storage write failures', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => writePersistedViewState('view', { tab: 'dashboard' })).not.toThrow();
    setItem.mockRestore();
  });
});
