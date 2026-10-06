// ═══════════════════════════════════════════════════
// BARCODE SCANNER + OPEN FOOD FACTS
// ═══════════════════════════════════════════════════
// The camera part is written defensively, because it is the part that fails on phones:
//  - getUserMedia is called straight from the tap, before any wait, so the phone still counts it as
//    something the user asked for.
//  - A start that fails is retried with looser settings; a stream that opens but sends no picture
//    (iOS does this when the camera was not released cleanly) is detected and restarted.
//  - Leaving the app stops the camera; coming back starts it again.
//  - The app runs its own decode loop on the frames. It used to hand the <video> to the library,
//    which waits for a "playing" event that had already fired, so live scanning never started.
//  - If the live camera cannot be made to work, "Take a photo" uses the phone's own camera screen.
//  - When it still fails, the screen says which error the phone gave, so it can be fixed.
const SCAN_LIB_URL='https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
// The exact file is pinned: a changed or tampered copy from the CDN is refused by the browser.
const SCAN_LIB_SRI='sha384-BzBxP10ZE72aitqj5UMmUsbKFliP/DZqA8Wq+BNNhlIJDGoEd1tpkMYXOg9+n6sB';
const SCAN_TICK_MS=110,SCAN_DEAD_MS=2800,SCAN_MAX_RETRY=2;
const Scan={stream:null,token:0,timer:null,watch:null,retry:0,canvas:null,frames:0,since:0,torchTrack:null,torchOn:false,lib:null};

// ─── Barcode numbers ───
// A barcode ends up in element ids, a URL and storage keys: keep only what a barcode can contain.
function cleanBarcode(code){return String(code==null?'':code).replace(/[^0-9A-Za-z_\-]/g,'').slice(0,32);}
// GS1 check digit: the last digit of an 8, 12, 13 or 14 digit code is computed from the others.
function gtinCheck(d){
  if(!/^\d+$/.test(d)||d.length<8)return false;
  let s=0;
  for(let i=d.length-2,w=3;i>=0;i--,w=4-w)s+=Number(d[i])*w;
  return (10-s%10)%10===Number(d[d.length-1]);
}
// The short 8-digit UPC-E on small packages, written out as the full 12-digit UPC-A.
function upceToUpca(e){
  if(!/^[01]\d{7}$/.test(e))return null;
  const n=e[0],a=e.slice(1,7),c=e[7],l=a[5];
  let body;
  if(l==='0'||l==='1'||l==='2')body=a.slice(0,2)+l+'0000'+a.slice(2,5);
  else if(l==='3')body=a.slice(0,3)+'00000'+a.slice(3,5);
  else if(l==='4')body=a.slice(0,4)+'00000'+a[4];
  else body=a.slice(0,5)+'0000'+l;
  return n+body+c;
}
// '' when the digits are a real product barcode; otherwise what is wrong, in plain words.
function barcodeProblem(code){
  const d=String(code||'');
  if(!/^\d+$/.test(d))return'A product barcode is digits only.';
  if(![8,12,13,14].includes(d.length))return`A product barcode has 8, 12 or 13 digits. That was ${d.length}.`;
  if(gtinCheck(d))return'';
  if(d.length===8){const a=upceToUpca(d);if(a&&gtinCheck(a))return'';}
  return'One of the digits is off: the last digit does not match the rest. Check it against the package.';
}
// Every way the same product can be written: 12-digit UPC-A, the same with a leading 0 (EAN-13),
// and the full form of a short UPC-E. Saved foods and the lookup cache are found under any of them.
function barcodeForms(code){
  const d=cleanBarcode(code);const out=[d];
  const add=x=>{if(x&&!out.includes(x))out.push(x);};
  if(/^\d{12}$/.test(d))add('0'+d);
  if(/^0\d{12}$/.test(d))add(d.slice(1));
  if(/^\d{8}$/.test(d)){const a=upceToUpca(d);if(a&&gtinCheck(a)){add(a);add('0'+a);}}
  return out;
}
function cachedProductFor(code){
  for(const f of barcodeForms(code)){const p=S.foodCache&&S.foodCache[f];if(validProduct(p))return{product:p,barcode:f};}
  return null;
}

