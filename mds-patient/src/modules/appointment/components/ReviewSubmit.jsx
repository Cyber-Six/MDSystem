import React from 'react';
import { Spinner, BackButton } from './shared';
import { SESSION } from '../patient-appointment-service';

const ReviewSubmit = ({ scheduler, selectedDate, selectedSession, requirements, uploadedFiles, submitting, onSubmit, onBack }) => (
  <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
    <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-6">Review &amp; Submit</h2>
    <div className="space-y-3 mb-6">
      <div className="flex justify-between text-sm">
        <span className="text-neutral-500 dark:text-neutral-400">Appointment Type</span>
        <span className="font-medium text-neutral-900 dark:text-white">{scheduler?.label}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-neutral-500 dark:text-neutral-400">Location</span>
        <span className="font-medium text-neutral-900 dark:text-white">{scheduler?.location}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-neutral-500 dark:text-neutral-400">Date</span>
        <span className="font-medium text-neutral-900 dark:text-white">{selectedDate}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-neutral-500 dark:text-neutral-400">Session</span>
        <span className="font-medium text-neutral-900 dark:text-white">
          {selectedSession === SESSION.MORNING ? 'Morning (8:00 AM — 12:00 PM)' : 'Afternoon (1:00 PM — 5:00 PM)'}
        </span>
      </div>
      {requirements.length > 0 && (
        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">Documents</p>
          <ul className="space-y-1">
            {requirements.map((r) => (
              <li key={r.id} className="text-sm text-neutral-700 dark:text-neutral-300 flex items-center space-x-2">
                <span className="text-green-500">✓</span>
                <span>{r.label}: {uploadedFiles[r.id]?.fileName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>

    {/* Navigation */}
    <div className="flex justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
      <BackButton onClick={onBack} />
      <button
        onClick={onSubmit}
        disabled={submitting}
        className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
      >
        {submitting && <Spinner />}
        <span>{submitting ? 'Submitting...' : 'Submit Appointment'}</span>
      </button>
    </div>
  </div>
);

export default ReviewSubmit;
