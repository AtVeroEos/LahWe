'use strict';
// The repository and the built app must never contain a credential.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { scan, scanText } = require('../../tools/check-secrets.js');
const { build } = require('../../build.js');

test('nothing key-shaped is in the repository or in the built app', () => {
  build();
  const r = scan();
  assert.ok(r.files > 40, 'scanned ' + r.files + ' files');
  assert.deepEqual(r.hits, []);
});
test('the scanner really does catch each kind of key (so a pass means something)', () => {
  const samples = { // assembled here so this file stays clean
    'Anthropic API key': 'sk-' + 'ant-api03-' + 'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cF0hL',
    'OpenRouter API key': 'sk-' + 'or-v1-' + '0a1b2c3d4e5f60718293a4b5c6d7e8f9',
    'OpenAI API key': 'sk-' + 'proj-' + 'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cF0hL',
    'OpenAI-style API key': 'sk-' + 'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cF0hLxY',
    'Google API key': 'AI' + 'zaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q',
    'GitHub token': 'gh' + 'p_' + 'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cF0hL1234',
  };
  for (const [name, key] of Object.entries(samples)) {
    const hits = scanText(`const k = "${key}";\n`, 'x.js');
    assert.ok(hits.some(h => h.name === name), name + ' was not detected');
    assert.ok(hits.every(h => !h.sample.includes(key.slice(12))), 'the report does not print the key');
  }
  assert.deepEqual(scanText('const k = "sk-' + 'ant-api03-' + 'x'.repeat(40) + '";', 'x.js'), [], 'obvious test filler is ignored');
  assert.deepEqual(scanText('placeholder="sk-ant-…" or sk-… or AIza…', 'x.js'), [], 'placeholders are not keys');
});
test('the built page carries no default key, no shared key and no third-party AI script', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'dist', 'index.html'), 'utf8');
  assert.ok(html.includes("const AI_KEYS_KEY='lahwe_ai_keys'"));
  // the only places the built app talks to are the four provider APIs, Open Food Facts, fonts and the barcode library
  const hosts = new Set([...html.matchAll(/https:\/\/([a-z0-9.\-]+\.[a-z]{2,})/g)].map(m => m[1]));
  const allowed = [/^api\.anthropic\.com$/, /^api\.openai\.com$/, /^generativelanguage\.googleapis\.com$/, /^openrouter\.ai$/, /^api\.example\.com$/,
    /openfoodfacts\.org$/, /^fonts\.(googleapis|gstatic)\.com$/, /^cdn\.jsdelivr\.net$/, /^(www\.)?chartjs\.org$/, /^github\.com$/, /^(www\.)?w3\.org$/, /^kurkle\.github\.io$/];
  const unknown = [...hosts].filter(h => !allowed.some(re => re.test(h)));
  assert.deepEqual(unknown, [], 'unexpected hosts in the built app: ' + unknown.join(', '));
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
});
