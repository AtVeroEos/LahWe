#!/usr/bin/env node
// Security walk in a real browser at iPhone size:
//  • the page asks for nothing on the network except this server and the hosts the app is meant to use
//    (any other request fails the run, so a new dependency or tracker cannot slip in unnoticed);
//  • the content policy is never broken while the app is used (a violation fails the run, so the
//    policy cannot quietly block a feature either);
//  • text from other apps' exports, restored files and an assistant's pasted reply stays text on every
//    screen and dialog it reaches: the import flow, results, linking, removing, the paste preview,
//    custom charts, and the delete dialogs;
//  • the keys never show on any Settings page, only their last four characters.
//   node build.js && node test/e2e/security.js
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
let playwright;
try { playwright = require('playwright'); } catch (e) { try { playwright = require('/opt/npm-tools/node_modules/playwright'); } catch (e2) { console.error('Playwright is not installed'); process.exit(2); } }
const { chromium, devices } = playwright;
const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const F = require('../fixtures/app-import.js');
const { demoState } = require('../../tools/demo-state.js');

const failures = [];
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failures.push(m); };

// The only hosts the app may contact. Each is aborted here (nothing real is reached); the point is that
// a request to anything NOT on this list fails the test.
const ALLOWED = ['api.anthropic.com', 'api.openai.com', 'generativelanguage.googleapis.com', 'openrouter.ai', 'llm.example.test',
  'world.openfoodfacts.org', 'cdn.jsdelivr.net', 'accounts.spotify.com', 'api.spotify.com', 'www.youtube-nocookie.com'];
