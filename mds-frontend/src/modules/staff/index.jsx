import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import StaffLayout from './components/layout/StaffLayout';
import StaffDashboard from './pages/StaffDashboard';
import SearchPatient from './pages/SearchPatient';
import PatientRecord from './pages/PatientRecord';
import PendingRequests from './pages/PendingRequests';
import StaffAppointment from '../appointment/staff/staff-appointment';
import RoleManagementPage from '../role-management/pages/RoleManagementPage';

/**
 * Staff Module Entry Point
 * Contains all staff/doctor EMR related routes and components
 */
const StaffModule = () => {
  return (
    <StaffLayout>
      <Routes>
        <Route path="/" element={<StaffDashboard />} />
        <Route path="/search" element={<SearchPatient />} />
        <Route path="/patient/:patientId" element={<PatientRecord />} />
        <Route path="/pending" element={<PendingRequests />} />
        <Route path="/appointments" element={<StaffAppointment />} />
        <Route path="/settings/roles" element={<RoleManagementPage />} />
        <Route path="*" element={<Navigate to="/staff" replace />} />
      </Routes>
    </StaffLayout>
  );
};

export default StaffModule;
