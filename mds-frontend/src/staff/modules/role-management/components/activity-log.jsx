import React from 'react';

/**
 * Activity Log Component
 * Displays staff activity/audit trail table with mock data
 */

// ─── Mock activity logs (per staff) ──────────────────────────────────────
const MOCK_LOGS = {
  'STF-001': [
    { timestamp: 'Feb 23, 2026 · 08:12 AM', action: 'Login', module: '—', details: 'Logged in from 192.168.1.10' },
    { timestamp: 'Feb 23, 2026 · 08:15 AM', action: 'View', module: 'Role Management', details: 'Viewed staff accounts list' },
    { timestamp: 'Feb 23, 2026 · 08:20 AM', action: 'Edit', module: 'Role Management', details: 'Updated permissions for Nurse Anna Garcia (STF-004)' },
    { timestamp: 'Feb 22, 2026 · 04:45 PM', action: 'Edit', module: 'Role Management', details: 'Suspended account Dr. Carlo Mendoza (STF-006)' },
    { timestamp: 'Feb 22, 2026 · 09:00 AM', action: 'Login', module: '—', details: 'Logged in from 192.168.1.10' },
    { timestamp: 'Feb 22, 2026 · 09:05 AM', action: 'View', module: 'Medical Records', details: 'Viewed patient record #P-2024-0412' },
    { timestamp: 'Feb 22, 2026 · 11:30 AM', action: 'Approve', module: 'Pending Requests', details: 'Approved appointment request #APT-1192' },
    { timestamp: 'Feb 22, 2026 · 05:00 PM', action: 'Logout', module: '—', details: 'Session ended' },
  ],
  'STF-002': [
    { timestamp: 'Feb 23, 2026 · 07:45 AM', action: 'Login', module: '—', details: 'Logged in from 192.168.1.22' },
    { timestamp: 'Feb 23, 2026 · 08:00 AM', action: 'View', module: 'Appointments', details: 'Viewed appointment queue' },
    { timestamp: 'Feb 23, 2026 · 08:10 AM', action: 'Confirm', module: 'Appointments', details: 'Confirmed appointment #APT-1205' },
    { timestamp: 'Feb 23, 2026 · 08:30 AM', action: 'Edit', module: 'Medical Records', details: 'Added consultation notes for patient #P-2024-0518' },
    { timestamp: 'Feb 22, 2026 · 02:15 PM', action: 'Approve', module: 'Pending Requests', details: 'Approved record update request #RUR-0087' },
    { timestamp: 'Feb 22, 2026 · 05:30 PM', action: 'Logout', module: '—', details: 'Session ended' },
  ],
  'STF-003': [
    { timestamp: 'Feb 22, 2026 · 04:30 PM', action: 'Login', module: '—', details: 'Logged in from 192.168.1.35' },
    { timestamp: 'Feb 22, 2026 · 04:35 PM', action: 'View', module: 'Dental Records', details: 'Viewed dental record #P-2024-0301' },
    { timestamp: 'Feb 22, 2026 · 04:50 PM', action: 'Edit', module: 'Dental Records', details: 'Updated dental chart for patient #P-2024-0301' },
    { timestamp: 'Feb 22, 2026 · 05:10 PM', action: 'Complete', module: 'Appointments', details: 'Completed dental appointment #APT-1198' },
    { timestamp: 'Feb 22, 2026 · 05:30 PM', action: 'Logout', module: '—', details: 'Session ended' },
  ],
  'STF-004': [
    { timestamp: 'Feb 23, 2026 · 06:55 AM', action: 'Login', module: '—', details: 'Logged in from 192.168.1.41' },
    { timestamp: 'Feb 23, 2026 · 07:00 AM', action: 'View', module: 'Appointments', details: 'Viewed appointment queue' },
    { timestamp: 'Feb 23, 2026 · 07:10 AM', action: 'Confirm', module: 'Appointments', details: 'Confirmed appointment #APT-1202' },
    { timestamp: 'Feb 23, 2026 · 07:30 AM', action: 'View', module: 'Medical Records', details: 'Viewed patient record #P-2024-0720' },
    { timestamp: 'Feb 23, 2026 · 07:45 AM', action: 'Dispense', module: 'Inventory', details: 'Dispensed Paracetamol 500mg x20 to patient #P-2024-0720' },
    { timestamp: 'Feb 22, 2026 · 01:00 PM', action: 'View', module: 'Dental Records', details: 'Viewed dental record #P-2024-0515' },
    { timestamp: 'Feb 22, 2026 · 03:45 PM', action: 'Logout', module: '—', details: 'Session ended' },
  ],
  'STF-005': [
    { timestamp: 'Feb 22, 2026 · 02:10 PM', action: 'Login', module: '—', details: 'Logged in from 192.168.1.48' },
    { timestamp: 'Feb 22, 2026 · 02:15 PM', action: 'View', module: 'Appointments', details: 'Viewed appointment queue' },
    { timestamp: 'Feb 22, 2026 · 02:30 PM', action: 'View', module: 'Medical Records', details: 'Viewed patient record #P-2024-0612' },
    { timestamp: 'Feb 22, 2026 · 03:00 PM', action: 'Dispense', module: 'Inventory', details: 'Dispensed Amoxicillin 250mg x14 to patient #P-2024-0612' },
    { timestamp: 'Feb 22, 2026 · 04:30 PM', action: 'Logout', module: '—', details: 'Session ended' },
  ],
  'STF-006': [
    { timestamp: 'Jan 15, 2026 · 09:20 AM', action: 'Login', module: '—', details: 'Logged in from 192.168.1.55' },
    { timestamp: 'Jan 15, 2026 · 09:30 AM', action: 'View', module: 'Appointments', details: 'Viewed appointment queue' },
    { timestamp: 'Jan 15, 2026 · 10:00 AM', action: 'Edit', module: 'Medical Records', details: 'Updated medical record for patient #P-2024-0102' },
    { timestamp: 'Jan 15, 2026 · 12:00 PM', action: 'Logout', module: '—', details: 'Session ended' },
  ],
};

const ActivityLog = ({ staffId }) => {
  // TODO: Replace MOCK_LOGS with API call
  const logs = MOCK_LOGS[staffId] || [];

  const actionStyle = (action) => {
    switch (action) {
      case 'Login':
        return 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400';
      case 'Logout':
        return 'bg-neutral-200 dark:bg-neutral-700 text-secondary-700 dark:text-neutral-300';
      case 'Edit':
      case 'Confirm':
      case 'Complete':
        return 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400';
      case 'Approve':
        return 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400';
      case 'Reject':
        return 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400';
      case 'Dispense':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
      default:
        return 'bg-neutral-100 dark:bg-neutral-800 text-secondary-600 dark:text-neutral-400';
    }
  };

  if (logs.length === 0) {
    return (
      <div className="py-12 text-center">
        <svg className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-secondary-500 dark:text-neutral-400">No activity recorded yet</p>
        <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">Login events, record views, and actions will appear here</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-secondary-500 dark:text-neutral-400 mb-2">{logs.length} recent activit{logs.length !== 1 ? 'ies' : 'y'}</p>
      <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
              <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Date / Time</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Action</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Module</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, idx) => (
              <tr key={idx} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <td className="py-2 px-3 text-xs text-secondary-500 dark:text-neutral-400 whitespace-nowrap">{log.timestamp}</td>
                <td className="py-2 px-3">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${actionStyle(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="py-2 px-3 text-xs text-secondary-600 dark:text-neutral-300 whitespace-nowrap">{log.module}</td>
                <td className="py-2 px-3 text-xs text-secondary-500 dark:text-neutral-400">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActivityLog;
