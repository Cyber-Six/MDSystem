import React, { useState } from 'react';
import {
  PERMISSION_MODULES, MODULE_PERMISSION_MAP, PERMISSION_KEY_LABELS,
  getModuleState, setModuleKeys,
} from '../role-permissions';

/**
 * Permission Matrix Component
 * - Module-level toggle switches
 * - Expandable granular permission keys under each module
 * - Module OFF → all keys OFF (section disabled)
 * - Module ON → keys individually toggleable
 */
const PermissionMatrix = ({ permissions, onChange, readOnly = false }) => {
  const [expandedModules, setExpandedModules] = useState({});

  const handleToggleModule = (moduleId) => {
    if (readOnly) return;
    const state = getModuleState(permissions, moduleId);
    // OFF or partial → turn all ON; fully ON → turn all OFF
    onChange(setModuleKeys(permissions, moduleId, state !== 'on'));
  };

  const handleToggleKey = (key) => {
    if (readOnly) return;
    onChange({ ...permissions, [key]: !permissions[key] });
  };

  const handleToggleExpand = (moduleId) => {
    setExpandedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const getModuleIcon = (iconId) => {
    const icons = {
      calendar: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
      pending: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
      medical: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
      dental: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
      search: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
      inventory: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
      chat: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
      chart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
      settings: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>,
    };
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {icons[iconId] || icons.settings}
      </svg>
    );
  };

  const enabledModuleCount = PERMISSION_MODULES.filter(
    (mod) => getModuleState(permissions, mod.id) !== 'off'
  ).length;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mb-2">
        {enabledModuleCount} of {PERMISSION_MODULES.length} modules enabled
      </p>

      {PERMISSION_MODULES.map((mod) => {
        const keys = MODULE_PERMISSION_MAP[mod.id] || [];
        const state = getModuleState(permissions, mod.id);
        const isEnabled = state !== 'off';
        const isPartial = state === 'partial';
        const isExpanded = !!expandedModules[mod.id];
        const enabledKeyCount = keys.filter((k) => !!permissions[k]).length;

        return (
          <div
            key={mod.id}
            className={`rounded-lg border transition-colors ${
              isEnabled
                ? isPartial
                  ? 'border-warning-200 dark:border-warning-800/50 bg-warning-50/30 dark:bg-warning-900/10'
                  : 'border-primary-200 dark:border-primary-800/50 bg-primary-50/50 dark:bg-primary-900/10'
                : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/30'
            }`}
          >
            {/* Module Header Row */}
            <div className="flex items-center gap-3 px-3 py-2.5">
              {/* Icon */}
              <span className={`flex-shrink-0 ${isEnabled ? (isPartial ? 'text-warning-500 dark:text-warning-400' : 'text-primary-500 dark:text-primary-400') : 'text-neutral-400 dark:text-neutral-500'}`}>
                {getModuleIcon(mod.icon)}
              </span>

              {/* Label + Description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-medium ${isEnabled ? 'text-secondary-800 dark:text-white' : 'text-secondary-500 dark:text-neutral-400'}`}>
                    {mod.label}
                  </span>
                  {isPartial && (
                    <span className="text-[9px] px-1 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 rounded font-medium">
                      {enabledKeyCount}/{keys.length}
                    </span>
                  )}
                </div>
                {mod.description && (
                  <span className="text-[10px] text-secondary-400 dark:text-neutral-500 block truncate">
                    {mod.description}
                  </span>
                )}
              </div>

              {/* Expand/Collapse Button */}
              {keys.length > 0 && (
                <button
                  onClick={() => handleToggleExpand(mod.id)}
                  className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex-shrink-0"
                  title={isExpanded ? 'Collapse permissions' : 'Expand permissions'}
                >
                  <svg className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}

              {/* Module Toggle */}
              {readOnly ? (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  isEnabled
                    ? isPartial
                      ? 'text-warning-700 dark:text-warning-400 bg-warning-100 dark:bg-warning-900/30'
                      : 'text-success-700 dark:text-success-400 bg-success-100 dark:bg-success-900/30'
                    : 'text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800'
                }`}>
                  {isEnabled ? (isPartial ? 'Partial' : 'On') : 'Off'}
                </span>
              ) : (
                <button
                  onClick={() => handleToggleModule(mod.id)}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                    isEnabled
                      ? isPartial ? 'bg-warning-400' : 'bg-primary-500'
                      : 'bg-neutral-300 dark:bg-neutral-600'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                    isEnabled ? 'left-[18px]' : 'left-0.5'
                  }`} />
                </button>
              )}
            </div>

            {/* Expanded Granular Keys */}
            {isExpanded && keys.length > 0 && (
              <div className="border-t border-neutral-200/60 dark:border-neutral-700/60 px-3 py-2 space-y-0.5">
                <p className="text-[9px] text-secondary-400 dark:text-neutral-500 mb-1 pl-7">
                  {enabledKeyCount} of {keys.length} permissions enabled
                </p>
                {keys.map((key) => {
                  const keyEnabled = !!permissions[key];
                  const keyLabel = PERMISSION_KEY_LABELS[key] || key;
                  const isKeyDisabled = readOnly || !isEnabled;

                  return (
                    <div key={key} className="flex items-center justify-between py-1 pl-7 pr-0.5">
                      <div className="min-w-0 flex-1">
                        <span className={`text-xs ${keyEnabled ? 'text-secondary-700 dark:text-neutral-300' : 'text-secondary-400 dark:text-neutral-500'}`}>
                          {keyLabel}
                        </span>
                        <span className="text-[9px] text-secondary-300 dark:text-neutral-600 ml-1.5 hidden sm:inline">
                          {key}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={keyEnabled}
                        onChange={() => !isKeyDisabled && handleToggleKey(key)}
                        disabled={isKeyDisabled}
                        className={`w-3.5 h-3.5 rounded border-neutral-300 dark:border-neutral-600 text-primary-500 focus:ring-primary-500 flex-shrink-0 ${isKeyDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PermissionMatrix;
