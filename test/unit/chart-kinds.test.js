'use strict';
// Custom chart kinds and the fixes that came with them (46b-custom-charts.js, 46c-chart-kinds.js):
// chained strength change, defaults by table, one-at-a-time numbers, change, lag, rolling average,
// targets, bars from a baseline, split, radar, heat map, spread, box plot, and the fitness-test radar.
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
const norm = (app, c) => app.json(`normalizeCustomCharts([${JSON.stringify(c)}])[0]`);
const compute = (app, c) => app.json(`cchCompute(normalizeCustomCharts([${JSON.stringify(c)}])[0],boardRange())`);
const draw = (app, c) => app.run(`(()=>{const c=normalizeCustomCharts([${JSON.stringify(c)}])[0];return cchChart(c,cchCompute(c,boardRange()))})()`);
const clean = (html, what) => { assert.match(html, /ch-box|ch-empty/, what); assert.doesNotMatch(html, /NaN|undefined|Infinity|null/, what); };

test('strength change is chained: skipping a lift or starting a new one does not move it', () => {
  // Week 3: curls 100, pushdowns 50. Week 2: curls 110, pushdowns 50 (+10% and flat).
  // Week 1: pushdowns only, 50. Week 0 (this week): a new lift, rows at 80, and pushdowns 55.
  const curl = w => ({ exId: 'db-curl', sets: [set(w, 1)] }), push = w => ({ exId: 'cable-pushdown', sets: [set(w, 1)] }), row = w => ({ exId: 'bb-row', sets: [set(w, 1)] });
  const app = blank({ workouts: [wk('d', 0, [row(80), push(55)]), wk('c', 7, [push(50)]), wk('b', 14, [curl(110), push(50)]), wk('a', 21, [curl(100), push(50)])] });
  app.run(`S.board.range='4w'`);
  const v = compute(app, { a: { t: 'sets', m: 'strength' }, by: 'week' }).a.filter(x => x.v != null).map(x => x.v);
  assert.equal(v.length, 4);
  assert.equal(v[0], 100);
  assert.equal(v[1], 104.88, 'geometric mean of 1.10 and 1.00');
  assert.equal(v[2], 104.88, 'curls skipped: the line holds, it does not fall back towards 100');
  assert.equal(v[3], Math.round(104.88 * 1.1 * 100) / 100 || v[3]);
  assert.ok(Math.abs(v[3] - 104.8809 * 1.1) < 0.02, 'only pushdowns (+10%) count this week; the new row lift joins without dragging it to 100');
  // up 10% then back down: geometric steps land where they began
  const back = blank({ workouts: [wk('c', 0, [curl(100)]), wk('b', 7, [curl(110)]), wk('a', 14, [curl(100)])] });
  back.run(`S.board.range='4w'`);
  const b = compute(back, { a: { t: 'sets', m: 'strength' }, by: 'week' }).a.filter(x => x.v != null).map(x => x.v);
  assert.deepEqual(b, [100, 110, 100]);
  const d = back.json(`(()=>{S.customCharts=normalizeCustomCharts([{id:'s1',a:{t:'sets',m:'strength'},by:'week'}]);return cchDetail('s1',boardRange()).how})()`);
  assert.match(d, /skipping or adding a lift does not move it/);
});

test('a measure is summed up the way its table means it: a day is averaged, a set is not', () => {
  const app = blank();
  const fn = (c, t) => app.run(`cchDefaultFn(${JSON.stringify(c)},${JSON.stringify(t)})`);
  assert.equal(fn('weight', 'daily'), 'avg', 'a week\'s body weight is its average weigh-in, not its heaviest');
  assert.equal(fn('weight', 'sets'), 'max');
  assert.equal(fn('kcal', 'daily'), 'avg', 'four logged days are not a diet week');
  assert.equal(fn('steps', 'daily'), 'avg');
  assert.equal(fn('kcal', 'meals'), 'sum');
  assert.equal(fn('sessions', 'daily'), 'sum');
  assert.equal(fn('working_sets', 'daily'), 'sum');
  // the builder uses it when a measure is picked
  app.run(`showChartBuilder();cchSet('a','t','daily');cchSet('a','m','weight')`);
  assert.equal(app.run('_cch.c.a.fn'), 'avg');
  // workouts a day on Days is an ordinary column, not the sets-only "sessions"
  const c = norm(app, { a: { t: 'daily', m: 'sessions', fn: 'sum' }, by: 'day', view: 'heat' });
  assert.ok(c && c.view === 'heat');
});

