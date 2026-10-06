#!/usr/bin/env node
// Screenshots of the built app with the demo save, for design review.
//   node build.js && node tools/shots.js [outDir] [--dark]
// Chromium on Linux has no San Francisco font; Inter stands in for it here, so letter shapes differ slightly on an iPhone.
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/npm-tools/node_modules/playwright'); }
const { chromium, devices } = playwright;
const { demoState } = require('./demo-state');

const args = process.argv.slice(2);
const dark = args.includes('--dark');
const out = path.resolve(args.find(a => !a.startsWith('--')) || path.join(__dirname, '..', 'test', 'e2e', 'out', 'shots'));
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined });
  await ctx.route(/^https?:\/\//, r => r.abort());
  const page = await ctx.newPage();
  const state = Object.assign(demoState(), { darkMode: dark });
  await page.addInitScript(s => { if (!localStorage.getItem('lahwe_v2')) localStorage.setItem('lahwe_v2', s); }, JSON.stringify(state));
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html'));
  await page.waitForTimeout(500);
  const sfx = dark ? '-dark' : '';
  const shot = async (name, full) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, name + sfx + '.png'), fullPage: false }); if (full) { const h = await page.evaluate(() => { const c = document.getElementById('content'); return c.scrollHeight; }); await page.setViewportSize({ width: 390, height: Math.min(4200, Math.max(664, h + 120)) }); await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, name + '-full' + sfx + '.png') }); await page.setViewportSize({ width: 390, height: 664 }); } };
  const ev = (fn, a) => page.evaluate(fn, a);
  const closeAll = () => ev(() => document.querySelectorAll('.ov').forEach(o => o.remove()));

  await shot('01-home', true);
  for (const [n, fn] of Object.entries(SHEETS)) { try { await ev(fn); await shot(n); } catch (e) { console.log('skip ' + n + ': ' + e.message.split('\n')[0]); } await closeAll(); }
  await ev(() => go('progress')); await shot('03-progress', true);
  await ev(() => go('history')); await shot('04-history');
  await ev(() => go('schedule')); await shot('05-schedule');
  await ev(() => go('coach')); await shot('06-coach');
  await ev(() => go('nutrition')); await shot('07-nutrition', true);
  await ev(() => go('library')); await shot('08-library');
  await ev(() => showSettings()); await shot('09-settings'); await closeAll();
  await ev(() => { go('workout'); startWorkout('r-upperA'); });
  await ev(() => { togSet(0, 0); togSet(0, 1); skipRest(); });
  await shot('02-session', true);
  for (const [n, fn] of Object.entries(SESSION_SHEETS)) { try { await ev(fn); await shot(n); } catch (e) { console.log('skip ' + n + ': ' + e.message.split('\n')[0]); } await closeAll(); }
  if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
  console.log('wrote ' + fs.readdirSync(out).filter(f => f.endsWith(sfx + '.png')).length + ' images to ' + out);
  await browser.close();
})();

// Sheets opened from the home screen and from a live workout; each is skipped quietly if the function is not there.
const SHEETS = {
  '10-week': () => showWeekReview(),
  '11-targets': () => showTargets('r-upperA'),
  '12-testplan': () => showTestPlan(),
  '13-music': () => showMusicSetup(),
};
const SESSION_SHEETS = {
  '14-swap': () => showSwap(0),
};
