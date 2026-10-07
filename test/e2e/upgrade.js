#!/usr/bin/env node
// Upgrade test: use the ORIGINAL app (legacy/lahwe2_01.html) to create real data, then open the
// new build at the same address and check that everything is still there and still makes sense.
//   node build.js && node test/e2e/upgrade.js
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
let playwright;
try { playwright = require('playwright'); } catch (e) { try { playwright = require('/opt/npm-tools/node_modules/playwright'); } catch (e2) { console.error('Playwright is not installed'); process.exit(2); } }
const { chromium, devices } = playwright;
const ROOT = path.join(__dirname, '..', '..');
const failures = [];
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failures.push(m); };

const PROGRAM = { version: 1, group: { name: 'Old PPL', mode: 'rotation' }, routines: [
  { name: 'Old PPL - Push', notes: '8-12 on accessories', exercises: [
    { name: 'Barbell Bench Press', sets: 3, reps: 5, rest: 180, type: 'flat', link: null, equipment: 'Barbell', muscle: 'Chest', secondaryMuscles: ['Triceps'] },
    { name: 'Bayesian Cable Curl', sets: 3, reps: 10, rest: 60, type: 'flat', link: null, equipment: 'Cable', muscle: 'Biceps', secondaryMuscles: ['Forearms'] }] },
  { name: 'Old PPL - Legs', notes: '', exercises: [{ name: 'Barbell Back Squat', sets: 3, reps: 5, rest: 180, type: 'flat', link: null, equipment: 'Barbell', muscle: 'Quads', secondaryMuscles: ['Glutes'] }] }] };

