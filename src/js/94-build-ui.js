// ═══════════════════════════════════════════════════
// BUILDERS — the sheets: one form with everything filled in, then a review you can change
// ═══════════════════════════════════════════════════
// Open from the Coach tab (no key needed), Home, Library, the meal plan, Week in review and Habits.
// Nothing is saved until a button on the review says so. The AI coach appears only as an option to
// adjust a finished result, and only when it has been set up.

// The Coach tab's buttons. builtin: runs on the app; the rest need the AI coach.
const BLD_STARTS={
  quick:{icon:'⚡',title:'Quick workout',sub:'Something to do right now',open:()=>showBuilder('quick')},
  program:{icon:'🏗',title:'Build a program',sub:'Workouts for your week',open:()=>showBuilder('program')},
  stall:{icon:'🧗',title:'Why am I stuck?',sub:'Stalled lifts and what to change',open:()=>showStuck()},
  targets:{icon:'🎯',title:'Check my targets',sub:'Calories and macros for your goal',open:()=>showBldTargets()},
  mealplan:{icon:'🍽',title:'Plan my meals',sub:'A week from the meals you eat',open:()=>showBuilder('meals')},
  review:{icon:'📊',title:'Review my week',sub:'Training, food and weight',open:()=>showWeekReview()},
  habits:{icon:'repeat',title:'Habits & happiness',sub:'What goes with better days',open:()=>showBldHabits()},
};
const BLD_AI_STARTS=[
  {id:'logmeal',icon:'camera',title:'Log a meal',sub:'From a photo or a description'},
  {id:'import',icon:'📥',title:'Import a program',sub:'From a photo, PDF or pasted text'},
];
function bldStart(id){const s=BLD_STARTS[id];if(!s)return false;s.open();return true;}
function coachStartersHTML(compact){
  const tile=(js,s)=>`<button class="coach-st" onclick="${js}"><span class="cst-i">${ICON(s.icon,19)}</span><span class="cst-t">${s.title}</span>${compact?'':`<span class="cst-s">${s.sub}</span>`}</button>`;
  const built=`<div class="coach-starters${compact?' compact':''}">${Object.keys(BLD_STARTS).map(id=>tile(`bldStart(${jsq(id)})`,BLD_STARTS[id])).join('')}</div>`;
  if(!aiReady())return built;
  return`${compact?'':'<div class="bld-sh">Built in · no AI, no cost</div>'}${built}
    ${compact?'':'<div class="bld-sh">With the AI coach</div>'}<div class="coach-starters${compact?' compact':''}">${BLD_AI_STARTS.map(s=>tile(`coachStart(${jsq(s.id)})`,s)).join('')}</div>`;
}
// The Coach tab without a key: the builders work, and the AI coach is offered underneath.
function coachSetupHTML(){
  return`<div class="coach-hello">
    <div class="coach-hello-t">What do you want to work on?</div>
    <div class="coach-hello-s">These run on the app itself, from your own data: no account, no cost.</div>
    ${coachStartersHTML(false)}
    <div class="note-box bld-ai-card">
      <div class="bld-ai-t">${ICON('spark',16)} The AI coach</div>
      Ask anything about your training, food or progress, log a meal from a photo, or bring in a program from a PDF. It runs on your own AI account (Claude, ChatGPT, Gemini and others): you paste a key, it stays on this phone, and that company bills you a few cents a question.
      <div class="bld-ai-acts"><button class="btn btp bsm" onclick="showAiSettings()">Set up the coach</button><button class="btn bts bsm" onclick="showCoachRules()">How it works</button></div>
    </div>
  </div>`;
}

