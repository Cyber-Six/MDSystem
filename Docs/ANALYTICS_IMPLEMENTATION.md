# Analytics Module Implementation

## Overview

The Analytics module provides a comprehensive dashboard for viewing clinic performance metrics, health data insights, and patient statistics within the MDS Staff Portal. It integrates with 15+ pre-built backend analytics queries and displays results through interactive charts.

## Architecture

### Backend (`Backend/`)

```
Backend/
├── services/
│   ├── analytics-query.js    # 15 parameterized SQL queries + Redis caching + batch execution
│   └── chart.js              # Server-side chart generation (ChartJS Node Canvas)
├── routes/
│   └── documents/
│       └── analytics.js      # REST endpoints: /analytics/*
└── staff.js                  # Route mounting: app.use('/analytics', analyticsRoutes)
```

### Frontend (`mds-staff/src/modules/analytics/`)

```
mds-staff/src/modules/analytics/
├── staff-analytics.jsx              # Main page component (lazy-loaded)
├── analytics-service.js             # API service layer (batch + individual calls)
└── components/
    ├── analytics-charts.jsx         # Reusable chart components (Bar, Line, Pie/Doughnut)
    ├── analytics-chart-card.jsx     # Card wrapper with loading/error states
    ├── analytics-filter-bar.jsx     # Branch, date range, and category filters
    └── analytics-summary-cards.jsx  # KPI summary cards at the top
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/analytics/queries` | GET | List available query types |
| `/analytics/reports` | GET | List available report types |
| `/analytics/query/:dataType` | GET | Fetch single query data |
| `/analytics/batch` | POST | Fetch multiple queries in one request |
| `/analytics/report/:reportType` | GET | Generate PDF report |

### Batch Endpoint (Optimization)

```
POST /analytics/batch
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "dataTypes": ["consultations-by-type", "appointments-by-status", ...],
  "branch": "Both",
  "startDate": "2025-09-30",
  "endDate": "2026-03-30"
}
```

**Response:**
```json
{
  "success": true,
  "branch": "Both",
  "dateRange": { "startDate": "2025-09-30", "endDate": "2026-03-30" },
  "results": {
    "consultations-by-type": {
      "success": true,
      "data": { "labels": ["Medical", "Dental"], "values": [120, 45], "total": 165 }
    },
    ...
  }
}
```

## Available Analytics Queries (16 total)

### Consultations
| Query Key | Chart Type | Description |
|-----------|-----------|-------------|
| `consultations-by-type` | Pie | Medical vs Dental breakdown |
| `consultations-by-status` | Doughnut | Status distribution (Open, Completed, etc.) |
| `consultation-trends` | Line | Monthly consultation volume over time |

### Diagnoses
| Query Key | Chart Type | Description |
|-----------|-----------|-------------|
| `top-diagnoses` | Bar | Top 10 ICD-coded diagnoses |
| `diagnoses-by-type` | Pie | Primary, Secondary, etc. breakdown |

### Vital Signs
| Query Key | Chart Type | Description |
|-----------|-----------|-------------|
| `bmi-trends` | Line | Average BMI trends (monthly) |
| `blood-pressure-trends` | Line | Average systolic BP trends (monthly) |

### Appointments
| Query Key | Chart Type | Description |
|-----------|-----------|-------------|
| `appointments-by-category` | Pie | Student vs Employee breakdown |
| `appointments-by-status` | Doughnut | Status distribution |
| `appointments-by-session` | Pie | Morning vs Afternoon |

### Clinical Data
| Query Key | Chart Type | Description |
|-----------|-----------|-------------|
| `immunization-coverage` | Bar | Patients immunized by vaccine type |
| `dental-procedures` | Bar | Top 10 dental procedures |

### Lifestyle & Allergies
| Query Key | Chart Type | Description |
|-----------|-----------|-------------|
| `lifestyle-risks` | Bar | Smoking, alcohol, vaping prevalence |
| `allergy-by-type` | Pie | Food, Drug, Environmental, etc. |
| `allergy-by-severity` | Doughnut | Mild, Moderate, Severe breakdown |

