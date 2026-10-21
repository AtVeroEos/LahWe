// ═══════════════════════════════════════════════════
// BUILDERS — food: targets that fit your goal, and a week of meals built from what you eat
// ═══════════════════════════════════════════════════
// No AI. Targets come from your maintenance (worked out from your own log when there is enough of
// it, the formula until then) and a rate of change that is safe to hold. Meal plans are made from
// meals you have actually logged and saved, scaled to land on each day's targets; basic staples
// fill in only where your log has nothing for a meal.

// ─── Targets ───
const BLD_DIRS=[{id:'lose',label:'Lose'},{id:'maintain',label:'Maintain'},{id:'gain',label:'Gain'}];
function bldDirDefault(){
  if(['lose','maintain','gain'].includes(S.weightGoalDir))return S.weightGoalDir;
  return S.goal==='weightloss'?'lose':'maintain';
}
function bldRound(v,step){return Math.round(v/step)*step;}
// → {dir, base, src, delta, perWeek, kcal, protein, carbs, fat, rest?, why:[…], same, current}
function bldTargets(dir){
  dir=['lose','maintain','gain'].includes(dir)?dir:bldDirDefault();
  let mb=maintenanceBest();let doubt=false;
  // An average below resting burn means meals are going unlogged, not that this is maintenance.
  if(mb.src==='logs'&&mb.kcal<bmr()*1.05){mb={kcal:maintenanceKcal(7),src:'formula',obs:mb.obs};doubt=true;}
  const base=Math.round(mb.kcal||0);
  const bw=bwUser();const lb=isKg()?bw*2.2046:bw;const K=kcalPerWeightUnit();
  const why=[];
  let delta=0;
  if(dir==='lose'){
    // About 0.75% of body weight a week: fast enough to see, slow enough to keep lifting well.
    delta=-Math.min(750,Math.max(300,bldRound(0.0075*bw*K/7,10)));
    why.push(`A deficit of ${Math.abs(delta)} kcal a day, about ${fmt1(Math.abs(delta)*7/K)} ${S.unit} a week (0.75% of your weight), which most people can hold while training.`);
  }else if(dir==='gain'){
    delta=250;
    why.push(`A surplus of 250 kcal a day, about ${fmt1(250*7/K)} ${S.unit} a week. Faster than that is mostly fat.`);
  }else why.push('At maintenance: your weight should hold where it is.');
  let kcal=Math.max(calorieFloor(),bldRound(base+delta,10));
  if(kcal===calorieFloor()&&base+delta<calorieFloor())why.push(`Held at ${calorieFloor().toLocaleString()} kcal, the lowest the app will set.`);
  // Protein per pound of body weight; more while losing, to hold on to muscle.
  const pPerLb=dir==='lose'?1.0:0.8;
  const protein=bldRound(Math.min(lb*pPerLb,300),5);
  let fat=bldRound(Math.max(lb*0.3,kcal*0.25/9),5);
  let carbs=Math.floor((kcal-protein*4-fat*9)/4/5)*5;
  if(carbs<50){fat=bldRound(Math.max(lb*0.25,(kcal-protein*4-50*4)/9),5);carbs=Math.max(50,Math.floor((kcal-protein*4-fat*9)/4/5)*5);}
  kcal=protein*4+carbs*4+fat*9;
  why.push(`Protein ${pPerLb.toFixed(1)} g per lb of body weight${dir==='lose'?', higher while losing to keep muscle':''}; fat at least a quarter of calories; carbs make up the rest.`);
  why.unshift(doubt?`Your logged food averages less than your resting burn, which usually means some meals are not logged, so this uses the formula: about ${base.toLocaleString()} kcal.`:mb.src==='logs'?`Your maintenance is about ${base.toLocaleString()} kcal (± ${mb.obs.margin||100}), worked out from ${mb.obs.foodDays} days of food and ${mb.obs.weighIns} weigh-ins.`
    :`Your maintenance is about ${base.toLocaleString()} kcal from the formula. It can be a few hundred out; after 2 weeks of logging food and weighing in, the app works it out from your own numbers.`);
  const out={dir,base,src:mb.src,delta,perWeek:Math.round(delta*7/K*100)/100,kcal,protein,carbs,fat,why,current:Object.assign({},S.macroGoals)};
  // Separate rest-day targets keep the same gap to training days, so the week still averages out.
  if(hasRestGoals()){
    const g=S.macroGoals,r=S.restGoals;const gap=(g.cals||0)-(r.cals||0);
    let train=0;for(let i=1;i<=14;i++)if(dayKind(daysAgoStr(i))==='train')train++;const restShare=(14-train)/14;
    const tk=bldRound(kcal+gap*restShare,10),rk=Math.max(calorieFloor(),tk-gap);
    const tc=Math.max(50,bldRound((tk-protein*4-fat*9)/4,5)),rc=Math.max(30,bldRound((rk-protein*4-fat*9)/4,5));
    out.kcal=protein*4+tc*4+fat*9;out.carbs=tc;out.rest={cals:protein*4+rc*4+fat*9,protein,carbs:rc,fat};out.currentRest=Object.assign({},r);
    why.push(`Your rest days stay ${Math.abs(gap).toLocaleString()} kcal ${gap>=0?'under':'over'} training days, in carbs.`);
  }
  const c=S.macroGoals;
  out.same=Math.abs((c.cals||0)-out.kcal)<50&&Math.abs((c.protein||0)-protein)<10&&Math.abs((c.fat||0)-out.fat)<10;
  return out;
}
function bldApplyTargets(t){
  const before={g:Object.assign({},S.macroGoals),r:S.restGoals?Object.assign({},S.restGoals):null,dir:S.weightGoalDir};
  S.macroGoals={cals:t.kcal,protein:t.protein,carbs:t.carbs,fat:t.fat};
  if(t.rest&&S.restGoals)S.restGoals=Object.assign({},S.restGoals,t.rest);
  S.weightGoalDir=t.dir;save();
  return()=>{S.macroGoals=before.g;S.restGoals=before.r;S.weightGoalDir=before.dir;save();};
}

