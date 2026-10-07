'use strict';
// The Progress board: the metric catalog (one definition per number), the charts the app draws
// itself, the board layout per goal and its editing.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const { demoState } = require('../../tools/demo-state.js');

const NOW = '2026-10-07T12:00:00'; // a Wednesday
const day = n => { const d = new Date(NOW); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const at = (n, h) => { const d = new Date(NOW); d.setDate(d.getDate() - n); d.setHours(h == null ? 17 : h, 0, 0, 0); return d.getTime(); };
const demo = over => { const app = loadApp({ now: NOW }); app.state(Object.assign(demoState(new Date(NOW).getTime()), over || {})); return app; };
const blank = over => { const app = loadApp({ now: NOW }); app.state(over || {}); return app; };
const html = app => app.run(`document.getElementById('content').innerHTML`);
const wk = (id, n, sets, name) => ({ id, name: name || 'W', started: at(n), ended: at(n) + 3e6, exercises: [{ exId: 'squat', sets }] });
const set = (w, r, o) => Object.assign({ w: String(w), r: String(r), done: true }, o || {});
const tile = (app, k, p) => app.json(`METRICS[${JSON.stringify(k)}].tile(boardRange(),${JSON.stringify(Object.assign({ k }, p || {}))})`);

// ─── The catalog ───
test('every metric is complete, and none of them throws on an empty or a full log', () => {
  for (const app of [blank(), demo()]) {
    const keys = app.json('Object.keys(METRICS)');
    assert.ok(keys.length >= 12);
    for (const k of keys) {
      const m = app.json(`({title:METRICS.${k}.title,group:METRICS.${k}.group,has:METRICS.${k}.has(),param:METRICS.${k}.param||null,wide:!!METRICS.${k}.wide})`);
      assert.ok(m.title && app.json('METRIC_GROUPS').includes(m.group) && typeof m.has === 'boolean', k);
      for (const r of ['4w', '12w', '6m', '1y']) {
        app.run(`S.board.range='${r}'`);
        const t = tile(app, k);
        assert.ok(t.empty || (m.wide ? Array.isArray(t.rows) && t.rows.length : t.value != null && t.unit != null && typeof t.sub === 'string'), `${k} tile over ${r}: ${JSON.stringify(t).slice(0, 120)}`);
        if (!app.run(`!!METRICS.${k}.open`)) assert.ok(app.run(`!!metricDetail(${JSON.stringify(k)},{k:${JSON.stringify(k)}},boardRange())`), `${k} detail over ${r}`);
      }
      app.run(`S.board.range='12w'`);
      if (m.param) assert.equal(typeof app.run(`METRICS.${k}.paramText({k:'${k}'})`), 'string');
    }
    for (const g of Object.keys(app.json('BOARD_DEFAULTS'))) for (const k of app.json('BOARD_DEFAULTS')[g]) assert.ok(keys.includes(k), `${g} default lists ${k}`);
  }
  // a lift's own sheet, and the detail of an unknown metric
  const app = demo();
  const d = app.json(`metricDetail('lift',{id:'squat'},boardRange())`);
  assert.deepEqual([d.title, d.value, d.unit], ['Barbell Back Squat', 345, ' lbs']);
  assert.equal(app.run(`metricDetail('nope',{},boardRange())`), null);
  assert.equal(app.run(`metricDetail('lift',{id:'never-done'},boardRange())`), null);
  assert.equal(app.requests().length, 0, 'nothing here calls the network');
});

// ─── Charts ───
test('charts are drawn on a time axis, with round gridlines and a tap area per point', () => {
  const app = blank();
  assert.deepEqual(app.json('niceTicks(288,352,3)'), [300, 320, 340]);
  assert.deepEqual(app.json('niceTicks(0,7,3)'), [0, 2, 4, 6]);
  assert.deepEqual(app.json('niceTicks(5,5,3)'), [5]);
  assert.equal(app.run(`dayFromNum(dayNum('2026-10-07'))`), '2026-10-07');
  // three points: a day apart, then three weeks apart. The gap shows as distance.
  const svg = app.run(`svgSpark([{t:0,v:10},{t:1,v:11},{t:22,v:12}],{w:141,h:36})`);
  const xs = svg.match(/points="([^"]+)"/)[1].split(' ').map(p => parseFloat(p.split(',')[0]));
  assert.ok(xs[1] - xs[0] < 8 && xs[2] - xs[1] > 120, `x positions ${xs}`);
  assert.ok(app.run(`svgSpark([],{})`).includes('sp-fit') && app.run(`svgSpark([{t:1,v:5}],{})`).includes('sp-dot'));
  // a pace: lower is better, so a faster run is drawn higher
  const up = app.run(`svgSpark([{t:0,v:540},{t:7,v:520}],{invert:true})`).match(/points="([^"]+)"/)[1].split(' ').map(p => parseFloat(p.split(',')[1]));
  assert.ok(up[1] < up[0], 'the later, faster point is higher on screen');
  // bars: the target line sits at 80% of the height, and a missing day is a stub, not a zero-height nothing
  const bars = app.run(`svgBars([{v:1},{v:null},{v:0.5,hollow:true}],{target:1,w:100,h:40})`);
  assert.match(bars, /class="sp-target"[^>]*y1="8"/); assert.match(bars, /class="sp-nil"/); assert.match(bars, /class="sp-hollow"/);
  // full charts
  const line = app.run(`chartLine([{t:100,v:300,read:'a'},{t:107,v:310,read:'b <i>'},{t:121,v:305,read:'c'}],{})`);
  assert.equal((line.match(/class="ch-hit"/g) || []).length, 3, 'one tap area per point');
  assert.ok(line.includes('b &lt;i&gt;') && !line.includes('b <i>'), 'the readout text is escaped');
  assert.match(app.run(`chartLine([{t:1,v:2}],{})`), /A second one draws the line/);
  assert.match(app.run(`chartLine([],{})`), /Nothing in this period yet/);
  assert.match(app.run(`chartBars([{t:1,v:0}],{})`), /Nothing in this period yet/);
  assert.equal((app.run(`chartBars([{t:1,v:3,read:'x'},{t:8,v:4,read:'y'}],{plan:4})`).match(/class="ch-hit"/g) || []).length, 2);
});