test('a number that means one thing at a time is split or filtered, never averaged across', () => {
  const app = blank({ measurements: [{ date: day(20), values: { waist: 34, chest: 42 } }, { date: day(6), values: { waist: 33.5, chest: 42.5 } }] });
  const c = norm(app, { a: { t: 'measurements', m: 'value', fn: 'avg' }, by: 'week', view: 'line' });
  assert.equal(c.split, 'part', 'waist and chest are drawn apart, not averaged into 38');
  const r = compute(app, c);
  assert.deepEqual(r.groups.map(g => g.name).sort(), ['chest', 'waist']);
  // with a second line it cannot be split, so the builder filters to the most logged part
  app.run(`showChartBuilder();_cch.c.a={t:'measurements',m:'value',fn:'avg',w:[]};cchSetB(true);cchSet('b','t','measurements');cchSet('b','m','value')`);
  const b = app.json('_cch.c');
  assert.equal(b.split, null);
  assert.equal(b.b.w.length, 1);
  assert.equal(b.b.w[0].c, 'part');
  assert.equal(b.b.w[0].in.length, 1);
  assert.equal(b.a.w[0].in.length, 1);
  // grouped by part is fine as it is
  assert.equal(norm(app, { a: { t: 'measurements', m: 'value', fn: 'avg' }, by: 'part', view: 'bars' }).split, undefined);
});

test('change from the week before, the second line lagged, and r on drifting lines comes with a warning', () => {
  const app = demo();
  const r = compute(app, { a: { t: 'daily', m: 'weight', fn: 'avg', tr: 'chg' }, b: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'week', view: 'scatter', lag: 1 });
  const lv = compute(app, { a: { t: 'daily', m: 'weight', fn: 'avg' }, by: 'week' }).a;
  const i = lv.findIndex((x, j) => j > 0 && x.v != null && lv[j - 1].v != null);
  assert.equal(r.a[i].v, Math.round((lv[i].v - lv[i - 1].v) * 100) / 100, 'a change is this week minus last, in pounds');
  const kc = compute(app, { a: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'week' }).a;
  assert.equal(r.b[i].v, kc[i - 1].v, 'lag 1: this week\'s weight change against last week\'s calories');
  assert.equal(r.lag, 1);
  assert.equal(r.idx, false, 'a change cannot start at 100');
  // a level and a change only meet on a scatter
  assert.deepEqual(app.json(`cchViewList(normalizeCustomCharts([{a:{t:'daily',m:'weight',fn:'avg',tr:'chg'},b:{t:'daily',m:'kcal',fn:'avg'},by:'week',view:'line'}])[0])`), ['scatter']);
  assert.equal(norm(app, { a: { t: 'daily', m: 'weight', fn: 'avg', tr: 'chg' }, b: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'week', view: 'line' }).view, 'scatter');
  // two different units on one axis always start at 100; the same units may opt out
  assert.equal(compute(app, { a: { t: 'daily', m: 'weight', fn: 'avg' }, b: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'week', view: 'line', idx: false }).idx, true);
  assert.equal(compute(app, { a: { t: 'sets', m: 'count' }, b: { t: 'sets', m: 'count', w: [{ c: 'muscle', in: ['Biceps'] }] }, by: 'week', view: 'line', idx: false }).idx, false);
  // a change is not offered by weekday or category
  assert.equal(norm(app, { a: { t: 'daily', m: 'kcal', fn: 'avg', tr: 'chg' }, by: 'weekday', view: 'bars' }).a.tr, undefined);
  // drifting lines: r alone overstates it, and the sheet says so
  const drift = app.json(`(()=>{const c={a:{t:'daily',m:'weight',fn:'avg',w:[]},b:{t:'sets',m:'strength',fn:'sum',w:[]},by:'week',view:'line',idx:true};return cchCompute(c,{from:'${day(182)}',to:'${day(0)}',days:182,label:'6 months',short:'6 mo'})})()`);
  if (drift.n >= 8) assert.equal(typeof drift.trending, 'boolean');
  ['scatter', 'line', 'bars'].forEach(view => clean(draw(app, { a: { t: 'daily', m: 'weight', fn: 'avg', tr: 'chg' }, b: { t: 'daily', m: 'weight', fn: 'max', tr: 'chg' }, by: 'week', view, lag: 2 }), view));
});

