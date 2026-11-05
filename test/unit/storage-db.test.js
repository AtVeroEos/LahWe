'use strict';
// Where the log is kept: the device database holds it; app storage (localStorage) keeps a full copy
// only while the log is small, and a stub once it is big. The hand-over must never lose data.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const NOW = '2026-06-15T18:30:00';
const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async (app) => { for (let i = 0; i < 20; i++) await tick(); const w = app.ctx.Store && app.run('Store.writing'); if (w) await w; for (let i = 0; i < 20; i++) await tick(); };

// A small IndexedDB: one database, object stores of key → value, transactions that complete
// asynchronously. Switches: fail (every write fails), failOnce (the next write fails), dropReads
// (reads find nothing), corruptRead (reads return something else), down (open fails).
function fakeIDB() {
  const stores = new Map();
  const ctl = { fail: false, failOnce: false, dropReads: false, corruptRead: false, down: false, opens: 0, data: stores };
  const later = f => setTimeout(f, 0);
  function req() { return { onsuccess: null, onerror: null, result: undefined }; }
  function tx(names, mode) {
    const t = { oncomplete: null, onerror: null, onabort: null, _fail: false, _n: 0 };
    const done = () => later(() => { if (t._fail) { t.onerror && t.onerror(); } else t.oncomplete && t.oncomplete(); });
    t.objectStore = name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const st = stores.get(name);
      return {
        get(key) { const r = req(); later(() => { r.result = ctl.dropReads ? undefined : ctl.corruptRead ? 'not the same' : st.get(key); r.onsuccess && r.onsuccess(); }); done(); return r; },
        put(val, key) { if (ctl.fail || ctl.failOnce) { ctl.failOnce = false; t._fail = true; } else st.set(key, val); done(); },
        delete(key) { st.delete(key); done(); },
        openCursor(range) {
          const r = req(); const keys = [...st.keys()].filter(k => k >= range.lo && k <= range.hi).sort(); let i = 0;
          const step = () => later(() => { r.result = i < keys.length ? { key: keys[i], value: st.get(keys[i]), continue() { i++; step(); } } : null; r.onsuccess && r.onsuccess(); });
          step(); return r;
        },
      };
    };
    return t;
  }
  const db = { transaction: tx, createObjectStore: n => { stores.set(n, new Map()); }, close() {} };
  const idb = {
    open() {
      const r = Object.assign(req(), { onupgradeneeded: null, onblocked: null }); ctl.opens++;
      later(() => { if (ctl.down) { r.onerror && r.onerror(); return; } r.result = db; if (!stores.has('kv')) { r.onupgradeneeded && r.onupgradeneeded(); } r.onsuccess && r.onsuccess(); });
      return r;
    },
  };
  return { idb, ctl, get: k => (stores.get('kv') || new Map()).get(k), set: (k, v) => { if (!stores.has('kv')) stores.set('kv', new Map()); stores.get('kv').set(k, v); } };
}
// App storage with a size cap, counted in characters as an iPhone counts it (about 5 MB of UTF-16).
function cappedStorage(cap) {
  const m = new Map(); const used = () => [...m].reduce((t, [k, v]) => t + k.length + v.length, 0);
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem(k, v) { v = String(v); const before = m.has(k) ? k.length + m.get(k).length : 0; if (used() - before + k.length + v.length > cap) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } m.set(k, v); }, removeItem: k => { m.delete(k); }, _map: m, used };
}
function setup(opts) {
  opts = opts || {};
  const app = loadApp({ now: NOW });
  const f = fakeIDB();
  app.ctx.indexedDB = f.idb;
  app.ctx.IDBKeyRange = { bound: (lo, hi) => ({ lo, hi }) };
  app.ctx.localStorage = opts.ls || cappedStorage(2500000);
  app.run('window.__warn=[];showSaveWarning=f=>__warn.push(f);logError=()=>{};');
  return { app, f, ls: app.ctx.localStorage };
}
// A log of n workouts, each about 1.5 KB as JSON (like a real one).
function bigState(app, n) {
  app.run(`S=normalizeState({_schema:SCHEMA,onboarded:true,name:'Big',workouts:Array.from({length:${n}},(_, i)=>({id:'w'+i,name:'Push',started:Date.now()-i*864e5,ended:Date.now()-i*864e5+36e5,exercises:Array.from({length:6},(_, j)=>({exId:'bb-bench',sets:Array.from({length:4},()=>({w:'185',r:'8',done:true}))}))}))});afterStateLoaded();Store.ready=true;Store.db=null;`);
}
const lsStore = ls => ls.getItem('lahwe_v2');

