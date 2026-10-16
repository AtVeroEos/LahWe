// ═══════════════════════════════════════════════════
// UI HELPERS — sheets, toasts, confirm, rest timer, wake lock, error boundary
// ═══════════════════════════════════════════════════
// ─── Sheets ───
// A tap on the dimmed area closes a sheet, with three exceptions that all come from the phone
// keyboard: (1) while a field in the sheet has the keyboard, that tap only puts the keyboard away;
// (2) a press that began inside the sheet never closes it, wherever the finger is lifted;
// (3) a sheet can say it holds something typed (ov._keep) and then only Cancel, the handle or its
// own button closes it. Without these, reaching for a button under the keyboard threw away
// what had just been typed.
// A field that brings the keyboard up (not a tick box, a slider, a date wheel or a menu).
function isTyping(el){
  if(!el)return false;const t=String(el.tagName||'');
  if(t==='TEXTAREA')return true;
  return t==='INPUT'&&/^(text|search|number|tel|url|email|password|)$/.test(String(el.type||''));
}
function makeOv(id){
  if(id){const old=document.getElementById(id);if(old)old.remove();}
  const ov=document.createElement('div');ov.className='ov';if(id)ov.id=id;
  let pressOut=false;
  const down=e=>{pressOut=e.target===ov;};
  ov.addEventListener(typeof window!=='undefined'&&window.PointerEvent?'pointerdown':'touchstart',down,{passive:true});
  if(!(typeof window!=='undefined'&&window.PointerEvent))ov.addEventListener('mousedown',down);
  ov.addEventListener('focusout',()=>{ov._blurAt=Date.now();});
  sheetSwipe(ov);
  ov.addEventListener('click',e=>{
    if(e.target!==ov)return;
    const out=pressOut;pressOut=false;
    if(backdropCloses(ov,out))dismissOv(ov);
  });
  return ov;
}
function backdropCloses(ov,pressedOutside){
  const a=document.activeElement;
  if(isTyping(a)&&ov.contains(a)){try{a.blur();}catch(e){}return false;}
  if(Date.now()-(ov._blurAt||0)<400)return false; // the same tap, a moment after it took the keyboard away
  if(!pressedOutside)return false;
  let keep=false;try{keep=!!(ov._keep&&ov._keep());}catch(e){}
  if(keep){
    const m=ov.querySelector('.modal');
    if(m){m.classList.remove('nudge');void m.offsetWidth;m.classList.add('nudge');}
    return false;
  }
  return true;
}
function dismissOv(ov){
  if(!ov)return;
  // However a sheet is closed (swiped, tapped outside, or by the app), its own clean-up runs once.
  if(typeof ov._onDismiss==='function'){const f=ov._onDismiss;ov._onDismiss=null;try{f();}catch(e){logError(e,'dismiss '+ov.id);}}
  if(ov.id==='scan-ov'&&typeof teardownScanner==='function')teardownScanner();
  const modal=ov.querySelector('.modal');
  if(modal){modal.style.transition='transform .22s cubic-bezier(.22,.61,.36,1)';modal.style.transform='translateY(100%)';}
  ov.style.pointerEvents='none';
  setTimeout(()=>ov.remove(),220);
}
function closeOv(id){dismissOv(document.getElementById(id));}
// Swipe a sheet down to close it, from anywhere on it, not only the grabber. The drag is taken
// only when it starts with everything under the finger scrolled to the top and heads downward;
// otherwise the touch is left alone, so lists inside a sheet still scroll, rows of chips still
// slide sideways, and sliders and reorder handles keep their own drags.
function sheetSwipeAllowed(target,modal){
  if(!target||!modal||!modal.contains(target))return false;
  if(target.closest&&target.closest('input[type=range],select,textarea,video,canvas,.be-grip,.drag-handle,[data-drag],[data-noswipe]'))return false;
  if(target===document.activeElement&&isTyping(target))return false; // moving the cursor in a field
  for(let n=target;n&&n!==modal.parentNode;n=n.parentNode){if(n.scrollTop>0)return false;if(n===modal)break;}
  return true;
}
function sheetSwipe(ov){
  let y0=0,x0=0,t0=0,ok=false,drag=false,modal=null;
  const SLOP=6;
  ov.addEventListener('touchstart',e=>{
    ok=false;drag=false;
    if(e.touches.length!==1)return;
    modal=ov.querySelector('.modal');
    const t=e.touches[0];y0=t.clientY;x0=t.clientX;t0=Date.now();
    ok=sheetSwipeAllowed(e.target,modal);
  },{passive:true});
  ov.addEventListener('touchmove',e=>{
    if(!ok||!modal||e.touches.length!==1)return;
    const t=e.touches[0],dy=t.clientY-y0,dx=t.clientX-x0;
    if(!drag){
      if(dy<-SLOP||Math.abs(dx)>Math.max(SLOP,Math.abs(dy))){ok=false;return;} // up, or sideways: not ours
      if(dy<SLOP)return;
      if(e.cancelable===false){ok=false;return;} // the browser already took it as a scroll
      drag=true;modal.style.transition='none';
    }
    if(e.cancelable!==false)e.preventDefault();
    modal.style.transform=`translateY(${Math.max(0,dy-SLOP)}px)`;
  },{passive:false});
  const end=e=>{
    if(!drag){ok=false;return;}
    drag=false;ok=false;
    const t=e.changedTouches&&e.changedTouches[0];const dy=t?t.clientY-y0:0,dt=Math.max(1,Date.now()-t0);
    if(e.type==='touchend'&&(dy>100||(dy>36&&dy/dt>0.5)))dismissOv(ov);
    else{modal.style.transition='transform .22s cubic-bezier(.22,.61,.36,1)';modal.style.transform='';}
  };
  ov.addEventListener('touchend',end);ov.addEventListener('touchcancel',end);
}
function attachSwipeDown(ov){
  const handle=ov.querySelector('.mh');const modal=ov.querySelector('.modal');
  if(!handle||!modal)return;
  let startY=0,startT=0,dragging=false;
  handle.style.touchAction='none';
  // Mouse and pen only: a finger on the grabber is handled with every other touch on the sheet (sheetSwipe).
  handle.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch')return;
    startY=e.clientY;startT=Date.now();dragging=true;
    modal.style.transition='none';
    try{handle.setPointerCapture(e.pointerId);}catch(ex){}
  });
  handle.addEventListener('pointermove',e=>{
    if(!dragging)return;const dy=e.clientY-startY;
    if(dy>0)modal.style.transform=`translateY(${dy}px)`;
  });
  handle.addEventListener('pointerup',e=>{
    if(!dragging)return;dragging=false;
    const dy=e.clientY-startY,dt=Math.max(1,Date.now()-startT);
    if(dy>80||dy/dt>0.5)dismissOv(ov);
    else{modal.style.transition='transform .22s cubic-bezier(.22,.61,.36,1)';modal.style.transform='';}
  });
  handle.addEventListener('pointercancel',()=>{
    dragging=false;modal.style.transition='transform .22s cubic-bezier(.22,.61,.36,1)';modal.style.transform='';
  });
}
// ─── On-screen keyboard ───
// A phone does not resize the page for its keyboard: it slides the whole page up until the field
// being typed in shows. A short sheet then has its buttons under the keyboard, and the page can
// stay slid after the keyboard goes, so a tap lands somewhere other than under the finger.
// Instead, an open sheet is lifted to sit on top of the keyboard and the page is put back.
// Outside a sheet the phone is left to do its own thing (the set rows rely on it).
function kbHeight(){
  const vv=window.visualViewport;if(!vv)return 0;
  if(Math.abs((vv.scale||1)-1)>0.01)return 0; // pinch-zoomed: the smaller viewport is not a keyboard
  const h=Math.round(window.innerHeight-vv.height);
  return h>60?h:0;
}
let _kbT=null;
function kbSync(){
  const root=document.documentElement;const ovs=document.querySelectorAll('.ov');
  const ov=ovs.length?ovs[ovs.length-1]:null;
  const kb=ov?kbHeight():0;
  if(kb){root.style.setProperty('--kb',kb+'px');root.classList.add('kb');}
  else{root.style.removeProperty('--kb');root.classList.remove('kb');}
  if(kb){
    // Keep the field being typed in inside the (now shorter) sheet.
    const a=document.activeElement;const m=a&&a.closest?a.closest('.modal'):null;
    if(m&&isTyping(a)){
      const r=a.getBoundingClientRect(),mr=m.getBoundingClientRect();
      if(r.bottom>mr.bottom-14)m.scrollTop+=r.bottom-mr.bottom+14;
      else if(r.top<mr.top+14)m.scrollTop-=mr.top+14-r.top;
    }
  }
  // The page itself never scrolls in this app, so any offset is the keyboard's doing.
  if(kb||!kbHeight()){
    const vv=window.visualViewport;
    if((window.scrollY||0)>0||(vv&&vv.offsetTop>0)){try{window.scrollTo(0,0);}catch(e){}}
  }
}
// Viewport events arrive in bursts while the keyboard moves; settle once at the end as well.
function kbSoon(ms){if(_kbT)clearTimeout(_kbT);_kbT=setTimeout(()=>{_kbT=null;try{kbSync();}catch(e){}},ms||80);}
// toast(msg[, color[, {action,onAction,ms}]]) — msg is plain text. With an action it stays up
// longer and shows a button (used for Undo).
let _toastTimer=null;
function toast(msg,color,opts){
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  if(_toastTimer){clearTimeout(_toastTimer);_toastTimer=null;}
  const el=document.createElement('div');el.className='toast';
  if(color==='gold')el.style.cssText='border-color:var(--gold);color:var(--gold)';
  if(color==='green')el.style.cssText='border-color:var(--green);color:var(--green)';
  if(color==='red')el.style.cssText='border-color:var(--red);color:var(--red)';
  const span=document.createElement('span');span.textContent=msg;el.appendChild(span);
  let ms=2300;
  // opts.action/onAction is one button; opts.actions [{label,fn}] is several.
  const acts=opts&&(opts.actions||(opts.action?[{label:opts.action,fn:opts.onAction}]:null));
  if(acts&&acts.length){
    el.classList.add('toast-act');
    acts.forEach(a=>{
      const b=document.createElement('button');b.className='toast-btn';b.textContent=a.label;
      b.onclick=()=>{el.remove();try{a.fn&&a.fn();}catch(e){logError(e);}};
      el.appendChild(b);
    });
    ms=opts.ms||6000;
  }else if(opts&&opts.ms)ms=opts.ms;
  el.style.animation=`tin .16s ease,tout .2s ease ${(ms-300)/1000}s both`;
  document.body.appendChild(el);
  _toastTimer=setTimeout(()=>el.remove(),ms);
}
// customConfirm(msgHtml,label,cb[,opts]) — msgHtml is trusted markup written in this codebase;
// escape any user text before passing it in. opts: {title, safe:true for a non-destructive action}.
let _cb=null;
function customConfirm(msg,label,cb,opts){
  opts=opts||{};
  _cb=cb;const ov=makeOv('confirm-ov');
  ov.innerHTML=`<div class="modal" style="max-height:80vh"><div class="mh"></div>
    <div style="font-size:15px;font-weight:600;margin-bottom:6px;letter-spacing:-.01em">${opts.title||'Are you sure?'}</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:18px;line-height:1.5">${msg}</div>
    <button class="btn ${opts.safe?'btp':'btd'} bfw" onclick="doConfirm()">${label||'Confirm'}</button>
    <button class="btn btg bfw" style="margin-top:8px" onclick="closeOv('confirm-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function doConfirm(){closeOv('confirm-ov');const f=_cb;_cb=null;if(f)f();}

// ─── Rest timer ───
// Driven by an END TIMESTAMP (S.restTimer), not by counting ticks. iOS freezes timers when the
// phone locks or the app is backgrounded; on return the display is recomputed from the clock,
// so the countdown is right and a rest that ended while away is reported as finished.
let rInt=null;
function restRemaining(){const t=S.restTimer;return t?Math.ceil((t.end-Date.now())/1000):0;}
function startRest(dur){
  dur=parseInt(dur);if(!(dur>0))dur=S.restDur||90;
  S.restTimer={end:Date.now()+dur*1000,total:dur};
  if(S.restSound)getAudioCtx(); // unlock audio inside the tap that started the rest
  save();runRestTicker();
}
function runRestTicker(){
  if(rInt)clearInterval(rInt);rInt=null;
  if(!S.restTimer){syncRestUI();return;}
  rInt=setInterval(tickRest,250);
  tickRest();
}
function tickRest(){
  const t=S.restTimer;
  if(!t){if(rInt){clearInterval(rInt);rInt=null;}syncRestUI();return;}
  const rem=restRemaining();
  if(rem<=0){
    const late=Math.round((Date.now()-t.end)/1000);
    S.restTimer=null;save();
    if(rInt){clearInterval(rInt);rInt=null;}
    syncRestUI();
    restDoneAlert(late);
    return;
  }
  syncRestUI();
}
function restDoneAlert(lateSec){
  if(lateSec>=5){toast(`Rest finished ${fmtMS(lateSec)} ago`,'gold',{ms:3500});return;}
  if(navigator.vibrate)try{navigator.vibrate([200,100,200]);}catch(e){}
  if(S.restSound)playRestBeep();
  toast('Rest done — next set','green');
}
function playRestBeep(){playCue('rest');} // the sound and volume chosen in Settings (88-cues.js)
// How a running rest shows: the small pill in the header (default), a floating bar over the screen,
// or a full-screen countdown. Full screen can be put away for the rest that is running; it then
// falls back to the pill so there is still something to see.
let _restHid=0;
function restEffStyle(){
  const st=S.restStyle==='float'||S.restStyle==='full'?S.restStyle:'pill';
  return st==='full'&&S.restTimer&&_restHid===S.restTimer.end?'pill':st;
}
function syncRestUI(){
  const pill=document.getElementById('rest-pill'),t=document.getElementById('rest-pill-t');
  const rem=restRemaining();const active=!!(S.restTimer&&rem>0);const st=restEffStyle();
  // The Simple swipe card can be the rest display itself (83-swipe.js).
  if(typeof swipeRestTick==='function'&&document.getElementById('sw-rest')){
    if(pill)pill.classList.remove('on');syncRestOverlay(false,rem,st);
    if(swipeRestTick(active,rem))return;
  }
  if(pill){
    if(active&&st==='pill'){pill.classList.add('on');if(t)t.textContent='REST '+fmtTimer(rem);}
    else pill.classList.remove('on');
  }
  syncRestOverlay(active,rem,st);
}
function syncRestOverlay(active,rem,st){
  let ov=document.getElementById('rest-ov');
  if(!active||st==='pill'){if(ov)ov.remove();return;}
  if(ov&&ov.dataset.st!==st){ov.remove();ov=null;}
  if(!ov){
    ov=document.createElement('div');ov.id='rest-ov';ov.dataset.st=st;ov.className='rest-'+st;
    ov.setAttribute('role','timer');ov.setAttribute('aria-label','Rest');
    const btns=`<button class="rst-b" onclick="adjustRest(-15)" aria-label="15 seconds less">−15</button><button class="rst-b" onclick="adjustRest(15)" aria-label="15 seconds more">+15</button><button class="rst-b rst-skip" onclick="skipRest()">Skip</button>`;
    ov.innerHTML=st==='full'
      ?`<div class="rst-lbl">Rest</div><div class="rst-t"></div><div class="rst-bar"><i></i></div><div class="rst-row">${btns}</div><button class="rst-hide" onclick="hideRestFull()">Hide, keep it in the header</button>`
      :`<span class="rst-lbl">Rest</span><span class="rst-t"></span>${btns}<div class="rst-bar"><i></i></div>`;
    document.body.appendChild(ov);
  }
  // Sits just under the top bar when there is one, so it never covers the set buttons at the bottom.
  if(st==='float'){const fb=document.querySelector('.fbar');ov.style.top=fb&&fb.getBoundingClientRect?Math.round(fb.getBoundingClientRect().bottom+8)+'px':'';}
  const t=ov.querySelector('.rst-t');if(t)t.textContent=fmtTimer(rem);
  const bar=ov.querySelector('.rst-bar i');if(bar){const tot=(S.restTimer&&S.restTimer.total)||rem;bar.style.width=Math.max(0,Math.min(100,100*rem/Math.max(1,tot)))+'%';}
}
function hideRestFull(){if(S.restTimer)_restHid=S.restTimer.end;syncRestUI();}
// Longer or shorter for this rest only; the exercise's own rest time is not touched.
function adjustRest(d){
  const t=S.restTimer;if(!t)return;
  t.end+=d*1000;t.total=Math.max((t.total||0)+d,restRemaining(),1);
  if(restRemaining()<=0){skipRest();return;}
  save();runRestTicker();
}
function setRestStyle(v){
  S.restStyle=v==='float'||v==='full'?v:'pill';save();syncRestUI();refreshSettings();
}
function skipRest(){
  if(rInt)clearInterval(rInt);rInt=null;
  if(S.restTimer){S.restTimer=null;save();}
  syncRestUI();
}
// Per-exercise rest duration, falling back to the global default.
function exRestFor(exId){
  const wk=S.activeWorkout;
  if(wk){const e=wk.exercises.find(x=>x.exId===exId);if(e&&e.rest!=null)return e.rest;}
  const mine=S.exRest?S.exRest[exId]:null;
  return mine!=null?mine:(S.restDur||90);
}
const REST_OPTS=[30,45,60,75,90,120,150,180,210,240];
function showRestPicker(exId){
  const info=getEx(exId);const wk=S.activeWorkout;
  const sessEx=wk?wk.exercises.find(x=>x.exId===exId):null;
  const cur=(sessEx&&sessEx.rest!=null)?sessEx.rest:(S.exRest&&S.exRest[exId]!=null?S.exRest[exId]:null);const def=S.restDur||90;
  const ov=makeOv('rest-pick-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Rest Timer</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5">${esc(info?.name||'Exercise')} — how long to rest after each set. Remembered for this exercise.</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
      ${REST_OPTS.map(v=>`<button class="btn ${cur===v?'btp':'bts'}" style="padding:12px 0;font-size:13px" onclick="setExRest(${jsq(exId)},${v})">${v>=60?fmtMS(v):`${v}s`}</button>`).join('')}
    </div>
    <button class="btn ${cur===null?'btp':'btg'} bfw" onclick="setExRest(${jsq(exId)},null)">Use default (${def}s)</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function setExRest(exId,v){
  const wk=S.activeWorkout;
  if(wk)wk.exercises.forEach(x=>{if(x.exId===exId)x.rest=v;});
  // The routine's own rest wins when a session starts, so the choice is written there too.
  const rt=wk&&wk.routineId?S.routines.find(r=>r.id===wk.routineId):null;
  if(rt&&v!==null)rt.exercises.forEach(e=>{if(e.exId===exId)e.rest=v;});
  if(!S.exRest)S.exRest={};
  if(v===null)delete S.exRest[exId];else S.exRest[exId]=v;
  save();closeOv('rest-pick-ov');
  if(S.activeWorkout)renderSession(document.getElementById('content'));
}
let wtInt=null;
function startWtTimer(){
  if(wtInt)clearInterval(wtInt);
  wtInt=setInterval(()=>{const el=document.getElementById('wt-el');if(el&&S.activeWorkout)el.textContent=fmtTimer(Math.floor((Date.now()-S.activeWorkout.started)/1000));},1000);
}

// ─── Screen wake lock ───
// Keeps the display on while a session is running so the rest timer stays visible and audible.
// Not available everywhere; failures are silent and the timer still self-corrects on return.
let _wakeLock=null;
function sessionActive(){return !!(S.activeWorkout||S.activeCardDeck||S.activeSprintTimer);}
async function syncWakeLock(){
  const want=!!S.keepAwake&&sessionActive()&&document.visibilityState==='visible';
  try{
    if(want&&!_wakeLock&&navigator.wakeLock){
      _wakeLock=await navigator.wakeLock.request('screen');
      _wakeLock.addEventListener('release',()=>{_wakeLock=null;});
    }else if(!want&&_wakeLock){const w=_wakeLock;_wakeLock=null;await w.release();}
  }catch(e){_wakeLock=null;}
}

// ─── Save-failure banner ───
function showSaveWarning(on){
  let el=document.getElementById('save-warn');
  if(!on){if(el)el.remove();return;}
  if(el)return;
  el=document.createElement('div');el.id='save-warn';
  el.innerHTML=`<div style="flex:1"><b>Changes aren't being saved.</b> Storage is full or blocked on this device. Export a backup now so nothing is lost.</div><button class="btn bsm" style="background:#fff;color:var(--red);flex-shrink:0" onclick="exportData()">Export</button>`;
  document.body.appendChild(el);
}

