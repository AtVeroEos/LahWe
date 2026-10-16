// ═══════════════════════════════════════════════════
// PROGRAMS — saved programs, where you are in one, its page and its report
// ═══════════════════════════════════════════════════
// A program is splits run in order, each for a number of weeks (S.programs). Any number can be
// saved; one runs at a time. Where you are is counted by the weeks you actually trained in it, not
// by the calendar: a week counts once you have done one of the program's workouts in it. So a
// pause, or a week away, does not use up the program, and switching to another and back picks up
// where you left off. Every workout done from a running program is stamped with it (w.prog).
const PROG_STATUS_LBL={running:'Running',paused:'Paused',saved:'Not started',finished:'Finished',archived:'Archived'};
function programById(id){return(S.programs||[]).find(p=>p.id===id)||null;}
function runningProgram(){return(S.programs||[]).find(p=>p.status==='running')||null;}
function progTotalWeeks(p){return(p.phases||[]).reduce((t,ph)=>t+(ph.weeks||1),0);}
function progGroup(ph){return ph?(S.groups||[]).find(g=>g.id===ph.groupId)||null:null;}
function progRoutineIds(p){
  const s=new Set();(p.phases||[]).forEach(ph=>{const g=progGroup(ph);if(g)(g.routineIds||[]).forEach(id=>s.add(id));});return s;
}
// Planned sessions in one week of a split.
function splitPerWeek(g){
  if(!g)return 0;
  const ids=(g.routineIds||[]).filter(id=>(S.routines||[]).some(r=>r.id===id&&r.active!==false));
  if(g.mode==='daypicker'){let n=0;ids.forEach(id=>{n+=((g.dayMap||{})[id]||[]).length;});return n||ids.length;}
  return Math.max(1,Math.min(7,g.daysPerWeek||ids.length));
}
// The workouts planned in one week of a split, each as many times as it is on the week.
function splitWeekPlan(g){
  if(!g)return[];
  const ids=(g.routineIds||[]).filter(id=>(S.routines||[]).some(r=>r.id===id&&r.active!==false));
  if(g.mode==='daypicker'){const out=[];ids.forEach(id=>{const n=((g.dayMap||{})[id]||[]).length||0;for(let i=0;i<n;i++)out.push(id);});return out.length?out:ids.slice();}
  const n=splitPerWeek(g);const out=[];for(let i=0;i<n&&ids.length;i++)out.push(ids[i%ids.length]);return out;
}
function progWorkouts(p){
  return memo('progWk:'+p.id,()=>S.workouts.filter(w=>w.prog&&w.prog.id===p.id).sort((a,b)=>a.started-b.started));
}
// Phase and week-in-phase for program week n (1-based).
function progPhaseAt(p,n){
  let acc=0;const ph=p.phases||[];
  for(let i=0;i<ph.length;i++){const w=ph[i].weeks||1;if(n<=acc+w)return{i,ph:ph[i],inPhase:n-acc,startWeek:acc+1};acc+=w;}
  return null;
}
// Everything about where you are in a program. Memoised per save.
function progState(p){
  return memo('progState:'+p.id,()=>{
    const total=progTotalWeeks(p);const wks=progWorkouts(p);
    const cur=weekStartOf(today());
    const mons=[...new Set(wks.map(w=>weekStartOf(dayOf(w.started))))].sort();
    const doneWeeks=mons.filter(m=>m<cur).length;const trainedNow=mons.includes(cur);
    let week=p.status==='running'?doneWeeks+1:Math.max(1,doneWeeks+(trainedNow?1:0));
    week=Math.max(1,Math.min(total||1,week));
    const at=progPhaseAt(p,week);
    const g=at?progGroup(at.ph):null;
    const thisWeek=wks.filter(w=>weekStartOf(dayOf(w.started))===cur).length;
    const perNow=splitPerWeek(g);
    let finished=total>0&&(doneWeeks>=total||(p.status==='running'&&week===total&&perNow>0&&thisWeek>=perNow));
    if(p.status==='finished'||p.status==='archived')finished=!!p.finishedAt||finished;
    // Week by week: the trained weeks in order are program weeks 1, 2, 3…
    const weeks=mons.map((mon,i)=>{
      const n=i+1;const a=progPhaseAt(p,Math.min(n,total||1));const gg=a?progGroup(a.ph):null;
      const ws=wks.filter(w=>weekStartOf(dayOf(w.started))===mon);
      const feels=ws.map(w=>w.feel).filter(f=>f>=1&&f<=5);
      return{n,mon,phase:a?a.i:0,planned:splitPerWeek(gg),done:ws.length,feel:feels.length?feels.reduce((t,x)=>t+x,0)/feels.length:null,
        deload:!!(a&&a.ph.deload&&a.inPhase===(a.ph.weeks||1)),current:mon===cur,wks:ws};
    });
    const closed=weeks.filter(w=>!w.current);
    const planned=closed.reduce((t,w)=>t+w.planned,0),done=closed.reduce((t,w)=>t+Math.min(w.done,w.planned||w.done),0);
    const remaining=Math.max(0,total-week);
    const finish=p.status==='running'?addDays(cur,remaining*7+6):null;
    const feels=wks.map(w=>w.feel).filter(f=>f>=1&&f<=5);
    return{total,week,phase:at,group:g,doneWeeks,trainedNow,thisWeek,perNow,finished,weeks,
      deload:!!(at&&at.ph.deload&&at.inPhase===(at.ph.weeks||1)&&p.status==='running'),
      planned,done,adherence:planned?done/planned:null,finish,sessions:wks.length,
      feel:feels.length?feels.reduce((t,x)=>t+x,0)/feels.length:null,first:wks[0]||null,last:wks[wks.length-1]||null};
  });
}
// The split the running program says should be in use. Called at start-up, after each workout and
// when the day changes. A program whose last week is done is finished here, with its report.
function resolveProgramGroup(){
  const p=runningProgram();if(!p)return;
  const st=progState(p);
  if(st.finished){finishProgram(p);return;}
  const g=st.group;
  if(g&&!g.active){(S.groups||[]).forEach(x=>{x.active=x.id===g.id;});save();}
}
// The phase in effect today, in the shape older callers expect ({groupId}).
function currentProgramPhase(){
  const p=runningProgram();if(!p)return null;const st=progState(p);
  return st.phase?{groupId:st.phase.ph.groupId,weeks:st.phase.ph.weeks,index:st.phase.i,week:st.week,weekInPhase:st.phase.inPhase}:null;
}
// Stamp a just-finished workout with the running program, if it is one of its workouts.
function progStamp(wk){
  const p=runningProgram();if(!p||!wk.routineId||!progRoutineIds(p).has(wk.routineId))return;
  const st=progState(p);
  wk.prog={id:p.id,wk:st.week,ph:st.phase?st.phase.i:0};
  if(st.deload)wk.prog.deload=true;
}
function progIsDeloadFor(rid){
  const p=runningProgram();if(!p||!rid||!progRoutineIds(p).has(rid))return false;
  return progState(p).deload;
}

