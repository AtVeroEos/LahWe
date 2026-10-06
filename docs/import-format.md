# Lah We — program import format

Two ways to get a program into the app without typing it exercise by exercise:

1. **Ask the coach** (Coach tab → *Build a program* or *Import a program*, or Library → Routines → ✨ Build with coach). Describe the program or attach a photo, screenshot or PDF. The app calls the AI provider you set up, with your own API key, and shows the result as a card to review; nothing is saved until you add it.
2. **Import** (Library → Routines → 📥 Import). Paste JSON in the format below, or pick a `.json` file. Use this when you would rather have another chat assistant do the conversion, or when you are offline from the API.

Either way you get the same preview: every routine can be opened to check its exercises, new custom exercises are listed with the muscle they will count toward, and nothing is saved until you tap the button.

---

## Prompt to give an assistant

Copy everything in the block, then add your program (text, PDF or screenshot).

```
Convert the workout program I give you into JSON for the "Lah We" app. Return ONLY the JSON object.

SHAPE
{
  "groups": [
    {
      "name": "<group name>",
      "mode": "rotation",          // "rotation" (A → B → C, the default) or "daypicker" (fixed weekdays)
      "weeks": 0,                  // length of this phase in weeks; 0 if the program is not phased
      "routines": [
        {
          "name": "<group name> - <target>",   // e.g. "PPL - Push", "Upper/Lower - Lower 1"
          "notes": "",                         // one line the lifter should see for the whole day
          "days": [],                          // only for daypicker: ["Mon","Thu"]
          "exercises": [ <exercise>, ... ]
        }
      ]
    }
  ]
}

Use ONE group unless the program has phases with genuinely different exercises; then one group per
phase, in order, each with "weeks" set. One routine per distinct training day.

EXERCISE
{
  "name": "Barbell Bench Press",
  "equipment": "Barbell",          // Barbell, Dumbbell, Kettlebell, Machine, Cable, Bodyweight, Medicine Ball, Other
  "muscle": "Chest",               // primary mover (list below)
  "secondaryMuscles": ["Triceps", "Shoulders"],
  "sets": 4,                       // WORKING sets only; the app adds warm-ups itself
  "reps": "6-8",                   // see REPS
  "rest": 150,                     // seconds between sets
  "type": "flat",                  // "flat", "ascend" (weight goes up each set), "descend" (drop / back-off sets)
  "link": null,                    // supersets: give consecutive exercises the same label, e.g. "A"
  "note": ""                       // one short line: tempo, RPE, % of 1RM, "each side", a cue
}

REPS — write the target the way the program does:
  10          fixed reps
  "8-12"      a range
  "AMRAP"     as many as possible        "10+"   at least 10, then as many as possible
  "45s"       a timed hold or carry      "30-60s", "1:30" and "2 min" also work

MUSCLES: Chest, Lats, Traps, Shoulders, Biceps, Triceps, Forearms, Quads, Hamstrings, Glutes, Calves, Abs, Obliques, Lower Back

NAMES
Use the exact catalog name when the exercise is the same movement with the same equipment.
If it is a different variation (Seated Leg Curl, Cable Lateral Raise, Incline Machine Press), keep the
program's own name. The app will create it as a new exercise rather than merge it into a similar one.
Always fill in equipment, muscle and secondaryMuscles, catalog match or not.

REST when the program does not say: 150-180 heavy compounds, 90-120 other compounds, 60-75 isolation.
Do not include weights. Do not invent, drop or swap exercises.

CATALOG
**Chest**: Barbell Bench Press, Incline Bench Press, Decline Bench Press, Dumbbell Bench Press, Incline DB Bench Press, Dumbbell Fly, Cable Fly, Push-Up, Chest Dip, Decline Push-Up, Wide Push-Up
**Back**: Deadlift, Hex Bar Deadlift, Pull-Up, Chin-Up, Barbell Row, Lat Pulldown, Seated Cable Row, T-Bar Row, Dumbbell Row, Kettlebell Row
**Shoulders**: Overhead Press, Dumbbell Shoulder Press, Lateral Raise, Front Raise, Face Pull, Arnold Press, Barbell Shrug, Kettlebell Press, Pike Push-Up
**Biceps**: Barbell Curl, Dumbbell Curl, Hammer Curl, Preacher Curl, Concentration Curl, Cable Curl
**Triceps**: Tricep Pushdown, Skull Crusher, Close-Grip Bench Press, Overhead Tricep Extension, Tricep Dip, Diamond Push-Up
**Legs**: Barbell Back Squat, Front Squat, Leg Press, Romanian Deadlift, Leg Curl, Leg Extension, Calf Raise, Hack Squat, Walking Lunge, Bulgarian Split Squat, DB Step-Up, Hip Thrust, Sumo Deadlift, Goblet Squat, Glute Kickback, Kettlebell Goblet Squat, Med Ball Squat, Bodyweight Squat, Jump Squat, Pistol Squat, Jump Lunge, Glute Bridge, Calf Raise (Bodyweight)
**Core**: Plank, Crunch, Hanging Leg Raise, Russian Twist, Ab Wheel Rollout, Cable Crunch, Med Ball Rotational Throw, Sit-Up, V-Up, Bicycle Crunch, Flutter Kick, Mountain Climber, Superman, Leg Raises, Dead Bug, Toe Touch, Cross Crunch, Hollow Hold, Windshield Wiper, Pallof Press, Dragon Flag
**Full Body**: Power Clean, Farmer's Walk, Kettlebell Swing, Thruster, Box Jump, Kettlebell Clean, Medicine Ball Slam, Burpee, Tuck Jump, Inchworm, Sprawl

Here is the program:
```

