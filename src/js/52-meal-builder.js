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
// target (optional): {plan:dow} saves the meal into the weekly plan instead of logging it.
function showAddMeal(ds,keepItems,target){
  if(!keepItems){_mealItems=[];window._loggedSavedMealId=null;window._mealTarget=target||null;window._mealEdit=null;}
  openMealSheet(ds||nutDay());
  // Only reach for the keyboard when there is nothing to tap yet.
  if(window._mealFoodTab==='all')setTimeout(()=>document.getElementById('food-search')?.focus(),200);
}
// One sheet for logging, editing and planning. The meal (Breakfast, Lunch…) is chosen in the
// sheet itself; the food list takes whatever height is left over, and what is in the meal stays
// pinned above the button.
function openMealSheet(date){
  const tg=window._mealTarget,ed=window._mealEdit;
  window._mealTypePick=tg?(tg.type||likelyMealType()):ed?ed.type:likelyMealType();
  window._mealFoodTab=getStarredFoods().length?'starred':(getRecentFoods().length||(S.recentSavedMeals||[]).length)?'recent':'all';
  const ov=makeOv('meal-ov');
  ov.innerHTML=buildMealModalHTML(date);
  document.body.appendChild(ov);attachSwipeDown(ov);
  window._mealOpen=0;
  paintFoodTabs();renderFoodTab();updateMealItems();
}
function mealTypeChipsHTML(){
  const pick=window._mealTypePick;
  return MEAL_TYPES.concat(pick&&!MEAL_TYPES.includes(pick)?[pick]:[]).map(t=>`<button class="chip${t===pick?' on':''}" data-t="${esc(t)}" aria-pressed="${t===pick?'true':'false'}" onclick="pickMealType(${jsq(t)})">${esc(t)}</button>`).join('');
}
function pickMealType(t){
  window._mealTypePick=t;
  const el=document.getElementById('meal-types');if(el)el.innerHTML=mealTypeChipsHTML();
}
function buildMealModalHTML(date){
  const tg=window._mealTarget;const ed=window._mealEdit;
  return`<div class="modal meal-sheet"><div class="mh"></div>
    <div class="ms-head"><div class="mt">${tg?(tg.replace?'Edit planned meal':'Plan a meal'):ed?'Edit meal':'Log meal'}</div>
      ${tg?'':`<input type="date" id="meal-date" value="${esc(date)}" max="${today()}" aria-label="Date">`}</div>
    ${tg?`<div class="ms-plan"><label for="plan-meal-name">${PLAN_SHORT[tg.plan]} plan</label>
      <input type="text" id="plan-meal-name" maxlength="60" value="${esc(tg.name||'')}" placeholder="Name this meal (optional)"></div>`:''}
    <div class="chips-x" id="meal-types">${mealTypeChipsHTML()}</div>
    <div class="ms-search">
      <input type="text" id="food-search" placeholder="Search foods and meals…" oninput="onFoodSearch()" autocomplete="off" autocorrect="off">
      <button class="btn bts" onclick="showBarcodeScanner()" aria-label="Scan a barcode">${ICON('camera',17)} Scan</button>
    </div>
    <div class="ptabs ms-tabs">
      <button class="ptab" id="ftab-starred" onclick="setFoodTab('starred')">Starred</button>
      <button class="ptab" id="ftab-recent" onclick="setFoodTab('recent')">Recent</button>
      <button class="ptab" id="ftab-all" onclick="setFoodTab('all')">Foods</button>
      <button class="ptab" id="ftab-combos" onclick="setFoodTab('combos')">Meals</button>
      <button class="ptab" id="ftab-manual" onclick="setFoodTab('manual')">By hand</button>
    </div>
    <div class="ms-list" id="food-list"></div>
    <div class="ms-list" id="manual-entry" style="display:none">
      <div class="fine" style="margin:12px 2px">For a meal you know the numbers for but not the foods. They are added to anything you pick from the lists.</div>
      <div class="fe-grid">
        <div><label class="fl">Protein (g)</label><input type="number" inputmode="decimal" id="meal-pro" placeholder="0" oninput="autoCalcMeal()"></div>
        <div><label class="fl">Carbs (g)</label><input type="number" inputmode="decimal" id="meal-carb" placeholder="0" oninput="autoCalcMeal()"></div>
        <div><label class="fl">Fat (g)</label><input type="number" inputmode="decimal" id="meal-fat" placeholder="0" oninput="autoCalcMeal()"></div>
        <div><label class="fl">Calories</label><input type="number" inputmode="numeric" id="meal-cal" placeholder="Auto" oninput="autoCalcMeal()"></div>
      </div>
    </div>
    <div class="ms-foot">
      <div id="meal-items-section" style="display:none">
        <div class="ms-sum"><b>In this meal</b><span id="meal-total"></span></div>
        <div id="meal-items-list"></div>
        <a class="ms-link" id="save-combo-btn" style="display:none" onclick="saveAsCombo()">Save these as a reusable meal</a>
      </div>
      <div class="ms-acts">
        <button class="btn btg" onclick="closeOv('meal-ov')">Cancel</button>
        <button class="btn btp" onclick="saveMeal()">${tg?(tg.replace?'Save changes':'Add to plan'):ed?'Save changes':'Log meal'}</button>
      </div>
    </div>
  </div>`;
}
// The numbers typed on the By hand tab. Calories follow the macros unless typed.
function mealManual(){
  const n=id=>Math.max(0,parseFloat(document.getElementById(id)?.value)||0);
  const p=n('meal-pro'),c=n('meal-carb'),f=n('meal-fat'),typed=n('meal-cal');
  const k=typed||Math.round(p*4+c*4+f*9);
  return{protein:p,carbs:c,fat:f,cals:k,has:!!(p||c||f||typed)};
}
function autoCalcMeal(){
  const m=mealManual();const calEl=document.getElementById('meal-cal');
  if(calEl&&!calEl.value)calEl.placeholder=Math.round(m.protein*4+m.carbs*4+m.fat*9)||'Auto';
  updateMealItems();
}
function clearMealManual(){
  ['meal-pro','meal-carb','meal-fat','meal-cal'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  autoCalcMeal();
}
function paintFoodTabs(){
  const tab=window._mealFoodTab||'starred';
  ['starred','recent','all','combos','manual'].forEach(t=>{const el=document.getElementById('ftab-'+t);if(el)el.classList.toggle('on',t===tab);});
  const list=document.getElementById('food-list'),hand=document.getElementById('manual-entry');
  if(list)list.style.display=tab==='manual'?'none':'';
  if(hand)hand.style.display=tab==='manual'?'block':'none';
}
function setFoodTab(tab){
  window._mealFoodTab=tab;
  const q=document.getElementById('food-search');if(q)q.value='';
  paintFoodTabs();
  if(tab!=='manual')renderFoodTab();
}
function onFoodSearch(){
  const q=document.getElementById('food-search')?.value?.trim()||'';
  // Typing a search while the hand-entry fields are showing means "find me a food".
  if(q&&window._mealFoodTab==='manual'){window._mealFoodTab='all';paintFoodTabs();}
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
    if(!foods.length){el.innerHTML=`<div class="ms-empty">No starred foods yet.<br>Tap ★ on any food to keep it here.</div>`;return;}
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
    if(!html)html=`<div class="ms-empty">Nothing recent.<br>Foods you log appear here.</div>`;
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
  // Not in the list? Make it. The Foods tab always offers this; a search offers it under the results.
  if(query||tab==='all')html=(tab==='all'&&!query?newFoodRowHTML(''):'')+html+(query?newFoodRowHTML(query):'');
  el.innerHTML=html;
}
function newFoodRowHTML(q){
  return`<button class="row row-tap new-food" onclick="showFoodEditor({preset:{name:${jsq(q)}}})"><span class="row-ic tone-info">${ICON('plus',16)}</span><span class="row-main"><span class="row-t">${q?`Create “${esc(q)}”`:'New food'}</span><span class="row-s">Add your own food with its label numbers</span></span></button>`;
}
function savedMealRow(c){
  return`<div class="hi" style="cursor:pointer" onclick="addComboToMeal(${jsq(c.id)})">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600">${esc(c.name)} <span style="font-size:12px;color:var(--green);font-weight:700">MEAL</span></div>
      <div style="font-size:12px;color:var(--muted)">${esc(c.items.map(it=>it.name).join(', '))}</div>
    </div>
    <div class="mono" style="font-size:12px;font-weight:600;color:var(--navy);flex-shrink:0">${savedMealCals(c)}kcal</div>
  </div>`;
}
function renderFoodRow(f){
  const inMeal=_mealItems.some(it=>it.foodId===f.id);
  return`<div class="hi${inMeal?' hi-in':''}" style="cursor:pointer" onclick="addFoodToMeal(${jsq(f.id)})">
    <button class="ib ib-q star${isStarred(f.id)?' on':''}" onclick="event.stopPropagation();toggleStar(${jsq(f.id)});onFoodSearch()" aria-label="${isStarred(f.id)?'Unstar':'Star'} ${esc(f.name)}">★</button>
    <div style="flex:1;min-width:0">
      <div class="hi-t">${esc(f.name)}${inMeal?'<span class="pill pill-acc">In meal</span>':''}</div>
      <div class="hi-s">${esc(f.serving||'1 serving')} · P ${fmt1(f.protein)} · C ${fmt1(f.carbs)} · F ${fmt1(f.fat)}</div>
    </div>
    <div class="hi-k">${Math.round(f.cals||0)}<span> kcal</span></div>
    ${isCustomFood(f.id)?`<button class="ib ib-q" style="flex-shrink:0;margin-left:4px" onclick="event.stopPropagation();showFoodEditor({id:${jsq(f.id)}})" aria-label="Edit ${esc(f.name)}">${ICON('pencil',15)}</button>`:''}
  </div>`;
}
function renderComboList(el){
  const combos=S.savedMeals||[];
  if(!combos.length){el.innerHTML=`<div class="ms-empty">No saved meals yet.<br>Put two or more foods in a meal and tap “Save these as a reusable meal”.</div>`;return;}
  el.innerHTML=combos.map(c=>{
    return`<div class="hi" style="cursor:pointer" onclick="addComboToMeal(${jsq(c.id)})">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600">${esc(c.name)}</div>
        <div style="font-size:12px;color:var(--muted)">${c.items.length} items · ${savedMealCals(c)}kcal</div>
      </div>
      <button class="ib delbtn" style="flex-shrink:0" onclick="event.stopPropagation();deleteCombo(${jsq(c.id)})" aria-label="Delete saved meal">✕</button>
    </div>`;
  }).join('');
}
function addFoodToMeal(foodId){
  const f=findFood(foodId);if(!f)return;
  // Tapping a food already in the meal adds another serving, but only to an item that IS that
  // food by the serving (a scanned "150g" entry of the same product stays its own line).
  const existing=_mealItems.find(it=>it.foodId===foodId&&it.serving===f.serving);
  if(existing)existing.qty=Math.round(((parseFloat(existing.qty)||0)+1)*10000)/10000;
  else _mealItems.push(foodItem(f,1));
  showMealItem(existing?_mealItems.indexOf(existing):_mealItems.length-1);onFoodSearch();
}
function addComboToMeal(comboId){
  const combo=(S.savedMeals||[]).find(c=>c.id===comboId);if(!combo)return;
  window._loggedSavedMealId=comboId;
  combo.items.forEach(it=>{
    const existing=_mealItems.find(x=>x.foodId&&x.foodId===it.foodId&&x.serving===it.serving);
    if(existing){existing.qty=Math.round(((parseFloat(existing.qty)||0)+(parseFloat(it.qty)||1))*10000)/10000;}
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
// d is in servings (the − and + buttons pass half a serving). An item entered by weight moves by
// that unit's own step instead: 10 g or half an ounce.
function adjMealItem(idx,d){
  const it=_mealItems[idx];if(!it)return;
  const u=amtUnit(it.unit,it.sg);
  if(u==='serv'){const q=Math.round(((parseFloat(it.qty)||0)+d)*10000)/10000;if(q>0)it.qty=q;}
  else{const v=qtyToAmt(it.qty,u,it.sg)+Math.sign(d)*AMT_STEP[u];if(v>0)it.qty=amtToQty(v,u,it.sg);}
  updateMealItems();
}
// Typing an amount: the item follows every keystroke, but the row is not redrawn (that would
// take the cursor away). Nonsense leaves the last good amount in place.
function mealItemInput(idx){
  const it=_mealItems[idx],el=document.getElementById('mi-q-'+idx);if(!it||!el)return;
  const q=amtToQty(el.value,it.unit,it.sg);
  if(q>0)it.qty=Math.min(q,200);
  paintMealItem(idx);paintMealTotal();
}
function mealItemBlur(idx){
  const it=_mealItems[idx],el=document.getElementById('mi-q-'+idx);if(!it||!el)return;
  el.value=fmtAmt(qtyToAmt(it.qty,it.unit,it.sg));
}
// Switching unit keeps the amount of food the same and only changes how it is written.
function mealItemUnit(idx,u){
  const it=_mealItems[idx];if(!it)return;
  u=amtUnit(u,it.sg);
  if(u==='serv')delete it.unit;else it.unit=u; // the amount itself is untouched, so switching back and forth never drifts
  updateMealItems();
}
function removeMealItem(idx){
  _mealItems.splice(idx,1);if(!_mealItems.length)window._loggedSavedMealId=null;
  if(window._mealOpen>idx||window._mealOpen>=_mealItems.length)window._mealOpen=Math.max(0,window._mealOpen-1);
  updateMealItems();onFoodSearch();
}
// One item at a time shows its controls; the rest are a line each, so a long meal does not
// squeeze the food list. The item just added (or tapped) is the open one.
function showMealItem(idx){
  window._mealOpen=idx;updateMealItems();
  const row=document.getElementById('mi-'+idx);if(row&&row.scrollIntoView)row.scrollIntoView({block:'nearest'});
}
function mealTotalsNow(){
  const t={protein:0,carbs:0,fat:0,cals:0};
  _mealItems.forEach(it=>{const x=mealItemTotals(it);t.protein+=x.protein;t.carbs+=x.carbs;t.fat+=x.fat;t.cals+=x.cals;});
  const m=mealManual();
  if(m.has){t.protein+=m.protein;t.carbs+=m.carbs;t.fat+=m.fat;t.cals+=m.cals;}
  return{protein:r1(t.protein),carbs:r1(t.carbs),fat:r1(t.fat),cals:Math.round(t.cals),manual:m};
}
function macroLine(t){return`P ${fmt1(t.protein)} · C ${fmt1(t.carbs)} · F ${fmt1(t.fat)}`;}
function paintMealItem(idx){
  const it=_mealItems[idx];if(!it)return;const t=mealItemTotals(it);
  const k=document.getElementById('mi-k-'+idx),m=document.getElementById('mi-m-'+idx);
  if(k)k.textContent=t.cals+' kcal';if(m)m.textContent=macroLine(t);
}
function paintMealTotal(){
  const el=document.getElementById('meal-total');if(!el)return;
  const t=mealTotalsNow();el.textContent=`${t.cals.toLocaleString()} kcal · ${macroLine(t)}`;
}
function mealItemRowHTML(it,i){
  const t=mealItemTotals(it);const u=amtUnit(it.unit,it.sg);const canWeigh=parseFloat(it.sg)>0;
  const x=`<button class="ib ib-q" onclick="event.stopPropagation();removeMealItem(${i})" aria-label="Remove ${esc(it.name)}">${ICON('x',14)}</button>`;
  if(i!==(window._mealOpen||0)){
    return`<div class="mi mi-c" id="mi-${i}" onclick="showMealItem(${i})" role="button" aria-label="Change the amount of ${esc(it.name)}">
      <div class="mi-top"><b>${esc(it.name)}</b><i>${u==='serv'?fmtAmt(it.qty)+' × '+esc(it.serving||'serving'):itemAmt(it)}</i><span>${t.cals} kcal</span>${x}</div></div>`;
  }
  const opt=(v,l)=>`<option value="${v}"${u===v?' selected':''}>${l}</option>`;
  return`<div class="mi" id="mi-${i}">
    <div class="mi-top"><b>${esc(it.name)}</b><span id="mi-k-${i}">${t.cals} kcal</span>${x}</div>
    <div class="mi-ctl">
      <button class="ib" onclick="adjMealItem(${i},-0.5)" aria-label="Less">−</button>
      <input type="number" inputmode="decimal" id="mi-q-${i}" value="${fmtAmt(qtyToAmt(it.qty,u,it.sg))}" min="0" step="any" oninput="mealItemInput(${i})" onchange="mealItemBlur(${i})" aria-label="Amount of ${esc(it.name)}">
      <button class="ib" onclick="adjMealItem(${i},0.5)" aria-label="More">+</button>
      ${canWeigh?`<select id="mi-u-${i}" onchange="mealItemUnit(${i},this.value)" aria-label="Unit for ${esc(it.name)}">${opt('serv','× '+esc(it.serving||'serving'))}${opt('g','grams')}${opt('oz','ounces')}</select>`
        :`<span class="mi-x">× ${esc(it.serving||'serving')}</span>`}
      <span class="mi-m" id="mi-m-${i}">${macroLine(t)}</span>
    </div></div>`;
}
function updateMealItems(){
  const sec=document.getElementById('meal-items-section');
  const list=document.getElementById('meal-items-list');
  const comboBtn=document.getElementById('save-combo-btn');
  if(!sec||!list)return;
  const m=mealManual();
  if(!_mealItems.length&&!m.has){sec.style.display='none';if(comboBtn)comboBtn.style.display='none';return;}
  sec.style.display='flex';
  if(comboBtn)comboBtn.style.display=_mealItems.length>=2?'':'none';
  list.innerHTML=_mealItems.map(mealItemRowHTML).join('')+(m.has?`<div class="mi mi-hand" onclick="setFoodTab('manual')" role="button">
    <div class="mi-top"><b>Entered by hand</b><span>${Math.round(m.cals)} kcal</span>
      <button class="ib ib-q" onclick="event.stopPropagation();clearMealManual()" aria-label="Remove the numbers entered by hand">${ICON('x',14)}</button></div>
    <div class="mi-m" style="text-align:left">${macroLine(m)}</div></div>`:'');
  paintMealTotal();
}
function saveMeal(){
  if(!_mealItems.length&&!mealManual().has){toast('Pick a food, or enter the numbers by hand');return;}
  doSaveMealWithType(window._mealTypePick||likelyMealType());
}
function doSaveMealWithType(mealType){
  closeOv('mtype-ov');
  let date=document.getElementById('meal-date')?.value||today();
  if(date>today())date=today();
  const man=mealManual();const hasManual=man.has;
  if(!S.meals)S.meals=[];
  if(window._mealTarget){
    // Planning, not logging: the items go into the weekly plan with their per-serving numbers.
    const items=_mealItems.map(it=>Object.assign({},it));
    if(hasManual)items.push({foodId:null,name:items.length?'Extra':mealType,qty:1,serving:'1 serving',protein:man.protein,carbs:man.carbs,fat:man.fat,cals:man.cals,est:true});
    const dow=window._mealTarget.plan;
    if(planSaveFromBuilder(mealType,items)){_mealItems=[];window._mealTarget=null;closeOv('meal-ov');toast('Saved to '+PLAN_DAYS[dow],'green');refreshPlanViews();}
    return;
  }
  const ed=window._mealEdit;const edAt=ed?S.meals.findIndex(m=>m.id===ed.id):-1;const before=edAt>=0?S.meals[edAt]:null;
  // An edit replaces the meal where it stands; a new meal is added.
  const put=m=>{if(before){m.id=before.id;if(before.planMealId)m.planMealId=before.planMealId;S.meals[edAt]=m;}else S.meals.push(m);};
  if(_mealItems.length>0){
    let tp=0,tc=0,tf=0,tk=0;
    const items=_mealItems.map(it=>{
      const t=mealItemTotals(it);const ip=t.protein,ic=t.carbs,ifat=t.fat,ik=t.cals;
      tp+=ip;tc+=ic;tf+=ifat;tk+=ik;
      if(!window._loggedSavedMealId)trackRecent(it.foodId);
      return loggedItem(it,t);
    });
    if(hasManual){tp+=man.protein;tc+=man.carbs;tf+=man.fat;tk+=man.cals;}
    let savedMealName=before?(before.savedMealName||null):null;
    if(window._loggedSavedMealId){
      const sm=(S.savedMeals||[]).find(c=>c.id===window._loggedSavedMealId);
      if(sm)savedMealName=sm.name;
      trackRecentMeal(window._loggedSavedMealId);window._loggedSavedMealId=null;
    }
    put({id:uid(),date,type:mealType,name:mealType,savedMealName,items,protein:r1(tp),carbs:r1(tc),fat:r1(tf),cals:Math.round(tk)});
  }else{
    put({id:uid(),date,type:mealType,name:mealType,protein:man.protein,carbs:man.carbs,fat:man.fat,cals:man.cals});
  }
  _mealItems=[];window._mealEdit=null;save();closeOv('meal-ov');
  const redraw=()=>{if(S.tab==='nutrition')renderNutrition(document.getElementById('content'));else rerender();};
  if(before)toast('Meal updated','green',{action:'Undo',onAction:()=>{const i=S.meals.findIndex(m=>m.id===before.id);if(i>=0){S.meals[i]=before;save();redraw();}}});
  else toast(mealType+' logged'+(date!==today()?' for '+fmtDay(date):''),'green');
  redraw();
}
// What a logged meal keeps for each item: the totals for the amount eaten, how many servings that
// was, and (when it was weighed) the unit and the serving's gram weight, so it reads back as typed.
function loggedItem(it,t){
  t=t||mealItemTotals(it);
  const o={foodId:it.foodId||null,name:it.name,qty:it.qty,serving:it.serving,protein:t.protein,carbs:t.carbs,fat:t.fat,cals:t.cals};
  if(parseFloat(it.sg)>0){o.sg=parseFloat(it.sg);const u=amtUnit(it.unit,it.sg);if(u!=='serv')o.unit=u;}
  if(it.foodId)rememberFoodUnit(it.foodId,o.unit);
  return o;
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
  const man=mealManual(); // numbers typed on the By hand tab are part of the meal on screen, so they are saved with it
  S.savedMeals.push({id:uid(),name,items:_mealItems.map(it=>{
    const o={foodId:it.foodId,name:it.name,qty:it.qty,serving:it.serving,protein:it.protein,carbs:it.carbs,fat:it.fat,cals:it.cals};
    if(parseFloat(it.sg)>0){o.sg=parseFloat(it.sg);if(amtUnit(it.unit,it.sg)!=='serv')o.unit=it.unit;}
    return o;}).concat(man.has?[{foodId:null,name:'Entered by hand',qty:1,serving:'1 serving',protein:man.protein,carbs:man.carbs,fat:man.fat,cals:man.cals}]:[])});
  save();closeOv('combo-ov');toast('Meal saved!','green');
}
function deleteMeal(id){
  const idx=(S.meals||[]).findIndex(m=>m.id===id);if(idx<0)return;
  const gone=S.meals.splice(idx,1)[0];
  save();renderNutrition(document.getElementById('content'));
  toast('Meal removed','',{action:'Undo',onAction:()=>{S.meals.splice(Math.min(idx,S.meals.length),0,gone);save();if(S.tab==='nutrition')renderNutrition(document.getElementById('content'));}});
}

// Open a logged meal in the builder. Logged items hold totals for the amount eaten; the builder
// works per serving, so each is divided back by its quantity. Numbers that were typed in rather
// than picked from foods go back onto the By hand tab.
function editMeal(id){
  const m=(S.meals||[]).find(x=>x.id===id);if(!m)return;
  window._loggedSavedMealId=null;window._mealTarget=null;
  window._mealEdit={id:m.id,type:m.type||m.name||'Snack'};
  const n=v=>parseFloat(v)||0;
  let ip=0,ic=0,ifat=0,ik=0;
  _mealItems=(m.items||[]).map(it=>{
    const q=n(it.qty)>0?n(it.qty):1;
    ip+=n(it.protein);ic+=n(it.carbs);ifat+=n(it.fat);ik+=n(it.cals);
    const o={foodId:it.foodId||null,name:it.name,qty:q,serving:it.serving||'',protein:n(it.protein)/q,carbs:n(it.carbs)/q,fat:n(it.fat)/q,cals:n(it.cals)/q};
    // Dividing rounded totals back loses precision (10 g of broccoli is "3 kcal, 0 g fat"). When
    // the food is still in the list and still gives exactly what was logged, use its own numbers.
    const src=it.foodId?findFood(it.foodId):null;
    if(src&&src.serving===it.serving){
      const t=mealItemTotals({qty:q,protein:src.protein,carbs:src.carbs,fat:src.fat,cals:src.cals});
      if(t.cals===Math.round(n(it.cals))&&t.protein===r1(n(it.protein))&&t.carbs===r1(n(it.carbs))&&t.fat===r1(n(it.fat)))
        Object.assign(o,{protein:n(src.protein),carbs:n(src.carbs),fat:n(src.fat),cals:n(src.cals)});
    }
    // A meal logged before weights existed can still be re-weighed if its food has a gram weight now.
    const sg=n(it.sg)||(it.foodId&&findFood(it.foodId)&&findFood(it.foodId).serving===it.serving?servingGrams(findFood(it.foodId)):0);
    if(sg>0){o.sg=sg;if(amtUnit(it.unit,sg)!=='serv')o.unit=it.unit;}
    return o;
  });
  openMealSheet(m.date);
  // What was typed by hand is the meal's total less its foods (taken from the totals as logged,
  // so re-saving without changes cannot move the meal).
  const extra={p:r1(n(m.protein)-ip),c:r1(n(m.carbs)-ic),f:r1(n(m.fat)-ifat),k:Math.round(n(m.cals)-ik)};
  if(!_mealItems.length||extra.p>0.05||extra.c>0.05||extra.f>0.05||extra.k>1){
    const set=(elId,v)=>{const el=document.getElementById(elId);if(el&&v>0)el.value=v;};
    set('meal-pro',Math.max(0,extra.p));set('meal-carb',Math.max(0,extra.c));set('meal-fat',Math.max(0,extra.f));
    // Calories that are just the macros added up stay automatic, so changing a macro moves them.
    const auto=Math.round(Math.max(0,extra.p)*4+Math.max(0,extra.c)*4+Math.max(0,extra.f)*9);
    if(Math.abs(extra.k-auto)>1)set('meal-cal',Math.max(0,extra.k));
    if(!_mealItems.length)setFoodTab('manual');
    autoCalcMeal();
  }
}
