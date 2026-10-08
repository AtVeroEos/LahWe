// ═══════════════════════════════════════════════════
// PROGRESS — the board
// ═══════════════════════════════════════════════════
// A grid of tiles, each one number with its context and a small chart, read from the metric
// catalog (37-metrics.js). Tapping a tile opens its detail sheet: a real chart over the chosen
// range, the entries behind it, and how it is worked out. Which tiles show, in what order, is
// the user's (Edit); until they change it, it is the layout for their goal.
function progHeaderHTML(){
  const v=PROG_VIEWS.includes(S.progView)?S.progView:'progress';
  const seg=(id,label)=>`<button class="seg-b${v===id?' on':''}" onclick="setProgView('${id}')">${label}</button>`;
  const r=boardRange();
  const right=v==='progress'?`<div class="ph-acts"><span class="range-pick"><select id="board-range" onchange="setBoardRange(this.value)" aria-label="Time range">${RANGES.map(x=>`<option value="${x.id}"${x.id===r.id?' selected':''}>${x.label}</option>`).join('')}</select>${ICON('chev',13)}</span>
      <button class="btn bts bsm" id="board-edit" onclick="showBoardEdit()">Edit</button></div>`
    :v==='history'?`<button class="btn bts bsm" onclick="showLogActivity()">+ Activity</button>`:'';
  return`<div class="ph"><div class="page-title">${v==='history'?'History':v==='schedule'?'Schedule':'Progress'}</div>${right}</div>
  <div class="seg" role="tablist">${seg('progress','Progress')}${seg('history','History')}${seg('schedule','Schedule')}</div>`;
}
function renderProgress(c){
  if(S.progView==='progress')boardAdopt();
  if(S.progView==='history'){c.innerHTML=progHeaderHTML()+renderHistList();return;}
  if(S.progView==='schedule'){resolveProgramGroup();c.innerHTML=progHeaderHTML()+renderCalendar();return;}
  c.innerHTML=progHeaderHTML()+`<div id="prog-attn">${attentionHTML()}</div>`+boardHTML();
  rvTileMount().catch(e=>logError(e,'routes tile')); // the Routes tile draws itself once it is on the page
}
// Redraw whatever of Progress is on screen: the board, an open detail sheet, the edit sheet.
function boardRefresh(){
  if(S.tab==='progress'){const c=document.getElementById('content');if(c){const y=c.scrollTop;renderProgress(c);c.scrollTop=y;}}
}
function progRefresh(){
  boardRefresh();
  if(document.getElementById('metric-ov'))renderMetric();
  if(document.getElementById('lifts-ov'))renderAllLifts();
  if(document.getElementById('bedit-ov'))renderBoardEdit();
  if(document.getElementById('run-ov'))renderRunning();
}
function setBoardRange(id){
  if(!RANGES.some(r=>r.id===id))return;
  S.board.range=id;save();progRefresh();
}
// One metric failing must not blank the tab: it shows as a tile that says so.
function tileData(t,range){
  try{return METRICS[t.k].tile(range,t)||{};}
  catch(e){logError(e,'metric '+t.k);return{title:METRICS[t.k].title,empty:'This could not be worked out.'};}
}
function boardHTML(){
  const range=boardRange();
  const data=boardTiles().filter(t=>METRICS[t.k]).map(t=>({t,m:METRICS[t.k],d:tileData(t,range)}));
  // Two columns. A small tile left on its own in a row is stretched across, so there is no hole.
  let col=0;
  data.forEach((x,i)=>{
    if(x.m.wide){col=0;return;}
    const next=data[i+1];
    if(col===0&&(!next||next.m.wide)){x.span=true;return;}
    col=(col+1)%2;
  });
  return`<div class="board" id="board">${data.map(tileHTML).join('')}</div>
    <div class="fine board-note">Tap a tile for its chart and how it is worked out. “This week” is Monday to Sunday. Trends cover the last ${range.label}.</div>`;
}
function tileHTML(x){
  const k=x.t.k,d=x.d,m=x.m;const title=esc(d.title||m.title);
  if(d.empty)return`<button class="tile tile-empty${m.wide||x.span?' tile-wide':''}" id="tile-${k}" onclick="openTile(${jsq(k)})"><span class="tile-l">${title}</span><span class="tile-e">${esc(d.empty)}</span></button>`;
  if(d.canvas){ // the Routes tile: a drawing, not a number
    return`<button class="tile tile-wide tile-routes" id="tile-${k}" onclick="openTile(${jsq(k)})">
      <span class="tile-h"><span>${title}</span>${d.note?`<i>${esc(d.note)}</i>`:''}</span>
      <span class="rvt-wrap"><canvas id="rvt-canvas" aria-label="Your routes, drawn from one starting point"></canvas><span class="rv-n">N ↑</span></span>
      <span class="tile-s dl-flat">${esc(d.foot||'')}</span></button>`;
  }
  if(m.wide){
    return`<div class="tile tile-wide tile-list" id="tile-${k}">
      <div class="tile-h"><span>${title}</span>${d.note?`<i>${esc(d.note)}</i>`:''}</div>
      ${(d.rows||[]).map(tileRowHTML).join('')}
      ${d.foot?`<button class="tl-foot" onclick="${esc(d.foot.js)}">${esc(d.foot.label)}${ICON('chev',14)}</button>`:''}</div>`;
  }
  return`<button class="tile${x.span?' tile-wide':''}" id="tile-${k}" onclick="openTile(${jsq(k)})">
    <span class="tile-l">${title}</span>
    <span class="tile-v">${esc(d.value)}<small>${esc(d.unit||'')}</small></span>
    <span class="tile-s dl-${d.tone||'flat'}">${esc(d.sub||'')}</span>
    ${d.spark||''}</button>`;
}
function tileRowHTML(r){
  return`<button class="tl-row" onclick="${esc(r.js)}"><span class="tl-main"><span class="tl-t">${esc(r.label)}</span>${r.sub?`<span class="tl-s">${esc(r.sub)}</span>`:''}</span>
    ${r.spark||''}<span class="tl-v">${esc(r.value)}${r.valueSub?`<small>${esc(r.valueSub)}</small>`:''}</span>
    ${r.delta!=null?`<span class="tl-d dl-${r.tone||'flat'}">${esc(r.delta)}</span>`:''}</button>`;
}
function openTile(k){
  const m=METRICS[k];if(!m)return;
  const t=boardTiles().find(x=>x.k===k)||{k};
  if(m.open)m.open(t);else showMetric(k,t);
}

