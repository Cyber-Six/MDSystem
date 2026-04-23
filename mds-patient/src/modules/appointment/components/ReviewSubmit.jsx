import React from 'react';
import { Spinner, BackButton } from './shared';
import { SESSION } from '../patient-appointment-service';

const ReviewSubmit = ({ scheduler, selectedDate, selectedSession, requirements, uploadedFiles, purpose, onPurposeChange, showPurposeError, submitting, onSubmit, onBack }) => {
  const purposeRequired = true;
  const purposeMissing = !(purpose || '').trim();
  return (
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
          {selectedSession === SESSION.MORNING ? 'Morning (7:30 AM — 11:30 AM)' : 'Afternoon (1:00 PM — 4:00 PM)'}
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

    {/* Purpose / Reason for Visit */}
    <div className="mb-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
        Purpose / Reason for Visit
        <span className="text-red-500 ml-0.5">*</span>
        {' '}<span className="text-neutral-400 text-xs">(Required · {(purpose || '').length}/250)</span>
      </label>
      <textarea
        maxLength={250}
        rows={3}
        required
        value={purpose || ''}
        onChange={(e) => onPurposeChange(e.target.value.slice(0, 250))}
        placeholder="Briefly describe the reason for your appointment (Required)"
        className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none ${
          showPurposeError && purposeMissing
            ? 'border-red-400 dark:border-red-600'
            : 'border-neutral-300 dark:border-neutral-600'
        }`}
      />
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
};

export default ReviewSubmit;
