# Code Review & Bug Fix Prompt: Notification Preferences & Email Fallback

## Purpose
Conduct a comprehensive code review of the Notification Preferences & Email Fallback implementation across the entire MDSystem project. Identify bugs, inconsistencies, security issues, and edge cases. Apply fixes and update documentation.

---

## Review Scope

### Areas to Review
1. **Frontend Components** (mds-staff & mds-patient)
   - Settings Context & State Management
   - Notification Preference UI Components
   - API calls & state persistence
   - Real-time preference updates

2. **Backend Architecture**
   - Socket emitter & notification routing
   - Notification preferences resolver
   - Email fallback logic & triggers
   - Channel resolution for each event type

3. **Module Integration** (EMR, Documents, Appointment, Medicine-Request, HealthChat, Role-Management, SendNotification)
   - Event names & notification triggers
   - Channel preference passing
   - Email notification metadata

4. **Database & Persistence**
   - UsersPreferences schema (JSONB structure)
   - Default initialization
   - Migration correctness

5. **Cross-Module Consistency**
   - Both mds-staff and mds-patient have identical settings structure
   - All modules use consistent event naming
   - Backend correctly resolves per-module preferences

---

## Specific Implementation Details to Verify

### Defaults Should Be:
```
channels {
  web: true,           # Always send to connected users
  email: false,        # Don't always send email
  emailFallback: true  # Do send email when offline
}

moduleChannels {
  appointments: { web: true, email: false, emailFallback: true }
  documents: { web: true, email: false, emailFallback: true }
  emr: { web: true, email: false, emailFallback: true }
  healthChat: { web: true, email: false, emailFallback: true }
  medicineRequests: { web: true, email: false, emailFallback: true }
  inventory: { web: true, email: false, emailFallback: true }
  roleManagement: { web: true, email: false, emailFallback: true }
  general: { web: true, email: false, emailFallback: true }
}
```

### Critical Logic to Verify

1. **Channel Resolution Priority**
   ```
   IF moduleChannels[module] exists
     use moduleChannels[module]
   ELSE IF channels exists
     use channels (global fallback)
   ELSE
     use DEFAULT_SETTINGS.channels
   ```

2. **Email Sending Conditions**
   ```
   send_email IF:
   (channel.email === true) OR 
   (channel.emailFallback === true AND user_is_offline)
   ```

3. **User Offline Detection**
   - Socket.IO connection check
   - Redis session check
   - Last active timestamp check

4. **Preference Caching**
   - Redis TTL setup
   - Cache invalidation on preference changes
   - Fallback to DB if cache miss

---

## Bug Categories to Check For

### 1. State Management Issues
- [ ] Preference changes not persisting to backend
- [ ] Frontend state out of sync with backend
- [ ] Missing null/undefined checks
- [ ] Race conditions in concurrent updates
- [ ] Incorrect mergeFromBackendPrefs logic

### 2. Channel Resolution Bugs
- [ ] Module preferences not overriding global preferences
- [ ] Fallback to defaults not working
- [ ] Wrong event type → module mapping
- [ ] Case sensitivity issues in module names

### 3. Email Fallback Logic Issues
- [ ] User offline detection incorrect
- [ ] Email sent when user is online (wasting resources)
- [ ] Email not sent when user is offline
- [ ] emailFallback preference ignored
- [ ] No email data/template provided

### 4. UI/UX Issues
- [ ] Toggle switches don't match actual states
- [ ] No visual indication of disabled notifications
- [ ] Settings not saved confirmation missing
- [ ] Module list incomplete or misnamed
- [ ] Confusing labeling (web vs email vs emailFallback)

### 5. Cross-Module Consistency
- [ ] Some modules don't support all channels
- [ ] Event names inconsistent across modules
- [ ] Missing modules in settings UI
- [ ] Preference data structure differs per module

### 6. Database/Migration Issues
- [ ] Default preferences not initialized for existing users
- [ ] Schema doesn't match code expectations
- [ ] JSON structure validation missing
- [ ] Migration not idempotent
- [ ] Data type mismatches (boolean vs string)

### 7. Security Issues
- [ ] User can modify others' preferences
- [ ] No rate limiting on preference changes
- [ ] Sensitive data in email templates
- [ ] Email sent without proper authentication

### 8. Performance Issues
- [ ] N+1 queries for preference lookups
- [ ] Redis cache thrashing
- [ ] Missing indexes on preferences table
- [ ] Inefficient batch email sending

---

## Review Checklist

### Frontend (Both mds-staff & mds-patient)

- [ ] **settings-context.jsx**
  - [ ] toBackendPrefs correctly serializes all channel preferences
  - [ ] mergeFromBackendPrefs handles missing/undefined values
  - [ ] Defaults match specification
  - [ ] Module names consistent with backend
  - [ ] No memory leaks in event listeners

