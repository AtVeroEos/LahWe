// ═══════════════════════════════════════════════════
// SWAP — substitute an exercise mid-workout, ranked from the exercise database and your own history
// ═══════════════════════════════════════════════════
// No AI and no network. A substitute has to train the same movement, a close one, or the same
// muscle. Among those, the lifts you have actually trained, and the ones you chose as a swap
// before, come first; anything you flagged for pain recently sinks. Every pick is remembered
// (S.swapLog), so the list learns which substitute you reach for.

// How often and how recently each exercise was trained, and the top set last time.
function exUsage(){
  return memo('exUsage',()=>{
    const u={};
    S.workouts.forEach(wk=>{ // newest first
      if(wk.type==='cardDeck')return;
      (wk.exercises||[]).forEach(ex=>{
        const done=(ex.sets||[]).filter(s=>s.done&&!s.warmup);if(!done.length)return;
        let e=u[ex.exId];
        if(!e){
          const top=done.reduce((a,s)=>(parseFloat(s.w)||0)>(parseFloat(a.w)||0)?s:a,done[0]);
          e=u[ex.exId]={n:0,last:wk.started,top:{w:top.w,r:top.r},timed:!!ex.timed};
        }
        e.n++;
      });
    });
    return u;
  });
}
function exSecondary(ex){return(SEC_MUSCLE[ex.id]||ex.sec||[]).map(normMuscle);}
function equipAllowed(){
  const preset=EQUIPMENT_PRESETS.find(p=>p.id===(S.equipPreset||'full'))||EQUIPMENT_PRESETS[0];
  return preset.eqs;
}
// Ranked substitutes for one exercise. opts: {exclude:[ids], anyEq:bool, limit:n}
function swapCandidates(exId,opts){
  opts=opts||{};
  const src=getEx(exId);if(!src)return[];
  const sp=exPattern(src),sm=normMuscle(src.muscle),sSec=exSecondary(src);
  const eqs=opts.anyEq?null:equipAllowed();
  const skip=new Set(opts.exclude||[]);skip.add(exId);
  const usage=exUsage();const picked=(S.swapLog||{})[exId]||{};
  const srcCompound=sp?COMPOUND_PATTERNS.has(sp):null;
  const now=Date.now();
  const out=[];
  allEx().forEach(c=>{
    if(skip.has(c.id))return;
    if(eqs&&!eqs.includes(c.eq))return;
    const cp=exPattern(c),cm=normMuscle(c.muscle);
    const samePat=!!(sp&&cp&&sp===cp);
    const nearPat=!!(sp&&cp&&!samePat&&(PATTERN_NEAR[sp]||[]).includes(cp));
    const sameMus=!!(sm&&cm&&sm===cm);
    if(!samePat&&!nearPat&&!sameMus)return; // not a substitute at all
    let score=samePat?60:nearPat?44:0;
    if(sameMus)score+=30;
    else if(sSec.includes(cm)||exSecondary(c).includes(sm))score+=10;
    if(srcCompound!==null&&cp&&COMPOUND_PATTERNS.has(cp)!==srcCompound)score-=15;
    const u=usage[c.id]||null;
    // What you have actually trained counts for a lot: a close movement you know beats an exact one you have never done.
    if(u){score+=12+Math.min(14,5*Math.log2(1+u.n));if(now-u.last<42*86400000)score+=4;}
    const times=Math.max(0,parseInt(picked[c.id])||0);
    if(times)score+=20*Math.min(3,times); // your own choice is the strongest signal there is
    // Trading a loaded lift for a bodyweight one is a step down; different kit is a small plus (the usual reason to swap is a busy station).
    if(src.eq!=='Bodyweight'&&c.eq==='Bodyweight')score-=12;
    else if(c.eq!==src.eq)score+=5;
    const pain=getExPainLevel(c.id);
    if(pain>=2)score-=50;else if(pain===1)score-=15;
    out.push({ex:c,score:Math.round(score*10)/10,match:samePat?'same':nearPat?'near':'muscle',usage:u,picked:times,pain});
  });
  out.sort((a,b)=>b.score-a.score||a.ex.name.localeCompare(b.ex.name));
  return opts.limit?out.slice(0,opts.limit):out;
}
// One short line saying why a candidate is on the list.
function swapWhy(c){
  const bits=[c.match==='same'?'Same movement':c.match==='near'?'Close movement':'Same muscle'];
  if(c.picked)bits.push(c.picked===1?'you swapped to it before':`your swap ${c.picked}×`);
  if(c.usage){
    const t=c.usage.top;const w=parseFloat(t.w)||0;
    const last=c.usage.timed?`${t.r||'?'}s`:w?`${t.w} ${S.unit} × ${t.r||'?'}`:`${t.r||'?'} reps`;
    bits.push(`done ${c.usage.n}×, last ${last}`);
  }else bits.push('new to you');
  if(c.pain)bits.push(c.pain>=2?'pain flagged':'pain flagged once');
  return bits.join(' · ');
}

