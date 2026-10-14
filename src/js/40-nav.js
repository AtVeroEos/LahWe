// ═══════════════════════════════════════════════════
// NAV + RENDER
// ═══════════════════════════════════════════════════
const TABS=['workout','progress','coach','nutrition','library'];
const PROG_VIEWS=['progress','history'];
// Where a tap on Home took you (a tab reached from a Home tile); pulling down at the top of that
// page goes back. A tap on the tab bar clears it: that page was not opened from Home.
let _homeReturn=null;
function homeGo(tab){go(tab);_homeReturn=S.tab==='workout'?null:S.tab;render();}
function go(tab){
  _homeReturn=null;
  // 'history' is a view of the Progress tab; 'schedule' is a page of Home. go('history') and go('schedule')
  // still work everywhere. Tapping the Progress or Home tab itself always opens on its main page.
  if(tab==='history'){S.progView='history';tab='progress';}
  else if(tab==='schedule'){S.homeView='schedule';tab='workout';S.calMonth=new Date().getMonth();S.calYear=new Date().getFullYear();window._schedLens='all';}
  else if(tab==='habits'){S.homeView='habits';tab='workout';}
  else if(tab==='progress')S.progView='progress';
  else if(tab==='workout')S.homeView='';
  if(!TABS.includes(tab))tab='workout';
  if(tab==='nutrition'&&S.tab!=='nutrition'&&typeof window!=='undefined'){window._nutDay=null;window._suppOpen=null;} // arriving on Nutrition always starts on today
  // Changing tab puts the keyboard away first; otherwise the phone resizes the page mid-redraw.
  if(S.tab!==tab&&typeof document!=='undefined'){const a=document.activeElement;if(a&&typeof isTyping==='function'&&isTyping(a)){try{a.blur();}catch(e){}}}
  S.tab=tab;
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
    c.classList.remove('swipe-on');
    c.classList.toggle('pull-home',pullHomeOn()); // the grabber at the top: this page pulls down to Home
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

// ─── Pull down to go Home ───
// Everything opened from Home closes the same way: a sheet is swiped down (sheetSwipe), and a page
// (Habits, Schedule, or a tab a Home tile jumped to) is pulled down from its top. Both show the same
// grabber at the top. The pull is taken only at the very top of the page, heading down, with no sheet
// open, so ordinary scrolling, sideways chip rows and the workout screens are never affected.
function pullHomeOn(){
  if(!S.onboarded||Store.corrupt)return false;
  if(S.activeWorkout||S.activeCardDeck||S.activeSprintTimer)return false;
  if(S.tab==='workout')return S.homeView==='habits'||S.homeView==='schedule';
  return S.tab!=='coach'&&_homeReturn===S.tab;
}
function pullHomeInit(){
  const c=document.getElementById('content');if(!c||c._pullHome)return;c._pullHome=true;
  const SLOP=8,GO=96;let y0=0,x0=0,t0=0,ok=false,drag=false,dy=0;
  const pill=()=>{let p=document.getElementById('pull-home');if(!p){p=document.createElement('div');p.id='pull-home';p.innerHTML=`<span class="ph-i">${ICON('arrowdown',14)}</span><span class="ph-t">Home</span>`;document.body.appendChild(p);}return p;};
  const reset=()=>{c.style.transition='transform .22s cubic-bezier(.22,.61,.36,1)';c.style.transform='';const p=document.getElementById('pull-home');if(p){p.classList.remove('on','go');}};
  c.addEventListener('touchstart',e=>{
    ok=false;drag=false;dy=0;
    if(e.touches.length!==1||!pullHomeOn()||document.querySelector('.ov')||c.scrollTop>0)return;
    const t=e.target;
    if(t&&t.closest&&t.closest('input,select,textarea,canvas,[data-noswipe]'))return;
    const p=e.touches[0];y0=p.clientY;x0=p.clientX;t0=Date.now();ok=true;
  },{passive:true});
  c.addEventListener('touchmove',e=>{
    if(!ok||e.touches.length!==1)return;
    const p=e.touches[0];dy=p.clientY-y0;const dx=p.clientX-x0;
    if(!drag){
      if(dy<-SLOP||Math.abs(dx)>Math.max(SLOP,Math.abs(dy))||c.scrollTop>0){ok=false;return;} // up or sideways: a scroll, not ours
      if(dy<SLOP)return;
      if(e.cancelable===false){ok=false;return;}
      drag=true;c.style.transition='none';
    }
    if(e.cancelable!==false)e.preventDefault();
    const pull=Math.min(140,(dy-SLOP)*0.5);c.style.transform=`translateY(${pull}px)`;
    const el=pill();el.classList.add('on');el.classList.toggle('go',dy>=GO);
    el.querySelector('.ph-t').textContent=dy>=GO?'Release for Home':'Home';
  },{passive:false});
  const end=e=>{
    if(!drag){ok=false;return;}
    drag=false;ok=false;const dt=Math.max(1,Date.now()-t0);
    const go_=e.type==='touchend'&&(dy>=GO||(dy>48&&dy/dt>0.6));
    reset();
    if(go_){if(navigator.vibrate)try{navigator.vibrate(8);}catch(x){}go('workout');}
  };
  c.addEventListener('touchend',end);c.addEventListener('touchcancel',end);
}
