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

// days[dow]: meals every week. dated: {date: meals} for one date only (this week or next).
// skip: {date: [ids]} weekly meals taken off one date. fast: {dow:'full'|'part'} every week;
// fastOn: {date:'full'|'part'|'eat'} for one date. auto: planned meals go into the day's log when
// their time comes; declined: {date:[ids]} ones you said you did not eat. extras: things to buy
// that are not food in the plan ("coffee", "paper towels").
function emptyMealPlan(){return{days:[[],[],[],[],[],[],[]],dated:{},skip:{},note:'',updatedAt:0,checked:{},fast:{},fastOn:{},auto:true,declined:{},extras:[]};}
function cleanPlanItem(it){
  if(!isObj(it))return null;
  const n=v=>{const x=parseFloat(v);return x>0&&isFinite(x)?x:0;};
  const name=String(it.name==null?'':it.name).replace(/\s+/g,' ').trim().slice(0,80);
  if(!name)return null;
  // An item entered by weight keeps its unit and its serving's gram weight, and its exact amount:
  // 5 g of oil is 0.37 of a tablespoon, and rounding or flooring that would change the meal.
  const sg=Math.min(5000,n(it.sg));const weighed=sg>0&&(it.unit==='g'||it.unit==='oz');
  const qty=weighed?Math.min(30,Math.max(0.0005,n(it.qty)||1)):Math.min(30,Math.max(0.1,n(it.qty)||1));
  const o={foodId:it.foodId?String(it.foodId).slice(0,80):null,name,qty:weighed?Math.round(qty*10000)/10000:Math.round(qty*100)/100,serving:String(it.serving==null?'':it.serving).trim().slice(0,40),
    protein:r1(n(it.protein)),carbs:r1(n(it.carbs)),fat:r1(n(it.fat)),cals:Math.round(n(it.cals))};
  if(sg>0)o.sg=sg;if(weighed)o.unit=it.unit;
  if(it.est)o.est=true;
  return o;
}
// portion: the size the meal was scaled to on the plan page (1 = as built), kept so it reads back.
function cleanPlanMeal(m){
  if(!isObj(m))return null;
  const items=(Array.isArray(m.items)?m.items:[]).map(cleanPlanItem).filter(Boolean).slice(0,PLAN_MAX_ITEMS);
  if(!items.length)return null;
  const type=MEAL_TYPES.includes(m.type)?m.type:'Snack';
  const o={id:String(m.id||uid()),type,name:String(m.name==null?'':m.name).replace(/\s+/g,' ').trim().slice(0,60),items};
  const pt=parseFloat(m.portion);if(pt>0&&pt!==1)o.portion=Math.min(4,Math.max(0.25,Math.round(pt*100)/100));
  return o;
}
function normalizeMealPlan(p){
  const out=emptyMealPlan();
  if(!isObj(p))return out;
  if(Array.isArray(p.days))for(let i=0;i<7;i++)out.days[i]=(Array.isArray(p.days[i])?p.days[i]:[]).map(cleanPlanMeal).filter(Boolean).slice(0,PLAN_MAX_MEALS);
  out.note=String(p.note==null?'':p.note).slice(0,400);
  out.updatedAt=Number(p.updatedAt)||0;
  if(isObj(p.checked))Object.keys(p.checked).slice(0,400).forEach(k=>{if(p.checked[k])out.checked[String(k).slice(0,160)]=true;});
  if(isObj(p.fast))Object.keys(p.fast).forEach(k=>{const d=parseInt(k);if(d>=0&&d<=6&&(p.fast[k]==='full'||p.fast[k]==='part'))out.fast[d]=p.fast[k];});
  // Dates kept: three weeks back (what was planned, and what was taken off the log) to three ahead.
  const td=today(),lo=addDays(td,-21),hi=addDays(td,21);const okDate=k=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&k>=lo&&k<=hi;
  if(isObj(p.dated))Object.keys(p.dated).filter(okDate).forEach(k=>{const l=(Array.isArray(p.dated[k])?p.dated[k]:[]).map(cleanPlanMeal).filter(Boolean).slice(0,PLAN_MAX_MEALS);if(l.length)out.dated[k]=l;});
  const ids=v=>(Array.isArray(v)?v:[]).filter(x=>typeof x==='string'&&x).map(x=>x.slice(0,60)).slice(0,20);
  if(isObj(p.skip))Object.keys(p.skip).filter(okDate).forEach(k=>{const l=ids(p.skip[k]);if(l.length)out.skip[k]=l;});
  if(isObj(p.declined))Object.keys(p.declined).filter(okDate).forEach(k=>{const l=ids(p.declined[k]);if(l.length)out.declined[k]=l;});
  if(isObj(p.fastOn))Object.keys(p.fastOn).filter(okDate).forEach(k=>{if(['full','part','eat'].includes(p.fastOn[k]))out.fastOn[k]=p.fastOn[k];});
  out.auto=p.auto!==false;
  if(Array.isArray(p.extras))out.extras=p.extras.filter(x=>isObj(x)&&String(x.name||'').trim()).slice(0,60)
    .map(x=>({id:typeof x.id==='string'&&/^[\w-]{1,40}$/.test(x.id)?x.id:uid(),name:String(x.name).replace(/\s+/g,' ').trim().slice(0,60)}));
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
function planSortMeals(meals){
  const order=['Breakfast','Pre-workout','Lunch','Snack','Post-workout','Dinner'];
  return meals.slice().sort((a,b)=>order.indexOf(a.type)-order.indexOf(b.type));
}
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
    if(parseFloat(it.sg)>0){o.sg=parseFloat(it.sg);if(amtUnit(it.unit,it.sg)!=='serv')o.unit=it.unit;}
    if(it.est)o.est=true;
    return o;
  });
  return Object.assign({id:uid(),date,type,name:type,items:out,protein:r1(tp),carbs:r1(tc),fat:r1(tf),cals:Math.round(tk)},extra||{});
}

// ─── Every week, or one date ───
// The plan has two layers. days[dow] are meals that repeat every week ("every Tuesday"); dated
// holds meals for one date only, this week or next. skip takes a repeating meal off one date.
// A day's plan is its weekday's repeating meals, less the skipped ones, plus that date's own.
function planWeekStart(offset){const td=today();const i=weekOrder().indexOf(dayDate(td).getDay());return addDays(td,-i+7*(offset||0));}
function planWeekDates(offset){const s=planWeekStart(offset);return[0,1,2,3,4,5,6].map(i=>addDays(s,i));}
function planLastDate(){return addDays(planWeekStart(1),6);}
function planDow(ds){return dayDate(ds).getDay();}
function planIsRec(dow,id){return(S.mealPlan.days[dow]||[]).some(m=>m.id===id);}
// [{m, rec}] for a date: rec is true for a repeating meal.
function planEntries(ds){
  const dow=planDow(ds);const skip=new Set((S.mealPlan.skip||{})[ds]||[]);
  const rec=(S.mealPlan.days[dow]||[]).filter(m=>!skip.has(m.id)).map(m=>({m,rec:true}));
  const own=((S.mealPlan.dated||{})[ds]||[]).map(m=>({m,rec:false}));
  const order=['Breakfast','Pre-workout','Lunch','Snack','Post-workout','Dinner'];
  return rec.concat(own).sort((a,b)=>order.indexOf(a.m.type)-order.indexOf(b.m.type));
}
function planMealsOn(ds){return planEntries(ds).map(e=>e.m);}
function planFindOn(ds,id){return planEntries(ds).find(e=>e.m.id===id)||null;}
function planHasMeals(){
  return S.mealPlan.days.some(d=>d.length>0)||Object.keys(S.mealPlan.dated||{}).some(ds=>ds>=today()&&(S.mealPlan.dated[ds]||[]).length>0);
}
function planFindMeal(dow,id){return(S.mealPlan.days[dow]||[]).find(m=>m.id===id)||null;}

