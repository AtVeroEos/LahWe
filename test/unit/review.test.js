'use strict';
// Regression tests for defects found by an independent review of the rework.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const set = (w, r, o) => Object.assign({ w: String(w), r: String(r), done: true }, o || {});
const at = iso => new Date(iso).getTime();

test('starting a routine while a workout is open does not discard the open workout', () => {
  const app = loadApp();
  app.state({ routines: [{ id: 'r1', name: 'A', exercises: [{ exId: 'squat', sets: 3 }] }, { id: 'r2', name: 'B', exercises: [{ exId: 'bb-bench', sets: 3 }] }] });
  app.run(`startWorkout('r1');S.activeWorkout.exercises[0].sets[0].w='225';S.activeWorkout.exercises[0].sets[0].r='5';togSet(0,0)`);
  const id = app.run('S.activeWorkout.id');
  app.run(`startWorkout('r2')`);
  assert.equal(app.run('S.activeWorkout.id'), id);
  assert.equal(app.run('S.activeWorkout.exercises[0].sets[0].done'), true);
  assert.equal(app.run('S.tab'), 'workout');
});
test('a set excluded from records does not pre-fill the next session', () => {
  const app = loadApp();
  app.state({ workouts: [{ id: 'a', started: at('2026-06-01T18:00:00'), exercises: [{ exId: 'bb-bench', sets: [set(2250, 5, { excl: true }), set(225, 5)] }] }] });
  assert.deepEqual(app.json(`getAutoFill('bb-bench',null)`).map(s => s.w), ['225']);
  assert.doesNotMatch(app.run(`getLastStr('bb-bench',null)`), /2250/);
});
test('a PR keeps the date it was first set when it is matched again later', () => {
  const app = loadApp();
  app.state({ workouts: [
    { id: 'new', started: at('2026-06-08T18:00:00'), exercises: [{ exId: 'squat', sets: [set(315, 3)] }] },
    { id: 'old', started: at('2026-05-01T18:00:00'), exercises: [{ exId: 'squat', sets: [set(315, 3)] }] },
  ] });
  assert.deepEqual(app.json('[S.prs.squat.date,S.prs.squat.wkId]'), ['2026-05-01', 'old']);
});
test("today's activity and weigh-in count before noon", () => {
  const app = loadApp({ now: '2026-06-15T09:00:00' });
  app.state({ activities: [{ id: 'a', type: 'run', date: '2026-06-15', dur: '30', cals: 300 }], bodyweightLog: [{ date: '2026-06-15', weight: 180 }, { date: '2026-06-14', weight: 190 }, { date: '2026-06-05', weight: 192 }] });
  assert.deepEqual(app.json('getWeeklyActivity(2)'), [0, 1]);
  assert.equal(app.json('bwRateInfo()').cur, 185, '7-day average includes this morning');
});
test('a rest of zero starts no timer; other rests are honoured', () => {
  const app = loadApp();
  app.state({ routines: [{ id: 'r1', name: 'A', exercises: [{ exId: 'squat', sets: 2, r: '5', rest: 0 }, { exId: 'bb-bench', sets: 2, r: '5', rest: 45 }] }] });
  app.run(`startWorkout('r1');S.activeWorkout.exercises.forEach(e=>e.sets.forEach(s=>{s.w='100';s.r='5';}));togSet(0,0)`);
  assert.equal(app.run('S.restTimer'), null);
  app.run('togSet(1,0)');
  assert.equal(app.run('S.restTimer.total'), 45);
});
test('a rest picked during a session is still there next time', () => {
  const app = loadApp();
  app.state({ routines: [{ id: 'r1', name: 'A', exercises: [{ exId: 'squat', sets: 2, r: '5', rest: 120 }] }] });
  app.run(`startWorkout('r1');setExRest('squat',180)`);
  assert.equal(app.run('S.routines[0].exercises[0].rest'), 180);
  app.run(`S.activeWorkout=null;startWorkout('r1')`);
  assert.equal(app.run(`exRestFor('squat')`), 180);
});
test('rep parsing: bracketed pauses, distances and minute ranges', () => {
  const app = loadApp();
  const p = reps => { const o = app.json(`parseReps(${JSON.stringify({ reps })})`); return [o.r, o.rMax, o.amrap, o.timed, o.extra]; };
  assert.deepEqual(p('5 (3s pause)'), ['5', '', false, false, '3s pause']);
  assert.deepEqual(p('8-10 [2 sec squeeze]'), ['8', '10', false, false, '2 sec squeeze']);
  assert.deepEqual(p('40m'), ['', '', false, false, '40m'], 'metres, not minutes');
  assert.deepEqual(p('20 yards each way'), ['', '', false, false, '20 yards each way']);
  assert.deepEqual(p('3-5 min'), ['180', '300', false, true, '']);
  assert.deepEqual(p('12 reps, 2s down'), ['12', '', false, false, '2s down']);
  assert.deepEqual(p('30s'), ['30', '', false, true, '']);
});
test('a name that happens to equal a catalog id is not treated as that id', () => {
  const app = loadApp();
  const m = n => app.run(`(matchExercise(${JSON.stringify(n)},'')||{ex:{id:null}}).ex.id`);
  assert.equal(m('Lunge'), null); assert.equal(m('Lunges'), null); assert.equal(m('Walking Lunges'), 'lunge');
  app.set('__p', { routines: [{ name: 'R', exercises: [{ exId: 'lunge', name: 'whatever', sets: 3, reps: 10 }] }] });
  assert.equal(app.json('parseImport(__p)').routines[0].exercises[0].exId, 'lunge', 'an explicit id still works');
});
test('upgrade: days that showed meals only keep that total; the Quick Log is parked, not added', () => {
  const app = loadApp();
  app.set('__old', { meals: [{ id: 'm', date: '2026-05-01', cals: 250, protein: 20, carbs: 20, fat: 10 }], macroLogs: { '2026-05-01': { protein: 150, carbs: 200, fat: 60, cals: 1810 }, '2026-05-02': { protein: 150, carbs: 200, fat: 60, cals: 1900 } } });
  app.run('S=normalizeState(__old)');
  assert.equal(app.json(`getDayTotals('2026-05-01')`).cals, 250, 'same figure the old app showed');
  assert.equal(app.json(`getDayTotals('2026-05-02')`).cals, 1900, 'a Quick-Log-only day is untouched');
  app.run(`S.meals.push({id:'n',date:'2026-06-15',cals:300});S.macroLogs['2026-06-15']={protein:0,carbs:0,fat:0,cals:500}`);
  assert.equal(app.json(`getDayTotals('2026-06-15')`).cals, 800, 'from now on the two are added');
});
test('upgrade: barcode cache entries written by the old app are repaired or refetched', () => {
  const app = loadApp();
  const m = { protein: 20, carbs: 25, fat: 9, cals: 250 };
  app.set('__old', { foodCache: {
    hand: { name: 'Bar', brand: '', serving: '60 g', servingG: 0, per100: m, perServing: Object.assign({}, m) },
    kj: { name: 'Kefir', brand: '', serving: '250 ml', servingG: 250, per100: { protein: 3, carbs: 4, fat: 3, cals: 0 }, perServing: { protein: 8, carbs: 10, fat: 8, cals: 0 } },
    fine: { name: 'Oats', brand: '', serving: '40 g', servingG: 40, per100: { protein: 13, carbs: 60, fat: 7, cals: 370 }, perServing: { protein: 5, carbs: 24, fat: 3, cals: 148 } },
    junk: 'x',
  } });
  const c = app.json('normalizeState(__old).foodCache');
  assert.deepEqual(Object.keys(c).sort(), ['fine', 'hand']);
  assert.equal(c.hand.per100.cals, 0); assert.equal(c.hand.perServing.cals, 250);
  assert.equal(c.fine.per100.cals, 370);
});
test('upgrade: a workout whose start time was stored as text keeps its date; broken rows are dropped', () => {
  const app = loadApp();
  app.set('__old', { workouts: [{ id: 'w', started: '2025-03-01T18:00:00.000Z', exercises: [] }], savedMeals: [{ id: 's', name: 'x', items: [null, { foodId: 'a b', name: 'n', qty: 1 }] }], customFoods: [{ id: 'a b', name: 'n' }], meals: [{ id: 'm', date: '2026-01-01', items: [null] }] });
  const s = app.json('normalizeState(__old)');
  assert.equal(s.workouts[0].started, Date.parse('2025-03-01T18:00:00.000Z'));
  assert.equal(s.savedMeals[0].items.length, 1); assert.equal(s.savedMeals[0].items[0].foodId, 'ab'); assert.deepEqual(s.meals[0].items, []);
});
test('a save that cannot be loaded is kept and never overwritten', async () => {
  const app = loadApp();
  app.ctx.localStorage.setItem('lahwe_v2', JSON.stringify({ onboarded: true, workouts: [{ id: 'w', started: 1, exercises: [] }] }));
  const stored = app.ctx.localStorage.getItem('lahwe_v2');
  app.run(`normalizeState=()=>{throw new Error('boom')}`);
  await app.run('boot()');
  assert.equal(app.run('Store.ready'), false); assert.equal(app.run('Store.corrupt'), stored);
  app.run('save();saveNow()');
  assert.equal(app.ctx.localStorage.getItem('lahwe_v2'), stored);
});
test('undoing a restore swaps the two data sets, so nothing is lost either way', async () => {
  const app = loadApp();
  app.state({ name: 'Mine', workouts: [{ id: 'a', started: at('2026-06-01T18:00:00'), exercises: [] }] });
  app.run(`Store.ready=true;window._restoreData={onboarded:true,name:'Backup',workouts:[]}`);
  await app.run('doRestore()');
  assert.equal(app.run('S.name'), 'Backup');
  app.run(`S.workouts.unshift({id:'later',started:Date.now(),exercises:[]});saveNow()`); // trained after restoring
  assert.equal(app.run('hasUndoSnapshot()'), true);
  await app.run('undoRestore(true)');
  assert.deepEqual(app.json('[S.name,S.workouts.length]'), ['Mine', 1]);
  await app.run('undoRestore(true)');
  assert.deepEqual(app.json('[S.name,S.workouts.map(w=>w.id)]'), ['Backup', ['later']], 'the work done after the restore is still reachable');
  app.setNow(Date.now() + 86400000); // the harness clock is fixed; move it past the expiry window
  app.setNow(new Date('2026-07-15T12:00:00'));
  assert.equal(app.run('hasUndoSnapshot()'), false, 'the offer expires');
});
test('switching unit with nothing logged still converts bodyweight and goal weight', () => {
  const app = loadApp();
  app.state({ unit: 'lbs', bodyweight: 185, weightGoal: 175 });
  app.run(`setUnit('kg')`);
  assert.deepEqual(app.json('[S.unit,S.bodyweight,S.weightGoal]'), ['kg', 83.9, 79.4]);
});
test('the timed-program banner numbers the current phase correctly', () => {
  const app = loadApp({ now: '2026-06-20T12:00:00' });
  app.state({ groups: [{ id: 'g1', name: 'One', routineIds: [] }, { id: 'g2', name: 'Two', routineIds: [] }], program: { active: true, startDate: '2026-06-01', phases: [{ groupId: 'g1', mode: 'weeks', weeks: 2 }, { groupId: 'g2', mode: 'weeks', weeks: 2 }] } });
  const cur = app.json('currentProgramPhase(today())');
  assert.equal(app.run(`programPhaseWindows().findIndex(w=>w.start===${JSON.stringify(cur.start)})`), 1);
});
