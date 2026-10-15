# Lah We — program import format

Three ways to get a program into the app without typing it exercise by exercise:

1. **Plain text** (Library → Programs → + → Import). Paste day headings and exercise lines like `Bench Press 4x8-10 90s`. No AI is involved; the preview shows what was read.
2. **Ask the coach** (Coach tab → *Build a program*, or Library → *Build with coach*). Describe the program or attach a photo, screenshot or PDF. The app calls the AI provider you set up, with your own key, and shows the result as a card to review.
3. **JSON from another assistant** (Import → *Copy the prompt*). The app copies the prompt below with the current catalog; give it and your program to any chat assistant and paste back the JSON.

Every way ends in the same preview: each workout can be opened to check its exercises, an exercise can be tapped to change what it matched, new custom exercises are listed with the muscle they will count toward, and nothing is saved until you tap Import. A program with weeks is saved as a **program** you can name, start now or keep for later.

---

## Plain text

```
Upper A (Mon)
Bench Press 4x6-8 150s
Barbell Row 4x8-10 120s
Lateral Raise 3x12-15 60s
Plank 3x45s

Lower A (Tue)
Back Squat 4x5 RIR 2
Romanian Deadlift 3 sets of 8-10
Sled Drag 4x50m
```

A line with sets and reps is an exercise: `4x8`, `4 x 8-10`, `3 sets of 10`, `3x45s`, `2x20 min`, `4x50m`, `3xAMRAP`. A rest (`90s`, `2 min`) and anything else on the line (`RIR 2`, `each side`, a cue) are kept. Any other short line starts a new workout; weekday names in it (`Mon`, `Thursday`) put the workouts on those days.

---

## Prompt to give an assistant

The app's *Copy the prompt* button copies this with the catalog as it is today.

