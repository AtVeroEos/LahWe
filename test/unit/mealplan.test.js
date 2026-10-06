'use strict';
// Weekly meal plan: the data shape, totals, one-tap logging and the grocery list.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

// 2026-06-15 is a Monday → getDay() === 1
const item = (foodId, qty) => ({ food_id: foodId, servings: qty });
function planned(app) {
  app.set('__d', [
    { food_id: 'qf_egg', servings: 3 },
    { name: 'Protein shake', serving: '1 scoop', kcal: 120, protein: 24, carbs: 3, fat: 1.5, servings: 1 },
  ]);
  const r = app.json('resolveFoodItems(__d)');
  app.set('__items', r.items);
  app.run(`S.mealPlan.days[1].push(cleanPlanMeal({type:'Breakfast',name:'Eggs and shake',items:__items}));
           S.mealPlan.days[3].push(cleanPlanMeal({type:'Dinner',name:'More eggs',items:[__items[0]]}));`);
  return r;
}

test('items: food-list numbers win over whatever was supplied; unknown foods need their own numbers', () => {
  const app = loadApp();
  app.set('__d', [
    { food_id: 'qf_egg', servings: 2, kcal: 9999, protein: 999 },
    { name: 'egg (large)' },                       // exact name, no numbers → the list entry
    { name: 'Homemade chili', serving: '1 bowl', kcal: 420, protein: 30, carbs: 35, fat: 18, servings: 1.5 },
    { name: 'Mystery stew' },                      // not in the list and no numbers
    { food_id: 'qf_does_not_exist' },
    { name: 'Bad maths', kcal: 900, protein: 10, carbs: 10, fat: 10 },   // 210 kcal of macros
    { name: 'Too many', kcal: 100, protein: 5, carbs: 10, fat: 4, servings: 99 },
    { name: 'Negative', kcal: 100, protein: -5, carbs: 10, fat: 4 },
  ]);
  const r = app.json('resolveFoodItems(__d)');
  assert.equal(r.items.length, 3);
  assert.deepEqual([r.items[0].foodId, r.items[0].qty, r.items[0].cals, r.items[0].protein], ['qf_egg', 2, 72, 6]);
  assert.equal(r.items[1].foodId, 'qf_egg');
  assert.deepEqual([r.items[2].foodId, r.items[2].est, r.items[2].qty, r.items[2].cals], [null, true, 1.5, 420]);
  assert.equal(r.errors.length, 5);
  assert.match(r.errors[0], /Mystery stew: not in the food list/);
  assert.match(r.errors[1], /no food with id "qf_does_not_exist"/);
  assert.match(r.errors[2], /900 kcal does not fit/);
  assert.match(r.errors[3], /servings must be between/);
  assert.match(r.errors[4], /sensible gram amounts/);
  // calories are worked out from the macros when they are left off
  app.set('__d', [{ name: 'Rice bowl', protein: 10, carbs: 50, fat: 5 }]);
  assert.equal(app.json('resolveFoodItems(__d)').items[0].cals, 285);
});
test('plan totals multiply servings once, and a stored plan survives a save/load round trip', () => {
  const app = loadApp();
  planned(app);
  assert.deepEqual(app.json('planMealTotals(S.mealPlan.days[1][0])'), { protein: 42, carbs: 4.8, fat: 16.5, cals: 336 });
  assert.deepEqual(app.json('planDayTotals(S.mealPlan.days[3])'), { protein: 18, carbs: 1.8, fat: 15, cals: 216 });
  assert.equal(app.run('planHasMeals()'), true);
  const back = app.json('normalizeMealPlan(JSON.parse(JSON.stringify(S.mealPlan)))');
  assert.deepEqual(back.days.map(d => d.length), [0, 1, 0, 1, 0, 0, 0]);
  assert.equal(back.days[1][0].items[1].est, true);
  // junk in, valid empty plan out
  for (const bad of ['null', '42', '{days:"x"}', '{days:[[{type:"Lunch",items:[]}],[{nope:1}]]}']) assert.deepEqual(app.json(`normalizeMealPlan(${bad})`).days.map(d => d.length), [0, 0, 0, 0, 0, 0, 0], bad);
  assert.equal(app.json(`normalizeMealPlan({days:[[{type:'Brunch',items:[{name:'x',cals:100}]}]]})`).days[0][0].type, 'Snack', 'unknown meal slot falls back');
});
test('logging a planned meal writes a normal meal entry, marks it logged for that day only, and can be undone', () => {
  const app = loadApp();
  planned(app);
  const id = app.run('S.mealPlan.days[1][0].id');
  app.set('__id', id);
  const e = app.json('logPlanMeal(1,__id)');
  assert.deepEqual([e.date, e.type, e.savedMealName, e.planMealId, e.cals, e.protein], ['2026-06-15', 'Breakfast', 'Eggs and shake', id, 336, 42]);
  assert.deepEqual(e.items.map(i => [i.name, i.qty, i.cals]), [['Egg (large)', 3, 216], ['Protein shake', 1, 120]], 'item numbers are multiplied out, as in every logged meal');
  assert.equal(app.json('getDayTotals(today())').cals, 336);
  assert.equal(app.run('planMealLogged(__id,today())'), true);
  assert.equal(app.run('planMealLogged(__id,daysAgoStr(1))'), false);
  assert.deepEqual(app.json('S.recentFoods'), ['qf_egg'], 'only real foods are remembered as recent');
  assert.equal(app.run(`logPlanMeal(1,'nope')`), null);
  // the plan itself is untouched by logging
  assert.equal(app.run('S.mealPlan.days[1][0].items[0].cals'), 72);
});
test('the meal builder saves into the plan when asked, and edits replace in place', () => {
  const app = loadApp();
  app.run(`window._mealTarget={plan:2}`);
  app.set('__it', [{ foodId: 'qf_egg', name: 'Egg (large)', qty: 2, serving: '1 egg', protein: 6, carbs: 0.6, fat: 5, cals: 72 }]);
  assert.equal(app.run(`planSaveFromBuilder('Lunch',__it)`), true);
  const id = app.run('S.mealPlan.days[2][0].id');
  assert.equal(app.run('S.meals.length'), 0, 'nothing was logged');
  app.set('__it2', [{ foodId: 'qf_egg', name: 'Egg (large)', qty: 4, serving: '1 egg', protein: 6, carbs: 0.6, fat: 5, cals: 72 }]);
  app.run(`window._mealTarget={plan:2,replace:${JSON.stringify(id)}}`);
  assert.equal(app.run(`planSaveFromBuilder('Dinner',__it2)`), true);
  assert.deepEqual(app.json('S.mealPlan.days[2].map(m=>[m.id,m.type,m.items[0].qty])'), [[id, 'Dinner', 4]]);
  assert.ok(app.run('S.mealPlan.updatedAt') > 0);
  app.run(`window._mealTarget=null`);
  assert.equal(app.run(`planSaveFromBuilder('Lunch',__it)`), false, 'without a target the builder logs as usual');
});
test('grocery list adds the same food across days and writes sensible amounts', () => {
  const app = loadApp();
  planned(app);
  app.set('__more', app.json(`resolveFoodItems([{food_id:'qf_chicken_breast',servings:5},{food_id:'qf_egg',servings:2}])`).items);
  app.run(`S.mealPlan.days[5].push(cleanPlanMeal({type:'Lunch',name:'x',items:__more}))`);
  const g = app.json('planGrocery()');
  const egg = g.find(x => x.name === 'Egg (large)');
  assert.deepEqual([egg.qty, egg.meals, egg.amount], [8, 3, '8 eggs']);
  assert.ok(g.every((x, i) => i === 0 || g[i - 1].name.toLowerCase() <= x.name.toLowerCase()), 'alphabetical');
  assert.equal(g.length, 3);
  const amt = (q, s) => app.run(`groceryAmount(${q},${JSON.stringify(s)})`);
  assert.equal(amt(5, '4 oz'), '1.3 lb (20 oz)');
  assert.equal(amt(3, '4 oz'), '12 oz');
  assert.equal(amt(7, '½ cup'), '3.5 cups');
  assert.equal(amt(4, '1/2 cup'), '2 cups');
  assert.equal(amt(6, '200g'), '1.2 kg');
  assert.equal(amt(2, '1 medium'), '2 medium');
  assert.equal(amt(2.5, 'handful'), '2.5 × handful');
  assert.equal(amt(1, ''), '1 serving');
  // ticks survive, and ticks for things no longer planned are forgotten when the list is drawn
  app.run(`S.mealPlan.checked[${JSON.stringify(egg.key)}]=true;S.mealPlan.checked['gone|x']=true`);
  assert.match(app.run('groceryText()'), /\[x\] Egg \(large\) — 8 eggs/);
});
test('the plan, the coach notes and the AI choices are part of a backup; the chat is not', () => {
  const app = loadApp();
  planned(app);
  app.run(`S.coachNotes.push({id:'n1',text:'Left shoulder: no overhead pressing',at:1});S.ai.provider='gemini';S.ai.models.gemini='gemini-3.8-flash';
           localStorage.setItem('lahwe_coach_v1','{"v":1,"turns":[{"role":"user","text":"private chat line"}]}')`);
  const bk = JSON.parse(app.run('backupJSON()'));
  assert.equal(bk.mealPlan.days[1][0].name, 'Eggs and shake');
  assert.equal(bk.coachNotes[0].text, 'Left shoulder: no overhead pressing');
  assert.deepEqual(bk.ai, { provider: 'gemini', models: { gemini: 'gemini-3.8-flash' }, logAccess: true, instant: true });
  assert.ok(!JSON.stringify(bk).includes('private chat line'));
  app.set('__bk', bk); app.run('replaceState(__bk)');
  assert.equal(app.run('S.mealPlan.days[1][0].items.length'), 2);
  assert.equal(app.run('S.coachNotes.length'), 1);
});
test('a save from before meal plans existed loads with an empty plan and default AI settings', () => {
  const app = loadApp();
  app.set('__old', { onboarded: true, _schema: 3, name: 'Old', aiModel: 'claude-opus-5-5', tab: 'coach' });
  app.run('replaceState(__old)');
  assert.deepEqual(app.json('S.mealPlan.days.map(d=>d.length)'), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(app.json('S.ai'), { provider: 'anthropic', models: { anthropic: 'claude-opus-5-5' }, logAccess: true, instant: true });
  assert.deepEqual(app.json('S.coachNotes'), []);
  assert.equal(app.run('S.tab'), 'coach', 'the new tab is a valid place to reopen');
});
