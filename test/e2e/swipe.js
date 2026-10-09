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

  await page.goto(base + '/dist/index.html', { waitUntil: 'load' }); await settle(600);
  await ev(() => {
    S.onboarded = true; S.name = 'Swipe'; S.tab = 'workout'; save();
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
  ok(await page.isVisible('#sw-card') && /Bench/.test(await page.textContent('#sw-card .sw-name')) && /Superset · 1 of 2/.test(await page.textContent('#sw-card .sw-top')) && /Set 1 of 3/.test(await page.textContent('#sw-card .sw-top')), 'the first card is bench, set 1 of 3, the first half of a superset');
  ok(await page.locator('#sw-card .sw-st').count() === 4, 'weight and reps each have a minus and a plus');
  await shot('313-swipe-simple');
  await drag(30);
  ok(JSON.stringify((await sets(0))[0]) === '["135","8",false,false,false]', 'a short drag springs back and logs nothing');
  await drag(0, 140);
  ok((await sets(0))[0][2] === false, 'a vertical drag is a scroll, not a swipe');
  await drag(170);
  const s0 = await sets(0);
  ok(s0[0][2] && !s0[0][3], 'a long swipe right logs set 1 as done');
  ok(/Pull/.test(await page.textContent('#sw-card .sw-name')) && /Superset · 2 of 2/.test(await page.textContent('#sw-card .sw-top')), 'and the next card is the other half of the superset');
  ok(await ev(() => S.restTimer === null), 'no rest between the two halves of a superset');

  console.log('• missing a set');
  await drag(-170);
  ok(await page.isVisible('.sw-ask') && /How many reps did you get/.test(await page.textContent('.sw-ask')) && (await sets(1))[0][2] === false, 'a long swipe left asks how many reps you got, and logs nothing yet');
  await shot('313-swipe-ask');
  await page.click('.sw-chips .sw-chip-n:text-is("5")'); await settle(350);
  const s1 = await sets(1);
  ok(s1[0][1] === '5' && s1[0][2] && s1[0][3], 'picking 5 logs the set as a miss at 5 reps');
  ok(await ev(() => S.restTimer && S.restTimer.total > 0), 'and the rest timer starts, because the round is over');
  ok(/Bench/.test(await page.textContent('#sw-card .sw-name')) && /Set 2 of 3/.test(await page.textContent('#sw-card .sw-top')), 'then the next round starts at bench set 2');
  ok(await page.isVisible('#rest-pill.on'), 'the rest pill shows on the card screen');

  console.log('• changing the load on the card');
  await page.click('#sw-card .sw-f:first-child .sw-st:last-child'); await settle(150);
  ok((await ev(() => S.activeWorkout.exercises[0].sets.map(s => s.w))).join() === '135,140,140', 'plus is one plate step, and it carries to the sets still to do');
  await page.click('#sw-card .sw-f:last-child .sw-st:first-child'); await settle(150);
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
  ok(await page.locator('#sw-card .sw-st').count() === 0 && await page.locator('.sw-mini:has-text("Skip")').count() === 0 && /135 lbs? × 8/.test(await page.textContent('#sw-card .sw-big')), 'nothing on the card but the lift and the target');
  await shot('313-swipe-super');
  await drag(170);
  ok((await sets(0))[0][2], 'it swipes the same way');
  await page.reload({ waitUntil: 'load' }); await settle(700);
  ok(await page.isVisible('#sw-card') && await ev(() => S.activeWorkout._swipe === 'super'), 'a reload puts you back on the card you were on');
  await page.click('.fbar button:has-text("List")'); await settle(300);

  console.log('• pyramid and Last on the list');
  ok(await page.locator('.exb .fbtn:has-text("Pyramid")').count() === 1 && await page.locator('#exb-1 .fbtn:has-text("Pyramid")').count() === 1, 'Pyramid is offered on the bodyweight lift only, not on the bench or the plank');
  await page.click('.exb:has-text("Pull-Up") .fbtn:has-text("Pyramid")'); await settle(300);
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

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close(); srv.close();
  if (failures.length) { console.log('\nFAILED — ' + failures.length + ' problem(s):\n - ' + failures.join('\n - ')); process.exit(1); }
  console.log('\nAll swipe checks passed.\nScreenshots: test/e2e/out');
})().catch(e => { console.error(e); process.exit(1); });