test('a 7-day average by day, and target lines for calories, protein and the weight goal', () => {
  const app = demo();
  app.run(`S.board.range='4w'`);
  const raw = compute(app, { a: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'day' }).a;
  const sm = compute(app, { a: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'day', roll: true }).a;
  const i = raw.length - 2;
  const win = raw.slice(i - 6, i + 1).map(x => x.v).filter(v => v != null);
  assert.ok(win.length >= 3);
  assert.equal(sm[i].v, Math.round(win.reduce((a, b) => a + b, 0) / win.length * 100) / 100);
  assert.equal(norm(app, { a: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'week', roll: true }).roll, undefined, 'only by day');
  // target: the same sum-up of each day's own target over the days logged
  const t = compute(app, { a: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'week', view: 'bars', tgt: true });
  assert.ok(t.tgt && t.tgt.some(x => x.v > 1000), 'a calorie target per week');
  assert.equal(t.tgtLabel, 'Target');
  const g = compute(app, { a: { t: 'daily', m: 'weight', fn: 'avg' }, by: 'day', view: 'line', tgt: true });
  assert.ok(g.tgt.every(x => x.v === 185), 'the weight goal is a flat line');
  assert.equal(norm(app, { a: { t: 'daily', m: 'steps', fn: 'avg' }, by: 'week', tgt: true }).tgt, undefined, 'steps have no target');
  assert.equal(norm(blank(), { a: { t: 'daily', m: 'weight', fn: 'avg' }, by: 'week', tgt: true }).tgt, undefined, 'no goal set, no goal line');
  ['line', 'bars'].forEach(view => { const h = draw(app, { a: { t: 'daily', m: 'protein_g', fn: 'avg' }, by: 'week', view, tgt: true }); clean(h, view); assert.match(h, /xc-tgt/); });
  clean(draw(app, { a: { t: 'daily', m: 'weight', fn: 'avg' }, by: 'day', view: 'line', roll: true, tgt: true }), 'weight');
});

test('bars grow from a baseline: 100 when two lines start there, zero otherwise, and point down below it', () => {
  const app = demo();
  const h = draw(app, { a: { t: 'sets', m: 'strength' }, b: { t: 'sets', m: 'count' }, by: 'week', view: 'bars', idx: true });
  clean(h, 'indexed bars');
  assert.match(h, /class="xc-base"/);
  const c = norm(app, { a: { t: 'daily', m: 'weight', fn: 'avg', tr: 'chg' }, by: 'week', view: 'bars' });
  const r = app.json(`cchCompute(${JSON.stringify(c)},boardRange())`);
  assert.ok(r.a.some(x => x.v != null && x.v < 0), 'the demo is losing weight: some weeks are below zero');
  clean(app.run(`cchChart(${JSON.stringify(c)},cchCompute(${JSON.stringify(c)},boardRange()))`), 'negative bars');
});

test('split by a category: the biggest five, Other keeps a stack whole, and side by side gives way when there are many buckets', () => {
  const app = demo();
  const r = compute(app, { a: { t: 'sets', m: 'count' }, by: 'week', view: 'stack', split: 'muscle_group' });
  assert.equal(r.kind, 'split');
  assert.ok(r.groups.length >= 3 && r.groups.length <= 6);
  assert.ok(r.groups.every(g => ['Chest', 'Shoulders', 'Arms', 'Back', 'Legs', 'Core', 'Other'].includes(g.name)));
  // the split adds up to the unsplit total, week by week
  const whole = compute(app, { a: { t: 'sets', m: 'count' }, by: 'week' }).a;
  const sets = app.json(`cchRows({t:'sets',w:[]},boardRange().from,today()).filter(r=>!r.muscle_group).length`);
  if (!sets) whole.forEach((x, i) => { if (x.v != null) assert.equal(r.groups.reduce((t, g) => t + (g.list[i].v || 0), 0), x.v); });
  // by exercise there are more than five: Other holds the rest
  const ex = compute(app, { a: { t: 'sets', m: 'count' }, by: 'week', view: 'stack', split: 'exercise' });
  assert.equal(ex.groups.length, 6);
  assert.equal(ex.groups[5].name, 'Other');
  assert.ok(ex.groups[5].other > 0);
  // averages leave the rest out rather than averaging them together
  const avg = compute(app, { a: { t: 'sets', m: 'reps', fn: 'avg' }, by: 'week', view: 'line', split: 'exercise' });
  assert.equal(avg.groups.length, 5);
  assert.ok(avg.left > 0);
  assert.deepEqual(app.json(`cchViewList(normalizeCustomCharts([{a:{t:'sets',m:'reps',fn:'avg'},by:'week',split:'exercise'}])[0])`), ['line', 'bars'], 'averages do not stack');
  // twelve weeks side by side is too many: totals stack instead
  app.run(`S.board.range='12w'`);
  assert.equal(compute(app, { a: { t: 'sets', m: 'count' }, by: 'week', view: 'bars', split: 'muscle_group' }).view, 'stack');
  assert.equal(compute(app, { a: { t: 'sets', m: 'count' }, by: 'month', view: 'bars', split: 'muscle_group' }).view, 'bars');
  assert.ok(!app.json(`cchViewsNow(normalizeCustomCharts([{a:{t:'sets',m:'count'},by:'week',view:'stack',split:'muscle_group'}])[0],boardRange())`).includes('bars'), 'the builder does not offer it');
  for (const view of ['line', 'bars', 'stack', 'area', 'share']) for (const by of ['week', 'month', 'weekday']) {
    const c = { a: { t: 'sets', m: 'count' }, by, view, split: 'muscle_group' };
    clean(draw(app, c), view + ' ' + by);
    const t = app.json(`cchTile(normalizeCustomCharts([${JSON.stringify(c)}])[0],boardRange())`);
    assert.ok(t.empty || /%$/.test(t.value), JSON.stringify(t).slice(0, 120));
  }
  // a split and a second line do not go together
  assert.equal(norm(app, { a: { t: 'sets', m: 'count' }, b: { t: 'sets', m: 'count' }, by: 'week', split: 'muscle_group' }).split, undefined);
});

