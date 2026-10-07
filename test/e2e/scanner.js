#!/usr/bin/env node
// Barcode scanner test with a fake camera. Chromium plays a generated video of a barcode as if it
// were the phone's camera, so the whole path runs for real: camera start, live decoding, lookup,
// serving picker, logging. It also forces the failures a phone produces (permission refused,
// camera busy, a stream with no picture, the app going to the background) and checks the recovery.
// It cannot test a real lens: focus, glare and distance still need a phone.
//   node build.js && node test/e2e/scanner.js
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
let playwright;
try { playwright = require('playwright'); }
catch (e) { try { playwright = require('/opt/npm-tools/node_modules/playwright'); } catch (e2) { console.error('Playwright is not installed: npm i -D playwright'); process.exit(2); } }
const { chromium, devices } = playwright;
const { writeBarcodeY4M, checkDigit } = require('./barcode-video.js');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const failures = [];
const ok = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const EAN = '4006381333931';                       // 13 digits
const UPC = '03600029145' + checkDigit('03600029145'); // 12 digits (UPC-A); on a package it is the EAN-13 "0" + this
const PRODUCTS = {
  [EAN]: { product_name: 'Test Bar', brands: 'Acme', serving_size: '1 bar (50 g)', serving_quantity: 50,
    nutriments: { proteins_100g: 20, carbohydrates_100g: 40, fat_100g: 10, 'energy-kcal_100g': 330, proteins_serving: 10, carbohydrates_serving: 20, fat_serving: 5, 'energy-kcal_serving': 165 } },
  [UPC]: { product_name: 'Soda', brands: 'Fizz', serving_size: '1 can', serving_quantity: 355, nutriments: { carbohydrates_serving: 39, 'energy-kcal_serving': 140, carbohydrates_100g: 11, 'energy-kcal_100g': 39 } },
};

function serveDist() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
  const srv = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(DIST, path.normalize(name).replace(/^(\.\.[\/\\])+/, ''));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}
const STATE = { _schema: 3, onboarded: true, name: 'Scan', unit: 'lbs', bodyweight: 180, tab: 'nutrition', macroGoals: { protein: 180, carbs: 250, fat: 70, cals: 2400 } };

