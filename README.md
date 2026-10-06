# Lah We

Workout, nutrition and body tracking as a single self-contained web page, built for an iPhone home screen. No account, no server: everything you log stays in the browser on your device.

`dist/lahwe.html` is the whole app. The source lives in `src/` as about thirty small files that a zero-dependency script stitches back into that one page.

## Run it

```
node build.js        # writes dist/lahwe.html (and the same file as dist/index.html)
npm test             # unit tests, no dependencies (Node 20+)
npm run e2e          # browser tests (smoke + upgrade from the original app); needs Playwright:  npm i -D playwright && npx playwright install chromium
```

Open `dist/lahwe.html` in a browser to try it on a computer.

## Put it on a phone

Host the contents of `dist/` on any static https host (GitHub Pages, Cloudflare Pages, Netlify), open the address in Safari, then Share → Add to Home Screen. Served this way the app also works with no signal: `sw.js` keeps a copy of the page and refreshes it the next time you open it online.

Two things to know before you move or replace anything:

- **Your data belongs to the address.** Browsers keep storage per site. Replace the file at the address you already use and your data is still there (it is upgraded on first load). Serve it from a *new* address and it starts empty: back up from the old one (Settings → Back up) and restore at the new one.
- **A hosted page is public even when the repository is private.** That is fine here: the page contains no data and no keys. Just know that the address is not a secret.

## Your data

- Stored twice on the device: in the browser's app storage and in its database. On launch the newer copy is used, so losing one does not lose your log.
- If a save ever fails (storage full or blocked) a red banner says so and offers a backup. If stored data cannot be read, the app stops and offers to download it instead of starting over on top of it.
- **Back up** (Settings → Back up) writes one JSON file. On iPhone it opens the share sheet: choose *Save to Files*. The home screen nudges you when the last backup is more than two weeks old.
- **Restore** shows what is in the file and what it will replace, then asks. The previous data is kept for two weeks so the restore can be undone from Settings; undoing asks too, and swaps the two sets rather than discarding either.
- Deleting the home-screen icon, or clearing Safari website data, erases everything. The backup file is the only copy that survives that.

Coming from the old single-file build: back up there first, then switch. Old saves are upgraded automatically. Records that no logged workout accounts for are kept and labelled *carried over* (tap one to remove it). Two things to know:

- Quick Log used to be ignored on any day that also had a logged meal. From now on the two are added together. Days you logged *before* upgrading keep the totals they have always shown: their Quick Log is parked, and opening Quick Log for that day lets you count it or clear it.
- Meals and activities the old build filed under the wrong day (it used UTC dates, so anything logged in the evening landed on tomorrow) stay where they were filed. That cannot be repaired automatically.

## AI workout builder

Library → Routines → ✨ Build with AI. Describe a program, or attach a photo, screenshot or PDF of one. You get the same preview as a pasted import, can ask for changes, and nothing is saved until you add it.

- It uses **your own Claude API key**, entered once in the builder or in Settings. Usage is billed to your Anthropic account.
- The key is stored on the device in its own entry, separate from your data. It is not included in backups, not shown again in full, and sent only to `api.anthropic.com`.
- Each request carries your description and attachments, your goal, equipment setting and unit, and the exercise list (including your custom exercise names). It does not carry your workout history, bodyweight or name.
- The key sits in browser storage, which is as private as the phone is. Use a key you can revoke, and set a spend limit on it in the Claude Console.

To convert programs with another assistant instead, see [docs/import-format.md](docs/import-format.md).

## What talks to the network

| When | Where | What is sent |
| --- | --- | --- |
| Opening the app | Google Fonts | A font request. The app falls back to system fonts without it. |
| Scanning a barcode | cdn.jsdelivr.net, world.openfoodfacts.org | Loads the scanner library; looks up the barcode number. |
| Build with AI | api.anthropic.com | See above. |

Nothing else leaves the device. Chart.js is bundled in the file.

## Layout

```
src/index.html        page shell; the build fills in the script, styles and Chart.js
src/styles.css
src/js/NN-name.js     concatenated in filename order into one script
  10–12  data         exercise catalog, body map, Army Fitness Test tables
  20     state        default state, normalizeState(), storage
  30–35  shared       dates, units, escaping, energy maths, schedule, PRs and insights, sheets/toasts/timers
  40–46  screens      navigation, onboarding, home, session, history, progress
  50–53  nutrition    food list, logging, meal builder, barcode scanner
  60–63  library      exercises and groups, import, routine editor, AI builder
  70–72  settings, backup/restore, card-deck and sprint modes
  99     startup
src/public/           service worker, manifest, icons (copied to dist/)
vendor/               Chart.js
test/unit/            node --test, loads the built script into a sandbox (test/harness.js)
test/e2e/smoke.js     drives dist/index.html in headless Chromium at phone size
test/e2e/upgrade.js   logs data with legacy/lahwe2_01.html, then opens the new build on the same address
tools/                icon rendering, catalog listing, a small asserted find-and-replace helper
legacy/               the original single file, untouched
```

## Working on it

The app is plain global functions and template strings, with inline `onclick` handlers. A few rules keep that safe:

- **Dates.** Day keys are local calendar days from `today()`, `dayOf(timestamp)`, `daysAgoStr(n)`, `addDays()`. Never build one from `toISOString()`: that is UTC and rolls over in the evening.
- **Text into markup.** Anything a person, a file or the network supplied goes through `esc()`. An id or value inside a handler goes through `jsq()`: `onclick="open(${jsq(id)})"`.
- **State.** `S` is the only state. Anything that replaces it wholesale (load, restore, reset) goes through `replaceState()`, which normalises, migrates and rebuilds everything derived from it. Do not assign a parsed file to `S`.
- **Saving.** `save()` after a change (writes are batched). `saveNow()` when losing it would hurt: finishing a workout, restoring, deleting.
- **PRs** are derived. Call `rebuildPRs()` after anything that changes logged sets; never write to `S.prs` directly.
- **Weights** are stored in the user's unit. Use `bwKg()` / `bwLb()` / `toKg()` for anything physiological.
- **No `confirm()` / `alert()`.** They do not work in a home-screen app. Use `customConfirm()`, or better, do it and offer Undo in a `toast()`.
- **Import** is two steps on purpose: `parseImport()` is pure and returns a plan; `commitImport()` writes it. The AI builder uses the same two functions.

Before pushing: `npm run check` (build, unit tests, both browser tests). The smoke test includes a pass that fills every text field and id with hostile strings and checks nothing becomes markup or script on any screen.

## Known limits

- Tested in headless Chromium and Node, not on a physical iPhone. Things only a phone can confirm: the share-sheet backup, the wake lock, rest-timer sound after the screen has been off, camera scanning.
- iOS pauses web timers when the phone locks. The rest timer and sprint intervals recover the correct time when you come back, but they cannot sound while the screen is off. The screen is kept awake during a session to avoid this.
- The calorie figures are estimates from body size, time and published MET values. They are for trends, not accounting.
