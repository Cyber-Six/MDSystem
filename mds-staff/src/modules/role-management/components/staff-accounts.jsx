import React, { useState, useEffect, useCallback } from 'react';
import { DEFAULT_ROLE_TEMPLATES, allModules, hasCustomPermissions, detectRole } from '../role-permissions';
import { fetchStaffAccounts } from '../staff-service';
import StaffDetail from './staff-detail';

/**
 * Staff Accounts Component
 * Loads .mds@tip.edu.ph accounts from the API.
 * Pending = no IS_STAFF role, Active = identity Medical, Suspended = identity Employee + has IS_STAFF.
 */

const StaffAccounts = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const fetchStaffAccounts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const records = await fetchStaffAccounts();
      // Enrich each record with a detected role from the permissions
      const enriched = records.map((s) => ({
        ...s,
        role: detectRole(s.permissions),
      }));
      setStaffList(enriched);
    } catch (err) {
      setLoadError(err.message || 'Failed to load staff accounts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaffAccounts();
  }, [fetchStaffAccounts]);

  const roleColors = {
    admin:   'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
    doctor:  'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
    dentist: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
    nurse:   'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
    custom:  'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400',
  };

  const statusConfig = {
    Active:    { dot: 'bg-success-500', text: 'text-success-600 dark:text-success-400' },
    Suspended: { dot: 'bg-error-500',   text: 'text-error-600 dark:text-error-400' },
    Pending:   { dot: 'bg-warning-500', text: 'text-warning-600 dark:text-warning-400' },
  };

  const getRoleName = (roleId) => {
    const role = DEFAULT_ROLE_TEMPLATES.find((r) => r.id === roleId);
    return role?.name || (roleId === 'custom' ? 'Custom' : roleId);
  };

  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole   = filterRole   === 'all' || s.role   === filterRole;
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleSaveStaff = (updatedStaff) => {
    setStaffList((prev) =>
      prev.map((s) => (s.id === updatedStaff.id ? { ...updatedStaff, role: detectRole(updatedStaff.permissions) } : s))
    );
    setSelectedStaff(null);
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
          <option value="custom">Custom</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-secondary-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
          <option value="Pending">Pending</option>
        </select>
        <button
          onClick={fetchStaffAccounts}
          disabled={isLoading}
          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <svg className={`w-3.5 h-3.5 text-neutral-500 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Staff Count */}
      <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mb-1.5">
        {filteredStaff.length} staff account{filteredStaff.length !== 1 ? 's' : ''}
        {filterRole !== 'all' && ` · ${getRoleName(filterRole)}`}
        {filterStatus !== 'all' && ` · ${filterStatus}`}
      </p>

      {/* Loading / Error / Empty */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="w-6 h-6 mx-auto border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-xs text-secondary-400 dark:text-neutral-500">Loading staff accounts…</p>
        </div>
      ) : loadError ? (
        <div className="py-10 text-center">
          <p className="text-xs text-error-600 dark:text-error-400 mb-2">{loadError}</p>
          <button onClick={fetchStaffAccounts} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Retry</button>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="py-12 text-center">
          <svg className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-xs text-secondary-500 dark:text-neutral-400">
            {staffList.length === 0 ? 'No .mds@tip.edu.ph accounts registered yet.' : 'No matching staff'}
          </p>
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
                const isCustom = s.role === 'custom' || hasCustomPermissions(s.permissions, s.role);
                const sc = statusConfig[s.status] || statusConfig.Pending;
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedStaff(s)}
                    className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                          {s.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-medium text-secondary-900 dark:text-white truncate">{s.name}</span>
                          {isCustom && s.status !== 'Pending' && (
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
                      {s.status === 'Pending' ? (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-secondary-400 dark:text-neutral-500">
                          —
                        </span>
                      ) : (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${roleColors[s.role] || roleColors.custom}`}>
                          {getRoleName(s.role)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
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

