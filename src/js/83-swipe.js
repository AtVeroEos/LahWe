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
// Modes: Simple has steppers for weight and reps, last time and the aim. Super Simple is the name and
// the numbers, nothing else.
const SWIPE_MIN_PX=90;     // how far a drag has to go to count
const SWIPE_FLY_MS=170;
let _sw={busy:false,ask:null,touched:{}};

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
    if(swipeWantsLoad(ex)&&!(parseFloat(s.w)>0))return{act:'block',msg:'Set the weight first (+ or −)'};
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
function swipeRight(){const p=swipePlan('r');if(p.act==='log')swipeLog('ok');else if(p.act==='ask'){_sw.ask={kind:'ok'};renderSwipe(document.getElementById('content'));}}
function swipeLeft(){const p=swipePlan('l');if(p.act==='log')swipeLog('fail');else if(p.act==='ask'){_sw.ask={kind:'fail'};renderSwipe(document.getElementById('content'));}}
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
    const nv=Math.max(0,Math.round((base+dir*loadInc(eq,base))*100)/100);
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
        <div style="font-size:12px;color:var(--muted);line-height:1.5">The set, its weight and reps, last time and your aim. Change the weight or reps right on the card.</div></div>
      <div class="mode-card" onclick="enterSwipe('super')"><div style="font-size:16px;font-weight:700;letter-spacing:-.02em;margin-bottom:4px">Super Simple</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">Just the lift and the target. Nothing to tap but the swipe.</div></div>
    </div>
    <button class="btn btg bfw" onclick="closeOv('swipe-ov')">Cancel</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function enterSwipe(mode){
  const wk=S.activeWorkout;if(!wk)return;
  closeOv('swipe-ov');
  wk._swipe=mode==='super'?'super':'simple';_sw.ask=null;_sw.touched={};_sw.busy=false;
  save();renderSession(document.getElementById('content'));
  const c=document.getElementById('content');if(c)c.scrollTop=0;
}
function exitSwipe(){
  const wk=S.activeWorkout;if(!wk)return;
  delete wk._swipe;_sw.ask=null;save();
  renderSession(document.getElementById('content'));
}

// ─── Drawing ───
function swipeTargetText(ex,s){
  const rph=ex.target&&!s.warmup?(fmtRepTarget(ex.target)||'?'):'?';
  const r=s.r!==''&&s.r!=null?s.r:rph;
  if(ex.timed)return`${r}s`;
  const w=parseFloat(s.w)||0;
  return w>0?`${fmt1(w)} ${S.unit} × ${r}`:`${r} reps`;
}
function swipeStepper(label,val,ph,f){
  return`<div class="sw-f"><div class="sw-fl">${esc(label)}</div><div class="sw-fr">
    <button class="sw-st" onclick="swipeAdj('${f}',-1)" aria-label="Less ${esc(label)}">−</button>
    <b class="sw-v${val===''?' ph':''}">${esc(val===''?ph:val)}</b>
    <button class="sw-st" onclick="swipeAdj('${f}',1)" aria-label="More ${esc(label)}">+</button></div></div>`;
}
function swipeCardHTML(wk,cur,mode){
  const ex=wk.exercises[cur.ei];const s=ex.sets[cur.si];const info=getEx(ex.exId)||{};
  const isW=!!s.warmup;
  const before=ex.sets.slice(0,cur.si+1).filter(x=>!!x.warmup===isW).length;
  const of=ex.sets.filter(x=>!!x.warmup===isW).length;
  const setLbl=isW?`Warm-up ${before} of ${of}`:`Set ${before} of ${of}`;
  const g=ssGroups(wk.exercises).find(x=>cur.ei>=x.start&&cur.ei<=x.end);
  const ssTxt=g?`${ssLabel(g.end-g.start+1)} · ${cur.ei-g.start+1} of ${g.end-g.start+1}`:'';
  const stamps=`<div class="sw-stamp sw-stamp-r">DONE</div><div class="sw-stamp sw-stamp-l">MISSED</div>`;
  const head=`<div class="sw-top"><span class="sw-ss">${esc(ssTxt)}</span><span class="sw-set">${esc(setLbl)}</span></div><div class="sw-name">${esc(info.name||'Exercise')}</div>`;
  if(_sw.ask){
    const kind=_sw.ask.kind;const vals=swipeAskValues(ex,s,kind);
    return`<div class="sw-card" id="sw-card" data-mode="${mode}" role="group" aria-label="Set to log">${head}
      <div class="sw-ask"><div class="sw-ask-t">${kind==='ok'?(ex.timed?'How many seconds?':'How many reps?'):(ex.timed?'How long did you last?':'How many reps did you get?')}</div>
        <div class="sw-chips">${vals.map(v=>`<button class="sw-chip-n${kind==='fail'&&v===0&&!ex.timed?' sw-chip-skip':''}" onclick="swipeAskPick(${v})">${kind==='fail'&&v===0&&!ex.timed?'0 · skip it':v}</button>`).join('')}</div>
        <button class="btn btg bfw" style="margin-top:10px" onclick="swipeAskCancel()">Back</button></div></div>`;
  }
  if(mode==='super'){
    return`<div class="sw-card" id="sw-card" data-mode="super" role="group" aria-label="Set to log">${stamps}${head}
      <div class="sw-big">${esc(swipeTargetText(ex,s))}</div></div>`;
  }
  const rph=ex.target&&!isW?(fmtRepTarget(ex.target)||'–'):'–';
  const a=ex.aim;const lastStr=getLastStr(ex.exId,wk.routineId);
  const chips=[];
  if(lastStr&&lastWorkSets(ex.exId,wk.routineId).length)chips.push(`<button class="sw-chip" onclick="applyLast(${cur.ei})"><small>Last</small> ${esc(lastStr.replace(/^Last: /,''))}</button>`);
  if(a&&!isW)chips.push(`<button class="sw-chip sw-chip-aim" onclick="applyAim(${cur.ei})"><small>${a.by==='coach'?'Coach aim':'Aim'}</small> ${aimIcon(a,11)}${esc(fmtAim(a,ex.timed))}</button>`);
  const fields=ex.timed?swipeStepper('seconds',s.r||'',rph,'r')
    :(swipeWantsLoad(ex)||parseFloat(s.w)>0?swipeStepper(S.unit,s.w?String(parseFloat(s.w)):'','–','w'):'')+swipeStepper('reps',s.r||'',rph,'r');
  return`<div class="sw-card" id="sw-card" data-mode="simple" role="group" aria-label="Set to log">${stamps}${head}
    <div class="sw-fields">${fields}</div>
    ${chips.length?`<div class="sw-chips2">${chips.join('')}</div>`:''}
    ${info.eq==='Bodyweight'&&!ex.timed?`<button class="sw-link" onclick="showPyramid(${cur.ei})">${ICON('arrowup',13)} Pyramid the reps</button>`:''}
    ${ex.note?`<div class="ex-note" style="margin-top:12px">${esc(ex.note)}</div>`:''}</div>`;
}
function renderSwipe(c){
  const wk=S.activeWorkout;if(!wk||!c)return;
  const mode=wk._swipe==='super'?'super':'simple';
  const order=swipeOrder(wk);const cnt=swipeCounts(wk,order);const cur=swipePending(wk,order);
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
  }else{
    const asking=!!_sw.ask;
    body=`<div class="sw-stage" data-mode="${mode}">${swipeCardHTML(wk,cur,mode)}
      ${asking?'':`<div class="sw-acts">
        <button class="sw-btn sw-no" onclick="swipeFling('l')" aria-label="Missed it">${ICON('x',26)}</button>
        ${mode==='simple'?`<button class="sw-mini" onclick="swipeSkip()">Skip</button>`:''}
        <button class="sw-mini" onclick="swipeUndo()" aria-label="Undo the last set"${(wk._swipeUndo||[]).length?'':' disabled'}>↶${mode==='simple'?' Undo':''}</button>
        <button class="sw-btn sw-yes" onclick="swipeFling('r')" aria-label="Done">${ICON('tick',26)}</button>
      </div>`}
      <div class="sw-hint">${mode==='simple'&&!asking?'Swipe right: done · left: missed':''}</div></div>`;
  }
  c.innerHTML=`<div class="fbar">
      <button class="btn btg bsm" onclick="exitSwipe()" aria-label="Back to the list">‹ List</button>
      <div class="fbar-name">${esc(wk.name)}</div>
      <span id="rest-pill" onclick="skipRest()"><span id="rest-pill-t"></span><span class="rp-x">✕</span></span>
      <span id="wt-el" class="wt">${fmtTimer(el)}</span>
      <button class="btn btp bsm" onclick="showFinish()">Finish</button>
    </div>
    <div class="sw-prog" role="progressbar" aria-label="Sets done" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
    ${body}`;
  startWtTimer();
  if(S.restTimer&&!rInt)runRestTicker();else syncRestUI();
  swipeBind();
}

