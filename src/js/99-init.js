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
  go(S.tab||'workout');
  // Resume anything that was running when the app was last closed.
  try{
    if(S.activeSprintTimer)startSprintLoop();
    if(S.activeCardDeck)schedCDAutoFlip();
    if(S.activeWorkout)startWtTimer();
    if(S.restTimer)runRestTicker();
  }catch(e){logError(e,'resume');}
  // Ask the browser not to evict this origin's storage under pressure (no prompt on iOS).
  try{if(S.onboarded&&navigator.storage&&navigator.storage.persist)navigator.storage.persist();}catch(e){}
  // Routes: load them (a backup is then built without waiting, inside the tap that asked for it),
  // and clear out any whose activity has been deleted.
  try{Routes.all().then(routesSweep).catch(e=>logError(e,'routes'));}catch(e){logError(e,'routes');}
  registerOfflineSupport();
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
  if(S.restTimer)runRestTicker();else syncRestUI();
  syncWakeLock();
  if(S.activeSprintTimer)updateSprintDisplay();
  // A new day may have started while the app sat in the background.
  if(window._renderedDay&&window._renderedDay!==today()&&!document.querySelector('.ov')){resolveProgramGroup();render();}
  window._renderedDay=today();
});
window.addEventListener('pagehide',()=>{Store.flush();});
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',()=>{try{coachViewportSync();}catch(e){}try{kbSync();}catch(e){}kbSoon(120);});
  window.visualViewport.addEventListener('scroll',()=>kbSoon(80));
}
// When the keyboard goes away the phone can leave the page slid up; put it back once it has gone.
document.addEventListener('focusout',()=>kbSoon(450));
