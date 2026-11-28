import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import useCatalogSearch from './use-catalog-search';

let root, container, current;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); jest.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });

function Harness(props) {
  current = useCatalogSearch(props);
  return <button disabled={current.hasExactMatch || current.searching}>Add</button>;
}

test.each(['MedicalCondition', 'Immunization', 'Hospitalization', 'Operation', 'Medication', 'Allergen'])('%s: existing names disable Add and never call create', async domain => {
  const nameKey = domain === 'Allergen' ? 'allergen' : 'name';
  const entry = { id: '13', [nameKey]: 'Hepatitis' };
  const searchFn = jest.fn().mockResolvedValue([entry]);
  const createFn = jest.fn();
  act(() => root.render(<Harness catalog={[entry]} nameKey={nameKey} searchFn={searchFn} createFn={createFn} />));
  act(() => current.handleInputChange('  HEPATITIS  '));
  expect(container.querySelector('button').disabled).toBe(true);
  await act(async () => { await current.createItem('hepatitis'); });
  expect(createFn).not.toHaveBeenCalled();
  expect(current.dynamicItems).toEqual([]);
});

test('requires three characters and ignores old in-flight responses', async () => {
  let resolveOld;
  const searchFn = jest.fn().mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue([{ id: 3, name: 'Bleach' }]);
  act(() => root.render(<Harness searchFn={searchFn} createFn={jest.fn()} />));
  act(() => current.handleInputChange('he'));
  await act(async () => jest.advanceTimersByTime(300));
  expect(searchFn).not.toHaveBeenCalled();
  act(() => current.handleInputChange('Hep'));
  await act(async () => jest.advanceTimersByTime(300));
  act(() => current.handleInputChange('Bleach'));
  await act(async () => jest.advanceTimersByTime(300));
  await act(async () => resolveOld([{ id: 2, name: 'Hepatitis' }]));
  expect(current.suggestions.map(item => item.name)).toEqual(['Bleach']);
  expect(current.hasExactMatch).toBe(true);
});

test('rechecks the server before adding and reuses newly existing records', async () => {
  const entry = { id: 3, name: 'Bleach' };
  const searchFn = jest.fn().mockResolvedValue([entry]);
  const createFn = jest.fn();
  act(() => root.render(<Harness searchFn={searchFn} createFn={createFn} />));
  await act(async () => { await current.createItem('Bleach'); });
  expect(createFn).not.toHaveBeenCalled();
  expect(current.dynamicItems).toEqual([entry]);
});
