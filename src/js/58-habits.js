// ═══════════════════════════════════════════════════
// HABITS AND MOOD
// ═══════════════════════════════════════════════════
// A habit is something you mean to do (or not do) on certain days. Four kinds:
//   done    tick it                              "Read 10 pages"
//   amount  reach a number                       "Water 100 oz"
//   avoid   counts as kept unless you mark a slip "No alcohol"
//   auto    ticks itself from what you already log ("Hit protein", "Trained", "Slept 7 h+")
// Mood is one rating a day (1-5), asked the next morning in the daily check-in so the day is over
// when it is rated. Patterns (39-patterns.js) tests habits and the other logs against it.
//
// The rules that keep the numbers honest:
//  - A day with nothing at all logged in the app is BLANK for manual habits, not a miss and not a
//    win: the app cannot tell "did not do it" from "did not open the app". Blank days are left out
//    of streaks, percentages and Patterns. (An avoid habit would otherwise score every forgotten
//    day as kept.)
//  - Today is never a miss: it is open until it is over.
//  - Streaks forgive one missed day; two scheduled misses in a row end them ("never miss twice").
//  - Strength is a slow average of hits (about half its weight in the last 13 scheduled days),
//    so one miss after a long run barely dents it.
const HABIT_MAX=12;           // active habits at once; a short list is one that gets kept
const HABIT_FIX_DAYS=7;       // how far back a manual habit can be ticked from its sheet
const HABIT_K=Math.pow(0.5,1/13); // strength: weight left after one scheduled day
const MOODS=[{v:1,l:'Awful'},{v:2,l:'Bad'},{v:3,l:'Okay'},{v:4,l:'Good'},{v:5,l:'Great'}];
const HABIT_TYPES=[{id:'done',l:'Done'},{id:'amount',l:'Amount'},{id:'avoid',l:'Avoid'}];
const HABIT_SCHED=[{id:'daily',l:'Daily',days:[0,1,2,3,4,5,6]},{id:'weekdays',l:'Weekdays',days:[1,2,3,4,5]},{id:'weekends',l:'Weekends',days:[0,6]},{id:'pick',l:'Pick days',days:null}];
const DOW1=['S','M','T','W','T','F','S'];
const DOW3=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Habits that tick themselves. known(ds): whether the app can say anything about that day
// (no food logged → nothing to say about protein). val(ds): the number shown, when there is one.
const AUTO_HABITS={
  trained:{name:()=>'Trained',icon:'dumbbell',plan:true,from:'your workouts',
    known:()=>true,done:ds=>(S.workouts||[]).some(w=>dayOf(w.started)===ds)},
  cardio:{name:()=>'Cardio',icon:'run',from:'your activities',
    known:()=>true,done:ds=>(S.activities||[]).some(a=>a.date===ds)},
  food:{name:()=>'Logged food',icon:'utensils',from:'your food log',
    known:()=>true,done:ds=>(getDayTotals(ds).cals||0)>0},
  protein:{name:()=>'Hit protein',icon:'meat',from:'your food log',
    known:ds=>(getDayTotals(ds).cals||0)>0&&((goalsFor(ds)||{}).protein||0)>0,
    done:ds=>getDayTotals(ds).protein>=((goalsFor(ds)||{}).protein||Infinity)},
  cals:{name:()=>'Calories on target',icon:'apple',from:'your food log',
    known:ds=>(getDayTotals(ds).cals||0)>0&&((goalsFor(ds)||{}).cals||0)>0,
    done:ds=>{const g=(goalsFor(ds)||{}).cals||0;return g>0&&Math.abs(getDayTotals(ds).cals-g)<=g*0.1;}},
  sleep:{name:h=>`Slept ${h.target||7} h+`,icon:'moon',from:'the check-in',target:7,
    known:ds=>(S.sleepLog||{})[ds]>0,done:(ds,h)=>(S.sleepLog||{})[ds]>=(h.target||7)},
  steps:{name:h=>`${(h.target||10000).toLocaleString()} steps`,icon:'footsteps',from:'your steps',target:10000,
    known:ds=>(S.stepsLog||{})[ds]>0,done:(ds,h)=>(S.stepsLog||{})[ds]>=(h.target||10000)},
  supps:{name:()=>'All supplements',icon:'pill',from:'Supplements',
    known:ds=>dayLogged(ds),done:ds=>{const l=(S.suppLogs||{})[ds]||{};return(S.supps||[]).length>0&&S.supps.every(x=>l[x.id]);}},
  weigh:{name:()=>'Weighed in',icon:'scale',from:'your weigh-ins',
    known:()=>true,done:ds=>(S.bodyweightLog||[]).some(b=>b.date===ds)},
};
function autoOffered(id){return id!=='supps'||(S.supps||[]).length>0;}

