import React, { useState } from 'react';
import { DEFAULT_ROLE_TEMPLATES, allActions, clonePermissions, hasCustomPermissions } from '../role-permissions';
import StaffDetail from './staff-detail';

/**
 * Staff Accounts Component
 * Compact searchable staff table with separate email column
 * Click a row to open the staff detail modal
 */

// ─── Mock staff data (per-account permissions) ──────────────────────────
const MOCK_STAFF = [
  {
    id: 'STF-001',
    name: 'Dr. Maria Santos',
    email: 'maria.santos.mds@tip.edu.ph',
    role: 'admin',
    status: 'Active',
    lastLogin: 'Feb 23, 2026 · 08:12 AM',
    permissions: allActions(true),
  },
  {
    id: 'STF-002',
    name: 'Dr. James Cruz',
    email: 'james.cruz.mds@tip.edu.ph',
    role: 'doctor',
    status: 'Active',
    lastLogin: 'Feb 23, 2026 · 07:45 AM',
    permissions: {
      ...allActions(false),
      appointments: { view: true, confirm: true, cancel: true, noshow: true, complete: true },
      pendingRequests: { view: true, approveAppointment: true, rejectAppointment: true, approveMedicine: false, rejectMedicine: false, approveRecordUpdate: true, rejectRecordUpdate: true },
      medicalRecords: { view: true, edit: true, addNotes: true },
      dentalRecords: { view: false, edit: false, addNotes: false },
      patientSearch: { view: true },
      inventory: { view: false, add: false, dispense: false },
      roleManagement: { view: false, edit: false },
    },
  },
  {
    id: 'STF-003',
    name: 'Dr. Angela Reyes',
    email: 'angela.reyes.mds@tip.edu.ph',
    role: 'dentist',
    status: 'Active',
    lastLogin: 'Feb 22, 2026 · 04:30 PM',
    permissions: {
      ...allActions(false),
      appointments: { view: true, confirm: true, cancel: true, noshow: true, complete: true },
      pendingRequests: { view: true, approveAppointment: true, rejectAppointment: true, approveMedicine: false, rejectMedicine: false, approveRecordUpdate: true, rejectRecordUpdate: true },
      medicalRecords: { view: false, edit: false, addNotes: false },
      dentalRecords: { view: true, edit: true, addNotes: true },
      patientSearch: { view: true },
      inventory: { view: false, add: false, dispense: false },
      roleManagement: { view: false, edit: false },
    },
  },
  {
    id: 'STF-004',
    name: 'Nurse Anna Garcia',
    email: 'anna.garcia.mds@tip.edu.ph',
    role: 'nurse',
    status: 'Active',
    lastLogin: 'Feb 23, 2026 · 06:55 AM',
    // Nurse 1 — has medical + dental + appointment access (CUSTOM override)
    permissions: {
      ...allActions(false),
      appointments: { view: true, confirm: true, cancel: false, noshow: false, complete: false },
      pendingRequests: { view: true, approveAppointment: false, rejectAppointment: false, approveMedicine: true, rejectMedicine: false, approveRecordUpdate: false, rejectRecordUpdate: false },
      medicalRecords: { view: true, edit: false, addNotes: false },
      dentalRecords: { view: true, edit: false, addNotes: false }, // custom: dental access added
      patientSearch: { view: true },
      inventory: { view: true, add: false, dispense: true },
      roleManagement: { view: false, edit: false },
    },
  },
  {
    id: 'STF-005',
    name: 'Nurse Ben Torres',
    email: 'ben.torres.mds@tip.edu.ph',
    role: 'nurse',
    status: 'Active',
    lastLogin: 'Feb 22, 2026 · 02:10 PM',
    // Nurse 2 — default nurse perms (medical only, no dental)
    permissions: {
      ...allActions(false),
      appointments: { view: true, confirm: true, cancel: false, noshow: false, complete: false },
      pendingRequests: { view: true, approveAppointment: false, rejectAppointment: false, approveMedicine: true, rejectMedicine: false, approveRecordUpdate: false, rejectRecordUpdate: false },
      medicalRecords: { view: true, edit: false, addNotes: false },
      dentalRecords: { view: false, edit: false, addNotes: false },
      patientSearch: { view: true },
      inventory: { view: true, add: false, dispense: true },
      roleManagement: { view: false, edit: false },
    },
  },
  {
    id: 'STF-006',
    name: 'Dr. Carlo Mendoza',
    email: 'carlo.mendoza.mds@tip.edu.ph',
    role: 'doctor',
    status: 'Suspended',
    lastLogin: 'Jan 15, 2026 · 09:20 AM',
    permissions: {
      ...allActions(false),
      appointments: { view: true, confirm: true, cancel: true, noshow: true, complete: true },
      pendingRequests: { view: true, approveAppointment: true, rejectAppointment: true, approveMedicine: false, rejectMedicine: false, approveRecordUpdate: true, rejectRecordUpdate: true },
      medicalRecords: { view: true, edit: true, addNotes: true },
      dentalRecords: { view: false, edit: false, addNotes: false },
      patientSearch: { view: true },
      inventory: { view: false, add: false, dispense: false },
      roleManagement: { view: false, edit: false },
    },
  },
];

