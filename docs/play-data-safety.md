# Google Play — Data Safety Declaration

**App:** Health Connect (`net.kopanovertex.healthConnect`)
**Revised:** 1 August 2026 — verified against the current working tree
**Where to enter this:** Play Console → *Policy* → *App content* → *Data safety*

> Supersedes the earlier `PLAY_DATA_SAFETY.md`. That version was written before the
> security work of 1 August 2026 and is now wrong in several places — most importantly it
> declares card data that the app no longer collects. Corrections to it are listed in
> [Appendix A](#appendix-a--corrections-to-the-previous-version).

> **Naming:** this app is called "Health Connect" but does **not** integrate Android's
> Health Connect API (`androidx.health.connect`). No `android.permission.health.*`
> permissions exist in the manifest, so that permissions declaration does not apply.
> The **Health apps declaration** does apply — this is telehealth.

---

## Part 0 — Submission blockers

| # | Issue | Status |
|---|-------|--------|
| 1 | Cleartext HTTP permitted app-wide | **Resolved** |
| 2 | DPO merchant credentials in the app bundle | **Resolved in code — key rotation still outstanding** |
| 3 | Deactivate ≠ delete | **Open — blocks submission** |
| 4 | No privacy policy URL | **Open — blocks submission** |
| 5 | Google Maps API key unrestricted and in git history | **Open** |
| 6 | `android:allowBackup="true"` | **Not an issue — closed** |

### 1 — Cleartext HTTP · resolved

`base-config` is now `cleartextTrafficPermitted="false"`. The only exceptions are `10.0.2.2`
and `localhost`, the Android emulator host alias and loopback used by `lib/backend.ts` during
development. Neither is reachable from a real device, so a Play-installed build has no
cleartext path.

The fix lives in `plugins/withNetworkSecurityConfig.js`, which regenerates
`android/app/src/main/res/xml/network_security_config.xml` on every prebuild. **Editing the
generated XML alone does not work** — the plugin overwrites it. Both are currently in sync.

The former `13.51.207.99` exception has been removed.

### 2 — DPO credentials · resolved in code, rotation outstanding

`EXPO_PUBLIC_DPO_PAYGATE_ID` and `EXPO_PUBLIC_DPO_ENCRYPTION_KEY` no longer exist in the app.
Payment initiation and verification both happen server-side (`utils/dpoPayment.js`). The app
holds only two public URLs and never sees the merchant secret.

**Still required:** rotate the PayGate encryption key with DPO. The old value shipped inside
every build already distributed, and removing it from future builds does not un-ship those.

Also remove `EXPO_PUBLIC_DPO_*` from the working `.env` — `.env.example` is already updated.

### 3 — Deactivate is not delete · OPEN

`POST /app/auth/deactivate-account` sets `accountDeactivation = true` and nothing else. No
data is removed. Both `app/(app)/(patient)/profile.tsx` and `app/(app)/(provider)/profile.tsx`
call it; there is no delete endpoint and no deletion URL anywhere in the app.

Play requires **both**:

1. **In-app deletion** of the account and its associated data
2. **A publicly reachable web URL** that works without login or installation, so a user who
   has uninstalled can still request deletion

Per Play's guidance the page must name the app or developer as shown on the listing, set out
the steps prominently, and state what is deleted, what is kept, and for how long.

**Retention note:** not everything can be deleted. Consultation records and prescriptions are
medical records subject to HPCNA retention rules, and transaction records fall under tax
retention. The workable position is to delete identifying data (name, contact details,
national ID, ID document scans, location history, device tokens) and retain clinical and
financial records in de-identified form for a stated period. **The actual retention periods
must be confirmed by whoever advises on HPCNA and Namibian data protection — they are not an
engineering decision and must not be guessed at on a public page.**

### 4 — Privacy policy · OPEN

Mandatory field. No policy currently exists — the file referenced by the previous version of
this document was never written. It must be hosted at a stable public URL and must
specifically address health data handling and retention.

### 5 — Google Maps API key · OPEN

The key is present in `app.json` and `AndroidManifest.xml`, and appears across at least five
commits in git history. Keys in a manifest are always extractable — that is expected and not
itself the problem. What is required:

- Restrict the key to the Android package name + release SHA-1 in Google Cloud Console
- Rotate it, because the unrestricted value is in history

### 6 — `allowBackup` · closed, no action

Previously flagged as a possible concern. It is not. `expo-secure-store` supplies both
`secure_store_backup_rules.xml` and `secure_store_data_extraction_rules.xml`, and each
contains only `<include domain="sharedpref" path="."/>` with `SecureStore` excluded. Because
an explicit include list is present, **only SharedPreferences is backed up at all**.
AsyncStorage and redux-persist live in the SQLite `database` domain, which is never included —
so the cached ailment categories and the persisted store are already outside Auto Backup.

Setting `allowBackup="false"` is reasonable defence in depth but is not required.

---

## Part 1 — Data collection and security

| Question | Answer | Basis |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Registration, consultation requests and payments all reach `apihealthconnect.kopanovertex.com` |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | HTTPS base URL, and cleartext is now denied by the network security config (blocker 1) |
| Do you provide a way for users to request that their data be deleted? | **No — until blocker 3 is resolved** | Deactivation only |
| Has your data collection and security been independently validated against a global security standard? | **No** | No MASA or equivalent review |
| Is your app exclusively designed for children? | **No** | Adult telehealth — rate 18+ |

**Data deletion URL:** required before submission. Suggested location
`https://kopanovertex.com/health-connect/delete-account`.

---

## Part 2 — Data types to declare

### Location

| Field | Value |
|---|---|
| Types | **Approximate** and **Precise location** |
| Collected / Shared | Yes / **Yes** — sent to the matched provider over Socket.IO |
| Ephemeral | No — persisted with the consultation request |
| Required | Required — core to provider matching and house visits |
| Purposes | App functionality |

Evidence: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`; `lib/locationPermission.ts`,
`lib/geocoding.ts`; `createRequest` in `lib/socket.ts` sends coordinates and resolved address
components.

> Reverse geocoding sends precise coordinates to Google Maps Platform. Declare Google as a
> recipient in the privacy policy.

### Personal info

| Sub-type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| Name | Yes | Yes — visible to the provider consulted | Required | App functionality, Account management |
| Email address | Yes | No | Required | App functionality, Account management |
| Phone number | Yes | Yes — provider | Required | App functionality, Account management |
| Address | Yes | Yes — provider, for house visits | Required | App functionality |
| Race / ethnicity, political or religious beliefs, sexual orientation | No | — | — | — |
| **Other info** — gender, date of birth, **national ID number**, HPCNA registration number and expiry, governing council, specializations, years of experience, bio, pharmacy registration details | Yes | Partly — professional credentials shown to patients | Required | App functionality, Account management, **Fraud prevention** (identity and licence verification) |

Evidence: `types/user.ts`; `/app/auth/register-patient`, `/app/auth/register-health-provider`,
`/app/auth/update-patient-details`, `/app/auth/update-health-provider-details`.

> The **national ID number** is sensitive. Play requires a clear in-app disclosure of why it
> is needed. It must not be used for advertising or shared with third parties.

### Financial info

| Sub-type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| **User payment info** | **No** | — | — | — |
| Purchase history | Yes | Yes — **DPO Pay** | Required for paid consultations | App functionality |
| Other financial info | **No** | — | — | — |

**This is the largest change from the previous version.** The app no longer collects card
numbers, expiry dates, CVVs or cardholder names anywhere. Card entry happens exclusively on
DPO's hosted payment page, rendered in a WebView. The backend no longer accepts card fields.

The in-app wallet (transfers, withdrawals, wallet balance) is **disabled** — those endpoints
return `501` and write nothing — so there is no wallet balance or transfer data to declare.
Package purchases are still recorded, hence purchase history remains.

Evidence: no `cardNumber` / `cvv` / `cardHolder` in live code (the only occurrences in
`app/(app)/(provider)/wallet.tsx` are inside a disabled comment block, lines 889–1095);
`fundSomeonesWallet`, `wallet2Wallet` and `withdrawal` return Not Implemented.

> Consequence: the app is out of PCI DSS SAQ D and back to SAQ A. If card fields are ever
> reintroduced, this declaration and the PCI position both change.

### Health and fitness

| Sub-type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| **Health info** — ailment category, free-text symptoms, consultation records, prescriptions, uploaded medical images | Yes | Yes — the provider consulted; **Stream.io** carries live consultation audio and video | Required | App functionality |
| Fitness info | No | — | — | — |

Evidence: `createRequest` in `lib/socket.ts` (`ailmentCategory`, `symptoms`,
`consultationMode`), `lib/prescription.ts`, `/app/prescription/pharmacist/all`,
`app/(app)/(patient)/ailments.tsx`, `recent-activities.tsx`.

> Highest-scrutiny category. Health data must never be used for advertising, and the privacy
> policy must specifically address health data handling and retention.

### Photos and videos

| Sub-type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| Photos | Yes — profile image, support-ticket attachments, ID document front and back, qualification and HPCNA certificates | Partly — credential images to verification staff | Optional (profile) / Required (provider credentials) | App functionality, Account management, Fraud prevention |
| Videos | Yes — live consultation video | Yes — **Stream.io** relays the WebRTC stream | Required for video consultations | App functionality |

Evidence: `expo-image-picker`, `expo-document-picker`, `CAMERA` permission,
`/app/auth/upload-profile-image`, `/app/auth/update-id-front`, `/app/auth/update-id-back`,
`/app/auth/upload-hpcna-certificate`, `/app/auth/update-primary-qualification`;
`@stream-io/video-react-native-sdk`.

> If consultation video and audio are **not recorded or stored**, declare them as
> **processed ephemerally** — a materially better card for users. Confirm recording is off in
> the Stream.io dashboard before relying on this.

### Audio

| Sub-type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| Voice or sound recordings | Yes — live consultation audio | Yes — Stream.io | Required for consultations | App functionality |
| Music / other audio files | No | — | — | — |

Evidence: `RECORD_AUDIO`, `@config-plugins/react-native-webrtc`. Mark **ephemeral** if calls
are not recorded.

### Files and docs

| Sub-type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| Files and docs | Yes — provider certificates, prescription documents | Yes — verification staff, pharmacists | Required for providers | App functionality, Fraud prevention |

Evidence: `expo-document-picker`, `/app/auth/update-prescribing-certificate`.

### Messages

**Do not declare.** `lib/socket.ts` emits and handles only request-lifecycle events —
`createRequest`, `acceptRequest`, `rejectRequest`, `cancelRequest`, `updateRequestStatus`,
`updateProviderLocationRealtime`, `requestStatusChanged` and similar. There are no message
events and no chat UI anywhere in `app/` or `components/`.

Re-check if in-app chat is ever added.

### App activity

| Sub-type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| App interactions | Yes — consultation history, request history, notification read state | No | Required | App functionality |
| In-app search history | No | — | — | — |
| Installed apps | No | — | — | — |
| Other user-generated content | Yes — support tickets (title, description, image) | No | Optional | App functionality, Customer support |
| Other actions | No | — | — | — |

Evidence: `/app/requests/my-history`, `/app/notification/mark-as-read`,
`/app/issue/create-issue`.

### App info and performance

**Do not declare any sub-type.** Nothing in this category leaves the device.

| Sub-type | Collected | Reason |
|---|---|---|
| Crash logs | No | No Crashlytics or Sentry in `package.json` |
| Diagnostics | No | `lib/viewErrorLogger.ts` and `lib/networkTest.ts` write to `console` only — there is no upload endpoint |
| Other app performance data | No | — |

`google-services.json` is present for **FCM messaging only** — there is no `firebase-analytics`
or `firebase-crashlytics` dependency. Adding either, or uploading error logs to the backend,
changes this section to "Diagnostics: collected".

### Device or other IDs

| Sub-type | Collected | Shared | Required | Purposes |
|---|---|---|---|---|
| Device or other IDs | Yes — FCM/Expo push token, device model and OS via `expo-device` | Yes — Google (FCM) and Expo push as delivery infrastructure | Required for notifications | App functionality |

Evidence: `lib/pushNotifications.ts`, `/app/auth/update-push-token`, `expo-server-sdk`,
`POST_NOTIFICATIONS`.

### Do not declare

- **Contacts / Calendar** — no permissions requested, no APIs used
- **Web browsing history** — `expo-web-browser` and `react-native-webview` open specific URLs;
  browsing history is not collected
- **Bluetooth** — `BLUETOOTH*` permissions serve WebRTC audio routing, not data collection

---

## Part 3 — Third-party recipients to name in the privacy policy

| Recipient | What it receives | Role |
|---|---|---|
| Kopano Vertex backend (`apihealthconnect.kopanovertex.com`) | All app data | First party / controller |
| **Stream.io** | Live consultation audio and video, call participant IDs | Processor |
| **DPO Pay / PayGate** | Payment amount, transaction reference, and cardholder data entered **on their own hosted page** | Independent controller for payment processing |
| **Google Maps Platform** | Precise coordinates for geocoding and map tiles | Processor |
| **Google Firebase Cloud Messaging** | Push token, notification payloads | Processor |
| **Expo push service** | Push token, notification payloads | Processor |

Confirm a data processing agreement is in place with each — particularly Stream.io, which
carries consultation audio and video.

---

## Part 4 — Other Play Console sections triggered by this app

| Section | Why | Action |
|---|---|---|
| **Health apps declaration** | Telehealth / medical consultation | Declare; expect questions on provider licensing and clinical oversight |
| **Financial features** | Paid consultation packages via DPO Pay | Declare. The in-app wallet is disabled, which narrows this — do not declare wallet or money-transfer features while they return Not Implemented |
| **Sensitive permissions** | `SYSTEM_ALERT_WINDOW` for the in-call overlay | Be ready to justify; Play scrutinises overlay use. Consider whether it is genuinely needed |
| **Photo and video permissions** | `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` (both maxSdk 32), `CAMERA`, image picker | Use the Android 13+ Photo Picker so no broad media permission is needed |
| **Target audience and content** | Health, payments and ID collection | Rate **18+** |
| **Data deletion URL** | Play policy | Blocker 3 |

---

## Verification checklist

- [x] Cleartext HTTP denied in release builds
- [x] DPO credentials removed from the app bundle
- [ ] PayGate encryption key rotated with DPO
- [ ] `EXPO_PUBLIC_DPO_*` removed from the working `.env`
- [ ] Real account **deletion** implemented in-app
- [ ] Public deletion URL live and reachable without login
- [ ] Retention periods confirmed with HPCNA / legal advice
- [ ] Privacy policy written, hosted, and its URL entered in Play Console
- [ ] Confirmed whether Stream.io call recording is off → set ephemeral flags accordingly
- [ ] Google Maps API key restricted to package + release SHA-1, and rotated
- [ ] Health apps declaration completed
- [ ] Financial features declaration completed
- [ ] Content rating questionnaire completed at 18+
- [ ] Declaration read side by side with the store listing card preview

---

## Appendix A — Corrections to the previous version

The earlier `PLAY_DATA_SAFETY.md` (30 July 2026) contained the following errors, all verified
against the source:

1. **Card data flow was wrong.** It stated card details went "your backend, then DPO Pay". The
   raw card number, expiry and CVV were POSTed to `fundSomeonesWallet`, which validated them
   and then **never used them** — no processor call was ever made. They never reached DPO.

2. **The cleartext fix was aimed at the wrong file.** It pointed at the generated
   `network_security_config.xml`. That file is rewritten from a hardcoded string in
   `plugins/withNetworkSecurityConfig.js` on every prebuild, so edits there are silently lost.

3. **Blocker 6 was left as an open question** when it is answerable, and the answer is that no
   action is needed — see Part 0.

4. **It cited only the patient deactivate call.** The provider profile has an identical one.

5. **It referenced two documents that do not exist** — `PRIVACY_POLICY.md` and
   `PLAY_COMPLIANCE_GAPS.md`, cited for blockers B2 and H2.

6. **It never examined the backend**, where the more serious issues were: an unverified
   payment endpoint, non-expiring tokens, an unauthenticated endpoint returning every
   transaction with user names and emails, and an unauthenticated Socket.IO layer.
