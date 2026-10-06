// ═══════════════════════════════════════════════════
// COACH — saved chats, and everything the coach has made
// ═══════════════════════════════════════════════════
// Starting a new chat keeps the old one. Earlier chats live in the device database (they can be
// large, and browser app storage is small), falling back to app storage where there is no database.
// Like the current chat they are device-only: not in backups, no keys, no attachment bytes.
const COACH_MAX_CHATS=40,COACH_ARCHIVE_BYTES=2500000,COACH_ARCHIVE_BYTES_LS=500000;
let _archivePromise=null;

function coachArchiveLoad(){
  if(_archivePromise)return _archivePromise;
  _archivePromise=(async()=>{
    let txt=null;
    try{txt=Store.db?await Store.idbGet(COACH_ARCHIVE_KEY):null;}catch(e){}
    if(!txt)txt=Store.lsGet(COACH_ARCHIVE_KEY);
    let o=null;try{o=JSON.parse(txt||'null');}catch(e){}
    Coach.archive=(isObj(o)&&Array.isArray(o.chats)?o.chats:[]).filter(c=>isObj(c)&&c.id&&Array.isArray(c.turns)).map(c=>({
      id:String(c.id),title:String(c.title||'').slice(0,90),at:Number(c.at)||0,updatedAt:Number(c.updatedAt)||Number(c.at)||0,turns:coachCleanTurns(c.turns)}))
      .filter(c=>c.turns.length&&c.id!==Coach.id);
    Coach.archiveLoaded=true;
  })();
  return _archivePromise;
}
function coachArchiveSave(){
  const cap=Store.db?COACH_ARCHIVE_BYTES:COACH_ARCHIVE_BYTES_LS;
  Coach.archive.sort((a,b)=>b.updatedAt-a.updatedAt);
  if(Coach.archive.length>COACH_MAX_CHATS)Coach.archive.length=COACH_MAX_CHATS;
  let json=JSON.stringify({v:1,chats:Coach.archive});
  // Oldest chats go first when the store is full.
  while(json.length>cap&&Coach.archive.length>1){Coach.archive.pop();json=JSON.stringify({v:1,chats:Coach.archive});}
  if(Store.db){Store.idbSet(COACH_ARCHIVE_KEY,Coach.archive.length?json:null);Store.lsDel(COACH_ARCHIVE_KEY);}
  else if(Coach.archive.length)Store.lsSet(COACH_ARCHIVE_KEY,json);else Store.lsDel(COACH_ARCHIVE_KEY);
}
function coachChatTitle(turns){
  const first=turns.find(t=>t.role==='user');
  const text=first?String(first.text||'').replace(/\s+/g,' ').trim():'';
  return(text||(first&&(first.attachments||[]).length?'Attachment':'')||'Chat').slice(0,90);
}
function coachChatStarted(turns){const t=turns.find(x=>x.at);return t?t.at:Date.now();}
// Put the current conversation into the saved list (replacing its earlier copy, if any).
function coachArchiveCurrent(){
  if(!Coach.turns.some(t=>t.role==='user'))return null;
  const turns=coachSlimTurns(Coach.turns).map(t=>JSON.parse(JSON.stringify(t)));
  const entry={id:Coach.id||uid(),title:coachChatTitle(turns),at:coachChatStarted(turns),updatedAt:Date.now(),turns};
  Coach.archive=Coach.archive.filter(c=>c.id!==entry.id);
  Coach.archive.unshift(entry);
  coachArchiveSave();
  return entry;
}
function coachNewChat(){
  if(Coach.busy)return Promise.resolve();
  return coachArchiveLoad().then(()=>{
    if(Coach.busy)return;
    const prev={id:Coach.id,turns:Coach.turns};
    const saved=coachArchiveCurrent();
    coachClear();
    if(S.tab==='coach')render();
    if(saved)toast('Chat saved · new chat started','',{action:'Undo',onAction:()=>{
      if(Coach.busy||Coach.turns.length)return;
      Coach.archive=Coach.archive.filter(c=>c.id!==prev.id);coachArchiveSave();
      Coach.id=prev.id;Coach.turns=prev.turns;coachPersist();if(S.tab==='coach')render();
    }});
  });
}
function coachOpenChat(id){
  if(Coach.busy){toast('Wait for the coach to finish first');return false;}
  if(id===Coach.id)return true;
  const chat=Coach.archive.find(c=>c.id===id);if(!chat)return false;
  coachArchiveCurrent();
  Coach.archive=Coach.archive.filter(c=>c.id!==id);
  Coach.id=chat.id;Coach.turns=coachCleanTurns(chat.turns);Coach.error=null;Coach.events=[];Coach.attachments=[];Coach.stick=true;
  coachCloseOpenLoop();
  coachPersist();coachArchiveSave();
  return true;
}
function coachDeleteChat(id){
  const i=Coach.archive.findIndex(c=>c.id===id);if(i<0)return;
  const gone=Coach.archive.splice(i,1)[0];coachArchiveSave();renderCoachChats();
  toast('Chat deleted','',{action:'Undo',onAction:()=>{Coach.archive.push(gone);coachArchiveSave();renderCoachChats();}});
}
// Reset: nothing of the coach is left behind.
function coachClearAll(){
  coachClear();
  Coach.archive=[];Coach.archiveLoaded=true;_archivePromise=Promise.resolve();
  try{if(Store.db)Store.idbSet(COACH_ARCHIVE_KEY,null);}catch(e){}
  Store.lsDel(COACH_ARCHIVE_KEY);
}

