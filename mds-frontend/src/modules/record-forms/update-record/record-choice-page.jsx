import React from 'react';

const RecordChoicePage = ({ onSelect }) => {
  const choices = [
    {
      id: 'medical',
      title: 'Medical Update',
      description: 'Update your medical history and health information',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'blue'
    },
    {
      id: 'dental',
      title: 'Dental Update',
      description: 'Update your dental history and teeth records',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C6.5 6.253 2 10.998 2 17s4.5 10.747 10 10.747c5.5 0 10-4.998 10-10.747 0-3 1-5 1-6.253M12 6.253L7 3m0 0l5-3m-5 3l5 3" />
        </svg>
      ),
      color: 'green'
    },
    {
      id: 'both',
      title: 'Both Update',
      description: 'Update both medical and dental information',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'purple'
    }
  ];

  const colorStyles = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-blue-500/20',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 hover:border-green-400 dark:hover:border-green-500 hover:shadow-green-500/20',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-purple-500/20'
  };

  const iconStyles = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400'
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header Section */}
      <div className="bg-primary-500 dark:bg-neutral-900 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-12 rounded-xl bg-primary-400 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white dark:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-heading font-bold text-white dark:text-white">
              Choose Update Type
            </h1>
            <p className="text-white/90 dark:text-neutral-400 text-sm mt-1">
              Select which records you'd like to update
            </p>
          </div>
        </div>
      </div>

      {/* Choices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {choices.map((choice) => (
          <button
            key={choice.id}
            onClick={() => onSelect(choice.id)}
            className={`p-8 rounded-2xl border-2 transition-all duration-200 text-left hover:shadow-xl hover:scale-105 ${colorStyles[choice.color]}`}
          >
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-6 bg-white dark:bg-neutral-800 ${iconStyles[choice.color]}`}>
              {choice.icon}
            </div>
            <h3 className="font-heading font-bold text-xl text-gray-900 dark:text-white mb-2">
              {choice.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              {choice.description}
            </p>
          </button>
        ))}
      </div>

      {/* Info Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-700">
        <div className="flex gap-4">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Why separate updates?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This helps us organize your information better and ensures that your medical and dental records are kept properly and securely. You can always update the other record type later.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordChoicePage;