// ─── Decoder ───
function loadScript(src,sri){
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src;if(sri){s.integrity=sri;s.crossOrigin='anonymous';}
    s.onload=()=>resolve();s.onerror=()=>{s.remove();reject(new Error('load failed'));};
    document.head.appendChild(s);
  });
}
// The library ships next to the app when it is served from a web page (and is kept for offline use);
// a single saved file falls back to the pinned copy on the CDN.
function loadScannerLib(){
  if(window.ZXing&&window.ZXing.MultiFormatReader)return Promise.resolve();
  if(Scan.lib)return Scan.lib;
  const hosted=/^https?:$/.test(location.protocol);
  const first=hosted?loadScript('zxing.min.js'):Promise.reject(new Error('local file'));
  Scan.lib=first.catch(()=>loadScript(SCAN_LIB_URL,SCAN_LIB_SRI)).then(()=>{
    if(!(window.ZXing&&window.ZXing.MultiFormatReader))throw new Error('scanner library did not load');
  }).catch(e=>{Scan.lib=null;throw e;});
  return Scan.lib;
}
// Product barcodes only. The reader used to accept four warehouse formats as well, which turned
// blurry frames into made-up numbers and "Product not found".
function scanHints(hard){
  const Z=window.ZXing;const h=new Map();
  h.set(Z.DecodeHintType.POSSIBLE_FORMATS,[Z.BarcodeFormat.EAN_13,Z.BarcodeFormat.UPC_A,Z.BarcodeFormat.EAN_8,Z.BarcodeFormat.UPC_E]);
  if(hard)h.set(Z.DecodeHintType.TRY_HARDER,true);
  return h;
}
// Read one barcode from a canvas, or null. Only a number whose check digit holds is returned.
function decodeCanvas(canvas,hard){
  const Z=window.ZXing;if(!Z||!canvas.width||!canvas.height)return null;
  let src;try{src=new Z.HTMLCanvasElementLuminanceSource(canvas);}catch(e){return null;}
  for(const Bin of[Z.HybridBinarizer,Z.GlobalHistogramBinarizer]){
    try{
      const text=new Z.MultiFormatReader().decode(new Z.BinaryBitmap(new Bin(src)),scanHints(hard)).getText();
      if(text&&!barcodeProblem(text))return text;
    }catch(e){}
  }
  return null;
}
function scanCanvas(w,h){
  const c=Scan.canvas||(Scan.canvas=document.createElement('canvas'));
  if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;
  return c;
}
// One pass over the current video frame: the band inside the guide box (fast), and every fourth
// frame the whole picture with the slower search, for a barcode held off-centre or sideways.
function scanFrame(video){
  const vw=video.videoWidth,vh=video.videoHeight;if(!vw||!vh)return null;
  Scan.frames++;
  const bw=Math.round(vw*0.86),bh=Math.round(vh*0.34);
  const k=Math.min(1,1100/bw);
  let c=scanCanvas(Math.round(bw*k),Math.round(bh*k));
  let ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(video,Math.round((vw-bw)/2),Math.round((vh-bh)/2),bw,bh,0,0,c.width,c.height);
  let hit=decodeCanvas(c,false);
  if(hit||Scan.frames%4)return hit;
  const k2=Math.min(1,960/Math.max(vw,vh));
  c=scanCanvas(Math.round(vw*k2),Math.round(vh*k2));
  ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(video,0,0,c.width,c.height);
  return decodeCanvas(c,true);
}

