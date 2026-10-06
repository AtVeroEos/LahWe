// ═══════════════════════════════════════════════════
// COACH — the conversation, the tool loop, and the Coach tab
// ═══════════════════════════════════════════════════
// The chat is kept on this device in its own entry (COACH_CHAT_KEY). It is not part of S, so it is
// not in backups, and it never holds a key or the bytes of an attachment.
const Coach={turns:[],busy:false,abort:null,error:null,status:'',attachments:[],events:[],loaded:false,pending:null,stick:true};
const COACH_KEEP_TURNS=80,COACH_SEND_BUDGET=110000,COACH_OLD_RESULT=1500;

// ─── Storage ───
function coachLoad(){
  if(Coach.loaded)return;Coach.loaded=true;
  let o=null;try{o=JSON.parse(localStorage.getItem(COACH_CHAT_KEY)||'null');}catch(e){}
  const turns=isObj(o)&&Array.isArray(o.turns)?o.turns:[];
  Coach.turns=turns.filter(t=>isObj(t)&&['user','assistant','tool'].includes(t.role)).map(t=>{
    if(t.role==='tool')t.results=(Array.isArray(t.results)?t.results:[]).filter(isObj);
    if(t.role==='assistant'){t.calls=(Array.isArray(t.calls)?t.calls:[]).filter(isObj);delete t.raw;}
    if(t.role==='user')t.attachments=(Array.isArray(t.attachments)?t.attachments:[]).filter(isObj).map(a=>({kind:a.kind,name:a.name}));
    return t;
  });
  coachCloseOpenLoop();
}
// A tool round that was cut off (app closed, error) is closed with a short assistant line, so the
// conversation is well-formed for whichever provider reads it next.
function coachCloseOpenLoop(){
  const last=Coach.turns[Coach.turns.length-1];
  if(last&&last.role==='tool')Coach.turns.push({role:'assistant',text:'(That step was interrupted before I could reply.)',calls:[],at:Date.now()});
  if(last&&last.role==='assistant'&&last.calls&&last.calls.length)Coach.turns.push({role:'tool',results:last.calls.map(c=>({id:c.id,name:c.name,out:{error:'interrupted'},isError:true,ui:null}))},{role:'assistant',text:'(That step was interrupted before I could reply.)',calls:[],at:Date.now()});
}
function coachPersist(){
  let turns=Coach.turns.slice(-COACH_KEEP_TURNS);
  while(turns.length&&turns[0].role!=='user')turns.shift();
  const slim=turns.map(t=>{
    if(t.role==='user')return{role:'user',text:scrubKeys(t.text),note:t.note||'',at:t.at,attachments:(t.attachments||[]).map(a=>({kind:a.kind,name:a.name}))};
    if(t.role==='assistant')return{role:'assistant',text:t.text||'',calls:t.calls||[],at:t.at,meta:t.meta};
    return{role:'tool',results:t.results};
  });
  try{
    let json=JSON.stringify({v:1,turns:slim});
    // Keep the stored chat modest; drop the oldest exchanges first.
    while(json.length>400000&&slim.length>2){slim.shift();while(slim.length&&slim[0].role!=='user')slim.shift();json=JSON.stringify({v:1,turns:slim});}
    if(slim.length)localStorage.setItem(COACH_CHAT_KEY,json);else localStorage.removeItem(COACH_CHAT_KEY);
  }catch(e){}
}
function coachClear(){
  if(Coach.abort){try{Coach.abort.abort();}catch(e){}}
  Coach.turns=[];Coach.error=null;Coach.events=[];Coach.attachments=[];Coach.busy=false;Coach.abort=null;Coach.loaded=true;
  try{localStorage.removeItem(COACH_CHAT_KEY);}catch(e){}
}
function coachNewChat(){
  if(Coach.busy)return;
  const had=Coach.turns.length;const keep=Coach.turns;
  coachClear();
  if(S.tab==='coach')render();
  if(had)toast('New chat started','',{action:'Undo',onAction:()=>{Coach.turns=keep;coachPersist();if(S.tab==='coach')render();}});
}

// ─── What is sent ───
// The stored turns, trimmed to a budget: whole older exchanges are dropped first, and bulky results
// from earlier questions are replaced by a stub (the model can read the data again if it needs it).
function coachRequestTurns(){
  const turns=Coach.turns;
  let lastUser=-1;for(let i=turns.length-1;i>=0;i--){if(turns[i].role==='user'){lastUser=i;break;}}
  const mapped=turns.map((t,i)=>{
    if(t.role==='user'){
      const text=(t.note?`[App note: ${t.note}]\n\n`:'')+String(t.text||'');
      return{role:'user',text,attachments:i===lastUser?(t.attachments||[]):[],_stale:i!==lastUser&&(t.attachments||[]).length};
    }
    if(t.role==='assistant')return{role:'assistant',text:t.text||'',calls:t.calls||[],raw:i>lastUser?t.raw:null};
    return{role:'tool',results:t.results.map(r=>{
      let out=r.out;
      if(i<lastUser){let n=0;try{n=JSON.stringify(out).length;}catch(e){}
        if(n>COACH_OLD_RESULT)out={omitted:'An earlier result, dropped to save space. Call the tool again if you need it.'};}
      return{id:r.id,name:r.name,out,isError:r.isError};
    })};
  });
  mapped.forEach(t=>{if(t._stale)t.text+='\n[An attachment was sent with this message earlier; it is no longer available.]';delete t._stale;});
  const size=t=>{try{return JSON.stringify(t.role==='user'?{t:t.text,a:(t.attachments||[]).length*40000}:t).length;}catch(e){return 2000;}};
  let total=0,start=mapped.length;
  for(let i=mapped.length-1;i>=0;i--){
    total+=size(mapped[i]);
    if(mapped[i].role==='user'){if(total>COACH_SEND_BUDGET&&i<lastUser)break;start=i;}
  }
  if(start>=mapped.length)start=Math.max(0,lastUser);
  return mapped.slice(start);
}

