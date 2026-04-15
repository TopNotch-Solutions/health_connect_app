# Teleconsultation Progress Tracker

## Goal

Implement a teleconsultation flow where:

1. A patient selects `video_consultation`.
2. A provider accepts the request.
3. The patient completes payment.
4. The provider confirms readiness.
5. Both users are allowed to join a video call.

## Current Status

- Planning started
- Step 2 started
- Step 3 started
- Step 4 started
- Teleconsultation request statuses added to the backend model
- Provider acceptance now branches by consultation mode
- Video consultation acceptance now moves to `payment_pending`
- Patient and provider screens now recognize the first teleconsultation states
- Ailments can now explicitly allow teleconsultation
- Patient-side placeholder payment flow is now available for testing
- Provider-side readiness confirmation is now available for testing
- Stream-backed teleconsultation call access is now wired for patient and provider dev builds

## First Step

Define the teleconsultation request lifecycle before coding.

Proposed statuses:

- `searching`
- `accepted`
- `payment_pending`
- `paid`
- `provider_confirmation_pending`
- `ready_for_call`
- `in_call`
- `completed`
- `cancelled`

This is the first step because both frontend and backend must agree on these states before any implementation starts.

## Step 1: Patient And Provider Workflow

This step defines how teleconsultation should behave between the patient and provider using the current request-based architecture of the project.

### Patient Flow

1. Patient opens request creation.
2. Patient selects `video_consultation`.
3. Patient submits the request.
4. Request is sent to matching providers.
5. Patient sees the request in a waiting state.
6. When a provider accepts, the patient is prompted to make payment.
7. After payment succeeds, the patient waits for provider confirmation.
8. Once the provider confirms, the patient can enter the video consultation room.
9. After the consultation ends, the request is marked as completed.

### Provider Flow

1. Provider sees a new request with `consultationMode = video_consultation`.
2. Provider reviews the request details.
3. Provider accepts the request.
4. The request moves into `payment_pending`.
5. Provider waits while the patient completes payment.
6. After payment is confirmed, provider is prompted to confirm readiness.
7. Once confirmed, provider can enter the video consultation room.
8. After the consultation ends, the request is marked as completed.

### Important Rule

Acceptance does not start the call immediately.

For teleconsultation:

- acceptance means the provider has agreed to take the consultation
- payment must happen before the call can begin
- provider confirmation must happen after payment
- only then can both sides join the call

### Why This Matches The Current Project

This project already revolves around consultation requests, provider acceptance, and request status updates.

That means teleconsultation should extend the existing request flow instead of introducing a completely separate flow.

House visits and teleconsultations should share:

- request creation
- provider acceptance
- request history
- status updates

They should differ after acceptance:

- house visits continue into route tracking
- teleconsultations continue into payment, readiness confirmation, and video call

## Backend Areas Likely To Change

- `health_connect_backend-main/models/request.js`
- `health_connect_backend-main/server.js`
- `health_connect_backend-main/controllers/app/transactionController.js`
- `health_connect_backend-main/controllers/app/authController.js`
- Any request-related controller/socket logic tied to accept/update/payment flow

## Frontend Areas Likely To Change

- `app/(app)/(patient)/home.tsx`
- `app/(app)/(provider)/home.tsx`
- `components/(patient)/CreateRequestModal.tsx`
- `lib/socket.ts`
- Request tracking / waiting room screens

## Files Touched So Far

- `docs/teleconsultation-progress.md`
- `health_connect_backend-main/models/request.js`
- `health_connect_backend-main/models/ailment.js`
- `health_connect_backend-main/server.js`
- `health_connect_backend-main/controllers/portal/alignmentController.js`
- `app/(app)/(provider)/home.tsx`
- `app/(app)/(provider)/requests.tsx`
- `components/(patient)/CreateRequestModal.tsx`
- `lib/socket.ts`
- `app/(app)/(patient)/waiting-room.tsx`
- `app/(app)/(patient)/recent-activities.tsx`
- `app/(app)/(patient)/all_ailments.tsx`
- `app/(app)/(patient)/ailments.tsx`
- `lib/teleconsultation.ts`
- `components/teleconsultation/TeleconsultationCallScreen.tsx`
- `app/(app)/(patient)/teleconsultation-call.tsx`
- `app/(app)/(provider)/teleconsultation-call.tsx`
- `health_connect_backend-main/controllers/app/teleconsultationController.js`
- `health_connect_backend-main/routes/app/teleconsultationRoute.js`
- `app/(app)/(patient)/_layout.tsx`
- `app/(app)/(provider)/_layout.tsx`
- `app.json`