// ─── Starting, pausing, switching ───
function progStart(id){
  const p=programById(id);if(!p)return;
  if(!p.phases.length){toast('Add a split to it first');showProgramEditor(id);return;}
  if(p.status==='finished'||(p.status==='archived'&&p.finishedAt)){toast('That program is finished. Run it again to start a new round.');return;}
  const cur=runningProgram();
  const go=()=>{
    if(cur&&cur!==p){cur.status='paused';cur.pausedAt=Date.now();}
    p.status='running';delete p.hidden;if(!p.startedAt)p.startedAt=Date.now();delete p.pausedAt;
    bumpMemo();resolveProgramGroup();saveNow();progRefreshAll();
    const st=progState(p);
    toast(`${p.name}: week ${st.week} of ${st.total}`,'green',cur&&cur!==p?{actions:[{label:`Hide ${cur.name}'s workouts`,fn:()=>progSetHidden(cur.id,true)}],ms:7000}:undefined);
  };
  if(cur&&cur!==p){
    const cs=progState(cur);
    customConfirm(`<b>${esc(cur.name)}</b> pauses at week ${cs.week} of ${cs.total} and keeps its place. <b>${esc(p.name)}</b> ${p.startedAt?'picks up where you left it':'starts at week 1'}.`,'Switch',go,{title:'Switch programs?',safe:true});
  }else go();
}
function progPause(id){
  const p=programById(id);if(!p||p.status!=='running')return;
  p.status='paused';p.pausedAt=Date.now();saveNow();progRefreshAll();
  toast(`${p.name} paused at week ${progState(p).week}`,'green',{action:'Undo',onAction:()=>{p.status='running';delete p.pausedAt;bumpMemo();resolveProgramGroup();saveNow();progRefreshAll();}});
}
function finishProgram(p,quiet){
  if(!p)return;
  p.status='finished';p.finishedAt=Date.now();
  try{p.report=programReport(p);}catch(e){logError(e,'program report');}
  p.reportNew=true;save();
  if(!quiet&&typeof toast==='function')toast(`${p.name} is finished`,'green',{action:'See the report',onAction:()=>showProgram(p.id),ms:8000});
}
// Hiding a program's workouts takes them off the Workouts tab and out of the pickers. They stay
// in history and come back with one tap.
function progSetHidden(id,on){
  const p=programById(id);if(!p)return;
  if(on)p.hidden=true;else delete p.hidden;
  save();progRefreshAll();
  toast(on?`${p.name}'s workouts are hidden`:`${p.name}'s workouts are back`,'green',{action:'Undo',onAction:()=>progSetHidden(id,!on)});
}
function progArchive(id,on){
  const p=programById(id);if(!p)return;
  // Archiving a running program stops it; its split stays in use until another is chosen.
  if(on){p.status='archived';p.hidden=true;}
  else{p.status=p.finishedAt?'finished':'paused';delete p.hidden;}
  save();progRefreshAll();
  toast(on?`${p.name} archived`:`${p.name} restored`,'green');
}
// Routines that belong only to hidden programs (and are not in a split in use or another program).
function hiddenRoutineIds(){
  return memo('hiddenRtn',()=>{
    const hide=new Set(),keep=new Set();
    (S.programs||[]).forEach(p=>{const ids=progRoutineIds(p);ids.forEach(id=>(p.hidden?hide:keep).add(id));});
    const ag=getActiveGroup();if(ag)(ag.routineIds||[]).forEach(id=>keep.add(id));
    (S.groups||[]).forEach(g=>{if(!(S.programs||[]).some(p=>(p.phases||[]).some(ph=>ph.groupId===g.id)))(g.routineIds||[]).forEach(id=>keep.add(id));});
    return new Set([...hide].filter(id=>!keep.has(id)));
  });
}
function progDuplicate(id){
  const p=programById(id);if(!p)return;
  const base=p.name.replace(/ \(\d+\)$/,'');
  let n=2;while((S.programs||[]).some(x=>x.name===`${base} (${n})`))n++;
  const c={id:uid(),name:`${base} (${n})`,notes:p.notes||'',phases:p.phases.map(ph=>({groupId:ph.groupId,weeks:ph.weeks,deload:!!ph.deload})),status:'saved',createdAt:Date.now()};
  S.programs.push(c);saveNow();
  closeOv('prog-ov');setTimeout(()=>showProgram(c.id),240);
  toast(`Saved as ${c.name}. It uses the same splits and workouts, so last time's weights carry over.`,'green',{ms:5000});
}
function progDelete(id){
  const p=programById(id);if(!p)return;
  const gids=new Set(p.phases.map(ph=>ph.groupId));
  const otherG=new Set();(S.programs||[]).forEach(x=>{if(x!==p)x.phases.forEach(ph=>otherG.add(ph.groupId));});
  const ownG=[...gids].filter(g=>!otherG.has(g));
  const ownR=[...progRoutineIds(p)].filter(rid=>!(S.groups||[]).some(g=>!ownG.includes(g.id)&&(g.routineIds||[]).includes(rid)));
  const ov=makeOv('pdel-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div class="mt" style="margin-bottom:4px">Delete ${esc(p.name)}?</div>
    <div class="sheet-sub">Logged workouts always stay in History.</div>
    <button class="btn btd bfw" onclick="progDeleteNow(${jsq(id)},false)">Delete the program</button>
    ${ownG.length||ownR.length?`<button class="btn btd bfw" style="margin-top:8px" onclick="progDeleteNow(${jsq(id)},true)">Delete it with its ${ownG.length} split${ownG.length===1?'':'s'} and ${ownR.length} workout${ownR.length===1?'':'s'}</button>
    <div class="fine" style="margin-top:6px">Splits and workouts that another program or split also uses are kept.</div>`:''}
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function progDeleteNow(id,withParts){
  const p=programById(id);if(!p)return;
  closeOv('pdel-ov');closeOv('prog-ov');
  const snap=JSON.stringify({programs:S.programs,groups:S.groups,routines:S.routines});
  S.programs=S.programs.filter(x=>x!==p);
  if(withParts){
    const otherG=new Set();S.programs.forEach(x=>x.phases.forEach(ph=>otherG.add(ph.groupId)));
    const ownG=new Set(p.phases.map(ph=>ph.groupId).filter(g=>!otherG.has(g)));
    const rids=[...progRoutineIds(p)];
    S.groups=S.groups.filter(g=>!ownG.has(g.id));
    rids.forEach(rid=>{if(!S.groups.some(g=>(g.routineIds||[]).includes(rid)))S.routines=S.routines.filter(r=>r.id!==rid);});
  }
  saveNow();progRefreshAll();
  toast(`${p.name} deleted`,'green',{action:'Undo',onAction:()=>{const o=JSON.parse(snap);S.programs=o.programs;S.groups=o.groups;S.routines=o.routines;bumpMemo();saveNow();progRefreshAll();}});
}
function progRefreshAll(){
  bumpMemo();
  const c=document.getElementById('content');
  if(S.tab==='library'&&c)renderLibrary(c);else if(c&&S.tab==='workout'&&!S.activeWorkout)render();
  if(document.getElementById('prog-ov')&&_progOpen)renderProgramPage();
}

// ─── Editor: name, notes, phases ───
let _pDraft=null;
function showProgramEditor(id,opts){
  opts=opts||{};
  const p=id?programById(id):null;
  _pDraft=p?{id:p.id,name:p.name,notes:p.notes||'',phases:p.phases.map(ph=>Object.assign({},ph)),isNew:false}
    :{id:uid(),name:opts.name||'',notes:'',phases:(opts.groupIds||[]).map(g=>({groupId:g,weeks:4,deload:false})),isNew:true};
  if(!(S.groups||[]).length){
    const ov=makeOv('pedit-ov');
    ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">New program</div><div class="empty" style="padding:22px"><div class="etit" style="font-size:14px">Make a split first</div><p style="font-size:12px">A program runs weekly splits one after another. Make one, then come back.</p><button class="btn btp" style="margin-top:10px" onclick="closeOv('pedit-ov');setTimeout(showCreateGroup,230)">New split</button></div></div>`;
    document.body.appendChild(ov);attachSwipeDown(ov);return;
  }
  if(_pDraft.isNew&&!_pDraft.phases.length){const g=getActiveGroup()||S.groups[0];_pDraft.phases.push({groupId:g.id,weeks:4,deload:false});}
  let ov=document.getElementById('pedit-ov');
  if(!ov){ov=makeOv('pedit-ov');document.body.appendChild(ov);attachSwipeDown(ov);}
  renderProgramEditor();
}
function renderProgramEditor(){
  const ov=document.getElementById('pedit-ov');if(!ov||!_pDraft)return;
  const d=_pDraft;const groups=S.groups||[];
  const total=d.phases.reduce((t,ph)=>t+(ph.weeks||1),0);
  const rows=d.phases.map((ph,i)=>`<div class="pe-ph">
      <div class="pe-ph-h"><span class="pe-n">${i+1}</span>
        <select onchange="pedSet(${i},'groupId',this.value)" aria-label="Split for phase ${i+1}">${groups.map(g=>`<option value="${esc(g.id)}"${g.id===ph.groupId?' selected':''}>${esc(g.name)}</option>`).join('')}</select>
        ${d.phases.length>1?`<button class="ib" onclick="pedMove(${i},-1)" aria-label="Move up"${i===0?' disabled':''}>${ICON('arrowup',15)}</button><button class="ib delbtn" onclick="pedRemove(${i})" aria-label="Remove phase">${ICON('x',15)}</button>`:''}
      </div>
      <div class="pe-ph-c">
        <div class="pe-step"><button class="rtn-stepbtn" onclick="pedSet(${i},'weeks',${(ph.weeks||1)-1})" aria-label="Fewer weeks">−</button><span class="rtn-val">${ph.weeks||1} wk</span><button class="rtn-stepbtn" onclick="pedSet(${i},'weeks',${(ph.weeks||1)+1})" aria-label="More weeks">+</button></div>
        <label class="pe-tog"><input type="checkbox"${ph.deload?' checked':''} onchange="pedSet(${i},'deload',this.checked)"> Deload last week</label>
      </div></div>`).join('');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div>
    <div class="mt">${d.isNew?'New program':'Edit program'}</div>
    <div class="fg"><label class="fl">Name</label><input type="text" id="pe-name" maxlength="60" value="${esc(d.name)}" placeholder="e.g. AFT Mass" oninput="_pDraft.name=this.value"></div>
    <div class="fg"><label class="fl">Notes <small>optional</small></label><textarea id="pe-notes" maxlength="600" style="min-height:48px;font-size:13px" placeholder="What it is for, how to progress" oninput="_pDraft.notes=this.value">${esc(d.notes)}</textarea></div>
    <div class="sec-h sec-h-act"><span>Phases · ${total} week${total===1?'':'s'}</span><span class="sec-note">in order</span></div>
    ${rows}
    <button class="btn bts bfw" style="margin:4px 0 10px" onclick="pedAdd()">${ICON('plus',15)} Add a phase</button>
    <div class="fine" style="margin:0 0 12px">A deload week halves the working sets and keeps last week's weights. Weeks count when you train in them, so a week off does not use one up.</div>
    ${d.isNew?`<button class="btn btp bfw" onclick="pedSave(true)">Save and start</button><button class="btn bts bfw" style="margin-top:8px" onclick="pedSave(false)">Save for later</button>`
      :`<button class="btn btp bfw" onclick="pedSave(false)">Save</button>`}
  </div>`;
}
function pedSet(i,k,v){
  const ph=_pDraft&&_pDraft.phases[i];if(!ph)return;
  if(k==='weeks')ph.weeks=Math.min(52,Math.max(1,parseInt(v)||1));
  else if(k==='deload')ph.deload=!!v;
  else if(k==='groupId'&&(S.groups||[]).some(g=>g.id===v))ph.groupId=v;
  renderProgramEditor();
}
function pedMove(i,dir){const a=_pDraft.phases;const j=i+dir;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];renderProgramEditor();}
function pedRemove(i){_pDraft.phases.splice(i,1);renderProgramEditor();}
function pedAdd(){const last=_pDraft.phases[_pDraft.phases.length-1];const gs=S.groups||[];
  const next=last?gs[Math.min(gs.length-1,gs.findIndex(g=>g.id===last.groupId)+1)]:gs[0];
  _pDraft.phases.push({groupId:(next||gs[0]).id,weeks:last?last.weeks:4,deload:false});renderProgramEditor();}
function pedSave(start){
  const d=_pDraft;if(!d)return;
  const name=String(d.name||'').replace(/\s+/g,' ').trim().slice(0,60);
  if(!name){toast('Give it a name');document.getElementById('pe-name')?.focus();return;}
  if(!d.phases.length){toast('Add at least one phase');return;}
  let p=programById(d.id);
  if(!p){p={id:d.id,name,notes:'',phases:[],status:'saved',createdAt:Date.now()};S.programs.push(p);}
  p.name=name;p.notes=String(d.notes||'').trim().slice(0,600);p.phases=d.phases.map(ph=>({groupId:ph.groupId,weeks:ph.weeks,deload:!!ph.deload}));
  _pDraft=null;closeOv('pedit-ov');bumpMemo();
  if(start)progStart(p.id);else{if(p.status==='running')resolveProgramGroup();saveNow();progRefreshAll();toast('Program saved','green');}
  if(document.getElementById('prog-ov'))renderProgramPage();
  S.libTab='groups';if(S.tab==='library')renderLibrary(document.getElementById('content'));
}

// ─── Its page ───
let _progOpen=null;
function showProgram(id){
  const p=programById(id);if(!p)return;
  _progOpen=id;
  if(p.reportNew){delete p.reportNew;save();}
  let ov=document.getElementById('prog-ov');
  if(!ov){ov=makeOv('prog-ov');ov.innerHTML=`<div class="modal metric-sheet" style="max-height:94vh"><div class="mh"></div><div id="prog-body"></div></div>`;document.body.appendChild(ov);attachSwipeDown(ov);}
  renderProgramPage();
}
// A bar of the phases to scale, filled by the weeks done.
function progBarHTML(p,st){
  const total=st.total||1;
  return`<div class="ph-row">${p.phases.map((ph,i)=>{
    const start=p.phases.slice(0,i).reduce((t,x)=>t+(x.weeks||1),0);const w=ph.weeks||1;
    const done=Math.max(0,Math.min(w,(st.finished?total:st.doneWeeks)-start));
    const cur=!st.finished&&st.phase&&st.phase.i===i;
    const g=progGroup(ph);
    return`<span class="ph-seg" style="flex:${w}"><span class="ph-bar${cur?' on':''}"><i style="width:${Math.round(done/w*100)}%"></i></span>${w/total>=0.18||p.phases.length<=3?`<span class="ph-l${cur?' on':''}"><b>${esc(g?shortSplitName(g.name,p):'Removed split')}</b>${w} wk${ph.deload?' · deload':''}</span>`:''}</span>`;
  }).join('')}</div>`;
}
// "AFT Mass 2 - Build" inside AFT Mass reads as "Build".
function shortSplitName(name,p){
  const n=String(name||'');const base=String(p&&p.name||'').trim();
  if(base&&n.toLowerCase().startsWith(base.toLowerCase())){const rest=n.slice(base.length).replace(/^[\s\d]*[-–:·]\s*/,'').trim();if(rest)return rest;}
  return n;
}
function progStatusLine(p,st){
  if(p.status==='running')return`Week ${st.week} of ${st.total}${st.phase?` · ${shortSplitName((progGroup(st.phase.ph)||{}).name,p)}`:''}${st.deload?' · deload week':''}`;
  if(p.status==='paused')return`Paused at week ${st.week} of ${st.total}`;
  if(p.status==='saved')return`${st.total} week${st.total===1?'':'s'} · not started`;
  return`Finished ${p.finishedAt?fmtDay(dayOf(p.finishedAt)):''}`.trim();
}
function renderProgramPage(){
  const el=document.getElementById('prog-body');const p=programById(_progOpen);
  if(!el||!p){closeOv('prog-ov');return;}
  const st=progState(p);const r=p.report&&(p.status==='finished'||p.status==='archived')?p.report:null;
  const tp=S.testPlan&&S.testPlan.date?S.testPlan.date:null;
  let finishTxt='';
  if(st.finish){finishTxt=fmtDay(st.finish);if(tp){const d=daysBetween(st.finish,tp);finishTxt+=d>=0?` · ${d} day${d===1?'':'s'} before your test`:` · ${-d} day${d===-1?'':'s'} after your test`;}}
  const btn=(js,label,cls)=>`<button class="btn ${cls||'bts'} bsm" onclick="${js}">${label}</button>`;
  const q=jsq(p.id);
  const acts=[];
  if(p.status==='running')acts.push(btn(`progPause(${q})`,'Pause'));
  else if(p.status==='paused'||p.status==='saved')acts.push(btn(`progStart(${q})`,p.status==='paused'?'Resume':'Start','btp'));
  acts.push(btn(`showProgramEditor(${q})`,`${ICON('pencil',14)} Edit`));
  acts.push(btn(`progDuplicate(${q})`,'Run again'));
  const more=[];
  more.push(btn(`progSetHidden(${q},${p.hidden?'false':'true'})`,p.hidden?'Show its workouts':'Hide its workouts','btg'));
  if(p.status!=='running')more.push(btn(`progArchive(${q},${p.status==='archived'?'false':'true'})`,p.status==='archived'?'Restore':'Archive','btg'));
  more.push(btn(`progDelete(${q})`,'Delete','btg btg-red'));
  const stats=[];
  if(r){stats.push({v:`${r.sessions}`,l:`Workouts in ${r.weeks} weeks`},{v:r.adherence!=null?Math.round(r.adherence*100)+'%':'–',l:'Of planned workouts done'},{v:r.feel!=null?fmtFeel(r.feel):'–',l:'Average rating'});}
  else{
    stats.push({v:st.adherence!=null?Math.round(st.adherence*100)+'%':'–',l:st.planned?`${st.done} of ${st.planned} planned done`:'Planned workouts done'});
    stats.push({v:p.status==='running'?`${st.thisWeek} of ${st.perNow}`:String(st.sessions),l:p.status==='running'?'This week':'Workouts so far'});
    stats.push({v:st.feel!=null?fmtFeel(st.feel):'–',l:'Average rating'});
  }
  const sv=s=>`<div class="st"><div class="st-v">${esc(String(s.v))}</div><div class="st-l">${esc(s.l)}</div></div>`;
  el.innerHTML=`<div class="prog-top"><div style="min-width:0"><div class="mt" style="margin-bottom:2px">${esc(p.name)}</div>
      <div class="sheet-sub">${esc(progStatusLine(p,st))}${finishTxt?`<br>Finishes ${esc(finishTxt)}`:''}</div></div>
      <span class="pill ${p.status==='running'?'pill-good':p.status==='finished'?'pill-acc':''}">${PROG_STATUS_LBL[p.status]}</span></div>
    ${p.notes?`<div class="prog-notes">${esc(p.notes)}</div>`:''}
    ${p.phases.length?progBarHTML(p,st):'<div class="lc-empty">No phases yet. Edit it to add a split.</div>'}
    <div class="prog-acts">${acts.join('')}</div>
    <div class="st-grid" style="margin-top:12px">${stats.map(sv).join('')}</div>
    ${progWeeksHTML(p,st,r)}
    ${progFeelHTML(p,st,r)}
    ${progMissedHTML(p,st)}
    ${progLiftsHTML(p,st,r)}
    ${progMusclesHTML(p,st,r)}
    ${progAftHTML(p,st,r)}
    <div class="prog-more">${more.join('')}</div>
    <div class="fine">A week counts once you train in it, so weeks off do not use the program up. Planned workouts come from each split: its days for fixed-day splits, its days a week for a rotation. Ratings are the “How did it go?” you give at Finish.</div>`;
}
function fmtFeel(v){return(Math.round(v*10)/10).toFixed(1)+' / 5';}
function progWeeksHTML(p,st,r){
  const weeks=r?r.weekRows:st.weeks.map(w=>({n:w.n,mon:w.mon,done:w.done,planned:w.planned,deload:w.deload,current:w.current}));
  if(!weeks||!weeks.length)return`<div class="sec-h">Week by week</div><div class="ch-empty">${p.status==='saved'?'Start it and each week you train shows here.':'No workouts logged in it yet.'}</div>`;
  const items=weeks.map(w=>({t:dayNum(w.mon),v:w.done,hollow:!!w.current,tone:w.planned&&w.done>=w.planned?'good':w.done<w.planned&&!w.current?'warn':'',
    read:`Week ${w.n}${w.deload?' (deload)':''} · ${fmtDay(w.mon)} · ${w.done} of ${w.planned} workout${w.planned===1?'':'s'}${w.current?' so far':''}`}));
  const plan=Math.max(...weeks.map(w=>w.planned||0));
  return`<div class="sec-h">Week by week</div>${chartBars(items,{plan:plan||null,label:'Workouts each program week',fmt:v=>String(Math.round(v))})}`;
}
function progFeelHTML(p,st,r){
  const rows=r?r.weekRows.filter(w=>w.feel!=null):st.weeks.filter(w=>w.feel!=null);
  if(!S.trackFeel&&!rows.length)return'';
  if(!rows.length)return`<div class="sec-h">How it felt</div><div class="ch-empty">Rate workouts at Finish (Rough to Great) and the trend over the program shows here.</div>`;
  const pts=rows.map(w=>({t:dayNum(w.mon),v:Math.round(w.feel*10)/10,read:`Week ${w.n} · ${fmtFeel(w.feel)}${w.deload?' · deload':''}`}));
  const lbl=v=>Math.abs(v-Math.round(v))<0.01?FEEL_LABELS[Math.max(0,Math.min(4,Math.round(v)-1))]:'';
  return`<div class="sec-h sec-h-act"><span>How it felt</span><span class="sec-note">average rating each week</span></div>${chartLine(pts,{label:'Average workout rating by week',fmt:v=>lbl(v),empty:'One rated week so far. A second draws the line.'})}`;
}
// Workouts planned in a week that were not done, for the last four weeks you trained.
function progMissedHTML(p,st){
  if(p.status==='finished'||p.status==='archived'||!st.weeks.length)return'';
  const rows=[];
  st.weeks.filter(w=>!w.current).slice(-4).reverse().forEach(w=>{
    const a=progPhaseAt(p,Math.min(w.n,st.total));const plan=splitWeekPlan(a?progGroup(a.ph):null);
    const left=plan.slice();w.wks.forEach(x=>{const i=left.indexOf(x.routineId);if(i>=0)left.splice(i,1);});
    if(left.length)rows.push({t:`Week ${w.n} · ${fmtDay(w.mon)}`,s:'Missed: '+[...new Set(left)].map(id=>{const rr=S.routines.find(x=>x.id===id);return rr?shortSplitName(rr.name,p):'a workout';}).join(', '),js:`closeOv('prog-ov')`});
  });
  if(!rows.length)return'';
  return`<div class="sec-h">Missed workouts</div><div class="list">${rows.map(x=>`<div class="row"><span class="row-main"><span class="row-t">${esc(x.t)}</span><span class="row-s">${esc(x.s)}</span></span></div>`).join('')}</div>`;
}
// The lifts the program trains most: first session in it against the latest.
function progLiftRows(p){
  const wks=progWorkouts(p);if(!wks.length)return[];
  const count={};wks.forEach(w=>w.exercises.forEach(ex=>{const e=getEx(ex.exId);if(e&&e.kind!=='cardio'&&!ex.cardio){const n=ex.sets.filter(setCounts).length;if(n)count[ex.exId]=(count[ex.exId]||0)+n;}}));
  return Object.keys(count).sort((a,b)=>count[b]-count[a]).slice(0,6).map(id=>{
    const kind=exKind(id);let first=null,last=null;
    wks.forEach(w=>w.exercises.forEach(ex=>{if(ex.exId!==id)return;const b=exSessionBest(ex,kind);if(!b)return;if(!first)first={v:b.v,ds:dayOf(w.started)};last={v:b.v,ds:dayOf(w.started)};}));
    return first?{id,name:exName(id),kind,from:first.v,to:last.v,fromDs:first.ds,toDs:last.ds,sets:count[id]}:null;
  }).filter(Boolean);
}
function progLiftsHTML(p,st,r){
  const rows=r?r.lifts:progLiftRows(p);
  if(!rows||!rows.length)return'';
  return`<div class="sec-h sec-h-act"><span>Main lifts</span><span class="sec-note">first session in it → latest</span></div><div class="list">${rows.map(x=>{
    const d=x.to-x.from;const tone=d>0?'good':d===0?'flat':'warn';
    return`<button class="row row-tap" onclick="showExDetail(${jsq(x.id)})"><span class="row-main"><span class="row-t">${esc(x.name)}</span><span class="row-s">${esc(fmtKind(x.kind,x.from))} → ${esc(fmtKind(x.kind,x.to))}${x.kind==='e1rm'?' estimated max':''}</span></span>
      <span class="lib-d dl-${tone}">${d===0?'same':(d>0?'+':'−')+(x.kind==='hold'?fmtSecs(Math.abs(d)):fmt1(Math.abs(d)))}</span><span class="row-chev">${ICON('chev',16)}</span></button>`;}).join('')}</div>`;
}
// Average weekly sets per muscle over the weeks trained, against the usual weekly range.
function progMuscleAvg(p){
  const st=progState(p);const wks=progWorkouts(p);const n=Math.max(1,st.weeks.filter(w=>!w.current||w.done>=w.planned).length||1);
  const m={};Object.keys(MEV_MAV).forEach(k=>m[k]=0);
  wks.forEach(wk=>wk.exercises.forEach(ex=>{const d=ex.sets.filter(setCounts).length;if(!d)return;muscleContribs(ex.exId).forEach(c=>{m[c.muscle]+=d*c.w;});}));
  Object.keys(m).forEach(k=>{m[k]=Math.round(m[k]/n*10)/10;});
  return m;
}
function progMusclesHTML(p,st,r){
  const avg=r?r.muscles:(st.sessions?progMuscleAvg(p):null);
  if(!avg||!Object.values(avg).some(v=>v>0))return'';
  const rows=Object.keys(MEV_MAV).map(m=>({m,v:avg[m]||0,mm:MEV_MAV[m]})).sort((a,b)=>b.v-a.v);
  return`<div class="sec-h sec-h-act"><span>Sets per muscle</span><span class="sec-note">average a week</span></div>
    ${renderBodyMap(avg,{legend:true,small:true})}
    <div class="mus-grid">${rows.map(x=>{const s=bmStatus(avg,x.m);return`<button class="mus-c mus-${s}" onclick="showMuscleDetail(${jsq(x.m)})"><span>${esc(x.mm.lbl)}</span><b>${fmtSets(x.v)}</b><i>${x.mm.mev}–${x.mm.mav}</i></button>`;}).join('')}</div>`;
}
// Army Fitness events done inside the program: the latest and best of each.
function progAftRows(p){
  const out={};
  progWorkouts(p).forEach(w=>w.exercises.forEach(ex=>{
    const e=getEx(ex.exId);if(!e||!e.aft)return;const v=aftValueFromEx(e.aft,ex);if(v==null)return;
    const ev=aftEvent(e.aft);const o=out[e.aft]||(out[e.aft]={id:e.aft,name:ev.name,unit:ev.unit,dir:ev.dir,best:null,last:null});
    o.last={v,ds:dayOf(w.started)};if(o.best==null||(ev.dir==='high'?v>o.best.v:v<o.best.v))o.best={v,ds:dayOf(w.started)};
  }));
  return AFT_EVENTS.map(e=>out[e.id]).filter(Boolean);
}
function progAftHTML(p,st,r){
  const rows=r?r.aft:progAftRows(p);
  if(!rows||!rows.length)return'';
  return`<div class="sec-h">Army Fitness events</div><div class="list">${rows.map(x=>`<div class="row"><span class="row-main"><span class="row-t">${esc(x.name)}</span><span class="row-s">Latest ${esc(aftFmtRaw(x.id,x.last.v))} · ${fmtDay(x.last.ds)}</span></span><span class="aim"><span class="aim-v">${esc(aftFmtRaw(x.id,x.best.v))}</span><span class="aim-f">best</span></span></div>`).join('')}</div>`;
}
// The report kept on a finished program, so it reads the same later whatever is edited.
function programReport(p){
  bumpMemo();const st=progState(p);
  const rows=st.weeks.map(w=>({n:w.n,mon:w.mon,done:w.done,planned:w.planned,feel:w.feel,deload:w.deload}));
  const planned=rows.reduce((t,w)=>t+w.planned,0),done=rows.reduce((t,w)=>t+Math.min(w.done,w.planned||w.done),0);
  return{weeks:rows.length,sessions:st.sessions,adherence:planned?done/planned:null,feel:st.feel,weekRows:rows,
    lifts:progLiftRows(p),muscles:progMuscleAvg(p),aft:progAftRows(p),
    start:st.first?dayOf(st.first.started):null,end:st.last?dayOf(st.last.started):null};
}
// The Library card for one program.
function programCardHTML(p,big){
  const st=progState(p);const q=jsq(p.id);
  const next=p.status==='running'?getNextRoutine():null;
  return`<div class="lib-card prog-card${p.status==='running'?' on':''}" onclick="if(!event.target.closest('button'))showProgram(${q})">
    <button class="lc-main" onclick="showProgram(${q})">
      <span class="lc-row"><span class="lc-t">${esc(p.name)}</span><span class="pill ${p.status==='running'?'pill-good':p.status==='finished'?'pill-acc':''}">${p.reportNew?'Report ready':PROG_STATUS_LBL[p.status]}</span><span class="lc-chev">${ICON('chev',16)}</span></span>
      <span class="lc-s">${esc(progStatusLine(p,st))}${p.status==='running'&&st.finish?` · ends ${fmtDay(st.finish)}`:''}</span></button>
    ${big&&p.phases.length?progBarHTML(p,st):''}
    ${big&&p.status==='running'&&st.group?splitPatternHTML(st.group,{live:st.group.active}):''}
    ${p.status==='running'&&next&&!wasRoutineDoneToday(next.id)?`<div class="lc-foot"><span class="lc-next">Today: ${esc(shortSplitName(next.name,p))}</span><button class="btn btp bsm lc-go" onclick="startWorkout(${jsq(next.id)})">Start</button></div>`
      :p.status==='paused'||p.status==='saved'?`<div class="lc-foot"><span></span><button class="btn bts bsm lc-go" onclick="progStart(${q})">${p.status==='paused'?'Resume':'Start'}</button></div>`:''}
  </div>`;
}
