# Role Management System Documentation

## Overview

The role management system handles staff permissions and account status in the MDSystem. It uses a key-based permission model where each permission key maps to true/false based on database records.

---

## Database Schema

### Tables Involved

**UserCredentials**
- `id` - User ID (primary key)
- `email` - User email
- `identity` - User type: `'Medical'` (active staff), `'Employee'` (suspended staff), `'Student'`
- `credentials_status` - Account status: `'Active'`, `'Suspended'`, `'Pending'`

**UsersPersonal**
- `id` - User ID
- `first_name`, `middle_name`, `last_name` - Name fields

**MedicalPersonnel**
- `id` - User ID (one-to-one with UserCredentials)
- `role` - Staff role: `'Doctor'`, `'Nurse'`, `'Admin'`, `'Pharmacist'`, `'Dentist'`, `'Staff'`
- `title` - Job title (e.g., "Senior Medical Officer")
- `designation` - Branch/location: `'Manila'`, `'QuezonCity'`, `'Both'`
- `is_active` - Boolean indicating if personnel record is active

**rolesTable**
- `id` - Role ID (primary key)
- `label` - Permission label (e.g., `'IS_ADMIN'`, `'IS_STAFF'`, `'ALLOW_TO_VIEW_EMR'`)

**rolesMap**
- `personnelId` - User ID (foreign key to UserCredentials)
- `rolesId` - Role ID (foreign key to rolesTable)
- `branch` - Branch assignment: `'Manila'`, `'QuezonCity'`, `'Both'`
- `assignedBy` - ID of admin who assigned this role

---

## Permission Keys

All available permission keys are defined in `Backend/services/permit.js`:

```javascript
permissions = {
  // System & Admin
  is_admin: "IS_ADMIN",
  is_staff: "IS_STAFF",
  privileged_to_perform_on_superior: "PRIVILEGED_TO_PERFORM_ON_SUPERIOR",

  // EMR (Electronic Medical Record)
  emr_allow_approval: "ALLOW_TO_APPROVE_EMR",
  emr_allow_edit: "ALLOW_TO_EDIT_EMR",
  emr_allow_view: "ALLOW_TO_VIEW_EMR",
  emr_allow_set_dental_record: "ALLOW_TO_SET_DENTAL_RECORD",
  emr_allow_edit_catalogs: "ALLOW_TO_EDIT_CATALOGS",

  // Profile
  profile_allow_approval: "ALLOW_TO_APPROVE_PROFILE",
  profile_allow_view: "ALLOW_TO_VIEW_PROFILE",
  profile_allow_edit: "ALLOW_TO_EDIT_PROFILE",
  profile_allow_update_email_identifier: "ALLOW_TO_UPDATE_EMAIL_IDENTIFIER",

  // Appointments
  appointment_allow_approval: "ALLOW_TO_APPROVE_APPOINTMENT",
  appointment_allow_view_records: "ALLOW_TO_VIEW_APPOINTMENT",
  appointment_allow_view_configuration: "ALLOW_TO_VIEW_APPOINTMENT_CONFIGURATION",
  appointment_allow_edit_configuration: "ALLOW_TO_EDIT_APPOINTMENT_CONFIGURATION",

  // Announcements
  announcement_allow_crud: "ALLOW_TO_CRUD_ANNOUNCEMENT",

  // Consultation
  consultation_allow_view: "ALLOW_TO_VIEW_CONSULTATION",
  consultation_allow_edit: "ALLOW_TO_EDIT_CONSULTATION",

  // Inventory & Medicine
  inventory_allow_view: "ALLOW_TO_VIEW_INVENTORY",
  inventory_allow_dispense: "ALLOW_TO_DISPENSE_MEDICINE",
  inventory_allow_edit: "ALLOW_TO_EDIT_INVENTORY",
  inventory_allow_manage_requests: "ALLOW_TO_MANAGE_MEDICINE_REQUESTS",
  inventory_allow_prescribe: "ALLOW_TO_PRESCRIBE",
  medicine_request_allow_approve: "ALLOW_TO_APPROVE_MEDICINE_REQUEST",
}
```

---

## Core Functions (Backend/services/permit.js)

### getStaffPermissions(personnelId)

Retrieves all permission keys with true/false values for a staff member.

**Input:**
- `personnelId` (number) - User ID

**Output:**
```javascript
{
  is_admin: false,
  is_staff: true,
  privileged_to_perform_on_superior: false,
  emr_allow_approval: true,
  emr_allow_edit: false,
  emr_allow_view: true,
  emr_allow_set_dental_record: false,
  emr_allow_edit_catalogs: false,
  profile_allow_approval: true,
  profile_allow_view: true,
  profile_allow_edit: false,
  profile_allow_update_email_identifier: false,
  appointment_allow_approval: false,
  appointment_allow_view_records: true,
  appointment_allow_view_configuration: false,
  appointment_allow_edit_configuration: false,
  announcement_allow_crud: false,
  consultation_allow_view: true,
  consultation_allow_edit: false,
  inventory_allow_view: true,
  inventory_allow_dispense: false,
  inventory_allow_edit: false,
  inventory_allow_manage_requests: false,
  inventory_allow_prescribe: false,
  medicine_request_allow_approve: false
}
```

