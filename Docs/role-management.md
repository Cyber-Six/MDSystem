# Role Management System

## Overview

GraphQL API for managing medical staff roles, permissions, access control, and admin transfers. Admin-only access.

**Endpoint:** `POST /rolemanagement/admin` (requires JWT auth)

---

## Schema Change Notes

### 2026-04-16 - Role Template Query Alignment
- Added `roleTemplates: [PermissionTemplate!]!` to `Query` as an array alias for template listing.
- Kept `listPermissionTemplates` and `getPermissionTemplate` for backward compatibility.
- Frontend entangled permission fetch removed deprecated `permissionTemplate` query usage and now reads `getStaffPermissions(userId)`.
- Result: role-management frontend queries align with live schema and avoid invalid-field runtime failures.

---

## Key Concepts

### Permission Model
- **Granular Permissions:** Individual permission keys (e.g., `profile_allow_view`, `emr_allow_edit`) with branch designations (Manila, QuezonCity, Both)
- **Module-Level Permissions:** High-level toggles (Appointments, Inventory, Medical Records, etc.) that map to multiple granular keys
- **Permission Templates:** Reusable permission sets for common roles (Admin, Doctor, Nurse, etc.)
- **Union Logic:** A granular permission is enabled if ANY module using it is ON; revoked only if ALL modules are OFF

### Identity & Roles
- **Identity Types:** Medical, Employee, Student, Superior
- **Roles:** Dynamic strings (any text), optionally linked to permission templates
- **CredentialsStatus:** Active, Unverified, Suspended

### Branches
Permissions can be designated for specific locations:
- `Manila`
- `QuezonCity`
- `Both` (access to both locations)

---

## GraphQL API

### Queries

**Staff Accounts:**
- `listStaffAccounts(status: CredentialsStatus, location: Designation): StaffAccountList!`
- `getStaffAccount(userId: ID!): StaffAccount`
- `listStaffSessions(userId: ID!): StaffSessionList!`

**Medical Personnel:**
- `listMedicalPersonnel(role: String, designation: Designation, isActive: Boolean): MedicalPersonnelList!`
- `getMedicalPersonnel(userId: ID!): MedicalPersonnel`

**Permissions:**
- `getStaffPermissions(userId: ID!): Permissions!` — All granular BranchPermission objects
- `getStaffModulePermissions(userId: ID!): ModulePermissionList!` — Module-level derived status

**Permission Templates:**
- `roleTemplates: [PermissionTemplate!]!`
- `listPermissionTemplates: PermissionTemplateList!`
- `getPermissionTemplate(templateId: ID!): PermissionTemplate`

**Sessions:**
- `listUserSessions(offset: Int!, limit: Int!): UserSessionPage!` — Paginated global sessions
- `countActiveRefreshTokens: Int!` — Count of all active tokens (no args)

### Mutations

**Medical Personnel:**
- `createMedicalPersonnel(input: CreateMedicalPersonnelInput!): MedicalPersonnelMutationResult!`
  - Input: `{ userId: ID!, title: String!, role: String!, designation: Designation!, templateId: ID }`
- `updateMedicalPersonnel(userId: ID!, input: UpdateMedicalPersonnelInput!): MedicalPersonnelMutationResult!`
  - Input: `{ title: String, role: String, designation: Designation, isActive: Boolean, templateId: ID }`
- `deleteMedicalPersonnel(userId: ID!, revertIdentity: Boolean): DeleteMedicalPersonnelResult!`

**Permissions:**
- `setStaffPermissionsStandard(userId: ID!, permissions: [StandardPermissionInput!]!, branch: Designation!): MutationResult!`
  - StandardPermissionInput: `{ key: String!, enabled: Boolean! }`
- `setStaffPermissionsExtended(userId: ID!, permissions: [ExtendedPermissionInput!]!, defaultBranch: Designation): MutationResult!`
  - ExtendedPermissionInput: `{ key: String!, enabled: Boolean!, branch: Designation }`
- `setStaffModulePermissions(userId: ID!, modules: [ModulePermissionInput!]!, branch: Designation!): MutationResult!`
  - ModulePermissionInput: `{ moduleId: String!, enabled: Boolean! }`
- `updateStaffAccount(userId: ID!, modules: [ModulePermissionInput!], status: AccountStatus): StaffAccountMutationResult!`

**Permission Templates:**
- `createPermissionTemplate(input: CreateTemplateInput!): TemplateMutationResult!`
  - Input: `{ label: String!, permissions: [ExtendedPermissionInput!]!, defaultBranch: Designation }`
