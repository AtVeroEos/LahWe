'use strict';
// Patterns: outcomes measured against your own trend, the four bars a finding must clear, what
// happens on a log with nothing in it, the captures that feed it, and the cut-down Home.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const { makeLog, NOW } = require('../fixtures/sim-log.js');
const { demoState } = require('../../tools/demo-state.js');

const sim = (seed, fx, over) => { const app = loadApp({ now: NOW }); app.state(Object.assign(makeLog(seed, fx), over || {})); return app; };
const found = app => app.json(`patterns().found.map(r=>({id:r.test.id,tier:r.tier,eff:r.e.eff,p:r.p,n:r.n,t:r.t,s:r.s,also:(r.also||[]).map(x=>x.test.id)}))`);
const text = h => String(h).replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

test('an outcome is the gap from your own trend, not the raw number', () => {
  const app = loadApp({ now: NOW }); app.state({});
  const res = (pts, o) => app.json(`patResiduals(${JSON.stringify(pts)},${JSON.stringify(Object.assign({ n: 4, span: 60, need: 3, pct: true, clamp: 20 }, o || {}))})`);
  // a lift climbing steadily has no gap anywhere, however far it has come
  const line = Array.from({ length: 12 }, (_, i) => ({ t: i * 7, v: 200 + i * 5 }));
  assert.ok(res(line).every(r => Math.abs(r) < 0.01), 'a straight climb is all zeros');
  // one good day stands out by what it was worth, and does not drag its neighbours' expectations far
  const bump = line.map((p, i) => i === 6 ? { t: p.t, v: p.v * 1.05 } : p);
  const rb = res(bump);
  assert.ok(Math.abs(rb[6] - 5) < 0.3, `the good day reads +5% (${rb[6].toFixed(2)})`);
  assert.ok(rb.every((r, i) => i === 6 || Math.abs(r) < 1.6));
  // too few sessions around it, or sessions too long ago: no opinion
  assert.deepEqual(res(line.slice(0, 3)), [null, null, null]);
  assert.equal(res([{ t: 0, v: 200 }, { t: 7, v: 205 }, { t: 14, v: 210 }, { t: 21, v: 215 }, { t: 400, v: 260 }])[4], null);
  // a typo (or an injury) is not a pattern
  assert.equal(res(line.map((p, i) => i === 5 ? { t: p.t, v: 20 } : p))[5], null);
  // the ends of a series are held near what the neighbours actually did
  const noisy = [{ t: 0, v: 300 }, { t: 7, v: 200 }, { t: 14, v: 205 }, { t: 21, v: 210 }, { t: 28, v: 215 }];
  assert.ok(res(noisy, { clamp: 99 })[0] < 60, 'an end point is not extrapolated to nonsense');
  // weight is in the unit itself, not a percentage
  const w = Array.from({ length: 15 }, (_, i) => ({ t: i, v: 190 - i * 0.1 + (i === 7 ? 1.5 : 0) }));
  assert.ok(Math.abs(app.json(`patResiduals(${JSON.stringify(w)},{n:7,span:7,need:4,pct:false,clamp:6})`)[7] - 1.5) < 0.1);
});

