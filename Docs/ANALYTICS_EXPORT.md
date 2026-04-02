# Analytics Export Feature

## Overview

The analytics export feature allows staff users to download analytics data in three formats: **CSV**, **Excel (.xlsx)**, and **PDF**. It supports exporting all metrics, category-based presets, or individual chart metrics.

---

## Architecture

```
Frontend (mds-staff)                        Backend (Express)
┌────────────────────────┐                  ┌────────────────────────────────────┐
│ staff-analytics.jsx    │                  │ routes/documents/analytics.js      │
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
| `Backend/routes/documents/analytics.js` | Added 4 export endpoints |
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
  "endDate": "2025-06-01"
}
```

### `GET /analytics/export/presets`
Returns available export presets with labels and descriptions.

### `GET /analytics/export/types`
Returns all exportable data types with display metadata (label, axes, chart type).

---

## Export Formats

### CSV
- Comment-prefixed metadata header (branch, dates, generated timestamp)
- Summary table: metric name + total
- Per-metric sections: xAxis/yAxis columns with totals
- Safe escaping of commas, quotes, and newlines

### Excel (.xlsx)
- **Summary sheet**: Merged title row, styled header table with metric name/total/items count
- **Per-metric sheets**: Individual worksheets with formatted data tables
- Dark green header styling (#2F4F4F), cell borders, auto-widths
- Uses `exceljs` library

### PDF
- **Multi-metric report**: Uses existing `StaffReportTemplate` with embedded charts (pie, bar, line, doughnut) and summary KPIs
- **Single-metric report**: Focused layout with data table (top 10 rows with percentages), embedded chart, physician signature
- Dynamic filenames: `{metric}_{branch}_{startDate}_to_{endDate}.pdf`

---

## Export Presets

| Preset | Metrics | Description |
|--------|---------|-------------|
| `full-report` | All 15 | Complete analytics export |
| `consultations` | 3 | Type, status, trends |
| `diagnoses` | 2 | Top ICD-10, type distribution |
| `vitals` | 2 | BMI, blood pressure trends |
| `appointments` | 3 | Category, status, session |
| `clinical` | 2 | Immunization, dental procedures |
| `lifestyle` | 3 | Risk factors, allergies |

---

## Frontend UI

### Export Modal (`AnalyticsExportModal`)
- **Format picker**: 3 card buttons (PDF, Excel, CSV) with icons and descriptions
- **Scope selector**: Dropdown with "Full Report" + all category presets
- **Summary panel**: Shows branch, date range, and format
- **Loading state**: Spinner during export
- **Error handling**: Inline error message

### Per-Chart Export
Each `AnalyticsChartCard` has a small download icon (↓) in the header. Clicking it triggers a single-metric PDF export for that specific chart.

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
