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

This section describes the three core functions for managing staff permissions:

1. **getStaffPermissions()** - Query permissions with enabled status and branch info
2. **setStaffPermissionsExtended()** - Main function with independent branch per permission
3. **setStaffPermissionsStandard()** - Wrapper that applies umbrella branch to all permissions

### getStaffPermissions(personnelId)

Retrieves all permission keys with their enabled status AND branch designation.

**Input:**

- `personnelId` (number) - User ID

**Output:**

```javascript
{
  permissions: [
    { key: "is_admin", label: "IS_ADMIN", enabled: true, branch: "Both" },
    { key: "is_staff", label: "IS_STAFF", enabled: true, branch: "Manila" },
    { key: "emr_allow_view", label: "ALLOW_TO_VIEW_EMR", enabled: true, branch: "Manila" },
    { key: "emr_allow_edit", label: "ALLOW_TO_EDIT_EMR", enabled: false, branch: null },
    // ... all permission keys
  ],
  count: 25
}
```

**Example:**

```javascript
const result = await getStaffPermissions(123);
result.permissions.forEach(perm => {
  if (perm.enabled) {
    console.log(`${perm.key}: ${perm.branch}`);
  }
});

// Or find a specific permission
const emrView = result.permissions.find(p => p.key === 'emr_allow_view');
console.log(emrView.enabled, emrView.branch); // true, "Manila"
```

---

### setStaffPermissionsExtended()

Core function for setting staff permissions with **independent branch per permission**. Requires explicit branch specification per permission. Supports both simple (umbrella branch) and complex (per-permission branch) scenarios.

**Key Behavior:**
- `enabled: true` → Creates/updates permission record with specified or default branch
- `enabled: false` → **Deletes the permission record entirely** (no database record = no permission)
- Permissions not in list → Left unchanged

**Input:**

```javascript
{
  personnelId: 123,              // User ID (number or string)
  permissionsList: [             // Array with optional per-permission branch
    { key: "emr_allow_view", enabled: true, branch: "Manila" },
    { key: "emr_allow_edit", enabled: true, branch: "Manila" },
    { key: "consultation_allow_view", enabled: true, branch: "QuezonCity" },
    { key: "inventory_allow_view", enabled: true }  // Uses defaultBranch
  ],
  assignedBy: 456,               // Admin user ID who made the change
  defaultBranch: 'Both'          // Optional: Used when permission doesn't specify branch
}
```

**Example - Scenario 1: Simple Umbrella Branch (all same)**

```javascript
await setStaffPermissionsExtended({
  personnelId: 123,
  permissionsList: [
    { key: "is_admin", enabled: true },
    { key: "is_staff", enabled: true },
    { key: "emr_allow_view", enabled: true },
    { key: "consultation_allow_view", enabled: true }
  ],
  assignedBy: 456,
  defaultBranch: 'Manila'  // All permissions use this default
});
// Result: All 4 permissions → branch='Manila'
```

**Example - Scenario 2: Complex Per-Permission Branch**

```javascript
await setStaffPermissionsExtended({
  personnelId: 456,
  permissionsList: [
    { key: "emr_allow_view", enabled: true, branch: "Manila" },
    { key: "emr_allow_edit", enabled: true, branch: "Manila" },
    { key: "consultation_allow_view", enabled: true, branch: "QuezonCity" },
    { key: "inventory_allow_view", enabled: true }  // Uses defaultBranch='Both'
  ],
  assignedBy: 789,
  defaultBranch: 'Both'
});
// Result: Permissions assigned to DIFFERENT branches
```

**Example - Scenario 3: Revoking Permissions (enabled: false)**

```javascript
await setStaffPermissionsExtended({
  personnelId: 123,
  permissionsList: [
    { key: "emr_allow_edit", enabled: false }  // Deletes record from DB
  ],
  assignedBy: 456,
  defaultBranch: 'Both'
});
// Result: emr_allow_edit record DELETED completely
```

---

