import React, { useState, useEffect } from 'react';
import { sendGraphQLRequest } from '../../../utils/graphql-client';

/**
 * Request Notification Modal
 * Shows patient notifications when their medicine request is approved or rejected
 */
const RequestNotificationModal = ({ request, onDismiss, batches, groupedMedicines }) => {
  const [availableMedicines, setAvailableMedicines] = useState([]);
  
  // Fetch available medicines to look up names
  useEffect(() => {
    if (!request) return;
    
    const fetchMedicines = async () => {
      try {
        const query = `
          query GetAvailableMedicine($location: LocationDesignation, $offset: Int, $limit: Int) {
            getAvailableMedicine(location: $location, offset: $offset, limit: $limit) {
              id
              item_code
              item_name
              category
            }
          }
        `;
        
        const data = await sendGraphQLRequest(
          query,
          { location: null, offset: 0, limit: 200 },
          { endpoint: '/medical-inventory/medicine-request/patient' }
        );
        
        setAvailableMedicines(data.getAvailableMedicine || []);
      } catch (error) {
        console.error('Error fetching available medicines:', error);
      }
    };
    
    fetchMedicines();
  }, [request?.id]);
  
  if (!request) return null;

  const isApproved = request.status?.toLowerCase() === 'approved';
  const isRejected = request.status?.toLowerCase() === 'rejected';

  if (!isApproved && !isRejected) return null;

  // Look up medicine name from request items first
  let itemName = 'Your medicine';
  
  // Try to get from items array
  if (request.items?.[0]) {
    const firstItem = request.items[0];
    // Check if item has item details directly
    if (firstItem.itemName) {
      itemName = firstItem.itemName;
    } else {
      const medicineId = firstItem.medicineId;
      const batchId = firstItem.batchId;
      
      // Try to find from availableMedicines (most reliable source)
      const medicine = availableMedicines?.find((m) => 
        String(m.id) === String(batchId) || 
        String(m.id) === String(medicineId) ||
        String(m.batchId) === String(medicineId)
      );
      if (medicine?.item_name) {
        itemName = medicine.item_name;
      } else {
        // Try from batches using medicineId or batchId
        const batch = batches?.find((b) => 
          String(b.id) === String(batchId) || 
          String(b.medicalItemId) === String(medicineId) ||
          String(b.id) === String(medicineId)
        );
        if (batch?.item_name) {
          itemName = batch.item_name;
        } else {
          // Try from groupedMedicines (has item_code -> medicine group mapping)
          if (groupedMedicines && Object.values(groupedMedicines).length > 0) {
            const medicineGroup = Object.values(groupedMedicines).find(m =>
              m.batches?.some(b => 
                String(b.id) === String(medicineId) || 
                String(b.id) === String(batchId)
              )
            );
            if (medicineGroup?.item_name) {
              itemName = medicineGroup.item_name;
            }
          }
        }
      }
    }
  }
  
  const purpose = request.purpose || 'Medicine request';
  const notes = request.notes || '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-2xl max-w-lg w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {isApproved ? (
            <>
              <div className="w-10 h-10 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-success-700 dark:text-success-400">Request Approved</h2>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-error-700 dark:text-error-400">Request Rejected</h2>
            </>
          )}
        </div>

        {/* Content */}
        <div className="space-y-3 mb-5">
          {/* Status Message */}
          <p className="text-sm text-secondary-700 dark:text-neutral-300">
            {isApproved
              ? `Your medicine request for ${itemName} has been approved. You may now proceed to the clinic to collect your medicine.`
              : `Your medicine request for ${itemName} has been rejected.`}
          </p>

          {/* Request Details */}
          <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Request ID</span>
              <span className="text-xs font-mono text-secondary-700 dark:text-neutral-300">#{request.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Medicine</span>
              <span className="text-xs font-medium text-secondary-700 dark:text-neutral-300">{itemName}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Purpose</span>
              <span className="text-xs text-secondary-700 dark:text-neutral-300 break-words">{purpose}</span>
            </div>
          </div>

          {/* Notes */}
          {notes && (
            <div className={`border rounded-lg p-3 ${
              isApproved
                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-900/50'
                : 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-900/50'
            }`}>
              <p className={`text-[10px] uppercase tracking-wider font-medium mb-2 ${
                isApproved
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-error-600 dark:text-error-400'
              }`}>
                {isApproved ? 'Staff Notes' : 'Reason'}
              </p>
              <p className={`text-xs break-words whitespace-pre-wrap ${
                isApproved
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-error-700 dark:text-error-300'
              }`}>
                {notes}
              </p>
            </div>
          )}

          {/* Pickup Instructions */}
          {isApproved && (
            <div className="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-900/50 rounded-lg p-3">
              <p className="text-xs text-success-700 dark:text-success-300">
                Please visit the clinic during business hours to collect your medicine. Bring your patient ID for verification.
              </p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={onDismiss}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};

export default RequestNotificationModal;