test('the arithmetic: permutation tests are repeatable, and the correction for many tests is the standard one', () => {
  const app = loadApp({ now: NOW }); app.state({});
  const x = Array.from({ length: 40 }, (_, i) => i % 2), same = x.map((_, i) => (i * 37 % 11) - 5), apart = x.map((v, i) => v * 4 + (i * 37 % 11) / 5);
  const p = (xs, ys, seed) => app.json(`patPermGroup(${JSON.stringify(xs)},${JSON.stringify(ys)},${seed})`);
  assert.ok(p(x, same, 1) > 0.2, 'no difference is not significant');
  assert.ok(p(x, apart, 1) < 0.01, 'a clear difference is');
  assert.equal(p(x, apart, 7), p(x, apart, 7), 'the same log gives the same answer');
  assert.equal(p([1, 1, 1], [1, 2, 3], 1), 1, 'one group only: nothing to compare');
  const ranks = app.json('patRanks([10,30,20,20])'); assert.deepEqual(ranks, [1, 4, 2.5, 2.5]);
  assert.ok(app.json(`patPermCorr([1,2,3,4,5,6,7,8,9,10,11,12],[2,1,4,3,6,5,8,7,10,9,12,11],3)`) < 0.01);
  // Benjamini–Hochberg at 10%: with ten tests, p ≤ k/10 × 0.1 for the k-th smallest
  const rs = [0.001, 0.008, 0.039, 0.041, 0.2, 0.5, 0.6, 0.7, 0.8, 0.9].map(pv => ({ ok: true, p: pv }));
  app.ctx.__rs = rs; app.run('patBH(__rs,0.10)');
  assert.deepEqual(app.ctx.__rs.map(r => r.bh), [true, true, false, false, false, false, false, false, false, false]);
  // …and a p of 0.04 that would pass alone does not pass among ten
  app.ctx.__one = [{ ok: true, p: 0.04 }]; app.run('patBH(__one,0.10)'); assert.equal(app.ctx.__one[0].bh, true);
});

test('planted effects are found, with the count, and the same thing seen twice is one finding', () => {
  const app = sim(1, { rest: 3, restWeight: 0.8, cardioLegs: -3, loose: true, weeks: 44 });
  const f = found(app); const by = id => f.find(x => x.id === id);
  assert.ok(by('rest') && by('rest').eff > 2 && by('rest').eff < 4, 'lifts after a day off: about the 3% that was planted');
  assert.match(by('rest').t, /^Your lifts are \d\.\d% better after a day off$/);
  assert.match(by('rest').s, /^\d+ of \d+ sessions after a day off were above your trend, against \d+ of \d+ the day after training\.$/);
  assert.ok(by('w-rest') && by('w-rest').eff > 0.4 && by('w-rest').eff < 1.2, 'the scale after a rest day: about the 0.8 lb planted');
  assert.ok(by('cardio-legs') && by('cardio-legs').eff < -1.5, 'leg lifts after a run');
  assert.ok(f.every(x => x.tier === 'solid' || x.tier === 'likely'));
  // per-lift versions of the same finding are listed under it, not beside it
  assert.ok(by('rest').also.some(id => /^rest:/.test(id)), 'each lift’s own “after a day off” is folded into the one finding');
  assert.ok(!f.some(x => /^rest:/.test(x.id)));
  // …but the exercise sheet still gets the lift's own version
  assert.ok(app.json(`patForLift('squat').map(r=>r.test.id)`).some(id => id === 'rest:squat' || id === 'cardio:squat'));
  assert.match(text(app.json(`metricDetail('lift',{id:'squat'},boardRange()).body`)), /Patterns Barbell Back Squat is \d\.\d% /);
  // the placebo check stayed quiet, so the normal bar is in force
  assert.equal(app.run('patterns().strict'), false);
  assert.ok(!f.some(x => x.id === 'cardio-upper'));
});

test('a fixed weekly split cannot tell "after a rest day" from "that workout", and the app does not pretend to', () => {
  // Monday and Thursday always follow a rest day and always carry the same lifts: the planted
  // effect is welded to the workout, so there is nothing within a lift to compare.
  const app = sim(1, { rest: 3 });
  assert.ok(!found(app).some(x => x.id === 'rest' || /^rest:/.test(x.id)));
});

test('a log with nothing in it shows nothing: one false finding in twenty logs at most', () => {
  let shown = 0, tested = 0, early = 0;
  for (let i = 0; i < 20; i++) { const app = sim(100 + i, { loose: i % 2 === 1 }); const r = app.json('[patterns().found.length,patterns().tested,patterns().early.length]'); shown += r[0]; tested += r[1]; early += r[2]; }
  assert.ok(tested > 400, `${tested} tests run`);
  assert.ok(shown <= 1, `${shown} shown as found across 20 logs with no effect in them`);
  assert.ok(early / tested < 0.04, `early signs stay rare too (${early} of ${tested})`);
});

