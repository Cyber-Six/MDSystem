import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/layout/layout.jsx';
import DashboardHome from '../modules/dashboard/dashboard-home.jsx';
import RecordUpdateForm from '../modules/record-forms/update-record/record-update-form.jsx';
import AppointmentPage from '../modules/appointment/appointment-page.jsx';
import MedicineRequestPage from '../modules/medicine-request/medicine-request-page.jsx';
import InitialRecordModal from '../components/modals/initial-record-modal.jsx';
import InitialMedicalRecordForm from '../modules/record-forms/initial-record/medical/initial-medical-record-form.jsx';
import { checkInitialRecordStatus } from '../services/emr-service.js';
import { useDetectRoleFromSubdomain } from '../hooks/use-role.js';

const Dashboard = () => {
  const { role } = useDetectRoleFromSubdomain();
  const [showInitialRecordModal, setShowInitialRecordModal] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  // Check if user needs to complete initial medical record (students only)
  useEffect(() => {
    const checkRecordStatus = async () => {
      // Only check for students, not staff
      if (role === 'staff' || role === 'admin') {
        console.log('[Dashboard] Staff/admin user - skipping initial record check');
        setIsCheckingStatus(false);
        return;
      }

      try {
        console.log('[Dashboard] Checking initial record status for student...');
        const { needsInitialRecord, status } = await checkInitialRecordStatus();
        
        console.log('[Dashboard] Initial record check result:', { needsInitialRecord, status });
        
        if (needsInitialRecord) {
          setShowInitialRecordModal(true);
        }
      } catch (error) {
        console.error('[Dashboard] Error checking initial record status:', error);
        // On error, assume they need to fill it out to be safe
        setShowInitialRecordModal(true);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkRecordStatus();
  }, [role]);

  // Handle successful completion of initial record
  const handleInitialRecordComplete = (result) => {
    console.log('[Dashboard] Initial record completed:', result);
    setShowInitialRecordModal(false);
  };

  // Show loading state while checking
  if (isCheckingStatus) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-secondary-600">Loading your dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <>
      {/* Initial Medical Record Modal - Only for students who haven't completed it */}
      <InitialRecordModal 
        isOpen={showInitialRecordModal}
        onComplete={handleInitialRecordComplete}
      >
        <InitialMedicalRecordForm 
          isModal={true}
          onComplete={handleInitialRecordComplete}
        />
      </InitialRecordModal>

      <Layout>
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/record-update" element={<RecordUpdateForm />} />
          <Route path="/appointments" element={<AppointmentPage />} />
          <Route path="/medicine-request" element={<MedicineRequestPage />} />
          <Route path="/e-consultation" element={<div>E-Consultation - Coming Soon</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </>
  );
};

export default Dashboard;