// ─── Stored shape ───
function normalizeHabits(v){
  if(!Array.isArray(v))return[];
  const seen=new Set();
  return v.filter(isObj).map(h=>{
    const o={id:String(h.id||uid()).replace(/[^0-9A-Za-z_\-]/g,'').slice(0,40)||uid(),
      name:String(h.name||'').replace(/\s+/g,' ').trim().slice(0,40),
      type:['done','amount','avoid','auto'].includes(h.type)?h.type:'done',
      days:Array.isArray(h.days)?[...new Set(h.days.map(Number))].filter(n=>n>=0&&n<=6).sort():[0,1,2,3,4,5,6],
      from:/^\d{4}-\d{2}-\d{2}$/.test(h.from)?h.from:today(),
      archived:!!h.archived};
    if(!o.days.length)o.days=[0,1,2,3,4,5,6];
    if(o.type==='amount'){o.target=Math.max(0.1,Math.min(100000,parseFloat(h.target)||1));o.unit=String(h.unit||'').trim().slice(0,12);}
    if(o.type==='auto'){
      o.auto=AUTO_HABITS[h.auto]?h.auto:null;if(!o.auto)return null;
      if(AUTO_HABITS[o.auto].target)o.target=Math.max(1,Math.min(100000,parseFloat(h.target)||AUTO_HABITS[o.auto].target));
      o.plan=AUTO_HABITS[o.auto].plan?h.plan!==false:false;
      o.name=habitAutoName(o);
    }
    if(!o.name)return null;
    if(seen.has(o.id))o.id=uid();seen.add(o.id);
    return o;
  }).filter(Boolean).slice(0,60);
}
// habitLog: {date: {habitId: value}}. done → 1; amount → the number; avoid → 1 means slipped.
function normalizeHabitLog(v,habits){
  const out={};if(!isObj(v))return out;
  const ids=new Set((habits||[]).map(h=>h.id));
  Object.keys(v).sort().slice(-1500).forEach(ds=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(ds)||!isObj(v[ds]))return;
    const d={};Object.keys(v[ds]).forEach(id=>{if(!ids.has(id))return;const n=parseFloat(v[ds][id]);if(n>0&&n<1e6)d[id]=Math.round(n*100)/100;});
    if(Object.keys(d).length)out[ds]=d;
  });
  return out;
}
function normalizeMoodLog(v){
  const out={};if(!isObj(v))return out;
  Object.keys(v).sort().slice(-1500).forEach(ds=>{const n=parseInt(v[ds]);if(/^\d{4}-\d{2}-\d{2}$/.test(ds)&&n>=1&&n<=5)out[ds]=n;});
  return out;
}
function habitAutoName(h){const a=AUTO_HABITS[h.auto];return a?a.name(h):h.name;}
function activeHabits(){return(S.habits||[]).filter(h=>!h.archived);}
function habitById(id){return(S.habits||[]).find(h=>h.id===id)||null;}

// ─── A habit on a day ───
// Any trace of the user in the app that day. Memoised: it is asked for every cell of every grid.
function loggedDays(){
  return memo('habLogged',()=>{
    const s=new Set();
    (S.workouts||[]).forEach(w=>s.add(dayOf(w.started)));
    (S.activities||[]).forEach(a=>s.add(a.date));
    (S.meals||[]).forEach(m=>s.add(m.date));
    Object.keys(S.macroLogs||{}).forEach(d=>{const l=S.macroLogs[d];if(isObj(l)&&(+l.cals||+l.protein))s.add(d);});
    (S.bodyweightLog||[]).forEach(b=>s.add(b.date));
    [S.sleepLog,S.moodLog,S.habitLog].forEach(o=>Object.keys(o||{}).forEach(d=>s.add(d)));
    Object.keys(S.suppLogs||{}).forEach(d=>{const l=S.suppLogs[d];if(isObj(l)&&Object.values(l).some(Boolean))s.add(d);});
    Object.keys(S.stepsLog||{}).forEach(d=>{if(S.stepsLog[d]>0)s.add(d);});
    return s;
  });
}
function dayLogged(ds){return loggedDays().has(ds);}
function habitScheduled(h,ds){
  if(ds<h.from)return false;
  if(isPaused(ds))return false; // paused: not due, so neither done nor missed (86-pause.js)
  if(h.type==='auto'&&h.plan&&hasFixedSchedule())return isTrainingDay(ds);
  return h.days.includes(dayDate(ds).getDay());
}
// → {st, v, frac}
//   st: off (not scheduled) | done | miss | open (today, not done yet) | blank (nothing logged that day)
//   For avoid: done = kept, miss = slipped, open = kept so far today.
function habitDay(h,ds){
  if(!habitScheduled(h,ds))return{st:'off'};
  const td=today();if(ds>td)return{st:'off'};
  const rec=((S.habitLog||{})[ds]||{})[h.id];
  if(h.type==='auto'){
    const a=AUTO_HABITS[h.auto];if(!a)return{st:'off'};
    if(a.known(ds,h)&&a.done(ds,h))return{st:'done'};
    if(ds===td)return{st:'open'};
    return{st:a.known(ds,h)?'miss':'blank'};
  }
  if(h.type==='done'){if(rec)return{st:'done'};return{st:ds===td?'open':dayLogged(ds)?'miss':'blank'};}
  if(h.type==='amount'){
    const v=rec||0;const frac=Math.min(1,v/h.target);
    if(v>=h.target)return{st:'done',v,frac};
    return{st:ds===td?'open':dayLogged(ds)?'miss':'blank',v,frac};
  }
  // avoid
  if(rec)return{st:'miss',slip:true};
  return{st:ds===td?'open':dayLogged(ds)?'done':'blank'};
}
// Counted toward today's tally: done, or an avoid habit not broken yet.
function habitOkToday(h){const d=habitDay(h,today());return d.st==='done'||(h.type==='avoid'&&d.st==='open');}

// Streak, best streak, strength and the last four weeks, from the habit's first day.
function habitStats(h){
  return memo('habStats:'+h.id,()=>{
    const td=today();const days=[];
    const start=h.from<daysAgoStr(800)?daysAgoStr(800):h.from;
    for(let ds=start;ds<=td;ds=addDays(ds,1)){const d=habitDay(h,ds);if(d.st==='done'||d.st==='miss')days.push({ds,ok:d.st==='done'});}
    // strength (forward)
    let s=0;days.forEach(d=>{s=s*HABIT_K+(d.ok?1-HABIT_K:0);});
    // best streak (forward, never miss twice)
    let best=0,run=0,missRun=0;
    days.forEach(d=>{if(d.ok){run++;missRun=0;}else{missRun++;if(missRun>=2)run=0;}if(run>best)best=run;});
    // current streak (backward)
    let cur=0,miss=0,atRisk=false;
    for(let i=days.length-1;i>=0;i--){
      if(days[i].ok){cur++;miss=0;}
      else{if(i===days.length-1)atRisk=true;miss++;if(miss>=2){break;}}
    }
    if(miss>=2&&cur===0)atRisk=false;
    const from28=daysAgoStr(28);const w=days.filter(d=>d.ds>=from28&&d.ds<td);
    const pct=w.length?Math.round(w.filter(d=>d.ok).length/w.length*100):null;
    return{streak:cur,best,strength:Math.round(s*100),atRisk:atRisk&&cur>0,pct,n28:w.length};
  });
}
function habitSchedText(h){
  if(h.type==='auto'&&h.plan&&hasFixedSchedule())return'Training days';
  const d=h.days.join(',');
  if(d==='0,1,2,3,4,5,6')return'Daily';if(d==='1,2,3,4,5')return'Weekdays';if(d==='0,6')return'Weekends';
  return h.days.map(x=>DOW3[x]).join(' ');
}
function habitTargetText(h){
  if(h.type==='amount')return`${fmtNum(h.target)}${h.unit?' '+h.unit:''}`;
  return'';
}
function fmtNum(v){v=+v||0;return Math.abs(v-Math.round(v))<0.01?Math.round(v).toLocaleString():(Math.round(v*10)/10).toLocaleString();}
function habitIcon(h){return h.type==='auto'?(AUTO_HABITS[h.auto]||{}).icon||'check':h.type==='avoid'?'x':h.type==='amount'?'droplet':'check';}

