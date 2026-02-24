# Data Transformer - Issue Summary

**File:** `data-transformer.js`  
**Date:** February 22, 2026

---

## 🚨 Issue to Fix

### Problem: `formatDate()` Function is Duplicated with Incompatible Implementations

#### Locations:

1. **`data-transformer.js`**
   - Returns: `YYYY-MM-DD` (ISO format for backend)
   - Error handling: ✅ Has try/catch

2. **`review-form.jsx` (Line 9)**
   - Returns: `February 22, 2026` (Locale format for UI)
   - Error handling: ❌ No error handling (can crash)

#### Why It's a Problem:

- ❌ Code duplication
- ❌ Different output formats create inconsistency
- ❌ No error handling in `review-form.jsx` version
- ❌ Unclear which formatter to use where
- ❌ Maintenance burden (changes needed in 2 places)

---

## ✅ What to Fix

### Step 1: Update `data-transformer.js`

Add two clearly-named functions:

```javascript
/**
 * Formats date to ISO format for backend (YYYY-MM-DD)
 */
export const formatDateToISO = (dateString) => {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn('[Data Transformer] Invalid date:', dateString);
      return null;
    }
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('[Data Transformer] Error formatting date to ISO:', dateString, error);
    return null;
  }
};

/**
 * Formats date to locale string for UI (February 22, 2026)
 */
export const formatDateToLocale = (dateString) => {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn('[Data Transformer] Invalid date:', dateString);
      return null;
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error('[Data Transformer] Error formatting date to locale:', dateString, error);
    return null;
  }
};

// Keep for backward compatibility
export const formatDate = formatDateToISO;
```

### Step 2: Update `review-form.jsx`

**Remove:** Lines 9-15 (local `formatDate` function)

**Replace with import:**
```javascript
import { formatDateToLocale } from '../../../../utils/data-transformer';
```

**Update usage (Lines 51, 178):**
```javascript
<DataRow label="Birthday" value={formatDateToLocale(formData.personalInfo?.birthday)} />
<DataRow label="Visual Acuity Date" value={formatDateToLocale(formData.medicalBackground?.visualAcuityDate)} />
```

---

## Expected Result

✅ Single source of truth for date formatting  
✅ Consistent error handling everywhere  
✅ Clear intent (ISO for backend, Locale for UI)  
✅ Easier maintenance  
✅ No crashes from invalid dates
