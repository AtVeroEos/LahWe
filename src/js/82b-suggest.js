// ═══════════════════════════════════════════════════
// SUGGESTIONS & SETUP REVIEWS — so a hidden module is never forgotten
// ═══════════════════════════════════════════════════
// Home shows at most one of these cards, in this order:
//   1. intro    an install from before modules: "you can now choose what Lah We shows" (once)
//   2. review   30 and 90 days after the modules were picked: what is on and used, what is off
//   3. suggest  a hidden module your own data says would help. Rules, not AI (MOD_SUGGEST)
// Guardrails, so this never turns into nagging:
//   · at most one suggestion a week, counted from when the last one was answered
//   · nothing in the first week after the opening, and nothing during a pause
//   · "Not now" mutes that module for 90 days; "Never" mutes it for good
//   · a card stays the same card until it is answered (it does not flip to another)
const SUGGEST_GAP_DAYS=7,SUGGEST_MUTE_DAYS=90,SUGGEST_SETTLE_DAYS=7,REVIEW_DAYS=[30,90];
const DAY_MS=86400000;

// Each rule: id (a module or sub-switch, 19-modules.js) · when (true when the data says it would help;
// may return an object with words for the card) · t / s: the card.
const MOD_SUGGEST=[
  {id:'photos',when:()=>{
    // Six weeks of steady training, or the scale has moved 5 lb (2.3 kg) in eight weeks.
    const wk=new Set();(S.workouts||[]).forEach(w=>{const ds=dayOf(w.started);if(ds>=daysAgoStr(41))wk.add(weekStartOf(ds));});
    if(wk.size>=6)return{s:'Six weeks of steady training. Photos show what the scale and the numbers can’t.'};
    const b=modOn('weight')?(S.bodyweightLog||[]).filter(x=>x.date>=daysAgoStr(56)):[];
    if(b.length>=4){const d=b[0].weight-b[b.length-1].weight;if(Math.abs(d)>=(isKg()?2.3:5))return{s:`You are ${d<0?'down':'up'} ${fmt1(Math.abs(d))} ${S.unit} in eight weeks. Photos show where it went.`};}
    return false;},
    t:'Want progress photos to see the change?'},
  {id:'nutrition',when:()=>{
    // The scale has held for three weeks while you are trying to move it.
    if(!modOn('weight'))return false;
    const dir=S.weightGoalDir||(S.goal==='weightloss'?'lose':null);if(dir!=='lose'&&dir!=='gain')return false;
    const b=(S.bodyweightLog||[]).filter(x=>x.date>=daysAgoStr(20));if(b.length<6)return false;
    const avg=a=>a.reduce((t,x)=>t+x.weight,0)/a.length;
    const now=b.filter(x=>x.date>=daysAgoStr(6)),then=b.filter(x=>x.date<daysAgoStr(13));
    if(now.length<2||then.length<2)return false;
    return Math.abs(avg(now)-avg(then))<(isKg()?0.25:0.5);},
    t:'Your weight has held for three weeks',s:'Logging food shows whether it is the calories. Nutrition adds food logging and targets for training and rest days.'},
  {id:'cardio',when:()=>{
    // Runs and other cardio logged inside workouts, in three sessions this month.
    const n=(S.workouts||[]).filter(w=>dayOf(w.started)>=daysAgoStr(27)&&(w.exercises||[]).some(e=>e.cardio||(getEx(e.exId)||{}).cat==='Cardio')).length;
    return n>=3;},
    t:'You do cardio inside your workouts',s:'Cardio & runs tracks it on its own: weekly miles, best efforts and race times, and Strava import.'},
  {id:'patterns',when:()=>(S.workouts||[]).length>=PAT.MIN*2&&(S.workouts||[]).filter(w=>dayOf(w.started)>=daysAgoStr(55)).length>=12,
    t:'Enough sessions for Patterns',s:'It can now test what goes with your best sessions: rest days, time of day, food, sleep. Formulas on this phone; no AI.'},
  {id:'habits',when:()=>{
    // A few sessions rated rough or flat at Finish.
    if(!S.trackFeel)return false;
    return(S.workouts||[]).filter(w=>dayOf(w.started)>=daysAgoStr(27)&&w.feel>=1&&w.feel<=2).length>=3;},
    t:'A few rough sessions lately',s:'Habits & mood adds last night’s sleep and how each day went to the morning check-in, so you can see what the rough days have in common.'},
  {id:'weight',when:()=>{
    // Food logged most days, and no scale to check it against.
    if(!modOn('nutrition'))return false;
    let n=0;for(let i=1;i<=14;i++)if((getDayTotals(daysAgoStr(i)).cals||0)>0)n++;return n>=10;},
    t:'See whether your calories move the scale',s:'A morning weigh-in turns your food log into your real maintenance, worked out from your own numbers.'},
  {id:'aft',when:()=>{
    // Three or more of the test's events trained this month.
    const ev=new Set();(S.workouts||[]).forEach(w=>{if(dayOf(w.started)<daysAgoStr(27))return;(w.exercises||[]).forEach(e=>{const x=getEx(e.exId);if(x&&x.aft)ev.add(x.aft);});});
    return ev.size>=3;},
    t:'Training for the Army fitness test?',s:'The fitness test scores your events, plans toward a test day and counts down to it.'},
];

