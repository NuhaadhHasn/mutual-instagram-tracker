# Testing Mutual on your phone

You've got Expo Go installed and you're already logged into EAS (`eas whoami` → `nuhaadhhasn`). Here's the full picture.

---

## What "Expo Go" vs "EAS" actually means

**Expo Go** is a free app on the App Store / Play Store. It's a *runtime* — a pre-built shell that can load any Expo project over the air from your development machine. When you scan the QR code, Expo Go downloads your JavaScript bundle from your machine and runs it. **Fast feedback loop for development. No build step.**

**EAS (Expo Application Services)** is Expo's *cloud build* service. It takes your project, compiles a real native APK (Android) or IPA (iOS) on their servers, and gives you a downloadable file. This is what you'd send to the Play Store or to a friend. **Slower (5–10 min per build), but produces a real shippable app.**

**Order to use them in:**
1. Develop and test in Expo Go (free, instant)
2. When happy, run EAS to produce an APK
3. Test the APK
4. Submit the APK to the Play Store

---

## Step 1 — Fix the directory mistake first

You ran `npx expo` from `C:\Users\nuhaa\instagram Followers>`. That's the **root folder**, where there's no Expo project. That's why it tried to install `expo@56.0.4` globally — it had no local `package.json` with Expo in it.

The actual project lives one level down in `instagram-tracker/`. **Always `cd` in first:**

```powershell
cd "C:\Users\nuhaa\instagram Followers\instagram-tracker"
```

From now on, every command in this guide assumes you're in that directory.

---

## Step 2 — Start the dev server, scan with Expo Go

```powershell
cd "C:\Users\nuhaa\instagram Followers\instagram-tracker"
npx expo start -c
```

The `-c` flag clears Metro's cache, which is required this time because we added `babel.config.js` (reanimated needs it) and changed the icon set. You can drop `-c` on subsequent runs.

What you'll see:
- Metro will boot, print a QR code in the terminal
- A pink/black-themed dev tools page may also open in your browser

**On your phone:**
- **Android:** Open Expo Go → tap "Scan QR code" → point at the terminal QR
- **iOS:** Open the Camera app → point at the QR → tap the Expo notification (or open Expo Go and use its scanner)

Your phone and your PC need to be on the **same Wi-Fi network**. If they aren't, the bundle won't load. If your Wi-Fi blocks device-to-device traffic (corporate / hotel networks), use a phone hotspot or run with `npx expo start --tunnel` (slower, but works through anything).

The app will load on your phone within ~30 seconds the first time. Subsequent reloads are seconds.

---

## Step 3 — What to actually test

Run through this checklist on the phone. If anything breaks, copy the red error overlay and we'll fix it.

### Rebrand
- [ ] App shows up as **Mutual** in Expo Go's project list (not "Instagram Unfollowers Tracker")
- [ ] First slide of onboarding shows the Two Linked Rings icon
- [ ] Settings → app icon row shows the infinite / linked-rings glyph
- [ ] Splash background is pink

### Onboarding (only on fresh install)
- [ ] 4 slides appear: Welcome → Privacy → How → Ready
- [ ] **Next** advances; **Skip** jumps straight to main app
- [ ] After "Get started", the app remembers and never shows onboarding again
- [ ] Slide content animates in (icon scales, title + subtitle fade up)

### Main app flow
- [ ] Bottom tabs: Dashboard, Unfollowers, Analytics, Import, Settings
- [ ] Cold launch shows skeleton placeholders for ~100ms then animates real data in
- [ ] Pull down on **every** tab to refresh (you should see a pink spinner)
- [ ] Dashboard Fans card → opens FansScreen with back arrow
- [ ] Analytics → Trend card at bottom → tap → opens History
- [ ] Settings → Clear History → custom destructive confirm (orange, time icon)
- [ ] Settings → Clear All Data → custom destructive confirm → wipes everything → bounces to Import

