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
function toggleRtnLink(rid,i){
  const L=rtnList(rid);if(!L)return;
  const arr=L.arr;if(i>=arr.length-1)return;
  const a=arr[i],b=arr[i+1];
  if(a.link&&a.link===b.link){
    // Unlink: if group has >2 members, only remove a from the group
    const members=arr.filter(e=>e.link===a.link);
    if(members.length>2){a.link=null;}
    else{a.link=null;b.link=null;}
  }else{
    // Link: if b already has a link, join that group; else if a has a link, extend; else new
    if(b.link){a.link=b.link;}
    else if(a.link){b.link=a.link;}
    else{const lk='ss-'+uid();a.link=lk;b.link=lk;}
  }
  if(L.persist)save();rtnRerender(rid);
}
// Toggle link between exercise ei and ei+1 in active workout
function toggleSessionLink(ei){
  if(!S.activeWorkout)return;
  const arr=S.activeWorkout.exercises;if(ei>=arr.length-1)return;
  const a=arr[ei],b=arr[ei+1];
  if(a.link&&a.link===b.link){
    const members=arr.filter(e=>e.link===a.link);
    if(members.length>2){a.link=null;}
    else{a.link=null;b.link=null;}
  }else{
    if(b.link){a.link=b.link;}
    else if(a.link){b.link=a.link;}
    else{const lk='ss-'+uid();a.link=lk;b.link=lk;}
  }
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
      <div style="flex:1"><div style="font-size:13px;font-weight:600">${p.label}</div>
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
function rtnRowHTML(e,i,rid,draggable,isLast){
  const ex=getEx(e.exId);
  const sets=e.sets==null?3:e.sets;
  const type=e.type||'flat';
  const L=rtnList(rid);const arr=L?L.arr:[];
  const nextLinked=!isLast&&arr[i+1]&&e.link&&arr[i+1].link===e.link;
  return `<div class="rtn-ex rd-ex-row" data-idx="${i}">
    <div style="display:flex;align-items:center;gap:8px">
      ${draggable?`<div class="drag-handle" data-drag="${i}" style="cursor:grab">⣿</div>`:''}
      <div style="flex:1;min-width:0;font-size:13px;font-weight:600">${ex?.name||e.exId}</div>
      <button class="ib delbtn" onclick="rtnRemove('${rid}',${i})">✕</button>
    </div>
    <div class="rtn-ctl">
      <div class="rtn-grp"><span class="rtn-lbl">Sets</span><div class="rtn-grp-row">
        <button class="rtn-stepbtn" onclick="rtnAdjSets('${rid}',${i},-1)">−</button>
        <span class="rtn-val">${sets>0?sets:'—'}</span>
        <button class="rtn-stepbtn" onclick="rtnAdjSets('${rid}',${i},1)">+</button>
      </div></div>
      <div class="rtn-grp"><span class="rtn-lbl">Reps</span><div class="rtn-grp-row">
        <input class="rtn-reps" type="number" inputmode="numeric" placeholder="–" value="${e.r||''}" onchange="rtnReps('${rid}',${i},this.value)">
      </div></div>
      <div class="rtn-grp"><span class="rtn-lbl">Rest</span><div class="rtn-grp-row">
        <button class="rtn-stepbtn" onclick="rtnAdjRest('${rid}',${i},-15)">−</button>
        <span class="rtn-val">${fmtRest(e.rest)}</span>
        <button class="rtn-stepbtn" onclick="rtnAdjRest('${rid}',${i},15)">+</button>
      </div></div>
      <div class="rtn-grp"><span class="rtn-lbl">Set type</span>
        <div class="rtn-type">${RTN_TYPES.map(([v,lbl])=>`<button class="${type===v?'on':''}" onclick="rtnType('${rid}',${i},'${v}')">${lbl}</button>`).join('')}</div>
      </div>
    </div>
    ${!isLast?`<div style="text-align:right;margin-top:6px"><button class="ss-link-btn${nextLinked?' linked':''}" onclick="toggleRtnLink('${rid}',${i})">${nextLinked?'⛓ Unlink':'⛓ Link ↓'}</button></div>`:''}
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
function rtnAdjSets(rid,i,d){const L=rtnList(rid);if(!L||!L.arr[i])return;const e=L.arr[i];e.sets=Math.max(0,(e.sets==null?3:e.sets)+d);if(L.persist)save();rtnRerender(rid);}
function rtnReps(rid,i,v){const L=rtnList(rid);if(!L||!L.arr[i])return;L.arr[i].r=v;if(L.persist)save();}
function rtnType(rid,i,t){const L=rtnList(rid);if(!L||!L.arr[i])return;L.arr[i].type=t;if(L.persist)save();rtnRerender(rid);}
function rtnAdjRest(rid,i,d){const L=rtnList(rid);if(!L||!L.arr[i])return;const e=L.arr[i];const cur=e.rest==null?(S.restDur||90):e.rest;e.rest=Math.max(0,cur+d);if(L.persist)save();rtnRerender(rid);}
function rtnRemove(rid,i){const L=rtnList(rid);if(!L)return;L.arr.splice(i,1);if(L.persist)save();rtnRerender(rid);}
function showCreateRoutine(){
  const id=uid();const ov=makeOv('cr-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">New Routine</div>
    <div class="fg"><label class="fl">Name</label><input type="text" id="rn-name" placeholder="e.g. Push Day A"></div>
    <div class="fg"><label class="fl">Notes</label><textarea id="rn-notes" style="min-height:55px;font-size:13px" placeholder="Cues, goals, focus areas…"></textarea></div>
    <div class="sec-lbl" style="padding:4px 0 6px">Exercises <span id="r-exs-count" style="color:var(--navy)">0</span></div>
    <div id="r-exs-${id}" style="margin-bottom:10px"></div>
    <button class="btn bts bfw" style="margin-bottom:10px" onclick="showExPicker('${id}')">+ Add Exercise</button>
    <button class="btn btp bfw" onclick="saveRoutine('${id}')">Create Routine</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="dismissOv(document.getElementById('cr-ov'))">Cancel</button>
  </div>`;
  window._rDraft={id,exercises:[],days:[]};
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function togRDay(i){
  if(!window._rDraft)return;const days=window._rDraft.days;const idx=days.indexOf(i);
  if(idx>=0)days.splice(idx,1);else days.push(i);
  document.querySelectorAll(`[id^="rd-"]`).forEach(b=>{const di=parseInt(b.id.split('-')[1]);if(!isNaN(di))b.classList.toggle('on',days.includes(di));});
}
function addExToRoutine(rid,exId){
  const newEx={exId,sets:3,w:'',r:'',type:'flat',rest:null};
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
function rmFromDraft(i){if(!window._rDraft)return;window._rDraft.exercises.splice(i,1);rtnRerender(window._rDraft.id);}
function saveRoutine(id){
  const name=document.getElementById('rn-name')?.value?.trim();if(!name){toast('Enter a name');return;}
  const notes=document.getElementById('rn-notes')?.value||'';
  const draft=window._rDraft;
  if(!S.routines)S.routines=[];
  // Check if existing routine (update) or new
  const existing=S.routines.find(r=>r.id===id);
  if(existing){existing.name=name;existing.notes=notes;if(draft)existing.exercises=draft.exercises;if(draft)existing.days=draft.days||[];}
  else{S.routines.push({id:id||uid(),name,notes,exercises:draft?.exercises||[],days:draft?.days||[]});}
  save();dismissOv(document.getElementById('cr-ov')||document.querySelector('.ov'));toast('Routine saved!','green');renderLibrary(document.getElementById('content'));
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
      <div><div class="mt" style="margin-bottom:4px">${r.name}</div>
        ${r.notes?`<div style="font-size:12px;color:var(--muted);margin-top:4px">${r.notes}</div>`:''}
      </div>
      <button class="btn btp bsm" onclick="startWorkout('${rid}');dismissOv(document.getElementById('rd-ov'))">▶ Start</button>
    </div>
    ${last?`<div style="background:var(--grdim);border:1px solid rgba(45,122,82,.15);border-radius:9px;padding:8px 12px;margin-bottom:12px;font-size:11px;color:var(--green);font-weight:600">Last session: ${fmtDate(new Date(last.started).toISOString())} · ${doneSetCnt(last)} sets</div>`:''}
    <div id="rd-ex-list" style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:12px">${renderExList()}</div>
    <button class="btn bts bfw" style="margin-bottom:9px" onclick="showExPicker('${rid}')">+ Add Exercise</button>
    <button class="btn ${r.active===false?'btok':'bts'} bfw" style="margin-bottom:9px" onclick="toggleRoutineActive('${rid}')">${r.active===false?'Activate Routine':'Deactivate Routine'}</button>
    <button class="btn btd bfw" onclick="delRoutine('${rid}')">Delete Routine</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="dismissOv(document.getElementById('rd-ov'))">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);window._pickRid=null;
  // ── Drag-to-reorder ──
  attachRoutineDrag(rid);
}
function adjRoutineSet(rid,i,delta){
  const r=S.routines.find(x=>x.id===rid);if(!r)return;
  const re=r.exercises[i];if(!re)return;
  const cur=re.sets==null?3:re.sets;
  re.sets=Math.max(0,cur+delta);
  // 0 means "blank / let session decide" — display as —
  save();
  // Patch just the set display inline rather than full re-render
  const rows=document.querySelectorAll('.rd-ex-row');
  if(rows[i]){
    const cnt=rows[i].querySelector('div[style*="min-width:24px"]');
    if(cnt)cnt.textContent=re.sets>0?re.sets+'s':'—';
  }
}
function attachRoutineDrag(rid){
  const list=document.getElementById('rd-ex-list');if(!list)return;
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
      save();
      rtnRerender(rid);
    }
    dragIdx=null;overIdx=null;
  }
}
function togRoutineDay(rid,i){
  const r=S.routines.find(x=>x.id===rid);if(!r)return;
  if(!r.days)r.days=[];const idx=r.days.indexOf(i);
  if(idx>=0)r.days.splice(idx,1);else r.days.push(i);
  save();document.querySelectorAll(`[id^="rdx-${rid}-"]`).forEach(b=>{const di=parseInt(b.id.split('-').pop());if(!isNaN(di))b.classList.toggle('on',r.days.includes(di));});
  toast('Schedule updated','green');
}
function rmFromRoutine(rid,i){const r=S.routines.find(x=>x.id===rid);if(!r)return;r.exercises.splice(i,1);save();document.getElementById('rd-ov')?.remove();showRoutineDetail(rid);}
function toggleRoutineActive(rid){
  const r=S.routines.find(x=>x.id===rid);if(!r)return;
  r.active=r.active===false?true:false;
  save();document.getElementById('rd-ov')?.remove();showRoutineDetail(rid);
  toast(r.active===false?'Routine deactivated':'Routine activated','green');
}
function delRoutine(rid){customConfirm('Delete this routine?','Delete',()=>{S.routines=S.routines.filter(r=>r.id!==rid);save();document.querySelector('#rd-ov')?.remove();renderLibrary(document.getElementById('content'));});}
// ═══════════════════════════════════════════════════
