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
// Goal-specific priority cards for the home intelligence feed.
function goalFeedItems(){
  const items=[];const g=S.goal||'general';const td=today();
  if(g==='weightloss'||g==='recomp'){
    const hasIntake=(getDayTotals(td).cals||0)>0;
    if(hasIntake){
      const eb=energyBalance(td);const def=eb.net<0;
      items.push({icon:def?'🔥':'⚠️',color:def?'var(--green)':'var(--gold)',bg:def?'var(--grdim)':'var(--gdim)',border:def?'rgba(45,122,82,.2)':'rgba(184,124,42,.2)',
        title:`${def?'Deficit':'Surplus'} so far today: ${eb.net<0?'−':'+'}${Math.abs(Math.round(eb.net)).toLocaleString()} kcal`,
        sub:`${eb.intake.toLocaleString()} in · ${eb.burn.toLocaleString()} burned by now${eb.exercise?` (incl. ${eb.exercise} from training)`:''}. Full-day baseline: ${eb.fullBase.toLocaleString()}.`});
    }
    const bw=bwRateInfo();
    if(bw&&bw.rate!=null){
      const losing=bw.rate<0;
      items.push({icon:'⚖️',color:losing?'var(--green)':'var(--blue)',bg:losing?'var(--grdim)':'var(--bdim)',border:losing?'rgba(45,122,82,.2)':'rgba(36,104,184,.2)',
        title:`${bw.cur.toFixed(1)} ${S.unit} · ${bw.rate<0?'−':'+'}${Math.abs(bw.rate).toFixed(1)} ${S.unit}/wk`,
        sub:'7-day average bodyweight trend.'});
    }
  }
  if(g==='weightloss'){
    const steps=S.stepsLog[td]||0;
    if(steps)items.push({icon:'👟',color:'var(--navy)',bg:'var(--ndim)',border:'var(--nbright)',title:`${steps.toLocaleString()} steps today`,sub:'Daily movement adds to your burn.'});
  }
  if(g==='recomp'){
    const tot=getDayTotals(td);const goalP=(goalsFor(td)||{}).protein||0;
    if(tot.protein||tot.cals){const ok=goalP&&tot.protein>=goalP*0.8;
      items.push({icon:'🥩',color:ok?'var(--green)':'var(--gold)',bg:ok?'var(--grdim)':'var(--gdim)',border:ok?'rgba(45,122,82,.2)':'rgba(184,124,42,.2)',
        title:`Protein ${tot.protein||0}g${goalP?` / ${goalP}g`:''}`,sub:ok?'On track to protect muscle while leaning out.':'Hit protein to hold muscle in a recomp.'});}
  }
  return items;
}
// Actionable warnings shown across all goals: macro tracking + supplements not yet taken.
function homeWarnings(){
  const w=[];const td=today();const tot=getDayTotals(td);
  const loggedMacros=(tot.cals||tot.protein||tot.carbs||tot.fat);
  if(!loggedMacros)w.push({icon:'🍽️',color:'var(--gold)',bg:'var(--gdim)',border:'rgba(184,124,42,.28)',
    title:'No macros logged today',sub:'Keep your tracking honest — scan or log what you have eaten.',action:"go('nutrition')"});
  if(S.supps&&S.supps.length){
    const logs=S.suppLogs[td]||{};const done=S.supps.filter(s=>logs[s.id]).length;
    if(done<S.supps.length){
      const pend=S.supps.filter(s=>!logs[s.id]).map(s=>esc(s.name));
      w.push({icon:'💊',color:'var(--gold)',bg:'var(--gdim)',border:'rgba(184,124,42,.28)',
        title:`Supplements: ${done}/${S.supps.length} taken`,sub:`Still to take: ${pend.slice(0,3).join(', ')}${pend.length>3?'…':''}.`,action:"go('nutrition')"});
    }
  }
  // Storage on a phone is not a backup. Nudge after two weeks without an export.
  if(S.workouts.length>=5&&Date.now()-(S.lastExportAt||0)>14*86400000)w.push({icon:'🗂',color:'var(--navy)',bg:'var(--ndim)',border:'var(--nbright)',
    title:S.lastExportAt?`Last backup: ${fmtShort(S.lastExportAt)}`:'You have no backup yet',sub:'Everything lives on this device only. Tap to export a backup file.',action:"exportData()"});
  return w;
}
// Genuine wins to keep the home screen encouraging (only real successes, goal-prioritized).
function successHighlights(){
  const out=[];const td=today();const g=S.goal||'general';
  const tot=getDayTotals(td);const gp=(goalsFor(td)||{}).protein||0;
  const streak=getStreak();
  const now=new Date();const moCount=S.workouts.filter(w=>{const d=new Date(w.started);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).length;
  const grn={color:'var(--green)',bg:'var(--grdim)',border:'rgba(45,122,82,.2)'};
  // goal-priority wins first
  if(g==='weightloss'){
    // Completed days only — today's balance isn't final until the day is over.
    let dd=0;for(let i=1;i<=7;i++){const ds=daysAgoStr(i);if((getDayTotals(ds).cals||0)>0&&energyBalance(ds).net<0)dd++;}
    if(dd>=2)out.push({icon:'🎯',...grn,title:`${dd} deficit days in the last 7`,sub:'You’re stacking the days that move the needle.'});
    const bwl=S.bodyweightLog||[];
    if(bwl.length>=2){const d=bwl[0].weight-bwl[bwl.length-1].weight;if(d<-0.5)out.push({icon:'📉',...grn,title:`Down ${Math.abs(d).toFixed(1)} ${S.unit} since you started`,sub:'Real progress. Trust the process.'});}
  }
  if(g==='recomp'&&gp&&tot.protein>=gp)out.push({icon:'🥩',...grn,title:`Protein goal hit: ${tot.protein}g`,sub:'Muscle protected while you lean out.'});
  // universal wins
  if(g!=='weightloss'&&g!=='recomp'&&gp&&tot.protein>=gp)out.push({icon:'🥩',...grn,title:`Protein goal hit: ${tot.protein}g`,sub:'Fuel locked in for recovery.'});
  if(S.supps&&S.supps.length){const logs=S.suppLogs[td]||{};if(S.supps.filter(s=>logs[s.id]).length===S.supps.length)out.push({icon:'✅',...grn,title:'All supplements taken today',sub:'Stack complete — nice consistency.'});}
  return out;
}
// The "today" list on the home screen: real wins, things still to do today, and warnings.
// Capped, because a list of nine cards is a list nobody reads.
function homeFeedItems(exIds){
  const items=[];
  successHighlights().slice(0,2).forEach(f=>items.push(f));
  homeWarnings().forEach(f=>items.push(f));
  getPainWarnings().filter(p=>!exIds||exIds.includes(p.exId)).forEach(p=>items.push({icon:'🩹',color:'var(--red)',title:`Pain flagged — ${esc(p.name)}`,sub:`Reported in ${p.sessions} of the last 3 sessions. Go lighter, or swap it in the workout.`}));
  goalFeedItems().slice(0,2).forEach(f=>items.push(f));
  if(S.goal!=='weightloss'){
    const s=[];
    getPRProximity().forEach(p=>s.push({icon:'🏆',color:'var(--gold)',title:`${p.gap} ${S.unit} from your ${esc(p.name)} record`,sub:`Estimated max to beat: ${p.prEst} ${S.unit}.`}));
    (exIds?getStagnantExercises(exIds):[]).forEach(st=>s.push({icon:'📊',color:'var(--gold)',title:`${esc(st.name)} has not moved in 3 sessions`,sub:'Open Targets on today’s routine for what to do about it.'}));
    getVolumeMomentum().forEach(m=>s.push({icon:'🔥',color:'var(--navy)',title:`${m.muscle} volume up ${m.weeks} weeks running`,sub:'Steady overload. Keep the trend going.'}));
    s.slice(0,2).forEach(f=>items.push(f));
  }
  return items;
}
const FEED_TONE={green:'good',gold:'warn',red:'bad',navy:'info',blue:'info'};
function homeFeedHTML(exIds){
  const items=homeFeedItems(exIds).slice(0,5);
  if(!items.length)return'';
  const tone=f=>FEED_TONE[(String(f.color||'').match(/--(\w+)/)||[])[1]]||'info';
  return`<div class="sec-h">Today</div><div class="list feed">${items.map(f=>`<${f.action?'button':'div'} class="row${f.action?' row-tap':''}"${f.action?` onclick="${f.action}"`:''}>
    <span class="row-ic tone-${tone(f)}">${ICON(f.icon,17)}</span><span class="row-main"><span class="row-t">${f.title}</span><span class="row-s">${f.sub}</span></span>${f.action?`<span class="row-chev">${ICON('chev',16)}</span>`:''}</${f.action?'button':'div'}>`).join('')}</div>`;
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
      <div class="hero-t">${has?'Rest day':'No routine yet'}</div>
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

  html+=testPlanCardHTML();
  html+=homeFeedHTML(todayR?todayR.exercises.map(e=>e.exId):null);

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

  // Other routines
  const otherRoutines=(S.routines||[]).filter(r=>r.active!==false&&!(todayR&&todayR.id===r.id));
  if(otherRoutines.length){
    html+=`<div class="sec-h">Other routines</div><div class="list">`;
    otherRoutines.forEach(r=>{
      const last=S.workouts.find(w=>w.routineId===r.id);
      html+=`<div class="row"><span class="row-main"><span class="row-t">${esc(r.name)}</span>
        <span class="row-s">${r.exercises.length} lift${r.exercises.length===1?'':'s'} · ${last?`last done ${fmtShort(last.started)}`:'never done'}</span></span>
        <button class="ib ib-q" onclick="showTargets(${jsq(r.id)})" aria-label="Targets for ${esc(r.name)}">${ICON('target',16)}</button>
        <button class="ib ib-go" onclick="startWorkout(${jsq(r.id)})" aria-label="Start ${esc(r.name)}">${ICON('play',14)}</button></div>`;
    });
    html+=`</div>`;
  }

  c.innerHTML=html;
}

// Quick weigh-in from the home screen.
function showWeighIn(){
  const last=(S.bodyweightLog||[])[0];const doneToday=last&&last.date===today();
  const ov=makeOv('bw-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:4px">Weigh in</div>
    <div class="sheet-sub">${last?`Last: ${last.weight} ${S.unit} on ${fmtDay(last.date)}.`:'Your first weigh-in.'} Same time of day gives the cleanest trend.</div>
    <div class="fg"><label class="fl">Weight (${S.unit})</label><input type="number" inputmode="decimal" step="0.1" id="bw-quick" value="${doneToday?last.weight:''}" placeholder="${last?last.weight:''}"></div>
    <button class="btn btp bfw" onclick="saveWeighIn()">${doneToday?'Update today’s weight':'Save'}</button>
    <button class="btn btg bfw" style="margin-top:6px" onclick="closeOv('bw-ov')">Cancel</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  setTimeout(()=>{const i=document.getElementById('bw-quick');if(i)i.focus();},260);
}
function saveWeighIn(){
  const v=parseFloat(document.getElementById('bw-quick')?.value);
  if(!logBodyweight(v)){toast('Enter a weight');return;}
  save();closeOv('bw-ov');toast(`${v} ${S.unit} logged`,'green');rerender();
}
