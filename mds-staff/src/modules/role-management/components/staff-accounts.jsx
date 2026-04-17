import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { fetchStaffAccounts as fetchStaffAccountsAPI, searchUsers, createMedicalPersonnel, fetchTemplates, updateStaffAccount } from '../staff-service';
import StaffDetail from './staff-detail';
import { useBanner } from '../../../context/use-banner';
import ConfirmationModal from '../../../components/modals/ConfirmationModal.jsx';

/**
 * Staff Accounts Component
 * Loads .mds@tip.edu.ph accounts from the API.
 * Pending = no IS_STAFF role, Active = identity Medical, Suspended = identity Employee + has IS_STAFF.
 */

const StaffAccounts = ({ onRoleUpdate = null }) => {
  const { showBanner } = useBanner();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Add Staff modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addSearchResults, setAddSearchResults] = useState([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addSearchError, setAddSearchError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [addForm, setAddForm] = useState({ title: '', role: '', designation: 'Both', templateId: '' });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [mdsOnly, setMdsOnly] = useState(false);
  const [nonMdsWarningUser, setNonMdsWarningUser] = useState(null);
  const searchTimeoutRef = useRef(null);

  // Inline dropdown state for table cells
  const [openDropdown, setOpenDropdown] = useState(null); // { staffId, field: 'role'|'branch'|'status' }
  const [cellLoading, setCellLoading] = useState(null); // { staffId, field }
  const [pendingAccountUpdate, setPendingAccountUpdate] = useState(null); // { staffId, field, role?, templateId?, designation?, status? }
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!openDropdown) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  const toggleDropdown = (staffId, field, buttonEl) => {
    setOpenDropdown(prev =>
      prev?.staffId === staffId && prev?.field === field
        ? null
        : { staffId, field, rect: buttonEl.getBoundingClientRect() }
    );
  };

  const handleCellUpdate = useCallback(async (staffId, field, value, templateId) => {
    setCellLoading({ staffId, field });
    try {
      const params = { status: undefined, role: undefined, templateId: undefined, designation: undefined };
      if (field === 'role') {
        params.role = value;
        params.templateId = templateId;
      } else if (field === 'status') {
        params.status = value;
      } else if (field === 'branch') {
        params.designation = value;
      }
      const result = await updateStaffAccount(staffId, params.status, params.role, params.templateId, params.designation);
      if (result.staff) {
        setStaffList(prev => prev.map(s => s.id === staffId ? result.staff : s));

        showBanner({
          type: 'success',
          message: 'Staff account updated and staff notified.',
          duration: 5000,
        });

        // Refresh all staff permissions after role change
        if (onRoleUpdate && field === 'role') {
          await onRoleUpdate();
        }
      }
      setOpenDropdown(null);
    } catch (err) {
      console.error(`Failed to update ${field}:`, err.message);
    } finally {
      setCellLoading(null);
    }
  }, [onRoleUpdate, showBanner]);

  // Load templates on mount for role display & filtering
  useEffect(() => {
    fetchTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  // Debounced user search
  const handleAddSearch = useCallback((value, mdsFilter = mdsOnly) => {
    setAddSearch(value);
    setAddSearchError(null);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (value.trim().length < 2) {
      setAddSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setAddSearching(true);
      try {
        const results = await searchUsers(value.trim(), mdsFilter);
        setAddSearchResults(results);
      } catch (err) {
        setAddSearchError(err.message);
      } finally {
        setAddSearching(false);
      }
    }, 400);
  }, [mdsOnly]);

  // Re-trigger search when mdsOnly filter changes
  useEffect(() => {
    if (showAddModal && addSearch.trim().length >= 2 && !selectedUser) {
      handleAddSearch(addSearch, mdsOnly);
    }
  }, [mdsOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStaffAccounts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const records = await fetchStaffAccountsAPI();
      setStaffList(records);
    } catch (err) {
      setLoadError(err.message || 'Failed to load staff accounts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleOpenAddModal = useCallback(async () => {
    setShowAddModal(true);
    setAddSearch('');
    setAddSearchResults([]);
    setSelectedUser(null);
    setAddForm({ title: '', role: '', designation: 'Both', templateId: '' });
    setAddError(null);
    setMdsOnly(false);
    try {
      const t = await fetchTemplates();
      setTemplates(t);
    } catch {
      setTemplates([]);
    }
  }, []);

  const handleAddStaff = useCallback(async () => {
    if (!selectedUser) return;
    setAddSubmitting(true);
    setAddError(null);
    try {
      const input = {
        userId: selectedUser.id,
        title: addForm.title || 'Staff',
        role: addForm.role || 'Staff',
        designation: addForm.designation,
      };
      if (addForm.templateId) input.templateId = addForm.templateId;
      await createMedicalPersonnel(input);
      setShowAddModal(false);
      loadStaffAccounts();
    } catch (err) {
      setAddError(err.message || 'Failed to add staff.');
    } finally {
      setAddSubmitting(false);
    }
  }, [selectedUser, addForm, loadStaffAccounts]);

  useEffect(() => {
    loadStaffAccounts();
  }, [loadStaffAccounts]);

  const roleColorPool = [
    'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400',
    'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400',
    'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
    'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400',
  ];
  const getRoleColor = (roleName) => {
    const idx = templates.findIndex(t => t.label === roleName);
    return idx >= 0 ? roleColorPool[idx % roleColorPool.length] : 'bg-neutral-100 dark:bg-neutral-800 text-secondary-500 dark:text-neutral-400';
  };

  const statusConfig = {
    Active:    { dot: 'bg-success-500', text: 'text-success-600 dark:text-success-400' },
    Suspended: { dot: 'bg-error-500',   text: 'text-error-600 dark:text-error-400' },
    Pending:   { dot: 'bg-warning-500', text: 'text-warning-600 dark:text-warning-400' },
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
      prev.map((s) => (s.id === updatedStaff.id ? updatedStaff : s))
    );
    setSelectedStaff(null);
  };

  const handleDeleteStaff = useCallback((deletedStaffId) => {
    const normalizedId = String(deletedStaffId || '').trim();
    if (!normalizedId) {
      setSelectedStaff(null);
      return;
    }

    setStaffList((prev) => prev.filter((s) => String(s.id) !== normalizedId));
    setSelectedStaff(null);
  }, []);

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
          {templates.map((t) => (
            <option key={t.id} value={t.label}>{t.label}</option>
          ))}
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
          onClick={loadStaffAccounts}
          disabled={isLoading}
          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <svg className={`w-3.5 h-3.5 text-neutral-500 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Staff
        </button>
      </div>

      {/* Staff Count */}
      <p className="text-xs text-secondary-400 dark:text-neutral-500 mb-1.5">
        {filteredStaff.length} staff account{filteredStaff.length !== 1 ? 's' : ''}
        {filterRole !== 'all' && ` · ${filterRole}`}
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
          <button onClick={loadStaffAccounts} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Retry</button>
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
                <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Name</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Role</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider hidden md:table-cell">Branch</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider hidden sm:table-cell">Status</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-secondary-500 dark:text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((s) => {
                const sc = statusConfig[s.status] || statusConfig.Pending;
                const isStaffAdmin = s.permissions?.is_admin === true;
                const isPending = s.status === 'Pending';
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
                          <span className="text-sm font-medium text-secondary-900 dark:text-white truncate">{s.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 hidden md:table-cell">
                      <span className="text-xs text-secondary-500 dark:text-neutral-400">{s.email}</span>
                    </td>

                    {/* Role — inline dropdown */}
                    <td className="py-3 px-3">
                      {isPending || isStaffAdmin ? (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${isPending ? 'bg-neutral-100 dark:bg-neutral-800 text-secondary-400 dark:text-neutral-500' : isStaffAdmin ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : getRoleColor(s.role)}`}>
                          {isPending ? '—' : isStaffAdmin ? 'Admin' : (s.role || 'Unassigned')}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleDropdown(s.id, 'role', e.currentTarget); }}
                            disabled={!!cellLoading}
                            className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full transition-colors ${getRoleColor(s.role)} hover:ring-2 hover:ring-primary-300 dark:hover:ring-primary-700`}
                          >
                            {cellLoading?.staffId === s.id && cellLoading?.field === 'role' ? (
                              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                {s.role || 'Unassigned'}
                                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </>
                            )}
                          </button>
                          {openDropdown?.staffId === s.id && openDropdown?.field === 'role' && ReactDOM.createPortal(
                            <div ref={dropdownRef} style={{ position: 'fixed', top: openDropdown.rect.bottom + 4, left: openDropdown.rect.left }} className="z-[9999] w-40 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1">
                              {templates.filter(t => t.label !== s.role).map(t => (
                                <button
                                  key={t.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDropdown(null);
                                    setPendingAccountUpdate({ staffId: s.id, field: 'role', role: t.label, templateId: t.id });
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-secondary-700 dark:text-neutral-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                                >
                                  {t.label}
                                </button>
                              ))}
                              {templates.filter(t => t.label !== s.role).length === 0 && (
                                <p className="px-3 py-1.5 text-[10px] text-secondary-400 dark:text-neutral-500">No other roles</p>
                              )}
                            </div>,
                            document.body
                          )}
                        </>
                      )}
                    </td>

                    {/* Branch — inline dropdown */}
                    <td className="py-3 px-3 hidden md:table-cell">
                      {isPending ? (
                        <span className="text-xs text-secondary-500 dark:text-neutral-400">—</span>
                      ) : isStaffAdmin ? (
                        <span className="text-xs text-secondary-500 dark:text-neutral-400">
                          {s.branch === 'QuezonCity' ? 'Quezon City' : s.branch === 'Both' || !s.branch ? 'MLA & QC (Both)' : s.branch}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleDropdown(s.id, 'branch', e.currentTarget); }}
                            disabled={!!cellLoading}
                            className="inline-flex items-center gap-1 text-xs text-secondary-600 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                          >
                            {cellLoading?.staffId === s.id && cellLoading?.field === 'branch' ? (
                              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                {s.branch === 'QuezonCity' ? 'Quezon City' : s.branch === 'Both' ? 'MLA & QC (Both)' : (s.branch || '—')}
                                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </>
                            )}
                          </button>
                          {openDropdown?.staffId === s.id && openDropdown?.field === 'branch' && ReactDOM.createPortal(
                            <div ref={dropdownRef} style={{ position: 'fixed', top: openDropdown.rect.bottom + 4, left: openDropdown.rect.left }} className="z-[9999] w-36 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1">
                              {['Manila', 'QuezonCity', 'Both'].filter(b => b !== s.branch).map(b => (
                                <button
                                  key={b}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDropdown(null);
                                    setPendingAccountUpdate({ staffId: s.id, field: 'branch', designation: b });
                                  }}
                                className="w-full text-left px-3 py-1.5 text-xs text-secondary-700 dark:text-neutral-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                              >
                                  {b === 'QuezonCity' ? 'Quezon City' : b === 'Both' ? 'MLA & QC (Both)' : b}
                                </button>
                              ))}
                            </div>,
                            document.body
                          )}
                        </>
                      )}
                    </td>

                    {/* Status — inline dropdown */}
                    <td className="py-3 px-3 hidden sm:table-cell">
                      {isPending || isStaffAdmin ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {s.status}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleDropdown(s.id, 'status', e.currentTarget); }}
                            disabled={!!cellLoading}
                            className={`inline-flex items-center gap-1 text-xs font-medium ${sc.text} hover:ring-2 hover:ring-primary-300 dark:hover:ring-primary-700 rounded-full px-1.5 py-0.5 transition-colors`}
                          >
                            {cellLoading?.staffId === s.id && cellLoading?.field === 'status' ? (
                              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                {s.status}
                                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </>
                            )}
                          </button>
                          {openDropdown?.staffId === s.id && openDropdown?.field === 'status' && ReactDOM.createPortal(
                            <div ref={dropdownRef} style={{ position: 'fixed', top: openDropdown.rect.bottom + 4, left: openDropdown.rect.left }} className="z-[9999] w-32 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1">
                              {['Active', 'Suspended'].filter(st => st !== s.status).map(st => {
                                const stc = statusConfig[st];
                                return (
                                  <button
                                    key={st}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenDropdown(null);
                                      setPendingAccountUpdate({ staffId: s.id, field: 'status', status: st });
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-secondary-700 dark:text-neutral-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors flex items-center gap-1.5"
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${stc.dot}`} />
                                    {st}
                                  </button>
                                );
                              })}
                            </div>,
                            document.body
                          )}
                        </>
                      )}
                    </td>

                    <td className="py-3 px-3 text-xs text-secondary-500 dark:text-neutral-400 hidden lg:table-cell whitespace-nowrap">
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
          onDelete={handleDeleteStaff}
        />
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm font-semibold text-secondary-900 dark:text-white">Add Staff Account</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
              {/* Step 1: Search for user */}
              {!selectedUser ? (
                <div>
                  <label className="block text-xs font-medium text-secondary-700 dark:text-neutral-300 mb-1.5">
                    Search Employee by Email, Name, or ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. juan.mds@tip.edu.ph or Juan Dela Cruz"
                    value={addSearch}
                    onChange={(e) => handleAddSearch(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-secondary-800 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    autoFocus
                  />
                  {/* .mds@tip filter checkbox */}
                  <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={mdsOnly}
                      onChange={(e) => setMdsOnly(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-[10px] text-secondary-600 dark:text-neutral-400">
                      Show only <span className="font-medium text-primary-600 dark:text-primary-400">.mds@tip.edu.ph</span> accounts
                    </span>
                  </label>
                  {addSearching && (
                    <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mt-1.5">Searching...</p>
                  )}
                  {addSearchError && (
                    <p className="text-[10px] text-error-600 dark:text-error-400 mt-1.5">{addSearchError}</p>
                  )}
                  {addSearchResults.length > 0 && (
                    <div className="mt-2 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                      {addSearchResults.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            if (u.isMedicalPersonnel || u.identity !== 'Employee') return;
                            if (!u.email?.endsWith('.mds@tip.edu.ph')) {
                              setNonMdsWarningUser(u);
                            } else {
                              setSelectedUser(u);
                            }
                          }}
                          disabled={u.isMedicalPersonnel || u.identity !== 'Employee'}
                          className={`w-full text-left px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 transition-colors ${
                            u.isMedicalPersonnel || u.identity !== 'Employee'
                              ? 'opacity-50 cursor-not-allowed bg-neutral-50 dark:bg-neutral-800/30'
                              : 'hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-secondary-900 dark:text-white">{u.name}</p>
                              <p className="text-[10px] text-secondary-500 dark:text-neutral-400">{u.email}</p>
                            </div>
                            <div className="text-right">
                              {u.isMedicalPersonnel ? (
                                <span className="text-[9px] px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 text-secondary-500 dark:text-neutral-400 rounded font-medium">
                                  Already Staff
                                </span>
                              ) : u.identity !== 'Employee' ? (
                                <span className="text-[9px] px-1.5 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 rounded font-medium">
                                  {u.identity} — Not Eligible
                                </span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.5 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 rounded font-medium">
                                  Employee · ID {u.id}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {addSearch.trim().length >= 2 && !addSearching && addSearchResults.length === 0 && !addSearchError && (
                    <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mt-2 text-center py-3">No users found.</p>
                  )}
                </div>
              ) : (
                /* Step 2: Configure staff details */
                <div className="space-y-3">
                  {/* Selected user info */}
                  <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                      {selectedUser.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-secondary-900 dark:text-white truncate">{selectedUser.name}</p>
                      <p className="text-[10px] text-secondary-500 dark:text-neutral-400 truncate">{selectedUser.email}</p>
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0"
                    >
                      Change
                    </button>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-[10px] font-medium text-secondary-600 dark:text-neutral-400 mb-1">Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr., Nurse, Medical Staff"
                      value={addForm.title}
                      onChange={(e) => setAddForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-secondary-800 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>

                  {/* Role (from templates only) */}
                  <div>
                    <label className="block text-[10px] font-medium text-secondary-600 dark:text-neutral-400 mb-1">Role</label>
                    <select
                      value={addForm.role}
                      onChange={(e) => {
                        const selectedLabel = e.target.value;
                        const matchedTemplate = templates.find(t => t.label === selectedLabel);
                        setAddForm(prev => ({
                          ...prev,
                          role: selectedLabel,
                          templateId: matchedTemplate ? matchedTemplate.id : '',
                        }));
                      }}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-secondary-800 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="">Select a role…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.label}>{t.label} ({t.permissionCount} permissions)</option>
                      ))}
                    </select>
                    {templates.length === 0 && (
                      <p className="text-[9px] text-warning-600 dark:text-warning-400 mt-1">
                        No role templates found. Create templates in the Role Templates tab first.
                      </p>
                    )}
                  </div>

                  {/* Designation */}
                  <div>
                    <label className="block text-[10px] font-medium text-secondary-600 dark:text-neutral-400 mb-1">Branch Designation</label>
                    <select
                      value={addForm.designation}
                      onChange={(e) => setAddForm(prev => ({ ...prev, designation: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-secondary-800 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="Both">MLA & QC (Both)</option>
                      <option value="Manila">Manila</option>
                      <option value="QuezonCity">Quezon City</option>
                    </select>
                  </div>

                  {/* Template auto-applied from role selection */}
                  {addForm.templateId && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-800">
                      <svg className="w-3.5 h-3.5 text-success-600 dark:text-success-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-[10px] text-success-700 dark:text-success-400">
                        Permissions from <span className="font-medium">{addForm.role}</span> template will be applied automatically.
                      </p>
                    </div>
                  )}

                  {addError && (
                    <p className="text-[10px] text-error-600 dark:text-error-400 bg-error-50 dark:bg-error-900/20 rounded-lg px-3 py-2">{addError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {selectedUser && (
              <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-secondary-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStaff}
                  disabled={addSubmitting || !addForm.title.trim() || !addForm.role.trim()}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addSubmitting ? 'Adding...' : 'Add Staff'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Non-MDS Warning Modal */}
      {nonMdsWarningUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setNonMdsWarningUser(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 rounded-xl shadow-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-warning-600 dark:text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-secondary-900 dark:text-white">Non-MDS Account</h4>
                <p className="text-[10px] text-secondary-500 dark:text-neutral-400">This employee is not a TIP MDS account</p>
              </div>
            </div>
            <div className="bg-warning-50 dark:bg-warning-900/20 rounded-lg px-3 py-2.5 mb-4 border border-warning-200 dark:border-warning-800">
              <p className="text-xs text-warning-800 dark:text-warning-300">
                <span className="font-semibold">{nonMdsWarningUser.name}</span>{' '}
                (<span className="font-mono text-[10px]">{nonMdsWarningUser.email}</span>) does not use a{' '}
                <span className="font-medium">.mds@tip.edu.ph</span> email address.
              </p>
              <p className="text-[10px] text-warning-700 dark:text-warning-400 mt-1 mb-0">
                Adding non-MDS employees as staff may cause access issues. Proceed only if intentional.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNonMdsWarningUser(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-secondary-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setSelectedUser(nonMdsWarningUser); setNonMdsWarningUser(null); }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-warning-600 hover:bg-warning-700 text-white transition-colors"
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!pendingAccountUpdate}
        onClose={() => setPendingAccountUpdate(null)}
        onConfirm={async () => {
          if (!pendingAccountUpdate) return;
          const { staffId, field, role, templateId, designation, status } = pendingAccountUpdate;
          setPendingAccountUpdate(null);

          if (field === 'role') {
            await handleCellUpdate(staffId, 'role', role, templateId);
          } else if (field === 'branch') {
            await handleCellUpdate(staffId, 'branch', designation);
          } else if (field === 'status') {
            await handleCellUpdate(staffId, 'status', status);
          }
        }}
        title="Confirm Account Update"
        message="Updating this account will notify the staff and reload their page."
        description="Proceed with account update?"
        confirmText="Update Account"
        cancelText="Cancel"
        variant="primary"
      />
    </div>
  );
};

export default StaffAccounts;

