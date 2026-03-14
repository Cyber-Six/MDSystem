import React from 'react';
import PersonalInformation from './personal-information';
import MedicalRecord from './medical-record';

export default function SearchResultsPanel({
  hasFired,
  isLoading,
  filtered,
  searchTerm,
  focusedIdx,
  listRef,
  onOpenPatientInNewTab,
}) {
  if (!hasFired || isLoading) return null;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      {filtered.length === 0 ? (
        <div className="p-10 text-center">
          <svg className="w-10 h-10 mx-auto text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm text-secondary-500 dark:text-neutral-400">No patients found for "{searchTerm}"</p>
          <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">Try a different name or ID number</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 px-4 py-2 bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">
            <span className="w-9" />
            <span>Patient</span>
            <span className="text-right">Branch</span>
            <span className="text-right">Scope</span>
            <span className="text-right">Record Status</span>
          </div>

          <ul ref={listRef} className="divide-y divide-neutral-100 dark:divide-neutral-700">
            {filtered.map((patient, idx) => (
              <li key={patient.id}>
                <button
                  onClick={() => onOpenPatientInNewTab?.(patient.id)}
                  className={`w-full grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 items-center px-4 py-3 text-left transition-colors ${
                    focusedIdx === idx
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/50'
                  }`}
                >
                  <PersonalInformation patient={patient} />
                  <MedicalRecord patient={patient} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