test('the four bars, one at a time', () => {
  const app = loadApp({ now: NOW }); app.state({});
  const run = obs => { app.ctx.__t = { id: 'x', kind: 'group', out: 'lift', obs }; return app.json(`(()=>{const r=patRun(__t);return {ok:r.ok,eff:r.e?r.e.eff:null,p:r.p,stable:r.stable,big:r.big,strong:r.strong,na:r.na,nb:r.nb,ka:r.e?r.e.a.k:null}})()`); };
  const mk = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  // not enough on one side: not tested at all
  assert.equal(run(mk(20, i => ({ x: i < 5, y: i < 5 ? 3 : 0, t: i }))).ok, false);
  // enough cases, a real gap, in both halves
  const good = run(mk(40, i => ({ x: i % 2 === 0, y: (i % 2 === 0 ? 3 : 0) + (i * 7 % 5) / 5, t: i })));
  assert.deepEqual([good.ok, good.stable, good.big, good.strong, good.na, good.nb, good.ka], [true, true, true, true, 20, 20, 20]);
  assert.ok(good.p < 0.01);
  // too small to matter, however consistent
  const tiny = run(mk(60, i => ({ x: i % 2 === 0, y: (i % 2 === 0 ? 0.6 : 0) + (i * 7 % 5) / 50, t: i })));
  assert.deepEqual([tiny.big, tiny.p < 0.01], [false, true]);
  // only in the first half of the history: not stable
  const half = run(mk(40, i => ({ x: i % 2 === 0, y: (i % 2 === 0 && i < 20 ? 6 : 0) + (i * 7 % 5) / 5, t: i })));
  assert.equal(half.stable, false);
  // tiers follow from the bars
  const tier = (o) => { app.ctx.__r = [Object.assign({ ok: true, p: 0.001, stable: true, big: true, strong: true, test: {} }, o)]; app.run('patTiers(__r,0.10)'); return app.ctx.__r[0].tier; };
  assert.equal(tier({}), 'solid');
  assert.equal(tier({ strong: false }), 'likely');
  assert.equal(tier({ stable: false }), 'early');
  assert.equal(tier({ big: false }), 'none');
  assert.equal(tier({ p: 0.3 }), 'none');
  assert.equal(tier({ ok: false }), 'more');
});

test('a placebo check that fires raises the bar for everything', () => {
  // Running the day before should not change upper-body lifts. Here it is made to, as a broken
  // or unlucky log would: the app stops trusting its own threshold.
  const app = sim(5, { cardioUpper: -4, loose: true, weeks: 44 });
  assert.equal(app.run('patterns().strict'), true);
  assert.ok(!found(app).some(x => x.id === 'cardio-upper'), 'the placebo itself is never shown as a finding');
  assert.match(app.run('patternsHTML()'), /A placebo check came up positive/);
});

test('too little logged: nothing is tested, and the page says how far each one has to go', () => {
  const app = sim(1, { weeks: 3, loose: true });
  const r = app.json('({tested:patterns().tested,found:patterns().found.length,more:patterns().more.length})');
  assert.ok(r.tested <= 4 && r.found === 0 && r.more > 20, `three weeks: ${r.tested} testable, ${r.more} waiting`);
  const h = text(app.run('patternsHTML()'));
  assert.match(h, /Nothing clears the bar yet|Not enough logged yet/); assert.match(h, /Needs more data · \d+/); assert.match(h, /needs 8 on each side/);
  // and an empty app does not throw anywhere
  const empty = loadApp({ now: NOW }); empty.state({});
  assert.deepEqual(empty.json('[patterns().tested,patterns().found.length,patRecords().days]'), [0, 0, 0]);
  assert.match(text(empty.run('patternsHTML()')), /Not enough logged yet to test anything/);
  assert.equal(empty.run('patHomeLine()'), null);
});

