// UTILS
// ═══════════════════════════════════════════════════
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function today(){return new Date().toISOString().split('T')[0];}
function fmtDate(iso){if(!iso)return'';return new Date(iso).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});}
function fmtShort(iso){if(!iso)return'';return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric'});}
function fmtDur(ms){const m=Math.floor(ms/60000),h=Math.floor(m/60);return h>0?`${h}h ${m%60}m`:`${m}m`;}
function fmtTimer(s){const m=Math.floor(s/60),sec=s%60;return`${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;}
function e1rm(w,r){return r===1?w:Math.round(w*(1+r/30));}
function allEx(){return[...EXERCISES,...(S.custom||[])];}
function getEx(id){return allEx().find(e=>e.id===id);}
function totalVol(wk){return wk.exercises.reduce((t,ex)=>t+ex.sets.filter(s=>s.done&&!s.warmup).reduce((a,s)=>a+(parseFloat(s.w||0)*parseInt(s.r||0)),0),0);}
function doneSetCnt(wk){return wk.exercises.reduce((t,ex)=>t+ex.sets.filter(s=>s.done&&!s.warmup).length,0);}
function bwKg(){return(S.bodyweight||185)/2.205;}
function sessionCals(ms){return Math.round(4.5*bwKg()*(ms/3600000));}
// ─── Height / BMR / energy balance ───
function heightCm(){return(S.height||69)*2.54;}
function ageFromRange(){
  const r=S.aftAge||'22-26';const m=r.match(/^(\d+)/);const lo=m?parseInt(m[1]):24;
  if(r.includes('+'))return lo+3;
  const hi=(r.match(/-(\d+)/)||[])[1];
  return hi?Math.round((lo+parseInt(hi))/2):lo;
}
// Real age from birth month/year when set; otherwise fall back to the AFT bracket midpoint.
function userAge(){
  if(S.birthYear){
    const now=new Date();let a=now.getFullYear()-parseInt(S.birthYear);
    if(S.birthMonth&&now.getMonth()<(parseInt(S.birthMonth)-1))a--;
    return Math.max(13,Math.min(100,a));
  }
  return ageFromRange();
}
function bmr(){ // Mifflin-St Jeor
  const s=(S.aftGender==='female')?-161:5;
  return Math.round(10*bwKg()+6.25*heightCm()-5*userAge()+s);
}
// AFT scoring bracket derived from the user's actual age + gender (no manual picker).
function aftAgeBracket(){
  const a=userAge();const gn=S.aftGender||'male';
  if(gn==='female'){return a<=21?'17-21':a<=26?'22-26':a<=31?'27-31':'32+';}
  return a<=21?'17-21':a<=26?'22-26':a<=31?'27-31':a<=36?'32-36':a<=41?'37-41':'42+';
}
function baselineBurn(){return Math.round(bmr()*1.2);} // sedentary daily burn; logged exercise added on top
function dayExerciseCals(ds){
  const w=S.workouts.filter(wk=>new Date(wk.started).toISOString().split('T')[0]===ds).reduce((t,wk)=>t+(wk.cals||0),0);
  const a=S.activities.filter(x=>x.date===ds).reduce((t,x)=>t+(x.cals||0),0);
  return w+a;
}
function energyBalance(ds){
  const intake=getDayTotals(ds).cals||0;
  const exercise=dayExerciseCals(ds);
  const burn=baselineBurn()+exercise;
  return{intake,exercise,base:baselineBurn(),burn,net:intake-burn};
}
// Estimated comfortable speed (mph) for distance-capable activities; walk scales with height.
function estSpeedMph(type){
  if(type==='walk'){const h=S.height||69;return Math.max(2.3,Math.min(3.7,3.0*(h/69)));}
  return({run:6,bike:12,hike:2.5}[type])||3;
}
function estDistanceMi(type,durMin){return +(estSpeedMph(type)*(durMin/60)).toFixed(2);}
function estDurationMin(type,distMi){const sp=estSpeedMph(type)||3;return Math.round((distMi/sp)*60);}
function activityCals(act){
  const t=ACT_TYPES.find(a=>a.id===act.type)||{mets:5};
  if(act.type==='ruck'){const tf={flat:1,hilly:1.3,trail:1.2,mixed:1.15}[act.terrain||'flat'];return Math.round(0.30*((S.bodyweight||185)+(parseFloat(act.ruckWeight)||0))*(parseFloat(act.dist)||0)*tf);}
  let dur=parseFloat(act.dur)||0;const dist=parseFloat(act.dist)||0;
  // If only distance given, estimate the time so we can still produce a kcal figure.
  if(!dur&&dist&&(t.fields||[]).includes('dist'))dur=estDurationMin(act.type,dist);
  let mets=t.mets;
  // Walking pace materially changes burn — derive METs from actual pace when both are present.
  if(act.type==='walk'&&dist&&parseFloat(act.dur)){
    const sp=dist/((parseFloat(act.dur))/60);
    mets=sp<2.5?2.8:sp<3?3.3:sp<3.5?3.8:sp<4?4.3:5.0;
  }
  return Math.round(mets*bwKg()*(dur/60));
}
function greet(){const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening';}
function cv(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}
function applyDark(){document.documentElement.dataset.dark=S.darkMode?'true':'false';}
// ─── Theme palette ───
// Each entry: id, label, light [navy,ndim,nbright,bg-tint], dark [navy,ndim,nbright]
const THEMES=[
  {id:'navy',    label:'Navy',   light:['#373f8f','rgba(55,63,143,.07)','rgba(55,63,143,.16)','rgba(55,63,143,.055)'],  dark:['#4d56c4','rgba(125,134,240,.15)','rgba(125,134,240,.32)']},
  {id:'slate',   label:'Slate',  light:['#2d5f7a','rgba(45,95,122,.07)','rgba(45,95,122,.16)','rgba(45,95,122,.055)'],  dark:['#4a8faf','rgba(74,143,175,.15)','rgba(74,143,175,.32)']},
  {id:'forest',  label:'Forest', light:['#2a5c3f','rgba(42,92,63,.07)','rgba(42,92,63,.16)','rgba(42,92,63,.055)'],    dark:['#4a9968','rgba(74,153,104,.15)','rgba(74,153,104,.32)']},
  {id:'crimson', label:'Crimson',light:['#8f2a2a','rgba(143,42,42,.07)','rgba(143,42,42,.16)','rgba(143,42,42,.055)'], dark:['#c45555','rgba(196,85,85,.15)','rgba(196,85,85,.32)']},
  {id:'plum',    label:'Plum',   light:['#5e2d7a','rgba(94,45,122,.07)','rgba(94,45,122,.16)','rgba(94,45,122,.055)'], dark:['#9a5cc4','rgba(154,92,196,.15)','rgba(154,92,196,.32)']},
  {id:'amber',   label:'Amber',  light:['#7a4d10','rgba(122,77,16,.07)','rgba(122,77,16,.16)','rgba(122,77,16,.055)'], dark:['#c48830','rgba(196,136,48,.15)','rgba(196,136,48,.32)']},
  {id:'rose',    label:'Rose',   light:['#9b3060','rgba(155,48,96,.07)','rgba(155,48,96,.16)','rgba(155,48,96,.055)'], dark:['#d46090','rgba(212,96,144,.15)','rgba(212,96,144,.32)']},
  {id:'pink',    label:'Pink',   light:['#b0347a','rgba(176,52,122,.07)','rgba(176,52,122,.16)','rgba(176,52,122,.055)'],dark:['#e070b0','rgba(224,112,176,.15)','rgba(224,112,176,.32)']},
];
function applyTheme(){
  const id=S.primaryColor||'navy';
  const t=THEMES.find(x=>x.id===id)||THEMES[0];
  const dark=S.darkMode;
  const [navy,ndim,nbright]=dark?t.dark:t.light;
  // Inject overrides into a dedicated style element
  let el=document.getElementById('theme-vars');
  if(!el){el=document.createElement('style');el.id='theme-vars';document.head.appendChild(el);}
  const mix=(pct,baseHex)=>`color-mix(in srgb,${navy} ${pct}%,${baseHex})`;
  if(dark){
    // Dark mode: background is a DARK tint of the chosen accent (not flat neutral).
    el.textContent=`[data-dark="true"]{
      --navy:${navy};--ndim:${ndim};--nbright:${nbright};
      --bg:${mix(10,'#100f0d')};
      --bg2:${mix(14,'#1a1916')};
      --card:${mix(8,'#1b1a16')};
      --border:${mix(16,'#2d2a25')};
      --hair:${mix(10,'#242220')};
    }`;
  }else{
    // Light mode: wash the whole surface palette with the chosen accent so the
    // app visibly takes on the color. Cards stay near-white so content pops.
    el.textContent=`:root{
      --navy:${navy};--ndim:${ndim};--nbright:${nbright};
      --bg:${mix(16,'#f5f1ec')};
      --bg2:${mix(23,'#ece7df')};
      --card:${mix(5,'#fffefb')};
      --border:${mix(19,'#e8e3d9')};
      --hair:${mix(11,'#efeae1')};
    }`;
  }
}
function toggleDark(){S.darkMode=!S.darkMode;save();applyDark();applyTheme();}
function setPrimaryColor(id){
  S.primaryColor=id;save();applyTheme();
  // Update swatch selection live without closing modal
  document.querySelectorAll('.color-swatch').forEach(el=>{
    el.classList.toggle('on',el.getAttribute('onclick').includes(`'${id}'`));
  });
}
function killCharts(){Object.values(_charts).forEach(c=>{try{c.destroy();}catch(e){}});_charts={};}
function mkChart(id,cfg){if(_charts[id]){try{_charts[id].destroy();}catch(e){}}const el=document.getElementById(id);if(!el)return null;_charts[id]=new Chart(el,cfg);return _charts[id];}
function baseOpts(){return{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:cv('--muted'),font:{size:10}},grid:{color:cv('--border')}},y:{ticks:{color:cv('--muted'),font:{size:10}},grid:{color:cv('--border')}}}};}

// ─── Schedule ───
// Training/rest days are derived from the active group's schedule (single source of truth).
// Per-day overrides set from the calendar still take precedence.
// Day-picker group: a day is "training" if any routine is assigned to that weekday.
// Rotation group / no group: no fixed weekday pattern exists, so every day is trainable
// (the calendar simply won't shade rest days in that case).
function isTrainingDay(ds){
  const sch=S.schedule;
  const ov=sch&&sch.overrides&&sch.overrides[ds];
  if(ov)return ov==='active';
  const rovRid=sch&&sch.routineOverrides&&sch.routineOverrides[ds];
  if(rovRid==='rest')return false;
  if(rovRid)return true;
  const g=getActiveGroup();
  if(g&&g.mode==='daypicker'){
    const dow=new Date(ds+'T12:00:00').getDay();
    return(g.routineIds||[]).some(id=>((g.dayMap||{})[id]||[]).includes(dow));
  }
  return true;
}
// Planned routine names for a given weekday, from the active day-picker group.
function plannedRoutinesForDow(dow){
  const g=getActiveGroup();if(!g||g.mode!=='daypicker')return[];
  return(g.routineIds||[]).filter(id=>((g.dayMap||{})[id]||[]).includes(dow))
    .map(id=>(S.routines||[]).find(r=>r.id===id)?.name).filter(Boolean);
}
function getStreak(){
  const actDates=new Set([
    ...S.workouts.map(w=>new Date(w.started).toISOString().split('T')[0]),
    ...S.activities.map(a=>a.date)
  ]);
  const dt=new Date();
  // An empty today doesn't break the streak — count back from yesterday in that case.
  if(!actDates.has(dt.toISOString().split('T')[0]))dt.setDate(dt.getDate()-1);
  let n=0;
  while(actDates.has(dt.toISOString().split('T')[0])){n++;dt.setDate(dt.getDate()-1);}
  return n;
}

// ─── Today's routines ───
function wasRoutineDoneToday(rid){
  const td=today();
  return S.workouts.some(w=>w.routineId===rid&&new Date(w.started).toISOString().split('T')[0]===td);
}
function getActiveGroup(){return(S.groups||[]).find(g=>g.active)||null;}
// ─── Timed programs: ordered phases, each a group running for N weeks or until a date ───
function daysBetween(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000);}
function addDays(ds,n){const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().split('T')[0];}
// Compute each phase's [start,end] date window. End is exclusive (next phase's start).
function programPhaseWindows(){
  const p=S.program;if(!p||!p.phases||!p.phases.length||!p.startDate)return[];
  const out=[];let cursor=p.startDate;
  p.phases.forEach(ph=>{
    let end;
    if(ph.mode==='until'&&ph.untilDate){
      end=addDays(ph.untilDate,1); // inclusive of untilDate
      if(daysBetween(cursor,end)<1)end=addDays(cursor,1); // guard against past dates
    }else{
      const wks=Math.max(1,ph.weeks||1);
      end=addDays(cursor,wks*7);
    }
    out.push({groupId:ph.groupId,start:cursor,end,mode:ph.mode,weeks:ph.weeks,untilDate:ph.untilDate});
    cursor=end;
  });
  return out;
}
function currentProgramPhase(ds){
  ds=ds||today();
  const wins=programPhaseWindows();
  for(const w of wins){if(ds>=w.start&&ds<w.end)return w;}
  return null;
}
// Auto-activate the group the program says should be active today.
function resolveProgramGroup(){
  const p=S.program;if(!p||!p.active)return;
  const phase=currentProgramPhase(today());
  if(phase&&phase.groupId){
    const target=(S.groups||[]).find(g=>g.id===phase.groupId);
    if(target&&!target.active){
      (S.groups||[]).forEach(g=>g.active=(g.id===phase.groupId));
    }
  }
}
function getNextRoutine(){
  const g=getActiveGroup();if(!g||!(g.routineIds||[]).length)return null;
  if(g.mode==='rotation'){
    const ids=g.routineIds;const rid=ids[(g.cursor||0)%ids.length];
    return(S.routines||[]).find(r=>r.id===rid)||null;
  }
  const dow=new Date().getDay();
  const rid=(g.routineIds||[]).find(id=>((g.dayMap||{})[id]||[]).includes(dow));
  return rid?((S.routines||[]).find(r=>r.id===rid)||null):null;
}
function getTodayRoutines(){const r=getNextRoutine();return r?[r]:[];}
function getTodayRoutine(){return getNextRoutine();}

// ─── Workout intelligence ───
function getExStrData(exId){
  const r=[];
  S.workouts.slice().reverse().forEach(wk=>{
    const ex=wk.exercises.find(e=>e.exId===exId);if(!ex)return;
    const done=ex.sets.filter(s=>s.done&&parseFloat(s.w)>0);if(!done.length)return;
    const mw=Math.max(...done.map(s=>parseFloat(s.w)));
    r.push({label:fmtShort(new Date(wk.started).toISOString()),date:wk.started,maxW:mw,
      vol:done.reduce((t,s)=>t+(parseFloat(s.w)*parseInt(s.r||0)),0),
      e1rm:e1rm(mw,done.find(s=>parseFloat(s.w)===mw)?.r||1)});
  });
  return r;
}
function getExsWithHist(){
  const ids=new Set();
  S.workouts.forEach(wk=>wk.exercises.forEach(ex=>{if(ex.sets.some(s=>s.done&&parseFloat(s.w)>0))ids.add(ex.exId);}));
  return[...ids];
}
function getProgressWins(exIds){
  const wins=[];
  (exIds||getExsWithHist()).forEach(exId=>{
    const hist=getExStrData(exId);
    if(hist.length<3)return;
    const newest=hist[hist.length-1].e1rm;
    const oldest=hist[0].e1rm;
    const pct=oldest>0?Math.round((newest-oldest)/oldest*100):0;
    if(pct>=5)wins.push({exId,name:getEx(exId)?.name,pct,sessions:hist.length});
  });
  return wins.sort((a,b)=>b.pct-a.pct).slice(0,2);
}
function getPRProximity(){
  const results=[];
  Object.entries(S.prs).forEach(([exId,pr])=>{
    const hist=getExStrData(exId);if(!hist.length)return;
    const recent=hist[hist.length-1];
    const gap=pr.est-recent.e1rm;
    if(gap>0&&gap<=pr.est*0.08)results.push({exId,name:getEx(exId)?.name,gap,prEst:pr.est});
  });
  return results.slice(0,1);
}
function getVolumeMomentum(){
  const muscles={};
  for(let w=0;w<3;w++){
    const s=Date.now()-(w+1)*7*86400000,e=Date.now()-w*7*86400000;
    S.workouts.filter(wk=>wk.started>=s&&wk.started<e).forEach(wk=>{
      wk.exercises.forEach(ex=>{
        const info=getEx(ex.exId);if(!info?.muscle)return;
        const sets=ex.sets.filter(s=>s.done).length;
        if(!muscles[info.muscle])muscles[info.muscle]=[0,0,0];
        muscles[info.muscle][w]+=sets;
      });
    });
  }
  const results=[];
  Object.entries(muscles).forEach(([m,[w0,w1,w2]])=>{
    if(w0>0&&w0>w1&&w1>w2)results.push({muscle:MEV_MAV[m]?.lbl||m,weeks:3,val:w0});
    else if(w0>0&&w0>w1)results.push({muscle:MEV_MAV[m]?.lbl||m,weeks:2,val:w0});
  });
  return results.filter(r=>r.weeks>=2).sort((a,b)=>b.weeks-a.weeks).slice(0,1);
}
function getStagnantExercises(exIds){
  const stag=[];
  (exIds||[]).forEach(exId=>{
    const hist=getExStrData(exId);if(hist.length<3)return;
    const last3=hist.slice(-3).map(h=>h.e1rm);
    const mx=Math.max(...last3),mn=Math.min(...last3);
    if(mx-mn<=1)stag.push({exId,name:getEx(exId)?.name,sessions:3});
  });
  return stag.slice(0,2);
}
function getPainWarnings(){
  const w=[];
  const ids=new Set(S.workouts.slice(0,10).flatMap(wk=>wk.exercises.map(e=>e.exId)));
  ids.forEach(exId=>{
    const sess=S.workouts.filter(wk=>wk.exercises.some(e=>e.exId===exId)).slice(0,3);
    const pc=sess.filter(wk=>wk.exercises.find(e=>e.exId===exId)?.sets.some(s=>s.done&&s.tag==='Pain')).length;
    if(pc>=2)w.push({exId,name:getEx(exId)?.name||exId,sessions:pc});
  });
  return w;
}
function getExPainLevel(exId){
  return S.workouts.filter(wk=>wk.exercises.some(e=>e.exId===exId)).slice(0,3)
    .filter(wk=>wk.exercises.find(e=>e.exId===exId)?.sets.some(s=>s.done&&s.tag==='Pain')).length;
}
function checkProgressiveOverload(exId){
  const sessions=S.workouts.filter(w=>w.exercises.some(e=>e.exId===exId)).slice(0,2);
  if(sessions.length<2)return null;
  const allComplete=sessions.every(wk=>{
    const ex=wk.exercises.find(e=>e.exId===exId);
    return ex&&ex.sets.length>0&&ex.sets.every(s=>s.done);
  });
  if(!allComplete)return null;
  const ex=getEx(exId);if(!ex)return null;
  if(ex.eq==='Bodyweight')return{type:'reps',amount:1};
  const iso=['Biceps','Triceps','Shoulders','Abs','Calves','Traps','Forearms','Obliques'];
  const isIso=iso.includes(ex.muscle)&&ex.cat!=='Full Body';
  return{type:'weight',amount:S.unit==='kg'?(isIso?1.25:2.5):(isIso?2.5:5),unit:S.unit};
}
function getRecentExIds(n=8){
  const ids=[];
  for(const wk of S.workouts){for(const ex of wk.exercises){if(!ids.includes(ex.exId))ids.push(ex.exId);}if(ids.length>=n)break;}
  return ids.slice(0,n);
}
function getWeeklyActivity(nw=12){
  return Array.from({length:nw},(_,i)=>{
    const end=new Date();end.setDate(end.getDate()-(nw-1-i)*7);
    const start=new Date(end);start.setDate(start.getDate()-7);
    return S.workouts.filter(w=>w.started>=start.getTime()&&w.started<end.getTime()).length+
      S.activities.filter(a=>{const t=new Date(a.date+'T12:00:00').getTime();return t>=start.getTime()&&t<end.getTime();}).length;
  });
}
function getRecoveryData(){
  const ago=Date.now()-21*86400000;
  const bkts=[[Date.now()-7*86400000,Date.now()],[Date.now()-14*86400000,Date.now()-7*86400000],[Date.now()-21*86400000,Date.now()-14*86400000]];
  const ws=bkts.map(([s,e])=>muscleSetsInRange(s,e));
  const warnings=[];
  Object.entries(MEV_MAV).forEach(([m,mm])=>{if(ws.filter(w=>(w[m]||0)>mm.mav).length>=2)warnings.push({muscle:mm.lbl});});
  return{ws,warnings};
}
function getWilksData(){
  const pr=S.prs;
  const sq=pr['squat']||pr['front-squat']||pr['hex-dl'];
  const bench=pr['bb-bench']||pr['inc-bench'];
  const dl=pr['deadlift']||pr['sumo-dl'];
  if(!sq||!bench||!dl)return null;
  const total=parseFloat(sq.w)+parseFloat(bench.w)+parseFloat(dl.w);
  const bw=S.bodyweight||185;const gn=S.aftGender||'male';
  const bwK=bw/2.205,totK=total/2.205;
  const aw=gn==='female'?[594.31747775582,-27.23842536447,0.82112226871,-0.00930733913,4.731582e-5,-9.054e-8]:[-216.0475144,16.2606339,-0.002388645,-0.00113732,7.01863e-6,-1.291e-8];
  const dw=aw[0]+aw[1]*bwK+aw[2]*bwK**2+aw[3]*bwK**3+aw[4]*bwK**4+aw[5]*bwK**5;
  const wilks=Math.round(500/dw*totK*10)/10;
  const ad=gn==='female'?-57.96288+13.6175032*bwK-0.1126655495*bwK**2+0.0005158568*bwK**3-1.0706e-6*bwK**4:-307.75076+24.0900756*bwK-0.1918759221*bwK**2+0.0007391293*bwK**3-1.093e-6*bwK**4;
  const dots=Math.round(500/ad*totK*10)/10;
  return{total,wilks,dots,sq:sq.w,bench:bench.w,dl:dl.w};
}
function getStdLevels(){
  const bw=S.bodyweight||185;const gn=S.aftGender||'male';
  return Object.entries(STR_STANDARDS).map(([id,std])=>{
    const pr=S.prs[id];if(!pr)return{id,name:std.name,level:0,current:0,targets:[]};
    const w=parseFloat(pr.w);
    const mults=(gn==='female'?std.f:std.m).map(m=>m*bw);
    let level=0;for(let i=0;i<mults.length;i++){if(w>=mults[i])level=i+1;}
    return{id,name:std.name,level,current:w,targets:mults};
  });
}
function aftScore(evId,val,ag,gn){
  const g=AFT_TABLES[gn]||AFT_TABLES.male;const agKey=g[ag]?ag:Object.keys(g)[0];
  const table=g[agKey]?.[evId];if(!table||val===''||val==null)return null;
  const v=parseFloat(val);if(isNaN(v))return null;
  const ev=AFT_EVENTS.find(e=>e.id===evId);const dir=ev?.dir||'high';
  const sorted=[...table].sort((a,b)=>dir==='high'?a[0]-b[0]:b[0]-a[0]);
  if(dir==='high'){if(v<=sorted[0][0])return Math.max(0,sorted[0][1]-5);if(v>=sorted[sorted.length-1][0])return 100;for(let i=1;i<sorted.length;i++){if(v<=sorted[i][0]){const p=(v-sorted[i-1][0])/(sorted[i][0]-sorted[i-1][0]);return Math.round(sorted[i-1][1]+p*(sorted[i][1]-sorted[i-1][1]));}}
  }else{if(v>=sorted[0][0])return Math.max(0,sorted[0][1]-5);if(v<=sorted[sorted.length-1][0])return 100;for(let i=1;i<sorted.length;i++){if(v>=sorted[i][0]){const p=(sorted[i-1][0]-v)/(sorted[i-1][0]-sorted[i][0]);return Math.round(sorted[i-1][1]+p*(sorted[i][1]-sorted[i-1][1]));}}
  }
  return 60;
}

// ─── UI helpers ───
function makeOv(id){
  const ov=document.createElement('div');ov.className='ov';if(id)ov.id=id;
  ov.addEventListener('click',e=>{if(e.target===ov)dismissOv(ov);});
  return ov;
}
function dismissOv(ov){
  const modal=ov.querySelector('.modal');
  if(modal){modal.style.transition='transform .22s cubic-bezier(.22,.61,.36,1)';modal.style.transform='translateY(100%)';}
  setTimeout(()=>ov.remove(),220);
}
function attachSwipeDown(ov){
  const handle=ov.querySelector('.mh');const modal=ov.querySelector('.modal');
  if(!handle||!modal)return;
  let startY=0,startT=0,dragging=false;
  handle.style.touchAction='none';
  handle.addEventListener('pointerdown',e=>{
    startY=e.clientY;startT=Date.now();dragging=true;
    modal.style.transition='none';
    try{handle.setPointerCapture(e.pointerId);}catch(ex){}
  });
  handle.addEventListener('pointermove',e=>{
    if(!dragging)return;const dy=e.clientY-startY;
    if(dy>0)modal.style.transform=`translateY(${dy}px)`;
  });
  handle.addEventListener('pointerup',e=>{
    if(!dragging)return;dragging=false;
    const dy=e.clientY-startY,dt=Date.now()-startT;
    if(dy>80||dy/dt>0.5)dismissOv(ov);
    else{modal.style.transition='transform .22s cubic-bezier(.22,.61,.36,1)';modal.style.transform='';}
  });
  handle.addEventListener('pointercancel',()=>{
    dragging=false;modal.style.transition='transform .22s cubic-bezier(.22,.61,.36,1)';modal.style.transform='';
  });
}
function toast(msg,color){
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const el=document.createElement('div');el.className='toast';
  if(color==='gold')el.style.cssText='border-color:var(--gold);color:var(--gold)';
  if(color==='green')el.style.cssText='border-color:var(--green);color:var(--green)';
  el.textContent=msg;document.body.appendChild(el);setTimeout(()=>el.remove(),2300);
}
let _cb=null;
function customConfirm(msg,label,cb){
  _cb=cb;const ov=makeOv('confirm-ov');
  ov.innerHTML=`<div class="modal" style="max-height:260px"><div class="mh"></div>
    <div style="font-size:15px;font-weight:600;margin-bottom:6px;letter-spacing:-.01em">Are you sure?</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:18px;line-height:1.5">${msg}</div>
    <button class="btn btd bfw" onclick="doConfirm()">${label||'Confirm'}</button>
    <button class="btn btg bfw" style="margin-top:8px" onclick="dismissOv(document.getElementById('confirm-ov'))">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function doConfirm(){const ov=document.getElementById('confirm-ov');if(ov)dismissOv(ov);if(_cb){_cb();_cb=null;}}
// ─── Rest timer (inline pill in top bar) ───
let rInt=null,rRem=0,rTot=0;
function startRest(dur){
  dur=dur||S.restDur||90;if(rInt)clearInterval(rInt);rRem=dur;rTot=dur;
  syncRestUI();
  rInt=setInterval(()=>{rRem--;if(rRem<=0){skipRest();if(navigator.vibrate)navigator.vibrate([200,100,200]);toast('Rest done');}else syncRestUI();},1000);
}
// Per-exercise rest duration, falling back to the global default.
function exRestFor(exId){
  const wk=S.activeWorkout;
  if(wk){const e=wk.exercises.find(x=>x.exId===exId);if(e&&e.rest!=null)return e.rest;}
  return(S.exRest&&S.exRest[exId])||S.restDur||90;
}
const REST_OPTS=[30,45,60,75,90,120,150,180,210,240];
function showRestPicker(exId){
  const info=getEx(exId);const wk=S.activeWorkout;
  const sessEx=wk?wk.exercises.find(x=>x.exId===exId):null;
  const cur=(sessEx&&sessEx.rest!=null)?sessEx.rest:((S.exRest&&S.exRest[exId])||null);const def=S.restDur||90;
  const ov=makeOv('rest-pick-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Rest Timer</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">${info?.name||'Exercise'} — set how long to rest after each set. This is remembered for this exercise.</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
      ${REST_OPTS.map(v=>`<button class="btn ${cur===v?'btp':'bts'}" style="padding:12px 0;font-size:13px" onclick="setExRest('${exId}',${v})">${v>=60?`${Math.floor(v/60)}:${String(v%60).padStart(2,'0')}`:`${v}s`}</button>`).join('')}
    </div>
    <button class="btn ${cur===null?'btp':'btg'} bfw" onclick="setExRest('${exId}',null)">Use default (${def}s)</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="dismissOv(document.getElementById('rest-pick-ov'))">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function setExRest(exId,v){
  const wk=S.activeWorkout;
  const sessEx=wk?wk.exercises.find(x=>x.exId===exId):null;
  if(sessEx){if(v===null)sessEx.rest=null;else sessEx.rest=v;}
  else{if(!S.exRest)S.exRest={};if(v===null)delete S.exRest[exId];else S.exRest[exId]=v;}
  save();dismissOv(document.getElementById('rest-pick-ov'));
  if(S.activeWorkout)renderSession(document.getElementById('content'));
}
function syncRestUI(){
  const pill=document.getElementById('rest-pill'),t=document.getElementById('rest-pill-t');
  if(!pill)return;
  if(rInt&&rRem>0){pill.classList.add('on');if(t)t.textContent='REST '+fmtTimer(rRem);}
  else pill.classList.remove('on');
}
function updRest(){syncRestUI();}
function skipRest(){
  if(rInt)clearInterval(rInt);rInt=null;rRem=0;
  const pill=document.getElementById('rest-pill');if(pill)pill.classList.remove('on');
}
let wtInt=null;
function startWtTimer(){
  if(wtInt)clearInterval(wtInt);
  wtInt=setInterval(()=>{const el=document.getElementById('wt-el');if(el&&S.activeWorkout)el.textContent=fmtTimer(Math.floor((Date.now()-S.activeWorkout.started)/1000));},1000);
}

// ═══════════════════════════════════════════════════
