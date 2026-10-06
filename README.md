# Lah We

Workout, nutrition and body tracking as a single self-contained web page, built for an iPhone home screen, with an AI coach that runs on your own API key. No account, no server: everything you log stays in the browser on your device.

`dist/lahwe.html` is the whole app. The source lives in `src/` as about thirty small files that a zero-dependency script stitches back into that one page.

## Run it

```
node build.js        # writes dist/lahwe.html (and the same file as dist/index.html)
npm test             # unit tests, no dependencies (Node 20+)
npm run e2e          # browser tests (smoke, upgrade from the original app, hosting under a sub-path); needs Playwright:  npm i -D playwright && npx playwright install chromium
npm run check        # everything: build, credential scan, unit tests, browser tests
```

Open `dist/lahwe.html` in a browser to try it on a computer.

## Use it from a web page

Every push to `main` is checked and published by `.github/workflows/publish.yml`: it builds, scans for credentials, runs the unit tests, and puts the contents of `dist/` on the `gh-pages` branch. GitHub Pages serves that branch at

**https://atveroeos.github.io/LahWe/**

(If the address shows a 404, Pages has not been switched on for the repository yet: Settings → Pages → *Deploy from a branch* → `gh-pages`, folder `/ (root)`. It is a one-time setting.)

On an iPhone: open the address in Safari, then Share → Add to Home Screen. Served this way the app also works with no signal: `sw.js` keeps a copy of the page and refreshes it the next time you open it online. Any other static https host (Cloudflare Pages, Netlify, your own) works the same way — upload the contents of `dist/`.

Things to know before you share the address or move the app:

- **Everyone who opens the page gets their own empty app.** Data and API keys are stored by each person's own browser. Nothing you log, and no key you enter, is visible to anyone else who uses the same address, and there is no key built into the page for them to use.
- **Your data belongs to the address.** Browsers keep storage per site. Replace the files at the address you already use and your data is still there (it is upgraded on first load). Serve it from a *new* address and it starts empty: back up from the old one (Settings → Back up) and restore at the new one. API keys are not in backups, so you enter those again.
- **The page and this repository are public.** That is fine: neither contains data or keys. The address is not a secret, and the code can be read by anyone.
- **Pages on one GitHub account share an origin.** `atveroeos.github.io/LahWe` and any other project site under `atveroeos.github.io` are the same site as far as the browser is concerned, so a script on one could read what another stored. Only publish pages you trust under that account, or give this app its own domain (Settings → Pages → Custom domain).

## Your data

- Stored twice on the device: in the browser's app storage and in its database. On launch the newer copy is used, so losing one does not lose your log.
- If a save ever fails (storage full or blocked) a red banner says so and offers a backup. If stored data cannot be read, the app stops and offers to download it instead of starting over on top of it.
- **Back up** (Settings → Back up) writes one JSON file. On iPhone it opens the share sheet: choose *Save to Files*. The home screen nudges you when the last backup is more than two weeks old.
- **Restore** shows what is in the file and what it will replace, then asks. The previous data is kept for two weeks so the restore can be undone from Settings; undoing asks too, and swaps the two sets rather than discarding either.
- Deleting the home-screen icon, or clearing Safari website data, erases everything. The backup file is the only copy that survives that.

Coming from the old single-file build: back up there first, then switch. Old saves are upgraded automatically. Records that no logged workout accounts for are kept and labelled *carried over* (tap one to remove it). Two things to know:

- Quick Log used to be ignored on any day that also had a logged meal. From now on the two are added together. Days you logged *before* upgrading keep the totals they have always shown: their Quick Log is parked, and opening Quick Log for that day lets you count it or clear it.
- Meals and activities the old build filed under the wrong day (it used UTC dates, so anything logged in the evening landed on tomorrow) stay where they were filed. That cannot be repaired automatically.

## The coach

The Coach tab is a chat with an AI that can look things up in the app and act on them. Ask it anything about your training, food or progress, or start from a card: a workout for right now, a program for the week, a week of meals that hits your targets, a meal logged from a photo, a review of your week, why a lift has stalled, whether your targets fit your weight trend, or a program imported from a photo or PDF.

