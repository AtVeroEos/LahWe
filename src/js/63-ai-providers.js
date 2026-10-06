// ═══════════════════════════════════════════════════
// AI PROVIDERS — keys, models, and one chat-with-tools call that works across companies
// ═══════════════════════════════════════════════════
// The coach talks to whichever AI service the person using this copy of the app chooses, with THEIR
// OWN key. There is no shared key, no default key and no server in between:
//  - A key is typed into Settings on the device, kept in its own localStorage entry (AI_KEYS_KEY),
//    and never becomes part of S — so it cannot reach a backup, an undo snapshot or a share sheet.
//  - A key is only ever sent to the company it belongs to (aiFetch checks the host), in a request
//    header — never in a URL, where it could be logged or cached.
//  - Nothing in the repository or the built file contains a key; `npm run check` scans for one.
const AI_PROVIDERS={
  anthropic:{label:'Claude',company:'Anthropic',wire:'anthropic',base:'https://api.anthropic.com/v1',host:'api.anthropic.com',
    keyHint:'sk-ant-…',keyWhere:'Claude Console → API keys (platform.claude.com)',pdf:true,
    models:[{id:'claude-sonnet-5-5',label:'Sonnet 5.5 — recommended'},{id:'claude-haiku-4-5-20251001',label:'Haiku 4.5 — fastest, cheapest'},{id:'claude-opus-5-5',label:'Opus 5.5 — most capable'}]},
  openai:{label:'ChatGPT',company:'OpenAI',wire:'responses',base:'https://api.openai.com/v1',host:'api.openai.com',
    keyHint:'sk-…',keyWhere:'platform.openai.com → API keys',pdf:true,
    models:[{id:'gpt-6.1-sol',label:'GPT-6.1 Sol — recommended'},{id:'gpt-6-luna',label:'GPT-6 Luna — cheapest'},{id:'gpt-6-astra',label:'GPT-6 Astra — most capable'}]},
  gemini:{label:'Gemini',company:'Google',wire:'gemini',base:'https://generativelanguage.googleapis.com/v1beta',host:'generativelanguage.googleapis.com',
    keyHint:'AIza…',keyWhere:'Google AI Studio → Get API key (aistudio.google.com)',pdf:true,
    models:[{id:'gemini-3.8-flash',label:'Gemini 3.8 Flash — recommended'},{id:'gemini-3.5-flash-lite',label:'Gemini 3.5 Flash-Lite — cheapest'},{id:'gemini-3.1-pro-preview',label:'Gemini 3.1 Pro (preview)'}]},
  openrouter:{label:'OpenRouter',company:'OpenRouter',blurb:'many models',wire:'chat',base:'https://openrouter.ai/api/v1',host:'openrouter.ai',
    keyHint:'sk-or-…',keyWhere:'openrouter.ai → Keys',pdf:true,
    models:[{id:'anthropic/claude-sonnet-5.5',label:'Claude Sonnet 5.5'},{id:'openai/gpt-6-luna',label:'GPT-6 Luna'},{id:'google/gemini-3.8-flash',label:'Gemini 3.8 Flash'}]},
  custom:{label:'Custom',company:'your server',blurb:'your server',wire:'chat',base:null,host:null,
    keyHint:'key (if your server needs one)',keyWhere:'any OpenAI-compatible endpoint: Ollama, LM Studio, Groq, Together, a company gateway…',pdf:false,models:[]},
};
const AI_PROVIDER_IDS=Object.keys(AI_PROVIDERS);
const AI_MODEL_ID_RE=/^[A-Za-z0-9][A-Za-z0-9._:\/~@+\-]{0,119}$/;
const AI_MAX_ATTACH=4,AI_IMG_EDGE=1568,AI_PDF_MAX=8e6,AI_TIMEOUT_MS=180000,AI_MAX_OUT=16000;

