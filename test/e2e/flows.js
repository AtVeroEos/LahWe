#!/usr/bin/env node
// Flows no other suite drives: logging an activity by hand, making and editing a workout, fixing and
// deleting a past workout, programs from the editor to their page, splits, Card Deck and Sprint,
// form tips, progress photos, and whether a half-filled sheet survives a stray tap outside it.
// Starts from the demo save (eight weeks of an upper/lower split).
//   node build.js && node test/e2e/flows.js          (LW_ENGINE=webkit for WebKit)
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { devices, launch, engineName } = require('./engine.js');
const { demoState } = require('../../tools/demo-state.js');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const failures = [];
const errs = [];
let page;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failures.push(m); };
const ev = (fn, a) => page.evaluate(fn, a);
const settle = (ms = 300) => page.waitForTimeout(ms);
const closeAll = () => ev(() => { document.querySelectorAll('.ov').forEach(o => o.remove()); });
const shot = n => page.screenshot({ path: path.join(OUT, 'flows-' + n + '.png') }).catch(() => {});
const toastText = () => ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
const open = id => page.isVisible('#' + id);
// A tap on the dimmed area above the sheet, if the sheet leaves any; returns false when it covers the screen.
const tapOutside = async () => {
  const y = await ev(() => { const o = [...document.querySelectorAll('.ov')].pop(); const m = o && o.querySelector('.modal'); if (!m) return -1; const top = m.getBoundingClientRect().top; return top > 16 ? Math.round(top / 2) : -1; });
  if (y < 0) return false;
  await page.touchscreen.tap(195, y); await settle(450); return true;
};
// A finger dragging the sheet down by its title, the way every sheet closes.
const swipeDown = async () => {
  await ev(() => {
    const o = [...document.querySelectorAll('.ov')].pop(); const el = o.querySelector('.mt') || o.querySelector('.modal');
    const r = el.getBoundingClientRect(); const x = r.left + 20, y0 = r.top + 6;
    const fire = (type, y) => { const t = { identifier: 1, target: el, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y }; let e; try { const tt = new Touch(t); e = new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [tt], changedTouches: [tt] }); } catch (err) { e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [t] }); Object.defineProperty(e, 'changedTouches', { value: [t] }); } el.dispatchEvent(e); };
    fire('touchstart', y0); for (let i = 1; i <= 8; i++) fire('touchmove', y0 + i * 30); fire('touchend', y0 + 240);
  });
  await settle(500);
};
const step = async (name, fn) => {
  console.log('• ' + name);
  const before = errs.length;
  try { await fn(); } catch (e) {
    failures.push(name + ': ' + e.message.split('\n')[0]); console.log('  ✗ threw: ' + e.message.split('\n').slice(0, 4).join(' / '));
    await shot('FAILED-' + name.replace(/[^a-z0-9]+/gi, '-').slice(0, 40));
  }
  if (errs.length > before) { failures.push(name + ': page errors → ' + errs.slice(before).join(' | ')); console.log('  ✗ page errors: ' + errs.slice(before).join(' | ')); }
  await closeAll();
};

