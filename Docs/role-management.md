# Role Management System Documentation

## Overview

The role management system handles staff permissions and account status in the MDSystem. It uses a **template-based role model** where roles are defined by permission templates, allowing for flexible and dynamic role assignment.

### Key Concepts

**Permission Templates as Roles:**
- Roles are no longer static enums but are dynamic strings that can match permission template labels
- When creating/updating medical personnel, you can assign any role string (e.g., "Nurse Standard", "Doctor Advanced", "Pharmacist")
- Optionally link a permission template to automatically apply its permissions when assigning a role
- This provides flexibility to create custom roles while maintaining permission consistency through templates

**Permission Model:**
- Each permission key maps to true/false based on database records in `rolesMap`
- Permissions can have independent branch designations (Manila, QuezonCity, Both)
- Templates define reusable permission sets that can be applied to staff members

---

## Database Schema

### Tables Involved

**UserCredentials**

- `id` - User ID (primary key, auto-increment integer)
- `email` - User email (unique, varchar(100))
- `password_hash` - Hashed password (varchar(255))
- `identity` - User type enum (`userIdentity`): `'Student'`, `'Employee'`, `'Superior'`
  - **Note**: GraphQL layer uses `'Medical'` to represent active medical staff (maps to identity check + active MedicalPersonnel record)
- `credentials_status` - Account status enum (`CredentialStatus`): `'Unverified'`, `'Active'`, `'Inactive'`, `'Locked'`
  - **GraphQL CredentialsStatus enum**: `'Active'`, `'Unverified'`, `'Suspended'` (maps to database values)
- `allow_email_2fa` - Two-factor authentication flag (boolean, default: false)
- `data_consent` - User data consent (boolean)
- `data_consent_version` - Consent version (varchar(8))
- `data_consent_agreed` - Consent agreement timestamp
- `locked_until` - Account lock expiration (timestamp)
- `created_at` - Account creation timestamp

**UsersPersonal**

- `id` - User ID (primary key, references UserCredentials.id)
- `first_name`, `middle_name`, `last_name` - Name fields (varchar(50))
- `suffix` - Name suffix (varchar(10))
- `date_of_birth` - Birth date
- `sex` - Gender enum: `'Male'`, `'Female'`
- `civil_status` - Civil status enum: `'Single'`, `'Married'`, `'Widowed'`, `'Separated'`
- `nationality` - Nationality (varchar(50))
- `religion` - Religion (varchar(50))
- `contactNumber` - Contact number (varchar(15))
- `present_address` - Present address (text)
- `province_address` - Province address (text)
- `identifier` - User identifier number (integer)
- `branch` - User branch designation enum (`UserDesignation`): `'Manila'`, `'QuezonCity'`, `'Both'`
- `updated_at` - Last update timestamp (default: current_timestamp)

**MedicalPersonnel**

- `id` - User ID (primary key, one-to-one with UserCredentials, references UserCredentials.id)
- `role` - Staff role (varchar(50)): **Free-form string** that can be any custom role name or match a permission template label
  - Examples: `'Nurse Standard'`, `'Doctor Advanced'`, `'Pharmacist Lead'`, `'Admin Full Access'`
  - **GraphQL**: `String` (no longer restricted to enum values)
  - **Best Practice**: Use permission template labels for consistency
- `title` - Job title (varchar(50), e.g., "Senior Medical Officer", "Chief Nurse")
- `designation` - Branch/location enum (`UserDesignation`): `'Manila'`, `'QuezonCity'`, `'Both'`
  - **GraphQL Designation enum**: Same values
- `is_active` - Boolean indicating if personnel record is active (default: true)
- `created_at` - Record creation timestamp (default: current_timestamp)

**rolesTable**

- `id` - Role ID (primary key, auto-increment integer)
- `label` - Permission label (varchar(50), e.g., `'IS_ADMIN'`, `'IS_STAFF'`, `'ALLOW_TO_VIEW_EMR'`)
- `data` - Additional role data (text, optional)
- `created_at` - Role creation timestamp (default: current_timestamp)

**rolesMap**

- `id` - Map entry ID (primary key, auto-increment integer)
- `personnelId` - User ID (integer, foreign key to MedicalPersonnel.id)
- `rolesId` - Role ID (integer, foreign key to rolesTable.id)
- `branch` - Branch assignment enum (`UserDesignation`): `'Manila'`, `'QuezonCity'`, `'Both'`
- `assignedBy` - ID of admin who assigned this role (integer, foreign key to MedicalPersonnel.id)
- `created_at` - Assignment timestamp (default: current_timestamp)
- **Unique Constraint**: `(personnelId, rolesId)` - Each user can have each role only once

**rolesTemplate**

