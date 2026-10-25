'use strict';
// Where the AI keys may never turn up, what a restored file may carry in, the CSV export, the
// duplicate-declaration guard and the page's content policy.
// Every key here is assembled at run time, so the repository never holds anything key-shaped.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('../harness.js');
const { demoState } = require('../../tools/demo-state.js');
const { findDupesIn, findDupes } = require('../../tools/check-dupes.js');
const { build } = require('../../build.js');

const ROOT = path.join(__dirname, '..', '..');
const NOW = '2026-10-25T12:00:00';
const fake = {
  anthropic: 'sk-' + 'ant-' + 'api03-' + 'Q'.repeat(40),
  openai: 'sk-' + 'proj-' + 'R'.repeat(40),
  gemini: 'AI' + 'za' + 'T'.repeat(35),
  openrouter: 'sk-' + 'or-' + 'v1-' + 'u'.repeat(40),
  custom: 'local-' + 'V'.repeat(20),
};
const P = Object.keys(fake);
// The last 12 characters are enough to say a key leaked, whatever was cut or wrapped around it.
const leaked = text => P.filter(p => String(text).includes(fake[p].slice(-12)));

function richApp() {
  const app = loadApp({ now: NOW });
  app.set('__raw', demoState(new Date(NOW).getTime()));
  app.run('replaceState(__raw)');
  for (const p of P) { app.set('__k', fake[p]); assert.equal(app.run(`setAiKey('${p}',__k)`), '', p); }
  app.run(`setCustomUrl('https://llm.example.test/v1')`);
  app.run(`S.ai.provider='anthropic';S.ai.logAccess=true;save()`);
  return app;
}

// ─── Keys ───
test('no outbound copy of the data holds a key: backup, every CSV, every coach table, the data sheet, the assistant prompts', () => {
  const app = richApp();
  const out = {};
  out.backup = app.run('backupJSON()');
  out.state = app.run('JSON.stringify(S)');
  out.csvLegacy = app.run('csvFiles().map(f=>csvText(f.rows)).join("\\n")');
  // every file the export screen offers, over all time, exactly as the screen builds them
  for (const id of app.json('EXPORT_SETS.map(x=>x.id)')) out['csv ' + id] = app.run(`(()=>{const sp=exportSpan('all');return csvText(EXPORT_SETS.find(x=>x.id===${JSON.stringify(id)}).rows(sp.from,sp.to))})()`);
  for (const t of app.json('Object.keys(QD_TABLES)')) out['coach ' + t] = app.run(`JSON.stringify(coachQuery({table:${JSON.stringify(t)},limit:200}))`);
  out.sheet = app.run('coachDataSheetMd()');
  for (const k of ['workout', 'meal_plan', 'targets', 'habits']) out['prompt ' + k] = app.run(`aiPromptText(${JSON.stringify(k)})`);
  const bad = Object.entries(out).filter(([, v]) => leaked(v).length).map(([k, v]) => k + ' → ' + leaked(v).join(','));
  assert.deepEqual(bad, []);
  assert.ok(out['coach settings'].includes('coach_log_access'), 'the settings table really was read (so a pass means something)');
});

test('an error that echoes a key is scrubbed before it is logged, kept or shown', () => {
  const app = richApp();
  const logged = [];
  app.ctx.console = { error: (...a) => logged.push(a.join(' ')), log() {}, warn() {} };
  app.set('__e', new Error('401 from provider: invalid key ' + fake.anthropic + ' / ' + fake.openai));
  app.run(`logError(__e,'test')`);
  const kept = app.run('JSON.stringify(_errLog)');
  assert.deepEqual(leaked(kept), [], 'not in the error log');
  assert.deepEqual(leaked(logged.join('\n')), [], 'not in the console');
  assert.match(kept, /\[key hidden\]/);
  const el = { innerHTML: '' };
  app.set('__c', el);
  app.run(`renderCrash(__c,__e,'test')`);
  assert.deepEqual(leaked(el.innerHTML), [], 'not on the crash screen');
});

test('a key-shaped string in an error is hidden even before the provider code has run', () => {
  const app = loadApp({ now: NOW });
  // the fallback path: scrubKeys throwing (as it would before its file has loaded)
  app.run('window.__realScrub=scrubKeys;scrubKeys=()=>{throw new ReferenceError("not yet")}');
  assert.ok(!app.run(`errScrub(${JSON.stringify('boom ' + fake.openai)})`).includes(fake.openai.slice(-12)));
  assert.ok(!app.run(`errScrub(${JSON.stringify('boom ' + fake.gemini)})`).includes(fake.gemini.slice(-12)));
  app.run('scrubKeys=window.__realScrub');
});

