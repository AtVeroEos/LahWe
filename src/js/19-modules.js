// ═══════════════════════════════════════════════════
// MODULES — what the app shows, picked by the person using it
// ═══════════════════════════════════════════════════
// Every part of Lah We belongs to a module. Turning a module off hides it everywhere it shows
// (its tab, Home tiles and layouts, Progress tiles, check-in questions, Coach buttons, Patterns,
// reminders, settings rows). It never deletes anything: what was logged stays, keeps counting
// where a number depends on it (the calorie burn of a run you did log, say), and is all back the
// moment the module is turned on again.
//
// Workouts is the app itself and is always on. Each module may have sub-switches. A sub-switch
// is on only while its module is on; its own setting is kept, so turning the module back on
// brings back the parts you had. Three sub-switches keep the setting they always had: mood and
// sleep (the check-in questions, S.trackMood / S.trackSleep) and running (S.running, which
// switches itself on after a few runs).
const MODULES=[
  {id:'workouts',l:'Workouts',icon:'dumbbell',always:true,
    d:'Programs, workouts, every set and record, recovery and the muscles you trained.',
    subs:[{id:'aft',l:'Army fitness test',d:'Scores the five events and counts down to your test day'}]},
  {id:'nutrition',l:'Nutrition',icon:'apple',
    d:'Food by weight or barcode, calorie and protein targets, training and rest days.',
    subs:[{id:'mealplan',l:'Meal plan',d:'A week of meals and a grocery list'},
      {id:'supps',l:'Supplements',d:'A daily checklist'}]},
  {id:'body',l:'Body',icon:'scale',
    d:'Your weight trend, body measurements and progress photos.',
    subs:[{id:'weight',l:'Weight',d:'A morning weigh-in and its trend'},
      {id:'measure',l:'Measurements',d:'Waist, arms, chest and the rest'},
      {id:'photos',l:'Progress photos',d:'Kept in the app, never in your camera roll'}]},
  {id:'cardio',l:'Cardio & runs',icon:'run',
    d:'Runs, rides, rucks and walks, with Strava import.',
    subs:[{id:'running',l:'Running analysis',d:'Weekly miles, best efforts, race times and routes',
        get:()=>S.running!==false,set:v=>{S.running=v?(typeof runAutoCount==='function'&&runAutoCount()>=RUN_AUTO_MIN?null:true):false;}},
      {id:'steps',l:'Steps',d:'A daily step count'}]},
  {id:'habits',l:'Habits & mood',icon:'repeat',
    d:'Daily habits, how each day went and last night’s sleep, in the morning check-in.',
    subs:[{id:'habitlist',l:'Habits',d:'Things to do, reach or avoid'},
      {id:'mood',l:'Mood',d:'Rate yesterday, one tap',get:()=>S.trackMood!==false,set:v=>{S.trackMood=!!v;}},
      {id:'sleep',l:'Sleep',d:'Hours, asked with the weigh-in',get:()=>S.trackSleep!==false,set:v=>{S.trackSleep=!!v;}}]},
  {id:'patterns',l:'Patterns',icon:'spark',
    d:'Finds what goes with your best days, from your own log. Needs a few weeks of data.'},
  // Always on, and not in the picker: its builders need no key and are too useful to be switched off by accident.
  {id:'coach',l:'Coach',icon:'bulb',always:true,hidden:true,
    d:'Builds programs, workouts and meal plans from your data. An AI key is optional.'},
  {id:'music',l:'Music',icon:'music',
    d:'Spotify controls and a YouTube player inside a workout.'},
];
// What a new install starts with before the opening asks: Workouts and Body weight (and Coach,
// whose builders need no key). Sub-switches start on except the ones that are a commitment of
// their own (measurements, photos, steps, the fitness test).
const MOD_DEFAULT={nutrition:false,body:true,cardio:false,habits:false,patterns:false,coach:true,music:false,
  aft:false,mealplan:true,supps:true,weight:true,measure:false,photos:false,steps:false,habitlist:true};
