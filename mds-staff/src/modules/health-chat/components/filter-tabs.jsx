import React from 'react';
import { Search, X } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';

const FilterTabs = () => {
  const { filter, setFilter, searchTerm, setSearchTerm } = useHealthChat();

  const tabs = [
    { id: 'active',  label: 'Active' },
    { id: 'pending', label: 'Pending' },
    { id: 'archive', label: 'Archive' },
  ];

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

      {/* Tabs */}
      <div className="flex">
        {tabs.map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex-1 py-2 text-xs font-medium relative transition-colors duration-150 border-b-2
                         ${active
                           ? 'text-secondary-800 dark:text-white border-primary-500'
                           : 'text-neutral-400 dark:text-neutral-500 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300'
                         }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FilterTabs;
