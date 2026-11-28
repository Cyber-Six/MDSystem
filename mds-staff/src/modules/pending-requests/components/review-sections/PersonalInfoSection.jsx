import { personalInfoLimits } from '@mdsystem/core/validation/personal-info';
import React, { useState } from 'react';
import SectionWrapper, { DataRow, EditableField, formatReviewDate, hasReviewValue } from './SectionWrapper';
import { formatBranchLabel } from '../../../../utils/branch-utils';

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
  onToggleEdit,
  isPending = false,
}) => {
  const [isProfileEditing, setProfileEditing] = useState(false);
  const profileKeys = ['program', 'year', 'department', 'role', 'position'];
  const hasProfileEdits = Object.keys(editedFields).some((key) => profileKeys.includes(key));
  const hasPersonalEdits = Object.keys(editedFields).some((key) => !profileKeys.includes(key));

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

  const isStudent = profile?.__typename === 'StudentProfile' || Boolean(profile?.program) || basicInfo?.profile_type === 'Student';
  const isEmployee = profile?.__typename === 'EmployeeProfile' || Boolean(profile?.department) || basicInfo?.profile_type === 'Employee';
  const givenNames = [getVal('first_name', basicInfo?.first_name), getVal('middle_name', basicInfo?.middle_name)].filter(hasReviewValue).join(' ');
  const fullName = [getVal('last_name', basicInfo?.last_name), givenNames].filter(hasReviewValue).join(', ');
  const originalName = [basicInfo?.last_name, [basicInfo?.first_name, basicInfo?.middle_name].filter(hasReviewValue).join(' ')]
    .filter(hasReviewValue).join(', ');
  const schoolProgram = profile?.program ?? basicInfo?.program;
  const schoolYear = formatYear(profile?.year ?? basicInfo?.year);
  const department = profile?.department ?? basicInfo?.department;
  const role = profile?.role ?? basicInfo?.role;
  const categoryDescription = profile?.employmentCategoryOther ?? basicInfo?.employmentCategoryOther;

  return (
    <>
      {basicInfo && <SectionWrapper
        title="Personal Information"
        isEditing={isEditing}
        onToggleEdit={onToggleEdit}
        hasEdits={hasPersonalEdits}
        isPending={isPending}
      >
        {/* Basic Info */}
        <div className="space-y-1">
          <dl className="space-y-0">
            {!isEditing && <DataRow label="Full Name" value={fullName} isEdited={fullName !== originalName} originalValue={originalName} />}
            {isEditing && <>
              <EditableField
                label="Last Name"
                maxLength={personalInfoLimits.surname}
                value={getVal('last_name', basicInfo?.last_name)}
                originalValue={getOriginal('last_name', basicInfo?.last_name)}
                isEditing={isEditing}
                onChange={(v) => onFieldChange?.('last_name', v)}
              />
              <EditableField
                label="First Name"
                maxLength={personalInfoLimits.firstName}
                value={getVal('first_name', basicInfo?.first_name)}
                originalValue={getOriginal('first_name', basicInfo?.first_name)}
                isEditing={isEditing}
                onChange={(v) => onFieldChange?.('first_name', v)}
              />
              <EditableField
                label="Middle Name"
                maxLength={personalInfoLimits.middleName}
                value={getVal('middle_name', basicInfo?.middle_name)}
                originalValue={getOriginal('middle_name', basicInfo?.middle_name)}
                isEditing={isEditing}
                onChange={(v) => onFieldChange?.('middle_name', v)}
              />
            </>}
            <DataRow label="Birthday" value={formatReviewDate(basicInfo?.date_of_birth)} />
            <EditableField
              label="Suffix"
              maxLength={personalInfoLimits.suffix}
              value={getVal('suffix', basicInfo?.suffix)}
              originalValue={getOriginal('suffix', basicInfo?.suffix)}
              isEditing={isEditing}
              onChange={(v) => onFieldChange?.('suffix', v)}
            />
            <EditableField
              label="Sex"
              value={getVal('sex', basicInfo?.sex)}
              originalValue={getOriginal('sex', basicInfo?.sex)}
              isEditing={isEditing}
              onChange={(v) => onFieldChange?.('sex', v)}
              type="select"
              options={['Male', 'Female']}
            />
            {isEmployee ? (
              <>
                <EditableField
                  label="Identifier"
                  maxLength={10}
                  value={getVal('identifier', basicInfo?.identifier)}
                  originalValue={getOriginal('identifier', basicInfo?.identifier)}
                  isEditing={isEditing}
                  onChange={(v) => { if (/^[0-9]*$/.test(v) && Number(v) <= 2147483647) onFieldChange?.('identifier', v); }}
                />
                <EditableField
                  label="Branch"
                  value={getVal('branch', basicInfo?.branch)}
                  originalValue={getOriginal('branch', basicInfo?.branch)}
                  isEditing={isEditing}
                  onChange={(v) => onFieldChange?.('branch', v)}
                  type="select"
                  options={[
                    { value: 'Manila', label: 'Manila' },
                    { value: 'QuezonCity', label: 'Quezon City' },
                  ]}
                />
              </>
            ) : (
              <>
                {!isStudent && <DataRow label="Identifier" value={basicInfo?.identifier} />}
                <DataRow label="Branch" value={basicInfo?.branch ? formatBranchLabel(basicInfo.branch) : null} />
              </>
            )}
          </dl>
          <dl>
            <DataRow label="Civil Status" value={basicInfo?.civil_status} />
            <DataRow label="Nationality" value={basicInfo?.nationality} />
            <DataRow label="Religion" value={basicInfo?.religion} />
            <DataRow label="Contact Number" value={basicInfo?.contactNumber} />
            <DataRow label="Present Address" value={basicInfo?.present_address} />
            <DataRow label="Province Address" value={basicInfo?.province_address} />
          </dl>
        </div>
      </SectionWrapper>}

      {/* School / Work Info */}
      {isStudent && [schoolProgram, schoolYear, basicInfo?.identifier].some(hasReviewValue) && (
        <SectionWrapper title="School Information" isEditing={isProfileEditing} hasEdits={hasProfileEdits}
          onToggleEdit={() => setProfileEditing((current) => !current)} isPending={isPending}>
          <dl className="space-y-0">
            <EditableField
              label="Program"
              value={getVal('program', schoolProgram)}
              originalValue={getOriginal('program', schoolProgram)}
              isEditing={isProfileEditing}
              onChange={(v) => onFieldChange?.('program', v)}
            />
            <DataRow label="Student Number" value={basicInfo?.identifier} />
            <EditableField
              label="Year Level"
              value={getVal('year', schoolYear)}
              originalValue={getOriginal('year', schoolYear)}
              isEditing={isProfileEditing}
              onChange={(v) => onFieldChange?.('year', v)}
              type="select"
              options={[
                'Grade 11', 'Grade 12', 'Freshman', 'Sophomore',
                'Junior', 'Senior', 'Masteral', 'Doctorate',
              ]}
            />
          </dl>
        </SectionWrapper>
      )}

      {isEmployee && [department, role, profile?.position, categoryDescription].some(hasReviewValue) && (
        <SectionWrapper title="Employment Information" isEditing={isProfileEditing} hasEdits={hasProfileEdits}
          onToggleEdit={() => setProfileEditing((current) => !current)} isPending={isPending}>
          <dl className="space-y-0">
            <EditableField
              label="Department"
              maxLength={personalInfoLimits.department}
              value={getVal('department', department)}
              originalValue={getOriginal('department', department)}
              isEditing={isProfileEditing}
              onChange={(v) => onFieldChange?.('department', v)}
            />
            <EditableField
              label="Role"
              value={getVal('role', role)}
              originalValue={getOriginal('role', role)}
              isEditing={isProfileEditing}
              onChange={(v) => onFieldChange?.('role', v)}
            />
            <DataRow label="Employment Category Description" value={categoryDescription} />
            <EditableField
              label="Position"
              maxLength={personalInfoLimits.position}
              value={getVal('position', profile?.position)}
              originalValue={getOriginal('position', profile?.position)}
              isEditing={isProfileEditing}
              onChange={(v) => onFieldChange?.('position', v)}
            />
          </dl>
        </SectionWrapper>
      )}
    </>
  );
};

export default PersonalInfoSection;
