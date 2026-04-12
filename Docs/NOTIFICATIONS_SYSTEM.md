# Notification System — Broadcast & Acknowledgement

## Overview

The Notification System provides real-time notifications with delivery tracking and acknowledgement. It integrates with the existing Socket.IO architecture to deliver messages via:

1. **Socket.IO (Real-time)** — Instant delivery when user is online
2. **Email + Expo Push** — Fallback for offline users (queued for next login + push notification)
3. **Acknowledgement Tracking** — Receivers can acknowledge receipt, senders can track delivery status

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Notification System                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Admin/Staff              Services              Socket.IO     │
│  Routes                                                       │
│   │                          │                      │         │
│   ├→ notify-staffs ─→ notifyStaffs.js ─→ notifyUsers() ─→   │
│   │                                        (socket)          │
│   ├→ notify-patients ─→ notifyPatients.js ─→ notifyUsers() ─→│
│   │                                         (socket)         │
│   ├→ notify-acknowledge ─→ acknowledgementHandler ────→      │
│   │                        (sync to Redis)                    │
│   ├→ notify-status ─→ getNotificationStatus() ──────→ Redis  │
│   │                                                           │
│   └─ Tracking                                                │
│      │                                                        │
│      └→ notification-acknowledgement.js (Redis TTL store)    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Notification Flow

#### 1. Admin Sends to All Staff

```
Admin calls POST /notify-staffs
    │
    ├→ Fetch all Medical role users
    │
    ├→ Create unique notification ID (notif_admin_xxx)
    │
    ├→ Call notifyUsers() for each staff member
    │   ├→ User online? → emit socket immediately
    │   └→ User offline? → queue in Redis + Expo push
    │
    ├→ Track delivery method (socket vs email)
    │
    └→ Return detailed delivery report
```

#### 2. Staff Sends to Their Patients

```
Staff calls POST /notify-patients
    │
    ├→ Verify staff member exists & has Medical role
    │
    ├→ Get staff branch & location
    │
    ├→ Fetch all patients at same location
    │
    ├→ Filter by branch using ValidateUserBranchbyUserBranch()
    │
    ├→ Create unique notification ID (notif_staff_xxx)
    │
    ├→ Call notifyUsers() for each valid patient
    │   ├→ User online? → emit socket immediately
    │   └→ User offline? → queue in Redis + Expo push
    │
    ├→ Track delivery method (socket vs email)
    │
    └→ Return detailed delivery report
```

#### 3. Receiver Acknowledges

```
Receiver gets notification
    │
    ├→ Via Socket Event: emits notif:acknowledge {notificationId}
    │   (Real-time, faster)
    │
    OR
    │
    └→ Via HTTP: POST /notify-acknowledge {notificationId}
       (Standard REST API)
    │
    └→ Backend marks as acknowledged + timestamp in Redis
```

#### 4. Sender Tracks Status

```
Admin/Staff calls GET /notify-sent
    │
    └→ Returns all notifications they sent with:
       - Delivery method (socket vs email)
       - Acknowledgement status
       - Acknowledge time + duration
```

---

## API Reference

### Sending Notifications

#### `POST /notify-staffs`

**Admin-only endpoint** to broadcast message to all staff.

**Request:**
```json
{
  "message": "Important system maintenance tomorrow at 2 PM"
}
```

**Response (200):**
```json
{
  "success": true,
  "notificationId": "notif_admin_550e8400-e29b-41d4-a716-446655440000",
  "totalRecipients": 12,
  "delivery": {
    "delivered": [
      { "userId": "123", "deliveryMethod": "socket", "status": "delivered" },
      { "userId": "124", "deliveryMethod": "socket", "status": "delivered" }
    ],
    "queued": [
      { "userId": "125", "deliveryMethod": "email", "status": "queued" },
      { "userId": "126", "deliveryMethod": "email", "status": "queued" }
    ]
  }
}
```

**Delivery Methods:**
- `socket` — User was online, message delivered instantly via WebSocket
- `email` — User offline, message queued in Redis + Expo push sent to mobile app

---

#### `POST /notify-patients`

**Staff-only endpoint** to notify patients in their branch/location.

**Request:**
```json
{
  "message": "Reminder: Please complete your health assessment by Friday"
}
```

