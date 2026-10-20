#!/usr/bin/env node
// Swipe Check in a real browser at iPhone size: drag the card with a pointer and see what lands in the workout.
// It is a regression net, not proof of iOS behaviour: the feel of the gesture on a real phone still has to be checked by hand.
//   node build.js && node test/e2e/swipe.js
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
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const ev = (fn, a) => page.evaluate(fn, a);
  const settle = (ms = 250) => page.waitForTimeout(ms);
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });
  const sets = ei => ev(i => S.activeWorkout.exercises[i].sets.map(s => [s.w, s.r, !!s.done, !!s.fail, !!s.skip]), ei);
  // Drag the card from its middle by (dx, dy) in small steps, the way a thumb does.
  const drag = async (dx, dy = 0) => {
    const b = await page.locator('#sw-card').boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x + dx * i / 8, y + dy * i / 8);
    await page.mouse.up(); await settle(450);
  };

  // The same, but at a walking pace (a slow, deliberate drag that stops short is not a flick).
  const dragSlow = async (dx) => {
    const b = await page.locator('#sw-card').boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(x + dx * i / 8, y); await page.waitForTimeout(40); }
    await page.mouse.up(); await settle(450);
  };

  await page.goto(base + '/dist/index.html', { waitUntil: 'load' }); await settle(600);
  await ev(() => {
    S.onboarded = true; S.name = 'Swipe'; S.tab = 'workout';
    S.swipeRest = false; S.swipeHold = false; // the classic card; the rest card and timed sets are in settings.js
    save();
    startWorkout(null);
    const mk = (id, n, r, w) => { const ex = sessionExercise(id, null, { exId: id, sets: n, r, w }); S.activeWorkout.exercises.push(ex); return ex; };
    const a = mk('bb-bench', 3, '8', '135'), b = mk('pullup', 3, '8', ''), c = mk('plank', 2, '45', ''); c.timed = true;
    a.link = b.link = 'ss-1'; save(); render();
  }); await settle(300);

  console.log('• the list has a Swipe button, and it opens a choice');
  ok(await page.isVisible('.fbar button:has-text("Swipe")'), 'Swipe is on the workout screen');
  await page.click('.fbar button:has-text("Swipe")'); await settle(300);
  ok(await page.isVisible('#swipe-ov .mode-card:has-text("Super Simple")') && await page.isVisible('#swipe-ov .mode-card:has-text("Simple")'), 'it offers Simple and Super Simple');
  await shot('313-swipe-choice');
  await page.click('#swipe-ov .mode-card:first-child'); await settle(350);

  console.log('• Simple mode');
  ok(await page.isVisible('#sw-card') && /Bench/.test(await page.textContent('#sw-card .sw-name')) && /Superset · 1 of 2/.test(await page.textContent('#sw-card .sw-meta')) && /Set 1 of 3/.test(await page.textContent('#sw-card .sw-meta')), 'the first card is bench, set 1 of 3, the first half of a superset');
  ok(await page.locator('#sw-card .sw-st').count() === 4, 'weight and reps each have a minus and a plus');
  await shot('313-swipe-simple');
  ok(await ev(() => { const c = document.getElementById('content'); return c.classList.contains('swipe-on') && getComputedStyle(c).overflowY === 'hidden' && c.scrollHeight <= c.clientHeight + 1; }), 'the page is locked: nothing under the card can scroll');
  await page.touchscreen.tap(5, 300).catch(() => {});
  await ev(() => { document.getElementById('content').scrollTop = 200; });
  ok(await ev(() => document.getElementById('content').scrollTop === 0), 'and it stays at the top');
  await drag(30);
  ok(JSON.stringify((await sets(0))[0]) === '["135","8",false,false,false]', 'a short drag springs back and logs nothing');
  await drag(0, 140);
  ok((await sets(0))[0][2] === false, 'a vertical drag is a scroll, not a swipe');
  await dragSlow(55);
  ok((await sets(0))[0][2] === false, 'a slow drag that stops short springs back');
  await drag(170, 12);
  const s0 = await sets(0);
  ok(s0[0][2] && !s0[0][3], 'a long swipe right logs set 1 as done, even with a little vertical wobble');
  ok(/Pull/.test(await page.textContent('#sw-card .sw-name')) && /Superset · 2 of 2/.test(await page.textContent('#sw-card .sw-meta')), 'and the next card is the other half of the superset');
  ok(await ev(() => S.restTimer === null), 'no rest between the two halves of a superset');

  console.log('• missing a set');
  await drag(-170);
  ok(await page.isVisible('.sw-ask') && /How many reps did you get/.test(await page.textContent('.sw-ask')) && (await sets(1))[0][2] === false, 'a long swipe left asks how many reps you got, and logs nothing yet');
  await shot('313-swipe-ask');
  await page.click('.sw-chips .sw-chip-n:text-is("5")'); await settle(350);
  const s1 = await sets(1);
  ok(s1[0][1] === '5' && s1[0][2] && s1[0][3], 'picking 5 logs the set as a miss at 5 reps');
  ok(await ev(() => S.restTimer && S.restTimer.total > 0), 'and the rest timer starts, because the round is over');
  ok(/Bench/.test(await page.textContent('#sw-card .sw-name')) && /Set 2 of 3/.test(await page.textContent('#sw-card .sw-meta')), 'then the next round starts at bench set 2');
  ok(await page.isVisible('#rest-pill.on'), 'the rest pill shows on the card screen');

  console.log('• changing the load on the card');
  await page.click('#sw-card .sw-f:first-child .sw-st >> nth=1'); await settle(150);
  ok((await ev(() => S.activeWorkout.exercises[0].sets.map(s => s.w))).join() === '135,140,140', 'plus is one plate step, and it carries to the sets still to do');
  await page.click('#sw-card .sw-f:last-child .sw-st >> nth=0'); await settle(150);
  await drag(-170);
  ok((await sets(0))[1][1] === '7' && (await sets(0))[1][3] && !(await page.isVisible('.sw-ask')), 'reps you changed yourself are used for a miss without asking');
  await page.click('.sw-yes'); await settle(450);
  ok((await sets(1))[1][2] === true, 'the green button logs the set, same as a swipe');
  await page.click('.sw-mini:has-text("Undo")'); await settle(250);
  ok((await sets(1))[1][2] === false, 'Undo takes it back');
  await page.click('.sw-mini:has-text("Skip")'); await settle(250);
  ok((await sets(1))[1][4] === true && !(await sets(1))[1][2], 'Skip leaves the set undone, with no data');

  console.log('• a blocked swipe');
  await ev(() => { const s = S.activeWorkout.exercises[0].sets[2]; s.w = ''; });
  await ev(() => { S.activeWorkout.exercises[0].sets[2].done = false; S.activeWorkout.exercises[1].sets.forEach(s => { s.done = true; }); S.activeWorkout.exercises[0].sets[1].done = true; render(); }); await settle(250);
  ok(/Bench/.test(await page.textContent('#sw-card .sw-name')), 'bench set 3 has no weight');
  await drag(170);
  ok(await page.isVisible('#sw-card') && (await sets(0))[2][2] === false && /Set the weight first/.test(await page.textContent('.toast')), 'swiping a weighted lift with no weight is refused, and the card stays');

  console.log('• the finish card, and back to the list');
  await ev(() => { S.activeWorkout.exercises.forEach(e => e.sets.forEach(s => { s.done = true; })); render(); }); await settle(250);
  ok(await page.isVisible('.sw-done button:has-text("Finish workout")') && /All sets done/.test(await page.textContent('.sw-done')), 'with every set handled, the card is a finish screen');
  await shot('313-swipe-done');
  await page.click('.sw-done button:has-text("Back to the list")'); await settle(300);
  ok(await page.isVisible('.exb') && !(await page.isVisible('#sw-card')), 'back to the list is one tap');

  console.log('• Super Simple');
  await ev(() => { S.activeWorkout.exercises.forEach(e => e.sets.forEach(s => { s.done = false; delete s.fail; delete s.skip; s.w = e.exId === 'bb-bench' ? '135' : ''; s.r = e.timed ? '45' : '8'; })); render(); }); await settle(250);
  await page.click('.fbar button:has-text("Swipe")'); await settle(300);
  await page.click('#swipe-ov .mode-card:has-text("Super Simple")'); await settle(350);
  ok(await page.locator('#sw-card .sw-st').count() === 0 && await page.locator('.sw-mini:has-text("Skip")').count() === 0 && await page.locator('#sw-card .sw-tag').count() === 0
    && /135/.test(await page.textContent('#sw-card .ss-row >> nth=0')) && /8/.test(await page.textContent('#sw-card .ss-row >> nth=1')) && await page.locator('#sw-card .sw-rail i').count() === 3, 'the rail, the lift and the numbers as a scoreboard: no steppers, tags or Skip');
  ok(!(await page.isVisible('#nav')), 'the tab bar steps aside while swiping');
  await shot('313-swipe-super');
  await page.click('#sw-card .ss-row >> nth=0'); await settle(200);
  ok(await page.locator('#sw-card .ss-row.on .ss-pm').count() === 2 && await page.locator('#sw-card .ss-row.on').count() === 1, 'tapping the weight turns that row into − + in place, the reps stay as they are');
  await page.click('#sw-card .ss-row.on .ss-pm >> nth=1'); await settle(150);
  ok(parseFloat(await ev(() => S.activeWorkout.exercises[0].sets[0].w)) > 135, '+ adds weight');
  await page.click('#sw-card .ss-row.on .ss-ok'); await settle(150);
  ok(await page.locator('#sw-card .ss-row.on').count() === 0, 'Done puts it back');
  await drag(55);
  ok((await sets(0))[0][2], 'it swipes the same way, and a quick short flick is enough');
  ok(!(await page.isVisible('#sw-rest-ring')) && await ev(() => !S.restTimer), 'no rest between the two halves of a superset');
  await drag(120); await settle(400);
  ok(await page.isVisible('#sw-rest-ring') && !(await page.isVisible('#rest-pill.on')), 'after the round, the rest is a ring on the card (not the header pill)');
  await page.reload({ waitUntil: 'load' }); await settle(700);
  ok(await page.isVisible('#sw-rest, #sw-card') && await ev(() => S.activeWorkout._swipe === 'super'), 'a reload puts you back where you were');
  await ev(() => skipRest()); await settle(250);
  await page.click('.fbar button:has-text("List")'); await settle(300);

  console.log('• pyramid and Last on the list');
  await ev(() => { S.activeWorkout.exercises[1].sets.forEach(s => { s.done = false; delete s.fail; s.r = '8'; }); if (S.restTimer) skipRest(); render(); }); await settle(250);
  // Pyramid lives in each lift's ⋯ menu, on bodyweight lifts only
  const pyr = async ei => { await ev(i => showExMenu(i), ei); await settle(250); const n = await page.locator('#exm-ov button:has-text("Pyramid")').count(); return n; };
  const pyrBench = await pyr(0); await ev(() => closeOv('exm-ov')); await settle(250);
  const pyrPull = await pyr(1);
  ok(pyrBench === 0 && pyrPull === 1, 'Pyramid is offered on the bodyweight lift only, not on the bench');
  await page.click('#exm-ov button:has-text("Pyramid")'); await settle(500);
  await shot('313-pyramid');
  await page.click('#pyr-shape .seg-b:has-text("Up & down")'); await page.click('#pyr-step .seg-b:text-is("2")'); await settle(120);
  ok(/\b8\b.*\b10\b.*\b8\b/.test(await page.textContent('#pyr-prev')), 'the sheet previews the shape before applying it');
  await page.click('#pyr-ov button:has-text("Apply")'); await settle(350);
  ok(JSON.stringify(await ev(() => S.activeWorkout.exercises[1].sets.map(s => s.r))) === '["8","10","8"]', 'Apply rewrites the reps of the sets still to do');
  await page.click('.toast button:has-text("Undo")'); await settle(250);
  ok(JSON.stringify(await ev(() => S.activeWorkout.exercises[1].sets.map(s => s.r))) === '["8","8","8"]', 'and it can be undone');
  // Last: give the bench a history, then tap the chip
  await ev(() => {
    S.workouts.unshift({ id: 'old', name: 'Old', started: Date.now() - 7 * 864e5, ended: Date.now() - 7 * 864e5 + 36e5, exercises: [{ exId: 'bb-bench', sets: [{ w: '125', r: '10', done: true }, { w: '125', r: '9', done: true }, { w: '125', r: '8', done: true }] }] });
    S.activeWorkout.exercises[0].aim = null; rebuildPRs(); save();
    const ex = sessionExercise('bb-bench', null, { exId: 'bb-bench', sets: 3, r: '8' }); ex.link = null; S.activeWorkout.exercises.splice(0, 1, ex); render();
  }); await settle(300);
  ok(await page.isVisible('#exb-0 .fact-last'), 'Last is a tappable chip');
  await page.click('#exb-0 .fact-last'); await settle(300);
  ok(JSON.stringify(await ev(() => S.activeWorkout.exercises[0].sets.map(s => [s.w, s.r]))) === '[["125","10"],["125","9"],["125","8"]]', 'tapping it copies last week into the sets');

  console.log('• finishing can be cancelled, and a save can be taken back');
  await page.click('.fbar button:has-text("Finish")'); await settle(300);
  await page.click('#fin-ov button:has-text("Cancel")'); await settle(250);
  ok(!(await page.isVisible('#fin-ov')) && await ev(() => !!S.activeWorkout), 'Cancel in the finish sheet changes nothing');
  const n0 = await ev(() => S.workouts.length);
  await page.click('.fbar button:has-text("Finish")'); await settle(300);
  await page.click('#fin-ov button:has-text("Save Workout")'); await settle(350);
  ok(await ev(() => !S.activeWorkout) && await ev(() => S.workouts.length) === n0 + 1, 'saving files the workout');
  await page.click('.toast button:has-text("Undo")'); await settle(350);
  ok(await ev(() => !!S.activeWorkout && S.workouts.length) === n0 && await page.isVisible('.fbar'), 'Undo on the toast reopens it, and history is back to how it was');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close(); srv.close();
  if (failures.length) { console.log('\nFAILED — ' + failures.length + ' problem(s):\n - ' + failures.join('\n - ')); process.exit(1); }
  console.log('\nAll swipe checks passed.\nScreenshots: test/e2e/out');
})().catch(e => { console.error(e); process.exit(1); });