**Example:**
```javascript
const perms = await getStaffPermissions(123);
console.log(perms.is_admin); // false
console.log(perms.emr_allow_view); // true
```

---

### setStaffPermissions({ personnelId, permissionsMap, assignedBy, branch })

Sets permissions for a staff member. `true` inserts/updates a row, `false` deletes the row.

**Input:**
```javascript
{
  personnelId: 123,              // User ID (number or string)
  permissionsMap: {              // Object with permission keys
    is_admin: true,              // Will INSERT/UPDATE row
    emr_allow_edit: false,       // Will DELETE row
    emr_allow_view: true,        // Will INSERT/UPDATE row
    // Only include keys you want to change
  },
  assignedBy: 456,               // Admin user ID who made the change
  branch: 'Manila'               // Optional: 'Manila' | 'QuezonCity' | 'Both' (default: 'Both')
}
```

**Output:**
```javascript
{
  inserted: ['IS_ADMIN', 'ALLOW_TO_VIEW_EMR'],  // Labels that were inserted
  deleted: ['ALLOW_TO_EDIT_EMR']                // Labels that were deleted
}
```

**Example:**
```javascript
await setStaffPermissions({
  personnelId: 123,
  permissionsMap: {
    is_admin: true,              // Grant admin
    is_staff: true,              // Grant staff access
    emr_allow_edit: false,       // Revoke EMR edit
    consultation_allow_view: true // Grant consultation view
  },
  assignedBy: 456,
  branch: 'Manila'
});
```

**Behavior:**
- Keys set to `true` → permission row is inserted (or updated if exists)
- Keys set to `false` → permission row is deleted
- Keys not in the map → left unchanged
- Invalid keys → throws error

---

## GraphQL Role Management API

The primary role management operations are now served via GraphQL at the `/rolemanagement/admin` endpoint. This provides a unified schema for staff accounts, medical personnel, permissions, and session management.

### GraphQL Endpoint

```
POST /rolemanagement/admin
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Architecture

The GraphQL implementation follows a three-layer pattern:

```
graphql.js                      # Entry point - mounts endpoint, applies JWT middleware
  └─► admin-resolver.js         # Permission layer - enforces IS_ADMIN check
        └─► wrapper.js          # Business logic - database queries, Redis operations
