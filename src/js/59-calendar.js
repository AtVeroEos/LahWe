// ═══════════════════════════════════════════════════
// CALENDAR — one month grid, two doors, one view at a time
// ═══════════════════════════════════════════════════
// Schedule (a page of Home) opens it to plan: tapping a day sets its workout or makes it a rest day.
// The Calendar tile on Progress opens it to look back: tapping a day shows everything logged that day.
// Either way a row of chips picks what the month shows. One view at a time: a cell is about 50 px
// wide, and stacking every log in it is how a calendar stops being readable.
const CAL_LENSES=[
  {id:'all',l:'Everything',has:()=>true},
  {id:'mood',l:'Happiness',has:()=>moodUsed()},
  {id:'habits',l:'Habits',has:()=>modOn('habitlist')&&(S.habits||[]).length>0},
  {id:'training',l:'Training',has:()=>true},
  {id:'food',l:'Food',has:()=>modOn('nutrition')&&((S.meals||[]).length>0||Object.keys(S.macroLogs||{}).length>0)},
  {id:'meals',l:'Meal plan',has:()=>planHasMeals()||planFastDays().length>0},
  {id:'sleep',l:'Sleep',has:()=>modOn('sleep')&&Object.keys(S.sleepLog||{}).length>0},
  {id:'weight',l:'Weight',has:()=>modOn('weight')&&(S.bodyweightLog||[]).length>0},
];
const CAL_MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
let _calMode='plan';
function calLensesShown(){return CAL_LENSES.filter(l=>l.has());}
function calLens(mode){
  const id=(mode||_calMode)==='plan'?(window._schedLens||'all'):S.calLens;
  return calLensesShown().some(l=>l.id===id)?id:'all';
}
function setCalLens(id,mode){
  if(!CAL_LENSES.some(l=>l.id===id))return;
  if((mode||_calMode)==='plan')window._schedLens=id;else{S.calLens=id;save();}
  calRefresh();
}
function setCalHabit(id){S.calHabit=id||null;save();calRefresh();}
function calRefresh(){
  const body=document.getElementById('calr-body');
  if(body){_calMode='review';const m=body.closest('.modal');const y=m?m.scrollTop:0;body.innerHTML=renderCalendar('review');if(m)m.scrollTop=y;return;}
  renderHistory(document.getElementById('content'));
}
function adjCal(d){S.calMonth+=d;if(S.calMonth>11){S.calMonth=0;S.calYear++;}if(S.calMonth<0){S.calMonth=11;S.calYear--;}calRefresh();}
// The review door: a sheet over Progress (or wherever it was opened from).
function showCalendar(lens){
  _calMode='review';
  if(lens&&calLensesShown().some(l=>l.id===lens)){S.calLens=lens;save();}
  const n=new Date();S.calMonth=n.getMonth();S.calYear=n.getFullYear();
  const ov=makeOv('calr-ov');
  ov.innerHTML=`<div class="modal cal-sheet" style="max-height:94vh"><div class="mh"></div><div class="mt" style="margin-bottom:8px">Calendar</div><div id="calr-body">${renderCalendar('review')}</div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}

// ─── The month ───
function calMonthDays(yr,mo){const n=new Date(yr,mo+1,0).getDate();const out=[];for(let d=1;d<=n;d++)out.push(`${yr}-${pad2(mo+1)}-${pad2(d)}`);return out;}
function renderCalendar(mode){
  _calMode=mode==='review'?'review':'plan';
  const yr=S.calYear,mo=S.calMonth;const lens=calLens();
  const first=(new Date(yr,mo,1).getDay()-weekStartDay()+7)%7;const days=calMonthDays(yr,mo); // blanks before the 1st, from the week's first day
  const ctx=calCtx(lens);
  const shown=calLensesShown();
  let html=_calMode==='plan'?programBanner():'';
  html+=`<div class="cal-nav"><button class="btn btg bsm" onclick="adjCal(-1)" aria-label="Previous month">‹</button><div class="cal-mo">${CAL_MONTHS[mo]} ${yr}</div><button class="btn btg bsm" onclick="adjCal(1)" aria-label="Next month">›</button></div>`;
  if(shown.length>1)html+=`<div class="chips-x cal-lenses" role="tablist" aria-label="What the calendar shows">${shown.map(l=>`<button class="chip${l.id===lens?' on':''}" role="tab" aria-selected="${l.id===lens}" onclick="setCalLens('${l.id}','${_calMode}')">${l.l}</button>`).join('')}</div>`;
  if(lens==='habits'){
    const hs=(S.habits||[]).filter(h=>!h.archived||Object.keys(S.habitLog||{}).some(d=>d.startsWith(`${yr}-${pad2(mo+1)}`)&&S.habitLog[d][h.id]));
    if(hs.length>1)html+=`<div class="chips-x cal-sub">${[{id:'',name:'All habits'}].concat(hs).map(h=>`<button class="chip${(S.calHabit||'')===h.id?' on':''}" onclick="setCalHabit(${jsq(h.id)})">${esc(h.name)}</button>`).join('')}</div>`;
  }
  html+=`<div class="cal-grid cal-l-${lens}">${weekOrder().map(i=>`<div class="cal-day-hdr">${['Su','Mo','Tu','We','Th','Fr','Sa'][i]}</div>`).join('')}`;
  for(let i=0;i<first;i++)html+=`<div class="cal-cell empty"></div>`;
  days.forEach(ds=>{html+=calCellHTML(ds,lens,ctx);});
  html+=`</div>`;
  html+=calLegendHTML(lens,ctx);
  const sum=calSummary(lens,days,ctx);
  if(sum)html+=`<div class="cal-sum">${sum}</div>`;
  return html;
}
// Worked out once for the month, not once a cell.
function calCtx(lens){
  const ctx={td:today(),wk:{},acts:{},routineDays:{},mode:_calMode};
  S.workouts.forEach(w=>{const ds=dayOf(w.started);(ctx.wk[ds]=ctx.wk[ds]||[]).push(w);});
  if(modOn('cardio'))S.activities.forEach(a=>{(ctx.acts[a.date]=ctx.acts[a.date]||[]).push(a);});
  (S.routines||[]).forEach(r=>{(r.days||[]).forEach(d=>{(ctx.routineDays[d]=ctx.routineDays[d]||[]).push(r.name);});});
  ctx.calGoal=modOn('nutrition')?(S.macroGoals||{}).cals||0:0;
  if(lens==='habits'){
    ctx.habit=S.calHabit?habitById(S.calHabit):null;
    ctx.habits=ctx.habit?[ctx.habit]:(S.habits||[]);
  }
  if(lens==='weight'){ctx.bw={};(S.bodyweightLog||[]).forEach(b=>{ctx.bw[b.date]=b.weight;});}
  return ctx;
}
// One day of the habits view: kept / due, from the habits that were scheduled.
function calHabitDay(ds,ctx){
  let ok=0,due=0,blank=0;
  ctx.habits.forEach(h=>{const d=habitDay(h,ds);if(d.st==='done'){ok++;due++;}else if(d.st==='miss'){due++;}else if(d.st==='open'){due++;if(h.type==='avoid')ok++;}else if(d.st==='blank')blank++;});
  return{ok,due,blank};
}
function calCellHTML(ds,lens,ctx){
  const td=ctx.td;const d=+ds.slice(8);const isToday=ds===td;const fut=ds>td;
  const tap=`onclick="calTap('${ds}','${ctx.mode}')"`;
  const dateEl=`<div class="cal-date">${d}</div>`;
  if(lens==='all'){
    const w=(ctx.wk[ds]||[]).length,a=(ctx.acts[ds]||[]).length;
    const isRest=!isTrainingDay(ds);const dow=dayDate(ds).getDay();
    const hasPlanned=((ctx.routineDays[dow]||[]).length>0||plannedRoutinesForDow(dow).length>0)&&ds>=td&&!isRest;
    const ovRid=S.schedule.routineOverrides&&S.schedule.routineOverrides[ds];
    const hasRoutineOverride=ovRid&&ovRid!=='rest';const isRestOverride=ovRid==='rest';
    let goalTri='';
    if(ctx.calGoal&&ds<=td){
      const dayGoal=goalsFor(ds).cals||ctx.calGoal;const dayCals=getDayTotals(ds).cals||0;
      if(dayCals>0){const over=dayCals>dayGoal;const within=Math.abs(dayCals-dayGoal)/dayGoal<=0.05;
        const col=within?'var(--green)':over?'var(--red)':'var(--navy)';
        goalTri=`<div class="cal-goal-tri" style="border-color:transparent ${col} transparent transparent" title="${Math.round(dayCals)} / ${dayGoal} kcal"></div>`;}
    }
    return`<div class="cal-cell${isToday?' today':''}${(isRest||isRestOverride)?' rest-day':''}" ${tap}>${goalTri}${dateEl}
      <div class="cal-dots">${'<div class="cal-dot" style="background:var(--navy)"></div>'.repeat(w)}${'<div class="cal-dot" style="background:var(--gold)"></div>'.repeat(a)}
        ${hasPlanned&&!w?`<div class="cal-dot" style="background:var(--border);border:1px solid var(--navy)"></div>`:''}
        ${hasRoutineOverride&&!w?`<div class="cal-dot" style="background:var(--blue);border:1px solid var(--blue)"></div>`:''}
        ${(isRest||isRestOverride)&&!w?`<div style="font-size:7px;color:var(--muted2)">–</div>`:''}</div></div>`;
  }
  let cls='',inner='',style='';
  if(lens==='mood'){const v=(S.moodLog||{})[ds];if(v){cls=' cm m'+v;inner=`<div class="cal-v">${MOODS[v-1].l}</div>`;}}
  else if(lens==='habits'){
    if(ctx.habit){const st=habitDay(ctx.habit,ds).st;cls=` ch hs-${fut?'fut':st}`;
      if(ctx.habit.type==='amount'&&!fut){const v=(((S.habitLog||{})[ds]||{})[ctx.habit.id])||0;if(v)inner=`<div class="cal-v">${fmtNum(v)}</div>`;}}
    else if(!fut){const x=calHabitDay(ds,ctx);if(x.due){const p=x.ok/x.due;cls=' ch-p'+(p>=1?' ch-all':'');style=`style="--p:${Math.round(p*100)}%"`;inner=`<div class="cal-v">${x.ok}/${x.due}</div>`;}else if(x.blank)cls=' ch-blank';}
  }
  else if(lens==='training'){
    const w=ctx.wk[ds]||[],a=ctx.acts[ds]||[];const planned=hasFixedSchedule()&&isTrainingDay(ds);
    if(w.length){cls=' ct-done';inner=`<div class="cal-v">${esc(calShort(w[0].name))}</div>${w.length>1?`<div class="cal-v2">+${w.length-1}</div>`:''}`;}
    else if(a.length){cls=' ct-act';inner=`<div class="cal-v">${esc(calShort((ACT_TYPES.find(t=>t.id===a[0].type)||{label:'Activity'}).label))}</div>`;}
    else if(planned&&ds<td){cls=' ct-miss';inner=`<div class="cal-v">missed</div>`;}
    else if(planned&&ds>=td){cls=' ct-plan';const r=plannedRoutineName(ds);inner=r?`<div class="cal-v">${esc(calShort(r))}</div>`:'';}
    else if(ds<=td)cls=' ct-rest';
  }
  else if(lens==='food'&&ds<=td){
    const k=getDayTotals(ds).cals||0;const g=(goalsFor(ds)||{}).cals||0;
    if(k>0){const r=g?k/g:null;const t=r==null?'':Math.abs(r-1)<=0.1?'on':r>1?'over':'under';cls=' cf'+(t?' cf-'+t:'');inner=`<div class="cal-v">${fmtK(k)}</div>`;}
  }
  else if(lens==='meals'){
    // Ahead: the weekday's plan (it repeats every week). Behind: what was eaten.
    if(ds>=td){const f=planFastOn(ds);const k=planDayTotals(planMealsOn(ds)).cals;
      if(f&&!k){cls=' cpm-fast';inner=`<div class="cal-v">${f==='full'?'Fast':'Light'}</div>`;}
      else if(k){const g=planDateTarget(ds).cals;const r=g?k/g:1;cls=' cpm'+(f?' cpm-fast':Math.abs(r-1)<=0.1?' cpm-on':r>1?' cpm-over':' cpm-under');inner=`<div class="cal-v">${fmtK(k)}</div>`;}}
    else{const k=getDayTotals(ds).cals||0;if(k>0){cls=' cpm-past';inner=`<div class="cal-v">${fmtK(k)}</div>`;}}
  }
  else if(lens==='sleep'){const h=(S.sleepLog||{})[ds];if(h>0){cls=' cs'+(h>=8?' cs-3':h>=7?' cs-2':h>=6?' cs-1':' cs-0');inner=`<div class="cal-v">${h>=9?'9+':h} h</div>`;}}
  else if(lens==='weight'){const w=ctx.bw[ds];if(w){cls=' cw';inner=`<div class="cal-v">${fmt1(w)}</div>`;}}
  return`<div class="cal-cell cl${cls}${isToday?' today':''}${fut?' fut':''}" ${style} ${tap}>${dateEl}${inner}</div>`;
}
function calShort(s){s=String(s||'').replace(/^.*?\s[-–]\s/,'');return s.length>9?s.slice(0,8)+'…':s;}
function plannedRoutineName(ds){
  try{const ov=S.schedule.routineOverrides&&S.schedule.routineOverrides[ds];if(ov&&ov!=='rest')return((S.routines||[]).find(r=>r.id===ov)||{}).name||'';
    const p=plannedRoutinesForDow(dayDate(ds).getDay());return p&&p.length?(p[0].name||p[0]):'';}catch(e){return'';}
}
function calTap(ds,mode){
  mode=mode||_calMode;
  if(mode==='plan'&&calLens('plan')==='all'){calDayTap(ds);return;}
  if(calLens(mode)==='meals'&&ds>=today()){showMealPlan(ds);return;}
  showCalDay(ds);
}
function calLegendHTML(lens,ctx){
  const k=(cls,l)=>`<span><i class="${cls}"></i>${l}</span>`;
  if(lens==='all')return`<div class="cal-key"><span><i style="background:var(--navy);border-radius:50%"></i>Workout</span><span><i style="background:var(--gold);border-radius:50%"></i>Activity</span><span><i style="border:1px solid var(--navy);border-radius:50%"></i>Planned</span><span><i style="background:var(--border);border-radius:50%"></i>Rest</span>${ctx.calGoal?'<span><i class="ck-tri"></i>Calories (green on, blue under, red over)</span>':''}</div>${_calMode==='plan'?'<div class="fine" style="margin:4px var(--gx)">Tap a day to set its workout or make it a rest day.</div>':''}`;
  if(lens==='mood')return`<div class="cal-key">${MOODS.map(m=>k('m'+m.v,m.l)).join('')}</div>`;
  if(lens==='habits')return ctx.habit?`<div class="cal-key">${k('hs-done',ctx.habit.type==='avoid'?'Kept':'Done')}${k('hs-miss',ctx.habit.type==='avoid'?'Slipped':'Missed')}${k('hs-blank','Nothing logged')}${k('hs-off','Not due')}</div>`
    :`<div class="cal-key">${k('ch-k','Share of the day’s habits kept')}${k('ch-k-all','All kept')}</div>`;
  if(lens==='training')return`<div class="cal-key">${k('ct-k-done','Workout')}${k('ct-k-act','Activity')}${k('ct-k-miss','Planned, missed')}${k('ct-k-plan','Planned')}</div>`;
  if(lens==='food')return`<div class="cal-key">${k('cf-k-on','Within 10% of target')}${k('cf-k-under','Under')}${k('cf-k-over','Over')}</div>`;
  if(lens==='meals')return`<div class="cal-key">${k('cpm-k-plan','Planned (kcal)')}${k('cpm-k-fast','Fast or light day')}${k('cpm-k-past','Eaten')}</div><div class="fine" style="margin:4px var(--gx)">Weekly meals show on every week; one-off meals on their date. Tap a coming day to open it.</div>`;
  if(lens==='sleep')return`<div class="cal-key">${k('cs-0','Under 6 h')}${k('cs-1','6')}${k('cs-2','7')}${k('cs-3','8+')}</div>`;
  return'';
}
// One line under the month for the view in use.
function calSummary(lens,days,ctx){
  if(lens==='meals'){const w=planWeekInfo(0);const f=planWeekDates(0).filter(d=>planFastOn(d)).length;return`<b>${w.planned.toLocaleString()}</b> kcal planned this week${w.covered<7?` (${w.covered} of 7 days)`:''}${f?` · ${f} fasting day${f===1?'':'s'}`:''}`;}
  const past=days.filter(d=>d<=ctx.td);if(!past.length)return'';
  if(lens==='mood'){
    const r=past.filter(d=>(S.moodLog||{})[d]);if(!r.length)return'No days rated this month. Rate yesterday in the morning check-in.';
    const avg=r.reduce((s,d)=>s+S.moodLog[d],0)/r.length;
    // the weekday that runs best, over every rated day (not just this month), when each has a few
    const by=[0,0,0,0,0,0,0].map(()=>[]);Object.keys(S.moodLog||{}).forEach(d=>by[dayDate(d).getDay()].push(S.moodLog[d]));
    const means=by.map((a,i)=>({i,n:a.length,m:a.length?a.reduce((s,v)=>s+v,0)/a.length:0})).filter(x=>x.n>=3);
    const best=means.length>=4?means.sort((a,b)=>b.m-a.m)[0]:null;
    return`<b>${fmtMood(avg)}</b> average over ${r.length} rated day${r.length===1?'':'s'}${best?` · your best weekday is ${DOW3[best.i]} (${fmtMood(best.m)}, ${best.n} days)`:''}`;
  }
  if(lens==='habits'){
    let ok=0,due=0;past.filter(d=>d<ctx.td).forEach(d=>{ctx.habits.forEach(h=>{const x=habitDay(h,d);if(x.st==='done'){ok++;due++;}else if(x.st==='miss')due++;});});
    if(!due)return'Nothing due yet this month.';
    return`<b>${Math.round(ok/due*100)}%</b> kept · ${ok} of ${due}${ctx.habit?` for ${esc(ctx.habit.name)}`:' habit-days'} this month, today left out until it is over`;
  }
  if(lens==='training'){
    const n=past.reduce((s,d)=>s+(ctx.wk[d]||[]).length,0),a=past.reduce((s,d)=>s+(ctx.acts[d]||[]).length,0);
    let txt=`<b>${n}</b> workout${n===1?'':'s'}${a?` and ${a} activit${a===1?'y':'ies'}`:''}`;
    if(hasFixedSchedule()){const plan=past.filter(d=>d<ctx.td&&isTrainingDay(d));const miss=plan.filter(d=>!(ctx.wk[d]||[]).length).length;if(plan.length)txt+=` · ${plan.length-miss} of ${plan.length} planned days done`;}
    return txt;
  }
  if(lens==='food'){
    const l=past.filter(d=>(getDayTotals(d).cals||0)>0&&!isPaused(d));if(!l.length)return'Nothing logged this month.';
    const on=l.filter(d=>{const g=(goalsFor(d)||{}).cals||0;return g&&Math.abs(getDayTotals(d).cals-g)<=g*0.1;}).length;
    return`<b>${on}</b> of ${l.length} logged days within 10% of target · ${fmtK(Math.round(l.reduce((s,d)=>s+getDayTotals(d).cals,0)/l.length))} kcal a day`;
  }
  if(lens==='sleep'){const l=past.filter(d=>(S.sleepLog||{})[d]>0);if(!l.length)return'No nights logged this month.';const avg=l.reduce((s,d)=>s+S.sleepLog[d],0)/l.length;return`<b>${fmt1(avg)} h</b> a night over ${l.length} logged · ${l.filter(d=>S.sleepLog[d]>=7).length} of them 7 h or more`;}
  if(lens==='weight'){const l=past.filter(d=>ctx.bw[d]);if(!l.length)return'No weigh-ins this month.';if(l.length===1)return`<b>${fmt1(ctx.bw[l[0]])}</b> ${S.unit}, one weigh-in`;const ch=ctx.bw[l[l.length-1]]-ctx.bw[l[0]];return`<b>${ch>=0?'+':'−'}${fmt1(Math.abs(ch))} ${S.unit}</b> from ${fmtDay(l[0])} to ${fmtDay(l[l.length-1])} · ${l.length} weigh-ins`;}
  return'';
}

// ─── One day: everything logged on it ───
let _calDay=null;
function showCalDay(ds){
  _calDay=ds;
  const ov=makeOv('calday-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div id="calday-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderCalDay();
}
function renderCalDay(){
  const el=document.getElementById('calday-body');if(!el||!_calDay)return;
  const ds=_calDay;const td=today();const fut=ds>td;
  const isRest=!isTrainingDay(ds);
  let h=`<div class="mt" style="margin-bottom:2px">${esc(fmtDate(ds+'T12:00:00'))}</div><div class="sheet-sub" style="margin-bottom:8px">${fut?(isRest?'Rest day planned':'Training day planned'):isRest?'Rest day':'Training day'}</div>`;
  if(!fut&&modOn('mood')){
    h+=`<div class="sec-h">Mood</div>${moodChipsHTML(ds)}`;
  }
  const hs=(modOn('habitlist')?(S.habits||[]):[]).filter(x=>{const d=habitDay(x,ds);return d.st!=='off';});
  if(hs.length&&!fut){
    h+=`<div class="sec-h">Habits</div><div class="list">${hs.map(x=>{const d=habitDay(x,ds);
      const lbl={done:x.type==='avoid'?'Kept':'Done',miss:x.type==='avoid'?'Slipped':'Missed',open:x.type==='avoid'?'Kept so far':'Not yet',blank:'Nothing logged'}[d.st]||'';
      const act=x.type==='auto'?`<span class="pill">auto</span>`:x.type==='amount'?`<button class="btn bts bxs" onclick="showHabitAmount(${jsq(x.id)},${jsq(ds)})">${fmtNum(d.v||0)} / ${esc(habitTargetText(x))}</button>`
        :`<button class="btn bts bxs" onclick="habitToggle(${jsq(x.id)},${jsq(ds)})">${x.type==='avoid'?(d.slip?'Undo slip':'Mark slip'):(d.st==='done'?'Undo':'Done')}</button>`;
      return`<div class="row"><span class="hab-dot hs-${d.st}"></span><span class="row-main"><span class="row-t">${esc(x.name)}</span><span class="row-s">${lbl}</span></span>${act}</div>`;}).join('')}</div>`;
  }
  const w=S.workouts.filter(x=>dayOf(x.started)===ds),a=modOn('cardio')?S.activities.filter(x=>x.date===ds):[];
  if(w.length||a.length){
    h+=`<div class="sec-h">Training</div><div class="list">${w.map(x=>`<button class="row row-tap" onclick="closeOv('calday-ov');showWkDetail(${jsq(x.id)})"><span class="row-ic">${ICON('dumbbell',16)}</span><span class="row-main"><span class="row-t">${esc(x.name)}</span><span class="row-s">${doneSetCnt(x)} sets${x.ended?' · '+fmtDur(workoutActiveMs(x)):''}${x.feel?' · felt '+esc(FEEL_LABELS[x.feel-1]||''):''}</span></span><span class="row-chev">${ICON('chev',16)}</span></button>`).join('')}
      ${a.map(x=>{const t=ACT_TYPES.find(y=>y.id===x.type)||{label:'Activity'};return`<button class="row row-tap" onclick="closeOv('calday-ov');showActivityDetail(${jsq(x.id)})"><span class="row-ic">${ICON('run',16)}</span><span class="row-main"><span class="row-t">${esc(t.label)}</span><span class="row-s">${x.dist?fmt1(parseFloat(x.dist))+' mi · ':''}${x.cals?Math.round(x.cals)+' kcal':''}</span></span><span class="row-chev">${ICON('chev',16)}</span></button>`;}).join('')}</div>`;
  }else if(fut){const r=plannedRoutineName(ds);if(r&&!isRest)h+=`<div class="note-box">Planned: <b>${esc(r)}</b></div>`;}
  if(!fut){
    const t=modOn('nutrition')?getDayTotals(ds):{};const g=goalsFor(ds)||{};const sl=modOn('sleep')?(S.sleepLog||{})[ds]:0;const bw=modOn('weight')?(S.bodyweightLog||[]).find(b=>b.date===ds):null;
    const st=[];
    if(t.cals>0)st.push({v:Math.round(t.cals).toLocaleString(),l:g.cals?`kcal of ${Math.round(g.cals).toLocaleString()}`:'kcal'});
    if(t.protein>0)st.push({v:Math.round(t.protein)+' g',l:g.protein?`protein of ${Math.round(g.protein)}`:'protein'});
    if(sl)st.push({v:(sl>=9?'9+':sl)+' h',l:'sleep'});
    if(bw)st.push({v:fmt1(bw.weight),l:S.unit});
    if(modOn('steps')&&(S.stepsLog||{})[ds]>0)st.push({v:fmtK(S.stepsLog[ds]),l:'steps'});
    if(st.length)h+=`<div class="sec-h">The day</div><div class="st-grid${st.length===4?' st-22':st.length===2?' st-2':''}">${st.map(x=>`<div class="st"><div class="st-v">${esc(String(x.v))}</div><div class="st-l">${esc(x.l)}</div></div>`).join('')}</div>`;
    if(!w.length&&!a.length&&!st.length&&!hs.length&&!(modOn('mood')&&(S.moodLog||{})[ds]))h+=`<div class="ch-empty">Nothing logged on this day.</div>`;
  }
  h+=`<div class="sheet-acts"><button class="btn bts" onclick="closeOv('calday-ov');calDayTap(${jsq(ds)})">Plan this day</button>${!fut&&modOn('cardio')?`<button class="btn bts" onclick="closeOv('calday-ov');showLogActivity(${jsq(ds)})">+ Activity</button>`:''}</div>`;
  el.innerHTML=h;
}
// A small month for a board tile, coloured by the calendar's current view.
function calMiniSVG(){
  const n=new Date();const yr=n.getFullYear(),mo=n.getMonth();const days=calMonthDays(yr,mo);const first=(new Date(yr,mo,1).getDay()-weekStartDay()+7)%7;
  const lens=S.calLens==='all'||!calLensesShown().some(l=>l.id===S.calLens)?'training':S.calLens;const ctx=calCtx(lens);
  const sz=15,gap=3;let x,y,out='';
  days.forEach((ds,i)=>{const k=i+first;x=(k%7)*(sz+gap);y=Math.floor(k/7)*(sz+gap);
    let cls='mi-none';
    if(ds>ctx.td)cls='mi-fut';
    else if(lens==='mood'){const v=(S.moodLog||{})[ds];if(v)cls='m'+v;}
    else if(lens==='habits'){const d=calHabitDay(ds,ctx);if(d.due&&ds<ctx.td)cls=d.ok>=d.due?'mi-full':d.ok/d.due>=0.5?'mi-half':'mi-low';}
    else if(lens==='training'){if((ctx.wk[ds]||[]).length)cls='mi-full';else if((ctx.acts[ds]||[]).length)cls='mi-half';}
    else if(lens==='food'||lens==='meals'){const k2=getDayTotals(ds).cals||0;const g=(goalsFor(ds)||{}).cals||0;if(k2>0)cls=g&&Math.abs(k2/g-1)<=0.1?'mi-full':'mi-half';}
    else if(lens==='sleep'){const h=(S.sleepLog||{})[ds];if(h)cls=h>=7?'mi-full':'mi-half';}
    else if(lens==='weight'){if(ctx.bw[ds])cls='mi-full';}
    out+=`<rect class="${cls}" x="${x}" y="${y}" width="${sz}" height="${sz}" rx="3.5"/>`;});
  const rows=Math.ceil((days.length+first)/7);
  return`<svg class="spark cal-mini" viewBox="0 0 ${7*(sz+gap)-gap} ${rows*(sz+gap)-gap}" aria-hidden="true">${out}</svg>`;
}
