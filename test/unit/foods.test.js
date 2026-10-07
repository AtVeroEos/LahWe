'use strict';
// Logging by weight, the one-sheet meal builder, repeat and copy, maintenance worked out from the
// log, and the order of the Nutrition tab.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-06-15T18:30:00'; // a Monday evening
const day = n => { const d = new Date(NOW); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const meal = (id, date, type, p, c, f, items) => ({ id, date, type, name: type, protein: p, carbs: c, fat: f, cals: Math.round(p * 4 + c * 4 + f * 9), items });
const els = (app, map) => { const orig = app.ctx.__get || (app.ctx.__get = app.ctx.document.getElementById); app.ctx.document.getElementById = id => (Object.prototype.hasOwnProperty.call(map, id) ? map[id] : orig(id)); };
const nut = over => { const app = loadApp({ now: NOW }); app.state(Object.assign({ tab: 'nutrition', macroGoals: { protein: 180, carbs: 250, fat: 70, cals: 2400 } }, over || {})); return app; };
const html = app => app.run(`document.getElementById('content').innerHTML`);

// ─── Gram weights ───
test('every built-in gram weight is physically possible for that food', () => {
  const app = loadApp({ now: NOW });
  const foods = app.json('QUICK_FOODS'); const grams = app.json('FOOD_GRAMS');
  for (const id of Object.keys(grams)) assert.ok(foods.some(f => f.id === id), `${id} is in the table but is not a food`);
  let withWeight = 0;
  for (const f of foods) {
    const g = app.run(`servingGrams(findFood(${JSON.stringify(f.id)}))`);
    if (!g) continue; withWeight++;
    const density = f.cals / g, mass = (f.protein + f.carbs + f.fat) / g;
    // Nothing is denser than pure fat (9 kcal/g), and protein + carbs + fat cannot outweigh the food.
    // 5% and 8% of slack covers labels that round 13.5 g of oil to "14 g fat, 120 kcal".
    assert.ok(density <= 9 * 1.05 && density >= 0.1, `${f.id}: ${f.cals} kcal in ${g} g is ${(density * 100).toFixed(0)} kcal/100 g`);
    assert.ok(mass <= 1.08, `${f.id}: ${f.protein + f.carbs + f.fat} g of macros in a ${g} g serving`);
  }
  assert.ok(withWeight >= 180, `${withWeight} of ${foods.length} built-in foods can be logged by weight`);
  // Spot checks against well-known densities (kcal per 100 g), each within 12%.
  const ref = { qf_greek_yogurt: 59, qf_mushroom: 22, qf_mustard: 60, qf_cabbage: 25, qf_avocado: 167, qf_egg: 143, qf_white_rice: 130, qf_banana: 89, qf_olive_oil: 884, qf_oatmeal: 379, qf_peanut_butter: 588, qf_broccoli: 34, qf_milk_whole: 61, qf_bread_wheat: 252, qf_black_beans: 132, qf_honey: 304, qf_potato_baked: 93, qf_apple: 52, qf_butter: 717 };
  for (const [id, want] of Object.entries(ref)) {
    const f = foods.find(x => x.id === id); const got = f.cals / grams[id] * 100;
    assert.ok(Math.abs(got - want) / want <= 0.12, `${id}: ${got.toFixed(0)} kcal/100 g, expected about ${want}`);
  }
  // Foods that vary too much by brand or recipe deliberately have no weight.
  // corrected entries: a cup of nonfat Greek yogurt is 245 g and about 145 kcal, not 110
  const y = foods.find(f => f.id === 'qf_greek_yogurt'); assert.deepEqual([y.serving, y.cals, y.protein], ['1 cup', 145, 25]);
  assert.equal(foods.find(f => f.id === 'qf_cabbage').serving, '1 cup chopped');
  for (const id of ['qf_protein_bar', 'qf_whey', 'qf_biscuit', 'qf_granola_bar']) assert.equal(app.run(`servingGrams(findFood('${id}'))`), 0, id);
});
test('a serving’s weight: stored on the food, from the table, or read from the serving text', () => {
  const app = loadApp({ now: NOW });
  const g = s => app.run(`servingGrams(${JSON.stringify(s)})`);
  assert.equal(g({ id: 'x', serving: '1 bar', servingG: 52 }), 52, 'a weight stored on the food wins');
  assert.equal(g({ id: 'qf_egg', serving: '1 egg' }), 50);
  assert.equal(g({ id: 'x', serving: '100g' }), 100);
  assert.equal(g({ id: 'x', serving: '4 oz' }), 113.4);
  assert.equal(g({ id: 'x', serving: '1 can (5 oz)' }), 141.7);
  assert.equal(g({ id: 'x', serving: 'medium (117g)' }), 117);
  assert.equal(g({ id: 'x', serving: '1 lb' }), 453.6);
  assert.equal(g({ id: 'x', serving: '0.5 kg' }), 500);
  assert.equal(g({ id: 'x', serving: '8 fl oz' }), 0, 'fluid ounces are a volume');
  // fractions, mixed numbers, decimal commas and thousands are read properly, not by their last digits
  for (const [txt, want] of [['1/4 lb', 113.4], ['1/2 lb patty', 226.8], ['1/2 oz', 14.2], ['1 1/2 oz', 42.5], ['½ lb', 226.8], ['1½ oz', 42.5], ['0,5 kg', 500], ['1,000 g', 1000], ['1 bar (1.4 oz)', 39.7], ['28g (about 14 chips)', 28]])
    assert.equal(g({ id: 'x', serving: txt }), want, txt);
  for (const txt of ['2 x 100 g', '3×50g', '1/0 oz', '99999 kg'])
    assert.equal(g({ id: 'x', serving: txt }), 0, txt + ' is not guessed at');
  assert.equal(g({ id: 'x', serving: '1 bar' }), 0);
  assert.equal(g({ id: 'x', serving: '2 eggs' }), 0, 'a word that merely starts with g is not grams');
  assert.equal(g(null), 0);
  assert.equal(app.run(`servingText(findFood('qf_white_rice'))`), '1 cup (158 g)');
  assert.equal(app.run(`servingText(findFood('qf_chicken_breast'))`), '4 oz', 'no weight is added to a serving that already is one');
  assert.equal(app.run(`servingText(findFood('qf_protein_bar'))`), '1 bar');
});
test('amounts convert between servings, grams and ounces without drifting', () => {
  const app = loadApp({ now: NOW });
  assert.equal(app.run(`amtToQty(150,'g',100)`), 1.5);
  assert.equal(app.run(`qtyToAmt(1.5,'g',100)`), 150);
  assert.equal(app.run(`qtyToAmt(amtToQty(12.5,'g',13.5),'g',13.5)`), 12.5, 'small weights keep their decimal');
  assert.equal(app.run(`qtyToAmt(1,'g',113.4)`), 113, 'larger ones show whole grams');
  assert.equal(app.run(`qtyToAmt(amtToQty(150,'g',113.4),'g',113.4)`), 150, 'what was typed is what reads back');
  assert.equal(app.run(`qtyToAmt(amtToQty(5.5,'oz',113.4),'oz',113.4)`), 5.5);
  assert.equal(app.run(`amtToQty(4,'oz',113.4)`), 1, '4 oz of a 4 oz serving is one serving');
  assert.equal(app.run(`amtToQty(2,'g',0)`), 2, 'no known weight: the number is servings whatever the unit says');
  assert.equal(app.run(`amtUnit('oz',0)`), 'serv');
  for (const bad of ['0', '-3', 'abc', '']) assert.equal(app.run(`amtToQty(${JSON.stringify(bad)},'g',100)`), 0, bad);
  assert.equal(app.run(`itemLabel({name:'Rice',qty:1.5})`), '1.5 × Rice');
  assert.equal(app.run(`itemLabel({name:'Rice',qty:1})`), 'Rice');
  assert.equal(app.run(`itemLabel({name:'Rice',qty:0.25})`), '0.25 × Rice', 'a quarter serving is not rounded to 0.3');
  assert.equal(app.run(`itemLabel({name:'Rice',qty:1.2658,sg:158,unit:'g'})`), '200 g Rice');
  assert.equal(app.run(`itemLabel({name:'Rice',qty:2,unit:'g'})`), '2 × Rice', 'a unit with no weight behind it is ignored');
  assert.deepEqual(app.json(`normalizeFoodUnits({a:'g',b:'oz',c:'cups',d:1})`), { a: 'g', b: 'oz' });
  assert.deepEqual(app.json(`normalizeFoodUnits('x')`), {});
});

// ─── The meal builder ───
test('a food is logged by weight: the numbers are exact, it reads back as typed, and the unit is remembered', () => {
  const app = nut();
  const q = { value: '' };
  els(app, { 'mi-q-0': q, 'meal-date': { value: day(0) } });
  app.run(`showAddMeal();addFoodToMeal('qf_chicken_breast')`);
  const f = app.json(`findFood('qf_chicken_breast')`);            // 4 oz serving
  assert.deepEqual(app.json('[_mealItems[0].qty,_mealItems[0].sg,_mealItems[0].unit]'), [1, 113.4, null]);
  app.run(`mealItemUnit(0,'g')`);
  assert.equal(app.run(`qtyToAmt(_mealItems[0].qty,'g',_mealItems[0].sg)`), 113, 'switching unit shows the same amount of food, in grams');
  q.value = '200'; app.run(`mealItemInput(0)`);
  const t = app.json('mealItemTotals(_mealItems[0])');
  assert.equal(t.cals, Math.round(f.cals * 200 / 113.4)); assert.equal(t.protein, Math.round(f.protein * 200 / 113.4 * 10) / 10);
  for (const junk of ['', '0', '-5', 'x']) { q.value = junk; app.run(`mealItemInput(0)`); }
  assert.equal(app.run(`qtyToAmt(_mealItems[0].qty,'g',_mealItems[0].sg)`), 200, 'nonsense typed into the amount leaves the last good one');
  app.run(`adjMealItem(0,0.5)`); assert.equal(app.run(`qtyToAmt(_mealItems[0].qty,'g',_mealItems[0].sg)`), 210, 'the buttons step a weighed item by 10 g');
  app.run(`adjMealItem(0,-0.5)`);
  app.run(`pickMealType('Dinner');saveMeal()`);
  const m = app.json('S.meals[0]');
  assert.equal(m.type, 'Dinner'); assert.equal(m.cals, t.cals);
  assert.deepEqual([m.items[0].unit, m.items[0].sg, m.items[0].cals], ['g', 113.4, t.cals]);
  assert.equal(app.run(`itemLabel(S.meals[0].items[0])`), '200 g Chicken Breast');
  assert.deepEqual(app.json('S.foodUnits'), { qf_chicken_breast: 'g' });
  assert.equal(app.json(`foodItem(findFood('qf_chicken_breast')).unit`), 'g', 'next time it starts in grams');
  // it opens for editing still in grams, and logging it by the serving forgets the preference
  app.run(`editMeal(S.meals[0].id)`);
  assert.deepEqual(app.json(`[_mealItems[0].unit,qtyToAmt(_mealItems[0].qty,'g',_mealItems[0].sg),Math.round(_mealItems[0].cals)]`), ['g', 200, f.cals]);
  app.run(`mealItemUnit(0,'serv');saveMeal()`);
  assert.deepEqual(app.json('[S.meals.length,S.meals[0].items[0].unit===undefined,S.foodUnits]'), [1, true, {}]);
  // a food with no known weight cannot be switched
  app.run(`showAddMeal();addFoodToMeal('qf_protein_bar');mealItemUnit(0,'g')`);
  assert.deepEqual(app.json('[_mealItems[0].unit===undefined,_mealItems[0].sg===undefined,_mealItems[0].qty]'), [true, true, 1]);
});
test('the meal is chosen in the sheet: one tap saves, by-hand numbers add to picked foods', () => {
  const app = nut();
  app.run(`showAddMeal()`);
  assert.equal(app.run('window._mealTypePick'), 'Dinner', 'starts on the likely meal for the time of day');
  assert.equal(app.run('window._mealFoodTab'), 'all', 'with nothing starred or recent the sheet opens on the food list');
  app.run(`saveMeal()`); assert.equal(app.json('S.meals.length'), 0, 'nothing to log yet');
  const hand = { 'meal-pro': { value: '20' }, 'meal-carb': { value: '10' }, 'meal-fat': { value: '' }, 'meal-cal': { value: '' }, 'meal-date': { value: day(1) } };
  els(app, hand);
  assert.deepEqual(app.json('mealManual()'), { protein: 20, carbs: 10, fat: 0, cals: 120, has: true });
  app.run(`pickMealType('Lunch');saveMeal()`);
  let m = app.json('S.meals[0]');
  assert.deepEqual([m.type, m.date, m.protein, m.cals, m.items === undefined], ['Lunch', day(1), 20, 120, true], 'numbers only, to the date in the sheet');
  assert.equal(app.run(`!!document.getElementById('mtype-ov')`), false, 'no second sheet asks which meal');
  hand['meal-cal'].value = '150';
  app.run(`showAddMeal();addFoodToMeal('qf_egg');addFoodToMeal('qf_egg')`);
  const egg = app.json(`findFood('qf_egg')`);
  assert.deepEqual(app.json('mealTotalsNow()').cals, egg.cals * 2 + 150);
  app.run(`saveMeal()`);
  m = app.json('S.meals[1]');
  assert.deepEqual([m.items.length, m.items[0].qty, m.cals, m.protein], [1, 2, egg.cals * 2 + 150, Math.round((egg.protein * 2 + 20) * 10) / 10]);
  // starred foods make Starred the opening tab; with only recents it is Recent
  app.run(`S.starredFoods=['qf_egg'];showAddMeal()`); assert.equal(app.run('window._mealFoodTab'), 'starred');
  app.run(`S.starredFoods=[];showAddMeal()`); assert.equal(app.run('window._mealFoodTab'), 'recent');
  // planning a meal opens on that meal's own type
  app.run(`window._mealTarget={plan:1,replace:'x',name:'',type:'Breakfast'};showAddMeal(null,true)`);
  assert.equal(app.run('window._mealTypePick'), 'Breakfast');
});
test('quick log in ounces, and a custom food with a stated weight can be weighed', () => {
  const app = nut();
  app.run(`quickLogFood('qf_chicken_breast')`);
  els(app, { 'ql-qty': { value: '6' }, 'ql-unit': { value: 'oz' } });
  assert.equal(app.run('quickQty()'), 1.5);
  app.run(`doQuickLog('Lunch')`);
  const m = app.json('S.meals[0]'); const f = app.json(`findFood('qf_chicken_breast')`);
  assert.deepEqual([m.items[0].unit, m.items[0].qty, m.cals], ['oz', 1.5, Math.round(f.cals * 1.5)]);
  assert.equal(app.run(`itemLabel(S.meals[0].items[0])`), '6 oz Chicken Breast');
  // the food editor keeps the weight of a serving
  const v = { 'fe-name': 'Protein Puffs', 'fe-serving': '1 bag', 'fe-grams': '60', 'fe-pro': '21', 'fe-carb': '5', 'fe-fat': '3', 'fe-cal': '' };
  const map = {}; Object.keys(v).forEach(k => { map[k] = { value: v[k], style: {} }; }); map['fe-note'] = { style: {}, textContent: '' };
  els(app, map);
  app.run(`showFoodEditor({});saveFoodEditor()`);
  const cf = app.json('S.customFoods[0]');
  assert.deepEqual([cf.servingG, cf.serving], [60, '1 bag']);
  assert.equal(app.run(`servingGrams(S.customFoods[0])`), 60);
  assert.equal(app.json(`foodItem(S.customFoods[0]).sg`), 60);
  map['fe-grams'].value = ''; map['fe-name'].value = 'No Weight';
  app.run(`showFoodEditor({});saveFoodEditor()`);
  assert.equal(app.json('S.customFoods[1].servingG===undefined'), true, 'no weight is invented when none is given');
});

test('a weighed item keeps its weight in the meal plan, in a reusable meal, and when a tiny amount is corrected', () => {
  const app = nut({ customFoods: [{ id: 'cf_pot', name: 'Chili (whole pot)', serving: '1 pot', servingG: 5000, protein: 300, carbs: 400, fat: 350, cals: 6000 }] });
  // plan: 350 g of a 5 kg pot is 0.07 of a serving and must not be floored to 0.1
  app.run(`showAddMeal(null,false,{plan:1});addFoodToMeal('cf_pot');mealItemUnit(0,'g');_mealItems[0].qty=amtToQty(350,'g',5000);saveMeal()`);
  let it = app.json('S.mealPlan.days[1][0].items[0]');
  assert.deepEqual([it.unit, it.sg, it.qty], ['g', 5000, 0.07]);
  assert.equal(app.json('planMealTotals(S.mealPlan.days[1][0]).cals'), 420);
  assert.ok(app.run('planItemHTML(S.mealPlan.days[1][0].items[0])').includes('350 g'), 'the plan shows the weight, not "0.07 ×"');
  const e = app.json(`logPlanMeal(1,S.mealPlan.days[1][0].id)`);
  assert.deepEqual([e.cals, e.items[0].unit, e.items[0].sg], [420, 'g', 5000], 'logging the planned meal gives the same 420 kcal, still in grams');
  app.run(`planEditMeal(1,S.mealPlan.days[1][0].id)`);
  assert.deepEqual(app.json(`[_mealItems[0].unit,qtyToAmt(_mealItems[0].qty,'g',_mealItems[0].sg),window._mealTypePick]`), ['g', 350, app.json('S.mealPlan.days[1][0].type')]);
  // an abandoned edit of a logged meal does not leak its meal type into the plan editor
  app.run(`S.meals.push({id:'L',date:today(),type:'Lunch',name:'Lunch',protein:1,carbs:1,fat:1,cals:17});editMeal('L')`);
  app.run(`S.mealPlan.days[1][0].type='Breakfast';planEditMeal(1,S.mealPlan.days[1][0].id)`);
  assert.equal(app.run('window._mealTypePick'), 'Breakfast');
  assert.equal(app.run('window._mealEdit'), null);
  // a plain plan item is still limited as before
  assert.deepEqual(app.json(`[cleanPlanItem({name:'x',qty:0.01,cals:10}).qty,cleanPlanItem({name:'x',qty:99,cals:10}).qty,cleanPlanItem({name:'x',qty:1.234,cals:10,unit:'g'}).unit===undefined]`), [0.1, 30, true]);
  // reusable meal: by-hand numbers on screen are saved with it
  const hand = { 'meal-pro': { value: '20' }, 'meal-carb': { value: '' }, 'meal-fat': { value: '' }, 'meal-cal': { value: '150' }, 'combo-name': { value: 'Bowl' }, 'meal-date': { value: day(0) } };
  els(app, hand);
  app.run(`window._mealTarget=null;showAddMeal();addFoodToMeal('qf_egg');addFoodToMeal('qf_white_rice')`);
  const shown = app.json('mealTotalsNow().cals');
  app.run(`doSaveCombo()`);
  assert.equal(app.json('savedMealCals(S.savedMeals[0])'), shown, 'the saved meal is the meal that was on screen');
  assert.equal(app.json('S.savedMeals[0].items.length'), 3);
  // edit precision: 10 g of broccoli logged, then corrected to 300 g, uses the food's real numbers
  els(app, { 'meal-date': { value: day(0) } });
  app.run(`S.meals=[];showAddMeal();addFoodToMeal('qf_broccoli');mealItemUnit(0,'g');_mealItems[0].qty=amtToQty(10,'g',91);saveMeal()`);
  assert.equal(app.json('S.meals[0].cals'), 3);
  app.run(`editMeal(S.meals[0].id);_mealItems[0].qty=amtToQty(300,'g',91);saveMeal()`);
  const b = app.json(`findFood('qf_broccoli')`);
  assert.equal(app.json('S.meals[0].cals'), Math.round(b.cals * 300 / 91), 'not 3 kcal × 30');
  // but a food whose numbers were changed since does not rewrite the meal when it is opened
  app.run(`S.customFoods[0].cals=9000;S.meals=[{id:'h',date:today(),type:'Dinner',name:'Dinner',items:[{foodId:'cf_pot',name:'Chili',qty:0.5,serving:'1 pot',protein:150,carbs:200,fat:175,cals:3000}],protein:150,carbs:200,fat:175,cals:3000}];editMeal('h');saveMeal()`);
  assert.equal(app.json('S.meals[0].cals'), 3000);
});
test('a by-hand meal keeps automatic calories automatic, and a scanned line is not merged into a plain serving', () => {
  const app = nut({ meals: [{ id: 'h', date: day(0), type: 'Lunch', name: 'Lunch', protein: 20, carbs: 10, fat: 0, cals: 120 }, { id: 'k', date: day(0), type: 'Lunch', name: 'Lunch', protein: 20, carbs: 10, fat: 0, cals: 300 }] });
  const f = { 'meal-pro': { value: '' }, 'meal-carb': { value: '' }, 'meal-fat': { value: '' }, 'meal-cal': { value: '' }, 'meal-date': { value: day(0) } };
  els(app, f);
  app.run(`editMeal('h')`);
  assert.deepEqual([f['meal-pro'].value, f['meal-cal'].value], [20, ''], 'calories that were just the macros added up are left to follow them');
  f['meal-pro'].value = '40'; app.run(`saveMeal()`);
  assert.equal(app.json(`S.meals.find(m=>m.id==='h').cals`), 200);
  Object.keys(f).forEach(k => { if (k !== 'meal-date') f[k].value = ''; });
  app.run(`editMeal('k')`);
  assert.equal(f['meal-cal'].value, 300, 'calories that were typed (they do not match the macros) come back as typed');
  // a scanned "2 × 1 bar" style line and the food by the serving are separate lines
  app.run(`S.customFoods=[{id:'cf_1',name:'Bar',serving:'1 bar (40g)',servingG:40,protein:10,carbs:20,fat:8,cals:200}];showAddMeal();_mealItems=[{foodId:'cf_1',name:'Bar',qty:1,serving:'150g',protein:37.5,carbs:75,fat:30,cals:750}];addFoodToMeal('cf_1');addFoodToMeal('cf_1')`);
  assert.deepEqual(app.json('_mealItems.map(i=>[i.serving,i.qty,mealItemTotals(i).cals])'), [['150g', 1, 750], ['1 bar (40g)', 2, 400]]);
});

// ─── Repeat and copy ───
test('repeat logs the same meal again today; copying a day brings its meals across as new meals', () => {
  const items = [{ foodId: 'qf_egg', name: 'Egg', qty: 3, serving: '1 egg', protein: 18, carbs: 1, fat: 15, cals: 216 }];
  const app = nut({ meals: [
    Object.assign(meal('y1', day(1), 'Breakfast', 18, 1, 15, items), { planMealId: 'p1', savedMealName: 'Eggs' }),
    meal('y2', day(1), 'Dinner', 50, 60, 20),
    meal('o1', day(4), 'Lunch', 40, 50, 10)] });
  app.run(`repeatMeal('y1')`);
  let today = app.json(`S.meals.filter(m=>m.date==='${day(0)}')`);
  assert.equal(today.length, 1);
  assert.ok(today[0].id !== 'y1' && today[0].planMealId === undefined, 'a copy is its own meal and is not tied to the plan');
  assert.deepEqual([today[0].type, today[0].savedMealName, today[0].cals, today[0].items[0].qty], ['Breakfast', 'Eggs', meal('', '', '', 18, 1, 15).cals, 3]);
  app.run(`S.meals.find(m=>m.date==='${day(0)}').items[0].qty=9`);
  assert.equal(app.json(`S.meals.find(m=>m.id==='y1').items[0].qty`), 3, 'changing the copy leaves the original alone');
  assert.deepEqual(app.json('S.recentFoods'), ['qf_egg']);
  app.run(`repeatMeal('nope')`);
  assert.deepEqual(app.json(`daysWithMeals('${day(0)}',5)`), [day(1), day(4)], 'earlier days that have meals, newest first');
  assert.deepEqual(app.json(`daysWithMeals('${day(4)}',5)`), []);
  // copy yesterday into today: one meal, then the rest
  app.run(`S.meals=S.meals.filter(m=>m.date!=='${day(0)}');showCopyDay()`);
  assert.deepEqual(app.json('[_copyDay.to,_copyDay.from]'), [day(0), day(1)]);
  app.run(`copyOneMeal('y2');copyOneMeal('y2')`);
  assert.equal(app.json(`S.meals.filter(m=>m.date==='${day(0)}').length`), 1, 'adding the same meal twice from the sheet adds it once');
  app.run(`copyAllMeals()`);
  today = app.json(`S.meals.filter(m=>m.date==='${day(0)}')`);
  assert.deepEqual(today.map(m => m.type).sort(), ['Breakfast', 'Dinner']);
  assert.equal(app.json(`S.meals.filter(m=>m.date==='${day(1)}').length`), 2, 'the day copied from is untouched');
  // stepping to an older day, and copying into a past day that is on screen
  app.run(`setNutDay('${day(2)}');showCopyDay()`);
  assert.deepEqual(app.json('[_copyDay.to,_copyDay.from]'), [day(2), day(4)]);
  app.run(`copyDayStep(-1)`); assert.equal(app.json('_copyDay.from'), day(4), 'there is nothing earlier to step to');
  app.run(`copyAllMeals()`);
  assert.deepEqual(app.json(`S.meals.filter(m=>m.date==='${day(2)}').map(m=>m.type)`), ['Lunch']);
});

// ─── Maintenance ───
// A month of data with a known answer: eating `kcal` a day while weight moves `perWeek` a week.
const month = (kcal, perWeek, opts) => {
  opts = opts || {}; const meals = [], bodyweightLog = [];
  for (let d = 28; d >= 1; d--) { if (opts.skip && opts.skip.includes(d)) continue; const k = kcal + (d % 2 ? 60 : -60); meals.push({ id: 'm' + d, date: day(d), type: 'Dinner', name: 'Dinner', protein: 0, carbs: 0, fat: 0, cals: opts.half && opts.half.includes(d) ? 700 : k }); }
  for (let d = 28; d >= 0; d -= (opts.every || 2)) bodyweightLog.push({ date: day(d), weight: Math.round((190 + (28 - d) * perWeek / 7 + (d % 4 === 0 ? 0.3 : -0.3)) * 100) / 100 });
  bodyweightLog.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { meals, bodyweightLog, bodyweight: 190, unit: opts.unit || 'lbs' };
};
test('maintenance is worked out from intake and the weight trend, with an honest margin', () => {
  let app = nut(month(2500, -0.5));
  let o = app.json('observedMaintenance()');
  assert.equal(o.ok, true);
  assert.ok(Math.abs(o.kcal - 2750) <= 40, `eating 2,500 and losing half a pound a week is about 2,750 (got ${o.kcal})`);
  assert.ok(o.margin >= 50 && o.margin <= 200, `margin ${o.margin}`);
  // the day rolls over with the app open: yesterday's answer is not served again
  app.setNow('2026-06-16T08:00:00'); assert.equal(app.json('observedMaintenance()').to !== o.to || app.json('observedMaintenance().window') === 28, true);
  assert.equal(app.run(`observedMaintenance().weighIns`), 14, 'a day later one weigh-in has left the four-week window');
  app.setNow(NOW);
  assert.ok(Math.abs(o.perWeek + 0.5) < 0.06 && Math.abs(o.avgIntake - 2500) <= 10);
  assert.deepEqual([o.weighIns, o.span, o.foodDays, o.ofDays], [15, 28, 28, 28]);
  assert.deepEqual(app.json('[maintenanceBest().src,maintenanceBest().kcal]'), ['logs', o.kcal]);
  // steady weight: maintenance is what was eaten; gaining: it is below what was eaten
  app = nut(month(2300, 0)); assert.ok(Math.abs(app.json('observedMaintenance()').kcal - 2300) <= 40);
  app = nut(month(3000, 1)); assert.ok(Math.abs(app.json('observedMaintenance()').kcal - 2500) <= 40);
  // kilograms use 7,700 kcal per kg
  app = nut(month(2500, -0.25, { unit: 'kg' })); assert.ok(Math.abs(app.json('observedMaintenance()').kcal - 2775) <= 40);
  // days logged at under half the usual are unfinished logs, not light days
  app = nut(month(2500, -0.5, { half: [3, 9, 15] }));
  o = app.json('observedMaintenance()');
  assert.deepEqual([o.ok, o.dropped, o.foodDays], [true, 3, 25]);
  assert.ok(Math.abs(o.avgIntake - 2500) <= 15, 'the half-logged days do not drag the average down');
});
test('maintenance says what is missing rather than guessing, and falls back to the formula', () => {
  let app = nut();
  let o = app.json('observedMaintenance()');
  assert.deepEqual([o.ok, o.weighOk, o.foodOk], [false, false, false]);
  assert.equal(app.json('maintenanceNeeds(observedMaintenance())').length, 2);
  assert.deepEqual(app.json('[maintenanceBest().src,maintenanceBest().kcal]'), ['formula', app.run('maintenanceKcal(7)')]);
  // plenty of food, three weigh-ins
  const few = month(2500, -0.5); few.bodyweightLog = few.bodyweightLog.slice(0, 3);
  app = nut(few); o = app.json('observedMaintenance()');
  assert.deepEqual([o.ok, o.weighOk, o.foodOk], [false, false, true]);
  assert.match(app.json('maintenanceNeeds(observedMaintenance())')[0], /Weigh-ins: 3 in the last four weeks/);
  // four weigh-ins inside one week
  const close = month(2500, -0.5, { every: 1 }); close.bodyweightLog = close.bodyweightLog.slice(0, 6);
  app = nut(close); o = app.json('observedMaintenance()');
  assert.equal(o.ok, false); assert.match(app.json('maintenanceNeeds(observedMaintenance())')[0], /only 5 days apart/);
  // weigh-ins fine, food logged on too few of those days
  app = nut(month(2500, -0.5, { skip: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] }));
  o = app.json('observedMaintenance()');
  assert.deepEqual([o.ok, o.weighOk, o.foodOk, o.foodDays, o.needFood], [false, true, false, 14, 20]);
  assert.match(app.json('maintenanceNeeds(observedMaintenance())')[0], /Food: logged on 14 of the 28 days between your weigh-ins/);
  // few weigh-ins give a wide margin, and two readings on one day are one weigh-in
  const four = month(2500, -0.5); four.bodyweightLog = four.bodyweightLog.filter((b, i) => [0, 4, 9, 14].includes(i));
  const many = nut(month(2500, -0.5)).json('observedMaintenance()');
  app = nut(four); o = app.json('observedMaintenance()');
  assert.deepEqual([o.ok, o.weighIns], [true, 4]);
  assert.ok(o.margin > many.margin * 1.5, `four weigh-ins: ±${o.margin} against ±${many.margin} with fifteen`);
  const dup = month(2500, -0.5); dup.bodyweightLog = dup.bodyweightLog.filter((b, i) => i === 0 || i === 14); dup.bodyweightLog = dup.bodyweightLog.concat(dup.bodyweightLog.map(b => ({ date: b.date, weight: b.weight + 0.4 })));
  app = nut(dup); o = app.json('observedMaintenance()');
  assert.deepEqual([o.ok, o.weighIns], [false, 2], 'four entries on two dates are two weigh-ins');
  // today's unfinished eating never counts
  app = nut(month(2500, -0.5)); const before = app.json('observedMaintenance()').kcal;
  app.run(`S.meals.push({id:'t',date:today(),type:'Snack',name:'Snack',protein:0,carbs:0,fat:0,cals:150});save()`);
  assert.equal(app.json('observedMaintenance()').kcal, before);
});
test('the targets are judged against maintenance and the weight goal', () => {
  const data = month(2500, -0.5); // maintenance ≈ 2,750
  let app = nut(Object.assign({}, data, { macroGoals: { protein: 180, carbs: 250, fat: 70, cals: 2250 }, weightGoal: 180, weightGoalDir: 'lose' }));
  let v = app.json('maintenanceVerdict()');
  assert.deepEqual([v.tone, v.target, v.at], ['good', 2250, false]);
  assert.ok(Math.abs(v.perWeek + 1) < 0.15, `about a pound a week down (${v.perWeek})`);
  assert.match(v.text, /would take off about 1\.0 lbs a week/);
  app.run(`S.macroGoals.cals=2800;save()`); v = app.json('maintenanceVerdict()');
  assert.equal(v.tone, 'warn'); assert.match(v.text, /at maintenance[\s\S]*too close to maintenance to count on losing/);
  app.run(`S.macroGoals.cals=3100;save()`); v = app.json('maintenanceVerdict()');
  assert.equal(v.tone, 'warn'); assert.match(v.text, /would add about 0\.7 lbs a week\. That will not take weight off/);
  app.run(`S.weightGoalDir='gain';S.macroGoals.cals=2700;save()`); v = app.json('maintenanceVerdict()');
  assert.equal(v.tone, 'warn'); assert.match(v.text, /too close to maintenance to count on gaining/);
  app.run(`S.macroGoals.cals=2300;save()`); assert.match(app.json('maintenanceVerdict()').text, /will not add weight/);
  app.run(`S.macroGoals.cals=3100;save()`); assert.equal(app.json('maintenanceVerdict()').tone, 'good');
  app.run(`S.weightGoalDir='maintain';save()`); assert.equal(app.json('maintenanceVerdict()').tone, 'warn');
  app.run(`S.macroGoals.cals=2750;save()`); assert.equal(app.json('maintenanceVerdict()').tone, 'good');
  // a very fast cut is said out loud
  app.run(`S.weightGoalDir='lose';S.macroGoals.cals=1500;save()`);
  assert.match(app.json('maintenanceVerdict()').text, /faster than 1% of body weight a week/);
  // rest-day targets: the average follows the mix of training and rest days
  app.run(`S.macroGoals.cals=2600;S.restGoals={protein:180,carbs:180,fat:70,cals:2200};save()`);
  assert.equal(app.json('targetAvgKcal()'), 2200, 'no training in two weeks: every day was a rest day');
  const at = n => { const d = new Date(NOW); d.setDate(d.getDate() - n); d.setHours(17, 0, 0, 0); return d.getTime(); };
  app.set('S.workouts', [1, 3, 5, 7, 9, 11, 13].map(n => ({ id: 'w' + n, name: 'W', started: at(n), ended: at(n) + 3e6, exercises: [] })));
  app.run('save()');
  assert.equal(app.json('targetAvgKcal()'), 2400, 'seven training days in fourteen: halfway between the two');
  // the sheets and the row render in both states
  app.run(`go('nutrition');showMaintenance();showMacroGoals()`);
  assert.ok(html(app).includes('From your log') && html(app).includes('showMaintenance()'), html(app).slice(-1500));
  app = nut({ weightGoal: 180, weightGoalDir: 'lose', bodyweight: 190 }); app.run(`go('nutrition');showMaintenance();showMacroGoals()`);
  assert.ok(html(app).includes('Formula'));
  v = app.json('maintenanceVerdict()');
  assert.deepEqual([v.tone, v.formula], ['info', true], 'a formula estimate is never grounds for calling the targets wrong');
  assert.match(v.text, /go by your weight trend/);
});

