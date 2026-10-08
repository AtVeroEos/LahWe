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
- **Import from Strava** (Settings → Your data). Strava has no live link here; it exports a file. On strava.com (not the app): Settings → My Account → Download or delete your account → Request your archive; Strava emails a .zip. Choose that zip (or `activities.csv` from inside it, or a `.gpx`/`.tcx` from one activity's Export GPX). It is read on the phone: only `activities.csv` is opened from the zip, nothing is uploaded, no Strava login or key. Runs, rides, walks, hikes and swims become activities like ones logged by hand (calories from the app's own formula; rucks found by name, with the load read from the name); weight training is off by default because lifts are logged here set by set. Importing the same archive again adds nothing (Strava ids are kept), activities already logged by hand on the same day are skipped, and the import can be undone. FIT files are not read; the archive's `activities.csv` covers them. The archive must be requested with Strava set to English.
- Deleting the home-screen icon, or clearing Safari website data, erases everything. The backup file is the only copy that survives that.

Coming from the old single-file build: back up there first, then switch. Old saves are upgraded automatically. Records that no logged workout accounts for are kept and labelled *carried over* (tap one to remove it). Two things to know:

- Quick Log used to be ignored on any day that also had a logged meal. From now on the two are added together. Days you logged *before* upgrading keep the totals they have always shown: their Quick Log is parked, and the *Day totals entered by hand* row on that day lets you count it or clear it. (The separate Quick Log button is gone: *Log meal → By hand* does the same job.)
- Meals and activities the old build filed under the wrong day (it used UTC dates, so anything logged in the evening landed on tomorrow) stay where they were filed. That cannot be repaired automatically.

## The coach

The Coach tab is a chat with an AI that can look things up in the app and act on them. Ask it anything about your training, food or progress, or start from a card: a workout for right now, a program for the week, a week of meals that hits your targets, a meal logged from a photo, a review of your week, why a lift has stalled, whether your targets fit your weight trend, or a program imported from a photo or PDF.

**It uses your own AI account.** Settings → AI coach: choose Claude, ChatGPT, Gemini, OpenRouter, or any server that speaks the OpenAI chat format, paste an API key from that account, pick a model, and press *Test connection*. Usage is billed to you by that company. There is no key in this repository, in the built page, or shared between people — each person who uses the app enters their own.

**What it knows.** A chat starts with only: the date and time, your weight unit, goal and equipment setting, the names of your routines and active group, whether a meal plan exists, whether a workout is open, the two permission switches, and your coach notes. For anything else it has to call a tool, and each lookup is shown in the chat as a *Read* chip. Switch off *Read my logs* in AI settings and the history tools are not offered to the model at all.

**What it can change.**

- At once, with Undo: log a meal, a weigh-in or an activity; save or remove a coach note; add a food. (Switch *Apply small changes at once* off and these wait for a tap too.)
- Only when you tap the card: routines, groups and programs; a one-off workout; the meal plan; calorie, macro and weight targets; deleting a routine, a logged meal, a weigh-in, an activity or planned meals.
- Never: workout history, your profile, settings, backups.

Everything it tries to change is checked by the app, not trusted: exercise and food ids must exist, dates cannot be in the future, calories must agree with the macros, a calorie target cannot go below 1,500 for a man or 1,200 for a woman, or far below resting burn, a weigh-in more than 10% from the last one is questioned. A card is checked again when you tap it, against your data as it is then.

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

Settings → Reminders. A web app on an iPhone cannot schedule its own notifications — the only kind Apple allows is a push sent from a server, and this app has none. So reminders (workout days, weigh-in, logging food) are written as a small calendar file of repeating events with alerts and handed to the phone's Calendar, which fires them on time whether or not the app is open. Change a time and add again to update; delete the "… — Lah We" event in Calendar to stop one. A reminder's time can be set whether or not it is switched on; setting one switches it on.

## Installing

Settings → Install as an app shows the steps for each device. There is no App Store version and none is needed: *Add to Home Screen* gives a full-screen app with its own icon that works offline. The same sheet can download `lahwe.html`, the whole app as one file, which runs from disk on a computer (on an iPhone a saved file cannot keep data, so use the Home Screen there).

## Targets, swaps, the week, a test date

These four work on the device with no AI and no network.

