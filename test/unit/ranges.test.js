'use strict';
// What you type yourself is checked: impossible numbers are refused, outliers are asked about.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const { demoState } = require('../../tools/demo-state.js');
const NOW = '2026-10-20T18:00:00';

test('a set: negative, beyond any lift on record, or 100+ reps is refused; far above your best is asked about', () => {
  const app = loadApp({ now: NOW });
  app.state(demoState(new Date(NOW).getTime()));
  const chk = (w, r, exId) => app.json(`togSetCheck({exId:'${exId || 'hex-dl'}'},{w:'${w}',r:'${r}'})`);
  assert.match(chk(-100, 5).block, /negative/);
  assert.match(chk(99999, 3).block, /more than anyone/);
  assert.match(chk(225, 150).block, /reps/);
  assert.match(chk(600, 3).ask, /estimated max/);
  assert.equal(chk(340, 5), null, 'a normal set goes straight in');
  assert.equal(chk(45, 10, 'never-done-before'), null, 'no history: nothing to compare with');
});

test('body weight has a plausible range in either unit, and a big jump from the last weigh-in is caught', () => {
  const app = loadApp({ now: NOW });
  app.state({ unit: 'lbs', bodyweightLog: [{ date: '2026-10-18', weight: 189 }] });
  assert.equal(app.run('saneBw(1883)'), false); assert.equal(app.run('saneBw(40)'), false); assert.equal(app.run('saneBw(188.3)'), true);
  assert.ok(app.json('!!weighInJump(230)')); assert.ok(app.json('!weighInJump(195)'));
  assert.equal(app.run('logBodyweight(1883)'), false, 'every route in refuses an impossible weight');
  app.state({ unit: 'kg', bodyweightLog: [] });
  assert.equal(app.run('saneBw(85.5)'), true); assert.equal(app.run('saneBw(400)'), false);
});

test('a set in a saved workout can be fixed, checked like a new one, and undone', () => {
  const app = loadApp({ now: NOW });
  app.state(demoState(new Date(NOW).getTime()));
  app.run(`toast=(m,c,o)=>{globalThis.__t={m,o};};const wk=S.workouts[0];globalThis.__id=wk.id;
    const els={'se-w':{value:'99999'},'se-r':{value:'5'}};(g=>{document.getElementById=id=>els[id]||g(id);})(document.getElementById);globalThis.__els=els;`);
  const before = app.run(`JSON.stringify(S.workouts[0].exercises[0].sets[1])`);
  app.run(`saveSetEdit(__id,0,1)`);
  assert.match(app.run(`__t.m`), /more than anyone/); assert.equal(app.run(`JSON.stringify(S.workouts[0].exercises[0].sets[1])`), before, 'refused: unchanged');
  app.run(`__els['se-w'].value='72.5';__els['se-r'].value='9';saveSetEdit(__id,0,1)`);
  assert.deepEqual(app.json(`[S.workouts[0].exercises[0].sets[1].w,S.workouts[0].exercises[0].sets[1].r]`), ['72.5', '9']);
  app.run(`__t.o.onAction()`);
  assert.equal(app.run(`JSON.stringify(S.workouts[0].exercises[0].sets[1])`), before, 'Undo puts the old numbers back');
});