// ─── The tab ───
test('the Nutrition tab: meals first, suggestions only once something is eaten, nothing duplicated', () => {
  const app = nut({ starredFoods: ['qf_greek_yogurt'], supps: [{ id: 's1', name: 'Creatine', dose: '5 g', timing: 'Morning' }, { id: 's2', name: 'Vitamin <D>', dose: '', timing: '' }],
    meals: [meal('y1', day(1), 'Dinner', 50, 70, 25)] });
  app.run(`go('nutrition')`);
  let h = html(app);
  assert.ok(!h.includes('Fits what’s left'), 'before the first meal there are no "fits" suggestions');
  assert.ok(h.includes('Nothing logged yet today') && h.includes('Copy from yesterday') && h.includes('showCopyDay()'), 'an empty day offers yesterday');
  assert.ok(!h.includes('Quick log') && !h.includes('showLogMacros'), 'the separate Quick log button is gone');
  assert.ok(!/g protein per (lb|kg)/.test(h), 'the protein-per-pound row is gone');
  assert.equal((h.match(/showAddMeal\(\)/g) || []).length, 1);
  // supplements: open while something is still to take, so a tick is one tap
  assert.ok(h.includes('0 of 2 taken today') && h.includes('togSupp(&quot;s1&quot;)') && h.includes('Vitamin &lt;D&gt;') && !h.includes('<D>'));
  app.run(`togSupp('s1');togSupp('s2')`); h = html(app);
  assert.ok(h.includes('All taken today') && !h.includes('togSupp('), 'and folded away once they are all taken');
  app.run(`window._suppOpen=true;renderNutrition(document.getElementById('content'))`);
  assert.ok(html(app).includes('togSupp(&quot;s1&quot;)'), 'it can be opened again');
  app.run(`window._suppOpen=null;S.supps=[];renderNutrition(document.getElementById('content'))`);
  assert.ok(html(app).includes('Track a supplement'));
  // with a meal logged: meals come before the quick-add tiles, which come before the suggestions
  app.run(`S.meals.push(${JSON.stringify(meal('t1', day(0), 'Breakfast', 30, 40, 10, [{ foodId: 'qf_white_rice', name: 'Rice', qty: 1.2658, sg: 158, unit: 'g', serving: '1 cup', protein: 5, carbs: 57, fat: 0.5, cals: 260 }]))});save();renderNutrition(document.getElementById('content'))`);
  h = html(app);
  const at = s => h.indexOf(s);
  assert.ok(at('showAddMeal()') < at('Today’s meals') && at('Today’s meals') < at('Starred') && at('Starred') < at('Fits what’s left') && at('Fits what’s left') < at('plan-card') && at('plan-card') < at('Weight and maintenance'), 'order of the tab');
  assert.ok(h.includes('200 g Rice'), 'a weighed item reads as it was entered');
  assert.ok(h.includes('repeatMeal(&quot;t1&quot;)') && h.includes('Copy from a day'));
  assert.ok(h.includes('id="plan-card"') && h.includes('showMealPlan()') && !h.includes('Build by hand'), 'no meal plan is one quiet row');
  // day totals typed in by hand are still counted and can still be reached
  app.run(`S.macroLogs['${day(0)}']={protein:10,carbs:0,fat:0,cals:300};save();renderNutrition(document.getElementById('content'))`);
  h = html(app);
  assert.ok(h.includes('Day totals entered by hand') && h.includes(`showLogMacros(&quot;${day(0)}&quot;)`));
  assert.match(h, /kcal left · 670 eaten of 2,400/);
  app.run(`S.meals=S.meals.filter(m=>m.id!=='t1');S.macroLogs['${day(0)}'].parked=true;save();renderNutrition(document.getElementById('content'))`);
  h = html(app);
  assert.ok(h.includes('Not counted') && !h.includes('Nothing logged yet today'), 'numbers parked by the upgrade stay reachable');
  // a past day keeps to the point
  app.run(`setNutDay('${day(1)}')`); h = html(app);
  assert.ok(!h.includes('Weight and maintenance') && !h.includes('Fits what’s left') && h.includes('Log this meal again today'));
});

