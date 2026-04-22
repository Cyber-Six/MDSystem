import React from 'react';

const RecordChoiceInfoSection = () => {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-700">
      <div className="flex gap-4">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Record Form Guidance</h3>

          <div className="space-y-5">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Guidelines</h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc pl-5">
                <li>Complete your record forms before proceeding to MDS (Medical and Dental Services).</li>
                <li>Provide complete and accurate information to avoid delays in assessment and appointment processing.</li>
                <li>Review all entries before submitting, especially personal details, medical history, and emergency information.</li>
                <li>Bring your ID and any required supporting documents during enrollment, validation, or clinic visits.</li>
                <li>Update your records whenever there are changes to your health status or relevant personal information.</li>
              </ul>
            </div>

            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">When to Use Each Record Update</h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc pl-5">
                <li><span className="font-semibold text-gray-800 dark:text-gray-200">Both Medical and Dental:</span> Use during every semestral enrollment and student ID validation.</li>
                <li><span className="font-semibold text-gray-800 dark:text-gray-200">Medical Only:</span> Use for medical appointments and checkups (e.g. OJT, sports events, outside activities, and other concerns.)</li>
                <li><span className="font-semibold text-gray-800 dark:text-gray-200">Dental Only:</span> Use for dental appointments, routine dental checkups, and other dental concerns.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordChoiceInfoSection;
