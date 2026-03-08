# MDSystem — File Structure

> Reviewed against the current repository. This map excludes `node_modules/`, `dist/`, `.git/`, and `package-lock.json`.

```text
MDSystem/
├── package.json                      # Root npm workspace manifest
├── .gitignore
├── LICENSE
├── README.md
├── Docs/
│   ├── file_structure.md            # This file
│   └── PENDING_REVIEW_IMPLEMENTATION.md
│
├── Backend/                         # Node.js / Express backend (installed via root postinstall)
│   ├── package.json                 # Main entry: server.js
│   ├── server.js                    # Patient-facing backend runtime
│   ├── staff.js                     # Staff-facing backend runtime
│   │
│   ├── commands/                    # Empty placeholder directory
│   │
│   ├── config/
│   │   ├── config.js                # Loads .env-backed DB, JWT, Redis, SMTP config
│   │   ├── db.js                    # PostgreSQL pool setup
│   │   ├── jwt.js                   # JWT helpers
│   │   ├── redis.js                 # Redis client helpers
│   │   ├── multer.js                # Upload middleware config
│   │   ├── query.js                 # Shared DB query helpers
│   │   ├── data/
│   │   │   ├── data.js
│   │   │   ├── matrix.js
│   │   │   └── post_build_setup.sql
│   │   ├── icdapi/
│   │   │   ├── icdapi.js
│   │   │   ├── icddb.js
│   │   │   ├── icdmain.js
│   │   │   └── tokenauth.js
│   │   └── middleware/
│   │       ├── activeCredential.js
│   │       ├── chatbotProxy.js
│   │       ├── jwtProtect.js
│   │       └── ratelimiter.js
│   │
│   ├── routes/
│   │   ├── appointment/
│   │   │   ├── graphql.js
│   │   │   ├── schema.graphql
│   │   │   └── resolvers/
│   │   │       ├── medical/
│   │   │       │   └── medical-resolver.js
│   │   │       ├── patient/
│   │   │       │   └── patient-resolver.js
│   │   │       └── wrapper/
│   │   │           ├── helper.js
│   │   │           └── wrapper.js
│   │   │
│   │   ├── auth/
│   │   │   ├── email/
│   │   │   │   ├── emailauth.js
│   │   │   │   └── emailpassword-reset.js
│   │   │   ├── jwt/
│   │   │   │   └── refresh.js
│   │   │   └── user/
│   │   │       ├── login.js
│   │   │       ├── register.js
│   │   │       └── user-password.js
│   │   │
│   │   ├── consultation/
│   │   │   └── consult/
│   │   │       ├── graphql.js
│   │   │       ├── schema.graphql
│   │   │       └── resolvers/
│   │   │           ├── medical/
│   │   │           │   └── medical-resolver.js
│   │   │           └── wrapper/
│   │   │               ├── helper.js
│   │   │               └── wrapper.js
│   │   │
│   │   ├── emr/
│   │   │   ├── graphql.js
│   │   │   ├── patient-resolverquery.js
│   │   │   ├── schema.graphql
│   │   │   ├── query/
│   │   │   │   ├── anchor.js
│   │   │   │   ├── delete.js
│   │   │   │   └── upsert.js
│   │   │   ├── resolvers/
│   │   │   │   ├── record-validator.js
│   │   │   │   ├── medical/
│   │   │   │   │   ├── helper.js
│   │   │   │   │   ├── medical-resolver.js
│   │   │   │   │   ├── mutation.js
│   │   │   │   │   └── query.js
│   │   │   │   └── patient/
│   │   │   │       ├── helper.js
│   │   │   │       ├── mutation.js
│   │   │   │       ├── patient-resolver.js
│   │   │   │       └── query.js
│   │   │   └── wrapper/
│   │   │       ├── mutation.js
│   │   │       └── query.js
│   │   │
│   │   ├── info/
│   │   │   ├── announcement/
│   │   │   │   └── announcement.js
│   │   │   └── compliance/
│   │   │       ├── consent.js
│   │   │       └── consents/
│   │   │           └── v1.0.html
│   │   │
│   │   ├── media/
│   │   │   └── media.js
│   │   │
│   │   ├── medical-inventory/
│   │   │   ├── graphql.js
│   │   │   ├── schema.graphql
│   │   │   ├── resolvers/
│   │   │   │   ├── medical/
│   │   │   │   │   └── medical-resolver.js
│   │   │   │   ├── patient/
│   │   │   │   │   └── patient-resolver.js
│   │   │   │   └── wrapper/
│   │   │   │       ├── helper.js
│   │   │   │       └── wrapper.js
│   │   │   ├── medicine-request/
│   │   │   │   ├── graphql.js
│   │   │   │   ├── schema.graphql
│   │   │   │   └── resolvers/
│   │   │   │       ├── medical/
│   │   │   │       │   └── medical-resolver.js
│   │   │   │       ├── patient/
│   │   │   │       │   └── patient-resolver.js
│   │   │   │       └── wrapper/
│   │   │   │           ├── helper.js
│   │   │   │           └── wrapper.js
│   │   │   └── prescription/
│   │   │       ├── graphql.js
│   │   │       ├── schema.graphql
│   │   │       └── resolvers/
│   │   │           ├── medical/
│   │   │           │   └── medical-resolver.js
│   │   │           ├── patient/
│   │   │           │   └── patient-resolver.js
│   │   │           └── wrapper/
│   │   │               ├── helper.js
│   │   │               └── wrapper.js
│   │   │
│   │   ├── profile/
│   │   │   ├── graphql.js
│   │   │   ├── schema.graphql
│   │   │   └── resolvers/
│   │   │       ├── medical/
│   │   │       │   └── medical-resolver.js
│   │   │       ├── patient/
│   │   │       │   └── patient-resolver.js
│   │   │       └── wrapper/
│   │   │           └── wrapper.js
│   │   │
│   │   └── staff/
│   │       ├── .txt                 # Placeholder file
│   │       └── staff.js
│   │
│   ├── services/
│   │   ├── docx-generation/
│   │   │   ├── data.py
│   │   │   ├── main.py
│   │   │   ├── requirement.txt
│   │   │   ├── requirements.txt
│   │   │   ├── script.js
│   │   │   ├── styles.css
│   │   │   └── template.html
│   │   ├── emailservice.js          # BullMQ email job producer
│   │   ├── emailworker.js           # BullMQ email worker
│   │   ├── permit.js                # Staff permission checks
│   │   └── recaptcha.js             # Google reCAPTCHA validation
│   │
│   └── utils/
│       ├── authSession.js
│       ├── const.js
│       ├── converter.js
│       ├── graphql-helper.js
│       ├── logger.js
│       ├── portal.js
│       ├── security.js
│       ├── validator.js
│       └── schema/
│           └── emr/
│               └── emr.graphql
│
├── mds-patient/                     # React 19 + Vite patient portal
│   ├── package.json
│   ├── .env.example                 # Local dev portal and bypass configuration
│   ├── index.html
│   ├── vite.config.js               # Proxy target derived from VITE_DEV_PORTAL / VITE_BACKEND_URL
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── eslint.config.js
│   ├── scripts/
│   │   └── setup-env.js             # Syncs .env from .env.example before dev/build
│   ├── public/
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── packages-core-adapter.js # Browser adapter for @mdsystem/core
│       ├── assets/
│       ├── components/
│       │   ├── banner/
│       │   │   ├── banner.jsx
│       │   │   └── banner.module.css
│       │   ├── error-boundary.jsx
│       │   ├── help-support/
│       │   │   ├── contact-support-modal.jsx
│       │   │   ├── faqs-modal.jsx
│       │   │   └── feedback-modal.jsx
│       │   ├── layout/
│       │   │   ├── layout.jsx
│       │   │   ├── sidebar.jsx
│       │   │   └── top-bar.jsx
│       │   ├── modals/
│       │   │   ├── initial-record-modal.jsx
│       │   │   ├── modal.jsx
│       │   │   └── validation-warning-modal.jsx
│       │   ├── profile/
│       │   │   └── profile-modal.jsx
│       │   ├── settings/
│       │   │   ├── change-password-modal.jsx
│       │   │   ├── login-activity-modal.jsx
│       │   │   └── two-factor-auth-modal.jsx
│       │   └── user-menu/
│       │       └── user-menu.jsx
│       ├── context/
│       │   └── banner-context.jsx
│       ├── modules/
│       │   ├── appointment/
│       │   │   ├── appointment.jsx
│       │   │   └── patient-appointment-service.js
│       │   ├── auth/
│       │   │   ├── auth-slides.jsx
│       │   │   ├── data-consent/
│       │   │   │   ├── data-consent.jsx
│       │   │   │   └── index.js
│       │   │   ├── forget-password.jsx
│       │   │   ├── login.jsx
│       │   │   ├── register.jsx
│       │   │   └── resetpassword.jsx
│       │   ├── dashboard/
│       │   │   └── dashboard-home.jsx
│       │   ├── e-consultation/
│       │   │   ├── e-consultation.jsx
│       │   │   └── components/
│       │   │       ├── ChatBox.jsx
│       │   │       ├── EmptyState.jsx
│       │   │       ├── GuidelinesCard.jsx
│       │   │       ├── LoadingIndicator.jsx
│       │   │       └── MessageBubble.jsx
│       │   ├── medicine-request/
│       │   │   └── medicine-request-page.jsx
│       │   └── record-forms/
│       │       ├── initial-record/
│       │       │   ├── README.md
│       │       │   └── medical/
│       │       │       ├── README.md
│       │       │       ├── dental-history.jsx
│       │       │       ├── form-elements.jsx
│       │       │       ├── initial-medical-record-form.jsx
│       │       │       ├── medical-background.jsx
│       │       │       ├── medical-history.jsx
│       │       │       ├── obygyne.jsx
│       │       │       ├── personal-info.jsx
│       │       │       ├── progress-stepper.jsx
│       │       │       └── review-form.jsx
│       │       └── update-record/
│       │           ├── README.md
│       │           ├── dental-history-service.jsx
│       │           ├── dental-history-step.jsx
│       │           ├── form-elements.jsx
│       │           ├── medical-history-service.jsx
│       │           ├── medical-history-step.jsx
│       │           ├── personal-info-service.jsx
│       │           ├── personal-info-step.jsx
│       │           ├── progress-stepper.jsx
│       │           ├── record-choice-page.jsx
│       │           ├── record-update-form.jsx
│       │           ├── review-step.jsx
│       │           └── update-record-service.jsx
│       ├── pages/
│       │   ├── Auth.jsx
│       │   └── Dashboard.jsx
│       ├── routes/
│       │   └── private-route.jsx
│       ├── services/
│       │   ├── EMR_SERVICE_AUDIT.md
│       │   └── emr-service.js
│       ├── styles/
│       ├── types/
│       └── utils/
│           ├── DATA_TRANSFORMER_USAGE.md
│           ├── data-transformer.js
│           └── graphql-client.js
│
├── mds-staff/                       # React 19 + Vite staff portal
│   ├── package.json
│   ├── .env.example                 # Local dev portal and bypass configuration
│   ├── index.html
│   ├── vite.config.js               # Proxy target derived from VITE_DEV_PORTAL / VITE_BACKEND_URL
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── eslint.config.js
│   ├── scripts/
│   │   └── setup-env.js             # Syncs .env from .env.example before dev/build
│   ├── public/
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── packages-core-adapter.js # Browser adapter for @mdsystem/core
│       ├── assets/
│       ├── components/
│       │   ├── banner/
│       │   │   ├── banner.jsx
│       │   │   └── banner.module.css
│       │   ├── error-boundary.jsx
│       │   ├── layout/
│       │   │   ├── StaffLayout.jsx
│       │   │   ├── StaffSidebar.jsx
│       │   │   └── StaffTopBar.jsx
│       │   ├── modals/
│       │   │   ├── AppointmentDetailsModal.jsx
│       │   │   ├── MedicineRequestDetailsModal.jsx
│       │   │   └── RecordUpdateDetailsModal.jsx
│       │   └── ui/
│       │       └── ActionButton.jsx
│       ├── context/
│       │   └── banner-context.jsx
│       ├── modules/
│       │   ├── appointment/
│       │   │   ├── staff-appointment.jsx
│       │   │   ├── staff-appointment-service.js
│       │   │   └── components/
│       │   │       ├── appointment-card.jsx
│       │   │       ├── appointment-detail-modal.jsx
│       │   │       ├── appointment-queue.jsx
│       │   │       ├── availability-calendar.jsx
│       │   │       ├── availability-manager.jsx
│       │   │       ├── day-slot-editor.jsx
│       │   │       └── event-modal.jsx
│       │   ├── auth/
│       │   │   ├── auth-slides.jsx
│       │   │   ├── data-consent/
│       │   │   │   ├── data-consent.jsx
│       │   │   │   └── index.js
│       │   │   ├── forget-password.jsx
│       │   │   ├── login.jsx
│       │   │   └── resetpassword.jsx
│       │   ├── dashboard/
│       │   │   └── dashboard-home.jsx
│       │   ├── medical-inventory/
│       │   │   ├── medical-inventory.jsx
│       │   │   ├── inventory-seed-data.js
│       │   │   └── components/
│       │   │       ├── add-supply/
│       │   │       │   └── add-supply-modal.jsx
│       │   │       ├── adjust-stock/
│       │   │       │   └── adjust-stock-modal.jsx
│       │   │       ├── dispense-queue/
│       │   │       │   ├── dispense-modal.jsx
│       │   │       │   └── dispense-queue.jsx
│       │   │       ├── inventory-dashboard/
│       │   │       │   └── inventory-dashboard.jsx
│       │   │       ├── medical-item/
│       │   │       │   ├── add-item-modal.jsx
│       │   │       │   ├── medical-item-detail.jsx
│       │   │       │   └── medical-item-list.jsx
│       │   │       ├── split-supply/
│       │   │       │   └── split-supply-modal.jsx
│       │   │       └── transaction-history/
│       │   │           └── transaction-history.jsx
│       │   ├── pending-requests/
│       │   │   ├── initial-record-service.js
│       │   │   ├── patient-record-service.js
│       │   │   └── components/
│       │   │       ├── initial-record-detail-modal.jsx
│       │   │       ├── initial-record-list.jsx
│       │   │       ├── record-review-modal.jsx
│       │   │       └── review-sections/
│       │   │           ├── DentalHistorySection.jsx
│       │   │           ├── EmergencyContactSection.jsx
│       │   │           ├── MedicalBackgroundSection.jsx
│       │   │           ├── MedicalHistorySection.jsx
│       │   │           ├── ObGyneSection.jsx
│       │   │           ├── PersonalInfoSection.jsx
│       │   │           ├── SectionWrapper.jsx
│       │   │           └── index.js
│       │   └── role-management/
│       │       ├── role-permissions.js
│       │       ├── components/
│       │       │   ├── activity-log.jsx
│       │       │   ├── permission-matrix.jsx
│       │       │   ├── role-templates.jsx
│       │       │   ├── staff-accounts.jsx
│       │       │   └── staff-detail.jsx
│       │       └── pages/
│       │           └── RoleManagementPage.jsx
│       ├── pages/
│       │   ├── Auth.jsx
│       │   ├── Dashboard.jsx
│       │   ├── PatientRecord.jsx
│       │   ├── PendingRequests.jsx
│       │   └── SearchPatient.jsx
│       ├── routes/
│       │   └── private-route.jsx
│       └── styles/
│
├── mds-mobile/                      # Expo + React Native mobile app
│   ├── package.json
│   ├── app.json
│   ├── App.tsx
│   ├── index.ts
│   ├── babel.config.js
│   ├── metro.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── nativewind-env.d.ts
│   ├── global.css
│   ├── .gitignore
│   ├── README.md
│   ├── assets/
│   └── src/
│       ├── core.ts                  # React Native adapter for @mdsystem/core
│       ├── components/
│       │   ├── Banner.tsx
│       │   └── ui/
│       │       └── FormComponents.tsx
│       ├── context/
│       │   ├── AuthContext.tsx
│       │   ├── BannerContext.tsx
│       │   └── ThemeContext.tsx
│       └── screens/
│           ├── index.ts
│           ├── auth/
│           │   ├── AuthScreen.tsx
│           │   ├── LoginScreen.tsx
│           │   ├── RegisterScreen.tsx
│           │   └── index.ts
│           └── dashboard/
│               └── DashboardScreen.tsx
│
└── packages/
    └── core/                        # Shared platform-agnostic business logic
        ├── package.json
        ├── README.md
        ├── LICENSE
        └── src/
            ├── index.js
            ├── config/
            │   └── banner-config.js
            ├── scripts/
            │   └── fetch-sheets-config.js
            ├── services/
            │   ├── api-base-url-provider.js
            │   ├── axios-request-handler.js
            │   ├── banner-service.js
            │   ├── console-request-logger.js
            │   └── token-service.js
            ├── utils/
            │   └── role-detection.js
            └── validation/
                ├── email-validation.js
                ├── password-validation.js
                ├── user-constants.js
                └── VALIDATION_UTILITIES.md
```