// ─── Key storage (device only) ───
let _aiKeysMem=null; // used only when the browser refuses localStorage (private mode): keys then last until the tab closes
function aiKeysRead(){
  let o=null;
  try{o=JSON.parse(localStorage.getItem(AI_KEYS_KEY)||'null');}catch(e){o=_aiKeysMem;}
  if(!isObj(o))o=isObj(_aiKeysMem)?_aiKeysMem:{};
  // One-time move of the single Claude key saved by the first AI builder.
  try{
    const old=localStorage.getItem(LEGACY_API_KEY_KEY);
    if(old){if(!o.anthropic)o.anthropic=String(old).trim();localStorage.setItem(AI_KEYS_KEY,JSON.stringify(o));localStorage.removeItem(LEGACY_API_KEY_KEY);}
  }catch(e){}
  return o;
}
function aiKeysWrite(o){
  _aiKeysMem=o;
  try{
    if(Object.keys(o).some(k=>o[k]))localStorage.setItem(AI_KEYS_KEY,JSON.stringify(o));
    else localStorage.removeItem(AI_KEYS_KEY);
    return true;
  }catch(e){return false;}
}
function getAiKey(p){const v=aiKeysRead()[p];return typeof v==='string'?v:'';}
// Which company a key belongs to, judged by its well-known prefix ('' when it can't be told).
function aiKeyOwner(k){
  k=String(k||'');
  if(/^sk-ant-/.test(k))return'anthropic';
  if(/^sk-or-/.test(k))return'openrouter';
  if(/^AIza/.test(k))return'gemini';
  if(/^sk-/.test(k))return'openai';
  return'';
}
// Returns '' when the key is acceptable for that provider, otherwise the reason it is not.
function aiKeyProblem(p,k){
  const def=AI_PROVIDERS[p];if(!def)return'Unknown provider.';
  k=String(k||'').trim();
  if(!k)return'Paste your API key first.';
  if(/\s/.test(k))return'That has a space or line break in it — paste just the key.';
  if(!/^[\x21-\x7e]+$/.test(k))return'That has characters an API key never contains — paste just the key.';
  if(k.length<12)return'That is too short to be an API key.';
  if(k.length>512)return'That is too long to be an API key.';
  const owner=aiKeyOwner(k);
  // A key pasted into the wrong company's box would be sent to the wrong company. Refuse it.
  if(p!=='custom'&&owner&&owner!==p)return`That looks like a ${AI_PROVIDERS[owner].label} (${AI_PROVIDERS[owner].company}) key. Choose ${AI_PROVIDERS[owner].label} above, or paste a ${def.label} key.`;
  if(p==='anthropic'&&owner!=='anthropic')return'A Claude API key starts with sk-ant-.';
  if(p==='openrouter'&&owner!=='openrouter')return'An OpenRouter key starts with sk-or-.';
  return'';
}
function setAiKey(p,k){
  const why=aiKeyProblem(p,k);if(why)return why;
  const o=aiKeysRead();o[p]=String(k).trim();
  return aiKeysWrite(o)?'':'This browser would not store the key (private browsing?). It will work until you close the app.';
}
function clearAiKey(p){const o=aiKeysRead();delete o[p];aiKeysWrite(o);}
function clearAllAiKeys(){
  _aiKeysMem=null;
  try{localStorage.removeItem(AI_KEYS_KEY);localStorage.removeItem(LEGACY_API_KEY_KEY);}catch(e){}
}
function maskKey(k){k=String(k||'');return k?'····'+k.slice(-4):'';}
// Remove anything key-shaped from text before it is shown, logged or stored (provider error
// messages sometimes echo part of the key back).
function scrubKeys(text){
  let s=String(text==null?'':text);
  const o=_aiKeysMem||(()=>{try{return JSON.parse(localStorage.getItem(AI_KEYS_KEY)||'null');}catch(e){return null;}})()||{};
  AI_PROVIDER_IDS.forEach(p=>{const k=o[p];if(typeof k==='string'&&k.length>=8)s=s.split(k).join('[key hidden]');});
  return s.replace(/\b(sk-[A-Za-z0-9_\-]{8})[A-Za-z0-9_\-]{8,}/g,'$1…[key hidden]').replace(/\bAIza[0-9A-Za-z_\-]{20,}/g,'AIza…[key hidden]');
}