```

**Files:**
- `Backend/routes/rolemanagement/graphql.js` - GraphQL entry point
- `Backend/routes/rolemanagement/schema.graphql` - Type definitions
- `Backend/routes/rolemanagement/resolvers/admin/admin-resolver.js` - Admin permission checks
- `Backend/routes/rolemanagement/resolvers/wrapper/wrapper.js` - Core business logic

**Security:**
- All mutations require Medical identity (`jwtProtect('medical')`)
- All operations require `IS_ADMIN` permission (enforced in admin-resolver)
- Session management operations are admin-only for security

**Implementation Status:** ✅ All resolvers are fully implemented and wired up in the GraphQL endpoint.

### Available Queries

| Query | Description |
|-------|-------------|
| `listStaffAccounts(status, location)` | Get all staff accounts with permissions |
| `getStaffAccount(userId)` | Get single staff account |
| `listMedicalPersonnel(role, designation, isActive)` | Get all medical personnel |
| `getMedicalPersonnel(userId)` | Get single medical personnel |
| `getStaffPermissions(userId)` | Get permissions for a user |
| `listStaffSessions(userId)` | Get all active sessions for a user |

### Available Mutations

| Mutation | Description |
|----------|-------------|
| `updateStaffAccount(userId, input)` | **High-level**: Update permissions + status (changes identity) |
| `createMedicalPersonnel(input)` | Create medical personnel record |
| `updateMedicalPersonnel(userId, input)` | Update medical personnel |
| `deleteMedicalPersonnel(userId, revertIdentity)` | Delete medical personnel |
| `setStaffPermissions(userId, permissions, branch)` | **Low-level**: Set permissions only (no identity change) |
| `rotateStaffAnchor(userId)` | Logout all devices for a user |

---

## Understanding Permission Mutations

### `updateStaffAccount` vs `setStaffPermissions`

The system provides two mutations for managing permissions. Understanding when to use each is important:

#### **`updateStaffAccount` - Complete Account Management (Recommended)**

This is the **primary mutation** for managing staff accounts. Use this for normal operations.

**What it does:**
- Updates permissions AND account status together
- Validates MedicalPersonnel record exists
- Always ensures `is_staff: true`
- **Changes identity based on status:**
  - `status: 'Active'` → sets `identity = 'Medical'` (grants access)
  - `status: 'Suspended'` → sets `identity = 'Employee'` (blocks access)
- Prevents self-suspension (admins can't suspend themselves)
- Pulls branch from `MedicalPersonnel.designation` automatically

**When to use:**
- Activating a new staff account
- Suspending/unsuspending a staff member
- Changing permissions + managing account status
- Any normal admin operation on staff accounts

**Example:**
```graphql
mutation {
  updateStaffAccount(userId: "123", input: {
    permissions: {
      is_admin: true
      emr_allow_view: true
      emr_allow_edit: true
    }
    status: Active  # Also updates identity to 'Medical'
  }) {
    ok
    message
  }
}
```

---

#### **`setStaffPermissions` - Direct Permission Setter (Advanced)**

This is a **low-level operation** that directly modifies permissions without touching account status or identity.

**What it does:**
- ONLY sets permissions - nothing else
- Does NOT change identity field
- Does NOT validate MedicalPersonnel record
- Does NOT manage account status
- Requires explicit branch parameter
- No safeguards (no self-suspension check)

**When to use:**
- Quick permission adjustments without status changes
- Scripted/automated permission updates
- Bulk operations
- When you need to specify branch explicitly
- Advanced scenarios where you need precise control

**Important:** If you use this to grant permissions while identity is 'Employee', the user still won't be able to access the system because the `jwtProtect('medical')` middleware blocks non-Medical identities.

**Example:**
```graphql
mutation {
  setStaffPermissions(
    userId: "123"
    permissions: {
      emr_allow_edit: false
      consultation_allow_view: true
    }
    branch: Manila  # Must specify branch
  ) {
    ok
    message
  }
}
```

---

**Rule of thumb:** Use `updateStaffAccount` for all normal admin operations. Only use `setStaffPermissions` when you specifically need direct permission control without status management.

---

## GraphQL Query Examples

### List Staff Accounts

```graphql
query {
  listStaffAccounts(status: Active, location: Manila) {
    staff {
      id
      email
      name
      branch
      identity
      status
      credentialsStatus
      lastLogin
      permissions {
        is_admin
        is_staff
        emr_allow_view
        emr_allow_edit
        consultation_allow_view
        inventory_allow_edit
      }
    }
    count
  }
}
```

### Get Single Staff Account

```graphql
query {
  getStaffAccount(userId: "123") {
    id
    email
    name
    branch
    identity
    status
    permissions {
      is_admin
      emr_allow_view
      emr_allow_edit
      profile_allow_view
      appointment_allow_approval
    }
  }
}
```

### List Medical Personnel

```graphql
query {
  listMedicalPersonnel(role: Doctor, designation: Manila, isActive: true) {
    personnel {
      id
      role
      title
      designation
      isActive
      user {
        email
        name
        identity
        credentialsStatus
      }
    }
    count
  }
}
```

### Update Staff Account

```graphql
mutation {
  updateStaffAccount(userId: "123", input: {
    permissions: {
      is_admin: true
      emr_allow_view: true
      emr_allow_edit: false
      consultation_allow_view: true
    }
    status: Active
  }) {
    ok
    message
  }
}
```

### Create Medical Personnel

```graphql
mutation {
  createMedicalPersonnel(input: {
    userId: "123"
    title: "Senior Doctor"
    role: Doctor
    designation: Manila
  }) {
    ok
    message
    personnel {
      id
      role
      title
      designation
      isActive
    }
  }
}
```

### Update Medical Personnel

```graphql
mutation {
  updateMedicalPersonnel(userId: "123", input: {
    title: "Chief Medical Officer"
    designation: Both
    isActive: true
  }) {
    ok
    message
    personnel {
      id
      role
      title
      designation
      isActive
    }
  }
}
```

### Delete Medical Personnel

```graphql
mutation {
  deleteMedicalPersonnel(userId: "123", revertIdentity: true) {
    ok
    message
    identityReverted
  }
}
```

### List Staff Sessions

```graphql
query {
  listStaffSessions(userId: "123") {
    sessions {
      deviceId
      status
      createdAt
      updatedAt
      isCurrent
    }
    count
    currentAnchor
  }
}
```

**Response:**
```json
{
  "data": {
    "listStaffSessions": {
      "sessions": [
        {
          "deviceId": "550e8400-e29b-41d4-a716-446655440000",
          "status": "active",
          "createdAt": "2026-03-23T10:15:30.000Z",
          "updatedAt": "2026-03-23T14:25:10.000Z",
          "isCurrent": true
        },
        {
          "deviceId": "660e8400-e29b-41d4-a716-446655440001",
          "status": "active",
          "createdAt": "2026-03-22T08:30:15.000Z",
          "updatedAt": "2026-03-23T09:10:20.000Z",
          "isCurrent": false
        }
      ],
      "count": 2,
      "currentAnchor": "770e8400-e29b-41d4-a716-446655440002"
    }
  }
}
```

### Rotate Staff Anchor (Logout All Devices)

```graphql
mutation {
  rotateStaffAnchor(userId: "123") {
    ok
    message
    sessionsInvalidated
  }
}
```

**Response:**
```json
{
  "data": {
    "rotateStaffAnchor": {
      "ok": true,
      "message": "Staff anchor rotated successfully. All devices have been logged out.",
      "sessionsInvalidated": 2
    }
  }
}
```

---

## REST MedicalPersonnel Management API (Backend/routes/staff/rolemanagement.js)

> **Note:** The REST endpoints below remain available for backwards compatibility, but the GraphQL API above is preferred for new integrations.

The MedicalPersonnel table stores supplementary staff information including role, title, designation (branch), and active status. These endpoints enable the complete Employee → Medical staff conversion workflow.

### POST /admin/staff/medical-personnel

Create a new MedicalPersonnel record for an Employee user.

**Authentication:** Requires Medical identity with `IS_ADMIN` permission

**Request Body:**
```javascript
{
  "userId": 123,              // Required: User ID (must have identity='Employee')
  "title": "Senior Doctor",   // Required: Job title
  "role": "Doctor",           // Required: Staff role
  "designation": "Manila"     // Required: Branch assignment
}
```

**Validation:**
- All fields required
- `designation` must be: `'Manila'`, `'QuezonCity'`, or `'Both'`
- `role` must be: `'Doctor'`, `'Nurse'`, `'Admin'`, `'Pharmacist'`, `'Dentist'`, or `'Staff'`
- User must exist and have identity='Employee'
- No existing MedicalPersonnel record (prevents duplicates)

**Response (201 Created):**
```javascript
{
  "ok": true,
  "message": "MedicalPersonnel record created successfully.",
  "personnel": {
    "id": 123,
    "userId": 123,
    "role": "Doctor",
    "title": "Senior Doctor",
    "designation": "Manila",
    "is_active": true
  }
}
```

**Error Responses:**
- `400 MISSING_FIELDS` - Missing required fields
- `400 INVALID_DESIGNATION` - Invalid designation value
- `400 INVALID_ROLE` - Invalid role value
- `403 FORBIDDEN` - Not admin
- `404 USER_NOT_FOUND` - User doesn't exist
- `409 INVALID_IDENTITY` - User is not Employee
- `409 RECORD_EXISTS` - MedicalPersonnel already exists
- `500 INTERNAL_ERROR` - Server error

---

### GET /admin/staff/medical-personnel

Retrieve all MedicalPersonnel records with optional filters.

**Authentication:** Requires Medical identity with `IS_ADMIN` permission

**Query Parameters:**
- `role` (optional) - Filter by role
- `designation` (optional) - Filter by designation
- `is_active` (optional) - Filter by active status (true/false)

**Request Example:**
```http
GET /admin/staff/medical-personnel?role=Doctor&designation=Manila
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```javascript
{
  "ok": true,
  "personnel": [
    {
      "id": 123,
      "role": "Doctor",
      "title": "Senior Doctor",
      "designation": "Manila",
      "is_active": true,
      "user": {
        "email": "doctor@tip.edu.ph",
        "identity": "Medical",
        "credentials_status": "Active",
        "name": "Juan D. Cruz"
      }
    }
    // ... more records
  ],
  "count": 15
}
```