## Architecture Overview

| Layer | Directory | Stack | Purpose |
|---|---|---|---|
| Backend | `Backend/` | Express 5, PostgreSQL, Redis, GraphQL, BullMQ | API server and background services |
| Patient Web | `mds-patient/` | React 19, Vite 7, Tailwind CSS 3 | Patient-facing portal |
| Staff Web | `mds-staff/` | React 19, Vite 7, Tailwind CSS 3 | Staff and medical workflows |
| Mobile | `mds-mobile/` | Expo 54, React Native 0.81, NativeWind, TypeScript | Mobile client |
| Shared Core | `packages/core/` | ESM JavaScript, Axios | Cross-platform token, API, banner, validation logic |

## Workspace Commands

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

## Notes

- The root workspace installs the backend through `postinstall`, but `Backend/` is not itself an npm workspace package.
- The backend configuration is sourced from `Backend/.env` through `Backend/config/config.js`.
- No `Backend/.env.example` is tracked in the repository; create `Backend/.env` manually.
- `Backend/commands/` is an empty placeholder directory.
- `Backend/routes/staff/` contains a placeholder `.txt` file alongside `staff.js`.
- The repository includes `config/middleware/chatbotProxy.js`, but no checked-in `Backend/MDS-AI-Chatbot/` service directory exists.
