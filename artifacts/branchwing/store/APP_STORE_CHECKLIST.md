# Branchwing → App Store Submission Checklist

Everything technical on the Branchwing side is ready. The remaining
steps require **your** Apple and Expo accounts. Here's the exact
sequence.

---

## 1. Accounts you need (≈30 min, ~$99/yr)

- [ ] **Apple Developer Program** — $99/year. Sign up at
  https://developer.apple.com/programs/. Use the same Apple ID you'll
  use for App Store Connect.
- [ ] **Expo account (free)** — sign up at https://expo.dev/. EAS Build
  has a free tier that's enough for a few production builds per month.

## 2. One-time configuration in this repo

After you have both accounts, fill in three placeholders:

### `artifacts/branchwing/eas.json` → `submit.production.ios`

```json
"appleId":   "you@example.com",          // your Apple ID
"ascAppId":  "1234567890",               // App Store Connect "Apple ID" of the app
"appleTeamId": "ABCDE12345"              // 10-char Team ID from developer.apple.com
```

### `artifacts/branchwing/app.json` → `extra.eas.projectId`

This is filled in automatically the first time you run `eas init`.

### `artifacts/branchwing/store/STORE_LISTING.md` → support URL

Replace the placeholder with your real support page or GitHub repo URL.

## 3. Bundle identifier

Currently set to `com.branchwing.app` in `app.json`. You can keep that
or change it before your first build. **Once submitted to App Store
Connect, the bundle identifier cannot be changed for that app.**

## 4. Build & submit (from your local machine, not Replit)

EAS Build runs on Expo's cloud servers but is triggered from a local
checkout. From the artifact directory:

```bash
cd artifacts/branchwing

# 1. Log in to Expo (uses npx so no global install needed)
npx eas-cli@latest login

# 2. Initialize the EAS project (fills in app.json projectId)
npx eas-cli@latest init

# 3. (First time only) Register the bundle ID with Apple and create
#    signing credentials. EAS walks you through it interactively.
npx eas-cli@latest credentials

# 4. Build a production .ipa for the App Store
npx eas-cli@latest build --platform ios --profile production

# 5. Submit the resulting build to App Store Connect / TestFlight
npx eas-cli@latest submit --platform ios --latest
```

The first build takes ~20–40 minutes. Subsequent builds are faster.

## 5. App Store Connect setup (one-time)

While EAS is building:

- [ ] Go to https://appstoreconnect.apple.com → My Apps → "+"
- [ ] Bundle ID: `com.branchwing.app`
- [ ] SKU: `branchwing-ios-001` (anything unique to you)
- [ ] Primary language: English (U.S.)
- [ ] Paste fields from `store/STORE_LISTING.md`
- [ ] Upload screenshots (see required sizes in STORE_LISTING.md)
- [ ] Fill out App Privacy → "We do not collect data from this app"
- [ ] Set pricing → Free
- [ ] Add the app icon (1024×1024 — already in `assets/images/icon.png`)

## 6. TestFlight (recommended before public release)

Once `eas submit` finishes:

- [ ] App Store Connect → TestFlight → enable internal testing
- [ ] Add yourself + a couple of friends as internal testers
- [ ] Smoke test on real devices for ≥ 24 hours

## 7. Submit for App Review

When TestFlight feels good:

- [ ] App Store Connect → your app → "+ Version" → 1.0
- [ ] Select the TestFlight build you uploaded
- [ ] Add review notes: "No login required. Browse Routes from the
      home tile to see the popular routes feature."
- [ ] Submit for Review

Apple typically reviews within 24–48 hours.

## Likely review questions / pre-empted objections

| Concern                           | What we did                                   |
| --------------------------------- | --------------------------------------------- |
| Synthetic flight data             | App is a planning sketchbook, not a booking   |
|                                   | engine. Disclosed in description.             |
| Permissions never prompted        | Usage strings in `Info.plist` are accurate    |
|                                   | and only fire if user opts into the feature.  |
| App Privacy form                  | Truly nothing collected — straightforward.    |
| iOS 17+ Privacy Manifest          | `NSPrivacyAccessedAPITypes` declared in       |
|                                   | `app.json` for AsyncStorage etc.              |
| Encryption export compliance      | `ITSAppUsesNonExemptEncryption: false` set.   |
| Account deletion (Guideline 5.1.1)| No accounts exist; nothing to delete.         |

## What still needs your decision

- **App icon refresh?** Current icon is 1024×1024 RGB (App Store
  compliant). If you want a polished branded icon, generate one and
  drop it in at `assets/images/icon.png`.
- **Support URL** — Apple requires a working URL. A GitHub repo README
  is fine.
- **Marketing site** — optional but helps approval.
- **Real backend later** — `services/api.ts` is set up to swap to a
  Netlify/Amadeus proxy via `EXPO_PUBLIC_API_BASE` without code changes
  in the UI. Not required for v1.
