import React from 'react';
import SectionWrapper, { DataRow, EditableField, ReviewGroup } from './SectionWrapper';

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
  isLocked = false,
}) => {
  const hasEdits = Object.keys(editedFields).length > 0;

  const getVal = (key, fallback) =>
    editedFields[key] !== undefined ? editedFields[key] : fallback;

  const getOriginal = (key, current) =>
    editedFields[key] !== undefined ? current : undefined;

  const first = emergencyContact?.firstContact;
  const second = emergencyContact?.secondContact;

  const renderContact = (contact, index, prefix) => {
    if (!contact) return null;

    return (
      <ReviewGroup title={`Contact ${index}`} data-review-contact={index === 1 ? 'firstContact' : 'secondContact'}>
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
            onChange={(v) => onFieldChange?.(`${prefix}.contactNumber`, v)}
          />
          {contact.isVerified !== null && contact.isVerified !== undefined && (
            <DataRow label="Verified" value={contact.isVerified ? 'Yes' : 'No'} />
          )}
          <DataRow label="Address" value={contact.address} />
        </dl>
      </ReviewGroup>
    );
  };

  return (
    <SectionWrapper
      title="Emergency Contacts"
      isLocked={isLocked}
      isEditing={isEditing}
      onToggleEdit={onToggleEdit}
      hasEdits={hasEdits}
      isPending={isPending}
    >
      {renderContact(first, 1, 'first')}
      {renderContact(second, 2, 'second')}
    </SectionWrapper>
  );
};

export default EmergencyContactSection;
