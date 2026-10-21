// ═══════════════════════════════════════════════════
// BUILDERS — training: a program, a workout for right now, and why a lift has stalled
// ═══════════════════════════════════════════════════
// These answer the Coach tab's most common asks with the app's own data and rules: no AI, no key,
// no tokens. Every choice comes from the exercise list (movement pattern, muscles, equipment), your
// history (what you know, what you swapped to, what hurt), recovery, and the weekly set ranges the
// rest of the app uses. The AI coach is offered only to adjust a finished result.

// ─── Slots: one place in a workout, described by movement ───
// pat: patterns that fill it, best first. mus: the muscle it is for (a curl slot wants biceps, not
// forearms). reg: which part of the body it trains, so an extra slot lands on a day that suits it.
const BLD_SLOTS={
  hpush:{pat:['h-push'],mus:'Chest',reg:'push'},
  ipush:{pat:['incline-push','h-push'],mus:'Chest',reg:'push'},
  vpush:{pat:['v-push'],mus:'Front Delts',reg:'push'},
  fly:{pat:['fly'],mus:'Chest',reg:'push'},
  raise:{pat:['raise'],mus:'Side Delts',reg:'push'},
  tri:{pat:['tri-ext','dip'],mus:'Triceps',reg:'push'},
  hpull:{pat:['h-pull'],mus:'Lats',reg:'pull'},
  vpull:{pat:['v-pull'],mus:'Lats',reg:'pull'},
  rear:{pat:['rear-delt'],mus:'Rear Delts',reg:'pull'},
  curl:{pat:['curl'],mus:'Biceps',reg:'pull'},
  shrug:{pat:['shrug'],mus:'Traps',reg:'pull'},
  forearm:{pat:['curl','carry'],mus:'Forearms',reg:'pull'},
  squat:{pat:['squat'],reg:'lower'},
  lunge:{pat:['lunge'],reg:'lower'},
  hinge:{pat:['hinge'],reg:'lower'},
  hipext:{pat:['hip-ext'],mus:'Glutes',reg:'lower'},
  kext:{pat:['knee-ext'],mus:'Quads',reg:'lower'},
  kflex:{pat:['knee-flex'],mus:'Hamstrings',reg:'lower'},
  calf:{pat:['calf'],mus:'Calves',reg:'lower'},
  lowback:{pat:['back-ext'],mus:'Lower Back',reg:'lower'},
  core:{pat:['core-stab','core-flex','core-rot'],mus:'Abs',reg:'core'},
  oblique:{pat:['core-rot','core-stab'],mus:'Obliques',reg:'core'},
  carry:{pat:['carry'],reg:'cond'},
  cond:{pat:['conditioning','power'],reg:'cond'},
};
// Where an extra set for a muscle goes when its slots are already full.
const BLD_MUSCLE_SLOT={Chest:'fly',Lats:'vpull',Traps:'shrug','Front Delts':'vpush','Side Delts':'raise','Rear Delts':'rear',Biceps:'curl',Triceps:'tri',
  Forearms:'forearm',Quads:'kext',Hamstrings:'kflex',Glutes:'hipext',Calves:'calf',Abs:'core',Obliques:'oblique','Lower Back':'lowback'};
// The muscles a program is expected to cover; the small ones get their work from the big lifts.
const BLD_MAJOR=['Chest','Lats','Side Delts','Rear Delts','Biceps','Triceps','Quads','Hamstrings','Glutes','Calves','Abs'];
// Day templates: '*' main lift, '+' second lift, plain = accessory. Order is the order done.
const BLD_DAYS={
  fullA:{name:'Full Body A',reg:'all',slots:['squat*','hpush*','hpull+','raise','curl','core']},
  fullB:{name:'Full Body B',reg:'all',slots:['hinge*','vpush*','vpull+','lunge','rear','tri']},
  fullC:{name:'Full Body C',reg:'all',slots:['ipush*','hpull*','squat+','kflex','tri','calf']},
  upperA:{name:'Upper A',reg:'push pull core',slots:['hpush*','hpull*','vpush+','vpull+','raise','curl','tri']},
  upperB:{name:'Upper B',reg:'push pull core',slots:['vpull*','ipush*','hpull+','hpush+','raise','tri','curl','rear']},
  lowerA:{name:'Lower A',reg:'lower core',slots:['squat*','hinge+','lunge','kflex','calf','core']},
  lowerB:{name:'Lower B',reg:'lower core',slots:['hinge*','squat+','hipext','kext','calf','core']},
  pushA:{name:'Push A',reg:'push core',slots:['hpush*','vpush+','ipush+','raise','tri','fly']},
  pullA:{name:'Pull A',reg:'pull core',slots:['vpull*','hpull+','hpull','rear','curl','shrug']},
  legsA:{name:'Legs A',reg:'lower core',slots:['squat*','hinge+','lunge','kext','kflex','calf']},
  pushB:{name:'Push B',reg:'push core',slots:['ipush*','hpush+','vpush+','raise','tri','fly']},
  pullB:{name:'Pull B',reg:'pull core',slots:['hpull*','vpull+','rear','curl','curl','core']},
  legsB:{name:'Legs B',reg:'lower core',slots:['hinge*','squat+','hipext','kflex','calf','core']},
};
const BLD_SPLITS={
  2:{label:'Full Body',days:['fullA','fullB']},
  3:{label:'Full Body',days:['fullA','fullB','fullC']},
  4:{label:'Upper/Lower',days:['upperA','lowerA','upperB','lowerB']},
  5:{label:'Upper/Lower + PPL',days:['upperA','lowerA','pushA','pullA','legsA']},
  6:{label:'Push/Pull/Legs',days:['pushA','pullA','legsA','pushB','pullB','legsB']},
};
// How standard a lift is for its slot (0-10; unlisted 3). Someone with no history gets these.
const BLD_STAPLE={
  'bb-bench':10,'db-bench':8,'pushup':6,'mach-chest':5,'smith-bench':4,'cgbp':4,'hrpu':4,'dec-bench':3,
  'inc-db-bench':9,'inc-bench':8,'landmine-press':5,'inc-pushup':3,
  'ohp':10,'db-ohp':9,'arnold':6,'mach-ohp':5,'push-press':5,'kb-press':5,'pike-pu':4,
  'db-fly':7,'cable-fly':8,'pec-deck':7,'chest-dip':6,'tri-dip':5,
  'lat-raise':10,'cable-lat-raise':8,'mach-lat-raise':6,'upright-row':3,'front-raise':2,
  'tri-pd':10,'oh-ext':8,'cable-oh-ext':8,'skull':7,'db-skull':6,'tri-kickback':4,
  'bb-row':9,'cable-row':9,'db-row':9,'chest-sup-row':8,'tbar-row':7,'pendlay-row':6,'mach-row':6,'inverted-row':5,'kb-row':5,
  'pullup':10,'lat-pd':10,'chinup':9,'assist-pullup':6,'straight-arm-pd':4,
  'face-pull':10,'rev-fly':8,'rev-pec-deck':8,
  'db-curl':9,'bb-curl':9,'hammer-curl':9,'cable-curl':8,'ez-curl':8,'inc-db-curl':7,'preacher-curl':7,'conc-curl':5,'reverse-curl':6,'wrist-curl':5,
  'shrug':8,'db-shrug':8,'farmers':8,'suitcase-carry':6,
  'squat':10,'leg-press':9,'front-squat':8,'hack-squat':8,'goblet':8,'smith-squat':5,'kb-goblet':6,'bw-squat':4,'med-squat':2,
  'bss':9,'reverse-lunge':8,'lunge':7,'db-step':7,'pistol-squat':3,
  'rdl':10,'deadlift':10,'hex-dl':8,'sumo-dl':6,'sl-rdl':7,'kb-swing':6,'good-morning':5,'pull-through':5,
  'hip-thrust':10,'glute-bridge':6,'glute-kick':5,'leg-ext':10,'seated-leg-curl':10,'lying-leg-curl':9,'leg-curl':9,'nordic':5,
  'calf-raise':10,'seated-calf':8,'bw-calf':5,'back-ext':8,'superman':3,
  'plank':8,'ab-rollout':8,'cable-crunch':8,'dead-bug':7,'leg-raise':7,'hollow-hold':6,'pallof-press':7,'side-plank':6,'woodchop':6,'russian':5,'crunch':5,
  'sled-push':8,'sled-drag':7,'burpee':7,'mountain-climber':6,'box-jump':6,'med-slam':7,'wall-ball':6,'kb-clean':5,'shuttle-sprint':6,'sdc':6,'thruster':5,'power-clean':5,
};
// Lifts heavy and stable enough to be a session's main lift.
const BLD_MAIN=new Set(['bb-bench','db-bench','inc-bench','inc-db-bench','mach-chest','smith-bench','cgbp','pushup','hrpu','landmine-press',
  'ohp','db-ohp','push-press','mach-ohp','arnold','kb-press','pike-pu',
  'bb-row','cable-row','db-row','chest-sup-row','tbar-row','pendlay-row','mach-row','inverted-row','kb-row',
  'pullup','chinup','lat-pd','assist-pullup',
  'squat','front-squat','leg-press','hack-squat','goblet','smith-squat','kb-goblet','bw-squat','bss','reverse-lunge','db-step','lunge',
  'deadlift','hex-dl','rdl','sumo-dl','sl-rdl','kb-swing','hip-thrust','good-morning']);