// ─── Targets for a planned day, and fasting ───
// A date's targets are that day's own (training or rest). A fast day aims at nothing; a light day
// at about 500 kcal (600 for a man), the 5:2 kind, with most of it as protein. A fast can be set
// for one date, or for a weekday every week; a date's own setting wins.
function planFast(dow){const f=S.mealPlan&&S.mealPlan.fast?S.mealPlan.fast[dow]:null;return f==='full'||f==='part'?f:null;}
function planFastOn(ds){
  const own=S.mealPlan&&S.mealPlan.fastOn?S.mealPlan.fastOn[ds]:null;
  if(own==='full'||own==='part')return own;if(own==='eat')return null;
  return planFast(planDow(ds));
}
function planFastDays(){return PLAN_ORDER.filter(d=>planFast(d)).concat(Object.keys(S.mealPlan.fastOn||{}).filter(ds=>ds>=today()&&S.mealPlan.fastOn[ds]!=='eat'));}
function lightDayKcal(){return isFemale()?500:600;}
function fastTarget(g,f){
  if(f==='full')return{protein:0,carbs:0,fat:0,cals:0,fast:'full',base:g};
  if(f==='part'){const k=Math.min(g.cals||0,lightDayKcal());return{protein:Math.min(g.protein||0,Math.round(k*0.45/4)),carbs:Math.round(k*0.3/4),fat:Math.round(k*0.25/9),cals:k,fast:'part',base:g};}
  return{protein:g.protein||0,carbs:g.carbs||0,fat:g.fat||0,cals:Math.round(g.cals||0),fast:null,base:g};
}
// For the weekly pattern (the coach reads it): what that weekday will usually be.
function planDayTarget(dow){return fastTarget((dow===todayDow()?goalsFor(today()):goalsForDow(dow))||{protein:0,carbs:0,fat:0,cals:0},planFast(dow));}
function planDateTarget(ds){return fastTarget(goalsFor(ds)||{protein:0,carbs:0,fat:0,cals:0},planFastOn(ds));}
// Eat / light / fast for one date. every: make it that weekday's setting every week instead.
function setPlanFastOn(ds,kind,every){
  if(!isObj(S.mealPlan.fastOn))S.mealPlan.fastOn={};if(!isObj(S.mealPlan.fast))S.mealPlan.fast={};
  const dow=planDow(ds);
  if(every){if(kind==='full'||kind==='part')S.mealPlan.fast[dow]=kind;else delete S.mealPlan.fast[dow];delete S.mealPlan.fastOn[ds];}
  else{
    const rec=planFast(dow);const want=kind==='full'||kind==='part'?kind:null;
    if(want===rec)delete S.mealPlan.fastOn[ds];else S.mealPlan.fastOn[ds]=want||'eat';
  }
  planTouch();refreshPlanViews();
  if(kind==='full'&&planMealsOn(ds).length)toast(`${fmtDay(ds)} has meals planned; they stay until you remove them`,'',{ms:3200});
}
function setPlanFast(dow,kind){
  if(!isObj(S.mealPlan.fast))S.mealPlan.fast={};
  if(kind==='full'||kind==='part')S.mealPlan.fast[dow]=kind;else delete S.mealPlan.fast[dow];
  planTouch();refreshPlanViews();
}
// What to say about a week's fasting. Not a block: the plan is yours to set.
function fastWarnings(offset){
  const dates=planWeekDates(offset||0);const fd=dates.filter(ds=>planFastOn(ds));const out=[];if(!fd.length)return out;
  const sd=ds=>`${PLAN_SHORT[planDow(ds)]}`;
  if(fd.length>2)out.push({tone:fd.length>=4?'bad':'warn',text:`${fd.length} fasting days in one week. Plans built on fasting (5:2, alternate-day) stop at two a week; more than that is hard to train on and makes protein hard to keep up.`});
  const pairs=[];dates.forEach(ds=>{const n=addDays(ds,1);if(planFastOn(ds)&&planFastOn(n))pairs.push(`${sd(ds)}–${sd(n)}`);});
  if(pairs.length)out.push({tone:'warn',text:`Back-to-back fasting (${pairs.join(', ')}). Put a normal day between them.`});
  const train=fd.filter(ds=>planFastOn(ds)==='full'&&hasFixedSchedule()&&isTrainingDay(ds));
  if(train.length)out.push({tone:'warn',text:`${train.map(ds=>PLAN_DAYS[planDow(ds)]).join(' and ')} ${train.length===1?'is a training day':'are training days'}. A full fast costs the session; move it, or make it a light day.`});
  const fed=fd.filter(ds=>planFastOn(ds)==='full'&&planMealsOn(ds).length);
  if(fed.length)out.push({tone:'warn',text:`${fed.map(ds=>PLAN_DAYS[planDow(ds)]).join(' and ')} ${fed.length===1?'is':'are'} set as a fast but still ${fed.length===1?'has':'have'} meals planned.`});
  const avg=dates.reduce((t,ds)=>t+planDateTarget(ds).cals,0)/7;
  if(avg<calorieFloor())out.push({tone:'bad',text:`With these fasts the week averages ${Math.round(avg).toLocaleString()} kcal a day, below ${calorieFloor().toLocaleString()}, the usual floor for a ${isFemale()?'woman':'man'}. Going lower is a decision to make with a doctor.`});
  return out;
}

// ─── A week in numbers ───
// planned: what is planned; target: what each day aims at (a fast day's own target); base: your
// usual targets. A day counts as planned once it reaches 80% of its target (a fast always does);
// until every day has, the week shows what is still to plan rather than a deficit it does not mean.
function planWeekInfo(offset){
  const days=planWeekDates(offset||0).map(ds=>{
    const meals=planMealsOn(ds);const t=planDayTotals(meals);const g=planDateTarget(ds);
    return{ds,dow:planDow(ds),meals,t,g,fast:g.fast,covered:meals.length>0||!!g.fast};
  });
  const sum=(arr,f)=>arr.reduce((a,d)=>a+f(d),0);
  const planned=Math.round(sum(days,d=>d.t.cals)),protein=r1(sum(days,d=>d.t.protein));
  const base=Math.round(sum(days,d=>d.g.base.cals||0));
  const delta=planned-base;
  const open=days.filter(d=>!d.fast&&d.g.cals>0&&d.t.cals<d.g.cals*0.8);
  const toPlan=Math.round(open.reduce((a,d)=>a+(d.g.cals-d.t.cals),0));
  return{days,planned,protein,base,covered:days.filter(d=>d.covered).length,delta,perWeek:Math.round(delta/kcalPerWeightUnit()*100)/100,
    open:open.length,toPlan,avg:Math.round(planned/7),avgP:Math.round(protein/7)};
}

// ─── Planned meals in the day's log ───
// With auto on (the default), a planned meal is added to the day's log when its time comes:
// breakfast from 5 am, lunch from 11, snack from 3 pm, dinner from 5 pm. It counts like any
// meal you logged. If you did not eat it, "Didn't eat" takes it off and it is not added again;
// the plan itself is untouched. Nothing is ever added to a day that has gone: a day you did not
// open the app on stays as you left it.
const PLAN_MEAL_HOUR={Breakfast:5,'Pre-workout':7,Lunch:11,'Post-workout':12,Snack:15,Dinner:17};
function planAuto(){return !!(S.mealPlan&&S.mealPlan.auto!==false);}
function planDeclined(ds,id){return((S.mealPlan.declined||{})[ds]||[]).includes(id);}
function planHourNow(){const ds=today();const cal=dstr(new Date());return cal!==ds?24+new Date().getHours():new Date().getHours();}
function planDueHour(m){const h=PLAN_MEAL_HOUR[m.type];return h==null?12:h;}
function planAutoLog(){
  if(!S.onboarded||!planAuto()||!S.mealPlan)return[];
  const ds=today();if(planFastOn(ds)==='full')return[];
  const h=planHourNow();const added=[];
  planMealsOn(ds).forEach(m=>{
    if(planDueHour(m)>h||planMealLogged(m.id,ds)||planDeclined(ds,m.id))return;
    const e=mealEntryFromItems(m.items,m.type,ds,{planMealId:m.id,savedMealName:m.name||null,fromPlan:true});
    S.meals.push(e);added.push(e.id);
  });
  if(added.length)save();
  return added;
}
function addDeclined(ds,id){
  if(!isObj(S.mealPlan.declined))S.mealPlan.declined={};
  const a=S.mealPlan.declined[ds]||(S.mealPlan.declined[ds]=[]);if(!a.includes(id))a.push(id);
}
function dropDeclined(ds,id){const a=(S.mealPlan.declined||{})[ds];if(a){S.mealPlan.declined[ds]=a.filter(x=>x!==id);if(!S.mealPlan.declined[ds].length)delete S.mealPlan.declined[ds];}}
// Take a planned meal off the day's count: you did not eat it. The plan stays as it is.
function planDidntEat(entryId){
  const i=(S.meals||[]).findIndex(m=>m.id===entryId);if(i<0)return;
  const gone=S.meals.splice(i,1)[0];if(gone.planMealId)addDeclined(gone.date,gone.planMealId);
  save();mealsChanged();
  toast(`${gone.savedMealName||gone.type} taken off ${gone.date===today()?'today':fmtDay(gone.date)}`,'',{action:'Undo',onAction:()=>{
    S.meals.splice(Math.min(i,S.meals.length),0,gone);if(gone.planMealId)dropDeclined(gone.date,gone.planMealId);save();mealsChanged();}});
}
function setPlanAuto(on){
  S.mealPlan.auto=!!on;save();
  if(on){const n=planAutoLog().length;if(n)toast(`${n} planned meal${n===1?'':'s'} added to today`,'green');}
  refreshPlanViews();
}
// Drop the copy a planned meal put in a day's log by itself, when that meal leaves the plan for that day.
function planUnlog(ds,id){
  const before=S.meals.length;S.meals=S.meals.filter(m=>!(m.date===ds&&m.planMealId===id&&m.fromPlan));return before!==S.meals.length;
}

