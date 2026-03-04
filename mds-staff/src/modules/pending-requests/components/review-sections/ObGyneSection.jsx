import React from 'react';
import SectionWrapper, { DataRow } from './SectionWrapper';

/**
 * ObGyneSection
 *
 * Displays OB-GYNE history (female patients only).
 */
const ObGyneSection = ({
  obgynHistory,
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

  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <SectionWrapper
      title="OB-GYNE History"
      scopeLabel="Medical"
      isLocked={isLocked}
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      }
      isEditing={isEditing}
      onToggleEdit={onToggleEdit}
      editReason={editReason}
      onEditReasonChange={onEditReasonChange}
      hasEdits={hasEdits}
      isPending={isPending}
    >
      {obgynHistory ? (
        <dl className="space-y-0">
          <DataRow
            label="Last Menstrual Period"
            value={formatDate(obgynHistory.lastMenstrualPeriod)}
          />
          <DataRow
            label="Dysmenorrhea"
            value={obgynHistory.hasDysmenorrhea ? 'Yes' : 'No'}
          />
          {obgynHistory.notes && (
            <DataRow label="Notes" value={obgynHistory.notes} />
          )}
        </dl>
      ) : (
        <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">
          No OB-GYNE history available
        </p>
      )}
    </SectionWrapper>
  );
};

export default ObGyneSection;
