import React from 'react';
import { PERMISSION_MODULES } from '../role-permissions';

/**
 * Permission Matrix Component
 * Renders module-level toggle switches (simplified — no per-action granularity)
 * Used in both Role Template editing and per-Staff permissions
 */
const PermissionMatrix = ({ permissions, onChange, readOnly = false }) => {

  const handleToggleModule = (moduleId) => {
    if (readOnly) return;
    const updated = { ...permissions, [moduleId]: !permissions[moduleId] };
    onChange(updated);
  };

  const getModuleIcon = (iconId) => {
    const icons = {
      calendar: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
      pending: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
      medical: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
      dental: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
      search: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
      inventory: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
      settings: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>,
    };
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {icons[iconId] || icons.settings}
      </svg>
    );
  };

  const enabledCount = PERMISSION_MODULES.filter((mod) => permissions[mod.id]).length;

  return (
    <div className="space-y-1.5">
      {/* Summary */}
      <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mb-2">
        {enabledCount} of {PERMISSION_MODULES.length} modules enabled
      </p>

      {PERMISSION_MODULES.map((mod) => {
        const isEnabled = !!permissions[mod.id];

        return (
          <div
            key={mod.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
              isEnabled
                ? 'border-primary-200 dark:border-primary-800/50 bg-primary-50/50 dark:bg-primary-900/10'
                : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/30'
            }`}
          >
            {/* Icon */}
            <span className={`flex-shrink-0 ${isEnabled ? 'text-primary-500 dark:text-primary-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
              {getModuleIcon(mod.icon)}
            </span>

            {/* Label + Description */}
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-medium block ${isEnabled ? 'text-secondary-800 dark:text-white' : 'text-secondary-500 dark:text-neutral-400'}`}>
                {mod.label}
              </span>
              {mod.description && (
                <span className="text-[10px] text-secondary-400 dark:text-neutral-500 block truncate">
                  {mod.description}
                </span>
              )}
            </div>

            {/* Toggle Switch */}
            {readOnly ? (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                isEnabled
                  ? 'text-success-700 dark:text-success-400 bg-success-100 dark:bg-success-900/30'
                  : 'text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800'
              }`}>
                {isEnabled ? 'On' : 'Off'}
              </span>
            ) : (
              <button
                onClick={() => handleToggleModule(mod.id)}
                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                  isEnabled ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                  isEnabled ? 'left-[18px]' : 'left-0.5'
                }`} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PermissionMatrix;
