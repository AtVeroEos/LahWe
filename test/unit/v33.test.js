'use strict';
// 3.3: exercise swap from the database, next-session targets (rule + one small coach request),
// the weekly numbers behind the home screen, the test-date plan, the Spotify remote, and the new look.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-06-15T12:00:00'; // a Monday
const DAY = 86400000;
const ts = (daysAgo, h) => { const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(h == null ? 18 : h, 0, 0, 0); return d.getTime(); };
const ds = daysAgo => { const d = new Date(ts(daysAgo, 12)); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
// sets: [[weight, reps, tag?], …]
const lift = (exId, sets, extra) => Object.assign({ exId, sets: sets.map(s => ({ w: String(s[0]), r: String(s[1]), done: true, tag: s[2] || '' })) }, extra || {});
const wk = (id, daysAgo, exercises, rid) => ({ id, name: 'Session', routineId: rid || null, started: ts(daysAgo), ended: ts(daysAgo) + 50 * 60000, cals: 300, exercises });
const routine = (id, name, exs) => ({ id, name, notes: '', days: [], exercises: exs.map(e => Object.assign({ w: '', type: 'flat', rest: 120 }, e)) });
const names = list => list.map(c => c.ex.id);

// ─── Movement patterns ───
test('every built-in exercise has a movement pattern, and custom ones are guessed from the name', () => {
  const app = loadApp({ now: NOW });
  const missing = app.json(`EXERCISES.filter(e=>!EX_PATTERN[e.id]||!PATTERN_LABEL[EX_PATTERN[e.id]]).map(e=>e.id)`);
  assert.deepEqual(missing, []);
  assert.deepEqual(app.json(`Object.keys(EX_PATTERN).filter(id=>!BUILTIN_EX_IDS.has(id))`), [], 'no pattern for an exercise that does not exist');
  assert.deepEqual(app.json(`Object.keys(PATTERN_NEAR).concat(...Object.values(PATTERN_NEAR)).filter(p=>!PATTERN_LABEL[p])`), []);
  const guess = n => app.run(`exPattern({id:'custom-x',name:${JSON.stringify(n)}})`);
  assert.equal(guess('Seated Leg Curl'), 'knee-flex');
  assert.equal(guess('Machine Chest Press'), 'h-push');
  assert.equal(guess('Incline Smith Press'), 'incline-push');
  assert.equal(guess('Chest-Supported Row'), 'h-pull');
  assert.equal(guess('Neutral-Grip Pulldown'), 'v-pull');
  assert.equal(guess('Trap Bar Deadlift'), 'hinge');
  assert.equal(guess('EZ-Bar Curl'), 'curl');
  assert.equal(guess('Zercher Carry'), 'carry');
  assert.equal(guess('Something Unheard Of'), null, 'no guess is better than a wrong one');
});

// ─── Swap ───
test('substitutes train the same movement or muscle, respect equipment, and never repeat a lift already in the workout', () => {
  const app = loadApp({ now: NOW });
  const all = app.json(`swapCandidates('bb-bench').map(c=>({id:c.ex.id,m:c.match,mus:c.ex.muscle,pat:exPattern(c.ex)}))`);
  assert.ok(all.length >= 8);
  assert.ok(all.every(c => c.id !== 'bb-bench'));
  assert.ok(all.every(c => c.mus === 'Chest' || ['h-push', 'incline-push', 'dip'].includes(c.pat)), 'nothing unrelated: ' + JSON.stringify(all.filter(c => c.mus !== 'Chest' && !['h-push', 'incline-push', 'dip'].includes(c.pat))));
  assert.ok(!all.some(c => ['squat', 'bb-curl', 'plank', 'lat-pd'].includes(c.id)));
  assert.equal(all[0].m, 'same');
  assert.equal(all[0].id, 'db-bench', 'with no history, the loaded lift on different kit leads');
  assert.ok(names(app.json(`swapCandidates('bb-bench')`)).indexOf('pushup') > names(app.json(`swapCandidates('bb-bench')`)).indexOf('dec-bench'), 'a bodyweight version of a loaded lift ranks below loaded ones');
  assert.ok(!names(app.json(`swapCandidates('bb-bench',{exclude:['db-bench','inc-bench']})`)).some(id => id === 'db-bench' || id === 'inc-bench'));
  app.run(`S.equipPreset='dumbbells'`);
  const eq = app.json(`swapCandidates('bb-bench').map(c=>c.ex.eq)`);
  assert.ok(eq.length && eq.every(e => e === 'Dumbbell' || e === 'Bodyweight'), 'the equipment you set limits the list');
  assert.ok(app.json(`swapCandidates('bb-bench',{anyEq:true}).map(c=>c.ex.eq)`).includes('Barbell'), '"Any equipment" lifts the limit');
  // isolation stays isolation
  app.run(`S.equipPreset='full'`);
  const curl = app.json(`swapCandidates('db-curl',{limit:5}).map(c=>exPattern(c.ex))`);
  assert.ok(curl.every(p => p === 'curl'), 'a curl is replaced by a curl: ' + curl);
  assert.deepEqual(app.json(`swapCandidates('no-such-exercise')`), []);
});
test('the list learns: lifts you have trained and swaps you picked before come first; a painful lift sinks', () => {
  const app = loadApp({ now: NOW });
  app.state({ workouts: [3, 10, 17, 24].map((d, i) => wk('w' + i, d, [lift('inc-db-bench', [[60, 10], [60, 9]])])) });
  let top = app.json(`swapCandidates('bb-bench',{limit:3})`);
  assert.equal(top[0].ex.id, 'inc-db-bench', 'a close movement you train beats an exact one you have never done');
  assert.equal(top[0].usage.n, 4);
  assert.match(app.run(`swapWhy(swapCandidates('bb-bench')[0])`), /Close movement · done 4×, last 60 lbs × 10/);
  // picking a substitute is remembered
  app.state({ swapLog: { 'bb-bench': { 'chest-dip': 2 } } });
  top = app.json(`swapCandidates('bb-bench',{limit:3})`);
  assert.equal(top[0].ex.id, 'chest-dip');
  assert.match(app.run(`swapWhy(swapCandidates('bb-bench')[0])`), /your swap 2×/);
  // pain: flagged in 2 of the last 3 sessions
  app.state({ workouts: [3, 10, 17].map((d, i) => wk('p' + i, d, [lift('db-bench', [[70, 8, i < 2 ? 'Pain' : '']])])) });
  const order = names(app.json(`swapCandidates('bb-bench')`));
  assert.ok(order.indexOf('db-bench') > order.indexOf('dec-bench'), 'a lift that has been hurting is not offered first');
  assert.match(app.run(`swapWhy(swapCandidates('bb-bench').find(c=>c.ex.id==='db-bench'))`), /pain flagged/);
});
test('swapping before any set is done replaces the lift in place and carries the plan over', () => {
  const app = loadApp({ now: NOW });
  app.state({ routines: [routine('r1', 'Upper', [{ exId: 'bb-bench', sets: 4, r: '5', rMax: '7', rest: 180 }, { exId: 'bb-row', sets: 3, r: '8' }])],
    workouts: [wk('w1', 7, [lift('db-bench', [[70, 9], [70, 8]])])] });
  app.run(`startWorkout('r1')`);
  assert.equal(app.run(`doSwap(0,'db-bench')`), true);
  const ex = app.json('S.activeWorkout.exercises');
  assert.deepEqual(ex.map(e => e.exId), ['db-bench', 'bb-row']);
  assert.equal(ex[0].sets.length, 4, 'same number of sets');
  assert.deepEqual([ex[0].target.r, ex[0].target.rMax, ex[0].rest], ['5', '7', 180], 'rep range and rest carry over');
  assert.deepEqual(ex[0].sets.map(s => s.w), ['70', '70', '70', '70'], 'weights come from the substitute’s own history, not the bench');
  assert.equal(ex[0]._swappedFrom, 'bb-bench');
  assert.deepEqual(app.json('S.swapLog'), { 'bb-bench': { 'db-bench': 1 } });
  assert.equal(app.run(`doSwap(0,'bb-row')`), false, 'cannot swap to a lift already in the workout');
  assert.equal(app.run(`doSwap(0,'no-such')`), false);
  assert.equal(app.run(`doSwap(9,'pushup')`), false);
});
test('swapping after some sets keeps the finished sets under the original lift', () => {
  const app = loadApp({ now: NOW });
  app.state({ routines: [routine('r1', 'Upper', [{ exId: 'bb-bench', sets: 4, r: '5' }])] });
  app.run(`startWorkout('r1');const e=S.activeWorkout.exercises[0];e.sets[0].w='200';e.sets[0].r='5';e.sets[0].done=true;e.sets[1].w='200';e.sets[1].r='5';e.sets[1].done=true;`);
  assert.equal(app.run(`doSwap(0,'db-bench')`), true);
  const ex = app.json('S.activeWorkout.exercises');
  assert.deepEqual(ex.map(e => e.exId), ['bb-bench', 'db-bench']);
  assert.equal(ex[0].sets.length, 2); assert.ok(ex[0].sets.every(s => s.done), 'the two finished bench sets are still logged');
  assert.equal(ex[1].sets.length, 2, 'the substitute takes the two sets that were left');
  assert.equal(app.run('doneSetCnt(S.activeWorkout)'), 2);
});
test('a hold stays a hold only when both lifts are holds', () => {
  const app = loadApp({ now: NOW });
  app.state({ routines: [routine('r1', 'Core', [{ exId: 'plank', sets: 3, r: '60', timed: true }])] });
  app.run(`startWorkout('r1')`);
  app.run(`doSwap(0,'dead-bug')`);
  let e = app.json('S.activeWorkout.exercises[0]');
  assert.equal(e.timed, false); assert.equal(e.target.r, '', '60 seconds does not become 60 reps');
  app.run(`S.activeWorkout=null;startWorkout('r1');doSwap(0,'hollow-hold')`);
  e = app.json('S.activeWorkout.exercises[0]');
  assert.equal(e.timed, true); assert.equal(e.target.r, '60');
});
test('saving a swap to the routine replaces the entry in place instead of adding a second lift', () => {
  const app = loadApp({ now: NOW });
  app.state({ routines: [routine('r1', 'Upper', [{ exId: 'bb-bench', sets: 4, r: '5', rMax: '7', rest: 180, link: 'A' }, { exId: 'bb-row', sets: 3, r: '8', link: 'A' }])] });
  app.run(`startWorkout('r1');doSwap(0,'db-bench')`);
  const diff = app.json('getRoutineDiff(S.activeWorkout)');
  assert.deepEqual(diff.swapped, ['Barbell Bench Press → Dumbbell Bench Press']);
  assert.deepEqual(diff.added, [], 'a swap is not reported as an added exercise');
  app.run(`S.activeWorkout.exercises[0].sets.forEach(s=>{s.w='70';s.r='6';s.done=true});saveRoutineChanges('r1')`);
  const r = app.json('S.routines[0].exercises');
  assert.deepEqual(r.map(e => e.exId), ['db-bench', 'bb-row'], 'same position, no leftover bench');
  assert.deepEqual([r[0].r, r[0].rMax, r[0].rest, r[0].link, r[0].sets], ['5', '7', 180, 'A', 4]);
  assert.equal(r[0].w, '70');
  // swapping and then swapping back leaves nothing to save
  app.run(`S.activeWorkout=null;startWorkout('r1');doSwap(0,'pushup')`);
  assert.equal(app.json('sessionSwaps(S.activeWorkout)').length, 1);
});
test('swap data is session-only bookkeeping in history, and the swap log survives bad input', () => {
  const app = loadApp({ now: NOW });
  app.state({ routines: [routine('r1', 'Upper', [{ exId: 'bb-bench', sets: 2, r: '5' }])] });
  app.run(`startWorkout('r1');doSwap(0,'db-bench');S.activeWorkout.exercises[0].sets.forEach(s=>{s.w='70';s.r='5';s.done=true});saveWorkout()`);
  const saved = app.json('S.workouts[0]');
  assert.ok(!('_swaps' in saved) && !('_origExIds' in saved));
  assert.deepEqual(app.json(`normalizeSwapLog({a:{b:'3',c:-1,d:'x'},e:'nope',f:{}})`), { a: { b: 3 } });
  assert.deepEqual(app.json(`normalizeState({swapLog:[1,2]}).swapLog`), {});
});

// ─── Targets: the built-in rule ───
function ruleFor(app, sessions, re) {
  app.state({ routines: [routine('r1', 'R', [Object.assign({ exId: 'bb-bench', sets: 3 }, re)])], workouts: sessions.map((s, i) => wk('w' + i, 7 * (i + 1), [lift('bb-bench', s)], 'r1')) });
  return app.json(`ruleTarget('bb-bench',S.routines[0].exercises[0],'r1')`);
}
test('rule: inside a rep range you add reps first, and weight only once every set reaches the top', () => {
  const app = loadApp({ now: NOW });
  let t = ruleFor(app, [[[200, 7], [200, 6], [200, 5]]], { r: '5', rMax: '7' });
  assert.deepEqual([t.w, t.r, t.kind], [200, 6, 'reps']); assert.match(t.why, /until every set reaches 7.*lowest was 5/);
  t = ruleFor(app, [[[200, 7], [200, 7], [200, 7]]], { r: '5', rMax: '7' });
  assert.deepEqual([t.w, t.r, t.kind], [205, 5, 'up'], 'top of the range everywhere: one step up, back to the bottom of the range');
  assert.deepEqual(t.from, { w: 200, r: '7' });
});
test('rule: fixed reps go up when hit, repeat when missed or tagged hard', () => {
  const app = loadApp({ now: NOW });
  let t = ruleFor(app, [[[200, 5], [200, 5], [200, 5]]], { r: '5' });
  assert.deepEqual([t.w, t.r, t.kind], [205, 5, 'up']);
  t = ruleFor(app, [[[200, 5], [200, 5], [200, 4]]], { r: '5' });
  assert.deepEqual([t.w, t.r, t.kind], [200, 5, 'hold']); assert.match(t.why, /missed reps/);
  t = ruleFor(app, [[[200, 5, 'Hard'], [200, 5, 'Hard'], [200, 5]]], { r: '5' });
  assert.deepEqual([t.w, t.kind], [200, 'hold'], 'hit it, but it was hard: no jump yet');
});
test('rule: pain and stalls back off about 10%; steps follow the equipment', () => {
  const app = loadApp({ now: NOW });
  let t = ruleFor(app, [[[200, 5], [200, 5, 'Pain']]], { r: '5' });
  assert.deepEqual([t.w, t.kind], [180, 'down']); assert.match(t.why, /Pain/);
  // three sessions at the same weight, no more reps than three sessions ago, still short of the plan
  t = ruleFor(app, [[[200, 4], [200, 4]], [[200, 4], [200, 4]], [[200, 4], [200, 4]]], { r: '5' });
  assert.deepEqual([t.w, t.r, t.kind], [180, 5, 'down']); assert.match(t.why, /Three sessions/);
  // still improving at the same weight is not a stall
  t = ruleFor(app, [[[200, 4], [200, 4]], [[200, 4], [200, 3]], [[200, 3], [200, 3]]], { r: '5' });
  assert.equal(t.kind, 'hold');
  // dumbbells move in 2.5s below 100
  app.state({ routines: [routine('r1', 'R', [{ exId: 'db-curl', sets: 2, r: '10', rMax: '12' }])], workouts: [wk('w', 7, [lift('db-curl', [[30, 12], [30, 12]])], 'r1')] });
  assert.equal(app.json(`ruleTarget('db-curl',S.routines[0].exercises[0],'r1')`).w, 32.5);
  app.run(`S.unit='kg'`);
  assert.equal(app.json(`ruleTarget('db-curl',S.routines[0].exercises[0],'r1')`).w, 31, 'kilograms use their own step');
});
test('rule: bodyweight, timed and unplanned lifts each get a sensible aim; no history means no aim', () => {
  const app = loadApp({ now: NOW });
  const one = (exId, sets, re) => { app.state({ routines: [routine('r1', 'R', [Object.assign({ exId, sets: sets.length }, re)])], workouts: [wk('w', 7, [lift(exId, sets, re && re.timed ? { timed: true } : {})], 'r1')] }); return app.json(`ruleTarget(${JSON.stringify(exId)},S.routines[0].exercises[0],'r1')`); };
  let t = one('pullup', [['', 8], ['', 7], ['', 6]], { r: '6', rMax: '10' });
  assert.deepEqual([t.w, t.r, t.kind], [0, 7, 'reps']);
  t = one('pullup', [['', 10], ['', 10]], { r: '6', rMax: '10' });
  assert.equal(t.kind, 'hold'); assert.match(t.why, /add load or move to a harder variation/);
  t = one('plank', [['', 60], ['', 60]], { r: '60', timed: true });
  assert.deepEqual([t.w, t.r, t.kind], [0, 65, 'up']);
  t = one('plank', [['', 60], ['', 45]], { r: '60', timed: true });
  assert.deepEqual([t.r, t.kind], [60, 'hold']);
  // a lift added on the fly: no plan
  app.state({ workouts: [wk('w', 7, [lift('bb-row', [[150, 8], [150, 7]])])] });
  t = app.json(`ruleTarget('bb-row',null,null)`);
  assert.deepEqual([t.w, t.r], [150, 8]);
  assert.equal(app.json(`ruleTarget('squat',null,null)`), null, 'never done: nothing is invented');
  assert.equal(app.json(`ruleTarget('nope',null,null)`), null);
  assert.equal(app.run(`fmtAim({w:205,r:5},false)`), '205 lbs × 5');
  assert.equal(app.run(`fmtAim({w:0,r:9},false)`), '9 reps');
  assert.equal(app.run(`fmtAim({w:0,r:65},true)`), '65s');
});
test('a workout shows the aim on each lift, tapping it fills the unfinished sets, and history keeps only the numbers', () => {
  const app = loadApp({ now: NOW });
  app.state({ routines: [routine('r1', 'R', [{ exId: 'bb-bench', sets: 3, r: '5' }, { exId: 'squat', sets: 3, r: '5' }])], workouts: [wk('w', 7, [lift('bb-bench', [[200, 5], [200, 5], [200, 5]])], 'r1')] });
  app.run(`startWorkout('r1')`);
  let ex = app.json('S.activeWorkout.exercises');
  assert.deepEqual([ex[0].aim.w, ex[0].aim.r, ex[0].aim.by], [205, 5, 'rule']);
  assert.equal(ex[1].aim, undefined, 'no history, no aim');
  assert.deepEqual(ex[0].sets.map(s => s.w), ['200', '200', '200'], 'sets still start at what you did last time');
  app.run(`S.activeWorkout.exercises[0].sets[0].done=true;applyAim(0)`);
  ex = app.json('S.activeWorkout.exercises');
  assert.deepEqual(ex[0].sets.map(s => s.w), ['200', '205', '205'], 'a finished set is never rewritten');
  app.run(`S.activeWorkout.exercises[0].sets.forEach(s=>s.done=true);saveWorkout()`);
  assert.deepEqual(app.json('S.workouts[0].exercises[0].aim'), { w: 205, r: 5, by: 'rule' });
  assert.ok(app.run('S.tab') === 'workout' && app.run(`document.getElementById('content').innerHTML`).length >= 0);
});

// ─── Targets: the coach request ───
const KEY = 'sk-' + 'ant-' + 'api03-' + 'q'.repeat(40);
function targetApp() {
  const app = loadApp({ now: NOW });
  app.state({ name: 'Private Name', coachNotes: [{ id: 'n1', text: 'secret note about my knee', at: 1 }],
    routines: [routine('r1', 'Upper', [{ exId: 'bb-bench', sets: 3, r: '5', rMax: '7' }, { exId: 'bb-row', sets: 3, r: '8' }, { exId: 'pullup', sets: 3, r: '6', rMax: '10' }, { exId: 'tri-pd', sets: 3, r: '10' }]),
      routine('r2', 'Lower', [{ exId: 'squat', sets: 3, r: '5' }])],
    workouts: [1, 8, 15, 22, 29].map((d, i) => wk('w' + i, d, [lift('bb-bench', [[200, 7], [200, 6], [200, 5]]), lift('bb-row', [[150, 8], [150, 8], [150, 8]]), lift('pullup', [['', 8], ['', 7], ['', 6]])], 'r1'))
      .concat([wk('leg', 2, [lift('squat', [[315, 5], [315, 5], [315, 5]])], 'r2')]),
    meals: [{ id: 'm1', date: ds(1), type: 'Lunch', name: 'Lunch', protein: 50, carbs: 60, fat: 20, cals: 620 }] });
  app.run(`setAiKey('anthropic',${JSON.stringify(KEY)});S.ai.provider='anthropic';S.ai.models.anthropic='claude-haiku-4-5'`);
  return app;
}
const reply = obj => ({ body: { id: 'msg', type: 'message', role: 'assistant', model: 'claude-haiku-4-5', content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }], stop_reason: 'end_turn', usage: { input_tokens: 640, output_tokens: 120 } } });
test('the coach is never asked for targets unless you tap; one small request with no tools, no chat and only that routine', async () => {
  const app = targetApp();
  const reqs = app.mockFetch(() => reply({ targets: [], note: '' }));
  app.run(`render();showTargets('r1');renderTargets();startWorkout('r1');render();S.activeWorkout=null;go('workout')`);
  assert.equal(reqs.length, 0, 'showing targets and starting a workout costs nothing');
  app.mockFetch(() => reply({ targets: [{ id: 'bb-bench', weight: 200, reps: 6, why: 'One more rep on the weak sets.' }, { id: 'bb-row', weight: 155, reps: 8, why: 'All sets hit 8.' }, { id: 'pullup', weight: 0, reps: 7, why: 'Add a rep.' }], note: 'Steady week.' }));
  await app.run(`askCoachTargets('r1')`);
  const sent = app.requests();
  assert.equal(sent.length, 1, 'exactly one request');
  const b = sent[0].body;
  assert.match(sent[0].url, /^https:\/\/api\.anthropic\.com\/v1\/messages$/);
  assert.equal(b.tools, undefined, 'no tools: none of the 26 coach tool descriptions are sent');
  assert.equal(b.messages.length, 1, 'no chat history');
  const text = b.messages[0].content.map(c => c.text).join('\n'); const sys = b.system.map(s => s.text).join('\n');
  assert.ok((sys + text).length < 4200, 'small: ' + (sys + text).length + ' characters is about ' + Math.round((sys + text).length / 3.6) + ' tokens');
  assert.ok(app.run(`targetTokenEstimate('r1')`) < 1400);
  for (const id of ['bb-bench', 'bb-row', 'pullup']) assert.ok(text.includes(id));
  assert.ok(!text.includes('squat') && !text.includes('315'), 'another routine’s lifts are not sent');
  assert.ok(!text.includes('tri-pd'), 'a lift with no history is left out rather than guessed');
  assert.ok(!/Private Name|secret note|Lunch|620/.test(sys + text), 'no name, notes or food');
  assert.equal((text.match(/^\s+\d{4}-\d{2}-\d{2}:/gm) || []).length, 9, 'three sessions for each of three lifts, not the whole history');
  assert.ok(!JSON.stringify(b).includes(KEY), 'the key travels in a header, never in the body');
  // result
  const t = app.json(`S.nextTargets.r1`);
  assert.deepEqual(t.items['bb-row'], { w: 155, r: 8, why: 'All sets hit 8.' });
  assert.deepEqual(t.tokens, { in: 640, out: 120 });
  assert.equal(app.json(`aimFor('bb-bench','r1',S.routines[0].exercises[0])`).by, 'coach');
  assert.equal(app.json(`aimFor('tri-pd','r1',S.routines[0].exercises[3])`), null);
  assert.ok(!app.run('backupJSON()').includes(KEY));
});
test('coach numbers are checked: too heavy is pulled back, out-of-range reps are clamped, junk is dropped', async () => {
  const app = targetApp();
  app.mockFetch(() => reply({ targets: [
    { id: 'bb-bench', weight: 260, reps: 12, why: 'x'.repeat(400) },       // +60 lb and outside 5–7
    { id: 'bb-row', weight: 20, reps: 8, why: 'way too light' },            // under half of last time: dropped
    { id: 'pullup', weight: 45, reps: 9, why: 'bodyweight lift' },          // no loaded history: weight ignored
    { id: 'squat', weight: 400, reps: 5, why: 'not in this routine' },
    { id: 'bb-bench', weight: 100, reps: 5, why: 'duplicate' }, 'garbage', null, { id: 'tri-pd', weight: 50, reps: 10 },
  ], note: 'n'.repeat(900) }));
  await app.run(`askCoachTargets('r1')`);
  const t = app.json('S.nextTargets.r1');
  assert.deepEqual([t.items['bb-bench'].w, t.items['bb-bench'].r], [210, 7], 'capped at one step or 5% above the last session, and inside the rep range');
  assert.equal(t.items['bb-bench'].why.length, 120);
  assert.equal(t.items['bb-row'], undefined);
  assert.deepEqual([t.items.pullup.w, t.items.pullup.r], [0, 9]);
  assert.deepEqual(Object.keys(t.items).sort(), ['bb-bench', 'pullup']);
  assert.equal(t.capped, 2); assert.equal(t.note.length, 200);
  assert.equal(app.json(`aimFor('bb-row','r1',S.routines[0].exercises[1])`).by, 'rule', 'a dropped number falls back to the built-in rule');
  // a reply that is not JSON changes nothing
  app.run(`delete S.nextTargets.r1`);
  app.mockFetch(() => reply('Sure! Here are some thoughts about your training.'));
  await app.run(`askCoachTargets('r1')`);
  assert.equal(app.run('S.nextTargets.r1'), undefined);
  assert.match(app.run('_tg.error'), /expected form/);
  // model text is shown escaped
  app.mockFetch(() => reply({ targets: [{ id: 'bb-bench', weight: 200, reps: 6, why: '<img src=x onerror=alert(1)>' }], note: '<b>hi</b>' }));
  await app.run(`askCoachTargets('r1')`);
  assert.equal(app.run(`normalizeNextTargets(S.nextTargets,S.routines).r1.items['bb-bench'].why`), '<img src=x onerror=alert(1)>');
});
test('coach targets respect the log-access switch, clear once used, and are dropped with their routine', async () => {
  const app = targetApp();
  const reqs = app.mockFetch(() => reply({ targets: [{ id: 'bb-bench', weight: 200, reps: 6, why: 'ok' }], note: '' }));
  app.run(`S.ai.logAccess=false`);
  await app.run(`askCoachTargets('r1')`);
  assert.equal(reqs.length, 0, 'log access off: nothing is sent');
  app.run(`S.ai.logAccess=true;clearAllAiKeys()`);
  await app.run(`askCoachTargets('r1')`);
  assert.equal(reqs.length, 0, 'no key: nothing is sent');
  app.run(`setAiKey('anthropic',${JSON.stringify(KEY)})`);
  await app.run(`askCoachTargets('r1')`);
  assert.equal(app.requests().length, 1);
  app.run(`startWorkout('r1')`);
  assert.equal(app.json('S.activeWorkout.exercises[0].aim.by'), 'coach');
  app.run(`S.activeWorkout.exercises.forEach(e=>e.sets.forEach(s=>{s.w=s.w||'100';s.r=s.r||'5';s.done=true}));saveWorkout()`);
  assert.equal(app.run('S.nextTargets.r1'), undefined, 'used once, then gone');
  assert.deepEqual(app.json(`normalizeNextTargets({gone:{items:{a:{w:1,r:5}}},r1:{items:{x:{w:-5,r:5},y:{w:50,r:0},z:{w:50,r:8,why:7}}},r2:'no'},S.routines)`),
    { r1: { at: 0, model: '', items: { z: { w: 50, r: 8, why: '7' } }, note: '', capped: 0, tokens: { in: 0, out: 0 } } });
});