---

## What the importer accepts

It is forgiving about the wrapper and strict about exercise identity.

**Wrapper.** `{ "groups": [...] }`, or the older `{ "group": {...}, "routines": [...] }`, or just `{ "routines": [...] }` (routines with no group), or a bare array of routines. JSON wrapped in a code fence or surrounded by prose is found and used.

**Exercise matching.** An imported exercise lands on an existing one only when it is the same movement:

1. the `exId` / `id` field is a catalog id, or
2. the name is the same ignoring case, punctuation, plurals and shorthand (`DB`, `BB`, `KB`, `OHP`, "Pull Ups"), or
3. it is a known alias (`Bench Press`, `Back Squat`, `RDL`, `Military Press`, `Bent-Over Row`, …), or
4. the words match once the equipment word is set aside and the equipment agrees (`Barbell Deadlift` → Deadlift; `Squat` + Bodyweight → Bodyweight Squat).

Anything else becomes a new custom exercise. `Seated Leg Curl` is not `Leg Curl`. A name too vague to place (`Row`, `Curl`, `Press` with no equipment) also becomes its own exercise rather than a guess.

**Reps.** `reps` as above, or the explicit fields `repsMin`, `repsMax`, `amrap` (true/false), `timed` (true/false; `repsMin`/`repsMax` are then seconds) and `seconds`. Words left over after the numbers ("each side") are moved into the note.

**Other fields.** `sets` 1–20 (default 3). `rest` 0–900 seconds, or omit to use the app default. `weight` optional starting weight in your unit. `link` labels are per routine; a "superset" whose members are not next to each other is unlinked with a warning. `days` accepts names (`"Mon"`, `"Thursday"`) or numbers (0 = Sunday).

**Groups.** `mode: "daypicker"` needs `days` on at least one routine; without them it is imported as a rotation and the preview says so. When there are two or more groups and each has `weeks`, the preview offers to start them as a timed program from today.

**Same names as existing routines.** The preview offers a checkbox to replace them in place (their history stays attached) instead of adding a second copy.

**Warnings** are listed under the preview: a muscle that is not one of the fourteen tracked ones, a muscle that had to be guessed, an equipment hint that disagrees with the catalog entry, skipped rows.

---

## Example

```json
{
  "groups": [
    {
      "name": "Upper/Lower",
      "mode": "daypicker",
      "weeks": 0,
      "routines": [
        {
          "name": "Upper/Lower - Upper",
          "notes": "Add weight when every set reaches the top of the range",
          "days": ["Mon", "Thu"],
          "exercises": [
            { "name": "Barbell Bench Press", "equipment": "Barbell", "muscle": "Chest", "secondaryMuscles": ["Triceps", "Shoulders"], "sets": 4, "reps": "6-8", "rest": 150, "type": "flat", "link": null, "note": "" },
            { "name": "Barbell Row", "equipment": "Barbell", "muscle": "Lats", "secondaryMuscles": ["Biceps", "Traps"], "sets": 4, "reps": "8-10", "rest": 120, "type": "flat", "link": null, "note": "" },
            { "name": "Lateral Raise", "equipment": "Dumbbell", "muscle": "Shoulders", "secondaryMuscles": [], "sets": 3, "reps": "12-15", "rest": 60, "type": "flat", "link": "A", "note": "" },
            { "name": "Pull-Up", "equipment": "Bodyweight", "muscle": "Lats", "secondaryMuscles": ["Biceps"], "sets": 3, "reps": "AMRAP", "rest": 90, "type": "flat", "link": "A", "note": "" },
            { "name": "Plank", "equipment": "Bodyweight", "muscle": "Abs", "secondaryMuscles": ["Obliques"], "sets": 3, "reps": "45s", "rest": 45, "type": "flat", "link": null, "note": "" }
          ]
        },
        {
          "name": "Upper/Lower - Lower",
          "notes": "",
          "days": ["Tue", "Fri"],
          "exercises": [
            { "name": "Barbell Back Squat", "equipment": "Barbell", "muscle": "Quads", "secondaryMuscles": ["Glutes", "Lower Back"], "sets": 4, "reps": 5, "rest": 180, "type": "flat", "link": null, "note": "RPE 8" },
            { "name": "Romanian Deadlift", "equipment": "Barbell", "muscle": "Hamstrings", "secondaryMuscles": ["Glutes", "Lower Back"], "sets": 3, "reps": "8-10", "rest": 120, "type": "flat", "link": null, "note": "" },
            { "name": "Seated Leg Curl", "equipment": "Machine", "muscle": "Hamstrings", "secondaryMuscles": [], "sets": 3, "reps": "10-12", "rest": 75, "type": "flat", "link": null, "note": "" }
          ]
        }
      ]
    }
  ]
}
```

The catalog above is generated from the app: `node tools/catalog.js`.