test('radar: fixed spoke order, 3 to 8 spokes, the period before or the useful range laid over it', () => {
  const app = demo();
  const r = compute(app, { a: { t: 'sets', m: 'hardsets' }, by: 'muscle_group', view: 'radar', cmp: 'target' });
  assert.equal(r.kind, 'radar');
  assert.deepEqual(r.axes.map(x => x.k), ['Chest', 'Shoulders', 'Arms', 'Back', 'Legs', 'Core'], 'never sorted by size');
  assert.deepEqual(r.band[0], { lo: 8, hi: 22 }, 'Chest: the useful weekly range');
  assert.deepEqual(r.band[1], { lo: 16, hi: 52 }, 'Shoulders: front, side and rear delts together');
  // weekly, with helpers at half, the same count the Muscles tile uses
  const legs = app.json(`(()=>{const rg=boardRange();const ws=S.workouts.filter(w=>dayOf(w.started)>=rg.from);const first=Math.min(...ws.map(w=>w.started));
    const m=muscleSetsInRange(dayDate(rg.from).getTime()-12*3600000,dayDate(rg.to).getTime()+12*3600000);const weeks=(daysBetween(dayOf(first),rg.to)+1)/7;
    return Math.round((m.Quads+m.Hamstrings+m.Glutes+m.Calves)/weeks*10)/10})()`);
  assert.equal(r.axes[4].v, legs);
  const wd = compute(app, { a: { t: 'workouts', m: 'feel', fn: 'avg' }, by: 'weekday', view: 'radar', cmp: 'prev' });
  assert.equal(wd.axes.length, 7);
  assert.equal(wd.prev.length, 7);
  // more than eight exercises: no radar, in the builder or the tile
  assert.ok(!app.json(`cchViewsNow(normalizeCustomCharts([{a:{t:'sets',m:'count'},by:'exercise',view:'bars'}])[0],boardRange())`).includes('radar'));
  const bad = compute(app, { a: { t: 'sets', m: 'count' }, by: 'exercise', view: 'radar' });
  assert.equal(bad.bad, true);
  assert.match(draw(app, { a: { t: 'sets', m: 'count' }, by: 'exercise', view: 'radar' }), /3 to 8 spokes; this has \d+\. Group by weekday or muscle group/);
  // a strength change or a change is not drawn on a radar (spokes start at zero)
  assert.ok(!app.json(`cchViewList({a:{t:'sets',m:'strength',fn:'sum',w:[]},b:null,by:'muscle_group',view:'bars'})`).includes('radar'));
  // hard sets by single muscle: 16 spokes, so bars
  assert.equal(norm(app, { a: { t: 'sets', m: 'hardsets' }, by: 'muscle', view: 'radar' }).view, 'bars');
  for (const c of [{ a: { t: 'sets', m: 'hardsets' }, by: 'muscle_group', view: 'radar', cmp: 'target' }, { a: { t: 'workouts', m: 'feel', fn: 'avg' }, by: 'weekday', view: 'radar', cmp: 'prev' }, { a: { t: 'sets', m: 'hardsets' }, by: 'muscle', view: 'bars' }]) {
    clean(draw(app, c), JSON.stringify(c));
    const t = app.json(`cchTile(normalizeCustomCharts([${JSON.stringify(c)}])[0],boardRange())`);
    assert.ok(t.value != null || t.empty);
  }
  assert.equal(app.json(`cchTile(normalizeCustomCharts([{a:{t:'sets',m:'hardsets'},by:'muscle_group',view:'radar',cmp:'target'}])[0],boardRange())`).unit, ' of 6');
});

