// ═══════════════════════════════════════════════════
// RUNNING, CONTINUED — training load, the long run, consistency and a yearly goal, shoe miles
// ═══════════════════════════════════════════════════
// More arithmetic on the log; no AI, no network. Each piece is a section of the Running page.

// ─── Training load ───
// A session's load is its minutes times how hard it was, on a scale of 1 (very easy) to 5 (all
// out), the way coaches score a session. How hard comes from the best evidence there is:
//   1. heart rate, when the recording had it: the average as a share of your top heart rate;
//   2. for a run without heart rate, its pace against your own usual pace (each as a 5K pace, so
//      distance does not come into it): 5% quicker than usual is one step harder;
//   3. otherwise a typical value for the kind of activity.
// Lifting is not in it. The rating asked after a workout ("How did it go?", Rough to Great) says
// how the session felt, not how hard it was: a rough day is rarely an easy one. Using it as
// effort would count bad days as light ones.
const LOAD_KIND={run:3,ruck:3,hike:2.5,walk:1.5,bike:2.5,swim:3,other:2.5,sprint:4.5};
const LOAD_SRC={hr:'heart rate',pace:'pace against your usual',kind:'a typical effort for that kind of activity'};
function loadContext(){
  const from=daysAgoStr(90);
  const runs=paceActs().filter(x=>x.type==='run'&&x.dist>=RUN_ALL_MIN);
  const med=list=>{const v=list.map(paceAs5k).sort((a,b)=>a-b);return v.length?v[v.length>>1]:0;};
  const recent=runs.filter(x=>x.ds>=from);
  return{maxHr:runMaxHr().max,norm:recent.length>=3?med(recent):runs.length>=3?med(runs):0};
}
// → {load, e, min, src} for one activity, or null when it has no real duration.
function actLoad(a,ctx){
  if(a.durEst)return null;
  const min=actSec(a)/60;if(!(min>0))return null;
  const clamp=v=>Math.max(1,Math.min(5,v));
  let e,src;
  if(a.rt&&a.rt.hr>0&&ctx.maxHr>0){e=clamp(1+(a.rt.hr/ctx.maxHr-0.55)/0.1);src='hr';}
  else if(a.type==='run'&&ctx.norm>0&&parseFloat(a.dist)>=RUN_ALL_MIN&&!a.distEst){
    const mi=parseFloat(a.dist);const p=paceAs5k({dist:mi,sec:actSec(a)/mi});
    e=clamp(3+(ctx.norm/p-1)/0.05);src='pace';
  }else{e=LOAD_KIND[a.type]||2.5;src='kind';}
  return{load:min*e,e,min,src};
}
// Load by day over the last n days (oldest first), and which evidence it rested on.
function loadDays(n){
  const ctx=loadContext();const by={};const src={hr:0,pace:0,kind:0};const from=daysAgoStr(n-1),td=today();
  (S.activities||[]).forEach(a=>{
    if(a.date<from||a.date>td)return;
    const l=actLoad(a,ctx);if(!l)return;
    by[a.date]=(by[a.date]||0)+l.load;src[l.src]++;
  });
  const days=[];for(let i=n-1;i>=0;i--){const ds=daysAgoStr(i);days.push({ds,v:by[ds]||0});}
  return{days,src};
}
// The last 7 days against the last 28: {acute, chronic (a week, over the 28), ratio, word, tone},
// with ratio null until there are three weeks of activities to compare with.
function loadNow(){
  const{days,src}=loadDays(28);
  const acute=days.slice(-7).reduce((t,d)=>t+d.v,0),total=days.reduce((t,d)=>t+d.v,0),chronic=total/4;
  const first=(S.activities||[]).reduce((m,a)=>a.date&&a.date<m?a.date:m,'9999');
  const enough=first<=daysAgoStr(21)&&chronic>0&&days.slice(0,21).some(d=>d.v>0);
  const ratio=enough?acute/chronic:null;
  const word=ratio==null?'':ratio<0.8?'Lighter than your usual':ratio<=1.3?'About your usual':ratio<=1.5?'Above your usual':'Well above your usual';
  return{days,src,acute,chronic,total,ratio,word,tone:ratio!=null&&ratio>1.5?'warn':'flat'};
}
function loadTile(){
  const l=loadNow();
  if(!l.total)return{title:'Training load',empty:'Runs, rucks and rides from the last four weeks show here as load.'};
  const bars=svgBars(l.days.map((d,i)=>({v:d.v||null,hollow:i<21})));
  if(l.ratio==null)return{title:'Training load · 7 days',value:String(Math.round(l.acute)),unit:'',sub:'Three weeks of activities to compare',tone:'flat',spark:bars};
  return{title:'Training load · 7 days',value:l.ratio.toFixed(1)+'×',unit:' your usual',sub:l.word,tone:l.tone,spark:bars};
}
function loadSectionHTML(){
  const l=loadNow();if(!l.total)return'';
  const used=Object.keys(l.src).filter(k=>l.src[k]).map(k=>`${LOAD_SRC[k]} (${l.src[k]})`).join(', ');
  const st=(v,t)=>`<div class="st"><div class="st-v">${esc(v)}</div><div class="st-l">${esc(t)}</div></div>`;
  return`<div class="sec-h">Training load</div>
    <div class="st-grid" id="run-load">${st(Math.round(l.acute).toLocaleString(),'Last 7 days')}${st(Math.round(l.chronic).toLocaleString(),'A week, over the last 28')}${st(l.ratio==null?'–':l.ratio.toFixed(1)+'×',l.ratio==null?'Needs 3 weeks':l.word)}</div>
    ${chartBars(l.days.map((d,i)=>({t:dayNum(d.ds),v:d.v,hollow:i<21,read:`${fmtDay(d.ds)} · ${d.v?Math.round(d.v)+' load':'nothing logged'}`})),{label:'Load a day, last 28 days',fmt:v=>String(Math.round(v)),read:'Solid bars are the last 7 days; outlined, the three weeks before'})}
    <div class="fine">Load is a session’s minutes times how hard it was (1 to 5). How hard: ${esc(used||'no activities')}. Runs, rucks, walks and rides count; lifting does not, because the “How did it go?” rating says how a workout felt, not how hard it was. This compares you with your own recent weeks. It is not an injury forecast: the “safe ratio” idea behind numbers like 1.3 is disputed.</div>`;
}

