# Analytics Export Feature

## Overview

The analytics export feature allows staff users to download analytics data in three formats: **CSV**, **Excel (.xlsx)**, and **PDF**. It supports exporting all metrics, category-based presets, or individual chart metrics.

---

## Architecture

```
Frontend (mds-staff)                        Backend (Express)
┌────────────────────────┐                  ┌────────────────────────────────────┐
│ staff-analytics.jsx    │                  │ routes/analytics/analytics.js      │
│  ├─ Export button       │ ──POST──────▶   │  ├─ POST /analytics/export         │
│  └─ AnalyticsExportModal│                 │  ├─ POST /analytics/export/single  │
│                        │                  │  ├─ GET  /analytics/export/presets  │
│ analytics-chart-card   │                  │  └─ GET  /analytics/export/types   │
│  └─ Per-chart ↓ button │ ──POST──────▶   │                                    │
│                        │                  │ services/analytics-export.js       │
│ analytics-service.js   │                  │  ├─ generateCSV()                  │
│  ├─ exportAnalytics()  │                  │  ├─ generateExcel()                │
│  └─ exportSingleMetric()│                 │  ├─ generatePDF()                  │
└────────────────────────┘                  │  └─ generateSingleMetricPDF()      │
                                            │                                    │
                                            │ Leverages:                         │
                                            │  ├─ analytics-query.js (data)      │
                                            │  ├─ chart.js (PNG charts)          │
                                            │  ├─ pdfkit.js (PDF utilities)      │
                                            │  └─ doc-generate-module (templates)│
                                            └────────────────────────────────────┘
```

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `Backend/services/analytics-export.js` | Core export service — CSV/Excel/PDF generation |
| `mds-staff/src/modules/analytics/components/analytics-export-modal.jsx` | Export modal UI component |

### Modified Files

| File | Changes |
|------|---------|
| `Backend/routes/analytics/analytics.js` | Added and maintained export endpoints |
| `mds-staff/src/modules/analytics/analytics-service.js` | Added `exportAnalytics()`, `exportSingleMetric()`, `EXPORT_PRESETS` |
| `mds-staff/src/modules/analytics/staff-analytics.jsx` | Added Export button + modal integration |
| `mds-staff/src/modules/analytics/components/analytics-chart-card.jsx` | Added per-card PDF export button |
| `mds-staff/vite.config.js` | Updated proxy bypass to allow `/analytics/export` and `/analytics/report` |

---

## API Endpoints

### `POST /analytics/export`
Export multiple metrics in the chosen format.

**Body:**
```json
{
  "format": "csv" | "excel" | "pdf",
  "branch": "Manila" | "QuezonCity" | "Both",
  "startDate": "2025-01-01",
  "endDate": "2025-06-01",
  "groupBy": "daily" | "weekly" | "monthly" | "quarterly" | "yearly",  // optional
  "department": "BS Computer Science",                                     // optional
  "sex": "Male" | "Female",                                              // optional
  "preset": "full-report",        // optional – overrides dataTypes
  "dataTypes": ["top-diagnoses"]   // optional – specific queries
}
```
**Response:** Binary file download with `Content-Disposition` header.

### `POST /analytics/export/single`
Export a single metric as a focused PDF with data table + chart.

**Body:**
```json
{
  "dataType": "top-diagnoses",
  "branch": "Manila",
  "startDate": "2025-01-01",
  "endDate": "2025-06-01",
  "groupBy": "monthly",       // optional
  "department": "Nursing",    // optional
  "sex": "Female"             // optional
}
```

### `GET /analytics/export/presets`
Returns available export presets with labels and descriptions.

### `GET /analytics/export/types`
Returns all exportable data types with display metadata (label, axes, chart type).

---

## Export Formats

