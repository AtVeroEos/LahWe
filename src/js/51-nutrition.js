// ═══════════════════════════════════════════════════
// NUTRITION
// ═══════════════════════════════════════════════════
function dayHasIntake(ds){
  const t=getDayTotals(ds);
  return !!(t.protein||t.carbs||t.fat||t.cals);
}
function getMacroStreak(){
  let n=0;
  // Today counts once something is logged, but an empty today doesn't break the run.
  if(dayHasIntake(today()))n++;
  for(let i=1;i<=365;i++){if(!dayHasIntake(daysAgoStr(i)))break;n++;}
  return n;
}
// A day's intake = every logged meal PLUS the Quick Log entry for that day.
// (Quick Log used to be dropped the moment a single meal was logged on the same day.)
function getDayTotals(ds){
  {
    const meals=(S.meals||[]).filter(m=>m.date===ds);
    const ml=S.macroLogs[ds];
    const n=v=>parseFloat(v)||0;
    const q=ml?{protein:n(ml.protein),carbs:n(ml.carbs),fat:n(ml.fat),cals:n(ml.cals)}:null;
    const hasQuick=!!(q&&!ml.parked&&(q.protein||q.carbs||q.fat||q.cals));
    const t={protein:0,carbs:0,fat:0,cals:0};
    meals.forEach(m=>{t.protein+=n(m.protein);t.carbs+=n(m.carbs);t.fat+=n(m.fat);t.cals+=n(m.cals);});
    if(hasQuick){t.protein+=q.protein;t.carbs+=q.carbs;t.fat+=q.fat;t.cals+=q.cals;}
    return{protein:r1(t.protein),carbs:r1(t.carbs),fat:r1(t.fat),cals:Math.round(t.cals),
      fromMeals:meals.length>0,mealCount:meals.length,quick:hasQuick?q:null};
  }
}
// Analyze bodyweight log: rate of change (lbs/week) over recent entries.
// Rate of bodyweight change over the last four weeks, from a least-squares fit through every
// weigh-in in that window (two readings a year apart are not a "trend").
function weightTrend(){
  const from=daysAgoStr(28);
  const pts=(S.bodyweightLog||[]).filter(b=>b.date>=from).map(b=>({x:-daysBetween(b.date,today()),y:parseFloat(b.weight)})).filter(p=>p.y>0);
  if(pts.length<2)return null;
  const xs=pts.map(p=>p.x);const span=Math.max(...xs)-Math.min(...xs);
  if(span<3)return null;
  const mx=xs.reduce((a,b)=>a+b,0)/pts.length,my=pts.reduce((a,p)=>a+p.y,0)/pts.length;
  let num=0,den=0;pts.forEach(p=>{num+=(p.x-mx)*(p.y-my);den+=(p.x-mx)*(p.x-mx);});
  if(!den)return null;
  const perDay=num/den;
  const newest=(S.bodyweightLog||[])[0];
  return{current:newest?newest.weight:pts[pts.length-1].y,deltaLb:r1(perDay*span),days:span,perWeek:r1(perDay*7),n:pts.length};
}
// Average daily calorie intake over the last N logged days.
// Average intake over the logged days among the last N COMPLETED days (today is still in progress).
function avgDailyIntake(n){
  n=n||7;const vals=[];
  for(let i=1;i<=n;i++){const cals=getDayTotals(daysAgoStr(i)).cals||0;if(cals>0)vals.push(cals);}
  if(!vals.length)return 0;
  return Math.round(vals.reduce((t,v)=>t+v,0)/vals.length);
}
// Formula estimate of maintenance: sedentary baseline plus the exercise actually logged over the same days.
function maintenanceKcal(n){
  n=n||7;let ex=0;
  for(let i=1;i<=n;i++)ex+=dayExerciseCals(daysAgoStr(i));
  return baselineBurn()+Math.round(ex/n);
}
// ─── Maintenance from your own numbers ───
// What you ate and what your weight did over the same days say what maintenance is, with no
// formula: average intake, less the energy the weight change accounts for. It needs enough of
// both to mean anything, and says what is missing when it does not have it.
//   · weigh-ins: at least MAINT_MIN_WEIGHINS in the last four weeks, MAINT_MIN_SPAN days or more apart
//   · food: logged on at least MAINT_MIN_FOOD days and MAINT_MIN_COVER of the days between those weigh-ins
// Days logged at under half the usual are treated as unfinished logs and left out.
const MAINT_DAYS=28,MAINT_MIN_WEIGHINS=4,MAINT_MIN_SPAN=14,MAINT_MIN_FOOD=10,MAINT_MIN_COVER=0.7;
const MAINT_T95=[0,12.71,4.30,3.18,2.78,2.57,2.45,2.36,2.31,2.26,2.23,2.20,2.18,2.16,2.14,2.13,2.12,2.11,2.10,2.09,2.09,2.08,2.07,2.07,2.06,2.06,2.06,2.05,2.05]; // two-sided 95%, by degrees of freedom
function observedMaintenance(days){
  days=days||MAINT_DAYS;
  return memo('maint'+days+today(),()=>{
    const td=today(),from=daysAgoStr(days);const K=kcalPerWeightUnit();
    // One reading per day: two entries on a date (an imported backup can have them) are averaged, not counted twice.
    const byDate={};
    (S.bodyweightLog||[]).forEach(b=>{const w=parseFloat(b.weight);if(b.date>=from&&b.date<=td&&w>0)(byDate[b.date]=byDate[b.date]||[]).push(w);});
    const pts=Object.keys(byDate).sort().map(d=>({x:daysBetween(from,d),y:byDate[d].reduce((t,v)=>t+v,0)/byDate[d].length,date:d}));
    const n=pts.length;const span=n>=2?pts[n-1].x-pts[0].x:0;
    const weighOk=n>=MAINT_MIN_WEIGHINS&&span>=MAINT_MIN_SPAN;
    // A morning weigh-in reflects eating up to the day before, so the days that produced the
    // change run from the first weigh-in's day to the day before the last one.
    const fFrom=weighOk?pts[0].date:from,fDays=weighOk?span:days;
    let vals=[];
    for(let i=0;i<fDays;i++){const ds=addDays(fFrom,i);if(ds>=td)break;const c=getDayTotals(ds).cals||0;if(c>0)vals.push(c);}
    const sorted=vals.slice().sort((p,q)=>p-q);const median=sorted.length?sorted[Math.floor(sorted.length/2)]:0;
    const used=vals.filter(v=>v>=median*0.5);const dropped=vals.length-used.length;
    const needFood=Math.max(MAINT_MIN_FOOD,Math.ceil(fDays*MAINT_MIN_COVER));
    const foodOk=used.length>=needFood;
    const base={ok:false,weighIns:n,span,foodDays:used.length,ofDays:fDays,needFood,dropped,window:days,weighOk,foodOk,unit:S.unit||'lbs'};
    if(!weighOk||!foodOk)return base;
    const mean=a=>a.reduce((t,v)=>t+v,0)/a.length;
    const mx=mean(pts.map(p=>p.x)),my=mean(pts.map(p=>p.y));
    let sxx=0,sxy=0;pts.forEach(p=>{sxx+=(p.x-mx)*(p.x-mx);sxy+=(p.x-mx)*(p.y-my);});
    if(!sxx)return base;
    const slope=sxy/sxx;                                  // weight units per day
    let sse=0;pts.forEach(p=>{const e=p.y-(my+slope*(p.x-mx));sse+=e*e;});
    const seSlope=Math.sqrt(sse/(n-2)/sxx);
    const avg=mean(used);const sd=Math.sqrt(used.reduce((t,v)=>t+(v-avg)*(v-avg),0)/(used.length-1));
    const seIn=sd/Math.sqrt(used.length);
    const kcal=avg-slope*K;
    // A 95% margin. With few weigh-ins the trend is much less certain than "two standard errors"
    // suggests, so the multiplier comes from Student's t for the points actually there (4.3 with
    // four weigh-ins, 2.2 with thirteen). Never tighter than ±50: food logging is not that exact.
    const tS=MAINT_T95[Math.min(n-2,MAINT_T95.length-1)],tI=MAINT_T95[Math.min(used.length-1,MAINT_T95.length-1)];
    const margin=Math.max(50,Math.round(Math.sqrt(tI*seIn*tI*seIn+tS*seSlope*K*tS*seSlope*K)/10)*10);
    return Object.assign(base,{ok:true,kcal:Math.round(kcal/10)*10,margin,avgIntake:Math.round(avg),
      perWeek:Math.round(slope*7*100)/100,from:pts[0].date,to:pts[n-1].date,rough:margin>300});
  });
}
// The number the app uses for maintenance: yours when there is enough data, the formula until then.
function maintenanceBest(){
  const o=observedMaintenance();
  return o.ok?{kcal:o.kcal,src:'logs',obs:o}:{kcal:maintenanceKcal(7),src:'formula',obs:o};
}
// What the calorie targets come to per day on average, given the last two weeks' mix of training and rest days.
function targetAvgKcal(){
  const g=S.macroGoals||{cals:0};
  if(!hasRestGoals())return Math.round(g.cals||0);
  let t=0;for(let i=1;i<=14;i++)if(dayKind(daysAgoStr(i))==='train')t++;
  return Math.round((t*g.cals+(14-t)*S.restGoals.cals)/14/10)*10;
}
// Do the targets do what the weight goal asks? Plain statement, with a tone for the row.
function maintenanceVerdict(m){
  m=m||maintenanceBest();const tg=targetAvgKcal();if(!tg||!m.kcal)return null;
  const u=S.unit||'lbs';const gap=tg-m.kcal;const perWeek=gap*7/kcalPerWeightUnit();const dir=S.weightGoalDir;
  // A formula can be a few hundred calories out for any one person. It is not grounds for telling
  // someone their targets are wrong, so it only gets a plain comparison.
  if(m.src!=='logs')return{text:`Your targets average ${tg.toLocaleString()} kcal a day, ${Math.abs(gap)<50?'about the same as':Math.abs(Math.round(gap/10)*10).toLocaleString()+(gap<0?' below':' above')} the formula's estimate. A formula can be a few hundred out either way for one person, so go by your weight trend until this is worked out from your own log.`,
    tone:'info',target:tg,gap,perWeek:Math.round(perWeek*100)/100,at:false,formula:true};
  const margin=m.obs.margin;
  const at=Math.abs(gap)<=Math.max(margin,100);
  let text=at?`Your targets (${tg.toLocaleString()} kcal a day on average) are at maintenance, within the margin.`
    :`Hitting your targets (${tg.toLocaleString()} kcal a day on average) would ${perWeek<0?'take off':'add'} about ${Math.abs(perWeek).toFixed(1)} ${u} a week.`;
  let tone='info';
  if(dir==='lose'){
    if(at){tone='warn';text+=' That is too close to maintenance to count on losing weight.';}
    else if(gap>0){tone='warn';text+=' That will not take weight off: the target needs to sit below maintenance.';}
    else{tone='good';if(-perWeek>bwUser()*0.01)text+=' That is faster than 1% of body weight a week, which is hard to hold while training.';}
  }else if(dir==='gain'){
    if(at){tone='warn';text+=' That is too close to maintenance to count on gaining weight.';}
    else if(gap<0){tone='warn';text+=' That will not add weight: the target needs to sit above maintenance.';}
    else tone='good';
  }else if(dir==='maintain'){tone=at?'good':'warn';if(!at)text+=' To hold your weight, the target should be near maintenance.';}
  return{text,tone,target:tg,gap,perWeek:Math.round(perWeek*100)/100,at};
}
function maintenanceNeeds(o){
  const out=[];
  if(!o.weighOk)out.push(o.weighIns<MAINT_MIN_WEIGHINS?`Weigh-ins: ${o.weighIns} in the last four weeks. It takes at least ${MAINT_MIN_WEIGHINS}, two weeks or more apart.`
    :`Weigh-ins: your ${o.weighIns} are only ${o.span} days apart. It takes two weeks or more between the first and the last.`);
  if(!o.foodOk)out.push(`Food: logged on ${o.foodDays} of ${o.weighOk?'the '+o.ofDays+' days between your weigh-ins':'the last '+o.ofDays+' days'}. It takes at least ${o.needFood}.`);
  return out;
}
// What the formula estimate is made of, and which of its inputs were never given.
function formulaNoteHTML(){
  const gaps=profileGaps();let ex=0;for(let i=1;i<=7;i++)ex+=dayExerciseCals(daysAgoStr(i));ex=Math.round(ex/7);
  return`<div class="note-box" style="margin-top:12px"><b>The formula</b> is the Mifflin-St Jeor resting burn for ${profileLine()}: ${bmr().toLocaleString()} kcal. Times 1.2 for an ordinary day, plus ${ex.toLocaleString()} a day of logged exercise, that is ${maintenanceKcal(7).toLocaleString()}.
    Sex, age, height and weight all move it: at the same size and age it puts a man about 200 kcal a day above a woman, and each year of age takes off about 6.
    ${gaps.length?`<div class="maint-gap">It is running on defaults: ${gaps.map(g=>g.text).join('; ')}. <a onclick="closeOv('maint-ov');showSettings()">Set them in Settings</a></div>`:''}</div>`;
}
function showMaintenance(){
  const m=maintenanceBest(),o=m.obs,u=S.unit||'lbs';const v=maintenanceVerdict(m);
  const st=(val,l)=>`<div class="st"><div class="st-v">${val}</div><div class="st-l">${l}</div></div>`;
  const ov=makeOv('maint-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div class="mt" style="margin-bottom:4px">Maintenance</div>
    <div class="sheet-sub">The calories a day at which your weight holds steady.</div>
    <div class="maint-big">${m.kcal.toLocaleString()}<span> kcal a day${m.src==='logs'?`, give or take ${o.margin}`:''}</span></div>
    ${m.src==='logs'?`<div class="st-grid st-2" style="margin-top:12px">
        ${st(o.avgIntake.toLocaleString(),'kcal a day eaten, on average')}
        ${st(Math.abs(o.perWeek)<0.05?'Steady':(o.perWeek>0?'+':'−')+Math.abs(o.perWeek).toFixed(1)+' '+u,Math.abs(o.perWeek)<0.05?'weight over those days':'a week, weight trend')}
        ${st(o.foodDays,`days of food, of ${o.ofDays}`)}${st(o.weighIns,`weigh-ins over ${o.span} days`)}
      </div>
      <div class="fine">Worked out on this phone from your own log, ${fmtDay(o.from)} to ${fmtDay(o.to)}: what you ate on average, adjusted for what your weight did over the same days at ${kcalPerWeightUnit().toLocaleString()} kcal per ${isKg()?'kg':'lb'}. No formula and no AI. It is in the calories as you log them, so logging that runs consistently high or low cancels out.${o.dropped?` ${o.dropped} day${o.dropped===1?'':'s'} logged at under half your usual ${o.dropped===1?'was':'were'} left out as unfinished.`:''}${o.rough?' The margin is wide: more weigh-ins tighten it.':''}</div>
      <details class="fold"><summary>Compare with the formula</summary>${formulaNoteHTML()}</details>`
    :`${formulaNoteHTML()}
      <div class="note-box">With enough of your own data the app stops using the formula and works maintenance out from what you eat and what your weight does. Still needed:
        <ul class="maint-need">${maintenanceNeeds(o).map(t=>`<li>${t}</li>`).join('')}</ul></div>`}
    ${v?`<div class="list" style="margin-top:14px"><div class="row"><span class="row-ic tone-${v.tone}">${ICON(v.tone==='warn'?'alert':v.tone==='good'?'check':'target',17)}</span><span class="row-main"><span class="row-t">Your targets</span><span class="row-s">${v.text}</span></span></div>
      ${m.src==='logs'?`<div class="row"><span class="row-ic">${ICON('utensils',17)}</span><span class="row-main"><span class="row-t">What you actually eat</span><span class="row-s">You have averaged ${o.avgIntake.toLocaleString()} kcal a day, ${Math.abs(o.avgIntake-m.kcal)<=o.margin?'which is about maintenance':Math.abs(o.avgIntake-m.kcal).toLocaleString()+(o.avgIntake<m.kcal?' below':' above')+' maintenance'}${v.target&&Math.abs(o.avgIntake-v.target)>=100?`, and ${Math.abs(o.avgIntake-v.target).toLocaleString()} ${o.avgIntake<v.target?'under':'over'} your targets`:''}.</span></span></div>`:''}</div>`:''}
    <div class="sheet-acts"><button class="btn btg" onclick="closeOv('maint-ov')">Close</button><button class="btn bts" onclick="closeOv('maint-ov');showMacroGoals()">Change targets</button></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
// Weight goal and maintenance, as rows on the Nutrition tab.
function weightGoalCard(){
  const u=S.unit||'lbs';const m=maintenanceBest();const rows=[];
  if(S.weightGoal&&S.bodyweight){
    const cur=(S.bodyweightLog&&S.bodyweightLog[0]&&S.bodyweightLog[0].weight)||S.bodyweight;
    const goal=S.weightGoal;const diff=r1(cur-goal);const trend=weightTrend();
    const at=Math.abs(diff)<0.5;
    const title=at?`At your goal weight (${fmt1(cur)} ${u})`:`${fmt1(Math.abs(diff))} ${u} ${diff<0?'below':'above'} your goal of ${fmt1(goal)}`;
    let sub,tone='info';
    if(!trend)sub='Weigh in a few times a week to see which way it is moving.';
    else if(Math.abs(trend.perWeek)<0.1){sub=`Steady over the last ${trend.days} days.`;tone=at?'good':'info';}
    else{
      const toward=!at&&((diff<0&&trend.perWeek>0)||(diff>0&&trend.perWeek<0));
      const weeks=toward?Math.abs(diff)/Math.abs(trend.perWeek):0;
      sub=`${trend.perWeek>0?'Gaining':'Losing'} ${fmt1(Math.abs(trend.perWeek))} ${u} a week over ${trend.days} days`
        +(toward?(weeks<=52?`: about ${weeks<1.5?'a week':Math.round(weeks)+' weeks'} at this rate.`:'.'):at?'.':', which is away from your goal.');
      tone=toward?'good':at?'info':'bad';
    }
    rows.push(`<div class="row"><span class="row-ic tone-${tone}">${ICON(at?'target':diff<0?'arrowup':'arrowdown',17)}</span>
      <span class="row-main"><span class="row-t">${title}</span><span class="row-s">${sub}</span></span></div>`);
  }
  const v=maintenanceVerdict(m);
  rows.push(`<button class="row row-tap" id="maint-row" onclick="showMaintenance()"><span class="row-ic tone-${v&&m.src==='logs'?v.tone:'info'}">${ICON('scale',17)}</span>
    <span class="row-main"><span class="row-t">Maintenance ≈ ${m.kcal.toLocaleString()} kcal<span class="pill">${m.src==='logs'?'From your log':'Formula'}</span></span>
      <span class="row-s">${m.src==='logs'?(v?v.text:`You average ${m.obs.avgIntake.toLocaleString()} kcal a day.`)
        :profileGaps().length?`An estimate, and it is running on defaults: ${profileGaps().map(g=>g.text).join('; ')}. Tap to fix.`
        :'An estimate until there is enough of your own food and weight data. Tap to see what is missing.'}</span></span>
    <span class="row-chev">${ICON('chev',16)}</span></button>`);
  return`<div class="sec-h">Weight and maintenance</div><div class="list">${rows.join('')}</div>`;
}
// ─── Which day the tab is showing ───
// Today by default. Stepping back shows any earlier day with its meals, so a past day can be
// read and corrected; logging while a past day is showing logs to that day.
function nutDay(){const d=typeof window!=='undefined'&&S.tab==='nutrition'?window._nutDay:null;return d&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<today()?d:today();}
function setNutDay(ds){
  window._nutDay=ds&&ds<today()?ds:null;
  if(S.tab==='nutrition')renderNutrition(document.getElementById('content'));
}
function nutDayStep(n){setNutDay(addDays(nutDay(),n));}
function macroRowHTML(label,val,goal,color){
  const pct=goal>0?Math.min(100,Math.round(val/goal*100)):0;const left=r1(goal-val);
  return`<div class="mrow"><div class="mrow-t"><b>${label}</b><span>${fmt1(val)} / ${fmt1(goal)} g</span><i class="${left<0?'over':''}">${left>=0?fmt1(left)+' left':fmt1(-left)+' over'}</i></div>
    <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${pct}%;background:${color}"></div></div></div>`;
}
function renderNutrition(c){
  const td=today();const ds=nutDay();const isToday=ds===td;
  const ml=getDayTotals(ds);const g=goalsFor(ds)||{protein:150,carbs:200,fat:60,cals:2000};
  const dayMeals=(S.meals||[]).filter(m=>m.date===ds);
  const hasMacros=!!(ml.protein||ml.carbs||ml.fat||ml.cals);
  const rem=dayRemaining(ds);const kind=dayKind(ds);
  const dayLabel=isToday?'Today':ds===daysAgoStr(1)?'Yesterday':dayDate(ds).toLocaleDateString('en-US',{weekday:'long'});

  let html=`<div class="ph"><div class="page-title">Nutrition</div><button class="btn bts bsm" onclick="showMacroGoals()">Goals</button></div>
  <div class="nut-day">
    <button class="ib ib-q" onclick="nutDayStep(-1)" aria-label="Previous day">${ICON('chev',18).replace('<svg','<svg style="transform:rotate(180deg)"')}</button>
    <div class="nut-day-t"><b>${dayLabel}</b><span>${dayDate(ds).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div>
    <button class="ib ib-q" onclick="nutDayStep(1)" aria-label="Next day"${isToday?' disabled':''}>${ICON('chev',18)}</button>
  </div>`;

  // The day at a glance: what is left, then each macro against its target
  html+=`<div class="nut-hero">
    <div class="nut-top">
      <div><div class="nut-big${rem.over?' over':''}">${(rem.over||rem.cals).toLocaleString()}</div><div class="nut-sub">kcal ${rem.over?'over':'left'} · ${Math.round(ml.cals||0).toLocaleString()} eaten of ${Math.round(g.cals).toLocaleString()}</div></div>
      ${hasRestGoals()?`<button class="kind-chip${kind==='rest'?' rest':''}" onclick="toggleDayKind(${jsq(ds)})" aria-label="Switch between training day and rest day">${ICON(kind==='rest'?'moon':'dumbbell',14)} ${kind==='rest'?'Rest day':'Training day'}</button>`:''}
    </div>
    <div class="macro-bar-track nut-kbar"><div class="macro-bar-fill" style="width:${g.cals>0?Math.min(100,Math.round(ml.cals/g.cals*100)):0}%;background:${rem.over?'var(--red)':'var(--navy)'}"></div></div>
    ${macroRowHTML('Protein',ml.protein||0,g.protein,'var(--navy)')}
    ${macroRowHTML('Carbs',ml.carbs||0,g.carbs,'var(--gold)')}
    ${macroRowHTML('Fat',ml.fat||0,g.fat,'var(--red)')}
    ${!isToday?`<div class="nut-note">Showing ${fmtDay(ds)}. Anything you log now goes to this day. <a onclick="setNutDay(null)">Back to today</a></div>`:''}
  </div>`;

  html+=`<div class="qa qa-2">
    <button onclick="showBarcodeScanner()">${ICON('camera',19)}<span>Scan</span></button>
    <button onclick="showAddMeal()">${ICON('plus',19)}<span>Log meal</span></button>
  </div>`;

  // The day's meals, by meal. Tap one to change it; repeat logs the same again today.
  const copyFrom=daysWithMeals(ds,1)[0];
  const stored=S.macroLogs[ds];const parked=!!(stored&&stored.parked);
  if(dayMeals.length||ml.quick||parked){
    html+=`<div class="sec-h sec-h-act"><span>${isToday?'Today’s meals':'Meals'}</span>${copyFrom?`<a onclick="showCopyDay()">Copy from a day</a>`:''}</div>`;
    const typeOrder=['Breakfast','Lunch','Dinner','Pre-workout','Post-workout','Snack'];
    const grouped={};
    dayMeals.forEach(m=>{const t=m.type||m.name||'Other';const key=typeOrder.includes(t)?t:'Other';(grouped[key]=grouped[key]||[]).push(m);});
    [...typeOrder,'Other'].forEach(type=>{
      const meals=grouped[type];if(!meals||!meals.length)return;
      const sum=k=>meals.reduce((t,m)=>t+(parseFloat(m[k])||0),0);
      // A header with the meal's total only earns its line when there is more than one entry to add up.
      const solo=meals.length===1;
      html+=`<div class="list meal-group">${solo?'':`<div class="meal-head"><b>${type}</b><span>${Math.round(sum('cals'))} kcal · P ${fmt1(sum('protein'))} · C ${fmt1(sum('carbs'))} · F ${fmt1(sum('fat'))}</span></div>`}`;
      meals.forEach(m=>{
        const hasItems=m.items&&m.items.length;
        const title=m.savedMealName||(hasItems?m.items.map(itemLabel).join(', '):'Macros entered by hand');
        html+=`<div class="row row-tap" onclick="editMeal(${jsq(m.id)})" role="button">
          <span class="row-main">${solo?`<span class="meal-type">${type}</span>`:''}<span class="row-t">${esc(title)}</span>
            <span class="row-s">${m.savedMealName&&hasItems?esc(m.items.map(it=>it.name).join(', '))+' · ':''}P ${fmt1(m.protein)} · C ${fmt1(m.carbs)} · F ${fmt1(m.fat)}</span></span>
          <span class="meal-k">${Math.round(m.cals)||0}</span>
          <span class="meal-acts"><button class="ib ib-q" onclick="event.stopPropagation();repeatMeal(${jsq(m.id)})" aria-label="${isToday?'Log this meal again':'Log this meal again today'}">${ICON('repeat',16)}</button>
          <button class="ib ib-q" onclick="event.stopPropagation();deleteMeal(${jsq(m.id)})" aria-label="Delete meal">${ICON('x',15)}</button></span>
        </div>`;
      });
      html+=`</div>`;
    });
    // Day totals typed in without foods (the old Quick Log). Still counted, still editable here.
    if(ml.quick||parked){
      const q=ml.quick||{protein:parseFloat(stored.protein)||0,carbs:parseFloat(stored.carbs)||0,fat:parseFloat(stored.fat)||0,cals:parseFloat(stored.cals)||0};
      html+=`<div class="list meal-group"><button class="row row-tap" onclick="showLogMacros(${jsq(ds)})">
        <span class="row-main"><span class="row-t">Day totals entered by hand${parked?'<span class="pill">Not counted</span>':''}</span>
          <span class="row-s">${parked?'Entered before meals were logged that day. Tap to add them or drop them.':`P ${fmt1(q.protein)} · C ${fmt1(q.carbs)} · F ${fmt1(q.fat)} · added to the meals above`}</span></span>
        <span class="meal-k">${Math.round(q.cals)||0}</span><span class="row-chev">${ICON('chev',16)}</span></button></div>`;
    }
  }else{
    html+=`<div class="empty" style="padding:22px 24px 18px"><div class="etit">Nothing logged ${isToday?'yet today':'this day'}</div><p>Scan a barcode, log a meal, or tap a food below.</p>
      ${copyFrom?`<button class="btn bts bsm" style="margin-top:12px" onclick="showCopyDay()">${ICON('repeat',15)} Copy from ${copyFrom===addDays(ds,-1)?(isToday?'yesterday':'the day before'):fmtDay(copyFrom)}</button>`:''}</div>`;
  }

  // One tap to log again: starred foods, then recent foods and saved meals
  const tile=(js,name,sub)=>`<button class="food-tile" onclick="${js}"><b>${esc(name)}</b><span>${sub}</span></button>`;
  const starred=getStarredFoods();
  if(starred.length)html+=`<div class="sec-h">Starred</div><div class="tile-row">${starred.map(f=>tile(`quickLogFood(${jsq(f.id)})`,f.name,`${esc(f.serving)} · ${Math.round(f.cals||0)} kcal`)).join('')}</div>`;
  const recentMeals=(S.recentSavedMeals||[]).map(id=>(S.savedMeals||[]).find(x=>x.id===id)).filter(Boolean).slice(0,4);
  const recentFoods=getRecentFoods().filter(f=>!isStarred(f.id)).slice(0,10-recentMeals.length);
  if(recentMeals.length||recentFoods.length){
    html+=`<div class="sec-h">Recent</div><div class="tile-row">${recentMeals.map(x=>tile(`quickLogCombo(${jsq(x.id)})`,x.name,`${savedMealCals(x)} kcal · saved meal`)).join('')}${recentFoods.map(f=>tile(`quickLogFood(${jsq(f.id)})`,f.name,`${Math.round(f.cals||0)} kcal`)).join('')}</div>`;
  }

  // What fits: today only, and only once something is logged. Before the first meal the whole
  // day is open and "what fits" is everything; it starts to mean something as the day fills.
  if(isToday){
    if(hasMacros){
      const fit=whatFits(ds,3);
      if(fit.items.length)html+=`<div class="sec-h sec-h-act"><span>Fits what’s left</span><a onclick="showWhatFits()">More</a></div><div class="list">${fit.items.map(fitRowHTML).join('')}</div>`;
    }
    html+=mealPlanCardHTML();
  }

  if(isToday)html+=weightGoalCard();

  html+=weekStripHTML(ds);

  html+=suppBlockHTML();
  c.innerHTML=html;
}
// The last seven finished days as bars against each day's own target (the line). Tap a day to
// open it, including one with nothing logged, which is how a missed day gets filled in.
function weekStripHTML(sel){
  let any=false,h='';
  for(let i=7;i>=1;i--){
    const d=daysAgoStr(i);const tot=getDayTotals(d);const g=goalsFor(d)||{cals:0};const has=dayHasIntake(d);if(has)any=true;
    const ratio=g.cals>0?(tot.cals||0)/g.cals:0;const diff=Math.round((tot.cals||0)-g.cals);
    // The track is 125% of target tall, so the target line sits at 80% and a day well over still fits.
    const pct=has?Math.max(5,Math.min(100,Math.round(ratio/1.25*100))):0;
    const cls=!has?'':Math.abs(ratio-1)<=0.05?'on':ratio>1?'over':'under';
    h+=`<button class="nd-d${d===sel?' sel':''}" onclick="setNutDay(${jsq(d)})" aria-label="${fmtDay(d)}: ${has?`${(tot.cals||0).toLocaleString()} kcal, ${Math.abs(diff)} ${diff>=0?'over':'under'} target`:'nothing logged'}">
      <span class="nd-bar"><i class="${cls}" style="height:${pct}%"></i></span>
      <b>${dayDate(d).toLocaleDateString('en-US',{weekday:'narrow'})}</b><span>${has?fmtK(tot.cals):'–'}</span></button>`;
  }
  if(!any)return'';
  return`<div class="sec-h">Last seven days</div><div class="nd-strip">${h}</div>
    <div class="fine nd-key"><i class="on"></i>within 5% of target<i class="under"></i>under<i class="over"></i>over · the line is the target</div>`;
}
// Supplements: one row. It opens itself while something is still to be taken today, so ticking
// one off stays a single tap, and folds away once the day's are done.
function suppBlockHTML(){
  const td=today();const logs=S.suppLogs[td]||{};const n=S.supps.length;const done=S.supps.filter(s=>logs[s.id]).length;
  const open=window._suppOpen!=null?!!window._suppOpen:(n>0&&done<n);
  let h=`<div class="sec-h">Supplements</div><div class="list" id="supp-block">`;
  if(!n)return h+`<button class="row row-tap" onclick="showAddSupp()"><span class="row-ic">${ICON('pill',17)}</span><span class="row-main"><span class="row-t">Track a supplement</span><span class="row-s">Creatine, vitamin D, anything you take daily</span></span><span class="row-ic tone-info">${ICON('plus',16)}</span></button></div>`;
  let strip='';
  for(let i=6;i>=0;i--){const ds=daysAgoStr(i);const dl=S.suppLogs[ds]||{};const dc=S.supps.filter(s=>dl[s.id]).length;
    strip+=`<i class="${dc===n?'all':dc>0?'some':''}" title="${fmtDay(ds)}: ${dc} of ${n}"></i>`;}
  h+=`<div class="row row-tap" onclick="toggleSuppOpen()" role="button" aria-expanded="${open?'true':'false'}"><span class="row-ic tone-${done===n?'good':'info'}">${ICON(done===n?'check':'pill',17)}</span>
    <span class="row-main"><span class="row-t">${done===n?'All taken today':`${done} of ${n} taken today`}</span><span class="supp-strip" aria-label="Last seven days">${strip}</span></span>
    <button class="btn bts bsm" id="supp-add" onclick="event.stopPropagation();showAddSupp()">${ICON('plus',14)} Add</button>
    <span class="row-chev${open?' open':''}">${ICON('chev',16)}</span></div>`;
  if(open){
    S.supps.forEach(s=>{const on=!!logs[s.id];
      h+=`<div class="row"><span class="row-main"><span class="row-t">${esc(s.name)}</span>${s.dose||s.timing?`<span class="row-s">${esc(s.dose||'')}${s.dose&&s.timing?' · ':''}${esc(s.timing||'')}</span>`:''}</span>
        <button class="ib ib-q" onclick="delSupp(${jsq(s.id)})" aria-label="Remove ${esc(s.name)}">${ICON('x',15)}</button>
        <button class="tog${on?' on':''}" role="switch" aria-checked="${on?'true':'false'}" onclick="togSupp(${jsq(s.id)})" aria-label="${esc(s.name)} taken"></button></div>`;});
  }
  return h+`</div>`;
}
function toggleSuppOpen(){
  const el=document.getElementById('supp-block');const isOpen=!!(el&&el.querySelector('.tog'));
  window._suppOpen=!isOpen;renderNutrition(document.getElementById('content'));
}
function togSupp(id){const td=today();if(!S.suppLogs[td])S.suppLogs[td]={};S.suppLogs[td][id]=!S.suppLogs[td][id];window._suppOpen=null;save();renderNutrition(document.getElementById('content'));}
function delSupp(id){customConfirm('Remove this supplement?','Remove',()=>{S.supps=S.supps.filter(s=>s.id!==id);Object.keys(S.suppLogs).forEach(d=>{if(S.suppLogs[d])delete S.suppLogs[d][id];});save();renderNutrition(document.getElementById('content'));});}
// The Add button sits on the same line as the name: on a phone the keyboard covers the lower
// half of a sheet, and a button down there cannot be reached without first closing the keyboard.
// Return on the keyboard adds as well.
function showAddSupp(){
  const ov=makeOv('supp-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:12px">Add supplement</div>
    <label class="fl" for="sn">Name</label>
    <div class="supp-new"><input id="sn" type="text" maxlength="60" placeholder="e.g. Creatine, Fish Oil" autocomplete="off" enterkeyhint="done" onkeydown="if(event.key==='Enter'){event.preventDefault();addSupp();}">
      <button class="btn btp" id="supp-save" onclick="addSupp()">Add</button></div>
    <div class="fe-grid" style="margin-top:14px">
      <div><label class="fl" for="sd">Dose <small>optional</small></label><input id="sd" type="text" maxlength="40" placeholder="5 g, 2 capsules" autocomplete="off" enterkeyhint="done" onkeydown="if(event.key==='Enter'){event.preventDefault();addSupp();}"></div>
      <div><label class="fl" for="st">When <small>optional</small></label><select id="st"><option value="">Any time</option><option>Morning</option><option>Pre-workout</option><option>Post-workout</option><option>Evening</option><option>With food</option></select></div>
    </div>
    <button class="btn btg bfw" style="margin-top:10px" onclick="closeOv('supp-ov')">Cancel</button>
  </div>`;
  // A typed name is not thrown away by a stray tap outside the sheet.
  ov._keep=()=>!!(document.getElementById('sn')?.value||'').trim();
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function addSupp(){
  const name=String(document.getElementById('sn')?.value||'').trim().slice(0,60);
  if(!name){toast('Type the supplement’s name first');try{document.getElementById('sn').focus();}catch(e){}return;}
  if(!Array.isArray(S.supps))S.supps=[];
  S.supps.push({id:uid(),name,dose:String(document.getElementById('sd')?.value||'').trim().slice(0,40),timing:document.getElementById('st')?.value||''});
  window._suppOpen=true; // show the list, so the new one is on screen
  save();closeOv('supp-ov');
  if(S.tab==='nutrition')renderNutrition(document.getElementById('content'));
  toast(name+' added','green');
}
// Quick Log: one set of numbers per day, for when you know the totals but didn't log the food.
// It is ADDED to any meals logged that day, never a replacement for them.
function showLogMacros(ds){
  const date=ds||today();
  const ov=makeOv('macro-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:4px">Day totals</div>
    <div class="sheet-sub">Numbers for a day you did not log as food. They are added to that day's meals.</div>
    <div class="fg"><label class="fl">Date</label><input type="date" id="macro-date" value="${esc(date)}" max="${today()}" onchange="fillLogMacros()"></div>
    <div id="macro-meals-note"></div>
    <div class="fg"><label class="fl">Protein (g)</label><input type="number" inputmode="decimal" id="m-pro" placeholder="0"></div>
    <div class="fg"><label class="fl">Carbs (g)</label><input type="number" inputmode="decimal" id="m-carb" placeholder="0"></div>
    <div class="fg"><label class="fl">Fat (g)</label><input type="number" inputmode="decimal" id="m-fat" placeholder="0"></div>
    <div class="fg"><label class="fl">Calories <span style="font-size:12px;font-weight:500;color:var(--muted)">(auto if blank)</span></label><input type="number" inputmode="numeric" id="m-cal" placeholder="Auto"></div>
    <button class="btn btp bfw" onclick="saveMacros()">Save</button>
    <button class="btn bts bfw" id="macro-clear" style="margin-top:7px;display:none" onclick="clearMacros()">Clear this day's totals</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('macro-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  fillLogMacros();
}
function fillLogMacros(){
  const date=document.getElementById('macro-date')?.value||today();
  const log=S.macroLogs[date]||{};
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v?v:'';};
  set('m-pro',log.protein);set('m-carb',log.carbs);set('m-fat',log.fat);set('m-cal',log.cals);
  const tot=getDayTotals(date);
  const parked=!!log.parked;
  const note=document.getElementById('macro-meals-note');
  if(note){
    const mc=(S.meals||[]).filter(m=>m.date===date).reduce((t,m)=>t+(parseFloat(m.cals)||0),0);
    note.innerHTML=tot.mealCount?`<div style="font-size:12px;color:var(--muted);background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:12px">${tot.mealCount} meal${tot.mealCount===1?'':'s'} already logged this day (${Math.round(mc)} kcal). Enter only what's missing.</div>`:'';
    if(parked)note.innerHTML+=`<div style="font-size:12px;color:var(--gold);background:var(--gdim);border-radius:8px;padding:8px 10px;margin-bottom:12px">These numbers were entered before meals were logged that day and have not been counted in its total. Save to add them, or Clear to drop them.</div>`;
  }
  const clr=document.getElementById('macro-clear');if(clr)clr.style.display=(tot.quick||parked)?'':'none';
}
function clearMacros(){
  const date=document.getElementById('macro-date')?.value||today();
  delete S.macroLogs[date];
  save();closeOv('macro-ov');toast('Day totals cleared','green');renderNutrition(document.getElementById('content'));
}
function showRetroMacros(){showLogMacros();}
function saveMacros(){
  const date=document.getElementById('macro-date')?.value||today();
  if(date>today()){toast('That date is in the future');return;}
  const num=id=>Math.max(0,parseFloat(document.getElementById(id)?.value)||0);
  const p=num('m-pro'),carb=num('m-carb'),f=num('m-fat');
  const calTxt=document.getElementById('m-cal')?.value;
  const cals=calTxt?Math.max(0,parseFloat(calTxt)||0):Math.round(p*4+carb*4+f*9);
  if(!p&&!carb&&!f&&!cals)delete S.macroLogs[date];
  else S.macroLogs[date]={protein:p,carbs:carb,fat:f,cals};
  save();closeOv('macro-ov');toast('Saved','green');renderNutrition(document.getElementById('content'));
}
function showMacroGoals(){
  const g=S.macroGoals||{protein:150,carbs:200,fat:60,cals:2000};
  const curW=(S.bodyweightLog&&S.bodyweightLog[0]&&S.bodyweightLog[0].weight)||S.bodyweight||'';
  const ov=makeOv('mg-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Daily Goals</div>
    <div class="fg" style="margin-bottom:6px"><label class="fl">Protein (g)</label><input type="number" inputmode="decimal" id="mg-pro" value="${g.protein}" oninput="goalsCheck()"></div>
    <div class="fine" id="mg-pro-note" style="margin:0 2px 14px"></div>
    <div class="fg"><label class="fl">Carbs (g)</label><input type="number" inputmode="decimal" id="mg-carb" value="${g.carbs}" oninput="goalsCheck()"></div>
    <div class="fg"><label class="fl">Fat (g)</label><input type="number" inputmode="decimal" id="mg-fat" value="${g.fat}" oninput="goalsCheck()"></div>
    <div class="fg" style="margin-bottom:6px"><label class="fl">Calories</label><input type="number" inputmode="numeric" id="mg-cal" value="${g.cals}" oninput="goalsCheck()"></div>
    <div class="fine" id="mg-cal-note" style="margin:0 2px 10px"></div>
    ${(m=>`<div class="rate-row" role="group" aria-label="Set calories from maintenance">
        ${GOAL_RATES().map(r=>`<button class="chip" onclick="fillCalsFromRate(${r.perWeek})">${r.label}</button>`).join('')}</div>
      <div class="fine" style="margin:8px 2px 14px">Each fills calories from maintenance (about ${m.kcal.toLocaleString()} kcal a day${m.src==='logs'?`, give or take ${m.obs.margin}, from your own food log and weigh-ins`:', by formula'}) and moves carbs to match; protein and fat stay. <a onclick="closeOv('mg-ov');showMaintenance()">How maintenance is worked out</a></div>`)(maintenanceBest())}
    <div class="set-sec" style="margin-bottom:0">
      <div class="frow set-row"><span class="set-lbl">Different targets on rest days<br><small>The numbers above then apply on training days. A day counts as training when you train, or when your weekly schedule says so; you can flip any day on the Nutrition tab.</small></span>
        <button class="tog${hasRestGoals()?' on':''}" id="mg-rest-tog" role="switch" aria-checked="${hasRestGoals()?'true':'false'}" aria-label="Rest-day targets" onclick="toggleRestGoals()"></button></div>
      <div id="mg-rest" style="display:${hasRestGoals()?'block':'none'}">
        <div class="fe-grid">
          <div><label class="fl">Protein (g)</label><input type="number" inputmode="decimal" id="mr-pro" value="${hasRestGoals()?S.restGoals.protein:''}"></div>
          <div><label class="fl">Carbs (g)</label><input type="number" inputmode="decimal" id="mr-carb" value="${hasRestGoals()?S.restGoals.carbs:''}"></div>
          <div><label class="fl">Fat (g)</label><input type="number" inputmode="decimal" id="mr-fat" value="${hasRestGoals()?S.restGoals.fat:''}"></div>
          <div><label class="fl">Calories</label><input type="number" inputmode="numeric" id="mr-cal" value="${hasRestGoals()?S.restGoals.cals:''}"></div>
        </div>
        <button class="btn bts bsm" style="margin-top:8px" onclick="fillRestSuggestion()">Suggest from the training-day numbers</button>
        <div class="fine">The suggestion keeps protein and fat and takes about a quarter off carbs. It is a starting point, not a prescription.</div>
      </div>
    </div>
    <div style="border-top:1px solid var(--border);margin:14px -16px;padding:14px 16px 0">
      <div class="ct" style="margin-bottom:10px">Weight Goal</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
        <div class="fg" style="margin-bottom:0"><label class="fl">Target (${S.unit||'lbs'})</label><input type="number" inputmode="decimal" id="mg-wgoal" value="${S.weightGoal||''}" placeholder="e.g. 180"></div>
        <div class="fg" style="margin-bottom:0"><label class="fl">Current</label><input type="number" inputmode="decimal" id="mg-wcur" value="${curW}" data-orig="${curW}" placeholder="${curW||'185'}"></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="chip${S.weightGoalDir==='lose'?' on':''}" id="wgd-lose" onclick="selWeightDir('lose')">Lose</button>
        <button class="chip${S.weightGoalDir==='maintain'?' on':''}" id="wgd-maintain" onclick="selWeightDir('maintain')">Maintain</button>
        <button class="chip${S.weightGoalDir==='gain'?' on':''}" id="wgd-gain" onclick="selWeightDir('gain')">Gain</button>
      </div>
    </div>
    <button class="btn btp bfw" style="margin-top:14px" onclick="saveMacroGoals()">Save Goals</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('mg-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  window._wgDir=S.weightGoalDir||null;
  goalsCheck();
}
// Rates of change offered in Goals, in the user's unit. A pound a week is 500 kcal a day.
function GOAL_RATES(){
  return isKg()?[{perWeek:-0.5,label:'−0.5 kg/wk'},{perWeek:-0.25,label:'−0.25 kg/wk'},{perWeek:0,label:'Maintain'},{perWeek:0.25,label:'+0.25 kg/wk'}]
    :[{perWeek:-1,label:'−1 lb/wk'},{perWeek:-0.5,label:'−½ lb/wk'},{perWeek:0,label:'Maintain'},{perWeek:0.5,label:'+½ lb/wk'}];
}
// Calories for a rate of weight change: maintenance plus what the change takes, never below the floor.
function calsForRate(perWeek){
  const want=Math.round((maintenanceBest().kcal+perWeek*kcalPerWeightUnit()/7)/10)*10;
  return{cals:Math.max(calorieFloor(),want),want,floored:want<calorieFloor()};
}
function fillCalsFromRate(perWeek){
  const r=calsForRate(perWeek);
  const gv=id=>Math.max(0,parseFloat(document.getElementById(id)?.value)||0);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  set('mg-cal',r.cals);
  // Carbs take up the difference, in steps of 5 g.
  set('mg-carb',Math.max(0,Math.round((r.cals-gv('mg-pro')*4-gv('mg-fat')*9)/4/5)*5));
  goalsCheck();
  if(r.floored)toast(`That rate would need ${r.want.toLocaleString()} kcal. ${calorieFloor().toLocaleString()} is the lowest the app sets for a ${isFemale()?'woman':'man'}.`);
}
// Live notes under the fields: protein against body weight, and whether the macros and the
// calories agree. Notes, not blocks: the numbers are the user's to set.
function goalsCheck(){
  const gv=id=>Math.max(0,parseFloat(document.getElementById(id)?.value)||0);
  const p=gv('mg-pro'),c=gv('mg-carb'),f=gv('mg-fat'),k=gv('mg-cal');
  const pn=document.getElementById('mg-pro-note'),cn=document.getElementById('mg-cal-note');
  const out={proteinPer:0,fromMacros:Math.round(p*4+c*4+f*9),mismatch:false,low:false};
  const per=isKg()?p/bwKg():p/bwLb();out.proteinPer=Math.round(per*100)/100;
  const u=isKg()?'kg':'lb',lo=isKg()?1.6:0.7,hi=isKg()?2.2:1.0;
  if(pn){pn.textContent=p?`${per.toFixed(2)} g per ${u} of body weight. ${per<lo?`${lo} is the usual minimum when lifting (${Math.ceil(lo*(isKg()?bwKg():bwLb()))} g for you).`:per>hi*1.25?`More than ${hi} adds little.`:`${lo} to ${hi} suits most lifters.`}`:'';pn.style.color=p&&per<lo?'var(--gold)':'';}
  out.mismatch=k>0&&out.fromMacros>0&&Math.abs(out.fromMacros-k)>k*0.08;out.low=k>0&&k<calorieFloor();
  if(cn){
    cn.textContent=out.low?`Below ${calorieFloor().toLocaleString()}, the usual floor for a ${isFemale()?'woman':'man'}. Going lower is a decision to make with a doctor.`
      :out.mismatch?`Protein, carbs and fat add up to ${out.fromMacros.toLocaleString()} kcal, not ${Math.round(k).toLocaleString()}. Change one so the two agree.`
      :out.fromMacros?`Protein, carbs and fat add up to ${out.fromMacros.toLocaleString()} kcal.`:'';
    cn.style.color=out.low?'var(--red)':out.mismatch?'var(--gold)':'';
  }
  return out;
}
function toggleRestGoals(){
  const tog=document.getElementById('mg-rest-tog'),box=document.getElementById('mg-rest');if(!tog||!box)return;
  const on=!tog.classList.contains('on');
  tog.classList.toggle('on',on);tog.setAttribute('aria-checked',on?'true':'false');box.style.display=on?'block':'none';
  if(on&&!document.getElementById('mr-cal').value)fillRestSuggestion();
}
// Reads the training-day fields as they stand in the sheet, so the suggestion follows what was just typed.
function fillRestSuggestion(){
  const gv=(id,d)=>{const v=parseFloat(document.getElementById(id)?.value);return v>0?v:d;};
  const base={protein:gv('mg-pro',150),carbs:gv('mg-carb',200),fat:gv('mg-fat',60),cals:Math.round(gv('mg-cal',2000))};
  const r=suggestRestGoals(base);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  set('mr-pro',r.protein);set('mr-carb',r.carbs);set('mr-fat',r.fat);set('mr-cal',r.cals);
}
function selWeightDir(d){
  window._wgDir=d;
  ['lose','maintain','gain'].forEach(x=>document.getElementById('wgd-'+x)?.classList.toggle('on',x===d));
}
function saveMacroGoals(){
  const gv=(id,d)=>{const v=parseFloat(document.getElementById(id)?.value);return v>0?v:d;};
  S.macroGoals={protein:gv('mg-pro',150),carbs:gv('mg-carb',200),fat:gv('mg-fat',60),cals:Math.round(gv('mg-cal',2000))};
  const restOn=document.getElementById('mg-rest-tog')?.classList.contains('on');
  S.restGoals=restOn?normalizeRestGoals({protein:gv('mr-pro',S.macroGoals.protein),carbs:gv('mr-carb',S.macroGoals.carbs),fat:gv('mr-fat',S.macroGoals.fat),cals:gv('mr-cal',S.macroGoals.cals)}):null;
  const wgoal=parseFloat(document.getElementById('mg-wgoal')?.value);
  const wcur=parseFloat(document.getElementById('mg-wcur')?.value);
  S.weightGoal=wgoal>0?wgoal:null;
  S.weightGoalDir=window._wgDir||null;
  if(wcur>0&&wcur!==parseFloat(document.getElementById('mg-wcur')?.dataset.orig))logBodyweight(wcur);
  save();closeOv('mg-ov');toast('Goals updated','green');renderNutrition(document.getElementById('content'));
}