**It uses your own AI account.** Settings → AI coach: choose Claude, ChatGPT, Gemini, OpenRouter, or any server that speaks the OpenAI chat format, paste an API key from that account, pick a model, and press *Test connection*. Usage is billed to you by that company. There is no key in this repository, in the built page, or shared between people — each person who uses the app enters their own.

**What it knows.** A chat starts with only: the date and time, your weight unit, goal and equipment setting, the names of your routines and active group, whether a meal plan exists, whether a workout is open, the two permission switches, and your coach notes. For anything else it has to call a tool, and each lookup is shown in the chat as a *Read* chip. Switch off *Read my logs* in AI settings and the history tools are not offered to the model at all.

**What it can change.**

- At once, with Undo: log a meal, a weigh-in or an activity; save or remove a coach note; add a food. (Switch *Apply small changes at once* off and these wait for a tap too.)
- Only when you tap the card: routines, groups and programs; a one-off workout; the meal plan; calorie, macro and weight targets; deleting a routine, a logged meal, a weigh-in, an activity or planned meals.
- Never: workout history, your profile, settings, backups.

Everything it tries to change is checked by the app, not trusted: exercise and food ids must exist, dates cannot be in the future, calories must agree with the macros, a calorie target cannot go below 1,200 or far below resting burn, a weigh-in more than 10% from the last one is questioned. A card is checked again when you tap it, against your data as it is then.

**The rules** it works under are one list in `src/js/65-coach-tools.js` (`COACH_RULES`). That list is written into the model's instructions word for word and is what the *How the coach works* sheet shows, so what you read is what it was told.

An AI can still be confidently wrong. The app guards what it writes; its advice is advice, and it is not medical care.

### API keys

- A key is stored in its own entry in the browser's storage on that device (`lahwe_ai_keys`), never in the app's data. It is not in backups, not in the undo snapshot, not in the saved chat, and after saving only its last four characters are shown.
- It is sent only to the company it belongs to, in a request header — never in a web address. A key pasted under the wrong provider is refused, so it cannot be sent to the wrong company.
- Text from a provider is scrubbed of anything key-shaped before it is shown or stored.
- `npm run secrets` fails if anything shaped like a credential is in the repository or the built page. It runs in `npm run check`, in the publishing workflow, and as a pre-commit hook after `npm run hooks`.
- The key sits in browser storage, which is as private as the phone is. Use a key you can revoke and put a spending limit on it in the provider's console.

Chats are kept on the device, are not part of backups, and never store the bytes of a photo or PDF you attached. Starting a new chat saves the old one: **Chats** in the Coach header lists earlier chats (up to 40, oldest dropped first) and, under *Made by coach*, every program, workout, meal plan, target change and logged item it produced, with what became of it. Tapping one opens the chat it came from at that card; a used or dismissed card can be looked at again or put back on the table with *Use again*.

To convert programs with another assistant instead, see [docs/import-format.md](docs/import-format.md).

## Reminders

Settings → Reminders. A web app on an iPhone cannot schedule its own notifications — the only kind Apple allows is a push sent from a server, and this app has none. So reminders (workout days, weigh-in, logging food) are written as a small calendar file of repeating events with alerts and handed to the phone's Calendar, which fires them on time whether or not the app is open. Change a time and add again to update; delete the "… — Lah We" event in Calendar to stop one.

## Installing

Settings → Install as an app shows the steps for each device. There is no App Store version and none is needed: *Add to Home Screen* gives a full-screen app with its own icon that works offline. The same sheet can download `lahwe.html`, the whole app as one file, which runs from disk on a computer (on an iPhone a saved file cannot keep data, so use the Home Screen there).

## Meal plan

Nutrition → Meal plan. Seven days of planned meals, each built from foods in your list (or a food with its own numbers, marked *est.*).

- Today's planned meals sit on the Nutrition tab; **Log** writes one to today's intake in a tap and marks it logged.
- *Week* shows any day: add a meal with the normal meal builder, edit or remove one, copy a day to others, clear a day or the week.
- *Grocery list* adds up the whole week (the same food on different days is one line), ticks are remembered, and it can be shared as text.
- The coach can draft or adjust the plan; it reports each day against your targets and the plan only changes when you tap *Use this plan*.

## What talks to the network

