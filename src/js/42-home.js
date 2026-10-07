// ═══════════════════════════════════════════════════
// WORKOUT HOME — rich "get hyped" screen
// ═══════════════════════════════════════════════════
// 7-day-average bodyweight trend (per week, in the user's unit) for home cards.
function bwRateInfo(){
  const bwl=S.bodyweightLog||[];if(bwl.length<2)return null;
  const now=Date.now();
  const within=(a,b)=>bwl.filter(e=>e.date>daysAgoStr(b)&&e.date<=daysAgoStr(a)); // whole calendar days, today included
  const avg=arr=>arr.length?arr.reduce((t,e)=>t+e.weight,0)/arr.length:null;
  const recent=avg(within(0,7)),prior=avg(within(7,14));
  if(recent==null)return{rate:null,cur:bwl[0].weight};
  if(prior==null)return{rate:null,cur:recent};
  return{rate:recent-prior,cur:recent};
}
// ─── Home says one encouraging thing and shows one milestone ───
// Home's job is to get you to train today. Problems (a stalled lift, a pain flag) are on Progress,
// where you go looking for them; what is still to do today for food is on Nutrition.
function homeWins(){
  const out=[];const td=today();const g=S.goal||'general';
  const tot=getDayTotals(td);const gp=(goalsFor(td)||{}).protein||0;
  if(g==='weightloss'){
    // Finished days only: today's balance is not final until the day is over.
    let dd=0;for(let i=1;i<=7;i++){const ds=daysAgoStr(i);if((getDayTotals(ds).cals||0)>0&&energyBalance(ds).net<0)dd++;}
    if(dd>=3)out.push({icon:'target',t:`${dd} deficit days in the last 7`,s:'Those are the days that move the scale.',js:"go('nutrition')"});
    const bwl=S.bodyweightLog||[];
    if(bwl.length>=2){const d=bwl[0].weight-bwl[bwl.length-1].weight;if(d<-0.5)out.push({icon:'trenddown',t:`Down ${Math.abs(d).toFixed(1)} ${S.unit} since you started`,s:`From ${bwl[bwl.length-1].weight} on ${fmtDay(bwl[bwl.length-1].date)}.`,js:"showMetric('weight')"});}
  }
  getPRProximity().forEach(p=>out.push({icon:'trophy',t:`${p.gap} ${S.unit} from your ${p.name} record`,s:`Estimated max to beat: ${p.prEst} ${S.unit}.`,js:`showExDetail(${JSON.stringify(p.exId)})`}));
  getVolumeMomentum().forEach(m=>out.push({icon:'flame',t:`${m.muscle} volume up ${m.weeks} weeks running`,s:'Steady overload.',js:"showMetric('sets')"}));
  if(gp&&tot.protein>=gp)out.push({icon:'check',t:`Protein goal hit: ${Math.round(tot.protein)} g`,s:'Done for today.',js:"go('nutrition')"});
  const fresh=newRecords(RANGES[0]).length;
  if(fresh>=2)out.push({icon:'medal',t:`${fresh} new records in the last 4 weeks`,s:'Open Progress to see them.',js:"showMetric('records')"});
  return out;
}
function homeLineHTML(){
  let l=null;try{l=patHomeLine();}catch(e){logError(e,'patterns');}
  const pick=l?{icon:l.icon,t:l.t,s:l.s,js:`showPattern(${JSON.stringify(l.id)})`}:homeWins()[0];
  if(!pick)return'';
  return`<div class="list home-line"><button class="row row-tap" onclick="${esc(pick.js)}"><span class="row-ic tone-good">${ICON(pick.icon,17)}</span><span class="row-main"><span class="row-t">${esc(pick.t)}</span><span class="row-s">${esc(pick.s)}</span></span><span class="row-chev">${ICON('chev',16)}</span></button></div>`;
}
// The nearest thing worth reaching: a plate milestone on a main lift, the weight goal, or a round
// number of sessions. The test date, when there is one, is the milestone (testPlanCardHTML).
const PLATE_MARKS={lbs:[95,135,185,225,275,315,365,405,455,495,545,585,635],kg:[40,60,80,100,120,140,160,180,200,220,240,260]};
function homeMilestones(){
  const out=[];const u=S.unit==='kg'?'kg':'lbs';
  defaultLiftIds().forEach(id=>{
    const ser=getExStrData(id);if(ser.length<3)return;const cur=ser[ser.length-1].e1rm;const ex=getEx(id);
    const bar=!!(ex&&/barbell|trap bar|hex/i.test(ex.eq+' '+ex.name));
    const marks=bar?PLATE_MARKS[u]:null;let next,prev;
    if(marks){next=marks.find(m=>m>cur);prev=marks.slice().reverse().find(m=>m<=cur);if(!next)return;if(prev==null)prev=next*0.7;}
    else{const step=u==='kg'?10:25;next=(Math.floor(cur/step)+1)*step;prev=next-step;}
    const f=fitLine(liftPts(id,daysAgoStr(84)));const perWk=f&&f.span>=14?f.perDay*7:0;const gap=next-cur;
    out.push({kind:'lift',t:`${next} ${u} ${shortLiftNames([exName(id)])[0].toLowerCase()}`,frac:(cur-prev)/(next-prev),
      s:`${Math.round(gap)} ${u} to go on your estimated max${perWk>0.2?` · about ${Math.max(1,Math.round(gap/perWk))} week${Math.round(gap/perWk)<=1?'':'s'} at your pace`:''}`,js:`showExDetail(${JSON.stringify(id)})`});
  });
  const bwl=S.bodyweightLog||[];
  if(S.weightGoal>0&&bwl.length>=2){
    const start=bwl[bwl.length-1].weight,cur=bwl[0].weight,goal=+S.weightGoal;const span=start-goal;
    if(Math.abs(span)>=1&&Math.abs(cur-goal)>0.2){const frac=(start-cur)/span;
      if(frac>0&&frac<1)out.push({kind:'weight',t:`${fmt1(goal)} ${S.unit}`,frac,s:`${fmt1(Math.abs(cur-goal))} ${S.unit} to go from ${fmt1(cur)}`,js:"showMetric('weight')"});}
  }
  const n=S.workouts.length;
  if(n>=5){const step=n<100?25:n<500?50:100;const next=(Math.floor(n/step)+1)*step;out.push({kind:'sessions',t:`${next} sessions`,frac:(n-(next-step))/step,s:`${next-n} to go · ${n} logged`,js:"go('history')"});}
  // closest first; a session count only leads when it is nearly there
  return out.filter(m=>m.frac>=0&&m.frac<1).sort((a,b)=>(b.frac-(b.kind==='sessions'?0.25:0))-(a.frac-(a.kind==='sessions'?0.25:0)));
}
function homeMilestoneHTML(){
  let m=null;try{m=homeMilestones()[0];}catch(e){logError(e,'milestone');}
  if(!m)return'';
  return`<button class="ms-card" onclick="${esc(m.js)}"><span class="ms-k">Next milestone</span><span class="ms-row"><span class="ms-t">${esc(m.t)}</span><span class="ms-p">${Math.round(m.frac*100)}%</span></span>
    <span class="ms-bar"><i style="width:${Math.max(3,Math.round(m.frac*100))}%"></i></span><span class="ms-s">${esc(m.s)}</span></button>`;
}
// Things that need looking at. Shown on Progress, above the board.
function attentionItems(){
  const out=[];
  getPainWarnings().forEach(p=>out.push({icon:'alert',tone:'bad',t:`Pain flagged on ${p.name}`,s:`In ${p.sessions} of the last 3 sessions. Its aim has been backed off.`,js:`showExDetail(${JSON.stringify(p.exId)})`}));
  getStagnantExercises(getRecentExIds()).forEach(st=>out.push({icon:'equal',tone:'warn',t:`${st.name} has not moved in 3 sessions`,s:'Open the lift for what its sessions looked like.',js:`showExDetail(${JSON.stringify(st.exId)})`}));
  if(backupDue())out.push({icon:'folder',tone:'info',t:S.lastExportAt?`Last backup: ${fmtShort(S.lastExportAt)}`:'You have no backup yet',s:'Everything lives on this device only. Tap to export a backup file.',js:'exportData()'});
  return out;
}
// Storage on a phone is not a backup: nudge after two weeks without an export.
function backupDue(){return S.workouts.length>=5&&Date.now()-(S.lastExportAt||0)>14*86400000;}
function attentionHTML(){
  const items=attentionItems();if(!items.length)return'';
  return`<div class="sec-h">Needs a look · ${items.length}</div><div class="list attn">${items.map(f=>`<button class="row row-tap" onclick="${esc(f.js)}"><span class="row-ic tone-${f.tone}">${ICON(f.icon,17)}</span><span class="row-main"><span class="row-t">${esc(f.t)}</span><span class="row-s">${esc(f.s)}</span></span><span class="row-chev">${ICON('chev',16)}</span></button>`).join('')}</div>`;
}
function renderWorkout(c){
  if(S.activeCardDeck){renderCardDeckSession(c);return;}
  if(S.activeSprintTimer){renderSprintSession(c);return;}
  if(S.activeWorkout){renderSession(c);return;}
  const td=today();window._renderedDay=td;const name=esc(S.name||'Athlete');
  const rv=weekReview();
  const ag=getActiveGroup();
  const todayR=getNextRoutine();
  const _glen=ag?Math.max(1,(ag.routineIds||[]).length):1;
  const nextLabel=(ag&&ag.mode==='rotation')?`Up next · ${String.fromCharCode(65+((ag.cursor||0)%_glen))}`:'Today';
  const streak=getStreak();

  let html=`<div class="hm-top">
    <div style="min-width:0"><div class="hm-date">${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
      <div class="hm-hi">${greet()}, ${name}</div></div>
    <button class="icon-btn" onclick="showSettings()" aria-label="Settings">${ICON('gear',19)}</button>
  </div>`;

  // Today's routine
  if(todayR){
    const r=todayR;const lifts=r.exercises.filter(e=>getEx(e.exId));
    const lastSess=S.workouts.find(w=>w.routineId===r.id);
    const doneToday=wasRoutineDoneToday(r.id);
    const aims=doneToday?[]:routineTargets(r.id).filter(t=>t.aim).slice(0,3);
    html+=`<div class="hero routine-today">
      <div class="hero-k">${nextLabel}</div>
      <div class="hero-t">${esc(r.name)}</div>
      <div class="hero-m">${lifts.length} lift${lifts.length===1?'':'s'} · about ${coachEstMinutes(lifts)} min${lastSess?` · last done ${fmtShort(lastSess.started)}`:''}</div>
      ${aims.length?`<div class="hero-aims">${aims.map(t=>`<div><span>${esc(t.name)}</span><b class="aim-${t.aim.kind}">${aimIcon(t.aim,12)}${esc(fmtAim(t.aim,t.timed))}</b></div>`).join('')}</div>`:''}
      ${doneToday
        ?`<div class="hero-done">${ICON('tick',16)} Completed today</div>`
        :`<div class="hero-acts"><button class="hero-go" onclick="startWorkout(${jsq(r.id)})">${ICON('play',14)} Start ${esc(r.name)}</button><button class="hero-2" onclick="showTargets(${jsq(r.id)})">${ICON('target',15)} Targets</button></div>`}
    </div>`;
  }else{
    const has=(S.routines||[]).length>0;
    html+=`<div class="hero hero-rest">
      <div class="hero-k">Today</div>
      <div class="hero-t">${has?'Rest day':'No workout yet'}</div>
      <div class="hero-m">${has?'Nothing is planned today. Recover, walk, or train anyway.':'Build one in the Library, or have the coach write it.'}</div>
      <div class="hero-acts"><button class="hero-go" onclick="startWorkout()">${ICON('plus',15)} Empty workout</button><button class="hero-2" onclick="coachStart('quick')">${ICON('bolt',15)} Quick workout</button></div>
    </div>`;
  }

  // This week: plan against what happened, and four numbers chosen for the goal
  html+=`<div class="wk-card" onclick="showWeekReview()" role="button" aria-label="Weekly check-in">
    <div class="wk-head"><span class="wk-t">This week</span>${streak>=2?`<span class="pill">${ICON('flame',12)} ${streak} in a row</span>`:''}<span style="flex:1"></span><span class="row-chev">${ICON('chev',16)}</span></div>
    <div class="wk-n">${esc(rv.headline)}</div>
    ${weekDotsHTML(rv.days)}
    <div class="wk-stats">${homeStats(rv).map(s=>`<div class="wk-s"><b>${s.val}</b><span>${s.lbl}</span>${s.delta?`<i class="dl dl-${s.tone||'flat'}">${s.delta}</i>`:''}</div>`).join('')}</div>
  </div>`;

  html+=homeLineHTML();
  html+=testPlanCardHTML()||homeMilestoneHTML();

  // Quick actions
  html+=`<div class="qa">
    <button onclick="startWorkout()">${ICON('plus',19)}<span>Workout</span></button>
    <button onclick="showLogActivity()">${ICON('run',19)}<span>Activity</span></button>
    <button onclick="showModes()">${ICON('bolt',19)}<span>Modes</span></button>
    <button onclick="showWeighIn()">${ICON('scale',19)}<span>Weigh in</span></button>
  </div>`;

  // Coach: the fastest way to get a workout, a plan or an answer
  html+=`<div class="home-coach">
    <div class="hc-head" onclick="go('coach')"><span class="hc-i">${ICON('spark',18)}</span><div style="flex:1;min-width:0"><div class="hc-t">Ask your coach</div><div class="hc-s">${aiReady()?'Workouts, programs, meal plans and reviews, built from your data':'Set up an AI coach with your own key'}</div></div><span class="row-chev">${ICON('chev',16)}</span></div>
    <div class="hc-chips"><button onclick="coachStart('quick')">Quick workout</button><button onclick="coachStart('review')">Review my week</button><button onclick="coachStart('mealplan')">Plan meals</button></div>
  </div>`;

  // Starting some other workout is one tap away, in the Library; the list is not repeated here.
  const others=(S.routines||[]).filter(r=>r.active!==false&&!(todayR&&todayR.id===r.id)).length;
  if(others)html+=`<div class="list home-more"><button class="row row-tap" onclick="S.libTab='routines';go('library')"><span class="row-main"><span class="row-t">${todayR?'Do a different workout':'Your workouts'}</span><span class="row-s">${others} ${todayR?'other':''} in the Library</span></span><span class="row-chev">${ICON('chev',16)}</span></button></div>`;
  // The one thing Home will still nag about: your data lives on this phone only.
  if(backupDue())html+=`<button class="home-backup" onclick="exportData()">${ICON('folder',14)} ${S.lastExportAt?`Last backup ${fmtShort(S.lastExportAt)}`:'No backup yet'} · Export</button>`;

  c.innerHTML=html;
}

