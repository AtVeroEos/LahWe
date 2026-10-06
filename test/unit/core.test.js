'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const set = (w, r, o) => Object.assign({ w: String(w), r: String(r), done: true }, o || {});
const at = (iso) => new Date(iso).getTime();

test('day keys are local calendar days, not UTC', () => {
  const app = loadApp({ now: '2026-03-10T22:20:00' }); // 10:20 pm Eastern = 02:20 UTC on the 11th
  assert.equal(app.run('today()'), '2026-03-10');
  assert.equal(app.run(`dayOf(${at('2026-03-10T23:59:00')})`), '2026-03-10');
  assert.equal(app.run('daysAgoStr(1)'), '2026-03-09');
});
test('date arithmetic survives the daylight-saving changes', () => {
  const app = loadApp();
  assert.equal(app.run(`addDays('2026-03-07',1)`), '2026-03-08'); // spring forward
  assert.equal(app.run(`addDays('2026-03-08',1)`), '2026-03-09');
  assert.equal(app.run(`addDays('2026-11-01',1)`), '2026-11-02'); // fall back
  assert.equal(app.run(`daysBetween('2026-03-01','2026-03-15')`), 14);
  assert.equal(app.run(`daysBetween('2026-10-25','2026-11-08')`), 14);
});
test('e1rm takes strings, ignores junk, and never returns NaN', () => {
  const app = loadApp();
  assert.equal(app.run(`e1rm('225','5')`), 263);
  assert.equal(app.run(`e1rm(100,1)`), 100);
  assert.equal(app.run(`e1rm('100','1')`), 100); // used to compare "1"===1 and return 103
  for (const args of [`'',5`, `225,''`, `0,5`, `'abc',5`, `225,0`, `null,null`, `-50,5`]) assert.equal(app.run(`e1rm(${args})`), 0, args);
});
test('volume and set counts ignore warm-ups, unfinished and timed sets', () => {
  const app = loadApp();
  app.set('__wk', { exercises: [
    { exId: 'bb-bench', sets: [set(45, 10, { warmup: true }), set(225, 5), set(225, 5, { done: false })] },
    { exId: 'plank', timed: true, sets: [set('', 60)] },
  ] });
  assert.equal(app.run('totalVol(__wk)'), 1125);
  assert.equal(app.run('doneSetCnt(__wk)'), 2);
});

test('PRs are rebuilt from history: warm-ups and excluded sets never count', () => {
  const app = loadApp();
  app.state({ workouts: [
    { id: 'a', started: at('2026-06-01T18:00:00'), exercises: [{ exId: 'bb-bench', sets: [set(315, 1, { warmup: true }), set(225, 5), set(2250, 5, { excl: true }), set(230, 3, { done: false })] }] },
    { id: 'b', started: at('2026-06-08T18:00:00'), exercises: [{ exId: 'bb-bench', sets: [set(235, 5)] }] },
  ] });
  assert.deepEqual(app.json(`[S.prs['bb-bench'].w,S.prs['bb-bench'].r,S.prs['bb-bench'].date]`), [235, 5, '2026-06-08']);
  app.run(`S.workouts=S.workouts.filter(w=>w.id!=='b');rebuildPRs()`);
  assert.equal(app.run(`S.prs['bb-bench'].w`), 225, 'deleting the workout removes the PR it set');
  app.run(`S.workouts=[];rebuildPRs()`);
  assert.equal(app.run(`S.prs['bb-bench']`), undefined);
});
test('a first-ever lift counts as a PR and the live session is included', () => {
  const app = loadApp();
  app.state({ activeWorkout: { id: 'x', started: Date.now(), exercises: [{ exId: 'squat', sets: [set(185, 5)] }] } });
  assert.equal(app.run(`S.prs.squat.live`), true);
  assert.equal(app.run(`S.prs.squat.est`), 216);
});

