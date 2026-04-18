import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import InventoryDashboard from './components/inventory-dashboard/inventory-dashboard';
import MedicalItemList from './components/medical-item/medical-item-list';
import MedicalItemDetail from './components/medical-item/medical-item-detail';
import DispenseQueue from './components/dispense-queue/dispense-queue';
import DirectRelease from './components/direct-release/direct-release';
import AddItemModal from './components/medical-item/add-item-modal';
import EditItemModal from './components/medical-item/edit-item-modal';
import DeleteItemConfirmation from './components/medical-item/delete-item-confirmation';
import AddSupplyModal from './components/add-supply/add-supply-modal';
import SplitSupplyModal from './components/split-supply/split-supply-modal';
import AdjustStockModal from './components/adjust-stock/adjust-stock-modal';
import DispenseModal from './components/dispense-queue/dispense-modal';
import DispenseMedicineModal from './components/dispense-medicine/dispense-medicine-modal';
import RequestActionModal from './components/dispense-queue/request-action-modal';
import SuccessMessageModal from '../../components/modals/SuccessMessageModal';
import { useStaffNotifications } from '../notification/notification-context';
import { useMedicineRequestSocket } from './hooks/useMedicineRequestSocket';
import { usePermissions } from '../../context/permissions-context';
import { getLocationsByBranch } from '../../utils/branch-utils';
import { fetchMedicalItems, fetchMedicalItem, createMedicalItem, updateMedicalItem, deleteMedicalItem, addMedicineSupply, addSupplyBatch, fetchMedicineBatches, fetchSupplyBatches, fetchAllBatchesForItems, splitMedicineSupply, splitMedicalSupply, updateSupplyBatch, updateMedicineBatch } from './medical-inventory-service';
import { fetchPatientMedicineRequests, fetchAllMedicineRequests, fetchAllMedicineRequestsByLocations, fetchMedicineRequestById, setMedicineRequestStatus } from './medicine-request-service';
import { issuePrescription } from './prescription-service';
import { getPatientBasicInfoBatch } from '../../modules/pending-requests/patient-record-service';
import { formatPatientName } from '../../services/patient-search-service';
import {
  SEED_BATCHES, SEED_TRANSACTIONS,
  computeItemStats, LOCATIONS,
} from './inventory-seed-data';
import { readPersistedViewState, writePersistedViewState } from '../../utils/persistent-view-state';

const INVENTORY_SECTION_STORAGE_KEY = 'mds_staff_inventory_active_section';
const INVENTORY_PERSISTABLE_SECTIONS = ['dashboard', 'items', 'dispense', 'direct-release'];
const isPersistableInventorySection = (value) => INVENTORY_PERSISTABLE_SECTIONS.includes(value);

// ── Approval persistence helpers (localStorage) ───────────────────────────
// The backend does not store approved quantities, so we persist them locally.
// Each entry: { quantities: {0: 5, 1: 3}, approvedAt: <timestamp ms> }
const APPROVAL_EXPIRY_DAYS = 7;
const _approvalKey = (id) => `mds_inv_approved_${id}`;

const saveApprovalToStorage = (requestId, quantities) => {
  try {
    localStorage.setItem(_approvalKey(requestId), JSON.stringify({ quantities, approvedAt: Date.now() }));
  } catch { /* storage unavailable */ }
};

