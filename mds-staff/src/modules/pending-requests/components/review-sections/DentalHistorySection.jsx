import React from 'react';
import SectionWrapper, { DataRow } from './SectionWrapper';

/**
 * DentalHistorySection
 *
 * Displays sub-sections for: Dental Visit History, Dental Procedures, Oral Appliances.
 */
const DentalHistorySection = ({
  dentalHistory,
  dentalProcedureProfile,
  oralApplianceProfile,
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
      <div className="space-y-2">
        <DataRow label="Seen by Dentist" value={dentalHistory.seenByDentist ? 'Yes' : 'No'} />
        <DataRow label="Last Dental Cleaning" value={dentalHistory.lastDentalCleaning || '—'} />
        <DataRow label="Purpose" value={dentalHistory.purpose || '—'} />
        <DataRow label="Last Visit Date" value={formatDate(dentalHistory.lastVisitDate)} />
      </div>
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
                Procedure ID
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
                  #{proc.procedureTypeId}
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
                Tag ID
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
                  #{a.tagId}
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
      editReason={editReason}
      onEditReasonChange={onEditReasonChange}
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
    </SectionWrapper>
  );
};

export default DentalHistorySection;
