# Notifications

MDSystem delivers real-time events through Socket.IO and can queue offline notifications in Redis. Email fallback and push delivery are used where configured and supported by the event. Notification preferences are stored in `UsersPreferences.notification` and cached in Redis.

## Delivery and preferences

- Web delivery is enabled by default. Online users receive the Socket.IO event; offline events can be queued for delivery after reconnecting. Expo push is attempted when an offline recipient has a registered push token and the event has push content.
- Direct email is disabled by default. Email fallback is enabled by default and queues an email when the recipient is offline. Email must be configured for queued mail to be delivered.
- Global channel preferences can be overridden by module. Current module keys are `appointments`, `healthChat`, `medicineRequests`, `documents`, `emr`, `inventory`, `roleManagement`, and `general`.
- Preference updates go through `GET`, `PUT`, or `PATCH /settings`; the server invalidates the notification-preference cache after updates.

The effective defaults and event-to-module mapping are implemented in `Backend/config/sockets/notification-preferences.js`. Delivery decisions are implemented in `Backend/config/sockets/socket-emitter.js`.

## Staff notification endpoints

The staff router mounts these paths under `/staff`:

| Method and path | Purpose |
| --- | --- |
| `POST /staff/notify-staffs` | Admin broadcast to staff or selected recipients. |
| `POST /staff/notify-patients` | Staff notification to patients within the branch scope of the patient notification permission. |
| `GET /staff/notify-patient-groups` | List available campuses and eligible recipient counts for student and employee groups. |
| `POST /staff/notify-patient-groups` | Send to an authorized campus and patient group after reviewing its recipient count. |
| `POST /staff/notify-acknowledge` | Acknowledge a notification. |
| `GET /staff/notify-status/:notificationId` | Read delivery and acknowledgement status. |
| `GET /staff/notify-sent` | List notifications sent by the caller. |
| `GET /staff/notify-received` | List notifications received by the caller. |

These routes enforce authentication and role or permission checks. Socket acknowledgements are also available for supported client event handlers.

Patient group notifications use the branch set on **Send Notification to Patients** in Role Management. Admins have both-campus access. Group recipients must have an active account, a matching Student or Employee patient profile, and a campus within the chosen scope. Patients assigned to both campuses are included in either campus group and counted once for a both-campus send.

A group send accepts `message`, `profile`, `branch`, and the reviewed `expectedCount`. The server checks the sender's current permission and rebuilds the recipient list before sending. If the count changes, it returns HTTP 409 so the sender can review a new count. Group results include aggregate delivery outcomes.

## Socket events

Clients authenticate to Socket.IO and may join their own user room and authorized branch rooms. Event handlers and event-to-module mappings are in `Backend/config/sockets/`. Appointment, health chat, medicine request, document, EMR, inventory, role, and general notification events use module-specific preference keys where mapped; unmapped events use `general`.

Appointment-specific event behavior is described in [Appointments](appointment.md). Connection and Redis adapter configuration is described in [Socket.IO](sockets.md).

## Code locations

- Preference storage and resolution: `Backend/config/sockets/notification-preferences.js`.
- Online/offline, email, and push delivery: `Backend/config/sockets/socket-emitter.js`.
- Offline queue and push token storage: `Backend/config/sockets/notification-store.js`.
- Send/status routes: `Backend/routes/staff/notifications.js`.
- Notification services: `Backend/services/notifications/`.
- Email queue and worker: `Backend/services/email/`.