### setStaffPermissionsStandard()

**Wrapper function** that internally calls `setStaffPermissionsExtended` with all permissions using the same umbrella branch.

**When to use:** Staff assigned to a single branch with uniform permission scope. This is the simpler option when all permissions should have the same branch designation.

---

### setStaffPermissionsExtended()

**Main function** for setting staff permissions with per-permission branch control. This is the primary core implementation that supports independent branch assignment for each permission.

**When to use:** Staff with complex multi-branch permission requirements where each permission needs its own branch designation.

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

| Query                                                 | Description                                          |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `listStaffAccounts(status, location)`               | Get all staff accounts with permissions              |
| `getStaffAccount(userId)`                           | Get single staff account                             |
| `listMedicalPersonnel(role, designation, isActive)` | Get all medical personnel                            |
| `getMedicalPersonnel(userId)`                       | Get single medical personnel                         |
| `getStaffPermissions(userId)`                       | Get permissions with enabled status and branch info  |
| `listStaffSessions(userId)`                         | Get all active sessions for a user                   |
| `countActiveRefreshTokens`                          | Count active refresh tokens system-wide              |
| `listUserSessions(offset, limit)`                   | Get all active sessions globally with pagination     |

### Available Mutations

| Mutation                                                        | Description                                            |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| `createMedicalPersonnel(input)`                               | Create medical personnel record (grants staff access)  |
| `updateMedicalPersonnel(userId, input)`                       | Update medical personnel info                          |
| `deleteMedicalPersonnel(userId, revertIdentity)`              | Delete medical personnel record (revokes staff access) |
| `setStaffPermissionsStandard(userId, permissions, branch)`    | Set permissions with umbrella branch (all same)        |
| `setStaffPermissionsExtended(userId, permissions, defaultBranch)` | Set permissions with independent branch per permission |
| `rotateStaffAnchor(userId)`                                   | Logout all devices for a user                          |

---

## Understanding the Identity System

### How Medical Staff Identity Works

**Important:** There is NO 'Medical' identity in `UserCredentials.identity` anymore. The identity field only contains:

- `Employee` - Regular staff member
- `Student` - Student
- `Superior` - Superior/admin user

**Medical staff access is determined by having a `MedicalPersonnel` record**, not by identity. The system uses the following logic:

```
Is Medical Staff? = EXISTS(MedicalPersonnel WHERE id = userId)
```

**Authentication Flow:**

1. User logs in with `identity='Employee'`
2. System checks if `MedicalPersonnel` record exists for that userId
3. If exists → grants medical portal access with their assigned permissions
4. If not exists → no medical access

**Why this design?**

- **Separation of concerns**: Identity describes the user type, MedicalPersonnel describes their staff role
- **Flexibility**: Same Employee can be granted/revoked medical access without changing identity
- **Data integrity**: Staff information (role, title, designation) stays in MedicalPersonnel table

---

## Managing Staff Access

### Creating Medical Staff (Grant Access)

To grant medical staff access to an Employee:

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

**Effect:** User can now access the medical portal.

### Revoking Medical Staff (Remove Access)

To revoke medical staff access:

```graphql
mutation {
  deleteMedicalPersonnel(userId: "123", revertIdentity: false) {
    ok
    message
    identityReverted
  }
}
```

**Effect:** User loses medical portal access (MedicalPersonnel record deleted).

---

## Setting Permissions

There are two mutations for setting staff permissions, each serving a different use case:

### `setStaffPermissionsStandard` - Umbrella Branch

Use this mutation when **all permissions should have the same branch**. This is simpler and ideal for most cases.

**What it does:**

- Sets permissions for a staff member (requires MedicalPersonnel record)
- All permissions receive the **same branch** (umbrella branch)
- `enabled: true` → permission granted with specified branch
- `enabled: false` → permission revoked (database record deleted)
- Permissions not in the list → left unchanged

**GraphQL Example:**

