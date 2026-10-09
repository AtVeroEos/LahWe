// ═══════════════════════════════════════════════════
// QUICK ACTIONS — copy last session, pyramid the reps
// ═══════════════════════════════════════════════════
// Two taps that replace typing every set by hand in the middle of a workout.

// ─── Last: what you did, copied into the sets still to do ───
// Aim (48-targets.js) fills in what to AIM for; Last fills in what you DID. Both only touch sets that
// are not finished, and a finished set is never changed.
function applyLast(ei){
  const wk=S.activeWorkout;const ex=wk&&wk.exercises[ei];if(!ex)return;
  const last=lastWorkSets(ex.exId,wk.routineId);
  if(!last.length){toast('No earlier session of this lift to copy');return;}
  // Set 3 gets last time's set 3, whether or not sets 1 and 2 are already done.
  let n=0,k=-1;
  ex.sets.forEach(s=>{
    if(s.warmup)return;
    k++;
    if(s.done)return;
    const src=last[Math.min(k,last.length-1)];
    if(src.w!=null&&src.w!=='')s.w=String(src.w);
    if(src.r!=null&&src.r!=='')s.r=String(src.r);
    s._manual=false;delete s.skip;
    n++;
  });
  if(!n){toast('Every set is already done');return;}
  markManualSets(ex); // sets whose weight differs from the straight/pyramid rule stay as copied
  save();renderSession(document.getElementById('content'));
  toast(`Last session copied into ${n} set${n===1?'':'s'}`);
}

// ─── Pyramid ───
// Reps for `n` sets. `start` is the first set; Up adds `step` each set, Down takes it away
// (so start is the top), and Up & down climbs to the middle and comes back the same way.
function pyramidReps(n,start,step,shape){
  n=Math.max(0,n|0);start=Math.max(1,start|0);step=Math.max(1,step|0);
  const up=i=>start+step*i;
  const out=[];
  for(let i=0;i<n;i++){
    if(shape==='down')out.push(Math.max(1,start-step*i));
    else if(shape==='updown')out.push(i<Math.ceil(n/2)?up(i):up(n-1-i));
    else out.push(up(i));
  }
  return out;
}
const PYR_SHAPES=[['up','Up'],['down','Down'],['updown','Up & down']];
const PYR_STEPS=[1,2,3,5];
let _pyr=null;
function showPyramid(ei){
  const wk=S.activeWorkout;const ex=wk&&wk.exercises[ei];if(!ex)return;
  const work=ex.sets.filter(s=>!s.warmup);
  if(work.length<2){toast('Add a second set first: a pyramid needs at least two');return;}
  const first=parseInt(work[0].r)||parseInt(ex.target&&ex.target.r)||5;
  _pyr={ei,shape:'up',step:2,start:first};
  const ov=makeOv('pyr-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Pyramid · ${esc(exName(ex.exId))}</div>
    <div class="sheet-sub">Sets that are not finished get new reps. Finished sets stay as logged.</div>
    <div class="fg"><label class="fl">Shape</label><div class="seg seg-in" id="pyr-shape" role="group">${PYR_SHAPES.map(s=>`<button class="seg-b" data-v="${s[0]}" onclick="pyrSet('shape','${s[0]}')">${s[1]}</button>`).join('')}</div></div>
    <div class="fg"><label class="fl">Reps change by</label><div class="seg seg-in" id="pyr-step" role="group">${PYR_STEPS.map(v=>`<button class="seg-b" data-v="${v}" onclick="pyrSet('step',${v})">${v}</button>`).join('')}</div></div>
    <div class="fg"><label class="fl" id="pyr-start-l">First set</label><div class="pyr-start"><button class="btn bts" onclick="pyrSet('start',_pyr.start-1)" aria-label="One fewer">−</button><div class="pyr-n" id="pyr-n"></div><button class="btn bts" onclick="pyrSet('start',_pyr.start+1)" aria-label="One more">+</button></div></div>
    <div class="pyr-prev" id="pyr-prev" aria-live="polite"></div>
    <button class="btn btp bfw" onclick="applyPyramid()">Apply</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('pyr-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);pyrPaint();
}
function pyrSet(k,v){
  if(!_pyr)return;
  if(k==='start')v=Math.max(1,Math.min(200,v|0));
  _pyr[k]=v;pyrPaint();
}
function pyrPlan(){
  const ex=S.activeWorkout&&S.activeWorkout.exercises[_pyr.ei];if(!ex)return null;
  const work=ex.sets.filter(s=>!s.warmup);
  return{ex,work,reps:pyramidReps(work.length,_pyr.start,_pyr.step,_pyr.shape)};
}
function pyrPaint(){
  if(!_pyr)return;const p=pyrPlan();if(!p)return;
  document.querySelectorAll('#pyr-shape .seg-b').forEach(b=>b.classList.toggle('on',b.dataset.v===_pyr.shape));
  document.querySelectorAll('#pyr-step .seg-b').forEach(b=>b.classList.toggle('on',+b.dataset.v===_pyr.step));
  const n=document.getElementById('pyr-n');if(n)n.textContent=String(_pyr.start);
  const l=document.getElementById('pyr-start-l');if(l)l.textContent=_pyr.shape==='down'?'Top set (first)':'First set';
  const pv=document.getElementById('pyr-prev');
  if(pv)pv.innerHTML=p.reps.map((r,i)=>`<span class="pyr-c${p.work[i].done?' kept':''}">${r}</span>`).join('<i>›</i>')+(p.work.some(s=>s.done)?'<div class="fine" style="margin-top:6px">Outlined sets are finished and keep what you logged.</div>':'');
}
function applyPyramid(){
  const wk=S.activeWorkout;if(!_pyr||!wk)return;const p=pyrPlan();if(!p)return;
  const before=p.work.map(s=>({s,r:s.r}));
  p.work.forEach((s,i)=>{if(!s.done){s.r=String(p.reps[i]);delete s.skip;}});
  const ei=_pyr.ei;const exId=p.ex.exId;
  closeOv('pyr-ov');save();renderSession(document.getElementById('content'));
  toast(`Pyramid: ${p.reps.join(' › ')}`,'green',{action:'Undo',ms:6000,onAction:()=>{
    const cur=S.activeWorkout&&S.activeWorkout.exercises[ei];if(!cur||cur.exId!==exId)return;
    before.forEach(b=>{if(!b.s.done)b.s.r=b.r;});save();renderSession(document.getElementById('content'));
  }});
}
