// ═══════════════════════════════════════════════════
// SWIPE CHECK — the open workout, one set at a time
// ═══════════════════════════════════════════════════
// Not a second kind of workout: it is another way to look at S.activeWorkout. Build the workout as
// usual, then step through it. Each set is a card: swipe right when you did it, left when you missed
// it. Everything lands in the same sets the list view uses, so PRs, volume, rest timers, history and
// the targets for next time all work the same, and you can drop back to the list at any moment.
//
// Right = done at the weight and reps on the card. Left = missed: the set is logged with the reps you
// actually got (it counts as work, but it is never a record). Skip leaves the set undone, no data.
// Two modes, deliberately different:
//  - Simple: everything on one card. Weight and reps steppers, Last and Aim, a tag for how the set
//    felt, plates, pyramid, timed sets that run themselves, and (a setting) the rest on the card.
//    The card scrolls inside itself on a short screen, so nothing is cut off.
//  - Super Simple: glance and swipe. The lift, dots for the sets, and the target in very large type.
//    Tap a number to change it; nothing else is on the card. The rest is always on the card, as a
//    ring that rings and flips back to the next set.
// Both hide the tab bar: ‹ List and Finish are at the top.
const SWIPE_MIN_PX=70;     // how far a drag has to go to count
const SWIPE_FLICK=0.35;    // px per ms: a quick flick counts from a shorter drag
const SWIPE_FLICK_MIN=40;  // ...but never from less than this
const SWIPE_FLY_MS=170;
let _sw={busy:false,ask:null,touched:{},hold:null,peek:0,flip:false,edit:null,editKey:null};
// Simple mode, two extras (each a switch in Settings → Workout):
//  - The rest card: after a set the card becomes the rest countdown, and when the rest ends it
//    rings and flips to the next set by itself. "See the set" peeks at it while the rest keeps going.
//  - Timed sets run themselves: Start counts 3-2-1, then the hold; at zero it rings and the set is
//    logged at the planned time. Stop logs what you held (short of the plan, it counts as missed).
const HOLD_LEAD_MS=3000;

// ─── Order ───
// Every set in the order it is done. Straight exercises go set by set. A superset goes round by
// round (A1, B1, A2, B2 …), warm-ups first, so working set 1 of each lift lines up.
function swipeOrder(wk){
  const per=wk.exercises.map((ex,ei)=>{
    const wc=ex.sets.filter(s=>s.warmup).length;let w=0,k=0;
    return ex.sets.map((s,si)=>({ei,si,round:s.warmup?(w++)-wc:k++}));
  });
  const gAt={};ssGroups(wk.exercises).forEach(g=>{for(let k=g.start;k<=g.end;k++)gAt[k]=g;});
  const out=[];let i=0;
  while(i<wk.exercises.length){
    const g=gAt[i];
    if(g&&g.start===i){
      const all=[];for(let k=g.start;k<=g.end;k++)all.push(...per[k]);
      all.sort((a,b)=>a.round-b.round||a.ei-b.ei||a.si-b.si);
      out.push(...all);i=g.end+1;
    }else{out.push(...per[i]);i++;}
  }
  return out;
}
function swipePending(wk,order){
  order=order||swipeOrder(wk);
  return order.find(o=>{const s=wk.exercises[o.ei].sets[o.si];return !s.done&&!s.skip;})||null;
}
function swipeCounts(wk,order){
  order=order||swipeOrder(wk);
  const c={total:order.length,done:0,failed:0,skipped:0,left:0};
  order.forEach(o=>{
    const s=wk.exercises[o.ei].sets[o.si];
    if(s.done){c.done++;if(s.fail)c.failed++;}else if(s.skip)c.skipped++;else c.left++;
  });
  return c;
}
// Reps (or seconds) offered when a number has to be asked for. Missed sets can be anything from 0
// to the plan; a set with no plan number gets a wider run.
function swipeAskValues(ex,s,kind){
  const planned=parseInt(s.r)||parseInt(ex.target&&(ex.target.rMax||ex.target.r))||0;
  if(ex.timed){
    const top=Math.max(planned,kind==='ok'?120:30);const step=top>120?15:kind==='ok'?10:5;
    const v=[];for(let x=step;x<=top;x+=step)v.push(x);return v;
  }
  const top=Math.min(30,Math.max(planned,kind==='ok'?15:8));
  const v=[];for(let x=kind==='ok'?1:0;x<=top;x++)v.push(x);return v;
}
function swipeWantsLoad(ex){const eq=(getEx(ex.exId)||{}).eq;return !ex.timed&&eq!=='Bodyweight';}
// What a swipe in `dir` ('r' / 'l') should do right now: log it, ask for a number first, or refuse.
function swipePlan(dir){
  const wk=S.activeWorkout;const cur=wk&&swipePending(wk);if(!cur)return{act:'block',msg:''};
  const ex=wk.exercises[cur.ei];const s=ex.sets[cur.si];
  const reps=parseInt(s.r)>0;
  if(dir==='r'){
    if(swipeWantsLoad(ex)&&!(parseFloat(s.w)>0))return{act:'block',msg:wk._swipe==='super'?'Tap the weight to set it first':'Set the weight first (+ or −)'};
    if(!reps)return{act:'ask',kind:'ok'};
    return{act:'log',kind:'ok'};
  }
  if(_sw.touched[cur.ei+'-'+cur.si]&&reps)return{act:'log',kind:'fail'}; // you already typed what you got
  return{act:'ask',kind:'fail'};
}

