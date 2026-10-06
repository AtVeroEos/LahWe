// ═══════════════════════════════════════════════════
// WEEKLY MEAL PLAN — seven days of planned meals, one-tap logging, grocery list
// ═══════════════════════════════════════════════════
// S.mealPlan.days[0] is Sunday … [6] is Saturday (the same numbering as Date.getDay()).
// A planned meal: {id, type, name, items:[{foodId, name, qty, serving, protein, carbs, fat, cals, est?}]}
// Item numbers are PER SERVING and qty is the number of servings — the same shape as a saved meal,
// so mealItemTotals() is the one place that multiplies them out.
const PLAN_DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const PLAN_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const PLAN_ORDER=[1,2,3,4,5,6,0]; // shown Monday first
const PLAN_MAX_MEALS=8,PLAN_MAX_ITEMS=20;
function fmtQty(v){return String(Math.round((parseFloat(v)||0)*100)/100);}

function emptyMealPlan(){return{days:[[],[],[],[],[],[],[]],note:'',updatedAt:0,checked:{}};}
function cleanPlanItem(it){
  if(!isObj(it))return null;
  const n=v=>{const x=parseFloat(v);return x>0&&isFinite(x)?x:0;};
  const name=String(it.name==null?'':it.name).replace(/\s+/g,' ').trim().slice(0,80);
  if(!name)return null;
  const qty=Math.min(30,Math.max(0.1,n(it.qty)||1));
  const o={foodId:it.foodId?String(it.foodId).slice(0,80):null,name,qty:Math.round(qty*100)/100,serving:String(it.serving==null?'':it.serving).trim().slice(0,40),
    protein:r1(n(it.protein)),carbs:r1(n(it.carbs)),fat:r1(n(it.fat)),cals:Math.round(n(it.cals))};
  if(it.est)o.est=true;
  return o;
}
function cleanPlanMeal(m){
  if(!isObj(m))return null;
  const items=(Array.isArray(m.items)?m.items:[]).map(cleanPlanItem).filter(Boolean).slice(0,PLAN_MAX_ITEMS);
  if(!items.length)return null;
  const type=MEAL_TYPES.includes(m.type)?m.type:'Snack';
  return{id:String(m.id||uid()),type,name:String(m.name==null?'':m.name).replace(/\s+/g,' ').trim().slice(0,60),items};
}
function normalizeMealPlan(p){
  const out=emptyMealPlan();
  if(!isObj(p))return out;
  if(Array.isArray(p.days))for(let i=0;i<7;i++)out.days[i]=(Array.isArray(p.days[i])?p.days[i]:[]).map(cleanPlanMeal).filter(Boolean).slice(0,PLAN_MAX_MEALS);
  out.note=String(p.note==null?'':p.note).slice(0,400);
  out.updatedAt=Number(p.updatedAt)||0;
  if(isObj(p.checked))Object.keys(p.checked).slice(0,400).forEach(k=>{if(p.checked[k])out.checked[k]=true;});
  return out;
}
function planMealTotals(m){
  const t={protein:0,carbs:0,fat:0,cals:0};
  (m.items||[]).forEach(it=>{const x=mealItemTotals(it);t.protein+=x.protein;t.carbs+=x.carbs;t.fat+=x.fat;t.cals+=x.cals;});
  return{protein:r1(t.protein),carbs:r1(t.carbs),fat:r1(t.fat),cals:Math.round(t.cals)};
}
function planDayTotals(meals){
  const t={protein:0,carbs:0,fat:0,cals:0};
  (meals||[]).forEach(m=>{const x=planMealTotals(m);t.protein+=x.protein;t.carbs+=x.carbs;t.fat+=x.fat;t.cals+=x.cals;});
  return{protein:r1(t.protein),carbs:r1(t.carbs),fat:r1(t.fat),cals:Math.round(t.cals)};
}
function planHasMeals(){return S.mealPlan.days.some(d=>d.length>0);}
function planSortMeals(meals){
  const order=['Breakfast','Pre-workout','Lunch','Snack','Post-workout','Dinner'];
  return meals.slice().sort((a,b)=>order.indexOf(a.type)-order.indexOf(b.type));
}
function planFindMeal(dow,id){return(S.mealPlan.days[dow]||[]).find(m=>m.id===id)||null;}
function planMealLogged(id,ds){return(S.meals||[]).some(m=>m.date===ds&&m.planMealId===id);}
function planTouch(){S.mealPlan.updatedAt=Date.now();save();}

