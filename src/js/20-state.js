// ═══════════════════════════════════════════════════
// STATE + STORAGE
// ═══════════════════════════════════════════════════
const APP_VERSION='__APP_VERSION__';
const STORE_KEY='lahwe_v2';             // unchanged, so existing installs keep their data
const LEGACY_KEYS=['lahwe_v1','ironlog_v5'];
const UNDO_KEY='lahwe_v2_undo';         // snapshot taken just before a backup is restored
const API_KEY_KEY='lahwe_api_key';      // kept outside S on purpose: it must never land in an exported backup
const SCHEMA=3;
let S={};let _charts={};

// Every field the app reads. normalizeState() guarantees all of them exist, so nothing
// downstream needs its own "if missing" patching.
function defaultState(){
  const now=new Date();
  return{
    _schema:SCHEMA,_savedAt:0,
    tab:'workout',libTab:'exercises',histTab:'list',
    unit:'lbs',restDur:90,bodyweight:185,name:'',exRest:{},
    aftAge:'22-26',aftGender:'male',aftStandard:'general',
    aftCurrent:{MDL:'',HRP:'',SDC:'',PLK:'','2MR':''},
    aftGoals:{MDL:'',HRP:'',SDC:'',PLK:'','2MR':''},
    aftHistory:[],activeWorkout:null,workouts:[],routines:[],groups:[],program:null,
    supps:[],suppLogs:{},prs:{},prsManual:{},custom:[],
    activities:[],stepsLog:{},exFilter:'All',exSearch:'',
    calYear:now.getFullYear(),calMonth:now.getMonth(),
    onboarded:false,goal:'general',darkMode:false,primaryColor:'navy',
    expandedCards:{},measurements:[],bodyweightLog:[],
    measureUnit:'in',progExId:null,height:69,progSeeded:{},measPart:null,birthMonth:null,birthYear:null,
    macroGoals:{protein:150,carbs:200,fat:60,cals:2000},
    macroLogs:{},weightGoal:null,weightGoalDir:null,
    schedule:{type:'weekly',weeklyDays:[1,2,4,5],cycleOn:2,cycleOff:1,cycleStart:dstr(now),overrides:{},routineOverrides:{}},
    equipPreset:'full',
    meals:[],foodCache:{},customFoods:[],savedMeals:[],starredFoods:[],recentFoods:[],recentSavedMeals:[],
    activeCardDeck:null,activeSprintTimer:null,
    restTimer:null,restSound:true,keepAwake:true,
    lastExportAt:0,aiModel:'claude-sonnet-5-5',
  };
}
function initState(){S=defaultState();}
function isObj(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}

// Turns anything (an old save, an imported backup, nothing at all) into a complete, well-typed state.
// This is the only place stored data is trusted to become S.
function normalizeState(raw){
  const d=defaultState();
  const s=isObj(raw)?raw:{};
  // Saves written before schema versions existed carry no marker; treat them as v2.
  const from=isObj(raw)?(parseInt(raw._schema)||2):SCHEMA;
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
    w.started=Number(w.started)||Date.now();
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
  if(s.program&&!(isObj(s.program)&&Array.isArray(s.program.phases)))s.program=null;
  s.custom=s.custom.filter(e=>isObj(e)&&e.id&&e.name);
  s.activities=s.activities.filter(a=>isObj(a)&&a.date);
  s.meals=s.meals.filter(m=>isObj(m)&&m.date);
  s.supps=s.supps.filter(x=>isObj(x)&&x.id);
  s.measurements=s.measurements.filter(m=>isObj(m)&&m.date&&isObj(m.values));
  s.bodyweightLog=s.bodyweightLog.filter(b=>isObj(b)&&b.date&&parseFloat(b.weight)>0).map(b=>{b.weight=parseFloat(b.weight);return b;});
  s.savedMeals=s.savedMeals.filter(c=>isObj(c)&&Array.isArray(c.items));
  s.customFoods=s.customFoods.filter(f=>isObj(f)&&f.id);
  if(!THEMES.some(t=>t.id===s.primaryColor))s.primaryColor='navy';
  if(!GOALS.some(g=>g.id===s.goal))s.goal='general';
  if(!AI_MODELS.some(m=>m.id===s.aiModel))s.aiModel=d.aiModel;
  if(!EQUIPMENT_PRESETS.some(p=>p.id===s.equipPreset))s.equipPreset='full';
  if(!(parseInt(s.restDur)>0))s.restDur=90;
  if(!['workout','history','progress','nutrition','library'].includes(s.tab))s.tab='workout';

  if(from<3)migrateToV3(s);
  s._schema=SCHEMA;
  return s;
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
  // Barcode-derived food ids could contain anything typed into the manual box.
  const clean=id=>String(id).replace(/[^0-9A-Za-z_\-]/g,'');
  const remap={};
  s.customFoods.forEach(f=>{const c=clean(f.id);if(c!==f.id){remap[f.id]=c;f.id=c;}});
  if(Object.keys(remap).length){
    const fix=id=>remap[id]||id;
    s.starredFoods=s.starredFoods.map(fix);s.recentFoods=s.recentFoods.map(fix);
    s.meals.forEach(m=>(m.items||[]).forEach(it=>{it.foodId=fix(it.foodId);}));
    s.savedMeals.forEach(c=>c.items.forEach(it=>{it.foodId=fix(it.foodId);}));
  }
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
