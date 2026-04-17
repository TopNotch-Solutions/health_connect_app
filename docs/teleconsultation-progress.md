# Teleconsultation Progress Tracker

## Goal

Implement a teleconsultation flow where:

1. A patient selects `video_consultation`.
2. A provider accepts the request.
3. The patient pays the provider outside the app using the agreed cash/eWallet transfer path.
4. The patient taps `Payment Confirmed`.
5. The provider verifies receipt and taps `Payment Received`.
6. Both users are allowed to join an in-app Jitsi video call.

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
- Patient-side payment confirmation handoff is now available for testing
- Provider-side payment receipt confirmation is now available for testing
- Jitsi WebView call access is now wired for patient and provider call screens

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
6. When a provider accepts, the patient sees the provider number and payment instructions.
7. After sending payment, the patient taps `Payment Confirmed`.
8. The patient waits for the provider to confirm receipt.
9. Once the provider confirms receipt, the patient can enter the video consultation room.
10. After the consultation ends, the request is marked as completed.

### Provider Flow

1. Provider sees a new request with `consultationMode = video_consultation`.
2. Provider reviews the request details.
3. Provider accepts the request.
4. The request moves into `payment_pending`.
5. Provider waits while the patient sends payment and taps `Payment Confirmed`.
6. Provider verifies they have received the funds.
7. Provider taps `Payment Received`.
8. Once confirmed, provider can enter the video consultation room.
9. After the consultation ends, the request is marked as completed.

### Important Rule

Acceptance does not start the call immediately.

For teleconsultation:

- acceptance means the provider has agreed to take the consultation
- the patient must first mark payment as sent
- provider confirmation must happen after receiving the funds
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

## Jitsi WebView Integration Blueprint

This section maps the current in-app call approach into the codebase.

### Recommended Provider

- Use Jitsi in an in-app WebView for the first working version.

Reason:

- it keeps the call inside the app
- it avoids the extra native SDK risk from the earlier Stream path
- it still fits the request lifecycle already built in this project

### Backend Call Access Contract

- Keep `/api/app/teleconsultation/call-access/:requestId`
- Return:
  - `requestId`
  - `requestStatus`
  - `roomName`
  - `meetingUrl`
  - `displayName`

### Frontend Flow After Current Work

1. Patient creates a request for an ailment with `supportsTeleconsultation = true`
2. Provider accepts
3. Request becomes `payment_pending`
4. Patient sends payment outside the app
5. Patient taps `Payment Confirmed`
6. Request becomes `provider_confirmation_pending`
7. Provider taps `Payment Received`
8. Request becomes `ready_for_call`
9. Patient or provider taps `Join Call`
10. App fetches Jitsi room access from backend
11. App opens the Jitsi room inside an in-app WebView
12. App marks request `in_call`
13. Provider can end the consultation, which marks the request `completed`

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

## Step 5: Jitsi WebView Call Screen Wiring

This step connects the teleconsultation lifecycle to an in-app Jitsi room.

### What Was Implemented

- Registered the backend teleconsultation route so the mobile app can request call access.
- Added a backend call-access response that returns:
  - Jitsi room name
  - meeting URL
  - display name
  - request id
  - current request status
- Added a frontend teleconsultation API helper.
- Replaced the old Stream-powered screen with a Jitsi WebView call screen component.
- Added patient and provider hidden routes for the call screen.
- Added `Join Call` entry points on:
  - patient waiting room
  - provider requests screen
- Reused the existing camera and microphone permissions already in the app config.

### Current Call Behavior

1. Provider confirms payment receipt
2. Request becomes `ready_for_call`
3. Patient or provider taps `Join Call`
4. App requests Jitsi room access from backend
5. App opens the Jitsi meeting inside the app
6. First joined participant marks request `in_call`
7. Provider hangup currently marks the consultation `completed`

### Important Testing Note

This call screen should still be tested primarily in the development build that is already in place, especially because teleconsultation is being exercised alongside the rest of the native app flow.

### Flow Update: Cash + Confirmation Handoff

The current business flow now differs from the earlier placeholder wallet flow:

- request creation keeps `paymentMethod = cash`
- patient sees provider details and payment instructions after acceptance
- patient button text is `Payment Confirmed`
- provider button text is `Payment Received`
- provider confirmation is what unlocks `ready_for_call`
