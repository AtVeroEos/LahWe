'use strict';
// A made-up Strava archive: activities.csv plus each activity's own recording in the formats
// Strava really hands back (.fit.gz from a watch, .gpx and .gpx.gz, .tcx.gz), for a runner who
// repeats a few routes and gets a little faster. Seeded, so it is the same every time.
//   makeArchive({ now, weeks })  → { zip (Buffer), csv, rows:[{id, date, type, miles, sec, file, route}] }
const zlib = require('zlib');
const { makeZip } = require('./strava.js');
const { makeRun, toGpx, toTcx, toFit } = require('./tracks.js');

const HEADER = ['Activity ID', 'Activity Date', 'Activity Name', 'Activity Type', 'Activity Description', 'Elapsed Time', 'Distance', 'Max Heart Rate', 'Relative Effort', 'Commute', 'Activity Private Note', 'Activity Gear', 'Filename', 'Athlete Weight', 'Bike Weight', 'Elapsed Time', 'Moving Time', 'Distance', 'Max Speed', 'Average Speed', 'Elevation Gain', 'Calories'];
const q = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function stravaDate(ms) { // "Oct 6, 2026, 10:15:00 AM", in UTC
  const d = new Date(ms); let h = d.getUTCHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  const p = n => String(n).padStart(2, '0');
  return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${h}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} ${ap}`;
}
// Routes, as legs in metres from a start point. Two of them begin at the same door.
const ROUTES = {
  loop5k: { legs: [[0, 1200], [1300, 0], [0, -1200], [-1300, 0]], at: [0, 0], hill: d => 6 + 14 * Math.sin(Math.PI * Math.min(1, Math.max(0, (d - 800) / 2400))) },
  out2mi: { legs: [[1500, 580], [-1500, -580]], at: [0, 0], hill: () => 6 },
  park4mi: { legs: [[-900, 0], [0, 1500], [1700, 0], [0, -1500], [-800, 0], [0, 38]], at: [2500, -1800], hill: d => 9 + 6 * Math.sin(d / 500) },
  long10k: { legs: [[0, 1900], [2300, 0], [0, -1500], [-900, 0], [0, -1200], [-1400, 0], [0, 800]], at: [0, 0], hill: d => 6 + 22 * Math.sin(Math.PI * Math.min(1, d / 6000)) },
  ruck: { legs: [[-2000, 0], [0, 1220], [2000, 0], [0, -1220]], at: [-600, 900], hill: () => 7 },
};
function makeArchive(o) {
  o = Object.assign({ now: Date.now(), weeks: 8 }, o || {});
  let seed = 4242; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const files = [['export_77/profile.csv', 'a,b\n1,2\n']]; const rows = []; let id = 5100;
  const plan = [[1, 'loop5k', 'Morning Run', 'gpx'], [3, 'out2mi', 'Two-mile effort', 'fit'], [5, 'park4mi', 'Park loops', 'tcx'], [6, 'long10k', 'Long run', 'fit']];
  const day0 = new Date(o.now); day0.setUTCHours(11, 0, 0, 0);
  for (let w = o.weeks - 1; w >= 0; w--) {
    const weekly = plan.concat(w % 3 === 1 ? [[2, 'ruck', 'Ruck with 35 lb', 'gpx']] : []);
    for (const [dow, key, name, fmt] of weekly) {
      const back = w * 7 + ((day0.getUTCDay() + 7 - dow) % 7);
      if (back <= 0 && w === 0 && dow > day0.getUTCDay()) continue;
      if (key === 'long10k' && w % 2) continue;                 // a long run every other week
      const start = day0.getTime() - back * 86400000 + Math.floor(rnd() * 3600) * 1000;
      if (start > o.now) continue;
      const r = ROUTES[key]; const fit = (o.weeks - w) / o.weeks;   // 0 → 1 as the weeks pass
      const base = key === 'ruck' ? 1.72 : (key === 'out2mi' ? 3.45 : key === 'long10k' ? 2.85 : 3.1) * (1 + 0.05 * fit) * (0.985 + rnd() * 0.03);
      const type = key === 'ruck' ? 'Walk' : 'Run';
      const pts = makeRun({
        legs: r.legs, lat0: 27.95 + r.at[1] / 111195, lon0: -82.45 + r.at[0] / 98230, t0: Math.round(start / 1000), seed: id, noise: 1.6,
        speed: (t, d) => base * (key === 'out2mi' ? 1 + 0.04 * Math.min(1, d / 3000) : 1 - 0.03 * Math.min(1, d / 6000)) * (1 + 0.02 * Math.sin(t / 37)),
        hill: r.hill, hr: key === 'ruck' ? null : (t, d) => Math.min(186, 118 + 38 * (1 - Math.exp(-t / 240)) + 12 * (base / 3.1 - 1) * 10 + 4 * Math.sin(t / 50)),
        pauseAt: key === 'loop5k' && w % 4 === 2 ? 600 : null, pauseFor: 45, autoPause: w % 8 === 2,
        spikeAt: key === 'park4mi' && w % 5 === 0 ? 300 : null,
      });
      const last = pts[pts.length - 1];
      const elapsed = last.t - pts[0].t; const moving = elapsed - (key === 'loop5k' && w % 4 === 2 ? 45 : 0);
      let file, bytes;
      const meta = { name, type: type === 'Run' ? 'running' : 'walking', sport: type === 'Run' ? 1 : 11 };
      if (fmt === 'fit') { file = `activities/${id}.fit.gz`; bytes = zlib.gzipSync(toFit(pts, { sport: meta.sport, compressed: id % 2 === 0, timer: moving })); }
      else if (fmt === 'tcx') { file = `activities/${id}.tcx.gz`; bytes = zlib.gzipSync(Buffer.from(toTcx(pts, { sport: 'Running' }))); }
      else if (id % 2) { file = `activities/${id}.gpx.gz`; bytes = zlib.gzipSync(Buffer.from(toGpx(pts, meta))); }
      else { file = `activities/${id}.gpx`; bytes = Buffer.from(toGpx(pts, meta)); }
      files.push(['export_77/' + file, bytes]);
      rows.push({ id: String(id), at: start, name, type, elapsed, moving, meters: last.dist, file, route: key, gear: type === 'Run' ? (w >= o.weeks / 2 ? 'Brooks Ghost 15' : 'Saucony Ride 17') : '' });
      id++;
    }
  }
  // One activity with no recording at all (a treadmill run typed into Strava), and a ride.
  rows.push({ id: String(id++), at: day0.getTime() - 9 * 86400000, name: 'Treadmill', type: 'Run', elapsed: 1500, moving: 1500, meters: 4828, file: '', route: null, gear: 'Brooks Ghost 15' });
  rows.push({ id: String(id++), at: day0.getTime() - 4 * 86400000, name: 'Lunch Ride', type: 'Ride', elapsed: 4000, moving: 3600, meters: 32186.9, file: '', route: null, gear: '' });
  rows.sort((a, b) => b.at - a.at);
  const line = v => [v.id, stravaDate(v.at), v.name, v.type, '', v.elapsed, (v.meters / 1000).toFixed(2), '', '', 'false', '', v.gear, v.file, '', '', v.elapsed + '.0', v.moving + '.0', v.meters.toFixed(1), '', '', '', ''].map(q).join(',');
  const csv = '﻿' + HEADER.map(q).join(',') + '\r\n' + rows.map(line).join('\r\n') + '\r\n';
  files.push(['export_77/activities.csv', csv]);
  return { zip: makeZip(files), csv, rows };
}
module.exports = { makeArchive, ROUTES };