const loadApprovalFromStorage = (requestId) => {
  try {
    const raw = localStorage.getItem(_approvalKey(requestId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // backward-compat: old format was a plain quantities object
    if (parsed && parsed.quantities !== undefined) return parsed;
    return { quantities: parsed, approvedAt: null };
  } catch { return null; }
};

const clearApprovalFromStorage = (requestId) => {
  try { localStorage.removeItem(_approvalKey(requestId)); } catch { /* ignore */ }
};

const isApprovalExpired = (requestId) => {
  const data = loadApprovalFromStorage(requestId);
  if (!data?.approvedAt) return false;
  return (Date.now() - data.approvedAt) > APPROVAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
};
// ─────────────────────────────────────────────────────────────────────────


/**
 * Medical Inventory Page
 * Consistent with staff-appointment.jsx pattern: section tabs + sub-components.
 */
const MedicalInventory = () => {
  const routerLocation = useLocation();
  const routeSection = routerLocation.state?.section;
  const { refreshInventoryAlerts } = useStaffNotifications();
  const { hasPermission, branch: staffBranch } = usePermissions();
  const [activeSection, setActiveSection] = useState(() => {
    if (isPersistableInventorySection(routeSection)) return routeSection;
    return readPersistedViewState(INVENTORY_SECTION_STORAGE_KEY, 'dashboard', isPersistableInventorySection);
  });
  const [directReleaseLocation, setDirectReleaseLocation] = useState(null); // Will be set based on user's allowed locations
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState('');
  const [selectedItemLoading, setSelectedItemLoading] = useState(false);
  const [batches, setBatches] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [transactions, setTransactions] = useState(() => {
    try {
      const saved = localStorage.getItem('mds_inventory_transactions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const recordTransaction = useCallback((tx) => {
    setTransactions((prev) => {
      const txId = Math.max(...prev.map((t) => t.id), 0) + 1;
      const next = [{ ...tx, id: txId, issuedAt: new Date().toISOString() }, ...prev].slice(0, 200);
      try { localStorage.setItem('mds_inventory_transactions', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Patient medicine request lookup
  const [patientLookupId, setPatientLookupId] = useState('');
  const [isFetchingPatientReqs, setIsFetchingPatientReqs] = useState(false);
  const [patientReqsMsg, setPatientReqsMsg] = useState('');
  const [loadedPatientId, setLoadedPatientId] = useState(null); // tracks which patient is focused in the queue

  // Selected item for detail view
  const [selectedItem, setSelectedItem] = useState(null);

  // Modals
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddSupply, setShowAddSupply] = useState(false);
  const [showSplitSupply, setShowSplitSupply] = useState(false);
  const [showAdjustStock, setShowAdjustStock] = useState(false);
  const [showDispense, setShowDispense] = useState(false);
  const [showDispenseMedicine, setShowDispenseMedicine] = useState(false);
  const [showEditItem, setShowEditItem] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(null); // 'approve' or 'reject'
  const [selectedActionRequest, setSelectedActionRequest] = useState(null);

  // Context for modals
  const [supplyContext, setSupplyContext] = useState(null); // { itemId }
  const [splitContext, setSplitContext] = useState(null); // { batch }
  const [adjustContext, setAdjustContext] = useState(null); // { batch }
  const [dispenseContext, setDispenseContext] = useState(null); // { request }
  const [dispenseMedicineContext, setDispenseMedicineContext] = useState(null); // { patientId, patientName }

  // Feedback
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState({ title: 'Success', message: '' });
  const hasLoadedRequestsRef = useRef(false);
  const patientNameCacheRef = useRef({}); // Cache for patient names to avoid redundant API calls
  const requestsLoadPromiseRef = useRef(null);
  const lastRequestsLoadAtRef = useRef(0);

  useEffect(() => {
    if (!isPersistableInventorySection(routeSection)) return;
    setActiveSection(routeSection);
  }, [routeSection]);

  useEffect(() => {
    if (!isPersistableInventorySection(activeSection)) return;
    writePersistedViewState(INVENTORY_SECTION_STORAGE_KEY, activeSection);
  }, [activeSection]);

  // Helper function to enrich multiple requests with patient names.
  // Uses a single batched /emr/medical request for all unique patient IDs
  // instead of one request per patient.
  const enrichRequestsWithPatientNames = useCallback(async (requests) => {
    if (requests.length === 0) return [];

    const uniquePatientIds = [...new Set(requests.map(r => r.patientId).filter(Boolean))];

    // Build name map from cache first
    const patientNameMap = {};
    const uncachedIds = [];
    for (const id of uniquePatientIds) {
      if (patientNameCacheRef.current[id]) {
        patientNameMap[id] = patientNameCacheRef.current[id];
      } else {
        uncachedIds.push(id);
      }
    }

    // Fetch all uncached patients in one batched request (if permitted)
    if (uncachedIds.length > 0) {
      const canViewPatientInfo = hasPermission('patientSearch') || hasPermission('medicalRecords');
      if (canViewPatientInfo) {
        try {
          const batchMap = await getPatientBasicInfoBatch(uncachedIds);
          for (const [id, patient] of batchMap.entries()) {
            const name = patient ? formatPatientName(patient) : `Patient #${id}`;
            patientNameCacheRef.current[id] = name;
            patientNameMap[id] = name;
          }
        } catch (err) {
          console.warn('Failed to batch-fetch patient names:', err.message);
          for (const id of uncachedIds) {
            patientNameMap[id] = patientNameMap[id] ?? `Patient #${id}`;
          }
        }
      } else {
        for (const id of uncachedIds) {
          const fallback = `Patient #${id}`;
          patientNameCacheRef.current[id] = fallback;
          patientNameMap[id] = fallback;
        }
      }
    }

    return requests.map(req => ({
      ...req,
      patientName: patientNameMap[req.patientId] || `Patient #${req.patientId}`,
      patientType: 'Self-Request',
      _isRealRequest: true,
    }));
  }, [hasPermission]);

  // Memoized list of allowed locations based on the staff's branch from permissions context
  const allowedLocationsList = useMemo(() => getLocationsByBranch(staffBranch), [staffBranch]);

  // Set default directReleaseLocation based on user's allowed locations
  useEffect(() => {
    if (allowedLocationsList.length > 0 && directReleaseLocation === null) {
      setDirectReleaseLocation(allowedLocationsList[0]);
    }
  }, [allowedLocationsList, directReleaseLocation]);

  // ── Fetch items from API ───────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError('');
    try {
      // Wait for profile to load before making any requests
      // If user has no access to any locations (empty array), don't fetch batches
      if (allowedLocationsList.length === 0) {
        console.log('⏳ Waiting for profile or no location access - skipping inventory fetch');
        setItems([]);
        setBatches([]);
        setItemsLoading(false);
        return;
      }

      console.log('📍 Fetching inventory for allowed locations:', allowedLocationsList);

      const data = await fetchMedicalItems();
      setItems(data);

      // Fetch ALL batches for ALL items at ALL locations in ONE GraphQL request.
      const flatBatches = await fetchAllBatchesForItems(data, allowedLocationsList);
      setBatches(flatBatches);
    } catch (err) {
      setItemsError(err.message || 'Failed to load medical items.');
    } finally {
      setItemsLoading(false);
    }
  }, [allowedLocationsList]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const refreshInventoryItems = useCallback(async () => {
    await loadItems();
    refreshInventoryAlerts();
  }, [loadItems, refreshInventoryAlerts]);

  // Helper function to show success modal
  const showSuccess = useCallback((title = 'Success', message = '', details = null) => {
    setSuccessMsg(message); // Keep backward compatibility if needed
    setSuccessModalData({ title, message, details });
    setShowSuccessModal(true);
  }, []);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => { setError(''); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // Compute enriched items
  const enrichedItems = useMemo(() => computeItemStats(items, batches), [items, batches]);

  const enrichRequestItems = useCallback((requestItems = []) => {
    return requestItems.map((item) => {
      const hasBatchId = item?.batchId;
      const medicineId = item?.medicineId;
      
      let itemId, itemName, batchId;
      
      if (hasBatchId) {
        // Staff request with actual batchId
        batchId = item.batchId;
        const batch = batches.find((b) => String(b.id) === String(batchId));
        const medicine = batch ? items.find((i) => String(i.id) === String(batch.medicalItemId)) : null;
        itemId = medicine?.id || batch?.medicalItemId || null;
        itemName = medicine?.item_name || `Batch #${batchId}`;
      } else if (medicineId) {
        // Patient request with just medicineId - look up medicine directly
        const medicine = items.find((i) => String(i.id) === String(medicineId));
        itemId = medicine?.id || medicineId;
        itemName = medicine?.item_name || `Medicine #${medicineId}`;
        batchId = null; // Will be selected during dispensing
      }
      
      return {
        ...item,
        batchId,
        medicineId: medicineId || batchId,
        itemId,
        itemName,
      };
    });
  }, [batches, items]);

  // Find enriched selected item
  const selectedEnriched = useMemo(() => {
    if (!selectedItem) return null;
    return enrichedItems.find((i) => i.id === selectedItem.id) || null;
  }, [selectedItem, enrichedItems]);

  /* ── Handlers ───────────────────────────────────────────────────────── */

  const handleSelectItem = async (item) => {
    setSelectedItem(item);
    setActiveSection('detail');
    setSelectedItemLoading(true);
    try {
      const fresh = await fetchMedicalItem(item.id);
      if (fresh) {
        setItems((prev) => prev.map((i) => i.id === fresh.id ? { ...i, ...fresh } : i));
        setSelectedItem(fresh);
      }
    } catch (err) {
      setError(err.message || 'Failed to load item details.');
    } finally {
      setSelectedItemLoading(false);
    }
  };

  const handleBackToList = () => {
    setSelectedItem(null);
    setActiveSection('items');
  };

  const handleAddItem = async (newItem) => {
    const created = await createMedicalItem({
      item_code: newItem.item_code,
      item_name: newItem.item_name,
      category: newItem.category,
      description: newItem.description || null,
    });
    setItems((prev) => [...prev, created]);
    setShowAddItem(false);
    showSuccess('Item Added', `${created.item_name} added to inventory.`);
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setShowEditItem(true);
  };

  const handleSaveEditItem = async (updatedData) => {
    if (!editingItem) return;
    const updated = await updateMedicalItem(editingItem.id, {
      item_name: updatedData.item_name,
      category: updatedData.category,
      description: updatedData.description || null,
    });
    setItems((prev) => prev.map((i) => i.id === updated.id ? { ...i, ...updated } : i));
    if (selectedItem?.id === updated.id) {
      setSelectedItem({ ...selectedItem, ...updated });
    }
    setShowEditItem(false);
    setEditingItem(null);
    showSuccess('Item Updated', `${updated.item_name} updated successfully.`);
  };

  const handleDeleteItem = (item) => {
    setDeletingItem(item);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async (itemId) => {
    await deleteMedicalItem(itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    if (selectedItem?.id === itemId) {
      setSelectedItem(null);
      setActiveSection('items');
    }
    setShowDeleteConfirm(false);
    setDeletingItem(null);
    showSuccess('Item Deleted', 'Item deleted successfully.');
  };

  const handleAddSupply = async (batch) => {
    let created;

    if (batch.isMedicine) {
      created = await addMedicineSupply({
        medicalItemId: batch.medicalItemId,
        batchNumber: batch.batchNumber,
        dosageUnit: batch.dosageUnit,
        dosageValue: batch.dosageValue,
        quantity: batch.quantity,
        expiryDate: batch.expiryDate,
        location: batch.location,
        supplierName: batch.supplierName || null,
        notes: batch.notes || null,
      });
    } else {
      created = await addSupplyBatch({
        supplyItemId: batch.medicalItemId,
        batchNumber: batch.batchNumber,
        initialQuantity: batch.quantity,
        unit: batch.unit,
        expiryDate: batch.expiryDate,
        location: batch.location,
        receivedBy: batch.receivedBy,
        supplierName: batch.supplierName || null,
        notes: batch.notes || null,
      });
    }

    // Record ADD transaction for per-item history
    const addQty = Number(batch.quantity ?? 0);
    recordTransaction({
      patientId: null, patientName: null,
      action: 'add',
      quantity: addQty,
      issuedBy: 101, issuedByName: 'Current User',
      notes: batch.notes || '',
      itemId: batch.medicalItemId,
      batchNumber: batch.batchNumber,
    });

    await refreshInventoryItems();

    setShowAddSupply(false);
    setSupplyContext(null);
    showSuccess('Inventory Updated', 'Inventory updated successfully.', `Batch ${created.batchNumber} received (${batch.quantity} units).`);
  };

  const handleSplit = async ({ sourceBatchId, quantity, toClinic, notes }) => {
    try {
      const source = batches.find((b) => b.id === sourceBatchId);
      if (!source) {
        setError('Source batch not found.');
        return;
      }

      const isMedicine = source.dosageUnit !== undefined;

      // Collect all raw batch records sharing the same batchNumber+location+item.
      // computeItemStats merges these into one UI row, but each DB record has its
      // own entity count. Sort largest-first so we drain the fullest batches first.
      const siblings = batches
        .filter((b) =>
          b.batchNumber === source.batchNumber &&
          b.location === source.location &&
          String(b.medicalItemId) === String(source.medicalItemId)
        )
        .sort((a, b) =>
          (b.availableQuantity ?? b.currentQuantity ?? 0) - (a.availableQuantity ?? a.currentQuantity ?? 0)
        );

      const available = siblings.reduce((sum, b) => sum + (b.availableQuantity ?? b.currentQuantity ?? 0), 0);

      if (quantity > available) {
        setError(`Insufficient quantity. Available: ${available}, requested: ${quantity}`);
        return;
      }

      // Distribute the requested quantity across sibling batches one API call each.
      // This is necessary because the backend operates on individual batch IDs.
      let remaining = quantity;
      for (const sibling of siblings) {
        if (remaining <= 0) break;
        const siblingQty = sibling.availableQuantity ?? sibling.currentQuantity ?? 0;
        const take = Math.min(siblingQty, remaining);
        if (take <= 0) continue;

        if (isMedicine) {
          await splitMedicineSupply(sibling.id, { quantity: take, targetLocation: toClinic, notes: notes || undefined });
        } else {
          await splitMedicalSupply(sibling.id, { quantity: take, targetLocation: toClinic, notes: notes || undefined });
        }
        remaining -= take;
      }

      // Record a single transaction for the total move
      recordTransaction({
        patientId: null, patientName: null,
        action: 'transfer',
        quantity,
        issuedBy: 101, issuedByName: 'Current User',
        notes: `Moved ${quantity} units from ${source.location} to ${toClinic}. ${notes || ''}`.trim(),
        itemId: source.medicalItemId,
        batchNumber: source.batchNumber,
      });

      // Reload from backend so all dependent views show canonical values.
      await refreshInventoryItems();

      setShowSplitSupply(false);
      setSplitContext(null);
      showSuccess('Inventory Updated', 'Inventory updated successfully.', `Moved ${quantity} units to ${toClinic}.`);
    } catch (err) {
      setError(err.message || 'Failed to split supply. Please try again.');
    }
  };

  // Auto-load all medicine requests on mount (all statuses)
  // Fetches requests for each allowed location to prevent unauthorized errors
  const loadAllMedicineRequests = useCallback(async (options = {}) => {
    const { force = false } = options;

    // Prevent burst reloads from multiple triggers (socket + UI actions).
    if (requestsLoadPromiseRef.current) {
      return requestsLoadPromiseRef.current;
    }

    const now = Date.now();
    if (!force && now - lastRequestsLoadAtRef.current < 1200) {
      return;
    }

    setIsLoadingRequests(true);
    const loadPromise = (async () => {
      try {
      // Wait for profile to load
      if (allowedLocationsList.length === 0) {
        console.log('⏳ Waiting for profile - skipping medicine requests fetch');
        setRequests([]);
        setIsLoadingRequests(false);
        return;
      }

      // Fetch requests for all allowed locations in ONE batched GraphQL request.
      const uniqueRequests = await fetchAllMedicineRequestsByLocations(allowedLocationsList);
      
      const enrichedWithNames = await enrichRequestsWithPatientNames(uniqueRequests);
      const enriched = enrichedWithNames.map(req => ({
        ...req,
        items: enrichRequestItems(req.items || []),
      }));

      // Identify stale approved requests (approved > 7 days ago) BEFORE setState
      // so we can fire backend cancellations after the state update
      const staleRequestIds = enriched
        .filter(req => (req.status === 'Approved' || req.status === 'InProgress') && isApprovalExpired(req.id))
        .map(req => req.id);
      staleRequestIds.forEach(id => clearApprovalFromStorage(id));

      // Use functional update to preserve frontend-only approval data.
      // Priority order: in-memory state → localStorage → backend item.quantity (original requested qty)
      setRequests(prev => {
        const prevMap = new Map(prev.map(r => [String(r.id), r]));
        const staleSet = new Set(staleRequestIds.map(String));
        return enriched.map(req => {
          // Auto-expire stale approved requests in local state
          if (staleSet.has(String(req.id))) {
            return { ...req, status: 'Cancelled', approvedQuantities: null, approvedBatchIds: null };
          }
          if (req.status === 'Approved' || req.status === 'InProgress') {
            const existing = prevMap.get(String(req.id));
            const fromStorage = loadApprovalFromStorage(req.id);
            const approvedQty = existing?.approvedQuantities || fromStorage?.quantities;
            if (approvedQty) {
              return {
                ...req,
                approvedQuantities: approvedQty,
                approvedBatchIds: existing?.approvedBatchIds || null,
                items: (req.items || []).map((item, idx) => ({
                  ...item,
                  quantity: approvedQty[idx] != null ? Number(approvedQty[idx]) : item.quantity,
                })),
              };
            }
          }
          return req;
        });
      });

      // Auto-cancel stale requests on the backend (fire-and-forget)
      staleRequestIds.forEach(id => {
        setMedicineRequestStatus(id, 'Cancelled', 'Auto-cancelled: not picked up within 7 days')
          .catch(err => console.warn('Auto-cancel backend call failed for request', id, err));
      });
      } catch (err) {
        setError(err.message || 'Failed to load medicine requests.');
      } finally {
        setIsLoadingRequests(false);
        lastRequestsLoadAtRef.current = Date.now();
        requestsLoadPromiseRef.current = null;
      }
    })();

    requestsLoadPromiseRef.current = loadPromise;
    return loadPromise;
  }, [allowedLocationsList, enrichRequestItems, enrichRequestsWithPatientNames]);

  const refreshInventoryAndQueue = useCallback(async () => {
    await Promise.all([loadItems(), loadAllMedicineRequests({ force: true })]);
    refreshInventoryAlerts();
  }, [loadItems, loadAllMedicineRequests, refreshInventoryAlerts]);

  useEffect(() => {
    if (itemsLoading || hasLoadedRequestsRef.current) return;
    hasLoadedRequestsRef.current = true;
    loadAllMedicineRequests({ force: true });
  }, [itemsLoading, loadAllMedicineRequests]);

  // Handle new medicine request from patient (real-time via socket)
  const handleNewMedicineRequest = useCallback(async (data) => {
    console.log('🔔 New medicine request received:', data);
    
    try {
      // Fetch the full request details
      const newRequest = await fetchMedicineRequestById(data.requestId);
      
      if (newRequest) {
        // Enrich with patient name and item details
        const enrichedWithNames = await enrichRequestsWithPatientNames([newRequest]);
        const enriched = enrichedWithNames.map(req => ({
          ...req,
          items: enrichRequestItems(req.items || []),
        }));
        
        // Add to the beginning of the requests list
        setRequests(prev => {
          // Check if already exists (prevent duplicates)
          const exists = prev.some(r => String(r.id) === String(data.requestId));
          if (exists) return prev;
          return [enriched[0], ...prev];
        });
        
        // Notification will be handled by the notification context which listens
        // to the 'medicine:request:new' event socket directly, so no need for modal here
      }
    } catch (err) {
      console.error('Failed to load new request details:', err);
      // Still reload all requests as fallback
      loadAllMedicineRequests({ force: true });
    }
  }, [enrichRequestItems, enrichRequestsWithPatientNames, loadAllMedicineRequests]);

  // Handle real-time status changes (e.g., patient cancels a request)
  // Updates local state immediately so reservation calculations stay accurate
  const handleRequestStatusChange = useCallback(async (data) => {
    console.log('🔔 Request status changed:', data);
    const { requestId, status } = data || {};
    if (!requestId) return;

    // Update status while preserving all local-only fields
    // If the request moves out of Approved/InProgress, clear the approval data
    // so those quantities are no longer counted as reserved
    const clearApproval = !['Approved', 'InProgress'].includes(status);
    if (clearApproval) {
      clearApprovalFromStorage(requestId);
    }
    setRequests(prev => prev.map(r =>
      String(r.id) === String(requestId)
        ? {
            ...r,
            status: status || r.status,
            ...(clearApproval ? { approvedQuantities: null, approvedBatchIds: null } : {}),
          }
        : r
    ));
  }, []);

  // Connect to socket for real-time updates
  const { isConnected: isSocketConnected } = useMedicineRequestSocket(
    handleNewMedicineRequest,    // onNewRequest
    null,                         // onRequestUpdate (not used yet)
    handleRequestStatusChange    // onRequestStatusChange — keeps reservation logic in sync
  );

  // Load real patient medicine requests into the dispense queue
  const loadPatientMedicineRequests = async (patientId) => {
    if (!patientId) return;
    setIsFetchingPatientReqs(true);
    setPatientReqsMsg('');
    try {
      const rawRequests = await fetchPatientMedicineRequests(String(patientId));

      // Enrich with patient names and itemName by cross-referencing batches → items
      const enrichedWithNames = await enrichRequestsWithPatientNames(rawRequests);
      const enriched = enrichedWithNames.map(req => ({
        ...req,
        items: enrichRequestItems(req.items || []),
      }));

      // Merge into queue — update existing, prepend new
      setRequests((prev) => {
        const existingIds = new Set(prev.map((r) => String(r.id)));
        const newOnes = enriched.filter((r) => !existingIds.has(String(r.id)));
        const updated = prev.map((r) => {
          const live = enriched.find((e) => String(e.id) === String(r.id));
          return live ? { ...r, ...live } : r;
        });
        return [...newOnes, ...updated];
      });

      if (enriched.length > 0) {
        setLoadedPatientId(String(patientId));
        setPatientReqsMsg(`Loaded ${enriched.length} request(s) for Patient #${patientId}`);
      } else {
        setLoadedPatientId(null);
        setPatientReqsMsg(`No requests found for Patient #${patientId}`);
      }
    } catch (err) {
      setLoadedPatientId(null);
      setPatientReqsMsg(err.message || 'Failed to load patient requests. Check that the backend staff endpoint is registered.');
    } finally {
      setIsFetchingPatientReqs(false);
    }
  };

  const handleAdjust = async ({ batchId, type, quantity, reason }) => {
    try {
      const source = batches.find((b) => b.id === batchId);
      const isMedicine = source?.dosageUnit !== undefined;

      if (type === 'add') {
        // ADD: apply the full increase to the source record directly.
        // Even when computeItemStats has merged multiple DB records into one UI row,
        // adding `quantity` to the individual record's actual value correctly raises
        // the visible total by exactly `quantity`.
        const rawCurrentQty = source?.currentQuantity ?? source?.availableQuantity ?? 0;
        const computedNewQuantity = rawCurrentQty + quantity;
        if (isMedicine) {
          await updateMedicineBatch(batchId, { currentQuantity: computedNewQuantity, notes: reason });
        } else {
          await updateSupplyBatch(batchId, { currentQuantity: computedNewQuantity, notes: reason });
        }
      } else {
        // SUBTRACT: a single merged UI row may represent multiple DB records sharing the
        // same batchNumber+location. Draining only the first record can underflow when it
        // holds fewer units than the requested quantity, leaving sibling records untouched
        // and making only a partial subtraction. Distribute the removal across all siblings
        // (largest-first) until the full requested quantity is consumed — mirroring the
        // split transfer logic in handleSplit.
        const siblings = batches
          .filter((b) =>
            b.batchNumber === source.batchNumber &&
            b.location === source.location &&
            String(b.medicalItemId) === String(source.medicalItemId)
          )
          .sort((a, b) =>
            (b.availableQuantity ?? b.currentQuantity ?? 0) - (a.availableQuantity ?? a.currentQuantity ?? 0)
          );

        let remaining = quantity;
        for (const sibling of siblings) {
          if (remaining <= 0) break;
          const siblingQty = sibling.availableQuantity ?? sibling.currentQuantity ?? 0;
          const take = Math.min(siblingQty, remaining);
          if (take <= 0) continue;
          const newSiblingQty = siblingQty - take;
          if (isMedicine) {
            await updateMedicineBatch(sibling.id, { currentQuantity: newSiblingQty, notes: reason });
          } else {
            await updateSupplyBatch(sibling.id, { currentQuantity: newSiblingQty, notes: reason });
          }
          remaining -= take;
        }
      }

      // Reload all batches from the backend so merged totals are accurate.
      // A local-only update is unreliable when there are multiple split records
      // for the same batch+location in the database.
      const delta = type === 'add' ? quantity : -quantity;
      recordTransaction({
        patientId: null, patientName: null,
        action: type === 'add' ? 'adjust_add' : 'adjust_minus',
        quantity: delta, issuedBy: 101, issuedByName: 'Current User',
        notes: reason,
        itemId: source?.medicalItemId, batchNumber: source?.batchNumber || '',
      });
      await refreshInventoryItems();
      setShowAdjustStock(false);
      setAdjustContext(null);
      showSuccess('Inventory Updated', 'Inventory updated successfully.', `Stock ${type === 'add' ? 'increased' : 'decreased'} by ${quantity} units.`);
    } catch (err) {
      setError(err.message || 'Failed to adjust stock');
    }
  };

  const handleDispense = async ({ request, quantity, allocation, notes }) => {
    const requestId = request?.id;
    console.log('🔵 handleDispense called:', { requestId, quantity, allocation });
    
    if (!requestId) {
      console.error('❌ Missing requestId in dispense request');
      setError('Invalid request ID. Cannot proceed with dispense.');
      return;
    }
    
    try {
      // Convert FEFO allocation into mutation input payload
      const itemsPayload = (allocation || [])
        .filter((a) => a?.id && a?.allocate)
        .map((a) => ({ batchId: Number(a.id), quantity: Number(a.allocate) }));

      if (itemsPayload.length === 0) {
        setError('No valid allocation found to dispense.');
        return;
      }

      const totalQty = itemsPayload.reduce((sum, item) => sum + item.quantity, 0);
      const prescriptionResult = await issuePrescription({
        patientId: Number(request.patientId),
        requestId: requestId,
        items: itemsPayload,
        notes: notes || `Dispensed for request #${requestId}`,
      });

      // Decrement batches locally after backend mutation succeeds
      const batchUpdates = {};
      itemsPayload.forEach(({ batchId, quantity: allocatedQty }) => {
        batchUpdates[batchId] = (batchUpdates[batchId] || 0) + allocatedQty;
      });

      setBatches(batches.map((b) => {
        const updateQty = batchUpdates[b.id];
        if (updateQty) {
          const oldAvailable = Number(b.availableQuantity ?? b.currentQuantity ?? 0);
          const newAvailable = Math.max(0, oldAvailable - updateQty);
          return { ...b, availableQuantity: newAvailable };
        }
        return b;
      }));

      // Keep local queue row aligned with successful dispense transaction
      // Also update request items with the actual dispensed quantity
      const dispensedByItemIdx = {};
      allocation.forEach((a) => {
        if (a.itemIdx !== undefined) {
          dispensedByItemIdx[a.itemIdx] = (dispensedByItemIdx[a.itemIdx] || 0) + a.allocate;
        }
      });

      // Clear localStorage — stock has been physically dispensed, no longer reserved
      clearApprovalFromStorage(requestId);

      setRequests(prev => prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'Completed',
              notes: notes || r.notes,
              approvedQuantities: null,
              approvedBatchIds: null,
              items: (r.items || []).map((item, idx) => ({
                ...item,
                quantity: dispensedByItemIdx[idx] || item.quantity,
              })),
            }
          : r
      ));

      const req = requests.find((r) => r.id === requestId) || request;
      const txId = Number(prescriptionResult?.id) || Math.max(0, ...transactions.map((t) => t.id)) + 1;
      setTransactions([{
        id: txId,
        patientId: req?.patientId,
        patientName: req?.patientName,
        action: 'issue',
        quantity: totalQty,
        issuedBy: prescriptionResult?.issuedBy || 101,
        issuedByName: 'Current User',
        issuedAt: prescriptionResult?.issuedAt || new Date().toISOString(),
        notes: notes || `Dispensed for: ${req?.purpose || 'N/A'}`,
        itemName: req?.items?.[0]?.itemName || '',
        batchNumber: (allocation || []).map((a) => batches.find((b) => b.id === a.id)?.batchNumber).filter(Boolean).join(', '),
      }, ...transactions]);

      await refreshInventoryAndQueue();

      setShowDispense(false);
      setDispenseContext(null);
      showSuccess('Inventory Updated', 'Inventory updated successfully.', `Dispensed ${totalQty} units to ${req?.patientName || 'patient'} (Transaction #${txId}).`);
    } catch (err) {
      console.error('❌ Dispense mutation failed:', err);
      setError(err.message || 'Failed to dispense medicine. Please try again.');
    }
  };

  const handleApprove = async (request) => {
    if (!request?.id) return;
    setSelectedActionRequest(request);
    setActionType('approve');
    setShowActionModal(true);
  };

  const handleReject = async (request) => {
    if (!request?.id) return;
    setSelectedActionRequest(request);
    setActionType('reject');
    setShowActionModal(true);
  };

  // Cancel an already-approved request (staff action or auto-expire)
  // Clears the reservation so the stock becomes available for other patients
  const handleCancelRequest = useCallback(async (request) => {
    const requestId = request?.id;
    if (!requestId) return;

    // Save previous approval data in case we need to revert
    const prevApprovalData = loadApprovalFromStorage(requestId);

    // Optimistic update: clear reservation immediately so the queue reflects it
    clearApprovalFromStorage(requestId);
    setRequests(prev => prev.map(r =>
      r.id === requestId
        ? { ...r, status: 'Cancelled', approvedQuantities: null, approvedBatchIds: null }
        : r
    ));

    try {
      await setMedicineRequestStatus(requestId, 'Cancelled', 'Cancelled by staff');
    } catch (err) {
      console.warn('Failed to cancel request on backend:', err);
      // Revert optimistic update if backend call fails
      if (prevApprovalData?.quantities) {
        saveApprovalToStorage(requestId, prevApprovalData.quantities);
      }
      setRequests(prev => prev.map(r =>
        r.id === requestId
          ? {
              ...r,
              status: 'Approved',
              approvedQuantities: prevApprovalData?.quantities || null,
            }
          : r
      ));
      setError('Failed to cancel the request. Please try again.');
    }
  }, []);

  const handleConfirmAction = async (request, notes, approvedQuantities, approvedBatchIds) => {
    const requestId = request?.id;
    if (!requestId) return;

    try {
      const isApprove = actionType === 'approve';
      const status = isApprove ? 'Approved' : 'Rejected';

      // Call backend with notes parameter for both actions
      await setMedicineRequestStatus(requestId, status, notes || undefined);

      // Persist approval data to localStorage so it survives page refresh.
      // The backend does not store approved quantities, so this is the only
      // way to keep reservation logic accurate across sessions.
      if (isApprove && approvedQuantities) {
        saveApprovalToStorage(requestId, approvedQuantities);
      } else {
        clearApprovalFromStorage(requestId);
      }

      // Update local state using functional update to avoid stale closure issues
      // (the await above can cause socket events to update requests mid-flight)
      setRequests(prev => prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status,
              notes: notes || null,
              approvedQuantities: isApprove ? approvedQuantities : null,
              approvedBatchIds: isApprove ? approvedBatchIds : null,
              // Write approved qty into item.quantity so the reservation fallback is correct
              items: isApprove && approvedQuantities
                ? (r.items || []).map((item, idx) => ({
                    ...item,
                    quantity: approvedQuantities[idx] != null
                      ? Number(approvedQuantities[idx])
                      : item.quantity,
                  }))
                : r.items,
            }
          : r
      ));

      showSuccess('Request Updated', `Medicine request #${requestId} ${isApprove ? 'approved and ready for dispense' : 'rejected'}!`);
      setShowActionModal(false);
      setSelectedActionRequest(null);
      setActionType(null);
    } catch (err) {
      setError(err.message || `Failed to ${actionType} medicine request.`);
      console.error(`Error ${actionType}ing medicine request:`, err);
    }
  };

  // Open modals with context
  const openAddSupply = (itemId) => { setSupplyContext({ itemId }); setShowAddSupply(true); };
  const openSplit = (batch) => { setSplitContext({ batch, allBatches: batches }); setShowSplitSupply(true); };
  const openAdjust = (batch) => {
    // Medicine batches use `availableQuantity`; supply batches use `currentQuantity`.
    // Normalise to `currentQuantity` so the modal always has a valid number.
    const normalised = {
      ...batch,
      currentQuantity: batch.currentQuantity ?? batch.availableQuantity ?? 0,
    };
    setAdjustContext({ batch: normalised });
    setShowAdjustStock(true);
  };
  const openDispense = async (request) => {
    if (!request?.id) {
      setError('Invalid request. Please refresh and try again.');
      return;
    }

    try {
      // Get the CURRENT request from state to ensure we have the latest approved data
      const freshRequest = requests.find(r => r.id === request.id) || request;
      
      let fullRequest = freshRequest;
      const hasUsableItems = Array.isArray(freshRequest.items) && freshRequest.items.length > 0;

      if (!hasUsableItems) {
        const fetched = await fetchMedicineRequestById(freshRequest.id);
        if (fetched) {
          fullRequest = { ...freshRequest, ...fetched };
        }
      }

      const normalizedItems = enrichRequestItems(fullRequest.items || []);
      if (normalizedItems.length === 0) {
        setError('This request has no medicine items yet. Please reload the queue and try again.');
        return;
      }

      setDispenseContext({
        request: {
          ...fullRequest,
          items: normalizedItems,
        },
      });
      setShowDispense(true);
    } catch (err) {
      setError(err.message || 'Unable to load request details for dispensing.');
    }
  };
  const openDispenseMedicine = (patientId, patientName) => { setDispenseMedicineContext({ patientId, patientName }); setShowDispenseMedicine(true); };

  /* ── Section tabs ───────────────────────────────────────────────────── */

  const sections = [
    {
      key: 'dashboard', label: 'Overview',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    },
    {
      key: 'items', label: 'Medical Items',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
    },
    {
      key: 'dispense', label: 'Dispense Queue',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
      badge: requests.filter((r) => r.status === 'Pending' || r.status === 'InProgress').length,
    },
    {
      key: 'direct-release', label: 'Direct Release',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8m0 8l-6-2m6 2l6-2" /></svg>,
    },
  ];

  return (
    <div className="space-y-1">
      {/* Feedback */}
      {error && (
        <div className="px-3 py-2 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 text-error-700 dark:text-error-400 text-xs rounded-lg">
          {error}
        </div>
      )}

      {/* Success Modal */}
      <SuccessMessageModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successModalData.title}
        message={successModalData.message}
        details={successModalData.details}
        autoCloseDuration={3000}
      />

      {/* Header + Section Tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-secondary-800 dark:text-white leading-none m-0">Medical Inventory</h1>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400">Manage medicines, supplies, batches, and dispense requests</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-700/50 p-0.5 rounded-lg">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => { setActiveSection(s.key); if (s.key !== 'detail') setSelectedItem(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeSection === s.key || (s.key === 'items' && activeSection === 'detail')
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
                }`}
              >
                {s.icon}
                {s.label}
                {s.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-error-500 text-white rounded-full">{s.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {activeSection === 'dashboard' && (
        <InventoryDashboard
          items={enrichedItems}
          batches={batches}
          requests={requests}
          transactions={transactions}
          allowedLocations={allowedLocationsList}
          loading={itemsLoading}
          onNavigate={(section) => setActiveSection(section)}
          onSelectItem={handleSelectItem}
        />
      )}

      {activeSection === 'items' && (
        <MedicalItemList
          items={enrichedItems}
          loading={itemsLoading}
          error={itemsError}
          allowedLocations={allowedLocationsList}
          onSelectItem={handleSelectItem}
          onAddItem={() => setShowAddItem(true)}
          onAddSupply={openAddSupply}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
        />
      )}

      {activeSection === 'detail' && selectedEnriched && (
        <MedicalItemDetail
          item={selectedEnriched}
          loading={selectedItemLoading}
          transactions={transactions.filter((t) => String(t.itemId) === String(selectedEnriched.id) && ['add', 'adjust_add', 'adjust_minus', 'transfer'].includes(t.action))}
          onBack={handleBackToList}
          onAddSupply={() => openAddSupply(selectedEnriched.id)}
          onSplit={openSplit}
          onAdjust={openAdjust}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
        />
      )}

        {activeSection === 'dispense' && (
        <div className="space-y-3">
          <DispenseQueue
            requests={requests}
            items={items}
            batches={batches}
            allowedLocations={allowedLocationsList}
            onDispense={openDispense}
            onApprove={handleApprove}
            onReject={handleReject}
            onCancel={handleCancelRequest}
            focusPatientId={loadedPatientId}
            onClearFocus={() => { setLoadedPatientId(null); setPatientReqsMsg(''); setPatientLookupId(''); }}
          />
        </div>
      )}

      {activeSection === 'direct-release' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
            {allowedLocationsList.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-neutral-500 dark:text-neutral-400">You do not have access to any inventory locations.</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Please contact your administrator to configure your branch access.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-secondary-800 dark:text-white leading-none m-0">Dispense for Walk-in Patients</h2>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">Release medicine to patients without prior request</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-secondary-700 dark:text-neutral-300">Location:</label>
                    <select
                      value={directReleaseLocation || ''}
                      onChange={(e) => setDirectReleaseLocation(e.target.value)}
                      className="px-2 py-0.5 border border-neutral-200 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white text-xs"
                    >
                      {allowedLocationsList.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc === 'QuezonCity' ? 'Quezon City' : loc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <DirectRelease
                  location={directReleaseLocation}
                  allRequests={requests}
                  onRelease={async (result) => {
                    await refreshInventoryItems();
                    recordTransaction({
                      action: 'direct_release',
                      itemId: null,
                      patientId: result.patientId,
                      quantity: result.quantity,
                      notes: result.notes,
                    });
                  }}
                  onShowSuccess={(title, message, details) => {
                    setSuccessModalData({ title, message, details });
                    setShowSuccessModal(true);
                  }}
                  onShowError={(errorMsg) => {
                    setError(errorMsg);
                    setTimeout(() => setError(''), 5000);
                  }}
                />
              </>
            )}
          </div>
        </div>
      )}


      {/* Modals */}
      {showAddItem && (
        <AddItemModal
          onClose={() => setShowAddItem(false)}
          onSave={handleAddItem}
        />
      )}

      {showEditItem && editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => { setShowEditItem(false); setEditingItem(null); }}
          onSave={handleSaveEditItem}
        />
      )}

      {showDeleteConfirm && deletingItem && (
        <DeleteItemConfirmation
          item={deletingItem}
          onClose={() => { setShowDeleteConfirm(false); setDeletingItem(null); }}
          onConfirm={handleConfirmDelete}
        />
      )}

      {showAddSupply && (
        <AddSupplyModal
          itemId={supplyContext?.itemId}
          items={items}
          allowedLocations={allowedLocationsList}
          onClose={() => setShowAddSupply(false)}
          onSave={handleAddSupply}
        />
      )}

      {showSplitSupply && splitContext?.batch && (
        <SplitSupplyModal
          batch={splitContext.batch}
          allBatches={splitContext.allBatches}
          allowedLocations={allowedLocationsList}
          onClose={() => setShowSplitSupply(false)}
          onSplit={handleSplit}
        />
      )}

      {showAdjustStock && adjustContext?.batch && (
        <AdjustStockModal
          batch={adjustContext.batch}
          itemName={items.find((i) => i.id === adjustContext.batch.medicalItemId)?.item_name || ''}
          onClose={() => {
            setShowAdjustStock(false);
            setAdjustContext(null);
          }}
          onAdjust={handleAdjust}
        />
      )}

      {showDispense && dispenseContext?.request && (
        <DispenseModal
          request={dispenseContext.request}
          batches={batches}
          items={items}
          onClose={() => setShowDispense(false)}
          onConfirm={handleDispense}
        />
      )}

      {showDispenseMedicine && dispenseMedicineContext && (
        <DispenseMedicineModal
          patientId={dispenseMedicineContext.patientId}
          patientName={dispenseMedicineContext.patientName}
          allowedLocations={allowedLocationsList}
          onClose={() => setShowDispenseMedicine(false)}
          onSuccess={async (result) => {
            await refreshInventoryAndQueue();
            showSuccess('Inventory Updated', 'Inventory updated successfully.', `Dispensed medicine to ${dispenseMedicineContext.patientName}. Transaction ID: ${result.id}`);
            setShowDispenseMedicine(false);
          }}
        />
      )}

      {showActionModal && selectedActionRequest && (
        <RequestActionModal
          request={selectedActionRequest}
          action={actionType}
          batches={batches}
          items={items}
          allRequests={requests}
          onConfirm={handleConfirmAction}
          onCancel={() => {
            setShowActionModal(false);
            setSelectedActionRequest(null);
            setActionType(null);
          }}
        />
      )}
    </div>
  );
};

export default MedicalInventory;
