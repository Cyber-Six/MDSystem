import React from 'react';
import { useParams } from 'react-router-dom';
import { usePermissions } from '../../context/permissions-context';
import PatientRecordView from './patient-record-view.jsx';

const PatientRecordRoutePage = () => {
  const { patientId } = useParams();
  const { searchPatientPermissionFlags } = usePermissions();

  return (
    <PatientRecordView
      patientId={patientId}
      permissions={searchPatientPermissionFlags}
    />
  );
};

export default PatientRecordRoutePage;
