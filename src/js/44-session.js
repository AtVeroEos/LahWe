// ═══════════════════════════════════════════════════
// SESSION — the live workout screen
// ═══════════════════════════════════════════════════
function getLastRSess(rid){return S.workouts.find(w=>w.routineId===rid);}
// The sets you actually completed last time for this exercise: first from the same routine,
// otherwise from the most recent workout that included it (Settings can make it always the most
// recent). Card-deck sessions don't count.
function lastSetsFor(exId,rid){
  const pick=wk=>{
    for(const ex of wk.exercises){if(ex.exId===exId){const done=ex.sets.filter(s=>s.done&&!s.excl);if(done.length)return done;}}
    return null;
  };
  if(rid&&S.lastFrom!=='any'){const sess=getLastRSess(rid);if(sess){const d=pick(sess);if(d)return d;}} // Settings → Workout → Last time from
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
  const own=typeof stepFor==='function'?stepFor(eq):null;if(own)return own; // Settings → Workout → Weight steps
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
function warmupWeight(w0,pct,eq){const raw=w0*pct,inc=loadInc(eq,raw);const v=Math.max(inc,roundTo(raw,inc));return loadOptions(eq)?snapLoad(eq,v,0):v;}
// Settings → Workout → Warm-up sets: added when a workout starts, to the first weighted lift or to
// every barbell lift, unless last time's warm-ups already came back. Heavier work gets more of them:
// one under 95 lb (40 kg), two under 185 lb (85 kg), three above. Reps 5, 3, 2.
const AUTO_WARM_REPS={1:[5],2:[5,3],3:[5,3,2]};
function autoWarmCount(w0){
  if(!(w0>0))return 2;
  const lb=isKg()?w0*LB_PER_KG:w0;
  return lb<95?1:lb<185?2:3;
}
function applyAutoWarmups(wk){
  const mode=S.autoWarm;if(mode!=='first'&&mode!=='barbell')return 0;
  let added=0,firstDone=false;
  wk.exercises.forEach((ex,ei)=>{
    if(mode==='first'&&firstDone)return;
    const eq=(getEx(ex.exId)||{}).eq;
    if(ex.timed||ex.cardio||ex.dist||eq==='Bodyweight'||!eq)return;
    if(mode==='barbell'&&eq!=='Barbell')return;
    firstDone=true;
    if(ex.sets.some(s=>s.warmup))return; // last time's warm-ups came back with the lift
    const w0=parseFloat((ex.sets.find(s=>!s.warmup)||{}).w)||0;
    const reps=AUTO_WARM_REPS[autoWarmCount(w0)];
    ex.sets.unshift(...reps.map(r=>({w:'',r:String(r),done:false,tag:'',warmup:true,_manual:false})));
    recalcExercise(ei);added+=reps.length;
  });
  return added;
}
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
function sessionExercise(exId,rid,re,opts){
  opts=opts||{};
  const prog=(re&&(re.type||re.progression))||'flat';
  const info=getEx(exId);const cardio=!!(info&&info.kind==='cardio');
  // Added on the fly (no routine entry): holds are timed and sled work is a distance, as in the catalog.
  const dist=re?!!re.dist:DIST_EX.has(exId);
  const timed=cardio||(re?!!re.timed:HOLD_EX.has(exId));
  const fill=getAutoFill(exId,rid);
  const warm=fill?fill.filter(f=>f.warmup):[];
  const work=fill?fill.filter(f=>!f.warmup):[];
  let nTarget=re&&parseInt(re.sets)>0?parseInt(re.sets):0;
  // Deload week: half the working sets (rounded up), same weights.
  if(opts.deload&&nTarget)nTarget=Math.max(1,Math.ceil(nTarget/2));
  // The routine decides how many working sets; last session decides the load.
  const n=nTarget||(opts.deload&&work.length?Math.max(1,Math.ceil(work.length/2)):work.length)||(cardio?1:3);
  const fixedReps=re&&re.r&&!re.rMax&&!re.amrap?String(re.r):'';
  const blank=()=>({w:'',r:'',done:false,tag:'',warmup:false,_manual:false});
  const sets=[];
  for(let k=0;k<n;k++){
    const src=work[k]||work[work.length-1]||null;
    const s=blank();
    s.w=cardio?'':src&&src.w!=null?String(src.w):String((re&&re.w)||'');
    if(cardio&&src&&src.d)s.d=String(src.d);
    if(re&&re.amrap&&!re.r)s.r='';
    else s.r=fixedReps||(src&&src.r!=null&&src.r!==''?String(src.r):String((re&&re.r)||''));
    sets.push(s);
  }
  const wsets=warm.map(f=>{const s=blank();s.warmup=true;s.w=f.w!=null?String(f.w):'';s.r=f.r!=null?String(f.r):'';return s;});
  const rir=re&&re.rir!=null&&re.rir!==''?Math.max(0,Math.min(4,parseInt(re.rir)||0)):null;
  const ex={exId,sets:[...(cardio?[]:wsets),...sets],_af:!!fill,progression:prog,
    rest:re&&re.rest!=null?re.rest:null,link:(re&&re.link)||null,timed,
    target:re?{sets:nTarget,r:re.r||'',rMax:re.rMax||'',amrap:!!re.amrap,timed,dist,rir}:null,
    note:(re&&re.note)||''};
  if(dist)ex.dist=true;
  if(cardio)ex.cardio=true;
  if(rir!=null)ex.rirT=rir;
  // What to aim for today: the coach's numbers if you asked for them, otherwise the built-in rule.
  let aim=cardio?null:aimFor(exId,rid,re);
  if(aim&&opts.deload){aim=Object.assign({},aim,{w:aim.from&&aim.from.w>0?aim.from.w:aim.w,sets:nTarget||aim.sets,kind:'hold',why:'Deload week: half the sets at the weight you used last time. Leave a few reps in the tank.'});}
  if(aim)ex.aim=aim;
  markManualSets(ex);
  return ex;
}
function startWorkout(rid){
  // A workout is already open: go to it. Replacing it here used to throw its logged sets away.
  if(S.activeWorkout){
    document.querySelectorAll('.ov').forEach(o=>o.remove());
    sessionGo();
    toast('Finish or discard the workout you have open first','',{ms:3500});
    return;
  }
  const r=rid?S.routines.find(x=>x.id===rid):null;
  S.activeWorkout={id:uid(),routineId:r?r.id:null,
    name:r?(r.name||'Workout'):`Workout — ${new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}`,
    started:Date.now(),exercises:[],notes:'',_origExIds:null,_origProgression:{}};
  const deload=r?progIsDeloadFor(r.id):false;
  if(deload)S.activeWorkout.deload=true;
  if(r){
    S.activeWorkout._origExIds=r.exercises.map(e=>e.exId);
    r.exercises.forEach(re=>{
      if(!getEx(re.exId))return; // exercise was deleted from the library
      const ex=sessionExercise(re.exId,r.id,re,{deload});
      S.activeWorkout._origProgression[re.exId]=ex.progression;
      S.activeWorkout.exercises.push(ex);
    });
  }
  applyAutoWarmups(S.activeWorkout);
  S.restTimer=null;syncRestUI();
  saveNow();
  // Started from Home, the Library or a sheet: it shows on the Workout tab.
  sessionGo();
  startWtTimer();
  formPrefetch(S.activeWorkout.exercises.map(e=>e.exId));
}
// Reps in reserve: how many more you could have done. 4 means four or more.
const RIR_VALUES=[0,1,2,3,4];
function fmtRir(v){return v>=4?'4+':String(v);}
function setRowHTML(ex,ei,s,si,num){
  const isWarm=!!s.warmup;
  const c=prCandidate(ex,s);const est=c?c.est:null;
  const pr=S.prs[ex.exId];
  const isPR=!!(c&&pr&&pr.live&&c.est===pr.est&&c.w===pr.w);
  const t=ex.target;
  const rph=t&&!isWarm?(ex.cardio&&t.r?String(Math.round(parseInt(t.r)/60*10)/10):ex.timed||ex.dist?(t.r||'–'):(fmtRepTarget(t)||'–')):'–';
  const dis=s.done?' disabled':'';
  // Cardio: distance and minutes (stored as seconds). Distance work: load and metres.
  const in1=ex.cardio?`<input class="sinp" type="number" inputmode="decimal" placeholder="mi" value="${esc(s.d||'')}" onchange="upd(${ei},${si},'d',this.value)" aria-label="Distance, miles"${dis}>`
    :`<input class="sinp" type="number" inputmode="decimal" min="0" placeholder="–" value="${esc(s.w||'')}" onchange="upd(${ei},${si},'w',this.value)" aria-label="Weight"${dis}>`;
  const in2=ex.cardio?`<input class="sinp" type="number" inputmode="decimal" placeholder="${esc(rph)}" value="${esc(s.r?String(Math.round(parseInt(s.r)/60*100)/100):'')}" onchange="upd(${ei},${si},'rmin',this.value)" aria-label="Minutes"${dis}>`
    :`<input class="sinp" type="number" inputmode="numeric" min="0" placeholder="${esc(rph)}" value="${esc(s.r||'')}" onchange="upd(${ei},${si},'r',this.value)" aria-label="${ex.timed?'Seconds':ex.dist?'Metres':'Reps'}"${dis}>`;
  const tagTxt=s.rir!=null?`<span class="tb-rir">${fmtRir(s.rir)}</span>${s.tag?'<i class="tb-dot"></i>':''}`:s.tag?esc(s.tag==='RPE 8'?'8':s.tag[0]):ICON('tag',15);
  const tags=['Easy','Hard','Form Issue','Pain'];if(s.tag==='RPE 8')tags.splice(1,0,'RPE 8'); // an old tag stays readable
  return`<div class="srow${s.done?' done':''}${isWarm?' warm':''}${s.fail?' failed':''}${s.skip&&!s.done?' skipped':''}" id="sr-${ei}-${si}">
    <div class="snum">${isWarm?'W':s.fail?'F':s.skip&&!s.done?'–':num}</div>
    ${in1}${in2}
    <div class="e1rm-cell">${est?`<div class="e1rm-badge${isPR?' pr':''}">${isPR?'PR ':''}${est}</div>`:''}</div>
    <div class="chk${s.done?' done':''}" role="button" aria-label="Set done" onclick="togSet(${ei},${si})">${ICON('tick',18)}</div>
    <div class="tag-btn${s.tag||s.rir!=null?' tagged':''}" role="button" aria-label="Reps in reserve and tags" onclick="toggleTagRow(${ei},${si})">${tagTxt}</div>
  </div>
  ${s._showTag?`<div class="tag-row">${isWarm||ex.timed||ex.cardio?'':`<span class="tag-l">In reserve${ex.rirT!=null?` <b>aim ${fmtRir(ex.rirT)}</b>`:''}</span>${RIR_VALUES.map(v=>`<div class="tag-chip rir${s.rir===v?' on':''}" onclick="setRir(${ei},${si},${v})">${fmtRir(v)}</div>`).join('')}<span class="tag-br"></span>`}${tags.map(tg=>`<div class="tag-chip${s.tag===tg?' on':''}${tg==='Pain'?' pain':''}" onclick="setTag(${ei},${si},'${tg}')">${tg}</div>`).join('')}${s.tag||s.rir!=null?`<div class="tag-chip" onclick="clearTags(${ei},${si})">✕ Clear</div>`:''}</div>`:''}`;
}
function renderSession(c){
  const wk=S.activeWorkout;if(!wk){render();return;}
  if(c)c.classList.toggle('swipe-on',!!wk._swipe);
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
  if(wk.deload)html+=`<div class="deload-banner">${ICON('repeat',14)} Deload week: half the sets at last week's weights.</div>`;
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
    const ssI=inSS?ssInfo(_ssG,inSS,ei):null;
    if(isSSStart)html+=`<div class="ss-wrap" style="--ssc:${ssI.tone}"><div class="ss-lbl">${esc(ssI.label)}</div>`;
    const a=ex.aim||null;
    const facts=[];
    if(tgt)facts.push(`<div class="fact"><span>Plan</span><b>${esc(tgt)}</b></div>`);
    // Last is a button too: it copies last session's sets into the ones still to do (Aim is the target; Last is what you did).
    if(a&&a.from)facts.push(`<button class="fact fact-last" onclick="applyLast(${ei})" aria-label="Copy last session into the sets to do"><span>Last</span><b>${esc(fmtFrom(a,ex.timed))}</b></button>`);
    if(a)facts.push(`<button class="fact fact-aim aim-${a.kind}" onclick="applyAim(${ei})" aria-label="Fill in the aim"><span>${a.by==='coach'?'Coach aim':'Aim'} ${aimIcon(a,11)}</span><b>${esc(fmtAim(a,ex.timed))}</b></button>`);
    html+=`<div class="exb" id="exb-${ei}">
      <div class="exbh">
        <div class="exbn" role="button" onclick="showForm(${jsq(ex.exId)})">${ssI&&ssI.ix?`<span class="ss-ix">${ssI.ix}</span>`:''}${esc(info?.name||'Unknown exercise')}${ex._af?`<span class="afill-tag">auto</span>`:''}</div>
        <div class="exbc">${esc(info?.cat||'')} · ${esc(info?.eq||'')}${info&&info.each?' · each side':''}${ex.rirT!=null?` · <span class="exb-rir">${fmtRir(ex.rirT)} in reserve</span>`:''}${pr&&!ex.timed&&!ex.cardio&&!ex.dist?` · <span class="exb-pr">PR ${pr.w} × ${pr.r}</span>`:''}${ex._swappedFrom?` · <span class="exb-sw">in for ${esc(exName(ex._swappedFrom))}</span>`:''}</div>
        ${facts.length?`<div class="facts">${facts.join('')}</div>`:''}
        ${a&&a.why?`<div class="ex-why">${esc(a.why)}${!aimHinted&&!ex.aimUsed?(aimHinted=true,' Tap the aim to fill it in.'):''}</div>`:''}
        ${ex.note?`<div class="ex-note">${esc(ex.note)}</div>`:''}
        ${painLvl>=2?`<div class="ex-pain">${ICON('alert',12)} Pain reported in ${painLvl} of the last 3 sessions. Go lighter or swap it.</div>`:''}
        <div class="exb-acts">
          <button class="ib ib-wide" onclick="showRestPicker(${jsq(ex.exId)})" aria-label="Rest timer">${ICON('timer',14)} ${rest>=60?fmtMS(rest):`${rest}s`}</button>
          ${ex.timed||ex.cardio||ex.dist?'':`<button class="ib" onclick="showPlateCalc(${ei})" aria-label="Plate calculator">${ICON('grid',16)}</button>`}
          <button class="ib" onclick="showForm(${jsq(ex.exId)})" aria-label="Form: how to do it">${ICON('figure',16)}</button>
          <button class="ib ib-wide" onclick="showSwap(${ei})" aria-label="Swap exercise">${ICON('swap',15)}<span class="ib-lbl">Swap</span></button>
          <span style="flex:1"></span>
          <button class="ib ib-q" onclick="showExMenu(${ei})" aria-label="More for this exercise">${ICON('more',18)}</button>
        </div>
      </div>
      <div class="slbls"><div class="sl">#</div><div class="sl">${ex.cardio?'Miles':`Wt (${S.unit})`}</div><div class="sl">${ex.cardio?'Min':ex.timed?'Sec':ex.dist?'Metres':'Reps'}</div><div class="sl">${ex.timed||ex.cardio||ex.dist?'':'e1RM'}</div><div class="sl"></div><div class="sl"></div></div>`;
    let wsn=0;
    ex.sets.forEach((s,si)=>{if(!s.warmup)wsn++;html+=setRowHTML(ex,ei,s,si,wsn);});
    html+=`<div class="exb-foot">
      <button class="fbtn" onclick="addSet(${ei})">${ICON('plus',14)} Set</button>
      ${ei<wk.exercises.length-1?`<button class="fbtn fbtn-q ss-link-btn${linked?' linked':''}" onclick="toggleSessionLink(${ei})" title="${esc(LINK_HINT[(linkAction(wk.exercises,ei)||'link')])}" aria-label="${esc(LINK_HINT[(linkAction(wk.exercises,ei)||'link')])}">${ICON('link',14)} ${LINK_LABEL[(linkAction(wk.exercises,ei)||'link')]}</button>`:''}
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
  saveLive();
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
  if((f==='w'||f==='r'||f==='rmin'||f==='d')&&String(v).trim()!==''&&!(parseFloat(v)>=0)){ // negative, or not a number
    toast(f==='w'?'Weight can’t be negative':'That has to be 0 or more');
    const inp=setInputs(ei,si)[f==='w'||f==='d'?'w':'r'];if(inp)inp.value=f==='w'?(s.w||''):f==='r'?(s.r||''):inp.value;return;
  }
  if(f==='rmin'){const m=parseFloat(v);s.r=m>0?String(Math.round(m*60)):'';saveLive();return;}
  s[f]=v;
  if(f==='w'){s._manual=(v!==''&&v!=null);recalcExercise(ei);syncExInputs(ei);}
  else saveLive();
}
function refreshSessionStats(){
  const wk=S.activeWorkout;if(!wk)return;
  const a=document.getElementById('ss-sets');if(a)a.textContent=doneSetCnt(wk);
  const b=document.getElementById('ss-vol');if(b)b.textContent=Math.round(totalVol(wk)).toLocaleString();
}
// Ticking a set done. A number that cannot be right is refused; one far beyond your own best for the
// lift is asked about first (a dropped decimal or an extra digit), because it would otherwise become a
// record that every chart and target then builds on.
function togSetCheck(ex,s){
  const w=parseFloat(s.w),r=parseFloat(s.r);
  if(w<0||r<0)return{block:'Weight and reps can’t be negative'};
  if(w>SANE.load[isKg()?'kg':'lbs'])return{block:`${fmt1(w)} ${S.unit} is more than anyone has lifted. Check the weight.`};
  if(!ex.timed&&!ex.cardio&&!ex.dist&&r>SANE.reps)return{block:`${r} reps in one set? Check the reps.`};
  if(ex.timed&&r>SANE.secs)return{block:'That hold is over an hour. Check the seconds.'};
  const c=prCandidate(ex,Object.assign({},s,{done:true}));const prior=c&&priorBest(ex.exId); // as it would be once ticked
  const margin=isKg()?15:30;
  if(c&&prior&&prior.est>0&&c.est>prior.est*1.5&&c.est-prior.est>margin)
    return{ask:`${fmt1(w)} ${S.unit} × ${r} would put your estimated max at ${Math.round(c.est)} ${S.unit}, against ${Math.round(prior.est)} before. Is that right?`};
  return null;
}
function togSet(ei,si,sure){
  const wk=S.activeWorkout;if(!wk)return;
  const ex=wk.exercises[ei];const s=ex&&ex.sets[si];if(!s)return;
  const inp=setInputs(ei,si);
  if(inp.w)s.w=inp.w.value;if(inp.r)s.r=inp.r.value;
  if(!s.done&&!sure){
    const chk=togSetCheck(ex,s);
    if(chk&&chk.block){toast(chk.block,'red',{ms:3600});return;}
    if(chk&&chk.ask){customConfirm(esc(chk.ask),'Log it',()=>togSet(ei,si,true),{title:'Far above your best',safe:true});return;}
  }
  const prior=priorBest(ex.exId);
  const livePrev=(S.prs[ex.exId]&&S.prs[ex.exId].live)?S.prs[ex.exId].est:0;
  s.done=!s.done;
  if(s.done){s.t=Date.now();delete s.skip;}else{delete s.t;delete s.fail;} // a set is done, failed or skipped, never two at once
  rebuildPRs();
  if(s.done){
    const c=prCandidate(ex,s);
    if(c&&c.est>(prior?prior.est:0)&&c.est>livePrev)toast(`New record: ${exName(ex.exId)} ${c.w} ${S.unit} × ${c.r}`,'gold');
    if(isLastInSuperset(ei)){const rest=exRestFor(ex.exId);if(rest>0)startRest(rest);else skipRest();}
    if(ex.rirT!=null&&s.rir==null&&!s.warmup&&!ex.timed&&!ex.cardio){s._showTag=true;saveLive();renderSession(document.getElementById('content'));refreshSessionStats();return;}
  }
  saveLive();
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
function setTag(ei,si,tag){const s=S.activeWorkout?.exercises[ei]?.sets[si];if(!s)return;s.tag=s.tag===tag?'':tag;s._showTag=false;saveLive();renderSession(document.getElementById('content'));}
function setRir(ei,si,v){const s=S.activeWorkout?.exercises[ei]?.sets[si];if(!s)return;if(s.rir===v)delete s.rir;else s.rir=v;s._showTag=false;saveLive();renderSession(document.getElementById('content'));}
function clearTags(ei,si){const s=S.activeWorkout?.exercises[ei]?.sets[si];if(!s)return;s.tag='';delete s.rir;s._showTag=false;saveLive();renderSession(document.getElementById('content'));}
function addSet(ei){
  const ex=S.activeWorkout?.exercises[ei];if(!ex)return;
  const working=ex.sets.filter(s=>!s.warmup);
  const last=working[working.length-1];
  const ns={w:'',r:last?.r||'',done:false,tag:'',warmup:false,_manual:false};
  ex.sets.push(ns);
  recalcExercise(ei);
  // Straight sets: "one more" means one more at the weight you just used, not back at set 1.
  if((ex.progression||'flat')==='flat'&&last&&last.w!==''&&last.w!=null&&String(last.w)!==ns.w){ns.w=String(last.w);ns._manual=true;saveLive();}
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
  rebuildPRs();saveLive();renderSession(document.getElementById('content'));
  if(removed.done)toast('Completed set removed','gold',{action:'Undo',onAction:()=>{
    const cur=S.activeWorkout?.exercises[ei];if(!cur||cur.exId!==ex.exId)return;
    cur.sets.push(removed);rebuildPRs();saveLive();renderSession(document.getElementById('content'));
  }});
}
function removeEx(ei){
  const wk=S.activeWorkout;if(!wk||!wk.exercises[ei])return;
  const [removed]=wk.exercises.splice(ei,1);
  cleanSessionLinks();rebuildPRs();saveLive();renderSession(document.getElementById('content'));
  toast(`${exName(removed.exId)} removed`,'gold',{action:'Undo',onAction:()=>{
    if(S.activeWorkout!==wk)return;
    wk.exercises.splice(Math.min(ei,wk.exercises.length),0,removed);
    rebuildPRs();saveLive();renderSession(document.getElementById('content'));
  }});
}
function moveExInSession(ei,dir){
  if(!S.activeWorkout)return;
  const arr=S.activeWorkout.exercises;const j=ei+dir;
  if(j<0||j>=arr.length)return;
  [arr[ei],arr[j]]=[arr[j],arr[ei]];
  cleanSessionLinks();saveLive();renderSession(document.getElementById('content'));
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
  customConfirm(n?`This workout and its ${n} logged set${n===1?'':'s'} will not be saved.`:'This workout will not be saved.','Discard workout',discardWorkout);
}
// Less-used actions for one exercise live behind one button, so the row never wraps on a small phone.
function showExMenu(ei){
  const wk=S.activeWorkout;const ex=wk&&wk.exercises[ei];if(!ex)return;
  const info=getEx(ex.exId);
  const row=(icon,label,js,cls)=>`<button class="row row-tap${cls||''}" onclick="closeOv('exm-ov');${js}"><span class="row-ic">${ICON(icon,17)}</span><span class="row-main"><span class="row-t">${label}</span></span></button>`;
  const ov=makeOv('exm-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">${esc(exName(ex.exId))}</div><div class="list">
    ${ei>0?row('arrowup','Move up',`moveExInSession(${ei},-1)`):''}
    ${ei<wk.exercises.length-1?row('arrowdown','Move down',`moveExInSession(${ei},1)`):''}
    ${row('plus','Add a warm-up set',`addWarmup(${ei})`)}
    ${ex.sets.length>1?row('minusc','Remove the last set',`rmLastSet(${ei})`):''}
    ${info&&info.eq==='Bodyweight'&&!ex.timed?row('arrowup','Pyramid the reps',`setTimeout(()=>showPyramid(${ei}),240)`):''}
    ${row('x','Remove from this workout',`removeEx(${ei})`,' row-danger')}
  </div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
// ─── Plate Calc ───
// Loads from the plates you own when Settings say so (87-gear.js), otherwise from a full set.
// The bar picked here is remembered.
function showPlateCalc(ei){
  const ex=S.activeWorkout?.exercises[ei];
  const next=ex?.sets.find(s=>!s.done&&!s.warmup&&s.w)||ex?.sets.find(s=>!s.done&&s.w);
  const lastW=next?.w||ex?.sets.filter(s=>s.done).slice(-1)[0]?.w||ex?.sets[0]?.w||'';
  const ov=makeOv('plate-ov');const bar=gearBar();
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div class="mt" style="margin-bottom:${gearFixed()?2:14}px">Plate Calculator</div>
    ${gearFixed()?`<div class="sheet-sub">From the plates you own. <a onclick="closeOv('plate-ov');showGear()">Change</a></div>`:''}
    <div class="fg"><label class="fl">Target Weight (${S.unit})</label><input type="number" inputmode="decimal" id="plt-tgt" value="${esc(lastW)}" placeholder="0" oninput="calcPltDisp()"></div>
    <div class="seg seg-in" style="margin:0 0 14px" role="radiogroup" aria-label="Bar">${barOptions().map(b=>`<button class="seg-b${b===bar?' on':''}" role="radio" aria-checked="${b===bar}" onclick="pltBar(${b})">${b} ${S.unit}</button>`).join('')}</div>
    <div id="plt-result"></div>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);calcPltDisp();
}
function pltBar(b){
  if(!barOptions().includes(b))return;
  S.gear.bar=b;_loadMemo=null;save();
  document.querySelectorAll('#plate-ov .seg-b').forEach(el=>{const on=el.textContent.startsWith(b+' ');el.classList.toggle('on',on);el.setAttribute('aria-checked',on?'true':'false');});
  calcPltDisp();
}
function calcPltDisp(){
  const tgt=parseFloat(document.getElementById('plt-tgt')?.value);
  const bar=gearBar();const u=S.unit;
  const el=document.getElementById('plt-result');if(!el)return;
  if(!tgt){el.innerHTML='';return;}
  const r=platesFor(tgt,bar);
  if(r.under){el.innerHTML=`<div style="color:var(--red);font-size:13px;text-align:center;padding:12px">Below bar weight (${bar}${u})</div>`;return;}
  const sz=plateSizes();
  const cls=w=>w>=sz[0]?'p45':w>=sz[1]?'p35':w>=sz[2]?'p25':w>=sz[3]?'p10':w>=sz[4]?'p5':'p2';
  let note='';
  if(r.rem>0.01){
    if(gearFixed())note=`<div class="plt-note">Your plates make <b>${fmt1(r.below)} ${u}</b>${r.above!=null?` or <b>${fmt1(r.above)} ${u}</b>`:''}, not ${fmt1(tgt)}.</div>`;
    else note=`<div style="text-align:center;font-size:12px;color:var(--gold);font-weight:600">~${r.rem.toFixed(2)}${u} remainder</div>`;
  }
  el.innerHTML=`<div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:8px;font-weight:600;">Each side · bar ${bar}${u}</div>
    <div class="plate-visual">${r.plates.length?r.plates.map(w=>`<div class="plate ${cls(w)}">${w}</div>`).join(''):'<div style="color:var(--muted);font-size:12px">Just the bar</div>'}</div>${note}`;
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
  const prs=getPRsFromSess(wk);const diff=getRoutineDiff(wk);const vs=vsLastHTML(wk);const aft=aftFromWorkout(wk);
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
    ${vs}
    ${aft.n?`<div class="fin-aft"><div><b>Army Fitness</b><span>${aft.rows.map(x=>`${esc(aftEvent(x.id).name)} ${esc(aftFmtRaw(x.id,x.v))}`).join(' · ')}</span></div>
      <label class="ip-opt" style="margin:8px 0 0"><input type="checkbox" id="fin-aft"${aft.n>=3?' checked':''}><span>Save ${aft.n===1?'this':'these'} to your Army Fitness results${aft.n>=3?' as a test':''}</span></label></div>`:''}
    ${prs.length?`<div style="background:var(--gdim);border:1px solid rgba(184,124,42,.22);border-radius:10px;padding:10px 16px;margin-bottom:12px;color:var(--gold);font-size:13px;font-weight:600">${ICON('trophy',15)} New PR${prs.length>1?'s':''}: ${prs.map(esc).join(', ')}</div>`:''}
    ${diff?`<div style="background:var(--bdim);border:1px solid rgba(42,111,196,.18);border-radius:10px;padding:11px 16px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;color:var(--blue);margin-bottom:7px">Changes to this workout</div>
      ${(diff.swapped||[]).map(n=>`<div style="color:var(--navy);font-size:12px;font-weight:500">⇄ ${esc(n)}</div>`).join('')}
      ${diff.added.map(n=>`<div style="color:var(--green);font-size:12px;font-weight:500">+ ${esc(n)}</div>`).join('')}
      ${diff.changed.map(n=>`<div style="color:var(--gold);font-size:12px;font-weight:500">~ ${esc(n)}</div>`).join('')}
      <button class="btn btb bsm bfw" style="margin-top:8px" onclick="saveRoutineChanges(${jsq(wk.routineId)})">Update ${esc(wk.name||'the workout')} with these changes</button>
    </div>`:''}
    ${S.trackFeel?`<div class="fg"><label class="fl">How did it go? <small>optional</small></label><div class="feel-row" id="fin-feel" role="group" aria-label="How did it go">${FEEL_LABELS.map((l,i)=>`<button class="chip${wk.feel===i+1?' on':''}" data-f="${i+1}" aria-pressed="${wk.feel===i+1?'true':'false'}" onclick="setFeel(${i+1})">${l}</button>`).join('')}</div></div>`:''}
    <div class="fg"><label class="fl">Notes</label><textarea id="wknt" style="min-height:55px;font-size:13px" placeholder="Anything worth remembering">${esc(wk.notes||'')}</textarea></div>
    ${finSaveHTML(wk)}
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('fin-ov')">Cancel · keep going</button>
    <button class="fin-discard" id="fin-discard" onclick="finDiscard()">Discard workout</button>
  </div>`;
  ov._onDismiss=finDiscardDisarm;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
// Save, or why not: a workout with nothing ticked has nothing to save (it would sit in History as
// "0 sets"), and sets left unticked are said out loud, because they will not count.
function finSaveHTML(wk){
  const done=doneSetCnt(wk);
  if(!done)return`<div class="fin-note">Nothing is ticked yet, so there is nothing to save. Keep going, or discard it.</div>`;
  const left=wk.exercises.reduce((t,e)=>t+e.sets.filter(x=>!x.done&&!x.skip&&!x.warmup).length,0);
  return`${left?`<div class="fin-note">${left} set${left===1?' isn’t':'s aren’t'} ticked. ${left===1?'It':'They'} won’t count.</div>`:''}<button class="btn btp bfw" onclick="saveWorkout()">Save Workout</button>`;
}
// Discard from the Finish sheet, in two taps: the first arms it (the button turns red and says what
// will be lost), the second, within 4 seconds, throws the workout away. It can still be undone from the toast.
let _finDiscardT=null;
function finDiscard(){
  const b=document.getElementById('fin-discard');const wk=S.activeWorkout;if(!b||!wk)return;
  if(!_finDiscardT){
    const n=doneSetCnt(wk);
    b.classList.add('armed');b.textContent=n?`Tap again to discard ${n} logged set${n===1?'':'s'}`:'Tap again to discard';
    _finDiscardT=setTimeout(finDiscardDisarm,4000);return;
  }
  finDiscardDisarm();closeOv('fin-ov');discardWorkout();
}
function finDiscardDisarm(){
  if(_finDiscardT){clearTimeout(_finDiscardT);_finDiscardT=null;}
  const b=document.getElementById('fin-discard');if(b){b.classList.remove('armed');b.textContent='Discard workout';}
}
// Throw the open workout away. Undo on the toast puts it back exactly as it was.
function discardWorkout(){
  const wk=S.activeWorkout;if(!wk)return;
  const snap=JSON.stringify(wk);
  S.activeWorkout=null;endSessionTimers();rebuildPRs();saveNow();sessionDone();
  toast('Workout discarded','',{action:'Undo',ms:8000,onAction:()=>{
    if(S.activeWorkout){toast('Another workout is open now');return;}
    S.activeWorkout=JSON.parse(snap);rebuildPRs();saveNow();sessionGo();toast('Workout back');
  }});
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
  if(!doneSetCnt(wk)){toast('Nothing is ticked yet: nothing to save');return;}
  const n=document.getElementById('wkn');const nt=document.getElementById('wknt');
  if(n)wk.name=n.value.trim()||wk.name;if(nt)wk.notes=nt.value;
  const now=Date.now();const tm=sessionTiming(wk,now);
  const saveAft=!!document.getElementById('fin-aft')?.checked;
  // Taken before anything is trimmed or filed, so Undo on the toast can put the workout back exactly.
  const _ag0=getActiveGroup();
  const snap={wk:JSON.parse(JSON.stringify(wk)),gid:_ag0&&_ag0.id,cursor:_ag0&&_ag0.cursor,
    nt:wk.routineId&&isObj(S.nextTargets)?S.nextTargets[wk.routineId]:undefined,
    programs:JSON.stringify(S.programs||[]),aft:saveAft?{cur:Object.assign({},S.aftCurrent),hist:(S.aftHistory||[]).slice()}:null};
  wk.ended=tm.trimmed?wk.started+tm.active:now;
  // Cardio done inside the workout is saved as its own activity below, so its minutes are not counted twice.
  const cardioMs=wk.exercises.filter(e=>e.cardio).reduce((t,e)=>t+e.sets.filter(setCounts).reduce((a,x)=>a+(parseInt(x.r)||0)*1000,0),0);
  wk.cals=sessionCals(Math.max(0,tm.active-cardioMs));
  // Session-only bookkeeping has no business in history.
  delete wk._origExIds;delete wk._origProgression;delete wk._swaps;delete wk._swipe;delete wk._swipeUndo;
  wk.exercises.forEach(ex=>{
    delete ex._af;delete ex.aimUsed;
    if(ex.aim)ex.aim={w:ex.aim.w,r:ex.aim.r,by:ex.aim.by}; // what you were aiming for, kept small
    ex.sets.forEach(s=>{delete s._showTag;delete s._manual;});
    delete ex.rirT;
  });
  progStamp(wk);
  const acts=cardioActivities(wk);
  if(acts.length)S.activities.unshift(...acts);
  if(saveAft)aftSaveFromWorkout(wk);
  // Coach targets are for one session of the routine: used now, so they go.
  if(wk.routineId&&isObj(S.nextTargets)&&S.nextTargets[wk.routineId])delete S.nextTargets[wk.routineId];
  S.workouts.unshift(wk);S.activeWorkout=null;
  const _ag=getActiveGroup();
  if(_ag&&_ag.mode==='rotation'&&(_ag.routineIds||[]).length){
    const curId=_ag.routineIds[(_ag.cursor||0)%_ag.routineIds.length];
    if(wk.routineId===curId)_ag.cursor=((_ag.cursor||0)+1)%_ag.routineIds.length;
  }
  endSessionTimers();rebuildPRs();saveNow();
  resolveProgramGroup(); // a program's last workout finishes it
  document.getElementById('fin-ov')?.remove();
  _lastSave=snap;
  const actions=[{label:'Undo',fn:()=>undoSaveWorkout()}];
  if(coachAI()&&S.ai.logAccess)actions.push({label:'Debrief',fn:()=>coachStart('debrief')});
  toast('Workout saved','green',{actions,ms:8000});go('workout'); // done: back to Home, where today shows it
}
// Takes a just-saved workout back out of history and reopens it where you left off.
let _lastSave=null;
function undoSaveWorkout(snap){
  snap=snap||_lastSave;if(!snap)return;
  if(S.activeWorkout){toast('Another workout is already open');return;}
  const i=S.workouts.findIndex(w=>w.id===snap.wk.id);if(i<0)return;
  S.workouts.splice(i,1);S.activeWorkout=snap.wk;
  S.activities=S.activities.filter(a=>a.wkId!==snap.wk.id);
  try{S.programs=normalizePrograms(JSON.parse(snap.programs),S.groups);}catch(e){}
  if(snap.aft){S.aftCurrent=snap.aft.cur;S.aftHistory=snap.aft.hist;}
  const g=(S.groups||[]).find(x=>x.id===snap.gid);if(g)g.cursor=snap.cursor;
  if(snap.nt!==undefined){if(!isObj(S.nextTargets))S.nextTargets={};S.nextTargets[snap.wk.routineId]=snap.nt;}
  _lastSave=null;rebuildPRs();saveNow();
  sessionGo();toast('Workout reopened');
}

// ─── Against last time ───
// Each exercise against the last session of the same workout (or, added on the fly, the last time it
// was done): its best set and its volume, up or down. One line each, so it reads at a glance.
function vsLastHTML(wk){
  const prev=wk.routineId?getLastRSess(wk.routineId):null;
  const rows=[];let volNow=0,volThen=0;
  wk.exercises.forEach(ex=>{
    if(!ex.sets.some(setCounts))return;
    const kind=ex.cardio?'cardio':ex.timed?'hold':ex.dist?'dist':exKind(ex.exId)==='reps'?'reps':'e1rm';
    let then=null;
    const src=prev&&prev.exercises.some(e=>e.exId===ex.exId)?prev:S.workouts.find(w=>w.id!==wk.id&&w.exercises.some(e=>e.exId===ex.exId&&e.sets.some(setCounts)));
    if(src){const e=src.exercises.find(x=>x.exId===ex.exId);then=e?exSessionBest(e,kind):null;}
    const now=exSessionBest(ex,kind);if(!now)return;
    const vol=t=>t.timed||t.dist||t.cardio?0:t.sets.filter(setCounts).reduce((a,x)=>a+(parseFloat(x.w)||0)*(parseInt(x.r)||0),0);
    if(then&&src){const e=src.exercises.find(x=>x.exId===ex.exId);volNow+=vol(ex);volThen+=vol(e);}
    const d=then?now.v-then.v:null;
    const fmt=v=>kind==='e1rm'?`${Math.round(v)}`:kind==='hold'?fmtSecs(v):kind==='cardio'?`${fmt1(v)} min`:String(Math.round(v));
    rows.push({name:exName(ex.exId),now:fmt(now.v),then:then?fmt(then.v):'',d,kind,dTxt:d==null?'new':d===0?'same':(d>0?'▲ ':'▼ ')+(kind==='hold'?fmtSecs(Math.abs(d)):fmt1(Math.abs(d)))});
  });
  if(!rows.length)return'';
  const head={e1rm:'est. max',reps:'reps',hold:'hold',dist:'m',cardio:'min'};
  const vd=volThen>0?Math.round((volNow-volThen)/volThen*100):null;
  return`<div class="vs-last"><div class="vs-h"><span>Against last time</span>${vd!=null?`<span class="dl-${vd>0?'good':vd<0?'warn':'flat'}">volume ${vd>0?'+':''}${vd}%</span>`:''}</div>
    ${rows.map(r=>`<div class="vs-r"><span class="vs-n">${esc(r.name)}<i>${esc(head[r.kind])}</i></span><span class="vs-v">${r.then?`${esc(r.then)} → `:''}<b>${esc(r.now)}</b></span><span class="vs-d dl-${r.d==null||r.d===0?'flat':r.d>0?'good':'warn'}">${esc(r.dTxt)}</span></div>`).join('')}</div>`;
}
// ─── Cardio inside a workout → an activity ───
function cardioActivities(wk){
  const out=[];
  wk.exercises.forEach(ex=>{
    if(!ex.cardio)return;const info=getEx(ex.exId);
    const done=ex.sets.filter(setCounts);if(!done.length)return;
    const sec=done.reduce((t,x)=>t+(parseInt(x.r)||0),0);const mi=done.reduce((t,x)=>t+(parseFloat(x.d)||0),0);
    if(!(sec>0)&&!(mi>0))return;
    const type=ACT_TYPES.some(a=>a.id===(info&&info.act))?info.act:'other';
    const act={id:uid(),type,date:dayOf(wk.started),dist:mi>0?String(Math.round(mi*100)/100):'',dur:sec>0?String(Math.max(1,Math.round(sec/60))):'',
      ruckWeight:'',terrain:'flat',notes:`${info?info.name:'Cardio'} · ${wk.name}`,src:'workout',wkId:wk.id};
    const t=ACT_TYPES.find(a=>a.id===type);const distCapable=(t&&t.fields||[]).includes('dist');
    if(distCapable&&!mi&&sec){act.dist=String(estDistanceMi(type,sec/60));act.distEst=true;}
    if(distCapable&&mi&&!sec){act.dur=String(estDurationMin(type,mi));act.durEst=true;}
    act.cals=activityCals(act);
    out.push(act);
  });
  return out;
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
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);window._pickRid=routineId;renderPickerList();
}
function setPickerEquip(id){S.equipPreset=id;save();document.querySelectorAll('#ex-ov .chip[data-eq]').forEach(c=>c.classList.toggle('on',c.dataset.eq===id));renderPickerList();}
function renderPickerList(){
  const q=(document.getElementById('ex-srch')?.value||'').toLowerCase();const cat=S.exFilter||'All';
  const preset=EQUIPMENT_PRESETS.find(p=>p.id===(S.equipPreset||'full'))||EQUIPMENT_PRESETS[0];
  let exs=allEx();if(preset.eqs)exs=exs.filter(e=>preset.eqs.includes(e.eq));
  if(cat!=='All')exs=exs.filter(e=>e.cat===cat);if(q){const al=libAliasIds(q);exs=exs.filter(e=>e.name.toLowerCase().includes(q)||al.has(e.id));}
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
