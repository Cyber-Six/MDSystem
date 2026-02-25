# MDSystem Mobile

React Native mobile application built with Expo, TypeScript, and NativeWind (Tailwind CSS for React Native).

## Features

- **Shared Business Logic**: Uses `@mdsystem/core` package for platform-agnostic business logic shared with the web app
- **NativeWind/Tailwind CSS**: Shares the same Tailwind configuration with the web app for consistent design system
- **TypeScript**: Full type safety across the mobile app
- **Token-based Authentication**: AsyncStorage-based token management
- **Banner Notifications**: Global banner system for user feedback
- **Validation**: Email and password validation shared with web

## Tech Stack

- **React Native 0.81.5** - Mobile framework
- **Expo ~54.0.30** - Development platform
- **TypeScript 5.9.2** - Type safety
- **NativeWind** - Tailwind CSS for React Native (via `className` prop)
- **AsyncStorage** - Token storage for React Native
- **Axios** - HTTP client
- **@mdsystem/core** - Shared business logic package

## Setup

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Expo CLI (installed automatically)
- Expo Go app on your phone (for testing)

### Installation

```bash
# Navigate to the mobile directory
cd mds-mobile

# Install dependencies
npm install

# Link the core package (from workspace root)
cd ..
npm install

# Navigate back to mobile
cd mds-mobile
```

### Configuration

The app uses the shared Tailwind configuration from the web app:

```js
// tailwind.config.js
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require('../mds-patient/tailwind.config.js')],
};
```

This provides access to all the custom colors, spacing, and styles from the web app:
- `bg-primary-500` - TIP Yellow (#F1C526)
- `bg-secondary-900` - Dark Gray
- `bg-accent-500` - Blue accent color
- `bg-success-*`, `bg-error-*`, `bg-warning-*` - Status colors

### Running the App

```bash
# Start the development server
npm start

# Run on iOS simulator (macOS only)
npm run ios

# Run on Android emulator
npm run android

# Run on web (development)
npm run web
```

Scan the QR code with:
- **iOS**: Camera app
- **Android**: Expo Go app

## Project Structure

```
mds-mobile/
├── App.tsx                     # Main app entry point with NativeWind
├── src/
│   ├── core.js                 # Core package adapters for React Native
│   ├── components/
│   │   └── Banner.tsx          # Banner component with NativeWind classes
│   ├── screens/               # App screens (to be added)
│   ├── navigation/            # Navigation setup (to be added)
│   └── services/              # React Native-specific services
├── babel.config.js            # Babel config with NativeWind plugin
├── tailwind.config.js         # Tailwind config (shares web config)
├── nativewind-env.d.ts        # TypeScript declarations for NativeWind
└── tsconfig.json              # TypeScript configuration
```

## Using NativeWind

NativeWind allows you to use Tailwind CSS classes via the `className` prop:

```tsx
// Instead of StyleSheet
<View className="flex-1 bg-neutral-50 px-4">
  <Text className="text-2xl font-bold text-secondary-900">
    Hello World
  </Text>
  
  <TouchableOpacity className="bg-accent-500 py-3 px-4 rounded-lg">
    <Text className="text-white text-center font-semibold">
      Press Me
    </Text>
  </TouchableOpacity>
</View>
```

All Tailwind classes from the web configuration work identically in React Native!

## Core Features

### Token Storage

```tsx
import { TokenStorage } from './src/core';

// Store tokens
await TokenStorage.storeTokens({
  accessToken: 'token',
  refreshToken: 'refresh',
  expiresIn: 3600
});

// Retrieve tokens
const token = await TokenStorage.getAccessToken();

// Clear tokens
await TokenStorage.clearTokens();
```

### Banner Notifications

```tsx
import { bannerService } from './src/core';

// Show a banner
bannerService.showBanner({
  type: 'success',
  message: 'Operation successful!'
});

// Subscribe to banner updates
useEffect(() => {
  const unsubscribe = bannerService.subscribe(setBanners);
  return () => unsubscribe();
}, []);
```

### API Requests

```tsx
import { axiosRequest } from './src/core';

// Make authenticated requests
const response = await axiosRequest.get('/api/endpoint');
const data = await axiosRequest.post('/api/endpoint', { data });
```

### Validation

```tsx
import { validatePassword } from '@mdsystem/core/validation/password-validation';
import { isValidTipEmail } from '@mdsystem/core/validation/email-validation';

const isValid = validatePassword('MyPassword123');
const isValidEmail = isValidTipEmail('student@tip.edu.ph');
```

## Styling with Shared Tailwind Config

The mobile app shares the exact same Tailwind configuration as the web app. This means:

- **Same colors**: `bg-primary-500`, `text-accent-600`, etc.
- **Same spacing**: `p-4`, `mx-2`, `gap-3`, etc.
- **Same typography**: `text-lg`, `font-bold`, `leading-relaxed`, etc.
- **Same design tokens**: Consistent look and feel across platforms

## Development Tips

1. **Hot Reload**: Shake your device to open the developer menu
2. **Debugging**: Press `j` in the terminal to open Chrome DevTools
3. **TypeScript**: Run `npm run type-check` to check types without building
4. **NativeWind**: Changes to Tailwind classes reload instantly with Fast Refresh

## Building for Production

```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Build for both
eas build --platform all
```

(Requires EAS CLI setup - see [Expo docs](https://docs.expo.dev/build/setup/))

## Troubleshooting

### "Module not found: @mdsystem/core"

Make sure you've installed dependencies from the workspace root:
```bash
cd ..
npm install
cd mds-mobile
```

### NativeWind classes not working

1. Clear cache: `npm start -- --clear`
2. Verify `babel.config.js` has `nativewind/babel` plugin
3. Check that `nativewind-env.d.ts` exists

### TypeScript errors

Run `npm install --save-dev @types/react @types/react-native` to install type definitions.

## License

See LICENSE file in the workspace root.

## Learn More

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Expo Documentation](https://docs.expo.dev/)
- [NativeWind Documentation](https://www.nativewind.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
