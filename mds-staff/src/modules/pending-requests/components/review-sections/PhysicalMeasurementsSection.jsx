import React from 'react';
import SectionWrapper, { DataRow, EditableField } from './SectionWrapper';

/**
 * PhysicalMeasurementsSection
 *
 * Extracted from MedicalBackground: Height, Weight, BP, Heart Rate, Temperature
 */
const PhysicalMeasurementsSection = ({
  vitalSigns,
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
      title="Physical Measurements"
      scopeLabel="Medical"
      isLocked={isLocked}
      isEditing={isEditing}
      onToggleEdit={onToggleEdit}
      hasEdits={hasEdits}
      isPending={isPending}
    >
      {vitalSigns || isEditing || hasEdits ? (
        <dl className="space-y-0">
          <EditableField
            label="Height (cm)"
            value={getVal('height_cm', String(vitalSigns?.height_cm ?? ''))}
            originalValue={getOriginal('height_cm', String(vitalSigns?.height_cm ?? ''))}
            isEditing={isEditing}
            onChange={(v) => onFieldChange?.('height_cm', v)}
            type="number"
          />
          <EditableField
            label="Weight (kg)"
            value={getVal('weight_kg', String(vitalSigns?.weight_kg ?? ''))}
            originalValue={getOriginal('weight_kg', String(vitalSigns?.weight_kg ?? ''))}
            isEditing={isEditing}
            onChange={(v) => onFieldChange?.('weight_kg', v)}
            type="number"
          />
          <EditableField
            label="Blood Pressure"
            value={getVal('blood_pressure', vitalSigns?.blood_pressure ?? '')}
            originalValue={getOriginal('blood_pressure', vitalSigns?.blood_pressure ?? '')}
            isEditing={isEditing}
            onChange={(v) => onFieldChange?.('blood_pressure', v)}
            placeholder="e.g. 120/80"
          />
          <EditableField
            label="Heart Rate (bpm)"
            value={getVal('heart_rate', String(vitalSigns?.heart_rate ?? ''))}
            originalValue={getOriginal('heart_rate', String(vitalSigns?.heart_rate ?? ''))}
            isEditing={isEditing}
            onChange={(v) => onFieldChange?.('heart_rate', v)}
            type="number"
          />
          <EditableField
            label="Temperature (°C)"
            value={getVal('temperature', String(vitalSigns?.temperature ?? ''))}
            originalValue={getOriginal('temperature', String(vitalSigns?.temperature ?? ''))}
            isEditing={isEditing}
            onChange={(v) => onFieldChange?.('temperature', v)}
            type="number"
          />
        </dl>
      ) : (
        <p className="text-sm text-secondary-500 dark:text-neutral-400 italic">No physical measurements</p>
      )}
    </SectionWrapper>
  );
};

export default PhysicalMeasurementsSection;
