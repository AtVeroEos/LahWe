// ═══════════════════════════════════════════════════
// PROGRESS PHOTOS — kept on this phone, never sent anywhere
// ═══════════════════════════════════════════════════
// S.photos says what each photo is (date, pose, weight that day, note). The pictures live in the
// device database under "photo:<id>" as {v:1,full,thumb}: JPEG data URLs, the full one at most
// 1200 px on its long side (about 150 KB), the thumb 320 px. They stay out of the main backup so it
// stays small and quick to save; the Photos sheet saves them to a file of their own, and Restore in
// Settings reads either file. Nothing here is ever given to the coach.
const PHOTO_KEY='photo:';
const PHOTO_POSES=[{id:'front',l:'Front'},{id:'side',l:'Side'},{id:'back',l:'Back'},{id:'other',l:'Other'}];
const Photos={
  thumbs:new Map(), // id → thumb, filled as they are shown
  mem:new Map(),    // id → record: the only copy where there is no device database
  async put(id,rec){
    this.thumbs.set(id,rec.thumb);
    if(!Store.db){this.mem.set(id,rec);return true;}
    return Store.idbSet(PHOTO_KEY+id,rec);
  },
  async get(id){
    if(this.mem.has(id))return this.mem.get(id);
    if(!Store.db)return null;
    const r=await Store.idbGet(PHOTO_KEY+id);
    return isObj(r)&&r.v===1&&typeof r.full==='string'?r:null;
  },
  async del(ids){
    ids=Array.isArray(ids)?ids:[ids];
    ids.forEach(id=>{this.mem.delete(id);this.thumbs.delete(id);});
    if(Store.db&&ids.length)await Store.idbDel(ids.map(id=>PHOTO_KEY+id));
  },
};
function photoPose(id){return(PHOTO_POSES.find(p=>p.id===id)||PHOTO_POSES[0]).l;}
// The weigh-in nearest the photo's date, within three days.
function weightNear(ds){
  let best=null;(S.bodyweightLog||[]).forEach(b=>{const d=Math.abs(dayDiff(b.date,ds));if(d<=3&&(!best||d<best.d))best={d,w:b.weight};});
  return best?best.w:null;
}
function dayDiff(a,b){return Math.round((dayDate(a)-dayDate(b))/86400000);}
// First and latest of the pose with the most photos: the pair worth comparing.
function photoPair(pose){
  const ps=S.photos||[];if(ps.length<2)return null;
  if(!pose){const n={};ps.forEach(p=>{n[p.pose]=(n[p.pose]||0)+1;});pose=Object.keys(n).sort((a,b)=>n[b]-n[a])[0];}
  const same=ps.filter(p=>p.pose===pose);if(same.length<2)return null;
  return[same[same.length-1],same[0]]; // S.photos is newest first
}

// ─── Showing them without holding them all in memory ───
// Images are written with data-ph (thumb) or data-phf (full) and no src; this fills them in.
let _phHyd=null;
function photoHydrateSoon(){if(_phHyd)return;_phHyd=setTimeout(()=>{_phHyd=null;photoHydrate();},0);}
async function photoHydrate(){
  if(typeof document==='undefined')return;
  const imgs=[...document.querySelectorAll('img[data-ph]:not([src]),img[data-phf]:not([src])')];
  for(const img of imgs){
    const full=!!img.dataset.phf;const id=full?img.dataset.phf:img.dataset.ph;
    let src=full?null:Photos.thumbs.get(id);
    if(!src){const r=await Photos.get(id);if(r){src=full?r.full:r.thumb;Photos.thumbs.set(id,r.thumb);}}
    if(src)img.src=src;else img.classList.add('ph-miss');
  }
  const note=document.getElementById('ph-missnote');if(note&&document.querySelector('#ph-body .ph-miss'))note.hidden=false;
}
function phImg(p,full,cls){return`<img ${full?'data-phf':'data-ph'}="${esc(p.id)}" alt="${esc(photoPose(p.pose)+', '+fmtDay(p.date))}" class="${cls||''}" decoding="async">`;}

