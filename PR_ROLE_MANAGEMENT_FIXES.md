PR: role-management fixes & Add Staff
Date: 2026-03-27

Purpose
- Fix 500 errors in role-management and add a basic Add Staff flow.

Changes
- Backend:
  - Explicit enum casts to fix PostgreSQL parameter/type errors.
  - Replace db.pool.connect() with db.connect().
  - Add searchUsers GraphQL query.
  - Ensure createMedicalPersonnel sets identity to 'Medical' and grants is_staff.
- Frontend:
  - Add searchUsers() and createMedicalPersonnel() in staff-service.
  - Add Add Staff modal in staff-accounts.jsx (search → select → assign role/template).

Files (key)
- Backend/routes/role-management/resolvers/wrapper/wrapper.js
- Backend/services/permit.js
- Backend/routes/role-management/schema.graphql
- mds-staff/src/modules/role-management/staff-service.js
- mds-staff/src/modules/role-management/components/staff-accounts.jsx

How to test
1. Restart backend.
2. Login as admin; go to Role Management → Add Staff.
3. Search by email/name/ID; add a user; verify staff login at staff.mdsystemtip.space.

Deployment
- Deploy backend before frontend. No DB migrations required.

Commits
- fix(role-management): attempt 1 to fix error 500 — @K1taru
- fix(role-management): attempt 2 to fix error 500 — @K1taru
- fix(role-management): attempt 3 to fix error 500 — @K1taru
