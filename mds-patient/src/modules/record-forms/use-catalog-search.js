import { useEffect, useRef, useState } from 'react';

export const normalizeCatalogName = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export default function useCatalogSearch({ catalog = [], searchFn, createFn, nameKey = 'name', onItemSelected }) {
  const [dynamicItems, setDynamicItems] = useState([]);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef(null);
  const timer = useRef(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const normalize = item => normalizeCatalogName(item?.[nameKey]);
  const exactMatch = [...catalog, ...dynamicItems, ...suggestions].find(item => normalize(item) === normalizeCatalogName(input));
  const hasExactMatch = input.trim().length >= 3 && !!exactMatch;

  useEffect(() => {
    const outside = event => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setFocused(false);
    };
    document.addEventListener('mousedown', outside);
    return () => { document.removeEventListener('mousedown', outside); clearTimeout(timer.current); generation.current += 1; };
  }, []);

  const handleInputChange = value => {
    setInput(value);
    clearTimeout(timer.current);
    const request = ++generation.current;
    const query = normalizeCatalogName(value);
    if (query.length < 3) { setSuggestions([]); setSearching(false); return; }
    const local = [...catalog, ...dynamicItems].filter(item => normalize(item).includes(query));
    const merge = results => {
      const items = new Map();
      [...local, ...(results || [])].forEach(item => {
        if (item?.id != null) items.set(String(item.id), item);
      });
      // Exact matches stay visible even when many substring results exist.
      return [...items.values()].sort((a, b) => Number(normalize(b) === query) - Number(normalize(a) === query));
    };
    setSuggestions(merge([]));
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const results = await searchFn(value.trim());
        if (request === generation.current) setSuggestions(merge(results));
      } catch { /* Keep local results. */ }
      finally { if (request === generation.current) setSearching(false); }
    }, 300);
  };

  const selectItem = item => {
    if (!/^[1-9]\d*$/.test(String(item?.id ?? ''))) return null;
    setDynamicItems(previous => catalog.some(entry => String(entry.id) === String(item.id)) || previous.some(entry => String(entry.id) === String(item.id)) ? previous : [...previous, item]);
    onItemSelected?.(item);
    clearTimeout(timer.current);
    generation.current += 1;
    setInput(''); setSuggestions([]); setFocused(false); setSearching(false);
    return item;
  };

  const createItem = async (name, ...extra) => {
    if (String(name || '').trim().length < 3 || busy.current) return null;
    busy.current = true;
    setCreating(true);
    try {
      const query = normalizeCatalogName(name);
      const loaded = [...catalog, ...dynamicItems, ...suggestions].find(item => normalize(item) === query);
      if (loaded) return selectItem(loaded);
      const results = await searchFn(name.trim());
      const existing = (results || []).find(item => normalize(item) === query);
      if (existing) return selectItem(existing);
      const created = await createFn(name.trim(), ...extra);
      return selectItem(Array.isArray(created) ? created[0] : created);
    } catch { return null; }
    finally { busy.current = false; setCreating(false); }
  };

  return { dynamicItems, input, suggestions, creating, searching, focused, wrapperRef, setFocused, handleInputChange, selectItem, createItem, hasExactMatch };
}
