# Socket.IO — Centralized Redis Architecture

## Overview

The socket layer uses **Socket.IO v4** backed by a **centralized Redis adapter** (`@socket.io/redis-adapter`). This means every emit — regardless of which server process originally fires it — is fanned out to all connected clients across every node in the cluster.

A secondary **Redis presence store** (`socket:user:{userId}` sets) tracks which users are connected at the cluster level, enabling reliable online-status checks from background workers and processes that don't hold any WebSocket connections themselves.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        Clients                           │
│          (browser / mobile / patient / staff)            │
└───────────┬──────────────────────┬───────────────────────┘
            │ WebSocket            │ WebSocket
┌───────────▼──────────┐  ┌────────▼──────────────────────┐
│   Node Process A     │  │   Node Process B               │
│  (server.js  :3000)  │  │  (staff.js   :3001)            │
│                      │  │                                │
│  Socket.IO           │  │  Socket.IO                     │
│  + Redis Adapter     │  │  + Redis Adapter               │
└───────────┬──────────┘  └────────┬───────────────────────┘
            │  pub/sub              │  pub/sub
            └──────────┬───────────┘
                       │
            ┌──────────▼──────────┐
            │      Redis          │
            │                     │
            │  Pub/Sub channels   │  ← adapter fan-out
            │  socket:user:{id}   │  ← presence sets
            │  socket.io-*        │  ← adapter internals
            └─────────────────────┘
```

When process A calls `emitToUser(userId, event, data)`, the Redis adapter publishes the message. Process B's subscriber receives it and forwards it to the correct local socket — transparently.

---

## Prerequisites

| Requirement                   | Notes                                                           |
| ----------------------------- | --------------------------------------------------------------- |
| Redis ≥ 6.0                  | Required for ACL user support                                   |
| `@socket.io/redis-adapter`  | Installed via `npm install @socket.io/redis-adapter`          |
| Redis ACL user (`mdsadmin`) | Must have `+subscribe +psubscribe +publish` + key permissions |

---

## Environment Variables

All socket and notification settings read from `.env`. Defaults are shown.

```dotenv
# Redis connection (shared with all other Redis uses)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_USERNAME=mdsadmin
REDIS_PASSWORD=your_redis_password

# Server ports
PATIENT_PORT=3000
MEDICAL_PORT=3001

# Socket.IO CORS — comma-separated. Use '*' in dev only.
SOCKET_CORS_ORIGIN=*
SOCKET_CORS_METHODS=GET,POST

# How long (seconds) a socket:user:{id} presence key survives after disconnect.
# Guards against stale keys from unclean server shutdowns.
SOCKET_SESSION_TTL=3600

# Max pending notifications kept per offline user (oldest trimmed when exceeded)
NOTIF_MAX_PENDING=100

