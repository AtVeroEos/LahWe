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
- **Your data belongs to the address.** Browsers keep storage per site. Replace the files at the address you already use and your data is still there (it is upgraded on first load). Serve it from a *new* address and it starts empty: back up from the old one (Settings → Your data → Back up) and restore at the new one. API keys are not in backups, so you enter those again.
- **The page and this repository are public.** That is fine: neither contains data or keys. The address is not a secret, and the code can be read by anyone.
- **Pages on one GitHub account share an origin.** `atveroeos.github.io/LahWe` and any other project site under `atveroeos.github.io` are the same site as far as the browser is concerned, so a script on one could read what another stored. Only publish pages you trust under that account, or give this app its own domain (Settings → Pages → Custom domain).

## Your data

- Stored twice on the device: in the browser's app storage and in its database. On launch the newer copy is used, so losing one does not lose your log.
- During a workout, ticking a set, changing a weight or reps, tagging a set and the rest timer save only the workout in progress (a small separate entry, `lahwe_v2_live`), not the whole log. Anything else saves everything and removes that entry. On launch it is used only when it is newer than the copy it was written on top of.
- **Daily copies** (Settings → Your data → Daily copies). The first time the app is open each day it copies the whole log into the device database, compressed where the phone can (and kept compressed only once unpacking it gives back exactly the same data). The last seven days are kept. Restoring one works like restoring a backup: it shows what it replaces, asks, and can be undone. They are for undoing a mistake made in the app, not a backup: they live on the same phone, are not in backup files, and leave photos and routes alone. Erase everything deletes them too.
- If a save ever fails (storage full or blocked) a red banner says so and offers a backup. If stored data cannot be read, the app stops and offers to download it instead of starting over on top of it.
- **Back up** (Settings → Your data → Back up) writes one file, named by date so Files sorts them: `Lah We backup 2026-10-15.json`. With progress photos on the phone it first asks whether to include them; yes makes `Lah We backup 2026-10-15 with photos.zip`, which holds the same data plus every photo as a plain JPEG (`Photos/2026-10-15 Front.jpg`), so unzipped in Files it is a folder you can look through. On iPhone the share sheet opens: choose *Save to Files* and a folder. A web app cannot pick or make the folder itself, so make one (say *Lah We*) the first time; iPhone offers the last folder used after that. The home screen nudges you when the last backup is more than a week old.
- **Restore** shows what is in the file and what it will replace, then asks. The previous data is kept for two weeks so the restore can be undone from Settings; undoing asks too, and swaps the two sets rather than discarding either.
- **Import from another app** (Settings → Your data, the first-launch screen, or Progress while it is empty). Strong, Hevy, JEFIT, Fitbod, Alpha Progression and StrongLifts each export a CSV; it is read on the phone, nothing is uploaded. Each app's screen says what comes over, what gets translated (exercise names to ours, RPE to reps in reserve, units) and what does not (most apps do not export their templates). The questions a file raises come next: the unit when the file does not say, how far back, and which routines to rebuild from the last six weeks of history. Unmatched exercises can be pointed at ours before importing. The confirm screen shows the counts and real sets exactly as they will be saved. There is no Undo Import: today's daily copy is taken first, and **Imported data** (Settings → Your data) links an imported exercise to one of ours (its history moves over) or removes everything one app brought in, keeping anything logged here. Imported workouts are marked in History. Same file twice adds nothing; a workout already logged here by hand on that day is skipped. Alpha Progression and StrongLifts were built without a real export to test on.
- **Import from Strava** (Settings → Connections). Strava has no live link here; it exports a file. On strava.com (not the app): Settings → My Account → Download or delete your account → Request your archive; Strava emails a .zip. Choose that zip (or `activities.csv` from inside it, or one activity's own `.gpx`, `.tcx` or `.fit`). It is read on the phone: `activities.csv` and the recordings it names are the only things opened from the zip, nothing is uploaded, no Strava login or key. Runs, rides, walks, hikes and swims become activities like ones logged by hand (calories from the app's own formula; rucks found by name, with the load read from the name), each with its time to the second and, where the archive has the recording, its route. Weight training is off by default because lifts are logged here set by set. Importing the same archive again never adds an activity twice (Strava ids are kept); it fills in the route, the exact time and the shoes on activities that are already here. Activities already logged by hand on the same day are skipped, and the import can be undone. The archive must be requested with Strava set to English.
- **Routes** are kept beside the rest of your data in the device database, not inside it, so the log stays small. A backup file includes them (about 2 KB a run); a backup made before routes existed restores as before. Deleting an activity deletes its route. A route is the recording thinned to the points that hold its shape plus one at least every 20 seconds; splits, best efforts, climb and heart rate are worked out from the full recording before it is thinned.
- **Progress photos** are kept in the device database too, about 150 KB each, and never in the camera roll. Restore reads either kind of backup; a `.json` one lists your photos but has no pictures, so any not still on the phone come back only from a backup made with photos.
- Deleting the home-screen icon, or clearing Safari website data, erases everything. The backup file is the only copy that survives that.

Coming from the old single-file build: back up there first, then switch. Old saves are upgraded automatically. Records that no logged workout accounts for are kept and labelled *carried over* (tap one to remove it). Two things to know:

- Quick Log used to be ignored on any day that also had a logged meal. From now on the two are added together. Days you logged *before* upgrading keep the totals they have always shown: their Quick Log is parked, and the *Day totals entered by hand* row on that day lets you count it or clear it. (The separate Quick Log button is gone: *Log meal → By hand* does the same job.)
- Meals and activities the old build filed under the wrong day (it used UTC dates, so anything logged in the evening landed on tomorrow) stay where they were filed. That cannot be repaired automatically.

## Home layouts

Settings → Appearance → Home layout picks one of six, each shown as a live miniature of your own Home, not a picture of someone else's: **Balanced** (the default, Home as it always was), **Lifting** (today's workout, the records within reach, sets per muscle), **Running** (miles this week against your goal, training load, the last run, 5K on form), **Nutrition** (what is left to eat today, the meal plan to log, what fits), **Habits & recovery** (yesterday's mood, today's habits ticked right on Home, the mood strip), and **Minimal** (today, the week, the quick actions). A layout only changes what leads: every layout keeps everything, and a tile a bigger block already shows is left off rather than repeated.

