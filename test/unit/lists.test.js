'use strict';
// Long lists made easy to look through (35b-listbar.js): Foods by kind, History by month,
// Records and Lifts by muscle group, and the Edit board by its tags.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const { demoState } = require('../../tools/demo-state.js');

const NOW = '2026-10-07T12:00:00';
const at = (n, h) => { const d = new Date(NOW); d.setDate(d.getDate() - n); d.setHours(h == null ? 17 : h, 0, 0, 0); return d.getTime(); };
const day = n => { const d = new Date(NOW); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const blank = over => { const app = loadApp({ now: NOW }); app.state(Object.assign({ onboarded: true }, over || {})); return app; };
const demo = over => { const app = loadApp({ now: NOW }); app.state(Object.assign(demoState(new Date(NOW).getTime()), over || {})); return app; };
const body = (app, id) => app.run(`LB[${JSON.stringify(id)}].body(lbState(${JSON.stringify(id)}))`);
const set = (w, r) => ({ w: String(w), r: String(r), done: true });

test('the list bar: chips with nothing are not drawn, picks are remembered, a search repaints only the rows', () => {
  const app = blank();
  app.run(`lbDef('t',{search:'Find',sorts:[{id:'a',l:'A'},{id:'b',l:'B'}],chips:()=>[{id:'all',l:'All'},{id:'x',l:'X',n:2},{id:'y',l:'Y',n:0},{id:'z',l:'Z',n:1}],body:st=>st.chip+'|'+st.sort+'|'+st.q})`);
  const h = app.run(`lbHTML('t')`);
  assert.match(h, /X<small>2<\/small>/);
  assert.doesNotMatch(h, />Y</, 'a chip with nothing behind it is left off');
  assert.match(h, /id="lbq-t"/);
  assert.equal(body(app, 't'), 'all|a|');
  app.run(`lbSet('t','chip','z');lbSet('t','sort','b');lbSet('t','q','  Bench  ')`);
  assert.equal(body(app, 't'), 'z|b|bench');
  assert.deepEqual(app.json(`normalizeState(JSON.parse(JSON.stringify(S))).listPrefs.t`), { chip: 'z', sort: 'b' }, 'chip and sort are kept, a search is not');
  app.run(`lbSet('t','chip','gone')`);
  assert.equal(body(app, 't').split('|')[0], 'all', 'a chip that no longer exists falls back to All');
  assert.equal(app.run(`lbMatch('bench press','Barbell Bench Press')`), true);
  assert.equal(app.run(`lbMatch('bench squat','Barbell Bench Press')`), false);
  // nothing to choose: no bar
  app.run(`lbDef('u',{chips:()=>[{id:'all',l:'All'},{id:'x',l:'X',n:3}],body:()=>''})`);
  assert.equal(app.run(`lbBarHTML('u')`), '', 'one real choice is no choice');
});

test('Foods: every food has a kind; chips, any-kind first, most used first, protein per 100 kcal', () => {
  const app = blank({ meals: [{ id: 'm1', date: day(2), type: 'Lunch', items: [{ foodId: 'qf_banana', name: 'Banana' }, { foodId: 'qf_banana', name: 'Banana' }, { foodId: 'g_steak~lean', name: 'Steak' }], cals: 1 }] });
  assert.deepEqual(app.json(`QUICK_FOODS.filter(f=>!FOOD_CATS.some(c=>c.id===f.cat)).map(f=>f.id)`), [], 'all 216 built-in foods are tagged');
  assert.deepEqual(app.json(`genericFoods().filter(f=>!f.cat).map(f=>f.id)`), []);
  assert.equal(app.run(`foodCat(findFood('g_steak'))`), 'protein');
  assert.equal(app.run(`foodCat(findFood('g_cook_oil'))`), 'fats');
  const chips = app.json(`lbState('foods').chips.map(c=>c.id)`);
  assert.ok(!chips.includes('mine'), 'no Yours chip without your own foods');
  // Fruit, most used: the banana you log leads
  app.run(`lbSet('foods','chip','fruit')`);
  let h = body(app, 'foods');
  assert.ok(h.indexOf('Banana') < h.indexOf('Apple'), 'the food you log most comes first');
  // Protein, A to Z: the any-kind foods lead
  app.run(`lbSet('foods','chip','protein');lbSet('foods','sort','az')`);
  h = body(app, 'foods');
  const firstSpecific = h.indexOf('Bison') > 0 ? h.indexOf('Bison') : h.indexOf('Chicken Breast');
  assert.ok(h.indexOf('>Steak<') > 0 && h.indexOf('>Steak<') < firstSpecific, 'Steak (any kind) before the specific cuts');
  // Protein per 100 kcal, across everything: one list, leanest first
  app.run(`lbSet('foods','chip','all');lbSet('foods','sort','protein')`);
  const ids = app.json(`sortFoods(foodListAll(),'protein').slice(0,3).map(f=>proteinPer100(f))`);
  assert.ok(ids[0] >= ids[1] && ids[1] >= ids[2] && ids[0] > 15);
  assert.doesNotMatch(body(app, 'foods'), /lb-sec/, 'sorted by protein, the kinds are not split');
  app.run(`lbSet('foods','sort','used')`);
  assert.equal((body(app, 'foods').match(/class="ms-sec lb-sec"/g) || []).length, app.json(`lbState('foods').chips.length`) - 1, 'All: one heading per kind');
});

test('History: months with what is in them, a filter, a search, and earlier months on demand', () => {
  const ws = []; for (let i = 0; i < 70; i++) ws.push({ id: 'w' + i, name: i % 2 ? 'Push Day' : 'Pull Day', started: at(i * 3), ended: at(i * 3) + 3e6, exercises: [{ exId: i % 2 ? 'bb-bench' : 'deadlift', sets: [set(200, 5)] }] });
  ws[0].prog = { id: 'p1' };
  const app = blank({ workouts: ws, activities: [{ id: 'r', type: 'run', date: day(1), dur: '30', dist: '3.1' }], programs: [{ id: 'p1', name: 'AFT Mass', status: 'active', weeks: 12 }] });
  const h = body(app, 'history');
  assert.match(h, /class="sec-h lb-mh"><span>October<\/span><i>\d+ workouts? · 1 activity<\/i>/);
  assert.match(h, /Show earlier · \d+ more/, 'about forty rows first, then a button');
  const shown = (h.match(/class="hi"/g) || []).length;
  assert.ok(shown >= 40 && shown < 71, `${shown} rows drawn`);
  app.run(`_histMore+=1000`);
  assert.equal((body(app, 'history').match(/class="hi"/g) || []).length, 71);
  assert.doesNotMatch(body(app, 'history'), /Show earlier/);
  // filters
  const chips = app.json(`lbState('history').chips.map(c=>c.l)`);
  assert.deepEqual(chips, ['All', 'Workouts', 'Activities', 'AFT Mass']);
  app.run(`lbSet('history','chip','activities')`);
  assert.equal((body(app, 'history').match(/class="hi"/g) || []).length, 1);
  app.run(`lbSet('history','chip','p:p1')`);
  assert.equal((body(app, 'history').match(/class="hi"/g) || []).length, 1);
  // a search finds workouts by an exercise in them, across every month
  app.run(`lbSet('history','chip','all');lbSet('history','q','deadlift')`);
  assert.equal((body(app, 'history').match(/class="hi"/g) || []).length, 35);
  app.run(`lbSet('history','q','zzz')`);
  assert.match(body(app, 'history'), /Nothing matches/);
  assert.match(blank().run(`renderHistList()`), /Nothing logged yet/);
});

test('Records and Lifts: muscle-group chips and four sorts', () => {
  const app = demo();
  const chips = app.json(`lbState('records').chips.map(c=>c.id)`);
  assert.equal(chips[0], 'all');
  assert.ok(chips.includes('legs') && chips.includes('chest'));
  app.run(`lbSet('records','chip','legs')`);
  const legs = app.json(`recordRows().filter(r=>exMuscleGroup(r.id)==='legs').length`);
  assert.equal((body(app, 'records').match(/row row-tap/g) || []).length, legs);
  app.run(`lbSet('records','chip','all');lbSet('records','sort','heavy')`);
  const est = [...body(app, 'records').matchAll(/1RM (\d+(?:\.\d+)?)/g)].map(m => +m[1]);
  assert.deepEqual(est, est.slice().sort((a, b) => b - a));
  app.run(`lbSet('lifts','sort','az')`);
  const names = [...body(app, 'lifts').matchAll(/class="tl-t">([^<]+)</g)].map(m => m[1]);
  assert.ok(names.length > 3);
  assert.deepEqual(names, names.slice().sort((a, b) => a.localeCompare(b)));
  app.run(`lbSet('lifts','chip','arms')`);
  assert.ok([...body(app, 'lifts').matchAll(/showMetric\('lift',\{id:&quot;([^&]+)&quot;/g)].every(m => app.run(`exMuscleGroup(${JSON.stringify(m[1])})`) === 'arms'));
  // the records sheet carries the bar
  assert.match(app.json(`metricDetail('records',{},boardRange())`).body, /id="lb-records"/);
});

test('Edit board: on the board by tag, one list per group; to add, a closed header per group that opens', () => {
  const app = demo();
  const html = app.run(`(()=>{window.__ovs=[];document.body.appendChild=e=>{__ovs.push(e);return e};const el={innerHTML:''};document.getElementById=id=>id==='bedit-body'?el:null;renderBoardEdit();return el.innerHTML})()`);
  const heads = [...html.matchAll(/<div class="be-gh">([^<]+)<span>(\d+)<\/span><\/div>/g)].map(m => m[1]);
  assert.deepEqual(heads, ['Strength', 'Body', 'Training', 'Food', 'Conditioning', 'Habits and mood']);
  assert.equal((html.match(/class="be-list" data-g=/g) || []).length, heads.length);
  assert.match(html, /class="be-gh be-gt" aria-expanded="false"/, 'the Add groups start closed');
  assert.doesNotMatch(html, /be-plus/, 'and show no add buttons until opened');
  app.run(`beToggle('Body')`);
  assert.equal(app.run(`_beOpen.has('Body')`), true);
});
