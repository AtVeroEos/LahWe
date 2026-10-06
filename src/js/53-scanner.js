// ═══════════════════════════════════════════════════
// BARCODE SCANNER + OPEN FOOD FACTS
// ═══════════════════════════════════════════════════
// ─── Barcode scanner state ───
let _zxingReader=null,_scanStream=null,_scanLoopActive=false,_torchTrack=null,_torchOn=false;
function loadScannerLib(){
  return new Promise((resolve,reject)=>{
    if(window.ZXing&&makeZxingReader.ok!==false){resolve();return;}
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('lib load failed'));
    document.head.appendChild(s);
  });
}
function makeZxingReader(){
  const Z=window.ZXing;if(!Z)return null;
  const Reader=Z.BrowserMultiFormatReader||Z.BrowserBarcodeReader||Z.BrowserCodeReader;
  if(!Reader){makeZxingReader.ok=false;return null;}
  try{
    // Hint the formats we care about (1D product codes) for speed
    let hints=null;
    if(Z.DecodeHintType&&Z.BarcodeFormat){
      hints=new Map();
      hints.set(Z.DecodeHintType.POSSIBLE_FORMATS,[
        Z.BarcodeFormat.EAN_13,Z.BarcodeFormat.EAN_8,Z.BarcodeFormat.UPC_A,
        Z.BarcodeFormat.UPC_E,Z.BarcodeFormat.CODE_128,Z.BarcodeFormat.CODE_39,
        Z.BarcodeFormat.ITF,Z.BarcodeFormat.CODABAR
      ]);
      hints.set(Z.DecodeHintType.TRY_HARDER,true);
    }
    return new Reader(hints);
  }catch(e){return new Reader();}
}
function setScanStatus(msg,color){
  const el=document.getElementById('scan-status');if(!el)return;
  el.innerHTML=color?`<div style="color:${color};font-weight:600">${msg}</div>`:msg; // callers pass fixed strings only
}
function showBarcodeScanner(){
  const mealOv=document.getElementById('meal-ov');
  if(mealOv){
    window._scanReturnToMeal=true;
    window._scanMealDate=document.getElementById('meal-date')?.value||today();
    window._scanMealTypeIdx=window._mealType||0;
    closeOv('meal-ov');
  }else{window._scanReturnToMeal=false;}
  const ov=makeOv('scan-ov');
  ov.addEventListener('click',e=>{if(e.target===ov)teardownScanner();});
  ov.innerHTML=`<div class="modal" style="max-height:96vh;padding-bottom:calc(30px + var(--sb))">
    <div class="mh"></div>
    <div class="mt">Scan Barcode</div>
    <div style="width:100%;border-radius:12px;overflow:hidden;background:#000;position:relative;aspect-ratio:4/3">
      <video id="scan-video" playsinline muted autoplay style="width:100%;height:100%;object-fit:cover;display:block"></video>
      <div style="position:absolute;left:8%;right:8%;top:42%;height:16%;border:2px solid rgba(255,255,255,.85);border-radius:8px;box-shadow:0 0 0 9999px rgba(0,0,0,.22);pointer-events:none"></div>
      <div style="position:absolute;left:8%;right:8%;top:50%;height:2px;background:var(--red);box-shadow:0 0 8px var(--red);pointer-events:none"></div>
      <button id="torch-btn" onclick="toggleTorch()" style="display:none;position:absolute;top:8px;right:8px;width:40px;height:40px;border-radius:50%;border:none;background:rgba(0,0,0,.5);color:#fff;font-size:18px;cursor:pointer">🔦</button>
    </div>
    <div id="scan-status" style="text-align:center;padding:12px;font-size:13px;color:var(--muted)">Starting camera…</div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btp" style="flex:1;gap:6px" onclick="captureAndScan()"><span style="font-size:14px">⎙</span> Freeze + Scan</button>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn bts" style="flex:1" onclick="showManualBarcode()">Enter code</button>
      <button class="btn btg" style="flex:1" onclick="stopScanner()">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  startScanner();
}
async function startScanner(){
  const video=document.getElementById('scan-video');
  if(!video)return;
  // Defensive: clear any stale state from a previous session
  _zxingReader=null;_scanLoopActive=false;
  if(_scanStream){_scanStream.getTracks().forEach(t=>t.stop());_scanStream=null;}
  // Brief delay lets iOS Safari fully release the camera from a prior session
  await new Promise(r=>setTimeout(r,150));
  try{
    setScanStatus('Requesting camera…');
    _scanStream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false
    });
    video.srcObject=_scanStream;
    setScanStatus('Starting video…');
    try{
      await video.play();
    }catch(playErr){
      // iOS autoplay blocked — offer explicit tap-to-start
      setScanStatus('<button class="btn btp bsm" onclick="tapStartCamera()">Tap to start camera</button>');
      setupTorch();
      return;
    }
    setupTorch();
    beginDecode();
  }catch(e){
    const msg=e&&e.name==='NotAllowedError'?'Camera permission denied — enable it in Settings, or enter the code manually'
      :e&&e.name==='NotFoundError'?'No camera found — enter the code manually'
      :'Camera unavailable — enter the code manually';
    setScanStatus(msg,'var(--red)');
  }
}
async function tapStartCamera(){
  const v=document.getElementById('scan-video');if(!v)return;
  try{await v.play();beginDecode();}
  catch(e){setScanStatus('Could not start camera — enter the code manually','var(--red)');}
}
async function beginDecode(){
  const video=document.getElementById('scan-video');
  if(!video)return;
  setScanStatus('Point camera at a barcode…');
  try{
    await loadScannerLib();
    _zxingReader=makeZxingReader();
    if(!_zxingReader){setScanStatus('Scanner library unavailable — use Freeze + Scan or enter code','var(--red)');return;}
    _scanLoopActive=true;
    _zxingReader.decodeFromVideoElementContinuously(video,(result)=>{
      if(result&&_scanLoopActive){_scanLoopActive=false;onBarcodeDetected(result.getText());}
    });
  }catch(e){
    setScanStatus('Live scan unavailable — use Freeze + Scan','var(--red)');
  }
}
function setupTorch(){
  try{
    const track=_scanStream&&_scanStream.getVideoTracks()[0];
    if(!track)return;
    const caps=track.getCapabilities?track.getCapabilities():{};
    if(caps&&'torch' in caps&&caps.torch){
      _torchTrack=track;
      const btn=document.getElementById('torch-btn');if(btn)btn.style.display='block';
    }else{
      _torchTrack=null; // iOS Safari lands here — torch not exposed to web
    }
  }catch(e){_torchTrack=null;}
}
async function toggleTorch(){
  if(!_torchTrack)return;
  _torchOn=!_torchOn;
  try{
    await _torchTrack.applyConstraints({advanced:[{torch:_torchOn}]});
    const btn=document.getElementById('torch-btn');
    if(btn)btn.style.background=_torchOn?'var(--gold)':'rgba(0,0,0,.5)';
  }catch(e){_torchOn=!_torchOn;}
}
function teardownScanner(){
  _scanLoopActive=false;
  if(_torchTrack&&_torchOn){try{_torchTrack.applyConstraints({advanced:[{torch:false}]});}catch(e){}}
  _torchTrack=null;_torchOn=false;
  // Stop the decode loop WITHOUT touching the stream (reset() kills the stream on iOS).
  if(_zxingReader){try{_zxingReader.stopContinuousDecode();}catch(e){}}_zxingReader=null;
  // Explicitly detach srcObject before stopping tracks — iOS needs this sequence.
  const vid=document.getElementById('scan-video');
  if(vid)vid.srcObject=null;
  if(_scanStream){_scanStream.getTracks().forEach(t=>t.stop());_scanStream=null;}
}
function stopScanner(){
  teardownScanner();
  closeOv('scan-ov');
}
async function captureAndScan(){
  const video=document.getElementById('scan-video');
  if(!video||!video.videoWidth){setScanStatus('No camera feed yet — wait a moment','var(--red)');return;}
  _scanLoopActive=false;
  const canvas=document.createElement('canvas');
  canvas.width=video.videoWidth;canvas.height=video.videoHeight;
  canvas.getContext('2d').drawImage(video,0,0);
  setScanStatus('Analyzing frame…','var(--navy)');
  try{
    await loadScannerLib();
    const reader=makeZxingReader();
    if(!reader)throw new Error('no reader');
    const dataUrl=canvas.toDataURL('image/png');
    const result=await reader.decodeFromImageUrl(dataUrl);
    onBarcodeDetected(result.getText());
  }catch(e){
    setScanStatus('No barcode detected — center it in the box, hold steady, try again','var(--red)');
    // The original continuous loop from beginDecode is still running —
    // it just ignores results when _scanLoopActive is false.
    // Re-enable it. Do NOT re-call decodeFromVideoElementContinuously
    // because ZXing internally calls reset() which kills the stream.
    _scanLoopActive=true;
  }
}
function showManualBarcode(){
  const statusEl=document.getElementById('scan-status');if(!statusEl)return;
  _scanLoopActive=false;
  statusEl.innerHTML=`<div style="display:flex;gap:8px;margin-top:4px">
    <input type="text" id="manual-barcode" inputmode="numeric" placeholder="Enter barcode number" style="flex:1;font-size:15px">
    <button class="btn btp bsm" onclick="submitManualBarcode()">Look up</button>
  </div>`;
  setTimeout(()=>document.getElementById('manual-barcode')?.focus(),100);
}
// A barcode ends up in element ids, a URL and storage keys: keep only what a barcode can contain.
function cleanBarcode(code){return String(code==null?'':code).replace(/[^0-9A-Za-z_\-]/g,'').slice(0,32);}
function submitManualBarcode(){
  const code=cleanBarcode(document.getElementById('manual-barcode')?.value);
  if(!code){toast('Enter the numbers under the barcode');return;}
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
async function onBarcodeDetected(raw){
  teardownScanner();
  const barcode=cleanBarcode(raw);
  const statusEl=document.getElementById('scan-status');
  if(!barcode){if(statusEl)statusEl.innerHTML='<div style="color:var(--red);font-weight:600">That code could not be read</div>';return;}
  if(statusEl)statusEl.innerHTML=`<div style="font-weight:600;color:var(--navy)">Found: ${esc(barcode)}</div><div style="margin-top:4px;font-size:12px">Looking up product…</div>`;
  const cached=S.foodCache&&S.foodCache[barcode];
  if(validProduct(cached)){showServingPicker(cached,barcode);return;}
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
function showCreateCustomFood(barcode){
  barcode=cleanBarcode(barcode);
  teardownScanner();closeOv('scan-ov');
  const ov=makeOv('custfood-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Create Food</div>
    <div style="font-size:11px;color:var(--muted);margin:-10px 0 12px">Barcode: ${esc(barcode)} — will auto-fill on next scan</div>
    <div class="fg"><label class="fl">Food Name</label><input type="text" id="cf-name" placeholder="e.g. Kirkland Protein Bar"></div>
    <div class="fg"><label class="fl">Serving Size</label><input type="text" id="cf-serving" placeholder="e.g. 1 bar, 1 cup, 100g"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px">
      <div class="fg" style="margin-bottom:0"><label class="fl">Protein (g)</label><input type="number" inputmode="decimal" id="cf-pro" placeholder="0"></div>
      <div class="fg" style="margin-bottom:0"><label class="fl">Carbs (g)</label><input type="number" inputmode="decimal" id="cf-carb" placeholder="0"></div>
      <div class="fg" style="margin-bottom:0"><label class="fl">Fat (g)</label><input type="number" inputmode="decimal" id="cf-fat" placeholder="0"></div>
      <div class="fg" style="margin-bottom:0"><label class="fl">Calories</label><input type="number" inputmode="numeric" id="cf-cal" placeholder="Auto"></div>
    </div>
    <button class="btn btp bfw" onclick="doCreateCustomFood(${jsq(barcode)})">Save Food</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('custfood-ov')">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  setTimeout(()=>document.getElementById('cf-name')?.focus(),150);
}
function doCreateCustomFood(barcode){
  barcode=cleanBarcode(barcode);
  const name=document.getElementById('cf-name')?.value?.trim();
  if(!name){toast('Enter a name');return;}
  const num=id=>Math.max(0,parseFloat(document.getElementById(id)?.value)||0);
  const pro=num('cf-pro'),carb=num('cf-carb'),fat=num('cf-fat');
  const calTxt=document.getElementById('cf-cal')?.value;
  const cals=calTxt?Math.round(Math.max(0,parseFloat(calTxt)||0)):Math.round(pro*4+carb*4+fat*9);
  if(!pro&&!carb&&!fat&&!cals){toast('Enter the nutrition for one serving');return;}
  const serving=document.getElementById('cf-serving')?.value?.trim()||'1 serving';
  const cfId='cf_'+barcode;
  if(!S.customFoods)S.customFoods=[];
  S.customFoods=S.customFoods.filter(f=>f.id!==cfId);
  S.customFoods.push({id:cfId,name,serving,barcode,protein:pro,carbs:carb,fat,cals});
  // Cache for barcode lookup
  // Only per-serving figures are known here; per-100g stays empty rather than being guessed.
  cacheProduct(barcode,{name,brand:'',serving,servingG:0,manual:true,
    per100:{protein:0,carbs:0,fat:0,cals:0},
    perServing:{protein:pro,carbs:carb,fat,cals}});
  save();closeOv('custfood-ov');
  toast(name+' saved','green');
  showServingPicker(S.foodCache[barcode],barcode);
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
    <div id="scan-macros" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0 16px;padding:14px;background:var(--bg);border-radius:12px"></div>
    <button class="btn btp bfw" onclick="addScannedFood()">Add</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('serving-ov')">Cancel</button>
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
  el.innerHTML=`
    <div><div style="font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">Protein</div>
      <div class="mono" style="font-size:20px;font-weight:600;color:var(--navy)">${fmt1(m.protein)}<span style="font-size:10px;opacity:.5">g</span></div></div>
    <div><div style="font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">Carbs</div>
      <div class="mono" style="font-size:20px;font-weight:600;color:var(--gold)">${fmt1(m.carbs)}<span style="font-size:10px;opacity:.5">g</span></div></div>
    <div><div style="font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">Fat</div>
      <div class="mono" style="font-size:20px;font-weight:600;color:var(--red)">${fmt1(m.fat)}<span style="font-size:10px;opacity:.5">g</span></div></div>
    <div><div style="font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">Calories</div>
      <div class="mono" style="font-size:20px;font-weight:600;color:var(--green)">${m.cals}<span style="font-size:10px;opacity:.5">kcal</span></div></div>`;
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
  if(window._scanReturnToMeal){
    const kept=[..._mealItems];
    showAddMeal(window._scanMealDate||today(),true);
    _mealItems=[...kept,item];
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
  S.meals.push({id:uid(),date:today(),type:mealType,name:mealType,items:[s],protein:s.protein,carbs:s.carbs,fat:s.fat,cals:s.cals});
  save();toast(s.name+' logged as '+mealType,'green');
  if(S.tab==='nutrition')renderNutrition(document.getElementById('content'));
  window._pendingScanMeal=null;
}
