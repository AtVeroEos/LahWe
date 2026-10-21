'use strict';
// The live save (the workout in progress written on its own) and the daily copies on the phone.
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('../harness.js');

const NOW = '2026-10-20T18:00:00';
function withWorkout() {
  const app = loadApp({ now: NOW });
  app.set('__bk', { onboarded: true, name: 'K', workouts: [{ id: 'w0', name: 'Old', started: Date.parse('2026-10-18T18:00:00'), ended: Date.parse('2026-10-18T19:00:00'), exercises: [{ exId: 'bb-bench', sets: [{ w: '185', r: '5', done: true, tag: '', warmup: false }] }] }] });
  app.run('replaceState(__bk)'); // a full write, as after any normal change
  app.set('__aw', { id: 'live', name: 'Upper', started: Date.parse(NOW) - 600000, exercises: [{ exId: 'bb-bench', sets: [{ w: '195', r: '5', done: false, tag: '', warmup: false, _manual: false }, { w: '195', r: '5', done: false, tag: '', warmup: false, _manual: false }] }] });
  app.run('S.activeWorkout=__aw;saveNow()');
  return app;
}
const ls = (app, k) => app.ctx.localStorage.getItem(k);
const main = app => JSON.parse(ls(app, 'lahwe_v2'));
// What the next launch would load from what is stored now.
function relaunch(app) {
  const next = loadApp({ now: NOW });
  for (const [k, v] of app.ctx.localStorage._map) next.ctx.localStorage.setItem(k, v);
  next.run('Store.ready=false;S={}');
  return next.run('Store.load()').then(() => next);
}

test('ticking a set writes only the small entry, not the whole log', () => {
  const app = withWorkout();
  const before = ls(app, 'lahwe_v2');
  app.setNow(Date.parse(NOW) + 5000);
  app.run('togSet(0,0);Store.flush()');
  assert.equal(ls(app, 'lahwe_v2'), before, 'the full copy was not rewritten');
  const live = JSON.parse(ls(app, 'lahwe_v2_live'));
  assert.equal(live.activeWorkout.exercises[0].sets[0].done, true);
  assert.ok(live._savedAt > main(app)._savedAt, 'newer than the copy under it');
  assert.ok(live.restTimer && live.restTimer.total > 0, 'the rest timer rides along');
  assert.ok(!('workouts' in live), 'nothing else is in it');
});

test('a reload after only live saves gets every tick back', async () => {
  const app = withWorkout();
  app.setNow(Date.parse(NOW) + 5000);
  app.run(`togSet(0,0);upd(0,1,'r','7');setRir(0,0,2);Store.flush()`);
  const next = await relaunch(app);
  const s = next.json('S.activeWorkout.exercises[0].sets');
  assert.equal(s[0].done, true); assert.equal(s[1].r, '7'); assert.equal(s[0].rir, 2);
  assert.equal(next.json('S.workouts.length'), 1, 'history untouched');
  assert.equal(next.json('S.name'), 'K');
});

test('any other change writes everything and the small entry goes', async () => {
  const app = withWorkout();
  app.setNow(Date.parse(NOW) + 5000);
  app.run('togSet(0,0);Store.flush()');
  assert.ok(ls(app, 'lahwe_v2_live'));
  app.setNow(Date.parse(NOW) + 6000);
  app.run(`S.name='Kolbe';save();Store.flush()`);
  assert.equal(ls(app, 'lahwe_v2_live'), null);
  const m = main(app);
  assert.equal(m.name, 'Kolbe'); assert.equal(m.activeWorkout.exercises[0].sets[0].done, true, 'the full copy has the ticks');
  const next = await relaunch(app);
  assert.equal(next.json('S.activeWorkout.exercises[0].sets[0].done'), true);
});

test('a live save and a full save in the same millisecond keep their order', () => {
  const app = withWorkout();
  app.run(`togSet(0,0);Store.flush();S.name='Same ms';save();Store.flush()`); // the clock does not move between them
  assert.equal(ls(app, 'lahwe_v2_live'), null, 'the full write is newer and replaces it');
  assert.ok(main(app)._savedAt > app.run('Store.liveAt') - 1);
});

test('an older small entry never wins over a newer full copy', async () => {
  const app = withWorkout();
  const m = main(app);
  app.ctx.localStorage.setItem('lahwe_v2_live', JSON.stringify({ _savedAt: m._savedAt - 1000, activeWorkout: null, restTimer: null }));
  const next = await relaunch(app);
  assert.equal(next.json('S.activeWorkout.id'), 'live');
});

test('finishing a workout is a full write: it lands in history and the small entry goes', () => {
  const app = withWorkout();
  app.setNow(Date.parse(NOW) + 5000);
  app.run('togSet(0,0);togSet(0,1);Store.flush()');
  app.setNow(Date.parse(NOW) + 3600000);
  app.run('saveWorkout()');
  assert.equal(ls(app, 'lahwe_v2_live'), null);
  const m = main(app);
  assert.equal(m.activeWorkout, null); assert.equal(m.workouts.length, 2);
});

