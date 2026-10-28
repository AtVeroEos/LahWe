'use strict';
// A button that cannot do anything right now is not drawn. These cover the screens where one used
// to sit there greyed out or silently doing nothing.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-06-15T18:30:00';
const live = (ids, n) => {
  const app = loadApp({ now: NOW });
  app.run(`S.activeWorkout={id:'w1',routineId:null,name:'T',started:Date.now(),exercises:${JSON.stringify(ids)}.map(id=>sessionExercise(id,null,{exId:id,sets:${n || 3},r:'8'})),notes:''};`);
  return app;
};
const sessionHTML = app => app.run(`(()=>{const el=document.createElement('div');renderSession(el);return el.innerHTML;})()`);
// Overlays are built off-page; record what gets appended to the body so a test can read it.
const overlay = (app, code) => app.run(`(()=>{window.__ovs=[];document.body.appendChild=e=>{__ovs.push(e);return e};${code};const o=__ovs[__ovs.length-1];return o?o.innerHTML:'';})()`);
const menuHTML = (app, ei) => overlay(app, `showExMenu(${ei})`);

test('the open lift shows − Set +, Note and Swap; superset, warm-up and the rest live in the ⋯ menu', () => {
  const app = live(['bb-bench', 'bb-row'], 3);
  const html = sessionHTML(app);
  assert.match(html, /addSet\(0\)/);
  assert.match(html, /rmLastSet\(0\)/);
  assert.doesNotMatch(html, /toggleSessionLink\(/, 'linking is in the menu, not on the lift');
  assert.doesNotMatch(html, /addWarmup\(/, 'warm-up is in the menu, not on the row');
  assert.doesNotMatch(html, /showPyramid\(/);
  assert.match(html, /showSwap\(0\)/, 'swap is under the sets');
  assert.match(html, /showExNote\(0\)/, 'so is the note');
  const menu = menuHTML(app, 0);
  assert.match(menu, /addWarmup\(0\)/);
  assert.match(menu, /toggleSessionLink\(0\)/);
  assert.doesNotMatch(menu, /showSwap\(|showExNote\(/, 'not twice');
});

test('− is not drawn when there is only one set (it would do nothing)', () => {
  const app = live(['bb-bench'], 1);
  assert.doesNotMatch(sessionHTML(app), /rmLastSet/);
  assert.match(sessionHTML(app), /addSet\(0\)/);
});

test('the last exercise has no superset item, and the menu has no Move down', () => {
  const app = live(['bb-bench', 'bb-row'], 2);
  assert.doesNotMatch(menuHTML(app, 1), /toggleSessionLink\(1\)/);
  assert.doesNotMatch(menuHTML(app, 1), /moveExInSession\(1,1\)/);
  assert.match(menuHTML(app, 1), /moveExInSession\(1,-1\)/);
});

test('a set still to do has no tag button; a ticked one does', () => {
  const app = live(['bb-bench'], 2);
  app.run(`S.activeWorkout.exercises[0].sets.forEach(s=>{s.w='100';s.r='5';})`);
  assert.doesNotMatch(sessionHTML(app), /toggleTagRow\(/);
  app.run(`togSet(0,0)`);
  const h = sessionHTML(app);
  assert.match(h, /toggleTagRow\(0,0\)/);
  assert.doesNotMatch(h, /toggleTagRow\(0,1\)/);
});

test('swipe Undo is hidden until there is something to undo', () => {
  const app = live(['bb-bench'], 2);
  app.run(`S.activeWorkout.exercises[0].sets.forEach(s=>{s.w='100';s.r='5';});S.activeWorkout._swipe='simple';`);
  const page = () => app.run(`(()=>{const el=document.createElement('div');renderSwipe(el);return el.innerHTML;})()`);
  const undoBtn = h => (h.match(/<button[^>]*swipeUndo\(\)[^>]*>/) || [''])[0];
  let h = page();
  assert.equal(undoBtn(h), '', 'nothing to undo yet: no Undo at all');
  app.run(`swipeLog('ok')`);
  h = page();
  assert.ok(undoBtn(h), 'after a set, Undo is there');
  assert.doesNotMatch(undoBtn(h), /visibility:hidden|disabled/);
});

test('"Already in this workout" rows are not listed when adding an exercise to a workout', () => {
  const app = loadApp({ now: NOW });
  app.run(`S.routines=[{id:'r1',name:'Push',active:true,exercises:[{exId:'bb-bench',sets:3}]},{id:'r2',name:'Pull',active:true,exercises:[{exId:'bb-row',sets:3}]}]`);
  const html = overlay(app, `showAddToRoutine('bb-bench')`);
  assert.doesNotMatch(html, /Push/);
  assert.match(html, /Pull/);
  assert.doesNotMatch(html, /disabled/);
  app.run(`S.routines=[{id:'r1',name:'Push',active:true,exercises:[{exId:'bb-bench',sets:3}]}]`);
  assert.match(overlay(app, `showAddToRoutine('bb-bench')`), /Already in all of your workouts/);
});

test('the coach quick-workout card offers Start now only when no workout is running', () => {
  const app = loadApp({ now: NOW });
  const card = () => app.run(`coachCardHTML({kind:'propose_quick_workout',title:'Quick Push',status:'pending'},0,0)`);
  assert.match(card(), /Start now/);
  assert.match(card(), /Save as a workout/);
  app.run(`S.activeWorkout={id:'w1',routineId:null,name:'T',started:Date.now(),exercises:[],notes:''}`);
  assert.doesNotMatch(card(), /Start now/);
  assert.match(card(), /Save as a workout/);
  assert.doesNotMatch(card(), /disabled/);
});