// Turn a list of items written by a person or by the AI coach into plan/meal items.
// Each input: {food_id} (numbers come from the food list — any supplied ones are ignored), or
// {name, kcal, protein, carbs, fat, serving} for something that is not in the list (marked "est").
// `servings` is how many. Returns {items, errors}; nothing is ever guessed silently.
function resolveFoodItems(list){
  const items=[],errors=[];
  const num=v=>{const x=parseFloat(v);return isFinite(x)?x:NaN;};
  (Array.isArray(list)?list:[]).slice(0,PLAN_MAX_ITEMS).forEach((raw,i)=>{
    if(typeof raw==='string')raw={name:raw};
    if(!isObj(raw)){errors.push(`item ${i+1}: not an object`);return;}
    const label=String(raw.name||raw.food_id||`item ${i+1}`).slice(0,60);
    let qty=raw.servings==null||raw.servings===''?1:num(raw.servings);
    if(!(qty>0)||qty>30){errors.push(`${label}: servings must be between 0.1 and 30`);return;}
    qty=Math.max(0.1,Math.round(qty*100)/100);
    const id=String(raw.food_id||raw.foodId||'').trim();
    let f=id?findFood(id):null;
    if(id&&!f){errors.push(`${label}: there is no food with id "${id.slice(0,60)}" — look it up with search_foods, or give its name and numbers instead`);return;}
    const hasNumbers=['kcal','cals','calories','protein','carbs','fat'].some(k=>raw[k]!=null&&raw[k]!=='');
    if(!f&&!hasNumbers&&raw.name){
      const lc=String(raw.name).trim().toLowerCase();
      f=allFoods().find(x=>String(x.name||'').toLowerCase()===lc)||null;
      if(!f){errors.push(`${label}: not in the food list — give kcal, protein, carbs and fat per serving, or use search_foods to find its id`);return;}
    }
    if(f){items.push({foodId:f.id,name:f.name,qty,serving:f.serving||'',protein:parseFloat(f.protein)||0,carbs:parseFloat(f.carbs)||0,fat:parseFloat(f.fat)||0,cals:parseFloat(f.cals)||0});return;}
    const name=String(raw.name||'').replace(/\s+/g,' ').trim().slice(0,80);
    if(!name){errors.push(`item ${i+1}: needs a name or a food_id`);return;}
    const p=num(raw.protein||0),c=num(raw.carbs||0),fat=num(raw.fat||0);
    let k=raw.kcal!=null?num(raw.kcal):raw.cals!=null?num(raw.cals):raw.calories!=null?num(raw.calories):NaN;
    if([p,c,fat].some(x=>!(x>=0))||p>300||c>600||fat>300){errors.push(`${label}: protein, carbs and fat must be sensible gram amounts per serving`);return;}
    const fromMacros=Math.round(p*4+c*4+fat*9);
    if(isNaN(k))k=fromMacros;
    if(!(k>=0)||k>3000){errors.push(`${label}: kcal per serving must be between 0 and 3000`);return;}
    if(!k&&!fromMacros){errors.push(`${label}: give kcal or macros per serving`);return;}
    // Calories that cannot be explained by the macros mean one of the numbers is wrong. (Alcohol and
    // fibre move this a little, hence the wide band.)
    if(fromMacros>=60&&(k<fromMacros*0.7||k>fromMacros*1.9)){errors.push(`${label}: ${Math.round(k)} kcal does not fit ${p}g protein, ${c}g carbs, ${fat}g fat (that is about ${fromMacros} kcal) — fix the numbers`);return;}
    items.push({foodId:null,name,qty,serving:String(raw.serving||'1 serving').trim().slice(0,40),protein:r1(p),carbs:r1(c),fat:r1(fat),cals:Math.round(k),est:true});
  });
  if(Array.isArray(list)&&list.length>PLAN_MAX_ITEMS)errors.push(`at most ${PLAN_MAX_ITEMS} items per meal`);
  return{items,errors};
}
// A logged-meal entry (the S.meals shape: item numbers already multiplied out) from per-serving items.
function mealEntryFromItems(items,type,date,extra){
  let tp=0,tc=0,tf=0,tk=0;
  const out=items.map(it=>{
    const t=mealItemTotals(it);tp+=t.protein;tc+=t.carbs;tf+=t.fat;tk+=t.cals;
    const o={foodId:it.foodId||null,name:it.name,qty:it.qty,serving:it.serving,protein:t.protein,carbs:t.carbs,fat:t.fat,cals:t.cals};
    if(it.est)o.est=true;
    return o;
  });
  return Object.assign({id:uid(),date,type,name:type,items:out,protein:r1(tp),carbs:r1(tc),fat:r1(tf),cals:Math.round(tk)},extra||{});
}

