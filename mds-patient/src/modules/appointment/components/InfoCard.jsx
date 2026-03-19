import React from 'react';

const InfoCard = () => (
  <div className="mt-8 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-6">
    <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100 mb-4" style={{ margin: 0 }}>Important Information</h3>
    <ul className="space-y-3 text-sm text-primary-700 dark:text-primary-300">
      {[
        'Appointments are subject to availability and confirmation',
        'You will receive a confirmation once your appointment is approved',
        'Please arrive 10 minutes before your scheduled time',
        'Bring your student ID and any relevant medical documents',
      ].map((text, i) => (
        <li key={i} className="flex items-start space-x-2">
          <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default InfoCard;
