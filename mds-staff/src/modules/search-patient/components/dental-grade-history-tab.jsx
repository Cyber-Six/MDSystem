import React, { useState, useEffect, useMemo } from 'react';
import PatientSectionCard from './section-card';
import ToothChart from './tooth-chart';
import { axiosRequest } from '../../../packages-core-adapter';
import { ENUM_TO_CODE } from './tooth-chart-constants';

const GQL_DENTAL_RECORD_HISTORY = `
  query GetDentalRecordHistory($userId: ID!) {
    getUserDentalHistory(userId: $userId, limit: 50) {
      id seenByDentist lastDentalCleaning purpose lastVisitDate status created_at
    }
    getUserOralApplianceProfile(userId: $userId, limit: 50) {
      id notes created_at status
      appliances { id tagId status dateIssued arch }
    }
    getUserDentalProcedureProfile(userId: $userId, limit: 50) {
      id notes created_at status
      procedures { id procedureTypeId procedureDate }
    }
    getUserDentalPhotoRecord(userId: $userId, limit: 50) {
      id upperTeeth lowerTeeth isValid created_at status
    }
    dentalProcedureCatalogs: getDomainCatalogs(domain: DentalProcedure) { id name }
    oralApplianceCatalogs: getOralApplianceCatalogs { id name }
  }
`;

const GQL_STAFF_DENTAL_RECORDS = `
  query GetStaffDentalRecords($patientId: ID!) {
    getPatientDentalRecord(patientId: $patientId, limit: 50) {
      id notes created_at
      ToothPlacements { id toothIndex legend }
      oralFindings { oralFindingId status }
    }
    getOralFindingCatalogs { id name }
  }
`;