// ─── The week ───
function weekApp() {
  const app = loadApp({ now: NOW }); // Monday 15 June 2026
  const rs = [routine('ra', 'A', [{ exId: 'bb-bench', sets: 3, r: '5' }]), routine('rb', 'B', [{ exId: 'squat', sets: 3, r: '5' }])];
  const bench = (w, r) => lift('bb-bench', [[w, r], [w, r], [w, r]]);
  app.state({ goal: 'strength', routines: rs, groups: [{ id: 'g', name: 'G', mode: 'daypicker', routineIds: ['ra', 'rb'], dayMap: { ra: [1, 4], rb: [2, 5] }, active: true, cursor: 0 }],
    // last 7 full days: Mon 8, Tue 9, Thu 11 (Fri 12 missed); the 7 before: Mon 1, Tue 2, Thu 4, Fri 5; plus one a month back
    workouts: [wk('a', 4, [bench(205, 5)], 'ra'), wk('b', 6, [lift('squat', [[300, 5], [300, 5], [300, 5]])], 'rb'), wk('c', 7, [bench(200, 5)], 'ra'),
      wk('d', 10, [lift('squat', [[295, 5], [295, 5]])], 'rb'), wk('e', 11, [bench(200, 5)], 'ra'), wk('f', 13, [lift('squat', [[295, 5], [295, 5]])], 'rb'), wk('g', 14, [bench(195, 5)], 'ra'), wk('h', 35, [bench(185, 5)], 'ra')],
    macroGoals: { protein: 180, carbs: 250, fat: 70, cals: 2400 },
    meals: [1, 2, 3].map(d => ({ id: 'm' + d, date: ds(d), type: 'Lunch', name: 'Lunch', protein: 150, carbs: 200, fat: 60, cals: 2000 })).concat([{ id: 'today', date: ds(0), type: 'Breakfast', name: 'Breakfast', protein: 30, carbs: 40, fat: 10, cals: 370 }]),
    bodyweightLog: [{ date: ds(1), weight: 189 }, { date: ds(4), weight: 189.4 }, { date: ds(9), weight: 190.2 }, { date: ds(12), weight: 190.4 }], weightGoalDir: 'lose' });
  return app;
}
test('the week runs Monday to Sunday and shows what was planned against what happened', () => {
  const app = weekApp();
  assert.equal(app.run(`mondayOf('2026-06-15')`), '2026-06-15');
  assert.equal(app.run(`mondayOf('2026-06-21')`), '2026-06-15', 'Sunday belongs to the week that started on Monday');
  assert.equal(app.run(`mondayOf('2026-06-22')`), '2026-06-22');
  assert.deepEqual(app.json(`weekDays().map(d=>d.state)`), ['due', 'planned', 'off', 'planned', 'planned', 'off', 'off']);
  app.setNow('2026-06-18T09:00:00'); // Thursday: Monday trained? no. Tuesday? no.
  assert.deepEqual(app.json(`weekDays().map(d=>d.state)`), ['missed', 'missed', 'off', 'due', 'planned', 'off', 'off']);
  app.run(`S.workouts.unshift(${JSON.stringify(wk('new', 0, [lift('bb-bench', [[205, 5]])], 'ra')).replace(/"started":\d+/, '"started":Date.now()')});S.activities.push({id:'x',date:'2026-06-17',type:'run',dur:'20'});bumpMemo()`);
  assert.deepEqual(app.json(`weekDays().map(d=>d.state)`), ['missed', 'missed', 'active', 'done', 'planned', 'off', 'off']);
  const rv = app.json('weekReview()');
  assert.equal(rv.headline, '1 of 4 planned sessions done, 1 to go');
  // no fixed days: nothing is called "missed"
  app.run(`S.groups[0].mode='rotation';bumpMemo()`);
  assert.ok(!app.json(`weekDays().map(d=>d.state)`).includes('missed'));
});
test('trends compare the last seven full days with the seven before; today is left out until it is over', () => {
  const app = weekApp();
  const rv = app.json('weekReview()');
  assert.deepEqual([rv.cur.sessions, rv.prev.sessions], [3, 4]);
  assert.deepEqual([rv.cur.sets, rv.prev.sets], [9, 10]);
  assert.equal(rv.cur.vol, 205 * 15 + 300 * 15 + 200 * 15);
  assert.equal(rv.food.protein, 150, 'today’s half-eaten day is not averaged in');
  assert.equal(rv.food.foodDays, 3);
  assert.deepEqual(app.json(`fmtDelta(9,10)`), { txt: '−10%', dir: 'down', pct: -10 });
  assert.equal(app.json(`fmtDelta(10,10)`).txt, 'no change');
  assert.equal(app.json(`fmtDelta(5,0)`), null); assert.equal(app.json(`fmtDelta(null,3)`), null);
  // training today does not move last week's numbers
  app.run(`S.workouts.unshift(${JSON.stringify(wk('today', 0, [lift('bb-bench', [[205, 5], [205, 5]])], 'ra'))});bumpMemo()`);
  const rv2 = app.json('weekReview()');
  assert.equal(rv2.cur.sets, 9); assert.equal(rv2.done, 1, 'but it counts at once toward this week’s plan');
});
test('the check-in names what stands out: muscles under the weekly minimum, protein against target, lifts and weight', () => {
  const app = weekApp();
  const rv = app.json('weekReview()');
  const titles = rv.points.map(p => p.title);
  assert.ok(titles.some(t => /^Protein averaged 150 g of 180 g$/.test(t)), titles.join(' | '));
  assert.ok(titles.some(t => /^Weight down 1\.\d lbs a week$/.test(t)), titles.join(' | '));
  assert.ok(titles.some(t => /Barbell Bench Press up \d+%/.test(t)), titles.join(' | '));
  const chest = rv.muscles.find(m => m.m === 'Chest'); const quads = rv.muscles.find(m => m.m === 'Quads');
  assert.equal(chest.sets, 6); assert.equal(quads.sets, 3);
  assert.equal(chest.lo, Math.round(8 * 0.7), 'the weekly minimum is scaled for a strength goal');
  assert.ok(titles.some(t => /Below the weekly minimum: .*Quads/.test(t)), titles.join(' | '));
  assert.ok(!rv.muscles.some(m => m.m === 'Forearms' && m.sets === 0 && !m.inPlan), 'muscles you neither train nor plan are not listed');
  const b = rv.lifts.find(l => l.exId === 'bb-bench');
  assert.ok(b.now > b.then && b.pct > 0 && b.weeks >= 3, 'now against about four weeks ago');
});
test('the home numbers follow the goal, and the home screen and check-in draw without a network call', () => {
  const app = weekApp();
  const reqs = app.mockFetch(() => ({ body: {} }));
  const lbls = () => app.json(`homeStats(weekReview()).map(s=>s.lbl)`);
  assert.deepEqual(lbls(), ['Sets', 'Volume (lbs)', 'Protein/day', 'Weight (lbs)']);
  const st = app.json(`homeStats(weekReview())`);
  assert.equal(st[0].delta, '−10%'); assert.equal(st[2].delta, '83% of goal'); assert.equal(st[2].tone, 'warn'); assert.equal(st[3].tone, 'good', 'losing weight is good when that is the goal');
  app.run(`S.goal='recomp'`); assert.deepEqual(lbls(), ['Sets', 'Protein/day', 'Calories/day', 'Weight (lbs)']);
  app.run(`S.goal='weightloss'`); assert.deepEqual(lbls(), ['Net kcal today', 'Steps today', 'Calories/day', 'Weight (lbs)']);
  app.run(`S.goal='strength';go('workout')`);
  const html = app.run(`document.getElementById('content').innerHTML`);
  for (const bit of ['This week', 'wk-days', 'Start A', 'Targets', 'Weigh in', 'home-coach']) assert.ok(html.includes(bit), bit + ' is on the home screen');
  assert.ok(html.includes('205 lbs × 5') || html.includes('210 lbs × 5'), 'the next aims are on the home card');
  app.run(`showWeekReview();showTargets('ra');showWeighIn()`);
  assert.equal(reqs.length, 0);
  // an empty app draws too
  const blank = loadApp({ now: NOW });
  blank.run(`go('workout');showWeekReview()`);
  assert.ok(blank.run(`document.getElementById('content').innerHTML`).includes('No workout yet'));
  assert.equal(blank.json('weekReview()').headline, 'No sessions in the last 7 days');
});
test('a quick weigh-in is saved and becomes the current weight', () => {
  const app = weekApp();
  app.run(`logBodyweight(188.2);save()`);
  assert.equal(app.run('S.bodyweight'), 188.2);
  assert.equal(app.json('S.bodyweightLog[0]').date, ds(0));
});

