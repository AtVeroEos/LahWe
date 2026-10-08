'use strict';
// Import from Strava with routes: every recording format out of the archive, re-importing to
// attach routes without duplicating, Undo, the zip reader's limits, and a realistic mock export
// (fixtures/strava-mock-export.zip: its positions were moved with tools/relocate-export.js, so the
// routes keep their shape but sit somewhere no one ran them).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { loadApp } = require('../harness.js');
const { CSV, GPX, makeZip } = require('../fixtures/strava.js');
const { makeArchive } = require('../fixtures/archive.js');
const T = require('../fixtures/tracks.js');

const NOW = '2026-10-08T09:00:00';
const fresh = over => { const app = loadApp({ now: NOW }); app.state(Object.assign({ bodyweight: 185, birthYear: 1998 }, over || {})); return app; };
const aj = async (app, code) => JSON.parse(await app.run(`(async()=>JSON.stringify(await (${code})))()`));
const file = (app, name, buf, as) => app.set('window.' + (as || '_f'), new File([buf], name));
// The whole flow the sheet runs, without the sheet: read, plan, apply, read routes.
const IMPORT = `(async(files,kindsOff)=>{const r=await stravaReadFiles(files);const plan=stravaPlan(r.items);const kinds={};Object.keys(plan.kinds).forEach(k=>kinds[k]=!(kindsOff||[]).includes(k));
  const added=stravaApply(plan,kinds);const res=await stravaRoutes({pairs:(plan.made||[]).concat(plan.touch),zips:r.zips,fresh:new Set(added)});
  window._done={added,put:res.put,prev:res.prev};
  return{notes:r.notes,add:plan.add.length,already:plan.already,touch:plan.touch.length,added:added.length,routes:res.routes,failed:res.failed,none:res.none,prev:res.prev.length,error:res.error||''};})`;
const imp = (app, off) => aj(app, `${IMPORT}([_f]${off ? ',' + JSON.stringify(off) : ''})`);

test('the archive: every recording format is read into a route, with the time to the second and the shoes', async () => {
  const arch = makeArchive({ now: new Date(NOW).getTime(), weeks: 4 });
  const app = fresh(); file(app, 'export_77.zip', arch.zip);
  const r = await imp(app);
  const tracked = arch.rows.filter(x => x.file);
  assert.deepEqual([r.add, r.added, r.routes, r.failed, r.none], [arch.rows.length, arch.rows.length, tracked.length, 0, 0]);
  assert.ok(new Set(tracked.map(x => x.file.replace(/^.*?\./, ''))).size === 4, 'the fixture has .gpx, .gpx.gz, .tcx.gz and .fit.gz');
  for (const row of arch.rows) {
    const a = app.json(`S.activities.find(a=>a.srcId===${JSON.stringify(row.id)})`);
    assert.equal(a.sec, row.moving, `${row.id}: the time to the second, from the CSV's moving time`); assert.equal(a.dur, String(Math.round(row.moving / 60)), 'whole minutes are still what is shown');
    if (row.gear) assert.equal(a.gear, row.gear); else assert.ok(!('gear' in a));
    if (!row.file) { assert.ok(!a.rt, 'no recording, no route'); continue; }
    const rec = app.json(`Routes.mem.get(${JSON.stringify(a.id)})`);
    assert.ok(a.rt && rec, `${row.file} → a route`);
    assert.ok(Math.abs(rec.m - row.meters) < 1, `${row.file}: scaled to the activity's distance (${rec.m} vs ${row.meters})`);
    assert.ok(Math.abs(rec.sec - row.moving) <= 12, `${row.file}: its own moving time agrees (${rec.sec} vs ${row.moving})`);
    assert.ok(rec.n >= 20 && rec.n < 400 && rec.p.length < 4500, `${row.file}: thinned to ${rec.n} points, ${rec.p.length} characters`);
    if (a.type === 'run') assert.ok(a.rt.be && a.rt.be.m1 > 300 && a.rt.be.m1 < 700, `${row.file}: a best mile`);
  }
  // the same archive again: nothing to add, nothing to change
  const again = await imp(app);
  assert.deepEqual([again.add, again.already, again.touch, again.added, again.routes], [0, arch.rows.length, 0, 0, 0]);
  assert.equal(app.json('S.activities.length'), arch.rows.length);
  // Undo: the activities and their routes both go
  await app.run('stravaUndo(_done)'); // (the second import changed nothing)
  assert.equal(app.json('S.activities.length'), arch.rows.length);
});

