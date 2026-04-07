import React, { memo, useMemo } from 'react';

/**
 * Analytics Summary Cards
 * Top-level KPI cards showing totals from loaded analytics data.
 */
const AnalyticsSummaryCards = memo(({ results }) => {
  const summaries = useMemo(() => {
    if (!results || results.size === 0) return [];

    const items = [];

    // Consultations total
    const consultType = results.get('consultations-by-type');
    if (consultType?.success) {
      items.push({
        label: 'Total Consultations',
        value: consultType.data.total,
        color: 'primary',
        icon: 'clipboard',
      });
    }

    // Appointments total
    const apptStatus = results.get('appointments-by-status');
    if (apptStatus?.success) {
      items.push({
        label: 'Total Appointments',
        value: apptStatus.data.total,
        color: 'accent',
        icon: 'calendar',
      });
    }

    // Top diagnoses total
    const diag = results.get('top-diagnoses');
    if (diag?.success) {
      items.push({
        label: 'Diagnoses Recorded',
        value: diag.data.total,
        color: 'success',
        icon: 'diagnosis',
      });
    }

    // Immunizations
    const immun = results.get('immunization-coverage');
    if (immun?.success) {
      items.push({
        label: 'Patients Immunized',
        value: immun.data.total,
        color: 'warning',
        icon: 'shield',
      });
    }

    return items;
  }, [results]);

  if (summaries.length === 0) return null;

  const colorClasses = {
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
    accent: 'bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400',
    success: 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400',
    warning: 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400',
  };

  const icons = {
    clipboard: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    calendar: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    diagnosis: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    shield: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {summaries.map((stat, idx) => (
        <div key={idx} className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 px-4 py-6">
          <div className="flex items-start gap-2.5">
            <div className={`w-7 h-7 flex items-center justify-center rounded-md flex-shrink-0 ${colorClasses[stat.color]}`}>
              {icons[stat.icon]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-secondary-800 dark:text-white leading-none m-0">{stat.value.toLocaleString()}</p>
              <p className="text-xs font-semibold text-secondary-500 dark:text-neutral-400 truncate leading-tight m-0">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

AnalyticsSummaryCards.displayName = 'AnalyticsSummaryCards';

export default AnalyticsSummaryCards;
