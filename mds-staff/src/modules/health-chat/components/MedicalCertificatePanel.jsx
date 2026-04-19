import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react';
import { generateMedicalCertificate, downloadDocumentBlob } from '../certificate-document-service';

const calcAge = (dob) => {
  if (!dob) return '';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return '';
  const years = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return String(years);
};

const MedicalCertificatePanel = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  patientDob,
  patientSex,
  activeTicketId,
  consultationData,
}) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');

  const [purpose, setPurpose] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [remarks, setRemarks] = useState('');
  const [ptrNumber, setPtrNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [doctorSignatureBase64, setDoctorSignatureBase64] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [documentId, setDocumentId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    setName(patientName || '');
    setAge(calcAge(patientDob) || '');
    setSex(patientSex || '');

    setPurpose('Fitness to Work');
    setDiagnosis(consultationData?.diagnosis || '');
    setRecommendations('Fit for regular work duties.');
    setValidFrom(new Date().toISOString().slice(0, 10));
    setValidUntil('');
    setRestrictions('');
    setRemarks('');
    setPtrNumber('');
    setLicenseNumber('');
    setDoctorSignatureBase64('');

    setSubmitting(false);
    setError(null);
    setSuccess(false);
    setPdfUrl(null);
    setDocumentId(null);
  }, [isOpen, patientName, patientDob, patientSex, consultationData]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      setError('Patient name is required.');
      return;
    }

    if (!purpose.trim()) {
      setError('Purpose is required.');
      return;
    }

    if (!diagnosis.trim()) {
      setError('Diagnosis/findings are required.');
      return;
    }

    if (!recommendations.trim()) {
      setError('Recommendations are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

      const signaturePayload = doctorSignatureBase64.trim()
        ? { base64: doctorSignatureBase64.trim() }
        : undefined;

      const payload = {
        patient: {
          id: patientId || undefined,
          firstName,
          middleName,
          lastName,
          dateOfBirth: patientDob || undefined,
          sex: sex || undefined,
        },
        physician: {
          ptrNo: ptrNumber.trim() || undefined,
          licenseNo: licenseNumber.trim() || undefined,
          signature: signaturePayload,
        },
        issuedDate: new Date().toISOString().split('T')[0],
        certificate: {
          purpose: purpose.trim(),
          diagnosis: diagnosis.trim(),
          recommendations: recommendations.trim(),
          validFrom: validFrom || undefined,
          validUntil: validUntil || undefined,
          restrictions: restrictions.trim() || undefined,
          remarks: remarks.trim() || undefined,
        },
      };

      const result = await generateMedicalCertificate(patientId, payload, {
        chatId: activeTicketId || undefined,
      });
      setDocumentId(result.documentId);

      const pdfBlob = await downloadDocumentBlob(result.documentId);
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to generate medical certificate.');
    } finally {
      setSubmitting(false);
    }
  }, [
    name,
    purpose,
    diagnosis,
    recommendations,
    validFrom,
    validUntil,
    restrictions,
    remarks,
    ptrNumber,
    licenseNumber,
    doctorSignatureBase64,
    patientId,
    patientDob,
    sex,
    activeTicketId,
  ]);

  if (!isOpen) return null;

  const inputCls = `w-full px-2.5 py-1.5 rounded-lg text-xs
    bg-neutral-100 dark:bg-neutral-800
    border border-neutral-200 dark:border-neutral-700
    text-secondary-900 dark:text-white
    placeholder-neutral-400 dark:placeholder-neutral-500
    focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20`;

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-700"
      style={{ width: '380px', flexShrink: 0 }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-sky-100 dark:bg-sky-900/30">
            <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-secondary-900 dark:text-white leading-tight">
              Issue Medical Certificate
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

      {success ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
          <div className="w-14 h-14 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-sky-600 dark:text-sky-400" />
          </div>
          <p className="text-sm font-semibold text-secondary-900 dark:text-white">
            Medical Certificate Generated
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center max-w-[240px]">
            {activeTicketId
              ? 'The medical certificate PDF has been sent in the chat and saved to patient documents.'
              : 'The medical certificate PDF has been saved to patient documents.'}
          </p>
          {pdfUrl && (
            <a
              href={pdfUrl}
              download={`medical_certificate_${(name.trim() || 'patient').split(/\s+/).pop()}.pdf`}
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
                setError(null);
              }}
              className="px-4 py-1.5 rounded-lg text-xs font-medium
                         text-neutral-600 dark:text-neutral-300
                         hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              New Certificate
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
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Patient
              </p>
              <div className="space-y-1.5">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name *" className={inputCls} />
                <div className="grid grid-cols-2 gap-1.5">
                  <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" className={inputCls} />
                  <select value={sex} onChange={(e) => setSex(e.target.value)} className={inputCls + ' appearance-none'}>
                    <option value="">Sex</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Certificate Purpose
              </p>
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Fitness to Work"
                className={inputCls}
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Diagnosis / Findings
              </p>
              <textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Clinical findings"
                rows={3}
                className={inputCls + ' resize-none'}
                style={{ scrollbarWidth: 'none' }}
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Recommendations
              </p>
              <textarea
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                placeholder="Doctor recommendations"
                rows={3}
                className={inputCls + ' resize-none'}
                style={{ scrollbarWidth: 'none' }}
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Validity
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputCls} />
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Restrictions
              </p>
              <textarea
                value={restrictions}
                onChange={(e) => setRestrictions(e.target.value)}
                placeholder="Optional restrictions"
                rows={2}
                className={inputCls + ' resize-none'}
                style={{ scrollbarWidth: 'none' }}
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Remarks
              </p>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Additional remarks"
                rows={2}
                className={inputCls + ' resize-none'}
                style={{ scrollbarWidth: 'none' }}
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Doctor Credentials
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  value={ptrNumber}
                  onChange={(e) => setPtrNumber(e.target.value)}
                  placeholder="PTR Number"
                  className={inputCls}
                />
                <input
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="License Number"
                  className={inputCls}
                />
              </div>
              <textarea
                value={doctorSignatureBase64}
                onChange={(e) => setDoctorSignatureBase64(e.target.value)}
                placeholder="Doctor signature (optional Base64/Data URL)"
                rows={3}
                className={inputCls + ' resize-none mt-1.5'}
                style={{ scrollbarWidth: 'none' }}
              />
            </div>
          </div>

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
                disabled={submitting || !purpose.trim() || !diagnosis.trim() || !recommendations.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold
                           transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={!submitting && purpose.trim() && diagnosis.trim() && recommendations.trim() ? {
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

      {documentId ? <span className="hidden" data-document-id={documentId} /> : null}
    </div>
  );
};

export default MedicalCertificatePanel;