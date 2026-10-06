// ═══════════════════════════════════════════════════
// DATA — icons, exercise catalog, volume landmarks, activity types, dashboards
// ═══════════════════════════════════════════════════
const ICON_PATHS={
  dumbbell:'<rect x="4.3" y="8.4" width="2.7" height="7.2" rx="1"/><rect x="17" y="8.4" width="2.7" height="7.2" rx="1"/><rect x="7" y="10" width="2" height="4" rx=".7"/><rect x="15" y="10" width="2" height="4" rx=".7"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="2.6" y1="12" x2="4.3" y2="12"/><line x1="19.7" y1="12" x2="21.4" y2="12"/>',
  scale:'<circle cx="12" cy="5" r="1.4"/><line x1="12" y1="6.4" x2="12" y2="19.5"/><line x1="7.5" y1="19.5" x2="16.5" y2="19.5"/><line x1="6" y1="7" x2="18" y2="7"/><path d="M6 7 3 13h6z"/><path d="M18 7l3 6h-6z"/>',
  flame:'<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  bell:'<path d="M6 9.5a6 6 0 0 1 12 0c0 5.5 2.4 7.5 2.4 7.5H3.6S6 15 6 9.5z"/><path d="M10.2 20.5a2 2 0 0 0 3.6 0"/>',
  bolt:'<path d="M13 2.5 4.5 13.5H10l-1 8 8.5-11H12z"/>',
  figure:'<circle cx="12" cy="4.6" r="2"/><path d="M12 7v6"/><path d="M7 9.5h10"/><path d="M12 13l-3 6.5"/><path d="M12 13l3 6.5"/>',
  briefcase:'<rect x="3" y="7.5" width="18" height="12" rx="2.5"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><line x1="3" y1="13" x2="21" y2="13"/>',
  ball:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2l3.4 2.5-1.3 4h-4.2l-1.3-4z"/><path d="M12 3.5v3.7M5.6 9.7 8.8 12M18.4 9.7 15.2 12M9.9 18.3 8.4 21M14.1 18.3 15.6 21"/>',
  run:'<circle cx="14.5" cy="4.5" r="2"/><path d="M14 6.6l-3.2 3 1.6 2.4-1.4 5"/><path d="M12.4 11.6 16 13l1.2 4"/><path d="M10.8 9.6 7 9l-2 2.4"/>',
  backpack:'<path d="M7 9.5a5 5 0 0 1 10 0v8.5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/><path d="M9.5 9.5V7.5a2.5 2.5 0 0 1 5 0v2"/><rect x="9.5" y="13.5" width="5" height="4.5" rx="1.2"/>',
  bike:'<circle cx="6" cy="16.5" r="3.3"/><circle cx="18" cy="16.5" r="3.3"/><path d="M6 16.5l4-7.5h4.5l3.5 7.5"/><path d="M10 9h5.5"/><path d="M14.5 9l-1.4-3H10.5"/>',
  mountain:'<path d="M3 19 9.4 8l3.4 5.4L15 11l6 8z"/><circle cx="16.6" cy="6.4" r="1.6"/>',
  swim:'<circle cx="17" cy="7" r="1.8"/><path d="M5.5 9.5l4.5-1.8 2.4 2.4-2.4 1.4"/><path d="M3 15.4c1.8 0 1.8-1.3 3.6-1.3s1.8 1.3 3.6 1.3 1.8-1.3 3.6-1.3 1.8 1.3 3.6 1.3"/><path d="M3 19c1.8 0 1.8-1.3 3.6-1.3s1.8 1.3 3.6 1.3 1.8-1.3 3.6-1.3 1.8 1.3 3.6 1.3"/>',
  walk:'<circle cx="13" cy="4.6" r="2"/><path d="M13 7l-1.2 4.6L9 18.5"/><path d="M11.8 11.6 15 14.2l1.2 4.3"/><path d="M13 8.8 9.6 7.8"/><path d="M13 8.8l3.2 1.8"/>',
  barchart:'<path d="M3 20h18"/><rect x="5" y="11" width="3" height="7" rx=".6"/><rect x="10.5" y="6.5" width="3" height="11.5" rx=".6"/><rect x="16" y="9" width="3" height="9" rx=".6"/>',
  trendup:'<polyline points="3 16 9 10 13 14 21 6"/><polyline points="15 6 21 6 21 12"/>',
  trenddown:'<polyline points="3 8 9 14 13 10 21 18"/><polyline points="15 18 21 18 21 12"/>',
  trophy:'<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5.2H4.2v1.3A3.5 3.5 0 0 0 7.5 10M17 5.2h2.8v1.3A3.5 3.5 0 0 1 16.5 10"/><path d="M9.6 14h4.8l-.5 3h-3.8z"/><path d="M8 20.2h8M10.2 17v3.2M13.8 17v3.2"/>',
  target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  ruler:'<rect x="3" y="8" width="18" height="8" rx="1.6"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
  medal:'<circle cx="12" cy="15" r="5"/><path d="M9 3.2 7 9.2M15 3.2l2 6M9 3.2h6"/><path d="M12 12.6v4.4M9.8 14.8h4.4"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><line x1="3.5" y1="9.5" x2="20.5" y2="9.5"/><line x1="8" y1="3" x2="8" y2="6.5"/><line x1="16" y1="3" x2="16" y2="6.5"/>',
  battery:'<rect x="2.5" y="8" width="16" height="9" rx="2.5"/><path d="M21 11.2v2.6"/><rect x="4.5" y="10" width="6.5" height="5" rx="1"/>',
  footsteps:'<path d="M8 3.5c1.5 0 2.4 1.7 2.1 3.8C9.8 9.2 9 11 7.5 11S5.2 9.4 5.5 7.3 6.5 3.5 8 3.5z"/><path d="M5.4 13.2c1.5-.3 2.7.7 2.9 2.2"/><path d="M16.5 9c1.5 0 2.4 1.7 2.1 3.8-.3 1.9-1.1 3.7-2.6 3.7s-2.3-1.6-2-3.7S15 9 16.5 9z"/><path d="M13.9 18.7c1.5-.3 2.7.7 2.9 2.2"/>',
  meat:'<path d="M5.5 11a6.5 6.5 0 0 1 13 0c0 3.6-2.9 7.6-6.5 7.6S5.5 14.6 5.5 11z"/><circle cx="10.8" cy="10.3" r="2"/>',
  utensils:'<path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11"/><path d="M16.5 3C15 3 14 5.2 14 8s1 4 2.5 4 2.5-1.2 2.5-4-1-5-2.5-5zM16.5 12v9"/>',
  bandage:'<rect x="2" y="9" width="20" height="6" rx="3" transform="rotate(-45 12 12)"/><circle cx="10.4" cy="10.4" r=".5"/><circle cx="13.6" cy="13.6" r=".5"/><circle cx="13.6" cy="10.4" r=".5"/><circle cx="10.4" cy="13.6" r=".5"/>',
  check:'<circle cx="12" cy="12" r="8.5"/><polyline points="8 12.5 11 15.3 16.3 9.2"/>',
  alert:'<path d="M12 4 21.5 20H2.5z"/><line x1="12" y1="10" x2="12" y2="14.5"/><circle cx="12" cy="17.4" r=".6"/>',
  moon:'<path d="M20 14.4A8 8 0 0 1 9.6 4 7 7 0 1 0 20 14.4z"/>',
  droplet:'<path d="M12 3.5c3 4 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 3-6 6-10z"/>',
  apple:'<path d="M12 8c-1-1.9-3-2.4-4.5-1.7C5.6 7.2 5 9.4 5 11.4c0 3.5 2 7 4 7 .8 0 1.3-.4 2-.4s1.2.4 2 .4c2 0 4-3.5 4-7 0-2-.6-4.2-2.5-5.1C15 5.6 13 6.1 12 8z"/><path d="M12 8c0-1.8.6-3.3 2-4.3"/>',
  timer:'<circle cx="12" cy="13.2" r="7.3"/><path d="M12 9.4v3.8l2.4 1.8"/><path d="M9.6 2.6h4.8"/>',
  grid:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/>',
  search:'<circle cx="11" cy="11" r="7"/><line x1="16.2" y1="16.2" x2="21" y2="21"/>',
  clipboard:'<rect x="5" y="4" width="14" height="17" rx="2.5"/><rect x="8.5" y="2.6" width="7" height="3.6" rx="1.2"/><path d="M9 11h6M9 15h4"/>',
  pill:'<rect x="3.5" y="8" width="17" height="8" rx="4" transform="rotate(-45 12 12)"/><line x1="8.8" y1="8.8" x2="15.2" y2="15.2"/>',
  folder:'<path d="M3 7.5a2 2 0 0 1 2-2h3.8l2 2.5H19a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  bulb:'<path d="M9.2 18h5.6M10 21h4"/><path d="M12 3a6 6 0 0 1 4 10.5c-.7.6-1 1.2-1 2H9c0-.8-.3-1.4-1-2A6 6 0 0 1 12 3z"/>'
};
const EMOJI_ICON={'🏋':'dumbbell','💪':'dumbbell','⚖':'scale','🔥':'flame','🔔':'bell','⚡':'bolt','🤸':'figure','🧳':'briefcase','⚽':'ball','🏃':'run','🎒':'backpack','🚴':'bike','⛰':'mountain','🏔':'mountain','🏊':'swim','🚶':'walk','📊':'barchart','📈':'trendup','📉':'trenddown','🏆':'trophy','🎯':'target','📏':'ruler','🏅':'medal','🎖':'medal','📅':'calendar','🔋':'battery','👟':'footsteps','🥩':'meat','🍽':'utensils','🍴':'utensils','🩹':'bandage','✅':'check','✔':'check','⚠':'alert','🌙':'moon','💧':'droplet','🍎':'apple','⏱':'timer','⏲':'timer','🔢':'grid','🔍':'search','📋':'clipboard','💊':'pill','🗂':'folder','💡':'bulb'};
function ICON(key,size){
  size=size||18;
  if(!key)return'';
  let name=ICON_PATHS[key]?key:EMOJI_ICON[String(key).replace(/[\uFE0F\u20E3]/g,'')];
  const paths=name&&ICON_PATHS[name];
  if(!paths)return `<span style="display:inline-block;vertical-align:-.12em">${key}</span>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-.18em;flex-shrink:0">${paths}</svg>`;
}
const EXERCISES=[
  {id:'bb-bench',name:'Barbell Bench Press',cat:'Chest',eq:'Barbell',muscle:'Chest'},
  {id:'inc-bench',name:'Incline Bench Press',cat:'Chest',eq:'Barbell',muscle:'Chest'},
  {id:'dec-bench',name:'Decline Bench Press',cat:'Chest',eq:'Barbell',muscle:'Chest'},
  {id:'db-bench',name:'Dumbbell Bench Press',cat:'Chest',eq:'Dumbbell',muscle:'Chest'},
  {id:'inc-db-bench',name:'Incline DB Bench Press',cat:'Chest',eq:'Dumbbell',muscle:'Chest'},
  {id:'db-fly',name:'Dumbbell Fly',cat:'Chest',eq:'Dumbbell',muscle:'Chest'},
  {id:'cable-fly',name:'Cable Fly',cat:'Chest',eq:'Cable',muscle:'Chest'},
  {id:'pushup',name:'Push-Up',cat:'Chest',eq:'Bodyweight',muscle:'Chest'},
  {id:'chest-dip',name:'Chest Dip',cat:'Chest',eq:'Bodyweight',muscle:'Chest'},
  {id:'deadlift',name:'Deadlift',cat:'Back',eq:'Barbell',muscle:'Hamstrings'},
  {id:'hex-dl',name:'Hex Bar Deadlift',cat:'Back',eq:'Barbell',muscle:'Quads'},
  {id:'pullup',name:'Pull-Up',cat:'Back',eq:'Bodyweight',muscle:'Lats'},
  {id:'chinup',name:'Chin-Up',cat:'Back',eq:'Bodyweight',muscle:'Lats'},
  {id:'bb-row',name:'Barbell Row',cat:'Back',eq:'Barbell',muscle:'Lats'},
  {id:'lat-pd',name:'Lat Pulldown',cat:'Back',eq:'Cable',muscle:'Lats'},
  {id:'cable-row',name:'Seated Cable Row',cat:'Back',eq:'Cable',muscle:'Lats'},
  {id:'tbar-row',name:'T-Bar Row',cat:'Back',eq:'Barbell',muscle:'Lats'},
  {id:'db-row',name:'Dumbbell Row',cat:'Back',eq:'Dumbbell',muscle:'Lats'},
  {id:'ohp',name:'Overhead Press',cat:'Shoulders',eq:'Barbell',muscle:'Shoulders'},
  {id:'db-ohp',name:'Dumbbell Shoulder Press',cat:'Shoulders',eq:'Dumbbell',muscle:'Shoulders'},
  {id:'lat-raise',name:'Lateral Raise',cat:'Shoulders',eq:'Dumbbell',muscle:'Shoulders'},
  {id:'front-raise',name:'Front Raise',cat:'Shoulders',eq:'Dumbbell',muscle:'Shoulders'},
  {id:'face-pull',name:'Face Pull',cat:'Shoulders',eq:'Cable',muscle:'Shoulders'},
  {id:'arnold',name:'Arnold Press',cat:'Shoulders',eq:'Dumbbell',muscle:'Shoulders'},
  {id:'shrug',name:'Barbell Shrug',cat:'Shoulders',eq:'Barbell',muscle:'Traps'},
  {id:'bb-curl',name:'Barbell Curl',cat:'Biceps',eq:'Barbell',muscle:'Biceps'},
  {id:'db-curl',name:'Dumbbell Curl',cat:'Biceps',eq:'Dumbbell',muscle:'Biceps'},
  {id:'hammer-curl',name:'Hammer Curl',cat:'Biceps',eq:'Dumbbell',muscle:'Biceps'},
  {id:'preacher-curl',name:'Preacher Curl',cat:'Biceps',eq:'Machine',muscle:'Biceps'},
  {id:'conc-curl',name:'Concentration Curl',cat:'Biceps',eq:'Dumbbell',muscle:'Biceps'},
  {id:'cable-curl',name:'Cable Curl',cat:'Biceps',eq:'Cable',muscle:'Biceps'},
  {id:'tri-pd',name:'Tricep Pushdown',cat:'Triceps',eq:'Cable',muscle:'Triceps'},
  {id:'skull',name:'Skull Crusher',cat:'Triceps',eq:'Barbell',muscle:'Triceps'},
  {id:'cgbp',name:'Close-Grip Bench Press',cat:'Triceps',eq:'Barbell',muscle:'Triceps'},
  {id:'oh-ext',name:'Overhead Tricep Extension',cat:'Triceps',eq:'Dumbbell',muscle:'Triceps'},
  {id:'tri-dip',name:'Tricep Dip',cat:'Triceps',eq:'Bodyweight',muscle:'Triceps'},
  {id:'squat',name:'Barbell Back Squat',cat:'Legs',eq:'Barbell',muscle:'Quads'},
  {id:'front-squat',name:'Front Squat',cat:'Legs',eq:'Barbell',muscle:'Quads'},
  {id:'leg-press',name:'Leg Press',cat:'Legs',eq:'Machine',muscle:'Quads'},
  {id:'rdl',name:'Romanian Deadlift',cat:'Legs',eq:'Barbell',muscle:'Hamstrings'},
  {id:'leg-curl',name:'Leg Curl',cat:'Legs',eq:'Machine',muscle:'Hamstrings'},
  {id:'leg-ext',name:'Leg Extension',cat:'Legs',eq:'Machine',muscle:'Quads'},
  {id:'calf-raise',name:'Calf Raise',cat:'Legs',eq:'Machine',muscle:'Calves'},
  {id:'hack-squat',name:'Hack Squat',cat:'Legs',eq:'Machine',muscle:'Quads'},
  {id:'lunge',name:'Walking Lunge',cat:'Legs',eq:'Bodyweight',muscle:'Quads'},
  {id:'bss',name:'Bulgarian Split Squat',cat:'Legs',eq:'Dumbbell',muscle:'Glutes'},
  {id:'db-step',name:'DB Step-Up',cat:'Legs',eq:'Dumbbell',muscle:'Glutes'},
  {id:'hip-thrust',name:'Hip Thrust',cat:'Legs',eq:'Barbell',muscle:'Glutes'},
  {id:'sumo-dl',name:'Sumo Deadlift',cat:'Legs',eq:'Barbell',muscle:'Hamstrings'},
  {id:'goblet',name:'Goblet Squat',cat:'Legs',eq:'Dumbbell',muscle:'Quads'},
  {id:'glute-kick',name:'Glute Kickback',cat:'Legs',eq:'Cable',muscle:'Glutes'},
  {id:'plank',name:'Plank',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'crunch',name:'Crunch',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'leg-raise',name:'Hanging Leg Raise',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'russian',name:'Russian Twist',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'ab-rollout',name:'Ab Wheel Rollout',cat:'Core',eq:'Other',muscle:'Abs'},
  {id:'cable-crunch',name:'Cable Crunch',cat:'Core',eq:'Cable',muscle:'Abs'},
  {id:'power-clean',name:'Power Clean',cat:'Full Body',eq:'Barbell',muscle:'Hamstrings'},
  {id:'farmers',name:"Farmer's Walk",cat:'Full Body',eq:'Dumbbell',muscle:'Traps'},
  {id:'kb-swing',name:'Kettlebell Swing',cat:'Full Body',eq:'Kettlebell',muscle:'Glutes'},
  {id:'thruster',name:'Thruster',cat:'Full Body',eq:'Barbell',muscle:'Quads'},
  {id:'box-jump',name:'Box Jump',cat:'Full Body',eq:'Bodyweight',muscle:'Quads'},
  {id:'kb-clean',name:'Kettlebell Clean',cat:'Full Body',eq:'Kettlebell',muscle:'Hamstrings'},
  {id:'kb-press',name:'Kettlebell Press',cat:'Shoulders',eq:'Kettlebell',muscle:'Shoulders'},
  {id:'kb-goblet',name:'Kettlebell Goblet Squat',cat:'Legs',eq:'Kettlebell',muscle:'Quads'},
  {id:'kb-row',name:'Kettlebell Row',cat:'Back',eq:'Kettlebell',muscle:'Lats'},
  {id:'med-slam',name:'Medicine Ball Slam',cat:'Full Body',eq:'Medicine Ball',muscle:'Abs'},
  {id:'med-rot',name:'Med Ball Rotational Throw',cat:'Core',eq:'Medicine Ball',muscle:'Abs'},
  {id:'med-squat',name:'Med Ball Squat',cat:'Legs',eq:'Medicine Ball',muscle:'Quads'},
  // ── Additional Bodyweight ──
  {id:'bw-squat',name:'Bodyweight Squat',cat:'Legs',eq:'Bodyweight',muscle:'Quads'},
  {id:'jump-squat',name:'Jump Squat',cat:'Legs',eq:'Bodyweight',muscle:'Quads'},
  {id:'pistol-squat',name:'Pistol Squat',cat:'Legs',eq:'Bodyweight',muscle:'Quads'},
  {id:'jump-lunge',name:'Jump Lunge',cat:'Legs',eq:'Bodyweight',muscle:'Glutes'},
  {id:'glute-bridge',name:'Glute Bridge',cat:'Legs',eq:'Bodyweight',muscle:'Glutes'},
  {id:'bw-calf',name:'Calf Raise (Bodyweight)',cat:'Legs',eq:'Bodyweight',muscle:'Calves'},
  {id:'situp',name:'Sit-Up',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'vup',name:'V-Up',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'bicycle-crunch',name:'Bicycle Crunch',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'flutter-kick',name:'Flutter Kick',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'mountain-climber',name:'Mountain Climber',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'superman',name:'Superman',cat:'Core',eq:'Bodyweight',muscle:'Lower Back'},
  {id:'leg-raises',name:'Leg Raises',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'dead-bug',name:'Dead Bug',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'toe-touch',name:'Toe Touch',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'cross-crunch',name:'Cross Crunch',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'hollow-hold',name:'Hollow Hold',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'windshield-wiper',name:'Windshield Wiper',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'pallof-press',name:'Pallof Press',cat:'Core',eq:'Cable',muscle:'Abs'},
  {id:'dragon-flag',name:'Dragon Flag',cat:'Core',eq:'Bodyweight',muscle:'Abs'},
  {id:'diamond-pu',name:'Diamond Push-Up',cat:'Triceps',eq:'Bodyweight',muscle:'Triceps'},
  {id:'pike-pu',name:'Pike Push-Up',cat:'Shoulders',eq:'Bodyweight',muscle:'Shoulders'},
  {id:'decline-pu',name:'Decline Push-Up',cat:'Chest',eq:'Bodyweight',muscle:'Chest'},
  {id:'wide-pu',name:'Wide Push-Up',cat:'Chest',eq:'Bodyweight',muscle:'Chest'},
  {id:'burpee',name:'Burpee',cat:'Full Body',eq:'Bodyweight',muscle:'Quads'},
  {id:'tuck-jump',name:'Tuck Jump',cat:'Full Body',eq:'Bodyweight',muscle:'Quads'},
  {id:'inchworm',name:'Inchworm',cat:'Full Body',eq:'Bodyweight',muscle:'Hamstrings'},
  {id:'sprawl',name:'Sprawl',cat:'Full Body',eq:'Bodyweight',muscle:'Quads'},
];
const BUILTIN_EX_IDS=new Set(EXERCISES.map(e=>e.id));
const CATS=['All','Chest','Back','Shoulders','Biceps','Triceps','Legs','Core','Full Body'];
const EQUIPMENT_TYPES=['Barbell','Dumbbell','Kettlebell','Machine','Cable','Bodyweight','Medicine Ball','Other'];
const EQUIPMENT_PRESETS=[
  {id:'full',label:'Full Gym',icon:'🏋️',eqs:null},
  {id:'dumbbells',label:'Dumbbells',icon:'💪',eqs:['Dumbbell','Bodyweight']},
  {id:'kettlebell',label:'Kettlebell',icon:'🔔',eqs:['Kettlebell','Dumbbell','Bodyweight']},
  {id:'barbell',label:'Barbell Only',icon:'⚡',eqs:['Barbell','Bodyweight']},
  {id:'bodyweight',label:'Bodyweight',icon:'🤸',eqs:['Bodyweight']},
  {id:'travel',label:'Travel/Hotel',icon:'🧳',eqs:['Dumbbell','Bodyweight','Medicine Ball','Other']},
  {id:'medball',label:'Med Ball',icon:'⚽',eqs:['Medicine Ball','Bodyweight']},
];
const MEV_MAV={
  'Chest':{mev:8,mav:22,lbl:'Chest'},
  'Lats':{mev:10,mav:25,lbl:'Lats'},
  'Traps':{mev:4,mav:16,lbl:'Traps'},
  'Shoulders':{mev:8,mav:20,lbl:'Shoulders'},
  'Biceps':{mev:6,mav:20,lbl:'Biceps'},
  'Triceps':{mev:6,mav:20,lbl:'Triceps'},
  'Forearms':{mev:4,mav:12,lbl:'Forearms'},
  'Quads':{mev:8,mav:20,lbl:'Quads'},
  'Hamstrings':{mev:6,mav:20,lbl:'Hamstrings'},
  'Glutes':{mev:4,mav:16,lbl:'Glutes'},
  'Calves':{mev:8,mav:16,lbl:'Calves'},
  'Abs':{mev:4,mav:16,lbl:'Abs'},
  'Obliques':{mev:2,mav:12,lbl:'Obliques'},
  'Lower Back':{mev:2,mav:10,lbl:'Lower Back'},
};
// Secondary movers (counted at 0.5 sets). Primary mover is the exercise's own `muscle` (1.0).
// Only muscles in the MEV_MAV taxonomy are tracked; pure isolations have no secondaries.
const SEC_MUSCLE={
  'bb-bench':['Shoulders','Triceps'],'inc-bench':['Shoulders','Triceps'],'dec-bench':['Shoulders','Triceps'],
  'db-bench':['Shoulders','Triceps'],'inc-db-bench':['Shoulders','Triceps'],'db-fly':['Shoulders'],'cable-fly':['Shoulders'],
  'pushup':['Shoulders','Triceps'],'chest-dip':['Shoulders','Triceps'],
  'deadlift':['Glutes','Quads','Traps','Lats','Lower Back','Forearms'],'hex-dl':['Glutes','Hamstrings','Traps','Lower Back','Forearms'],
  'pullup':['Biceps','Traps','Forearms'],'chinup':['Biceps','Traps','Forearms'],'bb-row':['Biceps','Traps','Lower Back','Forearms'],
  'lat-pd':['Biceps','Forearms'],'cable-row':['Biceps','Traps','Forearms'],'tbar-row':['Biceps','Traps','Lower Back','Forearms'],'db-row':['Biceps','Traps','Forearms'],
  'ohp':['Triceps','Traps'],'db-ohp':['Triceps','Traps'],'face-pull':['Traps'],'arnold':['Triceps','Traps'],
  'shrug':['Forearms'],'bb-curl':['Forearms'],'db-curl':['Forearms'],'hammer-curl':['Forearms'],'cable-curl':['Forearms'],
  'cgbp':['Chest','Shoulders'],'tri-dip':['Chest','Shoulders'],
  'squat':['Glutes','Hamstrings','Lower Back'],'front-squat':['Glutes','Hamstrings','Abs','Lower Back'],'leg-press':['Glutes','Hamstrings'],
  'rdl':['Glutes','Traps','Lower Back','Forearms'],'hack-squat':['Glutes','Hamstrings'],'lunge':['Glutes','Hamstrings'],
  'bss':['Quads','Hamstrings'],'db-step':['Quads','Hamstrings'],'hip-thrust':['Hamstrings'],
  'sumo-dl':['Glutes','Quads','Traps','Lats','Lower Back','Forearms'],'goblet':['Glutes','Hamstrings','Abs'],'glute-kick':['Hamstrings'],
  'farmers':['Forearms','Lower Back','Abs'],
  'power-clean':['Glutes','Quads','Traps','Shoulders','Lower Back','Forearms'],'kb-swing':['Hamstrings','Abs','Shoulders','Lower Back'],
  'thruster':['Glutes','Shoulders','Triceps'],'box-jump':['Glutes','Hamstrings'],
  'kb-clean':['Glutes','Quads','Traps','Shoulders','Forearms','Lower Back'],'kb-press':['Triceps','Traps'],'kb-goblet':['Glutes','Hamstrings'],'kb-row':['Biceps','Traps','Forearms'],
  'med-slam':['Lats','Shoulders','Abs'],'med-squat':['Glutes','Hamstrings'],'med-rot':['Obliques'],
  'bw-squat':['Glutes','Hamstrings'],'jump-squat':['Glutes','Hamstrings'],'pistol-squat':['Glutes','Hamstrings'],
  'jump-lunge':['Quads','Hamstrings'],'glute-bridge':['Hamstrings'],
  'diamond-pu':['Chest','Shoulders'],'pike-pu':['Shoulders','Triceps'],'decline-pu':['Shoulders','Triceps'],'wide-pu':['Shoulders','Triceps'],
  'burpee':['Glutes','Chest','Triceps'],'tuck-jump':['Glutes','Hamstrings'],'inchworm':['Abs','Shoulders'],'sprawl':['Glutes','Hamstrings'],
  'mountain-climber':['Quads','Shoulders'],'superman':['Glutes'],
  'leg-raises':['Quads'],'dead-bug':['Quads','Shoulders'],
  'toe-touch':['Hamstrings'],'cross-crunch':['Quads','Obliques'],
  'hollow-hold':['Quads'],'windshield-wiper':['Quads','Obliques'],
  'pallof-press':['Glutes','Obliques'],'dragon-flag':['Quads','Lats'],
  'russian':['Obliques'],'bicycle-crunch':['Obliques'],'ab-rollout':['Lats','Lower Back'],
};
// Back-compat: map any legacy anatomical/label names (e.g. on stored custom exercises) to the current region taxonomy.
// Also absorbs the names an LLM or another app is likely to use ("Rear Delts", "quadriceps").
const MUSCLE_ALIAS={'pectoralis major':'Chest','pecs':'Chest','pectorals':'Chest','upper chest':'Chest','lower chest':'Chest',
  'latissimus dorsi':'Lats','lat':'Lats','back':'Lats','upper back':'Traps','mid back':'Traps','middle back':'Traps','rhomboids':'Traps','trapezius':'Traps','trap':'Traps',
  'deltoids':'Shoulders','deltoid':'Shoulders','delts':'Shoulders','front delts':'Shoulders','anterior deltoid':'Shoulders','side delts':'Shoulders','lateral deltoid':'Shoulders','rear delts':'Shoulders','rear deltoids':'Shoulders','posterior deltoid':'Shoulders','shoulder':'Shoulders',
  'biceps brachii':'Biceps','bicep':'Biceps','brachialis':'Biceps','triceps brachii':'Triceps','tricep':'Triceps',
  'forearm':'Forearms','grip':'Forearms','brachioradialis':'Forearms','wrist flexors':'Forearms',
  'quadriceps':'Quads','quad':'Quads','hamstring':'Hamstrings','hams':'Hamstrings',
  'gluteus maximus':'Glutes','glute':'Glutes','gluteus':'Glutes','gluteals':'Glutes','glute medius':'Glutes','hips':'Glutes','abductors':'Glutes',
  'gastrocnemius/soleus':'Calves','gastrocnemius':'Calves','soleus':'Calves','calf':'Calves',
  'rectus abdominis':'Abs','abdominals':'Abs','ab':'Abs','core':'Abs','hip flexors':'Abs','oblique':'Obliques',
  'erector spinae':'Lower Back','erectors':'Lower Back','spinal erectors':'Lower Back','low back':'Lower Back','lower-back':'Lower Back'};
