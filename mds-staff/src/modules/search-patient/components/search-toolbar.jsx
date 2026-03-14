import React from 'react';

export default function SearchToolbar({
  isLoading,
  searchTerm,
  setSearchTerm,
  handleKeyDown,
  searchType,
  setSearchType,
  filteredCount,
}) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          {isLoading ? (
            <svg className="animate-spin absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by name or student/employee ID…"
            autoComplete="off"
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value)}
          className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="all">All Types</option>
          <option value="student">Students</option>
          <option value="employee">Employees</option>
        </select>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        {searchTerm.trim().length > 0 && searchTerm.trim().length < 2 && (
          <p className="text-xs text-secondary-400 dark:text-neutral-500">Type at least 2 characters to search…</p>
        )}
        {filteredCount > 0 && !isLoading && (
          <p className="text-xs text-secondary-400 dark:text-neutral-500">
            {filteredCount} result{filteredCount !== 1 ? 's' : ''} · ↑↓ to navigate · Enter to open in new tab
          </p>
        )}
      </div>
    </div>
  );
}
