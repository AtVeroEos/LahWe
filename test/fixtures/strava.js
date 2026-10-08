'use strict';
// A Strava activities.csv in the shape of a real bulk export: repeated "Elapsed Time" and "Distance"
// columns (the first Distance in km, the second in metres), dates in UTC in two of Strava's formats,
// a description with commas, quotes and a line break, and a non-GPS weight-training session.
const HEADER = ['Activity ID', 'Activity Date', 'Activity Name', 'Activity Type', 'Activity Description', 'Elapsed Time', 'Distance', 'Max Heart Rate', 'Relative Effort', 'Commute', 'Activity Private Note', 'Activity Gear', 'Filename', 'Athlete Weight', 'Bike Weight', 'Elapsed Time', 'Moving Time', 'Distance', 'Max Speed', 'Average Speed', 'Elevation Gain', 'Calories'];
const q = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
function row(o) {
  const v = Object.assign({ desc: '', el: 0, km: '', file: '', mov: 0, m: '', cal: '' }, o);
  return [v.id, v.date, v.name, v.type, v.desc, v.el, v.km, '', '', 'false', '', '', v.file, '', '', v.el + '.0', v.mov + '.0', v.m, '', '', '', v.cal].map(q).join(',');
}
const ROWS = [
  { id: '9001', date: 'Oct 6, 2026, 10:15:00 AM', name: 'Morning Run', type: 'Run', desc: 'Easy, "conversational"\npace', el: 1900, mov: 1800, km: '5.00', m: '5000.0', cal: '410', file: 'activities/9001.fit.gz' },
  { id: '9002', date: '5 Oct 2026, 23:30:00', name: 'Ruck with 35 lb', type: 'Walk', el: 3700, mov: 3600, km: '6.44', m: '6437.4', file: 'activities/9002.gpx' },
  { id: '9003', date: 'Oct 4, 2026, 2:00:00 PM', name: 'Lunch Ride', type: 'Ride', el: 4000, mov: 3600, km: '32.19', m: '32186.9' },
  { id: '9004', date: 'Oct 3, 2026, 12:00:00 PM', name: 'Chest day', type: 'Weight Training', el: 3600, mov: 3600, km: '0.00', m: '0.0' },
  { id: '9005', date: 'Oct 2, 2026, 11:00:00 AM', name: 'Pool', type: 'Swim', el: 2400, mov: 2200, km: '1.50', m: '1500.0' },
  { id: '9006', date: 'Sep 30, 2026, 1:00:00 PM', name: 'Trail', type: 'Trail Run', el: 2500, mov: 2400, km: '8.05', m: '8046.7' },
];
const CSV = '﻿' + HEADER.map(q).join(',') + '\r\n' + ROWS.map(row).join('\r\n') + '\r\n';
const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="StravaGPX" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
 <metadata><time>2026-10-07T11:00:00Z</time></metadata>
 <trk><name>Evening Run &amp; Strides</name><type>running</type><trkseg>
  <trkpt lat="27.9500" lon="-82.4500"><ele>5</ele><time>2026-10-07T22:00:00Z</time></trkpt>
  <trkpt lat="27.9590" lon="-82.4500"><ele>5</ele><time>2026-10-07T22:05:00Z</time></trkpt>
  <trkpt lat="27.9680" lon="-82.4500"><ele>5</ele><time>2026-10-07T22:10:00Z</time></trkpt>
 </trkseg></trk></gpx>`;
// A stored-or-deflated zip with activities.csv under export_123/, built the way Strava's is.
function makeZip(files) {
  const zlib = require('zlib');
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const locals = [], centrals = []; let off = 0;
  for (const [name, content] of files) {
    const data = Buffer.from(content); const comp = zlib.deflateRawSync(data); const nm = Buffer.from(name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc(data), 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc(data), 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    locals.push(lh, nm, comp); centrals.push(ch, nm); off += 30 + nm.length + comp.length;
  }
  const cd = Buffer.concat(centrals); const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, e]);
}
module.exports = { CSV, GPX, makeZip };