- `id` - Template ID (primary key, auto-increment integer)
- `label` - Template name/label (varchar(200), e.g., "Nurse Standard", "Admin Full Access")
- `created_by` - User ID of admin who created the template (integer, foreign key to MedicalPersonnel.id)
- `created_at` - Template creation timestamp (default: current_timestamp)

**rolesTemplateMap**

- `id` - Map entry ID (primary key, auto-increment integer)
- `templateId` - Template ID (integer, foreign key to rolesTemplate.id)
- `rolesId` - Role ID (integer, foreign key to rolesTable.id)
- `branch` - Branch designation enum (`UserDesignation`): `'Manila'`, `'QuezonCity'`, `'Both'`
- `created_at` - Mapping creation timestamp (default: current_timestamp)

---

### GraphQL to Database Enum Mappings

The GraphQL layer defines enums that may differ from the underlying database enums. Here's how they map:

**Identity Mapping (GraphQL `Identity` enum ↔ Database `userIdentity` enum):**

| GraphQL Value | Database Value | Meaning |
|---------------|----------------|---------|
| `Medical` | No direct DB value | Active medical staff (checked via: MedicalPersonnel record exists AND is_active = true) |
| `Employee` | `'Employee'` | Employee (patient type or suspended medical staff) |
| `Student` | `'Student'` | Student (patient type) |
| `Superior` | `'Superior'` | Superior/VIP user |

**Note**: The `Medical` identity in GraphQL is a derived value - it's determined by the existence of an active MedicalPersonnel record, not stored directly in the database `identity` field.

**CredentialsStatus Mapping (GraphQL `CredentialsStatus` ↔ Database `CredentialStatus`):**

| GraphQL Value | Database Value | Meaning |
|---------------|----------------|---------|
| `Active` | `'Active'` | Account is active and verified |
| `Unverified` | `'Unverified'` | Account created but email not verified |
| `Suspended` | `'Inactive'` or `'Locked'` | Account suspended/locked (maps to Inactive or Locked in database) |

**AccountStatus (GraphQL only - used in rolemanagement context):**

| GraphQL Value | Meaning |
|---------------|---------|
| `Active` | Staff account is active |
| `Suspended` | Staff account is suspended |
| `Pending` | Staff account is pending activation |

**Designation / UserDesignation (Same in both GraphQL and Database):**

| Value | Meaning |
|-------|---------|
| `Manila` | Manila branch only |
| `QuezonCity` | Quezon City branch only |
| `Both` | Both branches |

**Note**: The database also has a `LocationDesignation` enum (`'Arlegui'`, `'Casal'`, `'QuezonCity'`) used for specific location tracking, which is separate from the user/role designation system.

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
| `setStaffModulePermissions(userId, modules, branch)`          | Set permissions at module level (simplified toggle)    |
| `updateStaffAccount(userId, modules, status)`                 | Combined module permissions + status update            |
| `rotateStaffAnchor(userId)`                                   | Logout all devices for a user                          |

---

## Template-Based Role System

### Overview

The role system has been refactored to use **permission templates as roles**. Instead of static role enums (Doctor, Nurse, etc.), roles are now dynamic strings that can match permission template labels.

### How It Works

**Role Assignment:**
1. When creating medical personnel, specify a `role` string (any value)
2. Optionally provide a `templateId` to automatically apply template permissions
3. The role string can match a template label for consistency, but it's not required

**Benefits:**
- **Flexibility**: Create custom roles without code changes
- **Consistency**: Link roles to templates for standardized permissions
- **Scalability**: Add new roles by creating templates
- **Clarity**: Role names can be descriptive (e.g., "Nurse Standard" vs just "Nurse")

### Creating Medical Personnel with Template-Based Roles

**GraphQL Mutation:**

```graphql
mutation {
  createMedicalPersonnel(input: {
    userId: "123"
    title: "Staff Nurse"
    role: "Nurse Standard"           # Free-form string
    designation: Manila
    templateId: "5"                  # Optional: Apply template permissions
  }) {
    ok
    message
    personnel {
      id
      role
      title
      designation
    }
  }
}
```

**What happens:**
1. MedicalPersonnel record created with `role = "Nurse Standard"`
2. If `templateId` provided, all enabled permissions from template #5 are copied to this staff member
3. Staff can now log in with permissions from the template

### Updating Roles and Templates

**Change role and apply new template:**

```graphql
mutation {
  updateMedicalPersonnel(
    userId: "123"
    input: {
      role: "Nurse Advanced"         # Update role string
      templateId: "8"                # Apply different template
    }
  ) {
    ok
    message
    personnel {
      role
    }
  }
}
```

**Result:**
- Role updated to "Nurse Advanced"
- Permissions from template #8 are applied (replaces previous permissions)

### Workflow Examples

**Example 1: Role matches template label**