/* ─── AuthenticatedImage ─────────────────────────────────────── */
function AuthenticatedImage({ path, alt, className }) {
  const [src, setSrc] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    axiosRequest
      .get(path, { responseType: 'blob' })
      .then((res) => {
        if (!cancelled) {
          objectUrl = URL.createObjectURL(res.data);
          setSrc(objectUrl);
        }
      })
      .catch(() => { if (!cancelled) setImgError(true); })
      .finally(() => { if (!cancelled) setImgLoading(false); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (imgLoading) {
    return (
      <div className="flex items-center justify-center w-full h-32 rounded-lg bg-neutral-100 dark:bg-neutral-700/50 animate-pulse">
        <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
    );
  }
  if (imgError || !src) {
    return (
      <div className="flex items-center justify-center w-full h-24 rounded-lg bg-neutral-100 dark:bg-neutral-700/50 border border-dashed border-neutral-300 dark:border-neutral-600">
        <p className="text-xs text-neutral-400 dark:text-neutral-500">Photo unavailable</p>
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setIsExpanded(true)} className="block w-full text-left" title="Click to enlarge">
        <img src={src} alt={alt} className={`${className} cursor-zoom-in`} />
      </button>
      {isExpanded && (
        <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center" onClick={() => setIsExpanded(false)}>
          <div className="relative max-w-6xl w-full" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setIsExpanded(false)} className="absolute -top-10 right-0 text-white/90 hover:text-white text-sm font-medium">Close</button>
            <img src={src} alt={alt} className="w-full max-h-[85vh] object-contain rounded-lg border border-white/20 shadow-2xl" />
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Shared date formatter ──────────────────────────────────── */
function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
}

/* ─── Read-only Oral Findings Display ─────────────────────────── */
function ReadOnlyOralFindings({ catalogs, oralFindings }) {
  if (!catalogs || catalogs.length === 0) {
    return (
      <p className="text-xs text-neutral-400 dark:text-neutral-500 italic py-2">
        No oral finding catalog available.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto -mx-3 -mb-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-100 dark:bg-neutral-700/50">
            <th className="px-3 py-2 text-left text-[11px] font-semibold text-secondary-600 dark:text-neutral-300 uppercase tracking-wide border-b border-neutral-200 dark:border-neutral-600">Finding</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold text-secondary-600 dark:text-neutral-300 uppercase tracking-wide border-b border-neutral-200 dark:border-neutral-600 w-20">Yes</th>
            <th className="px-3 py-2 text-center text-[11px] font-semibold text-secondary-600 dark:text-neutral-300 uppercase tracking-wide border-b border-neutral-200 dark:border-neutral-600 w-20">No</th>
          </tr>
        </thead>
        <tbody>
          {catalogs.map((catalog, idx) => {
            const finding = oralFindings.find((f) => String(f.oralFindingId) === String(catalog.id));
            const raw = finding?.status;
            const value = (raw === true || raw === 'true' || raw === 'yes') ? true
              : (raw === false || raw === 'false' || raw === 'no') ? false
              : null;
            return (
              <tr key={catalog.id} className={`${idx % 2 === 0 ? 'bg-white dark:bg-neutral-800' : 'bg-neutral-50 dark:bg-neutral-800/50'}`}>
                <td className="px-3 py-2 text-xs text-secondary-700 dark:text-neutral-300 border-b border-neutral-100 dark:border-neutral-700">{catalog.name}</td>
                <td className="px-3 py-2 text-center border-b border-neutral-100 dark:border-neutral-700">
                  <div className="flex justify-center items-center">
                    <span className={`inline-flex w-4 h-4 rounded-full border-2 items-center justify-center ${value === true ? 'border-green-500 bg-green-500 dark:border-green-400 dark:bg-green-400' : 'border-neutral-300 dark:border-neutral-500 bg-transparent'}`}>
                      {value === true && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-center border-b border-neutral-100 dark:border-neutral-700">
                  <div className="flex justify-center items-center">
                    <span className={`inline-flex w-4 h-4 rounded-full border-2 items-center justify-center ${value === false ? 'border-red-500 bg-red-500 dark:border-red-400 dark:bg-red-400' : 'border-neutral-300 dark:border-neutral-500 bg-transparent'}`}>
                      {value === false && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Single Record Entry Card ────────────────────────────────── */
function RecordEntry({ index, record, dentalHistoryRecord, procedureProfile, applianceProfile, photoRecord, oralFindingCatalogs, dentalProcedureMap, applianceTagMap }) {
  const [expanded, setExpanded] = useState(index === 0);

  const toothStates = useMemo(() => {
    const states = {};
    (record?.ToothPlacements || []).forEach((tp) => {
      states[tp.toothIndex] = ENUM_TO_CODE[tp.legend] ?? tp.legend;
    });
    return states;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  const oralFindings   = record?.oralFindings || [];
  const procedures     = procedureProfile?.procedures || [];
  const appliances     = applianceProfile?.appliances || [];
  const conditionCount = Object.values(toothStates).filter((s) => s !== '✓').length;
  const positiveCount  = oralFindings.filter((f) => f.status === true).length;

  // Prefer actual clinical dates (procedure date, appliance issue date) over
  // system creation timestamps so the grading date doesn't override real record dates.
  const clinicalDate = procedures[0]?.procedureDate || appliances[0]?.dateIssued || null;
  const systemTimestamp =
    procedureProfile?.created_at ||
    applianceProfile?.created_at ||
    photoRecord?.created_at ||
    record?.created_at ||
    null;
  const anchorDate = clinicalDate || systemTimestamp;

  const dateLabel = anchorDate
    ? new Date(anchorDate).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' })
    : 'Unknown date';
  // Only show the time portion for system timestamps – clinical date strings lack a meaningful time component
  const timeLabel = !clinicalDate && systemTimestamp
    ? new Date(systemTimestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
    : '';

  const hasAny = record || dentalHistoryRecord || procedureProfile || applianceProfile || photoRecord;
  if (!hasAny) return null;

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center text-xs font-bold shrink-0">
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-secondary-800 dark:text-white">
              {dateLabel}
              {timeLabel && (
                <span className="ml-1.5 text-xs font-normal text-secondary-400 dark:text-neutral-500">{timeLabel}</span>
              )}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {record && (
                conditionCount > 0
                  ? <span className="text-[11px] text-warning-600 dark:text-warning-400 font-medium">{conditionCount} tooth condition{conditionCount !== 1 ? 's' : ''}</span>
                  : <span className="text-[11px] text-success-600 dark:text-success-400 font-medium">No tooth conditions</span>
              )}
              {record && positiveCount > 0 && (
                <span className="text-[11px] text-error-600 dark:text-error-400">· {positiveCount} positive oral finding{positiveCount !== 1 ? 's' : ''}</span>
              )}
              {procedures.length > 0 && (
                <span className="text-[11px] text-secondary-400 dark:text-neutral-500">· {procedures.length} procedure{procedures.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-secondary-400 dark:text-neutral-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="p-4 space-y-3 bg-white dark:bg-neutral-800">

          {/* ── Dental Visit History ── */}
          {dentalHistoryRecord && (
            <PatientSectionCard title="Dental Visit History">
              <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60">
                <div className="flex items-start gap-3 py-1.5">
                  <span className="text-xs text-secondary-400 dark:text-neutral-500 min-w-[160px] shrink-0 pt-px">Seen by Dentist</span>
                  <span className="text-sm font-medium text-secondary-800 dark:text-white">
                    {dentalHistoryRecord.seenByDentist === true ? 'No' : dentalHistoryRecord.seenByDentist === false ? 'Yes' : '—'}
                  </span>
                </div>
                <div className="flex items-start gap-3 py-1.5">
                  <span className="text-xs text-secondary-400 dark:text-neutral-500 min-w-[160px] shrink-0 pt-px">Last Dental Cleaning</span>
                  <span className="text-sm font-medium text-secondary-800 dark:text-white">
                    {dentalHistoryRecord.lastDentalCleaning || <span className="text-secondary-300 dark:text-neutral-600 font-normal">—</span>}
                  </span>
                </div>
              </div>
            </PatientSectionCard>
          )}

          {/* ── Dental Procedures ── */}
          {procedureProfile && (
            <PatientSectionCard title="Dental Procedures">
              {procedures.length > 0 ? (
                <div className="overflow-x-auto -mx-3 -mb-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-50 dark:bg-neutral-700/40">
                        <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700">Procedure</th>
                        <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700 w-36">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {procedures.map((p, i) => (
                        <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/60 last:border-0 hover:bg-neutral-50/50 dark:hover:bg-neutral-700/20">
                          <td className="px-3 py-2 text-secondary-800 dark:text-white">{dentalProcedureMap[p.procedureTypeId] || `Procedure #${p.procedureTypeId}`}</td>
                          <td className="px-3 py-2 text-secondary-500 dark:text-neutral-400">{p.procedureDate ? fmt(p.procedureDate) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-secondary-300 dark:text-neutral-600">No dental procedures recorded.</p>
              )}
            </PatientSectionCard>
          )}

          {/* ── Oral Appliances ── */}
          {applianceProfile && (
            <PatientSectionCard title="Oral Appliances">
              {appliances.length > 0 ? (
                <div className="overflow-x-auto -mx-3 -mb-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-50 dark:bg-neutral-700/40">
                        <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700">Tag</th>
                        <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700 w-24">Status</th>
                        <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700 w-32">Date Issued</th>
                        <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wide border-b border-neutral-100 dark:border-neutral-700 w-24">Arch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appliances.map((a, i) => {
                        const isActive = a.status && a.status !== 'Removed' && a.status !== 'removed';
                        return (
                          <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/60 last:border-0 hover:bg-neutral-50/50 dark:hover:bg-neutral-700/20">
                            <td className="px-3 py-2 text-secondary-800 dark:text-white">{applianceTagMap[a.tagId] || `Appliance #${a.tagId}`}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${isActive ? 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400' : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-500 dark:text-neutral-400'}`}>
                                {a.status || '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-secondary-500 dark:text-neutral-400">{a.dateIssued ? fmt(a.dateIssued) : '—'}</td>
                            <td className="px-3 py-2 text-secondary-800 dark:text-white">{a.arch || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-secondary-300 dark:text-neutral-600">No oral appliances recorded.</p>
              )}
            </PatientSectionCard>
          )}

          {/* ── Dental Photos ── */}
          {photoRecord && (photoRecord.upperTeeth || photoRecord.lowerTeeth) && (
            <PatientSectionCard title="Dental Photos">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Upper Teeth</p>
                  {photoRecord.upperTeeth ? (
                    <AuthenticatedImage
                      path={`/media/record/dentalPhoto/${photoRecord.upperTeeth}`}
                      alt="Upper teeth photo"
                      className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600">
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">No photo</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-secondary-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Lower Teeth</p>
                  {photoRecord.lowerTeeth ? (
                    <AuthenticatedImage
                      path={`/media/record/dentalPhoto/${photoRecord.lowerTeeth}`}
                      alt="Lower teeth photo"
                      className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600">
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">No photo</p>
                    </div>
                  )}
                </div>
              </div>
            </PatientSectionCard>
          )}

          {/* ── Tooth Chart ── */}
          {record && (
            <PatientSectionCard title="Tooth Chart">
              <ToothChart
                key={`${record.id}-chart`}
                initialStates={toothStates}
                isEditing={false}
              />
            </PatientSectionCard>
          )}

          {/* ── Oral Findings ── */}
          {record && (
            <PatientSectionCard title="Oral Findings">
              <ReadOnlyOralFindings catalogs={oralFindingCatalogs} oralFindings={oralFindings} />
            </PatientSectionCard>
          )}

          {/* ── Notes ── */}
          {record?.notes && (
            <div className="px-1 pt-1">
              <h4 className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Notes</h4>
              <p className="text-sm text-secondary-700 dark:text-neutral-300">{record.notes}</p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────── */
export default function PatientDentalGradeHistoryTab({ patient }) {
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patient?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      axiosRequest.post('/emr/medical', {
        query: GQL_DENTAL_RECORD_HISTORY,
        variables: { userId: patient.id },
      }),
      axiosRequest.post('/staff/emr', {
        query: GQL_STAFF_DENTAL_RECORDS,
        variables: { patientId: patient.id },
      }),
    ])
      .then(([emrRes, staffRes]) => {
        if (cancelled) return;
        const emrData = emrRes.data?.data || {};
        const staffData = staffRes.data?.data || {};
        setHistoryData({
          ...emrData,
          getUserDentalRecord: staffData.getPatientDentalRecord || [],
          oralFindingCatalogs: staffData.getOralFindingCatalogs || [],
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.errors?.[0]?.message || err?.message || 'Failed to load dental record history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [patient?.id]);

  const catalogs = useMemo(() => {
    if (!historyData) return {};
    const dentalProcedureMap = {};
    (historyData.dentalProcedureCatalogs || []).forEach((c) => { dentalProcedureMap[c.id] = c.name; });
    const applianceTagMap = {};
    (historyData.oralApplianceCatalogs || []).forEach((c) => { applianceTagMap[c.id] = c.name; });
    return { dentalProcedureMap, applianceTagMap, oralFindingCatalogs: historyData.oralFindingCatalogs || [] };
  }, [historyData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin w-6 h-6 text-primary-500 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm text-secondary-500 dark:text-neutral-400">Loading dental record history…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-4 rounded-md bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 text-sm text-error-700 dark:text-error-400">
        {error}
      </div>
    );
  }

  const allDentalRecords  = historyData?.getUserDentalRecord           ?? [];
  const dentalHistories   = (historyData?.getUserDentalHistory          ?? []).filter(r => r.status === 'Approved');
  const procedureProfiles = (historyData?.getUserDentalProcedureProfile ?? []).filter(r => r.status === 'Approved');
  const applianceProfiles = (historyData?.getUserOralApplianceProfile   ?? []).filter(r => r.status === 'Approved');
  const photoRecords      = (historyData?.getUserDentalPhotoRecord      ?? []).filter(r => r.status === 'Approved');

  // Number of visit-based cards is driven solely by visit data (histories, procedures,
  // appliances, photos). Standalone dental grades created from the Dental Grading tab
  // must NOT inflate this count.
  const maxCount = Math.max(
    dentalHistories.length,
    procedureProfiles.length,
    applianceProfiles.length,
    photoRecords.length,
  );

  // ── Date-based pairing of staff dental grades to patient visits ──
  // A grade belongs to a visit if it was created AFTER that visit's date
  // and BEFORE the next newer visit's date. This prevents ungraded patient
  // records from incorrectly showing an older grade by positional index.
  const matchedGrades = (() => {
    const grades = new Array(maxCount).fill(null);
    if (allDentalRecords.length === 0 || maxCount === 0) return grades;

    // Build visit dates array (newest-first, matching API sort order)
    const visitDates = [];
    for (let i = 0; i < maxCount; i++) {
      const d = dentalHistories[i]?.created_at
        || procedureProfiles[i]?.created_at
        || applianceProfiles[i]?.created_at
        || photoRecords[i]?.created_at;
      visitDates.push(d ? new Date(d).getTime() : 0);
    }

    // For each grade (newest-first), find the visit whose time-window it falls into
    for (const grade of allDentalRecords) {
      if (!grade.created_at) continue;
      const gradeTime = new Date(grade.created_at).getTime();

      for (let i = 0; i < maxCount; i++) {
        if (visitDates[i] === 0) continue;
        // Grade must come after this visit
        if (gradeTime < visitDates[i]) continue;
        // Grade must come before the next newer visit (if any)
        if (i > 0 && gradeTime >= visitDates[i - 1]) continue;
        // This visit's time-window matches; assign if not already taken
        if (grades[i] === null) {
          grades[i] = grade;
        }
        break; // grade can only belong to one visit window
      }
    }

    return grades;
  })();

  if (maxCount === 0) {
    return (
      <PatientSectionCard title="Dental Record History">
        <p className="text-sm text-secondary-400 dark:text-neutral-500">No dental records found.</p>
      </PatientSectionCard>
    );
  }

  return (
    <PatientSectionCard
      title="Dental Record History"
      right={
        <span className="text-xs text-secondary-400 dark:text-neutral-500">
          {maxCount} record{maxCount !== 1 ? 's' : ''} recorded
        </span>
      }
    >
      <div className="space-y-2">
        {Array.from({ length: maxCount }, (_, i) => (
          <RecordEntry
            key={i}
            index={i}
            record={matchedGrades[i] ?? null}
            dentalHistoryRecord={dentalHistories[i] ?? null}
            procedureProfile={procedureProfiles[i] ?? null}
            applianceProfile={applianceProfiles[i] ?? null}
            photoRecord={photoRecords[i] ?? null}
            oralFindingCatalogs={catalogs.oralFindingCatalogs ?? []}
            dentalProcedureMap={catalogs.dentalProcedureMap ?? {}}
            applianceTagMap={catalogs.applianceTagMap ?? {}}
          />
        ))}
      </div>
    </PatientSectionCard>
  );
}
