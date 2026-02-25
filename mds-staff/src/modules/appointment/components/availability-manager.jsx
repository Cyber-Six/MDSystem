import React, { useState } from 'react';
import AvailabilityCalendar from './availability-calendar';
import DaySlotEditor from './day-slot-editor';
import EventModal from './event-modal';

/**
 * Availability Manager Component
 * Calendar + Day Detail Panel side by side
 * Manages slot capacities, event overrides, and scheduling rules
 * SRS §3.4.2
 */
const AvailabilityManager = () => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventModalDate, setEventModalDate] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [dayOverrides, setDayOverrides] = useState({}); // { [date]: { medical, dental, status, notes } }

  // Default slot configuration — SRS §3.4.2
  const [slotDefaults] = useState({
    medical: { morning: 60, afternoon: 60 },
    dental: { morning: 1, afternoon: 1 },
  });

  // TODO: Load events from API (ScheduleDateEntity / slotScheduler override records)
  const [events, setEvents] = useState([]);

  const handleSaveDay = (dayData) => {
    console.log('Save day config:', dayData);
    // Store override locally so view mode reflects saved values
    setDayOverrides((prev) => ({ ...prev, [dayData.date]: dayData }));
    // TODO: API call to save day override
  };

  const handleCreateEvent = (date) => {
    setEventModalDate(date);
    setEditingEvent(null);
    setShowEventModal(true);
  };

  const handleSaveEvent = (eventData) => {
    setEvents((prev) => {
      const existing = prev.findIndex((e) => e.id === eventData.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = eventData;
        return updated;
      }
      return [...prev, eventData];
    });
  };

  const handleDeleteEvent = (eventId) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  return (
    <div className="space-y-3">
      {/* Default Slots Summary */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Default Slot Configuration</h3>
          <span className="text-[10px] text-secondary-400 dark:text-neutral-500 uppercase tracking-wider"></span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-accent-50 dark:bg-accent-900/20 rounded-md p-2 text-center">
            <p className="text-lg font-bold text-accent-700 dark:text-accent-400">{slotDefaults.medical.morning}</p>
            <p className="text-[10px] text-accent-600 dark:text-accent-400">Medical AM</p>
          </div>
          <div className="bg-accent-50 dark:bg-accent-900/20 rounded-md p-2 text-center">
            <p className="text-lg font-bold text-accent-700 dark:text-accent-400">{slotDefaults.medical.afternoon}</p>
            <p className="text-[10px] text-accent-600 dark:text-accent-400">Medical PM</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-md p-2 text-center">
            <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{slotDefaults.dental.morning}</p>
            <p className="text-[10px] text-purple-600 dark:text-purple-400">Dental AM</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-md p-2 text-center">
            <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{slotDefaults.dental.afternoon}</p>
            <p className="text-[10px] text-purple-600 dark:text-purple-400">Dental PM</p>
          </div>
        </div>
      </div>

      {/* Calendar + Day Editor */}
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <AvailabilityCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            events={events}
            slotDefaults={slotDefaults}
          />
        </div>
        <div>
          <DaySlotEditor
            selectedDate={selectedDate}
            slotDefaults={slotDefaults}
            dayOverride={selectedDate ? dayOverrides[selectedDate] : null}
            onSave={handleSaveDay}
            onCreateEvent={handleCreateEvent}
            events={events}
          />
        </div>
      </div>

      {/* Active Events List */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Active Events</h3>
          <button
            onClick={() => handleCreateEvent(null)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-md transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Event
          </button>
        </div>
        <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {events.length > 0 ? (
            events.map((event) => (
              <div key={event.id} className="px-3 py-2 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    event.effect === 'Suspend' ? 'bg-error-500' : event.effect === 'Reduce' ? 'bg-warning-500' : 'bg-success-500'
                  }`} />
                  <span className="text-sm font-medium text-secondary-800 dark:text-white truncate">{event.name}</span>
                  <span className="text-xs text-secondary-400 dark:text-neutral-500">·</span>
                  <span className="text-xs text-secondary-500 dark:text-neutral-400 whitespace-nowrap">
                    {event.startDate === event.endDate ? event.startDate : `${event.startDate} → ${event.endDate}`}
                    {' · '}{event.affects} · {event.effect}
                    {event.recurrence !== 'None' && ` · ${event.recurrence}`}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setEditingEvent(event); setShowEventModal(true); }}
                    className="p-1.5 text-secondary-400 hover:text-secondary-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    className="p-1.5 text-error-400 hover:text-error-600 dark:text-error-500 dark:hover:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-secondary-500 dark:text-neutral-400">No active events</p>
              <p className="text-xs text-secondary-400 dark:text-neutral-500 mt-1">Create events to override default schedules</p>
            </div>
          )}
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={showEventModal}
        onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
        onSave={handleSaveEvent}
        initialDate={eventModalDate}
        editingEvent={editingEvent}
      />
    </div>
  );
};

export default AvailabilityManager;