| When | Where | What is sent |
| --- | --- | --- |
| Opening the app | Google Fonts | A font request. The app falls back to system fonts without it. |
| Scanning a barcode | cdn.jsdelivr.net, world.openfoodfacts.org | Loads the scanner library; looks up the barcode number. |
| Using the coach | The provider you chose: api.anthropic.com, api.openai.com, generativelanguage.googleapis.com, openrouter.ai, or your own server | Your messages and attachments, the rules, and the data shown in *Read* chips. Your key, in a header. |

Nothing else leaves the device. Chart.js is bundled in the file. The page sends no referrer.

## Layout

```
src/index.html        page shell; the build fills in the script, styles and Chart.js
src/styles.css
src/js/NN-name.js     concatenated in filename order into one script
  10–12  data         exercise catalog, body map, Army Fitness Test tables
  20     state        default state, normalizeState(), storage
  30–35  shared       dates, units, escaping, energy maths, schedule, PRs and insights, sheets/toasts/timers
  40–46  screens      navigation, onboarding, home, session, history and schedule (views of the Progress tab), progress
  50–54  nutrition    food list, logging, meal builder, barcode scanner, weekly meal plan
  60–62  library      exercises and groups, import, routine editor
  63     AI providers keys, the four wire formats, one chat-with-tools call
  65–67  coach        rules and tools; the conversation loop, the Coach tab, AI settings; saved chats and "Made by coach"
  70–73  settings, backup/restore, card-deck and sprint modes, reminders and install help
  99     startup
src/public/           service worker, manifest, icons (copied to dist/)
vendor/               Chart.js
test/unit/            node --test, loads the built script into a sandbox (test/harness.js)
test/e2e/smoke.js     drives dist/index.html in headless Chromium at phone size
test/e2e/upgrade.js   logs data with legacy/lahwe2_01.html, then opens the new build on the same address
test/e2e/subpath.js   serves dist/ under /LahWe/ like the hosted copy; offline reload; a second visitor starts empty
tools/                credential scanner and pre-commit hook, icon rendering, catalog listing, a find-and-replace helper
.github/workflows/    check and publish to GitHub Pages
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
- **Import** is two steps on purpose: `parseImport()` is pure and returns a plan; `commitImport()` writes it. The coach's routine proposals use the same two functions.
- **Keys never touch `S`.** They are read and written only through `getAiKey()` / `setAiKey()` in `63-ai-providers.js`, and leave the device only inside `aiFetch()`. Do not add a key, a token or a server address to `S`, to an error message, or to a URL.
- **Coach tools** come in three kinds (`65-coach-tools.js`): *read* (`run` returns data and a label for the chip), *write* (`prepare` validates and returns an `apply` that changes `S` and returns plain-data `undo`), and *propose* (`check` is pure and returns feedback for the model; `coachApplyProposal()` writes when the card is tapped). Schemas use only `type`, `description`, `properties`, `required`, `items` and string `enum`, because that is what all four providers accept. Model text is shown through `mdLite()`, which escapes first.

Before pushing: `npm run check` (build, credential scan, unit tests, both browser tests). `dist/` is committed, and the workflow fails if it does not match the source, so build before you commit. The smoke test includes a pass that fills every text field and id with hostile strings and checks nothing becomes markup or script on any screen.

## Known limits

- Tested in headless Chromium and Node, not on a physical iPhone. Things only a phone can confirm: the share-sheet backup, the wake lock, rest-timer sound after the screen has been off, camera scanning, and how the coach's message box sits above the on-screen keyboard.
- The coach has been tested against scripted replies in each provider's documented format, not against the live services (no key is available to the tests, by design). The request and reply shapes follow each provider's current documentation; Claude's endpoint was confirmed to accept browser requests, OpenAI's and OpenRouter's are reported to, and Gemini's has not been confirmed. *Test connection* in AI settings tells you in a few seconds whether your provider, key and model work from your device. If one does not, OpenRouter offers the same models.
- Suggested model names are current as of October 2026 and will age. *List my models* asks the provider what your key can use, and any model name can be typed in.
- iOS pauses web timers when the phone locks. The rest timer and sprint intervals recover the correct time when you come back, but they cannot sound while the screen is off. The screen is kept awake during a session to avoid this.
- The calorie figures are estimates from body size, time and published MET values. They are for trends, not accounting.
