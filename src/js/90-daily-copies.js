// ═══════════════════════════════════════════════════
// DAILY COPIES — an automatic copy of your log on this phone, one a day, the last seven kept
// ═══════════════════════════════════════════════════
// The first time the app is open on a day, the whole log (S, exactly as it is saved) is copied into
// the device database under "daily:YYYY-MM-DD". Where the phone can, the copy is gzipped (about a
// fourteenth of the size) and only kept compressed once unpacking it gives back the very same text;
// otherwise it is kept as plain text. The oldest beyond seven is deleted.
// They are for undoing a mistake made in the app (a restore or import you regret, something deleted,
// a coach change) — not a backup: they live on the same phone, so deleting the app, clearing Safari's
// website data or losing the phone loses them too. Photos and routes are not in them; restoring one
// leaves those as they are. Nothing here is ever sent anywhere, and they are not part of a backup file.
const DAILY_KEY='daily:';
const DAILY_KEEP=7;

// Every daily copy's key, oldest first, without reading the copies themselves.
function dailyKeys(){
  return new Promise(res=>{
    if(!Store.db)return res([]);
    try{
      const out=[];const range=IDBKeyRange.bound(DAILY_KEY,DAILY_KEY+'￿');
      const st=Store.db.transaction('kv','readonly').objectStore('kv');
      const rq=st.openKeyCursor?st.openKeyCursor(range):st.openCursor(range);
      rq.onsuccess=()=>{const c=rq.result;if(!c)return res(out.sort());out.push(String(c.key));c.continue();};
      rq.onerror=()=>res(out.sort());
    }catch(e){res([]);}
  });
}
async function dailyGzip(txt){
  if(typeof CompressionStream!=='function'||typeof Response!=='function'||typeof Blob!=='function')return null;
  try{return new Uint8Array(await new Response(new Blob([txt]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());}
  catch(e){return null;}
}
async function dailyGunzip(u8){
  if(typeof DecompressionStream!=='function')throw new Error('This browser cannot open a compressed copy');
  return await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
// The copy's text, or null when it cannot be read.
async function dailyText(rec){
  if(!isObj(rec)||rec.v!==1)return null;
  if(rec.z===1&&rec.b){try{return await dailyGunzip(rec.b instanceof Uint8Array?rec.b:new Uint8Array(rec.b));}catch(e){logError(e,'daily copy');return null;}}
  return typeof rec.t==='string'?rec.t:null;
}
function dailyHasData(c){return c.workouts+c.routines+c.meals+c.weighIns>0||(S.activities||[]).length>0||(S.habits||[]).length>0;}
// Take today's copy if there is none yet. Returns true when one was written.
let _dailyBusy=false;
async function dailyTake(){
  if(_dailyBusy||!Store.ready||Store.corrupt||!Store.db||!S.onboarded)return false;
  _dailyBusy=true;
  try{
    const day=today();const key=DAILY_KEY+day;
    const keys=await dailyKeys();
    if(keys.includes(key))return false;
    const c=snapshotCounts(S);if(!dailyHasData(c))return false;
    let txt;try{txt=JSON.stringify(S);}catch(e){return false;}
    const base={v:1,day,at:Date.now(),c,len:txt.length};
    const z=await dailyGzip(txt);
    let rec=null;
    if(z){let back=null;try{back=await dailyGunzip(z);}catch(e){}if(back===txt)rec=Object.assign(base,{z:1,b:z});}
    if(!rec)rec=Object.assign(base,{z:0,t:txt});
    if(!await Store.idbSet(key,rec))return false;
    const all=[...new Set([...keys,key])].sort();
    const old=all.slice(0,Math.max(0,all.length-DAILY_KEEP));
    if(old.length)await Store.idbDel(old);
    return true;
  }catch(e){logError(e,'daily copy');return false;}
  finally{_dailyBusy=false;}
}
function dailyClear(){return dailyKeys().then(k=>k.length?Store.idbDel(k):true);}
// The copies, newest first: [{key,day,at,c,size}] (size is what it takes on the phone).
async function dailyList(){
  const keys=await dailyKeys();const out=[];
  for(const k of keys.slice().reverse()){
    const r=await Store.idbGet(k);if(!isObj(r)||r.v!==1)continue;
    out.push({key:k,day:r.day||k.slice(DAILY_KEY.length),at:r.at||0,c:isObj(r.c)?r.c:null,size:r.z===1&&r.b?r.b.byteLength:(typeof r.t==='string'?r.t.length:0)});
  }
  return out;
}

// ─── Settings → Your data → Daily copies ───
function dailyRowSub(){return`The last ${DAILY_KEEP} days, kept on this phone`;}
async function showDailyCopies(){
  const ov=makeOv('daily-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:4px">Daily copies</div>
    <div class="sheet-sub">The first time you open the app each day it copies your log here, on this phone. Restoring one replaces what is on the phone now, and can be undone. Photos and routes are not in them and stay as they are.</div>
    <div id="daily-list" class="fine">Reading…</div>
    <div class="bk-note">${ICON('folder',15)}<span>These live on this phone only: deleting the app or losing the phone loses them too. <b>Back up</b> to Files for a copy that survives that.</span></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  let list=[];try{list=await dailyList();}catch(e){logError(e,'daily copy');}
  const el=document.getElementById('daily-list');if(!el)return;
  if(!list.length){el.textContent=Store.db?'None yet. The first one is made the next time you open the app on a new day.':'This browser has no device database, so no daily copies can be kept here.';return;}
  el.className='list';el.style.margin='12px 0';
  el.innerHTML=list.map(d=>{
    const when=d.day===today()?'Today':fmtDay(d.day);
    const sub=`${d.c?esc(countsText(d.c)):'Copy'} · ${Math.max(1,Math.round(d.size/1024))} KB`;
    return setRow(when,sub,`dailyRestore('${esc(d.key)}')`,'repeat');
  }).join('');
}
async function dailyRestore(key){
  if(typeof key!=='string'||key.indexOf(DAILY_KEY)!==0)return;
  const rec=await Store.idbGet(key);
  const data=Store.parse(await dailyText(rec));
  if(!data){toast('That copy could not be read','red');return;}
  closeOv('daily-ov');closeSetAll();
  confirmRestore(data,`Daily copy from ${fmtDay(key.slice(DAILY_KEY.length))}`);
}
