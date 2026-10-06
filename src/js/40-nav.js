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
  S.tab=tab;killCharts();
  if(tab==='progress'&&S.progView==='schedule'){S.calMonth=new Date().getMonth();S.calYear=new Date().getFullYear();}
  if(tab!=='coach'&&typeof coachLeave==='function')coachLeave();
  document.querySelectorAll('.nb').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  render();
}
// Top-level render. It clears the screen first, so everything below runs inside a boundary:
// a failure shows a recovery screen instead of a blank page.
function render(){
  const c=document.getElementById('content');
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
  syncWakeLock();
  try{musicSync();}catch(e){}
}
// Re-draw whichever screen is showing (used after data changes made from a sheet).
function rerender(){render();}