test('heat map, spread and box plot', () => {
  const app = demo();
  app.run(`S.board.range='12w'`);
  const h = compute(app, { a: { t: 'daily', m: 'sessions', fn: 'sum' }, by: 'day', view: 'heat' });
  assert.equal(h.kind, 'heat');
  const lv = app.json(`(()=>{const r=cchCompute(normalizeCustomCharts([{a:{t:'daily',m:'sessions',fn:'sum'},by:'day',view:'heat'}])[0],boardRange());const f=cchHeatLevels(r.a);return r.a.map(x=>f(x.v))})()`);
  assert.ok(lv.includes(0) && lv.some(l => l >= 1), 'rest days and training days');
  const ht = app.json(`cchTile(normalizeCustomCharts([{a:{t:'daily',m:'sessions',fn:'sum'},by:'day',view:'heat'}])[0],boardRange())`);
  assert.match(ht.unit, /of \d+ days/);
  assert.ok(+ht.value >= 30, 'four workouts a week for twelve weeks');
  assert.equal(norm(app, { a: { t: 'daily', m: 'sessions', fn: 'sum' }, by: 'week', view: 'heat' }).view, 'line', 'a heat map is by day');
  // spread
  const s = compute(app, { a: { t: 'sets', m: 'reps', fn: 'avg' }, by: 'week', view: 'hist' });
  assert.equal(s.kind, 'hist');
  assert.equal(s.bins.reduce((t, b) => t + b.n, 0), s.n, 'every set is in one bar');
  assert.ok(s.ints && s.step >= 1);
  assert.ok(s.q1 <= s.med && s.med <= s.q3);
  assert.ok(!app.json(`cchViewList({a:{t:'sets',m:'count',fn:'sum',w:[]},b:null,by:'week',view:'line'})`).includes('hist'), 'a count has no spread');
  // box
  const b = compute(app, { a: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'weekday', view: 'box' });
  assert.equal(b.kind, 'box');
  assert.deepEqual(b.boxes.map(x => x.k), app.json('weekOrder().map(String)').filter(k => b.boxes.some(x => x.k === k)));
  b.boxes.forEach(x => assert.ok(x.wlo <= x.q1 && x.q1 <= x.med && x.med <= x.q3 && x.q3 <= x.whi));
  for (const c of [{ a: { t: 'daily', m: 'sessions', fn: 'sum' }, by: 'day', view: 'heat' }, { a: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'day', view: 'heat' },
    { a: { t: 'sets', m: 'reps', fn: 'avg' }, by: 'week', view: 'hist' }, { a: { t: 'daily', m: 'weight', fn: 'avg' }, by: 'week', view: 'hist' },
    { a: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'weekday', view: 'box' }, { a: { t: 'sets', m: 'e1rm', fn: 'max' }, by: 'muscle_group', view: 'box' }]) {
    for (const range of ['4w', '1y']) {
      app.run(`S.board.range='${range}'`);
      clean(draw(app, c), JSON.stringify(c));
      const det = app.json(`(()=>{S.customCharts=normalizeCustomCharts([Object.assign({id:'k1'},${JSON.stringify(c)})]);return cchDetail('k1',boardRange())})()`);
      assert.match(det.body, /xc-tbl/);
      assert.doesNotMatch(det.body + det.how, /NaN|undefined/);
    }
  }
  // empty logs draw an empty state, not a broken chart
  const none = blank();
  for (const view of ['heat', 'hist']) clean(draw(none, { a: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'day', view }), view);
  clean(draw(none, { a: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'weekday', view: 'box' }), 'box');
  clean(draw(none, { a: { t: 'sets', m: 'hardsets' }, by: 'muscle_group', view: 'radar' }), 'radar');
});

test('the builder only offers what works, and saves what it shows', () => {
  const app = demo();
  app.run(`showChartBuilder()`);
  app.run(`cchSet('a','t','daily');cchSet('a','m','kcal')`);
  assert.deepEqual(app.json(`cchViewsNow(_cch.c,boardRange())`), ['line', 'bars', 'hist']);
  app.run(`cchSetTop('by','day')`);
  assert.ok(app.json(`cchViewsNow(_cch.c,boardRange())`).includes('heat'));
  app.run(`cchSetTop('view','heat');cchSetB(true)`);
  assert.equal(app.run('_cch.c.view'), 'line', 'a second line leaves the heat map');
  app.run(`cchSetB(false);cchSetTop('by','weekday')`);
  assert.deepEqual(app.json(`cchViewsNow(_cch.c,boardRange())`), ['bars', 'radar', 'box', 'hist']);
  app.run(`cchSetTop('view','radar');cchSetTop('cmp','prev')`);
  app.run(`cchSave()`);
  const c = app.json('S.customCharts[0]');
  assert.equal(c.view, 'radar');
  assert.equal(c.cmp, 'prev');
  assert.ok(app.json('boardTiles().map(t=>t.k)').includes('cc_' + c.id));
  // every idea opens in the builder without anything it cannot show
  const n = app.json('CCH_IDEAS.length');
  for (let i = 0; i < n; i++) {
    app.run(`showChartBuilder();cchIdea(${i})`);
    const st = app.json(`(()=>{const c=_cch.c;return{view:c.view,ok:cchViewsNow(c,boardRange()).includes(c.view)}})()`);
    assert.ok(st.ok, `idea ${i} as ${st.view}`);
  }
});

