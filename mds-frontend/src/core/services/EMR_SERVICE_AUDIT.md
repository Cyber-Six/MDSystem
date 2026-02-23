# EMR Service Audit Report

**Date:** February 22, 2026  
**File:** `emr-service.js`  
**Status:** ⚠️ Multiple issues found

---

## Summary

The `emr-service.js` file manages GraphQL mutations for patient EMR data creation. Proofreading identified **6 critical process errors**, **3 logic inconsistencies**, and **3 cosmetic issues** that could cause silent failures or incorrect record submission behavior.

---

## 🔴 Critical Errors (Will Cause Failures)

### 1. `mapDentalCleaningRange()` Returns Empty String Instead of Null
**Location:** Line ~868  
**Issue:**
```javascript
const mapping = {
  '0 to 6 months ago': '0-6',
  '7 to 11 months ago': '7-12',
  '1 year or more': '12-24',
  '': '' // ← PROBLEM: Empty string for unrecognized values
};
return mapping[frontendValue] || '';
```

**Impact:** If `formData.dentalHistory.lastDentalCleaning` is missing or doesn't match any key, the function returns `''` (empty string). GraphQL enum fields typically reject empty strings and throw: `"'' is not a valid value for enum UpdateScope"` or similar.

**Fix:** Return `null` instead of `''`:
```javascript
'': null,
```
Or better, at the end:
```javascript
return mapping[frontendValue] || null;
```

**Risk Level:** HIGH — Blocks all patient initial record submissions with missing dental cleaning data.

---

### 2. Hardcoded `acuityId: "1"` is a Magic Catalog Value
**Location:** Line ~395  
**Issue:**
```javascript
const visualAcuityProfile = await createVisualAcuityProfile({
  notes: `Eyeglasses: ...`,
  acuity: {
    acuityId: "1", // ← PROBLEM: Assumes catalog ID "1" always exists
    left_eye: formData.medicalBackground.gradeOS || "N/A",
    ...
  }
});
```

**Impact:** If catalog ID `"1"` doesn't exist in the backend database, `createVisualAcuityProfile` fails with a foreign key or validation error. This varies per environment (dev, staging, prod).

**Fix:** Either:
- Fetch available catalog IDs from backend first, or
- Make it `null` and let backend auto-assign, or
- Pass it as a form input:
```javascript
acuityId: formData.medicalBackground.acuityId || null,
```

**Risk Level:** HIGH — Any patient with eyeglasses/contacts fails record submission.

---

### 3. Identical Mock UUIDs in Dental Photo Record
**Location:** Line ~441  
**Issue:**
```javascript
const dentalPhotoRecord = await createDentalPhotoRecord({
  upperTeeth: '00000000-0000-0000-0000-000000000000',
  lowerTeeth: '00000000-0000-0000-0000-000000000000' // ← SAME UUID
});
```

**Impact:** If the backend enforces **unique constraints** on photo UUIDs (common in databases), the second patient to submit will get a duplicate key error: `"Unique constraint violation on dentalPhotoRecord(lowerTeeth)"`.

Even if no unique constraint exists now, it's a flag for future issues.

**Fix:** Generate distinct UUIDs or use a library:
```javascript
import { v4 as uuidv4 } from 'uuid';

const dentalPhotoRecord = await createDentalPhotoRecord({
  upperTeeth: uuidv4(),
  lowerTeeth: uuidv4()
});
```

Or use distinct null/placeholder values if photos are optional:
```javascript
upperTeeth: null,
lowerTeeth: null
```

**Risk Level:** HIGH — Second+ patient hits duplicate key error during submission.

---

### 4. `checkInitialRecordStatus()` Treats All Errors as "Needs Record"
**Location:** Lines ~860–876  
**Issue:**
```javascript
export const checkInitialRecordStatus = async () => {
  try {
    const data = await sendGraphQLRequest(query, {});
    // ... logic ...
  } catch (error) {
    // If the query fails (e.g., no ticket exists), user needs to fill out the initial record
    console.log('[EMR Service] Error checking status (likely no ticket):', error.message);
    return { needsInitialRecord: true, status: null, error: error.message };
    // ↑ PROBLEM: Network timeout, 401, 500, CORS all trigger needsInitialRecord=true
  }
};
```