```graphql
# 1. Create template
mutation {
  createPermissionTemplate(input: {
    label: "Pharmacist Standard"
    permissions: [
      { key: "inventory_allow_view", enabled: true, branch: Manila }
      { key: "inventory_allow_dispense", enabled: true, branch: Manila }
      { key: "medicine_request_allow_approve", enabled: true, branch: Manila }
    ]
  }) {
    ok
    template { id label }  # Returns: id = "12"
  }
}

# 2. Create medical personnel with matching role
mutation {
  createMedicalPersonnel(input: {
    userId: "456"
    title: "Lead Pharmacist"
    role: "Pharmacist Standard"      # Matches template label
    designation: Manila
    templateId: "12"
  }) {
    ok
    message
  }
}
```

**Example 2: Custom role without template**

```graphql
# Create staff with custom role, manually set permissions later
mutation {
  createMedicalPersonnel(input: {
    userId: "789"
    title: "Medical Coordinator"
    role: "Coordinator - Manila"     # Custom role string
    designation: Manila
    # No templateId - permissions set separately
  }) {
    ok
    message
  }
}

# Then set permissions manually
mutation {
  setStaffPermissionsExtended(
    userId: "789"
    permissions: [
      { key: "profile_allow_view", enabled: true, branch: Manila }
      { key: "appointment_allow_view_records", enabled: true, branch: Manila }
    ]
  ) {
    ok
    message
  }
}
```

**Example 3: Standardizing existing roles**

```graphql
# Create templates for common roles
# 1. Nurse Standard template (id: 10)
# 2. Doctor Full Access template (id: 11)
# 3. Admin System Management template (id: 12)

# Update existing personnel to use templates
mutation {
  updateMedicalPersonnel(userId: "100", input: {
    role: "Nurse Standard"
    templateId: "10"
  }) { ok }

  updateMedicalPersonnel(userId: "101", input: {
    role: "Doctor Full Access"
    templateId: "11"
  }) { ok }
}
```

### Querying with Template-Based Roles

**List medical personnel by role:**

```graphql
query {
  listMedicalPersonnel(role: "Nurse Standard") {
    personnel {
      id
      role
      title
      designation
      user {
        name
        email
      }
    }
    count
  }
}
```

**Note:** Role filtering is now a string match, not enum-based. You can search for:
- Exact matches: `role: "Nurse Standard"`
- Any custom role string you've assigned

### Best Practices

1. **Use Template Labels for Roles**: When creating templates, use descriptive labels that work well as role names
   - Good: "Nurse Standard", "Doctor Advanced", "Pharmacist Lead"
   - Bad: "Template 1", "Test Role", "Permissions Set A"

2. **Link Templates to Roles**: Always provide `templateId` when creating staff to ensure consistent permissions
   - This creates a clear link between role name and permission set
   - Makes it easy to update all users with a role by updating the template

3. **Document Role-Template Mappings**: Maintain documentation of which template IDs correspond to which roles
   - Example: "Nurse Standard" = Template #10
   - Makes it easier to apply correct template when creating staff

4. **Template Updates Don't Auto-Update Staff**: Remember that changing a template doesn't automatically update staff permissions
   - You must re-apply the template to update existing staff
   - Use `updateMedicalPersonnel` with `templateId` to re-apply

### Migration from Old Role System

**Old System (Static Enums):**
```graphql
# Before: Role was enum-validated
role: Doctor  # Must be: Doctor, Nurse, Admin, Pharmacist, Dentist, Staff
```

**New System (Template-Based):**
```graphql
# After: Role is free-form string
role: "Doctor Advanced"  # Any string value
templateId: "15"         # Link to permission template
```

**Migration Steps:**
1. Create permission templates for each old role type
2. Update existing MedicalPersonnel records to use template labels as roles
3. Apply corresponding templates to each staff member
4. Remove old role enum validation from client code

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

To grant medical staff access to an Employee, create a MedicalPersonnel record. You can optionally apply a permission template during creation.

**Basic Creation (without template):**

