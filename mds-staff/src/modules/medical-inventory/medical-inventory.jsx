import React, { useState, useEffect, useCallback, useMemo } from 'react';
import InventoryDashboard from './components/inventory-dashboard/inventory-dashboard';
import MedicalItemList from './components/medical-item/medical-item-list';
import MedicalItemDetail from './components/medical-item/medical-item-detail';
import DispenseQueue from './components/dispense-queue/dispense-queue';
import AddItemModal from './components/medical-item/add-item-modal';
import EditItemModal from './components/medical-item/edit-item-modal';
import DeleteItemConfirmation from './components/medical-item/delete-item-confirmation';
import AddSupplyModal from './components/add-supply/add-supply-modal';
import SplitSupplyModal from './components/split-supply/split-supply-modal';
import AdjustStockModal from './components/adjust-stock/adjust-stock-modal';
import DispenseModal from './components/dispense-queue/dispense-modal';
import TransactionHistory from './components/transaction-history/transaction-history';
import { fetchMedicalItems, fetchMedicalItem, createMedicalItem, updateMedicalItem, deleteMedicalItem, addMedicineSupply, addSupplyBatch, fetchMedicineBatches, fetchSupplyBatches } from './medical-inventory-service';
import {
  SEED_BATCHES, SEED_REQUESTS, SEED_TRANSACTIONS,
  computeItemStats, LOCATIONS,
} from './inventory-seed-data';

/**
 * Medical Inventory Page
 * Consistent with staff-appointment.jsx pattern: section tabs + sub-components.
 */
