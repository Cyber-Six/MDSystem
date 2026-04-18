# MDSystem Mobile

MDSystem Mobile is the Expo React Native client for patient workflows in the MDSystem platform.

This README is intentionally mobile-scope only.

## Tech Stack

- Expo 54
- React Native 0.81
- React 19
- TypeScript
- React Navigation (drawer, tabs, stack)
- AsyncStorage (auth token persistence)
- Expo Notifications
- Socket.IO client
- NativeWind + Tailwind theme tokens

## Core Mobile Capabilities

- Authentication flow with token-backed session state
- Drawer + tab navigation with route gating based on record status
- Initial medical record and update-record workflows
- Appointment, medicine request, health chat, announcements, profile, settings, and documents screens
- Mobile GraphQL service layer for EMR and related modules
- Banner and notification providers integrated across the app

## Prerequisites

- Node.js 18+
- npm
- Expo CLI (via `npx expo` / package script)
- Android Studio emulator or physical device with Expo Go
- Backend API accessible from your device/emulator

## Installation

From this folder:

```bash
npm install
```

Because `@mdsystem/core` is linked from `../packages/core`, ensure repository dependencies are installed as well:

```bash
cd ..
npm install
cd mds-mobile
```

## Environment Configuration

Set values in `mds-mobile/.env` (or your environment profile):

| Key | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Yes | Absolute backend base URL used by mobile API calls. |
| `EXPO_PUBLIC_APP_ENV` | No | App environment label (for display/config). |
| `EXPO_PUBLIC_APP_VERSION` | No | Version label shown in UI surfaces. |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Optional | Google login configuration. |
| `EXPO_PUBLIC_RECAPTCHA_MOBILE_SECRET` | Optional | Mobile recaptcha token value used by auth flows. |

Notes:

- Mobile uses absolute backend URLs (no Vite proxy layer).
- `src/core.ts` reads `EXPO_PUBLIC_API_URL` and defaults to `https://www.mdsystemtip.space`.

## Available Scripts

Run from `mds-mobile/`:

| Command | Description |
| --- | --- |
| `npm start` | Start Expo dev server. |
| `npm run start:clear` | Start Expo with cleared cache. |
| `npm run android` | Build/run Android native app. |
| `npm run android:clear` | Start Expo Android with cache clear. |
| `npm run ios` | Build/run iOS native app. |
| `npm run ios:clear` | Start Expo iOS with cache clear. |
| `npm run web` | Run Expo web target. |
| `npm test` | Run Jest tests. |
| `npm run test:watch` | Jest in watch mode. |
| `npm run test:coverage` | Jest with coverage output. |

## Project Structure

```text
mds-mobile/
|-- App.tsx
|-- app.config.js
|-- src/
|   |-- components/
|   |-- context/
|   |-- hooks/
|   |-- navigation/
|   |-- screens/
|   |-- services/
|   `-- core.ts
|-- assets/
|-- jest.setup.ts
`-- tailwind.config.js
```

## Navigation Model

- `AppDrawerNavigator` provides drawer-level shell navigation.
- `MainTabNavigator` hosts main tabs:
  - Update Record
  - Appointments
  - Health Chat
  - Medicine
  - More
- Access to several tabs is gated while initial record completion is pending.

## Data + Service Layer

- `src/core.ts` wires `@mdsystem/core` factories for token handling and axios interceptors.
- `src/services/graphql-client.ts` wraps GraphQL requests.
- `src/services/emr-service.ts` handles catalogs, record submission, ticket status, and revision prefill flows.
- Additional services under `src/services/` support appointments, profile, documents, notifications, announcements, medicine, and health chat.

## Testing

- Jest preset: `jest-expo`
- Test bootstrap: `jest.setup.ts`
- Coverage target includes `src/**/*.{ts,tsx}`

## Troubleshooting

### API calls fail on device

- Verify `EXPO_PUBLIC_API_URL` is reachable from the device/emulator network.
- Check backend CORS and host configuration.

### Stale Metro build output

```bash
npm run start:clear
```

### Module resolution issues for `@mdsystem/core`

- Re-run installs at repo root and in `mds-mobile/`.

## License

See the repository root [LICENSE](../LICENSE).