// Everything on: how the app was before modules, which is what an existing install keeps.
const MOD_ALL=Object.fromEntries(Object.keys(MOD_DEFAULT).map(k=>[k,true]));
// Parts a module cannot work without. While the module is on, these stay on and their switch is
// locked: Nutrition without weigh-ins can never work out your real maintenance (its targets stay a
// formula guess), and habits without mood ratings cannot be tested for what goes with better days.
// Turning the module on turns them on; to turn one off, turn the module off first.
const MOD_NEEDS={
  nutrition:{ids:['body','weight'],why:'Nutrition needs your weigh-ins to work out your real maintenance'},
  habits:{ids:['mood'],why:'Habits are tested against how your days went'},
};
// Which module on now is holding this part on (its label and why), or null.
function modLockedBy(id){
  for(const k of Object.keys(MOD_NEEDS)){if(MOD_NEEDS[k].ids.includes(id)&&modRaw(k))return{id:k,l:modLabel(k),why:MOD_NEEDS[k].why};}
  return null;
}
// Put the needs back in place (after any change, and when a save is loaded).
function modEnforce(){Object.keys(MOD_NEEDS).forEach(k=>{if(modRaw(k))MOD_NEEDS[k].ids.forEach(id=>{if(!modRaw(id))modSetRaw(id,true);});});}
function modDef(id){return MODULES.find(m=>m.id===id)||null;}
function modSub(id){for(const m of MODULES){const s=(m.subs||[]).find(x=>x.id===id);if(s)return{m,s};}return null;}
function normalizeModules(v,fallback){
  const base=Object.assign({},fallback||MOD_DEFAULT);
  if(!isObj(v))return base;
  Object.keys(MOD_DEFAULT).forEach(k=>{if(typeof v[k]==='boolean')base[k]=v[k];});
  return base;
}
// The switch as stored, for a module or a sub-switch, without the module above it.
function modRaw(id){
  const sub=modSub(id);
  if(sub&&sub.s.get)return !!sub.s.get();
  if(modDef(id)&&modDef(id).always)return true;
  const m=isObj(S.modules)?S.modules:MOD_ALL;
  return m[id]!==false;
}
// Is this part of the app showing? A module, or a sub-switch whose module is on.
function modOn(id){
  const sub=modSub(id);
  if(sub)return modRaw(sub.m.id)&&modRaw(id);
  return modRaw(id);
}
function modSetRaw(id,v){
  const sub=modSub(id);
  if(sub&&sub.s.set){sub.s.set(!!v);return;}
  if(modDef(id)&&modDef(id).always)return;
  if(!isObj(S.modules))S.modules=Object.assign({},MOD_ALL);
  S.modules[id]=!!v;
}
// A module whose sub-switches are all off shows nothing, so it counts as off.
function modShowing(id){
  const m=modDef(id);if(!m)return modOn(id);
  if(!modOn(id))return false;
  return !m.subs||m.always||m.subs.some(s=>modOn(s.id));
}
function modLabel(id){const m=modDef(id);if(m)return m.l;const s=modSub(id);return s?s.s.l:id;}
// Changing one from a screen: redraw whatever depends on it. Turning one off is undoable.
function modSet(id,v,o){
  o=o||{};const was=modRaw(id);
  const lock=!v&&modLockedBy(id);
  if(lock){toast(`${lock.why}. Turn off ${lock.l} first to hide ${modLabel(id)}.`,'',{ms:4500});return;}
  modSetRaw(id,v);
  modEnforce();
  if(id==='habits'&&v&&!modOn('habitlist')&&!modOn('mood')&&!modOn('sleep'))modSetRaw('habitlist',true);
  if(id==='body'&&v&&!modOn('weight')&&!modOn('measure')&&!modOn('photos'))modSetRaw('weight',true);
  if(id==='nutrition'&&!v&&S.tab==='nutrition')S.tab='workout';
  if(id==='coach'&&!v&&S.tab==='coach')S.tab='workout';
  if(id==='habitlist'&&!v&&S.homeView==='habits')S.homeView='';
  bumpMemo();save();
  modChanged();
  if(!o.quiet&&was&&!v)toast(`${modLabel(id)} hidden. Nothing you logged is deleted.`,'',{action:'Undo',onAction:()=>modSet(id,true,{quiet:true})});
}
function modChanged(){
  navSync();
  if(typeof refreshSettings==='function')refreshSettings();
  if(document.getElementById('mods-ov'))renderModsPage();
  if(S.onboarded)render();
}

// ─── Which tabs the bar shows ───
// Home, Workout and Progress are always there; Nutrition and Coach go with their modules.
function navTabs(){return['workout','library','nutrition','progress','coach'].filter(t=>tabOn(t));}
function tabOn(t){
  if(t==='nutrition')return modOn('nutrition');
  if(t==='coach')return modOn('coach');
  return TABS.includes(t);
}