```
Convert the workout program I give you into JSON for the "Lah We" app. Return ONLY the JSON object.

{"program":{"name":"<program name>","notes":"<one line>"},
 "groups":[{"name":"<phase name>","mode":"daypicker" or "rotation","weeks":<length, 0 if not phased>,"deloadLastWeek":false,
   "routines":[{"name":"<day name>","notes":"","days":["Mon"],"exercises":[<exercise>, ...]}]}]}

One group per phase with genuinely different exercises, in order, each with "weeks". One routine per training day; "days" only for fixed weekdays.

EXERCISE: {"name":"Barbell Bench Press","sets":4,"reps":"6-8","rest":150,"rir":2,"type":"flat","link":null,"note":""}
- reps: 10 · "8-12" · "AMRAP" · "10+" · "45s" · "1:30" · "20 min" · "50m" (a distance)
- sets are WORKING sets; the app adds warm-ups. rir = reps to leave in reserve (0-4), if the program says.
- type: "flat", "ascend" (weight up each set) or "descend" (drop sets). link: the same letter on consecutive exercises makes a superset.
- Use the catalog name below when it is the same movement and equipment; then nothing else is needed.
- For anything not in the catalog keep the program's name and add "equipment" (Barbell, Dumbbell, Kettlebell, Machine, Cable, Bodyweight, Medicine Ball, Other), "muscle" and "secondaryMuscles" from: Chest, Lats, Traps, Front Delts, Side Delts, Rear Delts, Biceps, Triceps, Forearms, Quads, Hamstrings, Glutes, Calves, Abs, Obliques, Lower Back.
- Runs, rucks, rows and rides: use "reps":"20 min" and no muscle; they are logged as cardio.
- Do not include weights. Do not invent, drop or swap exercises.

CATALOG
Chest: Barbell Bench Press, Incline Bench Press, Decline Bench Press, Dumbbell Bench Press, Incline DB Bench Press, Dumbbell Fly, Cable Fly, Push-Up, Chest Dip, Decline Push-Up, Wide Push-Up, Machine Chest Press, Pec Deck, Smith Machine Bench Press, Hand-Release Push-Up, Incline Push-Up
Back: Deadlift, Hex Bar Deadlift, Pull-Up, Chin-Up, Barbell Row, Lat Pulldown, Seated Cable Row, T-Bar Row, Dumbbell Row, Kettlebell Row, Assisted Pull-Up, Straight-Arm Pulldown, Chest-Supported Row, Pendlay Row, Machine Row, Inverted Row, Back Extension
Shoulders: Overhead Press, Dumbbell Shoulder Press, Lateral Raise, Front Raise, Face Pull, Arnold Press, Barbell Shrug, Kettlebell Press, Pike Push-Up, Cable Lateral Raise, Machine Lateral Raise, Upright Row, Reverse Dumbbell Fly, Reverse Pec Deck, Machine Shoulder Press, Push Press, Landmine Press, Dumbbell Shrug
Biceps: Barbell Curl, Dumbbell Curl, Hammer Curl, Preacher Curl, Concentration Curl, Cable Curl, EZ-Bar Curl, Incline Dumbbell Curl, Reverse Curl, Wrist Curl
Triceps: Tricep Pushdown, Skull Crusher, Close-Grip Bench Press, Overhead Tricep Extension, Tricep Dip, Diamond Push-Up, Cable Overhead Extension, Dumbbell Skull Crusher, Tricep Kickback
Legs: Barbell Back Squat, Front Squat, Leg Press, Romanian Deadlift, Leg Curl, Leg Extension, Calf Raise, Hack Squat, Walking Lunge, Bulgarian Split Squat, DB Step-Up, Hip Thrust, Sumo Deadlift, Goblet Squat, Glute Kickback, Kettlebell Goblet Squat, Med Ball Squat, Bodyweight Squat, Jump Squat, Pistol Squat, Jump Lunge, Glute Bridge, Calf Raise (Bodyweight), Good Morning, Seated Leg Curl, Lying Leg Curl, Nordic Curl, Seated Calf Raise, Smith Machine Squat, Reverse Lunge, Single-Leg Romanian Deadlift, Hip Abduction, Cable Pull-Through
Core: Plank, Crunch, Hanging Leg Raise, Russian Twist, Ab Wheel Rollout, Cable Crunch, Med Ball Rotational Throw, Sit-Up, V-Up, Bicycle Crunch, Flutter Kick, Mountain Climber, Superman, Leg Raises, Dead Bug, Toe Touch, Cross Crunch, Hollow Hold, Windshield Wiper, Pallof Press, Dragon Flag, Side Plank, Cable Woodchop, Suitcase Carry
Full Body: Power Clean, Farmer's Walk, Kettlebell Swing, Thruster, Box Jump, Kettlebell Clean, Medicine Ball Slam, Burpee, Tuck Jump, Inchworm, Sprawl, Wall Ball, Sprint-Drag-Carry, Sled Drag, Sled Push, Shuttle Sprint
Cardio: Easy Run, Long Run, Interval Run, Tempo Run, 2-Mile Run, Ruck, Rowing Machine, Stationary Bike, Jump Rope

Here is the program:
```

---

## What the importer accepts

It is forgiving about the wrapper and strict about exercise identity.

**Wrapper.** `{ "program": {…}, "groups": [...] }`, or `{ "groups": [...] }`, or the older `{ "group": {…}, "routines": [...] }`, or just `{ "routines": [...] }`, or a bare array of routines. JSON wrapped in a code fence or surrounded by prose is found and used.

**Exercise matching.** An imported exercise lands on an existing one only when it is the same movement:

1. the `exId` / `id` field is a catalog id, or
2. the name is the same ignoring case, punctuation, plurals and shorthand (`DB`, `BB`, `KB`, `OHP`, "Pull Ups"), or
3. it is a known alias (`Bench Press`, `Back Squat`, `RDL`, `Military Press`, `HRP`, `SDC`, `Butterfly`, …), or
4. the words match once the equipment word is set aside and the equipment agrees (`Barbell Deadlift` → Deadlift; `Squat` + Bodyweight → Bodyweight Squat).

