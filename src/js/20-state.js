// ═══════════════════════════════════════════════════
// STATE + STORAGE
// ═══════════════════════════════════════════════════
const APP_VERSION='__APP_VERSION__';
const STORE_KEY='lahwe_v2';             // unchanged, so existing installs keep their data
const LEGACY_KEYS=['lahwe_v1','ironlog_v5'];
const UNDO_KEY='lahwe_v2_undo';         // snapshot taken just before a backup is restored
// API keys are NEVER part of S. They live in their own device-only entries so they cannot end up in a
// backup, an undo snapshot, or anything else built from S. See 63-ai-providers.js.
const AI_KEYS_KEY='lahwe_ai_keys';      // {anthropic,openai,gemini,openrouter,custom,customUrl}
const LEGACY_API_KEY_KEY='lahwe_api_key'; // where the first AI builder kept a single Claude key
const COACH_CHAT_KEY='lahwe_coach_v1';  // the coach conversation; device-only, not part of backups
const COACH_ARCHIVE_KEY='lahwe_coach_archive'; // earlier conversations; device-only, kept in the device database
const MUSIC_KEY='lahwe_music';         // Spotify client ID and sign-in; device-only, not part of backups
const SCHEMA=4;
let S={};

// Every field the app reads. normalizeState() guarantees all of them exist, so nothing
// downstream needs its own "if missing" patching.
function defaultState(){
  const now=new Date();
  return{
    _schema:SCHEMA,_savedAt:0,
    tab:'workout',libTab:'routines',progView:'progress',homeView:'', // progView: progress | history (views of the Progress tab); homeView: '' | schedule | habits (pages of Home)
    unit:'lbs',restDur:90,bodyweight:185,name:'',exRest:{},
    aftAge:'22-26',aftGender:'male',aftStandard:'general',
    aftCurrent:{MDL:'',HRP:'',SDC:'',PLK:'','2MR':''},
    aftGoals:{MDL:'',HRP:'',SDC:'',PLK:'','2MR':''},
    aftHistory:[],activeWorkout:null,workouts:[],routines:[],groups:[],
    // Saved programs (56-programs.js): splits run in order, each for a number of weeks. One runs at a time.
    programs:[],
    supps:[],suppLogs:{},prs:{},prsManual:{},custom:[],
    activities:[],stepsLog:{},exFilter:'All',exSearch:'',
    calYear:now.getFullYear(),calMonth:now.getMonth(),
    onboarded:false,goal:'general',darkMode:systemPrefersDark(),primaryColor:'navy', // a new install starts in the phone's own light or dark setting
    measurements:[],bodyweightLog:[],
    measureUnit:'in',height:69,measPart:null,birthMonth:null,birthYear:null,
    macroGoals:{protein:150,carbs:200,fat:60,cals:2000},
    macroLogs:{},weightGoal:null,weightGoalDir:null,
    schedule:{type:'weekly',weeklyDays:[1,2,4,5],cycleOn:2,cycleOff:1,cycleStart:dstr(now),overrides:{},routineOverrides:{}},
    equipPreset:'full',
    meals:[],foodCache:{},customFoods:[],savedMeals:[],recentFoods:[],recentSavedMeals:[],
    // stars: [{id,k:'food'|'meal',ref,unit,val}] (89-food-log.js); barcodeLinks: {barcode: foodId}, a scan that opens one of your foods.
    stars:[],barcodeLinks:{},
    activeCardDeck:null,activeSprintTimer:null,
    restTimer:null,restStyle:'pill',restSound:true,keepAwake:true,
    trackFeel:true,trackSleep:true,sleepLog:{}, // asked at Finish and with the weigh-in; each has a switch in Settings
    lastExportAt:0,
    // AI coach: which provider and model, and what it may do. No key in here — ever.
    ai:{provider:'anthropic',models:{},logAccess:true,instant:true},
    coachNotes:[],
    // Weekly meal plan: days[0] is Sunday … days[6] is Saturday; each day is a list of meals.
    mealPlan:{days:[[],[],[],[],[],[],[]],note:'',updatedAt:0,checked:{},fast:{},extras:[]},
    reminders:defaultReminders(),
    // Which substitutes you picked for which lift (learns your preferences), coach-set targets
    // per routine (cleared once used), and the fitness-test date plan.
    swapLog:{},nextTargets:{},testPlan:null,
    // Rest-day macro targets (null = one set of targets for every day) and the days you set by hand.
    restGoals:null,dayKind:{},
    // The unit each food was last logged in when it was weighed ('g' or 'oz'); servings need no entry.
    foodUnits:{},
    foodKinds:{}, // how an any-kind food was last set: {g_steak:'lean~alt'}
    // Which profile facts were actually given rather than left at their defaults. Calorie and
    // strength estimates say so when they are running on a default.
    profileSet:{sex:false,height:false},
    // The Progress board: the time range it covers, and its tiles once the user has arranged
    // them (null = the layout for their goal).
    board:{range:'12w',tiles:null},
    // The running features (Settings → Running): null = on by themselves once three runs or rucks
    // with a distance are logged; true / false once the switch has been touched.
    running:null,
    // Running, continued: a yearly distance goal ({miles}), which pairs of shoes are retired
    // ({name:{retired:true}}), and marked stretches with their times (their lines are routes).
    runGoal:null,shoes:{},segments:[],
    // Habits (58-habits.js): the list, what was ticked each day, and one mood rating a day (1-5).
    // trackMood asks for yesterday's mood in the daily check-in. calLens: the calendar's view on Progress.
    habits:[],habitLog:{},moodLog:{},trackMood:true,calLens:'all',calHabit:null,bodyLens:'sets',reportSeen:null,yearSeen:null,
    // Progress photos: how many each check-in (1-4), self-timer seconds, the faint last photo to line
    // up with, which camera, and whether the first-time note was shown.
    photoSet:2,photoTimer:0,photoGhost:true,photoFacing:'user',photoIntro:false,photoHide:true,
    homeLayout:'balanced', // Settings → Home layout (57-home-layouts.js)
    // Settings, v3.18. themeMode: system | light | dark (darkMode above is what is showing).
    // weekStart: 1 Monday, 0 Sunday. dayEnd: hour (0-4) before which the clock still counts as
    // the day before. pauses: [{id,from,to,why}] — days when nothing is expected (86-pause.js).
    themeMode:'system',weekStart:1,dayEnd:0,pauses:[],
    // Training kit (87-gear.js): gear.mode standard (any weight) | fixed (only the plates listed,
    // as pairs); gear.bar the usual bar; gear.dbs the dumbbells owned, as typed ("5-50, 60").
    // steps: the weight step per kind of equipment where it is not the built-in one.
    // autoWarm: off | first | barbell. lastFrom: routine (same routine first) | any (most recent).
    gear:{mode:'standard',bar:null,plates:null,dbs:''},steps:{},autoWarm:'off',lastFrom:'routine',
    // Cues (88-cues.js): volume 1-4, which sound, and whether they play when the iPhone is on silent.
    // swipeRest: the Simple card turns into the rest countdown and flips itself when it ends;
    // swipeHold: a timed set on the Simple card counts itself down and logs when time is up.
    cueVol:3,cueSound:'chime',cueSilent:false,swipeRest:true,swipeHold:true,
    // Progress photos: what each one is (the pictures themselves are in the device database, 69-photos.js).
    photos:[],
    // Which muscles a built-in exercise counts toward, where you changed it: {exId:{muscle,sec:[]}}.
    exMuscle:{},
    // Custom exercises filed under the old single Shoulders group, waiting for you to confirm the head.
    shoulderReview:null,
  };
}
function systemPrefersDark(){try{return !!(typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);}catch(e){return false;}}
function initState(){S=defaultState();}
function isObj(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}