```graphql
mutation {
  createMedicalPersonnel(input: {
    userId: "123"
    title: "Senior Doctor"
    role: "Doctor Advanced"       # Free-form string (can be any role name)
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

**Creation with Template (recommended):**

```graphql
mutation {
  createMedicalPersonnel(input: {
    userId: "123"
    title: "Senior Doctor"
    role: "Doctor Advanced"       # Matches template label
    designation: Manila
    templateId: "15"              # Automatically applies template permissions
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

**Effect:**
- User can now access the medical portal
- If `templateId` provided, permissions from the template are automatically applied
- Role can be any string value (best practice: match template labels for clarity)

### Updating Medical Staff

Update medical personnel information, role, or apply/change permission template:

```graphql
mutation {
  updateMedicalPersonnel(
    userId: "123"
    input: {
      role: "Doctor Lead"         # Update role (optional)
      title: "Lead Physician"     # Update title (optional)
      designation: Both           # Update designation (optional)
      templateId: "20"            # Apply new template (optional)
    }
  ) {
    ok
    message
    personnel {
      role
      title
      designation
    }
  }
}
```

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

## Mutation: updateStaffAccount

Combined update for module-level permissions and/or account status in one call. This is the primary mutation used by the staff account management UI.

**Authentication:** Requires Medical identity with `IS_ADMIN` permission

**GraphQL Mutation:**

```graphql
mutation {
  updateStaffAccount(
    userId: "123"
    modules: [
      { moduleId: "emr", enabled: true }
      { moduleId: "profile", enabled: true }
      { moduleId: "appointment", enabled: false }
      { moduleId: "consultation", enabled: true }
      { moduleId: "inventory", enabled: false }
    ]
    status: Active
  ) {
    ok
    message
    warnings
  }
}
```

**Parameters:**

| Parameter | Type                       | Required | Description                                         |
| --------- | -------------------------- | -------- | --------------------------------------------------- |
| `userId`  | ID!                        | Yes      | Target staff user ID                                |
| `modules` | [ModulePermissionInput!]   | No       | Module-level permission toggles                     |
| `status`  | AccountStatus              | No       | `Active` or `Suspended`                             |

> At least one of `modules` or `status` must be provided.

**Branch Auto-Detection:**

Branch is automatically resolved from `MedicalPersonnel.designation` — the frontend does not need to provide it. If a user has both branches, it defaults to `'Both'`.

**Status Transitions:**

- **Active** → Sets `identity = 'Medical'`, ensures `is_staff` permission exists
- **Suspended** → Sets `identity = 'Employee'` (permissions remain in DB for reactivation)

**Response:**

```json
{
  "data": {
    "updateStaffAccount": {
      "ok": true,
      "message": "Staff account updated.",
      "warnings": ["Admin permission granted — verify this is intentional."]
    }
  }
}
```

**Error Responses:**

```json
{ "errors": [{ "message": "Admin access required." }] }
{ "errors": [{ "message": "User not found or not a medical staff member." }] }
{ "errors": [{ "message": "Provide at least modules or status to update." }] }
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

```graphql
# Frontend sends GraphQL mutation via staff-service.js
mutation {
  updateStaffAccount(
    userId: "123"
    modules: [
      { moduleId: "emr", enabled: true }
      { moduleId: "profile", enabled: true }
      { moduleId: "appointment", enabled: true }
    ]
    status: Active
  ) {
    ok
    message
    warnings    # Returns: ["Admin permission granted — verify this is intentional."]
  }
}

# Backend processes:
# 1. Validates admin perms (requireAdmin guard)
# 2. Auto-detects branch from MedicalPersonnel.designation
# 3. Expands module toggles to granular permission keys
# 4. Calls setStaffModulePermissions() to apply permissions
# 5. Sets identity to 'Medical' and ensures is_staff
# 6. Returns success with any warnings
```

### Revoking Specific Module

```graphql
# Disable consultation module while keeping others
mutation {
  updateStaffAccount(
    userId: "123"
    modules: [
      { moduleId: "emr", enabled: true }
      { moduleId: "profile", enabled: true }
      { moduleId: "consultation", enabled: false }
    ]
    status: Active
  ) {
    ok
    message
  }
}

# Backend processes:
# 1. Expands modules to granular keys (e.g., consultation_allow_view, consultation_allow_edit)
# 2. Deletes permission rows for disabled modules
# 3. Ensures IS_STAFF row exists, identity remains 'Medical'
```

### Suspending Staff

```graphql
# Suspend account without changing permissions
mutation {
  updateStaffAccount(
    userId: "123"
    status: Suspended
  ) {
    ok
    message
  }
}

# Backend processes:
# 1. Updates identity to 'Employee'
# 2. Permissions remain in DB (can be reactivated later)
# 3. User can no longer access medical routes (jwtProtect('medical') blocks them)
```

---

## Helper Function

### labelsToPermissions(labels)

Internal helper that converts an array of permission labels to a permissions object.

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

The `listStaffAccounts` GraphQL query uses a single aggregated query with an inlined last-login subquery instead of N+1 queries:

```sql
SELECT
  uc.id, uc.email, uc.identity, uc.credentials_status,
  up.first_name, up.middle_name, up.last_name,
  mp.designation AS branch,
  COALESCE(array_agg(rt.label) FILTER (WHERE rt.label IS NOT NULL), '{}') AS labels,
  lla.last_login
FROM "UserCredentials" uc
JOIN "UsersPersonal" up ON up.id = uc.id
JOIN "MedicalPersonnel" mp ON mp.id = uc.id
LEFT JOIN "rolesMap" rm ON rm."personnelId" = uc.id
LEFT JOIN "rolesTable" rt ON rt.id = rm."rolesId"
LEFT JOIN (
  SELECT user_id, MAX(attempted_at) AS last_login
  FROM "UserLoginAttempt"
  WHERE was_successful = true
  GROUP BY user_id
) lla ON lla.user_id = uc.id
WHERE ($1 IS NULL OR uc.credentials_status = $1)
  AND ($2 IS NULL OR mp.designation = $2)
GROUP BY uc.id, uc.email, uc.identity, uc.credentials_status,
         up.first_name, up.middle_name, up.last_name, mp.designation, lla.last_login
ORDER BY up.last_name NULLS LAST, up.first_name NULLS LAST
```

This returns all permission labels and last login for each user in a single query, which is then converted to the module permissions structure by the resolver.

---

## Frontend Integration Example

```javascript
import { fetchStaffAccounts, updateStaffAccount } from './staff-service';

// Fetch all staff via GraphQL
const staff = await fetchStaffAccounts();

// Display staff with module toggles
staff.forEach(member => {
  console.log(member.name);
  console.log('Status:', member.status);
  console.log('Branch:', member.branch);
  console.log('Modules:', member.modulePermissions);
  // modulePermissions.modules = [{ moduleId: "emr", enabled: true }, ...]
});

// Update staff permissions and status via GraphQL
await updateStaffAccount(userId, {
  emr: true,
  profile: true,
  consultation: false,
  appointment: true,
  inventory: false
}, 'Active');
```

---

## Permission Templates

Permission templates provide a way to create reusable permission sets that can be quickly applied to staff members. Templates are similar to UserPermissions but exist as predefined configurations.

### Database Schema for Templates

**rolesTemplate**

- `id` - Template ID (primary key)
- `label` - Template name/label (e.g., "Nurse Standard", "Admin Full Access")
- `created_by` - User ID of admin who created the template
- `created_at` - Timestamp when template was created

**rolesTemplateMap**

- `id` - Map entry ID (primary key)
- `templateId` - Template ID (foreign key to rolesTemplate)
- `rolesId` - Role ID (foreign key to rolesTable)
- `branch` - Branch designation: `'Manila'`, `'QuezonCity'`, `'Both'`
- `created_at` - Timestamp when mapping was created

### Template Functions (Backend/services/permit.js)

#### createPermissionTemplate()

Creates a new permission template with specified permissions.

**Parameters:**
```javascript
{
  label: string,                  // Template name
  permissionsList: [              // Array of permissions
    {
      key: string,                // Permission key (e.g., "emr_allow_view")
      enabled: boolean,           // true = include in template
      branch: Designation         // Optional: Manila, QuezonCity, or Both
    }
  ],
  createdBy: number,             // Admin user ID
  defaultBranch: Designation     // Default branch (default: 'Both')
}
```

**Returns:**
```javascript
{
  id: string,
  label: string,
  createdBy: string,
  createdAt: string
}
```

**Example:**
```javascript
const template = await createPermissionTemplate({
  label: "Nurse Standard",
  permissionsList: [
    { key: "is_staff", enabled: true, branch: "Manila" },
    { key: "emr_allow_view", enabled: true, branch: "Manila" },
    { key: "consultation_allow_view", enabled: true, branch: "Manila" },
    { key: "inventory_allow_view", enabled: true, branch: "Manila" }
  ],
  createdBy: 1,
  defaultBranch: "Manila"
});
```

#### getPermissionTemplate()

Retrieves a single template with all its permissions (both enabled and disabled).

**Parameters:**
```javascript
templateId: number
```

**Returns:**
```javascript
{
  id: string,
  label: string,
  createdBy: string,
  createdAt: string,
  permissions: [
    {
      key: string,           // Permission key
      label: string,         // Permission label
      enabled: boolean,      // Whether this permission is in the template
      branch: Designation    // Branch for this permission (null if not enabled)
    }
  ],
  permissionCount: number   // Count of enabled permissions
}
```

**Example:**
```javascript
const template = await getPermissionTemplate(5);
console.log(template.label);  // "Nurse Standard"
console.log(template.permissionCount);  // 4
console.log(template.permissions[0]);  // { key: "is_admin", label: "IS_ADMIN", enabled: false, branch: null }
```

#### listPermissionTemplates()

Lists all available permission templates with full permission details.

**Returns:**
```javascript
{
  templates: [
    {
      id: string,
      label: string,
      createdBy: string,
      createdAt: string,
      permissions: [...],
      permissionCount: number
    }
  ],
  count: number
}
```

**Example:**
```javascript
const { templates, count } = await listPermissionTemplates();
templates.forEach(template => {
  console.log(`${template.label} - ${template.permissionCount} permissions`);
});
```

#### updatePermissionTemplate()

Updates a template's label and/or permissions.

**Parameters:**
```javascript
{
  templateId: number,
  label: string,                  // Optional: new label
  permissionsList: [...],         // Optional: new permissions (replaces all)
  defaultBranch: Designation      // Optional: default branch
}
```

**Returns:** Updated template object (same format as getPermissionTemplate)

**Example:**
```javascript
const updated = await updatePermissionTemplate({
  templateId: 5,
  label: "Nurse Advanced",
  permissionsList: [
    { key: "is_staff", enabled: true, branch: "Manila" },
    { key: "emr_allow_view", enabled: true, branch: "Manila" },
    { key: "emr_allow_edit", enabled: true, branch: "Manila" },  // Added
    { key: "consultation_allow_edit", enabled: true, branch: "Manila" }  // Added
  ]
});
```

#### deletePermissionTemplate()

Deletes a permission template and all its associated permissions.

**Parameters:**
```javascript
templateId: number
```

**Returns:**
```javascript
boolean  // true if deleted successfully
```

**Example:**
```javascript
const deleted = await deletePermissionTemplate(5);
console.log(deleted);  // true
```

#### applyTemplateToStaff()

Applies a template's permissions to a staff member, copying all enabled permissions from the template.

**Parameters:**
```javascript
{
  personnelId: number,    // Staff user ID
  templateId: number,     // Template ID to apply
  assignedBy: number      // Admin user ID
}
```

**Returns:**
```javascript
{
  appliedCount: number,
  permissions: [...]      // Array of applied permissions
}
```

**Example:**
```javascript
const result = await applyTemplateToStaff({
  personnelId: 123,
  templateId: 5,
  assignedBy: 1
});
console.log(`Applied ${result.appliedCount} permissions to staff`);
```

### GraphQL Operations for Templates

#### Queries

**listPermissionTemplates**
```graphql
query {
  listPermissionTemplates {
    templates {
      id
      label
      createdBy
      createdAt
      permissionCount
      permissions {
        key
        label
        enabled
        branch
      }
    }
    count
  }
}
```

**getPermissionTemplate**
```graphql
query {
  getPermissionTemplate(templateId: "5") {
    id
    label
    createdBy
    createdAt
    permissionCount
    permissions {
      key
      label
      enabled
      branch
    }
  }
}
```

#### Mutations

**createPermissionTemplate**
```graphql
mutation {
  createPermissionTemplate(
    input: {
      label: "Nurse Standard"
      permissions: [
        { key: "is_staff", enabled: true, branch: Manila }
        { key: "emr_allow_view", enabled: true, branch: Manila }
        { key: "consultation_allow_view", enabled: true, branch: Manila }
      ]
      defaultBranch: Manila
    }
  ) {
    ok
    message
    template {
      id
      label
      permissionCount
    }
  }
}
```

**updatePermissionTemplate**
```graphql
mutation {
  updatePermissionTemplate(
    templateId: "5"
    input: {
      label: "Nurse Advanced"
      permissions: [
        { key: "is_staff", enabled: true, branch: Manila }
        { key: "emr_allow_view", enabled: true, branch: Manila }
        { key: "emr_allow_edit", enabled: true, branch: Manila }
      ]
    }
  ) {
    ok
    message
    template {
      id
      label
      permissionCount
    }
  }
}
```

**deletePermissionTemplate**
```graphql
mutation {
  deletePermissionTemplate(templateId: "5") {
    ok
    message
  }
}
```

**applyTemplateToStaff**
```graphql
mutation {
  applyTemplateToStaff(userId: "123", templateId: "5") {
    ok
    message
  }
}
```

### Frontend Integration Example

```javascript
// 1. List all templates
const templatesQuery = `
  query {
    listPermissionTemplates {
      templates {
        id
        label
        permissionCount
        permissions { key enabled branch }
      }
    }
  }
`;

const response = await fetch('/rolemanagement/admin', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: templatesQuery })
});