// ─── What the coach has made ───
const COACH_MADE_KIND={propose_routines:['🏗','Program'],propose_quick_workout:['⚡','Workout'],propose_meal_plan:['🍽','Meal plan'],propose_targets:['🎯','Targets'],propose_delete:['🗑','Delete'],
  log_meal:['🥗','Meal logged'],log_weight:['⚖️','Weigh-in'],log_activity:['🏃','Activity'],save_note:['📝','Note'],remove_note:['📝','Note removed'],add_food:['🥫','Food added']};
function coachMadeStatus(ui){
  if(ui.type==='receipt')return ui.undone?'Undone':'Done';
  return({pending:'Waiting for you',applied:'Used',dismissed:'Not used',replaced:'Replaced'})[ui.status]||'';
}
// Every card and receipt in a chat, newest first: {chatId, ti, ri, at, icon, kind, title, status, open}
function coachMadeIn(chatId,turns){
  const out=[];let at=0;
  turns.forEach((t,ti)=>{
    if(t.at)at=t.at;
    if(t.role!=='tool')return;
    t.results.forEach((r,ri)=>{
      const ui=r.ui;if(!ui||(ui.type!=='proposal'&&ui.type!=='receipt'))return;
      const k=COACH_MADE_KIND[ui.type==='receipt'?r.name:ui.kind]||['✨','Made'];
      out.push({chatId,ti,ri,at,icon:k[0],kind:k[1],title:String(ui.title||k[1]),status:coachMadeStatus(ui),open:ui.type==='proposal'&&ui.status==='pending'});
    });
  });
  return out;
}
function coachAllChats(){
  const list=Coach.archive.map(c=>({id:c.id,title:c.title,at:c.at,updatedAt:c.updatedAt,turns:c.turns,current:false}));
  if(Coach.turns.some(t=>t.role==='user'))list.unshift({id:Coach.id,title:coachChatTitle(Coach.turns),at:coachChatStarted(Coach.turns),updatedAt:Date.now(),turns:Coach.turns,current:true});
  return list.sort((a,b)=>(b.current-a.current)||(b.updatedAt-a.updatedAt));
}
function coachAllMade(){
  return coachAllChats().flatMap(c=>coachMadeIn(c.id,c.turns)).sort((a,b)=>b.at-a.at);
}

