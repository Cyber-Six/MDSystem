/**
 * useCatalogSearch — Reusable hook for searching and creating catalog items.
 * Port of mds-patient's useCatalogSearch pattern to React Native.
 *
 * Provides debounced search, suggestion display, and item creation
 * for "Others" fields in medical record forms.
 */

import { useState, useRef, useCallback } from 'react';

interface CatalogSearchOptions<T> {
  /** Pre-loaded catalog items (from fetchAllCatalogs) */
  catalog: T[];
  /** Backend search function */
  searchFn: (query: string) => Promise<T[]>;
  /** Backend create function */
  createFn: (...args: any[]) => Promise<T[]>;
  /** Field name used for display/matching (default: 'name') */
  nameKey?: keyof T;
}

interface CatalogSearchResult<T> {
  /** User-added items (from search results or creation) */
  dynamicItems: T[];
  /** Current search input text */
  input: string;
  /** Current search suggestions */
  suggestions: T[];
  /** Whether a search is in progress */
  searching: boolean;
  /** Whether a create is in progress */
  creating: boolean;
  /** Whether the suggestions dropdown should be visible */
  focused: boolean;
  /** Set focused state */
  setFocused: (v: boolean) => void;
  /** Handle input text change (triggers debounced search) */
  handleInputChange: (value: string) => void;
  /** Select an item from suggestions */
  selectItem: (item: T) => void;
  /** Create a new item */
  createItem: (...args: any[]) => Promise<void>;
  /** Set dynamic items externally (e.g. from prefill) */
  setDynamicItems: React.Dispatch<React.SetStateAction<T[]>>;
}

export function useCatalogSearch<T extends { id: string }>({
  catalog,
  searchFn,
  createFn,
  nameKey = 'name' as keyof T,
}: CatalogSearchOptions<T>): CatalogSearchResult<T> {
  const [dynamicItems, setDynamicItems] = useState<T[]>([]);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [focused, setFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const existingIds = new Set([
    ...catalog.map(c => c.id),
    ...dynamicItems.map(c => c.id),
  ]);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchFn(value.trim());
        // Filter out items already in catalog or dynamic
        const filtered = results.filter(r => !existingIds.has(r.id));
        setSuggestions(filtered);
      } catch {
        setSuggestions([]);
      }
      setSearching(false);
    }, 300);
  }, [searchFn, existingIds]);

  const selectItem = useCallback((item: T) => {
    setDynamicItems(prev => {
      if (prev.some(d => d.id === item.id)) return prev;
      return [...prev, item];
    });
    setInput('');
    setSuggestions([]);
    setFocused(false);
  }, []);

  const createItem = useCallback(async (...args: any[]) => {
    setCreating(true);
    try {
      const created = await createFn(...args);
      if (created.length > 0) {
        const newItem = created[0];
        setDynamicItems(prev => {
          if (prev.some(d => d.id === newItem.id)) return prev;
          return [...prev, newItem];
        });
        setInput('');
        setSuggestions([]);
        setFocused(false);
      }
    } finally {
      setCreating(false);
    }
  }, [createFn]);

  return {
    dynamicItems,
    input,
    suggestions,
    searching,
    creating,
    focused,
    setFocused,
    handleInputChange,
    selectItem,
    createItem,
    setDynamicItems,
  };
}

export default useCatalogSearch;
