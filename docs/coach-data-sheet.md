# Lah We — data sheet

Generated from `src/js/65b-coach-data.js` by `npm run sheet`. Do not edit by hand: change the code and regenerate (a unit test fails while this file is behind).

The coach reads these tables through one tool, `query_data`. Every table is read-only and built from the app's own helpers, so its numbers match the screens. Filtering, grouping and sums happen in the app; the model never adds up rows itself. Tables marked *logs* are hidden when "Read my logs" is off.

Not readable by the coach, on purpose: API keys and sign-ins (never stored with the data), progress photos, route GPS points, past coach chats.

## Query

| Parameter | Meaning |
| --- | --- |
| `table` | Which table. |
| `describe` | `true` returns the layout instead of rows; with no table, the list of tables. |
| `from`, `to` | `YYYY-MM-DD`, `today`, `yesterday`, or days back (`90`). Default: the last 30 days. `schedule` defaults to the next 14 days and accepts `+14`. |
| `where` | `[{col, op, value}]`, all must hold. `op`: `=`, `!=`, `>`, `>=`, `<`, `<=`, `contains`, `in`. |
| `columns` | Which columns to return. |
| `group_by` | Up to three columns; `week`, `month` and `weekday` work on any table with a date. |
| `aggregate` | `[{fn, col}]`, `fn`: `count`, `distinct`, `sum`, `avg`, `min`, `max`, `first`, `last`. Output column `fn_col`. |
| `sort` | A result column, `-` in front for highest first. Default newest first. |
| `limit` | 1-200, default 50. Results are also trimmed to about 11,000 characters. |

Example: average protein per week over 12 weeks, `{"table":"daily","from":"84","group_by":["week"],"aggregate":[{"fn":"avg","col":"protein_g"},{"fn":"sum","col":"sessions"}]}`.

## Tables

### daily

One row per day, with everything logged that day side by side. *logs*

In the app: Home check-in, Nutrition, Progress → Calendar · has dates

| Column | Meaning |
| --- | --- |
| `date` | YYYY-MM-DD |
| `trained` | true if a workout was finished |
| `sessions` | workouts finished |
| `working_sets` | working sets done |
| `volume` | weight × reps |
| `workout_minutes` | active minutes of workouts |
| `feel` | average end-of-workout rating, 1-5 |
| `cardio_minutes` | minutes of activities |
| `miles` | miles of activities |
| `kcal` | calories eaten (null when nothing logged) |
| `protein_g` | protein eaten |
| `carbs_g` | carbs eaten |
| `fat_g` | fat eaten |
| `target_kcal` | that day's calorie target |
| `target_protein_g` | that day's protein target |
| `day_kind` | training or rest (picks the targets) |
| `meals_logged` | meals logged |
| `weight` | weigh-in (null when none) |
| `sleep_h` | hours slept the night before |
| `mood` | mood rating 1-5 |
| `steps` | steps |
| `habits_kept` | habits kept |
| `habits_due` | habits due (kept + missed) |
| `supplements_taken` | supplements ticked |
| `paused` | true on a paused day (sick, travel, field duty) |
| `planned_training_day` | true/false with a fixed weekly schedule, null with a rotation |

### workouts

One row per finished workout. *logs*

In the app: Progress → History · has dates

| Column | Meaning |
| --- | --- |
| `id` | workout id |
| `date` | YYYY-MM-DD |
| `name` | workout name |
| `routine` | the routine it came from, if any |
| `program` | the program it counted toward, if any |
| `minutes` | start to finish |
| `working_sets` | working sets |
| `volume` | weight × reps |
| `exercises` | exercises done |
| `kcal` | estimated calories |
| `feel` | end-of-workout rating, 1-5 |
| `notes` | the user's note |

### sets

One row per working set (warm-ups left out). *logs*

In the app: Progress → History → a workout · has dates

| Column | Meaning |
| --- | --- |
| `date` | YYYY-MM-DD |
| `workout` | workout name |
| `workout_id` | workout id |
| `exercise` | exercise name |
| `ex_id` | exercise id |
| `muscle` | primary muscle |
| `equipment` | equipment |
| `set` | set number within the exercise |
| `weight` | weight in the user's unit (0 = bodyweight) |
| `reps` | reps |
| `seconds` | held for, on timed sets |
| `e1rm` | estimated max from this set (see formulas) |
| `rir` | reps left in reserve, when logged |
| `tag` | Easy, Hard, Pain or Form Issue, when tagged |
| `failed` | true if the set was failed |
| `excluded` | true if left out of records |

