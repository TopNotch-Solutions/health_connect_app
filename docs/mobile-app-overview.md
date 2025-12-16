# Health Connect Mobile App — Technical Overview

This document describes the mobile application in the `health-connect` workspace: its purpose, architecture, key flows, modules, and how to run and extend it.

## Purpose & Scope

- Connects patients with nearby healthcare providers (doctor, nurse, physiotherapist, social worker) for on-demand care.
- Provides onboarding, authentication, role-based navigation, real-time request/accept flows, location and maps, push notifications, and a wallet placeholder.
- Mobile built with Expo + React Native + TypeScript; backend present in sibling folder `health-connect-backend/`.

## Tech Stack

- UI: React Native 0.81, Expo SDK 54, Expo Router 6, NativeWind (Tailwind)
- Navigation: File-based routing via Expo Router with protected layout
- State/Context: Custom `AuthContext`, `RouteContext`
- Networking: Axios client with timeouts and interceptors
- Realtime: Socket.IO client
- Maps & Location: `react-native-maps`, `expo-location`, Google Maps SDK
- Notifications: `expo-notifications` with device tokens
- Storage: `expo-secure-store`, `@react-native-async-storage/async-storage`

See dependencies in [health-connect/package.json](../package.json).

## App Configuration

- Expo config: [health-connect/app.json](../app.json)
  - Android: Google Maps API key, `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` permissions, edge-to-edge UI
  - Plugins: `expo-router`, custom `withNetworkSecurityConfig`, `expo-splash-screen`, `expo-secure-store`, `expo-location`
  - Experiments: `typedRoutes`, `reactCompiler`
- Styling: Tailwind preset and colors in [health-connect/tailwind.config.js](../tailwind.config.js)

## Architecture

- Entry and layout: [health-connect/app/_layout.tsx](../app/_layout.tsx)
  - Wraps app with `GestureHandlerRootView`, `AuthProvider`, `RouteProvider`, and renders a protected stack.
  - Redirects based on auth state and user role (patient vs provider) and keeps users inside their role silo.
- Index bootstrap: [health-connect/app/index.tsx](../app/index.tsx)
  - Checks `AsyncStorage` key `hasSeenOnboarding` to route first-time users to onboarding, returning users to sign-in.
- Contexts:
  - Auth: [health-connect/context/AuthContext.tsx](../context/AuthContext.tsx)
    - Manages `user`, login/logout, and a 5-minute inactivity session timeout using SecureStore timestamps.
    - Integrates with `socketService` to disconnect on logout.
  - Route: [health-connect/context/RouteContext.tsx](../context/RouteContext.tsx)
    - Stores an active provider route context (e.g., current request being navigated to).
- Networking:
  - Axios client: [health-connect/lib/api.ts](../lib/api.ts)
    - Base URL: `http://13.61.152.64:4000/api` with 120s default timeout; 180s for file uploads; timeout error normalization.
- Realtime:
  - Socket service: [health-connect/lib/socket.ts](../lib/socket.ts)
    - Connects to `http://13.61.152.64:4000`, supports `connect/join/disconnect`, ensures cleanup of event listeners on disconnect.
    - Exposes helpers for creating requests, fetching available/patient requests, and subscribing to updates (e.g., `requestUpdated`, `newRequestAvailable`).
- Notifications:
  - Hook: [health-connect/hooks/usePushNotifications.ts](../hooks/usePushNotifications.ts)
    - Requests permissions, registers device for push, and PATCHes `/app/auth/update-push-token/:userId` to backend.
- Screens (selection):
  - Onboarding Stack: [health-connect/app/(onboarding)/_layout.tsx](../app/(onboarding)/_layout.tsx)
  - Wallet placeholder: [health-connect/app/wallet.tsx](../app/wallet.tsx)
  - Notifications: [health-connect/app/notifications.tsx](../app/notifications.tsx)
  - Auth, verification, and role-based app routes under `app/(root)`, `app/(auth)`, `app/(verification)`, `app/(app)/(patient)` and `app/(app)/(provider)`.

## Navigation & Routing

- File-based routing with guarded access inside `ProtectedLayout` ([link](../app/_layout.tsx)):
  - Not authenticated → redirected from any `(app)` route to `(root)/sign-in`.
  - Authenticated patients land at `(app)/(patient)/home`; providers land at `(app)/(provider)/home`.
  - Cross-silo access is redirected back to the correct home based on `user.role`.

