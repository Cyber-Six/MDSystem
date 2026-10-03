# MDSystem documentation

This folder contains the current technical guides and a preserved archive of implementation-era reports. Use the repository files and current guides as the source of truth; archived reports record what was investigated or changed at the time they were written.

## Start here

- [Playwright GUI and E2E testing](PLAYWRIGHT_E2E.md) — hosted smoke tests and isolated Pi database-backed workflows.

- [Repository overview](../README.md) — applications, backend, and workspace layout.
- [Docker deployment](DOCKER.md) — prerequisites, first database initialization, routine start/stop, backups, and troubleshooting.
- [CI and deployment](CI_CD.md) — GitHub Actions, selecting a release branch and version, staging use-case testing, and production promotion.
- [Backend testing](TESTING.md) — Jest commands, coverage rules, and test boundaries.
- [Security](SECURITY.md) — authentication, authorization, account protection, and operational security.
- [File structure](file_structure.md) — current repository map.

## Current feature guides

- [Analytics and documents](analytics.md) — analytics queries, report and data exports, document endpoints.
- [Appointments](appointment.md) — patient and staff GraphQL endpoints, scheduling, and appointment events.
- [Consultation](consultation.md) — consultation API and workflow.
- [Patient and staff EMR](emr.md) and [staff EMR details](staff-emr.md).
- [Health chat](health-chat.md) — GraphQL and Socket.IO workflows.
- [Medical inventory](medical-inventory.md) — inventory and medicine request workflows.
- [Patient documents](patient-documents.md) — patient document access and data flow.
- [Notifications](notifications.md) — delivery channels, preferences, acknowledgements, and notification endpoints.
- [Authentication integrations](authentication-integrations.md) — Google OAuth and reCAPTCHA configuration and behavior.
- [TOTP two-factor authentication](2FA_TOTP_IMPLEMENTATION.md).
- [Role management](role-management.md).
- [Socket.IO](sockets.md) — connection, Redis adapter, rooms, and events.
- [User preferences API](USER_PREFERENCES_API.md).

## Other project material

- [Academic project report](Documentation/) — thesis and presentation materials; maintained separately from implementation guides.
- [MDSystem brochures](MDSYSTEM_BROCHURE.md) and [minimal brochure](MDSYSTEM_BROCHURE_MINIMAL.md).
- [Requirements checklist](REQUIREMENTS_CHECKLIST.md) — project requirements tracking.
- [Archived reports](archive/README.md) — historical implementation, verification, and bug-fix records.
