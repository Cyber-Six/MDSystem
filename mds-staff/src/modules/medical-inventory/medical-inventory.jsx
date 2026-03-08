import React, { useState, useEffect, useCallback, useMemo } from 'react';
import InventoryDashboard from './components/inventory-dashboard/inventory-dashboard';
import MedicalItemList from './components/medical-item/medical-item-list';
import MedicalItemDetail from './components/medical-item/medical-item-detail';
import DispenseQueue from './components/dispense-queue/dispense-queue';
import AddItemModal from './components/medical-item/add-item-modal';
import AddSupplyModal from './components/add-supply/add-supply-modal';
import SplitSupplyModal from './components/split-supply/split-supply-modal';
import AdjustStockModal from './components/adjust-stock/adjust-stock-modal';
import DispenseModal from './components/dispense-queue/dispense-modal';
import TransactionHistory from './components/transaction-history/transaction-history';
import {
  SEED_ITEMS, SEED_BATCHES, SEED_REQUESTS, SEED_TRANSACTIONS,
  computeItemStats, LOCATIONS,
} from './inventory-seed-data';

/**
 * Medical Inventory Page
 * Consistent with staff-appointment.jsx pattern: section tabs + sub-components.
 */
const MedicalInventory = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [items, setItems] = useState(SEED_ITEMS);
  const [batches, setBatches] = useState(SEED_BATCHES);
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

  // Context for modals
  const [supplyContext, setSupplyContext] = useState(null); // { itemId }
  const [splitContext, setSplitContext] = useState(null); // { batch }
  const [adjustContext, setAdjustContext] = useState(null); // { batch }
  const [dispenseContext, setDispenseContext] = useState(null); // { request }

  // Feedback
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setActiveSection('detail');
  };

  const handleBackToList = () => {
    setSelectedItem(null);
    setActiveSection('items');
  };

  const handleAddItem = (newItem) => {
    const id = Math.max(...items.map((i) => i.id)) + 1;
    setItems([...items, { ...newItem, id, active: true }]);
    setShowAddItem(false);
    setSuccessMsg(`${newItem.item_name} added to inventory.`);
  };

  const handleAddSupply = (batch) => {
    const id = Math.max(...batches.map((b) => b.id)) + 1;
    const newBatch = { ...batch, id, initialQuantity: batch.currentQuantity };
    setBatches([...batches, newBatch]);
    // Record transaction
    const txId = Math.max(...transactions.map((t) => t.id)) + 1;
    const item = items.find((i) => i.id === batch.medicalItemId);
    setTransactions([{
      id: txId, patientId: null, patientName: null, action: 'receive',
      quantity: batch.currentQuantity, issuedBy: 101, issuedByName: 'Current User',
      issuedAt: new Date().toISOString(), notes: `Received batch ${batch.batchNumber}`,
      itemName: item?.item_name || '', batchNumber: batch.batchNumber,
    }, ...transactions]);
    setShowAddSupply(false);
    setSuccessMsg(`Batch ${batch.batchNumber} received (${batch.currentQuantity} units).`);
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
          onNavigate={(section) => setActiveSection(section)}
          onSelectItem={handleSelectItem}
        />
      )}

      {activeSection === 'items' && (
        <MedicalItemList
          items={enrichedItems}
          onSelectItem={handleSelectItem}
          onAddItem={() => setShowAddItem(true)}
          onAddSupply={openAddSupply}
        />
      )}

      {activeSection === 'detail' && selectedEnriched && (
        <MedicalItemDetail
          item={selectedEnriched}
          transactions={transactions.filter((t) => t.itemName === selectedEnriched.item_name)}
          onBack={handleBackToList}
          onAddSupply={() => openAddSupply(selectedEnriched.id)}
          onSplit={openSplit}
          onAdjust={openAdjust}
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