// ─── Shared bits ───
// The sheet is made once and slides up once. Every later paint swaps only what is inside it, so a
// tap on an answer does not replay the slide-up or jump to the top. keep: stay where you are scrolled
// (an answer changed, a lift swapped); otherwise a new view starts at the top.
function bldOv(){
  let ov=document.getElementById('bld-ov');
  if(ov&&ov.style.pointerEvents==='none'){ov.remove();ov=null;} // still sliding away from a close a moment ago
  if(!ov){ov=makeOv('bld-ov');ov._onDismiss=()=>{window._bld=null;};
    ov.innerHTML='<div class="modal bld-modal" style="max-height:94vh"><div class="mh"></div><div class="bld-body"></div></div>';
    document.body.appendChild(ov);attachSwipeDown(ov);}
  return ov;
}
function bldPaint(inner,keep){
  const ov=bldOv();const m=ov.querySelector('.bld-modal');const body=m&&m.querySelector('.bld-body');
  if(!body){ov.innerHTML=`<div class="modal bld-modal" style="max-height:94vh"><div class="mh"></div><div class="bld-body">${inner}</div></div>`;return;}
  const y=m.scrollTop;body.innerHTML=inner;m.scrollTop=keep?y:0;
}
function bldSeg(key,opts,cur){return`<div class="seg seg-in bld-seg" role="radiogroup">${opts.map(([v,l])=>`<button class="seg-b${String(v)===String(cur)?' on':''}" role="radio" aria-checked="${String(v)===String(cur)}" onclick="bldSet(${jsq(key)},${jsq(String(v))})">${l}</button>`).join('')}</div>`;}
function bldChips(key,opts,cur,multi){
  const on=v=>multi?(cur||[]).includes(v):String(cur)===String(v);
  return`<div class="wiz-opts bld-chips">${opts.map(([v,l])=>`<button class="chip${on(v)?' on':''}" aria-pressed="${on(v)}" onclick="bldSet(${jsq(key)},${jsq(String(v))},${multi?'true':'false'})">${l}</button>`).join('')}</div>`;
}
function bldQ(label,body,hint){return`<div class="bld-q"><div class="bld-ql">${label}</div>${body}${hint?`<div class="fine bld-hint">${hint}</div>`:''}</div>`;}
// One answer changed: a single choice, or a multi-select toggled. Numbers stay numbers.
function bldSet(key,v,multi){
  const z=window._bld;if(!z)return;
  const num=/^\d+$/.test(v)?parseInt(v):v;
  if(multi){
    const list=(z.ans[key]||[]).slice();const i=list.indexOf(num);if(i>=0)list.splice(i,1);else list.push(num);
    // "You pick" and a specific focus do not go together: choosing one clears the other.
    if(key==='focus'){if(num==='auto')z.ans.focus=list.includes('auto')?['auto']:[];else z.ans.focus=list.filter(x=>x!=='auto');if(!z.ans.focus.length)z.ans.focus=['auto'];}
    else z.ans[key]=list;
  }else z.ans[key]=num;
  bldForm(true);
}
function bldEqOpts(){
  const cur=(EQUIPMENT_PRESETS.find(p=>p.id===(S.equipPreset||'full'))||EQUIPMENT_PRESETS[0]).label;
  return[['usual',`My setup (${cur})`],...EQUIPMENT_PRESETS.filter(p=>p.id!==S.equipPreset).map(p=>[p.id,p.label])];
}
function bldExRow(e,js,extra){
  const tgt=e.dist?`${e.sets} × ${e.r} m`:e.timed?`${e.sets} × ${e.r}${e.x?`–${e.x}`:''} s`:e.amrap?`${e.sets} × max`:`${e.sets} × ${e.r}${e.x?`–${e.x}`:''}`;
  const tag=e.pinned?'<span class="pill pill-acc">Kept</span>':e.picked?'<span class="pill">Your pick</span>':/^New/.test(e.why)?'<span class="pill pill-new">New</span>':'';
  return`<button class="row row-tap bld-ex" onclick="${js}">${e.link?`<span class="bld-link">${esc(e.link)}</span>`:''}<span class="row-main"><span class="row-t">${esc(e.name)}${tag}</span><span class="row-s">${esc(tgt)} · ${e.rest}s rest · ${esc(e.why)}</span></span>${extra||`<span class="row-chev">${ICON('swap',15)}</span>`}</button>`;
}
// The AI coach, offered on a finished result only when it is set up.
function bldAskHTML(kind,label){
  if(!aiReady())return'';
  return`<div class="bld-ask"><div class="bld-ql">${label||'Want something changed?'}</div>
    <div class="frow"><input type="text" id="bld-ask-in" maxlength="300" placeholder="${kind==='meals'?'e.g. no fish, cheaper lunches':'e.g. no barbell rows, more glute work'}" enterkeyhint="send" autocomplete="off" onkeydown="if(event.key==='Enter'&&!event.isComposing){event.preventDefault();bldAsk();}" style="flex:1"><button class="btn bts bsm" onclick="bldAsk()">${ICON('spark',14)} Ask coach</button></div>
    <div class="fine">Sends this draft and your note to your AI coach, which edits it rather than starting over.</div></div>`;
}
function bldAsk(){
  const z=window._bld;if(!z||!z.res)return;
  const inp=document.getElementById('bld-ask-in');const want=String(inp&&inp.value||'').replace(/\s+/g,' ').trim();
  if(!want){toast('Say what you want changed');if(inp)inp.focus();return;}
  const draft=bldDraftText(z);const groups=z.kind==='meals'?['meals']:z.kind==='stall'?[]:['build'];
  const lead={program:'Adjust the program the app drafted (it is in the app note, with exercise ids). Propose the full program again with propose_routines.',
    quick:'Adjust the workout the app drafted (in the app note, with exercise ids). Propose it again with propose_quick_workout.',
    meals:'Adjust the meal plan the app drafted (in the app note). Propose the changed days with propose_meal_plan.',
    stall:'The app looked at my stalled lifts (its findings are in the app note).'}[z.kind]||'';
  try{inp&&inp.blur();}catch(e){}
  if(Coach.busy){toast('The coach is still answering. Wait for it, or tap Stop, then try again');return;}
  closeOv('bld-ov');if(S.tab!=='coach')go('coach');
  if(!coachSend(`${lead} ${want}`.trim(),{groups,note:draft}))toast('Not sent. Try again from the Coach tab');
}
// A compact text of the draft for the coach: names with ids, so it can propose changes exactly.
function bldDraftText(z){
  const ex=e=>`${e.name} [${e.exId}] ${e.sets}x${e.dist?e.r+'m':e.r+(e.x?'-'+e.x:'')+(e.timed?'s':'')}${e.amrap?' AMRAP':''} rest ${e.rest}s${e.link?' superset '+e.link:''}`;
  if(z.kind==='program'){const p=z.res;return`Program draft (not saved): ${p.split}, ${p.days.length} days a week, ${p.a.weeks?`${p.a.weeks} weeks${p.a.deload?' with a deload last week':''}`:'no set length'}, aim ${bldAimLabel(p.a.aim)}${p.a.emph.length?', emphasis '+p.a.emph.join('/'):''}${p.a.avoid.length?', avoid '+p.a.avoid.join('/'):''}, about ${p.a.minutes} min a session. `+
    p.days.map(d=>`${d.name}: ${d.ex.map(ex).join('; ')}`).join(' | ');}
  if(z.kind==='quick'){const q=z.res;return`Workout draft (not saved): ${q.name}. ${q.ex.map(ex).join('; ')}`;}
  if(z.kind==='meals'){const p=z.res;return`Meal plan draft (not saved): `+PLAN_ORDER.map(d=>`${PLAN_SHORT[d]}: ${(p.days[d]||[]).map(m=>`${m.type} ${m.items.map(i=>`${fmtAmt(i.qty)}× ${i.name}${i.foodId?` [${i.foodId}]`:''}`).join(', ')}`).join('; ')||'fast'}`).join(' | ').slice(0,3800);}
  if(z.kind==='stall'){return z.res.text||'';}
  return'';
}

