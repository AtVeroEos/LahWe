// NAV + RENDER
// ═══════════════════════════════════════════════════
function go(tab){
  S.tab=tab;killCharts();
  if(tab==='history'){S.calMonth=new Date().getMonth();S.calYear=new Date().getFullYear();}
  document.querySelectorAll('.nb').forEach((b,i)=>b.classList.toggle('on',['workout','history','progress','nutrition','library'][i]===tab));
  render();
}
function render(){
  const c=document.getElementById('content');c.innerHTML='';c.scrollTop=0;
  if(!S.onboarded){renderOnboarding(c);return;}
  if(S.tab==='workout')renderWorkout(c);
  else if(S.tab==='history')renderHistory(c);
  else if(S.tab==='progress')renderProgress(c);
  else if(S.tab==='nutrition')renderNutrition(c);
  else if(S.tab==='library')renderLibrary(c);
}

// ═══════════════════════════════════════════════════
