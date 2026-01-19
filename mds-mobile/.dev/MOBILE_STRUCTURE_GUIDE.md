# Mobile App Structure Guide

## ✅ Yes, This is Real React Native!

Both `mds-mobile` (JavaScript) and `mds-mobile-ts` (TypeScript) are **real React Native** apps using Expo. They use JSX/TSX with React Native components:

```jsx
// React Native components (not HTML)
import { View, Text, ScrollView, Button } from 'react-native';

// JSX is used for React Native components
<View style={styles.container}>
  <Text>This is React Native!</Text>
</View>
```

**Key Differences from React Web:**
- `<View>` instead of `<div>`
- `<Text>` instead of `<span>` or `<p>`
- `<ScrollView>` instead of CSS overflow
- `StyleSheet.create()` instead of CSS files
- TouchableOpacity/Pressable instead of buttons

## 📁 Folder Structure Comparison

### React Frontend (Web) vs React Native (Mobile)

| Web (mds-frontend) | Mobile (mds-mobile) | Purpose |
|-------------------|---------------------|---------|
| `src/pages/` | `src/screens/` | Page/Screen components |
| `src/routes/` | `src/navigation/` | Routing (React Router vs React Navigation) |
| `src/components/` | `src/components/` | Reusable UI components |
| `src/context/` | `src/context/` | React Context providers |
| `src/hooks/` | `src/hooks/` | Custom hooks |
| `src/modules/` | `src/screens/` | Feature modules |
| `src/styles/` | `src/styles/` | Styling (CSS vs StyleSheet) |
| `src/services/` | ❌ Removed | (Now using `src/core.js`) |
| `src/core.js` | `src/core.js` | Core package adapter |

### Created Folder Structure for mds-mobile

```
mds-mobile/
├── src/
│   ├── core.js                    ✅ Platform adapter
│   ├── screens/                   ✅ Created
│   │   ├── auth/                 ✅ Created (for Login, Register, etc.)
│   │   └── dashboard/            ✅ Created (for Dashboard screens)
│   ├── navigation/                ✅ Created (for React Navigation)
│   ├── components/                ✅ Created
│   │   └── Banner.jsx            ✅ Created
│   ├── context/                   ✅ Created
│   │   └── BannerContext.jsx     ✅ Created
│   ├── hooks/                     ✅ Created (for custom hooks)
│   ├── styles/                    ✅ Created (for shared styles)
│   └── utils/                     ✅ Created (for utility functions)
├── App.js                         ✅ Main demo app
├── package.json
└── README.md
```

### Created Folder Structure for mds-mobile-ts (TypeScript)

```
mds-mobile-ts/
├── src/
│   ├── core.ts                    ✅ TypeScript version
│   ├── screens/                   ✅ Created
│   │   ├── auth/                 ✅ Created
│   │   └── dashboard/            ✅ Created
│   ├── navigation/                ✅ Created
│   ├── components/                ✅ Created
│   │   └── Banner.tsx            ✅ TypeScript component
│   ├── context/                   ✅ Created
│   │   └── BannerContext.tsx     ✅ TypeScript context
│   ├── hooks/                     ✅ Created
│   ├── styles/                    ✅ Created
│   └── utils/                     ✅ Created
├── App.tsx                        ✅ TypeScript main app
├── tsconfig.json                  ✅ TypeScript config
├── package.json
└── README.md
```

## 📋 What Folders to Create Based on Web Frontend

### Priority 1: Essential Screens

#### Authentication Screens
```
src/screens/auth/
├── LoginScreen.jsx          # Port from modules/auth/login.jsx
├── RegisterScreen.jsx       # Port from modules/auth/register.jsx
├── ForgotPasswordScreen.jsx # Port from modules/auth/forget-password.jsx
└── VerifyOTPScreen.jsx      # OTP verification
```

#### Dashboard Screens
```
src/screens/dashboard/
├── DashboardHomeScreen.jsx  # Port from modules/dashboard/dashboard-home.jsx
├── ProfileScreen.jsx        # User profile
└── SettingsScreen.jsx       # App settings
```

### Priority 2: Feature Screens

#### Appointment
```
src/screens/appointment/
└── AppointmentScreen.jsx    # Port from modules/appointment/appointment-page.jsx
```

#### Medicine Request
```
src/screens/medicine/
└── MedicineRequestScreen.jsx # Port from modules/medicine-request/
```

#### Medical Records
```
src/screens/records/
├── MedicalHistoryScreen.jsx
├── PersonalInfoScreen.jsx
└── RecordFormScreen.jsx
```