// ─── Doing it ───
function swipePushUndo(wk,ei,si){
  const s=wk.exercises[ei].sets[si];
  (wk._swipeUndo=wk._swipeUndo||[]).push({ei,si,exId:wk.exercises[ei].exId,prev:{done:!!s.done,t:s.t,r:s.r,w:s.w,fail:!!s.fail,skip:!!s.skip}});
  if(wk._swipeUndo.length>40)wk._swipeUndo.shift();
}
function swipeLog(kind,reps){
  const wk=S.activeWorkout;const cur=wk&&swipePending(wk);if(!cur)return;
  const ex=wk.exercises[cur.ei];const s=ex.sets[cur.si];
  swipePushUndo(wk,cur.ei,cur.si);
  if(reps!=null)s.r=String(reps);
  if(kind==='skip'){s.skip=true;delete s.fail;save();}
  else{
    if(kind==='fail')s.fail=true;else delete s.fail;
    togSet(cur.ei,cur.si); // the one place a set is completed: PRs, volume, the rest timer
  }
  delete _sw.touched[cur.ei+'-'+cur.si];_sw.ask=null;
  renderSwipe(document.getElementById('content'));
}
function swipeSkip(){swipeLog('skip');}
// A number from the chips. A missed set with 0 reps was not attempted, so it is a skip.
function swipeAskPick(v){
  const a=_sw.ask;if(!a)return;
  if(a.kind==='fail'&&v===0){swipeLog('skip');return;}
  swipeLog(a.kind,v);
}
function swipeAskCancel(){_sw.ask=null;renderSwipe(document.getElementById('content'));}
function swipeUndo(){
  const wk=S.activeWorkout;if(!wk)return;
  let u=null,s=null;
  while(wk._swipeUndo&&wk._swipeUndo.length){ // entries for a lift that has since moved or gone are dropped
    u=wk._swipeUndo.pop();const ex=wk.exercises[u.ei];s=ex&&ex.exId===u.exId?ex.sets[u.si]:null;
    if(s)break;u=null;
  }
  if(!u||!s){toast('Nothing to undo');return;}
  const wasDone=!!s.done;
  s.done=u.prev.done;s.r=u.prev.r;s.w=u.prev.w;
  if(u.prev.t!=null)s.t=u.prev.t;else delete s.t;
  if(u.prev.fail)s.fail=true;else delete s.fail;
  if(u.prev.skip)s.skip=true;else delete s.skip;
  rebuildPRs();if(wasDone)skipRest();
  _sw.ask=null;save();renderSwipe(document.getElementById('content'));
}
function swipeReviveSkipped(){
  const wk=S.activeWorkout;if(!wk)return;
  wk.exercises.forEach(ex=>ex.sets.forEach(s=>{if(s.skip&&!s.done)delete s.skip;}));
  save();renderSwipe(document.getElementById('content'));
}
// The weight and reps steppers on the card. A weight change carries to the later sets of a straight
// lift (that is what "heavier today" means); a pyramid or drop keeps following its own rule.
function swipeAdj(f,dir){
  const wk=S.activeWorkout;const cur=wk&&swipePending(wk);if(!cur)return;
  const ex=wk.exercises[cur.ei];const s=ex.sets[cur.si];
  if(f==='w'){
    const eq=(getEx(ex.exId)||{}).eq||'Other';const base=parseFloat(s.w)||0;
    const nv=nextLoad(eq,base,dir); // the next loadable weight (Settings → Plates & dumbbells), else the step
    upd(cur.ei,cur.si,'w',nv>0?String(nv):'');
    if(!s.warmup&&(ex.progression||'flat')==='flat'&&nv>0)ex.sets.forEach((x,k)=>{if(k>cur.si&&!x.warmup&&!x.done&&!x.skip){x.w=String(nv);x._manual=true;}});
    save();
  }else{
    const step=ex.timed?5:1;const lo=parseInt(ex.target&&ex.target.r)||0;
    const base=parseInt(s.r);
    const nv=isNaN(base)?lo||step:Math.max(0,base+dir*step);
    upd(cur.ei,cur.si,'r',String(nv));
    _sw.touched[cur.ei+'-'+cur.si]=true;
  }
  renderSwipe(document.getElementById('content'));
}

