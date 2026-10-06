// ═══════════════════════════════════════════════════
// SPRINT TIMER MODE
// ═══════════════════════════════════════════════════
let _sprintInt=null;

function showSprintSetup(){
  const ov=makeOv('sprint-setup-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div class="mt">Sprint Intervals</div>
    <div class="frow" style="gap:10px;margin-bottom:6px">
      <div style="flex:1"><label class="fl">Sprint (sec)</label><input type="number" inputmode="numeric" id="sp-sprint" value="60" min="5" max="600" placeholder="60"></div>
      <div style="flex:1"><label class="fl">Walk (sec)</label><input type="number" inputmode="numeric" id="sp-walk" value="120" min="5" max="600" placeholder="120"></div>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:18px;line-height:1.6">High beep = sprint. Low beep = walk. Keep this screen open: iPhone pauses web timers when the phone locks, so the display is kept awake while intervals run. If it does get locked, the timer catches up when you come back.</div>
    <button class="btn btp bfw" onclick="startSprintTimer()">Start</button>
    <button class="btn btg bfw" style="margin-top:8px" onclick="closeOv('sprint-setup-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
// One shared AudioContext for the whole app — creating a new one per beep
// leaks contexts (browsers cap ~6) and the cold-start glitches/pops.
let _audioCtx=null;
function getAudioCtx(){
  try{
    if(!_audioCtx)_audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    if(_audioCtx.state==='suspended')_audioCtx.resume();
    return _audioCtx;
  }catch(e){return null;}
}
// A single tone with a fast attack ramp + smooth decay. Starting the gain at
// full volume the instant the oscillator fires is what produced the click —
// ramping 0→peak over ~12ms removes it.
function _tone(freq,startOffset,dur,peak){
  const ctx=_audioCtx;if(!ctx)return;
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type='sine';o.frequency.value=freq;
  o.connect(g);g.connect(ctx.destination);
  const t=ctx.currentTime+startOffset;
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(peak,t+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.start(t);o.stop(t+dur+0.03);
}
function playSprintBeep(type){
  const ctx=getAudioCtx();if(!ctx)return;
  if(type==='sprint'){_tone(880,0,0.16,0.4);_tone(880,0.22,0.16,0.4);}
  else{_tone(392,0,0.5,0.34);}
}
function startSprintTimer(){
  const sprintDur=Math.max(5,parseInt(document.getElementById('sp-sprint')?.value)||60);
  const walkDur=Math.max(5,parseInt(document.getElementById('sp-walk')?.value)||120);
  S.activeSprintTimer={sprintDur,walkDur,startTime:Date.now(),rounds:0,isSprintPhase:true,phaseStart:Date.now()};
  getAudioCtx(); // unlock audio within the user gesture so iOS will play cues
  save();closeOv('sprint-setup-ov');
  setTimeout(()=>{render();startSprintLoop();playSprintBeep('sprint');},250);
}
// Advance through however many phases have elapsed (the page may have been frozen for minutes).
// Returns true if the phase changed.
function advanceSprint(st,now){
  let changed=false,guard=0;
  while(guard++<5000){
    const dur=(st.isSprintPhase?st.sprintDur:st.walkDur)*1000;
    if(now-st.phaseStart<dur)break;
    st.phaseStart+=dur;
    st.isSprintPhase=!st.isSprintPhase;
    if(st.isSprintPhase)st.rounds++;
    changed=true;
  }
  return changed;
}
function startSprintLoop(){
  if(_sprintInt)clearInterval(_sprintInt);
  _sprintInt=setInterval(()=>{
    const st=S.activeSprintTimer;if(!st){clearInterval(_sprintInt);_sprintInt=null;return;}
    if(advanceSprint(st,Date.now())){
      save();
      playSprintBeep(st.isSprintPhase?'sprint':'walk');
      try{if(navigator.vibrate)navigator.vibrate(st.isSprintPhase?[150,80,150]:[300]);}catch(e){}
    }
    updateSprintDisplay();
  },250);
}
function updateSprintDisplay(){
  const st=S.activeSprintTimer;if(!st)return;
  const phDur=(st.isSprintPhase?st.sprintDur:st.walkDur)*1000;
  const phRem=Math.max(0,Math.ceil((phDur-(Date.now()-st.phaseStart))/1000));
  const totalEl=Math.floor((Date.now()-st.startTime)/1000);
  const frac=Math.max(0,Math.min(1,(phDur-(Date.now()-st.phaseStart))/phDur));
  const circ=2*Math.PI*52;
  const offset=(circ*(1-frac)).toFixed(1);
  const phaseColor=st.isSprintPhase?'var(--red)':'var(--navy)';
  const el=id=>document.getElementById(id);
  if(el('sprint-phase')){el('sprint-phase').textContent=st.isSprintPhase?'SPRINT':'WALK';el('sprint-phase').style.color=phaseColor;}
  if(el('sprint-cd'))el('sprint-cd').textContent=fmtTimer(phRem);
  if(el('sprint-total'))el('sprint-total').textContent=fmtTimer(totalEl);
  if(el('sprint-rounds'))el('sprint-rounds').textContent=st.rounds;
  if(el('sprint-ring')){el('sprint-ring').style.strokeDashoffset=offset;el('sprint-ring').style.stroke=phaseColor;}
}
function renderSprintSession(c){
  const st=S.activeSprintTimer;if(!st)return;
  const phDur=(st.isSprintPhase?st.sprintDur:st.walkDur)*1000;
  const phRem=Math.max(0,Math.ceil((phDur-(Date.now()-st.phaseStart))/1000));
  const totalEl=Math.floor((Date.now()-st.startTime)/1000);
  const frac=Math.max(0,Math.min(1,(phDur-(Date.now()-st.phaseStart))/phDur));
  const circ=2*Math.PI*52;
  const offset=(circ*(1-frac)).toFixed(1);
  const phaseColor=st.isSprintPhase?'var(--red)':'var(--navy)';
  c.innerHTML=`<div class="fbar">
      <div class="fbar-name">Sprint Intervals</div>
      <span id="sprint-total" class="wt">${fmtTimer(totalEl)}</span>
      <button class="btn btd bsm" onclick="stopSprintTimer()">Stop</button>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 24px;gap:8px">
      <div id="sprint-phase" style="font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${phaseColor};margin-bottom:16px">${st.isSprintPhase?'SPRINT':'WALK'}</div>
      <div style="position:relative;width:144px;height:144px;margin-bottom:24px">
        <svg width="144" height="144" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" stroke-width="6"/>
          <circle id="sprint-ring" cx="60" cy="60" r="52" fill="none" stroke="${phaseColor}" stroke-width="6"
            stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset}"
            transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .25s linear,stroke .2s"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
          <div id="sprint-cd" class="mono" style="font-size:34px;font-weight:600;letter-spacing:-.03em;line-height:1">${fmtTimer(phRem)}</div>
        </div>
      </div>
      <div style="display:flex;gap:48px;text-align:center;align-items:flex-start">
        <div>
          <div id="sprint-rounds" class="mono" style="font-size:36px;font-weight:600;line-height:1">${st.rounds}</div>
          <div style="font-size:9px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-top:6px">Rounds Done</div>
        </div>
        <div style="width:1px;background:var(--border);height:48px;margin-top:4px"></div>
        <div>
          <div class="mono" style="font-size:18px;font-weight:600;line-height:1;color:var(--muted)">${st.sprintDur}s<span style="color:var(--muted2);font-size:14px"> / </span>${st.walkDur}s</div>
          <div style="font-size:9px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin-top:6px">Sprint / Walk</div>
        </div>
      </div>
    </div>`;
  startSprintLoop();
}
function stopSprintTimer(){
  if(_sprintInt)clearInterval(_sprintInt);_sprintInt=null;
  const st=S.activeSprintTimer;if(!st)return;
  advanceSprint(st,Date.now());
  const dur=Math.min(Date.now()-st.startTime,MAX_SESSION_MS);
  // Blend of hard running and walking, weighted by the split — not sprint intensity for the whole session.
  const mets=r1((11*st.sprintDur+3.5*st.walkDur)/(st.sprintDur+st.walkDur));
  const act={id:uid(),type:'sprint',date:dayOf(st.startTime),
    dur:Math.max(1,Math.round(dur/60000)),
    notes:`${st.rounds} rounds · ${st.sprintDur}s sprint / ${st.walkDur}s walk`,
    rounds:st.rounds,sprintDur:st.sprintDur,walkDur:st.walkDur,
    mets,cals:Math.round(mets*bwKg()*(dur/3600000))};
  S.activities.unshift(act);
  const snapshot={rounds:st.rounds,dur,sprintDur:st.sprintDur,walkDur:st.walkDur,cals:act.cals};
  S.activeSprintTimer=null;saveNow();
  render();setTimeout(()=>showSprintSummary(snapshot),120);
}
function showSprintSummary(snap){
  const ov=makeOv('sp-sum-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div style="font-size:30px;text-align:center;margin-bottom:6px">⚡</div>
    <div class="mt" style="text-align:center">Session Complete</div>
    <div class="sgrid" style="border-radius:10px;overflow:hidden;border:1px solid var(--border);margin-bottom:14px">
      <div class="sc"><div class="sv">${snap.rounds}</div><div class="slb">Rounds</div></div>
      <div class="sc"><div class="sv">${fmtDur(snap.dur)}</div><div class="slb">Duration</div></div>
      <div class="sc"><div class="sv">${snap.sprintDur}s</div><div class="slb">Sprint</div></div>
      <div class="sc"><div class="sv">${snap.cals}</div><div class="slb">~kcal</div></div>
    </div>
    <button class="btn btp bfw" onclick="closeOv('sp-sum-ov')">Done</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
