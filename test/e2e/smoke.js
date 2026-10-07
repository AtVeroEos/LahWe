#!/usr/bin/env node
// End-to-end smoke test: drives the built single-file app in headless Chromium at iPhone size.
// It is a regression net, not proof of iOS behaviour — Safari on a real phone still has to be checked by hand.
//   node build.js && node test/e2e/smoke.js
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
let playwright;
try { playwright = require('playwright'); }
catch (e) { try { playwright = require('/opt/npm-tools/node_modules/playwright'); } catch (e2) { console.error('Playwright is not installed: npm i -D playwright'); process.exit(2); } }
const { chromium, devices } = playwright;

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const failures = [];
const errs = [];
let page;
const ok = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const shot = name => page.screenshot({ path: path.join(OUT, name + '.png') });
const ev = (fn, arg) => page.evaluate(fn, arg);
const settle = (ms = 260) => page.waitForTimeout(ms);
const closeAll = async () => { await ev(() => document.querySelectorAll('.ov').forEach(o => o.remove())); };
const step = async (name, fn) => {
  console.log('• ' + name);
  const before = errs.length;
  try { await fn(); } catch (e) { failures.push(name + ': ' + e.message.split('\n').slice(0, 4).join(' / ')); console.log('  ✗ threw: ' + e.message.split('\n').slice(0, 6).join(' / ')); try { await page.screenshot({ path: path.join(OUT, 'FAILED-' + name.replace(/[^a-z0-9]+/gi, '-').slice(0, 40) + '.png') }); } catch (e2) {} }
  if (errs.length > before) { failures.push(name + ': page errors → ' + errs.slice(before).join(' | ')); console.log('  ✗ page errors: ' + errs.slice(before).join(' | ')); }
};

// A save written by the old single-file build (no schema marker), with the problems the rewrite fixes.
function legacyState() {
  const eve = new Date(); eve.setDate(eve.getDate() - 3); eve.setHours(22, 20, 0, 0);
  const wk = (id, daysAgo, sets) => {
    const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(18, 0, 0, 0);
    return { id, name: 'Push', routineId: 'r1', started: d.getTime(), ended: d.getTime() + 55 * 60000, cals: 420,
      exercises: [{ exId: 'bb-bench', sets }, { exId: 'custom-old1', sets: [{ w: '50', r: '12', done: true, tag: '' }] }] };
  };
  return {
    tab: 'workout', unit: 'lbs', name: 'Legacy <b>User</b>', bodyweight: 190, onboarded: true, goal: 'strength', height: 70,
    workouts: [
      wk('w3', 2, [{ w: '45', r: '10', done: true, warmup: true }, { w: '225', r: '5', done: true }, { w: '225', r: '5', done: true }, { w: '225', r: '4', done: true }]),
      { id: 'wLong', name: 'Left running', started: eve.getTime(), ended: eve.getTime() + 6 * 3600000, cals: 2265, exercises: [{ exId: 'squat', sets: [{ w: '315', r: '3', done: true }] }] },
      wk('w1', 9, [{ w: '215', r: '5', done: true }, { w: '215', r: '5', done: true }]),
    ],
    routines: [{ id: 'r1', name: 'Push', notes: '', exercises: [{ exId: 'bb-bench', sets: 3, w: '', r: '5', type: 'flat', rest: 180 }, { exId: 'custom-old1', sets: 2, w: '', r: '12', type: 'flat', rest: null }], days: [] }],
    groups: [{ id: 'g1', name: 'PPL', mode: 'rotation', routineIds: ['r1', 'gone'], cursor: 0, dayMap: {}, active: true }],
    custom: [{ id: 'custom-old1', name: 'Seated Leg Curl', cat: 'Legs', eq: 'Machine', muscle: 'Hamstrings', sec: ['Calves'] }],
    prs: { 'bb-bench': { w: 405, r: 1, est: 405, date: '2025-01-01' }, 'squat': { w: 315, r: 3, est: 347, date: '2026-01-01' } },
    macroLogs: { [new Date().toISOString().split('T')[0]]: { protein: 40, carbs: 50, fat: 10, cals: 450 } },
    meals: [], bodyweightLog: [{ date: '2026-09-01', weight: 192 }, { date: '2026-09-20', weight: 190 }],
    customFoods: [{ id: "cf_12'3\"4", name: 'Odd <i>Bar</i>', serving: '1 bar', protein: 20, carbs: 20, fat: 8, cals: 230 }],
    starredFoods: ["cf_12'3\"4"], supps: [{ id: 's1', name: 'Creatine', dose: '5g', timing: 'Morning' }], suppLogs: {},
    macroGoals: { protein: 180, carbs: 250, fat: 70, calories: 2400 },
  };
}
const PROGRAM = {
  version: 2,
  group: { name: 'Smoke UL', mode: 'daypicker' },
  routines: [
    { name: 'Smoke UL - Upper', notes: 'Add weight when all sets hit the top of the range', days: ['Mon', 'Thu'], exercises: [
      { name: 'Barbell Bench Press', sets: 3, reps: '6-8', rest: 150, equipment: 'Barbell', muscle: 'Chest', secondaryMuscles: ['Triceps'] },
      { name: 'Seated Leg Curl', sets: 3, reps: '10-12', rest: 75, equipment: 'Machine', muscle: 'Hamstrings', secondaryMuscles: [] },
      { name: 'Pull Ups', sets: 3, reps: 'AMRAP', rest: 120, equipment: 'Bodyweight', muscle: 'Lats', secondaryMuscles: ['Biceps'], link: 'A' },
      { name: 'Plank', sets: 3, reps: '45s', rest: 45, equipment: 'Bodyweight', muscle: 'Abs', secondaryMuscles: [], link: 'A', note: 'squeeze glutes' },
    ] },
    { name: 'Smoke UL - Lower', notes: '', days: ['Tue', 'Fri'], exercises: [
      { name: 'Squat', sets: 4, reps: 5, rest: 180, equipment: 'Barbell', muscle: 'Quads', secondaryMuscles: ['Glutes'] },
      { name: 'Zercher <script>alert(1)</script> Carry', sets: 2, reps: '30 sec', rest: 90, equipment: 'Barbell', muscle: 'Traps', secondaryMuscles: ['Abs'] },
    ] },
  ],
};
const AI_REPLY = {
  summary: 'Two full-body days built around the big lifts.',
  groups: [{ name: 'AI Full Body', mode: 'rotation', weeks: 0, routines: [
    { name: 'AI Full Body - A', notes: 'Leave one rep in reserve', days: [], exercises: [
      { exId: 'squat', name: 'Barbell Back Squat', equipment: 'Barbell', muscle: 'Quads', secondaryMuscles: ['Glutes'], sets: 3, repsMin: 5, repsMax: 0, amrap: false, timed: false, rest: 180, type: 'flat', link: '', note: 'RPE 8' },
      { exId: 'NEW', name: 'Cable Lateral Raise', equipment: 'Cable', muscle: 'Shoulders', secondaryMuscles: [], sets: 3, repsMin: 12, repsMax: 15, amrap: false, timed: false, rest: 60, type: 'flat', link: '', note: '' },
      { exId: 'PLANK', name: 'Plank', equipment: 'bodyweight', muscle: 'abs', secondaryMuscles: [], sets: 2, repsMin: 40, repsMax: 60, amrap: false, timed: true, rest: 45, type: 'flat', link: '', note: '' },
    ] },
    { name: 'AI Full Body - B', notes: '', days: [], exercises: [
      { exId: 'deadlift', name: 'Deadlift', equipment: 'Barbell', muscle: 'Hamstrings', secondaryMuscles: ['Glutes', 'Lower Back'], sets: 2, repsMin: 5, repsMax: 0, amrap: false, timed: false, rest: 180, type: 'flat', link: '', note: '' },
      { exId: 'pushup', name: 'Push-Up', equipment: 'Bodyweight', muscle: 'Chest', secondaryMuscles: ['Triceps'], sets: 3, repsMin: 10, repsMax: 0, amrap: true, timed: false, rest: 60, type: 'flat', link: '', note: '' },
    ] },
  ] }],
};