// ─── Logging a planned meal by hand ───
function logPlanMeal(dow,id,ds){
  ds=ds||today();
  const e0=planFindOn(ds,id);const m=e0?e0.m:planFindMeal(dow,id);if(!m)return null;
  const entry=mealEntryFromItems(m.items,m.type,ds,{planMealId:m.id,savedMealName:m.name||null});
  S.meals.push(entry);dropDeclined(ds,m.id);
  m.items.forEach(it=>{if(it.foodId&&findFood(it.foodId))trackRecent(it.foodId);});
  save();
  return entry;
}
// To the date it is planned for when that is today or earlier; a planned meal on a coming day goes to today.
function tapLogPlanMeal(dow,id,ds){
  const to=ds&&ds<=today()?ds:today();
  const e=logPlanMeal(dow,id,to);if(!e)return;
  refreshPlanViews();
  toast(`${e.savedMealName||e.type} logged${to===today()?'':' to '+fmtDay(to)} · ${e.cals} kcal`,'green',{action:'Undo',onAction:()=>{S.meals=S.meals.filter(x=>x.id!==e.id);save();refreshPlanViews();}});
}
function refreshPlanViews(){
  if(S.tab==='nutrition'&&!S.activeWorkout)renderNutrition(document.getElementById('content'));
  else if(S.tab==='workout'&&!S.activeWorkout&&(!S.homeView||S.homeView==='schedule'))render(); // Home's Nutrition layout logs from it; Schedule shows it
  if(document.getElementById('plan-ov'))renderMealPlanSheet();
  if(document.getElementById('grocery-ov'))renderGroceryList();
}

// ─── Nutrition-tab card: what is still to come today ───
function mealPlanCardHTML(){
  const td=today();const dow=todayDow();
  const all=planMealsOn(td);const f=planFastOn(td);
  if(!all.length&&!f)return'';
  const auto=planAuto();const h=planHourNow();
  // With auto on, a meal already in the log (or taken off it) is not repeated here.
  // With auto on the card is what is still to come (eaten ones are already in the log); off, it
  // is the whole day with what has been logged ticked.
  const meals=auto?all.filter(m=>!planMealLogged(m.id,td)&&!planDeclined(td,m.id)):all;
  const g=planDateTarget(td);const t=planDayTotals(all);
  if(!meals.length&&!f&&auto)return'';
  const rows=meals.map(m=>{
    const mt=planMealTotals(m);const due=planDueHour(m);const done=planMealLogged(m.id,td);
    const when=auto?`Counts from ${due===12?'noon':due<12?due+' am':(due-12)+' pm'}`:'';
    return`<div class="plan-row"><div style="flex:1;min-width:0">
        <div class="plan-type">${esc(m.type)}${when?` · ${when}`:''}</div>
        <div class="plan-name">${esc(m.name||m.items.map(it=>it.name).join(', '))}</div>
        <div class="plan-meta">${mt.cals} kcal · P${fmt1(mt.protein)} C${fmt1(mt.carbs)} F${fmt1(mt.fat)}</div>
      </div>${done?`<span class="plan-done">✓ Logged</span>`:`<button class="btn ${auto?'bts':'btp'} bsm" onclick="tapLogPlanMeal(${dow},${jsq(m.id)},${jsq(td)})">${auto?'Ate it':'Log'}</button>`}</div>`;
  }).join('');
  const head=f==='full'?'Fasting day':f==='part'?`Light day · ${g.cals} kcal`:`${t.cals.toLocaleString()} / ${g.cals.toLocaleString()} kcal planned`;
  return`<div class="card" id="plan-card"><button class="ch ch-tap" onclick="showMealPlan()"><span class="ct">${auto?'Still to come today':'Planned today'}</span>
      <span class="plan-head-s">${esc(head)}</span><span class="row-chev">${ICON('chev',16)}</span></button>
    ${rows||`<div class="cb" style="font-size:13px;color:var(--muted)">${f==='full'?'Nothing planned: today is a fast.':'Nothing else planned.'}</div>`}
  </div>`;
}

function planItemHTML(it){
  return`<div class="plan-item"><span>${esc(it.name)}${it.est?' <i>est.</i>':''} <em>${amtUnit(it.unit,it.sg)!=='serv'?itemAmt(it):`${fmtQty(it.qty)} × ${esc(it.serving||'serving')}`}</em></span><span class="mono">${mealItemTotals(it).cals}</span></div>`;
}

