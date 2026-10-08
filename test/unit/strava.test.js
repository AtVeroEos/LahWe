'use strict';
// Import from Strava's export: the CSV quirks, UTC dates, type mapping, de-duplication and Undo-able apply.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const { CSV, GPX } = require('../fixtures/strava.js');

const fresh = over => { const app = loadApp({ now: '2026-10-08T09:00:00' }); app.state(Object.assign({ bodyweight: 190 }, over || {})); return app; };
const parse = app => app.json(`stravaFromCsv(${JSON.stringify(CSV)})`);

test('CSV: quoted commas, doubled quotes and line breaks stay inside one field', () => {
  const app = fresh();
  const rows = app.json(`stravaCsvRows(${JSON.stringify('a,"b, c","say ""hi""\nthere"\r\n1,2,3\n')})`);
  assert.deepEqual(rows, [['a', 'b, c', 'say "hi"\nthere'], ['1', '2', '3']]);
});

test('dates: Strava writes UTC in more than one format; the day is the local one', () => {
  const app = fresh();
  const d = s => app.run(`stravaParseDate(${JSON.stringify(s)})`);
  assert.equal(d('Oct 6, 2026, 10:15:00 AM'), Date.UTC(2026, 9, 6, 10, 15));
  assert.equal(d('5 Oct 2026, 23:30:00'), Date.UTC(2026, 9, 5, 23, 30));
  assert.equal(d('Oct 6, 2026, 12:05:00 AM'), Date.UTC(2026, 9, 6, 0, 5));
  assert.equal(d('Sept 1, 2026, 1:00:00 PM'), Date.UTC(2026, 8, 1, 13, 0));
  assert.equal(d('2026-10-06 10:15:00'), Date.UTC(2026, 9, 6, 10, 15));
  assert.equal(d('6 Brumaire 2026'), null);
  assert.equal(d(''), null);
  // 23:30 UTC on 5 Oct is the evening of 5 Oct in New York
  assert.equal(app.run(`dayOf(${Date.UTC(2026, 9, 5, 23, 30)})`), '2026-10-05');
  assert.equal(app.run(`dayOf(${Date.UTC(2026, 9, 6, 2, 0)})`), '2026-10-05');
});

test('rows: metres column preferred, moving time used, types mapped, rucks found by name', () => {
  const app = fresh();
  const r = parse(app);
  assert.equal(r.items.length, 6); assert.equal(r.bad, 0);
  const by = Object.fromEntries(r.items.map(i => [i.srcId, i]));
  assert.equal(by['9001'].type, 'run'); assert.ok(Math.abs(by['9001'].distMi - 3.107) < 0.01); assert.equal(by['9001'].durMin, 30);
  assert.equal(by['9002'].type, 'ruck');
  assert.equal(by['9003'].type, 'bike');
  assert.equal(by['9004'].type, 'lift');
  assert.equal(by['9005'].type, 'swim');
  assert.equal(by['9006'].type, 'run', 'Trail Run is a run');
});

test('a CSV from Strava in another language is explained, not half-read', () => {
  const app = fresh();
  const r = app.json(`stravaFromCsv(${JSON.stringify('ID de l’activité,Date de l’activité\n1,2\n')})`);
  assert.equal(r.items.length, 0); assert.match(r.error, /English/);
});

test('plan and apply: weight training off by default upstream, duplicates and hand-logged twins skipped, re-import adds nothing', () => {
  const app = fresh({ activities: [{ id: 'h1', type: 'run', date: '2026-09-30', dist: '5', dur: '40', notes: '' }] });
  app.run(`window._p=stravaPlan(stravaFromCsv(${JSON.stringify(CSV)}).items)`);
  const plan = app.json('_p');
  assert.equal(plan.add.length, 5, 'the trail run on 30 Sep matches the 5-mile run logged by hand');
  assert.equal(plan.dup, 1);
  assert.deepEqual(plan.kinds, { run: 1, ruck: 1, bike: 1, lift: 1, swim: 1 });
  const ids = app.json(`stravaApply(_p,{run:true,ruck:true,bike:true,swim:true,lift:false})`);
  assert.equal(ids.length, 4);
  const acts = app.json(`S.activities.filter(a=>a.src==='strava')`);
  const run = acts.find(a => a.srcId === '9001');
  assert.equal(run.type, 'run'); assert.equal(run.dist, '3.11'); assert.equal(run.dur, '30'); assert.equal(run.date, '2026-10-06');
  assert.ok(run.cals > 200 && run.cals < 600, `${run.cals} kcal from the app's own formula`);
  assert.equal(run.notes, 'Morning Run');
    const swim = acts.find(a => a.srcId === '9005'); assert.equal(swim.dist, '', 'a swim keeps no distance (the app does not log one)');
  const ruck = acts.find(a => a.srcId === '9002');
  assert.equal(ruck.date, '2026-10-05'); assert.equal(ruck.type, 'ruck'); assert.equal(ruck.ruckWeight, '35', 'the load is read from the name');
  assert.equal(swim.dur, '37', 'whole minutes, like an activity logged here');
  const again = app.json(`stravaPlan(stravaFromCsv(${JSON.stringify(CSV)}).items)`);
  assert.equal(again.add.length, 1, 'only the weight training that was left out is still new');
  assert.equal(again.already, 4);
  // a reload keeps the source fields
  app.run('normalizeState(S)');
  assert.equal(app.json(`S.activities.filter(a=>a.srcId==='9001').length`), 1);
});

test('a single GPX export: start time, distance along the track, and its type', () => {
  const app = fresh();
  const it = app.json(`stravaFromTrack(${JSON.stringify(GPX)},'x.gpx')`);
  assert.equal(it.type, 'run'); assert.equal(it.name, 'Evening Run & Strides');
  assert.equal(it.at, Date.UTC(2026, 9, 7, 22, 0), 'the first track point, not the file time');
  assert.equal(it.durMin, 10);
  assert.ok(Math.abs(it.distMi - 1.243) < 0.01, `${it.distMi} mi`);
  app.run(`stravaApply(stravaPlan([${JSON.stringify(it)}]),{run:true})`);
  assert.equal(app.json(`stravaPlan([${JSON.stringify(it)}]).already`), 1, 'the same file twice is recognised by its start time');
});

test('ruck loads in names', () => {
  const app = fresh();
  const l = n => app.run(`stravaRuckLoad('ruck',${JSON.stringify(n)})`);
  assert.equal(l('Ruck with 35 lb'), '35'); assert.equal(l('45# ruck'), '45'); assert.equal(l('20 kg ruck'), '44'); assert.equal(l('Ruck 3 miles'), ''); assert.equal(l('Ruck 500 lb'), '');
  assert.equal(app.run(`stravaRuckLoad('walk','35 lb')`), '');
});
