'use strict';
// 3.19: stars that keep an amount, recents ranked by meal, correcting a food everywhere it was used,
// swapping an item, barcodes linked to your own foods, and saved meals that can be edited.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-06-15T08:30:00'; // a Monday morning: the likely meal is Breakfast
const day = n => { const d = new Date(NOW); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const els = (app, map) => { const orig = app.ctx.__get || (app.ctx.__get = app.ctx.document.getElementById); app.ctx.document.getElementById = id => (Object.prototype.hasOwnProperty.call(map, id) ? map[id] : orig(id)); };
const fields = v => { const m = {}; ['fe-name', 'fe-serving', 'fe-grams', 'fe-pro', 'fe-carb', 'fe-fat', 'fe-cal'].forEach(id => { m[id] = { value: v[id] != null ? String(v[id]) : '', style: {} }; }); m['fe-note'] = { style: {}, textContent: '' }; return m; };
const nut = over => { const app = loadApp({ now: NOW }); app.state(Object.assign({ tab: 'nutrition', macroGoals: { protein: 180, carbs: 250, fat: 70, cals: 2400 } }, over || {})); return app; };
const html = app => app.run(`document.getElementById('content').innerHTML`);
const item = (foodId, name, qty, serving, per, extra) => Object.assign({ foodId, name, qty, serving, protein: Math.round(per[0] * qty * 10) / 10, carbs: Math.round(per[1] * qty * 10) / 10, fat: Math.round(per[2] * qty * 10) / 10, cals: Math.round(per[3] * qty) }, extra || {});
const meal = (id, date, type, items, extra) => {
  const t = k => items.reduce((s, it) => s + it[k], 0);
  return Object.assign({ id, date, type, name: type, items, protein: Math.round(t('protein') * 10) / 10, carbs: Math.round(t('carbs') * 10) / 10, fat: Math.round(t('fat') * 10) / 10, cals: Math.round(t('cals')) }, extra || {});
};
// An overlay stand-in, for code that checks a sheet is open and closes it.
const ovStub = () => ({ style: {}, querySelector: () => null, remove() {} });

// ─── Stars ───
test('old starred foods become stars at the amount each was last logged, and survive a save and reload', () => {
  const chicken = item('qf_chicken_breast', 'Chicken', 2, '4 oz', [26, 0, 3, 130], { sg: 113.4, unit: 'oz' }); // 8 oz
  const app = nut({
    starredFoods: ['qf_chicken_breast', 'qf_egg', 'qf_banana', 'gone_food'],
    meals: [meal('a', day(3), 'Lunch', [item('qf_egg', 'Egg', 2, '1 egg', [6, 0.4, 5, 72])]),
      meal('b', day(1), 'Dinner', [chicken]), meal('c', day(5), 'Lunch', [item('qf_chicken_breast', 'Chicken', 1, '4 oz', [31, 0, 3.6, 165])])],
  });
  const st = app.json('S.stars');
  assert.equal(app.run('S.starredFoods'), undefined, 'the old list is gone');
  assert.deepEqual(st.map(s => [s.k, s.ref, s.unit, s.val]), [['food', 'qf_chicken_breast', 'oz', 8], ['food', 'qf_egg', 'serv', 2], ['food', 'qf_banana', 'serv', 1], ['food', 'gone_food', 'serv', 1]]);
  assert.deepEqual(app.json('starEntries().map(e=>[e.amt,e.m.cals])'), [['8 oz', 260], ['2 × 1 egg', 144], ['1 medium', 105]], 'with what each comes to; a food that no longer exists is not shown');
  const again = app.json(`normalizeState(JSON.parse(JSON.stringify(S))).stars`);
  assert.deepEqual(again, st, 'a reload keeps them exactly');
  assert.deepEqual(app.json(`normalizeStars([{k:'food',ref:'x',unit:'g',val:99999},{k:'meal',ref:'m',unit:'oz',val:5},{k:'food',ref:'x',unit:'g',val:20000},null,{k:'food',ref:''}]).map(s=>[s.k,s.unit,s.val])`), [['food', 'g', 20000], ['meal', 'serv', 1]], 'clamped, de-duplicated, junk dropped');
});
test('a food can be starred at two amounts; a star opens quick log at its amount; unstarring has Undo', () => {
  const app = nut();
  // from the food list, with an amount typed in the search
  app.run(`window._mealAmt={unit:'oz',val:6};toggleStar('qf_chicken_breast');window._mealAmt=null`);
  assert.deepEqual(app.json('S.stars.map(s=>[s.ref,s.unit,s.val])'), [['qf_chicken_breast', 'oz', 6]]);
  // from the food's own sheet, at a second amount
  els(app, {});
  app.run(`quickLogFood('qf_chicken_breast',0,null,{unit:'oz',val:6})`);
  assert.deepEqual(app.json('[_amt.ql.unit,_amt.ql.val]'), ['oz', 6], 'opens at the starred amount');
  assert.equal(app.json(`amtStarState('ql','qf_chicken_breast').on`), true, 'with its star lit');
  els(app, { 'ql-qty': { value: '10' }, 'ql-unit': { value: 'oz' } });
  assert.equal(app.json(`amtStarState('ql','qf_chicken_breast').on`), false, 'not lit at another amount');
  app.run(`toggleAmtStar('ql')`);
  assert.deepEqual(app.json('S.stars.map(s=>s.val)'), [6, 10], 'the amount on screen is starred as well');
  assert.equal(app.json(`amtStarState('ql','qf_chicken_breast').on`), true);
  app.run(`toggleAmtStar('ql')`);
  assert.deepEqual(app.json('S.stars.map(s=>s.val)'), [6], 'and the same button takes that one amount off');
  // logged from the star: the amount is still adjustable, and what is logged is what was on screen
  els(app, {}); app.run(`logStar(S.stars[0].id)`);
  els(app, { 'ql-qty': { value: '8' }, 'ql-unit': { value: 'oz' } });
  app.run(`doQuickLog('Lunch')`);
  const m = app.json('S.meals[0]');
  assert.deepEqual([m.type, app.run('itemLabel(S.meals[0].items[0])'), m.cals], ['Lunch', '8 oz Chicken Breast', 260]);
  // the row's star takes every amount of that food off, and Undo puts them back
  els(app, {});
  app.run(`addStar({k:'food',ref:'qf_chicken_breast',unit:'g',val:200});toggleStar('qf_chicken_breast')`);
  assert.equal(app.json('S.stars.length'), 0);
  app.run(`restoreStars([{id:'a',k:'food',ref:'qf_chicken_breast',unit:'oz',val:6}])`);
  assert.equal(app.json('S.stars.length'), 1);
  app.run(`removeStar('a')`); assert.equal(app.json('S.stars.length'), 0);
});
test('saved meals can be starred, sit with the starred foods, and are listed by use', () => {
  const sm = (id, name) => ({ id, name, items: [{ foodId: 'qf_egg', name: 'Egg', qty: 2, serving: '1 large', protein: 6, carbs: 0.4, fat: 5, cals: 72 }] });
  const saved = Array.from({ length: 20 }, (_, i) => sm('sm' + i, 'Meal ' + i));
  const app = nut({ savedMeals: saved, meals: [meal('x', day(2), 'Breakfast', [], { savedMealId: 'sm19', savedMealName: 'Meal 19' }), meal('y', day(1), 'Breakfast', [], { savedMealId: 'sm19', savedMealName: 'Meal 19' }), meal('z', day(1), 'Lunch', [], { savedMealName: 'Meal 18' })] });
  app.run(`toggleMealStar('sm7')`);
  assert.equal(app.run(`isMealStarred('sm7')`), true);
  assert.deepEqual(app.json('savedMealsByUse().slice(0,3).map(c=>c.id)'), ['sm7', 'sm19', 'sm18'], 'starred, then most logged (by id, or by name for older logs)');
  // the coach sees the ones in use, not the oldest fifteen
  const out = app.json(`coachTools().find(t=>t.name==='search_foods').run({})`).out;
  assert.deepEqual([out.saved_meals.length, out.total_saved_meals, out.saved_meals[1].name], [15, 20, 'Meal 19']);
  app.run(`go('nutrition')`);
  const h = html(app);
  assert.ok(h.includes('Meal 7') && h.includes('ft-star') && h.indexOf('Meal 7') < h.indexOf('Nothing logged'), 'the starred meal is in the strip under the buttons');
  // more than fifteen saved meals are all kept and listed
  const el = { innerHTML: '' }; app.run(`window.__el=null`);
  app.set('__el', el); app.run(`renderComboList(__el)`);
  assert.equal((el.innerHTML.match(/addComboToMeal\(/g) || []).length, 20);
  assert.ok(el.innerHTML.includes('editSavedMeal(null)') && el.innerHTML.includes('editSavedMeal(&quot;sm7&quot;)') && !el.innerHTML.includes('deleteCombo('), 'new and edit are offered; delete is inside the meal');
});

// ─── Recents ───
test('recents are short and ordered by what is eaten at this meal', () => {
  const egg = item('qf_egg', 'Egg', 2, '1 large', [6, 0.4, 5, 72]), oats = item('qf_oatmeal', 'Oats', 1, '1 cup', [5, 27, 3, 150]);
  const rice = item('qf_white_rice', 'Rice', 1, '1 cup', [4, 45, 0.4, 205]);
  const recent = ['qf_white_rice', 'qf_banana', 'qf_egg', 'qf_oatmeal', ...Array.from({ length: 20 }, (_, i) => ['qf_apple', 'qf_milk_whole', 'qf_broccoli', 'qf_avocado', 'qf_honey', 'qf_butter', 'qf_mushroom', 'qf_cabbage', 'qf_mustard', 'qf_black_beans', 'qf_potato_baked', 'qf_bread_wheat', 'qf_peanut_butter', 'qf_greek_yogurt', 'qf_whey', 'qf_olive_oil', 'qf_salmon', 'qf_tuna', 'qf_turkey', 'qf_cottage_cheese'][i])];
  const meals = [];
  for (let i = 1; i <= 4; i++) meals.push(meal('b' + i, day(i), 'Breakfast', [egg, oats]));
  for (let i = 1; i <= 3; i++) meals.push(meal('d' + i, day(i), 'Dinner', [rice]));
  const app = nut({ recentFoods: recent, meals });
  const bf = app.json(`recentPicks('Breakfast').map(x=>x.id)`);
  assert.deepEqual(bf.slice(0, 3), ['qf_egg', 'qf_oatmeal', 'qf_white_rice'], 'eaten at breakfast first (in recent order), then the rest by when last eaten');
  const dn = app.json(`recentPicks('Dinner').map(x=>x.id)`);
  assert.equal(dn[0], 'qf_white_rice', 'and at dinner, what is had at dinner');
  assert.equal(bf.length, 15, 'the Recent tab shows at most 15 foods');
  assert.equal(app.json(`getRecentFoods().length`), 15);
  // the Nutrition tab: eight tiles at most, nothing starred shown twice
  app.run(`addStar({k:'food',ref:'qf_egg',unit:'serv',val:2});go('nutrition')`);
  const h = html(app);
  const strip = h.slice(h.indexOf('id="quick-strip"'), h.indexOf('</div>', h.indexOf('id="quick-strip"')));
  assert.equal((strip.match(/class="food-tile"/g) || []).length, 8, 'eight recent tiles');
  assert.equal((strip.match(/ft-star/g) || []).length, 1);
  assert.equal((strip.match(/Egg/g) || []).length, 1, 'the starred egg is not repeated as a recent');
  assert.ok(strip.indexOf('ft-star') < strip.indexOf('Oat'), 'stars first');
});

// ─── Correcting a food ───
test('fixing a scanned product: saved meals and the plan follow at once; logged meals when you say so, at the same amount', () => {
  const app = nut();
  // a scanned bar, logged once by the serving and once by weight from the label's per-100 g figures
  app.set('__p', { name: 'Bar', brand: 'Acme', serving: '1 bar (40g)', servingG: 40, per100: { protein: 25, carbs: 50, fat: 20, cals: 500 }, perServing: { protein: 10, carbs: 20, fat: 8, cals: 200 } });
  els(app, {}); app.run(`showServingPicker(__p,'4006381333931')`);
  els(app, { 'scan-qty': { value: '2' } }); app.run(`logScan('Snack')`);
  els(app, {}); app.run(`showServingPicker(__p,'4006381333931')`);
  els(app, { 'scan-qty': { value: '60' }, 'scan-unit': { value: 'g' } }); app.run(`logScan('Lunch')`);
  // a third entry was changed by hand to other numbers; and one has extra typed in by hand
  app.run(`S.meals.push(${JSON.stringify(meal('hand', day(0), 'Dinner', [{ foodId: 'cf_4006381333931', name: 'Bar (Acme)', qty: 1, serving: '1 bar (40g)', sg: 40, protein: 1, carbs: 1, fat: 1, cals: 17 }]))})`);
  app.run(`S.meals[0].protein+=20;S.meals[0].cals+=80`); // 20 g protein typed by hand into the same meal
  const food = app.json(`findFood('cf_4006381333931')`);
  app.run(`S.savedMeals=[{id:'sm',name:'Snack pack',items:[${JSON.stringify({ foodId: food.id, name: food.name, qty: 1, serving: food.serving, sg: 40, protein: 10, carbs: 20, fat: 8, cals: 200 })}]}]`);
  app.run(`S.mealPlan.days[1]=[{id:'p1',type:'Snack',name:'',items:[${JSON.stringify({ foodId: food.id, name: food.name, qty: 1.5, serving: food.serving, sg: 40, protein: 10, carbs: 20, fat: 8, cals: 200 })}]}]`);
  // the label was misread: protein is 15, not 10
  app.run(`showFoodEditor({barcode:'4006381333931'})`);
  els(app, fields({ 'fe-name': 'Bar (Acme)', 'fe-serving': '1 bar (40g)', 'fe-grams': 40, 'fe-pro': 15, 'fe-carb': 20, 'fe-fat': 8, 'fe-cal': 220 }));
  app.run('saveFoodEditor()');
  assert.deepEqual(app.json('[S.savedMeals[0].items[0].protein,S.mealPlan.days[1][0].items[0].protein,S.mealPlan.days[1][0].items[0].qty]'), [15, 15, 1.5], 'templates follow straight away');
  assert.equal(app.json('S.meals[0].items[0].protein'), 20, 'the log waits for an answer');
  assert.equal(app.run('typeof _cb'), 'function');
  app.run('doConfirm()');
  const [a, b, c] = app.json('S.meals');
  assert.deepEqual([a.items[0].protein, a.items[0].qty, a.items[0].cals, a.protein, a.cals], [30, 2, 440, 50, 520], 'two bars, at the new numbers; the 20 g typed by hand stays');
  assert.deepEqual([b.items[0].unit, b.items[0].sg, app.run('itemLabel(S.meals[1].items[0])').startsWith('60 g'), b.items[0].protein, b.items[0].cals], ['g', 100, true, 22.5, 330], '60 g stays 60 g, at 15 g protein per 40 g');
  assert.deepEqual([c.items[0].protein, c.cals], [1, 17], 'an entry that no longer had the old numbers is left alone');
  assert.equal(app.json('foodFixPlan(findFood("cf_4006381333931"),findFood("cf_4006381333931")).logged.length'), 0, 'no change, nothing to fix');
});
test('a changed serving weight keeps a weighed amount the same weight; a count stays a count', () => {
  const app = nut();
  const old = { id: 'cf_x', name: 'Patty', serving: '1 patty', servingG: 100, protein: 20, carbs: 0, fat: 15, cals: 215 };
  const neu = Object.assign({}, old, { servingG: 113, protein: 22.6, fat: 17, cals: 243 });
  app.set('__o', old); app.set('__n', neu);
  const weighed = app.json(`fixFoodItem({foodId:'cf_x',name:'Patty',qty:1.5,serving:'1 patty',sg:100,unit:'g',protein:30,carbs:0,fat:22.5,cals:323},__o,__n,true)`);
  assert.deepEqual([Math.round(weighed.qty * weighed.sg), weighed.unit, weighed.sg], [150, 'g', 113]);
  assert.equal(weighed.cals, Math.round(243 * 150 / 113));
  const counted = app.json(`fixFoodItem({foodId:'cf_x',name:'Patty',qty:2,serving:'1 patty',sg:100,protein:40,carbs:0,fat:30,cals:430},__o,__n,true)`);
  assert.deepEqual([counted.qty, counted.cals, counted.unit], [2, 486, undefined]);
  assert.equal(app.json(`fixFoodItem({foodId:'cf_y',name:'Other',qty:1,serving:'1 patty',protein:20,carbs:0,fat:15,cals:215},__o,__n,true)`), null, 'another food is never touched');
  // the log is put back exactly by Undo
  app.run(`S.customFoods=[__o];S.meals=[{id:'m',date:today(),type:'Lunch',name:'Lunch',protein:50,carbs:0,fat:30,cals:500,items:[{foodId:'cf_x',name:'Patty',qty:2,serving:'1 patty',sg:100,protein:40,carbs:0,fat:30,cals:430}]}]`);
  const before = app.json('S.meals');
  app.run(`window.__b=applyLoggedFix(foodFixPlan(__o,__n))`);
  assert.deepEqual(app.json('[S.meals[0].protein,S.meals[0].cals]'), [55.2, 556], 'the meal moves by exactly the item’s change');
  app.run(`restoreMeals(__b)`);
  assert.deepEqual(app.json('S.meals'), before);
});
test('fixing a food from inside the meal being edited corrects that meal on screen', () => {
  const app = nut({ customFoods: [{ id: 'cf_w', name: 'Wrap', serving: '1 wrap', protein: 5, carbs: 30, fat: 4, cals: 176 }] });
  els(app, { 'meal-ov': ovStub() });
  app.run(`showAddMeal();addFoodToMeal('cf_w');addFoodToMeal('cf_w')`);
  const opened = app.run(`(()=>mealItemRowHTML(_mealItems[0],0))()`);
  assert.ok(opened.includes('swapMealItem(0)') && opened.includes('showFoodEditor({id:&quot;cf_w&quot;})'), 'swap and fix are on the open item');
  app.run(`showFoodEditor({id:'cf_w'})`);
  els(app, Object.assign({ 'meal-ov': ovStub() }, fields({ 'fe-name': 'Wrap', 'fe-serving': '1 wrap', 'fe-pro': 8, 'fe-carb': 30, 'fe-fat': 4, 'fe-cal': 188 })));
  app.run('saveFoodEditor()');
  assert.deepEqual(app.json('[_mealItems[0].qty,mealItemTotals(_mealItems[0]).protein,mealItemTotals(_mealItems[0]).cals]'), [2, 16, 376]);
  const built = app.run(`(()=>mealItemRowHTML({foodId:'qf_egg',name:'Egg',qty:1,serving:'1 large',protein:6,carbs:0,fat:5,cals:72},0))()`);
  assert.ok(!built.includes('showFoodEditor'), 'a built-in food is not edited from a meal');
});

// ─── Swap ───
test('swap: the food tapped next takes the item’s place at the same weight, or the same count', () => {
  const app = nut();
  els(app, { 'meal-ov': ovStub() });
  app.run(`showAddMeal();addFoodToMeal('qf_chicken_breast',{unit:'g',val:200},true);addFoodToMeal('qf_egg',{unit:'serv',val:2},true)`);
  app.run(`swapMealItem(0)`);
  assert.equal(app.run('window._swapIdx'), 0);
  assert.ok(app.run('swapNoteHTML()').includes('Chicken'), 'the list says what is being replaced');
  app.run(`addFoodToMeal('qf_salmon')`);
  const s = app.json('_mealItems[0]');
  assert.deepEqual([s.foodId, s.unit, Math.round(s.qty * s.sg)], ['qf_salmon', 'g', 200]);
  assert.equal(app.run('window._swapIdx'), null);
  app.run(`swapMealItem(1);addFoodToMeal('qf_egg_white')`);
  assert.deepEqual(app.json('[_mealItems.length,_mealItems[1].foodId,_mealItems[1].qty]'), [2, 'qf_egg_white', 2], 'two eggs become two egg whites');
  // a saved meal is never swapped in for one item; removing the item cancels the swap
  app.run(`swapMealItem(1);removeMealItem(1)`); assert.equal(app.run('window._swapIdx'), null);
});

// ─── Barcode links ───
test('a barcode the database does not know can point at one of your foods; the next scan opens it with no lookup', async () => {
  const app = nut();
  const reqs = app.mockFetch(() => ({ status: 404, body: {} }));
  app.run(`showLinkBarcode('036000291452');linkBarcode('qf_greek_yogurt')`);
  assert.deepEqual(app.json('S.barcodeLinks'), { '036000291452': 'qf_greek_yogurt' });
  assert.equal(app.json('window._pendingQuickLog.food.id'), 'qf_greek_yogurt', 'opened straight away to log');
  app.run(`window._pendingQuickLog=null`);
  await app.run(`onBarcodeDetected('0036000291452')`); // the 13-digit form of the same barcode
  assert.deepEqual([reqs.length, app.json('window._pendingQuickLog.food.id'), app.json('window._pendingQuickLog.barcode')], [0, 'qf_greek_yogurt', '036000291452']);
  assert.match(app.run('scanFailHTML("Product not found","123",false)'), /showLinkBarcode\(&quot;123&quot;\)/, 'offered when a product is not found');
  app.run(`unlinkBarcode('036000291452')`);
  assert.deepEqual(app.json('S.barcodeLinks'), {});
  // a link to one of your foods goes when the food is deleted, and comes back with Undo
  app.run(`S.customFoods.push({id:'cf_a',name:'A',serving:'1',protein:1,carbs:1,fat:1,cals:17});window._linkCode='12345670';linkBarcode('cf_a');deleteCustomFood('cf_a')`);
  assert.deepEqual(app.json('S.barcodeLinks'), {});
  assert.deepEqual(app.json(`normalizeBarcodeLinks({'12 3<4':'x','':'y','5':''})`), { 1234: 'x' });
});

// ─── Saved meals ───
test('a saved meal is edited in the meal sheet: renamed, changed, deleted with Undo; a meal being logged is put back', () => {
  const app = nut({ savedMeals: [{ id: 'sm', name: 'Eggs', items: [{ foodId: 'qf_egg', name: 'Egg', qty: 2, serving: '1 large', protein: 6, carbs: 0.4, fat: 5, cals: 72 }] }] });
  els(app, { 'meal-ov': ovStub(), 'meal-date': { value: day(1) }, 'meal-pro': { value: '5' }, 'meal-carb': { value: '' }, 'meal-fat': { value: '' }, 'meal-cal': { value: '' } });
  app.run(`showAddMeal();addFoodToMeal('qf_banana');pickMealType('Snack')`);
  const stash = app.json('builderStash()');
  assert.deepEqual([stash.items.length, stash.type, stash.date, stash.manual['meal-pro']], [1, 'Snack', day(1), '5']);
  app.run(`editSavedMeal('sm')`);
  assert.deepEqual(app.json('[window._comboEdit.id,_mealItems.length,_mealItems[0].qty]'), ['sm', 1, 2]);
  const sheet = app.run(`buildMealModalHTML(today())`);
  assert.ok(sheet.includes('Edit saved meal') && sheet.includes('combo-edit-name') && !sheet.includes('meal-types') && !sheet.includes('id="meal-date"') && sheet.includes('deleteSavedMealFromBuilder()'));
  els(app, { 'meal-ov': ovStub(), 'combo-edit-name': { value: '  Big eggs ' }, 'meal-pro': { value: '' }, 'meal-carb': { value: '' }, 'meal-fat': { value: '' }, 'meal-cal': { value: '' } });
  app.run(`adjMealItem(0,1);addFoodToMeal('qf_bread_wheat');saveMeal()`);
  const c = app.json('S.savedMeals[0]');
  assert.deepEqual([c.id, c.name, c.items.length, c.items[0].qty], ['sm', 'Big eggs', 2, 3]);
  // the meal that was being logged comes back as it was
  app.set('__st', stash); app.run(`restoreBuilder(__st)`);
  assert.deepEqual(app.json('[_mealItems.length,_mealItems[0].foodId,window._mealTypePick,window._comboEdit]'), [1, 'qf_banana', 'Snack', null]);
  // a new one from scratch needs a name
  app.run(`editSavedMeal(null)`); els(app, { 'combo-edit-name': { value: '' }, 'meal-pro': { value: '' }, 'meal-carb': { value: '' }, 'meal-fat': { value: '' }, 'meal-cal': { value: '' } });
  app.run(`addFoodToMeal('qf_whey');saveMeal()`); assert.equal(app.json('S.savedMeals.length'), 1);
  els(app, { 'combo-edit-name': { value: 'Shake' }, 'meal-pro': { value: '' }, 'meal-carb': { value: '' }, 'meal-fat': { value: '' }, 'meal-cal': { value: '' } });
  app.run(`saveMeal()`); assert.deepEqual(app.json('S.savedMeals.map(c=>c.name)'), ['Big eggs', 'Shake']);
  // delete, from inside the meal; stars go with it
  app.run(`toggleMealStar('sm');window._comboEdit={id:'sm',name:'Big eggs'};deleteSavedMealFromBuilder()`);
  assert.deepEqual(app.json('[S.savedMeals.length,S.stars.length]'), [1, 0]);
  // logging a saved meal records which one, so renaming it does not lose its place in the recents
  app.run(`quickLogCombo(S.savedMeals[0].id);doQuickLog('Lunch')`);
  assert.equal(app.json('S.meals[0].savedMealId'), app.json('S.savedMeals[0].id'));
});
test('a logged meal row is tapped to change it; delete is inside the meal, not on the row', () => {
  const app = nut({ meals: [meal('t1', day(0), 'Breakfast', [item('qf_egg', 'Egg', 2, '1 large', [6, 0.4, 5, 72])])] });
  app.run(`go('nutrition')`);
  const h = html(app);
  assert.ok(h.includes('editMeal(&quot;t1&quot;)') && h.includes('repeatMeal(&quot;t1&quot;)') && !h.includes('deleteMeal('));
  app.run(`editMeal('t1')`);
  const sheet = app.run(`buildMealModalHTML(today())`);
  assert.ok(sheet.includes('deleteMealFromBuilder()') && sheet.includes('Save changes'));
  app.run(`deleteMealFromBuilder()`);
  assert.equal(app.json('S.meals.length'), 0);
});
test('the Foods tab puts your own foods first, newest on top', () => {
  const app = nut({ customFoods: [{ id: 'cf_1', name: 'Old Bar', serving: '1', protein: 1, carbs: 1, fat: 1, cals: 17 }, { id: 'cf_2', name: 'New Bar', serving: '1', protein: 1, carbs: 1, fat: 1, cals: 17 }] });
  const list = { innerHTML: '', style: {} };
  els(app, { 'food-list': list });
  app.run(`showAddMeal();setFoodTab('all')`);
  const h = list.innerHTML;
  assert.ok(h.indexOf('Your foods') < h.indexOf('New Bar') && h.indexOf('New Bar') < h.indexOf('Old Bar') && h.indexOf('Old Bar') < h.indexOf('All foods') && h.indexOf('All foods') < h.indexOf('Egg'));
});
