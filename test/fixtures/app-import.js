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

// JEFIT as a real export lays it out (checked against one, then scrubbed: every value here is made up). Sections end with a
// line of hashes; ROUTINES holds three tables back to back, each row under its own header line; a session names its routine
// day by day_id; a planned exercise may carry only JEFIT's numeric exercise_id; the unit is " lbs" in SETTING.
const epoch = (m, d, h) => Math.floor(Date.UTC(2026, m - 1, d, h + 4, 0, 0) / 1000); // New York wall time in summer
const HASH = '######################################################';
const JEFIT_REAL = [
  '', '### SETTING ##########################################', '',
  'row_id,USERID,TIMESTAMP,gender,currentRoutine,DOB,name,length,mass,dbversion,vibration',
  '1,1,"2026-01-01 00:00:00",M,2,,," inches"," lbs",,', '', HASH, '',
  '### PROFILE ##########################################', '',
  'row_id,USERID,username,email', '1,1,test-lifter,test-lifter@example.invalid', '', HASH, '',
  '### ROUTINES #########################################', '',
  'row_id,USERID,TIMESTAMP,_id,name,difficulty,focus,dayaweek,description,daytype,tags,rdb_id,bannerCode,progression_flag',
  '1,1,"2024-04-12 03:10:00",1,"Jefit Sample Beginner Routine",0,1,4,"A built-in routine, never trained",0," ",0,,0', '',
  'row_id,USERID,TIMESTAMP,_id,name,difficulty,focus,dayaweek,description,daytype,tags,rdb_id,bannerCode,progression_flag',
  '2,1,"2024-04-12 03:10:00",2,"Push Pull",0,1,2,"",0," ",0,,0', '',
  'row_id,USERID,TIMESTAMP,package,_id,name,day,dayIndex,interval_mode,rest_day,week,sort_order,day_completed_timestamp',
  '1,1,"2024-04-12 03:10:00",1,11,"Sample Day",1,1,0,0,0,0,', '',
  'row_id,USERID,TIMESTAMP,package,_id,name,day,dayIndex,interval_mode,rest_day,week,sort_order,day_completed_timestamp',
  '2,1,"2024-04-12 03:10:00",2,21,"Push Day",1,1,0,0,0,0,', '',
  'row_id,USERID,TIMESTAMP,package,_id,name,day,dayIndex,interval_mode,rest_day,week,sort_order,day_completed_timestamp',
  '3,1,"2024-04-12 03:10:00",2,22,"Pull Day",2,2,0,0,0,0,', '',
  // planned exercises: the first has no name (only exercise_id 12, which the logs name), the last has an id nothing names
  'row_id,USERID,TIMESTAMP,belongSys,superset,_id,exercise_id,belongplan,exercisename,setcount,timer,logs,bodypart,mysort,targetrep,setdone,setdonetime,interval_time,interval_unit,rest_time_enabled,interval_time_enabled,is_tier_primary',
  '1,1,"2024-04-12 03:10:00",1,0,101,12,21,"",4,90,"0x0",0,0,"12,10,8,6",0,0,0,0,0,0,0', '',
  'row_id,USERID,TIMESTAMP,belongSys,superset,_id,exercise_id,belongplan,exercisename,setcount,timer,logs,bodypart,mysort,targetrep,setdone,setdonetime,interval_time,interval_unit,rest_time_enabled,interval_time_enabled,is_tier_primary',
  '2,1,"2024-04-12 03:10:00",1,102,102,48,21,"Dumbbell Shoulder Press",3,60,"0x0",0,1,"10",0,0,0,0,0,0,0', '',
  'row_id,USERID,TIMESTAMP,belongSys,superset,_id,exercise_id,belongplan,exercisename,setcount,timer,logs,bodypart,mysort,targetrep,setdone,setdonetime,interval_time,interval_unit,rest_time_enabled,interval_time_enabled,is_tier_primary',
  '3,1,"2024-04-12 03:10:00",1,102,103,77,21,"Plank",3,45,"0x0",0,2,"8",0,0,0,0,0,0,0', '',
  'row_id,USERID,TIMESTAMP,belongSys,superset,_id,exercise_id,belongplan,exercisename,setcount,timer,logs,bodypart,mysort,targetrep,setdone,setdonetime,interval_time,interval_unit,rest_time_enabled,interval_time_enabled,is_tier_primary',
  '4,1,"2024-04-12 03:10:00",1,0,104,999,21,"",3,60,"0x0",0,3,"8",0,0,0,0,0,0,0', '',
  'row_id,USERID,TIMESTAMP,belongSys,superset,_id,exercise_id,belongplan,exercisename,setcount,timer,logs,bodypart,mysort,targetrep,setdone,setdonetime,interval_time,interval_unit,rest_time_enabled,interval_time_enabled,is_tier_primary',
  '5,1,"2024-04-12 03:10:00",1,0,105,12,22,"Lat Pulldown",3,60,"0x0",0,0,"8",0,0,0,0,0,0,0', '', HASH, '',
  '### WORKOUT SESSIONS #################################', '',
  'rowid,_id,USERID,edit_time,day_id,total_time,workout_time,rest_time,wasted_time,total_exercise,total_weight,recordbreak,starttime,endtime,workout_mode,TIMESTAMP,calories,avg_heart_rate',
  `1,${epoch(9, 1, 18)},1,0,21,3600,0,0,0,3,0,0,${epoch(9, 1, 18)},${epoch(9, 1, 19)},0,"2026-09-01 18:00:00",0,`,
  `2,${epoch(9, 8, 18)},1,0,21,3000,0,0,0,1,0,0,${epoch(9, 8, 18)},${epoch(9, 8, 19)},0,"2026-09-08 18:00:00",0,`,
  `3,${epoch(9, 10, 7)},1,0,0,600,0,0,0,1,0,0,${epoch(9, 10, 7)},${epoch(9, 10, 8)},0,"2026-09-10 07:00:00",0,`,
  `4,${epoch(9, 12, 18)},1,0,22,12,0,0,0,0,0,0,${epoch(9, 12, 18)},${epoch(9, 12, 19)},0,"2026-09-12 18:00:00",0,`, '', HASH, '',
  '### EXERCISE LOGS ####################################', '',
  'USERID,TIMESTAMP,belongSys,logs,_id,record,mydate,eid,ename,day_item_id,belongsession,logTime,interval_logs,auto_generated',
  `1,"2026-09-01 18:00:00",1,"135x8,135x8,145x6",1,181,2026-09-01,12,"Barbell Bench Press",101,${epoch(9, 1, 18)},0,"0,0,0",`,
  `1,"2026-09-01 18:00:00",1,"40x10,40x9",2,50,2026-09-01,48,"Dumbbell Shoulder Press",102,${epoch(9, 1, 18)},0,"0,0",`,
  `1,"2026-09-01 18:00:00",1,"0:45,0:50",3,0,2026-09-01,77,"Plank",103,${epoch(9, 1, 18)},0,"0,0",`,
  `1,"2026-09-08 18:00:00",1,"140x8,140x7",4,185,2026-09-08,12,"Barbell Bench Press",101,${epoch(9, 8, 18)},0,"0,0",`,
  `1,"2026-09-10 07:00:00",1,"0x102.0,0x1.3,0x5.0,0x0.0,0x600",5,0,2026-09-10,5,"Running",0,${epoch(9, 10, 7)},0,"0",`, '', HASH, '',
  '### EXERCISE SET LOGS ################################', '',
  '_id,userid,exercise_log_id,set_index,weight_lbs,reps,calories,distance_mi,speed_mph,laps,duration,set_type,log_time,TIMESTAMP',
  '1,1,1,0,135.0000,8,,,,,0,default,0,"2026-09-01 18:00:00"', '', HASH, '',
  '### CARDIO LOGS ######################################', '',
  'row_id,TIMESTAMP,USERID,_id,weeklyLogId,eid,belongSys,lap,duration,speed,distance,calorie,mydate', '', HASH, '',
].join('\n');

module.exports = { JEFIT_REAL, STRONG, STRONG6, STRONG_MEAS, HEVY, HEVY_MEAS, HEVY_DE, FITBOD, JEFIT, JEFIT_RESAVED, ALPHA, STRONGLIFTS };
