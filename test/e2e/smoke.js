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
  try { await fn(); } catch (e) { failures.push(name + ': ' + e.message.split('\n')[0]); console.log('  ✗ threw: ' + e.message.split('\n')[0]); }
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
  let aiRequest = null;
  await ctx.route('https://api.anthropic.com/**', async r => {
    aiRequest = { headers: r.request().headers(), body: JSON.parse(r.request().postData() || '{}') };
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', stop_reason: 'end_turn',
        content: [{ type: 'text', text: JSON.stringify(AI_REPLY) }], usage: { input_tokens: 2100, output_tokens: 640 } }) });
  });
  page = await ctx.newPage();
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 240)); });
  page.on('dialog', d => { errs.push('NATIVE DIALOG ' + d.message()); d.dismiss(); });

  await step('first launch → onboarding', async () => {
    await page.goto(base, { waitUntil: 'load' }); await settle(500);
    ok(await page.isVisible('#ob-name'), 'onboarding is shown');
    await page.fill('#ob-name', 'Smoke'); await page.fill('#ob-bw', '185'); await page.fill('#ob-height', '70');
    await page.click('text=Get Started'); await settle();
    ok(await ev(() => S.onboarded && document.getElementById('nav').style.display === 'flex'), 'home screen after onboarding');
    ok(await ev(() => !!localStorage.getItem('lahwe_v2')), 'state written to localStorage immediately');
    await shot('01-home-empty');
  });

  await step('every tab renders', async () => {
    for (const t of ['history', 'progress', 'nutrition', 'library', 'workout']) {
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
    await ev(() => showFinish()); await settle(); await shot('05-finish');
    await ev(() => saveWorkout()); await settle(500);
    const w = await ev(() => ({ n: S.workouts.length, aw: S.activeWorkout, wk: S.workouts[0], pr: S.prs['bb-bench'], ls: JSON.parse(localStorage.getItem('lahwe_v2')).workouts.length }));
    ok(w.n === 1 && w.aw === null && w.ls === 1, 'workout saved and flushed to storage');
    ok(w.pr && w.pr.w === 185 && w.pr.r === 8 && !w.pr.live, 'PR comes from history');
    ok(!('_af' in w.wk.exercises[0]) && !w.wk.exercises[0].sets.some(s => '_manual' in s), 'transient flags stripped from the saved workout');
    ok(w.wk.cals > 250 && w.wk.cals < 320 && w.wk.ended - w.wk.started < 50 * 60000, `calories and duration reflect the 45 min trained, not 3½ h on the clock (${w.wk.cals} kcal)`);
    await closeAll();
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

  await step('progress: every card expanded', async () => {
    await ev(() => { go('progress'); DASH_CARDS.forEach(c => { S.expandedCards[c.id] = true; }); renderProgress(document.getElementById('content')); });
    await settle(700); await shot('08-progress');
    ok(await ev(() => document.querySelectorAll('.dash-body').length >= 6), 'cards rendered');
    await ev(() => { S.aftCurrent = { MDL: '340', HRP: '45', SDC: '105', PLK: '160', '2MR': '930' }; S.aftAge = '27-31'; renderProgress(document.getElementById('content')); document.querySelector('.aft-total').scrollIntoView({ behavior: 'instant', block: 'start' }); }); await settle(300); await shot('08b-aft');
    const aft = await ev(() => aftSummary(S.aftCurrent, aftColumn()));
    ok(aft.complete && aft.scores.MDL === 98 && aft.total > 300 && aft.total <= 500 && aft.pass === true, `AFT scored from the official tables (340 lb deadlift = 98 pts at 27–31; total ${aft.total}/500)`);
    await ev(() => { DASH_CARDS.forEach(c => { S.expandedCards[c.id] = false; }); save(); });
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

  await step('AI builder: request shape, preview, revise, accept', async () => {
    await ev(() => { setLibTab('routines'); showAIBuilder(); }); await settle();
    ok(await page.isVisible('#ai-key'), 'asks for an API key first');
    await page.fill('#ai-key', 'sk-ant-api03-' + 'x'.repeat(40)); await page.click('#ai-body button:has-text("Save")'); await settle(200);
    ok(await ev(() => localStorage.getItem('lahwe_api_key').startsWith('sk-ant-') && !JSON.stringify(S).includes('sk-ant-')), 'key stored outside the app state');
    await page.fill('#ai-text', 'Two full body days, 45 minutes'); await shot('12-ai-compose');
    await page.click('#ai-go'); await page.waitForSelector('#ai-body .import-preview', { timeout: 8000 }); await settle(150);
    await shot('13-ai-preview');
    const h = aiRequest.headers, b = aiRequest.body;
    ok(h['x-api-key'] && h['anthropic-version'] === '2023-06-01' && h['anthropic-dangerous-direct-browser-access'] === 'true', 'required headers sent');
    ok(b.model === 'claude-sonnet-5-5' && b.max_tokens > 0 && typeof b.system === 'string', 'model, max_tokens and system prompt set');
    ok(b.output_config && b.output_config.format.type === 'json_schema' && b.output_config.format.schema.additionalProperties === false, 'structured-output schema attached');
    const ex = b.output_config.format.schema.properties.groups.items.properties.routines.items.properties.exercises.items;
    ok(ex.required.length === Object.keys(ex.properties).length && ex.properties.exId.enum.includes('NEW') && ex.properties.exId.enum.includes('squat'), 'every field required; exId limited to the catalog or NEW');
    ok(!JSON.stringify(b).includes('"workouts"') && !/185/.test(b.messages[0].content.slice(-1)[0].text.split('REQUEST')[0].split('EXERCISE CATALOG')[0]), 'no workout history in the request');
    await page.fill('#ai-revise', 'make day B shorter'); await page.click('#ai-go'); await settle(600);
    ok(aiRequest.body.messages.length === 3 && aiRequest.body.messages[1].role === 'assistant', 'revise sends the conversation so far');
    await page.click('#ai-body button:has-text("Add to my library")'); await settle(500);
    const r = await ev(() => {
      const a = S.routines.find(x => x.name === 'AI Full Body - A'), b2 = S.routines.find(x => x.name === 'AI Full Body - B');
      return { a, b2, g: S.groups.find(x => x.name === 'AI Full Body'), newEx: S.custom.find(c => c.name === 'Cable Lateral Raise') };
    });
    ok(r.a && r.a.exercises[0].exId === 'squat' && r.a.exercises[0].note === 'RPE 8', 'catalog id used, note kept');
    ok(r.newEx && r.newEx.eq === 'Cable' && r.a.exercises[1].exId === r.newEx.id && r.a.exercises[1].rMax === '15', 'NEW exercise created with its range');
    ok(r.a.exercises[2].exId === 'plank' && r.a.exercises[2].timed && r.a.exercises[2].r === '40' && r.a.exercises[2].rMax === '60', 'enum casing tolerated (PLANK, bodyweight, abs); timed range');
    ok(r.b2.exercises[1].amrap === true && r.b2.exercises[1].r === '10', '"10+" AMRAP');
    ok(r.g && r.g.active === false, 'an existing active group is not displaced silently');
  });

  await step('settings, backup, restore, undo', async () => {
    await ev(() => { go('workout'); showSettings(); }); await settle(); await shot('14-settings');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), ev(() => { exportData(); })]);
    const file = path.join(OUT, 'backup.json'); await dl.saveAs(file);
    const bk = JSON.parse(fs.readFileSync(file, 'utf8'));
    ok(bk._app === 'lahwe' && bk.workouts.length === 1 && !fs.readFileSync(file, 'utf8').includes('sk-ant-'), 'backup written; API key is not in it');
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
    await ev(() => { go('progress'); DASH_CARDS.forEach(c => { S.expandedCards[c.id] = true; }); renderProgress(document.getElementById('content')); }); await settle(600);
    await shot('17-restored-progress');
    await ev(() => { go('workout'); showSettings(); }); await settle();
    ok(await page.isVisible('text=Undo last restore'), 'undo is offered');
    await page.click('text=Undo last restore'); await settle(700);
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

  await step('remaining sheets open without errors', async () => {
    const calls = ['showModes()', 'showCardDeckSetup()', 'showSprintSetup()', 'showLogActivity()', 'showCustomEx()', 'showCreateRoutine()', 'showCreateGroup()', 'showProgramEditor()',
      'showLogMeasurements()', 'showAFTHistory()', 'showRetroSteps()', 'showExPicker()', 'showExDetail("bb-bench")', 'showPRDetail("bb-bench")', 'showMuscleDetail("Chest")', 'showCreateCustomFood("0123456789012")'];
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
      [src.workouts, src.routines, src.groups, src.custom, src.customFoods, src.savedMeals, src.meals, src.supps, src.activities].forEach(collect);
      const textKeys = new Set(['name', 'notes', 'note', 'dose', 'timing', 'serving', 'brand', 'savedMealName']);
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
      DASH_CARDS.forEach(c => { S.expandedCards[c.id] = true; });
      for (const t of ['workout', 'history', 'progress', 'nutrition', 'library']) { go(t); await wait(60); check('tab ' + t); }
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
