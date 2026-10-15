// ═══════════════════════════════════════════════════
// YOUTUBE PLAYER (inside the Music sheet)
// ═══════════════════════════════════════════════════
// YouTube's own embedded player, in a sheet. It is the only way YouTube allows a page to play its
// videos: no audio is pulled out of the stream, and the player is not hidden. A web page cannot
// keep it playing once the phone locks or the app is left, so the sheet says so and offers the
// YouTube app for that.
const YT_KEY='lahwe-yt-v1';
const YT_VIDEO=/^[A-Za-z0-9_-]{11}$/,YT_LIST=/^[A-Za-z0-9_-]{10,60}$/;
// A pasted address → {kind:'video'|'playlist', id, list?}. Anything else → null. The ids are
// checked against a strict pattern because they end up in an address and in markup.
function ytParse(str){
  str=String(str||'').trim();if(!str||str.length>300)return null;
  let u;try{u=new URL(/^https?:\/\//i.test(str)?str:'https://'+str);}catch(e){return null;}
  const host=u.hostname.replace(/^(www\.|m\.|music\.)/i,'').toLowerCase();
  let v='',list=u.searchParams.get('list')||'';
  if(host==='youtu.be')v=u.pathname.slice(1).split('/')[0];
  else if(host==='youtube.com'||host==='youtube-nocookie.com'){
    const parts=u.pathname.split('/').filter(Boolean);
    if(parts[0]==='watch')v=u.searchParams.get('v')||'';
    else if(['shorts','embed','live','v'].includes(parts[0]))v=parts[1]||'';
  }else return null;
  const okV=YT_VIDEO.test(v),okL=YT_LIST.test(list);
  if(okV)return{kind:'video',id:v,list:okL?list:''};
  if(okL)return{kind:'playlist',id:list,list};
  return null;
}
function ytEmbedSrc(p){
  const base='https://www.youtube-nocookie.com/embed/';
  const q='playsinline=1&rel=0&modestbranding=1';
  if(p.kind==='playlist')return`${base}videoseries?list=${encodeURIComponent(p.id)}&${q}`;
  return`${base}${encodeURIComponent(p.id)}?${q}${p.list?'&list='+encodeURIComponent(p.list):''}`;
}
function ytWatchUrl(p){
  if(p.kind==='playlist')return`https://www.youtube.com/playlist?list=${encodeURIComponent(p.id)}`;
  return`https://www.youtube.com/watch?v=${encodeURIComponent(p.id)}${p.list?'&list='+encodeURIComponent(p.list):''}`;
}
function ytRead(){try{const o=JSON.parse(localStorage.getItem(YT_KEY)||'null');return o&&YT_LIST.test(String(o.id||''))&&(o.kind==='video'||o.kind==='playlist')?{kind:o.kind,id:o.id,list:YT_LIST.test(String(o.list||''))?o.list:''}:null;}catch(e){return null;}}
function ytWrite(p){try{if(p)localStorage.setItem(YT_KEY,JSON.stringify(p));else localStorage.removeItem(YT_KEY);return true;}catch(e){return false;}}
function ytSaveLink(){
  const raw=document.getElementById('yt-in')?.value||'';
  if(!raw.trim()){ytWrite(null);Music.setupMsg='';renderMusicSetup();return;}
  const p=ytParse(raw);
  if(!p){Music.setupMsg='That is not a YouTube video or playlist address. Paste the link from YouTube’s Share button.';renderMusicSetup();return;}
  ytWrite(p);Music.setupMsg='';renderMusicSetup();toast('YouTube link saved','green');
}
function ytSectionHTML(){
  const p=ytRead();
  return`<div class="sec-h" style="margin-top:16px">YouTube</div>
    <div class="sheet-sub">Paste a video or playlist link and play it in a window inside the app. It plays with the screen on. It stops when the phone locks or you leave the app; for that, open it in the YouTube app (background play needs YouTube Premium).</div>
    <div class="frow"><input type="text" id="yt-in" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="youtube.com/watch?v=… or a playlist" value="${p?esc(ytWatchUrl(p)):''}" style="flex:1"><button class="btn bts bsm" onclick="ytSaveLink()">Save</button></div>
    ${p?`<div class="sheet-acts" style="margin-top:8px"><button class="btn btp" onclick="ytPlay()">${ICON('play',13)} Play here</button><a class="btn bts" href="${esc(ytWatchUrl(p))}" target="_blank" rel="noopener">Open in YouTube</a></div>`:''}`;
}
function ytPlay(){
  const p=ytRead();if(!p){toast('Save a YouTube link first','red');return;}
  const ov=makeOv('yt-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">YouTube</div>
    <div class="yt-frame"><iframe src="${esc(ytEmbedSrc(p))}" title="YouTube player" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
    <div class="fine">Plays while this window is open. Closing it stops the music.</div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
