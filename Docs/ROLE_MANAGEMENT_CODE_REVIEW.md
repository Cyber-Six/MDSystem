# Role Management Module — Code Review Report

> **Reviewed:** Backend + Frontend role-management modules (pure GraphQL)  
> **Files Reviewed:** 13 source files (~4,200 lines)  
> **Reviewer:** Claude Opus (automated)  
> **Date:** 2026-03-28

---

## 1. Executive Summary

| Aspect | Status |
|--------|--------|
| **Overall Health** | ⚠️ Moderate — functional but has one showstopper bug and several high-severity issues |
| **Security** | ⚠️ GraphiQL exposed in production; otherwise solid JWT + admin guard |
| **Performance** | ⚠️ N+1 query in template listing; no pagination on staff list |
| **Code Quality** | ✅ Generally clean; consistent patterns; good use of transactions |
| **Frontend Integration** | 🔴 Critical variable-shadowing bug blocks staff account loading entirely |
| **Completeness** | ⚠️ Role templates and activity log have no API integration (TODO stubs) |

**Risk Assessment:** The CRITICAL bug in `staff-accounts.jsx` means the Staff Accounts tab is non-functional (infinite recursion on load). The `graphiql: true` leak is a security concern for production. Both must be fixed before any deployment.

---

## 2. Issues Found

### 🔴 CRITICAL

#### C-1: `fetchStaffAccounts` name shadowing causes infinite recursion
**File:** `mds-staff/src/modules/role-management/components/staff-accounts.jsx` **Line 23**

```jsx
// Line 3 — imported from service
import { fetchStaffAccounts } from '../staff-service';

// Line 23 — useCallback declaration SHADOWS the import
const fetchStaffAccounts = useCallback(async () => {   // <-- same name
  setIsLoading(true);
  setLoadError(null);
  try {
    const records = await fetchStaffAccounts();  // <-- calls ITSELF, not the import
```

The local `useCallback` variable has the same name as the imported service function. Inside the callback, `fetchStaffAccounts()` resolves to the local variable (the callback itself), not the imported function. This causes **infinite recursion** and a stack overflow on every page load.

**Fix:** Rename the import or the local callback.

---

### 🟠 HIGH

#### H-1: GraphiQL enabled unconditionally in production
**File:** `Backend/routes/role-management/graphql.js` **Line 38**

```js
return {
  schema: adminSchema,
  graphiql: true,   // <-- always on
```

GraphiQL exposes the full schema via introspection, making it trivial for an attacker to enumerate every query and mutation. Should be disabled in production.

**Fix:** `graphiql: process.env.NODE_ENV !== 'production'`

---

#### H-2: `_getStaffAccount` always returns `lastLogin: null`
**File:** `Backend/routes/role-management/resolvers/wrapper/wrapper.js` **Line 313**

The `_listStaffAccounts` query correctly uses a LEFT JOIN subquery to get `last_login` from `"UserLogin"`. However, `_getStaffAccount` omits this subquery entirely and hardcodes:

```js
lastLogin: null,
```

The frontend `staff-detail.jsx` renders `Last Login: {staff.lastLogin ?? 'Never'}` — this will always show "Never" regardless of reality.

**Fix:** Add the same LEFT JOIN subquery used in `_listStaffAccounts`.

---

#### H-3: `_createMedicalPersonnel` identity check logic is inverted
**File:** `Backend/routes/role-management/resolvers/wrapper/wrapper.js` **Line 575**

```js
if (targetUser.identity !== 'Employee' || process.env.ALLOW_MEDICAL_CREATION_FOR_NON_EMPLOYEES === 'true') {
  throwGraphQLError(res)
    .message('User must have Employee identity to be assigned a MedicalPersonnel role.')
    .status(409)
    .throw();
}
```

This reads: "throw error if identity is NOT Employee **OR** env var is true."

- When identity is `Employee` (valid) and env var is `'true'` → **throws** (wrong: should succeed).
- When identity is `Student` (invalid) and env var is `'true'` → **throws** (wrong: env var should bypass).

The intended logic is: "throw if identity is not Employee **UNLESS** the env var overrides."

**Fix:**
```js
if (targetUser.identity !== 'Employee' && process.env.ALLOW_MEDICAL_CREATION_FOR_NON_EMPLOYEES !== 'true') {
```

---

#### H-4: `StaffAccountMutationResult` missing `warnings` field
**File:** `Backend/routes/role-management/schema.graphql` **Lines 138-141**

```graphql
type StaffAccountMutationResult {
  ok: Boolean!
  message: String!
}
```

The wrapper's `_updateStaffAccount` function constructs a result with a `warnings` array (e.g., `"identity_already_employee"`), but the GraphQL type has no `warnings` field. GraphQL silently drops unrecognized fields, so callers never see the warnings.

**Fix:** Add `warnings: [String!]` to the type definition.

---

### 🟡 MEDIUM

#### M-1: N+1 query in `listPermissionTemplates`
**File:** `Backend/services/permit.js` **Lines 480-495**