test('autofill: last session supplies loads, the routine supplies the set count, warm-ups stay warm-ups', () => {
  const app = loadApp();
  app.state({
    routines: [{ id: 'r1', name: 'Push', exercises: [{ exId: 'bb-bench', sets: 3, r: '5', type: 'flat' }] }],
    workouts: [{ id: 'a', routineId: 'r1', started: at('2026-06-01T18:00:00'), exercises: [{ exId: 'bb-bench', sets: [set(45, 10, { warmup: true }), set(135, 5, { warmup: true }), set(225, 5), set(225, 5), set(225, 4), set(225, 3), set(225, 2)] }] }],
  });
  const ex = app.json(`sessionExercise('bb-bench','r1',S.routines[0].exercises[0])`);
  assert.deepEqual(ex.sets.map(s => !!s.warmup), [true, true, false, false, false], 'two warm-ups, three working sets (routine says 3, last time did 5)');
  assert.deepEqual(ex.sets.filter(s => !s.warmup).map(s => s.w), ['225', '225', '225']);
  assert.ok(ex.sets.every(s => !s.done));
});
test('"+ Set" continues the working weight instead of the warm-up weight', () => {
  const app = loadApp();
  app.state({ activeWorkout: { id: 'x', started: Date.now(), exercises: [{ exId: 'bb-bench', progression: 'flat', sets: [set(135, 5, { warmup: true, done: false }), set(225, 5, { done: false }), set(225, 5, { done: false })] }] } });
  app.run('addSet(0)');
  const sets = app.json('S.activeWorkout.exercises[0].sets');
  assert.equal(sets.length, 4);
  assert.equal(sets[3].w, '225');
  assert.ok(!sets[3].warmup);
});
test('rep targets: range, AMRAP and timed are formatted, and a range is not pre-filled as fixed reps', () => {
  const app = loadApp();
  assert.equal(app.run(`fmtTarget({sets:3,r:'8',rMax:'12'})`), '3 × 8–12');
  assert.equal(app.run(`fmtTarget({sets:2,r:'10',amrap:true})`), '2 × 10+ AMRAP');
  assert.equal(app.run(`fmtTarget({sets:3,amrap:true})`), '3 × AMRAP');
  assert.equal(app.run(`fmtTarget({sets:3,r:'45',timed:true})`), '3 × 45s');
  const ex = app.json(`sessionExercise('plank',null,{exId:'plank',sets:3,r:'45',timed:true,note:'brace'})`);
  assert.equal(ex.timed, true); assert.equal(ex.note, 'brace'); assert.equal(ex.target.r, '45');
});

test('energy: a late-morning breakfast is not a 1,700 kcal deficit', () => {
  const app = loadApp({ now: '2026-06-15T10:00:00' });
  app.state({ bodyweight: 185, height: 70, meals: [{ id: 'm', date: '2026-06-15', type: 'Breakfast', cals: 400, protein: 30, carbs: 40, fat: 12 }] });
  const e = app.json(`energyBalance('2026-06-15')`);
  assert.equal(e.partial, true);
  assert.ok(Math.abs(e.base - e.fullBase * (10 / 24)) < 3, 'baseline prorated to 10 of 24 hours');
  assert.ok(e.net > -700 && e.net < 0, `net so far is ${e.net}`);
  const y = app.json(`energyBalance('2026-06-14')`);
  assert.equal(y.partial, false); assert.equal(y.base, y.fullBase);
});
test('energy: a session left open is credited for time trained, capped at three hours', () => {
  const app = loadApp();
  app.state({ bodyweight: 185 });
  const start = at('2026-06-15T06:00:00');
  app.set('__wk', { started: start, ended: start + 6 * 3600000, exercises: [{ exId: 'squat', sets: [set(225, 5, { t: start + 50 * 60000 })] }] });
  assert.equal(app.run('workoutActiveMs(__wk)'), 55 * 60000, 'stops five minutes after the last set');
  app.set('__wk2', { started: start, ended: start + 6 * 3600000, exercises: [] });
  assert.equal(app.run('workoutActiveMs(__wk2)'), 3 * 3600000);
  assert.ok(app.run('sessionCals(6*3600000)') === app.run('sessionCals(3*3600000)'));
  assert.ok(app.run('sessionCals(3600000)') > 350 && app.run('sessionCals(3600000)') < 400, '185 lb × 4.5 MET ≈ 378 kcal/h');
});
test('energy: exercise is added net of the resting burn already in the baseline', () => {
  const app = loadApp();
  assert.equal(Math.round(app.run('netOfRest(450,4.5)')), 350);
  assert.equal(app.run('netOfRest(100,1)'), 100);
});
test('nutrition: Quick Log is added to logged meals, never replaced by them', () => {
  const app = loadApp();
  app.state({ meals: [{ id: 'm', date: '2026-06-15', cals: 300, protein: 20, carbs: 30, fat: 10 }], macroLogs: { '2026-06-15': { protein: 100, carbs: 150, fat: 50, cals: 1500 } } });
  const t = app.json(`getDayTotals('2026-06-15')`);
  assert.equal(t.cals, 1800); assert.equal(t.protein, 120); assert.equal(t.fromMeals, true); assert.equal(t.quick.cals, 1500);
  assert.equal(app.json(`getDayTotals('2026-06-14')`).cals, 0);
});
test('weight trend is a fit over the last four weeks, not first-vs-last ever', () => {
  const app = loadApp({ now: '2026-06-29T12:00:00' });
  app.state({ bodyweightLog: [{ date: '2025-01-01', weight: 230 }, { date: '2026-06-08', weight: 193 }, { date: '2026-06-15', weight: 192 }, { date: '2026-06-22', weight: 191 }, { date: '2026-06-29', weight: 190 }] });
  const t = app.json('weightTrend()');
  assert.equal(t.perWeek, -1); assert.equal(t.days, 21);
  app.state({ bodyweightLog: [{ date: '2025-01-01', weight: 230 }, { date: '2026-06-29', weight: 190 }] });
  assert.equal(app.run('weightTrend()'), null, 'one recent reading is not a trend');
});