**Response (200):**
```json
{
  "success": true,
  "notificationId": "notif_staff_660e8400-e29b-41d4-a716-446655440001",
  "totalRecipients": 8,
  "delivery": {
    "delivered": [
      { "userId": "456", "deliveryMethod": "socket", "status": "delivered" }
    ],
    "queued": [
      { "userId": "457", "deliveryMethod": "email", "status": "queued" },
      { "userId": "458", "deliveryMethod": "email", "status": "queued" }
    ]
  }
}
```

**Scope:**
- Staff can only notify patients in their assigned location
- Branch validation uses `ValidateUserBranchbyUserBranch()`:
  - Manila staff → reach Manila patients
  - QuezonCity staff → reach QuezonCity patients
  - "Both" staff → reach all patients

---

### Acknowledgement

#### `POST /notify-acknowledge`

**Anyone** can acknowledge a notification they received.

**Request:**
```json
{
  "notificationId": "notif_admin_550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Notification acknowledged"
}
```

**Socket Alternative (Real-time):**
```javascript
// Client-side
socket.emit('notif:acknowledge', {
  notificationId: 'notif_admin_550e8400-e29b-41d4-a716-446655440000'
}, (response) => {
  console.log('Acknowledged:', response); // { success: true, acknowledged: true }
});
```

---

### Status Tracking

#### `GET /notify-status/:notificationId`

**Anyone** can check status of a specific notification.

**Response (200):**
```json
{
  "success": true,
  "status": {
    "notificationId": "notif_admin_550e8400-e29b-41d4-a716-446655440000",
    "userId": "456",
    "senderId": "123",
    "deliveredVia": "socket",
    "timestamp": 1711811030000,
    "acknowledged": true,
    "acknowledgedAt": 1711811052000,
    "deliveryDuration": "22 seconds"
  }
}
```

**Fields:**
- `deliveredVia` — How it reached the user: `"socket"`, `"email"`, or `"pending"`
- `acknowledged` — Whether receiver confirmed receipt
- `acknowledgedAt` — Timestamp of acknowledgement (ISO)
- `deliveryDuration` — Time from send to acknowledge (human-readable)

---

#### `GET /notify-sent`

**Medical staff only** — View all notifications you sent (transmission tracking).

**Response (200):**
```json
{
  "success": true,
  "count": 3,
  "notifications": [
    {
      "notificationId": "notif_staff_660e8400-e29b-41d4-a716-446655440001",
      "recipientId": "456",
      "deliveredVia": "socket",
      "timestamp": 1711811000000,
      "acknowledged": true,
      "acknowledgedAt": 1711811022000,
      "deliveryDuration": "22 seconds"
    },
    {
      "notificationId": "notif_staff_660e8400-e29b-41d4-a716-446655440002",
      "recipientId": "457",
      "deliveredVia": "email",
      "timestamp": 1711810950000,
      "acknowledged": false,
      "acknowledgedAt": null,
      "deliveryDuration": null
    }
  ]
}
```

---

#### `GET /notify-received`

**Anyone** — View all notifications you received.

**Response (200):**
```json
{
  "success": true,
  "count": 5,
  "notifications": [
    {
      "notificationId": "notif_admin_550e8400-e29b-41d4-a716-446655440000",
      "senderId": "123",
      "deliveredVia": "socket",
      "timestamp": 1711811030000,
      "acknowledged": true,
      "acknowledgedAt": 1711811052000
    },
    {
      "notificationId": "notif_staff_660e8400-e29b-41d4-a716-446655440001",
      "senderId": "124",
      "deliveredVia": "email",
      "timestamp": 1711810900000,
      "acknowledged": false,
      "acknowledgedAt": null
    }
  ]
}
```

---

## Socket Events

### Client → Server

#### `notif:acknowledge`

Acknowledge receipt of a notification in real-time.

```javascript
socket.emit('notif:acknowledge', {
  notificationId: 'notif_admin_xxx'
}, (response) => {
  if (response.success) {
    console.log('Notification acknowledged');
  } else {
    console.error(response.error);
  }
});
```

**Response:**
```json
{
  "success": true,
  "acknowledged": true,
  "notificationId": "notif_admin_xxx"
}
```

---

### Server → Client

#### `admin:notification`

Broadcast notification from admin to all staff.

```javascript
socket.on('admin:notification', (data) => {
  console.log('Admin says:', data.message);
  console.log('Notification ID:', data.id);

  // Acknowledge it
  socket.emit('notif:acknowledge', { notificationId: data.id });
});
```