### Bug fixes shipped this round
- [ ] **Dashboard stat cards now span 50% width** in a 2-2-1 grid (no more pencil-thin cards)
- [ ] **Status bar text is readable on every screen** — white on gradient heroes, dark on Unfollowers/Settings light card sections

### All Dashboard cards clickable
Tap each card on the Dashboard — every one opens its dedicated list with a light haptic on press.
- [ ] **Followers** card → opens a Followers list with search + sort + share
- [ ] **Following** card → opens Following list
- [ ] **Unfollowers** card → opens existing Unfollowers tab
- [ ] **Mutual** card → opens Mutual list (people who follow each other)
- [ ] **Fans** card → opens Fans screen

Followers / Following / Mutual all run on the **same generic component** (`UsersListScreen`) — one fix there covers those three. **Fans is a separate screen** (`FansScreen`, routed at `App.tsx:148`), so it has to be fixed and tested separately.

### Multi-select (Unfollowers + all 4 new list screens)
- [ ] **Long-press any user** → enters selection mode + medium-vibration haptic + that user gets a pink border
- [ ] **Tap other users while in selection mode** → toggles their selection (avatars swap to checkboxes)
- [ ] Header morphs to "**N selected**" instead of the screen title
- [ ] **"Select all visible"** button (double-checkmark icon, top-right) → marks every user in the current filtered list
- [ ] Bulk **Whitelist** button (green) → adds all selected to whitelist + success modal "N users added"
- [ ] Bulk **Mark unfollowed** button (pink) → adds all selected to unfollowed list + success modal
- [ ] "Already in list" guard: if everyone you select is already in that category, you get a "Nothing to add" alert instead
- [ ] Selection clears after bulk action completes
- [ ] **Cancel/X button** (top-left) → exits selection mode without doing anything

### Mark Unfollowed feature (new, parallel to Whitelist)
- [ ] Long-press a user in Unfollowers → enter selection mode → Mark unfollowed → user disappears from list
- [ ] Settings → new **Unfollowed (N)** section shows the user with the date you marked them
- [ ] Tap close-circle in Settings → user reappears in Unfollowers
- [ ] Unfollowers screen subtitle now shows hidden counts: "People you follow who don't follow back · 3 whitelisted · 5 unfollowed"
- [ ] New "**Show unfollowed**" pill (when there are unfollowed users) → toggle to reveal them with a pink person-remove badge
- [ ] Clear All Data wipes the Unfollowed list too
- [ ] Backup JSON includes the Unfollowed list

### New features in this round
- [ ] Settings → **Export full report** → OS share sheet opens with `mutual-full-report_*.csv`
- [ ] Unfollowers / Fans / Followers / Following / Mutual headers → share icon → OS share sheet with CSV
- [ ] Settings → **Export app state** → JSON file shareable (now includes the Unfollowed list)
- [ ] Settings → **Restore from backup** → file picker → pick the JSON → data + whitelist + unfollowed + history all come back
- [ ] Force-quit the app, reopen → all data + theme + whitelist + unfollowed persist
- [ ] If the app ever crashes from an uncaught render error → pink "Something went wrong" screen with stack + "Try again" button (instead of a blank white screen)

### New in this round — Multi-account · Share image · Filtered export (C8 / C7 / C14)
> Run `npx expo start -c` first — this round added the native `react-native-view-shot` dependency.

**Multiple accounts (C8)**
- [ ] Settings → new **Accounts** section lists your account(s); the active one shows a checkmark + "Active"
- [ ] Dashboard header shows an **account chip** (people icon + name) → tap it → switch sheet with an "Add account" option
- [ ] **Add account** (Settings or the chip) → name it → app switches to the new empty account → lands on Import
- [ ] Import a second ZIP → that data shows; switch back to the first account → its original data is intact (no mixing)
- [ ] **Rename** (⋯ → Rename) updates the name everywhere; **Delete** (⋯ → Delete) appears only with 2+ accounts and never deletes the last one
- [ ] **Clear All Data** clears only the active account; other accounts keep their data
- [ ] Backup / Restore operate on the active account
- [ ] Force-quit + reopen → the last active account is remembered
- [ ] **Upgrade check:** existing single-account data (from before this update) still appears, under "Account 1", with nothing lost