// ─── Custom server address (kept with the keys: device only) ───
function aiUrlProblem(u){
  u=String(u||'').trim();if(!u)return'Enter the server address, e.g. https://api.example.com/v1';
  let url;try{url=new URL(u);}catch(e){return'That is not a web address. It should look like https://api.example.com/v1';}
  const local=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local))return'Use an https:// address (plain http:// is only allowed for localhost), so the key is not sent in the clear.';
  if(url.username||url.password)return'Leave the user name and password out of the address — put the key in the key box.';
  if(url.search||url.hash)return'Leave everything after ? or # out of the address.';
  return'';
}
function cleanCustomUrl(u){return String(u||'').trim().replace(/\/+$/,'').replace(/\/chat\/completions$/,'').replace(/\/+$/,'');}
function getCustomUrl(){const v=aiKeysRead().customUrl;return typeof v==='string'?v:'';}
function setCustomUrl(u){
  const why=aiUrlProblem(u);if(why)return why;
  const o=aiKeysRead();o.customUrl=cleanCustomUrl(u);aiKeysWrite(o);return'';
}

// ─── Current choice ───
function aiProvider(){return AI_PROVIDERS[S.ai&&S.ai.provider]?S.ai.provider:'anthropic';}
function aiBase(p){return p==='custom'?getCustomUrl():AI_PROVIDERS[p].base;}
function aiModelFor(p){
  p=p||aiProvider();
  const chosen=S.ai&&S.ai.models&&S.ai.models[p];
  if(typeof chosen==='string'&&AI_MODEL_ID_RE.test(chosen))return chosen;
  const first=AI_PROVIDERS[p].models[0];return first?first.id:'';
}
function setAiModel(p,id){
  id=String(id||'').trim();
  if(!AI_PROVIDERS[p]||!AI_MODEL_ID_RE.test(id))return false;
  S.ai.models[p]=id;save();return true;
}
// Is everything in place to make a request with the provider that is selected right now?
function aiReady(p){
  p=p||aiProvider();
  if(p==='custom')return !!getCustomUrl()&&!!aiModelFor(p);
  return !!getAiKey(p);
}
function aiWhere(p){p=p||aiProvider();if(p!=='custom')return AI_PROVIDERS[p].host;try{return new URL(getCustomUrl()).host;}catch(e){return'your server';}}

// ─── Tool schemas ───
// Tools are written once in a neutral shape {name, description, parameters} and translated here.
function aiToolsFor(wire,tools){
  tools=tools||[];
  if(wire==='anthropic')return tools.map(t=>({name:t.name,description:t.description,input_schema:t.parameters}));
  if(wire==='responses')return tools.map(t=>({type:'function',name:t.name,description:t.description,parameters:t.parameters,strict:false}));
  if(wire==='chat')return tools.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.parameters}}));
  // Gemini rejects an object schema with no properties, so no-argument tools carry no schema at all.
  return[{functionDeclarations:tools.map(t=>{
    const d={name:t.name,description:t.description};
    if(Object.keys((t.parameters&&t.parameters.properties)||{}).length)d.parameters=t.parameters;
    return d;
  })}];
}

