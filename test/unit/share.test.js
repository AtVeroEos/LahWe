'use strict';
// 3.22: the grocery list and the meal plan as plain text for a message, and how sharing falls back
// when there is no share sheet.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const egg = n => ({ foodId: 'qf_egg', name: 'Egg (large)', qty: n, serving: '1 egg', protein: 6, carbs: 0.6, fat: 5, cals: 72 });
const banana = { foodId: 'qf_banana', name: 'Banana', qty: 2, serving: '1 medium', protein: 1.3, carbs: 27, fat: 0.4, cals: 105 };
const pm = (id, type, items, name) => ({ id, type, name: name || '', items });
const plan = () => {
  const app = loadApp({ now: '2026-06-17T09:00:00' }); // a Wednesday
  app.state({ tab: 'nutrition' });
  app.run(`S.mealPlan.dated={'2026-06-18':[${JSON.stringify(pm('a', 'Breakfast', [egg(3)], 'Big eggs'))}]};
    S.mealPlan.days[1]=[${JSON.stringify(pm('b', 'Lunch', [banana]))}];
    S.mealPlan.fastOn={'2026-06-20':'full'};
    S.mealPlan.extras=[{id:'c',name:'Coffee'}]`);
  return app;
};

test('the grocery list reads like a text: a dated heading, aisles, bullets, and only what is left', () => {
  const app = plan();
  app.run('window._grocWeek=0');
  const t = app.run('groceryText()');
  assert.match(t, /^🛒 Groceries · Jun 17 – Jun 21/);
  assert.match(t, /\n• Egg[^\n]* — 3/);
  assert.match(t, /\n\nAlso\n• Coffee$/);
  assert.doesNotMatch(t, /\[ \]|\[x\]|Banana/, 'no checkbox marks, and next Monday’s lunch is not this week’s shopping');
  const eggKey = app.json(`planGrocery().find(x=>/Egg/.test(x.name)).key`);
  app.run(`S.mealPlan.checked[${JSON.stringify(eggKey)}]=true`);
  assert.doesNotMatch(app.run('groceryText()'), /Egg/, 'ticked things are left out');
  app.run(`S.mealPlan.checked['x:c']=true`);
  const all = app.run('groceryText()');
  assert.match(all, /Egg/); assert.match(all, /Coffee/, 'when everything is ticked, the whole list goes');
  app.run('window._grocWeek=1');
  assert.match(app.run('groceryText()'), /Jun 22 – Jun 28[\s\S]*Banana/);
});

test('the meal plan goes day by day from today, with what is in each meal, fasts noted and calories optional', () => {
  const app = plan();
  const t = app.run('mealPlanText(0)');
  assert.match(t, /^🍽️ Meal plan · Jun 17 – Jun 21/, 'days already gone are left out');
  assert.match(t, /THURSDAY, JUN 18 · 216 kcal\nBreakfast: Big eggs\n  • Egg \(large\) — 3 eggs\n/);
  assert.match(t, /SATURDAY, JUN 20 · fast/);
  assert.doesNotMatch(t, /FRIDAY/, 'an empty day is skipped');
  const nk = app.run('mealPlanText(1,{kcal:false})');
  assert.match(nk, /Jun 22 – Jun 28/);
  assert.match(nk, /MONDAY, JUN 22\nLunch: Banana — 2 medium(\n|$)/, 'a one-food meal is one line');
  assert.doesNotMatch(nk, /kcal/);
  const empty = loadApp({ now: '2026-06-17T09:00:00' }); empty.state({});
  assert.match(empty.run('mealPlanText(0)'), /Nothing planned yet\./);
});

test('sharing opens the share sheet; with none it copies, and failing that saves a file', async () => {
  const app = plan();
  app.run(`window.__toasts=[];toast=(m)=>window.__toasts.push(m);window.__files=[];downloadText=(f,t)=>window.__files.push(f)`);
  app.run(`window.__sent=[];navigator.share=async d=>{window.__sent.push(d)}`);
  assert.equal(await app.run(`shareGrocery()`), 'shared');
  assert.match(app.json('window.__sent[0].text'), /^🛒/);
  app.run(`navigator.share=async()=>{const e=new Error('x');e.name='AbortError';throw e}`);
  assert.equal(await app.run(`shareGrocery()`), 'cancelled', 'backing out of the sheet does nothing else');
  app.run(`delete navigator.share;navigator.clipboard={writeText:async t=>{window.__clip=t}}`);
  assert.equal(await app.run(`doPlanShare('both')`), 'copied');
  assert.match(app.json('window.__clip'), /🍽️ Meal plan[\s\S]*\n\n🛒 Groceries/);
  assert.match(app.json('window.__toasts[0]'), /copied/);
  app.run(`navigator.clipboard={writeText:async()=>{throw new Error('no')}}`);
  assert.equal(await app.run(`doPlanShare('groc')`), 'saved');
  assert.deepEqual(app.json('window.__files'), ['grocery-list.txt']);
  assert.equal(app.json('window._grocWeek===undefined||window._grocWeek===0'), true, 'sharing next week does not move the grocery page');
});