// ─── One weight trend ───
test('there is one weight trend: the same fit on the board, on Nutrition and in maintenance', () => {
  const app = demo();
  const f = app.json(`weightFit(daysAgoStr(28))`); const t = app.json('weightTrend()');
  assert.equal(t.perWeek, Math.round(f.perDay * 7 * 10) / 10); assert.equal(t.n, f.n); assert.equal(t.days, f.span);
  assert.ok(f.perWeek < -0.4 && f.perWeek > -0.8, `losing about half a pound a week (${f.perWeek})`);
  const w = tile(app, 'weight');
  assert.deepEqual([w.value, w.unit], ['189.1', ' lbs']);
  assert.match(w.sub, /^−0\.\d lbs a week$/); assert.equal(w.tone, 'good', 'the goal is to lose, so down is good');
  app.run(`S.weightGoalDir='gain';save()`); assert.equal(tile(app, 'weight').tone, 'warn');
  app.run(`S.weightGoalDir=null;save()`); assert.equal(tile(app, 'weight').tone, 'flat', 'no goal, no judgement');
  // two weigh-ins a day apart are not a trend
  const two = blank({ bodyweightLog: [{ date: day(0), weight: 190 }, { date: day(1), weight: 191 }], bodyweight: 190 });
  assert.equal(two.json(`weightFit(daysAgoStr(84))`), null); assert.equal(two.json('weightTrend()'), null);
  assert.equal(tile(two, 'weight').sub, 'Weigh in over a few days');
  assert.equal(tile(blank(), 'weight').empty, 'Weigh in to start a trend.');
});