Consistency rules the app follows: a Home tile always opens the same place (Weight → the check-in, which links to the trend; Habits → the Habits page, which asks for yesterday's mood when it is unrated). Everything opened from Home closes the same way: a sheet swipes down, a page pulls down from its top, and both show the grabber. "Check-in" means only the daily sheet; the weekly summary is **Week in review**. Sheets whose changes save as you go end in **Close**; **Cancel** is kept for backing out of something not done yet (a form, a choice, a confirmation).

## Habits and mood

Home → **Habits** (a tile once you have one; a quick action until then). Adding one asks for a name, a kind and the days, nothing else:

- **Kinds.** *Done* (tick it), *Amount* (reach a daily number: water, pages), *Avoid* (kept unless you mark a slip), and *auto* habits that tick themselves from what you already log (trained, cardio, logged food, hit protein, calories on target, slept 7 h+, 10,000 steps, all supplements, weighed in). At most 12 at once.
- **Days.** Daily by default; Weekdays, Weekends, or pick the days (church on Sundays, reading every night but Saturday). A day a habit is not due never counts against it.
- **The honest bits.** A day with nothing at all logged is *blank*, not a miss and not a win: the app cannot tell "did not do it" from "did not open the app", and an avoid habit would otherwise score every forgotten day as kept. Today is never a miss. A streak survives one missed day; two in a row end it. *Strength* (0-100) is a slow average that loses half its weight over about 13 scheduled days, so one miss after a long run barely moves it.
- **Mood** is one rating a day, 1 to 5, asked for *yesterday* in the morning check-in (the weigh-in sheet, which now also takes yesterday's habits), so a day is rated once it is over. Settings → Check-in & tracking turns the question off.
- **Calendar.** Schedule (on Home) and the Calendar tile (on Progress) open the same month, one view at a time: Everything, Happiness, Habits (all, or one), Training, Food, Sleep, Weight; only views with data are offered. Tapping a day in any view but Everything shows the whole day, with its mood and habits editable.
- **Patterns** tests each habit against mood the same day and the next day, and the habits you tick against lifts and the morning weigh-in the day after; plus training, sleep, protein and cardio against mood, and a placebo (even against odd dates). Mood is measured against the days 2 to 10 away on either side; the neighbouring days are left out because a good day would otherwise lower the next day's score and bias every next-day test negative. Each habit-mood finding shows a *reverse check*: whether your mood the day before predicts doing the habit just as well. Expect several weeks before anything clears the bar: each comparison needs ten rated days on each side.
- **Coach.** *Habits & happiness* (a starter, and a button on the Habits page) reads the habits, the ratings and the pattern results, and is told not to claim a link the formulas did not find. It can propose one habit as a card you tap to add.

## Running

Settings → Check-in & tracking → **Running** turns these on. Left alone, they switch themselves on once three runs or rucks with a distance are in the log.

- **Pace** (Progress board) groups runs into distance bands: about 1 mi (0.93–1.15), 2 mi (1.86–2.25), 5K (2.95–3.35), 4 mi (3.75–4.3), 10K (5.9–6.6), half (12.6–13.6) and longer. GPS measures the same loop a little differently every time, so each band holds a distance and its noise; the bands lean long and do not touch. *All runs* puts every run on one line as the pace it is worth over 5K (Riegel: time × (5K ÷ distance)^1.06), and takes its direction from a line fitted through all of them.
- **An activity with a route** opens on the numbers, the line it followed (north up, no map) and a one-line read (even or negative split, feet climbed, heart rate). Tabs hold the rest: *Splits* (mile splits and the two halves), *Hills* (grade-adjusted pace when the elevation is clean enough), *Heart* (zones, when the file had heart rate) and *Route* (the other times on the same route: starts within 150 m, within 5% of the distance, the same line; and marking a stretch).
- **The Running page** (the Weekly miles tile) opens on this week's miles and the chart; best efforts are open, and everything else is a closed row with its headline value that opens on tap (what is open is remembered until you leave). Contents: miles a week with a flag on a week that is at least 15% and two miles over the four weeks before it and beyond the biggest of them; best efforts at a mile, two miles, 5K, 10K and the half, found inside any run that has a route; and the times those efforts point to at each distance, including the two-mile run of the fitness test, which the test plan shows as "on current form".
- **Routes** (Running page → *All your routes from one start*): every route moved to begin at the same point, north up, and drawn outward together. Faster efforts are brighter, each compared with others of its own kind. Filter by time, kind and distance; draw at the *same speed* (every route grows at one rate) or at *real speed* (every route is at the same minute of its effort, so faster ones pull ahead). Tap a line to see which run it was, with its splits and a way into the activity; where several lines pass, the nearest few are listed.
- **Training load** compares the last 7 days with the last 28. A session's load is its minutes times how hard it was (1 to 5): from heart rate when the recording had it, otherwise a run's pace against your own usual, otherwise a typical value for the kind of activity. Runs, rucks, walks and rides count. Lifting does not: the rating asked after a workout says how it felt, not how hard it was. It is a comparison with your own recent weeks, not an injury forecast.
- **Long run, consistency and the year**: the longest run of each week and its trend; runs a week; weeks in a row with a run; and a yearly distance goal with where your last eight weeks' rate ends the year and what the goal needs from here.
- **Shoes**: miles for each pair, from the gear Strava names on an imported activity (runs, walks, hikes and rucks). A pair is flagged at 400 miles until you retire it.
- **Stretches**: on a run that has a route, *Mark a stretch of this route* (a hill, a lap, the last mile home). Every run of the same kind that follows it in the same direction, within 35 m and over about its length, is timed over it and ranked. A stretch's line is stored like a route and travels in backups.
- No street maps, no recording in the app, no spoken updates. Everything is worked out on the phone from the log; none of it uses the coach, and a route's coordinates are never part of what the coach can read.

## The coach

The Coach tab has two halves: tools built into the app, which need no account and cost nothing, and a chat with an AI that can look things up in the app and act on them.

**Built in, no AI** (`92-build-train.js`, `93-build-food.js`, `94-build-ui.js`). Each opens a sheet with every answer filled in, builds on the phone, and saves nothing until you tap a button on the review.

- *Build a program* — days a week, minutes a session, aim, the muscles you want to hit, what to steer around (pre-selected from lifts you tagged with pain), lifts to keep, familiar / mix / new, length and a deload week, equipment. It picks a split for the days (full body for 2–3, upper/lower for 4, upper/lower plus push/pull/legs for 5, push/pull/legs twice for 6), fills each slot by movement pattern from your exercise list (an exact movement always beats a near one; within that, what you know, how standard the lift is, and variety decide), sets reps and rest by aim and the lift's role, pushes each muscle toward its weekly range (more for the ones you asked for), and fits each day to the time by cutting in a fixed order — pairing accessories into supersets before dropping anything you asked for. The review shows every lift with why it was picked, the weekly sets per muscle against the range, and says plainly when the time given cannot cover everything. Tap any lift to swap it. Saved through the same checks as an import: a program with weeks, or a split.
- *Quick workout* — minutes, focus (several at once, or let it pick from what has recovered and what is behind this week), equipment. Conditioning becomes a circuit. Start it now or save it.
- *Why am I stuck?* — every lift that has not moved over three sessions, with what the log says about it: sets short of the plan, sets at failure, the same top set with nothing tried, weekly sets for the muscle, how often it is done, how long it has run, Patterns findings. Food, protein and sleep are said once, above the lifts. Fixes with Undo: a 10% back-off written to that lift's next target, a set more or fewer in every workout that has it, or a swap.
- *Check my targets* — calories and macros for lose / maintain / gain from your maintenance (from your own log when there is enough, the formula otherwise; a logged average below resting burn is treated as missing meals, not as maintenance). Rest-day targets keep their gap. Apply with Undo.
- *Plan my meals* — a week from the meals you have logged in the last 60 days and your saved meals, each scaled toward its share of the day and then the day landed on its targets (no food above three servings; protein trimmed when it overshoots, topped up with your own most protein-dense food when short; a snack added when a day runs short). Staples fill only the meals your log has nothing for, and it says so.
- *Review my week* opens Week in review; *Habits & happiness* shows what Patterns found about your habits and mood, with suggestions to keep, rethink or add a habit.

With the AI coach set up, each review also has *Ask coach*: what you type is sent with the draft (as an app note, with exercise ids), so the coach edits it rather than starting over. Without a key that box is not shown, and the AI-only starters (a meal from a photo, a program from a PDF) are replaced by a short note on setting the coach up.

**The AI coach.** Ask it anything about your training, food or progress, log a meal from a photo, or bring in a program from a photo or PDF.

**It uses your own AI account.** Settings → Connections → AI coach: choose Claude, ChatGPT, Gemini, OpenRouter, or any server that speaks the OpenAI chat format, paste an API key from that account, pick a model, and press *Test connection*. Usage is billed to you by that company. There is no key in this repository, in the built page, or shared between people — each person who uses the app enters their own.

**What it knows.** A chat starts with only: the date and time, your weight unit, goal and equipment setting, the names of your routines and active group, whether a meal plan exists, whether a workout is open, the two permission switches, and your coach notes. For anything else it has to call a tool, and each lookup is shown in the chat as a *Read* chip. Switch off *Read my logs* in AI settings and the history tools are not offered to the model at all.

**Asking about anything.** One tool, `query_data`, reads any of your data as a flat table (a row per day, per working set, per meal, per habit-day, and so on, 25 tables in all) with date ranges, filters and per-week or per-month totals. The app does the arithmetic, not the model, and links between two things still come only from Patterns. What every table and formula means is in [`docs/coach-data-sheet.md`](docs/coach-data-sheet.md), generated from the code (`npm run sheet`; a test fails while it is behind).

**Keeping it cheap.** Every step of an answer sends the rules and tool descriptions again, so the large building tools are not sent until a chat needs them. A small core (about 4,800 tokens a step) always goes; *Build workouts* (about 2,200 more), *Meal planning* (about 800) and *Habits* (about 300) are added when your message or the starter you tapped calls for them, or when the coach asks for them with `load_tools`, and then stay for the rest of that chat.

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

Settings → Connections → Reminders. A web app on an iPhone cannot schedule its own notifications — the only kind Apple allows is a push sent from a server, and this app has none. So reminders (workout days, weigh-in, logging food) are written as a small calendar file of repeating events with alerts and handed to the phone's Calendar, which fires them on time whether or not the app is open. Change a time and add again to update; delete the "… — Lah We" event in Calendar to stop one. A reminder's time can be set whether or not it is switched on; setting one switches it on.

## Installing

Settings → Your data → Install as an app shows the steps for each device. There is no App Store version and none is needed: *Add to Home Screen* gives a full-screen app with its own icon that works offline. The same sheet can download `lahwe.html`, the whole app as one file, which runs from disk on a computer (on an iPhone a saved file cannot keep data, so use the Home Screen there).

## Settings

A short list: your profile card, **Pause**, then seven groups (Units & calendar, Goals & targets, Workout, Check-in & tracking, Appearance, Connections, Your data). Each row says what is set now (*lbs · in · week from Mon · day ends 3 AM*), so checking a setting rarely needs a tap. A row opens its page; swipe down to go back. Everything saves the moment it changes — there is no Save button — and profile fields save as you leave them. Bodyweight is not in Settings: it is a log, entered with the weigh-in, and the profile shows the latest one.

- **Pause** (sick or hurt, travel, field duty / AT, other). A run of days with nothing expected: habit and training streaks hold, the days are neither done nor missed, food days are left out of "on target", and Patterns leaves them out so an odd week is not read as a cause. Anything you log still counts. A pause can be booked ahead or left open; an open one stops counting after 60 days. Home shows one line while it runs.
- **Units & calendar.** Weight and body-measurement units; the week starts on Monday or Sunday (weeks, the week strip, calendars, reports); **Day ends at** midnight or 1–4 AM — before that hour it is still the day before, so a 1 AM meal or lift lands on the day you are living in. Distances are in miles.
- **Goals & targets.** Goal, food targets (training and rest days), weight goal, the yearly running goal, and fitness-test scoring (General or Combat), each opening the editor it always had.
- **Workout.** Default rest and how the rest timer shows; **sounds** (Chime, Beep or Ring; volume Normal, Loud, Louder or Max; ring when rest ends; lower other audio while a sound plays; a Test button); the Simple swipe card's rest card and self-timing holds; automatic **warm-up sets** (off, first lift, every barbell lift); where **"last time"** comes from (the same workout first, or simply the latest session); **weight steps** per kind of equipment; **plates & dumbbells** you own; equipment; training days.
- **Check-in & tracking.** The one-tap questions, Running, and progress photos.
- **Appearance.** Theme (System follows the phone and switches with it, or Light / Dark), accent colour, Home layout.
- **Connections.** AI coach, Music, Reminders, Import from Strava.
- **Your data.** Back up, Restore, Undo last restore, **Export for a spreadsheet** (a .zip of CSV files: every set with warm-ups marked and estimated 1RM, meals, weigh-ins, activities — not a backup, it cannot be restored), Install as an app, and Erase everything at the bottom.

### Sounds

Rest ending, sprint and walk changes and the timed-set countdown all use one sound engine. Louder levels drive the sound through a limiter, so it gets louder without crackling, sit where a phone speaker is loudest (1–3 kHz), and add harmonics; Max plays each cue twice.

**The silent switch.** On an iPhone a web page's sounds are in Apple's "ambient" category: they mix with Spotify, and they are muted when the phone is on silent (the switch, or the Action button). A web page cannot dip other music: Safari's "transient" audio type maps to the same ambient category (WebKit bug 264473). The only way through silent mode is the "playback" type, and iPhone pauses other music while a playback sound is active. So **Play on silent** (Settings → Workout, iPhone only, off by default) switches to playback just for each cue and then hands the audio back; Spotify pauses for the cue and may not start again by itself. *Test the sound* says what the phone did with it. A web page cannot change the phone's own volume, and Spotify's remote volume does not work for music playing on an iPhone.

### Plates and dumbbells

With *Only what I own*, list the pairs of each plate you have and pick the bar. The plate calculator then loads from those plates (fewest plates for the weight, or the closest weights it can make), and the Simple card's + and − and next session's targets move between weights you can actually load. Dumbbells are typed as you would say them (`5-50, 55, 60`; a range steps by 5 lb or 2 kg, `/2.5` for another step). Switching weight units resets the kit to that unit's defaults.

## Swipe Check, Last, pyramid

- **Swipe Check** (*Swipe* in the workout's button row; choose *Simple* or *Super Simple*). One full-screen card per set, in the order you do them (supersets go round by round, warm-ups first). Swipe right = done, left = missed. The tab bar steps aside while it is open (*‹ List* and *Finish* are at the top). The two modes are deliberately different:
  - **Simple**: everything on the card. Weight and reps with big + and −, *Last* and *Aim*, a tag for how the set felt, plates, pyramid, the exercise note, timed sets that run themselves and (Settings → Workout) the rest on the card. On a short screen the card scrolls inside itself; a sideways drag is still the swipe.
  - **Super Simple**: glance and swipe. The lift, a dot for each set, and the target in very large type. Tap a number to change it (a stepper for that number alone; *Done* puts it away); a swipe can start on the numbers too. No tags, chips or Skip. The rest is always on the card as a ring, which rings and flips back to the next set.
  A miss is logged with the reps you actually got (a picker appears if you have not set them, and *0 · skip it* skips the set), counts toward volume, never counts as a PR, and makes the next target hold. *Skip* (Simple) logs nothing for that set. *Undo* steps back through the last 40 actions. A weighted lift with no weight refuses the swipe until you set one. A drag of 70 px or a quick flick of 40 px counts, and the buttons do the same as a swipe. The mode survives a reload.
- **Rest card** (Simple, on by default; Settings → Workout). After a set the card becomes the rest countdown with −15, +15 and *Go now*, and what is up next. When the rest ends it rings and flips to the next set by itself. *See the set* peeks at the card while the rest keeps running in the header.
- **Timed sets run themselves** (Simple, on by default). A plank or hold with planned seconds gets *Start*: a 3-2-1 lead-in, the countdown with ticks for the last three seconds, and at zero it rings and logs the set at the planned time (then the rest card). *Stop · log it* logs what you held — short of the plan, it counts as a miss, like a left swipe. The swipe buttons are put away while it runs.
- **Pyramid** (footer of a bodyweight lift with two or more sets): shape (up, down, up and down), step (1, 2, 3, 5) and the first set; unfinished sets get the reps, finished sets are untouched, and the toast has Undo.

- **Finish, Discard and Undo:** the finish sheet has *Cancel · keep going*. It has no *Save Workout* until at least one set is ticked, and it says how many sets are unticked (they will not count). *Discard workout* takes two taps: the first turns it red and says what will be lost, the second (within 4 seconds) throws the workout away; closing the sheet disarms it, and the toast still has Undo. After *Save Workout* the toast offers **Undo** for 8 seconds, which reopens the workout exactly as it was (rotation position, coach targets and swipe mode included).
- **While a workout is open**, the other tabs (not the coach) show a thin bar with its name, clock and rest; tap it to go back.
- **Fixing a set afterwards:** tap a set in History to change its weight, reps or whether it counts toward records; the toast has Undo.
- **Numbers that cannot be right are refused, and unusual ones are asked about.** Body weight outside 60–700 lbs (27–318 kg), a load over 1,500 lbs (680 kg), more than 100 reps or an hour-long set, negatives and activities in the future, over 24 hours or over 300 miles are refused with the reason. A weigh-in more than 10% from the last one within 60 days, a set whose estimated max is over 1.5× your previous best, and a run or ruck faster than 4 min/mi ask first.

## Targets, swaps, the week, a test date

These four work on the device with no AI and no network.

- **Targets** (Workout tab → *Targets* on a routine). What to aim for next session, lift by lift, from a built-in rule: add reps inside the planned range, add weight once every set reaches the top, repeat after a missed or hard session, back off about 10% after a pain tag or three stalled sessions. In a workout each lift shows *Plan*, *Last* and *Aim*; tapping the aim fills the unfinished sets, and tapping *Last* fills them with what you did last session, set for set (a finished set is never changed). The coach can adjust the targets, but only when you tap *Ask the coach*: one small request (a short instruction and that routine's last three sessions; no tools, no chat history), around a thousand tokens against roughly five thousand for a step of a chat question. Every number that comes back is checked against your last session and capped; anything that fails falls back to the rule.
- **Swap** (the *Swap* button on a lift in a workout). Substitutes come from the exercise list by movement pattern and muscle, then are ordered by what you have actually trained and by which substitute you picked before. Painful lifts sink. Finished sets stay logged under the original lift; when you finish, a swap can be saved to the routine as a replacement.
- **This week** (the card on the Workout tab). Planned days against what happened, four numbers chosen for your goal, and a check-in sheet with sets per muscle against the useful weekly range, lifts now against four weeks ago, and what stands out. Trends compare the last seven full days with the seven before; today counts from tomorrow, so a training day does not look like a drop until you have trained.
- **Test date** (Progress → Army Fitness → *Plan for a test date*). Counts back from the day of the test: phases ending in a one-week taper, a checkpoint for every event every week from your current and goal scores, one session a week per event with your numbers in it, and dates for practice tests that can go to your calendar.

## Library

Three views: **Programs**, **Workouts** and **Exercises**. In the app a routine is called a *workout* and a group of them a *split*; the saved data and the coach's tools keep the older names.

- **Programs** are kept side by side, each with its own name, so a new one does not replace the last. A program is splits in sequence, each for a number of weeks, optionally with a deload as the last week of a phase (half the sets, same weights). One runs at a time: starting another pauses the one running, which keeps its place. A program's week counts the weeks you trained in it, so a week off does not use one up. Its page shows the weeks done and to go, sessions done against planned, how sessions felt over the program, sets per muscle, its main lifts from start to now and any Army Fitness events. When the last week is done it is marked finished with a report kept as it was, and Home says so once. *Run again* starts a fresh round on the same splits; a program can be renamed, edited, paused, archived or deleted (with undo). Finished programs fold away; a program's workouts can be hidden from Workouts and the pickers without touching their history.
- **Workouts** are drawn as what they hit: one bar split by sets per muscle, about how long it takes, where it sits in the week, and a Start button. They are grouped by the program they belong to. A workout can set the reps to leave in reserve (0–4) for any exercise.
- **Exercises** are drawn as progress, each in what it is measured in: estimated max for weighted lifts, reps for bodyweight, time for holds and cardio, metres for sled work. Search finds common other names (RDL, OHP, skull crusher). Muscle filters and an **Equipment** filter (also used by the exercise picker and swaps). 152 exercises are built in, cardio included.
- **One exercise sheet** for the whole app: how often you do it, its records (estimated max, heaviest, most reps, longest hold or distance, best set and best session by volume), the muscles it works on a body figure (with *Change* to count it toward other muscles), how to do it, which workouts use it, its sessions, and *Add to a workout*. Your own exercises can be edited there too.
- **Form**: steps and tips for every built-in exercise, with start and finish photos for most, alternating so they read as the movement. The same sheet opens from the exercise name or the form button during a workout.
- **Shoulders** count as front, side and rear delts. Exercises you made before this were placed from their names, and the Exercises view asks you to check them once.
- *Build with coach* is on the page; the + lists the other ways to make a program or workout (by hand, import from a file or plain text, or a prompt to give another assistant).

## Progress

The Progress tab opens on a board of tiles, and you decide what is on it. It starts from the goal you chose at setup — strength leads with your lifts, weight loss with body weight, calories and maintenance, and so on — and *Edit* adds, removes and reorders tiles (drag the handle, or use the arrow keys). Reset puts the goal's set back.

- **Tiles**: lifts (estimated one-rep max for the lifts you pick), new records, **muscles**, hard sets, strength standards, body weight, maintenance, one measurement, **progress photos**, calories, protein, sessions, steps, the **month so far**, pace over a distance you repeat (a run, a ruck), and the Army Fitness Test.
- **Muscles** is the body figure, front and back, two ways: this week's sets against each muscle's useful range, or **recovery** — how fresh each muscle is now. Every working set adds fatigue to the muscles it trains (more when it was close to failure, less when easy), runs and rucks count toward the legs, and fatigue halves about every 18 hours for small muscles and 26 for big ones, so a hard session is cleared in about two days from arms and shoulders and three from legs, chest and back. It is an estimate from what you logged, and says so. Home mentions it when today's workout trains a muscle that is still well short of fresh.
- **Progress photos** are taken with a camera inside the app, pose by pose: shutter, *Keep*, and it moves to the next pose. Settings choose how many each time (1 front · 2 front, side · 3 adds the back · 4 adds the other side), a self-timer (3 or 10 s; with it one tap takes the whole set, each photo kept after three seconds unless you tap Retake), and a faint copy of your last photo of that pose to line up with. They never go to the camera roll, the coach or anywhere off the phone, and they pick up that day's weigh-in. The Photos sheet shows a row a check-in and a column a pose; compare any two check-ins pose by pose, side by side or with a slider. If the live camera will not start, the phone's own camera is used, one tap a pose. Older photos can be added from the library with their date. The first time, a short note says how many photos a check-in takes and where backups go. Home has a **Photos** tile (right after Weight; on the Nutrition layout from the start, on the others once you have photos): days since the last check-in, *Due* after two weeks, and one tap to the camera. It never shows a picture on Home, and neither does the Progress tile; the Photos list shows each pose as a blank tile until you tap *Show* (a switch in Settings turns that off).
- **Month and year in review** (the month tile, or the Week in review): sessions, active days, sets, volume, records beaten, the strongest gains, sets per muscle, what you did most, body weight, food, how sessions felt and programs finished, against the period before (the same days of it while the period is running). Home offers last month in the first week of the next, and the year from mid-December, once each.
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

Two optional one-tap questions feed it, each with a switch in Settings → Check-in & tracking: how the workout went (at Finish) and last night's sleep (with the weigh-in).

## Home

The app always opens on Home, whichever tab it was closed on (a workout in progress shows there).

Home is the overview of everything you track. It leads with today's workout, then a compact grid of the other areas, each with today's number and the tap that logs it: food (calories and protein against your goals), weight, supplements, cardio and sleep. An area appears only once you use it (food logged in the last two weeks, a recent weigh-in, a supplement, an activity, a sleep log), so a lifter who never logs food never sees a food tile. Then this week, one encouraging line (a pattern that applies today, or a real win), and one milestone with the distance to go (the test date if you have one; otherwise the next plate on a main lift, your weight goal, or a round number of sessions). Warnings moved to Progress, under *Needs a look*. The one reminder Home keeps is a backup that is overdue.

## Music

Settings → Connections → Music. A Spotify remote at the top of a workout: the track playing, with play, pause and skip. It controls Spotify on whatever device is already playing; a web page on an iPhone cannot play Spotify itself.

- It needs **Spotify Premium** (Spotify refuses playback control for free accounts) and **your own Spotify developer app**. Spotify limits a developer app to five people and requires its owner to have Premium, so one client ID shared by everyone who opens this page could not work. The sheet shows the exact redirect address to register and where to find the client ID.
- Sign-in is PKCE, which uses no client secret. The client ID and the sign-in Spotify returns are stored on the device only, outside the app's data: they are not in backups and not in this repository.
- YouTube is not offered. A web page cannot control the YouTube app, and a player inside this page would stop when the phone locks.

## Nutrition

- **What is left.** The tab opens on calories left for the day, then protein, carbs and fat against their targets. The arrows step back to any earlier day; its meals can be read and changed, and anything logged while a past day is showing goes to that day.
- **Order of the tab.** *Plan* and *Goals* at the top. Scan and Log meal, then one row of starred and recent tiles, then the day's meals, then *Fits what's left* (once something is logged), today's planned meals (when there are any), weight and maintenance, the last seven days as bars against each day's target (tap one to open it), supplements.
- **Stars keep an amount.** ★ on a food in the meal sheet stars it at the amount typed in the search, or the amount it was last logged at; the ★ in a food's own sheet (quick log or a scanned product) stars the amount on screen. The same food can be starred at more than one amount (chicken 6 oz at lunch, 10 oz at dinner). A starred tile opens the food at that amount, still adjustable. Saved meals can be starred too, and sit with the starred foods. Stars from before 3.19 became stars at the amount each food was last logged.
- **Recents are short and follow the meal.** At most eight tiles on the tab (nothing starred is repeated there), and 15 foods and 5 saved meals on the Recent tab, ordered by how often each is eaten at the meal being logged over the last 60 days, most recent first among equals.
- **Save as a meal.** On Review, right under the meal's totals: name it and it is saved and starred (switchable), to log whole in one tap from Starred or Meals.
- **Log meal is a full-screen sheet in two steps.** *Pick*: the food list is the whole screen; each food tapped goes into the meal, and what is in it so far is one bar at the bottom (how many, which, the calories). *Review* (tap the bar): every item with its amount, kind and cooking fat, the meal's totals, what the day has left after it (or, when planning, what the planned day comes to), the meal (Breakfast, Lunch…, starting on the likely one), the date, and the button. *Add food* goes back to the list. A meal being changed, logged, planned or saved, opens straight on Review. *By hand* is a tab for a meal you only know the numbers for; those numbers add to any foods picked. Removing an item has Undo.
- **Any kind.** "Steak", "Chicken", "Ground Beef", "Pork", "Fish", "Rice", "Bread", "Cheese", "Nuts", "Beans" and "Milk" are entries of their own, for when the cut does not matter. Their numbers are worked out from the specific foods in the list (steak is the average of flank, sirloin, filet and ribeye), and a switch moves them to the lean or the fatty end; the app remembers how you last set each one. The specific cuts are still listed underneath.
- **Raw or cooked.** The list's meat and fish numbers are for raw weight. A Raw / Cooked switch on those foods gives the numbers for the same weight after cooking (meat and poultry lose about a quarter of their weight, fish about a fifth; a rule of thumb, good to roughly 10%). Rice and pasta are listed cooked and have a Dry switch, by weight.
- **Type the amount.** "steak 8 oz", "200g rice" or "2 eggs" in the meal search fills in the amount; Return adds the first result. Ratios and percentages in a name ("90/10", "2%") are left alone, and a household measure ("2 tbsp peanut butter") is not turned into a number of servings.
- **Cooking fat.** Meat, fish and eggs offer "+ oil" and "+ butter": a teaspoon as its own line in the meal.
- **Log by weight.** An amount can be servings, grams or ounces. Most built-in foods carry the weight of their serving (USDA household measures: a cup of cooked rice is 158 g), a scanned product uses the label's, and your own foods take an optional weight or one written in the serving ("100 g", "4 oz", "1/4 lb"). The app remembers which unit you last used for each food. Foods that vary too much by brand or recipe (a protein bar, a biscuit) have no weight and are logged by the serving.
- **Meals are editable.** Tap a logged meal to change amounts, items, date or meal; it is replaced in place, with Undo. Delete is inside the meal's sheet, not on its row.
- **Swap an item.** *Swap for another food* under an item in the meal sheet: the next food tapped or scanned takes its place, at the same weight when both can be weighed, otherwise the same number of servings.
- **Saved meals** are kept in any number. *Log meal → Meals* lists them starred first, then by how often they are logged; the pencil opens one in the same sheet to rename it or change its foods and amounts (Undo after saving; Delete is inside). *New saved meal* makes one from scratch. Opened over a meal being logged, that meal comes back as it was afterwards.
- **Again.** The repeat button on a meal logs the same meal again today. *Copy from a day* brings one or all of an earlier day's meals into the day on screen.
- **Your own foods.** In *Log meal → Foods*, *New food* (or *Create “…”* under a search with no match) adds a food with its label numbers. Your foods (made or scanned) are listed first, newest on top, then the built-in list. They have an edit button, also reachable from an item in a meal (*Fix this food's numbers*), and can be deleted.
- **Correcting a food carries through.** Saved meals and the meal plan that use it follow at once (with Undo). Meals already logged are asked about: *Fix them* corrects every logged entry that still has the old numbers, keeping the amount eaten (a weighed amount stays the same weight), and moves that meal's total by exactly the change, so numbers typed in by hand stay put. Those days' totals, maintenance and Patterns then use the corrected numbers. Entries with other numbers are left alone, and the fix has Undo.
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
- A product whose numbers are wrong can be corrected from that sheet (*These numbers are wrong: fix them*), or later from the food's own edit button; the next scan uses the correction, and logged entries can be corrected with it (see *Correcting a food carries through*). The 12-digit and 13-digit forms of one barcode are treated as the same product.
- **A barcode the database does not know** can be linked to one of your foods (*It's one of my foods* on *Product not found*). The next scan of it opens that food straight away, with no lookup; the food's sheet says which barcode opened it and can unlink it.
- The reader library (`vendor/zxing.min.js`, MIT) ships with the app and is loaded on first scan, then kept for offline use. A single saved file falls back to the same file on a CDN, pinned by hash.

## Meal plan

Nutrition → *Plan* (top of the tab). A full-screen page for **this week and next week**, each meal built from foods in your list (or a food with its own numbers, marked *est.*).

- **Every week, or one date.** A planned meal is either for its date only, or on that weekday every week (marked *every Wed*). A new meal is for its date; the *Every Wednesday* switch on the meal's Review makes it weekly. Editing a weekly meal with the switch off changes that one date only (the usual one is skipped there, the changed one put in its place). Removing a weekly meal asks: *Just this date* or *Every Wednesday*. *Copy to…* and suggestions add one-date meals. The coach plans the weekly pattern.
- **Planned meals count in your day.** With *Planned meals count in my day* on (the default, at the bottom of the plan), each of today's planned meals goes into the log when its time comes: breakfast from 5 am, lunch from 11, snack from 3 pm, dinner from 5 pm (pre-workout 7 am, post-workout noon). They show *Planned* in today's meals with a **Didn't eat** button that takes one off the day's count without touching the plan, and it is not added again. Nothing is ever added to a day that has passed, and nothing on a full fast. Removing a meal from today's plan takes out the copy it put in the log by itself; one you logged yourself stays. Off, the card on the Nutrition tab has a *Log* button per planned meal instead.

- **The week.** What is planned for the week against what your targets add up to, and seven bars, one a day, against each day's own target (training or rest day, fast or light day). Until every day is planned to at least 80% of its target, it says how much is *left to plan*; once it is, the difference from your targets and what that comes to in pounds (or kg) a week. Tap a bar to open that day.
- **A day.** *Eat / Light day / Fast*, for that date, or *Every Wednesday* from the line under it. A light day aims at about 500 kcal for a woman, 600 for a man, mostly protein (the 5:2 kind); a fast aims at nothing. Each meal is one line; tap it for its foods, a **portion** stepper (½× to 3×, every food in the meal together), *Log*, *Edit*, *Copy to…* other days, and remove. *Add a meal* opens the meal sheet in plan mode.
- **Fasting warnings**, in one box: more than two fasting days a week, two in a row (Sunday runs into Monday), a full fast on a scheduled training day, meals left on a fast day, and a week that averages under 1,500 kcal (1,200 for a woman). Warnings, not blocks.
- **Reach the target.** Under the day: picks from your saved meals, starred foods (at their starred amounts) and meals planned on other days that fit what is left, protein first, and *Fills the day*: the best one to three of them that land within 90–105% of what is left. One tap adds them, into the meals not yet planned, with Undo. No AI.
- Today's planned meals sit on the Nutrition tab; **Log** writes one to today's intake in a tap and marks it logged.
- **Schedule** (Home) has a *Meal plan* view: coming days show their planned calories, fasts and light days are marked, past days show what was eaten. Tap a coming day to open it in the plan.
- **Grocery list.** By aisle (produce, meat and fish, eggs and dairy…), for the rest of this week from today, or for next week. Foods weighed in the plan are added up by weight and listed as you buy them: cooked meat and fish as raw (a quarter heavier), cooked rice and pasta as dry. Foods counted by the serving stay counted ("6 eggs"). Each line says how many meals it is for. Add your own lines (coffee, foil); ticks are remembered.
- **Sharing.** The grocery list has a *Share* button pinned to the bottom; it opens the phone's share sheet (pick Messages to text it) with the list as plain text: a dated heading, aisles, one bullet per item, and only what is still unticked (everything, once all of it is ticked). The plan page's share button sends the week on screen as *Meal plan* (day by day, each meal and what goes in it, fasts and light days noted, calories optional), *Grocery list*, or *Both, in one message* — for a partner who cooks or shops. With no share sheet (a desktop browser) the text is copied instead.
- The coach can draft or adjust the plan (it sees fasting days); it reports each day against your targets and the plan only changes when you tap *Use this plan*.

## What talks to the network

| When | Where | What is sent |
| --- | --- | --- |
| Scanning a barcode | world.openfoodfacts.org (and cdn.jsdelivr.net only when the app runs as a single saved file) | Looks up the barcode number. The scanner library comes with the app; the saved-file fallback is pinned by hash. |
| Opening an exercise's form | cdn.jsdelivr.net (the free-exercise-db photos, public domain, pinned to one commit) | Nothing but the request for the two photos. Only when a form sheet is opened, or in the background a few seconds after a workout starts; kept by the service worker after the first view, so they work offline. |
| Using the Spotify remote, if you set it up | accounts.spotify.com, api.spotify.com, and Spotify's image host for album art | Sign-in with your own client ID; playback commands. |
| Using the coach | The provider you chose: api.anthropic.com, api.openai.com, generativelanguage.googleapis.com, openrouter.ai, or your own server | Your messages and attachments, the rules, and the data shown in *Read* chips. Your key, in a header. |

Nothing else leaves the device. The charts are drawn by the app and it uses the system font, so opening it makes no request to anyone. The page sends no referrer. *Watch videos of it on YouTube* in a form sheet is an ordinary link that opens YouTube's search; nothing is embedded.

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
  65–67  coach        rules, tools and tool groups; the data tables (65b); the conversation loop, the Coach tab, AI settings; saved chats and "Made by coach"
  92–94  builders     the Coach tab's tools that need no AI: programs, quick workouts, stalled lifts, targets, meal plans, and their sheets
  70–73  settings, backup/restore, CSV export, card-deck and sprint modes, reminders and install help
  86–88  pause, plates and dumbbells (gear), sounds (cues)
  99     startup
src/public/           service worker, manifest, icons (copied to dist/)
vendor/               the barcode reader (ZXing)
test/unit/            node --test, loads the built script into a sandbox (test/harness.js)
test/e2e/smoke.js     drives dist/index.html in headless Chromium at phone size
test/e2e/upgrade.js   logs data with legacy/lahwe2_01.html, then opens the new build on the same address
test/e2e/swipe.js    Swipe Check, Last chip and pyramid with the mouse in phone emulation
test/e2e/subpath.js   serves dist/ under /LahWe/ like the hosted copy; offline reload; a second visitor starts empty
test/e2e/settings.js  Settings pages, Pause, plates, the rest card flipping and a timed set running, in phone emulation
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
- **Coach tools** come in three kinds (`65-coach-tools.js`): *read* (`run` returns data and a label for the chip), *write* (`prepare` validates and returns an `apply` that changes `S` and returns plain-data `undo`), and *propose* (`check` is pure and returns feedback for the model; `coachApplyProposal()` writes when the card is tapped). Schemas use only `type`, `description`, `properties`, `required`, `items` and string `enum`, because that is what all four providers accept. Model text is shown through `mdLite()`, which escapes first. A large tool used now and then belongs in a group (`COACH_GROUPS`) so it is not sent on every step; a rule line that only matters with that group is written `{g, t}`. A question about data needs a table in `QD_TABLES` (`65b-coach-data.js`) rather than a new read tool: a table costs nothing per step, a tool costs its description on every step.

Before pushing: `npm run check` (build, credential scan, unit tests, four browser tests). `dist/` is committed, and the workflow fails if it does not match the source, so build before you commit. The smoke test includes a pass that fills every text field and id with hostile strings and checks nothing becomes markup or script on any screen.

## Known limits

- Tested in headless Chromium and Node, not on a physical iPhone. Things only a phone can confirm: how the Swipe Check drag feels under a thumb (the distance and speed are constants at the top of `83-swipe.js`), the share-sheet backup and the grocery/plan share, the wake lock, rest-timer sound after the screen has been off, camera scanning, and how the coach's message box sits above the on-screen keyboard.
- The coach has been tested against scripted replies in each provider's documented format, not against the live services (no key is available to the tests, by design). The request and reply shapes follow each provider's current documentation; Claude's endpoint was confirmed to accept browser requests, OpenAI's and OpenRouter's are reported to, and Gemini's has not been confirmed. *Test connection* in AI settings tells you in a few seconds whether your provider, key and model work from your device. If one does not, OpenRouter offers the same models.
- The scanner is tested with a generated barcode video played as a fake camera (`test/e2e/scanner.js`), including refused permission, a busy camera, a stream with no picture and the app going to the background. That proves the software path, not the optics: focus distance, glare and how iOS behaves on your phone can only be checked there.
- The Spotify remote is tested against scripted replies in Spotify's documented format, not against Spotify. Two things only a real phone and account can confirm: that the sign-in returns to the Home Screen app rather than to Safari (there is a paste-the-code fallback if it does not), and Spotify's own behaviour for your account.
- The look was checked in Chromium with Inter standing in for San Francisco; on an iPhone the system font is used. `node tools/shots.js` regenerates the screenshots with demo data.
- Suggested model names are current as of October 2026 and will age. *List my models* asks the provider what your key can use, and any model name can be typed in.
- Sound levels and ducking were checked in Chromium, which has no Audio Session API. How loud *Max* is on your iPhone's speaker, whether Play on silent lets Spotify start again after a cue, and whether a cue sounds after the screen has been off can only be confirmed on the phone: Settings → Workout → *Test the sound*, with music playing.
- iOS pauses web timers when the phone locks. The rest timer and sprint intervals recover the correct time when you come back, but they cannot sound while the screen is off. The screen is kept awake during a session to avoid this.
- The calorie figures are estimates from body size, time and published MET values. They are for trends, not accounting.
- Recovery is a model of what you logged (sets, how hard, minutes of cardio), not a measurement. Sleep, food, stress and soreness are not in it.
- Form photos exist for most built-in exercises, not all (about 130 of 152); some show a close variation and say so. Your own exercises have no steps. The photos come from free-exercise-db and were checked by name, not individually by a coach.
- The in-app camera is tested with Chromium's fake camera, not an iPhone: how the self-timer pace feels, front-camera mirroring, and the permission prompt from the Home Screen can only be confirmed on the phone. Zip backups are checked by an independent reader in the tests.


## Schedule

The calendar, with any program drawn on it, is a page of Home: the *Schedule* button on the week card opens it, and *Home* brings you back. It used to be a third view of Progress.

## Weight and weigh-ins

There is one weigh-in sheet (Home's Weight tile, the Progress weight tile, or the Weigh in button). The weight goal (target and direction) is set from the Progress weight tile, where the trend is; Daily Goals on Nutrition holds calories and macros only.