## Optimizations Applied

### 1. SQL Injection Prevention (Security)
All 15 query functions migrated from **string interpolation** to **parameterized queries** using the `branchFilter()` helper:

```javascript
// BEFORE (vulnerable)
const branchFilter = `AND up."branch" = '${branch}'`;
db.query(`...${branchFilter}...`, [startDate, endDate]);

// AFTER (parameterized)
const bf = branchFilter(branch);
db.query(`... ${bf.clause} ...`, [startDate, endDate, ...bf.params]);
```

### 2. Redis Caching (Performance)
- **TTL**: 5 minutes per query result
- **Key format**: `analytics:<dataType>:<branch>:<startDate>:<endDate>`
- Cache hits skip database queries entirely
- Graceful fallback if Redis is unavailable

### 3. Batch API Endpoint (Network)
- Single HTTP request replaces 15+ individual API calls
- Server executes all queries in parallel via `Promise.all()`
- Frontend falls back to individual requests if batch fails
- Limit: 20 queries per batch request

### 4. Frontend Optimizations
- **Lazy loading**: `StaffAnalytics` component is code-split via `React.lazy()`
- **Memoization**: All chart components use `React.memo()` to prevent unnecessary re-renders
- **Abort control**: Request counter prevents stale responses from overwriting newer data
- **Dark mode observer**: Uses `MutationObserver` instead of polling
- **Category filtering**: Only shows relevant charts per selected category

## Permissions

The analytics module is controlled by the existing permission system:

| Permission Key | Description |
|---------------|-------------|
| `analytics_allow_view` | View Analytics dashboard |
| `analytics_allow_export` | Export Analytics data |

Configured in `mds-staff/src/modules/role-management/role-permissions.js` and enforced by:
- **Frontend**: `<PermissionRoute moduleId="analytics">` in Dashboard.jsx
- **Sidebar**: Filtered by `hasPermission('analytics')` in StaffSidebar.jsx
- **Backend**: `jwtProtect('medical')` on all `/analytics/*` endpoints

## UI Design Consistency

The analytics module follows the established MDS Staff Portal design patterns:

- **Card components**: `bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700`
- **Page headers**: `text-lg font-bold text-secondary-800 dark:text-white` with subtitle
- **Category tabs**: Same pill-button style as Appointment section tabs
- **Summary cards**: Same grid layout as Dashboard stats
- **Loading states**: Consistent spinner with `border-primary-500`
- **Error states**: Warning icon with error color scheme
- **Color palette**: Uses TIP brand colors (`primary-500: #F1C526`)
- **Dark mode**: Full support with `dark:` Tailwind variants

## Adding New Analytics Queries

1. **Backend**: Add query function in `analytics-query.js` using the `branchFilter()` helper
2. **Register**: Add entry to `QUERY_HANDLERS` object
3. **Frontend**: Add chart type mapping in `CHART_TYPE_MAP` (analytics-service.js)
4. **Frontend**: Add display label in `QUERY_LABELS` (staff-analytics.jsx)
5. **Frontend**: Add to relevant category in `QUERY_CATEGORIES` (analytics-service.js)

## Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| `recharts` | latest | React charting library (Bar, Line, Pie, Doughnut) |

## File Changes Summary

| File | Change |
|------|--------|
| `Backend/staff.js` | Mount analytics route (`/analytics`) |
| `Backend/services/analytics-query.js` | Parameterized queries, Redis caching, batch execution |
| `Backend/routes/documents/analytics.js` | Added `/analytics/batch` POST endpoint |
| `mds-staff/package.json` | Added `recharts` dependency |
| `mds-staff/src/pages/Dashboard.jsx` | Added lazy import + route for `/analytics` |
| `mds-staff/src/modules/analytics/*` | New module (6 files) |
