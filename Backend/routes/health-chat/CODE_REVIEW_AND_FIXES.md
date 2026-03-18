# Health Chat Code Review and Fixes
## Date: 2026-03-19

## Summary
This document outlines all code review findings, bugs fixed, improvements made, and optimizations applied to the Health Chat module to ensure proper database-to-backend-to-frontend connectivity and optimized socket handling.

---

## 🐛 **Critical Bugs Fixed**

### 1. **Incorrect System Message Implementation in `_expireOldTickets`**
**File:** `Backend/routes/health-chat/resolvers/wrapper/wrapper.js` (Lines 641-667)

**Issue:**
- The mutation was passing `user.id` to system messages, which should be NULL
- Did not follow the self-sufficient implementation from `helper.js`

**Fix:**
```javascript
// Before: Passed user.id to system messages (incorrect)
VALUES ($1, 'This conversation has expired...', 'system', $2, 'Medical')
[row.id, user.id]

// After: Uses self-sufficient autoExpireTickets from helper.js
const count = await autoExpireTickets();
```

**Impact:** System messages now correctly have NULL userId, preventing attribution to wrong users.

---

### 2. **Database Schema: userId Should Allow NULL**
**Files:**
- `Backend/routes/health-chat/.idea/MDSystem031726.sql` (Line 832)
- `Backend/routes/health-chat/.idea/migration_healthchat_fix.sql` (NEW)

**Issue:**
- `HealthChatPrompt.userId` was defined as `NOT NULL` in the database
- System messages require NULL userId

**Fix:**
- Created migration file: `migration_healthchat_fix.sql`
- Updated schema to allow NULL: `"userId" integer,  -- NULL for system messages`

**Action Required:**
```bash
# Run this migration on your database:
psql -U your_user -d your_database -f Backend/routes/health-chat/.idea/migration_healthchat_fix.sql
```

---

### 3. **GraphQL Schema: userId Marked as Required**
**File:** `Backend/routes/health-chat/schema.graphql` (Line 47)

**Issue:**
```graphql
userId: Int!  # Was marked as required (!)
```

**Fix:**
```graphql
userId: Int  # Nullable for system messages
```

**Impact:** GraphQL now correctly allows NULL userId for system messages.

---

### 4. **Duplicate ChatBox Rendering in Patient UI**
**File:** `mds-patient/src/modules/health-chat/health-chat.jsx` (Lines 419-472)

**Issue:**
- Two identical ChatBox components were being rendered simultaneously
- Both conditions `{ticket && !shouldShowCreateForm && ...}` and `{ticket && ['Open', 'Ongoing'].includes(...) && ...}`
  evaluated to true for the same tickets

**Fix:**
- Removed duplicate rendering
- Kept single, clean conditional: `{ticket && ['Open', 'Ongoing'].includes(ticket.status) && ...}`

**Impact:** UI now correctly renders only one ChatBox component.

---

### 5. **Missing Input Validation in Send Message Mutations**
**File:** `Backend/routes/health-chat/resolvers/wrapper/wrapper.js`

**Issue:**
- No backend validation that either `text` or `filename` is provided
- Could allow empty messages in database

**Fix in `_sendPatientMessage` and `_sendMedicalMessage`:**
```javascript
// Validate that at least text or filename is provided
const hasText = text && text.trim().length > 0;
const hasFile = filename && promptType === 'file';

if (!hasText && !hasFile) {
  throwGraphQLError(res)
    .message("Message must contain either text or a file.")
    .status(400)
    .throw();
}
```

**Impact:** Backend now properly validates message content before insertion.

---

### 6. **Race Condition: Auto-Expire Not Called Before Message Send**
**File:** `Backend/routes/health-chat/resolvers/wrapper/wrapper.js`

**Issue:**
- `checkChatStatus` checks if chat is expired but doesn't update database
- When sending messages, no auto-expire check was performed first
- User could try to send message to expired chat, get error, but chat status remains 'Ongoing' in DB

**Fix:**
Added `await autoExpireTickets()` before status checks in both message send functions:
```javascript
// Auto-expire any expired tickets before checking status
await autoExpireTickets(user.id);  // For patient messages

// or

await autoExpireTickets();  // For medical messages
```

**Impact:** Eliminates race condition, ensures chat status is current before operations.

---

## ✅ **Verified & Optimized**

### 1. **Socket Connection Optimization - Patient Side**
**File:** `mds-patient/src/modules/health-chat/hooks/use-health-chat-socket.js`

**Status:** ✅ **OPTIMIZED AND CORRECT**

**Implementation:**
```javascript
// Only connects when chat is active
const shouldConnect = chatId && ['Open', 'Ongoing'].includes(chatStatus);

// Properly disconnects when not needed
if (!shouldConnect) {
  if (socketRef.current) {
    socketRef.current.disconnect();
    socketRef.current = null;
    setIsConnected(false);
  }
  return;
}
```

**Optimization Benefits:**
- Socket only opens when chat is active (`Open` or `Ongoing` status)
- Automatically disconnects when chat is `Closed` or `Expired`
- Cleans up on unmount
- Typing indicator auto-stops after 3 seconds

---

### 2. **Socket Connection Optimization - Staff Side**
**File:** `mds-staff/src/modules/health-chat/hooks/use-health-chat-socket.js`

**Status:** ✅ **ACCEPTABLE FOR STAFF USE CASE**

**Implementation:**
- Staff socket connects on mount and stays connected
- This is **intentional and correct** because staff need to receive:
  - New ticket notifications from any patient
  - Real-time updates across all conversations
- Individual chat rooms are joined/left dynamically when staff selects a chat
- Proper cleanup on unmount