test('re-importing attaches routes to what is already here, never a second copy, and Undo puts it back as it was', async () => {
  const arch = makeArchive({ now: new Date(NOW).getTime(), weeks: 3 });
  const app = fresh();
  // first the CSV alone, the way 3.9 imported: whole minutes, no routes
  file(app, 'activities.csv', Buffer.from(arch.csv)); await imp(app);
  app.run(`S.activities.forEach(a=>{delete a.sec;delete a.gear;});save()`); // exactly what a 3.9 import left behind
  const before = app.json('S.activities');
  assert.ok(before.length === arch.rows.length && before.every(a => !a.rt && !a.sec));
  // now the zip
  file(app, 'export_77.zip', arch.zip);
  const r = await imp(app);
  const tracked = arch.rows.filter(x => x.file).length;
  assert.deepEqual([r.add, r.added, r.touch, r.routes, r.prev], [0, 0, arch.rows.length, tracked, arch.rows.length], 'every activity gains something; none is added');
  assert.equal(app.json('S.activities.length'), before.length);
  assert.deepEqual(app.json('S.activities.map(a=>a.id)'), before.map(a => a.id), 'the same activities, by id');
  assert.equal(app.json('S.activities.filter(a=>a.rt).length'), tracked); assert.equal(app.json('S.activities.filter(a=>a.sec>0).length'), arch.rows.length);
  assert.equal(app.json('Routes.mem.size'), tracked);
  // pace now uses the exact time
  const one = arch.rows.find(x => x.file && x.type === 'Run');
  assert.equal(app.json(`actSec(S.activities.find(a=>a.srcId===${JSON.stringify(one.id)}))`), one.moving);
  // Undo takes back exactly what this import did
  await app.run('stravaUndo(_done)');
  assert.deepEqual(app.json('S.activities'), before); assert.equal(app.json('Routes.mem.size'), 0);
  // and a fresh import's Undo removes its activities and their routes
  const clean = fresh(); file(clean, 'export_77.zip', arch.zip); await imp(clean);
  assert.ok(clean.json('Routes.mem.size') === tracked);
  await clean.run('stravaUndo(_done)');
  assert.deepEqual(clean.json('[S.activities.length,Routes.mem.size]'), [0, 0]);
  // a kind that is switched off is not imported, and its recordings are not read
  const part = fresh(); file(part, 'export_77.zip', arch.zip);
  const pr = await imp(part, ['run']);
  assert.equal(pr.added, arch.rows.filter(x => x.type !== 'Run').length); assert.equal(part.json(`S.activities.filter(a=>a.type==='run').length`), 0);
  assert.equal(pr.routes, arch.rows.filter(x => x.type !== 'Run' && x.file).length);
});