### records

One row per exercise with a personal record. *logs*

In the app: Progress → New records tile

| Column | Meaning |
| --- | --- |
| `exercise` | exercise name |
| `ex_id` | exercise id |
| `muscle` | primary muscle |
| `weight` | weight of the record set |
| `reps` | reps of the record set |
| `e1rm` | estimated max |
| `date` | when it was set |
| `carried_over` | true if typed in by hand rather than logged |

### meals

One row per logged meal. *logs*

In the app: Nutrition · has dates

| Column | Meaning |
| --- | --- |
| `id` | meal id |
| `date` | YYYY-MM-DD |
| `meal` | Breakfast, Lunch, Dinner, Snack… |
| `name` | saved-meal name, if any |
| `kcal` | calories |
| `protein_g` | protein |
| `carbs_g` | carbs |
| `fat_g` | fat |
| `items` | foods in it |
| `estimate` | true if any part is an estimate |

### meal_items

One row per food inside a logged meal. *logs*

In the app: Nutrition → a meal · has dates

| Column | Meaning |
| --- | --- |
| `date` | YYYY-MM-DD |
| `meal` | meal slot |
| `meal_id` | meal id |
| `food` | food name |
| `food_id` | food id (null for a typed-in food) |
| `servings` | servings eaten |
| `serving` | serving size |
| `kcal` | calories for the amount eaten |
| `protein_g` | protein for the amount eaten |
| `carbs_g` | carbs |
| `fat_g` | fat |
| `estimate` | true if an estimate |

### measurements

One row per body measurement taken. *logs*

In the app: Progress → measurement tile · has dates

| Column | Meaning |
| --- | --- |
| `date` | YYYY-MM-DD |
| `part` | what was measured (waist, chest…) |
| `value` | the measurement |
| `unit` | in or cm |

### activities

One row per activity (run, ruck, bike, hike, swim, walk…). *logs*

In the app: Progress → History; Running page · has dates

| Column | Meaning |
| --- | --- |
| `id` | activity id |
| `date` | YYYY-MM-DD |
| `type` | kind of activity |
| `minutes` | duration |
| `miles` | distance |
| `pace_min_per_mile` | minutes per mile (runs, rucks, walks, hikes) |
| `kcal` | estimated calories |
| `avg_hr` | average heart rate, from a recording |
| `climb_ft` | feet climbed, from a recording |
| `shoe` | shoes, from Strava |
| `load` | training load (see formulas) |
| `estimated` | true if the distance or time was estimated |
| `notes` | the user's note |

### habit_days

One row per habit per day it was due. *logs*

In the app: Home → Habits · has dates

| Column | Meaning |
| --- | --- |
| `date` | YYYY-MM-DD |
| `habit` | habit name |
| `kind` | done, amount, avoid or auto |
| `status` | done, miss (due and not kept), blank (nothing logged that day) or open (today, still to do) |
| `amount` | amount reached (amount habits) |
| `target` | daily target (amount habits) |
| `archived` | true if the habit is archived |

### supplements

One row per supplement per day. *logs*

In the app: Nutrition → Supplements · has dates

| Column | Meaning |
| --- | --- |
| `date` | YYYY-MM-DD |
| `supplement` | name |
| `dose` | dose as typed |
| `taken` | true if ticked that day |

### patterns

One row per relationship the Patterns engine tested in the user's own log. The only source for "X goes with Y". *logs*

In the app: Progress → Patterns

| Column | Meaning |
| --- | --- |
| `finding` | what was found, in the app's words (null when nothing was found) |
| `test` | what was tested |
| `family` | area (Recovery, Fuel, Sleep, Habits…) |
| `tier` | solid, likely, early (a lead, not a finding), none (tested, nothing found) or more (needs more days) |
| `cases` | cases it rests on |
| `lift` | the lift it is about, if any |
| `have` | cases so far (tier more) |
| `need` | cases needed on each side (tier more) |

### programs

One row per saved program. *logs*

In the app: Library → Splits

| Column | Meaning |
| --- | --- |
| `name` | program name |
| `status` | saved, running, paused, finished or archived |
| `week` | current program week |
| `of_weeks` | weeks in the program |
| `sessions` | workouts counted toward it |
| `adherence_pct` | workouts done ÷ planned over finished weeks |
| `avg_feel` | average end-of-workout rating |
| `first` | first workout date |
| `last` | last workout date |
| `finish_by` | expected last day if it keeps running |

