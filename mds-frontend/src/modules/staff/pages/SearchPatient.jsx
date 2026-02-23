import React, { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Search Patient Page
 * Staff can search students/employees by name, ID, or email
 */
const SearchPatient = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // TODO: Replace filter with real API call to search patients
  // Patient info maps from: UsersPersonal (name, contact) + student_profile (program, year)
  //   + employee_profile (position) + UserCredentials (email, identifier)
  const mockPatients = [];

  const handleSearch = (e) => {
    e.preventDefault();
    setIsSearching(true);
    setHasSearched(true);
    
    // Simulate API call
    setTimeout(() => {
      const filtered = mockPatients.filter(patient => {
        const matchesQuery = searchQuery.toLowerCase() === '' ||
          patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          patient.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          patient.email.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesType = searchType === 'all' || 
          (searchType === 'student' && patient.type === 'Student') ||
          (searchType === 'employee' && patient.type === 'Employee');
        
        return matchesQuery && matchesType;
      });
      setResults(filtered);
      setIsSearching(false);
    }, 500);
  };

  return (
    <div className="space-y-2">
      {/* Search Form */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-2.5">
        <form onSubmit={handleSearch}>
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search Input */}
            <div className="flex-1 relative">
              <svg 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 dark:text-neutral-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, ID, or email..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            
            {/* Type Filter */}
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="student">Students</option>
              <option value="employee">Employees</option>
            </select>

            {/* Search Button */}
            <button
              type="submit"
              disabled={isSearching}
              className="px-4 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-400 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {isSearching ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Searching...
                </>
              ) : (
                'Search'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        {/* Results Header */}
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">
            {hasSearched ? `Results (${results.length})` : 'Search Results'}
          </h3>
          {results.length > 0 && (
            <span className="text-xs text-secondary-500 dark:text-neutral-400">
              Showing {results.length} patient(s)
            </span>
          )}
        </div>

        {/* Results Table */}
        {!hasSearched ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-secondary-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm text-secondary-500 dark:text-neutral-400">Enter a search query to find patients</p>
          </div>
        ) : isSearching ? (
          <div className="p-8 text-center">
            <svg className="animate-spin w-8 h-8 mx-auto text-primary-500 mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm text-secondary-500 dark:text-neutral-400">Searching...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-secondary-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-secondary-500 dark:text-neutral-400">No patients found matching your search</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-700/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Patient</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider hidden sm:table-cell">ID</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider hidden md:table-cell">Program/Dept</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Year</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {results.map((patient) => (
                  <tr key={patient.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-600 rounded-full flex items-center justify-center text-xs font-medium text-secondary-600 dark:text-neutral-300 flex-shrink-0">
                          {patient.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-secondary-800 dark:text-white truncate">{patient.name}</p>
                            {patient.hasCompleteRecord && (
                              <svg className="w-4 h-4 text-success-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" title="Complete Medical Record">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <p className="text-xs text-secondary-500 dark:text-neutral-400 truncate">{patient.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-secondary-600 dark:text-neutral-300 hidden sm:table-cell">{patient.id}</td>
                    <td className="px-3 py-2 text-secondary-600 dark:text-neutral-300 hidden md:table-cell">{patient.program}</td>
                    <td className="px-3 py-2 text-secondary-600 dark:text-neutral-300 hidden lg:table-cell">{patient.year}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                        patient.status === 'Active' 
                          ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                          : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}>
                        {patient.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to={`/staff/patient/${patient.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
                      >
                        View
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPatient;
