'use strict';
// Running, continued: training load and where its effort comes from, the week streak, the
// yearly goal, shoe miles, and stretches (marking one, timing every run over it, ranking).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const T = require('../fixtures/tracks.js');

const NOW = '2026-10-08T09:00:00'; // Thursday; the week began on Monday 5 October
const day = n => { const d = new Date(NOW); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const fresh = over => { const app = loadApp({ now: NOW }); app.state(Object.assign({ bodyweight: 185, birthYear: 1998, birthMonth: 1 }, over || {})); return app; };
const aj = async (app, code) => JSON.parse(await app.run(`(async()=>JSON.stringify(await (${code})))()`));
let seq = 0;
const act = (n, type, dist, min, o) => Object.assign({ id: 'a' + (++seq), type, date: day(n), dist: String(dist), dur: String(min) }, o || {});
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''} ${a} vs ${b} (±${tol})`);

test('load: minutes times effort, with effort from heart rate, then pace against your own usual, then the kind of activity', () => {
  // age 28: top heart rate 208 − 0.7 × 28 = 188
  const runs = [act(60, 'run', 3.1, 27), act(40, 'run', 3.1, 27), act(20, 'run', 3.1, 27)]; // the usual: 27:00 for 3.1
  const app = fresh({ activities: runs.concat([
    act(6, 'run', 3.1, 30, { sec: 1800, rt: { n: 50, hr: 150, hrx: 170 } }),   // heart rate: 150 of 188
    act(5, 'run', 3.1, 25.65),                                                // 5% quicker than usual, no heart rate
    act(4, 'ruck', 4, 60), act(3, 'walk', 2, 40), act(2, 'run', 3, 30, { durEst: true }),
  ]) });
  const L = id => app.json(`actLoad(S.activities.find(a=>a.id===${JSON.stringify(id)}),loadContext())`);
  const ids = app.json('S.activities.map(a=>a.id)');
  const ctx = app.json('loadContext()'); assert.equal(ctx.maxHr, 188); near(ctx.norm, 27 * 60 * Math.pow(5000 / (3.1 * 1609.344), 1.06) / (5000 / 1609.344), 0.5, 'the usual pace is the middle run of the last 90 days, as a 5K pace');
  const hr = L(ids[3]); assert.equal(hr.src, 'hr'); near(hr.e, 1 + (150 / 188 - 0.55) / 0.1, 0.001); near(hr.load, 30 * hr.e, 0.01);
  const pace = L(ids[4]); assert.equal(pace.src, 'pace'); near(pace.e, 4, 0.06, '5% quicker than usual is one step harder than middling');
  assert.deepEqual([L(ids[0]).src, Math.round(L(ids[0]).e * 10) / 10], ['pace', 3], 'the usual run is a 3');
  assert.deepEqual([L(ids[5]).src, L(ids[5]).e, L(ids[5]).load], ['kind', 3, 180]); assert.deepEqual([L(ids[6]).e, L(ids[6]).load], [1.5, 60]);
  assert.equal(L(ids[7]), null, 'an estimated time is not a load');
  // effort stays between 1 and 5
  assert.equal(app.json(`actLoad({type:'run',dist:'3.1',dur:'15',date:'${day(1)}'},loadContext()).e`), 5); assert.equal(app.json(`actLoad({type:'run',dist:'3.1',dur:'60',date:'${day(1)}'},loadContext()).e`), 1);
  // too few runs to know a usual pace: a run counts as a typical run
  assert.deepEqual(fresh({ activities: [act(3, 'run', 3, 25)] }).json(`(()=>{const l=actLoad(S.activities[0],loadContext());return[l.src,l.e]})()`), ['kind', 3]);
});

test('load: the last 7 days against the last 28, in plain words, and not until there are three weeks to compare', () => {
  const steady = n => [act(n, 'ruck', 4, 60)]; // 180 a session
  // one session in each of the four weeks: 7 days = 180, a week over 28 = 180
  let app = fresh({ activities: [3, 10, 17, 24].flatMap(steady) });
  let l = app.json('loadNow()');
  assert.deepEqual([l.acute, l.chronic, l.ratio, l.word, l.tone], [180, 180, 1, 'About your usual', 'flat']); assert.equal(l.days.length, 28); assert.equal(l.days[27].ds, day(0));
  app = fresh({ activities: [1, 3, 5, 10, 17, 24].flatMap(steady) });   // three this week
  l = app.json('loadNow()'); near(l.ratio, 540 / (1080 / 4), 0.001); assert.equal(l.word, 'Well above your usual'); assert.equal(l.tone, 'warn');
  assert.equal(fresh({ activities: [10, 12, 17, 19, 24, 26, 3].flatMap(steady) }).json('loadNow().word'), 'Lighter than your usual');
  assert.equal(fresh({ activities: [2, 4, 9, 12, 17, 19, 24].flatMap(steady) }).json('loadNow().word'), 'About your usual');
  // only this week logged: nothing to compare with yet
  l = fresh({ activities: [1, 3].flatMap(steady) }).json('loadNow()'); assert.equal(l.ratio, null); assert.equal(l.acute, 360);
  const t = fresh({ activities: [1, 3].flatMap(steady) }).json(`METRICS.runload.tile(boardRange(),{k:'runload'})`); assert.equal(t.sub, 'Three weeks of activities to compare');
  // lifting is not load, whatever the session was rated
  const lift = { id: 'w1', name: 'W', started: new Date(NOW).getTime() - 86400000, ended: new Date(NOW).getTime() - 86400000 + 3.6e6, feel: 5, exercises: [{ exId: 'squat', sets: [{ w: '225', r: '5', done: true }] }] };
  assert.equal(fresh({ activities: [3, 10, 17, 24].flatMap(steady), workouts: [lift] }).json('loadNow().acute'), 180);
  assert.equal(fresh().json(`METRICS.runload.tile(boardRange(),{k:'runload'}).empty`).length > 10, true);
  const tile = fresh({ activities: [1, 3, 5, 10, 17, 24].flatMap(steady) }).json(`METRICS.runload.tile(boardRange(),{k:'runload'})`);
  assert.deepEqual([tile.value, tile.unit, tile.sub, tile.tone], ['2.0×', ' your usual', 'Well above your usual', 'warn']);
});

test('consistency: weeks in a row with a run, and a yearly goal with where the recent rate ends the year', () => {
  const run = (n, mi) => act(n, 'run', mi, mi * 9);
  // runs in this week (day 2) and each of the four weeks before; none the week before that
  let app = fresh({ activities: [2, 9, 16, 23, 30, 44].map(n => run(n, 4)) });
  assert.equal(app.json('runWeekStreak()'), 5);
  app = fresh({ activities: [9, 16, 23, 44].map(n => run(n, 4)) });
  assert.equal(app.json('runWeekStreak()'), 3, 'nothing yet this week does not break the streak');
  app = fresh({ activities: [16, 23].map(n => run(n, 4)) });
  assert.equal(app.json('runWeekStreak()'), 0, 'a whole week missed does');
  // the year: eight finished weeks at 10 miles, and a goal
  const acts = []; for (let w = 1; w <= 8; w++) acts.push(run(w * 7 - 1, 6), run(w * 7 - 3, 4)); acts.push(run(1, 5)); acts.push(Object.assign(run(1, 3), { date: '2025-12-30' }));
  app = fresh({ activities: acts, runGoal: { miles: 400 } });
  const y = app.json('runYear()'); const left = Math.round((new Date('2026-12-31T12:00:00') - new Date(day(0) + 'T12:00:00')) / 86400000);
  assert.deepEqual([y.year, y.ytd, y.rate, y.left, y.goal, y.met], ['2026', 85, 10, left, 400, false], 'last year’s run is not in this year');
  near(y.proj, 85 + 10 * left / 7, 0.01); near(y.need, (400 - 85) / (left / 7), 0.01);
  app.run(`renderRunning=()=>{};setRunGoal('60')`); assert.deepEqual(app.json('[S.runGoal,runYear().met,runYear().need]'), [{ miles: 60 }, true, 0]);
  app.run(`setRunGoal('')`); assert.equal(app.json('S.runGoal'), null); app.run(`setRunGoal('abc')`); assert.equal(app.json('S.runGoal'), null);
  assert.deepEqual([{ miles: '250.4' }, { miles: -5 }, { miles: 1e9 }, 'x', null].map(v => app.json(`normalizeRunGoal(${JSON.stringify(v)})`)), [{ miles: 250 }, null, null, null, null]);
  assert.match(app.run('consistencySectionHTML()'), /Set a goal to see what it needs each week/);
});

test('shoes: miles for each pair from the gear on imported activities, a flag at 400, and retiring a pair', () => {
  const acts = [];
  for (let i = 0; i < 52; i++) acts.push(act(300 - i * 5, 'run', 8, 70, { gear: 'Brooks Ghost 16' }));                 // 416 mi
  acts.push(act(20, 'run', 5, 45, { gear: 'Hoka Clifton 9' }), act(10, 'walk', 3, 60, { gear: 'Hoka Clifton 9' }), act(5, 'ruck', 4, 62, { gear: 'Garmont T8' }),
    act(4, 'bike', 20, 60, { gear: 'Trek Domane' }), act(3, 'run', 3, 26), act(2, 'run', 2, 20, { gear: 'Hoka Clifton 9', distEst: true }));
  const app = fresh({ activities: acts });
  const list = app.json('shoeList()');
  assert.deepEqual(list.map(s => [s.name, s.mi, s.n, s.worn, s.retired]), [['Garmont T8', 4, 1, false, false], ['Hoka Clifton 9', 8, 2, false, false], ['Brooks Ghost 16', 416, 52, true, false]], 'a bike is not a shoe; a run with no gear, or an estimated distance, is nobody’s miles; newest in use first');
  assert.match(app.run('shoeSectionHTML()'), /id="shoe-nudge"[^>]*><b>Brooks Ghost 16<\/b> has passed 400 miles/);
  app.run(`renderRunning=()=>{};shoeRetire('Brooks Ghost 16',true)`);
  assert.deepEqual(app.json('S.shoes'), { 'Brooks Ghost 16': { retired: true } });
  assert.deepEqual(app.json('shoeList().map(s=>[s.name,s.retired])'), [['Garmont T8', false], ['Hoka Clifton 9', false], ['Brooks Ghost 16', true]]);
  assert.ok(!/shoe-nudge/.test(app.run('shoeSectionHTML()')) && /Retired \(1\)/.test(app.run('shoeSectionHTML()')), 'a retired pair is no longer flagged, and is folded away');
  app.run(`shoeRetire('Brooks Ghost 16',false)`); assert.deepEqual(app.json('S.shoes'), {});
  // a hostile shoe name is text, never markup
  const evil = fresh({ activities: [act(3, 'run', 5, 45, { gear: '<img src=x onerror=alert(1)>' })] });
  assert.ok(!evil.run('shoeSectionHTML()').includes('<img') && evil.run('shoeSectionHTML()').includes('&lt;img'));
  assert.deepEqual(app.json(`normalizeShoes({'  A  ':{retired:1},B:{retired:false},C:'x',['D'.repeat(200)]:{retired:true}})`), { A: { retired: true }, ['D'.repeat(80)]: { retired: true } });
  assert.equal(fresh().run('shoeSectionHTML()'), '');
});

// ─── Stretches ───
const LOOP = [[0, 1200], [1300, 0], [0, -1200], [-1300, 0]];
async function withRoutes(specs) {
  const app = fresh();
  for (const s of specs) {
    const pts = T.makeRun(Object.assign({ speed: 3, noise: 0 }, s.run));
    app.set('window._b', Buffer.from(T.toTcx(pts)));
    app.set('window._a', { id: s.id, type: s.type || 'run', date: day(s.back || 1), dist: (pts[pts.length - 1].dist / 1609.344).toFixed(2), dur: String(Math.round(pts.length / 60)), notes: s.id });
    await app.run(`(async()=>{const x=routeFromTrack(trackParse('tcx',new Uint8Array(_b)),_a.type,0);_a.rt=x.sum;_a.sec=x.sec;S.activities.push(_a);await Routes.put(_a.id,x.rec);})()`);
  }
  app.run('save()');
  return app;
}
test('a stretch: marked on one run, every run that follows it is timed; the wrong way, half of it, or the next street is not', async () => {
  const app = await withRoutes([
    { id: 'first', back: 30, run: { legs: LOOP, speed: 3 } },
    { id: 'quick', back: 20, run: { legs: LOOP, speed: 3.75, noise: 2.5, seed: 4 } },                        // the same loop, faster, with GPS wander
    { id: 'slow', back: 10, run: { legs: LOOP, speed: 2.5 } },
    { id: 'reverse', back: 9, run: { legs: [[1300, 0], [0, 1200], [-1300, 0], [0, -1200]], speed: 3.2 } },   // the other way round
    { id: 'half', back: 8, run: { legs: [[0, 1200], [600, 0], [0, -1200]], speed: 3 } },                     // leaves the stretch half way
    { id: 'nextst', back: 7, run: { legs: [[0, 1320], [1300, 0], [0, -1200]], speed: 3 } },                  // one street over (120 m north) along the top
    { id: 'laps', back: 6, run: { legs: LOOP.concat(LOOP), speed: (t, d) => d < 5000 ? 2.6 : 3.4 } },        // twice round, the second lap faster
    { id: 'ruck', type: 'ruck', back: 5, run: { legs: LOOP, speed: 1.7 } },
  ]);
  // the top side of the loop, 1,300 m heading east: from 1,200 m to 2,500 m along the first run
  const seg = await aj(app, `segCreate('first',1200,2500,'  Top road  ')`);
  assert.equal(seg.name, 'Top road'); assert.equal(seg.kind, 'run'); near(seg.m, 1300, 0.5);
  const eff = app.json(`segEfforts(S.segments[0]).map(e=>[e.a.id,e.sec])`);
  assert.deepEqual(eff.map(e => e[0]), ['quick', 'laps', 'first', 'slow'], 'ranked fastest first: the reversed loop, the half, the next street and the ruck are not there');
  const t = Object.fromEntries(eff);
  near(t.first, 1300 / 3, 3); near(t.quick, 1300 / 3.75, 6, 'with GPS wander'); near(t.slow, 1300 / 2.5, 3); near(t.laps, 1300 / 3.4, 4, 'the faster of its two laps');
  // nothing about where it is reaches S; its line is a route of its own, and a backup carries it
  assert.ok(!/"lat"|"lon"|"p":/.test(app.run('JSON.stringify(S.segments)'))); assert.deepEqual(Object.keys(app.json('S.segments[0]')).sort(), ['efforts', 'from', 'id', 'kind', 'm', 'made', 'name']);
  assert.ok(app.json(`Object.keys(JSON.parse(backupJSON(routesForBackupNow()))._routes)`).includes('seg-' + seg.id));
  app.run('Store.ready=true'); assert.equal(await app.run('routesSweep()'), 0, 'the launch sweep keeps a stretch’s line');
  // a new run on the loop is timed when its route arrives
  const pts = T.makeRun({ legs: LOOP, speed: 4 }); app.set('window._b', Buffer.from(T.toTcx(pts)));
  await app.run(`(async()=>{const a={id:'new',type:'run',date:'${day(1)}',dist:'3.11',dur:'21'};const x=routeFromTrack(trackParse('tcx',new Uint8Array(_b)),'run',0);a.rt=x.sum;S.activities.push(a);await Routes.put('new',x.rec);await segRefreshAll(['new']);})()`);
  assert.equal(app.json(`segEfforts(S.segments[0])[0].a.id`), 'new'); near(app.json(`segEfforts(S.segments[0])[0].sec`), 325, 3);
  assert.match(app.run(`segOnActivityHTML(S.activities.find(a=>a.id==='slow'))`), /Top road[\s\S]*5th fastest of 5/);
  assert.match(app.run(`segOnActivityHTML(S.activities.find(a=>a.id==='new'))`), /Your fastest of 5/);
  assert.equal(app.run(`segOnActivityHTML(S.activities.find(a=>a.id==='reverse'))`), '');
  // deleting a run takes its time off the board; the stretch stays
  app.run(`S.activities=S.activities.filter(a=>a.id!=='quick');save()`);
  assert.deepEqual(app.json(`segEfforts(S.segments[0]).map(e=>e.a.id)`), ['new', 'laps', 'first', 'slow']);
  assert.equal(app.json(`normalizeState(JSON.parse(JSON.stringify(S))).segments[0].efforts.length`), 4, 'and it is cleaned out of the saved state');
  // a ruck stretch is for rucks
  const r = await aj(app, `segCreate('ruck',0,1200,'West side')`); assert.equal(r.kind, 'ruck'); assert.deepEqual(app.json(`segEfforts(S.segments[1]).map(e=>e.a.id)`), ['ruck']);
  // too short to mean anything
  assert.equal(await aj(app, `segCreate('first',100,180,'x')`), null);
  assert.deepEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th'], [1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(n => app.run(`ordinal(${n})`)));
});

test('stretches in a saved state are rebuilt field by field', () => {
  const app = fresh({ activities: [{ id: 'a1', type: 'run', date: day(1), dist: '3', dur: '25' }] });
  const n = v => app.json(`normalizeSegments(${JSON.stringify(v)},S.activities)`);
  assert.deepEqual(n('x'), []); assert.deepEqual(n([7, null, 'x']), []);
  const one = n([{ id: 'ab<c>"12', name: '<b>Hill</b>'.repeat(10), kind: 'boat', m: '1300.5', from: 'a1', made: 'x', lat: 27.9, p: 'AAAA', efforts: [{ a: 'a1', sec: '401.26' }, { a: 'gone', sec: 300 }, { a: 'a1', sec: -1 }, 'x'] }])[0];
  assert.deepEqual(Object.keys(one).sort(), ['efforts', 'from', 'id', 'kind', 'm', 'made', 'name'], 'nothing extra survives, least of all a position');
  assert.equal(one.id, 'abc12'); assert.equal(one.name.length, 40); assert.equal(one.kind, 'run'); assert.equal(one.m, 1300.5); assert.equal(one.made, 0);
  assert.deepEqual(one.efforts, [{ a: 'a1', sec: 401.3 }], 'efforts of activities that are gone, or without a time, are dropped');
  assert.equal(n(Array.from({ length: 50 }, (_, i) => ({ id: 's' + i, name: 'S' }))).length, 30);
  const html = app.run(`S.segments=normalizeSegments([{id:'s1',name:'<img src=x onerror=alert(1)>',m:800,efforts:[{a:'a1',sec:300}]}],S.activities);segSectionHTML()`);
  assert.ok(!html.includes('<img') && html.includes('&lt;img'), 'a stretch’s name is text');
});
