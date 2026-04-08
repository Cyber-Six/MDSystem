import React, { useState, useMemo } from 'react';
import { CATEGORIES, CATEGORY_COLORS } from '../../inventory-seed-data';
import { getDisplayLocation } from '../../medical-inventory-service';

/**
 * Medical Items List — searchable, filterable table matching appointment-queue pattern.
 * @param {Array} items - Medical items to display
 * @param {boolean} loading - Loading state
 * @param {string} error - Error message
 * @param {Array} allowedLocations - List of locations the user has access to (for filtering)
 * @param {Function} onSelectItem - Item selection handler
 * @param {Function} onAddItem - Add item handler
 * @param {Function} onAddSupply - Add supply handler
 * @param {Function} onEditItem - Edit item handler
 * @param {Function} onDeleteItem - Delete item handler
 */
const MedicalItemList = ({ items, loading, error, allowedLocations = [], onSelectItem, onAddItem, onAddSupply, onEditItem, onDeleteItem }) => {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const filtered = useMemo(() => {
    const result = items.filter((item) => {
      const q = search.toLowerCase();
      const matchSearch = !q || item.item_name.toLowerCase().includes(q) || item.item_code.toLowerCase().includes(q);
      const matchCat = filterCategory === 'all' || item.category === filterCategory;
      const matchLoc = filterLocation === 'all' || item.batches?.some((b) => b.location === filterLocation);
      const matchStatus = filterStatus === 'all'
        || (filterStatus === 'good' && !item.isLowStock && !item.hasExpired && !item.hasExpiringSoon)
        || (filterStatus === 'low' && item.isLowStock)
        || (filterStatus === 'expired' && item.hasExpired)
        || (filterStatus === 'expiring' && item.hasExpiringSoon);
      return matchSearch && matchCat && matchLoc && matchStatus;
    });
    console.log('🔍 Items filtered:', { totalItems: items.length, filterCategory, filteredCount: result.length, sampleCategories: items.slice(0, 3).map(i => ({ id: i.id, name: i.item_name, category: i.category })) });
    return result;
  }, [items, search, filterCategory, filterLocation, filterStatus]);

  return (
    <div className="space-y-2">
      {/* Filter Bar */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Category */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-medium text-secondary-500 dark:text-neutral-400 shrink-0">Category</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500">
              <option value="all">All</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-medium text-secondary-500 dark:text-neutral-400 shrink-0">Clinic</label>
            <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500">
              <option value="all">All</option>
              {allowedLocations.map((l) => <option key={l} value={l}>{getDisplayLocation(l)}</option>)}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-medium text-secondary-500 dark:text-neutral-400 shrink-0">Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500">
              <option value="all">All</option>
              <option value="good">Good Condition</option>
              <option value="low">Low Stock</option>
              <option value="expiring">Expiring Soon</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {/* Add Item */}
          <button onClick={onAddItem} className="ml-auto px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Item
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-700/50 border-b-2 border-neutral-200 dark:border-neutral-600">
              <tr>
                <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Code</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Item Name</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Category</th>
                {/* Dynamic location columns based on user access */}
                {allowedLocations.includes('Casal') && (
                  <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Casal</th>
                )}
                {allowedLocations.includes('Arlegui') && (
                  <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Arlegui</th>
                )}
                {allowedLocations.includes('QuezonCity') && (
                  <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Quezon City</th>
                )}
                <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Total</th>
                <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Batches</th>
                <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                <th className="px-3 py-1.5 text-center text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {loading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 + allowedLocations.length }).map((__, j) => (
                      <td key={j} className="px-3 py-2">
                        <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7 + allowedLocations.length} className="px-4 py-8 text-center">
                    <p className="text-xs text-error-500 dark:text-error-400">{error}</p>
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={7 + allowedLocations.length} className="px-4 py-8 text-center">
                    <svg className="w-10 h-10 mx-auto text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    <p className="text-xs text-secondary-400 dark:text-neutral-500">No items match your filters</p>
                  </td>
                </tr>
              )}
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer" onClick={() => onSelectItem(item)}>
                  <td className="px-3 py-1.5 text-xs font-mono text-secondary-500 dark:text-neutral-400">{item.item_code}</td>
                  <td className="px-3 py-1.5">
                    <p className="text-xs font-medium text-secondary-800 dark:text-white leading-none m-0">{item.item_name}</p>
                    {item.subcategory && <p className="text-[10px] text-secondary-400 dark:text-neutral-500 leading-none m-0">{item.subcategory}</p>}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded capitalize ${CATEGORY_COLORS[item.category?.toLowerCase()] || ''}`}>{item.category}</span>
                  </td>
                  {/* Dynamic location columns based on user access */}
                  {allowedLocations.includes('Casal') && (
                    <td className="px-3 py-1.5 text-center text-xs text-secondary-700 dark:text-neutral-300">{item.casalStock}</td>
                  )}
                  {allowedLocations.includes('Arlegui') && (
                    <td className="px-3 py-1.5 text-center text-xs text-secondary-700 dark:text-neutral-300">{item.arlegui}</td>
                  )}
                  {allowedLocations.includes('QuezonCity') && (
                    <td className="px-3 py-1.5 text-center text-xs text-secondary-700 dark:text-neutral-300">{item.quezonCity}</td>
                  )}
                  <td className="px-3 py-1.5 text-center text-xs font-medium text-secondary-800 dark:text-white">{item.totalStock}</td>
                  <td className="px-3 py-1.5 text-center text-xs text-secondary-500 dark:text-neutral-400">{item.batchCount}</td>
                  <td className="px-3 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {item.isLowStock && (
                        <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400">Low</span>
                      )}
                      {item.hasExpired && (
                        <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400">Expired</span>
                      )}
                      {item.hasExpiringSoon && !item.hasExpired && (
                        <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">Expiring</span>
                      )}
                      {!item.isLowStock && !item.hasExpired && !item.hasExpiringSoon && (
                        <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400">Good</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => onAddSupply(item.id)} className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline font-medium">Supply</button>
                      <span className="text-neutral-300 dark:text-neutral-600">•</span>
                      <button onClick={() => onEditItem(item)} className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-medium">Edit</button>
                      <span className="text-neutral-300 dark:text-neutral-600">•</span>
                      <button onClick={() => onDeleteItem(item)} className="text-[10px] text-error-600 dark:text-error-400 hover:underline font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1.5 border-t border-neutral-200 dark:border-neutral-700 text-[10px] text-secondary-400 dark:text-neutral-500">
          Showing {filtered.length} of {items.length} items
        </div>
      </div>
    </div>
  );
};

export default MedicalItemList;
