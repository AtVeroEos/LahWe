// ═══════════════════════════════════════════════════
// FOODS — your own foods, day targets, "what fits", quick logging
// ═══════════════════════════════════════════════════

// ─── Small shared pieces ───
function macroTilesHTML(m){
  const t=(v,l)=>`<div class="st"><div class="st-v">${v}</div><div class="st-l">${l}</div></div>`;
  return t(Math.round(m.cals||0),'kcal')+t(fmt1(m.protein||0)+' g','Protein')+t(fmt1(m.carbs||0)+' g','Carbs')+t(fmt1(m.fat||0)+' g','Fat');
}
// The meal a new entry most likely belongs to, from the clock. Saves a decision, never forces one.
function likelyMealType(){
  const h=new Date().getHours()+new Date().getMinutes()/60;
  return h<10.5?'Breakfast':h<14.5?'Lunch':h<17?'Snack':h<21.5?'Dinner':'Snack';
}
function isCustomFood(id){return(S.customFoods||[]).some(f=>f.id===id);}

// ─── Training days and rest days ───
// One set of targets by default. Switch on rest-day targets (Goals) and each day uses one set or
// the other: your own choice for that day if you made one, then whether you trained, then the plan.
function hasRestGoals(){return isObj(S.restGoals)&&S.restGoals.cals>0;}
function dayKind(ds){
  ds=ds||today();
  const own=isObj(S.dayKind)?S.dayKind[ds]:null;
  if(own==='train'||own==='rest')return own;
  if(S.workouts.some(w=>dayOf(w.started)===ds)||(ds===today()&&S.activeWorkout))return'train';
  if(hasFixedSchedule())return isTrainingDay(ds)?'train':'rest';
  // No fixed days: a past day without a workout was a rest day; today is assumed to be a training day until you say otherwise.
  return ds<today()?'rest':'train';
}
function goalsFor(ds){
  ds=ds||today();
  const g=S.macroGoals;
  return hasRestGoals()&&dayKind(ds)==='rest'?{protein:S.restGoals.protein,carbs:S.restGoals.carbs,fat:S.restGoals.fat,cals:S.restGoals.cals}:g;
}
// For a weekday in the meal plan: only a fixed weekly schedule can say what kind of day it will be.
function goalsForDow(dow){
  if(!hasRestGoals()||!hasFixedSchedule())return S.macroGoals;
  return plannedRoutinesForDow(dow).length?S.macroGoals:{protein:S.restGoals.protein,carbs:S.restGoals.carbs,fat:S.restGoals.fat,cals:S.restGoals.cals};
}
function setDayKind(ds,kind){
  if(!isObj(S.dayKind))S.dayKind={};
  if(kind==='train'||kind==='rest')S.dayKind[ds]=kind;else delete S.dayKind[ds];
  // If the choice matches what the app would have picked anyway, there is nothing to remember.
  const picked=S.dayKind[ds];delete S.dayKind[ds];
  if(picked&&dayKind(ds)!==picked)S.dayKind[ds]=picked;
  save();
}
function toggleDayKind(ds){
  ds=ds||nutDay();
  setDayKind(ds,dayKind(ds)==='rest'?'train':'rest');
  if(S.tab==='nutrition')renderNutrition(document.getElementById('content'));
}
// Average targets over the days in a range that have food logged (what the eating is judged against).
function avgGoals(fromDs,toDs){
  let n=0,p=0,k=0;
  for(let ds=fromDs;ds<=toDs;ds=addDays(ds,1)){const t=getDayTotals(ds);if(t.cals>0||t.protein>0){const g=goalsFor(ds);n++;p+=g.protein||0;k+=g.cals||0;}}
  return n?{protein:Math.round(p/n),cals:Math.round(k/n),days:n}:{protein:(S.macroGoals||{}).protein||0,cals:(S.macroGoals||{}).cals||0,days:0};
}
// A starting point for rest-day targets: same protein and fat, about a quarter fewer carbs.
function suggestRestGoals(g){
  g=g||S.macroGoals;
  const carbs=Math.round((g.carbs||0)*0.75/5)*5;
  return{protein:g.protein,carbs,fat:g.fat,cals:Math.max(0,Math.round((g.cals-(g.carbs-carbs)*4)/10)*10)};
}
function normalizeRestGoals(v){
  if(!isObj(v))return null;
  const n=x=>{const y=parseFloat(x);return y>0?y:0;};
  const g={protein:n(v.protein),carbs:n(v.carbs),fat:n(v.fat),cals:Math.round(n(v.cals))};
  return g.cals>0?g:null;
}
function normalizeDayKind(v){
  const out={};if(!isObj(v))return out;
  const floor=daysAgoStr(400);
  Object.keys(v).forEach(ds=>{if(/^\d{4}-\d{2}-\d{2}$/.test(ds)&&ds>=floor&&(v[ds]==='train'||v[ds]==='rest'))out[ds]=v[ds];});
  return out;
}
// What is left of a day's targets (never negative), and by how much the day is over on calories.
function dayRemaining(ds){
  ds=ds||today();
  const g=goalsFor(ds),t=getDayTotals(ds);const left=k=>Math.max(0,r1((g[k]||0)-(t[k]||0)));
  return{cals:Math.max(0,Math.round((g.cals||0)-(t.cals||0))),protein:left('protein'),carbs:left('carbs'),fat:left('fat'),over:Math.max(0,Math.round((t.cals||0)-(g.cals||0))),goals:g,eaten:t};
}

