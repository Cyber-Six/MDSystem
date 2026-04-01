import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, CheckCircle, AlertCircle, FileText, PenLine } from 'lucide-react';
import { useHealthChat } from '../context/health-chat-context';

const EMPTY_RX = () => ({ medicine: '', dosage: '', frequency: '', duration: '', instructions: '' });

const Field = ({ label, value, onChange, placeholder = '', className = '', type = 'text' }) => (
  <div className={`flex flex-col gap-0.5 ${className}`}>
    <label className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 select-none">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent border-b border-neutral-300 dark:border-neutral-600 text-sm text-secondary-900 dark:text-white
                 placeholder-neutral-300 dark:placeholder-neutral-600
                 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400
                 py-1 transition-colors"
    />
  </div>
);

const PrescriptionModal = ({ isOpen, onClose }) => {
  const { activeTicketId, selectedTicket, sendMessage } = useHealthChat();

  const patient     = selectedTicket?.patient;
  const patientName = patient ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() : '';

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    patientName: '',
    age: '',
    sex: '',
    address: '',
    rxItems: [EMPTY_RX()],
    subscription: '',
    signature: '',
    renewal: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [success, setSuccess]       = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSuccess(false);
    setError(null);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      patientName,
      age: '',
      sex: '',
      address: patient?.branch || '',
      rxItems: [EMPTY_RX()],
      subscription: '',
      signature: '',
      renewal: '',
    });
  }, [isOpen]);

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const setRx = (idx, key, val) => {
    setForm(prev => {
      const items = prev.rxItems.map((r, i) => i === idx ? { ...r, [key]: val } : r);
      return { ...prev, rxItems: items };
    });
  };

  const addRx    = () => setForm(prev => ({ ...prev, rxItems: [...prev.rxItems, EMPTY_RX()] }));
  const removeRx = idx => setForm(prev => ({ ...prev, rxItems: prev.rxItems.filter((_, i) => i !== idx) }));

  const buildMessage = () => {
    const divider = 'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€';
    const lines = [
      'ðŸ“‹  PRESCRIPTION',
      divider,
      `ðŸ“… Date:    ${form.date}`,
      `ðŸ‘¤ Patient: ${form.patientName}`,
      form.age     ? `ðŸ”¢ Age:     ${form.age}`     : null,
      form.sex     ? `âš§  Sex:     ${form.sex}`     : null,
      form.address ? `ðŸ“ Address: ${form.address}` : null,
      '',
      divider,
      'â„ž  PRESCRIPTION ITEMS',
      divider,
      ...form.rxItems
        .filter(r => r.medicine.trim())
        .flatMap((r, i) => [
          `${i + 1}. ${r.medicine}`,
          r.dosage       ? `   Dosage:        ${r.dosage}`       : null,
          r.frequency    ? `   Frequency:     ${r.frequency}`    : null,
          r.duration     ? `   Duration:      ${r.duration}`     : null,
          r.instructions ? `   Instructions:  ${r.instructions}` : null,
          '',
        ]),
      form.subscription ? `ðŸ“ Subscription:\n   ${form.subscription}` : null,
      divider,
      form.signature ? `âœï¸  Signature:  ${form.signature}` : null,
      form.renewal   ? `ðŸ”„  Renewal:    ${form.renewal}`   : null,
    ].filter(l => l !== null);

    return lines.join('\n');
  };

  const handleSend = async () => {
    const rxFilled = form.rxItems.some(r => r.medicine.trim());
    if (!rxFilled) { setError('Add at least one medicine in the Rx section.'); return; }
    if (!activeTicketId) { setError('No active chat to send to.'); return; }
    try {
      setSubmitting(true);
      setError(null);
      await sendMessage(activeTicketId, buildMessage(), null, 'text');
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to send prescription.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* â”€â”€ Header â”€â”€ */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30">
              <FileText className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-secondary-900 dark:text-white leading-tight">Prescription</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Fill out and send to patient</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* â”€â”€ Success â”€â”€ */}
        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-base font-semibold text-secondary-900 dark:text-white">Prescription Sent</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-xs">
              The patient has received the prescription in the chat.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-7 py-2.5 rounded-xl text-sm font-semibold text-secondary-900 transition-all"
              style={{ background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)', boxShadow: '0 2px 8px rgba(244,196,48,0.3)' }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* â”€â”€ Prescription Pad (scrollable) â”€â”€ */}
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              <div className="mx-5 my-5 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">

                {/* Pad header */}
                <div className="bg-neutral-50 dark:bg-neutral-800 px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400 dark:text-neutral-500 mb-1">
                    Medical Department
                  </p>
                  <h3 className="text-lg font-black uppercase tracking-widest text-secondary-900 dark:text-white">
                    Prescription
                  </h3>
                </div>

                <div className="px-6 py-5 space-y-5 bg-white dark:bg-neutral-900">

                  {/* Row 1: Date + Patient name */}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Date" value={form.date} onChange={v => setField('date', v)} type="date" />
                    <Field label="Patient Name" value={form.patientName} onChange={v => setField('patientName', v)} placeholder="Full name" />
                  </div>

                  {/* Row 2: Age + Sex + Address */}
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Age" value={form.age} onChange={v => setField('age', v)} placeholder="e.g. 21" />
                    <Field label="Sex" value={form.sex} onChange={v => setField('sex', v)} placeholder="M / F" />
                    <Field label="Address / Branch" value={form.address} onChange={v => setField('address', v)} placeholder="Location" />
                  </div>

                  <div className="border-t border-dashed border-neutral-200 dark:border-neutral-700" />

                  {/* â„ž Inscription */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          <span className="font-black text-base text-emerald-700 dark:text-emerald-300 leading-none" style={{ fontFamily: 'serif' }}>â„ž</span>
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                          Inscription
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={addRx}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold
                                   bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400
                                   hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add medicine
                      </button>
                    </div>

                    <div className="space-y-4">
                      {form.rxItems.map((rx, idx) => (
                        <div key={idx} className="rounded-xl border border-neutral-100 dark:border-neutral-800 p-4 relative">
                          {form.rxItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRx(idx)}
                              className="absolute top-3 right-3 p-1 rounded-md
                                         text-neutral-300 dark:text-neutral-600
                                         hover:text-red-500 dark:hover:text-red-400
                                         hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <div className="grid grid-cols-2 gap-3 pr-6">
                            <Field
                              label={`Medicine ${idx + 1}`}
                              value={rx.medicine}
                              onChange={v => setRx(idx, 'medicine', v)}
                              placeholder="Drug name"
                              className="col-span-2"
                            />
                            <Field label="Dosage"       value={rx.dosage}       onChange={v => setRx(idx, 'dosage', v)}       placeholder="e.g. 500mg" />
                            <Field label="Frequency"    value={rx.frequency}    onChange={v => setRx(idx, 'frequency', v)}    placeholder="e.g. 3x daily" />
                            <Field label="Duration"     value={rx.duration}     onChange={v => setRx(idx, 'duration', v)}     placeholder="e.g. 7 days" />
                            <Field label="Instructions" value={rx.instructions} onChange={v => setRx(idx, 'instructions', v)} placeholder="e.g. after meals" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 dark:border-neutral-700" />

                  {/* Subscription / Notes */}
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 select-none">
                      Subscription / Additional Notes
                    </label>
                    <textarea
                      value={form.subscription}
                      onChange={e => setField('subscription', e.target.value)}
                      placeholder="Any additional prescribing notesâ€¦"
                      rows={2}
                      className="w-full bg-transparent border-b border-neutral-300 dark:border-neutral-600 text-sm
                                 text-secondary-900 dark:text-white placeholder-neutral-300 dark:placeholder-neutral-600
                                 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400
                                 py-1 resize-none transition-colors"
                      style={{ scrollbarWidth: 'none' }}
                    />
                  </div>

                  <div className="border-t border-dashed border-neutral-200 dark:border-neutral-700" />

                  {/* Signature + Renewal */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 select-none flex items-center gap-1">
                        <PenLine className="w-3 h-3" /> Signature
                      </label>
                      <input
                        value={form.signature}
                        onChange={e => setField('signature', e.target.value)}
                        placeholder="Prescriber name / license no."
                        className="w-full bg-transparent border-b border-neutral-300 dark:border-neutral-600 text-sm
                                   text-secondary-900 dark:text-white placeholder-neutral-300 dark:placeholder-neutral-600
                                   focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400
                                   py-1 transition-colors"
                      />
                    </div>
                    <Field label="Renewal" value={form.renewal} onChange={v => setField('renewal', v)} placeholder="e.g. 1x refill / None" />
                  </div>

                  <p className="text-[9px] text-center text-neutral-300 dark:text-neutral-600 pt-1 leading-relaxed border-t border-neutral-100 dark:border-neutral-800">
                    Signature, Address, and Registration Number
                  </p>
                </div>
              </div>
            </div>

            {/* â”€â”€ Footer â”€â”€ */}
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
                  onClick={handleSend}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold
                             transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={!submitting
                    ? { background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)', color: '#1c1a17', boxShadow: '0 2px 8px rgba(244,196,48,0.3)' }
                    : { background: '#e8e5e0', color: '#a19b93' }}
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Sendingâ€¦</>
                    : <><FileText className="w-4 h-4" /> Send Prescription</>
                  }
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PrescriptionModal;
