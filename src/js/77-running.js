// ═══════════════════════════════════════════════════
// RUNNING — the switch, weekly miles, best efforts, the race predictor, the Running page
// ═══════════════════════════════════════════════════
// Everything here is arithmetic on the activity log. Nothing calls an AI, and nothing reads a
// route's coordinates: best efforts come from the summary each routed activity carries in S.

// ─── The switch (Settings → Tracking → Running) ───
// Until it is touched, the running features turn themselves on once three runs or rucks with a
// real distance are in the log, so someone who only lifts never sees empty running tiles.
// After the first touch it stays where it was put.
const RUN_AUTO_MIN=3;
function runAutoCount(){return(S.activities||[]).filter(a=>(a.type==='run'||a.type==='ruck')&&parseFloat(a.dist)>0&&!a.distEst).length;}
function runningOn(){return S.running===true||(S.running==null&&runAutoCount()>=RUN_AUTO_MIN);}
function toggleRunning(){
  S.running=!runningOn();save();refreshSettings();
  if(S.tab==='progress')boardRefresh();
}

// ─── Runs ───
// Every run with a real distance, oldest first. sec is 0 when the time was only estimated.
function runList(){
  const td=today();
  return(S.activities||[]).filter(a=>a.type==='run'&&parseFloat(a.dist)>0&&!a.distEst&&a.date<=td)
    .map(a=>({a,mi:parseFloat(a.dist),sec:a.durEst?0:actSec(a),ds:a.date,t:dayNum(a.date)})).sort((x,y)=>x.t-y.t);
}
// One entry per calendar week (Monday to Sunday) from the first run to this week.
function runWeeksAll(){
  const runs=runList();if(!runs.length)return[];
  const by={};
  runs.forEach(r=>{const m=mondayOf(r.ds);const w=by[m]||(by[m]={mi:0,n:0,long:0});w.mi+=r.mi;w.n++;if(r.mi>w.long)w.long=r.mi;});
  const cur=mondayOf(today());const out=[];
  for(let mon=mondayOf(runs[0].ds);mon<=cur;mon=addDays(mon,7))out.push(Object.assign({mon,mi:0,n:0,long:0,current:mon===cur},by[mon]||{}));
  return out;
}
// Did week i jump? It is compared with the four weeks before it. To be worth a warning it has to
// be at least 15% and two miles over their average, AND clearly more than the biggest of them
// (5% over): a normal week after an easy one is back to usual, not a jump. The average has to be
// five miles or more from at least two weeks with a run; on a small base every week is a big percentage.
const RUN_JUMP={pct:0.15,miles:2,base:5,peak:0.05};
function runJumpAt(weeks,i){
  if(i<4)return null;
  const prev=weeks.slice(i-4,i);const base=prev.reduce((t,w)=>t+w.mi,0)/4;
  if(base<RUN_JUMP.base||prev.filter(w=>w.mi>0).length<2)return null;
  const mi=weeks[i].mi;
  if(mi<=base*(1+RUN_JUMP.pct)||mi-base<RUN_JUMP.miles)return null;
  if(mi<=Math.max(...prev.map(w=>w.mi))*(1+RUN_JUMP.peak))return null;
  return{pct:Math.round((mi/base-1)*100),mi,base};
}
// The jump worth saying something about now: this week if it is already over, else the week just finished.
function runJumpNow(weeks){
  weeks=weeks||runWeeksAll();const n=weeks.length;if(!n)return null;
  const cur=runJumpAt(weeks,n-1);if(cur)return Object.assign({when:'this'},cur);
  const last=n>1?runJumpAt(weeks,n-2):null;return last?Object.assign({when:'last'},last):null;
}
function runJumpText(j){
  return j.when==='this'?`This week is already ${j.pct}% over your last four weeks (${fmt1(j.mi)} mi against an average of ${fmt1(j.base)}).`
    :`Last week was ${j.pct}% over the four weeks before it (${fmt1(j.mi)} mi against an average of ${fmt1(j.base)}).`;
}

