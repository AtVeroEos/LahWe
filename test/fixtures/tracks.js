'use strict';
// Made-up GPS tracks with known answers, and writers for the three file formats the app reads.
// Nothing here is a real place anyone ran: the origin is a point in Tampa Bay's general area and
// every route is drawn from waypoints in metres.
//   makeRun({ legs, speed, pauseAt, spikeAt, hill, hr })  → points [{lat,lon,t,ele,hr,dist}], one a second
//   toGpx(points, {name,type})   toTcx(points, {sport})   toFit(points, {sport, compressed, dev, bigEndian})
const LAT0 = 27.95, LON0 = -82.45;
const M_PER_DEG = 6371008.8 * Math.PI / 180;
const T0 = Date.UTC(2026, 8, 30, 10, 0, 0) / 1000;

// legs: [[dxMetres, dyMetres], …] walked in order. speed: metres a second, or t => metres a second.
function makeRun(o) {
  o = Object.assign({ legs: [[0, 5000]], speed: 3, t0: T0, lat0: LAT0, lon0: LON0 }, o || {});
  const speedAt = typeof o.speed === 'function' ? o.speed : () => o.speed;
  const way = [[0, 0]]; o.legs.forEach(l => { const p = way[way.length - 1]; way.push([p[0] + l[0], p[1] + l[1]]); });
  const lens = []; let total = 0; for (let i = 1; i < way.length; i++) { const l = Math.hypot(way[i][0] - way[i - 1][0], way[i][1] - way[i - 1][1]); lens.push(l); total += l; }
  const at = d => { let k = 0, rest = d; while (k < lens.length - 1 && rest > lens[k]) { rest -= lens[k]; k++; } const f = Math.min(1, rest / lens[k]); return [way[k][0] + f * (way[k + 1][0] - way[k][0]), way[k][1] + f * (way[k + 1][1] - way[k][1])]; };
  const cos = Math.cos(o.lat0 * Math.PI / 180);
  const pts = []; let d = 0, t = 0, clock = 0;
  // noise: metres of GPS wander either way, from a seeded generator so every run of the tests is the same
  let seed = (o.seed || 1) >>> 0; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - 0.5; };
  const push = (x0, y0, extra) => { const x = x0 + (o.noise ? rnd() * 2 * o.noise : 0), y = y0 + (o.noise ? rnd() * 2 * o.noise : 0); pts.push(Object.assign({
    lat: o.lat0 + y / M_PER_DEG, lon: o.lon0 + x / (M_PER_DEG * cos), t: o.t0 + clock,
    ele: o.hill ? o.hill(d) : 5, hr: o.hr ? Math.round(o.hr(t, d)) : null, dist: d,
  }, extra || {})); };
  for (;;) {
    const [x, y] = at(d);
    push(x, y);
    if (o.spikeAt != null && Math.round(t) === o.spikeAt) { clock += 0.5; push(x + 400, y + 300); clock -= 0.5; } // one wild fix, half a second later
    if (o.pauseAt != null && Math.round(t) === o.pauseAt) {
      if (o.autoPause) clock += o.pauseFor || 60;                       // the watch stopped recording
      else for (let s = 1; s <= (o.pauseFor || 60); s++) { clock += 1; push(x + (s % 2 ? 0.8 : -0.6), y + (s % 3 ? 0.5 : -0.7)); } // standing, with jitter
    }
    if (d >= total) break;
    d = Math.min(total, d + speedAt(t, d)); t += 1; clock += 1;
  }
  return pts;
}