---

### GET /admin/staff/medical-personnel/:userId

Retrieve a single MedicalPersonnel record.

**Authentication:** Requires Medical identity with `IS_ADMIN` permission

**Request Example:**
```http
GET /admin/staff/medical-personnel/123
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```javascript
{
  "ok": true,
  "personnel": {
    "id": 123,
    "role": "Doctor",
    "title": "Senior Doctor",
    "designation": "Manila",
    "is_active": true,
    "user": {
      "email": "doctor@tip.edu.ph",
      "identity": "Medical",
      "credentials_status": "Active",
      "name": "Juan D. Cruz"
    }
  }
}
```

**Error Responses:**
- `403 FORBIDDEN` - Not admin
- `404 RECORD_NOT_FOUND` - MedicalPersonnel not found
- `500 INTERNAL_ERROR` - Server error

---

### PUT /admin/staff/medical-personnel/:userId

Update an existing MedicalPersonnel record (title, designation, is_active).

**Authentication:** Requires Medical identity with `IS_ADMIN` permission

**Request Body (all optional, at least one required):**
```javascript
{
  "title": "Chief Medical Officer",  // Optional: Update job title
  "designation": "Both",             // Optional: Update branch assignment
  "is_active": true                  // Optional: Update active status
}
```

**Note:** `role` field is immutable and cannot be updated. Changing roles requires DELETE + POST.

**Response (200 OK):**
```javascript
{
  "ok": true,
  "message": "MedicalPersonnel record updated successfully.",
  "personnel": {
    "id": 123,
    "role": "Doctor",
    "title": "Chief Medical Officer",
    "designation": "Both",
    "is_active": true
  }
}
```

**Error Responses:**
- `400 MISSING_FIELDS` - No fields provided
- `400 INVALID_DESIGNATION` - Invalid designation value
- `403 FORBIDDEN` - Not admin
- `404 RECORD_NOT_FOUND` - MedicalPersonnel not found
- `500 INTERNAL_ERROR` - Server error

---

### DELETE /admin/staff/medical-personnel/:userId

Remove a MedicalPersonnel record and optionally revert user identity.

**Authentication:** Requires Medical identity with `IS_ADMIN` permission

**Query Parameters:**
- `revertIdentity` (optional, default: true) - Revert identity from 'Medical' to 'Employee'

**Request Example:**
```http
DELETE /admin/staff/medical-personnel/123?revertIdentity=true
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```javascript
{
  "ok": true,
  "message": "MedicalPersonnel record deleted successfully.",
  "identityReverted": true  // true if identity was changed to 'Employee'
}
```

