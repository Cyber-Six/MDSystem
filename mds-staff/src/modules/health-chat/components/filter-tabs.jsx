import React from 'react';
import { Search, X } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';

const FilterTabs = () => {
  const { filter, setFilter, ticketsTotal, searchTerm, setSearchTerm } = useHealthChat();

  const tabs = [
    { id: 'active', label: 'Active' },
    { id: 'pending', label: 'Pending' },
    { id: 'archive', label: 'Archive' }
  ];

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-700">
      {/* Search Bar */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search patients..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 border-0
                     rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500
                     text-neutral-900 dark:text-white placeholder-neutral-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors relative
                     ${filter === tab.id
                       ? 'text-primary-600 dark:text-primary-400'
                       : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                     }`}
          >
            {tab.label}
            {filter === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FilterTabs;