test('the fitness test as a radar: start, now and goal on one 0–100 scale', () => {
  const app = demo();
  app.run(`S.aftGoals={MDL:'340',HRP:'45',SDC:'100',PLK:'200','2MR':'870'};S.aftHistory=[{date:'${day(40)}',scores:{MDL:'250',HRP:'28',SDC:'120',PLK:'130','2MR':'1000'}}]`);
  const d = app.json('aftRadarData()');
  assert.equal(d.now.length, 5);
  assert.ok(d.now.every(v => v >= 0 && v <= 100));
  assert.equal(d.startLabel, 'Plan start', 'with a test-date plan, start is where the plan began');
  assert.match(app.json(`(()=>{const p=S.testPlan;S.testPlan=null;const x=aftRadarData().startLabel;S.testPlan=p;return x})()`), /^First snapshot/, 'without one, the first saved snapshot');
  assert.ok(d.goal.every((v, i) => v >= d.now[i]), 'the goals are all above the current results');
  const t = app.json(`METRICS.aftradar.tile(boardRange(),{})`);
  assert.equal(t.value, String(d.total));
  assert.match(t.unit, /goal/);
  assert.match(t.spark, /xc-rshape/);
  const det = app.json(`metricDetail('aftradar',{},boardRange())`);
  assert.match(det.chart, /xc-rmin/, 'the 60-point minimum ring');
  assert.match(det.chart, /xc-rgoal/);
  assert.match(det.chart, /xc-rstart/);
  assert.doesNotMatch(det.chart + det.body, /NaN|undefined/);
  assert.equal(app.json(`METRICS.aftradar.has()`), true);
  // fewer than three events: it says so
  const few = blank({ aftCurrent: { MDL: '250' } });
  assert.match(few.json(`METRICS.aftradar.tile(boardRange(),{})`).empty, /three/);
  assert.equal(few.json(`METRICS.aftradar.has()`), false);
});

