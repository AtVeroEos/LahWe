'use strict';
// 3.13: Swipe Check, the Last chip, failed and skipped sets, the bodyweight pyramid, and the running
// screens as closed rows. The gesture itself is covered by test/e2e/swipe.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-06-15T18:30:00';
// A live workout of the named lifts, each with `n` blank working sets, with no history behind them.
const live = (ids, n) => {
  const app = loadApp({ now: NOW });
  app.run(`S.activeWorkout={id:'w1',routineId:null,name:'T',started:Date.now(),exercises:${JSON.stringify(ids)}.map(id=>sessionExercise(id,null,{exId:id,sets:${n || 3},r:'8'})),notes:''};`);
  return app;
};
const sets = (app, ei) => app.json(`S.activeWorkout.exercises[${ei}].sets`);

test('pyramidReps: up, down, and up-and-down, clamped and the right length', () => {
  const app = loadApp({ now: NOW });
  const p = (n, s, st, sh) => app.json(`pyramidReps(${n},${s},${st},'${sh}')`);
  assert.deepEqual(p(5, 5, 2, 'up'), [5, 7, 9, 11, 13]);
  assert.deepEqual(p(5, 15, 3, 'down'), [15, 12, 9, 6, 3]);
  assert.deepEqual(p(6, 10, 4, 'down'), [10, 6, 2, 1, 1, 1], 'never below one rep');
  assert.deepEqual(p(5, 5, 2, 'updown'), [5, 7, 9, 7, 5]);
  assert.deepEqual(p(4, 5, 2, 'updown'), [5, 7, 7, 5]);
  assert.deepEqual(p(2, 6, 1, 'updown'), [6, 6]);
  assert.deepEqual(p(0, 5, 1, 'up'), []);
  assert.deepEqual(p(3, 0, 0, 'up'), [1, 2, 3], 'a zero start or step is taken as one');
});

test('applying a pyramid changes only the sets that are not finished', () => {
  const app = live(['pushup'], 4);
  app.run(`S.activeWorkout.exercises[0].sets[0].r='10';togSet(0,0);showPyramid(0)`);
  app.run(`pyrSet('shape','up');pyrSet('step',3);pyrSet('start',6);applyPyramid()`);
  const s = sets(app, 0);
  assert.equal(s[0].r, '10', 'the finished set keeps what was logged');
  assert.deepEqual(s.map(x => x.r), ['10', '9', '12', '15'], 'the rest follow the pyramid from set 1 of the plan: 6, 9, 12, 15');
  assert.equal(s[0].done, true);
});

test('a pyramid needs two sets', () => {
  const app = live(['pushup'], 1);
  app.run('showPyramid(0)');
  assert.equal(app.run('_pyr'), null);
});

test('Last copies last session into the sets still to do, and leaves finished sets alone', () => {
  const app = loadApp({ now: NOW });
  app.state({ workouts: [{ id: 'old', name: 'Push', started: new Date('2026-06-08T17:00:00').getTime(), ended: new Date('2026-06-08T18:00:00').getTime(),
    exercises: [{ exId: 'bb-bench', sets: [{ w: '135', r: '8', done: true }, { w: '145', r: '6', done: true }, { w: '155', r: '4', done: true }] }] }] });
  app.run(`S.activeWorkout={id:'w1',routineId:null,name:'T',started:Date.now(),exercises:[sessionExercise('bb-bench',null,{exId:'bb-bench',sets:3,r:'8'})],notes:''};`);
  app.run(`S.activeWorkout.exercises[0].sets[0].w='100';S.activeWorkout.exercises[0].sets[0].r='9';togSet(0,0);applyLast(0)`);
  const s = sets(app, 0);
  assert.deepEqual([s[0].w, s[0].r, s[0].done], ['100', '9', true], 'the finished set is not touched');
  assert.deepEqual([s[1].w, s[1].r], ['145', '6'], 'set 2 gets last time’s set 2');
  assert.deepEqual([s[2].w, s[2].r], ['155', '4']);
  assert.equal(s[1]._manual, true, 'a ramp that differs from the straight rule is kept as copied');
});

