// ═══════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════
async function boot(){
  initState();
  let res={hadData:false,corrupt:false};
  try{res=await Store.load();}
  catch(e){logError(e,'load');Store.ready=true;}
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
  registerOfflineSupport();
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
// Leaving the app: write now (the debounced save may never fire), and re-sync timers on return.
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){Store.flush();return;}
  if(S.restTimer)runRestTicker();else syncRestUI();
  syncWakeLock();
  if(S.activeSprintTimer)updateSprintDisplay();
  // A new day may have started while the app sat in the background.
  if(window._renderedDay&&window._renderedDay!==today()&&!document.querySelector('.ov')){resolveProgramGroup();render();}
  window._renderedDay=today();
});
window.addEventListener('pagehide',()=>{Store.flush();});
window.addEventListener('resize',()=>{
  if(S.tab==='progress'&&Object.values(S.expandedCards).some(Boolean)){setTimeout(()=>{try{renderCharts();}catch(e){logError(e,'charts');}},100);}
});
