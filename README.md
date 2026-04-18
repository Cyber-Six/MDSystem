# MDSystem

MDSystem is a multi-application medical information platform used across patient, staff, and mobile experiences. This repository contains the backend services, web portals, mobile client, and shared core logic.

## Applications In This Repository

| Scope | Path | Purpose |
| --- | --- | --- |
| Patient Web | `mds-patient/` | Patient-facing web portal (records, appointments, medicine requests, health chat, documents). |
| Staff Web | `mds-staff/` | Medical/staff portal (review workflows, appointments, inventory, analytics, role-based tools). |
| Mobile | `mds-mobile/` | Expo React Native mobile app for patient workflows. |
| Backend | `Backend/` | Express + GraphQL/REST backend, auth, sockets, media, document and EMR services. |
| Shared Core | `packages/core/` | Reusable cross-platform services (token, axios, validation, banners, auth helpers). |

## Workspace Behavior

- Root npm workspaces include `packages/*`, `mds-patient`, and `mds-staff`.
- `mds-mobile` is maintained in the same repository but is not part of the root workspaces list.
- Root `npm install` runs `Backend` install automatically via `postinstall`.

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL
- Redis
- SMTP credentials (for email flows)

## Installation

### 1) Install root dependencies

```bash
npm install
```

### 2) Install mobile dependencies

```bash
cd mds-mobile
npm install
cd ..
```

## Running The System

### Web + Backend (development)

Run backend and frontend in separate terminals.

```bash
# Terminal 1 - patient backend server
npm run start:patient

# Terminal 2 - patient web app (Vite)
npm run dev:patient
```

```bash
# Terminal 1 - staff backend server
npm run start:staff

# Terminal 2 - staff web app (Vite)
npm run dev:staff
```

### Mobile (Expo)

```bash
cd mds-mobile
npm start
```

### Production build (web apps)

```bash
npm run build
```

## Backend Configuration Notes

- Backend loads configuration from `Backend/.env` and validates required values on startup.
- Required groups include PostgreSQL, JWT, Redis, SMTP, and TOTP settings.
- Generate an initial TOTP encryption key with:

```bash
cd Backend
npm run setup:totp-key
```

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

## Related Documentation

- [Docs/file_structure.md](Docs/file_structure.md)
- [mds-mobile/README.md](mds-mobile/README.md)
- [packages/core/README.md](packages/core/README.md)
- [mds-patient/src/modules/record-forms/update-record/README.md](mds-patient/src/modules/record-forms/update-record/README.md)
- [mds-patient/src/modules/record-forms/initial-record/medical/README.md](mds-patient/src/modules/record-forms/initial-record/medical/README.md)

## License

This repository is proprietary software. See [LICENSE](LICENSE) for terms.