const { data } = await response.json();
const templates = data.listPermissionTemplates.templates;

// 2. Display templates in UI
templates.forEach(template => {
  console.log(`${template.label}: ${template.permissionCount} permissions`);
});

// 3. Apply template to staff member
const applyMutation = `
  mutation {
    applyTemplateToStaff(userId: "123", templateId: "5") {
      ok
      message
    }
  }
`;

await fetch('/rolemanagement/admin', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: applyMutation })
});

// Staff 123 now has all permissions from template 5
```

### Template Workflow

1. **Creating Templates**: Admins create templates with predefined permission sets
2. **Viewing Templates**: Staff can query templates to see available configurations
3. **Applying Templates**: Admins apply templates to staff members
   - All enabled permissions from the template are copied to the staff member
   - Existing permissions are updated/replaced using `setStaffPermissionsExtended()`
4. **Updating Templates**: Changes to templates don't affect staff who already have those permissions
   - Templates must be re-applied to update staff permissions

### Use Cases

**Example Templates:**

- **"Nurse Standard"**: Basic nursing permissions (view EMR, view consultations, view inventory)
- **"Pharmacist Full"**: Complete pharmacy permissions (view/dispense medicine, manage requests, prescribe)
- **"Admin Full Access"**: All system permissions with admin privileges
- **"Doctor EMR Only"**: Restricted to EMR operations only
- **"Reception Desk"**: Appointment and profile management only

**Benefits:**

- Consistency: Ensure all staff in the same role have the same permissions
- Speed: Quickly onboard new staff by applying a template
- Maintenance: Update templates to standardize permissions across the organization
- Compliance: Document and audit standard permission configurations

---

## Admin Transfer

The Admin Transfer feature provides a secure mechanism for transferring admin privileges from one user to another. This is a critical operation that requires multiple layers of verification to ensure security.

### Overview

Admin transfer is a **two-step process** with enhanced security measures:

1. **Initiation**: Current admin initiates transfer with password re-authentication
2. **Confirmation**: Admin confirms transfer using verification token sent via email

**Security Features:**

- Password re-authentication required to initiate
- Verification token sent to admin's email (2FA must be enabled)
- Token expires after 10 minutes
- Rate limiting on password attempts (max 5 failed attempts, 15-minute lockout)
- Atomic transaction ensures either complete success or rollback
- Comprehensive audit logging of all attempts
- Validation checks performed at both initiation and confirmation

### Requirements

Before initiating an admin transfer, the following requirements must be met:

**Current Admin (Initiator):**
- Must have `IS_ADMIN` permission
- Must provide correct password
- Account must not be password-locked

**Target User (New Admin):**
- Must be an active medical personnel (`is_active = true`)
- Must have validated account (`credentials_status = 'Active'`)
- Must have 2FA enabled (`allow_email_2fa = true`)
- Cannot already be an admin

### GraphQL Operations

#### Mutation: initiateAdminTransfer

Initiates the admin transfer process. Requires password re-authentication and sends verification token to admin's email.

**Input:**
```graphql
mutation {
  initiateAdminTransfer(
    newAdminUserId: "456"
    password: "current_admin_password"
  ) {
    ok
    message
    verificationRequired
  }
}
```

**Response:**
```json
{
  "data": {
    "initiateAdminTransfer": {
      "ok": true,
      "message": "Admin transfer initiated. Check your email for verification code.",
      "verificationRequired": true
    }
  }
}
```

**Process:**
1. Validates current admin's password
2. Verifies target user meets all requirements
3. Generates secure verification token (32-byte random hex)
4. Stores transfer session in Redis (10-minute TTL)
5. Sends verification email to current admin
6. Logs initiation attempt in audit log

**Error Cases:**
- Incorrect password (counts toward rate limit)
- Password locked (5 failed attempts in 15 minutes)
- Target user is already admin
- Target user not active medical personnel
- Target user not validated
- Target user 2FA not enabled

#### Mutation: confirmAdminTransfer

Completes the admin transfer using the verification token from email.

**Input:**
```graphql
mutation {
  confirmAdminTransfer(
    verificationToken: "abc123def456..."
  ) {
    ok
    message
    oldAdminId
    newAdminId
  }
}
```

**Response:**
```json
{
  "data": {
    "confirmAdminTransfer": {
      "ok": true,
      "message": "Admin privileges transferred successfully.",
      "oldAdminId": "123",
      "newAdminId": "456"
    }
  }
}
```

**Process:**
1. Validates verification token (not expired, not already used)
2. Re-validates current admin still has admin privileges
3. Re-validates target user still meets all requirements
4. Performs atomic database transaction:
   - Grants `IS_ADMIN` permission to new admin (branch: 'Both')
   - Removes `IS_ADMIN` permission from old admin
   - Logs audit trail entry
5. Deletes transfer session from Redis
6. Returns success with both user IDs

**Error Cases:**
- Invalid or expired verification token
- Token already used
- Old admin no longer has admin privileges
- Target user no longer active/validated
- Target user 2FA disabled after initiation
- Database transaction failure (automatic rollback)

### Security Implementation Details

#### Password Rate Limiting

The system tracks failed password attempts to prevent brute-force attacks:

- **Threshold**: 5 failed attempts
- **Lockout Period**: 15 minutes from first failure
- **Reset**: Successful password clears failure count
- **Scope**: Per-user based on current admin's ID

#### Verification Token

- **Generation**: 32-byte cryptographically secure random hex string
- **Storage**: Redis with 10-minute TTL
- **Single Use**: Token deleted after successful confirmation
- **Format**: Session stores `{ oldAdminId, newAdminId, createdAt }`

#### Atomic Transaction

The transfer operation uses PostgreSQL transaction to ensure atomicity:

```sql
BEGIN;
  -- Grant admin to new user
  INSERT INTO "rolesMap" ... ON CONFLICT ...
  -- Remove admin from old user
  DELETE FROM "rolesMap" ...
  -- Log audit entry
  INSERT INTO "SystemAuditLog" ...
