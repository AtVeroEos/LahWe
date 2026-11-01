#!/usr/bin/env node
// Lah We in real Mobile Safari, in the iOS Simulator (macOS with Xcode only; used by CI).
//   node build.js && node tools/ios-probe/run.js [device name]
// Serves dist/ with tools/ios-probe/probe.js added to the page, boots a simulated iPhone, opens the app
// in Safari, and lets the probe walk every tab and the main sheets, taking a simulator screenshot at
// each. Then opens the app a second time to check the data came back from the phone's storage.
// Writes test/e2e/out/ios/*.png and test/e2e/out/ios/report.md, and exits 1 if a check failed.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { execFileSync, execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'test', 'e2e', 'out', 'ios'); fs.mkdirSync(OUT, { recursive: true });
const { demoState } = require(path.join(ROOT, 'tools', 'demo-state.js'));
const PORT = 8123;
// LW_PROBE_DRY=1: no simulator; serve and wait for any browser to open the page (to check the probe itself).
const DRY = !!process.env.LW_PROBE_DRY;
const sim = (...a) => DRY ? '' : execFileSync('xcrun', ['simctl', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function pickDevice(want) {
  const list = JSON.parse(sim('list', 'devices', 'available', '-j')).devices;
  const all = Object.entries(list).filter(([rt]) => /iOS/.test(rt)).flatMap(([rt, ds]) => ds.map(d => Object.assign({ rt }, d)));
  const iphones = all.filter(d => /^iPhone/.test(d.name));
  const d = (want && iphones.find(x => x.name === want)) || iphones.filter(x => !/Plus|Max|SE|mini|Air|e$/.test(x.name)).pop() || iphones.pop();
  if (!d) throw new Error('no iPhone simulator available');
  return d;
}

const state = JSON.stringify((() => { const t = new Date(); t.setHours(10, 0, 0, 0); return demoState(t.getTime()); })());
const visits = []; let shots = 0; let lastDone = null;
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8').replace('<head>', '<head><script src="/__probe/probe.js"></script>');
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    if (u === '/__probe/probe.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(__dirname, 'probe.js'))); }
    if (u === '/__probe/state.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(state); }
    if (u === '/__probe/log') { try { console.log('  [safari] ' + JSON.parse(body).m); } catch (e) {} res.writeHead(204); return res.end(); }
    if (u === '/__probe/shot') {
      const name = (JSON.parse(body).name || 'shot').replace(/[^a-z0-9-]+/gi, '-');
      try { sim('io', 'booted', 'screenshot', path.join(OUT, `${String(++shots).padStart(2, '0')}-${name}.png`)); } catch (e) { console.log('  screenshot failed: ' + e.message.split('\n')[0]); }
      res.writeHead(204); return res.end();
    }
    if (u === '/__probe/done') { lastDone = JSON.parse(body); visits.push(lastDone); res.writeHead(204); return res.end(); }
    const name = decodeURIComponent(u).replace(/^\/+/, '') || 'index.html';
    if (name === 'index.html' || name === 'lahwe.html') { res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-cache' }); return res.end(html); }
    const file = path.join(DIST, path.normalize(name));
    if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
});

const waitFor = (fn, ms) => new Promise((res, rej) => { const t0 = Date.now(); const iv = setInterval(() => { if (fn()) { clearInterval(iv); res(); } else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error('timed out')); } }, 500); });

(async () => {
  const dev = DRY ? { name: 'dry run', rt: 'none', udid: 'none' } : pickDevice(process.argv[2]);
  console.log(`Simulator: ${dev.name} (${dev.rt.replace(/.*SimRuntime\./, '')})`);
  if (!DRY) {
    try { sim('boot', dev.udid); } catch (e) { if (!/current state: Booted/.test(e.stderr || '')) throw e; }
    execSync(`xcrun simctl bootstatus ${dev.udid} -b`, { stdio: 'ignore' });
  }
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  const url = `http://localhost:${PORT}/`;
  console.log('First visit: the demo save, every tab and sheet');
  sim('openurl', dev.udid, url);
  await waitFor(() => visits.length >= 1, 240000).catch(() => console.log('  the probe did not finish in 4 min'));
  // Second visit: Safari closed and opened again; the save must come back from the phone's storage.
  console.log('Second visit: quit Safari, open again');
  try { sim('terminate', dev.udid, 'com.apple.mobilesafari'); } catch (e) {}
  await new Promise(r => setTimeout(r, 2000));
  sim('openurl', dev.udid, url + '?again=1');
  await waitFor(() => visits.length >= 2, 240000).catch(() => console.log('  the second visit did not finish in 4 min'));
  srv.close();

  const lines = [`# Lah We in Mobile Safari (iOS Simulator)`, '', `Device: ${dev.name}, ${dev.rt.replace(/.*SimRuntime\./, '')}`, ''];
  let failed = 0;
  visits.forEach((v, i) => {
    lines.push(`## Visit ${i + 1}`, '', '`' + v.ua + '`', '');
    for (const r of v.results) { const info = / \(info\)$/.test(r.name); if (!r.ok && !info) failed++; lines.push(`- ${info ? 'ℹ️' : r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`); }
    lines.push('');
  });
  if (visits.length < 2) { failed++; lines.push(`❌ only ${visits.length} of 2 visits reported back`); }
  if (visits.length >= 2) {
    const a = visits[0].results.find(r => r.name === 'the app started on the seeded save'), b = visits[1].results.find(r => r.name === 'the app started on the seeded save');
    lines.push(`Data after quitting Safari: ${b && b.ok ? '✅ ' + b.detail : '❌ ' + (b ? b.detail : 'no report')}`);
  }
  lines.push('', `Screenshots: ${shots}`);
  fs.writeFileSync(path.join(OUT, 'report.md'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAIL', e); srv.close(); process.exit(1); });
