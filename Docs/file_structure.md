# MDSystem — File Structure

> Auto-generated codebase map. Excludes `node_modules/`, `dist/`, `.git/`, `package-lock.json`, and the legacy `mds-frontend/` directory.

```
MDSystem/
├── package.json                        # npm workspaces root (mds-patient, mds-staff, mds-mobile, packages/*)
├── .gitignore
├── LICENSE
├── README.md
│
├── Backend/                            # Express.js API server (CommonJS, not in npm workspaces)
│   ├── package.json
│   ├── .env                            # Environment variables (gitignored)
│   ├── server.js                       # Patient portal server entry — auth, EMR, profile, media, chatbot routes
│   ├── staff.js                        # Staff portal server entry — EMR, profile, appointment GraphQL routes
│   │
│   ├── config/
│   │   ├── config.js                   # Centralized config loader (DB, JWT, Redis, SMTP from .env)
│   │   ├── db.js                       # PostgreSQL connection pool (pg)
│   │   ├── jwt.js                      # JWT access/refresh token generation, validation, Redis-backed sessions
│   │   ├── redis.js                    # Redis client init + helpers (OTP, rate limits, sessions, media staging)
│   │   ├── multer.js                   # File upload middleware (MIME validation, size limits, UUID naming)
│   │   ├── query.js                    # Reusable PostgreSQL query wrappers
│   │   │
│   │   ├── data/
│   │   │   ├── data.js                 # Static data constants (dental cleaning ranges, etc.)
│   │   │   ├── matrix.js              # Rate-limit configuration matrices per auth profile
│   │   │   └── post_build_setup.sql   # Post-deployment SQL setup script
│   │   │
│   │   ├── media/
│   │   │   └── icdapi/
│   │   │       ├── icdapi.js          # ICD-11 API integration
│   │   │       └── tokenauth.js       # ICD API OAuth token management
│   │   │
│   │   └── middleware/
│   │       ├── jwtProtect.js          # JWT auth middleware — validates tokens, enforces role-based access
│   │       └── ratelimiter.js         # Redis-backed IP rate limiting middleware
│   │
│   ├── routes/
│   │   ├── auth/
│   │   │   ├── email/
│   │   │   │   ├── emailauth.js       # Email verification & 2FA OTP endpoints
│   │   │   │   └── emailpassword-reset.js  # Password reset email flow
│   │   │   ├── jwt/
│   │   │   │   └── refresh.js         # JWT refresh token endpoint
│   │   │   └── user/
│   │   │       ├── login.js           # User login endpoint
│   │   │       ├── register.js        # User registration endpoint
│   │   │       └── user-password.js   # Password change endpoint
│   │   │
│   │   ├── emr/                       # Electronic Medical Records (GraphQL)
│   │   │   ├── graphql.js             # EMR GraphQL init (patient + medical schemas)
│   │   │   ├── schema.graphql         # EMR GraphQL type definitions
│   │   │   ├── query/
│   │   │   │   ├── anchor.js          # Anchor record queries
│   │   │   │   ├── delete.js          # Record deletion queries
│   │   │   │   └── upsert.js          # Record upsert queries
│   │   │   ├── resolvers/
│   │   │   │   ├── record-validator.js # EMR record validation logic
│   │   │   │   ├── patient/
│   │   │   │   │   ├── patient-resolver.js  # Patient EMR resolver
│   │   │   │   │   ├── query.js       # Patient EMR query implementations
│   │   │   │   │   ├── mutation.js    # Patient EMR mutation implementations
│   │   │   │   │   └── helper.js      # Patient resolver helpers
│   │   │   │   └── medical/
│   │   │   │       ├── medical-resolver.js  # Medical staff EMR resolver
│   │   │   │       ├── query.js       # Medical EMR query implementations
│   │   │   │       ├── mutation.js    # Medical EMR mutation implementations
│   │   │   │       └── helper.js      # Medical resolver helpers
│   │   │   └── wrapper/
│   │   │       ├── query.js           # EMR query wrapper with ticket validation
│   │   │       └── mutation.js        # EMR mutation wrapper
│   │   │
│   │   ├── profile/                   # User profiles (GraphQL)
│   │   │   ├── graphql.js             # Profile GraphQL init (patient + medical schemas)
│   │   │   ├── schema.graphql         # Profile GraphQL type definitions
│   │   │   └── resolvers/
│   │   │       ├── patient/
│   │   │       │   └── patient-resolver.js
│   │   │       ├── medical/
│   │   │       │   └── medical-resolver.js
│   │   │       └── wrapper/
│   │   │           └── wrapper.js     # Profile resolver wrapper with tickets
│   │   │
│   │   ├── appointment/               # Appointment scheduling (GraphQL)
│   │   │   ├── graphql.js             # Appointment GraphQL init (patient + medical schemas)
│   │   │   ├── schema.graphql         # Appointment GraphQL type definitions
│   │   │   └── resolvers/
│   │   │       ├── patient/
│   │   │       │   └── patient-resolver.js
│   │   │       ├── medical/
│   │   │       │   └── medical-resolver.js
│   │   │       └── wrapper/
│   │   │           ├── wrapper.js
│   │   │           └── helper.js
│   │   │
│   │   ├── info/
│   │   │   ├── announcement/
│   │   │   │   └── announcement.js    # System announcement endpoints
│   │   │   └── compliance/
│   │   │       └── consent.js         # Data consent version & text endpoint
│   │   │
│   │   ├── media/
│   │   │   └── media.js               # File upload/download endpoints
│   │   │
│   │   ├── staff/
│   │   │   └── .txt                   # Placeholder
│   │   └── upload/                    # Upload route directory
│   │
│   ├── services/
│   │   ├── emailservice.js            # BullMQ email queue — builds jobs for verification, 2FA, password reset
│   │   ├── emailworker.js             # BullMQ worker — processes email jobs via Nodemailer/SMTP
│   │   ├── permit.js                  # Staff permission checking against DB-stored flags
│   │   └── recaptcha.js               # Server-side Google reCAPTCHA verification
│   │
│   ├── utils/
│   │   ├── authSession.js             # AuthSession class — creates login sessions (tokens + device/role info)
│   │   ├── const.js                   # Shared constants (reserved)
│   │   ├── converter.js               # Identity string → normalized role name converter
│   │   ├── graphql-helper.js          # GraphQL error builder with HTTP status codes
│   │   ├── logger.js                  # Winston logger with daily rotating files
│   │   ├── portal.js                  # Portal type detection from request subdomain
│   │   ├── security.js                # bcrypt hashing, random key generation, OTP hashing
│   │   ├── validator.js               # Email validation & role classification by pattern
│   │   └── schema/
│   │       └── emr/
│   │           └── emr.graphql        # Shared EMR GraphQL schema fragments
│   │
│   ├── mds-chatbot/                   # AI Medical Chatbot module (Llama-based)
│   │   ├── index.js                   # Chatbot entry — initializes Llama, conversation service, routes
│   │   ├── config/
│   │   │   ├── model-config.js        # Llama model paths, timeouts, server configuration
│   │   │   └── safety-rules.js        # Medical safety guardrails and content rules
│   │   ├── controllers/
│   │   │   ├── chat-controller.js     # Chat request/response handler
│   │   │   └── handoff-controller.js  # Human handoff escalation handler
│   │   ├── middleware/
│   │   │   ├── emergency-detector.js  # Emergency keyword detection middleware
│   │   │   └── safety-filter.js       # Response safety filtering middleware
│   │   ├── routes/
│   │   │   └── chat-routes.js         # Chat API route definitions
│   │   ├── services/
│   │   │   ├── llama-service.js       # Llama server lifecycle management & inference
│   │   │   └── conversation-service.js # Conversation history & context management
│   │   ├── database/
│   │   │   ├── DATABASE_ARCHITECTURE.md
│   │   │   └── SETUP_DATABASE.md
│   │   ├── docs/
│   │   │   └── README_AI_CHATBOT.md
│   │   └── models-storage/            # Local model file storage (gitignored)
│   │
│   └── commands/                      # Server management shell scripts
│       ├── buildserver.sh             # Build/deploy script
│       ├── dbsetup.sh                 # Database setup script
│       ├── debugtoolkit.sh            # Debug utilities
│       ├── infraservice.sh            # Infrastructure service management
│       ├── refreshcloudflared.sh      # Cloudflare tunnel refresh
│       ├── serverservice.sh           # Server systemd service management
│       └── tailogs.sh                 # Log tailing utility
│
├── packages/                          # Shared npm workspace packages
│   └── core/                          # @mdsystem/core — platform-agnostic shared code
│       ├── package.json               # Exports: config/*, services/*, utils/*, validation/*
│       ├── README.md
│       ├── LICENSE
│       └── src/
│           ├── index.js               # Barrel export — all core services
│           ├── config/
│           │   └── banner-config.js   # HTTP status → banner notification type mapping
│           ├── services/
│           │   ├── api-base-url-provider.js  # Platform-agnostic API base URL factory (DI pattern)
│           │   ├── axios-request-handler.js  # Axios instance factory — token injection, 401 refresh, banners
│           │   ├── banner-service.js         # Notification state manager (add, dismiss, subscribe)
│           │   ├── console-request-logger.js # Dev-mode HTTP request logger
│           │   └── token-service.js          # Token storage factory — access/refresh token management
│           ├── utils/
│           │   └── role-detection.js         # Role detection from hostname subdomain patterns
│           ├── validation/
│           │   ├── email-validation.js       # Email format validation rules
│           │   ├── password-validation.js    # Password strength validation rules
│           │   ├── user-constants.js         # Shared user-related constants
│           │   └── VALIDATION_UTILITIES.md
│           └── scripts/
│               ├── fetch-sheets-config.js    # Google Sheets CSV fetcher for layout config
│               ├── setup-env.js              # Environment setup helper
│               └── generated/               # Auto-generated config output
│
├── mds-patient/                       # Patient Portal — React web app (Vite + React 19)
│   ├── package.json
│   ├── .env.example                   # Environment template (VITE_DEV_PORTAL, VITE_BACKEND_URL, bypasses)
│   ├── index.html                     # Vite HTML entry
│   ├── vite.config.js                 # Vite config — @core alias, proxy to localhost:3001
│   ├── tailwind.config.js             # Tailwind CSS config with custom design system
│   ├── postcss.config.js
│   ├── eslint.config.js
│   ├── public/
│   │   └── MDSystem.png
│   └── src/
│       ├── main.jsx                   # React DOM entry point
│       ├── App.jsx                    # Root component — Router, routes, BannerProvider
│       ├── packages-core-adapter.js   # Wires @mdsystem/core with browser APIs (localStorage, location)
│       │
│       ├── pages/                     # Top-level page components (imported by App.jsx)
│       │   ├── Auth.jsx               # Authentication page shell
│       │   └── Dashboard.jsx          # Dashboard page — layout, sidebar routes, initial record check
│       │
│       ├── routes/
│       │   └── private-route.jsx      # Auth-guarded route — token validation, refresh, dev bypass
│       │
│       ├── modules/                   # Feature modules
│       │   ├── auth/
│       │   │   ├── login.jsx          # Login form
│       │   │   ├── register.jsx       # Registration form
│       │   │   ├── forget-password.jsx # Forgot password form
│       │   │   ├── resetpassword.jsx  # Password reset page
│       │   │   ├── auth-slides.jsx    # Auth page carousel slides
│       │   │   └── data-consent/
│       │   │       ├── data-consent.jsx # Data consent acceptance component
│       │   │       └── index.js
│       │   │
│       │   ├── dashboard/
│       │   │   └── dashboard-home.jsx # Dashboard landing page content
│       │   │
│       │   ├── appointment/
│       │   │   ├── appointment-router.jsx         # Appointment sub-routes
│       │   │   └── patient-appointment-service.js # Appointment API service
│       │   │
│       │   ├── e-consultation/
│       │   │   ├── e-consultation.jsx # AI chatbot consultation page
│       │   │   └── components/
│       │   │       ├── ChatBox.jsx
│       │   │       ├── EmptyState.jsx
│       │   │       ├── GuidelinesCard.jsx
│       │   │       ├── LoadingIndicator.jsx
│       │   │       └── MessageBubble.jsx
│       │   │
│       │   ├── medicine-request/
│       │   │   └── medicine-request-page.jsx      # Medicine request form
│       │   │
│       │   └── record-forms/
│       │       ├── initial-record/                # First-time medical record form
│       │       │   └── medical/
│       │       │       ├── initial-medical-record-form.jsx  # Multi-step form orchestrator
│       │       │       ├── personal-info.jsx      # Step 1: Personal information
│       │       │       ├── medical-history.jsx    # Step 2: Medical history
│       │       │       ├── medical-background.jsx # Step 3: Medical background
│       │       │       ├── dental-history.jsx     # Step 4: Dental history
│       │       │       ├── obygyne.jsx            # Step 5: OB-GYN history
│       │       │       ├── review-form.jsx        # Step 6: Review & submit
│       │       │       ├── progress-stepper.jsx   # Step progress indicator
│       │       │       ├── form-elements.jsx      # Shared form UI elements
│       │       │       └── README.md
│       │       └── update-record/                 # Record update form
│       │           ├── record-choice-page.jsx     # Choose which record to update
│       │           ├── record-update-form.jsx     # Multi-step update orchestrator
│       │           ├── personal-info-step.jsx
│       │           ├── medical-history-step.jsx
│       │           ├── dental-history-step.jsx
│       │           ├── review-step.jsx
│       │           ├── progress-stepper.jsx
│       │           ├── form-elements.jsx
│       │           ├── personal-info-service.jsx  # Personal info API service
│       │           ├── medical-history-service.jsx # Medical history API service
│       │           ├── dental-history-service.jsx # Dental history API service
│       │           ├── update-record-service.jsx  # Update record API service
│       │           └── README.md
│       │
│       ├── components/                # Shared UI components
│       │   ├── banner/
│       │   │   ├── banner.jsx         # Global notification banner
│       │   │   └── banner.module.css
│       │   ├── layout/
│       │   │   ├── layout.jsx         # Dashboard layout wrapper (sidebar + topbar + content)
│       │   │   ├── sidebar.jsx        # Navigation sidebar
│       │   │   └── top-bar.jsx        # Top navigation bar
│       │   ├── modals/
│       │   │   ├── modal.jsx          # Reusable modal wrapper
│       │   │   ├── initial-record-modal.jsx      # Initial record prompt modal
│       │   │   └── validation-warning-modal.jsx  # Form validation warning
│       │   ├── profile/
│       │   │   └── profile-modal.jsx  # User profile view/edit modal
│       │   ├── settings/
│       │   │   ├── change-password-modal.jsx     # Password change dialog
│       │   │   ├── login-activity-modal.jsx      # Device/session activity view
│       │   │   └── two-factor-auth-modal.jsx     # 2FA setup/management
│       │   ├── help-support/
│       │   │   ├── contact-support-modal.jsx
│       │   │   ├── faqs-modal.jsx
│       │   │   └── feedback-modal.jsx
│       │   └── user-menu/
│       │       └── user-menu.jsx      # User dropdown menu
│       │
│       ├── context/
│       │   ├── banner-context.jsx     # React context for banner notifications
│       │   ├── role-context.jsx       # React context for user role management
│       │   └── role-context-object.js # Role context value definitions
│       │
│       ├── hooks/
│       │   └── use-role.js            # useRole() custom hook
│       │
│       ├── services/
│       │   ├── emr-service.js         # EMR GraphQL API service layer
│       │   └── EMR_SERVICE_AUDIT.md
│       │
│       ├── utils/
│       │   ├── data-transformer.js    # EMR data transformation utilities
│       │   └── DATA_TRANSFORMER_USAGE.md
│       │
│       ├── types/
│       │   └── mdsystem__core.d.ts    # TypeScript declarations for @mdsystem/core
│       │
│       ├── styles/
│       │   └── index.css              # Global styles + Tailwind directives
│       │
│       └── assets/
│           └── MDSystem.png           # App logo
│
├── mds-staff/                         # Staff Portal — React web app (Vite + React 19)
│   ├── package.json
│   ├── .env.example                   # Environment template (VITE_DEV_PORTAL=staff, proxy to :3002)
│   ├── index.html
│   ├── vite.config.js                 # Vite config — @core alias, proxy to localhost:3002
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── eslint.config.js
│   ├── public/
│   │   └── MDSystem.png
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                    # Root component — Router, routes, BannerProvider
│       ├── packages-core-adapter.js   # Wires @mdsystem/core with browser APIs
│       │
│       ├── pages/
│       │   ├── Auth.jsx               # Authentication page
│       │   ├── Dashboard.jsx          # Staff dashboard — layout + sidebar routes
│       │   ├── PatientRecord.jsx      # Patient record viewer
│       │   ├── PendingRequests.jsx     # Pending approval requests
│       │   └── SearchPatient.jsx      # Patient search interface
│       │
│       ├── routes/
│       │   └── private-route.jsx      # Auth-guarded route (same pattern as patient)
│       │
│       ├── modules/
│       │   ├── auth/
│       │   │   ├── login.jsx
│       │   │   ├── forget-password.jsx
│       │   │   ├── resetpassword.jsx
│       │   │   ├── auth-slides.jsx
│       │   │   └── data-consent/
│       │   │       ├── data-consent.jsx
│       │   │       └── index.js
│       │   │
│       │   ├── dashboard/
│       │   │   └── dashboard-home.jsx # Staff dashboard home content
│       │   │
│       │   ├── appointment/
│       │   │   ├── staff-appointment.jsx          # Staff appointment management page
│       │   │   ├── staff-appointment-legacy.jsx   # Legacy appointment view
│       │   │   ├── staff-appointment-service.js   # Appointment API service
│       │   │   └── components/
│       │   │       ├── appointment-card.jsx
│       │   │       ├── appointment-detail-modal.jsx
│       │   │       ├── appointment-queue.jsx
│       │   │       ├── availability-calendar.jsx
│       │   │       ├── availability-manager.jsx
│       │   │       ├── day-slot-editor.jsx
│       │   │       └── event-modal.jsx
│       │   │
│       │   └── role-management/
│       │       ├── role-permissions.js            # Permission definitions
│       │       ├── pages/
│       │       │   └── RoleManagementPage.jsx     # Staff role management page
│       │       └── components/
│       │           ├── activity-log.jsx
│       │           ├── permission-matrix.jsx
│       │           ├── role-templates.jsx
│       │           ├── staff-accounts.jsx
│       │           └── staff-detail.jsx
│       │
│       ├── components/
│       │   ├── banner/
│       │   │   ├── banner.jsx
│       │   │   └── banner.module.css
│       │   ├── layout/
│       │   │   ├── StaffLayout.jsx    # Staff dashboard layout wrapper
│       │   │   ├── StaffSidebar.jsx   # Staff navigation sidebar
│       │   │   └── StaffTopBar.jsx    # Staff top navigation bar
│       │   └── modals/
│       │       ├── AppointmentDetailsModal.jsx
│       │       ├── MedicineRequestDetailsModal.jsx
│       │       └── RecordUpdateDetailsModal.jsx
│       │
│       ├── context/
│       │   ├── banner-context.jsx
│       │   ├── role-context.jsx
│       │   └── role-context-object.js
│       │
│       ├── hooks/
│       │   └── use-role.js
│       │
│       └── styles/
│           └── index.css
│
├── mds-mobile/                        # Mobile App — React Native + Expo 54
│   ├── package.json
│   ├── app.json                       # Expo app configuration
│   ├── App.tsx                        # Root component entry
│   ├── index.ts                       # App registry entry
│   ├── tsconfig.json
│   ├── babel.config.js
│   ├── metro.config.js                # Metro bundler config
│   ├── tailwind.config.js             # NativeWind (Tailwind for RN)
│   ├── postcss.config.js
│   ├── global.css                     # Global NativeWind styles
│   ├── nativewind-env.d.ts
│   ├── README.md
│   ├── .gitignore
│   ├── assets/
│   │   ├── adaptive-icon.png
│   │   ├── favicon.png
│   │   ├── icon.png
│   │   └── splash-icon.png
│   ├── .dev/                          # Development documentation
│   │   ├── MOBILE_STRUCTURE_GUIDE.md
│   │   ├── NATIVEWIND_IMPLEMENTATION.md
│   │   ├── QUICK_START.md
│   │   └── SETUP_SUMMARY.md
│   └── src/
│       ├── core.ts                    # Wires @mdsystem/core with React Native APIs (AsyncStorage)
│       ├── components/
│       │   ├── Banner.tsx             # Mobile notification banner
│       │   └── ui/
│       │       └── FormComponents.tsx # Reusable mobile form elements
│       ├── context/
│       │   ├── AuthContext.tsx         # Authentication state context
│       │   ├── BannerContext.tsx       # Banner notification context
│       │   └── ThemeContext.tsx        # Theme/dark mode context
│       └── screens/
│           ├── index.ts               # Screen barrel export
│           ├── auth/
│           │   ├── index.ts
│           │   ├── AuthScreen.tsx     # Auth navigation container
│           │   ├── LoginScreen.tsx    # Login screen
│           │   └── RegisterScreen.tsx # Registration screen
│           └── dashboard/
│               └── DashboardScreen.tsx # Main dashboard screen
│
└── docs/                              # Project-level documentation
    └── file_structure.md              # This file
```