// ─── Sex, age, height and weight ───
test('the formula goes higher for men, lower for women, lower with age, higher with height and weight', () => {
  const base = { unit: 'lbs', bodyweight: 180, height: 70, birthYear: 1996, aftGender: 'male', bodyweightLog: [{ date: day(0), weight: 180 }], profileSet: { sex: true, height: true } };
  const at = over => { const app = nut(Object.assign({}, base, over)); return { bmr: app.run('bmr()'), maint: app.run('maintenanceKcal(7)'), app }; };
  const man = at({}), woman = at({ aftGender: 'female' });
  assert.equal(man.bmr - woman.bmr, 166, 'Mifflin-St Jeor: +5 for a man, −161 for a woman');
  assert.ok([199, 200].includes(man.maint - woman.maint), 'about 200 kcal a day of maintenance at the same size and age');
  assert.equal(man.bmr - at({ birthYear: 1986 }).bmr, 50, 'ten years older is 50 kcal less resting burn');
  assert.ok(at({ height: 74 }).bmr - man.bmr >= 63 && at({ height: 74 }).bmr - man.bmr <= 64, 'four inches taller is about 64 more');
  assert.ok(Math.abs(at({ bodyweight: 200, bodyweightLog: [{ date: day(0), weight: 200 }] }).bmr - man.bmr - 91) <= 1, '20 lb heavier is about 91 more');
  assert.equal(man.app.run('calorieFloor()'), 1500); assert.equal(woman.app.run('calorieFloor()'), 1200);
  assert.equal(man.app.run('profileLine()'), 'a man aged 30, 5 ft 10 in, 180 lbs');
  assert.equal(woman.app.run('profileLine()'), 'a woman aged 30, 5 ft 10 in, 180 lbs');
  assert.deepEqual(man.app.json('profileGaps()'), []);
  // metric
  const kg = nut({ unit: 'kg', bodyweight: 80, height: 70, birthYear: 1996, aftGender: 'female' });
  assert.equal(kg.run('profileLine()'), 'a woman aged 30, 178 cm, 80 kg');
});
test('estimates say which profile facts were never given; setup and Settings record them', () => {
  let app = nut();
  assert.deepEqual(app.json('profileGaps().map(g=>g.k)'), ['sex', 'age', 'height', 'weight']);
  assert.match(app.json('profileGaps()')[0].text, /sex not chosen \(using male\)/);
  assert.match(app.json('profileGaps()')[1].text, /no birth year \(using age 24\)/);
  app.run(`go('nutrition')`);
  assert.ok(html(app).includes('running on defaults') && html(app).includes('sex not chosen'), 'the formula row on the tab says so');
  app.run(`showMaintenance()`);
  // each one closes as it is given
  app.run(`setSex('female')`); assert.deepEqual(app.json('profileGaps().map(g=>g.k)'), ['age', 'height', 'weight']);
  app.run(`S.birthYear=1990;logBodyweight(150)`); assert.deepEqual(app.json('profileGaps().map(g=>g.k)'), ['height']);
  els(app, { 'set-height': { value: '65' }, 'set-byear': { value: '1990' }, 'set-bmonth': { value: '' }, 'set-name': { value: 'A' }, 'set-bw': { value: '' } });
  app.run(`saveSettings()`); assert.deepEqual(app.json('[profileGaps().length,S.height]'), [0, 65]);
  // saves from before this was tracked: female, or a height that is not the default, was somebody's choice
  assert.deepEqual(app.json(`normalizeState({_schema:3,aftGender:'female',height:64}).profileSet`), { sex: true, height: true });
  assert.deepEqual(app.json(`normalizeState({_schema:3,aftGender:'male',height:69}).profileSet`), { sex: false, height: false });
  assert.deepEqual(app.json(`normalizeState({_schema:3,profileSet:{sex:1}}).profileSet`), { sex: true, height: false });
  // first-run setup: sex is asked, and a metric user gives centimetres
  app = loadApp({ now: NOW });
  els(app, { 'ob-name': { value: 'Sam' }, 'ob-bw': { value: '62' }, 'ob-height': { value: '168' }, 'ob-bmonth': { value: '3' }, 'ob-byear': { value: '1998' } });
  app.run(`S=normalizeState({});window._obGoal='general';obUnit('kg');obSex('female');finishOb()`);
  assert.deepEqual(app.json('[S.aftGender,S.profileSet,Math.round(S.height*10)/10,S.unit,profileGaps().length]'), ['female', { sex: true, height: true }, 66.1, 'kg', 0]);
  assert.equal(app.run('heightText()'), '168 cm');
  // skipping sex at setup leaves it flagged, not silently male
  app = loadApp({ now: NOW });
  els(app, { 'ob-name': { value: 'Sam' }, 'ob-bw': { value: '' }, 'ob-height': { value: '' }, 'ob-bmonth': { value: '' }, 'ob-byear': { value: '' } });
  app.run(`S=normalizeState({});window._obGoal='general';window._obSex=null;obUnit('lbs');finishOb()`);
  assert.deepEqual(app.json('profileGaps().map(g=>g.k)'), ['sex', 'age', 'height', 'weight']);
});

