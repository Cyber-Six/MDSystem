import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Loader2, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react';
import { generatePrescription, downloadDocumentBlob } from '../prescription-document-service';
import { uploadFile } from '../health-chat-service';

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

const calcAge = (dob) => {
  if (!dob) return '';
  const birth = new Date(dob);
  if (isNaN(birth)) return '';
  const years = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return String(years);
};

const PrescriptionPanel = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  patientDob,
  patientSex,
  activeTicketId,
  sendMessage,
}) => {
  const [medications, setMedications] = useState([emptyMed()]);
  const [diagnosis, setDiagnosis] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [documentId, setDocumentId] = useState(null);

  // Reset form when panel opens
  useEffect(() => {
    if (!isOpen) return;
    setMedications([emptyMed()]);
    setDiagnosis('');
    setSpecialInstructions('');
    setFollowUpDate('');
    setName(patientName || '');
    setAge(calcAge(patientDob) || '');
    setSex(patientSex || '');
    setAddress('');
    setSubmitting(false);
    setError(null);
    setSuccess(false);
    setPdfUrl(null);
    setDocumentId(null);
  }, [isOpen, patientName, patientDob, patientSex]);

  // Cleanup blob URL
  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [pdfUrl]);

  const addMedication = () => setMedications(prev => [...prev, emptyMed()]);
  const removeMedication = (id) => setMedications(prev => prev.length > 1 ? prev.filter(m => m.id !== id) : prev);
  const updateMedication = (id, field, value) =>
    setMedications(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));

  const handleSubmit = useCallback(async () => {
    const filled = medications.filter(m => m.name.trim());
    if (!name.trim()) { setError('Patient name is required.'); return; }
    if (filled.length === 0) { setError('Add at least one medication.'); return; }

    try {
      setSubmitting(true);
      setError(null);

      // Split name for the template (best-effort: "First Last")
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

      const payload = {
        patient: {
          id: patientId || undefined,
          firstName,
          middleName,
          lastName,
          dateOfBirth: patientDob || undefined,
          sex: sex || undefined,
          address: address || undefined,
        },
        issuedDate: new Date().toISOString().split('T')[0],
        prescription: {
          diagnosis: diagnosis.trim() || undefined,
          medications: filled.map(m => ({
            name: m.name.trim(),
            dosage: m.dosage.trim() || undefined,
            frequency: m.frequency || undefined,
            duration: m.duration.trim() || undefined,
            quantity: parseInt(m.quantity) || undefined,
            instructions: m.instructions.trim() || undefined,
          })),
          specialInstructions: specialInstructions.trim() || undefined,
          followUpDate: followUpDate || undefined,
        },
      };

      // 1. Generate prescription PDF (saved to DB)
      const result = await generatePrescription(patientId, payload);
      setDocumentId(result.documentId);

      // 2. Download the PDF as blob
      const pdfBlob = await downloadDocumentBlob(result.documentId);
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);

      // 3. Auto-send as file in health-chat if ticket is active
      if (activeTicketId && sendMessage) {
        try {
          const filename = result.filename || `prescription_${lastName || 'patient'}.pdf`;
          const file = new File([pdfBlob], filename, { type: 'application/pdf' });
          const fileId = await uploadFile(file);
          await sendMessage(activeTicketId, null, fileId, 'file');
        } catch (sendErr) {
          console.warn('[PrescriptionPanel] Auto-send failed, PDF still available for download:', sendErr);
        }
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to generate prescription.');
    } finally {
      setSubmitting(false);
    }
  }, [medications, name, sex, address, diagnosis, specialInstructions, followUpDate, patientId, patientDob, activeTicketId, sendMessage]);

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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30">
            <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-secondary-900 dark:text-white leading-tight">
              Issue Prescription
            </h2>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
              Generates PDF &amp; sends in chat
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Success screen */}
      {success ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-secondary-900 dark:text-white">
            Prescription Generated
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center max-w-[220px]">
            {activeTicketId
              ? 'The prescription PDF has been sent in the chat and saved to patient documents.'
              : 'The prescription PDF has been saved to patient documents.'}
          </p>
          {pdfUrl && (
            <a
              href={pdfUrl}
              download={`prescription_${(name.trim() || 'patient').split(/\s+/).pop()}.pdf`}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium
                         bg-neutral-100 dark:bg-neutral-800 text-secondary-900 dark:text-white
                         hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </a>
          )}
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => {
                setSuccess(false);
                setPdfUrl(null);
                setDocumentId(null);
                setMedications([emptyMed()]);
                setDiagnosis('');
                setSpecialInstructions('');
                setFollowUpDate('');
                setError(null);
              }}
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
                boxShadow: '0 2px 8px rgba(244,196,48,0.3)',
              }}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Body (scrollable) */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>

            {/* Patient info */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Patient
              </p>
              <div className="space-y-1.5">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name *" className={inputCls} />
                <div className="grid grid-cols-2 gap-1.5">
                  <input value={age} onChange={e => setAge(e.target.value)} placeholder="Age" className={inputCls} />
                  <select value={sex} onChange={e => setSex(e.target.value)} className={inputCls + ' appearance-none'}>
                    <option value="">Sex</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address (optional)" className={inputCls} />
              </div>
            </div>

            {/* Diagnosis */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Diagnosis
              </p>
              <input
                value={diagnosis}
                onChange={e => setDiagnosis(e.target.value)}
                placeholder="e.g. Upper Respiratory Tract Infection"
                className={inputCls}
              />
            </div>

            {/* Medication entries */}
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
                      <button onClick={() => removeMedication(med.id)} className="text-neutral-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      <input
                        value={med.name}
                        onChange={e => updateMedication(med.id, 'name', e.target.value)}
                        placeholder="Medicine name *"
                        className={inputCls + ' col-span-3'}
                      />
                      <input
                        value={med.dosage}
                        onChange={e => updateMedication(med.id, 'dosage', e.target.value)}
                        placeholder="Dosage"
                        className={inputCls + ' col-span-2'}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <select
                        value={med.frequency}
                        onChange={e => updateMedication(med.id, 'frequency', e.target.value)}
                        className={inputCls + ' appearance-none'}
                      >
                        <option value="">Frequency</option>
                        {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <input
                        value={med.duration}
                        onChange={e => updateMedication(med.id, 'duration', e.target.value)}
                        placeholder="Duration"
                        className={inputCls}
                      />
                      <input
                        value={med.quantity}
                        onChange={e => updateMedication(med.id, 'quantity', e.target.value)}
                        placeholder="Qty"
                        className={inputCls}
                      />
                    </div>
                    <input
                      value={med.instructions}
                      onChange={e => updateMedication(med.id, 'instructions', e.target.value)}
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

            {/* Special Instructions */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Special Instructions
              </p>
              <textarea
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Complete full course of antibiotics..."
                rows={2}
                className={inputCls + ' resize-none'}
                style={{ scrollbarWidth: 'none' }}
              />
            </div>

            {/* Follow-up */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Follow-up Date
              </p>
              <input
                type="date"
                value={followUpDate}
                onChange={e => setFollowUpDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Footer */}
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
                  boxShadow: '0 2px 8px rgba(244,196,48,0.3)',
                } : {
                  background: '#e8e5e0',
                  color: '#a19b93',
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
