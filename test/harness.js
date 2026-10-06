// Loads the concatenated app script into a sandbox with just enough of a browser for the
// non-UI logic to run, so the maths can be unit-tested with plain `node --test`.
'use strict';
process.env.TZ = 'America/New_York'; // the date bugs this suite guards against only show up west of UTC
const vm = require('vm');
const { buildJs } = require('../build.js');

function stubEl() {
  const el = {
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [], value: '', textContent: '', innerHTML: '', id: '',
    appendChild(c) { return c; }, remove() {}, setAttribute() {}, getAttribute() { return null; }, addEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, focus() {}, click() {}, getContext() { return null; },
  };
  return el;
}
function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, _map: m };
}

// loadApp({ now: '2026-03-10T22:20:00' }) → { run(code), set(name, value), setNow(when), ctx }
function loadApp(opts) {
  opts = opts || {};
  // Timers are inert: nothing under test depends on them, and a live interval would keep node running.
  let tid = 0;
  const ctx = { console, setTimeout: () => ++tid, clearTimeout() {}, setInterval: () => ++tid, clearInterval() {}, Math, JSON, Promise, URL, Blob: global.Blob };
  ctx.__now = new Date(opts.now || '2026-06-15T12:00:00').getTime();
  const RealDate = Date;
  ctx.Date = class extends RealDate {
    constructor(...a) { if (a.length === 0) super(ctx.__now); else super(...a); }
    static now() { return ctx.__now; }
  };
  const pageEls = { content: stubEl(), nav: stubEl() };
  const doc = stubEl();
  Object.assign(doc, { documentElement: stubEl(), body: stubEl(), head: stubEl(), createElement: () => stubEl(), getElementById: id => (id === 'content' || id === 'nav' ? pageEls[id] : null), visibilityState: 'visible' });
  ctx.document = doc;
  ctx.localStorage = memoryStorage();
  ctx.navigator = { onLine: true };
  ctx.location = { protocol: 'file:', reload() {} };
  ctx.getComputedStyle = () => ({ getPropertyValue: () => '' });
  ctx.addEventListener = () => {};
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(buildJs(), ctx, { filename: 'app.js' });
  const app = {
    ctx,
    run: code => vm.runInContext(code, ctx),
    set: (name, value) => { ctx.__v = value; vm.runInContext(`${name}=__v`, ctx); },
    setNow: when => { ctx.__now = new RealDate(when).getTime(); },
    // Fresh, fully-normalised CURRENT-format state with the given fields overridden (no upgrade steps run).
    state: over => { ctx.__v = over || {}; return vm.runInContext('S=normalizeState(Object.assign({onboarded:true,_schema:3},__v));afterStateLoaded();S', ctx); },
    json: code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, ctx)),
  };
  app.state();
  return app;
}
module.exports = { loadApp };