// ─── The builder sheet (program, quick workout, meals) ───
function showBuilder(kind,ans){
  if(kind==='program'){
    const top=Object.entries(exUsage()).sort((a,b)=>b[1].n-a[1].n).slice(0,8).map(([id])=>id).filter(id=>getEx(id));
    window._bld={kind,ans:Object.assign({days:Math.min(6,Math.max(2,inferDaysPerWeek()||4)),minutes:60,aim:bldAimFromGoal(),emph:[],avoid:bldPainAvoid(),keep:[],mix:'mix',weeks:8,deload:true,eq:'usual',seed:0},ans||{}),top,painPrefill:bldPainAvoid()};
  }else if(kind==='quick')window._bld={kind,ans:Object.assign({minutes:30,focus:['auto'],eq:'usual',mix:'familiar',seed:0},ans||{})};
  else if(kind==='meals')window._bld={kind,ans:Object.assign({meals:4,variety:'some',seed:0},ans||{})};
  else return;
  bldForm();
}
function bldForm(keep){
  const z=window._bld;if(!z)return;const a=z.ans;z.res=null;
  let h='';
  if(z.kind==='program'){
    const muscles=Object.keys(MEV_MAV).map(m=>[m,m==='Lats'?'Back (lats)':m]);
    const keepOpts=[...new Set([...z.top,...a.keep])].map(id=>[id,exName(id)]);
    h=`<div class="mt">Build a program</div><div class="sheet-sub">Made from your exercise list and what you have trained. Nothing is saved until you choose.</div>
      ${bldQ('Days a week',bldSeg('days',[[2,'2'],[3,'3'],[4,'4'],[5,'5'],[6,'6']],a.days))}
      ${bldQ('Minutes a session',bldSeg('minutes',[[30,'30'],[45,'45'],[60,'60'],[75,'75'],[90,'90']],a.minutes))}
      ${bldQ('Main aim',bldChips('aim',BLD_AIMS.map(x=>[x.id,x.label]),a.aim))}
      ${bldQ('What do you want to hit?',bldChips('emph',muscles,a.emph,true),a.emph.length?'These get the most weekly sets.':'Leave blank for a balanced program.')}
      ${bldQ('Steer around',bldChips('avoid',BLD_AVOID.map(x=>[x.id,x.label]),a.avoid,true),z.painPrefill.length?'Pre-selected from lifts you tagged with pain.':'')}
      ${bldQ('Lifts to keep',`${keepOpts.length?bldChips('keep',keepOpts,a.keep,true):''}<button class="btn bts bsm bld-more" onclick="bldKeepPicker()">${ICON('search',14)} Find another</button>`,'Lifts you pick here go in no matter what.')}
      ${bldQ('Exercises',bldSeg('mix',BLD_MIX.map(x=>[x.id,x.label]),a.mix),{familiar:'Mostly lifts you already do.',mix:'Your main lifts, with some accessories you have not done.',new:'Mostly lifts you have not done.'}[a.mix])}
      ${bldQ('Length',bldSeg('weeks',BLD_WEEKS.map(w=>[w,w?`${w} wk`:'Open']),a.weeks),a.weeks?'Saved as a program you can follow week by week.':'Saved as a split you repeat.')}
      ${a.weeks?`<div class="frow set-row bld-tog"><span class="set-lbl">Deload the last week<small>Half the sets at the same weights, to recover before the next block.</small></span>${setTog(a.deload,'bldTog(\'deload\')','Deload the last week')}</div>`:''}
      ${bldQ('Equipment',bldChips('eq',bldEqOpts(),a.eq))}
      <button class="btn btp bfw bld-go" onclick="bldBuild()">Build it</button>`;
  }else if(z.kind==='quick'){
    h=`<div class="mt">Quick workout</div><div class="sheet-sub">Picked from what has recovered and what you know. Start it or save it.</div>
      ${bldQ('How long?',bldSeg('minutes',[[20,'20 min'],[30,'30'],[45,'45'],[60,'60']],a.minutes))}
      ${bldQ('Focus',bldChips('focus',BLD_QUICK_FOCUS.map(x=>[x.id,x.label]),a.focus,true),a.focus.includes('auto')?'The app picks from recovery and what is behind this week.':'Pick one or several; main lifts go first.')}
      ${bldQ('Equipment',bldChips('eq',bldEqOpts(),a.eq))}
      ${bldQ('Exercises',bldSeg('mix',BLD_MIX.map(x=>[x.id,x.label]),a.mix))}
      <button class="btn btp bfw bld-go" onclick="bldBuild()">Build it</button>`;
  }else if(z.kind==='meals'){
    const n=(S.meals||[]).filter(m=>m.date>=daysAgoStr(60)).length;
    h=`<div class="mt">Plan my meals</div><div class="sheet-sub">A week made from ${n?`the meals you have logged and saved, scaled`:'basic staples until you have logged some meals, scaled'} to land on each day’s targets.</div>
      ${bldQ('Meals a day',bldSeg('meals',[[3,'3'],[4,'4'],[5,'5']],a.meals))}
      ${bldQ('Variety',bldChips('variety',BLD_VARIETY.map(x=>[x.id,x.label]),a.variety))}
      <button class="btn btp bfw bld-go" onclick="bldBuild()">Build it</button>`;
  }
  bldPaint(h,keep);
}
function bldTog(k){const z=window._bld;if(!z)return;z.ans[k]=!z.ans[k];bldForm(true);}
function bldKeepPicker(){
  const ov=makeOv('bldkeep-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div><div class="mt">Keep a lift</div>
    <div class="lib-search"><span class="lib-search-ic">${ICON('search',17)}</span><input id="bldkeep-q" type="search" placeholder="Search exercises" oninput="ixPickList('bldkeep-list',this.value,'bldKeepAdd(%ID%)')" autocomplete="off"></div>
    <div id="bldkeep-list"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);ixPickList('bldkeep-list','','bldKeepAdd(%ID%)');
}
function bldKeepAdd(id){const z=window._bld;if(!z)return;if(!z.ans.keep.includes(id))z.ans.keep.push(id);closeOv('bldkeep-ov');bldForm(true);}
function bldBuild(){
  const z=window._bld;if(!z)return;
  try{z.res=z.kind==='program'?bldProgram(z.ans):z.kind==='quick'?bldQuick(z.ans):bldMealPlan(z.ans);}
  catch(e){logError(e,'builder '+z.kind);toast('That could not be built. Try different answers','red');return;}
  bldReview();
}
function bldShuffle(){const z=window._bld;if(!z)return;z.ans.seed=(z.ans.seed||0)+1;bldBuild();}

