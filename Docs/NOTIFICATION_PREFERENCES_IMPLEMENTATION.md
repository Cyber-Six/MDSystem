# Notification Preferences & Email Fallback — Implementation

## Overview

This document covers the notification channel preferences system that allows users
to control **how** they receive notifications: via **web** (real-time Socket.IO),
**email** (direct), or **email fallback** (sent only when the user is offline).

Settings apply globally and per-module, are persisted in the `UsersPreferences`
table (`notification` JSONB column), cached in Redis, and exposed through the
existing settings UI in both staff and patient portals.

---

## Architecture

```
User toggles preference (frontend)
        │
        ▼
PATCH /settings  ──►  PostgreSQL (UsersPreferences.notification)
        │                       │
        ├── invalidatePreferencesCache(userId)
        └── invalidateNotifPrefCache(userId)   ← Redis eviction
                                                    │
                                                    ▼
                            notifyUser(io, userId, event, data, emailNotif)
                                    │
                                    ▼
                        resolveChannelsForEvent(userId, event)
                                    │
                           ┌────────┼────────┐
                           ▼        ▼        ▼
                         web?    email?   emailFallback?
                           │        │        │
                  ┌────────┘        │        └────────┐
                  ▼                 ▼                  ▼
            socket/push      always email       email if offline
```

---

## Defaults

| Channel         | Default | Description |
|-----------------|---------|-------------|
| **Web**         | ✅ On   | Real-time socket delivery when online; push + Redis queue when offline |
| **Email**       | ❌ Off  | Always send an email copy regardless of online status |
| **Email Fallback** | ✅ On | Send email only when the user is not connected to any socket |

All modules inherit global defaults unless overridden individually.

---

## Database Schema

Stored inside `UsersPreferences.notification` (JSONB):

```json
{
  "channels": {
    "web": true,
    "email": false,
    "emailFallback": true
  },
  "moduleChannels": {
    "appointments": { "web": true, "email": false, "emailFallback": true },
    "healthChat":   { "web": true, "email": false, "emailFallback": true },
    "medicineRequests": { "web": true, "email": false, "emailFallback": true },
    "documents":    { "web": true, "email": false, "emailFallback": true },
    "emr":          { "web": true, "email": false, "emailFallback": true },
    "inventory":    { "web": true, "email": false, "emailFallback": true },
    "roleManagement": { "web": true, "email": false, "emailFallback": true },
    "general":      { "web": true, "email": false, "emailFallback": true }
  }
}
```

---

## Backend Files

### `Backend/config/sockets/notification-preferences.js` (new)

Centralised helper for the dispatch layer.

| Export | Purpose |
|--------|---------|
| `MODULE_KEYS` | Canonical list: `appointments`, `healthChat`, `medicineRequests`, `documents`, `emr`, `inventory`, `roleManagement`, `general` |
| `resolveModuleFromEvent(eventName)` | Maps Socket.IO event prefixes to module keys (e.g. `appointment:created` → `appointments`) |
| `getNotificationPreferences(userId)` | Fetches prefs from Redis (5 min TTL) → DB → defaults |
| `resolveChannelsForEvent(userId, eventName)` | Returns `{ web, email, emailFallback }` booleans with module-specific overrides |
| `invalidateNotifPrefCache(userId)` | Evicts Redis cache; called from settings routes |

### `Backend/config/sockets/socket-emitter.js` (modified)

`notifyUser()` rewritten with preference-aware delivery:

```
1. resolveChannelsForEvent(userId, event) → { web, email, emailFallback }
2. if web → online? socket : pushPending + Expo push
3. if email → always enqueueNotificationEmail()
4. if emailFallback && offline → enqueueNotificationEmail()
5. returns 'delivered' | 'queued' | 'suppressed'
```

When `emailNotif` is `null` or `emailNotif.email` is absent, the function
auto-resolves the user's email via `query.findEmailByUserId()` and generates
a subject/body from the event name.

`notifyUsers()` updated to track `suppressed` user IDs in the return object.

### `Backend/routes/settings/settings.js` (modified)

Added `invalidateNotifPrefCache(userId)` call alongside the existing
`invalidatePreferencesCache(userId)` in `PUT`, `PATCH`, and `DELETE` handlers
so preference changes take effect immediately.

### Module updates

- `Backend/routes/medical-inventory/medicine-request/resolvers/medical/medical-resolver.js` — replaced manual `emitToUserWithAck` + email fallback with a single `notifyUser()` call
- `Backend/routes/medical-inventory/prescription/resolvers/wrapper/wrapper.js` — same pattern

All other modules already calling `notifyUser()` benefit automatically.

---

## Frontend Files

### Settings Context (`settings-context.jsx` — staff & patient)

New constants and fields:

```js
const NOTIFICATION_MODULE_KEYS = [
  'appointments','healthChat','medicineRequests',
  'documents','emr','inventory','roleManagement','general'
];

// Added to DEFAULT_SETTINGS
channels: { web: true, email: false, emailFallback: true },
moduleChannels: {
  /* one entry per MODULE_KEY, same shape as channels */
}
```

`sanitizeSettings()` validates all booleans and fills missing keys from
defaults. `toBackendPrefs()` / `mergeFromBackendPrefs()` handle
round-tripping to the API.

### Settings UI (`staff-settings.jsx` & `patient-settings.jsx`)

New **Notification Channels** section containing:

1. **Global toggles** — Web, Email, Email Fallback (with descriptions)
2. **Warning banner** — shown when all three global channels are off
3. **Per-module table** — rows for each module, columns for Web / Email / Email Fallback checkboxes

### Notification Dropdown (`StaffTopBar.jsx` & `top-bar.jsx`)

When `settings.channels.web` is `false`, a warning banner appears inside the
notification dropdown:

> _Web notifications are disabled. [Enable in Settings](#)_

Clicking the link navigates to `/settings`.

---

## Redis Caching

| Key pattern | TTL | Eviction |
|-------------|-----|----------|
| `notifPref:{userId}` | 5 min | `invalidateNotifPrefCache(userId)` via settings routes |
| `prefs:{userId}` (existing) | 1 hr | `invalidatePreferencesCache(userId)` |

---

## Event → Module Mapping

| Event prefix | Module key |
|--------------|------------|
| `appointment:` | `appointments` |
| `healthchat:` / `chat:` | `healthChat` |
| `medicine:` | `medicineRequests` |
| `document:` | `documents` |
| `emr:` | `emr` |
| `inventory:` | `inventory` |
| `role:` / `admin:` | `roleManagement` |
| *(unmatched)* | `general` |

---

## Testing Checklist

- [ ] Toggle Web off → socket events no longer delivered; dropdown shows banner
- [ ] Toggle Email on → email sent for every notification regardless of online status
- [ ] Toggle Email Fallback off → no email when user is offline
- [ ] Per-module override: disable web for `appointments` only → appointment events suppressed, others delivered
- [ ] Change preference → verify Redis cache invalidated (next call returns fresh data)
- [ ] Frontend settings round-trip: toggle → save → reload page → toggles preserved
- [ ] `notifyUser()` returns `'suppressed'` when all channels are off
- [ ] Auto-email resolution works when `emailNotif` is not provided

---

## Related Documents

- [NOTIFICATIONS_SYSTEM.md](./NOTIFICATIONS_SYSTEM.md) — core notification architecture
- [USER_PREFERENCES_API.md](./USER_PREFERENCES_API.md) — settings API reference
- [sockets.md](./sockets.md) — Socket.IO system overview
