import React, { useMemo, useState, useEffect } from 'react';
import { getExpiryStatus, CATEGORY_COLORS } from '../../inventory-seed-data';

/**
 * Inventory Dashboard — overview cards + alerts.
 * Dynamic dashboard with animations, progress bars, status badges, and trend indicators.
 */
const InventoryDashboard = ({ items, batches, requests, transactions, onNavigate, onSelectItem }) => {
  const pendingCount = requests.filter((r) => r.status === 'InProgress').length;
  const totalItems = items.length;
  const getStock = (b) => b.availableQuantity ?? b.currentQuantity ?? 0;
  const totalStock = batches.reduce((s, b) => s + getStock(b), 0);
  const lowStockItems = items.filter((i) => i.isLowStock);
  const expiringSoon = batches.filter((b) => {
    if (!b.expiryDate) return false;
    const days = Math.ceil((new Date(b.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 60; // 2 months before expiry
  });
  const expiredBatches = batches.filter((b) => b.expiryDate && new Date(b.expiryDate) < new Date());

  const casalStock = batches.filter((b) => b.location === 'Casal').reduce((s, b) => s + getStock(b), 0);
  const arlegui = batches.filter((b) => b.location === 'Arlegui').reduce((s, b) => s + getStock(b), 0);
  const quezonCity = batches.filter((b) => b.location === 'QuezonCity').reduce((s, b) => s + getStock(b), 0);

  // Calculate stock level percentage (assuming reasonable max inventory)
  const maxInventory = 10000;
  const stockPercentage = Math.min((totalStock / maxInventory) * 100, 100);

  // Track previous values to show trend arrows
  const [prevMetrics, setPrevMetrics] = useState({
    totalStock,
    pendingCount,
    alerts: lowStockItems.length + expiringSoon.length + expiredBatches.length
  });

  const [showTrend, setShowTrend] = useState({});

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
  const alertSeverity = expiredBatches.length > 0 ? 'critical' : expiringSoon.length > 2 || lowStockItems.length > 2 ? 'high' : lowStockItems.length > 0 || expiringSoon.length > 0 ? 'medium' : 'healthy';
  const alertColor = {
    critical: 'from-error-50 to-error-100/50 dark:from-error-900/20 dark:to-error-900/10',
    high: 'from-warning-50 to-warning-100/50 dark:from-warning-900/20 dark:to-warning-900/10',
    medium: 'from-accent-50 to-accent-100/50 dark:from-accent-900/20 dark:to-accent-900/10',
    healthy: 'from-success-50 to-success-100/50 dark:from-success-900/20 dark:to-success-900/10'
  };

  const recentTx = transactions.slice(0, 5);

  const actionMap = {
    issue: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
    receive: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    adjust: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
    transfer: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
  };

  return (
    <div className="space-y-2">
      {/* Stat Cards Row with Dynamic Animations */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Total Items */}
        <div onClick={() => onNavigate('items')} className="cursor-pointer group bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-2.5 flex flex-col justify-between min-h-[80px] transition-all duration-300 hover:shadow-md hover:border-accent-300 dark:hover:border-accent-600">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
              <svg className="w-3.5 h-3.5 text-accent-600 dark:text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <p className="text-xl font-bold text-secondary-800 dark:text-white leading-none">{totalItems}</p>
          </div>
          <div>
            <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider m-0">Medical Items</p>
          </div>
        </div>

        {/* Total Stock with Progress */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-2.5 flex flex-col justify-between min-h-[80px] transition-all duration-300 hover:shadow-md hover:border-success-300 dark:hover:border-success-600">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-md bg-success-100 dark:bg-success-900/30 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" /></svg>
            </div>
            <p className="text-xl font-bold text-secondary-800 dark:text-white leading-none">{totalStock.toLocaleString()}</p>
          </div>
          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden mb-1">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                stockPercentage > 75 ? 'bg-success-500' : 
                stockPercentage > 50 ? 'bg-accent-500' : 
                stockPercentage > 25 ? 'bg-warning-500' : 
                'bg-error-500'
              }`}
              style={{ width: `${stockPercentage}%` }}
            />
          </div>
          <div>
            <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Total On-Hand</p>
            <div className="flex gap-2 text-[9px]">
              <span className="text-secondary-400 dark:text-neutral-500">Casal: {casalStock}</span>
              <span className="text-secondary-400 dark:text-neutral-500">Arlegui: {arlegui}</span>
              <span className="text-secondary-400 dark:text-neutral-500">QC: {quezonCity}</span>
            </div>
          </div>
        </div>

        {/* Pending Dispense with Urgency Badge */}
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

        {/* Alerts with Severity Indicator */}
        <div className={`bg-white dark:bg-neutral-800 rounded-lg border transition-all duration-300 ${alertSeverity === 'critical' ? 'border-error-300 dark:border-error-600 shadow-lg shadow-error-500/10' : alertSeverity === 'high' ? 'border-warning-300 dark:border-warning-600 shadow-lg shadow-warning-500/10' : 'border-neutral-200 dark:border-neutral-700'} p-2.5 flex flex-col justify-between min-h-[80px]`}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
              alertSeverity === 'critical' ? 'bg-error-100 dark:bg-error-900/30 animate-pulse' :
              alertSeverity === 'high' ? 'bg-warning-100 dark:bg-warning-900/30 animate-pulse' :
              alertSeverity === 'medium' ? 'bg-accent-100 dark:bg-accent-900/30' :
              'bg-success-100 dark:bg-success-900/30'
            }`}>
              <svg className={`w-3.5 h-3.5 ${
                alertSeverity === 'critical' ? 'text-error-600 dark:text-error-400' :
                alertSeverity === 'high' ? 'text-warning-600 dark:text-warning-400' :
                alertSeverity === 'medium' ? 'text-accent-600 dark:text-accent-400' :
                'text-success-600 dark:text-success-400'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {lowStockItems.length > 0 && <span className="text-[10px] text-warning-600 dark:text-warning-400 font-medium">{lowStockItems.length} low</span>}
              {expiringSoon.length > 0 && <span className="text-[10px] text-warning-600 dark:text-warning-400 font-medium">{expiringSoon.length} expiring</span>}
              {expiredBatches.length > 0 && <span className="text-[10px] text-error-600 dark:text-error-400 font-medium">{expiredBatches.length} expired</span>}
              {lowStockItems.length === 0 && expiringSoon.length === 0 && expiredBatches.length === 0 && (
                <span className="text-[10px] text-success-600 dark:text-success-400 font-medium">✓ All clear</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-secondary-500 dark:text-neutral-400 uppercase tracking-wider m-0">Alerts</p>
            {alertSeverity === 'critical' && (
              <span className="inline-flex px-1.5 py-0.5 text-[8px] font-bold rounded-full bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 animate-pulse">CRITICAL</span>
            )}
            {alertSeverity === 'high' && (
              <span className="inline-flex px-1.5 py-0.5 text-[8px] font-bold rounded-full bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400">URGENT</span>
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
                  <p className="text-xs font-bold text-error-600 dark:text-error-400 m-0">{item.totalStock} left</p>
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
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {expiredBatches.length === 0 && expiringSoon.length === 0 && (
              <div className="p-3 text-center text-xs text-secondary-400 dark:text-neutral-500">No batches expiring soon</div>
            )}
            {[...expiredBatches, ...expiringSoon].slice(0, 5).map((batch) => {
              const st = getExpiryStatus(batch.expiryDate);
              const item = items.find((i) => i.id === batch.medicalItemId);
              return (
                <div key={`${batch.medicalItemId}-${batch.id}`} className="px-3 py-1.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-secondary-800 dark:text-white m-0">{item?.item_name || 'Unknown'}</p>
                    <p className="text-[10px] text-secondary-400 dark:text-neutral-500 m-0">{batch.batchNumber} · {batch.location}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-xs text-secondary-600 dark:text-neutral-300">{batch.currentQuantity} units</span>
                    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${st.color}`}>{st.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-secondary-800 dark:text-white">
            Recent Activity <span className="text-secondary-400 dark:text-neutral-500">({recentTx.length})</span>
          </h3>
          <button onClick={() => onNavigate('history')} className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline font-medium">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-700/50 border-b-2 border-neutral-200 dark:border-neutral-600">
              <tr>
                <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Action</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Item</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Batch</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Qty</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">By</th>
                <th className="px-3 py-1.5 text-left text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {recentTx.map((tx) => (
                <tr key={tx.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                  <td className="px-3 py-1.5">
                    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded capitalize ${actionMap[tx.action] || ''}`}>{tx.action}</span>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-secondary-700 dark:text-neutral-300">{tx.itemName}</td>
                  <td className="px-3 py-1.5 text-xs text-secondary-500 dark:text-neutral-400 font-mono">{tx.batchNumber}</td>
                  <td className="px-3 py-1.5 text-xs font-medium text-secondary-800 dark:text-white">{tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}</td>
                  <td className="px-3 py-1.5 text-xs text-secondary-500 dark:text-neutral-400">{tx.issuedByName}</td>
                  <td className="px-3 py-1.5 text-xs text-secondary-400 dark:text-neutral-500">{new Date(tx.issuedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryDashboard;
