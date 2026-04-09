import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { fetchAvailableMedicineWithQuantities } from '../../prescription-service';
import { issuePrescription } from '../../prescription-service';
import { searchPatientsForInventory, formatInventoryPatientLabel } from '../../services/inventory-patient-search';
import { useStaffProfile } from '../../../../hooks/use-staff-profile';
import BatchSelectionModal from './batch-selection-modal';

/**
 * Direct Release Component
 * Allows staff to release medicine to patients without a prior request
 * Features:
 * - Patient search by name or ID
 * - Medicine selection with quantity input
 * - Immediate release without patient request approval
 */
const DirectRelease = ({ location, onRelease, onShowSuccess, onShowError, allRequests = [] }) => {
  const { profile, isLoading: isProfileLoading } = useStaffProfile();

  // Patient search state
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Medicine state
  const [medicines, setMedicines] = useState([]);
  const [loadingMedicines, setLoadingMedicines] = useState(false);

  // Release items state
  const [releaseItems, setReleaseItems] = useState([]); // Array of { medicineId, batchId, itemName, quantity, dosageUnit, dosageValue }
  const [isReleasing, setIsReleasing] = useState(false);

  // Notes
  const [notes, setNotes] = useState('');

  // History state - persisted to localStorage
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('mds_direct_release_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // History pagination
  const [historyPage, setHistoryPage] = useState(1);
  const historyPerPage = 10;

  // Batch selection modal state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchModalData, setBatchModalData] = useState(null); // { medicine, batches, medicineItem }

  // Notes viewing modal state
  const [viewNotesData, setViewNotesData] = useState(null); // { notes, medicineName, patientName }

  // Patient search function — uses staff REST endpoints (no EMR permission needed)
  const handlePatientSearch = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    // Profile must be loaded to know which branch the staff belongs to.
    // Without it we cannot pass the correct branch param and the backend
    // will return 403 regardless of what we send.
    if (!profile?.branch) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const patients = await searchPatientsForInventory(query, profile.branch);
      const formatted = patients.map((p) => ({
        id: p.id,
        name: p.name,
        identifier: p.identifier,
        email: p.email,
        profileLabel: formatInventoryPatientLabel(p),
      }));
      setSearchResults(formatted);
    } catch (err) {
      console.error('Patient search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [profile?.branch]);

  // Load medicines for the current location
  useEffect(() => {
    const loadMedicines = async () => {
      if (!location) return;

      setLoadingMedicines(true);
      try {
        const availableMedicines = await fetchAvailableMedicineWithQuantities(location, 0, 100);
        setMedicines(availableMedicines || []);
      } catch (err) {
        console.error('Failed to load medicines:', err);
        onShowError('Failed to load available medicines');
      } finally {
        setLoadingMedicines(false);
      }
    };

    loadMedicines();
  }, [location, onShowError]);

  // Handle patient selection
  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearchResults([]);
    setSearchInput('');
    setReleaseItems([]); // Reset release items when new patient is selected
    setNotes('');
  };

  // Compute total reserved quantity for a medicine item across all Approved/InProgress requests.
  const getReservedQuantityForItem = useCallback((itemId) => {
    if (!itemId) return 0;
    const reservedStatuses = ['Approved', 'InProgress'];
    return (allRequests || [])
      .filter((r) =>
        reservedStatuses.includes(r.status) &&
        (!location || r.location === location)
      )
      .reduce((total, r) => {
        return total + (r.items || []).reduce((itemTotal, item, idx) => {
          const rItemId = String(item.itemId || item.medicineId || '');
          if (rItemId === String(itemId)) {
            const qty = r.approvedQuantities?.[idx] != null
              ? Number(r.approvedQuantities[idx])
              : Number(item.quantity || 0);
            return itemTotal + qty;
          }
          return itemTotal;
        }, 0);
      }, 0);
  }, [allRequests, location]);

  // Handle adding medicine to release
  const handleAddMedicine = (medicine) => {
    // Check if already added (any batch of this medicine)
    const existingItem = releaseItems.find((item) => item.itemName === medicine.item_name);
    if (existingItem) {
      onShowError('This medicine is already in the list');
      return;
    }

    const reserved = getReservedQuantityForItem(medicine.id);

    // If multiple batches exist, show batch selection modal
    if (medicine.totalBatches > 1) {
      // Pre-adjust batch quantities to reflect reservations
      const adjustedBatches = medicine.allBatches.map((batch) => ({
        ...batch,
        availableQuantity: Math.max(0, (batch.availableQuantity || 0) - reserved),
      }));
      setBatchModalData({
        medicine: medicine,
        batches: adjustedBatches,
      });
      setShowBatchModal(true);
    } else {
      // Single batch - adjust for reservations, then add directly
      addMedicineToRelease({
        ...medicine,
        availableQuantity: Math.max(0, (medicine.availableQuantity || 0) - reserved),
      });
    }
  };

  // Helper function to add medicine to release items
  const addMedicineToRelease = (selectedBatch) => {
    setReleaseItems([
      ...releaseItems,
      {
        batchId: selectedBatch.batchId,
        medicineId: selectedBatch.id,
        itemName: selectedBatch.item_name,
        quantity: 1,
        dosageUnit: selectedBatch.dosageUnit,
        dosageValue: selectedBatch.dosageValue,
        batchNumber: selectedBatch.batchNumber,
        category: selectedBatch.category,
        expiryDate: selectedBatch.expiryDate,
        availableQuantity: selectedBatch.availableQuantity || 0,
      },
    ]);
  };

  // Handle batch selection from modal
  const handleBatchSelected = (batch) => {
    addMedicineToRelease(batch);
    setShowBatchModal(false);
    setBatchModalData(null);
  };

  // Handle quantity update - with validation against available quantity
  const handleUpdateQuantity = (batchId, quantity) => {
    const numQuantity = parseInt(quantity, 10) || 0;
    if (numQuantity < 0) return;

    // Find the item to check available quantity
    const item = releaseItems.find((i) => i.batchId === batchId);
    if (item && numQuantity > item.availableQuantity) {
      onShowError(
        `Only ${item.availableQuantity} units available for ${item.itemName}`
      );
      return;
    }

    setReleaseItems((prev) =>
      prev.map((item) =>
        item.batchId === batchId ? { ...item, quantity: numQuantity } : item
      )
    );
  };

  // Handle removing medicine from release
  const handleRemoveMedicine = (batchId) => {
    setReleaseItems((prev) => prev.filter((item) => item.batchId !== batchId));
  };

  // Handle release medicine
  const handleReleaseMedicine = async () => {
    if (!selectedPatient) {
      onShowError('Please select a patient');
      return;
    }

    if (releaseItems.length === 0) {
      onShowError('Please add at least one medicine to release');
      return;
    }

    // Validate quantities
    const hasInvalidQuantity = releaseItems.some((item) => item.quantity <= 0);
    if (hasInvalidQuantity) {
      onShowError('All medicines must have a quantity greater than 0');
      return;
    }

    // Validate that quantities don't exceed available quantity
    const hasExceededQuantity = releaseItems.some(
      (item) => item.quantity > (item.availableQuantity || 0)
    );
    if (hasExceededQuantity) {
      onShowError('One or more medicines exceed available quantity');
      return;
    }

    setIsReleasing(true);
    try {
      // Prepare items for API call - convert to integers
      const items = releaseItems.map((item) => ({
        batchId: parseInt(item.batchId, 10),
        quantity: parseInt(item.quantity, 10),
      }));

      // Call issuePrescription mutation with patientId as integer
      const result = await issuePrescription({
        patientId: parseInt(selectedPatient.id, 10),
        items: items,
        notes: notes || `Direct release by staff`,
      });

      // Show success
      const totalQuantity = releaseItems.reduce((sum, item) => sum + item.quantity, 0);
      const detailsText = `Transaction ID: ${result.id} · ${releaseItems.length} item(s) released`;
      
      onShowSuccess(
        'Medicine Released',
        `Successfully released ${totalQuantity} unit(s) to ${selectedPatient.name}`,
        detailsText
      );

      // Add to history
      const historyRecords = releaseItems.map((item) => ({
        id: `${result.id}_${item.batchId}`,
        transactionId: result.id,
        patientName: selectedPatient.name,
        patientId: selectedPatient.id,
        medicineName: item.itemName,
        quantity: item.quantity,
        dosageUnit: item.dosageUnit,
        dosageValue: item.dosageValue,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        branch: location,
        timestamp: new Date().toISOString(),
        notes: notes || 'Direct release by staff (FEFO)',
      }));

      setHistory((prev) => {
        const updated = [...historyRecords, ...prev].slice(0, 100); // Keep last 100 records
        try {
          localStorage.setItem('mds_direct_release_history', JSON.stringify(updated));
        } catch {
          /* ignore */
        }
        return updated;
      });

      // Reset form
      setSelectedPatient(null);
      setReleaseItems([]);
      setNotes('');
      setSearchInput('');

      // Callback for parent component
      if (onRelease) {
        onRelease(result);
      }
    } catch (err) {
      console.error('Release error:', err);
      onShowError(err.message || 'Failed to release medicine');
    } finally {
      setIsReleasing(false);
    }
  };

  // Filter and group medicines by item_name (consolidate batches into single row)
  const availableMedicines = useMemo(() => {
    const selectedBatchIds = new Set(releaseItems.map((item) => item.batchId));
    const unselectedMedicines = medicines.filter((m) => !selectedBatchIds.has(m.batchId));
    
    // Group by item_name
    const medicinesMap = new Map();
    unselectedMedicines.forEach((medicine) => {
      const key = medicine.item_name;
      if (!medicinesMap.has(key)) {
        medicinesMap.set(key, []);
      }
      medicinesMap.get(key).push(medicine);
    });
    
    // Convert to array: one entry per medicine name with reference to first batch
    // (handleAddMedicine will check for multiple batches and show modal)
    return Array.from(medicinesMap.values()).map((batches) => {
      // Sort by expiry date (FEFO - earliest first)
      const sorted = batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
      const fefoFirst = sorted[0]; // Earliest expiry batch
      return {
        ...fefoFirst,
        totalBatches: batches.length,
        allBatches: batches,
      };
    });
  }, [medicines, releaseItems]);

  // Calculate pagination for history
  const historyPagination = useMemo(() => {
    const totalPages = Math.ceil(history.length / historyPerPage);
    const startIdx = (historyPage - 1) * historyPerPage;
    const endIdx = startIdx + historyPerPage;
    const paginatedHistory = history.slice(startIdx, endIdx);
    return {
      totalPages,
      currentPage: historyPage,
      paginatedHistory,
      startIdx: startIdx + 1,
      endIdx: Math.min(endIdx, history.length),
      totalRecords: history.length,
    };
  }, [history, historyPage, historyPerPage]);

  return (
    <div className="space-y-3">
      {/* Batch Selection Modal */}
      {showBatchModal && batchModalData && (
        <BatchSelectionModal
          medicine={batchModalData.medicine}
          batches={batchModalData.batches}
          onSelect={handleBatchSelected}
          onCancel={() => {
            setShowBatchModal(false);
            setBatchModalData(null);
          }}
        />
      )}

      {/* Notes Viewing Modal */}
      {viewNotesData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-2xl max-w-md w-full">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-700 dark:to-neutral-700 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-secondary-900 dark:text-white">Release Notes</h2>
                <p className="text-[11px] text-secondary-500 dark:text-neutral-400 leading-none mt-0.5">
                  {viewNotesData.medicineName} • {viewNotesData.patientName}
                </p>
              </div>
              <button
                onClick={() => setViewNotesData(null)}
                className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4">
              <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-3 border border-neutral-200 dark:border-neutral-600">
                <p className="text-sm text-secondary-800 dark:text-neutral-300 whitespace-pre-wrap break-words">
                  {viewNotesData.notes}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-700/30 border-t border-neutral-200 dark:border-neutral-700 flex justify-end">
              <button
                onClick={() => setViewNotesData(null)}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Patient Selection */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {/* Card Header */}
        <div className="bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-700 dark:to-neutral-700 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center text-[11px] font-bold">
              1
            </div>
            <div>
              <h3 className="text-sm font-bold text-secondary-900 dark:text-white">Search Patient</h3>
              <p className="text-[11px] text-secondary-500 dark:text-neutral-400">Find patient by name, email, or ID</p>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4">
          {!selectedPatient ? (
            <div className="space-y-3">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder={isProfileLoading ? 'Loading profile...' : 'Search patient by name, email, or ID...'}
                  disabled={isProfileLoading || !profile?.branch}
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    handlePatientSearch(e.target.value);
                  }}
                  className="w-full pl-9 pr-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {searchResults.length > 0 && (
                <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  {searchResults.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className="w-full px-3 py-2.5 text-left bg-white dark:bg-neutral-800 hover:bg-primary-50 dark:hover:bg-neutral-700/50 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-secondary-800 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400">
                            {patient.name}
                          </p>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400 space-y-0.5 mt-1">
                            {patient.identifier && <div>ID: {patient.identifier}</div>}
                            {patient.profileLabel && <div className="text-[10px]">{patient.profileLabel}</div>}
                          </div>
                        </div>
                        {patient.email && (
                          <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate max-w-xs">
                            {patient.email}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchInput && searchResults.length === 0 && !isSearching && (
                <div className="text-center py-4 px-3 bg-neutral-50 dark:bg-neutral-700/30 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600">
                  <svg className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">No patients found</p>
                </div>
              )}

              {isSearching && (
                <div className="flex items-center justify-center gap-2 py-3">
                  <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Searching...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-primary-900 dark:text-primary-100">{selectedPatient.name}</p>
                  <p className="text-xs text-primary-600 dark:text-primary-300">ID: {selectedPatient.identifier || selectedPatient.id}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedPatient(null);
                  setReleaseItems([]);
                  setNotes('');
                }}
                className="px-3 py-1 text-xs font-medium text-primary-600 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-lg transition-colors"
              >
                Change
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Select Medicines */}
      {selectedPatient && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-700 dark:to-neutral-700 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-500 text-white flex items-center justify-center text-[11px] font-bold">
                2
              </div>
              <div>
                <h3 className="text-sm font-bold text-secondary-900 dark:text-white">Select Medicines</h3>
                <p className="text-[11px] text-secondary-500 dark:text-neutral-400">{availableMedicines.length} available for this location</p>
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-4">
            {loadingMedicines ? (
              <div className="flex items-center justify-center gap-2 py-6">
                <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading medicines...</p>
              </div>
            ) : availableMedicines.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {availableMedicines.map((medicine) => (
                  <div
                    key={`${medicine.item_name}-${medicine.batchId}`}
                    className="flex items-center justify-between px-3 py-2.5 bg-neutral-50 dark:bg-neutral-700/30 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-700 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary-800 dark:text-white truncate">
                        {medicine.item_name}
                      </p>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        <span className="inline-block">{medicine.dosageValue} {medicine.dosageUnit}</span>
                        {medicine.totalBatches > 1 && (
                          <>
                            <span className="mx-1.5">•</span>
                            <span className="inline-block bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 px-1.5 py-0.5 rounded text-[10px] font-medium">
                              {medicine.totalBatches} batches (FEFO)
                            </span>
                          </>
                        )}
                        {medicine.totalBatches === 1 && (
                          <>
                            <span className="mx-1.5">•</span>
                            <span className="inline-block text-[10px]">Batch: {medicine.batchNumber}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddMedicine(medicine)}
                      className="ml-2 flex-shrink-0 px-2.5 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m0 0h6m-6-6H6m0 0H0" />
                      </svg>
                      Add
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 px-4 bg-neutral-50 dark:bg-neutral-700/30 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600">
                <svg className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">No medicines available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Release Items */}
      {releaseItems.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-700 dark:to-neutral-700 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-success-500 text-white flex items-center justify-center text-[11px] font-bold">
                3
              </div>
              <div>
                <h3 className="text-sm font-bold text-secondary-900 dark:text-white">Review & Release</h3>
                <p className="text-[11px] text-secondary-500 dark:text-neutral-400">{releaseItems.length} item(s) to be released</p>
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-4 space-y-3">
            {/* Items Table */}
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <div className="bg-neutral-50 dark:bg-neutral-700/50 px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 grid grid-cols-12 gap-2 text-[10px] font-bold text-secondary-600 dark:text-neutral-400 uppercase tracking-wider">
                <div className="col-span-5">Medicine</div>
                <div className="col-span-3 text-center">Qty</div>
                <div className="col-span-4 text-right">Action</div>
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {releaseItems.map((item) => {
                  const maxQuantity = item.availableQuantity || 0;
                  const isOverLimit = item.quantity > maxQuantity;

                  return (
                    <div
                      key={item.batchId}
                      className="px-3 py-2.5 grid grid-cols-12 gap-2 items-center hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors"
                    >
                      <div className="col-span-5">
                        <p className="text-sm font-medium text-secondary-800 dark:text-white truncate">
                          {item.itemName}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {item.dosageValue} {item.dosageUnit}
                        </p>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          Batch: {item.batchNumber}
                          {item.expiryDate && (
                            <>
                              {' '}
                              • Exp: {new Date(item.expiryDate).toLocaleDateString()}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="col-span-3 flex items-center justify-center">
                        <div className="flex flex-col items-center">
                          <input
                            type="number"
                            min="1"
                            max={maxQuantity}
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(item.batchId, e.target.value)}
                            className={`w-12 px-2 py-1 border rounded-lg bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white text-sm text-center focus:ring-2 focus:border-primary-500 transition-colors ${
                              isOverLimit
                                ? 'border-error-500 dark:border-error-500 focus:ring-error-500'
                                : 'border-neutral-300 dark:border-neutral-600 focus:ring-primary-500'
                            }`}
                          />
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                            Max: {maxQuantity}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveMedicine(item.batchId)}
                        className="col-span-4 justify-self-end px-2.5 py-1 text-xs font-medium text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-secondary-600 dark:text-neutral-400 uppercase tracking-wider mb-2">
                Additional Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this direct release (optional)..."
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                rows="2"
              />
            </div>

            {/* Release Button */}
            <button
              onClick={handleReleaseMedicine}
              disabled={isReleasing}
              className="w-full px-4 py-3 bg-success-600 hover:bg-success-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-600 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {isReleasing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Releasing Medicine...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Release Medicine to {selectedPatient?.name}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedPatient && (
        <div className="text-center py-12 px-6 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/50 dark:to-neutral-800/30 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600">
          <svg
            className="w-16 h-16 mx-auto mb-3 text-neutral-300 dark:text-neutral-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m0 0h6m-6-6H6m0 0H0" />
          </svg>
          <p className="text-base font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Ready to Release</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Search and select a patient to begin the medicine release process</p>
        </div>
      )}

      {/* Release History Section */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {/* Card Header */}
        <div className="bg-gradient-to-r from-neutral-50 to-neutral-100 dark:from-neutral-700 dark:to-neutral-700 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="text-sm font-bold text-secondary-900 dark:text-white">Release History</h3>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400">{history.length} total releases</p>
        </div>

        {/* Card Body */}
        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-700/50 border-b-2 border-neutral-200 dark:border-neutral-600">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-secondary-600 dark:text-neutral-400 uppercase tracking-wider">Patient</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-secondary-600 dark:text-neutral-400 uppercase tracking-wider">Medicine</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-secondary-600 dark:text-neutral-400 uppercase tracking-wider">Qty</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-secondary-600 dark:text-neutral-400 uppercase tracking-wider">Batch / Expiry</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-secondary-600 dark:text-neutral-400 uppercase tracking-wider">Branch</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-secondary-600 dark:text-neutral-400 uppercase tracking-wider">Notes</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-secondary-600 dark:text-neutral-400 uppercase tracking-wider">Date/Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {historyPagination.paginatedHistory.map((record, idx) => {
                  const date = new Date(record.timestamp);
                  const dateStr = date.toLocaleDateString();
                  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const displayLocation = record.branch === 'QuezonCity' ? 'Quezon City' : record.branch;
                  const expirySoon = record.expiryDate && new Date(record.expiryDate) - new Date() < 30 * 24 * 60 * 60 * 1000;
                  const isExpired = record.expiryDate && new Date(record.expiryDate) < new Date();

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-xs font-medium text-secondary-800 dark:text-white">{record.patientName}</td>
                      <td className="px-3 py-2.5 text-xs text-secondary-700 dark:text-neutral-300">
                        {record.medicineName}
                        {record.dosageValue && (
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 ml-1.5">
                            ({record.dosageValue} {record.dosageUnit})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold text-center text-secondary-800 dark:text-white bg-neutral-50 dark:bg-neutral-700/30">
                        {record.quantity}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-neutral-600 dark:text-neutral-400">
                        <div className="font-medium">{record.batchNumber}</div>
                        {record.expiryDate && (
                          <div className={`text-[10px] ${
                            isExpired 
                              ? 'text-error-600 dark:text-error-400' 
                              : expirySoon 
                              ? 'text-warning-600 dark:text-warning-400' 
                              : 'text-neutral-500 dark:text-neutral-500'
                          }`}>
                            {new Date(record.expiryDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-secondary-700 dark:text-neutral-300">{displayLocation}</td>
                      <td className="px-3 py-2.5 text-xs text-neutral-600 dark:text-neutral-400 max-w-xs">
                        {record.notes ? (
                          record.notes.length > 35 ? (
                            <button
                              onClick={() =>
                                setViewNotesData({
                                  notes: record.notes,
                                  medicineName: record.medicineName,
                                  patientName: record.patientName,
                                })
                              }
                              className="text-primary-600 dark:text-primary-400 hover:underline cursor-pointer truncate block"
                              title="Click to view full notes"
                            >
                              {record.notes.substring(0, 35)}...
                            </button>
                          ) : (
                            <span className="truncate block">{record.notes}</span>
                          )
                        ) : (
                          <span className="text-neutral-400 dark:text-neutral-500 italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-neutral-600 dark:text-neutral-400">
                        <div className="font-medium">{dateStr}</div>
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-500">{timeStr}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Showing {historyPagination.startIdx}–{historyPagination.endIdx} of {historyPagination.totalRecords}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPagination.currentPage === 1}
                  className="px-3 py-1 text-xs font-medium border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  {historyPagination.currentPage} / {historyPagination.totalPages}
                </span>
                <button
                  onClick={() => setHistoryPage((p) => Math.min(historyPagination.totalPages, p + 1))}
                  disabled={historyPagination.currentPage === historyPagination.totalPages}
                  className="px-3 py-1 text-xs font-medium border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <svg className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 font-medium">No releases yet</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">Releases will appear here when you start</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectRelease;
