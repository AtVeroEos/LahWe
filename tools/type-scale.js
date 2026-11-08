#!/usr/bin/env node
// The type and corner scale, and its guard.
//   node tools/type-scale.js check   fails if any text size or corner radius in src/ is a literal
//                                    instead of one of the scale's tokens (run by npm run check)
//   node tools/type-scale.js apply   rewrites literals to the nearest token (used once, Nov 2026)
//
// Text follows Apple's iPhone type ramp: 11 12 13 15 17 20 22 28 34 (--f11 … --f34), plus --f44 for
// the hero numbers. Corners: --r-sm 8, --r-md 12, --r-lg 16, --r-xl 20, and --r-pill. Two kinds of
// shape keep their own: tiny graphics (bars, legend swatches, the grabber) --r-xs 4, and the top
// corners of a sheet --r-sheet 28. Circles stay 50%; 0 stays 0.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const FILES = [path.join(ROOT, 'src', 'styles.css'), ...fs.readdirSync(path.join(ROOT, 'src', 'js')).filter(f => f.endsWith('.js')).map(f => path.join(ROOT, 'src', 'js', f))];

const FONT = v => v <= 11 ? 11 : v <= 12 ? 12 : v <= 13.5 ? 13 : v <= 15 ? 15 : v <= 18 ? 17 : v <= 21 ? 20 : v <= 23 ? 22 : v <= 30 ? 28 : v <= 36 ? 34 : 44;
const RAD = v => v <= 6 ? 'xs' : v <= 9 ? 'sm' : v <= 13 ? 'md' : v <= 18 ? 'lg' : v <= 24 ? 'xl' : v < 90 ? 'sheet' : 'pill';
// Literals the check lets through: they are not sizes of text or shapes on the scale.
const RADIUS_OK = /^(0|50%|var\(--r-(xs|sm|md|lg|xl|sheet|pill)\)( var\(--r-(xs|sm|md|lg|xl|sheet|pill)\)| 0){0,3}|inherit)$/;
// Segments draw their pill inside 11 pt transparent borders (see Touch targets), so their outer radius
// is the token plus that border, horizontally and vertically: written with calc.
const SEG_OK = /^calc\(var\(--r-(sm|md)\) \+ 1px\)\/calc\(var\(--r-(sm|md)\) \+ 11px\)$/;

function rewrite(src, file) {
  const notes = [];
  let out = src.replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, (m, v) => `font-size:var(--f${FONT(+v)})`);
  out = out.replace(/\bfont:\s*((?:\d{3}|bold|normal|italic|\s)+)\s+(\d+(?:\.\d+)?)px/g, (m, pre, v) => `font:${pre.trim()} var(--f${FONT(+v)})`);
  out = out.replace(/border-radius:\s*([^;}"'`]+)/g, (m, val) => {
    val = val.trim();
    if (/var\(|^0$|^50%$|^inherit$/.test(val) && !/\dpx/.test(val)) return m;
    if (/\//.test(val)) { notes.push(`${path.basename(file)}: elliptical radius left for review: ${val}`); return m; }
    const parts = val.split(/\s+/);
    if (!parts.every(p => /^\d+(\.\d+)?px$|^0$/.test(p))) { notes.push(`${path.basename(file)}: radius not rewritten: ${val}`); return m; }
    return 'border-radius:' + parts.map(p => p === '0' || p === '0px' ? '0' : `var(--r-${RAD(parseFloat(p))})`).join(' ');
  });
  return { out, notes };
}

function check() {
  const bad = [];
  for (const f of FILES) {
    const s = fs.readFileSync(f, 'utf8'); const lines = s.split('\n');
    lines.forEach((ln, i) => {
      if (/^\s*--f\d+:|^\s*--r-[a-z]+:|tools\/type-scale/.test(ln)) return;
      for (const m of ln.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) bad.push(`${path.relative(ROOT, f)}:${i + 1} font-size:${m[1]}px`);
      for (const m of ln.matchAll(/\bfont:\s*(?:\d{3}\s+)?(\d+(?:\.\d+)?)px/g)) bad.push(`${path.relative(ROOT, f)}:${i + 1} font: ${m[1]}px`);
      for (const m of ln.matchAll(/border-radius:\s*([^;}"'`]+)/g)) { const v = m[1].trim(); if (!RADIUS_OK.test(v) && !SEG_OK.test(v) && !/^\$\{/.test(v)) bad.push(`${path.relative(ROOT, f)}:${i + 1} border-radius:${v}`); }
    });
  }
  if (bad.length) { console.error(`Off the type/corner scale (${bad.length}). Use --f11…--f34/--f44 and --r-xs…--r-pill (tools/type-scale.js):\n  ` + bad.slice(0, 40).join('\n  ')); process.exit(1); }
  console.log('Every text size and corner radius is on the scale.');
}

const cmd = process.argv[2];
if (cmd === 'apply') {
  const allNotes = []; let changed = 0;
  for (const f of FILES) { const s = fs.readFileSync(f, 'utf8'); const { out, notes } = rewrite(s, f); allNotes.push(...notes); if (out !== s) { fs.writeFileSync(f, out); changed++; } }
  console.log(`rewrote ${changed} files`); if (allNotes.length) console.log(allNotes.join('\n'));
} else if (cmd === 'check') check();
else { console.log('usage: node tools/type-scale.js check | apply'); process.exit(2); }