// ─── Changing a habit's day ───
function habitLogSet(ds,id,val){
  if(!isObj(S.habitLog))S.habitLog={};
  const d=S.habitLog[ds]||(S.habitLog[ds]={});
  if(val>0)d[id]=val;else delete d[id];
  if(!Object.keys(d).length)delete S.habitLog[ds];
}
function habitToggle(id,ds){
  const h=habitById(id);if(!h||h.type==='auto'||h.type==='amount')return;
  ds=ds||today();if(ds>today())return;
  const cur=((S.habitLog||{})[ds]||{})[id];
  habitLogSet(ds,id,cur?0:1);save();
  if(navigator.vibrate)try{navigator.vibrate(8);}catch(e){}
  habitsRefresh();
}
function habitAmountSet(id,ds,v){
  const h=habitById(id);if(!h||h.type!=='amount')return;
  v=Math.max(0,Math.min(100000,parseFloat(v)||0));
  habitLogSet(ds,id,Math.round(v*100)/100);save();habitsRefresh();
}
function habitAmountAdd(id,ds,step){
  const cur=(((S.habitLog||{})[ds]||{})[id])||0;habitAmountSet(id,ds,cur+step);
}
// A sensible step for the + button: a quarter of the target, rounded to something you would type.
function habitStep(h){
  const q=h.target/4;if(q>=1000)return Math.round(q/500)*500||500;if(q>=100)return Math.round(q/50)*50||50;if(q>=10)return Math.round(q/5)*5||5;if(q>=1)return Math.round(q);return Math.round(q*10)/10||0.1;
}
function setMood(ds,v){
  if(!isObj(S.moodLog))S.moodLog={};
  if(S.moodLog[ds]===v)delete S.moodLog[ds];else S.moodLog[ds]=v;
  save();habitsRefresh();
}
// Redraw whatever shows habits: the page, the check-in, a habit's sheet, a calendar.
function habitsRefresh(){
  bumpMemo();
  if(document.getElementById('bw-ov'))renderCheckInBody();
  if(document.getElementById('hab1-ov')&&_habOpen)renderHabitSheet();
  if(document.getElementById('habs-ov'))renderHabitsSheet();
  if(document.getElementById('calday-ov')&&_calDay)renderCalDay();
  if(document.getElementById('calr-ov'))calRefresh();
  const c=document.getElementById('content');
  // The page under any open sheet is redrawn too, so what was just added or ticked is already there
  // when the sheet closes. (Sheets live outside #content; redrawing the page does not touch them.)
  if(c){const y=c.scrollTop;render();c.scrollTop=y;}
}

// ─── Mood helpers ───
function moodAvg(fromDs,toDs){
  const v=Object.keys(S.moodLog||{}).filter(d=>d>=fromDs&&d<=toDs).map(d=>S.moodLog[d]);
  return v.length?{avg:v.reduce((a,b)=>a+b,0)/v.length,n:v.length}:null;
}
function fmtMood(v){return(Math.round((+v||0)*10)/10).toFixed(1);}
function moodUsed(){return Object.keys(S.moodLog||{}).length>0;}
function moodAsked(){return S.trackMood!==false;}
function moodChipsHTML(ds,small){
  const cur=(S.moodLog||{})[ds];
  return`<div class="feel-row mood-row${small?' mood-sm':''}" role="group" aria-label="Mood for ${esc(fmtDay(ds))}">${MOODS.map(m=>`<button class="chip mood-c m${m.v}${cur===m.v?' on':''}" aria-pressed="${cur===m.v?'true':'false'}" onclick="setMood(${jsq(ds)},${m.v})"><i></i>${m.l}</button>`).join('')}</div>`;
}
function moodStripHTML(n){
  let h='';for(let i=n-1;i>=0;i--){const ds=daysAgoStr(i);const v=(S.moodLog||{})[ds];h+=`<i class="${v?'m'+v:''}" title="${esc(fmtDay(ds))}${v?': '+MOODS[v-1].l:''}"></i>`;}
  return`<span class="mood-strip" aria-label="Mood, last ${n} days">${h}</span>`;
}

