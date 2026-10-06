// SESSION
// ═══════════════════════════════════════════════════
function getLastRSess(rid){return S.workouts.find(w=>w.routineId===rid);}
function getAutoFill(exId,rid){
  if(rid){const sess=getLastRSess(rid);if(sess){const ex=sess.exercises.find(e=>e.exId===exId);if(ex){const done=ex.sets.filter(s=>s.done);if(done.length)return done.map(s=>({w:s.w,r:s.r}));}}}
  const pr=S.prs[exId];if(pr)return[{w:pr.w,r:pr.r},{w:pr.w,r:pr.r},{w:pr.w,r:pr.r}];return null;
}
function getLastStr(exId,rid){
  if(!rid)return null;const sess=getLastRSess(rid);if(!sess)return null;
  const ex=sess.exercises.find(e=>e.exId===exId);if(!ex)return null;
  const done=ex.sets.filter(s=>s.done);if(!done.length)return null;
  const mw=Math.max(...done.map(s=>parseFloat(s.w||0)));const ms=done.find(s=>parseFloat(s.w)===mw);
  return`Last: ${ms?.w||'?'}${S.unit}×${ms?.r||'?'} · ${done.length} sets`;
}
function startWorkout(rid){
  S.activeWorkout={id:uid(),routineId:rid||null,
    name:rid?(S.routines.find(r=>r.id===rid)?.name||'Workout'):`Workout — ${new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}`,
    started:Date.now(),exercises:[],notes:'',_origExIds:null,_origProgression:{}};
  if(rid){const r=S.routines.find(x=>x.id===rid);if(r){S.activeWorkout._origExIds=r.exercises.map(e=>e.exId);r.exercises.forEach(re=>{const fill=getAutoFill(re.exId,rid);const setCount=re.sets>0?re.sets:3;const sets=fill?fill.map(f=>({w:f.w,r:f.r,done:false,tag:''})):Array.from({length:setCount},()=>({w:re.w||'',r:re.r||'',done:false,tag:''}));const prog=re.type||re.progression||'flat';S.activeWorkout._origProgression[re.exId]=prog;S.activeWorkout.exercises.push({exId:re.exId,sets,_af:!!fill,progression:prog,rest:(re.rest!=null?re.rest:null),link:re.link||null});});}}
  save();render();startWtTimer();
}
function renderSession(c){
  const wk=S.activeWorkout;const el=Math.floor((Date.now()-wk.started)/1000);
  const doneSets=doneSetCnt(wk);const vol=Math.round(totalVol(wk));
  const painWs=getPainWarnings().filter(p=>wk.exercises.some(e=>e.exId===p.exId));
  let html=`<div class="fbar">
    <div class="fbar-name">${wk.name}</div>
    <span id="rest-pill" onclick="skipRest()"><span id="rest-pill-t"></span><span class="rp-x">✕</span></span>
    <span id="wt-el" class="wt">${fmtTimer(el)}</span>
    <button class="btn btp bsm" onclick="showFinish()">Finish</button>
  </div>
  <div style="display:flex;border-bottom:1px solid var(--border)">
    <div style="flex:1;padding:7px 10px;text-align:center;background:var(--card)"><div class="mono" style="font-size:14px;font-weight:500">${doneSets}</div><div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">Sets</div></div>
    <div style="width:1px;background:var(--border)"></div>
    <div style="flex:1;padding:7px 10px;text-align:center;background:var(--card)"><div class="mono" style="font-size:14px;font-weight:500">${vol.toLocaleString()}</div><div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">${S.unit}</div></div>
    <div style="width:1px;background:var(--border)"></div>
    <div style="flex:1;padding:7px 10px;text-align:center;background:var(--card)"><div class="mono" style="font-size:14px;font-weight:500">${wk.exercises.length}</div><div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">Exs</div></div>
  </div>`;
  if(painWs.length)html+=`<div class="pain-banner" style="display:flex;align-items:center;gap:7px">${ICON('⚠',14)} Pain flagged on ${painWs.map(p=>p.name).join(', ')} — proceed carefully</div>`;
  if(!wk.exercises.length)html+=`<div class="empty" style="padding:44px 20px"><div style="margin-bottom:12px;color:var(--muted2)">${ICON('dumbbell',34)}</div><div class="etit">No exercises yet</div><p style="font-size:12px">Tap below to add your first</p></div>`;
  const _ssG=ssGroups(wk.exercises);
  const _ssMap={};_ssG.forEach(g=>{for(let k=g.start;k<=g.end;k++)_ssMap[k]=g;});
  wk.exercises.forEach((ex,ei)=>{
    const info=getEx(ex.exId);const pr=S.prs[ex.exId];const lastStr=getLastStr(ex.exId,wk.routineId);
    const painLvl=getExPainLevel(ex.exId);const olSug=checkProgressiveOverload(ex.exId);
    const inSS=_ssMap[ei];const isSSStart=inSS&&inSS.start===ei;const isSSEnd=inSS&&inSS.end===ei;
    if(isSSStart){const cnt=inSS.end-inSS.start+1;html+=`<div class="ss-wrap"><div class="ss-lbl">${ssLabel(cnt)}</div>`;}
    html+=`<div class="exb" id="exb-${ei}">
      <div class="exbh">
        <div style="display:flex;align-items:flex-start;justify-content:space-between">
          <div style="flex:1;min-width:0">
            <div class="exbn">${info?.name||'Unknown'}${ex._af?`<span class="afill-tag">auto</span>`:''}${olSug?`<span class="ol-badge">↑ progress</span>`:''}</div>
            <div class="exbc">${info?.cat||''} · ${info?.eq||''}${pr?` · <span style="color:var(--gold);font-size:10px">PR ${pr.w}${S.unit}</span>`:''}</div>
            ${lastStr?`<div class="ex-last">${lastStr}</div>`:''}
            ${olSug?`<div style="font-size:10px;color:var(--blue);font-weight:500;margin-top:2px">💡 ${olSug.type==='weight'?`Try +${olSug.amount}${olSug.unit}`:`Add +${olSug.amount} rep`}</div>`:''}
            ${painLvl>=2?`<div style="font-size:10px;color:var(--red);font-weight:600;margin-top:2px">⚠ Pain reported ${painLvl}/3 sessions — lighter load</div>`:''}
          </div>
          <div style="display:flex;gap:5px;flex-shrink:0;margin-left:8px">
            ${ei>0?`<button class="ib" style="font-size:13px;color:var(--muted)" onclick="moveExInSession(${ei},-1)" title="Move up">↑</button>`:''}
            ${ei<wk.exercises.length-1?`<button class="ib" style="font-size:13px;color:var(--muted)" onclick="moveExInSession(${ei},1)" title="Move down">↓</button>`:''}
            <button class="ib" style="color:var(--navy);border-color:var(--nbright);font-size:11px;width:auto;padding:0 8px;gap:3px" onclick="showRestPicker('${ex.exId}')" title="Rest timer">${ICON('⏱',13)} ${exRestFor(ex.exId)>=60?`${Math.floor(exRestFor(ex.exId)/60)}:${String(exRestFor(ex.exId)%60).padStart(2,'0')}`:`${exRestFor(ex.exId)}s`}</button>
            <button class="ib" style="color:var(--blue);border-color:rgba(42,111,196,.25);font-size:11px" onclick="showPlateCalc(${ei})" title="Plate calc">${ICON('🔢',15)}</button>
            <button class="ib delbtn" onclick="removeEx(${ei})">✕</button>
          </div>
        </div>
      </div>
      <div class="slbls"><div class="sl">#</div><div class="sl">Wt (${S.unit})</div><div class="sl">Reps</div><div class="sl">e1RM</div><div class="sl"></div><div class="sl"></div></div>`;
    let wsn=0;
    ex.sets.forEach((s,si)=>{
      const isWarm=!!s.warmup;if(!isWarm)wsn++;
      const est=!isWarm&&s.done&&parseFloat(s.w)&&parseInt(s.r)?e1rm(parseFloat(s.w),parseInt(s.r)):null;
      const isPR=est&&pr&&est>=(pr.est||0);
      html+=`<div class="srow${s.done?' done':''}${isWarm?' warm':''}" id="sr-${ei}-${si}">
        <div class="snum">${isWarm?'W':wsn}</div>
        <input class="sinp" type="number" inputmode="decimal" placeholder="–" value="${s.w||''}" onchange="upd(${ei},${si},'w',this.value)"${s.done?' disabled':''}>
        <input class="sinp" type="number" inputmode="numeric" placeholder="–" value="${s.r||''}" onchange="upd(${ei},${si},'r',this.value)"${s.done?' disabled':''}>
        <div class="e1rm-cell">${est?`<div class="e1rm-badge${isPR?' pr':''}">${est}${isPR?' 🏆':''}</div>`:''}</div>
        <div class="chk${s.done?' done':''}" onclick="togSet(${ei},${si})">✓</div>
        <div class="tag-btn${s.tag?' tagged':''}" onclick="toggleTagRow(${ei},${si})">◈</div>
      </div>
      ${s._showTag?`<div class="tag-row">${['Easy','RPE 8','Hard','Form Issue','Pain'].map(t=>`<div class="tag-chip${s.tag===t?' on':''}${t==='Pain'?' pain':''}" onclick="setTag(${ei},${si},'${t}')">${t}</div>`).join('')}${s.tag?`<div class="tag-chip on" onclick="setTag(${ei},${si},'')">✕ Clear</div>`:''}</div>`:''}`;
    });
    html+=`<div style="padding:6px 10px;border-top:1px solid var(--border);display:flex;gap:7px;background:var(--bg)">
      <button class="btn bts bsm" style="flex:1;color:var(--gold);font-weight:600;border-color:rgba(176,120,40,.25)" onclick="addWarmup(${ei})">+ Warmup</button>
      <button class="btn bts bsm" style="flex:1;color:var(--navy);font-weight:600;border-color:rgba(30,53,88,.2)" onclick="addSet(${ei})">+ Set</button>
      <button class="btn bts bsm delbtn" onclick="rmLastSet(${ei})">− Set</button>
      ${ei<wk.exercises.length-1?`<button class="ss-link-btn${(ex.link&&wk.exercises[ei+1]?.link===ex.link)?' linked':''}" onclick="toggleSessionLink(${ei})">${(ex.link&&wk.exercises[ei+1]?.link===ex.link)?'⛓ Unlink':'⛓ Link ↓'}</button>`:''}
    </div></div>`;
    if(isSSEnd)html+=`</div>`; // close .ss-wrap
  });
  html+=`<div style="padding:10px 13px 6px;display:flex;gap:9px">
    <button class="btn btp bfw" style="flex:2;padding:13px;border-radius:10px" onclick="showExPicker()">+ Add Exercise</button>
    <button class="btn bts" style="padding:13px;border-radius:10px;color:var(--red)" onclick="confirmCancel()">Cancel</button>
  </div>`;
  c.innerHTML=html;startWtTimer();syncRestUI();
}
// ─── Proportional autofill + warmups ───
const WARMUP_RAMP={1:[0.6],2:[0.5,0.7],3:[0.4,0.6,0.8]};
function loadInc(eq,weight){
  if(eq==='Dumbbell'||eq==='Machine'||eq==='Cable')return weight>=100?5:2.5;
  return 5; // Barbell, Kettlebell, Medicine Ball, Other, added-load Bodyweight
}
function roundTo(raw,inc){return Math.round(raw/inc)*inc;}
function jumpFor(weight,eq){const inc=loadInc(eq,weight);return Math.max(inc,roundTo(weight*0.025,inc));}
function warmupPcts(n){return WARMUP_RAMP[n]||Array.from({length:n},(_,i)=>0.4+(0.45*i/(n-1||1)));}
// Recompute every auto (non-manual, non-completed) set for one exercise.
// Working sets ascend from the first working set; warmups ramp off it.
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
      if(!s.done&&!s._manual){
        let nw;
        if(mode==='ascend'){const a=base+jumpFor(base,eq);nw=roundTo(a,loadInc(eq,a));}
        else if(mode==='descend'){const a=base-jumpFor(base,eq);nw=Math.max(loadInc(eq,base),roundTo(a,loadInc(eq,a)));}
        else{nw=roundTo(w0,loadInc(eq,w0));} // flat / straight sets
        s.w=String(nw);
      }
      const sv=parseFloat(s.w);if(!isNaN(sv))base=sv;
    }
  }
  const warm=ex.sets.filter(s=>s.warmup);
  if(warm.length&&!isNaN(w0)){
    const pcts=warmupPcts(warm.length);
    warm.forEach((s,i)=>{
      if(!s.done&&!s._manual){
        const raw=w0*pcts[i],inc=loadInc(eq,raw);
        s.w=String(Math.max(inc,roundTo(raw,inc)));
      }
    });
  }
  save();
}
function syncExInputs(ei){
  const ex=S.activeWorkout?.exercises[ei];if(!ex)return;
  ex.sets.forEach((s,si)=>{
    const wi=document.querySelector(`#sr-${ei}-${si} input:nth-of-type(1)`);
    if(wi&&document.activeElement!==wi)wi.value=s.w||'';
  });
}
function upd(ei,si,f,v){
  if(!S.activeWorkout)return;
  const s=S.activeWorkout.exercises[ei].sets[si];
  s[f]=v;
  if(f==='w'){s._manual=(v!==''&&v!=null);recalcExercise(ei);syncExInputs(ei);}
  else save();
}
function togSet(ei,si){
  if(!S.activeWorkout)return;
  const s=S.activeWorkout.exercises[ei].sets[si];
  const wi=document.querySelector(`#sr-${ei}-${si} input:nth-of-type(1)`);
  const ri=document.querySelector(`#sr-${ei}-${si} input:nth-of-type(2)`);
  if(wi)s.w=wi.value;if(ri)s.r=ri.value;
  s.done=!s.done;
  if(s.done){if(!s.warmup)checkPR(S.activeWorkout.exercises[ei].exId,parseFloat(s.w||0),parseInt(s.r||0));if(isLastInSuperset(ei))startRest(exRestFor(S.activeWorkout.exercises[ei].exId));}
  save();
  const row=document.getElementById(`sr-${ei}-${si}`);
  if(row){
    row.className=`srow${s.done?' done':''}${s.warmup?' warm':''}`;
    row.querySelector('.chk')?.classList.toggle('done',s.done);
    row.querySelectorAll('input').forEach(inp=>inp.disabled=s.done);
    const est=!s.warmup&&s.done&&parseFloat(s.w)&&parseInt(s.r)?e1rm(parseFloat(s.w),parseInt(s.r)):null;
    const pr=S.prs[S.activeWorkout.exercises[ei].exId];
    const isPR=est&&pr&&est>=(pr.est||0);
    const cell=row.querySelector('.e1rm-cell');
    if(cell)cell.innerHTML=est?`<div class="e1rm-badge${isPR?' pr':''}">${est}${isPR?' 🏆':''}</div>`:'';
  }
  // live stats update
  const wk=S.activeWorkout;
  const setsEl=document.querySelector('.fbar + div .mono');
  if(setsEl)setsEl.textContent=doneSetCnt(wk);
}
function toggleTagRow(ei,si){if(!S.activeWorkout)return;const s=S.activeWorkout.exercises[ei].sets[si];s._showTag=!s._showTag;renderSession(document.getElementById('content'));}
function setTag(ei,si,tag){if(!S.activeWorkout)return;const s=S.activeWorkout.exercises[ei].sets[si];s.tag=tag;s._showTag=false;save();renderSession(document.getElementById('content'));}
function checkPR(exId,w,r){if(!w||!r)return;const est=e1rm(w,r);const prev=S.prs[exId];if(!prev||est>e1rm(parseFloat(prev.w),parseInt(prev.r))){S.prs[exId]={w,r,est,date:today()};save();const ex=getEx(exId);toast(`🏆 PR — ${ex?.name||'Exercise'}: ${w}${S.unit}×${r}`,'gold');}}
function addSet(ei){if(!S.activeWorkout)return;const ex=S.activeWorkout.exercises[ei];const lastWork=[...ex.sets].reverse().find(s=>!s.warmup);ex.sets.push({w:'',r:lastWork?.r||'',done:false,tag:'',warmup:false,_manual:false});recalcExercise(ei);renderSession(document.getElementById('content'));setTimeout(()=>{document.querySelectorAll(`#exb-${ei} .srow`).slice(-1)[0]?.scrollIntoView({behavior:'smooth',block:'nearest'});},60);}
function addWarmup(ei){if(!S.activeWorkout)return;const ex=S.activeWorkout.exercises[ei];let idx=0;while(idx<ex.sets.length&&ex.sets[idx].warmup)idx++;ex.sets.splice(idx,0,{w:'',r:'',done:false,tag:'',warmup:true,_manual:false});recalcExercise(ei);renderSession(document.getElementById('content'));}
function rmLastSet(ei){if(!S.activeWorkout)return;const ex=S.activeWorkout.exercises[ei];if(ex.sets.length>1){ex.sets.pop();save();renderSession(document.getElementById('content'));}}
function removeEx(ei){if(!S.activeWorkout)return;S.activeWorkout.exercises.splice(ei,1);cleanSessionLinks();save();renderSession(document.getElementById('content'));}
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
function confirmCancel(){customConfirm('This workout will not be saved.','Discard workout',()=>{S.activeWorkout=null;if(wtInt)clearInterval(wtInt);skipRest();save();render();});}
// ─── Plate Calc ───
function showPlateCalc(ei){
  const ex=S.activeWorkout?.exercises[ei];
  const lastW=ex?.sets.filter(s=>s.done).slice(-1)[0]?.w||ex?.sets[0]?.w||'';
  const ov=makeOv('plate-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div class="mt" style="margin-bottom:0">Plate Calculator</div>
    </div>
    <div class="fg"><label class="fl">Target Weight (${S.unit})</label><input type="number" inputmode="decimal" id="plt-tgt" value="${lastW}" placeholder="0" oninput="calcPltDisp()"></div>
    <div class="fg"><label class="fl">Bar Weight</label><select id="plt-bar" onchange="calcPltDisp()">
      <option value="${S.unit==='kg'?20:45}">${S.unit==='kg'?'20kg':'45 lbs'} Standard</option>
      <option value="${S.unit==='kg'?15:35}">${S.unit==='kg'?'15kg':'35 lbs'} Light</option>
      <option value="${S.unit==='kg'?10:25}">${S.unit==='kg'?'10kg':"25 lbs Women's"}</option>
    </select></div>
    <div id="plt-result"></div>
    <button class="btn btg bfw" style="margin-top:12px" onclick="dismissOv(document.getElementById('plate-ov'))">Close</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);calcPltDisp();
}
function calcPltDisp(){
  const tgt=parseFloat(document.getElementById('plt-tgt')?.value);
  const bar=parseFloat(document.getElementById('plt-bar')?.value)||(S.unit==='kg'?20:45);
  const el=document.getElementById('plt-result');if(!el)return;
  if(!tgt){el.innerHTML='';return;}
  const side=(tgt-bar)/2;
  if(side<0){el.innerHTML=`<div style="color:var(--red);font-size:13px;text-align:center;padding:12px">Below bar weight (${bar}${S.unit})</div>`;return;}
  const sets=S.unit==='kg'?[25,20,15,10,5,2.5,1.25]:[45,35,25,10,5,2.5,1.25];
  let rem=side;const plates=[];
  for(const p of sets){const n=Math.floor(rem/p+0.001);if(n>0){plates.push({w:p,n});rem-=p*n;}}
  const all=plates.flatMap(p=>Array(p.n).fill(p.w));
  const cls=w=>w>=45?'p45':w>=35?'p35':w>=25?'p25':w>=10?'p10':w>=5?'p5':'p2';
  el.innerHTML=`<div style="text-align:center;font-size:10px;color:var(--muted);margin-bottom:8px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">Each side · bar ${bar}${S.unit}</div>
    <div class="plate-visual">${all.length?all.map(w=>`<div class="plate ${cls(w)}">${w}</div>`).join(''):'<div style="color:var(--muted);font-size:12px">Just the bar</div>'}</div>
    ${rem>0.01?`<div style="text-align:center;font-size:11px;color:var(--gold);font-weight:600">~${rem.toFixed(2)}${S.unit} remainder</div>`:''}`;
}