// ─── The picker: cards with their sub-switches ───
// Used by the opening (41-onboarding.js) and by Settings → What Lah We shows. pick is the
// working copy while the opening runs (nothing is saved until it finishes); null means S itself.
function modCardsHTML(o){
  o=o||{};
  return`<div class="mod-grid">${MODULES.filter(m=>!m.hidden).map(m=>{
    const on=modOn(m.id);
    const subs=on&&m.subs&&m.subs.length?`<div class="mod-subs">${m.subs.map(s=>{const so=modRaw(s.id);const sl=modLockedBy(s.id);
      if(sl)return`<div class="mod-sub on mod-sub-lock" role="switch" aria-checked="true" aria-disabled="true"><span class="mod-sub-t">${esc(s.l)}<small>${esc(sl.why)}.</small></span><span class="mod-lock">With ${esc(sl.l)}</span></div>`;
      return`<button class="mod-sub${so?' on':''}" role="switch" aria-checked="${so}" onclick="event.stopPropagation();modPickSub(${jsq(s.id)})"><span class="mod-sub-t">${esc(s.l)}<small>${esc(modSubNote(s.id)||s.d)}</small></span><span class="tog tog-sm${so?' on':''}" aria-hidden="true"></span></button>`;}).join('')}</div>`:'';
    const use=o.usage?modUsage(m.id):null;const lk=modLockedBy(m.id);
    return`<div class="mod-card${on?' on':''}${m.always?' mod-always':''}">
      <button class="mod-head" ${m.always?'disabled':''} role="switch" aria-checked="${on}" aria-label="${esc(m.l)}" onclick="modPick(${jsq(m.id)})">
        <span class="mod-ic">${ICON(m.icon,20)}</span>
        <span class="mod-main"><span class="mod-t">${esc(m.l)}${m.always?'<span class="mod-lock">Always on</span>':lk?`<span class="mod-lock">With ${esc(lk.l)}</span>`:''}</span><span class="mod-d">${esc(use&&use.line?use.line:m.d)}</span></span>
        ${m.always?'':`<span class="mod-check" aria-hidden="true">${on?ICON('tick',15):''}</span>`}
      </button>${subs}</div>`;}).join('')}</div>`;
}
// A line under a sub-switch when its plain description would mislead.
function modSubNote(id){
  if(id==='running'&&modRaw('running')&&!runningOn()&&modOn('cardio'))return`Shows once ${RUN_AUTO_MIN} runs or rucks with a distance are logged (${runAutoCount()} so far)`;
  return'';
}
function modPick(id){
  const m=modDef(id);if(!m||m.always)return;
  if(_obFlow()){
    const lk=modRaw(id)&&modLockedBy(id);if(lk){toast(`${lk.why}. Turn off ${lk.l} first.`,'',{ms:4000});return;}
    modSetRaw(id,!modRaw(id));if(id==='body'&&modRaw('body')&&!['weight','measure','photos'].some(modRaw))modSetRaw('weight',true);modEnforce();obRedraw();return;}
  modSet(id,!modRaw(id));
}
function modPickSub(id){
  const sub=modSub(id);if(!sub||modLockedBy(id))return; // a locked part is drawn without a switch
  if(_obFlow()){modSetRaw(id,!modRaw(id));obRedraw();return;}
  modSet(id,!modRaw(id));
}
function _obFlow(){return !S.onboarded&&!!window._ob;}

// ─── Settings → What Lah We shows ───
function showModsPage(){
  const ov=makeOv('mods-ov');
  ov.innerHTML=`<div class="modal" style="max-height:95vh"><div class="mh"></div><div class="mt" style="margin-bottom:2px">What Lah We shows</div>
    <div class="sheet-sub">Turn on what you want to track. Anything turned off is hidden everywhere; nothing you logged is deleted, and it all comes back when you turn it on.</div>
    <div id="mods-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderModsPage();
}
function renderModsPage(){
  const el=document.getElementById('mods-body');if(!el)return;
  const m=el.closest('.modal');const y=m?m.scrollTop:0;
  el.innerHTML=modCardsHTML({usage:true})+`<div class="fine" style="margin:10px 2px 0">The tab bar follows what is on: Nutrition and Coach are tabs only while they are on.</div>`;
  if(m)m.scrollTop=y;
}
function modSummary(){
  const on=MODULES.filter(m=>!m.always&&modShowing(m.id)).map(m=>m.l);
  return on.length?`Workouts, ${on.join(', ')}`:'Workouts only';
}

// ─── How much a module is used ───
// For the setup review and the picker in Settings: days with something logged in the last 21.
// null when the module has nothing to count (Coach, Music, Patterns).
function modUsage(id){
  const from=daysAgoStr(20);const days=new Set();
  const add=ds=>{if(ds&&ds>=from)days.add(ds);};
  const dsOf=v=>typeof v==='number'?dayOf(v):String(v||'').slice(0,10);
  if(id==='nutrition'){(S.meals||[]).forEach(m=>add(m.date));Object.keys(S.macroLogs||{}).forEach(d=>{const x=S.macroLogs[d];if(x&&(parseFloat(x.cals)>0)&&!x.parked)add(d);});}
  else if(id==='body'){(S.bodyweightLog||[]).forEach(b=>add(b.date));(S.measurements||[]).forEach(m=>add(m.date));(S.photos||[]).forEach(p=>add(p.date));}
  else if(id==='cardio'){(S.activities||[]).forEach(a=>{if(!a.wkId)add(a.date);});Object.keys(S.stepsLog||{}).forEach(d=>{if(S.stepsLog[d]>0)add(d);});}
  else if(id==='habits'){Object.keys(S.habitLog||{}).forEach(add);Object.keys(S.moodLog||{}).forEach(add);Object.keys(S.sleepLog||{}).forEach(add);}
  else if(id==='workouts'){(S.workouts||[]).forEach(w=>add(dsOf(w.started)));}
  else return null;
  const n=days.size;
  return{n,line:n?`${n} day${n===1?'':'s'} logged in the last 3 weeks`:'Nothing logged in the last 3 weeks'};
}

// ─── The daily check-in asks only what is on ───
function sleepAsked(){return modOn('sleep');}
// Is there anything for the check-in to ask? (Weight, sleep, mood or habits.)
function checkInOn(){return modOn('weight')||sleepAsked()||moodAsked()||activeHabits().length>0;}
// The AI coach is offered (an "Ask the coach" button) only while Coach is on and a key is set up.
function coachAI(){return modOn('coach')&&aiReady();}
