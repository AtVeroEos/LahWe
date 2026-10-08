'use strict';
// The routes drawing: which routes the filters pick, where each sits once moved to a shared
// start, how far each has been drawn at a moment of the animation, how bright it is, and what a tap means.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');
const T = require('../fixtures/tracks.js');

const NOW = '2026-10-08T09:00:00';
const day = n => { const d = new Date(NOW); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const aj = async (app, code) => JSON.parse(await app.run(`(async()=>JSON.stringify(await (${code})))()`));
// An app with the given efforts, each with a real route in the store. spec: {id, type, back, legs, speed, lat0?}
async function withRoutes(specs) {
  const app = loadApp({ now: NOW }); app.state({ bodyweight: 185 });
  for (const s of specs) {
    const pts = T.makeRun({ legs: s.legs, speed: s.speed || 3, lat0: s.lat0 || T.LAT0, lon0: s.lon0 || T.LON0 });
    app.set('window._b', Buffer.from(T.toTcx(pts)));
    app.set('window._a', { id: s.id, type: s.type || 'run', date: day(s.back || 1), dist: (pts[pts.length - 1].dist / 1609.344).toFixed(2), dur: String(Math.round(pts.length / 60)), notes: s.id });
    await app.run(`(async()=>{const x=routeFromTrack(trackParse('tcx',new Uint8Array(_b)),_a.type,0);_a.rt=x.sum;_a.sec=x.sec;S.activities.push(_a);await Routes.put(_a.id,x.rec);})()`);
  }
  app.run('save()');
  await app.run(`(async()=>{window._items=[];for(const a of S.activities){_items.push(rvItem(a,await routeLoad(a.id)));}rvShade(_items);})()`);
  return app;
}

test('filters: time, kind and distance pick the routes; the page opens on runs when there are any', async () => {
  const app = await withRoutes([
    { id: 'north', back: 5, legs: [[0, 3000]] }, { id: 'old', back: 200, legs: [[0, 8000]] }, { id: 'spring', back: 120, legs: [[2000, 0]] },
    { id: 'ruck', type: 'ruck', back: 10, legs: [[0, -6500]], speed: 1.7 }, { id: 'hike', type: 'hike', back: 40, legs: [[-4000, 0]], speed: 1.4 }, { id: 'ride', type: 'bike', back: 20, legs: [[30000, 0]], speed: 8 }]);
  app.run(`S.activities.push({id:'noroute',type:'run',date:'${day(2)}',dist:'3',dur:'25'});save()`);
  assert.deepEqual(app.json('rvKindsWithRoutes()'), { run: 3, ruck: 1, walk: 1, bike: 1 }, 'a hike is one of the walks');
  const d = app.json('rvDefaults()');
  assert.deepEqual(d.kinds, { run: true, ruck: false, walk: false, bike: false }, 'runs only, so one long ride does not shrink every run to a dot'); assert.equal(d.time, 'all');
  const ids = f => app.json(`rvActs(Object.assign(rvDefaults(),${JSON.stringify(f)})).map(a=>a.id)`);
  assert.deepEqual(ids({}), ['north', 'spring', 'old'], 'newest first; the run with no route is not there');
  assert.deepEqual(ids({ time: '30d' }), ['north']); assert.deepEqual(ids({ time: '3m' }), ['north']); assert.deepEqual(ids({ time: 'year' }), ['north', 'spring', 'old'].filter(id => id !== 'old' || day(200) >= '2026-01-01'));
  assert.deepEqual(ids({ time: 'custom', from: day(130), to: day(100) }), ['spring']); assert.deepEqual(ids({ time: 'custom', from: '', to: day(150) }), ['old'], 'an empty end of the range is open');
  assert.deepEqual(ids({ band: 's' }), ['north', 'spring']); assert.deepEqual(ids({ band: 'm' }), ['old']); assert.deepEqual(ids({ band: 'xl' }), []);
  const all = { run: true, ruck: true, walk: true, bike: true };
  assert.deepEqual(ids({ kinds: all }).sort(), ['hike', 'north', 'old', 'ride', 'ruck', 'spring']);
  assert.deepEqual(ids({ kinds: { run: false, ruck: true, walk: true, bike: false } }), ['ruck', 'hike']);
  assert.deepEqual(ids({ kinds: all, band: 'xl' }), ['ride']);
  // no runs with a route: the page opens on what there is
  const only = await withRoutes([{ id: 'r', type: 'ruck', legs: [[0, 4000]], speed: 1.7 }]);
  assert.deepEqual(only.json('rvDefaults().kinds'), { run: false, ruck: true, walk: false, bike: false });
});

test('every route starts at the centre and keeps its direction: north is up, east is right', async () => {
  const app = await withRoutes([{ id: 'north', legs: [[0, 3000]] }, { id: 'east', legs: [[2000, 0]], lat0: 40.5, lon0: -3.2 }, { id: 'sw', legs: [[-1000, -1000]], lat0: -33.9, lon0: 151.2 }]);
  const it = id => app.json(`(()=>{const i=_items.find(x=>x.id===${JSON.stringify(id)});return{x0:i.x[0],y0:i.y[0],x:i.x[i.n-1],y:i.y[i.n-1],r:i.r,m:i.m}})()`);
  const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
  for (const id of ['north', 'east', 'sw']) assert.deepEqual([it(id).x0, it(id).y0], [0, 0], id + ' starts at the centre, wherever on Earth it was');
  near(it('north').x, 0, 3); near(it('north').y, 3000, 6); near(it('north').r, 3000, 6);
  near(it('east').x, 2000, 5); near(it('east').y, 0, 3);
  near(it('sw').x, -1000, 4); near(it('sw').y, -1000, 4); near(it('sw').r, 1000, 4, 'the reach is the larger of east–west and north–south: the drawing is square');
});

test('drawing: same speed grows every route at one rate; real speed puts the faster one further out', async () => {
  const app = await withRoutes([{ id: 'quick', legs: [[0, 3000]], speed: 4 }, { id: 'slow', legs: [[3000, 0]], speed: 2.5 }, { id: 'long', legs: [[0, -6000]], speed: 3 }]);
  const reach = (id, mode, frac) => app.run(`(()=>{const it=_items.find(x=>x.id===${JSON.stringify(id)});it.at=0;return rvReach(it,${JSON.stringify(mode)},${frac},Math.max(..._items.map(i=>i.m)),Math.max(..._items.map(i=>i.sec)))})()`);
  const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''} ${a} vs ${b}`);
  // by distance: the longest route (6 km) sets the clock
  near(reach('quick', 'dist', 0.25), 1500, 1); near(reach('slow', 'dist', 0.25), 1500, 1); near(reach('long', 'dist', 0.25), 1500, 1);
  near(reach('quick', 'dist', 0.5), 3000, 1, 'the short ones are finished half way through'); near(reach('long', 'dist', 0.5), 3000, 1); near(reach('long', 'dist', 1), 6000, 1);
  // by time: the longest effort (the 6 km at 3 m/s, 2000 s) sets the clock
  near(reach('quick', 'time', 0.25), 2000, 12, '500 s at 4 m/s'); near(reach('slow', 'time', 0.25), 1250, 12, '500 s at 2.5 m/s'); near(reach('long', 'time', 0.25), 1500, 12);
  near(reach('quick', 'time', 0.5), 3000, 1, 'done at 750 s'); near(reach('slow', 'time', 0.5), 2500, 12); near(reach('slow', 'time', 0.7), 3000, 1); near(reach('long', 'time', 1), 6000, 1);
  assert.equal(reach('quick', 'time', -1), 0); near(reach('quick', 'dist', 9), 3000, 1);
  // a route with no time in its file is drawn by distance in either mode
  app.run(`_items[0].sec=0`); near(reach('quick', 'time', 0.25), 1500, 1);
  // the point a distance along a route
  const p = app.json(`(()=>{const it=_items.find(x=>x.id==='long');return rvPointAt(it,1500,0)})()`); near(p.x, 0, 3); near(p.y, -1500, 4);
});

test('faster is brighter, compared with routes of its own kind', async () => {
  const app = await withRoutes([{ id: 'a', legs: [[0, 2000]], speed: 2.5 }, { id: 'b', legs: [[0, 2000]], speed: 3 }, { id: 'c', legs: [[0, 2000]], speed: 3.5 }, { id: 'd', legs: [[0, 2000]], speed: 4.2 },
    { id: 'ride1', type: 'bike', legs: [[0, 9000]], speed: 7 }, { id: 'ride2', type: 'bike', legs: [[0, 9000]], speed: 9 }, { id: 'ruck', type: 'ruck', legs: [[0, 3000]], speed: 1.6 }]);
  const lv = app.json('Object.fromEntries(_items.map(i=>[i.id,i.level]))');
  assert.ok(lv.a < lv.b && lv.b < lv.c && lv.c < lv.d, JSON.stringify(lv)); assert.equal(lv.a, 0); assert.equal(lv.d, 5);
  assert.deepEqual([lv.ride1, lv.ride2], [0, 5], 'the slower ride is the dimmest ride, though it is faster than every run');
  assert.equal(lv.ruck, 4, 'the only one of its kind is bright, not dim');
  assert.ok(app.json('RV_LEVELS').every((v, i, a) => v > 0.2 && v <= 1 && (!i || v > a[i - 1])), 'six rising opacities, none too faint to see');
});

test('a tap: one route when it is clearly the nearest, a short list where several pass, nothing in open space', async () => {
  const app = await withRoutes([{ id: 'north', legs: [[0, 3000]] }, { id: 'east', legs: [[3000, 0]] }, { id: 'ne', legs: [[2100, 2100]] }, { id: 'north2', legs: [[0, 2500], [600, 0]] }]);
  const pick = (x, y, tol) => app.json(`(()=>{const p=rvPick(_items,${x},${y},${tol});return p.one?p.one.id:p.many?p.many.map(i=>i.id).sort():null})()`);
  assert.equal(pick(2500, 30, 120), 'east'); assert.equal(pick(1500, 1560, 120), 'ne');
  assert.deepEqual(pick(10, 15, 120), ['east', 'ne', 'north', 'north2'], 'at the centre everything passes');
  assert.deepEqual(pick(20, 1500, 120), ['north', 'north2'], 'two routes share the road north');
  assert.equal(pick(560, 2520, 120), 'north2', 'where they part, the tap is one of them');
  assert.equal(pick(-1500, -1500, 120), null);
  assert.equal(pick(2500, 200, 120), null, 'a tap 200 m off the line with a 120 m fingertip');
  assert.deepEqual(app.json(`rvNearest(_items,2500,0,2).map(n=>n.it.id)`), ['east', 'ne']);
});