// ─── A tile opened ───
let _metric=null;
function showMetric(k,arg){
  _metric={k,arg:arg||{}};
  const ov=makeOv('metric-ov');
  ov.innerHTML=`<div class="modal metric-sheet" style="max-height:94vh"><div class="mh"></div><div id="metric-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderMetric();
}
function renderMetric(){
  const el=document.getElementById('metric-body');if(!el||!_metric)return;
  const range=boardRange();let d;
  try{d=metricDetail(_metric.k,_metric.arg,range);}catch(e){logError(e,'metric detail '+_metric.k);d=null;}
  if(!d){el.innerHTML=`<div class="mt">Progress</div><div class="ch-empty">This could not be worked out.</div><button class="btn btg bfw" onclick="closeOv('metric-ov')">Close</button>`;return;}
  const modal=el.parentNode;const y=modal?modal.scrollTop:0;
  const st=s=>`<div class="st"><div class="st-v">${esc(String(s.v))}</div><div class="st-l">${esc(s.l)}</div></div>`;
  el.innerHTML=`<div class="mt" style="margin-bottom:2px">${esc(d.title)}</div>
    ${d.sub?`<div class="sheet-sub" style="margin-bottom:10px">${esc(d.sub)}</div>`:''}
    ${d.plain?'':`<div class="m-head"><div class="m-big">${esc(d.value==null?'–':String(d.value))}<span>${esc(d.unit||'')}</span></div>${d.delta?`<div class="m-delta dl-${d.tone||'flat'}">${esc(d.delta)}</div>`:''}</div>`}
    ${d.noRange?'':`<div class="seg seg-in" role="tablist">${RANGES.map(r=>`<button class="seg-b${r.id===range.id?' on':''}" onclick="setBoardRange('${r.id}')">${r.short}</button>`).join('')}</div>`}
    ${d.chart||''}
    ${d.stats&&d.stats.length?`<div class="st-grid${d.stats.length===2?' st-2':d.stats.length===4?' st-22':''}" style="margin-top:10px">${d.stats.map(st).join('')}</div>`:''}
    ${d.body||''}
    ${d.how?`<div class="fine">${esc(d.how)}</div>`:''}
    <div class="sheet-acts"><button class="btn btg" onclick="closeOv('metric-ov')">Close</button>${d.acts||''}</div>`;
  if(modal)modal.scrollTop=y;
}
// A list of tappable rows inside a sheet.
function mRowsHTML(rows,head){
  if(!rows.length)return'';
  return`${head?`<div class="sec-h">${esc(head)}</div>`:''}<div class="list">${rows.map(r=>`<button class="row row-tap" onclick="${esc(r.js)}"><span class="row-main"><span class="row-t">${esc(r.t)}</span>${r.s?`<span class="row-s">${esc(r.s)}</span>`:''}</span>
    ${r.v!=null?`<span class="aim"><span class="aim-v">${esc(String(r.v))}</span>${r.f?`<span class="aim-f">${esc(r.f)}</span>`:''}</span>`:''}<span class="row-chev">${ICON('chev',16)}</span></button>`).join('')}</div>`;
}
// Bars for a daily number over the range: one bar a day up to four weeks, weekly averages beyond.
function dailyChart(range,valueOf,o){
  o=o||{};const td=today();
  if(range.days<=28){
    const items=[];
    for(let i=range.days;i>=1;i--){const ds=daysAgoStr(i);const x=valueOf(ds);items.push({t:dayNum(ds),v:x.v,tone:x.tone,read:`${fmtDay(ds)} · ${x.v>0?o.fmt(x.v):'nothing logged'}`});}
    return chartBars(items,o);
  }
  const items=rangeWeeks(range).map(mon=>{
    let sum=0,n=0;for(let i=0;i<7;i++){const ds=addDays(mon,i);if(ds>=td)break;const x=valueOf(ds);if(x.v>0){sum+=x.v;n++;}}
    const avg=n?sum/n:0;
    return{t:dayNum(mon),v:avg,read:`Week of ${fmtDay(mon)} · ${n?`${o.fmt(avg)} a day over ${n} day${n===1?'':'s'}`:'nothing logged'}`};
  });
  return chartBars(items,o);
}
// ─── One exercise ───
// The same sheet from the Library, the Progress board, a record and a workout: what the exercise
// is, how often it is done, the best of it, where it sits in your workouts, and its sessions.
function exRoutines(id){
  return(S.routines||[]).filter(r=>r.active!==false).map(r=>({r,e:(r.exercises||[]).find(e=>e.exId===id)})).filter(x=>x.e);
}
function rtnPlanText(e){
  const sets=e.sets==null?3:e.sets;
  const reps=e.timed?(e.r?`${e.r} s`:'time'):e.amrap?'max':e.r?`${e.r}${e.rMax?'–'+e.rMax:''}`:'';
  return`${sets} set${sets===1?'':'s'}${reps?' × '+reps:''}`;
}
function exerciseDetail(id,range){
  const ex=getEx(id);if(!ex)return null;
  const u=S.unit||'lbs';const all=getExStrData(id);const pr=S.prs[id];
  const custom=!BUILTIN_EX_IDS.has(id);
  const pm=normMuscle(ex.muscle||'');
  const secs=[...new Set((SEC_MUSCLE[id]||[]).map(normMuscle))].filter(m=>m&&m!==pm&&MEV_MAV[m]);
  const mus=(pm&&MEV_MAV[pm])||secs.length?`<div class="ex-mus">${pm&&MEV_MAV[pm]?`<span class="pill pill-acc">${esc(pm)}</span>`:''}${secs.map(m=>`<span class="pill">${esc(m)}</span>`).join('')}</div>`:'';
  const used=exRoutines(id);
  const usedHTML=mRowsHTML(used.map(x=>({t:x.r.name,s:rtnPlanText(x.e),js:`closeOv('metric-ov');setTimeout(()=>showRoutineDetail(${JSON.stringify(x.r.id)}),240)`})),used.length?`In ${used.length} workout${used.length===1?'':'s'}`:'');
  // Where the record came from, and the way out when it is wrong.
  const wkPr=pr&&pr.wkId?S.workouts.find(w=>w.id===pr.wkId):null;
  const recHTML=!pr||!pr.w?'':pr.manual
    ?`<div class="note-box" style="margin-top:12px"><b>Record ${esc(fmt1(pr.w))} × ${esc(String(pr.r))} was carried over</b> from an earlier version of the app; no logged workout accounts for it. If it came from a typo or a discarded session, remove it.<button class="btn btd bsm" style="display:block;margin-top:8px" onclick="removeCarriedPR(${jsq(id)})">Remove this record</button></div>`
    :wkPr?mRowsHTML([{t:`${fmt1(pr.w)} × ${pr.r}`,s:`Set in ${wkPr.name} on ${fmtDay(dayOf(wkPr.started))}. Open it to exclude a mistyped set.`,v:pr.est,f:'1RM',js:`showWkDetail(${JSON.stringify(wkPr.id)})`}],'Record'):'';
  const extra=`${all.length?`<button class="btn bts bfw" style="margin-top:12px" onclick="closeOv('metric-ov');coachStart('exercise',${jsq(ex.name)})">${ICON('spark',15)} Ask the coach about this lift</button>`:''}
    ${custom?`<button class="btn btg bfw" style="margin-top:8px;color:var(--red)" onclick="delCustomEx(${jsq(id)})">Delete this exercise</button>`:''}`;
  const acts=`<button class="btn bts" onclick="showAddToRoutine(${jsq(id)})">Add to a workout</button>`;
  const info=[ex.cat,ex.eq,custom?'yours':''].filter(Boolean).join(' · ');
  if(!all.length){
    return{title:ex.name,sub:info,plain:true,noRange:true,
      body:`${mus}<div class="ch-empty">No sets logged yet. Once you train it, its trend, best set and how often you do it show here.</div>${usedHTML}${recHTML}${extra}`,acts};
  }
  const r=liftRow(id,range);const f=fitLine(r.pts);
  const wkOf=d=>S.workouts.find(w=>w.started===d.date);
  // How often: sessions in the period over the weeks of it you have been doing this lift.
  const firstDs=dayOf(all[0].date);const span=Math.max(7,Math.min(range.days,daysBetween(firstDs,today())+1));
  const perWk=r.pts.length?r.pts.length/(span/7):0;
  const ago=daysBetween(r.lastDs,today());
  return{title:ex.name,sub:`${info} · last done ${ago<=0?'today':ago===1?'yesterday':fmtDay(r.lastDs)}`,
    value:r.value!=null?Math.round(r.value):null,unit:` ${u} estimated max`,
    delta:r.stalled?'Flat for three sessions':r.delta!=null?`${fmtSigned(Math.round(r.delta))} ${u} since ${fmtDay(dayOf(r.pts[0].d.date))}`:'',
    tone:r.stalled?'warn':r.delta>0?'good':r.delta<0?'warn':'flat',
    chart:chartLine(r.pts.map(p=>({t:p.t,v:p.v,read:`${fmtDay(dayOf(p.d.date))} · ${p.v} ${u} (${p.d.w} × ${p.d.r})`})),
      {label:`${ex.name} estimated one-rep max`,empty:`No sessions in the last ${range.label}. The last one was on ${fmtDay(r.lastDs)}.`}),
    stats:[{v:pr&&pr.w?`${fmt1(pr.w)} × ${pr.r}`:'–',l:pr&&pr.date?`Best set, ${fmtDay(pr.date)}`:'Best set'},
      {v:r.pts.length,l:`Session${r.pts.length===1?'':'s'} in ${range.short}`},
      {v:r.pts.length?(perWk>=10?Math.round(perWk):perWk.toFixed(1)):'–',l:'Times a week'},
      {v:f&&f.span>=7?`${fmtSigned(f.perDay*7,1)} ${u}`:'–',l:'Gained a week'}],
    body:`${mus}${patLiftHTML(id)}${usedHTML}${mRowsHTML(r.pts.slice(-6).reverse().map(p=>{const wk=wkOf(p.d);return{t:fmtDate(p.d.date).replace(/, \d{4}$/,''),s:`${wk?wk.name+' · ':''}best set ${p.d.w} × ${p.d.r}`,v:p.v,js:wk?`showWkDetail(${JSON.stringify(wk.id)})`:''};}),'Sessions')}${recHTML}${extra}`,
    how:'Estimated max is the best set of each session turned into a one-rep max with the Epley formula (weight × (1 + reps ÷ 30)). Warm-ups and sets you excluded are left out. Times a week counts from your first session of this lift when that is inside the period.',acts};
}
// What Patterns has found about this lift (only what clears the bar).
function patLiftHTML(id){
  let rows=[];try{rows=patForLift(id);}catch(e){logError(e,'patterns');}
  return mRowsHTML(rows.map(r=>({t:r.t,s:`${r.tier==='solid'?'Solid':'Likely'} · ${r.n} sessions`,js:`showPattern(${JSON.stringify(r.test.id)})`})),rows.length?'Patterns':'');
}
// Put an exercise into one of your workouts, from its sheet.
function showAddToRoutine(exId){
  const ex=getEx(exId);if(!ex)return;
  const rs=(S.routines||[]).filter(r=>r.active!==false);
  const ov=makeOv('addrt-ov');
  ov.innerHTML=`<div class="modal" style="max-height:80vh"><div class="mh"></div>
    <div class="mt" style="margin-bottom:2px">Add to a workout</div>
    <div class="sheet-sub">${esc(ex.name)} goes in at three sets; set the reps in the workout.</div>
    ${rs.length?`<div class="list">${rs.map(r=>{const has=(r.exercises||[]).some(e=>e.exId===exId);
      return`<button class="row row-tap"${has?' disabled':''} onclick="addExerciseTo(${jsq(r.id)},${jsq(exId)})"><span class="row-main"><span class="row-t">${esc(r.name)}</span><span class="row-s">${has?'Already in this workout':`${(r.exercises||[]).length} exercise${(r.exercises||[]).length===1?'':'s'}`}</span></span>${has?'':`<span class="row-ic tone-info">${ICON('plus',16)}</span>`}</button>`;}).join('')}</div>`
      :`<div class="ch-empty">You have no workouts yet. Make one in Library, then add exercises to it.</div>`}
    <button class="btn btg bfw" style="margin-top:10px" onclick="closeOv('addrt-ov')">Cancel</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function addExerciseTo(rid,exId){
  const r=(S.routines||[]).find(x=>x.id===rid);const ex=getEx(exId);if(!r||!ex)return;
  if(!Array.isArray(r.exercises))r.exercises=[];
  if(r.exercises.some(e=>e.exId===exId)){toast(`${ex.name} is already in ${r.name}`);return;}
  const e={exId,sets:3,w:'',r:'',type:'flat',rest:null};
  if(typeof TIMED_BY_DEFAULT!=='undefined'&&TIMED_BY_DEFAULT.has(exId))e.timed=true;
  r.exercises.push(e);save();closeOv('addrt-ov');
  if(document.getElementById('metric-ov'))renderMetric();
  if(S.tab==='library')renderLibrary(document.getElementById('content'));
  toast(`${ex.name} added to ${r.name}`,'green',{action:'Undo',onAction:()=>{r.exercises=r.exercises.filter(x=>x!==e);save();if(document.getElementById('metric-ov'))renderMetric();if(S.tab==='library')renderLibrary(document.getElementById('content'));}});
}
function metricDetail(k,arg,range){
  const u=S.unit||'lbs';
  if(k==='lift')return exerciseDetail(arg.id,range);
  if(k==='records'){
    const all=recordRows();const fresh=newRecords(range);
    return{title:'Records',sub:'Your best estimated one-rep max on every lift',value:fresh.length,unit:` new in ${range.short}`,
      body:mRowsHTML(all.map(r=>({t:r.name,s:[r.date?fmtDay(r.date):r.manual?'carried over':'',r.gain>0?`${fmtSigned(r.gain)} ${u} on your best`:''].filter(Boolean).join(' · '),v:`${r.w} × ${r.r}`,f:`1RM ${r.est}`,js:`showPRDetail(${JSON.stringify(r.id)})`})),'Newest first'),
      how:'A record is the set with the highest estimated one-rep max. Matching it later does not move its date. Tap one to see the workout it came from.'};
  }
  if(k==='weight'){
    const log=S.bodyweightLog||[];const pts=weightPts(range.from);const f=weightFit(range.from);
    const d=pts.length>=2?pts[pts.length-1].v-pts[0].v:null;
    const rows=log.slice(0,8).map((b,i)=>{const prev=log[i+1];return{t:fmtDate(b.date+'T12:00:00').replace(/, \d{4}$/,''),s:prev?(Math.abs(b.weight-prev.weight)<0.05?'no change':`${fmtSigned(b.weight-prev.weight,1)} from ${fmtDay(prev.date)}`):'',v:fmt1(b.weight),js:'showWeighIn()'};});
    return{title:'Body weight',sub:log.length?`Last weighed ${log[0].date===today()?'today':fmtDay(log[0].date)}`:'No weigh-ins yet',value:log.length?fmt1(log[0].weight):null,unit:' '+u,
      delta:f?(Math.abs(f.perWeek)<0.05?'Steady':`${fmtSigned(f.perWeek,1)} ${u} a week`):'',tone:f?weightTone(f.perWeek):'flat',
      chart:chartLine(pts.map(p=>({t:p.t,v:p.v,read:`${fmtDay(p.ds)} · ${fmt1(p.v)} ${u}`})),{fit:f?{a:f.a,b:f.b}:null,label:'Body weight',fmt:v=>fmt1(v)}),
      stats:pts.length?[{v:d==null?'–':`${fmtSigned(d,1)} ${u}`,l:`Change in ${range.short}`},{v:pts.length,l:`Weigh-in${pts.length===1?'':'s'}`},
        {v:fmt1(Math.min(...pts.map(p=>p.v))),l:'Lowest'},{v:fmt1(Math.max(...pts.map(p=>p.v))),l:'Highest'}]:[],
      body:mRowsHTML(rows,'Recent weigh-ins'),
      how:'The dashed line is a straight-line fit through every weigh-in of the period, and the weekly figure is its slope. One fit is used everywhere in the app. It needs two weigh-ins at least three days apart.',
      acts:`<button class="btn btp" onclick="showWeighIn()">Weigh in</button>`};
  }
  if(k==='sessions'){
    const wd=weekDays();const done=wd.filter(x=>x.state==='done').length;const plan=hasFixedSchedule()?wd.filter(x=>x.planned).length:null;
    const wk=sessionWeeks(range);const ppw=plannedPerWeek();
    // Averages start with the first week that has a workout: the weeks before you began are not zeros.
    const first=S.workouts.length?mondayOf(dayOf(Math.min(...S.workouts.map(w=>w.started)))):null;
    const past=wk.filter(w=>!w.current&&first&&w.mon>=first);
    const lifts=S.workouts.filter(w=>dayOf(w.started)>=range.from).length,acts=S.activities.filter(a=>a.date>=range.from).length;
    return{title:'Sessions',sub:'Days with a workout, Monday to Sunday',value:done,unit:plan?` of ${plan} this week`:' this week',
      delta:nextSessionLabel()?`Next: ${nextSessionLabel()}`:'',tone:'flat',
      chart:chartBars(wk.map(w=>({t:dayNum(w.mon),v:w.n,hollow:w.current,tone:ppw&&!w.current&&w.n>=ppw?'good':'',read:`Week of ${fmtDay(w.mon)} · ${w.n} session${w.n===1?'':'s'}${w.current?' so far':''}`})),{plan:ppw,label:'Sessions a week',fmt:v=>String(Math.round(v))}),
      stats:[{v:getStreak(),l:hasFixedSchedule()?'Sessions since a missed day':'Sessions without a 3-day gap'},{v:past.length?(past.reduce((t,w)=>t+w.n,0)/past.length).toFixed(1):'–',l:'A week, on average'},{v:lifts,l:`Workouts in ${range.short}`},{v:acts,l:`Activities in ${range.short}`}],
      body:`<div class="sec-h">This week</div>${weekDotsHTML(wd)}`,
      how:(hasFixedSchedule()?'The dashed line is your plan. The streak counts training days in a row without missing a planned one; rest days do not break it.':'The streak counts training days with no more than two idle days between them.')+' The current week is drawn hollow because it is not over.',
      acts:`<button class="btn bts" onclick="closeOv('metric-ov');showWeekReview()">This week’s check-in</button>`};
  }
  if(k==='calories'||k==='protein'){
    const cal=k==='calories';const key=cal?'cals':'protein';
    const week=foodAvg(foodDays(7),key);const all=foodAvg(foodDays(range.days),key);
    const tile=METRICS[k].tile(range,{});
    const m=cal?maintenanceBest():null;
    const stats=all?[{v:cal?all.avg.toLocaleString():all.avg+' g',l:`Average in ${range.short}`},{v:cal?all.goal.toLocaleString():all.goal+' g',l:'Average target'},{v:`${all.n} of ${range.days}`,l:'Days logged'}]:[];
    if(cal&&all)stats.push({v:m.kcal.toLocaleString(),l:m.src==='logs'?'Maintenance, from your log':'Maintenance, by formula'});
    return{title:cal?'Calories':'Protein',sub:'Average of the last 7 finished days',value:week?(cal?week.avg.toLocaleString():week.avg):null,unit:cal?' a day':' g a day',
      delta:tile.empty?'':tile.sub,tone:tile.tone,
      chart:dailyChart(range,ds=>{const t=getDayTotals(ds);const g=goalsFor(ds)||{};const v=cal?(t.cals||0):(t.protein||0);const goal=cal?g.cals:g.protein;
          return{v,tone:v>0&&goal&&(cal?Math.abs(v-goal)<=goal*0.05:v>=goal*0.95)?'good':''};},
        {target:all?all.goal:null,label:cal?'Calories a day':'Protein a day',fmt:v=>cal?Math.round(v).toLocaleString():Math.round(v)+' g',read:all?`${all.n} day${all.n===1?'':'s'} logged in the last ${range.label}`:''}),
      stats,
      how:cal?'The line is your average target over the days you logged; green bars are within 5% of that day’s own target. Days with nothing logged are left out of every average rather than counted as zero. Today is not included until it is over.'
        :'The line is your average protein target; green bars reached at least 95% of that day’s target. Days with nothing logged are left out of the average.',
      acts:`<button class="btn bts" onclick="closeOv('metric-ov');go('nutrition')">Open Nutrition</button>`};
  }
  if(k==='runpace'){
    const opt=pacePick(arg);if(!opt)return{title:'Pace',plain:true,noRange:true,body:`<div class="ch-empty">Log a run with its distance and time to see your pace.</div>`};
    const all=paceSeries(opt);const pts=paceSeries(opt,range.from);const last=all[all.length-1];
    const tile=METRICS.runpace.tile(range,arg);
    const real=p=>`${fmt1(p.dist)} mi in ${fmtClock(actSec(p.a))}`;
    const band=RUN_BANDS.find(b=>opt.type==='run'&&b.dist===opt.dist);
    const sub=opt.all?'Every run, each turned into the pace it is worth over 5K'
      :band?(band.hi>1e6?`Runs longer than ${band.lo} mi`:`${band.label}: runs from ${band.lo} to ${band.hi} mi`)
      :`${opt.short}, to the nearest ${opt.dist>10?'five miles':'mile'}`;
    const tr=paceTrend(opt,pts);
    return{title:opt.all?'5K pace, all runs':`${opt.kind} pace`,sub,value:fmtPace(last.v),unit:opt.all?' a mile, as a 5K':' a mile',delta:tile.sub,tone:tile.tone,
      chart:chartLine(pts.map(p=>({t:p.t,v:p.v,read:`${fmtDay(p.ds)} · ${fmtPace(p.v)} a mile${opt.all?' as a 5K':''} (${real(p)})`})),{invert:true,fmt:fmtPace,label:'Pace',fit:tr?tr.fit:null}),
      stats:pts.length?[{v:fmtPace(Math.min(...pts.map(p=>p.v))),l:`Best in ${range.short}`},{v:pts.length,l:`Time${pts.length===1?'':'s'} in ${range.short}`},{v:fmtClock(actSec(last.a)),l:`Latest, ${fmtDay(last.ds)}`}]:[],
      body:mRowsHTML(all.slice(-8).reverse().map(p=>({t:fmtDate(p.ds+'T12:00:00').replace(/, \d{4}$/,''),s:real(p)+(opt.all?` · ${fmtPace(p.sec)} a mile on the day`:''),v:fmtPace(p.v),js:`showActivityDetail(${JSON.stringify(p.a.id)})`})),'Efforts'),
      how:(opt.all?'Each run is turned into the time it is worth over 5K with Riegel’s formula (time × (5K ÷ distance)^1.06), then shown as a pace, so a mile and a ten-miler sit on one line. It evens out distance, not effort: an easy day still reads slower than a hard one, so the direction is taken from the dashed line fitted through every run of the period. Runs shorter than 0.93 mi are left out.'
        :opt.type==='run'?'Pace is time divided by distance, only for runs where both are real. Runs are grouped into distance bands (about 1 mi, 2 mi, 5K, 4 mi, 10K, half, longer) because GPS measures the same route a little differently each time. A run between bands shows only under “all runs”.'
        :'Pace is time divided by distance, only for efforts where you entered both. Distances are grouped to the nearest mile.')+' The chart rises as you get faster. Change what it shows in Edit board.'};
  }
  if(k==='sets'){
    const st=setsStatus();const wk=setsWeeks(range);
    return{title:'Hard sets',sub:'Working sets in the last 7 days, by muscle',value:fmtSets(Math.round(st.total)),unit:' sets',
      delta:st.high?`${st.high} over range`:st.low?`${st.low} under range`:st.total?'All in range':'',tone:st.high?'warn':'flat',
      chart:chartBars(wk.map(w=>({t:dayNum(w.mon),v:w.n,hollow:w.current,read:`Week of ${fmtDay(w.mon)} · ${w.n} set${w.n===1?'':'s'}${w.current?' so far':''}`})),{label:'Sets a week',fmt:v=>String(Math.round(v))}),
      stats:[{v:st.ok,l:'Muscles in range'},{v:st.low,l:'Under'},{v:st.high,l:'Over'}],
      body:`<div class="legacy">${renderVolumeBody()}</div><details class="fold"><summary>Fatigue, week by week</summary><div class="legacy">${renderRecoveryBody()}</div></details>`,
      how:'A set counts toward every muscle the exercise trains, in full for the main one and in part for the helpers. Warm-ups are left out. The range for each muscle is the usual minimum to maximum weekly sets for growth.'};
  }
  if(k==='standards')return{title:'Strength standards',plain:true,noRange:true,
    body:`<div class="legacy">${renderStandardsBody()}</div><div class="sec-h">Wilks and DOTS</div><div class="legacy">${renderWilksBody()}</div>`};
  if(k==='aft')return{title:'Fitness test',plain:true,noRange:true,body:`<div class="legacy" id="card-aft">${renderAFTBody()}</div>`};
  if(k==='steps'){
    const tile=METRICS.steps.tile(range,{});const td=parseInt((S.stepsLog||{})[today()])||0;
    const vals=[];for(let i=range.days;i>=1;i--){const v=parseInt((S.stepsLog||{})[daysAgoStr(i)])||0;if(v>0)vals.push(v);}
    return{title:'Steps',sub:'Average of the days you logged in the last 7',value:tile.empty?null:tile.value,unit:' a day',delta:td?`Today: ${td.toLocaleString()}`:'',tone:'flat',
      chart:dailyChart(range,ds=>({v:parseInt((S.stepsLog||{})[ds])||0}),{label:'Steps a day',fmt:v=>Math.round(v).toLocaleString()}),
      stats:vals.length?[{v:Math.round(vals.reduce((a,b)=>a+b,0)/vals.length).toLocaleString(),l:`Average in ${range.short}`},{v:Math.max(...vals).toLocaleString(),l:'Best day'},{v:vals.length,l:'Days logged'}]:[],
      acts:`<button class="btn btp" onclick="showRetroSteps()">Log today’s steps</button>`};
  }
  if(k==='measure'){
    const part=measurePart();const mu=S.measureUnit||'in';
    if(!part)return{title:'Measurements',plain:true,noRange:true,body:`<div class="legacy">${renderMeasurementsBody()}</div>`};
    const pts=measurePts(part.id,range.from);const all=measurePts(part.id);const last=all[all.length-1];
    const d=pts.length>=2?pts[pts.length-1].v-pts[0].v:null;
    return{title:part.label,sub:`Last measured ${fmtDay(last.ds)}`,value:fmt1(last.v),unit:' '+mu,delta:d==null?'':Math.abs(d)<0.05?'No change':`${fmtSigned(d,1)} ${mu} since ${fmtDay(pts[0].ds)}`,tone:'flat',
      chart:chartLine(pts.map(p=>({t:p.t,v:p.v,read:`${fmtDay(p.ds)} · ${fmt1(p.v)} ${mu}`})),{label:part.label,fmt:v=>fmt1(v)}),
      body:`<div class="legacy">${renderMeasurementsBody()}</div>`};
  }
  return null;
}

// ─── Every lift ───
function showAllLifts(){
  const ov=makeOv('lifts-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div id="lifts-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);renderAllLifts();
}
function renderAllLifts(){
  const el=document.getElementById('lifts-body');if(!el)return;
  const range=boardRange();
  const rows=getExsWithHist().map(id=>liftRow(id,range)).sort((a,b)=>(b.inRange-a.inRange)||a.name.localeCompare(b.name));
  el.innerHTML=`<div class="mt" style="margin-bottom:2px">Lifts</div>
    <div class="sheet-sub">Estimated one-rep max in ${esc(S.unit)}, and how far each has moved in the last ${range.label}. Most trained first.</div>
    ${rows.length?'':`<div class="ch-empty">No lifts yet. They appear here once you log a workout with weights.</div>`}
    <div class="tile-list lifts-all">${rows.map(r=>tileRowHTML({label:r.name,js:`showMetric('lift',{id:${JSON.stringify(r.id)}})`,spark:svgSpark(r.pts,{w:72,h:24,cls:'spark-sm'}),
      value:r.value!=null?String(Math.round(r.value)):'–',delta:r.stalled?'flat':r.delta!=null?fmtSigned(Math.round(r.delta)):'–',
      tone:r.stalled?'warn':r.delta==null?'flat':r.delta>0?'good':r.delta<0?'warn':'flat'})).join('')}</div>
    <button class="btn btg bfw" style="margin-top:10px" onclick="closeOv('lifts-ov')">Close</button>`;
}

// ─── Edit board ───
function showBoardEdit(){
  const ov=makeOv('bedit-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div id="bedit-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);renderBoardEdit();
}
function renderBoardEdit(){
  const el=document.getElementById('bedit-body');if(!el)return;
  const tiles=boardTiles().filter(t=>METRICS[t.k]);const on=new Set(tiles.map(t=>t.k));
  const goal=(GOALS.find(g=>g.id===S.goal)||GOALS[GOALS.length-1]).label;
  const rows=tiles.map((t,i)=>{const m=METRICS[t.k];
    return`<div class="be-row" data-k="${t.k}">
      <button class="be-grip" aria-label="Move ${m.title}. Drag, or use the up and down arrow keys." onpointerdown="beDragStart(event,${i})" onkeydown="beKey(event,${i})">${ICON('grip',18)}</button>
      ${m.param?`<button class="be-main" onclick="showTileParam(${jsq(t.k)})"><b>${m.title}</b><span>${esc(m.paramText(t))}</span></button>`:`<div class="be-main"><b>${m.title}</b></div>`}
      <button class="be-x" aria-label="Remove ${m.title}" onclick="boardRemove(${jsq(t.k)});progRefresh()">${ICON('minusc',20)}</button></div>`;}).join('');
  const more=METRIC_GROUPS.map(g=>{
    const list=Object.keys(METRICS).filter(k=>METRICS[k].group===g&&!on.has(k)&&tileAllowed(k));if(!list.length)return'';
    return list.map(k=>`<div class="be-row be-add"><div class="be-main"><b>${METRICS[k].title}</b><span class="be-g">${g}</span></div>
      <button class="be-x be-plus" aria-label="Add ${METRICS[k].title}" onclick="boardAdd(${jsq(k)});progRefresh()"${tiles.length>=BOARD_MAX?' disabled':''}>${ICON('plusc',20)}</button></div>`).join('');
  }).join('');
  el.innerHTML=`<div class="mt" style="margin-bottom:2px">Edit board</div>
    <div class="sheet-sub">What shows on Progress, and in what order. Drag by the handle.</div>
    <div class="sec-h">On your board</div>
    <div class="be-list" id="be-list">${rows||'<div class="ch-empty">Nothing on the board. Add something below.</div>'}</div>
    ${more?`<div class="sec-h">Add</div><div class="be-list">${more}</div>`:''}
    <div class="sheet-acts">${boardCustom()?`<button class="btn btg" id="be-reset" onclick="boardSet(null);progRefresh()">Reset to the ${esc(goal)} layout</button>`:`<span class="be-note">This is the ${esc(goal)} layout.</span>`}
      <button class="btn btp" onclick="closeOv('bedit-ov')">Done</button></div>`;
}
// Drag a row by its handle. The row follows the finger; the rows it passes step out of the way.
let _beDrag=null;
function beDragStart(e,i){
  const list=document.getElementById('be-list');if(!list)return;
  const rows=[...list.querySelectorAll('.be-row')];if(!rows[i])return;
  const grip=e.currentTarget;
  _beDrag={i,to:i,y0:e.clientY,h:rows[i].getBoundingClientRect().height,rows};
  try{grip.setPointerCapture(e.pointerId);}catch(x){}
  rows[i].classList.add('be-drag');
  const move=ev=>{
    const d=_beDrag;if(!d)return;
    const y=Math.max(-d.i*d.h,Math.min((d.rows.length-1-d.i)*d.h,ev.clientY-d.y0));
    d.rows[d.i].style.transform=`translateY(${y}px)`;
    d.to=Math.max(0,Math.min(d.rows.length-1,Math.round(d.i+y/d.h)));
    d.rows.forEach((r,j)=>{if(j!==d.i)r.style.transform=(d.i<j&&j<=d.to)?`translateY(${-d.h}px)`:(d.to<=j&&j<d.i)?`translateY(${d.h}px)`:'';});
    ev.preventDefault();
  };
  const up=()=>{
    grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',up);grip.removeEventListener('pointercancel',up);
    const d=_beDrag;_beDrag=null;if(!d)return;
    if(d.to!==d.i)boardMove(d.i,d.to);
    progRefresh();
  };
  grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',up);grip.addEventListener('pointercancel',up);
  e.preventDefault();
}
function beKey(e,i){
  if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;
  e.preventDefault();const to=i+(e.key==='ArrowUp'?-1:1);
  if(to<0||to>=boardTiles().length)return;
  boardMove(i,to);progRefresh();
  const g=document.querySelectorAll('#be-list .be-grip')[to];if(g)g.focus();
}
// What a tile points at: which lifts, which distance.
function showTileParam(k){if(METRICS[k]&&METRICS[k].param==='lifts')showLiftPicker();else if(METRICS[k]&&METRICS[k].param==='pace')showPacePicker();}
function showLiftPicker(){
  const ov=makeOv('lpick-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div id="lpick-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);renderLiftPicker();
}
function renderLiftPicker(){
  const el=document.getElementById('lpick-body');if(!el)return;
  const t=boardTiles().find(x=>x.k==='lifts')||{k:'lifts'};const chosen=boardLiftIds(t);
  const all=getExsWithHist().map(id=>({id,name:exName(id),n:getExStrData(id).length})).sort((a,b)=>(b.n-a.n)||a.name.localeCompare(b.name));
  el.innerHTML=`<div class="mt" style="margin-bottom:2px">Lifts on the board</div>
    <div class="sheet-sub">Up to six, shown in the order you pick them. ${chosen.length} chosen.</div>
    <div class="list">${all.map(x=>{const at=chosen.indexOf(x.id);return`<button class="row row-tap" role="checkbox" aria-checked="${at>=0?'true':'false'}" onclick="toggleBoardLift(${jsq(x.id)})">
      <span class="row-ic${at>=0?' tone-info':''}">${at>=0?at+1:''}</span><span class="row-main"><span class="row-t">${esc(x.name)}</span><span class="row-s">${x.n} session${x.n===1?'':'s'}</span></span></button>`;}).join('')}</div>
    <button class="btn btp bfw" onclick="closeOv('lpick-ov')">Done</button>`;
}
function toggleBoardLift(id){
  const t=boardTiles().find(x=>x.k==='lifts')||{k:'lifts'};let ids=boardLiftIds(t).slice();
  if(ids.includes(id)){if(ids.length===1){toast('Keep at least one lift');return;}ids=ids.filter(x=>x!==id);}
  else{if(ids.length>=6){toast('Up to six lifts');return;}ids.push(id);}
  boardTileParams('lifts',{ids});renderLiftPicker();progRefresh();
}
function showPacePicker(){
  const opts=paceOptions();const t=boardTiles().find(x=>x.k==='runpace')||{k:'runpace'};const cur=pacePick(t);
  const ov=makeOv('ppick-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div class="mt" style="margin-bottom:2px">Pace for</div>
    <div class="sheet-sub">Runs are grouped by distance. “All runs” puts every run on one line as a 5K pace.</div>
    ${opts.length?`<div class="list">${opts.map(o=>`<button class="row row-tap${cur&&o.label===cur.label?' row-on':''}" onclick="setBoardPace(${jsq(o.type)},${o.dist})"><span class="row-main"><span class="row-t">${esc(o.label)}</span><span class="row-s">${o.n} time${o.n===1?'':'s'}, last on ${fmtDay(o.last)}</span></span></button>`).join('')}</div>`
      :`<div class="ch-empty">Log a run with its distance and time first.</div>`}
    <button class="btn btg bfw" onclick="closeOv('ppick-ov')">Close</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function setBoardPace(type,dist){boardTileParams('runpace',{type,dist});closeOv('ppick-ov');progRefresh();}


// ─── Detail bodies carried over from the cards ───
// A record opens the exercise it belongs to: the record, where it was set, and everything else about the lift.
function showPRDetail(exId){if(getEx(exId))showMetric('lift',{id:exId});}
function removeCarriedPR(exId){
  delete S.prsManual[exId];rebuildPRs();save();
  if(document.getElementById('metric-ov'))renderMetric();
  if(S.tab==='progress')progRefresh();
  toast('Record removed','green');
}
// Muscle-group figures (front + back, MuscleWiki-style SVG art). Each tracked region
// is tappable (opens its volume trend) and colored by this-week volume vs MEV/MAV.
// One tracked muscle can drive several SVG regions (delts split front/rear, traps incl. mid-trap, calves both views).
const BM_MAP={
  'Chest':['f-chest'],
  'Lats':['b-lats'],
  'Shoulders':['f-front-shoulders','b-rear-shoulders'],
  'Biceps':['f-biceps'],
  'Triceps':['b-triceps'],
  'Forearms':['f-forearms','b-forearms'],
  'Quads':['f-quads'],
  'Hamstrings':['b-hamstrings'],
  'Glutes':['b-glutes'],
  'Calves':['f-calves','b-calves'],
  'Abs':['f-abdominals'],
  'Obliques':['f-obliques'],
  'Lower Back':['b-lowerback'],
  'Traps':['f-traps','b-traps','b-traps-middle'],
};
const BM_UNTRACKED=['f-hands','b-hands'];
const BM_FILL={none:'var(--bm-muscle)',low:'var(--red)',ok:'var(--green)',high:'var(--purple)'};
function bmStatus(sbm,m){const mm=MEV_MAV[m];if(!mm)return'none';const s=sbm[m]||0;return s===0?'none':s<mm.mev?'low':s<=mm.mav?'ok':'high';}
// Inject per-group fill color + (for tracked muscles) a tap handler into the SVG markup.
function bmPaint(svg,groups){
  return svg.replace(/<g id="([^"]+)"/g,(full,id)=>{
    const g=groups[id];if(!g)return full;
    const click=g.m?` class="bm-mw-rg" onclick="showMuscleDetail('${g.m}')"`:'';
    return `<g id="${id}" style="color:${g.c}"${click}`;
  });
}
function bmFigure(view,sbm){
  const groups={};
  BM_UNTRACKED.forEach(id=>groups[id]={c:'var(--bm-muscle)',m:null});
  Object.entries(BM_MAP).forEach(([m,ids])=>{const c=BM_FILL[bmStatus(sbm,m)];ids.forEach(id=>groups[id]={c,m});});
  return bmPaint(view==='front'?BM_FRONT:BM_BACK,groups);
}
function renderBodyMap(sbm){
  return`<div style="padding:10px 12px 2px"><div style="display:flex;gap:8px;max-width:360px;margin:0 auto">
    <div style="flex:1">${bmFigure('front',sbm)}<div class="bm-cap2">Front</div></div>
    <div style="flex:1">${bmFigure('back',sbm)}<div class="bm-cap2">Back</div></div>
  </div>
  <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:12px;margin-top:6px;font-size:12px;color:var(--muted);font-weight:600">
    <span><span class="bm-dot" style="background:var(--red)"></span>Under</span>
    <span><span class="bm-dot" style="background:var(--green)"></span>On target</span>
    <span><span class="bm-dot" style="background:var(--purple)"></span>Over</span>
    <span><span class="bm-dot" style="background:var(--bm-muscle)"></span>None</span>
  </div>
  <div style="text-align:center;font-size:12px;color:var(--muted2);margin-top:3px">Tap a muscle for its trend</div></div>`;
}
function showMuscleDetail(m){
  const mm=MEV_MAV[m];if(!mm)return;
  const now=Date.now(),DAY=86400000;
  const weeks=[0,1,2,3,4,5].map(i=>muscleSetsInRange(now-(i+1)*7*DAY,now-i*7*DAY)[m]||0);
  const cur=weeks[0];
  const status=cur===0?'none':cur<mm.mev?'low':cur<=mm.mav?'ok':'high';
  const col={none:'var(--muted)',low:'var(--red)',ok:'var(--green)',high:'var(--purple)'}[status];
  const lbl={none:'No volume logged this week',low:'Below MEV — add work',ok:'In the productive range',high:'Above MAV — consider trimming'}[status];
  const maxv=Math.max(mm.mav,...weeks,1);
  const bars=weeks.map((v,i)=>{
    const h=Math.round((v/maxv)*100);
    const c=v===0?'var(--bm-muscle)':v<mm.mev?'var(--red)':v<=mm.mav?'var(--green)':'var(--purple)';
    return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="width:100%;height:78px;display:flex;align-items:flex-end"><div style="width:100%;height:${h}%;min-height:3px;background:${c};border-radius:4px 4px 0 0"></div></div>
      <div style="font-size:8px;color:var(--muted);font-family:var(--mono)">${fmtSets(v)}</div>
      <div style="font-size:8px;color:var(--muted2)">${i===0?'now':'-'+i+'w'}</div>
    </div>`;
  }).reverse().join('');
  const ov=makeOv('musc-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div class="mt" style="margin-bottom:1px">${mm.lbl}</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:13px">${m}</div>
    <div style="display:flex;gap:10px;margin-bottom:13px">
      <div style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:11px;text-align:center"><div style="font-size:24px;font-weight:600;font-family:var(--mono);color:${col};line-height:1.1">${fmtSets(cur)}</div><div style="font-size:12px;color:var(--muted);margin-top:3px">Sets this week</div></div>
      <div style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:11px;text-align:center"><div style="font-size:24px;font-weight:600;font-family:var(--mono);line-height:1.1">${mm.mev}–${mm.mav}</div><div style="font-size:12px;color:var(--muted);margin-top:3px">Target range</div></div>
    </div>
    <div style="font-size:12px;font-weight:600;color:${col};margin-bottom:12px">${lbl}</div>
    <div style="font-size:12px;color:var(--muted2);font-weight:600;margin-bottom:7px">6-week trend</div>
    <div style="display:flex;gap:5px;align-items:flex-end;margin-bottom:14px">${bars}</div>
    <button class="btn btg bfw" onclick="closeOv('musc-ov')">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function renderVolumeBody(){
  const ago7=Date.now()-7*86400000;const sbm=muscleSetsInRange(ago7,Date.now()+1);
  const muscles=Object.entries(MEV_MAV);
  let html=renderBodyMap(sbm)+`<div style="padding:8px 16px 5px;font-size:12px;color:var(--muted2);font-weight:500;">This week · target: MEV–MAV sets</div>`;
  html+=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border)">`;
  muscles.forEach(([m,mm])=>{
    const s=sbm[m]||0;
    const status=s===0?'none':s<mm.mev?'low':s<=mm.mav?'ok':'high';
    const bg={'none':'var(--card)','low':'var(--rdim)','ok':'var(--grdim)','high':'var(--pdim)'}[status];
    const col={'none':'var(--muted2)','low':'var(--red)','ok':'var(--green)','high':'var(--purple)'}[status];
    const lbl={'none':'–','low':'Below','ok':'On Track','high':'Above Max'}[status];
    const pct=Math.min(100,Math.round((s/mm.mav)*100));
    html+=`<div style="background:${bg};padding:10px 8px;text-align:center">
      <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:3px">${mm.lbl}</div>
      <div style="font-size:22px;font-weight:600;font-family:var(--mono);color:${col};line-height:1.1">${fmtSets(s)}</div>
      <div style="font-size:8px;color:${col};margin-top:2px;font-weight:600">${lbl}</div>
      <div style="height:3px;background:var(--border);border-radius:2px;margin-top:5px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${col};border-radius:2px"></div></div>
    </div>`;
  });
  html+=`</div><div style="padding:8px 16px;display:flex;gap:12px;font-size:12px;font-weight:600;border-top:1px solid var(--border)">
    <span style="color:var(--red)">■ Below MEV</span><span style="color:var(--green)">■ In Range</span><span style="color:var(--purple)">■ Above MAV</span>
  </div>`;
  return html;
}
function renderRecoveryBody(){
  const{ws,warnings}=getRecoveryData();
  const tot0=Object.values(ws[0]).reduce((a,b)=>a+b,0);const tot1=Object.values(ws[1]).reduce((a,b)=>a+b,0);
  const fatigue=warnings.length>=3?'High':warnings.length>=1?'Moderate':'Low';
  const fcol={High:'var(--red)',Moderate:'var(--gold)',Low:'var(--green)'}[fatigue];
  const femoji={High:'🔴',Moderate:'🟡',Low:'🟢'}[fatigue];
  let html=`<div style="background:var(--bg);border-bottom:1px solid var(--border)">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:13px">
      <div><div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:3px">Accumulated Fatigue</div>
      <div style="font-size:26px;font-weight:700;color:${fcol};letter-spacing:-.5px">${fatigue}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">${fmtSets(tot0)} sets this week · ${fmtSets(tot1)} last week</div></div>
      <div style="font-size:32px">${femoji}</div>
    </div>
    ${warnings.length?`<div style="padding:0 16px 12px;font-size:12px;color:var(--gold);font-weight:600">${ICON('💡',13)} Deload: ${warnings.map(w=>w.muscle).join(', ')}</div>`:''}
  </div>
  <div style="padding:0 16px">
    <div style="display:grid;grid-template-columns:1fr 52px 52px 58px;padding:8px 0;border-bottom:2px solid var(--border)">
      <div style="font-size:12px;font-weight:600;color:var(--muted2);">Muscle</div>
      <div style="font-size:12px;font-weight:600;color:var(--muted2);text-align:center;">W–2</div>
      <div style="font-size:12px;font-weight:600;color:var(--muted2);text-align:center;">W–1</div>
      <div style="font-size:12px;font-weight:600;color:var(--navy);text-align:center;">Now</div>
    </div>`;
  Object.entries(MEV_MAV).forEach(([m,mm])=>{
    const w2=ws[2]?.[m]||0,w1=ws[1]?.[m]||0,w0=ws[0]?.[m]||0;
    const col=w0>mm.mav?'var(--red)':w0>=mm.mev?'var(--green)':'var(--muted)';
    const trend=w0>w1?'↑':w0<w1?'↓':'→';const tc=w0>w1?'var(--red)':w0<w1?'var(--green)':'var(--muted2)';
    html+=`<div style="display:grid;grid-template-columns:1fr 52px 52px 58px;padding:7px 0;border-bottom:1px solid var(--border);align-items:center">
      <div style="font-size:12px;font-weight:500">${mm.lbl}</div>
      <div style="text-align:center;font-size:12px;color:var(--muted2);font-family:var(--mono)">${w2?fmtSets(w2):'–'}</div>
      <div style="text-align:center;font-size:12px;color:var(--muted);font-family:var(--mono)">${w1?fmtSets(w1):'–'}</div>
      <div style="text-align:center;display:flex;align-items:center;justify-content:center;gap:3px">
        <span style="font-size:13px;font-weight:700;color:${col};font-family:var(--mono)">${w0?fmtSets(w0):'–'}</span>
        ${w0>0?`<span style="font-size:12px;color:${tc}">${trend}</span>`:''}
      </div>
    </div>`;
  });
  html+=`</div><div style="padding:9px 16px;font-size:12px;color:var(--muted2)">MAV exceeded 2+ weeks = accumulated fatigue. Consider a deload.</div>`;
  return html;
}
// One bodyweight entry per day (a second weigh-in replaces the first), kept newest-first.
function logBodyweight(v,ds){
  v=parseFloat(v);if(!(v>0))return false;
  ds=ds||today();
  const i=S.bodyweightLog.findIndex(b=>b.date===ds);
  if(i>=0)S.bodyweightLog[i].weight=v;else S.bodyweightLog.push({date:ds,weight:v});
  S.bodyweightLog.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  S.bodyweight=S.bodyweightLog[0].weight;
  return true;
}
function renderMeasurementsBody(){
  const meas=S.measurements||[];const mUnit=S.measureUnit||'in';
  const tracked=MEAS_FIELDS.filter(f=>meas.some(m=>m.values&&m.values[f.id]!=null));
  let html=`<div style="padding:10px 16px">
    <div style="display:flex;gap:6px;align-items:center">
      <button class="btn btp bsm" style="flex:1" onclick="showLogMeasurements()">+ Log Measurements</button>
      <button class="btn bxs ${mUnit==='in'?'btp':'bts'}" onclick="setMeasUnit('in')">in</button>
      <button class="btn bxs ${mUnit==='cm'?'btp':'bts'}" onclick="setMeasUnit('cm')">cm</button>
    </div>
  </div>`;
  if(!tracked.length)return html+`<div class="empty" style="padding:16px 24px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('ruler',30)}</div><div class="etit" style="font-size:14px">No measurements yet</div><p style="font-size:12px">Log your first set to start tracking progress over time.</p></div>`;
  const sel=(S.measPart&&tracked.find(f=>f.id===S.measPart))?S.measPart:tracked[0].id;
  const series=meas.filter(m=>m.values&&m.values[sel]!=null).map(m=>({date:m.date,val:m.values[sel]})).sort((a,b)=>a.date.localeCompare(b.date));
  const latest=series[series.length-1],first=series[0];
  const totalChg=series.length>=2?(latest.val-first.val):null;
  html+=`<div style="padding:10px 16px;border-top:1px solid var(--border)">
    <select aria-label="Measurement" onchange="S.measPart=this.value;save();progRefresh()">${tracked.map(f=>`<option value="${f.id}"${f.id===sel?' selected':''}>${f.label}</option>`).join('')}</select>
  </div>
  <div class="sgrid">
    <div class="sc"><div class="sv">${latest.val}<span style="font-size:12px;color:var(--muted2)"> ${mUnit}</span></div><div class="slb">Latest · ${fmtDay(latest.date)}</div></div>
    <div class="sc"><div class="sv"${totalChg!=null?` style="color:${totalChg<0?'var(--green)':totalChg>0?'var(--blue)':'var(--text)'}"`:''}>${totalChg==null?'—':(totalChg<0?'−':'+')+Math.abs(totalChg).toFixed(1)}</div><div class="slb">Since ${fmtDay(first.date)}</div></div>
  </div>`;
  const histDesc=series.slice().reverse();
  html+=`<div style="border-top:1px solid var(--border)">${histDesc.map((pt,i)=>{const earlier=histDesc[i+1];const chg=earlier?(pt.val-earlier.val):null;return`<div class="mvrow"><div class="mvname" style="color:var(--muted)">${fmtDay(pt.date)}</div><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:600;font-family:var(--mono)">${pt.val}<span style="font-size:12px;color:var(--muted2)"> ${mUnit}</span></span>${chg!=null&&chg!==0?`<span class="meas-chg" style="color:var(--muted)">${chg<0?'▾':'▴'} ${Math.abs(chg).toFixed(1)}</span>`:''}</div></div>`;}).join('')}</div>`;
  return html;
}
function setMeasUnit(u){S.measureUnit=u;save();progRefresh();}
function showLogMeasurements(){
  const meas=S.measurements||[];const cur=meas[0];const mUnit=S.measureUnit||'in';
  const ov=makeOv('meas-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div><div class="mt">Log Measurements (${mUnit})</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">Fill in any fields — blanks are skipped. Placeholders show your most recent value.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:14px">${MEAS_FIELDS.map(f=>`<div><label class="fl">${f.label}</label><input type="number" inputmode="decimal" id="m-${f.id}" placeholder="${cur&&cur.values&&cur.values[f.id]!=null?cur.values[f.id]:'–'}"></div>`).join('')}</div>
    <button class="btn btp bfw" onclick="saveMeasurements()">Save</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('meas-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function saveMeasurements(){
  const vals={};MEAS_FIELDS.forEach(f=>{const el=document.getElementById(`m-${f.id}`);if(el&&el.value!=='')vals[f.id]=parseFloat(el.value);});
  if(!Object.keys(vals).length){toast('Enter at least one measurement');return;}
  S.measurements=[{date:today(),values:vals},...(S.measurements||[])];save();
  closeOv('meas-ov');
  progRefresh();toast('Measurements saved','green');
}
function renderStandardsBody(){
  const levels=getStdLevels();
  return`<div>${levels.map(l=>{const lbl=l.level>0?STD_LABELS[l.level-1]:(l.current?'Untrained':'No Data');const col=l.level>0?STD_COLORS[l.level-1]:'var(--muted2)';return`<div style="padding:10px 16px;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px"><div style="font-size:13px;font-weight:600">${l.name}</div><div style="font-size:12px;font-weight:700;color:${col}">${lbl}</div></div><div style="display:flex;gap:2px;margin-bottom:4px">${STD_LABELS.map((_,i)=>`<div style="flex:1;height:5px;border-radius:2px;background:${i<l.level?STD_COLORS[i]:'var(--border)'}"></div>`).join('')}</div>${l.current?`<div style="font-size:12px;color:var(--muted)">est. 1RM ${l.current}${S.unit} · Next: ${l.targets[l.level]?Math.ceil(l.targets[l.level])+S.unit:'top tier reached'}</div>`:''}</div>`;}).join('')}</div>
  <div style="padding:8px 16px;font-size:12px;color:var(--muted2);line-height:1.45">Graded on estimated 1RM against multiples of your bodyweight (${esc(S.bodyweight)} ${S.unit}).</div>`;
}
function renderWilksBody(){
  const w=getWilksData();
  if(!w)return`<div class="empty" style="padding:24px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('bolt',30)}</div><div class="etit" style="font-size:14px">Need a squat, bench &amp; deadlift on record</div><p style="font-size:12px">Barbell back squat (or front squat), barbell bench press, and deadlift (or sumo).</p></div>`;
  return`<div class="sgrid"><div class="sc"><div class="sv">${w.wilks}</div><div class="slb">Wilks Score</div></div><div class="sc"><div class="sv">${w.dots}</div><div class="slb">DOTS Score</div></div><div class="sc"><div class="sv">${Math.round(w.total)}</div><div class="slb">Est. total ${S.unit}</div></div><div class="sc"><div class="sv">${esc(S.bodyweight)}</div><div class="slb">Bodyweight</div></div></div>
  <div style="padding:11px 16px;font-size:12px;color:var(--muted);line-height:1.5">Estimated 1RMs — ${w.sqSub?'Front squat':'Squat'} ${w.sq}${S.unit} · Bench ${w.bench}${S.unit} · ${w.dlSub?'Sumo deadlift':'Deadlift'} ${w.dl}${S.unit}.${w.sqSub?' A front squat is standing in for the back squat, so this total runs low.':''} These are estimates from rep PRs, not competition lifts.</div>`;
}
// Time events are entered as minutes + seconds and stored as seconds.
function aftTimeInputs(kind,ev,val){
  const v=parseFloat(val);const has=!isNaN(v)&&val!=='';
  const m=has?Math.floor(v/60):'';const s=has?Math.round(v%60):'';
  return`<div class="aft-time"><input type="number" inputmode="numeric" id="aft-${kind}-${ev}-m" value="${m}" placeholder="min" onchange="setAftTime('${kind}','${ev}')"><span>:</span><input type="number" inputmode="numeric" id="aft-${kind}-${ev}-s" value="${has?pad2(s):''}" placeholder="sec" onchange="setAftTime('${kind}','${ev}')"></div>`;
}
function aftEventMeta(e,col){
  const lo=aftNeed(e.id,60,col),hi=aftNeed(e.id,100,col);
  return`${e.desc} · 60 pts: ${aftFmtRaw(e.id,lo)} · 100 pts: ${aftFmtRaw(e.id,hi)}`;
}
function aftVerdictHTML(a){
  if(!a.n)return'Enter your results below';
  if(!a.complete)return`${a.n}/5 events entered`;
  if(a.pass)return`<strong>PASS</strong> · needs ${a.need} total and 60 in every event`;
  const why=a.minEv<60?'an event is under 60':`total is under ${a.need}`;
  return`<strong>BELOW STANDARD</strong> · ${why}`;
}
function renderAFTBody(){
  const gn=S.aftGender||'male';const combat=aftIsCombat();const col=aftColumn();
  const a=aftSummary(S.aftCurrent,col);
  const tog=(on,label,js)=>`<button class="btn ${on?'btp':'bts'} bsm" onclick="${js}">${label}</button>`;
  let html=testDateRowHTML()+`<div class="aft-total"><div style="font-size:12px;font-weight:600;opacity:.6;margin-bottom:6px">Total Score</div>
    <div style="font-size:40px;font-weight:500;font-family:var(--mono);line-height:1"><span id="aft-total">${a.n?a.total:'–'}</span><span style="font-size:15px;opacity:.55"> / 500</span></div>
    <div id="aft-verdict" style="font-size:12px;opacity:.85;margin-top:6px">${aftVerdictHTML(a)}</div>
    <div style="font-size:12px;opacity:.6;margin-top:4px">${combat?'Combat standard (sex-neutral)':(gn==='male'?'Male':'Female')} · age group ${aftAgeBracket()} (age ${userAge()})</div>
  </div>
  <div style="padding:8px 16px 4px;display:grid;grid-template-columns:1fr 1fr;gap:7px">
    ${tog(!combat,'General · 300',"setAftStandard('general')")}${tog(combat,'Combat · 350',"setAftStandard('combat')")}
    ${combat?'':tog(gn==='male','Male',"setAftGender('male')")+tog(gn==='female','Female',"setAftGender('female')")}
  </div>
  <div style="padding:2px 16px 8px;font-size:12px;color:var(--muted);line-height:1.45">${combat?'The combat standard applies to the designated combat MOSs. It is scored on one table for everyone and needs 350 total with 60 in each event.':'The general standard is scored by age and sex and needs 300 total with 60 in each event.'} Age group comes from your birthday in Settings.</div>`;
  AFT_EVENTS.forEach(e=>{
    const sc=a.scores[e.id];const gsc=aftScore(e.id,S.aftGoals[e.id],col);
    const time=e.unit==='time';
    html+=`<div class="aft-row"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px"><div style="font-size:13px;font-weight:600">${e.name}</div><div class="mono" style="font-size:13px;font-weight:600;color:var(--navy)"><span id="aft-pts-${e.id}">${sc==null?'–':sc}</span> pts</div></div>
      <div class="aft-bar-track"><div class="aft-bar-fill" id="aft-bar-${e.id}" style="width:${sc||0}%;background:${sc==null?'transparent':sc>=60?'var(--green)':'var(--red)'}"></div><div class="aft-bar-min"></div>${gsc?`<div class="aft-bar-goal" style="left:${gsc}%"></div>`:''}</div>
      <div style="display:flex;gap:10px;margin-top:7px">
        <div style="flex:1"><div class="rtn-lbl" style="margin-bottom:3px">Current${time?'':` (${e.unit})`}</div>${time?aftTimeInputs('cur',e.id,S.aftCurrent[e.id]):`<input type="number" inputmode="decimal" value="${esc(S.aftCurrent[e.id]||'')}" placeholder="–" class="aft-inp" onchange="setAftVal('cur','${e.id}',this.value)">`}</div>
        <div style="flex:1"><div class="rtn-lbl" style="margin-bottom:3px">Goal${time?'':` (${e.unit})`}</div>${time?aftTimeInputs('goal',e.id,S.aftGoals[e.id]):`<input type="number" inputmode="decimal" value="${esc(S.aftGoals[e.id]||'')}" placeholder="–" class="aft-inp" onchange="setAftVal('goal','${e.id}',this.value)">`}</div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:5px">${aftEventMeta(e,col)}</div>
      ${e.id==='2MR'&&runTwoMileText()?`<div class="aft-form" id="aft-2mr-form">${esc(runTwoMileText())}</div>`:''}
    </div>`;
  });
  html+=`<div style="padding:10px 16px;display:flex;gap:8px"><button class="btn btp bsm" onclick="saveAFTHistory()">Save Snapshot</button>${S.aftHistory.length?`<button class="btn bts bsm" onclick="showAFTHistory()">History</button>`:''}</div>
  <div style="padding:0 16px 10px;font-size:12px;color:var(--muted2);line-height:1.45">Scored from the Army's AFT score tables (effective 1 June 2025). A result between two rows earns the lower row.</div>`;
  return html;
}
function setAftStandard(v){S.aftStandard=v;save();progRefresh();}
function setAftGender(v){S.aftGender=v==='female'?'female':'male';S.profileSet.sex=true;save();progRefresh();}
// The sheet is updated in place (see refreshAft); the board behind it is redrawn so its tile is right when the sheet closes.
function setAftVal(kind,ev,v){(kind==='goal'?S.aftGoals:S.aftCurrent)[ev]=v;save();refreshAft();boardRefresh();}
function setAftTime(kind,ev){
  const m=document.getElementById(`aft-${kind}-${ev}-m`)?.value,s=document.getElementById(`aft-${kind}-${ev}-s`)?.value;
  const blank=(m===''||m==null)&&(s===''||s==null);
  setAftVal(kind,ev,blank?'':String((parseInt(m)||0)*60+(parseInt(s)||0)));
}
// Update the scores in place so typing in the next field isn't interrupted by a redraw.
function refreshAft(){
  const a=aftSummary(S.aftCurrent);
  AFT_EVENTS.forEach(e=>{
    const sc=a.scores[e.id];
    const p=document.getElementById('aft-pts-'+e.id);if(p)p.textContent=sc==null?'–':sc;
    const b=document.getElementById('aft-bar-'+e.id);if(b){b.style.width=(sc||0)+'%';b.style.background=sc==null?'transparent':sc>=60?'var(--green)':'var(--red)';}
  });
  const t=document.getElementById('aft-total');if(t)t.textContent=a.n?a.total:'–';
  const v=document.getElementById('aft-verdict');if(v)v.innerHTML=aftVerdictHTML(a);
}
function saveAFTHistory(){
  const col=aftColumn();const a=aftSummary(S.aftCurrent,col);
  if(!a.n){toast('Enter at least one result');return;}
  S.aftHistory=[{date:today(),scores:Object.assign({},S.aftCurrent),pts:a.scores,total:a.total,complete:a.complete,pass:a.pass,std:aftIsCombat()?'combat':'general',col},...(S.aftHistory||[])];
  save();toast('Snapshot saved!','green');progRefresh();
}
function showAFTHistory(){
  const ov=makeOv('afth-ov');
  ov.innerHTML=`<div class="modal" style="max-height:75vh"><div class="mh"></div><div class="mt">AFT History</div>${S.aftHistory.map(h=>{
    // Snapshots saved before the official tables were added are re-scored from their raw results.
    const a=h.pts?{total:h.total,complete:h.complete,pass:h.pass,scores:h.pts}:aftSummary(h.scores||{});
    return`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="display:flex;justify-content:space-between"><div style="font-size:13px;font-weight:600">${fmtDay(h.date)}${h.std==='combat'?' · combat':''}</div><div class="mono" style="font-size:13px;font-weight:600;color:${a.complete?(a.pass?'var(--green)':'var(--red)'):'var(--navy)'}">${a.total}${a.complete?' / 500':' pts'}</div></div><div style="font-size:12px;color:var(--muted);margin-top:3px">${AFT_EVENTS.map(e=>`${e.id} ${aftFmtRaw(e.id,(h.scores||{})[e.id])}${a.scores&&a.scores[e.id]!=null?` (${a.scores[e.id]})`:''}`).join(' · ')}</div></div>`;}).join('')}<button class="btn btg bfw" style="margin-top:12px" onclick="closeOv('afth-ov')">Close</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function showRetroSteps(){const ov=makeOv('steps-ov');const cur=S.stepsLog[today()]||0;ov.innerHTML=`<div class="modal" style="max-height:250px"><div class="mh"></div><div class="mt">Log Steps</div><div class="fg"><label class="fl">Steps Today</label><input type="number" inputmode="numeric" id="step-inp" value="${cur||''}" placeholder="e.g. 8000"></div><button class="btn btp bfw" onclick="saveSteps()">Save</button><button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('steps-ov')">Cancel</button></div>`;document.body.appendChild(ov);attachSwipeDown(ov);}
function saveSteps(){const v=parseInt(document.getElementById('step-inp')?.value);if(!isNaN(v)){S.stepsLog[today()]=v;save();closeOv('steps-ov');rerender();}}