## Architecture Overview

| Layer | Directory | Tech Stack | Purpose |
|-------|-----------|------------|---------|
| **Backend** | `Backend/` | Express 5, PostgreSQL, Redis, BullMQ, GraphQL | API server (patient on :3001, staff on :3002) |
| **Shared Core** | `packages/core/` | Vanilla JS (platform-agnostic) | Token management, API URL resolution, banner service, validation |
| **Patient Web** | `mds-patient/` | React 19, Vite 7, Tailwind CSS 3 | Patient-facing portal |
| **Staff Web** | `mds-staff/` | React 19, Vite 7, Tailwind CSS 3 | Staff/medical-facing portal |
| **Mobile** | `mds-mobile/` | React Native 0.81, Expo 54, NativeWind | Cross-platform mobile app |

## NPM Workspace Commands

```bash
npm install                  # Installs all workspaces + Backend (via postinstall)
npm run build                # Builds mds-patient and mds-staff
npm run build:patient        # Builds patient portal only
npm run build:staff          # Builds staff portal only
npm run dev:patient          # Starts patient Vite dev server
npm run dev:staff            # Starts staff Vite dev server
npm run dev:mobile           # Starts Expo dev server
npm run start:patient        # Runs Backend patient server (server.js)
npm run start:staff          # Runs Backend staff server (staff.js)
```