### program_weeks

One row per trained week of each program. *logs*

In the app: Library → Splits → a program

| Column | Meaning |
| --- | --- |
| `program` | program name |
| `week` | program week |
| `week_of` | first day of that calendar week |
| `split` | the split in use that week |
| `planned` | workouts planned |
| `done` | workouts done |
| `avg_feel` | average end-of-workout rating |
| `deload` | true on a deload week |
| `current` | true for this week |

### recovery

One row per muscle: how recovered it is right now. *logs*

In the app: Progress → hard sets tile → recovery map

| Column | Meaning |
| --- | --- |
| `muscle` | muscle |
| `fresh_pct` | 0-100 (see formulas) |
| `status` | ready, mid or tired |
| `last_trained` | last day it was worked |
| `ready_at` | when it should be back to 85% |

### run_weeks

One row per calendar week from the first run: miles run. *logs*

In the app: Running page · has dates

| Column | Meaning |
| --- | --- |
| `date` | first day of the week |
| `miles` | miles run |
| `runs` | runs |
| `longest_mi` | longest run |
| `jump_pct` | % over the four weeks before, when the app flags a sudden jump |

### run_bests

One row per standard distance: best effort and predicted time. *logs*

In the app: Running page; Progress → Best efforts, Race predictor

| Column | Meaning |
| --- | --- |
| `distance` | Mile, 2 mi, 5K, 10K, Half |
| `best` | best time (h:mm:ss) |
| `best_seconds` | best time in seconds |
| `best_date` | when |
| `whole_run` | true if the whole run was that distance (not a stretch of a longer one) |
| `predicted` | predicted time on current form |
| `predicted_from` | which run the prediction comes from |

### shoes

One row per pair of shoes named on imported activities. *logs*

In the app: Running page → Shoes

| Column | Meaning |
| --- | --- |
| `name` | shoe name |
| `miles` | miles on them |
| `runs` | activities |
| `first` | first used |
| `last` | last used |
| `retired` | true if retired |
| `worn` | true once past the replace-soon mileage |

### schedule

One row per day: what is planned and what was done. The range may run ahead; the default is the next 14 days.

In the app: Home → Schedule · has dates

| Column | Meaning |
| --- | --- |
| `date` | YYYY-MM-DD |
| `planned_training` | true/false with a fixed weekly schedule or an override, null with a rotation |
| `planned` | routines pinned to that day or set for it |
| `override` | rest or active when the day was changed by hand |
| `paused` | true on a paused day |
| `done` | workouts finished that day |

### pauses

One row per pause (days when nothing is expected).

In the app: Settings → Pause

| Column | Meaning |
| --- | --- |
| `from` | first day |
| `to` | last day (null = still on) |
| `why` | sick, travel, field or other |

### targets

One row per lift in each active routine: what to aim for next session. *logs*

In the app: Home → Targets; during a workout

| Column | Meaning |
| --- | --- |
| `routine` | routine name |
| `exercise` | exercise |
| `aim_weight` | weight to aim for (0 = bodyweight) |
| `aim_reps` | reps (or seconds) to aim for |
| `sets` | working sets |
| `change` | up, down, hold or reps |
| `by` | rule or coach |
| `why` | the reason given |
| `last_time` | top set last time |

### test_plan

One row per Army Fitness Test event in the test-date plan (empty with no plan). *logs*

In the app: Progress → Army Fitness Test tile → test-date plan

| Column | Meaning |
| --- | --- |
| `test_date` | the test day |
| `week` | plan week now |
| `of_weeks` | weeks in the plan |
| `phase` | current phase |
| `event` | event |
| `start` | result when the plan began |
| `now` | latest result |
| `aim_this_week` | checkpoint for this week |
| `goal` | goal |
| `status` | on, behind, met, untested, nostart or nogoal |

### month_reports

One row per calendar month: the monthly report's numbers. Group nothing; the range picks the months. *logs*

In the app: Progress → monthly report · has dates

| Column | Meaning |
| --- | --- |
| `date` | first day of the month |
| `month` | YYYY-MM |
| `sessions` | workouts |
| `per_week` | workouts a week |
| `active_days` | days with a workout or activity |
| `working_sets` | working sets |
| `volume` | weight × reps |
| `avg_kcal` | average calories on logged days |
| `avg_protein_g` | average protein on logged days |
| `food_days` | days with food logged |
| `weight_change` | first to last weigh-in of the month |
| `avg_feel` | average end-of-workout rating |
| `avg_mood` | average mood |
| `cardio_minutes` | activity minutes |
| `records` | new records |
| `top_lifts` | most-done lifts |