- **Targets** (Workout tab → *Targets* on a routine). What to aim for next session, lift by lift, from a built-in rule: add reps inside the planned range, add weight once every set reaches the top, repeat after a missed or hard session, back off about 10% after a pain tag or three stalled sessions. In a workout each lift shows *Plan*, *Last* and *Aim*; tapping the aim fills the unfinished sets. The coach can adjust the targets, but only when you tap *Ask the coach*: one small request (a short instruction and that routine's last three sessions; no tools, no chat history), around a thousand tokens against roughly seven thousand for a chat question. Every number that comes back is checked against your last session and capped; anything that fails falls back to the rule.
- **Swap** (the *Swap* button on a lift in a workout). Substitutes come from the exercise list by movement pattern and muscle, then are ordered by what you have actually trained and by which substitute you picked before. Painful lifts sink. Finished sets stay logged under the original lift; when you finish, a swap can be saved to the routine as a replacement.
- **This week** (the card on the Workout tab). Planned days against what happened, four numbers chosen for your goal, and a check-in sheet with sets per muscle against the useful weekly range, lifts now against four weeks ago, and what stands out. Trends compare the last seven full days with the seven before; today counts from tomorrow, so a training day does not look like a drop until you have trained.
- **Test date** (Progress → Army Fitness → *Plan for a test date*). Counts back from the day of the test: phases ending in a one-week taper, a checkpoint for every event every week from your current and goal scores, one session a week per event with your numbers in it, and dates for practice tests that can go to your calendar.

## Library

Three views, each drawn as what it is. In the app a routine is called a *workout* and a group of them a *split*; the saved data and the coach's tools keep the older names.

- **Programs** are drawn as time. A timed program (splits in sequence, each for a number of weeks) is a bar of phases to scale, filled to today. The split in use shows this week: each day with its workout, the ones done filled in. Fixed-day splits show their week; a rotation shows its order with a loop.
- **Workouts** are drawn as what they hit: one bar split by sets per muscle, about how long it takes (what it actually took the last few times, else an estimate from sets and rest), where it sits in the week, and a Start button. The next one due is first.
- **Exercises** are drawn as progress. The ones you have logged come first, most recent on top, with their trend and estimated max; the rest follow. Search, muscle filters, and an **Equipment** filter (what you have to train with — one setting, also used by the exercise picker and swaps).
- **One exercise sheet** for the whole app, opened from the Library, a lift or a record on Progress: how often you do it, best set, estimated max over the period, the muscles it works, which workouts use it, its sessions, and *Add to a workout*.
- *Build with coach* is on the page in Programs and Workouts; the + lists the other ways to make one (by hand, import).

## Progress

The Progress tab opens on a board of tiles, and you decide what is on it. It starts from the goal you chose at setup — strength leads with your lifts, weight loss with body weight, calories and maintenance, and so on — and *Edit* adds, removes and reorders tiles (drag the handle, or use the arrow keys). Reset puts the goal's set back.

- **Tiles**: lifts (estimated one-rep max for the lifts you pick), new records, hard sets, strength standards, body weight, maintenance, one measurement, calories, protein, sessions, steps, pace over a distance you repeat (a run, a ruck), and the Army Fitness Test.
- **One period** for the whole board — 4 weeks, 12 weeks, 6 months or a year — so every chart covers the same stretch.
- **Tap a tile** for its chart, the numbers behind it and the sessions or days it came from. Tapping a point on a chart shows that day.
- A week is Monday to Sunday everywhere, and body weight uses one trend line (a straight-line fit through the weigh-ins in the period), so the board, the Nutrition tab and the coach agree.

The charts are drawn by the app itself, with no charting library.

## Patterns

Progress → the Patterns tile. The app looks through your own log for relationships and says what it finds, with the count behind it: "Your lifts are 2.9% better after a day off (60 of 68 sessions)". It is arithmetic on the device; no AI and no network.

- **Against your own trend.** An outcome is never the raw number. A lift's best set is compared with the sessions of that lift around it, a weigh-in with the week either side, a run with efforts at the same distance. Raw numbers all drift together over months, which makes anything correlate with anything.
- **Four bars before anything is shown.** Enough cases on each side of a comparison (eight; ten for the scale), an effect big enough to matter (1.5% on a lift, 0.4 lb on the scale, 1% of pace), the same direction in both halves of your history, and a p-value (from a permutation test) that survives a Benjamini–Hochberg correction for every pattern tested, at a 10% false-discovery rate.
- **Placebo checks.** Some tests should find nothing (running should not change your bench). If one of them comes up positive the bar is raised for everything.
- **One finding, not five.** If Saturday is always a rest day, "after a rest day" and "on Sundays" are the same thing; the surest is kept and the others are listed under it.
- **What it will not claim.** With a fixed weekly split, "after a rest day" cannot be told apart from "that workout", because the same lifts always follow the rest day. The app says nothing in that case. Every pattern's sheet names what else could explain it.
- **The page** lists what was found, early signs (collapsed, and marked as possibly chance), what was tested and found nothing, and what needs more data with how far each has to go. A pattern opens its evidence: every case as a dot against your trend, the difference, the odds of seeing it by chance, whether it holds in both halves.
- **Version 1 tests** rest days and breaks, the day after cardio (leg lifts; upper-body lifts as the placebo), calories, carbs, protein and a run of deficit days, morning against later, each weekday, sleep, and per lift: done first or later, days since it was last done, after a day off, after cardio. On the scale: after a rest day, leg day, cardio, a high-carb day, each weekday, a short night. For runs: the day after leg day, and after hitting calories.

Two optional one-tap questions feed it, each with a switch in Settings → Tracking: how the workout went (at Finish) and last night's sleep (with the weigh-in).

## Home

Home's job is to get you to train today: today's workout, this week, one encouraging line (a pattern that applies today, or a real win), and one milestone with the distance to go (the test date if you have one; otherwise the next plate on a main lift, your weight goal, or a round number of sessions). Warnings moved to Progress, under *Needs a look*. The one reminder Home keeps is a backup that is overdue.

## Music

Settings → Music. A Spotify remote at the top of a workout: the track playing, with play, pause and skip. It controls Spotify on whatever device is already playing; a web page on an iPhone cannot play Spotify itself.

- It needs **Spotify Premium** (Spotify refuses playback control for free accounts) and **your own Spotify developer app**. Spotify limits a developer app to five people and requires its owner to have Premium, so one client ID shared by everyone who opens this page could not work. The sheet shows the exact redirect address to register and where to find the client ID.
- Sign-in is PKCE, which uses no client secret. The client ID and the sign-in Spotify returns are stored on the device only, outside the app's data: they are not in backups and not in this repository.
- YouTube is not offered. A web page cannot control the YouTube app, and a player inside this page would stop when the phone locks.

## Nutrition

- **What is left.** The tab opens on calories left for the day, then protein, carbs and fat against their targets. The arrows step back to any earlier day; its meals can be read and changed, and anything logged while a past day is showing goes to that day.
- **Order of the tab.** Scan and Log meal, then the day's meals, then starred and recent foods to log in one tap, then *Fits what's left* (once something is logged), the meal plan, weight and maintenance, the last seven days as bars against each day's target (tap one to open it), supplements.
- **Log meal is one sheet.** Pick the meal (Breakfast, Lunch…) at the top; it starts on the likely one for the time of day. Search or tap foods; the list takes whatever height is left. What is in the meal stays above the button, one item open at a time with its amount. *By hand* is a tab for a meal you only know the numbers for; those numbers add to any foods picked.
- **Any kind.** "Steak", "Chicken", "Ground Beef", "Pork", "Fish", "Rice", "Bread", "Cheese", "Nuts", "Beans" and "Milk" are entries of their own, for when the cut does not matter. Their numbers are worked out from the specific foods in the list (steak is the average of flank, sirloin, filet and ribeye), and a switch moves them to the lean or the fatty end; the app remembers how you last set each one. The specific cuts are still listed underneath.
- **Raw or cooked.** The list's meat and fish numbers are for raw weight. A Raw / Cooked switch on those foods gives the numbers for the same weight after cooking (meat and poultry lose about a quarter of their weight, fish about a fifth; a rule of thumb, good to roughly 10%). Rice and pasta are listed cooked and have a Dry switch, by weight.
- **Type the amount.** "steak 8 oz", "200g rice" or "2 eggs" in the meal search fills in the amount; Return adds the first result. Ratios and percentages in a name ("90/10", "2%") are left alone, and a household measure ("2 tbsp peanut butter") is not turned into a number of servings.
- **Cooking fat.** Meat, fish and eggs offer "+ oil" and "+ butter": a teaspoon as its own line in the meal.
- **Log by weight.** An amount can be servings, grams or ounces. Most built-in foods carry the weight of their serving (USDA household measures: a cup of cooked rice is 158 g), a scanned product uses the label's, and your own foods take an optional weight or one written in the serving ("100 g", "4 oz", "1/4 lb"). The app remembers which unit you last used for each food. Foods that vary too much by brand or recipe (a protein bar, a biscuit) have no weight and are logged by the serving.
- **Meals are editable.** Tap a logged meal to change amounts, items, date or meal; it is replaced in place, with Undo.
- **Again.** The repeat button on a meal logs the same meal again today. *Copy from a day* brings one or all of an earlier day's meals into the day on screen.
- **Your own foods.** In *Log meal → Foods*, *New food* (or *Create “…”* under a search with no match) adds a food with its label numbers. Your foods have an edit button and can be deleted; meals already logged keep the numbers they were logged with.
- **Fits what's left.** Foods you log, star or saved as meals, in a normal portion (at most two servings), ordered by how much of the protein gap each closes for its calories. Nothing suggested takes the day over. No AI.
- **Maintenance from your own numbers.** With at least four weigh-ins two weeks or more apart, and food logged on most of the days between them, maintenance is your average intake less what the weight change accounts for (3,500 kcal per lb, 7,700 per kg), with a 95% margin that widens when weigh-ins are few. Days logged at under half your usual are left out as unfinished. Until there is enough data the app shows the formula estimate (resting burn × 1.2 plus logged exercise), says so, and lists what is missing. The sheet also says what your targets come to against maintenance. All of it is arithmetic on the phone; no AI and no network.
- **The formula, and who it is for.** The formula estimate is Mifflin-St Jeor: sex, age, height and weight all go in (a man comes out about 200 kcal a day above a woman of the same size and age; each year of age takes off about 6). Setup asks for sex, and the Maintenance sheet names the person it calculated for and says which of those were never given and are running on a default. The same sex setting picks the strength standards, the Wilks/DOTS coefficients and the fitness-test table; age also picks the fitness-test age group.
- **Goals.** Four buttons fill calories from maintenance for a rate of change (−1, −½, 0, +½ lb a week, or the kg equivalents) and move carbs so the macros agree; protein and fat stay. The sheet shows protein per pound of body weight and what the macros add up to. The lowest target the app or the coach will set is 1,500 kcal for a man and 1,200 for a woman; a lower number typed by hand is flagged, not blocked.
- **Training days and rest days.** *Goals → Different targets on rest days* adds a second set of targets. A day is a training day if you trained, or if your weekly schedule says so; the chip on the tab flips any single day. Weekly averages, the calendar and the coach then judge each day against its own target.
- **Supplements** are one row that opens itself while something is still to be taken today and folds once the day's are ticked.

## Barcode scanner

- The app runs its own decode loop on camera frames, on the band inside the guide box and, every fourth frame, on the whole picture. It reads EAN-13, UPC-A, EAN-8 and UPC-E only, and accepts a number only when its check digit holds.
- The camera is requested straight from the tap. A start that fails is retried with looser settings; a stream that opens without a picture is detected and restarted; leaving the app stops the camera and coming back restarts it. When it still fails, the screen names the error the phone gave and says what to change.
- **Take a photo** uses the phone's own camera screen, which focuses closer than live video and works even when the live camera will not start. **Type the number** checks the digits before looking anything up.
- A found product opens one sheet: the amount (servings, grams or ounces; a weight uses the label's per-100 g numbers) and the meal to log it as. Scanned from inside *Log meal*, it joins that meal instead.
- A product whose numbers are wrong can be corrected from that sheet (*These numbers are wrong: fix them*); the next scan uses the correction. The 12-digit and 13-digit forms of one barcode are treated as the same product.
- The reader library (`vendor/zxing.min.js`, MIT) ships with the app and is loaded on first scan, then kept for offline use. A single saved file falls back to the same file on a CDN, pinned by hash.

## Meal plan

Nutrition → Meal plan. Seven days of planned meals, each built from foods in your list (or a food with its own numbers, marked *est.*).

- Today's planned meals sit on the Nutrition tab; **Log** writes one to today's intake in a tap and marks it logged.
- *Week* shows any day: add a meal with the normal meal builder, edit or remove one, copy a day to others, clear a day or the week.
- *Grocery list* adds up the whole week (the same food on different days is one line), ticks are remembered, and it can be shared as text.
- The coach can draft or adjust the plan; it reports each day against your targets and the plan only changes when you tap *Use this plan*.

## What talks to the network

| When | Where | What is sent |
| --- | --- | --- |
| Scanning a barcode | world.openfoodfacts.org (and cdn.jsdelivr.net only when the app runs as a single saved file) | Looks up the barcode number. The scanner library comes with the app; the saved-file fallback is pinned by hash. |
| Using the Spotify remote, if you set it up | accounts.spotify.com, api.spotify.com, and Spotify's image host for album art | Sign-in with your own client ID; playback commands. |
| Using the coach | The provider you chose: api.anthropic.com, api.openai.com, generativelanguage.googleapis.com, openrouter.ai, or your own server | Your messages and attachments, the rules, and the data shown in *Read* chips. Your key, in a header. |

Nothing else leaves the device. The charts are drawn by the app and it uses the system font, so opening it makes no request to anyone. The page sends no referrer.

## Layout

```
src/index.html        page shell; the build fills in the script and styles
src/styles.css
src/js/NN-name.js     concatenated in filename order into one script
  10–12  data         exercise catalog, body map, Army Fitness Test tables
  20     state        default state, normalizeState(), storage
  30–38  shared       dates, units, escaping, energy maths, schedule, PRs and insights, sheets/toasts/timers,
                      the metric catalog behind the Progress board, charts
  40–46  screens      navigation, onboarding, home, session, history and schedule (views of the Progress tab), progress
  50–54  nutrition    food list, logging, meal builder, barcode scanner, weekly meal plan
  60–62  library      exercises and groups, import, routine editor
  63     AI providers keys, the four wire formats, one chat-with-tools call
  65–67  coach        rules and tools; the conversation loop, the Coach tab, AI settings; saved chats and "Made by coach"
  70–73  settings, backup/restore, card-deck and sprint modes, reminders and install help
  99     startup
src/public/           service worker, manifest, icons (copied to dist/)
vendor/               the barcode reader (ZXing)
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

Before pushing: `npm run check` (build, credential scan, unit tests, four browser tests). `dist/` is committed, and the workflow fails if it does not match the source, so build before you commit. The smoke test includes a pass that fills every text field and id with hostile strings and checks nothing becomes markup or script on any screen.

## Known limits

- Tested in headless Chromium and Node, not on a physical iPhone. Things only a phone can confirm: the share-sheet backup, the wake lock, rest-timer sound after the screen has been off, camera scanning, and how the coach's message box sits above the on-screen keyboard.
- The coach has been tested against scripted replies in each provider's documented format, not against the live services (no key is available to the tests, by design). The request and reply shapes follow each provider's current documentation; Claude's endpoint was confirmed to accept browser requests, OpenAI's and OpenRouter's are reported to, and Gemini's has not been confirmed. *Test connection* in AI settings tells you in a few seconds whether your provider, key and model work from your device. If one does not, OpenRouter offers the same models.
- The scanner is tested with a generated barcode video played as a fake camera (`test/e2e/scanner.js`), including refused permission, a busy camera, a stream with no picture and the app going to the background. That proves the software path, not the optics: focus distance, glare and how iOS behaves on your phone can only be checked there.
- The Spotify remote is tested against scripted replies in Spotify's documented format, not against Spotify. Two things only a real phone and account can confirm: that the sign-in returns to the Home Screen app rather than to Safari (there is a paste-the-code fallback if it does not), and Spotify's own behaviour for your account.
- The look was checked in Chromium with Inter standing in for San Francisco; on an iPhone the system font is used. `node tools/shots.js` regenerates the screenshots with demo data.
- Suggested model names are current as of October 2026 and will age. *List my models* asks the provider what your key can use, and any model name can be typed in.
- iOS pauses web timers when the phone locks. The rest timer and sprint intervals recover the correct time when you come back, but they cannot sound while the screen is off. The screen is kept awake during a session to avoid this.
- The calorie figures are estimates from body size, time and published MET values. They are for trends, not accounting.
