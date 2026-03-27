import React, { useState, useEffect, useCallback } from 'react';
import { DEFAULT_ROLE_TEMPLATES, ROLE_COLORS, allModules, clonePermissions } from '../role-permissions';
import { fetchTemplates, createTemplate, updateTemplate, deleteTemplate } from '../staff-service';
import PermissionMatrix from './permission-matrix';

/**
 * Role Templates Component
 * Left panel: list of role presets with add/delete.
 * Right panel: view/edit permissions for selected role.
 */
const RoleTemplates = () => {
  const [roles, setRoles] = useState(DEFAULT_ROLE_TEMPLATES);
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id || null);
  const [workingPermissions, setWorkingPermissions] = useState(() => clonePermissions(roles[0]?.permissions || {}));
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load templates from API on mount
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const apiTemplates = await fetchTemplates();
      // Merge: keep default locked templates + add API templates
      const merged = [...DEFAULT_ROLE_TEMPLATES.filter(t => t.locked)];
      for (const t of apiTemplates) {
        // Skip if it matches a locked default
        if (merged.find(m => m.id === t.id)) continue;
        const defaultMatch = DEFAULT_ROLE_TEMPLATES.find(d => d.label === t.label || d.id === t.id);
        merged.push({
          id: t.id,
          name: t.label,
          description: defaultMatch?.description || 'Custom role — configure permissions below',
          color: defaultMatch?.color || ROLE_COLORS[merged.length % ROLE_COLORS.length],
          locked: false,
          permissions: t.permissions,
          _backendId: t.id,
        });
      }
      setRoles(merged);
      const sel = merged[0];
      setSelectedRoleId(sel?.id || null);
      setWorkingPermissions(clonePermissions(sel?.permissions || {}));
    } catch {
      // Fallback to defaults on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const colorMap = {
    error: 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 border-error-200 dark:border-error-800',
    accent: 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 border-accent-200 dark:border-accent-800',
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border-primary-200 dark:border-primary-800',
    success: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 border-success-200 dark:border-success-800',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    warning: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 border-warning-200 dark:border-warning-800',
  };

  const dotColor = (c) =>
    c === 'error' ? 'bg-error-500'
    : c === 'accent' ? 'bg-accent-500'
    : c === 'primary' ? 'bg-primary-500'
    : c === 'success' ? 'bg-success-500'
    : c === 'purple' ? 'bg-purple-500'
    : 'bg-warning-500';

  const handleSelectRole = (roleId) => {
    if (hasChanges) {
      if (!window.confirm('You have unsaved changes. Discard?')) return;
    }
    const role = roles.find((r) => r.id === roleId);
    setSelectedRoleId(roleId);
    setWorkingPermissions(clonePermissions(role?.permissions || {}));
    setHasChanges(false);
    setConfirmDeleteId(null);
  };

  const handlePermissionChange = (updated) => {
    setWorkingPermissions(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    const role = roles.find((r) => r.id === selectedRoleId);
    if (!role || role.locked) return;
    setIsSaving(true);
    try {
      if (role._backendId) {
        await updateTemplate(role._backendId, undefined, workingPermissions);
      } else {
        const created = await createTemplate(role.name, workingPermissions);
        if (created) {
          setRoles((prev) =>
            prev.map((r) => r.id === selectedRoleId ? { ...r, _backendId: created.id, permissions: clonePermissions(workingPermissions) } : r)
          );
        }
      }
      setRoles((prev) =>
        prev.map((r) =>
          r.id === selectedRoleId ? { ...r, permissions: clonePermissions(workingPermissions) } : r
        )
      );
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to save template:', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setWorkingPermissions(clonePermissions(selectedRole.permissions));
    setHasChanges(false);
  };

  // ── Add Role ──
  const handleAddRole = async () => {
    if (!newRoleName.trim()) return;
    const id = newRoleName.trim().toLowerCase().replace(/\s+/g, '-');
    if (roles.find((r) => r.id === id)) return;
    const usedColors = roles.map((r) => r.color);
    const color = ROLE_COLORS.find((c) => !usedColors.includes(c)) || ROLE_COLORS[roles.length % ROLE_COLORS.length];
    const perms = allModules(false);
    setIsSaving(true);
    try {
      const created = await createTemplate(newRoleName.trim(), perms);
      const newRole = {
        id: created?.id || id,
        name: newRoleName.trim(),
        description: 'Custom role — configure permissions below',
        color,
        locked: false,
        permissions: created?.permissions || perms,
        _backendId: created?.id || null,
      };
      setRoles((prev) => [...prev, newRole]);
      setSelectedRoleId(newRole.id);
      setWorkingPermissions(clonePermissions(newRole.permissions));
      setShowAddForm(false);
      setNewRoleName('');
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to create template:', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete Role ──
  const handleDeleteRole = async (roleId) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role || role.locked) return;
    setIsSaving(true);
    try {
      if (role._backendId) {
        await deleteTemplate(role._backendId);
      }
      const updated = roles.filter((r) => r.id !== roleId);
      setRoles(updated);
      if (selectedRoleId === roleId) {
        const fallback = updated[0];
        setSelectedRoleId(fallback?.id || null);
        setWorkingPermissions(clonePermissions(fallback?.permissions || {}));
        setHasChanges(false);
      }
    } catch (err) {
      console.error('Failed to delete template:', err.message);
    } finally {
      setIsSaving(false);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Left — Role List */}
      <div className="w-48 flex-shrink-0">
        <div className="space-y-1">
          {roles.map((role) => (
            <div key={role.id} className="group relative">
              <button
                onClick={() => handleSelectRole(role.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedRoleId === role.id
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                    : 'text-secondary-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor(role.color)}`} />
                  <span className="truncate flex-1">{role.name}</span>
                </div>
              </button>
              {/* Delete button — hidden for locked roles */}
              {!role.locked && (
                <>
                  {confirmDeleteId === role.id ? (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        className="p-1 rounded bg-error-500 text-white hover:bg-error-600 transition-colors"
                        title="Confirm delete"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="p-1 rounded bg-neutral-200 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                        title="Cancel"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(role.id); }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/30 transition-all"
                      title="Delete role"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add Role */}
        {showAddForm ? (
          <div className="mt-2 space-y-1.5">
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
              placeholder="Role name..."
              autoFocus
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-secondary-800 dark:text-white placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <div className="flex gap-1">
              <button
                onClick={handleAddRole}
                disabled={!newRoleName.trim()}
                className="flex-1 px-2 py-1 text-[10px] font-medium bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewRoleName(''); }}
                className="px-2 py-1 text-[10px] font-medium text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-secondary-500 dark:text-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Role
          </button>
        )}
      </div>

      {/* Right — Role Detail */}
      {selectedRole && (
        <div className="flex-1 min-w-0">
          {/* Role Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-semibold text-secondary-900 dark:text-white leading-none">{selectedRole.name}</h4>
                <span className={`text-xs px-2 py-0.5 rounded-full border leading-none ${colorMap[selectedRole.color] || colorMap.primary}`}>
                  {selectedRole.locked ? 'System' : 'Custom'}
                </span>
              </div>
              <p className="text-xs text-secondary-500 dark:text-neutral-400 mt-1">{selectedRole.description}</p>
            </div>

          </div>

          {/* Admin lock notice */}
          {selectedRole.locked && (
            <div className="mb-3 px-3 py-2 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
              <p className="text-xs text-warning-700 dark:text-warning-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Admin role has full access and cannot be modified
              </p>
            </div>
          )}

          {/* Permission Matrix */}
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
            <PermissionMatrix
              permissions={workingPermissions}
              onChange={handlePermissionChange}
              readOnly={selectedRole.locked}
            />
          </div>

          {/* Save / Cancel */}
          {hasChanges && (
            <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs font-medium text-secondary-600 dark:text-neutral-400 hover:text-secondary-800 dark:hover:text-white transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-1.5 text-xs font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Saving…' : 'Save Template'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RoleTemplates;
