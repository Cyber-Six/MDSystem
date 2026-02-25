import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import StaffLayout from '../components/layout/StaffLayout.jsx';
import DashboardHome from '../modules/dashboard/dashboard-home.jsx';
import SearchPatient from './SearchPatient.jsx';
import PatientRecord from './PatientRecord.jsx';
import PendingRequests from './PendingRequests.jsx';
import StaffAppointment from '../modules/appointment/staff-appointment.jsx';
import RoleManagementPage from '../modules/role-management/pages/RoleManagementPage.jsx';

/**
 * Staff Dashboard Page
 * Wraps the staff layout and owns all authenticated sub-routes.
 */
const Dashboard = () => {
  return (
    <StaffLayout>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/search" element={<SearchPatient />} />
        <Route path="/patient/:patientId" element={<PatientRecord />} />
        <Route path="/pending" element={<PendingRequests />} />
        <Route path="/appointments" element={<StaffAppointment />} />
        <Route path="/settings/roles" element={<RoleManagementPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </StaffLayout>
  );
};

export default Dashboard;