```graphql
mutation {
  setStaffPermissionsStandard(
    userId: "123"
    permissions: [
      { key: "is_staff", enabled: true }
      { key: "emr_allow_view", enabled: true }
      { key: "emr_allow_edit", enabled: true }
      { key: "consultation_allow_view", enabled: true }
    ]
    branch: Manila  # ALL permissions get this branch
  ) {
    ok
    message
  }
}
```

**Result:** All four permissions will have `branch='Manila'`.

---

### `setStaffPermissionsExtended` - Per-Permission Branch

Use this mutation when **different permissions need different branches**. This provides fine-grained control and is the primary way to set complex permission structures.

**What it does:**

- Sets permissions for a staff member with **independent branch per permission**
- Each permission can specify its own `branch`
- If a permission doesn't specify `branch`, it uses `defaultBranch` (defaults to 'Both')
- `enabled: true` → permission granted with its branch
- `enabled: false` → permission revoked (database record deleted)
- Permissions not in the list → left unchanged

**GraphQL Example:**

```graphql
mutation {
  setStaffPermissionsExtended(
    userId: "123"
    permissions: [
      { key: "emr_allow_view", enabled: true, branch: Manila }
      { key: "emr_allow_edit", enabled: true, branch: Manila }
      { key: "consultation_allow_view", enabled: true, branch: QuezonCity }
      { key: "consultation_allow_edit", enabled: true, branch: QuezonCity }
      { key: "inventory_allow_view", enabled: true }  # Uses defaultBranch
    ]
    defaultBranch: Both  # Applied to permissions without explicit branch
  ) {
    ok
    message
  }
}
```

**Result:**

- `emr_allow_view` and `emr_allow_edit` → Manila only
- `consultation_allow_view` and `consultation_allow_edit` → QuezonCity only
- `inventory_allow_view` → Both branches (uses defaultBranch)

---

### Query: `getStaffPermissions`

Use this query to view the enabled status and branch assignment for each permission.

**GraphQL Example:**

```graphql
query {
  getStaffPermissions(userId: "123") {
    permissions {
      key
      label
      enabled
      branch
    }
    count
  }
}
```

**Response:**

```json
{
  "data": {
    "getStaffPermissions": {
      "permissions": [
        { "key": "is_admin", "label": "IS_ADMIN", "enabled": true, "branch": "Both" },
        { "key": "emr_allow_view", "label": "ALLOW_TO_VIEW_EMR", "enabled": true, "branch": "Manila" },
        { "key": "emr_allow_edit", "label": "ALLOW_TO_EDIT_EMR", "enabled": false, "branch": null },
        { "key": "consultation_allow_view", "label": "ALLOW_TO_VIEW_CONSULTATION", "enabled": true, "branch": "QuezonCity" }
      ],
      "count": 25
    }
  }
}
```

---

### Branch System Explained

- **Branch values:** `Manila`, `QuezonCity`, `Both`
- **Umbrella branch vs Per-permission branch:**
  - `setStaffPermissionsStandard` uses umbrella (all same)
  - `setStaffPermissionsExtended` allows independent branches
- **Permission checking:**
  - If patient is in Manila and permission has `branch='Manila'` or `'Both'` → allowed
  - If patient is in QuezonCity and permission has `branch='QuezonCity'` or `'Both'` → allowed
  - If permission has `branch='Both'` → allowed for all branches

---

### Example: Revoking Permissions

Revoking works the same in both mutations:

```graphql
mutation {
  setStaffPermissionsStandard(
    userId: "123"
    permissions: [
      { key: "emr_allow_edit", enabled: false }  # Revokes completely
    ]
    branch: Both  # Required but ignored for revocations
  ) {
    ok
    message
  }
}
```

**Note:** Revoking (`enabled: false`) deletes the permission record entirely from `rolesMap`, regardless of branch.

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

