'use strict';
// Home shows today's state for each area the user actually tracks, and nothing for the ones they do not.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const draw = app => { app.run(`S.tab='workout';S.homeView='';renderWorkout(document.getElementById('content'))`); return app.run(`document.getElementById('content').innerHTML`); };

test('Home lists no areas for someone who tracks nothing, and offers the weigh-in as a quick action', () => {
  const app = loadApp(); app.state({ onboarded: true, name: 'K' });
  const h = draw(app);
  assert.ok(!/home-areas/.test(h)); assert.match(h, /showWeighIn\(\)/);
});
test('each tracked area gets a row with its next action; the weigh-in moves into the Weight row', () => {
  const app = loadApp(); app.state({ onboarded: true, name: 'K' });
  app.run(`S.bodyweightLog=[{date:daysAgoStr(2),weight:182.4}];S.supps=[{id:'a',name:'Creatine'}];S.suppLogs={};S.activities=[{id:'x',type:'run',date:today(),dist:'3',dur:'30'}];S.sleepLog={[daysAgoStr(1)]:7}`);
  const rows = app.json('homeAreas()');
  assert.deepEqual(rows.map(r => r.k), ['Weight', 'Supplements', 'Cardio', 'Sleep']);
  assert.match(rows[0].sub, /Weigh in/); assert.equal(rows[0].js, 'showWeighIn()');
  assert.deepEqual([rows[1].val, rows[1].unit], ['0', '/ 1']); assert.match(rows[3].sub, /not logged/);
  const h = draw(app);
  assert.match(h, /class="qa qa-3"/, 'Activity, Modes and Habits: weighing in has its own row');
  assert.match(h, /go\(&#39;habits&#39;\)|go\('habits'\)/, 'with no habits yet, Habits is offered as a quick action');
});
test('food shows once it has been logged in the last two weeks, with what is left', () => {
  const app = loadApp(); app.state({ onboarded: true, name: 'K', macroGoals: { cals: 2300, protein: 160, carbs: 250, fat: 70 } });
  assert.ok(!app.json('homeAreas()').some(r => r.k === 'Food'));
  app.run(`S.macroLogs[daysAgoStr(3)]={cals:2000,protein:150,carbs:200,fat:60}`);
  let f = app.json('homeAreas()').find(r => r.k === 'Food'); assert.match(f.sub, /Nothing logged yet/);
  app.run(`S.macroLogs[today()]={cals:1400,protein:96,carbs:150,fat:40}`);
  f = app.json('homeAreas()').find(r => r.k === 'Food'); assert.match(`${f.val} ${f.unit} ${f.sub}`, /1,400 \/ 2,300 kcal 96 \/ 160 g protein · 64 to go/);
  app.run(`S.macroLogs[today()]={cals:2300,protein:170,carbs:250,fat:70}`);
  f = app.json('homeAreas()').find(r => r.k === 'Food'); assert.match(f.sub, /protein goal hit/); assert.equal(f.tone, 'good');
});