(async () => {
  const srv = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/chart\.js/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'chart.umd.js')) }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|openfoodfacts/, r => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const ev = (fn, a) => page.evaluate(fn, a);
  const settle = (ms = 300) => page.waitForTimeout(ms);

  console.log('• log data with the original app');
  await page.goto(base + '/legacy/lahwe2_01.html', { waitUntil: 'load' }); await settle(500);
  await page.fill('#ob-name', 'Kolbe'); await page.fill('#ob-bw', '190'); await page.click('text=Get Started'); await settle();
  await ev(p => { showImportUI(); document.getElementById('import-json').value = JSON.stringify(p); previewImport(); doImport(); }, PROGRAM); await settle(400);
  await ev(() => document.querySelectorAll('.ov').forEach(o => o.remove()));
  // two sessions of the same routine a week apart, the first with a heavier single that should stay the PR
  for (const [daysAgo, w, r] of [[8, '245', '3'], [1, '225', '5']]) {
    await ev(([daysAgo, w, r]) => {
      const rt = S.routines.find(x => x.name === 'Old PPL - Push'); startWorkout(rt.id);
      const wk = S.activeWorkout; wk.started = Date.now() - daysAgo * 86400000 - 3600000;
      addWarmup(0);
      wk.exercises[0].sets.forEach((s, i) => { if (!s.warmup) { upd(0, i, 'w', w); upd(0, i, 'r', r); } });
      wk.exercises[0].sets.forEach((s, i) => { if (!s.done) togSet(0, i); });
      upd(1, 0, 'w', '40'); upd(1, 0, 'r', '10'); togSet(1, 0);
      showFinish(); saveWorkout(); document.querySelectorAll('.ov').forEach(o => o.remove());
      S.workouts[0].started = wk.started; S.workouts[0].ended = wk.started + 3000000; save();
    }, [daysAgo, w, r]); await settle(300);
  }
  await ev(() => {
    const td = today();
    S.macroLogs[td] = { protein: 120, carbs: 150, fat: 50, cals: 1530 };
    quickLogFood('qf_popcorn'); doQuickLog('Snack');                                   // old app now shows 93 for today (meals hid the Quick Log)
    const q = new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0];
    S.macroLogs[q] = { protein: 150, carbs: 200, fat: 60, cals: 1940 };               // Quick Log only → shown as 1940
    const y = new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0];
    S.macroLogs[y] = { protein: 100, carbs: 100, fat: 40, cals: 1160 };
    S.meals.push({ id: 'old-meal', date: y, type: 'Lunch', name: 'Lunch', protein: 30, carbs: 40, fat: 10, cals: 370 }); // old app showed 370 for this day
    S.bodyweightLog.unshift({ date: td, weight: 189 }); S.bodyweight = 189;
    S.aftCurrent = { MDL: '300', HRP: '40', SDC: '110', PLK: '150', '2MR': '960' };
    S.supps.push({ id: 'sup1', name: 'Creatine', dose: '5g', timing: 'Morning' });
    save();
  }); await settle(400);
  const old = await ev(() => ({ shown: [0, 2, 3].map(n => { const d = new Date(Date.now() - 86400000 * n).toISOString().split('T')[0]; return Math.round(getDayTotals(d).cals || 0); }), raw: localStorage.getItem('lahwe_v2'), prs: JSON.parse(JSON.stringify(S.prs)), n: S.workouts.length, custom: S.custom.map(c => c.name), today: today() }));
  ok(old.n === 2 && old.custom.includes('Bayesian Cable Curl') && !!old.raw, `original app saved ${old.n} workouts, ${old.custom.length} custom exercise, ${Math.round(old.raw.length / 1024)} KB`);
  const legacyErrs = errs.splice(0);

  console.log('• open the new build at the same address');
  await page.goto(base + '/dist/index.html', { waitUntil: 'load' }); await settle(800);
  const s = await ev(() => ({
    onboarded: S.onboarded, name: S.name, schema: S._schema, n: S.workouts.length, routines: S.routines.map(r => r.name), group: S.groups[0] && [S.groups[0].name, S.groups[0].active, S.groups[0].routineIds.length],
    custom: S.custom.map(c => c.name), sec: S.custom[0] && SEC_MUSCLE[S.custom[0].id],
    bench: S.prs['bb-bench'], warmKept: S.workouts.every(w => w.exercises[0].sets.filter(x => x.warmup).length === 1),
    vol: S.workouts.map(w => Math.round(totalVol(w))), next: (getNextRoutine() || {}).name,
    shown: [0, 2, 3].map(n => getDayTotals(daysAgoStr(n)).cals), bw: S.bodyweight, bwLog: S.bodyweightLog.length,
    aft: aftSummary(S.aftCurrent, aftColumn()).total, supps: S.supps.length, crash: /hit an error|couldn't be read/.test(document.getElementById('content').textContent),
    stored: JSON.parse(localStorage.getItem('lahwe_v2'))._schema,
  }));
  ok(s.onboarded && s.name === 'Kolbe' && !s.crash, 'opens straight to the home screen, no onboarding, no error screen');
  ok(s.schema === 3, 'data upgraded to the current format');
  ok(s.n === 2 && s.routines.length === 2 && s.group && s.group[0] === 'Old PPL' && s.group[1] === true && s.group[2] === 2, 'workouts, routines and the active group are all there');
  ok(s.custom.includes('Bayesian Cable Curl') && JSON.stringify(s.sec) === '["Forearms"]', 'custom exercise and its secondary muscles survive');
  // What the original app's own data says, worked out here from its raw save.
  const rawState = JSON.parse(old.raw);
  const expVol = rawState.workouts.map(w => w.exercises.reduce((t, ex) => t + ex.sets.filter(x => x.done && !x.warmup).reduce((a, x) => a + (parseFloat(x.w) || 0) * (parseInt(x.r) || 0), 0), 0));
  const oldPR = old.prs['bb-bench'];
  ok(s.bench && oldPR && s.bench.w === parseFloat(oldPR.w) && s.bench.r === parseInt(oldPR.r) && !s.bench.manual, `bench PR ${s.bench.w}×${s.bench.r} matches the original and is backed by a logged set (not "carried over")`);
  ok(s.warmKept && JSON.stringify(s.vol) === JSON.stringify(expVol), `warm-up sets still flagged; volume counts working sets only (${s.vol.join(', ')})`);
  ok(s.next === 'Old PPL - Legs' || s.next === 'Old PPL - Push', `rotation still points at a routine (${s.next})`);
  ok(JSON.stringify(s.shown) === JSON.stringify(old.shown) && s.shown[2] === 1940, `daily calorie totals are exactly what the original showed (${s.shown.join(', ')})`);
  ok(s.bw === 189 && s.bwLog === 2 && s.supps === 1 && s.aft > 0, 'bodyweight log, supplements and fitness-test entries carried over');
  for (const t of ['history', 'progress', 'nutrition', 'library', 'workout']) { await ev(t => go(t), t); await settle(200); }
  await ev(() => { go('progress'); boardSet(Object.keys(METRICS).map(k => ({ k }))); go('progress'); }); await settle(300);
  for (const k of await ev(() => Object.keys(METRICS))) { await ev(k => openTile(k), k); await settle(120); await ev(() => document.querySelectorAll('.ov').forEach(o => o.remove())); }
  await ev(() => boardSet(null));
  await ev(() => { const r = S.routines.find(x => x.name === 'Old PPL - Push'); go('workout'); startWorkout(r.id); }); await settle(300);
  const fill = await ev(() => S.activeWorkout.exercises[0].sets.map(x => (x.warmup ? 'W' : '') + x.w + 'x' + x.r));
  ok(fill.filter(x => x.startsWith('W')).length === 1 && fill.filter(x => x === '225x5').length === 3, `next session pre-fills from last time, warm-up kept as a warm-up (${fill.join(' ')})`);
  ok(errs.length === 0, errs.length ? 'page errors in the new build: ' + errs.join(' | ') : 'no page errors on any screen with upgraded data');
  if (legacyErrs.length) console.log('  (original app logged ' + legacyErrs.length + ' page error(s) of its own while creating the data)');

  await browser.close(); srv.close();
  console.log('\n' + (failures.length ? 'FAILED:\n - ' + failures.join('\n - ') : 'Upgrade from the original app works.'));
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
