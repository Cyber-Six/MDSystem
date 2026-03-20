import React, { useState, useEffect } from 'react';
import { sendGraphQLRequest } from '../../utils/graphql-client';
import { getMyPersonalEmail } from '../../services/emr-service';
import RequestNotificationModal from './components/request-notification-modal';

const MedicineRequestPage = () => {
  // User info
  const [userEmail, setUserEmail] = useState('');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [assignedLocation, setAssignedLocation] = useState('');
  const [allowedLocations, setAllowedLocations] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    purpose: '',
    location: '',
    items: []
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMedicines, setIsLoadingMedicines] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Cancel-and-resubmit confirmation
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [pendingSubmitPayload, setPendingSubmitPayload] = useState(null);

  // Notification modal state - persist dismissed notifications in localStorage
  const [dismissedNotifications, setDismissedNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('dismissedMedicalNotifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [notificationRequest, setNotificationRequest] = useState(null);

  // Persist dismissed notifications to localStorage
  useEffect(() => {
    localStorage.setItem('dismissedMedicalNotifications', JSON.stringify(dismissedNotifications));
  }, [dismissedNotifications]);

  // Data
  const [availableMedicines, setAvailableMedicines] = useState([]);
  const [groupedMedicines, setGroupedMedicines] = useState({});
  const [requests, setRequests] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Track selected medicines by item_code
  const [selectedMedicinesByCode, setSelectedMedicinesByCode] = useState({});

  // Fetch user email and determine branch access on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      setIsLoadingUser(true);
      try {
        const email = await getMyPersonalEmail();
        if (email) {
          const lowerEmail = String(email).toLowerCase().trim();
          setUserEmail(lowerEmail);
          
          const prefix = lowerEmail.charAt(0);
          setEmailPrefix(prefix);
          
          // Determine location access based on email prefix
          if (prefix === 'm') {
            setAllowedLocations(['Arlegui', 'Casal']);
            setFormData(prev => ({ ...prev, location: '' })); // Let user choose
          } else if (prefix === 'q') {
            setAllowedLocations(['QuezonCity']);
            setAssignedLocation('QuezonCity');
            setFormData(prev => ({ ...prev, location: 'QuezonCity' })); // Auto-assign
          }
        }
      } catch (error) {
        console.error('Error fetching user email:', error);
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchUserInfo();
  }, []);

  // Fetch available medicines on mount and when location changes
  useEffect(() => {
    // Only fetch if user location is determined
    if (!assignedLocation && emailPrefix !== 'm') return;
    
    const fetchAvailableMedicines = async () => {
      setIsLoadingMedicines(true);
      setErrorMessage('');
      try {
        // Use assigned location for 'q' profile, or selected location for 'm' profile
        const locationFilter = assignedLocation || formData.location;
        
        if (!locationFilter) {
          setAvailableMedicines([]);
          setGroupedMedicines({});
          return;
        }

        const query = `
          query GetAvailableMedicine($location: LocationDesignation, $offset: Int, $limit: Int) {
            getAvailableMedicine(location: $location, offset: $offset, limit: $limit) {
              id
              batchId
              item_code
              item_name
              category
              dosageUnit
              dosageValue
            }
          }
        `;
        
        const data = await sendGraphQLRequest(
          query,
          { location: locationFilter, offset: 0, limit: 100 },
          { endpoint: '/medical-inventory/medicine-request/patient' }
        );
        
        const medicines = data.getAvailableMedicine || [];
        setAvailableMedicines(medicines);
        
        // Group medicines by item_code
        const grouped = {};
        medicines.forEach(medicine => {
          const code = medicine.item_code;
          if (!grouped[code]) {
            grouped[code] = {
              item_code: code,
              item_name: medicine.item_name,
              category: medicine.category,
              batches: []
            };
          }
          grouped[code].batches.push(medicine);
        });
        
        setGroupedMedicines(grouped);
      } catch (error) {
        console.error('Error fetching medicines:', error);
        setErrorMessage('Failed to load available medicines. Please try again.');
      } finally {
        setIsLoadingMedicines(false);
      }
    };

    fetchAvailableMedicines();
  }, [assignedLocation, formData.location, emailPrefix]);

  // Fetch request history on mount
  useEffect(() => {
    const fetchRequestHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const query = `
          query GetMedicineStatus {
            getMedicineStatus {
              id
              patientId
              status
              purpose
              notes
              approved_by
              created_at
              items {
                id
                medicineId
                requestId
                quantity
              }
            }
          }
        `;
        
        const data = await sendGraphQLRequest(
          query,
          {},
          { endpoint: '/medical-inventory/medicine-request/patient' }
        );
        
        setRequests(data.getMedicineStatus || []);
      } catch (error) {
        console.error('Error fetching request history:', error);
        // Don't show error for history, just log it
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchRequestHistory();
  }, []);

  // Check for notification-worthy requests (approved/rejected)
  useEffect(() => {
    if (!requests || requests.length === 0) return;

    // Find first approved or rejected request that hasn't been dismissed
    const notificationReq = requests.find((r) => {
      const status = r.status?.toLowerCase();
      const isNotificationStatus = status === 'approved' || status === 'rejected';
      const isNotDismissed = !dismissedNotifications.includes(r.id);
      return isNotificationStatus && isNotDismissed;
    });

    setNotificationRequest(notificationReq || null);
  }, [requests, dismissedNotifications]);

  const handleDismissNotification = () => {
    if (notificationRequest) {
      setDismissedNotifications([...dismissedNotifications, notificationRequest.id]);
      setNotificationRequest(null);
    }
  };

  const handleMedicineToggle = (itemCode, medicineGroup) => {
    const isSelected = formData.items.some(item => item.itemCode === itemCode);
    
    if (isSelected) {
      // Remove medicine
      setFormData({
        ...formData,
        items: formData.items.filter(item => item.itemCode !== itemCode)
      });
      const newSelected = { ...selectedMedicinesByCode };
      delete newSelected[itemCode];
      setSelectedMedicinesByCode(newSelected);
    } else {
      // Add medicine with quantity of 1 (fixed)
      setFormData({
        ...formData,
        items: [...formData.items, { itemCode, quantity: 1 }]
      });
      setSelectedMedicinesByCode({
        ...selectedMedicinesByCode,
        [itemCode]: medicineGroup
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    
    // Validate form
    if (!formData.purpose.trim()) {
      setErrorMessage('Please enter a purpose for your request');
      return;
    }
    
    if (formData.items.length === 0) {
      setErrorMessage('Please select at least one medicine');
      return;
    }
    
    // For 'm' prefix users, location must be selected
    if (emailPrefix === 'm' && !formData.location) {
      setErrorMessage('Please select a location/branch');
      return;
    }

    // Build the submission payload once (reused after confirmation if needed)
    let requestItems;
    try {
      requestItems = formData.items.map(item => {
        const medicineGroup = selectedMedicinesByCode[item.itemCode];
        // Use batchId from the first batch - backend returns mb.id AS "batchId"
        const medicineId = medicineGroup.batches[0]?.batchId;
        if (!medicineId) throw new Error(`No available batch for ${medicineGroup.item_name}`);
        return { medicineId: parseInt(medicineId, 10), quantity: 1 };
      });
    } catch (error) {
      setErrorMessage(error.message);
      return;
    }

    // Check if there's already a pending request
    const hasPending = requests.some(
      (r) => r.status?.toLowerCase() === 'pending'
    );
    if (hasPending) {
      setPendingSubmitPayload({ requestItems });
      setShowCancelConfirm(true);
      return;
    }

    await submitRequest(requestItems);
  };

  const cancelPendingAndResubmit = async () => {
    if (!pendingSubmitPayload) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      // Use the cancelMedicineRequest mutation which handles the pending request directly
      const cancelMutation = `
        mutation CancelMedicineRequest {
          cancelMedicineRequest {
            id
            status
          }
        }
      `;
      const cancelResult = await sendGraphQLRequest(
        cancelMutation,
        {},
        { endpoint: '/medical-inventory/medicine-request/patient' }
      );

      // Verify the cancel actually worked
      if (!cancelResult?.cancelMedicineRequest) {
        setErrorMessage(
          'Your pending request cannot be cancelled online. Please contact clinic staff to cancel your existing request before submitting a new one.'
        );
        setShowCancelConfirm(false);
        setIsSubmitting(false);
        setPendingSubmitPayload(null);
        return;
      }

      // Update local state to reflect cancelled
      setRequests((prev) =>
        prev.map((r) =>
          r.id === cancelResult.cancelMedicineRequest.id ? { ...r, status: 'Cancelled' } : r
        )
      );

      // Close modal and proceed with new submission
      setShowCancelConfirm(false);
      await submitRequest(pendingSubmitPayload.requestItems);
    } catch (error) {
      console.error('Error cancelling and resubmitting:', error);
      setErrorMessage(
        error.message || 'Unable to cancel your existing request. Please contact clinic staff to cancel your pending request before submitting a new one.'
      );
      setShowCancelConfirm(false);
    } finally {
      setIsSubmitting(false);
      setPendingSubmitPayload(null);
    }
  };

  const submitRequest = async (requestItems) => {
    setIsSubmitting(true);
    try {
      const mutation = `
        mutation CreateMedicineRequest($input: CreateMedicineRequestInput!) {
          createMedicineRequest(input: $input) {
            id
            patientId
            status
            purpose
            created_at
            items {
              id
              medicineId
              quantity
            }
          }
        }
      `;
      
      const data = await sendGraphQLRequest(
        mutation,
        {
          input: {
            purpose: formData.purpose,
            location: formData.location,
            items: requestItems
          }
        },
        { endpoint: '/medical-inventory/medicine-request/patient' }
      );
      
      // Add new request to history
      setRequests([data.createMedicineRequest, ...requests]);
      
      // Reset form
      setFormData({
        purpose: '',
        location: assignedLocation || '',
        items: []
      });
      setSelectedMedicinesByCode({});
      
      setSuccessMessage('Medicine request submitted successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error submitting request:', error);
      setErrorMessage(error.message || 'Error submitting request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case 'inprogress':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'approved':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'rejected':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      case 'revision':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
      case 'revisionsubmitted':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
      case 'cancelled':
        return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300';
      case 'expired':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default:
        return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300';
    }
  };

  const getMedicineDisplayText = (itemCode) => {
    const medicine = selectedMedicinesByCode[itemCode];
    if (!medicine) return 'Unknown';
    return `${medicine.item_name}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp * 1000).toLocaleDateString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* Request Notification Modal */}
      <RequestNotificationModal request={notificationRequest} onDismiss={handleDismissNotification} batches={availableMedicines} />

      {/* Cancel-and-Resubmit Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">You have a pending request</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                  You already have a <span className="font-semibold text-yellow-600 dark:text-yellow-400">pending medicine request</span> that has not been processed yet.
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                  Would you like to <span className="font-semibold text-red-600 dark:text-red-400">cancel the existing request</span> and submit this new one instead?
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2">
                  Note: If cancellation fails, please contact clinic staff directly.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => { setShowCancelConfirm(false); setPendingSubmitPayload(null); }}
                className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              >
                Keep Old Request
              </button>
              <button
                onClick={cancelPendingAndResubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Cancel Old &amp; Submit New
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Show loading while fetching user info */}
      {isLoadingUser ? (
        <div className="text-center py-12">
          <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-neutral-600 dark:text-neutral-400">Loading your profile...</p>
        </div>
      ) : (
        <>
      {/* Header Banner */}
      <div className="rounded-2xl p-6 mb-6 bg-primary-500">
        <div className="flex items-center gap-4">
          <div className="w-10 h-12 rounded-xl bg-white/25 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-heading font-bold text-white" style={{ margin: 0 }}>Medicine Request</h1>
            <p className="text-white/80 text-sm mt-1" style={{ margin: 0 }}>Request medicines from the clinic</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Request Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-stone-200 dark:border-neutral-700 p-6">
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-white mb-6" style={{ margin: 0 }}>
              New Medicine Request
            </h2>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{errorMessage}</p>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Purpose */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Medical Condition / Purpose *
                </label>
                <textarea
                  required
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  rows="2"
                  placeholder="E.g., Headache, Fever, Cold symptoms, etc."
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg 
                           bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Location */}
              {emailPrefix === 'q' ? (
                // QuezonCity user: auto-assigned, no choice
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Branch / Location
                  </label>
                  <div className="px-4 py-3 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">QuezonCity</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Automatically assigned based on your profile</p>
                  </div>
                </div>
              ) : emailPrefix === 'm' ? (
                // Makati user: choose between Arlegui or Casal
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Location / Branch *
                  </label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {allowedLocations.map(loc => (
                      <label key={loc} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          required
                          type="radio"
                          name="location"
                          value={loc}
                          checked={formData.location === loc}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className="w-4 h-4 text-primary-600"
                        />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">{loc}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}



              {/* Medicine Selection */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                  Select Medicines (Maximum 2) * {isLoadingMedicines && <span className="text-xs text-neutral-500">(Loading...)</span>}
                </label>
                
                {isLoadingMedicines ? (
                  <div className="p-8 text-center text-neutral-500">
                    <svg className="animate-spin h-6 w-6 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading available medicines...
                  </div>
                ) : Object.keys(groupedMedicines).length === 0 ? (
                  <div className="p-6 text-center text-neutral-500 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                    No medicines available at this time. Please try again later.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                    {Object.values(groupedMedicines).map((medicineGroup) => {
                      const itemCode = medicineGroup.item_code;
                      const isSelected = formData.items.some(item => item.itemCode === itemCode);
                      const selectedCount = formData.items.length;
                      const canSelect = isSelected || selectedCount < 2;
                      
                      return (
                        <div key={itemCode} className="space-y-2">
                          <label className="flex items-start space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!canSelect}
                              onChange={() => {
                                if (isSelected) {
                                  handleMedicineToggle(itemCode, medicineGroup);
                                } else if (canSelect) {
                                  handleMedicineToggle(itemCode, medicineGroup);
                                }
                              }}
                              className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500 mt-1 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <div className="text-sm text-neutral-700 dark:text-neutral-300">
                              <div className="font-medium">{medicineGroup.item_name}</div>
                              {!canSelect && !isSelected && (
                                <div className="text-xs text-red-600 dark:text-red-400">Maximum 2 medicines reached</div>
                              )}
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Medicines Summary */}
              {formData.items.length > 0 && (
                <div className="p-4 bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800 rounded-lg">
                  <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-100 mb-2">Selected Medicines ({formData.items.length}/2)</h3>
                  <ul className="space-y-1 text-sm text-primary-700 dark:text-primary-300">
                    {formData.items.map((item) => (
                      <li key={item.itemCode}>• {getMedicineDisplayText(item.itemCode)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || formData.items.length === 0}
                className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg 
                         transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Medicine Request</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Info Card */}
        <div>
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100 mb-4" style={{ margin: 0 }}>
              Request Guidelines
            </h3>
            <ul className="space-y-3 text-sm text-primary-700 dark:text-primary-300">
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>You can request a maximum of 2 different medicines per request</span>
              </li>

              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Requests must be approved by medical staff before dispensing</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>You can only have one pending request at a time</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Bring your ID when claiming approved medicines</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Processing time is typically 1-2 business days</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Request History */}
      <div className="mt-8 bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-stone-200 dark:border-neutral-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-6 rounded-full bg-primary-500"></div>
          <h2 className="text-xl font-semibold text-secondary-900 dark:text-white" style={{ margin: 0 }}>
            Request History
          </h2>
        </div>

        {isLoadingHistory ? (
          <div className="p-8 text-center text-neutral-500">
            <svg className="animate-spin h-6 w-6 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading request history...
          </div>
        ) : requests.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Purpose</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Items</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((request) => (
                    <tr key={request.id} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">{formatDate(request.created_at)}</td>
                      <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">{request.purpose}</td>
                      <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">
                        {request.items?.length || 0} item(s)
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          {request.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {Math.ceil(requests.length / itemsPerPage) > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs font-medium border border-neutral-300 dark:border-neutral-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: Math.ceil(requests.length / itemsPerPage) }, (_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      currentPage === i + 1
                        ? 'bg-primary-500 text-white'
                        : 'border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(requests.length / itemsPerPage), prev + 1))}
                  disabled={currentPage === Math.ceil(requests.length / itemsPerPage)}
                  className="px-3 py-1.5 text-xs font-medium border border-neutral-300 dark:border-neutral-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="mt-4 text-neutral-600 dark:text-neutral-400">No medicine requests yet. Submit your first request above!</p>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

export default MedicineRequestPage;
