import React from 'react';
import PatientSectionCard from './section-card';
import { formatBranchLabel } from '../../../utils/branch-utils';

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-secondary-500 dark:text-neutral-400">{label}</p>
      <p className="text-sm font-medium text-secondary-800 dark:text-white">{value || 'N/A'}</p>
    </div>
  );
}

export default function PatientPersonalInfoTab({ patient }) {
  const getCredentialStatusColor = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'Inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300';
      case 'Locked':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'Unverified':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700/30 dark:text-neutral-300';
    }
  };

  return (
    <div className="space-y-3">
      <PatientSectionCard title="Account Status">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-secondary-500 dark:text-neutral-400">Credential Status:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCredentialStatusColor(patient.credentialStatus)}`}>
              {patient.credentialStatus || 'Unknown'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-secondary-500 dark:text-neutral-400">Branch:</span>
            <span className="text-sm font-semibold text-secondary-800 dark:text-white">
              {formatBranchLabel(patient.personal.branch) || <span className="text-secondary-300 dark:text-neutral-600 font-normal">N/A</span>}
            </span>
          </div>
        </div>
      </PatientSectionCard>

      <PatientSectionCard title="Basic Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Field label="First Name" value={patient.personal.firstName} />
          <Field label="Middle Name" value={patient.personal.middleName} />
          <Field label="Last Name" value={patient.personal.lastName} />
          <Field label="Suffix" value={patient.personal.suffix} />
          <Field label="Birth Date" value={patient.personal.birthDate} />
          <Field label="Age" value={patient.personal.age ? `${patient.personal.age} years old` : ''} />
          <Field label="Sex" value={patient.personal.sex} />
          <Field label="Civil Status" value={patient.personal.civilStatus} />
          <Field label="Nationality" value={patient.personal.nationality} />
          <Field label="Religion" value={patient.personal.religion} />
          <Field label="Contact Number" value={patient.personal.contactNumber} />
          <Field label="Email" value={patient.email} />
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Present Address" value={patient.personal.presentAddress} />
          <Field label="Province Address" value={patient.personal.provinceAddress} />
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700">
          <p className="text-sm font-semibold text-secondary-700 dark:text-neutral-300 mb-3">Emergency Contacts</p>
          <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-neutral-100 dark:md:divide-neutral-700">
            {Object.entries(patient.emergencyContacts).map(([key, contact]) => (
              <div
                key={key}
                className={`py-4 space-y-3 ${key === 'first' ? 'md:pr-4 md:py-0' : 'md:pl-4 md:py-0'}`}
              >
                <p className="text-sm font-semibold text-secondary-600 dark:text-neutral-400">
                  {key === 'first' ? 'Contact 1' : 'Contact 2'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Name" value={contact.name} />
                  <Field label="Relationship" value={contact.relationship} />
                  <Field label="Contact" value={contact.contact} />
                  <Field label="Address" value={contact.address} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </PatientSectionCard>

      <PatientSectionCard title={patient.type === 'Employee' ? 'Employment Information' : 'Academic Information'}>
        {(() => {
          const gridClass = patient.type === 'Employee'
            ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3'
            : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3';
          return (
            <div className={gridClass}>
              {patient.type === 'Employee' ? (
                <>
                  <Field label="Employee Number" value={patient.personal.employeeNumber || patient.id} />
                  <Field label="Role" value={patient.year || patient.personal.position} />
                  <Field label="Department" value={patient.department || patient.program} />
                  <Field label="Position" value={patient.personal.position || patient.year} />
                </>
              ) : (
                <>
                  <Field label="Student Number" value={patient.personal.studentNumber || patient.id} />
                  <Field label="Program" value={patient.program} />
                  <Field label="Year Level" value={patient.year} />
                </>
              )}
            </div>
          );
        })()}
      </PatientSectionCard>

      
    </div>
  );
}