// ─── The loop ───
function coachStatusFor(calls){
  const names=calls.map(c=>c.name);
  if(names.some(n=>/^propose_/.test(n)))return'Putting it together…';
  if(names.some(n=>/^(log_|save_|add_|remove_)/.test(n)))return'Saving…';
  return'Looking at your data…';
}
// A newer proposal of the same kind, made while answering the same message, replaces the older one.
function coachSupersede(results){
  const kinds=new Set(results.filter(r=>r.ui&&r.ui.type==='proposal'&&!r.ui.action).map(r=>r.ui.kind));
  if(!kinds.size)return;
  for(let i=Coach.turns.length-1;i>=0;i--){
    const t=Coach.turns[i];if(t.role==='user')break;
    if(t.role==='tool')t.results.forEach(r=>{if(r.ui&&r.ui.type==='proposal'&&r.ui.status==='pending'&&kinds.has(r.ui.kind))r.ui.status='replaced';});
  }
}
async function coachRun(){
  if(Coach.busy)return;
  Coach.busy=true;Coach.error=null;Coach.status='Thinking…';Coach.stick=true;
  const ctl=typeof AbortController!=='undefined'?new AbortController():null;Coach.abort=ctl;
  let steps=0,tin=0,tout=0,tcached=0,model='',finished=false;
  coachPaint();
  try{
    for(;;){
      if(steps>=COACH_MAX_STEPS){
        Coach.turns.push({role:'assistant',text:`I stopped after ${COACH_MAX_STEPS} steps so this does not run on and use up your credit. Tell me to continue if you want me to keep going.`,calls:[],at:Date.now(),meta:{model,steps,in:tin,out:tout,cached:tcached}});
        finished=true;break;
      }
      const res=await aiChat({system:coachRulesPrompt(),context:coachContextPrompt(),turns:coachRequestTurns(),tools:coachToolDefs()},ctl?ctl.signal:undefined);
      if(Coach.abort!==ctl)return; // the chat was cleared while waiting
      steps++;tin+=res.usage.in;tout+=res.usage.out;tcached+=res.usage.cached||0;model=res.model;
      const turn={role:'assistant',text:scrubKeys(res.text||''),calls:res.calls,raw:res.raw,at:Date.now()};
      Coach.turns.push(turn);
      if(!res.calls.length){
        if(!turn.text.trim())turn.text=steps>1?'Done.':'I did not get a reply back. Try again.';
        turn.meta={model,steps,in:tin,out:tout,cached:tcached};
        finished=true;break;
      }
      const results=res.calls.map(c=>{const r=coachRunTool(c);return{id:c.id,name:c.name,out:r.out,isError:!!r.isError,ui:r.ui||null};});
      coachSupersede(results);
      Coach.turns.push({role:'tool',results});
      Coach.status=coachStatusFor(res.calls);
      coachPersist();coachPaint();
    }
  }catch(e){
    if(Coach.abort!==ctl)return;
    if(e&&e.name==='AbortError')Coach.error='Stopped.';
    else Coach.error=scrubKeys(errText(e)); // shown in the thread with a retry button; not an app fault
  }finally{
    if(Coach.abort===ctl){
      if(finished){
        // Reasoning state is only needed while a tool round is open, and attachments only once.
        Coach.turns.forEach(t=>{if(t.role==='assistant')delete t.raw;if(t.role==='user')t.attachments=(t.attachments||[]).map(a=>({kind:a.kind,name:a.name}));});
      }
      Coach.busy=false;Coach.abort=null;Coach.status='';
      coachPersist();coachPaint();
    }
  }
}
function coachStop(){if(Coach.abort){try{Coach.abort.abort();}catch(e){}}}
function coachRetry(){
  if(Coach.busy)return;
  const last=Coach.turns[Coach.turns.length-1];
  if(!last||last.role==='assistant'&&!(last.calls&&last.calls.length)){Coach.error=null;coachPaint();return;}
  coachRun();
}
// send a message. `text` may come from the box, a starter, or a shortcut elsewhere in the app.
function coachSend(text){
  coachLoad();
  if(Coach.busy)return false;
  text=String(text==null?'':text).trim();
  const atts=Coach.attachments.slice();
  if(!text&&!atts.length)return false;
  if(!aiReady()){Coach.pending={text};showAiSettings();return false;}
  if(text.length>12000){toast('That message is too long — trim it or attach it as a file');return false;}
  Coach.attachments=[];
  const note=Coach.events.splice(0).join(' ');
  Coach.turns.push({role:'user',text,attachments:atts,note,at:Date.now()});
  coachPersist();
  coachRun();
  return true;
}
// Things the user did to a card since the last message; told to the model with the next one.
function coachNoteEvent(s){Coach.events.push(s);if(Coach.events.length>8)Coach.events.shift();}

