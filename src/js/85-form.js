// ═══════════════════════════════════════════════════
// FORM — the how-to sheet for an exercise (Library and mid-workout)
// ═══════════════════════════════════════════════════
// Two photos (start and finish) take turns, which reads as the movement. Nothing is fetched until a
// sheet with photos is opened; the box has a fixed shape so the sheet never jumps while they load;
// they fade in only once both are ready. The service worker keeps them after the first view, and a
// workout warms them up in the background so the Form button is instant in the gym. They are
// fetched with CORS (jsDelivr allows it) so the saved copies are ordinary responses: an opaque
// one would be counted against the phone's storage at several megabytes each.
function formFor(exId){return(typeof FORM!=='undefined'&&FORM[exId])||null;}
function formImg(f,n){return f&&f.img?`${FORM_CDN}${encodeURIComponent(f.img).replace(/%2F/g,'/')}/${n}.jpg`:'';}
// The muscles it works, as words.
function formMuscleText(exId){
  const m=exMuscles(exId);
  return[m.pm,...m.sec].filter(Boolean).map((x,i)=>i===0?x:x.toLowerCase()).join(', ');
}
function formPhotosHTML(exId,f,small){
  if(!f||!f.img)return'';
  const name=exName(exId);
  return`<div class="fm-ph${small?' fm-sm':''}" id="fm-ph-${esc(exId)}" role="img" aria-label="${esc(name)}: start and finish positions" onclick="this.classList.toggle('paused')">
    <img alt="" src="${esc(formImg(f,0))}" crossorigin="anonymous" decoding="async" onload="formLoaded(this)" onerror="formFailed(this)">
    <img alt="" src="${esc(formImg(f,1))}" crossorigin="anonymous" decoding="async" loading="lazy" onload="formLoaded(this)" onerror="formFailed(this)">
    <span class="fm-wait">Loading photos…</span>
    ${f.near?'<span class="fm-near">Close variation</span>':''}
  </div>`;
}
function formLoaded(img){const box=img.parentNode;if(!box)return;box.dataset.n=String((parseInt(box.dataset.n)||0)+1);if(box.dataset.n==='2')box.classList.add('ready');else box.classList.add('one');}
function formFailed(img){
  // Should the CDN ever stop allowing CORS, load it the plain way rather than not at all.
  if(img.getAttribute('crossorigin')!=null&&navigator.onLine!==false){const src=img.src;img.removeAttribute('crossorigin');img.src='';img.src=src;return;}
  const box=img.parentNode;if(!box||box.classList.contains('failed'))return;box.classList.add('failed');const w=box.querySelector('.fm-wait');if(w)w.textContent='Photos load the first time you are online.';}
function formStepsHTML(f){return f&&f.steps&&f.steps.length?`<ol class="fm-steps">${f.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:'';}
function formTipsHTML(f){return f&&f.tips&&f.tips.length?`<ul class="fm-tips">${f.tips.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:'';}
function formWatchLink(exId){
  return`<a class="fm-yt" href="https://www.youtube.com/results?search_query=${encodeURIComponent(exName(exId)+' form')}" target="_blank" rel="noopener noreferrer">${ICON('play',13)} Watch videos of it on YouTube</a>`;
}
// The full sheet, opened from a workout's Form button or the exercise sheet.
function showForm(exId){
  const ex=getEx(exId);if(!ex)return;const f=formFor(exId);
  const ov=makeOv('form-ov');
  const mus=formMuscleText(exId);
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div>
    <div class="mt" style="margin-bottom:2px">${esc(ex.name)}</div>
    <div class="sheet-sub">${esc([ex.eq,ex.each?'each side':'',mus].filter(Boolean).join(' · '))}</div>
    ${formPhotosHTML(exId,f,false)}
    ${f?`<div class="sec-h">How to do it</div>${formStepsHTML(f)}<div class="sec-h">Tips</div>${formTipsHTML(f)}`
      :`<div class="ch-empty">This is one of your own exercises, so there are no steps for it yet. Its note in your workout is the place for cues.</div>`}
    ${formWatchLink(exId)}
    ${f&&f.img?`<div class="fine">Photos: free-exercise-db, public domain. Tap them to pause.</div>`:''}
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
// The compact version inside the exercise sheet: photos and tips, steps one tap away.
function formBlockHTML(exId){
  const f=formFor(exId);if(!f)return'';
  return`<div class="sec-h sec-h-act"><span>Form</span><button class="lnk" onclick="showForm(${jsq(exId)})">All steps</button></div>
    ${formPhotosHTML(exId,f,true)}${formTipsHTML(f)}`;
}
// Warm the photos for a workout's exercises in the background, a few seconds after it starts,
// unless the phone asks to save data.
let _formWarm=new Set();
function formPrefetch(ids){
  try{
    if(typeof window==='undefined'||typeof Image==='undefined')return;
    const c=navigator.connection;if(c&&(c.saveData||/2g/.test(c.effectiveType||'')))return;
    if(navigator.onLine===false)return;
    const todo=[...new Set(ids)].filter(id=>{const f=formFor(id);return f&&f.img&&!_formWarm.has(id);});
    if(!todo.length)return;
    setTimeout(()=>{todo.forEach((id,i)=>{setTimeout(()=>{_formWarm.add(id);const f=formFor(id);[0,1].forEach(n=>{const im=new Image();im.crossOrigin='anonymous';im.decoding='async';im.src=formImg(f,n);});},i*400);});},3000);
  }catch(e){}
}
