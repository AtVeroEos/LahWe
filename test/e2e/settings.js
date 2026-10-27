#!/usr/bin/env node
// 3.18 in a real browser at iPhone size: Settings in groups (every page opens and closes, nothing
// errors, nothing spills sideways), Pause, plates you own, the rest card that flips by itself, a timed
// set that runs itself, and the week starting on Sunday. Screenshots go to test/e2e/out.
//   node build.js && node test/e2e/settings.js
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
let playwright;
try { playwright = require('playwright'); } catch (e) { try { playwright = require('/opt/npm-tools/node_modules/playwright'); } catch (e2) { console.error('Playwright is not installed'); process.exit(2); } }
const { chromium, devices } = playwright;
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const failures = [];
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failures.push(m); };

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
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/chart\.js/, r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'chart.umd.js')) }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|openfoodfacts/, r => r.abort());
  // Chromium has no Audio Session API; Safari on iPhone does. A stand-in records what the page asks for.
  await ctx.addInitScript(() => { if (!navigator.audioSession) Object.defineProperty(navigator, 'audioSession', { value: { type: 'auto', log: [] } }); });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const ev = (fn, a) => page.evaluate(fn, a);
  const settle = (ms = 250) => page.waitForTimeout(ms);
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });
  const noSideways = () => ev(() => [...document.querySelectorAll('.ov .modal')].every(m => m.scrollWidth <= m.clientWidth + 1));

  await page.goto(base + '/dist/index.html', { waitUntil: 'load' }); await settle(600);
  await ev(() => {
    S.onboarded = true; S.name = 'Kolbe'; S.tab = 'workout'; S.profileSet.sex = true; S.birthYear = 1995; S.profileSet.height = true; S.height = 69;
    S.bodyweightLog = [{ date: daysAgoStr(1), weight: 182.4 }]; S.lastExportAt = Date.now() - 3 * 864e5;
    save(); document.getElementById('nav').style.display = 'flex'; render();
  }); await settle(300);

  console.log('• Settings: a list of groups');
  await page.click('button[aria-label="Settings"]'); await settle(400);
  const rows = await page.locator('#set-hub-body .list .row-t').allTextContents();
  ok(JSON.stringify(rows) === JSON.stringify(['What Lah We shows', 'Pause', 'Units & calendar', 'Goals & targets', 'Workout', 'Check-in & tracking', 'Appearance', 'Connections', 'Your data']), 'What Lah We shows and Pause, then seven groups: ' + rows.join(', '));
  ok(/Male · age \d+ · 5′9″ · 182.4 lbs/.test(await page.textContent('.set-me')), 'the profile card says what is set');
  ok(/Backed up 3 days ago/.test(await page.textContent('#set-hub-body')), 'each row says what is set now');
  ok(await page.locator('#set-ov button:has-text("Save")').count() === 0, 'no Save button');
  await shot('318-settings-hub');
  for (const [id, label] of [['profile', null], ['units', 'Units & calendar'], ['goals', 'Goals & targets'], ['workout', 'Workout'], ['tracking', 'Check-in & tracking'], ['look', 'Appearance'], ['connect', 'Connections'], ['data', 'Your data']]) {
    if (label) await page.click(`#set-hub-body .row-t:text-is("${label}")`); else await page.click('.set-me');
    await settle(380);
    ok(await page.isVisible('#set-pg') && await ev(p => document.getElementById('set-pg').dataset.pg === p, id), `${id} opens`);
    ok(await noSideways(), `${id}: nothing wider than the screen`);
    await shot('318-settings-' + id);
    if (id === 'workout') { await ev(() => { document.querySelector('#set-pg .modal').scrollTop = 99999; }); await settle(150); await shot('318-settings-workout-2'); }
    await ev(() => closeOv('set-pg')); await settle(320);
  }

  console.log('• changing things saves at once, and the list follows');
  await page.click('#set-hub-body .row-t:text-is("Units & calendar")'); await settle(350);
  await page.click('#set-pg .set-seg[aria-label="Week starts on"] .seg-b:has-text("Sunday")'); await settle(150);
  await page.click('#set-pg .set-seg[aria-label="Day ends at"] .seg-b:text-is("3")'); await settle(150);
  ok(await ev(() => S.weekStart === 0 && S.dayEnd === 3), 'week from Sunday, day ends at 3 AM');
  ok(/week from Sun · day ends 3 AM/.test(await page.textContent('#set-hub-body')), 'the row behind says so');
  await ev(() => closeOv('set-pg')); await settle(320);
  await page.click('#set-hub-body .row-t:text-is("Appearance")'); await settle(350);
  await page.click('#set-pg .set-seg[aria-label="Theme"] .seg-b:has-text("Dark")'); await settle(250);
  ok(await ev(() => document.documentElement.dataset.dark === 'true' && S.themeMode === 'dark'), 'Dark applies at once');
  await shot('318-settings-look-dark');
  await ev(() => closeOv('set-pg')); await settle(320);
  await shot('318-settings-hub-dark');
  await page.click('#set-hub-body .row-t:text-is("Appearance")'); await settle(350);
  await page.click('#set-pg .set-seg[aria-label="Theme"] .seg-b:has-text("Light")'); await settle(250);
  await ev(() => closeOv('set-pg')); await settle(320);

  console.log('• the volume and sound can be heard from Settings');
  await page.click('#set-hub-body .row-t:text-is("Workout")'); await settle(350);
  await page.click('#set-pg .set-seg[aria-label="Volume"] .seg-b:has-text("Max")'); await settle(150);
  await page.click('#set-pg .set-seg[aria-label="Sound"] .seg-b:has-text("Ring")'); await settle(150);
  await page.click('#set-pg button:has-text("Test the sound")'); await settle(200);
  ok(await ev(() => S.cueVol === 4 && S.cueSound === 'ring' && !!_audioCtx), 'Max and Ring are kept, and the test plays');
  await settle(500);
  ok(/probably on silent/.test(await page.textContent('.toast')), 'Test says what to check when nothing is heard');
  ok(await ev(() => navigator.audioSession.type === 'auto'), 'with Play on silent off, the audio session is never touched');
  ok(await page.isVisible('#set-pg button[aria-label="Play on silent"]'), 'Play on silent is offered where the phone has an audio session');
  await page.click('#set-pg button[aria-label="Play on silent"]'); await settle(150);
  ok(await ev(() => S.cueSilent === true && navigator.audioSession.type === 'playback'), 'on: a cue plays as playback (through the silent switch)');
  await shot('318-settings-silent');
  await page.waitForTimeout(4200);
  ok(await ev(() => navigator.audioSession.type === 'auto' && _audioCtx.state === 'suspended'), 'and afterwards the audio is stopped and the session handed back, so music can resume');
  await page.click('#set-pg button:has-text("Test the sound")'); await settle(300);
  ok(await ev(() => _audioCtx.state === 'running'), 'the next cue wakes the audio again');
  await page.click('#set-pg button[aria-label="Play on silent"]'); await settle(150);
  ok(await ev(() => S.cueSilent === false), 'and it turns off');

  console.log('• plates you own');
  await page.click('#set-pg .row-t:text-is("Plates & dumbbells")'); await settle(380);
  await page.click('#gear-ov .seg-b:has-text("Only what I own")'); await settle(200);
  ok(await page.locator('#gear-ov .gear-pl').count() === 7, 'a row for each plate size');
  await page.fill('#gear-dbs', '5-50, 55, 60'); await page.dispatchEvent('#gear-dbs', 'change'); await settle(200);
  ok(await ev(() => gearDumbbells().length === 12), 'dumbbells typed as a range');
  ok(await noSideways(), 'plates: nothing wider than the screen');
  await shot('318-gear');
  await ev(() => closeOv('gear-ov')); await settle(300);
  ok(/45 lbs bar · loads 45–/.test(await page.textContent('#set-pg')), 'the row shows what the plates load');
  await ev(() => closeSetAll()); await settle(320);

  console.log('• Pause');
  await page.click('button[aria-label="Settings"]'); await settle(350);
  await page.click('#set-hub-body .row-t:text-is("Pause")'); await settle(380);
  await page.click('#pause-ov .chip:has-text("Field duty")'); await settle(120);
  await shot('318-pause-new');
  await page.click('#pause-ov button:has-text("Pause")'); await settle(300);
  ok(await ev(() => S.pauses.length === 1 && S.pauses[0].why === 'field' && isPaused(today())), 'paused from today, until ended');
  ok(await page.isVisible('#pause-ov .pz-now'), 'the sheet shows the pause running, with End');
  await shot('318-pause-on');
  await ev(() => { closeOv('pause-ov'); closeSetAll(); }); await settle(350);
  ok(await page.isVisible('.pz-banner'), 'Home says it is paused');
  await shot('318-home-paused');
  await ev(() => { S.pauses = []; save(); render(); }); await settle(200);

  console.log('• the plate calculator loads from what you own');
  await ev(() => { startWorkout(null); const ex = sessionExercise('bb-bench', null, { exId: 'bb-bench', sets: 2, r: '5', w: '225' }); ex.rest = 3; S.activeWorkout.exercises.push(ex); save(); render(); }); await settle(300);
  await ev(() => showPlateCalc(0)); await settle(350);
  ok(/Each side · bar 45lbs/.test(await page.textContent('#plt-result')), 'the remembered bar');
  await page.fill('#plt-tgt', '500'); await settle(150); // the default set tops out at 490
  ok(/Your plates make/.test(await page.textContent('#plt-result')), 'a weight the plates cannot make says what they can');
  await shot('318-platecalc');
  await ev(() => closeOv('plate-ov')); await settle(300);

  console.log('• the rest card flips to the next set by itself');
  await ev(() => { S.cueVol = 2; S.cueSound = 'chime'; S.activeWorkout._swipe = 'simple'; save(); render(); }); await settle(300);
  await page.click('.sw-yes'); await settle(450);
  ok(await page.isVisible('#sw-rest') && /Up next.*Set 2/.test(await page.textContent('#sw-rest')), 'after the set, the card is the rest countdown');
  ok(!(await page.isVisible('#rest-pill.on')) && !(await page.isVisible('#rest-ov')), 'and nothing else shows the rest');
  await shot('318-rest-card');
  await page.waitForSelector('#sw-card', { timeout: 6000 }).catch(() => {});
  ok(await page.isVisible('#sw-card') && /Set 2 of 2/.test(await page.textContent('#sw-card .sw-meta')), 'when the rest ends it has flipped to set 2');
  await shot('318-rest-flipped');

  console.log('• a timed set runs itself');
  await ev(() => { const ex = sessionExercise('plank', null, { exId: 'plank', sets: 1, r: '2', timed: true }); S.activeWorkout.exercises = [ex]; S.restTimer = null; save(); render(); }); await settle(300);
  ok(await page.isVisible('.sw-hold-go'), 'Start is on the plank card');
  await page.click('.sw-hold-go'); await settle(400);
  ok(await page.isVisible('#sw-hold-t') && /Get set/.test(await page.textContent('#sw-hold-k')), '3-2-1 first');
  await shot('318-hold-lead');
  await page.waitForTimeout(3400);
  ok(/Hold/.test(await page.textContent('#sw-hold-k')), 'then the hold');
  await shot('318-hold-running');
  await page.waitForTimeout(2200);
  ok(await ev(() => S.activeWorkout.exercises[0].sets[0].done && S.activeWorkout.exercises[0].sets[0].r === '2'), 'at zero the set is logged at the plan');

  console.log('• the week from Sunday on the calendar');
  await ev(() => { S.activeWorkout = null; S.restTimer = null; S.homeView = 'schedule'; S.tab = 'workout'; save(); render(); }); await settle(400);
  ok(/^Su/.test((await page.locator('.cal-day-hdr').first().textContent()) || ''), 'the calendar starts on Sunday');
  await shot('318-calendar-sunday');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close(); srv.close();
  if (failures.length) { console.log('\nFAILED — ' + failures.length + ' problem(s):\n - ' + failures.join('\n - ')); process.exit(1); }
  console.log('\nAll 3.18 checks passed.\nScreenshots: test/e2e/out');
})().catch(e => { console.error(e); process.exit(1); });