test('Last with no earlier session says so and changes nothing', () => {
  const app = live(['bb-bench'], 2);
  app.run('applyLast(0)');
  assert.deepEqual(sets(app, 0).map(x => [x.w, x.r]), [['', '8'], ['', '8']]);
});

test('a failed set is real work but never a record; a skipped set is not work at all', () => {
  const app = live(['bb-bench'], 3);
  app.run(`const s=S.activeWorkout.exercises[0].sets;s[0].w='200';s[0].r='5';s[1].w='300';s[1].r='3';s[1].fail=true;s[2].w='400';s[2].r='1';s[2].skip=true;togSet(0,0);togSet(0,1);`);
  assert.equal(app.run('S.prs["bb-bench"].w'), 200, 'the failed 300 is no record');
  assert.equal(app.run('doneSetCnt(S.activeWorkout)'), 2, 'the failed set counts as a set done');
  assert.equal(app.run('totalVol(S.activeWorkout)'), 200 * 5 + 300 * 3);
  assert.equal(app.run('setCounts(S.activeWorkout.exercises[0].sets[2])'), false);
  // taking a set back off clears its failure; completing a skipped set clears the skip
  app.run('togSet(0,1);togSet(0,2)');
  const s = sets(app, 0);
  assert.equal(s[1].fail, undefined);
  assert.deepEqual([s[2].done, s[2].skip], [true, undefined]);
});

test('a missed set shows up in next time’s aim as a miss', () => {
  const app = loadApp({ now: NOW });
  app.state({ workouts: [{ id: 'old', name: 'Push', started: new Date('2026-06-08T17:00:00').getTime(), ended: new Date('2026-06-08T18:00:00').getTime(),
    exercises: [{ exId: 'bb-bench', sets: [{ w: '135', r: '8', done: true }, { w: '135', r: '8', done: true }, { w: '135', r: '5', done: true, fail: true }] }] }] });
  const a = app.json(`ruleTarget('bb-bench',{exId:'bb-bench',sets:3,r:'8'},null)`);
  assert.equal(a.kind, 'hold', 'a miss at 135 means repeat 135, not add weight');
  assert.equal(a.w, 135);
});

test('swipe order: straight lifts set by set, supersets round by round, warm-ups first', () => {
  const app = live(['bb-bench', 'pushup', 'squat'], 2);
  app.run(`const a=S.activeWorkout.exercises;a[0].link=a[1].link='ss-1';addWarmup(0)`);
  const o = app.json('swipeOrder(S.activeWorkout).map(x=>x.ei+"."+x.si)');
  // bench has a warm-up at index 0, so its working sets are 1 and 2; pushup's are 0 and 1
  assert.deepEqual(o, ['0.0', '0.1', '1.0', '0.2', '1.1', '2.0', '2.1']);
});

test('swiping right logs the set and moves on; the superset partner comes next', () => {
  const app = live(['bb-bench', 'pushup'], 2);
  app.run(`const a=S.activeWorkout.exercises;a[0].link=a[1].link='ss-1';a[0].sets[0].w='100';a[0].sets[0].r='8';a[0].sets[1].w='100';a[0].sets[1].r='8';a[1].sets[0].r='10';a[1].sets[1].r='10';`);
  let cur = app.json('swipePending(S.activeWorkout)');
  assert.deepEqual([cur.ei, cur.si], [0, 0]);
  app.run(`swipeLog('ok')`);
  cur = app.json('swipePending(S.activeWorkout)');
  assert.deepEqual([cur.ei, cur.si], [1, 0], 'the next card is the other lift in the superset');
  assert.equal(app.run('S.activeWorkout.exercises[0].sets[0].done'), true);
  assert.equal(app.run('S.restTimer'), null, 'no rest between the two halves of a superset');
  app.run(`swipeLog('ok')`);
  assert.notEqual(app.run('S.restTimer'), null, 'rest starts after the last lift of the round');
  cur = app.json('swipePending(S.activeWorkout)');
  assert.deepEqual([cur.ei, cur.si], [0, 1]);
});