test('unit switch converts stored numbers both ways', () => {
  const app = loadApp();
  app.state({ unit: 'lbs', bodyweight: 185, bodyweightLog: [{ date: '2026-06-01', weight: 185 }], weightGoal: 180,
    routines: [{ id: 'r', name: 'R', exercises: [{ exId: 'squat', sets: 3, w: '225', r: '5' }] }],
    workouts: [{ id: 'a', started: at('2026-06-01T18:00:00'), exercises: [{ exId: 'squat', sets: [set(225, 5), set('', 10)] }] }] });
  app.run(`convertStoredWeights('kg')`);
  const s = app.json('({u:S.unit,w:S.workouts[0].exercises[0].sets[0].w,blank:S.workouts[0].exercises[0].sets[1].w,rw:S.routines[0].exercises[0].w,bw:S.bodyweight,goal:S.weightGoal,pr:S.prs.squat})');
  assert.equal(s.u, 'kg'); assert.equal(s.w, '102'); assert.equal(s.blank, ''); assert.equal(s.rw, '102');
  assert.ok(Math.abs(s.bw - 83.9) < 0.11); assert.ok(Math.abs(s.goal - 81.6) < 0.11);
  assert.equal(s.pr.w, 102); assert.equal(s.pr.est, 119);
  assert.ok(Math.abs(app.run('bwKg()') - 83.9) < 0.11, 'bodyweight in kg is not divided by 2.2 a second time');
  app.run(`convertStoredWeights('lbs')`);
  assert.equal(app.run('S.workouts[0].exercises[0].sets[0].w'), '225');
});

test('streak: rest days never break it; a missed planned day does', () => {
  const app = loadApp({ now: '2026-06-19T09:00:00' }); // Friday morning, nothing logged yet today
  const day = (d) => ({ id: d, started: at(d + 'T18:00:00'), exercises: [] });
  const group = { id: 'g', name: 'G', mode: 'daypicker', active: true, routineIds: ['r1'], dayMap: { r1: [1, 3, 5] } }; // Mon Wed Fri
  const routines = [{ id: 'r1', name: 'R', exercises: [{ exId: 'squat', sets: 3 }] }];
  app.state({ routines, groups: [group], workouts: [day('2026-06-17'), day('2026-06-15'), day('2026-06-12'), day('2026-06-10')] });
  assert.equal(app.run('getStreak()'), 4, 'Tue/Thu/weekend are rest days');
  app.state({ routines, groups: [group], workouts: [day('2026-06-17'), day('2026-06-12'), day('2026-06-10')] });
  assert.equal(app.run('getStreak()'), 1, 'skipping Monday the 15th ends the run');
  app.state({ workouts: [day('2026-06-18'), day('2026-06-16'), day('2026-06-13'), day('2026-06-09')] });
  assert.equal(app.run('getStreak()'), 3, 'rotation: three idle days in a row (10th–12th) ends it');
});