function suggestState(){if(!isObj(S.modSuggest))S.modSuggest={at:0,mute:{},cur:null};if(!isObj(S.modSuggest.mute))S.modSuggest.mute={};return S.modSuggest;}
function suggestMuted(id,now){const v=suggestState().mute[id];return v===-1||(v>0&&v>now);}
// The suggestion to show now, or null.
function suggestNow(){
  if(!S.onboarded||S.modIntro)return null;
  if(typeof pauseNow==='function'&&pauseNow())return null;
  const g=suggestState();const now=Date.now();
  const since=S.modSince?dayDiff(today(),S.modSince):99;if(since<SUGGEST_SETTLE_DAYS)return null;
  const ok=r=>!modOn(r.id)&&!suggestMuted(r.id,now);
  const run=r=>{try{return r.when();}catch(e){logError(e,'suggest '+r.id);return false;}};
  if(g.cur){
    const r=MOD_SUGGEST.find(x=>x.id===g.cur);
    if(r&&ok(r)){const w=run(r);if(w)return{r,w};}
    g.cur=null; // turned on elsewhere, or no longer true: it goes quietly and does not count as answered
  }
  if(now-(g.at||0)<SUGGEST_GAP_DAYS*DAY_MS)return null;
  for(const r of MOD_SUGGEST){if(!ok(r))continue;const w=run(r);if(w){g.cur=r.id;save();return{r,w};}}
  return null;
}
function suggestCardHTML(x){
  const r=x.r;const s=(isObj(x.w)&&x.w.s)||r.s;const m=modDef(r.id)||modSub(r.id).m;
  return`<div class="sg-card" role="group" aria-label="Suggestion">
    <div class="sg-top"><span class="sg-i">${ICON(m.icon,17)}</span><span class="sg-m"><b>${esc(r.t)}</b><i>${esc(s)}</i></span></div>
    <div class="sg-acts"><button class="btn btp bsm" onclick="suggestAnswer(${jsq(r.id)},'on')">Turn on ${esc(modLabel(r.id))}</button><button class="btn bts bsm" onclick="suggestAnswer(${jsq(r.id)},'later')">Not now</button><button class="btn btg bsm" onclick="suggestAnswer(${jsq(r.id)},'never')">Never</button></div>
  </div>`;
}
function suggestAnswer(id,how){
  const g=suggestState();const now=Date.now();
  g.at=now;g.cur=null;
  if(how==='later')g.mute[id]=now+SUGGEST_MUTE_DAYS*DAY_MS;
  else if(how==='never')g.mute[id]=-1;
  if(how==='on'){modTurnOn(id);toast(`${modLabel(id)} is on`,'green',{action:'Undo',onAction:()=>{modSet(id,false,{quiet:true});}});return;}
  save();render();
  toast(how==='never'?`Won’t suggest ${modLabel(id)} again. It is in Settings → What Lah We shows.`:`Won’t ask about ${modLabel(id)} for ${SUGGEST_MUTE_DAYS} days`);
}
// Turn on one part. A sub-switch whose module is off brings the module with it, showing just that part:
// a suggestion for photos is not a reason to also start asking for a weigh-in.
function modTurnOn(id){
  const sub=modSub(id);
  if(sub&&!modRaw(sub.m.id)){
    (sub.m.subs||[]).forEach(s=>{if(!s.get&&s.id!==id)modSetRaw(s.id,false);});
    modSetRaw(sub.m.id,true);
  }
  modSetRaw(id,true);
  bumpMemo();save();modChanged();
}