### week_review

Week in review as it stands now: the headline and each point (the last 7 full days against the 7 before). *logs*

In the app: Home → week card

| Column | Meaning |
| --- | --- |
| `kind` | headline or point |
| `tone` | good, warn, bad or info |
| `title` | the line |
| `detail` | the detail under it |

### settings

How the app is set up, one row per setting (read-only).

In the app: Settings

| Column | Meaning |
| --- | --- |
| `setting` | name |
| `value` | current value |
| `meaning` | what it does |

### formulas

How the app's own numbers are worked out.

In the app: —

| Column | Meaning |
| --- | --- |
| `name` | formula |
| `used_for` | where the number appears |
| `how` | how it is calculated |

## Formulas

| Name | Used for | How |
| --- | --- | --- |
| `working_set` | sets, workouts, daily | A set counts when it is ticked done and is not a warm-up. Failed sets count as work but never as a record. |
| `e1rm` | sets, records, Progress lift charts | Estimated one-rep max, Epley: weight × (1 + reps ÷ 30); a single is the weight itself. Only working sets with a weight and reps; not timed, cardio, assisted, failed or excluded sets. |
| `volume` | workouts, daily, month_reports | Weight × reps summed over working sets. Timed, distance and cardio exercises add nothing. |
| `hard_sets_per_muscle` | Progress hard-sets tile, get_training_summary | Each working set counts 1 toward its exercise's primary muscle and 0.5 toward each secondary muscle. Weekly minimum and maximum per muscle come from the app's own table. |
| `weight_trend` | get_body, week_review | A straight line fitted through the weigh-ins of the last 28 days; needs two or more readings at least three days apart. Reported as change per week. |
| `maintenance_from_logs` | get_body, get_profile, Nutrition → Weight and maintenance | Average logged intake over the last 28 days, adjusted by the weight trend over the same days (about 3,500 kcal per lb). Needs 4+ weigh-ins over 14+ days and food logged on 70% of days (at least 10). Days under half the median are left out as partly logged. Comes with a 95% margin. |
| `maintenance_estimate` | get_profile, until maintenance_from_logs is available | BMR (Mifflin-St Jeor) × 1.2, plus the calories of exercise logged over the last 7 days. |
| `calorie_floor` | propose_targets | Targets are never set below 1,500 kcal a day for a man or 1,200 for a woman. |
| `recovery` | recovery | Each working set adds fatigue to the muscles it works (1 per set, more with little in reserve or a Hard tag, less when Easy). Fatigue halves every 18 hours for small muscles and 26 for large ones. Fresh = 100 × (1 − fatigue ÷ the muscle's cap). Ready when it is back to 85%. |
| `training_load` | activities, Running page | Minutes × effort (1-5). Effort comes from average heart rate against max, else pace against the usual 5K pace, else a typical value for the kind of activity. The last 7 days are compared with the 28-day weekly average. |
| `race_predictor` | run_bests | Riegel: time₂ = time₁ × (distance₂ ÷ distance₁)^1.06, from runs in the last 12 weeks (26 if none), using efforts at least a fifth of the target distance; the fastest answer wins. |
| `habit_streak_and_strength` | habit_days, get_habits_and_mood | A streak survives one missed scheduled day; two misses in a row end it. Strength is a weighted share of scheduled days kept, where a day's weight halves every 13 scheduled days. |
| `patterns` | patterns | Each test compares the user's own results when something happened against when it did not, measured against their own trend. A finding needs about 10 cases on each side, must hold in both halves of the history and survive a correction for the number of tests. Wording is "tends to", never "causes". |
| `program_adherence` | programs, program_weeks | Workouts done ÷ workouts planned, over finished weeks of the program. A week's rating is the average end-of-workout rating (1-5). |
| `next_session_target` | targets | Add reps inside the range; add weight once every set reaches the top; repeat after missed reps or a session tagged hard; about 10% lighter after a pain tag or three stalled sessions. A coach-set target replaces the rule until that workout is done. |
| `strength_standards` | get_records | Estimated max against multiples of body weight for each main lift: Beginner, Novice, Intermediate, Advanced, Elite. |