## Data & Session Flow

- Login: `apiClient.post('/app/auth/login', { email, password })` sets `user` in SecureStore and memory; updates `lastActivityTime`.
- Session timeout: After 5 minutes of inactivity, user is logged out on next app foreground or check (see `SESSION_TIMEOUT` in [AuthContext](../context/AuthContext.tsx)).
- Update user: `updateUser(partial)` merges and re-persists SecureStore state for post-action updates (e.g., balance).

## Realtime Request Flow (Socket)

- Connection: `socketService.connect(userId, role)` and optionally `socketService.join(userId, role)` upon `connect`.
- Create request (patient): `createRequest({ patientId, location, ailmentCategory, paymentMethod, estimatedCost, ... })`
  - Emits `createRequest` and resolves on `requestCreated` or rejects on `requestError`/timeout.
- Provider discovery: `getAvailableRequests(providerId)` resolves on `availableRequests`.
- Subscriptions: `onRequestUpdate`, `onRequestUpdated`, `onNewRequestAvailable`, `onRequestStatusChanged`, `onProviderUnavailable`, `onProviderResponse`.
- Robustness: Tracks handlers in a map to `off()` on disconnect to prevent leaks.

## Notifications

- Registers device token with Expo; sends token to backend via `/app/auth/update-push-token/:userId`.
- Configures Android channel and default handler for showing alerts and sounds.

## Maps & Location

- Requires Google Maps API key set in [app.json](../app.json) under `android.config.googleMaps.apiKey`.
- Requests location permission through `expo-location` plugin.
- Uses `react-native-maps` (and `react-native-maps-directions` where required) for map rendering and routing.

## Styling

- NativeWind + Tailwind with custom colors: see [tailwind.config.js](../tailwind.config.js)
- Utility classes used across screens (e.g., `bg-white`, `text-text-main`, gradients).

## Environment & Secrets

- API base: [lib/api.ts](../lib/api.ts) currently points to `http://13.61.152.64:4000/api`.
- Socket base: [lib/socket.ts](../lib/socket.ts) points to `http://13.61.152.64:4000`.
- Google Maps API key is embedded in `app.json` for Android.

Recommendations:
- Move sensitive keys and service URLs to environment config (EAS secrets or runtime config) and avoid committing raw keys.
- Consider HTTPS endpoints and certificate/network security configuration for production.

## Running the App

Prerequisites: Node.js LTS, Android Studio or Xcode (for emulators), and Expo CLI tooling.

Install and start:

```bash
npm install
npx expo start
```

Platform targets:

```bash
npm run android
npm run ios
npm run web
```

Lint:

```bash
npm run lint
```

## Folder Structure (selected)

- `app/` — Screens and stacks (file-based routes)
  - `_layout.tsx` — Protected stack and providers
  - `index.tsx` — Bootstrap and onboarding redirect
  - `(onboarding)/` — Onboarding flows
  - `(root)/(auth)/(verification)/(app)/` — Auth and role-based sections
- `components/` — Reusable UI (patient/provider)
- `context/` — `AuthContext`, `RouteContext`
- `hooks/` — `usePushNotifications`
- `lib/` — `api.ts`, `socket.ts`, maps/helpers
- `assets/` — Images, icons, fonts

## Backend Integration

- Backend source in `health-connect-backend/` (Node/Express) — mobile expects routes like:
  - `POST /api/app/auth/login`
  - `PATCH /api/app/auth/update-push-token/:userId`
  - `GET /api/app/notification/all-user-notification/:userId`
  - `PATCH /api/app/notification/mark-as-read/:userId`
- Socket namespace/events on the same host for real-time request lifecycle.

## Troubleshooting

- Socket not connected: ensure backend is reachable and URLs in `lib/api.ts` and `lib/socket.ts` are correct for your environment/emulator.
- Maps not rendering: verify Google Maps API key and Android SDK configuration.
- Push tokens missing: run on a physical device; Expo Go needs proper project ID configuration.
- Session logs out too quickly: adjust `SESSION_TIMEOUT` in `AuthContext`.

## Next Steps / TODOs

- Implement wallet transactions and history UI in [app/wallet.tsx](../app/wallet.tsx)
- Centralize environment configs (API base, socket URL, keys) via EAS secrets or `.env`
- Add error surfaces and retry strategies for network outages
- Add E2E and unit tests for critical flows (auth, requests, notifications)
