'use strict';
// AI providers: where keys live, where they are allowed to go, and the four wire formats.
// Every key in this file is assembled at run time from harmless pieces, so the repository never
// contains anything that looks like a real credential (tools/check-secrets.js enforces that).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('../harness.js');

const fake = { // never real: a recognisable prefix plus filler
  anthropic: 'sk-' + 'ant-' + 'api03-' + 'A'.repeat(40),
  openai: 'sk-' + 'proj-' + 'B'.repeat(40),
  gemini: 'AI' + 'za' + 'C'.repeat(35),
  openrouter: 'sk-' + 'or-' + 'v1-' + 'd'.repeat(40),
  custom: 'local-' + 'E'.repeat(20),
};
const PROVIDERS = ['anthropic', 'openai', 'gemini', 'openrouter', 'custom'];
function withKeys(app) {
  for (const p of PROVIDERS) { app.set('__k', fake[p]); assert.equal(app.run(`setAiKey('${p}',__k)`), '', p + ' key accepted'); }
  assert.equal(app.run(`setCustomUrl('https://llm.example.test/v1/')`), '');
  return app;
}
const everyKey = text => PROVIDERS.filter(p => String(text).includes(fake[p]));

// ─── Keys stay on the device ───
test('keys are stored outside the app state and never reach a backup, an undo snapshot or the chat', () => {
  const app = withKeys(loadApp());
  app.run(`S.ai.provider='openai';save();Store.flush(true)`);
  assert.deepEqual(everyKey(app.run('JSON.stringify(S)')), [], 'not in S');
  assert.deepEqual(everyKey(app.run('backupJSON()')), [], 'not in a backup');
  assert.deepEqual(everyKey(app.ctx.localStorage.getItem('lahwe_v2')), [], 'not in the saved state');
  const store = app.ctx.localStorage._map;
  const holders = [...store.keys()].filter(k => everyKey(store.get(k)).length);
  assert.deepEqual(holders, ['lahwe_ai_keys'], 'exactly one storage entry holds keys');
  assert.equal(app.run(`getAiKey('gemini')`), fake.gemini);
  assert.equal(app.run(`maskKey(getAiKey('gemini'))`), '····' + fake.gemini.slice(-4));
});
test('a restored backup cannot carry a key in, and restoring does not touch the keys already here', () => {
  const app = withKeys(loadApp());
  app.set('__bk', { onboarded: true, name: 'R', ai: { provider: 'gemini', models: { gemini: 'gemini-3.8-flash', bogus: 'x' }, apiKey: fake.openai, keys: { openai: fake.openai }, logAccess: false }, aiKey: fake.openai });
  app.run('replaceState(__bk)');
  assert.deepEqual(app.json('S.ai'), { provider: 'gemini', models: { gemini: 'gemini-3.8-flash' }, logAccess: false, instant: true });
  assert.deepEqual(everyKey(app.run('JSON.stringify(S.ai)')), []);
  assert.equal(app.run(`getAiKey('anthropic')`), fake.anthropic, 'the device keeps its own keys');
});
test('the key saved by the first AI builder moves to the new place once and the old entry is removed', () => {
  const app = loadApp();
  app.ctx.localStorage.setItem('lahwe_api_key', fake.anthropic);
  app.state({ aiModel: 'claude-haiku-4-5-20251001' });
  assert.equal(app.run(`getAiKey('anthropic')`), fake.anthropic);
  assert.equal(app.ctx.localStorage.getItem('lahwe_api_key'), null);
  assert.equal(app.run(`aiModelFor('anthropic')`), 'claude-haiku-4-5-20251001', 'model choice carried over');
  assert.equal(app.run('S.aiModel'), undefined);
});
test('reset removes every key and the chat', () => {
  const app = withKeys(loadApp());
  app.ctx.localStorage.setItem('lahwe_coach_v1', '{"v":1,"turns":[]}');
  app.run('clearAllAiKeys();coachClear()');
  for (const p of PROVIDERS) assert.equal(app.run(`getAiKey('${p}')`), '');
  assert.equal(app.ctx.localStorage.getItem('lahwe_ai_keys'), null);
  assert.equal(app.ctx.localStorage.getItem('lahwe_coach_v1'), null);
});
test('a key pasted under the wrong company is refused, so it cannot be sent to the wrong company', () => {
  const app = loadApp();
  const why = (p, k) => { app.set('__k', k); return app.run(`aiKeyProblem('${p}',__k)`); };
  assert.match(why('openai', fake.anthropic), /looks like a Claude/);
  assert.match(why('anthropic', fake.openai), /looks like a ChatGPT/);
  assert.match(why('gemini', fake.openrouter), /looks like a OpenRouter|looks like an OpenRouter|OpenRouter/);
  assert.match(why('openrouter', fake.gemini), /Gemini/);
  assert.match(why('anthropic', 'no-prefix-' + 'x'.repeat(30)), /starts with sk-ant-/);
  assert.match(why('openai', '  '), /Paste your API key/);
  assert.match(why('openai', 'sk-' + 'x'.repeat(10) + ' ' + 'y'.repeat(20)), /space or line break/);
  assert.match(why('openai', 'sk-short'), /too short/);
  assert.match(why('openai', 'sk-' + 'x'.repeat(20) + 'é'), /never contains/);
  assert.equal(why('gemini', 'newformat' + 'Q'.repeat(30)), '', 'an unrecognised format is allowed where formats vary');
  assert.equal(why('custom', fake.openai), '', 'a custom server may take any key');
  app.set('__k', fake.anthropic);
  assert.notEqual(app.run(`setAiKey('openai',__k)`), ''); assert.equal(app.run(`getAiKey('openai')`), '', 'nothing stored after a refusal');
});
test('custom server address: https only (http for localhost), no credentials, no query', () => {
  const app = loadApp();
  const why = u => app.run(`aiUrlProblem(${JSON.stringify(u)})`);
  assert.equal(why('https://api.example.test/v1'), '');
  assert.equal(why('http://localhost:11434/v1'), '');
  assert.equal(why('http://127.0.0.1:1234/v1'), '');
  assert.match(why('http://192.168.1.20:8080/v1'), /https/);
  assert.match(why('http://example.test/v1'), /https/);
  assert.match(why('https://user:pw@example.test/v1'), /user name and password/);
  assert.match(why('https://example.test/v1?key=abc'), /after \?/);
  assert.match(why('not a url'), /not a web address/);
  assert.match(why('javascript:alert(1)'), /https/);
  assert.equal(app.run(`setCustomUrl('https://api.example.test/v1/chat/completions/')`), '');
  assert.equal(app.run('getCustomUrl()'), 'https://api.example.test/v1');
  assert.ok(!app.run('JSON.stringify(S)').includes('example.test'), 'the address is device-only too');
});
test('error text shown to the user never contains a key, even when the provider echoes it', () => {
  const app = withKeys(loadApp());
  app.set('__m', `Incorrect API key provided: ${fake.openai}. Also ${fake.gemini} and sk-` + 'zz' + 'Z'.repeat(30));
  const out = app.run(`aiErrorText('openai',400,__m)+' | '+scrubKeys(__m)`);
  assert.deepEqual(everyKey(out), []);
  assert.ok(!/Z{20}/.test(out), 'unknown key-shaped strings are cut down as well');
  assert.match(out, /key hidden/);
});

