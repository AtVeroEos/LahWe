// ═══════════════════════════════════════════════════
// IMPORT FROM ANOTHER APP — lifting history, rebuilt routines and body measurements
// ═══════════════════════════════════════════════════
// Strong, Hevy, JEFIT, Fitbod, Alpha Progression and StrongLifts each export a CSV. The file is read
// on the phone; nothing is uploaded. The flow is: pick the app → what will, won't and gets translated →
// choose the file → answer the questions this file raises → confirm (counts and real sample rows) →
// import → results. There is no Undo Import (a decision): today's daily copy is taken before anything
// is written, and Settings → Your data → Imported data can remove what one app brought in.
//
// Reading is in three layers, all pure (nothing touches S until ixCommit):
//   1. ixReadText(): one file's text → {app, kind, sessions, weights, measures, notes, unitKnown}
//   2. ixPlan():     the parsed files + the answers → what would be added, skipped and rebuilt
//   3. ixCommit():   writes the plan, tags everything with src, rebuilds PRs, saves once.
// The formats come from each app's own help pages and from importers that read them; no real export
// files were on hand when this was written, so each reader is forgiving about column order and names.

const IX_APPS=[
  {id:'strong',name:'Strong',mono:'St',
    steps:['Open Strong → <b>Profile</b> → the gear → <b>Export Workouts</b> (turn on notes if it asks).','For weigh-ins and tape measurements, also tap <b>Export Measurements</b> just below it.','Save the files to Files, then choose them here. You can choose both at once.'],
    comes:'Every set: weight, reps, timed and distance sets, warm-ups, notes and RPE. Weigh-ins and tape measurements from the separate measurements file.',
    trans:'Exercise names to ours (“Bench Press (Barbell)” → Barbell Bench Press). RPE to reps in reserve. Drop sets come in as working sets.',
    wont:'Your saved templates (Strong does not export them; we can rebuild them from your history). Supersets, rest times, photos. Older Strong files do not say kg or lb, so we ask.',
    lang:'If the file will not read, set Strong to English and export again: its column names follow the app language.'},
  {id:'hevy',name:'Hevy',mono:'Hv',
    steps:['Open Hevy → <b>Profile</b> → the gear → <b>Export & Import Data</b> → <b>Export Data</b>.','Tap <b>Export Workouts</b>, and <b>Export Measurements</b> for weigh-ins.','Save the files to Files, then choose them here.'],
    comes:'Every set with its type (warm-up, drop, failure), weight, reps, time, distance and RPE. Supersets. Exercise and workout notes. Weigh-ins and measurements from the measurements file.',
    trans:'Exercise names to ours. RPE to reps in reserve. Drop sets come in as working sets.',
    wont:'Your saved routines (Hevy only exports workouts you did; we can rebuild them). Rest times, photos.',
    lang:'If the file will not read, set Hevy to English and export again.'},
  {id:'jefit',name:'JEFIT',mono:'Jf',
    steps:['JEFIT exports from its <b>website</b>, not the app: sign in at <b>jefit.com</b> in a browser.','<b>My Jefit</b> → <b>Settings</b> → <b>Data Controls</b> → <b>Export Data</b>.','Get the downloaded .csv to your phone (Files, iCloud Drive or email) and choose it here.'],
    comes:'Every session with each set’s weight and reps, the workout’s length and its name (the routine day you trained). Those routine days, with their planned sets, reps, rest and supersets.',
    trans:'Exercise names to ours. Weights are read in the unit set in JEFIT (we ask if the file does not say).',
    wont:'Routines you never trained, logged cardio, notes, personal records, photos, social posts. The profile and account details in the file are not read.',
    lang:'Do not open the file in Excel or Numbers first: saving it there breaks its sections. If that happened, download it again.'},
  {id:'fitbod',name:'Fitbod',mono:'Fb',
    steps:['Open Fitbod → the <b>Log</b> tab → the gear.','Tap <b>Export Workout Data</b> and save the file to Files.','Choose it here.'],
    comes:'Every set: weight, reps, warm-ups, timed and distance sets, notes, with the time each workout started.',
    trans:'Exercise names to ours.',
    wont:'Workout names (Fitbod’s file has none, so routines cannot be rebuilt), measurements, Fitbod’s recovery scores.'},
  {id:'alpha',name:'Alpha Progression',mono:'AP',
    steps:['Open Alpha Progression → your profile → settings → <b>data export</b>.','Download the .csv (or have it emailed) and save it to Files.','Choose it here.'],
    comes:'Logged sets: weight, reps and reps in reserve, with dates.',
    trans:'Exercise names to ours.',
    wont:'Plans for now: their layout in the file is not known yet, so they are left out rather than guessed. Rest times, photos.',
    beta:true},
  {id:'stronglifts',name:'StrongLifts',mono:'SL',
    steps:['Open StrongLifts → <b>Settings</b> → <b>Export</b>.','Save the .csv to Files and choose it here.'],
    comes:'Workout dates, exercises, sets, reps, weight and notes.',
    trans:'Exercise names to ours. The 5×5 A and B workouts can be set up as routines.',
    wont:'Rest times, warm-up sets, the app’s progression settings.',
    beta:true},
];
function ixApp(id){return IX_APPS.find(a=>a.id===id)||null;}
function ixAppName(id){if(id==='strava')return'Strava';const a=ixApp(id);return a?a.name:String(id||'another app');}

// ─── Reading text ───
// CSV with the delimiter found from the header line (Strong 6 writes semicolons), quotes, doubled
// quotes and line breaks inside quotes.
function ixDelim(text){
  const line=(String(text).split(/\r?\n/).find(l=>l.trim())||'');
  let q=false;const n={',':0,';':0,'\t':0};
  for(const c of line){if(c==='"')q=!q;else if(!q&&n[c]!==undefined)n[c]++;}
  return n[';']>n[',']&&n[';']>=n['\t']?';':n['\t']>n[',']?'\t':',';
}
function ixCsv(text,delim){
  text=String(text||'').replace(/^﻿/,'');delim=delim||ixDelim(text);
  const rows=[];let row=[],f='',q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
    else if(c==='"')q=true;
    else if(c===delim){row.push(f);f='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(f);f='';if(row.length>1||row[0].trim()!=='')rows.push(row);row=[];}
    else f+=c;
  }
  if(f!==''||row.length){row.push(f);if(row.length>1||row[0].trim()!=='')rows.push(row);}
  return rows;
}
const ixH=h=>String(h==null?'':h).replace(/^﻿/,'').trim().toLowerCase();
// The first column whose header matches one of the patterns, or -1.
function ixCol(hdr,...res){for(const re of res){const i=hdr.findIndex(h=>re.test(h));if(i>=0)return i;}return -1;}
const ixNum=v=>{if(v==null)return null;const s=String(v).trim().replace(/\s/g,'');if(!s)return null;const n=parseFloat(s.indexOf(',')>=0&&s.indexOf('.')<0?s.replace(',','.'):s);return isFinite(n)?n:null;};

// ─── Dates ───
// Returns {t, noTime} or null. Local time unless the text carries an offset.
const IX_MON={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
function ixDate(v){
  if(v==null)return null;const s=String(v).trim();if(!s)return null;
  if(/^\d{9,13}(\.\d+)?$/.test(s)){const n=parseFloat(s);const t=n<1e11?n*1000:n;return t>0?{t,noTime:false}:null;}
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i);
  if(m){
    const y=+m[1],mo=+m[2]-1,d=+m[3];if(mo<0||mo>11||d<1||d>31)return null;
    if(m[4]==null)return{t:new Date(y,mo,d,12,0,0).getTime(),noTime:true};
    const hh=+m[4],mi=+m[5],ss=+(m[6]||0);
    if(m[7]){const off=m[7].toUpperCase()==='Z'?0:(m[7][0]==='-'?-1:1)*(+m[7].slice(1,3)*60+ +m[7].replace(':','').slice(3,5));return{t:Date.UTC(y,mo,d,hh,mi,ss)-off*60000,noTime:false};}
    return{t:new Date(y,mo,d,hh,mi,ss).getTime(),noTime:false};
  }
  // 30 Jun 2025, 19:56 (Hevy) · Jun 30, 2025, 7:56 PM · 30 June 2025
  const ampm=(h,ap)=>{if(!ap)return h;ap=ap.toLowerCase();return ap==='pm'?(h%12)+12:h%12;};
  m=s.match(/^(\d{1,2})\s+([a-z]{3,9})\.?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i);
  if(m){const mo=IX_MON[m[2].toLowerCase().slice(0,m[2].toLowerCase().startsWith('sept')?4:3)];if(mo==null)return null;
    if(m[4]==null)return{t:new Date(+m[3],mo,+m[1],12).getTime(),noTime:true};
    return{t:new Date(+m[3],mo,+m[1],ampm(+m[4],m[7]),+m[5],+(m[6]||0)).getTime(),noTime:false};}
  m=s.match(/^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i);
  if(m){const mo=IX_MON[m[1].toLowerCase().slice(0,m[1].toLowerCase().startsWith('sept')?4:3)];if(mo==null)return null;
    if(m[4]==null)return{t:new Date(+m[3],mo,+m[2],12).getTime(),noTime:true};
    return{t:new Date(+m[3],mo,+m[2],ampm(+m[4],m[7]),+m[5],+(m[6]||0)).getTime(),noTime:false};}
  // 03/14/2025 18:20 — month first, unless the first number cannot be a month.
  m=s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i);
  if(m){let a=+m[1],b=+m[2],y=+m[3];if(y<100)y+=2000;let mo=a-1,d=b;if(a>12&&b<=12){mo=b-1;d=a;}if(mo<0||mo>11||d<1||d>31)return null;
    if(m[4]==null)return{t:new Date(y,mo,d,12).getTime(),noTime:true};
    return{t:new Date(y,mo,d,ampm(+m[4],m[7]),+m[5],+(m[6]||0)).getTime(),noTime:false};}
  return null;
}
// Seconds from "4520", "1h 15m", "45m", "2h", "1:15:20", "75:20".
function ixDur(v){
  if(v==null)return null;const s=String(v).trim().toLowerCase();if(!s)return null;
  if(/^\d+(\.\d+)?$/.test(s))return parseFloat(s);
  let m=s.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?\s*(?:(\d+)\s*s)?$/);
  if(m&&(m[1]||m[2]||m[3]))return(+(m[1]||0))*3600+(+(m[2]||0))*60+(+(m[3]||0));
  m=s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if(m)return m[3]!=null?(+m[1])*3600+(+m[2])*60+(+m[3]):(+m[1])*60+(+m[2]);
  return null;
}
const ixUnitOf=h=>/\(kgs?\)|_kgs?$|\bkgs?\b/i.test(h)?'kg':/\(lbs?\)|_lbs?$|\blbs?\b|pounds?/i.test(h)?'lb':null;
const ixDistUnitOf=h=>/miles?|\(mi\)|_mi$/i.test(h)?'mi':/\(km\)|_km$|kilomet/i.test(h)?'km':/meters?|metres?|\(m\)|_m$/i.test(h)?'m':null;

// ─── Exercise names ───
// Names these apps use for things the catalog has under another name (read after the brackets are split off).
const IX_ALIAS={'running':'easy-run','run':'easy-run','jogging':'easy-run','outdoor run':'easy-run','treadmill running':'easy-run','running treadmill':'easy-run','treadmill run':'easy-run',
  'rowing':'rower','indoor rowing':'rower','rowing machine':'rower','stationary bike':'bike-erg','cycling indoor':'bike-erg','indoor cycling':'bike-erg','spin bike':'bike-erg',
  'skipping':'jump-rope','jump rope':'jump-rope','rucking':'ruck'};
