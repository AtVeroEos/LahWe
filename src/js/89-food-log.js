// ═══════════════════════════════════════════════════
// FOOD LOG — stars that remember an amount, recents ranked by meal, correcting a food everywhere it
// was used, swapping an item in a meal, barcodes linked to your own foods, editing saved meals
// ═══════════════════════════════════════════════════

// ─── Stars ───
// S.stars: [{id, k:'food'|'meal', ref, unit:'serv'|'g'|'oz', val}]. A food star keeps the amount it
// was starred at, so a tap opens quick log already at that amount (still adjustable). The same
// food can be starred at more than one amount (chicken 6 oz at lunch, 10 oz at dinner). A saved
// meal is starred whole.
const STARS_MAX=60;
function normalizeStars(v){
  const out=[];const seen=new Set();
  (Array.isArray(v)?v:[]).forEach(x=>{
    if(!isObj(x))return;
    const k=x.k==='meal'?'meal':'food';
    const ref=String(x.ref==null?'':x.ref).replace(/[\u0000-\u001f]/g,'').slice(0,80);if(!ref)return;
    let unit=['serv','g','oz'].includes(x.unit)?x.unit:'serv';let val=parseFloat(x.val);
    if(k==='meal'){unit='serv';val=1;}
    if(!(val>0&&isFinite(val)))val=1;
    val=Math.round(Math.min(val,unit==='g'?20000:unit==='oz'?700:200)*100)/100;
    const key=k+'|'+ref+'|'+unit+'|'+val;if(seen.has(key))return;seen.add(key);
    out.push({id:typeof x.id==='string'&&/^[\w-]{1,40}$/.test(x.id)?x.id:uid(),k,ref,unit,val});
  });
  return out.slice(-STARS_MAX);
}
// The amount a food was last logged at: newest day first, and the exact kind ahead of another kind
// of the same food. One serving when it has never been logged.
function lastLoggedAmount(foodId,meals){
  meals=meals||S.meals||[];const base=foodBaseId(foodId);let best=null,bestDate='',exact=false;
  meals.forEach(m=>{if(!isObj(m))return;(Array.isArray(m.items)?m.items:[]).forEach(it=>{
    if(!isObj(it)||!it.foodId)return;const ex=it.foodId===foodId;if(!ex&&foodBaseId(it.foodId)!==base)return;
    const d=String(m.date||'');
    if(d>bestDate||(d===bestDate&&ex&&!exact)){best=it;bestDate=d;exact=ex;}
  });});
  if(!best)return{unit:'serv',val:1};
  const u=amtUnit(best.unit,best.sg);const q=parseFloat(best.qty)||1;
  return u==='serv'?{unit:'serv',val:Math.round(q*100)/100}:{unit:u,val:qtyToAmt(q,u,best.sg)};
}
// Saves from before v3.19 kept a plain list of starred food ids. Each becomes a star at the amount
// that food was last logged at.
function migrateStars(s){
  const old=Array.isArray(s.starredFoods)?s.starredFoods.filter(x=>typeof x==='string'&&x):[];
  if(old.length&&!(Array.isArray(s.stars)&&s.stars.length))
    s.stars=old.map(id=>Object.assign({id:uid(),k:'food',ref:id},lastLoggedAmount(id,s.meals)));
  delete s.starredFoods;
  s.stars=normalizeStars(s.stars);
}
function foodStars(id){const b=foodBaseId(id);return(S.stars||[]).filter(s=>s.k==='food'&&foodBaseId(s.ref)===b);}
function isStarred(id){return foodStars(id).length>0;}
function isMealStarred(id){return(S.stars||[]).some(s=>s.k==='meal'&&s.ref===id);}
// Each starred food once (for "what fits" and the coach), whatever amounts it is starred at.
function getStarredFoods(){
  const seen=new Set();
  return(S.stars||[]).filter(s=>s.k==='food').map(s=>findFood(s.ref)).filter(f=>f&&!seen.has(foodBaseId(f.id))&&seen.add(foodBaseId(f.id)));
}
function savedMealTotals(c){
  const t={protein:0,carbs:0,fat:0,cals:0};
  ((c&&c.items)||[]).forEach(it=>{const x=mealItemTotals(it);t.protein+=x.protein;t.carbs+=x.carbs;t.fat+=x.fat;t.cals+=x.cals;});
  return{protein:r1(t.protein),carbs:r1(t.carbs),fat:r1(t.fat),cals:Math.round(t.cals)};
}
// A star with what it points at and what it comes to, or null when that is gone.
function starEntry(st){
  if(!st)return null;
  if(st.k==='meal'){
    const c=(S.savedMeals||[]).find(x=>x.id===st.ref);if(!c)return null;
    return{star:st,kind:'meal',meal:c,name:c.name,amt:`${c.items.length} item${c.items.length===1?'':'s'}`,m:savedMealTotals(c)};
  }
  const f=findFood(st.ref);if(!f)return null;
  const sg=servingGrams(f);const u=amtUnit(st.unit,sg);
  const q=u==='serv'?(st.unit==='serv'?st.val:1):amtToQty(st.val,u,sg);
  const k=v=>(parseFloat(v)||0)*q;
  return{star:st,kind:'food',food:f,name:f.name,unit:u,val:u==='serv'?q:st.val,qty:q,
    amt:u==='serv'?(q===1?String(f.serving||'1 serving'):`${fmtAmt(q)} × ${f.serving||'serving'}`):`${fmtAmt(st.val)} ${u}`,
    m:{protein:r1(k(f.protein)),carbs:r1(k(f.carbs)),fat:r1(k(f.fat)),cals:Math.round(k(f.cals))}};
}
function starEntries(){return(S.stars||[]).map(starEntry).filter(Boolean);}
function addStar(st){
  if(!Array.isArray(S.stars))S.stars=[];
  S.stars.push(Object.assign({id:uid()},st));S.stars=normalizeStars(S.stars);save();
}
function restoreStars(list){if(!Array.isArray(S.stars))S.stars=[];S.stars.push(...list);S.stars=normalizeStars(S.stars);save();foodListChanged();}
// ★ on a food row. On: one star at the amount typed in the search, or else the amount last logged.
// Off: every star of that food goes (with Undo); single amounts are taken off on the Starred tab or
// in the food's own sheet.
function toggleStar(id){
  const had=foodStars(id);
  if(had.length){
    S.stars=S.stars.filter(s=>!had.includes(s));save();
    const f=findFood(id);
    toast(`${f?f.name:'Food'} unstarred`,'',{action:'Undo',onAction:()=>restoreStars(had)});
    return;
  }
  const ref=preferredFoodId(id);const f=findFood(ref);if(!f)return;
  const a=window._mealAmt;const tq=a?typedQty(f,a):0;
  const amt=a&&tq>0?{unit:a.unit,val:a.val}:lastLoggedAmount(ref);
  addStar(Object.assign({k:'food',ref},amt));
  const e=starEntry(S.stars[S.stars.length-1]);
  toast(`Starred: ${f.name}${e?', '+e.amt:''}`,'green');
}
function toggleMealStar(id){
  const c=(S.savedMeals||[]).find(x=>x.id===id);if(!c)return;
  const had=(S.stars||[]).filter(s=>s.k==='meal'&&s.ref===id);
  if(had.length){S.stars=S.stars.filter(s=>!had.includes(s));save();toast(c.name+' unstarred','',{action:'Undo',onAction:()=>restoreStars(had)});}
  else{addStar({k:'meal',ref:id});toast('Starred: '+c.name,'green');}
}
function removeStar(id){
  const st=(S.stars||[]).find(s=>s.id===id);if(!st)return;
  S.stars=S.stars.filter(s=>s!==st);save();foodListChanged();
  const e=starEntry(st);
  toast(`${e?e.name:'Star'} unstarred`,'',{action:'Undo',onAction:()=>restoreStars([st])});
}
// A tap on a starred tile: the food's sheet opened at the starred amount, or the saved meal's.
function logStar(id){
  const st=(S.stars||[]).find(s=>s.id===id);if(!st)return;
  if(st.k==='meal')return quickLogCombo(st.ref);
  quickLogFood(st.ref,0,null,{unit:st.unit,val:st.val});
}
// In the meal builder: the star's food at the star's amount.
function addStarToMeal(id){
  const st=(S.stars||[]).find(s=>s.id===id);if(!st)return;
  if(st.k==='meal')return addComboToMeal(st.ref);
  addFoodToMeal(st.ref,{unit:st.unit,val:st.val},true);
}
// The ★ in a food's own sheet (quick log, or a scanned product) stars the amount on screen. It is
// lit only when that exact amount is starred, so a second amount can be starred as well.
function amtStarState(pre,foodId){
  const st=amtCtlSync(pre);if(!st||!foodId)return null;
  const cur={unit:st.unit,val:Math.round(st.val*100)/100};
  const hit=(S.stars||[]).find(s=>s.k==='food'&&s.ref===foodId&&s.unit===cur.unit&&Math.abs(s.val-cur.val)<0.01);
  return{on:!!hit,hit,cur};
}
function starBtnHTML(id,on,js){
  return`<button class="star-btn${on?' on':''}" id="${id}" onclick="${js}" aria-pressed="${on?'true':'false'}" aria-label="${on?'Unstar':'Star'}">★</button>`;
}
function paintStarBtn(id,on){
  const b=document.getElementById(id);if(!b)return;
  b.classList.toggle('on',!!on);b.setAttribute('aria-pressed',on?'true':'false');b.setAttribute('aria-label',on?'Unstar':'Star');
}
function sheetFoodId(pre){
  if(pre==='scan'){const b=cleanBarcode(window._scanBarcode);return b?'cf_'+b:'';}
  const q=window._pendingQuickLog;return q&&q.type==='food'?q.food.id:'';
}
function paintAmtStar(pre){const s=amtStarState(pre,sheetFoodId(pre));if(s)paintStarBtn(pre+'-star',s.on);}
function toggleAmtStar(pre){
  const q=window._pendingQuickLog;
  if(pre==='ql'&&q&&q.type==='combo'){toggleMealStar(q.combo.id);paintStarBtn('ql-star',isMealStarred(q.combo.id));foodListChanged();return;}
  const id=sheetFoodId(pre);const s=amtStarState(pre,id);if(!s)return;
  if(s.on){S.stars=S.stars.filter(x=>x!==s.hit);save();toast('Unstarred','',{action:'Undo',onAction:()=>{restoreStars([s.hit]);paintAmtStar(pre);}});}
  else{
    if(pre==='scan'&&!scanFood())return; // a scanned product becomes one of your foods so it can be starred
    addStar({k:'food',ref:id,unit:s.cur.unit,val:s.cur.val});
    const e=starEntry(S.stars[S.stars.length-1]);toast('Starred'+(e?' at '+e.amt:''),'green');
  }
  paintAmtStar(pre);foodListChanged();
}

