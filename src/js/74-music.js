// ═══════════════════════════════════════════════════
// MUSIC — a Spotify remote for the live workout
// ═══════════════════════════════════════════════════
// What this is: buttons that tell Spotify to play, pause or skip on whatever device it is already
// playing on, plus the name of the track. What it is not: a player. A web page on an iPhone cannot
// play Spotify itself, and no web page can control the YouTube app at all.
//
// Same rule as the AI keys: nothing shared. Each person registers their own free Spotify
// developer app and pastes its client ID here. Spotify limits a developer app to five people and
// requires its owner to have Premium, so one ID baked into this page could never serve everyone.
// Sign-in uses PKCE, which needs no client secret. The client ID and the tokens Spotify hands
// back live in their own device-only entry: never in S, so never in a backup, and never in the repo.
const SPOTIFY_AUTH='https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN='https://accounts.spotify.com/api/token';
const SPOTIFY_API='https://api.spotify.com/v1';
const SPOTIFY_SCOPES='user-read-playback-state user-modify-playback-state user-read-currently-playing';
const SPOTIFY_ID_RE=/^[0-9a-f]{32}$/i;
const SPOTIFY_ART_RE=/^https:\/\/[a-z0-9.-]+\.(scdn\.co|spotifycdn\.com)\/[A-Za-z0-9\/_.-]+$/;
const MUSIC_POLL_MS=5000;
const Music={now:null,err:'',timer:null,busy:false,setupMsg:''};

function musicRead(){try{const o=JSON.parse(localStorage.getItem(MUSIC_KEY)||'{}');return isObj(o)?o:{};}catch(e){return{};}}
function musicWrite(o){try{localStorage.setItem(MUSIC_KEY,JSON.stringify(o));return true;}catch(e){return false;}}
function musicClear(){try{localStorage.removeItem(MUSIC_KEY);}catch(e){}Music.now=null;Music.err='';musicStop();}
function musicOn(){const m=musicRead();return !!(m.refresh||m.access);}
function musicCanRun(){return location.protocol==='https:'||/^(127\.0\.0\.1|\[::1\])$/.test(location.hostname);}
// The address Spotify sends the sign-in back to. It has to match what is registered, character for character.
function musicRedirectUri(){return location.origin+location.pathname.replace(/(index|lahwe)\.html$/,'');}
function musicSetClientId(v){
  v=String(v||'').trim();
  if(!SPOTIFY_ID_RE.test(v))return'A Spotify client ID is 32 letters and numbers. Copy it from your app’s page on the Spotify dashboard (not the client secret).';
  const m=musicRead();
  if(m.clientId!==v){delete m.access;delete m.refresh;delete m.exp;delete m.pending;}
  m.clientId=v;
  return musicWrite(m)?'':'This device would not store it (private browsing, or storage is full).';
}
function b64url(bytes){let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function musicRandom(n){const a=new Uint8Array(n);crypto.getRandomValues(a);return b64url(a);}
async function musicChallenge(verifier){return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));}