test('the Patterns page and one pattern’s evidence', () => {
  const app = sim(1, { rest: 3, restWeight: 0.8, cardioLegs: -3, loose: true, weeks: 44 });
  const h = text(app.run('patternsHTML()'));
  assert.match(h, /Found · \d/); assert.match(h, /Solid|Likely/); assert.match(h, /Tested, nothing found · \d+/);
  assert.match(h, /Your upper-body lifts, the day after cardio \(placebo check\)/, 'the placebo check is listed with what it is');
  assert.match(h, /of your last \d+ record days came after a day off/);
  assert.match(h, /survives a correction for the \d+ that were tested/);
  // the evidence sheet names the rival explanation and the odds, and draws every case
  const src = app.run('String(showPattern)');
  assert.match(src, /What else could explain it/); assert.match(src, /Odds of this by chance alone/);
  const svg = app.run(`patStripSVG(patById('rest'))`);
  const n = app.json(`patById('rest').n`);
  assert.equal((svg.match(/<circle/g) || []).length, n, 'one dot per session');
  // the board tile
  app.run('patterns()');
  const tile = app.json(`METRICS.patterns.tile(boardRange(),{k:'patterns'})`);
  assert.match(tile.unit, /^ found of \d+ tested$/); assert.match(tile.sub, /^Your lifts are /);
  // before the answer exists the tile says so and does not hold the screen up
  const cold = sim(2, { loose: true });
  assert.equal(cold.json(`METRICS.patterns.tile(boardRange(),{k:'patterns'})`).sub, 'Working it out');
});

test('sleep and "how it went": asked once, optional, switchable, and used', () => {
  // a planted effect of short nights is found once sleep is logged
  const app = sim(3, { sleep: -3, loose: true, weeks: 44 });
  const s = found(app).find(x => x.id === 'sleep');
  assert.ok(s && s.eff > 1.5, 'lifts are better after seven hours or more');
  assert.match(s.t, /after seven hours of sleep or more$/);
  // state: junk in a restored backup is dropped, real nights are kept to the half hour
  const st = loadApp({ now: NOW }); st.state({ sleepLog: { '2026-10-01': 7.3, '2026-10-02': '8', '2026-10-03': 40, '2026-10-04': -1, 'nope': 7, '2026-10-05': 'x' }, trackFeel: false, trackSleep: 'yes',
    workouts: [{ id: 'a', name: 'A', started: 1, exercises: [], feel: 4 }, { id: 'b', name: 'B', started: 2, exercises: [], feel: 9 }, { id: 'c', name: 'C', started: 3, exercises: [], feel: '<img>' }] });
  assert.deepEqual(st.json('S.sleepLog'), { '2026-10-01': 7.5, '2026-10-02': 8 });
  assert.deepEqual(st.json('[S.trackFeel,S.trackSleep]'), [false, true]);
  assert.deepEqual(st.json(`Object.fromEntries(S.workouts.map(w=>[w.id,w.feel||null]))`), { a: 4, b: null, c: null });
  // one tap sets it, a second takes it back
  st.run(`setSleep(7)`); assert.equal(st.run(`S.sleepLog[today()]`), 7);
  st.run(`setSleep(7)`); assert.equal(st.run(`S.sleepLog[today()]`), undefined);
  st.run(`S.activeWorkout={id:'w',name:'W',started:Date.now(),exercises:[]};setFeel(5)`); assert.equal(st.run('S.activeWorkout.feel'), 5);
  st.run(`setFeel(5)`); assert.equal(st.run('S.activeWorkout.feel'), undefined);
  // the switches remove the question from the sheets
  const on = loadApp({ now: NOW }); on.state({});
  assert.match(on.run('String(showFinish)'), /S\.trackFeel\?/); assert.match(on.run('String(showWeighIn)'), /S\.trackSleep\?/);
  on.run(`toggleSetting('trackSleep')`); assert.equal(on.run('S.trackSleep'), false);
});

