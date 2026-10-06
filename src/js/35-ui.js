// ═══════════════════════════════════════════════════
// UI HELPERS — sheets, toasts, confirm, rest timer, wake lock, error boundary
// ═══════════════════════════════════════════════════
function makeOv(id){
  if(id){const old=document.getElementById(id);if(old)old.remove();}
  const ov=document.createElement('div');ov.className='ov';if(id)ov.id=id;
  ov.addEventListener('click',e=>{if(e.target===ov)dismissOv(ov);});
  return ov;
}
function dismissOv(ov){
  if(!ov)return;
  if(ov.id==='scan-ov'&&typeof teardownScanner==='function')teardownScanner();
  const modal=ov.querySelector('.modal');
  if(modal){modal.style.transition='transform .22s cubic-bezier(.22,.61,.36,1)';modal.style.transform='translateY(100%)';}
  ov.style.pointerEvents='none';
  setTimeout(()=>ov.remove(),220);
}
function closeOv(id){dismissOv(document.getElementById(id));}
function attachSwipeDown(ov){
  const handle=ov.querySelector('.mh');const modal=ov.querySelector('.modal');
  if(!handle||!modal)return;
  let startY=0,startT=0,dragging=false;
  handle.style.touchAction='none';
  handle.addEventListener('pointerdown',e=>{
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
  if(opts&&opts.action){
    el.classList.add('toast-act');
    const b=document.createElement('button');b.className='toast-btn';b.textContent=opts.action;
    b.onclick=()=>{el.remove();try{opts.onAction&&opts.onAction();}catch(e){logError(e);}};
    el.appendChild(b);ms=opts.ms||6000;
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
function playRestBeep(){
  const ctx=getAudioCtx();if(!ctx)return;
  _tone(660,0,0.14,0.35);_tone(880,0.18,0.22,0.4);
}
function syncRestUI(){
  const pill=document.getElementById('rest-pill'),t=document.getElementById('rest-pill-t');
  if(!pill)return;
  const rem=restRemaining();
  if(S.restTimer&&rem>0){pill.classList.add('on');if(t)t.textContent='REST '+fmtTimer(rem);}
  else pill.classList.remove('on');
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
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('rest-pick-ov')">Close</button>
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
    <div class="mono" style="font-size:10px;color:var(--muted2);background:var(--bg2);border-radius:8px;padding:8px 10px;margin:12px 0 18px;text-align:left;word-break:break-word">${esc(errText(e)).slice(0,400)}</div>
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