test('swipe plan: a weighted lift with no weight is refused, no reps asks, a left swipe asks how many', () => {
  const app = live(['bb-bench'], 2);
  assert.deepEqual(app.json(`swipePlan('r')`), { act: 'block', msg: 'Set the weight first (+ or −)' });
  app.run(`S.activeWorkout.exercises[0].sets[0].w='100'`);
  assert.deepEqual(app.json(`swipePlan('r')`), { act: 'log', kind: 'ok' });
  assert.deepEqual(app.json(`swipePlan('l')`), { act: 'ask', kind: 'fail' }, 'reps were never touched, so ask');
  app.run(`swipeAdj('r',-1)`);
  assert.equal(app.run('S.activeWorkout.exercises[0].sets[0].r'), '7');
  assert.deepEqual(app.json(`swipePlan('l')`), { act: 'log', kind: 'fail' }, 'you already typed what you got');
  app.run(`S.activeWorkout.exercises[0].sets[0].r=''`);
  assert.deepEqual(app.json(`swipePlan('r')`), { act: 'ask', kind: 'ok' }, 'a set with no reps has to ask');
});

test('bodyweight lifts swipe without a weight', () => {
  const app = live(['pushup'], 2);
  assert.deepEqual(app.json(`swipePlan('r')`), { act: 'log', kind: 'ok' });
});

test('a missed set is logged at the reps you pick; 0 reps is a skip', () => {
  const app = live(['bb-bench'], 3);
  app.run(`S.activeWorkout.exercises[0].sets.forEach(s=>s.w='100');_sw.ask={kind:'fail'};swipeAskPick(5)`);
  let s = sets(app, 0);
  assert.deepEqual([s[0].r, s[0].done, s[0].fail], ['5', true, true]);
  app.run(`_sw.ask={kind:'fail'};swipeAskPick(0)`);
  s = sets(app, 0);
  assert.deepEqual([s[1].done, s[1].skip], [false, true], '0 reps was never attempted');
  assert.equal(app.run('S.prs["bb-bench"]'), undefined, 'no record from a missed set');
});

test('skipped sets leave the queue, and can be brought back; the finish card counts everything', () => {
  const app = live(['bb-bench'], 2);
  app.run(`S.activeWorkout.exercises[0].sets.forEach(s=>s.w='100');swipeSkip();swipeLog('ok')`);
  assert.equal(app.json('swipePending(S.activeWorkout)'), null);
  assert.deepEqual(app.json('swipeCounts(S.activeWorkout)'), { total: 2, done: 1, failed: 0, skipped: 1, left: 0 });
  app.run('swipeReviveSkipped()');
  assert.deepEqual(app.json('swipePending(S.activeWorkout)'), { ei: 0, si: 0, round: 0 });
});

test('undo puts a set back exactly as it was, including the record it made', () => {
  const app = live(['bb-bench'], 2);
  app.run(`S.activeWorkout.exercises[0].sets.forEach(s=>s.w='100');swipeLog('ok')`);
  assert.equal(app.run('S.prs["bb-bench"].w'), 100);
  app.run('swipeUndo()');
  const s = sets(app, 0)[0];
  assert.deepEqual([s.done, s.fail, s.skip, s.t], [false, undefined, undefined, undefined]);
  assert.equal(app.run('S.prs["bb-bench"]'), undefined, 'the record goes with it');
  assert.equal(app.run('S.restTimer'), null, 'and the rest it started');
});

