# Prototype — where Mutual started

Two Python scripts from **2025-11-28**, written before the app existed. They are kept for provenance: this is the
idea Mutual grew out of, and the core logic is recognisably the same one the app runs today.

| File | What it did |
|---|---|
| `find_unfollowers.py` | Read `followers_1.json` and `following.json` out of an unzipped export, diffed the two sets, printed who doesn't follow back and wrote `unfollowers_list.txt` |
| `create_pdf.py` | Rendered the same result as a PDF report |

## What survived into the app

The set-difference at the heart of `find_unfollowers.py` is still the app's core operation — it lives in
[`src/services/parsers/computeFollowerData.ts`](../src/services/parsers/computeFollowerData.ts), unit-tested, and
is shared by both the ZIP parser and the storage migration. The parsing quirks it discovered are still true and
still handled: followers are a bare array under `string_list_data`, following is nested under
`relationships_following`, and profile links arrive in Instagram's `/_u/` form that has to be rewritten.

## What the app changed

- **No unzipping by hand.** The app reads the `.zip` directly — JSZip on both Android and the web build.
- **Nothing is written to disk beside your data.** These scripts dropped a plaintext `unfollowers_list.txt` and a
  PDF full of usernames next to the export. That output is deliberately **not** in this repository.
- **It answers more than one question** — fans, mutuals, history, analytics, a whitelist — rather than one list.
- **It runs where the data is**, on the phone or in a browser, instead of on a laptop with Python installed.

## Running them

```bash
python find_unfollowers.py <path-to-unzipped-export>
```

`create_pdf.py` additionally needs `reportlab`. Both take the export folder as an argument; the original scripts
hardcoded one, which happened to embed the account handle in the path.

You almost certainly want [the app](../README.md) instead.
