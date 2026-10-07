'use strict';
// Any-kind foods ("Steak, 8 oz"): numbers worked out from the cuts in the list, the lean / fatty and
// raw / cooked switches, the remembered choice, amounts typed into the search, and cooking fat.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-06-15T18:30:00';
const fresh = over => { const app = loadApp({ now: NOW }); app.state(Object.assign({ tab: 'nutrition', macroGoals: { protein: 180, carbs: 250, fat: 70, cals: 2400 } }, over || {})); return app; };
const food = (app, id) => app.json(`findFood(${JSON.stringify(id)})`);
const split = (app, q) => app.json(`splitFoodQuery(${JSON.stringify(q)})`);
const names = (app, q) => app.json(`searchFoods(${JSON.stringify(q)}).map(f=>f.name)`);

test('an any-kind food is worked out from its members, never typed in twice', () => {
  const app = fresh();
  const kinds = app.json('FOOD_KINDS');
  assert.ok(kinds.length >= 10);
  for (const k of kinds) {
    const ms = k.of.map(id => food(app, id));
    assert.ok(ms.every(Boolean), `${k.id}: every member is in the list`);
    assert.equal(new Set(ms.map(m => m.serving)).size, 1, `${k.id}: members share a serving, so an average means something`);
    const g = food(app, k.id);
    assert.ok(g && g.name === k.name && g.serving === ms[0].serving, k.id);
    const lo = Math.min(...ms.map(m => m.cals)), hi = Math.max(...ms.map(m => m.cals));
    assert.ok(g.cals >= lo && g.cals <= hi, `${k.id}: ${g.cals} kcal sits between its members (${lo}–${hi})`);
    if (k.labels) {
      assert.equal(k.labels.length, 3);
      assert.ok(food(app, k.id + '~lean').cals <= g.cals && food(app, k.id + '~fatty').cals >= g.cals, `${k.id}: lean ≤ average ≤ fatty`);
    } else assert.equal(food(app, k.id + '~lean').id, k.id, `${k.id}: no switch, so no lean kind`);
  }
  // steak: the four cuts are 162, 180, 200 and 240 kcal for 4 oz
  const s = food(app, 'g_steak');
  assert.deepEqual([s.cals, s.protein, s.fat, s.serving], [196, 26, 10, '4 oz']);
  assert.deepEqual([food(app, 'g_steak~lean').cals, food(app, 'g_steak~lean').name], [162, 'Steak, lean']);
  assert.deepEqual([food(app, 'g_steak~fatty').cals, food(app, 'g_steak~fatty').name], [240, 'Steak, fatty']);
  // rice: the members' cups weigh different amounts, so the average is taken per gram
  const r = food(app, 'g_rice');
  assert.equal(app.run(`servingGrams(findFood('g_rice'))`), 168);
  assert.ok(Math.abs(r.cals - 211) <= 1);
  // milk's middle is a real milk, not an average of three
  assert.deepEqual([food(app, 'g_milk').cals, food(app, 'g_milk~lean').name, food(app, 'g_milk~fatty').cals], [125, 'Milk, skim', 150]);
  // correcting a cut corrects the generic (after the cache is dropped, as a new build would)
  app.run(`QUICK_FOODS.find(f=>f.id==='qf_ribeye').cals=280;_genericFoods=null`);
  assert.equal(food(app, 'g_steak').cals, 206);
});