// ─── Conversation → request (pure) ───
// A conversation is a list of neutral turns:
//   {role:'user', text, attachments:[{kind:'image'|'pdf', media, data, name}]}
//   {role:'assistant', text, calls:[{id,name,args}], raw:{wire,data}}   raw = the provider's own
//        form of the reply; it is replayed untouched while a tool loop is running, because providers
//        attach reasoning state to it (thinking blocks, thought signatures, reasoning items).
//   {role:'tool', results:[{id,name,out,isError}]}
function aiToolText(r){try{return typeof r.out==='string'?r.out:JSON.stringify(r.out);}catch(e){return'{"error":"result could not be serialised"}';}}
function aiDataUrl(a){return `data:${a.kind==='pdf'?'application/pdf':(a.media||'image/jpeg')};base64,${a.data}`;}
function aiUserText(t){return String(t.text||'').trim()||(t.attachments&&t.attachments.length?'See the attachment.':'(no text)');}
function aiMergeSameRole(msgs,key){
  const out=[];
  msgs.forEach(m=>{
    const last=out[out.length-1];
    if(last&&last.role===m.role&&Array.isArray(last[key])&&Array.isArray(m[key]))last[key]=last[key].concat(m[key]);
    else out.push(m);
  });
  return out;
}
function aiBuildRequest(p,model,req){
  const def=AI_PROVIDERS[p];const wire=def.wire;
  const turns=(req.turns||[]).filter(t=>t&&(t.role!=='assistant'||(t.text&&String(t.text).trim())||(t.calls&&t.calls.length)));
  const atts=t=>(t.attachments||[]).filter(a=>a&&a.data);
  const hasTools=!!(req.tools&&req.tools.length);
  if(wire==='anthropic'){
    const messages=aiMergeSameRole(turns.map(t=>{
      if(t.role==='user')return{role:'user',content:atts(t).map(a=>a.kind==='pdf'
        ?{type:'document',source:{type:'base64',media_type:'application/pdf',data:a.data}}
        :{type:'image',source:{type:'base64',media_type:a.media||'image/jpeg',data:a.data}}).concat([{type:'text',text:aiUserText(t)}])};
      if(t.role==='tool')return{role:'user',content:t.results.map(r=>{const b={type:'tool_result',tool_use_id:r.id,content:aiToolText(r)};if(r.isError)b.is_error=true;return b;})};
      if(t.raw&&t.raw.wire===wire&&Array.isArray(t.raw.data)&&t.raw.data.length)return{role:'assistant',content:t.raw.data};
      const c=[];if(t.text&&String(t.text).trim())c.push({type:'text',text:String(t.text)});
      (t.calls||[]).forEach(k=>c.push({type:'tool_use',id:k.id,name:k.name,input:isObj(k.args)?k.args:{}}));
      return{role:'assistant',content:c};
    }),'content');
    const body={model,max_tokens:AI_MAX_OUT,system:[{type:'text',text:req.system||'',cache_control:{type:'ephemeral'}}],messages};
    if(hasTools)body.tools=aiToolsFor(wire,req.tools);
    return{path:'/messages',body};
  }
  if(wire==='responses'){
    const input=[];
    turns.forEach(t=>{
      if(t.role==='user')input.push({role:'user',content:[{type:'input_text',text:aiUserText(t)}].concat(atts(t).map(a=>a.kind==='pdf'
        ?{type:'input_file',filename:String(a.name||'document.pdf'),file_data:aiDataUrl(a)}
        :{type:'input_image',image_url:aiDataUrl(a)}))});
      else if(t.role==='tool')t.results.forEach(r=>input.push({type:'function_call_output',call_id:r.id,output:aiToolText(r)}));
      else if(t.raw&&t.raw.wire===wire&&Array.isArray(t.raw.data)&&t.raw.data.length){
        // Reasoning items can only be replayed when they carry their encrypted content.
        t.raw.data.forEach(it=>{if(isObj(it)&&!(it.type==='reasoning'&&!it.encrypted_content))input.push(it);});
      }else{
        if(t.text&&String(t.text).trim())input.push({role:'assistant',content:[{type:'output_text',text:String(t.text)}]});
        (t.calls||[]).forEach(k=>input.push({type:'function_call',call_id:k.id,name:k.name,arguments:JSON.stringify(isObj(k.args)?k.args:{})}));
      }
    });
    const body={model,instructions:req.system||'',input,store:false,max_output_tokens:AI_MAX_OUT,include:['reasoning.encrypted_content']};
    if(hasTools)body.tools=aiToolsFor(wire,req.tools);
    return{path:'/responses',body};
  }
  if(wire==='chat'){
    const messages=[{role:'system',content:req.system||''}];
    turns.forEach(t=>{
      if(t.role==='user'){
        const a=atts(t);
        messages.push({role:'user',content:a.length?[{type:'text',text:aiUserText(t)}].concat(a.map(x=>x.kind==='pdf'
          ?{type:'file',file:{filename:String(x.name||'document.pdf'),file_data:aiDataUrl(x)}}
          :{type:'image_url',image_url:{url:aiDataUrl(x)}})):aiUserText(t)});
      }else if(t.role==='tool')t.results.forEach(r=>messages.push({role:'tool',tool_call_id:r.id,content:aiToolText(r)}));
      else if(t.raw&&t.raw.wire===wire&&isObj(t.raw.data))messages.push(t.raw.data);
      else{
        const m={role:'assistant',content:t.text&&String(t.text).trim()?String(t.text):null};
        if(t.calls&&t.calls.length)m.tool_calls=t.calls.map(k=>({id:k.id,type:'function',function:{name:k.name,arguments:JSON.stringify(isObj(k.args)?k.args:{})}}));
        messages.push(m);
      }
    });
    const body={model,messages};
    if(hasTools)body.tools=aiToolsFor(wire,req.tools);
    return{path:'/chat/completions',body};
  }
  // Gemini
  const contents=aiMergeSameRole(turns.map(t=>{
    if(t.role==='user')return{role:'user',parts:atts(t).map(a=>({inlineData:{mimeType:a.kind==='pdf'?'application/pdf':(a.media||'image/jpeg'),data:a.data}})).concat([{text:aiUserText(t)}])};
    if(t.role==='tool')return{role:'user',parts:t.results.map(r=>{
      const fr={name:r.name,response:isObj(r.out)?r.out:{result:r.out}};
      if(r.id&&!/^local-/.test(r.id))fr.id=r.id;
      return{functionResponse:fr};
    })};
    if(t.raw&&t.raw.wire===wire&&Array.isArray(t.raw.data)&&t.raw.data.length)return{role:'model',parts:t.raw.data};
    const parts=[];if(t.text&&String(t.text).trim())parts.push({text:String(t.text)});
    (t.calls||[]).forEach((k,i)=>{
      const fc={name:k.name,args:isObj(k.args)?k.args:{}};if(k.id&&!/^local-/.test(k.id))fc.id=k.id;
      const part={functionCall:fc};
      // Calls that did not come from Gemini have no thought signature; this documented value skips the check.
      if(i===0)part.thoughtSignature='skip_thought_signature_validator';
      parts.push(part);
    });
    return{role:'model',parts};
  }),'parts');
  const body={systemInstruction:{parts:[{text:req.system||''}]},contents,generationConfig:{maxOutputTokens:AI_MAX_OUT}};
  if(hasTools)body.tools=aiToolsFor(wire,req.tools);
  return{path:`/models/${encodeURIComponent(model)}:generateContent`,body};
}

