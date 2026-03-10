import React from 'react';
import SectionWrapper, { EditableField } from './SectionWrapper';

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
  onToggleEdit,
  isPending = false,
  isLocked = false,
}) => {
  const hasEdits = Object.keys(editedFields).length > 0;

  const getVal = (key, fallback) =>
    editedFields[key] !== undefined ? editedFields[key] : fallback;

  const getOriginal = (key, current) =>
    editedFields[key] !== undefined ? current : undefined;

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
      hasEdits={hasEdits}
      isPending={isPending}
    >
      {obgynHistory ? (
        <dl className="space-y-0">
          <EditableField
            label="Last Menstrual Period"
            value={getVal('lastMenstrualPeriod', obgynHistory.lastMenstrualPeriod ? String(obgynHistory.lastMenstrualPeriod).split('T')[0] : '')}
            originalValue={getOriginal('lastMenstrualPeriod', obgynHistory.lastMenstrualPeriod ? String(obgynHistory.lastMenstrualPeriod).split('T')[0] : '')}
            isEditing={isEditing}
            onChange={(v) => onFieldChange?.('lastMenstrualPeriod', v)}
            type="date"
          />
          <EditableField
            label="Dysmenorrhea"
            value={getVal('hasDysmenorrhea', obgynHistory.hasDysmenorrhea ? 'Yes' : 'No')}
            originalValue={getOriginal('hasDysmenorrhea', obgynHistory.hasDysmenorrhea ? 'Yes' : 'No')}
            isEditing={isEditing}
            onChange={(v) => onFieldChange?.('hasDysmenorrhea', v)}
            type="select"
            options={['Yes', 'No']}
          />
          <EditableField
            label="Notes"
            value={getVal('notes', obgynHistory.notes ?? '')}
            originalValue={getOriginal('notes', obgynHistory.notes ?? '')}
            isEditing={isEditing}
            onChange={(v) => onFieldChange?.('notes', v)}
            type="textarea"
          />
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
