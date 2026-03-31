import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Loader2, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react';
import { generatePrescription, downloadDocumentBlob } from '../../../services/prescription-document-service';

const FREQUENCY_OPTIONS = [
  'OD (Once daily)',
  'BID (Twice daily)',
  'TID (Three times daily)',
  'QID (Four times daily)',
  'PRN (As needed)',
  'q4h (Every 4 hours)',
  'q6h (Every 6 hours)',
  'q8h (Every 8 hours)',
  'q12h (Every 12 hours)',
  'HS (At bedtime)',
  'AC (Before meals)',
  'PC (After meals)',
  'Stat (Immediately)',
];

const emptyMedication = () => ({
  name: '', dosage: '', frequency: '', duration: '', quantity: '', instructions: '',
});

function calculateAge(dob) {
  if (!dob) return '';
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

export default function ConsultationPrescriptionModal({ isOpen, onClose, patient, consultation, outcomes }) {
  const [diagnosis, setDiagnosis] = useState('');
  const [medications, setMedications] = useState([emptyMedication()]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  // Pre-fill diagnosis from consultation outcomes
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSuccess(null);

    // Aggregate unique diagnosis names from outcomes
    const diagNames = [];
    (outcomes || []).forEach(o => {
      (o.diagnoses || []).forEach(d => {
        const name = d.diagnosisName || d.title || '';
        const code = d.code || d.icdCode || '';
        const entry = code ? `${code} - ${name}` : name;
        if (entry && !diagNames.includes(entry)) diagNames.push(entry);
      });
    });
    setDiagnosis(diagNames.join('; '));

    // Pre-fill treatments as medication names
    const treatments = [];
    (outcomes || []).forEach(o => {
      (o.treatments || []).forEach(t => {
        const text = t.treatment || t;
        if (text && !treatments.some(m => m.name === text)) {
          treatments.push({ ...emptyMedication(), name: text });
        }
      });
    });
    setMedications(treatments.length > 0 ? treatments : [emptyMedication()]);
    setSpecialInstructions('');
    setFollowUpDate('');
  }, [isOpen, outcomes]);

  const addMedication = useCallback(() => {
    setMedications(prev => [...prev, emptyMedication()]);
  }, []);

  const removeMedication = useCallback((idx) => {
    setMedications(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
  }, []);

  const updateMedication = useCallback((idx, field, value) => {
    setMedications(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }, []);

  const handleSubmit = async () => {
    const validMeds = medications.filter(m => m.name.trim());
    if (validMeds.length === 0) { setError('Add at least one medication.'); return; }

    setLoading(true);
    setError('');

    try {
      const patientAge = calculateAge(patient?.dateOfBirth);
      const payload = {
        patient: {
          id: patient?.id,
          firstName: patient?.firstName || patient?.first_name || '',
          middleName: patient?.middleName || patient?.middle_name || '',
          lastName: patient?.lastName || patient?.last_name || '',
          suffix: patient?.suffix || '',
          dateOfBirth: patient?.dateOfBirth || patient?.date_of_birth || '',
          sex: patient?.sex || patient?.gender || '',
          contactNumber: patient?.contactNumber || patient?.contact_number || '',
          address: patient?.address || '',
          age: patientAge,
        },
        prescription: {
          diagnosis: diagnosis.trim(),
          medications: validMeds.map(m => ({
            name: m.name.trim(),
            dosage: m.dosage.trim(),
            frequency: m.frequency,
            duration: m.duration.trim(),
            quantity: m.quantity.trim(),
            instructions: m.instructions.trim(),
          })),
          specialInstructions: specialInstructions.trim(),
          followUpDate: followUpDate || null,
        },
        issuedDate: new Date().toISOString(),
        consultationId: consultation?.id || null,
      };

      const result = await generatePrescription(patient?.id, payload);
      const blob = await downloadDocumentBlob(result.documentId);
      const url = URL.createObjectURL(blob);

      setSuccess({ documentId: result.documentId, filename: result.filename, url });
    } catch (err) {
      setError(err.message || 'Failed to generate prescription.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewPrescription = () => {
    setSuccess(null);
    setMedications([emptyMedication()]);
    setSpecialInstructions('');
    setFollowUpDate('');
    setError('');
  };

  if (!isOpen) return null;

  const patientName = [patient?.firstName || patient?.first_name, patient?.lastName || patient?.last_name].filter(Boolean).join(' ') || 'Unknown Patient';
  const patientAge = calculateAge(patient?.dateOfBirth || patient?.date_of_birth);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 sm:p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-neutral-800 dark:to-neutral-800 rounded-t-xl">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-base font-bold text-secondary-900 dark:text-white">Generate Prescription</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
            <X className="w-4 h-4 text-secondary-500 dark:text-neutral-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {success ? (
            /* ---- Success screen ---- */
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle className="w-12 h-12 text-success-500" />
              <p className="text-base font-semibold text-secondary-800 dark:text-white">Prescription Generated</p>
              <p className="text-sm text-secondary-500 dark:text-neutral-400">{success.filename}</p>
              <a
                href={success.url}
                download={success.filename || 'prescription.pdf'}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" /> Download PDF
              </a>
              <div className="flex gap-3 pt-2">
                <button onClick={handleNewPrescription} className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-lg transition-colors">
                  New Prescription
                </button>
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-secondary-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors">
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* ---- Prescription form ---- */
            <>
              {/* Patient info (read-only) */}
              <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-lg p-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-secondary-400 dark:text-neutral-500">Patient</span>
                  <p className="text-secondary-800 dark:text-neutral-200 font-medium">{patientName}</p>
                </div>
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-secondary-400 dark:text-neutral-500">Age</span>
                  <p className="text-secondary-800 dark:text-neutral-200">{patientAge || '—'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-secondary-400 dark:text-neutral-500">Sex</span>
                  <p className="text-secondary-800 dark:text-neutral-200">{patient?.sex || patient?.gender || '—'}</p>
                </div>
              </div>

              {/* Diagnosis (pre-filled) */}
              <div>
                <label className="text-xs font-medium text-secondary-600 dark:text-neutral-400 mb-1 block">Diagnosis</label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={e => setDiagnosis(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-secondary-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-300"
                  placeholder="Diagnosis"
                />
              </div>

              {/* Medications */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-secondary-600 dark:text-neutral-400">Medications</label>
                  <button onClick={addMedication} className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                <div className="space-y-3">
                  {medications.map((med, idx) => (
                    <div key={idx} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-secondary-500 dark:text-neutral-400">#{idx + 1}</span>
                        {medications.length > 1 && (
                          <button onClick={() => removeMedication(idx)} className="text-error-500 hover:text-error-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={med.name} onChange={e => updateMedication(idx, 'name', e.target.value)} placeholder="Medication name *" className="col-span-2 rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300" />
                        <input value={med.dosage} onChange={e => updateMedication(idx, 'dosage', e.target.value)} placeholder="Dosage (e.g. 500mg)" className="rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300" />
                        <select value={med.frequency} onChange={e => updateMedication(idx, 'frequency', e.target.value)} className="rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-sm text-secondary-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-300">
                          <option value="">Frequency</option>
                          {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <input value={med.duration} onChange={e => updateMedication(idx, 'duration', e.target.value)} placeholder="Duration (e.g. 7 days)" className="rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300" />
                        <input value={med.quantity} onChange={e => updateMedication(idx, 'quantity', e.target.value)} placeholder="Quantity" className="rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300" />
                      </div>
                      <input value={med.instructions} onChange={e => updateMedication(idx, 'instructions', e.target.value)} placeholder="Special instructions for this medication" className="w-full rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-1.5 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Instructions & Follow-up */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-secondary-600 dark:text-neutral-400 mb-1 block">Special Instructions</label>
                  <textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} rows={2} placeholder="Additional instructions..." className="w-full rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-secondary-800 dark:text-neutral-200 placeholder:text-secondary-300 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-secondary-600 dark:text-neutral-400 mb-1 block">Follow-up Date</label>
                  <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} className="w-full rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-secondary-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg text-sm text-error-700 dark:text-error-400">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-3">
            <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-medium text-secondary-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors inline-flex items-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Generate Prescription
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