### Priority 3: Reusable Components

```
src/components/
├── Banner.jsx               ✅ Created
├── Modal.jsx               # Port from components/modals/modal.jsx
├── Button.jsx              # Custom button component
├── Input.jsx               # Custom input component
├── Card.jsx                # Card component
└── LoadingSpinner.jsx      # Loading indicator
```

### Priority 4: Navigation

```
src/navigation/
├── AppNavigator.jsx        # Main navigation stack
├── AuthNavigator.jsx       # Authentication flow
├── MainNavigator.jsx       # Authenticated user navigation
└── types.ts                # Navigation type definitions (for TS)
```

### Priority 5: Context Providers

```
src/context/
├── BannerContext.jsx       ✅ Created
├── AuthContext.jsx         # Authentication state
└── ThemeContext.jsx        # Dark/Light mode
```

### Priority 6: Custom Hooks

```
src/hooks/
├── useAuth.js              # Authentication hook
├── useBanner.js            # Banner hook
├── useRole.js              # Port from hooks/use-role.js
└── useForm.js              # Form handling hook
```

## 🎯 Key Differences: Web vs Mobile

### 1. Styling

**Web (CSS):**
```css
.container {
  display: flex;
  flex-direction: column;
  padding: 20px;
}
```

**Mobile (StyleSheet):**
```javascript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    padding: 20,
  }
});
```

### 2. Navigation

**Web (React Router):**
```javascript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
navigate('/dashboard');
```

**Mobile (React Navigation):**
```javascript
import { useNavigation } from '@react-navigation/native';

const navigation = useNavigation();
navigation.navigate('Dashboard');
```

### 3. Forms

**Web:**
```jsx
<input 
  type="text" 
  value={value} 
  onChange={(e) => setValue(e.target.value)} 
/>
```

**Mobile:**
```jsx
<TextInput
  value={value}
  onChangeText={setValue}
  style={styles.input}
/>
```

### 4. Buttons

**Web:**
```jsx
<button onClick={handleClick}>Click Me</button>
```

**Mobile:**
```jsx
<Button title="Click Me" onPress={handleClick} />
// Or custom:
<TouchableOpacity onPress={handleClick}>
  <Text>Click Me</Text>
</TouchableOpacity>
```

### 5. Scrolling

**Web:**
```jsx
<div style={{ overflow: 'auto' }}>
  {content}
</div>
```

**Mobile:**
```jsx
<ScrollView>
  {content}
</ScrollView>
```

## 📱 JavaScript vs TypeScript Mobile Apps

### mds-mobile (JavaScript)
- ✅ Faster to write
- ✅ Less boilerplate
- ✅ Good for prototyping
- ❌ No compile-time type checking
- ❌ Less IDE autocomplete

### mds-mobile-ts (TypeScript)
- ✅ Type safety
- ✅ Better IDE support
- ✅ Catches errors before runtime
- ✅ Better refactoring support
- ❌ More verbose
- ❌ Learning curve

**Example Comparison:**

**JavaScript:**
```javascript
// src/core.js
export const tokenService = createTokenService({ ... });
```

**TypeScript:**
```typescript
// src/core.ts
import type { AxiosInstance } from 'axios';

export const axiosRequest: AxiosInstance = createAxiosRequestHandler({ ... });
```

## 🚀 Next Steps for Development

### 1. Set Up Navigation (Both Apps)
```bash
npm install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context
```

### 2. Create LoginScreen
```jsx
// src/screens/auth/LoginScreen.jsx
import { axiosRequest, TokenStorage } from '../../core';
import { validatePassword } from '@mdsystem/core/validation/password-validation';
import { isValidTipEmail } from '@mdsystem/core/validation/email-validation';
```

### 3. Add Banner Component to App
```jsx
import { BannerProvider } from './src/context/BannerContext';
import { Banner } from './src/components/Banner';

export default function App() {
  return (
    <BannerProvider>
      {/* Your app content */}
    </BannerProvider>
  );
}
```

### 4. Port Web Components
- Convert CSS modules to StyleSheet
- Replace `div` with `View`
- Replace `span`/`p` with `Text`
- Replace `button` with `Button` or `TouchableOpacity`
- Replace `input` with `TextInput`
- Use same business logic from @mdsystem/core!

## ✅ Summary

Both mobile apps are **fully set up** with:
- ✅ React Native with Expo
- ✅ @mdsystem/core integration
- ✅ Proper folder structure
- ✅ Banner system
- ✅ Context providers
- ✅ Demo apps showcasing features
- ✅ TypeScript version available

**Ready to start building screens!** 🎉