// ─── Error boundary ───
// render() clears the screen before drawing, so an exception used to leave a blank page.
// Any render failure now lands on a recovery screen that can still export the data.
const _errLog=[];
let _lastErrToast=0;
function errText(e){return e&&e.message?e.message:String(e);}
function logError(e,where){
  try{console.error('[Lah We]',where||'',e);}catch(x){}
  _errLog.push({t:Date.now(),where:where||'',msg:errText(e),stack:String((e&&e.stack)||'').slice(0,1500)});
  if(_errLog.length>20)_errLog.shift();
  if(Date.now()-_lastErrToast>4000){
    _lastErrToast=Date.now();
    try{toast('Something went wrong: '+errText(e).slice(0,80),'red',{ms:4500});}catch(x){}
  }
}
function renderCrash(c,e,where){
  logError(e,where||'render');
  const nav=document.getElementById('nav');if(nav)nav.style.display='flex';
  c.innerHTML=`<div style="padding:40px 20px;text-align:center">
    <div style="color:var(--red);margin-bottom:12px">${ICON('alert',38)}</div>
    <div class="etit">This screen hit an error</div>
    <div style="font-size:12px;color:var(--muted);line-height:1.6;margin:6px 0 4px">Your data is still stored on this device. Export a backup first, then reload.</div>
    <div class="mono" style="font-size:12px;color:var(--muted2);background:var(--bg2);border-radius:8px;padding:8px 10px;margin:12px 0 18px;text-align:left;word-break:break-word">${esc(errText(e)).slice(0,400)}</div>
    <button class="btn btp bfw" style="margin-bottom:9px" onclick="exportData()">Export backup</button>
    <button class="btn bts bfw" style="margin-bottom:9px" onclick="location.reload()">Reload app</button>
    <button class="btn btg bfw" onclick="go('workout')">Go to home</button>
  </div>`;
}
// Stored data exists but can't be parsed. Nothing is overwritten until the user chooses.
function renderCorrupt(c){
  const nav=document.getElementById('nav');if(nav)nav.style.display='none';
  c.innerHTML=`<div style="padding:40px 20px;text-align:center">
    <div style="color:var(--red);margin-bottom:12px">${ICON('alert',38)}</div>
    <div class="etit">Saved data couldn't be read</div>
    <div style="font-size:12px;color:var(--muted);line-height:1.6;margin:6px 0 18px">The data stored on this device is damaged. It has NOT been deleted. Download it so it can be repaired, or restore from one of your backups.</div>
    <button class="btn btp bfw" style="margin-bottom:9px" onclick="downloadText('lahwe-unreadable-'+today()+'.txt',Store.corrupt||'')">Download the damaged data</button>
    <button class="btn bts bfw" style="margin-bottom:9px" onclick="importData()">Restore from a backup file</button>
    <button class="btn btg bfw" onclick="startFreshFromCorrupt()">Start fresh (keeps a copy of the old data)</button>
  </div>`;
}
function startFreshFromCorrupt(){
  customConfirm('The damaged data will be kept under a separate key on this device, and the app will start empty.','Start fresh',()=>{
    Store.lsSet(STORE_KEY+'_corrupt_'+Date.now(),Store.corrupt||'');
    replaceState(null);
    document.getElementById('nav').style.display='none';
    go('workout');
  });
}
if(typeof window!=='undefined'&&window.addEventListener){
  // "ResizeObserver loop…" is a harmless browser notice (Chart.js triggers it), not an app failure.
  window.addEventListener('error',ev=>{if(/ResizeObserver/.test(String(ev.message||'')))return;logError(ev.error||ev.message,'uncaught');});
  window.addEventListener('unhandledrejection',ev=>logError(ev.reason,'promise'));
}