test('weight steppers: a straight lift carries the change to the sets still to do; a pyramid does not', () => {
  const app = live(['bb-bench'], 3);
  app.run(`S.activeWorkout.exercises[0].sets.forEach(s=>s.w='100');swipeAdj('w',1)`);
  assert.deepEqual(sets(app, 0).map(x => x.w), ['105', '105', '105']);
  const app2 = live(['bb-bench'], 3);
  app2.run(`S.activeWorkout.exercises[0].progression='ascend';S.activeWorkout.exercises[0].sets.forEach(s=>s.w='100');recalcExercise(0);swipeLog('ok');swipeAdj('w',1)`);
  const w = sets(app2, 0).map(x => +x.w);
  assert.equal(w[1], 110, 'set 2 was 105; one step up');
  assert.equal(w[2], 115, 'set 3 still climbs from the new weight, it is not flattened to it');
});

test('entering and leaving swipe mode, and nothing of it is saved into history', () => {
  const app = live(['bb-bench'], 2);
  app.run(`S.activeWorkout.exercises[0].sets.forEach(s=>{s.w='100';s.r='5';});enterSwipe('super')`);
  assert.equal(app.run('S.activeWorkout._swipe'), 'super');
  app.run(`swipeLog('ok');exitSwipe()`);
  assert.equal(app.run('S.activeWorkout._swipe'), undefined);
  app.run(`enterSwipe('simple');saveWorkout()`);
  const wk = app.json('S.workouts[0]');
  assert.equal(wk._swipe, undefined);
  assert.equal(wk._swipeUndo, undefined);
});

test('a failed set reads "failed" in history', () => {
  const app = live(['bb-bench'], 1);
  app.run(`S.activeWorkout.exercises[0].sets[0].w='100';S.activeWorkout.exercises[0].sets[0].r='3';S.activeWorkout.exercises[0].sets[0].fail=true;togSet(0,0);saveWorkout()`);
  assert.match(app.run('wkDetailExHTML(S.workouts[0])'), /100×3 · failed/);
});

test('running sections: a closed row with its headline, the heading dropped, open rows remembered', () => {
  const app = loadApp({ now: NOW });
  const h = app.run(`runFold('load','Training load','1.1× your usual','<div class="sec-h">Training load</div><div id="x">body</div>')`);
  assert.match(h, /<details class="rfold" id="rf-load"/);
  assert.match(h, /<span class="rf-t">Training load<\/span><span class="rf-s">1\.1× your usual<\/span>/);
  assert.equal((h.match(/Training load/g) || []).length, 1, 'the section heading is the row title, not repeated');
  assert.doesNotMatch(h, / open /);
  app.run(`runFoldToggle('load',true)`);
  assert.match(app.run(`runFold('load','T','s','<p>x</p>')`), /id="rf-load" open /);
  assert.equal(app.run(`runFold('load','T','s','')`), '', 'a section with nothing to show has no row');
  assert.match(app.run(`runFold('shoes','Shoes','1 past 400 mi','<p>x</p>','warn')`), /rf-s warn/);
});

test('the halves of a run: negative split, even, and none for a short or untimed one', () => {
  const app = loadApp({ now: NOW });
  const rt = (t) => `{n:3,timed:${t != null},d:[0,1609.344,3218.688],t:${JSON.stringify(t || [])}}`;
  assert.equal(app.run(`routeHalves({n:2,timed:false,d:[0,5000],t:[]})`), null);
  assert.equal(app.run(`routeHalves({n:2,timed:true,d:[0,800],t:[0,300]})`), null, 'under a mile');
  const even = app.json(`routeHalves(${rt([0, 600, 1200])})`);
  assert.equal(even.even, true);
  const neg = app.json(`routeHalves(${rt([0, 630, 1200])})`); // 10:30 then 9:30
  assert.equal(neg.even, false);
  assert.ok(neg.diff > 0, 'the second half was the faster one');
});