// ─── Logging a planned meal ───
function logPlanMeal(dow,id,ds){
  const m=planFindMeal(dow,id);if(!m)return null;
  ds=ds||today();
  const entry=mealEntryFromItems(m.items,m.type,ds,{planMealId:m.id,savedMealName:m.name||null});
  S.meals.push(entry);
  m.items.forEach(it=>{if(it.foodId&&findFood(it.foodId))trackRecent(it.foodId);});
  save();
  return entry;
}
function tapLogPlanMeal(dow,id){
  const e=logPlanMeal(dow,id);if(!e)return;
  refreshPlanViews();
  toast(`${e.savedMealName||e.type} logged · ${e.cals} kcal`,'green',{action:'Undo',onAction:()=>{S.meals=S.meals.filter(x=>x.id!==e.id);save();refreshPlanViews();}});
}
function refreshPlanViews(){
  if(S.tab==='nutrition'&&!S.activeWorkout)renderNutrition(document.getElementById('content'));
  if(document.getElementById('plan-ov'))renderMealPlanSheet();
}

// ─── Nutrition-tab card ───
function mealPlanCardHTML(){
  const dow=new Date().getDay();const td=today();
  const meals=planSortMeals(S.mealPlan.days[dow]||[]);
  const g=S.macroGoals;
  if(!planHasMeals()){
    return`<div class="card" id="plan-card"><div class="ch"><span class="ct">Meal plan</span></div><div class="cb">
      <div style="font-size:13px;font-weight:600">No meal plan yet</div>
      <div style="font-size:12px;color:var(--muted);margin:3px 0 12px;line-height:1.45">Plan a week of meals from your food list, log each one with a tap, and get a grocery list.</div>
      <div class="frow"><button class="btn btp bfw" onclick="coachStart('mealplan')">✨ Plan with coach</button><button class="btn bts bfw" onclick="showMealPlan()">Build by hand</button></div>
    </div></div>`;
  }
  const t=planDayTotals(meals);
  const rows=meals.map(m=>{
    const mt=planMealTotals(m);const done=planMealLogged(m.id,td);
    return`<div class="plan-row"><div style="flex:1;min-width:0">
        <div class="plan-type">${esc(m.type)}</div>
        <div class="plan-name">${esc(m.name||m.items.map(it=>it.name).join(', '))}</div>
        <div class="plan-meta">${mt.cals} kcal · P${fmt1(mt.protein)} C${fmt1(mt.carbs)} F${fmt1(mt.fat)}</div>
      </div>${done?`<span class="plan-done">✓ Logged</span>`:`<button class="btn btp bsm" onclick="tapLogPlanMeal(${dow},${jsq(m.id)})">Log</button>`}</div>`;
  }).join('');
  return`<div class="card" id="plan-card"><div class="ch"><span class="ct">Meal plan · ${PLAN_DAYS[dow]}</span>
      <span style="font-size:11px;color:var(--muted)">${meals.length?`${t.cals} / ${g.cals} kcal · P${fmt1(t.protein)}`:'nothing planned'}</span></div>
    ${rows||`<div class="cb" style="font-size:12px;color:var(--muted)">Nothing is planned for today.</div>`}
    <div class="plan-foot"><button class="btn bts bsm" onclick="showMealPlan()">Week</button><button class="btn bts bsm" onclick="showGroceryList()">Grocery list</button><button class="btn bts bsm" onclick="coachStart('mealplan-adjust')">✨ Adjust</button></div>
  </div>`;
}