**Payload:**
```json
{
  "id": "notif_admin_550e8400-e29b-41d4-a716-446655440000",
  "type": "admin_broadcast",
  "message": "Important system maintenance tomorrow at 2 PM",
  "timestamp": "2024-03-30T15:30:30.000Z",
  "from": "123"
}
```

#### `staff:notification`

Notification from staff to patients.

```javascript
socket.on('staff:notification', (data) => {
  console.log('Staff message:', data.message);
  console.log('From branch:', data.staffBranch);

  // Acknowledge it
  socket.emit('notif:acknowledge', { notificationId: data.id });
});
```

**Payload:**
```json
{
  "id": "notif_staff_660e8400-e29b-41d4-a716-446655440001",
  "type": "staff_broadcast",
  "message": "Please complete your health assessment",
  "timestamp": "2024-03-30T15:35:00.000Z",
  "from": "124",
  "staffBranch": "Manila",
  "staffLocation": "Arlegui"
}
```

---

## Data Storage (Redis)

### Notification Metadata Key

**Key:** `notif:ack:{notificationId}`
**TTL:** 7 days (configurable via `NOTIF_ACK_TTL` env var)

**Value:**
```json
{
  "notificationId": "notif_admin_550e8400-e29b-41d4-a716-446655440000",
  "userId": "456",
  "senderId": "123",
  "deliveredVia": "socket",
  "timestamp": 1711811030000,
  "acknowledged": true,
  "acknowledgedAt": 1711811052000
}
```

**Delivery Methods:**
- `socket` — Delivered via WebSocket to active user
- `email` — Queued in Redis + Expo push (user was offline)
- `pending` — Queued but not yet delivered

---

### Pending Notification Queue (Offline)

**Key:** `notif:pending:{userId}`
**TTL:** 7 days (configurable via `NOTIF_PENDING_TTL` env var)

This key stores notifications that arrived while the user was offline. When they reconnect, these are auto-delivered via the socket system.

---

## Environment Variables

Add these to `.env` to customize behavior:

```dotenv
# Acknowledgement storage TTL (seconds)
# Default: 604800 (7 days)
NOTIF_ACK_TTL=604800

# Pending notification queue TTL (seconds)
# Default: 604800 (7 days)
NOTIF_PENDING_TTL=604800

# Max pending notifications per offline user
# Default: 100
NOTIF_MAX_PENDING=100

# Socket acknowledgement timeout (milliseconds)
# Default: 5000 (5 seconds)
SOCKET_ACK_TIMEOUT_MS=5000
```

---

## Use Cases

### Use Case 1: Admin Emergency Alert

**Scenario:** System maintenance announced to all staff.

```bash
curl -X POST http://localhost:3001/staff/notify-staffs \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "System will be down for maintenance on 2024-04-01 from 2-4 AM. Please plan accordingly."
  }'
```

**Response:**
- 12 staff members online → 12 socket deliveries
- 3 staff members offline → 3 email queues + Expo pushes
- Admin can track who acknowledged it:

```bash
curl -X GET http://localhost:3001/staff/notify-sent \
  -H "Authorization: Bearer <admin_token>"
```

---

### Use Case 2: Staff Reminds Patients

**Scenario:** Medical staff reminds their patients to complete health assessment.

```bash
curl -X POST http://localhost:3001/staff/notify-patients \
  -H "Authorization: Bearer <staff_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Reminder: Your annual health assessment is due this week. Please schedule it at the clinic or book online."
  }'
```

**Response:**
- Only patients under staff's branch receive it
- 5 patients online → immediate socket delivery
- 2 patients offline → email queue + push
- Staff can view delivery status:

```bash
curl -X GET http://localhost:3001/staff/notify-sent \
  -H "Authorization: Bearer <staff_token>"
```

---

### Use Case 3: Patient Acknowledges

**Scenario:** Patient acknowledges they saw the reminder.

**Via HTTP:**
```bash
curl -X POST http://localhost:3001/staff/notify-acknowledge \
  -H "Authorization: Bearer <patient_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "notificationId": "notif_staff_660e8400-e29b-41d4-a716-446655440001"
  }'
```

**Via Socket (faster, real-time):**
```javascript
socket.emit('notif:acknowledge', {
  notificationId: 'notif_staff_660e8400-e29b-41d4-a716-446655440001'
});
```

---

## Error Handling

