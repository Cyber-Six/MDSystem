# Validation Utilities Documentation

## Overview

The `@mdsystem/core/validation/*` module provides reusable validation utilities for email, password, and user constants that can be shared across web and mobile applications.

## Module Structure

```
@mdsystem/core/validation/
├── email-validation.js       # TIP institutional email validation
├── password-validation.js    # Password requirements validation
└── user-constants.js         # User role/status constants
```

## Usage in Frontend

### Password Validation

**Import:**
```javascript
import { 
  validatePassword, 
  passwordsMatch, 
  getPasswordError,
  PASSWORD_RULES
} from '@mdsystem/core/validation/password-validation';
```

**Implementation Examples:**

#### Registration Form ([register.jsx](../../../mds-frontend/src/modules/auth/register.jsx#L78-L95))
```javascript
const handleInitialRegistration = async (e) => {
  e.preventDefault();
  
  // Validate passwords match
  if (!passwordsMatch(formData.password, formData.confirmPassword)) {
    setError('Passwords do not match.');
    return;
  }

  // Validate password requirements
  if (!validatePassword(formData.password)) {
    setError('Password must be at least 8 characters long.');
    return;
  }
  
  // Proceed with registration...
};
```

#### Change Password Modal ([change-password-modal.jsx](../../../mds-frontend/src/components/settings/change-password-modal.jsx))
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();

  // Validate password requirements
  const passwordError = getPasswordError(passwords.newPassword);
  if (passwordError) {
    setError(passwordError);
    return;
  }

  // Validate passwords match
  if (!passwordsMatch(passwords.newPassword, passwords.confirmPassword)) {
    setError('Passwords do not match.');
    return;
  }
  
  // Submit password change...
};
```

### Email Validation

**Import:**
```javascript
import { 
  isStudentEmail,
  isEmployeeEmail,
  isMedicalEmail,
  detectRoleFromEmail,
  isValidTipEmail
} from '@mdsystem/core/validation/email-validation';
```

**Examples:**
```javascript
// Validate TIP institutional emails
if (!isValidTipEmail(email)) {
  setError('Email must follow TIP institutional format.');
  return;
}

// Detect user role from email
const role = detectRoleFromEmail(email);
// Returns: 'Student' | 'Employee' | 'Medical' | null

// Check specific email formats
if (isStudentEmail(email)) {
  // Handle student registration
} else if (isEmployeeEmail(email)) {
  // Handle employee registration
}
```

### User Constants

**Import:**
```javascript
import { 
  USER_STATUS,
  isUserStaff,
  isValidStatus
} from '@mdsystem/core/validation/user-constants';
```

**Examples:**
```javascript
// Use status constants
const userStatus = USER_STATUS.STUDENT; // 'Student'
const staffStatus = USER_STATUS.MEDICAL; // 'Medical'

// Check if user is staff
if (isUserStaff(userStatus)) {
  // Grant staff permissions
}

