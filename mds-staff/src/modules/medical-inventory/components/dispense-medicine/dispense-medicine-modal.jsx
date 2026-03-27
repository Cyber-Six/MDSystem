import React, { useState, useEffect } from 'react';
import { fetchAvailableMedicine, issuePrescription } from '../../prescription-service';
import { getDisplayLocation } from '../../medical-inventory-service';

// Helper to format date for display (remove time portion)
const formatDateDisplay = (dateValue) => {
  if (!dateValue) return 'N/A';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (err) {
    return 'N/A';
  }
};

/**
 * Dispense Medicine Modal — issue medicine batch(es) to a patient.
 * Creates MedicineEntity assignments and transaction record with full audit trail.
 */
const DispenseMedicineModal = ({ patientId, patientName, onClose, onSuccess }) => {
  const [medicines, setMedicines] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [location, setLocation] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filterLocation, setFilterLocation] = useState('All');

  // Fetch available medicines on mount
  useEffect(() => {
    const loadMedicines = async () => {
      try {
        setLoading(true);
        const data = await fetchAvailableMedicine(filterLocation === 'All' ? null : filterLocation);
        setMedicines(data);
      } catch (err) {
        setError(err.message || 'Failed to load medicines');
      } finally {
        setLoading(false);
      }
    };
    loadMedicines();
  }, [filterLocation]);

  // Filter medicines by search
  const filtered = medicines.filter((m) => {
    const q = searchText.toLowerCase();
    return (
      m.item_name.toLowerCase().includes(q) ||
      m.item_code.toLowerCase().includes(q) ||
      m.batchNumber.toLowerCase().includes(q)
    );
  });

  // Toggle medicine selection
  const toggleItem = (medicineId) => {
    setSelectedItems((prev) =>
      prev.includes(medicineId) ? prev.filter((id) => id !== medicineId) : [...prev, medicineId]
    );
  };

  // Submit prescription
  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (selectedItems.length === 0) {
      setError('Please select at least one medicine');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // Group selected medicines by batch for the input
      const items = selectedItems.map((medicineId) => {
        const med = medicines.find((m) => m.id === medicineId);
        return {
          batchId: med.batchId,
          quantity: 1, // 1 entity = 1 unit of that strength
        };
      });

      const result = await issuePrescription({
        patientId: Number(patientId),
        items,
        notes: notes.trim() || null,
      });

      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to issue prescription');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = selectedItems.length;
  const locations = ['All', 'Arlegui', 'Casal', 'QuezonCity'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-800 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-secondary-900 dark:text-white">Dispense Medicine</h2>
            <p className="text-[11px] text-secondary-500 dark:text-neutral-400 leading-none mt-0.5">
              Issue medicine to <span className="font-medium">{patientName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-secondary-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Filters */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block">
              Clinic Location
            </label>
            <div className="flex gap-2 flex-wrap">
              {locations.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setFilterLocation(l)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filterLocation === l
                      ? 'bg-primary-500 text-white shadow-md'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                  }`}
                >
                  {l === 'All' ? 'All Locations' : getDisplayLocation(l)}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
              Search Medicine
            </label>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by name, code, or batch number…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 text-error-700 dark:text-error-400 text-xs rounded-lg">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="text-center py-8">
              <svg className="animate-spin w-5 h-5 text-primary-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-xs text-secondary-500 dark:text-neutral-400">Loading medicines…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-secondary-400 dark:text-neutral-500">
              No medicines available in selected location
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] text-secondary-500 dark:text-neutral-400 font-medium uppercase tracking-wider mb-2">
                Available Medicines ({filtered.length})
              </p>
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg max-h-64 overflow-y-auto">
                {filtered.map((med) => (
                  <label
                    key={med.id}
                    className="flex items-start gap-3 px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-700 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-700 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(med.id)}
                      onChange={() => toggleItem(med.id)}
                      className="mt-1 rounded border-neutral-300 dark:border-neutral-600 text-primary-500 focus:ring-primary-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-secondary-800 dark:text-white">
                        {med.item_name} ({med.dosageValue} {med.dosageUnit})
                      </p>
                      <p className="text-[10px] text-secondary-400 dark:text-neutral-500 leading-none mt-0.5">
                        {med.item_code} • Batch: {med.batchNumber}
                      </p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                          {getDisplayLocation(med.location)}
                        </span>
                        <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-400">
                          Expires: {formatDateDisplay(med.expiryDate)}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider block mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes (dosage instructions, refills, etc.)"
              className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-secondary-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>

          {/* Selection summary */}
          {selectedCount > 0 && (
            <div className="px-3 py-2 bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 rounded-lg">
              <p className="text-xs text-accent-800 dark:text-accent-400">
                <span className="font-semibold">{selectedCount}</span> medicine{selectedCount !== 1 ? 's' : ''} selected for dispensing
              </p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="sticky bottom-0 bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-secondary-700 dark:text-neutral-300 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedCount === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-success-500 hover:bg-success-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Dispensing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Dispense Medicine
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DispenseMedicineModal;