// Strong and Hevy write the equipment in brackets: "Bench Press (Barbell)", "Pull Up (Assisted)",
// "Triceps Pushdown (Cable - Straight Bar)". Equipment becomes a hint; anything else stays in the name.
function ixSplitName(raw){
  const s=String(raw||'').replace(/\s+/g,' ').trim();
  const m=s.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if(!m)return{name:s,eq:''};
  const inner=m[2].trim();
  const first=inner.split(/\s*[-,/]\s*/)[0];
  const eq=normEquipment(inner)||normEquipment(first);
  if(eq)return{name:m[1].trim(),eq};
  return{name:`${inner} ${m[1].trim()}`.trim(),eq:''};
}

// ─── Each app's reader ───
// A session: {name, t, end, noTime, notes, ex:[{name, note, link, sets:[{w,u,r,sec,m,du,warm,drop,fail,rpe,rir}]}]}
// w is in the file's own unit u ('kg' | 'lb' | null = not said), m is a distance in the file's unit du.
function ixNewSet(){return{w:null,u:null,r:null,sec:null,m:null,du:null,warm:false,drop:false,fail:false,rpe:null,rir:null};}
function ixPushSet(sess,exName,set,opts){
  opts=opts||{};
  let ex=sess.ex[sess.ex.length-1];
  if(!ex||ex.name!==exName||opts.split){ex={name:exName,note:'',link:null,sets:[]};sess.ex.push(ex);}
  if(opts.note&&!ex.note)ex.note=String(opts.note).slice(0,200);
  if(opts.link&&!ex.link)ex.link=opts.link;
  ex.sets.push(set);
}
function ixResult(app,kind){return{app,kind,sessions:[],weights:[],measures:[],notes:[],unitKnown:true,bad:0};}