// ─── Reply → neutral form (pure) ───
// → {text, calls:[{id,name,args,bad?}], raw:{wire,data}, usage:{in,out}, stop:'end'|'tools'|'length'|'refusal'|'blocked'}
function aiParseArgs(v){
  if(isObj(v))return{args:v};
  if(v==null||v==='')return{args:{}};
  try{const o=JSON.parse(String(v));return isObj(o)?{args:o}:{args:{},bad:true};}catch(e){return{args:{},bad:true};}
}
function aiParseResponse(wire,d){
  const out={text:'',calls:[],raw:null,usage:{in:0,out:0},stop:'end'};
  if(!isObj(d))throw new Error('The reply could not be read.');
  const call=(id,name,v)=>{const a=aiParseArgs(v);const c={id:String(id||('local-'+uid())),name:String(name||''),args:a.args};if(a.bad)c.bad=true;return c;};
  if(wire==='anthropic'){
    if(!Array.isArray(d.content))throw new Error('The reply could not be read.');
    out.text=d.content.filter(b=>b&&b.type==='text').map(b=>b.text||'').join('');
    out.calls=d.content.filter(b=>b&&b.type==='tool_use').map(b=>call(b.id,b.name,b.input));
    out.raw={wire,data:d.content};
    const u=d.usage||{};out.usage={in:(u.input_tokens||0)+(u.cache_read_input_tokens||0)+(u.cache_creation_input_tokens||0),out:u.output_tokens||0};
    out.stop=out.calls.length?'tools':d.stop_reason==='max_tokens'?'length':d.stop_reason==='refusal'?'refusal':'end';
  }else if(wire==='responses'){
    if(!Array.isArray(d.output))throw new Error('The reply could not be read.');
    let refused=false;
    d.output.forEach(it=>{
      if(!isObj(it))return;
      if(it.type==='message')(Array.isArray(it.content)?it.content:[]).forEach(c=>{
        if(c&&c.type==='output_text')out.text+=c.text||'';
        else if(c&&c.type==='refusal'){refused=true;out.text+=c.refusal||'';}
      });
      else if(it.type==='function_call')out.calls.push(call(it.call_id,it.name,it.arguments));
    });
    out.raw={wire,data:d.output};
    const u=d.usage||{};out.usage={in:u.input_tokens||0,out:u.output_tokens||0};
    const why=d.incomplete_details&&d.incomplete_details.reason;
    out.stop=out.calls.length?'tools':d.status==='incomplete'?(why==='content_filter'?'blocked':'length'):refused?'refusal':'end';
  }else if(wire==='chat'){
    const ch=Array.isArray(d.choices)?d.choices[0]:null;
    if(!isObj(ch)||!isObj(ch.message))throw new Error('The reply could not be read.');
    const m=ch.message;
    out.text=typeof m.content==='string'?m.content:Array.isArray(m.content)?m.content.filter(c=>c&&c.type==='text').map(c=>c.text||'').join(''):'';
    const tcs=(Array.isArray(m.tool_calls)?m.tool_calls:[]).filter(tc=>isObj(tc)&&isObj(tc.function));
    out.calls=tcs.map(tc=>call(tc.id,tc.function.name,tc.function.arguments));
    // Replay the message as the server wrote it (some models need their reasoning details back),
    // with ids filled in so the tool results can point at them.
    const rawMsg={role:'assistant',content:m.content==null?null:m.content};
    if(out.calls.length)rawMsg.tool_calls=out.calls.map((c,i)=>({id:c.id,type:'function',function:{name:c.name,arguments:typeof tcs[i].function.arguments==='string'?tcs[i].function.arguments:JSON.stringify(c.args)}}));
    if(m.reasoning_details!=null)rawMsg.reasoning_details=m.reasoning_details;
    out.raw={wire,data:rawMsg};
    const u=d.usage||{};out.usage={in:u.prompt_tokens||0,out:u.completion_tokens||0};
    out.stop=out.calls.length?'tools':ch.finish_reason==='length'?'length':ch.finish_reason==='content_filter'?'blocked':'end';
  }else{
    const cand=Array.isArray(d.candidates)?d.candidates[0]:null;
    const u=d.usageMetadata||{};out.usage={in:u.promptTokenCount||0,out:(u.candidatesTokenCount||0)+(u.thoughtsTokenCount||0)};
    if(!isObj(cand)){
      if(d.promptFeedback&&d.promptFeedback.blockReason){out.stop='blocked';return out;}
      throw new Error('The reply could not be read.');
    }
    const parts=cand.content&&Array.isArray(cand.content.parts)?cand.content.parts:[];
    out.text=parts.filter(x=>x&&typeof x.text==='string'&&!x.thought).map(x=>x.text).join('');
    out.calls=parts.filter(x=>x&&isObj(x.functionCall)).map(x=>call(x.functionCall.id,x.functionCall.name,x.functionCall.args));
    out.raw={wire,data:parts};
    const fr=String(cand.finishReason||'');
    out.stop=out.calls.length?'tools':fr==='MAX_TOKENS'?'length':/SAFETY|RECITATION|BLOCKLIST|PROHIBITED|SPII/.test(fr)?'blocked':'end';
  }
  return out;
}

