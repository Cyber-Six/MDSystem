# Role Management System

## Overview

GraphQL API for managing medical staff roles, permissions, access control, and admin transfers. Admin-only access.

**Endpoint:** `POST /rolemanagement/admin` (requires JWT auth)

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
- **Status:** Active, Suspended, Pending (for credentials)

### Branches
Permissions can be designated for specific locations:
- `Manila`
- `QuezonCity`
- `Both` (access to both locations)

---

## GraphQL API

### Queries

**Staff Accounts:**
- `listStaffAccounts(status?, location?)` - List with optional filters
- `getStaffAccount(userId)` - Single account with all permissions
- `listStaffSessions(userId)` - Active device sessions

**Medical Personnel:**
- `listMedicalPersonnel(role?, designation?, isActive?)` - List with optional filters
- `getMedicalPersonnel(personnelId)` - Single entry with role and template info

**Permissions:**
- `getStaffPermissions(userId)` - All granular permissions
- `getStaffModulePermissions(userId)` - Module-level permission status

**Permission Templates:**
- `listPermissionTemplates()` - All templates
- `getPermissionTemplate(templateId)` - Single template details

**Sessions:**
- `listUserSessions(userId, limit?, offset?)` - Paginated user sessions
- `countActiveRefreshTokens(userId)` - Count of active tokens

### Mutations

**Medical Personnel:**
- `createMedicalPersonnel(email, firstName, lastName, title, role, designation, isActive, templateId?)` - Create staff
- `updateMedicalPersonnel(personnelId, title?, role?, designation?, isActive?, templateId?)` - Update staff
- `deleteMedicalPersonnel(personnelId, revertIdentity?)` - Delete staff

**Permissions:**
- `setStaffPermissionsStandard(userId, permissionKeys[], branch)` - Set granular permissions (same branch for all)
- `setStaffPermissionsExtended(userId, permissions[{key, branch}])` - Set granular permissions (per-key branches)
- `setStaffModulePermissions(userId, modules{module: boolean}, branch)` - Set module-level permissions
- `updateStaffAccount(userId, modules?, status?)` - Combine module updates and status changes

**Permission Templates:**
- `createPermissionTemplate(label, permissionKeys[])` - Create template
- `updatePermissionTemplate(templateId, label?, permissionKeys[]?)` - Update template
- `deletePermissionTemplate(templateId)` - Delete template
- `applyTemplateToStaff(userId, templateId)` - Apply template to staff member

**Session Management:**
- `rotateStaffAnchor(userId)` - Invalidate all staff sessions

**Admin Transfer:**
- `initiateAdminTransfer(oldAdminPassword, newAdminEmail)` - Begin transfer with password verification
- `confirmAdminTransfer(verificationToken, otpCode)` - Complete transfer with OTP

---

## Example Workflows

### Create Medical Staff with Permissions

```graphql
mutation CreateDoctor {
  createMedicalPersonnel(
    email: "dr.smith@hospital.com"
    firstName: "John"
    lastName: "Smith"
    title: "Doctor"
    role: "Senior Doctor"
    designation: "Both"
    isActive: true
    templateId: "doctor-template"
  ) {
    success
    message
  }
}
```

### Set Module Permissions

```graphql
mutation UpdateModuleAccess {
  setStaffModulePermissions(
    userId: 123
    modules: {
      patientSearch: true
      appointments: true
      inventory: false
    }
    branch: "Manila"
  ) {
    success
    message
  }
}
```

### Check User Permissions

```graphql
query UserAccess {
  getStaffAccount(userId: 123) {
    name
    role
    permissions {
      branchPermissions { key enabled branch }
      count
    }
    modulePermissions { module enabled }
  }
}
```

### Create & Apply Permission Template

```graphql
mutation CreateNurseTemplate {
  createPermissionTemplate(
    label: "Nurse Standard"
    permissionKeys: [
      "view_patient_records"
      "view_appointments"
      "edit_appointments"
    ]
  ) {
    id
  }
}

mutation ApplyTemplate {
  applyTemplateToStaff(userId: 456, templateId: "nurse-template") {
    success
  }
}
```

### Admin Handoff

