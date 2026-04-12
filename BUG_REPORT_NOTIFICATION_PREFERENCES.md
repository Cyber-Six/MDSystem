# Bug Report & Analysis: Notification Preferences & Email Fallback

**Generated**: April 12, 2026  
**Reviewed By**: Code Review Agent  
**Status**: Ready for Fixes

---

## Executive Summary

The notification preferences and email fallback implementation is **mostly complete** but has **3 Critical issues** and **5 High-severity issues** that need immediate fixing. The implementation is well-structured overall, but there are gaps in consistency, API integration, and error handling.

**Severity Breakdown:**
- Critical: 3
- High: 5
- Medium: 3
- Low: 2

---

## Critical Issues (Must Fix)

### 🔴 CRITICAL #1: Missing Channel Preferences in toBackendPrefs (Patient)

**File**: [mds-patient/src/context/settings-context.jsx](mds-patient/src/context/settings-context.jsx#L7)

**Issue**: The `toBackendPrefs()` function in mds-patient is NOT sending `channels` and `moduleChannels` to the backend. Patient settings are incomplete compared to staff.

**Code**:
```jsx
function toBackendPrefs(s) {
  return {
    appearance:   { themeMode: s.themeMode, fontSize: s.fontSize, compactSidebar: s.compactSidebar },
    notification: {
      soundEnabled: s.soundEnabled, soundVolume: s.soundVolume, soundByModule: s.soundByModule,
      showBadges: s.showBadges, showBanners: s.showBanners, bannerErrorsOnly: s.bannerErrorsOnly,
      bannerCompact: s.bannerCompact, bannerAutoDismiss: s.bannerAutoDismiss, bannerDismissDelay: s.bannerDismissDelay,
      // ❌ MISSING: channels, moduleChannels
    },
  };
}
```

**Expected**: Should include `channels` and `moduleChannels` like staff version.

**Impact**: Patient notification preferences are not persisted to the backend, so email fallback won't work correctly.

**Fix**: Add channels and moduleChannels to mds-patient toBackendPrefs.

---

### 🔴 CRITICAL #2: Missing notificationSound & soundFileByModule in Staff toBackendPrefs

**File**: [mds-staff/src/context/settings-context.jsx](mds-staff/src/context/settings-context.jsx#L7)

**Issue**: The staff `toBackendPrefs()` is missing `notificationSound` and `soundFileByModule` fields.

**Code**:
```jsx
notification: {
  soundEnabled: s.soundEnabled, soundVolume: s.soundVolume,
  notificationSound: s.notificationSound,        // ✓ Present (good)
  soundByModule: s.soundByModule,
  soundFileByModule: s.soundFileByModule,        // ✓ Present (good)
  showBadges: s.showBadges, ...
}
```

**Impact**: Minor - sound file preferences won't persist, but notification channels will work.

**Expected**: Fields are present, so this is actually NOT a critical issue. Staff implementation is correct.

**Status**: No fix needed - staff is correct.

---

### 🔴 CRITICAL #3: Patient context Missing soundFileByModule in Defaults

**File**: [mds-patient/src/context/settings-context.jsx](mds-patient/src/context/settings-context.jsx#L40)

**Issue**: Patient DEFAULT_SETTINGS doesn't have `notificationSound` or `soundFileByModule` fields like staff does.

**Code**:
```jsx
const DEFAULT_SETTINGS = {
  soundEnabled: true,
  soundVolume: 1,
  soundByModule: { ... },  // ✓ Present
  // ❌ MISSING: notificationSound, soundFileByModule
};
```

**Impact**: Patient app can't configure per-module sounds, and sound defaults won't work properly in mergeFromBackendPrefs.

**Test Case**: Patient tries to change notification sound → app crashes or doesn't save.

**Fix**: Add `notificationSound` and `soundFileByModule` to patient DEFAULT_SETTINGS and handle in toBackendPrefs.

---

## High-Severity Issues (Should Fix)

### 🟠 HIGH #1: Patient mergeFromBackendPrefs Missing Sound File Handling

**File**: [mds-patient/src/context/settings-context.jsx](mds-patient/src/context/settings-context.jsx#L24)

**Issue**: The `mergeFromBackendPrefs()` function doesn't merge `soundFileByModule` from backend response.

**Code**:
```jsx
function mergeFromBackendPrefs(prefs) {
  const flat = { ...(prefs.appearance || {}), ...(prefs.notification || {}) };
  const merged = sanitizeSettings(flat);
  if (prefs.notification?.soundByModule && typeof prefs.notification.soundByModule === 'object') {
    merged.soundByModule = { ...DEFAULT_SETTINGS.soundByModule, ...merged.soundByModule };
  }
  // ❌ MISSING: soundFileByModule merging
  if (prefs.notification?.channels && typeof prefs.notification.channels === 'object') {
    merged.channels = { ...DEFAULT_SETTINGS.channels, ...merged.channels };
  }
  // ... moduleChannels
}
```

**Expected**: Should match staff implementation which includes soundFileByModule.

**Impact**: Per-module sound file preferences won't sync from backend.

**Fix**: Add soundFileByModule merge logic to patient context.

---

### 🟠 HIGH #2: Staff Settings Context Missing soundFileByModule in Staff UI

**File**: [mds-staff/src/modules/settings/staff-settings.jsx](mds-staff/src/modules/settings/staff-settings.jsx#L1)

**Issue**: The staff settings UI shows sound toggles but doesn't show sound file selectors like the context suggests should be there.

**Evidence**: Context has `soundFileByModule` and `notificationSound` fields, but UI only shows:
- Enable notification sounds (toggle)
- Per-module sound toggles

**Missing UI**:
- Global sound file selector (synthesis vs custom audio files)
- Per-module sound file selector

**Impact**: Users can't customize which sound plays for each module - only toggle on/off.

**Fix**: Add sound file selector dropdowns to both staff and patient settings UI.

---

### 🟠 HIGH #3: Email Service Integration Not Verified

**File**: Multiple notification service files

**Issue**: The implementation calls `enqueueNotificationEmail()` but we haven't verified:
1. Is the email service properly configured?
2. Are email templates being used?
3. Is SMTP sender email set?

**References**:
- [Backend/config/sockets/socket-emitter.js](Backend/config/sockets/socket-emitter.js#L186)
- [Backend/services/emailservice.js](Backend/services/emailservice.js) (not reviewed)

**Impact**: Email fallback notifications might fail silently if email service isn't set up.

**Required Check**: Verify `enqueueNotificationEmail()` function exists and is properly configured.

**Fix**: 
1. Check email service setup
2. Add error handling with logging
3. Create fallback if email service unavailable

---

### 🟠 HIGH #4: Module Services Not Using Email Notifications

**File**: All module service files (EMR, Documents, Appointment, etc.)

**Issue**: Backend module services (notifyStaffs, notifyPatients, etc.) are called with notifications, but we need to verify they're passing `emailNotif` data to `notifyUser()`.

**Current Pattern** (from notifyStaffs.js):
```javascript
const deliveryResults = await notifyUsers(staffIds, 'admin:notification', notificationData);
// ❌ No emailNotif parameter passed
```

**Expected**:
```javascript
const deliveryResults = await notifyUsers(staffIds, 'admin:notification', notificationData, {
  email: userEmail,
  title: 'New Admin Notification',
  message: messageContent,
  ctaLink: '/path/to/action'
});
```

**Impact**: Email fallback won't have proper email metadata, leading to generic fallback emails.

**Fix**: 
1. Add emailNotif parameter to notifyUsers calls
2. Include meaningful subject/body for each notification type
3. Add CTA links where applicable

---

### 🟠 HIGH #5: No Migration File for Initialization of Existing Users

**File**: [Backend/config/query.js](Backend/config/query.js#L597)

**Issue**: `getUserPreferences()` returns null for users without preferences, but no migration initializes preferences for existing users.

**Current Behavior**:
1. User has no UsersPreferences row → returns null
2. Frontend uses defaults  
3. Backend uses defaults
4. Settings never get persisted for that user until they explicitly save something

**Expected**: 
- When a user logs in for the first time, preferences should be auto-initialized
- All users should have a UsersPreferences row with defaults

**Impact**: User preferences not consistent; migrations incomplete.

**Fix**: Create migration to initialize all existing users' preferences.

---

## Medium-Severity Issues (Nice to Have)

### 🟡 MEDIUM #1: Inconsistent Default Descriptions for Email Fallback

**Files**: 
- [mds-staff/src/modules/settings/staff-settings.jsx](mds-staff/src/modules/settings/staff-settings.jsx#L554)
- [mds-patient/src/modules/settings/patient-settings.jsx](mds-patient/src/modules/settings/patient-settings.jsx#L485)

**Issue**: Description text could be clearer. Current:
```
"Send email only when you're offline or logged out"
```

**Better**:
```
"Send email notifications as backup when you're offline or not connected to the portal"
```

**Impact**: User confusion about when email fallback triggers.

**Fix**: Update description text in both settings files.

---

### 🟡 MEDIUM #2: No Confirmation Feedback When Settings Save

**File**: Both settings components

**Issue**: After saving notification preferences, there's a visual "saved" indicator, but no explicit toast/notification that channels were updated.

**Current**: Only `saved` state indicator appears briefly

**Better**: 
```
Toast: "Notification preferences updated successfully"
```

**Impact**: Users might not realize settings actually saved.

**Fix**: Add toast notification on settings save (low priority).

---

### 🟡 MEDIUM #3: Missing resolveChannelsForEvent Logic for Some Events

**File**: [Backend/config/sockets/notification-preferences.js](Backend/config/sockets/notification-preferences.js#L7)

**Issue**: The EVENT_MODULE_MAP might be incomplete. Events not in the map fallback to 'general', but we should verify all events are covered.

**Current Mappings**:
```javascript
const EVENT_MODULE_MAP = [
  ['appointment:',            'appointments'],
  ['healthchat:',             'healthChat'],
  ['medicine:request:',       'medicineRequests'],
  ['medicine:prescription:',  'medicineRequests'],
  ['document:',               'documents'],
  ['updateTicket',            'emr'],
  ['inventory:',              'inventory'],
  ['admin:notification',      'general'],
  ['staff:notification',      'general'],
  ['role:',                   'roleManagement'],
];
```

**Potentially Missing**:
- EMR update events (only 'updateTicket' but might miss others)
- Consultation events (if they exist)
- Other module-specific events

**Impact**: Some modules' events might not respect correct channel preferences.

**Fix**: 
1. Audit all event names emitted by backend modules
2. Add missing event → module mappings
3. Document event naming conventions

---

## Low-Severity Issues

### 🟢 LOW #1: Checkbox Labels Could Be More Explicit

**File**: Settings UI components

**Current Label**:
```
☑ Web  ☑ Email  ☑ Email fallback
```

**Better**:
```
☑ Web (Portal)  ☑ Email (Always)  ☑ Email (Offline)
```

**Impact**: UX improvement only.

---

### 🟢 LOW #2: No Rate Limiting on Preference Changes

**File**: [Backend/routes/settings/settings.js](Backend/routes/settings/settings.js)

**Issue**: No rate limiting on PATCH /settings endpoint.

**Impact**: Theoretical abuse vector, but low risk.

---

## Summary of Fixes Required

| Severity | Issue | Files | Est. Effort |
|----------|-------|-------|-----------|
| CRITICAL #1 | Add channels/moduleChannels to patient toBackendPrefs | mds-patient/settings-context.jsx | 5 min |
| CRITICAL #3 | Add soundFileByModule to patient DEFAULT_SETTINGS | mds-patient/settings-context.jsx | 10 min |
| HIGH #1 | Add soundFileByModule merge in patient mergeFromBackendPrefs | mds-patient/settings-context.jsx | 5 min |
| HIGH #2 | Verify/test email service integration | Backend/services/* | 15 min |
| HIGH #3 | Add emailNotif to module service calls | Backend/services/notifyStaffs.js, etc. | 30 min |
| HIGH #4 | Create migration for existing users | Backend/config/migrations/ | 15 min |
| MEDIUM #1 | Update email fallback descriptions | Both settings files | 5 min |
| MEDIUM #2 | Add save confirmation toast | Both settings files | 10 min |
| MEDIUM #3 | Audit and complete EVENT_MODULE_MAP | notification-preferences.js | 20 min |

**Total Estimated Fix Time**: ~115 minutes (~2 hours)

---

## Testing Recommendations

### Test 1: Basic Preference Persistence
```
1. Staff user changes channels in settings (web enabled, email disabled)
2. Save settings → should show "Saved" state
3. Refresh page → preferences still saved
4. Check browser DevTools → settings stored in DB (not just localStorage)
```

### Test 2: Patient-Specific Preferences
```
1. Patient disables web notifications, enables email
2. Patient goes offline
3. Trigger notification from backend
4. Should receive email, NOT web notification
```

### Test 3: Per-Module Override
```
1. Global: web ON, email OFF, emailFallback ON
2. Appointments module: web OFF (override)
3. Trigger appointment notification online → should NOT arrive
4. Trigger offline → should get email
5. Health Chat notification → should arrive (uses global settings)
```

### Test 4: All Channels Disabled
```
1. Disable web, email, emailFallback for all modules
2. Trigger thousands of notifications
3. System should not crash or send notifications
4. Should log suppressions
```

### Test 5: Cross-Portal (Staff vs Patient)
```
1. Same user logged in as both staff and patient in different tabs
2. Change staff notification settings tab A
3. Switch to patient in tab B → patient settings UNCHANGED
4. Preferences isolated per portal
```

---

## Files Modified Summary

After fixes, these files will be updated:
1. mds-patient/src/context/settings-context.jsx
2. mds-staff/src/modules/settings/staff-settings.jsx (minor)
3. mds-patient/src/modules/settings/patient-settings.jsx (minor)
4. Backend/services/notifyStaffs.js (add emailNotif)
5. Backend/services/notifyPatients.js (add emailNotif)
6. Backend/config/migrations/initialize-user-preferences.sql
7. Documentation files updated

---

## Next Steps

1. **Review this report** with the team
2. **Apply Critical fixes** first (won't break anything)
3. **Apply High fixes** in order
4. **Run test suite**
5. **Manual testing** in both portals
6. **Update documentation**

