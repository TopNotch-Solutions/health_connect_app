# Health Connect Testing Documentation

This document describes the frontend and backend surfaces in Health Connect so the testing scope is easy to trace. It stays descriptive and does not judge implementation quality.

## Frontend

The frontend is the Expo + React Native mobile app under [app/](../app) with supporting UI and logic in [components/](../components), [context/](../context), and [lib/](../lib).

### App structure

- Entry point: [app/_layout.tsx](../app/_layout.tsx)
- Bootstrap route: [app/index.tsx](../app/index.tsx)
- Root flows: [app/(root)/](../app/(root))
- Onboarding flows: [app/(onboarding)/](../app/(onboarding))
- Authentication flows: [app/(auth)/](../app/(auth))
- Verification flows: [app/(verification)/](../app/(verification))
- Role-based app flows: [app/(app)/(patient)/](../app/(app)/(patient)) and [app/(app)/(provider)/](../app/(app)/(provider))

### Frontend responsibilities

- Handles onboarding, sign-in, password reset, and OTP verification.
- Routes users by role into patient or provider experiences.
- Displays request, notification, wallet, profile, and teleconsultation screens.
- Keeps the current user and route context in memory through `AuthContext` and `RouteContext`.
- Stores session state with Expo SecureStore and AsyncStorage.
- Connects to the backend API through `lib/api.ts`.
- Connects to the realtime channel through `lib/socket.ts`.
- Renders maps, location-aware views, and request-tracking screens for patient and provider flows.

### Frontend testing surfaces

- Authentication state and protected routing.
- Onboarding and role-selection flow.
- Patient request creation and waiting-room flow.
- Provider request list, acceptance flow, and provider route flow.
- Notification list and read-state updates.
- Teleconsultation screens and call handoff screens.
- Profile editing modals and wallet placeholder screens.
- Network handling for API calls and socket events.

## Backend

The backend lives in [health_connect_backend-main/](../health_connect_backend-main) and is built on Express, Mongoose, Socket.IO, and related Node.js services.

### Backend structure

- Server entry point: [health_connect_backend-main/server.js](../health_connect_backend-main/server.js)
- Common routes: [health_connect_backend-main/routes/common/](../health_connect_backend-main/routes/common)
- App routes: [health_connect_backend-main/routes/app/](../health_connect_backend-main/routes/app)
- Portal routes: [health_connect_backend-main/routes/portal/](../health_connect_backend-main/routes/portal)
- App controllers: [health_connect_backend-main/controllers/app/](../health_connect_backend-main/controllers/app)
- Portal controllers: [health_connect_backend-main/controllers/portal/](../health_connect_backend-main/controllers/portal)
- Data models: [health_connect_backend-main/models/](../health_connect_backend-main/models)

### Backend responsibilities

- Exposes HTTP APIs for app and portal clients.
- Handles authentication and session-related API flows.
- Serves notification, teleconsultation, issue, transaction, package, FAQ, specialization, advert, and request endpoints.
- Manages realtime request lifecycle data over Socket.IO.
- Tracks online users by role for targeted messaging and provider discovery.
- Uses Mongoose models for persistent app data.
- Uses middleware such as CORS, JSON parsing, cookies, and body parsing.

### Backend route groups

- Common auth: `/api/auth`
- App auth: `/api/app/auth`
- App issue: `/api/app/issue`
- App notification: `/api/app/notification`
- App teleconsultation: `/api/app/teleconsultation`
- App transaction: `/api/app/transaction`
- App specialization: `/api/app/specialization`
- App FAQ: `/api/app/faq`
- App adverts: `/api/app/adverts`
- App packages: `/api/app/packages`
- Portal auth: `/api/portal/auth`
- Portal request: `/api/portal/request`
- Portal specialization: `/api/portal/specialization`
- Portal alignment: `/api/portal/aligment`
- Portal FAQ: `/api/portal/faq`
- Portal notification: `/api/portal/notification`
- Portal adverts: `/api/portal/adverts`
- Portal packages: `/api/portal/packages`

### Backend testing surfaces

- API routing and request payload handling.
- Auth flows for app and portal clients.
- Notification delivery and read-state endpoints.
- Teleconsultation request and call-related endpoints.
- Request lifecycle updates through Socket.IO.
- Provider discovery and role-based socket registration.
- Model-backed persistence for users, requests, notifications, transactions, and related records.

## Shared integration points

- The frontend API client points at backend `/api` endpoints.
- The frontend socket client connects to the same backend host for realtime events.
- Frontend auth, notifications, and request flows rely on backend route responses and socket events.
- Patient and provider role data are used on both sides to decide route access and request delivery.