// ─── What fits ───
// Foods that close what is left of today, picked from what you actually eat. No AI: the list is
// your logged, starred and recent foods and saved meals, each at the amount that best closes the
// protein gap without going over on calories.
function foodUsage(){
  return memo('foodUsage',()=>{
    const u={};const floor=daysAgoStr(90);
    (S.meals||[]).forEach(m=>{if(m.date<floor)return;(m.items||[]).forEach(it=>{if(it.foodId)u[it.foodId]=(u[it.foodId]||0)+1;});});
    return u;
  });
}
function fitPool(){
  const use=foodUsage();const ids=new Set(Object.keys(use));
  (S.starredFoods||[]).forEach(id=>ids.add(id));(S.recentFoods||[]).forEach(id=>ids.add(id));
  const pool=[...ids].map(findFood).filter(Boolean).map(f=>({kind:'food',id:f.id,name:f.name,serving:f.serving,protein:+f.protein||0,carbs:+f.carbs||0,fat:+f.fat||0,cals:+f.cals||0,used:use[f.id]||0,star:isStarred(f.id)}));
  (S.savedMeals||[]).forEach(c=>{
    let p=0,cb=0,ft=0,k=0;(c.items||[]).forEach(it=>{const t=mealItemTotals(it);p+=t.protein;cb+=t.carbs;ft+=t.fat;k+=t.cals;});
    if(k>0)pool.push({kind:'meal',id:c.id,name:c.name,serving:`${c.items.length} items`,protein:p,carbs:cb,fat:ft,cals:k,used:(S.recentSavedMeals||[]).includes(c.id)?2:0,star:false,fixed:true});
  });
  // Someone with almost no history still gets something useful: lean staples from the built-in list.
  if(pool.filter(x=>x.kind==='food').length<5){
    QUICK_FOODS.filter(f=>f.cals>0&&f.protein*4/f.cals>=0.45&&!ids.has(f.id)).sort((a,b)=>b.protein/b.cals-a.protein/a.cals).slice(0,8)
      .forEach(f=>pool.push({kind:'food',id:f.id,name:f.name,serving:f.serving,protein:f.protein,carbs:f.carbs,fat:f.fat,cals:f.cals,used:0,star:false,builtin:true}));
  }
  return pool.filter(x=>x.cals>0);
}
// How much of what is left one sitting should try to cover. With a whole dinner still to come,
// "close the entire gap with three scoops of whey" is not advice anyone follows.
const FIT_SITTING={protein:50,cals:800,maxServings:2};
function whatFits(ds,limit){
  ds=ds||today();const r=dayRemaining(ds);
  if(r.cals<80)return{left:r,items:[],why:r.over?'over':'done'};
  const needP=r.protein>5;
  const tp=Math.min(r.protein,FIT_SITTING.protein),tk=Math.min(r.cals,FIT_SITTING.cals); // this sitting's share
  const out=[];
  fitPool().forEach(f=>{
    let best=null;
    (f.fixed?[1]:[0.5,1,1.5,2].filter(q=>q<=FIT_SITTING.maxServings)).forEach(q=>{
      const m={cals:f.cals*q,protein:f.protein*q,carbs:f.carbs*q,fat:f.fat*q};
      if(m.cals>r.cals*1.05+15)return; // never suggest going over for the day
      // Lower is better: protein short of this sitting's share, calories beyond it, and carbs or
      // fat pushed past what the day has left.
      let s=needP?Math.max(0,tp-m.protein)/Math.max(tp,10):Math.abs(tk-m.cals)/tk*0.6;
      s+=Math.max(0,m.cals-tk)/tk;
      s+=(Math.max(0,m.carbs-r.carbs)+2*Math.max(0,m.fat-r.fat))/60;
      // Protein per calorie matters when protein is what is missing: the day's remaining calories have to carry it.
      if(needP&&m.cals>0)s+=Math.max(0,(r.protein*4/r.cals)-(m.protein*4/m.cals))*0.5;
      if(!best||s<best.s-1e-9)best={q,s,m};
    });
    if(!best)return;
    if(needP&&best.m.protein<Math.max(6,tp*0.2))return; // would barely touch the gap
    // What you eat most, and what you starred, wins a close call.
    const pref=Math.min(0.25,0.06*Math.log2(1+f.used))+(f.star?0.08:0)-(f.builtin?0.05:0);
    out.push({kind:f.kind,id:f.id,name:f.name,serving:f.serving,qty:best.q,score:Math.round((best.s-pref)*1000)/1000,
      cals:Math.round(best.m.cals),protein:r1(best.m.protein),carbs:r1(best.m.carbs),fat:r1(best.m.fat),used:f.used});
  });
  out.sort((a,b)=>a.score-b.score||b.used-a.used||a.name.localeCompare(b.name));
  return{left:r,items:out.slice(0,limit||5),why:out.length?'':'nothing'};
}
function fitRowHTML(x){
  const js=x.kind==='meal'?`quickLogCombo(${jsq(x.id)})`:`quickLogFood(${jsq(x.id)},${x.qty})`;
  return`<button class="row row-tap" onclick="${js}"><span class="row-main"><span class="row-t">${esc(x.name)}${x.kind==='meal'?'<span class="pill">Saved meal</span>':''}</span>
    <span class="row-s">${x.kind==='meal'?esc(x.serving):`${fmtAmt(x.qty)} × ${esc(x.serving)}`}</span></span>
    <span class="aim"><span class="aim-v">${fmt1(x.protein)} g protein</span><span class="aim-f">${x.cals} kcal</span></span></button>`;
}
function showWhatFits(){
  const f=whatFits(nutDay(),14);
  const ov=makeOv('fit-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div><div class="mt" style="margin-bottom:4px">Fits what’s left</div>
    <div class="sheet-sub">${f.left.cals.toLocaleString()} kcal and ${fmt1(f.left.protein)} g protein to go. These are foods you log, star or saved as meals, in a normal portion, ordered by how much of the protein gap each closes for its calories. Nothing here takes you over for the day.</div>
    ${f.items.length?`<div class="list">${f.items.map(fitRowHTML).join('')}</div>`:`<div class="chat-empty">${f.why==='nothing'?'Nothing in your foods fits what is left.':'Nothing left to fit today.'}</div>`}
    <button class="btn btg bfw" onclick="closeOv('fit-ov')">Close</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}

// ─── One amount control: servings, grams or ounces ───
// Shared by the quick-log sheet and the scan sheet (one is open at a time; `pre` is the id prefix).
// st = { per       numbers for one serving
//        per100    numbers per 100 g when a label gives them (the exact basis for a weight), else null
//        sg        grams in one serving, 0 when unknown
//        serving   what one serving is, in words
//        noServ    true when there is no serving at all, only per-100 g numbers
//        unit,val  the amount, exactly, in 'serv' | 'g' | 'oz'
//        onPaint   optional: called with the totals each time they change }
const _amt={};
function amtCanWeigh(st){return st.sg>0||!!st.per100;}
function amtShown(v,u){return u==='g'?(v>=100?Math.round(v):Math.round(v*10)/10):Math.round(v*100)/100;}
function amtCtlHTML(pre,st){
  st.unit=(st.unit==='g'||st.unit==='oz')&&amtCanWeigh(st)?st.unit:st.noServ?'g':'serv';
  if(!(st.val>0))st.val=st.unit==='serv'?1:st.unit==='g'?(st.sg||100):(st.sg||100)/GRAMS_PER_OZ;
  _amt[pre]=st;
  const opt=(v,l)=>`<option value="${v}"${st.unit===v?' selected':''}>${l}</option>`;
  return`<div class="qty-row"><button class="btn bts" onclick="amtCtlAdj('${pre}',-1)" aria-label="Less">−</button>
    <input type="number" inputmode="decimal" id="${pre}-qty" value="${fmtAmt(amtShown(st.val,st.unit))}" min="0" step="any" oninput="amtCtlPaint('${pre}')" aria-label="Amount">
    <button class="btn bts" onclick="amtCtlAdj('${pre}',1)" aria-label="More">+</button>
    ${amtCanWeigh(st)?`<select id="${pre}-unit" onchange="amtCtlUnit('${pre}')" aria-label="Unit">${st.noServ?'':opt('serv','servings')}${opt('g','grams')}${opt('oz','ounces')}</select>`:`<span>servings</span>`}</div>`;
}
// Bring the state up to date with what is typed. A number that still reads as the stored amount
// is left alone, so the exact amount survives (1 serving shown as "113 g" stays 1 serving).
function amtCtlSync(pre){
  const st=_amt[pre];if(!st)return null;
  const el=document.getElementById(pre+'-qty'),sel=document.getElementById(pre+'-unit');
  if(sel&&sel.value!==st.unit&&['serv','g','oz'].includes(sel.value)&&(sel.value==='serv'?!st.noServ:amtCanWeigh(st)))st.unit=sel.value;
  if(el&&String(el.value)!==fmtAmt(amtShown(st.val,st.unit))){
    const v=parseFloat(el.value);
    if(v>0&&isFinite(v))st.val=Math.min(v,st.unit==='g'?20000:st.unit==='oz'?700:200);
  }
  return st;
}
function amtCtlGrams(st){return st.unit==='g'?st.val:st.unit==='oz'?st.val*GRAMS_PER_OZ:st.sg>0?st.val*st.sg:0;}
// Which numbers the amount multiplies, and by how much. A weight uses the label's per-100 g
// figures when there are any; otherwise the serving's numbers through the serving's weight.
function amtCtlBasis(st){
  const r=k=>Math.round(k*10000)/10000;
  if(st.unit==='serv')return{b:st.per,k:r(st.val),per100:false};
  const g=amtCtlGrams(st);
  if(st.per100)return{b:st.per100,k:r(g/100),per100:true};
  return{b:st.per,k:st.sg>0?r(g/st.sg):0,per100:false};
}
function amtCtlMacros(pre){
  const st=amtCtlSync(pre);if(!st)return null;
  const x=amtCtlBasis(st);
  return{protein:r1(x.b.protein*x.k),carbs:r1(x.b.carbs*x.k),fat:r1(x.b.fat*x.k),cals:Math.round(x.b.cals*x.k)};
}
// Servings, when the amount can be put that way (it cannot for a weight of something whose serving has no known weight).
function amtCtlServings(pre){
  const st=amtCtlSync(pre);if(!st)return 1;
  if(st.unit==='serv')return st.val;
  return st.sg>0?Math.round(amtCtlGrams(st)/st.sg*10000)/10000:0;
}
function amtCtlPaint(pre){
  const el=document.getElementById(pre+'-macros');const m=amtCtlMacros(pre);if(!m)return;
  if(_amt[pre].onPaint)_amt[pre].onPaint(m);
  if(el)el.innerHTML=macroTilesHTML(m);
}
function amtCtlAdj(pre,dir){
  const st=amtCtlSync(pre),el=document.getElementById(pre+'-qty');if(!st)return;
  const v=Math.round((amtShown(st.val,st.unit)+Math.sign(dir)*AMT_STEP[st.unit])*100)/100;
  if(v>0){st.val=v;if(el)el.value=fmtAmt(v);}
  amtCtlPaint(pre);
}
// Changing the unit rewrites the number so the amount of food stays the same.
function amtCtlUnit(pre){
  const st=_amt[pre],el=document.getElementById(pre+'-qty'),sel=document.getElementById(pre+'-unit');if(!st||!sel)return;
  const from=st.unit,to=sel.value;
  if(el&&String(el.value)!==fmtAmt(amtShown(st.val,from))){const v=parseFloat(el.value);if(v>0&&isFinite(v))st.val=v;}
  if(to!==from&&['serv','g','oz'].includes(to)){
    const g=amtCtlGrams(st); // 0 when coming from servings of unknown weight
    st.val=to==='serv'?(st.sg>0&&g>0?g/st.sg:1):to==='g'?(g>0?g:100):(g>0?g:100)/GRAMS_PER_OZ;
    st.unit=to;
  }
  if(el)el.value=fmtAmt(amtShown(st.val,st.unit));
  amtCtlPaint(pre);
}
// The amount as a meal-builder item: numbers for one unit of the basis, and how many.
function amtCtlItem(pre,food){
  const st=amtCtlSync(pre);if(!st)return null;const x=amtCtlBasis(st);
  const it={foodId:food.id||null,name:food.name,qty:x.k,serving:x.per100?'100g':st.serving,protein:x.b.protein,carbs:x.b.carbs,fat:x.b.fat,cals:x.b.cals};
  const sg=x.per100?100:st.sg;if(sg>0)it.sg=sg;
  if(st.unit!=='serv'&&sg>0)it.unit=st.unit;
  return it;
}

// ─── Quick log, with an amount ───
// One food (or one saved meal) straight into the day: how much, then which meal.
function quickLogFood(foodId,qty){
  const f=findFood(foodId);if(!f)return;
  closeOv('fit-ov');
  window._pendingQuickLog={type:'food',food:f};
  const sg=servingGrams(f);const unit=qty>0?'serv':foodUnit(f);
  quickLogSheet(f.name,esc(servingText(f)),{per:{protein:+f.protein||0,carbs:+f.carbs||0,fat:+f.fat||0,cals:+f.cals||0},per100:null,sg,serving:f.serving,unit,val:unit==='serv'?(qty>0?qty:1):0});
}
function quickLogCombo(comboId){
  const combo=(S.savedMeals||[]).find(c=>c.id===comboId);if(!combo)return;
  closeOv('fit-ov');
  window._pendingQuickLog={type:'combo',combo};
  let p=0,c=0,ft=0,k=0;combo.items.forEach(it=>{const t=mealItemTotals(it);p+=t.protein;c+=t.carbs;ft+=t.fat;k+=t.cals;});
  quickLogSheet(combo.name,`${combo.items.length} items`,{per:{protein:p,carbs:c,fat:ft,cals:k},per100:null,sg:0,serving:'',unit:'serv',val:1,fixed:true});
}
// st.fixed: something logged whole (a saved meal), so no amount is asked.
function quickLogSheet(name,sub,st){
  const likely=likelyMealType();const ds=nutDay();
  const ctl=amtCtlHTML('ql',st);
  const ov=makeOv('mtype-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div class="mt" style="margin-bottom:2px">${esc(name)}</div>
    <div class="sheet-sub" style="margin-bottom:10px">${sub}${ds!==today()?` · logging for ${fmtDay(ds)}`:''}</div>
    ${st.fixed?'':ctl}
    <div id="ql-macros" class="st-grid st-4" style="margin:10px 0 14px"></div>
    <div class="sec-h" style="padding:0 2px 8px">Log as…</div>
    <div class="type-grid">${MEAL_TYPES.map(t=>`<button class="btn ${t===likely?'btp':'bts'}" onclick="doQuickLog('${t}')">${t}</button>`).join('')}</div>
    <button class="btn btg bfw" style="margin-top:8px" onclick="closeOv('mtype-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  amtCtlPaint('ql');
}
function quickQty(){const q=amtCtlServings('ql');return q>0?q:1;}
function quickQtyAdj(d){amtCtlAdj('ql',d);}
function quickQtyPaint(){amtCtlPaint('ql');}
function doQuickLog(mealType){
  const q=window._pendingQuickLog;
  const built=q&&q.type==='food'?amtCtlItem('ql',q.food):null;
  closeOv('mtype-ov');
  if(!q)return;
  if(!S.meals)S.meals=[];
  const date=nutDay();
  if(q.type==='food'){
    const f=q.food;
    trackRecent(f.id);
    const item=loggedItem(built||foodItem(f,1));
    S.meals.push({id:uid(),date,type:mealType,name:mealType,items:[item],protein:item.protein,carbs:item.carbs,fat:item.fat,cals:item.cals});
    toast(`${itemLabel(item)} → ${mealType}`,'green');
  }else if(q.type==='combo'){
    const c=q.combo;
    trackRecentMeal(c.id);
    let tp=0,tc=0,tf=0,tk=0;
    const items=c.items.map(it=>{
      const t=mealItemTotals(it);
      tp+=t.protein;tc+=t.carbs;tf+=t.fat;tk+=t.cals;
      return{...it,...t};
    });
    S.meals.push({id:uid(),date,type:mealType,name:mealType,savedMealName:c.name,
      items,protein:r1(tp),carbs:r1(tc),fat:r1(tf),cals:Math.round(tk)});
    toast(c.name+' → '+mealType,'green');
  }
  save();
  if(S.tab==='nutrition')renderNutrition(document.getElementById('content'));
  window._pendingQuickLog=null;
}

// ─── Again: repeat a meal, copy from an earlier day ───
function mealCopy(m,date){
  const c={id:uid(),date,type:m.type||m.name||'Snack',name:m.type||m.name||'Snack',protein:parseFloat(m.protein)||0,carbs:parseFloat(m.carbs)||0,fat:parseFloat(m.fat)||0,cals:Math.round(parseFloat(m.cals)||0)};
  if(m.savedMealName)c.savedMealName=m.savedMealName;
  if(Array.isArray(m.items)&&m.items.length)c.items=m.items.map(it=>Object.assign({},it));
  return c; // a copy is its own meal: it is not tied to the meal plan, even if the original was
}
function addMealCopies(list,date){
  const made=list.map(m=>mealCopy(m,date));
  made.forEach(c=>{S.meals.push(c);(c.items||[]).forEach(it=>{if(it.foodId)trackRecent(it.foodId);});});
  save();
  return made.map(c=>c.id);
}
function mealsChanged(){
  if(S.tab==='nutrition')renderNutrition(document.getElementById('content'));else rerender();
  if(document.getElementById('copy-ov'))renderCopyDay();
}
// Repeat always logs to today: from a past day that is "the same again today", and on today's
// own list it is a second helping.
function repeatMeal(id){
  const m=(S.meals||[]).find(x=>x.id===id);if(!m)return;
  const ids=addMealCopies([m],today());mealsChanged();
  toast(`${m.type||'Meal'} added to today`,'green',{action:'Undo',onAction:()=>{S.meals=S.meals.filter(x=>!ids.includes(x.id));save();mealsChanged();}});
}
// The most recent days before `ds` that have meals logged, newest first.
function daysWithMeals(ds,limit){
  const seen=new Set();(S.meals||[]).forEach(m=>{if(m.date<ds)seen.add(m.date);});
  return[...seen].sort().reverse().slice(0,limit||14);
}
let _copyDay=null;
function showCopyDay(){
  const to=nutDay();const days=daysWithMeals(to,14);
  if(!days.length){toast('No earlier day has meals to copy');return;}
  _copyDay={to,from:days[0],added:{}};
  const ov=makeOv('copy-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div><div class="mt" style="margin-bottom:4px">Copy from a day</div><div id="copy-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderCopyDay();
}
function copyDayStep(n){
  const c=_copyDay;if(!c)return;const days=daysWithMeals(c.to,14);
  const i=days.indexOf(c.from)-n; // days are newest first, so "earlier" is a higher index
  if(i>=0&&i<days.length){c.from=days[i];renderCopyDay();}
}
function renderCopyDay(){
  const el=document.getElementById('copy-body'),c=_copyDay;if(!el||!c)return;
  const days=daysWithMeals(c.to,14);const at=days.indexOf(c.from);
  const meals=(S.meals||[]).filter(m=>m.date===c.from);
  const order=['Breakfast','Pre-workout','Lunch','Snack','Post-workout','Dinner'];
  meals.sort((a,b)=>(order.indexOf(a.type)+1||9)-(order.indexOf(b.type)+1||9));
  const left=meals.filter(m=>!c.added[m.id]);
  const title=m=>m.savedMealName||(m.items&&m.items.length?m.items.map(itemLabel).join(', '):'Macros entered by hand');
  el.innerHTML=`<div class="sheet-sub">Into ${c.to===today()?'today':fmtDay(c.to)}. Each meal is copied with the same foods and amounts, and can be changed afterwards.</div>
    <div class="nut-day" style="padding:0 0 8px">
      <button class="ib ib-q" onclick="copyDayStep(-1)" aria-label="Earlier day"${at>=days.length-1?' disabled':''}>${ICON('chev',18).replace('<svg','<svg style="transform:rotate(180deg)"')}</button>
      <div class="nut-day-t"><b>${c.from===daysAgoStr(1)?'Yesterday':dayDate(c.from).toLocaleDateString('en-US',{weekday:'long'})}</b><span>${fmtDay(c.from)} · ${Math.round(getDayTotals(c.from).cals).toLocaleString()} kcal</span></div>
      <button class="ib ib-q" onclick="copyDayStep(1)" aria-label="Later day"${at<=0?' disabled':''}>${ICON('chev',18)}</button>
    </div>
    <div class="list">${meals.map(m=>`<div class="row"><span class="row-main"><span class="row-t">${esc(m.type||'Meal')}<span class="pill">${Math.round(m.cals)||0} kcal</span></span><span class="row-s">${esc(title(m))}</span></span>
      ${c.added[m.id]?`<span class="plan-done">${ICON('tick',14)} Added</span>`:`<button class="btn bts bsm" onclick="copyOneMeal(${jsq(m.id)})" aria-label="Add ${esc(m.type||'meal')}">Add</button>`}</div>`).join('')}</div>
    <div class="sheet-acts"><button class="btn btg" onclick="closeOv('copy-ov')">${left.length<meals.length?'Done':'Cancel'}</button>
      ${left.length?`<button class="btn btp" onclick="copyAllMeals()">${left.length===meals.length?`Add all ${meals.length}`:`Add the other ${left.length}`}</button>`:''}</div>`;
}
function copyOneMeal(id){
  const c=_copyDay;const m=(S.meals||[]).find(x=>x.id===id);if(!c||!m||c.added[id])return;
  c.added[id]=addMealCopies([m],c.to)[0];mealsChanged();
}
function copyAllMeals(){
  const c=_copyDay;if(!c)return;
  const list=(S.meals||[]).filter(m=>m.date===c.from&&!c.added[m.id]);if(!list.length)return;
  const ids=addMealCopies(list,c.to);
  closeOv('copy-ov');mealsChanged();
  toast(`${ids.length} meal${ids.length===1?'':'s'} copied${c.to===today()?'':' to '+fmtDay(c.to)}`,'green',{action:'Undo',onAction:()=>{S.meals=S.meals.filter(x=>!ids.includes(x.id));save();mealsChanged();}});
}

// ─── Your own foods: create, correct, delete ───
// opts: {id} edits one of your foods; {barcode} makes or corrects the food for a scanned product;
// {preset:{name,serving,protein,carbs,fat,cals}} fills the form; after:'scan' goes on to the serving picker.
let _foodEd=null;
function showFoodEditor(opts){
  opts=opts||{};
  const barcode=opts.barcode?cleanBarcode(opts.barcode):'';
  let food=opts.id?(S.customFoods||[]).find(f=>f.id===opts.id):null;
  if(!food&&barcode)food=(S.customFoods||[]).find(f=>barcodeForms(barcode).some(b=>f.id==='cf_'+b))||null;
  const src=opts.preset||food||{};
  _foodEd={id:food?food.id:null,barcode:barcode||(food&&food.barcode)||'',after:opts.after||null};
  const v=k=>src[k]!=null&&src[k]!==''?esc(String(src[k])):'';
  const ov=makeOv('food-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div class="mt" style="margin-bottom:4px">${food?'Edit food':'New food'}</div>
    <div class="sheet-sub">${_foodEd.barcode?`Barcode ${esc(_foodEd.barcode)}. The next scan of it uses these numbers.`:'Numbers for one serving, as on the label. Add what a serving weighs and the food can be logged in grams or ounces.'}</div>
    <div class="fg"><label class="fl">Name</label><input type="text" id="fe-name" maxlength="120" value="${v('name')}" placeholder="e.g. Kirkland Protein Bar"></div>
    <div class="fe-grid" style="margin-bottom:14px">
      <div><label class="fl">One serving is</label><input type="text" id="fe-serving" maxlength="40" value="${v('serving')}" placeholder="1 bar, 1 cup, 100 g"></div>
      <div><label class="fl">It weighs (g) <small>optional</small></label><input type="number" inputmode="decimal" id="fe-grams" value="${src.servingG>0?esc(String(src.servingG)):''}" placeholder="e.g. 50"></div>
    </div>
    <div class="fe-grid">
      <div><label class="fl">Protein (g)</label><input type="number" inputmode="decimal" id="fe-pro" value="${v('protein')}" placeholder="0" oninput="foodEdCheck()"></div>
      <div><label class="fl">Carbs (g)</label><input type="number" inputmode="decimal" id="fe-carb" value="${v('carbs')}" placeholder="0" oninput="foodEdCheck()"></div>
      <div><label class="fl">Fat (g)</label><input type="number" inputmode="decimal" id="fe-fat" value="${v('fat')}" placeholder="0" oninput="foodEdCheck()"></div>
      <div><label class="fl">Calories</label><input type="number" inputmode="numeric" id="fe-cal" value="${v('cals')}" placeholder="Auto" oninput="foodEdCheck()"></div>
    </div>
    <div id="fe-note" class="fine" style="min-height:18px"></div>
    <button class="btn btp bfw" onclick="saveFoodEditor()">Save food</button>
    ${food?`<button class="btn btg bfw" style="margin-top:6px;color:var(--red)" onclick="deleteCustomFood(${jsq(food.id)})">Delete this food</button>`:''}
    <button class="btn btg bfw" style="margin-top:${food?0:6}px" onclick="closeOv('food-ov')">Cancel</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  foodEdCheck();
  if(!src.name)setTimeout(()=>document.getElementById('fe-name')?.focus(),200);
}
function foodEdRead(){
  const num=id=>Math.max(0,parseFloat(document.getElementById(id)?.value)||0);
  const p=num('fe-pro'),c=num('fe-carb'),f=num('fe-fat');const calTxt=document.getElementById('fe-cal')?.value;
  const fromMacros=Math.round(p*4+c*4+f*9);
  return{name:String(document.getElementById('fe-name')?.value||'').trim().slice(0,120),serving:String(document.getElementById('fe-serving')?.value||'').trim().slice(0,40)||'1 serving',
    servingG:Math.min(5000,Math.max(0,r1(parseFloat(document.getElementById('fe-grams')?.value)||0))),
    protein:r1(p),carbs:r1(c),fat:r1(f),cals:calTxt?Math.round(Math.max(0,parseFloat(calTxt)||0)):fromMacros,fromMacros,typedCals:!!calTxt};
}
// Calories that disagree with the macros usually mean a typo. Say so; do not block (alcohol and fibre are real).
function foodEdCheck(){
  const el=document.getElementById('fe-note');if(!el)return;
  const d=foodEdRead();
  if(!d.typedCals){el.textContent=d.fromMacros?`Calories will be ${d.fromMacros}, worked out from the macros.`:'';el.style.color='';return;}
  const off=d.fromMacros>0&&(d.cals<d.fromMacros*0.7||d.cals>d.fromMacros*1.9);
  el.textContent=off?`Check the numbers: these macros add up to about ${d.fromMacros} kcal, not ${d.cals}.`:'';
  el.style.color=off?'var(--gold)':'';
}
function saveFoodEditor(){
  const ed=_foodEd;if(!ed)return;
  const d=foodEdRead();
  if(!d.name){toast('Give the food a name');return;}
  if(!d.protein&&!d.carbs&&!d.fat&&!d.cals){toast('Enter the nutrition for one serving');return;}
  if(!S.customFoods)S.customFoods=[];
  const id=ed.id||(ed.barcode?'cf_'+ed.barcode:'cf_'+uid());
  const food={id,name:d.name,serving:d.serving,protein:d.protein,carbs:d.carbs,fat:d.fat,cals:d.cals};
  if(d.servingG>0)food.servingG=d.servingG; // lets the food be logged by weight; a weight in the serving text ("100 g") works without it
  if(ed.barcode)food.barcode=ed.barcode;
  const at=S.customFoods.findIndex(f=>f.id===id);
  if(at>=0)S.customFoods[at]=food;else S.customFoods.push(food);
  if(ed.barcode){
    // The lookup cache is what a rescan reads, so the corrected numbers go there too. Only
    // per-serving figures are known; per-100 g stays empty rather than being guessed.
    cacheProduct(ed.barcode,{name:d.name,brand:'',serving:d.serving,servingG:d.servingG||0,manual:true,per100:{protein:0,carbs:0,fat:0,cals:0},
      perServing:{protein:d.protein,carbs:d.carbs,fat:d.fat,cals:d.cals}});
  }
  save();closeOv('food-ov');
  toast(d.name+' saved','green');
  if(ed.after==='scan'&&ed.barcode)showServingPicker(S.foodCache[ed.barcode],ed.barcode);
  else foodListChanged();
  _foodEd=null;
}
function deleteCustomFood(id){
  const at=(S.customFoods||[]).findIndex(f=>f.id===id);if(at<0)return;
  const gone=S.customFoods.splice(at,1)[0];
  const star=(S.starredFoods||[]).includes(id),recentAt=(S.recentFoods||[]).indexOf(id);
  S.starredFoods=(S.starredFoods||[]).filter(x=>x!==id);S.recentFoods=(S.recentFoods||[]).filter(x=>x!==id);
  const cached={};
  if(gone.barcode)barcodeForms(gone.barcode).forEach(b=>{if(S.foodCache&&S.foodCache[b]){cached[b]=S.foodCache[b];delete S.foodCache[b];}});
  save();closeOv('food-ov');foodListChanged();
  // Meals already logged keep their own numbers, so deleting a food never rewrites history.
  toast(gone.name+' deleted','',{action:'Undo',onAction:()=>{
    S.customFoods.splice(Math.min(at,S.customFoods.length),0,gone);
    if(star)S.starredFoods.push(id);if(recentAt>=0)S.recentFoods.splice(Math.min(recentAt,S.recentFoods.length),0,id);
    Object.keys(cached).forEach(b=>{S.foodCache[b]=cached[b];});
    save();foodListChanged();
  }});
}
function foodListChanged(){
  if(document.getElementById('food-list'))onFoodSearch();
  if(S.tab==='nutrition'&&!document.getElementById('meal-ov'))renderNutrition(document.getElementById('content'));
}