test('a small log: a full copy in app storage and in the database, as before', async () => {
  const { app, f, ls } = setup();
  await app.run('Store.load()');
  app.run(`S.onboarded=true;S.name='Small';`);
  app.run('Store.flush(true)'); await settle(app);
  const a = JSON.parse(lsStore(ls)); const b = JSON.parse(f.get('lahwe_v2'));
  assert.equal(a.name, 'Small'); assert.equal(b.name, 'Small'); assert.equal(a._savedAt, b._savedAt);
  assert.ok(!a._lahwe, 'not a stub');
});

test('a big log: the database holds it; app storage keeps only a stub, so keys and chats still save', async () => {
  const { app, f, ls } = setup();
  await app.run('Store.load()');
  bigState(app, 900); await app.run('(async()=>{Store.db=await Store.openDb();})()'); await settle(app);
  const len = app.run('JSON.stringify(S).length');
  assert.ok(len > app.run('LS_FULL_MAX'), `the test log is big (${len} characters)`);
  app.run('Store.flush(true)'); await settle(app);
  const stub = JSON.parse(lsStore(ls));
  assert.equal(stub._lahwe, 'in-db');
  assert.equal(stub._chars, f.get('lahwe_v2').length, 'the stub says how big the log is');
  const full = JSON.parse(f.get('lahwe_v2'));
  assert.equal(full.workouts.length, 900);
  assert.equal(stub._savedAt, full._savedAt);
  assert.ok(ls.used() < 2000, 'app storage holds a few hundred characters, not the log');
  assert.deepEqual(app.json('__warn'), [], 'no save warning');
  // …and it opens again from the database
  const again = setup(); again.f.set('lahwe_v2', f.get('lahwe_v2')); again.ls.setItem('lahwe_v2', lsStore(ls));
  const r = await again.app.run('Store.load()');
  assert.equal(r.corrupt, false);
  assert.equal(again.app.run('S.workouts.length'), 900);
  assert.equal(again.app.run('Store.ready'), true);
});

test('moving an existing big log: the full copy in app storage stays until the database reads it back exactly', async () => {
  // An install from before this change: the whole big log is in app storage (and an older copy in the database).
  const old = setup();
  bigState(old.app, 900); old.app.run('S._savedAt=Date.now();');
  const fullTxt = old.app.run('JSON.stringify(S)');
  const { app, f, ls } = setup();
  ls.setItem('lahwe_v2', fullTxt);
  f.set('lahwe_v2', JSON.stringify({ _schema: 1, _savedAt: 1, onboarded: true, name: 'Older' }));
  await app.run('Store.load()');
  assert.equal(app.run('S.workouts.length'), 900, 'the newer copy (app storage) is the one loaded');

  // The read-back does not match: the full copy is kept, nothing is lost.
  f.ctl.corruptRead = true;
  app.run('Store.flush(true)'); await settle(app);
  assert.equal(JSON.parse(lsStore(ls)).workouts.length, 900, 'read-back differs: the full copy is still in app storage');
  // Next save, the database reads back right: now the stub replaces it.
  f.ctl.corruptRead = false;
  app.run('S.name="Moved";'); app.run('Store.flush(true)'); await settle(app);
  assert.equal(JSON.parse(lsStore(ls))._lahwe, 'in-db');
  assert.equal(JSON.parse(f.get('lahwe_v2')).name, 'Moved');
});

test('a failed database write: no stub, the warning shows, and the database is reopened once', async () => {
  const { app, f, ls } = setup();
  await app.run('Store.load()');
  bigState(app, 900); await app.run('(async()=>{Store.db=await Store.openDb();})()'); await settle(app);
  const opens = f.ctl.opens;
  // one failure: reopened and written
  f.ctl.failOnce = true;
  app.run('Store.flush(true)'); await settle(app);
  assert.equal(f.ctl.opens, opens + 1, 'reopened after the failed write');
  assert.equal(JSON.parse(f.get('lahwe_v2')).workouts.length, 900);
  assert.equal(JSON.parse(lsStore(ls))._lahwe, 'in-db');
  // every write failing: the stub still points at the last good database copy, and the user is told
  const before = f.get('lahwe_v2');
  f.ctl.fail = true; app.run('S.name="Lost?";'); app.run('Store.flush(true)'); await settle(app);
  assert.equal(f.get('lahwe_v2'), before, 'the last good copy is untouched');
  assert.deepEqual(app.json('__warn'), [true], 'the save warning is shown');
  assert.equal(app.run('Store.dirty'), false);
  f.ctl.fail = false; app.run('Store.flush(true)'); await settle(app);
  assert.equal(JSON.parse(f.get('lahwe_v2')).name, 'Lost?', 'the next save writes it');
  assert.deepEqual(app.json('__warn'), [true, false], 'and the warning goes');
});