**Room Management:**
```javascript
// Joins specific room only when chat is selected
if (!joinedRoomsRef.current.has(selectedChatId)) {
  socketRef.current.emit('healthchat:join-room', { chatId: selectedChatId });
  joinedRoomsRef.current.add(selectedChatId);
}
```

---

### 3. **Database Connectivity**
**Files:** All resolver files use `require("../../../../config/query.js")`

**Status:** ✅ **CORRECT**

**Verification:**
- All queries use parameterized statements (`$1, $2, $3`)
- No SQL injection vulnerabilities found
- Proper error handling with try-catch where needed
- Database connection is properly imported and used

---

### 4. **Backend to Frontend GraphQL Integration**
**Status:** ✅ **CORRECT**

**Verification:**
- Patient endpoint: `/healthchat/patient` with JWT protection
- Medical endpoint: `/healthchat/medical` with JWT protection
- Proper schema separation between patient and medical resolvers
- Service files correctly call GraphQL endpoints
- Error handling properly propagates to frontend

---

### 5. **Security Review**
**Status:** ✅ **SECURE**

**Findings:**
- ✅ All SQL queries use parameterized statements
- ✅ JWT authentication on all routes
- ✅ Authorization checks (`verifyPatientOwnsChat`, `verifyMedicalAssignedToChat`)
- ✅ Input validation added for message content
- ✅ File uploads use `promoteFile` for validation
- ✅ No sensitive data leakage in error messages
- ✅ Status validation before operations

---

## 🔧 **Configuration & Best Practices**

### Database Schema Constants
- `CHAT_EXPIRY_DAYS = 3` (defined in `helper.js:4`)
- Self-sufficient auto-expiry (no cron job required)
- Expiry checked on relevant operations

### Socket Events Registered
**File:** `Backend/config/sockets/health-chat-events.js`

Properly registered events:
- `healthchat:join-room` - Join chat room
- `healthchat:leave-room` - Leave chat room
- `healthchat:typing` - Typing indicator

### Socket Emission Events
From backend to clients:
- `healthchat:new-message` - New message in chat
- `healthchat:ticket-created` - New ticket (to all staff)
- `healthchat:ticket-approved` - Ticket approved (to patient)
- `healthchat:ticket-rejected` - Ticket rejected (to patient)
- `healthchat:ticket-closed` - Ticket closed
- `healthchat:user-typing` - User typing indicator

---

## 📋 **Action Items**

### Required Actions:
1. **Run Database Migration** ⚠️ **CRITICAL**
   ```bash
   psql -U your_user -d your_database -f Backend/routes/health-chat/.idea/migration_healthchat_fix.sql
   ```

### Recommended Actions:
1. Deploy updated backend code
2. Deploy updated frontend code
3. Test the following scenarios:
   - Create ticket → Send messages → Close ticket → Create new ticket
   - Let ticket expire (3 days) → Verify auto-expiry works
   - Multiple staff viewing/responding to same ticket
   - File uploads in messages
   - Socket disconnection/reconnection

---

## 📊 **Files Modified**

### Backend:
1. `Backend/routes/health-chat/resolvers/wrapper/wrapper.js`
   - Fixed `_expireOldTickets` mutation
   - Added validation in `_sendPatientMessage`
   - Added validation in `_sendMedicalMessage`
   - Added auto-expire calls before status checks

2. `Backend/routes/health-chat/schema.graphql`
   - Made `userId` nullable in `HealthChatPrompt` type

3. `Backend/routes/health-chat/.idea/MDSystem031726.sql`
   - Added comment for NULL userId

4. `Backend/routes/health-chat/.idea/migration_healthchat_fix.sql` (NEW)
   - Created migration to allow NULL userId

### Frontend:
1. `mds-patient/src/modules/health-chat/health-chat.jsx`
   - Fixed duplicate ChatBox rendering

---

## ✨ **Summary of Improvements**

| Category | Before | After |
|----------|--------|-------|
| **System Messages** | Incorrectly attributed to users | Correctly have NULL userId |
| **Database Schema** | userId NOT NULL (wrong) | userId nullable (correct) |
| **GraphQL Schema** | userId: Int! (wrong) | userId: Int (correct) |
| **UI Rendering** | Duplicate ChatBox components | Single, clean rendering |
| **Input Validation** | Frontend only | Backend + Frontend |
| **Race Conditions** | Possible expired chat send | Prevented with auto-expire |
| **Socket Optimization** | ✅ Already optimized | ✅ Verified and documented |
| **Security** | ✅ Already secure | ✅ Verified and enhanced |

---

## 🎯 **Testing Checklist**

- [ ] Database migration executed successfully
- [ ] System messages have NULL userId
- [ ] Patient can create ticket
- [ ] Patient can send text messages
- [ ] Patient can send file attachments
- [ ] Patient can close ticket
- [ ] Patient can create new ticket after closing
- [ ] Staff receives new ticket notification
- [ ] Staff can approve ticket
- [ ] Staff can reject ticket
- [ ] Staff can send messages
- [ ] Staff can close ticket
- [ ] Socket connects/disconnects properly for patients
- [ ] Socket stays connected for staff
- [ ] Typing indicators work both ways
- [ ] Tickets auto-expire after 3 days
- [ ] Cannot send message to expired ticket
- [ ] Error messages are clear and helpful
- [ ] No duplicate rendering in patient UI

---

## 📝 **Notes**

- All fixes maintain backward compatibility
- No breaking changes to existing functionality
- Performance optimizations do not affect user experience
- Socket optimization follows best practices (connect only when needed for patients, always-on for staff)
- All security best practices followed

---

**Review Completed By:** Claude (AI Code Reviewer)
**Date:** 2026-03-19
**Status:** ✅ All Critical Issues Fixed