**Error Responses:**
- `403 FORBIDDEN` - Not admin
- `404 RECORD_NOT_FOUND` - MedicalPersonnel not found
- `500 INTERNAL_ERROR` - Server error

---

## Staff Account Management API (Backend/routes/staff/rolemanagement.js)

### GET /admin/staff/accounts

Get all staff accounts with their permissions and details.

**Authentication:** Requires Medical identity with `IS_ADMIN` permission

**Query Parameters:**
- `status` (optional) - Filter by credentials_status: `'Active'`, `'Suspended'`, `'Pending'`
- `location` (optional) - Filter by MedicalPersonnel.designation: `'Manila'`, `'QuezonCity'`, `'Both'`

**Request Example:**
```http
GET /admin/staff/accounts?status=Active&location=Manila
Authorization: Bearer <jwt-token>
```

**Response:**
```javascript
{
  ok: true,
  staff: [
    {
      id: "123",
      email: "doctor@tip.edu.ph",
      name: "Juan D. Cruz",
      branch: "Manila",                    // From MedicalPersonnel.designation
      identity: "Medical",                 // UserCredentials.identity
      status: "Active",                    // Computed: 'Active' | 'Suspended' | 'Pending'
      credentialsStatus: "Active",         // UserCredentials.credentials_status
      lastLogin: "Mar 22, 2026, 02:30 PM", // Last successful login (formatted)
      permissions: {                       // All permission keys with true/false
        is_admin: true,
        is_staff: true,
        privileged_to_perform_on_superior: true,
        emr_allow_approval: true,
        emr_allow_edit: true,
        emr_allow_view: true,
        emr_allow_set_dental_record: true,
        emr_allow_edit_catalogs: false,
        profile_allow_approval: true,
        profile_allow_view: true,
        profile_allow_edit: true,
        profile_allow_update_email_identifier: false,
        appointment_allow_approval: true,
        appointment_allow_view_records: true,
        appointment_allow_view_configuration: true,
        appointment_allow_edit_configuration: false,
        announcement_allow_crud: true,
        consultation_allow_view: true,
        consultation_allow_edit: true,
        inventory_allow_view: true,
        inventory_allow_dispense: true,
        inventory_allow_edit: false,
        inventory_allow_manage_requests: false,
        inventory_allow_prescribe: true,
        medicine_request_allow_approve: true
      }
    },
    // ... more staff
  ]
}
```

**Status Logic:**
- `'Active'` - identity is `'Medical'`
- `'Suspended'` - identity is NOT `'Medical'` but has `is_staff` permission
- `'Pending'` - identity is NOT `'Medical'` and does NOT have `is_staff` permission

**Error Responses:**
```javascript
// 403 - Not admin
{ error: 'FORBIDDEN', message: 'Admin access required.' }

// 500 - Server error
{ error: 'INTERNAL_ERROR', message: 'Internal server error.' }
```

---

### PUT /admin/staff/accounts/:userId

Update a staff member's permissions and status.

**What is `updateStaffAccount` used for?**

The `updateStaffAccount` mutation is the primary tool for managing staff access in the system. It allows admins to:

1. **Modify permissions** - Grant or revoke specific permission keys (e.g., EMR editing, appointment approval)
2. **Activate staff** - Change status from 'Suspended' to 'Active' (sets identity to 'Medical')
3. **Suspend staff** - Change status from 'Active' to 'Suspended' (sets identity to 'Employee', blocking access)
4. **Automatic safeguards**:
   - Always ensures `is_staff: true` is added to permissions
   - Prevents admins from suspending themselves
   - Only works on verified accounts with MedicalPersonnel records
   - Pulls branch assignment from `MedicalPersonnel.designation`

