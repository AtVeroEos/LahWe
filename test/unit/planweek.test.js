'use strict';
// 3.21: planning this week and next by date, meals every week or for one date, planned meals that
// count in the day when their time comes (and come off when not eaten), Save as a meal, and the
// app opening on Home.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const at = h => `2026-06-17T${String(h).padStart(2, '0')}:30:00`; // a Wednesday
const nut = (h, over) => { const app = loadApp({ now: at(h == null ? 12 : h) }); app.state(Object.assign({ tab: 'nutrition', macroGoals: { protein: 180, carbs: 250, fat: 70, cals: 2400 } }, over || {})); return app; };
const egg = n => ({ foodId: 'qf_egg', name: 'Egg (large)', qty: n, serving: '1 egg', protein: 6, carbs: 0.6, fat: 5, cals: 72 });
const shake = { foodId: null, name: 'Shake', qty: 1, serving: '1 shaker', protein: 50, carbs: 10, fat: 5, cals: 285, est: true };
const pm = (id, type, items, extra) => Object.assign({ id, type, name: '', items }, extra || {});
const els = (app, map) => { const orig = app.ctx.__get || (app.ctx.__get = app.ctx.document.getElementById); app.ctx.document.getElementById = id => (Object.prototype.hasOwnProperty.call(map, id) ? map[id] : orig(id)); };
const quiet = app => app.run(`refreshPlanViews=()=>{};mealsChanged=()=>{}`);

