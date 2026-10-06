// ═══════════════════════════════════════════════════
// SUPERSET LINKING
// ═══════════════════════════════════════════════════
function ssLabel(count){return count===2?'Superset':count===3?'Triset':'Giant Set';}
// Get superset groups from an exercise array as [{link,start,end}]
function ssGroups(exercises){
  const groups=[];let i=0;
  while(i<exercises.length){
    const lk=exercises[i].link;
    if(lk){
      let j=i+1;while(j<exercises.length&&exercises[j].link===lk)j++;
      if(j-i>=2)groups.push({link:lk,start:i,end:j-1});
      i=j;
    }else{i++;}
  }
  return groups;
}
// Toggle link between exercise i and i+1 in a routine
// Shared by the routine editor and the live session.
function toggleLinkAt(arr,i){
  if(i<0||i>=arr.length-1)return;
  const a=arr[i],b=arr[i+1];
  if(a.link&&a.link===b.link){
    // Unlink: if the group has more than two members, only detach `a`
    const members=arr.filter(e=>e.link===a.link);
    if(members.length>2){a.link=null;}
    else{a.link=null;b.link=null;}
  }else{
    // Link: join b's group, extend a's group, or start a new one
    if(b.link){a.link=b.link;}
    else if(a.link){b.link=a.link;}
    else{const lk='ss-'+uid();a.link=lk;b.link=lk;}
  }
  cleanLinks(arr);
}
// A superset only exists between neighbours: drop links left stranded by a reorder or removal.
function cleanLinks(arr){
  arr.forEach((ex,i)=>{
    if(!ex.link)return;
    const prev=i>0&&arr[i-1].link===ex.link;
    const next=i<arr.length-1&&arr[i+1].link===ex.link;
    if(!prev&&!next)ex.link=null;
  });
}
function toggleRtnLink(rid,i){
  const L=rtnList(rid);if(!L)return;
  toggleLinkAt(L.arr,i);
  if(L.persist)save();rtnRerender(rid);
}
// Toggle link between exercise ei and ei+1 in active workout
function toggleSessionLink(ei){
  if(!S.activeWorkout)return;
  toggleLinkAt(S.activeWorkout.exercises,ei);
  save();renderSession(document.getElementById('content'));
}
// Check if exercise at index ei is the last in its superset group
function isLastInSuperset(ei){
  if(!S.activeWorkout)return true;
  const arr=S.activeWorkout.exercises;
  const lk=arr[ei]?.link;if(!lk)return true;
  // Find the last exercise in this link group
  let lastIdx=ei;
  for(let j=ei+1;j<arr.length;j++){if(arr[j].link===lk)lastIdx=j;else break;}
  return ei===lastIdx;
}

