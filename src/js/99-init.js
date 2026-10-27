// ═══════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════
async function boot(){
  initState();
  let res={hadData:false,corrupt:false};
  try{res=await Store.load();}
  catch(e){
    // Something stored could not be turned into a usable state. Treat it like unreadable data:
    // keep it, show the recovery screen, and do not let a save replace it.
    logError(e,'load');
    const raw=Store.lsGet(STORE_KEY);
    if(raw){Store.corrupt=raw;Store.ready=false;S=defaultState();res={hadData:false,corrupt:true};}
    else Store.ready=true; // nothing was stored at all: a genuine first run
  }
  try{afterStateLoaded();}catch(e){logError(e,'afterLoad');}
  document.getElementById('nav').style.display=(S.onboarded&&!res.corrupt)?'flex':'none';
  if(S.onboarded&&sessionActive())sessionGo();else go('workout'); // the app opens on Home, or on the workout still in progress
  pullHomeInit();
  // Resume anything that was running when the app was last closed.
  try{
    if(S.activeSprintTimer)startSprintLoop();
    if(S.activeCardDeck)schedCDAutoFlip();
    if(S.activeWorkout)startWtTimer();
    if(S.restTimer)runRestTicker();
    if(S.activeWorkout&&S.activeWorkout._tm)tmLoop();
  }catch(e){logError(e,'resume');}
  // Ask the browser not to evict this origin's storage under pressure (no prompt on iOS).
  try{if(S.onboarded&&navigator.storage&&navigator.storage.persist)navigator.storage.persist();}catch(e){}
  // Routes: load them (a backup is then built without waiting, inside the tap that asked for it),
  // and clear out any whose activity has been deleted.
  try{Routes.all().then(routesSweep).catch(e=>logError(e,'routes'));}catch(e){logError(e,'routes');}
  registerOfflineSupport();
  // Today's daily copy of the log, once the app has settled (90-daily-copies.js).
  setTimeout(()=>{dailyTake().catch(e=>logError(e,'daily copy'));},4000);
  // Coming back from a Spotify sign-in? Finish it.
  try{musicHandleReturn();}catch(e){logError(e,'music');}
}
// The single HTML file works on its own. When it is served over http(s) next to sw.js,
// a service worker caches it so the app opens with no signal.
function registerOfflineSupport(){
  try{
    if(!('serviceWorker' in navigator))return;
    if(!/^https?:$/.test(location.protocol))return;
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }catch(e){}
}
window.addEventListener('load',boot);
// Chrome and Edge offer a real install prompt; keep it so Settings → Install can show the button.
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window._installEvt=e;});
// Leaving the app: write now (the debounced save may never fire), and re-sync timers on return.
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){Store.flush();try{musicSync();}catch(e){}return;}
  try{musicSync();}catch(e){}
  kbSoon(60); // back from another app: lay out for the screen as it is now (see kbHeight)
  if(S.restTimer)runRestTicker();else syncRestUI();
  if(S.activeWorkout&&S.activeWorkout._tm)tmLoop(); // the clock catches up with the time that passed
  syncWakeLock();
  if(S.activeSprintTimer)updateSprintDisplay();
  // A new day may have started while the app sat in the background.
  if(window._renderedDay&&window._renderedDay!==today()){
    dailyTake().catch(e=>logError(e,'daily copy'));
    if(!document.querySelector('.ov')){resolveProgramGroup();render();}
  }
  window._renderedDay=today();
});
window.addEventListener('pagehide',()=>{Store.flush();});
// The keyboard is measured against the screen's height with nothing being typed in (see kbBaseline):
// take it now, before any field can have the keyboard, and again whenever the window changes size.
try{kbBaseline();}catch(e){}
window.addEventListener('resize',()=>{try{if(!isTyping(document.activeElement))kbBaseline();}catch(e){}});
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',()=>{try{coachViewportSync();}catch(e){}try{kbSync();}catch(e){}kbSoon(120);});
  window.visualViewport.addEventListener('scroll',()=>kbSoon(80));
}
// When the keyboard goes away the phone can leave the page slid up; put it back once it has gone.
document.addEventListener('focusout',()=>kbSoon(450));
// A file picker is another screen in front of the app: the keyboard goes away first (see leaveTyping).
document.addEventListener('click',e=>{const t=e.target;if(t&&t.tagName==='INPUT'&&t.type==='file')leaveTyping();},true);
// Coming back from another app, the share sheet or a picker: lay out for the screen as it is now,
// whether or not the phone reported the change while the app was not in front.
window.addEventListener('pageshow',()=>kbSoon(60));
window.addEventListener('focus',()=>kbSoon(60));
// Two copies of the app open at once (two browser tabs on a computer): when the other one saves, take
// its data, so this one does not later save its older copy over it and erase what was logged there.
// (On an iPhone the Home Screen app is one window, so this does not come up there.)
window.addEventListener('storage',e=>{
  if(e.key===LIVE_KEY&&e.newValue&&!Store.corrupt){
    // The other window ticked a set: take its workout in progress (only that was written).
    const l=Store.parse(e.newValue);if(!l||!(Number(l._savedAt)>(S._savedAt||0))||!(Number(l._savedAt)>Store.liveAt))return;
    try{
      Store.liveAt=Number(l._savedAt);
      S.activeWorkout=isObj(l.activeWorkout)?normalizeState({_schema:SCHEMA,activeWorkout:l.activeWorkout}).activeWorkout:null;
      S.restTimer=isObj(l.restTimer)?l.restTimer:null;Store.liveDirty=false;
      rebuildPRs();bumpMemo();if(S.restTimer)runRestTicker();else syncRestUI();
      if(!document.querySelector('.ov'))render();
    }catch(err){logError(err,'storage sync');}
    return;
  }
  if(e.key!==STORE_KEY||!e.newValue||Store.corrupt)return;
  const d=Store.parse(e.newValue);if(!d||!(d._savedAt>(S._savedAt||0)))return;
  try{
    // The newer copy wins, as it does on launch: a save still waiting in this window is dropped.
    if(Store.timer){clearTimeout(Store.timer);Store.timer=null;}
    S=normalizeState(d);afterStateLoaded();Store.dirty=false;
    document.querySelectorAll('.ov').forEach(o=>o.remove());render();
    toast('Updated with changes from your other window');
  }catch(err){logError(err,'storage sync');}
});
// Things you tap that are not buttons in the markup (a set's tick, a tile, a calendar day): VoiceOver
// and a keyboard should treat them as buttons too. Marked as they appear; Enter and Space press them.
(function(){
  const NATIVE=/^(BUTTON|A|INPUT|SELECT|TEXTAREA|LABEL|SUMMARY|OPTION)$/;
  const mark=root=>{
    if(!root||!root.querySelectorAll)return;
    const els=root.matches&&root.matches('[onclick]')?[root,...root.querySelectorAll('[onclick]')]:root.querySelectorAll('[onclick]');
    els.forEach(el=>{
      if(NATIVE.test(el.tagName)||el.closest('svg')&&el.tagName!=='svg'&&el.tagName!=='g')return;
      if(!el.hasAttribute('role'))el.setAttribute('role','button');
      if(!el.hasAttribute('tabindex'))el.tabIndex=0;
    });
  };
  if(typeof MutationObserver==='function'&&document.body){
    new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)mark(n);}))).observe(document.body,{childList:true,subtree:true});
    mark(document.body);
  }
  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const t=e.target;if(!t||NATIVE.test(t.tagName)||t.getAttribute('role')!=='button'||!t.hasAttribute('onclick'))return;
    e.preventDefault();t.click();
  });
})();