// ─── Errors ───
function aiApiMessage(d){
  if(!isObj(d))return'';
  const e=d.error;
  if(typeof e==='string')return e;
  if(isObj(e))return String(e.message||e.code||e.type||e.status||'');
  return typeof d.message==='string'?d.message:'';
}
function aiErrorText(p,status,apiMsg){
  const def=AI_PROVIDERS[p]||AI_PROVIDERS.anthropic;
  const m=scrubKeys(String(apiMsg||'')).replace(/\s+/g,' ').slice(0,240);
  const who=def.label;
  if(status===401||(status===400&&/api[ _-]?key/i.test(m)&&/invalid|not valid|incorrect|expired/i.test(m)))return`${who} rejected the API key. Check it in Settings → AI coach.`;
  if(status===402)return`This ${who} account is out of credit.`+(m?` (${m})`:'');
  if(status===403)return`This key is not allowed to do that`+(m?`: ${m}`:'.');
  if(status===404)return`${who} does not know that model, or this key cannot use it. Pick another model in Settings → AI coach.`+(m?` (${m})`:'');
  if(status===413)return'That was too much to send at once. Use fewer or smaller attachments, or start a new chat.';
  if(status===429)return`${who} is rate-limiting this key, or the account is out of credit. Wait a minute and try again.`+(m?` (${m})`:'');
  if(status===529||status>=500)return`${who} is overloaded or having trouble right now. Try again in a moment.`;
  return m?`${who} did not accept the request: ${m}`:`The request to ${who} failed (${status}).`;
}