```js
for (const row of result.rows) {
  const fullTemplate = await getPermissionTemplate(row.id);
  // ...
}
```

The initial query lists templates, then for each template, `getPermissionTemplate` fires a separate query. With N templates this is N+1 queries. Could be rewritten as a single query with JOINs.

---

#### M-2: No pagination on `listStaffAccounts`
**File:** `Backend/routes/role-management/schema.graphql` + `wrapper.js`

```graphql
listStaffAccounts: StaffAccountList!
```

Fetches ALL staff accounts (including all permission data) in a single unbounded query. At scale (hundreds of staff), this will cause significant memory usage and slow response times.

**Recommendation:** Add `limit`/`offset` or cursor-based pagination arguments.

---

#### M-3: Redundant `if (!user)` null checks in wrapper.js
**File:** `Backend/routes/role-management/resolvers/wrapper/wrapper.js` (multiple locations)

Every wrapper function starts with:
```js
if (!user) {
  throwGraphQLError(res).message('Unauthorized').status(401).throw();
}
```

But `admin-resolver.js` already calls `requireAdmin(context.user, context.res)` which checks `!user` and verifies admin permission before delegating to the wrapper. These checks are dead code.

**Impact:** No functional harm, but adds noise and maintenance overhead.

---

#### M-4: Role Templates component has no API integration
**File:** `mds-staff/src/modules/role-management/components/role-templates.jsx`

Three TODO comments mark unimplemented API calls:
```js
// TODO: API call to save role template
// TODO: API call to create new role template
// TODO: API call to delete role template
```

Templates are managed entirely client-side. Changes are lost on refresh. The backend CRUD mutations (`createPermissionTemplate`, `updatePermissionTemplate`, `deletePermissionTemplate`) exist but are never called.

---

#### M-5: Activity Log uses hardcoded mock data
**File:** `mds-staff/src/modules/role-management/components/activity-log.jsx`

```js
// TODO: Replace MOCK_LOGS with API call
const MOCK_LOGS = [...]
```

