// ═══════════════════════════════════════════════════
// NAV + RENDER
// ═══════════════════════════════════════════════════
const TABS=['workout','progress','coach','nutrition','library'];
const PROG_VIEWS=['progress','history','schedule'];
function go(tab){
  // 'history' and 'schedule' are views of the Progress tab; go('history') still works everywhere.
  // Tapping the Progress tab itself always opens on Progress.
  if(tab==='history'||tab==='schedule'){S.progView=tab;tab='progress';}
  else if(tab==='progress')S.progView='progress';
  if(!TABS.includes(tab))tab='workout';
  if(tab==='nutrition'&&S.tab!=='nutrition'&&typeof window!=='undefined'){window._nutDay=null;window._suppOpen=null;} // arriving on Nutrition always starts on today
  // Changing tab puts the keyboard away first; otherwise the phone resizes the page mid-redraw.
  if(S.tab!==tab&&typeof document!=='undefined'){const a=document.activeElement;if(a&&typeof isTyping==='function'&&isTyping(a)){try{a.blur();}catch(e){}}}
  S.tab=tab;
  if(tab==='progress'&&S.progView==='schedule'){S.calMonth=new Date().getMonth();S.calYear=new Date().getFullYear();}
  if(tab!=='coach'&&typeof coachLeave==='function')coachLeave();
  document.querySelectorAll('.nb').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  render();
}
function pageScrollStop(c){
  c.style.overflowY='hidden';c.scrollTop=0;
  try{if((window.scrollY||0)>0)window.scrollTo(0,0);}catch(e){}
}
function pageScrollTop(c){
  c.scrollTop=0;c.style.overflowY='';
  const again=()=>{const el=document.getElementById('content');if(el&&el.dataset.tab===S.tab&&el.scrollTop>0)el.scrollTop=0;};
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{again();requestAnimationFrame(again);});
}
// Top-level render. It clears the screen first, so everything below runs inside a boundary:
// a failure shows a recovery screen instead of a blank page.
function render(){
  const c=document.getElementById('content');
  const tabChanged=c.dataset.tab!==S.tab;c.dataset.tab=S.tab;
  // On a phone the old page can still be gliding when the new one is drawn; the glide then carries on
  // past the end of the new, shorter page and leaves a blank screen until you scroll back up.
  // Stopping the scroll (overflow off for a moment) and resetting it before and after drawing prevents that.
  if(tabChanged)pageScrollStop(c);
  try{
    c.innerHTML='';c.scrollTop=0;
    c.classList.toggle('coach-on',S.tab==='coach'&&!!S.onboarded&&!Store.corrupt);
    if(Store.corrupt){renderCorrupt(c);return;}
    if(!S.onboarded){renderOnboarding(c);return;}
    if(S.tab==='workout')renderWorkout(c);
    else if(S.tab==='progress')renderProgress(c);
    else if(S.tab==='nutrition')renderNutrition(c);
    else if(S.tab==='library')renderLibrary(c);
    else if(S.tab==='coach')renderCoach(c);
  }catch(e){renderCrash(c,e,'render:'+S.tab);}
  finally{if(tabChanged||c.style.overflowY)pageScrollTop(c);} // always, even for the intro and recovery screens that return early
  syncWakeLock();
  try{musicSync();}catch(e){}
}
// Re-draw whichever screen is showing (used after data changes made from a sheet).
// Redraw the current tab, and an open Progress sheet with it (a weigh-in logged over a chart shows up in the chart).
function rerender(){render();if(document.getElementById('metric-ov'))renderMetric();}