// ─── Home ───
function homeHabitsArea(){
  const hs=activeHabits();const td=today();const y=daysAgoStr(1);
  if(!hs.length&&!(moodUsed()&&Object.keys(S.moodLog).some(d=>d>=daysAgoStr(14))))return null;
  const rateY=moodAsked()&&!(S.moodLog||{})[y];
  if(!hs.length){
    const m=moodAvg(daysAgoStr(7),y);
    return{k:'Mood',icon:'spark',val:m?fmtMood(m.avg):'–',unit:'/ 5 · 7 d',sub:rateY?'Rate yesterday · check in':'',js:"go('habits')",tone:'info'};
  }
  const due=hs.filter(h=>habitDay(h,td).st!=='off');
  const ok=due.filter(habitOkToday).length;
  const risk=hs.filter(h=>habitStats(h).atRisk).length;
  const top=hs.map(h=>({h,s:habitStats(h)})).sort((a,b)=>b.s.streak-a.s.streak)[0];
  let sub=rateY?'Rate yesterday · check in':due.length&&ok>=due.length?'all done today':risk?`${risk} at risk: missed yesterday`:top&&top.s.streak>=2?`${top.h.name} · ${top.s.streak} in a row`:due.length?`${due.length-ok} to go`:'nothing due today';
  return{k:'Habits',icon:'repeat',val:String(ok),unit:`/ ${due.length} today`,sub,pct:due.length?ok/due.length:null,tone:due.length&&ok>=due.length?'good':risk?'warn':'info',js:"go('habits')"}; // one tile, one place: the page asks for yesterday's mood too
}

