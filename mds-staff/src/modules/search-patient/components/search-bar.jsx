import React from 'react';

const SearchBar = ({ searchTerm, onSearchTermChange, isLoading, resultCount, onKeyDown, inputRef }) => {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
      <div className="flex flex-col gap-2">
        {/* Input */}
        <div className="flex-1 relative">
          {isLoading ? (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-500 flex items-center justify-center">
              <span className="animate-spin w-4 h-4 rounded-full border-2 border-current/20 border-t-current block" />
            </span>
          ) : (
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search patient by name or student/employee ID…"
            name="patient-search-input"
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="search"
            data-lpignore="true"
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Hint */}
      <div className="mt-1.5 flex items-center gap-2">
        {searchTerm.trim().length > 0 && searchTerm.trim().length < 2 && (
          <p className="text-xs text-secondary-400 dark:text-neutral-500">Type at least 2 characters to search…</p>
        )}
        {resultCount > 0 && !isLoading && (
          <p className="text-xs text-secondary-400 dark:text-neutral-500">
            {resultCount} result{resultCount !== 1 ? 's' : ''} · ↑↓ to navigate · Enter to select
          </p>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