// ─── Adding one ───
function photoShrinkTo(img,max,q){
  const w0=img.naturalWidth||img.width,h0=img.naturalHeight||img.height;
  const r=Math.min(1,max/Math.max(w0,h0));const w=Math.max(1,Math.round(w0*r)),h=Math.max(1,Math.round(h0*r));
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,0,0,w,h);
  return c.toDataURL('image/jpeg',q);
}
function photoShrink(file){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file);const img=new Image();
    img.onload=()=>{try{res({full:photoShrinkTo(img,1200,0.8),thumb:photoShrinkTo(img,320,0.72)});}catch(e){rej(e);}finally{URL.revokeObjectURL(url);}};
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('unreadable image'));};
    img.src=url;
  });
}
function photoPick(){
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
  inp.style.display='none';document.body.appendChild(inp); // in the document, for iOS to deliver the change
  inp.onchange=async e=>{
    const f=e.target.files&&e.target.files[0];inp.remove();if(!f)return;
    if(f.size>40e6){toast('That file is too large for a photo','red');return;}
    let out;try{out=await photoShrink(f);}catch(err){toast('That photo could not be read','red');return;}
    window._phNew=out;showPhotoAdd();
  };
  inp.click();
}
function showPhotoAdd(){
  const n=window._phNew;if(!n)return;
  const last=(S.photos||[])[0];const pose=last?last.pose:'front';
  const ov=makeOv('ph-add-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div class="mt" style="margin-bottom:10px">New photo</div>
    <div class="ph-prev"><img src="${n.thumb}" alt="The photo you chose"></div>
    <div class="fg"><label class="fl">Pose</label><div class="seg seg-in" id="ph-pose" role="radiogroup">${PHOTO_POSES.map(p=>`<button class="seg-b${p.id===pose?' on':''}" data-p="${p.id}" onclick="phSegPick(this)">${p.l}</button>`).join('')}</div></div>
    <div class="fg"><label class="fl">Date</label><input type="date" id="ph-date" value="${today()}" max="${today()}"></div>
    <div class="fg"><label class="fl">Note</label><input type="text" id="ph-note" maxlength="120" placeholder="Optional, e.g. morning, fasted"></div>
    <button class="btn btp bfw" onclick="savePhotoNew()">Save photo</button>
    <div class="fine">It stays on this phone. Same spot, same light and the same time of day make photos far easier to compare.</div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function phSegPick(b){b.parentNode.querySelectorAll('.seg-b').forEach(x=>x.classList.toggle('on',x===b));}
async function savePhotoNew(){
  const n=window._phNew;if(!n)return;
  const pose=document.querySelector('#ph-pose .seg-b.on')?.dataset.p||'front';
  let date=document.getElementById('ph-date')?.value||today();if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today())date=today();
  const note=(document.getElementById('ph-note')?.value||'').trim().slice(0,120);
  const id=uid();
  const ok=await Photos.put(id,{v:1,full:n.full,thumb:n.thumb});
  if(!ok){toast('The photo could not be saved: this app is out of space on the phone','red');return;}
  const rec={id,date,pose};const w=weightNear(date);if(w)rec.weight=w;if(note)rec.note=note;
  S.photos=normalizePhotos([rec,...(S.photos||[])]);window._phNew=null;save();
  closeOv('ph-add-ov');toast('Photo saved','green');photosRefresh();
}
function photosRefresh(){
  if(document.getElementById('ph-ov'))renderPhotos();
  if(document.getElementById('phc-ov'))renderPhotoCompare();
  if(typeof progRefresh==='function')progRefresh();
}

// ─── The sheet ───
function showPhotos(){
  const ov=makeOv('ph-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div id="ph-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);renderPhotos();
}
function renderPhotos(){
  const el=document.getElementById('ph-body');if(!el)return;
  const all=S.photos||[];
  const used=PHOTO_POSES.filter(p=>all.some(x=>x.pose===p.id));
  let pose=window._phPose||'all';if(pose!=='all'&&!used.some(p=>p.id===pose))pose='all';
  const list=all.filter(p=>pose==='all'||p.pose===pose);
  const months=[];list.forEach(p=>{const k=p.date.slice(0,7);let m=months.find(x=>x.k===k);if(!m)months.push(m={k,ps:[]});m.ps.push(p);});
  const mName=k=>new Date(k+'-15T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const pair=photoPair(pose==='all'?null:pose);
  el.innerHTML=`<div class="mt" style="margin-bottom:2px">Progress photos</div>
    <div class="sheet-sub">${all.length?`${all.length} photo${all.length===1?'':'s'} · kept on this phone only`:'Kept on this phone only'}</div>
    <div class="ph-acts"><button class="btn btp" onclick="photoPick()">${ICON('camera',15)} Add photo</button>${pair?`<button class="btn btg" onclick="showPhotoCompare()">Compare</button>`:''}</div>
    ${used.length>1?`<div class="seg seg-in" role="tablist"><button class="seg-b${pose==='all'?' on':''}" onclick="window._phPose='all';renderPhotos()">All</button>${used.map(p=>`<button class="seg-b${pose===p.id?' on':''}" onclick="window._phPose='${p.id}';renderPhotos()">${p.l}</button>`).join('')}</div>`:''}
    ${months.length?months.map(m=>`<div class="sec-h">${esc(mName(m.k))}</div><div class="ph-grid">${m.ps.map(p=>`<button class="ph-cell" onclick="showPhoto(${jsq(p.id)})">${phImg(p)}<span>${esc(fmtDay(p.date))}${p.weight?` · ${fmt1(p.weight)}`:''}</span></button>`).join('')}</div>`).join('')
      :`<div class="ch-empty">Take one every two to four weeks: the scale moves slowly and the mirror lies, but two photos side by side do not.</div>`}
    ${all.length?`<div class="ph-foot"><button class="lnk" onclick="showPhotoExport()">Save photos to a file</button><span>They are not in the main backup.</span></div>
      <div class="fine" id="ph-missnote" hidden>Some pictures are not on this phone (a backup carries the list, not the pictures). Restore your photos file in Settings to bring them back.</div>`:''}`;
  photoHydrateSoon();
}
function showPhoto(id){
  const p=(S.photos||[]).find(x=>x.id===id);if(!p)return;
  const pair=photoPair(p.pose);const first=pair?pair[0]:null;
  const ov=makeOv('ph-view-ov');
  ov.innerHTML=`<div class="modal" style="max-height:96vh"><div class="mh"></div>
    <div class="mt" style="margin-bottom:2px">${esc(fmtDate(p.date+'T12:00:00'))}</div>
    <div class="sheet-sub">${esc([photoPose(p.pose),p.weight?`${fmt1(p.weight)} ${S.unit}`:'',p.note||''].filter(Boolean).join(' · '))}</div>
    <div class="ph-full">${phImg(p,true)}</div>
    <div class="ph-acts">${first&&first.id!==p.id?`<button class="btn btg" onclick="closeOv('ph-view-ov');setTimeout(()=>showPhotoCompare(${jsq(first.id)},${jsq(p.id)}),220)">Compare with ${esc(fmtDay(first.date))}</button>`:''}
      <button class="btn btg ph-del" onclick="deletePhoto(${jsq(p.id)})">Delete</button></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);photoHydrateSoon();
}
// Deleting waits out the undo before the picture itself is removed.
function deletePhoto(id){
  const i=(S.photos||[]).findIndex(x=>x.id===id);if(i<0)return;
  const rec=S.photos[i];S.photos.splice(i,1);save();
  closeOv('ph-view-ov');photosRefresh();
  let undone=false;
  toast('Photo deleted','green',{action:'Undo',onAction:()=>{undone=true;S.photos=normalizePhotos([rec,...S.photos]);save();photosRefresh();},ms:7000});
  setTimeout(()=>{if(!undone&&!(S.photos||[]).some(x=>x.id===id))Photos.del(id);},8000);
}

// ─── Side by side, or one over the other with a slider ───
let _phc=null;
function showPhotoCompare(a,b){
  const pair=photoPair();
  _phc={a:a||(pair&&pair[0].id),b:b||(pair&&pair[1].id),mode:_phc&&_phc.mode||'side'};
  if(!_phc.a||!_phc.b)return;
  const ov=makeOv('phc-ov');
  ov.innerHTML=`<div class="modal" style="max-height:96vh"><div class="mh"></div><div id="phc-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);renderPhotoCompare();
}
function renderPhotoCompare(){
  const el=document.getElementById('phc-body');if(!el||!_phc)return;
  const A=(S.photos||[]).find(x=>x.id===_phc.a),B=(S.photos||[]).find(x=>x.id===_phc.b);
  if(!A||!B){closeOv('phc-ov');return;}
  const[x,y]=A.date<=B.date?[A,B]:[B,A];
  const days=dayDiff(y.date,x.date);const span=days>=14?`${Math.round(days/7)} weeks apart`:`${days} day${days===1?'':'s'} apart`;
  const dw=x.weight&&y.weight?y.weight-x.weight:null;
  const cap=p=>`<button class="phc-cap" onclick="showPhotoChoose(${jsq(p.id)})">${esc(fmtDay(p.date))}${p.weight?` · ${fmt1(p.weight)}`:''} ${ICON('chevdown',12)}</button>`;
  el.innerHTML=`<div class="mt" style="margin-bottom:2px">Compare</div>
    <div class="sheet-sub">${esc(span)}${dw!=null?` · ${fmtSigned(dw,1)} ${S.unit}`:''}</div>
    <div class="seg seg-in" role="tablist"><button class="seg-b${_phc.mode==='side'?' on':''}" onclick="_phc.mode='side';renderPhotoCompare()">Side by side</button><button class="seg-b${_phc.mode==='slide'?' on':''}" onclick="_phc.mode='slide';renderPhotoCompare()">Slider</button></div>
    ${_phc.mode==='side'
      ?`<div class="phc-side"><div>${phImg(x,true)}${cap(x)}</div><div>${phImg(y,true)}${cap(y)}</div></div>`
      :`<div class="phc-sl" id="phc-sl">${phImg(y,true)}<div class="phc-top" id="phc-top">${phImg(x,true)}</div><div class="phc-bar" id="phc-bar"></div>
        <input type="range" min="0" max="100" value="50" aria-label="Slide between the two photos" oninput="phcSlide(this.value)"></div>
        <div class="phc-caps">${cap(x)}${cap(y)}</div>`}
    <div class="fine">Tap a date to choose another photo.</div>`;
  photoHydrateSoon();
}
function phcSlide(v){const t=document.getElementById('phc-top'),b=document.getElementById('phc-bar');if(t)t.style.clipPath=`inset(0 ${100-v}% 0 0)`;if(b)b.style.left=v+'%';}
function showPhotoChoose(id){
  const ov=makeOv('phch-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div><div class="mt" style="margin-bottom:10px">Choose a photo</div>
    <div class="ph-grid">${(S.photos||[]).map(p=>`<button class="ph-cell${p.id===id?' ph-on':''}" onclick="phcChoose(${jsq(id)},${jsq(p.id)})">${phImg(p)}<span>${esc(fmtDay(p.date))} · ${esc(photoPose(p.pose))}</span></button>`).join('')}</div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);photoHydrateSoon();
}
function phcChoose(was,now){if(!_phc)return;if(_phc.a===was)_phc.a=now;else _phc.b=now;closeOv('phch-ov');renderPhotoCompare();}

// ─── Their own file ───
// The file is built while the sheet is open, so the tap on Save is the one that opens the share sheet
// (iOS refuses one opened after a wait).
let _phExport=null;
function showPhotoExport(){
  const ps=S.photos||[];if(!ps.length)return;
  _phExport=null;
  const ov=makeOv('phx-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt" style="margin-bottom:2px">Save photos</div>
    <div class="sheet-sub">${ps.length} photo${ps.length===1?'':'s'} in one file. Restore in Settings reads it back.</div>
    <button class="btn btp bfw" id="phx-go" disabled onclick="photoExportSave()">Getting them ready…</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  photoExportBuild().then(json=>{
    _phExport=json;const b=document.getElementById('phx-go');if(!b)return;
    if(!json){b.textContent='They could not be read';return;}
    b.disabled=false;b.textContent=`Save ${ps.length} photo${ps.length===1?'':'s'} · ${Math.max(1,Math.round(json.length/1048576))} MB`;
  });
}
async function photoExportBuild(){
  try{
    const out=[];
    for(const p of S.photos||[]){const r=await Photos.get(p.id);if(r)out.push(Object.assign({},p,{full:r.full,thumb:r.thumb}));}
    return JSON.stringify({_app:'lahwe-photos',_appVersion:APP_VERSION,_exportedAt:new Date().toISOString(),photos:out});
  }catch(e){logError(e,'photo export');return null;}
}
async function photoExportSave(){
  const json=_phExport;if(!json)return;const name=`lahwe-photos-${today()}.json`;
  try{
    if(typeof File!=='undefined'&&navigator.canShare){
      const file=new File([json],name,{type:'application/json'});
      if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'Lah We photos'});closeOv('phx-ov');toast('Photos saved','green');return;}
    }
  }catch(e){if(e&&e.name==='AbortError')return;}
  try{downloadText(name,json);closeOv('phx-ov');toast('Photos saved','green');}catch(e){toast('Saving failed','red');logError(e,'photo export');}
}
// A photos file chosen in Restore: added to what is here, never replacing it.
async function photosImport(data){
  const list=Array.isArray(data&&data.photos)?data.photos:[];
  const have=new Set((S.photos||[]).map(p=>p.id));let added=0;const recs=[];
  for(const p of list.slice(0,2000)){
    if(!isObj(p)||typeof p.full!=='string'||!/^data:image\/(jpeg|png|webp);base64,/.test(p.full))continue;
    const meta=normalizePhotos([p])[0];if(!meta)continue;
    // Listed already (a restored backup carries the list but not the pictures): only the picture is missing.
    if(have.has(meta.id)&&await Photos.get(meta.id))continue;
    const thumb=typeof p.thumb==='string'&&/^data:image\//.test(p.thumb)?p.thumb:p.full;
    if(!await Photos.put(meta.id,{v:1,full:p.full,thumb})){toast(`Stopped after ${added}: this app is out of space on the phone`,'red');break;}
    if(!have.has(meta.id)){recs.push(meta);have.add(meta.id);}
    added++;
  }
  S.photos=normalizePhotos([...recs,...(S.photos||[])]);save();
  toast(added?`${added} photo${added===1?'':'s'} added`:'Those photos are already here','green');
  photosRefresh();
  return added;
}
// Removing everything (Settings → Erase) takes the pictures too.
async function photosClearAll(){
  const ids=(S.photos||[]).map(p=>p.id);
  if(Store.db){const rows=await Store.idbAll(PHOTO_KEY);rows.forEach(r=>ids.push(String(r.key).slice(PHOTO_KEY.length)));}
  await Photos.del([...new Set(ids)]);
}