// ─── The long run ───
function longRunSectionHTML(range){
  const weeks=runWeeksAll();if(weeks.length<2)return'';
  const from=mondayOf(range.from);const shown=weeks.filter(w=>w.mon>=from);if(!shown.some(w=>w.long>0))return'';
  const done=shown.filter(w=>!w.current&&w.long>0);
  const f=done.length>=3?fitLine(done.map(w=>({t:dayNum(w.mon),v:w.long}))):null;
  const perWk=f&&f.span>=14?f.perDay*7:null;
  const best=Math.max(...shown.map(w=>w.long));const cur=weeks[weeks.length-1];
  const st=(v,t)=>`<div class="st"><div class="st-v">${esc(v)}</div><div class="st-l">${esc(t)}</div></div>`;
  return`<div class="sec-h">Long run</div>
    ${chartBars(shown.map(w=>({t:dayNum(w.mon),v:w.long,hollow:w.current,read:`Week of ${fmtDay(w.mon)} · longest run ${w.long?fmt1(w.long)+' mi':'none'}${w.current?' so far':''}`})),{label:'Longest run of each week',fmt:v=>fmt1(v)})}
    <div class="st-grid" id="run-long">${st(cur.long?fmt1(cur.long)+' mi':'–','Longest this week')}${st(fmt1(best)+' mi',`Longest in ${range.short}`)}${st(perWk==null?'–':Math.abs(perWk)<0.05?'Level':fmtSigned(perWk,1)+' mi',perWk==null||Math.abs(perWk)<0.05?'Trend':'A week, by trend')}</div>`;
}

