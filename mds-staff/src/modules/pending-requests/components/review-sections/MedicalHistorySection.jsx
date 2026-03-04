import React from 'react';
import SectionWrapper, { DataRow } from './SectionWrapper';

/**
 * MedicalHistorySection
 *
 * Displays patient's medical conditions (self-reported and family-reported)
 * from the MedicalHistory profile data.
 */
const MedicalHistorySection = ({
  medicalHistory,
  isEditing = false,
  editedFields = {},
  onFieldChange,
  editReason = '',
  onEditReasonChange,
  onToggleEdit,
  isPending = false,
  isLocked = false,
}) => {
  const hasEdits = Object.keys(editedFields).length > 0;

  const conditions = medicalHistory?.conditions ?? [];
  const selfConditions = conditions.filter((c) => !c.relationship);
  const familyConditions = conditions.filter((c) => c.relationship);

  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <SectionWrapper
      title="Medical History"
      scopeLabel="Medical"
      isLocked={isLocked}
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      }
      isEditing={isEditing}
      onToggleEdit={onToggleEdit}
      editReason={editReason}
      onEditReasonChange={onEditReasonChange}
      hasEdits={hasEdits}
      isPending={isPending}
    >
      {/* Self-reported conditions */}
      <div>
        <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Personal Conditions
        </h4>
        {selfConditions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selfConditions.map((cond, i) => (
              <span
                key={cond.id ?? i}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-error-100 dark:bg-error-900/20 text-error-800 dark:text-error-400 font-medium"
              >
                {cond.description || `Condition #${cond.conditionId}`}
                {cond.diagnosedDate && (
                  <span className="ml-1 text-xs text-error-500 dark:text-error-500">
                    ({formatDate(cond.diagnosedDate)})
                  </span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">
            No personal conditions reported
          </p>
        )}
      </div>

      {/* Family conditions */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Family History
        </h4>
        {familyConditions.length > 0 ? (
          <dl className="space-y-0">
            {familyConditions.map((cond, i) => (
              <DataRow
                key={cond.id ?? i}
                label={cond.description || `Condition #${cond.conditionId}`}
                value={cond.relationship}
              />
            ))}
          </dl>
        ) : (
          <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">
            No family conditions reported
          </p>
        )}
      </div>

      {/* Notes */}
      {medicalHistory?.notes && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            Notes
          </h4>
          <p className="text-sm text-secondary-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800/30 p-2 rounded">
            {medicalHistory.notes}
          </p>
        </div>
      )}
    </SectionWrapper>
  );
};

export default MedicalHistorySection;