// ─── Screen ───
function setScanStatus(msg,color){
  const el=document.getElementById('scan-status');if(!el)return;
  el.innerHTML=color?`<div style="color:${color};font-weight:600">${msg}</div>`:msg; // callers pass fixed strings or escaped text only
}
function scanOpen(){return !!document.getElementById('scan-video');}
function showBarcodeScanner(){
  // The meal being built stays open underneath, so cancelling the scan loses nothing.
  window._scanReturnToMeal=!!document.getElementById('meal-ov');
  const ov=makeOv('scan-ov');
  ov.innerHTML=`<div class="modal" style="max-height:96vh;padding-bottom:calc(26px + var(--sb))">
    <div class="mh"></div>
    <div class="mt" style="margin-bottom:12px">Scan a barcode</div>
    <div class="scan-view">
      <video id="scan-video" playsinline webkit-playsinline muted autoplay></video>
      <div class="scan-box"></div>
      <button id="torch-btn" class="scan-torch" onclick="toggleTorch()" style="display:none" aria-label="Light">${ICON('bulb',18)}</button>
    </div>
    <div id="scan-status" class="scan-status">Starting camera…</div>
    <div id="scan-detail" class="scan-detail"></div>
    <input type="file" id="scan-photo" accept="image/*" capture="environment" style="display:none" onchange="scanPhoto(this)">
    <div class="sheet-acts" style="margin-top:6px">
      <button class="btn bts" onclick="document.getElementById('scan-photo').click()">${ICON('camera',16)} Take a photo</button>
      <button class="btn bts" onclick="showManualBarcode()">Type the number</button>
    </div>
    <button class="btn btg bfw" style="margin-top:6px" onclick="stopScanner()">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  Scan.retry=0;
  startScanner(0); // no await before this point: the camera request has to come straight from the tap
  loadScannerLib().catch(()=>{});
}
function scanConstraints(level){
  return[{video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false},
    {video:{facingMode:'environment'},audio:false},
    {video:true,audio:false}][Math.min(2,Math.max(0,level||0))];
}
function scanReleaseStream(){
  if(Scan.timer){clearTimeout(Scan.timer);Scan.timer=null;}
  if(Scan.watch){clearTimeout(Scan.watch);Scan.watch=null;}
  if(Scan.torchTrack&&Scan.torchOn){try{Scan.torchTrack.applyConstraints({advanced:[{torch:false}]});}catch(e){}}
  Scan.torchTrack=null;Scan.torchOn=false;
  // Order matters on iOS: stop the picture, detach the stream from the element, then stop the tracks.
  const vid=document.getElementById('scan-video');
  if(vid){try{vid.pause();}catch(e){}try{vid.srcObject=null;}catch(e){}try{vid.removeAttribute('src');vid.load();}catch(e){}}
  if(Scan.stream){try{Scan.stream.getTracks().forEach(t=>t.stop());}catch(e){}Scan.stream=null;}
}
async function startScanner(level){
  const my=++Scan.token;
  const video=document.getElementById('scan-video');if(!video)return;
  scanReleaseStream();
  scanDetail('');
  if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){
    scanProblem(/^https?:$/.test(location.protocol)?'This browser gives web pages no camera.':'A saved file cannot use the camera on a phone. Open the app from its web page or Home Screen icon.','NoCameraApi');return;
  }
  setScanStatus('Starting camera…');
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia(scanConstraints(level));}
  catch(e){if(my===Scan.token)scanStartFailed(e,level||0);return;}
  if(my!==Scan.token||!scanOpen()){try{stream.getTracks().forEach(t=>t.stop());}catch(e){}return;} // closed while the phone was asking
  Scan.stream=stream;
  const track=stream.getVideoTracks()[0];
  if(track)track.addEventListener('ended',()=>{if(my===Scan.token&&scanOpen())scanRestart('The camera stopped.');});
  video.muted=true;video.playsInline=true;video.autoplay=true;
  video.srcObject=stream;
  // Armed before play(): a stream that never delivers a frame can leave play() waiting forever.
  scanArmWatch(my);
  try{await video.play();}
  catch(e){
    if(my!==Scan.token)return;
    if(Scan.watch){clearTimeout(Scan.watch);Scan.watch=null;}
    // The phone wants a tap before it will show video.
    setScanStatus('<button class="btn btp bsm" onclick="tapStartCamera()">Tap to start the camera</button>');
    return;
  }
  if(my!==Scan.token)return;
  scanRunning(my);
}
// A stream can open and still deliver nothing (iOS does this when the camera was not let go of
// cleanly last time). If no real frame has arrived after a moment, start over; then say so.
function scanArmWatch(my){
  if(Scan.watch)clearTimeout(Scan.watch);
  Scan.watch=setTimeout(()=>{
    Scan.watch=null;
    if(my!==Scan.token||!scanOpen())return;
    const v=document.getElementById('scan-video');const t=Scan.stream&&Scan.stream.getVideoTracks()[0];
    if(v&&v.videoWidth>0&&t&&t.readyState==='live')return;
    if(Scan.retry<SCAN_MAX_RETRY){Scan.retry++;setScanStatus('The camera opened without a picture. Starting it again…');startScanner(Scan.retry);}
    else scanProblem('The camera opened but sent no picture.','NoFrames');
  },SCAN_DEAD_MS);
}
function scanRunning(my){
  setupTorch();
  Scan.frames=0;Scan.since=Date.now();
  setScanStatus('Point the camera at the barcode');
  loadScannerLib().then(()=>{if(my===Scan.token)scanTick(my);})
    .catch(()=>{if(my===Scan.token)scanProblem('The barcode reader could not be loaded (no connection the first time it is used). Take a photo later, or type the number.','NoLibrary',true);});
}
function scanTick(my){
  if(my!==Scan.token)return;
  const video=document.getElementById('scan-video');if(!video)return;
  let hit=null;
  try{if(video.readyState>=2&&!video.paused)hit=scanFrame(video);}catch(e){}
  if(hit){onBarcodeDetected(hit);return;}
  if(Scan.frames===55)setScanStatus('Still looking. Hold the barcode 6 to 8 inches away so it fills the box, or take a photo.');
  Scan.timer=setTimeout(()=>scanTick(my),SCAN_TICK_MS);
}
async function tapStartCamera(){
  const v=document.getElementById('scan-video');if(!v)return;
  const my=Scan.token;
  scanArmWatch(my);
  try{await v.play();if(my===Scan.token)scanRunning(my);}
  catch(e){scanProblem('The camera would not start.',e&&e.name);}
}
function scanRestart(why){
  if(!scanOpen())return;
  if(Scan.retry<SCAN_MAX_RETRY){Scan.retry++;setScanStatus(esc(why)+' Starting it again…');setTimeout(()=>{if(scanOpen())startScanner(0);},350);}
  else scanProblem(why,'Stopped');
}
// What to tell the user for each way the phone can refuse.
function scanErrorText(name){
  if(name==='NotAllowedError'||name==='SecurityError')return'Camera access is turned off for this app. On an iPhone: Settings → Apps → Safari → Camera (on older iPhones, Settings → Safari → Camera), choose Ask or Allow, then come back and tap Try again. An app on the Home Screen follows Safari’s setting.';
  if(name==='NotFoundError'||name==='OverconstrainedError')return'No usable camera was found.';
  if(name==='NotReadableError'||name==='AbortError')return'The camera is busy or did not start. Close other apps that use the camera, then tap Try again.';
  return'The camera did not start.';
}
function scanStartFailed(e,level){
  const name=(e&&e.name)||'Error';
  // Looser settings for "no such camera"; a short wait for "busy", which is usually iOS still letting go of it.
  if((name==='OverconstrainedError'||name==='NotFoundError')&&level<2){startScanner(level+1);return;}
  if((name==='NotReadableError'||name==='AbortError')&&Scan.retry<SCAN_MAX_RETRY){
    Scan.retry++;setScanStatus('The camera is busy. Trying again…');
    const my=Scan.token;setTimeout(()=>{if(my===Scan.token&&scanOpen())startScanner(level);},600);return;
  }
  scanProblem(scanErrorText(name),name);
}
// A failure the user has to act on: what happened, the phone's own error name, and ways forward.
function scanProblem(text,code,noRetry){
  scanReleaseStream();
  setScanStatus(esc(text),'var(--red)');
  scanDetail(`${noRetry?'':`<button class="btn btp bsm" onclick="scanTryAgain()">Try again</button>`}<span>${code?`Reported by the phone: ${esc(String(code))}`:''}</span>`);
}
function scanDetail(html){const el=document.getElementById('scan-detail');if(el)el.innerHTML=html;}
function scanTryAgain(){Scan.retry=0;startScanner(0);}
function setupTorch(){
  try{
    const track=Scan.stream&&Scan.stream.getVideoTracks()[0];
    const caps=track&&track.getCapabilities?track.getCapabilities():{};
    const btn=document.getElementById('torch-btn');
    if(caps&&caps.torch){Scan.torchTrack=track;if(btn)btn.style.display='flex';}
    else{Scan.torchTrack=null;if(btn)btn.style.display='none';} // iPhones land here: the light is not offered to web pages
  }catch(e){Scan.torchTrack=null;}
}
async function toggleTorch(){
  if(!Scan.torchTrack)return;
  Scan.torchOn=!Scan.torchOn;
  try{
    await Scan.torchTrack.applyConstraints({advanced:[{torch:Scan.torchOn}]});
    const btn=document.getElementById('torch-btn');if(btn)btn.classList.toggle('on',Scan.torchOn);
  }catch(e){Scan.torchOn=!Scan.torchOn;}
}
// Stops everything the scanner holds. Safe to call at any time, any number of times.
function teardownScanner(){
  Scan.token++;
  scanReleaseStream();
}
function stopScanner(){
  teardownScanner();
  closeOv('scan-ov');
}
// Leaving the app with the camera on leaves a frozen picture behind on iOS: stop it, and start
// it again when the app comes back.
function scanVisibility(){
  if(!scanOpen())return;
  if(document.visibilityState==='hidden'){if(Scan.stream){teardownScanner();Scan.paused=true;}}
  else if(Scan.paused){Scan.paused=false;Scan.retry=0;startScanner(0);}
}
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',scanVisibility);

// ─── Photo instead of live video ───
// The phone's own camera screen focuses closer and takes a sharper picture than live video, and
// it works even when the live camera will not start.
function loadImageFile(file){
  if(typeof createImageBitmap==='function')return createImageBitmap(file).catch(()=>loadImageEl(file));
  return loadImageEl(file);
}
function loadImageEl(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('not an image'));};
    img.src=url;
  });
}
// Tries the picture at several sizes, whole and cropped to the middle, upright and turned.
function decodeImage(img){
  const iw=img.width||img.naturalWidth,ih=img.height||img.naturalHeight;if(!iw||!ih)return null;
  const c=document.createElement('canvas');
  for(const crop of[1,0.6]){
    const sw=Math.round(iw*crop),sh=Math.round(ih*crop),sx=Math.round((iw-sw)/2),sy=Math.round((ih-sh)/2);
    for(const max of[1500,1000,640]){
      const k=Math.min(1,max/Math.max(sw,sh));const w=Math.max(1,Math.round(sw*k)),h=Math.max(1,Math.round(sh*k));
      for(const turned of[false,true]){
        c.width=turned?h:w;c.height=turned?w:h;
        const ctx=c.getContext('2d');
        if(turned){ctx.translate(h,0);ctx.rotate(Math.PI/2);}
        ctx.drawImage(img,sx,sy,sw,sh,0,0,w,h);
        const hit=decodeCanvas(c,true);if(hit)return hit;
      }
    }
  }
  return null;
}
async function scanPhoto(input){
  const file=input&&input.files&&input.files[0];if(input)input.value='';
  if(!file)return;
  teardownScanner();
  scanDetail('');
  setScanStatus('Reading the photo…');
  try{
    await loadScannerLib();
    const img=await loadImageFile(file);
    const hit=decodeImage(img);
    if(img.close)try{img.close();}catch(e){}
    if(hit){onBarcodeDetected(hit);return;}
    setScanStatus('No barcode found in that photo. Fill the frame with the barcode, keep it flat and in good light.','var(--red)');
    scanDetail(`<button class="btn btp bsm" onclick="document.getElementById('scan-photo').click()">Take another</button><button class="btn bts bsm" onclick="scanTryAgain()">Use live camera</button>`);
  }catch(e){
    setScanStatus('That photo could not be read.','var(--red)');
    scanDetail(`<button class="btn bts bsm" onclick="scanTryAgain()">Use live camera</button><span>${esc(errText(e)).slice(0,80)}</span>`);
  }
}
function showManualBarcode(){
  const statusEl=document.getElementById('scan-status');if(!statusEl)return;
  teardownScanner();scanDetail('');
  statusEl.innerHTML=`<div style="display:flex;gap:8px;text-align:left">
    <input type="text" id="manual-barcode" inputmode="numeric" autocomplete="off" placeholder="Digits under the barcode" style="flex:1" onkeydown="if(event.key==='Enter')submitManualBarcode()">
    <button class="btn btp bsm" onclick="submitManualBarcode()">Look up</button>
  </div><div id="manual-barcode-msg" class="scan-detail"></div>`;
  setTimeout(()=>document.getElementById('manual-barcode')?.focus(),100);
}
function submitManualBarcode(){
  const code=String(document.getElementById('manual-barcode')?.value||'').replace(/[\s-]/g,'');
  if(!code){toast('Enter the numbers under the barcode');return;}
  const bad=barcodeProblem(code);
  if(bad){const m=document.getElementById('manual-barcode-msg');if(m)m.innerHTML=`<span style="color:var(--red)">${esc(bad)}</span>`;return;}
  onBarcodeDetected(code);
}
const FOOD_CACHE_MAX=300;
function cacheProduct(barcode,product){
  if(!isObj(S.foodCache))S.foodCache={};
  delete S.foodCache[barcode];           // re-insert so the newest entry is last
  S.foodCache[barcode]=product;
  const keys=Object.keys(S.foodCache);
  for(let i=0;i<keys.length-FOOD_CACHE_MAX;i++)delete S.foodCache[keys[i]];
}
// Open Food Facts → the small shape the app keeps. Energy falls back from kcal to kJ.
function offToProduct(pr){
  const n=pr.nutriments||{};const num=v=>{const x=parseFloat(v);return x>0?x:0;};
  const kcal=suffix=>{
    const k=num(n['energy-kcal_'+suffix]);if(k)return Math.round(k);
    const kj=num(n['energy-kj_'+suffix])||num(n['energy_'+suffix]);
    return kj?Math.round(kj/4.184):0;
  };
  const block=suffix=>({protein:r1(num(n['proteins_'+suffix])),carbs:r1(num(n['carbohydrates_'+suffix])),fat:r1(num(n['fat_'+suffix])),cals:kcal(suffix)});
  return{
    name:String(pr.product_name||pr.product_name_en||pr.generic_name||'Unknown product').slice(0,120),
    brand:String(pr.brands||'').split(',')[0].trim().slice(0,60),
    serving:String(pr.serving_size||'').slice(0,40),
    servingG:num(pr.serving_quantity),
    per100:block('100g'),perServing:block('serving')
  };
}
function validProduct(p){
  const ok=b=>isObj(b)&&['protein','carbs','fat','cals'].every(k=>typeof b[k]==='number'&&isFinite(b[k]));
  return isObj(p)&&ok(p.per100)&&ok(p.perServing);
}
function scanFailHTML(title,barcode,retry){
  return`<div style="color:var(--red);font-weight:600">${title}</div>
    <div style="font-size:12px;margin-top:4px;color:var(--muted)">Barcode: ${esc(barcode)}</div>
    ${retry?`<button class="btn bts bfw" style="margin-top:10px" onclick="onBarcodeDetected(${jsq(barcode)})">Try again</button>`:''}
    <button class="btn btp bfw" style="margin-top:8px" onclick="showCreateCustomFood(${jsq(barcode)})">Enter it yourself</button>`;
}
// Entering a product by hand (not in the database, or its numbers are wrong) uses the food editor.
function showCreateCustomFood(barcode,preset){
  teardownScanner();closeOv('scan-ov');closeOv('serving-ov');
  showFoodEditor({barcode:cleanBarcode(barcode),preset:preset||null,after:'scan'});
}
function editScannedProduct(){
  const p=window._scanProduct,barcode=cleanBarcode(window._scanBarcode);if(!p||!barcode)return;
  const base=scanServingBase(p);const one=base?scaleMacros(base,1):scaleMacros(p.per100,1);
  showCreateCustomFood(barcode,Object.assign({name:p.name+(p.brand?' ('+p.brand+')':''),serving:base?(p.serving||(p.servingG?fmt1(p.servingG)+'g':'1 serving')):'100g'},one));
}
async function onBarcodeDetected(raw){
  teardownScanner();
  const barcode=cleanBarcode(raw);
  const statusEl=document.getElementById('scan-status');
  if(!barcode){if(statusEl)statusEl.innerHTML='<div style="color:var(--red);font-weight:600">That code could not be read</div>';return;}
  if(statusEl)statusEl.innerHTML=`<div style="font-weight:600;color:var(--navy)">Found: ${esc(barcode)}</div><div style="margin-top:4px;font-size:12px">Looking up product…</div>`;
  const hit=cachedProductFor(barcode);
  if(hit){showServingPicker(hit.product,hit.barcode);return;}
  const ctl=typeof AbortController!=='undefined'?new AbortController():null;
  const timer=setTimeout(()=>{if(ctl)ctl.abort();},10000);
  try{
    const res=await fetch('https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(barcode)+'.json?fields=product_name,product_name_en,generic_name,brands,serving_size,serving_quantity,nutriments',ctl?{signal:ctl.signal}:undefined);
    if(res.status===404){if(statusEl)statusEl.innerHTML=scanFailHTML('Product not found',barcode,false);return;}
    if(!res.ok)throw new Error('HTTP '+res.status);
    const data=await res.json();
    if(data&&data.status===1&&data.product){
      const product=offToProduct(data.product);
      cacheProduct(barcode,product);save();
      showServingPicker(product,barcode);
    }else if(statusEl)statusEl.innerHTML=scanFailHTML('Product not found',barcode,false);
  }catch(e){
    const offline=typeof navigator!=='undefined'&&navigator.onLine===false;
    if(statusEl)statusEl.innerHTML=scanFailHTML(offline?'You are offline':'Lookup failed — the food database did not answer',barcode,true);
  }finally{clearTimeout(timer);}
}
function showServingPicker(product,barcode){
  teardownScanner();closeOv('scan-ov');
  const ov=makeOv('serving-ov');
  const base=scanServingBase(product);
  const has100=scanHas(product.per100);
  const hasServing=!!base;
  if(!hasServing&&!has100){
    // The database knows the product but has no nutrition for it.
    toast('No nutrition listed for this product — enter it yourself');
    showCreateCustomFood(barcode);return;
  }
  const servingLabel=product.serving||(product.servingG?fmt1(product.servingG)+'g':'');
  window._scanProduct=product;window._scanMode=hasServing?'serving':'100g';window._scanBarcode=barcode;
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div style="margin-bottom:14px">
      <div class="mt" style="margin-bottom:2px">${esc(product.name)}</div>
      ${product.brand?`<div style="font-size:12px;color:var(--muted);margin-bottom:4px">${esc(product.brand)}</div>`:''}
    </div>
    <div class="fg"><label class="fl">Serving Size</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${hasServing?`<button class="chip on" id="sv-serving" onclick="scanServingMode('serving')">1 serving${servingLabel?' ('+esc(servingLabel)+')':''}</button>`:''}
        ${has100?`<button class="chip${hasServing?'':' on'}" id="sv-100g" onclick="scanServingMode('100g')">100g</button>
        <button class="chip" id="sv-custom" onclick="scanServingMode('custom')">Custom grams</button>`:''}
      </div>
    </div>
    <div class="fg" id="scan-qty-row"><label class="fl">How many</label>
      <div style="display:flex;align-items:center;gap:10px">
        <button class="btn bts bsm" onclick="scanQtyAdj(-0.5)" style="width:46px;height:42px;font-size:18px;font-weight:700" aria-label="Less">−</button>
        <input type="number" inputmode="decimal" id="scan-qty" value="1" min="0.1" step="0.5" style="text-align:center;width:70px;font-size:18px;font-weight:600" oninput="updateScanMacros()">
        <button class="btn bts bsm" onclick="scanQtyAdj(0.5)" style="width:46px;height:42px;font-size:18px;font-weight:700" aria-label="More">+</button>
      </div>
    </div>
    <div id="scan-custom-g" style="display:none" class="fg">
      <label class="fl">Grams</label>
      <input type="number" inputmode="decimal" id="scan-grams" placeholder="Enter weight in grams" oninput="updateScanMacros()">
    </div>
    <div id="scan-macros" class="st-grid st-4" style="margin:10px 0 14px"></div>
    <button class="btn btp bfw" onclick="addScannedFood()">Add</button>
    <button class="btn btg bfw" style="margin-top:6px" onclick="editScannedProduct()">These numbers are wrong: fix them</button>
    <button class="btn btg bfw" onclick="closeOv('serving-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  updateScanMacros();
}
function scanServingMode(mode){
  window._scanMode=mode;
  document.querySelectorAll('#serving-ov .chip').forEach(c=>c.classList.remove('on'));
  const el=document.getElementById('sv-'+mode);if(el)el.classList.add('on');
  const cg=document.getElementById('scan-custom-g');if(cg)cg.style.display=mode==='custom'?'block':'none';
  const qr=document.getElementById('scan-qty-row');if(qr)qr.style.display=mode==='custom'?'none':'block';
  updateScanMacros();
}
function scanQtyAdj(d){
  const el=document.getElementById('scan-qty');if(!el)return;
  el.value=Math.max(0.5,Math.round(((parseFloat(el.value)||1)+d)*10)/10);
  updateScanMacros();
}
function scanHas(b){return !!(b&&(b.cals||b.protein||b.carbs||b.fat));}
// Per-serving figures as ONE consistent block: the label's own serving numbers if it has them,
// otherwise per-100g scaled by the serving weight. Never a field-by-field mix of the two.
function scanServingBase(p){
  if(scanHas(p.perServing))return p.perServing;
  if(p.servingG>0&&scanHas(p.per100)){const k=p.servingG/100;return{protein:p.per100.protein*k,carbs:p.per100.carbs*k,fat:p.per100.fat*k,cals:p.per100.cals*k};}
  return null;
}
function scaleMacros(b,k){return{protein:r1(b.protein*k),carbs:r1(b.carbs*k),fat:r1(b.fat*k),cals:Math.round(b.cals*k)};}
function calcScanMacros(){
  const p=window._scanProduct;if(!p)return null;
  const mode=window._scanMode;
  const qv=parseFloat(document.getElementById('scan-qty')?.value);const qty=qv>0?qv:0;
  if(mode==='serving'){const b=scanServingBase(p);return b?scaleMacros(b,qty):null;}
  if(mode==='custom'){const g=Math.max(0,parseFloat(document.getElementById('scan-grams')?.value)||0);return scaleMacros(p.per100,g/100);}
  return scaleMacros(p.per100,qty);
}
// What one logged unit of this scan is, in words.
function scanServingText(){
  const p=window._scanProduct,mode=window._scanMode;if(!p)return'1 serving';
  if(mode==='custom')return fmt1(parseFloat(document.getElementById('scan-grams')?.value)||0)+'g';
  const q=parseFloat(document.getElementById('scan-qty')?.value)||1;
  if(mode==='100g')return fmt1(q*100)+'g';
  return(q!==1?fmt1(q)+' × ':'')+(p.serving||'1 serving');
}
function updateScanMacros(){
  const m=calcScanMacros();if(!m)return;
  window._scanMacros=m;
  const el=document.getElementById('scan-macros');if(!el)return;
  el.innerHTML=macroTilesHTML(m);
}
function addScannedFood(){
  const p=window._scanProduct,m=window._scanMacros,barcode=cleanBarcode(window._scanBarcode);
  if(!p||!m){toast('No product data');return;}
  if(!m.protein&&!m.carbs&&!m.fat&&!m.cals){toast(window._scanMode==='custom'?'Enter the weight in grams':'Nothing to log at that amount');return;}
  const fullName=p.name+(p.brand?' ('+p.brand+')':'');
  // Remember the product as a food: one serving if the label has one, otherwise 100 g.
  const cfId='cf_'+barcode;
  const base=scanServingBase(p);
  const one=base?scaleMacros(base,1):scaleMacros(p.per100,1);
  const food={id:cfId,name:fullName,serving:base?(p.serving||(p.servingG?fmt1(p.servingG)+'g':'1 serving')):'100g',barcode,...one};
  const at=S.customFoods.findIndex(f=>f.id===cfId);
  if(at>=0)S.customFoods[at]=food;else S.customFoods.push(food);
  trackRecent(cfId);
  const item={foodId:cfId,name:fullName,qty:1,serving:scanServingText(),protein:m.protein,carbs:m.carbs,fat:m.fat,cals:m.cals};
  closeOv('serving-ov');
  if(window._scanReturnToMeal&&document.getElementById('meal-ov')){
    // The meal builder stayed open under the scanner: the item just joins it.
    _mealItems.push(item);
    updateMealItems();
  }else{
    window._pendingScanMeal=item;
    mealTypeSheet('What meal is this?','logQuickScanMeal');
  }
  save();window._scanProduct=null;window._scanMacros=null;
}
function logQuickScanMeal(mealType){
  closeOv('mtype-ov');
  const s=window._pendingScanMeal;if(!s)return;
  S.meals.push({id:uid(),date:nutDay(),type:mealType,name:mealType,items:[s],protein:s.protein,carbs:s.carbs,fat:s.fat,cals:s.cals});
  save();toast(s.name+' logged as '+mealType,'green');
  if(S.tab==='nutrition')renderNutrition(document.getElementById('content'));
  window._pendingScanMeal=null;
}