// ─── Reviews ───
function bldReview(keep){
  const z=window._bld;if(!z||!z.res)return;
  if(z.kind==='program')bldProgramReview(keep);else if(z.kind==='quick')bldQuickReview(keep);else bldMealsReview(keep);
}
function bldNotes(list){return list&&list.length?list.map(n=>`<div class="note-box">${esc(n)}</div>`).join(''):'';}
function bldProgramReview(keep){
  const z=window._bld;const p=z.res;const a=p.a;
  const avg=Math.round(p.days.reduce((t,d)=>t+d.min,0)/p.days.length);
  const emph=new Set(a.emph);
  const show=[...new Set([...BLD_MAJOR,...a.emph])].filter(m=>MEV_MAV[m]);
  const bars=show.map(m=>{const r=MEV_MAV[m];const v=p.weekly[m]||0;const max=Math.max(r.mav*1.15,v);
    const tone=v<r.mev?' mus-low':v>r.mav?' mus-high':'';
    return`<div class="mus-r${emph.has(m)?' bld-emph':''}"><span class="mus-n">${esc(m)}</span><span class="mus-t"><i class="mus-band" style="left:${r.mev/max*100}%;width:${(r.mav-r.mev)/max*100}%"></i><i class="mus-f${tone}" style="width:${Math.min(100,v/max*100)}%"></i></span><span class="mus-v">${fmtSets(v)}</span></div>`;}).join('');
  bldPaint(`<div class="mt">${esc(a.weeks?`${bldAimLabel(a.aim)} · ${p.split}`:p.split)}</div>
    <div class="sheet-sub">${p.days.length} days a week · about ${avg} min · ${a.weeks?`${a.weeks} weeks${a.deload?', last one a deload':''}`:'repeat as long as you like'}. Tap a lift to change it.</div>
    ${bldNotes(p.notes)}
    ${p.days.map((d,di)=>`<div class="sec-h sec-h-act"><span>${esc(d.name)}</span><span class="fine" style="margin:0">about ${d.min} min</span></div>
      <div class="list">${d.ex.map((e,ei)=>bldExRow(e,`bldSwapSheet(${di},${ei})`)).join('')}</div>`).join('')}
    <div class="sec-h">Hard sets a week</div><div class="mus bld-mus">${bars}<div class="mus-key">The shaded band is the useful weekly range. ${a.emph.length?'Bold: what you asked to hit.':''}</div></div>
    <div class="sheet-acts bld-acts">
      <button class="btn btp bfw" onclick="bldSaveProgram(true)">${a.weeks?'Start this program':'Use this split'}</button>
      <button class="btn bts bfw" onclick="bldSaveProgram(false)">Save to Library</button>
      <div class="frow bld-row2"><button class="btn bts" onclick="bldShuffle()">${ICON('repeat',14)} Shuffle picks</button><button class="btn bts" onclick="bldForm()">Change answers</button></div>
    </div>
    ${bldAskHTML('program')}`,keep);
}
function bldSwapSheet(di,ei){
  const z=window._bld;if(!z||!z.res)return;
  const e=z.kind==='program'?z.res.days[di].ex[ei]:z.res.ex[ei];if(!e)return;
  const list=z.kind==='program'?bldSwapList(z.res,di,ei):bldSwapList({a:Object.assign({avoid:[]},z.res.a),days:[{ex:z.res.ex}]},0,ei);
  const ov=makeOv('bldswap-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div><div class="mt" style="margin-bottom:2px">${esc(e.name)}</div>
    <div class="sheet-sub">Swap it for one of these. Same movement first, then what you know.</div>
    ${list.length?`<div class="list">${list.map(c=>`<button class="row row-tap" onclick="bldSwapPick(${di},${ei},${jsq(c.ex.id)})"><span class="row-main"><span class="row-t">${esc(c.ex.name)}</span><span class="row-s">${esc(swapWhy(c))}</span></span></button>`).join('')}</div>`:'<div class="ch-empty">Nothing close fits your equipment and what you are avoiding.</div>'}
    <div class="sec-h">Or any exercise</div>
    <div class="lib-search"><span class="lib-search-ic">${ICON('search',17)}</span><input type="search" placeholder="Search exercises" oninput="ixPickList('bldswap-any',this.value,${jsq(`bldSwapPick(${di},${ei},%ID%)`)},${jsq(e.exId)})" autocomplete="off"></div>
    <div id="bldswap-any"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function bldSwapPick(di,ei,id){
  const z=window._bld;if(!z||!z.res)return;
  if(z.kind==='program')bldReplace(z.res,di,ei,id);
  else{const tmp={a:z.res.a,days:[{ex:z.res.ex}]};bldReplace(tmp,0,ei,id);z.res.min=bldEstMin(z.res.ex);}
  closeOv('bldswap-ov');bldReview(true);
}
function bldSaveProgram(start){
  const z=window._bld;if(!z||!z.res)return;const p=z.res;
  let parsed;try{parsed=parseImport(bldProgramImport(p));}catch(e){parsed={error:errText(e)};}
  if(parsed.error){toast(parsed.error,'red');return;}
  const timed=!!p.a.weeks;
  const res=commitImport(parsed,{program:timed,start:timed&&start,activate:!timed&&start,programName:parsed.program&&parsed.program.name});
  closeOv('bld-ov');
  S.libTab='groups';go('library');
  toast(timed?(start?'Program started':'Program saved to Library'):(start?'Split saved and in use':'Split saved to Library'),'green');
  return res;
}
function bldQuickReview(keep){
  const z=window._bld;const q=z.res;
  const open=!!S.activeWorkout;
  bldPaint(`<div class="mt">${esc(q.name)}</div>
    <div class="sheet-sub">About ${q.min} min · ${q.ex.length} exercise${q.ex.length===1?'':'s'}. Tap one to change it.</div>
    ${q.why?`<div class="note-box">${esc(q.why)}</div>`:''}${bldNotes(q.warn)}
    <div class="list" style="margin-top:12px">${q.ex.map((e,ei)=>bldExRow(e,`bldSwapSheet(0,${ei})`)).join('')}</div>
    ${q.ex.some(e=>e.link)?'<div class="fine">Lifts with the same letter are done back to back, as a circuit.</div>':''}
    <div class="sheet-acts bld-acts">
      ${open?'<div class="note-box">You have a workout open. Finish or discard it to start this one; you can save this one now.</div>':`<button class="btn btp bfw" onclick="bldQuickGo(true)">Start now</button>`}
      <button class="btn bts bfw" onclick="bldQuickGo(false)">Save as a workout</button>
      <div class="frow bld-row2"><button class="btn bts" onclick="bldShuffle()">${ICON('repeat',14)} Shuffle picks</button><button class="btn bts" onclick="bldForm()">Change answers</button></div>
    </div>
    ${bldAskHTML('quick')}`,keep);
}
function bldQuickGo(start){
  const z=window._bld;if(!z||!z.res)return;
  const parsed=parseImport(bldQuickImport(z.res));if(parsed.error){toast(parsed.error,'red');return;}
  if(start){
    if(S.activeWorkout){toast('Finish or discard the workout you have open first');return;}
    if(!startAdhocWorkout(parsed)){toast('That workout could not be started','red');return;}
    closeOv('bld-ov');go('workout');return;
  }
  parsed.routines[0].name=bldUniqueName(parsed.routines[0].name);
  commitImport(parsed,{});closeOv('bld-ov');S.libTab='routines';go('library');toast('Saved to your workouts','green');
}
function bldMealsReview(keep){
  const z=window._bld;const p=z.res;const has=planHasMeals();
  const rows=p.report.map(r=>{
    const meals=p.days[r.dow]||[];
    const head=`<span class="row-main"><span class="row-t">${PLAN_DAYS[r.dow]}${r.fast==='full'?' · fast':r.fast?' · light day':''}</span><span class="row-s">${r.fast==='full'?'No meals planned':`${r.tot.cals.toLocaleString()} of ${Math.round(r.t.cals).toLocaleString()} kcal · ${Math.round(r.tot.protein)} g protein`}</span></span>${r.fast==='full'?'':`<span class="pill ${r.ok?'pill-good':'pill-warn'}">${r.ok?'On target':'Off'}</span>`}`;
    return meals.length?`<details class="fold bld-day"><summary class="row">${head}</summary><div class="bld-meals">${meals.map(m=>`<div class="bld-meal"><b>${esc(m.type)}</b> · ${esc(m.name)} · ${planMealTotals(m).cals} kcal<div class="fine" style="margin:2px 0 0">${m.items.map(i=>`${fmtAmt(i.qty)} × ${esc(i.serving?`${i.serving} `:'')}${esc(i.name)}`).join(', ')}</div></div>`).join('')}</div></details>`:`<div class="row">${head}</div>`;
  }).join('');
  bldPaint(`<div class="mt">Your week of meals</div>
    <div class="sheet-sub">${p.a.meals} meals a day · ${esc((BLD_VARIETY.find(v=>v.id===p.a.variety)||{}).label||'')}. Tap a day to see it.</div>
    ${bldNotes(p.notes)}
    <div class="list" style="margin-top:12px">${rows}</div>
    <div class="sheet-acts bld-acts">
      <button class="btn btp bfw" onclick="bldMealsGo()">${has?'Replace my meal plan':'Use this plan'}</button>
      ${has?'<div class="fine" style="margin-top:0">Your current plan is replaced. You can undo it right after.</div>':''}
      <div class="frow bld-row2"><button class="btn bts" onclick="bldShuffle()">${ICON('repeat',14)} Shuffle</button><button class="btn bts" onclick="bldForm()">Change answers</button></div>
    </div>
    ${bldAskHTML('meals','Want something changed?')}`,keep);
}
function bldMealsGo(){
  const z=window._bld;if(!z||!z.res)return;
  const undo=bldApplyMealPlan(z.res);closeOv('bld-ov');go('nutrition');
  setTimeout(()=>{showMealPlan();toast('Meal plan ready','green',{action:'Undo',onAction:()=>{undo();closeOv('plan-ov');go('nutrition');}});},240);
}

// ─── Why am I stuck ───
function showStuck(){
  const st=bldStalled();const body=bldBodyFindings();
  const lifts=st.stalled.map(s=>Object.assign({},s,{d:bldDiagnose(s,body)}));
  window._bld={kind:'stall',ans:{},res:{lifts,body,st}};
  window._bld.res.text=`Stalled: ${lifts.map(l=>`${l.name} (est. max ${l.now}${l.down?', falling':''}): ${l.d.findings.map(f=>f.t).join('; ')}`).join(' | ')}${body.length?` | Across all lifts: ${body.map(f=>f.t).join('; ')}`:''}`;
  const tone={bad:'bad',warn:'warn',info:'info'};
  const finding=f=>`<div class="row bld-find"><span class="row-ic tone-${tone[f.tone]||'info'}">${ICON(f.tone==='bad'?'bandage':f.tone==='warn'?'alert':'bulb',15)}</span><span class="row-main"><span class="row-t">${esc(f.t)}</span>${f.s?`<span class="row-s">${esc(f.s)}</span>`:''}</span></div>`;
  const FIX={backoff:'Back off 10% next time',addset:'Add a set',dropset:'Drop a set',swap:'Swap it'};
  let h=`<div class="mt">Why am I stuck?</div>`;
  if(st.enough<1){
    h+=`<div class="sheet-sub">A lift needs four or more sessions before the app can tell whether it has stalled. Keep logging and check back.</div>`;
  }else{
    h+=`<div class="sheet-sub">${lifts.length?`${lifts.length} lift${lifts.length===1?' has':'s have'} not moved over the last three sessions. Here is what your log says about why.`:'Nothing has stalled: every lift you have done four or more times is still moving.'}</div>`;
    if(body.length)h+=`<div class="sec-h">Across all your lifts</div><div class="list">${body.map(finding).join('')}</div>`;
    lifts.forEach((l,li)=>{
      h+=`<div class="sec-h sec-h-act"><span>${esc(l.name)}</span><span class="fine" style="margin:0">est. max ${fmt1(l.now)} ${S.unit}${l.down?' · falling':''}</span></div>
        <div class="list">${l.d.findings.map(finding).join('')}</div>
        ${l.d.fixes.length?`<div class="bld-fixes">${l.d.fixes.map(f=>`<button class="btn bts bsm" onclick="bldFix(${li},${jsq(f)})">${FIX[f]}</button>`).join('')}</div>`:'<div class="fine">Not in any of your active workouts, so there is nothing to change from here.</div>'}`;
    });
    if(st.moving.length)h+=`<div class="sec-h">Still climbing</div><div class="list">${st.moving.map(m=>`<div class="row"><span class="row-main"><span class="row-t">${esc(m.name)}</span></span><span class="pill pill-good">+${fmt1(m.pct)}%</span></div>`).join('')}</div><div class="fine">Estimated max over the last six weeks.</div>`;
  }
  h+=bldAskHTML('stall','Ask the coach about it');
  bldPaint(h);
}
function bldFix(li,f){
  const z=window._bld;const l=z&&z.res&&z.res.lifts[li];if(!l)return;
  if(f==='swap'){bldStuckSwap(li);return;}
  const undo=f==='backoff'?bldFixBackoff(l.exId):bldFixSets(l.exId,f==='addset'?1:-1);
  if(!undo){toast('Nothing to change');return;}
  const msg={backoff:`Next ${l.name}: about 10% lighter. It shows on Targets.`,addset:`One more set of ${l.name} in your workouts`,dropset:`One set fewer of ${l.name} in your workouts`}[f];
  toast(msg,'green',{action:'Undo',onAction:()=>{undo();toast('Undone');}});
}
function bldStuckSwap(li){
  const z=window._bld;const l=z&&z.res&&z.res.lifts[li];if(!l)return;
  const list=swapCandidates(l.exId,{limit:8});
  const ov=makeOv('bldswap-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div><div class="mt" style="margin-bottom:2px">Swap ${esc(l.name)}</div>
    <div class="sheet-sub">In every active workout that has it. Your history for ${esc(l.name)} stays.</div>
    ${list.length?`<div class="list">${list.map(c=>`<button class="row row-tap" onclick="bldStuckSwapPick(${li},${jsq(c.ex.id)})"><span class="row-main"><span class="row-t">${esc(c.ex.name)}</span><span class="row-s">${esc(swapWhy(c))}</span></span></button>`).join('')}</div>`:'<div class="ch-empty">Nothing close fits your equipment.</div>'}</div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function bldStuckSwapPick(li,id){
  const z=window._bld;const l=z&&z.res&&z.res.lifts[li];if(!l)return;
  const undo=bldFixSwap(l.exId,id);closeOv('bldswap-ov');
  if(!undo){toast('Nothing to change');return;}
  toast(`${exName(id)} replaces ${l.name}`,'green',{action:'Undo',onAction:()=>{undo();toast('Undone');}});
}

// ─── Targets ───
function showBldTargets(dir,keep){
  const t=bldTargets(dir);window._bld={kind:'targets',ans:{dir:t.dir},res:t};
  const v=maintenanceVerdict();const c=t.current;
  const row=(lbl,a,b,u)=>`<div class="row bld-tgt"><span class="row-main"><span class="row-t">${lbl}</span></span><span class="bld-tgt-v"><s>${Math.round(a||0).toLocaleString()}</s> ${ICON('chev',12)} <b>${Math.round(b).toLocaleString()}</b> ${u}</span></div>`;
  bldPaint(`<div class="mt">Check my targets</div>
    ${v?`<div class="note-box bld-verdict tone-${esc(v.tone||'info')}">${esc(v.text)}</div>`:''}
    ${bldQ('Your weight should',bldSeg('dir',BLD_DIRS.map(x=>[x.id,x.label]),t.dir).replace(/bldSet\(/g,'bldTargetsDir('))}
    <div class="sec-h">${t.same?'Your targets already fit':'Suggested'}</div>
    <div class="list">${row('Calories',c.cals,t.kcal,'kcal')}${row('Protein',c.protein,t.protein,'g')}${row('Carbs',c.carbs,t.carbs,'g')}${row('Fat',c.fat,t.fat,'g')}
      ${t.rest?row('Rest-day calories',t.currentRest.cals,t.rest.cals,'kcal'):''}</div>
    <div class="fine">${t.why.map(esc).join('<br>')}</div>
    <div class="sheet-acts bld-acts">
      ${t.same?'':`<button class="btn btp bfw" onclick="bldTargetsGo()">Use these targets</button>`}
      <button class="btn bts bfw" onclick="closeOv('bld-ov');setTimeout(showMacroGoals,230)">Set them by hand</button>
    </div>`,keep);
}
function bldTargetsDir(_k,v){showBldTargets(v,true);}
function bldTargetsGo(){
  const z=window._bld;if(!z||!z.res)return;
  const undo=bldApplyTargets(z.res);closeOv('bld-ov');
  if(S.tab==='nutrition')rerender();
  toast('Targets updated','green',{action:'Undo',onAction:()=>{undo();if(S.tab==='nutrition')rerender();toast('Undone');}});
}

// ─── Habits & happiness ───
function bldHabitIdeas(){
  const out=[];const hs=activeHabits();const has=k=>hs.some(h=>h.type==='auto'&&h.auto===k);
  hs.forEach(h=>{const st=habitStats(h);
    if(st.n28>=8&&st.pct!=null&&st.pct<40)out.push({kind:'rethink',t:`Rethink “${h.type==='auto'?habitAutoName(h):h.name}”`,s:`Kept on ${st.pct}% of its days over 4 weeks. A smaller version, or fewer days, tends to stick better.`});});
  const sl=[];for(let i=1;i<=14;i++){const v=(S.sleepLog||{})[daysAgoStr(i)];if(v>0)sl.push(v);}
  if(!has('sleep')&&sl.length>=5&&sl.reduce((a,b)=>a+b,0)/sl.length<7)out.push({kind:'add',auto:'sleep',t:'Add “Slept 7 h+”',s:`You average ${fmt1(sl.reduce((a,b)=>a+b,0)/sl.length)} h. It ticks itself from the check-in.`});
  let fd=0,hit=0;for(let i=1;i<=14;i++){const ds=daysAgoStr(i);const t=getDayTotals(ds);if(t.cals>0){fd++;if(t.protein>=(goalsFor(ds).protein||Infinity))hit++;}}
  if(!has('protein')&&fd>=7&&hit/fd<0.6)out.push({kind:'add',auto:'protein',t:'Add “Hit protein”',s:`You reached your protein target on ${hit} of ${fd} logged days. It ticks itself from your food log.`});
  const steps=Object.keys(S.stepsLog||{}).filter(d=>d>=daysAgoStr(14)).length;
  if(!has('steps')&&steps>=7)out.push({kind:'add',auto:'steps',t:'Add a steps habit',s:'You already log steps; this ticks itself when you reach 10,000.'});
  return out.slice(0,4);
}
function showBldHabits(keep){
  window._bld={kind:'habits',ans:{},res:{}};
  let res=null;try{res=patterns();}catch(e){}
  const pick=r=>r.test.fam==='habits'||r.test.fam==='happiness';
  const found=res?res.found.filter(pick):[],early=res?res.early.filter(pick):[],more=res?res.more.filter(pick):[];
  const ideas=bldHabitIdeas();const hs=activeHabits();
  const tierPill=r=>`<span class="pill ${r.tier==='solid'?'pill-good':r.tier==='likely'?'pill-acc':''}">${{solid:'Solid',likely:'Likely',early:'Early'}[r.tier]||''}</span>`;
  const pRow=r=>`<button class="row row-tap pat-row" onclick="closeOv('bld-ov');setTimeout(()=>showPattern(${jsq(r.test.id)}),230)"><span class="row-main"><span class="row-t">${esc(r.t)}</span><span class="row-s">${r.n} cases</span></span>${tierPill(r)}</button>`;
  const days=Object.keys(S.moodLog||{}).length;
  let h=`<div class="mt">Habits &amp; happiness</div>
    <div class="sheet-sub">What your own log says about your habits and your mood. A link is shown only when it holds up across your history, and it says “tends to”, never “causes”.</div>`;
  if(!hs.length)h+=`<div class="note-box">You have no habits yet. Add one or two to start seeing which ones go with better days.</div>`;
  if(!moodAsked()||days<10)h+=`<div class="note-box">${moodAsked()?`${days?`${days} day${days===1?'':'s'} of mood so far`:'No mood ratings yet'}. Links need about ten days on each side, so keep rating your mood in the morning check-in.`:'Mood is switched off in the check-in, so habits cannot be tested against it. Turn it on in Settings → Check-in & tracking.'}</div>`;
  if(found.length)h+=`<div class="sec-h">Found</div><div class="list">${found.map(pRow).join('')}</div>`;
  if(early.length)h+=`<div class="sec-h">Early signs · not reliable yet</div><div class="list">${early.slice(0,5).map(pRow).join('')}</div>`;
  if(!found.length&&!early.length&&res&&hs.length)h+=`<div class="note-box">Nothing found yet${more.length?`: ${more.length} test${more.length===1?' needs':'s need'} more days`:''}. That is normal in the first few weeks.</div>`;
  if(ideas.length)h+=`<div class="sec-h">Suggestions</div><div class="list">${ideas.map(i=>`<div class="row"><span class="row-main"><span class="row-t">${esc(i.t)}</span><span class="row-s">${esc(i.s)}</span></span>${i.kind==='add'&&hs.length<HABIT_MAX?`<button class="btn bts bsm" onclick="bldAddAutoHabit(${jsq(i.auto)})">Add</button>`:''}</div>`).join('')}</div>`;
  h+=`<div class="sheet-acts bld-acts"><button class="btn bts bfw" onclick="closeOv('bld-ov');setTimeout(()=>${hs.length?'showHabitsSheet()':'showAddHabit()'},230)">${hs.length?'Open Habits':'Add a habit'}</button>
    ${aiReady()?`<button class="btn bts bfw" onclick="closeOv('bld-ov');coachStart('habits-ai')">${ICON('spark',14)} Ask the coach</button>`:''}</div>`;
  bldPaint(h,keep);
}
function bldAddAutoHabit(auto){
  const h=coachHabitFrom({kind:'auto',auto});if(h.error){toast(h.error,'red');return;}
  const made=habitCreate(h);if(!made){toast(`There are already ${HABIT_MAX} habits`);return;}
  toast(`Added “${made.name||habitAutoName(made)}”`,'green',{action:'Undo',onAction:()=>{S.habits=S.habits.filter(x=>x.id!==made.id);save();habitsRefresh();showBldHabits(true);}});
  showBldHabits(true);
}
