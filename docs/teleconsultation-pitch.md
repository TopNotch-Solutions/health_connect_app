# Teleconsultation Feature Proposal

## Overview

Teleconsultation would allow patients to request care through a video call for cases that do not require a physical visit, such as therapy, follow-up consultations, and other talk-based care.

This feature fits well into the current HealthConnect app because the request flow already supports consultation modes. Instead of creating a separate system, we can extend the existing request lifecycle in a safe and structured way.

## Proposed Flow

1. A patient creates a request and selects `Teleconsultation`.
2. A provider receives and accepts the request.
3. The request moves into a `payment pending` stage.
4. The patient completes payment.
5. The provider confirms readiness.
6. Both users are allowed to join the video consultation.
7. The session ends and the request is marked as completed.

## Why This Is A Good Fit

- Expands HealthConnect beyond physical visits.
- Supports therapy and similar consultation types naturally.
- Creates a more flexible care option for patients.
- Reuses much of the current request, payment, and provider acceptance flow.

## Recommended Technical Approach

The safest way to build this is to treat teleconsultation as another `consultationMode`, not as a completely separate feature branch.

This means:

- Keep the existing request model.
- Add teleconsultation-specific statuses like `payment_pending`, `ready_for_call`, and `in_call`.
- Use separate post-acceptance screens for video consultations so house-visit logic stays untouched.
- Only create or unlock the video session after payment is confirmed.

## Why This Approach Is Safe

This avoids breaking the current app because:

- House visits will continue using maps, routing, distance, and provider tracking.
- Teleconsultations will follow their own video-call path after request acceptance.
- Existing request creation and provider acceptance logic can be reused instead of replaced.

In short, we are extending the app, not rewriting core behavior.

## Key Requirements

- Add `teleconsultation` as a supported consultation option.
- Introduce payment and provider confirmation checkpoints before the call starts.
- Add a waiting room or ready state for both patient and provider.
- Integrate a secure video calling solution with backend-managed session control.

## Suggested Rollout

1. Update request statuses and backend logic.
2. Add teleconsultation handling to patient and provider request flows.
3. Add payment confirmation step.
4. Add provider confirmation step.
5. Add video room / call experience last.

## Conclusion

Teleconsultation is realistic, valuable, and technically achievable within the current HealthConnect architecture. The best implementation path is to build it as a new consultation mode with its own payment and video-call stages, while keeping the existing house-visit experience unchanged.