// ─── Lifts ───
test('lifts: one per main movement by default, with the change over the range and a stall flag', () => {
  const app = demo();
  assert.deepEqual(app.json('defaultLiftIds()'), ['squat', 'hex-dl', 'bb-bench', 'ohp'], 'squat, hinge, press, overhead press: barbell first');
  const t = tile(app, 'lifts');
  assert.deepEqual(t.rows.map(r => [r.label, r.value, r.delta, r.tone]), [['Back Squat', '345', '+51', 'good'], ['Hex Bar Deadlift', '385', '+51', 'good'], ['Bench Press', '253', '+31', 'good'], ['Overhead Press', '146', '+16', 'good']]);
  assert.equal(t.foot.label, 'All 20 lifts');
  // four weeks is a shorter stretch of the same series
  app.run(`S.board.range='4w'`);
  assert.equal(tile(app, 'lifts').rows[0].delta, '+27');
  app.run(`S.board.range='12w'`);
  // chosen lifts, in the order chosen; ones with no history are dropped
  assert.deepEqual(tile(app, 'lifts', { ids: ['bb-row', 'never', 'squat'] }).rows.map(r => r.label), ['Row', 'Back Squat']);
  // two chosen lifts that would read the same keep their full names
  assert.deepEqual(app.json(`(()=>{S.custom.push({id:'c1',name:'Back Squat',cat:'Legs',eq:'Machine',muscle:'Quads'});S.workouts[0].exercises.push({exId:'c1',sets:[{w:'100',r:'5',done:true}]});save();return METRICS.lifts.tile(boardRange(),{k:'lifts',ids:['squat','c1']}).rows.map(r=>r.label);})()`), ['Barbell Back Squat', 'Back Squat']);
  // stalled: three sessions in a row within a pound
  const flat = blank({ workouts: [wk('a', 2, [set(200, 5)]), wk('b', 9, [set(200, 5)]), wk('c', 16, [set(200, 5)]), wk('d', 23, [set(180, 5)])] });
  const r = flat.json(`liftRow('squat',boardRange())`);
  assert.deepEqual([r.stalled, r.delta, r.inRange], [true, 23, 4]);
  assert.deepEqual([tile(flat, 'lifts').rows[0].delta, tile(flat, 'lifts').rows[0].tone], ['flat', 'warn']);
  // a lift not trained inside the range still shows where it stands
  const old = blank({ workouts: [wk('a', 200, [set(200, 5)])] });
  assert.deepEqual([tile(old, 'lifts').rows[0].value, tile(old, 'lifts').rows[0].delta], ['233', '–']);
  assert.match(old.json(`metricDetail('lift',{id:'squat'},boardRange())`).chart, /No sessions in the last 12 weeks/);
});
test('a new record is one that beat an earlier best inside the period', () => {
  const app = blank({ workouts: [wk('a', 3, [set(210, 5)]), wk('b', 30, [set(200, 5)]), { id: 'c', name: 'W', started: at(5), ended: at(5) + 3e6, exercises: [{ exId: 'bb-bench', sets: [set(150, 5)] }] }] });
  app.run('rebuildPRs()');
  const rows = app.json('recordRows()');
  assert.deepEqual(rows.map(r => [r.id, r.gain]), [['squat', 12], ['bb-bench', null]], 'newest first; a first-ever set has no gain');
  assert.deepEqual(app.json('newRecords(boardRange()).map(r=>r.id)'), ['squat']);
  const t = tile(app, 'records');
  assert.deepEqual([t.title, t.note, t.rows[0].label, t.rows[0].value, t.rows[0].valueSub], ['New records', '1 in the last 12 weeks', 'Back Squat', '210', ' × 5']); // the short name, as on the Lifts tile
  assert.deepEqual(app.json(`shortLiftNames(['Barbell Back Squat','Back Squat','Calf Raise'])`), ['Barbell Back Squat', 'Back Squat', 'Calf Raise']); // never two rows that read the same
  assert.match(t.rows[0].sub, /\+12 lbs on your best/);
  app.run(`S.board.range='4w';S.workouts[0].started-=40*86400000;S.workouts[1].started-=40*86400000;rebuildPRs();save()`);
  assert.equal(tile(app, 'records').note, 'none in the last 4 weeks');
});