// ─── Recents, by meal ───
// The recent lists are kept short, and ordered by how often each thing is eaten at the meal being
// logged (over the last 60 days), most recent first among equals. Lunch shows what you have for
// lunch, not what you had for breakfast an hour ago.
const RECENT_TILES=8,RECENT_TAB_FOODS=15,RECENT_TAB_MEALS=5,RECENT_DAYS=60;
function slotUsage(){
  return memo('slotUsage',()=>{
    const floor=daysAgoStr(RECENT_DAYS);const u={food:{},meal:{}};
    const bump=(map,key,type,date)=>{const e=map[key]||(map[key]={n:{},all:0,last:''});e.n[type]=(e.n[type]||0)+1;e.all++;if(date>e.last)e.last=date;};
    (S.meals||[]).forEach(m=>{
      if(!isObj(m)||!(m.date>=floor))return;const type=m.type||m.name||'Snack';
      if(m.savedMealId)bump(u.meal,m.savedMealId,type,m.date);else if(m.savedMealName)bump(u.meal,'n:'+m.savedMealName,type,m.date);
      (m.items||[]).forEach(it=>{if(isObj(it)&&it.foodId)bump(u.food,it.foodId,type,m.date);});
    });
    return u;
  });
}
function mealUse(c){const u=slotUsage().meal;return u[c.id]||u['n:'+c.name]||null;}
// [{kind:'food'|'meal', id, item, n, last, i}], best first.
function recentPicks(type,opts){
  opts=opts||{};const u=slotUsage();const out=[];
  if(opts.foods!==0)(S.recentFoods||[]).forEach((id,i)=>{
    const f=findFood(id);if(!f||(opts.skipStarred&&isStarred(f.id)))return;
    const e=u.food[f.id];out.push({kind:'food',id:f.id,item:f,n:e?(e.n[type]||0):0,last:e?e.last:'',i});
  });
  if(opts.meals!==0)(S.recentSavedMeals||[]).forEach((id,i)=>{
    const c=(S.savedMeals||[]).find(x=>x.id===id);if(!c||(opts.skipStarred&&isMealStarred(c.id)))return;
    const e=mealUse(c);out.push({kind:'meal',id:c.id,item:c,n:e?(e.n[type]||0):0,last:e?e.last:'',i});
  });
  out.sort((a,b)=>(b.n-a.n)||(a.last<b.last?1:a.last>b.last?-1:0)||(a.kind===b.kind?a.i-b.i:a.kind==='meal'?-1:1));
  const foods=out.filter(x=>x.kind==='food').slice(0,opts.foods==null?RECENT_TAB_FOODS:opts.foods);
  const meals=out.filter(x=>x.kind==='meal').slice(0,opts.meals==null?RECENT_TAB_MEALS:opts.meals);
  const keep=new Set([...foods,...meals]);
  return out.filter(x=>keep.has(x)).slice(0,opts.total||Infinity);
}
// Saved meals in the order they are used: starred first, then by how often they were logged.
function savedMealsByUse(){
  const recent=S.recentSavedMeals||[];
  return(S.savedMeals||[]).map((c,i)=>{const e=mealUse(c);const r=recent.indexOf(c.id);
    return{c,s:isMealStarred(c.id)?1:0,n:e?e.all:0,r:r<0?999:r,i};})
    .sort((a,b)=>(b.s-a.s)||(b.n-a.n)||(a.r-b.r)||(b.i-a.i)).map(x=>x.c);
}

