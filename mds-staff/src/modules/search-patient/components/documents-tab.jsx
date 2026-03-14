import React from 'react';
import PatientSectionCard from './section-card';

export default function PatientDocumentsTab() {
  return (
    <PatientSectionCard title="Documents">
      <div className="py-8 text-center">
        <svg className="w-10 h-10 mx-auto text-secondary-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm text-secondary-500 dark:text-neutral-400">Documents feature coming soon</p>
        <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">Certificates, lab results, dental photos, and uploads will appear here.</p>
      </div>
    </PatientSectionCard>
  );
}
