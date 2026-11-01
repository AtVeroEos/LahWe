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

module.exports = {
  playwright,
  devices: playwright.devices,
  engine: playwright[name],
  engineName: name,
  isWebKit: name === 'webkit',
  // Chromium-only launch flags (fake camera and the like) are dropped under WebKit, which has no equivalent.
  launch: (chromiumOpts) => playwright[name].launch(name === 'chromium' ? (chromiumOpts || {}) : {}),
};