// ─── The Habits page (a page of Home) ───
function renderHabitsPage(c){
  const hs=activeHabits();
  c.innerHTML=`<div class="ph"><div class="page-title">Habits</div><div class="ph-acts">${hs.length<HABIT_MAX?`<button class="btn bts bsm" onclick="showAddHabit()">${ICON('plus',14)} New</button>`:''}</div></div>`+habitsBodyHTML();
}
// The same habits, as a sheet over Progress (the Habits tile): one view of them, in two places.
function showHabitsSheet(){
  const ov=makeOv('habs-ov');
  ov.innerHTML=`<div class="modal habs-sheet" style="max-height:94vh"><div class="mh"></div><div id="habs-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderHabitsSheet();
}
function renderHabitsSheet(){
  const el=document.getElementById('habs-body');if(!el)return;const m=el.closest('.modal');const y=m?m.scrollTop:0;
  el.innerHTML=`<div class="ms-head" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><div class="mt" style="margin:0">Habits</div>${activeHabits().length<HABIT_MAX?`<button class="btn bts bsm" onclick="showAddHabit()">${ICON('plus',14)} New</button>`:''}</div>`+habitsBodyHTML();
  if(m)m.scrollTop=y;
}
function habitsBodyHTML(){
  const td=today();const y=daysAgoStr(1);const hs=activeHabits();
  let h='';
  // Mood: yesterday to rate, today once the evening comes, otherwise the last two weeks at a glance
  if(moodAsked()||moodUsed()){
    const m7=moodAvg(daysAgoStr(7),y),m14=moodAvg(daysAgoStr(14),daysAgoStr(8));
    const hr=new Date().getHours();
    h+=`<div class="sec-h sec-h-act"><span>Mood</span>${m7?`<span class="fine" style="margin:0">${fmtMood(m7.avg)} avg · 7 d${m14?` · ${m7.avg-m14.avg>=0?'+':'−'}${fmtMood(Math.abs(m7.avg-m14.avg))} on the week before`:''}</span>`:''}</div><div class="list hab-mood">`;
    h+=`<button class="row row-tap" onclick="showCalendar('mood')"><span class="row-main"><span class="row-t">Last 14 days</span>${moodStripHTML(14)}</span><span class="row-chev">${ICON('chev',16)}</span></button>`;
    if(moodAsked()&&!(S.moodLog||{})[y])h+=`<div class="row hab-mood-ask"><span class="row-main"><span class="row-t">How was yesterday?</span>${moodChipsHTML(y,true)}</span></div>`;
    if(moodAsked()&&(hr>=17||(S.moodLog||{})[td]))h+=`<div class="row hab-mood-ask"><span class="row-main"><span class="row-t">How was today?</span><span class="row-s">Best rated once the day is done. You can do it in tomorrow’s check-in instead.</span>${moodChipsHTML(td,true)}</span></div>`;
    h+=`</div>`;
  }
  if(!hs.length){
    h+=`<div class="list"><button class="row row-tap" onclick="showAddHabit()"><span class="row-ic tone-info">${ICON('plus',17)}</span><span class="row-main"><span class="row-t">Add your first habit</span><span class="row-s">Something you mean to do, reach or avoid, on the days you choose.</span></span></button></div>`;
    h+=`<div class="fine" style="margin:0 var(--gx)">Habits and your daily mood go into Patterns on Progress, which tests whether your good-habit days are also your better days. Expect nothing there for a few weeks: each comparison needs about ten days on each side.</div>`;
    return h;
  }
  const due=hs.filter(x=>habitDay(x,td).st!=='off'),later=hs.filter(x=>habitDay(x,td).st==='off');
  const ok=due.filter(habitOkToday).length;
  h+=`<div class="sec-h sec-h-act"><span>Today · ${ok} of ${due.length}</span><span class="fine" style="margin:0">${DOW3[dayDate(td).getDay()]}</span></div>`;
  h+=due.length?`<div class="list hab-list">${due.map(x=>habitRowHTML(x)).join('')}</div>`:`<div class="ch-empty" style="margin:0 var(--gx) 12px">Nothing is scheduled today.</div>`;
  if(later.length)h+=`<details class="fold hab-later"${window._habLaterOpen?' open':''} ontoggle="window._habLaterOpen=this.open"><summary>Not today · ${later.length}</summary><div class="list hab-list">${later.map(x=>habitRowHTML(x,true)).join('')}</div></details>`;
  h+=`<div class="hab-foot"><button class="btn bts bsm" onclick="showCalendar('habits')">${ICON('calendar',14)} Calendar</button><button class="btn bts bsm" onclick="coachStart('habits')">${ICON('spark',14)} Habits &amp; happiness</button></div>`;
  h+=`<div class="fine" style="margin:6px var(--gx)">Strength rises with every scheduled day you keep and fades slowly, so one miss after a long run barely moves it. A streak survives one missed day; two in a row end it. Days you logged nothing at all are left out rather than counted as misses.</div>`;
  return h;
}
// The last seven days of one habit as small bars, oldest first.
function habitStripHTML(h){
  let s='';for(let i=6;i>=0;i--){const ds=daysAgoStr(i);const d=habitDay(h,ds);s+=`<i class="hs-${d.st}${i===0?' hs-today':''}"></i>`;}
  return`<span class="hab-strip" aria-hidden="true">${s}</span>`;
}
function habitRowHTML(h,notToday){
  const td=today();const d=habitDay(h,td);const st=habitStats(h);
  const meta=[];
  if(st.streak>=2)meta.push(`${ICON('flame',11)} ${st.streak}${st.atRisk?' · at risk':''}`);
  meta.push(`strength ${st.strength}`);
  if(notToday)meta.push(habitSchedText(h));
  else if(h.type==='auto')meta.push('auto');
  let lead;
  if(notToday)lead=`<span class="hab-chk hs-off">${ICON(habitIcon(h),15)}</span>`;
  else if(h.type==='auto')lead=`<span class="hab-chk ${d.st==='done'?'is-done':''}" aria-label="${d.st==='done'?'Done':'Not yet'}, ticks itself">${ICON(d.st==='done'?'tick':habitIcon(h),15)}</span>`;
  else if(h.type==='amount')lead=`<button class="hab-chk ${d.st==='done'?'is-done':''}" onclick="habitAmountAdd(${jsq(h.id)},${jsq(td)},${habitStep(h)})" aria-label="Add ${habitStep(h)}">${d.st==='done'?ICON('tick',15):ICON('plus',15)}</button>`;
  else if(h.type==='avoid')lead=`<button class="hab-chk ${d.slip?'is-slip':'is-kept'}" onclick="habitToggle(${jsq(h.id)})" aria-label="${d.slip?'Slipped today, tap to undo':'Kept so far, tap to mark a slip'}">${ICON(d.slip?'x':'tick',15)}</button>`;
  else lead=`<button class="hab-chk ${d.st==='done'?'is-done':''}" onclick="habitToggle(${jsq(h.id)})" aria-label="${d.st==='done'?'Done, tap to undo':'Tap when done'}">${d.st==='done'?ICON('tick',15):''}</button>`;
  const right=h.type==='amount'&&!notToday?`<button class="hab-amt mono" onclick="showHabitAmount(${jsq(h.id)},${jsq(td)})">${fmtNum(d.v||0)}<small>/ ${esc(habitTargetText(h))}</small></button>`
    :h.type==='avoid'&&!notToday?`<span class="hab-tag ${d.slip?'tone-bad':'tone-good'}">${d.slip?'Slipped':'Kept'}</span>`:'';
  return`<div class="row hab-row">${lead}<button class="hab-main" onclick="showHabit(${jsq(h.id)})"><span class="row-t">${esc(h.name)}</span><span class="row-s hab-meta">${meta.join(' · ')}</span></button>${right}${habitStripHTML(h)}</div>`;
}
function showHabitAmount(id,ds){
  const h=habitById(id);if(!h)return;const cur=(((S.habitLog||{})[ds]||{})[id])||0;
  const ov=makeOv('hamt-ov');const step=habitStep(h);
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:4px">${esc(h.name)}</div>
    <div class="sheet-sub">${esc(fmtDay(ds))} · target ${esc(habitTargetText(h))}</div>
    <div class="fg"><div class="qty-row"><button class="btn bts" onclick="habAmtNudge(-${step})" aria-label="Less">−</button><input type="number" inputmode="decimal" id="hamt-v" value="${cur||''}" placeholder="0"><span>${esc(h.unit||'')}</span><button class="btn bts" onclick="habAmtNudge(${step})" aria-label="More">+</button></div></div>
    <button class="btn btp bfw" onclick="habitAmountSet(${jsq(id)},${jsq(ds)},document.getElementById('hamt-v').value);closeOv('hamt-ov')">Save</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function habAmtNudge(d){const i=document.getElementById('hamt-v');if(!i)return;i.value=String(Math.max(0,Math.round(((parseFloat(i.value)||0)+d)*100)/100));}

// ─── Adding a habit: a name, a type, the days. Everything else has a default. ───
let _hadd=null;
function showAddHabit(){
  if(activeHabits().length>=HABIT_MAX){toast(`${HABIT_MAX} habits is the limit. Archive one first.`);return;}
  _hadd={type:'done',sched:'daily',days:[0,1,2,3,4,5,6],target:'',unit:''};
  const ov=makeOv('hadd-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div class="mt" style="margin-bottom:12px">New habit</div><div id="hadd-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderAddHabit();
  setTimeout(()=>{const i=document.getElementById('hadd-name');if(i)i.focus();},260);
}
function renderAddHabit(){
  const el=document.getElementById('hadd-body');if(!el||!_hadd)return;const a=_hadd;
  const nameNow=(document.getElementById('hadd-name')||{}).value;if(nameNow!=null)a.name=nameNow;
  const tNow=document.getElementById('hadd-target');if(tNow){a.target=tNow.value;a.unit=document.getElementById('hadd-unit').value;}
  const ph={done:'e.g. Read 10 pages',amount:'e.g. Water',avoid:'e.g. No alcohol'}[a.type];
  const have=new Set(activeHabits().filter(h=>h.type==='auto').map(h=>h.auto));
  const autos=Object.keys(AUTO_HABITS).filter(k=>!have.has(k)&&autoOffered(k));
  el.innerHTML=`<div class="fg"><input type="text" id="hadd-name" maxlength="40" placeholder="${ph}" value="${esc(a.name||'')}" autocomplete="off" enterkeyhint="done" onkeydown="if(event.key==='Enter'){event.preventDefault();addHabit();}"></div>
    <div class="seg seg-in" style="margin:0 0 12px" role="group" aria-label="Kind of habit">${HABIT_TYPES.map(t=>`<button class="seg-b${a.type===t.id?' on':''}" aria-pressed="${a.type===t.id}" onclick="_hadd.type='${t.id}';renderAddHabit()">${t.l}</button>`).join('')}</div>
    ${a.type==='amount'?`<div class="fg hadd-amt"><label class="fl">Target each day</label><div class="frow"><input type="number" inputmode="decimal" id="hadd-target" placeholder="100" value="${esc(a.target||'')}"><input type="text" id="hadd-unit" maxlength="12" placeholder="oz, pages, min" value="${esc(a.unit||'')}"></div></div>`:''}
    ${a.type==='avoid'?`<div class="fine" style="margin:-4px 2px 12px">Counts as kept every day you log anything, unless you mark a slip.</div>`:''}
    <div class="fg"><label class="fl">Days</label><div class="feel-row" role="group" aria-label="Which days">${HABIT_SCHED.map(s=>`<button class="chip${a.sched===s.id?' on':''}" aria-pressed="${a.sched===s.id}" onclick="habAddSched('${s.id}')">${s.l}</button>`).join('')}</div>
      ${a.sched==='pick'?`<div class="feel-row rem-days" style="margin-top:8px" role="group" aria-label="Pick the days">${DOW1.map((l,i)=>`<button class="chip${a.days.includes(i)?' on':''}" aria-pressed="${a.days.includes(i)}" aria-label="${DOW3[i]}" onclick="habAddDay(${i})">${l}</button>`).join('')}</div>`:''}</div>
    <button class="btn btp bfw" onclick="addHabit()">Add habit</button>
    ${autos.length?`<div class="sec-h">Or one that ticks itself from what you already log</div><div class="hadd-autos">${autos.map(k=>`<button class="chip" onclick="addAutoHabit('${k}')">${ICON(AUTO_HABITS[k].icon,13)} ${esc(AUTO_HABITS[k].name({}))}</button>`).join('')}</div>`:''}`;
}
function habAddSched(id){const s=HABIT_SCHED.find(x=>x.id===id);_hadd.sched=id;if(s.days)_hadd.days=s.days.slice();renderAddHabit();}
function habAddDay(i){const d=_hadd.days;const k=d.indexOf(i);if(k>=0){if(d.length>1)d.splice(k,1);}else d.push(i);d.sort();renderAddHabit();}
function addHabit(){
  const a=_hadd;if(!a)return;
  const name=String((document.getElementById('hadd-name')||{}).value||'').replace(/\s+/g,' ').trim();
  if(!name){toast('Give the habit a name');try{document.getElementById('hadd-name').focus();}catch(e){}return;}
  const o={id:uid(),name,type:a.type,days:a.days.slice(),from:today()};
  if(a.type==='amount'){
    const t=parseFloat((document.getElementById('hadd-target')||{}).value);
    if(!(t>0)){toast('Set the daily target');try{document.getElementById('hadd-target').focus();}catch(e){}return;}
    o.target=t;o.unit=String((document.getElementById('hadd-unit')||{}).value||'').trim().slice(0,12);
  }
  if(activeHabits().some(h=>h.name.toLowerCase()===name.toLowerCase())){toast('You already have a habit with that name');return;}
  habitCreate(o);closeOv('hadd-ov');toast(`${name} added`,'green');
}
function addAutoHabit(k){
  const a=AUTO_HABITS[k];if(!a)return;
  const o={id:uid(),type:'auto',auto:k,days:[0,1,2,3,4,5,6],from:today()};if(a.target)o.target=a.target;
  habitCreate(o);closeOv('hadd-ov');toast(`${habitAutoName(o)} added`,'green');
}
// The one way a habit comes into being (the add sheet and the coach both use it). → the stored habit, or null.
function habitCreate(o){
  if(activeHabits().length>=HABIT_MAX)return null;
  const h=normalizeHabits([o])[0];if(!h)return null;
  // An auto habit can start from its first day of data: its history is already in the log.
  if(h.type==='auto')h.from=habitAutoFrom(h);
  S.habits.push(h);save();
  if(S.tab==='workout')S.homeView='habits';
  habitsRefresh();
  return h;
}
function habitAutoFrom(h){
  const first={trained:()=>S.workouts.length?dayOf(S.workouts[S.workouts.length-1].started):null,
    cardio:()=>S.activities.map(a=>a.date).sort()[0],weigh:()=>(S.bodyweightLog[S.bodyweightLog.length-1]||{}).date,
    sleep:()=>Object.keys(S.sleepLog||{}).sort()[0],steps:()=>Object.keys(S.stepsLog||{}).filter(d=>S.stepsLog[d]>0).sort()[0]}[h.auto];
  let f=null;try{f=first?first():null;}catch(e){f=null;}
  if(!f){const d=[...Object.keys(S.macroLogs||{}),...(S.meals||[]).map(m=>m.date)].sort()[0];f=['food','protein','cals'].includes(h.auto)?d:null;}
  const floor=daysAgoStr(365);
  return f&&f<today()?(f<floor?floor:f):today();
}

// ─── One habit ───
let _habOpen=null;
function showHabit(id){
  if(!habitById(id))return;_habOpen={id,edit:false};
  const ov=makeOv('hab1-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div id="hab1-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderHabitSheet();
}
function renderHabitSheet(){
  const el=document.getElementById('hab1-body');if(!el||!_habOpen)return;
  const h=habitById(_habOpen.id);if(!h){closeOv('hab1-ov');return;}
  const st=habitStats(h);const td=today();
  const sub=[h.type==='auto'?`Ticks itself from ${AUTO_HABITS[h.auto].from}`:{done:'Done',amount:`Reach ${habitTargetText(h)}`,avoid:'Avoid'}[h.type],habitSchedText(h)];
  if(h.archived)sub.push('archived');
  // 12 weeks as a grid: a column per week, the week's first day (Settings) at the top
  const mon=weekStartOf(td);let cells='';
  for(let w=11;w>=0;w--){const m=addDays(mon,-7*w);cells+='<span class="hg-col">';for(let i=0;i<7;i++){const ds=addDays(m,i);const d=ds>td?{st:'fut'}:habitDay(h,ds);cells+=`<i class="hs-${d.st}" title="${esc(fmtDay(ds))}"></i>`;}cells+='</span>';}
  // Mood on days it was done against days it was not: counted, not tested
  const mood=habitMoodSplit(h);
  let pat=null;try{const res=patCached(()=>{if(_habOpen)renderHabitSheet();});pat=res?res.all.filter(r=>r.test.habit===h.id&&(r.tier==='solid'||r.tier==='likely'||r.tier==='early')):null;}catch(e){pat=null;}
  // Fixing the last seven days (manual habits)
  let fix='';
  if(h.type!=='auto'&&!h.archived){
    const days=[];for(let i=HABIT_FIX_DAYS-1;i>=0;i--)days.push(daysAgoStr(i));
    fix=`<div class="sec-h">Last ${HABIT_FIX_DAYS} days <span class="fine" style="margin:0">· tap to fix</span></div><div class="hab-fix">${days.map(ds=>{const d=habitDay(h,ds);
      const lbl=`${DOW1[dayDate(ds).getDay()]}<small>${dayDate(ds).getDate()}</small>`;
      if(d.st==='off')return`<span class="hf hs-off">${lbl}</span>`;
      if(h.type==='amount')return`<button class="hf hs-${d.st}" onclick="showHabitAmount(${jsq(h.id)},${jsq(ds)})">${lbl}</button>`;
      return`<button class="hf hs-${d.st}" aria-pressed="${d.st==='done'}" onclick="habitToggle(${jsq(h.id)},${jsq(ds)})">${lbl}</button>`;}).join('')}</div>
      ${h.type==='avoid'?'<div class="fine">For an avoid habit a tap marks a slip on that day; tap again to take it back.</div>':''}`;
  }
  el.innerHTML=`<div class="mt" style="margin-bottom:2px">${esc(h.name)}</div><div class="sheet-sub" style="margin-bottom:10px">${esc(sub.join(' · '))}</div>
    <div class="st-grid st-4">
      <div class="st"><div class="st-v">${st.streak}${st.atRisk?'<small class="dl dl-warn"> !</small>':''}</div><div class="st-l">Streak</div></div>
      <div class="st"><div class="st-v">${st.best}</div><div class="st-l">Best</div></div>
      <div class="st"><div class="st-v">${st.strength}</div><div class="st-l">Strength</div></div>
      <div class="st"><div class="st-v">${st.pct==null?'–':st.pct+'%'}</div><div class="st-l">4 weeks</div></div>
    </div>
    ${st.atRisk?`<div class="note-box" style="margin-top:4px"><b>Missed yesterday.</b> Keep it today and the streak carries on; miss again and it resets.</div>`:''}
    <div class="sec-h">12 weeks</div>
    <div class="hab-grid" role="img" aria-label="The last twelve weeks, a column a week">${cells}</div>
    <div class="hab-key"><span><i class="hs-done"></i>${h.type==='avoid'?'Kept':'Done'}</span><span><i class="hs-miss"></i>${h.type==='avoid'?'Slipped':'Missed'}</span><span><i class="hs-blank"></i>Nothing logged</span><span><i class="hs-off"></i>Not scheduled</span></div>
    ${fix}
    ${mood?`<div class="sec-h">Mood</div><div class="list"><div class="row"><span class="row-main"><span class="row-t">${fmtMood(mood.a.avg)} on days you ${h.type==='avoid'?'kept it':'did it'} · ${fmtMood(mood.b.avg)} on days you ${h.type==='avoid'?'slipped':'did not'}</span>
      <span class="row-s">${mood.a.n} and ${mood.b.n} rated days. Counted, not tested: ${pat&&pat.length?'Patterns has the tested result below.':'Patterns tests it once there are enough days on each side, and says which way it runs.'}</span></span></div>
      ${(pat||[]).map(r=>`<button class="row row-tap" onclick="showPattern(${jsq(r.test.id)})"><span class="row-main"><span class="row-t">${esc(r.t||'')}</span><span class="row-s">${esc({solid:'Solid',likely:'Likely',early:'Early sign'}[r.tier])} · ${r.n} days</span></span><span class="row-chev">${ICON('chev',16)}</span></button>`).join('')}</div>`:''}
    ${h.archived?'':`<div class="sec-h">Edit</div>${habitEditHTML(h)}`}
    <div class="sheet-acts">${h.archived?`<button class="btn bts" onclick="habitArchive(${jsq(h.id)},false)">Bring it back</button>`:`<button class="btn bts" onclick="habitArchive(${jsq(h.id)},true)">Archive</button>`}<button class="btn bts row-danger" style="color:var(--red)" onclick="habitDelete(${jsq(h.id)})">Delete</button></div>
    <div class="fine">Archive keeps its history in Patterns and the calendar; Delete removes it and every day it was ticked.</div>`;
}
function habitEditHTML(h){
  const sched=h.days.join(',');const id=jsq(h.id);
  const preset=HABIT_SCHED.find(s=>s.days&&s.days.join(',')===sched);
  const isPlan=h.type==='auto'&&h.plan&&hasFixedSchedule();
  return`<div class="fg">${h.type==='auto'?'':`<input type="text" id="hab-name" maxlength="40" value="${esc(h.name)}" onchange="habitRename(${id},this.value)" aria-label="Name">`}</div>
    ${h.type==='amount'?`<div class="fg"><label class="fl">Target each day</label><div class="frow"><input type="number" inputmode="decimal" value="${h.target}" onchange="habitSetTarget(${id},this.value)" aria-label="Target"><input type="text" maxlength="12" value="${esc(h.unit||'')}" placeholder="unit" onchange="habitSetUnit(${id},this.value)" aria-label="Unit"></div></div>`:''}
    ${h.type==='auto'&&AUTO_HABITS[h.auto].target?`<div class="fg"><label class="fl">${h.auto==='sleep'?'Hours of sleep':'Steps'}</label><input type="number" inputmode="decimal" value="${h.target}" onchange="habitSetTarget(${id},this.value)"></div>`:''}
    ${AUTO_HABITS[h.auto]&&AUTO_HABITS[h.auto].plan&&hasFixedSchedule()?`<div class="frow set-row" style="margin-bottom:10px"><span class="set-lbl">Only on training days</span>${`<button class="tog${h.plan?' on':''}" onclick="habitSetPlan(${id},${!h.plan})" aria-label="Only on training days" aria-pressed="${!!h.plan}"></button>`}</div>`:''}
    ${isPlan?'':`<div class="fg"><label class="fl">Days</label><div class="feel-row" role="group" aria-label="Which days">${HABIT_SCHED.filter(s=>s.days).map(s=>`<button class="chip${preset&&preset.id===s.id?' on':''}" onclick="habitSetDays(${id},[${s.days}])">${s.l}</button>`).join('')}</div>
      <div class="feel-row rem-days" style="margin-top:8px" role="group" aria-label="Pick the days">${DOW1.map((l,i)=>`<button class="chip${h.days.includes(i)?' on':''}" aria-pressed="${h.days.includes(i)}" aria-label="${DOW3[i]}" onclick="habitFlipDay(${id},${i})">${l}</button>`).join('')}</div></div>`}`;
}
function habitEdit(id,fn){const h=habitById(id);if(!h)return;fn(h);const n=normalizeHabits([h])[0];if(n)Object.assign(h,n);save();habitsRefresh();}
function habitRename(id,v){v=String(v||'').replace(/\s+/g,' ').trim();if(!v){toast('A habit needs a name');renderHabitSheet();return;}habitEdit(id,h=>{h.name=v.slice(0,40);});}
function habitSetTarget(id,v){const n=parseFloat(v);if(!(n>0)){renderHabitSheet();return;}habitEdit(id,h=>{h.target=n;});}
function habitSetUnit(id,v){habitEdit(id,h=>{h.unit=String(v||'').trim();});}
function habitSetPlan(id,v){habitEdit(id,h=>{h.plan=!!v;});}
function habitSetDays(id,days){habitEdit(id,h=>{h.days=days.slice();});}
function habitFlipDay(id,i){habitEdit(id,h=>{const k=h.days.indexOf(i);if(k>=0){if(h.days.length>1)h.days.splice(k,1);}else h.days.push(i);});}
function habitArchive(id,on){
  if(!on&&activeHabits().length>=HABIT_MAX){toast(`${HABIT_MAX} habits is the limit. Archive another first.`);return;}
  habitEdit(id,h=>{h.archived=!!on;});toast(on?'Archived. Its history stays.':'Back on your list');if(on)closeOv('hab1-ov');
}
function habitDelete(id){
  const h=habitById(id);if(!h)return;
  customConfirm(`Delete “${h.name}” and every day it was ticked?`,'Delete',()=>{
    S.habits=S.habits.filter(x=>x.id!==id);
    Object.keys(S.habitLog||{}).forEach(ds=>{if(S.habitLog[ds]){delete S.habitLog[ds][id];if(!Object.keys(S.habitLog[ds]).length)delete S.habitLog[ds];}});
    save();closeOv('hab1-ov');_habOpen=null;habitsRefresh();
  });
}
// Mood (1-5, raw) on the days a habit was kept against the days it was not. Shown as a count only.
function habitMoodSplit(h){
  const a=[],b=[];
  Object.keys(S.moodLog||{}).forEach(ds=>{if(ds>=today())return;const d=habitDay(h,ds);if(d.st==='done')a.push(S.moodLog[ds]);else if(d.st==='miss')b.push(S.moodLog[ds]);});
  if(a.length<3||b.length<3)return null;
  const avg=x=>x.reduce((s,v)=>s+v,0)/x.length;
  return{a:{n:a.length,avg:avg(a)},b:{n:b.length,avg:avg(b)}};
}

// ─── The daily check-in (opened from Home; it was the weigh-in) ───
// Weight and last night's sleep, how yesterday went, and yesterday's habits that are still open.
function checkInTitle(){return'Daily check-in';} // one name for the one daily sheet, whatever it asks
function checkInOpenHabits(ds){
  // Every manual habit that was due that day, ticked or not, so a tap can be taken back.
  return activeHabits().filter(h=>h.type!=='auto'&&habitDay(h,ds).st!=='off');
}
function renderCheckInBody(){
  const el=document.getElementById('ci-more');if(!el)return;
  const y=daysAgoStr(1);let h='';
  if(moodAsked())h+=`<div class="fg"><label class="fl">How was yesterday? <small>optional</small></label>${moodChipsHTML(y)}</div>`;
  const open=checkInOpenHabits(y);
  if(open.length)h+=`<div class="fg"><label class="fl">Yesterday’s habits <small>tap what you did</small></label><div class="ci-habs">${open.map(x=>{const d=habitDay(x,y);
    if(x.type==='amount')return`<button class="chip" onclick="showHabitAmount(${jsq(x.id)},${jsq(y)})">${esc(x.name)} · ${fmtNum(d.v||0)}/${esc(habitTargetText(x))}</button>`;
    if(x.type==='avoid')return`<button class="chip${d.slip?' ci-slip':''}" aria-pressed="${!!d.slip}" onclick="habitToggle(${jsq(x.id)},${jsq(y)})">${d.slip?ICON('x',12)+' Slipped: ':''}${esc(x.name)}</button>`;
    return`<button class="chip${d.st==='done'?' on':''}" aria-pressed="${d.st==='done'}" onclick="habitToggle(${jsq(x.id)},${jsq(y)})">${d.st==='done'?ICON('tick',12)+' ':''}${esc(x.name)}</button>`;}).join('')}</div>
    ${open.some(x=>x.type==='avoid')?'<div class="fine" style="margin:6px 2px 0">Avoid habits count as kept; tap one only if you slipped.</div>':''}</div>`;
  el.innerHTML=h;
}
