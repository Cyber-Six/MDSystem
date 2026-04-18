# MDSystem

MDSystem is a multi-application medical information platform for patient care workflows, staff operations, and medical record management. It centralizes digital services for health records, consultation support, appointment operations, medicine requests, analytics, and document handling across web and mobile channels.

## System Summary

MDSystem is organized as a unified ecosystem with separate user experiences and a shared backend foundation:

- Patient website for self-service healthcare tasks.
- Staff website for medical and operational management.
- Mobile app for patient-first access to core services.
- Backend services for authentication, EMR, inventory, notifications, and documents.
- Shared core package for reusable cross-platform logic.

The platform supports both transactional workflows (for example, record updates and appointment operations) and communication workflows (for example, health chat and notifications).

## Website And App Scopes

| Scope | Path | Purpose |
| --- | --- | --- |
| Patient Web | `mds-patient/` | Patient-facing portal for records, appointments, medicine requests, documents, and health chat. |
| Staff Web | `mds-staff/` | Staff and medical portal for review, approvals, inventory, analytics, and role-sensitive operations. |
| Mobile App | `mds-mobile/` | React Native app for patient workflows and notifications on iOS/Android. |
| Backend | `Backend/` | Service layer providing API, GraphQL domains, socket events, auth, and data integration. |
| Shared Core | `packages/core/` | Shared services for auth/token handling, HTTP requests, validation, and common logic. |

## Module Overview

| Module Area | Description |
| --- | --- |
| Authentication And Security | Credential login, Google OAuth, 2FA/TOTP, session handling, rate limiting, and consent flows. |
| EMR And Record Forms | Initial record intake, update/revision workflows, catalog-driven medical/dental data entry. |
| Appointments | Patient scheduling and staff-side appointment management. |
| Health Chat | Real-time chat and support workflows with socket-backed updates. |
| Medicine And Inventory | Patient medicine request flow and staff inventory/dispensing processes. |
| Documents | Medical document generation, access, and patient/staff retrieval flows. |
| Notifications | In-app and push-oriented notification dispatch and acknowledgement flow. |
| Dashboard And Analytics | Operational metrics, summaries, and export/reporting features. |
| Role And Permissions | Staff capability boundaries and role-aware access control. |

## Tools And Technology Used

### Backend

- Node.js
- Express 5
- GraphQL + REST endpoints
- PostgreSQL
- Redis
- Socket.IO
- BullMQ
- JWT auth
- Joi validation

### Web Applications

- React
- Vite
- React Router
- Tailwind CSS
- Axios

### Mobile Application

- Expo
- React Native
- TypeScript
- React Navigation
- AsyncStorage
- NativeWind

### Shared Utilities

- Workspace shared package architecture (`@mdsystem/core`)
- Cross-platform token service and HTTP request handling
- Shared validation utilities and banner/notification helpers

## Repository Structure

```text
MDSystem/
|-- Backend/
|-- Docs/
|-- mds-mobile/
|-- mds-patient/
|-- mds-staff/
|-- packages/
|   `-- core/
`-- README.md
```

## License

This repository is proprietary software. See [LICENSE](LICENSE) for terms.
