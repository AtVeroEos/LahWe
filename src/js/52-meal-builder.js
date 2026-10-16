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
  if(!keepItems){_mealItems=[];window._loggedSavedMealId=null;window._mealTarget=target||null;window._mealEdit=null;window._comboEdit=null;window._swapIdx=null;}
  openMealSheet(ds||nutDay());
  // Only reach for the keyboard when there is nothing to tap yet.
  if(window._mealFoodTab==='all')setTimeout(()=>document.getElementById('food-search')?.focus(),200);
}
// One full-screen sheet for logging, editing and planning, in two steps. Pick: the whole screen is
// the food list, and what is in the meal so far is one bar at the bottom. Review: every item with its
// amount, what the meal comes to against the day, the meal and the date, then the button. A new
// meal starts on Pick; a meal being changed (logged, planned or saved) opens on Review.
function openMealSheet(date,step){
  const tg=window._mealTarget,ed=window._mealEdit,cm=window._comboEdit;
  window._mealTypePick=tg?(tg.type||likelyMealType()):ed?ed.type:likelyMealType();
  window._mealFoodTab=starEntries().length?'starred':(getRecentFoods().length||(S.recentSavedMeals||[]).length)?'recent':'all';
  window._mealDate=date;
  const ov=makeOv('meal-ov');
  ov.innerHTML=buildMealModalHTML(date);
  document.body.appendChild(ov);attachSwipeDown(ov);
  paintFoodTabs();renderFoodTab();
  const changing=!!(ed||(tg&&tg.replace)||(cm&&cm.id));
  mealStep(step||(changing&&(_mealItems.length||mealManual().has)?'review':'pick'));
}
function mealTitle(){
  const tg=window._mealTarget,ed=window._mealEdit,cm=window._comboEdit;
  return cm?(cm.id?'Edit saved meal':'New saved meal'):tg?(tg.replace?'Edit planned meal':`Plan ${PLAN_DAYS[tg.plan]}`):ed?'Edit meal':'Log meal';
}
function mealTypeChipsHTML(){
  const pick=window._mealTypePick;
  return MEAL_TYPES.concat(pick&&!MEAL_TYPES.includes(pick)?[pick]:[]).map(t=>`<button class="chip${t===pick?' on':''}" data-t="${esc(t)}" aria-pressed="${t===pick?'true':'false'}" onclick="pickMealType(${jsq(t)})">${esc(t)}</button>`).join('');
}
function pickMealType(t){
  window._mealTypePick=t;
  const el=document.getElementById('meal-types');if(el)el.innerHTML=mealTypeChipsHTML();
  paintMealSum();
  // Recent is ordered by what is eaten at this meal, so it follows the meal picked.
  if(window._mealFoodTab==='recent'&&!(document.getElementById('food-search')?.value||'').trim())renderFoodTab();
}
function buildMealModalHTML(date){
  const tg=window._mealTarget;const ed=window._mealEdit;const cm=window._comboEdit;
  const title=mealTitle();
  return`<div class="modal meal-sheet page step-pick"><div class="mh"></div>
    <section class="ms-pick">
      <div class="ms-head"><div class="mt">${esc(ed||(tg&&tg.replace)||(cm&&cm.id)?'Add food':title)}</div></div>
      <div class="ms-search">
        <input type="text" id="food-search" placeholder="Search, or type “steak 8 oz”" oninput="onFoodSearch()" onkeydown="foodSearchKey(event)" enterkeyhint="search" autocomplete="off" autocorrect="off">
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
      <div class="ms-tray" id="meal-tray"></div>
    </section>
    <section class="ms-review">
      <div class="ms-rhead">
        <button class="ms-back" onclick="mealStep('pick')" aria-label="Add more food">${ICON('chev',18).replace('<svg','<svg style="transform:rotate(180deg)"')}<span>Add food</span></button>
        ${tg||cm?'':`<input type="date" id="meal-date" value="${esc(date)}" max="${today()}" aria-label="Date" onchange="paintMealSum()">`}
      </div>
      <div class="ms-rbody" id="ms-rbody">
        <div class="mt ms-rtitle">${esc(title)}</div>
        ${cm?`<div class="ms-plan"><label for="combo-edit-name">Name</label>
          <input type="text" id="combo-edit-name" maxlength="60" value="${esc(cm.name||'')}" placeholder="e.g. Morning eggs"></div>`:''}
        ${tg?`<div class="ms-plan"><label for="plan-meal-name">Name</label>
          <input type="text" id="plan-meal-name" maxlength="60" value="${esc(tg.name||'')}" placeholder="Optional, e.g. Chicken bowl"></div>`:''}
        ${cm?'':`<div class="chips-x" id="meal-types">${mealTypeChipsHTML()}</div>`}
        <div id="meal-sum"></div>
        <div class="sec-h ms-ih"><span>In this meal</span><span id="meal-total"></span></div>
        <div id="meal-items-section"><div id="meal-items-list"></div></div>
        <button class="ms-addmore" onclick="mealStep('pick')">${ICON('plus',16)} Add food</button>
        <a class="ms-link" id="save-combo-btn" style="display:none" onclick="saveAsCombo()">Save these as a reusable meal</a>
      </div>
      <div class="ms-acts">
        ${cm&&cm.id?`<button class="btn btg ms-del" onclick="deleteSavedMealFromBuilder()">Delete</button>`:ed&&!tg?`<button class="btn btg ms-del" onclick="deleteMealFromBuilder()">Delete</button>`:''}
        <button class="btn btp" id="meal-save" onclick="saveMeal()">${cm?'Save meal':tg?(tg.replace?'Save changes':'Add to plan'):ed?'Save changes':'Log meal'}</button>
      </div>
    </section>
  </div>`;
}
// Which step is showing. Going back to Review from Pick ends a swap that was not finished.
function mealStepNow(){const m=document.querySelector('#meal-ov .meal-sheet');return m&&m.classList.contains('step-review')?'review':'pick';}
function mealStep(s){
  const m=document.querySelector('#meal-ov .meal-sheet');
  window._mealStepNow=s==='review'?'review':'pick';
  if(!m)return;
  if(s==='review'&&window._swapIdx!=null)window._swapIdx=null;
  m.classList.toggle('step-pick',s!=='review');m.classList.toggle('step-review',s==='review');
  updateMealItems();
  if(s==='review'){const b=document.getElementById('ms-rbody');if(b)b.scrollTop=0;}
  else onFoodSearch();
}
// The bar at the bottom of Pick: how many things are in the meal, what they come to, and the way on.
function mealTrayHTML(){
  const t=mealTotalsNow();const n=_mealItems.length+(t.manual.has?1:0);
  if(!n)return'';
  const names=_mealItems.map(it=>it.name).concat(t.manual.has?['By hand']:[]);
  const shown=names.slice(0,2).join(', ')+(names.length>2?` +${names.length-2}`:'');
  return`<button class="ms-tray-b" id="meal-tray-b" onclick="mealStep('review')" aria-label="Review the meal: ${n} item${n===1?'':'s'}, ${t.cals} kcal">
    <span class="ms-tray-n">${n}</span><span class="ms-tray-t"><b>${esc(shown)}</b><span>${t.cals.toLocaleString()} kcal · ${macroLine(t)}</span></span>
    <span class="ms-tray-go">Review${ICON('chev',16)}</span></button>`;
}
// What the meal comes to, and what that leaves: of the day's targets when logging, of the planned
// day when planning. A meal being changed is counted once, not twice.
function paintMealSum(){
  const el=document.getElementById('meal-sum');if(!el)return;
  const t=mealTotalsNow();const tg=window._mealTarget,ed=window._mealEdit,cm=window._comboEdit;
  let line='';
  if(tg){
    const day=(S.mealPlan.days[tg.plan]||[]).filter(m=>m.id!==tg.replace);
    const k=planDayTotals(day).cals+t.cals,p=planDayTotals(day).protein+t.protein;const g=planDayTarget(tg.plan);
    line=`${PLAN_DAYS[tg.plan]} comes to <b>${Math.round(k).toLocaleString()}</b> of ${g.cals.toLocaleString()} kcal${g.protein?` and ${Math.round(p)} of ${Math.round(g.protein)} g protein`:''} with this meal.`;
  }else if(!cm){
    const ds=document.getElementById('meal-date')?.value||window._mealDate||today();
    const g=goalsFor(ds)||{cals:0,protein:0};const day=getDayTotals(ds);
    const before=ed?(S.meals||[]).find(m=>m.id===ed.id):null;const was=k=>before&&before.date===ds?(parseFloat(before[k])||0):0;
    const k=Math.round((g.cals||0)-(day.cals-was('cals'))-t.cals),p=r1((g.protein||0)-(day.protein-was('protein'))-t.protein);
    const when=ds===today()?'today':fmtDay(ds);
    line=k>=0?`After this, <b>${k.toLocaleString()} kcal</b> and ${p>0?fmt1(p)+' g protein':'no protein'} left ${when==='today'?'for today':'on '+when}.`
      :`This takes ${when==='today'?'today':when} <b>${(-k).toLocaleString()} kcal over</b> target${p>0?`, with ${fmt1(p)} g protein still to go`:''}.`;
  }
  el.innerHTML=`<div class="st-grid st-4 ms-tiles">${macroTilesHTML(t)}</div>${line?`<div class="ms-fit">${line}</div>`:''}`;
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
  window._mealAmt=null;
  if(query){
    // "steak 8 oz": the amount comes out of the search and is applied to whatever is tapped.
    // A bare count is only read as one when the words as typed find nothing ("7 grain bread").
    let pq=splitFoodQuery(query);
    if(pq.amt&&(!pq.text||(pq.amt.unit==='serv'&&searchFoods(query).length)))pq={text:query,amt:null};
    window._mealAmt=pq.amt;query=pq.text;
    foods=searchFoods(query);
    const lc=query.toLowerCase();
    savedMealMatches=(S.savedMeals||[]).filter(c=>String(c.name||'').toLowerCase().includes(lc));
  }else if(tab==='starred'){
    const st=starEntries();
    el.innerHTML=swapNoteHTML()+(st.length?st.map(starRowHTML).join('')
      :`<div class="ms-empty">Nothing starred yet.<br>Tap ★ on a food or a saved meal to keep it here, at the amount you eat.</div>`);
    return;
  }else if(tab==='recent'){
    // Saved meals, then foods, each ordered by how often it is eaten at the meal picked above.
    const picks=recentPicks(window._mealTypePick||likelyMealType());
    const html=picks.filter(x=>x.kind==='meal').map(x=>savedMealRow(x.item)).join('')+picks.filter(x=>x.kind==='food').map(x=>renderFoodRow(x.item)).join('');
    el.innerHTML=swapNoteHTML()+(html||`<div class="ms-empty">Nothing recent.<br>Foods you log appear here.</div>`);return;
  }else if(tab==='all'){
    // Your own foods (scanned or made) first, newest on top, then the built-in list.
    const mine=(S.customFoods||[]).slice().reverse();const ids=new Set(mine.map(f=>f.id));
    const rest=allFoods().filter(f=>!ids.has(f.id));
    el.innerHTML=swapNoteHTML()+newFoodRowHTML('')+(mine.length?`<div class="ms-sec">Your foods</div>${mine.map(renderFoodRow).join('')}<div class="ms-sec">All foods</div>`:'')+rest.map(renderFoodRow).join('');
    return;
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
  if(window._mealAmt&&foods.length)html+=`<div class="amt-note">${ICON('check',13)} ${esc(amtNoteText(window._mealAmt))} — tap a food, or press Return for the first one</div>`;
  html+=foods.map(f=>renderFoodRow(f)).join('');
  // Not in the list? Make it: a search offers it under the results.
  if(query)html+=newFoodRowHTML(query);
  el.innerHTML=swapNoteHTML()+html;
}
// A starred row: tap adds the food at the starred amount (or the saved meal); ★ takes off this one star.
function starRowHTML(e){
  const st=e.star;
  const inMeal=e.kind==='food'&&_mealItems.some(it=>foodBaseId(it.foodId)===foodBaseId(e.food.id));
  return`<div class="hi${inMeal?' hi-in':''}" style="cursor:pointer" onclick="addStarToMeal(${jsq(st.id)})">
    <button class="ib ib-q star on" onclick="event.stopPropagation();removeStar(${jsq(st.id)})" aria-label="Unstar ${esc(e.name)}">★</button>
    <div style="flex:1;min-width:0">
      <div class="hi-t">${esc(e.name)}${e.kind==='meal'?'<span class="pill">Saved meal</span>':''}${inMeal?'<span class="pill pill-acc">In meal</span>':''}</div>
      <div class="hi-s">${esc(e.amt)} · P ${fmt1(e.m.protein)} · C ${fmt1(e.m.carbs)} · F ${fmt1(e.m.fat)}</div>
    </div>
    <div class="hi-k">${e.m.cals}<span> kcal</span></div>
  </div>`;
}
function newFoodRowHTML(q){
  return`<button class="row row-tap new-food" onclick="showFoodEditor({preset:{name:${jsq(q)}}})"><span class="row-ic tone-info">${ICON('plus',16)}</span><span class="row-main"><span class="row-t">${q?`Create “${esc(q)}”`:'New food'}</span><span class="row-s">Add your own food with its label numbers</span></span></button>`;
}
// A saved meal: tap adds it to the meal; ★ stars it; the pencil opens it to change (not while one
// is already being changed).
function savedMealRow(c){
  const on=isMealStarred(c.id);
  return`<div class="hi" style="cursor:pointer" onclick="addComboToMeal(${jsq(c.id)})">
    <button class="ib ib-q star${on?' on':''}" onclick="event.stopPropagation();toggleMealStar(${jsq(c.id)});onFoodSearch()" aria-label="${on?'Unstar':'Star'} ${esc(c.name)}">★</button>
    <div style="flex:1;min-width:0">
      <div class="hi-t">${esc(c.name)}<span class="pill">Saved meal</span></div>
      <div class="hi-s">${esc(c.items.map(it=>it.name).join(', '))}</div>
    </div>
    <div class="hi-k">${savedMealCals(c)}<span> kcal</span></div>
    ${window._comboEdit?'':`<button class="ib ib-q" style="flex-shrink:0;margin-left:4px" onclick="event.stopPropagation();editSavedMeal(${jsq(c.id)})" aria-label="Edit ${esc(c.name)}">${ICON('pencil',15)}</button>`}
  </div>`;
}
function amtNoteText(a){return a.unit==='serv'?`${fmtAmt(a.val)} serving${a.val===1?'':'s'}`:`${fmtAmt(a.val)} ${a.unit}`;}
// How many servings a typed amount is of this food; 0 when it is a weight and the food has none.
function typedQty(f,a){
  if(!a)return 1;
  if(a.unit==='serv')return a.val;
  const sg=servingGrams(f);return sg>0?amtToQty(a.val,a.unit,sg):0;
}
// A row shows the food the way a tap will add it: the kind last used, and the typed amount if there is one.
function renderFoodRow(f){
  const g=findFood(preferredFoodId(f.id))||f;
  const inMeal=_mealItems.some(it=>foodBaseId(it.foodId)===foodBaseId(f.id));
  const a=window._mealAmt;const q=typedQty(g,a);const k=a&&q>0?q:1;
  const note=foodKindNote(g);
  const amtTxt=a&&q>0?(a.unit==='serv'?`${fmtAmt(a.val)} × ${g.serving||'serving'}`:`${fmtAmt(a.val)} ${a.unit}`):(g.serving||'1 serving');
  return`<div class="hi${inMeal?' hi-in':''}" style="cursor:pointer" onclick="addFoodToMeal(${jsq(f.id)})">
    <button class="ib ib-q star${isStarred(f.id)?' on':''}" onclick="event.stopPropagation();toggleStar(${jsq(f.id)});onFoodSearch()" aria-label="${isStarred(f.id)?'Unstar':'Star'} ${esc(f.name)}">★</button>
    <div style="flex:1;min-width:0">
      <div class="hi-t">${esc(g.name)}${f.generic&&f.kind?'<span class="pill">any kind</span>':''}${inMeal?'<span class="pill pill-acc">In meal</span>':''}</div>
      <div class="hi-s">${esc(amtTxt)}${a&&!q?' (logged by the serving)':''} · P ${fmt1(g.protein*k)} · C ${fmt1(g.carbs*k)} · F ${fmt1(g.fat*k)}${note?' · '+esc(note):''}</div>
    </div>
    <div class="hi-k">${Math.round((g.cals||0)*k)}<span> kcal</span></div>
    ${isCustomFood(f.id)?`<button class="ib ib-q" style="flex-shrink:0;margin-left:4px" onclick="event.stopPropagation();showFoodEditor({id:${jsq(f.id)}})" aria-label="Edit ${esc(f.name)}">${ICON('pencil',15)}</button>`:''}
  </div>`;
}
// Return in the search box, with an amount typed: add the first food found.
function foodSearchKey(e){
  if(e.key!=='Enter')return;e.preventDefault();
  if(!window._mealAmt)return;
  const q=splitFoodQuery(document.getElementById('food-search')?.value||'');
  const first=searchFoods(q.text)[0];if(first)addFoodToMeal(first.id);
}
// Saved meals, as many as you like: starred first, then the ones logged most. A new one can be made
// here from scratch (not while one is being changed).
function renderComboList(el){
  const combos=savedMealsByUse();
  const add=window._comboEdit?'':`<button class="row row-tap new-food" onclick="editSavedMeal(null)"><span class="row-ic tone-info">${ICON('plus',16)}</span><span class="row-main"><span class="row-t">New saved meal</span><span class="row-s">Foods you eat together, logged in one tap</span></span></button>`;
  el.innerHTML=swapNoteHTML()+add+(combos.length?combos.map(savedMealRow).join('')
    :`<div class="ms-empty">No saved meals yet.<br>Make one here, or put two or more foods in a meal and tap “Save these as a reusable meal”.</div>`);
}
// amt: an amount to add it at ({unit,val}, a star's) instead of anything typed. exact: the id is the
// kind wanted, not "the kind last used".
function addFoodToMeal(foodId,amt,exact){
  const f=findFood(exact?foodId:preferredFoodId(foodId));if(!f)return;
  if(window._swapIdx!=null&&_mealItems[window._swapIdx]){
    const it=foodItem(f,1);
    if(amt){const q=typedQty(f,amt);if(q>0){it.qty=q;if(amt.unit!=='serv'&&it.sg>0)it.unit=amt.unit;else delete it.unit;}}
    const box=document.getElementById('food-search');
    const i=window._swapIdx;
    if(amt){window._swapIdx=null;_mealItems[i]=it;toast(`${f.name} swapped in`,'green');}else takeSwap(it,f);
    if(box)box.value='';
    mealStep('review');showMealItem(i);return;
  }
  const a=amt||window._mealAmt;const tq=typedQty(f,a);
  // Tapping a food already in the meal adds another serving (or the amount typed), but only to an
  // item that IS that food by the serving (a scanned "150g" entry of the same product stays its own line).
  const existing=_mealItems.find(it=>it.foodId===f.id&&it.serving===f.serving);
  if(existing)existing.qty=Math.round(((parseFloat(existing.qty)||0)+(a&&tq>0?tq:1))*10000)/10000;
  else{
    const it=foodItem(f,1);
    if(a&&tq>0){it.qty=tq;if(a.unit!=='serv'&&it.sg>0)it.unit=a.unit;}
    _mealItems.push(it);
  }
  if(a&&!tq)toast(`${f.name} has no weight on file, so it went in as one serving`,'',{ms:3200});
  // The typed line has done its job: clear it, so the next one starts clean.
  if(a&&!amt){const box=document.getElementById('food-search');if(box)box.value='';}
  showMealItem(existing?_mealItems.indexOf(existing):_mealItems.length-1);onFoodSearch();
}
// Switch the open item to another kind of the same food. A weight stays that weight; a count of
// servings stays that count.
function mealItemKind(idx,id){
  const it=_mealItems[idx],f=findFood(id);if(!it||!f)return;
  const u=amtUnit(it.unit,it.sg);const grams=u!=='serv'?(parseFloat(it.qty)||0)*parseFloat(it.sg):0;
  const n=foodItem(f,parseFloat(it.qty)||1);
  if(grams>0&&n.sg>0){n.qty=Math.round(grams/n.sg*10000)/10000;n.unit=u;}else delete n.unit;
  _mealItems[idx]=n;rememberFoodKind(f.id);save();
  showMealItem(idx);onFoodSearch();
}
// One teaspoon of oil or butter as its own line, a second tap makes it two.
function mealAddFat(id){
  const f=findFood(id);if(!f)return;
  const ex=_mealItems.find(it=>it.foodId===f.id);
  if(ex)ex.qty=Math.round(((parseFloat(ex.qty)||0)+1)*100)/100;else _mealItems.push(foodItem(f,1));
  updateMealItems();onFoodSearch();
  toast(`${f.name}: ${fmtAmt((ex||_mealItems[_mealItems.length-1]).qty)} tsp in this meal`,'green');
}
function addComboToMeal(comboId){
  const combo=(S.savedMeals||[]).find(c=>c.id===comboId);if(!combo)return;
  window._swapIdx=null; // a saved meal is added whole, never swapped in for one item
  if(!window._comboEdit)window._loggedSavedMealId=comboId;
  combo.items.forEach(it=>{
    const existing=_mealItems.find(x=>x.foodId&&x.foodId===it.foodId&&x.serving===it.serving);
    if(existing){existing.qty=Math.round(((parseFloat(existing.qty)||0)+(parseFloat(it.qty)||1))*10000)/10000;}
    else{_mealItems.push({...it});}
  });
  showMealItem(_mealItems.length-1);onFoodSearch();
}
function deleteCombo(id){
  const idx=(S.savedMeals||[]).findIndex(c=>c.id===id);if(idx<0)return;
  const gone=S.savedMeals.splice(idx,1)[0];
  const recentAt=(S.recentSavedMeals||[]).indexOf(id);const stars=(S.stars||[]).filter(s=>s.k==='meal'&&s.ref===id);
  S.recentSavedMeals=(S.recentSavedMeals||[]).filter(x=>x!==id);S.stars=(S.stars||[]).filter(s=>!stars.includes(s));
  save();foodListChanged();
  toast(gone.name+' deleted','',{action:'Undo',onAction:()=>{
    S.savedMeals.splice(Math.min(idx,S.savedMeals.length),0,gone);S.stars.push(...stars);
    if(recentAt>=0)S.recentSavedMeals.splice(Math.min(recentAt,S.recentSavedMeals.length),0,id);
    save();foodListChanged();}});
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
  if(window._swapIdx!=null){if(window._swapIdx===idx)window._swapIdx=null;else if(window._swapIdx>idx)window._swapIdx--;}
  const gone=_mealItems.splice(idx,1)[0];if(!_mealItems.length)window._loggedSavedMealId=null;
  updateMealItems();onFoodSearch();
  if(gone)toast(gone.name+' removed','',{action:'Undo',onAction:()=>{_mealItems.splice(Math.min(idx,_mealItems.length),0,gone);updateMealItems();onFoodSearch();}});
}
// After something is added or changed: on Review the item is brought into view; on Pick the bar at
// the bottom takes the change and gives a small nudge, so a tap visibly did something.
function showMealItem(idx){
  updateMealItems();
  if(mealStepNow()==='review'){const row=document.getElementById('mi-'+idx);if(row&&row.scrollIntoView)row.scrollIntoView({block:'nearest'});}
  else{const b=document.getElementById('meal-tray-b');if(b){b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump');}}
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
  const el=document.getElementById('meal-total');
  const t=mealTotalsNow();const n=_mealItems.length+(t.manual.has?1:0);
  if(el)el.textContent=n?`${n} item${n===1?'':'s'}`:'';
  const tray=document.getElementById('meal-tray');if(tray)tray.innerHTML=mealTrayHTML();
  paintMealSum();
}
// Every item shows its amount and its controls: Review is where a meal is looked over, so nothing
// is folded away.
function mealItemRowHTML(it,i){
  const t=mealItemTotals(it);const u=amtUnit(it.unit,it.sg);const canWeigh=parseFloat(it.sg)>0;
  const opt=(v,l)=>`<option value="${v}"${u===v?' selected':''}>${l}</option>`;
  return`<div class="mi${window._swapIdx===i?' mi-swap':''}" id="mi-${i}">
    <div class="mi-top"><span class="mi-nm"><b>${esc(it.name)}</b><small id="mi-m-${i}">${macroLine(t)}</small></span><span id="mi-k-${i}">${t.cals} kcal</span><button class="ib ib-q" onclick="removeMealItem(${i})" aria-label="Remove ${esc(it.name)}">${ICON('x',14)}</button></div>
    <div class="mi-ctl">
      <button class="ib" onclick="adjMealItem(${i},-0.5)" aria-label="Less">−</button>
      <input type="number" inputmode="decimal" id="mi-q-${i}" value="${fmtAmt(qtyToAmt(it.qty,u,it.sg))}" min="0" step="any" oninput="mealItemInput(${i})" onchange="mealItemBlur(${i})" aria-label="Amount of ${esc(it.name)}">
      <button class="ib" onclick="adjMealItem(${i},0.5)" aria-label="More">+</button>
      ${canWeigh?`<select id="mi-u-${i}" onchange="mealItemUnit(${i},this.value)" aria-label="Unit for ${esc(it.name)}">${opt('serv','× '+esc(it.serving||'serving'))}${opt('g','grams')}${opt('oz','ounces')}</select>`
        :`<span class="mi-x">× ${esc(it.serving||'serving')}</span>`}
    </div>${mealItemKindHTML(it,i)}${mealItemActsHTML(it,i)}</div>`;
}
// Under the open item: put another food in its place, or correct the food's own numbers (your own
// foods only: the built-in list is not edited from here).
function mealItemActsHTML(it,i){
  if(window._swapIdx===i)return''; // the list above says what is being swapped, with its own Cancel
  const fix=it.foodId&&isCustomFood(it.foodId);
  return`<div class="mi-acts"><a onclick="swapMealItem(${i})">Swap for another food</a>${fix?`<a onclick="showFoodEditor({id:${jsq(it.foodId)}})">Fix this food’s numbers</a>`:''}</div>`;
}
// Under the open item: which kind it is, how it was weighed, and what it was cooked in.
function mealItemKindHTML(it,i){
  if(!it.foodId)return'';
  const f=findFood(it.foodId);if(!f||f.serving!==it.serving)return''; // an edited or scanned line keeps its own numbers
  const t=foodTraits(it.foodId);
  const segs=foodKindSegsHTML(it.foodId,`mealItemKind.bind(null,${i})`);
  const note=foodKindNote(f);
  const noteTxt=note?note[0].toUpperCase()+note.slice(1)+(t.state&&t.state.alt==='cooked'?', '+(foodMods(it.foodId).alt?'weighed cooked':'weighed raw'):''):(t.state&&t.state.alt==='cooked'?(foodMods(it.foodId).alt?'Weighed cooked':'Weighed raw'):'');
  const fat=t.fat?COOK_FATS.map(c=>`<button class="chip" onclick="mealAddFat(${jsq(c.id)})" aria-label="Add a teaspoon of ${c.id==='g_cook_oil'?'cooking oil':'butter'}">+ ${c.id==='g_cook_oil'?'Oil':'Butter'}</button>`).join(''):'';
  if(!segs&&!fat)return'';
  return`<div class="mi-kind">${segs}${noteTxt||fat?`<div class="mi-fat"><span class="mi-note">${esc(noteTxt)}</span>${fat}</div>`:''}</div>`;
}
function updateMealItems(){
  const list=document.getElementById('meal-items-list');
  const comboBtn=document.getElementById('save-combo-btn');
  const m=mealManual();const empty=!_mealItems.length&&!m.has;
  if(list)list.innerHTML=empty?`<div class="ms-empty">Nothing in this meal yet.</div>`
    :_mealItems.map(mealItemRowHTML).join('')+(m.has?`<div class="mi mi-hand" onclick="mealStep('pick');setFoodTab('manual')" role="button">
    <div class="mi-top"><span class="mi-nm"><b>Entered by hand</b><small>${macroLine(m)}</small></span><span>${Math.round(m.cals)} kcal</span>
      <button class="ib ib-q" onclick="event.stopPropagation();clearMealManual()" aria-label="Remove the numbers entered by hand">${ICON('x',14)}</button></div></div>`:'');
  if(comboBtn)comboBtn.style.display=_mealItems.length>=2&&!window._comboEdit?'':'none'; // editing a saved meal is already saving one
  const save=document.getElementById('meal-save');if(save)save.style.display=empty?'none':''; // nothing to save: no button that cannot work
  paintMealTotal();
}
function saveMeal(){
  if(window._comboEdit)return saveSavedMealFromBuilder();
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
    let savedMealName=before?(before.savedMealName||null):null,savedMealId=before?(before.savedMealId||null):null;
    if(window._loggedSavedMealId){
      const sm=(S.savedMeals||[]).find(c=>c.id===window._loggedSavedMealId);
      if(sm){savedMealName=sm.name;savedMealId=sm.id;}
      trackRecentMeal(window._loggedSavedMealId);window._loggedSavedMealId=null;
    }
    const m={id:uid(),date,type:mealType,name:mealType,savedMealName,items,protein:r1(tp),carbs:r1(tc),fat:r1(tf),cals:Math.round(tk)};
    if(savedMealId)m.savedMealId=savedMealId;
    put(m);
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
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  setTimeout(()=>document.getElementById('combo-name')?.focus(),150);
}
function doSaveCombo(){
  const name=document.getElementById('combo-name')?.value?.trim();
  if(!name){toast('Enter a name');return;}
  if(!S.savedMeals)S.savedMeals=[];
  const man=mealManual(); // numbers typed on the By hand tab are part of the meal on screen, so they are saved with it
  S.savedMeals.push({id:uid(),name,items:savedMealItems(_mealItems,man)});
  save();closeOv('combo-ov');toast('Meal saved!','green');
}
function deleteMeal(id){
  const idx=(S.meals||[]).findIndex(m=>m.id===id);if(idx<0)return;
  const gone=S.meals.splice(idx,1)[0];
  save();mealsChanged();
  toast('Meal removed','',{action:'Undo',onAction:()=>{S.meals.splice(Math.min(idx,S.meals.length),0,gone);save();mealsChanged();}});
}
// Delete sits in the meal's own sheet, not on its row.
function deleteMealFromBuilder(){
  const ed=window._mealEdit;if(!ed)return;
  window._mealEdit=null;_mealItems=[];closeOv('meal-ov');deleteMeal(ed.id);
}

// Open a logged meal in the builder. Logged items hold totals for the amount eaten; the builder
// works per serving, so each is divided back by its quantity. Numbers that were typed in rather
// than picked from foods go back onto the By hand tab.
function editMeal(id){
  const m=(S.meals||[]).find(x=>x.id===id);if(!m)return;
  window._loggedSavedMealId=null;window._mealTarget=null;window._comboEdit=null;window._swapIdx=null;
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
  mealStep('review');
}
