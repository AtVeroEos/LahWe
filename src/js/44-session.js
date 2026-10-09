// ═══════════════════════════════════════════════════
// SESSION — the live workout screen
// ═══════════════════════════════════════════════════
function getLastRSess(rid){return S.workouts.find(w=>w.routineId===rid);}
// The sets you actually completed last time for this exercise: first from the same routine,
// otherwise from the most recent workout that included it. Card-deck sessions don't count.
function lastSetsFor(exId,rid){
  const pick=wk=>{
    for(const ex of wk.exercises){if(ex.exId===exId){const done=ex.sets.filter(s=>s.done&&!s.excl);if(done.length)return done;}}
    return null;
  };
  if(rid){const sess=getLastRSess(rid);if(sess){const d=pick(sess);if(d)return d;}}
  for(const wk of S.workouts){if(wk.type==='cardDeck')continue;const d=pick(wk);if(d)return d;}
  return null;
}
// Prefill source for a new session. Warmups come back flagged as warmups (they used to come
// back as working sets, which inflated volume and made "+ Set" flatten everything).
function getAutoFill(exId,rid){
  const d=lastSetsFor(exId,rid);
  return d?d.map(s=>({w:s.w,r:s.r,warmup:!!s.warmup})):null;
}
function getLastStr(exId,rid){
  const d=lastSetsFor(exId,rid);if(!d)return null;
  const work=d.filter(s=>!s.warmup);if(!work.length)return null;
  const timed=!!(getSessionEx(exId)||{}).timed;
  const top=work.reduce((a,s)=>(parseFloat(s.w)||0)>(parseFloat(a.w)||0)?s:a,work[0]);
  const w=parseFloat(top.w)||0;
  const what=timed?`${top.r||'?'}s`:w?`${top.w}${S.unit}×${top.r||'?'}`:`${top.r||'?'} reps`;
  return`Last: ${what} · ${work.length} set${work.length===1?'':'s'}`;
}
function getSessionEx(exId){const wk=S.activeWorkout;return wk?wk.exercises.find(e=>e.exId===exId):null;}