// ─── Test-date plan ───
test('phases always fill the weeks exactly and end in a one-week taper', () => {
  const app = loadApp({ now: NOW });
  for (let w = 1; w <= 53; w++) {
    const p = app.json(`testPhases(${w})`);
    assert.equal(p.reduce((t, x) => t + x.weeks, 0), w, w + ' weeks');
    assert.deepEqual(p[p.length - 1], { id: 'taper', label: 'Taper', weeks: 1, from: w, to: w });
    assert.equal(p[0].from, 1); p.forEach((x, i) => { if (i) assert.equal(x.from, p[i - 1].to + 1); assert.ok(x.weeks >= 1); });
  }
  assert.deepEqual(app.json(`testPhases(8).map(p=>[p.id,p.weeks])`), [['base', 2], ['build', 3], ['peak', 2], ['taper', 1]]);
  assert.deepEqual(app.json(`testPhases(2).map(p=>p.id)`), ['peak', 'taper']);
});
function planApp() {
  const app = loadApp({ now: NOW });
  app.state({ birthYear: 1997, aftGender: 'male', aftCurrent: { MDL: '270', HRP: '30', SDC: '120', PLK: '140', '2MR': '960' }, aftGoals: { MDL: '340', HRP: '44', SDC: '99', PLK: '210', '2MR': '876' } });
  return app;
}
test('a test date becomes weekly checkpoints that close the gap before the taper, in the right direction for timed events', () => {
  const app = planApp();
  assert.equal(app.run(`setTestDate('${ds(-56)}')`), true); // eight weeks out
  let pc = app.json('testPlanCalc()');
  assert.deepEqual([pc.days, pc.weeks, pc.week, pc.phase.id], [56, 8, 1, 'base']);
  const aim = id => pc.events.find(e => e.id === id).aim;
  assert.equal(aim('MDL'), 280, 'one seventh of the way from 270 to 340, to the nearest 10');
  assert.equal(aim('HRP'), 32);
  assert.equal(aim('SDC'), 117, 'a time comes down');
  assert.equal(aim('2MR'), 948);
  assert.equal(aim('PLK'), 150, 'a hold goes up');
  assert.ok(pc.events.every(e => e.status === 'on'));
  // the last working week reaches the goal; the taper holds it
  for (const [daysOut, week, phase] of [[14, 7, 'peak'], [7, 8, 'taper'], [1, 8, 'taper']]) {
    app.setNow(new Date(new Date(NOW).getTime() + (56 - daysOut) * DAY));
    pc = app.json('testPlanCalc()');
    assert.deepEqual([pc.days, pc.week, pc.phase.id], [daysOut, week, phase]);
    assert.deepEqual(pc.events.map(e => e.aim), [340, 44, 99, 210, 876], daysOut + ' days out');
  }
  app.setNow(new Date(new Date(NOW).getTime() + 28 * DAY)); // four weeks in, scores never updated
  pc = app.json('testPlanCalc()');
  assert.equal(pc.week, 5); assert.equal(pc.retested, false);
  assert.ok(pc.events.every(e => e.status === 'untested'), 'with no retest there is nothing to judge');
  app.run(`S.aftCurrent.MDL='320';S.aftCurrent['2MR']='950';S.aftCurrent.HRP='50'`);
  pc = app.json('testPlanCalc()');
  const st = id => pc.events.find(e => e.id === id).status;
  assert.equal(st('MDL'), 'on'); assert.equal(st('2MR'), 'behind', 'a slower run than the checkpoint is behind'); assert.equal(st('HRP'), 'met');
  // test day and after
  app.setNow(new Date(new Date(NOW).getTime() + 56 * DAY)); assert.deepEqual([app.json('testPlanCalc()').days, app.run('testCountdown(testPlanCalc()).big')], [0, 'Today']);
  app.setNow(new Date(new Date(NOW).getTime() + 58 * DAY)); assert.equal(app.json('testPlanCalc()').past, true);
});
test('sessions carry your own numbers; practice tests are dated; the next scoring step is read from the tables', () => {
  const app = planApp();
  app.run(`setTestDate('${ds(-56)}')`);
  const s = app.json('testSessions(testPlanCalc())');
  assert.deepEqual(s.map(x => x.id), ['MDL', 'HRP', 'SDC', 'PLK', '2MR']);
  assert.equal(s[0].text, '3 × 5 at 225 lb'); assert.equal(s[1].text, '5 sets of 16, twice this week'); assert.equal(s[3].text, '3 holds of 1:15');
  app.setNow(new Date(new Date(NOW).getTime() + 21 * DAY)); // build phase
  const b = app.json('testSessions(testPlanCalc())');
  assert.match(b[4].text, /^6 × 400 m in 1:5\d with 1:30 rest/, 'goal pace per lap comes from the two-mile checkpoint: ' + b[4].text);
  assert.match(b[0].text, /^4 × 3 at \d+ lb$/);
  app.setNow(NOW);
  assert.deepEqual(app.json('testPlanCalc().practice.map(p=>[p.daysOut,p.done])'), [[31, false], [10, false]], 'none in the first week of the plan');
  app.run(`S.aftHistory=[{date:'${ds(-26)}',scores:{}}]`); // logged one day after the first practice date
  app.setNow(new Date(new Date(NOW).getTime() + 30 * DAY));
  assert.deepEqual(app.json('testPlanCalc().practice.map(p=>p.done)'), [true, false]);
  const next = app.json(`aftNextStep('MDL','270')`); const now = app.run(`aftScore('MDL','270')`);
  assert.ok(next.pts > now && next.raw > 270 && app.run(`aftScore('MDL',${next.raw})`) === next.pts);
  assert.equal(app.json(`aftNextStep('MDL','999')`), null, 'nothing above 100 points');
  // a plan with no scores still gives phases and generic sessions
  const bare = loadApp({ now: NOW }); bare.run(`setTestDate('${ds(-21)}')`);
  const pc = bare.json('testPlanCalc()');
  assert.deepEqual(pc.phases.map(p => p.id), ['build', 'peak', 'taper']); assert.ok(pc.events.every(e => e.aim == null));
  assert.equal(bare.json('testSessions(testPlanCalc())').length, 5);
});
test('the test date is validated, moving it keeps the starting point, and it never touches the network', () => {
  const app = planApp();
  const reqs = app.mockFetch(() => ({ body: {} }));
  for (const bad of ['', 'tomorrow', ds(0), ds(3), ds(-400), '2026-13-45']) assert.equal(app.run(`setTestDate(${JSON.stringify(bad)})`), false, bad);
  assert.equal(app.json('S.testPlan'), null);
  assert.equal(app.run(`testPlanCardHTML()`), '');
  app.run(`setTestDate('${ds(-42)}')`);
  app.setNow(new Date(new Date(NOW).getTime() + 14 * DAY));
  app.run(`S.aftCurrent.MDL='290';setTestDate('${ds(-70)}')`);
  assert.deepEqual(app.json('[S.testPlan.start,S.testPlan.from.MDL]'), [ds(0), '270'], 'the plan stretches from where it began');
  assert.equal(app.json('testPlanCalc().weeks'), 10);
  app.run(`go('workout');showTestPlan();renderTestPlan();openAftCard()`);
  assert.ok(app.run(`testPlanCardHTML()`).includes('days to your test'));
  const ics = app.run('testPlanICS()');
  assert.match(ics, /DTSTART;VALUE=DATE:20260824\r\n/); assert.match(ics, /SUMMARY:Fitness test\r\n/); assert.ok((ics.match(/BEGIN:VEVENT/g) || []).length >= 2);
  assert.equal(reqs.length, 0);
  assert.deepEqual(app.json(`normalizeTestPlan({date:'2026-09-01',start:'2026-12-01',from:{MDL:300,junk:1}})`), { date: '2026-09-01', start: '2026-08-31', from: { MDL: '300', HRP: '', SDC: '', PLK: '', '2MR': '' } });
  assert.equal(app.json(`normalizeTestPlan({date:'soon'})`), null); assert.equal(app.json(`normalizeState({testPlan:'x'}).testPlan`), null);
  assert.ok(app.run('backupJSON()').includes('"testPlan"'), 'the plan is part of a backup');
});