**Impact:** Used by [Dashboard.jsx](../pages/Dashboard.jsx#L40) to decide whether to show the initial record form. If any error occurs (timeout, authentication failure, server error), the function returns `{ needsInitialRecord: true }`, sending users back to the form even if they already completed it.

**Scenario:**
1. User completes and submits initial record ✓
2. Server is temporarily down or returns 500
3. Dashboard calls `checkInitialRecordStatus()` → catches error → returns `needsInitialRecord: true`
4. User is shown the initial form again
5. User accidentally submits duplicate record

**Fix:** Differentiate error types:
```javascript
catch (error) {
  // Network/auth errors should NOT assume needs record
  if (error.response?.status === 401 || error.response?.status === 403) {
    // Redirect to login
    throw new Error('Authentication required');
  }
  if (error.response?.status >= 500) {
    // Server error - don't assume anything
    throw new Error('Server error: ' + error.message);
  }
  // Only true no-ticket scenario or 404
  return { needsInitialRecord: true, status: null, error: error.message };
}
```

**Risk Level:** CRITICAL — Causes duplicate record submissions.

---

### 5. `cancelUpdateTicket()` Error Swallowing Risk
**Location:** Lines ~735–740  
**Issue:**
```javascript
if (ticketCreated) {
  console.log('[EMR Service] Attempting to cancel update ticket due to error...');
  await cancelUpdateTicket(); // If this throws, original error is lost
}
throw error; // ← Original error, but cancelUpdateTicket might have also thrown
```

**Impact:** If `cancelUpdateTicket()` throws, the original error is masked. Currently `cancelUpdateTicket()` has its own internal try/catch and returns `null`, so it's safe. But if that changes, debugging becomes very difficult.

**Fix:** Wrap it:
```javascript
if (ticketCreated) {
  console.log('[EMR Service] Attempting to cancel update ticket due to error...');
  try {
    await cancelUpdateTicket();
  } catch (cancelError) {
    console.warn('[EMR Service] Failed to cancel ticket during rollback:', cancelError.message);
    // Don't throw - preserve original error
  }
}
throw error;
```

**Risk Level:** MEDIUM — Low probability, but impacts debugging.

---

## 🟡 Logic Inconsistencies

### 6. Duplicate Step Numbering (Comments Only)
**Location:** Lines ~421 and ~441  
**Issue:**
```javascript
// 11. Create Dental Procedure Profile (REQUIRED by backend)
...
// 12. Create Oral Appliance Profile (REQUIRED by backend)
...
// 12. Create Dental Photo Record with mock UUIDs  ← DUPLICATE NUMBER
...
// 13. Create OB-GYNE History (if female only)    ← Should be 14
```

**Impact:** Purely cosmetic in execution, but log tracing becomes misleading:
```
[EMR Service] Step 11: Creating empty dental procedure profile...
[EMR Service] Step 12: Creating empty oral appliance profile...
[EMR Service] Step 12: Creating dental photo record...  ← Confusing: step 12 again?
[EMR Service] Step 13: Creating OB-GYNE history...     ← Should reference step 14
```

**Fix:** Renumber comments correctly (steps 1–14).

**Risk Level:** LOW — No functional impact.

---

### 7. Both Functions Double-Exported
**Location:** Lines ~887–890  
**Issue:**
```javascript
export const createInitialMedicalRecord = async (formData) => { ... };
export const checkInitialRecordStatus = async () => { ... };

export default {
  createInitialMedicalRecord,
  checkInitialRecordStatus
};
```

**Impact:** Same functions exported as both **named exports** and **default export**. Redundant and confusing. Consumer ([Dashboard.jsx](../pages/Dashboard.jsx#L10)) correctly uses named imports:
```javascript
import { checkInitialRecordStatus } from '../services/emr-service.js';
```

But the default export is unused and misleading.

**Fix:** Remove the `export default { ... }` block, or only use it without the named exports above.

**Risk Level:** LOW — Consumer already uses correct import pattern.

---

### 8. Emergency Contacts Silently Skipped if Fewer Than 2
**Location:** Line ~160  
**Issue:**
```javascript
if (formData.personalInfo.emergencyContacts?.length >= 2) {
  // Create emergency contact
} else {
  // Silently skip - no error, no log
}
```

**Impact:** If the form validation ensures 2 contacts are always provided, this is fine. But if validation can allow fewer than 2, the record is submitted **without any emergency contacts**. If the backend requires them for `submitUpdateTicket()`, the entire operation fails at the very end (after creating 13 other records), causing a confusing error.

**Fix:** Log it explicitly and/or validate upfront:
```javascript
if (!formData.personalInfo.emergencyContacts || formData.personalInfo.emergencyContacts.length < 2) {
  console.warn('[EMR Service] Emergency contacts missing or incomplete:', formData.personalInfo.emergencyContacts?.length ?? 0);
  // Optionally throw or let backend validate
}
```

**Risk Level:** MEDIUM — Late failure if backend requires them.

---

### 9. Mismatched Error String Checks in `submitUpdateTicket` Flow
**Location:** Lines ~104–125 and ~715–730  
**Issue:**

Inside `submitUpdateTicket()` (line ~104):
```javascript
if (error.message && error.message.includes('Required records are missing')) {
  console.error('[EMR Service] ❌ BACKEND VALIDATION ERROR FOR INITIAL PATIENT RECORDS');
  // Logs detailed requirements for staff-only records
}
```

Inside `createInitialMedicalRecord()` catch block (line ~715):
```javascript
if (submitError.message && submitError.message.includes('VitalSigns, MedicalHistory, Hospitalization')) {
  console.error('='.repeat(80));
  console.error('[EMR Service] BACKEND CONFIGURATION ERROR');
  // Logs different error handling
}
```

**Impact:** These two blocks target the **same scenario** (missing required records) but match **different substrings**. If the backend error message is:
- `"Required records are missing: VitalSigns"` — First check fires ✓, second check fails ✗
- `"Validation failed: VitalSigns required, MedicalHistory required"` — First check fails ✗, second check fails ✗
- `"Required: VitalSigns, MedicalHistory, Hospitalization"` — First check fails ✗, second check fires ✓

This leads to **inconsistent logging** and makes errors harder to trace.

**Fix:** Consolidate into a single error handler with multiple string checks:
```javascript
if (submitError.message) {
  if (submitError.message.includes('Required records are missing')) {
    // Handle generic missing records
  }
  if (submitError.message.includes('VitalSigns') || submitError.message.includes('MedicalHistory')) {
    // Handle specific staff-only records
  }
}
```

**Risk Level:** MEDIUM — Inconsistent error reporting complicates debugging.

---

### 10. Transferee and Returnee Both Map to Sophomore
**Location:** Line ~804  
**Issue:**
```javascript
const mapYearLevel = (category) => {
  const mapping = {
    'Freshmen': 'Freshman',
    'Freshmen - New student': 'Freshman',
    'Transferee': 'Sophomore',
    'Returnee': 'Sophomore', // ← Same as Transferee
    'Old Student': 'Junior'
  };
  ...
};
```

**Impact:** If these are distinct enrollment statuses, they likely represent different year levels:
- **Transferee:** Student from another institution (could be any year)
- **Returnee:** Student returning after leave of absence (typically same year they left)

Mapping both to 'Sophomore' is likely incorrect.

**Fix:** Requires clarification with business rules. Possible correct mapping:
```javascript
'Transferee': 'Junior',        // Transfer typically advanced
'Returnee': 'Junior',          // Returning student typically advanced
```

Or make it dynamic based on additional form fields.

**Risk Level:** MEDIUM — Causes incorrect enrollment data in backend.

---

## ⚪ Cosmetic Issues

### 11. Unclear `parseInt(...) || null` Pattern
**Location:** Line ~377–379  
**Issue:**
```javascript
numberOfCigarettesPerDay: formData.medicalBackground.smoker === 'yes' 
  ? parseInt(formData.medicalBackground.smokerSticksPerDay) || null
  : null,
```

**Detail:** This works because `NaN || null` evaluates to `null`, but it's non-obvious. `parseInt("abc")` returns `NaN` (falsy), so the `||` falls through to `null`.

**Fix (more explicit):**
```javascript
numberOfCigarettesPerDay: formData.medicalBackground.smoker === 'yes' 
  ? (Number.isNaN(parseInt(formData.medicalBackground.smokerSticksPerDay)) 
    ? null 
    : parseInt(formData.medicalBackground.smokerSticksPerDay))
  : null,
```

Or use a helper:
```javascript
const toNumber = (val) => {
  const num = parseInt(val);
  return Number.isNaN(num) ? null : num;
};

numberOfCigarettesPerDay: formData.medicalBackground.smoker === 'yes' 
  ? toNumber(formData.medicalBackground.smokerSticksPerDay)
  : null,
```

**Risk Level:** LOW — Works correctly but could be clearer.

---

## Summary Table

| # | Category | Issue | Severity | Impact |
|---|----------|-------|----------|--------|
| 1 | Error Handling | `mapDentalCleaningRange()` returns `''` not `null` | 🔴 HIGH | All records with missing dental data fail |
| 2 | Data Validation | Hardcoded `acuityId: "1"` magic value | 🔴 HIGH | Records with eyeglasses/contacts fail |
| 3 | Data Quality | Identical mock UUIDs in dental photos | 🔴 HIGH | 2nd patient duplicate key error |
| 4 | Logic Bug | `checkInitialRecordStatus()` catches all errors as "needs record" | 🔴 CRITICAL | Causes duplicate record submissions |
| 5 | Error Handling | `cancelUpdateTicket()` can swallow original error | 🟡 MEDIUM | Difficult debugging |
| 6 | Code Quality | Duplicate step numbers in comments | ⚪ LOW | Confusing log traces |
| 7 | Code Quality | Both named + default export of same functions | ⚪ LOW | Redundant export pattern |
| 8 | Logic Gap | Emergency contacts silently skipped | 🟡 MEDIUM | Late failure if backend requires them |
| 9 | Logic Inconsistency | Mismatched error string checks | 🟡 MEDIUM | Inconsistent error reporting |
| 10 | Business Logic | Transferee/Returnee both map to Sophomore | 🟡 MEDIUM | Incorrect enrollment data |
| 11 | Code Clarity | Unclear `parseInt(...) \|\| null` pattern | ⚪ LOW | Non-obvious falsy behavior |

---

## Recommended Actions

### Immediate (Before Next Deployment)
1. **Fix #1:** Change `mapDentalCleaningRange()` to return `null`
2. **Fix #3:** Generate distinct UUIDs or use `null` for dental photos
3. **Fix #4:** Refactor `checkInitialRecordStatus()` error handling to differentiate error types

### Before Production Release
4. **Fix #2:** Verify `acuityId: "1"` exists in all environments or fetch it dynamically
5. **Fix #9:** Consolidate error string checks in `submitUpdateTicket` flow
6. **Fix #10:** Clarify correct year level mappings for Transferee/Returnee

### Nice-to-Have
7. Fix #5: Wrap `cancelUpdateTicket()` in try/catch for safety
8. Fix #6: Renumber comments 1–14
9. Fix #7: Remove redundant default export
10. Fix #8: Log when emergency contacts are skipped
11. Fix #11: Clarify `parseInt` logic with explicit `isNaN` check

---

## Testing Recommendations

- **Test Case 1:** Submit initial record without selecting any dental cleaning option → Should still succeed
- **Test Case 2:** Submit initial record as patient with eyeglasses → Verify `acuityId: "1"` works in all environments
- **Test Case 3:** Simulate server timeout in `checkInitialRecordStatus()` → User should not be sent back to initial form
- **Test Case 4:** Submit two initial records quickly (race condition) → Check for duplicate UUID errors
- **Test Case 5:** Female patient without `formData.obgyne` obj → Should create default OB-GYNE history
- **Test Case 6:** Male patient → Should skip OB-GYNE history without error

---

**Report generated:** 2026-02-22  
**Scope:** Frontend EMR Service (`mds-frontend/src/services/emr-service.js`)  
**Next Review:** After fixes applied