## Step 2: Acceptance Split Implemented

This step introduces the first working teleconsultation-specific behavior without changing payment or video infrastructure yet.

### What Was Implemented

- Added teleconsultation statuses to the request model:
  - `payment_pending`
  - `paid`
  - `provider_confirmation_pending`
  - `ready_for_call`
  - `in_call`
- Updated backend active-status checks so teleconsultation requests are treated as active work.
- Updated provider acceptance logic:
  - `house_visit` still moves to `accepted`
  - `video_consultation` now moves to `payment_pending`
- Updated provider app screens so accepting a teleconsultation no longer starts route tracking.
- Updated patient waiting/history screens so the new teleconsultation statuses display cleanly.

### Why This Step Matters

This is the safest first code change because it separates teleconsultation from the physical route flow at the exact point where the two experiences diverge.

That means:

- house visits still use the current route logic
- teleconsultations now stop after acceptance and wait for payment
- no video or payment provider has been introduced yet

### What Still Needs To Be Added

- provider readiness confirmation
- video room/session creation
- join-call UI

## Step 3: Ailment Gating And Placeholder Payment

This step adds the first real teleconsultation controls at the ailment level and introduces a safe placeholder payment action for testing.

### What Was Implemented

- Added `supportsTeleconsultation` to the ailment model.
- Updated ailment create/update backend logic so this flag can be stored.
- Updated the patient request modal:
  - teleconsultation is only shown for ailments where `supportsTeleconsultation = true`
  - ailments without this flag only allow `house_visit`
- Added a placeholder patient payment action in the waiting room:
  - available when a teleconsultation is in `payment_pending`
  - simulates successful payment for testing
  - moves the request to `paid`

### Important Note

This payment flow is intentionally a placeholder for development.

It does not use a real payment gateway yet.

It is only meant to let us test the teleconsultation lifecycle while the backend/payment owner prepares the real integration.

### Backend Handoff Note

When the real payment integration is added later, the placeholder payment step should be replaced with:

- wallet deduction or gateway confirmation
- transaction creation
- server-side verified payment success
- then status transition to `paid`

## Notes For Backend Teammate

- Teleconsultation should be treated as a consultation mode, not as a separate system.
- House visit logic should remain untouched where possible.
- Payment and video access must be controlled by backend state.

## Next Step

Implement provider readiness confirmation so a teleconsultation can move from `paid` to `ready_for_call`, then prepare the waiting-room/join-call handoff.

## Stream Video Integration Blueprint

This section maps the actual video-call implementation into the current codebase.

### Recommended Provider

- Use Stream Video for the real call layer.

Reason:

- It fits Expo development builds better than lower-level native-heavy approaches.
- It lets the backend own token generation and call access.
- It works well with the request lifecycle already in this project.

### New Environment Variables

Backend:

- `STREAM_VIDEO_API_KEY`
- `STREAM_VIDEO_SECRET`

Frontend:

- `EXPO_PUBLIC_STREAM_VIDEO_API_KEY`

### Backend Files To Add Or Change

- `health_connect_backend-main/server.js`
  - add socket events for provider readiness and call token retrieval
- `health_connect_backend-main/models/request.js`
  - add call metadata fields
- `health_connect_backend-main/controllers/app/transactionController.js`
  - later replace placeholder payment with real verified payment
- `health_connect_backend-main/lib/streamVideo.js` or similar new helper
  - initialize Stream server client
  - create user tokens
  - prepare call/session metadata

### Backend Fields To Add On Request

- `videoCall`
  - `providerConfirmedAt`
  - `callId`
  - `roomType`
  - `patientJoinedAt`
  - `providerJoinedAt`
  - `endedAt`

### Backend Socket Events To Add

- `confirmTeleconsultationReady`
  - actor: provider
  - transition: `paid` -> `ready_for_call`
