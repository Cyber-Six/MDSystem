# Role Context Usage Guide

## Overview

The MDSystem uses **subdomain-based routing** to determine the user role context. This means that the frontend doesn't need to derive boolean flags like `isPatient` or `isMedical` from the role value, as the subdomain already provides this information.

## Architecture

### Subdomain Routing

- **`www.mdsystem.com`** → Patient Role (students and employees)
- **`staff.mdsystem.com`** → Medical Role (doctors and nurses)

The backend handles all role-based authorization and route protection based on the subdomain and user roles.

### Role Context

The `RoleContext` provides a single `role` value:

```javascript
// RoleContext.jsx
const [role] = useState(() => {
  const hostname = window.location.hostname;
  return hostname.startsWith('staff.') ? 'medical' : 'patient';
});

// Context provides: { role }
// role = 'patient' | 'medical'
```

## Why We Removed `isPatient` and `isMedical`

### 1. **Redundancy**
The boolean flags (`isPatient`, `isMedical`) were redundant because they can be easily derived from `role`:
```javascript
// Before (redundant)
const { isPatient, isMedical, role } = useDetectRoleFromSubdomain();

// After (simplified)
const { role } = useDetectRoleFromSubdomain();
const isPatient = role === 'patient'; // if ever needed
```

### 2. **Confuses AI/Copilot Context**
When using GitHub Copilot or other AI coding assistants, having multiple ways to represent the same concept (role type) leads to:
- Inconsistent code suggestions
- Confusion about which variable to use
- Harder to maintain code patterns

### 3. **Backend Handles Authorization**
Since all routes and permissions are managed by the backend based on:
- Subdomain detection
- User role verification
- JWT token validation

The frontend doesn't need to make authorization decisions based on role type.

### 4. **Simpler Mental Model**
Using a single `role` value instead of multiple derived booleans creates a clearer mental model:
```javascript
// Clear and direct
if (role === 'patient') {
  // patient-specific logic
}

// vs. multiple boolean checks
if (isPatient && !isMedical) {
  // patient-specific logic
}
```

### 5. **Security - Information Disclosure**
Displaying role-specific messaging (e.g., "Patient Portal" vs "Staff Portal") can inadvertently reveal:
- The existence of separate portals for different user types
- System architecture information
- Potential attack vectors

By using neutral messaging, we avoid giving away system intelligence to potential attackers.

## When to Use Role Checking

### ✅ **Use `role` when:**

1. **Display conditional content based on role type**
   ```jsx
   <h1>{role === 'patient' ? 'Patient Dashboard' : 'Staff Dashboard'}</h1>
   ```

2. **Different API endpoints for different roles**
   ```javascript
   const endpoint = role === 'patient' 
     ? '/appointments' 
     : '/staff/appointments';
   ```

3. **Role-specific feature availability**
   ```jsx
   {role === 'medical' && (
     <Link to="/analytics">Analytics</Link>
   )}
   ```

4. **Different form options per role**
   ```jsx
   {role === 'medical' ? (
     <select>
       <option value="doctor">Doctor</option>
       <option value="nurse">Nurse</option>
     </select>
   ) : (
     <select>
       <option value="patient">Patient</option>
     </select>
   )}
   ```

### ❌ **Don't use `role` when:**

1. **User role authorization** (backend handles this)
   ```javascript
   // ❌ DON'T DO THIS - backend handles auth
   if (role === 'medical') {
     // allow access to sensitive data
   }
   
   // ✅ DO THIS - let backend protect routes
   const data = await axiosRequest.get('/protected-route');
   // Backend will return 403 if unauthorized
   ```

2. **Route protection** (use PrivateRoute component)
   ```jsx
   // ❌ DON'T DO THIS
   {role === 'medical' && <Route path="/admin" element={<Admin />} />}
   
   // ✅ DO THIS
   <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
   ```

3. **Data validation** (backend handles this)
   ```javascript
   // ❌ DON'T DO THIS
   if (role === 'patient') {
     // validate patient-specific data
   }
   
   // ✅ DO THIS - send to backend for validation
   await axiosRequest.post('/validate-data', data);
   ```

4. **Displaying role-specific branding on public pages** (security risk)
   ```jsx
   // ❌ DON'T DO THIS - reveals system architecture
   <h1>{role === 'patient' ? 'Patient Portal' : 'Staff Portal'}</h1>
   
   // ✅ DO THIS - use neutral messaging
   <h1>MDSystem</h1>
   ```

## Best Practices

### 1. Use Direct Comparisons
```javascript
// ✅ Good - clear and direct
if (role === 'patient') { }

// ❌ Avoid - unnecessary abstraction
const isPatient = role === 'patient';
if (isPatient) { }
```

### 2. Consistent Naming
Always use `role` as the variable name when destructuring:
```javascript
const { role } = useDetectRoleFromSubdomain();
```

### 3. Role-Specific Components
If you have components that are only used in one role context, name them clearly:
```
components/
  patient/
    PatientAppointments.jsx
  medical/
    StaffSchedule.jsx
```

### 4. Shared Components with Role Props
For components used across roles, pass `role` as a prop:
```jsx
<AppointmentList role={role} />
```

### 5. Neutral Public-Facing Content
For security, use generic messaging on:
- Landing pages
- Login/register pages  
- Error pages
- Any publicly accessible content

```jsx
// ✅ Good - doesn't reveal system structure
<h1>Welcome to MDSystem</h1>
<p>Healthcare management system</p>

// ❌ Avoid - reveals different user types
<h1>Welcome to {role === 'patient' ? 'Patient Portal' : 'Staff Portal'}</h1>
```

## When to Reintroduce `isPatient` / `isMedical`

Consider adding boolean helpers **only if**:

1. **Multiple role types are added** (e.g., admin, pharmacist)
   ```javascript
   // When you have 3+ role types, booleans might improve readability
   const isPatient = role === 'patient';
   const isMedical = ['doctor', 'nurse', 'admin'].includes(role);
   const isPharmacy = role === 'pharmacy';
   ```

2. **Same components need different behaviors for same user types**
   ```javascript
   // If multiple user types share the same routes/components
   // E.g., "doctor" and "nurse" both need same UI but different data
   const isMedicalStaff = ['doctor', 'nurse'].includes(role);
   ```

3. **Complex conditional logic becomes hard to read**
   ```javascript
   // If you have many nested conditionals
   if (role === 'patient' && feature === 'x' && status === 'y') { }
   
   // Boolean helpers might improve readability
   const isPatient = role === 'patient';
   if (isPatient && feature === 'x' && status === 'y') { }
   ```

## Migration Examples

### Before (with portal and booleans)
```jsx
const { isPatient, isMedical, portal } = useDetectPortalFromSubdomain();

return (
  <div>
    <h1>{isPatient ? 'Patient Portal' : 'Staff Portal'}</h1>
    {isPatient && <RegisterLink />}
    {isMedical && <StaffTools />}
  </div>
);
```

### After (simplified with role)
```jsx
const { role } = useDetectRoleFromSubdomain();

return (
  <div>
    <h1>MDSystem</h1>
    {role === 'medical' && <StaffTools />}
  </div>
);
```

## Summary

- ✅ Use `role` value directly (`'patient'` | `'medical'`)
- ❌ Avoid creating derived boolean flags (`isPatient`, `isMedical`)
- 🔒 Let backend handle all authorization logic
- 🎯 Keep frontend role checks for UI/UX only
- 🔐 Use neutral messaging on public pages for security
- 📝 Use direct comparisons for clarity and maintainability

This approach keeps the codebase cleaner, more maintainable, more secure, and less confusing for developers and AI assistants alike.