// Validate status
if (!isValidStatus(status)) {
  throw new Error('Invalid user status');
}
```

## Validation Rules

### Password Requirements
- **Minimum Length:** 8 characters
- **Maximum Length:** 64 characters
- **Type:** Must be a string

```javascript
PASSWORD_RULES.MIN_LENGTH  // → 8
PASSWORD_RULES.MAX_LENGTH  // → 64
```

### TIP Email Formats
- **Student:** `m{lastname}@tip.edu.ph` or `q{lastname}{digits}@tip.edu.ph`
- **Employee:** `{firstname}.{lastname}@tip.edu.ph`
- **Medical:** `doc.mds@tip.edu.ph`

## API Reference

### password-validation.js

#### `validatePassword(password: string): boolean`
Checks if password meets length requirements (8-64 characters).

#### `passwordsMatch(password: string, confirmPassword: string): boolean`
Checks if two passwords are identical.

#### `getPasswordError(password: string): string | null`
Returns error message if password is invalid, null otherwise.

#### `PASSWORD_RULES: object`
Constants for password validation rules.

### email-validation.js

#### `isStudentEmail(email: string): boolean`
Checks if email follows TIP student format.

#### `isEmployeeEmail(email: string): boolean`
Checks if email follows TIP employee format.

#### `isMedicalEmail(email: string): boolean`
Checks if email matches medical portal email.

#### `detectRoleFromEmail(email: string): 'Student' | 'Employee' | 'Medical' | null`
Detects user role from email format.

#### `isValidTipEmail(email: string): boolean`
Checks if email is any valid TIP institutional format.

#### `isValidEmailFormat(email: string): boolean`
Validates basic email format using RFC 5322 standard.

### user-constants.js

#### `USER_STATUS: object`
Constants for user roles:
- `USER_STATUS.STUDENT` → `'Student'`
- `USER_STATUS.EMPLOYEE` → `'Employee'`
- `USER_STATUS.MEDICAL` → `'Medical'`

#### `isUserStaff(status: string): boolean`
Returns true if status is 'Medical' or 'Employee'.

#### `isValidStatus(status: string): boolean`
Checks if status is one of the valid USER_STATUS values.

## Migration from Backend

These utilities were extracted from the backend's `validator.js` to enable client-side validation and reduce duplicate code:

**Before (Backend only):**
```javascript
// Backend/config/validator.js
function validatePassword(password) {
  if (password.length < 8 || password.length > 64) {
    return false;
  }
  return true;
}
```

**After (Shared Core):**
```javascript
// packages/core/src/validation/password-validation.js
export const validatePassword = (password) => {
  if (typeof password !== 'string') return false;
  if (password.length < PASSWORD_RULES.MIN_LENGTH || 
      password.length > PASSWORD_RULES.MAX_LENGTH) {
    return false;
  }
  return true;
};

// Frontend usage
import { validatePassword } from '@mdsystem/core/validation/password-validation';
```

## Benefits

### Code Reusability
- ✅ Same validation logic in web and mobile
- ✅ Single source of truth for validation rules
- ✅ Consistent error messages across platforms

### Developer Experience
- ✅ Type-safe validation functions
- ✅ Comprehensive JSDoc documentation
- ✅ Tree-shakeable ES modules
- ✅ Clear import paths

### Maintainability
- ✅ Central location for validation rules
- ✅ Easy to update validation requirements
- ✅ Testable in isolation
- ✅ No platform-specific dependencies

## Testing

The validation utilities are pure functions with no external dependencies, making them easy to test:

```javascript
// Example test cases
import { validatePassword, passwordsMatch } from '@mdsystem/core/validation/password-validation';

describe('Password Validation', () => {
  it('should reject passwords shorter than 8 characters', () => {
    expect(validatePassword('short')).toBe(false);
  });
  
  it('should accept valid passwords', () => {
    expect(validatePassword('validPassword123')).toBe(true);
  });
  
  it('should correctly compare passwords', () => {
    expect(passwordsMatch('pass123', 'pass123')).toBe(true);
    expect(passwordsMatch('pass123', 'different')).toBe(false);
  });
});
```

## Next Steps

### Recommended Implementation Areas

1. **Add Email Validation to Registration**
   - Use `isValidTipEmail()` in [register.jsx](../../../mds-frontend/src/modules/auth/register.jsx)
   - Provide specific error messages based on email format

2. **Integrate Role Detection**
   - Use `detectRoleFromEmail()` during registration
   - Auto-select user type based on email

3. **Backend Password Reset**
   - Create frontend component for `/auth/reset-password/:verificationKey`
   - Use password validation utilities

4. **User Profile Management**
   - Use `USER_STATUS` constants in profile components
   - Use `isUserStaff()` for permission checks

### Future Enhancements

- [ ] Add phone number validation
- [ ] Add date validation utilities
- [ ] Add address validation
- [ ] Add complex password strength scoring
- [ ] Add real-time validation feedback
- [ ] Add localized error messages

## Related Documentation

- [Core Package README](./README.md) - Complete API reference
- [Banner System](../../../mds-frontend/src/docs/BANNER_SYSTEM.md) - Notification system
- [Token Service](../../../mds-frontend/src/docs/TOKEN_SERVICE.md) - Authentication
