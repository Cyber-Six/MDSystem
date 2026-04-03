import React from 'react';
import PatientSectionCard from './section-card';

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
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-secondary-500 dark:text-neutral-400">Credential Status:</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCredentialStatusColor(patient.credentialStatus)}`}>
            {patient.credentialStatus || 'Unknown'}
          </span>
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
      </PatientSectionCard>

      <PatientSectionCard title="Address">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Present Address" value={patient.personal.presentAddress} />
          <Field label="Province Address" value={patient.personal.provinceAddress} />
        </div>
      </PatientSectionCard>

      <PatientSectionCard title={patient.type === 'Employee' ? 'Employment Information' : 'Academic Information'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {patient.type === 'Employee' ? (
            <>
              <Field label="Employee Number" value={patient.personal.employeeNumber || patient.id} />
              <Field label="Department" value={patient.department || patient.program} />
              <Field label="Position" value={patient.personal.position || patient.year} />
              <Field label="Employment Category" value={patient.personal.employmentCategory} />
              <Field label="Employment Status" value={patient.personal.employmentStatus} />
              <Field label="Campus Branch" value={patient.personal.branch} />
            </>
          ) : (
            <>
              <Field label="Student Number" value={patient.personal.studentNumber || patient.id} />
              <Field label="Program" value={patient.program} />
              <Field label="Year Level" value={patient.year} />
            </>
          )}
        </div>
      </PatientSectionCard>

      <PatientSectionCard title="Emergency Contacts">
        <div className="grid md:grid-cols-2 gap-3">
          {Object.entries(patient.emergencyContacts).map(([key, contact]) => (
            <div key={key} className="p-3 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-700/30">
              <p className="text-sm font-semibold text-secondary-800 dark:text-white mb-2">{contact.name || 'N/A'}</p>
              <div className="space-y-1 text-xs">
                <p className="text-secondary-600 dark:text-neutral-300"><span className="text-secondary-500 dark:text-neutral-400">Relationship:</span> {contact.relationship || 'N/A'}</p>
                <p className="text-secondary-600 dark:text-neutral-300"><span className="text-secondary-500 dark:text-neutral-400">Contact:</span> {contact.contact || 'N/A'}</p>
                <p className="text-secondary-600 dark:text-neutral-300"><span className="text-secondary-500 dark:text-neutral-400">Address:</span> {contact.address || 'N/A'}</p>
              </div>
            </div>
          ))}
        </div>
      </PatientSectionCard>
    </div>
  );
}
