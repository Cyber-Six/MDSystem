/**
 * useCatalogSearch — Reusable hook for searching and creating catalog items.
 * Port of mds-patient's useCatalogSearch pattern to React Native.
 *
 * Provides debounced search, suggestion display, and item creation
 * for "Others" fields in medical record forms.
 */

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';

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
  /** Exact name already exists in the loaded catalog or current results. */
  hasExactMatch: boolean;
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

  const normalize = useCallback((value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase(), []);
  const hasExactMatch = useMemo(() => {
    const query = normalize(input);
    return query.length >= 3 && [...catalog, ...dynamicItems, ...suggestions].some(
      item => normalize(item[nameKey]) === query,
    );
  }, [catalog, dynamicItems, input, nameKey, normalize, suggestions]);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchFn(value.trim());
        // Keep existing items visible so users can select them, but never treat
        // an exact existing name as a new item.
        const merged = new Map<string, T>();
        [...results, ...catalog, ...dynamicItems].forEach(item => {
          if (normalize(item[nameKey]).includes(normalize(value)) && !merged.has(item.id)) merged.set(item.id, item);
        });
        setSuggestions([...merged.values()]);
      } catch {
        setSuggestions([]);
      }
      setSearching(false);
    }, 300);
  }, [searchFn, catalog, dynamicItems, nameKey, normalize]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const selectItem = useCallback((item: T) => {
    setDynamicItems(prev => {
      if (catalog.some(c => c.id === item.id) || prev.some(d => d.id === item.id)) return prev;
      return [...prev, item];
    });
    setInput('');
    setSuggestions([]);
    setFocused(false);
  }, [catalog]);

  const createItem = useCallback(async (...args: any[]) => {
    const requestedName = String(args[0] ?? input).trim();
    if (requestedName.length < 3) return;
    setCreating(true);
    try {
      const localMatch = [...catalog, ...dynamicItems, ...suggestions].find(
        item => normalize(item[nameKey]) === normalize(requestedName),
      );
      if (localMatch) {
        selectItem(localMatch);
        return;
      }
      // Search again at action time to close the stale-search race. The server
      // also enforces uniqueness for requests that race this check.
      let latestMatches: T[] = [];
      try { latestMatches = await searchFn(requestedName); } catch { /* Backend create still enforces uniqueness. */ }
      const existing = latestMatches.find(item => normalize(item[nameKey]) === normalize(requestedName));
      if (existing) {
        selectItem(existing);
        return;
      }
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
  }, [catalog, createFn, dynamicItems, input, nameKey, normalize, searchFn, selectItem, suggestions]);

  return {
    dynamicItems,
    input,
    suggestions,
    hasExactMatch,
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