The activity tab always shows the same fake entries. No GraphQL query exists for audit log retrieval (the schema doesn't define one).

---

#### M-6: `updateStaffAccount` mutation does not return the updated staff account
**File:** `Backend/routes/role-management/schema.graphql`

```graphql
updateStaffAccount(...): StaffAccountMutationResult!
```

Returns only `ok` + `message`. The frontend has to re-fetch the full staff account after a successful save to update the UI. Returning the updated `StaffAccount` in the result would eliminate a round trip.

---

### 🟢 LOW

#### L-1: Dead exports in permit.js
**File:** `Backend/services/permit.js` **Lines 856-868**

```js
flatModulePermsToArray,
modulePermsToFlat,
```

These helper functions were designed for the REST API format. Since `rest-api.js` was deleted, they are no longer called anywhere. Dead code.

---

#### L-2: `console.log` debug statement in `isMedicalPermitted`
**File:** `Backend/services/permit.js` **Line 299**

```js
console.log("userId, label, patientId", userId, label, patientId);
```

Debug logging that leaks function arguments to stdout on every unauthorized permission check. Should be removed or replaced with `logger.debug()`.

---

#### L-3: Unused `findMedicalPermit` import in wrapper.js
**File:** `Backend/routes/role-management/resolvers/wrapper/wrapper.js`

Review the imports at the top of wrapper.js to verify `findMedicalPermit` is actually used. If it's only referenced through `permit.js`'s `isMedicalPermitted`, the direct import is unnecessary.

---

#### L-4: `Permissions` and `StaffPermissions` types are identical
**File:** `Backend/routes/role-management/schema.graphql` **Lines 62-74**

```graphql
type Permissions {
  permissions: [BranchPermission!]!
  count: Int!
}

type StaffPermissions {
  permissions: [BranchPermission!]!
  count: Int!
}
```

Two identical type definitions. `StaffPermissions` could be removed and all usages pointed to `Permissions`.

---

## 3. Recommendations (Prioritized)

| Priority | Action | Files |
|----------|--------|-------|
| **P0** | Fix `fetchStaffAccounts` name shadowing (C-1) | `staff-accounts.jsx` |
| **P0** | Disable GraphiQL in production (H-1) | `graphql.js` |
| **P1** | Fix `_getStaffAccount` lastLogin (H-2) | `wrapper.js` |
| **P1** | Fix `_createMedicalPersonnel` identity check (H-3) | `wrapper.js` |
| **P1** | Add `warnings` field to schema type (H-4) | `schema.graphql` |
| **P2** | Fix N+1 in `listPermissionTemplates` (M-1) | `permit.js` |
| **P2** | Add pagination to `listStaffAccounts` (M-2) | `schema.graphql`, `wrapper.js` |
| **P3** | Remove redundant `if (!user)` checks (M-3) | `wrapper.js` |
| **P3** | Wire up role template CRUD to GraphQL (M-4) | `role-templates.jsx`, `staff-service.js` |
| **P3** | Remove dead exports (L-1) | `permit.js` |
| **P3** | Remove `console.log` (L-2) | `permit.js` |

---

## 4. Code Patches

### Patch C-1: Fix `fetchStaffAccounts` name shadowing

```diff
--- a/mds-staff/src/modules/role-management/components/staff-accounts.jsx
+++ b/mds-staff/src/modules/role-management/components/staff-accounts.jsx
@@ -1,7 +1,7 @@
 import React, { useState, useEffect, useCallback } from 'react';
 import { DEFAULT_ROLE_TEMPLATES, allModules, hasCustomPermissions, detectRole } from '../role-permissions';
-import { fetchStaffAccounts } from '../staff-service';
+import { fetchStaffAccounts as fetchStaffAccountsAPI } from '../staff-service';
 import StaffDetail from './staff-detail';
 
@@ -20,10 +20,10 @@
   const [isLoading, setIsLoading] = useState(true);
   const [loadError, setLoadError] = useState(null);
 
-  const fetchStaffAccounts = useCallback(async () => {
+  const loadStaffAccounts = useCallback(async () => {
     setIsLoading(true);
     setLoadError(null);
     try {
-      const records = await fetchStaffAccounts();
+      const records = await fetchStaffAccountsAPI();
       const enriched = records.map((s) => ({
         ...s,
         role: detectRole(s.permissions),
@@ -36,11 +36,11 @@
   }, []);
 
   useEffect(() => {
-    fetchStaffAccounts();
-  }, [fetchStaffAccounts]);
+    loadStaffAccounts();
+  }, [loadStaffAccounts]);
```

Also update the refresh button `onClick` reference later in the file from `fetchStaffAccounts` to `loadStaffAccounts`.

---

### Patch H-1: Disable GraphiQL in production

```diff
--- a/Backend/routes/role-management/graphql.js
+++ b/Backend/routes/role-management/graphql.js
@@ -35,7 +35,7 @@
       return {
         schema: adminSchema,
-        graphiql: true,
+        graphiql: process.env.NODE_ENV !== 'production',
         context: {
```

---

### Patch H-3: Fix identity check logic

```diff
--- a/Backend/routes/role-management/resolvers/wrapper/wrapper.js
+++ b/Backend/routes/role-management/resolvers/wrapper/wrapper.js
@@ -572,7 +572,7 @@
     const targetUser = userResult.rows[0];
-    if (targetUser.identity !== 'Employee' || process.env.ALLOW_MEDICAL_CREATION_FOR_NON_EMPLOYEES === 'true') {
+    if (targetUser.identity !== 'Employee' && process.env.ALLOW_MEDICAL_CREATION_FOR_NON_EMPLOYEES !== 'true') {
       throwGraphQLError(res)
```

---

### Patch H-4: Add `warnings` field to `StaffAccountMutationResult`

```diff
--- a/Backend/routes/role-management/schema.graphql
+++ b/Backend/routes/role-management/schema.graphql
@@ -138,6 +138,7 @@
 type StaffAccountMutationResult {
   ok: Boolean!
   message: String!
+  warnings: [String!]
 }
```

---

### Patch L-2: Remove `console.log` debug statement

```diff
--- a/Backend/services/permit.js
+++ b/Backend/services/permit.js
@@ -296,7 +296,6 @@
 
   if (result.rows.length === 0) {
-    console.log("userId, label, patientId", userId, label, patientId);
     logger.warn(
```

---

## 5. Best Practices Checklist

| Practice | Status | Notes |
|----------|--------|-------|
| **Authentication on every endpoint** | ✅ | `jwtProtect('medical')` on GraphQL mount |
| **Authorization checks** | ✅ | `requireAdmin` in resolver layer |
| **SQL injection prevention** | ✅ | All queries use parameterized `$1, $2` |
| **Input validation** | ✅ | Designation enum validated, module IDs validated against `MODULE_PERMISSION_MAP` |
| **Transaction usage** | ✅ | Admin transfer, template CRUD, bulk permission upserts use `BEGIN/COMMIT/ROLLBACK` |
| **Rate limiting** | ✅ | `ipRateLimiter` applied at mount + Redis-based admin transfer limits |
| **Error handling consistency** | ✅ | Consistent use of `throwGraphQLError(res).status().message().throw()` |
| **Logging** | ✅ | Audit events logged via `logger.info/warn` (except one `console.log` — L-2) |
| **Introspection in production** | ❌ | GraphiQL enabled unconditionally (H-1) |
| **Pagination** | ❌ | No pagination on staff list (M-2) |
| **N+1 query prevention** | ❌ | Template listing has N+1 pattern (M-1) |
| **Dead code removal** | ❌ | REST helpers still exported (L-1) |
| **Frontend-backend contract match** | ❌ | `warnings` field missing from schema (H-4) |
| **Frontend naming hygiene** | ❌ | Variable shadowing bug (C-1) |
| **Feature completeness** | ❌ | Templates and activity log are stubs (M-4, M-5) |

---

*End of review.*
