#!/usr/bin/env node
// The on-screen keyboard, and coming back from the share sheet or a file picker.
// Chromium has no on-screen keyboard, so the page gets a stand-in visualViewport it can shrink and
// grow, and the test decides whether the "keyboard gone" resize event arrives. On an iPhone it can
// go missing while the share sheet, a file picker or another app is in front; the app used to stay
// laid out around a keyboard that was gone (the grocery list pushed half way up the screen).
//   node build.js && node test/e2e/keyboard.js
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); }
catch (e) { try { playwright = require('/opt/npm-tools/node_modules/playwright'); } catch (e2) { console.error('Playwright is not installed: npm i -D playwright'); process.exit(2); } }
const { chromium, devices } = playwright;
const { demoState } = require('../../tools/demo-state.js');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const KB = 336; // an iPhone 13's keyboard
const failures = [];
const ok = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// A visualViewport the test controls, in place before the app's own script runs.
function fakeViewport() {
  const et = new EventTarget(); let h = null;
  const vv = Object.assign(et, { scale: 1, offsetTop: 0, offsetLeft: 0 });
  Object.defineProperty(vv, 'height', { get: () => (h == null ? innerHeight : h) });
  Object.defineProperty(vv, 'width', { get: () => innerWidth });
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  window.__vv = (shrink, fire) => { h = innerHeight - shrink; if (fire) vv.dispatchEvent(new Event('resize')); };
  // The share sheet: the keyboard is gone by the time it closes, and the event saying so is lost.
  navigator.share = () => new Promise(res => setTimeout(() => { window.__vv(0, false); res(); }, 1500)); // a share sheet stays up for a while: longer than the app's own 450 ms settle after a blur
  navigator.canShare = () => true;
}

