// ═══════════════════════════════════════════════════
// NAV + RENDER
// ═══════════════════════════════════════════════════
const TABS=['workout','history','progress','nutrition','library'];
function go(tab){
  if(!TABS.includes(tab))tab='workout';
  S.tab=tab;killCharts();
  if(tab==='history'){S.calMonth=new Date().getMonth();S.calYear=new Date().getFullYear();}
  document.querySelectorAll('.nb').forEach((b,i)=>b.classList.toggle('on',TABS[i]===tab));
  render();
}
// Top-level render. It clears the screen first, so everything below runs inside a boundary:
// a failure shows a recovery screen instead of a blank page.
function render(){
  const c=document.getElementById('content');
  try{
    c.innerHTML='';c.scrollTop=0;
    if(Store.corrupt){renderCorrupt(c);return;}
    if(!S.onboarded){renderOnboarding(c);return;}
    if(S.tab==='workout')renderWorkout(c);
    else if(S.tab==='history')renderHistory(c);
    else if(S.tab==='progress')renderProgress(c);
    else if(S.tab==='nutrition')renderNutrition(c);
    else if(S.tab==='library')renderLibrary(c);
  }catch(e){renderCrash(c,e,'render:'+S.tab);}
  syncWakeLock();
}
// Re-draw whichever screen is showing (used after data changes made from a sheet).
function rerender(){render();}
