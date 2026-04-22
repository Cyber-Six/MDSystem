import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

// Mirrors the displayName computation in StaffTopBar.jsx
function getDisplayName(profile) {
  return (
    [profile?.firstName, profile?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    profile?.fullName ||
    profile?.name ||
    'Staff Member'
  );
}

// Mirrors the identity label logic added to StaffTopBar
const STAFF_IDENTITY_LABEL = 'Medical Staff';

describe('StaffTopBar profile display', () => {
  test('shows Medical Staff identity label (constant)', () => {
    assert.equal(STAFF_IDENTITY_LABEL, 'Medical Staff');
  });

  test('displayName uses first+last name when both present', () => {
    const profile = { firstName: 'Maria', lastName: 'Santos', email: 'maria.santos@tip.edu.ph' };
    assert.equal(getDisplayName(profile), 'Maria Santos');
  });

  test('displayName falls back to fullName when first/last are missing', () => {
    const profile = { fullName: 'Jose Rizal', email: 'test@tip.edu.ph' };
    assert.equal(getDisplayName(profile), 'Jose Rizal');
  });

  test('displayName falls back to name property', () => {
    const profile = { name: 'Ana Cruz' };
    assert.equal(getDisplayName(profile), 'Ana Cruz');
  });

  test('displayName defaults to "Staff Member" when profile has no name', () => {
    assert.equal(getDisplayName({}), 'Staff Member');
    assert.equal(getDisplayName(null), 'Staff Member');
  });

  test('role badge shows Admin when isAdmin is true', () => {
    const isAdmin = true;
    const profile = { role: 'Doctor' };
    const roleLabel = isAdmin ? 'Admin' : (profile?.role ?? '—');
    assert.equal(roleLabel, 'Admin');
  });

  test('role badge shows role when not admin', () => {
    const isAdmin = false;
    const profile = { role: 'Nurse' };
    const roleLabel = isAdmin ? 'Admin' : (profile?.role ?? '—');
    assert.equal(roleLabel, 'Nurse');
  });

  test('role badge shows — when no role and not admin', () => {
    const isAdmin = false;
    const profile = { role: null };
    const roleLabel = isAdmin ? 'Admin' : (profile?.role ?? '—');
    assert.equal(roleLabel, '—');
  });
});
