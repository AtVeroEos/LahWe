// ═══════════════════════════════════════════════════
// LIBRARY
// ═══════════════════════════════════════════════════
// Three levels, each drawn as what it is:
//   Programs  (S.program and S.groups) as TIME: a bar of phases, a week of days, a rotation;
//   Workouts  (S.routines)             as what they HIT: sets per muscle, how long, where they sit;
//   Exercises                          as PROGRESS: yours first, with their trend.
// The tab ids are the old ones (groups / routines / exercises), so imports, the coach and saved
// states keep working. Equipment is no longer a tab: it is a filter on Exercises.
const LIB_TABS=[['groups','Programs'],['routines','Workouts'],['exercises','Exercises']];
function libTab(){return LIB_TABS.some(t=>t[0]===S.libTab)?S.libTab:S.libTab==='equipment'?'exercises':'routines';}
function renderLibrary(c){
  const t=libTab();
  const coach=t==='exercises'?'':`<button class="btn bts bsm lib-coach" onclick="coachStart('program')">${ICON('spark',14)} Build with coach</button>`;
  const add=t==='exercises'?`showCustomEx()`:`showLibAdd()`;
  const addLbl=t==='groups'?'New program':t==='routines'?'New workout':'New exercise';
  let html=`<div class="ph"><div class="page-title">Library</div><div class="ph-acts">${coach}<button class="ib lib-add" id="lib-add" onclick="${add}" aria-label="${addLbl}">${ICON('plus',18)}</button></div></div>
  <div class="seg" role="tablist">${LIB_TABS.map(x=>`<button class="seg-b${t===x[0]?' on':''}" role="tab" aria-selected="${t===x[0]?'true':'false'}" onclick="setLibTab('${x[0]}')">${x[1]}</button>`).join('')}</div>`;
  if(t==='exercises')html+=renderLibExercises();
  else if(t==='routines')html+=renderLibRoutines();
  else html+=renderLibGroups();
  c.innerHTML=html;
}
function setLibTab(t){S.libTab=t;save();renderLibrary(document.getElementById('content'));}
// The + on Programs and Workouts: the ways to make one.
function showLibAdd(){
  const prog=libTab()==='groups';
  const row=(js,icon,t,s)=>`<button class="row row-tap" onclick="closeOv('libadd-ov');setTimeout(()=>{${js}},230)"><span class="row-ic tone-info">${ICON(icon,17)}</span><span class="row-main"><span class="row-t">${t}</span><span class="row-s">${s}</span></span><span class="row-chev">${ICON('chev',16)}</span></button>`;
  const ov=makeOv('libadd-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:10px">${prog?'New program':'New workout'}</div>
    <div class="list">${prog
      ?row('showCreateGroup()','repeat','Weekly split','Workouts on fixed days, or a rotation you work through in order')
        +row('showProgramEditor()','flag',S.program&&S.program.active?'Edit the timed program':'Timed program','Splits in sequence, each for a number of weeks')
      :row('showCreateRoutine()','plus','Build it by hand','Pick exercises, sets and reps')
        +row('showImportUI()','arrowdown','Import','Paste a program as text, or bring one in from a file')}
      ${row("coachStart('program')",'spark','Build with coach','Say what you want and review what it drafts')}</div>
    <button class="btn btg bfw" style="margin-top:10px" onclick="closeOv('libadd-ov')">Cancel</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}

// ─── Exercises ───
function libEquip(){return EQUIPMENT_PRESETS.find(p=>p.id===(S.equipPreset||'full'))||EQUIPMENT_PRESETS[0];}
function libExMatches(){
  const words=(window._libQ||'').toLowerCase().split(/\s+/).filter(Boolean);const cat=S.exFilter||'All';const eq=libEquip();
  let exs=allEx();const total=exs.length;
  if(eq.eqs)exs=exs.filter(e=>eq.eqs.includes(e.eq));
  const canDo=exs.length;
  if(cat!=='All')exs=exs.filter(e=>e.cat===cat);
  if(words.length)exs=exs.filter(e=>{const n=(e.name+' '+e.eq+' '+(e.muscle||'')).toLowerCase();return words.every(w=>n.includes(w));});
  return{exs,total,canDo,eq};
}
function renderLibExercises(){
  const eq=libEquip();
  return`<div class="lib-search"><span class="lib-search-ic">${ICON('search',17)}</span><input id="lib-srch" type="search" placeholder="Search exercises" value="${esc(window._libQ||'')}" oninput="filterLibEx()" autocomplete="off" aria-label="Search exercises"></div>
  <div class="fr" id="lib-chips"><button class="chip lib-eq${eq.eqs?' on':''}" id="lib-eq" onclick="showEquipFilter()" aria-label="Equipment: ${esc(eq.label)}">${ICON('sliders',14)} ${esc(eq.eqs?eq.label:'Equipment')} ${ICON('chevdown',11)}</button>${CATS.map(c=>`<button class="chip${(S.exFilter||'All')===c?' on':''}" data-cat="${c}" onclick="setLibFilter('${c}')">${c}</button>`).join('')}</div>
  <div id="lib-list">${libExListHTML()}</div>`;
}
function libExListHTML(){
  const m=libExMatches();const u=S.unit;const range=boardRange();
  const note=m.eq.eqs?`<div class="lib-note">Showing what you can do with ${esc(m.eq.eqs.join(', ').toLowerCase())}: ${m.canDo} of ${m.total}. <a onclick="setEquipFilter('full')">Show everything</a></div>`:'';
  if(!m.exs.length)return note+`<div class="empty" style="padding:24px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('search',30)}</div><div class="etit" style="font-size:14px">No exercises match</div><button class="btn bts bsm" style="margin-top:10px" onclick="showCustomEx()">${ICON('plus',14)} New exercise</button></div>`;
  const hist=new Set(getExsWithHist());
  const used={};(S.routines||[]).forEach(r=>{if(r.active===false)return;(r.exercises||[]).forEach(e=>{(used[e.exId]=used[e.exId]||[]).push(r.name);});});
  // Yours: anything you have logged, most recent first.
  const mine=m.exs.filter(e=>hist.has(e.id)).map(e=>({e,row:liftRow(e.id,range)})).sort((a,b)=>(b.row.lastDs||'')<(a.row.lastDs||'')?-1:(b.row.lastDs||'')>(a.row.lastDs||'')?1:a.e.name.localeCompare(b.e.name));
  const rest=m.exs.filter(e=>!hist.has(e.id));
  const all=window._libMine||(window._libQ||'').trim()||mine.length<=8;
  const shown=all?mine:mine.slice(0,6);
  const where=e=>used[e.id]?`in ${used[e.id].slice(0,2).join(', ')}${used[e.id].length>2?` +${used[e.id].length-2}`:''}`:e.eq;
  let h=note;
  if(mine.length){
    h+=`<div class="sec-h sec-h-act"><span>Yours · ${mine.length}</span><span class="sec-note">estimated max, ${esc(u)} · ${range.label}</span></div><div class="list lib-ex">`;
    h+=shown.map(({e,row})=>{
      const d=row.stalled?'flat':row.delta!=null?fmtSigned(Math.round(row.delta)):'';
      return`<button class="row row-tap" onclick="showExDetail(${jsq(e.id)})"><span class="row-main"><span class="row-t">${esc(e.name)}</span><span class="row-s">${esc(e.cat)} · ${esc(where(e))}</span></span>
        ${svgSpark(row.pts,{w:64,h:22,cls:'spark-sm'})}<span class="lib-v">${row.value!=null?Math.round(row.value):'–'}</span><span class="lib-d dl-${row.stalled?'warn':row.delta>0?'good':row.delta<0?'warn':'flat'}">${esc(d)}</span></button>`;}).join('');
    if(!all)h+=`<button class="row row-tap" onclick="window._libMine=true;filterLibEx()"><span class="row-main"><span class="row-t" style="color:var(--navy)">${mine.length-shown.length} more of yours</span></span><span class="row-chev">${ICON('chev',16)}</span></button>`;
    h+=`</div>`;
  }
  if(rest.length){
    h+=`<div class="sec-h">${mine.length?'Not tried yet':'Exercises'} · ${rest.length}</div><div class="list lib-ex">`;
    h+=rest.map(e=>`<button class="row row-tap" onclick="showExDetail(${jsq(e.id)})"><span class="row-main"><span class="row-t">${esc(e.name)}${BUILTIN_EX_IDS.has(e.id)?'':'<span class="pill">Yours</span>'}</span><span class="row-s">${esc(e.cat)} · ${esc(where(e))}</span></span><span class="row-chev">${ICON('chev',16)}</span></button>`).join('');
    h+=`</div>`;
  }
  return h;
}
function filterLibEx(){
  const box=document.getElementById('lib-srch');if(box)window._libQ=box.value||'';
  const el=document.getElementById('lib-list');
  if(el)el.innerHTML=libExListHTML();else renderLibrary(document.getElementById('content'));
}
function setLibFilter(cat){
  S.exFilter=cat;save();
  document.querySelectorAll('#lib-chips .chip[data-cat]').forEach(ch=>ch.classList.toggle('on',ch.dataset.cat===cat));
  const el=document.getElementById('lib-list');if(el)el.innerHTML=libExListHTML();
}
// Equipment: what you have to train with. One setting for the whole app (the exercise picker
// and the swap list use it too), chosen here as a filter on the list.
function showEquipFilter(){
  const cur=S.equipPreset||'full';
  const ov=makeOv('equip-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:2px">Equipment</div>
    <div class="sheet-sub">What you have to train with. Exercises here, in the picker and in swaps are limited to it.</div>
    <div class="list">${EQUIPMENT_PRESETS.map(p=>`<button class="row row-tap" onclick="setEquipFilter('${p.id}')" aria-pressed="${p.id===cur?'true':'false'}"><span class="row-main"><span class="row-t">${esc(p.label)}</span><span class="row-s">${p.eqs?esc(p.eqs.join(', ')):'Everything'}</span></span>${p.id===cur?`<span class="row-ic tone-info">${ICON('check',17)}</span>`:''}</button>`).join('')}</div>
    <button class="btn btg bfw" style="margin-top:10px" onclick="closeOv('equip-ov')">Close</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function setEquipFilter(id){
  if(!EQUIPMENT_PRESETS.some(p=>p.id===id))return;
  S.equipPreset=id;save();closeOv('equip-ov');
  if(S.tab==='library')renderLibrary(document.getElementById('content'));
}
function setLibEquipPreset(id){setEquipFilter(id);} // the old name, still used by saved links and tests
// Tapping an exercise anywhere opens the one exercise sheet (exerciseDetail in the Progress code).
function showExDetail(exId){if(getEx(exId))showMetric('lift',{id:exId});}
// Deleting an exercise that is referenced elsewhere used to leave "undefined" rows behind.
//  - in workout history → it is archived: hidden from lists and pickers, old sessions keep the name;
//  - only in routines   → removed from those routines too.
function delCustomEx(id){
  const ex=(S.custom||[]).find(c=>c.id===id);if(!ex)return;
  const inHist=S.workouts.filter(w=>w.exercises.some(e=>e.exId===id)).length;
  const inRtn=S.routines.filter(r=>r.exercises.some(e=>e.exId===id)).length;
  const live=S.activeWorkout&&S.activeWorkout.exercises.some(e=>e.exId===id);
  if(live){toast('That exercise is in the workout you have open');return;}
  const parts=[];
  if(inRtn)parts.push(`It will be removed from ${inRtn} routine${inRtn===1?'':'s'}.`);
  if(inHist)parts.push(`${inHist} logged workout${inHist===1?'':'s'} keep their sets and the name.`);
  customConfirm(`Delete <b>${esc(ex.name)}</b>?${parts.length?'<br>'+parts.join(' '):''}`,'Delete',()=>{
    S.routines.forEach(r=>{r.exercises=r.exercises.filter(e=>e.exId!==id);});
    if(inHist)ex.archived=true;
    else{S.custom=S.custom.filter(c=>c.id!==id);delete SEC_MUSCLE[id];delete S.prsManual[id];if(S.exRest)delete S.exRest[id];}
    _exIdx=null;rebuildPRs();save();
    closeOv('metric-ov');if(S.tab==='library')renderLibrary(document.getElementById('content'));else rerender();toast('Exercise deleted','green');
  });
}
function showCustomEx(){
  const muscles=Object.keys(MEV_MAV);
  const ov=makeOv('cex-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Custom Exercise</div>
    <div class="fg"><label class="fl">Name</label><input type="text" id="cex-n" placeholder="e.g. Z-Press"></div>
    <div class="fg"><label class="fl">Category</label><select id="cex-c">${CATS.filter(c=>c!=='All').map(c=>`<option>${c}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Equipment</label><select id="cex-e">${EQUIPMENT_TYPES.map(e=>`<option>${e}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Primary Muscle</label><select id="cex-m">${muscles.map(m=>`<option>${m}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Secondary Muscles</label><div class="mchip-grid" id="cex-sec">${muscles.map(m=>`<div class="mchip" data-m="${m}" onclick="this.classList.toggle('on')">${m}</div>`).join('')}</div></div>
    <button class="btn btp bfw" onclick="saveCustomEx()">Add Exercise</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('cex-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function saveCustomEx(){
  const name=document.getElementById('cex-n')?.value?.trim().replace(/\s+/g,' ');if(!name){toast('Enter a name');return;}
  const dupe=exIndex().all.find(e=>e.name.toLowerCase()===name.toLowerCase());
  if(dupe&&!dupe.archived){toast('"'+dupe.name+'" already exists');return;}
  const muscle=document.getElementById('cex-m')?.value||'';
  const secs=[...document.querySelectorAll('#cex-sec .mchip.on')].map(el=>el.dataset.m).filter(m=>m!==muscle);
  const cat=document.getElementById('cex-c')?.value||'Other',eq=document.getElementById('cex-e')?.value||'Other';
  let id;
  if(dupe){ // re-adding something that was deleted: bring it back with its history
    dupe.archived=false;dupe.cat=cat;dupe.eq=eq;dupe.muscle=muscle;dupe.sec=secs;id=dupe.id;
  }else{id=`custom-${uid()}`;S.custom.push({id,name,cat,eq,muscle,sec:secs});}
  if(secs.length)SEC_MUSCLE[id]=secs;else delete SEC_MUSCLE[id];
  _exIdx=null;
  save();closeOv('cex-ov');toast('Added','green');
  if(document.getElementById('ex-list'))renderPickerList();
  else if(S.tab==='library')renderLibrary(document.getElementById('content'));
}
// ─── Workouts ───
// Sets per muscle, most first. A set counts once, for the muscle the exercise is filed under.
function rtnMuscleSets(r){
  const by={};
  (r.exercises||[]).forEach(e=>{const ex=getEx(e.exId);const m=ex?(normMuscle(ex.muscle||'')||ex.cat||'Other'):'Other';const n=e.sets==null?3:(parseInt(e.sets)||0);if(n>0)by[m]=(by[m]||0)+n;});
  const all=Object.entries(by).map(([m,sets])=>({m,sets})).sort((a,b)=>b.sets-a.sets||a.m.localeCompare(b.m));
  if(all.length<=4)return all;
  const top=all.slice(0,3);top.push({m:'Other',sets:all.slice(3).reduce((t,x)=>t+x.sets,0)});
  return top;
}
// How long it takes: what it actually took the last few times, else sets × (about 40 s of work + the rest).
function rtnMinutes(r){
  const took=S.workouts.filter(w=>w.routineId===r.id&&w.ended>w.started).slice(0,5).map(w=>(w.ended-w.started)/60000).filter(m=>m>=5&&m<=240).sort((a,b)=>a-b);
  if(took.length)return{min:Math.round(took[Math.floor(took.length/2)]/5)*5||5,real:true};
  let sec=0;(r.exercises||[]).forEach(e=>{const n=e.sets==null?3:(parseInt(e.sets)||0);const rest=e.rest!=null?e.rest:(S.exRest&&S.exRest[e.exId]!=null?S.exRest[e.exId]:(S.restDur||90));sec+=n*(40+rest);});
  return{min:sec?Math.max(5,Math.round(sec/60/5)*5):0,real:false};
}
// Short labels for a week strip: initials ("Upper A" → UA), else the first four letters, else
// numbers — whichever is the first to tell every workout in the split apart.
function rtnCodes(routines){
  const names=routines.map(r=>String(r.name||'').trim());
  const uniq=a=>a.every(x=>x)&&new Set(a.map(x=>x.toLowerCase())).size===a.length;
  const ini=names.map(n=>{const w=n.split(/[^A-Za-z0-9]+/).filter(Boolean);return w.length>=2?w.slice(0,3).map(x=>x[0].toUpperCase()).join(''):'';});
  if(uniq(ini))return ini;
  const four=names.map(n=>n.replace(/[^A-Za-z0-9]/g,'').slice(0,4));
  if(uniq(four))return four;
  return names.map((n,i)=>String(i+1));
}
const DOW_LONG=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
// When each workout of the active split comes round next: days from today (0 = today, not yet done).
function rtnNextIn(g){
  const out={};if(!g)return out;const ids=(g.routineIds||[]).filter(id=>S.routines.some(r=>r.id===id&&r.active!==false));
  if(g.mode==='rotation'){ids.forEach((id,i)=>{out[id]=(i-((g.cursor||0)%Math.max(1,ids.length))+ids.length)%Math.max(1,ids.length);});return out;}
  const dow=new Date().getDay();
  ids.forEach(id=>{
    const days=(g.dayMap||{})[id]||[];if(!days.length)return;
    let best=7;days.forEach(d=>{let n=(d-dow+7)%7;if(n===0&&wasRoutineDoneToday(id))n=7;best=Math.min(best,n);});
    out[id]=best;
  });
  return out;
}
function rtnWhere(r,g){
  if(!g||!(g.routineIds||[]).includes(r.id)){
    const other=(S.groups||[]).find(x=>(x.routineIds||[]).includes(r.id));
    return other?esc(other.name):'';
  }
  if(g.mode==='rotation')return`${esc(g.name)} · rotation`;
  const days=((g.dayMap||{})[r.id]||[]).slice().sort((a,b)=>((a+6)%7)-((b+6)%7));
  return esc(g.name)+(days.length===1?` · ${DOW_LONG[days[0]]}s`:days.length?` · ${days.map(d=>PLAN_SHORT[d]).join(', ')}`:'');
}
function rtnCardHTML(r,o){
  o=o||{};const ms=rtnMuscleSets(r);const total=ms.reduce((t,x)=>t+x.sets,0);const t=rtnMinutes(r);
  const last=S.workouts.find(w=>w.routineId===r.id);const n=(r.exercises||[]).length;
  const when=o.next===0?'Next up · today':o.next===1&&o.fixed?'Next up · tomorrow':o.isNext?(o.fixed?`Next up · ${DOW_LONG[(new Date().getDay()+o.next)%7]}`:'Next up'):last?`Last ${fmtDay(dayOf(last.started))}`:'Not done yet';
  return`<div class="lib-card${r.active===false?' off':''}" data-rid="${esc(r.id)}">
    <div class="lc-top"><button class="lc-main" onclick="showRoutineDetail(${jsq(r.id)})"><span class="lc-t">${esc(r.name)}</span><span class="lc-s">${n} exercise${n===1?'':'s'}${t.min?` · about ${t.min} min`:''}</span></button>
      ${r.active===false?'':`<button class="btn ${o.isNext?'btp':'bts'} lc-go" onclick="startWorkout(${jsq(r.id)})" aria-label="Start ${esc(r.name)}">Start</button>`}</div>
    ${total?`<div class="mbar" role="img" aria-label="${esc(ms.map(x=>`${x.m} ${x.sets} sets`).join(', '))}">${ms.map((x,i)=>`<i class="mb${i}" style="flex:${x.sets}"></i>`).join('')}</div>
    <div class="mkey">${ms.map((x,i)=>`<span><i class="mb${i}"></i>${esc(x.m)} ${x.sets}${i===ms.length-1?' sets':''}</span>`).join('')}</div>`:`<div class="lc-empty">No exercises yet. Open it to add some.</div>`}
    <div class="lc-foot"><span class="${o.isNext?'lc-next':''}">${when}</span><span>${o.where||''}</span></div>
  </div>`;
}
function renderLibRoutines(){
  if(!S.routines?.length)return`<div class="empty"><div style="margin-bottom:12px;color:var(--muted2)">${ICON('dumbbell',34)}</div><div class="etit">No workouts yet</div><p style="font-size:13px">Build one by hand, paste a program into Import, or tell the coach what you want and let it draft one.</p>
    <button class="btn btp" style="margin-top:14px" onclick="showLibAdd()">${ICON('plus',15)} New workout</button></div>`;
  const g=getActiveGroup();const nextIn=rtnNextIn(g);const fixed=!!(g&&g.mode==='daypicker');
  const active=S.routines.filter(r=>r.active!==false),inactive=S.routines.filter(r=>r.active===false);
  const inG=active.filter(r=>g&&(g.routineIds||[]).includes(r.id)).sort((a,b)=>(nextIn[a.id]==null?99:nextIn[a.id])-(nextIn[b.id]==null?99:nextIn[b.id]));
  const own=active.filter(r=>!inG.includes(r));
  const soonest=inG.length&&nextIn[inG[0].id]!=null?inG[0].id:null;
  const card=r=>rtnCardHTML(r,{isNext:r.id===soonest,next:nextIn[r.id],fixed,where:rtnWhere(r,g)});
  let h='';
  if(inG.length)h+=`<div class="sec-h">In ${esc(g.name)}</div><div class="lib-cards">${inG.map(card).join('')}</div>`;
  if(own.length)h+=`<div class="sec-h">${inG.length?'On their own':'Workouts'}</div><div class="lib-cards">${own.map(card).join('')}</div>`;
  if(inactive.length)h+=`<div class="sec-h">Inactive</div><div class="lib-cards">${inactive.map(card).join('')}</div>`;
  return h;
}

// ─── Programs ───
// A split's pattern: a week of days for fixed days, the order with a loop for a rotation.
function splitPatternHTML(g,o){
  o=o||{};const rs=(g.routineIds||[]).map(id=>S.routines.find(r=>r.id===id)).filter(r=>r&&r.active!==false);
  if(!rs.length)return`<div class="lc-empty">No workouts in it yet.</div>`;
  const codes=rtnCodes(rs);
  if(g.mode==='rotation'){
    const cur=(g.cursor||0)%rs.length;
    return`<div class="rot">${rs.map((r,i)=>`<span class="rot-i${o.live&&i===cur?' on':''}">${esc(r.name)}</span>`).join(`<span class="rot-a">${ICON('chev',12)}</span>`)}<span class="rot-loop" title="Then round again">${ICON('repeat',16)}</span></div>
      <div class="lc-note">${o.live?`Next up: ${esc(rs[cur].name)}. `:''}Repeats in order, whichever days you train.</div>`;
  }
  const td=today();const mon=mondayOf(td);
  const cells=[1,2,3,4,5,6,0].map((dow,i)=>{
    const idx=rs.findIndex(r=>((g.dayMap||{})[r.id]||[]).includes(dow));const ds=addDays(mon,i);
    const done=o.live&&S.workouts.some(w=>dayOf(w.started)===ds);
    const cls=`wk-c${idx>=0?' has':''}${done?' done':''}${o.live&&ds===td?' today':''}${o.live&&idx>=0&&!done&&ds>td?' due':''}`;
    return`<span class="wk-col"><span class="wk-d${o.live&&ds===td?' today':''}">${PLAN_SHORT[dow][0]}</span><span class="${cls}" title="${esc(DOW_LONG[dow]+(idx>=0?': '+rs[idx].name:': rest'))}">${idx>=0?esc(codes[idx]):(o.live&&ds===td&&!done?'Rest':'')}${done?ICON('tick',12):''}</span></span>`;
  }).join('');
  return`<div class="wk-strip${o.live?' live':''}">${cells}</div>`;
}
function programCardHTML(){
  const p=S.program;if(!p||!p.active)return'';
  const wins=programPhaseWindows(p);if(!wins.length)return'';
  const td=today();const start=wins[0].start,end=wins[wins.length-1].end;
  const total=Math.max(1,daysBetween(start,end));const weeks=Math.ceil(total/7);
  const state=td<start?'before':td>=end?'after':'in';
  const wk=Math.min(weeks,Math.floor(daysBetween(start,td)/7)+1);
  const gName=id=>((S.groups||[]).find(g=>g.id===id)||{name:'Removed split'}).name;
  const few=wins.length<=4;
  const bar=wins.map(w=>{
    const len=Math.max(1,daysBetween(w.start,w.end));const cur=td>=w.start&&td<w.end;const past=td>=w.end;
    const fill=past?100:cur?Math.round(daysBetween(w.start,td)/len*100):0;const wks=Math.round(len/7*10)/10;
    return`<span class="ph-seg" style="flex:${len}"><span class="ph-bar"><i style="width:${fill}%"></i></span>${few?(len/total>=0.22?`<span class="ph-l${cur?' on':''}"><b>${esc(gName(w.groupId))}</b>${wks} wk${cur?' · now':td<w.start?' · '+fmtDay(w.start):''}</span>`:`<span class="ph-l${cur?' on':''}" title="${esc(gName(w.groupId))}">${wks} wk</span>`):''}</span>`;}).join('');
  const curIdx=wins.findIndex(w=>td>=w.start&&td<w.end);
  return`<button class="lib-card prog-card" onclick="showProgramEditor()">
    <span class="lc-row"><span class="lc-t">${esc(p.name||'Timed program')}</span><span class="pill pill-acc">${state==='in'?`Week ${wk} of ${weeks}`:state==='before'?`Starts ${fmtDay(start)}`:'Finished'}</span></span>
    <span class="lc-s">${fmtDay(start)} to ${fmtDay(addDays(end,-1))} · ${wins.length} phase${wins.length===1?'':'s'}</span>
    <span class="ph-row">${bar}</span>
    ${few||curIdx<0?'':`<span class="lc-note">Phase ${curIdx+1} of ${wins.length}: ${esc(gName(wins[curIdx].groupId))}</span>`}
  </button>`;
}
function renderLibGroups(){
  const groups=S.groups||[];const g=getActiveGroup();const prog=programCardHTML();
  if(!groups.length&&!prog)return`<div class="empty"><div style="margin-bottom:12px;color:var(--muted2)">${ICON('repeat',34)}</div><div class="etit">No program yet</div><p style="font-size:13px">A weekly split puts your workouts on fixed days, or in a rotation you work through in order. A timed program runs splits one after another, each for a number of weeks.</p>
    <button class="btn btp" style="margin-top:14px" onclick="showLibAdd()">${ICON('plus',15)} New program</button></div>`;
  let h='';
  if(prog||g){
    h+=`<div class="sec-h">Running now</div><div class="lib-cards">${prog}`;
    if(g){
      const next=getNextRoutine();const nextIn=rtnNextIn(g);
      const soon=Object.keys(nextIn).sort((a,b)=>nextIn[a]-nextIn[b])[0];const sr=soon?S.routines.find(r=>r.id===soon):null;
      const nextTxt=next&&!wasRoutineDoneToday(next.id)?`Today: ${esc(next.name)}`:sr&&g.mode==='daypicker'&&nextIn[soon]<7?`Next: ${esc(sr.name)} · ${nextIn[soon]===1?'tomorrow':DOW_LONG[(new Date().getDay()+nextIn[soon])%7]}`:sr&&g.mode==='rotation'?`Next: ${esc(sr.name)}`:'';
      h+=`<div class="lib-card"><button class="lc-main" onclick="showGroupDetail(${jsq(g.id)})"><span class="lc-row"><span class="lc-t">${esc(g.name)}</span><span class="pill pill-good">In use</span><span class="lc-chev">${ICON('chev',16)}</span></span>
        <span class="lc-s">${g.mode==='rotation'?'Rotation':'Fixed days'} · ${(g.routineIds||[]).length} workout${(g.routineIds||[]).length===1?'':'s'}${g.mode==='daypicker'?' · this week':''}</span></button>
        ${splitPatternHTML(g,{live:true})}
        ${nextTxt?`<div class="lc-foot"><span class="lc-next">${nextTxt}</span><span></span></div>`:''}</div>`;
    }
    h+=`</div>`;
  }
  const others=groups.filter(x=>x!==g);
  if(others.length){
    const wins=S.program&&S.program.active?programPhaseWindows(S.program):[];const td=today();
    h+=`<div class="sec-h">${g?'Other splits':'Weekly splits'}</div><div class="lib-cards">${others.map(x=>{
      const up=wins.find(w=>w.groupId===x.id&&w.start>td);
      return`<div class="lib-card"><button class="lc-main" onclick="showGroupDetail(${jsq(x.id)})"><span class="lc-row"><span class="lc-t">${esc(x.name)}</span>${up?`<span class="pill">From ${fmtDay(up.start)}</span>`:''}<span class="lc-chev">${ICON('chev',16)}</span></span>
        <span class="lc-s">${x.mode==='rotation'?'Rotation':'Fixed days'} · ${(x.routineIds||[]).length} workout${(x.routineIds||[]).length===1?'':'s'}</span></button>
        ${splitPatternHTML(x,{})}</div>`;}).join('')}</div>`;
  }
  if(!g&&groups.length)h+=`<div class="lib-note">No split is in use, so Home cannot suggest a workout. Open one and choose “Set Active”.</div>`;
  return h;
}
function setCgMode(m){window._cgMode=m;['rotation','daypicker'].forEach(x=>{const b=document.getElementById('cg-m-'+x);if(b){b.classList.toggle('btp',x===m);b.classList.toggle('bts',x!==m);}});}
function showCreateGroup(){
  const id=uid();const ov=makeOv('cg-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">New split</div>
    <div class="fg"><label class="fl">Name</label><input type="text" id="cg-name" placeholder="e.g. Push / Pull / Legs"></div>
    <div class="fg"><label class="fl">Schedule Type</label>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btp bfw" id="cg-m-rotation" onclick="setCgMode('rotation')">Rotation</button>
        <button class="btn bts bfw" id="cg-m-daypicker" onclick="setCgMode('daypicker')">Fixed days</button>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px">Rotation moves on A→B→C each time you finish one. Fixed days puts each workout on its weekdays.</div>
    </div>
    <button class="btn btp bfw" onclick="createGroup(${jsq(id)})">Create split</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('cg-ov')">Cancel</button>
  </div>`;
  window._cgMode='rotation';document.body.appendChild(ov);attachSwipeDown(ov);
}
function createGroup(id){
  const name=document.getElementById('cg-name')?.value?.trim();if(!name){toast('Enter a name');return;}
  if(!S.groups)S.groups=[];
  S.groups.push({id,name,mode:window._cgMode||'rotation',routineIds:[],cursor:0,dayMap:{},daysPerWeek:inferDaysPerWeek(),active:S.groups.length===0});
  save();closeOv('cg-ov');toast('Split created','green');S.libTab='groups';renderLibrary(document.getElementById('content'));showGroupDetail(id);
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
        <div class="exin">${g.mode==='rotation'?`<span style="color:var(--navy);font-weight:700">${letter}</span> · `:''}${esc(r.name)}${isNext?` <span class="badge bg" style="margin-left:4px">Next</span>`:''}</div>
        ${g.mode==='daypicker'?`<div style="display:flex;gap:3px;margin-top:6px">${DOW.map((d,di)=>`<button class="sched-day${((g.dayMap||{})[r.id]||[]).includes(di)?' on':''}" style="width:36px;height:34px;font-size:12px" onclick="event.stopPropagation();toggleGroupDay(${jsq(gid)},${jsq(r.id)},${di})">${d}</button>`).join('')}</div>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:4px;margin-left:6px">
        ${g.mode==='rotation'?`${!isNext?`<button class="ib" style="color:var(--navy)" onclick="event.stopPropagation();setGroupCursor(${jsq(gid)},${i})" title="Set as next">⟳</button>`:''}<button class="ib" onclick="event.stopPropagation();moveInGroup(${jsq(gid)},${i},-1)">↑</button><button class="ib" onclick="event.stopPropagation();moveInGroup(${jsq(gid)},${i},1)">↓</button>`:''}
        <button class="ib delbtn" onclick="event.stopPropagation();removeFromGroup(${jsq(gid)},${jsq(r.id)})">✕</button>
      </div>
    </div>`;
  });
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
      <div class="mt">${esc(g.name)}</div>
      <button class="btn ${g.active?'btok':'btp'} bsm" onclick="setActiveGroup(${jsq(gid)})">${g.active?'✓ Active':'Set Active'}</button>
    </div>
    <div style="display:flex;gap:7px;margin-bottom:4px">
      <button class="btn ${g.mode==='rotation'?'btp':'bts'} bfw bsm" onclick="setGroupMode(${jsq(gid)},'rotation')">Rotation</button>
      <button class="btn ${g.mode==='daypicker'?'btp':'bts'} bfw bsm" onclick="setGroupMode(${jsq(gid)},'daypicker')">Fixed days</button>
    </div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">${g.mode==='rotation'?'Advances A→B→C each time you finish a workout.':'Each workout runs on the weekdays you give it below.'}</div>
    <div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:12px">${exHtml||'<div class="empty" style="padding:20px"><div class="etit" style="font-size:13px">No workouts yet</div></div>'}</div>
    <button class="btn bts bfw" style="margin-bottom:9px" onclick="showAddRoutineToGroup(${jsq(gid)})">+ Add workout</button>
    ${g.mode==='rotation'&&(g.routineIds||[]).length?`<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:9px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:12px;font-weight:600">Training days / week</div>
        <div style="display:flex;align-items:center;gap:10px">
          <button class="ib" onclick="setGroupDays(${jsq(gid)},${dpw-1})">−</button>
          <span style="font-family:var(--mono);font-size:15px;font-weight:700;min-width:16px;text-align:center">${dpw}</span>
          <button class="ib" onclick="setGroupDays(${jsq(gid)},${dpw+1})">+</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:12px;font-weight:600;color:var(--muted)">Rest days / week</div>
        <div style="display:flex;align-items:center;gap:10px">
          <button class="ib" onclick="setGroupDays(${jsq(gid)},${7-(rest-1)})">−</button>
          <span style="font-family:var(--mono);font-size:15px;font-weight:700;min-width:16px;text-align:center;color:var(--muted)">${rest}</span>
          <button class="ib" onclick="setGroupDays(${jsq(gid)},${7-(rest+1)})">+</button>
        </div>
      </div>
    </div>`:''}
    ${(g.routineIds||[]).length?`<button class="btn btp bfw" style="margin-bottom:9px" onclick="showGroupEval(${jsq(gid)})">${ICON('barchart',16)} Evaluate Program</button>`:''}
    <button class="btn btd bfw" onclick="deleteGroup(${jsq(gid)})">Delete split</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('gd-ov')">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function reopenGroup(gid){const sc=document.querySelector('#gd-ov .modal')?.scrollTop||0;showGroupDetail(gid);const m=document.querySelector('#gd-ov .modal');if(m){m.style.animation='none';m.scrollTop=sc;}}
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
    <div class="mt" style="margin-bottom:3px">${esc(g.name)}</div>
    <div style="font-size:12px;color:var(--muted)">${g.mode==='rotation'?'Rotation':'Fixed days'} · ${nRoutines} workout${nRoutines!==1?'s':''} · ~${sessions} sessions / 2 wks · Goal: ${goalLbl}</div>
  </div>`;
  if(noData){
    ov.innerHTML=`<div class="modal"><div class="mh"></div>${head}
      <div class="empty" style="padding:24px"><div style="font-size:30px;margin-bottom:8px">🗓️</div><div class="etit" style="font-size:14px">No cadence yet</div><p style="font-size:12px">${g.mode==='daypicker'?'Put workouts on weekdays to see what the week covers.':'Set training days a week and add workouts to see what the week covers.'}</p></div>
      <button class="btn btg bfw" style="margin-top:9px" onclick="closeOv('ge-ov')">Close</button></div>`;
    document.body.appendChild(ov);attachSwipeDown(ov);return;
  }
  // summary verdict
  let summary='';
  if(gaps.length)summary+=`<div style="background:var(--rdim);border:1px solid rgba(193,49,49,.2);border-radius:10px;padding:11px 16px;margin-bottom:8px"><div style="font-size:12px;font-weight:600;color:var(--red);margin-bottom:4px">Under-trained — focus here</div><div style="font-size:13px;font-weight:600">${gaps.join(' · ')}</div><div style="font-size:12px;color:var(--muted);margin-top:3px">Below the minimum effective volume for your goal. Add work or frequency for these.</div></div>`;
  if(over.length)summary+=`<div style="background:var(--pdim);border:1px solid rgba(124,58,193,.2);border-radius:10px;padding:11px 16px;margin-bottom:8px"><div style="font-size:12px;font-weight:600;color:var(--purple);margin-bottom:4px">Above max adaptive volume</div><div style="font-size:13px;font-weight:600">${over.join(' · ')}</div><div style="font-size:12px;color:var(--muted);margin-top:3px">More may not help and can outpace recovery. Consider trimming.</div></div>`;
  if(drift.length)summary+=`<div style="background:var(--grdim);border:1px solid rgba(176,120,40,.2);border-radius:10px;padding:11px 16px;margin-bottom:8px"><div style="font-size:12px;font-weight:600;color:var(--gold);margin-bottom:4px">Plan vs reality</div><div style="font-size:13px;font-weight:600">${drift.join(' · ')}</div><div style="font-size:12px;color:var(--muted);margin-top:3px">Your plan covers these but your logged volume is running short — you may be skipping them.</div></div>`;
  if(!gaps.length&&!over.length)summary+=`<div style="background:var(--grdim);border:1px solid rgba(39,114,74,.2);border-radius:10px;padding:11px 16px;margin-bottom:8px;font-size:13px;font-weight:600;color:var(--green)">✓ Balanced — every muscle group is projected within its target range.</div>`;
  // table
  let table=`<div style="display:grid;grid-template-columns:1fr 64px 56px 56px;padding:7px 4px;border-bottom:2px solid var(--border)">
    <div style="font-size:12px;font-weight:600;color:var(--muted2);">Muscle</div>
    <div style="font-size:12px;font-weight:600;color:var(--muted2);text-align:center;">Target/2wk</div>
    <div style="font-size:12px;font-weight:600;color:var(--navy);text-align:center;">Plan</div>
    <div style="font-size:12px;font-weight:600;color:var(--muted2);text-align:center;">Logged</div>
  </div>`;
  rows.forEach(r=>{
    table+=`<div style="display:grid;grid-template-columns:1fr 64px 56px 56px;padding:8px 4px;border-bottom:1px solid var(--border);align-items:center;background:${r.bg}">
      <div><div style="font-size:12px;font-weight:600">${r.mm.lbl}</div><div style="font-size:12px;color:${r.col};font-weight:600">${r.status}</div></div>
      <div style="text-align:center;font-size:12px;color:var(--muted);font-family:var(--mono)">${r.mev2}–${r.mav2}</div>
      <div style="text-align:center;font-size:14px;font-weight:700;color:${r.col};font-family:var(--mono)">${fmtSets(r.p)}</div>
      <div style="text-align:center;font-size:12px;color:var(--muted2);font-family:var(--mono)">${r.a?fmtSets(r.a):'–'}</div>
    </div>`;
  });
  ov.innerHTML=`<div class="modal" style="max-height:88vh;overflow-y:auto"><div class="mh"></div>${head}${summary}
    <div style="font-size:12px;color:var(--muted2);margin:6px 0 4px;font-weight:600">Per-muscle · 2-week projection</div>
    ${table}
    <div style="font-size:12px;color:var(--muted2);margin-top:8px;line-height:1.5">Plan = projected weighted sets if you run this program over 2 weeks. Logged = what you've actually trained in the last 2 weeks. Targets are MEV–MAV scaled for your goal (compound lifts credit assisting muscles at half a set).</div>
    <button class="btn btg bfw" style="margin-top:11px" onclick="closeOv('ge-ov')">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function setActiveGroup(gid){
  (S.groups||[]).forEach(g=>g.active=(g.id===gid)?!g.active:false);
  // Choosing a group by hand overrides a running timed program; otherwise it would switch straight back.
  const on=(S.groups||[]).find(g=>g.id===gid)?.active;
  let msg=on?'Now in use':'No split in use';
  if(S.program&&S.program.active){const ph=currentProgramPhase();if(!ph||ph.groupId!==gid||!on){S.program.active=false;msg+=' · timed program paused';}}
  save();reopenGroup(gid);rerenderBehind();toast(msg,'green');
}
// Refresh the page under an open sheet without touching the sheet.
function rerenderBehind(){const c=document.getElementById('content');if(!c)return;if(S.tab==='library')renderLibrary(c);}
function showAddRoutineToGroup(gid){
  const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;
  const avail=(S.routines||[]).filter(r=>!(g.routineIds||[]).includes(r.id));
  const ov=makeOv('agr-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Add workout</div>
    ${avail.length?`<div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden">${avail.map(r=>`<div class="exi" onclick="addToGroup(${jsq(gid)},${jsq(r.id)})"><div style="flex:1"><div class="exin">${esc(r.name)}</div><div style="font-size:12px;color:var(--muted);margin-top:1px">${r.exercises.length} exercises</div></div><span style="color:var(--navy);font-size:18px;font-weight:600">+</span></div>`).join('')}</div>`:`<div class="empty" style="padding:20px"><div class="etit" style="font-size:13px">Every workout is already in it</div><p style="font-size:12px">Make more under Library → Workouts</p></div>`}
    <button class="btn btg bfw" style="margin-top:9px" onclick="closeOv('agr-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function addToGroup(gid,rid){const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;if(!g.routineIds)g.routineIds=[];if(!g.routineIds.includes(rid))g.routineIds.push(rid);save();closeOv('agr-ov');reopenGroup(gid);}
function removeFromGroup(gid,rid){const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;g.routineIds=(g.routineIds||[]).filter(id=>id!==rid);if(g.dayMap)delete g.dayMap[rid];if((g.cursor||0)>=g.routineIds.length)g.cursor=0;save();reopenGroup(gid);}
function moveInGroup(gid,i,dir){const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;const ids=g.routineIds;const j=i+dir;if(j<0||j>=ids.length)return;const nextRid=ids[(g.cursor||0)%ids.length];[ids[i],ids[j]]=[ids[j],ids[i]];g.cursor=Math.max(0,ids.indexOf(nextRid));save();reopenGroup(gid);}
function setGroupCursor(gid,i){const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;g.cursor=i;save();reopenGroup(gid);toast('Next workout set','green');}
function toggleGroupDay(gid,rid,dow){const g=(S.groups||[]).find(x=>x.id===gid);if(!g)return;if(!g.dayMap)g.dayMap={};if(!g.dayMap[rid])g.dayMap[rid]=[];const arr=g.dayMap[rid];const idx=arr.indexOf(dow);if(idx>=0)arr.splice(idx,1);else arr.push(dow);save();reopenGroup(gid);}
function deleteGroup(gid){
  const inProg=S.program&&(S.program.phases||[]).some(ph=>ph.groupId===gid);
  customConfirm('Delete this split? Your workouts are kept.'+(inProg?'<br>It is also removed from your timed program.':''),'Delete',()=>{
    S.groups=(S.groups||[]).filter(g=>g.id!==gid);
    if(inProg){S.program.phases=S.program.phases.filter(ph=>ph.groupId!==gid);if(!S.program.phases.length)S.program=null;}
    save();closeOv('gd-ov');S.libTab='groups';renderLibrary(document.getElementById('content'));
  });
}