// Turns anything (an old save, an imported backup, nothing at all) into a complete, well-typed state.
// This is the only place stored data is trusted to become S.
function normalizeState(raw){
  const d=defaultState();
  const s=isObj(raw)?raw:{};
  // Saves written before schema versions existed carry no marker; treat them as v2.
  const from=isObj(raw)?(parseInt(raw._schema)||2):SCHEMA;
  const hadProfileSet=isObj(s.profileSet); // read before the defaults are filled in below
  // A save from before the theme had three choices keeps the light or dark it was showing.
  const hadThemeMode=isObj(raw)&&raw.themeMode!=null;
  if(isObj(raw)&&!hadThemeMode&&typeof raw.darkMode==='boolean')s.themeMode=raw.darkMode?'dark':'light';
  delete s._routes; // a backup's routes go to the device database (routesFromBackup), never into S
  delete s._photoFiles;delete s._photoThumbs; // likewise a backup's photos (photoFilesFromBackup)
  Object.keys(d).forEach(k=>{
    const dv=d[k],sv=s[k];
    if(sv===undefined||sv===null){s[k]=dv;return;}
    if(Array.isArray(dv)){if(!Array.isArray(sv))s[k]=dv;}
    else if(isObj(dv)){if(!isObj(sv))s[k]=dv;}
  });
  s.schedule=Object.assign({},d.schedule,s.schedule);
  if(!isObj(s.schedule.overrides))s.schedule.overrides={};
  if(!isObj(s.schedule.routineOverrides))s.schedule.routineOverrides={};
  if(s.macroGoals.calories&&!s.macroGoals.cals)s.macroGoals.cals=s.macroGoals.calories;
  delete s.macroGoals.calories;
  s.macroGoals=Object.assign({},d.macroGoals,s.macroGoals);
  s.aftCurrent=Object.assign({},d.aftCurrent,s.aftCurrent);
  s.aftGoals=Object.assign({},d.aftGoals,s.aftGoals);
  if(s.unit!=='kg')s.unit='lbs';
  if(!(parseFloat(s.bodyweight)>0))s.bodyweight=d.bodyweight;
  if(!(parseFloat(s.height)>0))s.height=d.height;

  const fixSets=ex=>{ex.sets=Array.isArray(ex.sets)?ex.sets.filter(isObj):[];return ex;};
  const fixWorkout=w=>{
    w.exercises=(Array.isArray(w.exercises)?w.exercises:[]).filter(e=>isObj(e)&&e.exId).map(fixSets);
    if(!w.id)w.id=uid();
    w.started=Number(w.started)||Date.parse(w.started)||Date.now();
    if(w.ended!=null)w.ended=Number(w.ended)||Date.parse(w.ended)||null;
    if(w.name==null)w.name='Workout';
    return w;
  };
  s.workouts=s.workouts.filter(isObj).map(fixWorkout).sort((a,b)=>b.started-a.started);
  if(isObj(s.activeWorkout))fixWorkout(s.activeWorkout);else s.activeWorkout=null;
  s.routines=s.routines.filter(isObj).map(r=>{
    if(!r.id)r.id=uid();if(r.name==null)r.name='Routine';
    r.exercises=(Array.isArray(r.exercises)?r.exercises:[]).filter(e=>isObj(e)&&e.exId);
    if(!Array.isArray(r.days))r.days=[];
    return r;
  });
  s.groups=s.groups.filter(isObj).map(g=>{
    if(!g.id)g.id=uid();if(g.name==null)g.name='Group';
    if(g.mode!=='daypicker')g.mode='rotation';
    g.routineIds=(Array.isArray(g.routineIds)?g.routineIds:[]).filter(id=>s.routines.some(r=>r.id===id));
    if(!isObj(g.dayMap))g.dayMap={};
    g.cursor=g.routineIds.length?(parseInt(g.cursor)||0)%g.routineIds.length:0;
    return g;
  });
  if(s.groups.filter(g=>g.active).length>1){let seen=false;s.groups.forEach(g=>{if(g.active&&seen)g.active=false;if(g.active)seen=true;});}
  if(s.program!=null&&!(isObj(s.program)&&Array.isArray(s.program.phases)))s.program=null; // the single program from before v4; migrated below
  s.custom=s.custom.filter(e=>isObj(e)&&e.id&&e.name);
  s.activities=s.activities.filter(a=>isObj(a)&&a.date).map(cleanActivityExtras);
  s.running=s.running===true?true:s.running===false?false:null;
  s.runGoal=normalizeRunGoal(s.runGoal);s.shoes=normalizeShoes(s.shoes);s.segments=normalizeSegments(s.segments,s.activities);
  s.meals=s.meals.filter(m=>isObj(m)&&m.date).map(m=>{if(m.items!=null)m.items=(Array.isArray(m.items)?m.items:[]).filter(isObj);return m;});
  s.supps=s.supps.filter(x=>isObj(x)&&x.id);
  s.measurements=s.measurements.filter(m=>isObj(m)&&m.date&&isObj(m.values));
  s.bodyweightLog=s.bodyweightLog.filter(b=>isObj(b)&&b.date&&parseFloat(b.weight)>0).map(b=>{b.weight=parseFloat(b.weight);return b;});
  s.savedMeals=s.savedMeals.filter(c=>isObj(c)&&Array.isArray(c.items)).map(c=>{c.items=c.items.filter(isObj);return c;});
  s.customFoods=s.customFoods.filter(f=>isObj(f)&&f.id);
  migrateStars(s);s.barcodeLinks=normalizeBarcodeLinks(s.barcodeLinks);
  s.recentFoods=s.recentFoods.filter(x=>typeof x==='string'&&x);s.recentSavedMeals=s.recentSavedMeals.filter(x=>typeof x==='string'&&x);
  if(!THEMES.some(t=>t.id===s.primaryColor))s.primaryColor='navy';
  if(!GOALS.some(g=>g.id===s.goal))s.goal='general';
  // AI settings. The model chosen for the first (Claude-only) builder carries over.
  s.ai=Object.assign({},d.ai,s.ai);
  if(!AI_PROVIDERS[s.ai.provider])s.ai.provider='anthropic';
  if(!isObj(s.ai.models))s.ai.models={};
  Object.keys(s.ai.models).forEach(k=>{const v=s.ai.models[k];if(!AI_PROVIDERS[k]||typeof v!=='string'||!AI_MODEL_ID_RE.test(v))delete s.ai.models[k];});
  if(typeof s.aiModel==='string'&&AI_MODEL_ID_RE.test(s.aiModel)&&!s.ai.models.anthropic)s.ai.models.anthropic=s.aiModel;
  delete s.aiModel;
  s.ai.logAccess=s.ai.logAccess!==false;s.ai.instant=s.ai.instant!==false;
  // Anything that looks like a credential is dropped from the AI settings on the way in: a backup
  // written by some other tool, or edited by hand, must not be able to smuggle a key into S.
  Object.keys(s.ai).forEach(k=>{if(!['provider','models','logAccess','instant'].includes(k))delete s.ai[k];});
  s.coachNotes=s.coachNotes.filter(n=>isObj(n)&&typeof n.text==='string'&&n.text.trim()).slice(0,COACH_MAX_NOTES).map(n=>({id:String(n.id||uid()),text:n.text.trim().slice(0,COACH_NOTE_LEN),at:Number(n.at)||0}));
  s.mealPlan=normalizeMealPlan(s.mealPlan);
  s.reminders=normalizeReminders(s.reminders);
  s.swapLog=normalizeSwapLog(s.swapLog);
  s.nextTargets=normalizeNextTargets(s.nextTargets,s.routines);
  s.testPlan=normalizeTestPlan(s.testPlan);
  s.restGoals=normalizeRestGoals(s.restGoals);
  s.dayKind=normalizeDayKind(s.dayKind);
  s.foodUnits=normalizeFoodUnits(s.foodUnits);
  s.foodKinds=normalizeFoodKinds(s.foodKinds);
  // Sleep: hours by day. Anything that is not a plausible night is dropped.
  {const sl={};if(isObj(s.sleepLog))Object.keys(s.sleepLog).sort().slice(-900).forEach(k=>{const v=parseFloat(s.sleepLog[k]);if(/^\d{4}-\d{2}-\d{2}$/.test(k)&&v>0&&v<=16)sl[k]=Math.round(v*2)/2;});s.sleepLog=sl;}
  s.trackFeel=s.trackFeel!==false;s.trackSleep=s.trackSleep!==false;s.trackMood=s.trackMood!==false;
  if(!HOME_LAYOUTS.some(l=>l.id===s.homeLayout))s.homeLayout='balanced';
  s.habits=normalizeHabits(s.habits);s.habitLog=normalizeHabitLog(s.habitLog,s.habits);s.moodLog=normalizeMoodLog(s.moodLog);
  if(s.bodyLens!=='recovery')s.bodyLens='sets';
  s.photoSet=[1,2,3,4].includes(+s.photoSet)?+s.photoSet:2;s.photoTimer=[0,3,10].includes(+s.photoTimer)?+s.photoTimer:0;
  s.photoGhost=s.photoGhost!==false;s.photoFacing=s.photoFacing==='environment'?'environment':'user';s.photoIntro=!!s.photoIntro;s.photoHide=s.photoHide!==false;
  if(!/^\d{4}-\d{2}$/.test(s.reportSeen||''))s.reportSeen=null;if(!/^\d{4}$/.test(s.yearSeen||''))s.yearSeen=null;
  if(!CAL_LENSES.some(l=>l.id===s.calLens))s.calLens='all';if(typeof s.calHabit!=='string'||!s.habits.some(h=>h.id===s.calHabit))s.calHabit=null;
  s.workouts.forEach(w=>{if(w&&w.feel!=null){const f=parseInt(w.feel);if(f>=1&&f<=5)w.feel=f;else delete w.feel;}});
  s.board=normalizeBoard(s.board);
  s.workouts.forEach(w=>{if(w.prog!=null&&!(isObj(w.prog)&&typeof w.prog.id==='string'))delete w.prog;});
  s.photos=normalizePhotos(s.photos);
  s.exMuscle=normalizeExMuscle(s.exMuscle);
  if(!Array.isArray(s.shoulderReview))s.shoulderReview=null;
  // The collapsible Progress cards are gone; their open/closed state went with them.
  delete s.expandedCards;delete s.progSeeded;delete s.progExId;
  // Saves from before this was tracked: "female" and any height other than the default were chosen by someone.
  s.profileSet=hadProfileSet?{sex:!!s.profileSet.sex,height:!!s.profileSet.height}
    :{sex:s.aftGender==='female',height:parseFloat(s.height)>0&&parseFloat(s.height)!==69};
  if(!EQUIPMENT_PRESETS.some(p=>p.id===s.equipPreset))s.equipPreset='full';
  normalizeSettingsV318(s);
  if(!(parseInt(s.restDur)>0))s.restDur=90;
  // History used to be its own tab; it is now a view inside Progress.
  // History used to be its own tab, then a view of Progress; the calendar (Schedule) now lives on Home.
  if(s.tab==='history'){s.tab=s.histTab==='cal'?'workout':'progress';s.progView='history';if(s.tab==='workout')s.homeView='schedule';}
  if(s.progView==='schedule'){s.progView='progress';if(s.tab==='progress'){s.tab='workout';s.homeView='schedule';}}
  delete s.histTab;
  if(!PROG_VIEWS.includes(s.progView))s.progView='progress';
  if(s.homeView!=='schedule'&&s.homeView!=='habits')s.homeView='';
  if(!TABS.includes(s.tab))s.tab='workout';

  if(from<3)migrateToV3(s);
  if(from<4)migrateToV4(s);
  delete s.program;
  s.programs=normalizePrograms(s.programs,s.groups);
  s._schema=SCHEMA;
  return s;
}
// The settings added in v3.18, each brought into range (a hand-edited or old backup can hold anything).
function normalizeSettingsV318(s){
  if(!['system','light','dark'].includes(s.themeMode))s.themeMode='system';
  s.weekStart=+s.weekStart===0?0:1;
  s.dayEnd=[0,1,2,3,4].includes(+s.dayEnd)?+s.dayEnd:0;
  s.pauses=(Array.isArray(s.pauses)?s.pauses:[]).filter(p=>isObj(p)&&/^\d{4}-\d{2}-\d{2}$/.test(p.from||'')&&(p.to==null||/^\d{4}-\d{2}-\d{2}$/.test(p.to)))
    .map(p=>({id:typeof p.id==='string'&&p.id?p.id:uid(),from:p.from,to:p.to&&p.to>=p.from?p.to:null,why:PAUSE_WHY.some(w=>w.id===p.why)?p.why:'other'}))
    .sort((a,b)=>a.from<b.from?-1:1).slice(-200);
  const g=isObj(s.gear)?s.gear:{};
  const plates={};if(isObj(g.plates))Object.keys(g.plates).forEach(k=>{const w=parseFloat(k),n=parseInt(g.plates[k]);if(w>0&&w<=100&&n>=0&&n<=20)plates[String(w)]=n;});
  s.gear={mode:g.mode==='fixed'?'fixed':'standard',bar:parseFloat(g.bar)>0&&parseFloat(g.bar)<=60?parseFloat(g.bar):null,
    plates:Object.keys(plates).length?plates:null,dbs:typeof g.dbs==='string'?g.dbs.slice(0,200):''};
  const st={};if(isObj(s.steps))STEP_EQ.forEach(e=>{const v=parseFloat(s.steps[e]);if(v>0&&v<=25)st[e]=v;});s.steps=st;
  if(!['off','first','barbell'].includes(s.autoWarm))s.autoWarm='off';
  if(s.lastFrom!=='any')s.lastFrom='routine';
  s.cueVol=[1,2,3,4].includes(+s.cueVol)?+s.cueVol:3;
  if(!CUE_SOUNDS.some(c=>c.id===s.cueSound))s.cueSound='chime';
  s.cueSilent=s.cueSilent===true;delete s.cueDuck;s.swipeRest=s.swipeRest!==false;s.swipeHold=s.swipeHold!==false;
}
// v3: PRs are derived from workout history. Any stored PR that history can't account for is kept
// as a "carried over" record instead of silently disappearing; it can be removed from the PR card.
function migrateToV3(s){
  const hist=computeHistoryPRs(s.workouts);
  const keep={};
  Object.keys(isObj(s.prs)?s.prs:{}).forEach(id=>{
    const p=s.prs[id];if(!isObj(p))return;
    const w=parseFloat(p.w),r=parseInt(p.r);if(!(w>0)||!(r>0))return;
    const est=e1rm(w,r);
    if(!hist[id]||est>hist[id].est)keep[id]={w,r,est,date:p.date||null};
  });
  s.prsManual=Object.assign({},keep,isObj(s.prsManual)?s.prsManual:{});
  // Sessions left running for hours were logged at full duration; cap the calorie estimate.
  s.workouts.forEach(w=>{
    if(w.ended&&w.ended-w.started>MAX_SESSION_MS&&w.cals){
      const kg=(s.unit==='kg'?parseFloat(s.bodyweight):parseFloat(s.bodyweight)/LB_PER_KG)||84;
      w.cals=Math.round(LIFT_MET*kg*(MAX_SESSION_MS/3600000));w.calsCapped=true;
    }
  });
  // The old app showed ONLY the meals on a day that had both meals and a Quick Log. Days logged that
  // way keep the totals they have always shown: their Quick Log is parked, not added on top.
  // (Opening Quick Log for such a day shows the parked numbers and counts them if saved.)
  const mealDays=new Set(s.meals.filter(m=>parseFloat(m.protein)||parseFloat(m.carbs)||parseFloat(m.fat)||parseFloat(m.cals)).map(m=>m.date));
  Object.keys(s.macroLogs).forEach(d=>{const ml=s.macroLogs[d];if(isObj(ml)&&mealDays.has(d))ml.parked=true;});
  // Barcode cache: foods entered by hand were stored with the per-serving numbers repeated as
  // "per 100 g", and products listed only in kJ were cached as 0 kcal. Repair the first, refetch the second.
  Object.keys(s.foodCache).forEach(k=>{
    const p=s.foodCache[k];
    if(!isObj(p)||!isObj(p.per100)||!isObj(p.perServing)){delete s.foodCache[k];return;}
    const same=['protein','carbs','fat','cals'].every(f=>p.per100[f]===p.perServing[f]);
    if(same&&!(p.servingG>0)){p.per100={protein:0,carbs:0,fat:0,cals:0};p.manual=true;}
    const noKcal=b=>!b.cals&&(b.protein||b.carbs||b.fat);
    if(noKcal(p.per100)||noKcal(p.perServing))delete s.foodCache[k];
  });
  // Barcode-derived food ids could contain anything typed into the manual box.
  const clean=id=>String(id).replace(/[^0-9A-Za-z_\-]/g,'');
  const remap={};
  s.customFoods.forEach(f=>{const c=clean(f.id);if(c!==f.id){remap[f.id]=c;f.id=c;}});
  if(Object.keys(remap).length){
    const fix=id=>remap[id]||id;
    s.stars.forEach(st=>{if(st.k==='food')st.ref=fix(st.ref);});s.recentFoods=s.recentFoods.map(fix);
    Object.keys(s.barcodeLinks).forEach(b=>{s.barcodeLinks[b]=fix(s.barcodeLinks[b]);});
    s.meals.forEach(m=>(m.items||[]).forEach(it=>{it.foodId=fix(it.foodId);}));
    s.savedMeals.forEach(c=>c.items.forEach(it=>{it.foodId=fix(it.foodId);}));
  }
}