// ─── Spotify remote ───
const CID = 'a1b2c3d4'.repeat(4);
function musicApp() {
  const app = loadApp({ now: NOW });
  Object.assign(app.ctx.location, { protocol: 'https:', hostname: 'atveroeos.github.io', origin: 'https://atveroeos.github.io', pathname: '/LahWe/index.html', search: '' });
  return app;
}
const form = raw => Object.fromEntries(new URLSearchParams(raw));
test('Spotify: each person brings their own client ID; it is validated and kept out of the app state and backups', () => {
  const app = musicApp();
  assert.equal(app.run('musicOn()'), false);
  assert.equal(app.run('musicBarHTML()'), '', 'no bar until connected');
  assert.match(app.run(`musicSetClientId('my-client-id')`), /32 letters and numbers/);
  assert.match(app.run(`musicSetClientId('')`), /32 letters and numbers/);
  assert.equal(app.run(`musicSetClientId('  ${CID} ')`), '');
  assert.deepEqual(app.json('musicRead()'), { clientId: CID });
  assert.ok(!JSON.stringify(app.json('S')).includes(CID), 'not in the app state');
  assert.ok(!app.run('backupJSON()').includes(CID), 'not in a backup');
  assert.equal(app.run('musicRedirectUri()'), 'https://atveroeos.github.io/LahWe/', 'index.html is dropped so the address matches what gets registered');
  const built = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'dist', 'index.html'), 'utf8');
  assert.ok(!/client_secret/i.test(built), 'the app never handles a client secret');
  assert.ok(!/clientId\s*[:=]\s*['"][0-9a-f]{32}['"]/i.test(built), 'no client ID is built in');
});
test('Spotify sign-in is PKCE end to end: no secret, state checked, tokens stored on the device only', async () => {
  const app = musicApp();
  app.run(`musicSetClientId('${CID}')`);
  await app.run('musicConnect()');
  const url = new URL(app.ctx.__assigned);
  assert.equal(url.origin + url.pathname, 'https://accounts.spotify.com/authorize');
  const q = Object.fromEntries(url.searchParams);
  assert.deepEqual([q.client_id, q.response_type, q.redirect_uri, q.code_challenge_method], [CID, 'code', 'https://atveroeos.github.io/LahWe/', 'S256']);
  assert.equal(q.scope, 'user-read-playback-state user-modify-playback-state user-read-currently-playing', 'only what a remote needs');
  const pend = app.json('musicRead().pending');
  assert.ok(pend.verifier.length >= 43 && pend.verifier.length <= 128);
  assert.equal(q.code_challenge, require('crypto').createHash('sha256').update(pend.verifier).digest('base64url'), 'the challenge is the hash of the verifier');
  assert.ok(!app.ctx.__assigned.includes(pend.verifier), 'the verifier itself never leaves the device before the exchange');
  // a reply with the wrong state is refused without a request
  const reqs = app.mockFetch(() => ({ body: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 } }));
  assert.match(await app.run(`musicExchange('code123','not-the-state')`), /does not match/);
  assert.equal(reqs.length, 0);
  assert.equal(await app.run(`musicExchange('code123',${JSON.stringify(pend.state)})`), '');
  const sent = app.requests()[0];
  assert.equal(sent.url, 'https://accounts.spotify.com/api/token'); assert.equal(sent.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.deepEqual(form(sent.rawBody), { grant_type: 'authorization_code', code: 'code123', redirect_uri: 'https://atveroeos.github.io/LahWe/', client_id: CID, code_verifier: pend.verifier });
  const m = app.json('musicRead()');
  assert.deepEqual([m.access, m.refresh, m.pending], ['AT', 'RT', undefined]);
  assert.equal(app.run('musicOn()'), true);
  assert.ok(!app.run('backupJSON()').includes('RT') || !/"RT"/.test(app.run('backupJSON()')), 'tokens are not in a backup');
  assert.ok(!/"(access|refresh)"/.test(JSON.stringify(app.json('S'))));
  // changing the client ID signs you out
  app.run(`musicSetClientId('${'f'.repeat(32)}')`);
  assert.equal(app.run('musicOn()'), false);
});
test('Spotify: coming back from sign-in is picked up from the address, and a result that lands in the wrong browser is handed over', async () => {
  const app = musicApp();
  app.run(`musicSetClientId('${CID}')`);
  await app.run('musicConnect()');
  const state = app.json('musicRead().pending.state');
  app.mockFetch(() => ({ body: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 } }));
  app.ctx.location.search = `?code=abc_DEF-123456789012&state=${state}`;
  await app.run('musicHandleReturn()');
  assert.equal(app.run('musicOn()'), true);
  // cancelled at Spotify
  app.run('musicClear();musicSetClientId("' + CID + '")'); await app.run('musicConnect()');
  app.ctx.location.search = `?error=access_denied&state=${app.json('musicRead().pending.state')}`;
  await app.run('musicHandleReturn()');
  assert.deepEqual(app.json('musicRead()'), { clientId: CID });
  // sign-in started in the Home Screen app, result delivered to Safari (no pending sign-in here): no request, paste-code flow
  const safari = musicApp();
  const reqs = safari.mockFetch(() => ({ body: {} }));
  safari.ctx.location.search = '?code=abc_DEF-123456789012&state=stateFromTheApp1';
  await safari.run('musicHandleReturn()');
  assert.equal(reqs.length, 0); assert.equal(safari.run('musicOn()'), false);
  // unrelated query strings are ignored
  safari.ctx.location.search = '?utm_source=x'; await safari.run('musicHandleReturn()');
  safari.ctx.location.search = ''; await safari.run('musicHandleReturn()');
});
function connected() {
  const app = musicApp();
  app.ctx.localStorage.setItem('lahwe_music', JSON.stringify({ clientId: CID, access: 'AT', refresh: 'RT', exp: new Date(NOW).getTime() + 3600e3 }));
  return app;
}
test('Spotify: the remote reads the current track and sends play, pause and skip to the right endpoints', async () => {
  const app = connected();
  const track = { is_playing: true, device: { name: 'iPhone' }, item: { name: 'Song <b>One</b>', artists: [{ name: 'A' }, { name: 'B' }], album: { images: [{ url: 'https://i.scdn.co/image/big' }, { url: 'https://i.scdn.co/image/ab67616d00004851abc' }] } } };
  app.mockFetch(r => (r.method === 'GET' ? { body: track } : { status: 204, body: null }));
  await app.run('musicPoll()');
  assert.deepEqual(app.json('Music.now'), { playing: true, title: 'Song <b>One</b>', artist: 'A, B', device: 'iPhone', art: 'https://i.scdn.co/image/ab67616d00004851abc' });
  const bar = app.run('musicBarHTML()');
  assert.ok(bar.includes('Song &lt;b&gt;One&lt;/b&gt;') && !bar.includes('<b>One</b>'), 'track names are escaped');
  assert.ok(bar.includes('aria-label="Pause"'));
  await app.run(`musicCmd('toggle')`); await app.run(`musicCmd('next')`); await app.run(`musicCmd('prev')`); await app.run(`musicCmd('toggle')`);
  const calls = app.requests().filter(r => r.method !== 'GET').map(r => r.method + ' ' + r.url.replace('https://api.spotify.com/v1', ''));
  assert.deepEqual(calls, ['PUT /me/player/pause', 'POST /me/player/next', 'POST /me/player/previous', 'PUT /me/player/play']);
  assert.ok(app.requests().every(r => r.headers.Authorization === 'Bearer AT' && r.url.startsWith('https://api.spotify.com/v1/')));
  // art from anywhere else is not loaded
  assert.equal(app.json(`musicNowFrom({item:{name:'x',album:{images:[{url:'https://evil.example/x.png'}]}}})`).art, '');
  assert.equal(app.json(`musicNowFrom({item:{name:'x',album:{images:[{url:'javascript:alert(1)'}]}}})`).art, '');
  assert.equal(app.json(`musicNowFrom(null)`), null);
});
test('Spotify: an expired sign-in is refreshed once, and refusals are explained in plain words', async () => {
  const app = connected();
  app.run(`const m=musicRead();m.exp=Date.now()-1000;musicWrite(m)`);
  app.mockFetch(r => (r.url.includes('/api/token') ? { body: { access_token: 'AT2', expires_in: 3600 } } : { status: 204, body: null }));
  await app.run('musicPoll()');
  const rq = app.requests();
  assert.deepEqual(form(rq[0].rawBody), { grant_type: 'refresh_token', refresh_token: 'RT', client_id: CID });
  assert.equal(rq[1].headers.Authorization, 'Bearer AT2');
  assert.deepEqual(app.json('[musicRead().access,musicRead().refresh,Music.now]'), ['AT2', 'RT', null], 'nothing playing is not an error');
  assert.equal(app.run('musicErrorText(403,"PREMIUM_REQUIRED")'), 'Spotify only lets Premium accounts be controlled from another app.');
  assert.match(app.run('musicErrorText(404,"NO_ACTIVE_DEVICE")'), /Open Spotify, press play once/);
  app.mockFetch(() => ({ status: 403, body: { error: { status: 403, message: 'Player command failed: Premium required', reason: 'PREMIUM_REQUIRED' } } }));
  await app.run(`musicCmd('next')`);
  assert.match(app.run('Music.err'), /Premium/);
  // a dead refresh token signs you out instead of looping
  app.run(`const k=musicRead();k.exp=0;musicWrite(k)`);
  app.mockFetch(() => ({ status: 400, body: { error: 'invalid_grant' } }));
  await app.run('musicPoll()');
  assert.equal(app.run('musicOn()'), false); assert.match(app.run('Music.err'), /Connect again/);
  assert.equal(app.requests().length, 1, 'one attempt, no retry storm');
});
test('Spotify: polling only runs while a workout is on screen, and a reset forgets everything', () => {
  const app = connected();
  app.mockFetch(() => ({ status: 204, body: null }));
  app.run(`go('workout');musicSync()`);
  assert.equal(app.run('Music.timer'), null, 'no workout, no polling');
  app.run(`startWorkout();musicSync()`);
  assert.notEqual(app.run('Music.timer'), null);
  assert.ok(app.run(`document.getElementById('content').innerHTML`).includes('id="music-bar"'));
  app.run(`go('nutrition')`); assert.equal(app.run('Music.timer'), null, 'leaving the workout stops it');
  app.run(`musicClear()`);
  assert.equal(app.ctx.localStorage.getItem('lahwe_music'), null);
  assert.equal(app.run('musicOn()'), false);
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'js', '70-settings.js'), 'utf8');
  assert.match(src, /clearAllAiKeys\(\);coachClearAll\(\);musicClear\(\);/, 'Reset All Data clears the Spotify sign-in too');
  const file = loadApp({ now: NOW });
  assert.equal(file.run('musicCanRun()'), false, 'a saved file cannot sign in, and says so');
});

