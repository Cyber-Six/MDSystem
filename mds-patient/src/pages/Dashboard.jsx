import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/layout.jsx';
import ErrorBoundary from '../components/error-boundary.jsx';
import { checkInitialRecordStatus, getMyBranchIdentifier, fetchRevisionPrefill, getMyPersonalEmail, getPatientProfile } from '../services/emr-service.js';
import InitialRecordModal from '../modules/record-forms/initial-record/initial-record-modal.jsx';
import InitialMedicalRecordForm from '../modules/record-forms/initial-record/medical/initial-medical-record-form.jsx';
import InitialEmployeeRecordForm from '../modules/record-forms/initial-record/employee/initial-employee-record-form.jsx';
import { detectRoleFromEmail } from '@mdsystem/core/validation/email-validation';

// Derive the patient role from stored value, with fallback for sessions
// created before the patient_role key was introduced.
const resolveStoredRole = async () => {
  const stored = localStorage.getItem('patient_role');
  if (stored) return stored;

  // Backward-compat: old sessions stored the email instead
  const legacyEmail = (localStorage.getItem('patient_email') || '').toLowerCase().trim();
  if (legacyEmail) {
    const role = detectRoleFromEmail(legacyEmail) || 'Student';
    localStorage.setItem('patient_role', role);
    localStorage.removeItem('patient_email'); // migrate
    return role;
  }

  // Absolute fallback: ask the backend
  try {
    const emailFromProfile = await getMyPersonalEmail();
    if (emailFromProfile) {
      const role = detectRoleFromEmail(String(emailFromProfile).toLowerCase().trim()) || 'Student';
      localStorage.setItem('patient_role', role);
      return role;
    }
  } catch { /* ignore */ }

  return 'Student';
};

// Lazy-loaded route modules for code splitting
const DashboardHome = lazy(() => import('../modules/dashboard/dashboard-home.jsx'));
const RecordUpdateForm = lazy(() => import('../modules/record-forms/update-record/record-update-form.jsx'));
const AppointmentPage = lazy(() => import('../modules/appointment/appointment.jsx'));
const MedicineRequestPage = lazy(() => import('../modules/medicine-request/medicine-request-page.jsx'));
const HealthChat = lazy(() => import('../modules/health-chat/health-chat.jsx'));
const MyDocumentsPage = lazy(() => import('../modules/my-documents/my-documents-page.jsx'));
const PatientSettings = lazy(() => import('../modules/settings/patient-settings.jsx'));
const NotFound = lazy(() => import('./NotFound.jsx'));

const RouteLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showInitialRecordModal, setShowInitialRecordModal] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [recordStatus, setRecordStatus] = useState(null);
  const [credentialStatus, setCredentialStatus] = useState(null);
  const [isVerified, setIsVerified] = useState(null); // null=checking, true=verified, false=unverified
  const [revisionData, setRevisionData] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [revisionNote, setRevisionNote] = useState(null);
  const [inactiveTicketCreatedAt, setInactiveTicketCreatedAt] = useState(null);
  const [firstName, setFirstName] = useState(null);
  // In this portal, both Employee and Medical emails should use the employee initial form.
  const isEmployee = userRole === 'Employee' || userRole === 'Medical';

  // Check if user needs to complete initial medical record
  useEffect(() => {
    const checkRecordStatus = async () => {
      // Check if bypass is enabled
      const bypassInitialRecord = import.meta.env.VITE_BYPASS_INITIAL_RECORD === 'true';
      if (bypassInitialRecord) {
        console.log('[Dashboard] Bypass enabled - skipping initial record requirement');
        setIsCheckingStatus(false);
        return;
      }

      try {
        const detectedRole = await resolveStoredRole();
        setUserRole(detectedRole);

        // Fetch patient name for the dashboard greeting (non-blocking; result is cached)
        getPatientProfile().then(p => { if (p?.firstName) setFirstName(p.firstName); }).catch(() => {});

        console.log('[Dashboard] Checking initial record status...');
        console.log('[Dashboard] User role detected:', detectedRole);
        
        const [{
          needsInitialRecord,
          status,
          notes: ticketNotes,
          credentialStatus: nextCredentialStatus,
          ticketCreatedAt,
        }, branchInfo] = await Promise.all([
          checkInitialRecordStatus(),
          getMyBranchIdentifier(),
        ]);

        // Patient is verified when checkInitialRecordStatus confirms they no longer need the initial record form.
        // needsInitialRecord === true means credential is still 'Unverified' (not yet approved by staff).
        setIsVerified(!needsInitialRecord);
        setCredentialStatus(nextCredentialStatus || null);
        
        console.log('[Dashboard] Initial record check result:', { needsInitialRecord, status, isVerified: !needsInitialRecord });
        console.log('[Dashboard] Patient branch:', branchInfo?.branch ?? 'not set', '| identifier:', branchInfo?.identifier ?? 'not set');
        
        setRecordStatus(status);
        setInactiveTicketCreatedAt(ticketCreatedAt || null);

        if (status === 'Revision' && ticketNotes) {
          setRevisionNote(ticketNotes);
        } else {
          setRevisionNote(null);
        }
        
        if (needsInitialRecord) {
          // For revision status, pre-fetch existing data to populate the form
          if (status === 'Revision') {
            console.log('[Dashboard] Revision detected — fetching pre-fill data...');
            try {
              const prefill = await fetchRevisionPrefill();
              setRevisionData(prefill);
            } catch (err) {
              console.warn('[Dashboard] Could not fetch revision pre-fill data:', err.message);
            }
            // Store the staff's revision note from the ticket
            if (ticketNotes) {
              setRevisionNote(ticketNotes);
            }
          }
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
  }, []);

  const isInactiveCredential = credentialStatus === 'Inactive';
  const isOnRecordUpdateRoute = location.pathname.endsWith('/record-update');

  const handleInactiveUpdateSubmissionSuccess = async () => {
    setRecordStatus('Pending');
    setRevisionNote(null);
    navigate('/');

    try {
      const { status, notes, ticketCreatedAt } = await checkInitialRecordStatus();
      if (status) {
        setRecordStatus(status);
      }
      setInactiveTicketCreatedAt(ticketCreatedAt || null);
      if (status === 'Revision' && notes) {
        setRevisionNote(notes);
      }
    } catch (error) {
      console.error('[Dashboard] Error refreshing inactive update status:', error);
    }
  };

  // Handle successful completion of initial record
  const handleInitialRecordComplete = async (result) => {
    console.log('[Dashboard] Initial record completed:', result);
    // Set pending status optimistically so the approval screen shows immediately
    // without waiting for the API round-trip
    setRecordStatus('Pending');
    setIsVerified(false);
    setShowInitialRecordModal(false);
    
    // Refresh the status in the background to confirm the actual value
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

  if (isInactiveCredential && !isOnRecordUpdateRoute) {
    const INACTIVE_TICKET_EXPIRY_DAYS = 7;
    const hasSubmittedInactiveUpdate = recordStatus === 'Pending' || recordStatus === 'RevisionSubmitted';
    const needsInactiveRevision = recordStatus === 'Revision';
    const createdAtDate = inactiveTicketCreatedAt ? new Date(inactiveTicketCreatedAt) : null;
    const expiryDate = createdAtDate && !Number.isNaN(createdAtDate.getTime())
      ? new Date(createdAtDate.getTime() + INACTIVE_TICKET_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      : null;
    const expiryLabel = expiryDate && !Number.isNaN(expiryDate.getTime())
      ? expiryDate.toLocaleDateString()
      : null;

    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-2xl mx-auto px-4">
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-secondary-900 mb-3">
                {needsInactiveRevision
                  ? 'Medical and Dental Revision Required'
                  : hasSubmittedInactiveUpdate
                    ? 'Medical and Dental Update Submitted'
                    : 'Account Inactive - Update Required'}
              </h2>

              <p className="text-secondary-700 mb-6 text-lg">
                {needsInactiveRevision
                  ? 'Your update needs revision before your account can be reactivated.'
                  : hasSubmittedInactiveUpdate
                    ? 'Your update is pending staff review. Your account remains inactive until approval.'
                    : 'Your account is currently inactive. Submit your medical and dental updates to request reactivation.'}
              </p>

              {revisionNote && needsInactiveRevision && (
                <div className="bg-white rounded-lg p-4 mb-6 border border-yellow-200 text-left">
                  <p className="text-sm font-semibold text-secondary-900 mb-1">Staff Notes</p>
                  <p className="text-sm text-secondary-700 whitespace-pre-wrap">{revisionNote}</p>
                </div>
              )}

              <div className="bg-white rounded-lg p-6 mb-6">
                <p className="text-secondary-600 mb-4">
                  <strong className="text-secondary-900">What happens next?</strong>
                </p>
                <ul className="text-left text-secondary-600 space-y-3">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Medical and dental sections must be completed before reactivation</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Personal profile fields are locked during inactive recovery mode</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Your account stays inactive until staff approves the submitted update</span>
                  </li>
                </ul>
              </div>

              <div className="inline-flex items-center px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                {needsInactiveRevision
                  ? 'Status: Revision Required'
                  : hasSubmittedInactiveUpdate
                    ? 'Status: Pending Inactive Review'
                    : 'Status: Inactive'}
              </div>

              <p className="text-sm text-secondary-500 mt-4">
                {expiryLabel
                  ? `Ticket timing: In-progress updates expire after ${INACTIVE_TICKET_EXPIRY_DAYS} days (current window ends on ${expiryLabel}). Please visit the clinic for in-person checking after submission.`
                  : `Ticket timing: In-progress updates expire after ${INACTIVE_TICKET_EXPIRY_DAYS} days. Please visit the clinic for in-person checking after submission.`}
              </p>

              {(needsInactiveRevision || !hasSubmittedInactiveUpdate) && (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => navigate('/record-update')}
                    className="px-5 py-2.5 rounded-lg font-semibold bg-primary-500 hover:bg-primary-600 text-white transition-colors"
                  >
                    {needsInactiveRevision ? 'Continue Required Record Revision' : 'Start Required Record Update'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Show revision-submitted screen ONLY for unverified patients waiting for initial record approval
  // Verified patients with pending revisions should still access dashboard normally
  if (recordStatus === 'RevisionSubmitted' && isVerified === false) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-2xl mx-auto px-4">
            <div className="bg-accent-50 border-2 border-accent-200 rounded-lg p-8 text-center">
              {/* Icon */}
              <div className="mx-auto w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-secondary-900 mb-3">
                Revision Submitted Successfully
              </h2>

              {/* Message */}
              <p className="text-secondary-700 mb-6 text-lg">
                Your revised medical record has been submitted and is now awaiting re-review by the medical staff.
              </p>

              <div className="bg-white rounded-lg p-6 mb-6">
                <p className="text-secondary-600 mb-4">
                  <strong className="text-secondary-900">What happens next?</strong>
                </p>
                <ul className="text-left text-secondary-600 space-y-3">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-accent-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Our medical staff will review your revised submission</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-accent-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>You'll be notified once your record is approved or if further corrections are needed</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-accent-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Once approved, you'll have full access to the dashboard and all services</span>
                  </li>
                </ul>
              </div>

              {/* Status Badge */}
              <div className="inline-flex items-center px-4 py-2 bg-accent-100 text-accent-800 rounded-full font-medium">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Status: Revision Submitted — Awaiting Review
              </div>

              <p className="text-sm text-secondary-500 mt-6">
                Thank you for updating your record. A staff member will review it shortly.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Show pending approval screen ONLY for unverified patients waiting for initial record approval
  // Verified patients with pending updates should still access dashboard normally
  if (recordStatus === 'Pending' && isVerified === false) {
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
      {/* Initial Medical Record Modal - Renders employee or student form based on email */}
      <InitialRecordModal 
        isOpen={showInitialRecordModal}
        onComplete={handleInitialRecordComplete}
        isRevision={recordStatus === 'Revision'}
        revisionNote={revisionNote}
      >
        {isEmployee ? (
          <InitialEmployeeRecordForm
            isModal={true}
            onComplete={handleInitialRecordComplete}
            revisionData={revisionData}
            isRevision={recordStatus === 'Revision'}
            staffNote={revisionNote}
          />
        ) : (
          <InitialMedicalRecordForm
            isModal={true}
            onComplete={handleInitialRecordComplete}
            revisionData={revisionData}
            isRevision={recordStatus === 'Revision'}
            staffNote={revisionNote}
          />
        )}
      </InitialRecordModal>

      <Layout>
        {isInactiveCredential && isOnRecordUpdateRoute && (
          <div className="mx-4 mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
            <p className="text-sm font-semibold text-yellow-800">Inactive Account Recovery Mode</p>
            <p className="text-xs text-yellow-700 mt-1">
              Complete your medical and dental updates before staff re-checking and approval. Personal information is read-only in this mode.
            </p>
          </div>
        )}
        <ErrorBoundary>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<DashboardHome firstName={firstName} />} />
              <Route
                path="/record-update"
                element={(
                  <RecordUpdateForm
                    forceRecordType={isInactiveCredential ? 'both' : null}
                    hideRecordChoice={isInactiveCredential}
                    skipPersonalStep={isInactiveCredential}
                    skipPersonalSubmit={isInactiveCredential}
                    onSubmissionSuccess={isInactiveCredential ? handleInactiveUpdateSubmissionSuccess : undefined}
                  />
                )}
              />
              <Route path="/appointments" element={<AppointmentPage />} />
              <Route path="/medicine-request" element={<MedicineRequestPage />} />
              <Route path="/health-chat" element={<HealthChat />} />
              <Route path="/my-documents" element={<MyDocumentsPage />} />
              <Route path="/settings" element={<PatientSettings />} />
              {/* Redirect old e-consultation path to new health-chat path */}
              <Route path="/e-consultation" element={<Navigate to="/health-chat" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </>
  );
};

export default Dashboard;