// ─── Consistency and the year ───
// Weeks in a row with at least one run. This week does not break the streak until it is over.
function runWeekStreak(weeks){
  weeks=weeks||runWeeksAll();let i=weeks.length-1,n=0;
  if(i>=0&&weeks[i].current&&!weeks[i].n)i--;
  for(;i>=0&&weeks[i].n>0;i--)n++;
  return n;
}
function normalizeRunGoal(v){const m=isObj(v)?parseFloat(v.miles):NaN;return m>0&&m<=20000?{miles:Math.round(m)}:null;}
// Where the year stands: miles so far, the rate of the last eight finished weeks, where that rate
// ends the year, and what the goal needs from here.
function runYear(){
  const td=today();const y=td.slice(0,4);const runs=runList().filter(r=>r.ds.slice(0,4)===y);
  const ytd=runs.reduce((t,r)=>t+r.mi,0);
  const weeks=runWeeksAll().filter(w=>!w.current).slice(-8);
  const rate=weeks.length>=2?weeks.reduce((t,w)=>t+w.mi,0)/weeks.length:null;
  const left=daysBetween(td,y+'-12-31');const wkLeft=left/7;
  const goal=S.runGoal?S.runGoal.miles:null;
  return{year:y,ytd,rate,left,proj:rate==null?null:ytd+rate*wkLeft,goal,need:goal!=null&&wkLeft>0?Math.max(0,goal-ytd)/wkLeft:null,met:goal!=null&&ytd>=goal};
}
function setRunGoal(v){
  const g=normalizeRunGoal({miles:v});
  if(String(v).trim()!==''&&!g){toast('Enter the miles you want to run this year');return;}
  S.runGoal=g;save();renderRunning();if(S.tab==='progress')boardRefresh();
  toast(g?`Goal set: ${g.miles.toLocaleString()} miles this year`:'Goal removed','green');
}
function consistencySectionHTML(){
  const weeks=runWeeksAll();if(!weeks.length)return'';
  const past=weeks.filter(w=>!w.current).slice(-4);const perWk=past.length?past.reduce((t,w)=>t+w.n,0)/past.length:null;
  const streak=runWeekStreak(weeks);const y=runYear();
  const st=(v,t)=>`<div class="st"><div class="st-v">${esc(v)}</div><div class="st-l">${esc(t)}</div></div>`;
  let line='';
  if(y.goal!=null){
    const pct=Math.max(0,Math.min(1,y.ytd/y.goal));
    line=`<div class="yr" id="run-year"><div class="yr-top"><b>${esc(fmt1(y.ytd))}</b> of ${y.goal.toLocaleString()} mi in ${y.year}</div><div class="yr-bar"><i style="width:${Math.round(pct*100)}%"></i>${y.proj!=null&&!y.met?`<span style="left:${Math.round(Math.min(1,y.proj/y.goal)*100)}%" title="Where your recent rate ends the year"></span>`:''}</div>
      <div class="fine" style="margin:6px 0 0">${y.met?'Goal reached.':`${y.proj!=null?`At the rate of your last ${Math.min(8,weeks.filter(w=>!w.current).length)} weeks (${fmt1(y.rate)} mi a week) the year ends at about ${Math.round(y.proj).toLocaleString()} mi${y.proj>=y.goal?', past the goal':`, ${Math.round(y.goal-y.proj).toLocaleString()} short`}. `:''}The goal needs ${fmt1(y.need)} mi a week from here, with ${y.left} day${y.left===1?'':'s'} left.`}</div></div>`;
  }else line=`<div class="fine" id="run-year" style="margin:8px 2px 0">${esc(fmt1(y.ytd))} mi so far in ${y.year}${y.proj!=null?`; at your recent rate the year ends at about ${Math.round(y.proj).toLocaleString()}`:''}. Set a goal to see what it needs each week.</div>`;
  return`<div class="sec-h">Consistency</div>
    <div class="st-grid" id="run-cons">${st(perWk==null?'–':perWk>=10?String(Math.round(perWk)):perWk.toFixed(1),'Runs a week, last four')}${st(String(streak),`Week${streak===1?'':'s'} in a row with a run`)}${st(fmt1(y.ytd),`Miles in ${y.year}`)}</div>
    ${line}
    <div class="frow" style="gap:8px;margin-top:10px;align-items:flex-end"><div style="flex:1"><label class="fl" for="run-goal">Miles to run in ${y.year}</label><input type="number" inputmode="numeric" id="run-goal" min="1" max="20000" placeholder="e.g. 500" value="${y.goal!=null?y.goal:''}"></div>
      <button class="btn bts" id="run-goal-save" onclick="setRunGoal(document.getElementById('run-goal').value)">${y.goal!=null?'Change':'Set goal'}</button></div>`;
}