**Share your stats (C7)**
- [ ] Dashboard header → **share-social** button → preview modal of a branded stat card
- [ ] Toggle **Story 9:16** / **Square 1:1** → the card resizes
- [ ] **Share image** → OS share sheet opens with a PNG; the image shows only numbers — no usernames anywhere
- [ ] If it errors with "Native module is null" → you skipped `npx expo start -c` after the new dep landed

**Filtered / smart export (C14)**
- [ ] Any list (Followers / Following / Mutual / Fans / Unfollowers) → share icon → a **scope sheet** appears with counts: Visible now / Everything / Last 7 days / Last 30 days / Hide possible spam
- [ ] Set a search or recency filter first → **"Visible now (N)"** matches what's on screen and exports exactly that subset
- [ ] After scope, the **Plain / Hashed** sheet appears (now on Unfollowers too); Hashed mode blanks the profile-URL column
- [ ] Settings → **Export full report** → asks Everything / Last 7 / Last 30 first, then Plain / Hashed; the CSV header notes the chosen scope

### Animations + haptics (need a physical device, simulator won't vibrate)
- [ ] Import success → success vibration
- [ ] Long-press in any list → medium vibration before selection mode kicks in
- [ ] Tap any Dashboard stat card → light tap
- [ ] Clear All Data / Clear History → heavy vibration on confirm
- [ ] Onboarding Next button → light tap
- [ ] Splash → onboarding transition: no white flash (expo-splash-screen API)

### Performance
The old "feels kinda slow" ceiling is **fixed and measured**. The C15e work all shipped (Zustand selectors, memoized rows, `getItemLayout`, FlashList, inline-component extraction), and C15e-MEASURE ran on a Galaxy S9+ on 2026-09-07: `dumpsys gfxinfo` over the 980-row list recorded **608 frames, 3 janky = 0.49%** (50th 7 ms / 90th 10 ms / 95th 11 ms / 99th 13 ms) with **0 missed vsyncs**, and cold start averaged **1039 ms**. The real 629 KB ZIP parses in **31 ms warm / 157 ms cold**, so C15e-7 (off-thread parse) is closed as NOT NEEDED — the biggest remaining main-thread cost is crypto-js AES (57-83 ms encrypt / 103-141 ms decrypt), and only with encrypt-at-rest on. If a specific interaction still freezes (>500ms), screenshot it and we'll fix that one first.

If any of these doesn't behave, screenshot the issue or copy the error message and we'll iterate.

---

## Step 4 — Build a real APK with EAS

Only do this once Expo Go testing passes. The APK is a real installable Android app that doesn't need Expo Go to run.

> ✅ **Already done — skip `eas build:configure`.** `eas.json` is committed at the project root and `app.json` already carries `extra.eas.projectId` (`1652066d-…`) + `owner: nuhaadhhasn`. `eas login` is done too (`eas whoami` → `nuhaadhhasn`). Go straight to:

```powershell
eas build --platform android --profile preview
```

- This uploads your code to Expo's build servers
- They produce a `.apk` file
- It prints a URL and a QR code when done (~5–10 min)
- Open the URL on your Android phone, download the APK, install it
- (Android may warn about "install from unknown source" — allow it)

The "preview" profile produces an APK suitable for sideloading and sharing with friends. When it's time to submit to the Play Store, you'll switch to `--profile production` which builds an AAB (Android App Bundle) instead.
### C10 home-screen widget (APK only — cannot be tested in Expo Go)