// ─── Setup reviews (30 and 90 days) ───
function reviewDue(){
  if(!S.onboarded||S.modIntro||!S.modSince)return null;
  const d=dayDiff(today(),S.modSince);const rv=isObj(S.modReview)?S.modReview:{};
  if(d>=90&&!rv.d90)return 90;
  if(d>=30&&d<90&&!rv.d30)return 30;
  return null;
}
function reviewCardHTML(n){
  return`<button class="home-report home-report-n" onclick="showModReview(${n})">${ICON('sliders',16)}<span><b>Your setup, ${n} days in</b><i>What you use, what you don’t, and what is off</i></span>${ICON('chev',15)}</button>`;
}
function showModReview(n){
  const ov=makeOv('mrev-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div class="mt" style="margin-bottom:2px">Your setup, ${n} days in</div>
    <div class="sheet-sub">Keep what you use. Hide what you don’t: nothing logged is deleted, and it comes back the moment you turn it on.</div><div id="mrev-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  // Opening it is the review: once closed it does not come back for this round.
  ov._onDismiss=()=>{const rv=isObj(S.modReview)?S.modReview:{};if(n>=90){rv.d90=true;rv.d30=true;}else rv.d30=true;S.modReview=rv;save();if(S.tab==='workout')render();};
  renderModReview();
}
function renderModReview(){
  const el=document.getElementById('mrev-body');if(!el)return;
  const on=MODULES.filter(m=>!m.always&&modShowing(m.id)),off=MODULES.filter(m=>!m.always&&!modShowing(m.id));
  const row=(m,act)=>`<div class="row"><span class="row-ic">${ICON(m.icon,17)}</span><span class="row-main"><span class="row-t">${esc(m.l)}</span><span class="row-s">${esc(act.s)}</span></span>${act.b||''}</div>`;
  // counted: null for a module with nothing to count (it gets neither a verdict nor a Hide button pushed at it)
  const used=m=>{const u=modUsage(m.id);if(!u)return{s:m.d,idle:false,counted:false};return{s:u.line,idle:u.n===0,counted:true};};
  el.innerHTML=`${on.length?`<div class="sec-h">On</div><div class="list">${on.map(m=>{const u=used(m);
      return row(m,{s:u.s,b:u.idle?`<button class="btn bts bsm" onclick="modSet(${jsq(m.id)},false);renderModReview()">Hide</button>`:u.counted?`<span class="pill pill-good">${ICON('tick',11)} In use</span>`:''});}).join('')}</div>`:''}
    ${off.length?`<div class="sec-h">Off</div><div class="list">${off.map(m=>row(m,{s:m.d,b:`<button class="btn bts bsm" onclick="modSet(${jsq(m.id)},true);renderModReview()">Turn on</button>`})).join('')}</div>`:''}
    <div class="fine">Patterns, Coach and Music have nothing to count, so they show what they do instead.</div>`;
}

// ─── The one card Home shows ───
function modIntroCardHTML(){
  return`<div class="sg-card sg-intro" role="group" aria-label="New">
    <div class="sg-top"><span class="sg-i">${ICON('grid',17)}</span><span class="sg-m"><b>New: choose what Lah We shows</b><i>Hide what you don’t track. The tab bar, Home and Progress follow. Nothing you logged is deleted.</i></span></div>
    <div class="sg-acts"><button class="btn btp bsm" onclick="modIntroDone(true)">Choose</button><button class="btn bts bsm" onclick="modIntroDone(false)">Keep everything</button></div>
  </div>`;
}
function modIntroDone(open){S.modIntro=false;S.modSuggest=Object.assign(suggestState(),{at:Date.now()});save();render();if(open)showModsPage();}
function modHomeCardHTML(){
  try{
    if(S.modIntro)return modIntroCardHTML();
    const n=reviewDue();if(n)return reviewCardHTML(n);
    const x=suggestNow();if(x)return suggestCardHTML(x);
  }catch(e){logError(e,'module card');}
  return'';
}