- [ ] **Settings UI Components**
  - [ ] Global channel toggles visible and functional
  - [ ] Per-module channel toggles visible and functional
  - [ ] All 8 modules present (appointments, documents, emr, healthChat, medicineRequests, inventory, roleManagement, general)
  - [ ] "Disabled" state message shown when all notifications off
  - [ ] Enable/disable UI intuitive and clear
  - [ ] Saving/loading states handled correctly

### Backend

- [ ] **socket-emitter.js (notifyUser & notifyUsers)**
  - [ ] Correctly resolves channel preferences
  - [ ] Falls back to defaults if no preferences found
  - [ ] Email not sent if all channels disabled
  - [ ] emailFallback only triggers when user offline

- [ ] **notification-preferences.js**
  - [ ] resolveChannelsForEvent correctly maps event → module
  - [ ] Module preferences override global preferences
  - [ ] Default fallback structure correct
  - [ ] Cache invalidation working

- [ ] **Each Module Service** (EMR, Documents, Appointment, etc.)
  - [ ] Calls correct event names
  - [ ] Passes emailNotif data when calling notifyUser
  - [ ] Email subjects/templates provided
  - [ ] HTML email templates properly formatted

- [ ] **Email Service**
  - [ ] Only sends when channel preferences allow
  - [ ] Correct sender/recipient
  - [ ] Proper email headers & footer
  - [ ] Unsubscribe links (if applicable)

### Database & Migrations

- [ ] **UsersPreferences Table**
  - [ ] JSONB structure matches code expectations
  - [ ] Defaults initialized for new users
  - [ ] Existing users can have NULL → should use defaults

- [ ] **Migration Scripts**
  - [ ] Idempotent (safe to run multiple times)
  - [ ] Handles existing data correctly
  - [ ] Backup created before migration

### Settings API

- [ ] **PATCH /settings Endpoint**
  - [ ] Validates preference structure
  - [ ] Updates both PostgreSQL & Redis
  - [ ] Returns updated settings
  - [ ] Proper error handling

---

## Testing Recommendations

1. **Preference Persistence Test**
   - Set global web=false
   - Verify web notifications don't arrive
   - Log out, verify emailFallback triggers

2. **Module Override Test**
   - Disable health chat notifications
   - Verify other modules still send
   - Verify health chat email fallback works

3. **Offline Detection Test**
   - Kill socket connection
   - Trigger multiple notifications
   - Verify emails are queued for offline fallback
   - Reconnect & verify cache cleared

4. **Permission Test**
   - User A tries to set User B's preferences
   - Should return 403 Forbidden

5. **Edge Case Test**
   - All channels disabled (web + email + emailFallback)
   - Verify no notifications sent
   - Verify no errors logged

---

## Output Requirements

After completing the review:

1. **Create Bug Report** (if issues found)
   - [ ] List all bugs with severity (Critical/High/Medium/Low)
   - [ ] Include code locations & line numbers
   - [ ] Suggest fixes

2. **Apply Fixes**
   - [ ] Implement all Critical & High severity fixes
   - [ ] Create test cases for fixes

3. **Update Documentation**
   - [ ] Update NOTIFICATION_PREFERENCES_IMPLEMENTATION.md
   - [ ] Update NOTIFICATIONS_SYSTEM.md
   - [ ] Add section to USER_PREFERENCES_API.md (if exists)
   - [ ] Document any breaking changes

4. **Generate Summary**
   - [ ] List all files reviewed
   - [ ] Summary of issues found & fixed
   - [ ] Recommendations for future improvements

---

## File Locations Reference

### Frontend
- `mds-staff/src/context/settings-context.jsx`
- `mds-staff/src/modules/settings/` (UI components)
- `mds-patient/src/context/settings-context.jsx`
- `mds-patient/src/modules/settings/` (UI components)

### Backend
- `Backend/config/sockets/socket-emitter.js`
- `Backend/config/sockets/notification-preferences.js`
- `Backend/services/notifyStaffs.js`
- `Backend/services/notifyPatients.js`
- `Backend/routes/*/` (all module routes)

### Module Services
- `Backend/services/EMR/`
- `Backend/services/Documents/`
- `Backend/services/Appointment/`
- `Backend/services/Medicine-Request/`
- `Backend/services/HealthChat/`
- `Backend/services/SendNotification/`

### Database
- `Backend/config/migrations/` (find preferences migration)
- `Backend/config/db.js` (schema definition)

### Documentation
- `Docs/NOTIFICATION_PREFERENCES_IMPLEMENTATION.md`
- `Docs/NOTIFICATIONS_SYSTEM.md`
- `Docs/USER_PREFERENCES_API.md`

---

## Notes

- **Severity Levels**: Critical (breaks functionality), High (affects UX/security), Medium (minor issue), Low (nice to have)
- **Test in Both Portals**: Any fix must work in both mds-staff and mds-patient
- **Backward Compatibility**: Existing user preferences should be handled gracefully
- **Email Templates**: Ensure all email subjects/templates are properly set up
- **Environment Variables**: Verify SMTP settings & sender email configured

