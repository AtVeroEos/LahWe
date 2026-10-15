'use strict';
// Home layouts: six presets of the same blocks, picked in Settings from live miniatures.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const { demoState } = require('../../tools/demo-state.js');

const NOW = '2026-10-14T08:00:00';
const demo = () => { const app = loadApp({ now: NOW }); app.state(demoState(new Date(NOW).getTime())); return app; };
const home = (app, l) => app.run(`homeHTML(${JSON.stringify(l)})`);

test('six layouts, Balanced by default, an unknown one falls back to Balanced', () => {
  const app = demo();
  assert.deepEqual(app.json('HOME_LAYOUTS.map(l=>l.id)'), ['balanced', 'lifting', 'running', 'nutrition', 'habits', 'minimal']);
  assert.equal(app.json('S.homeLayout'), 'balanced');
  assert.equal(app.json(`normalizeState({onboarded:true,_schema:3,homeLayout:'nope'}).homeLayout`), 'balanced');
  assert.equal(app.json(`normalizeState({onboarded:true,_schema:3,homeLayout:'running'}).homeLayout`), 'running');
});

test('each layout leads with its own block and leaves off the tile that block already shows', () => {
  const app = demo();
  const lead = l => { const h = home(app, l); const i = h.indexOf('</div>', h.indexOf('hm-top')); return h.slice(h.indexOf('hm-hi'), h.indexOf('hm-hi') + 3000); };
  assert.match(lead('balanced'), /class="hero/);
  assert.match(lead('running'), /Running · this week/);
  assert.match(lead('nutrition'), /Food today/);
  assert.match(lead('lifting'), /class="hero/); assert.match(home(app, 'lifting'), /Sets per muscle, last 7 days/);
  assert.doesNotMatch(home(app, 'running'), /aria-label="Cardio"/, 'the run block is the cardio');
  assert.doesNotMatch(home(app, 'nutrition'), /aria-label="Food"/, 'the food block is the food tile');
  const min = home(app, 'minimal');
  assert.doesNotMatch(min, /home-areas|home-coach/); assert.match(min, /wk-card/); assert.match(min, /class="qa/);
  for (const l of app.json('HOME_LAYOUTS.map(l=>l.id)')) assert.doesNotMatch(home(app, l), /hit an error/, l);
});

test('switching in Settings redraws Home; the picker shows a live miniature of each, with nothing tappable inside', () => {
  const app = demo();
  app.run(`go('workout');setHomeLayout('nutrition')`);
  assert.equal(app.json('S.homeLayout'), 'nutrition');
  assert.match(app.run(`document.getElementById('content').innerHTML`), /Food today/);
  const pick = app.run('homeLayoutPickerHTML()');
  assert.equal((pick.match(/class="lay-opt/g) || []).length, 6);
  assert.match(pick, /class="lay-opt on"[^>]*aria-checked="true"[^>]*aria-label="Nutrition"/);
  const minis = pick.split('class="lay-pg">').slice(1).map(x => x.split('<span class="lay-l">')[0]);
  assert.equal(minis.length, 6);
  for (const m of minis) { assert.doesNotMatch(m, /\son[a-z]+="/); assert.doesNotMatch(m, /\sid="/); }
  assert.doesNotMatch(pick, /<button class="lay-opt/, 'not a button: Home inside it is full of buttons');
});

test('one tile, one place: Weight and Habits tiles always open the same thing', () => {
  const app = demo();
  app.run(`S.habits=normalizeHabits([{id:'r',name:'Read',type:'done',from:daysAgoStr(20)}]);S.moodLog={}`);
  const js = () => Object.fromEntries(app.json('homeAreas()').map(a => [a.k, a.js]));
  const a = js(); app.run(`logBodyweight(181);S.moodLog[daysAgoStr(1)]=4;bumpMemo()`); const b = js();
  assert.equal(a.Weight, 'showWeighIn()'); assert.equal(b.Weight, 'showWeighIn()');
  assert.equal(a.Habits, "go('habits')"); assert.equal(b.Habits, "go('habits')");
});

test('Home tiles never leave a hole: with an odd number of small tiles the layout’s top one spans the row', () => {
  const app = loadApp({ now: NOW });
  app.state({ name: 'K', supps: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }] });
  app.run(`S.bodyweightLog=[{date:daysAgoStr(7),weight:183.8}];S.activities=[{id:'r',type:'run',date:daysAgoStr(10),dist:'3',dur:'30'}];bumpMemo()`);
  const tiles = l => { const h = app.run(`homeAreasHTML(homeLayout(${JSON.stringify(l)}).areas,homeLayout(${JSON.stringify(l)}).skip)`); return [...h.matchAll(/class="ha([^"]*)"[^>]*aria-label="([^"]+)"/g)].map(m => [m[2], /ha-span/.test(m[1])]); };
  assert.deepEqual(tiles('balanced'), [['Weight', true], ['Supplements', false], ['Cardio', false]], 'the screenshot case: Weight takes the row, the other two pair up');
  app.run(`S.sleepLog={[daysAgoStr(1)]:7};bumpMemo()`);
  assert.ok(tiles('balanced').every(t => !t[1]), 'four tiles: two rows of two, nothing stretched');
  for (const l of app.json('HOME_LAYOUTS.map(l=>l.id)')) {
    const t = tiles(l); const spans = t.filter(x => x[1]).length;
    assert.equal(spans, t.length % 2, `${l}: ${JSON.stringify(t)}`);
    if (spans) assert.equal(t.findIndex(x => x[1]), 0, `${l}: the spanning tile comes first`);
  }
});