// ─── Sheet ───
let _swap={ei:-1,anyEq:false,all:false};
function showSwap(ei){
  const wk=S.activeWorkout;if(!wk||!wk.exercises[ei])return;
  _swap={ei,anyEq:false,all:false};
  const ov=makeOv('swap-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div><div id="swap-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);renderSwap();
}
function renderSwap(){
  const el=document.getElementById('swap-body');const wk=S.activeWorkout;
  if(!el||!wk||!wk.exercises[_swap.ei]){closeOv('swap-ov');return;}
  const ex=wk.exercises[_swap.ei];const src=getEx(ex.exId);
  const inWk=wk.exercises.map(e=>e.exId);
  const list=swapCandidates(ex.exId,{exclude:inWk,anyEq:_swap.anyEq});
  const shown=_swap.all?list:list.slice(0,6);
  const done=ex.sets.filter(s=>s.done).length;
  const limited=!!equipAllowed();
  const pat=exPattern(src);
  el.innerHTML=`<div class="mt" style="margin-bottom:4px">Swap ${esc(src?src.name:'exercise')}</div>
    <div class="sheet-sub">${pat?`A ${esc(PATTERN_LABEL[pat])} for ${esc(normMuscle(src.muscle)||'the same muscle')}.`:`Trains ${esc(normMuscle(src&&src.muscle)||'the same muscle')}.`} Ranked by how close the movement is and what you have trained. ${done?`Your ${done} finished set${done===1?'':'s'} stay${done===1?'s':''} logged; the swap takes the rest.`:'Sets, reps and rest carry over.'}</div>
    ${shown.length?`<div class="list">${shown.map((c,i)=>`<button class="row row-tap" onclick="doSwap(${_swap.ei},${jsq(c.ex.id)})">
      <span class="row-main"><span class="row-t">${esc(c.ex.name)}${i===0?'<span class="pill pill-acc">Best match</span>':''}</span><span class="row-s">${esc(c.ex.eq)} · ${esc(swapWhy(c))}</span></span>
      <span class="row-chev">${ICON('chev',16)}</span></button>`).join('')}</div>`
      :`<div class="chat-empty">Nothing in your exercise list trains this the same way${limited&&!_swap.anyEq?' with the equipment you have set':''}.</div>`}
    <div class="sheet-acts">
      ${!_swap.all&&list.length>shown.length?`<button class="btn bts bsm" onclick="_swap.all=true;renderSwap()">Show all ${list.length}</button>`:''}
      ${limited?`<button class="btn bts bsm" onclick="_swap.anyEq=!_swap.anyEq;renderSwap()">${_swap.anyEq?'Only my equipment':'Any equipment'}</button>`:''}
    </div>
    <button class="btn btg bfw" style="margin-top:6px" onclick="closeOv('swap-ov')">Keep ${esc(src?src.name:'it')}</button>`;
}
// Replace exercise `ei` in the open workout with `newId`. Finished sets are never thrown away:
// they stay under the original lift and the substitute takes the sets that were left.
function doSwap(ei,newId){
  const wk=S.activeWorkout;if(!wk||!wk.exercises[ei]||!getEx(newId))return false;
  const old=wk.exercises[ei];
  if(old.exId===newId||wk.exercises.some(e=>e.exId===newId))return false;
  const before=JSON.stringify(wk.exercises);const beforeSwaps=JSON.stringify(wk._swaps||[]);
  const t=old.target||{};
  const doneSets=old.sets.filter(s=>s.done);
  const doneWork=doneSets.filter(s=>!s.warmup).length;
  const plannedWork=old.sets.filter(s=>!s.warmup).length;
  const left=doneSets.length?Math.max(1,plannedWork-doneWork):Math.max(1,parseInt(t.sets)||plannedWork||3);
  const hold=HOLD_EX.has(newId);
  // A hold stays a hold only when both lifts are holds; otherwise the reps come from the new lift's own history.
  const keepReps=!!old.timed===hold;
  const re={exId:newId,sets:left,w:'',r:keepReps?(t.r||''):'',rMax:keepReps?(t.rMax||''):'',amrap:keepReps&&!!t.amrap,timed:hold,
    type:old.progression||'flat',rest:old.rest,link:old.link,note:''};
  const nu=sessionExercise(newId,null,re);
  nu._swappedFrom=old.exId;
  if(doneSets.length){old.sets=doneSets;wk.exercises.splice(ei+1,0,nu);}
  else wk.exercises[ei]=nu;
  (wk._swaps=wk._swaps||[]).push({from:old.exId,to:newId});
  if(!isObj(S.swapLog))S.swapLog={};
  const log=S.swapLog[old.exId]=S.swapLog[old.exId]||{};log[newId]=(parseInt(log[newId])||0)+1;
  cleanSessionLinks();rebuildPRs();save();
  closeOv('swap-ov');
  if(S.tab==='workout')renderSession(document.getElementById('content'));
  toast(`${exName(old.exId)} → ${exName(newId)}`,'green',{action:'Undo',ms:5000,onAction:()=>{
    if(S.activeWorkout!==wk)return;
    try{wk.exercises=JSON.parse(before);wk._swaps=JSON.parse(beforeSwaps);}catch(e){return;}
    const l=S.swapLog[old.exId];if(l&&l[newId]){l[newId]--;if(l[newId]<=0)delete l[newId];if(!Object.keys(l).length)delete S.swapLog[old.exId];}
    rebuildPRs();save();if(S.tab==='workout')renderSession(document.getElementById('content'));
  }});
  return true;
}
// Swaps made in this workout that still stand: the original is gone (or kept only for its finished
// sets) and the substitute is present. Used to offer "save to routine" as a replacement, not an addition.
function sessionSwaps(wk){
  const orig=wk._origExIds||[];const now=wk.exercises.map(e=>e.exId);
  const seen=new Set();
  return(wk._swaps||[]).filter(s=>{
    if(!orig.includes(s.from)||!now.includes(s.to)||orig.includes(s.to)||seen.has(s.from))return false;
    seen.add(s.from);return true;
  });
}
function normalizeSwapLog(v){
  const out={};if(!isObj(v))return out;
  Object.keys(v).slice(0,400).forEach(from=>{
    if(!isObj(v[from]))return;const row={};
    Object.keys(v[from]).slice(0,40).forEach(to=>{const n=parseInt(v[from][to]);if(n>0&&typeof to==='string')row[to]=Math.min(n,999);});
    if(Object.keys(row).length)out[from]=row;
  });
  return out;
}
