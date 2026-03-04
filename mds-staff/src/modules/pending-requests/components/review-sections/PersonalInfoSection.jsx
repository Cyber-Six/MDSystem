import React from 'react';
import SectionWrapper, { DataRow, EditableField } from './SectionWrapper';

/**
 * PersonalInfoSection
 *
 * Displays patient personal information (name, student/employee info, etc.)
 * from basicInfo + profile data.
 */
const PersonalInfoSection = ({
  basicInfo,
  profile,
  isEditing = false,
  editedFields = {},
  onFieldChange,
  editReason = '',
  onEditReasonChange,
  onToggleEdit,
  isPending = false,
}) => {
  const hasEdits = Object.keys(editedFields).length > 0;

  const getVal = (key, fallback) =>
    editedFields[key] !== undefined ? editedFields[key] : fallback;

  const getOriginal = (key, current) =>
    editedFields[key] !== undefined ? current : undefined;

  const formatYear = (year) => {
    if (!year) return null;
    const map = {
      Grade11: 'Grade 11', Grade12: 'Grade 12',
      Freshman: 'Freshman', Sophomore: 'Sophomore',
      Junior: 'Junior', Senior: 'Senior',
      Masteral: 'Masteral', Doctorate: 'Doctorate',
    };
    return map[year] ?? year;
  };

  const isStudent = basicInfo?.profile_type === 'Student' || profile?.program;
  const isEmployee = basicInfo?.profile_type === 'Employee' || profile?.department;

  return (
    <SectionWrapper
      title="Personal Information"
      scopeLabel="Medical"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      }
      isEditing={isEditing}
      onToggleEdit={onToggleEdit}
      editReason={editReason}
      onEditReasonChange={onEditReasonChange}
      hasEdits={hasEdits}
      isPending={isPending}
    >
      {/* Basic Info */}
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Personal Details
        </h4>
        <dl className="space-y-0">
          <DataRow
            label="Full Name"
            value={
              [basicInfo?.last_name, basicInfo?.first_name, basicInfo?.middle_name]
                .filter(Boolean)
                .join(basicInfo?.last_name ? ', ' : ' ') +
              (basicInfo?.suffix ? ` ${basicInfo.suffix}` : '') || '—'
            }
          />
          <DataRow label="Sex" value={basicInfo?.sex} />
          <DataRow label="Identifier" value={basicInfo?.identifier} />
          <DataRow label="Branch" value={basicInfo?.branch === 'QuezonCity' ? 'Quezon City' : basicInfo?.branch} />
        </dl>
      </div>

      {/* School / Work Info */}
      {isStudent && (
        <div className="space-y-1 mt-4">
          <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            School Information
          </h4>
          <dl className="space-y-0">
            <EditableField
              label="Program"
              value={getVal('program', profile?.program ?? basicInfo?.program)}
              originalValue={getOriginal('program', profile?.program ?? basicInfo?.program)}
              isEditing={isEditing}
              onChange={(v) => onFieldChange?.('program', v)}
            />
            <EditableField
              label="Year Level"
              value={getVal('year', formatYear(profile?.year ?? basicInfo?.year))}
              originalValue={getOriginal('year', formatYear(profile?.year ?? basicInfo?.year))}
              isEditing={isEditing}
              onChange={(v) => onFieldChange?.('year', v)}
              type="select"
              options={[
                'Grade 11', 'Grade 12', 'Freshman', 'Sophomore',
                'Junior', 'Senior', 'Masteral', 'Doctorate',
              ]}
            />
          </dl>
        </div>
      )}

      {isEmployee && (
        <div className="space-y-1 mt-4">
          <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
            Employment Information
          </h4>
          <dl className="space-y-0">
            <EditableField
              label="Department"
              value={getVal('department', profile?.department)}
              originalValue={getOriginal('department', profile?.department)}
              isEditing={isEditing}
              onChange={(v) => onFieldChange?.('department', v)}
            />
            <EditableField
              label="Role"
              value={getVal('role', profile?.role)}
              originalValue={getOriginal('role', profile?.role)}
              isEditing={isEditing}
              onChange={(v) => onFieldChange?.('role', v)}
            />
            <EditableField
              label="Position"
              value={getVal('position', profile?.position)}
              originalValue={getOriginal('position', profile?.position)}
              isEditing={isEditing}
              onChange={(v) => onFieldChange?.('position', v)}
            />
          </dl>
        </div>
      )}
    </SectionWrapper>
  );
};

export default PersonalInfoSection;