// ─── The gesture ───
function swipeShake(){
  const card=document.getElementById('sw-card');if(!card||!card.animate)return;
  card.animate([{transform:'translateX(0)'},{transform:'translateX(-9px)'},{transform:'translateX(9px)'},{transform:'translateX(0)'}],{duration:220});
}
// A swipe or a tap on the big buttons. Anything that needs a number or a weight is dealt with first,
// before the card flies off, so a refused swipe never loses the card.
function swipeCardReset(){
  const card=document.getElementById('sw-card');if(!card)return;
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
  const card=document.getElementById('sw-card');if(!card||_sw.ask)return;
  let id=null,x0=0,y0=0,dx=0,axis='';
  const reset=()=>{dx=0;card.style.transform='';card.style.removeProperty('--p');card.dataset.dir='';};
  card.addEventListener('pointerdown',e=>{
    if(_sw.busy||e.target.closest('button,input,a'))return;
    id=e.pointerId;x0=e.clientX;y0=e.clientY;dx=0;axis='';
    try{card.setPointerCapture(id);}catch(err){}
    card.classList.add('drag');
  });
  card.addEventListener('pointermove',e=>{
    if(e.pointerId!==id)return;
    const mx=e.clientX-x0,my=e.clientY-y0;
    if(!axis){if(Math.abs(mx)<8&&Math.abs(my)<8)return;axis=Math.abs(mx)>Math.abs(my)?'x':'y';}
    if(axis!=='x')return;
    dx=mx;const p=Math.max(-1,Math.min(1,dx/SWIPE_MIN_PX));
    card.style.transform=`translateX(${dx}px) rotate(${dx/22}deg)`;
    card.style.setProperty('--p',String(Math.abs(p)));card.dataset.dir=p>0.15?'r':p<-0.15?'l':'';
  });
  card.addEventListener('pointerup',e=>{
    if(e.pointerId!==id)return;id=null;card.classList.remove('drag');
    const far=axis==='x'&&Math.abs(dx)>=SWIPE_MIN_PX;const dir=dx>0?'r':'l';
    axis='';
    // Fly on from where the finger let go. If the swipe is refused, the card springs back.
    if(far)swipeFling(dir);else reset();
  });
  card.addEventListener('pointercancel',e=>{if(e.pointerId!==id)return;id=null;axis='';card.classList.remove('drag');reset();});
}
