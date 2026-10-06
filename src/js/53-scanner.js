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
  el.innerHTML=color?`<div style="color:${color};font-weight:600">${msg}</div>`:msg;
}
function showBarcodeScanner(){
  const mealOv=document.getElementById('meal-ov');
  if(mealOv){
    window._scanReturnToMeal=true;
    window._scanMealDate=document.getElementById('meal-date')?.value||today();
    window._scanMealTypeIdx=window._mealType||0;
    dismissOv(mealOv);
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
    console.error('Camera error:',e);
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
  const ov=document.getElementById('scan-ov');
  if(ov)dismissOv(ov);
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
function submitManualBarcode(){
  const code=document.getElementById('manual-barcode')?.value?.trim();
  if(!code){toast('Enter a barcode number');return;}
  onBarcodeDetected(code);
}
async function onBarcodeDetected(barcode){
  teardownScanner();
  const statusEl=document.getElementById('scan-status');
  if(statusEl)statusEl.innerHTML=`<div style="font-weight:600;color:var(--navy)">Found: ${barcode}</div><div style="margin-top:4px;font-size:12px">Looking up product…</div>`;
  if(!S.foodCache)S.foodCache={};
  if(S.foodCache[barcode]){showServingPicker(S.foodCache[barcode],barcode);return;}
  try{
    const res=await fetch('https://world.openfoodfacts.org/api/v2/product/'+barcode+'.json');
    const data=await res.json();
    if(data.status===1&&data.product){
      const pr=data.product;const n=pr.nutriments||{};
      const product={
        name:pr.product_name||'Unknown Product',
        brand:pr.brands||'',
        serving:pr.serving_size||'',
        servingG:parseFloat(pr.serving_quantity)||0,
        per100:{protein:r1(n.proteins_100g||0),carbs:r1(n.carbohydrates_100g||0),fat:r1(n.fat_100g||0),cals:Math.round(n['energy-kcal_100g']||0)},
        perServing:{protein:r1(n.proteins_serving||0),carbs:r1(n.carbohydrates_serving||0),fat:r1(n.fat_serving||0),cals:Math.round(n['energy-kcal_serving']||0)}
      };
      S.foodCache[barcode]=product;save();
      showServingPicker(product,barcode);
    }else{
      if(statusEl)statusEl.innerHTML=`<div style="color:var(--red);font-weight:600">Product not found</div>
        <div style="font-size:12px;margin-top:4px;color:var(--muted)">Barcode: ${barcode}</div>
        <button class="btn btp bfw" style="margin-top:10px" onclick="showCreateCustomFood('${barcode}')">Create Custom Food</button>`;
    }
  }catch(e){
    if(statusEl)statusEl.innerHTML='<div style="color:var(--red)">Network error — check connection</div>';
  }
}
function showCreateCustomFood(barcode){
  const scanOv=document.getElementById('scan-ov');if(scanOv)dismissOv(scanOv);
  const ov=makeOv('custfood-ov');
  ov.innerHTML=`<div class="modal"><div class="mh"></div><div class="mt">Create Food</div>
    <div style="font-size:11px;color:var(--muted);margin:-10px 0 12px">Barcode: ${barcode} — will auto-fill on next scan</div>
    <div class="fg"><label class="fl">Food Name</label><input type="text" id="cf-name" placeholder="e.g. Kirkland Protein Bar"></div>
    <div class="fg"><label class="fl">Serving Size</label><input type="text" id="cf-serving" placeholder="e.g. 1 bar, 1 cup, 100g"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px">
      <div class="fg" style="margin-bottom:0"><label class="fl">Protein (g)</label><input type="number" inputmode="decimal" id="cf-pro" placeholder="0"></div>
      <div class="fg" style="margin-bottom:0"><label class="fl">Carbs (g)</label><input type="number" inputmode="decimal" id="cf-carb" placeholder="0"></div>
      <div class="fg" style="margin-bottom:0"><label class="fl">Fat (g)</label><input type="number" inputmode="decimal" id="cf-fat" placeholder="0"></div>
      <div class="fg" style="margin-bottom:0"><label class="fl">Calories</label><input type="number" inputmode="numeric" id="cf-cal" placeholder="Auto"></div>
    </div>
    <button class="btn btp bfw" onclick="doCreateCustomFood('${barcode}')">Save Food</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="dismissOv(document.getElementById('custfood-ov'))">Cancel</button>
  </div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  setTimeout(()=>document.getElementById('cf-name')?.focus(),150);
}
function doCreateCustomFood(barcode){
  const name=document.getElementById('cf-name')?.value?.trim();
  if(!name){toast('Enter a name');return;}
  const pro=parseFloat(document.getElementById('cf-pro')?.value)||0;
  const carb=parseFloat(document.getElementById('cf-carb')?.value)||0;
  const fat=parseFloat(document.getElementById('cf-fat')?.value)||0;
  const calEl=document.getElementById('cf-cal');
  const cals=calEl?.value?parseFloat(calEl.value):Math.round(pro*4+carb*4+fat*9);
  const serving=document.getElementById('cf-serving')?.value?.trim()||'1 serving';
  const cfId='cf_'+barcode;
  if(!S.customFoods)S.customFoods=[];
  S.customFoods=S.customFoods.filter(f=>f.id!==cfId);
  S.customFoods.push({id:cfId,name,serving,barcode,protein:pro,carbs:carb,fat,cals});
  // Cache for barcode lookup
  if(!S.foodCache)S.foodCache={};
  S.foodCache[barcode]={name,brand:'',serving,servingG:0,
    per100:{protein:pro,carbs:carb,fat,cals},
    perServing:{protein:pro,carbs:carb,fat,cals}};
  save();dismissOv(document.getElementById('custfood-ov'));
  toast(name+' saved!','green');
}
function showServingPicker(product,barcode){
  const scanOv=document.getElementById('scan-ov');if(scanOv)dismissOv(scanOv);
  const ov=makeOv('serving-ov');
  const hasServing=product.servingG>0||(product.perServing.cals>0);
  const servingLabel=product.serving||(product.servingG?product.servingG+'g':'');
  window._scanProduct=product;window._scanMode=hasServing?'serving':'100g';window._scanBarcode=barcode;
  ov.innerHTML=`<div class="modal"><div class="mh"></div>
    <div style="margin-bottom:14px">
      <div class="mt" style="margin-bottom:2px">${product.name}</div>
      ${product.brand?`<div style="font-size:12px;color:var(--muted);margin-top:-12px;margin-bottom:4px">${product.brand}</div>`:''}
    </div>
    <div class="fg"><label class="fl">Serving Size</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${hasServing?`<button class="chip on" id="sv-serving" onclick="scanServingMode('serving')">1 serving${servingLabel?' ('+servingLabel+')':''}</button>`:''}
        <button class="chip${hasServing?'':' on'}" id="sv-100g" onclick="scanServingMode('100g')">100g</button>
        <button class="chip" id="sv-custom" onclick="scanServingMode('custom')">Custom grams</button>
      </div>
    </div>
    <div class="fg" id="scan-qty-row"><label class="fl">How many</label>
      <div style="display:flex;align-items:center;gap:10px">
        <button class="btn bts bsm" onclick="scanQtyAdj(-0.5)" style="width:40px;font-size:16px;font-weight:700">−</button>
        <input type="number" inputmode="decimal" id="scan-qty" value="1" min="0.1" step="0.5" style="text-align:center;width:70px;font-size:18px;font-weight:600" oninput="updateScanMacros()">
        <button class="btn bts bsm" onclick="scanQtyAdj(0.5)" style="width:40px;font-size:16px;font-weight:700">+</button>
      </div>
    </div>
    <div id="scan-custom-g" style="display:none" class="fg">
      <label class="fl">Grams</label>
      <input type="number" inputmode="decimal" id="scan-grams" placeholder="Enter weight in grams" oninput="updateScanMacros()">
    </div>
    <div id="scan-macros" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0 16px;padding:14px;background:var(--bg);border-radius:12px"></div>
    <button class="btn btp bfw" onclick="addScannedFood()">Add</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="dismissOv(document.getElementById('serving-ov'))">Cancel</button>
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
function r1(v){return Math.round(v*10)/10;}
function fmt1(v){const n=Math.round((parseFloat(v)||0)*10)/10;return n%1===0?String(n):n.toFixed(1);}
function calcScanMacros(){
  const p=window._scanProduct;if(!p)return null;
  const mode=window._scanMode;const qty=parseFloat(document.getElementById('scan-qty')?.value)||1;
  let base;
  if(mode==='serving'){
    base=p.perServing;
    if((!base.cals&&!base.protein)&&p.servingG&&p.per100.cals){
      const mult=p.servingG/100;
      base={protein:p.per100.protein*mult,carbs:p.per100.carbs*mult,fat:p.per100.fat*mult,cals:p.per100.cals*mult};
    }
    return{protein:r1(base.protein*qty),carbs:r1(base.carbs*qty),fat:r1(base.fat*qty),cals:Math.round(base.cals*qty)};
  }else if(mode==='custom'){
    const g=parseFloat(document.getElementById('scan-grams')?.value)||0;
    const mult=g/100;
    return{protein:r1(p.per100.protein*mult),carbs:r1(p.per100.carbs*mult),fat:r1(p.per100.fat*mult),cals:Math.round(p.per100.cals*mult)};
  }else{
    return{protein:r1(p.per100.protein*qty),carbs:r1(p.per100.carbs*qty),fat:r1(p.per100.fat*qty),cals:Math.round(p.per100.cals*qty)};
  }
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
  const p=window._scanProduct,m=window._scanMacros,barcode=window._scanBarcode;
  if(!p||!m){toast('No product data');return;}
  if(!m.protein&&!m.carbs&&!m.fat&&!m.cals){toast('No nutrition data for this product');return;}
  // Save to customFoods for future use
  const cfId='cf_'+barcode;
  if(!S.customFoods)S.customFoods=[];
  if(!S.customFoods.find(f=>f.id===cfId)){
    S.customFoods.push({id:cfId,name:p.name+(p.brand?' ('+p.brand+')':''),
      serving:p.serving||'1 serving',barcode,
      protein:p.perServing.protein||p.per100.protein,carbs:p.perServing.carbs||p.per100.carbs,
      fat:p.perServing.fat||p.per100.fat,cals:p.perServing.cals||p.per100.cals});
  }
  trackRecent(cfId);
  dismissOv(document.getElementById('serving-ov'));
  // If returning to meal builder, add as item
  if(window._scanReturnToMeal){
    const scannedItem={foodId:cfId,name:p.name+(p.brand?' ('+p.brand+')':''),qty:1,
      serving:p.serving||'1 serving',protein:m.protein,carbs:m.carbs,fat:m.fat,cals:m.cals};
    const kept=[..._mealItems]; // preserve items that existed before scan
    showAddMeal(window._scanMealDate||today(),true); // keepItems=true (though showAddMeal won't clear)
    _mealItems=[...kept,scannedItem];
    setTimeout(()=>updateMealItems(),100);
  }else{
    // Direct scan from nutrition page — show type picker before logging
    window._pendingScanMeal={cfId,name:p.brand?p.name+' ('+p.brand+')':p.name,
      serving:p.serving||'1 serving',protein:m.protein,carbs:m.carbs,fat:m.fat,cals:m.cals};
    const ov2=makeOv('mtype-ov');
    ov2.innerHTML=`<div class="modal" style="max-height:320px"><div class="mh"></div>
      <div style="font-size:15px;font-weight:600;margin-bottom:12px;text-align:center">What meal is this?</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${MEAL_TYPES.map(t=>`<button class="btn bts" style="padding:14px;font-size:14px;font-weight:600" onclick="logQuickScanMeal('${t}')">${t}</button>`).join('')}
      </div>
      <button class="btn btg bfw" style="margin-top:10px" onclick="dismissOv(document.getElementById('mtype-ov'))">Cancel</button>
    </div>`;
    document.body.appendChild(ov2);attachSwipeDown(ov2);
  }
  save();window._scanProduct=null;window._scanMacros=null;
}
function logQuickScanMeal(mealType){
  dismissOv(document.getElementById('mtype-ov'));
  const s=window._pendingScanMeal;if(!s)return;
  if(!S.meals)S.meals=[];
  trackRecent(s.cfId);
  S.meals.push({id:uid(),date:today(),type:mealType,name:mealType,
    items:[{foodId:s.cfId,name:s.name,qty:1,serving:s.serving,protein:s.protein,carbs:s.carbs,fat:s.fat,cals:s.cals}],
    protein:s.protein,carbs:s.carbs,fat:s.fat,cals:s.cals});
  save();toast(s.name+' logged as '+mealType,'green');
  renderNutrition(document.getElementById('content'));
  window._pendingScanMeal=null;
}

// ═══════════════════════════════════════════════════
