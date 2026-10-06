// ═══════════════════════════════════════════════════
// MODES
// ═══════════════════════════════════════════════════
function showModes(){
  const ov=makeOv('modes-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div class="mt">Workout Modes</div>
    <div style="display:grid;gap:10px;margin-bottom:16px">
      <div class="mode-card" onclick="closeOv('modes-ov');setTimeout(showCardDeckSetup,230)">
        <div style="font-size:26px;margin-bottom:8px">🃏</div>
        <div style="font-size:16px;font-weight:700;letter-spacing:-.02em;margin-bottom:4px">Card Deck</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">Assign exercises to suits. Flip cards — the value is your reps. Mike Tyson approved.</div>
      </div>
      <div class="mode-card" onclick="closeOv('modes-ov');setTimeout(showSprintSetup,230)">
        <div style="font-size:26px;margin-bottom:8px">⚡</div>
        <div style="font-size:16px;font-weight:700;letter-spacing:-.02em;margin-bottom:4px">Sprint Intervals</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">Configurable sprint/walk split. Timed sprint/walk split with audio cues. Keep the app open — the screen stays awake for you.</div>
      </div>
    </div>
    <button class="btn btg bfw" onclick="closeOv('modes-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}

// ═══════════════════════════════════════════════════
// CARD DECK MODE
// ═══════════════════════════════════════════════════
const SUITS=[
  {id:'spades', sym:'♠',label:'Spades', color:'var(--navy)'},
  {id:'hearts', sym:'♥',label:'Hearts', color:'var(--red)'},
  {id:'diamonds',sym:'♦',label:'Diamonds',color:'var(--red)'},
  {id:'clubs',  sym:'♣',label:'Clubs',  color:'var(--navy)'},
];
const CARD_LABELS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const CARD_VALUES=[11,2,3,4,5,6,7,8,9,10,10,10,10];
let _cdTimer=null;

function showCardDeckSetup(){
  const ov=makeOv('cd-setup-ov');
  const exOpts=allEx().filter(e=>e.eq==='Bodyweight').map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div class="mt">Card Deck Setup</div>
    <div class="fg">
      <label class="fl">Active Suits</label>
      <div style="display:flex;gap:8px">
        ${SUITS.map(s=>`<button id="cs-${s.id}" class="btn btp" style="flex:1;font-size:20px;padding:11px 0;border-radius:10px" onclick="toggleCDSuit('${s.id}')">${s.sym}</button>`).join('')}
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px">Each active suit needs an exercise assigned below.</div>
    </div>
    <div id="cd-suit-assigns"></div>
    <div class="frow" style="gap:10px;margin-bottom:14px">
      <div style="flex:1"><label class="fl">Sec / Rep</label><input type="number" inputmode="decimal" id="cd-spr" value="3" min="1" max="20" placeholder="3"></div>
      <div style="flex:1"><label class="fl">Buffer (sec)</label><input type="number" inputmode="numeric" id="cd-buf" value="5" min="0" max="60" placeholder="5"></div>
    </div>
    <div id="cd-deck-preview" style="font-size:12px;color:var(--muted);margin-bottom:14px;text-align:center;font-family:var(--mono)"></div>
    <button class="btn btp bfw" onclick="startCardDeck()">Start Deck</button>
    <button class="btn btg bfw" style="margin-top:8px" onclick="closeOv('cd-setup-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  window._cdActiveSuits=new Set(['spades','hearts','diamonds','clubs']);
  window._cdExMap={};
  renderCDSuitAssigns();
}
function toggleCDSuit(sid){
  const set=window._cdActiveSuits;
  if(set.has(sid)){if(set.size<=1)return;set.delete(sid);}
  else{set.add(sid);}
  SUITS.forEach(s=>{
    const b=document.getElementById(`cs-${s.id}`);
    if(b)b.className=`btn ${set.has(s.id)?'btp':'bts'}`;
    if(b)b.style.cssText='flex:1;font-size:20px;padding:11px 0;border-radius:10px';
  });
  renderCDSuitAssigns();
}
function renderCDSuitAssigns(){
  const exOpts=allEx().filter(e=>e.eq==='Bodyweight').map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
  const active=SUITS.filter(s=>window._cdActiveSuits.has(s.id));
  const el=document.getElementById('cd-suit-assigns');if(!el)return;
  el.innerHTML=active.map(s=>`<div class="fg">
    <label class="fl" style="color:${s.color}">${s.sym} ${s.label}</label>
    <select id="cd-ex-${s.id}" style="font-size:14px">
      <option value="">— pick exercise —</option>${exOpts}
    </select>
  </div>`).join('');
  active.forEach(s=>{
    const sel=document.getElementById(`cd-ex-${s.id}`);
    if(sel&&window._cdExMap[s.id])sel.value=window._cdExMap[s.id];
    if(sel)sel.onchange=()=>{window._cdExMap[s.id]=sel.value;};
  });
  const total=active.length*13;
  const prev=document.getElementById('cd-deck-preview');
  if(prev)prev.textContent=`${total} cards · ${active.length} suits`;
}
function startCardDeck(){
  const suitIds=[...window._cdActiveSuits];
  for(const sid of suitIds){
    const sel=document.getElementById(`cd-ex-${sid}`);
    const val=(sel?.value||'').trim()||window._cdExMap[sid]||'';
    if(!val){toast(`Pick exercise for ${SUITS.find(s=>s.id===sid)?.label}`);return;}
    window._cdExMap[sid]=val;
  }
  const spr=Math.max(1,parseFloat(document.getElementById('cd-spr')?.value)||3);
  const buf=Math.max(0,parseInt(document.getElementById('cd-buf')?.value)||5);
  let deck=[];
  suitIds.forEach(sid=>{
    CARD_LABELS.forEach((lbl,i)=>{
      deck.push({suit:sid,label:lbl,value:CARD_VALUES[i],exId:window._cdExMap[sid]});
    });
  });
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  const repsByEx={};const cardsByEx={};
  suitIds.forEach(sid=>{const exId=window._cdExMap[sid];repsByEx[exId]=0;cardsByEx[exId]=[];});
  S.activeCardDeck={deck,cardIdx:0,startTime:Date.now(),secPerRep:spr,buffer:buf,
    suitMap:Object.fromEntries(suitIds.map(s=>[s,window._cdExMap[s]])),
    repsByEx,cardsByEx,_phaseStart:null,_phaseDur:null};
  save();closeOv('cd-setup-ov');
  setTimeout(()=>{render();schedCDAutoFlip();},250);
}
function schedCDAutoFlip(){
  if(_cdTimer)clearTimeout(_cdTimer);
  if(window._cdCountInt)clearInterval(window._cdCountInt);
  const cd=S.activeCardDeck;if(!cd||cd.cardIdx>=cd.deck.length)return;
  const card=cd.deck[cd.cardIdx];
  const ms=Math.round((card.value*cd.secPerRep+cd.buffer)*1000);
  cd._phaseStart=Date.now();cd._phaseDur=ms;
  _cdTimer=setTimeout(()=>flipCard(true),ms);
  window._cdCountInt=setInterval(()=>{
    if(!S.activeCardDeck)return clearInterval(window._cdCountInt);
    const rem=Math.max(0,Math.ceil((ms-(Date.now()-cd._phaseStart))/1000));
    const el=document.getElementById('cd-countdown');if(el)el.textContent=fmtTimer(rem);
  },250);
}
function flipCard(autoFlipped){
  if(_cdTimer)clearTimeout(_cdTimer);
  if(window._cdCountInt)clearInterval(window._cdCountInt);
  const cd=S.activeCardDeck;if(!cd)return;
  const card=cd.deck[cd.cardIdx];
  cd.repsByEx[card.exId]=(cd.repsByEx[card.exId]||0)+card.value;
  if(!cd.cardsByEx[card.exId])cd.cardsByEx[card.exId]=[];
  cd.cardsByEx[card.exId].push(card.value);
  cd.cardIdx++;save();
  if(cd.cardIdx>=cd.deck.length){endCardDeck();return;}
  render();schedCDAutoFlip();
}
function endCardDeck(){
  if(_cdTimer)clearTimeout(_cdTimer);
  if(window._cdCountInt)clearInterval(window._cdCountInt);
  if(window._cdElInt)clearInterval(window._cdElInt);
  const cd=S.activeCardDeck;if(!cd)return;
  // A deck ended before the first card has nothing in it; logging it left an empty workout in History.
  if(!Object.values(cd.cardsByEx||{}).some(cards=>cards.length>0)){S.activeCardDeck=null;saveNow();render();toast('Nothing to log');return;}
  const dur=Date.now()-cd.startTime;
  const exercises=Object.entries(cd.cardsByEx)
    .filter(([,cards])=>cards.length>0)
    .map(([exId,cards])=>({exId,sets:cards.map(r=>({w:'',r:String(r),done:true,tag:''}))}));
  const exNames=exercises.map(e=>exName(e.exId));
  const totalReps=Object.values(cd.repsByEx).reduce((a,b)=>a+b,0);
  const wk={id:uid(),
    name:`Card Deck — ${exNames.join(', ')}`,
    started:cd.startTime,ended:Date.now(),exercises,notes:'',
    cals:sessionCals(dur),type:'cardDeck',
    cardDeckInfo:{totalCards:cd.cardIdx,totalReps,suitMap:cd.suitMap}};
  S.workouts.unshift(wk);
  const snapshot={repsByEx:{...cd.repsByEx},dur,totalCards:cd.cardIdx,totalReps,cals:wk.cals};
  S.activeCardDeck=null;rebuildPRs();saveNow();
  render();
  setTimeout(()=>showCDSummary(wk,snapshot),120);
}
function showCDSummary(wk,snap){
  const ov=makeOv('cd-sum-ov');
  const exRows=wk.exercises.map(ex=>{
    const info=getEx(ex.exId);
    return`<div class="wsr"><div style="flex:1">
      <div style="font-size:13px;font-weight:600">${esc(info?.name||'?')}</div>
      <div class="mono" style="font-size:12px;color:var(--muted)">${ex.sets.length} cards · ${snap.repsByEx[ex.exId]||0} total reps</div>
    </div></div>`;
  }).join('');
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div style="font-size:30px;text-align:center;margin-bottom:6px">🃏</div>
    <div class="mt" style="text-align:center">Deck Complete</div>
    <div class="sgrid" style="border-radius:10px;overflow:hidden;border:1px solid var(--border);margin-bottom:14px">
      <div class="sc"><div class="sv">${snap.totalCards}</div><div class="slb">Cards</div></div>
      <div class="sc"><div class="sv">${fmtDur(snap.dur)}</div><div class="slb">Duration</div></div>
      <div class="sc"><div class="sv">${snap.totalReps}</div><div class="slb">Total Reps</div></div>
      <div class="sc"><div class="sv">${snap.cals}</div><div class="slb">~kcal</div></div>
    </div>
    <div style="border:1px solid var(--border);border-radius:10px;padding:0 12px;margin-bottom:14px">${exRows}</div>
    <button class="btn btp bfw" onclick="closeOv('cd-sum-ov')">Done</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
// Ending a mode offers both ways out: keep what was done, or throw the session away.
// (There used to be no way to leave a mode without it being logged.)
function modeEndSheet(o){
  const ov=makeOv('mode-end-ov');
  ov.innerHTML=`<div class="modal" style="max-height:70vh"><div class="mh"></div>
    <div class="mt">${o.title}</div>
    <div style="font-size:13px;color:var(--muted);line-height:1.5;margin:-8px 0 14px">${o.detail}</div>
    ${o.canSave?`<button class="btn btp bfw" onclick="closeOv('mode-end-ov');${o.save}">${o.saveLabel}</button>`:''}
    <button class="btn btd bfw" style="margin-top:8px" onclick="closeOv('mode-end-ov');${o.discard}">Discard — don't log it</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('mode-end-ov')">Keep going</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function confirmEndDeck(){
  const cd=S.activeCardDeck;if(!cd)return;
  const n=cd.cardIdx||0;
  modeEndSheet({title:'End the card deck?',canSave:n>0,
    detail:n>0?`${n} card${n===1?'':'s'} done. Save them as a workout, or discard the session.`:'No cards done yet, so there is nothing to save.',
    saveLabel:`Save ${n} card${n===1?'':'s'} as a workout`,save:'endCardDeck()',discard:'discardCardDeck()'});
}
function stopCardDeckTimers(){
  if(_cdTimer)clearTimeout(_cdTimer);_cdTimer=null;
  if(window._cdCountInt)clearInterval(window._cdCountInt);
  if(window._cdElInt)clearInterval(window._cdElInt);
}
function discardCardDeck(){
  const cd=S.activeCardDeck;if(!cd)return;
  stopCardDeckTimers();
  S.activeCardDeck=null;saveNow();render();
  toast('Card deck discarded — nothing logged','',{action:'Undo',ms:7000,onAction:()=>{
    if(S.activeCardDeck||S.activeSprintTimer||S.activeWorkout)return;
    cd._phaseStart=Date.now();S.activeCardDeck=cd;saveNow();go('workout');schedCDAutoFlip();
  }});
}
function renderCardDeckSession(c){
  const cd=S.activeCardDeck;if(!cd||cd.cardIdx>=cd.deck.length)return;
  const card=cd.deck[cd.cardIdx];
  const suit=SUITS.find(s=>s.id===card.suit)||SUITS[0];
  const exInfo=getEx(card.exId);
  const remaining=cd.deck.length-cd.cardIdx;
  const elapsed=Math.floor((Date.now()-cd.startTime)/1000);
  const exSummary=Object.entries(cd.repsByEx).filter(([,r])=>r>0)
    .map(([exId,r])=>`${esc(exName(exId))}: ${r}`).join(' · ');
  // Countdown display
  let cdRemTxt='–:––';
  if(cd._phaseStart&&cd._phaseDur){
    const rem=Math.max(0,Math.ceil((cd._phaseDur-(Date.now()-cd._phaseStart))/1000));
    cdRemTxt=fmtTimer(rem);
  }
  c.innerHTML=`<div class="fbar">
      <div class="fbar-name">Card Deck</div>
      <span class="wt" id="cd-elapsed">${fmtTimer(elapsed)}</span>
      <button class="btn btd bsm" onclick="confirmEndDeck()">End</button>
    </div>
    ${musicBarHTML()}
    <div style="padding:8px 14px;background:var(--card);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:12px;color:var(--muted);font-weight:500">${cd.cardIdx} done · ${remaining} left</div>
      <div style="display:flex;align-items:center;gap:6px">
        <div style="font-size:12px;color:var(--muted);font-weight:600">auto-flip</div>
        <div id="cd-countdown" class="mono" style="font-size:13px;color:var(--navy);font-weight:600">${cdRemTxt}</div>
      </div>
    </div>
    ${exSummary?`<div style="padding:7px 14px;font-size:12px;color:var(--muted);border-bottom:1px solid var(--border);line-height:1.7">${exSummary} reps</div>`:''}
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 20px 20px" onclick="flipCard(false)">
      <div style="font-size:12px;font-weight:600;color:${suit.color};margin-bottom:14px;opacity:.7">${esc(exInfo?.name||'Exercise')}</div>
      <div class="cd-card" style="--suit-color:${suit.color}">
        <div class="cd-corner-tl" style="color:${suit.color}">
          <div class="cd-corner-val">${card.label}</div>
          <div class="cd-corner-sym">${suit.sym}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center">
          <div class="cd-main-sym" style="color:${suit.color}">${suit.sym}</div>
          <div class="cd-main-val" style="color:${suit.color}">${card.label}</div>
          <div class="cd-reps-lbl">${card.value} reps</div>
        </div>
        <div class="cd-corner-br" style="color:${suit.color}">
          <div class="cd-corner-val">${card.label}</div>
          <div class="cd-corner-sym">${suit.sym}</div>
        </div>
      </div>
      <div style="margin-top:18px;font-size:12px;color:var(--muted2);text-align:center;line-height:1.6">Tap card when done · auto-advances</div>
    </div>`;
  // Elapsed timer
  if(window._cdElInt)clearInterval(window._cdElInt);
  window._cdElInt=setInterval(()=>{
    const el=document.getElementById('cd-elapsed');
    if(el&&S.activeCardDeck)el.textContent=fmtTimer(Math.floor((Date.now()-S.activeCardDeck.startTime)/1000));
  },1000);
  // Countdown ticker (resume)
  if(window._cdCountInt)clearInterval(window._cdCountInt);
  if(cd._phaseStart&&cd._phaseDur){
    const ms=cd._phaseDur,st=cd._phaseStart;
    window._cdCountInt=setInterval(()=>{
      if(!S.activeCardDeck)return clearInterval(window._cdCountInt);
      const rem=Math.max(0,Math.ceil((ms-(Date.now()-st))/1000));
      const el=document.getElementById('cd-countdown');if(el)el.textContent=fmtTimer(rem);
    },250);
  }
}
