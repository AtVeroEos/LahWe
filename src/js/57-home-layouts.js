// ═══════════════════════════════════════════════════
// HOME LAYOUTS — six set layouts, picked in Settings with a live preview of each
// ═══════════════════════════════════════════════════
// A layout is only an order and a choice of Home's blocks (42-home.js, homeBlocks). Nothing is
// tracked differently on one layout or another: switching changes what leads, never what is kept.
// Six, so the picker is a clean 3 × 2 grid; Balanced is what Home always was, and the default.
//   blocks: the order, top to bottom.  areas: the order of the small tiles.  skip: tiles left off
//   because a bigger block on that layout already shows the same thing.
const HOME_LAYOUTS=[
  {id:'balanced',l:'Balanced',d:'Today’s workout, everything you track, your week.',
    blocks:['today','areas','week','line','milestone','qa','coach','more']},
  {id:'lifting',l:'Lifting',d:'Today’s workout and targets, how close your records are, sets per muscle.',
    blocks:['today','lift','week','areas','milestone','qa','coach','more'],areas:['Weight','Photos','Food','Sleep','Habits','Supplements','Cardio']},
  {id:'running',l:'Running',d:'Miles this week, training load, your last run and race times.',
    blocks:['run','todayline','areas','week','line','milestone','qa','coach'],areas:['Weight','Photos','Sleep','Food','Habits','Supplements'],skip:['Cardio']},
  {id:'nutrition',l:'Nutrition',d:'What is left to eat today, the meal plan to log, what fits, and your progress photos.',
    blocks:['food','areas','todayline','week','line','qa','coach'],areas:['Weight','Photos','Supplements','Habits','Sleep','Cardio'],skip:['Food'],photos:true},
  {id:'habits',l:'Habits & recovery',d:'Today’s habits and mood, sleep, then training.',
    blocks:['habits','areas','today','week','line','milestone','qa','coach'],areas:['Sleep','Weight','Photos','Food','Cardio','Supplements'],skip:['Habits']},
  {id:'minimal',l:'Minimal',d:'Today’s workout, the week, and the quick actions. Nothing else.',
    blocks:['today','week','qa']},
];
function homeLayout(id){return HOME_LAYOUTS.find(l=>l.id===id)||HOME_LAYOUTS[0];}
function setHomeLayout(id){
  if(!HOME_LAYOUTS.some(l=>l.id===id))return;
  S.homeLayout=id;save();
  if(typeof refreshSettings==='function')refreshSettings();
  if(S.tab==='workout'&&!S.homeView)render();
}

// ─── The picker (Settings → Home) ───
// Each option is the real Home, drawn small with your own data: what you see is what you get.
// The miniature is drawn without ids or handlers, so it cannot be tapped into or clash with the page.
// (The option is a div, not a button: Home is full of buttons, and a button inside a button is not HTML.)
function homePreviewHTML(id){
  let h='';try{h=homeHTML(id);}catch(e){logError(e,'layout preview '+id);h='';}
  return h.replace(/\son[a-z]+="[^"]*"/g,'').replace(/\sid="[^"]*"/g,'');
}
// The miniature is a real 390-px-wide Home scaled to the frame's width, once the frame is on screen.
function layScale(){
  document.querySelectorAll('.lay-grid').forEach(g=>{const f=g.querySelector('.lay-frame');if(f&&f.clientWidth)g.style.setProperty('--lay-s',String(f.clientWidth/390));});
}
function homeLayoutPickerHTML(){
  const cur=homeLayout(S.homeLayout).id;
  setTimeout(layScale,0);
  return`<div class="lay-grid" role="radiogroup" aria-label="Home layout">${HOME_LAYOUTS.map(l=>`<div class="lay-opt${l.id===cur?' on':''}" role="radio" tabindex="0" aria-checked="${l.id===cur}" aria-label="${esc(l.l)}" onclick="setHomeLayout('${l.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();setHomeLayout('${l.id}')}">
      <span class="lay-frame" aria-hidden="true"><span class="lay-pg">${homePreviewHTML(l.id)}</span></span>
      <span class="lay-l">${esc(l.l)}</span></div>`).join('')}</div>
    <div class="fine" style="margin:6px 2px 0">${esc(homeLayout(cur).d)} Every layout keeps all your data; only what leads changes.</div>`;
}

