// ═══════════════════════════════════════════════════
// TEST-DATE PLAN — count back from a fitness-test date
// ═══════════════════════════════════════════════════
// A feature of the app, not of the coach: nothing here calls an AI. You give a test date; the
// app splits the time into phases counted back from that day, turns the gap between your current
// and goal score on each event into a checkpoint for every week, and gives each event one
// session a week with the numbers filled in. Scores and goals live on the Army Fitness card.
const TEST_PHASE={
  base:{label:'Base',what:'Build the engine: easy running, moderate weights, plenty of clean reps.'},
  build:{label:'Build',what:'Get specific: goal-pace intervals, heavier triples, timed sets.'},
  peak:{label:'Peak',what:'Practise the test itself at full effort, with full recovery between hard days.'},
  taper:{label:'Taper',what:'Stay sharp and shed fatigue. Nothing heavy or all-out in the last 4 days.'},
};
const TEST_MAX_DAYS=366;
// Phase lengths in weeks, last phase ends on test day.
function testPhases(weeks){
  let list;
  if(weeks<=1)list=[['taper',1]];
  else if(weeks===2)list=[['peak',1],['taper',1]];
  else if(weeks===3)list=[['build',1],['peak',1],['taper',1]];
  else{
    const peak=weeks>=8?2:1;const rest=weeks-1-peak;const base=Math.max(1,Math.round(rest*0.4));
    list=[['base',base],['build',rest-base],['peak',peak],['taper',1]];
  }
  let at=1;
  return list.filter(p=>p[1]>0).map(p=>{const o={id:p[0],label:TEST_PHASE[p[0]].label,weeks:p[1],from:at,to:at+p[1]-1};at+=p[1];return o;});
}
function aftNum(v){const n=parseFloat(v);return v===''||v==null||isNaN(n)?null:n;}
function aftRound(evId,v){if(evId==='MDL')return Math.round(v/10)*10;return Math.round(v);}
function aftBetter(evId,a,b){return aftEvent(evId).dir==='high'?a>=b:a<=b;}
// The next row up the score table from a result: {pts, raw}, or null at 100 points.
function aftNextStep(evId,val,col){
  const now=aftScore(evId,val,col);if(now==null||now>=100)return null;
  const t=AFT_TABLES[evId];if(col==null)col=aftColumn();
  for(let p=now+1;p<=100;p++){const row=t[p];if(row&&row[col]!=null)return{pts:p,raw:row[col]};}
  return null;
}
// Everything the plan shows, for a given day. Null when there is no plan.
function testPlanCalc(tp,td){
  tp=tp||S.testPlan;if(!isObj(tp)||!tp.date)return null;
  td=td||today();
  const days=daysBetween(td,tp.date);
  const total=Math.max(1,daysBetween(tp.start,tp.date));
  const weeks=Math.max(1,Math.ceil(total/7));
  const phases=testPhases(weeks);
  // Weeks are counted back from test day, so the final seven days are always the taper.
  const fromEnd=days<=0?1:Math.floor((days-1)/7)+1;
  const week=Math.min(weeks,Math.max(1,weeks-fromEnd+1));
  const phase=phases.find(p=>week>=p.from&&week<=p.to)||phases[phases.length-1];
  const taper=phases.find(p=>p.id==='taper');
  const workWeeks=Math.max(1,weeks-(taper?taper.weeks:0));
  const frac=w=>Math.min(1,Math.max(0,w)/workWeeks);
  const col=aftColumn();
  const from0=isObj(tp.from)?tp.from:{};
  const retested=AFT_EVENTS.some(e=>String(S.aftCurrent[e.id]??'')!==String(from0[e.id]??''))||(S.aftHistory||[]).some(h=>h&&h.date>tp.start);
  const events=AFT_EVENTS.map(e=>{
    const from=aftNum(from0[e.id]),goal=aftNum(S.aftGoals[e.id]),now=aftNum(S.aftCurrent[e.id]);
    const o={id:e.id,name:e.name,from,goal,now,nowPts:aftScore(e.id,now,col),goalPts:aftScore(e.id,goal,col),aim:null,status:'nogoal',next:now!=null?aftNextStep(e.id,now,col):null};
    if(goal==null)return o;
    if(now!=null&&aftBetter(e.id,now,goal)){o.status='met';o.aim=goal;return o;}
    const start=from!=null?from:now;
    if(start==null){o.status='nostart';return o;}
    if(aftBetter(e.id,start,goal)){o.aim=goal;o.status=now==null?'nostart':'behind';return o;}
    const at=w=>aftRound(e.id,start+(goal-start)*frac(w));
    o.aim=at(week);
    const due=at(week-1); // where you should already be at the start of this week
    if(now==null)o.status='nostart';
    else if(week>1&&!retested)o.status='untested';
    else o.status=aftBetter(e.id,now,due)?'on':'behind';
    return o;
  });
  const nowSum=aftSummary(S.aftCurrent,col),goalSum=aftSummary(S.aftGoals,col);
  return{date:tp.date,start:tp.start,days,total,weeks,week,phase,phases,events,retested,nowSum,goalSum,practice:testPractice(tp),past:days<0};
}
// Full practice tests: ten days out, then every three weeks before that.
function testPractice(tp){
  const total=daysBetween(tp.start,tp.date);const out=[];
  if(total<17)return out;
  for(let back=10;back<=total-7;back+=21){
    const ds=addDays(tp.date,-back);
    const done=(S.aftHistory||[]).some(h=>h&&h.date&&Math.abs(daysBetween(h.date,ds))<=3);
    out.push({date:ds,done,daysOut:back});
  }
  return out.reverse();
}
// One session a week per event, with this week's numbers in it.
function testSessions(pc){
  const ph=pc.phase.id;const r5=v=>Math.round(v/5)*5;const up=v=>Math.max(1,Math.ceil(v));
  const ev=id=>pc.events.find(e=>e.id===id);
  const out=[];
  const add=(id,text)=>out.push({id,name:aftEvent(id).name,text});
  let e=ev('MDL'),a=e.aim;
  add('MDL',a==null?{base:'3 × 5 at a weight that leaves two reps in hand',build:'4 × 3, heavier than last week',peak:'Work up to one heavy set of 3, once',taper:'2 × 3 at an easy weight, early in the week'}[ph]
    :{base:`3 × 5 at ${r5(a*0.8)} lb`,build:`4 × 3 at ${r5(a*0.9)} lb`,peak:`Work up to 1 × 3 at ${a} lb, once this week`,taper:`2 × 3 at ${r5((e.goal||a)*0.7)} lb, early in the week`}[ph]);
  e=ev('HRP');a=e.aim;
  add('HRP',a==null?{base:'5 easy sets at half your best, twice',build:'4 sets at two thirds of your best, plus one max set',peak:'One full 2:00 test set',taper:'2 easy sets, three days out'}[ph]
    :{base:`5 sets of ${up(a*0.5)}, twice this week`,build:`4 sets of ${up(a*0.65)}, then one max set`,peak:`One full 2:00 set aiming for ${a}; another day, 3 × ${up(a*0.6)}`,taper:`2 easy sets of ${up(a*0.5)}, three days out`}[ph]);
  e=ev('SDC');a=e.aim;
  add('SDC',{base:'Sprints, sled drags and carries on separate days; do not time it yet',build:`2 full runs with 4:00 rest${a!=null?`, aiming for ${fmtMS(a)}`:''}`,
    peak:`1 all-out run${a!=null?`, aiming for ${fmtMS(a)}`:''}; 1 more at about 90%`,taper:'1 run at about 80%, early in the week'}[ph]);
  e=ev('PLK');a=e.aim;
  add('PLK',a==null?{base:'3 holds at half your best',build:'3 holds at 70% of your best',peak:'1 max hold',taper:'2 short holds'}[ph]
    :{base:`3 holds of ${fmtMS(a*0.5)}`,build:`3 holds of ${fmtMS(a*0.7)}`,peak:`1 max hold aiming for ${fmtMS(a)}; another day, 2 × ${fmtMS(a*0.6)}`,taper:`2 holds of ${fmtMS(a*0.5)}`}[ph]);
  e=ev('2MR');a=e.aim;const lap=a!=null?a/8.047:null; // two miles is 8.047 laps of a 400 m track
  add('2MR',a==null?{base:'2 easy runs of 20–30 min and 1 steady 15 min',build:'6 × 400 m hard with 1:30 rest, plus 1 easy run',peak:'3 × 800 m hard with 2:30 rest, and 1 timed mile',taper:'4 × 400 m early in the week, then easy'}[ph]
    :{base:'2 easy runs of 20–30 min and 1 steady 15 min',build:`6 × 400 m in ${fmtMS(lap)} with 1:30 rest, plus 1 easy run`,
      peak:`3 × 800 m in ${fmtMS(lap*2)} with 2:30 rest, and 1 timed mile in ${fmtMS(a/2)}`,taper:`4 × 400 m in ${fmtMS(lap)} early in the week, then easy`}[ph]);
  return out;
}
function setTestDate(ds){
  if(!isRealDate(ds)){toast('Pick a date');return false;}
  const d=daysBetween(today(),ds);
  if(!(d>=1)){toast('Pick a date after today');return false;}
  if(d>TEST_MAX_DAYS){toast('Pick a date within a year');return false;}
  const cur=S.testPlan;
  // Moving the date keeps the starting point, so the checkpoints stretch instead of resetting.
  const keep=isObj(cur)&&cur.start&&cur.start<=today();
  S.testPlan={date:ds,start:keep?cur.start:today(),from:keep&&isObj(cur.from)?cur.from:Object.assign({},S.aftCurrent)};
  save();return true;
}
// A calendar date that exists (2026-13-45 has the right shape and is not one).
function isRealDate(ds){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(ds||'')))return false;const d=dayDate(ds);return !isNaN(d.getTime())&&dstr(d)===ds;}
function clearTestPlan(){
  const old=S.testPlan;S.testPlan=null;save();
  closeOv('tp-ov');rerender();
  toast('Test date removed','',{action:'Undo',onAction:()=>{S.testPlan=old;save();rerender();}});
}
function normalizeTestPlan(v){
  if(!isObj(v)||!isRealDate(v.date))return null;
  let start=isRealDate(v.start)?v.start:addDays(v.date,-28);
  if(start>=v.date)start=addDays(v.date,-1);
  const from={};AFT_EVENTS.forEach(e=>{const x=isObj(v.from)?v.from[e.id]:'';from[e.id]=x==null?'':String(x).slice(0,12);});
  return{date:v.date,start,from};
}
function testDateLong(ds){return dayDate(ds).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});}
function testCountdown(pc){
  if(pc.days<0)return{big:'Done',small:`Test day was ${testDateLong(pc.date)}`};
  if(pc.days===0)return{big:'Today',small:'Test day'};
  return{big:String(pc.days),small:`day${pc.days===1?'':'s'} to your test · ${testDateLong(pc.date)}`};
}
function testPhaseBarHTML(pc){
  return`<div class="tp-bar">${pc.phases.map(p=>`<span class="tp-seg${p.id===pc.phase.id&&!pc.past?' on':''}${p.to<pc.week||pc.past?' past':''}" style="flex:${p.weeks}"><i></i><b>${p.label}</b></span>`).join('')}</div>`;
}
// Home screen card. Empty string when there is no plan.
function testPlanCardHTML(){
  const pc=testPlanCalc();if(!pc)return'';
  const cd=testCountdown(pc);
  const aims=pc.events.filter(e=>e.aim!=null&&e.status!=='met').map(e=>`${e.id} ${aftFmtRaw(e.id,e.aim).replace(' lbs',' lb')}`);
  return`<div class="tp-card" onclick="showTestPlan()" role="button">
    <div class="tp-top"><span class="tp-days">${cd.big}</span><span class="tp-dl">${esc(cd.small)}</span><span class="row-chev">${ICON('chev',16)}</span></div>
    ${pc.past||pc.days===0?'':`${testPhaseBarHTML(pc)}<div class="tp-aims"><b>${pc.phase.label}, week ${pc.week} of ${pc.weeks}.</b> ${aims.length?`By Sunday: ${esc(aims.join(' · '))}`:'Add current and goal scores to get weekly checkpoints.'}</div>`}
  </div>`;
}
// Row at the top of the Army Fitness card.
function testDateRowHTML(){
  const pc=testPlanCalc();
  return`<button class="row row-tap tp-row" onclick="showTestPlan()"><span class="row-ic tone-info">${ICON('flag',17)}</span><span class="row-main"><span class="row-t">${pc?(pc.past?'Test day has passed':pc.days===0?'Test day is today':`Test in ${pc.days} day${pc.days===1?'':'s'}`):'Plan for a test date'}</span>
    <span class="row-s">${pc?`${testDateLong(pc.date)}${pc.past||pc.days===0?'':` · ${pc.phase.label}, week ${pc.week} of ${pc.weeks}`}`:'Weekly checkpoints and sessions, counted back from the day'}</span></span><span class="row-chev">${ICON('chev',16)}</span></button>`;
}
const TEST_STATUS={on:['On track','good'],behind:['Behind','warn'],met:['Goal met','good'],untested:['Retest','flat'],nogoal:['No goal','flat'],nostart:['No score','flat']};
function showTestPlan(){
  const ov=makeOv('tp-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div id="tp-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);renderTestPlan();
}
function renderTestPlan(){
  const el=document.getElementById('tp-body');if(!el)return;
  const pc=testPlanCalc();
  const pick=n=>`<button class="chip" onclick="document.getElementById('tp-date').value='${addDays(today(),n*7)}'">${n} weeks</button>`;
  const dateForm=(label)=>`<div class="fg" style="margin-top:12px"><label class="fl">Test date</label><input type="date" id="tp-date" value="${pc?pc.date:addDays(today(),56)}" min="${addDays(today(),1)}" max="${addDays(today(),TEST_MAX_DAYS)}">
      <div class="wiz-opts" style="margin-top:8px">${[4,6,8,12].map(pick).join('')}</div></div>
    <button class="btn btp bfw" onclick="if(setTestDate(document.getElementById('tp-date').value)){renderTestPlan();rerender();}">${label}</button>`;
  if(!pc){
    el.innerHTML=`<div class="mt" style="margin-bottom:4px">Plan for a test date</div>
      <div class="sheet-sub">Pick the day of your fitness test. The app counts back from it: phases that end in a taper, a checkpoint for every event every week, one session a week per event with the numbers filled in, and dates for practice tests. It uses the current and goal scores on your Army Fitness card. No AI involved.</div>
      ${dateForm('Build the plan')}
      <button class="btn btg bfw" style="margin-top:6px" onclick="closeOv('tp-ov')">Not now</button>`;
    return;
  }
  const cd=testCountdown(pc);const sessions=testSessions(pc);
  const missing=pc.events.filter(e=>e.status==='nogoal'||e.status==='nostart').length;
  const gain=pc.events.filter(e=>e.nowPts!=null&&e.goalPts!=null&&e.goalPts>e.nowPts).sort((a,b)=>(b.goalPts-b.nowPts)-(a.goalPts-a.nowPts))[0];
  el.innerHTML=`<div class="tp-hero"><div class="tp-days">${cd.big}</div><div class="tp-dl">${esc(cd.small)}</div></div>
    ${pc.past?`<div class="note-box">Enter your result on the Army Fitness card and save a snapshot, then set the next date or remove this one.</div>`:`
    ${testPhaseBarHTML(pc)}
    <div class="sheet-sub" style="margin-top:10px"><b>${pc.phase.label}, week ${pc.week} of ${pc.weeks}.</b> ${TEST_PHASE[pc.phase.id].what}</div>
    <div class="sec-h">Checkpoints for this week</div>
    <div class="list">${pc.events.map(e=>{const st=TEST_STATUS[e.status];return`<div class="row"><span class="row-main"><span class="row-t">${e.name}</span>
        <span class="row-s">Now ${aftFmtRaw(e.id,e.now)}${e.nowPts!=null?` (${e.nowPts} pts)`:''} · goal ${aftFmtRaw(e.id,e.goal)}${e.goalPts!=null?` (${e.goalPts} pts)`:''}${e.next&&e.status!=='met'?` · next point at ${aftFmtRaw(e.id,e.next.raw)}`:''}</span></span>
        <span class="aim"><span class="aim-v">${e.aim!=null?aftFmtRaw(e.id,e.aim):'–'}</span><span class="dl dl-${st[1]}">${st[0]}</span></span></div>`;}).join('')}</div>
    ${missing?`<div class="note-box">${missing} event${missing===1?' has':'s have'} no current or goal score, so ${missing===1?'it has':'they have'} no checkpoint. <a onclick="closeOv('tp-ov');openAftCard()">Add them on the Army Fitness card</a>.</div>`:''}
    ${!pc.retested&&pc.week>1?`<div class="note-box">Your scores have not changed since the plan began, so there is nothing to compare the checkpoints with. Retest an event and update its score.</div>`:''}
    <div class="st-grid st-2">
      <div class="st"><div class="st-v">${pc.nowSum.n?pc.nowSum.total:'–'}</div><div class="st-l">Points now${pc.nowSum.n&&pc.nowSum.n<5?` (${pc.nowSum.n} of 5 events)`:''}</div></div>
      <div class="st"><div class="st-v">${pc.goalSum.n?pc.goalSum.total:'–'}</div><div class="st-l">Points at goal</div>${gain?`<span class="dl dl-flat">Most to gain: ${gain.id}, +${gain.goalPts-gain.nowPts}</span>`:''}</div>
    </div>
    <div class="sec-h">This week, one session per event</div>
    <div class="list">${sessions.map(s=>`<div class="row"><span class="row-main"><span class="row-t">${s.name}</span><span class="row-s">${esc(s.text)}</span></span></div>`).join('')}</div>
    <div class="fine">A general template built from your own numbers. Fit these around your routine and leave a day between hard efforts on the same event.</div>
    ${pc.practice.length?`<div class="sec-h">Full practice tests</div><div class="list">${pc.practice.map(p=>`<div class="row"><span class="row-main"><span class="row-t">${testDateLong(p.date)}</span><span class="row-s">${p.daysOut} days before the test</span></span><span class="dl dl-${p.done?'good':'flat'}">${p.done?'Logged':p.date<today()?'Not logged':'Planned'}</span></div>`).join('')}</div>`:''}`}
    <div class="sheet-acts">
      <button class="btn bts" onclick="closeOv('tp-ov');openAftCard()">Update scores</button>
      ${pc.past?'':`<button class="btn bts" onclick="downloadTestCalendar()">${ICON('calendar',15)} Add to calendar</button>`}
    </div>
    <details class="fold"><summary>Change or remove the date</summary>${dateForm('Save the new date')}
      <button class="btn btg bfw" style="margin-top:6px;color:var(--red)" onclick="clearTestPlan()">Remove the test date</button></details>
    <button class="btn btg bfw" style="margin-top:4px" onclick="closeOv('tp-ov')">Done</button>`;
}
// Jump to the Army Fitness card on the Progress tab, opened.
function openAftCard(){
  S.expandedCards=S.expandedCards||{};S.expandedCards.aft=true;save();
  go('progress');
  setTimeout(()=>{const el=document.getElementById('dash-aft');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},80);
}
// Test day and the practice tests as all-day calendar events.
function testPlanICS(){
  const pc=testPlanCalc();if(!pc||pc.past)return'';
  const now=new Date();const ymd=ds=>ds.replace(/-/g,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Lah We//Test plan//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  const add=(uid,ds,title,alarm)=>lines.push('BEGIN:VEVENT',`UID:lahwe-${uid}@lahwe.app`,`DTSTAMP:${icsUtc(now)}`,`SEQUENCE:${Math.floor(now.getTime()/1000)}`,
    `DTSTART;VALUE=DATE:${ymd(ds)}`,`DTEND;VALUE=DATE:${ymd(addDays(ds,1))}`,`SUMMARY:${icsEscape(title)}`,'TRANSP:TRANSPARENT',
    'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${icsEscape(alarm)}`,'TRIGGER:-PT15H','END:VALARM','END:VEVENT');
  add('test-day',pc.date,'Fitness test','Fitness test tomorrow');
  pc.practice.filter(p=>p.date>=today()).forEach((p,i)=>add('test-practice-'+i,p.date,'Practice fitness test','Practice fitness test tomorrow'));
  lines.push('END:VCALENDAR');
  return lines.join('\r\n')+'\r\n';
}
function downloadTestCalendar(){
  const ics=testPlanICS();if(!ics)return;
  try{downloadText('lahwe-test.ics',ics,'text/calendar');toast('Open the file to add the dates to Calendar','green',{ms:4500});}
  catch(e){toast('Could not create the calendar file','red');logError(e,'testplan');}
}
