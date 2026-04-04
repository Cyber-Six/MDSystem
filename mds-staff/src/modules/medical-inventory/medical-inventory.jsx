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
import { fetchMedicalItems, fetchMedicalItem, createMedicalItem, updateMedicalItem, deleteMedicalItem, addMedicineSupply, addSupplyBatch, fetchMedicineBatches, fetchSupplyBatches, splitMedicineSupply, splitMedicalSupply, updateSupplyBatch, updateMedicineBatch } from './medical-inventory-service';
import { fetchPatientMedicineRequests, fetchAllMedicineRequests, fetchMedicineRequestById, setMedicineRequestStatus } from './medicine-request-service';
import { issuePrescription } from './prescription-service';
import { getPatientBasicInfo } from '../../modules/pending-requests/patient-record-service';
import { formatPatientName } from '../../services/patient-search-service';
import {
  SEED_BATCHES, SEED_TRANSACTIONS,
  computeItemStats, LOCATIONS,
} from './inventory-seed-data';


/**
 * Medical Inventory Page
 * Consistent with staff-appointment.jsx pattern: section tabs + sub-components.
 */
const MedicalInventory = () => {
  const routerLocation = useLocation();
  const { subscribe, refreshInventoryAlerts } = useStaffNotifications();
  const [activeSection, setActiveSection] = useState(
    routerLocation.state?.section ?? 'dashboard'
  );
  const [directReleaseLocation, setDirectReleaseLocation] = useState('Casal');
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

  // Helper function to get patient name with caching
  const getPatientNameCached = useCallback(async (patientId) => {
    if (!patientId) return `Patient #${patientId}`;
    
    // Check cache first
    if (patientNameCacheRef.current[patientId]) {
      return patientNameCacheRef.current[patientId];
    }
    
    try {
      const patient = await getPatientBasicInfo(patientId);
      if (patient) {
        const name = formatPatientName(patient);
        patientNameCacheRef.current[patientId] = name;
        return name;
      }
    } catch (err) {
      console.warn(`Failed to fetch patient info for ID ${patientId}:`, err);
    }
    
    // Fallback to ID if fetch fails
    const fallback = `Patient #${patientId}`;
    patientNameCacheRef.current[patientId] = fallback;
    return fallback;
  }, []);

  // Helper function to enrich multiple requests with patient names
  const enrichRequestsWithPatientNames = useCallback(async (requests) => {
    const uniquePatientIds = [...new Set(requests.map(r => r.patientId))];
    
    // Fetch all patient names in parallel
    const patientNames = await Promise.all(
      uniquePatientIds.map(id => getPatientNameCached(id))
    );
    
    // Create a map of patientId -> patientName
    const patientNameMap = {};
    uniquePatientIds.forEach((id, index) => {
      patientNameMap[id] = patientNames[index];
    });
    
    // Enrich requests with patient names
    return requests.map(req => ({
      ...req,
      patientName: patientNameMap[req.patientId] || `Patient #${req.patientId}`,
      patientType: 'Self-Request',
      _isRealRequest: true,
    }));
  }, [getPatientNameCached]);

  // ── Fetch items from API ───────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError('');
    try {
      const data = await fetchMedicalItems();
      setItems(data);
      // Fetch batches for all items in parallel
      const batchResults = await Promise.all(
        data.map((item) => {
          const isMedicine = item.category?.toLowerCase() === 'medicine';
          if (isMedicine) {
            return fetchMedicineBatches(Number(item.id)).then((bs) =>
              bs.map((b) => ({
                id: b.id,
                medicalItemId: Number(b.medicalItemId),  // Ensure number type for linking
                batchNumber: b.batchNumber,
                currentQuantity: Number(b.availableQuantity ?? 0),
                availableQuantity: Number(b.availableQuantity ?? 0),
                initialQuantity: Number(b.availableQuantity ?? 0),
                dosageValue: Number(b.dosageValue ?? 0),
                dosageUnit: b.dosageUnit,
                expiryDate: b.expiryDate,
                location: b.location,
                supplierName: b.supplierName,
                notes: b.notes,
              }))
            );
          } else {
            return fetchSupplyBatches(Number(item.id)).then((bs) =>
              bs.map((b) => ({
                id: b.id,
                medicalItemId: Number(b.supplyItemId),  // Ensure number type for linking
                batchNumber: b.batchNumber,
                currentQuantity: Number(b.currentQuantity ?? 0),
                availableQuantity: Number(b.currentQuantity ?? 0),  // Map both fields for consistency
                unit: b.unit,
                expiryDate: b.expiryDate,
                location: b.location,
                supplierName: b.supplierName,
                notes: b.notes,
              }))
            );
          }
        })
      );
      const flatBatches = batchResults.flat();
      setBatches(flatBatches);
    } catch (err) {
      setItemsError(err.message || 'Failed to load medical items.');
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

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

    const normalized = batch.isMedicine
      ? {
          id: created.id,
          medicalItemId: created.medicalItemId,
          batchNumber: created.batchNumber,
          dosageValue: created.dosageValue,
          dosageUnit: created.dosageUnit,
          currentQuantity: Number(created.dosageValue ?? 0),
          availableQuantity: Number(batch.quantity ?? 0),
          initialQuantity: Number(created.dosageValue ?? 0),
          expiryDate: created.expiryDate,
          location: created.location,
          supplierName: created.supplierName,
          notes: created.notes,
        }
      : {
          id: created.id,
          medicalItemId: created.supplyItemId,
          batchNumber: created.batchNumber,
          currentQuantity: created.currentQuantity,
          expiryDate: created.expiryDate,
          location: created.location,
          supplierName: created.supplierName,
          notes: created.notes,
        };
    setBatches([...batches, normalized]);

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

    setShowAddSupply(false);
    showSuccess('Batch Received', `Batch ${batch.batchNumber} received (${batch.quantity} units).`);
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

      // Reload from backend so batch counts reflect all the moves
      await loadItems();
      refreshInventoryAlerts();

      setShowSplitSupply(false);
      showSuccess('Supply Transferred', `Successfully moved ${quantity} units to ${toClinic}.`);
    } catch (err) {
      setError(err.message || 'Failed to split supply. Please try again.');
    }
  };

  // Auto-load all medicine requests on mount (all statuses)
  const loadAllMedicineRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      const rawRequests = await fetchAllMedicineRequests(null);
      const enrichedWithNames = await enrichRequestsWithPatientNames(rawRequests);
      const enriched = enrichedWithNames.map(req => ({
        ...req,
        items: enrichRequestItems(req.items || []),
      }));
      setRequests(enriched);
    } catch (err) {
      setError(err.message || 'Failed to load medicine requests.');
    } finally {
      setIsLoadingRequests(false);
    }
  }, [enrichRequestItems, enrichRequestsWithPatientNames]);

  useEffect(() => {
    if (itemsLoading || hasLoadedRequestsRef.current) return;
    hasLoadedRequestsRef.current = true;
    loadAllMedicineRequests();
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
      loadAllMedicineRequests();
    }
  }, [enrichRequestItems, enrichRequestsWithPatientNames, loadAllMedicineRequests]);

  // Connect to socket for real-time updates
  const { isConnected: isSocketConnected } = useMedicineRequestSocket(
    handleNewMedicineRequest,    // onNewRequest
    null,                         // onRequestUpdate (not used yet)
    null                          // onRequestStatusChange (not used yet)
  );

  // Reload dispense queue when a patient submits a new medicine request via socket
  useEffect(() => {
    const unsub = subscribe('medicine:request:new', loadAllMedicineRequests);
    return unsub;
  }, [subscribe, loadAllMedicineRequests]);

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
      await loadItems();
      refreshInventoryAlerts();
      setShowAdjustStock(false);
      setAdjustContext(null);
      showSuccess('Stock Adjusted', `Stock ${type === 'add' ? 'increased' : 'decreased'} by ${quantity} units.`);
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
      
      setRequests(requests.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'Completed',
              notes: notes || r.notes,
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

      setShowDispense(false);
      showSuccess('Medicine Dispensed', `Dispensed ${totalQty} units to ${req?.patientName || 'patient'}.`, `Transaction #${txId}`);
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

  const handleConfirmAction = async (request, notes, approvedQuantity, approvedBatchId) => {
    const requestId = request?.id;
    if (!requestId) return;

    try {
      const isApprove = actionType === 'approve';
      const status = isApprove ? 'Approved' : 'Rejected';
      
      // Call backend with notes parameter for both actions
      await setMedicineRequestStatus(requestId, status, notes || undefined);
      
      // Update local state
      setRequests(requests.map((r) => 
        r.id === requestId 
          ? { 
              ...r, 
              status, 
              notes: notes || null,
              // Store approved quantity and batch in frontend state for use during dispensing
              approvedQuantity: isApprove ? approvedQuantity : null,
              approvedBatchId: isApprove ? approvedBatchId : null
            } 
          : r
      ));
      
      showSuccess('Request Updated', `Medicine request #${requestId} ${isApprove ? 'approved' : 'rejected'}!`);
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
      let fullRequest = request;
      const hasUsableItems = Array.isArray(request.items) && request.items.length > 0;

      if (!hasUsableItems) {
        const fetched = await fetchMedicineRequestById(request.id);
        if (fetched) {
          fullRequest = { ...request, ...fetched };
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
            onDispense={openDispense}
            onApprove={handleApprove}
            onReject={handleReject}
            focusPatientId={loadedPatientId}
            onClearFocus={() => { setLoadedPatientId(null); setPatientReqsMsg(''); setPatientLookupId(''); }}
          />
        </div>
      )}

      {activeSection === 'direct-release' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-secondary-800 dark:text-white">Dispense for Walk-in Patients</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Release medicine to patients without prior request</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-secondary-700 dark:text-neutral-300">Location:</label>
                <select
                  value={directReleaseLocation}
                  onChange={(e) => setDirectReleaseLocation(e.target.value)}
                  className="px-2 py-1 border border-neutral-200 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white text-xs"
                >
                  <option value="Casal">Casal</option>
                  <option value="Arlegui">Arlegui</option>
                  <option value="QuezonCity">Quezon City</option>
                </select>
              </div>
            </div>

            <DirectRelease
              location={directReleaseLocation}
              onRelease={(result) => {
                loadAllMedicineRequests();
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
          onClose={() => setShowAddSupply(false)}
          onSave={handleAddSupply}
        />
      )}

      {showSplitSupply && splitContext?.batch && (
        <SplitSupplyModal
          batch={splitContext.batch}
          allBatches={splitContext.allBatches}
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
          onClose={() => setShowDispenseMedicine(false)}
          onSuccess={(result) => {
            showSuccess('Medicine Dispensed', `Dispensed medicine to ${dispenseMedicineContext.patientName}.`, `Transaction ID: ${result.id}`);
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