// ─── Network ───
// The single place a key leaves the device. It goes in a header, to the provider's own host only.
function aiHeaders(p,key){
  const wire=AI_PROVIDERS[p].wire;const h={'content-type':'application/json'};
  if(wire==='anthropic'){h['x-api-key']=key;h['anthropic-version']='2023-06-01';h['anthropic-dangerous-direct-browser-access']='true';}
  else if(wire==='gemini')h['x-goog-api-key']=key;
  else if(key)h['authorization']='Bearer '+key;
  return h;
}
async function aiFetch(p,path,opts){
  opts=opts||{};
  const def=AI_PROVIDERS[p];if(!def)throw new Error('Unknown AI provider.');
  const base=aiBase(p);
  if(!base)throw new Error('Add your server address in Settings → AI coach.');
  const key=getAiKey(p);
  if(!key&&p!=='custom')throw new Error(`Add your ${def.label} API key in Settings → AI coach.`);
  const url=base+path;
  let host='';try{host=new URL(url).host;}catch(e){throw new Error('The server address is not valid.');}
  if(p!=='custom'&&host!==def.host)throw new Error('Refusing to send the key to an unexpected address.');
  if(p==='custom'){const why=aiUrlProblem(base);if(why)throw new Error(why);}
  const ctl=typeof AbortController!=='undefined'?new AbortController():null;
  const onAbort=()=>{try{ctl&&ctl.abort();}catch(e){}};
  if(opts.signal){if(opts.signal.aborted)onAbort();else opts.signal.addEventListener('abort',onAbort);}
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;onAbort();},AI_TIMEOUT_MS);
  try{
    let res;
    try{
      const init={method:opts.method||'POST',headers:aiHeaders(p,key),signal:ctl?ctl.signal:undefined,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'};
      if(opts.body!==undefined)init.body=JSON.stringify(opts.body);
      res=await fetch(url,init);
    }catch(e){
      if(timedOut)throw new Error(`${def.label} took too long to answer. Try again.`);
      if(e&&e.name==='AbortError')throw e;
      if(typeof navigator!=='undefined'&&navigator.onLine===false)throw new Error('You are offline.');
      throw new Error(`Could not reach ${host}. Check your connection.`+(p==='custom'?' The server also has to allow requests from web pages (CORS).':p==='gemini'||p==='openai'?' If you are online, this service may be refusing requests from a web page — OpenRouter accepts them and offers the same models.':''));
    }
    let data=null;try{data=await res.json();}catch(e){}
    return{status:res.status,ok:res.ok,data};
  }finally{
    clearTimeout(timer);
    if(opts.signal&&opts.signal.removeEventListener)opts.signal.removeEventListener('abort',onAbort);
  }
}
// One model turn. req: {system, turns, tools, provider?, model?}
async function aiChat(req,signal){
  const p=req.provider||aiProvider();const def=AI_PROVIDERS[p];
  const model=req.model||aiModelFor(p);
  if(!model)throw new Error('Choose a model in Settings → AI coach.');
  if(!def.pdf&&(req.turns||[]).some(t=>t.role==='user'&&(t.attachments||[]).some(a=>a&&a.data&&a.kind==='pdf')))throw new Error('This server cannot read PDFs. Attach a photo or screenshot instead.');
  const built=aiBuildRequest(p,model,req);
  const r=await aiFetch(p,built.path,{method:'POST',body:built.body,signal});
  const apiMsg=aiApiMessage(r.data);
  if(!r.ok)throw new Error(aiErrorText(p,r.status,apiMsg));
  if(isObj(r.data)&&r.data.error&&!r.data.choices&&!r.data.output&&!r.data.content&&!r.data.candidates)throw new Error(aiErrorText(p,400,apiMsg));
  const out=aiParseResponse(def.wire,r.data);
  out.provider=p;out.model=model;
  if(out.stop==='refusal'&&!out.text)out.text='The model declined to answer that.';
  if(out.stop==='blocked'&&!out.text)out.text=`${def.label}’s safety filter blocked that reply.`;
  if(out.stop==='length'&&!out.calls.length)out.text=(out.text?out.text+'\n\n':'')+'(The reply was cut off for length. Ask for a shorter answer or a smaller piece.)';
  return out;
}
// Ask the provider which models this key can use. → [{id,label}]
async function aiListModels(p){
  const def=AI_PROVIDERS[p];
  const r=await aiFetch(p,p==='openrouter'?'/models?supported_parameters=tools':'/models',{method:'GET'});
  if(!r.ok)throw new Error(aiErrorText(p,r.status,aiApiMessage(r.data)));
  let list=[];
  if(def.wire==='gemini')list=(Array.isArray(r.data&&r.data.models)?r.data.models:[])
    .filter(m=>isObj(m)&&(m.supportedGenerationMethods||[]).includes('generateContent'))
    .map(m=>({id:String(m.name||'').replace(/^models\//,''),label:String(m.displayName||'')}));
  else list=(Array.isArray(r.data&&r.data.data)?r.data.data:[]).filter(isObj).map(m=>({id:String(m.id||''),label:String(m.display_name||m.name||'')}));
  if(p==='openai')list=list.filter(m=>/^(gpt-|o\d|chatgpt)/.test(m.id)&&!/audio|realtime|tts|transcribe|image|embedding|moderation|search|instruct/.test(m.id));
  if(p==='gemini')list=list.filter(m=>/^gemini/.test(m.id)&&!/tts|image|live|embedding|audio/.test(m.id));
  return list.filter(m=>AI_MODEL_ID_RE.test(m.id)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).slice(0,400);
}
// A real one-line exchange with the chosen model: proves the key, the model name, the address and
// the browser connection all work, which a "list models" call would not.
async function aiTest(p){
  const t0=Date.now();
  const out=await aiChat({provider:p,system:'You are a connection test. Reply with exactly: OK',turns:[{role:'user',text:'Reply with exactly: OK'}],tools:[]});
  return{ms:Date.now()-t0,model:out.model,reply:String(out.text||'').trim().slice(0,60),usage:out.usage};
}

// ─── Attachments ───
function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const rd=new FileReader();
    rd.onload=()=>{const s=String(rd.result||'');resolve(s.slice(s.indexOf(',')+1));};
    rd.onerror=()=>reject(new Error('Could not read '+file.name));
    rd.readAsDataURL(file);
  });
}
// Photos straight off a phone are several megabytes; scale them to what a model actually uses.
function imageToJpeg(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);const img=new Image();
    img.onload=()=>{
      try{
        const k=Math.min(1,AI_IMG_EDGE/Math.max(img.naturalWidth,img.naturalHeight));
        const w=Math.max(1,Math.round(img.naturalWidth*k)),h=Math.max(1,Math.round(img.naturalHeight*k));
        const cv=document.createElement('canvas');cv.width=w;cv.height=h;
        const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
        const d=cv.toDataURL('image/jpeg',0.86);
        resolve({kind:'image',media:'image/jpeg',data:d.slice(d.indexOf(',')+1),name:file.name});
      }catch(e){reject(new Error('Could not process '+file.name));}
      finally{URL.revokeObjectURL(url);}
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('That image format could not be opened: '+file.name));};
    img.src=url;
  });
}
// → {attachments:[…], text:'…'} from a file input's FileList. Text files come back as text.
async function aiReadFiles(files,have){
  const out={attachments:[],text:'',notes:[]};
  for(const f of files){
    if((have||0)+out.attachments.length>=AI_MAX_ATTACH){out.notes.push(`Up to ${AI_MAX_ATTACH} attachments`);break;}
    try{
      if(f.type==='application/pdf'||/\.pdf$/i.test(f.name)){
        if(f.size>AI_PDF_MAX){out.notes.push('That PDF is too large (8 MB max)');continue;}
        out.attachments.push({kind:'pdf',data:await fileToBase64(f),name:f.name});
      }else if(/^image\//.test(f.type)||/\.(jpe?g|png|heic|webp|gif)$/i.test(f.name)){
        out.attachments.push(await imageToJpeg(f));
      }else if(/^text\//.test(f.type)||/\.(txt|md|csv|json)$/i.test(f.name)){
        if(f.size>200000){out.notes.push('That text file is too large');continue;}
        out.text+=(out.text?'\n\n':'')+(await f.text());
      }else out.notes.push('Attach a photo, screenshot, PDF or text file');
    }catch(e){out.notes.push(errText(e));}
  }
  return out;
}
