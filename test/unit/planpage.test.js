'use strict';
// 3.20: the meal plan page (the week in numbers, fasting days and their warnings, suggestions to
// reach a day's target, portions), the grocery list by aisle and by weight, the Meal plan view on
// the schedule, and the two-step meal sheet.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-06-17T12:00:00'; // a Wednesday
const nut = over => { const app = loadApp({ now: NOW }); app.state(Object.assign({ tab: 'nutrition', macroGoals: { protein: 180, carbs: 250, fat: 70, cals: 2400 } }, over || {})); return app; };
const egg = n => ({ foodId: 'qf_egg', name: 'Egg (large)', qty: n, serving: '1 egg', protein: 6, carbs: 0.6, fat: 5, cals: 72 });
const shake = { foodId: null, name: 'Shake', qty: 1, serving: '1 shaker', protein: 50, carbs: 10, fat: 5, cals: 285, est: true };
const big = { foodId: null, name: 'Big bowl', qty: 1, serving: '1 bowl', protein: 60, carbs: 160, fat: 30, cals: 1150, est: true };
const pm = (id, type, items, extra) => Object.assign({ id, type, name: '', items }, extra || {});
const els = (app, map) => { const orig = app.ctx.__get || (app.ctx.__get = app.ctx.document.getElementById); app.ctx.document.getElementById = id => (Object.prototype.hasOwnProperty.call(map, id) ? map[id] : orig(id)); };

test('fasting and light days: their own targets, kept through a save, and warned about when overdone', () => {
  const app = nut();
  assert.deepEqual(app.json('planDayTarget(1)').cals, 2400);
  app.run(`setPlanFast(1,'part');setPlanFast(4,'full')`);
  const light = app.json('planDayTarget(1)'), fast = app.json('planDayTarget(4)');
  assert.deepEqual([light.cals, light.fast, fast.cals, fast.fast], [600, 'part', 0, 'full'], 'a light day is about 600 kcal for a man, a fast is nothing');
  assert.ok(light.protein >= 60, 'most of a light day is protein');
  assert.deepEqual(app.json('fastWarnings()'), [], 'two days apart: nothing to say');
  // a reload keeps them; junk is dropped
  assert.deepEqual(app.json(`normalizeMealPlan(JSON.parse(JSON.stringify(S.mealPlan))).fast`), { 1: 'part', 4: 'full' });
  assert.deepEqual(app.json(`normalizeMealPlan({fast:{1:'full',9:'full',2:'yes'}}).fast`), { 1: 'full' });
  // three a week, two back to back, below the floor
  app.run(`setPlanFast(5,'full');setPlanFast(6,'full')`);
  const w = app.json('fastWarnings()').map(x => x.text);
  assert.ok(w.some(t => /^4 fasting days in one week/.test(t)), w.join(' / '));
  assert.ok(w.some(t => /Back-to-back fasting \(Thu–Fri, Fri–Sat\)/.test(t)), 'back to back is named by day');
  assert.ok(w.some(t => /below 1,500/.test(t)), 'and the week falling under the floor is said plainly');
  assert.equal(app.json('fastWarnings()').find(x => /^4 fasting/.test(x.text)).tone, 'bad');
  // meals left on a fast day are pointed out
  app.run(`S.mealPlan.days[4]=[${JSON.stringify(pm('a', 'Breakfast', [egg(2)]))}]`);
  assert.ok(app.json('fastWarnings()').some(x => /Thursday is set as a fast but still has meals planned/.test(x.text)));
  // a woman's light day is 500
  app.run(`S.aftGender='female'`); assert.equal(app.json('planDayTarget(1)').cals, 500);
});

test('the week: what is planned, what is still to plan, and only then the difference from your targets', () => {
  const app = nut();
  app.run(`for(let d=0;d<7;d++)S.mealPlan.days[d]=[${JSON.stringify(pm('b', 'Lunch', [big, shake]))},${JSON.stringify(pm('c', 'Breakfast', [egg(3)]))}]`);
  let w = app.json('planWeekInfo()');
  assert.equal(w.planned, (1150 + 285 + 216) * 7);
  assert.deepEqual([w.open, w.base], [7, 2400 * 7], '1,651 of 2,400 is not a planned day yet (under 80%)');
  assert.equal(w.toPlan, (2400 - 1651) * 7);
  app.run(`for(let d=0;d<7;d++)S.mealPlan.days[d].push(${JSON.stringify(pm('d', 'Dinner', [shake, shake]))})`);
  w = app.json('planWeekInfo()');
  assert.equal(w.open, 0);
  assert.deepEqual([w.delta, w.perWeek], [(2221 - 2400) * 7, Math.round((2221 - 2400) * 7 / 3500 * 100) / 100], 'every day planned: the week against your targets, as pounds a week');
  // a fast day counts as planned
  app.run(`S.mealPlan.days[0]=[];setPlanFast(0,'full')`);
  assert.equal(app.json('planWeekInfo().open'), 0);
  // overlays are built off-page: read what was appended
  const h = app.run(`(()=>{window.__ovs=[];document.body.appendChild=e=>{__ovs.push(e);return e};showMealPlan(3);const o=__ovs[__ovs.length-1];const b=o.innerHTML;return b;})()`);
  assert.ok(/class="modal page plan-page"/.test(h), 'a full-screen page');
});