- `getTeleconsultationCallAccess`
  - actor: patient or provider assigned to the request
  - returns:
    - Stream user token
    - `callId`
    - API key
- `joinTeleconsultationCall`
  - optional app-level tracking event
  - transition: `ready_for_call` -> `in_call`
- `leaveTeleconsultationCall`
  - optional app-level tracking event
- `endTeleconsultationCall`
  - transition: `in_call` -> `completed`

### Frontend Files To Add Or Change

- `lib/socket.ts`
  - add wrappers for:
    - provider readiness confirmation
    - fetch call credentials
    - call start/end events
- `app/(app)/(patient)/waiting-room.tsx`
  - show:
    - `Pay Now`
    - `Waiting for provider confirmation`
    - `Join Call`
- `app/(app)/(provider)/requests.tsx`
  - show:
    - `Confirm Ready`
    - `Join Call`
- `app/(app)/(provider)/home.tsx`
  - keep teleconsultations out of route tracking
- `app/(app)/(patient)/teleconsultation-call.tsx`
  - new patient call screen
- `app/(app)/(provider)/teleconsultation-call.tsx`
  - new provider call screen
- `app/_layout.tsx`
  - wrap app with Stream provider if needed at root or a teleconsultation sub-layout

### Frontend Flow After Current Work

1. Patient creates a request for an ailment with `supportsTeleconsultation = true`
2. Provider accepts
3. Request becomes `payment_pending`
4. Patient pays
5. Request becomes `paid`
6. Provider taps `Confirm Ready`
7. Request becomes `ready_for_call`
8. Patient or provider fetches Stream call access
9. Both navigate into the call screen
10. App marks request `in_call`
11. When finished, app or backend marks request `completed`

### Navigation Plan

- Keep the call screen separate from route/map flows.
- Do not reuse `RouteContext` for teleconsultation.
- Teleconsultation should have its own screen and state path.

### Handoff Note For Teammate With Secrets

Once Stream credentials are available, the teammate only needs to:

- add the Stream env values
- implement the backend token helper
- wire the `ready_for_call` and call-access events
- install the Stream React Native video SDK and wrap the call screen

The teleconsultation request lifecycle already being built here should remain the controlling business layer.

## Step 4: Provider Readiness Confirmation

This step adds the provider action that unlocks the teleconsultation after payment.

### What Was Implemented

- Added provider-side readiness confirmation in the provider requests screen.
- Added a backend-supported transition for teleconsultation from `paid` to `ready_for_call`.
- Restricted teleconsultation call-state transitions so only the assigned provider can move a video consultation into the ready state.
- Updated the provider teleconsultation card UI so providers can see:
  - waiting for patient payment
  - payment received
  - ready to start video consultation

### What This Enables

The current end-to-end teleconsultation test flow is now:

1. Patient selects an ailment with teleconsultation enabled
2. Patient chooses `video_consultation`
3. Provider accepts
4. Request moves to `payment_pending`
5. Patient uses placeholder payment
6. Request moves to `paid`
7. Provider taps `Confirm Ready`
8. Request moves to `ready_for_call`

### What Still Needs To Be Added

- actual call access/token retrieval
- call screen UI
- start/end call transitions

## Step 5: Stream Call Screen Wiring

This step connects the teleconsultation lifecycle to a real video room.

### What Was Implemented

- Registered the backend teleconsultation route so the mobile app can request call access.
- Added a backend call-access response that returns:
  - Stream API key
  - user token
  - teleconsultation call id
  - request id
  - current request status
- Added a frontend teleconsultation API helper.
- Added a shared Stream-powered call screen component.
- Added patient and provider hidden routes for the call screen.
- Added `Join Call` entry points on:
  - patient waiting room
  - provider requests screen
- Added camera and microphone permissions plus the WebRTC Expo config plugin in `app.json`.

### Current Call Behavior

1. Provider confirms readiness
2. Request becomes `ready_for_call`
3. Patient or provider taps `Join Call`
4. App requests Stream access from backend
5. App joins the Stream call
6. First joined participant marks request `in_call`
7. Provider hangup currently marks the consultation `completed`

### Important Testing Note

This call screen requires an Expo development build.

It will not work correctly in Expo Go because the Stream native video stack and WebRTC plugin need native build support.
