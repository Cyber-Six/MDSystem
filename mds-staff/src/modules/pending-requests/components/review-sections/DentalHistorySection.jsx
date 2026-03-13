import React, { useState, useEffect } from 'react';
import SectionWrapper, { DataRow, EditableField } from './SectionWrapper';
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
        type="button"
        onClick={() => setIsExpanded(true)}
        className="block w-full text-left"
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
          className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="relative max-w-6xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
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
    if (value === null || value === undefined || value === '') return '';
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

  const formatDate = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return String(d);
    }
  };

  /* ---- Dental Visit History ---- */
  const renderDentalVisitHistory = () => {
    if (!dentalHistory) {
      return <p className="text-sm text-neutral-400 italic">No dental visit history on file.</p>;
    }

    return (
      <dl className="space-y-0">
        <EditableField
          label="Seen by Dentist"
          value={getVal('seenByDentist', dentalHistory.seenByDentist ? 'Yes' : 'No')}
          originalValue={getOriginal('seenByDentist', dentalHistory.seenByDentist ? 'Yes' : 'No')}
          isEditing={isEditing}
          onChange={(v) => onFieldChange?.('seenByDentist', v)}
          type="select"
          options={['Yes', 'No']}
        />
        <EditableField
          label="Last Dental Cleaning"
          value={
            isEditing
              ? getVal('lastDentalCleaning', dentalHistory.lastDentalCleaning ?? '')
              : formatCleaningRange(getVal('lastDentalCleaning', dentalHistory.lastDentalCleaning ?? ''))
          }
          originalValue={formatCleaningRange(getOriginal('lastDentalCleaning', dentalHistory.lastDentalCleaning ?? ''))}
          isEditing={isEditing}
          onChange={(v) => onFieldChange?.('lastDentalCleaning', v)}
          type="select"
          options={DENTAL_CLEANING_CHOICES}
        />
        <EditableField
          label="Purpose"
          value={getVal('purpose', dentalHistory.purpose ?? '')}
          originalValue={getOriginal('purpose', dentalHistory.purpose ?? '')}
          isEditing={isEditing}
          onChange={(v) => onFieldChange?.('purpose', v)}
        />
        <EditableField
          label="Last Visit Date"
          value={getVal('lastVisitDate', dentalHistory.lastVisitDate ? String(dentalHistory.lastVisitDate).split('T')[0] : '')}
          originalValue={getOriginal('lastVisitDate', dentalHistory.lastVisitDate ? String(dentalHistory.lastVisitDate).split('T')[0] : '')}
          isEditing={isEditing}
          onChange={(v) => onFieldChange?.('lastVisitDate', v)}
          type="date"
        />
      </dl>
    );
  };

  /* ---- Dental Procedures ---- */
  const renderDentalProcedures = () => {
    const procedures = dentalProcedureProfile?.procedures;
    if (!procedures || procedures.length === 0) {
      return <p className="text-sm text-neutral-400 italic">No dental procedures recorded.</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              <th className="text-left py-2 px-3 font-medium text-neutral-500 dark:text-neutral-400">
                Procedure
              </th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 dark:text-neutral-400">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {procedures.map((proc, idx) => (
              <tr
                key={proc.id || idx}
                className="border-b border-neutral-100 dark:border-neutral-800 last:border-0"
              >
                <td className="py-2 px-3 text-neutral-700 dark:text-neutral-300">
                  {getCatalogName(catalogs.dentalProcedureCatalog, proc.procedureTypeId) || `Procedure #${proc.procedureTypeId}`}
                </td>
                <td className="py-2 px-3 text-neutral-700 dark:text-neutral-300">
                  {formatDate(proc.procedureDate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {dentalProcedureProfile?.notes && (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 italic">
            Notes: {dentalProcedureProfile.notes}
          </p>
        )}
      </div>
    );
  };

  /* ---- Oral Appliances ---- */
  const renderOralAppliances = () => {
    const appliances = oralApplianceProfile?.appliances;
    if (!appliances || appliances.length === 0) {
      return <p className="text-sm text-neutral-400 italic">No oral appliances on record.</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              <th className="text-left py-2 px-3 font-medium text-neutral-500 dark:text-neutral-400">
                Tag
              </th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 dark:text-neutral-400">
                Status
              </th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 dark:text-neutral-400">
                Date Issued
              </th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 dark:text-neutral-400">
                Arch
              </th>
            </tr>
          </thead>
          <tbody>
            {appliances.map((a, idx) => (
              <tr
                key={a.id || idx}
                className="border-b border-neutral-100 dark:border-neutral-800 last:border-0"
              >
                <td className="py-2 px-3 text-neutral-700 dark:text-neutral-300">
                  {getCatalogName(catalogs.oralApplianceCatalog, a.tagId) || `Tag #${a.tagId}`}
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      a.status === 'Active'
                        ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="py-2 px-3 text-neutral-700 dark:text-neutral-300">
                  {formatDate(a.dateIssued)}
                </td>
                <td className="py-2 px-3 text-neutral-700 dark:text-neutral-300">{a.arch}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {oralApplianceProfile?.notes && (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 italic">
            Notes: {oralApplianceProfile.notes}
          </p>
        )}
      </div>
    );
  };

  return (
    <SectionWrapper
      title="Dental History"
      scope="dental"
      isEditing={isEditing}
      hasEdits={hasEdits}
      onToggleEdit={onToggleEdit}
      isPending={isPending}
      isLocked={isLocked}
    >
      {/* Dental Visit History */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
          Dental Visit History
        </h4>
        {renderDentalVisitHistory()}
      </div>

      {/* Dental Procedures */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
          Dental Procedures
        </h4>
        {renderDentalProcedures()}
      </div>

      {/* Oral Appliances */}
      <div>
        <h4 className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
          Oral Appliances
        </h4>
        {renderOralAppliances()}
      </div>

      {/* Dental Photos */}
      {dentalPhotoRecord && (dentalPhotoRecord.upperTeeth || dentalPhotoRecord.lowerTeeth) && (
        <div className="mt-2">
          <h4 className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
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
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 object-cover"
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
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 object-cover"
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
