#!/usr/bin/env node
// Renders tools/icon.svg to the PNG sizes the manifest and iOS home screen need.
// Only needed when the icon changes: node tools/make-icons.js   (requires Playwright)
'use strict';
const fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8');
  const out = path.join(__dirname, '..', 'src', 'public');
  const browser = await pw.chromium.launch();
  for (const size of [180, 192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: path.join(out, `icon-${size}.png`), clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
  }
  await browser.close();
  console.log('icons written to src/public');
})();