async function open(base, video) {
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + video] });
  const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined, permissions: ['camera'], serviceWorkers: 'block' });
  const net = { cdn: 0, off: [] };
  await ctx.route(/cdn\.jsdelivr\.net/, r => { net.cdn++; r.abort(); });
  await ctx.route(/openfoodfacts\.org/, r => {
    const code = (r.request().url().match(/product\/(\w+)\.json/) || [])[1]; net.off.push(code);
    const p = PRODUCTS[code] || PRODUCTS[code && code.replace(/^0/, '')];
    r.fulfill({ status: p ? 200 : 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(p ? { status: 1, product: p } : { status: 0 }) });
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(s => { if (!localStorage.getItem('lahwe_v2')) localStorage.setItem('lahwe_v2', s); }, JSON.stringify(STATE));
  await page.goto(base); await page.waitForTimeout(500);
  return { browser, page, net, errs, ev: (fn, a) => page.evaluate(fn, a), settle: ms => page.waitForTimeout(ms || 280) };
}
const closeAll = t => t.ev(() => { teardownScanner(); document.querySelectorAll('.ov').forEach(o => o.remove()); });
async function scanOnce(t, ms) {
  const t0 = Date.now();
  await t.page.click('.qa button:has-text("Scan")');
  try { await t.page.waitForSelector('#serving-ov', { timeout: ms || 6000 }); return Date.now() - t0; } catch (e) { return -1; }
}

(async () => {
  const srv = await serveDist();
  const base = `http://127.0.0.1:${srv.address().port}/`;

  console.log('• live scan: a barcode in the middle of the picture');
  let t = await open(base, writeBarcodeY4M(path.join(OUT, 'cam-ean.y4m'), EAN));
  const times = [];
  for (let i = 0; i < 4; i++) {
    const ms = await scanOnce(t); times.push(ms);
    if (i === 0) {
      ok(ms > 0, `the live camera reads the barcode (${ms} ms)`);
      ok(await t.page.isVisible('#serving-ov >> text=Test Bar') && await t.page.isVisible('#serving-ov >> text=Acme'), 'the product is looked up and shown');
      await t.settle(350);
      ok(await t.ev(() => Scan.stream === null && !document.getElementById('scan-ov')), 'the camera is released once the code is read');
      await t.page.screenshot({ path: path.join(OUT, 'scan-1-picker.png') });
    }
    await closeAll(t); await t.settle(250);
  }
  ok(times.every(x => x > 0), `four scans in a row all work: ${times.join(', ')} ms (the second and later use the saved lookup)`);
  ok(t.net.cdn === 0, 'the reader comes with the app: nothing is fetched from the CDN');
  ok(t.net.off.length === 1 && t.net.off[0] === EAN, `one lookup for four scans of the same product (${t.net.off.join()})`);

  console.log('• from the meal builder: cancelling keeps the meal, scanning adds to it');
  await t.ev(() => { showAddMeal(); addFoodToMeal('qf_egg'); addFoodToMeal('qf_egg'); }); await t.settle();
  await t.ev(() => { window.__real = scanFrame; window.scanFrame = () => null; }); // hold the read so there is time to cancel
  await t.page.click('#meal-ov button:has-text("Scan")'); await t.settle(500);
  ok(await t.ev(() => !!Scan.stream && document.getElementById('scan-video').videoWidth > 0), 'the scanner opens over the meal with a live picture');
  await t.page.click('#scan-ov button:has-text("Cancel")'); await t.settle(400);
  await t.ev(() => { window.scanFrame = window.__real; });
  ok(await t.page.isVisible('#meal-ov') && await t.ev(() => _mealItems.length === 1 && _mealItems[0].qty === 2), 'Cancel in the scanner leaves the meal and its items exactly as they were');
  await t.page.click('#meal-ov button:has-text("Scan")');
  await t.page.waitForSelector('#serving-ov', { timeout: 6000 }).catch(() => {});
  await t.page.click('#serving-ov button:has-text("Add")'); await t.settle(400);
  ok(await t.page.isVisible('#meal-ov') && await t.ev(() => _mealItems.length === 2 && /Test Bar/.test(_mealItems[1].name) && _mealItems[1].cals === 165), 'a scanned product joins the meal being built');
  await closeAll(t);

  console.log('• wrong numbers can be corrected, and the correction sticks');
  await scanOnce(t);
  await t.page.click('#serving-ov button:has-text("fix them")'); await t.settle(400);
  ok(await t.page.inputValue('#fe-name') === 'Test Bar (Acme)' && await t.page.inputValue('#fe-pro') === '10', 'the editor opens with the product’s current numbers');
  await t.page.fill('#fe-pro', '14'); await t.page.fill('#fe-cal', '181'); await t.page.click('#food-ov button:has-text("Save food")'); await t.settle(400);
  ok(await t.page.isVisible('#serving-ov') && await t.ev(() => _scanMacros && _scanMacros.protein === 14 && _scanMacros.cals === 181), 'saving returns to the serving picker with the corrected numbers');
  await closeAll(t); await t.settle(200);
  await scanOnce(t);
  ok(await t.ev(() => _scanMacros && _scanMacros.protein === 14), 'the next scan of the same barcode uses the correction');
  ok(t.net.off.length === 1, 'without asking the database again');
  await closeAll(t);

  console.log('• the camera refusing, being busy, or opening without a picture');
  const stub = async (mode) => t.ev(m => {
    const real = window.__gum || (window.__gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices));
    window.__calls = 0;
    navigator.mediaDevices.getUserMedia = c => {
      window.__calls++;
      if (m === 'denied') return Promise.reject(new DOMException('denied', 'NotAllowedError'));
      if (m === 'busy-twice' && window.__calls <= 2) return Promise.reject(new DOMException('busy', 'NotReadableError'));
      if (m === 'dead-once' && window.__calls === 1) return Promise.resolve(document.createElement('canvas').captureStream(0)); // a stream that never sends a frame
      if (m === 'picky' && window.__calls === 1) return Promise.reject(new DOMException('no', 'OverconstrainedError'));
      return real(c);
    };
  }, mode);
  await stub('denied');
  await t.page.click('.qa button:has-text("Scan")'); await t.settle(500);
  const denied = await t.ev(() => ({ s: document.getElementById('scan-status').textContent, d: document.getElementById('scan-detail').textContent }));
  ok(/Camera access is turned off/.test(denied.s) && /Safari → Camera/.test(denied.s), 'refused: says where to switch camera access on');
  ok(/NotAllowedError/.test(denied.d) && await t.page.isVisible('#scan-detail button:has-text("Try again")'), 'and shows the phone’s own error name with a Try again button');
  ok(await t.page.isVisible('#scan-ov button:has-text("Take a photo")') && await t.page.isVisible('#scan-ov button:has-text("Type the number")'), 'the photo and typed-number routes are still there');
  await t.ev(() => { navigator.mediaDevices.getUserMedia = window.__gum; });
  await t.page.click('#scan-detail button:has-text("Try again")');
  ok(await t.page.waitForSelector('#serving-ov', { timeout: 6000 }).then(() => true, () => false), 'Try again works once access is back');
  await closeAll(t);
  for (const [mode, what] of [['busy-twice', 'camera busy twice, then free'], ['dead-once', 'a stream with no picture, then a good one'], ['picky', 'the preferred camera settings refused']]) {
    await stub(mode);
    const ms = await scanOnce(t, 12000);
    ok(ms > 0, `${what}: recovers by itself and reads the code (${ms} ms, ${await t.ev(() => window.__calls)} camera requests)`);
    await closeAll(t); await t.settle(200);
  }
  await t.ev(() => { navigator.mediaDevices.getUserMedia = window.__gum; });

  console.log('• leaving the app with the scanner open');
  await t.ev(() => { delete S.foodCache; S.foodCache = {}; });
  const vis = v => t.ev(x => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => x }); document.dispatchEvent(new Event('visibilitychange')); }, v);
  await t.ev(() => { window.__hold = true; const f = scanFrame; window.scanFrame = v => (window.__hold ? null : f(v)); }); // keep it scanning while we switch away
  await t.page.click('.qa button:has-text("Scan")'); await t.settle(600);
  await vis('hidden'); await t.settle(200);
  ok(await t.ev(() => Scan.stream === null && !!document.getElementById('scan-ov')), 'going to the background stops the camera');
  await vis('visible'); await t.settle(900);
  ok(await t.ev(() => !!Scan.stream && Scan.stream.getVideoTracks()[0].readyState === 'live' && document.getElementById('scan-video').videoWidth > 0), 'coming back starts it again');
  await t.ev(() => { window.__hold = false; });
  ok(await t.page.waitForSelector('#serving-ov', { timeout: 6000 }).then(() => true, () => false), 'and it carries on scanning');
  await closeAll(t);

  console.log('• typing the number');
  await t.ev(() => { window.__hold = true; });
  await t.page.click('.qa button:has-text("Scan")'); await t.settle(600);
  await t.page.screenshot({ path: path.join(OUT, 'scan-0-live.png') });
  await t.page.click('#scan-ov button:has-text("Type the number")'); await t.settle(200);
  await t.ev(() => { window.__hold = false; });
  ok(await t.ev(() => Scan.stream === null), 'the camera is off while typing');
  await t.page.fill('#manual-barcode', '4006381333932'); await t.page.click('#scan-ov button:has-text("Look up")'); await t.settle(200);
  ok(/last digit does not match/.test(await t.page.textContent('#manual-barcode-msg')) && await t.page.isVisible('#scan-ov'), 'a mistyped digit is caught before any lookup');
  await t.page.fill('#manual-barcode', '12345'); await t.page.click('#scan-ov button:has-text("Look up")'); await t.settle(200);
  ok(/8, 12 or 13 digits/.test(await t.page.textContent('#manual-barcode-msg')), 'so is a number of the wrong length');
  await t.page.fill('#manual-barcode', '4006381 333931'); await t.page.click('#scan-ov button:has-text("Look up")');
  ok(await t.page.waitForSelector('#serving-ov >> text=Test Bar', { timeout: 5000 }).then(() => true, () => false), 'the right number finds the product (spaces ignored)');
  await closeAll(t);

  console.log('• a photo instead of the live camera');
  const shotCode = async (file, rotate) => {
    const data = await t.ev(({ code, rotate }) => {
      const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'], G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
      const R = L.map(p => p.replace(/[01]/g, c => (c === '0' ? '1' : '0'))), P = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'][+code[0]];
      let m = '101'; for (let i = 0; i < 6; i++) m += (P[i] === 'L' ? L : G)[+code[i + 1]]; m += '01010'; for (let i = 0; i < 6; i++) m += R[+code[i + 7]]; m += '101';
      // a 12-megapixel-ish photo with the barcode small and off-centre, as a hand-held shot would be
      const c = document.createElement('canvas'); c.width = rotate ? 3024 : 4032; c.height = rotate ? 4032 : 3024; const x = c.getContext('2d');
      x.fillStyle = '#d9d4cc'; x.fillRect(0, 0, c.width, c.height);
      if (rotate) { x.translate(c.width, 0); x.rotate(Math.PI / 2); }
      const s = 9, x0 = 1400, y0 = 1250; x.fillStyle = '#fff'; x.fillRect(x0 - 90, y0 - 60, m.length * s + 180, 620);
      x.fillStyle = '#111'; for (let i = 0; i < m.length; i++) if (m[i] === '1') x.fillRect(x0 + i * s, y0, s, 500);
      return c.toDataURL('image/jpeg', 0.85).split(',')[1];
    }, { code: EAN, rotate });
    fs.writeFileSync(file, Buffer.from(data, 'base64')); return file;
  };
  await t.ev(() => { window.__hold = true; }); // the live camera reads nothing here: only the photo can find the code
  for (const [rot, what] of [[false, 'a full-size photo'], [true, 'a photo taken sideways']]) {
    await t.page.click('.qa button:has-text("Scan")'); await t.settle(150);
    await t.ev(() => { teardownScanner(); }); // as if the live camera never started
    await t.page.setInputFiles('#scan-photo', await shotCode(path.join(OUT, rot ? 'photo-rot.jpg' : 'photo.jpg'), rot));
    ok(await t.page.waitForSelector('#serving-ov >> text=Test Bar', { timeout: 15000 }).then(() => true, () => false), `${what} is read without the live camera`);
    await closeAll(t); await t.settle(200);
  }
  await t.page.click('.qa button:has-text("Scan")'); await t.settle(150);
  await t.ev(() => { teardownScanner(); });
  const blank = path.join(OUT, 'blank.png');
  fs.writeFileSync(blank, Buffer.from(await t.ev(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; c.getContext('2d').fillStyle = '#888'; c.getContext('2d').fillRect(0, 0, 800, 600); return c.toDataURL('image/png').split(',')[1]; }), 'base64'));
  await t.page.setInputFiles('#scan-photo', blank); await t.settle(1500);
  ok(/No barcode found in that photo/.test(await t.page.textContent('#scan-status')) && await t.page.isVisible('#scan-detail button:has-text("Take another")'), 'a photo with no barcode says so and offers another go');
  await closeAll(t);
  ok(t.errs.length === 0, 'no page errors' + (t.errs.length ? ': ' + t.errs.slice(0, 3).join(' | ') : ''));
  await t.browser.close();

  console.log('• a small UPC barcode, off to one side, appearing after two seconds of nothing');
  t = await open(base, writeBarcodeY4M(path.join(OUT, 'cam-upc.y4m'), '0' + UPC, { scale: 3, offsetX: 760, offsetY: 90, blank: 20, frames: 60 }));
  await t.page.click('.qa button:has-text("Scan")'); await t.settle(1200);
  ok(await t.ev(() => !document.getElementById('serving-ov') && Scan.frames > 3), 'a blank picture reads as nothing: no made-up barcode');
  ok(await t.page.waitForSelector('#serving-ov >> text=Soda', { timeout: 9000 }).then(() => true, () => false), 'the barcode is found although it is small and outside the guide box');
  const key = await t.ev(() => Object.keys(S.foodCache)[0]);
  ok(key === UPC || key === '0' + UPC, `stored under the scanned number (${key})`);
  ok(await t.page.locator('#serving-ov .type-grid button').count() === 6 && await t.page.inputValue('#scan-qty') === '1', 'the amount and the meal are asked on the one sheet');
  await t.page.click('#serving-ov .type-grid button:has-text("Snack")'); await t.settle(400);
  ok(await t.ev(() => S.meals.length === 1 && S.meals[0].cals === 140 && S.meals[0].type === 'Snack' && !document.querySelector('.ov')), 'and logged in that one tap: 140 kcal as a snack, no second sheet');
  // the same product typed as 12 digits (how it is printed) hits the saved lookup written with 13, and the reverse
  const before = t.net.off.length;
  await t.ev(code => { showBarcodeScanner(); onBarcodeDetected(code); }, key === UPC ? '0' + UPC : UPC); await t.settle(500);
  ok(await t.page.isVisible('#serving-ov >> text=Soda') && t.net.off.length === before, 'the 12-digit and 13-digit forms of one barcode are treated as the same product');
  await closeAll(t);
  console.log('• a product the database does not have');
  const unknown = '5000159407236';
  await t.ev(code => { showBarcodeScanner(); onBarcodeDetected(code); }, unknown); await t.settle(600);
  ok(await t.page.isVisible('#scan-ov >> text=Product not found'), 'says it was not found');
  await t.page.click('#scan-ov button:has-text("Enter it yourself")'); await t.settle(400);
  await t.page.fill('#fe-name', 'Mystery Bar'); await t.page.fill('#fe-serving', '1 bar'); await t.page.fill('#fe-pro', '12'); await t.page.fill('#fe-carb', '25'); await t.page.fill('#fe-fat', '9');
  ok(/Calories will be 229/.test(await t.page.textContent('#fe-note')), 'calories are worked out from the macros when left blank');
  await t.page.click('#food-ov button:has-text("Save food")'); await t.settle(400);
  ok(await t.page.isVisible('#serving-ov >> text=Mystery Bar') && await t.ev(c => S.customFoods.some(f => f.id === 'cf_' + c && f.cals === 229), unknown), 'it becomes one of your foods and goes straight to the serving picker');
  await closeAll(t);
  ok(t.errs.length === 0, 'no page errors' + (t.errs.length ? ': ' + t.errs.slice(0, 3).join(' | ') : ''));
  await t.browser.close(); srv.close();

  console.log('\n' + (failures.length ? `FAILED — ${failures.length} problem(s):\n - ` + failures.join('\n - ') : 'Scanner checks passed.'));
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
