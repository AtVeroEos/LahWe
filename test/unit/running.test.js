'use strict';
// Running: the pace bands and "all runs", the Settings switch, weekly miles and the jump flag,
// best efforts, the race predictor and its tie to the fitness test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const { makeLog } = require('../fixtures/sim-log.js');

const NOW = '2026-10-08T09:00:00'; // a Thursday; the week began on Monday 5 October
const day = n => { const d = new Date(NOW); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const fresh = over => { const app = loadApp({ now: NOW }); app.state(Object.assign({ bodyweight: 190 }, over || {})); return app; };
let seq = 0;
const run = (n, dist, min, o) => Object.assign({ id: 'r' + (++seq), type: 'run', date: day(n), dist: String(dist), dur: String(min) }, o || {});
const html = app => app.run(`document.getElementById('content').innerHTML`);
const MILE = 1609.344;

test('the bug: GPS distances of one route are one group, not three', () => {
  const app = fresh({ activities: [run(20, 3.04, 26), run(13, 3.11, 26), run(6, 3.2, 27), run(2, 3.33, 28)] });
  const opts = app.json('paceOptions()');
  assert.deepEqual(opts.map(o => [o.label, o.n]), [['Run · 5K', 4]], 'one band, every run in it, and no separate "all runs" when it would say the same');
  assert.equal(app.json(`paceSeries(paceOptions()[0]).length`), 4);
  assert.equal(app.json(`METRICS.runpace.tile(boardRange(),{k:'runpace'}).title`), 'Run pace · 5K');
});

test('band edges: they lean long, they do not touch, and what falls between is only in "all runs"', () => {
  const app = fresh();
  const b = (t, d) => { const x = app.json(`paceBand(${JSON.stringify(t)},${d})`); return x ? x.label : null; };
  assert.deepEqual([0.92, 0.93, 1, 1.14, 1.15].map(d => b('run', d)), [null, '1 mi', '1 mi', '1 mi', null]);
  assert.deepEqual([1.85, 1.86, 2, 2.24, 2.25].map(d => b('run', d)), [null, '2 mi', '2 mi', '2 mi', null]);
  assert.deepEqual([2.94, 2.95, 3.04, 3.107, 3.2, 3.34, 3.35].map(d => b('run', d)), [null, '5K', '5K', '5K', '5K', '5K', null]);
  assert.deepEqual([3.74, 3.75, 4, 4.29, 4.3].map(d => b('run', d)), [null, '4 mi', '4 mi', '4 mi', null]);
  assert.deepEqual([5.89, 5.9, 6.214, 6.59, 6.6].map(d => b('run', d)), [null, '10K', '10K', '10K', null]);
  assert.deepEqual([12.59, 12.6, 13.109, 13.59, 13.6, 20, 26.2].map(d => b('run', d)), [null, 'Half', 'Half', 'Half', 'Longer', 'Longer', 'Longer']);
  assert.deepEqual([0, 0.4, 1.5, 2.5, 5, 8, 10].map(d => b('run', d)), [null, null, null, null, null, null, null], 'a 5-mile run is not a slow 4-miler or a fast 10K');
  // other kinds: the nearest mile, then the nearest five
  assert.deepEqual([[0.4, null], [0.6, '1 mi'], [3.6, '4 mi'], [4.4, '4 mi'], [10.4, '10 mi'], [12.2, '10 mi'], [12.6, '15 mi'], [31, '30 mi']].map(([d, want]) => [b('ruck', d), want]).filter(x => x[0] !== x[1]), []);
  const mixed = fresh({ activities: [run(30, 3.1, 26), run(25, 5, 44), run(20, 8, 72), run(15, 3.1, 25.5), run(10, 1, 7.5), run(5, 0.5, 3)] });
  const opts = mixed.json('paceOptions()');
  assert.deepEqual(opts.map(o => [o.label, o.n]), [['Run · all runs', 5], ['Run · 5K', 2], ['Run · 1 mi', 1]], 'the 5- and 8-milers are in all runs only; the half-mile sprint is in nothing');
});

test('all runs: every distance on one scale with Riegel, and its direction from a fitted line', () => {
  const app = fresh();
  // T2 = T1 × (D2 ÷ D1)^1.06
  assert.ok(Math.abs(app.run(`riegel(1200,${2 * MILE},5000)`) - 1200 * Math.pow(5000 / (2 * MILE), 1.06)) < 1e-9);
  assert.ok(Math.abs(app.run('riegel(1500,5000,5000)') - 1500) < 1e-9);
  assert.equal(Math.round(app.run('riegel(1500,5000,10000)')), 3127, 'a 25:00 5K is worth 52:07 over 10K');
  // the same fitness at three distances reads as the same 5K pace
  const at5k = 1500, t = m => at5k * Math.pow(m / 5000, 1.06) / 60;
  const same = fresh({ activities: [run(21, 1, t(MILE)), run(14, 3.107, t(3.107 * MILE)), run(7, 8, t(8 * MILE))] });
  const v = same.json('paceSeries(paceOptions().find(o=>o.all)).map(p=>p.v)');
  v.forEach(x => assert.ok(Math.abs(x - at5k / (5000 / MILE)) < 0.6, `${x} s a mile as a 5K`));
  assert.ok(same.json('paceSeries(paceOptions().find(o=>o.all))')[2].sec > v[2] + 20, 'the 8-miler’s own pace is slower than what it is worth over 5K');
  // easy and hard days alternate while the runner gets faster: first-against-last is noise, the fit is not
  const acts = []; for (let i = 0; i < 12; i++) acts.push(run(84 - i * 7, 3.1, (i % 2 ? 24 : 28) - i * 0.15));
  const alt = fresh({ activities: acts.concat([run(1, 5, 46)]) });
  const tile = alt.json(`METRICS.runpace.tile(boardRange(),{k:'runpace',type:'run',dist:0})`);
  assert.match(tile.sub, /^Trend: \d+ s a mile faster$/); assert.equal(tile.tone, 'good');
  const d = alt.json(`metricDetail('runpace',{k:'runpace',type:'run',dist:0},boardRange())`);
  assert.equal(d.title, '5K pace, all runs'); assert.match(d.chart, /sp-fit/, 'the fitted line is drawn'); assert.match(d.how, /Riegel/);
  assert.match(alt.json(`metricDetail('runpace',{k:'runpace',type:'run',dist:3.1},boardRange())`).how, /distance bands/);
});

test('Patterns still reads run pace band by band, needs six runs in a band, and never counts a run twice', () => {
  const log = makeLog(11, { weeks: 30 });
  // the simulated runs are all "3.1": give them GPS distances, which used to split them into groups too small to test
  let i = 0; log.activities.forEach(a => { a.dist = ['3.04', '3.11', '3.2', '3.07'][i++ % 4]; });
  const app = loadApp({ now: '2026-10-07T12:00:00' }); app.state(log);
  const runs = app.json('patData().runs');
  assert.ok(runs.length >= 30, `${runs.length} runs reach Patterns`);
  assert.equal(new Set(runs.map(r => r.ds)).size, runs.length, 'each run once, though it is also in "all runs"');
  const few = loadApp({ now: '2026-10-07T12:00:00' }); few.state(Object.assign({}, log, { activities: log.activities.slice(0, 5) }));
  assert.equal(few.json('patData().runs.length'), 0, 'five in a band is not enough');
});

test('the Running switch: on by itself after three runs or rucks with a distance, then wherever it is put', () => {
  const none = fresh({ workouts: [] });
  assert.equal(none.json('runningOn()'), false); assert.equal(none.json('S.running'), null);
  const two = fresh({ activities: [run(3, 3, 25), run(2, '', 30), { id: 'k', type: 'ruck', date: day(5), dist: '4', dur: '60' }, { id: 'w', type: 'walk', date: day(6), dist: '2', dur: '40' }, { id: 'e', type: 'run', date: day(7), dist: '3', dur: '30', distEst: true }] });
  assert.equal(two.json('[runAutoCount(),runningOn()]').join(), '2,false', 'a walk, a run with no distance and one with an estimated distance do not count');
  const three = fresh({ activities: [run(3, 3, 25), run(2, 2, 17), { id: 'k', type: 'ruck', date: day(5), dist: '4', dur: '60' }] });
  assert.equal(three.json('runningOn()'), true);
  assert.ok(three.json('boardTiles().map(t=>t.k)').includes('runmiles'), 'the weekly miles tile joins the default board');
  three.run(`showSettings=()=>{};toggleRunning()`);
  assert.deepEqual(three.json('[S.running,runningOn()]'), [false, false], 'touched: off stays off');
  assert.ok(!three.json('boardTiles().map(t=>t.k)').includes('runmiles')); assert.ok(three.json('boardTiles().map(t=>t.k)').includes('runpace'), 'the pace tile is not one of the running tiles');
  assert.equal(three.json(`tileAllowed('runbest')||tileAllowed('runpred')`), false);
  assert.equal(three.run('runTwoMileText()'), '');
  three.run(`S.activities=[];save();toggleRunning()`);
  assert.deepEqual(three.json('[S.running,runningOn()]'), [true, true], 'and on stays on with no runs at all');
  assert.equal(three.json('normalizeState(JSON.parse(JSON.stringify(S))).running'), true);
  // a board arranged by hand keeps its running tile out of sight while the switch is off, and gets it back
  const app = fresh({ activities: [run(3, 3, 25), run(2, 2, 17), run(1, 3, 26)], board: { range: '12w', tiles: [{ k: 'weight' }, { k: 'runmiles' }, { k: 'runbest' }] } });
  assert.deepEqual(app.json('boardTiles().map(t=>t.k)'), ['weight', 'runmiles', 'runbest']);
  app.run('S.running=false'); assert.deepEqual(app.json('boardTiles().map(t=>t.k)'), ['weight']);
  app.run('S.running=true'); assert.deepEqual(app.json('boardTiles().map(t=>t.k)'), ['weight', 'runmiles', 'runbest']);
  app.run(`S.running=false;go('progress')`); assert.ok(!html(app).includes('tile-runmiles'));
});

test('weekly miles: runs only, Monday to Sunday, and a flag only for a real jump', () => {
  // weeks ending with this one (Thursday 8 Oct: Mon 5 Oct is day 3)
  const weeks = miles => { const a = []; miles.forEach((mi, i) => { const back = (miles.length - 1 - i) * 7 + 2; if (mi > 0) a.push(run(back, mi, mi * 9)); }); return a; };
  const jump = miles => fresh({ activities: weeks(miles) }).json('runJumpNow()');
  assert.deepEqual(jump([10, 10, 10, 10, 14]), { when: 'this', pct: 40, mi: 14, base: 10 });
  assert.equal(jump([10, 10, 10, 10, 11.4]), null, 'under 15%');
  assert.equal(jump([10, 6, 10, 6, 10]), null, '25% over the average, but only back to a normal week');
  assert.equal(jump([3, 3, 3, 3, 6]), null, 'double, on a base too small to mean anything');
  assert.equal(jump([0, 0, 0, 24, 12]), null, 'one earlier week is not a base');
  assert.equal(jump([5.5, 5.5, 5.5, 5.5, 7]), null, 'over by 27% but by less than two miles');
  assert.deepEqual(jump([10, 10, 10, 10, 15, 3]), { when: 'last', pct: 50, mi: 15, base: 10 }, 'last week, while this one is still young');
  const app = fresh({ activities: weeks([8, 9, 8, 9, 13]).concat([{ id: 'k', type: 'ruck', date: day(2), dist: '12', dur: '200' }, { id: 'w', type: 'walk', date: day(1), dist: '3', dur: '60' }]) });
  const w = app.json('runWeeksAll()');
  assert.equal(w.length, 5); assert.deepEqual(w.map(x => x.mi), [8, 9, 8, 9, 13], 'the ruck and the walk are not running miles'); assert.equal(w[4].current, true); assert.equal(w[4].mon, '2026-10-05');
  const t = app.json(`METRICS.runmiles.tile(boardRange(),{k:'runmiles'})`);
  assert.deepEqual([t.title, t.value, t.unit, t.tone], ['Miles · this week', '13', ' mi', 'warn']); assert.match(t.sub, /^53% over your recent weeks$/);
  // the warning is on Progress and the Running page, never on Home
  app.run(`go('workout')`); assert.ok(!/over your (recent|last)|big step up/i.test(html(app)), 'Home says nothing about it');
  app.run(`go('progress')`); assert.ok(html(app).includes('53% over your recent weeks'));
  const calm = fresh({ activities: weeks([8, 9, 8, 9, 9]) }).json(`METRICS.runmiles.tile(boardRange(),{k:'runmiles'})`);
  assert.deepEqual([calm.tone, calm.sub], ['flat', '8.5 a week lately']);
  assert.equal(fresh().json(`METRICS.runmiles.tile(boardRange(),{k:'runmiles'}).empty`), 'Log a run with its distance to see your week.');
});

test('best efforts: found inside a run that has a route; a run without one counts only as a whole', () => {
  const app = fresh({ activities: [
    run(40, 6.2, 56, { sec: 3360, rt: { n: 150, be: { m1: 500, m2: 1010, k5: 1590, k10: 3355 } } }),   // a 10K with a quick 5K inside it
    run(30, 3.1, 26),            // "3.1 miles", typed by hand: a 5K
    run(20, 3.2, 27),            // within 5% over 5K: its share of the time
    run(10, 4, 33),              // no route: says nothing about a 5K
    run(5, 1, 7),                // a mile, typed
    run(3, 2, 15, { durEst: true }),
  ] });
  const b = app.json(`(()=>{const x=runBests();const o={};Object.keys(x).forEach(k=>o[k]=[x[k].sec,x[k].ds,x[k].whole]);return o})()`);
  assert.deepEqual(b.m1, [420, day(5), true]); assert.deepEqual(b.m2, [1010, day(40), false], 'the estimated two-miler is not a time');
  assert.deepEqual(b.k5, [1560, day(30), true], '26:00 for 3.1 mi beats the 26:30 inside the 10K');
  assert.deepEqual(b.k10, [3355, day(40), false]); assert.ok(!b.hm);
  assert.deepEqual(app.json(`runEfforts({a:{},mi:3.2,sec:1620})`), { k5: 1572.8 }, '27:00 for 3.2 mi is credited 26:13 for the 5K it contains');
  assert.deepEqual(app.json(`runEfforts({a:{},mi:3.3,sec:1620})`), {}, 'more than 5% over is a different run');
  assert.deepEqual(app.json(`runEfforts({a:{},mi:4,sec:1980})`), {}, 'a 4-miler without a route is not a 5K');
  assert.deepEqual(Object.keys(app.json('runBests(daysAgoStr(25))')).sort(), ['k5', 'm1'].sort());
  const t = app.json(`METRICS.runbest.tile(boardRange(),{k:'runbest'})`);
  assert.deepEqual(t.rows.map(r => [r.label, r.value]), [['1 mile', '7:00'], ['2 miles', '16:50'], ['5K', '26:00'], ['10K', '55:55']]);
});

test('the race predictor keeps the fastest answer from recent efforts, says where it came from, and feeds the fitness test', () => {
  const acts = [
    run(100, 3.1, 22),                                         // 14 weeks ago: too old to be "current"
    run(30, 3.1, 25),                                          // 5K in 25:00
    run(12, 4, 34, { sec: 2040, rt: { n: 90, be: { m1: 460, m2: 950, k5: 1580 } } }),
    run(4, 0.5, 2.5),                                          // a sprint: not used
  ];
  const app = fresh({ activities: acts, birthYear: 1997, birthMonth: 3, aftGender: 'male' });
  const p5 = app.json('runPredict(5000)');
  assert.equal(Math.round(p5.sec), 1504, '25:00 for 3.1 miles, carried the last 11 metres'); assert.equal(p5.ds, day(30)); assert.equal(p5.old, false);
  const two = app.json('runTwoMile()');
  assert.equal(Math.round(two.sec), Math.round(Math.min(950, 1500 * Math.pow(2 / 3.1, 1.06), 460 * Math.pow(2, 1.06))), 'the two miles inside the 4-miler, the 5K carried down, or the mile carried up: whichever is fastest');
  assert.equal(two.pts, app.json(`aftScore('2MR',${Math.round(two.sec)})`));
  assert.match(app.run('runTwoMileText()'), /^On current form \d+:\d\d \(\d+ pts\), from your (2 mi|5K|mile) in \d+:\d\d on \w+ \d+\.$/);
  const half = app.json('runPredict(21097.5)');
  assert.ok(half.m >= 21097.5 / 5, 'a mile says too little about a half: not used'); assert.equal(half.far, true, 'and a 5K is flagged as a long way from it');
  // nothing in the last 12 weeks: the older run is used, and said to be old
  const stale = fresh({ activities: [run(100, 3.1, 22)] }).json('runPredict(5000)');
  assert.equal(stale.old, true); assert.equal(Math.round(stale.sec), Math.round(1320 * Math.pow(5000 / (3.1 * MILE), 1.06)));
  assert.equal(fresh({ activities: [run(200, 3.1, 22)] }).json('runPredict(5000)'), null, 'older than six months says nothing');
  // the test plan and the fitness card both say it
  app.run(`S.aftCurrent['2MR']='950';S.aftGoals['2MR']='880';setTestDate(addDays(today(),42));showTestPlan=()=>{}`);
  const pred = app.json(`METRICS.runpred.tile(boardRange(),{k:'runpred'})`);
  assert.equal(pred.title, 'Two-mile · on form'); assert.match(pred.unit, /pts$/);
  assert.match(app.run('renderAFTBody()'), /id="aft-2mr-form">On current form/);
  app.run('S.testPlan=null'); assert.equal(app.json(`METRICS.runpred.tile(boardRange(),{k:'runpred'}).title`), '5K · on form');
  app.run('S.running=false'); assert.ok(!/aft-2mr-form/.test(app.run('renderAFTBody()')), 'with Running off the card is as it was');
});