// ─── Correcting a food everywhere it was used ───
// When one of your foods is corrected (a scan with the wrong numbers, a typo), the saved meals and
// the meal plan that use it follow at once: they are templates. Meals already logged are asked
// about, because changing them changes those days' totals. Only items that still carry the food's
// OLD numbers are touched; the amount eaten stays the same amount of food.
const FIX_KEYS=['protein','carbs','fat','cals'];
function fixClose(a,b,abs){return Math.abs(a-b)<=Math.max(abs,Math.abs(b)*0.06);}
// it: a logged item (logged=true: totals for qty) or a template item (numbers for one serving).
// → the corrected item, or null when it does not carry the old numbers.
function fixFoodItem(it,old,neu,logged){
  if(!isObj(it)||!old||it.foodId!==old.id)return null;
  const n=v=>parseFloat(v)||0;const q=n(it.qty);if(!(q>0))return null;
  const oSg=servingGrams(old),nSg=servingGrams(neu),iSg=n(it.sg);
  // How the item relates to the food: the same serving, or through the weight (a scanned product
  // logged from the label's per-100 g numbers is "100g" servings of the product).
  const basis=String(it.serving||'')===String(old.serving||'')?'serv':iSg>0&&oSg>0?'g':null;
  if(!basis)return null;
  const k=basis==='serv'?1:iSg/oSg;
  const got=key=>logged?n(it[key]):n(it[key])*q;
  if(!FIX_KEYS.every(key=>fixClose(got(key),n(old[key])*k*q,key==='cals'?2:0.3)))return null;
  const out=Object.assign({},it);
  const put=(key,per,qq)=>{out[key]=logged?(key==='cals'?Math.round(per*qq):r1(per*qq)):Math.round(per*10000)/10000;};
  if(basis==='serv'){
    // A weighed amount stays the same weight when the serving's weight changed; a count stays a count.
    const u=amtUnit(it.unit,iSg);let nq=q;
    if(u!=='serv'&&oSg>0&&nSg>0&&Math.abs(oSg-nSg)>0.01)nq=Math.round(q*oSg/nSg*10000)/10000;
    out.qty=nq;out.serving=neu.serving;
    if(nSg>0)out.sg=nSg;else{delete out.sg;delete out.unit;}
    FIX_KEYS.forEach(key=>put(key,n(neu[key]),nq));
  }else{
    if(!(nSg>0))return null; // the corrected food has no weight, so a weighed item cannot follow it
    FIX_KEYS.forEach(key=>put(key,n(neu[key])*iSg/nSg,q));
  }
  if(it.name===old.name)out.name=neu.name;
  return out;
}
function foodFixPlan(old,neu){
  const plan={logged:[],saved:[],planned:[],builder:[],days:new Set()};
  if(!old||!neu)return plan;
  const changed=FIX_KEYS.some(k=>(parseFloat(old[k])||0)!==(parseFloat(neu[k])||0))
    ||String(old.serving||'')!==String(neu.serving||'')||servingGrams(old)!==servingGrams(neu);
  if(!changed)return plan;
  (S.meals||[]).forEach(m=>(m.items||[]).forEach((it,ii)=>{const x=fixFoodItem(it,old,neu,true);if(x){plan.logged.push({m,ii,x});plan.days.add(m.date);}}));
  (S.savedMeals||[]).forEach(c=>(c.items||[]).forEach((it,ii)=>{const x=fixFoodItem(it,old,neu,false);if(x)plan.saved.push({c,ii,x});}));
  ((S.mealPlan&&S.mealPlan.days)||[]).forEach(day=>(day||[]).forEach(pm=>(pm.items||[]).forEach((it,ii)=>{const x=fixFoodItem(it,old,neu,false);if(x)plan.planned.push({pm,ii,x});})));
  if(document.getElementById('meal-ov'))_mealItems.forEach((it,ii)=>{const x=fixFoodItem(it,old,neu,false);if(x)plan.builder.push({ii,x});});
  return plan;
}
// Templates and the meal open on screen. Returns how many saved meals and planned meals changed.
function applyTemplateFix(plan){
  plan.saved.forEach(e=>{e.c.items[e.ii]=e.x;});
  plan.planned.forEach(e=>{e.pm.items[e.ii]=e.x;});
  plan.builder.forEach(e=>{_mealItems[e.ii]=e.x;});
  if(plan.planned.length&&S.mealPlan)S.mealPlan.updatedAt=Date.now();
  return{saved:new Set(plan.saved.map(e=>e.c.id)).size,planned:new Set(plan.planned.map(e=>e.pm.id)).size};
}
// Logged items, with the meal's own total moved by exactly the item's change (numbers typed by hand
// into the same meal stay as they were).
function applyLoggedFix(plan){
  const before=new Map();
  plan.logged.forEach(e=>{
    if(!before.has(e.m.id))before.set(e.m.id,JSON.parse(JSON.stringify(e.m)));
    const it=e.m.items[e.ii];
    FIX_KEYS.forEach(k=>{const d=(parseFloat(e.x[k])||0)-(parseFloat(it[k])||0);const v=Math.max(0,(parseFloat(e.m[k])||0)+d);e.m[k]=k==='cals'?Math.round(v):r1(v);});
    e.m.items[e.ii]=e.x;
  });
  return before;
}
function restoreMeals(before){
  before.forEach((m,id)=>{const i=(S.meals||[]).findIndex(x=>x.id===id);if(i>=0)S.meals[i]=m;});
}
// After a food is saved: follow it through the templates, then ask about the log.
function afterFoodFixed(old,neu,undoFood){
  const plan=foodFixPlan(old,neu);
  const snapSaved=JSON.parse(JSON.stringify(S.savedMeals||[])),snapPlan=JSON.parse(JSON.stringify(S.mealPlan||null));
  const t=applyTemplateFix(plan);
  if(plan.builder.length&&typeof updateMealItems==='function')updateMealItems();
  const also=[t.saved?`${t.saved} saved meal${t.saved===1?'':'s'}`:'',t.planned?`${t.planned} planned meal${t.planned===1?'':'s'}`:''].filter(Boolean).join(' and ');
  save();
  toast(`${neu.name} saved${also?' · '+also+' updated':''}`,'green',{action:'Undo',onAction:()=>{
    undoFood();S.savedMeals=snapSaved;if(snapPlan)S.mealPlan=snapPlan;save();foodListChanged();if(typeof refreshPlanViews==='function')refreshPlanViews();
  }});
  if(!plan.logged.length)return plan;
  const n=plan.logged.length,d=plan.days.size;
  customConfirm(`${n} logged ${n===1?'entry':'entries'}${d>1?` on ${d} days`:''} still ${n===1?'has':'have'} the old numbers for ${esc(neu.name)}. Fix ${n===1?'it':'them'} too? The amounts stay the same; ${d===1?'that day’s total':'those days’ totals'}, maintenance and Patterns then use the corrected numbers.`,
    n===1?'Fix it':`Fix all ${n}`,()=>{
      const before=applyLoggedFix(plan);save();mealsChanged();
      toast(`${n} logged ${n===1?'entry':'entries'} fixed`,'green',{action:'Undo',onAction:()=>{restoreMeals(before);save();mealsChanged();}});
    },{title:'Fix what you logged?',safe:true});
  return plan;
}