# How long (seconds) the pending queue key lives if the user never reconnects.
# After this Redis auto-expires the key. Default: 7 days.
NOTIF_PENDING_TTL=604800
```

---

## Initialization

`initSocket()` is **async** and requires Redis to be ready first. Both `server.js` and `staff.js` use an `async start()` function that sequences the two:

```js
async function start() {
  await redis.initRedis();

  const server = app.listen(PORT, HOST, () => {
    logger.info(`Server running on ${HOST}:${PORT}`);
  });

  await initSocket(server);  // attaches Redis adapter — must come after initRedis
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
```

> `initRedis()` must complete before `initSocket()` is called. `initSocket()` calls `getClient().duplicate()` internally — if the Redis client is not yet initialized it will throw.
>
> Both `server.js` (patient, `PATIENT_PORT=3000`) and `staff.js` (medical, `MEDICAL_PORT=3001`) follow this pattern.

---

## Emitting Events (Server → Client)

All emitters are imported from the sockets module. They call `io.to(...).emit(...)` which the Redis adapter transparently broadcasts across nodes.

```js
const {
  emitToUser,
  emitToUsers,
  emitToRoom,
  emitToRole,
  emitToAll,
} = require('../config/sockets');
```

### Emit to a specific user (all their devices)

```js
emitToUser(userId, 'appointment:updated', { appointmentId, status: 'approved' });
```

Reaches the user on **every connected device**, even if that socket is on a different process.

### Emit to multiple users

```js
emitToUsers([doctorId, patientId], 'call:started', { roomId });
```

### Emit to a custom room

```js
// Join a room first (in a client-to-server handler):
socket.join(`appointment:${appointmentId}`);

// Then emit from anywhere:
emitToRoom(`appointment:${appointmentId}`, 'note:added', { noteId });
```

### Emit to all users of a role

```js
emitToRole('medical', 'system:maintenance', { message: 'Scheduled downtime in 10 min' });
```

### Broadcast to everyone

```js
emitToAll('system:announcement', { message: 'Server update complete' });
```

---

## Receiving Events (Client → Server)

Register handlers **before** `initSocket()` is called. Handlers are bound to every new socket on connect.

```js
const { registerHandlers } = require('../config/sockets');

registerHandlers({
  'appointment:join-room': (socket, { appointmentId }) => {
    socket.join(`appointment:${appointmentId}`);
    socket.emit('appointment:joined', { appointmentId });
  },

  'chat:message': async (socket, { roomId, text }, ack) => {
    await saveToDB(roomId, text, socket.userId);
    emitToRoom(roomId, 'chat:message', { from: socket.userId, text });
    if (typeof ack === 'function') ack({ ok: true });
  },
});
```

Handler signature: `(socket, data, ackCallback?) => void`

| Property             | Value                                           |
| -------------------- | ----------------------------------------------- |
| `socket.userId`    | Verified user ID (string)                       |
| `socket.userRole`  | `'patient'` or `'medical'`                  |
| `socket.sessionId` | Staff session anchor (or `null` for patients) |

---

## Presence Checks

Two functions are available depending on context:

### `isConnected(userId)` — synchronous, local process only

```js
const { isConnected } = require('../config/sockets');

if (isConnected(userId)) {
  // fast in-memory check — only accurate for THIS process
}
```

Use this in **route handlers on the same process** where responsiveness matters more than cross-node accuracy (e.g., deciding whether to send a push notification vs. a socket event when you know the user is on this server).

### `isConnectedAnywhere(userId)` — async, cluster-wide

```js
const { isConnectedAnywhere } = require('../config/sockets');

if (await isConnectedAnywhere(userId)) {
  // user has at least one active socket on ANY server node
}
```

Use this in:

- **Background workers / job queues** (BullMQ jobs) that run outside the HTTP/socket process
- **Scheduled tasks** that decide whether to skip a notification
- **Cross-process logic** where the user's socket may be on a different node

Falls back to `isConnected()` (local) if Redis is unavailable.

---

## Notification System

### The Problem

`emitToUser` and `emitToUsers` are **fire-and-forget**: if the user is offline when you call them, the event is silently dropped.

### The Solution: `notifyUser`

`notifyUser` combines a presence check with a Redis-backed queue:

- **User is online** → socket event delivered immediately
- **User is offline** → notification is persisted in Redis
- **User connects / reconnects** → all queued notifications are flushed automatically on their next socket connection

```js
const { notifyUser, notifyUsers } = require('../config/sockets');
```

### Notify a single user

```js
const result = await notifyUser(userId, 'appointment:updated', {
  appointmentId: '123',
  status: 'approved',
});
// result === 'delivered'  (user was online)
// result === 'queued'     (user was offline, stored in Redis)
```

### Notify multiple users

```js
const { delivered, queued } = await notifyUsers(
  [doctorId, patientId],
  'call:started',
  { roomId }
);
// delivered: ['user-id-A']   — got it right away
// queued:    ['user-id-B']   — will get it on next login
```

### How flush-on-connect works

When a user opens the app and their socket connects:

1. `socket-server.js` calls `flushPending(userId)` immediately after joining rooms
2. All queued notifications are retrieved and deleted from Redis atomically
3. Each one is emitted to the socket in order

The client receives them as regular events — no special handling is needed on the front end.

### Queue limits and TTL

| Setting                            | Env var               | Default             |
| ---------------------------------- | --------------------- | ------------------- |
| Max pending notifications per user | `NOTIF_MAX_PENDING` | `100`             |
| Expiry of pending queue (seconds)  | `NOTIF_PENDING_TTL` | `604800` (7 days) |

Notifications older than TTL are automatically expired by Redis. If the queue exceeds the cap, the oldest notifications are trimmed (most recent ones are kept).

### Check pending count (badge API)

```js
const { getPendingCount } = require('../config/sockets');
const count = await getPendingCount(userId); // number of undelivered notifications
```

Use this to power a badge counter endpoint for the mobile app.

### When to use what

| Function       | Online user | Offline user      | Use case                                     |
| -------------- | ----------- | ----------------- | -------------------------------------------- |
| `emitToUser` | Delivered   | **Dropped** | Real-time only (e.g., live typing indicator) |
| `notifyUser` | Delivered   | **Queued**  | Any notification that must not be lost       |

### Redis key

Pending notifications are stored as a Redis List:

```
notif:pending:{userId}   →  List of JSON strings [{ id, event, data, ts }, ...]
```

The list is deleted in full when the user connects.

---

## Auto-Joined Rooms

Every socket is automatically joined to two rooms on connect:

| Room              | Members                            |
| ----------------- | ---------------------------------- |
| `user:{userId}` | All sockets belonging to that user |
| `role:patient`  | All patient sockets                |
| `role:medical`  | All medical/staff sockets          |

You do not need to manage these manually.

---

## Redis Key Namespaces

| Key pattern                | Type        | Purpose                                   |
| -------------------------- | ----------- | ----------------------------------------- |
| `socket:user:{userId}`   | Set         | Socket IDs for presence tracking          |
| `notif:pending:{userId}` | List        | Queued notifications for offline users    |
| `socket.io#*`            | String/List | Adapter pub/sub internals (do not modify) |

Socket presence keys expire after `SOCKET_SESSION_TTL` seconds (default 3600). Stale entries are cleaned up on disconnect.

---

## Multi-Instance Deployment

### PM2 Cluster Mode

```js
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'patient-server',
      script: 'server.js',
      instances: 4,          // or 'max'
      exec_mode: 'cluster',
      env: { PATIENT_PORT: 3000 }
    },
    {
      name: 'staff-server',
      script: 'staff.js',
      instances: 2,
      exec_mode: 'cluster',
      env: { MEDICAL_PORT: 3001 }
    }
  ]
};
```

All 6 processes share one Redis, so a doctor on staff-server process 1 receives events emitted by a trigger on patient-server process 3.

### Docker Compose (example)

```yaml
services:
  patient-server:
    build: ./Backend
    command: node server.js
    env_file: .env
    environment:
      - PATIENT_PORT=3000
    scale: 3
    depends_on: [redis]

  staff-server:
    build: ./Backend
    command: node staff.js
    env_file: .env
    environment:
      - MEDICAL_PORT=3001
    scale: 2
    depends_on: [redis]

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
```

> With multiple instances behind a load balancer, ensure the load balancer supports **sticky sessions** (or use the `polling` transport only until the WebSocket upgrade completes). Socket.IO handles reconnection automatically.

---

## How the Redis Adapter Works Internally

1. On `initSocket()`, two extra Redis client connections are created by duplicating the main client (`pubClient`, `subClient`).
2. The adapter subscribes `subClient` to a set of Redis Pub/Sub channels.
3. When any process calls `io.to(room).emit(event, data)`, the adapter serializes the payload and publishes it to the channel.
4. All other processes' `subClient` connections receive the publish, look up local sockets in the target room, and deliver the event.
5. Clients connected to a process that has no local sockets in the room simply ignore the message — zero extra overhead.

---

## Troubleshooting

| Symptom                                       | Likely cause                                                  | Fix                                                                 |
| --------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Failed to attach Redis adapter` on startup | Redis not ready when `initSocket()` is called               | Ensure `initRedis()` completes before `initSocket()`            |
| Events not reaching clients on other nodes    | Adapter not attached (old synchronous call)                   | Change `initSocket(server)` → `await initSocket(server)`       |
| `Redis client not initialized` error        | `getClient()` called before `initRedis()`                 | Call `initRedis()` first in startup sequence                      |
| Presence shows user online after disconnect   | `SOCKET_SESSION_TTL` too high, or disconnect handler failed | Check SOCKET_SESSION_TTL; review `untrackConnection` logs         |
| ACL permission denied on pub/sub | Redis ACL user missing channel or command permissions | Run: `ACL SETUSER mdsadmin on ~* +subscribe +psubscribe +publish &*` then `CONFIG REWRITE` — see below |
| Offline notifications never delivered         | `notifyUser` not used (using `emitToUser` instead)        | Switch to `notifyUser` for any notification that must not be lost |
| Queued notifications stale / not expiring     | `NOTIF_PENDING_TTL` too high                                | Lower `NOTIF_PENDING_TTL`; defaults to 7 days                     |
| Too many queued notifications accumulating    | User is inactive for extended periods                         | Lower `NOTIF_MAX_PENDING`; oldest are trimmed automatically       |

### Fixing the Redis ACL channel permission error

**Symptom:** Server crashes on startup with:
```
SimpleError: NOPERM this user has no permissions to access one of the channels used as arguments
```

**Cause:** The `@socket.io/redis-adapter` uses Redis Pub/Sub to fan out events across nodes. By default, Redis ACL users have no channel permissions — you must explicitly grant them.

**Diagnosis:** Check what channels the user currently has:
```bash
redis-cli -u "redis://<user>:<password>@127.0.0.1:6379" ACL GETUSER mdsadmin
# channels field will be empty if not granted
```

**Fix:** Grant the required pub/sub commands and all channels, then persist the change:
```bash
# Grant key access, pub/sub commands, and all channels.
# Replace YOUR_REDIS_PASSWORD with your actual password.
redis-cli -u "redis://<user>:<password>@127.0.0.1:6379" ACL SETUSER mdsadmin on \>YOUR_REDIS_PASSWORD ~* +subscribe +psubscribe +publish &*

# Persist to redis.conf so it survives restarts
redis-cli -u "redis://<user>:<password>@127.0.0.1:6379" CONFIG REWRITE
```

**Verify:**
```bash
redis-cli -u "redis://<user>:<password>@127.0.0.1:6379" ACL GETUSER mdsadmin
# channels field should show: &*
# commands field should include subscribe, psubscribe, publish
```

> If your Redis was started without a config file, `CONFIG REWRITE` will fail. In that case, add the user directive directly in `redis.conf` or your ACL file:
> ```
> user mdsadmin on #<hashed-password> ~* +@all &socket.io*
> ```
