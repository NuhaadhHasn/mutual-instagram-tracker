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

The four new screens (Followers / Following / Mutual / Fans) all run on the **same generic component** (`UsersListScreen`). One bug fix anywhere fixes it for all of them.

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

### Animations + haptics (need a physical device, simulator won't vibrate)
- [ ] Import success → success vibration
- [ ] Long-press in any list → medium vibration before selection mode kicks in
- [ ] Tap any Dashboard stat card → light tap
- [ ] Clear All Data / Clear History → heavy vibration on confirm
- [ ] Onboarding Next button → light tap
- [ ] Splash → onboarding transition: no white flash (expo-splash-screen API)

### Known performance ceiling
The app currently feels **kinda slow** on heavy lists/screens. Known and tracked in `IMPROVEMENTS.md` C15e. Acceptable for testing right now, but if any specific interaction stutters badly (>500ms freeze), screenshot it and we'll fix that one first.

If any of these doesn't behave, screenshot the issue or copy the error message and we'll iterate.

---

## Step 4 — Build a real APK with EAS

Only do this once Expo Go testing passes. The APK is a real installable Android app that doesn't need Expo Go to run.

```powershell
cd "C:\Users\nuhaa\instagram Followers\instagram-tracker"
eas build:configure
```

`eas build:configure` will create an `eas.json` file at the project root (one-time setup) and add your project's `extra.eas.projectId` to `app.json`. Then:

```powershell
eas build --platform android --profile preview
```

- This uploads your code to Expo's build servers
- They produce a `.apk` file
- It prints a URL and a QR code when done (~5–10 min)
- Open the URL on your Android phone, download the APK, install it
- (Android may warn about "install from unknown source" — allow it)

The "preview" profile produces an APK suitable for sideloading and sharing with friends. When it's time to submit to the Play Store, you'll switch to `--profile production` which builds an AAB (Android App Bundle) instead.

---

## Step 5 — When you're ready to submit to Play Store

```powershell
eas build --platform android --profile production    # produces AAB
eas submit --platform android                        # uploads to Play Console
```

You'll also need (one-time):
- Google Play Developer account ($25 one-time)
- Privacy policy URL (the contents of `PRIVACY_POLICY.md` hosted publicly — GitHub Pages or a Notion page is fine)
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
| Regenerate icons from SVG | `npm run gen-icons` |
| Build preview APK | `eas build --platform android --profile preview` |
| Build production AAB | `eas build --platform android --profile production` |
| Submit to Play Store | `eas submit --platform android` |
| Who am I (EAS) | `eas whoami` |
