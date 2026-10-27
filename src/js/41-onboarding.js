// ═══════════════════════════════════════════════════
// ONBOARDING — the opening
// ═══════════════════════════════════════════════════
// A few short screens, each about one thing, so the app someone ends up with is the one they
// asked for (19-modules.js):
//   you      name and units (the unit matters for reading an import, so it comes first)
//   bring    coming from another app? import it, or start fresh. What comes in pre-ticks step 3.
//   track    what do you want to track? the module cards, with their sub-switches
//   setup    one short screen for each module picked that has something to set. All skippable.
//   look     Home layout (only the ones the modules allow) and the accent colour
//   ready    here's your app: its tab bar, what is on, and where the rest lives
// Nothing counts as set up until Start on the last screen; until then a reload starts the
// opening again (anything imported stays imported).
const OB_SETUP=[
  {id:'about',mod:'workouts',t:'About you',s:'For calorie estimates, strength standards and fitness-test scoring. All optional; Settings → Profile has it later.'},
  {id:'body',mod:'weight',t:'Your weight',s:'Weigh in once now; the morning check-in keeps the trend going.'},
  {id:'food',mod:'nutrition',t:'Your food targets',s:'Worked out from your weight, height and age. After two weeks of logging, the app works out your real maintenance and offers to adjust.'},
  {id:'cardio',mod:'cardio',t:'Cardio & runs',s:'Log runs, rides, rucks and walks from Home. Strava’s archive can come in all at once.'},
  {id:'habits',mod:'habits',t:'Habits & mood',s:'Pick a few to start. You tick them in the morning check-in, with yesterday’s mood and last night’s sleep.'},
  {id:'coach',mod:'coach',t:'Coach',s:'The builders run on the app itself: no account, no cost. An AI key adds a coach you can talk to.'},
];
function obSteps(){
  const set=OB_SETUP.filter(x=>x.mod==='workouts'||modOn(x.mod)).map(x=>'set:'+x.id);
  return['you','bring','track'].concat(set,['look','ready']);
}
function obStepId(){const st=obSteps();const z=window._ob;return st[Math.max(0,Math.min(st.length-1,z.i||0))];}
function obInit(){
  if(window._ob)return;
  window._ob={i:0,unit:S.unit||'lbs',name:S.name||'',imported:null,habits:{},dir:null};
  // A fresh install: start from the defaults (Workouts and Body weight; Coach, whose builders need no key).
  if(!isObj(S.modules))S.modules=Object.assign({},MOD_DEFAULT);
}
function renderOnboarding(c){
  obInit();
  document.getElementById('nav').style.display='none';
  c.style.paddingBottom='0';
  const st=obSteps();const z=window._ob;if(z.i>=st.length)z.i=st.length-1;
  const id=obStepId();const n=st.length;
  const dots=`<div class="ob-dots" aria-label="Step ${z.i+1} of ${n}">${st.map((_,i)=>`<i class="${i<z.i?'done':i===z.i?'on':''}"></i>`).join('')}</div>`;
  const back=z.i>0?`<button class="ob-back" onclick="obBack()" aria-label="Back">${ICON('chev',16).replace('<svg','<svg style="transform:rotate(180deg)"')} Back</button>`:'<span></span>';
  let body='';
  try{body=OB_SCREENS[id.startsWith('set:')?'set':id](id.slice(4));}catch(e){logError(e,'onboarding '+id);body=`<div class="ob-h"><div class="ob-t">Something went wrong</div><div class="ob-s">This step could not be drawn. You can skip it.</div></div><div class="ob-foot"><button class="btn btp bfw ob-go" onclick="obNext(true)">Skip</button></div>`;}
  c.innerHTML=`<div class="ob">${id==='you'?'':`<div class="ob-top">${back}${dots}<span class="ob-step">${z.i+1} of ${n}</span></div>`}${body}</div>`;
  if(id==='look')setTimeout(layScale,0);
}
function obRedraw(){
  const c=document.getElementById('content');if(!c||S.onboarded)return;
  const y=c.scrollTop;renderOnboarding(c);c.scrollTop=y;
}
function obGo(i){const z=window._ob;z.i=Math.max(0,Math.min(obSteps().length-1,i));const c=document.getElementById('content');if(c){renderOnboarding(c);c.scrollTop=0;}}
function obBack(){obKeep();obGo(window._ob.i-1);}
// Leaving a screen keeps what was typed on it (Back as well as Next): nothing typed is lost.
function obKeep(){
  const id=obStepId();const v=k=>{const el=document.getElementById(k);return el?String(el.value||'').trim():null;};
  if(id==='you'){const n=v('ob-name');if(n!=null){window._ob.name=n;if(n)S.name=n.slice(0,40);}} // the layout previews greet them by name
  if(id==='set:about'){
    const ht=parseFloat(v('ob-height'));if(ht>0){const hr=SANE.height[S.unit==='kg'?'cm':'in'];if(ht>=hr[0]&&ht<=hr[1]){S.height=S.unit==='kg'?r1(ht/2.54):ht;S.profileSet.height=true;}}
    const bm=v('ob-bmonth');if(bm)S.birthMonth=parseInt(bm);
    const by=parseInt(v('ob-byear'));const yr=new Date().getFullYear();if(by>=yr-100&&by<=yr-13)S.birthYear=by;
  }
}
// Next: checks the screen it is leaving; skip=true leaves it as it was.
function obNext(skip){
  const id=obStepId();
  if(!skip&&OB_CHECK[id]&&OB_CHECK[id]()===false)return;
  obKeep();
  if(id==='bring')obPrecheck();
  if(id==='track'&&!skip)S.modules=normalizeModules(S.modules,MOD_DEFAULT);
  obGo(window._ob.i+1);
}