// ─── Blocks only some layouts use ───
// Lifting: the records within reach and this week's sets per muscle.
function homeLiftHTML(rv){
  const near=[];
  Object.entries(S.prs||{}).forEach(([exId,pr])=>{
    const h=getExStrData(exId);if(!h.length||!(pr.est>0))return;
    const last=h[h.length-1];const gap=Math.round(pr.est-last.e1rm);
    if(last.date<Date.now()-28*86400000)return;
    near.push({exId,name:exName(exId),gap,pct:Math.max(0,Math.min(1,last.e1rm/pr.est)),est:pr.est});
  });
  // Closest records still to beat first; lifts already at their best come after
  near.sort((a,b)=>(a.gap<=0)-(b.gap<=0)||a.gap-b.gap);
  const mus=(rv.muscles||[]).slice(0,6);const top=Math.max(1,...mus.map(m=>Math.max(m.sets,m.hi)));
  if(!near.length&&!mus.length)return'';
  return`<div class="card home-blk"><div class="ch"><span class="ct">Strength</span><button class="btn bts bxs" onclick="go('progress')">Progress</button></div>
    ${near.length?`<div class="list hb-list">${near.slice(0,3).map(n=>`<button class="row row-tap" onclick="showExDetail(${jsq(n.exId)})"><span class="row-main"><span class="row-t">${esc(n.name)}</span>
      <span class="row-s">${n.gap>0?`${n.gap} ${S.unit} from your best estimated max (${n.est})`:`At your best: ${n.est} ${S.unit} estimated max`}</span><span class="ha-bar tone-${n.gap>0?'info':'good'}"><i style="width:${Math.round(n.pct*100)}%"></i></span></span><span class="row-chev">${ICON('chev',16)}</span></button>`).join('')}</div>`:''}
    ${mus.length?`<div class="mus hb-mus">${mus.map(m=>`<div class="mus-r"><span class="mus-n">${esc(m.label)}</span>
      <span class="mus-t"><span class="mus-band" style="left:${Math.round(m.lo/top*100)}%;width:${Math.max(2,Math.round((m.hi-m.lo)/top*100))}%"></span><span class="mus-f mus-${m.status}" style="width:${Math.min(100,Math.round(m.sets/top*100))}%"></span></span>
      <span class="mus-v">${fmtSets(m.sets)}</span></div>`).join('')}<div class="mus-key">Sets per muscle, last 7 days, against the useful weekly range.</div></div>`:''}
  </div>`;
}
// Running: this week's miles, load, the last run and what your runs point to.
function homeRunHTML(){
  const runs=runList();
  if(!runs.length)return`<div class="hero hero-rest"><div class="hero-k">Running</div><div class="hero-t">No runs yet</div>
    <div class="hero-m">Log a run with its distance and time, or import your Strava archive in Settings.</div>
    <div class="hero-acts"><button class="hero-go" onclick="showLogActivity()">${ICON('run',15)} Log a run</button></div></div>`;
  const wk=runWeeksAll();const cur=wk[wk.length-1]||{mi:0,n:0};const prev=wk.slice(-5,-1);const avg=prev.length?prev.reduce((t,w)=>t+w.mi,0)/prev.length:0;
  const g=S.runGoal&&S.runGoal.miles>0?S.runGoal.miles/52:0;
  const last=runs[runs.length-1];const l=loadNow();const pr=runPredict(5000);
  const bars=svgBars(wk.slice(-8).map(w=>({v:w.mi,hollow:w.current})),{target:g||null});
  return`<div class="hero hero-run" onclick="showRunning()" role="button" aria-label="Running">
    <div class="hero-k">Running · this week</div>
    <div class="hero-t mono">${fmt1(cur.mi)}<small> mi${g?` of ${fmt1(g)}`:''}</small></div>
    <div class="hero-m">${cur.n} run${cur.n===1?'':'s'}${prev.length?` · ${fmt1(avg)} a week lately`:''}</div>
    <div class="hero-spark">${bars}</div>
    <div class="hero-aims">
      <div><span>Last run</span><b>${fmt1(last.mi)} mi${last.sec>0?` · ${fmtPace(last.sec/last.mi)}/mi`:''} · ${last.ds===today()?'today':fmtDay(last.ds)}</b></div>
      ${l.ratio!=null?`<div><span>Training load</span><b>${l.ratio.toFixed(1)}× · ${esc(l.word.toLowerCase())}</b></div>`:''}
      ${pr?`<div><span>5K on form</span><b>${fmtClock(pr.sec)}</b></div>`:''}
    </div>
    <div class="hero-acts"><button class="hero-go" onclick="event.stopPropagation();showLogActivity()">${ICON('plus',14)} Log a run</button><button class="hero-2" onclick="event.stopPropagation();showRunning()">${ICON('barchart',14)} Running</button></div>
  </div>`;
}
// Nutrition: what is left today, the meal plan to log, and what fits the gap.
function homeFoodHTML(){
  const td=today();const r=dayRemaining(td);const g=r.goals||{};const t=r.eaten||{};
  const row=(k,lbl,unit)=>{const goal=g[k]||0;const v=t[k]||0;const p=goal?Math.min(1,v/goal):0;
    return`<div class="hfd-r"><span class="hfd-l">${lbl}</span><span class="hfd-bar"><i style="width:${Math.round(p*100)}%"></i></span><span class="hfd-v mono">${Math.round(v)}<small>/${Math.round(goal)}${unit}</small></span></div>`;};
  let h=`<div class="hero hero-rest hero-food">
    <div class="hero-k">Food today</div>
    <div class="hero-t mono">${r.over?`${r.over.toLocaleString()}<small> kcal over</small>`:`${r.cals.toLocaleString()}<small> kcal left</small>`}</div>
    <div class="hfd">${row('protein','Protein','g')}${row('carbs','Carbs','g')}${row('fat','Fat','g')}</div>
    <div class="hero-acts"><button class="hero-go" onclick="showAddMeal()">${ICON('plus',14)} Log meal</button><button class="hero-2" onclick="homeGo('nutrition')">${ICON('apple',14)} Nutrition</button></div>
  </div>`;
  if(planHasMeals())h+=mealPlanCardHTML();
  let fit=null;try{fit=(t.cals||0)>0?whatFits(td,3):null;}catch(e){fit=null;}
  if(fit&&fit.items.length)h+=`<div class="sec-h">Fits what’s left</div><div class="list">${fit.items.map(fitRowHTML).join('')}</div>`;
  return h;
}
// Habits & recovery: the check-in, today's habits ticked right here, and the mood strip.
function homeHabitsHTML(){
  const td=today(),y=daysAgoStr(1);const hs=activeHabits();
  const due=hs.filter(x=>habitDay(x,td).st!=='off');const ok=due.filter(habitOkToday).length;
  let h=`<div class="card home-blk"><div class="ch"><span class="ct">Habits · ${ok} of ${due.length} today</span><button class="btn bts bxs" onclick="go('habits')">All</button></div>`;
  if(moodAsked()&&!(S.moodLog||{})[y])h+=`<div class="hb-ask"><div class="row-t">How was yesterday?</div>${moodChipsHTML(y,true)}</div>`;
  if(moodUsed())h+=`<button class="row row-tap hb-mood" onclick="showCalendar('mood')"><span class="row-main"><span class="row-t">Mood, 14 days</span>${moodStripHTML(14)}</span><span class="row-chev">${ICON('chev',16)}</span></button>`;
  h+=due.length?`<div class="hab-list">${due.map(x=>habitRowHTML(x)).join('')}</div>`
    :hs.length?`<div class="cb fine" style="margin:0">Nothing due today.</div>`
    :`<button class="row row-tap" onclick="go('habits');showAddHabit()"><span class="row-ic tone-info">${ICON('plus',17)}</span><span class="row-main"><span class="row-t">Add your first habit</span><span class="row-s">Something to do, reach or avoid, on the days you choose</span></span></button>`;
  return h+`</div>`;
}
