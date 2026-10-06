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
    const tot=getDayTotals(td);const goalP=(S.macroGoals||{}).protein||0;
    if(tot.protein||tot.cals){const ok=goalP&&tot.protein>=goalP*0.8;
      items.push({icon:'🥩',color:ok?'var(--green)':'var(--gold)',bg:ok?'var(--grdim)':'var(--gdim)',border:ok?'rgba(45,122,82,.2)':'rgba(184,124,42,.2)',
        title:`Protein ${tot.protein||0}g${goalP?` / ${goalP}g`:''}`,sub:ok?'On track to protect muscle while leaning out.':'Hit protein to hold muscle in a recomp.'});}
  }
  return items;
}
// Goal-aware weekly stat strip (4 tiles).
function homeStrip(wkWks,wkSets,wkVol,wkCals){
  const td=today();const g=S.goal||'general';
  const fmtK=v=>v>=1000?(v/1000).toFixed(1)+'k':(Math.round(v)||0);
  const sessions={val:wkWks.length,lbl:'Sessions'};
  const curW=(S.bodyweightLog&&S.bodyweightLog[0]&&S.bodyweightLog[0].weight)||S.bodyweight||0;
  if(g==='weightloss'){
    const eb=energyBalance(td);const steps=S.stepsLog[td]||0;
    return[sessions,
      {val:steps?fmtK(steps):'0',lbl:'Steps'},
      {val:(eb.net<0?'−':'+')+fmtK(Math.abs(eb.net)),lbl:'Net so far',col:eb.net<0?'var(--green)':'var(--red)'},
      {val:curW||'–',lbl:`Weight`}];
  }
  if(g==='recomp'){
    const tot=getDayTotals(td);
    return[sessions,{val:fmtK(wkVol),lbl:'Volume'},{val:(tot.protein||0)+'g',lbl:'Protein'},{val:curW||'–',lbl:'Weight'}];
  }
  return[sessions,{val:wkSets,lbl:'Sets'},{val:fmtK(wkVol),lbl:'Volume'},{val:fmtK(wkCals),lbl:'~kcal'}];
}
// Actionable warnings shown across all goals: macro tracking + supplements not yet taken.
function homeWarnings(){
  const w=[];const td=today();const tot=getDayTotals(td);
  const loggedMacros=(tot.cals||tot.protein||tot.carbs||tot.fat);
  if(!loggedMacros)w.push({icon:'🍽️',color:'var(--gold)',bg:'var(--gdim)',border:'rgba(184,124,42,.28)',
    title:'No macros logged today',sub:'Keep your tracking honest — log meals or use Quick Log.',action:"go('nutrition')"});
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
  const tot=getDayTotals(td);const gp=(S.macroGoals||{}).protein||0;
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
  if(streak>=2)out.push({icon:'🔥',color:'var(--navy)',bg:'var(--ndim)',border:'var(--nbright)',title:`${streak}-session streak`,sub:'Rest days don’t break it. Keep it rolling.'});
  if(moCount>=2)out.push({icon:'💪',...grn,title:`${moCount} workouts this month`,sub:'Showing up is the hard part, and you’re doing it.'});
  if(g!=='weightloss'&&g!=='recomp'&&gp&&tot.protein>=gp)out.push({icon:'🥩',...grn,title:`Protein goal hit: ${tot.protein}g`,sub:'Fuel locked in for recovery.'});
  if(S.supps&&S.supps.length){const logs=S.suppLogs[td]||{};if(S.supps.filter(s=>logs[s.id]).length===S.supps.length)out.push({icon:'✅',...grn,title:'All supplements taken today',sub:'Stack complete — nice consistency.'});}
  return out;
}
// One renderer for the home intelligence feed, used with or without a routine today.
function homeFeedHTML(exIds){
  const card=f=>`<div ${f.action?`onclick="${f.action}" `:''}style="${f.action?'cursor:pointer;':''}background:${f.bg};border:1px solid ${f.border};border-radius:12px;padding:13px;margin-bottom:9px;display:flex;align-items:flex-start;gap:11px"><div style="flex-shrink:0;margin-top:1px;color:${f.color}">${ICON(f.icon,19)}</div><div style="flex:1"><div style="font-size:13px;font-weight:600;color:${f.color};letter-spacing:-.01em">${f.title}</div><div style="font-size:11px;color:var(--muted);margin-top:3px;line-height:1.5">${f.sub}</div></div>${f.action?`<div style="color:var(--muted2);font-size:17px;align-self:center;flex-shrink:0">›</div>`:''}</div>`;
  const cards=[];
  successHighlights().slice(0,2).forEach(f=>cards.push(card(f)));
  homeWarnings().forEach(f=>cards.push(card(f)));
  getPainWarnings().filter(p=>!exIds||exIds.includes(p.exId)).forEach(p=>cards.push(card({icon:'🩹',color:'var(--red)',bg:'var(--rdim)',border:'rgba(184,60,60,.2)',title:`Pain flagged — ${esc(p.name)}`,sub:`Reported in ${p.sessions} of last 3 sessions. Use lighter load, full range.`})));
  goalFeedItems().slice(0,2).forEach(f=>cards.push(card(f)));
  if(S.goal!=='weightloss'){
    const s=[];
    getProgressWins(exIds||undefined).forEach(w=>s.push({icon:'📈',color:'var(--green)',bg:'var(--grdim)',border:'rgba(45,122,82,.2)',title:`${esc(w.name)} up ${w.pct}%`,sub:`e1RM improved over last ${w.sessions} sessions — you’re building.`}));
    getPRProximity().forEach(p=>s.push({icon:'🏆',color:'var(--gold)',bg:'var(--gdim)',border:'rgba(184,124,42,.2)',title:`${p.gap}${S.unit} from your ${esc(p.name)} PR`,sub:`e1RM target: ${p.prEst}${S.unit}. Load up and go for it.`}));
    getVolumeMomentum().forEach(m=>s.push({icon:'🔥',color:'var(--navy)',bg:'var(--ndim)',border:'rgba(30,53,88,.15)',title:`${m.muscle} volume up ${m.weeks} weeks running`,sub:'Consistent overload. Keep the trend going.'}));
    (exIds?getStagnantExercises(exIds):[]).forEach(st=>s.push({icon:'📊',color:'var(--gold)',bg:'var(--gdim)',border:'rgba(184,124,42,.15)',title:`Stagnant: ${esc(st.name)}`,sub:'No e1RM progress in 3 sessions. Add weight or reps.'}));
    s.slice(0,2).forEach(f=>cards.push(card(f)));
  }
  if(!cards.length)return'';
  return`<div style="padding:0 13px;margin-bottom:4px">${cards.join('')}</div>`;
}
function renderWorkout(c){
  if(S.activeCardDeck){renderCardDeckSession(c);return;}
  if(S.activeSprintTimer){renderSprintSession(c);return;}
  if(S.activeWorkout){renderSession(c);return;}
  const td=today();window._renderedDay=td;const name=esc(S.name||'Athlete');
  const ago7=Date.now()-7*86400000;
  const wkWks=S.workouts.filter(w=>w.started>=ago7);
  const wkSets=wkWks.reduce((t,wk)=>t+doneSetCnt(wk),0);
  const wkVol=wkWks.reduce((t,wk)=>t+totalVol(wk),0);
  const wkCals=wkWks.reduce((t,wk)=>t+(wk.cals||0),0)+S.activities.filter(a=>a.date>daysAgoStr(7)).reduce((t,a)=>t+(a.cals||0),0);
  const ag=getActiveGroup();
  const todayR=getNextRoutine();
  const todayRoutines=todayR?[todayR]:[];
  const _glen=ag?Math.max(1,(ag.routineIds||[]).length):1;
  const nextLabel=(ag&&ag.mode==='rotation')?`Up Next · ${String.fromCharCode(65+((ag.cursor||0)%_glen))}`:"Today's Workout";

  let html=`<div style="padding:16px 13px 12px;display:flex;align-items:flex-start;justify-content:space-between">
    <div>
      <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:3px">${greet()}</div>
      <div style="font-size:27px;font-weight:600;line-height:1.1;letter-spacing:-.03em">${name}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
    </div>
    <button class="btn bts bxs" style="margin-top:4px;width:34px;height:34px;padding:0;border-radius:9px" onclick="showSettings()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    </button>
  </div>`;

  // Weekly stats strip (goal-aware)
  html+=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 13px 14px">
    ${homeStrip(wkWks,wkSets,wkVol,wkCals).map(s=>`<div class="stat-mini"><div class="stat-mini-val"${s.col?` style="color:${s.col}"`:''}>${s.val}</div><div class="stat-mini-lbl">${s.lbl}</div></div>`).join('')}
  </div>`;

  // Today's routine card
  if(todayRoutines.length){
    html+=`<div class="hype-section">`;
    todayRoutines.forEach(r=>{
      const lastSess=S.workouts.find(w=>w.routineId===r.id);
      const exNames=r.exercises.slice(0,4).map(e=>esc(getEx(e.exId)?.name||'')).filter(Boolean);
      const doneToday=wasRoutineDoneToday(r.id);
      html+=`<div class="routine-today"${todayRoutines.length>1?' style="margin-bottom:10px"':''}>
        <div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin-bottom:6px">${nextLabel}</div>
        <div style="font-size:22px;font-weight:700;letter-spacing:-.03em;margin-bottom:4px">${esc(r.name)}</div>
        <div style="font-size:11px;opacity:.7;margin-bottom:14px">${r.exercises.length} exercises${lastSess?` · Last done ${fmtShort(lastSess.started)}`:''}${exNames.length?` · ${exNames.slice(0,3).join(', ')}${r.exercises.length>3?'…':''}`:''}</div>
        ${doneToday
          ?`<div style="background:rgba(45,122,82,.25);border:1px solid rgba(45,122,82,.4);border-radius:10px;padding:11px;text-align:center;font-size:14px;font-weight:600;color:#fff">✓ Completed today</div>`
          :`<button class="btn" style="background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.2);width:100%;padding:11px;font-size:14px;border-radius:10px;backdrop-filter:blur(4px)" onclick="startWorkout(${jsq(r.id)})">▶  Start ${esc(r.name)}</button>`
        }
      </div>`;
    });
    html+=`</div>`;

    // Intelligence feed (encouraging wins + warnings + goal context)
    const exIds=todayR.exercises.map(e=>e.exId);
    html+=homeFeedHTML(exIds);
  }else{
    // No routine today — same unified feed (encouraging wins + warnings + goal context)
    html+=homeFeedHTML(null);
  }

  // Action buttons
  html+=`<div style="padding:4px 13px 10px;display:grid;grid-template-columns:1fr 1fr;gap:9px">
    <button class="btn btp bfw" style="padding:13px;border-radius:10px;font-size:14px" onclick="startWorkout()">+ Workout</button>
    <button class="btn bts bfw" style="padding:13px;border-radius:10px;font-size:14px" onclick="showLogActivity()">+ Activity</button>
  </div>
  <div style="padding:0 13px 14px">
    <button class="btn bts bfw" style="border-radius:10px;font-size:13px;font-weight:600;color:var(--navy);border-color:var(--nbright);background:var(--ndim)" onclick="showModes()">${ICON('⚡',15)} Modes</button>
  </div>`;

  // Other routines
  const otherRoutines=(S.routines||[]).filter(r=>r.active!==false&&!todayRoutines.find(x=>x.id===r.id));
  if(otherRoutines.length){
    html+=`<div class="sec-lbl">Other Routines</div><div class="card">`;
    otherRoutines.forEach(r=>{
      const last=S.workouts.find(w=>w.routineId===r.id);
      const names=r.exercises.slice(0,3).map(e=>esc(getEx(e.exId)?.name||'')).filter(Boolean);
      html+=`<div class="hi"><div style="flex:1">
        <div class="hn">${esc(r.name)}</div>
        <div class="hm">${r.exercises.length} exercises${last?` · ${fmtShort(last.started)}`:' · Never done'}${names.length?` · ${names.join(', ')}`:''}</div>
      </div><button class="btn btp bsm" style="flex-shrink:0" onclick="startWorkout(${jsq(r.id)})">▶</button></div>`;
    });
    html+=`</div>`;
  }

  c.innerHTML=html;
}