// ─── Goals ───
test('Goals fills calories from maintenance for a rate of change, moves carbs to match, and respects the floor', () => {
  const app = nut(Object.assign(month(2500, -0.5), { aftGender: 'male', macroGoals: { protein: 180, carbs: 250, fat: 70, cals: 2400 } })); // maintenance ≈ 2,750
  const maint = app.json('maintenanceBest().kcal');
  assert.deepEqual(app.json('calsForRate(-1)'), { cals: maint - 500, want: maint - 500, floored: false });
  assert.equal(app.json('calsForRate(0).cals'), maint); assert.equal(app.json('calsForRate(0.5).cals'), maint + 250);
  const f = { 'mg-pro': { value: '180' }, 'mg-carb': { value: '250' }, 'mg-fat': { value: '70' }, 'mg-cal': { value: '2400' }, 'mg-pro-note': { style: {}, textContent: '' }, 'mg-cal-note': { style: {}, textContent: '' } };
  els(app, f);
  app.run(`fillCalsFromRate(-1)`);
  assert.equal(f['mg-cal'].value, maint - 500);
  const fromMacros = 180 * 4 + f['mg-carb'].value * 4 + 70 * 9;
  assert.ok(Math.abs(fromMacros - (maint - 500)) <= 10 && f['mg-carb'].value % 5 === 0, `carbs moved to ${f['mg-carb'].value} g so the macros come to ${fromMacros}`);
  assert.deepEqual([f['mg-pro'].value, f['mg-fat'].value], ['180', '70'], 'protein and fat are left alone');
  let c = app.json('goalsCheck()');
  assert.deepEqual([c.mismatch, c.low], [false, false]);
  assert.match(f['mg-pro-note'].textContent, /0\.9\d g per lb of body weight/);
  // a typed calorie number the macros do not add up to is pointed out, not blocked
  f['mg-cal'].value = '3000'; c = app.json('goalsCheck()');
  assert.equal(c.mismatch, true); assert.match(f['mg-cal-note'].textContent, /add up to [\d,]+ kcal, not 3,000/);
  f['mg-pro'].value = '100'; app.run('goalsCheck()'); assert.match(f['mg-pro-note'].textContent, /0\.7 is the usual minimum when lifting/);
  // kilograms: rates in kg, 7,700 kcal per kg
  const kg = nut(Object.assign(month(2500, -0.25, { unit: 'kg' }), {}));
  assert.deepEqual(kg.json('GOAL_RATES().map(r=>r.perWeek)'), [-0.5, -0.25, 0, 0.25]);
  assert.equal(kg.json('calsForRate(-0.5).cals'), kg.json('maintenanceBest().kcal') - 550);
  // the floor: higher for a man than for a woman
  const small = nut({ aftGender: 'female', bodyweight: 110, height: 60, birthYear: 1970, unit: 'lbs' });
  const r = small.json('calsForRate(-1)');
  assert.deepEqual([r.cals, r.floored], [1200, true]); assert.ok(r.want < 1200);
  small.run(`S.aftGender='male';save()`);
  assert.equal(small.json('calsForRate(-2).cals'), 1500);
  els(small, { 'mg-pro': { value: '100' }, 'mg-carb': { value: '100' }, 'mg-fat': { value: '40' }, 'mg-cal': { value: '1400' }, 'mg-pro-note': { style: {}, textContent: '' }, 'mg-cal-note': { style: {}, textContent: '' } });
  assert.equal(small.json('goalsCheck().low'), true);
});

