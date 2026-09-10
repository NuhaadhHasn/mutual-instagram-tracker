# Privacy Policy for Mutual

**Effective date:** 2026-07-12
**Last updated:** 2026-09-10

---

## Summary

Mutual is a privacy-first app — on Android, and in a web browser — that helps you see who follows you back on Instagram. It runs entirely on your own device. We do not collect, store, or transmit any personal data to any server. There is no account, no login, no analytics, and no tracking.

If that's all you needed to know, you can stop reading.

---

## What data does Mutual touch?

When you choose to import your Instagram data export ZIP, Mutual reads two files inside it on your device:

- `followers_1.json` — the list of accounts that follow you
- `following.json` — the list of accounts you follow

From those files the app computes:
- Who doesn't follow you back (Unfollowers)
- Who follows you that you don't follow back (Fans)
- Statistics (counts, ratios)
- Historical snapshots of those numbers (only if you import more than once)

All of this is held in your device's local storage (AsyncStorage). It never leaves your phone.

## What data does Mutual NOT touch?

- Your Instagram password (the app never asks for it)
- Your Instagram session, cookies, or any other authentication
- Any account on Instagram other than the one(s) whose data export you provided
- Any contacts, photos, location, microphone, or device identifiers
- Any analytics, crash reports, or telemetry — Mutual does not send any of this anywhere

## Network usage

The Android app makes no network requests at all — the `INTERNET` permission is stripped from its manifest, so it is not merely written to avoid the network but structurally unable to reach it. The only network behaviour is when you deliberately tap a username, which opens that account's public Instagram profile in your browser or the Instagram app. That is a normal `Linking.openURL` call — Mutual does not communicate with Instagram itself.

The **web demo** works the same way once it is open, but loading it is itself a request: your browser downloads the app's files from GitHub Pages, and GitHub records that request (including your IP address) in its own server logs, exactly as it would for any website. We do not receive, see, or store those logs, and there is no analytics or tracking script on the page. After the page has loaded, your Instagram export is opened, parsed and saved inside your own browser, nothing about it is ever uploaded, and it keeps working with the network disconnected. If you would rather not load anything from a server at all, the release includes a bundle you run from your own machine.

## Data storage and deletion

All app data is stored locally on your device — in AsyncStorage on Android, and in your browser's own IndexedDB database (named `mutual`) on the web — under these keys:

- `@instagram_tracker:follower_data` — your imported follower/following data
- `@instagram_tracker:whitelist` — accounts you've hidden from your unfollowers list
- `@instagram_tracker:unfollowed` — accounts you've marked as unfollowed
- `@instagram_tracker:history` — snapshots of your past imports
- `@instagram_tracker:accounts` and `@instagram_tracker:current_account` — the Instagram accounts you track in the app and which one is active
- `@instagram_tracker:theme`, `@instagram_tracker:onboarding_done`, and a few small preference flags (e.g. screenshot blocking, app lock)
- `@instagram_tracker:widget_enabled` and `@instagram_tracker:widget_summary` (Android only) — whether the home-screen widget is on, and the aggregate counts it displays. The widget stores **counts only, never usernames**, because a widget stays visible while the app is locked
- `@instagram_tracker:at_rest_master_key_v1` (web only) — the encryption key, present only if you turn on "Encrypt data at rest". It is stored as a key object your browser will not let any script read the raw bytes of, or, if you choose a passphrase, as a blob that cannot be unlocked without it

If you track more than one Instagram account, each account's data is stored separately on your device under this same scheme. You can delete everything for the active account from Settings → Clear All Data, delete a whole account from Settings → Accounts, or remove all of it by uninstalling the app.

On the web the same data is bound to that browser on that computer: another browser, another device, or a private window sees nothing. Clearing your browser's site data for the domain erases it completely.

**Encryption at rest** is optional on both platforms and off by default. On Android the key lives in the device's hardware-backed keystore. In a browser there is no keystore, so the key is either kept in a form no script can read the bytes of — which stops the data being readable text in storage, but does not protect it from someone using your computer — or, if you choose a passphrase, wrapped with that passphrase so the stored data is useless without it. Settings states which of these you are getting before you turn it on. A lost passphrase cannot be recovered by anyone, including us.

You can also export everything to a JSON file from Settings → Export app state, and restore from one later. This is for your own convenience — nothing is uploaded.

## Sharing

Mutual does not share any data with anyone. There are no third parties involved.

The CSV export feature uses your device's built-in share sheet. The file Mutual produces is saved to your device first; whether you then send it via email, AirDrop, messages, etc. is entirely your choice, and that data is handled by whichever app you pick — not by Mutual.

The "share your stats" feature works the same way: Mutual renders an image of your aggregate numbers only (followers, following, mutual, fans, follow-back ratio) — it never includes your follower list or any usernames — and hands that image to your device's share sheet for you to post or send wherever you choose.

## Children

Mutual is not directed at children under 13. We do not knowingly collect any data from anyone (we don't collect data at all), but Instagram's own terms of service set their own minimum age.

## Changes to this policy

If the privacy policy changes, the "Last updated" date at the top of this document will change. Since the app does not phone home, there is no way for us to notify you of policy changes; check this page when you update the app.

## Contact

Questions, concerns, or feedback:

**Email:** nuhaadh9991@gmail.com
**GitHub Issues:** https://github.com/NuhaadhHasn/mutual-instagram-tracker/issues

---

## Legal disclaimer

Mutual is not affiliated with, endorsed by, or sponsored by Instagram or Meta Platforms, Inc. Instagram is a trademark of Meta Platforms, Inc. This app reads the official data export Instagram provides to its users; it does not interact with Instagram's API or services.
