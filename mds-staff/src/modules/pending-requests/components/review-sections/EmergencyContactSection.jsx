import React from 'react';
import SectionWrapper, { DataRow, EditableField } from './SectionWrapper';

/**
 * EmergencyContactSection
 *
 * Displays the patient's two emergency contacts (from EmergencyContact profile).
 */
const EmergencyContactSection = ({
  emergencyContact,
  isEditing = false,
  editedFields = {},
  onFieldChange,
  onToggleEdit,
  isPending = false,
}) => {
  const hasEdits = Object.keys(editedFields).length > 0;

  const getVal = (key, fallback) =>
    editedFields[key] !== undefined ? editedFields[key] : fallback;

  const getOriginal = (key, current) =>
    editedFields[key] !== undefined ? current : undefined;

  const first = emergencyContact?.firstContact;
  const second = emergencyContact?.secondContact;

  const renderContact = (contact, index, prefix) => {
    if (!contact) {
      return (
        <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">
          Contact {index} not provided
        </p>
      );
    }

    return (
      <div className="mb-3 pb-3 border-b border-neutral-100 dark:border-neutral-700/50 last:border-0 last:mb-0 last:pb-0">
        <h5 className="text-xs font-semibold text-secondary-700 dark:text-neutral-300 mb-2">
          Contact {index}
        </h5>
        <dl className="space-y-0">
          <EditableField
            label="Name"
            value={getVal(`${prefix}.contactName`, contact.contactName)}
            originalValue={getOriginal(`${prefix}.contactName`, contact.contactName)}
            isEditing={isEditing}
            onChange={(v) => onFieldChange?.(`${prefix}.contactName`, v)}
          />
          <EditableField
            label="Relationship"
            value={getVal(`${prefix}.relationship`, contact.relationship)}
            originalValue={getOriginal(`${prefix}.relationship`, contact.relationship)}
            isEditing={isEditing}
            onChange={(v) => onFieldChange?.(`${prefix}.relationship`, v)}
          />
          <EditableField
            label="Contact Number"
            value={getVal(`${prefix}.contactNumber`, contact.contactNumber)}
            originalValue={getOriginal(`${prefix}.contactNumber`, contact.contactNumber)}
            isEditing={isEditing}
            type="tel"
            onChange={(v) => {
              const sanitized = v === undefined || v === null ? v : String(v).replace(/\D/g, '').slice(0, 12);
              onFieldChange?.(`${prefix}.contactNumber`, sanitized);
            }}
          />
          {contact.isVerified !== null && contact.isVerified !== undefined && (
            <DataRow label="Verified" value={contact.isVerified ? 'Yes' : 'No'} />
          )}
        </dl>
      </div>
    );
  };

  return (
    <SectionWrapper
      title="Emergency Contacts"
      scopeLabel="Medical"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      }
      isEditing={isEditing}
      onToggleEdit={onToggleEdit}
      hasEdits={hasEdits}
      isPending={isPending}
    >
      {!first && !second ? (
        <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">
          No emergency contacts on record
        </p>
      ) : (
        <>
          {renderContact(first, 1, 'first')}
          {renderContact(second, 2, 'second')}
        </>
      )}
    </SectionWrapper>
  );
};

export default EmergencyContactSection;
