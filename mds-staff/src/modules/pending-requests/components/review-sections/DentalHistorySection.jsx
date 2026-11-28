import React, { useState, useEffect, useRef } from 'react';
import SectionWrapper, { DataRow, EditableField, formatReviewDate, hasReviewValue, ReviewChip, ReviewNote } from './SectionWrapper';
import { axiosRequest } from '../../../../packages-core-adapter';

const DENTAL_CLEANING_CHOICES = [
  { value: '0-6', label: '0-6 months' },
  { value: '7-12', label: '7-12 months' },
  { value: '12-24', label: '12-24 months' },
  { value: '>24', label: '>24 months' },
];

/**
 * AuthenticatedImage
 * Fetches a JWT-protected image via axiosRequest and renders it from a blob URL.
 */
const AuthenticatedImage = ({ path, alt, className }) => {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const previewButtonRef = useRef(null);
  const closePreviewRef = useRef(null);

  useEffect(() => {
    if (!isExpanded) return;
    const previewButton = previewButtonRef.current;
    closePreviewRef.current?.focus({ preventScroll: true });
    return () => {
      if (previewButton?.isConnected) previewButton.focus({ preventScroll: true });
    };
  }, [isExpanded]);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    axiosRequest
      .get(path, { responseType: 'blob' })
      .then((res) => {
        if (!cancelled) {
          objectUrl = URL.createObjectURL(res.data);
          setSrc(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-32 rounded-lg bg-neutral-100 dark:bg-neutral-700/50 animate-pulse">
        <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className="flex items-center justify-center w-full h-24 rounded-lg bg-neutral-100 dark:bg-neutral-700/50 border border-dashed border-neutral-300 dark:border-neutral-600">
        <p className="text-xs text-neutral-400 dark:text-neutral-500">Photo unavailable</p>
      </div>
    );
  }

  return (
    <>
      <button
        ref={previewButtonRef}
        type="button"
        onClick={() => setIsExpanded(true)}
        className="block w-full max-w-xs rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 dark:focus-visible:outline-primary-300"
        title="Click to enlarge"
      >
        <img
          src={src}
          alt={alt}
          className={`${className} cursor-zoom-in`}
        />
      </button>

      {isExpanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center"
          onClick={() => setIsExpanded(false)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' && event.key !== 'Tab') return;
            event.preventDefault();
            event.stopPropagation();
            if (event.key === 'Escape') setIsExpanded(false);
          }}
        >
          <div
            className="relative max-w-6xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={closePreviewRef}
              type="button"
              onClick={() => setIsExpanded(false)}
              className="absolute -top-10 right-0 text-white/90 hover:text-white text-sm font-medium"
            >
              Close
            </button>
            <img
              src={src}
              alt={alt}
              className="w-full max-h-[85vh] object-contain rounded-lg border border-white/20 shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
};

/**
 * DentalHistorySection
 *
 * Displays sub-sections for: Dental Visit History, Dental Procedures, Oral Appliances.
 */
const DentalHistorySection = ({
  dentalHistory,
  dentalProcedureProfile,
  oralApplianceProfile,
  dentalPhotoRecord = null,
  catalogs = {},
  isEditing = false,
  editedFields = {},
  onFieldChange,
  onToggleEdit,
  isPending = false,
  isLocked = false,
}) => {
  const hasEdits = Object.keys(editedFields).length > 0;

  const formatCleaningRange = (value) => {
    if (value === null || value === undefined || value === '') return value;
    const text = String(value).trim();
    const match = DENTAL_CLEANING_CHOICES.find((choice) => choice.value === text.replace(/\s+/gu, ''));
    if (match) return match.label;
    return text;
  };

  const getVal = (key, fallback) =>
    editedFields[key] !== undefined ? editedFields[key] : fallback;

  const getOriginal = (key, current) =>
    editedFields[key] !== undefined ? current : undefined;

  const getCatalogName = (catalog, id) => {
    if (!catalog?.length || id === undefined || id === null) return null;
    const item = catalog.find((c) => String(c.id) === String(id));
    return item?.name ?? null;
  };

  const procedures = dentalProcedureProfile?.procedures ?? [];
  const appliances = oralApplianceProfile?.appliances ?? [];
  const hasVisit = [dentalHistory?.seenByDentist, dentalHistory?.lastDentalCleaning,
    dentalHistory?.lastVisitDate, dentalHistory?.purpose].some(hasReviewValue);
  const hasApplianceDetails = [oralApplianceProfile?.otherDescription, oralApplianceProfile?.otherArch,
    oralApplianceProfile?.notes].some(hasReviewValue);
  const hasPhotos = Boolean(dentalPhotoRecord?.upperTeeth || dentalPhotoRecord?.lowerTeeth);
  const seenByDentist = dentalHistory?.seenByDentist == null ? '' : dentalHistory.seenByDentist ? 'Yes' : 'No';
  const originalCleaning = getOriginal('lastDentalCleaning', dentalHistory?.lastDentalCleaning ?? '');

  if (!(hasVisit || procedures.length || hasReviewValue(dentalProcedureProfile?.notes) ||
    appliances.length || hasApplianceDetails || hasPhotos || hasEdits)) return null;

  const renderDentalVisitHistory = () => (
      <dl className="space-y-0">
        <EditableField
          label="Seen by Dentist"
          value={getVal('seenByDentist', seenByDentist)}
          originalValue={getOriginal('seenByDentist', seenByDentist)}
          isEditing={isEditing}
          onChange={(v) => onFieldChange?.('seenByDentist', v)}
          type="select"
          options={['Yes', 'No']}
        />
        <EditableField
          label="Last Dental Cleaning"
          value={
            isEditing
              ? getVal('lastDentalCleaning', dentalHistory?.lastDentalCleaning ?? '')
              : formatCleaningRange(getVal('lastDentalCleaning', dentalHistory?.lastDentalCleaning ?? ''))
          }
          originalValue={isEditing ? originalCleaning : formatCleaningRange(originalCleaning)}
          isEditing={isEditing}
          onChange={(v) => onFieldChange?.('lastDentalCleaning', v)}
          type="select"
          options={DENTAL_CLEANING_CHOICES}
        />
        <EditableField
          label="Purpose"
          value={getVal('purpose', dentalHistory?.purpose ?? '')}
          originalValue={getOriginal('purpose', dentalHistory?.purpose ?? '')}
          isEditing={isEditing}
          onChange={(v) => onFieldChange?.('purpose', v)}
        />
        <EditableField
          label="Last Visit Date"
          value={getVal('lastVisitDate', dentalHistory?.lastVisitDate ? String(dentalHistory?.lastVisitDate).split('T')[0] : '')}
          originalValue={getOriginal('lastVisitDate', dentalHistory?.lastVisitDate ? String(dentalHistory?.lastVisitDate).split('T')[0] : '')}
          isEditing={isEditing}
          onChange={(v) => onFieldChange?.('lastVisitDate', v)}
          type="date"
        />
      </dl>
  );

  return (
    <SectionWrapper
      title="Dental History"
      isEditing={isEditing}
      hasEdits={hasEdits}
      onToggleEdit={hasVisit ? onToggleEdit : undefined}
      isPending={isPending}
      isLocked={isLocked}
    >
      {hasVisit && renderDentalVisitHistory()}

      {(appliances.length > 0 || hasApplianceDetails) && (
        <div className="space-y-2">
          <h4 className="m-0 text-sm font-semibold text-secondary-800 dark:text-neutral-100">Intra-Oral Appliances</h4>
          {appliances.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {appliances.map((item, index) => (
                <ReviewChip key={item.id ?? index} tone="appliance" data-review-entry={`oralApplianceProfile:${index}`}
                  detail={[item.arch && `Location: ${item.arch}`, item.status, formatReviewDate(item.dateIssued)].filter(Boolean).join(' · ')}>
                  {getCatalogName(catalogs.oralApplianceCatalog, item.tagId) || 'Unresolved choice'}
                </ReviewChip>
              ))}
            </div>
          )}
          <dl>
            <DataRow label="Other Appliance Description" value={oralApplianceProfile?.otherDescription} />
            <DataRow label="Other Appliance Location" value={oralApplianceProfile?.otherArch} />
          </dl>
          <ReviewNote label="Appliance Notes" value={oralApplianceProfile?.notes} />
        </div>
      )}

      {(procedures.length > 0 || hasReviewValue(dentalProcedureProfile?.notes)) && (
        <div className="space-y-2">
          <h4 className="m-0 text-sm font-semibold text-secondary-800 dark:text-neutral-100">Dental Procedures</h4>
          {procedures.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {procedures.map((item, index) => (
                <ReviewChip key={item.id ?? index} tone="procedure" detail={formatReviewDate(item.procedureDate)} data-review-entry={`dentalProcedureProfile:${index}`}>
                  {getCatalogName(catalogs.dentalProcedureCatalog, item.procedureTypeId) || 'Unresolved choice'}
                </ReviewChip>
              ))}
            </div>
          )}
          <ReviewNote label="Dental Procedure Notes" value={dentalProcedureProfile?.notes} />
        </div>
      )}

      {/* Dental Photos */}
      {hasPhotos && (
        <div className="mt-2">
          <h4 className="mb-3 mt-0 text-sm font-semibold text-secondary-800 dark:text-neutral-100">
            Dental Photos
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dentalPhotoRecord.upperTeeth && (
              <div>
                <p className="text-xs font-medium text-secondary-600 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                  Upper Teeth
                </p>
                <AuthenticatedImage
                  path={`/media/record/dentalPhoto/${dentalPhotoRecord.upperTeeth}`}
                  alt="Upper teeth photo"
                  className="aspect-[4/3] w-full rounded-lg border border-neutral-200 bg-neutral-50 object-contain dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
            )}
            {dentalPhotoRecord.lowerTeeth && (
              <div>
                <p className="text-xs font-medium text-secondary-600 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                  Lower Teeth
                </p>
                <AuthenticatedImage
                  path={`/media/record/dentalPhoto/${dentalPhotoRecord.lowerTeeth}`}
                  alt="Lower teeth photo"
                  className="aspect-[4/3] w-full rounded-lg border border-neutral-200 bg-neutral-50 object-contain dark:border-neutral-700 dark:bg-neutral-900"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </SectionWrapper>
  );
};

export default DentalHistorySection;