COMMIT; -- or ROLLBACK on error
```

If any step fails, the entire transaction is rolled back - no partial state.

#### Re-validation at Confirmation

Even if initiation succeeded, the system re-validates all requirements at confirmation:

- Current admin still has admin privileges (prevents race conditions)
- Target user still active medical personnel
- Target user still validated
- Target user still has 2FA enabled

This prevents edge cases where user state changes during the 10-minute verification window.

### Audit Logging

All admin transfer operations are logged to `SystemAuditLog`:

**Event Types:**
- `ADMIN_TRANSFER_INITIATED` - Transfer initiation (success/failure)
- `ADMIN_TRANSFER_SUCCESS` - Completed transfer
- `ADMIN_TRANSFER_FAILED` - Failed confirmation or validation

**Logged Details:**
- Actor ID (old admin)
- Target ID (new admin)
- Email addresses
- Verification token prefix (first 8 chars for correlation)
- Failure reasons
- Timestamps

### Frontend Integration Example

```javascript
// Step 1: Initiate transfer
const initiateMutation = `
  mutation {
    initiateAdminTransfer(
      newAdminUserId: "456"
      password: "${userPassword}"
    ) {
      ok
      message
      verificationRequired
    }
  }
`;

const response1 = await fetch('/rolemanagement/admin', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: initiateMutation })
});

