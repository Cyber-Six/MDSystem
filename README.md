# MDSystem

MDSystem is a medical data management monorepo for the TIP ecosystem. The repository combines a Node.js/Express backend, two React web portals, a React Native mobile app, and a shared core package used across platforms.

## Overview

The current repository contains five main application areas:

- `Backend/` — Express 5 API services for patient and staff flows
- `mds-patient/` — React 19 + Vite patient portal
- `mds-staff/` — React 19 + Vite staff portal
- `mds-mobile/` — Expo + React Native mobile client
- `packages/core/` — shared platform-agnostic business logic

The root workspace manages the frontend/mobile packages with npm workspaces. The backend is installed separately through the root `postinstall` script.

## Repository Layout

```text
MDSystem/
├── Backend/
├── Docs/
├── mds-mobile/
├── mds-patient/
├── mds-staff/
├── packages/
│   └── core/
├── package.json
└── README.md
```

For a deeper folder map, see [Docs/file_structure.md](Docs/file_structure.md).

## Tech Stack

### Backend
- Node.js
- Express 5
- PostgreSQL
- Redis
- GraphQL
- BullMQ
- Nodemailer

### Web
- React 19
- Vite 7
- React Router 7
- Tailwind CSS 3
- ESLint

### Mobile
- Expo 54
- React Native 0.81
- TypeScript
- NativeWind
- AsyncStorage

### Shared Core
- ESM JavaScript
- Axios-based request utilities
- Shared token, banner, API base URL, and validation logic

## Workspace Commands

Run these from the repository root:

```bash
npm install
npm run build
npm run build:patient
npm run build:staff
npm run dev:patient
npm run dev:staff
npm run dev:mobile
npm run start:patient
npm run start:staff
```

### What These Commands Do

- `npm install` installs all workspaces, then runs `cd Backend && npm install`
- `npm run dev:patient` starts the patient Vite app
- `npm run dev:staff` starts the staff Vite app
- `npm run dev:mobile` starts the Expo dev server
- `npm run start:patient` runs `Backend/server.js`
- `npm run start:staff` runs `Backend/staff.js`

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the backend

Create `Backend/.env` manually. The backend reads configuration from `Backend/config/config.js` and expects these environment variables:

```env
POSTGRES_HOST=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=mdsystem
POSTGRES_PORT=5432
POSTGRES_MAX_CONN=5

JWT_SECRET=replace_me
JWT_EXPIRES_IN=1h
JWT_ISSUER=mdssyme-auth

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_USERNAME=mdsadmin
REDIS_PASSWORD=replace_me
REDIS_DB=0

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@example.com
SMTP_PASS=your_app_password
```

### 3. Configure the web apps

Both web apps already include `.env.example` files. Their `predev` and `prebuild` scripts sync `.env` from the example file automatically.

Patient portal variables live in `mds-patient/.env.example`.
Staff portal variables live in `mds-staff/.env.example`.

Key variables:

- `VITE_DEV_PORTAL`
- `VITE_BACKEND_URL`
- `VITE_BYPASS_PRIVATE_ROUTE_AUTH`
- `VITE_BYPASS_INITIAL_RECORD` in the patient app

### 4. Start the apps

```bash
npm run start:patient
npm run start:staff
npm run dev:patient
npm run dev:staff
npm run dev:mobile
```

## Runtime Notes

### Backend entry points
- `Backend/server.js` handles the patient-facing backend runtime
- `Backend/staff.js` handles the staff-facing backend runtime

### Local development routing
- `mds-patient/vite.config.js` can proxy to `http://localhost:3001` when `VITE_DEV_PORTAL=local`
- `mds-staff/vite.config.js` can proxy to `http://localhost:3002` when `VITE_DEV_PORTAL=local`

### Shared core adapters
- `mds-patient/src/packages-core-adapter.js` wires `@mdsystem/core` to browser APIs
- `mds-staff/src/packages-core-adapter.js` wires `@mdsystem/core` to browser APIs
- `mds-mobile/src/core.ts` wires `@mdsystem/core` to React Native APIs

## Major Modules

### Backend routes
- `auth` for login, registration, refresh, email, and password flows
- `appointment` for appointment GraphQL operations
- `emr` for electronic medical records
- `profile` for profile GraphQL operations
- `medical-inventory` for inventory, prescriptions, and medicine requests
- `info` for announcements and compliance content
- `media` for uploads and media access
- `consultation` for consultation-specific flows

### Patient portal modules
- `auth`
- `dashboard`
- `appointment`
- `e-consultation`
- `medicine-request`
- `record-forms`

### Staff portal modules
- `auth`
- `dashboard`
- `appointment`
- `medical-inventory`
- `pending-requests`
- `role-management`

## Documentation

- [Docs/file_structure.md](Docs/file_structure.md) — current repository structure
- [Docs/PENDING_REVIEW_IMPLEMENTATION.md](Docs/PENDING_REVIEW_IMPLEMENTATION.md) — pending review workflow notes
- [packages/core/README.md](packages/core/README.md) — shared core package
- [mds-mobile/README.md](mds-mobile/README.md) — mobile-specific setup and notes

## Testing And Verification

Currently verified project checks in the repository are:

```bash
cd mds-patient && npm run lint
cd mds-staff && npm run lint
```

Current gaps:

- `Backend/package.json` does not define a real automated test suite
- `packages/core/package.json` still uses a placeholder `npm test` script
- The root workspace does not expose a unified test command yet

## Known Documentation Constraints

- The repository includes `Backend/config/middleware/chatbotProxy.js`, but there is no checked-in `Backend/MDS-AI-Chatbot/` service directory in this workspace.
- `Backend/services/docx-generation/` exists and contains its own Python-based assets and templates.
- The canonical project documentation directory is `Docs/`, not `docs/`.

## License

This repository is proprietary software. See [LICENSE](LICENSE) for the applicable terms.