// ─── Swap one item in a meal for another food ───
// For a wrong scan or a wrong pick: the next food tapped (or scanned) takes the item's place, at
// the same weight when both can be weighed, otherwise the same number of servings.
function swapMealItem(idx){
  const it=_mealItems[idx];if(!it)return;
  window._swapIdx=idx;
  const box=document.getElementById('food-search');if(box)box.value='';
  if(window._mealFoodTab==='manual'){window._mealFoodTab='all';paintFoodTabs();}
  updateMealItems();renderFoodTab();
  if(box)setTimeout(()=>{try{box.focus();}catch(e){}},120);
}
function cancelSwap(){window._swapIdx=null;updateMealItems();onFoodSearch();}
function swapNoteHTML(){
  const it=window._swapIdx!=null?_mealItems[window._swapIdx]:null;if(!it)return'';
  return`<div class="amt-note swap-note">${ICON('repeat',13)}<span>Pick the food that replaces <b>${esc(it.name)}</b></span><a onclick="cancelSwap()">Cancel</a></div>`;
}
// The new item at the old item's amount.
function swapAmount(oldIt,newIt,f){
  const ou=amtUnit(oldIt.unit,oldIt.sg);const nsg=servingGrams(f);
  if(ou!=='serv'){
    if(nsg>0){newIt.qty=Math.round((parseFloat(oldIt.qty)||0)*parseFloat(oldIt.sg)/nsg*10000)/10000;newIt.sg=nsg;newIt.unit=ou;return true;}
    newIt.qty=1;delete newIt.unit;return false;
  }
  newIt.qty=parseFloat(oldIt.qty)>0?parseFloat(oldIt.qty):1;delete newIt.unit;return true;
}
function takeSwap(newIt,f){
  const i=window._swapIdx;window._swapIdx=null;
  const old=_mealItems[i];if(!old)return false;
  if(f){const a=window._mealAmt;const tq=a?typedQty(f,a):0;
    if(a&&tq>0){newIt.qty=tq;if(a.unit!=='serv'&&newIt.sg>0)newIt.unit=a.unit;else delete newIt.unit;}
    else if(!swapAmount(old,newIt,f))toast(`${f.name} has no weight on file, so it went in as one serving`,'',{ms:3200});}
  _mealItems[i]=newIt;
  toast(`${old.name} → ${newIt.name}`,'green');
  return i;
}