const StaffAccounts = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [filterRole, setFilterRole] = useState('all');

  // TODO: Replace MOCK_STAFF with API call
  const [staffList, setStaffList] = useState(MOCK_STAFF);

  const roleColors = {
    admin: 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
    doctor: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
    dentist: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
    nurse: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  };

  const getRoleName = (roleId) => {
    const role = DEFAULT_ROLE_TEMPLATES.find((r) => r.id === roleId);
    return role?.name || roleId;
  };

  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || s.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleSaveStaff = (updatedStaff) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === updatedStaff.id ? updatedStaff : s))
    );
    setSelectedStaff(null);
    // TODO: API call to save staff permissions
  };

  return (
    <div>
      {/* Search + Filter Bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 relative">
          <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-secondary-800 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-secondary-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="all">All Roles</option>
          {DEFAULT_ROLE_TEMPLATES.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Staff Count */}
      <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mb-1.5">
        {filteredStaff.length} staff account{filteredStaff.length !== 1 ? 's' : ''}
        {filterRole !== 'all' && ` · ${getRoleName(filterRole)}`}
      </p>

      {/* Staff Table */}
      {filteredStaff.length === 0 ? (
        <div className="py-12 text-center">
          <svg className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-xs text-secondary-500 dark:text-neutral-400">No matching staff</p>
        </div>
      ) : (
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Name</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Role</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider hidden sm:table-cell">Status</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((s) => {
                const isCustom = hasCustomPermissions(s.permissions, s.role);
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedStaff(s)}
                    className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                          {s.name.split(' ').map((n) => n[0]).join('').substring(0, 2)}
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-medium text-secondary-900 dark:text-white truncate">{s.name}</span>
                          {isCustom && (
                            <span className="text-[8px] px-1 py-px bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 rounded font-medium flex-shrink-0">
                              Custom
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 hidden md:table-cell">
                      <span className="text-[11px] text-secondary-500 dark:text-neutral-400">{s.email}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${roleColors[s.role] || 'bg-neutral-100 dark:bg-neutral-800 text-secondary-600 dark:text-neutral-400'}`}>
                        {getRoleName(s.role)}
                      </span>
                    </td>
                    <td className="py-3 px-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                        s.status === 'Active'
                          ? 'text-success-600 dark:text-success-400'
                          : 'text-error-600 dark:text-error-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'Active' ? 'bg-success-500' : 'bg-error-500'}`} />
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[10px] text-secondary-500 dark:text-neutral-400 hidden lg:table-cell whitespace-nowrap">
                      {s.lastLogin || 'Never'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Staff Detail Modal */}
      {selectedStaff && (
        <StaffDetail
          staff={selectedStaff}
          onClose={() => setSelectedStaff(null)}
          onSave={handleSaveStaff}
        />
      )}
    </div>
  );
};

export default StaffAccounts;
