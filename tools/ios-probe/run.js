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

// Which simulator: LW_IOS = 'newest' (default) or 'oldest' runtime on this Mac; LW_IPHONE = a model name
// to prefer (e.g. "iPhone SE (3rd generation)", the smallest screen); otherwise a standard-size iPhone.
function pickDevice(want) {
  const list = JSON.parse(sim('list', 'devices', 'available', '-j')).devices;
  const ver = rt => (rt.match(/iOS-(\d+)-(\d+)/) || [0, 0, 0]).slice(1).map(Number);
  const cmp = (a, b) => { const x = ver(a), y = ver(b); return x[0] - y[0] || x[1] - y[1]; };
  const runtimes = Object.keys(list).filter(rt => /iOS/.test(rt) && list[rt].some(d => /^iPhone/.test(d.name))).sort(cmp);
  if (!runtimes.length) throw new Error('no iPhone simulator available');
  const rt = (process.env.LW_IOS === 'oldest') ? runtimes[0] : runtimes[runtimes.length - 1];
  const iphones = list[rt].filter(d => /^iPhone/.test(d.name)).map(d => Object.assign({ rt }, d));
  const name = want || process.env.LW_IPHONE;
  const d = (name && iphones.find(x => x.name === name)) || iphones.filter(x => !/Plus|Max|SE|mini|Air|e$/.test(x.name)).pop() || iphones.pop();
  console.log('Runtimes on this Mac: ' + runtimes.map(r => r.replace(/.*SimRuntime\./, '')).join(', '));
  return d;
}

const state = JSON.stringify((() => { const t = new Date(); t.setHours(10, 0, 0, 0); return demoState(t.getTime()); })());
const visits = []; let shots = 0; let lastDone = null;
// Inline, so the copy the service worker keeps carries it too and the offline visit still reports.
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8').replace('<head>', () => '<head><script>' + fs.readFileSync(path.join(__dirname, 'probe.js'), 'utf8') + '</script>');
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

// openurl right after boot can fail while SpringBoard is still settling: try a few times.
async function openUrl(udid, u) {
  for (let i = 1; ; i++) {
    // Not execFileSync: the page's first requests come back to this process while openurl is waiting.
    try { if (!DRY) await new Promise((res, rej) => require('child_process').execFile('xcrun', ['simctl', 'openurl', udid, u], { timeout: 90000 }, (e, so, se) => e ? rej(Object.assign(e, { stderr: se })) : res())); return; }
    catch (e) { if (i >= 6) throw e; console.log(`  openurl failed (${(e.stderr || e.message).split('\n')[0].slice(0, 120)}); retrying`); await new Promise(r => setTimeout(r, 5000)); }
  }
}
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
  await openUrl(dev.udid, url);
  await waitFor(() => visits.length >= 1, 240000).catch(() => console.log('  the probe did not finish in 4 min'));
  // Second visit: Safari closed and opened again; the save must come back from the phone's storage.
  console.log('Second visit: quit Safari, open again');
  try { sim('terminate', dev.udid, 'com.apple.mobilesafari'); } catch (e) {}
  await new Promise(r => setTimeout(r, 2000));
  await openUrl(dev.udid, url + '?again=1');
  await waitFor(() => visits.length >= 2, 240000).catch(() => console.log('  the second visit did not finish in 4 min'));
  // Third visit: no server at all while Safari opens it. Only the service worker's copy can start it;
  // the server comes back after 10 s so the probe can report.
  console.log('Third visit: the server is down while the app opens (offline)');
  try { sim('terminate', dev.udid, 'com.apple.mobilesafari'); } catch (e) {}
  srv.closeAllConnections && srv.closeAllConnections(); await new Promise(r => srv.close(r));
  await openUrl(dev.udid, url + '?offline=1');
  await new Promise(r => setTimeout(r, 10000));
  try { sim('io', 'booted', 'screenshot', path.join(OUT, 'zz-offline-open.png')); } catch (e) {}
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  await waitFor(() => visits.length >= 3, 180000).catch(() => console.log('  the offline visit never reported (the app did not start without the server)'));
  // Fourth visit: several years of log, saved and read back after a reload (the database as the main store).
  console.log('Fourth visit: a big log saved to the database and read back');
  try { sim('terminate', dev.udid, 'com.apple.mobilesafari'); } catch (e) {}
  await new Promise(r => setTimeout(r, 2000));
  await openUrl(dev.udid, url + '?big=1');
  await waitFor(() => visits.length >= 4, 240000).catch(() => console.log('  the big-log visit did not finish in 4 min'));
  srv.close();

  const lines = [`# Lah We in Mobile Safari (iOS Simulator)`, '', `Device: ${dev.name}, ${dev.rt.replace(/.*SimRuntime\./, '')}`, ''];
  let failed = 0;
  const VISIT = ['Visit 1: demo save, every screen', 'Visit 2: after quitting Safari', 'Visit 3: opened with the server down (offline)', 'Visit 4: a big log in the database'];
  visits.forEach((v, i) => {
    lines.push(`## ${VISIT[i] || 'Visit ' + (i + 1)}`, '', '`' + v.ua + '`', '');
    for (const r of v.results) { const info = / \(info\)$/.test(r.name); if (!r.ok && !info) failed++; lines.push(`- ${info ? 'ℹ️' : r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`); }
    lines.push('');
  });
  if (visits.length < 4) { failed++; lines.push(`❌ only ${visits.length} of 4 visits reported back${visits.length === 2 ? ': the app did not start offline' : ''}`); }
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