// ─── Shoes ───
// Miles for each pair, from the gear Strava names on an imported activity. Runs, walks, hikes
// and rucks count (a bike is not a shoe). Most running shoes are spent somewhere between 300
// and 500 miles, so a pair is flagged at 400 until it is retired.
const SHOE_NUDGE=400;
const SHOE_TYPES=['run','walk','hike','ruck'];
function normalizeShoes(v){
  const out={};if(!isObj(v))return out;
  Object.keys(v).slice(0,60).forEach(k=>{const name=String(k).trim().slice(0,80);if(name&&isObj(v[k])&&v[k].retired)out[name]={retired:true};});
  return out;
}
function shoeList(){
  const by={};
  (S.activities||[]).forEach(a=>{
    if(!a.gear||!SHOE_TYPES.includes(a.type)||a.distEst)return;const mi=parseFloat(a.dist)||0;if(!(mi>0))return;
    const s=by[a.gear]||(by[a.gear]={name:a.gear,mi:0,n:0,last:'',first:'9999'});
    s.mi+=mi;s.n++;if(a.date>s.last)s.last=a.date;if(a.date<s.first)s.first=a.date;
  });
  return Object.values(by).map(s=>Object.assign(s,{retired:!!(S.shoes[s.name]&&S.shoes[s.name].retired),worn:s.mi>=SHOE_NUDGE}))
    .sort((a,b)=>(a.retired-b.retired)||(a.last<b.last?1:a.last>b.last?-1:0));
}
function shoeRetire(name,on){
  name=String(name);
  if(on)S.shoes[name]={retired:true};else delete S.shoes[name];
  save();renderRunning();
  toast(on?`${name} retired`:`${name} back in use`,'green',on?{action:'Undo',onAction:()=>shoeRetire(name,false)}:undefined);
}
function shoeSectionHTML(){
  const list=shoeList();if(!list.length)return'';
  const row=s=>`<div class="row shoe${s.worn&&!s.retired?' shoe-worn':''}"><span class="row-main"><span class="row-t">${esc(s.name)}</span>
      <span class="row-s">${s.n} outing${s.n===1?'':'s'} · last on ${esc(fmtDay(s.last))}${s.worn&&!s.retired?` · past ${SHOE_NUDGE} miles`:''}</span>
      ${s.retired?'':`<span class="shoe-bar"><i style="width:${Math.round(Math.min(1,s.mi/SHOE_NUDGE)*100)}%"></i></span>`}</span>
    <span class="aim"><span class="aim-v">${Math.round(s.mi).toLocaleString()}</span><span class="aim-f">mi</span></span>
    <button class="btn ${s.retired?'btg':'bts'} bxs" onclick="shoeRetire(${jsq(s.name)},${s.retired?'false':'true'})">${s.retired?'Use again':'Retire'}</button></div>`;
  const act=list.filter(s=>!s.retired),ret=list.filter(s=>s.retired);const worn=act.filter(s=>s.worn);
  return`<div class="sec-h">Shoes</div>
    ${worn.length?`<div class="note-box" id="shoe-nudge" style="margin:0 0 8px"><b>${esc(worn.map(s=>s.name).join(' and '))}</b> ${worn.length===1?'has':'have'} passed ${SHOE_NUDGE} miles. Most running shoes lose their cushioning somewhere between 300 and 500; if your legs have started to complain, this is a likely reason.</div>`:''}
    ${act.length?`<div class="list" id="shoe-list">${act.map(row).join('')}</div>`:''}
    ${ret.length?`<details class="fold"><summary>Retired (${ret.length})</summary><div class="list">${ret.map(row).join('')}</div></details>`:''}
    <div class="fine">Miles come from the shoes named on each activity imported from Strava. Runs, walks, hikes and rucks count. An activity logged here by hand has no shoes on it.</div>`;
}

// Each section is a closed row on the Running page with its one headline number (see runFold).
function loadFoldSub(){const l=loadNow();return l.ratio==null?(l.total?`${Math.round(l.acute).toLocaleString()} this week`:''):`${l.ratio.toFixed(1)}× your usual`;}
function longRunFoldSub(){const w=runWeeksAll();const cur=w[w.length-1];return cur&&cur.long?`${fmt1(cur.long)} mi this week`:'none this week';}
function consistencyFoldSub(){
  const y=runYear();if(y.goal!=null)return`${Math.round(y.ytd).toLocaleString()} of ${y.goal.toLocaleString()} mi`;
  const n=runWeekStreak();return`${n} week${n===1?'':'s'} in a row`;
}
function shoeFoldSub(){
  const act=shoeList().filter(s=>!s.retired);const worn=act.filter(s=>s.worn).length;
  return worn?`${worn} past ${SHOE_NUDGE} mi`:`${act.length} pair${act.length===1?'':'s'}`;
}
RUN_SECTIONS.push(
  ()=>{const l=loadNow();return runFold('load','Training load',loadFoldSub(),loadSectionHTML(),l.tone);},
  range=>runFold('long','Long run',longRunFoldSub(),longRunSectionHTML(range)),
  ()=>runFold('cons','Consistency',consistencyFoldSub(),consistencySectionHTML()),
  ()=>runFold('shoes','Shoes',shoeFoldSub(),shoeSectionHTML(),shoeList().some(s=>s.worn&&!s.retired)?'warn':''));
