# Analytics System Improvements

## Date: April 6, 2026

## Summary of Changes

This document covers all analytics improvements made across the backend and frontend, including dynamic date grouping, improved PDF report formatting, Blood Pressure trend fixes, and individual metric export selection.

---

## 1. Dynamic Date Grouping (Daily / Weekly / Monthly / Quarterly / Yearly)

### Problem
Trend queries (BMI Trends, Blood Pressure Trends, Consultation Trends) were hardcoded to monthly grouping (`TO_CHAR(date, 'YYYY-MM')`), making it impossible to analyze data at other granularities.

### Solution
Added a `groupBy` parameter that flows from the frontend filter bar through the API to the SQL queries.

### Files Changed

**Backend:**
- `Backend/services/analytics-query.js`
  - Added `VALID_GROUP_BY` constant: `['daily', 'weekly', 'monthly', 'quarterly', 'yearly']`
  - Added `dateGroupExpr()` helper that returns the SQL expression for each grouping:
    - `daily` → `TO_CHAR(date, 'YYYY-MM-DD')`
    - `weekly` → `TO_CHAR(date_trunc('week', date), 'YYYY-"W"IW')`
    - `monthly` → `TO_CHAR(date, 'YYYY-MM')`
    - `quarterly` → `TO_CHAR(date, 'YYYY-"Q"Q')`
    - `yearly` → `TO_CHAR(date, 'YYYY')`
  - Updated `bmiTrends()`, `bloodPressureTrends()`, `consultationTrends()` to accept `options.groupBy`
  - Updated `executeQuery()` and `executeBatchQueries()` to pass `options` through, with `groupBy` included in the Redis cache key

- `Backend/routes/documents/analytics/analytics.js`
  - `GET /analytics/query/:dataType` — reads `groupBy` from query params
  - `POST /analytics/batch` — reads `groupBy` from request body
  - `POST /analytics/export` — reads `groupBy` from request body
  - `POST /analytics/export/single` — reads `groupBy` from request body and passes to `meta`

**Frontend:**
- `mds-staff/src/modules/analytics/analytics-service.js`
  - Added `PERIOD_PRESETS` constant with all 6 options (daily, weekly, monthly, quarterly, yearly, custom)
  - Added `getDateRangeForPeriod()` helper that auto-calculates sensible date ranges per period
  - Updated `fetchQueryData()`, `fetchMultipleQueries()`, `exportAnalytics()`, `exportSingleMetric()` to accept and pass `groupBy`

- `mds-staff/src/modules/analytics/staff-analytics.jsx`
  - Added `groupBy` state (defaults to `'monthly'`)
  - Period selection auto-updates both `groupBy` and date range
  - Passes `groupBy` to filter bar, chart cards, and export modal

- `mds-staff/src/modules/analytics/components/analytics-filter-bar.jsx`
  - Added Period dropdown selector between Branch and From date inputs
  - Imports `PERIOD_PRESETS` from analytics-service

---

## 2. Blood Pressure Trends Fix

### Problem
Blood pressure is stored as a string in "systolic/diastolic" format (e.g. "120/80"). The query only returned the systolic average, losing diastolic data. The label was hardcoded to "Monthly".

### Solution
- The SQL query now uses `SPLIT_PART` to parse both systolic and diastolic values from the BP string
- Added regex validation `'^[0-9]+/[0-9]+$'` to filter malformed BP entries
- Now returns `diastolicValues` alongside `values` (systolic)
- PDF export renders a **dual-line chart** (red for Systolic, blue for Diastolic)
- PDF table shows: Period, Avg Systolic, Avg Diastolic, Combined BP

### Files Changed
- `Backend/services/analytics-query.js` → `bloodPressureTrends()` returns `{ labels, values, diastolicValues, total, groupBy }`
- `Backend/services/analytics-export.js` → `generateSingleMetricPDF()` handles BP with dual-line chart and 5-column table
- `Backend/services/doc-generate-module/templates/staff-report.js` → `_addChartSections()` handles BP sections with dual-line chart

---

## 3. BMI Trends Fix

### Problem
BMI trends were hardcoded to monthly grouping only.

### Solution
- The query now uses the dynamic `dateGroupExpr()` helper
- The period label in the PDF title reflects the actual grouping (e.g. "BMI Trends (Weekly)")
- EXPORT_META label changed from "BMI Trends (Monthly)" to "BMI Trends"