- `updatePermissionTemplate(templateId: ID!, input: UpdateTemplateInput!): TemplateMutationResult!`
  - Input: `{ label: String, permissions: [ExtendedPermissionInput!], defaultBranch: Designation }`
- `deletePermissionTemplate(templateId: ID!): MutationResult!`
- `applyTemplateToStaff(userId: ID!, templateId: ID!): MutationResult!`

**Session Management:**
- `rotateStaffAnchor(userId: ID!): RotateAnchorResult!`

**Admin Transfer:**
- `initiateAdminTransfer(newAdminUserId: ID!, password: String!): InitiateAdminTransferResult!`
- `confirmAdminTransfer(verificationToken: String!): ConfirmAdminTransferResult!`

---

## Example Workflows

### Create Medical Staff with Template

```graphql
mutation CreateDoctor {
  createMedicalPersonnel(input: {
    userId: "123"
    title: "Doctor"
    role: "Senior Doctor"
    designation: Both
    templateId: "1"
  }) {
    ok
    message
    personnel { id role title designation isActive }
  }
}
```

### Set Module Permissions

```graphql
mutation UpdateModuleAccess {
  setStaffModulePermissions(
    userId: "123"
    modules: [
      { moduleId: "patientSearch", enabled: true }
      { moduleId: "appointments", enabled: true }
      { moduleId: "inventory", enabled: false }
    ]
    branch: Manila
  ) {
    ok
    message
  }
}
```

### Set Granular Permissions (Extended)

```graphql
mutation SetGranularAccess {
  setStaffPermissionsExtended(
    userId: "123"
    permissions: [
      { key: "emr_allow_view", enabled: true, branch: Manila }
      { key: "emr_allow_edit", enabled: true, branch: QuezonCity }
      { key: "profile_allow_view", enabled: true }
    ]
    defaultBranch: Both
  ) {
    ok
    message
  }
}
```

### Check User Permissions

```graphql
query UserAccess {
  getStaffAccount(userId: "123") {
    name
    status
    permissions {
      permissions { key label enabled branch }
      count
    }
    modulePermissions {
      modules { moduleId label enabled }
    }
  }
}
```

### Create & Apply Permission Template

```graphql
mutation CreateNurseTemplate {
  createPermissionTemplate(input: {
    label: "Nurse Standard"
    permissions: [
      { key: "emr_allow_view", enabled: true }
      { key: "appointment_allow_view_records", enabled: true }
      { key: "inventory_allow_view", enabled: true }
    ]
    defaultBranch: Both
  }) {
    ok
    template { id label permissionCount }
  }
}

mutation ApplyTemplate {
  applyTemplateToStaff(userId: "456", templateId: "1") {
    ok
    message
  }
}
```

### Admin Handoff

```graphql
mutation InitiateTransfer {
  initiateAdminTransfer(
    newAdminUserId: "456"
    password: "current-admin-password"
  ) {
    ok
    message
    verificationRequired
  }
}

mutation ConfirmTransfer {
  confirmAdminTransfer(
    verificationToken: "ABCD1234"
  ) {
    ok
    message
    oldAdminId
    newAdminId
  }
}
```

---

## Permission Keys

All granular permission keys (mapped to modules):

**Patient Search:** `profile_allow_view`, `emr_allow_view`

**Pending Requests:** `emr_allow_approval`, `profile_allow_approval`, `appointment_allow_approval`, `medicine_request_allow_approve`

**Medical Records:** `emr_allow_view`, `emr_allow_edit`, `emr_allow_edit_catalogs`, `consultation_allow_view`, `consultation_allow_edit`, `profile_allow_view`, `profile_allow_edit`

**Dental Records:** `emr_allow_view`, `emr_allow_edit`, `emr_allow_set_dental_record`, `consultation_allow_view`, `consultation_allow_edit`

**Appointments:** `appointment_allow_approval`, `appointment_allow_view_records`, `appointment_allow_view_configuration`, `appointment_allow_edit_configuration`

**Inventory:** `inventory_allow_view`, `inventory_allow_edit`, `inventory_allow_dispense`, `inventory_allow_manage_requests`, `inventory_allow_prescribe`

**Health Chat:** *(no keys mapped yet)*

**Analytics:** *(no keys mapped yet)*

**Special (not in any module):**
- `is_admin` — Admin access (label: `IS_ADMIN`)
- `is_staff` — Staff portal gate (label: `IS_STAFF`, auto-managed)
- `privileged_to_perform_on_superior` — Override for Superior identity patients
- `profile_allow_update_email_identifier` — Update email identifier
- `announcement_allow_crud` — CRUD announcements