test('a stub and no database: the app stops instead of starting empty, and never saves over it', async () => {
  const { app, f, ls } = setup();
  ls.setItem('lahwe_v2', JSON.stringify({ _lahwe: 'in-db', _savedAt: 5, _chars: 900000, _schema: 3 }));
  f.ctl.down = true;
  const r = await app.run('Store.load()');
  assert.equal(r.corrupt, true); assert.equal(r.unreachable, true);
  assert.equal(app.run('Store.ready'), false);
  assert.equal(app.run('Store.unreachable'), true);
  app.run('S.onboarded=true;S.name="Fresh";');
  assert.equal(app.run('Store.flush(true)'), false, 'refuses to save');
  assert.equal(JSON.parse(lsStore(ls))._lahwe, 'in-db', 'the stub is untouched');
  // the database opens but the log is not in it: the same
  const b = setup(); b.ls.setItem('lahwe_v2', lsStore(ls));
  const r2 = await b.app.run('Store.load()');
  assert.equal(r2.unreachable, true);
});

test('the workout in progress still lays over a big log', async () => {
  const { app, f, ls } = setup();
  await app.run('Store.load()');
  bigState(app, 900); await app.run('(async()=>{Store.db=await Store.openDb();})()'); await settle(app);
  app.run('Store.flush(true)'); await settle(app);
  const at = JSON.parse(f.get('lahwe_v2'))._savedAt;
  ls.setItem('lahwe_v2_live', JSON.stringify({ _savedAt: at + 10, activeWorkout: { id: 'live', name: 'Legs', started: Date.now(), exercises: [] }, restTimer: null }));
  const again = setup(); again.f.set('lahwe_v2', f.get('lahwe_v2')); again.ls.setItem('lahwe_v2', lsStore(ls)); again.ls.setItem('lahwe_v2_live', ls.getItem('lahwe_v2_live'));
  await again.app.run('Store.load()');
  assert.equal(again.app.run('S.activeWorkout && S.activeWorkout.name'), 'Legs');
  assert.equal(again.app.run('S.workouts.length'), 900);
});

test('a log that shrinks back under the limit gets its full copy in app storage again', async () => {
  const { app, f, ls } = setup();
  await app.run('Store.load()');
  bigState(app, 900); await app.run('(async()=>{Store.db=await Store.openDb();})()'); await settle(app);
  app.run('Store.flush(true)'); await settle(app);
  assert.equal(JSON.parse(lsStore(ls))._lahwe, 'in-db');
  app.run('S.workouts=S.workouts.slice(0,10);'); app.run('Store.flush(true)'); await settle(app);
  const a = JSON.parse(lsStore(ls));
  assert.ok(!a._lahwe && a.workouts.length === 10);
  assert.equal(JSON.parse(f.get('lahwe_v2')).workouts.length, 10);
});

test('far past the old limit: years of a heavy log (over 5 MB) saves and opens again', async () => {
  const { app, f, ls } = setup();
  await app.run('Store.load()');
  bigState(app, 4 * 208); // four lifts a week for four years
  app.run(`S.meals=Array.from({length:4*365*8},(_, i)=>({id:'m'+i,date:daysAgoStr(i%2920),type:'Lunch',items:[{foodId:null,name:'Chicken rice bowl',qty:1,serving:'1 bowl',protein:45,carbs:60,fat:12,cals:540}]}));`);
  await app.run('(async()=>{Store.db=await Store.openDb();})()'); await settle(app);
  const len = app.run('JSON.stringify(S).length');
  assert.ok(len * 2 > 5 * 1024 * 1024, `bigger than app storage could ever hold (${(len / 1048576).toFixed(1)} M characters)`);
  app.run('Store.flush(true)'); await settle(app);
  assert.deepEqual(app.json('__warn'), [], 'no save warning');
  const again = setup(); again.f.set('lahwe_v2', f.get('lahwe_v2')); again.ls.setItem('lahwe_v2', lsStore(ls));
  await again.app.run('Store.load()');
  assert.equal(again.app.run('S.meals.length'), 4 * 365 * 8);
  // and the AI key still saves next to it
  assert.doesNotThrow(() => ls.setItem('lahwe_ai_keys', JSON.stringify({ anthropic: 'x'.repeat(100) })));
});