### Files Changed
- `Backend/services/analytics-query.js` → `bmiTrends()` accepts `options.groupBy`
- `Backend/services/analytics-export.js` → EXPORT_META updated

---

## 4. Improved PDF Report Format

### Problem
PDF exports showed only charts without proper data tables. The format was not presentation-ready.

### Solution

**Single-Metric PDF (`generateSingleMetricPDF`):**
- **Header**: Clinic name, report title with period label, date range
- **Report Information**: Branch, date range, grouping, total records, generated timestamp
- **Ranked Data Table**: Sorted by count descending (non-trend) or chronological (trends). Columns include rank #, label, value, and percentage
- **Chart Visualization**: Rendered below the table — fits 1–2 pages
- **Footer**: Internal-use disclaimer, physician signature, page numbers

**Multi-Metric PDF (Staff Report Template):**
- Each section now shows a **data table before the chart**
- Tables include rank numbers and percentage columns
- BP sections show Systolic, Diastolic, and Combined columns
- Chart sizes reduced from 450×280 to 420×240 for better page fit

### Files Changed
- `Backend/services/analytics-export.js` → Complete rewrite of `generateSingleMetricPDF()` and updated `generatePDF()`
- `Backend/services/doc-generate-module/templates/staff-report.js` → `_addChartSections()` now renders tables before charts

---

## 5. Individual Metric Export Selection

### Problem
Users could only export by preset categories (e.g. "Consultations", "Vitals"). There was no way to export a single specific metric like just "Top 10 Diagnoses" via the export modal.

### Solution
Added a "Select Specific Metrics" option to the export scope dropdown. When selected, a checkbox list of all 15 metrics appears, allowing the user to choose exactly which metrics to include.

### Files Changed
- `mds-staff/src/modules/analytics/components/analytics-export-modal.jsx`
  - Added `{ value: 'custom', label: 'Select Specific Metrics' }` to `SCOPE_OPTIONS`
  - Added `selectedMetrics` state with toggle handler
  - Added checkbox grid UI that appears when scope is `'custom'`
  - When scope is `'custom'`, sends `dataTypes` array instead of `preset`

---

## 6. Consultation Trends Label Update

### Problem
Label was hardcoded to "Monthly Consultation Trends" even when viewing daily/weekly data.

### Solution
- EXPORT_META label changed to "Consultation Trends" (period appended dynamically)
- Frontend `QUERY_LABELS` updated to match

### Files Changed
- `Backend/services/analytics-export.js` → EXPORT_META
- `mds-staff/src/modules/analytics/staff-analytics.jsx` → QUERY_LABELS

---

## API Changes Summary

| Endpoint | Method | Parameter Added | Type | Description |
|----------|--------|----------------|------|-------------|
| `/analytics/query/:dataType` | GET | `groupBy` | query param | `daily\|weekly\|monthly\|quarterly\|yearly` |
| `/analytics/batch` | POST | `groupBy` | body | Applied to all queries in batch |
| `/analytics/export` | POST | `groupBy` | body | Passed to export data fetching |
| `/analytics/export/single` | POST | `groupBy` | body | Passed to single metric export |

All `groupBy` parameters are optional and default to `'monthly'` when not provided, maintaining backward compatibility.

---

## Files Modified (Complete List)

| File | Changes |
|------|---------|
| `Backend/services/analytics-query.js` | Added `dateGroupExpr()`, `VALID_GROUP_BY`, updated 3 trend queries and executor functions |
| `Backend/services/analytics-export.js` | Updated EXPORT_META labels, `fetchExportData()` options, rewrote `generateSingleMetricPDF()`, updated `generatePDF()` |
| `Backend/services/doc-generate-module/templates/staff-report.js` | Rewrote `_addChartSections()` with table-first layout and BP support |
| `Backend/routes/documents/analytics/analytics.js` | Added `groupBy` param to all 4 endpoints |
| `mds-staff/src/modules/analytics/analytics-service.js` | Added `PERIOD_PRESETS`, `getDateRangeForPeriod()`, `groupBy` in all API functions |
| `mds-staff/src/modules/analytics/staff-analytics.jsx` | Added `groupBy` state, period change handler, updated props |
| `mds-staff/src/modules/analytics/components/analytics-filter-bar.jsx` | Added Period dropdown selector |
| `mds-staff/src/modules/analytics/components/analytics-export-modal.jsx` | Added custom metric selection UI, `groupBy` prop |
| `mds-staff/src/modules/analytics/components/analytics-chart-card.jsx` | Pass `groupBy` to single export |