test('suggestions come from what you eat, fit what is left, and the fill lands near the target', () => {
  const app = nut({
    savedMeals: [{ id: 'sm1', name: 'Chicken rice', items: [{ foodId: null, name: 'Chicken rice', qty: 1, serving: '1 bowl', protein: 55, carbs: 70, fat: 12, cals: 620 }] },
      { id: 'sm2', name: 'Yogurt bowl', items: [{ foodId: 'qf_greek_yogurt', name: 'Greek Yogurt', qty: 1, serving: '1 cup', protein: 25, carbs: 9, fat: 0.9, cals: 145 }] },
      { id: 'sm3', name: 'Pizza night', items: [{ foodId: null, name: 'Pizza', qty: 1, serving: '4 slices', protein: 50, carbs: 140, fat: 60, cals: 1300 }] }],
    stars: [{ id: 'st1', k: 'food', ref: 'qf_chicken_breast', unit: 'oz', val: 8 }],
  });
  app.run(`S.mealPlan.days[3]=[${JSON.stringify(pm('b', 'Breakfast', [egg(3), shake]))}]`); // 501 kcal planned
  const s = app.json('planSuggest(3)');
  assert.equal(s.left, 2400 - 501);
  assert.ok(s.singles.length >= 3 && s.singles.every(x => x.t.cals <= s.left * 1.05 + 20), 'nothing that would take the day over');
  assert.ok(s.singles.some(x => /Starred · 8 oz/.test(x.src)), 'a starred food comes at its starred amount');
  assert.ok(s.fill && s.fill.set.length >= 2 && s.fill.k >= s.left * 0.9 && s.fill.k <= s.left * 1.05 + 20, 'the fill lands between 90% and 105% of what is left: ' + (s.fill && s.fill.k));
  // adding them: each its own planned meal, in the meals not yet planned, with Undo
  app.run(`renderMealPlanSheet=()=>{};planSuggestHTML(today());planAddFill()`);
  const day = app.json('planMealsOn(today())');
  assert.equal(app.json('S.mealPlan.days[3].length'), 1, 'suggestions go in for that date only, not every week');
  assert.equal(day.length, 1 + s.fill.set.length);
  assert.deepEqual(day.slice(1).map(m => m.type).slice(0, 2), ['Lunch', 'Dinner'], 'into lunch and dinner, the meals still empty');
  // a fast day gets no suggestions; neither does a full day
  app.run(`setPlanFast(2,'full')`); assert.deepEqual(app.json('planSuggest(2).singles'), []);
  // no saved meals or stars: it says how to get suggestions
  const bare = nut(); bare.run(`S.mealPlan.days[3]=[${JSON.stringify(pm('b', 'Breakfast', [egg(3)]))}]`);
  assert.equal(bare.json('planSuggest(3).none'), true);
});

test('a planned meal is made bigger or smaller as a whole, and remembers its size', () => {
  const app = nut();
  const w = { foodId: 'qf_chicken_breast', name: 'Chicken Breast', qty: 1.7637, serving: '4 oz', sg: 113.4, unit: 'g', protein: 26, carbs: 0, fat: 3, cals: 130 };
  app.run(`S.mealPlan.days[3]=[${JSON.stringify(pm('m', 'Lunch', [egg(2), w]))}]`);
  const k0 = app.json('planMealTotals(S.mealPlan.days[3][0]).cals');
  app.run(`refreshPlanViews=()=>{};planPortion(3,'m',1)`);
  let m = app.json('S.mealPlan.days[3][0]');
  assert.deepEqual([m.portion, m.items[0].qty, Math.round(m.items[1].qty * m.items[1].sg)], [1.25, 2.5, 250]);
  app.run(`planPortion(3,'m',-1);planPortion(3,'m',-1);planPortion(3,'m',-1);planPortion(3,'m',-1)`);
  m = app.json('S.mealPlan.days[3][0]');
  assert.deepEqual([m.portion, m.items[0].qty], [0.5, 1], 'down to half, no further');
  app.run(`planPortion(3,'m',1);planPortion(3,'m',1)`);
  assert.equal(app.run('S.mealPlan.days[3][0].portion===undefined'), true, 'back to 1×');
  assert.equal(app.json('planMealTotals(S.mealPlan.days[3][0]).cals'), k0, 'exactly where it started');
  assert.equal(app.json(`normalizeMealPlan({days:[[],[],[],[{id:'x',type:'Lunch',portion:1.5,items:[${JSON.stringify(egg(1))}]}]]}).days[3][0].portion`), 1.5);
});

