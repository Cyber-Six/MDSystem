# Simplified Module-Level Permissions — Backend Changes Required

> **Date:** March 26, 2026  
> **Scope:** Role Management — permission model simplification  
> **Access:** Admin-only (existing `requireAdmin` guard stays as-is)

---

## Summary

The frontend permission model has been **simplified from granular per-action permissions to module-level toggles**. Instead of toggling individual actions within a module (e.g., "View queue", "Confirm appointment", "Cancel appointment"), the admin now toggles entire modules ON or OFF (e.g., "Appointments: ON").

When a module is toggled **ON**, **all** underlying backend permission keys for that module should be **enabled**.  
When toggled **OFF**, **all** underlying permission keys should be **revoked**.

---

## What Changed on the Frontend

### Before (old model)
```js
permissions = {
  appointments: { view: true, confirm: true, cancel: false, noshow: false, complete: false },
  inventory:    { view: true, add: false, dispense: true },
  // ...each module had individual action booleans
}
```

### After (new model)
```js
permissions = {
  appointments:    true,   // all appointment permissions ON
  pendingRequests: true,
  medicalRecords:  true,
  dentalRecords:   false,  // all dental permissions OFF
  patientSearch:   true,
  inventory:       false,
  roleManagement:  false,
}
```

The frontend now sends a flat object of `{ moduleId: boolean }` when saving staff permissions.

---

## Module → Backend Permission Key Mapping

This is the critical mapping. When a module is enabled, **all** listed permission keys must be granted. When disabled, **all** must be revoked.

| Frontend Module ID | Backend Permission Keys (`permit.js`) | Backend Labels (`rolesTable.label`) |
|---|---|---|
| `appointments` | `appointment_allow_approval`, `appointment_allow_view_records`, `appointment_allow_view_configuration`, `appointment_allow_edit_configuration` | `ALLOW_TO_APPROVE_APPOINTMENT`, `ALLOW_TO_VIEW_APPOINTMENT`, `ALLOW_TO_VIEW_APPOINTMENT_CONFIGURATION`, `ALLOW_TO_EDIT_APPOINTMENT_CONFIGURATION` |
| `pendingRequests` | `emr_allow_approval`, `profile_allow_approval`, `appointment_allow_approval`, `medicine_request_allow_approve` | `ALLOW_TO_APPROVE_EMR`, `ALLOW_TO_APPROVE_PROFILE`, `ALLOW_TO_APPROVE_APPOINTMENT`, `ALLOW_TO_APPROVE_MEDICINE_REQUEST` |
| `medicalRecords` | `emr_allow_view`, `emr_allow_edit`, `emr_allow_edit_catalogs`, `consultation_allow_view`, `consultation_allow_edit`, `profile_allow_view`, `profile_allow_edit` | `ALLOW_TO_VIEW_EMR`, `ALLOW_TO_EDIT_EMR`, `ALLOW_TO_EDIT_CATALOGS`, `ALLOW_TO_VIEW_CONSULTATION`, `ALLOW_TO_EDIT_CONSULTATION`, `ALLOW_TO_VIEW_PROFILE`, `ALLOW_TO_EDIT_PROFILE` |
| `dentalRecords` | `emr_allow_view`, `emr_allow_edit`, `emr_allow_set_dental_record`, `consultation_allow_view`, `consultation_allow_edit` | `ALLOW_TO_VIEW_EMR`, `ALLOW_TO_EDIT_EMR`, `ALLOW_TO_SET_DENTAL_RECORD`, `ALLOW_TO_VIEW_CONSULTATION`, `ALLOW_TO_EDIT_CONSULTATION` |
| `patientSearch` | `profile_allow_view`, `emr_allow_view` | `ALLOW_TO_VIEW_PROFILE`, `ALLOW_TO_VIEW_EMR` |
| `inventory` | `inventory_allow_view`, `inventory_allow_edit`, `inventory_allow_dispense`, `inventory_allow_manage_requests`, `inventory_allow_prescribe` | `ALLOW_TO_VIEW_INVENTORY`, `ALLOW_TO_EDIT_INVENTORY`, `ALLOW_TO_DISPENSE_MEDICINE`, `ALLOW_TO_MANAGE_MEDICINE_REQUESTS`, `ALLOW_TO_PRESCRIBE` |
| `roleManagement` | `is_admin` | `IS_ADMIN` |