// ─── Proportional autofill + warmups ───
const WARMUP_RAMP={1:[0.6],2:[0.5,0.7],3:[0.4,0.6,0.8]};
function loadInc(eq,weight){
  if(isKg()){
    if(eq==='Dumbbell'||eq==='Machine'||eq==='Cable')return weight>=45?2.5:1;
    return 2.5;
  }
  if(eq==='Dumbbell'||eq==='Machine'||eq==='Cable')return weight>=100?5:2.5;
  return 5; // Barbell, Kettlebell, Medicine Ball, Other, added-load Bodyweight
}
function roundTo(raw,inc){return Math.round(raw/inc)*inc;}
function jumpFor(weight,eq){const inc=loadInc(eq,weight);return Math.max(inc,roundTo(weight*0.025,inc));}
function warmupPcts(n){return WARMUP_RAMP[n]||Array.from({length:n},(_,i)=>0.4+(0.45*i/(n-1||1)));}
// Weight the next auto set should get, given the previous working set.
function nextAutoWeight(w0,base,mode,eq){
  if(mode==='ascend'){const a=base+jumpFor(base,eq);return roundTo(a,loadInc(eq,a));}
  if(mode==='descend'){const a=base-jumpFor(base,eq);return Math.max(loadInc(eq,base),roundTo(a,loadInc(eq,a)));}
  return w0; // straight sets repeat the first working set exactly
}
function warmupWeight(w0,pct,eq){const raw=w0*pct,inc=loadInc(eq,raw);return Math.max(inc,roundTo(raw,inc));}
// Any set whose weight differs from what the auto rules would produce was chosen by the lifter
// (a ramp, a back-off set, a custom warmup). Mark it manual so recalcExercise() leaves it alone.
function markManualSets(ex){
  const eq=getEx(ex.exId)?.eq||'Other';const mode=ex.progression||'flat';
  const working=ex.sets.filter(s=>!s.warmup);
  const w0=working.length?parseFloat(working[0].w):NaN;
  if(isNaN(w0))return;
  let base=w0;
  for(let k=1;k<working.length;k++){
    const s=working[k];const v=parseFloat(s.w);
    if(!isNaN(v)){if(v!==nextAutoWeight(w0,base,mode,eq))s._manual=true;base=v;}
  }
  const warm=ex.sets.filter(s=>s.warmup);const pcts=warmupPcts(warm.length);
  warm.forEach((s,i)=>{const v=parseFloat(s.w);if(!isNaN(v)&&v!==warmupWeight(w0,pcts[i],eq))s._manual=true;});
}
// Build one exercise for a live session. `re` is the routine entry (null for an ad-hoc add).
function sessionExercise(exId,rid,re){
  const prog=(re&&(re.type||re.progression))||'flat';
  const timed=!!(re&&re.timed);
  const fill=getAutoFill(exId,rid);
  const warm=fill?fill.filter(f=>f.warmup):[];
  const work=fill?fill.filter(f=>!f.warmup):[];
  const nTarget=re&&parseInt(re.sets)>0?parseInt(re.sets):0;
  // The routine decides how many working sets; last session decides the load.
  const n=nTarget||work.length||3;
  const fixedReps=re&&re.r&&!re.rMax&&!re.amrap?String(re.r):'';
  const blank=()=>({w:'',r:'',done:false,tag:'',warmup:false,_manual:false});
  const sets=[];
  for(let k=0;k<n;k++){
    const src=work[k]||work[work.length-1]||null;
    const s=blank();
    s.w=src&&src.w!=null?String(src.w):String((re&&re.w)||'');
    if(re&&re.amrap&&!re.r)s.r='';
    else s.r=fixedReps||(src&&src.r!=null&&src.r!==''?String(src.r):String((re&&re.r)||''));
    sets.push(s);
  }
  const wsets=warm.map(f=>{const s=blank();s.warmup=true;s.w=f.w!=null?String(f.w):'';s.r=f.r!=null?String(f.r):'';return s;});
  const ex={exId,sets:[...wsets,...sets],_af:!!fill,progression:prog,
    rest:re&&re.rest!=null?re.rest:null,link:(re&&re.link)||null,timed,
    target:re?{sets:nTarget,r:re.r||'',rMax:re.rMax||'',amrap:!!re.amrap,timed}:null,
    note:(re&&re.note)||''};
  // What to aim for today: the coach's numbers if you asked for them, otherwise the built-in rule.
  const aim=aimFor(exId,rid,re);
  if(aim)ex.aim=aim;
  markManualSets(ex);
  return ex;
}
function startWorkout(rid){
  // A workout is already open: go to it. Replacing it here used to throw its logged sets away.
  if(S.activeWorkout){
    document.querySelectorAll('.ov').forEach(o=>o.remove());
    go('workout');
    toast('Finish or discard the workout you have open first','',{ms:3500});
    return;
  }
  const r=rid?S.routines.find(x=>x.id===rid):null;
  S.activeWorkout={id:uid(),routineId:r?r.id:null,
    name:r?(r.name||'Workout'):`Workout — ${new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}`,
    started:Date.now(),exercises:[],notes:'',_origExIds:null,_origProgression:{}};
  if(r){
    S.activeWorkout._origExIds=r.exercises.map(e=>e.exId);
    r.exercises.forEach(re=>{
      if(!getEx(re.exId))return; // exercise was deleted from the library
      const ex=sessionExercise(re.exId,r.id,re);
      S.activeWorkout._origProgression[re.exId]=ex.progression;
      S.activeWorkout.exercises.push(ex);
    });
  }
  S.restTimer=null;
  saveNow();
  // Started from the Library or a sheet: go to it. (It used to start and stay hidden behind the tab you were on.)
  if(S.tab!=='workout')go('workout');else render();
  startWtTimer();
}
function setRowHTML(ex,ei,s,si,num){
  const isWarm=!!s.warmup;
  const c=prCandidate(ex,s);const est=c?c.est:null;
  const pr=S.prs[ex.exId];
  const isPR=!!(c&&pr&&pr.live&&c.est===pr.est&&c.w===pr.w);
  const t=ex.target;
  const rph=t&&!isWarm?(fmtRepTarget(t)||'–'):'–';
  return`<div class="srow${s.done?' done':''}${isWarm?' warm':''}${s.fail?' failed':''}${s.skip&&!s.done?' skipped':''}" id="sr-${ei}-${si}">
    <div class="snum">${isWarm?'W':s.fail?'F':s.skip&&!s.done?'–':num}</div>
    <input class="sinp" type="number" inputmode="decimal" placeholder="–" value="${esc(s.w||'')}" onchange="upd(${ei},${si},'w',this.value)"${s.done?' disabled':''}>
    <input class="sinp" type="number" inputmode="numeric" placeholder="${esc(rph)}" value="${esc(s.r||'')}" onchange="upd(${ei},${si},'r',this.value)"${s.done?' disabled':''}>
    <div class="e1rm-cell">${est?`<div class="e1rm-badge${isPR?' pr':''}">${isPR?'PR ':''}${est}</div>`:''}</div>
    <div class="chk${s.done?' done':''}" role="button" aria-label="Set done" onclick="togSet(${ei},${si})">${ICON('tick',18)}</div>
    <div class="tag-btn${s.tag?' tagged':''}" role="button" aria-label="Tag set" onclick="toggleTagRow(${ei},${si})">${s.tag?esc(s.tag==='RPE 8'?'8':s.tag[0]):ICON('tag',15)}</div>
  </div>
  ${s._showTag?`<div class="tag-row">${['Easy','RPE 8','Hard','Form Issue','Pain'].map(tg=>`<div class="tag-chip${s.tag===tg?' on':''}${tg==='Pain'?' pain':''}" onclick="setTag(${ei},${si},'${tg}')">${tg}</div>`).join('')}${s.tag?`<div class="tag-chip on" onclick="setTag(${ei},${si},'')">✕ Clear</div>`:''}</div>`:''}`;
}
function renderSession(c){
  const wk=S.activeWorkout;if(!wk){render();return;}
  if(wk._swipe){renderSwipe(c);return;} // Swipe Check: the same workout, one set at a time
  const el=Math.floor((Date.now()-wk.started)/1000);
  const doneSets=doneSetCnt(wk);const vol=Math.round(totalVol(wk));
  const painWs=getPainWarnings().filter(p=>wk.exercises.some(e=>e.exId===p.exId));
  let html=`<div class="fbar">
    <div class="fbar-name">${esc(wk.name)}</div>
    <span id="rest-pill" onclick="skipRest()"><span id="rest-pill-t"></span><span class="rp-x">✕</span></span>
    <span id="wt-el" class="wt">${fmtTimer(el)}</span>
    ${wk.exercises.length?`<button class="btn bts bsm" onclick="showSwipeStart()" aria-label="Swipe through your sets">${ICON('swap',14)} Swipe</button>`:''}
    <button class="btn btp bsm" onclick="showFinish()">Finish</button>
  </div>
  ${musicBarHTML()}
  <div class="sess-stats">
    <div><b id="ss-sets">${doneSets}</b><span>Sets</span></div>
    <div><b id="ss-vol">${vol.toLocaleString()}</b><span>${S.unit}</span></div>
    <div><b>${wk.exercises.length}</b><span>Lifts</span></div>
  </div>`;
  if(painWs.length)html+=`<div class="pain-banner">${ICON('alert',14)} Pain flagged on ${painWs.map(p=>esc(p.name)).join(', ')}. Go lighter, or use Swap.</div>`;
  if(!wk.exercises.length)html+=`<div class="empty" style="padding:44px 20px"><div style="margin-bottom:12px;color:var(--muted2)">${ICON('dumbbell',34)}</div><div class="etit">No exercises yet</div><p style="font-size:12px">Tap below to add your first</p></div>`;
  let aimHinted=wk.exercises.some(e=>e.aimUsed);
  const _ssG=ssGroups(wk.exercises);
  const _ssMap={};_ssG.forEach(g=>{for(let k=g.start;k<=g.end;k++)_ssMap[k]=g;});
  wk.exercises.forEach((ex,ei)=>{
    const info=getEx(ex.exId);const pr=S.prs[ex.exId];
    const painLvl=getExPainLevel(ex.exId);
    const inSS=_ssMap[ei];const isSSStart=inSS&&inSS.start===ei;const isSSEnd=inSS&&inSS.end===ei;
    const rest=exRestFor(ex.exId);
    const tgt=ex.target?fmtTarget(ex.target):'';
    const linked=!!(ex.link&&wk.exercises[ei+1]&&wk.exercises[ei+1].link===ex.link);
    if(isSSStart){const cnt=inSS.end-inSS.start+1;html+=`<div class="ss-wrap"><div class="ss-lbl">${ssLabel(cnt)}</div>`;}
    const a=ex.aim||null;
    const facts=[];
    if(tgt)facts.push(`<div class="fact"><span>Plan</span><b>${esc(tgt)}</b></div>`);
    // Last is a button too: it copies last session's sets into the ones still to do (Aim is the target; Last is what you did).
    if(a&&a.from)facts.push(`<button class="fact fact-last" onclick="applyLast(${ei})" aria-label="Copy last session into the sets to do"><span>Last</span><b>${esc(fmtFrom(a,ex.timed))}</b></button>`);
    if(a)facts.push(`<button class="fact fact-aim aim-${a.kind}" onclick="applyAim(${ei})" aria-label="Fill in the aim"><span>${a.by==='coach'?'Coach aim':'Aim'} ${aimIcon(a,11)}</span><b>${esc(fmtAim(a,ex.timed))}</b></button>`);
    html+=`<div class="exb" id="exb-${ei}">
      <div class="exbh">
        <div class="exbn">${esc(info?.name||'Unknown exercise')}${ex._af?`<span class="afill-tag">auto</span>`:''}</div>
        <div class="exbc">${esc(info?.cat||'')} · ${esc(info?.eq||'')}${pr&&!ex.timed?` · <span class="exb-pr">PR ${pr.w} × ${pr.r}</span>`:''}${ex._swappedFrom?` · <span class="exb-sw">in for ${esc(exName(ex._swappedFrom))}</span>`:''}</div>
        ${facts.length?`<div class="facts">${facts.join('')}</div>`:''}
        ${a&&a.why?`<div class="ex-why">${esc(a.why)}${!aimHinted&&!ex.aimUsed?(aimHinted=true,' Tap the aim to fill it in.'):''}</div>`:''}
        ${ex.note?`<div class="ex-note">${esc(ex.note)}</div>`:''}
        ${painLvl>=2?`<div class="ex-pain">${ICON('alert',12)} Pain reported in ${painLvl} of the last 3 sessions. Go lighter or swap it.</div>`:''}
        <div class="exb-acts">
          <button class="ib ib-wide" onclick="showRestPicker(${jsq(ex.exId)})" aria-label="Rest timer">${ICON('timer',14)} ${rest>=60?fmtMS(rest):`${rest}s`}</button>
          ${ex.timed?'':`<button class="ib" onclick="showPlateCalc(${ei})" aria-label="Plate calculator">${ICON('grid',16)}</button>`}
          <button class="ib ib-wide" onclick="showSwap(${ei})" aria-label="Swap exercise">${ICON('swap',15)}<span class="ib-lbl">Swap</span></button>
          <span style="flex:1"></span>
          <button class="ib ib-q" onclick="showExMenu(${ei})" aria-label="More for this exercise">${ICON('more',18)}</button>
        </div>
      </div>
      <div class="slbls"><div class="sl">#</div><div class="sl">Wt (${S.unit})</div><div class="sl">${ex.timed?'Sec':'Reps'}</div><div class="sl">${ex.timed?'':'e1RM'}</div><div class="sl"></div><div class="sl"></div></div>`;
    let wsn=0;
    ex.sets.forEach((s,si)=>{if(!s.warmup)wsn++;html+=setRowHTML(ex,ei,s,si,wsn);});
    html+=`<div class="exb-foot">
      <button class="fbtn" onclick="addSet(${ei})">${ICON('plus',14)} Set</button>
      <button class="fbtn fbtn-q" onclick="addWarmup(${ei})">${ICON('plus',14)} Warmup</button>
      <button class="fbtn fbtn-q" onclick="rmLastSet(${ei})">− Set</button>
      ${info&&info.eq==='Bodyweight'&&!ex.timed?`<button class="fbtn fbtn-q" onclick="showPyramid(${ei})" aria-label="Pyramid the reps">${ICON('arrowup',14)} Pyramid</button>`:''}
      ${ei<wk.exercises.length-1?`<button class="fbtn fbtn-q ss-link-btn${linked?' linked':''}" onclick="toggleSessionLink(${ei})">${ICON('link',14)} ${linked?'Unlink':'Link'}</button>`:''}
    </div></div>`;
    if(isSSEnd)html+=`</div>`; // close .ss-wrap
  });
  html+=`<div class="sess-end">
    <button class="btn bts bfw" onclick="showExPicker()">${ICON('plus',16)} Add Exercise</button>
    <button class="btn btg" style="color:var(--red)" onclick="confirmCancel()">Cancel</button>
  </div>`;
  c.innerHTML=html;startWtTimer();
  if(S.restTimer&&!rInt)runRestTicker();else syncRestUI();
}
// Recompute every auto (non-manual, non-completed) set for one exercise.
// Working sets follow the first working set; warmups ramp off it.
function recalcExercise(ei){
  const wk=S.activeWorkout;if(!wk)return;
  const ex=wk.exercises[ei];if(!ex)return;
  const eq=getEx(ex.exId)?.eq||'Other';
  const working=ex.sets.filter(s=>!s.warmup);
  const w0=working.length?parseFloat(working[0].w):NaN;
  const mode=ex.progression||'flat';
  if(!isNaN(w0)){
    let base=w0;
    for(let k=1;k<working.length;k++){
      const s=working[k];
      if(!s.done&&!s._manual)s.w=String(nextAutoWeight(w0,base,mode,eq));
      const sv=parseFloat(s.w);if(!isNaN(sv))base=sv;
    }
    const warm=ex.sets.filter(s=>s.warmup);
    const pcts=warmupPcts(warm.length);
    warm.forEach((s,i)=>{if(!s.done&&!s._manual)s.w=String(warmupWeight(w0,pcts[i],eq));});
  }
  save();
}
function setInputs(ei,si){
  const q=n=>document.querySelector(`#sr-${ei}-${si} input:nth-of-type(${n})`);
  return{w:q(1),r:q(2)};
}
function syncExInputs(ei){
  const ex=S.activeWorkout?.exercises[ei];if(!ex)return;
  ex.sets.forEach((s,si)=>{
    const wi=setInputs(ei,si).w;
    if(wi&&document.activeElement!==wi)wi.value=s.w||'';
  });
}
function upd(ei,si,f,v){
  const ex=S.activeWorkout?.exercises[ei];const s=ex&&ex.sets[si];if(!s)return;
  s[f]=v;
  if(f==='w'){s._manual=(v!==''&&v!=null);recalcExercise(ei);syncExInputs(ei);}
  else save();
}
function refreshSessionStats(){
  const wk=S.activeWorkout;if(!wk)return;
  const a=document.getElementById('ss-sets');if(a)a.textContent=doneSetCnt(wk);
  const b=document.getElementById('ss-vol');if(b)b.textContent=Math.round(totalVol(wk)).toLocaleString();
}
function togSet(ei,si){
  const wk=S.activeWorkout;if(!wk)return;
  const ex=wk.exercises[ei];const s=ex&&ex.sets[si];if(!s)return;
  const inp=setInputs(ei,si);
  if(inp.w)s.w=inp.w.value;if(inp.r)s.r=inp.r.value;
  const prior=priorBest(ex.exId);
  const livePrev=(S.prs[ex.exId]&&S.prs[ex.exId].live)?S.prs[ex.exId].est:0;
  s.done=!s.done;
  if(s.done){s.t=Date.now();delete s.skip;}else{delete s.t;delete s.fail;} // a set is done, failed or skipped, never two at once
  rebuildPRs();
  if(s.done){
    const c=prCandidate(ex,s);
    if(c&&c.est>(prior?prior.est:0)&&c.est>livePrev)toast(`New record: ${exName(ex.exId)} ${c.w} ${S.unit} × ${c.r}`,'gold');
    if(isLastInSuperset(ei)){const rest=exRestFor(ex.exId);if(rest>0)startRest(rest);else skipRest();}
  }
  save();
  // Redraw just this exercise's rows: the PR badge can move between sets.
  let wsn=0;
  ex.sets.forEach((x,xi)=>{
    if(!x.warmup)wsn++;
    const row=document.getElementById(`sr-${ei}-${xi}`);if(!row)return;
    const tmp=document.createElement('div');tmp.innerHTML=setRowHTML(ex,ei,x,xi,wsn);
    const fresh=tmp.firstElementChild;
    if(fresh&&document.activeElement&&row.contains(document.activeElement)&&xi!==si)return; // don't yank focus from another row
    if(fresh)row.replaceWith(fresh);
  });
  refreshSessionStats();
}
function toggleTagRow(ei,si){const s=S.activeWorkout?.exercises[ei]?.sets[si];if(!s)return;s._showTag=!s._showTag;renderSession(document.getElementById('content'));}
function setTag(ei,si,tag){const s=S.activeWorkout?.exercises[ei]?.sets[si];if(!s)return;s.tag=tag;s._showTag=false;save();renderSession(document.getElementById('content'));}
function addSet(ei){
  const ex=S.activeWorkout?.exercises[ei];if(!ex)return;
  const working=ex.sets.filter(s=>!s.warmup);
  const last=working[working.length-1];
  const ns={w:'',r:last?.r||'',done:false,tag:'',warmup:false,_manual:false};
  ex.sets.push(ns);
  recalcExercise(ei);
  // Straight sets: "one more" means one more at the weight you just used, not back at set 1.
  if((ex.progression||'flat')==='flat'&&last&&last.w!==''&&last.w!=null&&String(last.w)!==ns.w){ns.w=String(last.w);ns._manual=true;save();}
  renderSession(document.getElementById('content'));
  setTimeout(()=>{const rows=document.querySelectorAll(`#exb-${ei} .srow`);rows[rows.length-1]?.scrollIntoView({behavior:'smooth',block:'nearest'});},60);
}
function addWarmup(ei){
  const ex=S.activeWorkout?.exercises[ei];if(!ex)return;
  let idx=0;while(idx<ex.sets.length&&ex.sets[idx].warmup)idx++;
  ex.sets.splice(idx,0,{w:'',r:'',done:false,tag:'',warmup:true,_manual:false});
  recalcExercise(ei);renderSession(document.getElementById('content'));
}
// Removing things mid-workout is one sweaty mis-tap away, so both removals can be undone.
function rmLastSet(ei){
  const ex=S.activeWorkout?.exercises[ei];if(!ex||ex.sets.length<=1)return;
  const removed=ex.sets.pop();
  rebuildPRs();save();renderSession(document.getElementById('content'));
  if(removed.done)toast('Completed set removed','gold',{action:'Undo',onAction:()=>{
    const cur=S.activeWorkout?.exercises[ei];if(!cur||cur.exId!==ex.exId)return;
    cur.sets.push(removed);rebuildPRs();save();renderSession(document.getElementById('content'));
  }});
}
function removeEx(ei){
  const wk=S.activeWorkout;if(!wk||!wk.exercises[ei])return;
  const [removed]=wk.exercises.splice(ei,1);
  cleanSessionLinks();rebuildPRs();save();renderSession(document.getElementById('content'));
  toast(`${exName(removed.exId)} removed`,'gold',{action:'Undo',onAction:()=>{
    if(S.activeWorkout!==wk)return;
    wk.exercises.splice(Math.min(ei,wk.exercises.length),0,removed);
    rebuildPRs();save();renderSession(document.getElementById('content'));
  }});
}
function moveExInSession(ei,dir){
  if(!S.activeWorkout)return;
  const arr=S.activeWorkout.exercises;const j=ei+dir;
  if(j<0||j>=arr.length)return;
  [arr[ei],arr[j]]=[arr[j],arr[ei]];
  cleanSessionLinks();save();renderSession(document.getElementById('content'));
  setTimeout(()=>{document.getElementById(`exb-${j}`)?.scrollIntoView({behavior:'smooth',block:'nearest'});},60);
}
function cleanSessionLinks(){
  if(!S.activeWorkout)return;
  const arr=S.activeWorkout.exercises;
  arr.forEach((ex,i)=>{
    if(!ex.link)return;
    const prev=i>0&&arr[i-1].link===ex.link;
    const next=i<arr.length-1&&arr[i+1].link===ex.link;
    if(!prev&&!next)ex.link=null;
  });
}
function endSessionTimers(){if(wtInt)clearInterval(wtInt);wtInt=null;skipRest();}
function confirmCancel(){
  const n=S.activeWorkout?doneSetCnt(S.activeWorkout):0;
  customConfirm(n?`This workout and its ${n} logged set${n===1?'':'s'} will not be saved.`:'This workout will not be saved.','Discard workout',()=>{
    S.activeWorkout=null;endSessionTimers();rebuildPRs();saveNow();render();
  });
}
// Less-used actions for one exercise live behind one button, so the row never wraps on a small phone.
function showExMenu(ei){
  const wk=S.activeWorkout;const ex=wk&&wk.exercises[ei];if(!ex)return;
  const row=(icon,label,js,cls)=>`<button class="row row-tap${cls||''}" onclick="closeOv('exm-ov');${js}"><span class="row-ic">${ICON(icon,17)}</span><span class="row-main"><span class="row-t">${label}</span></span></button>`;
  const ov=makeOv('exm-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">${esc(exName(ex.exId))}</div><div class="list">
    ${ei>0?row('arrowup','Move up',`moveExInSession(${ei},-1)`):''}
    ${ei<wk.exercises.length-1?row('arrowdown','Move down',`moveExInSession(${ei},1)`):''}
    ${row('swap','Swap for another exercise',`setTimeout(()=>showSwap(${ei}),240)`)}
    ${row('x','Remove from this workout',`removeEx(${ei})`,' row-danger')}
  </div><button class="btn btg bfw" onclick="closeOv('exm-ov')">Cancel</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
// ─── Plate Calc ───
function showPlateCalc(ei){
  const ex=S.activeWorkout?.exercises[ei];
  const next=ex?.sets.find(s=>!s.done&&!s.warmup&&s.w)||ex?.sets.find(s=>!s.done&&s.w);
  const lastW=next?.w||ex?.sets.filter(s=>s.done).slice(-1)[0]?.w||ex?.sets[0]?.w||'';
  const ov=makeOv('plate-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div class="mt" style="margin-bottom:0">Plate Calculator</div>
    </div>
    <div class="fg"><label class="fl">Target Weight (${S.unit})</label><input type="number" inputmode="decimal" id="plt-tgt" value="${esc(lastW)}" placeholder="0" oninput="calcPltDisp()"></div>
    <div class="fg"><label class="fl">Bar Weight</label><select id="plt-bar" onchange="calcPltDisp()">
      <option value="${isKg()?20:45}">${isKg()?'20kg':'45 lbs'} Standard</option>
      <option value="${isKg()?15:35}">${isKg()?'15kg':'35 lbs'} Light</option>
      <option value="${isKg()?10:25}">${isKg()?'10kg':"25 lbs Women's"}</option>
    </select></div>
    <div id="plt-result"></div>
    <button class="btn btg bfw" style="margin-top:12px" onclick="closeOv('plate-ov')">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);calcPltDisp();
}
function calcPltDisp(){
  const tgt=parseFloat(document.getElementById('plt-tgt')?.value);
  const bar=parseFloat(document.getElementById('plt-bar')?.value)||(isKg()?20:45);
  const el=document.getElementById('plt-result');if(!el)return;
  if(!tgt){el.innerHTML='';return;}
  const side=(tgt-bar)/2;
  if(side<0){el.innerHTML=`<div style="color:var(--red);font-size:13px;text-align:center;padding:12px">Below bar weight (${bar}${S.unit})</div>`;return;}
  const sets=isKg()?[25,20,15,10,5,2.5,1.25]:[45,35,25,10,5,2.5,1.25];
  let rem=side;const plates=[];
  for(const p of sets){const n=Math.floor(rem/p+0.001);if(n>0){plates.push({w:p,n});rem-=p*n;}}
  const all=plates.flatMap(p=>Array(p.n).fill(p.w));
  const big=isKg()?[25,20,15,10,5]:[45,35,25,10,5];
  const cls=w=>w>=big[0]?'p45':w>=big[1]?'p35':w>=big[2]?'p25':w>=big[3]?'p10':w>=big[4]?'p5':'p2';
  el.innerHTML=`<div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:8px;font-weight:600;">Each side · bar ${bar}${S.unit}</div>
    <div class="plate-visual">${all.length?all.map(w=>`<div class="plate ${cls(w)}">${w}</div>`).join(''):'<div style="color:var(--muted);font-size:12px">Just the bar</div>'}</div>
    ${rem>0.01?`<div style="text-align:center;font-size:12px;color:var(--gold);font-weight:600">~${rem.toFixed(2)}${S.unit} remainder</div>`:''}`;
}

// ─── Finish workout ───
// Wall-clock vs time actually spent training; the gap is idle time after the last set.
function sessionTiming(wk,now){
  now=now||Date.now();
  const wall=now-wk.started;
  const active=workoutActiveMs(Object.assign({},wk,{ended:now}));
  return{wall,active,trimmed:wall-active>10*60000};
}
function showFinish(){
  const wk=S.activeWorkout;if(!wk)return;
  const tm=sessionTiming(wk);const dur=tm.trimmed?tm.active:tm.wall;const cals=sessionCals(tm.active);
  const prs=getPRsFromSess(wk);const diff=getRoutineDiff(wk);
  const ov=makeOv('fin-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Finish Workout</div>
    <div class="fg"><label class="fl">Name</label><input type="text" id="wkn" value="${esc(wk.name)}"></div>
    <div style="margin-bottom:13px"><div class="sgrid" style="border-radius:10px;overflow:hidden;border:1px solid var(--border)">
      <div class="sc"><div class="sv">${fmtDur(dur)}</div><div class="slb">Duration</div></div>
      <div class="sc"><div class="sv">${doneSetCnt(wk)}</div><div class="slb">Sets</div></div>
      <div class="sc"><div class="sv">${Math.round(totalVol(wk)).toLocaleString()}</div><div class="slb">Vol (${S.unit})</div></div>
      <div class="sc"><div class="sv">${cals}</div><div class="slb">~kcal</div></div>
    </div>
    ${tm.trimmed?`<div style="font-size:12px;color:var(--muted);margin-top:6px;line-height:1.45">This session sat open for ${fmtDur(tm.wall)}. Duration and calories stop 5 minutes after your last logged set.</div>`:''}
    </div>
    ${prs.length?`<div style="background:var(--gdim);border:1px solid rgba(184,124,42,.22);border-radius:10px;padding:10px 16px;margin-bottom:12px;color:var(--gold);font-size:13px;font-weight:600">${ICON('trophy',15)} New PR${prs.length>1?'s':''}: ${prs.map(esc).join(', ')}</div>`:''}
    ${diff?`<div style="background:var(--bdim);border:1px solid rgba(42,111,196,.18);border-radius:10px;padding:11px 16px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;color:var(--blue);margin-bottom:7px">Changes to this workout</div>
      ${(diff.swapped||[]).map(n=>`<div style="color:var(--navy);font-size:12px;font-weight:500">⇄ ${esc(n)}</div>`).join('')}
      ${diff.added.map(n=>`<div style="color:var(--green);font-size:12px;font-weight:500">+ ${esc(n)}</div>`).join('')}
      ${diff.changed.map(n=>`<div style="color:var(--gold);font-size:12px;font-weight:500">~ ${esc(n)}</div>`).join('')}
      <button class="btn btb bsm bfw" style="margin-top:8px" onclick="saveRoutineChanges(${jsq(wk.routineId)})">Save to the workout</button>
    </div>`:''}
    ${S.trackFeel?`<div class="fg"><label class="fl">How did it go? <small>optional</small></label><div class="feel-row" id="fin-feel" role="group" aria-label="How did it go">${FEEL_LABELS.map((l,i)=>`<button class="chip${wk.feel===i+1?' on':''}" data-f="${i+1}" aria-pressed="${wk.feel===i+1?'true':'false'}" onclick="setFeel(${i+1})">${l}</button>`).join('')}</div></div>`:''}
    <div class="fg"><label class="fl">Notes</label><textarea id="wknt" style="min-height:55px;font-size:13px" placeholder="Anything worth remembering">${esc(wk.notes||'')}</textarea></div>
    <button class="btn btp bfw" onclick="saveWorkout()">Save Workout</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('fin-ov')">Continue Workout</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
// One tap at Finish: how the session went. It is what lets Patterns ask what a good day has in common.
const FEEL_LABELS=['Rough','Flat','Okay','Good','Great'];
function setFeel(n){
  const wk=S.activeWorkout;if(!wk)return;
  if(wk.feel===n)delete wk.feel;else wk.feel=n; // a second tap takes it back
  save();
  document.querySelectorAll('#fin-feel .chip').forEach(b=>{const on=+b.dataset.f===wk.feel;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');});
}
// Exercises whose all-time best now sits in this workout.
function getPRsFromSess(wk){
  rebuildPRs();
  const names=[];
  wk.exercises.forEach(ex=>{const pr=S.prs[ex.exId];if(pr&&pr.wkId===wk.id){const n=exName(ex.exId);if(!names.includes(n))names.push(n);}});
  return names;
}
function getRoutineDiff(wk){
  if(!wk.routineId||!wk._origExIds)return null;
  const orig=wk._origExIds;const now=wk.exercises.map(e=>e.exId);
  const swaps=sessionSwaps(wk);const swapTo=new Set(swaps.map(x=>x.to));
  const added=now.filter(id=>!orig.includes(id)&&!swapTo.has(id)).map(exName);
  const changed=[];const ls=getLastRSess(wk.routineId);
  const firstDone=ex=>parseFloat(ex.sets.find(s=>s.done&&!s.warmup)?.w||0);
  if(ls){wk.exercises.filter(ex=>orig.includes(ex.exId)).forEach(ex=>{const prev=ls.exercises.find(e=>e.exId===ex.exId);if(!prev)return;const cW=firstDone(ex);const pW=firstDone(prev);if(pW&&cW&&Math.abs(cW-pW)/pW>0.03)changed.push(`${exName(ex.exId)} (${pW}→${cW}${S.unit})`);});}
  if(!added.length&&!changed.length&&!swaps.length)return null;return{added,changed,swapped:swaps.map(x=>`${exName(x.from)} → ${exName(x.to)}`)};
}
// Copies this session's loads and set counts back to the routine. Rep targets (ranges, AMRAP,
// timed) are the plan, so they are left alone unless the routine had none.
function saveRoutineChanges(rid){
  const wk=S.activeWorkout;const r=S.routines.find(x=>x.id===rid);if(!r||!wk)return;
  // A swap replaces the routine's entry in place, so its sets, rep range, rest and superset link carry over.
  sessionSwaps(wk).forEach(sw=>{
    const rEx=r.exercises.find(e=>e.exId===sw.from);
    if(!rEx||r.exercises.some(e=>e.exId===sw.to))return;
    const hold=HOLD_EX.has(sw.to);
    if(!!rEx.timed!==hold){rEx.timed=hold;rEx.r='';rEx.rMax='';rEx.amrap=false;}
    rEx.exId=sw.to;rEx.w='';
  });
  wk.exercises.forEach(ex=>{
    const work=ex.sets.filter(s=>!s.warmup);if(!work.length)return;
    const best=work.filter(s=>s.done).sort((a,b)=>parseFloat(b.w||0)-parseFloat(a.w||0))[0];
    let rEx=r.exercises.find(e=>e.exId===ex.exId);
    if(!rEx){
      const bs=best||work[0];
      r.exercises.push({exId:ex.exId,sets:work.length,w:bs.w||'',r:bs.r||'',type:ex.progression||'flat',rest:ex.rest!=null?ex.rest:null,link:ex.link||null});
      return;
    }
    if(best){rEx.w=best.w;if(!rEx.r&&!rEx.rMax&&!rEx.amrap&&!rEx.timed)rEx.r=best.r;}
    rEx.sets=work.length;
  });
  wk._origExIds=r.exercises.map(e=>e.exId);
  save();toast('Workout updated','green');
}
function saveWorkout(){
  const wk=S.activeWorkout;if(!wk)return;
  const n=document.getElementById('wkn');const nt=document.getElementById('wknt');
  if(n)wk.name=n.value.trim()||wk.name;if(nt)wk.notes=nt.value;
  const now=Date.now();const tm=sessionTiming(wk,now);
  wk.ended=tm.trimmed?wk.started+tm.active:now;
  wk.cals=sessionCals(tm.active);
  // Session-only bookkeeping has no business in history.
  delete wk._origExIds;delete wk._origProgression;delete wk._swaps;delete wk._swipe;delete wk._swipeUndo;
  wk.exercises.forEach(ex=>{
    delete ex._af;delete ex.aimUsed;
    if(ex.aim)ex.aim={w:ex.aim.w,r:ex.aim.r,by:ex.aim.by}; // what you were aiming for, kept small
    ex.sets.forEach(s=>{delete s._showTag;delete s._manual;});
  });
  // Coach targets are for one session of the routine: used now, so they go.
  if(wk.routineId&&isObj(S.nextTargets)&&S.nextTargets[wk.routineId])delete S.nextTargets[wk.routineId];
  S.workouts.unshift(wk);S.activeWorkout=null;
  const _ag=getActiveGroup();
  if(_ag&&_ag.mode==='rotation'&&(_ag.routineIds||[]).length){
    const curId=_ag.routineIds[(_ag.cursor||0)%_ag.routineIds.length];
    if(wk.routineId===curId)_ag.cursor=((_ag.cursor||0)+1)%_ag.routineIds.length;
  }
  endSessionTimers();rebuildPRs();saveNow();
  document.getElementById('fin-ov')?.remove();
  toast('Workout saved!','green',aiReady()&&S.ai.logAccess?{action:'Debrief',onAction:()=>coachStart('debrief'),ms:6000}:undefined);render();
}

// ─── Exercise picker ───
function exPickRow(ex,chev){
  const pr=S.prs[ex.id];
  return`<div class="exi" onclick="pickEx(${jsq(ex.id)})"><div style="flex:1"><div class="exin">${esc(ex.name)}</div><div style="font-size:12px;color:var(--muted);margin-top:1px">${esc(ex.cat)} · ${esc(ex.eq)}</div></div>${pr?`<span class="badge bg" style="margin-right:5px">PR ${pr.w}${S.unit}</span>`:''}${chev?`<span style="color:var(--muted2);font-size:16px">›</span>`:''}</div>`;
}
function showExPicker(routineId){
  const isWorkout=!routineId&&S.activeWorkout;
  const recentIds=isWorkout?getRecentExIds(8):[];
  const ov=makeOv('ex-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:13px">
      <div class="mt" style="margin-bottom:0">Add Exercise</div>
      <button class="btn bts bsm" onclick="showCustomEx()">+ Custom</button>
    </div>
    <div style="margin-bottom:10px"><div class="sec-lbl" style="padding:0 0 6px">Equipment</div>
      <div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px">
        ${EQUIPMENT_PRESETS.map(p=>`<div class="chip${(S.equipPreset||'full')===p.id?' on':''}" style="flex-shrink:0" data-eq="${p.id}" onclick="setPickerEquip('${p.id}')">${ICON(p.icon,14)} ${p.label}</div>`).join('')}
      </div>
    </div>
    <div class="sw" style="padding:0 0 9px"><input id="ex-srch" placeholder="Search exercises…" oninput="renderPickerList()" style="width:100%"></div>
    <div class="fr" style="padding:0 0 7px;margin-bottom:5px" id="ex-chips">${CATS.map(cat=>`<div class="chip${(S.exFilter||'All')===cat?' on':''}" onclick="setFilter('${cat}')">${cat}</div>`).join('')}</div>
    ${recentIds.length?`<div style="padding:0 0 8px"><div class="sec-lbl" style="padding:2px 0 6px;font-size:12px">Recent</div>
      <div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:4px">
        ${recentIds.map(id=>{const ex=getEx(id);return ex?exPickRow(ex,true):'';}).join('')}
      </div>
    </div>`:''}
    <div id="ex-list"></div>
    <button class="btn btg bfw" style="margin-top:9px" onclick="closeOv('ex-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);window._pickRid=routineId;renderPickerList();
}
function setPickerEquip(id){S.equipPreset=id;save();document.querySelectorAll('#ex-ov .chip[data-eq]').forEach(c=>c.classList.toggle('on',c.dataset.eq===id));renderPickerList();}
function renderPickerList(){
  const q=(document.getElementById('ex-srch')?.value||'').toLowerCase();const cat=S.exFilter||'All';
  const preset=EQUIPMENT_PRESETS.find(p=>p.id===(S.equipPreset||'full'))||EQUIPMENT_PRESETS[0];
  let exs=allEx();if(preset.eqs)exs=exs.filter(e=>preset.eqs.includes(e.eq));
  if(cat!=='All')exs=exs.filter(e=>e.cat===cat);if(q)exs=exs.filter(e=>e.name.toLowerCase().includes(q));
  const el=document.getElementById('ex-list');if(!el)return;
  if(!exs.length){el.innerHTML=`<div class="empty" style="padding:24px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('search',30)}</div><div class="etit" style="font-size:14px">No results</div><div style="font-size:12px;color:var(--muted);margin-top:4px">Try a different filter</div></div>`;return;}
  el.innerHTML=`<div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden">${exs.map(e=>exPickRow(e,false)).join('')}</div>`;
}
function setFilter(cat){S.exFilter=cat;document.querySelectorAll('#ex-chips .chip').forEach(ch=>ch.classList.toggle('on',ch.textContent===cat));renderPickerList();}
function pickEx(exId){
  closeOv('ex-ov');
  setTimeout(()=>{
    if(window._pickRid){addExToRoutine(window._pickRid,exId);}
    else if(S.activeWorkout){
      S.activeWorkout.exercises.push(sessionExercise(exId,S.activeWorkout.routineId,null));
      save();renderSession(document.getElementById('content'));
    }
  },230);
}
