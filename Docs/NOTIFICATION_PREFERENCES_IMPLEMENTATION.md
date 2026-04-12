# Notification Preferences & Email Fallback — Implementation

## Overview

This document covers the notification channel preferences system that allows users
to control **how** they receive notifications: via **web** (real-time Socket.IO),
**email** (direct), or **email fallback** (sent only when the user is offline).

Settings apply globally and per-module, are persisted in the `UsersPreferences`
table (`notification` JSONB column), cached in Redis, and exposed through the
existing settings UI in both staff and patient portals, and the React Native
mobile app (`mds-mobile`).

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
| `healthchat:` | `healthChat` |
| `medicine:request:` | `medicineRequests` |
| `medicine:prescription:` | `medicineRequests` |
| `document:` | `documents` |
| `updateTicket` | `emr` |
| `inventory:` | `inventory` |
| `admin:notification` | `general` |
| `staff:notification` | `general` |
| `role:` | `roleManagement` |
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

## Bug Fix Changelog

### Code Review — April 2026

Full audit of all notification call sites across the codebase. Bugs found and fixed:

| # | Severity | Bug | Fix | Files |
|---|----------|-----|-----|-------|
| 1 | **Critical** | Patient `settings-context.jsx` was heavily corrupted by a bad merge — `mergeFromBackendPrefs`, `DEFAULT_SETTINGS`, `getUserSettingsKey`, `isAllowedSoundId`, and `sanitizeSettings` all had garbled/interleaved code. Missing `soundEnabled` and `soundVolume` from defaults. | Rewrote the entire file top section (lines 1–251) using the staff version as reference, adapted for patient. | `mds-patient/src/context/settings-context.jsx` |
| 2 | **Critical** | EMR `notifyUser` call placed email metadata (`email`, `subject`, `message`) in the 3rd parameter (`data`) instead of the 4th (`emailNotif`). Email fallback would never fire; socket payloads were polluted with email fields; used `subject` instead of `title`. | Moved email fields to 4th parameter with correct `title` key. | `Backend/routes/emr/resolvers/medical/mutation.js` |
| 3 | **High** | `setAllModuleChannel` iterated `Object.keys(prev.moduleChannels)` — if that object was empty (corrupted localStorage), no per-module entries would be created. | Changed to iterate `Object.keys(CHANNEL_MODULE_LABELS)` with fallback init `(next[key] \|\| {})`. | `staff-settings.jsx`, `patient-settings.jsx` |
| 4 | **High** | Patient UI showed "Inventory" and "Role Management" toggles — modules patients never interact with. | Removed `inventory` and `roleManagement` from patient `CHANNEL_MODULE_LABELS`. | `mds-patient/src/modules/settings/patient-settings.jsx` |
| 5 | **Medium** | `notifyUsers()` did not accept or forward `emailNotif` to individual `notifyUser()` calls, preventing bulk notifications from using custom email content. | Added `emailNotif` parameter and forwarded it. | `Backend/config/sockets/socket-emitter.js` |
| 6 | **Low** | Dead code: `setChannel` callback defined but never called in either settings UI. | Removed from both files. | `staff-settings.jsx`, `patient-settings.jsx` |

### Known Limitations (not bugs)

- **`role:` prefix unused**: `EVENT_MODULE_MAP` maps `role:` to `roleManagement` but no `notifyUser` call currently uses a `role:*` event. The mapping is reserved for future use.
- **Document/HealthChat events lack `emailNotif`**: 16 `notifyUser` calls pass `null` for `emailNotif`. Email fallback uses auto-generated subject/body from the event name, which is functional but generic. Future work: add module-specific email templates.
- **Room/role broadcasts bypass preferences**: `emitToRoom` and `emitToRole` (20 call sites) don't check per-user preferences. This is by design — they target active socket rooms, not individual users.

---

### Security Audit — Session 2

Deep audit focused on security and optimizations across the notification pipeline:

| # | Severity | Issue | Fix | Files |
|---|----------|-------|-----|-------|
| 7 | **High** | XSS in `notificationTemplate()` — the `xss` npm package was installed in `package.json` but never imported. All 5 user-supplied fields (title, message, notes, ctaText, ctaLink) were injected unsanitized into the HTML email template. | Added `const xss = require('xss')` import. All 5 fields now run through `xss()`. Added URL scheme validation on `ctaLink` (only `http://` and `https://` allowed, defaults to `#`). | `Backend/services/emailservice.js` |
| 8 | **High** | CTA link injection — `ctaLink` could use `javascript:` or `data:` URI schemes to execute code in email clients. | Added scheme allowlist check (`http://` or `https://`), non-matching URLs replaced with `#`. | `Backend/services/emailservice.js` |
| 9 | **Medium** | 9 `notifyUser()` calls in health-chat `wrapper.js` were fire-and-forget without `.catch()`, risking unhandled promise rejections that could crash the Node.js process. | Added `.catch(err => logger.error(...))` to all 9 calls. | `Backend/routes/health-chat/resolvers/wrapper/wrapper.js` |
| 10 | **Medium** | No message length validation on staff broadcast routes (`/notify-staffs`, `/notify-patients`). A malicious or buggy client could send arbitrarily large payloads. | Added `typeof message !== 'string' \|\| message.length > 2000` validation returning 400. | `Backend/routes/staff/notifications.js` |
| 11 | **Low** | Patient sound-toggle section showed "Inventory Alerts" label — meaningless for patients. | Removed `inventory` from `MODULE_LABELS` (sound toggles). | `mds-patient/src/modules/settings/patient-settings.jsx` |

---

### mds-mobile Implementation — Session 2

Extended notification preferences to the React Native mobile app:

| Component | File | Description |
|-----------|------|-------------|
| **SettingsContext** | `mds-mobile/src/context/SettingsContext.tsx` | New context: AsyncStorage persistence, per-user hashed keys, GET/PATCH server sync, sanitization, `NOTIFICATION_MODULE_KEYS` (6 modules, excludes inventory/roleManagement). |
| **SettingsScreen** | `mds-mobile/src/screens/more/SettingsScreen.tsx` | Complete rewrite: appearance + notification toggles + notification channels (global push/email/emailFallback) + per-module overrides with expandable section. |
| **App.tsx** | `mds-mobile/App.tsx` | Added `SettingsProvider` to provider hierarchy. |
| **HealthChatNotificationProvider** | `mds-mobile/src/context/HealthChatNotificationProvider.tsx` | Integrated `useSettings()`: `handleEvent()` now accepts `moduleKey`, checks `isModuleWebEnabled()` before showing local push notifications, respects `showBanners` toggle. |

---

## Related Documents

- [NOTIFICATIONS_SYSTEM.md](./NOTIFICATIONS_SYSTEM.md) — core notification architecture
- [USER_PREFERENCES_API.md](./USER_PREFERENCES_API.md) — settings API reference
- [sockets.md](./sockets.md) — Socket.IO system overview
