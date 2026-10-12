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
  assert.deepEqual(rows.map(r => r.t), ['Weight', 'Supplements', 'Cardio', 'Sleep']);
  assert.match(rows[0].s, /Weigh in today/); assert.equal(rows[0].js, 'showWeighIn()');
  assert.match(rows[1].s, /0 of 1 taken/); assert.match(rows[3].s, /Not logged/);
  const h = draw(app);
  assert.match(h, /class="qa qa-2"/, 'Activity and Modes only: weighing in has its own row');
});
test('food shows once it has been logged in the last two weeks, with what is left', () => {
  const app = loadApp(); app.state({ onboarded: true, name: 'K', macroGoals: { cals: 2300, protein: 160, carbs: 250, fat: 70 } });
  assert.ok(!app.json('homeAreas()').some(r => r.t === 'Food'));
  app.run(`S.macroLogs[daysAgoStr(3)]={cals:2000,protein:150,carbs:200,fat:60}`);
  let f = app.json('homeAreas()').find(r => r.t === 'Food'); assert.match(f.s, /Nothing logged yet today/);
  app.run(`S.macroLogs[today()]={cals:1400,protein:96,carbs:150,fat:40}`);
  f = app.json('homeAreas()').find(r => r.t === 'Food'); assert.match(f.s, /1,400 of 2,300 kcal · 64 g protein to go/);
  app.run(`S.macroLogs[today()]={cals:2300,protein:170,carbs:250,fat:70}`);
  f = app.json('homeAreas()').find(r => r.t === 'Food'); assert.match(f.s, /protein goal hit/); assert.equal(f.tone, 'good');
});
