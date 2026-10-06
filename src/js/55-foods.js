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
    <span class="row-s">${x.kind==='meal'?esc(x.serving):`${fmt1(x.qty)} × ${esc(x.serving)}`}</span></span>
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

// ─── Quick log, with an amount ───
function quickLogFood(foodId,qty){
  const f=findFood(foodId);if(!f)return;
  closeOv('fit-ov');
  window._pendingQuickLog={type:'food',food:f};
  quickLogSheet(f.name,`${esc(f.serving||'1 serving')}`,{protein:f.protein,carbs:f.carbs,fat:f.fat,cals:f.cals},qty>0?qty:1,true);
}
function quickLogCombo(comboId){
  const combo=(S.savedMeals||[]).find(c=>c.id===comboId);if(!combo)return;
  closeOv('fit-ov');
  window._pendingQuickLog={type:'combo',combo};
  let p=0,c=0,ft=0,k=0;combo.items.forEach(it=>{const t=mealItemTotals(it);p+=t.protein;c+=t.carbs;ft+=t.fat;k+=t.cals;});
  quickLogSheet(combo.name,`${combo.items.length} items`,{protein:p,carbs:c,fat:ft,cals:k},1,false);
}
function quickLogSheet(name,sub,per,qty,canScale){
  window._qlPer=per;
  const likely=likelyMealType();const ds=nutDay();
  const ov=makeOv('mtype-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div class="mt" style="margin-bottom:2px">${esc(name)}</div>
    <div class="sheet-sub" style="margin-bottom:10px">${sub}${ds!==today()?` · logging for ${fmtDay(ds)}`:''}</div>
    ${canScale?`<div class="qty-row"><button class="btn bts" onclick="quickQtyAdj(-0.5)" aria-label="Less">−</button>
      <input type="number" inputmode="decimal" id="ql-qty" value="${fmt1(qty)}" min="0.1" step="0.5" oninput="quickQtyPaint()" aria-label="Servings">
      <button class="btn bts" onclick="quickQtyAdj(0.5)" aria-label="More">+</button><span>servings</span></div>`:''}
    <div id="ql-macros" class="st-grid st-4" style="margin:10px 0 14px"></div>
    <div class="sec-h" style="padding:0 2px 8px">Log as…</div>
    <div class="type-grid">${MEAL_TYPES.map(t=>`<button class="btn ${t===likely?'btp':'bts'}" onclick="doQuickLog('${t}')">${t}</button>`).join('')}</div>
    <button class="btn btg bfw" style="margin-top:8px" onclick="closeOv('mtype-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  quickQtyPaint();
}
function quickQty(){const v=parseFloat(document.getElementById('ql-qty')?.value);return v>0?Math.min(50,v):1;}
function quickQtyAdj(d){const el=document.getElementById('ql-qty');if(!el)return;el.value=fmt1(Math.max(0.5,Math.round((quickQty()+d)*10)/10));quickQtyPaint();}
function quickQtyPaint(){
  const el=document.getElementById('ql-macros');const p=window._qlPer;if(!el||!p)return;
  const q=document.getElementById('ql-qty')?quickQty():1;
  el.innerHTML=macroTilesHTML({cals:p.cals*q,protein:p.protein*q,carbs:p.carbs*q,fat:p.fat*q});
}
function doQuickLog(mealType){
  const q=window._pendingQuickLog;
  const qty=document.getElementById('ql-qty')?quickQty():1;
  closeOv('mtype-ov');
  if(!q)return;
  if(!S.meals)S.meals=[];
  const date=nutDay();
  if(q.type==='food'){
    const f=q.food;
    trackRecent(f.id);
    const t=mealItemTotals({qty,protein:f.protein,carbs:f.carbs,fat:f.fat,cals:f.cals});
    S.meals.push({id:uid(),date,type:mealType,name:mealType,
      items:[Object.assign({foodId:f.id,name:f.name,qty,serving:f.serving},t)],
      protein:t.protein,carbs:t.carbs,fat:t.fat,cals:t.cals});
    toast(`${qty!==1?fmt1(qty)+' × ':''}${f.name} → ${mealType}`,'green');
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
    <div class="sheet-sub">${_foodEd.barcode?`Barcode ${esc(_foodEd.barcode)}. The next scan of it uses these numbers.`:'Numbers for one serving, as on the label.'}</div>
    <div class="fg"><label class="fl">Name</label><input type="text" id="fe-name" maxlength="120" value="${v('name')}" placeholder="e.g. Kirkland Protein Bar"></div>
    <div class="fg"><label class="fl">One serving is</label><input type="text" id="fe-serving" maxlength="40" value="${v('serving')}" placeholder="e.g. 1 bar, 1 cup, 100 g"></div>
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
  if(ed.barcode)food.barcode=ed.barcode;
  const at=S.customFoods.findIndex(f=>f.id===id);
  if(at>=0)S.customFoods[at]=food;else S.customFoods.push(food);
  if(ed.barcode){
    // The lookup cache is what a rescan reads, so the corrected numbers go there too. Only
    // per-serving figures are known; per-100 g stays empty rather than being guessed.
    cacheProduct(ed.barcode,{name:d.name,brand:'',serving:d.serving,servingG:0,manual:true,per100:{protein:0,carbs:0,fat:0,cals:0},
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
