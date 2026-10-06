// PWA + INIT
// ═══════════════════════════════════════════════════
window.addEventListener('load',()=>{
  initState();load();
  // Ensure nav is visible if onboarded
  if(S.onboarded){document.getElementById('nav').style.display='flex';}else{document.getElementById('nav').style.display='none';}
  go(S.tab||'workout');
  // Resume active timers after reload
  if(S.activeSprintTimer)startSprintLoop();
  if(S.activeCardDeck)schedCDAutoFlip();
});
window.addEventListener('resize',()=>{
  if(S.tab==='progress'&&Object.values(S.expandedCards).some(Boolean)){setTimeout(()=>renderCharts(),100);}
});
