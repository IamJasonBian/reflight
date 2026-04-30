# Branchwing — App Store Connect Listing

Copy/paste these fields into App Store Connect when you create the listing.

---

## App Name (max 30 chars)

`Branchwing: Trip Branching`

## Subtitle (max 30 chars)

`Fork your travel plans`

## Promotional Text (max 170 chars, editable any time)

`Sketch a trip, then fork it into every "what if" route. Compare branches side-by-side, browse popular routes, and watch 90-day price trends.`

## Description (max 4000 chars)

```
Branchwing is a flight planning sketchbook for people who can't decide.

Plan a trip. Fork it. Then fork the fork. Every alternate routing is its
own visual branch on a clean iOS-style timeline, so you can compare a
3-stop dream itinerary against a 1-stop quick hit at a glance.

— BRANCH YOUR TRIP —
Build a base itinerary, then split it at any segment to explore an
alternate route. Each branch has its own color, name, and price total.
Switch between them with one tap.

— BROWSE POPULAR ROUTES —
Ten hand-picked transcontinental routes (JFK → LHR, SFO → HND, LAX → SYD,
and more) with current price, 90-day price history charts, and trend
indicators so you know whether to book now or wait.

— PRICE TRENDS —
Smooth 90-day price history charts on every route. See lowest, average,
and highest fares with deterministic, reproducible synthetic data — great
for planning conversations and demos.

— ITINERARY MATH —
Branch totals, branch ranges, segment counts, and city counts roll up
automatically. Save routes you care about for one-tap return visits.

— BUILT FOR iOS —
Native segmented controls, smooth spring sheets, haptic feedback, dark
midnight palette, and Inter typography throughout. Designed to feel like
something Apple would ship.

PRIVACY: Branchwing stores everything on your device. No accounts, no
servers, no tracking, no analytics, no ads.
```

## Keywords (max 100 chars, comma-separated)

`flight,travel,itinerary,trip,planner,branch,fork,fares,price,airport`

## Support URL

`https://github.com/YOUR_HANDLE/branchwing` (or your support page)

## Marketing URL (optional)

(leave blank or your landing page)

## Primary Category

`Travel`

## Secondary Category (optional)

`Productivity`

## Age Rating

`4+` (no objectionable content; nothing to declare)

## Pricing

`Free` (no in-app purchases for v1)

---

## Required Screenshots

App Store Connect requires screenshots in these sizes. Capture from the
iOS simulator or a real device:

| Device                     | Size       | Required? |
| -------------------------- | ---------- | --------- |
| iPhone 6.9" (15/16 Pro Max)| 1320×2868  | Yes       |
| iPhone 6.5" (XS Max / 11)  | 1242×2688  | Yes       |
| iPad 13" (M4)              | 2064×2752  | If iPad   |

Suggested capture flow (one screenshot each):

1. **Home** with "Browse popular routes" tile and a sample trip card.
2. **Routes dashboard** at `/routes` — the popular flights list.
3. **Route detail / Flights today** at `/route/JFK-LHR`.
4. **Route detail / Price trends** — segmented control switched.
5. **Trip detail** with branches and the timeline.
6. **Fork branch** modal (the differentiator).

## App Privacy (required questionnaire)

In App Store Connect → App Privacy, declare:

- Data Collection: **No, we do not collect data from this app.**
- Tracking: **No.**
- Third-Party SDKs: none collecting user data.

(All Branchwing data lives in on-device AsyncStorage / localStorage.)

## Encryption

Already declared in `app.json`:
`ITSAppUsesNonExemptEncryption: false` — Branchwing only uses standard
HTTPS (none today, but future-proofed). No custom or proprietary crypto.

## Export Compliance

`usesNonExemptEncryption: false` is set so you do **not** need to upload
an export compliance document.
