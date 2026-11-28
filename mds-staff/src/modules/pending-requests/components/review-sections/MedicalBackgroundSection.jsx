import React from 'react';
import SectionWrapper, { DataRow, EditableField, formatReviewDate, hasReviewValue, ReviewChip, ReviewGroup, ReviewNote } from './SectionWrapper';

const NoEntries = ({ children }) => (
  <p className="m-0 text-sm text-secondary-600 dark:text-neutral-300">{children}</p>
);

const groupedNotes = (items, sharedNote, getName) => {
  const groups = new Map();
  const keyOf = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';
  const sharedKey = keyOf(sharedNote);
  items.forEach((item) => {
    const key = keyOf(item.notes);
    if (!key || key === sharedKey) return;
    const group = groups.get(key) || { value: item.notes, names: [] };
    group.names.push(getName(item));
    groups.set(key, group);
  });
  return [...groups.values()];
};

const visualDetailsFromNotes = (notes) => {
  const prefix = 'VA_META::';
  if (typeof notes !== 'string' || !notes.startsWith(prefix)) return null;
  try {
    const details = JSON.parse(notes.slice(prefix.length));
    return details?.version === 2 ? details : null;
  } catch {
    return null;
  }
};

/**
 * MedicalBackgroundSection
 *
 * Displays sub-sections for: Allergies, Immunizations, Hospitalizations,
 * Operations/Surgeries, Medications, Lifestyle, Visual Acuity, Vital Signs.
 */