test('normalizeState: anything becomes a complete, usable state and old saves are migrated once', () => {
  const app = loadApp();
  for (const junk of ['null', '[]', '"x"', '42', '{}', '{workouts:"nope",routines:{},groups:[null,1,{routineIds:"x"}],schedule:7,macroGoals:[],custom:[{}],meals:[{}],bodyweightLog:[{date:"2026-01-01",weight:"abc"}]}']) {
    const s = app.json(`normalizeState(${junk})`);
    assert.ok(Array.isArray(s.workouts) && Array.isArray(s.routines) && typeof s.schedule.routineOverrides === 'object', junk);
    assert.equal(s._schema, 3);
  }
  app.set('__old', { unit: 'lbs', bodyweight: 190,
    workouts: [{ id: 'w', started: at('2026-06-01T18:00:00'), ended: at('2026-06-01T18:00:00') + 6 * 3600000, cals: 2265, exercises: [{ exId: 'squat', sets: [set(315, 3)] }, { sets: [] }, null] }],
    prs: { squat: { w: 315, r: 3, est: 347, date: '2026-06-01' }, 'bb-bench': { w: '405', r: '1', date: '2025-01-01' }, junk: { w: 'x' } },
    macroGoals: { protein: 180, calories: 2400 },
    groups: [{ id: 'g', name: 'G', active: true, routineIds: ['missing'], cursor: 5 }, { id: 'g2', name: 'G2', active: true }] });
  const s = app.json('normalizeState(__old)');
  assert.deepEqual(Object.keys(s.prsManual), ['bb-bench']);
  assert.equal(s.prsManual['bb-bench'].est, 405);
  assert.equal(s.workouts[0].exercises.length, 1, 'broken exercise rows dropped');
  assert.ok(s.workouts[0].calsCapped && s.workouts[0].cals < 1300);
  assert.equal(s.macroGoals.cals, 2400); assert.equal(s.macroGoals.calories, undefined);
  assert.deepEqual(s.groups[0].routineIds, []); assert.equal(s.groups[0].cursor, 0);
  assert.equal(s.groups.filter(g => g.active).length, 1);
  app.set('__again', JSON.parse(JSON.stringify(s))); // normalizeState works in place; hand it its own copy
  assert.deepEqual(app.json('normalizeState(__again)'), s, 'running it again changes nothing');
});
test('replaceState goes through the same path as a normal load', () => {
  const app = loadApp();
  app.set('__bk', { onboarded: true, name: 'B', workouts: [{ id: 'w', started: at('2026-06-01T18:00:00'), exercises: [{ exId: 'bb-bench', sets: [set(200, 5)] }] }], custom: [{ id: 'custom-1', name: 'Z Press', cat: 'Shoulders', eq: 'Barbell', muscle: 'Shoulders', sec: ['Triceps'] }] });
  app.run('replaceState(__bk)');
  assert.equal(app.run(`S.prs['bb-bench'].w`), 200, 'PRs rebuilt');
  assert.deepEqual(app.json(`SEC_MUSCLE['custom-1']`), ['Triceps'], 'secondary muscles hydrated');
  assert.equal(app.run(`getEx('custom-1').name`), 'Z Press', 'exercise index rebuilt');
  assert.ok(JSON.parse(app.ctx.localStorage.getItem('lahwe_v2')).name === 'B', 'written immediately');
});

test('sprint timer catches up after the page was frozen', () => {
  const app = loadApp();
  const t0 = 1_000_000;
  app.set('__st', { sprintDur: 60, walkDur: 120, isSprintPhase: true, rounds: 0, phaseStart: t0, startTime: t0 });
  assert.equal(app.run(`advanceSprint(__st,${t0 + 30000})`), false);
  assert.equal(app.run(`advanceSprint(__st,${t0 + 10 * 60000 + 5000})`), true); // 10:05 later
  assert.deepEqual(app.json('[__st.isSprintPhase,__st.rounds,__st.phaseStart]'), [false, 3, t0 + 9 * 60000 + 60000 - 60000 + 60000]);
});

test('barcode lookups: ids are cleaned, energy falls back from kJ, serving figures are never mixed', () => {
  const app = loadApp();
  assert.equal(app.run(`cleanBarcode("0123'\\");alert(1)//")`), '0123alert1');
  app.set('__p', { product_name: 'Oil', brands: 'A, B', serving_size: '15 ml', serving_quantity: 14, nutriments: { 'energy-kj_100g': 3700, fat_100g: 100, fat_serving: 14, 'energy-kcal_serving': 124 } });
  const p = app.json('offToProduct(__p)');
  assert.equal(p.per100.cals, 884); assert.equal(p.brand, 'A');
  assert.deepEqual(app.json('scanServingBase(offToProduct(__p))'), { protein: 0, carbs: 0, fat: 14, cals: 124 }, 'zero protein per serving stays zero');
  app.set('__q', { product_name: 'Rice', serving_quantity: 50, nutriments: { 'energy-kcal_100g': 360, carbohydrates_100g: 80, proteins_100g: 7 } });
  assert.deepEqual(app.json('scaleMacros(scanServingBase(offToProduct(__q)),1)'), { protein: 3.5, carbs: 40, fat: 0, cals: 180 });
  assert.equal(app.run('validProduct({per100:{},perServing:{}})'), false);
});