// ─── Sheet ───
function showCoachChats(view){
  window._chatsView=view==='made'?'made':'chats';
  const ov=makeOv('chats-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div class="mt">Coach history</div><div id="chats-body"><div style="font-size:12px;color:var(--muted);padding:10px 0">Loading…</div></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  coachArchiveLoad().then(renderCoachChats);
}
function setChatsView(v){window._chatsView=v;renderCoachChats();}
function renderCoachChats(){
  const el=document.getElementById('chats-body');if(!el)return;
  const v=window._chatsView==='made'?'made':'chats';
  const chats=coachAllChats();const made=coachAllMade();
  const when=ts=>ts?fmtShort(ts)+', '+new Date(ts).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'';
  let body;
  if(v==='chats'){
    body=chats.length?chats.map(c=>{
      const n=c.turns.filter(t=>t.role==='user').length;const m=coachMadeIn(c.id,c.turns).length;
      return`<div class="chat-row" onclick="coachPickChat(${jsq(c.id)})"><div style="flex:1;min-width:0">
          <div class="chat-t">${esc(c.title)}</div>
          <div class="chat-m">${c.current?'<b>Open now</b> · ':''}${esc(when(c.updatedAt))} · ${n} message${n===1?'':'s'}${m?` · ${m} made`:''}</div>
        </div>${c.current?'':`<button class="ib delbtn" onclick="event.stopPropagation();coachDeleteChat(${jsq(c.id)})" aria-label="Delete chat">✕</button>`}</div>`;
    }).join(''):`<div class="chat-empty">No chats yet. Ask the coach something and it will be kept here.</div>`;
  }else{
    body=made.length?made.map(x=>`<div class="chat-row" onclick="coachPickMade(${jsq(x.chatId)},${x.ti},${x.ri})"><div class="made-i">${x.icon}</div><div style="flex:1;min-width:0">
        <div class="chat-t">${esc(x.title)}</div>
        <div class="chat-m">${esc(x.kind)} · ${esc(when(x.at))}</div>
      </div><span class="made-s${x.open?' open':x.status==='Used'||x.status==='Done'?' ok':''}">${esc(x.status)}</span></div>`).join('')
      :`<div class="chat-empty">Nothing yet. Programs, workouts, meal plans, targets and anything the coach logs for you are listed here, so you can come back to them.</div>`;
  }
  el.innerHTML=`<div class="seg" style="margin:0 0 12px"><button class="seg-b${v==='chats'?' on':''}" onclick="setChatsView('chats')">Chats${chats.length?` (${chats.length})`:''}</button><button class="seg-b${v==='made'?' on':''}" onclick="setChatsView('made')">Made by coach${made.length?` (${made.length})`:''}</button></div>
    <div class="chat-list">${body}</div>
    <div style="font-size:11px;color:var(--muted);line-height:1.5;margin:10px 0">Kept on this device only — up to ${COACH_MAX_CHATS} chats, oldest dropped first. Not part of backups.</div>
    <div class="frow"><button class="btn bts bfw" onclick="closeOv('chats-ov');coachNewChat()"${Coach.turns.length?'':' disabled'}>New chat</button><button class="btn btg bfw" onclick="closeOv('chats-ov')">Close</button></div>`;
}
function coachPickChat(id){
  if(!coachOpenChat(id))return;
  closeOv('chats-ov');
  if(S.tab==='coach')render();else go('coach');
}
// Open the chat a thing was made in and bring that card into view.
function coachPickMade(chatId,ti,ri){
  if(!coachOpenChat(chatId))return;
  closeOv('chats-ov');
  Coach.stick=false;
  if(S.tab==='coach')render();else go('coach');
  setTimeout(()=>{
    const el=document.getElementById(`cc-${ti}-${ri}`);if(!el)return;
    try{el.scrollIntoView({block:'center'});}catch(e){}
    el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1600);
  },60);
}
// Put a used, dismissed or replaced proposal back on the table. Applying it is still a separate tap,
// and it is checked against the data as it is at that moment.
function coachCardReopen(ti,ri){
  const ui=coachUi(ti,ri);if(!ui||ui.type!=='proposal'||ui.status==='pending'||ui.action)return;
  ui.status='pending';ui.message='';ui.go=null;
  coachPersist();Coach.stick=false;coachPaint();
}