### CSV
- Comment-prefixed metadata header now includes branch, date range, groupBy, department filter, sex filter, and generated timestamp.
- First table is now a flat detailed breakdown for import workflows, with one row per chart data point (including series rows for grouped-bar/heatmap and quartiles for box plots).
- Detail columns include: metric key/label, chart type/variant, x/y axis labels, data label, series, value, raw count, diastolic value, min/q1/median/q3/max/sample count, percent-of-total, metric totals, and filter/date context.
- Summary table is still included after details for quick totals.
- Safe escaping of commas, quotes, and newlines.

### Excel (.xlsx)
- **Detailed Breakdown sheet (default first tab)**: Flattened full-detail dataset (same shape as CSV detail rows) so opening/importing the file immediately shows informative analytics rows.
- **Summary sheet**: Still provides totals, but now includes chart type, date range, and active filters.
- **Per-metric sheets**: Individual worksheets now include branch/date/filter metadata and richer table columns for:
  - series-based metrics (male/female, department-type splits, matrix series)
  - blood-pressure trends (systolic + diastolic)
  - oral findings percentage metrics (percentage + raw count)
  - box-plot metrics (min, q1, median, q3, max, sample count)
- Dark green header styling (#2F4F4F), cell borders, auto-widths
- Uses `exceljs` library

### PDF
- **Multi-metric report**: Uses existing `StaffReportTemplate` with embedded charts and now embeds active filter context (groupBy, department, sex) in report subtitle and section summaries.
- **Single-metric report**: Focused layout now includes department and sex filters in report information, plus grouping when applicable.
- Dynamic filenames: `{metric}_{branch}_{startDate}_to_{endDate}.pdf`

---

## Export Presets

| Preset | Metrics | Description |
|--------|---------|-------------|
| `full-report` | All configured metrics | Complete analytics export |
| `consultations` | 3 | Type, status, trends |
| `diagnoses` | 2 | Top ICD-10, type distribution |
| `vitals` | 3 | BMI, blood pressure, and vital-sign distribution |
| `appointments` | 4 | Category, status, session, accommodated trends |
| `clinical` | 2 | Immunization, dental procedures |
| `lifestyle` | 4 | Risk factors, lifestyle statistics, allergies |
| `emr` | 4 | Reproductive health, oral findings, lifestyle stats, vital signs |
| `general` | 2 | Credential status and branch population |
| `inventory` | 4 | Consumption trends, top consumed items, stock summary |
| `demographics` | 12 | Sex, age group, department, program, and matrix analytics |

---

## Frontend UI

### Export Modal (`AnalyticsExportModal`)
- **Format picker**: 3 card buttons (PDF, Excel, CSV) with icons and descriptions
- **Scope selector**: Dropdown with "Full Report" + all category presets
- **Summary panel**: Shows branch, date range, and format
- **Loading state**: Spinner during export
- **Error handling**: Inline error message

### Per-Chart Export
Each `AnalyticsChartCard` has a small download icon (↓) in the header. Clicking it triggers a single-metric PDF export for that specific chart and now carries the currently selected department and sex filters so the exported metric matches the on-screen chart.

---

## April 2026 Enhancement Summary

This enhancement resolved the issue where downloaded analytics appeared as totals-only summaries during import/review.

- Export outputs now include full chart-level rows and grouped breakdowns, not only metric totals and item counts.
- Active filters (date range, groupBy, sex, department) are embedded across CSV, Excel, and PDF outputs.
- Excel now opens directly to a detail-first sheet to make imports and audits immediately informative.
- Single-chart PDF export now respects demographic filters used in the dashboard.

---

## Dependencies

- **exceljs** (newly installed) — Excel workbook generation
- **pdfkit** (existing) — PDF document creation
- **chartjs-node-canvas** (existing) — Server-side chart PNG rendering
- **doc-generate-module** (existing) — Template-based document generation

---

## Security

- All endpoints require JWT authentication (`jwtProtect('medical')`)
- Branch access control enforced via `getUserBranch()`
- Input validation on format, branch, dates, and data types
- No user-supplied content is used in filenames (slugified from config)
