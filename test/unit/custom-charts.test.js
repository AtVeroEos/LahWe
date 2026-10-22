'use strict';
// Custom charts on the Progress board (46b-custom-charts.js) and the spreadsheet export picker
// (70-settings.js). Both read the coach's flat tables, so these check the numbers, not the drawing.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const { demoState } = require('../../tools/demo-state.js');

const NOW = '2026-10-07T12:00:00'; // a Wednesday
const day = n => { const d = new Date(NOW); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const at = (n, h) => { const d = new Date(NOW); d.setDate(d.getDate() - n); d.setHours(h == null ? 17 : h, 0, 0, 0); return d.getTime(); };
const blank = over => { const app = loadApp({ now: NOW }); app.state(over || {}); return app; };
const demo = over => { const app = loadApp({ now: NOW }); app.state(Object.assign(demoState(new Date(NOW).getTime()), over || {})); return app; };
const set = (w, r, o) => Object.assign({ w: String(w), r: String(r), done: true }, o || {});
const wk = (id, n, exercises) => ({ id, name: 'W', started: at(n), ended: at(n) + 3e6, exercises });
const compute = (app, c) => app.json(`cchCompute(normalizeCustomCharts([${JSON.stringify(c)}])[0],boardRange())`);

test('saved charts are cleaned: a bad series drops the chart, a bad grouping falls back, ids are real', () => {
  const app = blank();
  const n = v => app.json(`normalizeCustomCharts(${JSON.stringify(v)})`);
  assert.deepEqual(n(null), []);
  assert.deepEqual(n([{ a: { t: 'nope', m: 'count' } }, { a: { t: 'daily', m: 'not_a_column' } }, { a: { t: 'workouts', m: 'strength' } }]), [], 'strength and sessions are sets-only');
  const [c] = n([{ a: { t: 'sets', m: 'e1rm', fn: 'weird', w: [{ c: 'muscle', in: ['Biceps'] }, { c: 'notes', in: ['x'] }, { c: 'reps', op: '>=', v: '5' }] }, by: 'food', view: 'scatter' }]);
  assert.match(c.id, /^[a-z0-9]{1,14}$/);
  assert.notEqual(c.id, 'undefined');
  assert.equal(c.a.fn, 'sum');
  assert.deepEqual(c.a.w, [{ c: 'muscle', in: ['Biceps'] }, { c: 'reps', op: '>=', v: 5 }], 'a column the table does not have is dropped');
  assert.equal(c.by, 'week', 'sets has no food column');
  assert.equal(c.view, 'line', 'a scatter needs a second series');
  assert.equal(c.idx, true);
  // grouping by a column needs it in both tables
  assert.equal(n([{ a: { t: 'sets', m: 'count' }, b: { t: 'daily', m: 'kcal' }, by: 'muscle' }])[0].by, 'week');
  assert.equal(n([{ a: { t: 'sets', m: 'count' }, b: { t: 'sets', m: 'e1rm', fn: 'max' }, by: 'muscle' }])[0].by, 'muscle');
  assert.equal(n(Array.from({ length: 20 }, () => ({ a: { t: 'daily', m: 'kcal' } }))).length, 12);
});

test('strength change compares each lift with itself, so the mix of lifts does not move it', () => {
  // curls 100 → 110 estimated max; pushdowns stay at 50. Week 2 is pushdowns only: still 100, not 50.
  const curl = (n, w) => ({ exId: 'db-curl', sets: [set(w, 1)] });
  const push = n => ({ exId: 'cable-pushdown', sets: [set(50, 1)] });
  const app = blank({ workouts: [wk('c', 2, [curl(2, 110), push(2)]), wk('b', 9, [push(9)]), wk('a', 16, [curl(16, 100), push(16)])] });
  app.run(`S.board.range='4w'`);
  const r = compute(app, { a: { t: 'sets', m: 'strength', w: [] }, by: 'week' });
  const vals = r.a.filter(x => x.v != null).map(x => x.v);
  assert.deepEqual(vals, [100, 100, 105], 'the mean of 110/100 and 50/50');
  // by exercise: last session against first
  const byEx = compute(app, { a: { t: 'sets', m: 'strength', w: [] }, by: 'exercise', view: 'bars' });
  assert.deepEqual(byEx.a.map(x => [x.k, x.v]), [['Dumbbell Curl', 110], ['Cable Pushdown', 100]].map(([k, v]) => [app.run(`exName(${JSON.stringify(k === 'Dumbbell Curl' ? 'db-curl' : 'cable-pushdown')})`), v]));
});

test('two lines over time start at 100 from the average of their first three buckets; a week under way is not a total', () => {
  // 3 sets in a short first week, then 9 a week. Indexed to the first week alone, 9 would read 300.
  const ws = [];
  [30, 23, 16, 9, 2].forEach((n, i) => ws.push(wk('w' + i, n, [{ exId: 'squat', sets: Array.from({ length: i === 0 ? 3 : 9 }, () => set(200 + i * 5, 5)) }])));
  ws.push(wk('now', 0, [{ exId: 'squat', sets: [set(230, 5)] }])); // today, Wednesday: the week is not over
  const app = blank({ workouts: ws });
  app.run(`S.board.range='6m'`);
  const r = compute(app, { a: { t: 'sets', m: 'strength' }, b: { t: 'sets', m: 'count' }, by: 'week', view: 'line', idx: true });
  assert.equal(r.idx, true);
  // weeks before the first workout are 0 sets; the last workout of 9 is in this week, which is not over
  const b = r.b.filter(x => x.raw > 0);
  assert.deepEqual(b.map(x => x.raw), [3, 9, 9, 9]);
  assert.deepEqual(b.map(x => x.v), [42.9, 128.6, 128.6, 128.6], 'base is (3 + 9 + 9) / 3 = 7, not the short first week\'s 3');
  const cur = r.b[r.b.length - 1];
  assert.equal(cur.k, app.run(`weekStartOf(today())`));
  assert.equal(cur.v, null, 'this week\'s count is left out until the week ends');
  assert.equal(cur.sofar, 10, 'and shown as so far: Monday\'s 9 sets and today\'s 1');
  assert.match(app.run(`(()=>{const c=normalizeCustomCharts([{a:{t:'sets',m:'count'},by:'week'}])[0];const r=cchCompute(c,boardRange());return cchRead(r,c,r.a.length-1)})()`), /10 so far/);
  const firstReal = r.b.findIndex(x => x.v != null);
  assert.ok(firstReal > 0 && r.b.slice(0, firstReal).every(x => x.v === null), 'weeks before the first workout are not drawn as zeros');
  assert.ok(r.a[r.a.length - 1].v > 100, 'a best is not a total: this week\'s strength shows');
  // the first bucket starts on the week's first day, not mid-week
  assert.equal(r.a[0].k, app.run(`weekStartOf(boardRange().from)`));
});

test('filters, a category grouping sorted biggest first, and a comparison with r', () => {
  const app = demo();
  const arms = compute(app, { a: { t: 'sets', m: 'count', w: [{ c: 'muscle', in: ['Biceps', 'Triceps', 'Forearms'] }] }, by: 'muscle', view: 'bars' });
  assert.ok(arms.a.length >= 1 && arms.a.every(x => ['Biceps', 'Triceps', 'Forearms'].includes(x.k)));
  const all = compute(app, { a: { t: 'sets', m: 'count' }, by: 'muscle', view: 'bars' });
  const v = all.a.map(x => x.v);
  assert.deepEqual(v, v.slice().sort((p, q) => q - p));
  const sc = compute(app, { a: { t: 'daily', m: 'weight', fn: 'avg' }, b: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'week', view: 'scatter' });
  assert.equal(sc.idx, false, 'a scatter is drawn in real units');
  assert.ok(sc.n >= 3 && typeof sc.r === 'number' && sc.r >= -1 && sc.r <= 1);
  assert.equal(app.run(`cchStrengthWord(0.9,3)`), 'Too few to judge', 'three points are not a strong link');
  assert.equal(app.run(`cchStrengthWord(0.9,12)`), 'Strong, together');
  // the same number the app's correlation gives
  assert.equal(sc.r, Math.round(app.json(`patCorr(${JSON.stringify(sc.pairs.map(p => p.x))},${JSON.stringify(sc.pairs.map(p => p.y))})`) * 100) / 100);
});

test('every starting idea draws, on an empty log and a full one, as a tile, a sheet and a CSV', () => {
  for (const app of [blank(), demo()]) {
    const ideas = app.json('CCH_IDEAS.length');
    for (let i = 0; i < ideas; i++) {
      for (const r of ['4w', '12w', '6m', '1y']) {
        app.run(`S.board.range='${r}'`);
        const t = app.json(`(()=>{const c=normalizeCustomCharts([CCH_IDEAS[${i}].c])[0];return cchTile(c,boardRange())})()`);
        assert.ok(t.empty || (t.value != null && typeof t.sub === 'string'), `idea ${i} ${r}: ${JSON.stringify(t).slice(0, 160)}`);
      }
      const html = app.run(`(()=>{const c=normalizeCustomCharts([CCH_IDEAS[${i}].c])[0];return cchChart(c,cchCompute(c,boardRange()))})()`);
      assert.match(html, /ch-box|ch-empty/);
      assert.doesNotMatch(html, /NaN|undefined|Infinity/, `idea ${i} draws cleanly`);
    }
    assert.equal(app.requests().length, 0, 'nothing here calls the network');
  }
});

test('a chart lives on the board as a tile; deleting it takes the tile with it', () => {
  const app = demo();
  app.run(`S.customCharts=normalizeCustomCharts([Object.assign({id:'arms1',name:'Arms'},CCH_IDEAS[0].c)]);boardAdd('cc_arms1')`);
  assert.ok(app.json('boardTiles().map(t=>t.k)').includes('cc_arms1'));
  assert.equal(app.run(`METRICS.cc_arms1.group`), 'Custom charts');
  assert.ok(app.json('METRIC_GROUPS').includes('Custom charts'));
  const d = app.json(`metricDetail('cc_arms1',{},boardRange())`);
  assert.equal(d.title, 'Arms');
  assert.match(d.body, /<table class="xc-tbl">/);
  assert.match(d.acts, /showChartBuilder\(&quot;arms1&quot;\)/);
  assert.match(d.acts, /cchExport\(/);
  // saved and loaded again
  const reloaded = app.json(`(()=>{const s=normalizeState(JSON.parse(JSON.stringify(S)));return{charts:s.customCharts.map(c=>c.id),tiles:s.board.tiles.map(t=>t.k)}})()`);
  assert.deepEqual(reloaded.charts, ['arms1']);
  assert.ok(reloaded.tiles.includes('cc_arms1'));
  // a tile whose chart is gone does not survive a load
  const orphan = app.json(`(()=>{const o=JSON.parse(JSON.stringify(S));o.customCharts=[];return normalizeState(o).board.tiles.map(t=>t.k)})()`);
  assert.ok(!orphan.includes('cc_arms1'));
  // deleting from the builder
  app.run(`showChartBuilder('arms1');cchDelete()`);
  assert.deepEqual(app.json('S.customCharts'), []);
  assert.ok(!app.json('boardTiles().map(t=>t.k)').includes('cc_arms1'));
  assert.equal(app.run(`'cc_arms1' in METRICS`), false);
});

test('the builder: the second line copies the first one\'s filters, changes keep it valid, saving adds it to the board', () => {
  const app = demo();
  app.run(`showChartBuilder()`);
  app.run(`_cch.c.a.w=[{c:'muscle',in:['Biceps']}];cchSetB(true)`);
  assert.deepEqual(app.json('_cch.c.b'), { t: 'sets', m: 'count', fn: 'sum', w: [{ c: 'muscle', in: ['Biceps'] }] });
  app.run(`cchSetTop('by','exercise')`);
  assert.equal(app.run('_cch.c.view'), 'bars', 'a category is drawn as bars');
  app.run(`cchSet('b','t','daily')`);
  assert.equal(app.run('_cch.c.by'), 'week', 'daily has no exercise column, so the grouping falls back');
  assert.deepEqual(app.json('_cch.c.b.w'), [], 'muscle is not a column of daily');
  app.run(`cchSet('b','m','sleep_h')`);
  assert.equal(app.run('_cch.c.b.fn'), 'avg');
  app.run(`cchSave()`);
  const c = app.json('S.customCharts');
  assert.equal(c.length, 1);
  assert.ok(app.json('boardTiles().map(t=>t.k)').includes('cc_' + c[0].id));
  assert.match(app.run(`cchAutoName(S.customCharts[0])`), /vs average sleep/i);
});

test('export: pick files and a range; flat tables come with readable headers, whole notes and yes/no', () => {
  const long = 'x'.repeat(300);
  const app = blank({
    workouts: [wk('a', 3, [{ exId: 'squat', sets: [set(135, 5, { warmup: true }), set(225, 5)] }]), wk('old', 200, [{ exId: 'squat', sets: [set(205, 5)] }])],
    activities: [{ id: 'r', type: 'run', date: day(4), dur: '30', dist: '3.1', cals: 350, notes: long }],
    bodyweightLog: [{ date: day(1), weight: 181 }],
  });
  app.run(`S.workouts[0].notes=${JSON.stringify(long)}`);
  const files = app.json(`exportFiles(['daily','workouts','sets','activities','weighins','supplements'],'4w')`);
  assert.deepEqual(files.map(f => f.name), ['Daily summary.csv', 'Workouts.csv', 'Sets.csv', 'Weigh-ins.csv', 'Activities.csv'], 'a file with no rows is left out');
  const sets = files.find(f => f.name === 'Sets.csv').rows;
  assert.equal(sets.length, 3, 'header + warm-up + working set, inside 4 weeks only');
  assert.deepEqual(sets[0].slice(0, 8), ['date', 'time', 'workout', 'exercise', 'muscle', 'equipment', 'set', 'warm-up']);
  assert.equal(sets[1][7], 'yes');
  const w = files.find(f => f.name === 'Workouts.csv').rows;
  assert.ok(!w[0].includes('id'), 'ids are left out');
  assert.equal(w[1][w[0].indexOf('Notes')], long, 'notes are not cut short as they are for the coach');
  const daily = files.find(f => f.name === 'Daily summary.csv').rows;
  assert.equal(daily.length, 29, 'a row a day for 4 weeks, today included');
  assert.ok(daily[0].includes('Weight (lbs)'));
  assert.ok(daily.slice(1).every(r => r[daily[0].indexOf('Trained')] === 'yes' || r[daily[0].indexOf('Trained')] === 'no'));
  assert.equal(app.run('_qdTextMax'), 120, 'the coach\'s limit is back afterwards');
  // all time reaches the first entry
  const allSets = app.json(`exportFiles(['sets'],'all')[0].rows.length`);
  assert.equal(allSets, 4);
  assert.equal(app.run('exportFirstDay()'), day(200));
  // what was picked is remembered; the defaults are the four files the export always had, plus workouts
  assert.deepEqual(app.json('exportPicked()'), ['workouts', 'sets', 'meals', 'weighins', 'activities']);
  app.run(`exportCSV();exportToggle('daily')`);
  assert.ok(app.json('S.exportPick').includes('daily'));
  assert.equal(app.json('normalizeState(JSON.parse(JSON.stringify(S))).exportPick').includes('daily'), true);
});