test('single files: a FIT, a GPX or a TCX comes in with its route, and the same file again adds nothing', async () => {
  const app = fresh();
  const pts = T.makeRun({ legs: [[0, 1200], [1300, 0], [0, -1200], [-1300, 0]], speed: 3.1, noise: 1, seed: 5, hr: t => 150 + t / 200, pauseAt: 500, pauseFor: 40 });
  file(app, 'Morning_Run.fit', T.toFit(pts, { compressed: true, timer: pts[pts.length - 1].t - pts[0].t - 40 }));
  const r = await imp(app);
  assert.deepEqual([r.added, r.routes, r.notes.length], [1, 1, 0], 'FIT is read now, not turned away');
  const a = app.json('S.activities[0]');
  assert.equal(a.type, 'run'); assert.equal(a.notes, 'Morning_Run'); assert.equal(a.dist, '3.11'); assert.ok(Math.abs(a.sec - (5000 / 3.1)) < 8, `${a.sec} s: the stop is not in it`);
  assert.ok(a.rt.be.k5 && a.rt.hr > 150 && !a.srcId);
  const again = await imp(app); assert.deepEqual([again.added, again.already, again.touch], [0, 1, 0]);
  // the same run as a gzipped GPX is recognised by its start time
  file(app, 'Morning_Run.gpx.gz', zlib.gzipSync(Buffer.from(T.toGpx(pts))));
  assert.deepEqual((({ added, already }) => [added, already])(await imp(app)), [0, 1]);
  // a hand-made GPX with three points five minutes apart still imports (as in 3.9), now with a route
  const g = fresh(); file(g, 'Evening_Run.gpx', Buffer.from(GPX)); const gr = await imp(g);
  assert.deepEqual([gr.added, gr.routes], [1, 1]); assert.equal(g.json('S.activities[0].dist'), '1.24'); assert.equal(g.json('S.activities[0].sec'), 600);
  // an indoor TCX has no positions: the activity comes in from its totals, without a route
  const tcx = `<TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-10-01T10:00:00Z</Id><Lap StartTime="2026-10-01T10:00:00Z"><TotalTimeSeconds>1500</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters><Track><Trackpoint><Time>2026-10-01T10:00:00Z</Time><DistanceMeters>0</DistanceMeters></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
  const t = fresh(); file(t, 'treadmill.tcx', Buffer.from(tcx)); const tr = await imp(t);
  assert.deepEqual([tr.added, tr.routes], [1, 0]); assert.equal(t.json('S.activities[0].dist'), '3.11'); assert.equal(t.json('!!S.activities[0].rt'), false);
  // junk with a .fit name is explained
  const j = fresh(); file(j, 'ride.fit', Buffer.from([1, 2, 3])); assert.match((await imp(j)).notes[0], /ride\.fit: This is not a FIT file/);
});

test('the zip reader opens only what activities.csv names, refuses protected and oversized members, and stops an unpacking bomb', async () => {
  const run = Buffer.from(T.toGpx(T.makeRun({ legs: [[0, 2000]], speed: 3 })));
  const row = (id, f) => `${id},"Oct 6, 2026, 10:15:00 AM",Run ${id},Run,,700,2.00,,,false,,,${f},,,700.0,700.0,2000.0,,,,`;
  const head = CSV.split('\r\n')[0];
  const csv = [head, row(1, 'activities/1.gpx'), row(2, 'activities/2.gpx'), row(3, 'activities/missing.gpx'), row(4, '../secret.gpx'), row(5, 'activities/5.txt'), row(6, '/activities/6.gpx')].join('\r\n') + '\r\n';
  const zip = makeZip([['export_1/activities.csv', csv], ['export_1/activities/1.gpx', run], ['export_1/activities/2.gpx', run], ['secret.gpx', run], ['export_1/activities/5.txt', run], ['export_1/activities/6.gpx', run], ['export_1/media/photo.jpg', 'x']]);
  // mark member 2 as password-protected in the zip's index
  const at = zip.indexOf(Buffer.from('export_1/activities/2.gpx'), zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))) - 46; zip[at + 8] |= 1;
  const app = fresh(); file(app, 'export_1.zip', zip);
  const items = await aj(app, `stravaReadFiles([_f]).then(r=>r.items.map(i=>[i.srcId,i.file||null]))`);
  assert.deepEqual(items, [['1', 'activities/1.gpx'], ['2', 'activities/2.gpx'], ['3', null], ['4', null], ['5', null], ['6', 'activities/6.gpx']], 'a file that is not in the zip, is outside the export folder, or is not a recording is never asked for');
  const r = await imp(app);
  assert.deepEqual([r.added, r.routes, r.failed], [6, 2, 1]); assert.match(r.error, /password-protected/);
  assert.equal(app.json(`S.activities.filter(a=>a.rt).length`), 2);
  // a member bigger than the limit is refused before it is unpacked; so is one that lies about its size
  file(app, 'big.zip', makeZip([['a.bin', Buffer.alloc(300000, 65)]]));
  await assert.rejects(app.run(`zipIndex(_f).then(ix=>zipExtract(_f,ix[0],100000,'a.bin'))`), /too large/);
  const liar = makeZip([['a.bin', Buffer.alloc(300000, 65)]]); const c = liar.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); liar.writeUInt32LE(10, c + 24);
  file(app, 'liar.zip', liar);
  await assert.rejects(app.run(`zipIndex(_f).then(ix=>zipExtract(_f,ix[0],100000,'a.bin'))`), /too large/, 'the claimed size is not believed: unpacking stops at the limit');
  app.set('window._gz', zlib.gzipSync(Buffer.alloc(2000000, 0)));
  await assert.rejects(app.run(`stravaInflate(new Uint8Array(_gz),'gzip',500000)`), /too large/);
  assert.equal((await app.run(`stravaInflate(new Uint8Array(_gz),'gzip',3000000)`)).length, 2000000);
  // zipRead still finds activities.csv on its own (the 3.9 call)
  file(app, 'export_1.zip', zip);
  assert.ok((await app.run(`zipRead(_f,p=>/(^|\\/)activities\\.csv$/i.test(p),1e6).then(b=>new TextDecoder().decode(b))`)).includes('Activity ID,Activity Date'));
});

test('a realistic export: ten runs from three kinds of device, with stops, hills, repeats and a time trial', async () => {
  const app = fresh(); file(app, 'strava-mock-export.zip', fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'strava-mock-export.zip')));
  const r = await imp(app);
  assert.deepEqual([r.added, r.routes, r.failed, r.none, r.notes.length], [10, 10, 0, 0, 0]);
  const by = name => app.json(`S.activities.filter(a=>a.notes===${JSON.stringify(name)}).sort((x,y)=>x.date<y.date?-1:1)`);
  const rec = a => app.json(`Routes.mem.get(${JSON.stringify(a.id)})`);
  // "Caught every light": 41 s of standing is found in the recording, as Strava found it
  const lights = by('Morning Run')[2]; assert.equal(lights.date, '2026-10-06'); assert.equal(lights.sec, 1684);
  assert.ok(Math.abs(rec(lights).sec - 1684) <= 10 && rec(lights).el === 1724, `moving ${rec(lights).sec} s of ${rec(lights).el} elapsed`);
  const long = by('Long run')[0]; assert.ok(Math.abs(rec(long).sec - 6045) <= 10, `two water stops: ${rec(long).sec} s moving against Strava's 6045`); assert.equal(rec(long).sp.length, 10);
  // the hilly run: its fastest mile went down a hill, so it is not its best mile; its climb is Strava's figure
  const hills = by('Asheville hills')[0];
  assert.equal(rec(hills).up, 177); assert.equal(rec(hills).eq, 2); assert.ok(rec(hills).ge > rec(hills).m * 1.03, 'worth more on the flat');
  assert.ok(Math.min(...rec(hills).sp) < 480 && hills.rt.be.m1 > 520, `a ${Math.min(...rec(hills).sp)} s downhill mile is not the best effort (${hills.rt.be.m1} s is)`);
  // a phone's altitude: too rough for a grade-adjusted pace
  const phone = by('Morning Run')[0]; assert.equal(rec(phone).eq, 1); assert.equal(rec(phone).ge, 0); assert.equal(rec(phone).up, 5, 'the climb shown is Strava’s 4.6 m, not the wobble added up');
  // the time trial inside a longer run
  const tt = by('2-mile time trial')[0]; assert.ok(Math.abs(tt.rt.be.m2 - 893) < 3 && tt.rt.hrx === 181 && tt.gear === 'Saucony Kinvara 15');
  const best = app.json(`(()=>{const b=runBests();return{m1:b.m1.a.notes,m2:b.m2.a.notes,m2s:b.m2.sec}})()`);
  assert.deepEqual([best.m1, best.m2], ['2-mile time trial', '2-mile time trial']);
  assert.match(app.run('runTwoMileText()'), /^On current form 14:53 \(\d+ pts\), from your 2 mi in 14:53 on Aug 26\.$/);
  // sparse recording, no elevation, no heart rate
  const easy = by('Shakeout')[0]; assert.equal(rec(easy).eq, 0); assert.equal(rec(easy).f, 0); assert.ok(!easy.rt.hr && easy.rt.be.m1 > 500);
  // bands: five of the ten are 5Ks by any other name; the ten-miler and the 1.6 are only in all runs
  assert.deepEqual(app.json('paceOptions().map(o=>[o.label,o.n])'), [['Run · all runs', 10], ['Run · 5K', 5], ['Run · 4 mi', 2], ['Run · 10K', 1]]);
  // the same route on other days; the loop run the other way round is not the same route
  const same = async a => (await aj(app, `routeLoad(${JSON.stringify(a.id)}).then(x=>routeTwins(S.activities.find(q=>q.id===${JSON.stringify(a.id)}),x.rt)).then(t=>t.map(q=>q.date).sort())`));
  assert.deepEqual(await same(lights), ['2026-07-14', '2026-08-12'], 'the run lengthened by the lights still matches its loop');
  assert.deepEqual(await same(by('Bayshore out and back')[0]), ['2026-09-23']);
  assert.deepEqual(await same(by('Morning Run')[1]), [], 'the 15 September loop went the other way round');
  assert.deepEqual(await same(hills), []);
  // all ten routes together are small, and none of it is in S
  const size = app.json('[...Routes.mem.values()].reduce((t,r)=>t+r.p.length,0)');
  assert.ok(size < 16000, `${size} characters for ten runs (2 MB of recordings)`);
  assert.ok(!/"p":|"lat"|29\.2\d\d|-79\.0\d/.test(app.run('JSON.stringify(S)')), 'no coordinate is in S');
});
