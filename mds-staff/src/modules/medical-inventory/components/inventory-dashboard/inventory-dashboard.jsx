import React, { useMemo, useState, useEffect } from 'react';
import { getExpiryStatus, CATEGORY_COLORS } from '../../inventory-seed-data';
import ExpiringItemsModal from './expiring-items-modal';

/**
 * Inventory Dashboard — overview cards + alerts.
 * Dynamic dashboard with animations, progress bars, status badges, and trend indicators.
 */
const InventoryDashboard = ({ items, batches, requests, transactions, onNavigate, onSelectItem }) => {
  const pendingCount = requests.filter((r) => r.status === 'Approved').length; // Changed to Approved requests
  const totalItems = items.length;
  const getStock = (b) => b.availableQuantity ?? b.currentQuantity ?? 0;
  const totalStock = batches.reduce((s, b) => s + getStock(b), 0);
  
  // Category-based calculations
  const medicineItems = items.filter((i) => i.category === 'medicine');
  const medicineCount = medicineItems.length;
  const suppliesItems = items.filter((i) => i.category !== 'medicine');
  const suppliesCount = suppliesItems.length;
  
  // Stock by category
  const medicineBatches = batches.filter((b) => {
    const item = items.find((i) => String(i.id) === String(b.medicalItemId));
    return item && item.category === 'medicine';
  });
  const medicineStock = medicineBatches.reduce((s, b) => s + getStock(b), 0);
  
  const suppliesBatches = batches.filter((b) => {
    const item = items.find((i) => String(i.id) === String(b.medicalItemId));
    return item && item.category !== 'medicine';
  });
  const suppliesStock = suppliesBatches.reduce((s, b) => s + getStock(b), 0);

  // DEBUG: Log batch linking
  console.log('🔗 Batch Linking Debug:', {
    totalBatches: batches.length,
    totalItems: items.length,
    sampleBatches: batches.slice(0, 2).map(b => ({
      id: b.id,
      medicalItemId: b.medicalItemId,
      medicalItemId_type: typeof b.medicalItemId,
      currentQuantity: b.currentQuantity,
      availableQuantity: b.availableQuantity,
    })),
    sampleItems: items.slice(0, 2).map(i => ({
      id: i.id,
      id_type: typeof i.id,
      name: i.item_name,
      category: i.category,
    })),
    medicineBatches_linked: medicineBatches.length,
    suppliesBatches_linked: suppliesBatches.length,
  });
  
  const lowStockItems = items.filter((i) => i.isLowStock === true);

  // DEBUG: Check item structure and low stock
  if (items.length > 0) {
    console.log('🏥 Item Structure Debug:', {
      sampleItem: {
        id: items[0].id,
        name: items[0].item_name,
        category: items[0].category,
        reorder_level: items[0].reorder_level,
        totalStock: items[0].totalStock,
        isLowStock: items[0].isLowStock,
        batches: items[0].batches?.length || 0,
      },
      lowStockItems_count: lowStockItems.length,
      lowStockItems_list: lowStockItems.map(i => ({
        id: i.id,
        name: i.item_name,
        reorder_level: i.reorder_level,
        totalStock: i.totalStock,
      })),
    });
  }
  const lowStockMedicines = lowStockItems.filter((i) => i.category === 'medicine');
  const lowStockSupplies = lowStockItems.filter((i) => i.category !== 'medicine');
  
  const expiringSoon = batches.filter((b) => {
    if (!b.expiryDate) return false;
    const days = Math.ceil((new Date(b.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 60; // 2 months before expiry
  });
  
  const expiringSoonMedicines = expiringSoon.filter((b) => {
    const item = items.find((i) => String(i.id) === String(b.medicalItemId));
    return item && item.category === 'medicine';
  });
  
  const expiringSoonSupplies = expiringSoon.filter((b) => {
    const item = items.find((i) => String(i.id) === String(b.medicalItemId));
    return item && item.category !== 'medicine';
  });
  
  const expiredBatches = batches.filter((b) => b.expiryDate && new Date(b.expiryDate) < new Date());
  
  const expiredMedicines = expiredBatches.filter((b) => {
    const item = items.find((i) => String(i.id) === String(b.medicalItemId));
    return item && item.category === 'medicine';
  });
  
  const expiredSupplies = expiredBatches.filter((b) => {
    const item = items.find((i) => String(i.id) === String(b.medicalItemId));
    return item && item.category !== 'medicine';
  });

  const casalStock = batches.filter((b) => b.location === 'Casal').reduce((s, b) => s + getStock(b), 0);
  const arlegui = batches.filter((b) => b.location === 'Arlegui').reduce((s, b) => s + getStock(b), 0);
  const quezonCity = batches.filter((b) => b.location === 'QuezonCity').reduce((s, b) => s + getStock(b), 0);

  // Calculate stock level percentage (assuming reasonable max inventory)
  const maxInventory = 10000;
  const stockPercentage = Math.min((totalStock / maxInventory) * 100, 100);

  // DEBUG: Final summary
  console.log('✅ Dashboard Summary:', {
    medical_items_total: totalItems,
    medicine_count: medicineCount,
    supply_count: suppliesCount,
    total_stock: totalStock,
    medicine_stock: medicineStock,
    supply_stock: suppliesStock,
    pending_dispense: pendingCount,
    expiring_count: expiringSoon.length + expiredBatches.length,
    expiring_medicines: expiringSoonMedicines.length + expiredMedicines.length,
    expiring_supplies: expiringSoonSupplies.length + expiredSupplies.length,
  });

  // DEBUG: Table data
  console.log('📈 Table Data:', {
    lowStockItems_count: lowStockItems.length,
    lowStockItems_sample: lowStockItems.slice(0, 3).map(i => ({ id: i.id, name: i.item_name, category: i.category, stock: i.totalStock, reorder: i.reorder_level, isLowStock: i.isLowStock })),
    expiringSoon_count: expiringSoon.length,
    expiringSoon_sample: expiringSoon.slice(0, 3).map(b => ({ id: b.id, batchNumber: b.batchNumber, itemId: b.medicalItemId, itemName: items.find(i => String(i.id) === String(b.medicalItemId))?.item_name || 'Unknown', expiryDate: b.expiryDate, qty: b.currentQuantity })),
  });

  // Track previous values to show trend arrows
  const [prevMetrics, setPrevMetrics] = useState({
    totalStock,
    pendingCount,
    alerts: lowStockItems.length + expiringSoon.length + expiredBatches.length
  });

  const [showTrend, setShowTrend] = useState({});
  const [showExpiringModal, setShowExpiringModal] = useState(false);

  useEffect(() => {
    setShowTrend({
      stockChanged: totalStock !== prevMetrics.totalStock,
      pendingChanged: pendingCount !== prevMetrics.pendingCount,
      alertsChanged: (lowStockItems.length + expiringSoon.length + expiredBatches.length) !== prevMetrics.alerts
    });

    const timer = setTimeout(() => {
      setPrevMetrics({
        totalStock,
        pendingCount,
        alerts: lowStockItems.length + expiringSoon.length + expiredBatches.length
      });
      setShowTrend({});
    }, 2000);

    return () => clearTimeout(timer);
  }, [totalStock, pendingCount, lowStockItems.length, expiringSoon.length, expiredBatches.length]);

  const stockTrend = totalStock > prevMetrics.totalStock ? 'up' : totalStock < prevMetrics.totalStock ? 'down' : null;
  const pendingTrend = pendingCount > prevMetrics.pendingCount ? 'up' : pendingCount < prevMetrics.pendingCount ? 'down' : null;
  const alertsTrend = (lowStockItems.length + expiringSoon.length + expiredBatches.length) > prevMetrics.alerts ? 'up' : (lowStockItems.length + expiringSoon.length + expiredBatches.length) < prevMetrics.alerts ? 'down' : null;

  // Determine alert severity
  const alertSeverity = expiredBatches.length > 0 ? 'critical' : (expiringSoon.length > 2 || lowStockItems.length > 2) ? 'high' : (lowStockItems.length > 0 || expiringSoon.length > 0) ? 'medium' : 'healthy';
  const alertColor = {
    critical: 'from-error-50 to-error-100/50 dark:from-error-900/20 dark:to-error-900/10',
    high: 'from-warning-50 to-warning-100/50 dark:from-warning-900/20 dark:to-warning-900/10',
    medium: 'from-accent-50 to-accent-100/50 dark:from-accent-900/20 dark:to-accent-900/10',
    healthy: 'from-success-50 to-success-100/50 dark:from-success-900/20 dark:to-success-900/10'
  };

  return (
    <div className="space-y-2">
      {/* Stat Cards Row with Dynamic Animations - Reordered: Medical Items, On Hand, Expiring, Pending Dispense */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* 1. Medical Items - with sub-boxes (Medicine / Medical Supply) */}
        <div onClick={() => onNavigate('items')} className="cursor-pointer group bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-2.5 flex flex-col justify-between min-h-[80px] transition-all duration-300 hover:shadow-md hover:border-accent-300 dark:hover:border-accent-600">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-md bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
              <svg className="w-3.5 h-3.5 text-accent-600 dark:text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <div>
              <p className="text-lg font-bold text-secondary-800 dark:text-white leading-none">{totalItems}</p>
              <p className="text-[9px] text-secondary-400 dark:text-neutral-500">Total</p>
            </div>
          </div>
          <div className="border-t border-neutral-100 dark:border-neutral-700 pt-1.5">
            <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider m-0 mb-1.5">Medical Items</p>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-neutral-50 dark:bg-neutral-700/30 border border-neutral-200 dark:border-neutral-600 rounded px-1.5 py-1 text-center">
                <p className="text-xs font-semibold text-secondary-800 dark:text-white m-0">{medicineCount}</p>
                <p className="text-[8px] text-secondary-500 dark:text-neutral-400 m-0">Medicine</p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-700/30 border border-neutral-200 dark:border-neutral-600 rounded px-1.5 py-1 text-center">
                <p className="text-xs font-semibold text-secondary-800 dark:text-white m-0">{suppliesCount}</p>
                <p className="text-[8px] text-secondary-500 dark:text-neutral-400 m-0">Supply</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. On Hand (Total Stock) - with sub-boxes (Medicine / Medical Supply) */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-2.5 flex flex-col justify-between min-h-[80px] transition-all duration-300 hover:shadow-md hover:border-success-300 dark:hover:border-success-600">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-md bg-success-100 dark:bg-success-900/30 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" /></svg>
            </div>
            <p className="text-lg font-bold text-secondary-800 dark:text-white leading-none">{totalStock.toLocaleString()}</p>
          </div>
          <div className="border-t border-neutral-100 dark:border-neutral-700 pt-1.5">
            <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider m-0 mb-1.5">On Hand</p>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-neutral-50 dark:bg-neutral-700/30 border border-neutral-200 dark:border-neutral-600 rounded px-1.5 py-1 text-center">
                <p className="text-xs font-semibold text-secondary-800 dark:text-white m-0">{medicineStock.toLocaleString()}</p>
                <p className="text-[8px] text-secondary-500 dark:text-neutral-400 m-0">Medicine</p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-700/30 border border-neutral-200 dark:border-neutral-600 rounded px-1.5 py-1 text-center">
                <p className="text-xs font-semibold text-secondary-800 dark:text-white m-0">{suppliesStock.toLocaleString()}</p>
                <p className="text-[8px] text-secondary-500 dark:text-neutral-400 m-0">Supply</p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Expiring - with sub-boxes (Medicine / Medical Supply) */}
        <div className={`bg-white dark:bg-neutral-800 rounded-lg border transition-all duration-300 ${
          (expiringSoon.length + expiredBatches.length) > 0 ? 'border-warning-300 dark:border-warning-600 hover:shadow-lg hover:shadow-warning-500/20' : 'border-neutral-200 dark:border-neutral-700 hover:shadow-md hover:border-warning-300 dark:hover:border-warning-600'
        } p-2.5 flex flex-col justify-between min-h-[80px]`}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
              (expiringSoon.length + expiredBatches.length) > 0 ? 'bg-warning-100 dark:bg-warning-900/30' : 'bg-warning-100 dark:bg-warning-900/30'
            }`}>
              <svg className="w-3.5 h-3.5 text-warning-600 dark:text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-lg font-bold text-secondary-800 dark:text-white leading-none">{expiringSoon.length + expiredBatches.length}</p>
          </div>
          <div className="border-t border-neutral-100 dark:border-neutral-700 pt-1.5">
            <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider m-0 mb-1.5">Expiring</p>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-neutral-50 dark:bg-neutral-700/30 border border-neutral-200 dark:border-neutral-600 rounded px-1.5 py-1 text-center">
                <p className="text-xs font-semibold text-secondary-800 dark:text-white m-0">{expiringSoonMedicines.length + expiredMedicines.length}</p>
                <p className="text-[8px] text-secondary-500 dark:text-neutral-400 m-0">Medicine</p>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-700/30 border border-neutral-200 dark:border-neutral-600 rounded px-1.5 py-1 text-center">
                <p className="text-xs font-semibold text-secondary-800 dark:text-white m-0">{expiringSoonSupplies.length + expiredSupplies.length}</p>
                <p className="text-[8px] text-secondary-500 dark:text-neutral-400 m-0">Supply</p>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Pending Dispense - NO sub-boxes (single box only) */}
        <div onClick={() => onNavigate('dispense')} className={`cursor-pointer group bg-white dark:bg-neutral-800 rounded-lg border transition-all duration-300 ${pendingCount > 0 ? 'border-warning-300 dark:border-warning-600 hover:shadow-lg hover:shadow-warning-500/20' : 'border-neutral-200 dark:border-neutral-700 hover:shadow-md hover:border-warning-300 dark:hover:border-warning-600'} p-2.5 flex flex-col justify-between min-h-[80px]`}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 group-hover:scale-110 transition-all duration-300 ${pendingCount > 0 ? 'bg-warning-100 dark:bg-warning-900/30 animate-pulse' : 'bg-warning-100 dark:bg-warning-900/30'}`}>
              <svg className="w-3.5 h-3.5 text-warning-600 dark:text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <p className="text-xl font-bold text-secondary-800 dark:text-white leading-none">{pendingCount}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider m-0">Pending Dispense</p>
            {pendingCount > 0 && (
              <span className="inline-flex px-1.5 py-0.5 text-[8px] font-bold rounded-full bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 animate-pulse">PENDING</span>
            )}
          </div>
        </div>
      </div>

      {/* Two-column: Low Stock + Expiring Soon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Low Stock Items */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-secondary-800 dark:text-white">
              Low Stock Items <span className="text-secondary-400 dark:text-neutral-500">({lowStockItems.length})</span>
            </h3>
            <button onClick={() => onNavigate('items')} className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline font-medium">View All</button>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {lowStockItems.length === 0 && (
              <div className="p-3 text-center text-xs text-secondary-400 dark:text-neutral-500">No low stock items</div>
            )}
            {lowStockItems.slice(0, 5).map((item) => (
              <button key={item.id} onClick={() => onSelectItem(item)} className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 flex items-center justify-between transition-colors">
                <div>
                  <p className="text-xs font-medium text-secondary-800 dark:text-white m-0">{item.item_name}</p>
                  <p className="text-[10px] text-secondary-400 dark:text-neutral-500 m-0">{item.item_code}</p>
                </div>
                <div className="text-right">
                  {(item.lowStockBranches || []).map(({ location, stock }) => (
                    <p key={location} className="text-xs font-bold text-error-600 dark:text-error-400 m-0">{location}: {stock}</p>
                  ))}
                  <p className="text-[10px] text-secondary-400 dark:text-neutral-500 m-0">Reorder: {item.reorder_level}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-secondary-800 dark:text-white">
              Expiring Soon <span className="text-secondary-400 dark:text-neutral-500">({expiringSoon.length + expiredBatches.length})</span>
            </h3>
            <div className="flex gap-2 items-center">
              <div className="flex gap-1.5 text-[9px]">
                {expiredMedicines.length > 0 && <span className="text-error-600 dark:text-error-400 font-medium">{expiredMedicines.length} med expired</span>}
                {expiredSupplies.length > 0 && <span className="text-error-600 dark:text-error-400 font-medium">{expiredSupplies.length} sup expired</span>}
              </div>
              {expiringSoon.length + expiredBatches.length > 5 && (
                <button 
                  onClick={() => setShowExpiringModal(true)}
                  className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline font-medium ml-2"
                >
                  View All
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {expiredBatches.length === 0 && expiringSoon.length === 0 && (
              <div className="p-3 text-center text-xs text-secondary-400 dark:text-neutral-500">No batches expiring soon</div>
            )}
            {[...expiredBatches, ...expiringSoon].slice(0, 5).map((batch) => {
              const st = getExpiryStatus(batch.expiryDate);
              const item = items.find((i) => String(i.id) === String(batch.medicalItemId));
              return (
                <button key={`${batch.medicalItemId}-${batch.id}`} onClick={() => item && onSelectItem(item)} className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 flex items-center justify-between transition-colors">
                  <div>
                    <p className="text-xs font-medium text-secondary-800 dark:text-white m-0">{item?.item_name || 'Unknown'}</p>
                    <p className="text-[10px] text-secondary-400 dark:text-neutral-500 m-0">{batch.batchNumber} · {batch.location}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-xs text-secondary-600 dark:text-neutral-300">{batch.currentQuantity} units</span>
                    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${st.color}`}>{st.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Expiring Items Modal */}
      <ExpiringItemsModal
        isOpen={showExpiringModal}
        onClose={() => setShowExpiringModal(false)}
        items={items}
        batches={batches}
        onSelectItem={onSelectItem}
      />
    </div>
  );
};

export default InventoryDashboard;