const { data: initData } = await response1.json();
if (initData.initiateAdminTransfer.ok) {
  // Show message: "Check your email for verification code"
  showEmailVerificationPrompt();
}

// Step 2: User receives email, copies verification token
// Then confirms transfer with the token

const confirmMutation = `
  mutation {
    confirmAdminTransfer(
      verificationToken: "${emailToken}"
    ) {
      ok
      message
      oldAdminId
      newAdminId
    }
  }
`;

const response2 = await fetch('/rolemanagement/admin', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: confirmMutation })
});

const { data: confirmData } = await response2.json();
if (confirmData.confirmAdminTransfer.ok) {
  // Transfer complete - old admin loses access
  showSuccessMessage('Admin privileges transferred successfully');
  // Redirect old admin or logout
}
```

### Use Cases

**Planned Admin Transition:**
- Current admin is leaving position
- Systematic handover of administrative responsibilities
- New admin confirmed and prepared to take over

**Emergency Access Transfer:**
- Current admin unavailable or compromised
- Need to quickly grant admin access to another authorized user
- Requires current admin's cooperation (password + email access)

**Administrative Restructuring:**
- Organization changes requiring different admin personnel
- Ensures single admin model is maintained
- Audit trail for compliance and accountability

### Important Notes

- Only **one admin** exists in the system at a time (enforced by removing old admin when granting new admin)
- Transfer is **irreversible** once confirmed - old admin immediately loses privileges
- Verification token **expires in 10 minutes** - must complete both steps within this window
- **Email access required** - admin must have access to their registered email to receive token
- **2FA must be enabled** for both current and new admin
- All operations are **audit-logged** for security compliance
- Failed password attempts are **rate-limited** to prevent abuse

---

## Notes

**General:**
- The system enforces that all active/suspended staff must have `is_staff: true`
- Admins cannot suspend themselves
- Only accounts with `credentials_status = 'Active'` can have permissions managed
- Permission keys not included in the request are left unchanged
- Invalid permission keys will throw an error

**Roles:**
- Roles are **free-form strings** (no longer restricted to enum values)
- Best practice: Use permission template labels as role names for consistency
- Role field accepts any string value (e.g., "Nurse Standard", "Doctor Advanced", "Custom Role")
- Changing a role does not automatically change permissions - permissions must be set separately
- Use `templateId` parameter to automatically apply template permissions when creating/updating staff

**Permissions & Templates:**
- Branch is always pulled from `MedicalPersonnel.designation`, not from request body
- Templates are independent of staff permissions - updating a template does not update existing staff
- Template permissions follow the same branch designation rules as staff permissions
- To update staff after changing a template, re-apply the template using `updateMedicalPersonnel` with `templateId`
- Templates can be applied during creation or update of medical personnel

**Template-Based Workflow:**
1. Create permission templates with descriptive labels (e.g., "Nurse Standard")
2. Use template labels as role names when creating staff
3. Apply template using `templateId` to grant permissions automatically
4. Update templates as needed, then re-apply to existing staff to update their permissions