test('Home: one encouraging line, one milestone, and problems moved to Progress', () => {
  const app = sim(1, { rest: 3, restWeight: 0.8, loose: true, weeks: 44 }, Object.assign({}, { routines: demoState(new Date(NOW).getTime()).routines, groups: demoState(new Date(NOW).getTime()).groups, weightGoal: 180, tab: 'workout' }));
  // before the patterns are worked out, Home draws without them
  app.run(`renderWorkout(document.getElementById('content'))`);
  const first = app.run(`document.getElementById('content').innerHTML`);
  assert.ok(first.includes('ms-card') && first.includes('This week'));
  for (const gone of ['No macros logged', 'Supplements:', 'Other workouts', 'class="list feed"']) assert.ok(!first.includes(gone), `“${gone}” is no longer on Home`);
  // once they are, the line is the rest-day one (7 Oct is a Wednesday: nothing planned)
  app.run('patterns()');
  const line = app.json('patHomeLine()');
  assert.equal(line.t, 'Rest day, and it counts'); assert.match(line.s, /^Your lifts are \d\.\d% better after a day off \(\d+ of \d+ sessions\)\.$/);
  app.run(`renderWorkout(document.getElementById('content'))`);
  assert.match(text(app.run(`document.getElementById('content').innerHTML`)), /Rest day, and it counts/);
  // milestones: the nearest plate on a main lift, the weight goal, a round number of sessions
  const ms = app.json('homeMilestones()');
  assert.ok(ms.length >= 2 && ms.every(m => m.frac >= 0 && m.frac < 1));
  assert.ok(ms.every((m, i) => !i || (ms[i - 1].frac - (ms[i - 1].kind === 'sessions' ? 0.25 : 0)) >= (m.frac - (m.kind === 'sessions' ? 0.25 : 0))), 'closest first');
  assert.ok(ms.some(m => m.kind === 'lift' && /^\d+ lbs /.test(m.t) && /to go on your estimated max/.test(m.s)));
  assert.ok(ms.some(m => m.kind === 'weight' && m.t === '180 lbs'));
  assert.ok(ms.some(m => m.kind === 'sessions' && /^\d+ sessions$/.test(m.t)));
  // plate marks in kilograms for a kilogram user
  const kg = loadApp({ now: NOW }); kg.state(Object.assign(makeLog(1, { loose: true }), { unit: 'kg' }));
  assert.ok(kg.json('homeMilestones()').filter(m => m.kind === 'lift').every(m => / kg /.test(m.t)));
  // what needs a look lives on Progress now
  const at = loadApp({ now: NOW }); at.state(demoState(new Date(NOW).getTime()));
  at.run(`S.lastExportAt=0;S.workouts.slice(0,8).forEach(w=>w.exercises.forEach(e=>e.sets.forEach(s=>{s.tag='Pain';})))`);
  const items = at.json('attentionItems()');
  assert.ok(items.some(i => /^Pain flagged on /.test(i.t)) && items.some(i => /backup/.test(i.t)));
  at.run(`S.tab='progress';S.progView='progress';renderProgress(document.getElementById('content'))`);
  assert.match(text(at.run(`document.getElementById('content').innerHTML`)), /Needs a look · \d+ Pain flagged on /);
  at.run(`S.tab='workout';renderWorkout(document.getElementById('content'))`);
  const home = at.run(`document.getElementById('content').innerHTML`);
  assert.ok(!/Pain flagged/.test(home) && /home-backup/.test(home), 'Home keeps only the backup reminder');
  // an empty app has neither line nor milestone, and still draws
  const empty = loadApp({ now: NOW }); empty.state({ tab: 'workout' });
  empty.run(`renderWorkout(document.getElementById('content'))`);
  assert.deepEqual(empty.json('[homeMilestones().length,homeLineHTML()]'), [0, '']);
});