// ─── The plan page ───
// This week or next: seven bars against each day's target (tap one to open it), then that day:
// eat / light / fast, what is planned (every week, or that date only), and suggestions from your
// saved meals and stars to reach the target. Everything on it moves the numbers at the top.
// at: a date, or a weekday number (this week's), or nothing for today.
function showMealPlan(at){
  let ds=today();
  if(typeof at==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(at))ds=at;
  else if(typeof at==='number'&&at>=0&&at<=6)ds=planWeekDates(0).find(d=>planDow(d)===at)||ds;
  if(ds>planLastDate())ds=planWeekDates(1).find(d=>planDow(d)===planDow(ds)); // further ahead: the same weekday next week
  if(ds<planWeekStart(0))ds=today();
  window._planDate=ds;window._planOpen=null;
  const ov=makeOv('plan-ov');
  ov.innerHTML=`<div class="modal page plan-page"><div class="mh"></div><div id="plan-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderMealPlanSheet();
}
function planWeekOf(ds){return ds>=planWeekStart(1)?1:0;}
function setPlanDate(ds){window._planDate=ds;window._planOpen=null;renderMealPlanSheet();}
// The other week, on the same weekday.
function setPlanWeek(w){const ds=window._planDate||today();setPlanDate(planWeekDates(w).find(d=>planDow(d)===planDow(ds)));}
function setPlanDow(d){setPlanDate(planWeekDates(planWeekOf(window._planDate||today())).find(x=>planDow(x)===d));}
function planBarsHTML(w,sel){
  const top=Math.max(1,...w.days.map(d=>Math.max(d.t.cals,d.g.base.cals||0)))*1.1;const td=today();
  return`<div class="pl-strip" role="tablist" aria-label="Days of the week">${w.days.map(d=>{
    const g=d.fast?d.g.cals:d.g.base.cals||0;const r=g>0?d.t.cals/g:null;
    const cls=d.fast&&!d.t.cals?'fast':!d.t.cals?'':r==null?'':Math.abs(r-1)<=0.05?'on':r>1?'over':'under';
    const h=d.t.cals?Math.max(4,Math.round(d.t.cals/top*100)):0;const line=g>0?Math.round(g/top*100):0;
    return`<button class="pl-d${d.ds===sel?' sel':''}${d.ds<td?' past':''}" role="tab" aria-selected="${d.ds===sel}" onclick="setPlanDate(${jsq(d.ds)})" aria-label="${fmtDay(d.ds)}: ${d.fast==='full'?'fast':d.t.cals?d.t.cals+' of '+g+' kcal':'nothing planned'}">
      <span class="pl-bar">${line?`<s style="bottom:${line}%"></s>`:''}<i class="${cls}" style="height:${h}%"></i>${d.fast?`<em>${d.fast==='full'?'Fast':'Light'}</em>`:''}</span>
      <b>${PLAN_SHORT[d.dow].slice(0,2)}${d.ds===td?'<u></u>':''}</b><span>${d.t.cals?fmtK(d.t.cals):d.fast==='full'?'0':'–'}</span></button>`;}).join('')}</div>`;
}
function planDateLabel(ds){return dayDate(ds).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});}
function renderMealPlanSheet(){
  const el=document.getElementById('plan-body');if(!el)return;
  const m0=el.closest('.modal');const y=m0?m0.scrollTop:0;
  const td=today();let ds=window._planDate||td;if(ds<planWeekStart(0)||ds>planLastDate())ds=window._planDate=td;
  const wk=planWeekOf(ds);const dow=planDow(ds);const isToday=ds===td,past=ds<td;
  const w=planWeekInfo(wk);const u=S.unit==='kg'?'kg':'lb';
  const ents=planEntries(ds);const meals=ents.map(e=>e.m);
  const t=planDayTotals(meals);const g=planDateTarget(ds);const f=g.fast;
  const recFast=planFast(dow);const ownFast=(S.mealPlan.fastOn||{})[ds];
  const kind=hasFixedSchedule()?(isTrainingDay(ds)?'Training day':'Rest day'):'';
  const warn=fastWarnings(wk);
  let h=`<div class="pg-head"><div class="mt">Meal plan</div>${planHasMeals()?`<button class="btn bts bsm" onclick="showGroceryList(${wk})">${ICON('cart',15)} Grocery list</button>`:''}</div>`;
  if(S.mealPlan.note)h+=`<div class="ai-note">${esc(S.mealPlan.note)}</div>`;
  h+=`<div class="seg pl-weeks" role="group" aria-label="Which week"><button class="seg-b${!wk?' on':''}" aria-pressed="${!wk}" onclick="setPlanWeek(0)">This week</button><button class="seg-b${wk?' on':''}" aria-pressed="${!!wk}" onclick="setPlanWeek(1)">Next week · ${fmtDay(planWeekStart(1))}</button></div>`;
  const dTone=w.open?'under':Math.abs(w.delta)<=420?'on':w.delta<0?'under':'over';
  h+=`<div class="pl-week">
    <div class="pl-wk-top"><div><div class="pl-big">${w.planned.toLocaleString()}</div><div class="pl-sub">kcal planned ${wk?'next':'this'} week · your targets add up to ${w.base.toLocaleString()}</div></div>
      ${w.open?`<div class="pl-delta ${dTone}"><b>${w.toPlan.toLocaleString()}</b><span>left to plan on ${w.open} day${w.open===1?'':'s'}</span></div>`
        :`<div class="pl-delta ${dTone}"><b>${w.delta>0?'+':w.delta<0?'−':''}${Math.abs(w.delta).toLocaleString()}</b><span>${Math.abs(w.perWeek)>=0.05?`≈ ${w.perWeek>0?'+':'−'}${fmt1(Math.abs(w.perWeek))} ${u} a week`:'on target'}</span></div>`}</div>
    ${planBarsHTML(w,ds)}
    <div class="pl-wk-stats"><span><b>${w.avg?w.avg.toLocaleString():'–'}</b> kcal a day</span><span><b>${w.avgP||'–'}</b> g protein a day</span><span><b>${7-w.open}</b> of 7 days planned</span></div>
  </div>`;
  if(warn.length){const tone=warn.some(x=>x.tone==='bad')?'bad':'warn';
    h+=`<div class="pl-warn tone-${tone}">${ICON('alert',16)}<div>${warn.map(x=>`<p>${esc(x.text)}</p>`).join('')}</div></div>`;}
  // The day
  h+=`<div class="pl-dayh"><b>${esc(planDateLabel(ds))}</b>${isToday?'<span class="pill pill-acc">Today</span>':past?'<span class="pill">Past</span>':''}${kind?`<span class="pill">${kind}</span>`:''}</div>`;
  if(!past){
    h+=`<div class="seg pl-fast" role="group" aria-label="What kind of day">
      <button class="seg-b${!f?' on':''}" aria-pressed="${!f}" onclick="setPlanFastOn(${jsq(ds)},null)">Eat</button>
      <button class="seg-b${f==='part'?' on':''}" aria-pressed="${f==='part'}" onclick="setPlanFastOn(${jsq(ds)},'part')">Light day</button>
      <button class="seg-b${f==='full'?' on':''}" aria-pressed="${f==='full'}" onclick="setPlanFastOn(${jsq(ds)},'full')">Fast</button></div>`;
    if(f&&recFast===f&&!ownFast)h+=`<div class="pl-rep">${ICON('repeat',13)}<span>${f==='full'?'A fast':'A light day'} every ${PLAN_DAYS[dow]}</span><a onclick="setPlanFastOn(${jsq(ds)},null,true)">Stop repeating</a></div>`;
    else if(f)h+=`<div class="pl-rep"><span>Just this ${PLAN_DAYS[dow]}</span><a onclick="setPlanFastOn(${jsq(ds)},${jsq(f)},true)">Every ${PLAN_DAYS[dow]}</a></div>`;
    else if(recFast)h+=`<div class="pl-rep"><span>Eating this ${PLAN_DAYS[dow]}; ${recFast==='full'?'a fast':'a light day'} other weeks</span><a onclick="setPlanFastOn(${jsq(ds)},null,true)">Stop repeating</a></div>`;
  }
  const pct=g.cals>0?Math.min(100,Math.round(t.cals/g.cals*100)):t.cals?100:0;
  const over=g.cals>0&&t.cals>g.cals*1.05;
  h+=`<div class="pl-daysum">
    <div class="pl-ds-top"><span><b>${t.cals.toLocaleString()}</b> of ${g.cals.toLocaleString()} kcal${f==='part'?' (light day)':f==='full'?' (fast)':''}</span><span class="${over?'pl-over':''}">${g.cals>0?(over?`${(t.cals-g.cals).toLocaleString()} over`:`${Math.max(0,g.cals-t.cals).toLocaleString()} to go`):''}</span></div>
    <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${pct}%;background:${over?'var(--red)':'var(--navy)'}"></div></div>
    <div class="pl-ds-m">P ${fmt1(t.protein)}${g.protein?' / '+Math.round(g.protein):''} g · C ${fmt1(t.carbs)} · F ${fmt1(t.fat)}</div>
  </div>`;
  if(f==='full'&&!meals.length)h+=`<div class="pl-fastnote">${ICON('moon',16)}<span>A fast: water, black coffee or tea. Nothing to plan or buy for this day.</span></div>`;
  h+=`<div class="pl-meals">${ents.map(e=>planMealHTML(ds,e,isToday,past)).join('')}</div>`;
  if(!past){
    h+=`<button class="ms-addmore" onclick="planAddMeal(${jsq(ds)})">${ICON('plus',16)} Add a meal to ${PLAN_DAYS[dow]}</button>`;
    h+=planSuggestHTML(ds);
  }
  // Tools for the day and the plan
  const tools=[];
  if(meals.length)tools.push(`<button class="btn bts bsm" onclick="showPlanCopy(${jsq(ds)})">${ICON('repeat',14)} Copy day to…</button>`);
  if(meals.length&&!past)tools.push(`<button class="btn bts bsm" onclick="planClearDay(${jsq(ds)})">Clear day</button>`);
  tools.push(`<button class="btn bts bsm" onclick="closeOv('plan-ov');coachStart('${planHasMeals()?'mealplan-adjust':'mealplan'}')">${ICON('spark',14)} ${planHasMeals()?'Adjust with coach':'Plan with coach'}</button>`);
  h+=`<div class="pl-tools">${tools.join('')}</div>`;
  h+=`<div class="pl-auto"><span class="pl-auto-t"><b>Planned meals count in my day</b><small>Each one is added to that day’s log when its time comes (breakfast 5 am, lunch 11, snack 3 pm, dinner 5 pm). Didn’t eat it? Take it off on the Nutrition tab; the plan stays.</small></span>
    <button class="tog${planAuto()?' on':''}" role="switch" aria-checked="${planAuto()}" aria-label="Planned meals count in my day" onclick="setPlanAuto(${!planAuto()})"></button></div>`;
  if(planHasMeals()||planFastDays().length)h+=`<button class="btn btg bfw" style="margin-top:6px;color:var(--red)" onclick="planClearAll()">Clear the whole plan</button>`;
  el.innerHTML=h;
  if(m0)m0.scrollTop=y;
}
// A planned meal: one line until tapped; then its foods, its size, and what can be done with it.
function planMealHTML(ds,e,isToday,past){
  const m=e.m;const dow=planDow(ds);
  const mt=planMealTotals(m);const open=window._planOpen===m.id;const done=ds<=today()&&planMealLogged(m.id,ds);
  const pt=parseFloat(m.portion)||1;
  return`<div class="pl-meal${open?' open':''}">
    <button class="pl-mh" onclick="togglePlanMeal(${jsq(m.id)})" aria-expanded="${open}">
      <span class="pl-mt"><span class="plan-type">${esc(m.type)}${e.rec?` · <span class="pl-every">${ICON('repeat',11)} every ${PLAN_SHORT[dow]}</span>`:''}${done?' · <span class="plan-done">✓ Logged</span>':''}</span>
        <span class="plan-name">${esc(m.name||m.items.map(it=>it.name).join(', '))}</span>
        ${m.name&&!open?`<span class="plan-meta">${esc(m.items.map(it=>it.name).join(', '))}</span>`:''}</span>
      <span class="pl-mk"><b>${mt.cals}</b><span>P ${fmt1(mt.protein)}</span></span></button>
    ${open?`<div class="pl-mb">${m.items.map(planItemHTML).join('')}
      <div class="pl-portion"><span>Portion</span><button class="ib" onclick="planPortion(${jsq(ds)},${jsq(m.id)},-1)" aria-label="Smaller"${pt<=0.5?' disabled':''}>−</button><b>${fmtAmt(pt)}×</b><button class="ib" onclick="planPortion(${jsq(ds)},${jsq(m.id)},1)" aria-label="Bigger"${pt>=3?' disabled':''}>+</button>
        <span class="pl-pm">C ${fmt1(mt.carbs)} · F ${fmt1(mt.fat)}</span></div>
      ${e.rec&&!past?`<div class="fine pl-recnote">Changes here apply every ${PLAN_DAYS[dow]}. To change only this one, use Edit and turn off Every ${PLAN_DAYS[dow]}.</div>`:''}
      <div class="pl-acts">
        ${done?'':isToday?`<button class="btn btp bsm" onclick="tapLogPlanMeal(${dow},${jsq(m.id)},${jsq(ds)})">Log now</button>`:past?`<button class="btn bts bsm" onclick="tapLogPlanMeal(${dow},${jsq(m.id)},${jsq(ds)})">Log to ${PLAN_SHORT[dow]}</button>`:''}
        <button class="btn bts bsm" onclick="planEditMeal(${jsq(ds)},${jsq(m.id)})">${ICON('pencil',14)} Edit</button>
        <button class="btn bts bsm" onclick="showPlanCopy(${jsq(ds)},${jsq(m.id)})">${ICON('repeat',14)} Copy to…</button>
        <button class="ib pl-rm" onclick="planRemoveMeal(${jsq(ds)},${jsq(m.id)})" aria-label="Remove from the plan">${ICON('x',15)}</button>
      </div></div>`:''}
  </div>`;
}
function togglePlanMeal(id){window._planOpen=window._planOpen===id?null:id;renderMealPlanSheet();}
// Bigger or smaller, in steps: every food in the meal moves together.
const PLAN_PORTIONS=[0.5,0.75,1,1.25,1.5,2,2.5,3];
function planPortion(ds,id,dir){
  if(typeof ds==='number')ds=planWeekDates(0).find(d=>planDow(d)===ds); // older callers pass a weekday
  const e=planFindOn(ds,id);if(!e)return;const m=e.m;
  const cur=parseFloat(m.portion)||1;
  const i=PLAN_PORTIONS.reduce((b,p,j)=>Math.abs(p-cur)<Math.abs(PLAN_PORTIONS[b]-cur)?j:b,0);
  const next=PLAN_PORTIONS[Math.max(0,Math.min(PLAN_PORTIONS.length-1,i+(dir>0?1:-1)))];
  if(Math.abs(next-cur)<1e-9)return;
  const k=next/cur;
  m.items.forEach(it=>{const w=amtUnit(it.unit,it.sg)!=='serv';it.qty=w?Math.round(it.qty*k*10000)/10000:Math.round(it.qty*k*100)/100;});
  if(next===1)delete m.portion;else m.portion=next;
  planTouch();refreshPlanViews();
}

// ─── Suggestions to reach the day's target ───
// From what you already eat: saved meals, starred foods (at their amounts) and meals planned on
// other days. Single picks that fit what is left, protein first; and the best set of up to three
// that fills the day. No AI and no network.
function planCandidates(ds){
  const out=[];const seen=new Set();const here=new Set(planMealsOn(ds).map(m=>m.id));
  const keyOf=(name,k)=>String(name).toLowerCase()+'|'+Math.round(k/10);
  planMealsOn(ds).forEach(m=>seen.add(keyOf(m.name||m.items.map(it=>it.name).join(', '),planMealTotals(m).cals))); // not what the day already has
  const add=(x)=>{const key=keyOf(x.name,x.t.cals);if(x.t.cals<=0||seen.has(key))return;seen.add(key);out.push(x);};
  savedMealsByUse().forEach(c=>add({key:'sm:'+c.id,name:c.name,src:isMealStarred(c.id)?'Starred meal':'Saved meal',items:c.items.map(it=>Object.assign({},it)),t:savedMealTotals(c)}));
  starEntries().filter(e=>e.kind==='food').forEach(e=>{
    const it=foodItem(e.food,e.qty);if(e.unit!=='serv'&&it.sg>0)it.unit=e.unit;else delete it.unit;
    add({key:'st:'+e.star.id,name:e.name,src:`Starred · ${e.amt}`,items:[it],t:e.m});
  });
  planWeekDates(0).concat(planWeekDates(1)).filter(d=>d!==ds).forEach(d=>planMealsOn(d).forEach(m=>{if(here.has(m.id))return;
    add({key:`pm:${d}:${m.id}`,name:m.name||m.items.map(it=>it.name).join(', '),src:`${PLAN_SHORT[planDow(d)]} ${m.type.toLowerCase()}`,type:m.type,items:m.items.map(it=>Object.assign({},it)),t:planMealTotals(m)});}));
  return out;
}
function planSuggest(ds){
  if(typeof ds==='number')ds=planWeekDates(0).find(d=>planDow(d)===ds);
  const g=planDateTarget(ds);const t=planDayTotals(planMealsOn(ds));
  const left=Math.round(g.cals-t.cals),leftP=r1((g.protein||0)-t.protein);
  const res={left,leftP,singles:[],fill:null,none:false};
  if(g.fast==='full'||left<120)return res;
  const cand=planCandidates(ds);if(!cand.length){res.none=true;return res;}
  const fits=cand.filter(x=>x.t.cals<=left*1.05+20);
  const dens=x=>x.t.protein*4/Math.max(1,x.t.cals);
  res.singles=fits.slice().sort((a,b)=>(leftP>5?dens(b)-dens(a):0)||Math.abs(left/2-a.t.cals)-Math.abs(left/2-b.t.cals)).slice(0,4);
  // Fill: one to three different picks that land between 90% and 105% of what is left, the most protein first.
  const pool=fits.slice().sort((a,b)=>dens(b)-dens(a)).slice(0,24);
  let best=null;
  const consider=set=>{
    const k=set.reduce((s,x)=>s+x.t.cals,0);if(k<left*0.9||k>left*1.05+20)return;
    const p=set.reduce((s,x)=>s+x.t.protein,0);
    const score=(leftP>5?Math.min(p,leftP*1.1):0)*10-Math.abs(left-k)-set.length*15;
    if(!best||score>best.score)best={set,k,p:r1(p),score};
  };
  for(let i=0;i<pool.length;i++){consider([pool[i]]);for(let j=i+1;j<pool.length;j++){consider([pool[i],pool[j]]);for(let l=j+1;l<pool.length;l++)consider([pool[i],pool[j],pool[l]]);}}
  if(best&&best.set.length>1)res.fill=best;
  return res;
}
function planSuggestHTML(ds){
  const s=planSuggest(ds);const tg=planDateTarget(ds).cals;
  if(s.left<120&&!s.none)return'';
  if(s.none)return`<div class="sec-h pl-sh">Reach ${tg.toLocaleString()} kcal</div><div class="fine pl-fine">Save meals or star foods and they are offered here to fill the day, sized to what is left.</div>`;
  if(!s.singles.length&&!s.fill)return'';
  window._planSug={ds,list:s.singles,fill:s.fill?s.fill.set:null};
  let h=`<div class="sec-h pl-sh"><span>Reach ${tg.toLocaleString()} kcal</span><span class="pl-left">${s.left.toLocaleString()} kcal${s.leftP>5?` · ${fmt1(s.leftP)} g protein`:''} to go</span></div>`;
  if(s.fill)h+=`<div class="pl-fill"><div class="pl-fill-t"><b>Fills the day</b><span>${s.fill.k.toLocaleString()} kcal · ${fmt1(s.fill.p)} g protein</span></div>
    <div class="pl-fill-l">${s.fill.set.map(x=>esc(x.name)).join(' + ')}</div>
    <button class="btn btp bsm" onclick="planAddFill()">Add all ${s.fill.set.length}</button></div>`;
  h+=`<div class="list pl-sug">${s.singles.map((x,i)=>`<div class="row"><span class="row-main"><span class="row-t">${esc(x.name)}</span><span class="row-s">${esc(x.src)} · P ${fmt1(x.t.protein)}</span></span><span class="pl-sk">${x.t.cals}</span>
    <button class="ib ib-q pl-add" onclick="planAddSuggestion(${i})" aria-label="Add ${esc(x.name)}">${ICON('plus',16)}</button></div>`).join('')}</div>`;
  return h;
}
// The meal a suggestion goes in as: the first of breakfast, lunch, dinner not yet planned that day.
function planNextType(ds,want){
  if(want&&MEAL_TYPES.includes(want))return want;
  if(typeof ds==='number')ds=planWeekDates(0).find(d=>planDow(d)===ds);
  const have=new Set(planMealsOn(ds).map(m=>m.type));
  return['Breakfast','Lunch','Dinner'].find(t=>!have.has(t))||'Snack';
}
function planDatedList(ds){if(!isObj(S.mealPlan.dated))S.mealPlan.dated={};return S.mealPlan.dated[ds]||(S.mealPlan.dated[ds]=[]);}
// Suggestions go in for that date only.
function planAddCandidates(ds,list){
  if(typeof ds==='number')ds=planWeekDates(0).find(d=>planDow(d)===ds);
  const added=[];
  list.forEach(x=>{
    if(planMealsOn(ds).length>=PLAN_MAX_MEALS)return;
    const m=cleanPlanMeal({id:uid(),type:planNextType(ds,x.type),name:x.items.length>1||x.key.startsWith('sm:')?x.name:'',items:x.items});
    if(m){planDatedList(ds).push(m);added.push(m.id);}
  });
  if(added.length){planTouch();refreshPlanViews();
    toast(`${added.length===1?'Added':added.length+' meals added'} to ${fmtDay(ds)}`,'green',{action:'Undo',onAction:()=>{S.mealPlan.dated[ds]=(S.mealPlan.dated[ds]||[]).filter(m=>!added.includes(m.id));planTouch();refreshPlanViews();}});}
  else toast(`Up to ${PLAN_MAX_MEALS} meals a day`);
  return added;
}
function planAddSuggestion(i){const s=window._planSug;if(!s||!s.list[i])return;planAddCandidates(s.ds,[s.list[i]]);}
function planAddFill(){const s=window._planSug;if(!s||!s.fill)return;planAddCandidates(s.ds,s.fill);}

// ─── Adding and editing: the meal sheet in plan mode ───
// _mealTarget: {plan:dow, date, rec, replace?, wasRec?, type, name}. rec is the "Every <weekday>"
// switch on Review. A new meal is for that date only unless it is switched on.
function planAddMeal(ds){
  if(typeof ds==='number')ds=planWeekDates(0).find(d=>planDow(d)===ds);
  showAddMeal(null,false,{plan:planDow(ds),date:ds,rec:false,type:planNextType(ds)});
}
function planEditMeal(ds,id){
  if(typeof ds==='number')ds=planWeekDates(0).find(d=>planDow(d)===ds);
  const e=planFindOn(ds,id);if(!e)return;const m=e.m;
  _mealItems=m.items.map(it=>Object.assign({},it));
  window._loggedSavedMealId=null;window._mealEdit=null;window._comboEdit=null;window._swapIdx=null;
  window._mealTarget={plan:planDow(ds),date:ds,replace:id,rec:e.rec,wasRec:e.rec,name:m.name,type:m.type,portion:m.portion};
  showAddMeal(null,true);
}
function togglePlanRec(){
  const tg=window._mealTarget;if(!tg)return;tg.rec=!tg.rec;
  const b=document.getElementById('plan-rec');if(b){b.classList.toggle('on',tg.rec);b.setAttribute('aria-checked',tg.rec?'true':'false');}
  const s=document.getElementById('plan-rec-s');if(s)s.textContent=planRecNote(tg);
}
function planRecNote(tg){
  const day=PLAN_DAYS[tg.plan];
  if(tg.rec)return tg.wasRec?`Changes apply every ${day}.`:`Repeats every ${day} from now on.`;
  return tg.wasRec?`Only ${fmtDay(tg.date)} changes; other ${day}s keep the usual one.`:`Just ${fmtDay(tg.date)}.`;
}
function planRecRowHTML(tg){
  return`<div class="pl-recrow"><span class="row-main"><span class="row-t">Every ${PLAN_DAYS[tg.plan]}</span><span class="row-s" id="plan-rec-s">${esc(planRecNote(tg))}</span></span>
    <button class="tog${tg.rec?' on':''}" id="plan-rec" role="switch" aria-checked="${tg.rec?'true':'false'}" aria-label="Every ${PLAN_DAYS[tg.plan]}" onclick="togglePlanRec()"></button></div>`;
}
function planSaveFromBuilder(mealType,items){
  const tg=window._mealTarget;if(!tg)return false;
  const ds=tg.date||planWeekDates(0).find(d=>planDow(d)===tg.plan);const dow=planDow(ds);
  // A target with no date (the coach, older callers) works on the weekly plan, as the plan always did.
  if(!tg.date){tg.rec=true;tg.wasRec=!!(tg.replace&&planIsRec(dow,tg.replace));}
  const name=(document.getElementById('plan-meal-name')?.value||'').trim().slice(0,60);
  const id=tg.replace&&!(tg.wasRec&&!tg.rec)?tg.replace:uid(); // a one-day change to a repeating meal is a new meal
  const meal=cleanPlanMeal({id,type:mealType,name,items});
  if(!meal)return false;
  const rec=S.mealPlan.days[dow];const own=planDatedList(ds);
  const rm=(arr,x)=>{const i=arr.findIndex(m=>m.id===x);if(i>=0)arr.splice(i,1);return i;};
  if(tg.replace){
    if(tg.wasRec&&tg.rec){const i=rec.findIndex(m=>m.id===tg.replace);if(i>=0)rec[i]=meal;else rec.push(meal);}
    else if(tg.wasRec&&!tg.rec){ // this date only: the usual meal is skipped here, the changed one put in its place
      if(!isObj(S.mealPlan.skip))S.mealPlan.skip={};const sk=S.mealPlan.skip[ds]||(S.mealPlan.skip[ds]=[]);if(!sk.includes(tg.replace))sk.push(tg.replace);
      planUnlog(ds,tg.replace);own.push(meal);
    }
    else if(!tg.wasRec&&tg.rec){rm(own,tg.replace);rec.push(meal);}
    else{const i=own.findIndex(m=>m.id===tg.replace);if(i>=0)own[i]=meal;else own.push(meal);}
  }else{
    if(planMealsOn(ds).length>=PLAN_MAX_MEALS){toast(`Up to ${PLAN_MAX_MEALS} meals a day`);return false;}
    (tg.rec?rec:own).push(meal);
  }
  if(!own.length)delete S.mealPlan.dated[ds];
  planTouch();
  return true;
}
// A repeating meal can come off this date only, or off every week; a one-day meal just goes.
function planRemoveMeal(ds,id,scope){
  if(typeof ds==='number')ds=planWeekDates(0).find(d=>planDow(d)===ds);
  const e=planFindOn(ds,id);if(!e)return;const dow=planDow(ds);
  if(e.rec&&!scope){
    const ov=makeOv('planrm-ov');
    ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:4px">Remove ${esc(e.m.name||e.m.type)}</div>
      <div class="sheet-sub">It is planned every ${PLAN_DAYS[dow]}.</div>
      <button class="btn bts bfw" onclick="closeOv('planrm-ov');planRemoveMeal(${jsq(ds)},${jsq(id)},'day')">Just ${esc(fmtDay(ds))}</button>
      <button class="btn btd bfw" style="margin-top:8px" onclick="closeOv('planrm-ov');planRemoveMeal(${jsq(ds)},${jsq(id)},'all')">Every ${PLAN_DAYS[dow]}</button></div>`;
    document.body.appendChild(ov);attachSwipeDown(ov);return;
  }
  const snap=JSON.stringify(S.mealPlan);const mealsSnap=S.meals.slice();
  if(e.rec&&scope==='day'){if(!isObj(S.mealPlan.skip))S.mealPlan.skip={};(S.mealPlan.skip[ds]=S.mealPlan.skip[ds]||[]).push(id);}
  else if(e.rec){S.mealPlan.days[dow]=S.mealPlan.days[dow].filter(m=>m.id!==id);}
  else{S.mealPlan.dated[ds]=(S.mealPlan.dated[ds]||[]).filter(m=>m.id!==id);if(!S.mealPlan.dated[ds].length)delete S.mealPlan.dated[ds];}
  planUnlog(ds,id); // a copy it put in that day's log by itself goes with it
  planTouch();refreshPlanViews();
  toast(scope==='all'?`Removed from every ${PLAN_DAYS[dow]}`:'Removed from the plan','',{action:'Undo',onAction:()=>{S.mealPlan=normalizeMealPlan(JSON.parse(snap));S.meals=mealsSnap;planTouch();refreshPlanViews();}});
}
function planClearDay(ds){
  if(typeof ds==='number')ds=planWeekDates(0).find(d=>planDow(d)===ds);
  const ents=planEntries(ds);if(!ents.length)return;
  const snap=JSON.stringify(S.mealPlan);const mealsSnap=S.meals.slice();
  delete S.mealPlan.dated[ds];
  const rec=ents.filter(e=>e.rec).map(e=>e.m.id);
  if(rec.length){if(!isObj(S.mealPlan.skip))S.mealPlan.skip={};S.mealPlan.skip[ds]=[...new Set(((S.mealPlan.skip[ds])||[]).concat(rec))];}
  ents.forEach(e=>planUnlog(ds,e.m.id));
  planTouch();refreshPlanViews();
  toast(`${fmtDay(ds)} cleared`,'',{action:'Undo',onAction:()=>{S.mealPlan=normalizeMealPlan(JSON.parse(snap));S.meals=mealsSnap;planTouch();refreshPlanViews();}});
}
function planClearAll(){
  customConfirm('Every planned meal and fasting day, weekly and one-off, will be removed. Meals you already logged, and things you added to the grocery list yourself, stay.','Clear the plan',()=>{
    const was=S.mealPlan;S.mealPlan=Object.assign(emptyMealPlan(),{extras:was.extras||[],auto:was.auto!==false});planTouch();refreshPlanViews();
    toast('Meal plan cleared','',{action:'Undo',onAction:()=>{S.mealPlan=was;planTouch();refreshPlanViews();}});
  });
}
// Copy a day's meals, or one meal (id), to other dates this week or next. Copies are for those dates only.
function showPlanCopy(ds,id){
  if(typeof ds==='number')ds=planWeekDates(0).find(d=>planDow(d)===ds);
  const e=id?planFindOn(ds,id):null;if(id&&!e)return;
  window._planCopy={from:ds,id:id||null,to:new Set()};
  const ov=makeOv('plancopy-ov');
  ov.innerHTML=`<div class="modal" style="max-height:86vh"><div class="mh"></div><div class="mt" style="margin-bottom:4px">Copy ${e?esc(e.m.name||e.m.type):esc(fmtDay(ds))} to…</div>
    <div class="sheet-sub">${e?'The meal is added to each day you pick, for that date only.':'Its meals are added to each day you pick, for that date only.'} To have a meal every week instead, edit it and turn on its Every-weekday switch.</div>
    <div id="plancopy-days"></div>
    <button class="btn btp bfw" id="plancopy-go" style="margin-top:12px" onclick="planCopyGo()">Copy</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  paintPlanCopy();
}
function paintPlanCopy(){
  const c=window._planCopy;const el=document.getElementById('plancopy-days');if(!c||!el)return;
  const td=today();
  const wk=w=>{const ds=planWeekDates(w).filter(d=>d!==c.from&&d>=td);if(!ds.length)return'';
    return`<div class="sec-h">${w?'Next week':'This week'}</div><div class="pl-copydays">${ds.map(d=>`<button class="chip${c.to.has(d)?' on':''}" aria-pressed="${c.to.has(d)}" onclick="togglePlanCopy(${jsq(d)})">${PLAN_SHORT[planDow(d)]} ${+d.slice(8)}${planMealsOn(d).length?'<span class="plan-dot"></span>':''}</button>`).join('')}</div>`;};
  el.innerHTML=wk(0)+wk(1);
  const go=document.getElementById('plancopy-go');if(go){go.style.display=c.to.size?'':'none';go.textContent=`Copy to ${c.to.size} day${c.to.size===1?'':'s'}`;}
}
function togglePlanCopy(d){const c=window._planCopy;if(!c)return;if(c.to.has(d))c.to.delete(d);else c.to.add(d);paintPlanCopy();}
function planCopyGo(){const c=window._planCopy;if(!c||!c.to.size)return;if(c.id)planCopyMeal(c.from,c.id,[...c.to]);else planCopyDay(c.from,[...c.to]);}
function planCopyDay(from,to){
  if(typeof from==='number'){const f=from;from=planWeekDates(0).find(d=>planDow(d)===f);to=to.map(t=>typeof t==='number'?planWeekDates(0).find(d=>planDow(d)===t):t);}
  const src=planMealsOn(from);if(!src.length)return;
  const snap=JSON.stringify(S.mealPlan);let n=0;
  to.forEach(d=>{if(d===from)return;const l=planDatedList(d);src.forEach(m=>{if(planMealsOn(d).length>=PLAN_MAX_MEALS)return;const c=cleanPlanMeal(Object.assign({},m,{id:uid()}));if(c){l.push(c);n++;}});if(!l.length)delete S.mealPlan.dated[d];});
  planTouch();closeOv('plancopy-ov');refreshPlanViews();
  toast(`Copied to ${to.length} day${to.length===1?'':'s'}`,'green',{action:'Undo',onAction:()=>{S.mealPlan=normalizeMealPlan(JSON.parse(snap));planTouch();refreshPlanViews();}});
}
function planCopyMeal(from,id,to){
  if(typeof from==='number'){const f=from;from=planWeekDates(0).find(d=>planDow(d)===f);to=to.map(t=>typeof t==='number'?planWeekDates(0).find(d=>planDow(d)===t):t);}
  const e=planFindOn(from,id);if(!e)return;
  const snap=JSON.stringify(S.mealPlan);let n=0;
  to.forEach(d=>{if(d===from||planMealsOn(d).length>=PLAN_MAX_MEALS)return;const c=cleanPlanMeal(Object.assign({},e.m,{id:uid()}));if(c){planDatedList(d).push(c);n++;}});
  planTouch();closeOv('plancopy-ov');refreshPlanViews();
  toast(n?`Copied to ${n} day${n===1?'':'s'}`:'Those days are full',n?'green':'',n?{action:'Undo',onAction:()=>{S.mealPlan=normalizeMealPlan(JSON.parse(snap));planTouch();refreshPlanViews();}}:undefined);
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
// A weight to buy, in the units the app is set to.
function groceryWeight(g){
  if(S.unit==='kg')return g>=1000?`${fmt1(g/1000)} kg`:`${Math.round(g/5)*5} g`;
  const oz=g/GRAMS_PER_OZ;return oz>=16?`${fmt1(oz/16)} lb`:`${Math.round(oz*2)/2} oz`;
}
// Aisles, from where each food sits in the built-in list.
const GROCERY_SECTIONS=[['qf_egg','Eggs & dairy'],['qf_chicken_breast','Meat & fish'],['qf_salmon','Meat & fish'],['qf_tofu_firm','Other protein'],['qf_white_rice','Grains & bread'],['qf_potato_baked','Produce'],['qf_black_beans','Beans & nuts'],['qf_banana','Produce'],['qf_olive_oil','Pantry'],['qf_popcorn','Snacks & other']];
const GROCERY_AISLES=['Produce','Meat & fish','Eggs & dairy','Other protein','Grains & bread','Beans & nuts','Pantry','Snacks & other','Your foods','Other','Also'];
let _aisleMap=null;
function foodAisle(id){
  if(!_aisleMap){
    _aisleMap={};let cur='Other';const starts=new Map(GROCERY_SECTIONS);
    QUICK_FOODS.forEach(f=>{if(starts.has(f.id))cur=starts.get(f.id);_aisleMap[f.id]=cur;});
    FOOD_KINDS.forEach(k=>{_aisleMap[k.id]=_aisleMap[k.of[0]]||'Other';});COOK_FATS.forEach(f=>{_aisleMap[f.id]='Pantry';});
  }
  const b=foodBaseId(id);return _aisleMap[b]||(b&&isCustomFood(b)?'Your foods':'Other');
}
// The dates the list is for: the rest of this week from today, or next week.
function groceryDates(){
  const wk=window._grocWeek===1?1:0;const td=today();
  return planWeekDates(wk).filter(d=>d>=td);
}
// What to buy for those days. Foods weighed in the plan are added up by weight, and bought raw or
// dry: cooked meat and fish are about a quarter lighter than raw, cooked rice and pasta about three
// times heavier than dry. Foods counted in servings stay counted ("6 eggs"). The same food on
// different days is one line.
function planGrocery(){
  const map=new Map();
  groceryDates().forEach(ds=>{if(planFastOn(ds)==='full')return;planMealsOn(ds).forEach(m=>m.items.forEach(it=>{
    const q=parseFloat(it.qty)||0;if(!(q>0))return;
    const base=foodBaseId(it.foodId);const mods=foodMods(it.foodId);const sg=parseFloat(it.sg)||0;
    const dry=base&&DRY_100[base]&&sg>0;
    const byWeight=sg>0&&(amtUnit(it.unit,sg)!=='serv'||dry);
    let key,o;
    if(byWeight&&base){
      let g=q*sg,note='';
      if(mods.alt&&COOK_YIELD[base]){g=g/COOK_YIELD[base];note='raw';}
      else if(dry&&!mods.alt){const b=findFood(base);const per=b&&servingGrams(b)>0?(+b.cals||0)/servingGrams(b):0;if(per>0){g=g*per/(DRY_100[base].cals/100);note='dry';}}
      else if(dry&&mods.alt)note='dry';
      const named=findFood(foodVariantId(base,{rich:mods.rich}))||findFood(base);
      key='w:'+base+(mods.rich?'~'+mods.rich:'');
      o=map.get(key)||{key,name:named?named.name.replace(/\s*\((?:cooked|dry)\)/i,''):it.name,grams:0,note,meals:0,aisle:foodAisle(base)};
      o.grams+=g;if(note)o.note=note;
    }else{
      key=(it.foodId||('n:'+String(it.name).toLowerCase()))+'|'+String(it.serving||'').toLowerCase();
      o=map.get(key)||{key,name:it.name,serving:it.serving||'',qty:0,meals:0,aisle:it.foodId?foodAisle(it.foodId):'Other'};
      o.qty=Math.round((o.qty+q)*100)/100;
    }
    o.meals++;map.set(key,o);
  }));});
  return[...map.values()].map(x=>Object.assign(x,{amount:x.grams!=null?groceryWeight(x.grams)+(x.note?` ${x.note}`:''):groceryAmount(x.qty,x.serving)}))
    .sort((a,b)=>(GROCERY_AISLES.indexOf(a.aisle)-GROCERY_AISLES.indexOf(b.aisle))||(a.name.toLowerCase()<b.name.toLowerCase()?-1:1));
}
function groceryText(){
  const list=planGrocery();const ex=S.mealPlan.extras||[];
  const lines=['Grocery list — Lah We meal plan'];let aisle='';
  list.forEach(x=>{if(x.aisle!==aisle){aisle=x.aisle;lines.push('',aisle.toUpperCase());}lines.push(`${S.mealPlan.checked[x.key]?'[x]':'[ ]'} ${x.name} — ${x.amount}`);});
  if(ex.length){lines.push('','ALSO');ex.forEach(x=>lines.push(`${S.mealPlan.checked['x:'+x.id]?'[x]':'[ ]'} ${x.name}`));}
  return lines.join('\n');
}
function showGroceryList(wk){
  if(wk===0||wk===1)window._grocWeek=wk;
  const ov=makeOv('grocery-ov');
  ov.innerHTML=`<div class="modal page groc-page"><div class="mh"></div><div id="grocery-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderGroceryList();
}
function setGroceryWeek(w){window._grocWeek=w===1?1:0;renderGroceryList();}
function renderGroceryList(){
  const el=document.getElementById('grocery-body');if(!el)return;
  const m0=el.closest('.modal');const y=m0?m0.scrollTop:0;
  const list=planGrocery();const ex=S.mealPlan.extras||[];
  // Forget ticks for things that are on no day of the plan any more (not just outside the days shown).
  const all=(()=>{const keep=window._grocWeek;const k=new Set();[0,1].forEach(w=>{window._grocWeek=w;planGrocery().forEach(x=>k.add(x.key));});window._grocWeek=keep;return k;})();
  let pruned=false;
  Object.keys(S.mealPlan.checked).forEach(k=>{if(k.startsWith('x:')?!ex.some(x=>'x:'+x.id===k):!all.has(k)){delete S.mealPlan.checked[k];pruned=true;}});
  if(pruned)save();
  const nxt=window._grocWeek===1;const days=groceryDates();
  const left=list.filter(x=>!S.mealPlan.checked[x.key]).length+ex.filter(x=>!S.mealPlan.checked['x:'+x.id]).length;
  const total=list.length+ex.length;
  const ticked=total-left;
  let h=`<div class="pg-head"><div class="mt">Grocery list</div>${total?`<button class="btn bts bsm" onclick="shareGrocery()">${ICON('share',15)} Share</button>`:''}</div>
    <div class="seg groc-seg" role="group" aria-label="Which week"><button class="seg-b${!nxt?' on':''}" aria-pressed="${!nxt}" onclick="setGroceryWeek(0)">This week</button><button class="seg-b${nxt?' on':''}" aria-pressed="${nxt}" onclick="setGroceryWeek(1)">Next week</button></div>
    <div class="fine groc-fine">${days.length?`${fmtDay(days[0])} to ${fmtDay(days[days.length-1])}`:'No days left'} as planned · ${total?`${left} of ${total} still to get`:'nothing to buy yet'}. Weighed foods are added up by weight and listed as you buy them (meat raw, rice and pasta dry).</div>`;
  let aisle='';
  if(list.length){
    h+=list.map(x=>{let s='';if(x.aisle!==aisle){s=`${aisle?'</div>':''}<div class="sec-h">${esc(x.aisle)}</div><div class="list groc">`;aisle=x.aisle;}
      const got=!!S.mealPlan.checked[x.key];
      return s+`<label class="groc-row${got?' got':''}"><input type="checkbox"${got?' checked':''} onchange="toggleGrocery(${jsq(x.key)},this.checked)"><span class="groc-name">${esc(x.name)}<small>${x.meals} meal${x.meals===1?'':'s'}</small></span><span class="groc-amt">${esc(x.amount)}</span></label>`;}).join('')+'</div>';
  }else if(!ex.length)h+=`<div class="ms-empty">${planHasMeals()?'Nothing planned on these days.':'Plan some meals first: the list is built from them.'}</div>`;
  h+=`<div class="sec-h">Also</div><div class="list groc">${ex.map(x=>{const got=!!S.mealPlan.checked['x:'+x.id];
      return`<div class="groc-row${got?' got':''}"><input type="checkbox"${got?' checked':''} onchange="toggleGrocery(${jsq('x:'+x.id)},this.checked)" aria-label="${esc(x.name)}"><span class="groc-name">${esc(x.name)}</span><button class="ib ib-q" onclick="removeGroceryExtra(${jsq(x.id)})" aria-label="Remove ${esc(x.name)}">${ICON('x',14)}</button></div>`;}).join('')}
    <div class="groc-add"><input type="text" id="groc-new" maxlength="60" placeholder="Add something else (coffee, foil…)" enterkeyhint="done" autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();addGroceryExtra();}"><button class="btn bts bsm" onclick="addGroceryExtra()">Add</button></div></div>`;
  if(ticked)h+=`<button class="btn btg bfw" style="margin-top:4px" onclick="clearGroceryTicks()">Untick all ${ticked}</button>`;
  el.innerHTML=h;
  if(m0)m0.scrollTop=y;
}
function toggleGrocery(key,on){if(on)S.mealPlan.checked[key]=true;else delete S.mealPlan.checked[key];save();renderGroceryList();}
function clearGroceryTicks(){const was=S.mealPlan.checked;S.mealPlan.checked={};save();renderGroceryList();toast('Unticked','',{action:'Undo',onAction:()=>{S.mealPlan.checked=was;save();renderGroceryList();}});}
function addGroceryExtra(){
  const el=document.getElementById('groc-new');const name=String(el?.value||'').replace(/\s+/g,' ').trim().slice(0,60);
  if(!name){try{el.focus();}catch(e){}return;}
  if(!Array.isArray(S.mealPlan.extras))S.mealPlan.extras=[];
  if(S.mealPlan.extras.length>=60){toast('That is a long list already');return;}
  S.mealPlan.extras.push({id:uid(),name});save();renderGroceryList();
  setTimeout(()=>{const i=document.getElementById('groc-new');if(i)try{i.focus();}catch(e){}},30);
}
function removeGroceryExtra(id){
  const i=(S.mealPlan.extras||[]).findIndex(x=>x.id===id);if(i<0)return;
  const gone=S.mealPlan.extras.splice(i,1)[0];save();renderGroceryList();
  toast(gone.name+' removed','',{action:'Undo',onAction:()=>{S.mealPlan.extras.splice(Math.min(i,S.mealPlan.extras.length),0,gone);save();renderGroceryList();}});
}
async function shareGrocery(){
  const text=groceryText();
  try{if(navigator.share){await navigator.share({title:'Grocery list',text});return;}}catch(e){if(e&&e.name==='AbortError')return;}
  try{await navigator.clipboard.writeText(text);toast('Grocery list copied','green');}
  catch(e){downloadText('grocery-list.txt',text,'text/plain');}
}