test('when app storage refuses the small entry, everything is written instead', () => {
  const app = withWorkout();
  const before = ls(app, 'lahwe_v2');
  const real = app.ctx.localStorage.setItem;
  app.ctx.localStorage.setItem = (k, v) => { if (k === 'lahwe_v2_live') throw new Error('QuotaExceeded'); real(k, v); };
  app.setNow(Date.parse(NOW) + 5000);
  app.run('togSet(0,0);Store.flush()');
  assert.notEqual(ls(app, 'lahwe_v2'), before);
  assert.equal(main(app).activeWorkout.exercises[0].sets[0].done, true);
});

test('backup nudge comes after a week', () => {
  const app = withWorkout();
  app.run(`S.workouts=Array.from({length:6},(_, i)=>Object.assign({},S.workouts[0],{id:'w'+i}))`);
  app.run(`S.lastExportAt=Date.now()-6*86400000`); assert.equal(app.run('backupDue()'), false);
  app.run(`S.lastExportAt=Date.now()-8*86400000`); assert.equal(app.run('backupDue()'), true);
});

// ─── Daily copies (with a small in-memory stand-in for the device database) ───
function fakeDb(app) {
  const m = new Map();
  app.ctx.IDBKeyRange = { bound: (lo, hi) => ({ lo, hi }) };
  const cursorOver = range => {
    const keys = [...m.keys()].filter(k => k >= range.lo && k <= range.hi).sort();
    const rq = {}; let i = 0;
    const step = () => setImmediate(() => { rq.result = i < keys.length ? { key: keys[i], value: m.get(keys[i]), continue() { i++; step(); } } : null; rq.onsuccess && rq.onsuccess(); });
    step(); return rq;
  };
  app.run('Store').db = {
    transaction() {
      const tx = {};
      tx.objectStore = () => ({
        get(k) { const rq = {}; setImmediate(() => { rq.result = m.has(k) ? m.get(k) : undefined; rq.onsuccess && rq.onsuccess(); }); return rq; },
        put(v, k) { m.set(k, v); setImmediate(() => tx.oncomplete && tx.oncomplete()); },
        delete(k) { m.delete(k); setImmediate(() => tx.oncomplete && tx.oncomplete()); },
        openCursor: cursorOver, openKeyCursor: cursorOver,
      });
      return tx;
    },
  };
  app.ctx.CompressionStream = global.CompressionStream; app.ctx.DecompressionStream = global.DecompressionStream;
  return m;
}

test('a daily copy is taken once a day, compressed, and gives back the exact log', async () => {
  const app = withWorkout(); const db = fakeDb(app);
  assert.equal(await app.run('dailyTake()'), true);
  assert.equal(await app.run('dailyTake()'), false, 'not twice on one day');
  const rec = db.get('daily:2026-10-20');
  assert.equal(rec.z, 1, 'compressed'); assert.ok(rec.b.byteLength < rec.len / 2);
  app.ctx.__rec = rec;
  const txt = await app.run('dailyText(__rec)');
  assert.equal(txt, app.run('JSON.stringify(S)'), 'identical to the log');
});

test('only the last seven are kept', async () => {
  const app = withWorkout(); const db = fakeDb(app);
  for (let d = 1; d <= 10; d++) { app.setNow(`2026-10-${String(d).padStart(2, '0')}T09:00:00`); await app.run('dailyTake()'); }
  const keys = [...db.keys()].filter(k => k.startsWith('daily:')).sort();
  assert.deepEqual(keys, ['04', '05', '06', '07', '08', '09', '10'].map(d => 'daily:2026-10-' + d));
});

test('without compression the copy is kept as plain text', async () => {
  const app = withWorkout(); const db = fakeDb(app);
  app.ctx.CompressionStream = undefined;
  assert.equal(await app.run('dailyTake()'), true);
  const rec = db.get('daily:2026-10-20');
  assert.equal(rec.z, 0); assert.equal(rec.t, app.run('JSON.stringify(S)'));
});

test('no copy of an empty app, a not-yet-onboarded one, or unreadable data', async () => {
  const app = loadApp({ now: NOW }); fakeDb(app);
  app.run('replaceState({onboarded:true})');
  assert.equal(await app.run('dailyTake()'), false, 'nothing logged');
  const app2 = withWorkout(); fakeDb(app2);
  app2.run(`Store.corrupt='x'`); assert.equal(await app2.run('dailyTake()'), false);
});

test('restoring a daily copy goes through the normal restore, with undo', async () => {
  const app = withWorkout(); const db = fakeDb(app);
  await app.run('dailyTake()');
  app.run(`S.workouts=[];S.name='After';saveNow()`);
  let confirmed = null;
  app.ctx.customConfirm = (msg, label, fn) => { confirmed = { msg, label }; fn(); };
  await app.run(`dailyRestore('daily:2026-10-20')`);
  assert.match(confirmed.msg, /Daily copy from Oct 20/);
  await new Promise(r => setTimeout(r, 50));
  assert.equal(app.run('S.workouts.length'), 1); assert.equal(app.run('S.name'), 'K');
  assert.ok(db.get('lahwe_v2_undo') || ls(app, 'lahwe_v2_undo'), 'what was replaced is kept for Undo');
});

test('erasing everything deletes the daily copies too', async () => {
  const app = withWorkout(); const db = fakeDb(app);
  await app.run('dailyTake()');
  assert.ok(db.has('daily:2026-10-20'));
  app.ctx.customConfirm = (msg, label, fn) => fn();
  app.run('resetFinal()');
  await new Promise(r => setTimeout(r, 50));
  assert.equal([...db.keys()].some(k => k.startsWith('daily:')), false);
});