const MedicalBackgroundSection = ({
  allergyProfile,
  immunizationProfile,
  hospitalizationProfile,
  operationProfile,
  medicationProfile,
  lifestyle,
  visualAcuityProfile,
  vitalSigns,
  catalogs = {},
  isEditing = false,
  editedFields = {},
  onFieldChange,
  onToggleEdit,
  isPending = false,
  isLocked = false,
}) => {
  const hasEdits = Object.keys(editedFields).length > 0;

  const lifestyleKeys = ['smoker', 'cigarettesPerDay', 'yearsSmoked', 'alcoholConsumer', 'alcoholFrequency', 'vaper', 'vapeType', 'vapeFrequency', 'lifestyleNotes'];
  const hasLifestyleEdits = lifestyleKeys.some((key) => editedFields[key] !== undefined);
  const acuityKeys = ['acuityLeft', 'acuityRight', 'acuityNotes'];
  const hasAcuityEdits = acuityKeys.some((key) => editedFields[key] !== undefined);
  const vitalKeys = ['height_cm', 'weight_kg', 'blood_pressure', 'heart_rate', 'temperature'];
  const hasVitalEdits = vitalKeys.some((key) => editedFields[key] !== undefined);

  const getVal = (key, fallback) =>
    editedFields[key] !== undefined ? editedFields[key] : fallback;

  const getOriginal = (key, current) =>
    editedFields[key] !== undefined ? current : undefined;

  const showVapingDetails = !isEditing || getVal('vaper', lifestyle?.vapeUser ? 'Yes' : 'No') === 'Yes';
  const yesNo = (value) => value == null ? '' : value ? 'Yes' : 'No';
  const smokerDisplay = `${yesNo(lifestyle?.smoker)}${lifestyle?.smoker && [lifestyle.numberOfCigarettesPerDay && `${lifestyle.numberOfCigarettesPerDay} sticks/day`, lifestyle.yearsSmoked && `${lifestyle.yearsSmoked} years`].filter(Boolean).length ? ` (${[lifestyle.numberOfCigarettesPerDay && `${lifestyle.numberOfCigarettesPerDay} sticks/day`, lifestyle.yearsSmoked && `${lifestyle.yearsSmoked} years`].filter(Boolean).join(', ')})` : ''}`;
  const alcoholDisplay = `${yesNo(lifestyle?.alcoholConsumer)}${lifestyle?.alcoholConsumer && lifestyle.frequencyOfAlcoholConsumption ? ` (${lifestyle.frequencyOfAlcoholConsumption})` : ''}`;
  const vaperDisplay = `${yesNo(lifestyle?.vapeUser)}${lifestyle?.vapeUser && [lifestyle.vapeType, lifestyle.vapeFrequency].filter(Boolean).length ? ` (${[lifestyle.vapeType, lifestyle.vapeFrequency].filter(Boolean).join(', ')})` : ''}`;

  const getCatalogName = (catalog, id, nameField = 'name') => {
    if (!catalog?.length || id === undefined || id === null) return null;
    const item = catalog.find((c) => String(c.id) === String(id));
    return item?.[nameField] ?? null;
  };

  const immunizations = immunizationProfile?.immunizations ?? [];
  const allergies = allergyProfile?.allergies ?? [];
  const hospitalizations = hospitalizationProfile?.hospitalizations ?? [];
  const operations = operationProfile?.operations ?? [];
  const medications = medicationProfile?.medications ?? [];
  const allergyNotes = groupedNotes(allergies, allergyProfile?.notes, item => catalogs.allergenCatalog?.find(entry => String(entry.id) === String(item.allergenCatalogId))?.allergen || 'Unresolved choice');
  const hospitalizationNotes = groupedNotes(hospitalizations, hospitalizationProfile?.notes, item => getCatalogName(catalogs.hospitalizationCatalog, item.conditionId) || 'Unresolved choice');
  const operationNotes = groupedNotes(operations, operationProfile?.notes, item => getCatalogName(catalogs.operationCatalog, item.procedureId) || 'Unresolved choice');
  const medicationReasons = groupedNotes(medications.map(item => ({ ...item, notes: item.description })), null, item => getCatalogName(catalogs.medicationCatalog, item.medicineId) || 'Unresolved choice');

  const showLifestyle = [lifestyle?.smoker, lifestyle?.alcoholConsumer, lifestyle?.vapeUser, lifestyle?.notes,
    lifestyle?.numberOfCigarettesPerDay, lifestyle?.yearsSmoked, lifestyle?.frequencyOfAlcoholConsumption,
    lifestyle?.vapeType, lifestyle?.vapeFrequency].some(hasReviewValue);
  const acuity = visualAcuityProfile?.acuity;
  const visualDetails = visualDetailsFromNotes(acuity?.notes);
  const acuityType = getCatalogName(catalogs.visualAcuityCatalog, acuity?.acuityId);
  const showAcuity = [acuityType, acuity?.left_eye, acuity?.right_eye, acuity?.recorded_at, acuity?.notes, visualAcuityProfile?.notes].some(hasReviewValue);
  const showVitals = [...vitalKeys, 'notes', 'created_at'].some((key) => hasReviewValue(vitalSigns?.[key]));

  return (
    <SectionWrapper
      title="Medical Background"
      isLocked={isLocked}
      isEditing={isEditing}
      onToggleEdit={onToggleEdit}
      hasEdits={hasEdits}
      isPending={isPending}
    >
      <ReviewGroup title="Immunizations">
        {immunizations.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {immunizations.map((item, index) => (
              <ReviewChip key={item.id ?? index} tone="vaccine" data-review-entry={`immunizationProfile:${index}`}
                detail={[formatReviewDate(item.immunizationDate), hasReviewValue(item.doseNumber) && `Dose ${item.doseNumber}`].filter(Boolean).join(' · ')}>
                {getCatalogName(catalogs.immunizationCatalog, item.vaccineTypeId) || 'Unresolved choice'}
              </ReviewChip>
            ))}
          </div>
        ) : <NoEntries>No immunizations recorded for this ticket.</NoEntries>}
      </ReviewGroup>

      <ReviewGroup title="Allergies" className="record-review-group record-review-allergies">
        {allergies.length > 0 ? (
          <>
            <dl><DataRow label="Has Allergies" value={true} /></dl>
            <p className="mb-1 mt-2 text-sm text-secondary-900 dark:text-neutral-100">Selected Allergies</p>
            <div className="flex flex-wrap gap-2">
              {allergies.map((item, index) => {
                const allergen = catalogs.allergenCatalog?.find((entry) => String(entry.id) === String(item.allergenCatalogId));
                const details = [allergen?.type, item.severity, item.status, formatReviewDate(item.dateIdentified)]
                  .filter(hasReviewValue).join('; ');
                return (
                  <ReviewChip key={item.id ?? index} tone="condition" detail={details && `(${details})`} data-review-entry={`allergyProfile:${index}`}>
                    {allergen?.allergen || 'Unresolved choice'}
                  </ReviewChip>
                );
              })}
            </div>
          </>
        ) : <NoEntries>No allergy entries recorded for this ticket.</NoEntries>}
        <ReviewNote label="Allergy Notes" value={allergyProfile?.notes} />
        {allergyNotes.map((note, index) => <ReviewNote key={index} label={`Allergy Notes (${note.names.join(', ')})`} value={note.value} />)}
      </ReviewGroup>

      <ReviewGroup title="Hospitalizations">
        {hospitalizations.length > 0
          ? <dl><DataRow label="Hospitalization" value={true} /></dl>
          : <NoEntries>No hospitalizations recorded for this ticket.</NoEntries>}
        {hospitalizations.map((item, index) => (
          <dl key={item.id ?? index} data-review-entry={`hospitalizationProfile:${index}`}>
            <DataRow label={getCatalogName(catalogs.hospitalizationCatalog, item.conditionId) || 'Unresolved choice'}
              value={[item.admissionDate && `Admitted: ${formatReviewDate(item.admissionDate)}`,
                item.dischargeDate && `Discharged: ${formatReviewDate(item.dischargeDate)}`].filter(Boolean).join(' · ') || 'Date not specified'} />
          </dl>
        ))}
        <ReviewNote label="Hospitalization Notes" value={hospitalizationProfile?.notes} />
        {hospitalizationNotes.map((note, index) => <ReviewNote key={index} label={`Hospitalization Notes (${note.names.join(', ')})`} value={note.value} />)}
      </ReviewGroup>

      <ReviewGroup title="Surgery and Operations">
        {operations.length > 0
          ? <dl><DataRow label="Surgery/Operation" value={true} /></dl>
          : <NoEntries>No surgeries or operations recorded for this ticket.</NoEntries>}
        {operations.map((item, index) => (
          <dl key={item.id ?? index} data-review-entry={`operationProfile:${index}`}>
            <DataRow label={getCatalogName(catalogs.operationCatalog, item.procedureId) || 'Unresolved choice'}
              value={formatReviewDate(item.operationDate) || 'Date not specified'} />
          </dl>
        ))}
        <ReviewNote label="Operation Notes" value={operationProfile?.notes} />
        {operationNotes.map((note, index) => <ReviewNote key={index} label={`Operation Notes (${note.names.join(', ')})`} value={note.value} />)}
      </ReviewGroup>

      <ReviewGroup title="Medications">
        {medications.length > 0
          ? <dl><DataRow label="Maintenance Medications" value={true} /></dl>
          : <NoEntries>No medications recorded for this ticket.</NoEntries>}
        {medications.length > 0 && <>
          <p className="mb-1 mt-2 text-sm text-secondary-900 dark:text-neutral-100">Selected Medications</p>
          <div className="flex flex-wrap gap-2">
            {medications.map((item, index) => (
              <ReviewChip key={item.id ?? index} tone="medication" data-review-entry={`medicationProfile:${index}`}>
                {getCatalogName(catalogs.medicationCatalog, item.medicineId) || 'Unresolved choice'}
              </ReviewChip>
            ))}
          </div>
        </>}
        {medicationReasons.map((reason, index) => <ReviewNote key={index} label={`Medication Reason (${reason.names.join(', ')})`} value={reason.value} />)}
        <ReviewNote label="Medication Notes" value={medicationProfile?.notes} />
      </ReviewGroup>

      <ReviewGroup title="Daily Habits and Vision">
        {!(showLifestyle || showAcuity || isEditing || hasLifestyleEdits || hasAcuityEdits) && (
          <NoEntries>No daily habits or vision details recorded for this ticket.</NoEntries>
        )}
        {(showLifestyle || isEditing || hasLifestyleEdits) && (
          <dl className="space-y-0">
            <EditableField
              label="Smoker"
              value={isEditing ? getVal('smoker', yesNo(lifestyle?.smoker)) : smokerDisplay}
              originalValue={getOriginal('smoker', lifestyle?.smoker == null ? '' : lifestyle.smoker ? 'Yes' : 'No')}
              isEditing={isEditing}
              onChange={(v) => onFieldChange?.('smoker', v)}
              type="select"
              options={['Yes', 'No']}
            />
            {isEditing && getVal('smoker', yesNo(lifestyle?.smoker)) === 'Yes' && <>
              <EditableField label="Cigarettes per day" value={getVal('cigarettesPerDay', String(lifestyle?.numberOfCigarettesPerDay ?? ''))} originalValue={getOriginal('cigarettesPerDay', String(lifestyle?.numberOfCigarettesPerDay ?? ''))} isEditing onChange={v => onFieldChange?.('cigarettesPerDay', v)} type="number" />
              <EditableField label="Years smoked" value={getVal('yearsSmoked', String(lifestyle?.yearsSmoked ?? ''))} originalValue={getOriginal('yearsSmoked', String(lifestyle?.yearsSmoked ?? ''))} isEditing onChange={v => onFieldChange?.('yearsSmoked', v)} type="number" />
            </>}
            <EditableField
              label="Alcohol Drinker"
              value={isEditing ? getVal('alcoholConsumer', yesNo(lifestyle?.alcoholConsumer)) : alcoholDisplay}
              originalValue={getOriginal('alcoholConsumer', lifestyle?.alcoholConsumer == null ? '' : lifestyle.alcoholConsumer ? 'Yes' : 'No')}
              isEditing={isEditing}
              onChange={(v) => onFieldChange?.('alcoholConsumer', v)}
              type="select"
              options={['Yes', 'No']}
            />
            {isEditing && getVal('alcoholConsumer', yesNo(lifestyle?.alcoholConsumer)) === 'Yes' && <EditableField label="Alcohol frequency" value={getVal('alcoholFrequency', lifestyle?.frequencyOfAlcoholConsumption ?? '')} originalValue={getOriginal('alcoholFrequency', lifestyle?.frequencyOfAlcoholConsumption ?? '')} isEditing onChange={v => onFieldChange?.('alcoholFrequency', v)} />}
            <EditableField
              label="Vaper"
              value={isEditing ? getVal('vaper', yesNo(lifestyle?.vapeUser)) : vaperDisplay}
              originalValue={getOriginal('vaper', lifestyle?.vapeUser == null ? '' : lifestyle.vapeUser ? 'Yes' : 'No')}
              isEditing={isEditing}
              onChange={(v) => onFieldChange?.('vaper', v)}
              type="select"
              options={['Yes', 'No']}
            />
            {isEditing && getVal('vaper', yesNo(lifestyle?.vapeUser)) === 'Yes' && <>
              <EditableField label="Vape type" value={getVal('vapeType', lifestyle?.vapeType ?? '')} originalValue={getOriginal('vapeType', lifestyle?.vapeType ?? '')} isEditing onChange={v => onFieldChange?.('vapeType', v)} />
              <EditableField label="Vape frequency" value={getVal('vapeFrequency', lifestyle?.vapeFrequency ?? '')} originalValue={getOriginal('vapeFrequency', lifestyle?.vapeFrequency ?? '')} isEditing onChange={v => onFieldChange?.('vapeFrequency', v)} />
            </>}
            {showVapingDetails && <DataRow label="Years Vaping" value={lifestyle?.yearsVaping} />}
            <EditableField
              label="Lifestyle Notes"
              value={getVal('lifestyleNotes', lifestyle?.notes ?? '')}
              originalValue={getOriginal('lifestyleNotes', lifestyle?.notes ?? '')}
              isEditing={isEditing}
              onChange={(v) => onFieldChange?.('lifestyleNotes', v)}
              type="textarea"
            />
          </dl>
        )}

        {(showAcuity || isEditing || hasAcuityEdits) && (
          <dl className="space-y-0">
            {visualDetails && (
              <>
                <DataRow label="Eyeglasses" value={visualDetails.eyeglasses} />
                <DataRow label="Contact Lenses" value={visualDetails.contactLenses} />
                <DataRow label="Grade OD" value={visualDetails.grades?.eyeglasses?.od ?? visualDetails.grades?.contactLenses?.od} />
                <DataRow label="Grade OS" value={visualDetails.grades?.eyeglasses?.os ?? visualDetails.grades?.contactLenses?.os} />
              </>
            )}
            {isEditing && <DataRow label="Vision Assessment" value={acuityType} />}
            {isEditing && <EditableField
              label="Left Eye (OS)"
              value={getVal('acuityLeft', visualAcuityProfile?.acuity?.left_eye ?? '')}
              originalValue={getOriginal('acuityLeft', visualAcuityProfile?.acuity?.left_eye ?? '')}
              isEditing={isEditing}
              onChange={(v) => onFieldChange?.('acuityLeft', v)}
            />}
            {isEditing && <EditableField
              label="Right Eye (OD)"
              value={getVal('acuityRight', visualAcuityProfile?.acuity?.right_eye ?? '')}
              originalValue={getOriginal('acuityRight', visualAcuityProfile?.acuity?.right_eye ?? '')}
              isEditing={isEditing}
              onChange={(v) => onFieldChange?.('acuityRight', v)}
            />}
            {!visualDetails && <EditableField
              label="Notes"
              value={getVal('acuityNotes', visualAcuityProfile?.acuity?.notes ?? '')}
              originalValue={getOriginal('acuityNotes', visualAcuityProfile?.acuity?.notes ?? '')}
              isEditing={isEditing}
              onChange={(v) => onFieldChange?.('acuityNotes', v)}
              type="textarea"
            />}
          </dl>
        )}
        <ReviewNote label="Visual Acuity Notes" value={visualAcuityProfile?.notes} />
      </ReviewGroup>

      {/* ── Vital Signs (Height / Weight) ── */}
      {(showVitals || isEditing || hasVitalEdits) && (
        <ReviewGroup title="Physical Measurements">
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
            <DataRow label="Measurement Date" value={formatReviewDate(vitalSigns?.created_at)} />
            <DataRow label="Measurement Notes" value={vitalSigns?.notes} />
          </dl>
        </ReviewGroup>
      )}
    </SectionWrapper>
  );
};

export default MedicalBackgroundSection;