// ─── Entering and leaving ───
function showSwipeStart(){
  const wk=S.activeWorkout;if(!wk||!wk.exercises.length)return;
  if(!swipeCounts(wk).left){toast('Every set is already done');return;}
  const ov=makeOv('swipe-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Swipe Check</div>
    <div class="sheet-sub">Your workout, one set at a time, in superset order. Swipe <b>right</b> when you did it, <b>left</b> when you missed it. You can go back to the list whenever you like.</div>
    <div style="display:grid;gap:10px;margin-bottom:14px">
      <div class="mode-card" onclick="enterSwipe('simple')"><div style="font-size:16px;font-weight:700;letter-spacing:-.02em;margin-bottom:4px">Simple</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">Everything on the card: weight and reps with big + and −, last time and your aim, a tag for how the set felt, plates, and timed sets that run themselves.</div></div>
      <div class="mode-card" onclick="enterSwipe('super')"><div style="font-size:16px;font-weight:700;letter-spacing:-.02em;margin-bottom:4px">Super Simple</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">Glance and swipe. The lift and the target in very large type, dots for the sets; tap a number to change it. The rest is a ring on the card that flips back to the next set.</div></div>
    </div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function enterSwipe(mode){
  const wk=S.activeWorkout;if(!wk)return;
  closeOv('swipe-ov');
  wk._swipe=mode==='super'?'super':'simple';_sw.ask=null;_sw.touched={};_sw.busy=false;holdStop();_sw.peek=0;_sw.edit=null;
  save();renderSession(document.getElementById('content'));
  const c=document.getElementById('content');if(c)c.scrollTop=0;
}
function exitSwipe(){
  const wk=S.activeWorkout;if(!wk)return;
  delete wk._swipe;_sw.ask=null;holdStop();save();
  renderSession(document.getElementById('content'));
}

// ─── Drawing ───
// One look for both modes: a rail with a segment for every set of the lift across the top of the
// card, the lift, then the numbers, and the next set in the card's footer. Simple adds its tools under
// the numbers; Super Simple is only the numbers, set very large.
function swipeTargetText(ex,s){
  const rph=ex.target&&!s.warmup?(fmtRepTarget(ex.target)||'?'):'?';
  const r=s.r!==''&&s.r!=null?s.r:rph;
  if(ex.timed)return`${r}s`;
  const w=parseFloat(s.w)||0;
  return w>0?`${fmt1(w)} ${S.unit} × ${r}`:`${r} reps`;
}
// A stepper row: what it is, − the value +.
function swipeStepper(label,val,ph,f){
  return`<div class="sw-f"><span class="sw-fl">${esc(label)}</span>
    <button class="sw-st" onclick="swipeAdj('${f}',-1)" aria-label="Less ${esc(label)}">−</button>
    <b class="sw-v${val===''?' ph':''}">${esc(val===''?ph:val)}</b>
    <button class="sw-st" onclick="swipeAdj('${f}',1)" aria-label="More ${esc(label)}">+</button></div>`;
}
// The set after this one (the next still to do), so a superset or the next lift is no surprise.
function swipeNextInfo(wk,order,cur){
  const i=order.findIndex(o=>o.ei===cur.ei&&o.si===cur.si);
  for(let k=i+1;k<order.length;k++){
    const o=order[k];const ex=wk.exercises[o.ei];const s=ex.sets[o.si];
    if(s.done||s.skip)continue;
    const n=ex.sets.slice(0,o.si+1).filter(x=>!!x.warmup===!!s.warmup).length;
    return{same:o.ei===cur.ei,name:(getEx(ex.exId)||{}).name||'Exercise',what:`${s.warmup?'Warm-up':'Set'} ${n}`,target:swipeTargetText(ex,s)};
  }
  return null;
}
function swipeNextText(wk,order,cur){const n=swipeNextInfo(wk,order,cur);return n?(n.same?n.what.toLowerCase():`${n.name} · ${n.what.toLowerCase()}`):'';}
function swipeFootHTML(wk,order,cur){
  const n=swipeNextInfo(wk,order,cur);
  if(!n)return`<div class="sw-foot"><span>Next</span><b>Last set of the workout</b></div>`;
  return`<div class="sw-foot"><span>Next</span><b>${esc(n.same?n.what:n.name)}</b><em>${esc(n.same?n.target:n.what+' · '+n.target)}</em></div>`;
}
// The rail: a segment for every set of this lift. Warm-ups are short; done is green, missed red,
// skipped hollow, the one up now in the accent colour.
function swipeRailHTML(ex,cur){
  return`<div class="sw-rail" aria-hidden="true">${ex.sets.map((x,si)=>{
    const c=si===cur.si?'now':x.done?(x.fail?'miss':'done'):x.skip?'skip':'';
    return`<i class="${x.warmup?'wu ':''}${c}"></i>`;}).join('')}</div>`;
}
const SW_TAGS=[['Easy','Easy'],['RPE 8','RPE 8'],['Hard','Hard'],['Form Issue','Form'],['Pain','Pain']];
// Tag the set you are about to log; tapping the tag again clears it.
function swipeTag(tag){
  const wk=S.activeWorkout;const cur=wk&&swipePending(wk);if(!cur)return;
  const s=wk.exercises[cur.ei].sets[cur.si];
  s.tag=s.tag===tag?'':tag;save();renderSwipe(document.getElementById('content'));
}
// One more set of this lift, at the weight just used.
function swipeAddSet(){
  const wk=S.activeWorkout;const cur=wk&&swipePending(wk);if(!cur)return;
  addSet(cur.ei);toast('Set added','green');
}
function swipeCardHTML(wk,cur,mode,order){
  const ex=wk.exercises[cur.ei];const s=ex.sets[cur.si];const info=getEx(ex.exId)||{};
  const isW=!!s.warmup;
  const before=ex.sets.slice(0,cur.si+1).filter(x=>!!x.warmup===isW).length;
  const of=ex.sets.filter(x=>!!x.warmup===isW).length;
  const setLbl=isW?`Warm-up ${before} of ${of}`:`Set ${before} of ${of}`;
  const g=ssGroups(wk.exercises).find(x=>cur.ei>=x.start&&cur.ei<=x.end);
  const ssTxt=g?`${ssInfo(ssGroups(wk.exercises),g).label} · ${cur.ei-g.start+1} of ${g.end-g.start+1}`:'';
  const stamps=`<div class="sw-stamp sw-stamp-r">DONE</div><div class="sw-stamp sw-stamp-l">MISSED</div>`;
  const head=`${swipeRailHTML(ex,cur)}<div class="sw-head"><div class="sw-name">${esc(info.name||'Exercise')}</div><div class="sw-meta"><span>${esc(setLbl)}</span>${ssTxt?`<span class="sw-ss">${esc(ssTxt)}</span>`:''}</div></div>`;
  if(_sw.ask){
    const kind=_sw.ask.kind;const vals=swipeAskValues(ex,s,kind);
    return`<div class="sw-card" id="sw-card" data-mode="${mode}" role="group" aria-label="Set to log">${head}
      <div class="sw-ask"><div class="sw-ask-t">${kind==='ok'?(ex.timed?'How many seconds?':'How many reps?'):(ex.timed?'How long did you last?':'How many reps did you get?')}</div>
        <div class="sw-chips">${vals.map(v=>`<button class="sw-chip-n${kind==='fail'&&v===0&&!ex.timed?' sw-chip-skip':''}" onclick="swipeAskPick(${v})">${kind==='fail'&&v===0&&!ex.timed?'0 · skip it':v}</button>`).join('')}</div>
        <button class="btn btg bfw" style="margin-top:10px" onclick="swipeAskCancel()">Back</button></div></div>`;
  }
  const rph=ex.target&&!isW?(fmtRepTarget(ex.target)||'–'):'–';
  const foot=swipeFootHTML(wk,order,cur);
  if(mode==='super')return swipeSuperHTML(wk,cur,ex,s,{head,stamps,rph,foot});
  const h=_sw.hold&&_sw.hold.key===cur.ei+'-'+cur.si?_sw.hold:null;
  if(h){
    return`<div class="sw-card sw-holding${_sw.flip?' sw-flip':''}" id="sw-card" data-mode="simple" role="timer" aria-label="Timed set">${head}
      <div class="sw-hold"><div class="sw-hold-k" id="sw-hold-k">${Date.now()<h.go?'Get set':'Hold'}</div><div class="sw-hold-t" id="sw-hold-t">${esc(holdClock(h))}</div>
        <div class="sw-hold-of">of ${esc(fmtSecs(h.total))}</div><div class="rst-bar sw-hold-bar"><i id="sw-hold-bar"></i></div></div>
      <div class="frow" style="gap:8px;margin-top:auto"><button class="btn bts bfw" onclick="holdCancel()">Cancel</button><button class="btn btp bfw" onclick="holdFinish()">Stop · log it</button></div></div>`;
  }
  const fields=ex.timed?swipeStepper('sec',s.r||'',rph,'r')
    :(swipeWantsLoad(ex)||parseFloat(s.w)>0?swipeStepper(S.unit,s.w?String(parseFloat(s.w)):'','–','w'):'')+swipeStepper('reps',s.r||'',rph,'r');
  const holdSecs=holdPlanSecs(ex,s);
  const holdBtn=S.swipeHold&&ex.timed&&!ex.cardio&&holdSecs>0?`<button class="btn btp bfw sw-hold-go" onclick="holdStart()">${ICON('play',15)} Start · ${esc(fmtSecs(holdSecs))}</button>`:'';
  const a=ex.aim;const lastStr=getLastStr(ex.exId,wk.routineId);
  const chips=[];
  if(lastStr&&lastWorkSets(ex.exId,wk.routineId).length)chips.push(`<button class="sw-chip" onclick="applyLast(${cur.ei})"><small>Last</small><span>${esc(lastStr.replace(/^Last: /,'').replace(/(\d)(lbs|kg)×/g,'$1 $2 × ').replace(/ · \d+ sets?$/,''))}</span></button>`);
  if(a&&!isW)chips.push(`<button class="sw-chip sw-chip-aim" onclick="applyAim(${cur.ei})"><small>${a.by==='coach'?'Coach aim':'Aim'}</small><span>${aimIcon(a,11)}${esc(fmtAim(a,ex.timed))}</span></button>`);
  const tags=isW?'':`<div class="sw-tags" role="group" aria-label="How the set felt">${SW_TAGS.map(([v,l])=>`<button class="sw-tag${s.tag===v?' on':''}${v==='Pain'?' pain':''}" aria-pressed="${s.tag===v?'true':'false'}" onclick="swipeTag('${v}')">${l}</button>`).join('')}</div>`;
  const lastOfLift=!isW&&cur.si===ex.sets.length-1;
  const tools=[
    swipeWantsLoad(ex)?`<button class="sw-link" onclick="showPlateCalc(${cur.ei})">${ICON('grid',13)} Plates</button>`:'',
    info.eq==='Bodyweight'&&!ex.timed?`<button class="sw-link" onclick="showPyramid(${cur.ei})">${ICON('arrowup',13)} Pyramid</button>`:'',
    lastOfLift?`<button class="sw-link" onclick="swipeAddSet()">${ICON('plus',13)} Another set</button>`:''].filter(Boolean);
  const flip=_sw.flip?' sw-flip':'';
  return`<div class="sw-card${flip}" id="sw-card" data-mode="simple" role="group" aria-label="Set to log">${stamps}${head}
    <div class="sw-fields">${fields}</div>${holdBtn}
    ${chips.length?`<div class="sw-chips2">${chips.join('')}</div>`:''}
    ${tags}
    ${tools.length?`<div class="sw-links">${tools.join('')}</div>`:''}
    ${ex.note?`<div class="sw-note">${esc(ex.note)}</div>`:''}
    ${foot}</div>`;
}
// ─── Super Simple ───
// One number as a scoreboard row: the number very large, what it is beside it. Tap it to change it:
// the row becomes − number + in place, and tapping Done (or logging the set) puts it back.
function swipeRowHTML(f,val,ph,unit,label){
  const empty=val===''||val==null;const shown=esc(empty?ph:val);
  if(_sw.edit===f)return`<div class="ss-row on">
      <button class="ss-pm" onclick="swipeAdj('${f}',-1)" aria-label="Less ${esc(label)}">−</button>
      <b class="ss-n${empty?' ph':''}">${shown}</b>
      <button class="ss-pm" onclick="swipeAdj('${f}',1)" aria-label="More ${esc(label)}">+</button>
      <button class="ss-ok" onclick="swipeEdit(null)">Done</button></div>`;
  return`<button class="ss-row" onclick="swipeEdit('${f}')" aria-label="${esc(label)}: ${shown}. Tap to change"><b class="ss-n${empty?' ph':''}">${shown}</b><span class="ss-u">${esc(unit)}</span></button>`;
}
function swipeEdit(f){
  const wk=S.activeWorkout;const cur=wk&&swipePending(wk);if(!cur)return;
  _sw.edit=_sw.edit===f?null:f;_sw.editKey=cur.ei+'-'+cur.si;
  renderSwipe(document.getElementById('content'));
}
function swipeSuperHTML(wk,cur,ex,s,o){
  const load=!ex.timed&&(swipeWantsLoad(ex)||parseFloat(s.w)>0);
  const rows=[];
  if(load)rows.push(swipeRowHTML('w',s.w?fmt1(parseFloat(s.w)):'','–',S.unit,'Weight'));
  rows.push(swipeRowHTML('r',s.r||'',o.rph,ex.timed?'sec':'reps',ex.timed?'Seconds':'Reps'));
  return`<div class="sw-card${_sw.flip?' sw-flip':''}" id="sw-card" data-mode="super" role="group" aria-label="Set to log">${o.stamps}${o.head}
    <div class="ss-rows${rows.length===1?' one':''}">${rows.join('')}</div>${o.foot}</div>`;
}
// ─── The rest, on the card ───
// A ring that empties as the rest runs down and turns green for the last ten seconds; at zero it rings
// and the card flips back to the set. Simple keeps −15 / +15 under it.
const SS_RING=2*Math.PI*54;
function swipeRestHTML(wk,order,cur,mode){
  const ex=wk.exercises[cur.ei];const s=ex.sets[cur.si];const info=getEx(ex.exId)||{};
  const isW=!!s.warmup;const n=ex.sets.slice(0,cur.si+1).filter(x=>!!x.warmup===isW).length;
  const rem=restRemaining();const tot=(S.restTimer&&S.restTimer.total)||rem;const frac=Math.max(0,Math.min(1,rem/Math.max(1,tot)));
  const simple=mode!=='super';const undo=(wk._swipeUndo||[]).length;
  return`<div class="sw-stage" data-mode="${simple?'simple':'super'}"><div class="sw-card sw-rest${_sw.flip?' sw-flip':''}" id="sw-rest" role="timer" aria-label="Rest">
      ${swipeRailHTML(ex,cur)}
      <div class="ss-ring${rem<=10?' go':''}" id="sw-rest-wrap"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ss-ring-bg" cx="60" cy="60" r="54"/><circle class="ss-ring-fg" id="sw-rest-ring" cx="60" cy="60" r="54" stroke-dasharray="${SS_RING.toFixed(1)}" stroke-dashoffset="${(SS_RING*(1-frac)).toFixed(1)}"/></svg>
        <div class="ss-ring-t"><small>Rest</small><b id="sw-rest-t">${fmtTimer(rem)}</b></div></div>
      ${simple?`<div class="sw-rest-row"><button class="rst-b" onclick="adjustRest(-15)" aria-label="15 seconds less">−15</button><button class="rst-b" onclick="adjustRest(15)" aria-label="15 seconds more">+15</button></div>`:''}
      <div class="sw-foot"><span>Up next</span><b>${esc(info.name||'Exercise')}</b><em>${esc((isW?'Warm-up ':'Set ')+n+' · '+swipeTargetText(ex,s))}</em></div>
    </div>
    <div class="sw-acts sw-rest-acts">${undo?`<button class="sw-mini" onclick="swipeUndo()" aria-label="Undo the last set">↶ Undo</button>`:''}${simple?`<button class="sw-mini" onclick="swipePeek()">See the set</button>`:''}<button class="sw-mini sw-go" onclick="skipRest()">Go now</button></div></div>`;
}

function renderSwipe(c){
  const wk=S.activeWorkout;if(!wk||!c)return;
  const mode=wk._swipe==='super'?'super':'simple';
  const order=swipeOrder(wk);const cnt=swipeCounts(wk,order);const cur=swipePending(wk,order);
  if(_sw.edit&&(!cur||_sw.editKey!==cur.ei+'-'+cur.si))_sw.edit=null; // the number being changed belongs to one set
  const el=Math.floor((Date.now()-wk.started)/1000);
  const pct=cnt.total?Math.round(100*(cnt.done+cnt.skipped)/cnt.total):0;
  let body;
  if(!cur){
    body=`<div class="sw-done"><div class="sw-done-ic">${ICON('trophy',34)}</div><div class="sw-done-t">${cnt.done?'All sets done':'Nothing left to do'}</div>
      <div class="sw-done-s">${cnt.done} logged${cnt.failed?` · ${cnt.failed} missed`:''}${cnt.skipped?` · ${cnt.skipped} skipped`:''}</div>
      <button class="btn btp bfw" onclick="showFinish()">Finish workout</button>
      ${cnt.skipped?`<button class="btn bts bfw" style="margin-top:8px" onclick="swipeReviveSkipped()">Do the ${cnt.skipped} skipped set${cnt.skipped===1?'':'s'}</button>`:''}
      <button class="btn btg bfw" style="margin-top:8px" onclick="exitSwipe()">Back to the list</button>
      ${(wk._swipeUndo||[]).length?`<button class="btn btg bfw" style="margin-top:8px" onclick="swipeUndo()">↶ Undo the last set</button>`:''}</div>`;
  }else if(swipeRestCardOn(mode)){
    body=swipeRestHTML(wk,order,cur,mode);
  }else{
    const asking=!!_sw.ask||!!_sw.hold; // a number to pick, or a set timing itself: the swipe buttons are put away
    const undo=(wk._swipeUndo||[]).length;
    const fresh=!cnt.done&&!cnt.skipped; // the hint is for the first set; after that the stamps say it
    body=`<div class="sw-stage" data-mode="${mode}">${swipeCardHTML(wk,cur,mode,order)}
      ${asking?'':`<div class="sw-acts">
        <button class="sw-btn sw-no" onclick="swipeFling('l')" aria-label="Missed it">${ICON('x',26)}</button>
        <div class="sw-mid">${mode==='super'?'':'<button class="sw-mini" onclick="swipeSkip()">Skip</button>'}${undo?`<button class="sw-mini" onclick="swipeUndo()" aria-label="Undo the last set">↶ Undo</button>`:''}</div>
        <button class="sw-btn sw-yes" onclick="swipeFling('r')" aria-label="Done">${ICON('tick',26)}</button>
      </div>${fresh?'<div class="sw-hint">Swipe right when you did it, left when you missed it</div>':''}`}</div>`;
  }
  c.classList.add('swipe-on'); // the page itself must not scroll under the card
  c.scrollTop=0;
  c.innerHTML=`<div class="fbar">
      <button class="btn btg bsm" onclick="exitSwipe()" aria-label="Back to the list">‹ List</button>
      <div class="fbar-name">${esc(wk.name)}</div>
      <span id="rest-pill" onclick="skipRest()"><span id="rest-pill-t"></span><span class="rp-x">✕</span></span>
      <span id="wt-el" class="wt">${fmtTimer(el)}</span>
      <button class="btn btp bsm" onclick="showFinish()">Finish</button>
    </div>
    <div class="sw-prog" role="progressbar" aria-label="Sets done" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
    ${body}`;
  _sw.flip=false;
  startWtTimer();
  if(S.restTimer&&!rInt)runRestTicker();else syncRestUI();
  swipeBind();
  if(_sw.hold)holdLoop();
}

// ─── The gesture ───
function swipeShake(){
  const card=document.getElementById('sw-card');if(!card||!card.animate)return;
  card.animate([{transform:'translateX(0)'},{transform:'translateX(-9px)'},{transform:'translateX(9px)'},{transform:'translateX(0)'}],{duration:220});
}
// A swipe or a tap on the big buttons. Anything that needs a number or a weight is dealt with first,
// before the card flies off, so a refused swipe never loses the card.
function swipeCardReset(card){
  card=card||document.getElementById('sw-card');if(!card)return;
  card.style.transform='';card.style.removeProperty('--p');card.dataset.dir='';
}
function swipeFling(dir){
  if(_sw.busy)return;
  const p=swipePlan(dir);
  if(p.act==='block'){swipeCardReset();if(p.msg){swipeShake();toast(p.msg);}return;}
  if(p.act==='ask'){_sw.ask={kind:p.kind};renderSwipe(document.getElementById('content'));return;}
  const card=document.getElementById('sw-card');
  const reduce=typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try{if(navigator.vibrate)navigator.vibrate(12);}catch(e){}
  if(!card||reduce){swipeLog(p.kind);return;}
  _sw.busy=true;
  card.style.transition=`transform ${SWIPE_FLY_MS}ms ease-out,opacity ${SWIPE_FLY_MS}ms`;
  card.style.transform=`translateX(${dir==='r'?'':'-'}120vw) rotate(${dir==='r'?16:-16}deg)`;card.style.opacity='0';
  setTimeout(()=>{_sw.busy=false;if(S.activeWorkout)swipeLog(p.kind);},SWIPE_FLY_MS);
}
function swipeBind(){
  const card=document.getElementById('sw-card');if(!card||_sw.ask||_sw.hold)return;
  let id=null,x0=0,y0=0,t0=0,dx=0,locked=false;
  const reset=()=>{dx=0;swipeCardReset(card);};
  card.addEventListener('pointerdown',e=>{
    // A drag can start anywhere on the card, buttons included: they fill most of it (the steppers, the
    // chips, Super Simple's numbers), and a thumb swipes across the middle. A tap is still a tap: the
    // pointer is only taken once the finger has clearly moved sideways (see pointermove).
    if(_sw.busy||id!==null||e.target.closest('input,textarea,select,a'))return;
    id=e.pointerId;x0=e.clientX;y0=e.clientY;t0=e.timeStamp;dx=0;locked=false;
    card.classList.add('drag'); // the pointer is captured once it is a swipe, so a plain tap still reaches a button
  });
  card.addEventListener('pointermove',e=>{
    if(e.pointerId!==id)return;
    const mx=e.clientX-x0,my=e.clientY-y0;
    // The page does not scroll here (touch-action: none), so a mostly-sideways drag is the swipe and
    // a drag that starts out mostly up or down is simply ignored; a wobble does not cancel it.
    if(!locked){if(Math.abs(mx)<6&&Math.abs(my)<6)return;if(Math.abs(my)>Math.abs(mx)*1.6)return;locked=true;try{card.setPointerCapture(id);}catch(err){}}
    dx=mx;const p=Math.max(-1,Math.min(1,dx/SWIPE_MIN_PX));
    card.style.transform=`translateX(${dx}px) rotate(${dx/22}deg)`;
    card.style.setProperty('--p',String(Math.abs(p)));card.dataset.dir=p>0.15?'r':p<-0.15?'l':'';
  });
  const end=e=>{
    if(e.pointerId!==id)return;id=null;card.classList.remove('drag');
    const speed=Math.abs(dx)/Math.max(1,e.timeStamp-t0);
    const far=locked&&e.type==='pointerup'&&(Math.abs(dx)>=SWIPE_MIN_PX||(speed>=SWIPE_FLICK&&Math.abs(dx)>=SWIPE_FLICK_MIN));
    const dir=dx>0?'r':'l';locked=false;
    // Fly on from where the finger let go. If the swipe is refused, the card springs back.
    if(far)swipeFling(dir);else reset();
  };
  card.addEventListener('pointerup',end);
  card.addEventListener('pointercancel',end);
}

// ─── The rest card ───
function swipeRestCardOn(mode){
  if(_sw.ask||_sw.hold)return false;
  if(mode==='simple'&&!S.swipeRest)return false; // Simple: a setting. Super Simple: always on the card
  const t=S.restTimer;if(!t||restRemaining()<=0)return false;
  return _sw.peek!==t.end; // "See the set" for this rest
}
function swipePeek(){if(S.restTimer)_sw.peek=S.restTimer.end;renderSwipe(document.getElementById('content'));}
// Called from syncRestUI on every tick while the rest card is up. Returns true when it handled it.
function swipeRestTick(active,rem){
  const card=document.getElementById('sw-rest');if(!card)return false;
  if(!active){ // over: flip to the set (once: the redraw itself asks again)
    if(_sw.flipping)return true;
    _sw.flipping=true;_sw.flip=true;
    try{renderSwipe(document.getElementById('content'));}finally{_sw.flipping=false;}
    return true;
  }
  const t=document.getElementById('sw-rest-t');if(t)t.textContent=fmtTimer(rem);
  const ring=document.getElementById('sw-rest-ring');if(ring){const tot=(S.restTimer&&S.restTimer.total)||rem;ring.setAttribute('stroke-dashoffset',(SS_RING*(1-Math.max(0,Math.min(1,rem/Math.max(1,tot))))).toFixed(1));}
  const wrap=document.getElementById('sw-rest-wrap');if(wrap)wrap.classList.toggle('go',rem<=10); // the last ten seconds: get ready
  return true;
}

// ─── Timed sets that run themselves ───
// The seconds planned for this set: what is on the card, else the target (the top of a range).
function holdPlanSecs(ex,s){return parseInt(s.r)||parseInt(ex.target&&(ex.target.rMax||ex.target.r))||0;}
let _holdInt=null;
function holdClock(h){
  const now=Date.now();
  if(now<h.go)return String(Math.ceil((h.go-now)/1000));
  return fmtTimer(Math.max(0,Math.ceil((h.go+h.total*1000-now)/1000)));
}
function holdStart(){
  const wk=S.activeWorkout;const cur=wk&&swipePending(wk);if(!cur)return;
  const ex=wk.exercises[cur.ei];const s=ex.sets[cur.si];const secs=holdPlanSecs(ex,s);if(!(secs>0))return;
  getAudioCtx(); // unlock sound inside the tap
  if(S.restTimer)skipRest(); // starting the set ends the rest
  const now=Date.now();
  _sw.hold={key:cur.ei+'-'+cur.si,ei:cur.ei,si:cur.si,exId:ex.exId,total:secs,go:now+HOLD_LEAD_MS,lastTick:null};
  playCue('tick');_sw.hold.lastTick='lead3';
  renderSwipe(document.getElementById('content'));
}
function holdLoop(){
  if(_holdInt)return;
  _holdInt=setInterval(holdTick,200);
}
function holdStop(){if(_holdInt){clearInterval(_holdInt);_holdInt=null;}_sw.hold=null;}
function holdTick(){
  const h=_sw.hold;const wk=S.activeWorkout;
  if(!h||!wk||!document.getElementById('sw-card')){holdStop();return;} // left the card: the hold is dropped
  const ex=wk.exercises[h.ei];if(!ex||ex.exId!==h.exId){holdStop();renderSwipe(document.getElementById('content'));return;}
  const now=Date.now();const end=h.go+h.total*1000;
  // 3-2-1 before it starts, and the last three seconds of the hold
  let tick=null;
  if(now<h.go)tick='lead'+Math.ceil((h.go-now)/1000);
  else if(now<end&&end-now<=3000)tick='end'+Math.ceil((end-now)/1000);
  else if(now>=h.go&&h.lastTick&&h.lastTick.startsWith('lead'))tick='go';
  if(tick&&tick!==h.lastTick){h.lastTick=tick;playCue(tick==='go'?'sprint':'tick');}
  if(now>=end){holdDone(h.total);return;}
  const t=document.getElementById('sw-hold-t');if(t)t.textContent=holdClock(h);
  const k=document.getElementById('sw-hold-k');if(k)k.textContent=now<h.go?'Get set':'Hold';
  const bar=document.getElementById('sw-hold-bar');if(bar)bar.style.width=(now<h.go?0:Math.min(100,100*(now-h.go)/(h.total*1000)))+'%';
}
// Time up: ring, log the planned seconds, and the card moves on (to the rest card, if that is on).
function holdDone(secs){
  holdStop();playCue('hold');
  _sw.flip=true;swipeLog('ok',secs);
}
// Stop early: what you held is logged; short of the plan it is a missed set, like a left swipe.
function holdFinish(){
  const h=_sw.hold;if(!h)return;
  const held=Math.max(0,Math.round((Date.now()-h.go)/1000));
  holdStop();
  if(held<=0){renderSwipe(document.getElementById('content'));toast('Not started yet, nothing logged');return;}
  const full=held>=h.total;
  swipeLog(full?'ok':'fail',Math.min(held,h.total*3));
  toast(full?`${fmtSecs(held)} logged`:`${fmtSecs(held)} of ${fmtSecs(h.total)}, logged as missed`,full?'green':'');
}
function holdCancel(){holdStop();renderSwipe(document.getElementById('content'));}