// ─── Text rendering ───
// Model text is untrusted: it is escaped first, then a small, fixed set of marks is turned into tags.
function mdLite(src){
  const inline=s=>s.replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*\n]*?)\*(?=[\s).,;:!?]|$)/g,'$1<i>$2</i>');
  let html='';
  esc(String(src==null?'':src)).split(/\r?\n/).forEach(line=>{
    const t=line.trim();
    if(!t){html+='<div class="md-gap"></div>';return;}
    let m;
    if((m=t.match(/^#{1,6}\s+(.*)$/)))html+=`<div class="md-h">${inline(m[1])}</div>`;
    else if((m=t.match(/^(?:[-*•]|(\d{1,2})[.)])\s+(.*)$/)))html+=`<div class="md-li"><span>${m[1]?m[1]+'.':'•'}</span><div>${inline(m[2])}</div></div>`;
    else html+=`<div>${inline(t)}</div>`;
  });
  return html.replace(/^(<div class="md-gap"><\/div>)+|(<div class="md-gap"><\/div>)+$/g,'');
}

// ─── Thread ───
function coachCardHTML(ui,ti,ri){
  const lines=(ui.lines||[]).filter(Boolean).map(l=>`<div class="cc-line">${esc(l)}</div>`).join('');
  const sum=ui.summary?`<div class="cc-sum">${esc(ui.summary)}</div>`:'';
  const head=`<div class="cc-title">${esc(ui.title||'Proposed change')}</div>${sum}${lines}`;
  if(ui.status==='applied')return`<div class="coach-card done">${head}<div class="cc-state ok">✓ ${esc(ui.message||'Applied')}</div>${ui.go?`<button class="btn bts bsm" style="margin-top:8px" onclick="coachOpen(${jsq(ui.go)})">Open ${esc(COACH_SCREENS[ui.go]||'it')} ›</button>`:''}</div>`;
  if(ui.status==='dismissed')return`<div class="coach-card done">${head}<div class="cc-state">Dismissed — nothing was changed</div></div>`;
  if(ui.status==='replaced')return`<div class="coach-card done"><div class="cc-title" style="opacity:.6">${esc(ui.title||'Proposal')}</div><div class="cc-state">Replaced by a newer version below</div></div>`;
  let btns;const a=`${ti},${ri}`;
  if(ui.kind==='propose_routines')btns=`<button class="btn btp bfw" onclick="coachReviewRoutines(${a})">Review &amp; add</button>`;
  else if(ui.kind==='propose_quick_workout')btns=`<button class="btn btp bfw" onclick="coachCardApply(${a})"${S.activeWorkout?' disabled':''}>▶ Start now</button><button class="btn bts bfw" onclick="coachCardApply(${a},'save')">Save as routine</button>`;
  else if(ui.kind==='propose_meal_plan')btns=`<button class="btn btp bfw" onclick="coachCardApply(${a})">Use this plan</button><button class="btn bts bfw" onclick="coachReviewPlan(${a})">See meals</button>`;
  else if(ui.kind==='propose_delete')btns=`<button class="btn btd bfw" onclick="coachCardApply(${a})">Delete</button>`;
  else btns=`<button class="btn btp bfw" onclick="coachCardApply(${a})">Apply</button>`;
  return`<div class="coach-card${ui.danger?' danger':''}">${head}
    ${ui.kind==='propose_quick_workout'&&S.activeWorkout?'<div class="cc-state">Finish the workout you have open before starting another.</div>':''}
    <div class="cc-note">Nothing has changed yet.</div>
    <div class="cc-btns">${btns}<button class="btn btg" onclick="coachCardDismiss(${a})">${ui.kind==='propose_delete'?'Keep it':'Dismiss'}</button></div></div>`;
}
function coachThreadHTML(){
  let html='';const turns=Coach.turns;
  turns.forEach((t,ti)=>{
    if(t.role==='user'){
      const att=(t.attachments||[]).map(a=>`<span class="ai-chip" style="padding-right:9px">${a.kind==='pdf'?'📄':'🖼'} ${esc(String(a.name||'file').slice(0,22))}</span>`).join('');
      html+=`<div class="cm cm-u"><div class="cm-b">${att?`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:${t.text?6:0}px">${att}</div>`:''}${esc(t.text||'').replace(/\n/g,'<br>')}</div></div>`;
    }else if(t.role==='assistant'){
      if(t.text&&t.text.trim())html+=`<div class="cm cm-a"><div class="cm-b">${mdLite(t.text)}</div>${t.meta?`<div class="cm-meta">${esc(t.meta.model||'')} · ${t.meta.steps} step${t.meta.steps===1?'':'s'} · ${(t.meta.in||0).toLocaleString()} tokens in${t.meta.cached?` (${Math.round(t.meta.cached/Math.max(1,t.meta.in)*100)}% reused at the cheap rate)`:''}, ${(t.meta.out||0).toLocaleString()} out</div>`:''}</div>`;
    }else{
      const reads=t.results.filter(r=>r.ui&&r.ui.type==='read');
      if(reads.length)html+=`<div class="cm-read"><span>Read</span>${reads.map(r=>`<i>${esc(r.ui.label)}</i>`).join('')}</div>`;
      t.results.forEach((r,ri)=>{
        const ui=r.ui;if(!ui)return;
        if(ui.type==='receipt')html+=`<div class="coach-receipt${ui.undone?' undone':''}"><div style="flex:1;min-width:0"><div class="cc-title">${ui.undone?'':'✓ '}${esc(ui.title)}</div>${(ui.lines||[]).filter(Boolean).map(l=>`<div class="cc-line">${esc(l)}</div>`).join('')}${ui.undone?'<div class="cc-state">Undone</div>':''}</div>${ui.undo&&!ui.undone?`<button class="btn bts bsm" onclick="coachReceiptUndo(${ti},${ri})">Undo</button>`:''}</div>`;
        else if(ui.type==='proposal')html+=coachCardHTML(ui,ti,ri);
        else if(ui.type==='link')html+=`<div class="cm cm-a"><button class="btn bts bsm" onclick="coachOpen(${jsq(ui.screen)})">Open ${esc(COACH_SCREENS[ui.screen]||'')} ›</button></div>`;
      });
    }
  });
  if(Coach.busy)html+=`<div class="cm cm-a"><div class="coach-busy"><span class="ai-spin"></span><span>${esc(Coach.status||'Thinking…')}</span><button class="btn bts bxs" onclick="coachStop()">Stop</button></div></div>`;
  else if(Coach.error)html+=`<div class="coach-err"><div>${esc(Coach.error)}</div><div class="frow" style="margin-top:8px"><button class="btn bts bsm" onclick="coachRetry()">Try again</button><button class="btn bts bsm" onclick="showAiSettings()">AI settings</button></div></div>`;
  return html;
}
const COACH_STARTERS=[
  {id:'quick',icon:'⚡',title:'Quick workout',sub:'Something to do right now'},
  {id:'program',icon:'🏗',title:'Build a program',sub:'Routines for your week'},
  {id:'mealplan',icon:'🍽',title:'Plan my meals',sub:'A week that hits your targets'},
  {id:'logmeal',icon:'📸',title:'Log a meal',sub:'From a photo or a description'},
  {id:'review',icon:'📊',title:'Review my week',sub:'Training, food and weight'},
  {id:'stall',icon:'🧗',title:'Why am I stuck?',sub:'Find stalled lifts and fix them'},
  {id:'targets',icon:'🎯',title:'Check my targets',sub:'Calories and macros vs. my trend'},
  {id:'import',icon:'📥',title:'Import a program',sub:'From a photo, PDF or pasted text'},
];
function coachStartersHTML(compact){
  return`<div class="coach-starters${compact?' compact':''}">${COACH_STARTERS.map(s=>`<button class="coach-st" onclick="coachStart(${jsq(s.id)})"><span class="cst-i">${s.icon}</span><span class="cst-t">${s.title}</span>${compact?'':`<span class="cst-s">${s.sub}</span>`}</button>`).join('')}</div>`;
}
function coachEmptyHTML(){
  const p=aiProvider();
  return`<div class="coach-hello">
    <div class="coach-hello-t">What do you want to work on?</div>
    <div class="coach-hello-s">Ask anything about your training, food or progress — or pick one of these. The coach can look things up in your data and make changes for you.</div>
    ${coachStartersHTML(false)}
    <div class="coach-fine">Sent to ${esc(AI_PROVIDERS[p].company)} with your own key: your messages, attachments, and only the data shown in a “Read” line. <a onclick="showCoachRules()">How the coach works</a></div>
  </div>`;
}
function coachSetupHTML(){
  return`<div class="coach-hello">
    <div class="coach-hello-i">✨</div>
    <div class="coach-hello-t">Meet your coach</div>
    <div class="coach-hello-s">An AI coach that can read your workouts, food and progress and act on them: build routines and programs, plan a week of meals, give you a workout for right now, log a meal from a photo, review your week, and tell you why a lift has stalled.</div>
    <div class="ai-note" style="text-align:left;margin-top:14px">
      <div style="font-weight:600;color:var(--text);margin-bottom:4px">It runs on your own AI account</div>
      Choose Claude, ChatGPT, Gemini, OpenRouter or your own server, and paste an API key from that account. The key is stored on this device only, is never included in backups, and is sent only to that company. Usage is billed to you by them: usually a few cents a question on a mid-size model and less on a small one. The token count is shown under every answer.
    </div>
    <button class="btn btp bfw" style="margin-top:4px" onclick="showAiSettings()">Set up the coach</button>
    <button class="btn btg bfw" style="margin-top:6px" onclick="showCoachRules()">How the coach works</button>
  </div>`;
}
function renderCoach(c){
  coachLoad();
  const nav=document.getElementById('nav');
  if(nav&&nav.offsetHeight)document.documentElement.style.setProperty('--navh',nav.offsetHeight+'px');
  const ready=aiReady();const p=aiProvider();
  c.innerHTML=`<div class="coach">
    <div class="ph coach-head"><div class="page-title">Coach</div><div class="coach-head-r">
      ${ready?`<button class="btn bts bsm coach-model" onclick="showAiSettings()" aria-label="AI settings">${esc(AI_PROVIDERS[p].label)} · ${esc(aiModelFor(p).split('/').pop().replace(/^(claude|gemini)-/,'').slice(0,16))}</button>`:''}
      ${Coach.turns.length?`<button class="btn bts bsm" onclick="coachNewChat()">New</button>`:''}
      <button class="btn bts bsm" onclick="showCoachRules()" aria-label="How the coach works">?</button>
    </div></div>
    <div id="coach-thread" onscroll="coachOnScroll(this)"></div>
    ${ready?`<div id="coach-bar">
      <div id="coach-attach"></div>
      <div class="coach-row">
        <button class="ib" onclick="document.getElementById('coach-file').click()" aria-label="Attach a photo or file">📎</button>
        <input type="file" id="coach-file" accept="image/*,application/pdf,.pdf,.txt,.md,.csv" multiple style="display:none" onchange="coachAddFiles(this)">
        <textarea id="coach-in" rows="1" maxlength="12000" placeholder="Ask your coach…" oninput="coachGrow(this)" onkeydown="coachKey(event)"></textarea>
        <button class="btn btp coach-send" id="coach-send" onclick="coachSendBox()" aria-label="Send">↑</button>
      </div>
    </div>`:''}
  </div>`;
  coachPaint();
}
function coachOnScroll(el){Coach.stick=el.scrollHeight-el.scrollTop-el.clientHeight<60;}
// Redraw the conversation only (the message box keeps whatever is being typed).
function coachPaint(){
  if(S.tab!=='coach')return;
  const el=document.getElementById('coach-thread');if(!el)return;
  if(!aiReady()){el.innerHTML=coachSetupHTML();return;}
  const empty=!Coach.turns.length&&!Coach.busy;
  el.innerHTML=empty?coachEmptyHTML():coachThreadHTML();
  if(empty)el.scrollTop=0;else if(Coach.stick!==false)el.scrollTop=el.scrollHeight;
  const send=document.getElementById('coach-send');if(send)send.disabled=Coach.busy;
  coachRenderAttachments();
}
function coachLeave(){Coach.pending=null;document.body.classList.remove('kb-open');const app=document.getElementById('app');if(app)app.style.height='';}
function coachGrow(ta){ta.style.height='auto';ta.style.height=Math.min(140,ta.scrollHeight)+'px';}
function coachKey(ev){
  // Enter sends on a keyboard; on a phone the return key makes a new line and the button sends.
  if(ev.key==='Enter'&&!ev.shiftKey&&!ev.isComposing&&window.matchMedia&&window.matchMedia('(pointer:fine)').matches){ev.preventDefault();coachSendBox();}
}
function coachSendBox(){
  const ta=document.getElementById('coach-in');if(!ta)return;
  if(coachSend(ta.value)){ta.value='';coachGrow(ta);}
}
async function coachAddFiles(inp){
  const files=[...(inp.files||[])];inp.value='';
  const r=await aiReadFiles(files,Coach.attachments.length);
  Coach.attachments.push(...r.attachments);
  if(r.text){const ta=document.getElementById('coach-in');if(ta){ta.value=(ta.value?ta.value+'\n\n':'')+r.text.slice(0,11000);coachGrow(ta);}}
  if(r.notes.length)toast(r.notes[0]);
  coachRenderAttachments();
}
function coachRemoveAttachment(i){Coach.attachments.splice(i,1);coachRenderAttachments();}
function coachRenderAttachments(){
  const el=document.getElementById('coach-attach');if(!el)return;
  el.innerHTML=Coach.attachments.map((a,i)=>`<span class="ai-chip">${a.kind==='pdf'?'📄':'🖼'} ${esc(String(a.name||'file').slice(0,22))}<button onclick="coachRemoveAttachment(${i})" aria-label="Remove attachment">✕</button></span>`).join('');
}
// Keep the message box above the on-screen keyboard.
function coachViewportSync(){
  const vv=window.visualViewport;const app=document.getElementById('app');if(!vv||!app)return;
  const kb=S.tab==='coach'&&window.innerHeight-vv.height>140;
  document.body.classList.toggle('kb-open',kb);
  app.style.height=kb?Math.round(vv.height)+'px':'';
  if(kb){try{window.scrollTo(0,0);}catch(e){}const el=document.getElementById('coach-thread');if(el)el.scrollTop=el.scrollHeight;}
}

// ─── Cards ───
function coachUi(ti,ri){const t=Coach.turns[ti];const r=t&&t.role==='tool'?t.results[ri]:null;return r&&r.ui?r.ui:null;}
function coachCardApply(ti,ri,opt,extra){
  const ui=coachUi(ti,ri);if(!ui||ui.type!=='proposal'||ui.status!=='pending')return;
  const opts=Object.assign({},extra||{});if(opt==='save')opts.save=true;
  let res;
  try{res=coachApplyProposal(ui.kind,ui.args,opts);}catch(e){logError(e,'coach apply');res={error:errText(e)};}
  if(res.error){toast(res.error,'red',{ms:4500});return;}
  ui.status='applied';ui.message=res.message||'Applied';ui.go=res.go||null;
  coachNoteEvent(`The user applied your proposal "${ui.title}" (${ui.message}).`);
  coachPersist();
  if(res.started){go('workout');startWtTimer();toast('Workout started','green');return;}
  coachPaint();
  const undo=res.restore?{action:'Undo',onAction:()=>{try{res.restore();}catch(e){logError(e,'coach undo');}ui.status='dismissed';coachNoteEvent(`The user undid "${ui.title}".`);coachPersist();coachPaint();}}:
    res.undo?{action:'Undo',onAction:()=>{coachUndo(res.undo);ui.status='dismissed';coachNoteEvent(`The user undid "${ui.title}".`);coachPersist();coachPaint();}}:undefined;
  toast(ui.message,'green',undo);
}
function coachCardDismiss(ti,ri){
  const ui=coachUi(ti,ri);if(!ui||ui.type!=='proposal'||ui.status!=='pending')return;
  ui.status='dismissed';coachNoteEvent(`The user dismissed your proposal "${ui.title}" without applying it.`);
  coachPersist();coachPaint();
}
function coachReceiptUndo(ti,ri){
  const ui=coachUi(ti,ri);if(!ui||ui.type!=='receipt'||ui.undone||!ui.undo)return;
  if(coachUndo(ui.undo)){ui.undone=true;coachNoteEvent(`The user undid "${ui.title}".`);toast('Undone','green');}
  else{ui.undone=true;toast('That was already removed');}
  coachPersist();coachPaint();
}
function coachReviewRoutines(ti,ri){
  const ui=coachUi(ti,ri);if(!ui||ui.status!=='pending')return;
  let parsed;try{parsed=parseImport(aiToImport(ui.args));}catch(e){parsed={error:errText(e)};}
  if(parsed.error){toast(parsed.error,'red');return;}
  const ov=makeOv('coach-rv-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div class="mt">Review</div>
    ${ui.summary?`<div class="ai-note">${esc(ui.summary)}</div>`:''}
    <div style="font-size:11px;color:var(--muted);margin-bottom:6px">Tap a routine to check its exercises. Nothing is saved until you add it.</div>
    ${importPreviewHTML(parsed)}
    <button class="btn btp bfw" style="margin-top:12px" onclick="coachConfirmRoutines(${ti},${ri})">Add to my library</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('coach-rv-ov')">Not yet</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  const rep=document.getElementById('imp-replace');if(rep&&ui.args&&ui.args.replace_existing)rep.checked=true;
}
function coachConfirmRoutines(ti,ri){
  const opts=importOptsFromDOM();closeOv('coach-rv-ov');
  coachCardApply(ti,ri,null,opts);
}
function coachReviewPlan(ti,ri){
  const ui=coachUi(ti,ri);if(!ui)return;
  const b=coachBuildPlan(ui.args||{});const g=S.macroGoals;
  const ov=makeOv('coach-rv-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div class="mt">Proposed meal plan</div>
    ${ui.summary?`<div class="ai-note">${esc(ui.summary)}</div>`:''}
    ${PLAN_ORDER.filter(d=>b.days[d]).map(d=>{const t=planDayTotals(b.days[d]);return`<div style="font-size:14px;font-weight:700;margin:12px 0 6px">${PLAN_DAYS[d]} <span style="font-size:11px;font-weight:500;color:var(--muted)">${t.cals} of ${g.cals} kcal · P${fmt1(t.protein)}g</span></div>
      ${planSortMeals(b.days[d]).map(m=>{const mt=planMealTotals(m);return`<div class="plan-meal"><div style="display:flex;gap:8px"><div style="flex:1;min-width:0"><div class="plan-type">${esc(m.type)}</div><div class="plan-name">${esc(m.name||'Meal')}</div></div><div class="mono" style="font-size:12px;font-weight:600;color:var(--navy)">${mt.cals} kcal</div></div>
        ${m.items.map(planItemHTML).join('')}</div>`;}).join('')||'<div style="font-size:12px;color:var(--muted)">Nothing planned.</div>'}`;}).join('')}
    ${ui.status==='pending'?`<button class="btn btp bfw" style="margin-top:14px" onclick="closeOv('coach-rv-ov');coachCardApply(${ti},${ri})">Use this plan</button>`:''}
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('coach-rv-ov')">Close</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function coachOpen(screen){
  const lib=t=>{S.libTab=t;go('library');};
  if(screen==='meal_plan'){go('nutrition');showMealPlan();}
  else if(screen==='grocery_list'){go('nutrition');showGroceryList();}
  else if(screen==='targets'){go('nutrition');showMacroGoals();}
  else if(screen==='library_routines')lib('routines');
  else if(screen==='library_groups')lib('groups');
  else if(screen==='library_exercises')lib('exercises');
  else if(screen==='settings')showSettings();
  else if(screen==='ai_settings')showAiSettings();
  else if(TABS.includes(screen))go(screen);
}

// ─── Starters, wizards and shortcuts from the rest of the app ───
const COACH_WIZ={
  quick:{title:'Quick workout',go:'Build it',fields:[
      {id:'time',label:'How long?',opts:['20 minutes','30 minutes','45 minutes','60 minutes'],dflt:1},
      {id:'focus',label:'Focus',opts:['Coach picks','Full body','Upper body','Lower body','Push','Pull','Core','Conditioning'],dflt:0},
      {id:'eq',label:'Equipment',opts:['My usual setup','Bodyweight only','Dumbbells only'],dflt:0}],
    hint:'Anything else? e.g. sore shoulder, hotel gym, no jumping',
    build:v=>`Give me a ${v.time.replace(' minutes','-minute')} workout I can start right now. Focus: ${v.focus==='Coach picks'?'you choose, based on what I have trained recently':v.focus}. Equipment: ${v.eq==='My usual setup'?'my usual setup':v.eq.toLowerCase()}.${v.note?' '+v.note:''}`},
  program:{title:'Build a program',go:'Build it',fields:[
      {id:'days',label:'Days per week',opts:['2','3','4','5','6'],dflt:2},
      {id:'time',label:'Session length',opts:['30 min','45 min','60 min','75 min','90 min'],dflt:2},
      {id:'aim',label:'Main aim',opts:['Use my goal','Strength','Build muscle','Lose fat','General fitness','Fitness test'],dflt:0},
      {id:'exp',label:'Experience',opts:['New to lifting','1–3 years','3+ years'],dflt:1}],
    hint:'Anything else? e.g. bad knee, want more back work, only mornings',
    build:v=>`Build me a ${v.days}-day-a-week program with sessions of about ${v.time}. Aim: ${v.aim==='Use my goal'?'my goal in the app':v.aim.toLowerCase()}. Experience: ${v.exp.toLowerCase()}.${v.note?' '+v.note:''}`},
  mealplan:{title:'Plan my meals',go:'Plan it',fields:[
      {id:'meals',label:'Meals a day',opts:['3','4','5'],dflt:1},
      {id:'style',label:'Variety',opts:['Keep it simple — repeat meals','Some variety','A different day every day'],dflt:0},
      {id:'cook',label:'Cooking',opts:['As little as possible','Batch cook twice a week','Happy to cook daily'],dflt:1}],
    hint:'Foods you love, hate or cannot eat; budget; anything else',
    build:v=>`Plan a week of meals that hits my calorie and macro targets. ${v.meals} meals a day. Variety: ${v.style.toLowerCase()}. Cooking: ${v.cook.toLowerCase()}.${v.note?' '+v.note:''}`},
};
function coachStart(id,arg){
  coachLoad();
  if(S.tab!=='coach')go('coach');
  if(!aiReady()){Coach.pending={start:id,arg};return;}
  if(COACH_WIZ[id]){showCoachWizard(id);return;}
  const say=t=>{coachSend(t);};
  const draft=t=>{const ta=document.getElementById('coach-in');if(ta){ta.value=t;coachGrow(ta);ta.focus();}};
  if(id==='logmeal'){draft('I ate: ');toast('Type what you ate, or tap 📎 to add a photo of the plate or the label');}
  else if(id==='import'){draft('Turn this program into routines: ');toast('Paste the program, or tap 📎 to attach a photo or PDF');}
  else if(id==='review')say('Review my last week: training, food and body weight. Tell me what went well, what did not, and the one thing to change.');
  else if(id==='stall')say('Look at my lifts. Which ones have stalled, why do you think so, and what should I change?');
  else if(id==='targets')say('Are my calorie and macro targets right for my goal? Check them against my weight trend and what I have actually been eating.');
  else if(id==='mealplan-adjust')draft('Change my meal plan: ');
  else if(id==='exercise'&&arg)say(`How is my ${arg} going? Look at its history and tell me what to do next.`);
  else if(id==='debrief')say('I just finished a workout. Look at it and give me a short debrief: how it compares with last time and what to do next session.');
  else if(id==='routine'&&arg)draft(`About my routine "${arg}": `);
  else if(id==='ask')draft('');
}
function showCoachWizard(id){
  const w=COACH_WIZ[id];if(!w)return;
  window._wiz={id,vals:{}};w.fields.forEach(f=>{window._wiz.vals[f.id]=f.opts[f.dflt||0];});
  const ov=makeOv('wiz-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div class="mt">${w.title}</div>
    ${w.fields.map(f=>`<div class="fg"><label class="fl">${f.label}</label><div class="wiz-opts" id="wiz-${f.id}">${f.opts.map((o,i)=>`<button class="chip${i===(f.dflt||0)?' on':''}" onclick="coachWizPick(${jsq(f.id)},${i})">${esc(o)}</button>`).join('')}</div></div>`).join('')}
    <div class="fg"><label class="fl">Notes (optional)</label><input type="text" id="wiz-note" maxlength="300" placeholder="${esc(w.hint)}"></div>
    <button class="btn btp bfw" onclick="coachWizGo()">${w.go}</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('wiz-ov')">Cancel</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function coachWizPick(fid,i){
  const z=window._wiz;if(!z)return;const f=COACH_WIZ[z.id].fields.find(x=>x.id===fid);if(!f)return;
  z.vals[fid]=f.opts[i];
  document.querySelectorAll(`#wiz-${fid} .chip`).forEach((c,k)=>c.classList.toggle('on',k===i));
}
function coachWizGo(){
  const z=window._wiz;if(!z)return;
  const v=Object.assign({},z.vals,{note:(document.getElementById('wiz-note')?.value||'').replace(/\s+/g,' ').trim().slice(0,300)});
  closeOv('wiz-ov');window._wiz=null;
  coachSend(COACH_WIZ[z.id].build(v));
}
// Run whatever was waiting for a key to be set up.
function coachAfterSetup(){
  const p=Coach.pending;Coach.pending=null;
  if(S.tab==='coach')render();
  if(!p||!aiReady())return;
  if(p.text)coachSend(p.text);else if(p.start)coachStart(p.start,p.arg);
}

// ─── How the coach works ───
function showCoachRules(){
  const p=aiProvider();
  const ov=makeOv('rules-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div class="mt">How the coach works</div>
    <div class="ai-note"><b style="color:var(--text)">Always sent with a chat:</b> today's date and time, your weight unit, goal and equipment setting, the names of your routines and active group, whether you have a meal plan, whether a workout is open, these two permission settings, and your coach notes. Nothing else unless the coach looks it up — each lookup appears as a “Read” line in the chat.<br><br>
      <b style="color:var(--text)">Where it goes:</b> straight from this device to ${esc(AI_PROVIDERS[p].company)} (${esc(aiWhere(p))}), using your own key. There is no Lah We server. Their privacy terms apply to what you send.<br><br>
      <b style="color:var(--text)">Log access is ${S.ai.logAccess?'on':'off'}.</b> ${S.ai.logAccess?'The coach may read your workouts, food log, body weight, activities and records when a question needs them.':'The coach cannot read your workouts, food log, body weight, activities or records.'} Change this in AI settings.</div>
    ${COACH_RULES.map(g=>`<div class="rule"><div class="rule-t">${esc(g.title)}</div><div class="rule-u">${esc(g.user)}</div>
      <details><summary>Exact instructions given to the AI</summary>${g.model.map(m=>`<div class="rule-m">${esc(m)}</div>`).join('')}</details></div>`).join('')}
    <div class="rule"><div class="rule-t">What it can do (${coachTools().length} tools)</div>
      <details><summary>Read</summary>${coachTools().filter(t=>t.kind==='read').map(t=>`<div class="rule-m"><b>${esc(t.name)}</b> — ${esc(t.description)}</div>`).join('')}</details>
      <details><summary>Do at once, with Undo</summary>${coachWriteTools().map(t=>`<div class="rule-m"><b>${esc(t.name)}</b> — ${esc(t.description)}</div>`).join('')}</details>
      <details><summary>Propose for you to approve</summary>${coachProposalTools().map(t=>`<div class="rule-m"><b>${esc(t.name)}</b> — ${esc(t.description)}</div>`).join('')}</details></div>
    <div style="font-size:11px;color:var(--muted);line-height:1.5;margin:10px 0">An AI can be confidently wrong. The app checks every change it tries to make — ids, dates, calorie arithmetic, safe ranges — but its advice is advice. It is not medical care.</div>
    <button class="btn bts bfw" onclick="closeOv('rules-ov');showAiSettings()">AI settings</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('rules-ov')">Close</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}

// ─── AI settings sheet (Settings → AI coach) ───
const _aiModelCache={};let _aiTestState=null;
function showAiSettings(){
  const ov=makeOv('ai-set-ov');
  ov.innerHTML=`<div class="modal" style="max-height:95vh"><div class="mh"></div><div class="mt">AI coach</div><div id="ai-set-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  _aiTestState=null;
  renderAiSettings();
}
function renderAiSettings(){
  const el=document.getElementById('ai-set-body');if(!el)return;
  const modal=el.closest('.modal');const sc=modal?modal.scrollTop:0;
  const p=aiProvider();const def=AI_PROVIDERS[p];const key=getAiKey(p);const model=aiModelFor(p);
  const tog=(on,fn,label)=>`<button class="tog${on?' on':''}" onclick="${fn}" role="switch" aria-checked="${on?'true':'false'}" aria-label="${label}"></button>`;
  const known=[...def.models,...(_aiModelCache[p]||[])];const seen=new Set();
  const opts=known.filter(m=>!seen.has(m.id)&&seen.add(m.id));
  if(model&&!seen.has(model))opts.unshift({id:model,label:model});
  const t=_aiTestState;
  el.innerHTML=`
    <div style="font-size:12px;color:var(--muted);line-height:1.5;margin:-6px 0 12px">Connect the AI account you want the coach to use. <b style="color:var(--text)">You use your own key</b> — the app has none of its own, and nobody else's key is ever used.</div>
    <label class="fl">Provider</label>
    <div class="prov-grid">${AI_PROVIDER_IDS.map(id=>`<button class="prov${id===p?' on':''}" onclick="aiSetProvider(${jsq(id)})"><b>${esc(AI_PROVIDERS[id].label)}</b><span>${id==='custom'?(getCustomUrl()?'set up':'your server'):(getAiKey(id)?'key saved':esc(AI_PROVIDERS[id].blurb||AI_PROVIDERS[id].company))}</span></button>`).join('')}</div>

    ${p==='custom'?`<div class="fg" style="margin-top:12px"><label class="fl">Server address</label>
      <div class="frow"><input type="url" id="ai-url" value="${esc(getCustomUrl())}" placeholder="https://api.example.com/v1" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" style="flex:1"><button class="btn bts bsm" id="ai-url-save" onclick="aiSaveUrlFromSheet()">Save</button></div>
      <div style="font-size:11px;color:var(--muted);margin-top:5px;line-height:1.45">Any server that speaks the OpenAI chat-completions format with tool calling (${esc(def.keyWhere)}). It must allow requests from web pages (CORS).</div></div>`:''}

    <div class="fg" style="margin-top:12px"><label class="fl">${esc(def.label)} API key${p==='custom'?' (optional)':''}</label>
      ${key?`<div class="frow set-row" style="margin-bottom:0"><span class="set-lbl mono">Saved on this device ${esc(maskKey(key))}</span><button class="btn bts bsm" onclick="aiRemoveKeyFromSheet()">Remove</button></div>`
        :`<div class="frow"><input type="text" class="key-in" id="ai-key" name="lahwe-not-a-login" placeholder="${esc(def.keyHint)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-1p-ignore data-lpignore="true" data-form-type="other" style="flex:1"><button class="btn btp bsm" id="ai-key-save" onclick="aiSaveKeyFromSheet()">Save key</button></div>`}
      <div style="font-size:11px;color:var(--muted);margin-top:5px;line-height:1.45">${p==='custom'?'Sent only to the address above.':`Get one at ${esc(def.keyWhere)}. Sent only to ${esc(def.host)}.`} Stored on this device, never in a backup, never shared.</div></div>

    <div class="fg"><label class="fl">Model</label>
      ${opts.length?`<select id="ai-model" onchange="aiPickModel(this.value)">${opts.map(m=>`<option value="${esc(m.id)}"${m.id===model?' selected':''}>${esc(m.label||m.id)}</option>`).join('')}<option value="__other">Type a model name…</option></select>`:''}
      ${opts.length?`<div class="mono" style="font-size:11px;color:var(--muted);margin-top:5px">${esc(model)}</div>`:''}
      <div class="frow" id="ai-model-other" style="margin-top:7px;${opts.length?'display:none':''}"><input type="text" id="ai-model-id" value="${opts.length?'':esc(model)}" placeholder="model id, e.g. ${esc((def.models[0]||{id:'llama3.1'}).id)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" style="flex:1"><button class="btn bts bsm" id="ai-model-use" onclick="aiSaveCustomModel()">Use</button></div>
      <div class="frow" style="margin-top:8px"><button class="btn bts bsm bfw" onclick="aiLoadModels()"${aiReady(p)?'':' disabled'} id="ai-load">List my models</button><button class="btn bts bsm bfw" onclick="aiRunTest()"${aiReady(p)?'':' disabled'} id="ai-test">Test connection</button></div>
      <div id="ai-test-out">${t?`<div class="${t.ok?'ai-ok':'import-warn'}">${esc(t.msg)}</div>`:''}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.45">The coach needs a model that can call tools. Every step of an answer sends about 7,000 tokens of rules and tool descriptions plus whatever it reads, so smaller models cost far less — but they make more mistakes with programs and meal plans.</div></div>

    <div class="set-sec">
      <label class="fl">What the coach may do</label>
      <div class="frow set-row"><span class="set-lbl">Read my logs when a question needs them<br><small>Workouts, food log, body weight, activities, records. Every read is shown in the chat.</small></span>${tog(S.ai.logAccess,"aiToggle('logAccess')",'Log access')}</div>
      <div class="frow set-row"><span class="set-lbl">Apply small changes at once<br><small>Logging a meal, weigh-in or activity, saving a note — with Undo. Off: everything waits for a tap. Routines, plans, targets and deleting always wait.</small></span>${tog(S.ai.instant,"aiToggle('instant')",'Instant small changes')}</div>
    </div>

    <div class="set-sec">
      <label class="fl">Coach notes (${S.coachNotes.length}/${COACH_MAX_NOTES})</label>
      <div style="font-size:11px;color:var(--muted);line-height:1.45;margin-bottom:8px">Things the coach should always keep in mind: injuries, equipment you lack, foods you avoid. Sent with every chat. Tell the coach “remember that…” or add one here.</div>
      ${S.coachNotes.map(n=>`<div class="note-row"><span>${esc(n.text)}</span><button class="ib delbtn" onclick="coachRemoveNote(${jsq(n.id)})" aria-label="Remove note">✕</button></div>`).join('')}
      <div class="frow" style="margin-top:6px"><input type="text" id="note-new" maxlength="${COACH_NOTE_LEN}" placeholder="e.g. Left shoulder: no barbell overhead pressing" style="flex:1"><button class="btn bts bsm" onclick="coachAddNote()">Add</button></div>
    </div>

    <div class="set-sec">
      <label class="fl">Chat</label>
      <div style="font-size:11px;color:var(--muted);line-height:1.45;margin-bottom:8px">The conversation is kept on this device only and is not part of backups.</div>
      <div class="frow"><button class="btn bts bsm bfw" onclick="showCoachRules()">How the coach works</button><button class="btn bts bsm bfw" onclick="coachNewChat();toast('Chat cleared')">Clear chat</button></div>
    </div>
    <button class="btn btg bfw" style="margin-top:12px" onclick="closeOv('ai-set-ov');coachAfterSetup()">Done</button>`;
  if(modal){modal.style.animation='none';modal.scrollTop=sc;}
}
function aiSheetChanged(){_aiTestState=null;renderAiSettings();refreshSettings();if(S.tab==='coach')render();}
function aiSetProvider(p){if(!AI_PROVIDERS[p])return;S.ai.provider=p;save();aiSheetChanged();}
function aiSaveKeyFromSheet(){
  const p=aiProvider();const v=document.getElementById('ai-key')?.value||'';
  const why=setAiKey(p,v);
  if(why&&!getAiKey(p)){toast(why,'red',{ms:5000});return;}
  toast(why||'Key saved on this device','green');aiSheetChanged();
}
function aiRemoveKeyFromSheet(){clearAiKey(aiProvider());_aiTestState=null;toast('Key removed from this device');renderAiSettings();if(S.tab==='coach')render();}
function aiSaveUrlFromSheet(){
  const why=setCustomUrl(document.getElementById('ai-url')?.value||'');
  if(why){toast(why,'red',{ms:5000});return;}
  toast('Server address saved','green');aiSheetChanged();
}
function aiPickModel(v){
  if(v==='__other'){const row=document.getElementById('ai-model-other');if(row){row.style.display='flex';document.getElementById('ai-model-id')?.focus();}return;}
  if(setAiModel(aiProvider(),v)){aiSheetChanged();}
}
function aiSaveCustomModel(){
  const v=(document.getElementById('ai-model-id')?.value||'').trim();
  if(!setAiModel(aiProvider(),v)){toast('That is not a valid model name');return;}
  aiSheetChanged();
}
async function aiLoadModels(){
  const p=aiProvider();const b=document.getElementById('ai-load');if(b){b.disabled=true;b.textContent='Loading…';}
  try{
    const list=await aiListModels(p);
    _aiModelCache[p]=list;_aiTestState={ok:true,msg:list.length?`${list.length} models available to this key — pick one above.`:'The provider returned no models for this key.'};
  }catch(e){_aiTestState={ok:false,msg:scrubKeys(errText(e))};}
  renderAiSettings();
}
async function aiRunTest(){
  const p=aiProvider();const b=document.getElementById('ai-test');if(b){b.disabled=true;b.textContent='Testing…';}
  try{
    const r=await aiTest(p);
    _aiTestState={ok:true,msg:`Working. ${r.model} answered in ${(r.ms/1000).toFixed(1)} s${r.reply?` (“${r.reply}”)`:''}.`};
  }catch(e){_aiTestState={ok:false,msg:scrubKeys(errText(e))};}
  renderAiSettings();
}
function aiToggle(k){if(k!=='logAccess'&&k!=='instant')return;S.ai[k]=!S.ai[k];save();renderAiSettings();}
function coachAddNote(){
  const text=(document.getElementById('note-new')?.value||'').replace(/\s+/g,' ').trim().slice(0,COACH_NOTE_LEN);
  if(text.length<3){toast('Write the note first');return;}
  if(S.coachNotes.length>=COACH_MAX_NOTES){toast(`Up to ${COACH_MAX_NOTES} notes`);return;}
  S.coachNotes.push({id:uid(),text,at:Date.now()});save();renderAiSettings();
}
function coachRemoveNote(id){
  const i=S.coachNotes.findIndex(n=>n.id===id);if(i<0)return;
  const gone=S.coachNotes.splice(i,1)[0];save();renderAiSettings();
  toast('Note removed','',{action:'Undo',onAction:()=>{S.coachNotes.splice(Math.min(i,S.coachNotes.length),0,gone);save();renderAiSettings();}});
}
