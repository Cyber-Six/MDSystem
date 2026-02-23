import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/layout/layout.jsx';
import DashboardHome from '../modules/dashboard/dashboard-home.jsx';
import RecordUpdateForm from '../modules/record-forms/update-record/record-update-form.jsx';
import AppointmentPage from '../modules/appointment/appointment-router.jsx';
import MedicineRequestPage from '../modules/medicine-request/medicine-request-page.jsx';
import EConsultation from '../modules/e-consultation/e-consultation.jsx';
import { useDetectRoleFromSubdomain } from '../hooks/use-role.js';
import { checkInitialRecordStatus } from '../services/emr-service.js';
import InitialRecordModal from '../components/modals/initial-record-modal.jsx';
import InitialMedicalRecordForm from '../modules/record-forms/initial-record/medical/initial-medical-record-form.jsx';

const Dashboard = () => {
  const { role } = useDetectRoleFromSubdomain();
  const [showInitialRecordModal, setShowInitialRecordModal] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [recordStatus, setRecordStatus] = useState(null);

  // Check if user needs to complete initial medical record (students only)
  useEffect(() => {
    const checkRecordStatus = async () => {
      // Check if bypass is enabled
      const bypassInitialRecord = import.meta.env.VITE_BYPASS_INITIAL_RECORD === 'true';
      if (bypassInitialRecord) {
        console.log('[Dashboard] Bypass enabled - skipping initial record requirement');
        setIsCheckingStatus(false);
        return;
      }

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
        
        setRecordStatus(status);
        
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
  const handleInitialRecordComplete = async (result) => {
    console.log('[Dashboard] Initial record completed:', result);
    setShowInitialRecordModal(false);
    
    // Refresh the status to show pending approval screen
    try {
      const { status } = await checkInitialRecordStatus();
      setRecordStatus(status);
    } catch (error) {
      console.error('[Dashboard] Error refreshing status after completion:', error);
    }
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

  // Show pending approval screen when initial record is awaiting staff verification
  if (recordStatus === 'Pending' && role !== 'staff' && role !== 'admin') {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-2xl mx-auto px-4">
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-8 text-center">
              {/* Icon */}
              <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              
              {/* Title */}
              <h2 className="text-2xl font-bold text-secondary-900 mb-3">
                Initial Record Submitted Successfully
              </h2>
              
              {/* Message */}
              <p className="text-secondary-700 mb-6 text-lg">
                Your initial medical record has been submitted, you need to go to the MDS for you to be verified by the medical staff.
              </p>
              
              <div className="bg-white rounded-lg p-6 mb-6">
                <p className="text-secondary-600 mb-4">
                  <strong className="text-secondary-900">What happens next?</strong>
                </p>
                <ul className="text-left text-secondary-600 space-y-3">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Our medical staff will review your submitted information</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>You'll be notified once your record is verified or if any corrections are needed</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Once verified, you'll have full access to the dashboard and all services</span>
                  </li>
                </ul>
              </div>
              
              {/* Status Badge */}
              <div className="inline-flex items-center px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                Status: Pending Approval
              </div>
              
              <p className="text-sm text-secondary-500 mt-6">
                You'll need to be verified within a week or else you'll have to re-submit your record. Thank you for your patience!
              </p>
            </div>
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
          <Route path="/e-consultation" element={<EConsultation />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </>
  );
};

export default Dashboard;