test('this week and next: dates, and a day is its weekday’s weekly meals, less skips, plus its own', () => {
  const app = nut();
  assert.deepEqual(app.json('planWeekDates(0)'), ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21']);
  assert.deepEqual(app.json('[planWeekStart(1),planLastDate()]'), ['2026-06-22', '2026-06-28']);
  app.run(`S.mealPlan.days[3]=[${JSON.stringify(pm('w', 'Lunch', [shake]))}];S.mealPlan.dated={'2026-06-24':[${JSON.stringify(pm('o', 'Dinner', [egg(3)]))}]}`);
  assert.deepEqual(app.json(`planEntries('2026-06-17').map(e=>[e.m.id,e.rec])`), [['w', true]]);
  assert.deepEqual(app.json(`planEntries('2026-06-24').map(e=>[e.m.id,e.rec])`), [['w', true], ['o', false]], 'next Wednesday: the weekly lunch, and a dinner for that date only');
  app.run(`S.mealPlan.skip={'2026-06-24':['w']}`);
  assert.deepEqual(app.json(`planMealsOn('2026-06-24').map(m=>m.id)`), ['o'], 'a weekly meal can be taken off one date');
  assert.deepEqual(app.json(`planMealsOn('2026-07-01').map(m=>m.id)`), ['w'], 'and is still there the week after');
  assert.equal(app.json('planWeekInfo(1).planned'), 216, 'next week counts its own days');
  // a reload keeps dates in range and drops old ones
  app.run(`S.mealPlan.dated['2026-01-01']=[${JSON.stringify(pm('x', 'Lunch', [shake]))}]`);
  const back = app.json('normalizeMealPlan(JSON.parse(JSON.stringify(S.mealPlan)))');
  assert.deepEqual([Object.keys(back.dated), back.skip, back.auto], [['2026-06-24'], { '2026-06-24': ['w'] }, true]);
});

test('a new planned meal is for its date unless Every <weekday> is on; editing a weekly one can change just one date', () => {
  const app = nut(); quiet(app);
  const nextWed = '2026-06-24';
  app.run(`planAddMeal('${nextWed}');_mealItems=[${JSON.stringify(egg(2))}]`);
  assert.deepEqual(app.json('[window._mealTarget.date,window._mealTarget.rec,window._mealTarget.plan]'), [nextWed, false, 3]);
  assert.match(app.run('planRecRowHTML(window._mealTarget)'), /Every Wednesday[\s\S]*Just Jun 24/);
  app.run(`saveMeal()`);
  assert.deepEqual(app.json(`[S.mealPlan.days[3].length,planMealsOn('${nextWed}').length,planMealsOn('2026-06-17').length]`), [0, 1, 0], 'one date only');
  // switched on: every Wednesday
  app.run(`planAddMeal('${nextWed}');_mealItems=[${JSON.stringify(shake)}];togglePlanRec();saveMeal()`);
  const wid = app.json('S.mealPlan.days[3][0].id');
  assert.deepEqual(app.json(`[planMealsOn('2026-06-17').length,planMealsOn('${nextWed}').length]`), [1, 2]);
  // edit the weekly one for next Wednesday only: skipped there, a changed copy in its place
  app.run(`planEditMeal('${nextWed}','${wid}')`);
  assert.equal(app.json('window._mealTarget.rec'), true);
  app.run(`togglePlanRec();_mealItems[0].qty=2;saveMeal()`);
  assert.deepEqual(app.json(`[S.mealPlan.days[3][0].items[0].qty,planMealsOn('${nextWed}').map(m=>m.items[0].qty).sort(),planMealsOn('2026-06-17')[0].items[0].qty]`), [1, [2, 2], 1], 'next Wednesday has the double shake; every other Wednesday the usual');
  // a one-date meal switched on becomes weekly
  const oid = app.json(`(S.mealPlan.dated['${nextWed}'].find(m=>m.items[0].name==='Egg (large)')).id`);
  app.run(`planEditMeal('${nextWed}','${oid}');togglePlanRec();saveMeal()`);
  assert.equal(app.json(`S.mealPlan.days[3].some(m=>m.id==='${oid}')`), true);
  assert.equal(app.json(`(S.mealPlan.dated['${nextWed}']||[]).some(m=>m.id==='${oid}')`), false);
  // the coach and older callers, with no date, still work on the weekly plan
  app.run(`showAddMeal(null,false,{plan:5});_mealItems=[${JSON.stringify(egg(1))}];saveMeal()`);
  assert.equal(app.json('S.mealPlan.days[5].length'), 1);
});

test('removing a weekly meal asks: this date, or every week; clearing a day skips the weekly ones there', () => {
  const app = nut(); quiet(app);
  app.run(`S.mealPlan.days[4]=[${JSON.stringify(pm('w', 'Lunch', [shake]))}];S.mealPlan.dated={'2026-06-18':[${JSON.stringify(pm('o', 'Dinner', [egg(2)]))}]}`);
  const sheet = app.run(`(()=>{window.__ovs=[];document.body.appendChild=e=>{__ovs.push(e);return e};planRemoveMeal('2026-06-18','w');return __ovs[0].innerHTML})()`);
  assert.ok(/Just Jun 18/.test(sheet) && /Every Thursday/.test(sheet), 'a weekly meal asks which');
  app.run(`planRemoveMeal('2026-06-18','w','day')`);
  assert.deepEqual(app.json(`[planMealsOn('2026-06-18').map(m=>m.id),planMealsOn('2026-06-25').map(m=>m.id)]`), [['o'], ['w']]);
  app.run(`planRemoveMeal('2026-06-25','w','all')`);
  assert.equal(app.json('S.mealPlan.days[4].length'), 0);
  app.run(`S.mealPlan.days[4]=[${JSON.stringify(pm('w2', 'Lunch', [shake]))}];planClearDay('2026-06-18')`);
  assert.deepEqual(app.json(`[planMealsOn('2026-06-18').length,planMealsOn('2026-06-25').length]`), [0, 1], 'cleared for that date only');
});

test('fast or light for one date, or every week; the date’s own setting wins', () => {
  const app = nut(); quiet(app);
  app.run(`setPlanFastOn('2026-06-18','part')`);
  assert.deepEqual(app.json(`[planFastOn('2026-06-18'),planFastOn('2026-06-25'),planDateTarget('2026-06-18').cals]`), ['part', null, 600]);
  app.run(`setPlanFastOn('2026-06-18','full',true)`);
  assert.deepEqual(app.json(`[planFastOn('2026-06-18'),planFastOn('2026-06-25'),S.mealPlan.fastOn['2026-06-18']===undefined]`), ['full', 'full', true], 'every Thursday');
  app.run(`setPlanFastOn('2026-06-25',null)`);
  assert.deepEqual(app.json(`[planFastOn('2026-06-25'),planFastOn('2026-07-02'),S.mealPlan.fastOn['2026-06-25']]`), [null, 'full', 'eat'], 'eat on one Thursday, fast the others');
  // warnings are per week
  app.run(`setPlanFastOn('2026-06-19','full');setPlanFastOn('2026-06-20','full')`);
  assert.ok(app.json('fastWarnings(0)').some(x => /^3 fasting days/.test(x.text)));
  assert.equal(app.json('fastWarnings(1).some(x=>/^3 fasting/.test(x.text))'), false, 'next week has its own count');
});

test('planned meals count in the day when their time comes; "Didn’t eat" takes one off for good; past days are never filled in', () => {
  const plan = `S.mealPlan.days[3]=[${JSON.stringify(pm('b', 'Breakfast', [egg(3)]))},${JSON.stringify(pm('l', 'Lunch', [shake]))},${JSON.stringify(pm('d', 'Dinner', [shake, egg(2)]))}];S.mealPlan.days[2]=[${JSON.stringify(pm('y', 'Lunch', [shake]))}]`;
  let app = nut(8); app.run(plan); quiet(app);
  assert.deepEqual(app.json('planAutoLog().length'), 1, '8:30 am: breakfast only');
  assert.deepEqual(app.json('S.meals.map(m=>[m.type,m.fromPlan,m.planMealId])'), [['Breakfast', true, 'b']]);
  assert.equal(app.json('planAutoLog().length'), 0, 'never twice');
  app.setNow(at(17)); assert.equal(app.json('planAutoLog().length'), 2, '5:30 pm: lunch and dinner');
  assert.equal(app.json('getDayTotals(today()).cals'), 216 + 285 + 285 + 144);
  assert.equal(app.json(`S.meals.some(m=>m.date==='2026-06-16')`), false, 'yesterday is left as it was');
  // didn't eat lunch: off the count, the plan untouched, and not added back
  const lid = app.json(`S.meals.find(m=>m.planMealId==='l').id`);
  let undo = null; app.ctx.toast = (m, c, o) => { undo = o && o.onAction; };
  app.run(`planDidntEat('${lid}')`);
  assert.deepEqual(app.json('[S.meals.length,S.mealPlan.days[3].length,planAutoLog().length]'), [2, 3, 0]);
  undo(); assert.equal(app.json('S.meals.length'), 3);
  // deleting it from its own sheet does the same
  app.run(`deleteMeal('${lid}')`); assert.equal(app.json('planAutoLog().length'), 0);
  // the Nutrition tab shows it as planned, with the button
  app.run(`go('nutrition')`);
  const h = app.run(`document.getElementById('content').innerHTML`);
  assert.ok(/pill-plan">Planned/.test(h) && /planDidntEat\(/.test(h), 'planned meals in the log say so, and can be taken off');
  // switched off: nothing is added
  app = nut(18); app.run(plan); quiet(app); app.run('S.mealPlan.auto=false');
  assert.equal(app.json('planAutoLog().length'), 0);
  // a full fast day adds nothing
  app = nut(18); app.run(plan); quiet(app); app.run(`setPlanFastOn(today(),'full')`);
  assert.equal(app.json('planAutoLog().length'), 0);
  // removing a meal from today's plan takes its automatic copy out of the log; one you logged yourself stays
  app = nut(18); app.run(plan); quiet(app); app.run('planAutoLog()');
  app.run(`planRemoveMeal(today(),'d','day')`);
  assert.equal(app.json(`S.meals.some(m=>m.planMealId==='d')`), false);
  app.run(`tapLogPlanMeal(3,'b',today())`);
  app.run(`planRemoveMeal(today(),'b','all')`);
  assert.equal(app.json(`S.meals.filter(m=>m.planMealId==='b').length`), 1, 'the one logged by hand stays');
});

test('Save as a meal: offered from the first item, named, starred by default, and the logged meal remembers it', () => {
  const app = nut();
  const btn = { style: {}, classList: { add() {}, remove() {}, toggle() {} } }; els(app, { 'save-combo-btn': btn });
  app.run(`showAddMeal();addFoodToMeal('qf_egg');updateMealItems()`);
  assert.equal(btn.style.display, '', 'one food is enough');
  els(app, { 'combo-name': { value: '  Eggs  ' }, 'save-combo-btn': btn });
  app.run(`saveAsCombo();doSaveCombo()`);
  const c = app.json('S.savedMeals[0]');
  assert.equal(c.name, 'Eggs');
  assert.equal(app.run(`isMealStarred('${c.id}')`), true);
  assert.equal(app.run('window._loggedSavedMealId'), c.id);
  assert.match(btn.innerHTML, /Saved as Eggs/);
  els(app, { 'combo-name': { value: '' } }); app.run(`saveAsCombo();doSaveCombo()`);
  assert.equal(app.json('S.savedMeals.length'), 1, 'a name is needed');
});

test('the app opens on Home, whatever tab it was closed on', () => {
  const app = loadApp({ now: at(12) });
  app.state({ tab: 'progress' });
  app.run(`localStorage.setItem(STORE_KEY,JSON.stringify(Object.assign(S,{tab:'progress'})))`);
  app.run('boot()');
  return new Promise(r => setTimeout(r, 30)).then(() => {
    assert.equal(app.run('S.tab'), 'workout');
  });
});
