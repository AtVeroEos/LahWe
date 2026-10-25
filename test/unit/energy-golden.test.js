'use strict';
// Energy maths against values worked out by hand, not against what the code happened to print.
// A snapshot of current output would lock in any bug already there; these numbers come from the
// formulas written out below, so a change that moves them is either a fix (update the working too)
// or a regression.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-10-25T12:00:00';
// 190 lb, 70 in, man, born Jan 1996 (30 on the test day).
//   kg      = 190 / 2.20462                       = 86.1827
//   BMR     = 10×86.1827 + 6.25×177.8 − 5×30 + 5  = 861.83 + 1111.25 − 150 + 5 = 1828.08 → 1828
//   resting = 1828 × 1.2                          = 2193.6 → 2194
function man() {
  const app = loadApp({ now: NOW });
  app.state({ unit: 'lbs', bodyweight: 190, height: 70, aftGender: 'male', birthYear: 1996, birthMonth: 1 });
  return app;
}

test('Mifflin-St Jeor resting burn, by hand', () => {
  const app = man();
  assert.equal(app.run('userAge()'), 30);
  assert.equal(app.run('bmr()'), 1828);
  assert.equal(app.run('baselineBurn()'), 2194);
  // Same body, a woman: the constant is −161 instead of +5, so 166 lower. 1828.08 − 166 = 1662.08 → 1662.
  app.run(`S.aftGender='female'`);
  assert.equal(app.run('bmr()'), 1662);
  assert.equal(app.run('calorieFloor()'), 1200);
});

test('kg user with no birth year uses the middle of the age bracket', () => {
  const app = loadApp({ now: NOW });
  // 80 kg, 70 in, woman, bracket 22–26 → age 24.
  // BMR = 800 + 1111.25 − 120 − 161 = 1630.25 → 1630; resting = 1956
  app.state({ unit: 'kg', bodyweight: 80, height: 70, aftGender: 'female', aftAge: '22-26' });
  assert.equal(app.run('userAge()'), 24);
  assert.equal(app.run('bmr()'), 1630);
  assert.equal(app.run('baselineBurn()'), 1956);
});

test('lifting: 4.5 METs × kg × hours, capped at three hours', () => {
  const app = man();
  // 4.5 × 86.1827 × 1 = 387.82 → 388
  assert.equal(app.run('sessionCals(3600000)'), 388);
  // 4 h is credited as 3 h: 4.5 × 86.1827 × 3 = 1163.47 → 1163
  assert.equal(app.run('sessionCals(4*3600000)'), 1163);
  assert.equal(app.run('sessionCals(-5)'), 0);
});

test('a session left open stops counting five minutes after the last ticked set', () => {
  const app = man();
  const t0 = new Date('2026-10-24T17:00:00').getTime();
  // last set at 40 min, ended 5 h later → 40 + 5 = 45 min
  app.set('__w', { started: t0, ended: t0 + 5 * 3600000, exercises: [{ sets: [{ done: true, t: t0 + 40 * 60000 }] }] });
  assert.equal(app.run('workoutActiveMs(__w)'), 45 * 60000);
});

test('cardio: METs × kg × hours, with the time estimated when only distance is given', () => {
  const app = man();
  // run 5 mi in 45 min: 8 × 86.1827 × 0.75 = 517.10 → 517
  assert.equal(app.run(`activityCals({type:'run',dist:'5',dur:'45'})`), 517);
  // run 3 mi, no time: 6 mph → 30 min; 8 × 86.1827 × 0.5 = 344.73 → 345
  assert.equal(app.run(`activityCals({type:'run',dist:'3'})`), 345);
  // walk 2 mi in 40 min = 3.0 mph → the 3.0–3.5 band, 3.8 METs; 3.8 × 86.1827 × 0.6667 = 218.33 → 218
  assert.equal(app.run(`activityCals({type:'walk',dist:'2',dur:'40'})`), 218);
  // ruck 4 mi, 35 lb, hilly: 0.30 × (190 + 35) × 4 × 1.3 = 351
  assert.equal(app.run(`activityCals({type:'ruck',dist:'4',ruckWeight:'35',terrain:'hilly'})`), 351);
});

test('a finished day: intake against resting burn plus exercise net of the resting hour', () => {
  const app = man();
  const ds = '2026-10-24';
  const t0 = new Date(ds + 'T17:00:00').getTime();
  // workout logged at 388 kcal gross; net of the resting MET: 388 × 3.5/4.5 = 301.78
  // run logged at 517 kcal gross, 8 METs; net: 517 × 7/8 = 452.38
  // exercise = round(301.78 + 452.38) = 754; burn = 2194 + 754 = 2948; intake 2500 → net −448
  app.set('__s', {
    workouts: [{ id: 'w1', name: 'Lift', started: t0, ended: t0 + 3600000, cals: 388, exercises: [{ exId: 'squat', sets: [{ w: '225', r: '5', done: true }] }] }],
    activities: [{ id: 'a1', type: 'run', date: ds, dist: '5', dur: '45', cals: 517 }],
    meals: [{ id: 'm1', date: ds, type: 'Dinner', name: 'Dinner', items: [], protein: 150, carbs: 300, fat: 80, cals: 2500 }],
  });
  app.run('Object.assign(S,__s);bumpMemo&&bumpMemo()');
  assert.deepEqual(app.json(`energyBalance('${ds}')`), { intake: 2500, exercise: 754, base: 2194, fullBase: 2194, burn: 2948, net: -448, partial: false });
});

test('today is prorated: at noon half the resting burn has happened', () => {
  const app = man();
  // 2194 × 0.5 = 1097
  const e = app.json(`energyBalance(today())`);
  assert.equal(e.base, 1097);
  assert.equal(e.partial, true);
});
