import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, UserPlus, UserMinus, Users, AlertCircle } from 'lucide-react';
import { listWhitelist, addWhitelist, removeWhitelist } from '../staff-appointment-service';
import { searchPatients, formatPatientName } from '../../../services/patient-search-service';

/**
 * Whitelist Manager Component
 * Modal for managing patients in a scheduler's whitelist.
 * Allows viewing, adding, and removing whitelisted patients.
 */
const WhitelistManager = ({ schedulerId, isOpen, onClose, onUpdate }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

  // Action state
  const [removing, setRemoving] = useState(null);
  const [adding, setAdding] = useState(false);

  // Load whitelist entries
  const loadEntries = useCallback(async () => {
    if (!schedulerId) return;
    setLoading(true);
    setError('');
    try {
      const data = await listWhitelist(schedulerId, 0, 100);
      setEntries(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load whitelist');
      console.error('Error loading whitelist:', err);
    } finally {
      setLoading(false);
    }
  }, [schedulerId]);

  useEffect(() => {
    if (isOpen && schedulerId) {
      loadEntries();
    }
  }, [isOpen, schedulerId, loadEntries]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search for patients
  const handleSearchInput = (value) => {
    setSearchInput(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);

    // Debounce search by 1000ms (1 second) to save backend resources
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchPatients(value.trim(), 10);

        // Filter out patients already in whitelist
        const filteredResults = results.filter(
          patient => !entries.some(e => String(e.patientId) === String(patient.id))
        );

        setSearchResults(filteredResults);
        setShowDropdown(filteredResults.length > 0);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        setSearching(false);
      }
    }, 1000);
  };

  // Select patient from dropdown
  const handleSelectPatient = async (patient) => {
    setAdding(true);
    setError('');
    setShowDropdown(false);

    try {
      await addWhitelist(schedulerId, [patient.id]);
      await loadEntries();
      setSearchInput('');
      setSearchResults([]);
      onUpdate?.();
    } catch (err) {
      setError(err.message || 'Failed to add patient');
    } finally {
      setAdding(false);
    }
  };

  // Remove patient from whitelist
  const handleRemove = async (patientId) => {
    setRemoving(patientId);
    setError('');
    try {
      await removeWhitelist(schedulerId, [patientId]);
      await loadEntries();
      onUpdate?.();
    } catch (err) {
      setError(err.message || 'Failed to remove patient');
    } finally {
      setRemoving(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">Manage Whitelist</h2>
              <p className="text-sm text-secondary-500 dark:text-neutral-400">{entries.length} patient{entries.length !== 1 ? 's' : ''} whitelisted</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-secondary-500 dark:text-neutral-400" />
          </button>
        </div>

        {/* Search Section */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <label className="block text-sm font-medium text-secondary-600 dark:text-neutral-300 mb-2">
            Search Patient by Name, Email, or ID
          </label>
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Type to search..."
                className="w-full pl-9 pr-3 py-2 text-base border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {searchResults.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    disabled={adding}
                    className="w-full px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50 border-b border-neutral-100 dark:border-neutral-600 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-sm font-bold text-primary-600 dark:text-primary-400 flex-shrink-0">
                        {patient.identifier?.toString().slice(-2) || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-secondary-900 dark:text-white truncate">
                          {formatPatientName(patient)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm text-secondary-600 dark:text-neutral-400">
                            ID: {patient.identifier}
                          </span>
                          {patient.profile_type && (
                            <>
                              <span className="text-sm text-neutral-400">•</span>
                              <span className="text-sm text-secondary-600 dark:text-neutral-400">
                                {patient.profile_type}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <UserPlus className="w-4 h-4 text-primary-500 dark:text-primary-400 flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No Results */}
            {showDropdown && searchInput.trim() && !searching && searchResults.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg shadow-lg p-4 text-center">
                <AlertCircle className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                <p className="text-base text-secondary-500 dark:text-neutral-400">No patients found</p>
                <p className="text-sm text-secondary-400 dark:text-neutral-500 mt-1">
                  Try searching with a different name, ID, or email
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-error-600 dark:text-error-400 flex-shrink-0" />
            <p className="text-base text-error-700 dark:text-error-300">{error}</p>
          </div>
        )}

        {/* Whitelist Entries */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
              <p className="text-base text-secondary-500 dark:text-neutral-400">No patients in whitelist</p>
              <p className="text-sm text-secondary-400 dark:text-neutral-500 mt-1">
                Search for patients above to add them
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg border border-neutral-200 dark:border-neutral-600"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-sm font-semibold text-primary-600 dark:text-primary-400 flex-shrink-0">
                      {entry.patientIdentifier?.toString().slice(-2) || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-medium text-secondary-800 dark:text-white truncate">
                        {entry.patientName?.trim() || 'Unknown Patient'}
                      </p>
                      <p className="text-sm text-secondary-500 dark:text-neutral-400">
                        ID: {entry.patientIdentifier || entry.patientId}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(entry.patientId)}
                    disabled={removing === entry.patientId}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-md transition-colors disabled:opacity-50"
                    title="Remove from whitelist"
                  >
                    {removing === entry.patientId ? (
                      <div className="w-3.5 h-3.5 border-2 border-error-500/30 border-t-error-500 rounded-full animate-spin" />
                    ) : (
                      <UserMinus className="w-3.5 h-3.5" />
                    )}
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-700 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-base font-medium text-secondary-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhitelistManager;