const MedicalInventory = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState('');
  const [selectedItemLoading, setSelectedItemLoading] = useState(false);
  const [batches, setBatches] = useState([]);
  const [requests, setRequests] = useState(SEED_REQUESTS);
  const [transactions, setTransactions] = useState(SEED_TRANSACTIONS);

  // Selected item for detail view
  const [selectedItem, setSelectedItem] = useState(null);

  // Modals
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddSupply, setShowAddSupply] = useState(false);
  const [showSplitSupply, setShowSplitSupply] = useState(false);
  const [showAdjustStock, setShowAdjustStock] = useState(false);
  const [showDispense, setShowDispense] = useState(false);
  const [showEditItem, setShowEditItem] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);

  // Context for modals
  const [supplyContext, setSupplyContext] = useState(null); // { itemId }
  const [splitContext, setSplitContext] = useState(null); // { batch }
  const [adjustContext, setAdjustContext] = useState(null); // { batch }
  const [dispenseContext, setDispenseContext] = useState(null); // { request }

  // Feedback
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
                medicalItemId: b.medicalItemId,
                batchNumber: b.batchNumber,
                currentQuantity: b.dosageValue,
                initialQuantity: b.dosageValue,
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
                medicalItemId: b.supplyItemId,
                batchNumber: b.batch_number,
                currentQuantity: b.currentQuantity,
                initialQuantity: b.initialQuantity,
                unit: b.unit,
                expiryDate: b.expiry_date,
                location: b.location,
                supplierName: b.supplier_name,
                notes: b.notes,
              }))
            );
          }
        })
      );
      setBatches(batchResults.flat());
    } catch (err) {
      setItemsError(err.message || 'Failed to load medical items.');
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (error || successMsg) {
      const t = setTimeout(() => { setError(''); setSuccessMsg(''); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, successMsg]);

  // Compute enriched items
  const enrichedItems = useMemo(() => computeItemStats(items, batches), [items, batches]);

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
    setSuccessMsg(`${created.item_name} added to inventory.`);
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
    setSuccessMsg(`${updated.item_name} updated successfully.`);
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
    setSuccessMsg('Item deleted successfully.');
  };

  const handleAddSupply = async (batch) => {
    let created;

    if (batch.isMedicine) {
      created = await addMedicineSupply({
        medicalItemId: batch.medicalItemId,
        batchNumber: batch.batchNumber,
        dosageUnit: batch.dosageUnit,
        dosageValue: batch.quantity,
        expiryDate: batch.expiryDate,
        location: batch.location,
        supplierName: batch.supplierName || null,
        notes: batch.notes || null,
      });
    } else {
      created = await addSupplyBatch({
        supplyItemId: batch.medicalItemId,
        batch_number: batch.batchNumber,
        initialQuantity: batch.quantity,
        unit: batch.unit,
        expiry_date: batch.expiryDate,
        location: batch.location,
        received_at: batch.receivedAt,
        supplier_name: batch.supplierName || null,
        notes: batch.notes || null,
      });
    }

    const normalized = batch.isMedicine
      ? {
          id: created.id,
          medicalItemId: created.medicalItemId,
          batchNumber: created.batchNumber,
          currentQuantity: created.dosageValue,
          initialQuantity: created.dosageValue,
          expiryDate: created.expiryDate,
          location: created.location,
          supplierName: created.supplierName,
          notes: created.notes,
        }
      : {
          id: created.id,
          medicalItemId: created.supplyItemId,
          batchNumber: created.batch_number,
          currentQuantity: created.currentQuantity,
          initialQuantity: created.initialQuantity,
          expiryDate: created.expiry_date,
          location: created.location,
          supplierName: created.supplier_name,
          notes: created.notes,
        };
    setBatches([...batches, normalized]);
    setShowAddSupply(false);
    setSuccessMsg(`Batch ${batch.batchNumber} received (${batch.quantity} units).`);
  };

  const handleSplit = ({ sourceBatchId, quantity, toClinic, notes }) => {
    const source = batches.find((b) => b.id === sourceBatchId);
    if (!source || quantity > source.currentQuantity) {
      setError('Invalid split: insufficient quantity.');
      return;
    }
    const newId = Math.max(...batches.map((b) => b.id)) + 1;
    const newBatch = {
      ...source,
      id: newId,
      batchNumber: `${toClinic.substring(0, 3).toUpperCase()}-SPLIT-${newId}`,
      location: toClinic,
      initialQuantity: quantity,
      currentQuantity: quantity,
      notes: `Split from ${source.batchNumber}. ${notes || ''}`.trim(),
    };
    setBatches(batches.map((b) => b.id === sourceBatchId ? { ...b, currentQuantity: b.currentQuantity - quantity } : b).concat(newBatch));
    // Record transactions
    const txId = Math.max(...transactions.map((t) => t.id)) + 1;
    const item = items.find((i) => i.id === source.medicalItemId);
    setTransactions([{
      id: txId, patientId: null, patientName: null, action: 'transfer',
      quantity, issuedBy: 101, issuedByName: 'Current User',
      issuedAt: new Date().toISOString(),
      notes: `Split from ${source.batchNumber} → ${toClinic}`,
      itemName: item?.item_name || '', batchNumber: newBatch.batchNumber,
    }, ...transactions]);
    setShowSplitSupply(false);
    setSuccessMsg(`Split ${quantity} units to ${toClinic}.`);
  };

  const handleAdjust = ({ batchId, delta, reason }) => {
    setBatches(batches.map((b) => b.id === batchId ? { ...b, currentQuantity: Math.max(0, b.currentQuantity + delta) } : b));
    const batch = batches.find((b) => b.id === batchId);
    const item = items.find((i) => i.id === batch?.medicalItemId);
    const txId = Math.max(...transactions.map((t) => t.id)) + 1;
    setTransactions([{
      id: txId, patientId: null, patientName: null, action: 'adjust',
      quantity: delta, issuedBy: 101, issuedByName: 'Current User',
      issuedAt: new Date().toISOString(), notes: reason,
      itemName: item?.item_name || '', batchNumber: batch?.batchNumber || '',
    }, ...transactions]);
    setShowAdjustStock(false);
    setSuccessMsg(`Stock adjusted by ${delta > 0 ? '+' : ''}${delta} units.`);
  };

  const handleDispense = ({ requestId, allocations }) => {
    // Decrement batches
    const batchUpdates = {};
    allocations.forEach(({ batchId, qty }) => {
      batchUpdates[batchId] = (batchUpdates[batchId] || 0) + qty;
    });
    setBatches(batches.map((b) => batchUpdates[b.id] ? { ...b, currentQuantity: Math.max(0, b.currentQuantity - batchUpdates[b.id]) } : b));
    // Update request status
    setRequests(requests.map((r) => r.id === requestId ? { ...r, status: 'Approved' } : r));
    // Record transactions
    const req = requests.find((r) => r.id === requestId);
    const totalQty = allocations.reduce((s, a) => s + a.qty, 0);
    const txId = Math.max(...transactions.map((t) => t.id)) + 1;
    setTransactions([{
      id: txId, patientId: req?.patientId, patientName: req?.patientName, action: 'issue',
      quantity: totalQty, issuedBy: 101, issuedByName: 'Current User',
      issuedAt: new Date().toISOString(),
      notes: `Dispensed for: ${req?.purpose || 'N/A'}`,
      itemName: req?.items?.[0]?.itemName || '', batchNumber: allocations.map((a) => batches.find((b) => b.id === a.batchId)?.batchNumber).join(', '),
    }, ...transactions]);
    setShowDispense(false);
    setSuccessMsg(`Dispensed ${totalQty} units to ${req?.patientName || 'patient'}.`);
  };

  // Open modals with context
  const openAddSupply = (itemId) => { setSupplyContext({ itemId }); setShowAddSupply(true); };
  const openSplit = (batch) => { setSplitContext({ batch }); setShowSplitSupply(true); };
  const openAdjust = (batch) => { setAdjustContext({ batch }); setShowAdjustStock(true); };
  const openDispense = (request) => { setDispenseContext({ request }); setShowDispense(true); };

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
      badge: requests.filter((r) => r.status === 'InProgress').length,
    },
    {
      key: 'history', label: 'History',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
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
      {successMsg && (
        <div className="px-3 py-2 bg-success-50 dark:bg-success-900/30 border border-success-200 dark:border-success-800 text-success-700 dark:text-success-400 text-xs rounded-lg">
          {successMsg}
        </div>
      )}

      {/* Header + Section Tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-secondary-800 dark:text-white leading-none m-0">Medical Inventory</h1>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400">Manage medicines, supplies, batches, and dispense requests</p>
        </div>
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
          transactions={transactions.filter((t) => t.itemName === selectedEnriched.item_name)}
          onBack={handleBackToList}
          onAddSupply={() => openAddSupply(selectedEnriched.id)}
          onSplit={openSplit}
          onAdjust={openAdjust}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
        />
      )}

      {activeSection === 'dispense' && (
        <DispenseQueue
          requests={requests}
          items={items}
          onDispense={openDispense}
        />
      )}

      {activeSection === 'history' && (
        <TransactionHistory transactions={transactions} items={items} />
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
          onClose={() => setShowSplitSupply(false)}
          onSplit={handleSplit}
        />
      )}

      {showAdjustStock && adjustContext?.batch && (
        <AdjustStockModal
          batch={adjustContext.batch}
          itemName={items.find((i) => i.id === adjustContext.batch.medicalItemId)?.item_name || ''}
          onClose={() => setShowAdjustStock(false)}
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
    </div>
  );
};

export default MedicalInventory;