// ─── Logo ───
// An L that doubles as chart axes, a W whose last stroke climbs off the chart to a live dot in a ring.
// The letters take the text colour; the dot and ring take the chosen accent (--navy), so every theme and
// both light and dark carry it. Drawn from the supplied artwork: the mark is straight lines and circles,
// the "lah we" wordmark is traced from it (no font to download, so it looks the same offline).
const LW_W='M43 141H76L119 238L156 158L195 240L266 66H299L213 285H179L156 239L134 285H103Z';
const LW_WORD='M827.2 289C829.2 288.9 830.7 288.8 831.7 288.6C832.5 288.5 833.9 288.3 834.8 288.1C835.7 288 836.8 287.8 837.3 287.6C837.7 287.5 838.7 287.2 839.5 287.1C840.2 286.9 841.1 286.6 841.4 286.5C841.6 286.4 842.1 286.2 842.5 286.1C843.9 285.8 848.8 283.5 850.8 282.3C853.8 280.5 856.8 278.2 859.3 275.6C860.9 273.9 861.1 273.6 860.9 273C860.9 272.7 847.4 259.1 846.4 258.4C845.6 257.8 845.4 257.8 844.1 259.1C839.9 263 835.9 265.1 830.1 266.3C818.9 268.5 808.9 264.7 803.9 256.4C802.7 254.4 801.8 252.2 801.9 251.7C802.1 251 800.3 251.1 834.3 251C866 250.9 866 250.9 866.3 250.7C867.4 249.9 868.3 240.6 867.9 235.1C867.7 233.2 866.8 227.7 866.6 227C866.4 226.7 866.2 226 866.1 225.4C866 224.8 865.7 224.1 865.6 223.7C865.5 223.3 865.2 222.6 865 222.1C860.9 210.3 850 199.8 837.6 196.1C835.1 195.3 834.2 195.1 832.9 194.9C832.1 194.7 830.8 194.5 830 194.4C826.2 193.7 817.6 193.7 813.6 194.4C812.7 194.6 811.3 194.9 810.6 195C809.8 195.1 808.9 195.3 808.6 195.4C808.3 195.5 807.5 195.8 806.8 196C805.2 196.4 802.9 197.2 802.2 197.6C801.9 197.7 801.5 197.9 801.4 197.9C800.8 198.1 797.2 199.9 795.9 200.7C789.1 204.8 784.2 209.7 779.7 216.8C777.9 219.7 775.7 224.6 774.9 227.8C774.8 228.5 774.5 229.4 774.4 229.9C774.2 230.3 774 231.4 773.9 232.4C773.7 233.3 773.5 234.6 773.4 235.3C773 238.2 773 244.5 773.4 247.5C773.5 248.2 773.7 249.5 773.9 250.4C774.5 254.6 776.5 260.5 778.6 264.2C780.7 267.8 781.9 269.6 784.4 272.6C787.9 276.6 793 280.6 798.2 283.2C800.4 284.4 803.6 285.7 804.8 286.1C805.2 286.2 805.9 286.4 806.3 286.6C806.7 286.7 807.4 286.9 807.8 287C808.2 287.1 809 287.3 809.6 287.5C810.5 287.7 814.8 288.5 817.2 288.8C817.8 288.9 821.2 289.1 823.4 289.1C823.9 289.1 825.5 289.1 827.2 289ZM418.2 288.9C419.5 288.8 421 288.6 421.8 288.5C422.5 288.4 423.6 288.2 424.3 288.1C425 288 425.8 287.8 426.1 287.7C426.4 287.6 427.3 287.3 428 287.1C428.8 286.9 429.7 286.6 430 286.5C430.3 286.3 430.8 286.1 431.1 286C432.9 285.4 437 283 439.3 281.2C440.8 279.9 440.9 280.1 441 283.7C441.1 286.5 441.1 286.5 441.4 286.8C441.9 287.2 468.4 287.1 468.8 286.7C469.3 286.2 469.3 196.8 468.8 196.3C468.3 195.7 441.8 195.7 441.3 196.3C441 196.6 441 196.7 441 199.2C441 202.9 440.8 203.2 439.3 201.9C437.3 200.3 431.9 197 431.1 197C431 197 430.5 196.8 429.9 196.5C429.3 196.3 428.5 196 428.1 195.9C427.7 195.8 427 195.6 426.6 195.4C426.1 195.3 425 195 424.2 194.9C423.4 194.7 422.3 194.5 421.7 194.4C419.5 194 413.3 193.9 410.5 194.3C406.7 194.9 404.4 195.4 401.9 196.3C392.3 199.5 384.1 206.4 378.8 215.6C378 217 376.2 220.5 376.1 221C376 221.2 375.8 221.8 375.6 222.3C375 223.7 374.1 226.6 373.6 228.8C373.2 230.6 372.9 232.1 372.4 236.2C372.2 238.5 372.2 244.4 372.4 246.6C372.5 247.5 372.7 249 372.8 249.9C373 251.8 374.1 256.4 374.6 257.8C374.7 258.2 375 259 375.2 259.5C377.6 266.8 383.1 274.7 389.2 279.7C392.4 282.2 397.4 285.2 400.1 286.1C400.5 286.2 401.1 286.4 401.4 286.6C401.8 286.7 402.4 286.9 402.8 287C403.1 287.1 404 287.3 404.6 287.5C405.3 287.7 406.5 288 407.4 288.1C408.2 288.3 409.4 288.5 410 288.6C411.1 288.8 413.5 288.9 415.3 289C415.7 289 417 288.9 418.2 288.9ZM357.2 286.9C357.3 286.8 357.5 286.6 357.6 286.5C357.8 286.2 357.8 151.8 357.6 151.5C357.2 151 357.3 151 343.3 151C329.7 151 329.7 151 329.3 151.3C328.8 151.7 328.8 286.3 329.3 286.7C329.7 287 329.7 287 343.3 287C353.4 287 357 287 357.2 286.9ZM517.7 286.7C518.1 286.4 518.1 286.4 518.1 259.3C518.2 232.2 518.2 232.2 518.7 230.4C521.3 221.9 528.9 217.7 538.2 219.8C543.5 221 548.3 226.1 549 231.2C549.1 231.8 549.2 232.5 549.2 232.7C549.3 232.9 549.3 245.1 549.4 259.7C549.4 286.4 549.4 286.4 549.7 286.7C550.2 287.1 577.3 287.2 577.8 286.7C578.1 286.4 578.1 286.4 578.1 256.7C578.1 240.4 578.1 226.2 578 225.1C577.9 223 577 218.1 576.5 217C576.4 216.7 576.2 216 576 215.5C575.9 215 575.7 214.4 575.6 214.3C575.5 214.2 575.3 213.7 575.1 213.3C574.5 211.7 572.5 208.5 571.2 206.8C566.6 201 560.8 197.3 553.1 195.2C548.5 194 540.3 193.7 536.3 194.5C535.7 194.6 534.5 194.8 533.8 194.9C533 195.1 532 195.3 531.6 195.4C531.1 195.5 530.4 195.8 529.8 195.9C526.9 196.8 523.2 198.7 520.1 201C518.7 202 518.8 202 518.4 201.7C518.1 201.4 518.1 201.4 518.1 176.5C518.1 151.6 518.1 151.6 517.7 151.3C517.1 150.8 490 150.9 489.6 151.4C489.2 151.8 489.2 151.8 489.2 219C489.2 280.5 489.3 286.2 489.5 286.5C489.8 287 489.9 287 503.8 287C517.4 287 517.4 287 517.7 286.7ZM677.6 286.7C677.9 286.4 678.5 284.8 679.1 283C679.2 282.5 679.6 281.2 680 280.2C680.4 279.3 680.8 277.9 681 277.3C681.2 276.7 681.4 276 681.6 275.7C681.7 275.4 681.9 274.8 682.1 274.2C682.2 273.7 682.6 272.5 683 271.5C683.4 270.5 683.8 269.2 684 268.6C684.4 267.5 684.8 266.1 686.1 262.4C686.5 261.4 686.9 260.1 687.1 259.6C687.2 259.1 687.6 257.9 688 256.9C688.4 255.9 688.8 254.6 689 253.9C689.2 253.3 689.4 252.6 689.6 252.3C689.7 252 689.9 251.4 690.1 250.9C690.2 250.4 690.6 249.1 691 248.1C691.4 247.1 691.8 245.9 691.9 245.3C692.1 244.8 692.4 244 692.6 243.6C692.7 243.1 693 242.4 693.2 241.8C694.1 238.9 695.1 236.3 695.3 236C695.7 235.6 696.3 236.7 696.9 238.8C697.1 239.3 697.6 240.7 697.9 241.8C698.3 242.9 698.8 244.2 698.9 244.6C699 245.1 699.3 245.9 699.5 246.4C699.9 247.5 700.3 248.7 700.9 250.6C701.5 252.6 702.2 254.4 702.5 255.2C702.6 255.6 702.9 256.4 703 256.9C703.4 258 703.8 259.2 704.4 261.1C704.9 262.4 705.3 263.7 705.9 265.4C706.1 266.1 706.6 267.5 706.9 268.6C707.3 269.7 707.8 271.1 708 271.7C708.4 273.1 708.9 274.5 709.4 276C709.7 276.7 710 277.5 710.1 277.9C710.2 278.3 710.4 278.8 710.4 279C710.5 279.2 710.8 279.8 710.9 280.4C712 283.9 712.9 286.4 713.3 286.7C713.8 287.1 736.2 287.1 736.6 286.7C736.9 286.4 737.2 285.5 738.1 283.1C738.3 282.4 738.7 281.1 739.1 280.2C739.4 279.3 739.8 278.1 740 277.4C740.2 276.8 740.5 276 740.6 275.7C740.8 275.4 741 274.8 741.1 274.4C741.2 274 741.4 273.4 741.5 273.1C741.7 272.7 741.9 272 742.1 271.5C742.2 271 742.6 269.7 743 268.8C743.4 267.8 743.8 266.4 744.1 265.7C744.6 264.2 745.3 262.1 746.1 259.9C746.4 259 746.8 257.8 747 257.2C747.2 256.6 747.5 255.8 747.6 255.5C747.8 255.1 748 254.5 748.1 254.1C748.2 253.7 748.4 253.1 748.5 252.8C748.7 252.5 748.9 251.8 749.1 251.2C749.2 250.7 749.6 249.5 750 248.5C750.4 247.5 750.8 246.1 751.1 245.4C751.6 243.9 752.3 241.9 753.1 239.7C753.4 238.8 753.8 237.6 754 236.9C754.2 236.3 754.5 235.5 754.6 235.2C754.8 234.9 755 234.3 755.1 233.9C755.2 233.5 755.4 232.9 755.5 232.6C755.7 232.2 755.9 231.5 756.1 231C756.2 230.5 756.6 229.2 757 228.2C757.4 227.3 757.8 225.9 758.1 225.2C758.6 223.7 759.3 221.6 760.1 219.4C760.4 218.5 760.8 217.3 761 216.7C761.2 216.1 761.5 215.3 761.6 215C761.8 214.6 762 214 762.1 213.6C762.2 213.2 762.4 212.6 762.5 212.3C762.7 212 762.9 211.3 763.1 210.8C763.2 210.2 763.6 209 764 208C764.4 207 764.8 205.6 765.1 204.9C765.6 203.4 766.3 201.4 767.1 199.2C768 196.6 768 196.7 767.7 196.3C767.4 195.9 767.5 195.9 753.5 195.9C742.3 195.9 740.5 196 740.3 196.1C739.9 196.4 739.4 197.4 739 199.1C738.8 199.9 738.6 200.6 738.5 200.7C738.4 200.9 738.2 201.7 737.9 202.5C737.3 204.8 736.9 206.2 736.5 207.3C736.4 207.9 736.1 208.9 735.9 209.6C735.4 211.2 735 212.7 734.4 214.4C734.2 215.2 733.8 216.6 733.5 217.6C733.2 218.5 732.8 220 732.5 220.9C732.2 221.7 732 222.5 732 222.6C732 222.7 731.8 223.4 731.5 224.3C731.2 225.1 731 225.8 731 226C731 226.1 730.8 226.8 730.5 227.6C730.2 228.5 730 229.2 730 229.3C730 229.4 729.8 230.1 729.6 230.8C729.3 231.5 729 232.5 728.9 232.9C728.8 233.4 728.6 234 728.5 234.2C728.4 234.5 728.2 235.4 727.9 236.2C727.3 238.5 726.9 239.8 726.5 240.9C726.4 241.5 726.1 242.5 725.9 243.2C725.4 244.9 724.8 246.8 724.7 247C724.4 247.5 723.7 246.7 723.2 245.3C723.1 244.8 722.9 244.1 722.7 243.7C722.6 243.3 722.3 242.3 722.1 241.6C721.6 240.3 721.2 239 720.7 237.6C720.6 237.1 720.3 236.3 720.1 235.7C719.9 235 719.6 234.1 719.5 233.7C719.3 233.2 718.9 232 718.6 230.9C718.2 229.9 717.9 228.8 717.7 228.4C717.6 228 717.3 227.1 717.1 226.4C716.4 224.4 715.9 222.7 715.5 221.6C715.3 221.1 715.1 220.5 715.1 220.2C715 220 714.8 219.3 714.6 218.7C714.3 218.1 713.9 216.7 713.6 215.7C713.2 214.7 712.8 213.3 712.6 212.6C712.3 212 711.9 210.5 711.5 209.4C711.1 208.2 710.7 207 710.6 206.7C710.5 206.3 710.2 205.5 710 204.8C709.8 204.2 709.5 203.2 709.3 202.7C708.6 200.6 708.5 200.2 708.1 198.9C707.6 197.2 707.2 196.4 706.8 196.1C706.4 195.9 686.2 195.7 684.8 195.9C684 196 683.5 196.6 683.2 197.5C682.4 200 681.8 201.9 681.5 202.6C681.4 203.1 681.1 203.9 680.9 204.5C680.6 205.6 680.1 207.3 679.5 208.9C679.3 209.5 679.1 210.2 679 210.5C678.9 210.8 678.7 211.6 678.4 212.2C678.2 212.9 677.8 214.3 677.4 215.3C677.1 216.3 676.7 217.5 676.6 217.9C676.5 218.3 676.2 219 676.1 219.6C675.9 220.1 675.6 221.1 675.4 221.6C675.2 222.2 674.8 223.5 674.4 224.6C674.1 225.6 673.7 226.8 673.5 227.3C673.4 227.7 673.1 228.6 672.9 229.1C672.6 230.3 672.1 231.9 671.5 233.6C671.3 234.1 671.1 234.8 671 235.1C670.9 235.4 670.7 236.2 670.4 236.9C670.2 237.5 669.8 238.9 669.4 239.9C669.1 241 668.7 242.1 668.6 242.5C668.5 242.9 668.2 243.8 668 244.5C667.6 246 666.9 247.3 666.6 247.4C666.2 247.4 665.7 245.9 664.1 239.9C663.8 239.1 663.6 238.3 663.5 238.1C663.4 238 663.3 237.5 663.1 236.9C662.9 235.8 662.5 234.6 661.5 231.3C661.2 230.5 661 229.7 661 229.6C661 229.5 660.8 228.7 660.5 227.9C660.2 227.1 660 226.3 660 226.2C660 226.1 659.8 225.4 659.6 224.6C659.1 223.3 658.8 222.1 658.1 219.8C657.9 219.1 657.6 218.1 657.5 217.6C657.1 216.4 656.6 214.9 656.1 213.1C655.8 211.8 655.5 210.7 654.5 207.6C654.2 206.7 654 205.9 654 205.8C654 205.7 653.8 205.1 653.6 204.5C653.4 203.9 653.1 203 653 202.4C652.9 201.8 652.7 201.2 652.6 200.9C652.4 200.7 652.2 199.8 652 199C651.6 197.4 651.1 196.4 650.7 196.1C650.3 195.8 624.4 195.8 623.7 196.1C623.1 196.3 623 196.7 623.4 197.5C623.5 197.9 623.8 198.6 623.9 199.1C624.1 199.6 624.3 200.3 624.4 200.6C624.6 200.8 624.8 201.6 625 202.2C625.2 202.8 625.6 204 625.9 204.9C626.7 207.1 627.4 209.2 627.9 210.7C628.2 211.4 628.6 212.8 629 213.8C629.4 214.7 629.8 216 629.9 216.5C630.1 217 630.4 217.8 630.5 218.2C630.7 218.6 630.9 219.1 630.9 219.4C631 219.6 631.2 220.2 631.4 220.8C631.6 221.3 631.9 222.1 632.1 222.6C632.2 223.1 632.6 224.3 632.9 225.2C633.7 227.3 634.4 229.4 634.9 230.9C635.2 231.6 635.6 233 636 234C636.4 235 636.8 236.2 636.9 236.8C637.1 237.3 637.4 238 637.5 238.4C637.7 238.9 637.9 239.4 637.9 239.6C638 239.9 638.2 240.5 638.4 240.9C638.6 241.4 638.9 242.2 639 242.6C639.1 243.1 639.5 244.3 639.9 245.2C640.7 247.5 641.4 249.5 641.9 251.2C642.2 251.9 642.6 253.3 643 254.2C643.4 255.2 643.8 256.5 643.9 257C644.1 257.5 644.3 258.2 644.5 258.6C644.6 258.9 644.8 259.5 644.9 259.9C645 260.3 645.2 260.9 645.4 261.2C645.5 261.5 645.8 262.3 646 262.9C646.2 263.6 646.6 264.8 646.9 265.7C647.7 267.8 648.4 269.9 648.9 271.4C649.2 272.1 649.6 273.5 650 274.5C650.4 275.5 650.8 276.7 650.9 277.2C651.1 277.8 651.3 278.5 651.5 278.8C651.6 279.1 651.8 279.7 651.9 280.1C652 280.5 652.2 281.1 652.4 281.5C652.5 281.8 652.8 282.6 653 283.2C653.8 285.9 654.2 286.7 654.7 286.9C654.8 286.9 660 287 666.2 287C677.2 286.9 677.4 286.9 677.6 286.7ZM420 262.9C410.9 262.3 403.4 255.3 401.8 245.9C401.2 242.4 401.4 237.3 402.3 234.6C405.4 225 413.1 219.6 423 220.1C435.5 220.6 443.5 231.1 441.9 244.9C441.2 251.2 437.4 257.1 432.4 260.2C429.6 261.9 424.5 263.2 421.7 263C421.5 263 420.8 262.9 420 262.9ZM802.6 231.1C801.6 230.8 802 229.3 803.7 226.2C806.9 220.6 812.5 216.9 818.8 216.1C820.4 215.9 825.8 216 826.8 216.3C834.1 218.1 838 221.7 840.4 228.6C841 230.4 840.9 230.8 840.2 231C839.7 231.1 802.9 231.3 802.6 231.1Z';
function lwMarkSVG(){
  return`<rect y="85" width="31" height="200" fill="currentColor"/><rect y="252" width="124" height="33" fill="currentColor"/><path d="${LW_W}" fill="currentColor"/><circle class="lw-ring" cx="290.5" cy="51.5" r="47.25" fill="none" stroke-width="4.8"/><circle class="lw-dot" cx="290.5" cy="51.5" r="26"/>`;
}
function logoMark(h){
  return`<svg class="lw-mark" viewBox="0 0 341 286" style="height:${h}px;width:auto" role="img" aria-label="Lah We">${lwMarkSVG()}</svg>`;
}
// The mark and the wordmark as one drawing, so they keep the artwork's proportions at any size.
// h is the height of the mark (the wordmark is set from it); the second argument is no longer used.
function logoLockup(h){
  return`<svg class="lw-mark lw-lock" viewBox="0 0 875 290" style="height:${Math.round(h*290/286)}px;width:auto" role="img" aria-label="Lah We">${lwMarkSVG()}<path d="${LW_WORD}" fill="currentColor" fill-rule="evenodd"/></svg>`;
}