test('raw or cooked, cooked or dry: the same weight, different numbers', () => {
  const app = fresh();
  // meat loses about a quarter of its weight in cooking, fish about a fifth
  const raw = food(app, 'qf_sirloin'), ck = food(app, 'qf_sirloin~alt');
  assert.deepEqual([ck.name, ck.serving, ck.cals, ck.protein], ['Sirloin Steak, cooked', '4 oz cooked', Math.round(raw.cals / 0.75), Math.round(raw.protein / 0.75 * 10) / 10]);
  assert.equal(app.run(`servingGrams(findFood('qf_sirloin~alt'))`), app.run(`servingGrams(findFood('qf_sirloin'))`));
  assert.equal(food(app, 'qf_cod~alt').cals, Math.round(93 / 0.8));
  assert.deepEqual([food(app, 'g_steak~fatty~alt').name, food(app, 'g_steak~fatty~alt').cals], ['Steak, fatty, cooked', 320]);
  assert.equal(food(app, 'g_steak~alt~lean').id, 'g_steak~lean~alt'); // one spelling per kind
  // rice and pasta are listed cooked; dry is by weight, per 100 g
  assert.deepEqual([food(app, 'g_rice~alt').name, food(app, 'g_rice~alt').serving, food(app, 'g_rice~alt').cals], ['Rice (dry)', '100 g dry', 365]);
  assert.deepEqual([food(app, 'qf_pasta~alt').name, food(app, 'qf_pasta~alt').cals, app.run(`servingGrams(findFood('qf_pasta~alt'))`)], ['Pasta (dry)', 371, 100]);
  // a food with no such switch ignores it; something that is not a food is nothing
  assert.equal(food(app, 'qf_egg~alt').id, 'qf_egg');
  assert.equal(food(app, 'qf_banana~lean~alt').id, 'qf_banana');
  assert.equal(food(app, 'nope~alt'), null);
  assert.equal(food(app, ''), null);
  // what each food offers
  assert.deepEqual(app.json(`[foodTraits('g_steak'),foodTraits('qf_ribeye'),foodTraits('g_rice'),foodTraits('qf_egg'),foodTraits('qf_banana')].map(t=>[!!t.rich,t.state?t.state.labels.join('/'):'',t.fat])`),
    [[true, 'Raw/Cooked', true], [false, 'Raw/Cooked', true], [false, 'Cooked/Dry', false], [false, '', true], [false, '', false]]);
  // a food of the user's own whose id happens to contain the separator is still found, exactly
  const own = fresh({ customFoods: [{ id: 'cf_a~alt', name: 'Odd', serving: '1 bar', protein: 1, carbs: 2, fat: 3, cals: 39 }] });
  assert.equal(food(own, 'cf_a~alt').name, 'Odd');
});

test('the kind last used comes back, per food', () => {
  const app = fresh();
  assert.equal(app.run(`preferredFoodId('g_steak')`), 'g_steak');
  app.run(`rememberFoodKind('g_steak~lean~alt')`);
  assert.equal(app.run(`preferredFoodId('g_steak')`), 'g_steak~lean~alt');
  assert.equal(app.run(`preferredFoodId('g_steak~fatty')`), 'g_steak~fatty'); // an id that already says which kind is left alone
  assert.equal(app.run(`preferredFoodId('g_chicken')`), 'g_chicken');
  app.run(`rememberFoodKind('g_steak')`); // back to plain
  assert.equal(app.json('S.foodKinds').g_steak, undefined);
  // the unit follows the food, whichever kind of it
  app.run(`rememberFoodUnit('g_steak~alt','oz')`);
  assert.equal(app.run(`foodUnit(findFood('g_steak'))`), 'oz');
  assert.equal(app.run(`foodUnit(findFood('g_steak~lean'))`), 'oz');
  // a restored backup cannot plant anything else in there
  const b = fresh({ foodKinds: { g_steak: 'lean~alt', g_fish: 'alt', a: '<img>', b: 5, c: 'alt~lean', d: null } });
  assert.deepEqual(b.json('S.foodKinds'), { g_steak: 'lean~alt', g_fish: 'alt' });
  assert.deepEqual(fresh({ foodKinds: 'x' }).json('S.foodKinds'), {});
});

