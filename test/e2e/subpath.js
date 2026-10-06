#!/usr/bin/env node
// The hosted copy lives under a sub-path (https://<account>.github.io/LahWe/), not at a site root.
// This serves dist/ the same way and checks that the app, its manifest, icons and offline support
// all resolve relative to that path, and that two people on the same address do not share anything.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
let playwright;
try { playwright = require('playwright'); }
catch (e) { try { playwright = require('/opt/npm-tools/node_modules/playwright'); } catch (e2) { console.error('Playwright is not installed: npm i -D playwright'); process.exit(2); } }
const { chromium, devices } = playwright;
const DIST = path.join(__dirname, '..', '..', 'dist');
const PREFIX = '/LahWe/';
const failures = [];
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failures.push(m); };

(async () => {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
  const seen = [];
  const srv = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]); seen.push(url);
    if (!url.startsWith(PREFIX)) { res.writeHead(404); res.end('outside the site'); return; }
    const name = url.slice(PREFIX.length) || 'index.html';
    const file = path.join(DIST, path.normalize(name).replace(/^(\.\.[\/\\])+/, ''));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}${PREFIX}`;
  const browser = await chromium.launch();
  const mk = async () => { const c = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined }); await c.route(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/, r => r.abort()); return c; };

  console.log('• served from a sub-path');
  const a = await mk(); const pa = await a.newPage(); const errs = [];
  pa.on('pageerror', e => errs.push(e.message));
  await pa.goto(base, { waitUntil: 'load' }); await pa.waitForTimeout(500);
  ok(await pa.isVisible('#ob-name'), 'the app opens');
  await pa.fill('#ob-name', 'Alice'); await pa.fill('#ob-bw', '150'); await pa.fill('#ob-height', '65'); await pa.click('text=Get Started'); await pa.waitForTimeout(300);
  const reg = await pa.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { scope: r.scope, active: !!r.active }; });
  ok(reg.active && reg.scope === base, `offline support registered for this path only (${reg.scope})`);
  await pa.waitForTimeout(600);
  const outside = seen.filter(u => !u.startsWith(PREFIX));
  ok(outside.length === 0, 'nothing was requested outside the path' + (outside.length ? ': ' + outside.join(', ') : ''));
  ok(['manifest.webmanifest', 'sw.js'].every(f => seen.includes(PREFIX + f)), 'manifest and service worker were fetched from the path');
  const fake = 'sk-' + 'ant-' + 'api03-' + 'q'.repeat(40);
  await pa.evaluate(k => { setAiKey('anthropic', k); S.coachNotes.push({ id: 'n', text: 'Alice only', at: 1 }); saveNow(); }, fake);
  await pa.evaluate(() => Store.flush(true)); await pa.waitForTimeout(300);
  await a.setOffline(true);
  await pa.reload({ waitUntil: 'load' }); await pa.waitForTimeout(700);
  ok(await pa.evaluate(() => typeof S === 'object' && S.name === 'Alice' && aiReady()), 'reloads with no network, data and key intact');
  await a.setOffline(false);

  console.log('• a second person on the same address');
  const b = await mk(); const pb = await b.newPage();
  await pb.goto(base, { waitUntil: 'load' }); await pb.waitForTimeout(500);
  const second = await pb.evaluate(k => ({ onboarding: !!document.getElementById('ob-name'), key: getAiKey('anthropic'), stored: Object.keys(localStorage).length, html: document.documentElement.outerHTML.includes(k) }), fake);
  ok(second.onboarding && second.key === '' && second.stored === 0 && !second.html, 'starts empty: no data, no key, nothing of the first person\'s');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));

  await browser.close(); srv.close();
  console.log('\n' + (failures.length ? `FAILED — ${failures.length} problem(s):\n - ` + failures.join('\n - ') : 'Sub-path hosting works.'));
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