// ─── Best efforts ───
// What one run is worth at each standard distance: {m1, m2, k5, k10, hm} in seconds. A run with a
// route was searched for its fastest stretch of each length when it was imported. A run without
// one counts only as a whole, and only for the distance it actually was (within 5% over).
function runEfforts(r){
  if(!(r.sec>0))return{};
  if(r.a.rt&&r.a.rt.be)return r.a.rt.be;
  const m=r.mi*MILE_M;const out={};
  RUN_DISTS.forEach(d=>{if(m>=d.m*RUN_DIST_SLACK&&m<=d.m*1.05)out[d.id]=Math.round(r.sec*Math.min(1,d.m/m)*10)/10;});
  return out;
}
// {m1:{sec,a,ds,whole}, …} — the fastest at each distance since fromDs (or ever).
function runBests(fromDs){
  const best={};
  runList().forEach(r=>{
    if(fromDs&&r.ds<fromDs)return;
    const e=runEfforts(r);
    Object.keys(e).forEach(id=>{if(!best[id]||e[id]<best[id].sec)best[id]={sec:e[id],a:r.a,ds:r.ds,whole:!(r.a.rt&&r.a.rt.be)};});
  });
  return best;
}
function runDistName(m){
  const d=RUN_DISTS.find(x=>Math.abs(x.m-m)<=x.m*0.006);
  return d?d.short.toLowerCase()==='mile'?'mile':d.short:`${fmt1(m/MILE_M)} mi`;
}

// ─── Race predictor ───
// The time a distance should take on current form: every recent effort is carried to the target
// distance with Riegel's formula and the fastest answer is kept. "Recent" is the last 12 weeks;
// if there is nothing that fresh, the last 26, and the answer says so. Efforts under a fifth of
// the target distance are not used (a fast mile says little about a half marathon).
// The answer is only as good as the hardest recent run: weeks of easy miles predict a slow race.
function runPredict(targetM){
  const fresh=daysAgoStr(84),oldest=daysAgoStr(182);const cands=[];
  runList().forEach(r=>{
    if(!(r.sec>0)||r.ds<oldest)return;
    const list=[[r.mi*MILE_M,r.sec]];
    const be=r.a.rt&&r.a.rt.be;if(be)RUN_DISTS.forEach(d=>{if(be[d.id])list.push([d.m,be[d.id]]);});
    list.forEach(([m,sec])=>{
      if(m<RUN_ALL_MIN*MILE_M||m<targetM/5)return;
      cands.push({sec:riegel(sec,m,targetM),m,src:sec,a:r.a,ds:r.ds,old:r.ds<fresh});
    });
  });
  const now=cands.filter(c=>!c.old);const pool=now.length?now:cands;if(!pool.length)return null;
  const b=pool.reduce((x,y)=>y.sec<x.sec?y:x);
  return{sec:b.sec,m:b.m,src:b.src,a:b.a,ds:b.ds,old:b.old,far:b.m<targetM/2.5};
}
function runPredictFrom(p){return`from your ${runDistName(p.m)} in ${fmtClock(p.src)} on ${fmtDay(p.ds)}`;}
// The two-mile run of the fitness test, on current form: {sec, pts, …} or null.
function runTwoMile(){
  if(!runningOn())return null;
  const p=runPredict(2*MILE_M);if(!p)return null;
  return Object.assign(p,{pts:aftScore('2MR',Math.round(p.sec))});
}
function runTwoMileText(){
  const p=runTwoMile();if(!p)return'';
  return`On current form ${fmtClock(p.sec)}${p.pts!=null?` (${p.pts} pts)`:''}, ${runPredictFrom(p)}${p.old?'; no run in the last 12 weeks':''}.`;
}