// ─── Scan sheet ───
test('a scanned product: by the serving, by weight from the per-100 g label numbers, and with no serving at all', () => {
  const bar = { name: 'Bar', brand: 'Acme', serving: '1 bar (40g)', servingG: 40, per100: { protein: 25, carbs: 50, fat: 20, cals: 500 }, perServing: { protein: 10, carbs: 20, fat: 8, cals: 200 } };
  const app = nut(); app.set('__p', bar);
  const open = () => { els(app, {}); app.run(`showServingPicker(__p,'4006381333931')`); };
  open();
  assert.deepEqual(app.json('[_amt.scan.unit,_amt.scan.val,_amt.scan.sg,_amt.scan.noServ]'), ['serv', 1, 40, false]);
  assert.deepEqual(app.json(`amtCtlMacros('scan')`), { protein: 10, carbs: 20, fat: 8, cals: 200 });
  // two servings, logged from the sheet in one step
  els(app, { 'scan-qty': { value: '2' } });
  app.run(`logScan('Snack')`);
  let m = app.json('S.meals[0]');
  assert.deepEqual([m.type, m.cals, m.items[0].qty, m.items[0].serving, m.items[0].sg, m.items[0].unit === undefined], ['Snack', 400, 2, '1 bar (40g)', 40, true]);
  assert.deepEqual(app.json('[S.customFoods[0].id,S.customFoods[0].servingG,S.customFoods[0].cals]'), ['cf_4006381333931', 40, 200]);
  // by weight: 150 g uses the label's per-100 g numbers exactly, and reads back as "150 g"
  open(); els(app, { 'scan-qty': { value: '150' }, 'scan-unit': { value: 'g' } });
  const shown = app.json(`amtCtlMacros('scan')`);
  assert.deepEqual(shown, { protein: 37.5, carbs: 75, fat: 30, cals: 750 });
  app.run(`logScan('Lunch')`);
  m = app.json('S.meals[1]');
  assert.deepEqual([m.cals, m.protein, m.items[0].unit, m.items[0].sg], [750, 37.5, 'g', 100], 'what was logged is what the sheet showed');
  assert.equal(app.run(`itemLabel(S.meals[1].items[0])`), '150 g Bar (Acme)');
  assert.equal(app.json(`S.foodUnits.cf_4006381333931`), 'g', 'and the next scan of it starts in grams');
  open(); assert.deepEqual(app.json('[_amt.scan.unit,_amt.scan.val]'), ['g', 40]);
  // only per-100 g numbers on the label: weight only
  app.set('__p', { name: 'Loose Nuts', brand: '', serving: '', servingG: 0, per100: { protein: 20, carbs: 20, fat: 50, cals: 600 }, perServing: { protein: 0, carbs: 0, fat: 0, cals: 0 } });
  els(app, {}); app.run(`S.foodUnits={};showServingPicker(__p,'96385074')`);
  assert.deepEqual(app.json('[_amt.scan.noServ,_amt.scan.unit,_amt.scan.val,_amt.scan.serving]'), [true, 'g', 100, '100g']);
  els(app, { 'scan-qty': { value: '30' } }); app.run(`logScan('Snack')`);
  assert.deepEqual(app.json('[S.meals[2].cals,S.meals[2].items[0].unit]'), [180, 'g']);
  // a serving of unknown weight with per-100 g numbers too: servings by the label, grams by the per-100 g figures
  app.set('__p', { name: 'Cookie', brand: '', serving: '1 cookie', servingG: 0, per100: { protein: 5, carbs: 60, fat: 25, cals: 480 }, perServing: { protein: 1, carbs: 12, fat: 5, cals: 96 } });
  els(app, {}); app.run(`showServingPicker(__p,'036000291452')`);
  assert.deepEqual(app.json('[_amt.scan.unit,_amt.scan.sg,amtCanWeigh(_amt.scan)]'), ['serv', 0, true]);
  els(app, { 'scan-qty': { value: '50' }, 'scan-unit': { value: 'g' } });
  assert.equal(app.json(`amtCtlMacros('scan').cals`), 240);
  // in an open meal the product joins the meal instead of being logged
  const n = app.json('S.meals.length');
  app.run(`showAddMeal();window._scanReturnToMeal=true`);
  els(app, { 'meal-ov': {}, 'scan-qty': { value: '2' } });
  app.set('__p', bar); app.run(`S.foodUnits={};showServingPicker(__p,'4006381333931')`);
  els(app, { 'meal-ov': {}, 'scan-qty': { value: '2' } });
  app.run(`addScannedFood()`);
  assert.deepEqual(app.json('[S.meals.length,_mealItems.length,_mealItems[0].qty,mealItemTotals(_mealItems[0]).cals]'), [n, 1, 2, 400]);
  // tapping that food in the list adds a serving to the same line
  app.run(`addFoodToMeal('cf_4006381333931')`);
  assert.deepEqual(app.json('[_mealItems.length,_mealItems[0].qty]'), [1, 3]);
});