// ─── Sign-in ───
async function musicConnect(){
  const m=musicRead();
  if(!musicCanRun()){toast('Spotify sign-in only works from the web page (https), not from a saved file');return;}
  if(!SPOTIFY_ID_RE.test(m.clientId||'')){toast('Save your Spotify client ID first');return;}
  const verifier=musicRandom(64),state=musicRandom(16);
  m.pending={verifier,state,at:Date.now()};
  if(!musicWrite(m)){toast('This device would not store the sign-in','red');return;}
  const q=new URLSearchParams({client_id:m.clientId,response_type:'code',redirect_uri:musicRedirectUri(),code_challenge_method:'S256',
    code_challenge:await musicChallenge(verifier),scope:SPOTIFY_SCOPES,state});
  try{await saveNow();}catch(e){}
  location.assign(SPOTIFY_AUTH+'?'+q.toString());
}
async function musicToken(params){
  const res=await fetch(SPOTIFY_TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params).toString()});
  let d=null;try{d=await res.json();}catch(e){}
  if(!res.ok||!isObj(d)||typeof d.access_token!=='string'){
    const why=isObj(d)?String(d.error_description||d.error||''):'';
    const e=new Error(why?`Spotify said: ${why.slice(0,160)}`:`Spotify refused the sign-in (${res.status}).`);e.status=res.status;e.oauth=isObj(d)?d.error:'';throw e;
  }
  return d;
}
function musicStoreTokens(m,d){
  m.access=d.access_token;m.exp=Date.now()+(Math.max(60,parseInt(d.expires_in)||3600))*1000;
  if(typeof d.refresh_token==='string'&&d.refresh_token)m.refresh=d.refresh_token; // Spotify may rotate it
  delete m.pending;
  return musicWrite(m);
}
// Finish a sign-in with the code Spotify sent back. Returns '' on success or a message.
async function musicExchange(code,state){
  const m=musicRead();const pend=m.pending;
  if(!isObj(pend)||!pend.verifier||pend.state!==state)return'That sign-in does not match the one started on this device. Tap Connect and try again.';
  if(Date.now()-(pend.at||0)>15*60000){delete m.pending;musicWrite(m);return'That sign-in took too long. Tap Connect and try again.';}
  try{
    const d=await musicToken({grant_type:'authorization_code',code,redirect_uri:musicRedirectUri(),client_id:m.clientId,code_verifier:pend.verifier});
    if(!musicStoreTokens(m,d))return'Signed in, but this device would not store it.';
    return'';
  }catch(e){delete m.pending;musicWrite(m);return errText(e);}
}
// Called once at start-up: picks up ?code=…&state=… when Spotify sends the browser back.
async function musicHandleReturn(){
  let p;try{p=new URLSearchParams(location.search);}catch(e){return;}
  const code=p.get('code'),state=p.get('state'),err=p.get('error');
  if(!state||(!code&&!err))return;
  // Clean the address first, so a refresh cannot replay it and it does not sit in history.
  try{history.replaceState(null,'',location.pathname+location.hash);}catch(e){}
  const m=musicRead();
  if(!isObj(m.pending)||m.pending.state!==state){
    // No sign-in was started in this browser. On an iPhone this means Spotify handed the result
    // to Safari while the sign-in began in the Home Screen app, which keeps its own storage.
    if(code&&/^[A-Za-z0-9_\-]{16,600}$/.test(code)&&/^[A-Za-z0-9_\-]{8,64}$/.test(state))showMusicHandoff(state+'.'+code);
    return;
  }
  if(err){delete m.pending;musicWrite(m);toast('Spotify sign-in was cancelled');return;}
  const msg=await musicExchange(code,state);
  if(msg){Music.setupMsg=msg;showMusicSetup();}
  else{toast('Spotify connected','green');musicSync();if(S.tab==='workout')rerender();}
}
function showMusicHandoff(str){
  const ov=makeOv('mh-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:4px">One more step</div>
    <div class="sheet-sub">Spotify sent you back to the browser instead of the Lah We app on your Home Screen. Copy this code, open Lah We from its icon, then go to Settings → Music and paste it under “Finish connecting”.</div>
    <textarea id="mh-code" readonly style="min-height:74px;font-size:12px;word-break:break-all">${esc(str)}</textarea>
    <button class="btn btp bfw" style="margin-top:10px" onclick="musicCopy('mh-code')">Copy the code</button>
    <div class="fine">The code works once, for a few minutes, and only in the app that started the sign-in.</div>
    <button class="btn btg bfw" onclick="closeOv('mh-ov')">Close</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
async function musicCopy(id){
  const el=document.getElementById(id);if(!el)return;
  const text=el.value!=null?el.value:el.textContent;
  try{await navigator.clipboard.writeText(text);toast('Copied','green');}
  catch(e){try{el.focus();el.select();document.execCommand('copy');toast('Copied','green');}catch(e2){toast('Select the text and copy it by hand');}}
}
async function musicPasteReturn(){
  const v=String(document.getElementById('mu-paste')?.value||'').trim();
  const i=v.indexOf('.');
  if(i<8){Music.setupMsg='That does not look like the code from the “One more step” screen.';renderMusicSetup();return;}
  const msg=await musicExchange(v.slice(i+1),v.slice(0,i));
  Music.setupMsg=msg;renderMusicSetup();
  if(!msg){toast('Spotify connected','green');musicSync();}
}

// ─── Calls ───
function musicErrorText(status,reason){
  if(status===403&&/PREMIUM/i.test(reason))return'Spotify only lets Premium accounts be controlled from another app.';
  if(status===404||/NO_ACTIVE_DEVICE/i.test(reason))return'Nothing is playing. Open Spotify, press play once, then use these buttons.';
  if(status===403)return'Spotify refused that. If you are not the owner of the Spotify app whose ID you entered, its owner has to add you to it.';
  if(status===429)return'Spotify is asking us to slow down. Try again in a moment.';
  if(status===401)return'Spotify signed you out. Connect again in Settings → Music.';
  return`Spotify did not accept that (${status}).`;
}
async function musicRefresh(){
  const m=musicRead();
  if(!m.refresh||!m.clientId){const e=new Error(musicErrorText(401,''));e.status=401;throw e;}
  try{
    const d=await musicToken({grant_type:'refresh_token',refresh_token:m.refresh,client_id:m.clientId});
    musicStoreTokens(m,d);
  }catch(e){
    // A refused refresh token is dead for good; a network failure is not.
    if(e.status===400||e.status===401){const k=musicRead();delete k.access;delete k.refresh;delete k.exp;musicWrite(k);const x=new Error(musicErrorText(401,''));x.status=401;throw x;}
    throw new Error('Could not reach Spotify. Check your connection.');
  }
}
async function musicApi(method,path,again){
  let m=musicRead();
  if(!m.access&&!m.refresh){const e=new Error(musicErrorText(401,''));e.status=401;throw e;}
  if(!m.access||Date.now()>(m.exp||0)-30000){await musicRefresh();m=musicRead();}
  let res;
  try{res=await fetch(SPOTIFY_API+path,{method,headers:{Authorization:'Bearer '+m.access}});}
  catch(e){throw new Error('Could not reach Spotify. Check your connection.');}
  if(res.status===401&&!again){await musicRefresh();return musicApi(method,path,true);}
  if(res.status===204||res.status===202)return null;
  let d=null;try{d=await res.json();}catch(e){}
  if(!res.ok){
    const reason=isObj(d)&&isObj(d.error)?String(d.error.reason||d.error.message||''):'';
    const e=new Error(musicErrorText(res.status,reason));e.status=res.status;throw e;
  }
  return d;
}
function musicNowFrom(d){
  if(!isObj(d)||!isObj(d.item))return null;
  const it=d.item;
  const imgs=isObj(it.album)&&Array.isArray(it.album.images)?it.album.images:Array.isArray(it.images)?it.images:[];
  const art=imgs.length?String(imgs[imgs.length-1].url||''):'';
  return{playing:!!d.is_playing,title:String(it.name||'').slice(0,120),
    artist:(Array.isArray(it.artists)?it.artists.map(a=>a&&a.name).filter(Boolean).join(', '):(isObj(it.show)?it.show.name:'')||'').slice(0,120),
    device:isObj(d.device)?String(d.device.name||'').slice(0,60):'',art:SPOTIFY_ART_RE.test(art)?art:''};
}
async function musicPoll(){
  if(!musicOn()||(typeof document!=='undefined'&&document.hidden))return;
  try{Music.now=musicNowFrom(await musicApi('GET','/me/player?additional_types=track,episode'));Music.err='';}
  catch(e){Music.err=errText(e);if(e.status===401){Music.now=null;musicStop();}}
  musicPaint();
}
async function musicCmd(c){
  if(Music.busy)return;Music.busy=true;
  const n=Music.now;
  try{
    if(c==='toggle'){
      if(n&&n.playing){await musicApi('PUT','/me/player/pause');n.playing=false;}
      else{await musicApi('PUT','/me/player/play');if(n)n.playing=true;}
    }else if(c==='next')await musicApi('POST','/me/player/next');
    else if(c==='prev')await musicApi('POST','/me/player/previous');
    Music.err='';
  }catch(e){Music.err=errText(e);toast(Music.err,'',{ms:4500});}
  Music.busy=false;musicPaint();
  setTimeout(musicPoll,800); // Spotify takes a moment to report the new track
}
// Poll only while a workout is on screen and the app is in front.
function musicSync(){
  const want=musicOn()&&sessionActive()&&S.tab==='workout'&&!(typeof document!=='undefined'&&document.hidden);
  if(want&&!Music.timer){Music.timer=setInterval(musicPoll,MUSIC_POLL_MS);musicPoll();}
  else if(!want)musicStop();
}
function musicStop(){if(Music.timer){clearInterval(Music.timer);Music.timer=null;}}

// ─── The bar in a workout ───
function musicBarHTML(){return musicOn()?`<div id="music-bar" class="music-bar">${musicBarInner()}</div>`:'';}
function musicBarInner(){
  const n=Music.now;
  const ic=`<span class="mb-ic${n&&n.playing?' on':''}">${n&&n.art?`<img src="${esc(n.art)}" alt="" referrerpolicy="no-referrer">`:ICON('music',15)}</span>`;
  if(!n)return`${ic}<span class="mb-t"><b>${Music.err?'Spotify':'Nothing playing'}</b><i>${esc(Music.err||'Start something in Spotify, then control it from here.')}</i></span>
    <a class="mb-b mb-open" href="https://open.spotify.com/" target="_blank" rel="noopener">Open</a>`;
  return`${ic}<span class="mb-t"><b>${esc(n.title)}</b><i>${esc(n.artist)}${n.device?` · ${esc(n.device)}`:''}</i></span>
    <button class="mb-b" onclick="musicCmd('prev')" aria-label="Previous track">${ICON('prev',17)}</button>
    <button class="mb-b mb-p" onclick="musicCmd('toggle')" aria-label="${n.playing?'Pause':'Play'}">${ICON(n.playing?'pause':'play',17)}</button>
    <button class="mb-b" onclick="musicCmd('next')" aria-label="Next track">${ICON('next',17)}</button>`;
}
function musicPaint(){const el=document.getElementById('music-bar');if(el)el.innerHTML=musicBarInner();}

// ─── Setup sheet ───
function showMusicSetup(){
  const ov=makeOv('mu-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div id="mu-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);renderMusicSetup();
}
function renderMusicSetup(){
  const el=document.getElementById('mu-body');if(!el)return;
  const m=musicRead();const on=musicOn();const can=musicCanRun();const uri=musicRedirectUri();
  el.innerHTML=`<div class="mt" style="margin-bottom:4px">Music</div>
    <div class="sheet-sub">A Spotify remote in your workout: the track that is playing, with play, pause and skip. It controls Spotify on whatever device is already playing; it does not play music itself.</div>
    ${on?`<div class="ai-ok" style="margin:0 0 12px">Connected. The controls appear at the top of a workout.</div>`:''}
    ${Music.setupMsg?`<div class="coach-err">${esc(Music.setupMsg)}</div>`:''}
    ${can?'':`<div class="note-box">Spotify sign-in needs the web page (https). It cannot work from a file saved on a computer.</div>`}
    ${can?`    <div class="note-box"><b>What you need</b><br>Spotify Premium (Spotify refuses playback control for free accounts), and your own free Spotify developer app. Spotify allows five people per developer app, so each person uses their own, the same as with the AI key.</div>
    <details class="fold"${on||m.clientId?'':' open'}><summary>How to get a client ID (about two minutes)</summary>
      <div class="rule-u">1. On a computer or in Safari, open <b>developer.spotify.com/dashboard</b> and sign in with your Spotify account.</div>
      <div class="rule-u">2. <b>Create app</b>. Any name and description. For the API, tick <b>Web API</b>.</div>
      <div class="rule-u">3. Under <b>Redirect URIs</b>, add exactly this address, then Save:</div>
      <textarea id="mu-uri" readonly rows="2" style="font-size:12px;min-height:0;word-break:break-all">${esc(uri)}</textarea>
      <button class="btn bts bsm" style="margin:6px 0 8px" onclick="musicCopy('mu-uri')">Copy the address</button>
      <div class="rule-u">4. Open the app’s Settings and copy the <b>Client ID</b>. Leave the client secret alone: this app never needs it and you should not paste it anywhere.</div>
    </details>
    <div class="fg" style="margin-top:12px"><label class="fl">Spotify client ID</label>
      <input type="text" id="mu-id" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(m.clientId||'')}" placeholder="32 letters and numbers"></div>
    <div class="sheet-acts" style="margin-top:0">
      <button class="btn bts" id="mu-save" onclick="musicSaveId()">Save ID</button>
      <button class="btn btp" id="mu-connect" onclick="musicConnect()"${m.clientId&&can?'':' disabled'}>${on?'Connect again':'Connect Spotify'}</button>
    </div>
    <details class="fold"><summary>Finish connecting (only if Spotify sent you to the browser)</summary>
      <div class="rule-u">Paste the code from the “One more step” screen.</div>
      <textarea id="mu-paste" rows="2" style="font-size:12px;min-height:0" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>
      <button class="btn bts bsm" style="margin-top:6px" onclick="musicPasteReturn()">Finish</button>
    </details>
`:''}
    <div class="fine">Stored on this device only: the client ID and the sign-in Spotify returns. Neither is in your backups. Sent only to Spotify. YouTube is not offered: a web page cannot control the YouTube app, and a player inside this page would stop when the phone locks.</div>
    ${on||m.clientId?`<button class="btn btg bfw" style="color:var(--red)" onclick="musicDisconnect()">${on?'Disconnect and forget the ID':'Forget the ID'}</button>`:''}
    <button class="btn btg bfw" onclick="closeOv('mu-ov')">Done</button>`;
}
function musicSaveId(){
  Music.setupMsg=musicSetClientId(document.getElementById('mu-id')?.value);
  renderMusicSetup();
  if(!Music.setupMsg)toast('Client ID saved','green');
}
function musicDisconnect(){musicClear();Music.setupMsg='';renderMusicSetup();if(document.getElementById('set-ov'))refreshSettings();if(S.tab==='workout')rerender();toast('Spotify disconnected');}