// Quick weigh-in from the home screen.
function showWeighIn(){
  const last=(S.bodyweightLog||[])[0];const doneToday=last&&last.date===today();
  const ov=makeOv('bw-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:4px">Weigh in</div>
    <div class="sheet-sub">${last?`Last: ${last.weight} ${S.unit} on ${fmtDay(last.date)}.`:'Your first weigh-in.'} Same time of day gives the cleanest trend.</div>
    <div class="fg"><label class="fl">Weight (${S.unit})</label><input type="number" inputmode="decimal" step="0.1" id="bw-quick" value="${doneToday?last.weight:''}" placeholder="${last?last.weight:''}"></div>
    ${S.trackSleep?`<div class="fg"><label class="fl">Sleep last night <small>optional</small></label><div class="feel-row" id="bw-sleep" role="group" aria-label="Hours of sleep last night">${SLEEP_OPTS.map(o=>`<button class="chip${(S.sleepLog||{})[today()]===o[0]?' on':''}" data-h="${o[0]}" aria-pressed="${(S.sleepLog||{})[today()]===o[0]?'true':'false'}" onclick="setSleep(${o[0]})">${o[1]}</button>`).join('')}</div></div>`:''}
    <button class="btn btp bfw" onclick="saveWeighIn()">${doneToday?'Update today’s weight':'Save'}</button>
    <button class="btn btg bfw" style="margin-top:6px" onclick="closeOv('bw-ov')">Cancel</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  setTimeout(()=>{const i=document.getElementById('bw-quick');if(i)i.focus();},260);
}
// Hours of sleep, asked with the weigh-in because that is the one thing you already do each morning.
const SLEEP_OPTS=[[5,'5 or less'],[6,'6'],[7,'7'],[8,'8'],[9,'9+']];
function setSleep(h){
  if(!isObj(S.sleepLog))S.sleepLog={};const td=today();
  if(S.sleepLog[td]===h)delete S.sleepLog[td];else S.sleepLog[td]=h;
  save();
  document.querySelectorAll('#bw-sleep .chip').forEach(b=>{const on=+b.dataset.h===S.sleepLog[td];b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');});
}
function saveWeighIn(){
  const raw=String(document.getElementById('bw-quick')?.value||'').trim();const v=parseFloat(raw);
  const slept=S.trackSleep&&isObj(S.sleepLog)&&S.sleepLog[today()]>0;
  if(!raw&&slept){save();closeOv('bw-ov');toast('Sleep logged','green');rerender();return;} // sleep on its own is allowed
  if(!logBodyweight(v)){toast('Enter a weight');return;}
  save();closeOv('bw-ov');toast(`${v} ${S.unit} logged`,'green');rerender();
}
