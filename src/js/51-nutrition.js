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
// Estimated maintenance: sedentary baseline plus the exercise actually logged over the same days.
function maintenanceKcal(n){
  n=n||7;let ex=0;
  for(let i=1;i<=n;i++)ex+=dayExerciseCals(daysAgoStr(i));
  return baselineBurn()+Math.round(ex/n);
}
function weightGoalCard(){
  if(!S.weightGoal||!S.bodyweight)return '';
  const cur=(S.bodyweightLog&&S.bodyweightLog[0]&&S.bodyweightLog[0].weight)||S.bodyweight;
  const goal=S.weightGoal;const dir=S.weightGoalDir;
  const diff=r1(cur-goal);const u=S.unit||'lbs';
  const trend=weightTrend();
  const tdee=maintenanceKcal(7);
  const avgIn=avgDailyIntake(7);
  let headline,sub,color,icon,bg,border;
  // Determine if eating more or less is needed
  if(Math.abs(diff)<0.5){
    headline=`At your goal weight (${fmt1(cur)} ${u})`;
    sub=avgIn?`Maintenance ≈ ${tdee} kcal/day. You're averaging ${avgIn}.`:`Maintenance ≈ ${tdee} kcal/day.`;
    color='var(--green)';icon='target';bg='var(--grdim)';border='rgba(45,122,82,.2)';
  }else if(cur<goal){
    // Below goal — need to gain (eat more)
    headline=`${fmt1(Math.abs(diff))} ${u} below your goal`;
    const surplus=avgIn?(avgIn-tdee):null;
    if(surplus!=null){
      if(surplus>0)sub=`Eat more to reach ${fmt1(goal)} ${u}. You're at +${surplus} kcal/day over maintenance — on the right track.`;
      else sub=`Eat more to reach ${fmt1(goal)} ${u}. You're ${Math.abs(surplus)} kcal/day under maintenance (${tdee}), which moves you away from your goal.`;
    }else sub=`Eat above ${tdee} kcal/day to gain toward ${fmt1(goal)} ${u}.`;
    color='var(--gold)';icon='arrowup';bg='var(--gdim)';border='rgba(184,124,42,.28)';
  }else{
    // Above goal — need to lose (eat less)
    headline=`${fmt1(Math.abs(diff))} ${u} above your goal`;
    const deficit=avgIn?(tdee-avgIn):null;
    if(deficit!=null){
      if(deficit>0)sub=`Eat less to reach ${fmt1(goal)} ${u}. You're at −${deficit} kcal/day under maintenance — on the right track.`;
      else sub=`Eat less to reach ${fmt1(goal)} ${u}. You're ${Math.abs(deficit)} kcal/day over maintenance (${tdee}), which moves you away from your goal.`;
    }else sub=`Eat below ${tdee} kcal/day to lose toward ${fmt1(goal)} ${u}.`;
    color='var(--navy)';icon='arrowdown';bg='var(--ndim)';border='var(--nbright)';
  }
  // Trend line
  let trendLine='';
  if(trend&&Math.abs(trend.perWeek)>=0.1){
    const movingToward=(cur<goal&&trend.perWeek>0)||(cur>goal&&trend.perWeek<0)||(Math.abs(diff)<0.5&&Math.abs(trend.perWeek)<0.3);
    const arrow=trend.perWeek>0?'gaining':'losing';
    trendLine=`<div style="font-size:12px;color:var(--muted);margin-top:4px">Trend: ${arrow} ${fmt1(Math.abs(trend.perWeek))} ${u}/week over ${trend.days}d · ${movingToward?'<span style="color:var(--green);font-weight:600">moving toward goal</span>':'<span style="color:var(--red);font-weight:600">moving away from goal</span>'}</div>`;
  }else if(trend){
    trendLine=`<div style="font-size:12px;color:var(--muted);margin-top:4px">Weight stable over ${trend.days}d. Adjust intake to drive change.</div>`;
  }else{
    trendLine=`<div style="font-size:12px;color:var(--muted);margin-top:4px">Log your weight regularly to track progress.</div>`;
  }
  const tone=color.includes('green')?'good':color.includes('gold')?'warn':'info';
  return`<div class="list" style="margin-top:12px"><div class="row"><span class="row-ic tone-${tone}">${ICON(icon,17)}</span>
    <span class="row-main"><span class="row-t">${headline}</span><span class="row-s">${sub}</span>${trendLine}</span></div></div>`;
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
  const ml=getDayTotals(ds);const u=isKg()?'kg':'lb';const g=goalsFor(ds)||{protein:150,carbs:200,fat:60,cals:2000};
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
    ${ml.quick&&ml.fromMeals?`<div class="nut-note">Includes a Quick Log of ${Math.round(ml.quick.cals)} kcal on top of ${ml.mealCount} meal${ml.mealCount===1?'':'s'}. <a onclick="showLogMacros(${jsq(ds)})">Edit</a></div>`:''}
    ${!isToday?`<div class="nut-note">Showing ${fmtDay(ds)}. Anything you log now goes to this day. <a onclick="setNutDay(null)">Back to today</a></div>`:''}
  </div>`;

  html+=`<div class="qa qa-3">
    <button onclick="showBarcodeScanner()">${ICON('camera',19)}<span>Scan</span></button>
    <button onclick="showAddMeal()">${ICON('plus',19)}<span>Log meal</span></button>
    <button onclick="showLogMacros(${jsq(ds)})">${ICON('clipboard',19)}<span>Quick log</span></button>
  </div>`;

  // What fits: only for today, and only when there is something left to fit
  if(isToday){
    const fit=whatFits(ds,3);
    if(fit.items.length)html+=`<div class="sec-h sec-h-act"><span>Fits what’s left</span><a onclick="showWhatFits()">More</a></div><div class="list">${fit.items.map(fitRowHTML).join('')}</div>`;
    html+=mealPlanCardHTML();
  }

  // Quick access: starred foods, then recent foods and saved meals
  const tile=(js,name,sub)=>`<button class="food-tile" onclick="${js}"><b>${esc(name)}</b><span>${sub}</span></button>`;
  const starred=getStarredFoods();
  if(starred.length)html+=`<div class="sec-h">Starred</div><div class="tile-row">${starred.map(f=>tile(`quickLogFood(${jsq(f.id)})`,f.name,`${esc(f.serving)} · ${Math.round(f.cals||0)} kcal`)).join('')}</div>`;
  const recentMeals=(S.recentSavedMeals||[]).map(id=>(S.savedMeals||[]).find(x=>x.id===id)).filter(Boolean).slice(0,4);
  const recentFoods=getRecentFoods().filter(f=>!isStarred(f.id)).slice(0,10-recentMeals.length);
  if(recentMeals.length||recentFoods.length){
    html+=`<div class="sec-h">Recent</div><div class="tile-row">${recentMeals.map(x=>tile(`quickLogCombo(${jsq(x.id)})`,x.name,`${savedMealCals(x)} kcal · saved meal`)).join('')}${recentFoods.map(f=>tile(`quickLogFood(${jsq(f.id)})`,f.name,`${Math.round(f.cals||0)} kcal`)).join('')}</div>`;
  }

  // The day's meals, by meal. Tap one to change it.
  if(dayMeals.length){
    html+=`<div class="sec-h">${isToday?'Today’s meals':'Meals'}</div>`;
    const typeOrder=['Breakfast','Lunch','Dinner','Pre-workout','Post-workout','Snack'];
    const grouped={};
    dayMeals.forEach(m=>{const t=m.type||m.name||'Other';const key=typeOrder.includes(t)?t:'Other';(grouped[key]=grouped[key]||[]).push(m);});
    [...typeOrder,'Other'].forEach(type=>{
      const meals=grouped[type];if(!meals||!meals.length)return;
      const sum=k=>meals.reduce((t,m)=>t+(parseFloat(m[k])||0),0);
      html+=`<div class="list meal-group"><div class="meal-head"><b>${type}</b><span>${Math.round(sum('cals'))} kcal · P ${fmt1(sum('protein'))} · C ${fmt1(sum('carbs'))} · F ${fmt1(sum('fat'))}</span></div>`;
      meals.forEach(m=>{
        const hasItems=m.items&&m.items.length;
        const title=m.savedMealName||(hasItems?m.items.map(it=>(it.qty!=1?fmt1(it.qty)+' × ':'')+it.name).join(', '):'Macros entered by hand');
        html+=`<div class="row row-tap" onclick="editMeal(${jsq(m.id)})" role="button">
          <span class="row-main"><span class="row-t">${esc(title)}</span>
            <span class="row-s">${m.savedMealName&&hasItems?esc(m.items.map(it=>it.name).join(', '))+' · ':''}P ${fmt1(m.protein)} · C ${fmt1(m.carbs)} · F ${fmt1(m.fat)}</span></span>
          <span class="meal-k">${Math.round(m.cals)||0}</span>
          <button class="ib ib-q" onclick="event.stopPropagation();deleteMeal(${jsq(m.id)})" aria-label="Delete meal">${ICON('x',15)}</button>
        </div>`;
      });
      html+=`</div>`;
    });
  }else if(!hasMacros){
    html+=`<div class="empty" style="padding:26px 24px"><div class="etit">Nothing logged ${isToday?'yet today':'this day'}</div><p>Scan a barcode, tap a starred food, or log a meal.</p></div>`;
  }

  // Protein against body weight, in the user's own unit (0.7 g/lb = 1.6 g/kg)
  const points=[];
  if(S.bodyweight&&g.protein&&isToday){
    const per=x=>isKg()?x/bwKg():x/bwLb();const minPer=isKg()?1.6:0.7;
    if(hasMacros){
      const ratio=per(ml.protein||0);const ok=ratio>=minPer;
      points.push({tone:ok?'good':'info',icon:ok?'check':'target',title:`${ratio.toFixed(2)} g protein per ${u} so far today`,
        sub:ok?`At or above the ${minPer} g/${u} minimum`:`${Math.max(0,Math.ceil(minPer*bwUser()-(ml.protein||0)))} g more reaches ${minPer} g/${u}`});
    }else points.push({tone:'info',icon:'target',title:`Protein goal: ${per(g.protein).toFixed(2)} g per ${u} of body weight`,sub:`${minPer} g/${u} is the minimum effective intake`});
  }
  if(points.length)html+=`<div class="list" style="margin-top:12px">${points.map(pointRowHTML).join('')}</div>`;

  // Weight goal insight
  html+=weightGoalCard();

  const recentDates=Array.from({length:7},(_,i)=>daysAgoStr(i+1)).filter(dayHasIntake);
  if(recentDates.length){
    html+=`<div class="sec-h">Recent days</div><div class="list">`;
    recentDates.slice(0,6).forEach(d=>{
      const tot=getDayTotals(d);const dg=goalsFor(d);const diff=Math.round(tot.cals-dg.cals);
      html+=`<button class="row row-tap${d===ds?' row-on':''}" onclick="setNutDay(${jsq(d)})"><span class="row-main"><span class="row-t">${fmtDay(d)}${hasRestGoals()?`<span class="pill">${dayKind(d)==='rest'?'Rest':'Training'}</span>`:''}</span>
        <span class="row-s">P ${fmt1(tot.protein||0)} · C ${fmt1(tot.carbs||0)} · F ${fmt1(tot.fat||0)}${tot.fromMeals?` · ${tot.mealCount} meal${tot.mealCount===1?'':'s'}`:''}${tot.quick?' · quick log':''}</span></span>
        <span class="aim"><span class="aim-v">${(tot.cals||0).toLocaleString()}</span><span class="dl dl-${Math.abs(diff)<=dg.cals*0.05?'good':'flat'}">${diff>=0?'+':'−'}${Math.abs(diff)} vs goal</span></span></button>`;
    });
    html+=`</div>`;
  }

  // Supplements
  const logs=S.suppLogs[td]||{};const done=S.supps.filter(s=>logs[s.id]).length;
  html+=`<div style="margin-top:6px;padding:14px 16px 6px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border)">
    <div style="font-size:16px;font-weight:600;letter-spacing:-.01em">Supplements</div>
    <div style="display:flex;align-items:center;gap:9px">
      <div style="font-size:12px;font-weight:600;color:${done===S.supps.length&&S.supps.length>0?'var(--green)':'var(--muted)'}">${done}/${S.supps.length}</div>
      <button class="btn btp bsm" onclick="showAddSupp()">+ Add</button>
    </div>
  </div>`;
  if(!S.supps.length){html+=`<div class="empty" style="padding:24px 20px"><div style="margin-bottom:9px;color:var(--muted2)">${ICON('pill',30)}</div><div class="etit">No supplements</div><p style="font-size:12px">Track your stack</p></div>`;}
  else{
    html+=`<div class="card">`;
    S.supps.forEach(s=>{const on=!!logs[s.id];html+=`<div class="sui"><div style="flex:1"><div style="font-size:14px;font-weight:500">${esc(s.name)}</div><div style="font-size:12px;color:var(--muted);margin-top:1px">${esc(s.dose||'')}${s.timing?` · ${esc(s.timing)}`:''}</div></div><button class="ib delbtn" style="margin-right:9px" onclick="delSupp(${jsq(s.id)})" aria-label="Remove supplement">✕</button><button class="tog${on?' on':''}" onclick="togSupp(${jsq(s.id)})" aria-label="Taken"></button></div>`;});
    html+=`</div>`;
    html+=`<div class="sec-lbl">7-Day Compliance</div><div class="card"><div class="cb" style="display:flex;gap:5px">`;
    for(let i=6;i>=0;i--){const ds=daysAgoStr(i);const d=dayDate(ds);const dl=S.suppLogs[ds]||{};const dc=S.supps.filter(s=>dl[s.id]).length;const pct=S.supps.length?Math.round((dc/S.supps.length)*100):0;const col=pct===100?'var(--green)':pct>50?'var(--gold)':pct>0?'var(--navy)':'var(--border)';html+=`<div style="flex:1;text-align:center"><div style="width:100%;aspect-ratio:1;border-radius:5px;background:${col};margin-bottom:3px"></div><div style="font-size:12px;color:var(--muted);font-weight:500">${d.toLocaleDateString('en-US',{weekday:'narrow'})}</div></div>`;}
    html+=`</div></div>`;
  }
  c.innerHTML=html;
}
function togSupp(id){const td=today();if(!S.suppLogs[td])S.suppLogs[td]={};S.suppLogs[td][id]=!S.suppLogs[td][id];save();renderNutrition(document.getElementById('content'));}
function delSupp(id){customConfirm('Remove this supplement?','Remove',()=>{S.supps=S.supps.filter(s=>s.id!==id);Object.keys(S.suppLogs).forEach(d=>{if(S.suppLogs[d])delete S.suppLogs[d][id];});save();renderNutrition(document.getElementById('content'));});}
function showAddSupp(){
  const ov=makeOv('supp-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Add Supplement</div>
    <div class="fg"><label class="fl">Name</label><input id="sn" type="text" placeholder="e.g. Creatine, Fish Oil"></div>
    <div class="fg"><label class="fl">Dose</label><input id="sd" type="text" placeholder="e.g. 5g, 2 capsules"></div>
    <div class="fg"><label class="fl">Timing</label><select id="st"><option value="">Any time</option><option>Morning</option><option>Pre-workout</option><option>Post-workout</option><option>Evening</option><option>With food</option></select></div>
    <button class="btn btp bfw" onclick="addSupp()">Add</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('supp-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function addSupp(){const name=document.getElementById('sn')?.value?.trim();if(!name){toast('Enter a name');return;}S.supps.push({id:uid(),name,dose:(document.getElementById('sd')?.value||'').trim(),timing:document.getElementById('st')?.value||''});save();closeOv('supp-ov');renderNutrition(document.getElementById('content'));toast('Added','green');}
// Quick Log: one set of numbers per day, for when you know the totals but didn't log the food.
// It is ADDED to any meals logged that day, never a replacement for them.
function showLogMacros(ds){
  const date=ds||today();
  const ov=makeOv('macro-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Quick Log</div>
    <div style="font-size:12px;color:var(--muted);margin:-6px 0 12px;line-height:1.45">Totals you didn't log as food. These are added to that day's meals.</div>
    <div class="fg"><label class="fl">Date</label><input type="date" id="macro-date" value="${esc(date)}" max="${today()}" onchange="fillLogMacros()"></div>
    <div id="macro-meals-note"></div>
    <div class="fg"><label class="fl">Protein (g)</label><input type="number" inputmode="decimal" id="m-pro" placeholder="0"></div>
    <div class="fg"><label class="fl">Carbs (g)</label><input type="number" inputmode="decimal" id="m-carb" placeholder="0"></div>
    <div class="fg"><label class="fl">Fat (g)</label><input type="number" inputmode="decimal" id="m-fat" placeholder="0"></div>
    <div class="fg"><label class="fl">Calories <span style="font-size:12px;font-weight:500;color:var(--muted)">(auto if blank)</span></label><input type="number" inputmode="numeric" id="m-cal" placeholder="Auto"></div>
    <button class="btn btp bfw" onclick="saveMacros()">Save</button>
    <button class="btn bts bfw" id="macro-clear" style="margin-top:7px;display:none" onclick="clearMacros()">Clear this day's Quick Log</button>
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
  save();closeOv('macro-ov');toast('Quick Log cleared','green');renderNutrition(document.getElementById('content'));
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
    <div class="fg"><label class="fl">Protein (g)</label><input type="number" inputmode="decimal" id="mg-pro" value="${g.protein}"></div>
    <div class="fg"><label class="fl">Carbs (g)</label><input type="number" inputmode="decimal" id="mg-carb" value="${g.carbs}"></div>
    <div class="fg"><label class="fl">Fat (g)</label><input type="number" inputmode="decimal" id="mg-fat" value="${g.fat}"></div>
    <div class="fg"><label class="fl">Calories</label><input type="number" inputmode="numeric" id="mg-cal" value="${g.cals}"></div>
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