// ─── Sessions ───
test('“this week” is Monday to Sunday everywhere, with the plan from the schedule', () => {
  const app = demo();
  const t = tile(app, 'sessions');
  assert.deepEqual([t.value, t.unit, t.sub], ['2', ' of 4 this week', 'Next: tomorrow'], 'Monday and Tuesday done, Thursday next');
  assert.equal(t.value, String(app.json(`weekDays().filter(d=>d.state==='done').length`)), 'the same count the home screen shows');
  assert.equal(app.json('plannedPerWeek()'), 4);
  const weeks = app.json('sessionWeeks(boardRange())');
  assert.equal(weeks[weeks.length - 1].mon, '2026-10-05'); assert.equal(weeks[weeks.length - 1].current, true);
  assert.ok(weeks.every(w => new Date(w.mon + 'T12:00:00').getDay() === 1), 'every week starts on a Monday');
  assert.deepEqual(weeks.slice(-4).map(w => w.n), [3, 4, 4, 2], 'one session missed three weeks ago');
  // the weeks before the first workout are not counted as zeros in the average
  const d = app.json(`metricDetail('sessions',{},boardRange())`);
  assert.equal(d.stats[1].v, '3.6'); assert.equal(d.stats[1].l, 'A week, on average');
  // no fixed days: no plan, no "next"
  const free = blank({ workouts: [wk('a', 1, [set(200, 5)])] });
  const f = tile(free, 'sessions');
  assert.deepEqual([f.value, f.unit], ['1', ' this week']); assert.equal(free.json('plannedPerWeek()'), null); assert.equal(free.json('nextSessionLabel()'), null);
});

// ─── Food ───
test('calories and protein: the last seven finished days against each day’s own target', () => {
  const app = demo();
  const c = tile(app, 'calories'), p = tile(app, 'protein');
  assert.deepEqual([c.title, c.value, c.unit, c.sub], ['Calories · 7 days', '2,057', ' a day', '290 under target']);
  assert.equal(c.tone, 'flat', 'under target while cutting is not a problem');
  assert.deepEqual([p.value, p.sub, p.tone], ['165', '20 g short of 185', 'warn']);
  assert.equal(app.json('foodDays(7).length'), 7); assert.ok(app.json('foodDays(7)').every(d => d.ds < day(0)), 'today is not in it');
  app.run(`S.weightGoalDir='gain';save()`); assert.equal(tile(app, 'calories').tone, 'warn', 'under target while gaining is');
  // days with nothing logged are left out, not averaged in as zero
  const some = blank({ macroGoals: { protein: 150, carbs: 200, fat: 60, cals: 2000 }, meals: [1, 3].map(n => ({ id: 'm' + n, date: day(n), type: 'Dinner', name: 'Dinner', protein: 150, carbs: 0, fat: 0, cals: 2000 })) });
  const s = tile(some, 'calories');
  assert.deepEqual([s.value, s.sub, s.tone], ['2,000', 'On target', 'good']);
  assert.equal(tile(blank(), 'calories').empty, 'Log food to see your average against target.');
});

