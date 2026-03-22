import React from 'react';
import { Search, X } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';

const FilterTabs = () => {
  const { selectedFilters, updateSelectedFilters, searchTerm, setSearchTerm } = useHealthChat();

  const filters = [
    { id: 'active',  label: 'Active Ticket' },
    { id: 'pending', label: 'Pending' },
    { id: 'archive', label: 'Archive' },
  ];

  const handleFilterToggle = (filterId) => {
    const newFilters = selectedFilters.includes(filterId)
      ? selectedFilters.filter(f => f !== filterId)
      : [...selectedFilters, filterId];

    updateSelectedFilters(newFilters);
  };

  return (
    <div className="flex-shrink-0 border-b border-neutral-200 dark:border-neutral-700">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search patients…"
            className="w-full pl-8 pr-7 py-2 text-xs rounded-lg transition-all duration-150
                       bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700
                       text-secondary-800 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500
                       focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Checkboxes */}
      <div className="px-3 py-1.5 flex gap-0 justify-between">
        {filters.map((filter) => {
          const isChecked = selectedFilters.includes(filter.id);
          return (
            <label
              key={filter.id}
              className="flex items-center gap-1 cursor-pointer px-1.5 py-0.5 rounded-md transition-all duration-200 flex-1 justify-center"
              style={{
                backgroundColor: isChecked ? 'rgba(var(--color-primary-500), 0.1)' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleFilterToggle(filter.id)}
                className="w-3.5 h-3.5 rounded accent-primary-500 cursor-pointer"
              />
              <span className={`text-xs font-medium transition-colors whitespace-nowrap ${
                isChecked
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
              >
                {filter.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default FilterTabs;