**Authentication:** Requires Medical identity with `IS_ADMIN` permission

**URL Parameters:**
- `userId` - The staff member's user ID

**Request Body:**
```javascript
{
  permissions: {              // Permission keys to set
    is_admin: true,           // true = grant, false = revoke
    emr_allow_edit: true,
    emr_allow_view: true,
    appointment_allow_view: false,
    // Only include keys you want to change
  },
  status: "Active"            // 'Active' or 'Suspended'
}
```

**Request Example:**
```http
PUT /admin/staff/accounts/123
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "permissions": {
    "is_admin": true,
    "emr_allow_view": true,
    "emr_allow_edit": false
  },
  "status": "Active"
}
```

**Response:**
```javascript
{
  ok: true,
  message: "Staff account activated successfully."
  // or "Staff account suspended successfully."
}
```

**Behavior:**
1. Validates admin permissions
2. Fetches target user's branch from `MedicalPersonnel.designation`
3. Always ensures `is_staff: true` is added to permissions
4. Calls `setStaffPermissions()` to apply permission changes
5. Updates `UserCredentials.identity`:
   - `status: 'Active'` → `identity = 'Medical'`
   - `status: 'Suspended'` → `identity = 'Employee'`

**Error Responses:**
```javascript
// 400 - Missing fields
{ error: 'MISSING_FIELDS', message: 'permissions and status are required.' }

// 400 - Invalid status
{ error: 'INVALID_STATUS', message: 'Status must be Active or Suspended.' }

// 400 - Self-suspension
{ error: 'CANNOT_SELF_SUSPEND', message: 'Admins cannot suspend their own account.' }

// 403 - Not admin
{ error: 'FORBIDDEN', message: 'Admin access required.' }

// 403 - Wrong identity
{ error: 'FORBIDDEN', message: 'Can only manage Medical staff accounts.' }

// 403 - Not verified
{
  error: 'STAFF_NOT_VERIFIED',
  message: 'This account is not yet verified. Please approve the initial record first.'
}

// 404 - User not found
{ error: 'NOT_FOUND', message: 'User not found.' }

// 500 - Server error
{ error: 'INTERNAL_ERROR', message: 'Internal server error.' }
```

---

## Staff Anchor System & Session Management

### What is the Anchor System?

The **anchor system** is a security mechanism for medical staff that enables instant logout across all devices. It works as follows:

