# API Integration Guide

## Overview
This guide explains how API requests are automatically routed to the correct subdomain (www. or staff.) based on the current portal context.

## How It Works

### 1. Portal Detection
The `PortalContext` automatically detects the subdomain on app load:
- `www.yourdomain.com` → **patient** portal
- `staff.yourdomain.com` → **medical** portal

### 2. Automatic URL Construction
All API requests use `axiosInstance`, which automatically includes the correct subdomain in the base URL.

**Example Request URLs:**
```
Patient Portal (www.):
- https://www.yourdomain.com/api/login
- https://www.yourdomain.com/api/appointments
- https://www.yourdomain.com/api/user/profile

Staff Portal (staff.):
- https://staff.yourdomain.com/api/login
- https://staff.yourdomain.com/api/staff/patients
- https://staff.yourdomain.com/api/staff/analytics/morbidity
```

## Using the API Services

### Authentication Example
```javascript
import { login, register, logout } from '../services/authService';

// Login - automatically uses correct subdomain
const handleLogin = async (email, password) => {
  try {
    const response = await login(email, password);
    // Token is automatically stored
    console.log('Login successful:', response);
  } catch (error) {
    console.error('Login failed:', error);
  }
};

// Register
const handleRegister = async (userData) => {
  try {
    const response = await register(userData);
    console.log('Registration successful:', response);
  } catch (error) {
    console.error('Registration failed:', error);
  }
};

// Logout
const handleLogout = async () => {
  try {
    await logout();
    // Token is automatically cleared
    navigate('/login');
  } catch (error) {
    console.error('Logout failed:', error);
  }
};
```

### Patient/User Operations
```javascript
import { 
  getUserProfile, 
  scheduleAppointment, 
  uploadDocument 
} from '../services/userService';

// Get user profile
const profile = await getUserProfile(userId);

// Schedule appointment
const appointment = await scheduleAppointment({
  type: 'medical-clearance',
  date: '2025-12-15',
  time: '10:00 AM'
});

// Upload document
const formData = new FormData();
formData.append('file', file);
formData.append('type', 'medical-certificate');
const result = await uploadDocument(formData);
```

### Staff Operations (Medical Portal Only)
```javascript
import { 
  getPatients, 
  updateMedicalRecord,
  issuePrescription,
  getAnalytics 
} from '../services/staffService';

// Get all patients
const patients = await getPatients({ status: 'active' });

// Update medical record
const updated = await updateMedicalRecord(patientId, {
  diagnosis: 'Common cold',
  icd10: 'J00',
  prescription: 'Rest and fluids'
});

// Issue prescription
const prescription = await issuePrescription(patientId, {
  medications: ['Paracetamol 500mg'],
  instructions: 'Take twice daily'
});

// Get morbidity report
const report = await getAnalytics('morbidity', {
  period: 'monthly',
  month: '2025-12'
});
```

## Using Portal Context in Components

```javascript
import { usePortal } from '../context/PortalContext';

function MyComponent() {
  const { portal, isPatient, isMedical } = usePortal();

  return (
    <div>
      <h1>Current Portal: {portal}</h1>
      
      {isPatient && (
        <p>You can schedule appointments and view your records.</p>
      )}
      
      {isMedical && (
        <p>You can manage patients and generate reports.</p>
      )}
    </div>
  );
}
```

## Direct Axios Usage (When Needed)

If you need to make a custom API call not covered by the service files:

```javascript
import axiosInstance from '../services/axiosInstance';

// GET request
const response = await axiosInstance.get('/custom-endpoint');

// POST request
const response = await axiosInstance.post('/custom-endpoint', {
  data: 'value'
});

// PUT request
const response = await axiosInstance.put('/custom-endpoint/123', {
  updated: 'value'
});

// DELETE request
const response = await axiosInstance.delete('/custom-endpoint/123');
```

## Environment Variables

Set these in your `.env` file:

```bash
# Development (localhost)
VITE_API_URL=http://localhost:3001

# Production - Patient Portal
VITE_PATIENT_API_URL=https://www.yourdomain.com/api

# Production - Staff Portal
VITE_MEDICAL_API_URL=https://staff.yourdomain.com/api
```

## Error Handling

The axios instance includes automatic error handling:
- **401 Unauthorized**: Automatically clears token and redirects to login
- **403 Forbidden**: Logs access denied error
- **500 Server Error**: Logs server error

Custom error handling in your components:

```javascript
try {
  const data = await someApiCall();
  // Handle success
} catch (error) {
  if (error.response) {
    // Server responded with error status
    console.error('API Error:', error.response.data.message);
  } else if (error.request) {
    // Request made but no response
    console.error('No response from server');
  } else {
    // Other errors
    console.error('Error:', error.message);
  }
}
```

## Adding New API Endpoints

To add a new API endpoint:

1. **Add function to appropriate service file** (authService.js, userService.js, or staffService.js):

```javascript
// In userService.js
export async function getNewFeature(params) {
  const response = await axiosInstance.get('/new-feature', { params });
  return response.data;
}
```

2. **Use in your component**:

```javascript
import { getNewFeature } from '../services/userService';

const data = await getNewFeature({ filter: 'value' });
```

That's it! The subdomain routing is handled automatically.

## Best Practices

1. ✅ Always use service functions instead of direct fetch/axios calls
2. ✅ Keep API logic in service files, not in components
3. ✅ Use try-catch for error handling
4. ✅ Store auth tokens in localStorage (handled automatically)
5. ✅ Use the portal context for conditional UI rendering
6. ✅ Test on both subdomains (www. and staff.)

## Testing Locally

For local development, both subdomains will use `http://localhost:3001`. To test subdomain routing locally, you can:

1. Edit your hosts file to add local subdomains:
   ```
   127.0.0.1  www.mdsystem.local
   127.0.0.1  staff.mdsystem.local
   ```

2. Access your app at:
   - `http://www.mdsystem.local:5173` (patient portal)
   - `http://staff.mdsystem.local:5173` (staff portal)