test('every chart type is offered; picking one changes only what it must, says so, and can be undone', () => {
  const app = demo();
  app.run(`showChartBuilder()`);
  const views = app.json('CCH_VIEWS');
  assert.equal(views.length, 10);
  // from the default (strength change by week) every type can be reached and drawn
  for (const v of views) {
    app.run(`showChartBuilder();cchPickView('${v}')`);
    const st = app.json(`({view:_cch.c.view,undo:_cch.undo&&_cch.undo.text})`);
    assert.equal(st.view, v, v);
    if (v !== 'line') assert.ok(v === 'bars' || st.undo, `${v} says what it changed`);
    clean(app.run(`cchChart(_cch.c,cchCompute(_cch.c,boardRange()),boardRange())`), v);
  }
  // radar from strength by week: strength around 100 on every spoke is not a radar, so the measure changes
  app.run(`showChartBuilder();cchPickView('radar')`);
  assert.deepEqual(app.json(`[_cch.c.a.m,_cch.c.by]`), ['hardsets', 'muscle_group']);
  assert.match(app.run('_cch.undo.text'), /^Radar: measuring hard sets a week, by muscle group\.$/);
  app.run(`cchUndoView()`);
  assert.deepEqual(app.json(`[_cch.c.view,_cch.c.a.m,_cch.c.by,_cch.undo]`), ['line', 'strength', 'week', null]);
  // calories by week → box: only the grouping changes; → heat map: by day; → spread: nothing to change
  app.run(`showChartBuilder();cchSet('a','t','daily');cchSet('a','m','kcal');cchPickView('box')`);
  assert.deepEqual(app.json(`[_cch.c.a.m,_cch.c.by]`), ['kcal', 'weekday']);
  assert.equal(app.run('_cch.undo.text'), 'Box plot: by weekday.');
  app.run(`cchPickView('heat')`);
  assert.equal(app.run('_cch.c.by'), 'day');
  app.run(`cchSetTop('by','week');cchPickView('hist')`);
  assert.equal(app.json('_cch.undo'), null, 'nothing had to change');
  // a count → spread picks a real number; sets done → stacked splits by muscle group
  app.run(`showChartBuilder();cchSet('a','m','count');cchPickView('hist')`);
  assert.equal(app.run('_cch.c.a.m'), 'reps');
  app.run(`showChartBuilder();cchSet('a','m','count');cchPickView('stack')`);
  assert.equal(app.run('_cch.c.split'), 'muscle_group');
  assert.equal(app.run('_cch.undo.text'), 'Stacked: split by muscle group.');
  // a second line goes when a type cannot have one, and comes when scatter needs one
  app.run(`showChartBuilder();cchSet('a','m','count');cchPickView('scatter')`);
  assert.ok(app.json('_cch.c.b'));
  app.run(`cchPickView('radar')`);
  assert.equal(app.json('_cch.c.b'), null);
  assert.match(app.run('_cch.undo.text'), /second line removed/);
  // supplements have no number of their own: a spread moves to the day's count of them
  app.run(`showChartBuilder();cchSet('a','t','supplements');cchPickView('hist')`);
  assert.deepEqual(app.json(`[_cch.c.view,_cch.c.a.t,_cch.c.a.m]`), ['hist', 'daily', 'supplements_taken']);
  // any other change clears the Undo line
  app.run(`showChartBuilder();cchPickView('radar');cchSetTop('cmp','prev')`);
  assert.equal(app.json('_cch.undo'), null);
  // a name chosen for one measure is cleared when the measure changes
  app.run(`showChartBuilder();cchIdea(1);cchPickView('radar')`);
  assert.equal(app.run('_cch.c.name'), '');
  // Show as sits right under the preview, with all ten
  const html = app.run(`(()=>{let h='';const el={set innerHTML(v){h=v},get innerHTML(){return h}};const g=document.getElementById;document.getElementById=id=>id==='cchb-body'?el:g(id);showChartBuilder();renderChartBuilder();document.getElementById=g;return h})()`);
  assert.ok(html.indexOf('Show as') < html.indexOf('Measure'), 'type first');
  assert.equal((html.match(/cchPickView\(/g) || []).length, 10);
});

test('a chart\'s type can be changed from its own sheet, saved at once, with Undo', () => {
  const app = demo();
  app.run(`S.customCharts=normalizeCustomCharts([{id:'cal',name:'Calories',a:{t:'daily',m:'kcal',fn:'avg'},by:'week',view:'line'}]);ccSync();boardAdd('cc_cal')`);
  const d = app.json(`metricDetail('cc_cal',{},boardRange())`);
  assert.equal((d.chart.match(/cchSheetView\(/g) || []).length, 10);
  app.run(`toast=(m,c,o)=>{globalThis.__t={m,o}};cchSheetView('cal','box')`);
  assert.equal(app.run('__t.m'), 'Box plot: by weekday.');
  assert.deepEqual(app.json(`[S.customCharts[0].view,S.customCharts[0].by,S.customCharts[0].name]`), ['box', 'weekday', 'Calories']);
  const reloaded = app.json(`normalizeState(JSON.parse(JSON.stringify(S))).customCharts[0].view`);
  assert.equal(reloaded, 'box', 'saved');
  // Undo on the toast puts it back
  app.run(`__t.o.onAction()`);
  assert.deepEqual(app.json(`[S.customCharts[0].view,S.customCharts[0].by]`), ['line', 'week']);
});

test('box plot rows with fewer than five values show the values, and every row says how many', () => {
  const app = blank({ bodyweightLog: [], meals: [] });
  app.run(`S.board.range='4w'`);
  // a few workouts with ratings on two weekdays: 6 on one, 2 on the other
  const ws = [];
  [0, 7, 14, 21, 2, 9].forEach((n, i) => ws.push(Object.assign(wk('w' + i, n, [{ exId: 'squat', sets: [set(200, 5)] }]), { feel: 3 + (i % 3) })));
  [1, 8].forEach((n, i) => ws.push(Object.assign(wk('x' + i, n, [{ exId: 'squat', sets: [set(200, 5)] }]), { feel: 2 + i })));
  app.run(`S.workouts=${JSON.stringify(ws)}`);
  const c = { a: { t: 'workouts', m: 'feel', fn: 'avg' }, by: 'weekday', view: 'box' };
  const r = compute(app, c);
  assert.ok(r.boxes.some(b => b.n < 5) && r.boxes.every(b => b.vals.length === Math.min(b.n, 5)));
  const h = draw(app, c);
  clean(h, 'box');
  const few = r.boxes.filter(b => b.n < 5).length, many = r.boxes.filter(b => b.n >= 5).length;
  assert.equal((h.match(/class="xc-box"/g) || []).length, many, 'a box only where there are five or more');
  assert.equal((h.match(/class="xc-bdot"/g) || []).length, r.boxes.filter(b => b.n < 5).reduce((t, b) => t + b.n, 0));
  assert.equal((h.match(/class="xc-bn"/g) || []).length, r.boxes.length);
  assert.ok(few > 0);
  const det = app.json(`(()=>{S.customCharts=normalizeCustomCharts([Object.assign({id:'bx'},${JSON.stringify(c)})]);return cchDetail('bx',boardRange()).how})()`);
  assert.match(det, /fewer than 5 values shows the values themselves/);
});

test('a wide tile draws the whole chart across the board and opens the sheet from its top line', () => {
  const app = demo();
  app.run(`S.customCharts=normalizeCustomCharts([{id:'mb',name:'Muscle balance',a:{t:'sets',m:'hardsets'},by:'muscle_group',view:'radar',cmp:'target',wide:true},{id:'nw',a:{t:'daily',m:'kcal',fn:'avg'},by:'week'}]);ccSync();boardAdd('cc_mb');boardAdd('cc_nw')`);
  assert.equal(app.run('METRICS.cc_mb.wide'), true);
  assert.equal(app.run('METRICS.cc_nw.wide'), false);
  const t = app.json(`tileData({k:'cc_mb'},boardRange())`);
  assert.equal(t.cls, 'tile-cc');
  assert.match(t.html, /openTile\(&quot;cc_mb&quot;\)/);
  assert.match(t.html, /xc-rshape/, 'the real radar, not a thumbnail');
  assert.ok(!app.json(`tileData({k:'cc_nw'},boardRange())`).html);
  app.run(`go('progress')`);
  const page = app.run(`document.getElementById('content').innerHTML`);
  assert.match(page, /class="tile tile-wide tile-cc" id="tile-cc_mb"/);
  assert.equal(app.json(`normalizeCustomCharts(S.customCharts)[0].wide`), true);
  assert.equal(app.run(`'wide' in normalizeCustomCharts(S.customCharts)[1]`), false);
  // the builder offers it
  app.run(`showChartBuilder('nw');cchSetTop('wide',true);cchSave()`);
  assert.equal(app.run('METRICS.cc_nw.wide'), true);
  // empty stays a normal empty tile, across the board
  const e = blank();
  e.run(`S.customCharts=normalizeCustomCharts([{id:'w',a:{t:'daily',m:'kcal',fn:'avg'},by:'week',wide:true}]);ccSync()`);
  const et = e.json(`tileData({k:'cc_w'},boardRange())`);
  assert.ok(et.empty && !et.html);
});

test('an empty chart says what is missing: counts per series, what used some up, filters, and whether a year is enough', () => {
  const app = demo();
  // the demo logs food for a few weeks and weight for longer: calories limit the comparison
  const c = { a: { t: 'daily', m: 'weight', fn: 'avg', tr: 'chg' }, b: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'week', view: 'scatter', lag: 1 };
  app.run(`S.board.range='4w'`);
  const h = draw(app, c);
  assert.match(h, /A comparison needs at least 3 weeks with both numbers; there (is|are) \d/);
  assert.match(h, /Change in average weight: \d+ weeks?\. Average calories: \d+ weeks?\./);
  assert.match(h, /A change needs the week before it/);
  assert.match(h, /The 1-week lag leaves the first week with no second number/);
  assert.match(h, /r means little before 8/);
  const t = app.json(`cchTile(normalizeCustomCharts([${JSON.stringify(c)}])[0],boardRange())`);
  assert.match(t.empty, /^\d of 3 weeks with both numbers\./);
  // a filter in the way, and a year that has more
  const old = blank({ workouts: [wk('a', 200, [{ exId: 'db-curl', sets: [set(30, 10)] }]), wk('b', 150, [{ exId: 'db-curl', sets: [set(35, 10)] }])] });
  old.run(`S.board.range='4w'`);
  const f = { a: { t: 'sets', m: 'count', w: [{ c: 'muscle', in: ['Biceps'] }] }, by: 'week', view: 'line' };
  const fh = draw(old, f);
  assert.match(fh, /Nothing logged for sets done in the last 4 weeks\./);
  assert.match(fh, /Over the last year there is enough: widen the range\./);
  assert.match(fh, /Filtered to Biceps: loosening that may help\./);
  assert.match(old.json(`cchTile(normalizeCustomCharts([${JSON.stringify(f)}])[0],boardRange())`).empty, /Widen the range: a year has enough\./);
  // a spread and a radar say what they need
  assert.match(draw(blank(), { a: { t: 'sets', m: 'reps', fn: 'avg' }, by: 'week', view: 'hist' }), /A spread needs at least 3 sets with reps; there are 0/);
  // already a year: no widen hint
  old.run(`S.board.range='1y'`);
  assert.doesNotMatch(draw(old, { a: { t: 'daily', m: 'kcal', fn: 'avg' }, by: 'week' }), /widen/);
});