### Common Errors

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 400 | `VALIDATION_ERROR` | Missing `message` field | Ensure message is provided |
| 400 | `VALIDATION_ERROR` | Missing `notificationId` field | Ensure notificationId is provided |
| 403 | `FORBIDDEN` | User is not staff (Medical role) | Only Medical staff can send notifications |
| 404 | `NOT_FOUND` | Notification expired or not found | Notification TTL exceeded (7 days default) |
| 500 | `NOTIFICATION_FAILED` | Internal server error | Check logs, retry later |

---

## Security Considerations

### Access Control

- **notifyStaffs**: `Medical` role only
- **notifyPatients**: `Medical` role only (scoped to their branch)
- **notifyAcknowledge**: Any authenticated user
- **notifyStatus**: Any authenticated user (returns only public info)
- **notifySent**: `Medical` role only (privacy: can't see others' sent)
- **notifyReceived**: Any authenticated user (only their own)

### Privacy

- Patients cannot see who sent them notifications (for security)
- Staff acknowledged count is visible to sender only
- Usernames/emails are NOT included in responses

### Rate Limiting

No built-in rate limiting on notification endpoints. Consider adding:
- Max 100 notifications per admin per hour
- Max 50 notifications per staff per hour
- Implement via middleware if needed

---

## Testing

### Test Scenario 1: Notify All Staff

```bash
# 1. Login as admin
TOKEN=$(curl -X POST http://localhost:3001/auth/login \
  -d '{"email":"admin@tip.edu.ph", "password":"..."}' | jq -r '.token')

# 2. Send notification
RESULT=$(curl -X POST http://localhost:3001/staff/notify-staffs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Test notification"}')

NOTIF_ID=$(echo $RESULT | jq -r '.notificationId')

# 3. Check status
curl -X GET http://localhost:3001/staff/notify-status/$NOTIF_ID \
  -H "Authorization: Bearer $TOKEN"

# 4. View all sent
curl -X GET http://localhost:3001/staff/notify-sent \
  -H "Authorization: Bearer $TOKEN"
```

### Test Scenario 2: Acknowledge Notification

```bash
# 1. Receive notification (via socket or HTTP)
# Assume user gets notificationId: "notif_staff_xxx"

# 2. Acknowledge
curl -X POST http://localhost:3001/staff/notify-acknowledge \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notificationId":"notif_staff_xxx"}'

# 3. Check status (should show acknowledged=true)
curl -X GET http://localhost:3001/staff/notify-status/notif_staff_xxx \
  -H "Authorization: Bearer $PATIENT_TOKEN"
```

---

## Monitoring & Debugging

### Logging Prefixes

All notification logs use prefixes for easy filtering:
- `[NOTIF_ACK]` — Acknowledgement tracking
- `[NOTIFY_STAFFS]` — Admin broadcast
- `[NOTIFY_PATIENTS]` — Staff broadcast
- `[ACK-EVENTS]` — Socket acknowledgement events
- `[NOTIFY_STAFFS_ROUTE]` — Route handler
- `[NOTIFY_PATIENTS_ROUTE]` — Route handler

**View logs:**
```bash
# All notification activity
tail -f logs/app.log | grep NOTIF

# Acknowledgements only
tail -f logs/app.log | grep "NOTIF_ACK"

# Socket events
tail -f logs/app.log | grep "ACK-EVENTS"
```

---

## Future Enhancements

1. **Notification Categories** — Different types (urgent, info, reminder)
2. **Read Receipts** — Track when user opened/read message
3. **Scheduled Notifications** — Send at specific times
4. ~~**Notification Preferences** — User opt-in/opt-out per type~~ ✅ Implemented — see [NOTIFICATION_PREFERENCES_IMPLEMENTATION.md](./NOTIFICATION_PREFERENCES_IMPLEMENTATION.md)
5. **Batch Acknowledgement** — Mark multiple as read
6. **Notification History** — UI dashboard for notification history
7. **Analytics** — Track delivery/acknowledgement rates

---

## References

- **Socket System:** See [sockets.md](./sockets.md)
- **Email Service:** Email notifications use `enqueueNotificationEmail()` from `services/emailservice.js`
- **Expo Push:** See `config/sockets/push-notification.js`
- **Validator:** `ValidateUserBranchbyUserBranch()` in `utils/validator.js`
- **Notification Preferences:** See [NOTIFICATION_PREFERENCES_IMPLEMENTATION.md](./NOTIFICATION_PREFERENCES_IMPLEMENTATION.md)