function ixReadStrong(rows){
  const h=rows[0].map(ixH);const R=ixResult('strong','workouts');
  const c={num:ixCol(h,/^workout #$/),date:ixCol(h,/^date$/),wn:ixCol(h,/^workout name$/),dur:ixCol(h,/^(workout )?duration/),ex:ixCol(h,/^exercise name$/),
    ord:ixCol(h,/^set order$/),w:ixCol(h,/^weight( \((kgs?|lbs?)\))?$/),wu:ixCol(h,/^weight unit$/),r:ixCol(h,/^reps$/),rpe:ixCol(h,/^rpe$/),
    d:ixCol(h,/^distance( \(.*\))?$/),du:ixCol(h,/^distance unit$/),sec:ixCol(h,/^seconds$/),n:ixCol(h,/^notes$/),wkn:ixCol(h,/^workout notes$/)};
  const hu=c.w>=0?ixUnitOf(h[c.w]):null;const hdu=c.d>=0?ixDistUnitOf(h[c.d]):null;
  R.unitKnown=!!hu||c.wu>=0;
  const by=new Map();
  for(let i=1;i<rows.length;i++){
    const row=rows[i];const g=k=>c[k]>=0?String(row[c[k]]==null?'':row[c[k]]).trim():'';
    const ord=g('ord');
    if(!/^(\d+|w|d|f)$/i.test(ord))continue; // rest-timer and note rows
    const dt=ixDate(g('date'));const name=g('ex');
    if(!dt||!name){R.bad++;continue;}
    const key=c.num>=0&&g('num')?'#'+g('num'):g('date')+'|'+g('wn');
    let s=by.get(key);
    if(!s){s={name:g('wn')||'Workout',t:dt.t,noTime:dt.noTime,end:null,notes:'',ex:[]};const d=ixDur(g('dur'));if(d>0)s.end=s.t+d*1000;by.set(key,s);R.sessions.push(s);}
    if(!s.notes&&g('wkn'))s.notes=g('wkn'); // the workout's notes repeat on its rows, sometimes only on some
    const set=ixNewSet();
    set.w=ixNum(g('w'));set.u=hu||(c.wu>=0?ixUnitOf(g('wu')):null);
    set.r=ixNum(g('r'));set.sec=ixNum(g('sec'));set.m=ixNum(g('d'));set.du=hdu||(c.du>=0?ixDistUnitOf(g('du')):null);
    const o=ord.toLowerCase();set.warm=o==='w';set.drop=o==='d';set.fail=o==='f';
    set.rpe=ixNum(g('rpe'));
    ixPushSet(s,name,set,{note:g('n')});
  }
  return R;
}
function ixReadHevy(rows){
  const h=rows[0].map(ixH);const R=ixResult('hevy','workouts');
  const c={title:ixCol(h,/^title$/),st:ixCol(h,/^start_time$/),en:ixCol(h,/^end_time$/),desc:ixCol(h,/^description$/),ex:ixCol(h,/^exercise_title$/),
    ss:ixCol(h,/^superset_id$/),en2:ixCol(h,/^exercise_notes$/),idx:ixCol(h,/^set_index$/),type:ixCol(h,/^set_type$/),
    w:ixCol(h,/^weight_(kg|lbs?)$/),r:ixCol(h,/^reps$/),d:ixCol(h,/^distance_(km|miles?|m)$/),sec:ixCol(h,/^duration_seconds$/),rpe:ixCol(h,/^rpe$/)};
  const hu=c.w>=0?ixUnitOf(h[c.w]):null;const hdu=c.d>=0?(/km/.test(h[c.d])?'km':/mile/.test(h[c.d])?'mi':'m'):null;
  const by=new Map();const last={};
  for(let i=1;i<rows.length;i++){
    const row=rows[i];const g=k=>c[k]>=0?String(row[c[k]]==null?'':row[c[k]]).trim():'';
    const dt=ixDate(g('st'));const name=g('ex');
    if(!dt||!name){R.bad++;continue;}
    const key=g('st')+'|'+g('title');
    let s=by.get(key);
    if(!s){s={name:g('title')||'Workout',t:dt.t,noTime:dt.noTime,end:null,notes:'',ex:[],_ss:{}};const e=ixDate(g('en'));if(e&&e.t>dt.t)s.end=e.t;by.set(key,s);R.sessions.push(s);}
    if(!s.notes&&g('desc'))s.notes=g('desc');
    const set=ixNewSet();
    set.w=ixNum(g('w'));set.u=hu;set.r=ixNum(g('r'));set.sec=ixNum(g('sec'));set.m=ixNum(g('d'));set.du=hdu;set.rpe=ixNum(g('rpe'));
    const t=g('type').toLowerCase();set.warm=t==='warmup';set.drop=t==='dropset';set.fail=t==='failure';
    // A new exercise starts when the name changes or the set numbers start again.
    const idx=ixNum(g('idx'));const lk=last[key];
    const split=!!(lk&&lk.name===name&&idx!=null&&lk.idx!=null&&idx<=lk.idx);
    last[key]={name,idx};
    let link=null;const sid=g('ss');
    if(sid!==''){if(!s._ss[sid])s._ss[sid]=String.fromCharCode(65+Object.keys(s._ss).length%26);link=s._ss[sid];}
    ixPushSet(s,name,set,{split,note:g('en2'),link});
  }
  R.sessions.forEach(s=>delete s._ss);
  return R;
}
function ixReadFitbod(rows){
  const h=rows[0].map(ixH);const R=ixResult('fitbod','workouts');
  let c={date:ixCol(h,/^date$/),ex:ixCol(h,/^exercise( name)?$/),r:ixCol(h,/^reps$/),w:ixCol(h,/^weight/),sec:ixCol(h,/^duration/),d:ixCol(h,/^distance/),warm:ixCol(h,/^is ?warm ?up$/),n:ixCol(h,/^notes?$/)};
  if(c.date<0||c.ex<0)c={date:0,ex:1,r:2,w:3,sec:4,d:5,warm:8,n:9}; // the documented order
  const hu=c.w>=0?ixUnitOf(h[c.w]||''):null;R.unitKnown=!!hu;
  const hdu=c.d>=0?(ixDistUnitOf(h[c.d]||'')||'m'):'m';
  const list=[];
  for(let i=1;i<rows.length;i++){
    const row=rows[i];const g=k=>c[k]>=0?String(row[c[k]]==null?'':row[c[k]]).trim():'';
    const dt=ixDate(g('date'));const name=g('ex');
    if(!dt||!name){R.bad++;continue;}
    const set=ixNewSet();set.w=ixNum(g('w'));set.u=hu;set.r=ixNum(g('r'));set.sec=ixNum(g('sec'));set.m=ixNum(g('d'));set.du=hdu;
    set.warm=/^(true|1|yes)$/i.test(g('warm'));
    list.push({dt,name,set,note:g('n')});
  }
  // Fitbod's file has no workout names: one session per run of sets with no gap over three hours.
  let s=null,lastT=-Infinity;
  list.forEach((x,i)=>{
    if(!s||x.dt.t-lastT>3*3600000||dayOf(x.dt.t)!==dayOf(s.t)){s={name:'Fitbod workout',t:x.dt.t,noTime:x.dt.noTime,end:null,notes:'',ex:[],noName:true};R.sessions.push(s);}
    lastT=x.dt.t;if(x.dt.t>s.t&&x.dt.t-s.t<6*3600000)s.end=x.dt.t;
    ixPushSet(s,x.name,x.set,{note:x.note});
  });
  R.sessions.forEach(x=>{if(x.end&&x.end-x.t<60000)x.end=null;});
  return R;
}
// JEFIT: one file in sections, each starting with a line like "### WORKOUT SESSIONS ###" and its own
// header row. Sets are packed in one cell: "135x8,155x6".
function ixJefitSections(text){
  const out={};let cur=null;
  String(text||'').replace(/^﻿/,'').split(/\r?\n/).forEach(line=>{
    const t=line.replace(/^"+|[",;\s]+$/g,'').trim();
    if(/^#+$/.test(t)){cur=null;return;} // the line of hashes that closes each section in a real export
    const m=t.match(/^#{2,}\s*(.+?)\s*#{2,}$/);
    if(m){cur=m[1].toUpperCase();out[cur]=[];return;}
    if(/^#/.test(t)){cur=null;return;}
    if(cur&&line.trim())out[cur].push(line);
  });
  return out;
}
// The ROUTINES section of a real export holds three tables run together, each row preceded by its own
// header line (routines, their days, and each day's planned exercises). Group the rows by header.
function ixJefitGroups(lines){
  const g=new Map();let head=null;
  (lines||[]).forEach(l=>{if(/^row_id,/i.test(l)){head=l;if(!g.has(head))g.set(head,[]);return;}if(head)g.get(head).push(l);});
  const out=[];g.forEach((body,h)=>{const rows=ixCsv(h+'\n'+body.join('\n'),',');if(rows.length>1)out.push(rows);});
  return out;
}
function ixReadJefit(text){
  const R=ixResult('jefit','workouts');R.unitKnown=false;R.routines=[];
  const sec=ixJefitSections(text);
  const sk=Object.keys(sec).find(k=>/WORKOUT SESSION/.test(k));const lk=Object.keys(sec).find(k=>/EXERCISE LOG/.test(k));
  if(!sk||!lk){R.error='This does not look like a JEFIT export: its sections are missing. If you opened it in Excel or Numbers, download it again from jefit.com and choose that file without opening it.';return R;}
  const sRows=ixCsv(sec[sk].join('\n'),',');const lRows=ixCsv(sec[lk].join('\n'),',');
  const sh=(sRows[0]||[]).map(ixH),lh=(lRows[0]||[]).map(ixH);
  const sc={id:ixCol(sh,/^_id$/,/^id$/),date:ixCol(sh,/^mydate$/,/^date$/),st:ixCol(sh,/^starttime$/),tt:ixCol(sh,/^total_time$/),nm:ixCol(sh,/^(day_?name|name|routine_?name|workout_?name)$/),day:ixCol(sh,/^day_id$/)};
  const lc={sid:ixCol(lh,/^belongsession$/),ex:ixCol(lh,/^ename$/,/^exercise/),logs:ixCol(lh,/^logs$/),eid:ixCol(lh,/^eid$/)};
  if(sc.id<0||lc.sid<0||lc.ex<0||lc.logs<0){R.error='The JEFIT file’s columns are not the ones expected. Export it again from jefit.com; if it still fails, send the file to the developer.';return R;}
  // The unit: the SETTING table's mass column (" lbs" with a space, in a real file). Nothing else of that section, or of PROFILE, is read.
  let unit=null;const stk=Object.keys(sec).find(k=>/^SETTING/.test(k));
  if(stk){const r=ixCsv(sec[stk].join('\n'),',');const h=(r[0]||[]).map(ixH);const mi=ixCol(h,/^mass$/);const v=mi>=0&&r[1]?String(r[1][mi]||'').trim().toLowerCase():'';unit=/^kgs?$/.test(v)?'kg':/^(lbs?|pounds?)$/.test(v)?'lb':null;}
  if(unit){R.unitKnown=true;R.notes.push(`Weights read as ${unit}, the unit set in JEFIT.`);}
  // Routines: a session says which routine day it was (day_id); the day's name and its planned exercises are in ROUTINES.
  const days=new Map(),plan=[];
  const rk=Object.keys(sec).find(k=>/^ROUTINES?$/.test(k));
  if(rk)ixJefitGroups(sec[rk]).forEach(rows=>{
    const h=rows[0].map(ixH);
    if(h.includes('dayindex')){const i={id:ixCol(h,/^_id$/),nm:ixCol(h,/^name$/)};if(i.id<0||i.nm<0)return;
      for(let r=1;r<rows.length;r++){const id=String(rows[r][i.id]||'').trim(),nm=String(rows[r][i.nm]||'').trim();if(id&&nm&&!days.has(id))days.set(id,nm);}}
    else if(h.includes('exercisename')&&h.includes('belongplan')){
      const i={id:ixCol(h,/^_id$/),eid:ixCol(h,/^exercise_id$/),day:ixCol(h,/^belongplan$/),nm:ixCol(h,/^exercisename$/),sets:ixCol(h,/^setcount$/),timer:ixCol(h,/^timer$/),reps:ixCol(h,/^targetrep$/),ss:ixCol(h,/^superset$/),sort:ixCol(h,/^mysort$/)};
      if(i.day<0)return;
      for(let r=1;r<rows.length;r++){const g=k=>i[k]>=0?String(rows[r][i[k]]==null?'':rows[r][i[k]]).trim():'';plan.push({day:g('day'),eid:g('eid'),nm:g('nm'),sets:ixNum(g('sets')),rest:ixNum(g('timer')),reps:g('reps'),ss:g('ss'),sort:ixNum(g('sort'))||0});}
    }
  });
  const byId=new Map();
  for(let i=1;i<sRows.length;i++){
    const row=sRows[i];const g=k=>sc[k]>=0?String(row[sc[k]]==null?'':row[sc[k]]).trim():'';
    let dt=null;const st=ixNum(g('st'));if(st>0)dt=ixDate(String(st));if(!dt)dt=ixDate(g('date'));
    if(!dt){R.bad++;continue;}
    const dayId=g('day');const dn=dayId&&dayId!=='0'?days.get(dayId):'';
    const s={name:dn||g('nm')||'JEFIT workout',t:dt.t,noTime:dt.noTime,end:null,notes:'',ex:[],noName:!(dn||g('nm')),dayId:dn?dayId:''};
    const tt=ixNum(g('tt'));if(tt>0&&!dt.noTime)s.end=s.t+tt*1000;
    byId.set(g('id'),s);
  }
  const eidName=new Map();
  for(let i=1;i<lRows.length;i++){
    const row=lRows[i];const g=k=>lc[k]>=0?String(row[lc[k]]==null?'':row[lc[k]]).trim():'';
    const s=byId.get(g('sid'));const name=g('ex');
    if(!s||!name){R.bad++;continue;}
    if(g('eid')&&!eidName.has(g('eid')))eidName.set(g('eid'),name);
    const toks=g('logs').split(',').map(x=>x.trim()).filter(Boolean);
    // Cardio as another importer found it in a real file: five "0x…" fields, the last the time in seconds.
    if(toks.length===5&&toks.every(t=>/^0x\d/i.test(t))){
      const sec=ixNum(toks[4].split(/x/i)[1]);
      if(sec>0){const set=ixNewSet();set.sec=sec;ixPushSet(s,name,set,{split:true});}else R.bad++;
      continue;
    }
    let first=true;
    for(const tok of toks){
      const set=ixNewSet();set.u=unit;
      const m=tok.match(/^(\d*\.?\d*)\s*x\s*(\d+)/i);
      const tm=!m&&tok.match(/^(\d+):(\d{2})(?::(\d{2}))?$/); // a timed set: m:ss
      if(m){set.w=ixNum(m[1]);set.r=ixNum(m[2]);}
      else if(tm){set.sec=tm[3]!=null?(+tm[1])*3600+(+tm[2])*60+(+tm[3]):(+tm[1])*60+(+tm[2]);set.u=null;}
      else{R.bad++;continue;}
      ixPushSet(s,name,set,{split:first});first=false;
    }
  }
  byId.forEach(s=>{if(s.ex.length)R.sessions.push(s);});
  // Routine days you actually trained (a day's name appears on a session): those come over with their plan.
  const used=new Map();R.sessions.forEach(s=>{if(s.dayId)used.set(s.dayId,Math.max(used.get(s.dayId)||0,s.t));});
  const byName=new Map();let unnamed=0;
  used.forEach((last,dayId)=>{
    const rows=plan.filter(p=>p.day===dayId).sort((a,b)=>a.sort-b.sort);
    const exs=[];const ssCount={};rows.forEach(p=>{if(p.ss&&p.ss!=='0')ssCount[p.ss]=(ssCount[p.ss]||0)+1;});
    const letters={};
    rows.forEach(p=>{
      const nm=p.nm||eidName.get(p.eid)||'';if(!nm){unnamed++;return;}
      const nums=String(p.reps||'').split(',').map(x=>parseInt(x,10)).filter(x=>x>0);
      let link=null;if(p.ss&&p.ss!=='0'&&ssCount[p.ss]>1){if(!letters[p.ss])letters[p.ss]=String.fromCharCode(65+Object.keys(letters).length%26);link=letters[p.ss];}
      exs.push({name:nm,sets:Math.min(20,Math.max(1,p.sets>0?Math.round(p.sets):nums.length||3)),rMin:nums.length?Math.min(...nums):null,rMax:nums.length?Math.max(...nums):null,rest:p.rest>0?Math.min(900,Math.round(p.rest)):null,link});
    });
    const name=days.get(dayId);if(!name||!exs.length)return;
    const k=name.toLowerCase();const prev=byName.get(k);if(!prev||last>prev.last)byName.set(k,{name,last,exs});
  });
  byName.forEach(r=>R.routines.push(r));
  if(unnamed)R.notes.push(`${unnamed} planned exercise${unnamed===1?'':'s'} in your routines had no name in the file and ${unnamed===1?'was':'were'} left out.`);
  const bk=Object.keys(sec).find(k=>/BODY/.test(k));
  if(bk){const m=ixReadMeasures(ixCsv(sec[bk].join('\n'),','),'jefit');R.weights=m.weights;R.measures=m.measures;R.notes.push(...m.notes);}
  return R;
}
// Any other one-row-per-set file (Alpha Progression, StrongLifts, a spreadsheet): columns found by name.
function ixReadGeneric(rows,app){
  const h=rows[0].map(ixH);const R=ixResult(app,'workouts');
  const c={date:ixCol(h,/^date$/,/^(workout )?date/,/^day$/,/^start/,/time$/),ex:ixCol(h,/^exercise( name)?$/,/^exercise/,/^movement$/,/^lift$/),
    w:ixCol(h,/^weight/,/^load/,/^kg$/,/^lbs?$/),r:ixCol(h,/^reps?$/,/repetitions/,/^reps/),sets:ixCol(h,/^sets$/,/^# ?sets$/),
    rir:ixCol(h,/\brir\b/,/reps in reserve/),rpe:ixCol(h,/\brpe\b/),wn:ixCol(h,/^workout( name)?$/,/^routine/,/^session/,/^plan/,/^title$/,/^day name$/),
    n:ixCol(h,/^notes?$/,/comment/),warm:ixCol(h,/warm/),u:ixCol(h,/^unit$/,/^weight unit$/),dur:ixCol(h,/^duration/),idx:ixCol(h,/^set( (number|#|order|index))?$/)};
  if(c.date<0||c.ex<0||(c.r<0&&c.w<0)){
    R.error=`This file’s columns could not be read as ${ixAppName(app)} workouts. The importer for ${ixAppName(app)} was written without a real export to test on; please send this file to the developer so it can be added.`;return R;}
  const hu=c.w>=0?ixUnitOf(h[c.w]):null;R.unitKnown=!!hu||c.u>=0;
  const by=new Map();
  for(let i=1;i<rows.length;i++){
    const row=rows[i];const g=k=>c[k]>=0?String(row[c[k]]==null?'':row[c[k]]).trim():'';
    const dt=ixDate(g('date'));const name=g('ex');
    if(!dt||!name){R.bad++;continue;}
    const key=(dt.noTime?dayOf(dt.t):String(dt.t))+'|'+g('wn');
    let s=by.get(key);
    if(!s){s={name:g('wn')||`${ixAppName(app)} workout`,t:dt.t,noTime:dt.noTime,end:null,notes:'',ex:[],noName:!g('wn')};const d=ixDur(g('dur'));if(d>0&&!dt.noTime)s.end=s.t+d*1000;by.set(key,s);R.sessions.push(s);}
    const n=c.sets>=0&&c.idx<0?Math.min(20,Math.max(1,parseInt(g('sets'))||1)):1;
    for(let k=0;k<n;k++){
      const set=ixNewSet();set.w=ixNum(g('w'));set.u=hu||(c.u>=0?ixUnitOf(g('u')):null);set.r=ixNum(g('r'));
      set.rir=ixNum(g('rir'));set.rpe=ixNum(g('rpe'));set.warm=/^(true|1|yes|w|warm-?up)$/i.test(g('warm'));
      ixPushSet(s,name,set,{note:g('n')});
    }
  }
  return R;
}

// ─── Body: weigh-ins and tape measurements ───
// Weight → the bodyweight log; parts → the measurement fields. Body fat has nowhere to go here yet.
const IX_PARTS=[[/^neck/,'neck'],[/^chest/,'chest'],[/^waist/,'waist'],[/^hips?/,'hips'],
  [/left.*fore ?arm|fore ?arm.*left/,'leftForearm'],[/right.*fore ?arm|fore ?arm.*right/,'rightForearm'],
  [/left.*(bicep|arm)|(bicep|arm).*left/,'leftArm'],[/right.*(bicep|arm)|(bicep|arm).*right/,'rightArm'],
  [/left.*thigh|thigh.*left/,'leftThigh'],[/right.*thigh|thigh.*right/,'rightThigh'],
  [/left.*calf|calf.*left/,'leftCalf'],[/right.*calf|calf.*right/,'rightCalf']];
function ixPart(name){
  const n=String(name||'').toLowerCase().replace(/[_]/g,' ').replace(/\(.*?\)|\b(cm|in|inches|kg|lbs?)\b/g,'').trim();
  if(/^(body ?)?weight$|^bodyweight$|^weight$/.test(n))return'weight';
  if(/fat|bmi|calor|muscle|water|bone|lean/.test(n))return null;
  for(const[re,id]of IX_PARTS)if(re.test(n))return id;
  return null;
}
function ixReadMeasures(rows,app){
  const out={weights:[],measures:[],notes:[],skippedTypes:new Set()};
  if(!rows.length)return out;
  const h=rows[0].map(ixH);
  const dc=ixCol(h,/^date$/,/^mydate$/,/date/,/^time$/);if(dc<0)return out;
  const lenUnit=t=>/\bcm\b|_cm$|\(cm\)|centim/i.test(t)?'cm':/\bin\b|_in$|\(in\)|inch/i.test(t)?'in':null;
  const add=(dt,type,val,unit)=>{
    const v=ixNum(val);if(!(v>0))return;
    const part=ixPart(type);
    if(!part){const t=String(type||'').trim();if(t&&!/^(_?id|source|unit|notes?|comments?|time|timestamp|date|mydate|belongsession|user.*|.*_id)$/i.test(t))out.skippedTypes.add(t);return;}
    const ds=dayOf(dt.t);
    if(part==='weight')out.weights.push({date:ds,v,u:ixUnitOf(unit||type)});
    else out.measures.push({date:ds,part,v,u:lenUnit(unit||type)});
  };
  // Long form (Strong): Date, Measurement Type, Value, Unit
  const tc=ixCol(h,/^measurement( type)?$/,/^type$/,/^name$/),vc=ixCol(h,/^value$/),uc=ixCol(h,/^unit$/);
  if(tc>=0&&vc>=0){
    for(let i=1;i<rows.length;i++){const r=rows[i];const dt=ixDate(r[dc]);if(!dt)continue;add(dt,r[tc],r[vc],uc>=0?r[uc]:'');}
  }else{
    // Wide form (Hevy, JEFIT): one column per measurement, the unit in the column name.
    for(let i=1;i<rows.length;i++){const r=rows[i];const dt=ixDate(r[dc]);if(!dt)continue;h.forEach((col,k)=>{if(k!==dc&&r[k]!=null&&String(r[k]).trim()!=='')add(dt,col,r[k],col);});}
  }
  if(out.skippedTypes.size)out.notes.push(`Not brought in (no place for them here yet): ${[...out.skippedTypes].slice(0,8).join(', ')}.`);
  return out;
}

// ─── Which app wrote this file ───
function ixDetect(text,name){
  const t=String(text||'');
  if(/###\s*(WORKOUT SESSIONS|EXERCISE LOGS)\s*###/i.test(t))return{app:'jefit',kind:'workouts'};
  const rows=ixCsv(t.split(/\r?\n/).slice(0,3).join('\n'));const h=(rows[0]||[]).map(ixH);
  const has=re=>h.some(x=>re.test(x));
  if(has(/^exercise_title$/)&&has(/^set_index$/))return{app:'hevy',kind:'workouts'};
  if(has(/^exercise name$/)&&has(/^set order$/))return{app:'strong',kind:'workouts'};
  if(has(/^is ?warm ?up$/)||(has(/^multiplier$/)&&has(/^exercise$/)))return{app:'fitbod',kind:'workouts'};
  if(has(/^measurement type$/)&&has(/^value$/))return{app:'strong',kind:'measures'};
  if(has(/^date$/)&&!has(/exercise|movement|lift/)&&h.some(x=>ixPart(x)))return{app:null,kind:'measures'};
  // Headers in another language: say so rather than half-read the file.
  if(has(/^(datum|fecha|data|übung|ejercicio|exercice|esercizio)$/))return{app:null,kind:'foreign'};
  if(h.length>=3&&has(/date|day/)&&has(/exercise|movement|lift/))return{app:null,kind:'workouts'};
  return{app:null,kind:null};
}
// One file's text → what it holds. `chosen` is the app the user tapped.
function ixReadText(text,chosen,fname){
  const det=ixDetect(text,fname);
  let R;
  if(det.kind==='foreign'){R=ixResult(chosen,null);R.error=`The columns are named in another language. Set ${ixAppName(chosen)} to English, export again and choose the new file.`;return R;}
  if(!det.kind){R=ixResult(chosen,null);R.error=`${fname||'That file'} is not a workout export we can read. If ${ixAppName(chosen)} is set to another language, set it to English and export again.`;return R;}
  if(det.kind==='measures'){const m=ixReadMeasures(ixCsv(text),det.app||chosen);R=ixResult(det.app||chosen,'measures');R.weights=m.weights;R.measures=m.measures;R.notes=m.notes;}
  else if(det.app==='jefit')R=ixReadJefit(text);
  else{
    const rows=ixCsv(text);
    if(rows.length<2){R=ixResult(chosen,null);R.error='That file has no rows in it.';return R;}
    R=det.app==='hevy'?ixReadHevy(rows):det.app==='strong'?ixReadStrong(rows):det.app==='fitbod'?ixReadFitbod(rows):ixReadGeneric(rows,chosen);
  }
  R.detected=det.app;R.file=fname||'';
  if(R.kind==='workouts'&&!R.error&&!R.sessions.length)R.error='No workouts were found in that file.';
  return R;
}
async function ixReadFile(file,chosen){
  if(file.size>80e6)return[Object.assign(ixResult(chosen,null),{error:`${file.name} is too large to read here.`,file:file.name})];
  if(/\.zip$/i.test(file.name)){
    const out=[];
    const ents=(await zipIndex(file)).filter(e=>/\.(csv|txt)$/i.test(e.name)&&!/(^|\/)(__MACOSX|\.)/.test(e.name));
    if(!ents.length)return[Object.assign(ixResult(chosen,null),{error:`${file.name} has no CSV files in it.`,file:file.name})];
    for(const e of ents.slice(0,40)){const b=await zipExtract(file,e,40e6,e.name);out.push(ixReadText(new TextDecoder().decode(b),chosen,e.name.split('/').pop()));}
    return out;
  }
  return[ixReadText(await file.text(),chosen,file.name)];
}

// ─── Units ───
const ixR2=(v,step)=>Math.round(v/step)*step;
// A weight from the file in the app's unit, as the string a set stores.
function ixW(w,u,fallback){
  if(!(w>0))return'';
  const from=u||fallback||(isKg()?'kg':'lb');
  let v=w;
  if(from==='kg'&&!isKg())v=ixR2(w*LB_PER_KG,0.5);
  else if(from==='lb'&&isKg())v=ixR2(w/LB_PER_KG,0.25);
  return String(+v.toFixed(2));
}
function ixBw(v,u,fallback){
  const from=u||fallback||(isKg()?'kg':'lb');
  const x=from==='kg'&&!isKg()?v*LB_PER_KG:from==='lb'&&isKg()?v/LB_PER_KG:v;
  return Math.round(x*10)/10;
}
function ixLen(v,u,fallback){
  const to=S.measureUnit==='cm'?'cm':'in';const from=u||fallback||to;
  const x=from===to?v:from==='cm'?v/2.54:v*2.54;
  return Math.round(x*10)/10;
}
const ixMiles=(m,du,fallback)=>{const u=du||fallback;return u==='km'?m*0.621371:u==='mi'?m:m/1609.344;};
const ixMetres=(m,du,fallback)=>{const u=du||fallback;return u==='km'?m*1000:u==='mi'?m*1609.344:m;};
const ixRir=rpe=>rpe>=1&&rpe<=10?Math.max(0,Math.min(4,Math.round(10-rpe))):null;

// ─── Routines rebuilt from history ───
const IX_GENERIC_NAME=/^(workout|new workout|quick workout|empty workout|morning workout|afternoon workout|evening workout|night workout|lunch workout|midday workout|late night workout|fitbod workout|jefit workout|strong workout|hevy workout|alpha progression workout|stronglifts workout)$/i;
const ixCleanName=n=>String(n||'').replace(/[^\p{L}\p{N}()&+'’\- /]/gu,'').replace(/\s+/g,' ').trim();
// Names with two or more sessions in the six weeks up to the last one, newest first.
function ixRoutineCandidates(sessions){
  const by=new Map();
  sessions.forEach(s=>{if(s.noName)return;const n=ixCleanName(s.name);if(!n||IX_GENERIC_NAME.test(n))return;const k=n.toLowerCase();if(!by.has(k))by.set(k,{name:n,list:[]});by.get(k).list.push(s);});
  const out=[];
  by.forEach(v=>{
    const last=Math.max(...v.list.map(s=>s.t));
    const recent=v.list.filter(s=>s.t>=last-42*86400000);
    if(recent.length>=2)out.push({key:v.name.toLowerCase(),name:v.name,n:v.list.length,recent,last});
  });
  return out.sort((a,b)=>b.last-a.last).slice(0,20);
}

// ─── The plan ───
// files: the reads. ans: {unit:'kg'|'lb', range:'all'|'year', routines:{key:true}, fix:{nameKey: exId|'new'}, muscle:{nameKey:m}, sl5x5:bool}
function ixPlan(files,ans){
  ans=ans||{};
  const P={sessions:[],skip:{dup:0,twin:0,old:0,empty:0},newEx:new Map(),names:new Map(),weights:[],measures:[],routines:[],notes:[],
    sets:0,from:null,to:null,cardio:0,rirConv:false,needUnit:false,app:null,detected:new Set(),sample:[],bad:0};
  const ok=files.filter(f=>!f.error);
  ok.forEach(f=>{if(f.detected)P.detected.add(f.detected);P.bad+=f.bad||0;P.notes.push(...(f.notes||[]));if(f.kind==='workouts'&&!f.unitKnown)P.needUnit=true;});
  const fu=ans.unit||(isKg()?'kg':'lb');const fdu=fu==='kg'?'km':'mi';
  // Names: each distinct name in the files once, matched once.
  const matchName=raw=>{
    if(P.names.has(raw))return P.names.get(raw);
    const sp=ixSplitName(raw);const key=exNameKey(raw)||raw.toLowerCase();
    let r=null;const f=ans.fix&&ans.fix[key];
    if(f&&f!=='new'&&getEx(f))r={exId:f,how:'manual'};
    else if(f!=='new'){const al=IX_ALIAS[exNameKey(sp.name)];if(al&&getEx(al))r={exId:al,how:'alias'};else{const m=matchExercise(sp.name,sp.eq)||matchExercise(raw,'');if(m)r={exId:m.ex.id,how:m.how};}}
    if(!r){
      if(!P.newEx.has(key)){
        const cardio=isCardioName(sp.name);let muscle=cardio?'':(ans.muscle&&ans.muscle[key]!=null?ans.muscle[key]:guessMuscle(sp.name));
        if(muscle==='Shoulders')muscle=shoulderHead(sp.name);if(!cardio&&muscle&&!MEV_MAV[muscle])muscle=normMuscle(muscle);if(!MEV_MAV[muscle])muscle='';
        const n={key,name:raw.replace(/\s+/g,' ').trim().slice(0,80),cat:cardio?'Cardio':(MUSCLE_CAT[muscle]||'Full Body'),eq:sp.eq||guessEq(sp.name),muscle,sec:[]};
        if(cardio){n.kind='cardio';n.act=cardioAct(sp.name);}
        P.newEx.set(key,n);
      }
      r={newKey:key,how:'new'};
    }
    r.given=raw;P.names.set(raw,r);return r;
  };
  const cut=ans.range==='year'?Date.now()-365*86400000:0;
  const seen=new Set();
  const have=new Set(S.workouts.filter(w=>w.srcKey).map(w=>w.srcKey));
  const own=S.workouts.filter(w=>!w.src);
  const byDay=new Map();own.forEach(w=>{const d=dayOf(w.started);if(!byDay.has(d))byDay.set(d,[]);byDay.get(d).push(w);});
  ok.filter(f=>f.kind==='workouts').forEach(f=>{
    P.app=P.app||f.app;
    f.sessions.forEach(s=>{
      const key=`${f.app}:${s.t}:${ixCleanName(s.name).toLowerCase()}`;
      if(have.has(key)||seen.has(key)){P.skip.dup++;return;}
      seen.add(key);
      if(s.t<cut){P.skip.old++;return;}
      // Build the workout as this app stores it.
      const exs=[];let nSets=0;
      s.ex.forEach(e=>{
        const m=matchName(e.name);const info=m.exId?getEx(m.exId):P.newEx.get(m.newKey);
        const cardio=!!(info&&info.kind==='cardio');
        const sets=[];
        e.sets.forEach(x=>{
          if(x.warm&&!(x.w>0)&&!(x.r>0)&&!(x.sec>0))return;
          const o={w:'',r:'',done:true,tag:'',warmup:!!x.warm};
          if(cardio){
            if(x.sec>0)o.r=String(Math.round(x.sec));if(x.m>0)o.d=String(Math.round(ixMiles(x.m,x.du,fdu)*100)/100);
            if(!o.r&&!o.d)return;
          }else if(!(x.r>0)&&x.sec>0){o.r=String(Math.round(x.sec));o._timed=true;o.w=ixW(x.w,x.u,fu);}
          else if(!(x.r>0)&&x.m>0){o.r=String(Math.round(ixMetres(x.m,x.du,'m')));o._dist=true;o.w=ixW(x.w,x.u,fu);}
          else if(x.r>0){o.r=String(Math.round(x.r));o.w=ixW(x.w,x.u,fu);}
          else return;
          if(x.fail)o.fail=true;
          const rir=x.rir!=null&&x.rir>=0?Math.min(4,Math.round(x.rir)):ixRir(x.rpe);
          if(rir!=null&&!o.warmup&&!cardio){o.rir=rir;if(x.rir==null)P.rirConv=true;}
          sets.push(o);
        });
        if(!sets.length)return;
        const ex={exId:m.exId||null,_newKey:m.newKey||null,sets,progression:'flat',rest:null,link:e.link||null,note:e.note||''};
        if(cardio)ex.cardio=true;
        if(sets.every(z=>z._timed))ex.timed=true;
        if(sets.every(z=>z._dist))ex.dist=true;
        sets.forEach(z=>{delete z._timed;delete z._dist;});
        nSets+=sets.length;exs.push(ex);
      });
      if(!exs.length){P.skip.empty++;return;}
      // Logged here by hand already: the same day and most of the same lifts.
      const ids=new Set(exs.map(e=>e.exId).filter(Boolean));
      const mine=byDay.get(dayOf(s.t))||[];
      if(ids.size&&mine.some(w=>{const theirs=new Set(w.exercises.map(e=>e.exId));let k=0;ids.forEach(i=>{if(theirs.has(i))k++;});return k/ids.size>=0.6;})){P.skip.twin++;return;}
      const wk={name:ixCleanName(s.name).slice(0,80)||'Workout',started:s.t,ended:s.end&&s.end>s.t?s.end:null,exercises:exs,notes:String(s.notes||'').slice(0,2000),
        src:f.app,srcKey:key};
      if(s.noTime)wk.noTime=true;
      P.sessions.push(wk);P.sets+=nSets;
      const d=dayOf(s.t);if(!P.from||d<P.from)P.from=d;if(!P.to||d>P.to)P.to=d;
    });
  });
  P.sessions.sort((a,b)=>a.started-b.started);
  P.cardio=P.sessions.reduce((t,w)=>t+w.exercises.filter(e=>e.cardio).length,0);
  // Body: one weigh-in a day; days you weighed in here already are left alone.
  const bwHave=new Set((S.bodyweightLog||[]).map(b=>b.date));const msHave=new Set((S.measurements||[]).map(m=>m.date));
  const bwSeen=new Set();
  ok.forEach(f=>(f.weights||[]).forEach(w=>{if(bwHave.has(w.date)||bwSeen.has(w.date))return;const v=ixBw(w.v,w.u,fu);if(!saneBw(v))return;bwSeen.add(w.date);P.weights.push({date:w.date,weight:v,src:f.app});}));
  const md=new Map();
  ok.forEach(f=>(f.measures||[]).forEach(m=>{if(msHave.has(m.date))return;if(!md.has(m.date))md.set(m.date,{date:m.date,values:{},src:f.app});const vals=md.get(m.date).values;if(vals[m.part]==null)vals[m.part]=ixLen(m.v,m.u,fu==='kg'?'cm':'in');}));
  P.measures=[...md.values()];
  // Routines.
  const files0=ok.filter(f=>f.kind==='workouts');
  const all=[].concat(...files0.map(f=>f.sessions));
  P.candidates=ixRoutineCandidates(all);
  // Routines the file itself carries (JEFIT's days you trained): their plan wins over one rebuilt from the same name's history.
  files0.forEach(f=>(f.routines||[]).forEach(pr=>{
    const key=ixCleanName(pr.name).toLowerCase();if(!key||IX_GENERIC_NAME.test(ixCleanName(pr.name)))return;
    const c={key,name:ixCleanName(pr.name),n:all.filter(s=>!s.noName&&ixCleanName(s.name).toLowerCase()===key).length,recent:[],last:pr.last,plan:pr};
    const i=P.candidates.findIndex(x=>x.key===key);if(i>=0)P.candidates[i]=c;else P.candidates.push(c);
  }));
  P.candidates.sort((a,b)=>b.last-a.last);P.candidates=P.candidates.slice(0,20);
  P.candidates.forEach(c=>{if(!(ans.routines&&ans.routines[c.key]===false))P.routines.push(c.plan?ixBuildPlanRoutine(c,matchName,fu,all):ixBuildRoutine(c,matchName,fu));});
  if(P.app==='stronglifts'&&ans.sl5x5!==false)P.sl5x5=true;
  // Samples: the first four working sets of the newest session, exactly as they will be saved.
  // (A cardio-only session at the end is passed over: the sample is there to show weights and reps.)
  for(let i=P.sessions.length-1;i>=0&&!P.sample.length;i--){
    const w=P.sessions[i];
    for(const e of w.exercises){for(const z of e.sets){if(z.warmup||e.cardio)continue;P.sample.push({name:e.exId?exName(e.exId):(P.newEx.get(e._newKey)||{}).name,w:z.w,r:z.r,timed:!!e.timed,dist:!!e.dist,date:dayOf(w.started),rir:z.rir});if(P.sample.length>=4)break;}if(P.sample.length>=4)break;}
  }
  // Unit sanity: a "bench" over 700 lb or 320 kg is almost certainly the wrong unit.
  if(P.needUnit){const top=Math.max(0,...P.sessions.map(w=>Math.max(0,...w.exercises.filter(e=>e.exId==='bb-bench').map(e=>Math.max(0,...e.sets.map(z=>parseFloat(z.w)||0))))));
    if(top>(isKg()?320:700))P.unitWarn=`The heaviest bench press comes out at ${top} ${S.unit}. If that is wrong, the file is in the other unit.`;}
  return P;
}
// A routine the file carries: its exercises, sets, rep range, rest and supersets as planned, with the weight you last
// used for each in the newest session of the same name.
function ixBuildPlanRoutine(c,matchName,fu,all){
  const same=all.filter(s=>!s.noName&&ixCleanName(s.name).toLowerCase()===c.key);
  const latest=same.length?same.reduce((a,b)=>b.t>a.t?b:a):null;
  const exercises=c.plan.exs.map(p=>{
    const m=matchName(p.name);
    const o={exId:m.exId||null,_newKey:m.newKey||null,sets:p.sets,w:'',r:p.rMin!=null?String(p.rMin):'',type:'flat',rest:p.rest>0?p.rest:null,link:p.link||null};
    if(p.rMax!=null&&p.rMax>p.rMin)o.rMax=String(p.rMax);
    if(latest){
      const e=latest.ex.find(x=>x.name.toLowerCase()===p.name.toLowerCase());
      if(e){const top=Math.max(0,...e.sets.filter(x=>!x.warm).map(x=>x.w||0));const u=(e.sets.find(x=>x.u)||{}).u;if(top>0)o.w=ixW(top,u,fu);}
    }
    return o;
  });
  return{key:c.key,name:c.name.slice(0,80),n:c.n,exercises,fromPlan:true};
}
function ixBuildRoutine(c,matchName,fu){
  const latest=c.recent.reduce((a,b)=>b.t>a.t?b:a);
  const names=[];latest.ex.forEach(e=>{if(!names.includes(e.name))names.push(e.name);});
  c.recent.forEach(s=>s.ex.forEach(e=>{if(!names.includes(e.name)&&c.recent.filter(x=>x.ex.some(y=>y.name===e.name)).length>=c.recent.length/2)names.push(e.name);}));
  const exs=[];
  names.forEach(n=>{
    const inSess=c.recent.filter(s=>s.ex.some(e=>e.name===n));
    if(inSess.length<c.recent.length/2)return;
    const m=matchName(n);
    const counts=inSess.map(s=>s.ex.filter(e=>e.name===n).reduce((t,e)=>t+e.sets.filter(x=>!x.warm).length,0)).filter(x=>x>0);
    if(!counts.length)return;
    const freq={};counts.forEach(x=>{freq[x]=(freq[x]||0)+1;});
    const sets=+Object.keys(freq).sort((a,b)=>freq[b]-freq[a]||b-a)[0];
    const work=[].concat(...inSess.map(s=>[].concat(...s.ex.filter(e=>e.name===n).map(e=>e.sets.filter(x=>!x.warm)))));
    const reps=work.map(x=>x.r).filter(r=>r>0);const secs=work.map(x=>x.sec).filter(x=>x>0);
    const o={exId:m.exId||null,_newKey:m.newKey||null,sets:Math.min(20,Math.max(1,sets)),w:'',r:'',type:'flat',rest:null,link:null};
    if(reps.length){const lo=Math.min(...reps),hi=Math.max(...reps);o.r=String(lo);if(hi>lo)o.rMax=String(hi);}
    else if(secs.length){o.timed=true;o.r=String(Math.round(Math.max(...secs)));}
    const lastSess=inSess.reduce((a,b)=>b.t>a.t?b:a);
    const top=Math.max(0,...[].concat(...lastSess.ex.filter(e=>e.name===n).map(e=>e.sets.filter(x=>!x.warm).map(x=>x.w||0))));
    const lu=([].concat(...lastSess.ex.filter(e=>e.name===n).map(e=>e.sets)).find(x=>x.u)||{}).u;
    if(top>0)o.w=ixW(top,lu,fu);
    exs.push(o);
  });
  return{key:c.key,name:c.name.slice(0,80),n:c.n,exercises:exs};
}

// ─── Writing it ───
async function ixCommit(P,files){
  try{await dailyTake();}catch(e){logError(e,'daily copy');} // the copy you can go back to: taken before anything changes
  const app=P.app||(files.find(f=>!f.error)||{}).app||'other';
  const at=Date.now();
  const idByKey={};const newIds=[];
  const usedKeys=new Set();
  P.sessions.forEach(w=>w.exercises.forEach(e=>{if(e._newKey)usedKeys.add(e._newKey);}));
  P.routines.forEach(r=>r.exercises.forEach(e=>{if(e._newKey)usedKeys.add(e._newKey);}));
  P.newEx.forEach(n=>{
    if(!usedKeys.has(n.key))return;
    const id=`custom-${uid()}`;idByKey[n.key]=id;newIds.push(id);
    const c={id,name:n.name,cat:n.cat,eq:n.eq,muscle:n.muscle,sec:n.sec,src:app};if(n.kind){c.kind=n.kind;c.act=n.act;}
    S.custom.push(c);if(n.sec.length)SEC_MUSCLE[id]=n.sec;
  });
  _exIdx=null;
  const wkIds=[];const acts=[];
  P.sessions.forEach(w0=>{
    const wk=Object.assign({},w0,{id:uid(),routineId:null});
    wk.exercises=w0.exercises.map(e=>{const o=Object.assign({},e,{exId:e.exId||idByKey[e._newKey]});delete o._newKey;return o;}).filter(e=>e.exId);
    if(!wk.exercises.length)return;
    if(wk.ended){const cardioMs=wk.exercises.filter(e=>e.cardio).reduce((t,e)=>t+e.sets.reduce((a,x)=>a+(parseInt(x.r)||0)*1000,0),0);wk.cals=sessionCals(Math.max(0,wk.ended-wk.started-cardioMs));}
    cardioActivities(wk).forEach(a=>acts.push(a));
    S.workouts.push(wk);wkIds.push(wk.id);
  });
  S.workouts.sort((a,b)=>b.started-a.started);
  if(acts.length){S.activities.push(...acts);S.activities.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.at||0)-(a.at||0));}
  // Routines: a name you already use gets the app's name after it, so nothing of yours is replaced.
  const names=new Set(S.routines.map(r=>String(r.name).toLowerCase()));
  const rids=[];
  P.routines.forEach(r=>{
    let name=r.name;if(names.has(name.toLowerCase()))name=`${r.name} (${ixAppName(app)})`.slice(0,80);names.add(name.toLowerCase());
    const exercises=r.exercises.map(e=>{const o=Object.assign({},e,{exId:e.exId||idByKey[e._newKey]});delete o._newKey;return o;}).filter(e=>e.exId);
    if(!exercises.length)return;
    const id=uid();rids.push(id);
    S.routines.push({id,name,notes:r.fromPlan?`From your ${ixAppName(app)} routine`:`Rebuilt from your ${ixAppName(app)} history`,exercises,days:[],src:app});
  });
  if(P.sl5x5){
    const mk=(n,list)=>{const id=uid();rids.push(id);S.routines.push({id,name:n,notes:'StrongLifts 5×5',days:[],src:app,exercises:list.map(([exId,sets,r])=>({exId,sets,w:'',r:String(r),type:'flat',rest:null,link:null}))});};
    if(!names.has('stronglifts 5x5 a'))mk('StrongLifts 5x5 A',[['squat',5,5],['bb-bench',5,5],['bb-row',5,5]]);
    if(!names.has('stronglifts 5x5 b'))mk('StrongLifts 5x5 B',[['squat',5,5],['ohp',5,5],['deadlift',1,5]]);
  }
  P.weights.forEach(w=>S.bodyweightLog.push(w));
  if(P.weights.length){S.bodyweightLog.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);S.bodyweight=S.bodyweightLog[0].weight;}
  P.measures.forEach(m=>S.measurements.push(m));
  if(P.measures.length)S.measurements.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  const rec={id:uid(),app,at,files:files.map(f=>f.file).filter(Boolean).slice(0,10),
    counts:{workouts:wkIds.length,sets:P.sets,routines:rids.length,weighIns:P.weights.length,measurements:P.measures.length,newEx:newIds.length,activities:acts.length},
    skipped:Object.assign({},P.skip),from:P.from,to:P.to};
  if(!Array.isArray(S.importLog))S.importLog=[];
  S.importLog.unshift(rec);S.importLog=S.importLog.slice(0,50);
  bumpMemo();rebuildPRs();saveNow();
  return{rec,newIds,rids};
}

// ─── Linking an imported exercise to one already here ───
// Every set logged under the imported exercise moves to the one you pick, and the imported one goes.
function ixLinkCounts(id){
  let w=0,s=0;S.workouts.forEach(x=>{let hit=false;x.exercises.forEach(e=>{if(e.exId===id){hit=true;s+=e.sets.filter(z=>z.done).length;}});if(hit)w++;});
  return{workouts:w,sets:s,routines:S.routines.filter(r=>r.exercises.some(e=>e.exId===id)).length};
}
function ixLink(from,to){
  if(from===to)return false;
  const a=(S.custom||[]).find(c=>c.id===from);const b=getEx(to);
  if(!a||!b)return false;
  if(S.activeWorkout&&S.activeWorkout.exercises.some(e=>e.exId===from)){toast('That exercise is in the workout you have open');return false;}
  // A routine that already has the one you picked keeps that entry rather than listing it twice.
  S.routines.forEach(r=>{if(r.exercises.some(e=>e.exId===to))r.exercises=r.exercises.filter(e=>e.exId!==from);});
  remapExerciseId(S,from,to);
  delete SEC_MUSCLE[from];
  if(isObj(S.exMuscle))delete S.exMuscle[from];
  if(Array.isArray(S.shoulderReview))S.shoulderReview=S.shoulderReview.filter(x=>x!==from);
  const lg=(S.importLog||[]).find(r=>r.app===a.src&&r.counts&&r.counts.newEx>0);if(lg)lg.counts.newEx--;
  _exIdx=null;bumpMemo();rebuildPRs();saveNow();
  return true;
}

// ─── Removing what one app brought in ───
// Workouts and weigh-ins it brought, the routines rebuilt from it that you have not trained from since,
// and the exercises it created that nothing else uses any more. Anything logged in Lah We stays.
function ixRemovalPlan(app){
  const wks=S.workouts.filter(w=>w.src===app);const wkIds=new Set(wks.map(w=>w.id));
  const usedRoutine=new Set(S.workouts.filter(w=>w.src!==app&&w.routineId).map(w=>w.routineId));
  if(S.activeWorkout&&S.activeWorkout.routineId)usedRoutine.add(S.activeWorkout.routineId);
  const rts=S.routines.filter(r=>r.src===app&&!usedRoutine.has(r.id));const rtKeep=S.routines.filter(r=>r.src===app&&usedRoutine.has(r.id));
  const rtIds=new Set(rts.map(r=>r.id));
  const stillUsed=new Set();
  S.workouts.forEach(w=>{if(!wkIds.has(w.id))w.exercises.forEach(e=>stillUsed.add(e.exId));});
  S.routines.forEach(r=>{if(!rtIds.has(r.id))r.exercises.forEach(e=>stillUsed.add(e.exId));});
  if(S.activeWorkout)S.activeWorkout.exercises.forEach(e=>stillUsed.add(e.exId));
  const exs=(S.custom||[]).filter(c=>c.src===app&&!stillUsed.has(c.id));
  return{wks,rts,rtKeep,exs,acts:S.activities.filter(a=>a.wkId&&wkIds.has(a.wkId)),
    bw:(S.bodyweightLog||[]).filter(b=>b.src===app),ms:(S.measurements||[]).filter(m=>m.src===app)};
}
async function ixRemove(app){
  const p=ixRemovalPlan(app);
  try{await dailyTake();}catch(e){logError(e,'daily copy');}
  const wkIds=new Set(p.wks.map(w=>w.id)),rtIds=new Set(p.rts.map(r=>r.id)),exIds=new Set(p.exs.map(c=>c.id));
  S.workouts=S.workouts.filter(w=>!wkIds.has(w.id));
  S.activities=S.activities.filter(a=>!(a.wkId&&wkIds.has(a.wkId)));
  S.routines=S.routines.filter(r=>!rtIds.has(r.id));
  (S.groups||[]).forEach(g=>{if(Array.isArray(g.routineIds))g.routineIds=g.routineIds.filter(id=>!rtIds.has(id));});
  S.custom=S.custom.filter(c=>!exIds.has(c.id));exIds.forEach(id=>{delete SEC_MUSCLE[id];if(S.exRest)delete S.exRest[id];if(S.prsManual)delete S.prsManual[id];});
  S.bodyweightLog=S.bodyweightLog.filter(b=>b.src!==app);if(S.bodyweightLog.length)S.bodyweight=S.bodyweightLog[0].weight;
  S.measurements=S.measurements.filter(m=>m.src!==app);
  S.importLog=(S.importLog||[]).filter(r=>r.app!==app);
  _exIdx=null;bumpMemo();rebuildPRs();saveNow();
  return p;
}
function ixImportedApps(){
  const apps=new Set((S.importLog||[]).map(r=>r.app));
  S.workouts.forEach(w=>{if(w.src&&w.src!=='strava')apps.add(w.src);});
  (S.custom||[]).forEach(c=>{if(c.src)apps.add(c.src);});
  (S.bodyweightLog||[]).forEach(b=>{if(b.src)apps.add(b.src);});
  return[...apps].filter(a=>a&&a!=='strava');
}

// ═══ The sheets ═══
function ixFmtSet(z){if(z.timed)return`${z.w?z.w+' '+S.unit+' · ':''}${z.r}s`;if(z.dist)return`${z.w?z.w+' '+S.unit+' · ':''}${z.r} m`;return`${z.w?`${z.w} ${S.unit} × `:'× '}${z.r}${z.rir!=null?` · ${fmtRir(z.rir)} in reserve`:''}`;}
function showAppImport(){
  window._ix=null;
  const ov=makeOv('ixmp-ov');
  ov._keep=()=>!!(window._ix&&window._ix.busy);
  ov._onDismiss=()=>{window._ix=null;};
  document.body.appendChild(ov);attachSwipeDown(ov);
  ixPaintHub();
}
function ixModal(inner){const ov=document.getElementById('ixmp-ov');if(!ov)return null;ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div>${inner}</div>`;const m=ov.querySelector('.modal');if(m)m.scrollTop=0;return ov;}
function ixPaintHub(){
  const tile=(id,name,mono,sub,js)=>`<button class="eq-preset ix-tile" onclick="${js}"><span class="ix-mono">${esc(mono)}</span><span><span class="ix-tn">${esc(name)}</span>${sub?`<span class="ix-ts">${esc(sub)}</span>`:''}</span></button>`;
  ixModal(`<div class="mt">Import from another app</div>
    <div class="sheet-sub">Bring your history with you: workouts set by set, routines rebuilt from them, weigh-ins and measurements. The file is read on this phone; nothing is uploaded.</div>
    <div class="ix-grid">${IX_APPS.map(a=>tile(a.id,a.name,a.mono,'',`ixOpen(${jsq(a.id)})`)).join('')}${tile('strava','Strava','Sv','Runs and rides','ixStrava()')}</div>
    <div class="fine" style="margin-top:10px">Don’t see your app? It doesn’t offer an export we can read.</div>`);
}
function ixStrava(){closeOv('ixmp-ov');setTimeout(showStravaImport,240);}
function ixOpen(id){
  const a=ixApp(id);if(!a)return;
  window._ix={app:id,files:null,ans:{unit:null,range:'all',routines:{},fix:{},muscle:{}},plan:null,busy:false};
  ixModal(`<div class="mt">Import from ${esc(a.name)}</div>
    ${a.beta?`<div class="note-box" style="margin:6px 0 10px">This importer was built from ${esc(a.name)}’s documentation, without a real file to test on. If your file does not read, it says so and nothing is changed.</div>`:''}
    <div class="ix-whats"><div class="ix-what"><div class="ix-wh">Comes over</div><div>${a.comes}</div></div>
    <div class="ix-what"><div class="ix-wh">Gets translated</div><div>${a.trans}</div></div>
    <div class="ix-what"><div class="ix-wh">Won’t come over</div><div>${a.wont}</div></div></div>
    <details class="fold" open><summary>Get your ${esc(a.name)} file</summary><ol class="sv-steps">${a.steps.map(s=>`<li>${s}</li>`).join('')}</ol>${a.lang?`<div class="fine">${a.lang}</div>`:''}</details>
    <input type="file" id="ix-file" multiple accept=".csv,.txt,.zip,text/csv,application/zip" style="display:none" onchange="ixPicked(this)">
    <button class="btn btp bfw" onclick="document.getElementById('ix-file').click()">Choose file</button>
    <div id="ix-body"></div>`);
}
async function ixPicked(inp){
  const z=window._ix;const files=[...(inp.files||[])];inp.value='';if(!z||!files.length)return;
  const body=document.getElementById('ix-body');if(body)body.innerHTML=`<div class="note-box" style="margin-top:12px"><span class="ai-spin"></span> Reading ${files.length>1?files.length+' files':esc(files[0].name)}…</div>`;
  let reads=[];
  for(const f of files){try{reads.push(...await ixReadFile(f,z.app));}catch(e){logError(e,'app import read');reads.push(Object.assign(ixResult(z.app,null),{error:(e&&e.message)||`${f.name} could not be read.`,file:f.name}));}}
  z.files=reads;z.ans.unit=null;
  const det=[...new Set(reads.filter(r=>!r.error&&r.detected&&r.kind==='workouts').map(r=>r.detected))];
  z.other=det.length===1&&det[0]!==z.app?det[0]:null;
  ixReview();
}
// The questions this file raises, the confirm summary and the Import button.
function ixReview(){
  const z=window._ix;if(!z||!z.files)return;
  const body=document.getElementById('ix-body');if(!body)return;
  const errs=z.files.filter(f=>f.error);const ok=z.files.filter(f=>!f.error);
  if(!ok.length){body.innerHTML=`<div class="import-warn" style="margin-top:12px">${errs.map(f=>`<b>${esc(f.file||'File')}</b>: ${esc(f.error)}`).join('<br>')}</div><div class="fine">Nothing was changed.</div>`;return;}
  if(z.other&&!z.otherOk){
    body.innerHTML=`<div class="note-box" style="margin-top:12px">This looks like a <b>${esc(ixAppName(z.other))}</b> file, not ${esc(ixAppName(z.app))}.</div>
      <button class="btn btp bfw" onclick="ixAsOther()">Continue as ${esc(ixAppName(z.other))}</button>`;return;
  }
  const P=ixPlan(z.files,z.ans);z.plan=P;
  const a=ixApp(z.app)||{};
  const nNew=[...P.newEx.values()].filter(n=>[...P.names.values()].some(r=>r.newKey===n.key)).length;
  const matched=[...P.names.values()].filter(r=>r.exId).length;
  const q=[];
  if(P.needUnit){
    const u=z.ans.unit||(isKg()?'kg':'lb');
    q.push(`<div class="ix-q"><div class="ix-ql">Weights in this file are in</div>${setSeg('Unit',[['lb','lb'],['kg','kg']],u,'ixSetUnit')}
      <div class="fine">${esc(ixAppName(z.app))}’s file does not say. Pick the unit you logged in there${isKg()?'; they are shown here in kg':'; they are shown here in lb'}.</div>${P.unitWarn?`<div class="import-warn">${esc(P.unitWarn)}</div>`:''}</div>`);
  }
  if(P.from&&P.from<dayOf(Date.now()-365*86400000)||z.ans.range==='year')
    q.push(`<div class="ix-q"><div class="ix-ql">How far back</div>${setSeg('Range',[['all','All of it'],['year','Last 12 months']],z.ans.range,'ixSetRange')}</div>`);
  if(P.candidates&&P.candidates.length){
    const nPlan=P.candidates.filter(c=>c.plan).length,nHist=P.candidates.length-nPlan;
    q.push(`<div class="ix-q"><div class="ix-ql">Bring in your routines?</div><div class="fine" style="margin-bottom:6px">${nPlan?`${nPlan===P.candidates.length?'These are':nPlan+' of these are'} the workout days you trained in ${esc(ixAppName(z.app))}, with their planned sets, reps and rest and the weights you last used. `:''}${nHist?`${nPlan?'The others are':'Each one is'} made from its last six weeks: the exercises in order, the usual number of sets, and the rep range you actually did. `:''}Edit them in Library afterwards.</div>
      <div class="set-sec">${P.candidates.map(c=>{const on=z.ans.routines[c.key]!==false;return`<div class="frow set-row"><span class="set-lbl">${esc(c.name)}<small>${c.n} session${c.n===1?'':'s'}</small></span>${setTog(on,`ixTogRoutine(${jsq(c.key)})`,c.name)}</div>`;}).join('')}</div></div>`);
  }else if(ok.some(f=>f.sessions&&f.sessions.length&&f.sessions.every(s=>s.noName)))q.push(`<div class="fine" style="margin-top:8px">${esc(ixAppName(z.app))}’s file has no workout names, so routines cannot be rebuilt from it.</div>`);
  if(P.app==='stronglifts')q.push(`<div class="ix-q"><div class="frow set-row"><span class="set-lbl">Set up the 5×5 A and B workouts as routines</span>${setTog(z.ans.sl5x5!==false,'ixTogSL()','5x5 routines')}</div></div>`);
  const newRows=[...P.names.values()].filter(r=>r.how==='new');
  const unmatched=newRows.length?`<div class="ix-q"><div class="ix-ql">${newRows.length} exercise${newRows.length===1?'':'s'} we couldn’t match</div><div class="fine" style="margin-bottom:6px">They come in as new exercises. Tap one to use one of ours instead, or to set the muscle it counts toward.</div>
    <div class="list">${newRows.slice(0,60).map(r=>{const n=P.newEx.get(r.newKey)||{};return`<button class="row row-tap" onclick="ixFixSheet(${jsq(r.given)})"><span class="row-main"><span class="row-t">${esc(r.given)}</span><span class="row-s">New · ${n.kind==='cardio'?'cardio':n.muscle?esc(n.muscle):'no muscle yet'}</span></span><span class="row-chev">${ICON('chev',16)}</span></button>`;}).join('')}</div>${newRows.length>60?`<div class="fine">…and ${newRows.length-60} more.</div>`:''}</div>`:'';
  const total=P.sessions.length;
  const counts=[total?`${total.toLocaleString()} workout${total===1?'':'s'} · ${P.sets.toLocaleString()} sets`:'',matched?`${matched} exercise${matched===1?'':'s'} matched to ours`:'',nNew?`${nNew} new exercise${nNew===1?'':'s'}`:'',
    P.routines.length+(P.sl5x5?2:0)?`${P.routines.length+(P.sl5x5?2:0)} routine${P.routines.length+(P.sl5x5?2:0)===1?'':'s'}`:'',P.weights.length?`${P.weights.length} weigh-in${P.weights.length===1?'':'s'}`:'',P.measures.length?`${P.measures.length} day${P.measures.length===1?'':'s'} of measurements`:''].filter(Boolean);
  const skipped=[P.skip.dup?`${P.skip.dup} already imported`:'',P.skip.twin?`${P.skip.twin} you already logged here`:'',P.skip.old?`${P.skip.old} older than 12 months`:'',P.skip.empty?`${P.skip.empty} with no sets`:'',P.bad?`${P.bad} unreadable row${P.bad===1?'':'s'}`:''].filter(Boolean);
  const assume=[P.needUnit?`Weights read as ${z.ans.unit||(isKg()?'kg':'lb')}${(z.ans.unit||(isKg()?'kg':'lb'))!==(isKg()?'kg':'lb')?` and shown in ${S.unit}`:''}.`:'',
    P.rirConv?'RPE turned into reps in reserve (RPE 8 → 2 in reserve).':'',P.sessions.some(w=>w.noTime)?'Some workouts have a date but no time of day.':'',
    P.cardio?`${P.cardio} cardio exercise${P.cardio===1?' also becomes an activity':'s also become activities'} (runs, rows, rides).`:''].filter(Boolean);
  const nothing=!total&&!P.weights.length&&!P.measures.length&&!P.routines.length&&!P.sl5x5;
  body.innerHTML=`${errs.length?`<div class="import-warn" style="margin-top:12px">${errs.map(f=>`<b>${esc(f.file||'File')}</b>: ${esc(f.error)}`).join('<br>')}</div>`:''}
    ${q.join('')}${unmatched}
    <div class="sec-h" style="margin-top:16px">Would be imported</div>
    ${nothing?`<div class="note-box">Nothing new to import${skipped.length?`: ${esc(skipped.join('; '))}`:''}.</div>`:`<div class="ix-sum"><div class="ix-big">${esc(counts.join(' · '))}</div>${P.from?`<div class="fine">${esc(fmtDay(P.from))} – ${esc(fmtDay(P.to))}</div>`:''}</div>
    ${P.sample.length?`<div class="ix-ql" style="margin-top:10px">Exactly as they will be saved</div><div class="ix-sample">${P.sample.map(x=>`<div class="ix-srow"><span>${esc(x.name||'')}</span><b>${esc(ixFmtSet(x))}</b></div>`).join('')}<div class="fine">${esc(fmtDay(P.sample[0].date))}</div></div>`:''}`}
    ${assume.length?`<div class="fine" style="margin-top:8px">${assume.map(esc).join('<br>')}</div>`:''}
    ${skipped.length&&!nothing?`<div class="fine" style="margin-top:6px">Skipped: ${esc(skipped.join('; '))}.</div>`:''}
    ${P.notes.length?`<div class="fine" style="margin-top:6px">${[...new Set(P.notes)].slice(0,4).map(esc).join('<br>')}</div>`:''}
    <div class="fine" style="margin-top:6px"><b>Won’t come over:</b> ${a.wont||''}</div>
    ${nothing?'':`<button class="btn btp bfw" style="margin-top:12px" onclick="ixGo()">Import</button>
    <div class="fine" style="margin-top:6px">There is no undo for an import. A copy of your log as it is now is kept in Settings → Your data → Daily copies, and Imported data can remove everything this brings in.</div>`}`;
}
function ixAsOther(){const z=window._ix;if(!z||!z.other)return;const files=z.files;ixOpen(z.other);const n=window._ix;if(!n)return;n.files=files;n.otherOk=true;ixReviewAfterOpen();}
function ixReviewAfterOpen(){const f=document.querySelector('#ixmp-ov details.fold');if(f)f.open=false;ixReview();}
function ixSetUnit(u){const z=window._ix;if(!z)return;z.ans.unit=u==='kg'?'kg':'lb';ixReview();}
function ixSetRange(r){const z=window._ix;if(!z)return;z.ans.range=r==='year'?'year':'all';ixReview();}
function ixTogRoutine(k){const z=window._ix;if(!z)return;z.ans.routines[k]=z.ans.routines[k]===false;ixReview();}
function ixTogSL(){const z=window._ix;if(!z)return;z.ans.sl5x5=z.ans.sl5x5===false;ixReview();}
// Before importing: use one of ours instead, or set the muscle of a new one.
function ixFixSheet(given){
  const z=window._ix;if(!z||!z.plan)return;
  const key=exNameKey(given)||String(given).toLowerCase();const n=z.plan.newEx.get(key);
  const cur=z.ans.fix[key];const picked=cur&&cur!=='new'?getEx(cur):null;
  const ov=makeOv('ixfix-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div>
    <div class="mt" style="margin-bottom:2px">“${esc(given)}”</div>
    <div class="sheet-sub">${picked?`Will be logged as ${esc(picked.name)}`:'Will be created as a new exercise'}</div>
    ${!picked&&n?`<div class="fg"><label class="fl">Counts toward</label><select onchange="ixSetMuscle(${jsq(key)},this.value)">${['',...Object.keys(MEV_MAV)].map(m=>`<option value="${esc(m)}"${n.muscle===m?' selected':''}>${m?esc(m):'No muscle (cardio or other)'}</option>`).join('')}</select></div>`:''}
    ${picked?`<button class="btn bts bfw" style="margin-bottom:10px" onclick="ixPick(${jsq(key)},'new')">Make it a new exercise instead</button>`:''}
    <div class="sec-h">Use one of ours</div>
    <div class="lib-search"><span class="lib-search-ic">${ICON('search',17)}</span><input id="ixfix-q" type="search" placeholder="Search exercises" value="${esc(ixSplitName(given).name)}" oninput="ixPickList('ixfix-list',this.value,${jsq(`ixPick(${jsq(key)},%ID%)`)})" autocomplete="off"></div>
    <div id="ixfix-list"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  ixPickList('ixfix-list',ixSplitName(given).name,`ixPick(${jsq(key)},%ID%)`);
}
// A searchable list of exercises; `js` has %ID% where the picked id goes.
function ixPickList(elId,q,js,exclude){
  const el=document.getElementById(elId);if(!el)return;
  const words=String(q||'').toLowerCase().split(/\s+/).filter(Boolean);const al=libAliasIds(q||'');
  let list=allEx().filter(e=>e.id!==exclude&&(!words.length||words.some(w=>e.name.toLowerCase().includes(w))||al.has(e.id)));
  const score=e=>{const n=e.name.toLowerCase();return(words.every(w=>n.includes(w))?2:0)+(al.has(e.id)?1:0)+(e.src?-1:0);};
  list=list.sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name)).slice(0,30);
  el.innerHTML=list.length?`<div class="list">${list.map(e=>`<button class="row row-tap" onclick="${esc(js.replace('%ID%',jsq(e.id)))}"><span class="row-main"><span class="row-t">${esc(e.name)}</span><span class="row-s">${esc(e.cat)} · ${esc(e.eq)}</span></span></button>`).join('')}</div>`:'<div class="ch-empty">Nothing matches. Try fewer words.</div>';
}
function ixPick(key,exId){const z=window._ix;if(!z)return;z.ans.fix[key]=exId;closeOv('ixfix-ov');ixReview();}
function ixSetMuscle(key,m){const z=window._ix;if(!z)return;z.ans.muscle[key]=MEV_MAV[m]?m:'';ixReview();}
async function ixGo(){
  const z=window._ix;if(!z||!z.plan||z.busy)return;
  z.busy=true;
  const body=document.getElementById('ix-body');if(body)body.innerHTML=`<div class="note-box" style="margin-top:12px"><span class="ai-spin"></span> Importing… keep the app open.</div>`;
  let res=null,err=null;
  try{res=await ixCommit(z.plan,z.files);}catch(e){err=e;logError(e,'app import');}
  z.busy=false;z.res=res;
  ixResults(res,err);
  render();
}
function ixResults(res,err){
  const z=window._ix||{};const P=z.plan||{};const a=ixApp(z.app)||{name:ixAppName(z.app)};
  if(err||!res){ixModal(`<div class="mt">Import failed</div><div class="import-warn">${esc((err&&err.message)||'Something went wrong while saving.')}</div><div class="fine">Your log was not changed. Today’s daily copy is in Settings → Your data → Daily copies.</div>`);return;}
  const c=res.rec.counts;const errs=(z.files||[]).filter(f=>f.error);
  const partial=errs.length>0;
  const lines=[[c.workouts,'Workout'],[c.sets,'Set'],[c.routines,'Routine rebuilt','Routines rebuilt'],[c.newEx,'New exercise'],[c.weighIns,'Weigh-in'],[c.measurements,'Day of measurements','Days of measurements'],[c.activities,'Cardio activity','Cardio activities']]
    .filter(x=>x[0]>0).map(([n,one,many])=>`<div class="ix-srow"><span>${n===1?one:(many||one+'s')}</span><b>${n.toLocaleString()}</b></div>`).join('');
  const sk=res.rec.skipped||{};
  const skipped=[sk.dup?`${sk.dup} already imported`:'',sk.twin?`${sk.twin} you had already logged here`:'',sk.old?`${sk.old} older than 12 months`:'',sk.empty?`${sk.empty} with no sets`:''].filter(Boolean);
  const newEx=(S.custom||[]).filter(x=>res.newIds.includes(x.id));
  ixModal(`<div class="mt">${partial?'Imported, with problems':'Imported'}</div>
    <div class="sheet-sub">From ${esc(a.name)}${res.rec.from?` · ${esc(fmtDay(res.rec.from))} – ${esc(fmtDay(res.rec.to))}`:''}</div>
    <div class="ix-sample">${lines||'<div class="fine">Nothing new came in.</div>'}</div>
    ${skipped.length?`<div class="fine" style="margin-top:6px">Skipped: ${esc(skipped.join('; '))}.</div>`:''}
    ${errs.length?`<div class="import-warn" style="margin-top:8px">${errs.map(f=>`<b>${esc(f.file||'File')}</b>: ${esc(f.error)}`).join('<br>')}</div>`:''}
    ${newEx.length?`<div class="sec-h" style="margin-top:14px">New exercises · ${newEx.length}</div><div class="fine" style="margin-bottom:6px">Tap one to link it to an exercise already here; its history moves over.</div>
      <div class="list">${newEx.slice(0,40).map(x=>ixExRow(x)).join('')}</div>`:''}
    <div class="fine" style="margin-top:10px"><b>Not in ${esc(a.name)}’s export:</b> ${a.wont||''}</div>
    <div class="fine" style="margin-top:6px">Everything that came in is marked as imported. Settings → Your data → Imported data can link exercises later or remove this import.</div>`);
}
function ixExRow(x){const c=ixLinkCounts(x.id);return`<button class="row row-tap" onclick="ixLinkSheet(${jsq(x.id)})"><span class="row-main"><span class="row-t">${esc(x.name)}</span><span class="row-s">${c.sets} set${c.sets===1?'':'s'} in ${c.workouts} workout${c.workouts===1?'':'s'} · ${x.muscle?esc(x.muscle):x.kind==='cardio'?'cardio':'no muscle'}</span></span><span class="row-chev">${ICON('link',16)}</span></button>`;}
function ixLinkSheet(id){
  const x=(S.custom||[]).find(c=>c.id===id);if(!x)return;
  const ov=makeOv('ixlink-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div>
    <div class="mt" style="margin-bottom:2px">Link “${esc(x.name)}”</div>
    <div class="sheet-sub">Pick the exercise it really is. Its sets move over to that one, and “${esc(x.name)}” is removed.</div>
    <div class="lib-search"><span class="lib-search-ic">${ICON('search',17)}</span><input id="ixlink-q" type="search" placeholder="Search exercises" value="${esc(ixSplitName(x.name).name)}" oninput="ixPickList('ixlink-list',this.value,${jsq(`ixLinkAsk(${jsq(id)},%ID%)`)},${jsq(id)})" autocomplete="off"></div>
    <div id="ixlink-list"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  ixPickList('ixlink-list',ixSplitName(x.name).name,`ixLinkAsk(${jsq(id)},%ID%)`,id);
}
function ixLinkAsk(from,to){
  const a=(S.custom||[]).find(c=>c.id===from);const b=getEx(to);if(!a||!b)return;
  const c=ixLinkCounts(from);
  customConfirm(`Move <b>${c.sets} set${c.sets===1?'':'s'}</b> in ${c.workouts} workout${c.workouts===1?'':'s'}${c.routines?` and ${c.routines} routine${c.routines===1?'':'s'}`:''} from <b>${esc(a.name)}</b> to <b>${esc(b.name)}</b>?<br><br>${esc(a.name)} is removed. Records are worked out again.`,'Link',()=>{
    if(!ixLink(from,to))return;
    closeOv('ixlink-ov');toast(`Linked to ${b.name}`,'green');
    if(document.getElementById('ixdata-ov'))ixPaintData();
    else if(document.getElementById('ixmp-ov')&&window._ix&&window._ix.res)ixResults(window._ix.res);
    render();
  },{title:'Link this exercise?'});
}

// ─── Settings → Your data → Imported data ───
function showImportedData(){
  const ov=makeOv('ixdata-ov');
  document.body.appendChild(ov);attachSwipeDown(ov);
  ixPaintData();
}
function ixPaintData(){
  const ov=document.getElementById('ixdata-ov');if(!ov)return;
  const apps=ixImportedApps();
  const sec=apps.map(app=>{
    const logs=(S.importLog||[]).filter(r=>r.app===app);
    const w=S.workouts.filter(x=>x.src===app).length;const bw=(S.bodyweightLog||[]).filter(b=>b.src===app).length;
    const rt=S.routines.filter(r=>r.src===app).length;const ex=(S.custom||[]).filter(c=>c.src===app&&!c.archived);
    const when=logs.length?`imported ${fmtShort(logs[0].at)}`:'';
    const sub=[w?`${w} workout${w===1?'':'s'}`:'',rt?`${rt} routine${rt===1?'':'s'}`:'',bw?`${bw} weigh-in${bw===1?'':'s'}`:'',when].filter(Boolean).join(' · ');
    return`<div class="sec-h" style="margin-top:14px">${esc(ixAppName(app))}</div><div class="fine" style="margin-bottom:6px">${esc(sub)}</div>
      ${ex.length?`<div class="ix-ql" style="margin-top:10px">New exercises from this import · ${ex.length}</div><div class="fine" style="margin-bottom:6px">Tap one to link it to an exercise already here.</div><div class="list">${ex.slice(0,60).map(ixExRow).join('')}</div>`:''}
      <button class="btn btd bfw" style="margin-top:8px" onclick="ixRemoveAsk(${jsq(app)})">Remove everything from ${esc(ixAppName(app))}</button>`;
  }).join('');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div class="mt">Imported data</div>
    <div class="sheet-sub">What came in from other apps. Imported workouts are marked in History.</div>
    ${sec||'<div class="note-box">Nothing has been imported.</div>'}
    <button class="btn bts bfw" style="margin-top:14px" onclick="closeOv('ixdata-ov');setTimeout(showAppImport,240)">Import from another app</button></div>`;
}
function ixRemoveAsk(app){
  const p=ixRemovalPlan(app);
  const parts=[p.wks.length?`${p.wks.length} workout${p.wks.length===1?'':'s'}`:'',p.rts.length?`${p.rts.length} rebuilt routine${p.rts.length===1?'':'s'}`:'',
    p.exs.length?`${p.exs.length} exercise${p.exs.length===1?'':'s'} it created`:'',p.bw.length?`${p.bw.length} weigh-in${p.bw.length===1?'':'s'}`:'',p.ms.length?`${p.ms.length} day${p.ms.length===1?'':'s'} of measurements`:'',
    p.acts.length?`${p.acts.length} cardio activit${p.acts.length===1?'y':'ies'}`:''].filter(Boolean);
  const keep=[p.rtKeep.length?`${p.rtKeep.length} rebuilt routine${p.rtKeep.length===1?' you have':'s you have'} trained from since, and those workouts`:'','everything you logged in Lah We'].filter(Boolean);
  customConfirm(`This deletes ${parts.length?parts.join(', '):'nothing'}.<br><br>It keeps ${keep.join(', and ')}.<br><br>Today’s daily copy is taken first.`,`Remove ${ixAppName(app)} data`,()=>{
    ixRemove(app).then(()=>{toast(`Removed what came from ${ixAppName(app)}`,'green');ixPaintData();render();}).catch(e=>{logError(e,'remove import');toast('Could not remove it','red');});
  },{title:`Remove the ${ixAppName(app)} import?`});
}
