#!/usr/bin/env node
// Moves every position in a Strava export by a fixed offset, so a recording can be used as test
// data in this (public) repository without saying where it was made. Shapes, times, distances,
// elevation and heart rate are untouched; only where on Earth the routes sit changes.
//   node tools/relocate-export.js <export.zip> <out.zip> [dLat] [dLon]
// Reads GPX and TCX as text and patches FIT position fields in place (records, laps, sessions and
// anything else stored as semicircles), then rewrites the FIT checksum.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { makeZip } = require('../test/fixtures/strava.js');
const { fitCrc } = require('../test/fixtures/tracks.js');

const [, , src, out, a3, a4] = process.argv;
if (!src || !out) { console.error('usage: node tools/relocate-export.js <export.zip> <out.zip> [dLat] [dLon]'); process.exit(2); }
const dLat = a3 != null ? parseFloat(a3) : 1.3172, dLon = a4 != null ? parseFloat(a4) : 3.4581;
const SEMI = 2147483648 / 180;

// A zip's members, stored or deflated (no zip64: an export small enough to be a fixture).
function readZip(buf) {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const files = [];
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), comp = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nl);
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const raw = buf.subarray(start, start + comp);
    files.push([name, method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw)]);
    p += 46 + nl + xl + cl;
  }
  return files;
}
const fix = (v, d) => (parseFloat(v) + d).toFixed(7);
function moveGpx(text) {
  return text.replace(/<(trkpt|wpt|rtept)\b([^>]*)>/g, (m, tag, attrs) => `<${tag}${attrs.replace(/\blat="([-\d.]+)"/, (x, v) => `lat="${fix(v, dLat)}"`).replace(/\blon="([-\d.]+)"/, (x, v) => `lon="${fix(v, dLon)}"`)}>`)
    .replace(/<bounds\b[^>]*\/?>/g, '');
}
function moveTcx(text) {
  return text.replace(/<LatitudeDegrees>([-\d.]+)<\/LatitudeDegrees>/g, (m, v) => `<LatitudeDegrees>${fix(v, dLat)}</LatitudeDegrees>`)
    .replace(/<LongitudeDegrees>([-\d.]+)<\/LongitudeDegrees>/g, (m, v) => `<LongitudeDegrees>${fix(v, dLon)}</LongitudeDegrees>`);
}
// Every signed 32-bit field is checked: one that reads as a latitude or longitude near the
// recording's own is moved. (Positions are the only such fields with values that large.)
function moveFit(buf) {
  buf = Buffer.from(buf);
  const hs = buf[0], end = hs + buf.readUInt32LE(4); const defs = {}; let p = hs, ref = null, moved = 0;
  const lat0 = [], spots = [];
  while (p < end) {
    const h = buf[p++];
    if (!(h & 0x80) && (h & 0x40)) {
      const be = buf[p + 1] === 1, nf = buf[p + 4]; const gm = be ? buf.readUInt16BE(p + 2) : buf.readUInt16LE(p + 2); p += 5;
      const fields = []; let size = 0;
      for (let i = 0; i < nf; i++) { fields.push({ num: buf[p], size: buf[p + 1], type: buf[p + 2], off: size }); size += buf[p + 1]; p += 3; }
      if (h & 0x20) { const nd = buf[p++]; for (let i = 0; i < nd; i++) { size += buf[p + 1]; p += 3; } }
      defs[h & 15] = { gm, be, fields, size }; continue;
    }
    const def = defs[h & 0x80 ? (h >> 5) & 3 : h & 15]; if (!def) throw new Error('FIT: data before its definition');
    for (const f of def.fields) if ((f.type & 0x1F) === 5 && f.size === 4) spots.push({ at: p + f.off, be: def.be, gm: def.gm, num: f.num });
    p += def.size;
  }
  const rd = s => s.be ? buf.readInt32BE(s.at) : buf.readInt32LE(s.at);
  const rec = spots.filter(s => s.gm === 20 && (s.num === 0 || s.num === 1) && rd(s) !== 0x7FFFFFFF);
  const lats = rec.filter(s => s.num === 0).map(s => rd(s) / SEMI), lons = rec.filter(s => s.num === 1).map(s => rd(s) / SEMI);
  if (!lats.length) return buf;
  const mid = a => a.slice().sort((x, y) => x - y)[a.length >> 1]; const la = mid(lats), lo = mid(lons);
  for (const s of spots) {
    const v = rd(s); if (v === 0x7FFFFFFF) continue; const deg = v / SEMI;
    const isLat = s.gm === 20 ? s.num === 0 : Math.abs(deg - la) < 1.5 && Math.abs(deg - la) <= Math.abs(deg - lo);
    const isLon = s.gm === 20 ? s.num === 1 : !isLat && Math.abs(deg - lo) < 1.5;
    if (!isLat && !isLon) continue;
    const nv = Math.round((deg + (isLat ? dLat : dLon)) * SEMI);
    s.be ? buf.writeInt32BE(nv, s.at) : buf.writeInt32LE(nv, s.at); moved++;
  }
  buf.writeUInt16LE(fitCrc(buf.subarray(0, end)), end);
  return buf;
}
const files = readZip(fs.readFileSync(src)).map(([name, data]) => {
  const gz = /\.gz$/i.test(name); const base = name.replace(/\.gz$/i, ''); let body = gz ? zlib.gunzipSync(data) : data;
  if (/\.gpx$/i.test(base)) body = Buffer.from(moveGpx(body.toString('utf8')));
  else if (/\.tcx$/i.test(base)) body = Buffer.from(moveTcx(body.toString('utf8')));
  else if (/\.fit$/i.test(base)) body = moveFit(body);
  return [name, gz ? zlib.gzipSync(body, { level: 9 }) : body];
});
fs.writeFileSync(out, makeZip(files));
console.log(`moved ${files.length} files by ${dLat}° north and ${dLon}° east → ${path.basename(out)} (${fs.statSync(out).size} bytes)`);