// v4: programs become a saved list (the one program becomes the first, keeping its place by the
// workouts already done in it), Shoulders splits into front, side and rear delts, and custom
// exercises that now exist in the catalog are folded into the built-in ones with all their history.
function migrateToV4(s){
  const p=s.program;
  if(isObj(p)&&Array.isArray(p.phases)&&p.phases.length){
    const phases=p.phases.filter(ph=>isObj(ph)&&s.groups.some(g=>g.id===ph.groupId)).map(ph=>{
      let weeks=parseInt(ph.weeks)||1;
      if(ph.mode==='until'&&ph.untilDate)weeks=1; // an "until" phase has no length of its own; it is set from the dates below
      return{groupId:ph.groupId,weeks:Math.min(52,Math.max(1,weeks)),deload:false,_until:ph.mode==='until'?ph.untilDate:''};
    });
    // "Until a date" phases get the number of weeks they covered.
    let cur=p.startDate||dstr(new Date());
    phases.forEach(ph=>{
      if(ph._until){const d=Math.max(1,daysBetween(cur,addDays(ph._until,1)));ph.weeks=Math.min(52,Math.max(1,Math.ceil(d/7)));}
      cur=addDays(cur,ph.weeks*7);delete ph._until;
    });
    if(phases.length){
      const id=uid();const start=p.startDate?dayDate(p.startDate).getTime():Date.now();
      const gids=new Set(phases.map(ph=>ph.groupId));
      const rids=new Set();s.groups.filter(g=>gids.has(g.id)).forEach(g=>(g.routineIds||[]).forEach(r=>rids.add(r)));
      s.workouts.forEach(w=>{if(w.routineId&&rids.has(w.routineId)&&p.startDate&&dayOf(w.started)>=p.startDate)w.prog={id};});
      s.programs=[{id,name:p.name||'Program',notes:'',phases,status:p.active===false?'paused':'running',createdAt:start,startedAt:start}];
    }
  }
  // Shoulders → the head a custom exercise most likely works, from its name. Listed once to confirm.
  const review=[];
  s.custom.forEach(c=>{
    const was=String(c.muscle||'').trim().toLowerCase();
    if(['shoulders','shoulder','delts','deltoids','deltoid'].includes(was)){c.muscle=shoulderHead(c.name);review.push(c.id);}
    if(Array.isArray(c.sec))c.sec=[...new Set(c.sec.map(m=>{const k=String(m||'').trim().toLowerCase();return['shoulders','shoulder','delts','deltoids'].includes(k)?'Front Delts':m;}))].filter(m=>m!==c.muscle);
  });
  if(review.length)s.shoulderReview=review;
  // A custom exercise with the same name as one the catalog now has becomes that one.
  const byKey=new Map();EXERCISES.forEach(e=>byKey.set(exNameKey(e.name),e.id));
  s.custom.slice().forEach(c=>{
    const to=byKey.get(exNameKey(c.name));
    if(to&&!s.custom.some(x=>x.id===to))remapExerciseId(s,c.id,to);
  });
}
// Which part of the shoulder an exercise's name points at. Presses and anything unclear → front.
function shoulderHead(name){
  const n=String(name||'').toLowerCase();
  if(/rear|reverse (pec|fly|flye)|face ?pull|posterior|bent[- ]over (lateral|raise)/.test(n))return'Rear Delts';
  if(/lateral|side raise|side delt|upright row|\by[- ]raise|lu raise/.test(n))return'Side Delts';
  return'Front Delts';
}
// Every reference to one exercise becomes another (folding a custom exercise into the catalog).
function remapExerciseId(s,from,to){
  if(from===to)return;
  const fixEx=e=>{if(e&&e.exId===from)e.exId=to;if(e&&e._swappedFrom===from)e._swappedFrom=to;};
  s.workouts.forEach(w=>(w.exercises||[]).forEach(fixEx));
  if(isObj(s.activeWorkout))(s.activeWorkout.exercises||[]).forEach(fixEx);
  s.routines.forEach(r=>(r.exercises||[]).forEach(fixEx));
  const move=(obj)=>{if(isObj(obj)&&obj[from]!==undefined){if(obj[to]===undefined)obj[to]=obj[from];delete obj[from];}};
  move(s.exRest);move(s.prsManual);move(s.swapLog);
  if(isObj(s.swapLog))Object.values(s.swapLog).forEach(row=>{if(isObj(row))move(row);});
  if(isObj(s.nextTargets))Object.values(s.nextTargets).forEach(t=>{if(isObj(t)&&isObj(t.items))move(t.items);});
  if(isObj(s.board)&&Array.isArray(s.board.tiles))s.board.tiles.forEach(t=>{if(Array.isArray(t.ids))t.ids=t.ids.map(x=>x===from?to:x);});
  s.custom=s.custom.filter(c=>c.id!==from);
}
function normalizePrograms(v,groups){
  const ST=['running','paused','saved','finished','archived'];
  let running=false;
  return(Array.isArray(v)?v:[]).filter(p=>isObj(p)&&p.id).slice(0,60).map(p=>{
    const o={id:String(p.id).slice(0,40),name:String(p.name==null?'Program':p.name).replace(/\s+/g,' ').trim().slice(0,60)||'Program',
      notes:String(p.notes||'').slice(0,600),
      phases:(Array.isArray(p.phases)?p.phases:[]).filter(ph=>isObj(ph)&&groups.some(g=>g.id===ph.groupId)).slice(0,24)
        .map(ph=>({groupId:ph.groupId,weeks:Math.min(52,Math.max(1,parseInt(ph.weeks)||1)),deload:!!ph.deload})),
      status:ST.includes(p.status)?p.status:'saved',
      createdAt:Number(p.createdAt)||Date.now()};
    ['startedAt','pausedAt','finishedAt'].forEach(k=>{if(Number(p[k])>0)o[k]=Number(p[k]);});
    if(isObj(p.report))o.report=p.report;
    if(p.reportNew)o.reportNew=true;
    if(p.hidden)o.hidden=true;
    if(o.status==='running'){if(running||!o.phases.length)o.status='paused';else running=true;}
    return o;
  });
}
function normalizePhotos(v){
  const POSES=['front','side','back','side2','other'];
  return(Array.isArray(v)?v:[]).filter(p=>isObj(p)&&typeof p.id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date||'')).slice(0,2000)
    .map(p=>{const o={id:p.id.slice(0,40),date:p.date,pose:POSES.includes(p.pose)?p.pose:'front'};const w=parseFloat(p.weight);if(w>0)o.weight=w;if(p.note)o.note=String(p.note).slice(0,120);return o;})
    .sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
}
function normalizeExMuscle(v){
  const out={};if(!isObj(v))return out;
  Object.keys(v).slice(0,400).forEach(id=>{
    const o=v[id];if(!isObj(o)||!BUILTIN_EX_IDS.has(id))return;
    const m=normMuscle(o.muscle);if(!MEV_MAV[m])return;
    out[id]={muscle:m,sec:[...new Set((Array.isArray(o.sec)?o.sec:[]).map(normMuscle))].filter(x=>MEV_MAV[x]&&x!==m)};
  });
  return out;
}

