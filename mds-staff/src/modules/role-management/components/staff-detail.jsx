import React, { useState, useEffect } from 'react';
import { updateStaffAccount, fetchTemplates, deleteMedicalStaff } from '../staff-service';
import ActivityLog from './activity-log';
import { useBanner } from '../../../context/use-banner';
import { usePermissions } from '../../../context/permissions-context';
import ConfirmationModal from '../../../components/modals/ConfirmationModal.jsx';
import { formatBranchLabel } from '../../../utils/branch-utils';

/**
 * Staff Detail Component
 * Centered modal with 2 tabs: Info, Activity Log
 * Role dropdown populated from backend Role Templates.
 * Permissions are template-only — no per-staff overrides.
 */
const StaffDetail = ({ staff, onClose, onSave, onDelete }) => {
  const { showBanner } = useBanner();
  const { isAdmin: isCurrentUserAdmin } = usePermissions();
  const isPending = staff.status === 'Pending';

  const [activeTab, setActiveTab] = useState('info');
  const [templates, setTemplates] = useState([]);
  const [role, setRole] = useState(staff.role || '');
  const [originalRole] = useState(staff.role || '');
  const [branch, setBranch] = useState(staff.branch || 'Both');
  const [originalBranch] = useState(staff.branch || 'Both');
  const [status, setStatus] = useState(isPending ? 'Active' : staff.status);
  const [hasChanges, setHasChanges] = useState(isPending);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showAccountUpdateConfirm, setShowAccountUpdateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Load templates from backend
  useEffect(() => {
    fetchTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const currentTemplate = templates.find(t => t.label === role);
  const isTargetAdmin = staff.permissions?.is_admin === true;

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setHasChanges(true);
  };

  const handleDeleteStaff = async () => {
    if (!isCurrentUserAdmin) return;
    if (isTargetAdmin) {
      setDeleteError('Admin staff record cannot be deleted directly. Use Admin Transfer first.');
      return;
    }

    setDeleteError(null);
    setIsDeleting(true);

    try {
      const result = await deleteMedicalStaff(staff.id);
      if (!result?.ok) {
        throw new Error(result?.message || 'Failed to delete medical staff record.');
      }

      showBanner({
        type: 'success',
        message: result.message || 'Medical staff record deleted successfully.',
        duration: 5000,
      });

      if (typeof onDelete === 'function') {
        onDelete(String(staff.id));
      } else {
        onClose();
      }
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete medical staff record.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async (confirmedAccountUpdate = false) => {
    setSaveError(null);
    try {
      const roleChanged = role !== originalRole;
      const branchChanged = branch !== originalBranch;

      if (!confirmedAccountUpdate) {
        setShowAccountUpdateConfirm(true);
        return;
      }

      setIsSaving(true);

      const result = await updateStaffAccount(
        staff.id,
        status,
        roleChanged ? role : undefined,
        roleChanged && currentTemplate ? currentTemplate.id : undefined,
        branchChanged ? branch : undefined,
      );
      const updatedStaff = result.staff
        ? result.staff
        : { ...staff, role, status, branch };

      showBanner({
        type: 'success',
        message: 'Staff account updated and staff notified.',
        duration: 5000,
      });

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
    { id: 'activity', label: 'Activity Log' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl shadow-2xl flex flex-col max-h-[85vh] animate-fade-in">
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#F1C526] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
              {staff.name.split(' ').map((n) => n[0]).join('').substring(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-secondary-900 dark:text-white truncate" style={{ lineHeight: 1.2, margin: 0 }}>{staff.name}</h3>
                {isPending ? (
                  <span className="text-[9px] px-1.5 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 rounded font-medium flex-shrink-0">
                    Pending
                  </span>
                ) : isTargetAdmin && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400 rounded font-medium flex-shrink-0">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-secondary-500 dark:text-neutral-400 truncate" style={{ lineHeight: 1.2, margin: 0 }}>
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
        <div className="flex gap-0.5 px-4 pt-1 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
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
        <div className="flex-1 overflow-y-auto px-4 py-2.5">
          {/* ── Info Tab ── */}
          {activeTab === 'info' && (
            <div className="space-y-2.5">
              {/* Account Details */}
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                <div className="bg-neutral-50 dark:bg-neutral-800/50 px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-xs font-semibold text-secondary-800 dark:text-white uppercase tracking-wide">Account Details</h4>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2.5">
                  <div>
                    <p className="text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-0.5">Full Name</p>
                    <p className="text-xs font-medium text-secondary-900 dark:text-white">{staff.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-0.5">Email</p>
                    <p className="text-xs font-medium text-secondary-900 dark:text-white break-all">{staff.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-0.5">Staff ID</p>
                    <p className="text-xs font-medium text-secondary-900 dark:text-white">{staff.id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-0.5">Branch</p>
                    {isTargetAdmin ? (
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-secondary-900 dark:text-white">{formatBranchLabel(branch)}</p>
                        <span className="text-[8px] px-1 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 rounded font-medium leading-none">Locked</span>
                      </div>
                    ) : (
                      <select
                        value={branch}
                        onChange={(e) => { setBranch(e.target.value); setHasChanges(true); }}
                        className="w-full mt-0.5 px-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-secondary-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      >
                        <option value="Manila">Manila</option>
                        <option value="QuezonCity">Quezon City</option>
                        <option value="Both">MLA & QC</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-0.5">Last Login</p>
                    <p className="text-xs font-medium text-secondary-900 dark:text-white">{staff.lastLogin || 'Never'}</p>
                  </div>
                </div>
              </div>

              {/* Role Assignment */}
              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                <div className="bg-neutral-50 dark:bg-neutral-800/50 px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-xs font-semibold text-secondary-800 dark:text-white uppercase tracking-wide">Role Assignment</h4>
                </div>
                <div className="p-3">
                  <label className="text-[10px] font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider mb-1 block">Assigned Role</label>
                  <select
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    disabled={isTargetAdmin}
                    className={`w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-secondary-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ${isTargetAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Select a role…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.label}>{t.label}</option>
                    ))}
                  </select>
                  {isTargetAdmin ? (
                    <p className="text-xs text-warning-600 dark:text-warning-400 mt-1">
                      Admin role cannot be changed directly. Use Admin Transfer instead.
                    </p>
                  ) : currentTemplate ? (
                    <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">
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
                <div className="bg-neutral-50 dark:bg-neutral-800/50 px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-700">
                  <h4 className="text-xs font-semibold text-secondary-800 dark:text-white uppercase tracking-wide">Account Status</h4>
                </div>
                <div className="p-3">
                  {isPending ? (
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">
                      This account is <span className="font-semibold text-warning-600 dark:text-warning-400">pending</span>. Assign a role and save to grant staff portal access.
                    </p>
                  ) : isTargetAdmin ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-success-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-secondary-800 dark:text-white" style={{ lineHeight: 1.2, margin: 0 }}>Admin Account — Always Active</p>
                        <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-0.5" style={{ lineHeight: 1.2, margin: 0 }}>Admin account cannot be deactivated. Use Admin Transfer to change admin control.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-secondary-800 dark:text-white">Account Active</p>
                        <p className="text-xs text-secondary-400 dark:text-neutral-500">Suspended accounts cannot access the staff portal</p>
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

              {isCurrentUserAdmin && (
                <div className="border border-error-200 dark:border-error-800 rounded-lg overflow-hidden">
                  <div className="bg-error-50 dark:bg-error-900/20 px-3 py-2 border-b border-error-200 dark:border-error-800">
                    <h4 className="text-xs font-semibold text-error-700 dark:text-error-300 uppercase tracking-wide">Danger Zone</h4>
                  </div>
                  <div className="p-3 space-y-2">
                    {isTargetAdmin ? (
                      <p className="text-xs text-warning-600 dark:text-warning-400">
                        Admin staff record cannot be deleted directly. Use Admin Transfer to move admin privileges first.
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-secondary-600 dark:text-neutral-400">
                          Delete this staff record from MedicalPersonnel. This action removes role-management access for the selected account.
                        </p>
                        {deleteError && (
                          <p className="text-xs text-error-600 dark:text-error-400">{deleteError}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(true)}
                          disabled={isDeleting}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-error-600 hover:bg-error-700 text-white transition-colors disabled:opacity-60"
                        >
                          Delete Staff Record
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Activity Log Tab ── */}
          {activeTab === 'activity' && (
            <ActivityLog staffId={staff.id} />
          )}
        </div>

        {/* Footer — Save / Cancel */}
        {(hasChanges || saveError) && (
          <div className="px-4 py-2 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-2 flex-shrink-0 bg-neutral-50 dark:bg-neutral-800/50 rounded-b-xl">
            <div className="flex-1 min-w-0">
              {saveError && (
                <p className="text-xs text-error-600 dark:text-error-400 truncate">{saveError}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isPending && (
                <button
                  disabled={isSaving}
                  onClick={() => { setRole(staff.role); setStatus(staff.status); setBranch(staff.branch || 'Both'); setHasChanges(false); setSaveError(null); }}
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

      <ConfirmationModal
        isOpen={showAccountUpdateConfirm}
        onClose={() => setShowAccountUpdateConfirm(false)}
        onConfirm={async () => {
          setShowAccountUpdateConfirm(false);
          await handleSave(true);
        }}
        title="Confirm Account Update"
        message="Updating this account will notify the staff and reload their page."
        description="Proceed with account update?"
        confirmText="Update Account"
        cancelText="Cancel"
        variant="primary"
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await handleDeleteStaff();
        }}
        isLoading={isDeleting}
        title="Confirm Staff Deletion"
        message="Delete this medical staff record?"
        description="This deletes the record from MedicalPersonnel and removes role-management staff access."
        confirmText="Delete Staff"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default StaffDetail;