const TEXT = '"><img data-xss src=x onerror="window.__xss=1">\'';
const csvQ = s => '"' + String(s).replace(/"/g, '""') + '"';
const KEYS = { anthropic: 'sk-' + 'ant-' + 'api03-' + 'K'.repeat(40), openai: 'sk-' + 'proj-' + 'L'.repeat(40) };

function serve() {
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
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  const unexpected = [], allowedSeen = new Set();
  await ctx.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return r.continue();
    if (u.hostname === '127.0.0.1') return r.continue();
    if (ALLOWED.includes(u.hostname)) { allowedSeen.add(u.hostname); return r.abort(); }
    unexpected.push(r.request().method() + ' ' + u.origin + u.pathname);
    return r.abort();
  });
  await ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} ← ${e.blockedURI || 'inline'} (${(e.sample || '').slice(0, 60)})`));
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Lah We\]|net::ERR_FAILED|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
  const ev = (fn, a) => page.evaluate(fn, a);
  const settle = (ms = 220) => page.waitForTimeout(ms);
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });
  const problems = [], seenCodes = new Set();
  // One check after every screen: no script ran, no markup got in, every handler still parses.
  const check = async where => {
    const p = await ev(w => {
      const out = [];
      if (window.__xss) { out.push(w + ': script ran'); window.__xss = 0; }
      if (document.querySelector('[data-xss]')) { out.push(w + ': markup injected'); document.querySelectorAll('[data-xss]').forEach(e => e.remove()); }
      const codes = [];
      document.querySelectorAll('[onclick],[onchange],[oninput]').forEach(el => ['onclick', 'onchange', 'oninput'].forEach(a => { const c = el.getAttribute(a); if (c) codes.push(c); }));
      return { out, codes };
    }, where);
    problems.push(...p.out);
    // parsed here, not in the page: the page's content policy forbids new Function()
    for (const code of p.codes) { if (seenCodes.has(code)) continue; seenCodes.add(code); try { new Function(code); } catch (e) { problems.push(where + ': handler broken → ' + code.slice(0, 70)); } }
  };
  const closeAll = () => ev(() => document.querySelectorAll('.ov').forEach(o => o.remove()));

  await page.goto(base + '/index.html', { waitUntil: 'load' }); await settle(600);
  await ev(st => { replaceState(st); S.onboarded = true; S.tab = 'workout'; save(); document.getElementById('nav').style.display = 'flex'; render(); }, demoState(Date.now()));
  await settle(300);

  console.log('• keys: stored, then never shown in full');
  await ev(k => { setAiKey('anthropic', k.anthropic); setAiKey('openai', k.openai); S.ai.provider = 'anthropic'; save(); }, KEYS);
  const pages = await ev(() => Object.keys(SET_PAGES));
  let shown = [];
  for (const pg of pages) {
    await ev(p => { showSettings(); showSetPage(p); }, pg); await settle(200);
    const html = await ev(() => document.body.innerHTML + [...document.querySelectorAll('input')].map(i => i.value).join('|'));
    if (html.includes(KEYS.anthropic.slice(-12)) || html.includes(KEYS.openai.slice(-12))) shown.push(pg);
    await closeAll();
  }
  await ev(() => { go('coach'); }); await settle(200);
  await ev(() => showAiSettings()); await settle(250);
  { const html = await ev(() => document.body.innerHTML + [...document.querySelectorAll('input')].map(i => i.value).join('|'));
    if (html.includes(KEYS.anthropic.slice(-12))) shown.push('coach AI settings');
    ok(html.includes('····' + KEYS.anthropic.slice(-4)), 'the coach settings show the key as ····' + KEYS.anthropic.slice(-4)); }
  await closeAll();
  ok(shown.length === 0, shown.length ? 'a key is shown in full on: ' + shown.join(', ') : `no Settings page (${pages.length}) or coach screen shows a key in full`);

  console.log('• other apps\' files with hostile names, through the whole import flow');
  const strong = F.STRONG.replace(/Cable Crossover Hold Thing \(Cable\)/g, csvQ(TEXT + ' (Cable)')).replace(/,Push A,/g, ',' + csvQ(TEXT) + ',').replace(/"grip, a bit wider"/, csvQ(TEXT));
  const hevy = F.HEVY.replace(/"Upper"/g, csvQ(TEXT)).replace(/"Good one"/g, csvQ(TEXT)).replace(/"Pull Up \(Assisted\)"/, csvQ(TEXT + ' Pull'));
  for (const [app, text] of [['strong', strong], ['hevy', hevy], ['fitbod', F.FITBOD], ['jefit', F.JEFIT_REAL], ['alpha', F.ALPHA], ['stronglifts', F.STRONGLIFTS]]) {
    await ev(() => showAppImport()); await settle(250); await check(app + ': import hub');
    await ev(a => ixOpen(a), app); await settle(200); await check(app + ': info screen');
    await ev(([a, t]) => { window._ix.files = [ixReadText(t, a, a + '.csv')]; ixReview(); }, [app, text]); await settle(250); await check(app + ': review');
    const canGo = await ev(() => !!(window._ix && window._ix.plan));
    if (canGo) {
      if (app === 'strong') await shot('sec-import-review');
      await ev(() => { const z = window._ix; if (z.plan && z.plan.newEx) { const k = Object.keys(z.plan.newEx)[0]; if (k) ixFixSheet(k); } }); await settle(200); await check(app + ': fix an exercise');
      await ev(() => closeOv('ixfix-ov')); await settle(150);
      await ev(() => ixGo()); await settle(500); await check(app + ': results');
      if (app === 'strong') await shot('sec-import-results');
    }
    await closeAll();
  }
  // a restored file whose import tags carry markup: restore cleans them, and the screens stay clean either way
  await ev(t => { S.workouts.slice(0, 2).forEach(w => { w.src = t; }); S.importLog = (S.importLog || []).concat([{ app: t, at: Date.now() }]); replaceState(JSON.parse(JSON.stringify(S))); }, TEXT);
  ok(await ev(() => ixImportedApps().every(a => /^[a-z0-9_-]+$/.test(a))), 'after a restore, only app-id tags are left');
  await ev(() => showImportedData()); await settle(250); await check('imported data');
  await shot('sec-imported-data');
  const linkable = await ev(() => { const x = (S.custom || []).find(c => c.src && /data-xss/.test(c.name)) || (S.custom || []).find(c => c.src); return x ? x.id : null; });
  ok(!!linkable, 'an imported custom exercise exists to link');
  if (linkable) {
    await ev(id => ixLinkSheet(id), linkable); await settle(250); await check('link sheet');
    // a real tap on a row: these rows' handlers used to be escaped twice and did nothing
    await ev(() => { const q = document.getElementById('ixlink-q'); q.value = 'bench'; q.dispatchEvent(new Event('input')); }); await settle(200);
    await page.click('#ixlink-list button.row-tap >> nth=0'); await settle(250);
    ok(await page.isVisible('#confirm-ov') && /Move/.test(await page.textContent('#confirm-ov')), 'tapping an exercise in the link list asks to link it');
    await check('link confirm'); await shot('sec-link-confirm');
    await closeAll();
  }
  // the other lists built the same way: the builder's "lifts to keep" list
  await ev(() => { window.__kept = null; window.__realKeep = bldKeepAdd; bldKeepAdd = id => { window.__kept = id; }; const d = document.createElement('div'); d.id = 'pick-probe'; document.body.appendChild(d); ixPickList('pick-probe', 'squat', 'bldKeepAdd(%ID%)'); });
  await page.click('#pick-probe button.row-tap >> nth=0'); await settle(100);
  ok(!!(await ev(() => window.__kept)), 'a tap in the builder\'s exercise list reaches its handler with the id');
  await ev(() => { bldKeepAdd = window.__realKeep; document.getElementById('pick-probe').remove(); });
  for (const a of await ev(() => ixImportedApps())) { await ev(x => { showImportedData(); ixRemoveAsk(x); }, a); await settle(200); await check('remove ' + a + ' confirm'); await closeAll(); }
  // and the confirm itself, given a hostile tag directly (as if it had come from somewhere that skipped restore)
  await ev(t => { showImportedData(); ixRemoveAsk(t); }, TEXT); await settle(200); await check('remove confirm, hostile tag');
  await closeAll();

  console.log('• an assistant\'s reply pasted back in');
  const replies = [
    { type: 'meal_plan', mode: 'replace_week', note: TEXT, days: [{ day: 'Mon', meals: [{ meal: 'Lunch', name: TEXT, items: [{ name: TEXT, serving: TEXT, kcal: 500, protein: 40, carbs: 50, fat: 10 }] }] }] },
    { type: 'targets', kcal: 2400, protein_g: 180, carbs_g: 250, fat_g: 70, reason: TEXT },
    { type: 'habits', habits: [{ name: TEXT, kind: 'done', reason: TEXT }, { name: TEXT, kind: 'amount', target: 8, unit: TEXT }] },
    { type: 'workout', summary: TEXT, groups: [{ name: TEXT, mode: 'rotation', routines: [{ name: TEXT, notes: TEXT, exercises: [{ exId: 'NEW', name: TEXT, equipment: 'Other', muscle: 'Chest', sets: 3, repsMin: 5, note: TEXT }] }] }] },
  ];
  for (const r of replies) {
    await ev(t => showAiPaste('Here you go:\n```json\n' + t + '\n```'), JSON.stringify(r)); await settle(250); await check('paste preview ' + r.type);
    const canAdd = await ev(() => { const b = document.getElementById('aipaste-go'); return !!b && b.style.display !== 'none'; });
    ok(canAdd, `the ${r.type} reply is read and can be added`);
    if (canAdd) { await ev(() => aiPasteApply()); await settle(350); await check('paste applied ' + r.type); }
    await closeAll();
  }

  console.log('• the screens those names now live on');
  const habitId = await ev(() => { const h = (S.habits || []).find(x => /data-xss/.test(x.name)); return h ? h.id : null; });
  ok(!!habitId, 'a habit with a hostile name was added from the pasted reply');
  for (const t of ['workout', 'progress', 'nutrition', 'library', 'coach']) { await ev(x => go(x), t); await settle(200); await check('tab ' + t); }
  await ev(() => { go('habits'); }); await settle(200); await check('habits page');
  if (habitId) { await ev(id => habitDelete(id), habitId); await settle(200); await check('delete habit confirm'); await shot('sec-habit-delete'); await closeAll(); }
  await ev(() => { go('progress'); showChartBuilder(); }); await settle(300); await check('chart builder, new');
  await ev(TEXT => {
    const id = (S.custom || []).find(c => /data-xss/.test(c.name));
    S.customCharts = (S.customCharts || []).concat([{ id: 'cx1', name: TEXT, a: { t: 'sets', m: 'volume', fn: 'sum', f: id ? [{ c: 'exercise', v: id.id }] : [] }, by: 'week', view: 'line', range: '12w' }]);
    S.board = { range: '12w', tiles: [{ k: 'cc:cx1' }].concat((S.board && S.board.tiles) || []) };
    save(); render();
  }, TEXT); await settle(300); await check('progress board with a hostile chart');
  await ev(() => showChartBuilder('cx1')); await settle(300); await check('chart builder, editing a hostile chart');
  await closeAll();
  await ev(() => showPatterns()); await settle(300); await check('patterns'); await closeAll();
  await ev(() => go('workout')); await settle(150);

  console.log('• network and content policy across the whole walk');
  const csp = await ev(() => window.__csp);
  ok(csp.length === 0, csp.length ? 'content policy broken: ' + [...new Set(csp)].slice(0, 6).join(' ‖ ') : 'the content policy was never broken');
  ok(unexpected.length === 0, unexpected.length ? 'requests to hosts the app should not contact: ' + [...new Set(unexpected)].slice(0, 6).join(', ') : 'no request went anywhere but this server and the listed hosts');
  ok(problems.length === 0, problems.length ? 'injection found: ' + [...new Set(problems)].slice(0, 12).join(' ‖ ') : 'hostile names stayed text on every screen and dialog');
  ok(errs.length === 0, errs.length ? 'page errors: ' + [...new Set(errs)].slice(0, 6).join(' | ') : 'no page errors');
  console.log('  (allowed hosts asked for and stubbed: ' + ([...allowedSeen].join(', ') || 'none') + ')');

  await browser.close(); srv.close();
  console.log('\n' + (failures.length ? `FAILED — ${failures.length} problem(s):\n - ` + failures.join('\n - ') : 'All security checks passed.'));
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
