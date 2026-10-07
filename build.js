#!/usr/bin/env node
// Lah We build: concatenates src/ into one self-contained HTML file.
// No dependencies. Usage: node build.js   (writes dist/lahwe.html and dist/index.html)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

function read(p) { return fs.readFileSync(p, 'utf8'); }

function jsFiles() {
  return fs.readdirSync(path.join(SRC, 'js'))
    .filter(f => f.endsWith('.js'))
    .sort();
}

// Concatenated app script. Also used by the unit tests (test/harness.js).
function buildJs() {
  return jsFiles()
    .map(f => `// ──────── src/js/${f} ────────\n` + read(path.join(SRC, 'js', f)).replace(/\s+$/, '') + '\n')
    .join('\n');
}

function fill(tpl, marker, value) {
  const i = tpl.indexOf(marker);
  if (i < 0) throw new Error('Template marker missing: ' + marker);
  // split/join instead of String.replace: replacement text contains "$" sequences.
  return tpl.slice(0, i) + value + tpl.slice(i + marker.length);
}

function build() {
  const pkg = JSON.parse(read(path.join(ROOT, 'package.json')));
  const css = read(path.join(SRC, 'styles.css')).replace(/\s+$/, '');
  const js = buildJs();
  if (/<\/script/i.test(js)) throw new Error('app js contains a literal </script — it would end the inline script block');
  let html = read(path.join(SRC, 'index.html'));
  html = fill(html, '/*__CSS__*/', css);
  html = fill(html, '/*__JS__*/', js);
  html = html.split('__APP_VERSION__').join(pkg.version);
  // Changes whenever the app changes, so the service worker knows to replace its cached copy.
  const buildId = crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, 'lahwe.html'), html);
  fs.writeFileSync(path.join(DIST, 'index.html'), html);
  // Optional companions (only used when the app is served over http/https).
  const pub = path.join(SRC, 'public');
  if (fs.existsSync(pub)) {
    for (const f of fs.readdirSync(pub)) {
      let buf = fs.readFileSync(path.join(pub, f));
      if (/\.(js|webmanifest|json)$/.test(f)) buf = Buffer.from(buf.toString('utf8').split('__APP_VERSION__').join(pkg.version).split('__BUILD_ID__').join(buildId));
      fs.writeFileSync(path.join(DIST, f), buf);
    }
  }
  // The barcode reader is only needed when scanning, so it is not inlined: it sits next to the page
  // and is loaded on first use (and kept by the service worker for offline use). The hash printed
  // into the app must match this exact file, so a mismatch stops the build.
  const zx = fs.readFileSync(path.join(ROOT, 'vendor', 'zxing.min.js'));
  const sri = 'sha384-' + crypto.createHash('sha384').update(zx).digest('base64');
  if (!js.includes("const SCAN_LIB_SRI='" + sri + "'")) throw new Error('vendor/zxing.min.js does not match SCAN_LIB_SRI in 53-scanner.js (expected ' + sri + ')');
  fs.writeFileSync(path.join(DIST, 'zxing.min.js'), zx);
  return { bytes: Buffer.byteLength(html), files: jsFiles().length, version: pkg.version, buildId };
}

module.exports = { buildJs, build, jsFiles };

if (require.main === module) {
  const r = build();
  console.log(`Built dist/lahwe.html — v${r.version}, ${(r.bytes / 1024).toFixed(0)} KB from ${r.files} source files`);
}
