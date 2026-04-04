import React, { useState, useEffect } from 'react';

/**
 * Event Modal Component
 * Create/Edit availability events that override default slot schedules
 * SRS §3.4.2 — Staff can dynamically adjust appointment slots
 * 
 * Event Types: Holiday/No Service, Reduced Capacity, Extended Slots, Type-Specific Override, Recurring Block
 */
const EventModal = ({ isOpen, onClose, onSave, initialDate, editingEvent }) => {
  const isEditing = !!editingEvent;

  const [formData, setFormData] = useState(() => getInitialFormData(editingEvent, initialDate));

  // Sync form state when props change (e.g., opening modal with different event/date)
  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormData(editingEvent, initialDate));
    }
  }, [isOpen, editingEvent, initialDate]);

  if (!isOpen) return null;

  const numericFields = new Set(['morningSlots', 'afternoonSlots']);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.startDate || !formData.endDate) return;
    onSave?.({
      ...formData,
      id: editingEvent?.id || `EVT-${Date.now()}`,
    });
    onClose();
  };

  const showSlotInputs = formData.effect === 'Reduce' || formData.effect === 'Expand';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
              {isEditing ? 'Edit Event' : 'Create Availability Event'}
            </h2>
            <p className="text-sm text-secondary-500 dark:text-neutral-400 mt-0.5">
              Override default slot schedule for specific dates
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-secondary-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Event Name */}
          <div>
            <label className="text-sm font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">Event Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={handleChange('name')}
              placeholder="e.g., NSTP Health Screening Week"
              required
              className="w-full px-3 py-2 text-base bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={handleChange('startDate')}
                required
                className="w-full px-3 py-2 text-base bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={handleChange('endDate')}
                required
                className="w-full px-3 py-2 text-base bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Affects */}
          <div>
            <label className="text-sm font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">Affects</label>
            <div className="flex gap-2">
              {['All', 'Medical Only', 'Dental Only'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, affects: opt }))}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    formData.affects === opt
                      ? 'bg-primary-500 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-secondary-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Effect */}
          <div>
            <label className="text-sm font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">Effect</label>
            <select
              value={formData.effect}
              onChange={handleChange('effect')}
              className="w-full px-3 py-2 text-base bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="Suspend">Suspend — No appointments</option>
              <option value="Reduce">Reduce — Lower slot count</option>
              <option value="Expand">Expand — Increase slot count</option>
            </select>
          </div>

          {/* Slot Override (shown only for Reduce/Expand) */}
          {showSlotInputs && (
            <div className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg p-3 space-y-3">
              <p className="text-sm font-medium text-secondary-600 dark:text-neutral-300">Override Slot Counts</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-secondary-500 dark:text-neutral-400 mb-1 block uppercase tracking-wider">Morning Slots</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.morningSlots}
                    onChange={handleChange('morningSlots')}
                    className="w-full px-3 py-1.5 text-base bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-secondary-500 dark:text-neutral-400 mb-1 block uppercase tracking-wider">Afternoon Slots</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.afternoonSlots}
                    onChange={handleChange('afternoonSlots')}
                    className="w-full px-3 py-1.5 text-base bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Recurrence */}
          <div>
            <label className="text-sm font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">Recurrence</label>
            <select
              value={formData.recurrence}
              onChange={handleChange('recurrence')}
              className="w-full px-3 py-2 text-base bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="None">None — One-time event</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-secondary-600 dark:text-neutral-300 mb-1.5 block">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={handleChange('notes')}
              rows={2}
              placeholder="Additional details about this event..."
              className="w-full px-3 py-2 text-base bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md text-secondary-800 dark:text-white placeholder-secondary-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-base font-medium text-secondary-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-base font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors"
            >
              {isEditing ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/** Build initial form data from editing event or defaults */
function getInitialFormData(editingEvent, initialDate) {
  return {
    name: editingEvent?.name || '',
    startDate: editingEvent?.startDate || initialDate || '',
    endDate: editingEvent?.endDate || initialDate || '',
    affects: editingEvent?.affects || 'All',
    effect: editingEvent?.effect || 'Suspend',
    morningSlots: editingEvent?.morningSlots ?? 30,
    afternoonSlots: editingEvent?.afternoonSlots ?? 30,
    recurrence: editingEvent?.recurrence || 'None',
    notes: editingEvent?.notes || '',
  };
}

export default EventModal;