// ─── Persistence ───
// Two copies are kept: localStorage (written synchronously, so it survives the app being closed
// mid-tap) and IndexedDB (far larger quota). On load the newer copy wins. A failed write is shown
// to the user instead of being swallowed.
const Store={
  ready:false,dirty:false,timer:null,db:null,lsOk:true,idbOk:true,corrupt:null,failing:false,
  openDb(){
    return new Promise(res=>{
      try{
        if(typeof indexedDB==='undefined'||!indexedDB)return res(null);
        const rq=indexedDB.open('lahwe',1);
        rq.onupgradeneeded=()=>{try{rq.result.createObjectStore('kv');}catch(e){}};
        rq.onsuccess=()=>res(rq.result);
        rq.onerror=()=>res(null);rq.onblocked=()=>res(null);
      }catch(e){res(null);}
    });
  },
  idbGet(key){
    return new Promise(res=>{
      if(!this.db)return res(null);
      try{const rq=this.db.transaction('kv','readonly').objectStore('kv').get(key);
        rq.onsuccess=()=>res(rq.result==null?null:rq.result);rq.onerror=()=>res(null);
      }catch(e){res(null);}
    });
  },
  idbSet(key,val){
    return new Promise(res=>{
      if(!this.db)return res(false);
      try{const tx=this.db.transaction('kv','readwrite');tx.objectStore('kv').put(val,key);
        tx.oncomplete=()=>res(true);tx.onerror=()=>res(false);tx.onabort=()=>res(false);
      }catch(e){res(false);}
    });
  },
  idbDel(keys){
    return new Promise(res=>{
      if(!this.db)return res(false);
      try{const tx=this.db.transaction('kv','readwrite');const st=tx.objectStore('kv');keys.forEach(k=>st.delete(k));
        tx.oncomplete=()=>res(true);tx.onerror=()=>res(false);tx.onabort=()=>res(false);
      }catch(e){res(false);}
    });
  },
  // Every entry whose key starts with the prefix, as [{key,val}] (routes are kept this way).
  idbAll(prefix){
    return new Promise(res=>{
      if(!this.db)return res([]);
      try{
        const out=[];const range=IDBKeyRange.bound(prefix,prefix+'￿');
        const rq=this.db.transaction('kv','readonly').objectStore('kv').openCursor(range);
        rq.onsuccess=()=>{const c=rq.result;if(!c)return res(out);out.push({key:c.key,val:c.value});c.continue();};
        rq.onerror=()=>res(out);
      }catch(e){res([]);}
    });
  },
  lsGet(key){try{return localStorage.getItem(key);}catch(e){return null;}},
  lsSet(key,val){try{localStorage.setItem(key,val);return true;}catch(e){return false;}},
  lsDel(key){try{localStorage.removeItem(key);}catch(e){}},
  parse(txt){if(!txt||typeof txt!=='string')return null;try{const o=JSON.parse(txt);return isObj(o)?o:null;}catch(e){return null;}},
  async load(){
    this.db=await this.openDb();
    let lsTxt=this.lsGet(STORE_KEY);
    if(!lsTxt)for(const k of LEGACY_KEYS){lsTxt=this.lsGet(k);if(lsTxt)break;}
    const idbTxt=await this.idbGet(STORE_KEY);
    const a=this.parse(lsTxt),b=this.parse(idbTxt);
    const raw=(a&&b)?(((b._savedAt||0)>(a._savedAt||0))?b:a):(a||b);
    if(!raw&&(lsTxt||idbTxt)){
      // Something is stored but unreadable. Keep it and refuse to save over it.
      this.corrupt=String(lsTxt||idbTxt);S=defaultState();this.ready=false;
      return{hadData:false,corrupt:true};
    }
    S=normalizeState(raw);
    this.ready=true;
    return{hadData:!!raw,corrupt:false};
  },
  schedule(){
    this.dirty=true;
    if(!this.ready||this.timer)return;
    this.timer=setTimeout(()=>{this.timer=null;this.flush();},250);
  },
  // Writes only when something changed since the last write, unless forced.
  flush(force){
    if(this.timer){clearTimeout(this.timer);this.timer=null;}
    if(!this.ready)return false;
    if(!this.dirty&&!force)return true;
    this.dirty=false;
    S._savedAt=Date.now();S._schema=SCHEMA;
    let json;
    try{json=JSON.stringify(S);}catch(e){this.dirty=true;this.setFailing(true);return false;}
    this.lsOk=this.lsSet(STORE_KEY,json);
    if(this.db){
      this.idbSet(STORE_KEY,json).then(ok=>{this.idbOk=ok;this.setFailing(!ok&&!this.lsOk);});
    }else{this.idbOk=false;this.setFailing(!this.lsOk);}
    return this.lsOk||!!this.db;
  },
  setFailing(f){
    if(f===this.failing)return;
    this.failing=f;
    if(typeof showSaveWarning==='function')showSaveWarning(f);
  },
};
// Queue a save. Writes are coalesced so checking five sets in a row serialises the state once.
function save(){bumpMemo();Store.schedule();}
// Write immediately — for moments that must not be lost (finishing a workout, restoring a backup).
function saveNow(){bumpMemo();return Store.flush(true);}
// Everything derived from S that lives outside it. Call after S is replaced wholesale.
function afterStateLoaded(){
  bumpMemo();_exIdx=null;
  Object.keys(SEC_MUSCLE).forEach(k=>{if(!BUILTIN_EX_IDS.has(k))delete SEC_MUSCLE[k];});
  (S.custom||[]).forEach(ex=>{if(Array.isArray(ex.sec)&&ex.sec.length)SEC_MUSCLE[ex.id]=ex.sec;});
  resolveProgramGroup();
  rebuildPRs();
  applyDark();applyTheme();
}
// Replace the whole state (restore, reset). Goes through the same normalising path as a normal load.
function replaceState(raw){
  S=normalizeState(raw);
  Store.ready=true;Store.corrupt=null;
  afterStateLoaded();
  return saveNow();
}
