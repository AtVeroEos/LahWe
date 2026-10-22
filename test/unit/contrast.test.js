// Colour contrast: every accent and status colour is measured against the surfaces it sits on,
// in both themes, so a palette tweak that makes text unreadable fails here instead of on a phone.
// WCAG AA: 4.5:1 for text. Status colours are fixed (they never follow the accent) and must stay
// visibly apart from every accent, so a record, a done set or a delete never looks like a button.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('../harness.js');

const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles.css'), 'utf8');
function block(sel) {
  const i = css.indexOf(sel + '{');
  assert.ok(i >= 0, `${sel} block not found`);
  const body = css.slice(i, css.indexOf('}', i));
  const vars = {};
  for (const m of body.matchAll(/--([\w-]+):(#[0-9a-f]{6})/gi)) vars[m[1]] = m[2].toLowerCase();
  return vars;
}
const LIGHT = block(':root');
const DARK = { ...LIGHT, ...block('[data-dark="true"]') };

function lum(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function hue(h) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255);
  const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  if (!d) return 0;
  let H = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  H *= 60; return H < 0 ? H + 360 : H;
}
const hueGap = (a, b) => { const d = Math.abs(hue(a) - hue(b)) % 360; return Math.min(d, 360 - d); };
const AA = 4.5;
const WHITE = '#ffffff';

test('status ink reads as text on the page and the card in both themes', () => {
  for (const [mode, v] of [['light', LIGHT], ['dark', DARK]]) {
    for (const ink of ['green', 'gold', 'red', 'muted']) {
      for (const s of ['bg', 'card']) {
        const r = ratio(v[ink], v[s]);
        assert.ok(r >= AA, `${mode} --${ink} on --${s} is ${r.toFixed(2)}:1`);
      }
    }
  }
});

test('white text on a status fill reads in both themes', () => {
  for (const [mode, v] of [['light', LIGHT], ['dark', DARK]]) {
    for (const f of ['green-fill', 'red-fill', 'navy-fill']) {
      const r = ratio(v[f], WHITE);
      assert.ok(r >= AA, `${mode} white on --${f} is ${r.toFixed(2)}:1`);
    }
  }
});

test('every accent reads as text on its surfaces, and white reads on its fill, in both themes', () => {
  const app = loadApp();
  for (const t of app.json('THEMES')) {
    for (const s of ['bg', 'card']) {
      assert.ok(ratio(t.light, LIGHT[s]) >= AA, `${t.label} light on --${s} is ${ratio(t.light, LIGHT[s]).toFixed(2)}:1`);
      assert.ok(ratio(t.dark, DARK[s]) >= AA, `${t.label} dark on --${s} is ${ratio(t.dark, DARK[s]).toFixed(2)}:1`);
    }
    // --navy-fill is the light value in both modes.
    assert.ok(ratio(t.light, WHITE) >= AA, `white on ${t.label} fill is ${ratio(t.light, WHITE).toFixed(2)}:1`);
  }
});

test('status colours stay apart from every accent', () => {
  const app = loadApp();
  for (const t of app.json('THEMES')) {
    for (const [mode, v, a] of [['light', LIGHT, t.light], ['dark', DARK, t.dark]]) {
      for (const ink of ['green', 'gold', 'red']) {
        const g = hueGap(v[ink], a);
        assert.ok(g >= 12, `${mode} --${ink} is only ${g.toFixed(0)}° from the ${t.label} accent`);
      }
    }
  }
});
