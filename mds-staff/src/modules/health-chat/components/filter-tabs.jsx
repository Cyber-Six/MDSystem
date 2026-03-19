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
    <div
      className="flex-shrink-0"
      style={{ borderBottom: '1px solid #e8e5e0' }}
    >
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: '#a19b93' }}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search patients…"
            className="w-full pl-8 pr-7 py-2 text-xs rounded-lg transition-all duration-150
                       focus:outline-none"
            style={{
              background: '#f4f2ef',
              border: '1px solid #e8e5e0',
              color: '#28251f',
            }}
            onFocus={e => {
              e.target.style.borderColor = '#f4c430';
              e.target.style.boxShadow = '0 0 0 2px rgba(244,196,48,0.12)';
            }}
            onBlur={e => {
              e.target.style.borderColor = '#e8e5e0';
              e.target.style.boxShadow = 'none';
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors"
              style={{ color: '#a19b93' }}
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
              className="flex-1 py-2 text-xs font-medium relative transition-colors duration-150"
              style={{
                color: active ? '#28251f' : '#a19b93',
                background: 'transparent',
                borderBottom: active ? '2px solid #f4c430' : '2px solid transparent',
              }}
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