- **Staff-only feature**: Only users with role `'medical'` use the anchor system (patients don't have anchors)
- **Shared session ID**: Each staff member has a single "anchor" (UUID) stored in Redis: `staff:anchor:${userId}`
- **Embedded in JWT**: When generating access tokens, the anchor is embedded as the `sid` (session ID) claim
- **Token validation**: When refreshing access tokens, the system verifies that the token's `sid` matches the current anchor in Redis
- **Instant invalidation**: Rotating the anchor (generating a new UUID) instantly invalidates ALL existing tokens for that user

### Session Data Structure

Each device login creates a refresh session stored in Redis as `rt:${userId}:${deviceId}`:

```javascript
{
  userId: 123,
  deviceId: "550e8400-e29b-41d4-a716-446655440000",  // unique per device
  role: "medical",
  refreshToken: "660e8400-...",
  prevToken: null,
  status: "active",
  cooldownUntil: null,
  suspiciousCount: 0,
  createdAt: 1711188930000,      // milliseconds timestamp
  updatedAt: 1711188930000,      // milliseconds timestamp
  exp: 1711793730000,            // expiration timestamp (ms)
  sessionId: "770e8400-..."      // the anchor UUID (medical only, null for patients)
}
```

### Key Redis Operations

```javascript
// ─── ANCHOR MANAGEMENT ───────────────────────────────────────
// Save anchor (one per staff member, 7 days TTL by default)
await saveStaffAnchor(userId, anchorUUID, REFRESH_EXP);

// Get current anchor
const anchor = await getStaffAnchor(userId);

// Delete anchor (rarely needed, use rotate instead)
await deleteStaffAnchor(userId);

// ─── SESSION MANAGEMENT ──────────────────────────────────────
// List all refresh sessions for a user (scans rt:${userId}:* keys)
const sessions = await listUserSessions(userId);

// Get a specific session
const session = await getRefreshSession(userId, deviceId);

// Save a session
await saveRefreshSession(userId, deviceId, sessionData, ttlSeconds);

// Delete ALL sessions for a user (logout all devices)
await deleteAllUserSessions(userId);
```

---

## Session Management API

### Query: listStaffSessions

List all active refresh token sessions (devices) for a staff member by scanning Redis for `rt:${userId}:*` keys.

**Authentication:** Requires Medical identity with `IS_ADMIN` permission

**GraphQL Query:**
```graphql
query {
  listStaffSessions(userId: "123") {
    sessions {
      deviceId
      status
      createdAt
      updatedAt
      expiresAt
      isCurrent
    }
    count
    currentAnchor
  }
}
```

**Response:**
```json
{
  "data": {
    "listStaffSessions": {
      "sessions": [
        {
          "deviceId": "550e8400-e29b-41d4-a716-446655440000",
          "status": "active",
          "createdAt": "2026-03-23T10:15:30.000Z",
          "updatedAt": "2026-03-23T14:25:10.000Z",
          "expiresAt": "2026-03-30T10:15:30.000Z",
          "isCurrent": true
        },
        {
          "deviceId": "660e8400-e29b-41d4-a716-446655440001",
          "status": "active",
          "createdAt": "2026-03-22T08:30:15.000Z",
          "updatedAt": "2026-03-23T09:10:20.000Z",
          "expiresAt": "2026-03-29T08:30:15.000Z",
          "isCurrent": false
        }
      ],
      "count": 2,
      "currentAnchor": "770e8400-e29b-41d4-a716-446655440002"
    }
  }
}
```

**Field Descriptions:**
| Field | Description |
|-------|-------------|
| `deviceId` | Unique identifier for the device/session (UUID) |
| `status` | Session status (typically "active") |
| `createdAt` | When the session was created (ISO timestamp) |
| `updatedAt` | Last time the session was refreshed (ISO timestamp) |
| `expiresAt` | When the refresh token expires (ISO timestamp) |
| `isCurrent` | Whether this session matches the current request's deviceId |
| `count` | Total number of active sessions |
| `currentAnchor` | The current anchor UUID shared by all sessions |

**Use Cases:**
- View all logged-in devices for a staff member
- Audit active sessions before security actions
- Identify suspicious devices before rotating anchor
- Monitor session activity for compliance

---

### Mutation: rotateStaffAnchor

Rotate the staff anchor to instantly logout all devices for a user.

**What it does:**
1. Generates a new anchor (UUID)
2. Saves it to Redis with 7-day TTL
3. Deletes all refresh sessions (`rt:${userId}:*` keys)

This forces all existing access tokens to become invalid on next refresh attempt, requiring re-authentication on all devices.

**Authentication:** Requires Medical identity with `IS_ADMIN` permission

**GraphQL Mutation:**
```graphql
mutation {
  rotateStaffAnchor(userId: "123") {
    ok
    message
    sessionsInvalidated
  }
}
```

**Response:**
```json
{
  "data": {
    "rotateStaffAnchor": {
      "ok": true,
      "message": "Staff anchor rotated successfully. All devices have been logged out.",
      "sessionsInvalidated": 2
    }
  }
}
```

**When to Use:**
| Scenario | Description |
|----------|-------------|
| Security incident | Suspicious activity detected on staff account |
| Account compromise | Staff reports unauthorized access |
| Device lost/stolen | Staff lost a device with active session |
| Mandatory logout | Force re-auth for policy updates |
| Password change | After password reset to invalidate old sessions |

**Error Responses:**
```javascript
// 401 - Not authenticated
{ error: 'UNAUTHORIZED', message: 'Unauthorized' }

// 403 - Not Medical staff
{ error: 'FORBIDDEN', message: 'Can only rotate anchor for Medical staff accounts.' }

// 404 - User not found
{ error: 'NOT_FOUND', message: 'User not found.' }
```

---

## Key Concepts

### Permission Model

- **Key-based system**: Each permission is a key (e.g., `is_admin`, `emr_allow_view`)
- **Boolean values**: `true` = has permission, `false` = no permission
- **Database storage**: Permissions are stored as rows in `rolesMap` table
  - Having a row = `true`
  - No row = `false`

### Identity vs Status

- **identity** (UserCredentials.identity):
  - `'Medical'` - Active medical staff (can access medical routes)
  - `'Employee'` - Suspended staff (blocked from medical routes)
  - `'Student'` - Student user

- **status** (API-level):
  - `'Active'` - Working staff member
  - `'Suspended'` - Temporarily blocked staff member
  - `'Pending'` - Not yet approved/configured

### Branch Assignment

- Staff are assigned to branches via `MedicalPersonnel.designation`
- Valid values: `'Manila'`, `'QuezonCity'`, `'Both'`
- Permissions in `rolesMap` also store branch (for potential future multi-branch filtering)

---

## Example Workflows

### Granting Admin Access

```javascript
// Frontend sends PUT request
PUT /admin/staff/accounts/123
{
  "permissions": {
    "is_admin": true,
    "is_staff": true,
    "emr_allow_view": true,
    "emr_allow_edit": true
  },
  "status": "Active"
}

// Backend processes:
// 1. Validates admin perms
// 2. Gets user's branch from MedicalPersonnel.designation
// 3. Calls setStaffPermissions() which:
//    - Inserts rows for is_admin, is_staff, emr_allow_view, emr_allow_edit
// 4. Updates identity to 'Medical'
// 5. Returns success
```

### Revoking Specific Permission

```javascript
// Frontend sends PUT request
PUT /admin/staff/accounts/123
{
  "permissions": {
    "emr_allow_edit": false  // Revoke EMR editing
  },
  "status": "Active"
}

// Backend processes:
// 1. Adds is_staff: true automatically
// 2. Calls setStaffPermissions() which:
//    - Deletes row for ALLOW_TO_EDIT_EMR
//    - Ensures IS_STAFF row exists
// 3. Keeps identity as 'Medical'
```

### Suspending Staff

```javascript
// Frontend sends PUT request
PUT /admin/staff/accounts/123
{
  "permissions": {
    // Keep current permissions as-is
  },
  "status": "Suspended"
}

// Backend processes:
// 1. Updates identity to 'Employee'
// 2. Permissions remain in DB (can be reactivated later)
// 3. User can no longer access medical routes (jwtProtect('medical') blocks them)
```

---

## Helper Function

### labelsToPermissions(labels)

Internal helper in `rolemanagement.js` that converts an array of permission labels to a permissions object.

**Input:**
```javascript
['IS_ADMIN', 'IS_STAFF', 'ALLOW_TO_VIEW_EMR', 'ALLOW_TO_EDIT_CONSULTATION']
```

**Output:**
```javascript
{
  is_admin: true,
  is_staff: true,
  privileged_to_perform_on_superior: false,
  emr_allow_approval: false,
  emr_allow_edit: false,
  emr_allow_view: true,
  emr_allow_set_dental_record: false,
  emr_allow_edit_catalogs: false,
  profile_allow_approval: false,
  profile_allow_view: false,
  profile_allow_edit: false,
  profile_allow_update_email_identifier: false,
  appointment_allow_approval: false,
  appointment_allow_view_records: false,
  appointment_allow_view_configuration: false,
  appointment_allow_edit_configuration: false,
  announcement_allow_crud: false,
  consultation_allow_view: false,
  consultation_allow_edit: true,
  inventory_allow_view: false,
  inventory_allow_dispense: false,
  inventory_allow_edit: false,
  inventory_allow_manage_requests: false,
  inventory_allow_prescribe: false,
  medicine_request_allow_approve: false
}
```

---

## Database Query Optimization

The GET endpoint uses a single aggregated query instead of N+1 queries:

```sql
SELECT
  uc.id, uc.email, uc.identity, uc.credentials_status,
  up.first_name, up.middle_name, up.last_name,
  mp.designation AS branch,
  COALESCE(array_agg(rt.label) FILTER (WHERE rt.label IS NOT NULL), '{}') AS labels
FROM "UserCredentials" uc
JOIN "UsersPersonal" up ON up.id = uc.id
JOIN "MedicalPersonnel" mp ON mp.id = uc.id
LEFT JOIN "rolesMap" rm ON rm."personnelId" = uc.id
LEFT JOIN "rolesTable" rt ON rt.id = rm."rolesId"
WHERE uc.identity = 'Medical'
  AND ($1 IS NULL OR uc.credentials_status = $1)
  AND ($2 IS NULL OR mp.designation = $2)
GROUP BY uc.id, uc.email, uc.identity, uc.credentials_status,
         up.first_name, up.middle_name, up.last_name, mp.designation
ORDER BY up.last_name NULLS LAST, up.first_name NULLS LAST
```

This returns all labels for each user in a single query, which is then converted to the permissions object using `labelsToPermissions()`.

---

## Frontend Integration Example

```javascript
// Fetch all staff
const response = await fetch('/admin/staff/accounts?location=Manila', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { staff } = await response.json();

// Display staff with checkboxes
staff.forEach(member => {
  console.log(member.name);
  console.log('Admin:', member.permissions.is_admin);
  console.log('Can view EMR:', member.permissions.emr_allow_view);
  console.log('Can edit EMR:', member.permissions.emr_allow_edit);
  console.log('Can approve appointments:', member.permissions.appointment_allow_approval);
  console.log('Can view consultations:', member.permissions.consultation_allow_view);
});

// Update staff permissions
await fetch(`/admin/staff/accounts/${userId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    permissions: {
      is_admin: true,
      emr_allow_view: true,
      emr_allow_edit: false,
      consultation_allow_view: true,
      appointment_allow_approval: false
    },
    status: 'Active'
  })
});
```

---

## Notes

- The system enforces that all active/suspended staff must have `is_staff: true`
- Admins cannot suspend themselves
- Only accounts with `credentials_status = 'Active'` can have permissions managed
- Permission keys not included in the request are left unchanged
- Invalid permission keys will throw an error
- Branch is always pulled from `MedicalPersonnel.designation`, not from request body