// ─── Barcodes linked to your own foods ───
// A barcode the database does not know can point at a food you already have. The next scan of it
// opens that food, and the link can be undone from the food's sheet.
const BARCODE_LINKS_MAX=300;
function normalizeBarcodeLinks(v){
  const out={};if(!isObj(v))return out;
  Object.keys(v).slice(-BARCODE_LINKS_MAX).forEach(k=>{const c=cleanBarcode(k);const id=String(v[k]==null?'':v[k]).slice(0,80);if(c&&id)out[c]=id;});
  return out;
}
function linkedFood(code){
  for(const b of barcodeForms(code)){
    const id=isObj(S.barcodeLinks)?S.barcodeLinks[b]:null;
    if(id){const f=findFood(id);if(f)return{food:f,barcode:b};}
  }
  return null;
}
function barcodesFor(foodId){return isObj(S.barcodeLinks)?Object.keys(S.barcodeLinks).filter(b=>S.barcodeLinks[b]===foodId):[];}
function openLinkedFood(link){
  teardownScanner();closeOv('scan-ov');closeOv('link-ov');
  if(window._scanReturnToMeal&&document.getElementById('meal-ov')){addFoodToMeal(link.food.id,null,true);return;}
  quickLogFood(link.food.id,0,null,{barcode:link.barcode});
}
function showLinkBarcode(barcode){
  const code=cleanBarcode(barcode);if(!code)return;
  teardownScanner();closeOv('scan-ov');
  window._linkCode=code;
  const ov=makeOv('link-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div><div class="mt" style="margin-bottom:4px">Which of your foods is it?</div>
    <div class="sheet-sub">Barcode ${esc(code)}. The next scan of it opens the food you pick.</div>
    <input type="text" id="link-search" placeholder="Search your foods" oninput="renderLinkList()" autocomplete="off" autocorrect="off" enterkeyhint="search">
    <div class="list" id="link-list" style="margin-top:10px"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  renderLinkList();
}
function renderLinkList(){
  const el=document.getElementById('link-list');if(!el)return;
  const q=String(document.getElementById('link-search')?.value||'').trim();
  let foods;
  if(q)foods=searchFoods(q);
  else{const seen=new Set();foods=[...(S.customFoods||[]).slice().reverse(),...getStarredFoods(),...getRecentFoods()].filter(f=>f&&!seen.has(f.id)&&seen.add(f.id)).slice(0,30);}
  el.innerHTML=foods.length?foods.map(f=>`<button class="row row-tap" onclick="linkBarcode(${jsq(f.id)})"><span class="row-main"><span class="row-t">${esc(f.name)}</span><span class="row-s">${esc(f.serving||'1 serving')} · ${Math.round(f.cals||0)} kcal</span></span></button>`).join('')
    :`<div class="ms-empty">${q?'No food by that name.':'Search for the food this barcode belongs to.'}</div>`;
}
function linkBarcode(id){
  const code=window._linkCode;const f=findFood(id);if(!code||!f)return;
  if(!isObj(S.barcodeLinks))S.barcodeLinks={};
  barcodeForms(code).forEach(b=>{delete S.barcodeLinks[b];});
  S.barcodeLinks[code]=f.id;S.barcodeLinks=normalizeBarcodeLinks(S.barcodeLinks);
  save();toast(`Barcode linked to ${f.name}`,'green');
  openLinkedFood({food:f,barcode:code});
}
function unlinkBarcode(code){
  const gone={};barcodeForms(code).forEach(b=>{if(isObj(S.barcodeLinks)&&S.barcodeLinks[b]){gone[b]=S.barcodeLinks[b];delete S.barcodeLinks[b];}});
  if(!Object.keys(gone).length)return;
  save();
  const q=window._pendingQuickLog;if(q&&q.barcode&&barcodeForms(code).includes(q.barcode)){q.barcode=null;const el=document.getElementById('ql-code');if(el)el.remove();}
  const fe=document.getElementById('fe-links');if(fe)fe.innerHTML=foodLinksHTML(_foodEd&&_foodEd.id);
  toast('Barcode unlinked','',{action:'Undo',onAction:()=>{Object.assign(S.barcodeLinks,gone);save();}});
}
function foodLinksHTML(foodId){
  const codes=foodId?barcodesFor(foodId):[];if(!codes.length)return'';
  return codes.map(b=>`<div class="link-code">${ICON('camera',13)}<span>Barcode ${esc(b)} opens this food</span><a onclick="unlinkBarcode(${jsq(b)})">Unlink</a></div>`).join('');
}

// ─── Saved meals: edited in the meal sheet ───
// The same sheet as logging, with a name in place of the date and meal. Opened over a meal being
// logged, that meal is put back exactly as it was once the saved meal is done with.
function builderStash(){
  if(!document.getElementById('meal-ov')||window._comboEdit)return null;
  const val=id=>document.getElementById(id)?.value||'';
  return{items:_mealItems.map(it=>Object.assign({},it)),type:window._mealTypePick,date:val('meal-date'),target:window._mealTarget,edit:window._mealEdit,saved:window._loggedSavedMealId,
    manual:{'meal-pro':val('meal-pro'),'meal-carb':val('meal-carb'),'meal-fat':val('meal-fat'),'meal-cal':val('meal-cal')}};
}
function restoreBuilder(st){
  _mealItems=st.items;window._mealTarget=st.target;window._mealEdit=st.edit;window._loggedSavedMealId=st.saved;window._comboEdit=null;window._swapIdx=null;
  openMealSheet(st.date||nutDay());
  if(st.type)pickMealType(st.type);
  Object.keys(st.manual||{}).forEach(id=>{const el=document.getElementById(id);if(el)el.value=st.manual[id];});
  autoCalcMeal();
}
function editSavedMeal(id){
  const c=id?(S.savedMeals||[]).find(x=>x.id===id):null;if(id&&!c)return;
  const stash=builderStash();
  closeOv('mtype-ov');
  _mealItems=c?c.items.map(it=>Object.assign({},it)):[];
  window._loggedSavedMealId=null;window._mealTarget=null;window._mealEdit=null;window._swapIdx=null;
  window._comboEdit={id:c?c.id:null,name:c?c.name:''};
  openMealSheet(today());
  const ov=document.getElementById('meal-ov');
  if(ov)ov._onDismiss=()=>{window._comboEdit=null;window._swapIdx=null;_mealItems=[];if(stash)setTimeout(()=>restoreBuilder(stash),230);};
  if(!c)setTimeout(()=>document.getElementById('combo-edit-name')?.focus(),200);
}
// A builder's items as a saved meal keeps them: numbers for one serving, how many, and the weight.
function savedMealItems(items,man){
  return items.map(it=>{
    const o={foodId:it.foodId||null,name:it.name,qty:it.qty,serving:it.serving,protein:it.protein,carbs:it.carbs,fat:it.fat,cals:it.cals};
    if(parseFloat(it.sg)>0){o.sg=parseFloat(it.sg);if(amtUnit(it.unit,it.sg)!=='serv')o.unit=it.unit;}
    return o;
  }).concat(man&&man.has?[{foodId:null,name:'Entered by hand',qty:1,serving:'1 serving',protein:man.protein,carbs:man.carbs,fat:man.fat,cals:man.cals}]:[]);
}
function saveSavedMealFromBuilder(){
  const cm=window._comboEdit;if(!cm)return;
  const nameEl=document.getElementById('combo-edit-name');
  const name=String(nameEl?.value||'').replace(/\s+/g,' ').trim().slice(0,60);
  if(!name){toast('Give the meal a name');try{nameEl.focus();}catch(e){}return;}
  const man=mealManual();
  if(!_mealItems.length&&!man.has){toast('Add at least one food');return;}
  if(!S.savedMeals)S.savedMeals=[];
  const at=cm.id?S.savedMeals.findIndex(c=>c.id===cm.id):-1;const before=at>=0?S.savedMeals[at]:null;
  const c={id:before?before.id:uid(),name,items:savedMealItems(_mealItems,man)};
  if(at>=0)S.savedMeals[at]=c;else S.savedMeals.push(c);
  save();closeOv('meal-ov');foodListChanged();
  if(before)toast(`${name} updated`,'green',{action:'Undo',onAction:()=>{const i=S.savedMeals.findIndex(x=>x.id===before.id);if(i>=0){S.savedMeals[i]=before;save();foodListChanged();}}});
  else toast(`${name} saved`,'green');
}
function deleteSavedMealFromBuilder(){
  const cm=window._comboEdit;if(!cm||!cm.id)return;
  closeOv('meal-ov');deleteCombo(cm.id);
}
