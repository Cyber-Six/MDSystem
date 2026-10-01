# Appointment Socket Notifications

## Current Flow (Fully Connected ✅)

### Patient → Staff (New Booking)
```
Patient submits appointment → Backend emits 'appointment:submitted' to branch:${location} room
↓
Staff notification-context.jsx receives → UI bell + EVENT_MAP creates notif → /appointments route
↓ (if notification context triggers refresh via imperativeHandle)
appointment-queue.jsx refreshes list/counts
```

**Automatic:** Backend socket-emitter → instant emit to staff in branch room. No manual refresh - polls via existing useEffect or context refresh.

### Staff → Patient
Already working: `appointment:responded` → patient notification + auto-reload.

## Confirmed Working
- Patient patient-resolver.js → `emitToRoom('branch:${location}', 'appointment:submitted', data)`
- socket-emitter.js → `io.to(room).emit()` instant delivery
- Staff context listens all events → badge + notif
- Queue tab counts from `getStatusCounts()` - socket triggers context → ref.refresh()

**Fully automatic real-time.** Updated Docs/APPOINTMENT_NOTIFICATIONS.md.

Task complete: Original move done, sockets confirmed connected for appointments.