test('copying one meal to other days adds it; copying a day replaces them', () => {
  const app = nut();
  app.run(`refreshPlanViews=()=>{};S.mealPlan.days[1]=[${JSON.stringify(pm('m', 'Lunch', [egg(2)]))}];S.mealPlan.days[2]=[${JSON.stringify(pm('n', 'Dinner', [shake]))}]`);
  const d = n => app.run(`planWeekDates(0).find(x=>planDow(x)===${n})`);
  app.run(`planCopyMeal('${d(1)}','m',['${d(2)}','${d(3)}'])`);
  assert.deepEqual(app.json(`[planMealsOn('${d(2)}').length,planMealsOn('${d(3)}').length,S.mealPlan.days[2].length,S.mealPlan.days[3].length]`), [2, 1, 1, 0], 'copies are for those dates only; the weekly plan is untouched');
  app.run(`planCopyDay('${d(1)}',['${d(4)}'])`);
  assert.deepEqual(app.json(`planMealsOn('${d(4)}').map(m=>m.type)`), ['Lunch']);
});

test('the grocery list: by aisle, weighed foods by weight as bought, the rest of the week, and your own extras', () => {
  const app = nut({ unit: 'lbs' });
  const cooked = { foodId: 'g_chicken~alt', name: 'Chicken, cooked', qty: 2, serving: '4 oz cooked', sg: 113.4, unit: 'oz', protein: 40, carbs: 0, fat: 6, cals: 220 };
  const rice = { foodId: 'qf_white_rice', name: 'White Rice (cooked)', qty: 1, serving: '1 cup', sg: 158, protein: 4.3, carbs: 45, fat: 0.4, cals: 205 };
  const broc = { foodId: 'qf_broccoli', name: 'Broccoli', qty: 1, serving: '1 cup', protein: 2.6, carbs: 6, fat: 0.3, cals: 31 };
  app.run(`for(const d of [1,3,5])S.mealPlan.days[d]=[${JSON.stringify(pm('x', 'Lunch', [cooked, rice, broc, egg(2)]))}]`);
  const g = app.json('planGrocery()');
  const by = n => g.find(x => x.name === n);
  // this week from today (Wednesday): Wed and Fri. 2 × 8 oz cooked = 16 oz cooked ≈ 21.3 oz raw = 1.3 lb
  assert.equal(by('Chicken').amount, '1.3 lb raw', 'cooked chicken is bought raw: a quarter heavier');
  const rf = app.json(`findFood('qf_white_rice')`);
  const dryG = 2 * 158 * (rf.cals / 158) / 3.65;
  assert.equal(by('White Rice').amount, app.run(`groceryWeight(${dryG})`) + ' dry', 'cooked rice is bought dry');
  assert.equal(by('Broccoli').amount, '2 cups');
  assert.equal(by('Egg (large)').amount, '4 eggs');
  assert.deepEqual(g.map(x => x.aisle), ['Produce', 'Meat & fish', 'Eggs & dairy', 'Grains & bread'], 'in aisle order');
  assert.equal(by('Chicken').meals, 2);
  // next week: all three days, and only next week's
  app.run(`window._grocWeek=1`);
  assert.deepEqual(app.json('["Egg (large)","Chicken"].map(n=>planGrocery().find(x=>x.name===n).amount)'), ['6 eggs', '2 lb raw'], 'Mon, Wed and Fri next week: 24 oz cooked is 2 lb raw');
  app.run(`window._grocWeek=0`);
  // extras, ticks and the shared text
  els(app, { 'groc-new': { value: '  Coffee  ' } });
  app.run(`addGroceryExtra()`);
  assert.deepEqual(app.json('S.mealPlan.extras.map(x=>x.name)'), ['Coffee']);
  app.run(`toggleGrocery(planGrocery()[0].key,true)`);
  const txt = app.run('groceryText()');
  assert.doesNotMatch(txt, /Broccoli/, 'ticked: already got');
  assert.match(txt, /\nAlso\n• Coffee/);
  assert.match(app.run('groceryText(true)'), /Produce\n• Broccoli — 2 cups/);
  // in kg
  app.run(`S.unit='kg'`); assert.equal(app.json('planGrocery().find(x=>x.name==="Chicken").amount'), app.run(`groceryWeight(2*2*113.4/0.75)`) + ' raw');
  assert.match(app.run(`groceryWeight(900)`), /^900 g$/);
  // clearing the week keeps your extras
  app.run(`customConfirm=(m,l,cb)=>cb();refreshPlanViews=()=>{};planClearAll()`);
  assert.deepEqual(app.json('[planHasMeals(),S.mealPlan.extras.length]'), [false, 1]);
});

