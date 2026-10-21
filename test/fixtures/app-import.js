'use strict';
// Export files from other workout apps, written from each app's documented columns. No real exports
// were on hand: replace or add to these with real files as people send them.

// Strong, the comma file most installs write: no unit on the weight, W/D/F in Set Order, rest-timer rows.
const STRONG = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2026-09-21 18:00:00,Push A,1h 2m,Bench Press (Barbell),1,185,8,0,0,,,
2026-09-21 18:00:00,Push A,1h 2m,Bench Press (Barbell),2,185,8,0,0,,,
2026-09-21 18:00:00,Push A,1h 2m,Overhead Press (Barbell),1,115,7,0,0,,,
2026-09-28 18:00:00,Push A,1h 5m,Bench Press (Barbell),W,95,10,0,0,,,
2026-09-28 18:00:00,Push A,1h 5m,Bench Press (Barbell),1,185,8,0,0,,Felt strong,8
2026-09-28 18:00:00,Push A,1h 5m,Bench Press (Barbell),2,185,7,0,0,,Felt strong,9
2026-09-28 18:00:00,Push A,1h 5m,Bench Press (Barbell),Rest Timer,0,0,0,90,,Felt strong,
2026-09-28 18:00:00,Push A,1h 5m,Overhead Press (Barbell),1,115,6,0,0,"grip, a bit wider",Felt strong,
2026-09-28 18:00:00,Push A,1h 5m,Plank,1,0,0,0,60,,Felt strong,
2026-09-28 18:00:00,Push A,1h 5m,Cable Crossover Hold Thing (Cable),1,30,12,0,0,,Felt strong,
2026-10-05 18:10:00,Push A,58m,Bench Press (Barbell),1,190,8,0,0,,,
2026-10-05 18:10:00,Push A,58m,Bench Press (Barbell),2,190,6,0,0,,,
2026-10-05 18:10:00,Push A,58m,Bench Press (Barbell),D,135,12,0,0,,,
2026-10-05 18:10:00,Push A,58m,Overhead Press (Barbell),1,120,5,0,0,,,
2026-10-05 18:10:00,Push A,58m,Plank,1,0,0,0,75,,,
2026-10-06 07:00:00,Morning Workout,40m,Running,1,0,0,3.1,1800,,,
`;

// Strong 6: semicolons, every field quoted, the unit in the column name, duration in seconds.
const STRONG6 = `"Workout #";"Date";"Workout Name";"Duration (sec)";"Exercise Name";"Set Order";"Weight (kg)";"Reps";"RPE";"Distance (meters)";"Seconds";"Notes";"Workout Notes"
"1";"2026-09-30 17:00:00";"Legs";"3600";"Squat (Barbell)";"1";"100";"5";"";"";"";"";""
"1";"2026-09-30 17:00:00";"Legs";"3600";"Squat (Barbell)";"2";"100";"5";"";"";"";"";""
"1";"2026-09-30 17:00:00";"Legs";"3600";"Sled Push";"1";"40";"";"";"20";"";"";""
`;

// Strong's measurements file: one row per value, its unit beside it.
const STRONG_MEAS = `Date,Measurement Type,Value,Unit,Source
2026-10-01 08:00:00,Weight,90.5,kg,Strong
2026-10-01 08:00:00,Waist,84,cm,Strong
2026-10-01 08:00:00,Body Fat %,15,%,Strong
2026-10-02 08:00:00,Weight,90.1,kg,Strong
`;

// Hevy in pounds: set types, a superset, notes, and the same lift again later in the session.
const HEVY = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_lbs","reps","distance_miles","duration_seconds","rpe"
"Upper","30 Sep 2026, 19:56","30 Sep 2026, 21:01","Good one","Bench Press (Barbell)",,"",0,"warmup",95,10,,,
"Upper","30 Sep 2026, 19:56","30 Sep 2026, 21:01","Good one","Bench Press (Barbell)",,"",1,"normal",185,8,,,8.5
"Upper","30 Sep 2026, 19:56","30 Sep 2026, 21:01","Good one","Bench Press (Barbell)",,"",2,"failure",185,6,,,10
"Upper","30 Sep 2026, 19:56","30 Sep 2026, 21:01","Good one","Lateral Raise (Dumbbell)",0,"slow",0,"normal",20,15,,,
"Upper","30 Sep 2026, 19:56","30 Sep 2026, 21:01","Good one","Triceps Pushdown (Cable - Straight Bar)",0,"",0,"normal",50,12,,,
"Upper","30 Sep 2026, 19:56","30 Sep 2026, 21:01","Good one","Triceps Pushdown (Cable - Straight Bar)",0,"",1,"dropset",40,10,,,
"Upper","30 Sep 2026, 19:56","30 Sep 2026, 21:01","Good one","Bench Press (Barbell)",,"back-off",0,"normal",155,10,,,
"Upper","30 Sep 2026, 19:56","30 Sep 2026, 21:01","Good one","Pull Up (Assisted)",,"",0,"normal",,8,,,
`;

