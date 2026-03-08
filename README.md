# MDSystem

MDSystem is a medical data management system for the TIP ecosystem. It provides digital workflows for patients, medical staff, and doctors — covering health records, appointments, consultations, medical inventory, and document generation.

## Applications

| Application | Description |
|---|---|
| **Patient Portal** | Web portal for patients to manage their medical records, view appointments, submit medicine requests, and access e-consultation. |
| **Staff Portal** | Web portal for medical staff and doctors to handle appointments, review patient records, manage medical inventory, and oversee staff roles. |
| **Mobile App** | React Native mobile client providing patient-facing access on Android and iOS. |
| **Backend API** | Express-based REST and GraphQL API serving both portals and the mobile app. Handles authentication, EMR, inventory, media, and document services. |
| **Shared Core** | Platform-agnostic JavaScript package shared across the web portals and mobile app for token management, API communication, and validation. |

## Features

### Patient
- Account registration and authentication
- Initial and updated medical record forms
- Appointment scheduling and tracking
- Medicine request submission
- E-consultation (chatbot-assisted)
- Document downloads (medical certificates, prescriptions, referrals)

### Medical Staff / Doctor
- Patient record review and approval workflow
- Appointment queue and availability management
- Medical inventory tracking (stock, dispensing, transactions)
- Document generation with tag-based templates
- Role and permission management
- Analytics and reports

## Tech Stack

| Layer | Stack |
|---|---|
| Backend | Node.js, Express 5, PostgreSQL, Redis, GraphQL, BullMQ |
| Web Portals | React 19, Vite 7, React Router 7, Tailwind CSS 3 |
| Mobile | Expo 54, React Native 0.81, TypeScript, NativeWind |
| Document Service | Python, FastAPI, docxtpl |
| Shared Core | ESM JavaScript, Axios |

## Repository Structure

```text
MDSystem/
├── Backend/          # API server and services
├── mds-patient/      # Patient web portal
├── mds-staff/        # Staff web portal
├── mds-mobile/       # Mobile app
├── packages/core/    # Shared business logic
└── Docs/             # Project documentation
```

For the full file map, see [Docs/file_structure.md](Docs/file_structure.md).

## Documentation

- [Docs/file_structure.md](Docs/file_structure.md) — full repository structure
- [packages/core/README.md](packages/core/README.md) — shared core package
- [mds-mobile/README.md](mds-mobile/README.md) — mobile app notes

## License

This repository is proprietary software. See [LICENSE](LICENSE) for the applicable terms.