// ─── The screens ───
const obFoot=(next,o)=>{o=o||{};return`<div class="ob-foot">${o.extra||''}<button class="btn btp bfw ob-go" onclick="obNext()">${next}</button>${o.skip?`<button class="btn btg bfw" onclick="obNext(true)">${o.skip}</button>`:''}</div>`;};
const obHead=(t,s)=>`<div class="ob-h"><div class="ob-t">${t}</div>${s?`<div class="ob-s">${s}</div>`:''}</div>`;
const OB_SCREENS={
  you:()=>{const z=window._ob;
    return`<div class="ob-brand">${logoLockup(44,38)}<div class="ob-tag">Track what you care about. Nothing else.</div></div>
    <div class="fg"><label class="fl">Your name</label><input type="text" id="ob-name" maxlength="40" placeholder="First name" autocomplete="given-name" style="font-size:18px" value="${esc(z.name||'')}" enterkeyhint="next" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();obNext();}"></div>
    <div class="fg"><label class="fl">Weights in</label>${obSeg('ob-unit',[['lbs','lbs'],['kg','kg']],S.unit||'lbs','obUnit')}</div>
    <div class="fine" style="margin:-4px 2px 0">Height and measurements follow: inches with lbs, centimetres with kg. Distances are in miles.</div>
    ${obFoot('Continue',{extra:'',skip:null})}
    <button class="btn btg bfw ob-restore" onclick="importData()">Restore from a backup</button>`;},
  bring:()=>{const z=window._ob;const im=obImportCounts();
    return obHead('Coming from another app?','Bring your history with you and the app starts where you left off. The file is read on this phone; nothing is uploaded.')+
    (im.any?`<div class="ob-done">${ICON('tick',16)}<span><b>Imported</b>${esc(im.text)}</span></div>`:'')+
    `<div class="ob-opts">
      <button class="ob-opt" onclick="obImport()"><span class="ob-opt-i">${ICON('arrowdown',20)}</span><span class="ob-opt-m"><b>${im.any?'Import another file':'Import my history'}</b><i>Strong, Hevy, JEFIT, Fitbod, Alpha Progression, StrongLifts, Strava</i></span>${ICON('chev',16)}</button>
    </div>`+obFoot(im.any?'Continue':'Start fresh');},
  track:()=>obHead('What do you want to track?','Pick what you care about. Everything you leave off stays out of your way, and you can turn it on any time in Settings.')+
    modCardsHTML()+obFoot('Continue'),
  // Skip is offered only where Continue saves something (a weight, targets, habits); elsewhere it would be the same button twice.
  set:sub=>{const x=OB_SETUP.find(o=>o.id===sub);return obHead(x.t,x.s)+OB_SET[sub]()+obFoot('Continue',{skip:['body','food','habits'].includes(sub)?'Skip for now':null});},
  look:()=>{
    const cur=homeLayout(S.homeLayout).id;
    return obHead('How Home looks','Each is the same Home, ordered for what you track. Settings → Appearance changes it later.')+
    `<div id="ob-lay">${homeLayoutPickerHTML()}</div>
    <div class="set-lbl" style="margin-top:16px">Accent colour</div>
    <div class="set-sw">${THEMES.map(t=>`<div class="color-swatch${(S.primaryColor||'navy')===t.id?' on':''}" title="${t.label}" style="background:${S.darkMode?t.dark:t.light}" onclick="setPrimaryColor('${t.id}')" role="button" aria-label="${t.label}"></div>`).join('')}</div>`+obFoot('Continue');},
  ready:()=>{
    const tabs=navTabs();const nav=document.getElementById('nav');
    const btn=t=>{const b=nav&&nav.querySelector?nav.querySelector(`.nb[data-tab="${t}"]`):null;return b?`<span class="ob-nb">${b.querySelector('.nb-icon').outerHTML}<span>${esc(b.querySelector('span:last-child').textContent)}</span></span>`:'';};
    const on=MODULES.filter(m=>modShowing(m.id));
    const off=MODULES.filter(m=>!m.always&&!modShowing(m.id));
    return obHead(`Here’s your app${window._ob.name?', '+esc(window._ob.name):''}`,'This is what you will see. Nothing else is in the way.')+
    `<div class="ob-tabs" data-n="${tabs.length}">${tabs.map(btn).join('')}</div>
    <div class="sec-h" style="padding-left:2px">Tracking</div>
    <div class="ob-mods">${on.map(m=>`<span class="ob-mod">${ICON(m.icon,15)} ${esc(m.l)}${m.subs&&!m.always?`<small>${esc(m.subs.filter(s=>modOn(s.id)).map(s=>s.l).join(', '))}</small>`:''}</span>`).join('')}</div>
    ${off.length?`<div class="ob-off">${ICON('sliders',15)}<span>${esc(off.map(m=>m.l).join(', '))} ${off.length===1?'is':'are'} off. <b>Settings → What Lah We shows</b> turns ${off.length===1?'it':'any of them'} on, and the app will suggest one when your own data says it would help.</span></div>`:''}
    <div class="ob-foot"><button class="btn btp bfw ob-go" onclick="finishOb()">Start</button></div>`;},
};
// Segmented control for the opening (Settings has its own).
function obSeg(id,opts,cur,fn){return`<div class="seg seg-in" id="${id}" role="radiogroup">${opts.map(([v,l])=>`<button class="seg-b${v===cur?' on':''}" role="radio" aria-checked="${v===cur}" data-v="${esc(String(v))}" onclick="${fn}(${typeof v==='string'?jsq(v):v})">${l}</button>`).join('')}</div>`;}
function obSegSet(id,v){document.querySelectorAll(`#${id} .seg-b`).forEach(b=>{const on=b.dataset.v===String(v);b.classList.toggle('on',on);b.setAttribute('aria-checked',on);});}
function obUnit(u){S.unit=u==='kg'?'kg':'lbs';obSegSet('ob-unit',S.unit);}
const OB_CHECK={
  you:()=>{
    const name=String(document.getElementById('ob-name')?.value||'').trim();
    if(!name){toast('Enter your name');document.getElementById('ob-name')?.focus();return false;}
    if(name.length>40){toast('Keep the name to 40 characters');return false;}
    window._ob.name=name;return true;
  },
  'set:about':()=>{
    const ht=parseFloat(document.getElementById('ob-height')?.value);
    if(ht){const hr=SANE.height[S.unit==='kg'?'cm':'in'];if(!(ht>=hr[0]&&ht<=hr[1])){toast(`Height should be between ${hr[0]} and ${hr[1]} ${S.unit==='kg'?'cm':'in'}`);return false;}}
    const by=parseInt(document.getElementById('ob-byear')?.value);const yr=new Date().getFullYear();
    if(by&&!(by>=yr-100&&by<=yr-13)){toast(`Birth year should be between ${yr-100} and ${yr-13}`);return false;}
    return true;
  },
  'set:body':()=>{
    const raw=String(document.getElementById('ob-bw')?.value||'').trim();if(!raw)return true;
    const bw=parseFloat(raw);if(!saneBw(bw)){toast(saneBwMsg());return false;}
    S.bodyweight=bw;S.bodyweightLog=[{date:today(),weight:bw}].concat((S.bodyweightLog||[]).filter(b=>b.date!==today()));
    const g=parseFloat(document.getElementById('ob-goalw')?.value);
    if(g>0){if(!saneBw(g)){toast(saneBwMsg());return false;}S.weightGoal=g;S.weightGoalDir=Math.abs(g-bw)<0.5?'maintain':g<bw?'lose':'gain';}
    return true;
  },
  'set:food':()=>{
    const k=parseFloat(document.getElementById('ob-kcal')?.value),p=parseFloat(document.getElementById('ob-prot')?.value);
    if(!(k>=calorieFloor()&&k<=8000)){toast(`Calories should be between ${calorieFloor().toLocaleString()} and 8,000`);return false;}
    if(!(p>=20&&p<=400)){toast('Protein should be between 20 and 400 g');return false;}
    const t=window._ob.targets||{};
    // Carbs and fat fill the rest the way the targets builder splits them.
    let fat=Math.round(Math.max((t.fat||0),k*0.25/9)/5)*5;let carbs=Math.max(50,Math.floor((k-p*4-fat*9)/4/5)*5);
    if(p*4+fat*9+carbs*4>k+60)fat=Math.max(20,Math.round((k-p*4-carbs*4)/9/5)*5);
    S.macroGoals=Object.assign({},S.macroGoals,{cals:Math.round(k),protein:Math.round(p),carbs,fat});
    return true;
  },
  'set:habits':()=>{
    const want=Object.keys(window._ob.habits||{}).filter(k=>window._ob.habits[k]);
    want.forEach(k=>{const tpl=OB_HABITS.find(h=>h.k===k);if(!tpl)return;
      if((S.habits||[]).some(h=>tpl.auto?h.auto===tpl.auto:h.name===tpl.name))return;
      habitCreate(tpl.auto?{id:uid(),type:'auto',auto:tpl.auto,days:[0,1,2,3,4,5,6],from:today()}:{id:uid(),type:tpl.type,name:tpl.name,days:[0,1,2,3,4,5,6],from:today()});});
    return true;
  },
};
// Step 2: what an import brought, and the modules it implies.
function obImport(){
  showAppImport();
  // Coming back from the import sheet redraws this screen with what came in.
  const ov=document.getElementById('ixmp-ov');if(ov){const prev=ov._onDismiss;ov._onDismiss=()=>{try{if(prev)prev();}finally{setTimeout(obRedraw,60);}};}
}
function obImportCounts(){
  const w=(S.workouts||[]).length,b=(S.bodyweightLog||[]).length,a=(S.activities||[]).filter(x=>!x.wkId).length,m=(S.measurements||[]).length;
  const bits=[w?`${w.toLocaleString()} workout${w===1?'':'s'}`:'',b?`${b.toLocaleString()} weigh-in${b===1?'':'s'}`:'',a?`${a.toLocaleString()} activit${a===1?'y':'ies'}`:'',m?`${m} day${m===1?'':'s'} of measurements`:''].filter(Boolean);
  return{any:bits.length>0,text:bits.join(' · ')};
}
// Pre-ticks what the data already holds. Only ever turns things on: the picker is still theirs.
function obPrecheck(){
  const on=k=>{S.modules[k]=true;};
  if((S.bodyweightLog||[]).length){on('body');on('weight');}
  if((S.measurements||[]).length){on('body');on('measure');}
  if((S.activities||[]).some(a=>!a.wkId)){on('cardio');}
  if((S.meals||[]).length||Object.keys(S.macroLogs||{}).length)on('nutrition');
  if((S.habits||[]).length||Object.keys(S.moodLog||{}).length)on('habits');
  if((S.workouts||[]).length>=PAT.MIN*2)on('patterns');
}
// The setup screens.
const OB_HABITS=[
  {k:'trained',auto:'trained',name:'Trained',icon:'dumbbell',need:'workouts'},
  {k:'weigh',auto:'weigh',name:'Weighed in',icon:'scale',need:'weight'},
  {k:'protein',auto:'protein',name:'Hit protein',icon:'meat',need:'nutrition'},
  {k:'sleep',auto:'sleep',name:'Slept 7 h+',icon:'moon',need:'sleep'},
  {k:'read',type:'done',name:'Read',icon:'check'},
  {k:'walk',type:'done',name:'Walk outside',icon:'walk'},
  {k:'stretch',type:'done',name:'Stretch',icon:'figure'},
  {k:'alcohol',type:'avoid',name:'No alcohol',icon:'x'},
];
const OB_SET={
  about:()=>{const kg=S.unit==='kg';const htVal=S.profileSet.height&&S.height?(kg?Math.round(S.height*2.54):S.height):'';
    return`<div class="fg"><label class="fl">Main goal</label><div class="ob-goals">${GOALS.map(g=>`<button class="eq-preset${S.goal===g.id?' on':''}" id="gc-${g.id}" onclick="obGoal('${g.id}')"><span class="ob-gi">${ICON(g.icon,18)}</span><span><b>${g.label}</b><i>${g.sub}</i></span></button>`).join('')}</div></div>
    <div class="fg"><label class="fl">Sex</label>${obSeg('ob-sex',[['male','Male'],['female','Female']],S.profileSet.sex?S.aftGender:'','obSex')}</div>
    <div class="frow" style="gap:10px;margin-bottom:14px">
      <div style="flex:1.4"><label class="fl">Birth month</label><select id="ob-bmonth"><option value="">—</option>${MONTHS.map((m,i)=>`<option value="${i+1}"${S.birthMonth===i+1?' selected':''}>${m}</option>`).join('')}</select></div>
      <div style="flex:1"><label class="fl">Birth year</label><input type="number" inputmode="numeric" id="ob-byear" placeholder="1990" value="${S.birthYear||''}"></div>
      <div style="flex:1"><label class="fl">Height (${kg?'cm':'in'})</label><input type="number" inputmode="decimal" id="ob-height" placeholder="${kg?'175':'69'}" value="${htVal}"></div>
    </div>`;},
  body:()=>{const last=(S.bodyweightLog||[])[0];
    return`<div class="frow" style="gap:10px">
      <div style="flex:1"><label class="fl">Weight now (${S.unit})</label><input type="number" inputmode="decimal" step="0.1" id="ob-bw" placeholder="${S.unit==='kg'?'84':'185'}" value="${last&&last.date===today()?last.weight:''}"></div>
      <div style="flex:1"><label class="fl">Goal weight <small>optional</small></label><input type="number" inputmode="decimal" step="0.1" id="ob-goalw" placeholder="—" value="${S.weightGoal||''}"></div>
    </div>
    ${modOn('photos')?`<div class="ob-note">${ICON('camera',15)}<span>Progress photos are on the Progress tab. Take a first set whenever you like; they stay in the app, never in your camera roll.</span></div>`:''}
    ${modOn('measure')?`<div class="ob-note">${ICON('ruler',15)}<span>Measurements are logged from their tile on Progress.</span></div>`:''}`;},
  food:()=>{
    const z=window._ob;const dir=z.dir||bldDirDefault();let t=null;
    try{t=bldTargets(dir);}catch(e){logError(e,'onboarding targets');}
    z.targets=t;
    const k=t?t.kcal:(S.macroGoals||{}).cals||2000,p=t?t.protein:(S.macroGoals||{}).protein||150;
    return`<div class="fg"><label class="fl">Aim to</label>${obSeg('ob-dir',[['lose','Lose'],['maintain','Maintain'],['gain','Gain']],dir,'obDir')}</div>
    <div class="frow" style="gap:10px">
      <div style="flex:1"><label class="fl">Calories a day</label><input type="number" inputmode="numeric" id="ob-kcal" value="${Math.round(k)}"></div>
      <div style="flex:1"><label class="fl">Protein (g)</label><input type="number" inputmode="numeric" id="ob-prot" value="${Math.round(p)}"></div>
    </div>
    ${t?`<div class="fine">${esc(t.why[0]||'')} ${esc(t.why[1]||'')}</div>`:''}
    ${(()=>{const g=profileGaps();return g.length?`<div class="fine">Estimated with ${esc(g.map(x=>x.text).join('; '))}. Going back a step to fill ${g.length===1?'it':'them'} in makes it closer.</div>`:'';})()}
    <div class="fine">Separate targets for rest days, and the full split of carbs and fat, are in Settings → Goals & targets.</div>`;},
  cardio:()=>`<div class="ob-opts"><button class="ob-opt" onclick="showStravaImport()"><span class="ob-opt-i">${ICON('run',20)}</span><span class="ob-opt-m"><b>Import from Strava</b><i>Your archive: runs, rides and their routes</i></span>${ICON('chev',16)}</button></div>
    <div class="ob-note">${ICON('trendup',15)}<span>${modOn('running')?`Running analysis (weekly miles, best efforts, race times) switches itself on after ${RUN_AUTO_MIN} runs with a distance.`:'Running analysis is off; turn it on under Cardio & runs whenever you want it.'}</span></div>`,
  habits:()=>{const z=window._ob;const opts=OB_HABITS.filter(h=>!h.need||h.need==='workouts'||modOn(h.need));
    return`<div class="ob-habs">${opts.map(h=>`<button class="chip${z.habits[h.k]?' on':''}" aria-pressed="${!!z.habits[h.k]}" onclick="obHabit('${h.k}')">${ICON(h.icon,13)} ${esc(h.name)}${h.auto?'<small>ticks itself</small>':''}</button>`).join('')}</div>
    <div class="fine">More types (an amount to reach, a schedule of days) are on the Habits page later.</div>
    <div class="ob-note">${ICON('check',15)}<span>Asked each morning: ${[modOn('mood')?'how yesterday went':'',modOn('sleep')?'last night’s sleep':'',modOn('habitlist')?'yesterday’s habits':''].filter(Boolean).join(', ')||'nothing yet'}.</span></div>`;},
  coach:()=>`<div class="ob-note">${ICON('bolt',15)}<span>Built in, no key: a quick workout, a program, why a lift is stuck, food targets, a week of meals, a review of your week.</span></div>
    <div class="ob-opts"><button class="ob-opt" onclick="showAiSettings()"><span class="ob-opt-i">${ICON('spark',20)}</span><span class="ob-opt-m"><b>${aiReady()?'AI coach is set up':'Add an AI key'}</b><i>${aiReady()?'Change it in Settings → Connections':'Optional. Your own key, kept on this phone only'}</i></span>${ICON('chev',16)}</button></div>`,
};
function obGoal(id){S.goal=GOALS.some(g=>g.id===id)?id:'general';document.querySelectorAll('[id^="gc-"]').forEach(el=>el.classList.toggle('on',el.id===`gc-${S.goal}`));}
function obSex(g){S.aftGender=g==='female'?'female':'male';S.profileSet.sex=true;obSegSet('ob-sex',S.aftGender);}
function obDir(d){window._ob.dir=d;obRedraw();}
function obHabit(k){const z=window._ob;z.habits[k]=!z.habits[k];obRedraw();}

// Start: the profile is saved, the modules are the ones picked, and Home opens.
function finishOb(){
  const z=window._ob||{};
  const name=String(z.name||S.name||'').trim();
  if(!name){obGo(0);toast('Enter your name');return;}
  S.name=name.slice(0,40);
  if(!(S.bodyweightLog||[]).length&&!(parseFloat(S.bodyweight)>0))S.bodyweight=S.unit==='kg'?84:185;
  S.modules=normalizeModules(S.modules,MOD_DEFAULT);
  S.modIntro=false;S.modSince=today();S.modReview={};S.modSuggest={at:Date.now(),mute:{},cur:null};
  if(!HOME_LAYOUTS.some(l=>l.id===S.homeLayout))S.homeLayout='balanced';
  S.homeView='';S.onboarded=true;
  window._ob=null;
  saveNow();
  try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();}catch(e){}
  document.getElementById('nav').style.display='flex';
  document.getElementById('content').style.paddingBottom='';
  go('workout');
}
