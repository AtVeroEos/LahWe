// LIBRARY
// ═══════════════════════════════════════════════════
function renderLibrary(c){
  let html=`<div class="ph"><div class="page-title">Library</div></div>
  <div class="ptabs">
    <button class="ptab${S.libTab==='exercises'?' on':''}" onclick="setLibTab('exercises')">Exercises</button>
    <button class="ptab${S.libTab==='routines'?' on':''}" onclick="setLibTab('routines')">Routines</button>
    <button class="ptab${S.libTab==='groups'?' on':''}" onclick="setLibTab('groups')">Groups</button>
    <button class="ptab${S.libTab==='equipment'?' on':''}" onclick="setLibTab('equipment')">Equipment</button>
  </div>`;
  if(S.libTab==='exercises')html+=renderLibExercises();
  else if(S.libTab==='routines')html+=renderLibRoutines();
  else if(S.libTab==='groups')html+=renderLibGroups();
  else html+=renderLibEquipment();
  c.innerHTML=html;
}
function setLibTab(t){S.libTab=t;renderLibrary(document.getElementById('content'));}
function renderLibExercises(){
  let html=`<div class="sw" style="padding:9px 13px"><input id="lib-srch" placeholder="Search exercises…" oninput="filterLibEx()" style="width:100%"></div>
  <div class="fr" id="lib-chips">${CATS.map(c=>`<div class="chip${(S.exFilter||'All')===c?' on':''}" onclick="setLibFilter('${c}')">${c}</div>`).join('')}</div>`;
  const q=(window._libQ||'').toLowerCase();const cat=S.exFilter||'All';
  let exs=allEx();if(cat!=='All')exs=exs.filter(e=>e.cat===cat);if(q)exs=exs.filter(e=>e.name.toLowerCase().includes(q));
  html+=`<div class="card">`;
  if(!exs.length)html+=`<div class="empty" style="padding:24px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('search',30)}</div><div class="etit" style="font-size:14px">No results</div></div>`;
  else exs.forEach(ex=>{const pr=S.prs[ex.id];const isCustom=!!(S.custom||[]).find(c=>c.id===ex.id);html+=`<div class="exi" onclick="showExDetail('${ex.id}')"><div style="flex:1"><div class="exin">${ex.name}</div><div style="font-size:10px;color:var(--muted);margin-top:1px">${ex.cat} · ${ex.eq}${pr?` · PR ${pr.w}${S.unit}`:''}</div></div>${isCustom?`<span class="badge ba" style="margin-right:7px">Custom</span>`:''}<span style="color:var(--muted2);font-size:16px">›</span></div>`;});
  html+=`</div><div style="padding:10px 13px"><button class="btn bts bfw" onclick="showCustomEx()">+ Add Custom Exercise</button></div>`;
  return html;
}
function filterLibEx(){window._libQ=document.getElementById('lib-srch')?.value||'';renderLibrary(document.getElementById('content'));}
function setLibFilter(cat){S.exFilter=cat;document.querySelectorAll('#lib-chips .chip').forEach(ch=>ch.classList.toggle('on',ch.textContent===cat));renderLibrary(document.getElementById('content'));}
function showExDetail(exId){
  const ex=getEx(exId);if(!ex)return;const pr=S.prs[exId];const hist=getExStrData(exId);const isCustom=!!(S.custom||[]).find(c=>c.id===exId);
  const ov=makeOv('exd-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">${ex.name}</div>
    <div style="display:flex;gap:6px;margin-bottom:13px;flex-wrap:wrap">
      <span class="badge ba">${ex.cat}</span><span class="badge ba">${ex.eq}</span>
    </div>
    ${(()=>{const pm=normMuscle(ex.muscle||'');const secs=[...new Set((SEC_MUSCLE[exId]||[]).map(normMuscle))].filter(m=>m&&m!==pm&&MEV_MAV[m]);if(!pm&&!secs.length)return'';return`<div class="exmus">${pm&&MEV_MAV[pm]?`<span class="exmus-k">Primary</span><span class="badge bp">${pm}</span>`:''}${secs.length?`<span class="exmus-k">Secondary</span>${secs.map(m=>`<span class="badge ba">${m}</span>`).join('')}`:''}</div>`;})()}
    ${pr?`<div style="background:var(--gdim);border:1px solid rgba(184,124,42,.22);border-radius:10px;padding:12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
      <div><div style="font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--gold)">Personal Record</div>
      <div style="font-size:22px;font-weight:700;letter-spacing:-.5px;color:var(--gold);margin-top:3px">${pr.w}${S.unit} × ${pr.r}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">e1RM: ${pr.est}${S.unit} · ${fmtShort(pr.date+'T12:00:00')}</div></div>
      <div style="color:var(--gold)">${ICON('trophy',28)}</div>
    </div>`:''}
    ${hist.length>=2?`<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 13px;margin-bottom:12px">
      <div style="font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">${hist.length} Sessions Tracked</div>
      ${hist.slice(0,5).map(h=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="color:var(--muted)">${h.label}</span><span class="mono" style="font-weight:600">${h.maxW}${S.unit}</span><span style="font-size:10px;color:var(--muted)">e1RM ${h.e1rm}</span></div>`).join('')}
    </div>`:''}
    ${isCustom?`<button class="btn btd bfw" onclick="delCustomEx('${exId}')">Delete Exercise</button>`:''}
    <button class="btn btg bfw" style="margin-top:7px" onclick="dismissOv(document.getElementById('exd-ov'))">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function delCustomEx(id){customConfirm('Delete this exercise?','Delete',()=>{S.custom=S.custom.filter(c=>c.id!==id);save();document.getElementById('exd-ov')?.remove();renderLibrary(document.getElementById('content'));});}
function showCustomEx(){
  const muscles=Object.keys(MEV_MAV);
  const ov=makeOv('cex-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Custom Exercise</div>
    <div class="fg"><label class="fl">Name</label><input type="text" id="cex-n" placeholder="e.g. Z-Press"></div>
    <div class="fg"><label class="fl">Category</label><select id="cex-c">${CATS.filter(c=>c!=='All').map(c=>`<option>${c}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Equipment</label><select id="cex-e"><option>Barbell</option><option>Dumbbell</option><option>Kettlebell</option><option>Machine</option><option>Cable</option><option>Bodyweight</option><option>Other</option></select></div>
    <div class="fg"><label class="fl">Primary Muscle</label><select id="cex-m">${muscles.map(m=>`<option>${m}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Secondary Muscles</label><div class="mchip-grid" id="cex-sec">${muscles.map(m=>`<div class="mchip" data-m="${m}" onclick="this.classList.toggle('on')">${m}</div>`).join('')}</div></div>
    <button class="btn btp bfw" onclick="saveCustomEx()">Add Exercise</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="dismissOv(document.getElementById('cex-ov'))">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function saveCustomEx(){
  const name=document.getElementById('cex-n')?.value?.trim();if(!name){toast('Enter a name');return;}
  if(!S.custom)S.custom=[];
  const id=`custom-${uid()}`;
  const muscle=document.getElementById('cex-m')?.value||'';
  const secs=[...document.querySelectorAll('#cex-sec .mchip.on')].map(el=>el.dataset.m).filter(m=>m!==muscle);
  S.custom.push({id,name,cat:document.getElementById('cex-c')?.value||'Other',eq:document.getElementById('cex-e')?.value||'Other',muscle,sec:secs});
  if(secs.length)SEC_MUSCLE[id]=secs;
  save();dismissOv(document.getElementById('cex-ov'));toast('Added','green');renderLibrary(document.getElementById('content'));
}
function renderLibRoutines(){
  let html=`<div style="padding:9px 13px;display:flex;justify-content:flex-end;gap:8px"><button class="btn bts bsm" onclick="showImportUI()">📥 Import</button><button class="btn btp bsm" onclick="showCreateRoutine()">+ New Routine</button></div>`;
  if(!S.routines?.length)return html+`<div class="empty"><div style="margin-bottom:12px;color:var(--muted2)">${ICON('dumbbell',34)}</div><div class="etit">No routines yet</div><p style="font-size:12px">Build your first routine to get started</p></div>`;
  const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const active=S.routines.filter(r=>r.active!==false);
  const inactive=S.routines.filter(r=>r.active===false);
  const renderRow=r=>{
    const last=S.workouts.find(w=>w.routineId===r.id);
    const names=r.exercises.slice(0,3).map(e=>getEx(e.exId)?.name||'').filter(Boolean);
    const isInactive=r.active===false;
    return`<div class="hi" onclick="showRoutineDetail('${r.id}')" style="${isInactive?'opacity:.5':''}">
      <div style="flex:1">
        <div class="hn">${r.name}${isInactive?` <span style="font-size:9px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);background:var(--bg2);border-radius:3px;padding:1px 5px;margin-left:4px">Inactive</span>`:''}</div>
        <div class="hm">${r.exercises.length} exercises · ${last?'Last: '+fmtShort(new Date(last.started).toISOString()):'Never done'}</div>
        ${names.length?`<div style="font-size:10px;color:var(--muted2);margin-top:1px">${names.join(' · ')}${r.exercises.length>3?'…':''}</div>`:''}
      </div><span style="color:var(--muted2);font-size:16px">›</span>
    </div>`;
  };
  html+=`<div class="card">`;
  active.forEach(r=>{html+=renderRow(r);});
  html+=`</div>`;
  if(inactive.length){
    html+=`<div class="sec-lbl" style="margin-top:4px">Inactive</div><div class="card">`;
    inactive.forEach(r=>{html+=renderRow(r);});
    html+=`</div>`;
  }
  return html;
}
// ─── Routine Groups ───
function renderLibGroups(){
  let html=`<div style="padding:9px 13px;display:flex;justify-content:space-between;gap:8px"><button class="btn bts bsm" onclick="showProgramEditor()">${S.program&&S.program.active?'Edit Program':'+ Timed Program'}</button><button class="btn btp bsm" onclick="showCreateGroup()">+ New Group</button></div>`;
  if(!S.groups?.length)return html+`<div class="empty"><div style="margin-bottom:12px;color:var(--muted2)">${ICON('folder',34)}</div><div class="etit">No groups yet</div><p style="font-size:12px">Group routines into a rotating split (A/B/C) or a weekly day-picker schedule</p></div>`;
  html+=`<div class="card">`;
  S.groups.forEach(g=>{
    const cnt=(g.routineIds||[]).length;const modeLbl=g.mode==='rotation'?'Rotating':'Day Picker';
    html+=`<div class="hi" onclick="showGroupDetail('${g.id}')"><div style="flex:1"><div class="hn">${g.name}${g.active?` <span class="badge bg" style="margin-left:4px">Active</span>`:''}</div><div class="hm">${modeLbl} · ${cnt} routine${cnt!==1?'s':''}</div></div><span style="color:var(--muted2);font-size:16px">›</span></div>`;
  });
  html+=`</div>`;
  if(!getActiveGroup())html+=`<div style="padding:10px 14px;font-size:11px;color:var(--muted)">No active group — your home screen won't suggest a workout. Open a group and tap "Set Active".</div>`;
  return html;
}
function setCgMode(m){window._cgMode=m;['rotation','daypicker'].forEach(x=>{const b=document.getElementById('cg-m-'+x);if(b){b.classList.toggle('btp',x===m);b.classList.toggle('bts',x!==m);}});}
function showCreateGroup(){
  const id=uid();const ov=makeOv('cg-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">New Group</div>
    <div class="fg"><label class="fl">Name</label><input type="text" id="cg-name" placeholder="e.g. Push / Pull / Legs"></div>
    <div class="fg"><label class="fl">Schedule Type</label>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btp bfw" id="cg-m-rotation" onclick="setCgMode('rotation')">Rotating A/B/C</button>
        <button class="btn bts bfw" id="cg-m-daypicker" onclick="setCgMode('daypicker')">Day Picker</button>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:6px">Rotating advances A→B→C each time you finish a workout. Day Picker assigns each routine to weekdays.</div>
    </div>
    <button class="btn btp bfw" onclick="createGroup('${id}')">Create Group</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="dismissOv(document.getElementById('cg-ov'))">Cancel</button>
  </div>`;
  window._cgMode='rotation';document.body.appendChild(ov);attachSwipeDown(ov);
}
function createGroup(id){
  const name=document.getElementById('cg-name')?.value?.trim();if(!name){toast('Enter a name');return;}
  if(!S.groups)S.groups=[];
  S.groups.push({id,name,mode:window._cgMode||'rotation',routineIds:[],cursor:0,dayMap:{},daysPerWeek:inferDaysPerWeek(),active:S.groups.length===0});
  save();dismissOv(document.getElementById('cg-ov'));toast('Group created','green');S.libTab='groups';showGroupDetail(id);
}
function showGroupDetail(gid){
  const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;
  const DOW=['Su','Mo','Tu','We','Th','Fr','Sa'];
  const dpw=g.daysPerWeek||inferDaysPerWeek(),rest=7-dpw;
  const inGroup=(g.routineIds||[]).map(id=>(S.routines||[]).find(r=>r.id===id)).filter(Boolean);
  const ov=makeOv('gd-ov');
  let exHtml='';
  inGroup.forEach((r,i)=>{
    const letter=String.fromCharCode(65+i);
    const isNext=g.mode==='rotation'&&((g.cursor||0)%Math.max(1,inGroup.length))===i;
    exHtml+=`<div class="exi" style="${isNext?'background:var(--ndim)':''}">
      <div style="flex:1">
        <div class="exin">${g.mode==='rotation'?`<span style="color:var(--navy);font-weight:700">${letter}</span> · `:''}${r.name}${isNext?` <span class="badge bg" style="margin-left:4px">Next</span>`:''}</div>
        ${g.mode==='daypicker'?`<div style="display:flex;gap:3px;margin-top:6px">${DOW.map((d,di)=>`<button class="sched-day${((g.dayMap||{})[r.id]||[]).includes(di)?' on':''}" style="width:30px;height:27px;font-size:10px" onclick="event.stopPropagation();toggleGroupDay('${gid}','${r.id}',${di})">${d}</button>`).join('')}</div>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:4px;margin-left:6px">
        ${g.mode==='rotation'?`${!isNext?`<button class="ib" style="color:var(--navy)" onclick="event.stopPropagation();setGroupCursor('${gid}',${i})" title="Set as next">⟳</button>`:''}<button class="ib" onclick="event.stopPropagation();moveInGroup('${gid}',${i},-1)">↑</button><button class="ib" onclick="event.stopPropagation();moveInGroup('${gid}',${i},1)">↓</button>`:''}
        <button class="ib delbtn" onclick="event.stopPropagation();removeFromGroup('${gid}','${r.id}')">✕</button>
      </div>
    </div>`;
  });
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
      <div class="mt">${g.name}</div>
      <button class="btn ${g.active?'btok':'btp'} bsm" onclick="setActiveGroup('${gid}')">${g.active?'✓ Active':'Set Active'}</button>
    </div>
    <div style="display:flex;gap:7px;margin-bottom:4px">
      <button class="btn ${g.mode==='rotation'?'btp':'bts'} bfw bsm" onclick="setGroupMode('${gid}','rotation')">Rotating A/B/C</button>
      <button class="btn ${g.mode==='daypicker'?'btp':'bts'} bfw bsm" onclick="setGroupMode('${gid}','daypicker')">Day Picker</button>
    </div>
    <div style="font-size:10px;color:var(--muted);margin-bottom:12px">${g.mode==='rotation'?'Advances A→B→C each time you finish a workout.':'Each routine runs on the weekdays you assign below.'}</div>
    <div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:12px">${exHtml||'<div class="empty" style="padding:20px"><div class="etit" style="font-size:13px">No routines yet</div></div>'}</div>
    <button class="btn bts bfw" style="margin-bottom:9px" onclick="showAddRoutineToGroup('${gid}')">+ Add Routine</button>
    ${g.mode==='rotation'&&(g.routineIds||[]).length?`<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:9px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:12px;font-weight:600">Training days / week</div>
        <div style="display:flex;align-items:center;gap:10px">
          <button class="ib" onclick="setGroupDays('${gid}',${dpw-1})">−</button>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:700;min-width:16px;text-align:center">${dpw}</span>
          <button class="ib" onclick="setGroupDays('${gid}',${dpw+1})">+</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:12px;font-weight:600;color:var(--muted)">Rest days / week</div>
        <div style="display:flex;align-items:center;gap:10px">
          <button class="ib" onclick="setGroupDays('${gid}',${7-(rest-1)})">−</button>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:700;min-width:16px;text-align:center;color:var(--muted)">${rest}</span>
          <button class="ib" onclick="setGroupDays('${gid}',${7-(rest+1)})">+</button>
        </div>
      </div>
    </div>`:''}
    ${(g.routineIds||[]).length?`<button class="btn btp bfw" style="margin-bottom:9px" onclick="showGroupEval('${gid}')">📊  Evaluate Program</button>`:''}
    <button class="btn btd bfw" onclick="deleteGroup('${gid}')">Delete Group</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="dismissOv(document.getElementById('gd-ov'))">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function reopenGroup(gid){document.getElementById('gd-ov')?.remove();showGroupDetail(gid);}
function setGroupMode(gid,mode){const g=(S.groups||[]).find(x=>x.id===gid);if(!g||g.mode===mode)return;g.mode=mode;if(mode==='rotation'&&(g.cursor||0)>=(g.routineIds||[]).length)g.cursor=0;if(!g.dayMap)g.dayMap={};save();reopenGroup(gid);}
function setGroupDays(gid,d){const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;g.daysPerWeek=Math.min(7,Math.max(1,d));save();reopenGroup(gid);}
function showGroupEval(gid){
  const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;
  const{proj,sessions,nRoutines}=groupProjection(g);
  const scale=goalVolScale();
  const actual=muscleSetsInRange(Date.now()-14*86400000,Date.now()+1);
  const goalLbl=(GOALS.find(x=>x.id===S.goal)||{}).label||'General';
  const gaps=[],over=[],drift=[];
  const rows=Object.entries(MEV_MAV).map(([m,mm])=>{
    const mev2=Math.round(mm.mev*2*scale),mav2=Math.round(mm.mav*2*scale);
    const p=proj[m]||0,a=actual[m]||0;
    let status,col,bg;
    if(p<mev2){status="Won't hit MEV";col='var(--red)';bg='var(--rdim)';gaps.push(mm.lbl);}
    else if(p<=mav2){status='On target';col='var(--green)';bg='var(--grdim)';}
    else{status='Over MAV';col='var(--purple)';bg='var(--pdim)';over.push(mm.lbl);}
    // drift: planned to hit MEV but logged volume is running well short (<60% of plan)
    if(p>=mev2&&a<p*0.6)drift.push(mm.lbl);
    return{m,mm,mev2,mav2,p,a,status,col,bg};
  });
  const noData=sessions===0;
  const ov=makeOv('ge-ov');
  let head=`<div style="margin-bottom:12px">
    <div class="mt" style="margin-bottom:3px">${g.name}</div>
    <div style="font-size:11px;color:var(--muted)">${g.mode==='rotation'?'Rotating':'Day Picker'} · ${nRoutines} routine${nRoutines!==1?'s':''} · ~${sessions} sessions / 2 wks · Goal: ${goalLbl}</div>
  </div>`;
  if(noData){
    ov.innerHTML=`<div class="modal"><div class="mh"></div>${head}
      <div class="empty" style="padding:24px"><div style="font-size:30px;margin-bottom:8px">🗓️</div><div class="etit" style="font-size:14px">No cadence yet</div><p style="font-size:12px">${g.mode==='daypicker'?'Assign routines to weekdays so I can project weekly coverage.':'Set training days/week and add routines to project coverage.'}</p></div>
      <button class="btn btg bfw" style="margin-top:9px" onclick="dismissOv(document.getElementById('ge-ov'))">Close</button></div>`;
    document.body.appendChild(ov);attachSwipeDown(ov);return;
  }
  // summary verdict
  let summary='';
  if(gaps.length)summary+=`<div style="background:var(--rdim);border:1px solid rgba(193,49,49,.2);border-radius:10px;padding:11px 13px;margin-bottom:8px"><div style="font-size:11px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Under-trained — focus here</div><div style="font-size:13px;font-weight:600">${gaps.join(' · ')}</div><div style="font-size:11px;color:var(--muted);margin-top:3px">Below the minimum effective volume for your goal. Add work or frequency for these.</div></div>`;
  if(over.length)summary+=`<div style="background:var(--pdim);border:1px solid rgba(124,58,193,.2);border-radius:10px;padding:11px 13px;margin-bottom:8px"><div style="font-size:11px;font-weight:700;color:var(--purple);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Above max adaptive volume</div><div style="font-size:13px;font-weight:600">${over.join(' · ')}</div><div style="font-size:11px;color:var(--muted);margin-top:3px">More may not help and can outpace recovery. Consider trimming.</div></div>`;
  if(drift.length)summary+=`<div style="background:var(--grdim);border:1px solid rgba(176,120,40,.2);border-radius:10px;padding:11px 13px;margin-bottom:8px"><div style="font-size:11px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Plan vs reality</div><div style="font-size:13px;font-weight:600">${drift.join(' · ')}</div><div style="font-size:11px;color:var(--muted);margin-top:3px">Your plan covers these but your logged volume is running short — you may be skipping them.</div></div>`;
  if(!gaps.length&&!over.length)summary+=`<div style="background:var(--grdim);border:1px solid rgba(39,114,74,.2);border-radius:10px;padding:11px 13px;margin-bottom:8px;font-size:13px;font-weight:600;color:var(--green)">✓ Balanced — every muscle group is projected within its target range.</div>`;
  // table
  let table=`<div style="display:grid;grid-template-columns:1fr 64px 56px 56px;padding:7px 4px;border-bottom:2px solid var(--border)">
    <div style="font-size:9px;font-weight:700;color:var(--muted2);text-transform:uppercase;letter-spacing:.05em">Muscle</div>
    <div style="font-size:9px;font-weight:700;color:var(--muted2);text-align:center;text-transform:uppercase">Target/2wk</div>
    <div style="font-size:9px;font-weight:700;color:var(--navy);text-align:center;text-transform:uppercase">Plan</div>
    <div style="font-size:9px;font-weight:700;color:var(--muted2);text-align:center;text-transform:uppercase">Logged</div>
  </div>`;
  rows.forEach(r=>{
    table+=`<div style="display:grid;grid-template-columns:1fr 64px 56px 56px;padding:8px 4px;border-bottom:1px solid var(--border);align-items:center;background:${r.bg}">
      <div><div style="font-size:12px;font-weight:600">${r.mm.lbl}</div><div style="font-size:9px;color:${r.col};font-weight:600">${r.status}</div></div>
      <div style="text-align:center;font-size:11px;color:var(--muted);font-family:'IBM Plex Mono',monospace">${r.mev2}–${r.mav2}</div>
      <div style="text-align:center;font-size:14px;font-weight:700;color:${r.col};font-family:'IBM Plex Mono',monospace">${fmtSets(r.p)}</div>
      <div style="text-align:center;font-size:12px;color:var(--muted2);font-family:'IBM Plex Mono',monospace">${r.a?fmtSets(r.a):'–'}</div>
    </div>`;
  });
  ov.innerHTML=`<div class="modal" style="max-height:88vh;overflow-y:auto"><div class="mh"></div>${head}${summary}
    <div style="font-size:10px;color:var(--muted2);text-transform:uppercase;letter-spacing:.04em;margin:6px 0 4px;font-weight:600">Per-muscle · 2-week projection</div>
    ${table}
    <div style="font-size:10px;color:var(--muted2);margin-top:8px;line-height:1.5">Plan = projected weighted sets if you run this program over 2 weeks. Logged = what you've actually trained in the last 2 weeks. Targets are MEV–MAV scaled for your goal (compound lifts credit assisting muscles at half a set).</div>
    <button class="btn btg bfw" style="margin-top:11px" onclick="dismissOv(document.getElementById('ge-ov'))">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function setActiveGroup(gid){(S.groups||[]).forEach(g=>g.active=(g.id===gid)?!g.active:false);save();reopenGroup(gid);toast('Active group updated','green');}
function showAddRoutineToGroup(gid){
  const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;
  const avail=(S.routines||[]).filter(r=>!(g.routineIds||[]).includes(r.id));
  const ov=makeOv('agr-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Add Routine</div>
    ${avail.length?`<div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden">${avail.map(r=>`<div class="exi" onclick="addToGroup('${gid}','${r.id}')"><div style="flex:1"><div class="exin">${r.name}</div><div style="font-size:10px;color:var(--muted);margin-top:1px">${r.exercises.length} exercises</div></div><span style="color:var(--navy);font-size:18px;font-weight:600">+</span></div>`).join('')}</div>`:`<div class="empty" style="padding:20px"><div class="etit" style="font-size:13px">All routines already added</div><p style="font-size:11px">Create more in the Routines tab</p></div>`}
    <button class="btn btg bfw" style="margin-top:9px" onclick="dismissOv(document.getElementById('agr-ov'))">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function addToGroup(gid,rid){const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;if(!g.routineIds)g.routineIds=[];if(!g.routineIds.includes(rid))g.routineIds.push(rid);save();dismissOv(document.getElementById('agr-ov'));reopenGroup(gid);}
function removeFromGroup(gid,rid){const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;g.routineIds=(g.routineIds||[]).filter(id=>id!==rid);if(g.dayMap)delete g.dayMap[rid];if((g.cursor||0)>=g.routineIds.length)g.cursor=0;save();reopenGroup(gid);}
function moveInGroup(gid,i,dir){const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;const ids=g.routineIds;const j=i+dir;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];save();reopenGroup(gid);}
function setGroupCursor(gid,i){const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;g.cursor=i;save();reopenGroup(gid);toast('Next workout set','green');}
function toggleGroupDay(gid,rid,dow){const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;if(!g.dayMap)g.dayMap={};if(!g.dayMap[rid])g.dayMap[rid]=[];const arr=g.dayMap[rid];const idx=arr.indexOf(dow);if(idx>=0)arr.splice(idx,1);else arr.push(dow);save();reopenGroup(gid);}
function deleteGroup(gid){customConfirm('Delete this group? Your routines are kept.','Delete',()=>{S.groups=(S.groups||[]).filter(g=>g.id!==gid);save();document.getElementById('gd-ov')?.remove();S.libTab='groups';renderLibrary(document.getElementById('content'));});}

// ═══════════════════════════════════════════════════
