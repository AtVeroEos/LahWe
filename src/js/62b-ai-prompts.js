// ═══════════════════════════════════════════════════
// PROMPTS FOR A CHAT ASSISTANT · copy a prompt, paste back what it returns
// ═══════════════════════════════════════════════════
// Settings → Your data → "Prompts for an assistant". Each prompt makes any chat assistant answer in the
// exact shape this app reads. The paste box works out which kind came back, shows what it would do, and
// only changes anything when you tap Add. Workout plans go through the existing program import; meal
// plans, targets and habits reuse the coach's checked proposals, so a pasted answer is held to the same
// rules as one the coach makes.
const AI_KINDS=[
  {id:'workout',label:'Workout plan',sub:'A split or multi-week program from your goal, a PDF or a screenshot',icon:'dumbbell'},
  {id:'meal_plan',label:'Meal plan',sub:'A week of meals with calories and macros',icon:'utensils'},
  {id:'targets',label:'Calorie & macro targets',sub:'Daily kcal, protein, carbs, fat and a weight goal',icon:'target'},
  {id:'habits',label:'Habits',sub:'A short list of daily habits to track',icon:'check'},
];
function aiPromptText(kind){
  const unit=S.unit==='kg'?'kg':'lb';
  if(kind==='workout')return importPromptText();
  if(kind==='meal_plan')return`Build a weekly meal plan for me as JSON for the "Lah We" app. Return ONLY the JSON object, no commentary.

{"type":"meal_plan","mode":"replace_week","note":"<one or two sentences: the idea, prep tips>",
 "days":[{"day":"Mon","meals":[{"meal":"Breakfast","name":"Greek yogurt bowl",
   "items":[{"name":"Greek yogurt, nonfat","serving":"1 cup (200 g)","servings":1,"kcal":130,"protein":23,"carbs":9,"fat":0}]}]}]}

Rules:
- "day" is Mon, Tue, Wed, Thu, Fri, Sat or Sun. Include every day I ask for; "mode" "update_days" changes only the days listed, "replace_week" makes them the whole plan.
- "meal" is exactly one of: ${MEAL_TYPES.join(', ')}. At most ${PLAN_MAX_MEALS} meals a day and ${PLAN_MAX_ITEMS} items per meal.
- Every item needs "name", "serving" (a plain size such as "1 cup" or "150 g") and kcal, protein, carbs and fat in grams PER SERVING. "servings" is how many servings I eat (default 1).
- kcal must agree with the macros (protein and carbs 4 kcal/g, fat 9 kcal/g). Do not guess wildly; use real nutrition values.
- Aim each day at my targets: ${S.macroGoals.cals||'<kcal>'} kcal, ${S.macroGoals.protein||'<protein>'} g protein, ${S.macroGoals.carbs||'<carbs>'} g carbs, ${S.macroGoals.fat||'<fat>'} g fat (change these if I tell you different ones).

About me and what I want:
`;
  if(kind==='targets')return`Work out daily calorie and macro targets for me as JSON for the "Lah We" app. Return ONLY the JSON object, no commentary.

{"type":"targets","kcal":2400,"protein_g":180,"carbs_g":250,"fat_g":70,"weight_goal":185,"weight_goal_direction":"lose","reason":"<one or two sentences: why these numbers>"}

Rules:
- Give only the fields that should change; "reason" is always required.
- Whole numbers. protein_g and carbs_g are 4 kcal per gram and fat_g is 9, and together they must come within 8% of kcal.
- weight_goal is in ${unit}. weight_goal_direction is "lose", "maintain" or "gain".
- Do not go below ${calorieFloor()} kcal a day.

About me (age, sex, height, weight, activity, goal):
`;
  if(kind==='habits'){
    const auto=Object.keys(AUTO_HABITS).filter(autoOffered);
    return`Suggest a short list of daily habits for me as JSON for the "Lah We" app. Return ONLY the JSON object, no commentary.

{"type":"habits","habits":[
 {"kind":"done","name":"Read 10 pages","days":["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]},
 {"kind":"amount","name":"Water","target":64,"unit":"oz"},
 {"kind":"avoid","name":"No alcohol"},
 {"kind":"auto","auto":"${auto[0]}"}]}

Rules:
- kind "done" = tick it; "amount" = reach a daily number (give "target" and "unit"); "avoid" = kept unless I mark a slip; "auto" = ticks itself from data the app already has (give "auto" instead of a name: ${auto.join(', ')}).
- "days" is optional (omit for every day): Sun, Mon, Tue, Wed, Thu, Fri, Sat.
- Names are short and concrete, 40 characters at most. No more than ${HABIT_MAX} habits.

What I want to work on:
`;
  }
  return'';
}
async function copyPromptText(t,msg){
  try{await navigator.clipboard.writeText(t);toast(msg||'Prompt copied','green',{ms:4000});return;}catch(e){}
  const ov=makeOv('prompt-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div class="mt">The prompt</div><div class="sheet-sub">Select all and copy it, then paste it into a chat assistant.</div><textarea class="import-ta" readonly style="min-height:50vh">${esc(t)}</textarea></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  setTimeout(()=>{const ta=ov.querySelector('textarea');if(ta){ta.focus();ta.select();}},250);
}
function copyAiPrompt(kind){
  const k=AI_KINDS.find(x=>x.id===kind);if(!k)return;
  copyPromptText(aiPromptText(kind),`${k.label} prompt copied. Paste it into a chat assistant, then paste its answer back here.`);
}
function showAiPrompts(){
  const ov=makeOv('aiprompts-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div class="mt">Prompts for an assistant</div>
    <div class="sheet-sub">Tap one to copy it, paste it into any chat assistant along with what you want, then paste the answer back with the button below. Nothing changes until you confirm.</div>
    <div class="list">${AI_KINDS.map(k=>`<button class="row row-tap" onclick="copyAiPrompt('${k.id}')"><span class="row-ic">${ICON(k.icon,17)}</span><span class="row-main"><span class="row-t">${esc(k.label)}</span><span class="row-s">${esc(k.sub)}</span></span><span class="row-chev">${ICON('clip',16)}</span></button>`).join('')}</div>
    <button class="btn btp bfw" style="margin-top:12px" onclick="showAiPaste()">Paste the answer</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
// ─── Reading what came back ───
// → {kind:'workout'|'meal_plan'|'targets'|'habits', data} | {error}
function aiParseReply(text){
  let t=String(text||'').trim();
  if(!t)return{error:'Paste the answer first.'};
  const fence=t.match(/```(?:json)?\s*([\s\S]*?)```/i);if(fence)t=fence[1].trim();
  const a=t.indexOf('{'),b=t.lastIndexOf('}');
  if(a<0||b<a)return{error:'That does not look like the JSON the prompt asks for.'};
  let o;try{o=JSON.parse(t.slice(a,b+1));}catch(e){return{error:'The JSON is cut off or has a typo ('+errText(e)+'). Ask the assistant to send it again in full.'};}
  if(!isObj(o))return{error:'Expected one JSON object.'};
  const ty=String(o.type||'').toLowerCase();
  if(ty==='meal_plan'||Array.isArray(o.days))return{kind:'meal_plan',data:o};
  if(ty==='habits'||Array.isArray(o.habits))return{kind:'habits',data:o};
  if(ty==='targets'||['kcal','protein_g','carbs_g','fat_g','weight_goal'].some(k=>o[k]!=null))return{kind:'targets',data:o};
  if(Array.isArray(o.groups)||Array.isArray(o.routines)||o.program)return{kind:'workout',data:o,text:t.slice(a,b+1)};
  return{error:'Could not tell what this is. It should be a workout plan, meal plan, targets or habits.'};
}
// What each kind would do, without doing it. → {title, lines, error?, checks:[...]}
function aiPreview(r){
  if(r.kind==='meal_plan'){const c=coachProposalTools().find(t=>t.name==='propose_meal_plan').check(r.data);return c.error?{error:c.error}:{title:c.title,lines:c.lines.concat(c.feedback.verdict?[c.feedback.verdict]:[]),note:c.summary};}
  if(r.kind==='targets'){const c=coachProposalTools().find(t=>t.name==='propose_targets').check(r.data);return c.error?{error:c.error}:{title:c.title,lines:c.lines,note:c.summary};}
  if(r.kind==='habits'){
    const list=(Array.isArray(r.data.habits)?r.data.habits:[]);
    if(!list.length)return{error:'No habits in that answer.'};
    const room=HABIT_MAX-activeHabits().length;
    const lines=[],seen=new Set();let ok=0;
    list.forEach(a=>{
      const h=isObj(a)?coachHabitFrom(a):{error:'not an object'};
      if(h.error){lines.push('Skipped: '+h.error);return;}
      const key=h.type==='auto'?'auto:'+h.auto:h.name.toLowerCase();
      if(seen.has(key)||(h.type==='auto'?activeHabits().some(x=>x.type==='auto'&&x.auto===h.auto):activeHabits().some(x=>x.name.toLowerCase()===h.name.toLowerCase()))){lines.push(`Skipped: ${h.name||AUTO_HABITS[h.auto].name()} (already there)`);return;}
      seen.add(key);
      if(ok>=room){lines.push(`Skipped: ${h.name||AUTO_HABITS[h.auto].name()} (the most is ${HABIT_MAX})`);return;}
      ok++;lines.push(`Add: ${h.name||AUTO_HABITS[h.auto].name()} · ${habitSchedText(h)}`);
    });
    return ok?{title:`${ok} habit${ok===1?'':'s'}`,lines}:{error:lines.join('; ')};
  }
  if(r.kind==='workout'){
    let p;try{p=parseImport(aiToImport(r.data)||r.data);}catch(e){return{error:'Could not read the workouts: '+errText(e)};}
    if(p.error)return{error:p.error};
    return{title:`${p.routines.length} workout${p.routines.length===1?'':'s'}`,lines:p.routines.slice(0,8).map(x=>`${x.name} — ${x.exercises.length} exercises`).concat(p.warnings&&p.warnings.length?[p.warnings.length+' note'+(p.warnings.length===1?'':'s')+' on the next screen']:[])};
  }
  return{error:'Unknown kind.'};
}
function showAiPaste(prefill){
  const ov=makeOv('aipaste-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div class="mt">Paste the answer</div>
    <div class="sheet-sub">Paste what the assistant returned: a workout plan, meal plan, targets or habits. You see what it would do before anything is added.</div>
    <textarea id="aipaste-ta" class="import-ta" placeholder='{"type":"meal_plan", …}' autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn bts bsm" onclick="aiPasteClipboard()">Paste</button></div>
    <div id="aipaste-prev"></div>
    <button class="btn btp bfw" id="aipaste-go" style="margin-top:10px;display:none" onclick="aiPasteApply()">Add</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  const ta=document.getElementById('aipaste-ta');ta.addEventListener('input',aiPastePreview);
  if(typeof prefill==='string'&&prefill){ta.value=prefill;aiPastePreview();}
}
async function aiPasteClipboard(){
  try{const t=await navigator.clipboard.readText();if(!t){toast('Clipboard is empty');return;}document.getElementById('aipaste-ta').value=t;aiPastePreview();}
  catch(e){toast('Could not read the clipboard — long-press the box and choose Paste');}
}
function aiPastePreview(){
  const ta=document.getElementById('aipaste-ta'),area=document.getElementById('aipaste-prev'),go=document.getElementById('aipaste-go');
  if(!ta||!area||!go)return;
  window._aiParsed=null;go.style.display='none';
  if(!ta.value.trim()){area.innerHTML='';return;}
  const r=aiParseReply(ta.value);
  const pv=r.error?{error:r.error}:aiPreview(r);
  if(pv.error){area.innerHTML=`<div class="fine" style="color:var(--red);margin-top:8px">${esc(pv.error)}</div>`;return;}
  window._aiParsed=r;
  const lead={meal_plan:'Replaces the meal plan days listed.',targets:'Changes your daily targets.',habits:'Adds to your habits.',workout:'Opens the program import so you can choose how to add it.'}[r.kind];
  area.innerHTML=`<div class="list" style="margin-top:8px"><div class="frow"><span class="set-lbl"><b>${esc(pv.title)}</b><small>${esc(lead)}</small></span></div>${pv.lines.map(l=>`<div class="frow"><span class="set-lbl">${esc(l)}</span></div>`).join('')}</div>${pv.note?`<div class="fine">${esc(pv.note)}</div>`:''}`;
  go.textContent=r.kind==='workout'?'Continue':'Add';go.style.display='';
}
function aiPasteApply(){
  const r=window._aiParsed;if(!r)return;
  if(r.kind==='workout'){closeOv('aipaste-ov');closeOv('aiprompts-ov');showImportUI(r.text);return;}
  let res;
  if(r.kind==='meal_plan')res=coachApplyProposal('propose_meal_plan',r.data);
  else if(r.kind==='targets')res=coachApplyProposal('propose_targets',r.data);
  else{
    let n=0;
    (Array.isArray(r.data.habits)?r.data.habits:[]).forEach(a=>{
      if(!isObj(a))return;
      const h=coachHabitFrom(a);if(h.error)return;
      if(h.type==='auto'?activeHabits().some(x=>x.type==='auto'&&x.auto===h.auto):activeHabits().some(x=>x.name.toLowerCase()===h.name.toLowerCase()))return;
      if(habitCreate(h))n++;
    });
    res=n?{ok:true,message:`Added ${n} habit${n===1?'':'s'}`}:{error:'Nothing was added.'};
  }
  if(res.error){toast(res.error,'red');return;}
  closeOv('aipaste-ov');closeOv('aiprompts-ov');toast(res.message,'green');
}