function renderLibEquipment(){
  const cur=S.equipPreset||'full';
  let html=`<div style="padding:10px 13px 4px"><div style="font-size:12px;color:var(--muted);margin-bottom:10px">Select what's available at your gym to filter exercises throughout the app.</div>
    <div style="display:grid;gap:8px">`;
  EQUIPMENT_PRESETS.forEach(p=>{
    html+=`<div class="eq-preset${p.id===cur?' on':''}" onclick="setLibEquipPreset('${p.id}')">
      <div style="flex-shrink:0;color:var(--navy)">${ICON(p.icon,22)}</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:600">${esc(p.label)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:1px">${p.eqs?p.eqs.join(', '):'All equipment'}</div></div>
      ${p.id===cur?`<div style="color:var(--navy);font-size:14px">✓</div>`:''}
    </div>`;
  });
  html+=`</div></div>`;return html;
}
function setLibEquipPreset(id){S.equipPreset=id;save();renderLibrary(document.getElementById('content'));}
// ─── Rich routine-exercise config (shared by create + edit) ───
// Resolves whether we're editing a live draft (create modal) or a saved routine.
function rtnList(rid){
  if(window._rDraft&&window._rDraft.id===rid)return{arr:window._rDraft.exercises,persist:false};
  const r=(S.routines||[]).find(x=>x.id===rid);
  return r?{arr:(r.exercises||(r.exercises=[])),persist:true}:null;
}
const RTN_TYPES=[['flat','Straight'],['ascend','Pyramid'],['descend','Drop']];
function fmtRest(v){const s=(v==null?(S.restDur||90):v);return s>=60?`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`:`${s}s`;}
// How the reps box is read: plain reps (optionally a range), as-many-as-possible, or seconds.
const RTN_MODES=[['reps','Reps'],['amrap','AMRAP'],['time','Time']];
function rtnMode(e){return e.timed?'time':e.amrap?'amrap':'reps';}
function rtnRowHTML(e,i,rid,draggable,isLast){
  const sets=e.sets==null?3:e.sets;
  const type=e.type||'flat';
  const mode=rtnMode(e);
  const L=rtnList(rid);const arr=L?L.arr:[];
  const nextLinked=!isLast&&arr[i+1]&&e.link&&arr[i+1].link===e.link;
  const q=jsq(rid);
  const num=(cls,val,ph,fn,label)=>`<input class="${cls}" type="number" inputmode="numeric" min="0" placeholder="${ph}" value="${esc(val||'')}" aria-label="${label}" onchange="${fn}(${q},${i},this.value)">`;
  const target=mode==='time'
    ?`${num('rtn-reps',e.r,'sec','rtnReps','Seconds')}<span class="rtn-dash">–</span>${num('rtn-reps',e.rMax,'max','rtnRepsMax','Longest, seconds')}<span class="rtn-unit">sec</span>`
    :mode==='amrap'
    ?`${num('rtn-reps',e.r,'min','rtnReps','Minimum reps')}<span class="rtn-unit">+ reps</span>`
    :`${num('rtn-reps',e.r,'–','rtnReps','Reps')}<span class="rtn-dash">–</span>${num('rtn-reps',e.rMax,'max','rtnRepsMax','Top of the rep range')}`;
  return `<div class="rtn-ex rd-ex-row" data-idx="${i}">
    <div style="display:flex;align-items:center;gap:8px">
      ${draggable?`<div class="drag-handle" data-drag="${i}" style="cursor:grab">⣿</div>`:''}
      <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600">${esc(exName(e.exId))}</div>
        <div class="rtn-sum" id="rtn-sum-${i}">${esc(fmtTarget(e))}</div></div>
      <button class="ib delbtn" onclick="rtnRemove(${q},${i})" aria-label="Remove exercise">✕</button>
    </div>
    <div class="rtn-ctl">
      <div class="rtn-grp"><span class="rtn-lbl">Sets</span><div class="rtn-grp-row">
        <button class="rtn-stepbtn" onclick="rtnAdjSets(${q},${i},-1)" aria-label="Fewer sets">−</button>
        <span class="rtn-val" style="min-width:24px">${sets>0?sets:'—'}</span>
        <button class="rtn-stepbtn" onclick="rtnAdjSets(${q},${i},1)" aria-label="More sets">+</button>
      </div></div>
      <div class="rtn-grp"><span class="rtn-lbl">Rest</span><div class="rtn-grp-row">
        <button class="rtn-stepbtn" onclick="rtnAdjRest(${q},${i},-15)" aria-label="Less rest">−</button>
        <span class="rtn-val">${fmtRest(e.rest)}</span>
        <button class="rtn-stepbtn" onclick="rtnAdjRest(${q},${i},15)" aria-label="More rest">+</button>
      </div></div>
    </div>
    <div class="rtn-ctl">
      <div class="rtn-grp"><span class="rtn-lbl">Target</span>
        <div class="rtn-type">${RTN_MODES.map(([v,lbl])=>`<button class="${mode===v?'on':''}" onclick="rtnSetMode(${q},${i},'${v}')">${lbl}</button>`).join('')}</div>
      </div>
      <div class="rtn-grp"><span class="rtn-lbl">${mode==='time'?'Hold':mode==='amrap'?'At least':'Reps (range optional)'}</span><div class="rtn-grp-row">${target}</div></div>
    </div>
    <div class="rtn-ctl">
      <div class="rtn-grp"><span class="rtn-lbl">Set type</span>
        <div class="rtn-type">${RTN_TYPES.map(([v,lbl])=>`<button class="${type===v?'on':''}" onclick="rtnType(${q},${i},'${v}')">${lbl}</button>`).join('')}</div>
      </div>
      ${!isLast?`<button class="ss-link-btn${nextLinked?' linked':''}" style="margin-left:auto;align-self:flex-end" onclick="toggleRtnLink(${q},${i})">${nextLinked?'⛓ Unlink':'⛓ Link ↓'}</button>`:''}
    </div>
    <input class="rtn-note" type="text" maxlength="200" placeholder="Note — tempo, RPE, cues (optional)" value="${esc(e.note||'')}" aria-label="Note" onchange="rtnNote(${q},${i},this.value)">
  </div>`;
}
function rtnRerender(rid){
  const L=rtnList(rid);if(!L)return;
  const draft=!L.persist;
  const cont=document.getElementById(draft?`r-exs-${rid}`:'rd-ex-list');
  if(!cont)return;
  if(!L.arr.length){cont.innerHTML=draft?'':'<div class="empty" style="padding:20px"><div class="etit" style="font-size:13px">No exercises</div></div>';return;}
  const groups=ssGroups(L.arr);const ssMap={};groups.forEach(g=>{for(let k=g.start;k<=g.end;k++)ssMap[k]=g;});
  let html='';
  L.arr.forEach((e,i)=>{
    const inSS=ssMap[i];const isStart=inSS&&inSS.start===i;const isEnd=inSS&&inSS.end===i;
    if(isStart){const cnt=inSS.end-inSS.start+1;html+=`<div class="rtn-ss-wrap"><div class="rtn-ss-lbl">${ssLabel(cnt)}</div>`;}
    html+=rtnRowHTML(e,i,rid,!draft,i===L.arr.length-1);
    if(isEnd)html+=`</div>`;
  });
  cont.innerHTML=html;
  if(draft){const cnt=document.getElementById('r-exs-count');if(cnt)cnt.textContent=L.arr.length;}
  if(!draft)attachRoutineDrag(rid);
}
function rtnTouch(rid,i,fn,rerender){
  const L=rtnList(rid);if(!L||!L.arr[i])return;
  fn(L.arr[i]);
  if(L.persist)save();
  if(rerender)rtnRerender(rid);
  else{const s=document.getElementById('rtn-sum-'+i);if(s)s.textContent=fmtTarget(L.arr[i]);}
}
const _posInt=v=>{const n=parseInt(v);return n>0?String(Math.min(n,9999)):'';};
function rtnAdjSets(rid,i,d){rtnTouch(rid,i,e=>{e.sets=Math.min(20,Math.max(0,(e.sets==null?3:e.sets)+d));},true);}
// Typing in a box must not rebuild the row (the next tap would land on a replaced element),
// so these only store the value and refresh the one-line summary.
function rtnReps(rid,i,v){rtnTouch(rid,i,e=>{e.r=_posInt(v);if(e.rMax&&parseInt(e.rMax)<=parseInt(e.r||0))delete e.rMax;},false);}
function rtnRepsMax(rid,i,v){rtnTouch(rid,i,e=>{const m=_posInt(v);if(m&&parseInt(m)>parseInt(e.r||0))e.rMax=m;else delete e.rMax;},false);}
function rtnNote(rid,i,v){rtnTouch(rid,i,e=>{const t=String(v||'').trim().slice(0,200);if(t)e.note=t;else delete e.note;},false);}
function rtnSetMode(rid,i,mode){
  rtnTouch(rid,i,e=>{
    const was=rtnMode(e);if(was===mode)return;
    delete e.amrap;delete e.timed;
    if(mode==='amrap'){e.amrap=true;delete e.rMax;}
    if(mode==='time')e.timed=true;
    if(was==='time'||mode==='time'){e.r='';delete e.rMax;} // 10 reps is not 10 seconds
  },true);
}
function rtnType(rid,i,t){rtnTouch(rid,i,e=>{e.type=t;},true);}
function rtnAdjRest(rid,i,d){rtnTouch(rid,i,e=>{const cur=e.rest==null?(S.restDur||90):e.rest;e.rest=Math.min(900,Math.max(0,cur+d));},true);}
function rtnRemove(rid,i){
  const L=rtnList(rid);if(!L||!L.arr[i])return;
  const before=L.arr.map(e=>({...e}));
  L.arr.splice(i,1);cleanLinks(L.arr);
  if(L.persist)save();rtnRerender(rid);
  toast('Removed '+exName(before[i].exId),'',{action:'Undo',onAction:()=>{
    const L2=rtnList(rid);if(!L2)return;
    L2.arr.splice(0,L2.arr.length,...before);if(L2.persist)save();rtnRerender(rid);
  }});
}
function showCreateRoutine(){
  const id=uid();const ov=makeOv('cr-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">New Routine</div>
    <div class="fg"><label class="fl">Name</label><input type="text" id="rn-name" maxlength="80" placeholder="e.g. Push Day A"></div>
    <div class="fg"><label class="fl">Notes</label><textarea id="rn-notes" style="min-height:55px;font-size:13px" placeholder="Cues, goals, focus areas…"></textarea></div>
    <div class="sec-lbl" style="padding:4px 0 6px">Exercises <span id="r-exs-count" style="color:var(--navy)">0</span></div>
    <div id="r-exs-${id}" style="margin-bottom:10px"></div>
    <button class="btn bts bfw" style="margin-bottom:10px" onclick="showExPicker(${jsq(id)})">+ Add Exercise</button>
    <button class="btn btp bfw" onclick="saveRoutine(${jsq(id)})">Create Routine</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('cr-ov')">Cancel</button>
  </div>`;
  window._rDraft={id,exercises:[],days:[]};
  document.body.appendChild(ov);attachSwipeDown(ov);
}

const TIMED_BY_DEFAULT=new Set(['plank','hollow-hold']);
function addExToRoutine(rid,exId){
  const newEx={exId,sets:3,w:'',r:'',type:'flat',rest:null};
  if(TIMED_BY_DEFAULT.has(exId))newEx.timed=true; // holds are counted in seconds
  // Existing saved routine (opened via detail view): persist + re-render inline.
  const saved=(S.routines||[]).find(r=>r.id===rid);
  if(saved){
    if(!saved.exercises)saved.exercises=[];
    saved.exercises.push(newEx);
    save();rtnRerender(rid);
    return;
  }
  // New routine being built (draft): update the create modal's list inline.
  if(!window._rDraft||window._rDraft.id!==rid)window._rDraft={id:rid,exercises:[],days:[]};
  window._rDraft.exercises.push(newEx);
  rtnRerender(rid);
}

function saveRoutine(id){
  const name=document.getElementById('rn-name')?.value?.trim();if(!name){toast('Enter a name');return;}
  const notes=(document.getElementById('rn-notes')?.value||'').trim();
  const draft=window._rDraft&&window._rDraft.id===id?window._rDraft:null;
  if(!draft||!draft.exercises.length){toast('Add at least one exercise');return;}
  S.routines.push({id,name,notes,exercises:draft.exercises,days:[]});
  window._rDraft=null;
  saveNow();closeOv('cr-ov');toast('Routine saved','green');renderLibrary(document.getElementById('content'));
}
function showRoutineDetail(rid){
  const r=S.routines.find(x=>x.id===rid);if(!r)return;
  const last=getLastRSess(rid);
  const ov=makeOv('rd-ov');
  function renderExList(){
    if(!r.exercises||!r.exercises.length)return '<div class="empty" style="padding:20px"><div class="etit" style="font-size:13px">No exercises</div></div>';
    const groups=ssGroups(r.exercises);const ssMap={};groups.forEach(g=>{for(let k=g.start;k<=g.end;k++)ssMap[k]=g;});
    let html='';
    r.exercises.forEach((re,i)=>{
      const inSS=ssMap[i];const isStart=inSS&&inSS.start===i;const isEnd=inSS&&inSS.end===i;
      if(isStart){const cnt=inSS.end-inSS.start+1;html+=`<div class="rtn-ss-wrap"><div class="rtn-ss-lbl">${ssLabel(cnt)}</div>`;}
      html+=rtnRowHTML(re,i,rid,true,i===r.exercises.length-1);
      if(isEnd)html+=`</div>`;
    });
    return html;
  }
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
      <div style="min-width:0"><div class="mt" style="margin-bottom:4px">${esc(r.name)}</div>
        ${r.notes?`<div style="font-size:12px;color:var(--muted);margin-top:4px;white-space:pre-wrap">${esc(r.notes)}</div>`:''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn bts bsm" onclick="showRenameRoutine(${jsq(rid)})" aria-label="Rename">✎</button>
        <button class="btn btp bsm" onclick="closeOv('rd-ov');startWorkout(${jsq(rid)})">▶ Start</button>
      </div>
    </div>
    ${last?`<div style="background:var(--grdim);border:1px solid rgba(45,122,82,.15);border-radius:9px;padding:8px 12px;margin-bottom:12px;font-size:11px;color:var(--green);font-weight:600">Last session: ${fmtDate(last.started)} · ${doneSetCnt(last)} sets</div>`:''}
    <div id="rd-ex-list" style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:12px">${renderExList()}</div>
    <button class="btn bts bfw" style="margin-bottom:9px" onclick="showExPicker(${jsq(rid)})">+ Add Exercise</button>
    <button class="btn ${r.active===false?'btok':'bts'} bfw" style="margin-bottom:9px" onclick="toggleRoutineActive(${jsq(rid)})">${r.active===false?'Activate Routine':'Deactivate Routine'}</button>
    <button class="btn btd bfw" onclick="delRoutine(${jsq(rid)})">Delete Routine</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('rd-ov')">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);window._pickRid=null;
  // ── Drag-to-reorder ──
  attachRoutineDrag(rid);
}

function attachRoutineDrag(rid){
  const list=document.getElementById('rd-ex-list');if(!list)return;
  // The list element survives re-renders (only its rows are replaced). Binding again on each
  // re-render stacked handlers, and every one of them re-applied the same move on drop.
  if(list.dataset.dragBound)return;list.dataset.dragBound='1';
  const r=S.routines.find(x=>x.id===rid);if(!r)return;
  let dragIdx=null,overIdx=null,startY=0,ph=null;
  function getRows(){return Array.from(list.querySelectorAll('.rd-ex-row'));}
  list.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('[data-drag]');if(!handle)return;
    dragIdx=parseInt(handle.dataset.drag);
    const row=getRows()[dragIdx];if(!row)return;
    startY=e.clientY;
    row.style.opacity='.4';
    ph=document.createElement('div');ph.className='drag-placeholder';
    ph.style.height=row.offsetHeight+'px';
    e.target.setPointerCapture(e.pointerId);
    list.addEventListener('pointermove',onMove);
    list.addEventListener('pointerup',onUp,{once:true});
    list.addEventListener('pointercancel',onUp,{once:true});
  });
  function onMove(e){
    if(dragIdx===null)return;
    const rows=getRows();const row=rows[dragIdx];if(!row)return;
    const dy=e.clientY-startY;
    row.style.transform=`translateY(${dy}px)`;row.style.position='relative';row.style.zIndex='10';
    // Find which slot we're hovering
    rows.forEach((r,i)=>{
      if(i===dragIdx)return;
      const rect=r.getBoundingClientRect();
      if(e.clientY>rect.top&&e.clientY<rect.bottom){overIdx=i;}
    });
  }
  function onUp(){
    list.removeEventListener('pointermove',onMove);
    const rows=getRows();const row=rows[dragIdx];
    if(row){row.style.opacity='';row.style.transform='';row.style.position='';row.style.zIndex='';}
    if(dragIdx!==null&&overIdx!==null&&dragIdx!==overIdx){
      const exs=r.exercises;const [moved]=exs.splice(dragIdx,1);exs.splice(overIdx,0,moved);
      cleanLinks(exs);
      save();
      rtnRerender(rid);
    }
    dragIdx=null;overIdx=null;
  }
}


function toggleRoutineActive(rid){
  const r=S.routines.find(x=>x.id===rid);if(!r)return;
  r.active=r.active===false?true:false;
  save();showRoutineDetail(rid);renderLibrary(document.getElementById('content'));
  toast(r.active===false?'Routine deactivated':'Routine activated','green');
}
function showRenameRoutine(rid){
  const r=S.routines.find(x=>x.id===rid);if(!r)return;
  const ov=makeOv('rn-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Edit Routine</div>
    <div class="fg"><label class="fl">Name</label><input type="text" id="rr-name" maxlength="80" value="${esc(r.name)}"></div>
    <div class="fg"><label class="fl">Notes</label><textarea id="rr-notes" style="min-height:70px;font-size:13px" maxlength="400">${esc(r.notes||'')}</textarea></div>
    <button class="btn btp bfw" onclick="renameRoutine(${jsq(rid)})">Save</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('rn-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function renameRoutine(rid){
  const r=S.routines.find(x=>x.id===rid);if(!r)return;
  const name=document.getElementById('rr-name')?.value?.trim();if(!name){toast('Enter a name');return;}
  r.name=name;r.notes=(document.getElementById('rr-notes')?.value||'').trim();
  save();closeOv('rn-ov');showRoutineDetail(rid);renderLibrary(document.getElementById('content'));
}
// Deleting a routine also takes it out of every group, the weekday map and any calendar override —
// a rotation pointing at a routine that no longer exists used to leave the home screen empty.
function delRoutine(rid){
  const r=S.routines.find(x=>x.id===rid);if(!r)return;
  const n=S.workouts.filter(w=>w.routineId===rid).length;
  customConfirm(`Delete <b>${esc(r.name)}</b>?${n?`<br>Your ${n} logged workout${n===1?'':'s'} from it stay in History.`:''}`,'Delete',()=>{
    S.routines=S.routines.filter(x=>x.id!==rid);
    S.groups.forEach(g=>{
      const nextRid=g.routineIds.length?g.routineIds[(g.cursor||0)%g.routineIds.length]:null;
      g.routineIds=g.routineIds.filter(id=>id!==rid);
      if(g.dayMap)delete g.dayMap[rid];
      const at=g.routineIds.indexOf(nextRid);
      g.cursor=g.routineIds.length?(at>=0?at:(g.cursor||0)%g.routineIds.length):0;
    });
    const ro=S.schedule.routineOverrides||{};
    Object.keys(ro).forEach(d=>{if(ro[d]===rid)delete ro[d];});
    saveNow();closeOv('rd-ov');renderLibrary(document.getElementById('content'));toast('Routine deleted','green');
  });
}
