import React from 'react';

const SchedulerPicker = ({ schedulers, onSelect }) => (
  <div className="bg-stone-50 dark:bg-neutral-900 rounded-xl shadow-sm border border-stone-200 dark:border-neutral-700 p-6">
    <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-6" style={{ margin: 0 }}>Select Appointment Type</h2>
    {schedulers.length === 0 ? (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-stone-100 dark:bg-neutral-800 flex items-center justify-center">
          <svg className="w-8 h-8 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-secondary-500 dark:text-neutral-400">No appointment types are currently available.</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schedulers.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className="text-left p-5 border border-stone-200 dark:border-neutral-700 rounded-xl shadow-md bg-white dark:bg-neutral-800 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-lg transition-all group"
          >
            <h3 className="font-semibold text-neutral-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 mb-1">
              {s.label}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">{s.location}</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {s.schedulePerWeek?.map((day) => (
                <span key={day} className="px-2 py-0.5 text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded">
                  {day.slice(0, 3)}
                </span>
              ))}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              <span>AM: {s.morningAllowed} slots</span>
              <span className="mx-2">|</span>
              <span>PM: {s.afternoonAllowed} slots</span>
            </div>
            {s.notes && <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 italic">{s.notes}</p>}
          </button>
        ))}
      </div>
    )}
  </div>
);

export default SchedulerPicker;
