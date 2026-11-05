#!/usr/bin/env node
// Touch targets: every control on every main screen and sheet can be touched over at least 44×44 pt
// (Apple's minimum), however small it is drawn. For each control, a finger is moved out from its
// centre one point at a time, up, down, left and right, until it lands on something else. The span
// it covers must reach 22 pt from the centre on every side, unless it runs into another control there
// (a tight row of buttons shares the space between them) or the edge of the screen. Diagram regions (the body
// map, chart columns) are left as drawn. See "Touch targets" at the end of src/styles.css.
//   node build.js && node test/e2e/targets.js        (LW_ENGINE=webkit for WebKit)
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { devices, launch, engineName } = require('./engine.js');
const { demoState } = require('../../tools/demo-state.js');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const MIN = 44;
const SCREENS = [
  ['Home', 'go("workout")'], ['Workout tab', 'go("library")'], ['Nutrition', 'go("nutrition")'], ['Progress', 'go("progress")'], ['Coach', 'go("coach")'],
  ['Settings', 'showSettings()'], ['Settings › Workout', 'showSettings();showSetPage("workout")'], ['Log Activity', 'showLogActivity()'], ['New workout', 'showCreateRoutine()'],
  ['Log meal', 'go("nutrition");showAddMeal()'], ['Meal plan', 'go("nutrition");showMealPlan()'], ['History', 'go("progress");setProgView("history")'],
  ['Patterns', 'showPatterns()'], ['Month report', 'showReport("month")'], ['Program editor', 'showProgramEditor()'], ['Exercise', 'showExDetail("bb-bench")'],
  ['Form', 'showForm("bb-bench")'], ['Modes', 'showModes()'], ['Habits', 'showHabitsSheet()'], ['Calendar', 'showCalendar("all")'],
  ['Chart builder', 'go("progress");showChartBuilder()'], ['Import', 'showAppImport()'], ['Workout editor', 'showRoutineDetail(S.routines[0].id)'],
  ['Workout in progress', 'go("library");startWorkout(S.routines[0].id)'], ['Food targets', 'showMacroGoals()'], ['Grocery list', 'showGroceryList(0)'],
];

function serve() {
  const srv = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(DIST, path.normalize(name).replace(/^(\.\.[\/\\])+/, ''));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

// In the page: measure every control in the top sheet (or the screen).
function measure(MIN) {
  const SEL = 'button, a[href], [onclick], [role=button], [role=switch], input:not([type=hidden]), select, textarea, .seg-b, .chip, label:has(input[type=checkbox])';
  const ovs = [...document.querySelectorAll('.ov')]; const root = ovs.length ? ovs[ovs.length - 1] : document.getElementById('app') || document.body;
  const isCtl = el => !!el && el.nodeType === 1 && el.matches && el.matches(SEL);
  const owner = el => { for (let n = el; n && n !== document.body; n = n.parentElement) if (isCtl(n)) return n; return null; };
  const out = [];
  for (const el of root.querySelectorAll(SEL)) {
    if (el.closest('svg')) continue;                                     // diagram regions
    if (el.parentElement && owner(el.parentElement) && !el.matches('input,select,textarea')) continue; // count the outer control once
    if (el.disabled || el.getAttribute('aria-hidden') === 'true') continue;
    let r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') continue;
    el.scrollIntoView({ block: 'center', inline: 'center' }); r = el.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const at = (x, y) => { const t = document.elementFromPoint(x, y); return t ? owner(t) : null; };
    if (at(cx, cy) !== el) continue;                                      // covered by something else (not on show)
    const reach = (dx, dy) => { let d = 0, why = 'edge'; for (let i = 1; i <= 40; i++) { const x = cx + dx * i, y = cy + dy * i; if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) { why = 'edge'; break; } const o = at(x, y); if (o !== el) { why = o ? 'control' : 'nothing'; break; } d = i; } return { d, why }; };
    const u = reach(0, -1), dn = reach(0, 1), l = reach(-1, 0), rt = reach(1, 0);
    const spanY = u.d + dn.d + 1, spanX = l.d + rt.d + 1;
    // Each side must reach half of 44 from the centre, or end on another control (a tight row shares
    // the space between its buttons) or the screen's edge: a finger never lands in a dead gap.
    const half = MIN / 2 - 2; // measured at whole points from a rounded centre: 1 pt each side for rounding
    const side = s => s.d >= half || s.why !== 'nothing';
    const okY = side(u) && side(dn), okX = side(l) && side(rt);
    const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean)[0] || '';
    let clip = ''; for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const c = getComputedStyle(n); if (c.overflowX !== 'visible' || c.overflowY !== 'visible') { clip = n.tagName.toLowerCase() + '.' + ((n.getAttribute('class') || '').split(/\s+/)[0] || n.id || '?') + '(' + c.overflowX + '/' + c.overflowY + ')'; break; } }
    out.push({ sides: [u, dn, l, rt].map(x => x.d + x.why[0]).join(' '), clip, kind: el.tagName.toLowerCase() + (cls ? '.' + cls : ''), label: (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), spanX, spanY, ok: okX && okY });
  }
  return out;
}

(async () => {
  console.log('Engine: ' + engineName);
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await launch();
  const t10 = new Date(); t10.setHours(10, 0, 0, 0);
  const st = demoState(t10.getTime());
  st.modules = Object.assign({}, st.modules || {}, { nutrition: true, body: true, cardio: true, habits: true, patterns: true, music: true });
  const failures = []; let total = 0; const errs = [];
  for (const [name, code] of SCREENS) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, r => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message));
    await page.clock.install({ time: t10 }); await page.clock.resume();
    await page.addInitScript(s => { localStorage.setItem('lahwe_v2', s); }, JSON.stringify(st));
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof S === 'object' && Store.ready, null, { timeout: 15000 });
    await page.evaluate(c => (new Function(c))(), code); await page.waitForTimeout(700);
    const res = await page.evaluate(measure, MIN);
    total += res.length;
    const bad = res.filter(r => !r.ok);
    console.log(`${bad.length ? '  ✗' : '  ✓'} ${name}: ${res.length} controls${bad.length ? ', ' + bad.length + ' too small to touch' : ''}`);
    bad.slice(0, 8).forEach(b => { console.log(`      ${b.kind} "${b.label}" drawn ${b.w}×${b.h}, touchable ${b.spanX}×${b.spanY} [up down left right: ${b.sides}]${b.clip ? ' (inside ' + b.clip + ')' : ''}`); failures.push(`${name}: ${b.kind} "${b.label}" touchable ${b.spanX}×${b.spanY}`); });
    if (bad.length > 8) failures.push(`${name}: ${bad.length - 8} more`);
    await ctx.close();
  }
  if (errs.length) failures.push('page errors: ' + errs.join(' | '));
  console.log(`\n${total} controls on ${SCREENS.length} screens.`);
  console.log(failures.length ? `FAILED — ${failures.length} problem(s):\n - ` + failures.join('\n - ') : 'Every control can be touched over at least 44 × 44 pt.');
  await browser.close(); srv.close();
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
