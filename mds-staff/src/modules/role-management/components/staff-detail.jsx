import React, { useState, useEffect } from 'react';
import { clonePermissions, hasCustomPermissions, allKeys } from '../role-permissions';
import { updateStaffAccount, fetchTemplates } from '../staff-service';
import PermissionMatrix from './permission-matrix';
import ActivityLog from './activity-log';

/**
 * Staff Detail Component
 * Centered modal with 3 tabs: Info, Permissions, Activity Log
 * Role dropdown populated from backend Role Templates.
 */
const StaffDetail = ({ staff, onClose, onSave }) => {
  const isPending = staff.status === 'Pending';

  const [activeTab, setActiveTab] = useState('info');
  const [templates, setTemplates] = useState([]);
  const [role, setRole] = useState(staff.role || '');
  const [originalRole] = useState(staff.role || '');
  const [permissions, setPermissions] = useState(clonePermissions(staff.permissions || allKeys(false)));
  const [status, setStatus] = useState(isPending ? 'Active' : staff.status);
  const [hasChanges, setHasChanges] = useState(isPending);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Load templates from backend
  useEffect(() => {
    fetchTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const currentTemplate = templates.find(t => t.label === role);
  const isCustom = currentTemplate ? hasCustomPermissions(permissions, null, [{ id: role, permissions: currentTemplate.permissions }]) : role && Object.values(permissions).some(v => v);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    const template = templates.find(t => t.label === newRole);
    if (template) {
      setPermissions(clonePermissions(template.permissions));
    }
    setHasChanges(true);
  };

  const handlePermissionChange = (updated) => {
    setPermissions(updated);
    setHasChanges(true);
  };

  const handleResetToDefault = () => {
    const template = templates.find(t => t.label === role);
    if (template) {
      setPermissions(clonePermissions(template.permissions));
      setHasChanges(true);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      const roleChanged = role !== originalRole;
      const result = await updateStaffAccount(
        staff.id,
        clonePermissions(permissions),
        status,
        roleChanged ? role : undefined,
        roleChanged && currentTemplate ? currentTemplate.id : undefined,
      );
      const updatedStaff = result.staff
        ? result.staff
        : { ...staff, role, permissions: clonePermissions(permissions), status };
      onSave(updatedStaff);
      setHasChanges(false);
    } catch (err) {
      setSaveError(err.message || 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'info', label: 'Info' },
    { id: 'permissions', label: 'Permissions' },
    { id: 'activity', label: 'Activity Log' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl shadow-2xl flex flex-col max-h-[85vh] animate-fade-in">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {staff.name.split(' ').map((n) => n[0]).join('').substring(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-secondary-900 dark:text-white truncate">{staff.name}</h3>
                {isPending ? (
                  <span className="text-[9px] px-1.5 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 rounded font-medium flex-shrink-0">
                    Pending
                  </span>
                ) : isCustom && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-secondary-500 dark:text-neutral-400 rounded font-medium flex-shrink-0">
                    Custom
                  </span>
                )}
              </div>
              <p className="text-[11px] text-secondary-500 dark:text-neutral-400 truncate">
                {isPending ? 'No role assigned yet' : (role || 'No role')} · {staff.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-5 pt-1.5 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {/* ── Info Tab ── */}
          {activeTab === 'info' && (
            <div className="space-y-3">
              {/* Account Details */}
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                <div className="bg-neutral-50 dark:bg-neutral-800/50 px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-[10px] font-semibold text-secondary-800 dark:text-white uppercase tracking-wide">Account Details</h4>
                </div>
                <div className="p-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-0.5">Full Name</p>
                    <p className="text-xs font-medium text-secondary-900 dark:text-white">{staff.name}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-0.5">Email</p>
                    <p className="text-xs font-medium text-secondary-900 dark:text-white break-all">{staff.email}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-0.5">Staff ID</p>
                    <p className="text-xs font-medium text-secondary-900 dark:text-white">{staff.id}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-0.5">Last Login</p>
                    <p className="text-xs font-medium text-secondary-900 dark:text-white">{staff.lastLogin || 'Never'}</p>
                  </div>
                </div>
              </div>

              {/* Role Assignment */}
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                <div className="bg-neutral-50 dark:bg-neutral-800/50 px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-[10px] font-semibold text-secondary-800 dark:text-white uppercase tracking-wide">Role Assignment</h4>
                </div>
                <div className="p-3">
                  <label className="text-[9px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1 block">Assigned Role</label>
                  <select
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-secondary-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    <option value="">Select a role…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.label}>{t.label}</option>
                    ))}
                  </select>
                  {currentTemplate ? (
                    <p className="text-[10px] text-secondary-400 dark:text-neutral-500 mt-1">
                      Template with {currentTemplate.permissionCount} permissions
                    </p>
                  ) : templates.length === 0 ? (
                    <p className="text-[9px] text-warning-600 dark:text-warning-400 mt-1">
                      No role templates found. Create templates in the Role Templates tab first.
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Account Status */}
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                <div className="bg-neutral-50 dark:bg-neutral-800/50 px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-[10px] font-semibold text-secondary-800 dark:text-white uppercase tracking-wide">Account Status</h4>
                </div>
                <div className="p-3">
                  {isPending ? (
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">
                      This account is <span className="font-semibold text-warning-600 dark:text-warning-400">pending</span>. Assign a role and save to grant staff portal access.
                    </p>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-secondary-800 dark:text-white">Account Active</p>
                        <p className="text-[10px] text-secondary-400 dark:text-neutral-500">Suspended accounts cannot access the staff portal</p>
                      </div>
                      <button
                        onClick={() => { setStatus(status === 'Active' ? 'Suspended' : 'Active'); setHasChanges(true); }}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          status === 'Active' ? 'bg-success-500' : 'bg-neutral-300 dark:bg-neutral-600'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                          status === 'Active' ? 'left-5' : 'left-0.5'
                        }`} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Permissions Tab ── */}
          {activeTab === 'permissions' && (
            <div>
              {/* Role + Reset */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-secondary-500 dark:text-neutral-400">Role:</span>
                  <span className="text-xs font-semibold text-secondary-800 dark:text-white">{role || 'No role'}</span>
                </div>
                {isCustom && (
                  <button
                    onClick={handleResetToDefault}
                    className="text-[10px] font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset to Role Default
                  </button>
                )}
              </div>

              <PermissionMatrix
                permissions={permissions}
                onChange={handlePermissionChange}
              />
            </div>
          )}

          {/* ── Activity Log Tab ── */}
          {activeTab === 'activity' && (
            <ActivityLog staffId={staff.id} />
          )}
        </div>

        {/* Footer — Save / Cancel */}
        {(hasChanges || saveError) && (
          <div className="px-5 py-2.5 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-2 flex-shrink-0 bg-neutral-50 dark:bg-neutral-800/50 rounded-b-xl">
            <div className="flex-1 min-w-0">
              {saveError && (
                <p className="text-[10px] text-error-600 dark:text-error-400 truncate">{saveError}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isPending && (
                <button
                  disabled={isSaving}
                  onClick={() => { setRole(staff.role); setPermissions(clonePermissions(staff.permissions)); setStatus(staff.status); setHasChanges(false); setSaveError(null); }}
                  className="px-3 py-1.5 text-xs font-medium text-secondary-600 dark:text-neutral-400 hover:text-secondary-800 dark:hover:text-white transition-colors disabled:opacity-50"
                >
                  Discard
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-1.5 text-xs font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                {isSaving && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
                {isPending ? 'Activate Staff Account' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffDetail;