const iso = t => new Date(t * 1000).toISOString().replace('.000Z', 'Z');
function toGpx(points, o) {
  o = Object.assign({ name: 'Morning Run', type: 'running' }, o || {});
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="StravaGPX" version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
 <metadata><time>${iso(points[0].t + 86400)}</time></metadata>
 <trk><name>${o.name}</name><type>${o.type}</type><trkseg>
${points.map(p => `  <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${o.noEle ? '' : `<ele>${p.ele.toFixed(1)}</ele>`}<time>${iso(p.t)}</time>${p.hr ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${p.hr}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>` : ''}</trkpt>`).join('\n')}
 </trkseg></trk></gpx>`;
}
function toTcx(points, o) {
  o = Object.assign({ sport: 'Running' }, o || {});
  const last = points[points.length - 1];
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="${o.sport}">
 <Id>${iso(points[0].t)}</Id>
 <Lap StartTime="${iso(points[0].t)}"><TotalTimeSeconds>${last.t - points[0].t}</TotalTimeSeconds><DistanceMeters>${last.dist.toFixed(1)}</DistanceMeters><Track>
${points.map(p => `  <Trackpoint><Time>${iso(p.t)}</Time><Position><LatitudeDegrees>${p.lat.toFixed(7)}</LatitudeDegrees><LongitudeDegrees>${p.lon.toFixed(7)}</LongitudeDegrees></Position><AltitudeMeters>${p.ele.toFixed(1)}</AltitudeMeters><DistanceMeters>${p.dist.toFixed(1)}</DistanceMeters>${p.hr ? `<HeartRateBpm><Value>${p.hr}</Value></HeartRateBpm>` : ''}</Trackpoint>`).join('\n')}
 </Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
}

// ─── FIT ───
const FIT_EPOCH = 631065600;
const CRC_T = [0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401, 0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400];
function fitCrc(buf, crc) {
  crc = crc || 0;
  for (const b of buf) {
    let tmp = CRC_T[crc & 0xF]; crc = (crc >> 4) & 0x0FFF; crc = crc ^ tmp ^ CRC_T[b & 0xF];
    tmp = CRC_T[crc & 0xF]; crc = (crc >> 4) & 0x0FFF; crc = crc ^ tmp ^ CRC_T[(b >> 4) & 0xF];
  }
  return crc;
}
// A FIT activity the way a watch writes one: a file_id, records, an event the app has no use for,
// and a session. Options turn on the parts of the format a reader gets wrong:
//   compressed   most records use the one-byte header with a five-bit time offset
//   dev          records carry a developer field (two extra bytes) that must be skipped by size
//   bigEndian    the session is written most-significant byte first
//   oldAltitude  16-bit altitude (field 2) instead of enhanced altitude (field 78)
function toFit(points, o) {
  o = Object.assign({ sport: 1 }, o || {});
  const parts = [];
  const u8 = v => Buffer.from([v & 255]);
  const u16 = (v, be) => { const b = Buffer.alloc(2); be ? b.writeUInt16BE(v) : b.writeUInt16LE(v); return b; };
  const u32 = (v, be) => { const b = Buffer.alloc(4); be ? b.writeUInt32BE(v >>> 0) : b.writeUInt32LE(v >>> 0); return b; };
  const s32 = (v, be) => { const b = Buffer.alloc(4); be ? b.writeInt32BE(v) : b.writeInt32LE(v); return b; };
  const def = (local, global, fields, opt) => {
    opt = opt || {};
    parts.push(u8(0x40 | (opt.dev ? 0x20 : 0) | local), u8(0), u8(opt.be ? 1 : 0), u16(global, opt.be), u8(fields.length));
    fields.forEach(f => parts.push(Buffer.from(f)));
    if (opt.dev) parts.push(u8(1), Buffer.from([0, 2, 0])); // one developer field, two bytes
  };
  const semi = deg => Math.round(deg * 2147483648 / 180);
  const fts = t => Math.round(t) - FIT_EPOCH;
  // file_id (0): type = activity (4), manufacturer, time_created
  def(0, 0, [[0, 1, 0x00], [1, 2, 0x84], [4, 4, 0x86]]);
  parts.push(u8(0), u8(4), u16(255), u32(fts(points[0].t)));
  const alt = o.oldAltitude ? [2, 2, 0x84] : [78, 4, 0x86];
  const body = [[0, 4, 0x85], [1, 4, 0x85], [5, 4, 0x86], alt, [3, 1, 0x02], [4, 1, 0x02]];
  def(1, 20, [[253, 4, 0x86]].concat(body), { dev: o.dev });
  if (o.compressed) def(2, 20, body, { dev: o.dev });
  const altBytes = e => { const v = Math.round((e + 500) * 5); return o.oldAltitude ? u16(v) : u32(v); };
  points.forEach((p, i) => {
    const t = fts(p.t);
    const rest = [s32(semi(p.lat)), s32(semi(p.lon)), u32(Math.round(p.dist * 100)), altBytes(p.ele), u8(p.hr || 0xFF), u8(o.cadence || 0xFF)];
    if (o.compressed && i % 10) parts.push(u8(0x80 | (2 << 5) | (t & 31)), ...rest);
    else parts.push(u8(1), u32(t), ...rest);
    if (o.dev) parts.push(u16(0xBEEF));
    if (i === 3) { // an event message (21) in the middle: timestamp, event, event_type
      def(4, 21, [[253, 4, 0x86], [0, 1, 0x00], [1, 1, 0x00]]);
      parts.push(u8(4), u32(t), u8(0), u8(0));
    }
  });
  const first = points[0], last = points[points.length - 1];
  const hrs = points.map(p => p.hr).filter(Boolean);
  const be = !!o.bigEndian;
  def(3, 18, [[253, 4, 0x86], [2, 4, 0x86], [5, 1, 0x00], [7, 4, 0x86], [8, 4, 0x86], [9, 4, 0x86], [16, 1, 0x02], [17, 1, 0x02], [22, 2, 0x84]], { be });
  parts.push(u8(3), u32(fts(last.t), be), u32(fts(first.t), be), u8(o.sport), u32(Math.round((last.t - first.t) * 1000), be), u32(Math.round((o.timer != null ? o.timer : last.t - first.t) * 1000), be),
    u32(Math.round(last.dist * 100), be), u8(hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0xFF), u8(hrs.length ? Math.max(...hrs) : 0xFF), u16(o.ascent || 0, be));
  const data = Buffer.concat(parts);
  const head = Buffer.alloc(12); head[0] = 14; head[1] = 0x20; head.writeUInt16LE(2140, 2); head.writeUInt32LE(data.length, 4); head.write('.FIT', 8, 'ascii');
  const header = Buffer.concat([head, u16(fitCrc(head))]);
  return Buffer.concat([header, data, u16(fitCrc(Buffer.concat([header, data])))]);
}
module.exports = { makeRun, toGpx, toTcx, toFit, fitCrc, T0, LAT0, LON0 };