### Important: Overlapping permissions

Some backend permission keys appear in **multiple** modules (e.g., `emr_allow_view` is used by both `medicalRecords`, `dentalRecords`, and `patientSearch`). The backend must apply **union logic**:

- A permission should be **enabled** if **any** module that uses it is ON.
- A permission should only be **revoked** if **all** modules that use it are OFF.

---

## Required Backend Changes

### 1. New Mutation: `setStaffModulePermissions`

Create a new mutation that accepts the simplified module-toggle payload. This replaces the frontend's use of `setStaffPermissionsStandard` / `setStaffPermissionsExtended` for module toggling.

**Schema addition:**
```graphql
input ModulePermissionInput {
  moduleId: String!    # e.g. "appointments", "inventory"
  enabled: Boolean!    # true = grant all keys, false = revoke all keys
}

type Mutation {
  setStaffModulePermissions(
    userId: ID!
    modules: [ModulePermissionInput!]!
    branch: Designation!
  ): MutationResult!
}
```

**Resolver logic:**
1. Receive the array of `{ moduleId, enabled }` from the frontend.
2. Using the mapping table above, expand each module into its constituent permission keys.
3. Apply **union logic** for overlapping keys — a key is enabled if ANY module that maps to it is enabled.
4. Call the existing `setStaffPermissionsExtended()` (or `setStaffPermissionsStandard()`) in `permit.js` with the resolved permission list.
5. Log the action.

**Pseudocode:**
```js
async function resolveModulePermissions(modules) {
  // MODULE_TO_KEYS is the mapping table defined above
  const keyStates = new Map(); // key -> boolean

  for (const { moduleId, enabled } of modules) {
    const keys = MODULE_TO_KEYS[moduleId] || [];
    for (const key of keys) {
      // Union: true if ANY module enables it
      if (enabled) {
        keyStates.set(key, true);
      } else if (!keyStates.has(key)) {
        keyStates.set(key, false);
      }
    }
  }

  return Array.from(keyStates.entries()).map(([key, enabled]) => ({ key, enabled }));
}
```

### 2. New Query: `getStaffModulePermissions`

Return module-level enabled status derived from existing granular permissions.

**Schema addition:**
```graphql
type ModulePermission {
  moduleId: String!
  label: String!
  enabled: Boolean!    # true if ALL keys for this module are enabled
}

type ModulePermissionList {
  modules: [ModulePermission!]!
  count: Int!
}

type Query {
  getStaffModulePermissions(userId: ID!): ModulePermissionList!
}
```

**Resolver logic:**
1. Fetch the staff's current `BranchPermission[]` via existing `getStaffPermissions(userId)`.
2. For each module, check if **all** mapped permission keys are enabled.
3. Return `{ moduleId, label, enabled }` for each module.

### 3. Update `listStaffAccounts` Response (Optional but Recommended)

Currently `listStaffAccounts` returns the full `BranchPermission[]` array for each staff member. Add a `modulePermissions` field to `StaffAccount` so the frontend list view can display module-level status without client-side mapping.

```graphql
type StaffAccount {
  # ...existing fields...
  modulePermissions: ModulePermissionList  # New: derived module-level view
}
```

### 4. Update Template System

The existing `createPermissionTemplate` / `updatePermissionTemplate` mutations accept `[ExtendedPermissionInput!]!` (granular keys). Two options:

**Option A (Recommended):** Add parallel template mutations that accept module-level input:
```graphql
input ModuleTemplateInput {
  label: String!
  modules: [ModulePermissionInput!]!
  defaultBranch: Designation
}

type Mutation {
  createModuleTemplate(input: ModuleTemplateInput!): TemplateMutationResult!
  updateModuleTemplate(templateId: ID!, input: ModuleTemplateInput!): TemplateMutationResult!
}
```

**Option B:** Keep existing template mutations. Have the frontend expand module toggles into granular keys before sending. (Simpler backend, more frontend work.)

---

## Module-to-Keys Mapping Constant (for Backend)

Place this in `permit.js` or a new `module-permissions.js` file:

```js
const MODULE_PERMISSION_MAP = {
  appointments: [
    'appointment_allow_approval',
    'appointment_allow_view_records',
    'appointment_allow_view_configuration',
    'appointment_allow_edit_configuration',
  ],
  pendingRequests: [
    'emr_allow_approval',
    'profile_allow_approval',
    'appointment_allow_approval',
    'medicine_request_allow_approve',
  ],
  medicalRecords: [
    'emr_allow_view',
    'emr_allow_edit',
    'emr_allow_edit_catalogs',
    'consultation_allow_view',
    'consultation_allow_edit',
    'profile_allow_view',
    'profile_allow_edit',
  ],
  dentalRecords: [
    'emr_allow_view',
    'emr_allow_edit',
    'emr_allow_set_dental_record',
    'consultation_allow_view',
    'consultation_allow_edit',
  ],
  patientSearch: [
    'profile_allow_view',
    'emr_allow_view',
  ],
  inventory: [
    'inventory_allow_view',
    'inventory_allow_edit',
    'inventory_allow_dispense',
    'inventory_allow_manage_requests',
    'inventory_allow_prescribe',
  ],
  roleManagement: [
    'is_admin',
  ],
};
```

---

## Default Role Templates (for Backend Seed/Reference)

These match what the frontend hardcodes:

| Role | appointments | pendingRequests | medicalRecords | dentalRecords | patientSearch | inventory | roleManagement |
|---|---|---|---|---|---|---|---|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Doctor** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Dentist** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Nurse** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |

---

## Authorization

- **Only admin accounts** can access all role management mutations/queries. The existing `requireAdmin(user, res)` check in `admin-resolver.js` already enforces this — **no changes needed**.
- The `roleManagement` module toggle maps to `is_admin`. Be careful: toggling this ON for a staff member grants them admin access. Consider adding a confirmation/warning on the backend for this specific module.

---

## What Does NOT Need to Change

- **`rolesTable` / `rolesMap` database schema** — unchanged. Module toggling is just a higher-level abstraction over the same granular permission rows.
- **`permit.js` core functions** (`setMedicalPermit`, `unsetMedicalPermit`, `isMedicalPermitted`) — unchanged. The new mutation composes on top of them.
- **`requireAdmin` guard** — unchanged.
- **Existing `setStaffPermissionsStandard` / `setStaffPermissionsExtended` mutations** — keep them for backward compatibility or internal use, but the frontend will now call `setStaffModulePermissions` instead.
- **`is_staff` permission** — this is a system-level flag (not module-gated) and should always be set when activating a staff account. It's not part of any module toggle.

---

## Migration Notes

- No database migration needed. This is purely a presentation/API layer change.
- Existing staff permissions in `rolesMap` remain valid. The new `getStaffModulePermissions` query derives module status from existing rows.
- If a staff member has some but not all keys for a module enabled (legacy partial state), `getStaffModulePermissions` should return `enabled: false` for that module (strict: all-or-nothing).

---

## Frontend Payload Examples

**Saving staff permissions (what the frontend sends):**
```json
{
  "userId": "42",
  "modules": [
    { "moduleId": "appointments", "enabled": true },
    { "moduleId": "pendingRequests", "enabled": true },
    { "moduleId": "medicalRecords", "enabled": true },
    { "moduleId": "dentalRecords", "enabled": false },
    { "moduleId": "patientSearch", "enabled": true },
    { "moduleId": "inventory", "enabled": false },
    { "moduleId": "roleManagement", "enabled": false }
  ],
  "branch": "Both"
}
```

**Reading staff permissions (what the frontend expects):**
```json
{
  "modules": [
    { "moduleId": "appointments", "label": "Appointments", "enabled": true },
    { "moduleId": "pendingRequests", "label": "Pending Requests", "enabled": true },
    { "moduleId": "medicalRecords", "label": "Medical Records", "enabled": true },
    { "moduleId": "dentalRecords", "label": "Dental Records", "enabled": false },
    { "moduleId": "patientSearch", "label": "Patient Search", "enabled": true },
    { "moduleId": "inventory", "label": "Inventory", "enabled": false },
    { "moduleId": "roleManagement", "label": "Settings / Role Mgmt", "enabled": false }
  ],
  "count": 7
}
```
