# MDSystem file structure

This map covers the main maintained application areas. It omits generated output, dependency directories, test fixtures, and most individual feature files. See [the documentation index](README.md) for feature guides.

```text
MDSystem/
├── Backend/
│   ├── server.js                 # Patient portal server
│   ├── staff.js                  # Staff portal server
│   ├── config/                   # PostgreSQL, Redis, middleware, sockets, SQL setup
│   ├── routes/                   # REST and GraphQL route modules
│   ├── services/
│   │   ├── analytics/            # Analytics queries and exports
│   │   ├── auth/                 # OAuth and reCAPTCHA verification
│   │   ├── authorization/       # Permission checks
│   │   ├── doc-generate-module/  # Document templates and generation
│   │   ├── email/                # Email queue producer and worker
│   │   ├── notifications/        # Staff and patient notification services
│   │   └── rendering/            # Charts and PDF utilities
│   ├── utils/                    # Shared backend helpers
│   └── test-support/             # Jest test inventory and fixtures
├── Docs/                         # Developer, operator, and feature documentation
│   ├── archive/                  # Historical implementation and verification reports
│   └── Documentation/            # Academic project report, maintained separately
├── mds-patient/                  # Patient web portal (React/Vite)
├── mds-staff/                    # Staff web portal (React/Vite)
├── mds-mobile/                   # Patient mobile app (Expo/React Native)
├── packages/core/                # Shared cross-platform package
├── compose.yaml                  # Local/container deployment topology
├── Dockerfile                    # Application image definition
├── startup.sql                   # First-admin initialization SQL
└── README.md                     # Repository overview
```

## Runtime processes

- `Backend/server.js` serves the patient portal and its APIs.
- `Backend/staff.js` serves the staff portal and its APIs.
- `Backend/services/email/emailworker.js` runs the BullMQ email worker.
- PostgreSQL and Redis are separate services in the Docker Compose stack.

The organized service directories are imported directly by routes and configuration code. Keep service tests beside their implementation. For local setup and operational commands, use [Docker deployment](DOCKER.md); for test commands, use [Backend testing](TESTING.md).