function planItemHTML(it){
  return`<div class="plan-item"><span>${esc(it.name)}${it.est?' <i>est.</i>':''} <em>${fmtQty(it.qty)} × ${esc(it.serving||'serving')}</em></span><span class="mono">${mealItemTotals(it).cals}</span></div>`;
}
// ─── Week sheet ───
function showMealPlan(dow){
  window._planDow=dow==null?new Date().getDay():dow;
  const ov=makeOv('plan-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div class="mt">Meal plan</div><div id="plan-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderMealPlanSheet();
}
function setPlanDow(d){window._planDow=d;renderMealPlanSheet();}
function renderMealPlanSheet(){
  const el=document.getElementById('plan-body');if(!el)return;
  const dow=window._planDow==null?new Date().getDay():window._planDow;
  const isToday=dow===new Date().getDay();const td=today();
  const meals=planSortMeals(S.mealPlan.days[dow]||[]);
  const t=planDayTotals(meals);const g=S.macroGoals;
  const pct=(v,goal)=>goal>0?Math.round(v/goal*100):0;
  const chips=PLAN_ORDER.map(d=>{
    const n=(S.mealPlan.days[d]||[]).length;
    return`<button class="chip${d===dow?' on':''}" style="padding:7px 0;flex:1;min-width:0;text-align:center" onclick="setPlanDow(${d})">${PLAN_SHORT[d]}${n?`<span class="plan-dot"></span>`:''}</button>`;
  }).join('');
  const mealHTML=meals.map(m=>{
    const mt=planMealTotals(m);const done=isToday&&planMealLogged(m.id,td);
    return`<div class="plan-meal">
      <div style="display:flex;align-items:flex-start;gap:8px">
        <div style="flex:1;min-width:0"><div class="plan-type">${esc(m.type)}</div><div class="plan-name">${esc(m.name||'Meal')}</div></div>
        <div class="mono" style="font-size:12px;font-weight:600;color:var(--navy);flex-shrink:0">${mt.cals} kcal</div>
      </div>
      ${m.items.map(planItemHTML).join('')}
      <div class="plan-meta" style="margin-top:5px">P${fmt1(mt.protein)} · C${fmt1(mt.carbs)} · F${fmt1(mt.fat)}</div>
      <div class="frow" style="margin-top:8px;gap:6px">
        ${done?`<span class="plan-done" style="flex:1">✓ Logged today</span>`:`<button class="btn btp bsm" style="flex:1" onclick="tapLogPlanMeal(${dow},${jsq(m.id)})">Log ${isToday?'':'to today'}</button>`}
        <button class="btn bts bsm" onclick="planEditMeal(${dow},${jsq(m.id)})">Edit</button>
        <button class="ib delbtn" onclick="planRemoveMeal(${dow},${jsq(m.id)})" aria-label="Remove from plan">✕</button>
      </div>
    </div>`;
  }).join('');
  el.innerHTML=`
    ${S.mealPlan.note?`<div class="ai-note">${esc(S.mealPlan.note)}</div>`:''}
    <div style="display:flex;gap:5px;margin-bottom:12px">${chips}</div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px">
      <div style="font-size:15px;font-weight:700">${PLAN_DAYS[dow]}${isToday?' <span style="font-size:11px;font-weight:600;color:var(--green)">today</span>':''}</div>
      <div style="font-size:11px;color:var(--muted)">${meals.length?`${t.cals} kcal (${pct(t.cals,g.cals)}% of ${g.cals}) · P${fmt1(t.protein)}g (${pct(t.protein,g.protein)}%)`:''}</div>
    </div>
    ${mealHTML||`<div style="font-size:12px;color:var(--muted);padding:14px 0 6px;text-align:center">Nothing planned for ${PLAN_DAYS[dow]}.</div>`}
    <button class="btn bts bfw" style="margin-top:6px" onclick="planAddMeal(${dow})">＋ Add a meal to ${PLAN_DAYS[dow]}</button>
    <div class="frow" style="margin-top:8px">
      <button class="btn bts bfw bsm" onclick="showPlanCopy(${dow})"${meals.length?'':' disabled'}>Copy day to…</button>
      <button class="btn bts bfw bsm" onclick="planClearDay(${dow})"${meals.length?'':' disabled'}>Clear day</button>
    </div>
    <div class="frow" style="margin-top:8px">
      <button class="btn bts bfw bsm" onclick="showGroceryList()"${planHasMeals()?'':' disabled'}>Grocery list</button>
      <button class="btn bts bfw bsm" onclick="closeOv('plan-ov');coachStart('${planHasMeals()?'mealplan-adjust':'mealplan'}')">✨ ${planHasMeals()?'Adjust with coach':'Plan with coach'}</button>
    </div>
    ${planHasMeals()?`<button class="btn btg bfw" style="margin-top:8px;color:var(--red)" onclick="planClearAll()">Clear the whole week</button>`:''}
    <button class="btn btg bfw" style="margin-top:4px" onclick="closeOv('plan-ov')">Close</button>`;
}
// Adding and editing reuse the meal builder; _mealTarget tells it to save into the plan, not the log.
function planAddMeal(dow){showAddMeal(null,false,{plan:dow});}
function planEditMeal(dow,id){
  const m=planFindMeal(dow,id);if(!m)return;
  _mealItems=m.items.map(it=>Object.assign({},it));
  window._loggedSavedMealId=null;window._mealTarget={plan:dow,replace:id,name:m.name,type:m.type};
  showAddMeal(null,true);updateMealItems();
}
function planSaveFromBuilder(mealType,items){
  const tg=window._mealTarget;if(!tg)return false;
  const day=S.mealPlan.days[tg.plan];if(!day)return false;
  const name=(document.getElementById('plan-meal-name')?.value||'').trim().slice(0,60);
  const meal=cleanPlanMeal({id:tg.replace||uid(),type:mealType,name,items});
  if(!meal)return false;
  const at=tg.replace?day.findIndex(m=>m.id===tg.replace):-1;
  if(at>=0)day[at]=meal;
  else{if(day.length>=PLAN_MAX_MEALS){toast(`Up to ${PLAN_MAX_MEALS} meals a day`);return false;}day.push(meal);}
  planTouch();
  return true;
}
function planRemoveMeal(dow,id){
  const day=S.mealPlan.days[dow];const i=day.findIndex(m=>m.id===id);if(i<0)return;
  const gone=day.splice(i,1)[0];planTouch();refreshPlanViews();
  toast('Removed from the plan','',{action:'Undo',onAction:()=>{S.mealPlan.days[dow].splice(Math.min(i,S.mealPlan.days[dow].length),0,gone);planTouch();refreshPlanViews();}});
}
function planClearDay(dow){
  const was=S.mealPlan.days[dow];if(!was.length)return;
  S.mealPlan.days[dow]=[];planTouch();refreshPlanViews();
  toast(`${PLAN_DAYS[dow]} cleared`,'',{action:'Undo',onAction:()=>{S.mealPlan.days[dow]=was;planTouch();refreshPlanViews();}});
}
function planClearAll(){
  customConfirm('Every planned meal for all seven days will be removed. Meals you already logged are not affected.','Clear the week',()=>{
    const was=S.mealPlan;S.mealPlan=emptyMealPlan();planTouch();refreshPlanViews();
    toast('Meal plan cleared','',{action:'Undo',onAction:()=>{S.mealPlan=was;planTouch();refreshPlanViews();}});
  });
}
function showPlanCopy(dow){
  const ov=makeOv('plancopy-ov');
  ov.innerHTML=`<div class="modal" style="max-height:70vh"><div class="mh"></div><div class="mt">Copy ${PLAN_DAYS[dow]} to…</div>
    <div style="font-size:12px;color:var(--muted);margin:-8px 0 12px">The day you pick is replaced.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${PLAN_ORDER.filter(d=>d!==dow).map(d=>`<button class="btn bts" onclick="planCopyDay(${dow},[${d}])">${PLAN_DAYS[d]}</button>`).join('')}
    </div>
    <button class="btn btp bfw" style="margin-top:10px" onclick="planCopyDay(${dow},[${PLAN_ORDER.filter(d=>d!==dow).join(',')}])">Every other day</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('plancopy-ov')">Cancel</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function planCopyDay(from,to){
  const src=S.mealPlan.days[from];if(!src||!src.length)return;
  const before=JSON.stringify(S.mealPlan.days);
  to.forEach(d=>{if(d!==from&&S.mealPlan.days[d])S.mealPlan.days[d]=src.map(m=>cleanPlanMeal(Object.assign({},m,{id:uid()}))).filter(Boolean);});
  planTouch();closeOv('plancopy-ov');refreshPlanViews();
  toast('Copied','green',{action:'Undo',onAction:()=>{S.mealPlan.days=JSON.parse(before);planTouch();refreshPlanViews();}});
}

// ─── Grocery list ───
const _COUNT_NOUNS=['egg','cup','slice','bar','scoop','piece','can','bottle','bowl','serving','tortilla','link','strip','stick','packet','bagel','muffin','cookie','wrap','bun','roll'];
const _FRACTIONS={'½':0.5,'¼':0.25,'¾':0.75,'⅓':1/3,'⅔':2/3};
// "4 oz" → {n:4, unit:'oz'}; "½ cup" → {n:.5, unit:'cup'}; "1 medium" → {n:1, unit:'medium'}
function parseServing(s){
  s=String(s||'').trim();
  let m=s.match(/^(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if(m&&parseInt(m[2])>0)return{n:parseInt(m[1])/parseInt(m[2]),unit:m[3].trim()};
  m=s.match(/^(\d+(?:\.\d+)?)\s*([½¼¾⅓⅔])?\s*(.*)$/);
  if(m)return{n:parseFloat(m[1])+(m[2]?_FRACTIONS[m[2]]:0),unit:m[3].trim()};
  m=s.match(/^([½¼¾⅓⅔])\s*(.*)$/);
  if(m)return{n:_FRACTIONS[m[1]],unit:m[2].trim()};
  return null;
}
function groceryAmount(qty,serving){
  const p=parseServing(serving);
  if(!p||!(p.n>0))return serving?`${fmtQty(qty)} × ${serving}`:`${fmtQty(qty)} serving${qty===1?'':'s'}`;
  let n=p.n*qty,unit=p.unit;
  if(/^oz$/i.test(unit)&&n>=16)return`${fmt1(n/16)} lb (${fmt1(n)} oz)`;
  if(/^g$/i.test(unit)&&n>=1000)return`${fmt1(n/1000)} kg`;
  if(/^ml$/i.test(unit)&&n>=1000)return`${fmt1(n/1000)} L`;
  if(n!==1&&_COUNT_NOUNS.includes(unit.toLowerCase()))unit+='s';
  return`${fmt1(n)}${unit?' '+unit:''}`;
}
// Everything the week's plan needs, with the same food on different days added together.
function planGrocery(){
  const map=new Map();
  S.mealPlan.days.forEach(day=>day.forEach(m=>m.items.forEach(it=>{
    const key=(it.foodId||('n:'+String(it.name).toLowerCase()))+'|'+String(it.serving||'').toLowerCase();
    const cur=map.get(key);
    if(cur){cur.qty=Math.round((cur.qty+(parseFloat(it.qty)||0))*100)/100;cur.meals++;}
    else map.set(key,{key,name:it.name,serving:it.serving||'',qty:parseFloat(it.qty)||0,meals:1});
  })));
  return[...map.values()].map(x=>Object.assign(x,{amount:groceryAmount(x.qty,x.serving)})).sort((a,b)=>a.name.toLowerCase()<b.name.toLowerCase()?-1:1);
}
function groceryText(){
  const list=planGrocery();
  return'Grocery list — Lah We meal plan\n\n'+list.map(x=>`${S.mealPlan.checked[x.key]?'[x]':'[ ]'} ${x.name} — ${x.amount}`).join('\n');
}
function showGroceryList(){
  const ov=makeOv('grocery-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div class="mt">Grocery list</div><div id="grocery-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderGroceryList();
}
function renderGroceryList(){
  const el=document.getElementById('grocery-body');if(!el)return;
  const list=planGrocery();
  // Forget ticks for things that are no longer on the plan.
  const keys=new Set(list.map(x=>x.key));let pruned=false;
  Object.keys(S.mealPlan.checked).forEach(k=>{if(!keys.has(k)){delete S.mealPlan.checked[k];pruned=true;}});
  if(pruned)save();
  const left=list.filter(x=>!S.mealPlan.checked[x.key]).length;
  el.innerHTML=list.length?`
    <div style="font-size:12px;color:var(--muted);margin:-8px 0 10px">For the whole week as planned · ${left} of ${list.length} still to get. Amounts add up the servings in your plan; check them against what you already have.</div>
    <div class="grocery">${list.map(x=>`<label class="groc-row${S.mealPlan.checked[x.key]?' got':''}"><input type="checkbox"${S.mealPlan.checked[x.key]?' checked':''} onchange="toggleGrocery(${jsq(x.key)},this.checked)"><span class="groc-name">${esc(x.name)}</span><span class="groc-amt">${esc(x.amount)}</span></label>`).join('')}</div>
    <div class="frow" style="margin-top:12px"><button class="btn btp bfw" onclick="shareGrocery()">Share / copy</button><button class="btn bts bfw" onclick="clearGroceryTicks()">Untick all</button></div>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('grocery-ov')">Close</button>`
    :`<div style="font-size:13px;color:var(--muted);padding:10px 0 16px">Plan some meals first — the list is built from them.</div><button class="btn btg bfw" onclick="closeOv('grocery-ov')">Close</button>`;
}
function toggleGrocery(key,on){if(on)S.mealPlan.checked[key]=true;else delete S.mealPlan.checked[key];save();renderGroceryList();}
function clearGroceryTicks(){S.mealPlan.checked={};save();renderGroceryList();}
async function shareGrocery(){
  const text=groceryText();
  try{if(navigator.share){await navigator.share({title:'Grocery list',text});return;}}catch(e){if(e&&e.name==='AbortError')return;}
  try{await navigator.clipboard.writeText(text);toast('Grocery list copied','green');}
  catch(e){downloadText('grocery-list.txt',text,'text/plain');}
}
