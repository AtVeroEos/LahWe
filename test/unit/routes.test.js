'use strict';
// Routes: reading GPX, TCX and FIT, cleaning a track, measuring it, thinning it, packing it, and keeping it outside S.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const T = require('../fixtures/tracks.js');

const fresh = over => { const app = loadApp({ now: '2026-10-08T09:00:00' }); app.state(Object.assign({ bodyweight: 190 }, over || {})); return app; };
const aj = async (app, code) => JSON.parse(await app.run(`(async()=>JSON.stringify(await (${code})))()`));
const MILE = 1609.344;
// routeFromTrack on a file's bytes → {sec, meters, rec (without the packed points), sum, pts (decoded)}
function route(app, kind, bytes, type, meters) {
  app.set('window._b', bytes);
  return app.json(`(()=>{const x=routeFromTrack(trackParse(${JSON.stringify(kind)},new Uint8Array(_b)),${JSON.stringify(type || 'run')},${meters || 0});if(!x)return null;const d=routeDecode(x.rec);
    return{sec:x.sec,meters:x.meters,rec:Object.assign({},x.rec,{p:x.rec.p.length}),sum:x.sum,pts:d}})()`);
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (±${tol})`);

test('FIT: definitions, data, compressed timestamps, developer fields and both byte orders all give the same track', () => {
  const app = fresh();
  const pts = T.makeRun({ legs: [[0, 1500], [800, 0]], speed: 3, hr: t => 140 + t / 100, hill: d => 5 + d / 100 });
  const read = o => { app.set('window._b', T.toFit(pts, o)); return app.json('(()=>{const f=fitDecode(new Uint8Array(_b));return{n:f.lat.length,lat:[f.lat[0],f.lat[400]],lon:[f.lon[0],f.lon[400]],ts:[f.ts[0],f.ts[17],f.ts[f.ts.length-1]],ele:f.ele[400],hr:f.hr[400],dist:f.dist[f.dist.length-1],session:f.session}})()'); };
  const plain = read({});
  assert.equal(plain.n, pts.length);
  near(plain.lat[1], pts[400].lat, 1e-6); near(plain.lon[1], pts[400].lon, 1e-6);
  assert.deepEqual(plain.ts, [pts[0].t, pts[17].t, pts[pts.length - 1].t], 'seconds since 1989 become ordinary times');
  near(plain.ele, pts[400].ele, 0.11, 'altitude: a fifth of a metre, offset 500');
  assert.equal(plain.hr, pts[400].hr); near(plain.dist, 2300, 0.01);
  assert.equal(plain.session.sport, 'Run'); assert.equal(plain.session.start, pts[0].t * 1000); near(plain.session.meters, 2300, 0.01); assert.equal(plain.session.timer, pts.length - 1);
  for (const o of [{ compressed: true }, { dev: true }, { bigEndian: true }, { oldAltitude: true }, { compressed: true, dev: true, bigEndian: true, oldAltitude: true }])
    assert.deepEqual(read(o), plain, 'the same track with ' + JSON.stringify(o));
  // not a FIT file, and a file cut off half way
  app.set('window._b', Buffer.from('<gpx></gpx>')); assert.throws(() => app.run('fitDecode(new Uint8Array(_b))'), /not a FIT file/);
  const whole = T.toFit(pts, {}); app.set('window._b', whole.subarray(0, Math.floor(whole.length / 2)));
  const cut = app.json('(()=>{const f=fitDecode(new Uint8Array(_b));return{n:f.lat.length}})()');
  assert.ok(cut.n > 300 && cut.n < pts.length, `a damaged file gives what could be read (${cut.n} points) instead of failing`);
});

test('GPX, TCX and FIT of one run agree, and the numbers are the run’s', () => {
  const app = fresh();
  // 5 km at 3 m/s: 1667 s, 536.4 s a mile
  const pts = T.makeRun({ legs: [[0, 2500], [1500, 0], [0, -1000]], speed: 3, hr: t => 140 + t / 100 });
  const g = route(app, 'gpx', Buffer.from(T.toGpx(pts)), 'run', 5000), t = route(app, 'tcx', Buffer.from(T.toTcx(pts))), f = route(app, 'fit', T.toFit(pts, { compressed: true }));
  for (const [name, r] of [['gpx', g], ['tcx', t], ['fit', f]]) {
    near(r.meters, 5000, 1, name + ' distance'); near(r.sec, 1667, 1.5, name + ' time');
    assert.equal(r.rec.sp.length, 3, name + ': three full miles'); r.rec.sp.forEach(s => near(s, 536.4, 1.5, name + ' mile split'));
    near(r.rec.lp[0], 5000 - 3 * MILE, 2); near(r.sum.be.m1, 536.4, 1.5); near(r.sum.be.m2, 1072.9, 2); near(r.sum.be.k5, 1667, 2, name + ' 5K');
    assert.ok(!r.sum.be.k10, 'no 10K inside a 5K'); assert.equal(r.sum.hr, 148); assert.equal(r.sum.hrx, 157);
    assert.equal(r.rec.at, pts[0].t * 1000);
  }
  // the GPX has no distance of its own: its 4,985 m along the track is scaled to the 5,000 the activity says
  near(route(app, 'gpx', Buffer.from(T.toGpx(pts)), 'run', 0).meters, 4990, 12, 'unscaled');
  assert.equal(route(app, 'gpx', Buffer.from(T.toGpx(pts)), 'run', 9000).meters < 5000, true, 'a distance that disagrees by more than 8% is not forced onto the track');
  // self-closing track points, and a file with no positions at all
  assert.equal(app.json(`trackFromGpx('<gpx><trk><trkseg><trkpt lat="1" lon="2"/><trkpt lon="2.001" lat="1.001"><time>2026-01-01T00:00:00Z</time></trkpt></trkseg></trk></gpx>').lat.length`), 2);
  assert.equal(route(app, 'gpx', Buffer.from('<gpx><trk><name>Treadmill</name></trk></gpx>')), null);
});

test('standing still is not part of the time, whether the watch kept recording or paused itself', () => {
  const app = fresh();
  const base = { legs: [[0, 5000]], speed: 3, noise: 0.8, seed: 3 };
  const moving = route(app, 'gpx', Buffer.from(T.toGpx(T.makeRun(base))), 'run');
  const stood = route(app, 'gpx', Buffer.from(T.toGpx(T.makeRun(Object.assign({ pauseAt: 600, pauseFor: 60 }, base)))), 'run');
  const auto = route(app, 'gpx', Buffer.from(T.toGpx(T.makeRun(Object.assign({ pauseAt: 600, pauseFor: 90, autoPause: true }, base)))), 'run');
  near(moving.sec, 1667, 2);
  near(stood.sec, moving.sec, 6, 'a minute at a crossing, jittering on the spot'); near(stood.rec.el, moving.rec.el + 60, 1, 'elapsed time still has it');
  near(stood.meters, moving.meters, 15, 'and the jitter adds no distance');
  near(auto.sec, moving.sec, 3, 'auto-pause: the gap in the recording'); near(auto.rec.el, moving.rec.el + 90, 1);
  near(stood.sum.be.m1, moving.sum.be.m1, 4, 'the best mile is not slowed by the stop');
});

test('GPS spikes are dropped, a wrong first fix does not swallow the track, and wobble does not lengthen the run', () => {
  const app = fresh();
  const base = { legs: [[0, 1200], [1300, 0], [0, -1200], [-1300, 0]], speed: 3.2 };
  const clean = route(app, 'gpx', Buffer.from(T.toGpx(T.makeRun(base))), 'run');
  const spiky = route(app, 'gpx', Buffer.from(T.toGpx(T.makeRun(Object.assign({ spikeAt: 300 }, base)))), 'run');
  near(spiky.meters, clean.meters, 2, 'one fix 500 m away adds nothing');
  const maxLon = Math.max(...spiky.pts.lon); assert.ok(maxLon < T.LON0 + 1350 / 98230, 'and is not on the line that is kept');
  // the first three fixes are 5 km away (a watch still finding itself)
  const pts = T.makeRun(base); for (let i = 0; i < 3; i++) pts[i].lat += 0.05;
  near(route(app, 'gpx', Buffer.from(T.toGpx(pts)), 'run').meters, clean.meters, 25, 'a bad start is thrown away, not the rest');
  for (const noise of [0.5, 1.6, 3]) near(route(app, 'gpx', Buffer.from(T.toGpx(T.makeRun(Object.assign({ noise, seed: 9 }, base)))), 'run').meters, 5000, 60, `±${noise} m of wander`);
  // a walk is held to a walker's speed: a 9 m/s hop is a spike for a ruck, not for a ride
  const fast = T.makeRun({ legs: [[0, 3000]], speed: 9 });
  assert.equal(route(app, 'gpx', Buffer.from(T.toGpx(fast)), 'ruck'), null); near(route(app, 'gpx', Buffer.from(T.toGpx(fast)), 'bike').meters, 3000, 8);
});

test('best efforts are found inside a run, and splits show which half was faster', () => {
  const app = fresh();
  // 4 miles: an easy first half, a hard second half
  const pts = T.makeRun({ legs: [[0, 4 * MILE]], speed: (t, d) => d < 2 * MILE ? 2.8 : 3.5 });
  const r = route(app, 'tcx', Buffer.from(T.toTcx(pts)));
  assert.equal(r.rec.sp.length, 4); assert.equal(r.rec.lp, null, 'exactly four miles: no part-mile row');
  near(r.rec.sp[0], MILE / 2.8, 2); near(r.rec.sp[3], MILE / 3.5, 2);
  near(r.sum.be.m1, MILE / 3.5, 1.5, 'the fastest mile is one of the last two, not the average');
  near(r.sum.be.m2, 2 * MILE / 3.5, 2); assert.ok(r.sum.be.k5 > r.sum.be.m2 && r.sum.be.k5 < 5000 / 3.0, 'the fastest 5K reaches back into the slow half');
  // "two miles" that is two metres short still has two mile splits and a two-mile best
  const two = route(app, 'tcx', Buffer.from(T.toTcx(T.makeRun({ legs: [[0, 2 * MILE - 2]], speed: 3.6 }))));
  assert.equal(two.rec.sp.length, 2); assert.equal(two.rec.lp, null); near(two.sum.be.m2, (2 * MILE - 2) / 3.6, 1.5);
  assert.equal(app.run('trackBest({n:2,timed:true,d:[0,1500],t:[0,500]},1609.344)'), null, 'a 1,500 m run has no mile in it');
});

test('hills: the climb, a grade-adjusted distance when the elevation is clean, and a refusal when it is not', () => {
  const app = fresh();
  const legs = [[0, 5000]];
  const hill = d => 10 + 40 * Math.sin(Math.PI * Math.min(1, d / 4000));       // up 40 m and back down
  const smooth = route(app, 'gpx', Buffer.from(T.toGpx(T.makeRun({ legs, speed: 3, hill }))), 'run');
  assert.equal(smooth.rec.eq, 2); near(smooth.rec.up, 40, 3); near(smooth.rec.dn, 40, 3); assert.equal(smooth.sum.up, smooth.rec.up);
  assert.ok(smooth.rec.ge > smooth.rec.m * 1.003 && smooth.rec.ge < smooth.rec.m * 1.05, `a hill costs more than it gives back (${smooth.rec.ge} m on the flat for ${smooth.rec.m})`);
  const flat = route(app, 'gpx', Buffer.from(T.toGpx(T.makeRun({ legs, speed: 3 }))), 'run');
  assert.equal(flat.rec.up, 0); near(flat.rec.ge, flat.rec.m, 2, 'flat ground is worth exactly itself');
  let s = 7; const jitter = () => { s = (s * 16807) % 2147483647; return (s / 2147483647 - 0.5) * 16; };
  const rough = route(app, 'gpx', Buffer.from(T.toGpx(T.makeRun({ legs, speed: 3, hill: d => hill(d) + jitter() }))), 'run');
  assert.equal(rough.rec.eq, 1, 'phone-GPS altitude that jumps eight metres a second is called rough'); assert.equal(rough.rec.ge, 0); assert.ok(!rough.sum.up, 'and its climb is not kept as a fact');
  const none = route(app, 'gpx', Buffer.from(T.toGpx(T.makeRun({ legs, speed: 3 }), { noEle: true })), 'run');
  assert.equal(none.rec.eq, 0); assert.equal(none.rec.f & 1, 0); assert.equal(none.pts.ele, null);
  assert.equal(app.run('gradeCost(0)'), 1); assert.ok(app.run('gradeCost(0.1)') > 1.5); assert.equal(app.run('gradeCost(-0.2)'), 0.87, 'a steep descent is credited 13% at most');
});

test('thinning keeps the shape, never leaves more than 20 seconds between points, and survives packing', () => {
  const app = fresh();
  const pts = T.makeRun({ legs: [[0, 5000]], speed: 3, hr: t => 120 + 40 * Math.sin(t / 200), hill: d => 5 + d / 250 });
  const r = route(app, 'tcx', Buffer.from(T.toTcx(pts)));
  assert.ok(r.rec.n >= 80 && r.rec.n <= 100, `a dead-straight 28-minute run keeps ${r.rec.n} of ${pts.length} points, not two`);
  let gap = 0; for (let i = 1; i < r.pts.n; i++) gap = Math.max(gap, r.pts.t[i] - r.pts.t[i - 1]);
  assert.ok(gap <= 21, `longest gap ${gap} s`);
  assert.ok(r.rec.p < 1200, `${r.rec.p} characters for 5 km`);
  near(r.pts.lat[r.pts.n - 1], pts[pts.length - 1].lat, 1e-5); near(r.pts.d[r.pts.n - 1], 5000, 0.1); assert.equal(r.pts.t[r.pts.n - 1], 1667);
  const mid = Math.floor(r.pts.n / 2); near(r.pts.hr[mid], 120 + 40 * Math.sin(r.pts.t[mid] / 200), 1.5, 'heart rate is still on the kept points'); near(r.pts.ele[mid], 5 + r.pts.d[mid] / 250, 0.2);
  // a square: the corners are kept exactly
  const sq = route(app, 'tcx', Buffer.from(T.toTcx(T.makeRun({ legs: [[0, 1000], [1000, 0], [0, -1000], [-1000, 0]], speed: 3 }))));
  near(Math.max(...sq.pts.lat), T.LAT0 + 1000 / 111195.08, 4e-5, 'north side'); near(Math.max(...sq.pts.lon), T.LON0 + 1000 / (111195.08 * Math.cos(T.LAT0 * Math.PI / 180)), 4e-5, 'east side');
  // packing: negative steps, large values, and both optional columns
  const rt = app.json(`(()=>{const e=routeEncode({lat:[-33.5,-33.50001,40],lon:[151.2,151.19,-179.99999],t:[0,5,7200],d:[0,12.34,99999.9],ele:[-12.3,0,4000.5],hr:[0,180,95]});return{e,d:routeDecode(Object.assign({v:1},e))}})()`);
  assert.equal(rt.e.f, 3); assert.deepEqual(rt.d.lat, [-33.5, -33.50001, 40]); assert.deepEqual(rt.d.lon, [151.2, 151.19, -179.99999]);
  assert.deepEqual(rt.d.t, [0, 5, 7200]); assert.deepEqual(rt.d.d, [0, 12.3, 99999.9]); assert.deepEqual(rt.d.ele, [-12.3, 0, 4000.5]); assert.deepEqual(rt.d.hr, [0, 180, 95]);
  assert.match(rt.e.p, /^[A-Za-z0-9_-]+$/, 'only characters that are safe anywhere');
});

test('a route record from a file is rebuilt field by field; anything that does not decode is refused', () => {
  const app = fresh();
  const good = route(app, 'tcx', Buffer.from(T.toTcx(T.makeRun({ legs: [[0, 2000]], speed: 3 }))));
  app.set('window._b', Buffer.from(T.toTcx(T.makeRun({ legs: [[0, 2000]], speed: 3 }))));
  const c = code => app.json(`(()=>{const x=routeFromTrack(trackParse('tcx',new Uint8Array(_b)),'run',0).rec;return cleanRouteRec(${code})})()`);
  assert.equal(c('x').n, good.rec.n);
  assert.equal(c(`Object.assign({},x,{p:'<img src=x onerror=alert(1)>'})`), null, 'markup is not a route');
  assert.equal(c(`Object.assign({},x,{p:x.p.slice(0,-1)+'h'})`), null, 'a string that ends mid-number');
  assert.equal(c(`Object.assign({},x,{v:2})`), null); assert.equal(c(`'route'`), null); assert.equal(c(`Object.assign({},x,{p:'A'.repeat(500000)})`), null, 'too long');
  const odd = c(`Object.assign({},x,{sec:'<b>',m:-5,sp:['x',1e99,300],lp:'no',eq:9,hr:'150',extra:'<script>'})`);
  assert.deepEqual([odd.sec, odd.m, odd.sp, odd.lp, odd.eq, odd.hr, 'extra' in odd], [0, 0, [0, 1e6, 300], null, 0, 150, false]);
  // the summary an activity carries holds numbers only, and no position
  assert.deepEqual(app.json(`cleanRouteSummary({n:'81',be:{m1:'432.26',k5:-1,evil:'<x>'},up:12.4,hr:'155',hrx:999,lat:27.9,p:'AAAA'})`), { n: 81, be: { m1: 432.3 }, up: 12, hr: 155, hrx: 260 });
  const s = app.json(`normalizeState({_schema:3,activities:[{id:'a',date:'2026-10-01',type:'run',dist:'3',dur:'25',sec:'1512.34',gear:'  Ghost 15  ',rt:{n:5,be:{k5:1500}}},{id:'b',date:'2026-10-02',type:'run',sec:-4,gear:'',rt:'x'}],_routes:{a:{}},running:'yes'})`);
  assert.deepEqual(s.activities[0], { id: 'a', date: '2026-10-01', type: 'run', dist: '3', dur: '25', sec: 1512.3, gear: 'Ghost 15', rt: { n: 5, be: { k5: 1500 } } });
  assert.deepEqual(Object.keys(s.activities[1]).sort(), ['date', 'id', 'type']); assert.ok(!('_routes' in s), 'routes in a state file never become part of S'); assert.equal(s.running, null);
});

test('the same route is recognised on another day; a different loop, the loop reversed, or a different start is not', () => {
  const app = fresh();
  const loop = [[0, 1200], [1300, 0], [0, -1200], [-1300, 0]];
  const mk = (o, name) => { app.set('window._b', Buffer.from(T.toGpx(T.makeRun(Object.assign({ speed: 3.1, noise: 1.5 }, o))))); app.run(`window.${name}=routeDecode(routeFromTrack(trackParse('gpx',new Uint8Array(_b)),'run',0).rec)`); };
  mk({ legs: loop, seed: 1 }, 'A'); mk({ legs: loop, seed: 2, speed: 2.7 }, 'B');
  mk({ legs: loop.concat([[0, 120]]), seed: 3 }, 'Long');                                   // ran 120 m past the door
  mk({ legs: [[1300, 0], [0, 1200], [-1300, 0], [0, -1200]], seed: 4 }, 'Rev');             // the same streets the other way
  mk({ legs: [[0, 1250], [-1250, 0], [0, -1250], [1250, 0]], seed: 5 }, 'West');            // same door, same length, other side of the road
  mk({ legs: loop, seed: 6, lat0: T.LAT0 + 0.003 }, 'Moved');                               // the same shape 330 m north
  mk({ legs: [[0, 1700], [1300, 0], [0, -1700], [-1300, 0]], seed: 7 }, 'Big');
  const same = (a, b) => app.run(`sameRoute(${a},${b})`);
  assert.equal(same('A', 'B'), true, 'a slower day on the same loop'); assert.equal(same('A', 'Long'), true, 'a little past the usual finish');
  assert.equal(same('A', 'Rev'), false); assert.equal(same('A', 'West'), false); assert.equal(same('A', 'Moved'), false); assert.equal(same('A', 'Big'), false, 'more than 5% longer');
});

test('routes are stored beside S, never in it; deleting, backing up and restoring carry them', async () => {
  const app = fresh({ activities: [{ id: 'r1', type: 'run', date: '2026-10-01', dist: '3.11', dur: '26' }, { id: 'r2', type: 'run', date: '2026-10-03', dist: '3.11', dur: '27' }] });
  app.set('window._b', Buffer.from(T.toGpx(T.makeRun({ legs: [[0, 5000]], speed: 3.2 }))));
  await app.run(`(async()=>{for(const id of ['r1','r2','gone']){const x=routeFromTrack(trackParse('gpx',new Uint8Array(_b)),'run',5000);await Routes.put(id,x.rec);const a=S.activities.find(q=>q.id===id);if(a)a.rt=x.sum;}save();})()`);
  const packed = app.run(`Routes.mem.get('r1').p`);
  assert.ok(packed.length > 300 && !app.run('JSON.stringify(S)').includes(packed.slice(0, 60)), 'the points are not in S');
  assert.ok(!/"lat"|"lon"/.test(app.run('JSON.stringify(S)')), 'and nothing in S says where');
  const coach = app.json(`coachTools().find(t=>t.name==='get_activity').run({days:30}).out`);
  assert.deepEqual(Object.keys(coach.activities[0]).sort(), ['avg_heart_rate', 'climb_ft', 'date', 'id', 'kcal', 'miles', 'minutes', 'notes', 'type'].filter(k => coach.activities[0][k] !== undefined).sort(), 'the coach is given summaries');
  assert.ok(!JSON.stringify(coach).includes(packed.slice(0, 40)), 'never the route');
  // a backup carries the routes of activities that still exist, and only those
  const bk = JSON.parse(app.run(`backupJSON(routesForBackupNow())`));
  assert.deepEqual(Object.keys(bk._routes).sort(), ['r1', 'r2']); assert.equal(bk._routes.r1.p, packed);
  app.run('Store.ready=true'); assert.equal(await app.run('routesSweep()'), 1, 'a route whose activity is gone is cleared at launch');
  assert.equal(await aj(app, `Routes.get('gone')`), null);
  // restore on a clean device: the block is taken out before the state is read, and the routes come back
  const other = fresh();
  other.set('window._bk', JSON.stringify(bk));
  await other.run(`(async()=>{const data=JSON.parse(_bk);const routes=routesFromBackup(data);window._had='_routes' in data;replaceState(data);await routesRestore(routes);})()`);
  assert.equal(other.run('_had'), false); assert.ok(!('_routes' in other.json('S')));
  assert.equal(other.run(`Routes.mem.get('r2').p`), packed); assert.equal(other.json(`S.activities.find(a=>a.id==='r1').rt.be.k5`) > 1500, true);
  // a hostile block in a backup: bad records are dropped, good ones kept, nothing reaches S
  const evil = Object.assign({}, bk, { _routes: { r1: bk._routes.r1, r2: { v: 1, p: '<script>alert(1)</script>' }, x: 'nope' } });
  other.set('window._bk', JSON.stringify(evil));
  assert.deepEqual(other.json(`[...routesFromBackup(JSON.parse(_bk)).keys()]`), ['r1']);
  // an old backup, from before routes existed
  assert.equal(other.json(`routesFromBackup({workouts:[],activities:[]}).size`), 0);
  // deleting an activity through the sheet removes its route now
  app.run(`deleteActivity('r1');doConfirm()`); await app.run('Promise.resolve()');
  assert.equal(await aj(app, `Routes.get('r1')`), null); assert.equal(app.json('S.activities.length'), 1);
  assert.equal(app.run(`actSec({sec:1570.4,dur:'26'})`), 1570.4); assert.equal(app.run(`actSec({dur:'26'})`), 1560);
});