// Lifts that suit very low reps. Other main lifts (a goblet squat, a hip thrust) stay at 5-8 or more.
const BLD_HEAVY=new Set(['bb-bench','inc-bench','cgbp','ohp','push-press','squat','front-squat','deadlift','hex-dl','sumo-dl','bb-row','pendlay-row','tbar-row',
  'pullup','chinup','chest-dip','tri-dip','smith-bench','smith-squat','hack-squat','leg-press','rdl','landmine-press']);
// Things to steer around. pats: movement patterns left out; ids: specific lifts; re: names (for your own exercises).
const BLD_AVOID=[
  {id:'knees',label:'Knees',pats:['squat','lunge','knee-ext','power'],ids:['burpee','sprawl','shuttle-sprint','jump-rope','sled-push'],re:/squat|lunge|jump|pistol|step.?up|leg (press|extension)/i},
  {id:'back',label:'Lower back',pats:['hinge','back-ext'],ids:['bb-row','pendlay-row','tbar-row','squat','good-morning','power-clean','thruster','superman'],re:/deadlift|good ?morning|bent.?over|back extension/i},
  {id:'overhead',label:'Overhead pressing',pats:['v-push'],ids:['oh-ext','cable-oh-ext','push-press','thruster','wall-ball'],re:/overhead|military|push press|snatch|jerk/i},
  {id:'shoulders',label:'Shoulders',pats:['v-push','dip'],ids:['upright-row','front-raise','skull'],re:/dip|upright row|behind.?(the)?.?neck/i},
  {id:'impact',label:'Jumping & impact',pats:['power'],ids:['burpee','sprawl','shuttle-sprint','jump-rope','mountain-climber','box-jump'],re:/jump|burpee|sprawl|sprint|plyo/i},
];
// Each pattern's own lift has a reason to be left out when it is the one that hurt.
const BLD_PAIN_AVOID={'squat':'knees','lunge':'knees','knee-ext':'knees','hinge':'back','back-ext':'back','v-push':'overhead','dip':'shoulders'};
// What the Army Fitness Test events need, and how much to favour them for that aim.
const BLD_AFT_BONUS={'hex-dl':30,'hrpu':25,'plank':22,'sdc':25,'farmers':10,'sled-drag':10,'shuttle-sprint':10,'pushup':8};
const BLD_AIMS=[
  {id:'strength',label:'Strength'},{id:'muscle',label:'Build muscle'},{id:'both',label:'Strength + size'},
  {id:'general',label:'General fitness'},{id:'aft',label:'Fitness test'},
];
// Sets × reps and rest by aim and the lift's role. r/x: rep range; s: working sets; rest: seconds.
const BLD_SCHEME={
  strength:{main:{s:4,r:3,x:5,rest:180},second:{s:3,r:5,x:8,rest:150},acc:{s:3,r:8,x:12,rest:75}},
  muscle:{main:{s:3,r:6,x:10,rest:150},second:{s:3,r:8,x:12,rest:120},acc:{s:3,r:10,x:15,rest:75}},
  both:{main:{s:4,r:4,x:6,rest:180},second:{s:3,r:8,x:10,rest:120},acc:{s:3,r:10,x:15,rest:75}},
  general:{main:{s:3,r:6,x:10,rest:120},second:{s:3,r:8,x:12,rest:90},acc:{s:2,r:12,x:15,rest:60}},
  aft:{main:{s:4,r:3,x:5,rest:180},second:{s:3,r:6,x:10,rest:120},acc:{s:3,r:10,x:15,rest:60}},
};
const BLD_MIX=[{id:'familiar',label:'Familiar'},{id:'mix',label:'Mix'},{id:'new',label:'New to me'}];
const BLD_WEEKS=[0,4,6,8,12];