// ─── Where a key is allowed to travel ───
const convo = [
  { role: 'user', text: 'How was my week?', attachments: [{ kind: 'image', media: 'image/jpeg', data: 'QUJD', name: 'a.jpg' }, { kind: 'pdf', data: 'REVG', name: 'plan.pdf' }] },
  { role: 'assistant', text: 'Let me look.', calls: [{ id: 'call_1', name: 'get_workouts', args: { days: 7 } }] },
  { role: 'tool', results: [{ id: 'call_1', name: 'get_workouts', out: { workouts: [] } }] },
  { role: 'assistant', text: 'Nothing logged.', calls: [] },
  { role: 'user', text: 'ok' },
];
const tools = [{ name: 'get_workouts', description: 'd', parameters: { type: 'object', properties: { days: { type: 'integer', description: 'x' } } } }, { name: 'get_meal_plan', description: 'd2', parameters: { type: 'object', properties: {} } }];
const replies = {
  anthropic: { content: [{ type: 'text', text: 'hi' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 2 } },
  openai: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'hi' }] }], usage: { input_tokens: 10, output_tokens: 2 } },
  gemini: { candidates: [{ content: { parts: [{ text: 'hi' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 } },
  openrouter: { choices: [{ message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 2 } },
  custom: { choices: [{ message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }] },
};
const hosts = { anthropic: 'api.anthropic.com', openai: 'api.openai.com', gemini: 'generativelanguage.googleapis.com', openrouter: 'openrouter.ai', custom: 'llm.example.test' };

test('each provider: the key goes in a header to that provider only — never in the URL or the body', async () => {
  for (const p of PROVIDERS) {
    const app = withKeys(loadApp());
    const reqs = app.mockFetch(() => ({ body: replies[p] }));
    app.set('__c', p === 'custom' ? [Object.assign({}, convo[0], { attachments: [convo[0].attachments[0]] })].concat(convo.slice(1)) : convo); app.set('__t', tools);
    app.run(`S.ai.provider='${p}';${p === 'custom' ? "S.ai.models.custom='local-model';" : ''}`);
    const out = await app.run(`aiChat({system:'SYS',turns:__c,tools:__t})`);
    assert.equal(out.text, 'hi', p);
    assert.equal(reqs.length, 1);
    const r = reqs[0];
    assert.equal(new URL(r.url).host, hosts[p], p + ' host');
    assert.equal(new URL(r.url).protocol, 'https:');
    assert.deepEqual(everyKey(r.url), [], p + ': no key in the URL');
    assert.deepEqual(everyKey(r.rawBody), [], p + ': no key in the body');
    const headerText = JSON.stringify(r.headers);
    assert.deepEqual(everyKey(headerText), [p], p + ': exactly its own key in the headers, nobody else\'s');
    assert.ok(!('http-referer' in r.headers) && !('x-title' in r.headers), 'no page address is volunteered');
  }
});
test('a built-in provider whose address has been tampered with is refused before anything is sent', async () => {
  const app = withKeys(loadApp());
  const reqs = app.mockFetch(() => ({ body: replies.openai }));
  app.run(`S.ai.provider='openai';AI_PROVIDERS.openai.base='https://evil.example.test/v1'`);
  await assert.rejects(app.run(`aiChat({system:'s',turns:[{role:'user',text:'hi'}],tools:[]})`), /unexpected address/);
  assert.equal(reqs.length, 0);
});
test('no key, no request', async () => {
  const app = loadApp();
  const reqs = app.mockFetch(() => ({ body: replies.anthropic }));
  for (const p of ['anthropic', 'openai', 'gemini', 'openrouter']) {
    app.run(`S.ai.provider='${p}'`);
    assert.equal(app.run('aiReady()'), false);
    await assert.rejects(app.run(`aiChat({system:'s',turns:[{role:'user',text:'hi'}],tools:[]})`), /Add your .* API key/);
  }
  app.run(`S.ai.provider='custom'`);
  await assert.rejects(app.run(`aiChat({system:'s',turns:[{role:'user',text:'hi'}],tools:[]})`), /Choose a model|server address/);
  assert.equal(reqs.length, 0, 'nothing left the device');
});

// ─── Wire formats ───
function build(app, p, turns, t) { app.set('__c', turns || convo); app.set('__t', t === undefined ? tools : t); return app.json(`aiBuildRequest('${p}','m-1',{system:'SYS',turns:__c,tools:__t})`); }

test('Claude request: system block, merged tool results, images and PDFs, tools as input_schema', () => {
  const { path, body } = build(loadApp(), 'anthropic');
  assert.equal(path, '/messages');
  assert.equal(body.model, 'm-1'); assert.ok(body.max_tokens > 0);
  assert.equal(body.system[0].text, 'SYS'); assert.deepEqual(body.system[0].cache_control, { type: 'ephemeral' });
  assert.deepEqual(body.messages.map(m => m.role), ['user', 'assistant', 'user', 'assistant', 'user']);
  assert.deepEqual(body.messages[0].content.map(b => b.type), ['image', 'document', 'text']);
  assert.deepEqual(body.messages[1].content, [{ type: 'text', text: 'Let me look.' }, { type: 'tool_use', id: 'call_1', name: 'get_workouts', input: { days: 7 } }]);
  assert.deepEqual(body.messages[2].content, [{ type: 'tool_result', tool_use_id: 'call_1', content: '{"workouts":[]}' }]);
  assert.deepEqual(Object.keys(body.tools[0]), ['name', 'description', 'input_schema']);
  // a tool result followed directly by a new user message becomes ONE user message, results first
  const merged = build(loadApp(), 'anthropic', [convo[0], convo[1], convo[2], { role: 'user', text: 'never mind' }]).body.messages;
  assert.deepEqual(merged.map(m => m.role), ['user', 'assistant', 'user']);
  assert.deepEqual(merged[2].content.map(b => b.type), ['tool_result', 'text']);
});
test('ChatGPT request: Responses API items, stored nothing, tools flat', () => {
  const { path, body } = build(loadApp(), 'openai');
  assert.equal(path, '/responses');
  assert.equal(body.instructions, 'SYS'); assert.equal(body.store, false);
  assert.deepEqual(body.input.map(i => i.type || i.role), ['user', 'assistant', 'function_call', 'function_call_output', 'assistant', 'user']);
  assert.deepEqual(body.input[0].content.map(c => c.type), ['input_text', 'input_image', 'input_file']);
  assert.match(body.input[0].content[1].image_url, /^data:image\/jpeg;base64,QUJD$/);
  assert.match(body.input[0].content[2].file_data, /^data:application\/pdf;base64,REVG$/);
  assert.deepEqual(body.input[2], { type: 'function_call', call_id: 'call_1', name: 'get_workouts', arguments: '{"days":7}' });
  assert.deepEqual(body.input[3], { type: 'function_call_output', call_id: 'call_1', output: '{"workouts":[]}' });
  assert.deepEqual(body.tools[0], { type: 'function', name: 'get_workouts', description: 'd', parameters: tools[0].parameters, strict: false });
});
test('OpenRouter / custom request: chat completions with tool_calls and tool messages', () => {
  const { path, body } = build(loadApp(), 'openrouter');
  assert.equal(path, '/chat/completions');
  assert.deepEqual(body.messages.map(m => m.role), ['system', 'user', 'assistant', 'tool', 'assistant', 'user']);
  assert.deepEqual(body.messages[1].content.map(c => c.type), ['text', 'image_url', 'file']);
  assert.deepEqual(body.messages[2].tool_calls, [{ id: 'call_1', type: 'function', function: { name: 'get_workouts', arguments: '{"days":7}' } }]);
  assert.deepEqual(body.messages[3], { role: 'tool', tool_call_id: 'call_1', content: '{"workouts":[]}' });
  assert.equal(body.messages[5].content, 'ok', 'plain text stays a plain string');
  assert.deepEqual(body.tools[1], { type: 'function', function: tools[1] });
});
test('Gemini request: contents and parts, function responses as objects, no empty schemas', () => {
  const { path, body } = build(loadApp(), 'gemini');
  assert.equal(path, '/models/m-1:generateContent');
  assert.equal(body.systemInstruction.parts[0].text, 'SYS');
  assert.deepEqual(body.contents.map(c => c.role), ['user', 'model', 'user', 'model', 'user']);
  assert.deepEqual(body.contents[0].parts[0], { inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } });
  assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'application/pdf');
  const fc = body.contents[1].parts[1];
  assert.deepEqual(fc.functionCall, { name: 'get_workouts', args: { days: 7 }, id: 'call_1' });
  assert.equal(fc.thoughtSignature, 'skip_thought_signature_validator', 'a call Gemini did not make itself carries the documented bypass');
  assert.deepEqual(body.contents[2].parts[0].functionResponse, { name: 'get_workouts', response: { workouts: [] }, id: 'call_1' });
  const decl = body.tools[0].functionDeclarations;
  assert.ok(decl[0].parameters); assert.ok(!('parameters' in decl[1]), 'a no-argument tool sends no schema');
  // ids the app invented are not sent to Gemini
  const local = build(loadApp(), 'gemini', [{ role: 'user', text: 'x' }, { role: 'assistant', text: '', calls: [{ id: 'local-abc', name: 'get_meal_plan', args: {} }] }, { role: 'tool', results: [{ id: 'local-abc', name: 'get_meal_plan', out: 'plain text' }] }]).body.contents;
  assert.ok(!('id' in local[1].parts[0].functionCall)); assert.deepEqual(local[2].parts[0].functionResponse, { name: 'get_meal_plan', response: { result: 'plain text' } });
});
test('the provider\'s own form of a reply is replayed only to that provider, and only while it is kept', () => {
  const app = loadApp();
  const thinking = [{ type: 'thinking', thinking: '…', signature: 'SIGNATURE-XYZ' }, { type: 'tool_use', id: 'tu_1', name: 'get_meal_plan', input: {} }];
  const turns = [{ role: 'user', text: 'x' }, { role: 'assistant', text: '', calls: [{ id: 'tu_1', name: 'get_meal_plan', args: {} }], raw: { wire: 'anthropic', data: thinking } }, { role: 'tool', results: [{ id: 'tu_1', name: 'get_meal_plan', out: {} }] }];
  assert.deepEqual(build(app, 'anthropic', turns).body.messages[1].content, thinking, 'thinking blocks go back untouched');
  assert.deepEqual(build(app, 'openrouter', turns).body.messages[2].tool_calls[0].id, 'tu_1', 'another provider gets the neutral form');
  assert.ok(!JSON.stringify(build(app, 'gemini', turns).body).includes('SIGNATURE-XYZ'));
  // Responses: reasoning items without their encrypted content cannot be replayed and are dropped
  const items = [{ type: 'reasoning', id: 'rs_1' }, { type: 'reasoning', id: 'rs_2', encrypted_content: 'enc' }, { type: 'function_call', call_id: 'c1', name: 'get_meal_plan', arguments: '{}' }];
  const input = build(app, 'openai', [{ role: 'user', text: 'x' }, { role: 'assistant', text: '', calls: [{ id: 'c1', name: 'get_meal_plan', args: {} }], raw: { wire: 'responses', data: items } }]).body.input;
  assert.deepEqual(input.slice(1).map(i => i.id || i.call_id), ['rs_2', 'c1']);
  // Chat: the server's message (with reasoning details) goes back as it came
  const msg = { role: 'assistant', content: null, tool_calls: [{ id: 'c9', type: 'function', function: { name: 'get_meal_plan', arguments: '{}' } }], reasoning_details: [{ type: 'x' }] };
  assert.deepEqual(build(app, 'openrouter', [{ role: 'user', text: 'x' }, { role: 'assistant', text: '', calls: [{ id: 'c9', name: 'get_meal_plan', args: {} }], raw: { wire: 'chat', data: msg } }]).body.messages[2], msg);
});
test('empty assistant turns are left out and an empty user message still says something', () => {
  const b = build(loadApp(), 'anthropic', [{ role: 'user', text: '', attachments: [] }, { role: 'assistant', text: '  ', calls: [] }, { role: 'user', text: 'again' }], []).body;
  assert.equal(b.messages.length, 1, 'two user turns merged, blank assistant dropped');
  assert.deepEqual(b.messages[0].content.map(c => c.text), ['(no text)', 'again']);
  assert.ok(!('tools' in b), 'no tools key when there are no tools');
});

const parse = (app, wire, d) => { app.set('__d', d); return app.json(`aiParseResponse('${wire}',__d)`); };
test('replies are read the same way from all four formats', () => {
  const app = loadApp();
  const a = parse(app, 'anthropic', { content: [{ type: 'thinking', thinking: 't' }, { type: 'text', text: 'Reading.' }, { type: 'tool_use', id: 'tu_1', name: 'get_workouts', input: { days: 7 } }], stop_reason: 'tool_use', usage: { input_tokens: 100, cache_read_input_tokens: 900, output_tokens: 20 } });
  assert.deepEqual([a.text, a.stop, a.usage], ['Reading.', 'tools', { in: 1000, out: 20 }]);
  assert.deepEqual(a.calls, [{ id: 'tu_1', name: 'get_workouts', args: { days: 7 } }]);
  assert.equal(a.raw.data.length, 3, 'thinking kept for replay');

  const o = parse(app, 'responses', { status: 'completed', output: [{ type: 'reasoning', id: 'rs', encrypted_content: 'e' }, { type: 'message', content: [{ type: 'output_text', text: 'Reading.' }] }, { type: 'function_call', call_id: 'c1', name: 'get_workouts', arguments: '{"days":7}' }], usage: { input_tokens: 5, output_tokens: 6 } });
  assert.deepEqual([o.text, o.stop, o.calls], ['Reading.', 'tools', [{ id: 'c1', name: 'get_workouts', args: { days: 7 } }]]);

  const c = parse(app, 'chat', { choices: [{ finish_reason: 'tool_calls', message: { content: 'Reading.', reasoning_details: [1], tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_workouts', arguments: '{"days":7}' } }, { type: 'function', function: { name: 'get_meal_plan', arguments: '' } }] } }], usage: { prompt_tokens: 5, completion_tokens: 6 } });
  assert.deepEqual([c.text, c.stop, c.usage], ['Reading.', 'tools', { in: 5, out: 6 }]);
  assert.equal(c.calls[0].id, 'c1'); assert.match(c.calls[1].id, /^local-/, 'a call with no id gets one');
  assert.equal(c.raw.data.tool_calls[1].id, c.calls[1].id, 'and the replayed message carries the same id');
  assert.deepEqual(c.raw.data.reasoning_details, [1]);

  const g = parse(app, 'gemini', { candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'hidden' }, { text: 'Reading.' }, { functionCall: { id: 'g1', name: 'get_workouts', args: { days: 7 } }, thoughtSignature: 'S' }] } }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 6, thoughtsTokenCount: 4 } });
  assert.deepEqual([g.text, g.stop, g.usage], ['Reading.', 'tools', { in: 5, out: 10 }]);
  assert.deepEqual(g.calls, [{ id: 'g1', name: 'get_workouts', args: { days: 7 } }]);
  assert.equal(g.raw.data[2].thoughtSignature, 'S', 'signature kept for replay');
});
test('cut-off, refused and blocked replies are recognised; broken tool arguments are flagged, not guessed', () => {
  const app = loadApp();
  assert.equal(parse(app, 'anthropic', { content: [{ type: 'text', text: 'a' }], stop_reason: 'max_tokens' }).stop, 'length');
  assert.equal(parse(app, 'anthropic', { content: [], stop_reason: 'refusal' }).stop, 'refusal');
  assert.equal(parse(app, 'responses', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }).stop, 'length');
  assert.equal(parse(app, 'responses', { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] }).stop, 'refusal');
  assert.equal(parse(app, 'chat', { choices: [{ finish_reason: 'length', message: { content: 'a' } }] }).stop, 'length');
  assert.equal(parse(app, 'chat', { choices: [{ finish_reason: 'content_filter', message: { content: '' } }] }).stop, 'blocked');
  assert.equal(parse(app, 'gemini', { promptFeedback: { blockReason: 'SAFETY' } }).stop, 'blocked');
  assert.equal(parse(app, 'gemini', { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'a' }] } }] }).stop, 'length');
  const bad = parse(app, 'chat', { choices: [{ message: { content: null, tool_calls: [{ id: 'x', type: 'function', function: { name: 'log_meal', arguments: '{"meal":' } }] } }] });
  assert.equal(bad.calls[0].bad, true); assert.deepEqual(bad.calls[0].args, {});
  for (const [w, d] of [['anthropic', {}], ['responses', {}], ['chat', { choices: [] }], ['gemini', {}]]) { app.set('__d', d); assert.throws(() => app.run(`aiParseResponse('${w}',__d)`), /could not be read/, w); }
});
test('failures are explained in plain words, per provider', async () => {
  const app = withKeys(loadApp());
  const msg = (p, s, m) => app.run(`aiErrorText('${p}',${s},${JSON.stringify(m || '')})`);
  assert.match(msg('anthropic', 401, 'invalid x-api-key'), /Claude rejected the API key/);
  assert.match(msg('gemini', 400, 'API key not valid. Please pass a valid API key.'), /Gemini rejected the API key/);
  assert.match(msg('openai', 404, 'model x'), /does not know that model/);
  assert.match(msg('openrouter', 402, ''), /out of credit/);
  assert.match(msg('openai', 429, ''), /rate-limiting/);
  assert.match(msg('anthropic', 529, ''), /overloaded/);
  assert.match(msg('openai', 400, 'input too long'), /input too long/);
  // an HTTP error becomes that message; a 200 that only contains an error does too
  app.run(`S.ai.provider='openrouter'`);
  app.mockFetch(() => ({ status: 401, body: { error: { message: 'No auth credentials found' } } }));
  await assert.rejects(app.run(`aiChat({system:'s',turns:[{role:'user',text:'hi'}],tools:[]})`), /OpenRouter rejected the API key/);
  app.mockFetch(() => ({ status: 200, body: { error: { message: 'Provider returned error', code: 502 } } }));
  await assert.rejects(app.run(`aiChat({system:'s',turns:[{role:'user',text:'hi'}],tools:[]})`), /Provider returned error/);
  // unreachable network
  app.mockFetch(null);
  await assert.rejects(app.run(`aiChat({system:'s',turns:[{role:'user',text:'hi'}],tools:[]})`), /Could not reach openrouter\.ai/);
});
test('model lists are filtered to chat models and "test connection" makes one real exchange', async () => {
  const app = withKeys(loadApp());
  app.run(`S.ai.provider='openai'`);
  let reqs = app.mockFetch(() => ({ body: { data: [{ id: 'gpt-6-luna' }, { id: 'gpt-6-astra' }, { id: 'gpt-4o-mini-tts' }, { id: 'text-embedding-3-large' }, { id: 'gpt-realtime-2.1-mini' }, { id: 'bad id with spaces' }] } }));
  assert.deepEqual((await app.run(`aiListModels('openai')`)).map(m => m.id), ['gpt-6-astra', 'gpt-6-luna']);
  assert.equal(reqs[0].method, 'GET'); assert.equal(reqs[0].url, 'https://api.openai.com/v1/models');
  reqs = app.mockFetch(() => ({ body: { models: [{ name: 'models/gemini-3.8-flash', displayName: 'Flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-embedding-2', supportedGenerationMethods: ['embedContent'] }, { name: 'models/gemini-3.8-live', supportedGenerationMethods: ['generateContent'] }] } }));
  assert.deepEqual(JSON.parse(JSON.stringify(await app.run(`aiListModels('gemini')`))), [{ id: 'gemini-3.8-flash', label: 'Flash' }]);
  assert.deepEqual(everyKey(reqs[0].url), [], 'the Gemini key is a header here too, not ?key=');
  reqs = app.mockFetch(() => ({ body: replies.openai }));
  const t = await app.run(`aiTest('openai')`);
  assert.equal(t.reply, 'hi'); assert.equal(t.model, 'gpt-6.1-sol');
  assert.equal(reqs[0].url, 'https://api.openai.com/v1/responses'); assert.ok(!('tools' in reqs[0].body));
  assert.equal(app.run(`setAiModel('openai','gpt-6-luna')`), true); assert.equal(app.run(`aiModelFor('openai')`), 'gpt-6-luna');
  assert.equal(app.run(`setAiModel('openai','<script>')`), false);
});
test('a server that cannot read PDFs is told so before anything is sent', async () => {
  const app = withKeys(loadApp());
  const reqs = app.mockFetch(() => ({ body: replies.custom }));
  app.run(`S.ai.provider='custom';S.ai.models.custom='llama'`);
  app.set('__c', [{ role: 'user', text: 'x', attachments: [{ kind: 'pdf', data: 'REVG', name: 'p.pdf' }] }]);
  await assert.rejects(app.run(`aiChat({system:'s',turns:__c,tools:[]})`), /cannot read PDFs/);
  assert.equal(reqs.length, 0);
});
