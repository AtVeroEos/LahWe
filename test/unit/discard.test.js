'use strict';
// Discard the open workout (Finish sheet, two taps; or Cancel on the list): nothing is kept, and Undo
// on the toast puts the workout back exactly as it was.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

test('discarding keeps nothing; Undo puts the workout back as it was', () => {
  const app = loadApp({ now: '2026-10-20T18:00:00' });
  app.state({ onboarded: true });
  app.run(`S.activeWorkout={id:'w1',routineId:null,name:'Push',started:Date.now()-1800000,exercises:[sessionExercise('bb-bench',null,{exId:'bb-bench',sets:3,r:'5'})],notes:''};
    S.activeWorkout.exercises[0].sets.forEach(s=>{s.w='185';s.r='5';});S.activeWorkout.exercises[0].sets[0].done=true;rebuildPRs();
    toast=(m,c,o)=>{globalThis.__t={m,o};};`);
  const before = app.run(`JSON.stringify(S.activeWorkout)`);
  app.run(`discardWorkout()`);
  assert.equal(app.run(`S.activeWorkout`), null);
  assert.equal(app.run(`S.workouts.length`), 0, 'nothing is filed in history');
  assert.equal(app.run(`__t.m`), 'Workout discarded');
  assert.equal(app.run(`__t.o.action`), 'Undo');
  app.run(`__t.o.onAction()`);
  assert.equal(app.run(`JSON.stringify(S.activeWorkout)`), before, 'Undo restores it exactly');
  assert.equal(app.run(`S.workouts.length`), 0);
});

test('the Finish sheet discard needs two taps', () => {
  const app = loadApp({ now: '2026-10-20T18:00:00' });
  app.state({ onboarded: true });
  app.run(`S.activeWorkout={id:'w1',routineId:null,name:'Push',started:Date.now(),exercises:[],notes:''};
    globalThis.__btn={classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},contains(c){return this._s.has(c)}},textContent:'Discard workout'};
    (g=>{document.getElementById=id=>id==='fin-discard'?__btn:g(id);})(document.getElementById);`);
  app.run(`finDiscard()`);
  assert.ok(app.run(`!!S.activeWorkout`), 'the first tap only arms it');
  assert.ok(app.run(`__btn.classList.contains('armed')`));
  assert.match(app.run(`__btn.textContent`), /Tap again/);
  app.run(`finDiscard()`);
  assert.equal(app.run(`S.activeWorkout`), null, 'the second tap discards');
});

test('an armed discard disarms itself when the sheet closes', () => {
  const app = loadApp({ now: '2026-10-20T18:00:00' });
  app.state({ onboarded: true });
  app.run(`S.activeWorkout={id:'w1',routineId:null,name:'Push',started:Date.now(),exercises:[],notes:''};
    globalThis.__btn={classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},contains(c){return this._s.has(c)}},textContent:'Discard workout'};
    (g=>{document.getElementById=id=>id==='fin-discard'?__btn:g(id);})(document.getElementById);`);
  app.run(`finDiscard();finDiscardDisarm();finDiscard()`);
  assert.ok(app.run(`!!S.activeWorkout`), 'after disarming, one tap only arms again');
});