// Hevy's measurements file.
const HEVY_MEAS = `"date","weight_lbs","fat_percent","neck_in","waist_in"
"1 Oct 2026, 07:00",201.4,16,15.5,34
`;

// Hevy set to German: the columns cannot be read.
const HEVY_DE = `"Titel","Startzeit","Endzeit","Beschreibung","Übungstitel","Supersatz-ID","Übungsnotizen","Satzindex","Satztyp","Gewicht_kg","Wiederholungen"
"Oberkörper","30 Sep 2026, 19:56","30 Sep 2026, 21:01","","Bankdrücken (Langhantel)",,"",0,"normal",80,8
`;

// Fitbod: no workout names, the time with an offset, kg in the column name.
const FITBOD = `Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier
2026-09-29 14:02:51 +0000,Barbell Bench Press,10,40,0,0,0,0,true,,1
2026-09-29 14:02:51 +0000,Barbell Bench Press,8,80,0,0,0,0,false,,1
2026-09-29 14:02:51 +0000,Barbell Bench Press,8,80,0,0,0,0,false,,1
2026-09-29 14:02:51 +0000,Dumbbell Bicep Curl,12,14,0,0,0,0,false,,2
2026-10-02 10:30:00 +0000,Plank,0,0,45,0,0,0,false,,1
`;

// JEFIT: one file in sections; sets packed as weight x reps.
const JEFIT = `### WORKOUT SESSIONS ###
_id,mydate,starttime,total_time
1,2026-09-27,1758996000,3600
2,2026-10-04,0,0
### EXERCISE LOGS ###
_id,belongsession,ename,logs
10,1,Barbell Bench Press,"135x8,155x6"
11,1,Lat Pulldown,"120x10,120x10"
12,2,Barbell Bench Press,"135x8"
### BODY STATS ###
_id,mydate,weight,waist,chest
1,2026-09-27,190,34,42
### END ###
`;
// The same file after a spreadsheet re-saved it: the section lines are gone.
const JEFIT_RESAVED = `_id,belongsession,ename,logs
10,1,Barbell Bench Press,"135x8,155x6"
`;

// Alpha Progression (layout not confirmed): one row per set with reps in reserve.
const ALPHA = `Date,Workout,Exercise,Set,Weight (kg),Reps,RIR
2026-10-01 18:00,Upper 1,Bench Press,1,80,8,2
2026-10-01 18:00,Upper 1,Bench Press,2,80,7,1
2026-10-01 18:00,Upper 1,Lat Pulldown,1,60,10,2
`;

// StrongLifts (layout not confirmed): one row per exercise with a set count.
const STRONGLIFTS = `Date,Workout,Exercise,Sets,Reps,Weight (lb),Notes
2026-10-01,Workout A,Squat,5,5,225,
2026-10-01,Workout A,Bench Press,5,5,175,
2026-10-03,Workout B,Squat,5,5,230,
2026-10-03,Workout B,Deadlift,1,5,275,
`;

module.exports = { STRONG, STRONG6, STRONG_MEAS, HEVY, HEVY_MEAS, HEVY_DE, FITBOD, JEFIT, JEFIT_RESAVED, ALPHA, STRONGLIFTS };
