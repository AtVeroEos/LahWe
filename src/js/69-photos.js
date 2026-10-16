// ═══════════════════════════════════════════════════
// PROGRESS PHOTOS — kept on this phone, never sent anywhere
// ═══════════════════════════════════════════════════
// S.photos says what each photo is (date, pose, weight that day, note). The pictures live in the
// device database under "photo:<id>" as {v:1,full,thumb}: JPEG data URLs, the full one at most
// 1200 px tall (about 150 KB), the thumb 320 px. Back up asks whether to include them: with them,
// the backup is one .zip holding the data and every photo as a plain JPEG, so unzipped in Files it
// is a folder you can look through. Nothing here is ever given to the coach, and photos taken in
// the app never go to the camera roll.
const PHOTO_KEY='photo:';
// side2 is the other side; 'other' only for photos added before the poses were fixed.
const PHOTO_POSES=[
  {id:'front',l:'Front',cue:'Face the camera, arms relaxed at your sides.'},
  {id:'side',l:'Side',cue:'Turn to your side. Arms down, stand tall.'},
  {id:'back',l:'Back',cue:'Turn your back to the camera.'},
  {id:'side2',l:'Other side',cue:'Turn to face the other way.'},
  {id:'other',l:'Other',cue:''},
];
// What a check-in takes, by the number chosen in Settings.
const PHOTO_SETS={1:['front'],2:['front','side'],3:['front','side','back'],4:['front','side','back','side2']};
const PHOTO_TIMERS=[0,3,10];
function photoSetPoses(){return PHOTO_SETS[S.photoSet]||PHOTO_SETS[2];}
const PHOTO_DUE_DAYS=14; // a check-in every two weeks: often enough to see change, rarely enough to see it
// Home's Photos tile. Never a picture on Home: a shirtless photo has no business on the first screen
// you show someone. Tapping takes the photos; on a day they were taken, it shows them instead.
function homePhotosArea(always){
  const days=photoDays();if(!days.length&&!always)return null;
  const n=photoSetPoses().length;const take=n===1?'a photo':`${n} photos`;
  if(!days.length)return{k:'Photos',icon:'camera',val:'–',unit:'',sub:`Take your first ${n===1?'photo':`${n} photos`}`,js:'photoCheckIn()'};
  const ago=Math.max(0,dayDiff(today(),days[0].date));
  if(ago===0){const k=Object.keys(days[0].ps).length;return{k:'Photos',icon:'camera',val:'Today',unit:'',sub:`${k} taken · tap to see`,tone:'good',js:'showPhotos()'};}
  const due=ago>=PHOTO_DUE_DAYS;
  return{k:'Photos',icon:'camera',val:String(ago),unit:ago===1?'day ago':'days ago',
    sub:due?`Due · tap to take ${take}`:`next in ${PHOTO_DUE_DAYS-ago} day${PHOTO_DUE_DAYS-ago===1?'':'s'}`,tone:due?'warn':'info',js:'photoCheckIn()'};
}
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
function photoPoseInfo(id){return PHOTO_POSES.find(p=>p.id===id)||PHOTO_POSES[0];}
function photoPose(id){return photoPoseInfo(id).l;}
// The weigh-in nearest the photo's date, within three days.
function weightNear(ds){
  let best=null;(S.bodyweightLog||[]).forEach(b=>{const d=Math.abs(dayDiff(b.date,ds));if(d<=3&&(!best||d<best.d))best={d,w:b.weight};});
  return best?best.w:null;
}
function dayDiff(a,b){return Math.round((dayDate(a)-dayDate(b))/86400000);}
// Check-ins: the photos of one day, one per pose, newest day first.
function photoDays(){
  const days=[];const by={};
  (S.photos||[]).forEach(p=>{let d=by[p.date];if(!d){d=by[p.date]={date:p.date,ps:{},weight:null};days.push(d);}if(!d.ps[p.pose])d.ps[p.pose]=p;if(p.weight&&!d.weight)d.weight=p.weight;});
  return days;
}
// The poses in use, in their fixed order: the columns of the sheet.
function photoCols(){const used=new Set((S.photos||[]).map(p=>p.pose));return PHOTO_POSES.map(p=>p.id).filter(id=>used.has(id));}
// First and latest of the pose with the most photos: the pair worth comparing.
function photoPair(pose){
  const ps=S.photos||[];if(ps.length<2)return null;
  if(!pose){const n={};ps.forEach(p=>{n[p.pose]=(n[p.pose]||0)+1;});pose=Object.keys(n).sort((a,b)=>n[b]-n[a]||PHOTO_POSES.findIndex(x=>x.id===a)-PHOTO_POSES.findIndex(x=>x.id===b))[0];}
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

// ─── Saving one ───
// The record is listed at once so the next pose can go ahead; the picture is written behind it.
// A photo of the same pose on the same day replaces the earlier one.
function photoSave(shot,o){
  const id=uid();const date=o.date||today();const pose=o.pose||'front';
  const was=(S.photos||[]).filter(p=>p.date===date&&p.pose===pose);
  const rec={id,date,pose};const w=weightNear(date);if(w)rec.weight=w;if(o.note)rec.note=String(o.note).slice(0,120);
  S.photos=normalizePhotos([rec,...(S.photos||[]).filter(p=>!was.includes(p))]);save();
  return Photos.put(id,{v:1,full:shot.full,thumb:shot.thumb}).then(ok=>{
    if(ok){if(was.length)Photos.del(was.map(p=>p.id));return true;}
    S.photos=normalizePhotos([...was,...S.photos.filter(p=>p.id!==id)]);save();photosRefresh();
    toast('A photo could not be saved: this app is out of space on the phone','red');return false;
  });
}
function photoShrinkTo(img,max,q){
  const w0=img.naturalWidth||img.videoWidth||img.width,h0=img.naturalHeight||img.videoHeight||img.height;
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
function photosRefresh(){
  if(document.getElementById('ph-ov'))renderPhotos();
  if(document.getElementById('phc-ov'))renderPhotoCompare();
  if(typeof progRefresh==='function')progRefresh();
}

// ─── A check-in: the camera, pose by pose ───
// Shutter, Keep, and it moves to the next pose by itself. With the self-timer on, one tap takes the
// whole set: each photo is kept after three seconds unless Retake is tapped, and the next count
// starts on its own, so the phone can sit on a shelf. If the live camera will not start, the
// phone's own camera is used instead, one tap per pose.
const PC={stream:null,token:0,poses:[],i:0,date:null,shot:null,cd:null,auto:null,live:false,fallback:false,paused:false};
function pcOpen(){return !!document.getElementById('pc-video');}
function pcFacing(){return S.photoFacing==='environment'?'environment':'user';}
function photoCheckIn(){
  if(!S.photoIntro){showPhotoIntro();return;}
  PC.poses=photoSetPoses().slice();PC.i=0;PC.date=today();PC.shot=null;PC.fallback=false;PC.live=false;
  const ov=makeOv('pc-ov');
  ov.innerHTML=`<div class="modal pc-modal" style="max-height:96vh"><div class="mh"></div>
    <div class="pc-head"><div class="pc-ht"><div class="mt" id="pc-title" style="margin:0"></div><div class="sheet-sub" id="pc-cue" style="margin:2px 0 0"></div></div>
      <button class="pc-chip" id="pc-timer" onclick="pcTimer()" aria-label="Self-timer"></button></div>
    <div class="pc-view" id="pc-view">
      <video id="pc-video" playsinline webkit-playsinline muted autoplay></video>
      <img id="pc-ghost" class="pc-ghost" alt="" hidden>
      <img id="pc-still" class="pc-still" alt="" hidden>
      <div class="pc-cd" id="pc-cd"></div>
      <div class="pc-msg" id="pc-msg">Starting camera…</div>
    </div>
    <div class="pc-dots" id="pc-dots"></div>
    <div class="pc-ctl" id="pc-ctl"></div>
    <input type="file" id="pc-file" accept="image/*" style="display:none" onchange="pcFile(this,false)">
    <input type="file" id="pc-cam" accept="image/*" capture="${pcFacing()}" style="display:none" onchange="pcFile(this,true)">
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  ov._onDismiss=pcTeardown;
  pcUpdate();
  pcStart(0); // no wait before this: the camera request has to come straight from the tap
}
// Said once, before the first photo: where photos go, and where they do not.
function showPhotoIntro(){
  const set=photoSetPoses();
  const ov=makeOv('ph-intro-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div>
    <div class="mt" style="margin-bottom:12px">Before your first photo</div>
    <div class="ph-intro">
      <div><span class="row-ic tone-info">${ICON('folder',18)}</span><p><b>Backups go to Files, in a folder you make once.</b> When you back up, the app asks whether to include photos, then your iPhone asks where to save. The app cannot make a folder for you: tap <i>Save to Files</i>, make a new folder (call it <i>Lah We</i>) and save into it. Your iPhone remembers the last folder you used, so every backup after that goes to the same place.</p></div>
      <div><span class="row-ic tone-info">${ICON('timer',18)}</span><p><b>${set.length===1?'One photo':`${set.length} photos`} each time: ${esc(set.map(photoPose).join(', ').toLowerCase())}.</b> Take one, tap Keep, and it moves to the next. With the self-timer on, one tap takes the whole set. Both are in Settings.</p></div>
    </div>
    <button class="btn btp bfw" onclick="S.photoIntro=true;save();closeOv('ph-intro-ov');photoCheckIn()">${ICON('camera',16)} Take photos</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function pcConstraints(level){
  const f=pcFacing();
  return[{video:{facingMode:{ideal:f},width:{ideal:1440},height:{ideal:1920}},audio:false},{video:{facingMode:f},audio:false},{video:true,audio:false}][Math.min(2,level||0)];
}
function pcRelease(){
  pcClearTimers();
  const v=document.getElementById('pc-video');
  if(v){try{v.pause();}catch(e){}try{v.srcObject=null;}catch(e){}}
  if(PC.stream){try{PC.stream.getTracks().forEach(t=>t.stop());}catch(e){}PC.stream=null;}
  PC.live=false;
}
function pcTeardown(){PC.token++;pcRelease();PC.shot=null;}
async function pcStart(level){
  const my=++PC.token;pcRelease();
  const v=document.getElementById('pc-video');if(!v)return;
  if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){pcFallback('This browser gives the app no live camera.');return;}
  pcMsg('Starting camera…');
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia(pcConstraints(level));}
  catch(e){
    if(my!==PC.token)return;
    if(e&&e.name==='NotAllowedError'){pcFallback('Camera access is off for this app. Allow it in Settings → Safari → Camera, or use the phone’s camera below.');return;}
    if((level||0)<2){pcStart((level||0)+1);return;}
    pcFallback('The live camera did not start. The phone’s camera works instead.');return;
  }
  if(my!==PC.token||!pcOpen()){try{stream.getTracks().forEach(t=>t.stop());}catch(e){}return;}
  PC.stream=stream;PC.fallback=false;
  v.muted=true;v.playsInline=true;v.srcObject=stream;
  try{await v.play();}catch(e){if(my===PC.token)pcMsg('<button class="btn btp bsm" onclick="pcTapPlay()">Tap to start the camera</button>');return;}
  if(my!==PC.token)return;
  PC.live=true;pcMsg('');pcUpdate();
}
function pcTapPlay(){const v=document.getElementById('pc-video');if(!v)return;v.play().then(()=>{PC.live=true;pcMsg('');pcUpdate();}).catch(()=>pcFallback('The live camera did not start. The phone’s camera works instead.'));}
function pcFallback(why){PC.fallback=true;PC.live=false;pcMsg(esc(why));pcUpdate();}
function pcMsg(html){const m=document.getElementById('pc-msg');if(m){m.innerHTML=html;m.hidden=!html;}}
function pcClearTimers(){if(PC.cd){clearTimeout(PC.cd);PC.cd=null;}if(PC.auto){clearInterval(PC.auto);PC.auto=null;}const c=document.getElementById('pc-cd');if(c)c.textContent='';}
// Leaving the app stops the camera (iOS otherwise leaves a frozen picture); coming back starts it.
function pcVisibility(){
  if(!pcOpen()||PC.fallback)return;
  if(document.visibilityState==='hidden'){if(PC.stream){PC.paused=true;PC.token++;pcRelease();pcUpdate();}}
  else if(PC.paused){PC.paused=false;pcStart(0);}
}
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',pcVisibility);

// Everything on the sheet that changes, from PC.
function pcUpdate(){
  if(!pcOpen())return;
  const pose=PC.poses[PC.i];const info=photoPoseInfo(pose);const n=PC.poses.length;
  const t=document.getElementById('pc-title');if(t)t.textContent=n>1?`${info.l} · ${PC.i+1} of ${n}`:info.l;
  const cue=document.getElementById('pc-cue');if(cue)cue.textContent=info.cue;
  const tm=document.getElementById('pc-timer');if(tm){const s=parseInt(S.photoTimer)||0;tm.innerHTML=`${ICON('timer',14)} ${s?s+' s':'Off'}`;tm.classList.toggle('on',!!s);tm.hidden=PC.fallback;}
  const view=document.getElementById('pc-view');if(view)view.classList.toggle('mirror',pcFacing()==='user'&&!PC.fallback);
  const still=document.getElementById('pc-still');
  if(still){if(PC.shot){still.src=PC.shot.full;still.hidden=false;still.classList.toggle('plain',!PC.shot.mirror);}else{still.hidden=true;still.removeAttribute('src');}}
  pcGhost(pose);
  const dots=document.getElementById('pc-dots');if(dots)dots.innerHTML=n>1?PC.poses.map((p,i)=>`<i class="${i<PC.i?'done':i===PC.i?'on':''}"></i>`).join(''):'';
  pcControls();
}
// The last photo of this pose, faint, to line up with.
function pcGhost(pose){
  const g=document.getElementById('pc-ghost');if(!g)return;
  const last=S.photoGhost===false||PC.shot||PC.fallback?null:(S.photos||[]).find(p=>p.pose===pose);
  if(!last){g.hidden=true;g.removeAttribute('src');g.dataset.id='';return;}
  if(g.dataset.id===last.id){g.hidden=false;return;}
  g.dataset.id=last.id;g.hidden=true;
  Photos.get(last.id).then(r=>{if(r&&g.dataset.id===last.id&&!PC.shot){g.src=r.full;g.hidden=false;}});
}
function pcControls(){
  const el=document.getElementById('pc-ctl');if(!el)return;
  const pose=photoPose(PC.poses[PC.i]).toLowerCase();
  if(PC.shot){
    el.innerHTML=`<button class="btn bts pc-wide" onclick="pcRetake()">Retake</button><button class="btn btp pc-wide" id="pc-keep" onclick="pcKeep()">${PC.i+1<PC.poses.length?'Keep · next':'Keep'}</button>`;
    return;
  }
  if(PC.fallback){
    el.innerHTML=`<button class="btn bts pc-side" onclick="pcLibrary()" aria-label="Choose from your photos">${ICON('grid',18)}</button>
      <button class="btn btp pc-wide" onclick="pcPhoneCamera()">${ICON('camera',16)} Take ${esc(pose)} photo</button>`;
    return;
  }
  el.innerHTML=`<button class="btn bts pc-side" onclick="pcLibrary()" aria-label="Choose from your photos">${ICON('grid',18)}</button>
    <button class="pc-shutter${PC.cd?' counting':''}" onclick="pcShutter()" aria-label="${PC.cd?'Stop the timer':'Take the photo'}"${PC.live?'':' disabled'}><span></span></button>
    <button class="btn bts pc-side" onclick="pcFlip()" aria-label="Switch camera">${ICON('repeat',18)}</button>`;
}
function pcTimer(){
  const i=PHOTO_TIMERS.indexOf(parseInt(S.photoTimer)||0);
  S.photoTimer=PHOTO_TIMERS[(i+1)%PHOTO_TIMERS.length];save();
  if(PC.cd){pcClearTimers();}
  pcUpdate();
}
function pcFlip(){
  S.photoFacing=pcFacing()==='user'?'environment':'user';save();
  const cam=document.getElementById('pc-cam');if(cam)cam.setAttribute('capture',pcFacing());
  pcUpdate();pcStart(0);
}
function pcShutter(){
  if(PC.cd){pcClearTimers();pcControls();return;} // a second tap stops the count
  if(!PC.live)return;
  const s=parseInt(S.photoTimer)||0;
  if(s>0)pcCountdown(s);else pcCapture();
}
function pcCountdown(n){
  pcClearTimers();let left=n;const my=PC.token;
  const tick=()=>{
    if(my!==PC.token||!pcOpen())return;
    const el=document.getElementById('pc-cd');
    if(left<=0){if(el)el.textContent='';PC.cd=null;pcCapture();return;}
    if(el){el.textContent=String(left);el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');}
    left--;PC.cd=setTimeout(tick,1000);
  };
  PC.cd=1;pcControls();tick();
}
// The frame on screen, cropped to the same 3:4 the view shows.
function pcGrab(){
  const v=document.getElementById('pc-video');if(!v||!v.videoWidth||!v.videoHeight)return null;
  const vw=v.videoWidth,vh=v.videoHeight;let sw=vw,sh=vh;
  if(vw/vh>0.75)sw=Math.round(vh*0.75);else sh=Math.round(vw/0.75);
  const sx=Math.round((vw-sw)/2),sy=Math.round((vh-sh)/2);
  const draw=(H,q)=>{const h=Math.min(H,sh),w=Math.round(h*0.75);const c=document.createElement('canvas');c.width=w;c.height=h;
    const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(v,sx,sy,sw,sh,0,0,w,h);return c.toDataURL('image/jpeg',q);};
  return{full:draw(1200,0.82),thumb:draw(320,0.72)};
}
function pcCapture(){
  const s=pcGrab();if(!s){toast('The camera is not ready yet');pcControls();return;}
  PC.shot=Object.assign(s,{mirror:pcFacing()==='user'});
  const view=document.getElementById('pc-view');if(view){view.classList.remove('flash');void view.offsetWidth;view.classList.add('flash');}
  pcUpdate();
  // With the timer on, the photo is kept by itself after three seconds: no need to come back to the phone.
  if((parseInt(S.photoTimer)||0)>0)pcAutoKeep(3);
}
function pcAutoKeep(n){
  let left=n;const b=()=>document.getElementById('pc-keep');
  const label=()=>{const k=b();if(k)k.textContent=`Keep · ${left}`;};
  label();
  PC.auto=setInterval(()=>{left--;if(left<=0){clearInterval(PC.auto);PC.auto=null;pcKeep();}else label();},1000);
}
function pcKeep(){
  if(PC.auto){clearInterval(PC.auto);PC.auto=null;}
  const shot=PC.shot;if(!shot)return;PC.shot=null;
  photoSave(shot,{date:PC.date,pose:PC.poses[PC.i]});
  PC.i++;
  if(PC.i>=PC.poses.length){pcDone();return;}
  pcUpdate();
  // Hands-free: the next pose counts down on its own.
  if(PC.live&&(parseInt(S.photoTimer)||0)>0)pcCountdown(parseInt(S.photoTimer));
}
function pcRetake(){if(PC.auto){clearInterval(PC.auto);PC.auto=null;}PC.shot=null;pcUpdate();}
function pcDone(){
  const n=PC.poses.length;closeOv('pc-ov');
  toast(n===1?'Photo saved':`${n} photos saved`,'green');photosRefresh();
}
function pcLibrary(){pcClearTimers();const f=document.getElementById('pc-file');if(f){f.value='';f.click();}}
function pcPhoneCamera(){const f=document.getElementById('pc-cam');if(f){f.value='';f.click();}}
// A photo from the library waits for Keep; one from the phone's camera was already confirmed there
// (Use Photo), so it is kept and the next pose is up.
async function pcFile(input,fromCamera){
  const f=input.files&&input.files[0];if(!f)return;
  if(f.size>40e6){toast('That file is too large for a photo','red');return;}
  let out;try{out=await photoShrink(f);}catch(e){toast('That photo could not be read','red');return;}
  if(!pcOpen())return;
  PC.shot=Object.assign(out,{mirror:false});
  if(fromCamera){pcKeep();return;}
  pcUpdate();
}

// ─── An older photo, with its date ───
function photoPickOld(){
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
  const ov=makeOv('ph-add-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div class="mt" style="margin-bottom:10px">Add a photo</div>
    <div class="ph-prev"><img src="${n.thumb}" alt="The photo you chose"></div>
    <div class="fg"><label class="fl">Pose</label><div class="seg seg-in" id="ph-pose" role="radiogroup">${PHOTO_POSES.filter(p=>p.id!=='other').map((p,i)=>`<button class="seg-b${i===0?' on':''}" data-p="${p.id}" onclick="phSegPick(this)">${p.l}</button>`).join('')}</div></div>
    <div class="fg"><label class="fl">Taken on</label><input type="date" id="ph-date" value="${today()}" max="${today()}"></div>
    <div class="fg"><label class="fl">Note</label><input type="text" id="ph-note" maxlength="120" placeholder="Optional, e.g. morning, fasted"></div>
    <button class="btn btp bfw" onclick="savePhotoNew()">Save photo</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function phSegPick(b){b.parentNode.querySelectorAll('.seg-b').forEach(x=>x.classList.toggle('on',x===b));}
function savePhotoNew(){
  const n=window._phNew;if(!n)return;
  const pose=document.querySelector('#ph-pose .seg-b.on')?.dataset.p||'front';
  let date=document.getElementById('ph-date')?.value||today();if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today())date=today();
  const note=(document.getElementById('ph-note')?.value||'').trim();
  photoSave(n,{date,pose,note});window._phNew=null;
  closeOv('ph-add-ov');toast('Photo saved','green');photosRefresh();
}

// ─── The sheet: one row a check-in, a column a pose ───
function showPhotos(){
  const ov=makeOv('ph-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div><div id="ph-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  _phShow=false;ov._onDismiss=()=>{_phShow=false;}; // hidden again next time
  renderPhotos();
}
// Pictures stay hidden in the list until Show is tapped (Settings can turn that off); one opened on
// purpose, or a comparison, shows them.
let _phShow=false;
function photosHidden(){return S.photoHide!==false&&!_phShow;}
function photosShow(on){_phShow=!!on;renderPhotos();}
function renderPhotos(){
  const el=document.getElementById('ph-body');if(!el)return;
  const days=photoDays();const cols=photoCols();const set=photoSetPoses();const hidden=photosHidden();
  const mName=k=>new Date(k+'-15T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'});
  let lastM='';
  const rows=days.map(d=>{
    const m=d.date.slice(0,7);const head=m!==lastM?`<div class="sec-h">${esc(mName(m))}</div>`:'';lastM=m;
    return head+`<div class="ph-day"><div class="ph-dh"><b>${esc(fmtDay(d.date))}</b>${d.weight?`<span>${fmt1(d.weight)} ${esc(S.unit)}</span>`:''}</div>
      <div class="ph-strip" style="--cols:${Math.max(cols.length,1)}">${cols.map(c=>d.ps[c]?`<button class="ph-cell" onclick="showPhoto(${jsq(d.ps[c].id)})" aria-label="${esc(photoPose(c)+', '+fmtDay(d.date))}">${hidden?`<span class="ph-hid">${ICON('camera',16)}<i>${esc(photoPose(c))}</i></span>`:phImg(d.ps[c])}</button>`:`<span class="ph-gap"></span>`).join('')}</div></div>`;
  }).join('');
  el.innerHTML=`<div class="mt" style="margin-bottom:2px">Progress photos</div>
    <div class="sheet-sub">${days.length?`${days.length} check-in${days.length===1?'':'s'} · `:''}${set.map(photoPose).join(', ')} each time · kept on this phone</div>
    <div class="ph-acts"><button class="btn btp" onclick="photoCheckIn()">${ICON('camera',15)} Take ${set.length===1?'a photo':`${set.length} photos`}</button>${days.length>=2&&photoComparePair()?`<button class="btn btg" onclick="showPhotoCompare()">Compare</button>`:''}${days.length&&S.photoHide!==false?`<button class="btn btg" onclick="photosShow(${hidden})">${hidden?'Show':'Hide'}</button>`:''}</div>
    ${days.length?`${cols.length>1?`<div class="ph-colh" style="--cols:${cols.length}">${cols.map(c=>`<span>${esc(photoPose(c))}</span>`).join('')}</div>`:''}${rows}`
      :`<div class="ch-empty">Every two to four weeks, same spot, same light, same time of day. The scale moves slowly; two photos side by side do not lie.</div>`}
    <div class="ph-foot"><span>How many each time, the self-timer, the line-up guide and hiding the pictures are in Settings. Back up can include the photos.</span><button class="lnk" onclick="photoPickOld()">Add an older photo</button></div>
    <div class="fine" id="ph-missnote" hidden>Some pictures are not on this phone (a backup without photos keeps the list, not the pictures). Restore a backup made with photos to bring them back.</div>`;
  photoHydrateSoon();
}
function showPhoto(id){
  const p=(S.photos||[]).find(x=>x.id===id);if(!p)return;
  const first=photoDays().slice().reverse().find(d=>d.ps[p.pose]);
  const ov=makeOv('ph-view-ov');
  ov.innerHTML=`<div class="modal" style="max-height:96vh"><div class="mh"></div>
    <div class="mt" style="margin-bottom:2px">${esc(fmtDate(p.date+'T12:00:00'))}</div>
    <div class="sheet-sub">${esc([photoPose(p.pose),p.weight?`${fmt1(p.weight)} ${S.unit}`:'',p.note||''].filter(Boolean).join(' · '))}</div>
    <div class="ph-full">${phImg(p,true)}</div>
    <div class="ph-acts">${first&&first.date!==p.date?`<button class="btn btg" onclick="closeOv('ph-view-ov');setTimeout(()=>showPhotoCompare(${jsq(first.date)},${jsq(p.date)},${jsq(p.pose)}),220)">Compare with ${esc(fmtDay(first.date))}</button>`:''}
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

// ─── Two check-ins, pose by pose: side by side, or one over the other with a slider ───
let _phc=null;
function photoComparePair(){
  const days=photoDays();if(days.length<2)return null;
  const p=photoPair();const pose=p?p[0].pose:null;if(!pose)return null;
  const has=days.filter(d=>d.ps[pose]);return has.length>=2?{a:has[has.length-1].date,b:has[0].date,pose}:null;
}
function showPhotoCompare(a,b,pose){
  const d=photoComparePair();if(!d&&!(a&&b))return;
  _phc={a:a||d.a,b:b||d.b,pose:pose||(d&&d.pose)||'front',mode:_phc&&_phc.mode||'side'};
  const ov=makeOv('phc-ov');
  ov.innerHTML=`<div class="modal" style="max-height:96vh"><div class="mh"></div><div id="phc-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);renderPhotoCompare();
}
function renderPhotoCompare(){
  const el=document.getElementById('phc-body');if(!el||!_phc)return;
  const days=photoDays();const A=days.find(d=>d.date===_phc.a),B=days.find(d=>d.date===_phc.b);
  if(!A||!B){closeOv('phc-ov');return;}
  const[x,y]=A.date<=B.date?[A,B]:[B,A];
  const poses=PHOTO_POSES.map(p=>p.id).filter(id=>x.ps[id]&&y.ps[id]);
  if(!poses.includes(_phc.pose))_phc.pose=poses[0]||_phc.pose;
  const px=x.ps[_phc.pose],py=y.ps[_phc.pose];
  const days_=dayDiff(y.date,x.date);const span=days_>=14?`${Math.round(days_/7)} weeks apart`:`${days_} day${days_===1?'':'s'} apart`;
  const dw=x.weight&&y.weight?y.weight-x.weight:null;
  const cap=(d,side)=>`<button class="phc-cap" onclick="showPhotoChoose('${side}')">${esc(fmtDay(d.date))}${d.weight?` · ${fmt1(d.weight)}`:''} ${ICON('chevdown',12)}</button>`;
  const sideOf=d=>d.date===_phc.a?'a':'b';
  el.innerHTML=`<div class="mt" style="margin-bottom:2px">Compare</div>
    <div class="sheet-sub">${esc(span)}${dw!=null?(Math.abs(dw)<0.05?' · same weight':` · ${fmtSigned(dw,1)} ${S.unit}`):''}</div>
    ${poses.length>1?`<div class="seg seg-in" role="tablist">${poses.map(p=>`<button class="seg-b${p===_phc.pose?' on':''}" onclick="_phc.pose='${p}';renderPhotoCompare()">${esc(photoPose(p))}</button>`).join('')}</div>`:''}
    ${px&&py?(_phc.mode==='side'
      ?`<div class="phc-side"><div>${phImg(px,true)}${cap(x,sideOf(x))}</div><div>${phImg(py,true)}${cap(y,sideOf(y))}</div></div>`
      :`<div class="phc-sl" id="phc-sl">${phImg(py,true)}<div class="phc-top" id="phc-top">${phImg(px,true)}</div><div class="phc-bar" id="phc-bar"></div>
        <input type="range" min="0" max="100" value="50" aria-label="Slide between the two photos" oninput="phcSlide(this.value)"></div>
        <div class="phc-caps">${cap(x,sideOf(x))}${cap(y,sideOf(y))}</div>`)
      :`<div class="ch-empty">These two days have no pose in common.</div>`}
    <div class="seg seg-in" role="tablist" style="margin-top:12px"><button class="seg-b${_phc.mode==='side'?' on':''}" onclick="_phc.mode='side';renderPhotoCompare()">Side by side</button><button class="seg-b${_phc.mode==='slide'?' on':''}" onclick="_phc.mode='slide';renderPhotoCompare()">Slider</button></div>
    <div class="fine">Tap a date to compare a different day.</div>`;
  photoHydrateSoon();
}
function phcSlide(v){const t=document.getElementById('phc-top'),b=document.getElementById('phc-bar');if(t)t.style.clipPath=`inset(0 ${100-v}% 0 0)`;if(b)b.style.left=v+'%';}
function showPhotoChoose(side){
  if(!_phc)return;const cur=side==='a'?_phc.a:_phc.b;
  const ov=makeOv('phch-ov');
  ov.innerHTML=`<div class="modal" style="max-height:90vh"><div class="mh"></div><div class="mt" style="margin-bottom:10px">Compare with</div>
    <div class="list">${photoDays().filter(d=>d.ps[_phc.pose]).map(d=>`<button class="row row-tap${d.date===cur?' row-on':''}" onclick="phcChoose('${side}',${jsq(d.date)})">
      <span class="ph-mini">${phImg(d.ps[_phc.pose])}</span><span class="row-main"><span class="row-t">${esc(fmtDay(d.date))}</span>${d.weight?`<span class="row-s">${fmt1(d.weight)} ${esc(S.unit)}</span>`:''}</span></button>`).join('')}</div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);photoHydrateSoon();
}
function phcChoose(side,date){if(!_phc)return;_phc[side]=date;closeOv('phch-ov');renderPhotoCompare();}

// ─── In the backup ───
// Back up asks first when there are photos. With them, the file is a .zip: data.json (the usual
// backup, plus which file each photo is and its thumb) and Photos/<date> <pose>.jpg. Nothing in
// it is compressed: the photos are JPEGs already, and a stored zip opens anywhere.
const _crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=_crcT[(c^u8[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
function zipStore(files,when){
  const enc=new TextEncoder();const d=when||new Date();
  const dosT=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1);
  const dosD=((Math.max(1980,d.getFullYear())-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  const parts=[],cen=[];let off=0;
  files.forEach(f=>{
    const name=enc.encode(f.name);const crc=crc32(f.data);const n=f.data.length;
    const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);
    h.setUint16(10,dosT,true);h.setUint16(12,dosD,true);h.setUint32(14,crc,true);h.setUint32(18,n,true);h.setUint32(22,n,true);
    h.setUint16(26,name.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),name,f.data);
    const c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);
    c.setUint16(12,dosT,true);c.setUint16(14,dosD,true);c.setUint32(16,crc,true);c.setUint32(20,n,true);c.setUint32(24,n,true);
    c.setUint16(28,name.length,true);c.setUint32(42,off,true);
    cen.push(new Uint8Array(c.buffer),name);
    off+=30+name.length+n;
  });
  const size=cen.reduce((t,x)=>t+x.length,0);
  const e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,off,true);
  return new Blob([...parts,...cen,new Uint8Array(e.buffer)],{type:'application/zip'});
}
function dataUrlBytes(u){const b=atob(String(u).slice(String(u).indexOf(',')+1));const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
function bytesDataUrl(u8,mime){let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return`data:${mime||'image/jpeg'};base64,${btoa(s)}`;}
// "2026-10-15 Front.jpg", "2026-10-15 Front 2.jpg" if a day has two.
function photoFileNames(list){
  const used=new Set();const out={};
  list.forEach(p=>{let base=`Photos/${p.date} ${photoPose(p.pose)}`,n=1,name=base+'.jpg';while(used.has(name)){n++;name=`${base} ${n}.jpg`;}used.add(name);out[p.id]=name;});
  return out;
}
// Reads every picture and builds the .zip. Returns {blob,n,missing}.
async function photosBackupBuild(json0){
  const data=JSON.parse(json0);const list=S.photos||[];const names=photoFileNames(list);
  const files=[],thumbs={},paths={};let missing=0;
  for(const p of list){
    const r=await Photos.get(p.id);if(!r){missing++;continue;}
    files.push({name:names[p.id],data:dataUrlBytes(r.full)});paths[p.id]=names[p.id];thumbs[p.id]=r.thumb;
  }
  data._photoFiles=paths;data._photoThumbs=thumbs;
  files.unshift({name:'data.json',data:new TextEncoder().encode(JSON.stringify(data))});
  return{blob:zipStore(files),n:files.length-1,missing};
}
// Takes the photo blocks out of a parsed backup (they never become part of S).
function photoFilesFromBackup(data){
  if(!isObj(data))return null;
  const files=isObj(data._photoFiles)?data._photoFiles:null,thumbs=isObj(data._photoThumbs)?data._photoThumbs:{};
  delete data._photoFiles;delete data._photoThumbs;
  return files?{files,thumbs}:null;
}
// After a restore from a .zip: each listed picture back into the device database.
async function photosRestoreZip(zip,entries,ph){
  const byName=new Map(entries.map(e=>[e.name,e]));let n=0;
  const ids=new Set((S.photos||[]).map(p=>p.id));
  for(const id of Object.keys(ph.files)){
    if(!ids.has(id))continue;
    const ent=byName.get(ph.files[id]);if(!ent)continue;
    try{
      const bytes=await zipExtract(zip,ent,30e6,'A photo');
      const full=bytesDataUrl(bytes);const t=ph.thumbs[id];
      if(await Photos.put(id,{v:1,full,thumb:typeof t==='string'&&/^data:image\//.test(t)?t:full}))n++;
    }catch(e){logError(e,'photo restore');}
  }
  return n;
}
// A photos-only file from 3.17.0 chosen in Restore: added to what is here, never replacing it.
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
// Removing everything (Settings → Reset) takes the pictures too.
async function photosClearAll(){
  const ids=(S.photos||[]).map(p=>p.id);
  if(Store.db){const rows=await Store.idbAll(PHOTO_KEY);rows.forEach(r=>ids.push(String(r.key).slice(PHOTO_KEY.length)));}
  await Photos.del([...new Set(ids)]);
}