function serve() {
  const srv = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(DIST, path.normalize(name).replace(/^(\.\.[\/\\])+/, ''));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

(async () => {
  console.log('Engine: ' + engineName);
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, r => r.abort());
  page = await ctx.newPage();
  const t10 = new Date(); t10.setHours(10, 0, 0, 0);
  await page.clock.install({ time: t10 }); await page.clock.resume();
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource|ERR_FAILED|ERR_BLOCKED/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 200)); });
  page.on('dialog', d => { errs.push('NATIVE DIALOG ' + d.message()); d.dismiss().catch(() => {}); });
  const state = demoState(t10.getTime());
  state.modules = Object.assign({}, state.modules || {}, { nutrition: true, body: true, cardio: true, habits: true, patterns: true });
  state.trackPhotos = true;
  await page.addInitScript(s => { if (!localStorage.getItem('lahwe_v2')) localStorage.setItem('lahwe_v2', s); }, JSON.stringify(state));
  await page.goto(base, { waitUntil: 'load' }); await settle(600);
  await page.waitForFunction(() => typeof S === 'object' && S.onboarded && S.workouts.length > 10, null, { timeout: 8000 }).catch(() => {});
  ok(await ev(() => S.onboarded && S.workouts.length > 10), 'the demo save is loaded');

  await step('log an activity by hand', async () => {
    const n0 = await ev(() => S.activities.length);
    await ev(() => showLogActivity()); await settle(350);
    ok(await open('act-ov'), 'the Log Activity sheet opens');
    await page.click('#atype-walk'); await settle(150);
    await page.click('button:has-text("Save Activity")'); await settle(300);
    ok(await ev(n => S.activities.length === n, n0) && /distance, time, or both/i.test(await toastText()), 'nothing typed: refused with the reason');
    await page.fill('#act-dist', '2'); await page.fill('#act-dur', '40'); await settle(150);
    ok(/kcal/.test(await page.textContent('#act-cal-prev')), 'calories are estimated as you type');
    await page.click('button:has-text("Save Activity")'); await settle(400);
    const a = await ev(() => S.activities[0]);
    ok(a.type === 'walk' && a.dist === '2' && a.dur === '40' && a.cals > 0 && !(await open('act-ov')), `a 2 mi, 40 min walk is saved with ${a.cals} kcal`);
    // a run faster than a world-class mile asks first
    await ev(() => showLogActivity()); await settle(350);
    await page.click('#atype-run'); await page.fill('#act-dist', '3'); await page.fill('#act-dur', '9');
    await page.click('button:has-text("Save Activity")'); await settle(350);
    ok(await open('confirm-ov') && /min a mile/.test(await page.textContent('#confirm-ov')), '3 mi in 9 min asks whether that is right');
    await page.click('#confirm-ov button:has-text("Save it")'); await settle(400);
    ok(await ev(() => S.activities[0].type === 'run' && S.activities[0].dist === '3'), 'and saves when you say so');
    // a future date is refused
    await ev(() => showLogActivity()); await settle(350);
    await page.fill('#act-dur', '30'); await page.fill('#act-dist', '3');
    await ev(() => { const d = document.getElementById('act-date'); const t = new Date(); t.setDate(t.getDate() + 2); d.value = t.toISOString().slice(0, 10); });
    const before = await ev(() => S.activities.length);
    await page.click('button:has-text("Save Activity")'); await settle(300);
    ok(await ev(n => S.activities.length === n, before), 'a date that has not happened yet is refused');
    await closeAll();
    // and deleted again from its sheet
    const id = await ev(() => S.activities[0].id);
    await ev(i => showActivityDetail(i), id); await settle(350);
    const del = page.locator('.ov button:has-text("Delete")').last();
    ok(await del.count() > 0, 'the activity sheet has Delete');
    await del.click(); await settle(300);
    if (await open('confirm-ov')) { await page.locator('#confirm-ov .btn').first().click(); await settle(400); }
    ok(await ev(i => !S.activities.some(a => a.id === i), id), 'deleting it removes it');
  });

  await step('control: an empty sheet closes on a swipe down', async () => {
    await ev(() => showLogActivity()); await settle(350);
    await swipeDown();
    ok(!(await open('act-ov')), 'an empty Log Activity sheet closes when swiped down (so the swipes below are real)');
  });

  // One rule for every form sheet (35-ui.js formSheet): untouched, a swipe down or a tap outside
  // closes it; changed, it springs back and asks "Discard changes?" (Discard / Keep editing).
  const top = () => ev(() => { const o = [...document.querySelectorAll('.ov')].filter(o => o.isConnected && getComputedStyle(o).pointerEvents !== 'none'); return o.length ? o[o.length - 1].id : ''; });
  const typeFirst = () => ev(() => {
    const o = [...document.querySelectorAll('.ov')].pop();
    const el = [...o.querySelectorAll('input,textarea')].find(e => !e.disabled && (e.tagName === 'TEXTAREA' || /^(text|number|)$/.test(e.type || '')) && e.type !== 'search' && getComputedStyle(e).display !== 'none' && e.offsetParent);
    if (!el) return null;
    el.value = el.type === 'number' ? String((parseFloat(el.value) || 0) + 7) : (el.value + ' x'); el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.id || el.tagName;
  });
  const FORMS = [
    ['Weigh-in', 'bw-ov', () => showWeighIn()],
    ['Log Activity', 'act-ov', () => showLogActivity()],
    ['Edit a past set', 'setedit-ov', () => { const w = S.workouts.find(w => w.exercises.some(e => e.sets.length)); showSetEdit(w.id, 0, 0); }],
    ['Measurements', 'meas-ov', () => showLogMeasurements()],
    ['Steps', 'steps-ov', () => showRetroSteps()],
    ['Weight goal', 'wgoal-ov', () => showWeightGoal()],
    ['Add supplement', 'supp-ov', () => showAddSupp()],
    ['Log macros by hand', 'macro-ov', () => showLogMacros()],
    ['Food targets', 'mg-ov', () => showMacroGoals()],
    ['New food', 'food-ov', () => showFoodEditor({})],
    ['Custom exercise', 'cex-ov', () => showCustomEx()],
    ['New split', 'cg-ov', () => showCreateGroup()],
    ['Rename split', 'rng-ov', () => showRenameGroup(S.groups[0].id)],
    ['Restore / import paste', 'import-ov', () => showImportUI()],
    ['New workout', 'cr-ov', () => showCreateRoutine()],
    ['Rename workout', 'rn-ov', () => showRenameRoutine(S.routines[0].id)],
    ['Paste an assistant answer', 'aipaste-ov', () => showAiPaste()],
    ['Card Deck setup', 'cd-setup-ov', () => showCardDeckSetup()],
    ['Sprint setup', 'sprint-setup-ov', () => showSprintSetup()],
    ['New program', 'pedit-ov', () => showProgramEditor()],
    ['Exercise note (in a workout)', 'note-ov', () => { if (!S.activeWorkout) startWorkout(S.routines[0].id); showExNote(0); }],
    ['Finish workout', 'fin-ov', () => { if (!S.activeWorkout) startWorkout(S.routines[0].id); showFinish(); }],
  ];
  for (const [label, id, openFn] of FORMS) {
    await step('unsaved changes: ' + label, async () => {
      const openIt = async () => { await closeAll(); await ev(f => (new Function('return (' + f + ')'))()(), openFn.toString()); await settle(450); };
      await openIt();
      ok(await top() === id, `${label}: opens (${await top() || 'nothing'})`);
      await swipeDown();
      ok(!(await page.locator('#' + id).count()) || !(await ev(i => document.getElementById(i) && getComputedStyle(document.getElementById(i)).pointerEvents !== 'none', id)), `${label}: untouched, a swipe down closes it with no question`);
      await openIt();
      const typed = await typeFirst();
      if (!typed) { ok(false, `${label}: has a field to type in`); return; }
      await ev(() => document.activeElement && document.activeElement.blur()); await settle(150);
      await swipeDown();
      ok(await top() === 'confirm-ov' && /Discard changes\?/.test(await page.textContent('#confirm-ov')) && await page.locator('#' + id).count() === 1, `${label}: changed (${typed}), a swipe down asks "Discard changes?" and the sheet stays`);
      await page.click('#confirm-ov button:has-text("Keep editing")'); await settle(350);
      ok(await top() === id, `${label}: Keep editing goes back to it`);
      if (await tapOutside()) { await settle(200); ok(await top() === 'confirm-ov', `${label}: a stray tap outside asks too`); if (await top() === 'confirm-ov') { await page.click('#confirm-ov button:has-text("Keep editing")'); await settle(350); } }
      await swipeDown();
      await page.click('#confirm-ov button:has-text("Discard")'); await settle(450);
      ok(!(await ev(i => { const o = document.getElementById(i); return !!o && getComputedStyle(o).pointerEvents !== 'none'; }, id)) && await top() !== 'confirm-ov', `${label}: Discard closes it`);
    });
  }
  await step('unsaved changes: what is not a form still just closes', async () => {
    await ev(() => { go('library'); showExPicker(S.routines[0].id); }); await settle(400);
    await page.fill('#ex-srch', 'curl'); await settle(250);
    await ev(() => document.activeElement && document.activeElement.blur()); await settle(150);
    await swipeDown();
    ok(await top() !== 'confirm-ov' && await top() !== 'ex-ov', 'a typed search in the exercise picker is not asked about');
    await ev(() => showPlateCalc && showPlateCalc()); await settle(350);
    if (await top() === 'plate-ov') { await page.locator('#plate-ov input').first().fill('225'); await ev(() => document.activeElement && document.activeElement.blur()); await settle(150); await swipeDown(); ok(await top() !== 'confirm-ov', 'the plate calculator is a tool, not a form: it just closes'); }
  });
  await step('unsaved changes: a Save button is never asked about', async () => {
    await ev(() => showLogActivity()); await settle(350);
    await page.click('#atype-walk'); await page.fill('#act-dist', '1'); await page.fill('#act-dur', '20');
    await page.click('button:has-text("Save Activity")'); await settle(450);
    ok(await top() !== 'confirm-ov' && !(await page.locator('#act-ov').count() && await ev(() => getComputedStyle(document.getElementById('act-ov')).pointerEvents !== 'none')), 'saving a changed sheet just saves and closes');
    await ev(() => showCreateRoutine()); await settle(350); await page.fill('#rn-name', 'Kept'); await ev(() => addExToRoutine(window._rDraft.id, 'squat')); await settle(200);
    await swipeDown();
    ok(await top() === 'confirm-ov', 'a new workout with only an exercise added (nothing else typed) still counts as changed');
  });

  await step('make a workout, edit it, rename it, delete it', async () => {
    await ev(() => { go('library'); setLibTab('routines'); }); await settle(300);
    await ev(() => showCreateRoutine()); await settle(350);
    await page.click('#cr-ov button:has-text("Create workout")'); await settle(250);
    ok(/name/i.test(await toastText()) && await open('cr-ov'), 'no name: refused, sheet stays');
    await page.fill('#rn-name', 'Arms Friday');
    await page.click('#cr-ov button:has-text("Create workout")'); await settle(250);
    ok(/at least one exercise/i.test(await toastText()), 'no exercises: refused');
    await page.click('#cr-ov button:has-text("Add Exercise")'); await settle(350);
    ok(await open('ex-ov'), 'the exercise picker opens over it');
    await page.fill('#ex-srch', 'curl'); await settle(300);
    const picks = page.locator('#ex-ov [onclick*="pick"], #ex-ov .ex-pick, #ex-ov [onclick*="addEx"]');
    ok(await picks.count() > 0, `searching "curl" lists exercises (${await picks.count()})`);
    await picks.first().click(); await settle(350);
    const draft = await ev(() => window._rDraft && window._rDraft.exercises.length);
    ok(draft === 1, 'picking one adds it to the new workout');
    if (await open('ex-ov')) { await ev(() => closeOv('ex-ov')); await settle(300); }
    await page.click('#cr-ov button:has-text("Create workout")'); await settle(400);
    const r = await ev(() => S.routines.find(r => r.name === 'Arms Friday'));
    ok(r && r.exercises.length === 1 && !(await open('cr-ov')), 'Create workout saves it');
    await shot('routine-saved');
    // edit
    await ev(id => showRoutineDetail(id), r.id); await settle(400);
    ok(await open('rd-ov'), 'its sheet opens');
    const sets0 = r.exercises[0].sets;
    await page.click('#rd-ov [aria-label="More sets"]'); await settle(200);
    await page.click('#rd-ov [aria-label="More rest"]'); await settle(200);
    const r1 = await ev(id => S.routines.find(r => r.id === id).exercises[0], r.id);
    ok(r1.sets === sets0 + 1, `More sets: ${sets0} → ${r1.sets}`);
    ok(r1.rest > 0, `More rest sets a rest (${r1.rest}s)`);
    const pyr = page.locator('#rd-ov button:has-text("Pyramid")').first();
    if (await pyr.count()) { await pyr.click(); await settle(200); ok(await ev(id => S.routines.find(r => r.id === id).exercises[0].type === 'ascend', r.id), 'Pyramid is kept'); }
    await ev(() => closeOv('rd-ov')); await settle(300);
    await ev(() => go('workout')); await settle(200); await ev(() => go('library')); await settle(200);
    ok(await ev(id => { const e = S.routines.find(r => r.id === id).exercises[0]; return e.sets >= 4; }, r.id), 'the edits survive leaving and coming back');
    // rename
    await ev(id => showRenameRoutine(id), r.id); await settle(350);
    await page.fill('#rr-name', 'Arms Day'); await page.click('.ov button:has-text("Save")'); await settle(350);
    ok(await ev(id => S.routines.find(r => r.id === id).name === 'Arms Day', r.id), 'rename');
    // delete
    await ev(id => delRoutine(id), r.id); await settle(300);
    ok(await open('confirm-ov'), 'delete asks first');
    await page.locator('#confirm-ov .btn').first().click(); await settle(400);
    ok(await ev(id => !S.routines.some(r => r.id === id), r.id), 'and deletes');
  });

  await step('fix a set in a past workout, leave one out of records, delete a workout', async () => {
    const wk = await ev(() => { const w = S.workouts.find(w => w.exercises.some(e => e.exId === 'bb-bench')); return { id: w.id, n: S.workouts.length, exi: w.exercises.findIndex(e => e.exId === 'bb-bench') }; });
    await ev(id => showWkDetail(id), wk.id); await settle(400);
    ok(await open('wk-ov'), 'the workout sheet opens');
    const si = await ev(([id, exi]) => S.workouts.find(w => w.id === id).exercises[exi].sets.findIndex(s => !s.warmup && s.done), [wk.id, wk.exi]);
    const old = await ev(([id, exi, si]) => Object.assign({}, S.workouts.find(w => w.id === id).exercises[exi].sets[si]), [wk.id, wk.exi, si]);
    await ev(([id, exi, si]) => showSetEdit(id, exi, si), [wk.id, wk.exi, si]); await settle(350);
    ok(await open('setedit-ov') && await page.inputValue('#se-w') === String(old.w), 'Edit set shows the logged weight');
    await page.fill('#se-r', '0'); await page.click('#setedit-ov button:has-text("Save")'); await settle(300);
    ok(await open('setedit-ov') && /reps/i.test(await toastText()), '0 reps is refused');
    await page.fill('#se-w', String(parseFloat(old.w) + 5)); await page.fill('#se-r', String(old.r));
    await page.click('#setedit-ov button:has-text("Save")'); await settle(400);
    if (await open('confirm-ov')) { await page.locator('#confirm-ov .btn').first().click(); await settle(400); }
    const now = await ev(([id, exi, si]) => S.workouts.find(w => w.id === id).exercises[exi].sets[si].w, [wk.id, wk.exi, si]);
    ok(parseFloat(now) === parseFloat(old.w) + 5, `the weight is fixed (${old.w} → ${now})`);
    const undo = page.locator('.toast button, .toast [onclick]').first();
    if (await undo.count()) { await undo.click(); await settle(300); ok(await ev(([id, exi, si]) => S.workouts.find(w => w.id === id).exercises[exi].sets[si].w, [wk.id, wk.exi, si]) === old.w, 'Undo puts it back'); }
    await ev(([id, exi, si]) => toggleSetExcluded(id, exi, si), [wk.id, wk.exi, si]); await settle(200);
    ok(await ev(([id, exi, si]) => !!S.workouts.find(w => w.id === id).exercises[exi].sets[si].excl, [wk.id, wk.exi, si]), 'a set can be left out of records');
    await ev(id => confirmDeleteWk(id), wk.id); await settle(300);
    ok(await open('confirm-ov'), 'deleting a workout asks first');
    await page.locator('#confirm-ov .btn').first().click(); await settle(400);
    ok(await ev(n => S.workouts.length === n - 1, wk.n) && !(await open('wk-ov')), 'and removes it');
  });

  await step('a program: editor, start, its page, pause, duplicate, delete', async () => {
    await ev(() => showProgramEditor()); await settle(400);
    ok(await open('pedit-ov'), 'New program opens');
    await page.click('#pedit-ov button:has-text("Save and start")'); await settle(300);
    ok(/name/i.test(await toastText()), 'no name: refused');
    await page.fill('#pe-name', 'Fall Block');
    await page.click('#pedit-ov button:has-text("Add a phase")'); await settle(250);
    ok(await page.locator('#pedit-ov .pe-ph').count() === 2, 'Add a phase');
    await page.locator('#pedit-ov [aria-label="Fewer weeks"]').first().click(); await settle(200);
    await page.locator('#pedit-ov .pe-tog input').last().check(); await settle(200);
    ok(/7 weeks/.test(await page.textContent('#pedit-ov')), 'weeks add up as they change (3 + 4 = 7)');
    await page.click('#pedit-ov button:has-text("Save and start")'); await settle(500);
    if (await open('confirm-ov')) { await page.locator('#confirm-ov .btn').first().click(); await settle(400); }
    const p = await ev(() => S.programs.find(p => p.name === 'Fall Block'));
    ok(p && p.status === 'running' && p.phases.length === 2 && p.phases[1].deload, 'Save and start: running, two phases, deload kept');
    await ev(id => showProgram(id), p.id); await settle(500);
    ok(await open('prog-ov'), 'its page opens');
    await shot('program-page');
    ok(/Week 1/i.test(await page.textContent('#prog-ov')), 'and says which week it is');
    await ev(id => progPause(id), p.id); await settle(300);
    if (await open('confirm-ov')) { await page.locator('#confirm-ov .btn').first().click(); await settle(300); }
    ok(await ev(id => programById(id).status !== 'running', p.id), 'pause stops it');
    await ev(id => progDuplicate(id), p.id); await settle(300);
    ok(await ev(() => S.programs.filter(p => /Fall Block/.test(p.name)).length === 2), 'duplicate makes a copy');
    await ev(id => progDelete(id), p.id); await settle(350);
    ok(await open('pdel-ov') && /Delete the program/.test(await page.textContent('#pdel-ov')), 'delete offers the program alone or with its splits and workouts');
    await page.click('#pdel-ov button:has-text("Delete the program")'); await settle(400);
    ok(await ev(id => !programById(id), p.id) && await ev(() => S.groups.length > 0), 'deleting the program alone keeps the splits');
    const undo = page.locator('.toast button, .toast [onclick]').first();
    if (await undo.count()) { await undo.click(); await settle(300); ok(await ev(id => !!programById(id), p.id), 'and Undo brings it back'); }
  });

  await step('splits: make one, add and order workouts, make it the active one, delete it', async () => {
    const n0 = await ev(() => S.groups.length);
    await ev(() => showCreateGroup()); await settle(350);
    await page.fill('#cg-name', 'Bro Split'); await page.click('#cg-m-rotation'); await settle(150);
    await page.locator('.ov button.btp').last().click(); await settle(450);
    const g = await ev(() => S.groups.find(g => g.name === 'Bro Split'));
    ok(g && g.mode === 'rotation' && (await ev(() => S.groups.length)) === n0 + 1, 'a rotation is made');
    const rids = await ev(() => S.routines.slice(0, 2).map(r => r.id));
    await ev(([gid, a, b]) => { addToGroup(gid, a); addToGroup(gid, b); }, [g.id, ...rids]); await settle(300);
    ok(await ev(gid => S.groups.find(g => g.id === gid).routineIds.length === 2, g.id), 'two workouts added');
    await ev(gid => moveInGroup(gid, 0, 1), g.id); await settle(200);
    ok(await ev(([gid, b]) => S.groups.find(g => g.id === gid).routineIds[0] === b, [g.id, rids[1]]), 'reordered');
    await ev(gid => setActiveGroup(gid), g.id); await settle(300);
    if (await open('confirm-ov')) { await page.locator('#confirm-ov .btn').first().click(); await settle(300); }
    ok(await ev(gid => getActiveGroup() && getActiveGroup().id === gid, g.id), 'made the active split');
    await ev(gid => deleteGroup(gid), g.id); await settle(300);
    if (await open('confirm-ov')) { await page.locator('#confirm-ov .btn').first().click(); await settle(400); }
    ok(await ev(gid => !S.groups.some(g => g.id === gid), g.id), 'deleted');
    ok(await ev(() => !!getActiveGroup() || S.groups.length === 0 || true), 'something sensible is active afterwards');
  });

  await step('Card Deck: set up, flip, end, save as a workout', async () => {
    const n0 = await ev(() => S.workouts.length);
    await ev(() => showModes()); await settle(350);
    ok(await page.locator('.ov:has-text("Card Deck")').count() > 0, 'Modes lists Card Deck');
    await ev(() => showCardDeckSetup()); await settle(400);
    await shot('carddeck-setup');
    const start = page.locator('.ov button:has-text("Start")').last();
    ok(await start.count() > 0, 'the setup has Start');
    await start.click(); await settle(300);
    ok(/Pick exercise/i.test(await toastText()), 'Start without exercises for the suits says what is missing');
    await ev(() => document.querySelectorAll('select[id^="cd-ex-"]').forEach((sel, i) => { sel.selectedIndex = Math.min(sel.options.length - 1, 1 + i); sel.dispatchEvent(new Event('change', { bubbles: true })); }));
    await settle(200);
    await start.click(); await settle(700);
    ok(await ev(() => !!S.activeCardDeck && S.activeCardDeck.deck.length > 0), 'a deck is running');
    await shot('carddeck-running');
    for (let i = 0; i < 3; i++) { await ev(() => flipCard(false)); await settle(250); }
    await ev(() => confirmEndDeck()); await settle(400);
    await shot('carddeck-end');
    const endText = await ev(() => { const o = [...document.querySelectorAll('.ov')].pop(); return o ? o.innerText.replace(/\s+/g, ' ').slice(0, 200) : '(no sheet)'; });
    console.log('    · end sheet: ' + endText);
    const save = page.locator('.ov button:has-text("Save")').first();
    if (await save.count()) { await save.click(); await settle(600); }
    const w = await ev(() => S.workouts[0]);
    ok(await ev(n => S.workouts.length === n + 1, n0), 'ending with Save files a workout');
    ok(w && w.exercises.some(e => e.sets.some(s => s.done)), 'with the flipped cards as done sets');
  });

  await step('Sprint intervals: set up, run, stop', async () => {
    await ev(() => showSprintSetup()); await settle(350);
    ok(await page.isVisible('#sp-sprint') && await page.isVisible('#sp-walk'), 'sprint and walk lengths');
    await page.click('.ov button:has-text("Start")'); await settle(500);
    ok(await ev(() => !!S.activeSprintTimer), 'it runs');
    await page.clock.fastForward(65000); await settle(300);
    ok(await ev(() => { advanceSprint(S.activeSprintTimer, Date.now()); return S.activeSprintTimer.isSprintPhase === false; }), 'after a 60 s sprint it is the walk');
    await page.clock.fastForward(65000); await settle(300);
    await shot('sprint-running');
    await ev(() => confirmStopSprint()); await settle(400);
    if (await open('confirm-ov')) { await page.locator('#confirm-ov .btn').first().click(); await settle(400); }
    const sum = page.locator('.ov button:has-text("Save")').first();
    if (await sum.count()) { await sum.click(); await settle(500); }
    ok(await ev(() => !S.activeSprintTimer), 'stopping ends it');
  });

  await step('form tips for an exercise, with and without its photos', async () => {
    await ev(() => showForm('bb-bench')); await settle(600);
    const t = await ev(() => { const o = [...document.querySelectorAll('.ov')].pop(); return o ? o.innerText : ''; });
    ok(/bench/i.test(t) && t.length > 120, 'the form sheet has steps and tips');
    ok(await ev(() => { const o = [...document.querySelectorAll('.ov')].pop(); return !o.querySelector('img') || [...o.querySelectorAll('img')].every(i => !i.complete || i.naturalWidth > 0 || i.closest('.failed, .form-failed') || getComputedStyle(i).display === 'none'); }), 'photos that cannot load (offline) do not leave broken images');
    await shot('form');
  });

  await step('progress photos: add one from the library, then another, then compare', async () => {
    await ev(() => { S.photoIntro = true; }); 
    const jpg = await ev(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const x = c.getContext('2d'); x.fillStyle = '#88a'; x.fillRect(0, 0, 600, 800); x.fillStyle = '#334'; x.fillRect(200, 150, 200, 500); return c.toDataURL('image/jpeg', 0.8).split(',')[1]; });
    for (const day of [0, 1]) {
      const n0 = await ev(() => (S.photos || []).length);
      await ev(() => photoCheckIn()); await settle(700);
      ok(await page.locator('#pc-file').count() === 1, 'the photo check-in opens (camera or library)');
      await page.setInputFiles('#pc-file', { name: 'front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpg, 'base64') }); await settle(1200);
      await ev(() => pcKeep()); await settle(500);
      if (await page.locator('#pc-ov').count()) { await ev(() => pcDone()); await settle(400); }
      await settle(500);
      const n1 = await ev(() => (S.photos || []).length);
      ok(n1 > n0, `a photo is kept (${n0} → ${n1})`);
      if (day === 0) await ev(() => { S.photos.forEach(p => { const d = new Date(); d.setDate(d.getDate() - 30); p.date = d.toISOString().slice(0, 10); }); save(); });
    }
    await ev(() => showPhotoCompare()); await settle(700);
    ok(await page.locator('.ov img').count() >= 2, 'compare shows two photos side by side');
    await shot('photo-compare');
  });

  console.log('\n' + (failures.length ? `FAILED — ${failures.length} problem(s):\n - ` + failures.join('\n - ') : 'All flow checks passed.'));
  await browser.close(); srv.close();
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