**Note:** Some keys appear in multiple modules (e.g., `emr_allow_view`). Union logic applies: permission enabled if ANY module using it is ON; revoked only if ALL modules using it are OFF.

---

## Database Schema

### UserCredentials

| Column | Type | Notes |
|--------|------|-------|
| id | INT | PK |
| email | VARCHAR | Unique |
| password_hash | VARCHAR | Hashed |
| identity | ENUM | Medical, Employee, Student, Superior |
| credentials_status | ENUM | Active, Unverified, Suspended |

### MedicalPersonnel

| Column | Type | Notes |
|--------|------|-------|
| id | INT | PK, FK to UserCredentials.id |
| role | VARCHAR | Free-form role string |
| title | VARCHAR | Job title |
| designation | ENUM | Manila, QuezonCity, Both |
| is_active | BOOLEAN | Active status |

### rolesTable

| Column | Type | Notes |
|--------|------|-------|
| id | INT | PK |
| label | VARCHAR | Unique permission label (e.g., "IS_ADMIN", "ALLOW_TO_VIEW_EMR") |
| description | VARCHAR | Human-readable description |

### rolesMap

| Column | Type | Notes |
|--------|------|-------|
| personnelId | INT | FK to MedicalPersonnel.id (composite PK with rolesId) |
| rolesId | INT | FK to rolesTable.id (composite PK with personnelId) |
| branch | ENUM | Manila, QuezonCity, Both |
| assignedBy | INT | FK to UserCredentials.id |

Row existence = permission granted. No record = not granted.

### rolesTemplate

| Column | Type | Notes |
|--------|------|-------|
| id | INT | PK |
| label | VARCHAR | Template name |
| created_by | INT | Creator user ID |
| created_at | TIMESTAMP | Creation time |

### rolesTemplateMap

| Column | Type | Notes |
|--------|------|-------|
| templateId | INT | FK to rolesTemplate.id |
| rolesId | INT | FK to rolesTable.id |
| branch | ENUM | Manila, QuezonCity, Both |
| created_at | TIMESTAMP | Creation time |

---

## Admin Transfer Protocol

Secure handoff of admin privileges with multi-factor verification and audit logging.

**Flow:**
1. Current admin initiates with `newAdminUserId` and their `password`
2. Backend verifies password, validates target (active, validated, 2FA enabled)
3. Verification token (8-char OTP) sent to current admin's email
4. Current admin confirms with `verificationToken`
5. System re-validates target, then atomically transfers admin privileges (DB transaction)
6. Audit log records all actions

**Requirements:**
- Current admin password authentication
- New admin must be active medical personnel with validated account
- Both admins must have email 2FA enabled
- Password failures locked after 3 attempts (Redis-based)
- Transfer attempts rate-limited to 1 every 5 minutes (Redis-based)
- Only one pending transfer at a time per admin

---

## Implementation Files

- **Endpoint:** `Backend/routes/role-management/graphql.js`
- **Schema:** `Backend/routes/role-management/schema.graphql`
- **Authorization:** `Backend/routes/role-management/resolvers/admin/admin-resolver.js`
- **Business Logic:** `Backend/routes/role-management/resolvers/wrapper/wrapper.js`
- **Permission Service:** `Backend/services/permit.js`
- **Redis Functions:** `Backend/config/redis.js` (session & admin transfer management)
- **Frontend Page:** `mds-staff/src/modules/role-management/role-management-page.jsx`
- **Frontend Service:** `mds-staff/src/modules/role-management/staff-service.js`
- **Permission Matrix:** `mds-staff/src/modules/role-management/components/permission-matrix.jsx`
- **Admin Transfer UI:** `mds-staff/src/modules/role-management/components/admin-transfer.jsx`

---

## Error Handling

Common error responses:

| Error | Cause |
|-------|-------|
| `Unauthorized` | Missing or invalid JWT token |
| `Admin access required.` | User lacks `is_admin` permission |
| `Staff account not found.` | Invalid user ID for staff operations |
| `Permission template not found.` | Invalid template ID |
| `Too many password failures.` | Admin transfer password lockout (3 attempts) |
| `Transfer already initiated.` | Rate limit on admin transfer initiation |
| `Invalid or expired verification token.` | OTP incorrect or expired |
| `Target user is not an active medical personnel.` | Admin transfer target validation |
| `Target user must have 2FA enabled.` | Admin transfer 2FA requirement |