```graphql
mutation InitiateTransfer {
  initiateAdminTransfer(
    newAdminUserId: 456
    password: "current-admin-password"
  ) {
    ok
    message
    verificationRequired
  }
}

mutation ConfirmTransfer {
  confirmAdminTransfer(
    verificationToken: "verification-token-from-email"
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

Granular permissions available (mapped to modules):

**Patient Search:**
- `profile_allow_view`
- `emr_allow_view`

**Pending Requests:**
- `emr_allow_approval`
- `profile_allow_approval`
- `appointment_allow_approval`
- `medicine_request_allow_approve`

**Medical Records:**
- `emr_allow_view`
- `emr_allow_edit`
- `emr_allow_edit_catalogs`
- `consultation_allow_view`
- `consultation_allow_edit`
- `profile_allow_view`
- `profile_allow_edit`

**Dental Records:**
- `emr_allow_view`
- `emr_allow_edit`
- `emr_allow_set_dental_record`
- `consultation_allow_view`
- `consultation_allow_edit`

**Appointments:**
- `appointment_allow_approval`
- `appointment_allow_view_records`
- `appointment_allow_view_configuration`
- `appointment_allow_edit_configuration`

**Inventory:**
- `inventory_allow_view`
- `inventory_allow_edit`
- `inventory_allow_dispense`
- `inventory_allow_manage_requests`
- `inventory_allow_prescribe`

**Role Management:**
- `is_admin`

**Note:** Some keys appear in multiple modules (e.g., `emr_allow_view`). Union logic applies: permission enabled if ANY module using it is ON; revoked only if ALL modules using it are OFF.

---

## Database Schema

### UserCredentials

| Column | Type | Notes |
|--------|------|-------|
| id | INT | User ID (PK) |
| email | VARCHAR(100) | Unique |
| password_hash | VARCHAR(255) | Hashed |
| identity | ENUM | Student, Employee, Superior |
| credentials_status | ENUM | Active, Unverified, Inactive, Locked |

### MedicalPersonnel

| Column | Type | Notes |
|--------|------|-------|
| id | INT | (PK) |
| user_id | INT | FK to UserCredentials |
| title | VARCHAR(100) | Job title |
| role | VARCHAR(100) | Dynamic role string |
| designation | ENUM | Manila, QuezonCity, Both |
| is_active | BOOLEAN | Active status |
| permission_template_id | INT | Optional FK |

### RolesMap

| Column | Type | Notes |
|--------|------|-------|
| id | INT | (PK) |
| user_id | INT | FK to UserCredentials |
| permission_key | VARCHAR(100) | e.g., "view_patient_records" |
| branch | ENUM | Manila, QuezonCity, Both |
| enabled | BOOLEAN | Permission enabled |

### PermissionTemplates

| Column | Type | Notes |
|--------|------|-------|
| id | INT | (PK) |
| label | VARCHAR(100) | Template name |
| permissions | JSON | Array of permission keys |
| created_by | INT | Creator user ID |

---

## Admin Transfer Protocol

Secure handoff of admin privileges with multi-factor verification and audit logging.

**Flow:**
1. Current admin initiates with password verification
2. Verification token (8-char OTP) sent to current admin's email
3. Current admin confirms with verification token
4. System validates and atomically transfers admin privileges
5. Audit log records all actions; old admin sessions invalidated

**Requirements:**
- Current admin password authentication
- New admin must be active medical personnel
- Both admins must have 2FA/email verification enabled
- Password failures locked after 3 attempts
- Transfer attempts rate-limited to 1 every 5 minutes

---

## Implementation Files

- **Endpoint:** `Backend/routes/role-management/graphql.js`
- **Schema:** `Backend/routes/role-management/schema.graphql`
- **Authorization:** `Backend/routes/role-management/resolvers/admin/admin-resolver.js`
- **Business Logic:** `Backend/routes/role-management/resolvers/wrapper/wrapper.js`
- **Permission Service:** `Backend/services/permit.js`
- **Redis Functions:** `Backend/config/redis.js` (session & admin transfer management)

---

## Error Handling

Common error responses:

| Error | Cause |
|-------|-------|
| `Unauthorized` | Missing or invalid JWT token |
| `Forbidden` | User lacks `is_admin` permission |
| `User not found` | Invalid user ID |
| `Template not found` | Invalid template ID |
| `Account locked` | Admin transfer attempts exceeded |
| `Invalid OTP` | OTP code incorrect or expired |

---

## Best Practices

1. **Use Templates** for common roles to maintain consistency
2. **Use Module Permissions** for frontend role management (simpler abstraction)
3. **Check Branches** carefully when assigning permissions to staff
4. **Audit Logs** are automatically recorded; review for sensitive changes
5. **Session Rotation** recommended when roles or permissions change
6. **Admin Transfer** must be completed in single session; cannot be interrupted

---

## Testing Module Permissions

Module-level permissions simplify permission management. The system automatically maps modules to backend permission keys using union logic (enabled if ANY module using the key is ON).

**Modules:**
- `patientSearch` → profile & EMR view permissions
- `pendingRequests` → approval permissions (EMR, profile, appointment, medicine request)
- `medicalRecords` → EMR and consultation (view, edit), profile (view, edit), catalogs
- `dentalRecords` → EMR, consultation, and dental record permissions
- `appointments` → appointment approval, configuration, and history view
- `inventory` → full inventory management (view, edit, dispense, requests, prescribe)
- `healthChat` → health chat messaging (to be mapped)
- `analytics` → analytics/reporting (to be mapped)
- `roleManagement` → full admin access (is_admin)

When setting module permissions, all underlying backend keys are automatically enabled/disabled.