| Field             | Description                                                 |
| ----------------- | ----------------------------------------------------------- |
| `deviceId`      | Unique identifier for the device/session (UUID)             |
| `status`        | Session status (typically "active")                         |
| `createdAt`     | When the session was created (ISO timestamp)                |
| `updatedAt`     | Last time the session was refreshed (ISO timestamp)         |
| `expiresAt`     | When the refresh token expires (ISO timestamp)              |
| `isCurrent`     | Whether this session matches the current request's deviceId |
| `count`         | Total number of active sessions                             |
| `currentAnchor` | The current anchor UUID shared by all sessions              |

**Use Cases:**

- View all logged-in devices for a staff member
- Audit active sessions before security actions
- Identify suspicious devices before rotating anchor
- Monitor session activity for compliance

---

### Query: countActiveRefreshTokens

Count all active refresh tokens across the entire system.

**What it does:**

- Scans all refresh sessions in Redis
- Filters out expired sessions (`exp < now`)
- Filters out inactive sessions (`status !== "active"`)
- Returns total count of active refresh tokens

**Authentication:** Requires Medical identity with `IS_ADMIN` permission

**GraphQL Query:**

```graphql
query {
  countActiveRefreshTokens
}
```

**Response:**

```json
{
  "data": {
    "countActiveRefreshTokens": 42
  }
}
```

**Use Cases:**

- Monitor total active sessions in the system
- Capacity planning and resource monitoring
- Security audit and anomaly detection
- Identify sudden spikes in active sessions

---

### Query: listUserSessions

List all sessions across all logged-in users in the system with offset-based pagination.

**What it does:**

- Scans all refresh sessions in Redis
- Maps each userId to email from the database
- Returns global list of all active sessions
- Supports offset-based pagination

**Authentication:** Requires Medical identity with `IS_ADMIN` permission

**GraphQL Query:**

```graphql
query {
  listUserSessions(offset: 0, limit: 10) {
    sessions {
      userId
      email
      role
      exp
    }
    totalCount
  }
}
```

**Parameters:**

| Parameter | Type    | Description                                    |
| --------- | ------- | ---------------------------------------------- |
| `offset`  | Int!    | Number of sessions to skip (0-based)           |
| `limit`   | Int!    | Number of sessions to return (1-100)           |

**Response:**

```json
{
  "data": {
    "listUserSessions": {
      "sessions": [
        {
          "userId": "123",
          "email": "doctor@example.com",
          "role": "medical",
          "exp": 1711793730000
        },
        {
          "userId": "456",
          "email": "nurse@example.com",
          "role": "medical",
          "exp": 1711880130000
        },
        {
          "userId": "789",
          "email": "admin@example.com",
          "role": "medical",
          "exp": 1711966530000
        }
      ],
      "totalCount": 127
    }
  }
}
```

**Field Descriptions:**

| Field      | Description                                    |
| ---------- | ---------------------------------------------- |
| `userId`   | Unique identifier for the user                 |
| `email`    | User's email address (from database)           |
| `role`     | Session role (extracted from JWT session data) |
| `exp`      | Token expiration timestamp in milliseconds     |
| `totalCount` | Total number of active sessions in system     |

**Pagination Examples:**

- `offset: 0, limit: 10` → sessions 0-9
- `offset: 10, limit: 10` → sessions 10-19
- `offset: 20, limit: 10` → sessions 20-29

**Use Cases:**

- View all currently logged-in users system-wide
- Monitor active sessions across all staff
- Audit multi-user access patterns
- Identify users with multiple active sessions
- Security and compliance monitoring
- Troubleshoot session-related issues

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

| Scenario           | Description                                     |
| ------------------ | ----------------------------------------------- |
| Security incident  | Suspicious activity detected on staff account   |
| Account compromise | Staff reports unauthorized access               |
| Device lost/stolen | Staff lost a device with active session         |
| Mandatory logout   | Force re-auth for policy updates                |
| Password change    | After password reset to invalidate old sessions |

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
// 3. Calls setStaffPermissionsExtended() which:
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
// 2. Calls setStaffPermissionsExtended() which:
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
