// ═══════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════
// History and Schedule are views inside the Progress tab (see renderProgress). These two keep the
// older call sites working: anything that used to redraw "the History tab" redraws that view.
function renderHistory(c){if(S.tab==='progress')renderProgress(c||document.getElementById('content'));}
function setHistTab(t){setProgView(t==='cal'?'schedule':'history');}
function setProgView(v){
  if(!PROG_VIEWS.includes(v))v='progress';
  S.progView=v;
  if(v==='schedule'){S.calMonth=new Date().getMonth();S.calYear=new Date().getFullYear();}
  save();
  if(S.tab!=='progress'){go('progress');return;}
  const c=document.getElementById('content');c.scrollTop=0;renderProgress(c);
}
function renderHistList(){
  const items=[];
  S.workouts.forEach(w=>items.push({type:'workout',date:w.started,data:w}));
  S.activities.forEach(a=>items.push({type:'activity',date:dayDate(a.date).getTime(),data:a}));
  items.sort((a,b)=>b.date-a.date);
  if(!items.length)return`<div class="empty"><div style="margin-bottom:12px;color:var(--muted2)">${ICON('clipboard',34)}</div><div class="etit">Nothing logged yet</div><p style="font-size:12px">Workouts and activities appear here</p></div>`;
  let html=`<div class="card" style="margin-top:10px">`;
  items.forEach(item=>{
    if(item.type==='workout'){const wk=item.data;html+=`<div class="hi" onclick="showWkDetail(${jsq(wk.id)})"><div style="flex:1"><div class="hn">${esc(wk.name)}</div><div class="hm">${fmtDate(wk.started)} · ${wk.ended?fmtDur(wk.ended-wk.started):'–'} · ${doneSetCnt(wk)} sets</div></div><div style="text-align:right;flex-shrink:0"><div class="mono" style="font-size:12px">${Math.round(totalVol(wk)).toLocaleString()}</div><div style="font-size:12px;color:var(--muted);">${S.unit}</div></div></div>`;}
    else{const a=item.data;const t=ACT_TYPES.find(x=>x.id===a.type)||{icon:'⚡',label:'Activity'};html+=`<div class="hi" onclick="showActivityDetail(${jsq(a.id)})"><div class="act-icon">${ICON(t.icon,18)}</div><div style="flex:1"><div class="hn">${t.label}${a.dist?` · ${esc(a.dist)}mi`:''}</div><div class="hm">${fmtDate(a.date+'T12:00:00')} · ${a.dur?esc(a.dur)+'min':''}${a.cals?` · ~${a.cals} kcal`:''}</div></div></div>`;}
  });
  html+=`</div>`;return html;
}
function wkDetailExHTML(wk){
  const groups=ssGroups(wk.exercises);const ssM={};groups.forEach(g=>{for(let k=g.start;k<=g.end;k++)ssM[k]=g;});
  let html='';
  wk.exercises.forEach((ex,exi)=>{
    const done=ex.sets.map((s,si)=>({s,si})).filter(x=>x.s.done);
    const work=done.filter(x=>!x.s.warmup).length;
    const inSS=ssM[exi];const isStart=inSS&&inSS.start===exi;const isEnd=inSS&&inSS.end===exi;
    if(isStart){const cnt=inSS.end-inSS.start+1;html+=`<div style="border-left:3px solid var(--navy);padding-left:8px;margin:4px 0"><div style="font-size:12px;font-weight:600;color:var(--navy);margin-bottom:2px">${ssLabel(cnt)}</div>`;}
    html+=`<div class="wsr"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">${esc(exName(ex.exId))}</div>
      <div class="set-chips">${done.map(({s,si})=>{
        const label=ex.timed?`${esc(s.r||0)}s`:`${s.w?esc(s.w)+'×':''}${esc(s.r||0)}`;
        const cls='set-chip'+(s.warmup?' warm':'')+(s.excl?' excl':'');
        const tap=s.warmup||ex.timed?'':` onclick="toggleSetExcluded(${jsq(wk.id)},${exi},${si})"`;
        return`<span class="${cls}"${tap}>${s.warmup?'W ':''}${label}${s.tag?` · ${esc(s.tag)}`:''}</span>`;
      }).join('')||'<span style="font-size:12px;color:var(--muted2)">no completed sets</span>'}</div>
    </div><div class="mono" style="font-size:12px;color:var(--muted);flex-shrink:0;margin-left:8px">${work} set${work===1?'':'s'}</div></div>`;
    if(isEnd)html+=`</div>`;
  });
  return html;
}
function showWkDetail(id){
  const wk=S.workouts.find(w=>w.id===id);if(!wk)return;
  const exHtml=wkDetailExHTML(wk);
  const hasWeighted=wk.exercises.some(ex=>!ex.timed&&ex.sets.some(s=>s.done&&!s.warmup));
  const ov=makeOv('wk-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">${esc(wk.name)}</div>
    <div class="sgrid" style="border-radius:10px;overflow:hidden;border:1px solid var(--border);margin-bottom:13px">
      <div class="sc"><div class="sv" style="font-size:12px">${fmtDate(wk.started)}</div><div class="slb">Date</div></div>
      <div class="sc"><div class="sv">${wk.ended?fmtDur(wk.ended-wk.started):'–'}</div><div class="slb">Duration</div></div>
      <div class="sc"><div class="sv">${Math.round(totalVol(wk)).toLocaleString()}</div><div class="slb">Vol (${S.unit})</div></div>
      <div class="sc"><div class="sv">${wk.cals||'–'}</div><div class="slb">~kcal${wk.calsCapped?' (capped)':''}</div></div>
    </div>
    ${wk.notes?`<div style="background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:9px 12px;margin-bottom:12px;font-size:12px;color:var(--muted);line-height:1.5;white-space:pre-wrap">${esc(wk.notes)}</div>`:''}
    <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:7px">Exercises</div>
    <div id="wk-ex-list" style="border:1px solid var(--border);border-radius:10px;padding:0 12px;margin-bottom:${hasWeighted?'6':'13'}px">${exHtml||'<div style="padding:10px;color:var(--muted);font-size:12px">No exercises</div>'}</div>
    ${hasWeighted?`<div style="font-size:12px;color:var(--muted2);margin-bottom:13px;line-height:1.45">Logged a typo? Tap a set to leave it out of PRs and strength charts. Tap again to count it.</div>`:''}
    <button class="btn btd bfw" onclick="confirmDeleteWk(${jsq(id)})">Delete Workout</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('wk-ov')">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
// Leave a logged set out of PRs and strength history (or put it back). The set stays in the
// workout; this is how a mistyped weight stops being a "record".
function toggleSetExcluded(wkId,exi,si){
  const wk=S.workouts.find(w=>w.id===wkId);const s=wk&&wk.exercises[exi]&&wk.exercises[exi].sets[si];if(!s)return;
  if(s.excl)delete s.excl;else s.excl=true;
  rebuildPRs();save();
  const list=document.getElementById('wk-ex-list');if(list)list.innerHTML=wkDetailExHTML(wk);
  toast(s.excl?'Set excluded from PRs and charts':'Set counts again',s.excl?'gold':'green');
}
function confirmDeleteWk(id){customConfirm('Permanently delete this workout? Any PRs set in it are removed too.','Delete workout',()=>{S.workouts=S.workouts.filter(w=>w.id!==id);rebuildPRs();saveNow();closeOv('wk-ov');closeOv('pr-ov');render();});}
function showActivityDetail(id){
  const a=S.activities.find(x=>x.id===id);if(!a)return;
  const t=ACT_TYPES.find(x=>x.id===a.type)||{icon:'⚡',label:'Activity'};
  const ov=makeOv('ad-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div style="margin-bottom:6px;color:var(--navy)">${ICON(t.icon,30)}</div><div class="mt">${t.label}</div>
    <div class="sgrid" style="border-radius:10px;overflow:hidden;border:1px solid var(--border);margin-bottom:13px">
      <div class="sc"><div class="sv" style="font-size:12px">${fmtDate(a.date+'T12:00:00')}</div><div class="slb">Date</div></div>
      ${a.dist?`<div class="sc"><div class="sv">${esc(a.dist)}${a.distEst?'*':''}</div><div class="slb">Miles</div></div>`:''}
      ${a.dur?`<div class="sc"><div class="sv">${esc(a.dur)}${a.durEst?'*':''}</div><div class="slb">Min</div></div>`:''}
      ${a.cals?`<div class="sc"><div class="sv">${a.cals}</div><div class="slb">~kcal</div></div>`:''}
    </div>
    ${a.notes?`<div style="background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:9px 12px;margin-bottom:12px;font-size:12px;color:var(--muted);white-space:pre-wrap">${esc(a.notes)}</div>`:''}
    ${a.distEst||a.durEst?`<div style="font-size:12px;color:var(--muted2);margin-bottom:10px">* estimated from the value you entered</div>`:''}
    <button class="btn btd bfw" onclick="deleteActivity(${jsq(id)})">Delete Activity</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('ad-ov')">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function deleteActivity(id){customConfirm('Remove this activity?','Delete',()=>{S.activities=S.activities.filter(a=>a.id!==id);save();document.getElementById('ad-ov')?.remove();renderHistory(document.getElementById('content'));});}

// ─── Calendar ───
function groupName(gid){return esc(((S.groups||[]).find(g=>g.id===gid)||{}).name||'(deleted split)');} // returns escaped text
function programBanner(){
  const p=S.program;
  if(!p||!p.active||!p.phases||!p.phases.length){
    return`<div style="padding:9px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:12px;color:var(--muted)">No timed program running</div>
      <button class="btn bts bxs" onclick="showProgramEditor()">Set Up Program</button>
    </div>`;
  }
  const wins=programPhaseWindows();
  const td=today();
  const phase=currentProgramPhase(td);
  const lastEnd=wins.length?wins[wins.length-1].end:td;
  const ended=td>=lastEnd;
  let body;
  if(ended){
    body=`<div style="font-size:13px;font-weight:600;color:var(--muted)">Program complete</div>
      <div style="font-size:12px;color:var(--muted);margin-top:2px">Ended ${fmtDay(lastEnd)}</div>`;
  }else if(phase){
    const idx=wins.findIndex(w=>w.start===phase.start); // `phase` comes from a separate call, so match by value
    const daysLeft=daysBetween(td,phase.end);
    const total=daysBetween(phase.start,phase.end);
    const dayIn=total-daysLeft;
    const pct=Math.min(100,Math.round((dayIn/total)*100));
    const nextPhase=wins[idx+1];
    body=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
        <div style="font-size:13px;font-weight:600">Phase ${idx+1}/${wins.length}: ${groupName(phase.groupId)}</div>
        <div style="font-size:12px;color:var(--muted)">${daysLeft}d left</div>
      </div>
      <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--navy)"></div></div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">${fmtDay(phase.start)} → ${fmtDay(addDays(phase.end,-1))}${nextPhase?` · next: ${groupName(nextPhase.groupId)}`:' · final phase'}</div>`;
  }else{
    // Program starts in the future
    const firstStart=wins[0].start;
    body=`<div style="font-size:13px;font-weight:600">Program starts ${fmtDay(firstStart)}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:2px">${wins.length} phases queued</div>`;
  }
  return`<div style="padding:11px 16px;border-bottom:1px solid var(--border);background:var(--ndim)">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <div style="flex:1">${body}</div>
      <button class="btn btg bxs" onclick="showProgramEditor()" style="flex-shrink:0">Edit</button>
    </div>
  </div>`;
}
let _progDraft=null;
function showProgramEditor(){
  // Load existing program into a draft, or start a fresh one
  _progDraft=S.program?JSON.parse(JSON.stringify(S.program)):{active:true,startDate:today(),phases:[]};
  if(!_progDraft.startDate)_progDraft.startDate=today();
  if(!_progDraft.phases)_progDraft.phases=[];
  renderProgramEditor();
}
function renderProgramEditor(){
  let ov=document.getElementById('prog-ov');
  if(!ov){ov=makeOv('prog-ov');document.body.appendChild(ov);attachSwipeDown(ov);}
  const groups=S.groups||[];
  if(!groups.length){
    ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Timed Program</div>
      <div class="empty" style="padding:24px"><div style="font-size:30px;margin-bottom:8px">📋</div><div class="etit" style="font-size:14px">No splits yet</div><p style="font-size:12px">Make a weekly split first, then run splits one after another as a timed program.</p></div>
      <button class="btn btg bfw" style="margin-top:9px" onclick="closeOv('prog-ov')">Close</button></div>`;
    return;
  }
  const wins=programPhaseWindows(_progDraft);
  let phaseRows='';
  _progDraft.phases.forEach((ph,i)=>{
    const win=wins[i];
    const dateLbl=win?`${fmtDay(win.start)} → ${fmtDay(addDays(win.end,-1))}`:'';
    phaseRows+=`<div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px">
        <div style="font-size:12px;font-weight:700;color:var(--muted)">PHASE ${i+1}</div>
        <div style="display:flex;gap:4px">
          <button class="ib" style="font-size:13px" onclick="moveProgPhase(${i},-1)">↑</button>
          <button class="ib" style="font-size:13px" onclick="moveProgPhase(${i},1)">↓</button>
          <button class="ib delbtn" style="font-size:12px" onclick="removeProgPhase(${i})">✕</button>
        </div>
      </div>
      <select onchange="setProgPhaseGroup(${i},this.value)" style="margin-bottom:7px">
        ${groups.map(g=>`<option value="${esc(g.id)}"${ph.groupId===g.id?' selected':''}>${esc(g.name)}</option>`).join('')}
      </select>
      <div style="display:flex;gap:6px;margin-bottom:7px">
        <button class="chip${ph.mode!=='until'?' on':''}" onclick="setProgPhaseMode(${i},'weeks')">For X weeks</button>
        <button class="chip${ph.mode==='until'?' on':''}" onclick="setProgPhaseMode(${i},'until')">Until date</button>
      </div>
      ${ph.mode==='until'
        ?`<input type="date" value="${ph.untilDate||''}" onchange="setProgPhaseUntil(${i},this.value)">`
        :`<div style="display:flex;align-items:center;gap:8px">
            <button class="btn bts bsm" onclick="adjProgWeeks(${i},-1)" style="width:36px">−</button>
            <div class="mono" style="font-size:15px;font-weight:600;width:64px;text-align:center">${ph.weeks||1} wk${(ph.weeks||1)>1?'s':''}</div>
            <button class="btn bts bsm" onclick="adjProgWeeks(${i},1)" style="width:36px">+</button>
          </div>`}
      ${dateLbl?`<div style="font-size:12px;color:var(--muted);margin-top:6px">${dateLbl}</div>`:''}
    </div>`;
  });
  ov.innerHTML=`<div class="modal" style="max-height:90vh;overflow-y:auto"><div class="mh"></div>
    <div class="mt">Timed Program</div>
    <div style="font-size:12px;color:var(--muted);margin:-8px 0 12px">Splits in sequence. Each phase puts its split in use for the time you set, then the next phase takes over.</div>
    <div class="fg"><label class="fl">Program Start</label><input type="date" id="prog-start" value="${_progDraft.startDate}" onchange="setProgStart(this.value)"></div>
    ${phaseRows||'<div style="text-align:center;padding:16px;color:var(--muted);font-size:13px">No phases yet — add one below.</div>'}
    <button class="btn bts bfw" style="margin-top:4px" onclick="addProgPhase()">+ Add Phase</button>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btp" style="flex:1" onclick="saveProgram()">Save Program</button>
      ${S.program?`<button class="btn btd bsm" onclick="clearProgram()">Stop</button>`:''}
    </div>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('prog-ov')">Cancel</button>
  </div>`;
}
function setProgStart(v){if(v)_progDraft.startDate=v;renderProgramEditor();}
function addProgPhase(){
  const firstGroup=(S.groups||[])[0];
  _progDraft.phases.push({groupId:firstGroup?firstGroup.id:null,mode:'weeks',weeks:4,untilDate:''});
  renderProgramEditor();
}
function removeProgPhase(i){_progDraft.phases.splice(i,1);renderProgramEditor();}
function moveProgPhase(i,dir){const j=i+dir;if(j<0||j>=_progDraft.phases.length)return;const p=_progDraft.phases;[p[i],p[j]]=[p[j],p[i]];renderProgramEditor();}
function setProgPhaseGroup(i,gid){_progDraft.phases[i].groupId=gid;renderProgramEditor();}
function setProgPhaseMode(i,m){_progDraft.phases[i].mode=m;if(m==='weeks'&&!_progDraft.phases[i].weeks)_progDraft.phases[i].weeks=4;renderProgramEditor();}
function setProgPhaseUntil(i,v){_progDraft.phases[i].untilDate=v;renderProgramEditor();}
function adjProgWeeks(i,d){_progDraft.phases[i].weeks=Math.max(1,(_progDraft.phases[i].weeks||1)+d);renderProgramEditor();}
function saveProgram(){
  if(!_progDraft.phases.length){toast('Add at least one phase');return;}
  if(_progDraft.phases.some(p=>!p.groupId)){toast('Every phase needs a split');return;}
  if(_progDraft.phases.some(p=>p.mode==='until'&&!p.untilDate)){toast('Set a date for each "until" phase');return;}
  _progDraft.active=true;
  S.program=_progDraft;
  resolveProgramGroup();
  save();closeOv('prog-ov');
  toast('Program saved','green');
  renderHistory(document.getElementById("content"));
}
function clearProgram(){
  customConfirm('Stop the timed program? Your splits stay; they just stop switching by themselves.','Stop',()=>{
    S.program=null;save();closeOv('prog-ov');
    toast('Program stopped','green');renderHistory(document.getElementById("content"));
  });
}
function renderCalendar(){
  const yr=S.calYear,mo=S.calMonth;
  const first=new Date(yr,mo,1).getDay();const days=new Date(yr,mo+1,0).getDate();
  const wkMap={};
  S.workouts.forEach(w=>{const ds=dayOf(w.started);if(!wkMap[ds])wkMap[ds]={w:0,a:0};wkMap[ds].w++;});
  S.activities.forEach(a=>{if(!wkMap[a.date])wkMap[a.date]={w:0,a:0};wkMap[a.date].a++;});
  const td=today();const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const calGoal=(S.macroGoals||{}).cals||0;
  // Planned routine dots for future days
  const routineDays={};
  (S.routines||[]).forEach(r=>{(r.days||[]).forEach(d=>{if(!routineDays[d])routineDays[d]=[];routineDays[d].push(r.name);});});

  let html=programBanner();
  html+=`<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-bottom:1px solid var(--border)">
    <button class="btn btg bsm" onclick="adjCal(-1)">‹</button>
    <div style="font-size:15px;font-weight:600;letter-spacing:-.01em">${months[mo]} ${yr}</div>
    <button class="btn btg bsm" onclick="adjCal(1)">›</button>
  </div>
  <div class="cal-grid">
    ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=>`<div class="cal-day-hdr">${d}</div>`).join('')}`;
  for(let i=0;i<first;i++)html+=`<div class="cal-cell empty"></div>`;
  for(let d=1;d<=days;d++){
    const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const data=wkMap[ds]||{w:0,a:0};const isToday=ds===td;const isRest=!isTrainingDay(ds);
    const dow=dayDate(ds).getDay();const hasPlanned=((routineDays[dow]?.length>0)||plannedRoutinesForDow(dow).length>0)&&ds>=td&&!isRest;
    const ovRid=S.schedule.routineOverrides&&S.schedule.routineOverrides[ds];
    const hasRoutineOverride=ovRid&&ovRid!=='rest';
    const isRestOverride=ovRid==='rest';
    // Calorie goal indicator
    let goalTri='';
    if(calGoal&&ds<=td){
      const dayGoal=goalsFor(ds).cals||calGoal; // that day's own target (training or rest)
      const dayCals=getDayTotals(ds).cals||0;
      if(dayCals>0){
        const over=dayCals>dayGoal;
        const within=Math.abs(dayCals-dayGoal)/dayGoal<=0.05;
        const col=within?'var(--green)':over?'var(--red)':'var(--navy)';
        goalTri=`<div class="cal-goal-tri" style="border-color:transparent ${col} transparent transparent" title="${Math.round(dayCals)} / ${dayGoal} kcal"></div>`;
      }
    }
    html+=`<div class="cal-cell${isToday?' today':''}${(isRest||isRestOverride)?' rest-day':''}" onclick="calDayTap('${ds}')">
      ${goalTri}
      <div class="cal-date" style="font-size:${isToday?'11px':'12px'}">${d}</div>
      <div class="cal-dots">
        ${Array(data.w).fill(0).map(()=>`<div class="cal-dot" style="background:var(--navy)"></div>`).join('')}
        ${Array(data.a).fill(0).map(()=>`<div class="cal-dot" style="background:var(--gold)"></div>`).join('')}
        ${hasPlanned&&!data.w?`<div class="cal-dot" style="background:var(--border);border:1px solid var(--navy)"></div>`:''}
        ${hasRoutineOverride&&!data.w?`<div class="cal-dot" style="background:var(--blue);border:1px solid var(--blue)"></div>`:''}
        ${(isRest||isRestOverride)&&!data.w?`<div style="font-size:7px;color:var(--muted2)">–</div>`:''}
      </div>
    </div>`;
  }
  html+=`</div>
  <div style="padding:10px 16px;display:flex;gap:14px;font-size:12px;font-weight:600;color:var(--muted)">
    <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--navy);margin-right:4px"></span>Workout</span>
    <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--gold);margin-right:4px"></span>Activity</span>
    <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:transparent;border:1px solid var(--navy);margin-right:4px"></span>Planned</span>
    <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--border);margin-right:4px"></span>Rest</span>
  </div>
  ${calGoal?`<div style="padding:0 16px 10px;display:flex;gap:14px;font-size:12px;font-weight:600;color:var(--muted)">
    <span><span style="display:inline-block;width:8px;height:8px;background:var(--green);margin-right:4px"></span>On goal</span>
    <span><span style="display:inline-block;width:8px;height:8px;background:var(--navy);margin-right:4px"></span>Under</span>
    <span><span style="display:inline-block;width:8px;height:8px;background:var(--red);margin-right:4px"></span>Over</span>
  </div>`:''}`;
  return html;
}
function adjCal(d){S.calMonth+=d;if(S.calMonth>11){S.calMonth=0;S.calYear++;}if(S.calMonth<0){S.calMonth=11;S.calYear--;}renderHistory(document.getElementById('content'));}
function calDayTap(ds){
  const isRest=!isTrainingDay(ds);
  const ovRid=S.schedule.routineOverrides&&S.schedule.routineOverrides[ds];
  const ovLabel=ovRid==='rest'?'Rest (override)':ovRid?(S.routines||[]).find(r=>r.id===ovRid)?.name||'Custom':null;
  const ov=makeOv('cal-tap-ov');
  ov.innerHTML=`<div class="modal" style="max-height:380px"><div class="mh"></div>
    <div style="font-size:14px;font-weight:600;margin-bottom:5px">${fmtDate(ds+'T12:00:00')}</div>
    <div style="font-size:12px;color:${isRest?'var(--muted)':'var(--green)'};font-weight:600;margin-bottom:4px">${isRest?'Rest Day':'Training Day'}</div>
    ${ovLabel?`<div style="font-size:12px;color:var(--blue);font-weight:500;margin-bottom:12px">Override active: ${esc(ovLabel)}</div>`:'<div style="margin-bottom:12px"></div>'}
    <button class="btn bts bfw" style="margin-bottom:9px" onclick="closeOv('cal-tap-ov');showRoutineOverridePicker('${ds}')">Set the workout for this day</button>
    <button class="btn bts bfw" style="margin-bottom:9px" onclick="closeOv('cal-tap-ov');toggleDayOverride('${ds}')">${isRest?'Mark as Active':'Mark as Rest'}</button>
    ${ds<=today()?`<button class="btn btp bfw" style="margin-bottom:9px" onclick="closeOv('cal-tap-ov');showLogActivity('${ds}')">+ Log Activity</button>`:''}
    <button class="btn btg bfw" onclick="closeOv('cal-tap-ov')">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function showRoutineOverridePicker(ds){
  const ov=makeOv('rov-ov');
  const current=S.schedule.routineOverrides&&S.schedule.routineOverrides[ds];
  const activeRoutines=(S.routines||[]).filter(r=>r.active!==false);
  ov.innerHTML=`<div class="modal" style="max-height:75vh"><div class="mh"></div>
    <div class="mt">Routine for ${fmtDay(ds)}</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">Changes the workout for this date only. Your usual schedule stays as it is.</div>
    <button class="btn ${!current?'btp':'bts'} bfw" style="margin-bottom:8px" onclick="setRoutineOverride('${ds}',null)">Use Default Schedule</button>
    <button class="btn ${current==='rest'?'btd':'bts'} bfw" style="margin-bottom:8px" onclick="setRoutineOverride('${ds}','rest')">Rest Day</button>
    ${activeRoutines.map(r=>`<button class="btn ${current===r.id?'btp':'bts'} bfw" style="margin-bottom:8px" onclick="setRoutineOverride('${ds}',${jsq(r.id)})">${esc(r.name)}</button>`).join('')}
    <button class="btn btg bfw" style="margin-top:4px" onclick="closeOv('rov-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function setRoutineOverride(ds,rid){
  if(!S.schedule.routineOverrides)S.schedule.routineOverrides={};
  if(rid===null)delete S.schedule.routineOverrides[ds];
  else S.schedule.routineOverrides[ds]=rid;
  save();
  document.getElementById('rov-ov')?.remove();
  renderHistory(document.getElementById('content'));
  if(ds===today())render();
  toast('Schedule updated','green');
}
function toggleDayOverride(ds){
  const isTrain=isTrainingDay(ds);
  S.schedule.overrides[ds]=isTrain?'rest':'active';
  save();renderHistory(document.getElementById('content'));
}