// ─── Pace ───
test('pace compares like with like: the same activity at the same distance, never an estimate', () => {
  const acts = [
    { id: 'a1', date: day(11), type: 'run', dist: '3.1', dur: '28' }, { id: 'a2', date: day(1), type: 'run', dist: '3.12', dur: '27' },
    { id: 'a3', date: day(4), type: 'run', dist: '2', dur: '16' }, { id: 'a4', date: day(8), type: 'ruck', dist: '4', dur: '62' },
    { id: 'a5', date: day(2), type: 'run', dist: '3.1', dur: '20', durEst: true }, { id: 'a6', date: day(3), type: 'run', dist: '', dur: '30' }];
  const app = blank({ activities: acts });
  const opts = app.json('paceOptions()');
  assert.deepEqual(opts.map(o => [o.label, o.n]), [['Run · 3.1 mi', 2], ['Run · 2 mi', 1], ['Ruck · 4 mi', 1]], '3.1 and 3.12 are the same distance; the estimate and the one with no distance are out');
  const t = tile(app, 'runpace');
  assert.equal(t.title, 'Run pace · 3.1 mi'); assert.equal(t.value, '8:39'); assert.equal(t.unit, ' a mile');
  assert.match(t.sub, /^23 s faster than /); assert.equal(t.tone, 'good');
  const two = tile(app, 'runpace', { type: 'run', dist: 2 });
  assert.deepEqual([two.title, two.value, two.sub], ['Run pace · 2 mi', '8:00', 'One so far at this distance']);
  assert.equal(tile(app, 'runpace', { type: 'bike', dist: 10 }).title, 'Run pace · 3.1 mi', 'a distance that is gone falls back to the default');
  assert.equal(app.run('fmtPace(539.6)'), '9:00');
  assert.equal(tile(blank(), 'runpace').empty, 'Log a run with its distance and time.');
});
test('hard sets counts sets done, not once per muscle', () => {
  const app = blank({ workouts: [{ id: 'a', name: 'W', started: at(1), ended: at(1) + 3e6, exercises: [{ exId: 'bb-bench', sets: [set(135, 8, { warmup: true }), set(200, 5), set(200, 5), set(200, 5)] }] }] });
  const st = app.json('setsStatus()');
  assert.equal(st.total, 3, 'three working sets');
  assert.ok(Object.values(st.sbm).reduce((a, b) => a + b, 0) > 3, 'though they count toward more than one muscle');
  assert.deepEqual([tile(app, 'sets').value, tile(app, 'sets').unit], ['3', ' sets']);
});

