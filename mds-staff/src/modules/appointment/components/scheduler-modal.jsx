import React, { useState, useEffect, useCallback } from 'react';
import { listAllRequirements, updateRequirement, deleteRequirement } from '../staff-appointment-service';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LOCATIONS = ['Arlegui', 'Casal', 'QuezonCity'];

const SchedulerModal = ({ isOpen, onClose, onSave, onDelete, editingScheduler }) => {
  const isEditing = !!editingScheduler;

  const [formData, setFormData] = useState(getDefaults(null));
  const [requirements, setRequirements] = useState([]);
  const [newReqLabel, setNewReqLabel] = useState('');
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset form when modal opens / scheduler changes
  useEffect(() => {
    if (isOpen) {
      setFormData(getDefaults(editingScheduler));
      setNewReqLabel('');
      setModalError('');
      setShowDeleteConfirm(false);
      if (editingScheduler?.id) {
        loadRequirements(editingScheduler.id);
      } else {
        setRequirements([]);
      }
    }
  }, [isOpen, editingScheduler]);

  const loadRequirements = useCallback(async (schedulerId) => {
    setLoadingReqs(true);
    try {
      const reqs = await listAllRequirements(schedulerId);
      setRequirements(reqs || []);
    } catch {
      setRequirements([]);
    } finally {
      setLoadingReqs(false);
    }
  }, []);

  if (!isOpen) return null;

  const numericFields = new Set(['morningAllowed', 'afternoonAllowed']);
  const handleChange = (field) => (e) => {
    if (numericFields.has(field)) {
      const val = e.target.value;
      if (val === '') { setFormData((prev) => ({ ...prev, [field]: '' })); return; }
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 0) setFormData((prev) => ({ ...prev, [field]: num }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    }
  };

  const toggleDay = (day) => {
    setFormData((prev) => ({
      ...prev,
      schedulePerWeek: prev.schedulePerWeek.includes(day)
        ? prev.schedulePerWeek.filter((d) => d !== day)
        : [...prev.schedulePerWeek, day],
    }));
  };

  const handleAddRequirement = async () => {
    const label = newReqLabel.trim();
    if (!label) return;

    if (isEditing && editingScheduler?.id) {
      try {
        const req = await updateRequirement(editingScheduler.id, { label, isDigital: true, isActive: true });
        setRequirements((prev) => [...prev, req]);
      } catch { /* requirement might already exist */ }
    } else {
      // For new schedulers, track locally (saved after scheduler creation)
      setRequirements((prev) => [...prev, { id: `local-${Date.now()}`, label, isDigital: true, isActive: true }]);
    }
    setNewReqLabel('');
  };

  const handleRemoveRequirement = async (req) => {
    if (isEditing && editingScheduler?.id && !String(req.id).startsWith('local-')) {
      try {
        await deleteRequirement(editingScheduler.id, req.label);
      } catch (err) {
        setModalError(err.message || 'Failed to delete requirement.');
        return;
      }
    }
    setRequirements((prev) => prev.filter((r) => r.id !== req.id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.label.trim()) { setModalError('Label is required.'); return; }
    if (formData.schedulePerWeek.length === 0) { setModalError('Select at least one schedule day.'); return; }

    setSaving(true);
    setModalError('');
    try {
      const pendingReqs = requirements.filter((r) => String(r.id).startsWith('local-'));
      await onSave?.({ ...formData, id: editingScheduler?.id }, pendingReqs);
      onClose();
    } catch (err) {
      setModalError(err.message || 'Failed to save scheduler.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
              {isEditing ? 'Edit Scheduler' : 'New Scheduler'}
            </h2>
            <p className="text-sm text-secondary-500 dark:text-neutral-400 mt-0.5">
              {isEditing ? 'Modify scheduler settings and requirements' : 'Create a new appointment scheduler'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-secondary-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Inline error */}
          {modalError && (
            <div className="px-3 py-2 bg-error-50 dark:bg-error-900/30 border border-error-200 dark:border-error-800 text-error-700 dark:text-error-400 text-sm rounded-lg flex justify-between items-center">
              <span>{modalError}</span>
              <button type="button" onClick={() => setModalError('')} className="ml-2 font-bold">&times;</button>
            </div>
          )}

          {/* Label */}
          <div>
            <label className="text-sm font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">Label</label>
            <input
              type="text"
              value={formData.label}
              onChange={handleChange('label')}
              placeholder="e.g., Medical Consultation"
              required
              className="w-full px-3 py-2 text-base bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-sm font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">Location</label>
            <div className="flex gap-2">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, location: loc }))}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    formData.location === loc
                      ? 'bg-primary-500 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Visible To */}
          <div>
            <label className="text-sm font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">Visible To</label>
            <div className="flex gap-2">
              {[
                { label: 'Both', value: null },
                { label: 'Employee Only', value: 'Employee' },
                { label: 'Student Only', value: 'Student' },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, patientType: value }))}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    formData.patientType === value
                      ? 'bg-accent-500 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Days */}
          <div>
            <label className="text-sm font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">Schedule Days</label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-2.5 py-1 text-sm font-medium rounded-md transition-colors ${
                    formData.schedulePerWeek.includes(day)
                      ? 'bg-accent-500 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Slot Counts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-secondary-500 dark:text-neutral-400 mb-1 block uppercase tracking-wider">Morning Slots</label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.morningAllowed}
                onChange={handleChange('morningAllowed')}
                className="w-full px-3 py-1.5 text-base bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-xs text-secondary-500 dark:text-neutral-400 mb-1 block uppercase tracking-wider">Afternoon Slots</label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.afternoonAllowed}
                onChange={handleChange('afternoonAllowed')}
                className="w-full px-3 py-1.5 text-base bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={handleChange('notes')}
              rows={2}
              placeholder="Additional details..."
              className="w-full px-3 py-2 text-base bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-1.5">
            {isEditing && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-base text-secondary-700 dark:text-neutral-300">Active</span>
              </label>
            )}
          </div>

          {/* ── Requirements ───────────────────────────────────────────── */}
          <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-secondary-800 dark:text-white uppercase tracking-wide">Requirements</h3>
              <span className="text-xs text-secondary-400 dark:text-neutral-500">{requirements.length} items</span>
            </div>

            {/* List */}
            <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
              {loadingReqs ? (
                <div className="px-4 py-3 text-sm text-secondary-400 dark:text-neutral-500">Loading...</div>
              ) : requirements.length > 0 ? (
                requirements.map((req) => (
                  <div key={req.id} className="px-4 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-base text-secondary-700 dark:text-neutral-300 truncate">{req.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveRequirement(req)}
                      className="p-1 text-error-400 hover:text-error-600 dark:text-error-500 dark:hover:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded transition-colors flex-shrink-0"
                      title="Remove requirement"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-secondary-400 dark:text-neutral-500">No requirements yet</div>
              )}
            </div>

            {/* Add requirement */}
            <div className="px-4 py-2.5 border-t border-neutral-200 dark:border-neutral-700 flex gap-2">
              <input
                type="text"
                value={newReqLabel}
                onChange={(e) => setNewReqLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddRequirement(); } }}
                placeholder="e.g., Certificate of Employment"
                className="flex-1 px-3 py-1.5 text-base bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={handleAddRequirement}
                disabled={!newReqLabel.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add
              </button>
            </div>
          </div>

          {/* Delete Confirmation Panel */}
          {showDeleteConfirm && (
            <div className="rounded-lg border border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/20 p-4">
              <p className="text-base font-semibold text-error-700 dark:text-error-400 mb-1">Delete this scheduler?</p>
              <p className="text-sm text-error-600 dark:text-error-500 mb-3">This action cannot be undone. Any active appointments under this scheduler will be affected.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-sm font-medium text-secondary-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setModalError('');
                    try {
                      await onDelete(editingScheduler.id);
                      onClose();
                    } catch (err) {
                      setModalError(err.message || 'Failed to delete scheduler.');
                      setShowDeleteConfirm(false);
                    }
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-error-500 hover:bg-error-600 rounded-md transition-colors"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
            {isEditing && onDelete && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-base font-medium text-error-600 dark:text-error-400 bg-error-50 dark:bg-error-900/20 hover:bg-error-100 dark:hover:bg-error-900/30 rounded-md transition-colors"
              >
                Delete
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-base font-medium text-secondary-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-base font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

function getDefaults(scheduler) {
  return {
    label: scheduler?.label || '',
    location: scheduler?.location || 'Arlegui',
    patientType: scheduler?.patientType ?? null,
    schedulePerWeek: scheduler?.schedulePerWeek || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    morningAllowed: scheduler?.morningAllowed ?? 20,
    afternoonAllowed: scheduler?.afternoonAllowed ?? 15,
    notes: scheduler?.notes || '',
    isActive: scheduler?.isActive ?? true,
    whitelistOnly: scheduler?.whitelistOnly ?? false,
    purposeRequired: true,
  };
}

export default SchedulerModal;
