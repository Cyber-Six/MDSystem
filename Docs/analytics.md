# Analytics and documents

This guide describes the current staff analytics API and document routes. Analytics routes are mounted by the staff server and protected by medical-portal authentication. Document routes provide staff document generation and patient-owned document access.

## Analytics endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /analytics/queries` | List registered analytics query keys. |
| `GET /analytics/reports` | List registered report types. |
| `GET /analytics/query/:dataType` | Fetch one metric. Requires `branch`, `startDate`, and `endDate`; supports additional filters such as `groupBy`, `sex`, `department`, and `ageGroup`. |
| `POST /analytics/batch` | Fetch multiple metrics for the same filter set. |
| `GET /analytics/report/:reportType` | Generate a PDF report. |
| `GET /analytics/export/presets` | List export presets. |
| `GET /analytics/export/types` | List exportable metrics and metadata. |
| `POST /analytics/export` | Export selected metrics or a preset as CSV, Excel, or PDF. |
| `POST /analytics/export/single` | Export a single metric as PDF. |

For analytics requests, valid branches are `Manila`, `QuezonCity`, and `Both`. Staff branch permissions are checked by the route. Use the running route implementation as the authority for request validation and response details; filters may be extended over time.

## Export behavior

The export endpoint accepts a format, branch, date range, and either a preset or metric keys. Optional filters include grouping, department, sex, and age group. It returns a downloadable file. The single-metric endpoint returns a focused PDF. Available presets and metrics are discoverable through the endpoints above rather than maintained as a duplicated static list here.

## Document endpoints

The document routes are mounted at `/documents`:

- `GET /documents/templates` lists document templates.
- `GET /documents/templates/:type/sample` returns sample template data.
- `POST /documents/:docType/preview` previews generated content.
- `POST /documents/:docType/generate` generates a document.
- Staff routes provide patient-document lookup and downloads; patient routes expose the signed-in patient's own documents.

The staff and patient routes apply their respective authentication and ownership checks. Document generation templates live under `Backend/services/doc-generate-module/`.

## Code locations

- API routes: `Backend/routes/analytics/analytics.js` and `Backend/routes/documents/`.
- Analytics data and exports: `Backend/services/analytics/`.
- Chart rendering: `Backend/services/rendering/`.
- Document templates: `Backend/services/doc-generate-module/`.
- Staff UI: `mds-staff/src/modules/analytics/`.

## Extending analytics

Add a query in `Backend/services/analytics/analytics-query.js`, register its key and metadata there, then confirm that route filtering and export metadata support the new query. Add or update the service tests next to that service. Do not edit a copied endpoint list; query and export metadata should be obtained from the service.
