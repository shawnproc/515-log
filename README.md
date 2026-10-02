# The 5:15 Log

Personal training and nutrition tracker. Installable web app, works offline, no account, no backend.

- **Train:** daily session from your weekly split, sets × reps × weight, last-session numbers, overload cue, bodyweight
- **Fuel:** macro targets, quick adds, barcode scan (Open Food Facts), food search (USDA FoodData Central), manual entry
- **Progress:** weekly sessions vs plan (flags more than 2 misses), 90-day bodyweight, 14-day calories, best lifts and e1RM trend
- **Plan:** targets, split editor, food preferences, food search key, backup export/import

## Privacy and security

- All logs live in the browser's local storage on your device. Nothing is sent to any server.
- The only network calls are food lookups (`world.openfoodfacts.org`, `api.nal.usda.gov`) and Google Fonts.
- A strict Content Security Policy allows scripts only from this site and network calls only to those two food APIs.
- Your USDA key is entered in the app and stored on the device. It's never committed to this repo.
- Third-party code: `vendor/html5-qrcode.min.js` v2.3.8 (Apache-2.0), vendored from npm and loaded only when you tap Scan.

## Install on your phone

1. Open the GitHub Pages URL in **Safari** (iPhone) or **Chrome** (Android).
2. iPhone: Share → **Add to Home Screen**. Android: ⋮ → **Install app**.
3. Launch it from the home screen icon. That copy keeps its own storage, so always log from the icon.

## Backups

Plan tab → **Export backup** saves a JSON file. **Import backup** restores it, on the same phone or a new one. Deleting the home-screen app deletes its data, so export weekly.

## Releasing an update

Bump `VERSION` in `sw.js` (for example `515-v2`) in every commit that changes app files. Open the app and tap **Update** when the banner shows.
