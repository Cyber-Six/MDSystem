import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Plus, Minus, Trash2, Loader2, Pill, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { getAvailableMedicine, issuePrescription } from '../prescription-service';

const PrescriptionModal = ({ isOpen, onClose, patientId }) => {
  const [medicines, setMedicines]           = useState([]);
  const [search, setSearch]                 = useState('');
  const [cart, setCart]                     = useState([]);
  const [notes, setNotes]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState(null);
  const [success, setSuccess]               = useState(false);
  const [locationFilter, setLocationFilter] = useState(null);

  const loadMedicines = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAvailableMedicine(locationFilter, 0, 200);
      setMedicines(data || []);
    } catch {
      setError('Failed to load available medicines. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [locationFilter]);

  useEffect(() => {
    if (!isOpen) return;
    setSuccess(false);
    setError(null);
    setCart([]);
    setNotes('');
    setSearch('');
    setLocationFilter(null);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) loadMedicines();
  }, [isOpen, loadMedicines]);

  const filtered = search.trim()
    ? medicines.filter(m =>
        m.item_name?.toLowerCase().includes(search.toLowerCase()) ||
        m.item_code?.toLowerCase().includes(search.toLowerCase()) ||
        m.batchNumber?.toLowerCase().includes(search.toLowerCase())
      )
    : medicines;

  const addToCart = (med) => {
    setCart(prev => {
      const existing = prev.find(i => i.batchId === med.batchId);
      if (existing) {
        return prev.map(i => i.batchId === med.batchId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        batchId: med.batchId,
        item_name: med.item_name,
        dosageUnit: med.dosageUnit,
        dosageValue: med.dosageValue,
        batchNumber: med.batchNumber,
        location: med.location,
        quantity: 1
      }];
    });
  };

  const updateQty = (batchId, qty) => {
    if (qty < 1) { setCart(prev => prev.filter(i => i.batchId !== batchId)); return; }
    setCart(prev => prev.map(i => i.batchId === batchId ? { ...i, quantity: qty } : i));
  };

  const removeFromCart = (batchId) => setCart(prev => prev.filter(i => i.batchId !== batchId));

  const handleSubmit = async () => {
    if (!patientId) { setError('No patient selected.'); return; }
    if (cart.length === 0) { setError('Add at least one medicine.'); return; }
    try {
      setSubmitting(true);
      setError(null);
      await issuePrescription({
        patientId: parseInt(patientId),
        items: cart.map(i => ({ batchId: parseInt(i.batchId), quantity: i.quantity })),
        notes: notes.trim() || null
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to issue prescription.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const LOCATIONS = ['Arlegui', 'Casal', 'QuezonCity'];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30">
              <Pill className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-secondary-900 dark:text-white leading-tight">
                Issue Prescription
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Select medicines and set quantities
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Success screen ── */}
        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-base font-semibold text-secondary-900 dark:text-white">
              Prescription Issued
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-xs">
              The patient has been notified of their prescription.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-7 py-2.5 rounded-xl text-sm font-semibold text-secondary-900 transition-all"
              style={{
                background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                boxShadow: '0 2px 8px rgba(244,196,48,0.3)'
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* ── Body ── */}
            <div className="flex flex-1 min-h-0 divide-x divide-neutral-200 dark:divide-neutral-700">

              {/* Left: medicine catalogue */}
              <div className="flex-1 flex flex-col min-h-0 p-4 gap-3">

                {/* Search + location filter */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name, code, batch…"
                      className="w-full pl-8 pr-3 py-2 rounded-xl text-xs
                                 bg-neutral-100 dark:bg-neutral-800
                                 border border-neutral-200 dark:border-neutral-700
                                 text-secondary-900 dark:text-white
                                 placeholder-neutral-400 dark:placeholder-neutral-500
                                 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                  <button
                    onClick={loadMedicines}
                    disabled={loading}
                    className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Location chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setLocationFilter(null)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors border
                      ${locationFilter === null
                        ? 'border-primary-500 bg-primary-500/10 text-primary-700 dark:text-primary-400'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                  >
                    All Locations
                  </button>
                  {LOCATIONS.map(loc => (
                    <button
                      key={loc}
                      onClick={() => setLocationFilter(loc)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors border
                        ${locationFilter === loc
                          ? 'border-primary-500 bg-primary-500/10 text-primary-700 dark:text-primary-400'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>

                {/* Medicine list */}
                <div
                  className="flex-1 overflow-y-auto space-y-0.5 -mx-1 px-1"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="text-xs text-center text-neutral-400 py-12">
                      {search ? 'No medicines match your search' : 'No medicines available'}
                    </p>
                  ) : (
                    filtered.map((med) => {
                      const inCart = cart.some(i => i.batchId === med.batchId);
                      return (
                        <button
                          key={`${med.id}-${med.batchId}`}
                          onClick={() => addToCart(med)}
                          className={`w-full flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl
                                      text-left transition-colors
                                      ${inCart
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent'
                                      }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-secondary-800 dark:text-white truncate">
                              {med.item_name}
                            </p>
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                              {med.dosageValue}{med.dosageUnit}
                              {' · '}Batch {med.batchNumber}
                              {med.location && ` · ${med.location}`}
                            </p>
                          </div>
                          <Plus className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${inCart ? 'text-emerald-500' : 'text-neutral-400'}`} />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right: cart + notes */}
              <div className="w-52 flex flex-col min-h-0 p-4 gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 flex-shrink-0">
                  Prescription ({cart.length})
                </p>

                <div
                  className="flex-1 overflow-y-auto space-y-2"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {cart.length === 0 ? (
                    <p className="text-xs text-neutral-400 text-center py-6 leading-relaxed">
                      Click any medicine to add it
                    </p>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.batchId}
                        className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-2.5"
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <p className="text-[11px] font-medium text-secondary-800 dark:text-white leading-snug">
                            {item.item_name}
                          </p>
                          <button
                            onClick={() => removeFromCart(item.batchId)}
                            className="text-neutral-400 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mb-2">
                          {item.dosageValue}{item.dosageUnit}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateQty(item.batchId, item.quantity - 1)}
                            className="w-5 h-5 rounded-md flex items-center justify-center
                                       text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="text-xs w-5 text-center font-semibold text-secondary-800 dark:text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(item.batchId, item.quantity + 1)}
                            className="w-5 h-5 rounded-md flex items-center justify-center
                                       text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes (optional)…"
                  rows={2}
                  className="px-3 py-2 rounded-xl text-xs resize-none flex-shrink-0
                             bg-neutral-100 dark:bg-neutral-800
                             border border-neutral-200 dark:border-neutral-700
                             text-secondary-900 dark:text-white
                             placeholder-neutral-400 dark:placeholder-neutral-500
                             focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  style={{ scrollbarWidth: 'none' }}
                />
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex-shrink-0">
              {error && (
                <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 mb-3">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium rounded-xl transition-colors
                             text-neutral-600 dark:text-neutral-300
                             hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || cart.length === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold
                             transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={!submitting && cart.length > 0 ? {
                    background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                    color: '#1c1a17',
                    boxShadow: '0 2px 8px rgba(244,196,48,0.3)'
                  } : {
                    background: '#e8e5e0',
                    color: '#a19b93'
                  }}
                >
                  {submitting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Pill className="w-4 h-4" />
                  }
                  Issue Prescription
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrescriptionModal;