// ─── Tiles ───
function runMilesTile(range){
  const weeks=runWeeksAll();
  if(!weeks.length)return{title:'Weekly miles',empty:'Log a run with its distance to see your week.'};
  const cur=weeks[weeks.length-1];const jump=runJumpNow(weeks);
  const prev=weeks.slice(-5,-1);const avg=prev.length?prev.reduce((t,w)=>t+w.mi,0)/prev.length:0;
  const from=mondayOf(range.from);const shown=weeks.filter(w=>w.mon>=from);
  return{title:'Miles · this week',value:fmt1(cur.mi),unit:' mi',
    sub:jump?(jump.when==='this'?`${jump.pct}% over your recent weeks`:`Last week was ${jump.pct}% up`):prev.length?`${fmt1(avg)} a week lately`:`${cur.n} run${cur.n===1?'':'s'}`,
    tone:jump?'warn':'flat',spark:svgBars(shown.map((w,i)=>({v:w.mi,hollow:w.current})))};
}
function runBestTile(){
  const best=runBests();const have=RUN_DISTS.filter(d=>best[d.id]);
  if(!have.length)return{title:'Best efforts',empty:'Run a mile or more with its time and your bests show here.'};
  return{title:'Best efforts',note:'runs',
    rows:have.slice(0,4).map(d=>{const b=best[d.id];return{label:d.label,sub:`${fmtDay(b.ds)} · ${fmtPace(b.sec/(d.m/MILE_M))} a mile`,js:`showActivityDetail(${JSON.stringify(b.a.id)})`,value:fmtClock(b.sec)};}),
    foot:{label:'Running',js:'showRunning()'}};
}
function runPredTile(){
  const two=S.testPlan?runTwoMile():null;
  if(two)return{title:'Two-mile · on form',value:fmtClock(two.sec),unit:two.pts!=null?` · ${two.pts} pts`:'',sub:`From your ${runDistName(two.m)}, ${fmtDay(two.ds)}`,tone:'flat',spark:''};
  const p=runPredict(5000);
  if(!p)return{title:'Race predictor',empty:'Needs a timed run of a mile or more in the last six months.'};
  return{title:'5K · on form',value:fmtClock(p.sec),unit:'',sub:`From your ${runDistName(p.m)}, ${fmtDay(p.ds)}`,tone:'flat',spark:''};
}

