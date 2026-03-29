import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { generatePrescriptionPdf } from '../prescription-service';

const FREQUENCY_OPTIONS = [
  'OD (Once daily)',
  'BID (Twice daily)',
  'TID (Three times daily)',
  'QID (Four times daily)',
  'q4h (Every 4 hours)',
  'q6h (Every 6 hours)',
  'q8h (Every 8 hours)',
  'q12h (Every 12 hours)',
  'PRN (As needed)',
  'STAT (Immediately)',
  'HS (At bedtime)',
  'AC (Before meals)',
  'PC (After meals)',
];

const emptyMed = () => ({
  id: Date.now() + Math.random(),
  name: '',
  dosage: '',
  frequency: '',
  duration: '',
  quantity: '',
  instructions: '',
});

/**
 * Utility: compute age string from ISO date of birth.
 */
const calcAge = (dob) => {
  if (!dob) return '';
  const birth = new Date(dob);
  if (isNaN(birth)) return '';
  const diff = Date.now() - birth.getTime();
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return String(years);
};

/**
 * PrescriptionPanel — right-side panel (Facebook-style) for writing prescriptions
 * while keeping the chat visible. Renders as a flex sibling of the chat column.
 */
const PrescriptionPanel = ({ isOpen, onClose, patientId, patientName, patientAge, patientSex, patientDob, activeTicketId, sendMessage }) => {
  const [medications, setMedications] = useState([emptyMed()]);
  const [notes, setNotes]             = useState('');
  const [name, setName]               = useState('');
  const [age, setAge]                 = useState('');
  const [sex, setSex]                 = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState(null);
  const [success, setSuccess]         = useState(false);
  const [pdfUrl, setPdfUrl]           = useState(null);

  /* Reset form when panel opens */
  useEffect(() => {
    if (!isOpen) return;
    setMedications([emptyMed()]);
    setNotes('');
    setName(patientName || '');
    setAge(patientAge || calcAge(patientDob));
    setSex(patientSex || '');
    setSubmitting(false);
    setError(null);
    setSuccess(false);
    setPdfUrl(null);
  }, [isOpen, patientName, patientAge, patientSex, patientDob]);

  /* ── Medication helpers ── */
  const addMedication    = () => setMedications(prev => [...prev, emptyMed()]);
  const removeMedication = (id) => setMedications(prev => prev.length > 1 ? prev.filter(m => m.id !== id) : prev);
  const updateMedication = (id, field, value) =>
    setMedications(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));

  /* ── Submit ── */
  const handleSubmit = async () => {
    const filled = medications.filter(m => m.name.trim());
    if (!name.trim()) { setError('Patient name is required.'); return; }
    if (filled.length === 0) { setError('Add at least one medicine.'); return; }
    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        patient_name: name.trim(),
        patient_age:  age.trim(),
        patient_sex:  sex.trim(),
        medications:  filled.map(({ name, dosage, frequency, duration, quantity, instructions }) => ({
          name: name.trim(),
          dosage: dosage.trim(),
          frequency: frequency.trim(),
          duration: duration.trim(),
          quantity: quantity.trim(),
          instructions: instructions.trim(),
        })),
        notes: notes.trim(),
      };

      const blob = await generatePrescriptionPdf(payload);
      const url  = URL.createObjectURL(blob);
      setPdfUrl(url);
      setSuccess(true);

      /* Auto-send as file in health chat if ticket is active */
      if (activeTicketId && sendMessage) {
        try {
          const lastName = (name.trim() || 'patient').split(',')[0].split(' ').pop();
          const file = new File([blob], `${lastName}_prescription.pdf`, { type: 'application/pdf' });

          const { uploadFile } = await import('../health-chat-service');
          const fileId = await uploadFile(file);
          await sendMessage(activeTicketId, null, fileId, 'file');
        } catch (sendErr) {
          console.warn('[PrescriptionPanel] Auto-send failed, PDF still available for download:', sendErr);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to generate prescription.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = `w-full px-2.5 py-1.5 rounded-lg text-xs
    bg-neutral-100 dark:bg-neutral-800
    border border-neutral-200 dark:border-neutral-700
    text-secondary-900 dark:text-white
    placeholder-neutral-400 dark:placeholder-neutral-500
    focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20`;

  const hasMeds = medications.some(m => m.name.trim());

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-700"
      style={{ width: '380px', flexShrink: 0 }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30">
            <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-secondary-900 dark:text-white leading-tight">
              Issue Prescription
            </h2>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Success screen ── */}
      {success ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-secondary-900 dark:text-white">
            Prescription Sent
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center max-w-[220px]">
            {activeTicketId
              ? 'The prescription PDF has been sent in the chat.'
              : 'Download the prescription PDF below.'}
          </p>
          {pdfUrl && (
            <a
              href={pdfUrl}
              download={`${(name.trim() || 'patient').split(',')[0].split(' ').pop()}_prescription.pdf`}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium
                         bg-neutral-100 dark:bg-neutral-800 text-secondary-900 dark:text-white
                         hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Download PDF
            </a>
          )}
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => { setSuccess(false); setPdfUrl(null); setMedications([emptyMed()]); setNotes(''); setError(null); }}
              className="px-4 py-1.5 rounded-lg text-xs font-medium
                         text-neutral-600 dark:text-neutral-300
                         hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              New Prescription
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-secondary-900 transition-all"
              style={{
                background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                boxShadow: '0 2px 8px rgba(244,196,48,0.3)'
              }}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Body (scrollable) ── */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            style={{ scrollbarWidth: 'thin' }}
          >
            {/* ── Patient info ── */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Patient
              </p>
              <div className="space-y-1.5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name *"
                  className={inputCls}
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Age"
                    className={inputCls}
                  />
                  <select
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    className={inputCls + ' appearance-none'}
                  >
                    <option value="">Sex</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Medication entries ── */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Medications ({medications.filter(m => m.name.trim()).length})
              </p>
              <div className="space-y-2">
                {medications.map((med, idx) => (
                  <div
                    key={med.id}
                    className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-2.5 space-y-1.5 border border-neutral-100 dark:border-neutral-700/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500">
                        #{idx + 1}
                      </span>
                      <button
                        onClick={() => removeMedication(med.id)}
                        className="text-neutral-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      <input
                        value={med.name}
                        onChange={(e) => updateMedication(med.id, 'name', e.target.value)}
                        placeholder="Medicine name *"
                        className={inputCls + ' col-span-3'}
                      />
                      <input
                        value={med.dosage}
                        onChange={(e) => updateMedication(med.id, 'dosage', e.target.value)}
                        placeholder="Dosage"
                        className={inputCls + ' col-span-2'}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <select
                        value={med.frequency}
                        onChange={(e) => updateMedication(med.id, 'frequency', e.target.value)}
                        className={inputCls + ' appearance-none'}
                      >
                        <option value="">Frequency</option>
                        {FREQUENCY_OPTIONS.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                      <input
                        value={med.duration}
                        onChange={(e) => updateMedication(med.id, 'duration', e.target.value)}
                        placeholder="Duration"
                        className={inputCls}
                      />
                      <input
                        value={med.quantity}
                        onChange={(e) => updateMedication(med.id, 'quantity', e.target.value)}
                        placeholder="Qty"
                        className={inputCls}
                      />
                    </div>
                    <input
                      value={med.instructions}
                      onChange={(e) => updateMedication(med.id, 'instructions', e.target.value)}
                      placeholder="Instructions (e.g. after meals)"
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={addMedication}
                className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                           text-emerald-600 dark:text-emerald-400
                           hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Medicine
              </button>
            </div>

            {/* ── Notes ── */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Notes
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes (optional)…"
                rows={2}
                className={inputCls + ' resize-none'}
                style={{ scrollbarWidth: 'none' }}
              />
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 flex-shrink-0">
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 mb-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="line-clamp-2">{error}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                           text-neutral-600 dark:text-neutral-300
                           hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !hasMeds}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold
                           transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={!submitting && hasMeds ? {
                  background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                  color: '#1c1a17',
                  boxShadow: '0 2px 8px rgba(244,196,48,0.3)'
                } : {
                  background: '#e8e5e0',
                  color: '#a19b93'
                }}
              >
                {submitting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <FileText className="w-3.5 h-3.5" />
                }
                Generate
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PrescriptionPanel;
