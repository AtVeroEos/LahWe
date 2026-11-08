// Which browser engine the browser tests run in.
//   LW_ENGINE=chromium (default)  the engine the suites were written against
//   LW_ENGINE=webkit              the engine every iPhone browser and the Capacitor app's WebView use
// Playwright's WebKit is the open-source engine Safari is built on, not Mobile Safari itself:
// it catches WebKit's JavaScript, CSS, storage and event differences, but not iOS-only behaviour
// (the real keyboard, the share sheet, Home Screen standalone mode, storage eviction). Those need
// the iOS Simulator or a phone.
'use strict';
let playwright;
try { playwright = require('playwright'); }
catch (e) { try { playwright = require('/opt/npm-tools/node_modules/playwright'); } catch (e2) { console.error('Playwright is not installed: npm i -D playwright'); process.exit(2); } }

const name = (process.env.LW_ENGINE || 'chromium').toLowerCase();
if (!['chromium', 'webkit'].includes(name)) { console.error('LW_ENGINE must be chromium or webkit, not ' + name); process.exit(2); }

// Chromium-only launch flags (fake camera and the like) are dropped under WebKit, which has no equivalent.
let launch = (chromiumOpts) => playwright[name].launch(name === 'chromium' ? (chromiumOpts || {}) : {});

// LW_COVERAGE=<dir> (Chromium only): every page records which app code ran, written to <dir> as it
// closes, for tools/coverage.js to turn into per-file line coverage.
if (process.env.LW_COVERAGE && name === 'chromium') {
  const fs = require('fs'), path = require('path');
  const dir = process.env.LW_COVERAGE; fs.mkdirSync(dir, { recursive: true });
  const suite = path.basename(require.main.filename, '.js');
  let n = 0; const done = new WeakSet();
  const dump = async p => {
    if (done.has(p)) return; done.add(p);
    try {
      const cov = (await p.coverage.stopJSCoverage()).filter(e => e.source && e.source.includes('// ──────── src/js/'));
      if (cov.length) fs.writeFileSync(path.join(dir, `e2e-${suite}-${process.pid}-${n++}.json`), JSON.stringify(cov));
    } catch (e) { /* a page that crashed or was already closed has nothing to give */ }
  };
  // What ran on a page is lost when it navigates (the old scripts go with it), so it is written out
  // before every goto and reload, and recording starts again after.
  const save = async p => {
    try {
      const cov = (await p.coverage.stopJSCoverage()).filter(e => e.source && e.source.includes('// ──────── src/js/'));
      if (cov.length) fs.writeFileSync(path.join(dir, `e2e-${suite}-${process.pid}-${n++}.json`), JSON.stringify(cov));
    } catch (e) { /* closed or crashed */ }
  };
  const watch = async p => {
    try { await p.coverage.startJSCoverage({ resetOnNavigation: false }); } catch (e) { return p; }
    const close = p.close.bind(p); p.close = async (...a) => { await dump(p); return close(...a); };
    for (const m of ['goto', 'reload', 'goBack', 'goForward']) {
      const orig = p[m].bind(p);
      p[m] = async (...a) => { if (!done.has(p)) { await save(p); try { await p.coverage.startJSCoverage({ resetOnNavigation: false }); } catch (e) {} } return orig(...a); };
    }
    return p;
  };
  const plain = launch;
  launch = async opts => {
    const b = await plain(opts); const ctxs = [];
    const wrapCtx = c => {
      ctxs.push(c);
      const np = c.newPage.bind(c); c.newPage = async (...a) => watch(await np(...a));
      const cc = c.close.bind(c); c.close = async (...a) => { for (const p of c.pages()) await dump(p); return cc(...a); };
      return c;
    };
    const nc = b.newContext.bind(b); b.newContext = async (...a) => wrapCtx(await nc(...a));
    const bnp = b.newPage.bind(b); b.newPage = async (...a) => { const p = await bnp(...a); ctxs.push(p.context()); return watch(p); };
    const bc = b.close.bind(b); b.close = async (...a) => { for (const c of ctxs) for (const p of c.pages()) await dump(p); return bc(...a); };
    return b;
  };
}

module.exports = {
  playwright,
  devices: playwright.devices,
  engine: playwright[name],
  engineName: name,
  isWebKit: name === 'webkit',
  launch,
};