// ─── The look ───
test('accent colours keep their saved ids and only change the accent; a new install follows the phone’s light or dark setting', () => {
  const app = loadApp({ now: NOW });
  assert.deepEqual(app.json('THEMES.map(t=>t.id)'), ['navy', 'slate', 'forest', 'crimson', 'plum', 'amber', 'rose', 'pink'], 'ids are stored in saves and must not change');
  assert.ok(app.json('THEMES').every(t => /^#[0-9a-f]{6}$/.test(t.light) && /^#[0-9a-f]{6}$/.test(t.dark)));
  const styles = {}; app.ctx.document.getElementById = id => (id === 'theme-vars' ? (styles.el = styles.el || { textContent: '' }) : null);
  app.run(`S.primaryColor='forest';S.darkMode=false;applyTheme()`);
  assert.equal(styles.el.textContent, ':root{--navy:#0b8a5c;--ndim:rgba(11,138,92,0.09);--nbright:rgba(11,138,92,0.22);}');
  app.run(`S.darkMode=true;applyTheme()`);
  assert.match(styles.el.textContent, /^\[data-dark="true"\]\{--navy:#16a674;/);
  assert.ok(!/--bg|--card|--border/.test(styles.el.textContent), 'surfaces stay neutral whatever the accent');
  assert.equal(app.run('defaultState().darkMode'), false);
  app.ctx.matchMedia = q => ({ matches: /dark/.test(q) });
  assert.equal(app.run('defaultState().darkMode'), true);
  assert.equal(app.json(`normalizeState({darkMode:false,onboarded:true}).darkMode`), false, 'an existing save keeps the setting it has');
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'styles.css'), 'utf8');
  assert.ok(!/fonts\.googleapis|DM Sans|IBM Plex/.test(css + require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'index.html'), 'utf8')), 'no font is downloaded: the system font is used');
});
test('new state fields exist on every save, old or new', () => {
  const app = loadApp({ now: NOW });
  const s = app.json(`normalizeState({onboarded:true,workouts:[],routines:[]})`);
  assert.deepEqual([s.swapLog, s.nextTargets, s.testPlan], [{}, {}, null]);
  assert.ok(app.json('ICON_PATHS.swap&&ICON_PATHS.spark&&ICON_PATHS.play&&ICON_PATHS.more&&ICON_PATHS.tag&&true'));
});
