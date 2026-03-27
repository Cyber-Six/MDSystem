# Role Management Implementation Guide — mds-staff Frontend Onboarding

> **Date:** March 27, 2026  
> **Scope:** Onboarding the simplified module-level permission system across all mds-staff modules  
> **Prerequisite:** Backend implementation complete (see [SIMPLIFIED_MODULE_PERMISSIONS.md](../Backend/routes/role-management/SIMPLIFIED_MODULE_PERMISSIONS.md))  
> **API:** Pure GraphQL at `/rolemanagement/admin` — no REST endpoints

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [GraphQL API Reference](#2-graphql-api-reference)
3. [Frontend Permission Model](#3-frontend-permission-model)
4. [Module-to-Permission Mapping](#4-module-to-permission-mapping)
5. [How to Gate Features by Module Permission](#5-how-to-gate-features-by-module-permission)
6. [Implementation Steps per Module](#6-implementation-steps-per-module)
7. [Recommended Onboarding Order](#7-recommended-onboarding-order)
8. [Shared Infrastructure Changes](#8-shared-infrastructure-changes)
9. [Testing Strategy](#9-testing-strategy)
10. [Overlapping Permissions — Important Notes](#10-overlapping-permissions--important-notes)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                  mds-staff Frontend               │
│                                                    │
│  staff-service.js      ← GraphQL client service    │
│  role-permissions.js   ← Module definitions        │
│  PermissionMatrix      ← Toggle UI component       │
│  usePermissions()      ← Context hook (to create)  │
│                                                    │
│  Each module checks:                               │
│    "Is my moduleId enabled for this user?"          │
│                                                    │
└──────────────────────┬───────────────────────────┘
                       │ GraphQL (POST /rolemanagement/admin)
                       ▼
┌──────────────────────────────────────────────────┐
│                  Backend (staff.js)                │
│                                                    │
│  GraphQL: /rolemanagement/admin                    │
│    ├─ graphql.js          ← Schema + middleware    │
│    ├─ admin-resolver.js   ← requireAdmin guard     │
│    └─ wrapper.js          ← Business logic         │
│                                                    │
│  services/permit.js                                │
│    MODULE_PERMISSION_MAP  ← Module→Keys mapping    │
│    setStaffModulePermissions()                      │
│    getStaffModulePermissions()                      │
│    resolveModulePermissions()  ← Union logic        │
│                                                    │
│  Underlying: rolesMap + rolesTable (unchanged)      │
└──────────────────────────────────────────────────┘
```

### Data Flow

1. **Admin opens Role Management → Staff Accounts**
2. Frontend calls `fetchStaffAccounts()` → GraphQL `listStaffAccounts` query
3. Backend returns staff list with `modulePermissions { modules { moduleId, enabled } }`
4. Frontend service transforms to flat `{ moduleId: boolean }` format
5. Frontend uses `detectRole()` to match against default templates (Admin/Doctor/Dentist/Nurse)
6. Admin toggles modules ON/OFF in the `PermissionMatrix` component
7. Frontend calls `updateStaffAccount()` → GraphQL `updateStaffAccount` mutation
8. Backend expands modules to granular permission keys via `resolveModulePermissions()` (union logic)
9. Granular keys are written to `rolesMap` table

---

## 2. GraphQL API Reference

### Endpoint

```
POST /rolemanagement/admin
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

All operations require Medical identity JWT (`jwtProtect('medical')`) and `IS_ADMIN` permission.

### Queries

#### `listStaffAccounts`

Returns all staff accounts (Active, Suspended, and Pending) with module-level permissions.

```graphql
query ListStaffAccounts {
  listStaffAccounts {
    staff {
      id
      email
      name
      branch
      identity
      status          # Active | Suspended | Pending
      modulePermissions {
        modules {
          moduleId    # e.g. "appointments"
          label       # e.g. "Appointments"
          enabled     # true/false
        }
      }
      credentialsStatus
      lastLogin
    }
    count
  }
}
```

#### `getStaffAccount`

Get a single staff account by user ID.

```graphql
query GetStaffAccount($userId: ID!) {
  getStaffAccount(userId: $userId) {
    id
    email
    name
    branch
    identity
    status
    modulePermissions {
      modules {
        moduleId
        enabled
      }
    }
    credentialsStatus
    lastLogin
  }
}
```

#### `getStaffModulePermissions`

Get module-level permissions for a specific staff member (standalone query).

```graphql
query GetModulePermissions($userId: ID!) {
  getStaffModulePermissions(userId: $userId) {
    modules {
      moduleId
      label
      enabled
    }
    count
  }
}
```

### Mutations

#### `updateStaffAccount` (Primary — used by the frontend)

Combined update for module permissions and/or account status. Branch is auto-detected from `MedicalPersonnel.designation`.

```graphql
mutation UpdateStaffAccount(
  $userId: ID!
  $modules: [ModulePermissionInput!]
  $status: AccountStatus
) {
  updateStaffAccount(userId: $userId, modules: $modules, status: $status) {
    ok
    message
  }
}
```

**Variables example:**
```json
{
  "userId": "42",
  "modules": [
    { "moduleId": "patientSearch", "enabled": true },
    { "moduleId": "appointments", "enabled": true },
    { "moduleId": "inventory", "enabled": false }
  ],
  "status": "Active"
}
```

**Status behavior:**
- `Active` → Sets identity to `Medical`, ensures `is_staff` permission
- `Suspended` → Reverts identity to `Employee` (permissions retained but access blocked)

#### `setStaffModulePermissions` (Advanced — explicit branch control)

Set module permissions with an explicit branch parameter.

```graphql
mutation SetModulePermissions($userId: ID!, $modules: [ModulePermissionInput!]!, $branch: Designation!) {
  setStaffModulePermissions(userId: $userId, modules: $modules, branch: $branch) {
    ok
    message
  }
}
```

---

## 3. Frontend Permission Model

### Frontend Service (`staff-service.js`)

The frontend uses a dedicated GraphQL service that:
1. Sends queries/mutations to `/rolemanagement/admin` via `axiosRequest.post()`
2. Transforms `modulePermissions.modules[]` to flat `{ moduleId: boolean }` objects
3. Transforms flat `{ moduleId: boolean }` inputs to `[ModulePermissionInput!]` arrays

| Function | Description |
|---|---|
| `fetchStaffAccounts()` | Queries `listStaffAccounts`, returns array with flat `permissions` field |
| `fetchStaffAccount(userId)` | Queries `getStaffAccount`, returns single object with flat `permissions` |
| `updateStaffAccount(userId, flatPerms, status)` | Calls `updateStaffAccount` mutation |

### Module Toggle Constants (`role-permissions.js`)

The frontend defines 9 module toggles:

| Module ID | Label | Description |
|---|---|---|
| `patientSearch` | Search Patient | Search and view patient profiles |
| `pendingRequests` | Pending Requests | Approve or reject requests |
| `medicalRecords` | Medical Records | View, edit, add consultation notes |
| `dentalRecords` | Dental Records | View, edit dental records |
| `appointments` | Appointments | Queue, confirm, cancel, complete |
| `inventory` | Inventory | View stock, add/restock, dispense |
| `healthChat` | Health Chat | Health chat consultation/messaging |
| `analytics` | Analytics | Reports, dashboards, system analytics |
| `roleManagement` | Role Management | Manage roles, staff permissions |

### Default Role Templates

| Role | patientSearch | pendingRequests | medicalRecords | dentalRecords | appointments | inventory | healthChat | analytics | roleManagement |
|---|---|---|---|---|---|---|---|---|---|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Doctor** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Dentist** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Nurse** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 4. Module-to-Permission Mapping

Each frontend module maps to backend permission keys. When a module is ON, ALL listed keys are granted:

```
patientSearch    → profile_allow_view, emr_allow_view
pendingRequests  → emr_allow_approval, profile_allow_approval,
                   appointment_allow_approval, medicine_request_allow_approve
medicalRecords   → emr_allow_view, emr_allow_edit, emr_allow_edit_catalogs,
                   consultation_allow_view, consultation_allow_edit,
                   profile_allow_view, profile_allow_edit
dentalRecords    → emr_allow_view, emr_allow_edit, emr_allow_set_dental_record,
                   consultation_allow_view, consultation_allow_edit
appointments     → appointment_allow_approval, appointment_allow_view_records,
                   appointment_allow_view_configuration, appointment_allow_edit_configuration
inventory        → inventory_allow_view, inventory_allow_edit, inventory_allow_dispense,
                   inventory_allow_manage_requests, inventory_allow_prescribe
roleManagement   → is_admin
```

**Important:** Some keys overlap across modules. The backend uses **union logic**: a key is enabled if ANY module that uses it is enabled.

---

## 5. How to Gate Features by Module Permission

### Approach A: Route-Level Gating (Recommended)

Create a shared permission context that loads the user's module permissions on login and gates entire routes/pages.

**Step 1: Create `usePermissions` context hook**

```jsx
// src/context/PermissionContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { axiosRequest } from '../packages-core-adapter';

const PermissionContext = createContext(null);

const GQL_MY_PERMISSIONS = `
  query { getMyModulePermissions { modules { moduleId enabled } } }
`;

export const PermissionProvider = ({ children }) => {
  const [modules, setModules] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosRequest.post('/staff/me', { query: GQL_MY_PERMISSIONS })
      .then(res => {
        const mods = res.data.data?.getMyModulePermissions?.modules || [];
        const flat = {};
        mods.forEach(m => { flat[m.moduleId] = m.enabled; });
        setModules(flat);
      })
      .catch(() => setModules(null))
      .finally(() => setLoading(false));
  }, []);

  const hasModule = (moduleId) => modules?.[moduleId] === true;

  return (
    <PermissionContext.Provider value={{ modules, loading, hasModule }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => useContext(PermissionContext);
```

> **Note:** The `GET /staff/me` endpoint (Phase 5 below) needs to be created. It should NOT require admin — any authenticated medical staff can read their own module permissions.

**Step 2: Create a permission gate component**

```jsx
// src/components/PermissionGate.jsx
import { usePermissions } from '../context/PermissionContext';

const PermissionGate = ({ moduleId, fallback = null, children }) => {
  const { hasModule, loading } = usePermissions();

  if (loading) return null;
  if (!hasModule(moduleId)) return fallback;
  return children;
};

export default PermissionGate;
```

**Step 3: Gate routes in the navigation**

```jsx
import PermissionGate from '../components/PermissionGate';

<Route path="/appointments" element={
  <PermissionGate moduleId="appointments" fallback={<AccessDenied />}>
    <AppointmentsPage />
  </PermissionGate>
} />

<Route path="/inventory" element={
  <PermissionGate moduleId="inventory" fallback={<AccessDenied />}>
    <InventoryPage />
  </PermissionGate>
} />

<Route path="/role-management" element={
  <PermissionGate moduleId="roleManagement" fallback={<AccessDenied />}>
    <RoleManagementPage />
  </PermissionGate>
} />
```

### Approach B: Component-Level Gating

For finer control within a page:

```jsx
import { usePermissions } from '../context/PermissionContext';

const DashboardPage = () => {
  const { hasModule } = usePermissions();

  return (
    <div>
      {hasModule('appointments') && <AppointmentWidget />}
      {hasModule('inventory') && <InventoryWidget />}
      {hasModule('pendingRequests') && <PendingRequestsWidget />}
    </div>
  );
};
```

### Approach C: Navigation Filtering

Hide sidebar items the user doesn't have access to:

```jsx
const navigationItems = [
  { path: '/search', label: 'Search Patient', moduleId: 'patientSearch' },
  { path: '/pending', label: 'Pending Requests', moduleId: 'pendingRequests' },
  { path: '/records', label: 'Medical Records', moduleId: 'medicalRecords' },
  { path: '/dental', label: 'Dental Records', moduleId: 'dentalRecords' },
  { path: '/appointments', label: 'Appointments', moduleId: 'appointments' },
  { path: '/inventory', label: 'Inventory', moduleId: 'inventory' },
  { path: '/health-chat', label: 'Health Chat', moduleId: 'healthChat' },
  { path: '/analytics', label: 'Analytics', moduleId: 'analytics' },
  { path: '/role-management', label: 'Role Management', moduleId: 'roleManagement' },
];

const Sidebar = () => {
  const { hasModule } = usePermissions();
  const visibleItems = navigationItems.filter(item => hasModule(item.moduleId));

  return (
    <nav>
      {visibleItems.map(item => (
        <NavLink key={item.path} to={item.path}>{item.label}</NavLink>
      ))}
    </nav>
  );
};
```

---

## 6. Implementation Steps per Module

### For Each Existing Module:

1. **Identify the module ID** from the mapping table above
2. **Wrap the route** with `<PermissionGate moduleId="...">`
3. **Hide the navigation item** if the module is disabled
4. **Backend already enforces** granular permissions via `isMedicalPermitted()` — no backend changes needed per module

### Module-Specific Notes:

#### Patient Search (`patientSearch`)
- Gates: Patient search page, profile viewing
- Backend checks: `profile_allow_view`, `emr_allow_view` already enforced in profile/emr GraphQL resolvers
- Frontend: Wrap search route + hide sidebar item

#### Pending Requests (`pendingRequests`)
- Gates: Approval pages for appointments, medicine requests, profile/EMR updates
- Backend checks: `*_allow_approval` already enforced in respective resolvers
- Frontend: Wrap pending requests route

#### Medical Records (`medicalRecords`)
- Gates: EMR viewing/editing, consultation notes
- Backend checks: `emr_allow_view`, `emr_allow_edit`, `consultation_allow_*` already enforced
- Frontend: Wrap EMR/consultation routes

#### Dental Records (`dentalRecords`)
- Gates: Dental record viewing/editing
- Backend checks: `emr_allow_set_dental_record` already enforced
- Frontend: Wrap dental records route

#### Appointments (`appointments`)
- Gates: Appointment queue, configuration
- Backend checks: `appointment_allow_*` already enforced
- Frontend: Wrap appointments route

#### Inventory (`inventory`)
- Gates: Stock viewing, dispensing, restocking
- Backend checks: `inventory_allow_*` already enforced
- Frontend: Wrap inventory route

#### Health Chat (`healthChat`)
- Gates: Health chat/e-consultation features
- Backend checks: To be defined (currently no specific permission keys)
- Frontend: Wrap health chat route when implemented

#### Analytics (`analytics`)
- Gates: Reports, dashboards
- Backend checks: To be defined
- Frontend: Wrap analytics route when implemented

#### Role Management (`roleManagement`)
- Gates: Staff accounts, role templates, admin functions
- Backend checks: `is_admin` already enforced (requireAdmin guard)
- Frontend: Wrap role management route

---

## 7. Recommended Onboarding Order

### Phase 1: Foundation (Do First)
1. Create `PermissionContext` and `usePermissions()` hook
2. Create `PermissionGate` component
3. Add a backend GraphQL query for the logged-in user to fetch their own permissions (see Phase 5)
4. Add `PermissionProvider` to the app's root

### Phase 2: Navigation (Immediate Impact)
5. Filter sidebar/navigation items based on `hasModule()`
6. Users now only see modules they have access to

### Phase 3: Route Guards (Security Layer)
7. Wrap each page route with `<PermissionGate moduleId="...">`
8. Create a generic `<AccessDenied />` fallback page

### Phase 4: Component-Level Gating (Polish)
9. Hide action buttons within pages (e.g., "Dispense" button only if `inventory`)
10. Conditionally render dashboard widgets

### Phase 5: Backend — Self-Permission Endpoint

Create a **non-admin** GraphQL query for authenticated staff to fetch their own module permissions. This is needed for the `PermissionContext` provider in Phase 1.

**Options:**
- Add to the existing medical staff GraphQL endpoint (e.g., `/staff/medical`)
- Create a simple self-query in the role-management schema with a relaxed permission check (authenticated medical, not necessarily admin)

**Example implementation (in wrapper.js):**
```js
_getMyModulePermissions: async (_, __, { user, res }) => {
  if (!user) {
    throwGraphQLError(res).message('Unauthorized').status(401).throw();
  }
  // No admin check — any authenticated staff can read their own permissions
  return await getStaffModulePermissions(user.id);
},
```

---

## 8. Shared Infrastructure Changes

### Files to Create
| File | Purpose |
|---|---|
| `src/context/PermissionContext.jsx` | Permission state management |
| `src/components/PermissionGate.jsx` | Declarative permission gating |
| `src/components/AccessDenied.jsx` | Fallback page for unauthorized access |

### Files to Modify
| File | Change |
|---|---|
| `src/App.jsx` | Wrap with `<PermissionProvider>` |
| Router/navigation files | Add `<PermissionGate>` to routes |
| Sidebar component | Filter nav items with `hasModule()` |

### Files That Do NOT Change
| File | Reason |
|---|---|
| `role-permissions.js` | Already defines module constants |
| `permission-matrix.jsx` | Already uses module toggles |
| `staff-service.js` | Already created — handles GraphQL ↔ flat permission conversion |
| `staff-accounts.jsx` | Already updated — uses `staff-service.js` |
| `staff-detail.jsx` | Already updated — uses `staff-service.js` |
| Backend GraphQL resolvers | Granular permission checks stay as-is |
| `services/permit.js` | Already has all needed functions |

---

## 9. Testing Strategy

### Manual Testing Checklist

1. **Admin creates Doctor account** → Doctor should see: Patient Search, Pending Requests, Medical Records, Appointments
2. **Admin creates Nurse account** → Nurse should see: above + Inventory
3. **Admin creates Dentist account** → Dentist should see: Patient Search, Pending Requests, Dental Records, Appointments
4. **Admin disables Appointments for Doctor** → Doctor loses access to appointment pages
5. **Admin enables Role Management for staff** → Staff gains admin access (⚠️ shows warning)
6. **Suspended account** → Cannot access staff portal at all
7. **Pending account** → Cannot access until activated by admin

### GraphQL Round-Trip Verification

For each default role template:
1. Admin saves the template permissions via `updateStaffAccount` mutation
2. Reload the page (re-query `listStaffAccounts`)
3. Verify all 9 module toggles match what was saved
4. Verify `detectRole()` correctly identifies the role

### GraphQL Request Testing

```bash
# List all staff
curl -X POST http://localhost:3000/rolemanagement/admin \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ listStaffAccounts { staff { id name status modulePermissions { modules { moduleId enabled } } } count } }"}'

# Update staff
curl -X POST http://localhost:3000/rolemanagement/admin \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { updateStaffAccount(userId: \"42\", modules: [{moduleId: \"patientSearch\", enabled: true}, {moduleId: \"appointments\", enabled: true}], status: Active) { ok message } }"}'
```

---

## 10. Overlapping Permissions — Important Notes

### Why It Works

Some backend permission keys appear in multiple modules. The system uses **union logic**:

- A key is **enabled** if ANY module that uses it is ON
- A key is **revoked** only if ALL modules that use it are OFF

### Example

Both `medicalRecords` and `dentalRecords` grant `emr_allow_view` and `emr_allow_edit`.

If a Dentist has:
- `medicalRecords: false`
- `dentalRecords: true`

Then `emr_allow_view` and `emr_allow_edit` are still granted (through dentalRecords).

But `emr_allow_edit_catalogs` is NOT granted (unique to medicalRecords), so the backend correctly treats `medicalRecords` as OFF on read-back.

### Module Distinguishing Keys

Each module has at least one unique key that distinguishes it:

| Module | Unique/Distinguishing Key(s) |
|---|---|
| `patientSearch` | Both keys also in `medicalRecords` — but `medicalRecords` has additional keys that keep them distinguished |
| `medicalRecords` | `emr_allow_edit_catalogs`, `profile_allow_edit` |
| `dentalRecords` | `emr_allow_set_dental_record` |
| `pendingRequests` | `emr_allow_approval`, `profile_allow_approval`, `medicine_request_allow_approve` |
| `appointments` | `appointment_allow_view_records`, `appointment_allow_view_configuration`, `appointment_allow_edit_configuration` |
| `inventory` | All 5 keys are unique to inventory |
| `roleManagement` | `is_admin` |

### All Default Roles Round-Trip Correctly ✅

Verified programmatically: Admin, Doctor, Dentist, Nurse all produce identical module states after set → get cycle.