test('an amount typed with the name is read; a ratio or a household measure is not mistaken for one', () => {
  const app = fresh();
  const amt = q => { const r = split(app, q); return [r.text, r.amt ? r.amt.val + ' ' + r.amt.unit : null]; };
  assert.deepEqual(amt('steak 8 oz'), ['steak', '8 oz']);
  assert.deepEqual(amt('8oz steak'), ['steak', '8 oz']);
  assert.deepEqual(amt('200g rice'), ['rice', '200 g']);
  assert.deepEqual(amt('rice 200 grams'), ['rice', '200 g']);
  assert.deepEqual(amt('1.5 lb chicken'), ['chicken', '24 oz']);
  assert.deepEqual(amt('½ lb steak'), ['steak', '8 oz']);
  assert.deepEqual(amt('0,5 kg rice'), ['rice', '500 g']);
  assert.deepEqual(amt('2 eggs'), ['eggs', '2 serv']);
  assert.deepEqual(amt('eggs x2'), ['eggs', '2 serv']);
  assert.deepEqual(amt('1/2 avocado'), ['avocado', '0.5 serv']);
  // part of the name
  assert.deepEqual(amt('90/10 beef'), ['90/10 beef', null]);
  assert.deepEqual(amt('2% milk'), ['2% milk', null]);
  assert.deepEqual(amt('steak'), ['steak', null]);
  assert.deepEqual(amt(''), ['', null]);
  // "2 tbsp peanut butter" is one serving, not two: the measure is dropped and no amount is assumed
  assert.deepEqual(amt('2 tbsp peanut butter'), ['peanut butter', null]);
  assert.deepEqual(amt('1 1/2 cup rice'), ['rice', null]);
  // nothing absurd
  assert.deepEqual(amt('9000 oz steak'), ['9000 oz steak', null]);
  assert.deepEqual(amt('400 eggs'), ['400 eggs', null]);
});

test('search: the any-kind entry leads, a plural finds the singular, a whole word beats a prefix', () => {
  const app = fresh();
  assert.equal(names(app, 'steak')[0], 'Steak');
  assert.ok(names(app, 'steak').includes('Ribeye Steak'), 'the cuts are still there underneath');
  assert.equal(names(app, 'chicken')[0], 'Chicken');
  assert.equal(names(app, 'rice')[0], 'Rice (cooked)');
  assert.equal(names(app, 'fish')[0], 'Fish');
  assert.equal(names(app, 'eggs')[0], 'Egg (large)');
  assert.ok(names(app, 'eggs').indexOf('Eggplant') > names(app, 'eggs').indexOf('Egg White'));
  assert.equal(names(app, 'steaks')[0], 'Steak');
  assert.deepEqual(names(app, 'zzzz'), []);
  assert.ok(app.run('allFoods().length') > app.run('QUICK_FOODS.length'));
});