> The native module is guarded in `src/services/widget.ts`; in Expo Go the Settings toggle just shows a "Widget unavailable" dialog. **All of the below needs the preview APK.** Most of it is now device-verified (Galaxy S9+ / Android 10, versionCode 10, 2026-09-08): the `[x]` boxes are proven, the `[ ]` boxes are genuinely still unchecked.

- [x] Settings → Privacy → **Home-screen widget** row exists (between "Encrypt data at rest" and "Import reminders") and is **OFF by default**
- [x] Toggle it ON — no error dialog in a real build
- [x] Long-press the Android home screen → **Widgets** → **Mutual** appears in the picker with a preview image
- [x] Drop the widget (default target is a **4×2** cell) — at that size it renders the hero (unfollowers) + "Mutual" + the account name + the last-updated date, over a three-column row of followers / mutual / fans. **Following and the follow-back % are deliberately not printed there** — `following = mutual + unfollowers`, so the four shown numbers determine all six
- [x] **Grow it past ~255dp tall** → the XL rung adds the **follow-back ratio ring** (inline SVG, % centred inside) with "Follow-back rate / N following" beside it, so all six numbers appear exactly once. Shrink it back and the ring disappears
- [x] **Counts only — no usernames anywhere on the widget** (this is the privacy invariant)
- [x] Import a fresh ZIP → the widget numbers update
- [x] Resize the widget horizontally/vertically → layout stays legible; the type and the inter-tier gap scale with the measured height
- [ ] Switch account (Dashboard chip) → the widget shows the new account's numbers
- [ ] Turn on the app lock (D1) and lock the app → widget still shows its counts (expected: aggregates are safe on a lock screen)
- [ ] **Turn on "Encrypt data at rest" (D2) → the widget must still render.** The `widget_summary` key is deliberately stored in plaintext because the headless render task is a cold JS context with no master key — **a blank widget here is the bug to watch for**
- [ ] Toggle the Settings switch back OFF → the widget stops updating
- [ ] Settings → **Clear All Data** → the widget summary is cleared too

---

## Step 5 — When you're ready to submit to Play Store

```powershell
eas build --platform android --profile production    # produces AAB
eas submit --platform android                        # uploads to Play Console
```

You'll also need (one-time):
- Google Play Developer account ($25 one-time)
- Privacy policy URL — ✅ **already live**: https://nuhaadhhasn.github.io/mutual-instagram-tracker/privacy-policy.html (GitHub Pages, served from `docs/`)
- Screenshots + listing copy (templates in `STORE_LISTING.md`)
- Content rating questionnaire (in Play Console)
- Data safety questionnaire (answer "no data collected" everywhere — it's true)

---

## Common gotchas

**"Native module is null"** in Expo Go → almost always a dep version mismatch. Stop Metro, `npm install`, `npx expo start -c`. If still broken, check `CLAUDE.md`'s "Expo Go pinned" rule — we don't override versions for packages with native code.

**Babel/Reanimated plugin missing** → if you ever see "Reanimated 2 failed to create a worklet", stop Metro and run `npx expo start -c`. The plugin in `babel.config.js` only takes effect after a cache clear.

**QR not connecting** → same-network requirement. Try `npx expo start --tunnel` as a fallback.

**Stale data after code changes** → shake the phone to open the dev menu and tap "Reload". For deeper changes, restart Metro with `-c`.

**Icon didn't update** → run `npm run gen-icons` again, then rebuild the dev client. Expo Go pulls JS hot, but native bundle assets like the launcher icon require a fresh build.

---

## Cheat-sheet of commands

| What | Command (from `instagram-tracker/`) |
|---|---|
| Start dev server | `npx expo start -c` |
| Type-check | `npx tsc --noEmit` |
| Run unit tests | `npm test` (jest — 35 tests / 6 suites) |
| Regenerate icons from SVG | `npm run gen-icons` |
| Build preview APK | `eas build --platform android --profile preview` |
| Build production AAB | `eas build --platform android --profile production` |
| Submit to Play Store | `eas submit --platform android` |
| Who am I (EAS) | `eas whoami` |
