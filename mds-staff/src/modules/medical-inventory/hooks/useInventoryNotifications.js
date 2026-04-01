import { useMemo } from 'react';

/**
 * Days ahead of expiry that triggers an expiring-soon notification.
 * Batches expiring within this window (or already expired) will be included.
 */
const EXPIRY_WARN_DAYS = 60;

/**
 * Derives structured inventory notifications from enriched items and batches.
 *
 * Notification types:
 *  - "low-stock"  — item totalStock ≤ reorder_level
 *  - "expiring"   — batch expires within EXPIRY_WARN_DAYS days
 *  - "expired"    — batch expiryDate is in the past
 *
 * @param {Array} enrichedItems  Output of computeItemStats (items with totalStock, isLowStock, etc.)
 * @param {Array} batches        Flat list of medicine / supply batches
 * @returns {{ notifications: Array, grouped: object, counts: object }}
 */
export function useInventoryNotifications(enrichedItems = [], batches = []) {
  const notifications = useMemo(() => {
    const result = [];
    const now = new Date();

    // ── Low-stock notifications (per branch) ────────────────────────────
    enrichedItems.forEach((item) => {
      if (!item.isLowStock) return;

      const category = item.category?.toLowerCase();
      const lowBranches = item.lowStockBranches || [];

      lowBranches.forEach(({ location, stock }) => {
        // Find all batches for this item in this location
        const batchesForThisBranch = (batches || []).filter(
          (b) => String(b.medicalItemId) === String(item.id) && b.location === location
        );
        const batchNumbers = batchesForThisBranch.map((b) => b.batchNumber).filter(Boolean);
        const batchLabel = batchNumbers.length > 0 ? ` · Batch ${batchNumbers.join(', ')}` : '';

        result.push({
          id: `low-stock-${item.id}-${location}`,
          notificationType: 'low-stock',
          itemType: category === 'medicine' ? 'Medicine' : 'Medical Supply',
          itemId: item.id,
          batchId: null,
          itemName: item.item_name,
          location,
          detail: `${stock} unit${stock === 1 ? '' : 's'} remaining in ${location}${batchLabel}`,
          currentQuantity: stock,
          reorderLevel: item.reorder_level,
          expiryDate: null,
          daysLeft: null,
        });
      });
    });

    // ── Expiring / expired notifications ────────────────────────────────
    // Build a map for quick item lookup
    const itemMap = new Map(enrichedItems.map((i) => [String(i.id), i]));

    batches.forEach((batch) => {
      if (!batch.expiryDate) return;

      const expiry = new Date(batch.expiryDate);
      const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

      if (daysLeft > EXPIRY_WARN_DAYS) return;

      const item = itemMap.get(String(batch.medicalItemId));
      const itemName = item?.item_name ?? `Item #${batch.medicalItemId}`;
      const category = item?.category?.toLowerCase();
      const itemType = category === 'medicine' ? 'Medicine' : 'Medical Supply';

      const notificationType = daysLeft < 0 ? 'expired' : 'expiring';

      const expiryLabel =
        daysLeft < 0
          ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`
          : daysLeft === 0
          ? 'Expires today'
          : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;

      result.push({
        id: `${notificationType}-batch-${batch.id}`,
        notificationType,
        itemType,
        itemId: batch.medicalItemId,
        batchId: batch.id,
        itemName,
        batchNumber: batch.batchNumber,
        location: batch.location,
        detail: `${expiryLabel} · Batch ${batch.batchNumber}${batch.location ? ` · ${batch.location}` : ''}`,
        currentQuantity: batch.availableQuantity ?? batch.currentQuantity ?? 0,
        reorderLevel: null,
        expiryDate: batch.expiryDate,
        daysLeft,
      });
    });

    return result;
  }, [enrichedItems, batches]);

  const grouped = useMemo(() => {
    const lowStock = notifications.filter((n) => n.notificationType === 'low-stock');
    const expiring = notifications.filter((n) => n.notificationType === 'expiring');
    const expired = notifications.filter((n) => n.notificationType === 'expired');
    return { lowStock, expiring, expired };
  }, [notifications]);

  const counts = useMemo(
    () => ({
      lowStock: grouped.lowStock.length,
      expiring: grouped.expiring.length,
      expired: grouped.expired.length,
      total: notifications.length,
    }),
    [notifications, grouped],
  );

  return { notifications, grouped, counts };
}
