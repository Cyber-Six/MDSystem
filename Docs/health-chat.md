# Health Chat System Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [GraphQL API](#graphql-api)
5. [Resolvers](#resolvers)
6. [Security & Permissions](#security--permissions)
7. [Real-time Features](#real-time-features)
8. [Atomic Transactions](#atomic-transactions)
9. [Helper Functions](#helper-functions)
10. [Bug Fixes & Improvements](#bug-fixes--improvements)
11. [Usage Examples](#usage-examples)

---

## Overview

The Health Chat system is a secure, real-time messaging platform that enables patients to communicate with medical personnel through a ticketing system. It provides separate GraphQL endpoints for patients and medical staff with role-based access control and location-based filtering.

### Key Features

- **Ticket-based Conversations**: Patients create tickets that are approved/rejected by medical staff
- **Real-time Messaging**: WebSocket integration for live message delivery
- **Session Management**: Auto-expiry after 3 days of inactivity
- **Session Extension**: Both parties can extend sessions within 48 hours of expiry
- **File Uploads**: Support for text and file messages
- **Location-based Access**: Branch filtering (Manila, Quezon City, Both)
- **Transfer & Takeover**: Tickets can be transferred between staff members
- **Atomic Transactions**: All mutations use database transactions for data consistency
- **Audit Trail**: System messages log all ticket status changes

---

## Architecture

### Directory Structure

```
Backend/routes/health-chat/
├── graphql.js                          # GraphQL endpoint initialization
├── schema.graphql                      # GraphQL schema definitions
└── resolvers/
    ├── patient/
    │   └── patient-resolver.js        # Patient-specific resolvers (wrapper)
    ├── medical/
    │   └── medical-resolver.js        # Medical-specific resolvers with permissions
    └── wrapper/
        ├── wrapper.js                  # Core resolver implementation
        └── helper.js                   # Helper functions and utilities
```

### GraphQL Endpoints

- **Patient Endpoint**: `/healthchat/patient`
  - Authentication: `jwtProtect("patient")`
  - Access: All verified patients

- **Medical Endpoint**: `/healthchat/medical`
  - Authentication: `jwtProtect("medical")`
  - Access: Medical personnel with health_chat_allow_access permission

### Resolver Layers

1. **Patient/Medical Resolvers**: Entry point with authentication
2. **Permission Layer** (Medical only): Location-based and patient-based authorization
3. **Wrapper Resolvers**: Core business logic with atomic transactions
4. **Helper Functions**: Utility functions for formatting and validation

---

## Database Schema

### Tables

#### HealthChat
Primary table for chat tickets/sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Ticket ID |
| patientId | INT NOT NULL | Foreign key to patient |
| medicalId | INT | Foreign key to assigned medical staff |
| purpose | TEXT NOT NULL | Reason for consultation |
| notes | TEXT | Additional notes from staff |
| status | ENUM | Open, Ongoing, Closed, Expired |
| session_start | TIMESTAMP | When session was approved |
| session_end | TIMESTAMP | When session was closed |
| consent_logged | BOOLEAN | Whether consent was logged |
| closed_by_type | ENUM | Patient, Staff, System |
| archived_at | TIMESTAMP | When archived |

#### HealthChatPrompt
Messages within tickets.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Message ID |
| consultationVirtualId | INT NOT NULL | Foreign key to HealthChat |
| text | TEXT | Message text |
| filename | UUID | Uploaded file reference |
| promptType | ENUM | text, file, system |
| userId | INT | Sender ID (NULL for system) |
| userType | ENUM | Patient, Medical |
| stamp | TIMESTAMP | Message timestamp |

### Ticket Lifecycle

```
[Patient Creates] → status=Open
       ↓
[Staff Approves] → status=Ongoing, session_start=NOW()
       ↓
[3 days later OR manual close] → status=Closed/Expired
```

### Expiry Logic

- **Session Duration**: 3 days from `session_start`
- **Auto-Expiry**: Triggered when last message is older than 3 days
- **Cooldown**: Auto-expiry runs maximum once per 30 seconds globally
- **Extensions**: Can extend by 1 day when within 48 hours of expiry

---

## GraphQL API

### Types

#### HealthChat
```graphql
type HealthChat {
  id: ID!
  patientId: Int!
  medicalId: Int
  purpose: String!
  notes: String
  status: ChatStatus!
  session_start: Date
  session_end: Date
  consent_logged: Boolean
  archived_at: Date
  patient: ChatParticipant
  medical: ChatParticipant
  closedBy: ClosedBy
  expiresAt: Date
  lastMessage: HealthChatPrompt
  lastMessageAt: Date
  unreadCount: Int
}
```

#### PatientConversation
Messenger-style grouping of all tickets for a patient.

```graphql
type PatientConversation {
  patientId: Int!
  patient: ChatParticipant!
  latestTicket: HealthChat!
  lastMessage: HealthChatPrompt
  lastMessageAt: Date
  unreadCount: Int
  activeTicketCount: Int
  totalTicketCount: Int
  tickets: [HealthChat!]!
}
```

### Patient Queries

#### getMyTickets
Get all tickets for the authenticated patient.

```graphql
getMyTickets(
  status: ChatStatus,
  offset: Int,
  limit: Int
): HealthChatList!
```

**Parameters**:
- `status`: Filter by ticket status (optional)
- `offset`: Pagination offset (default: 0)
- `limit`: Results per page (default: 10)

**Returns**: List of tickets with total count

**Security**: Patient can only see their own tickets

---

#### getMyTicket
Get a specific ticket by ID.

```graphql
getMyTicket(chatId: ID!): HealthChat
```

**Security**: Verifies patient owns the ticket

---

#### getTicketMessages
Get messages for a specific ticket.

```graphql
getTicketMessages(
  chatId: ID!,
  offset: Int,
  limit: Int
): [HealthChatPrompt!]!
```

**Parameters**:
- `chatId`: Ticket ID
- `offset`: Message offset (default: 0)
- `limit`: Messages per page (default: 50)

**Returns**: Messages ordered by timestamp ASC

**Security**: Verifies patient owns the ticket

---

### Medical Queries

#### getPendingTickets
Get all tickets awaiting approval (status=Open).

```graphql
getPendingTickets(
  location: Designation,
  offset: Int,
  limit: Int
): HealthChatList!
```

**Parameters**:
- `location`: Manila | QuezonCity | Both (default: Both)

**Security**: Location-based permission check

**Business Logic**:
- Filters by patient's branch
- Orders by ID ASC (oldest first)
- Auto-expires old tickets before query

---

#### getActiveTickets
Get all ongoing tickets (status=Ongoing).

```graphql
getActiveTickets(
  location: Designation,
  offset: Int,
  limit: Int
): HealthChatList!
```

**Security**: Location-based permission check

**Business Logic**:
- Orders by session_start DESC (most recent first)
- Auto-expires old tickets before query

---

#### getAllTickets
Get all tickets with optional status filter.

```graphql
getAllTickets(
  location: Designation,
  status: ChatStatus,
  offset: Int,
  limit: Int
): HealthChatList!
```

**Security**: Location-based permission check

---

#### getPatientConversations
Get conversations grouped by patient (Messenger-style UI).

```graphql
getPatientConversations(
  location: Designation,
  statuses: [ChatStatus],
  offset: Int,
  limit: Int
): PatientConversationList!
```

**Returns**: One row per patient with:
- Latest ticket (prioritized: Ongoing > Open > others)
- Last message across all tickets
- Unread count
- All tickets for that patient (for history/context)

**Performance**: Uses batch queries to avoid N+1 problems

---

#### getPatientMessages
Get all messages for a patient across all their tickets.

```graphql
getPatientMessages(
  patientId: Int!,
  offset: Int,
  limit: Int,
  before: String  # Cursor-based pagination
): [HealthChatPrompt!]!
```

**Parameters**:
- `before`: Timestamp for cursor-based pagination

**Returns**: Messages in ASC order with ticket metadata

**Security**: Patient-based permission check

---

#### getMessages
Get messages for a specific ticket (medical view).

```graphql
getMessages(
  chatId: ID!,
  offset: Int,
  limit: Int
): [HealthChatPrompt!]!
```

**Security**:
- Verifies medical staff is assigned to ticket OR is admin
- Patient-based permission check

**Business Logic**:
- Only assigned staff can view messages
- Admins can override with `isMedicalAdmin()` check

---

### Patient Mutations

#### createTicket
Create a new consultation ticket.

```graphql
createTicket(
  input: CreateTicketInput!
): TicketResult!

input CreateTicketInput {
  purpose: String!
  notes: String
}
```

**Validation**:
- Patient must not have any active ticket (Open or Ongoing)

**Behavior**:
- Creates ticket with status=Open
- Emits `healthchat:ticket-created` to all medical staff

**Returns**: `{ success: true, chat, message }`

---

#### sendPatientMessage
Send a message as a patient.

```graphql
sendPatientMessage(
  input: SendMessageInput!
): MessageResult!

input SendMessageInput {
  chatId: ID!
  text: String
  filename: UUID
  promptType: PromptType!
}
```

**Validation**:
- Must provide either text or file
- Verifies patient owns the ticket
- Auto-expires tickets before checking status
- Chat must be active (Open or Ongoing)

**File Handling**:
- Promotes file from temp storage using `promoteFile()`
- Category: "eConsultation"

**Real-time**:
- Emits to room `healthchat:${chatId}`
- Notifies assigned medical staff via `notifyUser()`

**Bug Fix**: Now fetches medicalId BEFORE inserting message to prevent race conditions

---

#### closeMyTicket
Patient closes their own ticket.

```graphql
closeMyTicket(chatId: ID!): TicketResult!
```

**Atomic Transaction**:
```sql
BEGIN;
UPDATE HealthChat SET status='Closed', session_end=NOW(), closed_by_type='Patient' WHERE id=? AND patientId=?;
INSERT INTO HealthChatPrompt (consultationVirtualId, text, promptType, userType) VALUES (?, 'Patient closed this ticket.', 'system', 'Patient');
COMMIT;
```

**Real-time**:
- Emits to room `healthchat:${chatId}`
- Notifies all medical staff via `emitToRole('medical')`

---

### Medical Mutations

#### approveTicket
Approve a pending ticket and start session.

```graphql
approveTicket(
  input: ApproveTicketInput!
): TicketResult!

input ApproveTicketInput {
  chatId: ID!
  notes: String
}
```

**Validation**:
- Ticket must be status=Open
- Patient-based permission check

**Atomic Transaction**:
```sql
BEGIN;
UPDATE HealthChat SET
  status='Ongoing',
  medicalId=?,
  session_start=NOW(),
  notes=COALESCE(?, notes),
  consent_logged=true
WHERE id=?;
INSERT INTO HealthChatPrompt VALUES (?, 'Staff has approved...', 'system', 'Medical');
COMMIT;
```

**Real-time**:
- Notifies patient via `notifyUser()`
- Notifies all medical staff about status change

---

#### rejectTicket
Reject a pending ticket.

```graphql
rejectTicket(
  chatId: ID!,
  reason: String
): TicketResult!
```

**Validation**:
- Ticket must be status=Open

**Atomic Transaction**: Similar to approve, but sets status=Closed

**Real-time**:
- Notifies patient with rejection reason
- Notifies all medical staff

---

#### sendMedicalMessage
Send a message as medical staff.

```graphql
sendMedicalMessage(
  input: SendMessageInput!
): MessageResult!
```

**Validation**:
- Auto-expires tickets before checking
- Chat must be active
- Verifies assigned staff (medicalId must match or be NULL)

**Real-time**:
- Emits to room `healthchat:${chatId}`
- Notifies patient via `notifyUser()`

---

#### closeTicket
Medical staff closes a ticket.

```graphql
closeTicket(
  input: CloseTicketInput!
): TicketResult!

input CloseTicketInput {
  chatId: ID!
  notes: String
}
```

**Atomic Transaction**: UPDATE + INSERT system message

**Real-time**:
- Emits to room
- Notifies patient

---

#### deleteArchivedTicket
Permanently delete a closed/expired ticket.

```graphql
deleteArchivedTicket(chatId: ID!): TicketResult!
```

**Validation**:
- Ticket must be status=Closed OR status=Expired
- Admin permission recommended (handled in routes)

**Atomic Transaction**:
```sql
BEGIN;
DELETE FROM HealthChatPrompt WHERE consultationVirtualId=?;
DELETE FROM HealthChat WHERE id=?;
COMMIT;
```

**Bug Fix**: Now properly wrapped in transaction to prevent orphaned tickets

---

#### transferTicket
Transfer ticket to another medical staff member.

```graphql
transferTicket(
  chatId: ID!,
  toMedicalId: Int!
): TicketResult!
```

**Authorization**:
- Must be currently assigned staff
- New staff must be different from current
- **Bug Fix**: Now verifies new staff exists and is active

**Validation**:
```sql
SELECT id, is_active FROM MedicalPersonnel WHERE id=?
```

**Atomic Transaction**: UPDATE medicalId + INSERT system message

**Real-time**:
- Notifies patient
- Notifies new medical staff

---

#### takeoverOngoingTicket
Admin forcefully takes over a ticket.

```graphql
takeoverOngoingTicket(chatId: ID!): TicketResult!
```

**Authorization**: `isMedicalAdmin()` required

**Validation**:
- User cannot already be assigned to ticket

**Atomic Transaction**: UPDATE + INSERT system message

---

#### extendSession
Extend session by 1 day.

```graphql
extendSession(chatId: ID!): TicketResult!
```

**Authorization**: Patient OR assigned medical staff

**Validation**:
- Session must be Ongoing
- Must be within 48 hours of expiry
- Must not already be expired

**Atomic Transaction**:
```sql
BEGIN;
UPDATE HealthChat SET session_start = session_start + INTERVAL '1 day' WHERE id=?;
INSERT INTO HealthChatPrompt VALUES (?, 'Chat session extended by 1 day.', 'system', ?);
COMMIT;
```

**Real-time**: Notifies both parties

---

#### expireOldTickets
Manually trigger expiry of old tickets.

```graphql
expireOldTickets: Int!
```

**Returns**: Number of tickets expired

**Behavior**: Calls `autoExpireTickets()` helper, bypassing cooldown

---

## Resolvers

### Patient Resolver (`patient-resolver.js`)

Simple wrapper layer that proxies to core wrapper resolvers.

**Queries**:
- `getMyTickets` → `Wrapper.Query._getMyTickets`
- `getMyTicket` → `Wrapper.Query._getMyTicket`
- `getTicketMessages` → `Wrapper.Query._getTicketMessages`

**Mutations**:
- `createTicket` → `Wrapper.Mutation._createTicket`
- `sendPatientMessage` → `Wrapper.Mutation._sendPatientMessage`
- `closeMyTicket` → `Wrapper.Mutation._closeMyTicket`
- `extendSession` → `Wrapper.Mutation._extendSession`

### Medical Resolver (`medical-resolver.js`)

Adds permission layer before delegating to wrapper.

**Permission Types**:

1. **Location-based**: `isMedicalPermittedLocationBased(userId, permission, location)`
   - Used for: getPendingTickets, getActiveTickets, getAllTickets, getPatientConversations
   - Permission: `permissions.health_chat_allow_access`

2. **Patient-based**: `isMedicalPermittedPatientBased(userId, permission, patientId)`
   - Used for: All mutations and single-patient queries
   - Permission: `permissions.health_chat_allow_access`
   - Checks if staff can access that specific patient

3. **Admin-only**: `isMedicalAdmin(userId)`
   - Used for: takeoverOngoingTicket

**Query Flow Example**:
```javascript
getPendingTickets: async (_, { location='Both', offset, limit }, context) => {
  // 1. Check location-based permission
  const isPermitted = await isMedicalPermittedLocationBased(
    user.id,
    permissions.health_chat_allow_access,
    location
  );

  if (!isPermitted) {
    throw "Access denied";
  }

  // 2. Delegate to wrapper
  return await Wrapper.Query._getPendingTickets(...);
}
```

**Transfer Validation**:
```javascript
transferTicket: async (_, { chatId, toMedicalId }, context) => {
  // Check current staff has access
  const patientId = await getPatientIdFromChatId(chatId);
  const isPermitted = await isMedicalPermittedPatientBased(user.id, permission, patientId);

  // Check new staff has access too
  const isNewPermitted = await isMedicalPermittedPatientBased(toMedicalId, permission, patientId);

  if (!isPermitted || !isNewPermitted) {
    throw "Access denied";
  }

  return await Wrapper.Mutation._transferTicket(...);
}
```

### Wrapper Resolver (`wrapper.js`)

Core business logic with atomic transaction support.

**Key Implementation Details**:

1. **Transaction Pattern**:
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');

  // Multiple DB operations
  const result1 = await client.query(...);
  await client.query(...);

  await client.query('COMMIT');
  return formatChatRecord(result1.rows[0]);
} catch (error) {
  await client.query('ROLLBACK');
  throwGraphQLError(res).message("Failed").status(500).throw();
} finally {
  client.release();
}
```

2. **Auto-Expiry Integration**:
   - Called in all read operations to ensure data consistency
   - Mutation operations expire before status checks

3. **Real-time Emissions**:
   - `emitToRoom('healthchat:${chatId}', event, data)`: Notify room participants
   - `emitToRole('medical', event, data)`: Notify all medical staff
   - `notifyUser(userId, event, data)`: Direct user notification

---

## Security & Permissions

### Authentication

**JWT Protection**:
- Patient endpoint: `jwtProtect("patient")`
- Medical endpoint: `jwtProtect("medical")`

Both use `checkCredentialsStatus` middleware to ensure active accounts.

### Authorization Layers

#### 1. Patient Security
- Ownership verification: `verifyPatientOwnsChat(chatId, patientId)`
- Can only see/modify own tickets
- Cannot create multiple active tickets

#### 2. Medical Security

**Location-based Access**:
```javascript
// Staff can only see patients from their designated branch
const isPermitted = await isMedicalPermittedLocationBased(
  staffId,
  permissions.health_chat_allow_access,
  'Manila' // or 'QuezonCity' or 'Both'
);
```

**Patient-based Access**:
```javascript
// Staff can only access patients assigned to their branch
const patientId = await getPatientIdFromChatId(chatId);
const isPermitted = await isMedicalPermittedPatientBased(
  staffId,
  permissions.health_chat_allow_access,
  patientId
);
```

**Admin Override**:
```javascript
// _getMessages allows admin to view any ticket
const medicalId = rows[0].medicalId;
if (medicalId && medicalId !== user.id) {
  const isAdmin = await isMedicalAdmin(user.id);
  if (!isAdmin) {
    throw "FORBIDDEN. Ongoing process by other staff.";
  }
}
```

### Cross-Staff Protection

**Message Access**:
- Only assigned staff can send messages to a ticket
- Admins can view but not send to unassigned tickets (by design)

**Ticket Ownership**:
```javascript
if (medicalId && medicalId !== user.id) {
  throw "Unauthorized to send message in this chat";
}
```

### Transfer Security

**Triple Verification**:
1. Current staff must be assigned to ticket
2. New staff must exist in MedicalPersonnel table
3. New staff must be `is_active = true`
4. New staff must have permission for that patient's branch

---

## Real-time Features

### Socket Events

#### Emitted by Server

**healthchat:ticket-created**
```javascript
emitToRole('medical', 'healthchat:ticket-created', {
  chat: HealthChat
});
```

**healthchat:new-message**
```javascript
emitToRoom('healthchat:${chatId}', 'healthchat:new-message', {
  chatId: number,
  message: HealthChatPrompt,
  senderType: 'Patient' | 'Medical'
});

notifyUser(userId, 'healthchat:new-message', { ... });
```

**healthchat:ticket-closed**
```javascript
emitToRoom('healthchat:${chatId}', 'healthchat:ticket-closed', {
  chatId: number,
  closedBy: 'Patient' | 'Medical' | 'System',
  chat: HealthChat
});
```

**healthchat:ticket-approved**
```javascript
notifyUser(patientId, 'healthchat:ticket-approved', {
  chat: HealthChat
});
```

**healthchat:ticket-rejected**
```javascript
notifyUser(patientId, 'healthchat:ticket-rejected', {
  chat: HealthChat,
  reason: string
});
```

**healthchat:ticket-status-changed**
```javascript
emitToRole('medical', 'healthchat:ticket-status-changed', {
  chatId: number,
  status: ChatStatus,
  approvedBy?: number,
  rejectedBy?: number,
  reason?: string
});
```

**healthchat:ticket-transferred**
```javascript
notifyUser(patientId, 'healthchat:ticket-transferred', {
  chatId: number,
  newMedicalId: number,
  chat: HealthChat
});

notifyUser(newMedicalId, 'healthchat:ticket-transferred', { ... });
```

**healthchat:ticket-taken-over**
```javascript
notifyUser(patientId, 'healthchat:ticket-taken-over', {
  chatId: number,
  newMedicalId: number,
  chat: HealthChat
});
```

**healthchat:session-extended**
```javascript
emitToRoom('healthchat:${chatId}', 'healthchat:session-extended', {
  chatId: number,
  expiresAt: Date,
  extendedBy: 'Patient' | 'Medical',
  chat: HealthChat
});
```

### Room Management

**Room Naming**: `healthchat:${chatId}`

**Participants**:
- Patient
- Assigned medical staff
- Other medical staff can listen for global events via role emission

---

## Atomic Transactions

All mutations that perform multiple database operations now use PostgreSQL transactions to ensure data consistency.

### Why Transactions?

**Problem**: Without transactions, if any operation fails midway:
- Ticket status changes but no system message is recorded
- Messages deleted but ticket remains (orphaned data)
- Inconsistent audit trail

**Solution**: Atomic transactions ensure ALL operations succeed or ALL fail.

### Implementation Pattern

```javascript
const client = await pool.connect();
let result;

try {
  await client.query('BEGIN');

  // Operation 1: Update ticket
  const updateResult = await client.query(
    `UPDATE "HealthChat" SET status = 'Closed' WHERE id = $1 RETURNING *`,
    [chatId]
  );

  if (updateResult.rowCount === 0) {
    throw new Error("Ticket not found");
  }

  // Operation 2: Insert system message
  await client.query(
    `INSERT INTO "HealthChatPrompt" (consultationVirtualId, text, promptType, userType)
     VALUES ($1, 'Ticket closed.', 'system', 'Medical')`,
    [chatId]
  );

  await client.query('COMMIT');
  result = updateResult.rows[0];

} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release(); // Return connection to pool
}

return await formatChatRecord(result);
```

### Mutations Using Transactions

| Mutation | Operations | Isolation Benefit |
|----------|-----------|-------------------|
| `_closeMyTicket` | UPDATE status + INSERT system message | Ensures closure is logged |
| `_approveTicket` | UPDATE (assign staff, start session) + INSERT message | Ensures approval is logged |
| `_rejectTicket` | UPDATE status + INSERT message | Ensures rejection is logged |
| `_closeTicket` | UPDATE status + INSERT message | Ensures closure is logged |
| `_deleteArchivedTicket` | DELETE messages + DELETE ticket | **Prevents orphaned tickets** |
| `_transferTicket` | UPDATE medicalId + INSERT message | Ensures transfer is logged |
| `_takeoverOngoingTicket` | UPDATE medicalId + INSERT message | Ensures takeover is logged |
| `_extendSession` | UPDATE session_start + INSERT message | Ensures extension is logged |
| `autoExpireTickets` | UPDATE multiple tickets + INSERT messages for each | **Prevents partial expiry** |

### Critical Fix: autoExpireTickets

**Before** (BUGGY):
```javascript
// Update all expired tickets
const result = await db.query('UPDATE HealthChat SET status=Expired...');

// Loop and insert messages
for (const row of result.rows) {
  await db.query('INSERT INTO HealthChatPrompt...'); // ❌ Could fail partway
}
```

**After** (FIXED):
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');

  const result = await client.query('UPDATE HealthChat SET status=Expired...');

  for (const row of result.rows) {
    await client.query('INSERT INTO HealthChatPrompt...'); // ✅ All or nothing
  }

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK'); // Rollback ALL changes
  throw error;
} finally {
  client.release();
}
```

If ANY insert fails, ALL ticket updates are rolled back.

---

## Helper Functions

### Core Helpers (`helper.js`)

#### calculateExpiryDate(sessionStart)
Calculate expiry date from session start.

```javascript
calculateExpiryDate(sessionStart) => Date
```

**Logic**: `sessionStart + CHAT_EXPIRY_DAYS (3 days)`

---

#### isChatExpired(sessionStart)
Check if a chat has expired.

```javascript
isChatExpired(sessionStart) => boolean
```

**Logic**: `NOW() > calculateExpiryDate(sessionStart)`

---

#### verifyPatientOwnsChat(chatId, patientId)
Verify ownership of a ticket.

```javascript
verifyPatientOwnsChat(chatId, patientId) => Promise<boolean>
```

**Query**: `SELECT 1 FROM HealthChat WHERE id=? AND patientId=?`

---

#### checkChatStatus(chatId)
Check if chat is active.

```javascript
checkChatStatus(chatId) => Promise<{
  isActive: boolean,
  status: string
}>
```

**Logic**:
- Returns `false` if chat not found
- Returns `false` if status is Ongoing but expired by time
- Returns `true` if status is Open or Ongoing (and not expired)

---

#### formatChatRecord(chat)
Enrich chat record with participant info and calculated fields.

```javascript
formatChatRecord(chat) => Promise<HealthChat>
```

**Adds**:
- `patient`: ChatParticipant object
- `medical`: ChatParticipant object
- `closedBy`: Enum value
- `expiresAt`: Calculated expiry date
- `lastMessage`: Last message object
- `lastMessageAt`: Timestamp
- `unreadCount`: Unread message count

---

#### formatChatRecordsBatch(chats)
Batch-format multiple chat records to avoid N+1 queries.

```javascript
formatChatRecordsBatch(chats) => Promise<HealthChat[]>
```

**Optimizations**:
- Collects all unique userIds
- Fetches participants in 1 query: `getParticipantInfoBatch(userIds)`
- Fetches last messages in 1 query: `getLastMessageInfoBatch(chatIds)`
- Maps results to chat records

**Performance**: O(1) queries instead of O(n)

---

#### getParticipantInfo(userId)
Get user info for a single participant.

```javascript
getParticipantInfo(userId) => Promise<ChatParticipant>
```

**Query**:
```sql
SELECT uc.id, up.first_name, up.last_name, uc.email, up.identifier,
       p.profile, up.branch, up.date_of_birth, up.sex
FROM UserCredentials uc
LEFT JOIN UsersPersonal up ON up.id = uc.id
LEFT JOIN Patients p ON p.id = uc.id
WHERE uc.id = $1
```

---

#### getParticipantInfoBatch(userIds)
Batch-fetch participant info.

```javascript
getParticipantInfoBatch(userIds) => Promise<Map<userId, ChatParticipant>>
```

**Query**: Same as above but with `WHERE uc.id = ANY($1)`

---

#### getLastMessageInfo(chatId)
Get last message and unread count for a chat.

```javascript
getLastMessageInfo(chatId) => Promise<{
  lastMessage: HealthChatPrompt,
  lastMessageAt: Date,
  unreadCount: number
}>
```

**Unread Logic**:
```sql
-- Count Patient messages after the last Medical message
SELECT COUNT(*) FROM HealthChatPrompt
WHERE consultationVirtualId = $1
  AND userType = 'Patient'
  AND stamp > COALESCE(
    (SELECT MAX(stamp) FROM HealthChatPrompt
     WHERE consultationVirtualId = $1 AND userType = 'Medical'),
    '1970-01-01'
  )
```

---

#### getLastMessageInfoBatch(chatIds)
Batch-fetch last messages for multiple chats.

```javascript
getLastMessageInfoBatch(chatIds) => Promise<Map<chatId, MessageInfo>>
```

**Optimizations**:
- Uses `DISTINCT ON (consultationVirtualId)` for last messages
- Single query for all unread counts
- Single batch query for sender info

---

#### autoExpireTickets(patientId?)
Automatically expire tickets with no activity for 3 days.

```javascript
autoExpireTickets(patientId = null) => Promise<number>
```

**Parameters**:
- `patientId`: Optional. If provided, only expires that patient's tickets

**Cooldown**: 30 seconds (skipped if patientId provided)

**Logic**:
```sql
UPDATE HealthChat
SET status = 'Expired',
    session_end = NOW(),
    closed_by_type = 'System'
WHERE status = 'Ongoing'
  AND (SELECT MAX(stamp) FROM HealthChatPrompt WHERE consultationVirtualId = HealthChat.id)
      < NOW() - INTERVAL '3 days'
```

**Returns**: Number of tickets expired

**Transaction Safety**: Wrapped in BEGIN/COMMIT to ensure all system messages are inserted

---

#### hasActiveTicket(patientId)
Check if patient has any active ticket.

```javascript
hasActiveTicket(patientId) => Promise<boolean>
```

**Logic**:
1. Auto-expires patient's tickets first
2. Checks for any Open or Ongoing tickets

---

#### formatMessage(message)
Enrich message with sender info.

```javascript
formatMessage(message) => Promise<HealthChatPrompt>
```

**Adds**: `sender` field with ChatParticipant object

---

#### getPatientIdFromChatId(chatId)
Get patient ID from a chat ID.

```javascript
getPatientIdFromChatId(chatId) => Promise<number | null>
```

**Used by**: Medical resolver for permission checks

---

## Bug Fixes & Improvements

### 1. ✅ autoExpireTickets Atomic Transaction (CRITICAL)

**Issue**: If any system message insert failed, some tickets would be marked expired without messages, creating inconsistent audit trail.

**Fix**: Wrapped entire operation in transaction.

**Impact**: HIGH - Prevents data corruption

**File**: `helper.js:362-416`

---

### 2. ✅ _deleteArchivedTicket Data Loss Prevention (CRITICAL)

**Issue**:
```javascript
await db.query('DELETE FROM HealthChatPrompt...'); // ✅ Success
await db.query('DELETE FROM HealthChat...');       // ❌ Fails
// Result: All messages deleted, ticket remains orphaned
```

**Fix**: Wrapped in transaction so both DELETEs succeed or both fail.

**Impact**: HIGH - Prevents permanent data loss

**File**: `wrapper.js:1030-1052`

---

### 3. ✅ _transferTicket Validation Bug (HIGH)

**Issue**: No verification that `newMedicalId` exists or is active.

**Code**:
```javascript
// BEFORE: Only checked if different from current
if (Number(newMedicalId) === Number(user.id)) {
  throw "New medical staff must be different from current";
}

// AFTER: Added verification
const newStaffCheck = await db.query(
  `SELECT id, is_active FROM MedicalPersonnel WHERE id = $1`,
  [newMedicalId]
);

if (newStaffCheck.rowCount === 0) {
  throw "New medical staff not found";
}

if (!newStaffCheck.rows[0].is_active) {
  throw "New medical staff is not active";
}
```

**Impact**: MEDIUM - Prevents assignment to invalid/inactive staff

**File**: `wrapper.js:1077-1092`

---

### 4. ✅ _sendPatientMessage Race Condition (MEDIUM)

**Issue**:
```javascript
// Insert message first
await db.query('INSERT INTO HealthChatPrompt...');

// Then fetch medicalId
const chatInfo = await db.query('SELECT medicalId FROM HealthChat...');
// ❌ If chat deleted between these, query fails but message already inserted
```

**Fix**: Fetch medicalId BEFORE inserting message.

```javascript
// Verify ownership AND fetch medicalId in one query
const chatCheck = await db.query(
  `SELECT "medicalId" FROM "HealthChat" WHERE id = $1 AND "patientId" = $2`,
  [chatId, user.id]
);

const medicalId = chatCheck.rows[0].medicalId;

// Now insert message with fetched medicalId
await db.query('INSERT INTO HealthChatPrompt...');

// Use the already-fetched medicalId
if (medicalId) {
  notifyUser(String(medicalId), ...);
}
```

**Impact**: MEDIUM - Eliminates edge case failures

**File**: `wrapper.js:585-638`

---

### 5. ✅ All Mutations Now Transactional

**Mutations Fixed**:
- `_closeMyTicket`
- `_approveTicket`
- `_rejectTicket`
- `_closeTicket`
- `_transferTicket`
- `_takeoverOngoingTicket`
- `_extendSession`

**Benefit**: Ensures data consistency and complete audit trails

**Pattern Applied**:
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... operations ...
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

---

### 6. ✅ _sendMedicalMessage Query Optimization

**Issue**: Redundant query for patientId.

```javascript
// BEFORE
const chatResult = await db.query('SELECT medicalId, patientId...');
// ... insert message ...
const patientId = chatResult.rows[0].patientId; // Already fetched above

// AFTER
const { medicalId, patientId } = chatResult.rows[0];
// ... insert message ...
if (patientId) {
  notifyUser(String(patientId), ...);
}
```

**Impact**: LOW - Minor performance improvement

**File**: `wrapper.js:901, 934`

---

## Usage Examples

### Patient Flow: Create and Close Ticket

```graphql
# 1. Create a ticket
mutation {
  createTicket(input: {
    purpose: "I have a persistent headache for 3 days"
    notes: "It gets worse in the evening"
  }) {
    success
    chat {
      id
      status
      purpose
    }
    message
  }
}

# Response:
# {
#   "success": true,
#   "chat": {
#     "id": "123",
#     "status": "Open",
#     "purpose": "I have a persistent headache for 3 days"
#   },
#   "message": "Ticket created successfully. Please wait for staff approval."
# }

# 2. Get my tickets
query {
  getMyTickets(status: Open, limit: 10) {
    chats {
      id
      status
      purpose
      expiresAt
      lastMessage {
        text
        userType
      }
    }
    total
  }
}

# 3. Send a message (after approval)
mutation {
  sendPatientMessage(input: {
    chatId: "123"
    text: "The headache is on the right side of my head"
    promptType: text
  }) {
    success
    message {
      id
      text
      stamp
    }
  }
}

# 4. Close ticket when done
mutation {
  closeMyTicket(chatId: "123") {
    success
    chat {
      status
      closedBy
    }
    message
  }
}
```

### Medical Flow: Approve and Respond

```graphql
# 1. Get pending tickets
query {
  getPendingTickets(location: Manila, limit: 10) {
    chats {
      id
      purpose
      notes
      patient {
        firstName
        lastName
        branch
      }
    }
    total
  }
}

# 2. Approve a ticket
mutation {
  approveTicket(input: {
    chatId: "123"
    notes: "Will assess headache symptoms"
  }) {
    success
    chat {
      status
      session_start
      expiresAt
      medical {
        firstName
        lastName
      }
    }
  }
}

# 3. Send a message
mutation {
  sendMedicalMessage(input: {
    chatId: "123"
    text: "Hello, I see you've been experiencing headaches. Can you rate the pain from 1-10?"
    promptType: text
  }) {
    success
    message {
      text
      stamp
    }
  }
}

# 4. Get all messages in chat
query {
  getMessages(chatId: "123", limit: 50) {
    id
    text
    userType
    stamp
    sender {
      firstName
      lastName
    }
  }
}

# 5. Close when resolved
mutation {
  closeTicket(input: {
    chatId: "123"
    notes: "Advised rest and hydration. Follow-up if persists."
  }) {
    success
    chat {
      status
      closedBy
    }
  }
}
```

### Advanced: Patient Conversations View

```graphql
# Get Messenger-style conversation list
query {
  getPatientConversations(
    location: Both
    statuses: [Open, Ongoing]
    limit: 20
  ) {
    conversations {
      patientId
      patient {
        firstName
        lastName
        identifier
      }
      latestTicket {
        id
        status
        purpose
      }
      lastMessage {
        text
        userType
        stamp
      }
      unreadCount
      activeTicketCount
      totalTicketCount
    }
    total
  }
}

# Get all messages for a patient (across all tickets)
query {
  getPatientMessages(
    patientId: 456
    limit: 50
  ) {
    id
    text
    userType
    stamp
    consultationVirtualId
    sender {
      firstName
    }
  }
}
```

### Admin: Transfer and Takeover

```graphql
# Transfer ticket to another staff member
mutation {
  transferTicket(
    chatId: "123"
    toMedicalId: 789
  ) {
    success
    chat {
      medicalId
      medical {
        firstName
        lastName
      }
    }
  }
}

# Admin forcefully takes over a ticket
mutation {
  takeoverOngoingTicket(chatId: "123") {
    success
    chat {
      medicalId
      medical {
        firstName
        lastName
      }
    }
    message
  }
}
```

### Session Extension

```graphql
# Patient or staff can extend session
mutation {
  extendSession(chatId: "123") {
    success
    chat {
      expiresAt
    }
    message
  }
}

# Response:
# {
#   "success": true,
#   "chat": {
#     "expiresAt": "2026-04-08T10:30:00Z"  # Extended by 1 day
#   },
#   "message": "Session extended by 1 day."
# }
```

---

## Configuration

### Environment Variables

None specific to Health Chat. Uses global database and JWT configs.

### Constants

**File**: `helper.js`

```javascript
CHAT_EXPIRY_DAYS = 3  // Session expiry duration
AUTO_EXPIRE_COOLDOWN_MS = 30000  // 30 seconds cooldown for auto-expiry
```

---

## Testing Checklist

### Patient Tests
- [ ] Create ticket when no active ticket exists
- [ ] Fail to create ticket when already has active ticket
- [ ] Send message to own ticket
- [ ] Fail to send message to others' ticket
- [ ] Close own ticket
- [ ] Extend session within 48 hours of expiry
- [ ] Fail to extend session when >48 hours from expiry

### Medical Tests
- [ ] View pending tickets filtered by location
- [ ] Approve pending ticket
- [ ] Reject pending ticket with reason
- [ ] Send message to assigned ticket
- [ ] Fail to send message to unassigned ticket (non-admin)
- [ ] Close ticket with notes
- [ ] Transfer ticket to valid, active staff
- [ ] Fail to transfer to invalid/inactive staff
- [ ] Admin takeover of any ongoing ticket
- [ ] Extend session (medical side)

### Transaction Tests
- [ ] Simulate DB failure during closeTicket → verify rollback
- [ ] Simulate DB failure during deleteArchivedTicket → verify no orphaned data
- [ ] Simulate failure in autoExpireTickets → verify no partial updates

### Real-time Tests
- [ ] Patient receives notification when ticket approved
- [ ] Staff receives notification when new ticket created
- [ ] Both parties receive message in real-time
- [ ] Offline user receives notification on reconnect

---

## Performance Considerations

### N+1 Query Prevention

**Problem**: Fetching 20 chats, each needing patient/medical info = 40+ queries

**Solution**: Batch functions
- `formatChatRecordsBatch()` - Fetches all participants in 2 queries
- `getParticipantInfoBatch()` - Single query with `ANY($1)`
- `getLastMessageInfoBatch()` - Uses `DISTINCT ON` for efficiency

### Auto-Expiry Cooldown

**Problem**: Every query triggering expiry check = excessive DB load

**Solution**: 30-second cooldown
```javascript
let _lastAutoExpireRun = 0;
if (now - _lastAutoExpireRun < 30000) {
  return 0; // Skip
}
```

### Pagination

All list queries support:
- `offset`: Starting position
- `limit`: Results per page
- Returns `total` count for UI pagination

---

## Future Enhancements

### Potential Features

1. **Read Receipts**: Track when messages are read
2. **Typing Indicators**: Show when other party is typing
3. **Message Editing**: Allow editing sent messages (with history)
4. **Message Reactions**: Like/emoji reactions to messages
5. **Voice Messages**: Support audio file uploads
6. **Chat Templates**: Predefined response templates for staff
7. **AI Triage**: Auto-categorize tickets by urgency
8. **Multi-language**: Support for different languages
9. **Video Consultation**: Integrate video chat for sessions
10. **Analytics Dashboard**: Track response times, resolution rates

### Optimization Opportunities

1. **Redis Caching**: Cache active tickets to reduce DB queries
2. **Message Pagination**: Infinite scroll instead of offset-based
3. **Connection Pooling**: Tune PostgreSQL pool size for concurrency
4. **Archive Old Chats**: Move closed tickets older than 6 months to archive table
5. **Search**: Full-text search across messages

---

## Troubleshooting

### Common Issues

#### "You already have an active ticket"

**Cause**: Patient trying to create ticket when one already exists with status Open or Ongoing

**Solution**: Wait for current ticket to be closed/expired, or close it manually

---

#### "FORBIDDEN. Ongoing process by other staff"

**Cause**: Non-admin staff trying to view messages in ticket assigned to another staff member

**Solution**:
- Use transfer feature to reassign
- Or contact admin for takeover

---

#### "Session has already expired"

**Cause**: Trying to extend a session that already passed its expiry date

**Solution**: Session cannot be extended after expiry. Create a new ticket.

---

#### "Access denied" (Medical)

**Cause**: Staff trying to access patient from different branch

**Solution**: Verify `location` parameter matches staff's assigned branch or use `Both`

---

#### Messages not appearing in real-time

**Cause**: WebSocket connection issue

**Solution**:
1. Check socket connection status
2. Verify user is in correct room: `healthchat:${chatId}`
3. Check network/firewall blocking WebSocket traffic

---

## Related Documentation

- [NOTIFICATIONS_SYSTEM.md](./NOTIFICATIONS_SYSTEM.md) - Socket notification architecture
- [sockets.md](./sockets.md) - WebSocket implementation details
- [SECURITY.md](./SECURITY.md) - Security best practices
- [role-management.md](./role-management.md) - Permission system

---

## Changelog

### Version 2.0 (April 2026)
- ✅ Added atomic transactions to all mutations
- ✅ Fixed autoExpireTickets race condition
- ✅ Fixed deleteArchivedTicket data loss bug
- ✅ Added validation for transferTicket (verify new staff exists & active)
- ✅ Fixed race condition in sendPatientMessage
- ✅ Optimized sendMedicalMessage query
- ✅ Added comprehensive documentation

### Version 1.5
- Added patient conversations view (Messenger-style)
- Added session extension feature
- Added batch formatting for performance
- Added location-based filtering

### Version 1.0
- Initial implementation
- Basic ticket creation and messaging
- Auto-expiry system
- Real-time notifications

---

**Last Updated**: April 4, 2026
**Maintained by**: Development Team
**Status**: ✅ Production Ready