test('the schedule has a Meal plan view: the plan ahead, what was eaten behind, fasts marked', () => {
  const app = nut({ meals: [{ id: 'y', date: '2026-06-16', type: 'Lunch', name: 'Lunch', protein: 50, carbs: 100, fat: 30, cals: 1900 }] });
  assert.equal(app.json(`calLensesShown().some(l=>l.id==='meals')`), false, 'not offered until there is a plan');
  app.run(`S.mealPlan.days[4]=[${JSON.stringify(pm('m', 'Lunch', [big, shake, egg(3)]))}];setPlanFast(5,'full')`);
  assert.equal(app.json(`calLensesShown().some(l=>l.id==='meals')`), true);
  const ctx = app.json(`calCtx('meals')`); app.set('__c', ctx);
  const cell = ds => app.run(`calCellHTML('${ds}','meals',__c)`);
  assert.match(cell('2026-06-18'), /cpm[^"]*"[^>]*>.*1,651/, 'a coming Thursday shows its planned calories');
  assert.match(cell('2026-06-19'), /cpm-fast.*Fast/, 'a coming Friday shows the fast');
  assert.match(cell('2026-06-25'), /1,651/, 'the plan repeats every week');
  assert.match(cell('2026-06-16'), /cpm-past.*1,900/, 'a day gone shows what was eaten');
  assert.match(app.run(`calSummary('meals',calMonthDays(2026,5),__c)`), /<b>1,651<\/b> kcal planned this week \(2 of 7 days\) · 1 fasting day/);
});

test('the meal sheet: pick on the whole screen with a bar, then review; a meal being changed opens on review', () => {
  const app = nut();
  const sheet = () => app.run(`(()=>{window.__ovs=[];document.body.appendChild=e=>{__ovs.push(e);return e};return null;})()`);
  sheet();
  app.run(`showAddMeal()`);
  assert.equal(app.run('window._mealStepNow'), 'pick');
  const h = app.run('__ovs[__ovs.length-1].innerHTML');
  assert.ok(/class="modal meal-sheet page step-pick"/.test(h) && /id="meal-tray"/.test(h) && /class="ms-review"/.test(h));
  assert.equal(app.run('mealTrayHTML()'), '', 'no bar until something is in the meal');
  app.run(`addFoodToMeal('qf_egg');addFoodToMeal('qf_egg');addFoodToMeal('qf_banana')`);
  const tray = app.run('mealTrayHTML()');
  assert.ok(/ms-tray-n">2</.test(tray) && /Egg \(large\), Banana/.test(tray) && new RegExp(`${72 * 2 + 105} kcal`).test(tray), 'the bar: how many, which, and what they come to');
  // review shows every item open, and what the day has left
  const row = app.run('mealItemRowHTML(_mealItems[0],0)');
  assert.ok(/mi-q-0/.test(row) && /mi-acts/.test(row) && !/class="mi mi-c"/.test(row), 'every item shows its amount and actions');
  // editing a logged meal opens on review
  app.run(`S.meals.push({id:'e1',date:today(),type:'Lunch',name:'Lunch',items:[${JSON.stringify(Object.assign(egg(2), { protein: 12, carbs: 1.2, fat: 10, cals: 144 }))}],protein:12,carbs:1.2,fat:10,cals:144});editMeal('e1')`);
  assert.equal(app.run('window._mealStepNow'), 'review');
  // the planned day's sum is shown when planning
  app.run(`S.mealPlan.days[3]=[${JSON.stringify(pm('b', 'Breakfast', [shake]))}];planAddMeal(3)`);
  assert.equal(app.run('window._mealStepNow'), 'pick');
  assert.equal(app.run('window._mealTarget.type'), 'Lunch', 'a new planned meal starts on the first meal not yet planned');
  app.run(`addFoodToMeal('qf_banana')`);
  const sum = { innerHTML: '' }; els(app, { 'meal-sum': sum }); app.run('paintMealSum()');
  assert.match(sum.innerHTML, /Jun 17 comes to <b>390<\/b> of 2,400 kcal/);
  // removing an item has Undo
  let undo = null; app.ctx.toast = (m, c, o) => { undo = o && o.onAction; };
  app.run(`_mealItems=[{foodId:'qf_egg',name:'Egg',qty:1,serving:'1 egg',protein:6,carbs:0.6,fat:5,cals:72}];removeMealItem(0)`);
  assert.equal(app.json('_mealItems.length'), 0); undo(); assert.equal(app.json('_mealItems.length'), 1);
});
