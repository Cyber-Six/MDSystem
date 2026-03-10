import React from 'react';
import { BackButton } from './shared';

const RequirementsUpload = ({ requirements, uploadedFiles, onFileUpload, onNext, onBack }) => (
  <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
    <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">Upload Requirements</h2>
    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
      Please upload all required documents before submitting your appointment.
    </p>
    <div className="space-y-4">
      {requirements.map((req) => (
        <div key={req.id} className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
          <label className="block text-sm font-medium text-neutral-900 dark:text-white mb-1">{req.label}</label>
          {req.notes && <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">{req.notes}</p>}
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileUpload(req.id, file.name);
            }}
            className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 dark:file:bg-primary-900/20 file:text-primary-700 dark:file:text-primary-300 hover:file:bg-primary-100"
          />
          {uploadedFiles[req.id] && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">Uploaded: {uploadedFiles[req.id]}</p>
          )}
        </div>
      ))}
    </div>

    {/* Navigation */}
    <div className="flex justify-between pt-6 mt-6 border-t border-neutral-200 dark:border-neutral-700">
      <BackButton onClick={onBack} />
      <button
        disabled={requirements.some((r) => !uploadedFiles[r.id])}
        onClick={onNext}
        className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next &rarr;
      </button>
    </div>
  </div>
);

export default RequirementsUpload;
