#!/usr/bin/env node
// Lah We build: concatenates src/ into one self-contained HTML file.
// No dependencies. Usage: node build.js   (writes dist/lahwe.html and dist/index.html)
'use strict';
const fs = require('fs');
const path = require('path');

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
  const chart = read(path.join(ROOT, 'vendor', 'chart.umd.js')).replace(/\s+$/, '');
  for (const [name, text] of [['app js', js], ['chart.js', chart]]) {
    if (/<\/script/i.test(text)) throw new Error(name + ' contains a literal </script — it would end the inline script block');
  }
  let html = read(path.join(SRC, 'index.html'));
  html = fill(html, '<!--__CHARTJS__-->', '<script>\n' + chart + '\n</script>');
  html = fill(html, '/*__CSS__*/', css);
  html = fill(html, '/*__JS__*/', js);
  html = html.split('__APP_VERSION__').join(pkg.version);
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, 'lahwe.html'), html);
  fs.writeFileSync(path.join(DIST, 'index.html'), html);
  // Optional companions (only used when the app is served over http/https).
  const pub = path.join(SRC, 'public');
  if (fs.existsSync(pub)) {
    for (const f of fs.readdirSync(pub)) {
      let buf = fs.readFileSync(path.join(pub, f));
      if (/\.(js|webmanifest|json)$/.test(f)) buf = Buffer.from(buf.toString('utf8').split('__APP_VERSION__').join(pkg.version));
      fs.writeFileSync(path.join(DIST, f), buf);
    }
  }
  return { bytes: Buffer.byteLength(html), files: jsFiles().length, version: pkg.version };
}

module.exports = { buildJs, build, jsFiles };

if (require.main === module) {
  const r = build();
  console.log(`Built dist/lahwe.html — v${r.version}, ${(r.bytes / 1024).toFixed(0)} KB from ${r.files} source files`);
}