test('the meal builder: a typed amount, switching the kind, and what it was cooked in', () => {
  const app = fresh();
  // "steak 8 oz", then a tap
  app.run(`showAddMeal();window._mealAmt={unit:'oz',val:8};addFoodToMeal('g_steak')`);
  let it = app.json('_mealItems[0]');
  assert.deepEqual([it.foodId, it.name, it.unit, app.run(`itemAmt(_mealItems[0])`), app.json('mealItemTotals(_mealItems[0])').cals], ['g_steak', 'Steak', 'oz', '8 oz', 392]);
  // cooked: the 8 oz stays 8 oz, the numbers move
  app.run(`mealItemKind(0,'g_steak~alt')`);
  it = app.json('_mealItems[0]');
  assert.deepEqual([it.foodId, it.name, app.run(`itemAmt(_mealItems[0])`), app.json('mealItemTotals(_mealItems[0])').cals], ['g_steak~alt', 'Steak, cooked', '8 oz', 522]);
  app.run(`mealItemKind(0,'g_steak~lean~alt')`);
  assert.equal(app.json('mealItemTotals(_mealItems[0])').cals, 432);
  assert.equal(app.json('S.foodKinds').g_steak, 'lean~alt');
  // the next time "steak" is picked it comes as it was left, and the same line is added to
  app.run(`window._mealAmt={unit:'oz',val:4};addFoodToMeal('g_steak')`);
  assert.equal(app.run('_mealItems.length'), 1);
  assert.equal(app.run(`itemAmt(_mealItems[0])`), '12 oz');
  // a count of servings stays a count
  app.run(`window._mealAmt={unit:'serv',val:2};addFoodToMeal('qf_egg')`);
  assert.deepEqual([app.json('_mealItems[1]').qty, app.json('_mealItems[1]').unit], [2, undefined]);
  // rice by the cup, switched to dry, keeps the count; weighed rice keeps the weight
  app.run(`window._mealAmt=null;addFoodToMeal('g_rice');mealItemKind(2,'g_rice~alt')`);
  assert.deepEqual([app.json('_mealItems[2]').name, app.json('_mealItems[2]').qty, app.json('_mealItems[2]').serving], ['Rice (dry)', 1, '100 g dry']);
  app.run(`mealItemKind(2,'g_rice');mealItemUnit(2,'g');_mealItems[2].qty=amtToQty(200,'g',168);mealItemKind(2,'g_rice~alt')`);
  assert.deepEqual([app.run(`itemAmt(_mealItems[2])`), app.json('mealItemTotals(_mealItems[2])').cals], ['200 g', 730]);
  // a weight typed for something that has none goes in as a serving
  app.run(`window._mealAmt={unit:'oz',val:8};addFoodToMeal('g_bread')`);
  assert.deepEqual([app.json('_mealItems[3]').qty, app.json('_mealItems[3]').unit], [1, undefined]);
  // cooking fat is its own line, a teaspoon a tap
  app.run(`window._mealAmt=null;mealAddFat('g_cook_oil');mealAddFat('g_cook_oil');mealAddFat('g_cook_butter')`);
  assert.deepEqual(app.json(`_mealItems.slice(4).map(it=>[it.foodId,it.qty,mealItemTotals(it).cals])`), [['g_cook_oil', 2, 80], ['g_cook_butter', 1, 34]]);
  // and all of it logs and reads back
  app.run(`doSaveMealWithType('Dinner')`);
  const m = app.json('S.meals[S.meals.length-1]');
  assert.equal(m.items.length, 6);
  assert.equal(m.items[0].name, 'Steak, lean, cooked');
  assert.equal(m.cals, m.items.reduce((t, x) => t + x.cals, 0));
  assert.ok(app.json('S.recentFoods').includes('g_steak~lean~alt'));
  assert.ok(app.run(`!!findFood(S.recentFoods[0])`));
});

test('quick log: the switches keep the amount, and the fat is logged beside the food', () => {
  const app = fresh();
  app.run(`quickLogFood('g_chicken')`);
  assert.equal(app.run(`_pendingQuickLog.food.id`), 'g_chicken');
  app.run(`_amt.ql.unit='oz';_amt.ql.val=6;quickLogKind('g_chicken~fatty')`);
  assert.deepEqual(app.json(`[_pendingQuickLog.food.id,_amt.ql.unit,_amt.ql.val]`), ['g_chicken~fatty', 'oz', 6]);
  app.run(`quickLogFat('g_cook_butter')`);
  assert.deepEqual(app.json(`[_pendingQuickLog.food.id,_pendingQuickLog.fat,_amt.ql.val,_amt.ql.add.cals]`), ['g_chicken~fatty', 'g_cook_butter', 6, 34]);
  app.run(`quickLogKind('g_chicken~fatty~alt')`); // switching the kind does not drop the fat
  assert.equal(app.run(`_pendingQuickLog.fat`), 'g_cook_butter');
  app.run(`doQuickLog('Dinner')`);
  const m = app.json('S.meals[S.meals.length-1]');
  assert.deepEqual(m.items.map(x => x.name), ['Chicken, fatty, cooked', 'Butter (for cooking)']);
  assert.equal(m.items[0].unit, 'oz');
  assert.equal(m.cals, Math.round(232 * 1.5) + 34); // 6 oz of a 4 oz serving at 174 / 0.75 kcal, plus the butter
  assert.equal(app.json('S.foodKinds').g_chicken, 'fatty~alt');
  // next time it opens the way it was left; "No added fat" is the default again
  app.run(`quickLogFood('g_chicken')`);
  assert.deepEqual(app.json(`[_pendingQuickLog.food.id,_pendingQuickLog.fat]`), ['g_chicken~fatty~alt', '']);
  // a food with no switches is untouched by all this
  app.run(`quickLogFood('qf_banana');doQuickLog('Snack')`);
  assert.equal(app.json('S.meals[S.meals.length-1]').items.length, 1);
});