// ─── The tab, again ───
test('the tab shows seven days as bars against each day’s target, and one line for a meal with one entry', () => {
  const meals = [meal('a', day(1), 'Dinner', 150, 250, 70), meal('b', day(3), 'Dinner', 100, 100, 30), meal('c', day(0), 'Lunch', 40, 50, 10), meal('d', day(0), 'Snack', 10, 10, 2), meal('e', day(0), 'Snack', 10, 10, 2)];
  const app = nut({ meals });
  app.run(`go('nutrition')`);
  let h = html(app);
  assert.ok(h.includes('Last seven days') && !h.includes('Recent days'));
  assert.equal((h.match(/class="nd-d/g) || []).length, 7, 'seven days, logged or not');
  assert.ok(h.includes(`setNutDay(&quot;${day(1)}&quot;)`) && h.includes(`setNutDay(&quot;${day(5)}&quot;)`), 'every day opens, including one with nothing logged');
  assert.match(h, /2,230 kcal, 170 under target/); assert.match(h, /nothing logged/);
  // 2,230 of 2,400 is 93%: under; bar height is 93% of the 125% track
  assert.match(h, /<i class="under" style="height:74%"><\/i>/);
  app.run(`S.meals.push(${JSON.stringify(meal('f', day(2), 'Dinner', 160, 260, 80))});save();setNutDay('${day(2)}')`);
  h = html(app);
  assert.match(h, /class="nd-d sel"[^>]*setNutDay\(&quot;[^&]*&quot;\)[^>]*aria-label="[^"]*2,400 kcal, 0 over target/);
  assert.match(h, /<i class="on" style="height:80%">/, 'on target sits at the line');
  app.run(`S.meals=S.meals.filter(m=>m.date>='${day(0)}');save();setNutDay(null)`);
  h = html(app);
  assert.ok(!h.includes('Last seven days'), 'no strip when the week is empty');
  // one Lunch: a single row carrying the meal's name; two Snacks: a header with their total
  assert.match(h, /<span class="meal-type">Lunch<\/span>/);
  assert.ok(!/<div class="meal-head"><b>Lunch<\/b>/.test(h) && /<div class="meal-head"><b>Snack<\/b><span>196 kcal/.test(h));
});

// ─── Supplements ───
test('adding a supplement: always offered, added on Return or the button, and shown straight away', () => {
  const app = nut({ supps: [{ id: 's1', name: 'Creatine', dose: '5 g', timing: 'Morning' }], suppLogs: { [day(0)]: { s1: true } } });
  app.run(`go('nutrition')`);
  let h = html(app);
  assert.ok(h.includes('All taken today') && !h.includes('togSupp('), 'folded: everything is taken');
  assert.ok(h.includes('id="supp-add"') && h.includes('showAddSupp()'), 'the Add button is there even when the list is folded');
  // nothing typed: refused, nothing added
  els(app, { sn: { value: '   ', focus() {} }, sd: { value: '' }, st: { value: '' } });
  app.run(`showAddSupp();addSupp()`);
  assert.equal(app.json('S.supps.length'), 1);
  els(app, { sn: { value: '  Fish Oil <b> ', focus() {} }, sd: { value: ' 2 caps ' }, st: { value: 'Evening' } });
  app.run(`addSupp()`);
  assert.deepEqual(app.json('S.supps[1]').name, 'Fish Oil <b>');
  assert.deepEqual([app.json('S.supps[1]').dose, app.json('S.supps[1]').timing, typeof app.json('S.supps[1]').id], ['2 caps', 'Evening', 'string']);
  h = html(app);
  assert.ok(h.includes('Fish Oil &lt;b&gt;') && !h.includes('Fish Oil <b>') && h.includes('1 of 2 taken today') && h.includes('togSupp('), 'the list opens on the new supplement, name escaped');
  // the sheet itself: the button shares a line with the name, and Return adds
  const sheet = app.run(`(()=>{let out='';const real=document.body.appendChild;document.body.appendChild=o=>{out=o.innerHTML;return o;};showAddSupp();document.body.appendChild=real;return out;})()`);
  assert.match(sheet, /<div class="supp-new"><input id="sn"[^>]*enterkeyhint="done"[^>]*>\s*<button class="btn btp" id="supp-save" onclick="addSupp\(\)">Add<\/button><\/div>/);
  assert.match(sheet, /event\.key==='Enter'/);
  // first supplement ever
  const fresh = nut(); fresh.run(`go('nutrition')`);
  assert.ok(html(fresh).includes('Track a supplement') && html(fresh).includes('showAddSupp()'));
  els(fresh, { sn: { value: 'Vitamin D', focus() {} }, sd: { value: '' }, st: { value: '' } });
  fresh.run(`addSupp()`);
  assert.ok(html(fresh).includes('Vitamin D') && html(fresh).includes('0 of 1 taken today'));
});
