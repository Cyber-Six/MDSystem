/**
 * Batch Display Utilities
 * Provides consistent batch information formatting for patient and staff views
 */

/**
 * Format date for display (remove time portion)
 * @param {string|number|Date|null} dateValue
 * @returns {string} Formatted date (e.g., "May 2026") or "N/A"
 */
export const formatDateDisplay = (dateValue) => {
  if (!dateValue && dateValue !== 0) return 'N/A';
  try {
    let date;
    if (typeof dateValue === 'string') {
      date = new Date(dateValue);
      if (isNaN(date.getTime())) return 'N/A';
    } else if (typeof dateValue === 'number') {
      date = dateValue > 10000000000 ? new Date(dateValue) : new Date(dateValue * 1000);
      if (isNaN(date.getTime())) return 'N/A';
    } else if (dateValue instanceof Date) {
      if (isNaN(dateValue.getTime())) return 'N/A';
      date = dateValue;
    } else {
      return 'N/A';
    }
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (err) {
    return 'N/A';
  }
};

/**
 * Format batch information in consistent format.
 * Format: "Batch #123 — 47 available — Expires: May 2026"
 * @param {Object} batch - Batch object with batchNumber, availableQuantity|currentQuantity, expiryDate
 * @param {Object} options - { compact?: boolean, showUnit?: boolean }
 * @returns {string} Formatted batch display string
 */
export const formatBatchDisplay = (batch, options = {}) => {
  if (!batch) return 'N/A';
  
  const { compact = false, showUnit = true } = options;
  const batchNum = batch.batchNumber || batch.id || 'Unknown';
  const quantity = batch.availableQuantity ?? batch.currentQuantity ?? 0;
  const unit = showUnit ? ' units' : '';
  const expiryStr = formatDateDisplay(batch.expiryDate);
  
  if (compact) {
    // Compact: "Batch #123 (47 units, Exp: May 2026)"
    return `Batch #${batchNum} (${quantity}${unit}, Exp: ${expiryStr})`;
  }
  
  // Full format: "Batch #123 — 47 available — Expires: May 2026"
  return `Batch #${batchNum} — ${quantity} available — Expires: ${expiryStr}`;
};

/**
 * Get batch summary for dropdowns/selects
 * Format: "#123 (Exp: May 2026) — 47 avail"
 * @param {Object} batch
 * @returns {string}
 */
export const getBatchDropdownText = (batch) => {
  if (!batch) return 'No batch';
  const batchNum = batch.batchNumber || batch.id || '?';
  const expiry = formatDateDisplay(batch.expiryDate);
  const qty = batch.availableQuantity ?? batch.currentQuantity ?? 0;
  return `#${batchNum} (Exp: ${expiry}) — ${qty} avail`;
};
