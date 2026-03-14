import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import StaffLayout from '../components/layout/StaffLayout.jsx';
import ErrorBoundary from '../components/error-boundary.jsx';
import { PatientTabsProvider } from '../context/patient-tabs-context.jsx';

// Lazy-loaded route modules for code splitting
const DashboardHome = lazy(() => import('../modules/dashboard/dashboard-home.jsx'));
const SearchPatient = lazy(() => import('../modules/staff/search-patient/search-patient.jsx'));
const PatientRecord = lazy(() => import('./PatientRecord.jsx'));
const PendingRequests = lazy(() => import('./PendingRequests.jsx'));
const StaffAppointment = lazy(() => import('../modules/appointment/staff-appointment.jsx'));
const RoleManagementPage = lazy(() => import('../modules/role-management/pages/RoleManagementPage.jsx'));
const MedicalInventory = lazy(() => import('../modules/medical-inventory/medical-inventory.jsx'));

const RouteLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
  </div>
);

/**
 * Staff Dashboard Page
 * Wraps the staff layout and owns all authenticated sub-routes.
 */
const Dashboard = () => {
  return (
    <StaffLayout>
      <PatientTabsProvider>
        <ErrorBoundary>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<DashboardHome />} />
              <Route path="/search" element={<SearchPatient />} />
              <Route path="/patient/:patientId" element={<PatientRecord />} />
              <Route path="/pending" element={<PendingRequests />} />
              <Route path="/appointments" element={<StaffAppointment />} />
              <Route path="/inventory" element={<MedicalInventory />} />
              <Route path="/settings/roles" element={<RoleManagementPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </PatientTabsProvider>
    </StaffLayout>
  );
};

export default Dashboard;