(async () => {
  const browser = await chromium.launch();
  const open = async (state) => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined });
    await ctx.route(/^https?:\/\//, r => r.abort());
    const page = await ctx.newPage();
    await page.addInitScript(fakeViewport);
    await page.addInitScript(s => { if (!localStorage.getItem('lahwe_v2')) localStorage.setItem('lahwe_v2', s); }, JSON.stringify(state));
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + path.join(ROOT, 'dist', 'index.html')); await page.waitForTimeout(500);
    return { ctx, page, errs, ev: (fn, a) => page.evaluate(fn, a) };
  };
  const layout = ev => ev(() => {
    const ovs = document.querySelectorAll('.ov'); const ov = ovs[ovs.length - 1];
    const m = ov && ov.querySelector('.modal');
    return { kb: document.documentElement.classList.contains('kb'), pad: ov ? parseFloat(getComputedStyle(ov).paddingBottom) : 0,
      app: document.getElementById('app').style.height, kbOpen: document.body.classList.contains('kb-open'),
      modalBottom: m ? Math.round(m.getBoundingClientRect().bottom) : null, vh: innerHeight };
  });
  const state = demoState();
  // A meal plan, so the grocery list has something on it.
  state.mealPlan = Object.assign(state.mealPlan || {}, { days: [0, 1, 2, 3, 4, 5, 6].map(d => [{ id: 'm' + d, type: 'Lunch', name: 'Bowl',
    items: [{ foodId: null, name: 'Rice', qty: 1, serving: '1 cup', protein: 4, carbs: 45, fat: 0, cals: 205 }, { foodId: null, name: 'Chicken', qty: 2, serving: '4 oz', protein: 26, carbs: 0, fat: 3, cals: 130 }] }]), extras: [] });

  console.log('• typing still lifts the sheet above the keyboard');
  let a = await open(state);
  await a.ev(() => showGroceryList(0)); await a.page.waitForTimeout(300);
  await a.page.click('#groc-new'); await a.ev(k => window.__vv(k, true), KB); await a.page.waitForTimeout(250);
  let l = await layout(a.ev);
  ok(l.kb && l.pad === KB, `the sheet makes room for the keyboard while typing (${l.pad}px)`);

  console.log('• Share the grocery list with the keyboard up; the "keyboard gone" event never comes');
  await a.page.click('#groc-share-btn'); await a.page.waitForTimeout(2200);
  l = await layout(a.ev);
  ok(!l.kb && l.pad === 0 && l.modalBottom === l.vh, `back from the share sheet the list fills the screen again (padding ${l.pad}px, bottom ${l.modalBottom}/${l.vh})`);
  await a.page.screenshot({ path: path.join(OUT, 'kb-grocery-after-share.png') });
  ok(!a.errs.length, 'no page errors' + (a.errs.length ? ': ' + a.errs.join(' | ') : ''));
  await a.ctx.close();

  console.log('• Coach: type, then attach a photo; the picker closes without the event');
  const st2 = demoState();
  a = await open(st2);
  await a.ev(() => { localStorage.setItem('lahwe_ai_keys', JSON.stringify({ anthropic: 'sk-ant-api03-' + 'x'.repeat(90) })); });
  await a.page.reload(); await a.page.waitForTimeout(500);
  await a.ev(() => go('coach')); await a.page.waitForTimeout(300);
  const box = a.page.locator('#content textarea').first();
  if (await box.count()) {
    await box.click(); await box.fill('lunch'); await a.ev(k => window.__vv(k, true), KB); await a.page.waitForTimeout(250);
    l = await layout(a.ev);
    ok(l.kbOpen && l.app === (664 - KB) + 'px', `while typing, the chat fits above the keyboard (${l.app})`);
    const [fc] = await Promise.all([a.page.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null), a.page.click('#content button[aria-label*="Attach"]')]);
    await a.ev(() => window.__vv(0, false)); await a.page.waitForTimeout(700);
    l = await layout(a.ev);
    ok(!!fc && !l.kbOpen && l.app === '', `back from the picker the app is full height again (${l.app || 'full'})`);
  } else ok(false, 'coach chat box found');
  await a.ctx.close();

  console.log('• every other way out of the app, with the keyboard up in a sheet first');
  const ways = {
    'Back up (share sheet)': () => exportData(),
    'Reminders file (share sheet)': () => shareRemindersFile(),
    'Plan: share both': () => { window._shareWk = 0; return doPlanShare('both'); },
    'Restore (file picker)': () => importData(),
  };
  for (const [name, fn] of Object.entries(ways)) {
    a = await open(state);
    if (name.startsWith('Reminders')) await a.ev(() => { S.reminders[REM_KINDS[0].id] = Object.assign({ days: [1, 3, 5] }, S.reminders[REM_KINDS[0].id] || {}, { on: true, time: '07:00' }); });
    await a.ev(() => showGroceryList(0)); await a.page.waitForTimeout(250);
    await a.page.click('#groc-new'); await a.ev(k => window.__vv(k, true), KB); await a.page.waitForTimeout(200);
    const chooser = a.page.waitForEvent('filechooser', { timeout: 1500 }).catch(() => null);
    await a.ev(fn).catch(() => {});
    if (await chooser) await a.ev(() => window.__vv(0, false));
    await a.page.waitForTimeout(2200);
    l = await layout(a.ev);
    ok(!l.kb && l.pad === 0, `${name}: no keyboard gap left behind (padding ${l.pad}px)`);
    await a.ctx.close();
  }

  console.log('• coming back to the app (pageshow) with a stale viewport and nothing being typed');
  a = await open(state);
  await a.ev(() => showGroceryList(0)); await a.page.waitForTimeout(250);
  await a.ev(k => { document.documentElement.classList.add('kb'); document.documentElement.style.setProperty('--kb', k + 'px'); window.__vv(k, false); }, KB);
  await a.ev(() => window.dispatchEvent(new Event('pageshow'))); await a.page.waitForTimeout(300);
  l = await layout(a.ev);
  ok(!l.kb && l.pad === 0, 'a leftover keyboard gap is cleared when the app comes back');
  await a.ctx.close();

  await browser.close();
  if (failures.length) { console.log(`\n${failures.length} keyboard check(s) failed`); process.exit(1); }
  console.log('\nKeyboard checks passed.');
})();