// Fake credentials, assembled at run time so the repository never contains anything key-shaped.
const KEYS = {
  anthropic: 'sk-' + 'ant-' + 'api03-' + 'x'.repeat(40),
  openai: 'sk-' + 'proj-' + 'y'.repeat(40),
  gemini: 'AI' + 'za' + 'z'.repeat(35),
  openrouter: 'sk-' + 'or-' + 'v1-' + 'a'.repeat(40),
};
const ai = { queue: [], log: [] };
const text = t => ({ type: 'text', text: t });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const claude = (...blocks) => ({ body: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: blocks,
  stop_reason: blocks.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn', usage: { input_tokens: 2100, output_tokens: 140 } } });
const OTHER = {
  openai: { label: 'ChatGPT', host: 'api.openai.com', header: 'authorization', reply: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'OK' }] }], usage: { input_tokens: 9, output_tokens: 1 } } },
  gemini: { label: 'Gemini', host: 'generativelanguage.googleapis.com', header: 'x-goog-api-key', reply: { candidates: [{ content: { parts: [{ text: 'OK' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 1 } } },
  openrouter: { label: 'OpenRouter', host: 'openrouter.ai', header: 'authorization', reply: { choices: [{ message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }], usage: { prompt_tokens: 9, completion_tokens: 1 } } },
};
const coachDone = (minTurns) => page.waitForFunction(n => !Coach.busy && Coach.turns.length >= n, minTurns, { timeout: 10000 });

function serveDist() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };
  const srv = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(DIST, path.normalize(name).replace(/^(\.\.[\/\\])+/, ''));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

(async () => {
  const srv = await serveDist();
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined, acceptDownloads: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|openfoodfacts\.org/, r => r.abort());
  // Every AI provider is answered from a script; nothing in this test reaches a real service.
  await ctx.route(/^https:\/\/(api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com|openrouter\.ai|llm\.example\.test)\//, async r => {
    const rq = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (rq.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const rec = { url: rq.url(), method: rq.method(), headers: rq.headers(), raw: rq.postData() || '', body: rq.postData() ? JSON.parse(rq.postData()) : null };
    ai.log.push(rec);
    const next = ai.queue.length ? ai.queue.shift() : { status: 500, body: { error: { message: 'no scripted reply left' } } };
    await r.fulfill({ status: next.status || 200, contentType: 'application/json', headers: cors, body: JSON.stringify(next.body) });
  });
  page = await ctx.newPage();
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 240)); });
  page.on('dialog', d => { errs.push('NATIVE DIALOG ' + d.message()); d.dismiss(); });

  await step('first launch → onboarding', async () => {
    await page.goto(base, { waitUntil: 'load' }); await settle(500);
    ok(await page.isVisible('#ob-name'), 'onboarding is shown');
    await page.fill('#ob-name', 'Smoke'); await page.fill('#ob-bw', '185'); await page.fill('#ob-height', '70');
    ok(await page.locator('#ob-sex-male.btp, #ob-sex-female.btp').count() === 0, 'setup asks for sex and assumes neither');
    await page.click('#ob-kg'); ok(await page.textContent('#ob-hl') === 'cm', 'a metric user is asked for height in centimetres');
    await page.click('#ob-lbs'); await page.click('#ob-sex-male');
    await page.click('text=Get Started'); await settle();
    ok(await ev(() => S.onboarded && document.getElementById('nav').style.display === 'flex'), 'home screen after onboarding');
    ok(await ev(() => S.aftGender === 'male' && S.profileSet.sex && S.profileSet.height && S.height === 70 && profileGaps().map(g => g.k).join() === 'age'), 'sex and height are recorded as given; only the birth year is still a default');
    ok(await ev(() => !!localStorage.getItem('lahwe_v2')), 'state written to localStorage immediately');
    await shot('01-home-empty');
  });

  await step('every tab renders', async () => {
    for (const t of ['history', 'coach', 'progress', 'nutrition', 'library', 'workout']) {
      await ev(t => go(t), t); await settle(160);
      ok(await ev(() => document.getElementById('content').children.length > 0 && !/hit an error/.test(document.getElementById('content').textContent)), t + ' tab');
    }
  });

  await step('import a program (ranges, AMRAP, timed, superset, weekdays, hostile name)', async () => {
    await ev(() => { go('library'); setLibTab('routines'); showImportUI(); }); await settle();
    const before = await ev(() => JSON.stringify([S.custom.length, S.routines.length]));
    await page.fill('#import-json', '```json\n' + JSON.stringify(PROGRAM) + '\n```'); await settle(200);
    ok(await ev(() => JSON.stringify([S.custom.length, S.routines.length])) === before, 'preview does not write anything');
    ok(await page.isEnabled('#import-go-btn'), 'import button enabled');
    ok(await ev(() => !document.querySelector('#import-preview-area script')), 'hostile exercise name is not injected as markup');
    await page.click('.ip-r summary'); await settle(120); await shot('02-import-preview');
    await page.click('#import-go-btn'); await settle(400);
    const r = await ev(() => {
      const up = S.routines.find(x => x.name === 'Smoke UL - Upper'), lo = S.routines.find(x => x.name === 'Smoke UL - Lower');
      const g = S.groups.find(x => x.name === 'Smoke UL');
      return { up, lo, g, custom: S.custom.map(c => c.name + '|' + c.cat + '|' + c.muscle), nextIsRoutine: !!S.routines.length };
    });
    ok(r.up && r.up.exercises[0].exId === 'bb-bench' && r.up.exercises[0].r === '6' && r.up.exercises[0].rMax === '8', 'rep range 6–8 kept');
    ok(r.up.exercises[1].exId !== 'leg-curl', '"Seated Leg Curl" was NOT merged into Leg Curl');
    ok(r.custom.includes('Seated Leg Curl|Legs|Hamstrings'), 'new exercise filed under Legs / Hamstrings');
    ok(r.up.exercises[2].exId === 'pullup' && r.up.exercises[2].amrap === true, '"Pull Ups" → Pull-Up, AMRAP');
    ok(r.up.exercises[3].exId === 'plank' && r.up.exercises[3].timed === true && r.up.exercises[3].r === '45', 'plank is timed, 45 s');
    ok(r.up.exercises[2].link && r.up.exercises[2].link === r.up.exercises[3].link, 'superset link kept');
    ok(r.lo.exercises[0].exId === 'squat', '"Squat" + Barbell → Barbell Back Squat');
    ok(r.lo.exercises[1].timed && r.lo.exercises[1].r === '30', '"30 sec" parsed as timed');
    ok(r.g && r.g.mode === 'daypicker' && JSON.stringify(r.g.dayMap[r.up.id]) === '[1,4]', 'weekdays mapped onto the group');
    ok(r.g.active === true, 'first group becomes active');
  });

  await step('routine editor: range / AMRAP / time / note inputs', async () => {
    const rid = await ev(() => S.routines.find(x => x.name === 'Smoke UL - Lower').id);
    await ev(rid => showRoutineDetail(rid), rid); await settle();
    await shot('03-routine-editor');
    const inputs = await page.$$('#rd-ex-list .rtn-ex:first-child .rtn-reps');
    ok(inputs.length === 2, 'reps and range inputs present');
    await inputs[1].fill('8'); await inputs[1].dispatchEvent('change');
    await page.fill('#rd-ex-list .rtn-ex:first-child .rtn-note', 'belt on top sets');
    await page.dispatchEvent('#rd-ex-list .rtn-ex:first-child .rtn-note', 'change');
    await page.click('#rd-ex-list .rtn-ex:first-child .rtn-type button:has-text("AMRAP")'); await settle(120);
    const e = await ev(rid => S.routines.find(x => x.id === rid).exercises[0], rid);
    ok(e.amrap === true && !e.rMax && e.note === 'belt on top sets', 'mode switch and note stored');
    await page.click('#rd-ex-list .rtn-ex:first-child .rtn-type button:has-text("Reps")'); await settle(120);
    // drag the first exercise below the second, twice: the order must flip each time (handlers used to stack)
    const order = () => ev(rid => S.routines.find(x => x.id === rid).exercises.map(e => e.exId).join(','), rid);
    const start = await order();
    const drag = async () => {
      const h = await page.locator('#rd-ex-list [data-drag="0"]').boundingBox(); const t = await page.locator('#rd-ex-list .rd-ex-row >> nth=1').boundingBox();
      await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down();
      await page.mouse.move(t.x + 40, t.y + t.height / 2, { steps: 6 }); await page.mouse.up(); await settle(150);
    };
    await drag(); const once = await order(); await drag(); const twice = await order();
    ok(once !== start && twice === start, 'drag-to-reorder moves exactly one place per drag');
    await closeAll();
  });

  await step('workout: autofill, check sets, rest timer, add/remove, finish', async () => {
    const rid = await ev(() => S.routines.find(x => x.name === 'Smoke UL - Upper').id);
    await ev(rid => { go('workout'); startWorkout(rid); }, rid); await settle();
    ok(await ev(() => S.activeWorkout && S.activeWorkout.exercises.length === 4), 'session started with 4 exercises');
    ok(await ev(() => S.activeWorkout.exercises[0].sets.filter(s => !s.warmup).length === 3), 'routine decides working-set count (3)');
    const box = await page.locator('.chk').first().boundingBox();
    ok(box && box.width >= 40 && box.height >= 40, `set checkbox is ${box && Math.round(box.width)}×${box && Math.round(box.height)} px (≥40)`);
    await page.fill('#sr-0-0 .sinp >> nth=0', '185'); await page.dispatchEvent('#sr-0-0 .sinp >> nth=0', 'change');
    await page.fill('#sr-0-0 .sinp >> nth=1', '8'); await page.dispatchEvent('#sr-0-0 .sinp >> nth=1', 'change'); await settle(120);
    ok(await ev(() => S.activeWorkout.exercises[0].sets.every(s => s.warmup || s.w === '185')), 'straight sets follow set 1 (185)');
    await page.click('#sr-0-0 .chk'); await settle(200);
    ok(await ev(() => !!S.restTimer && S.restTimer.total === 150 && S.restTimer.end > Date.now()), 'rest timer runs off an end timestamp (150 s)');
    ok(await ev(() => S.prs['bb-bench'] && S.prs['bb-bench'].w === 185 && S.prs['bb-bench'].live === true), 'live PR derived from the open session');
    await ev(() => { addWarmup(0); }); await settle(120);
    await ev(() => { addSet(0); }); await settle(120);
    ok(await ev(() => { const s = S.activeWorkout.exercises[0].sets; return s[s.length - 1].w === '185'; }), '"+ Set" copies the working weight, not the warm-up');
    await ev(() => rmLastSet(0)); await settle(120);
    const doneIdx = await ev(() => S.activeWorkout.exercises[0].sets.findIndex(s => s.done));
    await ev(i => { togSet(0, i); }, doneIdx); await settle(120);
    ok(await ev(() => !S.prs['bb-bench']), 'un-checking the set removes the PR again');
    await ev(i => { togSet(0, i); const w = S.activeWorkout.exercises[0].sets.findIndex(s => s.warmup); if (w >= 0) togSet(0, w); }, doneIdx);
    await ev(() => { upd(3, 0, 'r', '45'); togSet(3, 0); upd(2, 0, 'r', '9'); togSet(2, 0); }); await settle(150);
    await shot('04-session');
    // simulate the phone having been locked for 10 minutes: the countdown must be over, not paused
    await ev(() => { S.restTimer.end = Date.now() - 1000; document.dispatchEvent(new Event('visibilitychange')); }); await settle(400);
    ok(await ev(() => !S.restTimer), 'rest that ended while away is cleared on return');
    // the session was "left open" for 3½ hours, but the last set was checked 40 minutes in
    await ev(() => { const wk = S.activeWorkout; wk.started = Date.now() - 3.5 * 3600000; wk.exercises.forEach(ex => ex.sets.forEach(s => { if (s.done) s.t = wk.started + 40 * 60000; })); });
    // tapping Start on another routine mid-workout must not throw this one away
    const openId = await ev(() => S.activeWorkout.id);
    await ev(() => { const other = S.routines.find(x => x.name === 'Smoke UL - Lower'); go('library'); showRoutineDetail(other.id); }); await settle();
    await page.click('#rd-ov button:has-text("Start")'); await settle(400);
    ok(await ev(id => S.activeWorkout && S.activeWorkout.id === id && S.tab === 'workout' && doneSetCnt(S.activeWorkout) >= 3, openId), 'starting another routine keeps the open workout');
    await ev(() => showFinish()); await settle(); await shot('05-finish');
    await ev(() => saveWorkout()); await settle(500);
    const w = await ev(() => ({ n: S.workouts.length, aw: S.activeWorkout, wk: S.workouts[0], pr: S.prs['bb-bench'], ls: JSON.parse(localStorage.getItem('lahwe_v2')).workouts.length }));
    ok(w.n === 1 && w.aw === null && w.ls === 1, 'workout saved and flushed to storage');
    ok(w.pr && w.pr.w === 185 && w.pr.r === 8 && !w.pr.live, 'PR comes from history');
    ok(!('_af' in w.wk.exercises[0]) && !w.wk.exercises[0].sets.some(s => '_manual' in s), 'transient flags stripped from the saved workout');
    ok(w.wk.cals > 250 && w.wk.cals < 320 && w.wk.ended - w.wk.started < 50 * 60000, `calories and duration reflect the 45 min trained, not 3½ h on the clock (${w.wk.cals} kcal)`);
    await closeAll();
  });

  await step('progress tab: one tab, three views (Progress · History · Schedule)', async () => {
    await page.click('#nav .nb[data-tab="progress"]'); await settle();
    ok(await page.locator('.seg .seg-b').count() === 3 && /Progress/.test(await page.textContent('.seg-b.on')) && await page.locator('#board .tile').count() >= 3, 'opens on the Progress board with the switch at the top');
    await page.click('.seg-b:has-text("History")'); await settle();
    ok(await ev(() => S.tab === 'progress' && S.progView === 'history') && await page.locator('#content .hi').count() >= 1 && /History/.test(await page.textContent('.page-title')), 'History lists the logged workout');
    ok(await ev(() => document.querySelector('#nav .nb.on').dataset.tab === 'progress'), 'the Progress tab stays lit');
    await shot('06a-history-view');
    await page.click('.seg-b:has-text("Schedule")'); await settle();
    ok(await ev(() => S.progView === 'schedule') && await page.locator('.cal-cell').count() >= 28, 'Schedule shows the calendar');
    await page.click('#content button:has-text("›")'); await settle(150);
    ok(await ev(() => S.progView === 'schedule') && await page.locator('.seg-b.on:has-text("Schedule")').count() === 1, 'moving through months stays on Schedule');
    await shot('06b-schedule-view');
    await page.click('#nav .nb[data-tab="nutrition"]'); await settle(150); await page.click('#nav .nb[data-tab="progress"]'); await settle();
    ok(await ev(() => S.progView === 'progress'), 'tapping the tab again returns to Progress');
  });

  await step('modes: a session can be discarded instead of logged', async () => {
    const before = await ev(() => ({ w: S.workouts.length, a: S.activities.length }));
    await ev(() => { go('workout'); showModes(); }); await settle();
    await page.click('.mode-card:has-text("Sprint Intervals")'); await settle(500);
    await page.click('#sprint-setup-ov button:has-text("Start")'); await settle(600);
    ok(await ev(() => !!S.activeSprintTimer), 'sprint timer running');
    await page.click('.fbar button:has-text("Stop")'); await settle();
    ok(await page.isVisible('#mode-end-ov') && !(await page.isVisible('#mode-end-ov button:has-text("Save")')), 'Stop asks; with nothing done there is nothing to save');
    await shot('06c-mode-discard');
    await page.click('#mode-end-ov button:has-text("Discard")'); await settle(400);
    ok(await ev(b => !S.activeSprintTimer && S.activities.length === b.a, before) && await page.isVisible('.home-coach'), 'discarded: back on the home screen, nothing logged');
    // card deck: one card done → both choices offered; discard logs nothing
    await ev(() => { S.activeCardDeck = { deck: [{ suit: 'h', label: '5', value: 5, exId: 'pushup' }, { suit: 'h', label: '9', value: 9, exId: 'pushup' }, { suit: 'h', label: '2', value: 2, exId: 'pushup' }], cardIdx: 0, startTime: Date.now(), secPerRep: 3, buffer: 5, suitMap: { h: 'pushup' }, repsByEx: { pushup: 0 }, cardsByEx: { pushup: [] }, _phaseStart: null, _phaseDur: null }; save(); go('workout'); schedCDAutoFlip(); flipCard(false); }); await settle(300);
    await page.click('.fbar button:has-text("End")'); await settle();
    ok(await page.isVisible('#mode-end-ov button:has-text("Save 1 card")') && await page.isVisible('#mode-end-ov button:has-text("Discard")') && await page.isVisible('#mode-end-ov button:has-text("Keep going")'), 'End offers save, discard or keep going');
    await page.click('#mode-end-ov button:has-text("Keep going")'); await settle(300);
    ok(await ev(() => !!S.activeCardDeck), '"Keep going" leaves the deck running');
    await page.click('.fbar button:has-text("End")'); await settle();
    await page.click('#mode-end-ov button:has-text("Discard")'); await settle(400);
    ok(await ev(b => !S.activeCardDeck && S.workouts.length === b.w, before), 'deck discarded: nothing added to history');
    await ev(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  });

  await step('history: detail, exclude a set from records, calendar', async () => {
    await ev(() => go('history')); await settle();
    const id = await ev(() => S.workouts[0].id);
    await ev(id => showWkDetail(id), id); await settle(); await shot('06-workout-detail');
    await page.click('.set-chip:not(.warm)'); await settle(200);
    ok(await ev(() => !S.prs['bb-bench']), 'excluding the only bench set removes its PR');
    await page.click('.set-chip.excl'); await settle(200);
    ok(await ev(() => S.prs['bb-bench'] && S.prs['bb-bench'].w === 185), 'including it again restores the PR');
    await closeAll();
    await ev(() => setHistTab('cal')); await settle(); await shot('07-calendar');
    await ev(() => setHistTab('list')); await settle(120);
  });

  await step('progress: the board, every tile opened, editing', async () => {
    await ev(() => { boardSet(Object.keys(METRICS).map(k => ({ k }))); go('progress'); }); await settle(400);
    const n = await ev(() => Object.keys(METRICS).length);
    ok(await page.locator('#board .tile').count() === n, `every one of the ${n} metrics draws a tile`);
    await shot('08-progress');
    for (const k of await ev(() => Object.keys(METRICS))) {
      await ev(k => openTile(k), k); await settle(160);
      ok(await page.locator('.ov .modal').count() === 1 && !/could not be worked out/.test(await page.textContent('.ov')), `${k} opens its sheet`);
      await closeAll();
    }
    await ev(() => { S.aftCurrent = { MDL: '340', HRP: '45', SDC: '105', PLK: '160', '2MR': '930' }; S.aftAge = '27-31'; save(); showMetric('aft'); }); await settle(300); await shot('08b-aft');
    const aft = await ev(() => aftSummary(S.aftCurrent, aftColumn()));
    ok(aft.complete && aft.scores.MDL === 98 && aft.total > 300 && aft.total <= 500 && aft.pass === true, `AFT scored from the official tables (340 lb deadlift = 98 pts at 27–31; total ${aft.total}/500)`);
    ok(await page.isVisible('#metric-ov .aft-total') && await page.textContent('#aft-total') === String(aft.total), 'the fitness test opens from its tile with the same total');
    await page.fill('#metric-ov .aft-row input >> nth=0', '350'); await page.keyboard.press('Tab'); await settle(250);
    ok(await ev(() => S.aftCurrent.MDL === '350') && await page.isVisible('#metric-ov .aft-total'), 'typing a result updates it in place without closing the sheet');
    await closeAll();
    ok(/of 500/.test(await page.textContent('#tile-aft')), 'and the tile on the board shows the score');
    // range: the header picker and the switch inside a sheet are the same setting
    await page.selectOption('#board-range', '4w'); await settle(250);
    ok(await ev(() => S.board.range === '4w') && /last 4 weeks/.test(await page.textContent('.board-note')), 'the range picker changes the whole board');
    await page.click('#tile-weight'); await settle(300);
    ok(await page.locator('#metric-ov .seg-b.on').textContent() === '4 wk', 'a tile opens on the same range');
    await page.click('#metric-ov .seg-b:has-text("12 wk")'); await settle(250);
    ok(await ev(() => S.board.range === '12w') && await page.inputValue('#board-range') === '12w' && await page.isVisible('#metric-ov'), 'changing it in the sheet changes the board behind it');
    await closeAll();
    // edit: remove, add, reorder by dragging and by keyboard, reset
    await page.click('#board-edit'); await settle(350);
    const order0 = await ev(() => boardTiles().map(t => t.k));
    ok(await page.locator('#be-list .be-row').count() === order0.length, 'Edit lists what is on the board');
    await page.click(`#be-list .be-row[data-k="${order0[1]}"] .be-x`); await settle(250);
    ok(await ev(k => !boardTiles().some(t => t.k === k), order0[1]) && !(await page.isVisible('#tile-' + order0[1])), 'removing a tile takes it off the board at once');
    await page.click(`.be-add .be-plus[aria-label="Add ${await ev(k => METRICS[k].title, order0[1])}"]`); await settle(250);
    ok(await ev(k => boardTiles()[boardTiles().length - 1].k === k, order0[1]), 'adding it back puts it at the end');
    const before = await ev(() => boardTiles().map(t => t.k));
    await ev(() => { document.querySelector('#bedit-ov .modal').scrollTop = 0; }); await settle(150);
    const grip = await page.locator('#be-list .be-grip >> nth=0').boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + 60, { steps: 4 }); await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + 104, { steps: 4 });
    ok(await page.locator('#be-list .be-row.be-drag').count() === 1, 'the row lifts while it is dragged');
    await page.mouse.up(); await settle(300);
    const after = await ev(() => boardTiles().map(t => t.k));
    ok(after[2] === before[0] && after[0] === before[1] && after[1] === before[2], `dragging the first row down two places moves it there (${before.slice(0, 3)} → ${after.slice(0, 3)})`);
    await page.focus('#be-list .be-grip >> nth=2'); await page.keyboard.press('ArrowUp'); await settle(200);
    ok(await ev(b => boardTiles()[1].k === b, before[0]), 'the arrow keys move a row too');
    ok(await ev(() => document.querySelector('#board .tile').id === 'tile-' + boardTiles()[0].k), 'the board behind follows the new order');
    await shot('08c-board-edit');
    await page.click('#be-reset'); await settle(250);
    ok(await ev(() => !boardCustom()) && await page.isVisible('.be-note'), 'Reset returns to the layout for the goal');
    await closeAll();
    for (const w of [320, 390, 430]) {
      await page.setViewportSize({ width: w, height: 664 }); await settle(150);
      const over = await ev(() => [...document.querySelectorAll('#content *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.className.baseVal != null ? e.className.baseVal : (e.className || e.tagName)).slice(0, 4));
      ok(over.length === 0, `the board fits at ${w}px` + (over.length ? ': ' + over.join(', ') : ''));
    }
    await page.setViewportSize({ width: 390, height: 664 });
  });

  await step('nutrition: meal + Quick Log are added together; energy is prorated', async () => {
    await ev(() => { go('nutrition'); quickLogFood('qf_popcorn'); }); await settle();
    await page.click('#mtype-ov button:has-text("Snack")'); await settle(300);
    await ev(() => showLogMacros()); await settle();
    await page.fill('#m-pro', '30'); await page.fill('#m-cal', '400'); await page.click('#macro-ov button:has-text("Save")'); await settle(300);
    const t = await ev(() => ({ t: getDayTotals(today()), e: energyBalance(today()), full: baselineBurn() }));
    ok(t.t.cals === 493 && t.t.fromMeals && t.t.quick && t.t.quick.cals === 400, `93 kcal meal + 400 kcal Quick Log = ${t.t.cals}`);
    ok(t.e.partial && t.e.base < t.full, `today's baseline is prorated (${t.e.base} of ${t.full})`);
    await shot('09-nutrition');
    await ev(() => showAddMeal()); await settle();
    await page.fill('#food-search', 'chicken'); await page.dispatchEvent('#food-search', 'input'); await settle(150);
    ok(await page.locator('#food-list .hi').count() > 0, 'food search finds results');
    await closeAll();
    await ev(() => { showMacroGoals(); }); await settle(); await closeAll();
    await ev(() => { showAddSupp(); }); await settle(); await closeAll();
  });

  await step('library search keeps focus while typing', async () => {
    await ev(() => { go('library'); setLibTab('exercises'); }); await settle();
    await page.click('#lib-srch'); await page.keyboard.type('curl', { delay: 30 }); await settle(150);
    ok(await ev(() => document.activeElement && document.activeElement.id === 'lib-srch' && document.activeElement.value === 'curl'), 'search box still focused with "curl" in it');
    ok(await ev(() => [...document.querySelectorAll('#lib-list .exin')].every(e => /curl/i.test(e.textContent))), 'list filtered');
    await ev(() => { window._libQ = ''; setLibTab('groups'); }); await settle(); await shot('10-groups');
    const gid = await ev(() => S.groups[0].id);
    await ev(gid => showGroupDetail(gid), gid); await settle(); await ev(gid => showGroupEval(gid), gid); await settle(); await shot('11-group-eval'); await closeAll();
    await ev(() => setLibTab('equipment')); await settle(120);
  });

  await step('coach: set up with your own key, on any provider', async () => {
    await ev(() => go('workout')); await settle(150);
    ok(await page.isVisible('.home-coach'), 'the coach is offered on the home screen');
    await page.click('#nav .nb[data-tab="coach"]'); await settle();
    ok(await page.isVisible('text=Meet your coach'), 'explains itself before any key exists');
    ok(await ev(() => !document.getElementById('coach-bar')), 'no message box until it is set up');
    await shot('12-coach-setup');
    await page.click('text=Set up the coach'); await settle();
    await page.fill('#ai-key', KEYS.openrouter); await page.click('#ai-key-save'); await settle(200);
    ok(await ev(() => !localStorage.getItem('lahwe_ai_keys')), 'an OpenRouter key pasted under Claude is refused and not stored');
    await page.fill('#ai-key', KEYS.anthropic); await page.click('#ai-key-save'); await settle(300);
    ok(await ev(k => JSON.parse(localStorage.getItem('lahwe_ai_keys')).anthropic === k && !JSON.stringify(S).includes(k) && !localStorage.getItem('lahwe_v2').includes(k), KEYS.anthropic), 'key stored on this device, outside the app state');
    ok(await ev(k => !document.documentElement.outerHTML.includes(k), KEYS.anthropic), 'once saved, the full key is never on screen again');
    ai.queue.push(claude(text('OK')));
    await page.click('#ai-test'); await page.waitForSelector('#ai-test-out .ai-ok', { timeout: 8000 });
    ok(/Working\. claude-sonnet-5-5 answered/.test(await page.textContent('#ai-test-out')), 'test connection makes a real exchange');
    let rq = ai.log[ai.log.length - 1];
    ok(rq.headers['x-api-key'] === KEYS.anthropic && rq.headers['anthropic-version'] === '2023-06-01' && rq.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'Claude: required headers sent');
    ok(!rq.url.includes(KEYS.anthropic) && !rq.raw.includes(KEYS.anthropic) && !rq.headers.referer, 'the key is in a header only; no referrer is sent');
    await shot('13-ai-settings');
    for (const id of Object.keys(OTHER)) {
      const o = OTHER[id];
      await page.click(`.prov:has-text("${o.label}")`); await settle(200);
      ok(await ev(() => document.getElementById('ai-key') && document.getElementById('ai-key').value === ''), `${o.label}: starts with no key (another provider's is not reused)`);
      await page.fill('#ai-key', KEYS[id]); await page.click('#ai-key-save'); await settle(250);
      ai.queue.push({ body: o.reply });
      await page.click('#ai-test'); await page.waitForSelector('#ai-test-out .ai-ok', { timeout: 8000 });
      rq = ai.log[ai.log.length - 1];
      const all = JSON.stringify(rq.headers) + rq.url + rq.raw;
      ok(new URL(rq.url).host === o.host && rq.headers[o.header].includes(KEYS[id]) && !rq.url.includes(KEYS[id]) && !rq.raw.includes(KEYS[id]), `${o.label}: its own key, in a header, to ${o.host}`);
      ok(Object.keys(KEYS).filter(k => k !== id).every(k => !all.includes(KEYS[k])), `${o.label}: no other provider's key travels with it`);
    }
    await page.click('.prov:has-text("Custom")'); await settle(200);
    await page.fill('#ai-url', 'http://192.168.1.5:8080/v1'); await page.click('#ai-url-save'); await settle(200);
    ok(await ev(() => getCustomUrl() === '' && S.ai.provider === 'custom') && /https:\/\//.test(await page.textContent('.toast')), 'custom server: a plain-http address on the network is refused, with the reason');
    await page.click('.prov:has-text("Claude")'); await settle(200);
    ok(await ev(() => S.ai.provider === 'anthropic' && aiReady()), 'back on Claude');
    await page.click('#ai-set-body button:has-text("Done")'); await settle(350);
    ok(await page.isVisible('#coach-in') && await page.isVisible('.coach-starters'), 'chat box and starters shown once set up');
    const lay = await ev(() => {
      const bar = document.getElementById('coach-bar').getBoundingClientRect(), nav = document.getElementById('nav').getBoundingClientRect();
      const nb = [...document.querySelectorAll('#nav .nb')];
      return { gap: Math.round(nav.top - bar.bottom), six: nb.length, fit: nb.every(b => b.querySelector('span').scrollWidth <= b.clientWidth + 1), navW: Math.round(nav.width), vw: innerWidth,
        last: document.querySelector('.coach-fine').getBoundingClientRect().bottom, threadBottom: document.getElementById('coach-thread').getBoundingClientRect().bottom, scrolls: document.getElementById('coach-thread').scrollHeight >= document.getElementById('coach-thread').clientHeight };
    });
    ok(lay.six === 5 && lay.fit && lay.navW <= lay.vw && await ev(() => [...document.querySelectorAll('#nav .nb')].map(b => b.dataset.tab).join() === 'workout,progress,coach,nutrition,library'), `five tabs, coach in the middle, nothing clipped (${lay.navW}px of ${lay.vw}px)`);
    ok(lay.gap >= 3 && lay.gap <= 9, `message box sits just above the floating tab bar (gap ${lay.gap}px)`);
    await shot('14-coach-empty');
  });

  await step('coach: reads what it needs, logs with Undo, shows what it read', async () => {
    ai.queue.push(claude(text('Let me check.'), use('t1', 'get_nutrition', { days: 1 }), use('t2', 'search_foods', { query: 'egg' })),
      claude(use('t3', 'log_meal', { meal: 'Breakfast', items: [{ food_id: 'qf_egg', servings: 3, kcal: 9999 }] })),
      claude(text('Logged **3 eggs** <img data-xss src=x onerror="window.__xss=1"> — 216 kcal.')));
    const before = await ev(() => ({ n: S.meals.length, kcal: getDayTotals(today()).cals }));
    const mark = ai.log.length;
    await page.fill('#coach-in', 'I had three eggs'); await page.click('#coach-send');
    await coachDone(6); await settle(200);
    const after = await ev(() => ({ n: S.meals.length, kcal: getDayTotals(today()).cals, xss: !!window.__xss || !!document.querySelector('#coach-thread [data-xss]'), box: document.getElementById('coach-in').value }));
    ok(after.n === before.n + 1 && after.kcal === before.kcal + 216, 'meal logged at the food list\'s 216 kcal, not the 9,999 the model sent');
    ok(!after.xss && after.box === '', 'markup in the model\'s reply is shown as text, never run; the box is cleared');
    ok(/Nutrition, today/.test(await page.textContent('.cm-read')) && /egg/.test(await page.textContent('.cm-read')), 'each lookup is shown as a "Read" chip');
    ok(await page.isVisible('.coach-receipt button:has-text("Undo")') && await page.isVisible('.cm-a .cm-b b'), 'receipt with Undo; bold rendered');
    const first = ai.log[mark].body;
    ok(/RULES — these are shown to the user/.test(first.system[0].text) && first.system[0].cache_control && !first.system[1].cache_control && first.tools.length >= 25 && first.messages.length === 1, 'rules and tools sent; conversation starts clean');
    const always = first.system.map(b => b.text).join('\n').split('\n').filter(l => !/^(Routines \(|Active group:)/.test(l)).join('\n'); // routine and group names are sent; here they happen to start with "Smoke"
    ok(!/\b185\b/.test(always) && !always.includes('Smoke'), 'no body weight or name in what is always sent');
    ok(ai.log[mark + 1].body.messages[2].content.every(b => b.type === 'tool_result'), 'tool results go back to the model');
    await shot('15-coach-chat');
    await page.click('.coach-receipt button:has-text("Undo")'); await settle(250);
    ok(await ev(n => S.meals.length === n, before.n) && /Undone/.test(await page.textContent('.coach-receipt')), 'Undo removes the meal and the receipt says so');
  });

  await step('coach: quick workout from a starter', async () => {
    await ev(() => coachNewChat()); await settle(200);
    ai.queue.push(claude(use('g0', 'get_workouts', { days: 3 }), use('g1', 'get_exercise_catalog', { muscle: 'Chest' })),
      claude(use('q1', 'propose_quick_workout', { name: '20-min Push', summary: 'Short and simple.', exercises: [
        { exId: 'bb-bench', name: 'Bench', sets: 3, repsMin: 8, repsMax: 10, rest: 90 }, { exId: 'NEW', name: 'Deficit Push-Up', equipment: 'Bodyweight', muscle: 'Chest', sets: 2, repsMin: 0, amrap: true, rest: 60 }] })),
      claude(text('Tap Start now when you are ready.')));
    const mark = ai.log.length;
    await page.click('.coach-st:has-text("Quick workout")'); await settle();
    ok(await page.isVisible('#wiz-ov'), 'the starter asks three quick questions first');
    await page.click('#wiz-time .chip:has-text("20 minutes")'); await page.fill('#wiz-note', 'hotel gym'); await shot('16-coach-wizard');
    await page.click('#wiz-ov button:has-text("Build it")');
    await coachDone(6); await settle(200);
    const said = ai.log[mark].body.messages[0].content[0].text;
    ok(/20-minute workout/.test(said) && /hotel gym/.test(said), 'choices become the request');
    ok(await ev(() => S.activeWorkout === null) && await page.isVisible('.coach-card:not(.done) button:has-text("Start now")'), 'a card is shown; nothing has started');
    await shot('17-coach-card');
    await page.click('.coach-card button:has-text("Start now")'); await settle(500);
    const w = await ev(() => S.activeWorkout && { tab: S.tab, name: S.activeWorkout.name, n: S.activeWorkout.exercises.length, rid: S.activeWorkout.routineId, sets: S.activeWorkout.exercises[0].sets.filter(x => !x.warmup).length, tgt: S.activeWorkout.exercises[0].target });
    ok(w && w.tab === 'workout' && w.name === '20-min Push' && w.n === 2 && w.rid === null && w.sets === 3 && w.tgt.rMax === '10', 'workout started with its targets, without saving a routine');
    await shot('18-quick-session');
    await ev(() => { S.activeWorkout = null; endSessionTimers(); rebuildPRs(); save(); go('coach'); }); await settle(250);
    ok(/Workout started/.test(await page.textContent('.coach-card.done')), 'the card records that it was used');
  });

  await step('coach: a program is reviewed before it is added', async () => {
    ai.queue.push(claude(use('p1', 'propose_routines', AI_REPLY)), claude(text('Review it and add it if it looks right.')));
    const n0 = await ev(() => Coach.turns.length);
    await page.fill('#coach-in', 'Two full body days, 45 minutes'); await page.click('#coach-send');
    await coachDone(n0 + 4); await settle(200);
    ok(await ev(() => !S.routines.some(r => /^AI Full Body/.test(r.name))), 'proposing saves nothing');
    await page.click('.coach-card:not(.done) button:has-text("Review")'); await settle();
    ok(await page.isVisible('#coach-rv-ov .import-preview'), 'review sheet lists the routines');
    await page.click('#coach-rv-ov .ip-r summary'); await settle(120); await shot('19-coach-review');
    await page.click('#coach-rv-ov button:has-text("Add to my library")'); await settle(500);
    const r = await ev(() => {
      const a = S.routines.find(x => x.name === 'AI Full Body - A'), b2 = S.routines.find(x => x.name === 'AI Full Body - B');
      return { a, b2, g: S.groups.find(x => x.name === 'AI Full Body'), newEx: S.custom.find(c => c.name === 'Cable Lateral Raise') };
    });
    ok(r.a && r.a.exercises[0].exId === 'squat' && r.a.exercises[0].note === 'RPE 8', 'catalog id used, note kept');
    ok(r.newEx && r.newEx.eq === 'Cable' && r.a.exercises[1].exId === r.newEx.id && r.a.exercises[1].rMax === '15', 'NEW exercise created with its range');
    ok(r.a.exercises[2].exId === 'plank' && r.a.exercises[2].timed && r.a.exercises[2].r === '40' && r.a.exercises[2].rMax === '60', 'enum casing tolerated (PLANK, bodyweight, abs); timed range');
    ok(r.b2.exercises[1].amrap === true && r.b2.exercises[1].r === '10', '"10+" AMRAP');
    ok(r.g && r.g.active === false, 'an existing active group is not displaced silently');
    ok(/Added 2 routines and 1 group/.test(await page.textContent('#coach-thread')), 'the card shows what was added');
  });

  await step('meal plan: proposed by the coach, logged with a tap, grocery list, edited by hand', async () => {
    const dow = await ev(() => new Date().getDay());
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow];
    ai.queue.push(claude(use('m0', 'get_profile', {}), use('m00', 'search_foods', { query: 'chicken' })),
      claude(use('m1', 'propose_meal_plan', { mode: 'replace_week', note: 'Simple and repeatable.', days: [{ day: dayName, meals: [
        { meal: 'Breakfast', name: 'Eggs', items: [{ food_id: 'qf_egg', servings: 3 }] },
        { meal: 'Dinner', name: 'Chicken & rice <img data-xss src=x onerror="window.__xss=1">', items: [{ food_id: 'qf_chicken_breast', servings: 2 }, { name: 'Jasmine rice', serving: '1 cup', kcal: 205, protein: 4, carbs: 45, fat: 0.4, servings: 1.5 }] }] }] })),
      claude(text('Tap Use this plan.')));
    const n0 = await ev(() => Coach.turns.length);
    await page.fill('#coach-in', 'plan my meals'); await page.click('#coach-send');
    await coachDone(n0 + 6); await settle(200);
    ok(await ev(() => !planHasMeals()), 'proposing a plan changes nothing');
    await page.click('.coach-card:not(.done) button:has-text("See meals")'); await settle();
    ok(await page.isVisible('#coach-rv-ov .plan-meal') && !(await ev(() => !!window.__xss || !!document.querySelector('[data-xss]'))), 'the meals can be read before deciding; hostile names stay text');
    await shot('20-coach-plan-review'); await closeAll();
    await page.click('.coach-card:not(.done) button:has-text("Use this plan")'); await settle(400);
    ok(await ev(d => S.mealPlan.days[d].length === 2 && S.mealPlan.days.filter(x => x.length).length === 1 && S.mealPlan.note === 'Simple and repeatable.', dow), 'plan saved for the day proposed');
    await page.click('.coach-card.done button:has-text("Open Meal plan")'); await settle(400);
    ok(await ev(() => S.tab === 'nutrition') && await page.isVisible('#plan-ov .plan-meal'), 'the card links straight to the plan');
    // the day names sit in the middle of their pills, all on one line, each with room for its dot
    const days = await ev(() => [...document.querySelectorAll('#plan-ov .plan-days .chip')].map(b => { const r = document.createRange(); r.selectNodeContents(b.firstChild); const t = r.getBoundingClientRect(), bb = b.getBoundingClientRect(); return { off: Math.abs((t.left + t.right) / 2 - (bb.left + bb.right) / 2), top: Math.round(t.top), w: Math.round(bb.width), fits: t.left >= bb.left && t.right <= bb.right, dot: !!b.querySelector('.plan-dot') }; }));
    ok(days.length === 7 && days.every(d => d.off < 1 && d.fits && d.dot) && new Set(days.map(d => d.top)).size === 1 && Math.max(...days.map(d => d.w)) - Math.min(...days.map(d => d.w)) <= 1, `the seven day names are centred in equal pills (furthest off centre: ${Math.max(...days.map(d => d.off)).toFixed(1)} px)`);
    await shot('21-meal-plan-week'); await closeAll();
    const k0 = await ev(() => getDayTotals(today()).cals);
    ok(await page.locator('#plan-card .plan-row').count() === 2, 'today\'s planned meals are on the Nutrition tab');
    await page.click('#plan-card .plan-row >> nth=0 >> button:has-text("Log")'); await settle(350);
    ok(await ev(k => getDayTotals(today()).cals === k + 216, k0) && await page.locator('#plan-card .plan-done').count() === 1, 'one tap logs the planned meal and marks it logged');
    await ev(() => document.getElementById('plan-card').scrollIntoView()); await shot('22-nutrition-plan');
    await ev(() => showGroceryList()); await settle();
    ok(await page.locator('#grocery-ov .groc-row').count() === 3 && /3 eggs/.test(await page.textContent('#grocery-ov')) && /8 oz/.test(await page.textContent('#grocery-ov')), 'grocery list adds up the week (3 eggs, 8 oz chicken, rice)');
    await page.click('#grocery-ov .groc-row >> nth=0 >> input'); await settle(150);
    ok(await ev(() => Object.keys(S.mealPlan.checked).length === 1) && await page.locator('#grocery-ov .groc-row.got').count() === 1, 'ticks are remembered');
    await shot('23-grocery'); await closeAll();
    const logged = await ev(() => S.meals.length);
    await ev(() => showMealPlan()); await settle();
    await page.click('#plan-ov button:has-text("Add a meal")'); await settle();
    ok(await page.isVisible('#plan-meal-name') && !(await page.isVisible('#meal-date')), 'the meal builder opens in plan mode');
    await ev(() => addFoodToMeal('qf_popcorn')); await page.fill('#plan-meal-name', 'Movie snack');
    await page.click('#meal-types .chip:has-text("Snack")');
    await page.click('#meal-ov button:has-text("Add to plan")'); await settle(400);
    ok(await ev(([d, n]) => S.mealPlan.days[d].length === 3 && S.mealPlan.days[d].some(m => m.name === 'Movie snack' && m.type === 'Snack') && S.meals.length === n, [dow, logged]), 'added to the plan by hand; nothing was logged');
    await closeAll();
  });

  await step('coach: errors, permissions and the rules sheet', async () => {
    await ev(() => go('coach')); await settle(200);
    ai.queue.push({ status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key ' + KEYS.anthropic } } });
    const n0 = await ev(() => Coach.turns.length);
    await page.fill('#coach-in', 'hello'); await page.click('#coach-send');
    await coachDone(n0 + 1); await settle(200);
    ok(await page.isVisible('.coach-err') && /rejected the API key/.test(await page.textContent('.coach-err')), 'a rejected key is explained');
    ok(!(await ev(k => document.documentElement.outerHTML.includes(k) || localStorage.getItem('lahwe_coach_v1').includes(k), KEYS.anthropic)), 'the key the provider echoed back is not shown or stored');
    ai.queue.push(claude(text('Hi.')));
    await page.click('.coach-err button:has-text("Try again")'); await coachDone(n0 + 2); await settle(150);
    ok(await ev(() => !Coach.error), 'Try again resumes the same message');
    await page.click('.coach-model'); await settle();
    await page.click('#ai-set-body [aria-label="Log access"]'); await settle(200);
    ok(await ev(() => S.ai.logAccess === false), 'log access can be switched off');
    await closeAll();
    ai.queue.push(claude(text('I cannot see your logs.')));
    const n1 = await ev(() => Coach.turns.length);
    await page.fill('#coach-in', 'how was my week?'); await page.click('#coach-send'); await coachDone(n1 + 2);
    const names = ai.log[ai.log.length - 1].body.tools.map(t => t.name);
    ok(!names.includes('get_workouts') && !names.includes('get_nutrition') && !names.includes('get_body') && names.includes('get_routines') && /Log access: OFF/.test(ai.log[ai.log.length - 1].body.system[1].text), 'with it off, the history tools are not even offered to the model');
    await ev(() => { S.ai.logAccess = true; save(); showCoachRules(); }); await settle();
    ok(await page.locator('#rules-ov .rule').count() >= 9 && /Never invent or guess a number/.test(await ev(() => document.getElementById('rules-ov').textContent)), 'the rules sheet shows the exact instructions');
    await shot('24-coach-rules'); await closeAll();
    await ev(() => { toggleDark(); go('coach'); }); await settle(300); await shot('25-coach-dark'); await ev(() => toggleDark());
  });

  await step('coach: shortcuts, a photo, held changes, model list, custom server, small screens', async () => {
    // shortcuts from other screens land in the coach with the right request
    await ev(() => { go('library'); setLibTab('routines'); }); await settle(150);
    await page.click('button:has-text("Build with coach")'); await settle(300);
    ok(await ev(() => S.tab === 'coach') && await page.isVisible('#wiz-ov >> text=Build a program'), 'Library → "Build with coach" opens the program questions in the coach');
    await closeAll();
    ai.queue.push(claude(use('h1', 'get_exercise_history', { exercise: 'bench press' })), claude(text('Bench is moving.')));
    let n0 = await ev(() => Coach.turns.length);
    await ev(() => { go('library'); setLibTab('exercises'); showExDetail('bb-bench'); }); await settle();
    await page.click('#exd-ov button:has-text("Ask the coach")'); await coachDone(n0 + 4); await settle(150);
    ok(await ev(() => S.tab === 'coach') && /Barbell Bench Press history|Bench Press history/.test(await page.textContent('#coach-thread')), 'exercise detail → "Ask the coach" sends the question and the coach reads that lift');
    await ev(() => go('workout')); await settle(150);
    await page.click('.hc-chips button:has-text("Quick workout")'); await settle(300);
    ok(await page.isVisible('#wiz-ov >> text=How long?'), 'home → Quick workout');
    await closeAll(); await ev(() => go('coach')); await settle(200);

    // a photo: resized in the browser, sent once, never stored
    ai.queue.push(claude(text('That looks like about 600 kcal — an estimate. Want me to log it?')));
    n0 = await ev(() => Coach.turns.length);
    await page.setInputFiles('#coach-file', path.join(DIST, 'icon-512.png')); await page.waitForSelector('#coach-attach .ai-chip', { timeout: 8000 });
    await page.fill('#coach-in', 'what is this meal?'); await page.click('#coach-send'); await coachDone(n0 + 2); await settle(150);
    const img = ai.log[ai.log.length - 1].body.messages.slice(-1)[0].content[0];
    ok(img.type === 'image' && img.source.media_type === 'image/jpeg' && img.source.data.length > 500, 'the photo is sent to the model as a JPEG');
    ok(await ev(d => !localStorage.getItem('lahwe_coach_v1').includes(d.slice(0, 60)) && Coach.turns.every(t => !(t.attachments || []).some(a => a.data)), img.source.data), 'and its bytes are kept nowhere afterwards');

    // "apply small changes at once" off → even a meal waits for a tap
    await ev(() => { S.ai.instant = false; save(); });
    ai.queue.push(claude(use('i1', 'log_meal', { meal: 'Snack', items: [{ food_id: 'qf_popcorn', servings: 1 }] })), claude(text('Tap Apply to log it.')));
    n0 = await ev(() => Coach.turns.length); const m0 = await ev(() => S.meals.length);
    await page.fill('#coach-in', 'log popcorn'); await page.click('#coach-send'); await coachDone(n0 + 4); await settle(150);
    ok(await ev(n => S.meals.length === n, m0) && await page.isVisible('.coach-card:not(.done) button:has-text("Apply")'), 'held for approval; nothing logged yet');
    await page.click('.coach-card:not(.done) button:has-text("Apply")'); await settle(300);
    ok(await ev(n => S.meals.length === n + 1, m0), 'logged on tap');
    await ev(() => { S.ai.instant = true; save(); });

    // model list from the provider
    await ev(() => showAiSettings()); await settle();
    ai.queue.push({ body: { data: [{ id: 'claude-sonnet-5-5', display_name: 'Claude Sonnet 5.5' }, { id: 'claude-new-9', display_name: 'Claude New 9' }] } });
    await page.click('#ai-load'); await page.waitForSelector('#ai-test-out .ai-ok', { timeout: 8000 });
    ok(ai.log[ai.log.length - 1].method === 'GET' && await page.locator('#ai-model option[value="claude-new-9"]').count() === 1, '"List my models" adds what this key can use');
    await page.selectOption('#ai-model', 'claude-new-9'); await settle(200);
    ok(await ev(() => aiModelFor('anthropic') === 'claude-new-9'), 'a listed model can be chosen');
    await page.selectOption('#ai-model', '__other'); await page.fill('#ai-model-id', 'claude-sonnet-5-5'); await page.click('#ai-model-use'); await settle(200);
    ok(await ev(() => aiModelFor('anthropic') === 'claude-sonnet-5-5'), 'or typed by name');

    // your own server
    await page.click('.prov:has-text("Custom")'); await settle(200);
    await page.fill('#ai-url', 'https://llm.example.test/v1/'); await page.click('#ai-url-save'); await settle(200);
    await page.fill('#ai-model-id', 'my-local-model'); await page.click('#ai-model-use'); await settle(200);
    ai.queue.push({ body: { choices: [{ message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }] } });
    await page.click('#ai-test'); await page.waitForSelector('#ai-test-out .ai-ok', { timeout: 8000 });
    let rq = ai.log[ai.log.length - 1];
    ok(rq.url === 'https://llm.example.test/v1/chat/completions' && rq.body.model === 'my-local-model' && !rq.headers.authorization && Object.values(KEYS).every(k => !JSON.stringify(rq.headers).includes(k)), 'custom server: works with no key, and no other provider\'s key is sent to it');
    await page.click('.prov:has-text("Claude")'); await settle(200); await closeAll();

    // the smallest phone still in use
    await page.setViewportSize({ width: 320, height: 568 }); await ev(() => go('coach')); await settle(300);
    const small = await ev(() => { const nb = [...document.querySelectorAll('#nav .nb')]; const bar = document.getElementById('coach-bar').getBoundingClientRect(), nav = document.getElementById('nav').getBoundingClientRect();
      const labels = nb.map(b => b.querySelector('span').getBoundingClientRect());
      return { fit: nb.every(b => b.querySelector('span').scrollWidth <= b.clientWidth + 1), apart: Math.round(Math.min(...labels.slice(1).map((r, i) => r.left - labels[i].right))), over: document.documentElement.scrollWidth > innerWidth + 1, gap: Math.round(nav.top - bar.bottom),
        send: document.getElementById('coach-send').getBoundingClientRect().right <= innerWidth, head: [...document.querySelectorAll('.coach-head button')].every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }) }; });
    ok(small.fit && small.apart >= 3 && !small.over && small.send && small.head && small.gap >= 3 && small.gap <= 9, `at 320 px wide the tabs, the header buttons and the message box all fit (${JSON.stringify(small)})`);
    await shot('26-coach-320');
    await ev(() => go('workout')); await settle(200); await shot('27-home-320');
    await page.setViewportSize(devices['iPhone 13'].viewport); await settle(200);
    await ev(() => go('workout')); await settle(200); await shot('28-home-coach-card');
    ok(ai.log.every(r => /^(api\.anthropic\.com|api\.openai\.com|generativelanguage\.googleapis\.com|openrouter\.ai|llm\.example\.test)$/.test(new URL(r.url).host)), 'every AI request in this run went to the provider that was selected');
  });

  await step('coach history: earlier chats and everything it made', async () => {
    await ev(() => go('coach')); await settle(200);
    const cur = await ev(() => Coach.turns.filter(t => t.role === 'user').length);
    await page.click('.coach-head button:has-text("Chats")'); await page.waitForSelector('#chats-body .seg', { timeout: 5000 }); await settle(150);
    const rows = await page.locator('#chats-body .chat-row').count();
    ok(cur > 0 && rows >= 2 && /Open now/.test(await page.textContent('#chats-body .chat-row >> nth=0')) && /I had three eggs/.test(await page.textContent('#chats-body')), `the open chat and the earlier one are both listed (${rows})`);
    await shot('29-coach-chats');
    await page.click('#chats-body .seg-b:has-text("Made by coach")'); await settle(200);
    const made = await ev(() => coachAllMade().map(m => m.kind + '/' + m.status));
    ok(made.includes('Program/Used') && made.includes('Meal plan/Used') && made.includes('Workout/Used') && made.includes('Meal logged/Undone') && await page.locator('#chats-body .chat-row').count() === made.length, 'programs, workouts, meal plans and logged items are listed with what became of them');
    await shot('30-coach-made');
    // jump to the meal that was logged in the first chat
    const openId = await ev(() => Coach.id);
    await page.click('#chats-body .chat-row:has-text("Breakfast")'); await settle(500);
    ok(await ev(id => Coach.id !== id && Coach.turns[0].text === 'I had three eggs' && Coach.archive.some(c => c.id === id), openId), 'tapping it opens the chat it came from, and the chat that was open is kept');
    ok(await ev(() => { const el = document.querySelector('.coach-receipt'); const r = el.getBoundingClientRect(), t = document.getElementById('coach-thread').getBoundingClientRect(); return r.top >= t.top - 2 && r.bottom <= t.bottom + 2; }), 'and scrolls to the thing itself');
    // a used program can be looked at again, read-only
    await page.click('.coach-head button:has-text("Chats")'); await page.waitForSelector('#chats-body .seg'); await page.click('#chats-body .seg-b:has-text("Made by coach")'); await settle(200);
    await page.click('#chats-body .chat-row:has-text("2 routines")'); await settle(500);
    await page.click('.coach-card.done button:has-text("See it")'); await settle();
    ok(await page.isVisible('#coach-rv-ov .import-preview') && !(await page.isVisible('#coach-rv-ov button:has-text("Add to my library")')), 'a used program opens for reading, with no way to add it twice by accident');
    await closeAll();
    const n = await ev(() => S.routines.length);
    await page.click('.coach-card.done:has-text("2 routines") button:has-text("Use again")'); await settle(250);
    ok(await page.isVisible('.coach-card:not(.done) button:has-text("Review")') && await ev(k => S.routines.length === k, n), '"Use again" puts the card back on the table without changing anything');
    await page.click('.coach-card:not(.done):has-text("2 routines") button:has-text("Dismiss")'); await settle(200);
    await ev(() => coachNewChat()); await settle(300);
    ok(await ev(() => Coach.turns.length === 0 && Coach.archive.length >= 2), '"New" saves the chat instead of throwing it away');
    await page.reload({ waitUntil: 'load' }); await settle(700);
    await ev(() => go('coach')); await settle(300);
    await page.click('.coach-head button:has-text("Chats")'); await page.waitForSelector('#chats-body .seg'); await settle(150);
    ok(await page.locator('#chats-body .chat-row').count() >= 2 && await ev(k => !JSON.stringify(Coach.archive).includes(k), KEYS.anthropic), 'saved chats survive a relaunch and hold no key');
    await page.click('#chats-body .chat-row >> nth=0 >> .delbtn'); await settle(250);
    ok(await page.isVisible('.toast-btn'), 'deleting a chat can be undone');
    await page.click('.toast-btn'); await settle(250); await closeAll();
  });

  await step('reminders and install', async () => {
    await ev(() => { go('workout'); showSettings(); }); await settle();
    await page.click('#set-ov button[onclick="showReminders()"]'); await settle();
    ok(await page.isVisible('#rem-ov') && await page.isDisabled('#rem-ov button:has-text("Add to my calendar")'), 'nothing to add until a reminder is on');
    await page.click('#rem-ov [aria-label="Workout reminder"]'); await settle(200);
    await page.click('#rem-ov .rem-days .chip:has-text("We")'); await settle(150);
    await page.fill('#rem-ov input[type=time] >> nth=0', '06:15'); await page.dispatchEvent('#rem-ov input[type=time] >> nth=0', 'change'); await settle(150);
    ok(await ev(() => S.reminders.workout.on && S.reminders.workout.time === '06:15' && S.reminders.workout.days.includes(3)), 'time and days are saved');
    await shot('31-reminders');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#rem-ov button:has-text("Add to my calendar")')]);
    const icsFile = path.join(OUT, 'reminders.ics'); await dl.saveAs(icsFile);
    const ics = fs.readFileSync(icsFile, 'utf8');
    ok(dl.suggestedFilename() === 'lahwe-reminders.ics' && /BEGIN:VCALENDAR/.test(ics) && /RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/.test(ics) && /DTSTART:\d{8}T061500\r\n/.test(ics) && /BEGIN:VALARM/.test(ics), 'a calendar file with the repeating alert is produced');
    await closeAll();
    await ev(() => showInstallHelp()); await settle();
    ok(/Add to Home Screen/.test(await page.textContent('#install-ov')) && await page.isVisible('#install-ov button:has-text("Download lahwe.html")'), 'install steps, and the single-file download when served from a web address');
    const [app] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#install-ov button:has-text("Download lahwe.html")')]);
    const appFile = path.join(OUT, 'downloaded-app.html'); await app.saveAs(appFile);
    ok(fs.statSync(appFile).size > 500000 && Object.values(KEYS).every(k => !fs.readFileSync(appFile, 'utf8').includes(k)), 'the downloaded app file is the whole app and carries no key');
    await shot('32-install'); await closeAll();
  });

  await step('settings, backup, restore, undo', async () => {
    await ev(() => { go('workout'); showSettings(); }); await settle(); await shot('14-settings');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), ev(() => { exportData(); })]);
    const file = path.join(OUT, 'backup.json'); await dl.saveAs(file);
    const bk = JSON.parse(fs.readFileSync(file, 'utf8'));
    const bkText = fs.readFileSync(file, 'utf8');
    ok(bk._app === 'lahwe' && bk.workouts.length === 1 && Object.values(KEYS).every(k => !bkText.includes(k)) && !/sk-ant-|sk-or-|sk-proj-|AIza/.test(bkText), 'backup written; none of the four API keys is in it');
    ok(bk.mealPlan && bk.mealPlan.days.some(d => d.length) && bk.ai && Object.keys(bk.ai).sort().join() === 'instant,logAccess,models,provider' && !bkText.includes('I had three eggs'), 'backup has the meal plan and AI choices, but not the chat');
    ok(await ev(() => S.lastExportAt > 0), 'backup date recorded');
    await closeAll();
    // restore an old-format backup through the real file picker
    const legacyFile = path.join(OUT, 'legacy-backup.json'); fs.writeFileSync(legacyFile, JSON.stringify(legacyState()));
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), ev(() => { importData(); })]);
    await chooser.setFiles(legacyFile); await settle(400);
    ok(await page.isVisible('#confirm-ov'), 'restore asks first and shows what will be replaced');
    await shot('15-restore-confirm');
    await page.click('#confirm-ov button:has-text("Replace my data")'); await settle(700);
    const m = await ev(() => ({
      schema: S._schema, n: S.workouts.length, sorted: S.workouts[0].started > S.workouts[1].started,
      bench: S.prs['bb-bench'], manual: S.prsManual['bb-bench'], squatManual: S.prsManual['squat'],
      long: S.workouts.find(w => w.id === 'wLong'), cals: S.macroGoals.cals, grp: S.groups[0].routineIds,
      food: S.customFoods[0].id, starred: S.starredFoods[0], sec: SEC_MUSCLE['custom-old1'], name: document.getElementById('content').innerHTML.includes('<b>User</b>'),
      totals: getDayTotals(today()),
    }));
    ok(m.schema === 3 && m.n === 3 && m.sorted, 'legacy save normalised and sorted');
    ok(m.manual && m.manual.w === 405 && m.bench.manual === true, 'PR with no workout behind it is kept as "carried over"');
    ok(!m.squatManual, 'PR that history already explains is not duplicated');
    ok(m.long.calsCapped && m.long.cals < 1300, `6-hour session capped (${m.long.cals} kcal, was 2265)`);
    ok(m.cals === 2400 && JSON.stringify(m.grp) === '["r1"]', 'old field names and dangling routine ids repaired');
    ok(m.food === 'cf_1234' && m.starred === 'cf_1234', 'unsafe food id cleaned everywhere it is referenced');
    ok(JSON.stringify(m.sec) === '["Calves"]', 'custom exercise secondary muscles rehydrated');
    ok(!m.name, 'name containing markup is escaped on the home screen');
    await shot('16-restored-home');
    for (const t of ['history', 'progress', 'nutrition', 'library', 'workout']) { await ev(t => go(t), t); await settle(200); }
    await ev(() => { go('progress'); }); await settle(400);
    await shot('17-restored-progress');
    await ev(() => { go('workout'); showSettings(); }); await settle();
    ok(await page.isVisible('text=Undo last restore'), 'undo is offered');
    await page.click('text=Undo last restore'); await settle(300);
    ok(await page.isVisible('#confirm-ov'), 'undo asks first and shows both sides');
    await page.click('#confirm-ov button:has-text("Bring back the earlier data")'); await settle(700);
    ok(await ev(() => S.name === 'Smoke' && S.workouts.length === 1 && S.routines.length >= 4), 'undo brings back the previous data');
  });

  await step('units: convert on switch', async () => {
    await ev(() => { showSettings(); setUnit('kg'); }); await settle();
    ok(await page.isVisible('#unit-ov'), 'asks what the stored numbers mean');
    await page.click('#unit-ov button:has-text("Convert everything")'); await settle(400);
    const u = await ev(() => ({ unit: S.unit, w: S.workouts[0].exercises[0].sets.find(s => !s.warmup).w, bw: S.bodyweight, pr: S.prs['bb-bench'].w }));
    ok(u.unit === 'kg' && u.w === '84' && Math.abs(u.bw - 83.9) < 0.2 && u.pr === 84, `185 lb → ${u.w} kg, bodyweight ${u.bw} kg`);
    await ev(() => applyUnit('lbs', true)); await settle(300); await closeAll();
  });

  await step('3.3: swap, targets, weekly check-in, test-date plan, music setup', async () => {
    await closeAll();
    await ev(() => { if (S.activeWorkout) { S.activeWorkout = null; endSessionTimers(); } go('workout'); }); await settle(300);
    const rid = await ev(() => { const r = S.routines.find(x => x.exercises.length >= 2 && x.exercises.every(e => getEx(e.exId))); return r && r.id; });
    ok(!!rid, 'a routine to work with');
    const before = ai.log.length;
    // home: week card and quick actions at the smallest width, nothing wider than the screen
    ok(await page.isVisible('.wk-card') && await page.isVisible('.qa') && await page.isVisible('.hero'), 'home shows the hero, the week card and quick actions');
    for (const w of [320, 390]) {
      await page.setViewportSize({ width: w, height: 664 }); await settle(150);
      const over = await ev(() => { const c = document.getElementById('content'); return [...c.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && !e.closest('.hc-chips'); }).map(e => e.className || e.tagName).slice(0, 4); });
      ok(over.length === 0, `home fits at ${w}px` + (over.length ? ': ' + over.join(', ') : ''));
    }
    await page.click('.wk-card'); await settle();
    ok(await page.isVisible('#week-ov >> text=Weekly check-in') && await page.isVisible('#week-ov .st-grid'), 'tapping the week card opens the check-in');
    await shot('40-week'); await closeAll();
    // targets sheet
    await ev(id => showTargets(id), rid); await settle();
    ok(await page.isVisible('#tg-ov .list') && await page.isVisible('#tg-ov button:has-text("Ask the coach"), #tg-ov button:has-text("Set up the coach")') || await page.isVisible('#tg-ov .list'), 'targets sheet lists the routine');
    await shot('41-targets'); await closeAll();
    // live workout: aim chip, swap sheet, swap, undo, exercise menu
    await ev(id => startWorkout(id), rid); await settle(400);
    const first = await ev(() => S.activeWorkout.exercises[0].exId);
    ok(await page.isVisible('#exb-0 button[aria-label="Swap exercise"]') && await page.isVisible('#exb-0 button[aria-label="More for this exercise"]'), 'each lift has Swap and a More menu');
    const wraps = await ev(() => [...document.querySelectorAll('.exb-acts')].some(a => { const tops = [...a.querySelectorAll('button')].map(c => Math.round(c.getBoundingClientRect().top)); return Math.max(...tops) - Math.min(...tops) > 6; }));
    ok(!wraps, 'the action row stays on one line');
    await page.setViewportSize({ width: 320, height: 568 }); await settle(150);
    const small = await ev(() => ({ wraps: [...document.querySelectorAll('.exb-acts')].some(a => { const t = [...a.querySelectorAll('button')].map(c => Math.round(c.getBoundingClientRect().top)); return Math.max(...t) - Math.min(...t) > 6; }),
      over: [...document.querySelectorAll('#content *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }).map(e => e.className || e.tagName).slice(0, 4) }));
    ok(!small.wraps && small.over.length === 0, 'the workout fits a 320px phone' + (small.over.length ? ': ' + small.over.join(', ') : ''));
    await page.setViewportSize({ width: 390, height: 664 }); await settle(150);
    await page.click('#exb-0 button[aria-label="Swap exercise"]'); await settle();
    const offered = await page.locator('#swap-ov .row-tap').count();
    ok(offered >= 1, `swap sheet offers substitutes (${offered})`);
    await shot('42-swap');
    await page.click('#swap-ov .row-tap >> nth=0'); await settle(400);
    const after = await ev(() => S.activeWorkout.exercises[0].exId);
    ok(after !== first && await ev(f => !S.activeWorkout.exercises.some(e => e.exId === f), first), 'tapping one replaces the lift');
    ok(await page.isVisible('#exb-0 >> text=in for'), 'the card says what it replaced');
    await page.click('.toast-btn'); await settle(300);
    ok(await ev(f => S.activeWorkout.exercises[0].exId === f, first), 'Undo puts the original back');
    await page.click('#exb-0 button[aria-label="More for this exercise"]'); await settle();
    ok(await page.isVisible('#exm-ov >> text=Remove from this workout') && await page.isVisible('#exm-ov >> text=Move down'), 'More menu holds move and remove');
    await closeAll();
    await shot('43-session');
    await ev(() => { S.activeWorkout = null; endSessionTimers(); rebuildPRs(); save(); go('workout'); }); await settle(200);
    // test-date plan
    await ev(() => showTestPlan()); await settle();
    ok(await page.isVisible('#tp-ov >> text=Plan for a test date'), 'no plan yet: the sheet explains it');
    await page.click('#tp-ov .chip:has-text("8 weeks")'); await page.click('#tp-ov button:has-text("Build the plan")'); await settle(300);
    ok(await ev(() => !!S.testPlan && testPlanCalc().weeks === 8) && await page.isVisible('#tp-ov >> text=Checkpoints for this week'), 'picking 8 weeks builds the plan');
    await shot('44-testplan'); await closeAll();
    ok(await page.isVisible('.tp-card >> text=days to your test'), 'the countdown is on the home screen');
    await ev(() => openAftCard()); await settle(350);
    ok(await page.isVisible('#metric-ov .tp-row'), 'and on the fitness-test sheet');
    await closeAll();
    await ev(() => { S.testPlan = null; save(); go('workout'); }); await settle(200);
    // music: setup sheet, bad ID refused, nothing sent anywhere
    await ev(() => showMusicSetup()); await settle();
    ok(await page.isVisible('#mu-ov >> text=Spotify Premium') && await page.isDisabled('#mu-connect'), 'music setup explains what is needed; Connect is off without an ID');
    const uri = await page.inputValue('#mu-uri');
    ok(uri === base, `the redirect address shown is this page (${uri})`);
    await page.fill('#mu-id', 'not-an-id'); await page.click('#mu-save'); await settle(200);
    ok(await page.isVisible('#mu-ov .coach-err') && await ev(() => !musicRead().clientId), 'a malformed client ID is refused');
    await page.fill('#mu-id', 'ab12'.repeat(8)); await page.click('#mu-save'); await settle(200);
    ok(await ev(() => musicRead().clientId === 'ab12'.repeat(8)) && await page.isEnabled('#mu-connect'), 'a well-formed one is saved on the device');
    ok(await ev(() => !JSON.stringify(S).includes('ab12ab12') && !backupJSON().includes('ab12ab12')), 'and is in neither the app state nor a backup');
    await shot('45-music');
    await ev(() => { musicClear(); }); await closeAll();
    ok(ai.log.length === before, 'none of this called an AI provider');
    await page.setViewportSize({ width: 390, height: 664 });
  });

  await step('3.4: nutrition — what is left, quick log amount, edit a meal, past days, own foods, rest-day targets', async () => {
    await closeAll();
    await ev(() => { S.meals = S.meals.filter(m => m.date !== today()); S.macroLogs = {}; S.restGoals = null; S.dayKind = {}; S.macroGoals = { protein: 180, carbs: 250, fat: 70, cals: 2400 }; S.starredFoods = ['qf_chicken_breast', 'qf_greek_yogurt']; save(); go('nutrition'); }); await settle(300);
    ok(await page.textContent('.nut-big') === '2,400' && await page.isVisible('.nut-sub >> text=kcal left'), 'nothing eaten: the whole target is left');
    ok(!(await page.isVisible('.sec-h >> text=Fits what’s left')) && await page.locator('.qa-2 button').count() === 2, 'before the first meal: two buttons, and no "fits" list yet');
    // quick log with an amount
    await page.click('.food-tile:has-text("Chicken Breast")'); await settle();
    await page.click('#mtype-ov button[aria-label="More"]'); await page.click('#mtype-ov button[aria-label="More"]'); await settle(150);
    ok(await page.inputValue('#ql-qty') === '2', 'the amount steps in halves');
    const tiles = await page.textContent('#ql-macros');
    await page.click('#mtype-ov .type-grid button:has-text("Lunch")'); await settle(350);
    const m = await ev(() => S.meals.find(x => x.date === today()));
    const perServing = await ev(() => findFood('qf_chicken_breast').cals);
    ok(m && m.type === 'Lunch' && m.items[0].qty === 2 && m.cals === Math.round(perServing * 2) && tiles.includes(String(m.cals)), `two servings logged as lunch (${m && m.cals} kcal), matching what the sheet showed`);
    ok(await page.textContent('.nut-big') === (2400 - m.cals).toLocaleString(), 'the number left drops by exactly that');
    ok(await page.isVisible('.sec-h >> text=Fits what’s left') && await page.locator('.list .row-tap:has(.aim-v)').count() >= 1, 'once something is logged, suggestions from your own foods are offered');
    ok(await ev(() => { const y = s => { const e = [...document.querySelectorAll('#content .sec-h')].find(x => x.textContent.includes(s)); return e ? e.getBoundingClientRect().top : -1; }; return y('Today’s meals') > 0 && y('Today’s meals') < y('Starred') && y('Starred') < y('Fits what’s left'); }), 'today’s meals sit directly under the buttons, above the quick-add tiles and the suggestions');
    // edit the meal: change the amount
    await page.click('.meal-group .row-tap'); await settle(350);
    ok(await page.isVisible('#meal-ov >> text=Edit meal') && await ev(() => _mealItems.length === 1 && _mealItems[0].qty === 2), 'tapping a meal opens it for editing with its items');
    await page.click('#meal-items-list button[aria-label="More"]'); await settle(150);
    ok(await page.locator('#meal-types .chip.on').textContent() === 'Lunch', 'the sheet shows which meal it is');
    await page.click('#meal-types .chip:has-text("Dinner")');
    await page.click('#meal-ov button:has-text("Save changes")'); await settle(400);
    ok(!(await page.isVisible('#mtype-ov')), 'saving does not open a second sheet');
    const m2 = await ev(id => S.meals.find(x => x.id === id), m.id);
    ok(m2 && m2.type === 'Dinner' && m2.items[0].qty === 2.5 && await ev(() => S.meals.filter(x => x.date === today()).length === 1), 'saved in place: same meal, new amount and meal type, no duplicate');
    await page.click('.toast-btn'); await settle(300);
    ok(await ev(id => { const x = S.meals.find(y => y.id === id); return x.type === 'Lunch' && x.items[0].qty === 2; }, m.id), 'Undo restores the meal as it was');
    // a new food made by hand, from a search that found nothing
    await ev(() => showAddMeal()); await settle();
    await page.fill('#food-search', 'Zzz Protein Puff'); await settle(200);
    await page.click('#food-list .new-food'); await settle(350);
    ok(await page.inputValue('#fe-name') === 'Zzz Protein Puff', 'a search with no match offers to create the food, name filled in');
    await page.fill('#fe-serving', '1 bag'); await page.fill('#fe-pro', '21'); await page.fill('#fe-carb', '5'); await page.fill('#fe-fat', '3');
    await page.click('#food-ov button:has-text("Save food")'); await settle(400);
    ok(await page.isVisible('#food-list >> text=Zzz Protein Puff') && await page.isVisible('#food-list button[aria-label="Edit Zzz Protein Puff"]'), 'it appears in the list at once, with an edit button');
    await page.click('#food-list button[aria-label="Edit Zzz Protein Puff"]'); await settle(300);
    await page.click('#food-ov button:has-text("Delete this food")'); await settle(400);
    ok(await ev(() => !S.customFoods.some(f => f.name === 'Zzz Protein Puff')), 'and can be deleted');
    await page.click('.toast-btn'); await settle(300);
    ok(await ev(() => S.customFoods.some(f => f.name === 'Zzz Protein Puff')), 'with Undo');
    await closeAll();
    // rest-day targets
    await ev(() => showMacroGoals()); await settle();
    await page.click('#mg-rest-tog'); await settle(200);
    ok(await page.inputValue('#mr-carb') === '190' && await page.inputValue('#mr-cal') === '2160', 'switching rest-day targets on fills in a suggestion');
    await page.click('#mg-ov button:has-text("Save Goals")'); await settle(400);
    ok(await ev(() => S.restGoals && S.restGoals.cals === 2160) && await page.isVisible('.kind-chip'), 'saved; the day now shows whether it is a training or a rest day');
    const kind = await ev(() => dayKind());
    await page.click('.kind-chip'); await settle(300);
    ok(await ev(k => dayKind() !== k, kind) && await page.isVisible(`.nut-sub >> text=of ${kind === 'rest' ? '2,400' : '2,160'}`), 'tapping it flips the day and its target');
    // an earlier day
    await ev(() => { S.meals.push({ id: 'old1', date: daysAgoStr(2), type: 'Dinner', name: 'Dinner', protein: 40, carbs: 50, fat: 20, cals: 540 }); save(); renderNutrition(document.getElementById('content')); }); await settle(200);
    await page.click('.nut-day button[aria-label="Previous day"]'); await page.click('.nut-day button[aria-label="Previous day"]'); await settle(300);
    ok(await page.isVisible('.nut-sub >> text=540 eaten') && await page.isVisible('.nut-note >> text=Back to today') && await page.isVisible('.meal-group >> text=Macros entered by hand'), 'two days back shows that day’s meal and says which day is on screen');
    await page.click('.food-tile:has-text("Greek Yogurt")'); await settle();
    await page.click('#mtype-ov .type-grid button:has-text("Snack")'); await settle(350);
    ok(await ev(() => S.meals.filter(x => x.date === daysAgoStr(2)).length === 2 && S.meals.filter(x => x.date === today()).length === 1), 'logging while a past day is showing goes to that day, not today');
    ok(await page.isDisabled('.nut-day button[aria-label="Next day"]') === false, 'forward is available from a past day');
    await ev(() => go('workout')); await ev(() => go('nutrition')); await settle(200);
    ok(await page.isVisible('.nut-day-t >> text=Today') && await page.isDisabled('.nut-day button[aria-label="Next day"]'), 'coming back to the tab starts on today, and there is no stepping into tomorrow');
    // ── log by weight, in the one-sheet builder ──
    await ev(() => { S.meals = S.meals.filter(m => m.date !== today()); S.foodUnits = {}; save(); showAddMeal(); }); await settle(350);
    ok(await page.locator('#ftab-starred.on').count() === 1 && await page.locator('#food-list .hi').count() === 2, 'the builder opens on starred foods when there are some');
    const box = await ev(() => { const r = id => document.querySelector(id).getBoundingClientRect(); return { list: r('#food-list').height, sheet: r('.meal-sheet').height, foot: r('.ms-foot').bottom, vh: innerHeight }; });
    ok(box.list > 260 && box.foot <= box.vh + 1, `the food list gets the room that is left (${Math.round(box.list)} px of a ${Math.round(box.sheet)} px sheet), with the button on screen`);
    await page.click('#food-list .hi:has-text("Chicken Breast")'); await settle(200);
    ok(await page.isVisible('#food-list .hi-in >> text=In meal') && await page.inputValue('#mi-q-0') === '1', 'a tapped food joins the meal and is marked in the list');
    await page.selectOption('#mi-u-0', 'g'); await settle(150);
    ok(await page.inputValue('#mi-q-0') === '113', 'switching to grams shows the same amount of food (4 oz is 113 g)');
    await page.fill('#mi-q-0', '200'); await settle(150);
    const per = await ev(() => findFood('qf_chicken_breast'));
    const want = Math.round(per.cals * 200 / 113.4);
    ok(await page.textContent('#mi-k-0') === want + ' kcal' && (await page.textContent('#meal-total')).startsWith(want + ' kcal'), `typing 200 g updates the item and the total as you type (${want} kcal)`);
    ok(await ev(() => document.activeElement && document.activeElement.id === 'mi-q-0'), 'and the cursor stays in the box');
    await page.click('#meal-items-list button[aria-label="More"]'); await settle(150);
    ok(await page.inputValue('#mi-q-0') === '210', 'the + button steps a weighed food by 10 g');
    await page.fill('#mi-q-0', '200');
    await page.click('#ftab-manual'); await settle(150);
    ok(await page.isVisible('#manual-entry') && !(await page.isVisible('#food-list')), 'By hand is a tab in the same sheet');
    await page.fill('#meal-pro', '10'); await settle(150);
    ok(await page.isVisible('#meal-items-list .mi-hand >> text=40 kcal') && (await page.textContent('#meal-total')).startsWith((want + 40) + ' kcal'), 'numbers typed by hand show in the meal and count in the total');
    await page.click('#meal-items-list .mi-hand button'); await settle(150);
    ok(await page.inputValue('#meal-pro') === '' && !(await page.isVisible('#meal-items-list .mi-hand')), 'and can be taken out again');
    await shot('47-meal-builder');
    await page.click('#meal-types .chip:has-text("Lunch")');
    await page.click('#meal-ov button:has-text("Log meal")'); await settle(400);
    const wm = await ev(() => S.meals.find(x => x.date === today()));
    ok(wm && wm.type === 'Lunch' && wm.cals === want && wm.items[0].unit === 'g' && await page.isVisible('.meal-group >> text=200 g Chicken Breast'), 'logged as lunch in one tap, and the row reads "200 g Chicken Breast"');
    await page.click('.food-tile:has-text("Chicken Breast")'); await settle(300);
    ok(await page.inputValue('#ql-unit') === 'g' && await page.inputValue('#ql-qty') === '113', 'the next quick log of that food starts in grams');
    await page.selectOption('#ql-unit', 'oz'); await settle(120);
    ok(await page.inputValue('#ql-qty') === '4', 'and converts on the spot (113 g is 4 oz)');
    await closeAll();
    for (const w of [320, 390]) {
      await page.setViewportSize({ width: w, height: 664 }); await settle(100);
      await ev(() => { showAddMeal(); addFoodToMeal('qf_chicken_breast'); addFoodToMeal('qf_white_rice'); addFoodToMeal('qf_protein_bar'); }); await settle(300);
      const out = await ev(() => [...document.querySelectorAll('#meal-ov .meal-sheet *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && !e.closest('.chips-x') && !e.closest('.ptabs'); }).map(e => e.className || e.tagName).slice(0, 4));
      const seen = await ev(() => { const b = document.querySelector('#meal-ov .ms-acts .btp').getBoundingClientRect(); const l = document.querySelector('#food-list').getBoundingClientRect(); return b.bottom <= innerHeight + 1 && l.height >= 90; });
      ok(out.length === 0 && seen, `the meal sheet fits at ${w}px with three foods in it` + (out.length ? ': ' + out.join(', ') : ''));
      await closeAll();
    }
    await page.setViewportSize({ width: 390, height: 664 });
    // ── repeat, and copy from a day ──
    await page.click('.meal-group button[aria-label="Log this meal again"]'); await settle(300);
    ok(await ev(() => S.meals.filter(x => x.date === today()).length === 2 && new Set(S.meals.map(x => x.id)).size === S.meals.length), 'the repeat button logs the same meal again');
    await page.click('.toast-btn'); await settle(300);
    ok(await ev(() => S.meals.filter(x => x.date === today()).length === 1), 'with Undo');
    await ev(() => { S.meals = S.meals.filter(m => m.date !== today()); save(); renderNutrition(document.getElementById('content')); }); await settle(200);
    await page.click('.empty button:has-text("Copy from")'); await settle(350);
    ok(await page.isVisible('#copy-ov >> text=Copy from a day') && await page.locator('#copy-ov .list .row').count() >= 1, 'an empty day offers the last day that has meals');
    const src = await ev(() => ({ from: _copyDay.from, n: S.meals.filter(m => m.date === _copyDay.from).length }));
    await page.click('#copy-ov button:has-text("Add all")'); await settle(400);
    ok(await ev(n => S.meals.filter(x => x.date === today()).length === n, src.n) && await ev(d => S.meals.filter(x => x.date === d.from).length === d.n, src), `"Add all" copies that day’s ${src.n} meal${src.n === 1 ? '' : 's'} into today and leaves the original`);
    await shot('48-nutrition-copied');
    // ── supplements fold; maintenance ──
    await ev(() => { S.supps = [{ id: 'sa', name: 'Creatine', dose: '5 g', timing: 'Morning' }, { id: 'sb', name: 'Vitamin D', dose: '', timing: '' }]; S.suppLogs = {}; window._suppOpen = null; save(); renderNutrition(document.getElementById('content')); }); await settle(200);
    ok(await page.locator('#supp-block .tog').count() === 2, 'supplements are open while one is still to be taken');
    const nSupp = await page.locator('#supp-block .tog').count();
    for (let i = 0; i < nSupp; i++) { await page.click('#supp-block .tog:not(.on)'); await settle(150); }
    ok(await page.locator('#supp-block .tog').count() === 0 && await page.isVisible('#supp-block >> text=All taken today'), 'and fold to one row once they are all ticked');
    await page.click('#supp-block .row-tap'); await settle(200);
    ok(await page.locator('#supp-block .tog.on').count() === nSupp, 'the row opens again on a tap');
    // adding one: offered while folded, the button beside the name, Return adds
    await ev(() => { window._suppOpen = null; renderNutrition(document.getElementById('content')); document.getElementById('supp-block').scrollIntoView({ block: 'center' }); }); await settle(200);
    ok(await page.locator('#supp-block .tog').count() === 0 && await page.isVisible('#supp-add'), 'Add is offered even while the list is folded');
    await page.tap('#supp-add'); await settle(350);
    const line = await ev(() => { const a = document.getElementById('sn').getBoundingClientRect(), b = document.getElementById('supp-save').getBoundingClientRect(); return { same: Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 4, fits: b.right <= innerWidth - 10 }; });
    ok(line.same && line.fits, 'the Add button is on the same line as Name');
    await page.tap('#supp-save'); await settle(200);
    ok(await page.isVisible('#supp-ov') && await ev(() => S.supps.length === 2), 'an empty name adds nothing and keeps the sheet');
    await page.fill('#sn', 'Fish Oil'); await page.press('#sn', 'Enter'); await settle(450);
    ok(await ev(() => S.supps.length === 3 && S.supps[2].name === 'Fish Oil') && !(await page.isVisible('#supp-ov')) && await page.isVisible('#supp-block >> text=Fish Oil'), 'Return on the keyboard adds it, and it is on screen at once');
    await page.tap('#supp-add'); await settle(350);
    await page.fill('#sn', 'Magnesium'); await page.fill('#sd', '400 mg'); await page.tap('#supp-save'); await settle(450);
    ok(await ev(() => S.supps.length === 4 && S.supps[3].dose === '400 mg') && await page.isVisible('#supp-block >> text=Magnesium'), 'and so does the button');
    // the phone keyboard, faked as a 320 px drop in the visible height
    const fakeKb = px => ev(h => { const vv = window.visualViewport; window.__kbFake = h; if (!window.__kbHooked) { window.__kbHooked = true; Object.defineProperty(vv, 'height', { configurable: true, get: () => innerHeight - window.__kbFake }); } vv.dispatchEvent(new Event('resize')); }, px);
    const outside = async () => { await page.touchscreen.tap(195, 24); await settle(250); };
    await page.tap('#supp-add'); await settle(350);
    await page.tap('#sn'); await page.keyboard.type('Zinc'); await fakeKb(320); await settle(300);
    const up = await ev(() => { const m = document.querySelector('#supp-ov .modal').getBoundingClientRect(), b = document.getElementById('supp-save').getBoundingClientRect(); return { bottom: m.bottom, top: m.top, add: b.bottom, limit: innerHeight - 320, cls: document.documentElement.classList.contains('kb') }; });
    ok(up.cls && Math.abs(up.bottom - up.limit) < 2 && up.add < up.limit && up.top >= 0, `with the keyboard up the sheet sits on top of it (sheet ends at ${Math.round(up.bottom)}, keyboard starts at ${up.limit})`);
    await outside();
    ok(await page.isVisible('#supp-ov') && await ev(() => document.activeElement.id !== 'sn'), 'a tap outside the sheet while typing only puts the keyboard away');
    await fakeKb(0); await settle(700);
    const down = await ev(() => ({ bottom: document.querySelector('#supp-ov .modal').getBoundingClientRect().bottom, cls: document.documentElement.classList.contains('kb'), y: window.scrollY }));
    ok(!down.cls && Math.abs(down.bottom - (await ev(() => innerHeight))) < 2 && down.y === 0, 'and the sheet comes back down with it');
    await outside(); await outside();
    ok(await page.isVisible('#supp-ov') && await ev(() => document.getElementById('sn').value === 'Zinc'), 'a typed name is not thrown away by tapping outside');
    await page.tap('#supp-save'); await settle(450);
    ok(await ev(() => S.supps.some(x => x.name === 'Zinc')) && !(await page.isVisible('#supp-ov')), 'and Add then adds it');
    await ev(() => document.querySelectorAll('.toast').forEach(t => t.remove())); // the “added” note sits where the tap goes
    await page.tap('#supp-add'); await settle(350);
    const hit = await ev(() => { const e = document.elementFromPoint(195, 24); return e ? (e.id || e.className) : ''; });
    await outside(); await settle(300);
    ok(!(await page.isVisible('#supp-ov')), `an empty sheet still closes on a tap outside (tap lands on ${hit})`);
    // every other sheet with a field gets the same lift
    await ev(() => showRetroSteps()); await settle(350);
    await page.tap('#step-inp'); await fakeKb(320); await settle(300);
    const st = await ev(() => { const m = document.querySelector('#steps-ov .modal').getBoundingClientRect(); const b = [...document.querySelectorAll('#steps-ov .btn')].map(x => x.getBoundingClientRect().bottom); return { bottom: m.bottom, top: m.top, low: Math.max(...b), limit: innerHeight - 320 }; });
    ok(Math.abs(st.bottom - st.limit) < 2 && st.low <= st.limit && st.top >= 0, 'the steps sheet rides above the keyboard too, Save and Cancel in reach');
    await fakeKb(0); await ev(() => closeOv('steps-ov')); await settle(400);
    await ev(() => { window._suppOpen = null; });
    await ev(() => document.getElementById('maint-row').scrollIntoView({ block: 'center' })); await settle(150);
    await page.click('#maint-row'); await settle(350);
    ok(await page.isVisible('#maint-ov .maint-big') && /The formula is|Worked out on this phone/.test(await page.textContent('#maint-ov')), 'maintenance opens with where the number comes from');
    ok(/Mifflin-St Jeor resting burn for a (man|woman) aged \d+/.test(await page.textContent('#maint-ov')), 'and says whose formula it is: sex, age, height and weight');
    await shot('49-maintenance'); await closeAll();
    // ── goals: calories from maintenance ──
    await ev(() => showMacroGoals()); await settle(300);
    const mk = await ev(() => maintenanceBest().kcal);
    await page.click('#mg-ov .rate-row .chip:has-text("−1 lb/wk")'); await settle(200);
    const filled = await ev(() => ({ cal: +document.getElementById('mg-cal').value, carb: +document.getElementById('mg-carb').value, pro: +document.getElementById('mg-pro').value, fat: +document.getElementById('mg-fat').value, note: document.getElementById('mg-cal-note').textContent, pn: document.getElementById('mg-pro-note').textContent }));
    ok(filled.cal === Math.max(1500, Math.round((mk - 500) / 10) * 10) && Math.abs(filled.pro * 4 + filled.carb * 4 + filled.fat * 9 - filled.cal) <= 10, `"−1 lb/wk" fills ${filled.cal} (maintenance ${mk} less 500) and moves carbs to ${filled.carb} g so the macros agree`);
    ok(/add up to [\d,]+ kcal\.$/.test(filled.note) && /g per lb of body weight/.test(filled.pn), 'the sheet says what the macros add up to and what the protein is per pound');
    await page.fill('#mg-cal', '900'); await settle(150);
    ok(/Below 1,500, the usual floor for a man/.test(await page.textContent('#mg-cal-note')), 'a number under the floor is pointed out');
    await shot('50-goals'); await closeAll();
    // ── seven days as bars; one line for a meal with a single entry ──
    ok(await page.locator('.nd-strip .nd-d').count() === 7 && !(await page.isVisible('.sec-h >> text=Recent days')), 'the last seven days are a strip of bars, not a list');
    const dayBack = await ev(() => daysAgoStr(2));
    await ev(() => document.querySelector('.nd-strip').scrollIntoView({ block: 'center' })); await settle(120);
    await page.click('.nd-strip .nd-d >> nth=5'); await settle(300);
    ok(await ev(d => nutDay() === d, dayBack) && await page.locator('.nd-strip .nd-d.sel').count() === 1, 'tapping a bar opens that day and marks it');
    await ev(() => setNutDay(null)); await settle(200);
    ok(await page.locator('.meal-group .meal-type').count() >= 1 && await ev(() => [...document.querySelectorAll('.meal-group')].every(g => (g.querySelectorAll('.row-tap').length > 1) === !!g.querySelector('.meal-head'))), 'a meal with one entry is one row; only a meal with several gets a total line');
    for (const w of [320, 390]) {
      await page.setViewportSize({ width: w, height: 664 }); await settle(150);
      const over = await ev(() => [...document.querySelectorAll('#content *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && !e.closest('.tile-row') && !e.closest('.hc-chips'); }).map(e => e.className || e.tagName).slice(0, 4));
      ok(over.length === 0, `the Nutrition tab fits at ${w}px` + (over.length ? ': ' + over.join(', ') : ''));
    }
    await page.setViewportSize({ width: 390, height: 664 });
    await shot('46-nutrition');
    await ev(() => { S.restGoals = null; S.dayKind = {}; save(); });
  });

  await step('remaining sheets open without errors', async () => {
    const calls = ['showModes()', 'showCardDeckSetup()', 'showSprintSetup()', 'showLogActivity()', 'showCustomEx()', 'showCreateRoutine()', 'showCreateGroup()', 'showProgramEditor()',
      'showLogMeasurements()', 'showAFTHistory()', 'showRetroSteps()', 'showExPicker()', 'showExDetail("bb-bench")', 'showPRDetail("bb-bench")', 'showMuscleDetail("Chest")', 'showCreateCustomFood("0123456789012")',
      'showMealPlan()', 'showMealPlan(3)', 'showPlanCopy(1)', 'showGroceryList()', 'showAiSettings()', 'showCoachRules()', 'showCoachWizard("quick")', 'showCoachWizard("program")', 'showCoachWizard("mealplan")', 'planAddMeal(2)', 'showReminders()', 'showInstallHelp()', 'showCoachChats()', 'showCoachChats("made")', 'confirmEndDeck()', 'confirmStopSprint()'];
    for (const c of calls) {
      const res = await ev(c => { try { if (typeof window[c.split('(')[0]] !== 'function') return 'missing'; (0, eval)(c); return 'ok'; } catch (e) { return String(e.message); } }, c);
      await settle(90);
      ok(res === 'ok', c + (res === 'ok' ? '' : ' → ' + res));
      await closeAll();
    }
  });

  await step('offline: reload with the server gone', async () => {
    const reg = await ev(async () => { if (!('serviceWorker' in navigator)) return 'unsupported'; const r = await navigator.serviceWorker.ready; return r && r.active ? 'active' : 'none'; });
    ok(reg === 'active', 'service worker active when served over http');
    await ev(() => Store.flush(true)); await settle(300);
    await ctx.setOffline(true);
    await page.reload({ waitUntil: 'load' }); await settle(700);
    ok(await ev(() => typeof S === 'object' && S.name === 'Smoke' && S.workouts.length === 1), 'app and data load with no network');
    await ctx.setOffline(false);
  });

  await step('hostile text and ids never become markup or script', async () => {
    // Every free-text field and every id is replaced with something that breaks out of HTML and of a quoted JS string.
    const res = await ev(async () => {
      const TEXT = '"><img data-xss src=x onerror="window.__xss=1">\'';
      const idOf = n => `i${n}'b"c<i data-xss>d`;
      const src = JSON.parse(JSON.stringify(S));
      const ids = new Map(); let n = 0;
      const collect = arr => (arr || []).forEach(o => { if (o && o.id != null && !ids.has(String(o.id))) ids.set(String(o.id), idOf(n++)); });
      [src.workouts, src.routines, src.groups, src.custom, src.customFoods, src.savedMeals, src.meals, src.supps, src.activities, src.coachNotes].concat(src.mealPlan.days).forEach(collect);
      const textKeys = new Set(['name', 'notes', 'note', 'dose', 'timing', 'serving', 'brand', 'savedMealName', 'text']);
      const walk = v => {
        if (Array.isArray(v)) return v.map(walk);
        if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(k => { const nk = ids.has(k) ? ids.get(k) : k; o[nk] = textKeys.has(k) && typeof v[k] === 'string' ? TEXT : walk(v[k]); }); return o; }
        if (typeof v === 'string' && ids.has(v)) return ids.get(v);
        return v;
      };
      const bad = walk(src);
      bad.customFoods.push({ id: idOf(n++), name: TEXT, serving: TEXT, protein: 1, carbs: 1, fat: 1, cals: 10 });
      bad.meals.push({ id: idOf(n++), date: today(), type: 'Lunch', name: TEXT, savedMealName: TEXT, items: [{ foodId: bad.customFoods[0] ? bad.customFoods[0].id : 'qf_popcorn', name: TEXT, qty: 2, serving: TEXT, protein: 1, carbs: 1, fat: 1, cals: 10 }], protein: 2, carbs: 2, fat: 2, cals: 20 });
      bad.savedMeals.push({ id: idOf(n++), name: TEXT, items: [{ foodId: 'qf_popcorn', name: TEXT, qty: 1, serving: TEXT, protein: 1, carbs: 1, fat: 1, cals: 10 }] });
      bad.recentSavedMeals = [bad.savedMeals[0].id]; bad.starredFoods = bad.customFoods.map(f => f.id); bad.recentFoods = bad.starredFoods.slice();
      bad.activities.push({ id: idOf(n++), type: 'run', date: today(), dist: '3', dur: '30', notes: TEXT, cals: 300 });
      bad.supps.push({ id: idOf(n++), name: TEXT, dose: TEXT, timing: TEXT });
      bad.coachNotes.push({ id: idOf(n++), text: TEXT, at: 1 });
      const planMeal = () => ({ id: idOf(n++), type: 'Lunch', name: TEXT, items: [{ foodId: idOf(n++), name: TEXT, qty: 2, serving: TEXT, protein: 1, carbs: 1, fat: 1, cals: 10 }] });
      bad.mealPlan = { days: [0, 1, 2, 3, 4, 5, 6].map(() => [planMeal(), planMeal()]), note: TEXT, updatedAt: 1, checked: {} };
      bad.ai = { provider: 'anthropic', models: { anthropic: 'claude-sonnet-5-5' } };
      bad.workouts.forEach(w => { w.notes = TEXT; w.exercises.forEach(e => e.sets.forEach(s => { s.tag = 'Pain'; })); });
      bad.name = TEXT; bad.foodCache = { '0123': { name: TEXT, brand: TEXT, serving: TEXT, servingG: 30, per100: { protein: 1, carbs: 1, fat: 1, cals: 10 }, perServing: { protein: 1, carbs: 1, fat: 1, cals: 10 } } };
      replaceState(bad);
      const problems = [];
      const check = where => {
        if (window.__xss) problems.push(where + ': script ran');
        if (document.querySelector('[data-xss]')) { problems.push(where + ': markup injected'); document.querySelectorAll('[data-xss]').forEach(e => e.remove()); }
        document.querySelectorAll('[onclick],[onchange],[oninput]').forEach(el => ['onclick', 'onchange', 'oninput'].forEach(a => {
          const code = el.getAttribute(a); if (!code) return;
          try { new Function(code); } catch (e) { problems.push(where + ': handler broken → ' + code.slice(0, 70)); }
        }));
      };
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const sheet = async (label, fn) => { try { fn(); } catch (e) { problems.push(label + ' threw ' + e.message); } await wait(30); check(label); document.querySelectorAll('.ov').forEach(o => o.remove()); };
      S.board = { range: '12w', tiles: Object.keys(METRICS).map(k => ({ k })) };
      // a chat full of hostile text, as if the model (or a restored file) had written it
      const hostileArgs = { mode: 'replace_week', note: TEXT, days: [{ day: 'Mon', meals: [{ meal: 'Lunch', name: TEXT, items: [{ name: TEXT, serving: TEXT, kcal: 100, protein: 5, carbs: 10, fat: 4 }] }] }] };
      const hostileProg = { summary: TEXT, groups: [{ name: TEXT, mode: 'rotation', routines: [{ name: TEXT, notes: TEXT, exercises: [{ exId: 'NEW', name: TEXT, equipment: 'Other', muscle: 'Chest', sets: 3, repsMin: 5, note: TEXT, link: TEXT }] }] }] };
      Coach.turns = [{ role: 'user', text: TEXT, attachments: [{ kind: 'image', name: TEXT }] }, { role: 'assistant', text: TEXT + '\n- ' + TEXT + '\n**' + TEXT + '** `' + TEXT + '`', calls: [], meta: { model: TEXT, steps: 1, in: 1, out: 1 } },
        { role: 'tool', results: [{ id: 'a', name: 'x', out: {}, ui: { type: 'read', label: TEXT } }, { id: 'b', name: 'x', out: {}, ui: { type: 'receipt', title: TEXT, lines: [TEXT], undo: { op: 'meal', id: TEXT } } },
          { id: 'c', name: 'x', out: {}, ui: { type: 'proposal', kind: 'propose_meal_plan', status: 'pending', title: TEXT, lines: [TEXT], summary: TEXT, args: hostileArgs } },
          { id: 'd', name: 'x', out: {}, ui: { type: 'proposal', kind: 'propose_routines', status: 'pending', title: TEXT, lines: [TEXT], summary: TEXT, args: hostileProg } },
          { id: 'e', name: 'x', out: {}, ui: { type: 'proposal', kind: 'propose_delete', status: 'applied', title: TEXT, lines: [TEXT], message: TEXT, go: TEXT, danger: true } },
          { id: 'f', name: 'x', out: {}, ui: { type: 'link', screen: TEXT } }] }];
      Coach.error = TEXT; Coach.loaded = true;
      for (const t of ['workout', 'history', 'coach', 'progress', 'nutrition', 'library']) { go(t); await wait(60); check('tab ' + t); }
      go('progress');
      for (const k of Object.keys(METRICS)) await sheet('progress tile ' + k, () => openTile(k));
      for (const id of getExsWithHist().slice(0, 6)) await sheet('lift ' + id, () => showMetric('lift', { id }));
      await sheet('all lifts', () => showAllLifts());
      await sheet('edit board', () => showBoardEdit());
      await sheet('lift picker', () => showLiftPicker());
      await sheet('pace picker', () => showPacePicker());
      go('coach');
      await sheet('coach: review plan', () => coachReviewPlan(2, 2));
      await sheet('coach: review routines', () => coachReviewRoutines(2, 3));
      await sheet('coach: AI settings', () => showAiSettings());
      await sheet('coach: rules', () => showCoachRules());
      await sheet('meal plan sheet', () => showMealPlan(1));
      await sheet('meal plan copy', () => showPlanCopy(1));
      await sheet('grocery list', () => showGroceryList());
      await sheet('plan edit in builder', () => planEditMeal(1, S.mealPlan.days[1][0].id));
      Coach.archive = [{ id: idOf(n++), title: TEXT, at: 1, updatedAt: 2, turns: JSON.parse(JSON.stringify(Coach.turns)) }]; Coach.archiveLoaded = true;
      await sheet('coach: chats', () => { showCoachChats(); renderCoachChats(); });
      await sheet('coach: made by coach', () => { showCoachChats('made'); renderCoachChats(); });
      S.reminders.workout.on = true;
      await sheet('reminders', () => showReminders());
      await sheet('install', () => showInstallHelp());
      for (const v of ['history', 'schedule', 'progress']) { setProgView(v); await wait(40); check('progress view ' + v); }
      Coach.turns = []; Coach.error = null; Coach.archive = [];
      setHistTab('cal'); check('calendar'); setHistTab('list');
      for (const lt of ['exercises', 'routines', 'groups', 'equipment']) { go('library'); setLibTab(lt); check('library ' + lt); }
      const W = S.workouts[0], R = S.routines[0], G = S.groups[0], C = S.custom[0], A = S.activities[0];
      await sheet('workout detail', () => showWkDetail(W.id));
      await sheet('routine detail', () => showRoutineDetail(R.id));
      await sheet('rename routine', () => showRenameRoutine(R.id));
      await sheet('group detail', () => showGroupDetail(G.id));
      await sheet('group eval', () => showGroupEval(G.id));
      await sheet('add routine to group', () => showAddRoutineToGroup(G.id));
      await sheet('program editor', () => showProgramEditor());
      await sheet('exercise detail', () => showExDetail(C.id));
      await sheet('PR detail', () => showPRDetail(Object.keys(S.prs)[0]));
      await sheet('activity detail', () => showActivityDetail(A.id));
      await sheet('day detail', () => { if (typeof showDayDetail === 'function') showDayDetail(today()); });
      await sheet('meal builder', () => { showAddMeal(); setFoodTab('recent'); });
      await sheet('meal builder all', () => { showAddMeal(); setFoodTab('combos'); addComboToMeal(S.savedMeals[0].id); addFoodToMeal(S.customFoods[0].id); });
      await sheet('serving picker', () => showServingPicker(S.foodCache['0123'], '0123'));
      await sheet('settings', () => showSettings());
      await sheet('card deck setup', () => showCardDeckSetup());
      await sheet('exercise picker', () => showExPicker(R.id));
      go('workout'); startWorkout(R.id); await wait(60); check('session');
      await sheet('session picker', () => showExPicker());
      await sheet('rest picker', () => showRestPicker(S.activeWorkout.exercises[0].exId));
      await sheet('finish', () => showFinish());
      S.activeWorkout = null; endSessionTimers(); rebuildPRs(); save();
      return problems;
    });
    ok(res.length === 0, res.length ? 'injection found: ' + [...new Set(res)].slice(0, 12).join(' ‖ ') : 'nothing injected across every tab and sheet');
  });

  await step('corrupt storage is not overwritten', async () => {
    // one damaged copy: the other one is used
    await ev(async () => { await Store.flush(true); await new Promise(r => setTimeout(r, 200)); localStorage.setItem('lahwe_v2', '{"workouts":[{"id":1'); });
    await page.reload({ waitUntil: 'load' }); await settle(700);
    ok(await ev(() => S.onboarded === true && !Store.corrupt && S.routines.length > 0), 'localStorage copy damaged → loads from the device database copy');
    // both damaged: stop and ask, never save over it
    await ev(async () => { Store.ready = false; await Store.idbSet('lahwe_v2', '{"workouts":[{"id":1'); localStorage.setItem('lahwe_v2', '{"workouts":[{"id":1'); });
    await page.reload({ waitUntil: 'load' }); await settle(700);
    ok(await page.isVisible("text=Saved data couldn't be read"), 'both copies damaged → recovery screen');
    await ev(() => { save(); saveNow(); }); await settle(200);
    ok(await ev(() => localStorage.getItem('lahwe_v2') === '{"workouts":[{"id":1'), 'damaged data left untouched by saves');
    await shot('18-corrupt');
  });

  await browser.close(); srv.close();
  console.log('\n' + (failures.length ? `FAILED — ${failures.length} problem(s):\n - ` + failures.join('\n - ') : 'All smoke checks passed.'));
  console.log('Screenshots: ' + path.relative(ROOT, OUT));
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
