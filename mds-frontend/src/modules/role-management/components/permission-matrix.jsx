import React, { useState } from 'react';
import { PERMISSION_MODULES } from '../role-permissions';

/**
 * Permission Matrix Component
 * Renders collapsible module sections with action-level checkboxes
 * Used in both Role Template editing and per-Staff permissions
 */
const PermissionMatrix = ({ permissions, onChange, readOnly = false }) => {
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (modId) => {
    setExpanded((prev) => ({ ...prev, [modId]: !prev[modId] }));
  };

  const handleToggle = (moduleId, actionId) => {
    if (readOnly) return;
    const updated = { ...permissions };
    updated[moduleId] = { ...updated[moduleId], [actionId]: !updated[moduleId]?.[actionId] };
    onChange(updated);
  };

  const handleToggleModule = (moduleId) => {
    if (readOnly) return;
    const mod = PERMISSION_MODULES.find((m) => m.id === moduleId);
    if (!mod) return;
    const allChecked = mod.actions.every((a) => permissions[moduleId]?.[a.id]);
    const updated = { ...permissions };
    updated[moduleId] = {};
    mod.actions.forEach((a) => { updated[moduleId][a.id] = !allChecked; });
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

  const getEnabledCount = (mod) => {
    const count = mod.actions.filter((a) => permissions[mod.id]?.[a.id]).length;
    return count;
  };

  return (
    <div className="space-y-2">
      {PERMISSION_MODULES.map((mod) => {
        const isExpanded = expanded[mod.id] ?? false;
        const enabledCount = getEnabledCount(mod);
        const allChecked = enabledCount === mod.actions.length;
        const someChecked = enabledCount > 0 && !allChecked;

        return (
          <div key={mod.id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            {/* Module Header */}
            <div
              className="flex items-center gap-3 px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 cursor-pointer select-none hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              onClick={() => toggleExpand(mod.id)}
            >
              {/* Module toggle */}
              {!readOnly && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleModule(mod.id); }}
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    allChecked
                      ? 'bg-primary-500 border-primary-500'
                      : someChecked
                        ? 'bg-primary-200 dark:bg-primary-800 border-primary-400'
                        : 'border-neutral-300 dark:border-neutral-600'
                  }`}
                >
                  {(allChecked || someChecked) && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {allChecked
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14" />
                      }
                    </svg>
                  )}
                </button>
              )}

              <span className="text-secondary-500 dark:text-neutral-400">{getModuleIcon(mod.icon)}</span>
              <span className="text-sm font-medium text-secondary-800 dark:text-white flex-1">{mod.label}</span>
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                enabledCount === 0
                  ? 'text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800'
                  : allChecked
                    ? 'text-success-700 dark:text-success-400 bg-success-100 dark:bg-success-900/30'
                    : 'text-warning-700 dark:text-warning-400 bg-warning-100 dark:bg-warning-900/30'
              }`}>
                {enabledCount}/{mod.actions.length}
              </span>
              <svg className={`w-4 h-4 text-neutral-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Action Checkboxes */}
            {isExpanded && (
              <div className="px-3 py-2 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800">
                <div className="space-y-1.5">
                  {mod.actions.map((action) => {
                    const checked = !!permissions[mod.id]?.[action.id];
                    return (
                      <label
                        key={action.id}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors ${
                          readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggle(mod.id, action.id)}
                          disabled={readOnly}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          checked
                            ? 'bg-primary-500 border-primary-500'
                            : 'border-neutral-300 dark:border-neutral-600'
                        } ${readOnly ? 'opacity-60' : ''}`}>
                          {checked && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm ${checked ? 'text-secondary-800 dark:text-white' : 'text-secondary-500 dark:text-neutral-400'}`}>
                          {action.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PermissionMatrix;