// ─── The board ───
test('the board starts as the layout for the goal, leaves out what has no data, and becomes the user’s once edited', () => {
  const app = demo();
  assert.deepEqual(app.json('boardTiles().map(t=>t.k)'), ['lifts', 'weight', 'sessions', 'calories', 'protein', 'aft', 'runpace', 'records']);
  assert.equal(app.json('boardCustom()'), false);
  app.run(`S.goal='weightloss'`);
  assert.deepEqual(app.json('boardTiles().map(t=>t.k)').slice(0, 3), ['weight', 'calories', 'maintenance'], 'a different goal leads with different tiles');
  // a new user: the first three of the layout, as tiles that say what to do
  const fresh = blank({ goal: 'strength' });
  assert.deepEqual(fresh.json('boardTiles().map(t=>t.k)'), ['lifts', 'weight', 'sessions']);
  fresh.run(`go('progress')`);
  assert.ok(html(fresh).includes('tile-empty') && html(fresh).includes('Weigh in to start a trend.'));
  // editing
  app.run(`S.goal='strength';boardMove(0,2)`);
  assert.equal(app.json('boardCustom()'), true);
  assert.deepEqual(app.json('boardTiles().map(t=>t.k)').slice(0, 3), ['weight', 'sessions', 'lifts']);
  app.run(`boardRemove('aft');boardAdd('steps');boardAdd('steps');boardAdd('nope');boardMove(99,0);boardMove(0,99)`);
  assert.deepEqual(app.json('boardTiles().map(t=>t.k)'), ['sessions', 'lifts', 'calories', 'protein', 'runpace', 'records', 'steps', 'weight']);
  app.run(`S.goal='weightloss'`);
  assert.equal(app.json('boardTiles()[0].k'), 'sessions', 'an edited board no longer follows the goal');
  app.run(`boardTileParams('lifts',{ids:['squat','bb-bench']});boardTileParams('runpace',{type:'run',dist:2})`);
  assert.deepEqual(app.json(`boardTiles().filter(t=>t.k==='lifts'||t.k==='runpace')`), [{ k: 'lifts', ids: ['squat', 'bb-bench'] }, { k: 'runpace', type: 'run', dist: 2 }]);
  app.run(`toggleBoardLift('ohp');toggleBoardLift('squat')`);
  assert.deepEqual(app.json(`boardTiles().find(t=>t.k==='lifts').ids`), ['bb-bench', 'ohp']);
  app.run(`toggleBoardLift('ohp');toggleBoardLift('bb-bench')`);
  assert.deepEqual(app.json(`boardTiles().find(t=>t.k==='lifts').ids`), ['bb-bench'], 'the last lift cannot be removed');
  app.run(`boardSet(null)`);
  assert.equal(app.json('boardCustom()'), false, 'reset goes back to the goal layout');
  // range
  app.run(`setBoardRange('6m');setBoardRange('junk')`); assert.deepEqual(app.json('[boardRange().id,boardRange().days,boardRange().from]'), ['6m', 182, day(182)]);
});
test('saved boards are cleaned on the way in, and the old cards’ state is dropped', () => {
  const app = blank();
  const n = v => app.json(`normalizeBoard(${JSON.stringify(v)})`);
  assert.deepEqual(n(null), { range: '12w', tiles: null });
  assert.deepEqual(n({ range: 'forever', tiles: 'x' }), { range: '12w', tiles: null });
  assert.deepEqual(n({ range: '1y', tiles: [{ k: 'weight' }, { k: 'weight' }, { k: 'evil<script>' }, 7, { k: 'lifts', ids: ['squat', 5, 'x'.repeat(200)], extra: 1 }, { k: 'runpace', type: 'run', dist: '3.14' }, { k: 'runpace', type: 3 }] }),
    { range: '1y', tiles: [{ k: 'weight' }, { k: 'lifts', ids: ['squat', 'x'.repeat(80)] }, { k: 'runpace', type: 'run', dist: 3.1 }] });
  assert.equal(n({ tiles: Array.from({ length: 40 }, () => ({ k: 'weight' })) }).tiles.length, 1);
  assert.deepEqual(n({ tiles: [] }).tiles, [], 'an empty board is a choice, not a reset');
  const s = app.json(`normalizeState({_schema:3,expandedCards:{aft:true},progSeeded:{strength:true},progExId:'squat',board:{range:'4w'}})`);
  assert.ok(!('expandedCards' in s) && !('progSeeded' in s) && !('progExId' in s));
  assert.deepEqual(s.board, { range: '4w', tiles: null });
  // the same lift listed twice in a saved board is one row, not two
  const dup = blank({ board: { range: '4w', tiles: [{ k: 'lifts', ids: ['squat', 'squat', '', 5, null, 'bench', 'squat'] }] } });
  assert.deepEqual(dup.json('S.board.tiles[0].ids'), ['squat', 'bench']);
});
test('the board page: tiles from the catalog, names escaped, a lone small tile stretched, one bad metric contained', () => {
  const app = demo();
  app.run(`S.custom.push({id:'cx',name:'<img src=x onerror=alert(1)> Press',cat:'Chest',eq:'Barbell',muscle:'Chest'});S.workouts[0].exercises.push({exId:'cx',sets:[{w:'100',r:'5',done:true}]});boardSet([{k:'lifts',ids:['cx','squat']},{k:'weight'},{k:'sessions'},{k:'protein'},{k:'records'}]);go('progress')`);
  let h = html(app);
  assert.ok(h.includes('class="board"') && !h.includes('dash-card'));
  assert.ok(h.includes('&lt;img src=x onerror=alert(1)&gt; Press') && !h.includes('<img src=x'), 'a custom exercise name cannot inject markup');
  assert.equal((h.match(/id="tile-/g) || []).length, 5);
  assert.match(h, /class="tile tile-wide" id="tile-protein"/, 'protein is alone in its row, so it spans both columns');
  assert.ok(!/class="tile tile-wide" id="tile-weight"/.test(h));
  assert.ok(h.includes('id="board-range"') && h.includes('showBoardEdit()') && h.includes('<option value="12w" selected>12 weeks</option>'));
  // a metric that throws shows as a tile that says so; the rest of the board is untouched
  app.run(`METRICS.weight.tile=()=>{throw new Error('boom');};go('workout');go('progress')`);
  h = html(app);
  assert.ok(h.includes('This could not be worked out.') && h.includes('id="tile-sessions"') && h.includes('id="tile-records"'));
  // the sheets render
  app.run(`showMetric('lift',{id:'squat'});showMetric('sessions');showAllLifts();showBoardEdit();showLiftPicker();showPacePicker();openTile('maintenance');openAftCard()`);
  assert.equal(app.requests().length, 0);
});
