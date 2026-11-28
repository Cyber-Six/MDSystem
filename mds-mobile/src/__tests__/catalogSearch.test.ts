import { act, renderHook } from '@testing-library/react-native';
import { useCatalogSearch } from '../hooks/useCatalogSearch';

type Entry = { id: string; name: string };

test('selects an exact server match rather than creating a duplicate', async () => {
  const existing: Entry = { id: '7', name: 'Bleach' };
  const searchFn = jest.fn<Promise<Entry[]>, [string]>().mockResolvedValue([existing]);
  const createFn = jest.fn<Promise<Entry[]>, [string]>().mockResolvedValue([]);
  const hook = renderHook(() => useCatalogSearch<Entry>({ catalog: [], searchFn, createFn }));

  await act(async () => {
    hook.result.current.handleInputChange(' bleach ');
    await hook.result.current.createItem(' bleach ');
  });

  expect(searchFn).toHaveBeenCalledWith('bleach');
  expect(createFn).not.toHaveBeenCalled();
  expect(hook.result.current.dynamicItems).toEqual([existing]);
});

test('does not call search or create when an exact item is already loaded', async () => {
  const existing: Entry = { id: '9', name: 'Tree Nuts' };
  const searchFn = jest.fn<Promise<Entry[]>, [string]>();
  const createFn = jest.fn<Promise<Entry[]>, [string]>();
  const hook = renderHook(() => useCatalogSearch<Entry>({ catalog: [existing], searchFn, createFn }));

  await act(async () => {
    hook.result.current.handleInputChange('tree nuts');
    await hook.result.current.createItem('tree nuts');
  });

  expect(searchFn).not.toHaveBeenCalled();
  expect(createFn).not.toHaveBeenCalled();
  expect(hook.result.current.dynamicItems).toEqual([]);
  expect(hook.result.current.hasExactMatch).toBe(false); // selection clears the search term
});