const MUSCLE_BY_LOWER={};Object.keys(MEV_MAV).forEach(k=>{MUSCLE_BY_LOWER[k.toLowerCase()]=k;});
// Canonical tracked muscle for any spelling; returns the input unchanged if it isn't recognised.
function normMuscle(m){
  if(!m)return m;
  if(MEV_MAV[m])return m;
  const k=String(m).trim().toLowerCase();
  return MUSCLE_BY_LOWER[k]||MUSCLE_ALIAS[k]||m;
}
// Library category that goes with a primary muscle (used when an import creates a new exercise).
const MUSCLE_CAT={Chest:'Chest',Lats:'Back','Lower Back':'Back',Traps:'Shoulders',Shoulders:'Shoulders',Biceps:'Biceps',Forearms:'Biceps',Triceps:'Triceps',
  Quads:'Legs',Hamstrings:'Legs',Glutes:'Legs',Calves:'Legs',Abs:'Core',Obliques:'Core'};
function muscleContribs(exId){
  const info=getEx(exId);if(!info||!info.muscle)return[];
  const pm=normMuscle(info.muscle);
  const out=MEV_MAV[pm]?[{muscle:pm,w:1}]:[];
  (SEC_MUSCLE[exId]||[]).forEach(m=>{const mm=normMuscle(m);if(mm!==pm&&MEV_MAV[mm])out.push({muscle:mm,w:0.5});});
  return out;
}
// Contribution-weighted working sets per muscle for completed workouts in [start,end).
function muscleSetsInRange(start,end){
  const m={};Object.keys(MEV_MAV).forEach(k=>m[k]=0);
  S.workouts.filter(w=>w.started>=start&&w.started<end).forEach(wk=>{
    wk.exercises.forEach(ex=>{
      const done=ex.sets.filter(setCounts).length;if(!done)return;
      muscleContribs(ex.exId).forEach(c=>{if(m[c.muscle]!==undefined)m[c.muscle]+=done*c.w;});
    });
  });
  return m;
}
function fmtSets(x){return Number.isInteger(x)?String(x):x.toFixed(1);}
// ─── Program evaluator (2-week basis) ───
function inferDaysPerWeek(){const ago=Date.now()-28*86400000;const n=S.workouts.filter(w=>w.started>=ago).length;return n?Math.min(7,Math.max(1,Math.round(n/4))):4;}
function goalVolScale(){return({strength:0.7,recomp:1.0,weightloss:0.85,general:0.85})[S.goal]||1.0;}
function routineMuscleSets(routine){
  const m={};(routine.exercises||[]).forEach(ex=>{const n=parseInt(ex.sets)||0;if(!n)return;muscleContribs(ex.exId).forEach(c=>{m[c.muscle]=(m[c.muscle]||0)+n*c.w;});});
  return m;
}
// Projected contribution-weighted sets per muscle over a rolling 2 weeks for a group.
function groupProjection(g){
  const proj={};Object.keys(MEV_MAV).forEach(k=>proj[k]=0);
  const routines=(g.routineIds||[]).map(id=>(S.routines||[]).find(r=>r.id===id)).filter(Boolean);
  let sessions=0;
  if(g.mode==='daypicker'){
    routines.forEach(r=>{const days=((g.dayMap||{})[r.id]||[]).length;if(!days)return;sessions+=days*2;const ms=routineMuscleSets(r);Object.keys(ms).forEach(k=>{if(proj[k]!==undefined)proj[k]+=ms[k]*days*2;});});
  }else{
    const D=g.daysPerWeek||inferDaysPerWeek();const N=routines.length||1;sessions=Math.round(2*D);const runs=(2*D)/N;
    routines.forEach(r=>{const ms=routineMuscleSets(r);Object.keys(ms).forEach(k=>{if(proj[k]!==undefined)proj[k]+=ms[k]*runs;});});
  }
  return{proj,sessions,nRoutines:routines.length};
}
const ACT_TYPES=[
  {id:'run',label:'Run',icon:'🏃',fields:['dist','dur'],mets:8},
  {id:'ruck',label:'Ruck March',icon:'🎒',fields:['dist','dur','ruckWeight','terrain'],mets:6},
  {id:'bike',label:'Bike',icon:'🚴',fields:['dist','dur'],mets:7},
  {id:'hike',label:'Hike',icon:'⛰️',fields:['dist','dur'],mets:5.5},
  {id:'swim',label:'Swim',icon:'🏊',fields:['dur'],mets:7},
  {id:'walk',label:'Walk',icon:'🚶',fields:['dist','dur'],mets:3.5},
  {id:'other',label:'Other',icon:'⚡',fields:['dur'],mets:5},
  {id:'sprint',label:'Sprint Intervals',icon:'⚡',fields:[],mets:9,hidden:true},
];
const AFT_EVENTS=[
  {id:'MDL',name:'Max Deadlift',unit:'lbs',desc:'3-rep max, hex bar',dir:'high'},
  {id:'HRP',name:'Hand-Release Push-Up',unit:'reps',desc:'Reps in 2:00',dir:'high'},
  {id:'SDC',name:'Sprint-Drag-Carry',unit:'time',desc:'5 × 50 m shuttles',dir:'low'},
  {id:'PLK',name:'Plank',unit:'time',desc:'Max hold',dir:'high'},
  {id:'2MR',name:'Two-Mile Run',unit:'time',desc:'Overall time',dir:'low'},
];
const GOALS=[
  {id:'strength',label:'Strength & Power',icon:'🏋️',sub:'Max lifts, PRs, standards'},
  {id:'recomp',label:'Body Recomposition',icon:'⚖️',sub:'Build muscle, lose fat'},
  {id:'weightloss',label:'Weight Loss',icon:'🔥',sub:'Calories, steps, deficit'},
  {id:'general',label:'General Fitness',icon:'💪',sub:'Stay active and consistent'},
];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const MEAS_FIELDS=[
  {id:'neck',label:'Neck'},{id:'chest',label:'Chest'},
  {id:'leftArm',label:'Left Arm'},{id:'rightArm',label:'Right Arm'},
  {id:'leftForearm',label:'Left Forearm'},{id:'rightForearm',label:'Right Forearm'},
  {id:'waist',label:'Waist'},{id:'hips',label:'Hips'},
  {id:'leftThigh',label:'Left Thigh'},{id:'rightThigh',label:'Right Thigh'},
  {id:'leftCalf',label:'Left Calf'},{id:'rightCalf',label:'Right Calf'},
];
const STR_STANDARDS={
  'bb-bench':{name:'Bench Press',m:[0.5,0.75,1.0,1.25,1.5],f:[0.35,0.5,0.75,1.0,1.25]},
  'squat':{name:'Back Squat',m:[0.75,1.0,1.25,1.5,2.0],f:[0.5,0.75,1.0,1.25,1.5]},
  'deadlift':{name:'Deadlift',m:[1.0,1.25,1.5,2.0,2.5],f:[0.75,1.0,1.25,1.5,2.0]},
  'ohp':{name:'Overhead Press',m:[0.35,0.5,0.65,0.8,1.0],f:[0.2,0.35,0.45,0.55,0.7]},
  'hex-dl':{name:'Hex Bar Deadlift',m:[1.0,1.3,1.75,2.25,2.75],f:[0.75,1.0,1.3,1.75,2.25]},
  'bb-row':{name:'Barbell Row',m:[0.5,0.7,0.9,1.1,1.35],f:[0.35,0.5,0.65,0.8,1.0]},
};
const STD_LABELS=['Beginner','Novice','Intermediate','Advanced','Elite'];
const STD_COLORS=['#c4bdb2','#2a6fc4','#2d7a52','#b87c2a','#b83c3c'];
// Wilks at end regardless of goal
const DASH_CARDS=[
  {id:'energy',title:'Energy Balance',icon:'🔥'},
  {id:'weekly',title:'Weekly Summary',icon:'📊'},
  {id:'strength',title:'Strength Trends',icon:'📈'},
  {id:'prs',title:'Personal Records',icon:'🏆'},
  {id:'volume',title:'Volume Tracker',icon:'🎯'},
  {id:'bodyweight',title:'Bodyweight Trend',icon:'⚖️'},
  {id:'measurements',title:'Body Measurements',icon:'📏'},
  {id:'standards',title:'Strength Standards',icon:'🏅'},
  {id:'aft',title:'Army Fitness (AFT)',icon:'🎖️'},
  {id:'consistency',title:'Training Consistency',icon:'📅'},
  {id:'recovery',title:'Fatigue Monitor',icon:'🔋'},
  {id:'rucking',title:'Rucking & Cardio',icon:'🎒'},
  {id:'wilks',title:'Wilks / DOTS Score',icon:'⚡'},
];
const GOAL_ORDER={
  strength:['prs','strength','standards','volume','weekly','consistency','bodyweight','energy','measurements','recovery','aft','rucking','wilks'],
  recomp:['bodyweight','energy','measurements','volume','weekly','strength','prs','consistency','recovery','rucking','aft','standards','wilks'],
  weightloss:['energy','bodyweight','weekly','rucking','measurements','consistency','volume','strength','prs','recovery','aft','standards','wilks'],
  general:['weekly','energy','consistency','volume','bodyweight','strength','prs','measurements','rucking','recovery','aft','standards','wilks'],
};
// Cards opened by default the first time a given goal is viewed (one-time seed per goal;
// the user's manual expand/collapse afterward is preserved).
const GOAL_OPEN={
  strength:['prs','strength'],
  recomp:['bodyweight','measurements','volume'],
  weightloss:['energy','bodyweight','weekly'],
  general:['weekly','consistency'],
};