// ─── The Running page ───
// A sheet over Progress. Later sections (routes, load, shoes, segments) are added to RUN_SECTIONS.
const RUN_SECTIONS=[];
function showRunning(){
  if(!runningOn()){toast('Running is switched off in Settings');return;}
  const ov=makeOv('run-ov');
  ov.innerHTML=`<div class="modal metric-sheet" style="max-height:94vh"><div class="mh"></div><div id="run-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderRunning();
}
function runPredRows(){
  const rows=[];
  const add=(label,m,extra)=>{const p=runPredict(m);if(!p)return;
    rows.push({t:label,s:`${fmtPace(p.sec/(m/MILE_M))} a mile · ${runPredictFrom(p)}${p.far?' · a long way from that distance':''}${p.old?' · more than 12 weeks ago':''}${extra?extra(p):''}`,v:fmtClock(p.sec),js:`showActivityDetail(${JSON.stringify(p.a.id)})`});};
  add('Two miles',2*MILE_M,p=>{const pts=aftScore('2MR',Math.round(p.sec));return pts!=null?` · ${pts} points on the fitness test`:'';});
  add('5K',5000);add('10K',10000);add('Half marathon',21097.5);
  return rows;
}
function renderRunning(){
  const el=document.getElementById('run-body');if(!el)return;
  const modal=el.parentNode;const y=modal?modal.scrollTop:0;
  const range=boardRange();const weeks=runWeeksAll();const runs=runList();
  if(!runs.length){
    el.innerHTML=`<div class="mt">Running</div><div class="ch-empty">No runs with a distance yet. Log one, or import your runs from Strava in Settings.</div>
      <div class="sheet-acts"><button class="btn btg" onclick="closeOv('run-ov')">Close</button><button class="btn btp" onclick="closeOv('run-ov');showLogActivity()">Log a run</button></div>`;
    return;
  }
  const cur=weeks[weeks.length-1];const jump=runJumpNow(weeks);
  const from=mondayOf(range.from);const shown=weeks.filter(w=>w.mon>=from);
  const inR=runs.filter(r=>r.ds>=range.from);const mi=inR.reduce((t,r)=>t+r.mi,0);
  const timed=inR.filter(r=>r.sec>0);const sec=timed.reduce((t,r)=>t+r.sec,0),tmi=timed.reduce((t,r)=>t+r.mi,0);
  const prev=weeks.slice(-5,-1);const avg=prev.length?prev.reduce((t,w)=>t+w.mi,0)/prev.length:null;
  const best=runBests(),bestR=runBests(range.from);
  const bestRows=RUN_DISTS.filter(d=>best[d.id]).map(d=>{const b=best[d.id],r=bestR[d.id];
    const inside=!b.whole&&parseFloat(b.a.dist)*MILE_M>d.m*1.05;
    return{t:d.label,s:`${fmtDay(b.ds)} · ${fmtPace(b.sec/(d.m/MILE_M))} a mile${inside?' · inside a longer run':''}${r&&r.sec>b.sec+0.5?` · ${fmtClock(r.sec)} in the last ${range.short}`:''}`,v:fmtClock(b.sec),js:`showActivityDetail(${JSON.stringify(b.a.id)})`};});
  const ruckMi=(S.activities||[]).filter(a=>a.type==='ruck'&&a.date>=range.from&&parseFloat(a.dist)>0).reduce((t,a)=>t+parseFloat(a.dist),0);
  const pred=runPredRows();
  const st=s=>`<div class="st"><div class="st-v">${esc(String(s.v))}</div><div class="st-l">${esc(s.l)}</div></div>`;
  const stats=[{v:fmt1(mi),l:`Miles in ${range.short}`},{v:inR.length,l:`Run${inR.length===1?'':'s'} in ${range.short}`},
    {v:inR.length?fmt1(Math.max(...inR.map(r=>r.mi))):'–',l:'Longest, miles'},{v:tmi>0?fmtPace(sec/tmi):'–',l:'Average pace'}];
  let extra='';
  RUN_SECTIONS.forEach(f=>{try{extra+=f(range)||'';}catch(e){logError(e,'running section');}});
  el.innerHTML=`<div class="mt" style="margin-bottom:2px">Running</div>
    <div class="sheet-sub" style="margin-bottom:10px">Runs only, Monday to Sunday${ruckMi>0?`. Rucks are counted apart: ${fmt1(ruckMi)} mi in the last ${range.short}`:''}.</div>
    <div class="m-head"><div class="m-big">${esc(fmt1(cur.mi))}<span> mi this week</span></div>${avg!=null?`<div class="m-delta dl-${jump&&jump.when==='this'?'warn':'flat'}">${esc(fmt1(avg))} a week over the last four</div>`:''}</div>
    <div class="seg seg-in" role="tablist">${RANGES.map(r=>`<button class="seg-b${r.id===range.id?' on':''}" onclick="setBoardRange('${r.id}')">${r.short}</button>`).join('')}</div>
    ${chartBars(shown.map((w,i)=>{const j=runJumpAt(weeks,weeks.indexOf(w));return{t:dayNum(w.mon),v:w.mi,hollow:w.current,tone:j&&!w.current?'warn':'',read:`Week of ${fmtDay(w.mon)} · ${fmt1(w.mi)} mi in ${w.n} run${w.n===1?'':'s'}${w.current?' so far':''}${j?` · ${j.pct}% over the four weeks before`:''}`};}),{label:'Miles a week',fmt:v=>fmt1(v),empty:`No runs in the last ${range.label}.`})}
    ${jump?`<div class="note-box" id="run-jump"><b>A big step up.</b> ${esc(runJumpText(jump))} A sudden rise in distance is a common way to pick up a running injury, though no exact percentage is well proven. If this was not planned, hold here for a week before adding more.</div>`:''}
    <div class="st-grid st-22" style="margin-top:10px">${stats.map(st).join('')}</div>
    ${bestRows.length?mRowsHTML(bestRows,'Best efforts'):`<div class="sec-h">Best efforts</div><div class="ch-empty">A timed run of a mile or more puts your bests here.</div>`}
    ${pred.length?mRowsHTML(pred,'On current form'):''}
    ${extra}
    <div class="fine">Weekly miles count runs, not rucks or walks. A week is flagged (amber) when it is at least 15% and two miles over the average of the four weeks before it and also more than the biggest of them, once that average is five miles or more. Best efforts are the fastest stretch of each length inside any run that has a route; a run without a route counts only over its whole distance. “On current form” carries your recent efforts to each distance with Riegel’s formula (time × (distance ratio)^1.06) and keeps the fastest; it is only as good as your hardest run of the last 12 weeks, so a spell of easy miles will read slow.</div>
    <div class="sheet-acts"><button class="btn btg" onclick="closeOv('run-ov')">Close</button><button class="btn bts" onclick="showLogActivity()">Log a run</button></div>`;
  if(modal)modal.scrollTop=y;
}
