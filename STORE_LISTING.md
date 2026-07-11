# Mutual — Store Listing

Copy-paste source for Google Play Store and Apple App Store submissions.
**Fill in the `TODO` fields before submitting.**

---

## App identity (both stores)

| Field | Value |
|---|---|
| App name | **Mutual** |
| Subtitle / tagline | **See who's really with you on Instagram** |
| Developer name | Nuhaadh Hasn |
| Developer email | nuhaadh9991@gmail.com |
| Privacy policy URL | https://nuhaadhhasn.github.io/mutual-instagram-tracker/privacy-policy.html |
| Bundle ID (iOS) | `com.nuhaadh.mutual` |
| Package name (Android) | `com.nuhaadh.mutual` |
| Version | 1.0.0 |
| Category | Social / Utilities |
| Content rating | Everyone / 4+ |
| Pricing | Free |
| In-app purchases | None |
| Ads | None |

---

## Short description (80 chars max — Play Store)

```
Find who unfollowed you. 100% private. No login. Everything stays on your phone.
```

Character count: 79 ✓

---

## Promo text (170 chars max — App Store, editable anytime)

```
See who really follows you back. Mutual reads your Instagram data export on your phone — no login, no servers, no tracking. Track follower changes over time.
```

---

## Full description (4000 chars max)

```
Mutual is the privacy-first way to find out who follows you back on Instagram.

How it works
You export your Instagram data the way Instagram already lets you (Settings → Accounts Center → Your information → Download your information). You hand the ZIP to Mutual. Everything else happens on your phone — instantly, offline, and without ever signing in.

What you get
• Unfollowers — everyone you follow who doesn't follow you back, with search and sort
• Fans — everyone who follows you that you don't follow back
• Dashboard — followers, following, mutual, fans at a glance, with a follow-back ratio
• Analytics — visual breakdowns: donut, follow-back ring, bar chart, trend over time
• History — every time you import a fresh ZIP, Mutual saves a snapshot. Watch how your followers change week over week, month over month
• Whitelist — long-press anyone to hide them from your unfollowers list (great for celebrities, brands, news accounts you follow on purpose)
• Multiple accounts — track personal, business, and side accounts in one app, each with its own data; switch any time
• Share your stats — turn your numbers into a clean story or square image to post anywhere (only your totals are shown — never your follower list)
• Dark mode — light / dark / system
• Smart CSV export — export any list, filtered by recency or what's on screen, to a CSV you can open in Excel / Google Sheets, with optional privacy-hashed usernames
• Backup — export your entire app state to a JSON file (optionally passphrase-encrypted) and restore it on a new phone

Why "privacy-first" is not marketing fluff
• No login. Mutual never asks for your Instagram password
• No servers. The app makes zero network requests — disconnect your phone if you don't believe us
• No analytics. We have no idea how many people use Mutual, and we like it that way
• No tracking. No advertising IDs, no fingerprinting, no nothing
• Everything stored on-device. Uninstall the app and your data is gone
• Open source. The code is there if you want to verify any of this

Why ZIP import instead of "just log in"?
Because logging in is how unfollower apps get user accounts banned. Mutual will never automate anything on your Instagram account. The data export Instagram already provides is the safe path — and it works.

Made for people who care about their privacy and want real numbers, not estimates. Free forever, no ads, no upsells.
```

---

## Keywords (App Store — 100 chars total, comma-separated)

```
unfollowers,instagram,tracker,follower,unfollow,fans,analytics,private,offline,who unfollowed me
```

---

## What's new (release notes — 500 chars max)

```
First release of Mutual.

• Import your Instagram data export to see who doesn't follow you back
• Fans list, analytics dashboard, history tracking
• Multiple accounts — track more than one Instagram in the app
• Share your stats as a story or square image (numbers only, no usernames)
• Whitelist accounts, filtered CSV export, backup & restore
• Light / dark mode
• 100% private — runs entirely on your device

Feedback is welcome at nuhaadh9991@gmail.com.
```

---

## Required image assets

Generate these by running the app on a device and using OS screenshot. Naming below for clarity — store dashboards rename on upload.

### Google Play Store

| Asset | Size | Status | Source |
|---|---|---|---|
| App icon | 512×512 PNG | ✓ DONE | `docs/store/play-icon-512.png` (generated from `assets/icon.svg`) |
| Feature graphic | 1024×500 PNG | ✓ DONE | `docs/store/feature-graphic.png` (Two Linked Rings + "Mutual — see who's really with you") |
| Phone screenshots (min 2, max 8) | 1080×1920 portrait | TODO | recapture clean from preview APK (existing `docs/screenshots/` may have device frame/usernames) |
| 7-inch tablet (optional) | — | skip | |
| 10-inch tablet (optional) | — | skip | |

### Apple App Store

| Asset | Size | Status |
|---|---|---|
| App icon | 1024×1024 PNG (no transparency, no rounded corners — Apple masks) | TODO — `assets/icon.png` already 1024 |
| iPhone 6.7" screenshots (iPhone 15 Pro Max, min 3) | 1290×2796 | TODO |
| iPhone 6.5" screenshots (legacy, min 3) | 1242×2688 | TODO |
| iPad 12.9" screenshots (only if you ship for iPad) | 2048×2732 | skip — supportsTablet: false |

### Recommended screenshot sequence (both stores)

1. **Dashboard hero** — the stat grid + ratio bar (shows the value proposition immediately)
2. **Unfollowers list** — the main feature with a few rows visible
3. **Analytics donut + bar chart** — visual depth
4. **History trend chart** — differentiator vs competitors
5. **Privacy callout** — Settings screen with the green "100% Local Storage" card visible (proof of the privacy claim)
6. **Onboarding slide 1** — the welcome screen with the Two Linked Rings (brand)
7. **Share card** — the shareable stat-image preview (showcases the share-your-stats feature; numbers only, no usernames)

For each screenshot you can add a caption strip on top (free tools: figma.com, mockuphone.com) — short benefit line in 4 words or fewer.

---

## Submission checklist

### Google Play
- [ ] Developer account created (one-time $25)
- [ ] App created in Play Console
- [ ] All store-listing fields filled (use copy above)
- [ ] Icon 512×512 + feature graphic 1024×500 uploaded
- [ ] At least 2 phone screenshots uploaded
- [ ] Privacy policy URL pasted into "Privacy policy" field
- [ ] Content rating questionnaire completed
- [ ] Data safety form completed — answer "no data collected" everywhere
- [ ] App content questionnaire (target audience, ads, government app, etc.)
- [ ] AAB uploaded from `eas build --platform android --profile production`
- [ ] Internal testing → closed testing → production track

### Apple App Store
- [ ] Apple Developer account active ($99/year)
- [ ] App created in App Store Connect
- [ ] All store-listing fields filled
- [ ] App icon 1024×1024 uploaded
- [ ] At least 3 6.7" + 3 6.5" screenshots uploaded
- [ ] Privacy policy URL pasted
- [ ] App Privacy questionnaire — answer "no data collected"
- [ ] Export compliance: standard cryptography only (HTTPS via OS)
- [ ] Build uploaded via `eas submit --platform ios`
- [ ] TestFlight → review submission

---

## Notes

- **Don't use "Instagram" in the app name.** Meta will reject it. "Mutual" stays away from this entirely.
- The Data Safety / Privacy questionnaire is where reviewers compare your claims to your code. Since Mutual really does no networking and stores everything locally, the answers are all "no, none, doesn't apply" — keep it that way to avoid future grief.
- First reviews typically take 1–3 days (Play) and 24–48 hours (App Store).