Anything else becomes a new custom exercise. `Seated Leg Curl` is its own exercise, not `Leg Curl`. A name too vague to place (`Row`, `Curl`, `Press` with no equipment) also becomes its own exercise rather than a guess. In the preview, tap an exercise to pick a different match or make it new.

**Reps.** `reps` as above, or the explicit fields `repsMin`, `repsMax`, `amrap`, `timed` (seconds) and `seconds`. A distance (`50m`, `40 yd`) is a target in metres. Words left over after the numbers ("each side") are moved into the note.

**Other fields.** `sets` 1–20 (default 3). `rest` 0–900 seconds. `rir` 0–4 (also read from "RIR 2" in a note). `weight` optional starting weight in your unit. `link` labels are per routine; a superset whose members are not next to each other is unlinked with a warning. `days` accepts names (`"Mon"`, `"Thursday"`) or numbers (0 = Sunday).

**Programs.** When every group has `weeks`, the preview offers to save it as a program, named from `program.name` (or from what the phase names share), and to start it now. `deloadLastWeek: true` on a group makes that phase's last week a deload: half the working sets at the same weights. Progress through a program counts the weeks you train in it, so a week off does not use one up.

**Cardio.** Runs, rucks, rows and rides (by name, with no muscle) are logged with time and distance, and each one done in a workout is also saved as an activity.

**Muscles.** Chest, Lats, Traps, Front Delts, Side Delts, Rear Delts, Biceps, Triceps, Forearms, Quads, Hamstrings, Glutes, Calves, Abs, Obliques, Lower Back. "Shoulders" is read as the head the exercise's name points to (lateral → side, rear/face pull → rear, otherwise front).

**Same names as existing routines.** The preview offers a checkbox to replace them in place (their history stays attached) instead of adding a second copy.

**Warnings** are listed under the preview: a muscle that is not one of the tracked ones, a muscle that had to be guessed, an equipment hint that disagrees with the catalog entry, skipped rows.

---

## Example

```json
{
  "program": { "name": "Upper/Lower", "notes": "Add weight when every set reaches the top of the range" },
  "groups": [
    {
      "name": "Upper/Lower",
      "mode": "daypicker",
      "weeks": 6,
      "deloadLastWeek": true,
      "routines": [
        {
          "name": "Upper/Lower - Upper",
          "notes": "Add weight when every set reaches the top of the range",
          "days": ["Mon", "Thu"],
          "exercises": [
            { "name": "Barbell Bench Press", "sets": 4, "reps": "6-8", "rest": 150, "rir": 2, "type": "flat", "link": null, "note": "" },
            { "name": "Barbell Row", "sets": 4, "reps": "8-10", "rest": 120, "type": "flat", "link": null, "note": "" },
            { "name": "Lateral Raise", "sets": 3, "reps": "12-15", "rest": 60, "type": "flat", "link": "A", "note": "" },
            { "name": "Pull-Up", "sets": 3, "reps": "AMRAP", "rest": 90, "type": "flat", "link": "A", "note": "" },
            { "name": "Plank", "sets": 3, "reps": "45s", "rest": 45, "type": "flat", "link": null, "note": "" }
          ]
        },
        {
          "name": "Upper/Lower - Lower",
          "notes": "",
          "days": ["Tue", "Fri"],
          "exercises": [
            { "name": "Barbell Back Squat", "sets": 4, "reps": 5, "rest": 180, "rir": 2, "type": "flat", "link": null, "note": "" },
            { "name": "Romanian Deadlift", "sets": 3, "reps": "8-10", "rest": 120, "type": "flat", "link": null, "note": "" },
            { "name": "Single-Leg Leg Press", "equipment": "Machine", "muscle": "Quads", "secondaryMuscles": ["Glutes"], "sets": 3, "reps": "10-12", "rest": 75, "type": "flat", "link": null, "note": "each side" },
            { "name": "Easy Run", "sets": 1, "reps": "20 min", "rest": 0, "type": "flat", "link": null, "note": "Conversational pace" }
          ]
        }
      ]
    }
  ]
}
```

The catalog is generated from the app: `node tools/catalog.js`.