// ─── What a restored file may carry in ───
test('an import tag that is not an app id is dropped on restore; the record it was on stays', () => {
  const app = loadApp({ now: NOW });
  const t0 = new Date('2026-10-20T17:00:00').getTime();
  app.set('__bk', {
    onboarded: true,
    workouts: [
      { id: 'w1', name: 'A', started: t0, ended: t0 + 3600000, src: '<img src=x onerror=alert(1)>', exercises: [{ exId: 'squat', sets: [{ w: '100', r: '5', done: true }] }] },
      { id: 'w2', name: 'B', started: t0 + 86400000, ended: t0 + 90000000, src: 'hevy', exercises: [{ exId: 'squat', sets: [{ w: '100', r: '5', done: true }] }] },
      { id: 'w3', name: 'C', started: t0 + 2 * 86400000, ended: t0 + 2 * 86400000 + 3600000, src: 'strava', exercises: [] },
    ],
    custom: [{ id: 'c1', name: 'Y', cat: 'Legs', eq: 'Barbell', muscle: 'Quads', src: '"><svg onload=1>' }, { id: 'c2', name: 'Z', cat: 'Legs', eq: 'Barbell', muscle: 'Quads', src: 'strong' }],
    routines: [{ id: 'r1', name: 'R', exercises: [], src: { x: 1 } }],
    bodyweightLog: [{ date: '2026-10-01', weight: 190, src: 'A'.repeat(40) }, { date: '2026-10-02', weight: 189, src: 'jefit' }],
    importLog: [{ app: '<b>x</b>', at: 1 }, { app: 'hevy', at: 2 }, 'junk'],
  });
  app.run('replaceState(__bk)');
  const s = app.json('{w:S.workouts.map(w=>[w.id,w.src||null]),c:S.custom.map(c=>[c.id,c.src||null]),r:S.routines.map(r=>[r.id,r.src||null]),b:S.bodyweightLog.map(b=>[b.date,b.src||null]),l:S.importLog.map(r=>r.app),apps:ixImportedApps()}');
  assert.deepEqual(s.w.sort(), [['w1', null], ['w2', 'hevy'], ['w3', 'strava']]);
  assert.deepEqual(s.c, [['c1', null], ['c2', 'strong']]);
  assert.deepEqual(s.r, [['r1', null]]);
  assert.deepEqual(s.b.sort(), [['2026-10-01', null], ['2026-10-02', 'jefit']]);
  assert.deepEqual(s.l, ['hevy']);
  assert.deepEqual(s.apps.sort(), ['hevy', 'jefit', 'strong']);
});

test('names reach the delete-habit and remove-import dialogs as text', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'js', '58-habits.js'), 'utf8');
  assert.match(src, /customConfirm\(`Delete “\$\{esc\(h\.name\)\}”/);
  const ix = fs.readFileSync(path.join(ROOT, 'src', 'js', '91-app-import.js'), 'utf8');
  const fn = ix.slice(ix.indexOf('function ixRemoveAsk'), ix.indexOf('\n}\n', ix.indexOf('function ixRemoveAsk')));
  // the dialog's label and title are markup; the toast after it is plain text, so it may use the name as is
  assert.match(fn, /`Remove \$\{esc\(ixAppName\(app\)\)\} data`/);
  assert.match(fn, /title:`Remove the \$\{esc\(ixAppName\(app\)\)\} import\?`/);
});

test('restoring a backup is lossless: backup → restore → backup gives the same file', () => {
  const app = loadApp({ now: NOW });
  app.set('__raw', demoState(new Date(NOW).getTime()));
  app.run('replaceState(__raw)');
  const one = app.run('backupJSON()');
  const other = loadApp({ now: NOW });
  other.set('__bk', JSON.parse(one));
  other.run('replaceState(__bk)');
  assert.equal(other.run('backupJSON()'), one);
});

// ─── CSV export ───
test('CSV: formulas stay text, numbers stay numbers', () => {
  const app = loadApp({ now: NOW });
  const c = v => app.run(`csvCell(${JSON.stringify(v)})`);
  assert.equal(c(-2.5), '-2.5', 'a negative number is a number (it used to come out as the text \'-2.5)');
  assert.equal(c('-2.5'), '-2.5', 'a number held as text too');
  assert.equal(c(185), '185');
  assert.equal(c(0), '0');
  assert.equal(c('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(c('+1+1'), '"\'+1+1"');
  assert.equal(c('-1+cmd'), '"\'-1+cmd"');
  assert.equal(c('@SUM(A1)'), '"\'@SUM(A1)"');
  assert.equal(c('\t=1'), '"\'\t=1"', 'a tab in front does not hide a formula');
  assert.equal(c('Push, heavy'), '"Push, heavy"');
  assert.equal(c(null), '');
  assert.equal(app.run('csvCell(NaN)'), '');
});

// ─── Duplicate declarations ───
test('the duplicate check finds a function declared in two files, and the source has none', () => {
  const r = findDupesIn([{ name: '10-a.js', src: 'function foo(){}\nconst bar=1;\n  function nested(){}\n' }, { name: '20-b.js', src: 'function nested(){}\nasync function foo(){}\n' }]);
  assert.deepEqual(r.dupes, [{ name: 'foo', first: '10-a.js:1', again: '20-b.js:2' }]);
  const real = findDupes(path.join(ROOT, 'src', 'js'));
  assert.deepEqual(real.dupes, []);
  assert.ok(real.count > 2000, 'it really read the source (' + real.count + ' names)');
});

// ─── The page itself ───
test('the built page carries a content policy, and loads no script from anywhere but itself and the pinned CDN', () => {
  build();
  const html = fs.readFileSync(path.join(ROOT, 'dist', 'lahwe.html'), 'utf8');
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, 'policy present');
  const pol = Object.fromEntries(m[1].split(';').map(x => x.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  assert.deepEqual(pol['object-src'], ["'none'"]);
  assert.deepEqual(pol['base-uri'], ["'none'"]);
  assert.deepEqual(pol['form-action'], ["'none'"]);
  assert.deepEqual(pol['script-src'], ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'], 'scripts: this page and the pinned scanner copy, nothing else');
  assert.deepEqual(pol['frame-src'], ['https://www.youtube-nocookie.com']);
  assert.ok(!/<script[^>]+src=/i.test(html), 'no external <script src> in the page');
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script'), 'the policy comes before the first script');
});