// ─── Finish workout ───
function showFinish(){
  const wk=S.activeWorkout;const dur=Date.now()-wk.started;const cals=sessionCals(dur);
  const prs=getPRsFromSess(wk);const diff=getRoutineDiff(wk);
  const ov=makeOv('fin-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Finish Workout</div>
    <div class="fg"><label class="fl">Name</label><input type="text" id="wkn" value="${wk.name}"></div>
    <div style="margin-bottom:13px"><div class="sgrid" style="border-radius:10px;overflow:hidden;border:1px solid var(--border)">
      <div class="sc"><div class="sv">${fmtDur(dur)}</div><div class="slb">Duration</div></div>
      <div class="sc"><div class="sv">${doneSetCnt(wk)}</div><div class="slb">Sets</div></div>
      <div class="sc"><div class="sv">${Math.round(totalVol(wk)).toLocaleString()}</div><div class="slb">Vol (${S.unit})</div></div>
      <div class="sc"><div class="sv">${cals}</div><div class="slb">~kcal</div></div>
    </div></div>
    ${prs.length?`<div style="background:var(--gdim);border:1px solid rgba(184,124,42,.22);border-radius:10px;padding:10px 13px;margin-bottom:12px;color:var(--gold);font-size:13px;font-weight:600">🏆 New PR${prs.length>1?'s':''}: ${prs.join(', ')}</div>`:''}
    ${diff?`<div style="background:var(--bdim);border:1px solid rgba(42,111,196,.18);border-radius:10px;padding:11px 13px;margin-bottom:12px">
      <div style="font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--blue);margin-bottom:7px">Routine Changes</div>
      ${diff.added.map(n=>`<div style="color:var(--green);font-size:12px;font-weight:500">+ ${n}</div>`).join('')}
      ${diff.changed.map(n=>`<div style="color:var(--gold);font-size:12px;font-weight:500">~ ${n}</div>`).join('')}
      <button class="btn btb bsm bfw" style="margin-top:8px" onclick="saveRoutineChanges('${wk.routineId}')">Save to Routine</button>
    </div>`:''}
    <div class="fg"><label class="fl">Notes</label><textarea id="wknt" style="min-height:55px;font-size:13px" placeholder="How did it go?">${wk.notes||''}</textarea></div>
    <button class="btn btp bfw" onclick="saveWorkout()">Save Workout</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="dismissOv(document.getElementById('fin-ov'))">Continue Workout</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function getPRsFromSess(wk){
  const names=[];wk.exercises.forEach(ex=>{ex.sets.filter(s=>s.done).forEach(s=>{const w=parseFloat(s.w||0),r=parseInt(s.r||0);if(w&&r){const prev=S.prs[ex.exId];if(!prev||e1rm(w,r)>=e1rm(parseFloat(prev.w),parseInt(prev.r))){const info=getEx(ex.exId);if(info&&!names.includes(info.name))names.push(info.name);}}});});return names;
}
function getRoutineDiff(wk){
  if(!wk.routineId||!wk._origExIds)return null;
  const orig=wk._origExIds;const now=wk.exercises.map(e=>e.exId);
  const added=now.filter(id=>!orig.includes(id)).map(id=>getEx(id)?.name||id);
  const changed=[];const ls=getLastRSess(wk.routineId);
  if(ls){wk.exercises.filter(ex=>orig.includes(ex.exId)).forEach(ex=>{const prev=ls.exercises.find(e=>e.exId===ex.exId);if(!prev)return;const cW=parseFloat(ex.sets.find(s=>s.done)?.w||0);const pW=parseFloat(prev.sets.find(s=>s.done)?.w||0);if(pW&&cW&&Math.abs(cW-pW)/pW>0.03)changed.push(`${getEx(ex.exId)?.name||ex.exId} (${pW}→${cW}${S.unit})`);});}
  if(!added.length&&!changed.length)return null;return{added,changed};
}
function saveRoutineChanges(rid){
  const wk=S.activeWorkout;const r=S.routines.find(x=>x.id===rid);if(!r||!wk)return;
  wk.exercises.forEach(ex=>{if(!r.exercises.find(e=>e.exId===ex.exId)){const bs=ex.sets.find(s=>s.done)||ex.sets[0];r.exercises.push({exId:ex.exId,sets:ex.sets.length,w:bs?.w||'',r:bs?.r||''});}
  const rEx=r.exercises.find(e=>e.exId===ex.exId);if(!rEx)return;const bd=ex.sets.filter(s=>s.done).sort((a,b)=>parseFloat(b.w||0)-parseFloat(a.w||0))[0];if(bd){rEx.w=bd.w;rEx.r=bd.r;}rEx.sets=ex.sets.length;});
  save();toast('Routine updated!','green');
}
function saveWorkout(){
  const n=document.getElementById('wkn');const nt=document.getElementById('wknt');
  if(n)S.activeWorkout.name=n.value||S.activeWorkout.name;if(nt)S.activeWorkout.notes=nt.value;
  S.activeWorkout.ended=Date.now();S.activeWorkout.cals=sessionCals(S.activeWorkout.ended-S.activeWorkout.started);
  S.workouts.unshift(S.activeWorkout);S.activeWorkout=null;
  const _ag=getActiveGroup();
  if(_ag&&_ag.mode==='rotation'&&(_ag.routineIds||[]).length){
    const curId=_ag.routineIds[(_ag.cursor||0)%_ag.routineIds.length];
    if(S.workouts[0]&&S.workouts[0].routineId===curId)_ag.cursor=((_ag.cursor||0)+1)%_ag.routineIds.length;
  }
  if(wtInt)clearInterval(wtInt);skipRest();save();
  document.getElementById('fin-ov')?.remove();toast('Workout saved!','green');render();
}

// ─── Exercise picker ───
function showExPicker(routineId){
  const isWorkout=!routineId&&S.activeWorkout;
  const recentIds=isWorkout?getRecentExIds(8):[];
  const ov=makeOv('ex-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:13px">
      <div class="mt" style="margin-bottom:0">Add Exercise</div>
      <button class="btn bts bsm" onclick="showCustomEx()">+ Custom</button>
    </div>
    ${isWorkout?`<div style="margin-bottom:10px"><div class="sec-lbl" style="padding:0 0 6px">Equipment</div>
      <div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px">
        ${EQUIPMENT_PRESETS.map(p=>`<div class="chip${(S.equipPreset||'full')===p.id?' on':''}" style="flex-shrink:0" onclick="setPickerEquip('${p.id}')">${ICON(p.icon,14)} ${p.label}</div>`).join('')}
      </div>
    </div>`:''}
    <div class="sw" style="padding:0 0 9px"><input id="ex-srch" placeholder="Search exercises…" oninput="filterPicker()" style="width:100%"></div>
    <div class="fr" style="padding:0 0 7px;margin-bottom:5px" id="ex-chips">${CATS.map(cat=>`<div class="chip${(S.exFilter||'All')===cat?' on':''}" onclick="setFilter('${cat}')">${cat}</div>`).join('')}</div>
    ${recentIds.length?`<div style="padding:0 0 8px"><div class="sec-lbl" style="padding:2px 0 6px;font-size:10px">Recent</div>
      <div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:4px">
        ${recentIds.map(id=>{const ex=getEx(id);if(!ex)return'';return`<div class="exi" onclick="pickEx('${id}')"><div style="flex:1"><div class="exin">${ex.name}</div><div style="font-size:10px;color:var(--muted);margin-top:1px">${ex.cat} · ${ex.eq}</div></div>${S.prs[id]?`<span class="badge bg" style="margin-right:5px">PR ${S.prs[id].w}${S.unit}</span>`:''}<span style="color:var(--muted2);font-size:16px">›</span></div>`;}).join('')}
      </div>
    </div>`:''}
    <div id="ex-list"></div>
    <button class="btn btg bfw" style="margin-top:9px" onclick="dismissOv(document.getElementById('ex-ov'))">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);window._pickRid=routineId;renderPickerList();
}
function setPickerEquip(id){S.equipPreset=id;save();document.querySelectorAll('#ex-ov .chip[onclick^="setPickerEquip"]').forEach(c=>c.classList.toggle('on',c.getAttribute('onclick').includes(`'${id}'`)));renderPickerList();}
function renderPickerList(){
  const q=(document.getElementById('ex-srch')?.value||'').toLowerCase();const cat=S.exFilter||'All';
  const preset=EQUIPMENT_PRESETS.find(p=>p.id===(S.equipPreset||'full'))||EQUIPMENT_PRESETS[0];
  let exs=allEx();if(preset.eqs)exs=exs.filter(e=>preset.eqs.includes(e.eq));
  if(cat!=='All')exs=exs.filter(e=>e.cat===cat);if(q)exs=exs.filter(e=>e.name.toLowerCase().includes(q));
  const el=document.getElementById('ex-list');if(!el)return;
  if(!exs.length){el.innerHTML=`<div class="empty" style="padding:24px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('search',30)}</div><div class="etit" style="font-size:14px">No results</div><div style="font-size:11px;color:var(--muted);margin-top:4px">Try a different filter</div></div>`;return;}
  el.innerHTML=`<div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden">${exs.map(e=>`<div class="exi" onclick="pickEx('${e.id}')"><div style="flex:1"><div class="exin">${e.name}</div><div style="font-size:10px;color:var(--muted);margin-top:1px">${e.cat} · ${e.eq}</div></div>${S.prs[e.id]?`<span class="badge bg" style="margin-right:5px">PR ${S.prs[e.id].w}${S.unit}</span>`:''}</div>`).join('')}</div>`;
}
function filterPicker(){renderPickerList();}
function setFilter(cat){S.exFilter=cat;document.querySelectorAll('#ex-chips .chip').forEach(ch=>ch.classList.toggle('on',ch.textContent===cat));renderPickerList();}
function pickEx(exId){
  dismissOv(document.getElementById('ex-ov'));
  setTimeout(()=>{
    if(window._pickRid){addExToRoutine(window._pickRid,exId);}
    else if(S.activeWorkout){
      const fill=getAutoFill(exId,S.activeWorkout.routineId);
      const sets=fill?fill.map(f=>({w:f.w,r:f.r,done:false,tag:'',warmup:false,_manual:false})):Array.from({length:3},()=>({w:'',r:'',done:false,tag:'',warmup:false,_manual:false}));
      S.activeWorkout.exercises.push({exId,sets,_af:!!fill});save();renderSession(document.getElementById('content'));
    }
  },230);
}
// ═══════════════════════════════════════════════════
