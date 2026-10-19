'use strict';
// Ranges of whole days: a morning session belongs to its own day, and the day the clocks change
// (Sun Nov 1 2026 in New York, 25 hours long) is neither cut short nor stretched.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const at = iso => new Date(iso).getTime();
const wk = (id, iso, exId, n) => ({ id, name: id, started: at(iso), ended: at(iso) + 3600000,
  exercises: [{ exId, sets: Array.from({ length: n }, () => ({ w: '100', r: '10', done: true })) }] });

test('a day starts at local midnight, or at the "day ends at" hour, also on the day the clocks change', () => {
  const app = loadApp({ now: '2026-11-02T08:00:00' });
  app.state({ onboarded: true });
  assert.equal(app.run(`dayStartTs('2026-11-01')`), at('2026-11-01T00:00:00-04:00'));
  assert.equal(app.run(`dayStartTs('2026-11-02')`), at('2026-11-02T00:00:00-05:00'));
  assert.equal(app.run(`dayStartTs('2026-11-02')-dayStartTs('2026-11-01')`), 25 * 3600000, 'the clock-change day is 25 hours');
  app.state({ onboarded: true, dayEnd: 3 });
  assert.equal(app.run(`dayStartTs('2026-11-02')`), at('2026-11-02T03:00:00-05:00'));
});

test('the month in review counts a session before noon on the 1st in its own month', () => {
  const app = loadApp({ now: '2026-10-15T12:00:00' });
  app.state({ onboarded: true, workouts: [wk('oct1', '2026-10-01T07:00:00', 'calf-raise', 6), wk('sep1', '2026-09-01T07:00:00', 'bb-bench', 6)] });
  const muscles = app.json(`periodReport('month','2026-09').muscles.map(x=>x.m)`);
  assert.ok(muscles.includes('Chest'), 'the bench on the morning of Sep 1 is in September');
  assert.ok(!muscles.includes('Calves'), 'the calf raises on the morning of Oct 1 are not');
});

test('the last 7 full days include just after midnight a week ago, across the clock change', () => {
  const app = loadApp({ now: '2026-11-02T08:00:00' });
  app.state({ onboarded: true, workouts: [wk('edge', '2026-10-26T00:30:00', 'calf-raise', 10), wk('out', '2026-10-25T23:30:00', 'bb-bench', 10)] });
  const sets = app.json(`(()=>{const td=today();return muscleSetsInRange(dayStartTs(addDays(td,-7)),dayStartTs(td));})()`);
  assert.equal(sets.Calves, 10, 'Mon Oct 26 at 00:30 is inside Oct 26 – Nov 1');
  assert.equal(sets.Chest, 0, 'Sun Oct 25 is not');
});
