import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import StaffLayout from '../components/layout/StaffLayout.jsx';
import ErrorBoundary from '../components/error-boundary.jsx';
import { PatientTabsProvider } from '../context/patient-tabs-context.jsx';
import { PermissionsProvider } from '../context/permissions-context.jsx';
import PermissionRoute from '../components/guards/permission-route.jsx';
import { StaffNotificationProvider } from '../modules/notification/notification-context.jsx';

// Lazy-loaded route modules for code splitting
const DashboardHome = lazy(() => import('../modules/dashboard/dashboard-home.jsx'));
const SearchPatient = lazy(() => import('../modules/search-patient/search-patient-view.jsx'));
const PatientRecord = lazy(() => import('./PatientRecord.jsx'));
const PendingRequests = lazy(() => import('./PendingRequests.jsx'));
const StaffAppointment = lazy(() => import('../modules/appointment/staff-appointment.jsx'));
const RoleManagementPage = lazy(() => import('../modules/role-management/role-management-page.jsx'));
const MedicalInventory = lazy(() => import('../modules/medical-inventory/medical-inventory.jsx'));
const HealthChatView = lazy(() => import('../modules/health-chat/health-chat-view.jsx'));
const AnnouncementManagement = lazy(() => import('../modules/anouncement/components/announcement-management.jsx'));
const StaffAnalytics = lazy(() => import('../modules/analytics/staff-analytics.jsx'));
const SendNotificationView = lazy(() => import('../modules/notification/send-notification-view.jsx'));
const StaffSettings = lazy(() => import('../modules/settings/staff-settings.jsx'));
const NotFound = lazy(() => import('./NotFound.jsx'));

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
    <PatientTabsProvider>
      <PermissionsProvider>
        <StaffNotificationProvider>
        <StaffLayout>
          <ErrorBoundary>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route path="/" element={<DashboardHome />} />
                <Route path="/search" element={<PermissionRoute moduleId="patientSearch"><SearchPatient /></PermissionRoute>} />
                <Route path="/patient/:patientId" element={<PermissionRoute moduleId="patientSearch"><PatientRecord /></PermissionRoute>} />
                <Route path="/pending" element={<PermissionRoute moduleId="pendingRequests"><PendingRequests /></PermissionRoute>} />
                <Route path="/appointments" element={<PermissionRoute moduleId="appointments"><StaffAppointment /></PermissionRoute>} />
                <Route path="/inventory" element={<PermissionRoute moduleId="inventory"><MedicalInventory /></PermissionRoute>} />
                <Route path="/health-chat" element={<PermissionRoute moduleId="healthChat"><HealthChatView /></PermissionRoute>} />
                <Route path="/analytics" element={<PermissionRoute moduleId="analytics"><StaffAnalytics /></PermissionRoute>} />
                <Route path="/announcements" element={<PermissionRoute moduleId="announcements"><AnnouncementManagement /></PermissionRoute>} />
                <Route path="/notifications" element={<PermissionRoute moduleId="sendNotification"><SendNotificationView /></PermissionRoute>} />
                <Route path="/settings/roles" element={<PermissionRoute adminOnly><RoleManagementPage /></PermissionRoute>} />
                <Route path="/settings" element={<StaffSettings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </StaffLayout>
        </StaffNotificationProvider>
      </PermissionsProvider>
    </PatientTabsProvider>
  );
};

export default Dashboard;
