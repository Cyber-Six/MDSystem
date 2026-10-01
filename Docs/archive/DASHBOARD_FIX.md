# Staff Dashboard Fix — Vite Proxy Update

## Problem

The staff dashboard was not loading data after the backend was reworked from a REST endpoint (`GET /dashboard/stats`) to a **GraphQL endpoint** (`POST /dashboard`).

The Vite dev server proxy config still pointed to the old route:

```js
// OLD (broken) — only proxied the deprecated REST path
'/dashboard/stats': {
  target: BACKEND_URL,
  changeOrigin: true,
  secure: BACKEND_URL.startsWith('https'),
},
```

Because `POST /dashboard` had **no matching proxy rule**, requests from the frontend never reached the backend. Vite served `index.html` instead, causing `fetchDashboardStats()` to fail with a parse error (HTML response instead of JSON/GraphQL).

## Fix

**File changed:** `mds-staff/vite.config.js`

Replaced the `/dashboard/stats` proxy rule with a `/dashboard` rule that:
- **Proxies POST** requests → backend (GraphQL queries)
- **Bypasses GET** requests → `index.html` (React Router / SPA navigation)

```js
// NEW (working) — proxies GraphQL POST, bypasses browser GET
'/dashboard': {
  target: BACKEND_URL,
  changeOrigin: true,
  secure: BACKEND_URL.startsWith('https'),
  bypass: function(req) {
    // Only proxy POST requests (GraphQL) — let React Router handle browser GET navigation
    if (req.method === 'GET') {
      return '/index.html';
    }
  },
},
```

## Architecture Overview

### Backend (unchanged)

| Component | Path | Purpose |
|---|---|---|
| GraphQL entry | `Backend/routes/dashboard/graphql.js` | Mounts `POST /dashboard` with `express-graphql` |
| Schema | `Backend/routes/dashboard/schema.graphql` | Defines `DashboardStats`, `TomorrowSlot`, etc. |
| Resolver | `Backend/routes/dashboard/resolvers/dashboard-resolver.js` | Permission gate (`is_staff`) |
| Wrapper | `Backend/routes/dashboard/resolvers/wrapper.js` | Actual DB queries, permission-based field filtering |
| REST (deprecated) | `Backend/routes/dashboard/rest-endpoint.js` | `GET /dashboard/rest/stats` — kept for backward compat |

**Mounted in `Backend/staff.js`:**
```js
initDashboardGraphQL(app);                    // POST /dashboard (GraphQL)
app.use('/dashboard/rest', dashboardRestRoutes); // GET /dashboard/rest/stats (deprecated)
```

### Frontend (unchanged)

| Component | Path | Purpose |
|---|---|---|
| Service | `mds-staff/src/modules/dashboard/dashboard-service.js` | Sends GraphQL query via `axiosRequest.post('/dashboard', ...)` |
| View | `mds-staff/src/modules/dashboard/dashboard-home.jsx` | Renders stat cards, availability, patients, requests |

**GraphQL Query sent by frontend:**
```graphql
query GetDashboardStats {
  getDashboardStats {
    pendingRequests
    pendingBreakdown { emr, appointments, medicine }
    todayAppointments
    todayRemaining
    activeConsultations
    lowStockItems
    tomorrowAvailability { label, open, total }
    recentPatients { id, name, identifier, program, lastVisit }
    recentRequests { id, name, type, status, submitted }
  }
}
```

### Data Flow

```
Browser → POST /dashboard
  ├─ Dev:  Vite proxy → Backend (localhost:3001)
  └─ Prod: Same-origin relative URL → Backend directly

Backend pipeline:
  1. Rate limiter (genericLimiter)
  2. JWT auth (medical)
  3. GraphQL handler → dashboard-resolver
     a. Checks is_staff permission
     b. Calls wrapper._getDashboardStats()
        - Gets user branch designation
        - Checks 8 permission flags in parallel
        - Runs only permitted DB queries in parallel
        - Returns permission-filtered DashboardStats
```

### Permission-Based Field Filtering

The backend returns `null` for any stat the user lacks permission for:

| Field | Required Permission |
|---|---|
| `pendingRequests` / `pendingBreakdown` | `emr_allow_approval` OR `appointment_allow_approval` OR `medicine_request_allow_approve` |
| `todayAppointments` / `todayRemaining` | `appointment_allow_view_records` |
| `activeConsultations` | `consultation_allow_view` |
| `lowStockItems` | `inventory_allow_view` |
| `tomorrowAvailability` | `appointment_allow_view_configuration` |
| `recentPatients` | `profile_allow_view` |
| `recentRequests` | `emr_allow_approval` OR `appointment_allow_approval` |

The frontend uses `null` checks to conditionally render widgets — cards and sections for unpermitted data are simply hidden.