// ─── Small helpers ───
function bldHash(s){let h=2166136261;s=String(s);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function bldAimFromGoal(){
  if(S.testPlan&&S.testPlan.date&&S.testPlan.date>=today())return'aft';
  return{strength:'strength',recomp:'muscle',weightloss:'muscle',general:'general'}[S.goal]||'general';
}
function bldAimLabel(id){return(BLD_AIMS.find(a=>a.id===id)||BLD_AIMS[3]).label;}
function bldEqs(eq){
  if(!eq||eq==='usual')return equipAllowed();
  const p=EQUIPMENT_PRESETS.find(x=>x.id===eq);return p?p.eqs:equipAllowed();
}
function bldAvoidHit(ex,avoid){
  if(!avoid||!avoid.length)return false;
  const p=exPattern(ex);
  return avoid.some(id=>{const a=BLD_AVOID.find(x=>x.id===id);if(!a)return false;
    return(p&&a.pats.includes(p))||a.ids.includes(ex.id)||(!EX_PATTERN[ex.id]&&a.re.test(ex.name||''));});
}
// Avoid choices suggested by pain tags on recent sessions.
function bldPainAvoid(){
  const out=new Set();
  new Set(S.workouts.slice(0,10).flatMap(w=>w.exercises.map(e=>e.exId))).forEach(id=>{
    if(!getExPainLevel(id))return;const ex=getEx(id);const a=ex?BLD_PAIN_AVOID[exPattern(ex)]:null;if(a)out.add(a);});
  return[...out];
}
function bldPrimary(ex){return ex?normMuscle(ex.muscle||'')||null:null;}
function bldTimedEx(ex){return HOLD_EX.has(ex.id)||/plank|hold|carry|hang\b/i.test(ex.name||'');}
// How well you know a lift: 0 = never done.
function bldFam(id){
  const u=exUsage()[id];if(!u)return{pts:0,n:0};
  let pts=12+Math.min(14,5*Math.log2(1+u.n));if(Date.now()-u.last<42*86400000)pts+=4;
  let picked=0;const sl=S.swapLog||{};Object.keys(sl).forEach(k=>{picked+=Math.max(0,parseInt((sl[k]||{})[id])||0);});
  pts+=6*Math.min(3,picked);
  return{pts,n:u.n};
}
function bldHistoryCount(){return Object.keys(exUsage()).length;}
// Everything that may go into a workout under these answers.
function bldPool(a){
  const eqs=bldEqs(a.eq);
  return allEx().filter(ex=>{
    if(ex.archived||ex.kind==='cardio')return false;
    if(eqs&&!eqs.includes(ex.eq))return false;
    if(bldAvoidHit(ex,a.avoid))return false;
    if(getExPainLevel(ex.id)>=2)return false;
    return !!(exPattern(ex)||bldPrimary(ex));
  });
}

// ─── Choosing a lift for a slot ───
// ctx: {pool, a, used:Set (whole program), day:Set (this day), accN (accessories so far), seed}
function bldScore(c,slot,role,ctx){
  const cp=exPattern(c),cm=bldPrimary(c);
  // How well it fits comes first: a familiar lift from a nearby pattern never beats one that is
  // exactly the movement asked for. Familiarity, how standard it is and variety decide within a tier.
  const i=slot.pat.indexOf(cp);
  let s;
  if(i===0)s=100;else if(i>0)s=80;
  else if(slot.pat.some(p=>(PATTERN_NEAR[p]||[]).includes(cp)))s=40;
  else if(slot.mus&&cm===slot.mus)s=20;
  else return null;
  if(slot.mus&&cm&&cm!==slot.mus)s-=25;
  s+=2.2*(BLD_STAPLE[c.id]!=null?BLD_STAPLE[c.id]:3);
  if(role==='main'&&!BLD_MAIN.has(c.id))s-=40;
  if(role==='main'&&c.eq==='Bodyweight'&&c.load!=='added'&&(!ctx.eqs||ctx.eqs.some(e=>e!=='Bodyweight')))s-=10;
  if(getExPainLevel(c.id)===1)s-=25;
  if(ctx.used.has(c.id))s-=25;
  if(ctx.a.aim==='aft'&&BLD_AFT_BONUS[c.id])s+=BLD_AFT_BONUS[c.id];
  const f=bldFam(c.id);const fresh=f.n===0;
  const mix=ctx.a.mix||'mix';
  const wantNew=mix==='new'||(mix==='mix'&&role==='acc'&&ctx.accN%2===1);
  if(wantNew)s+=fresh?20:f.pts*0.1;
  else s+=fresh?-8:f.pts*0.6;
  if(ctx.seed)s+=(bldHash(ctx.seed+'|'+c.id+'|'+slot.key)%100)/100*14;
  return s;
}
function bldPick(slotKey,role,ctx){
  const slot=Object.assign({key:slotKey},BLD_SLOTS[slotKey]);
  let best=null;
  ctx.pool.forEach(c=>{
    if(ctx.day.has(c.id))return;
    const s=bldScore(c,slot,role,ctx);if(s==null)return;
    if(!best||s>best.s||(s===best.s&&c.id<best.c.id))best={c,s};
  });
  return best?best.c:null;
}
function bldWhy(id,pinned){
  if(pinned)return'You asked for this one';
  const u=exUsage()[id];
  if(!u)return'New to you';
  const t=u.top;const w=parseFloat(t.w)||0;
  return`Done ${u.n}×, last ${u.timed?`${t.r||'?'}s`:w?`${fmt1(w)} ${S.unit} × ${t.r||'?'}`:`${t.r||'?'} reps`}`;
}
// A lift's sets, reps and rest for its role under an aim.
function bldEntry(ex,role,aim,slotKey,opts){
  opts=opts||{};
  const sc=(BLD_SCHEME[aim]||BLD_SCHEME.general)[role];
  const e={exId:ex.id,name:ex.name,role,slot:slotKey||null,sets:sc.s,r:sc.r,x:sc.x,rest:sc.rest,timed:false,amrap:false,dist:false};
  const p=exPattern(ex);
  if(DIST_EX.has(ex.id)){e.dist=true;e.r=20;e.x=0;e.rest=90;}
  else if(bldTimedEx(ex)){e.timed=true;e.r=30;e.x=45;e.rest=60;}
  else if(p==='core-flex'||p==='core-rot'){e.r=12;e.x=20;e.rest=45;}
  else if(p==='calf'){e.r=aim==='strength'?8:10;e.x=aim==='strength'?12:15;}
  else if(p==='power'||p==='conditioning'){e.r=8;e.x=12;e.rest=90;}
  else if(ex.eq==='Bodyweight'&&ex.load!=='added'){e.r=Math.max(8,e.r);e.x=Math.max(15,e.x);if(role==='acc'){e.r=12;e.x=20;}}
  else if(e.r<5&&!BLD_HEAVY.has(ex.id)){e.r=5;e.x=8;}
  if(aim==='aft'&&ex.id==='hrpu'&&role!=='main'){e.amrap=true;e.x=0;e.r=10;}
  if(opts.quick){e.rest=role==='main'?(opts.minutes<=30?90:120):role==='second'?90:60;if(e.timed)e.rest=45;}
  return e;
}
// Minutes a list takes, as the coach's estimate counts them, except that lifts sharing a superset
// label are done back to back: one rest per round instead of one per lift.
function bldEstMin(list){
  let sec=180;
  for(let i=0;i<list.length;){
    const g=[list[i]];let j=i+1;
    if(list[i].link)while(j<list.length&&list[j].link===list[i].link)g.push(list[j++]);
    const rounds=Math.max(...g.map(e=>e.sets||0));
    const work=g.reduce((t,e)=>t+(e.timed?(parseInt(e.r)||30):e.dist?30:40),0);
    const rest=Math.max(...g.map(e=>e.rest!=null?e.rest:(S.restDur||90)));
    sec+=rounds*(work+rest+(g.length>1?15*(g.length-1):0))+45*g.length;
    i=j;
  }
  return Math.round(sec/60);
}
// Pair a day's accessories into supersets (different muscles, so neither tires the other).
function bldSuperset(d){
  const free=d.ex.filter(e=>e.role==='acc'&&!e.link&&!e.dist);if(free.length<2)return false;
  const used=new Set(d.ex.map(e=>e.link).filter(Boolean));const label=['A','B','C','D','E'].find(l=>!used.has(l));if(!label)return false;
  const a=free[0];const b=free.slice(1).find(e=>bldPrimary(getEx(e.exId))!==bldPrimary(getEx(a.exId)));if(!b)return false;
  // Move the partner next to the first one, so the pair is done together.
  d.ex.splice(d.ex.indexOf(b),1);d.ex.splice(d.ex.indexOf(a)+1,0,b);
  a.link=b.link=label;a.rest=b.rest=Math.max(a.rest,b.rest,60);
  return true;
}
function bldWeekly(days){
  const m={};Object.keys(MEV_MAV).forEach(k=>{m[k]=0;});
  days.forEach(d=>d.ex.forEach(e=>muscleContribs(e.exId).forEach(c=>{if(m[c.muscle]!=null)m[c.muscle]+=e.sets*c.w;})));
  Object.keys(m).forEach(k=>{m[k]=r1(m[k]);});
  return m;
}
function bldTarget(m,emph){const r=MEV_MAV[m];return emph?r.mev+0.7*(r.mav-r.mev):r.mev+0.3*(r.mav-r.mev);}
function bldRegOk(dayReg,slotReg){return dayReg==='all'||slotReg==='core'||String(dayReg).split(' ').includes(slotReg);}

// ─── A program ───
// a: {days 2-6, minutes, aim, emph:[muscles], avoid:[ids], keep:[exIds], mix, weeks, deload, eq, seed}
function bldProgram(a){
  a=Object.assign({days:4,minutes:60,aim:bldAimFromGoal(),emph:[],avoid:[],keep:[],mix:'mix',weeks:8,deload:true,eq:'usual',seed:0},a||{});
  a.days=Math.min(6,Math.max(2,parseInt(a.days)||4));a.minutes=Math.min(120,Math.max(20,parseInt(a.minutes)||60));
  const split=BLD_SPLITS[a.days];const pool=bldPool(a);
  const ctx={pool,a,used:new Set(),day:null,accN:0,seed:a.seed,eqs:bldEqs(a.eq)};
  const notes=[];
  const days=split.days.map(k=>{const t=BLD_DAYS[k];return{key:k,name:t.name,reg:t.reg,slots:t.slots.map(s=>({key:s.replace(/[*+]$/,''),role:s.endsWith('*')?'main':s.endsWith('+')?'second':'acc',ex:null})),ex:[]};});
  if(a.aim==='aft'){
    // The test's carry and sprint work, once a week each, on the days with the most room.
    const lowerish=days.filter(d=>/lower|all/.test(d.reg));const pick=lowerish.length?lowerish:days;
    pick[0].slots.push({key:'carry',role:'acc',ex:null,keep:true});(pick[1]||pick[0]).slots.push({key:'cond',role:'acc',ex:null,keep:true});
    notes.push('Runs are not part of these workouts: plan two or three a week for the two-mile run and log them as activities.');
  }
  // Pinned lifts take the first slot that fits them; otherwise they are added where they belong.
  const keep=[...new Set((a.keep||[]).map(String))].map(getEx).filter(Boolean).slice(0,8);
  keep.forEach(ex=>{
    const p=exPattern(ex);let placed=false;
    for(const d of days){
      const s=d.slots.find(x=>!x.ex&&BLD_SLOTS[x.key].pat.includes(p)&&(x.role!=='main'||BLD_MAIN.has(ex.id)));
      if(s&&!d.slots.some(x=>x.ex&&x.ex.id===ex.id)){s.ex=ex;s.pinned=true;placed=true;break;}
    }
    if(!placed){
      const reg=(BLD_SLOTS[BLD_MUSCLE_SLOT[bldPrimary(ex)]]||{}).reg||'core';
      const d=days.filter(x=>bldRegOk(x.reg,reg)).sort((x,y)=>x.slots.length-y.slots.length)[0]||days[0];
      d.slots.push({key:BLD_MUSCLE_SLOT[bldPrimary(ex)]||'core',role:'acc',ex,pinned:true});
    }
    ctx.used.add(ex.id);
  });
  const missing=[];
  days.forEach(d=>{
    ctx.day=new Set(d.slots.filter(s=>s.ex).map(s=>s.ex.id));
    d.slots.forEach(s=>{
      if(!s.ex){s.ex=bldPick(s.key,s.role,ctx);if(!s.ex){missing.push(s.key);return;}}
      ctx.day.add(s.ex.id);ctx.used.add(s.ex.id);
      if(s.role==='acc')ctx.accN++;
    });
    d.ex=d.slots.filter(s=>s.ex).map(s=>Object.assign(bldEntry(s.ex,s.role,a.aim,s.key),{pinned:!!s.pinned,keep:!!(s.pinned||s.keep),why:bldWhy(s.ex.id,s.pinned)}));
  });
  // Short sessions rest less: with 30-45 minutes, long rests leave no time for anything but the main lifts.
  if(a.minutes<=45){const cap={main:a.minutes<=30?120:150,second:90,acc:60};days.forEach(d=>d.ex.forEach(e=>{e.rest=Math.min(e.rest,cap[e.role]);}));}
  if(missing.length)notes.push(`Nothing in your exercise list fits ${[...new Set(missing)].map(k=>BLD_SLOT_NAME[k]||k).join(', ')} with this equipment and what you asked to avoid, so ${missing.length===1?'that place was':'those places were'} left out.`);
  bldBalance(days,a,ctx);
  bldFitTime(days,a);
  const weekly=bldWeekly(days);
  const short=[...new Set([...BLD_MAJOR,...(a.emph||[])])].filter(m=>MEV_MAV[m]&&weekly[m]<MEV_MAV[m].mev);
  if(short.length>4)notes.push(`${a.days} sessions of ${a.minutes} minutes cannot reach the weekly minimum for most muscles, so this keeps the big lifts and the muscles you asked for. ${a.minutes<60?'Longer sessions':'Another day'} would cover the rest.`);
  else if(short.length)notes.push(`Under the weekly minimum: ${short.map(m=>`${m.toLowerCase()} ${fmtSets(weekly[m])} of ${MEV_MAV[m].mev} sets`).join(', ')}. ${a.minutes<75?'Longer sessions or another day would fix it.':'Another training day would fix it.'}`);
  if(bldHistoryCount()<5&&a.mix!=='new')notes.push('You have little history yet, so these are standard lifts. As you log, the builder leans on the ones you do.');
  return{a,split:split.label,days:days.map(d=>({key:d.key,name:d.name,ex:d.ex,min:bldEstMin(d.ex)})),weekly,notes};
}
const BLD_SLOT_NAME={hpush:'a chest press',ipush:'an incline press',vpush:'an overhead press',fly:'a fly',raise:'a lateral raise',tri:'a triceps lift',hpull:'a row',vpull:'a pull-up or pulldown',
  rear:'a rear-delt lift',curl:'a curl',shrug:'a shrug',forearm:'forearm work',squat:'a squat',lunge:'a lunge',hinge:'a hinge',hipext:'a glute lift',kext:'a leg extension',kflex:'a leg curl',
  calf:'a calf raise',lowback:'lower-back work',core:'core work',oblique:'oblique work',carry:'a carry',cond:'conditioning'};
// Push each muscle toward its weekly target: more sets where a slot exists, an extra slot if not,
// fewer where a muscle that was not asked for is over its ceiling.
function bldBalance(days,a,ctx){
  const emph=new Set(a.emph||[]);const added={};const stuck=new Set();
  for(let it=0;it<30;it++){
    const w=bldWeekly(days);
    const need=[...new Set([...BLD_MAJOR,...emph])].map(m=>({m,gap:bldTarget(m,emph.has(m))-w[m],emph:emph.has(m)}))
      .filter(x=>!stuck.has(x.m)&&x.gap>=1&&(x.emph||w[x.m]<MEV_MAV[x.m].mev)).sort((x,y)=>(y.emph-x.emph)||(y.gap/MEV_MAV[y.m].mav-x.gap/MEV_MAV[x.m].mav));
    if(!need.length)break;
    const m=need[0].m;const cap=emph.has(m)?5:4;
    let done=false;
    for(const d of days){const e=d.ex.find(x=>x.role!=='main'&&bldPrimary(getEx(x.exId))===m&&x.sets<cap&&!x.timed);if(e){e.sets++;done=true;break;}}
    if(done)continue;
    if((added[m]||0)>=2){stuck.add(m);continue;}
    const sk=BLD_MUSCLE_SLOT[m];const reg=BLD_SLOTS[sk].reg;
    const cand=days.filter(d=>bldRegOk(BLD_DAYS[d.key].reg,reg)).sort((x,y)=>bldEstMin(x.ex)-bldEstMin(y.ex));
    let ok=false;
    for(const d of cand){
      ctx.day=new Set(d.ex.map(e=>e.exId));const ex=bldPick(sk,'acc',ctx);if(!ex)continue;
      ctx.used.add(ex.id);ctx.accN++;d.ex.push(Object.assign(bldEntry(ex,'acc',a.aim,sk),{why:bldWhy(ex.id),added:m}));ok=true;break;
    }
    added[m]=(added[m]||0)+1;
    if(!ok)stuck.add(m);
  }
  const w=bldWeekly(days);
  Object.keys(w).forEach(m=>{
    if(emph.has(m)||w[m]<=MEV_MAV[m].mav)return;
    days.forEach(d=>d.ex.forEach(e=>{if(e.role==='acc'&&!e.pinned&&bldPrimary(getEx(e.exId))===m&&e.sets>2&&bldWeekly(days)[m]>MEV_MAV[m].mav)e.sets--;}));
  });
}
// Make every day fit the time given. Cuts, in order: extra accessory sets, accessories whose muscle
// stays at its weekly minimum without them (most surplus first), accessories and second lifts down
// to two sets, main lifts down to three, then accessories even if a muscle drops short — the ones
// for muscles you asked for last. Pinned lifts and the fitness test's events are never cut.
function bldFitTime(days,a){
  const emph=new Set(a.emph||[]);const lim=a.minutes+2;
  const mOf=e=>bldPrimary(getEx(e.exId));const isEmph=e=>emph.has(mOf(e));
  const surplus=e=>{const m=mOf(e);if(!m||!MEV_MAV[m])return 99;return bldWeekly(days)[m]-e.sets-MEV_MAV[m].mev;};
  const removable=(d,pred)=>d.ex.map((e,i)=>({e,i})).filter(x=>x.e.role==='acc'&&!x.e.keep&&pred(x.e));
  days.forEach(d=>{
    const over=()=>bldEstMin(d.ex)>lim;
    const dropOne=pred=>{const c=removable(d,pred).sort((x,y)=>surplus(y.e)-surplus(x.e))[0];if(!c)return false;d.ex.splice(c.i,1);return true;};
    const trim=(role,min,pred)=>{const e=d.ex.filter(x=>x.role===role&&x.sets>min&&!x.timed&&pred(x)).pop();if(!e)return false;e.sets--;return true;};
    const steps=[
      ()=>trim('acc',3,e=>!isEmph(e)),
      ()=>bldSuperset(d),
      ()=>dropOne(e=>!isEmph(e)&&surplus(e)>=0),
      ()=>trim('acc',2,e=>!isEmph(e)),
      ()=>trim('second',2,e=>!isEmph(e)),
      ()=>trim('main',3,()=>true),
      ()=>dropOne(e=>!isEmph(e)),
      ()=>trim('acc',2,()=>true),
      // A two-set second lift for a muscle you did not ask for goes before work you did ask for.
      ()=>{const c=d.ex.map((e,i)=>({e,i})).filter(x=>x.e.role==='second'&&!x.e.keep&&!isEmph(x.e)).sort((x,y)=>surplus(y.e)-surplus(x.e))[0];if(!c||!emph.size)return false;d.ex.splice(c.i,1);return true;},
      ()=>trim('second',2,()=>true),
      ()=>dropOne(()=>true),
      ()=>{const i=d.ex.map((e,i)=>({e,i})).filter(x=>x.e.role==='second'&&!x.e.keep).pop();if(!i)return false;d.ex.splice(i.i,1);return true;},
      ()=>trim('main',2,()=>true),
    ];
    for(const st of steps){while(over()&&st());}
    bldTidyLinks(d);
  });
}
// After cuts: a superset left with one lift is no superset, and labels run A, B… in order.
function bldTidyLinks(d){
  const n={};d.ex.forEach(e=>{if(e.link)n[e.link]=(n[e.link]||0)+1;});
  d.ex.forEach(e=>{if(e.link&&n[e.link]<2)delete e.link;});
  const map={};let k=0;d.ex.forEach(e=>{if(!e.link)return;if(!map[e.link])map[e.link]='ABCDEFGH'[k++];e.link=map[e.link];});
}
// The program in the import format, so saving it goes through the same checks as any import.
function bldProgramImport(p,nameOver){
  const base=nameOver||bldUniqueName(p.split);
  const exOut=e=>{const o={exId:e.exId,name:e.name,sets:e.sets,rest:e.rest};
    if(e.dist)o.reps=`${e.r} m`;else{o.repsMin=e.r;if(e.x)o.repsMax=e.x;}
    if(e.timed)o.timed=true;if(e.amrap)o.amrap=true;if(e.link)o.link=e.link;return o;};
  const g={name:base,mode:'rotation',weeks:p.a.weeks||0,daysPerWeek:p.days.length,deload_last_week:!!(p.a.weeks&&p.a.deload),
    routines:p.days.map(d=>({name:`${base} - ${d.name}`,notes:'',exercises:d.ex.map(exOut)}))};
  const imp={groups:[g]};
  if(p.a.weeks)imp.program_name=`${bldAimLabel(p.a.aim)} · ${p.split}`;
  return aiToImport(imp);
}
function bldUniqueName(base){
  const taken=new Set([...(S.groups||[]).map(g=>String(g.name).toLowerCase()),...(S.routines||[]).map(r=>String(r.name).toLowerCase().split(' - ')[0])]);
  if(!taken.has(base.toLowerCase()))return base;
  for(let i=2;i<50;i++){const n=`${base} ${i}`;if(!taken.has(n.toLowerCase()))return n;}
  return`${base} ${uid().slice(-3)}`;
}
// Swap one lift in a draft for another (the review screen). Keeps sets and reps when the role is the same.
function bldReplace(p,di,ei,exId){
  const d=p.days[di];const e=d&&d.ex[ei];const ex=getEx(exId);if(!e||!ex)return false;
  const ne=Object.assign(bldEntry(ex,e.role,p.a.aim,e.slot),{why:bldWhy(ex.id,true).replace('You asked for this one','Your pick'),picked:true});
  if(!ne.timed&&!e.timed&&!ne.dist&&!e.dist){ne.sets=e.sets;}
  d.ex[ei]=ne;d.min=bldEstMin(d.ex);p.weekly=bldWeekly(p.days);
  return true;
}
// Ranked replacements for one lift in a draft: the swap list's ranking, inside the draft's limits.
function bldSwapList(p,di,ei){
  const d=p.days[di];const e=d&&d.ex[ei];if(!e)return[];
  const pool=new Set(bldPool(p.a).map(x=>x.id));const inDay=new Set(d.ex.map(x=>x.exId));
  return swapCandidates(e.exId,{anyEq:true}).filter(c=>pool.has(c.ex.id)&&!inDay.has(c.ex.id)).slice(0,12);
}

// ─── A workout for right now ───
const BLD_QUICK={
  full:{label:'Full body',slots:['squat*','hpush*','hpull+','hinge+','core'],key:['Quads','Chest','Lats','Hamstrings']},
  upper:{label:'Upper body',slots:['hpush*','hpull*','vpush+','vpull+','raise','curl','tri'],key:['Chest','Lats','Side Delts','Triceps','Biceps']},
  lower:{label:'Lower body',slots:['squat*','hinge+','lunge','kflex','calf','core'],key:['Quads','Hamstrings','Glutes','Calves']},
  push:{label:'Push',slots:['hpush*','vpush+','ipush','raise','tri','fly'],key:['Chest','Front Delts','Side Delts','Triceps']},
  pull:{label:'Pull',slots:['vpull*','hpull+','rear','curl','hpull','shrug'],key:['Lats','Rear Delts','Biceps','Traps']},
  core:{label:'Core',slots:['core','oblique','core','core'],key:['Abs','Obliques']},
  cond:{label:'Conditioning',slots:['cond','cond','carry','cond'],key:[]},
};
const BLD_QUICK_FOCUS=[{id:'auto',label:'You pick'},...Object.keys(BLD_QUICK).map(k=>({id:k,label:BLD_QUICK[k].label}))];
// The body part that is most ready and most behind this week. → {focus, why}
function bldQuickAuto(){
  if(!S.workouts.length)return{focus:'full',why:'No workouts logged yet, so a full-body session.'};
  const rec=recoveryState();const wk=muscleSetsInRange(Date.now()-7*86400000,Date.now()+1);
  let best=null;
  ['full','upper','lower','push','pull'].forEach(k=>{
    const key=BLD_QUICK[k].key;
    const fresh=key.reduce((t,m)=>t+rec[m].fresh,0)/key.length;
    const tired=key.filter(m=>rec[m].fresh<50);
    const behind=key.reduce((t,m)=>t+Math.max(0,MEV_MAV[m].mev-wk[m])/MEV_MAV[m].mev,0)/key.length;
    const s=fresh+behind*30-tired.length*25+(k==='full'?-4:0);
    if(!best||s>best.s)best={k,s,fresh,behind,tired};
  });
  const k=best.k;
  const low=BLD_QUICK[k].key.filter(m=>wk[m]<MEV_MAV[m].mev).slice(0,2);
  const why=`${BLD_QUICK[k].label}: ${best.tired.length?'the freshest option':'recovered'} (${Math.round(best.fresh)}% on average)`+
    (low.length?`, and ${low.map(m=>`${m.toLowerCase()} ${fmtSets(wk[m])} of ${MEV_MAV[m].mev}+ sets`).join(', ')} this week.`:'.');
  return{focus:k,why};
}
// a: {minutes, focus:[ids], eq, mix, seed}
function bldQuick(a){
  a=Object.assign({minutes:30,focus:['auto'],eq:'usual',mix:'familiar',seed:0},a||{});
  a.minutes=Math.min(90,Math.max(10,parseInt(a.minutes)||30));
  let focus=(Array.isArray(a.focus)?a.focus:[a.focus]).filter(f=>f==='auto'||BLD_QUICK[f]);if(!focus.length)focus=['auto'];
  let why='';
  if(focus.includes('auto')){const q=bldQuickAuto();focus=[...new Set([q.focus,...focus.filter(f=>f!=='auto')])];why=q.why;}
  const aim=bldAimFromGoal()==='aft'?'general':bldAimFromGoal();
  const ctx={pool:bldPool(a),a:Object.assign({},a,{aim}),used:new Set(),day:new Set(),accN:0,seed:a.seed,eqs:bldEqs(a.eq)};
  const rec=recoveryState();
  // Mains of every chosen focus first, then their seconds, then accessories in turn; conditioning last as a circuit.
  const lift=focus.filter(f=>f!=='cond'),cond=focus.includes('cond');
  const queue=[];
  ['main','second','acc'].forEach(role=>{
    const lists=lift.map(f=>BLD_QUICK[f].slots.map(s=>({key:s.replace(/[*+]$/,''),role:s.endsWith('*')?'main':s.endsWith('+')?'second':'acc'})).filter(s=>s.role===role));
    for(let i=0;lists.some(l=>l[i]);i++)lists.forEach(l=>{if(l[i])queue.push(l[i]);});
  });
  const ex=[];const warn=[];const tired=new Set();
  const room=lift.length?a.minutes-(cond?8:0):0;
  for(const s of queue){
    if(ex.length>=3&&bldEstMin(ex)>=room-3)break;
    const c=bldPick(s.key,s.role,ctx);if(!c)continue;
    const m=bldPrimary(c);if(m&&rec[m]&&rec[m].fresh<50)tired.add(m);
    const e=Object.assign(bldEntry(c,s.role,aim,s.key,{quick:true,minutes:a.minutes}),{why:bldWhy(c.id)});
    if(a.minutes<=20&&e.role!=='main')e.sets=2;
    const trial=ex.concat([e]);
    if(ex.length>=3&&bldEstMin(trial)>room+2)continue;
    ex.push(e);ctx.day.add(c.id);ctx.used.add(c.id);if(e.role==='acc')ctx.accN++;
  }
  if(cond){
    const n=lift.length?3:5;const left=lift.length?Math.max(6,a.minutes-bldEstMin(ex)):a.minutes;
    const circuit=[];
    for(const s of BLD_QUICK.cond.slots.concat(['core','cond']).slice(0,n)){const c=bldPick(s,'acc',ctx);if(!c)continue;ctx.day.add(c.id);
      const e=Object.assign(bldEntry(c,'acc',aim,s),{why:bldWhy(c.id)});e.timed=!DIST_EX.has(c.id);e.dist=DIST_EX.has(c.id);e.r=e.dist?20:30;e.x=0;e.rest=e.dist?45:20;e.link='A';circuit.push(e);}
    // Rounds of the circuit that fit what is left.
    const per=circuit.reduce((t,e)=>t+(e.dist?45:30)+e.rest+10,0)||1;
    const rounds=Math.max(2,Math.min(6,Math.floor(left*60/per)));circuit.forEach(e=>{e.sets=rounds;});
    ex.push(...circuit);
  }
  if(tired.size)warn.push(`Still recovering: ${[...tired].join(', ')}. Go lighter there, or swap.`);
  const name=focus.map(f=>BLD_QUICK[f].label).join(' + ');
  return{a,name:`${a.minutes}-min ${name}`,why,ex,min:bldEstMin(ex),warn};
}
function bldQuickImport(q){
  const ex=q.ex.map(e=>{const o={exId:e.exId,name:e.name,sets:e.sets,rest:e.rest};if(e.dist)o.reps=`${e.r} m`;else{o.repsMin=e.r;if(e.x)o.repsMax=e.x;}
    if(e.timed)o.timed=true;if(e.amrap)o.amrap=true;if(e.link)o.link=e.link;return o;});
  return aiToImport({routines:[{name:q.name,notes:'',exercises:ex}]});
}

// ─── Why a lift has stalled ───
const BLD_STALL_WIN=42; // days: a lift must have been done this recently to count
function bldStalled(){
  const since=Date.now()-BLD_STALL_WIN*86400000;
  const out=[],moving=[];
  getExsWithHist().forEach(id=>{
    const ex=getEx(id);if(!ex||ex.archived)return;
    const h=getExStrData(id);if(h.length<4)return;
    const last=h[h.length-1];if(new Date(last.date).getTime()<since)return;
    const l3=h.slice(-3).map(x=>x.e1rm),before=h.slice(0,-3).map(x=>x.e1rm);
    const best=Math.max(...h.map(x=>x.e1rm));const prevBest=before.length?Math.max(...before):0;
    const flat=Math.max(...l3)-Math.min(...l3)<=Math.max(1,best*0.01)&&Math.max(...l3)<=prevBest+Math.max(1,best*0.005);
    const a2=(h[h.length-1].e1rm+h[h.length-2].e1rm)/2,b2=(h[h.length-3].e1rm+h[h.length-4].e1rm)/2;
    const down=b2>0&&a2<b2*0.97;
    const first=h.find(x=>new Date(x.date).getTime()>=since)||h[0];
    const pct=first.e1rm>0?Math.round((last.e1rm/first.e1rm-1)*1000)/10:0;
    if(flat||down)out.push({exId:id,name:ex.name,h,down,flat,best,now:last.e1rm,sessions:h.length});
    else if(pct>0)moving.push({exId:id,name:ex.name,pct});
  });
  moving.sort((x,y)=>y.pct-x.pct);
  // Main lifts first (they matter most and are the ones people ask about), then the most practised.
  return{stalled:out.sort((x,y)=>(BLD_MAIN.has(y.exId)-BLD_MAIN.has(x.exId))||(y.sessions-x.sessions)).slice(0,6),moving:moving.slice(0,4),enough:getExsWithHist().filter(id=>getExStrData(id).length>=4).length};
}
function bldRoutinesWith(exId){return(S.routines||[]).filter(r=>r.active!==false&&r.exercises.some(e=>e.exId===exId));}
// Everything in the log that could explain one stalled lift. → {findings:[{tone,t,s}], fixes:[ids]}
// body: the findings that apply to every lift (bldBodyFindings), so a lift is not called unexplained when they are the reason.
function bldDiagnose(st,body){
  const id=st.exId;const ex=getEx(id);const m=bldPrimary(ex);const F=[];const fix=new Set();
  const add=(tone,t,s,f)=>{F.push({tone,t,s:s||''});(f||[]).forEach(x=>fix.add(x));};
  const sess=exSessions(id,3);
  const pain=getExPainLevel(id);
  if(pain)add('bad',`Pain tagged in ${pain} of the last 3 sessions`,'Progress stops when a lift hurts. Swap it or go lighter until it does not.',['swap','backoff']);
  // Sets short of the plan, and sets with nothing left.
  const rts=bldRoutinesWith(id);const plan=rts.length?rts[0].exercises.find(e=>e.exId===id):null;const lo=plan?parseInt(plan.r)||0:0;
  let sets=0,short=0,spent=0;
  sess.forEach(w=>w.exercises.filter(e=>e.exId===id).forEach(e=>e.sets.filter(setCounts).forEach(s=>{sets++;
    if(lo&&!e.timed&&(parseInt(s.r)||0)<lo)short++;
    if(s.fail||(s.rir!=null&&s.rir!==''&&parseInt(s.rir)===0))spent++;})));
  if(lo&&sets&&short/sets>=1/3)add('warn',`${short} of ${sets} sets came up short of ${lo} reps`,'The weight has got ahead of you. A short back-off and building up again usually restarts it.',['backoff']);
  if(sets>=4&&spent/sets>=0.5)add('warn',`${spent} of ${sets} sets ended at failure`,'Grinding every set piles up fatigue faster than strength. Leave a rep or two in the tank.',['backoff']);
  // The same top set three times with every set done: nobody tried for more.
  const tops=st.h.slice(-3);
  if(tops.length===3&&tops.every(x=>x.w===tops[0].w&&x.r===tops[0].r)&&!short)add('info',`${fmt1(tops[0].w)} ${S.unit} × ${tops[0].r} three sessions running`,'Every set was done, so the next step is more weight or a rep, not a fix. Follow the aim on Targets.',[]);
  // Weekly hard sets for the muscle it trains, over four weeks.
  if(m&&MEV_MAV[m]){
    const now=Date.now();let tot=0;for(let i=0;i<4;i++)tot+=(muscleSetsInRange(now-(i+1)*7*86400000,now-i*7*86400000+(i===0?1:0))[m]||0);
    const avg=r1(tot/4);const r=MEV_MAV[m];
    if(avg<r.mev)add('warn',`${m}: ${fmtSets(avg)} hard sets a week`,`Under the ${r.mev} or so that usually keeps it growing. One more set in each session that trains it would get there.`,['addset']);
    else if(avg>r.mav)add('warn',`${m}: ${fmtSets(avg)} hard sets a week`,`Above the ${r.mav} most people recover from. Doing less can let it move again.`,['dropset']);
  }
  const n6=getExStrData(id).filter(x=>new Date(x.date).getTime()>=Date.now()-42*86400000).length;
  if(n6<4)add('info',`Done ${n6} time${n6===1?'':'s'} in 6 weeks`,'A lift practised once a week or more improves faster.',[]);
  // How long the same lift has been run.
  const h=getExStrData(id);const weeks=Math.round((Date.now()-new Date(h[0].date).getTime())/(7*86400000));
  if(weeks>=12)add('info',`Same lift for ${weeks} weeks`,'A close variation for a few weeks often gets progress going again.',['swap']);
  try{patForLift(id).slice(0,2).forEach(r=>add('info',r.t,'Found in your own log by Patterns.',[]));}catch(e){}
  if(!F.some(f=>f.tone!=='info')&&!(body&&body.length))add('info','Nothing in your log explains it','A planned back-off often restarts progress: about 10% lighter, then build back up.',['backoff']);
  return{findings:F,fixes:rts.length?[...fix]:[]};
}
// What holds back every lift at once: food, protein and sleep, when enough is logged to say.
function bldBodyFindings(){
  const F=[];const add=(tone,t,s)=>F.push({tone,t,s});
  let food=0,kcal=0,prot=0;for(let i=1;i<=28;i++){const t=getDayTotals(daysAgoStr(i));if(t.cals>0){food++;kcal+=t.cals;prot+=t.protein;}}
  if(food>=10){
    const avgK=Math.round(kcal/food),avgP=Math.round(prot/food);const mb=maintenanceBest();
    if(mb&&mb.kcal){
      const gap=avgK-mb.kcal;
      if(gap<-250&&S.weightGoalDir!=='lose')add('warn',`Eating about ${Math.abs(Math.round(gap/10)*10).toLocaleString()} kcal under maintenance`,`${avgK.toLocaleString()} a day on ${food} logged days against about ${mb.kcal.toLocaleString()}${mb.src==='logs'?', worked out from your own log':' (a formula estimate until more is logged)'}. Strength is hard to add in a deficit.`);
      else if(gap<-250)add('info','You are eating in a deficit','On a cut, holding strength is the win. Expect slow progress until you eat at maintenance.');
    }
    const perLb=avgP/(isKg()?bwUser()*2.2046:bwUser());
    if(perLb<0.7)add('warn',`Protein ${avgP} g a day`,`About ${(Math.round(perLb*100)/100).toFixed(2)} g per lb of body weight over ${food} logged days. Most lifters do better at 0.7–1.0.`);
  }
  const sl=[];for(let i=1;i<=14;i++){const v=(S.sleepLog||{})[daysAgoStr(i)];if(v>0)sl.push(v);}
  if(sl.length>=5){const avg=sl.reduce((a,b)=>a+b,0)/sl.length;if(avg<7)add('warn',`Sleep ${fmt1(avg)} h a night`,`Over ${sl.length} nights logged. Under seven hours slows recovery and strength.`);}
  return F;
}
// ─── The fixes. Each returns an undo function, or null when nothing changed. ───
function bldFixBackoff(exId){
  const rts=bldRoutinesWith(exId);if(!rts.length)return null;const ex=getEx(exId);
  const top=getExStrData(exId).slice(-1)[0];if(!top||!(top.w>0))return null;
  const before=JSON.stringify(S.nextTargets||{});
  rts.forEach(r=>{
    const re=r.exercises.find(e=>e.exId===exId);const reps=parseInt(re&&re.r)||top.r;
    const t=S.nextTargets[r.id]||{at:Date.now(),model:'Why am I stuck',items:{},note:'',capped:0,tokens:{in:0,out:0}};
    t.items[exId]={w:stepDown(top.w,ex.eq,0.1),r:reps,why:'Back-off: about 10% lighter, clean reps, then build back up.'};t.at=Date.now();
    S.nextTargets[r.id]=t;
  });
  save();
  return()=>{S.nextTargets=normalizeNextTargets(JSON.parse(before),S.routines);save();};
}
function bldFixSets(exId,d){
  const rts=bldRoutinesWith(exId);if(!rts.length)return null;
  const prev=[];
  rts.forEach(r=>r.exercises.forEach(e=>{if(e.exId!==exId)return;const n=parseInt(e.sets)||3;const v=Math.min(6,Math.max(1,n+d));if(v!==n){prev.push([r.id,e,n]);e.sets=v;}}));
  if(!prev.length)return null;save();
  return()=>{prev.forEach(([,e,n])=>{e.sets=n;});save();};
}
function bldFixSwap(exId,toId){
  const rts=bldRoutinesWith(exId);if(!rts.length||!getEx(toId))return null;
  const prev=[];
  rts.forEach(r=>r.exercises.forEach(e=>{if(e.exId===exId&&!r.exercises.some(x=>x.exId===toId)){prev.push(e);e.exId=toId;}}));
  if(!prev.length)return null;
  const sl=S.swapLog||(S.swapLog={});(sl[exId]=sl[exId]||{})[toId]=(parseInt(sl[exId][toId])||0)+1;
  bumpMemo();save();
  return()=>{prev.forEach(e=>{e.exId=exId;});if(sl[exId]&&sl[exId][toId]>0)sl[exId][toId]--;bumpMemo();save();};
}
