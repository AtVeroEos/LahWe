// ═══════════════════════════════════════════════════
// MEAL BUILDER (multi-item)
// ═══════════════════════════════════════════════════
let _mealItems=[];
const MEAL_TYPES=['Breakfast','Lunch','Dinner','Snack','Pre-workout','Post-workout'];
// One place that scales an item by its quantity, so totals can't drift between screens.
function mealItemTotals(it){
  const q=parseFloat(it.qty)||0;const n=v=>parseFloat(v)||0;
  return{protein:r1(n(it.protein)*q),carbs:r1(n(it.carbs)*q),fat:r1(n(it.fat)*q),cals:Math.round(n(it.cals)*q)};
}
function savedMealCals(c){return Math.round((c.items||[]).reduce((t,it)=>t+mealItemTotals(it).cals,0));}
function mealTypeSheet(title,fnName,backLabel){
  const ov=makeOv('mtype-ov');
  ov.innerHTML=`<div class="modal" style="max-height:340px"><div class="mh"></div>
    <div style="font-size:15px;font-weight:600;margin-bottom:12px;text-align:center">${title}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${MEAL_TYPES.map(t=>`<button class="btn bts" style="padding:14px;font-size:14px;font-weight:600" onclick="${fnName}('${t}')">${t}</button>`).join('')}
    </div>
    <button class="btn btg bfw" style="margin-top:10px" onclick="closeOv('mtype-ov')">${backLabel||'Cancel'}</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function quickLogFood(foodId){
  const f=findFood(foodId);if(!f)return;
  window._pendingQuickLog={type:'food',food:f};
  mealTypeSheet('Log as…','doQuickLog');
}
function quickLogCombo(comboId){
  const combo=(S.savedMeals||[]).find(c=>c.id===comboId);if(!combo)return;
  window._pendingQuickLog={type:'combo',combo};
  mealTypeSheet('Log as…','doQuickLog');
}
function doQuickLog(mealType){
  closeOv('mtype-ov');
  const q=window._pendingQuickLog;if(!q)return;
  if(!S.meals)S.meals=[];
  if(q.type==='food'){
    const f=q.food;
    trackRecent(f.id);
    S.meals.push({id:uid(),date:today(),type:mealType,name:mealType,
      items:[{foodId:f.id,name:f.name,qty:1,serving:f.serving,protein:f.protein,carbs:f.carbs,fat:f.fat,cals:f.cals}],
      protein:f.protein,carbs:f.carbs,fat:f.fat,cals:f.cals});
    toast(f.name+' → '+mealType,'green');
  }else if(q.type==='combo'){
    const c=q.combo;
    trackRecentMeal(c.id);
    let tp=0,tc=0,tf=0,tk=0;
    const items=c.items.map(it=>{
      const t=mealItemTotals(it);
      tp+=t.protein;tc+=t.carbs;tf+=t.fat;tk+=t.cals;
      return{...it,...t};
    });
    S.meals.push({id:uid(),date:today(),type:mealType,name:mealType,savedMealName:c.name,
      items,protein:r1(tp),carbs:r1(tc),fat:r1(tf),cals:Math.round(tk)});
    toast(c.name+' → '+mealType,'green');
  }
  save();renderNutrition(document.getElementById('content'));
  window._pendingQuickLog=null;
}
// target (optional): {plan:dow} saves the meal into the weekly plan instead of logging it.
function showAddMeal(ds,keepItems,target){
  const date=ds||today();
  if(!keepItems){_mealItems=[];window._loggedSavedMealId=null;window._mealTarget=target||null;}
  const ov=makeOv('meal-ov');
  ov.innerHTML=buildMealModalHTML(date);
  document.body.appendChild(ov);attachSwipeDown(ov);
  window._mealType=0;window._mealFoodTab='starred';
  renderFoodTab();
  setTimeout(()=>document.getElementById('food-search')?.focus(),200);
}
function buildMealModalHTML(date){
  const tg=window._mealTarget;
  return`<div class="modal"><div class="mh"></div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <input type="text" id="food-search" placeholder="Search foods and meals…" oninput="onFoodSearch()" style="flex:1">
      <button class="btn btp bsm" onclick="showBarcodeScanner()" style="gap:5px;flex-shrink:0"><span style="font-size:14px">📷</span> Scan</button>
    </div>
    ${tg?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px;color:var(--muted)">
      <label for="plan-meal-name" style="font-weight:600;white-space:nowrap">${PLAN_SHORT[tg.plan]} plan</label>
      <input type="text" id="plan-meal-name" maxlength="60" value="${esc(tg.name||'')}" placeholder="Name this meal (optional)" style="flex:1;padding:7px 10px;font-size:13px">
    </div>`:`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px;color:var(--muted)">
      <label for="meal-date" style="font-weight:600">Date</label>
      <input type="date" id="meal-date" value="${esc(date)}" max="${today()}" style="flex:1;padding:7px 10px;font-size:13px">
    </div>`}
    <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin:0 -16px;padding:0 16px">
      <button class="ptab on" id="ftab-starred" onclick="setFoodTab('starred')">★ Starred</button>
      <button class="ptab" id="ftab-recent" onclick="setFoodTab('recent')">Recent</button>
      <button class="ptab" id="ftab-all" onclick="setFoodTab('all')">Foods</button>
      <button class="ptab" id="ftab-combos" onclick="setFoodTab('combos')">Saved Meals</button>
    </div>
    <div id="food-list" style="max-height:200px;overflow-y:auto;margin:0 -16px;padding:0 16px"></div>
    <div id="meal-items-section" style="display:none;margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div class="ct">Meal Items</div>
        <div id="meal-total" class="mono" style="font-size:13px;font-weight:600;color:var(--navy)"></div>
      </div>
      <div id="meal-items-list"></div>
    </div>
    <div id="manual-entry-toggle" style="margin-top:10px">
      <button class="btn btg bfw" style="font-size:12px" onclick="toggleManualEntry()">Enter macros manually ▾</button>
    </div>
    <div id="manual-entry" style="display:none;margin-top:8px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:10px">
        <div class="fg" style="margin-bottom:0"><label class="fl">Protein (g)</label><input type="number" inputmode="decimal" id="meal-pro" placeholder="0" oninput="autoCalcMeal()"></div>
        <div class="fg" style="margin-bottom:0"><label class="fl">Carbs (g)</label><input type="number" inputmode="decimal" id="meal-carb" placeholder="0" oninput="autoCalcMeal()"></div>
        <div class="fg" style="margin-bottom:0"><label class="fl">Fat (g)</label><input type="number" inputmode="decimal" id="meal-fat" placeholder="0" oninput="autoCalcMeal()"></div>
        <div class="fg" style="margin-bottom:0"><label class="fl">Calories</label><input type="number" inputmode="numeric" id="meal-cal" placeholder="Auto"></div>
      </div>
    </div>
    <div style="margin-top:12px">
      <button class="btn btp bfw" onclick="saveMeal()">${tg?(tg.replace?'Save changes':'Add to plan'):'Log Meal'}</button>
      <button class="btn bts bfw" style="margin-top:8px;display:none" id="save-combo-btn" onclick="saveAsCombo()">💾 Save as Reusable Meal</button>
    </div>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('meal-ov')">Cancel</button>
  </div>`;
}
function selMealType(i){window._mealType=i;}
function toggleManualEntry(){
  const el=document.getElementById('manual-entry');
  const btn=document.getElementById('manual-entry-toggle');
  if(!el)return;
  const show=el.style.display==='none';
  el.style.display=show?'block':'none';
  if(btn)btn.innerHTML=`<button class="btn btg bfw" style="font-size:12px" onclick="toggleManualEntry()">Enter macros manually ${show?'▴':'▾'}</button>`;
}
function autoCalcMeal(){
  const p=parseFloat(document.getElementById('meal-pro')?.value)||0;
  const c=parseFloat(document.getElementById('meal-carb')?.value)||0;
  const f=parseFloat(document.getElementById('meal-fat')?.value)||0;
  const calEl=document.getElementById('meal-cal');
  if(calEl&&!calEl.value)calEl.placeholder=Math.round(p*4+c*4+f*9)||'Auto';
}
function setFoodTab(tab){
  window._mealFoodTab=tab;
  document.querySelectorAll('#meal-ov .ptab').forEach(t=>t.classList.remove('on'));
  const el=document.getElementById('ftab-'+tab);if(el)el.classList.add('on');
  document.getElementById('food-search').value='';
  renderFoodTab();
}
function onFoodSearch(){
  const q=document.getElementById('food-search')?.value?.trim()||'';
  renderFoodTab(q);
}
function renderFoodTab(query){
  const el=document.getElementById('food-list');if(!el)return;
  const tab=window._mealFoodTab||'starred';
  let foods=[];let savedMealMatches=[];
  if(query){
    foods=searchFoods(query);
    const lc=query.toLowerCase();
    savedMealMatches=(S.savedMeals||[]).filter(c=>String(c.name||'').toLowerCase().includes(lc));
  }else if(tab==='starred'){
    foods=getStarredFoods();
    if(!foods.length){el.innerHTML=`<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">No starred foods yet.<br>Tap ★ on any food to star it.</div>`;return;}
  }else if(tab==='recent'){
    // Merge recent foods + recent saved meals
    const recentFoods=getRecentFoods();
    const recentMeals=(S.recentSavedMeals||[]).map(id=>(S.savedMeals||[]).find(c=>c.id===id)).filter(Boolean);
    let html='';
    if(recentMeals.length){
      html+=recentMeals.map(c=>{
        return savedMealRow(c);
      }).join('');
    }
    html+=recentFoods.map(f=>renderFoodRow(f)).join('');
    if(!html)html=`<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">No recent items.<br>Foods you log will appear here.</div>`;
    el.innerHTML=html;return;
  }else if(tab==='all'){
    foods=allFoods();
  }else if(tab==='combos'){
    renderComboList(el);return;
  }
  // Render saved meal matches first (from search), then foods
  let html='';
  if(savedMealMatches.length){
    html+=savedMealMatches.map(c=>{
      return savedMealRow(c);
    }).join('');
  }
  html+=foods.map(f=>renderFoodRow(f)).join('');
  el.innerHTML=html;
}
function savedMealRow(c){
  return`<div class="hi" style="cursor:pointer" onclick="addComboToMeal(${jsq(c.id)})">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600">${esc(c.name)} <span style="font-size:10px;color:var(--green);font-weight:700">MEAL</span></div>
      <div style="font-size:11px;color:var(--muted)">${esc(c.items.map(it=>it.name).join(', '))}</div>
    </div>
    <div class="mono" style="font-size:12px;font-weight:600;color:var(--navy);flex-shrink:0">${savedMealCals(c)}kcal</div>
  </div>`;
}
function renderFoodRow(f){
  return`<div class="hi" style="cursor:pointer" onclick="addFoodToMeal(${jsq(f.id)})">
    <button class="ib" style="font-size:16px;flex-shrink:0;margin-right:6px;color:${isStarred(f.id)?'var(--gold)':'var(--muted2)'}" onclick="event.stopPropagation();toggleStar(${jsq(f.id)});onFoodSearch()" aria-label="Star">★</button>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</div>
      <div style="font-size:11px;color:var(--muted)">P${fmt1(f.protein)}g · C${fmt1(f.carbs)}g · F${fmt1(f.fat)}g</div>
    </div>
    <div style="flex-shrink:0;text-align:right">
      <div class="mono" style="font-size:12px;font-weight:600;color:var(--navy)">${Math.round(f.cals||0)}kcal</div>
      <div style="font-size:10px;color:var(--muted)">${esc(f.serving)}</div>
    </div>
  </div>`;
}
function renderComboList(el){
  const combos=S.savedMeals||[];
  if(!combos.length){el.innerHTML=`<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">No saved meals yet.<br>Build a meal and tap "Save as Reusable Meal" to save it.</div>`;return;}
  el.innerHTML=combos.map(c=>{
    return`<div class="hi" style="cursor:pointer" onclick="addComboToMeal(${jsq(c.id)})">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">${esc(c.name)}</div>
        <div style="font-size:11px;color:var(--muted)">${c.items.length} items · ${savedMealCals(c)}kcal</div>
      </div>
      <button class="ib delbtn" style="flex-shrink:0" onclick="event.stopPropagation();deleteCombo(${jsq(c.id)})" aria-label="Delete saved meal">✕</button>
    </div>`;
  }).join('');
}
function addFoodToMeal(foodId){
  const f=findFood(foodId);if(!f)return;
  const existing=_mealItems.find(it=>it.foodId===foodId);
  if(existing){existing.qty=r1((parseFloat(existing.qty)||0)+1);updateMealItems();return;}
  _mealItems.push({foodId:f.id,name:f.name,qty:1,serving:f.serving,protein:f.protein,carbs:f.carbs,fat:f.fat,cals:f.cals});
  updateMealItems();
}
function addComboToMeal(comboId){
  const combo=(S.savedMeals||[]).find(c=>c.id===comboId);if(!combo)return;
  window._loggedSavedMealId=comboId;
  combo.items.forEach(it=>{
    const existing=_mealItems.find(x=>x.foodId===it.foodId);
    if(existing){existing.qty=r1((parseFloat(existing.qty)||0)+(parseFloat(it.qty)||1));}
    else{_mealItems.push({...it});}
  });
  updateMealItems();
}
function deleteCombo(id){
  const idx=(S.savedMeals||[]).findIndex(c=>c.id===id);if(idx<0)return;
  const gone=S.savedMeals.splice(idx,1)[0];
  S.recentSavedMeals=(S.recentSavedMeals||[]).filter(x=>x!==id);
  save();renderFoodTab();
  toast('Saved meal deleted','',{action:'Undo',onAction:()=>{S.savedMeals.splice(Math.min(idx,S.savedMeals.length),0,gone);save();renderFoodTab();}});
}
function adjMealItem(idx,d){
  if(!_mealItems[idx])return;
  _mealItems[idx].qty=Math.max(0.5,r1((parseFloat(_mealItems[idx].qty)||0)+d));
  updateMealItems();
}
function removeMealItem(idx){_mealItems.splice(idx,1);if(!_mealItems.length)window._loggedSavedMealId=null;updateMealItems();}
function updateMealItems(){
  const sec=document.getElementById('meal-items-section');
  const list=document.getElementById('meal-items-list');
  const total=document.getElementById('meal-total');
  const comboBtn=document.getElementById('save-combo-btn');
  if(!sec||!list)return;
  if(!_mealItems.length){sec.style.display='none';if(comboBtn)comboBtn.style.display='none';return;}
  sec.style.display='block';
  if(comboBtn)comboBtn.style.display=_mealItems.length>=2?'block':'none';
  let tp=0,tc=0,tf=0,tk=0;
  list.innerHTML=_mealItems.map((it,i)=>{
    const t=mealItemTotals(it);const ip=t.protein,ic=t.carbs,ifat=t.fat,ik=t.cals;
    tp+=ip;tc+=ic;tf+=ifat;tk+=ik;
    return`<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--hair)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.name)}</div>
        <div style="font-size:10px;color:var(--muted)">${esc(it.serving||'')} · P${fmt1(ip)} C${fmt1(ic)} F${fmt1(ifat)}</div>
      </div>
      <button class="ib" style="font-size:16px;font-weight:700" onclick="adjMealItem(${i},-0.5)" aria-label="Less">−</button>
      <div class="mono" style="font-size:13px;font-weight:600;width:26px;text-align:center">${fmt1(it.qty)}</div>
      <button class="ib" style="font-size:16px;font-weight:700" onclick="adjMealItem(${i},0.5)" aria-label="More">+</button>
      <div class="mono" style="font-size:11px;color:var(--muted);width:48px;text-align:right">${ik}kcal</div>
      <button class="ib delbtn" onclick="removeMealItem(${i})" aria-label="Remove">✕</button>
    </div>`;
  }).join('');
  if(total)total.textContent=`${Math.round(tk)} kcal`;
}
function saveMeal(){
  const mp=parseFloat(document.getElementById('meal-pro')?.value)||0;
  const mc=parseFloat(document.getElementById('meal-carb')?.value)||0;
  const mf=parseFloat(document.getElementById('meal-fat')?.value)||0;
  const mcEl=document.getElementById('meal-cal');
  const mCals=mcEl?.value?parseFloat(mcEl.value):0;
  const hasManual=!!(mp||mc||mf||mCals);
  if(!_mealItems.length&&!hasManual){toast('Add foods or enter macros');return;}
  mealTypeSheet('What meal is this?','doSaveMealWithType','Back');
}
function doSaveMealWithType(mealType){
  closeOv('mtype-ov');
  let date=document.getElementById('meal-date')?.value||today();
  if(date>today())date=today();
  const mp=parseFloat(document.getElementById('meal-pro')?.value)||0;
  const mc=parseFloat(document.getElementById('meal-carb')?.value)||0;
  const mf=parseFloat(document.getElementById('meal-fat')?.value)||0;
  const mcEl=document.getElementById('meal-cal');
  const mCals=mcEl?.value?parseFloat(mcEl.value):0;
  const hasManual=!!(mp||mc||mf||mCals);
  if(!S.meals)S.meals=[];
  if(window._mealTarget){
    // Planning, not logging: the items go into the weekly plan with their per-serving numbers.
    const items=_mealItems.map(it=>Object.assign({},it));
    if(hasManual)items.push({foodId:null,name:items.length?'Extra':mealType,qty:1,serving:'1 serving',protein:mp,carbs:mc,fat:mf,cals:mCals||Math.round(mp*4+mc*4+mf*9),est:true});
    const dow=window._mealTarget.plan;
    if(planSaveFromBuilder(mealType,items)){_mealItems=[];window._mealTarget=null;closeOv('meal-ov');toast('Saved to '+PLAN_DAYS[dow],'green');refreshPlanViews();}
    return;
  }
  if(_mealItems.length>0){
    let tp=0,tc=0,tf=0,tk=0;
    const items=_mealItems.map(it=>{
      const t=mealItemTotals(it);const ip=t.protein,ic=t.carbs,ifat=t.fat,ik=t.cals;
      tp+=ip;tc+=ic;tf+=ifat;tk+=ik;
      if(!window._loggedSavedMealId)trackRecent(it.foodId);
      return{foodId:it.foodId,name:it.name,qty:it.qty,serving:it.serving,protein:ip,carbs:ic,fat:ifat,cals:ik};
    });
    if(hasManual){tp+=mp;tc+=mc;tf+=mf;tk+=(mCals||Math.round(mp*4+mc*4+mf*9));}
    let savedMealName=null;
    if(window._loggedSavedMealId){
      const sm=(S.savedMeals||[]).find(c=>c.id===window._loggedSavedMealId);
      if(sm)savedMealName=sm.name;
      trackRecentMeal(window._loggedSavedMealId);window._loggedSavedMealId=null;
    }
    S.meals.push({id:uid(),date,type:mealType,name:mealType,savedMealName,items,protein:r1(tp),carbs:r1(tc),fat:r1(tf),cals:Math.round(tk)});
  }else{
    const cals=mCals||Math.round(mp*4+mc*4+mf*9);
    S.meals.push({id:uid(),date,type:mealType,name:mealType,protein:mp,carbs:mc,fat:mf,cals});
  }
  _mealItems=[];save();closeOv('meal-ov');
  toast(mealType+' logged'+(date!==today()?' for '+fmtDay(date):''),'green');if(S.tab==='nutrition')renderNutrition(document.getElementById('content'));else rerender();
}
function saveAsCombo(){
  if(_mealItems.length<2){toast('Add at least 2 items');return;}
  const ov=makeOv('combo-ov');
  ov.innerHTML=`<div class="modal" style="max-height:260px"><div class="mh"></div><div class="mt">Save as Reusable Meal</div>
    <div class="fg"><label class="fl">Meal name</label><input type="text" id="combo-name" placeholder="e.g. Morning Eggs, Post-Workout Shake"></div>
    <button class="btn btp bfw" onclick="doSaveCombo()">Save Meal</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('combo-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  setTimeout(()=>document.getElementById('combo-name')?.focus(),150);
}
function doSaveCombo(){
  const name=document.getElementById('combo-name')?.value?.trim();
  if(!name){toast('Enter a name');return;}
  if(!S.savedMeals)S.savedMeals=[];
  S.savedMeals.push({id:uid(),name,items:_mealItems.map(it=>({foodId:it.foodId,name:it.name,qty:it.qty,serving:it.serving,protein:it.protein,carbs:it.carbs,fat:it.fat,cals:it.cals}))});
  save();closeOv('combo-ov');toast('Meal saved!','green');
}
function toggleMealGroup(type){
  if(!window._expandedMealGroups)window._expandedMealGroups={};
  window._expandedMealGroups[type]=!window._expandedMealGroups[type];
  renderNutrition(document.getElementById('content'));
}
function deleteMeal(id){
  const idx=(S.meals||[]).findIndex(m=>m.id===id);if(idx<0)return;
  const gone=S.meals.splice(idx,1)[0];
  save();renderNutrition(document.getElementById('content'));
  toast('Meal removed','',{action:'Undo',onAction:()=>{S.meals.splice(Math.min(idx,S.meals.length),0,gone);save();if(S.tab==='nutrition')renderNutrition(document.getElementById('content'));}});
}