// ─── Meal plans ───
const BLD_MEAL_SLOTS={3:['Breakfast','Lunch','Dinner'],4:['Breakfast','Lunch','Snack','Dinner'],5:['Breakfast','Snack','Lunch','Snack','Dinner']};
const BLD_VARIETY=[{id:'repeat',label:'Same every day'},{id:'some',label:'Two days, alternating'},{id:'daily',label:'Different each day'}];
// Staples for a meal your log has nothing for: [food id, servings].
const BLD_STAPLE_MEALS={
  Breakfast:[[['qf_egg',3],['qf_oatmeal',1],['qf_banana',1]],[['qf_greek_yogurt',1],['qf_blueberries',1],['qf_oatmeal',1]]],
  Lunch:[[['qf_chicken_breast',1.5],['qf_white_rice',1],['qf_broccoli',1]],[['qf_ground_turkey',1.5],['qf_tortilla',1],['qf_green_beans',1]]],
  Dinner:[[['qf_salmon',1.5],['qf_potato_baked',1],['qf_green_beans',1]],[['qf_sirloin',1.5],['qf_sweet_potato',1],['qf_broccoli',1]]],
  Snack:[[['qf_greek_yogurt',1],['qf_apple',1]],[['qf_whey',1],['qf_banana',1]]],
  Fuel:[[['qf_bagel',1],['qf_peanut_butter',1]],[['qf_banana',1],['qf_peanut_butter',1],['qf_milk_2',1]]],
};
function bldSlotType(t){return t==='Pre-workout'||t==='Post-workout'?'Snack':t;}
// A logged meal's items as plan items (per serving, with a quantity).
function bldPlanItems(items){
  return(items||[]).map(it=>{
    const q=parseFloat(it.qty)||1;const f=it.foodId?findFood(it.foodId):null;
    const o=f?{foodId:f.id,name:f.name,qty:q,serving:f.serving||'',protein:+f.protein||0,carbs:+f.carbs||0,fat:+f.fat||0,cals:+f.cals||0}
      :{foodId:null,name:it.name,qty:q,serving:it.serving||'',protein:r1((+it.protein||0)/q),carbs:r1((+it.carbs||0)/q),fat:r1((+it.fat||0)/q),cals:Math.round((+it.cals||0)/q),est:!!it.est};
    if(parseFloat(it.sg)>0){o.sg=parseFloat(it.sg);if(it.unit)o.unit=it.unit;}
    return o;
  }).filter(x=>x.name&&x.cals>=0);
}
// Your meals, by slot: what you logged in the last 60 days (each distinct combination once, most
// eaten first) and your saved meals. → {Breakfast:[…], Lunch:[…], Dinner:[…], Snack:[…], any:[…]}
function bldMealBlocks(){
  const by={Breakfast:[],Lunch:[],Dinner:[],Snack:[],any:[]};const seen=new Map();
  const from=daysAgoStr(60);
  (S.meals||[]).filter(m=>m.date>=from&&(m.items||[]).length).forEach(m=>{
    const items=bldPlanItems(m.items);if(!items.length)return;
    const sig=bldSlotType(m.type)+'|'+items.map(i=>(i.foodId||i.name)+'@'+Math.round(i.qty*4)/4).sort().join(',');
    let b=seen.get(sig);
    if(!b){b={type:bldSlotType(m.type),name:m.savedMealName||items.slice(0,2).map(i=>i.name).join(' & '),items,n:0,src:'log',last:m.date};seen.set(sig,b);if(by[b.type])by[b.type].push(b);}
    b.n++;if(m.date>b.last)b.last=m.date;
  });
  Object.keys(by).forEach(k=>by[k].sort((x,y)=>y.n-x.n||(x.last<y.last?1:-1)));
  (S.savedMeals||[]).forEach(c=>{
    const items=bldPlanItems(c.items);if(!items.length)return;
    // A saved meal goes under the slot you usually log it in, or under any slot.
    const used=(S.meals||[]).filter(m=>m.savedMealName===c.name);const t=used.length?bldSlotType(used[0].type):null;
    const b={type:t,name:c.name,items,n:used.length,src:'saved'};
    if(t&&by[t]){if(!by[t].some(x=>x.name===b.name))by[t].push(b);}else by.any.push(b);
  });
  return by;
}
function bldStaple(type,i){
  const list=BLD_STAPLE_MEALS[type]||BLD_STAPLE_MEALS.Snack;const pick=list[i%list.length];
  const items=pick.map(([id,q])=>{const f=findFood(id);return f?{foodId:f.id,name:f.name,qty:q,serving:f.serving||'',protein:+f.protein||0,carbs:+f.carbs||0,fat:+f.fat||0,cals:+f.cals||0}:null;}).filter(Boolean);
  return{type,name:items.slice(0,2).map(i=>i.name.replace(/\s*\(.*\)$/,'')).join(' & '),items,n:0,src:'staple'};
}
function bldClone(b,type){return{type,name:b.name,items:b.items.map(i=>Object.assign({},i)),src:b.src};}
function bldDayTotals(meals){return planDayTotals(meals.map(m=>({items:m.items})));}
// Scale a meal's items by f, in steps a person can measure: quarter servings, or 5 g when weighed,
// and never more than three servings of one food (nobody eats seven eggs because a plan said so).
const BLD_MAX_QTY=3;
// Light foods (a piece of fruit, a cup of vegetables) stop at two: they are there for the meal, not the calories.
function bldMaxQty(it){return it.cals<120&&it.protein<5?2:BLD_MAX_QTY;}
function bldScaleItems(items,f,pred){
  items.forEach(it=>{
    if(pred&&!pred(it))return;
    const weighed=parseFloat(it.sg)>0&&(it.unit==='g'||it.unit==='oz');const cap=Math.max(bldMaxQty(it),Math.min(it.qty,BLD_MAX_QTY));
    let q=Math.min(cap,Math.max(it.qty,0)*f);
    q=weighed?Math.max(5/it.sg,Math.round(q*it.sg/5)*5/it.sg):Math.max(0.25,Math.round(q*4)/4);
    it.qty=Math.min(cap,Math.round(q*10000)/10000);
  });
}
const bldProtDense=it=>it.cals>0&&it.protein*4/it.cals>=0.4;
// How a day's calories are usually spread across meals.
const BLD_SHARE={Breakfast:0.25,Lunch:0.3,Dinner:0.33,Snack:0.12};
// Land one day on its targets: each meal toward its share of the calories, protein brought into
// range (trimmed when it overshoots, topped up with your own most protein-dense food when short),
// the calories closed with the other foods, and a snack added if the meals still fall short.
// extra(needProtein) → a snack to add when the meals fall short of the calories.
function bldFitDay(meals,t,pool,extra){
  if(!meals.length||!(t.cals>0))return;
  const W=meals.reduce((a,m)=>a+(BLD_SHARE[m.type]||0.12),0);
  meals.forEach(m=>{const c=bldDayTotals([m]).cals;if(c>0)bldScaleItems(m.items,Math.min(2,Math.max(0.5,t.cals*(BLD_SHARE[m.type]||0.12)/W/c)));});
  let tot=bldDayTotals(meals);
  if(extra&&tot.cals<t.cals*0.92&&meals.length<6){
    const sn=extra(t.protein>0&&tot.protein<t.protein);
    if(sn){const c=bldDayTotals([sn]).cals;if(c>0){bldScaleItems(sn.items,Math.min(2,Math.max(0.5,(t.cals-tot.cals)/c)));sn.added=true;meals.push(sn);}}
  }
  tot=bldDayTotals(meals);
  if(t.protein>0&&tot.protein>t.protein*1.2){const f=Math.max(0.5,t.protein*1.1/tot.protein);meals.forEach(m=>bldScaleItems(m.items,f,bldProtDense));}
  tot=bldDayTotals(meals);
  if(t.protein>0&&tot.protein<t.protein*0.95&&pool.length){
    const gap=t.protein-tot.protein;const food=pool[0];
    const snack=meals.find(m=>m.type==='Snack')||meals.slice().sort((x,y)=>bldDayTotals([x]).protein-bldDayTotals([y]).protein)[0];
    const have=snack.items.find(i=>i.foodId===food.id);
    const add=Math.min(2,Math.max(0.5,Math.round(gap/food.protein*2)/2));
    if(have)have.qty=Math.min(BLD_MAX_QTY,Math.round((have.qty+add)*4)/4);else snack.items.push({foodId:food.id,name:food.name,qty:add,serving:food.serving,protein:food.protein,carbs:food.carbs,fat:food.fat,cals:food.cals});
    snack.boosted=true;
  }
  for(let k=0;k<4;k++){
    tot=bldDayTotals(meals);const over=tot.cals-t.cals;if(Math.abs(over)<=t.cals*0.03)break;
    const flex=meals.reduce((s,m)=>s+m.items.filter(i=>!bldProtDense(i)).reduce((a,i)=>a+i.cals*i.qty,0),0);if(flex<50)break;
    meals.forEach(m=>bldScaleItems(m.items,Math.min(2,Math.max(0.3,1-over/flex)),i=>!bldProtDense(i)));
  }
}
// a: {meals 3-5, variety, seed}
function bldMealPlan(a){
  a=Object.assign({meals:4,variety:'some',seed:0},a||{});
  const slots=BLD_MEAL_SLOTS[a.meals]||BLD_MEAL_SLOTS[4];
  const blocks=bldMealBlocks();
  const pool=fitPool().filter(x=>x.kind==='food'&&bldProtDense(x)).sort((x,y)=>(y.used-x.used)||(y.protein/y.cals-x.protein/x.cals));
  if(!pool.length){const w=findFood('qf_greek_yogurt');if(w)pool.push({id:w.id,name:w.name,serving:w.serving,protein:w.protein,carbs:w.carbs,fat:w.fat,cals:w.cals});}
  const nTemplates=a.variety==='repeat'?1:a.variety==='some'?2:7;
  const sources={log:0,saved:0,staple:0};const usedNames=new Set();
  // Templates: day t takes the t-th choice for each slot, wrapping round your list; a slot that
  // appears twice (two snacks) takes the next one along.
  const cand=type=>{const own=(blocks[type]||[]);const any=type==='Snack'?[]:blocks.any;return own.concat(any);};
  const templates=[];
  for(let t=0;t<nTemplates;t++){
    const seen={};
    templates.push(slots.map((type,si)=>{
      const k=(seen[type]=(seen[type]||0)+1)-1;const list=cand(type);
      const off=a.seed?bldHash(a.seed+'|'+type)%Math.max(1,list.length):0;
      const b=list.length?list[(t+k*nTemplates+off)%list.length]:bldStaple(type,t+k+(a.seed||0));
      return bldClone(b,type);
    }));
  }
  const days={};const report=[];
  PLAN_ORDER.forEach((d,i)=>{
    const tg=planDayTarget(d);
    if(planFast(d)==='full'){days[d]=[];report.push({dow:d,fast:'full',t:tg,tot:{cals:0,protein:0}});return;}
    const meals=templates[i%templates.length].map(m=>bldClone(m,m.type));
    // A snack for a short day: protein-leaning if protein is short too, otherwise mostly carbs and fat.
    const extra=needP=>{
      const own=(blocks.Snack||[]).filter(b=>!meals.some(m=>m.name===b.name));
      const dens=b=>{const x=bldDayTotals([b]);return x.cals?x.protein*4/x.cals:0;};
      const b=own.sort((x,y)=>needP?dens(y)-dens(x):dens(x)-dens(y))[0]||bldStaple(needP?'Snack':'Fuel',i);
      return b?bldClone(b,'Snack'):null;};
    bldFitDay(meals,tg,pool,extra);
    meals.forEach(m=>{if(!usedNames.has(m.name)){usedNames.add(m.name);sources[m.src]=(sources[m.src]||0)+1;}});
    const tot=bldDayTotals(meals);
    days[d]=meals.map(m=>cleanPlanMeal({type:m.type,name:m.name,items:m.items})).filter(Boolean);
    report.push({dow:d,fast:planFast(d),t:tg,tot,ok:Math.abs(tot.cals-tg.cals)<=tg.cals*0.05&&tot.protein>=tg.protein*0.95,boosted:meals.some(m=>m.boosted),added:meals.some(m=>m.added)});
  });
  const notes=[];
  if(sources.staple)notes.push(sources.log+sources.saved?`${sources.staple} meal${sources.staple===1?'':'s'} are basic staples, where your log had nothing for that meal. Logging or saving more meals makes the plan look more like how you eat.`
    :'Your food log is empty, so this is built from basic staples. After a week or two of logging, it is built from your own meals.');
  if(report.some(r=>r.added))notes.push('Your usual meals did not reach the calories on some days, so a snack was added.');
  if(report.some(r=>r.boosted))notes.push(`Protein was topped up with ${pool[0]?pool[0].name:'a protein food'} where the day fell short.`);
  const off=report.filter(r=>r.ok===false);
  if(off.length)notes.push(`${off.map(r=>PLAN_DAYS[r.dow]).join(', ')} could not be brought within 5% of the targets with these meals. Adjust a portion on the plan, or swap a meal.`);
  return{a,days,report,sources,notes};
}
function bldApplyMealPlan(p){
  const before=JSON.stringify(S.mealPlan);
  for(let d=0;d<7;d++)S.mealPlan.days[d]=(p.days[d]||[]).map(m=>Object.assign({},m,{id:uid()}));
  S.mealPlan.note=`Built from ${p.sources.log+p.sources.saved?'your own meals':'basic staples'} to land on your targets.`;
  planTouch();
  return()=>{S.mealPlan=normalizeMealPlan(JSON.parse(before));planTouch();};
}
