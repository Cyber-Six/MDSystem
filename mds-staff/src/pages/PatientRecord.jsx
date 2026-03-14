import React from 'react';
import { useParams } from 'react-router-dom';
import PatientRecordView from '../modules/search-patient/patient-record-view';

export default function PatientRecord() {
  const { patientId } = useParams();
  return <PatientRecordView patientId={patientId} embedded={false} />;
}
