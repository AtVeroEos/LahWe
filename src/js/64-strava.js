// ═══════════════════════════════════════════════════
// IMPORT FROM STRAVA
// ═══════════════════════════════════════════════════
// Strava's export is a file, not a connection: on strava.com (not the app) you request your archive
// (Settings → My Account → Download your account) and Strava emails a .zip. Inside it,
// activities.csv has one row per activity: id, date (UTC), name, type, times, distance, calories.
// Single activities can also be exported from their page as GPX or TCX.
// Everything here runs on the device. Nothing is sent anywhere, and no Strava account or key is used.
// Imported activities carry src:'strava' and srcId so importing the same archive twice adds nothing.

const STRAVA_MAX_CSV=60*1024*1024;   // activities.csv, uncompressed
const STRAVA_MAX_TRACK=40*1024*1024; // a single GPX/TCX
const STRAVA_MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};

// RFC 4180: quoted fields may hold commas, doubled quotes and line breaks (Strava descriptions do).
function stravaCsvRows(text){
  text=String(text||'').replace(/^﻿/,'');
  const rows=[];let row=[],f='',q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){
      if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}
      else f+=c;
    }else if(c==='"')q=true;
    else if(c===','){row.push(f);f='';}
    else if(c==='\n'||c==='\r'){
      if(c==='\r'&&text[i+1]==='\n')i++;
      row.push(f);f='';if(row.length>1||row[0]!=='')rows.push(row);row=[];
    }else f+=c;
  }
  if(f!==''||row.length){row.push(f);if(row.length>1||row[0]!=='')rows.push(row);}
  return rows;
}
// Column positions by name. Strava repeats some names (Elapsed Time, Distance): the first Distance is
// in kilometres, the later one in metres, so every position is kept.
function stravaColumns(header){
  const m={};
  header.forEach((h,i)=>{const k=String(h).trim().toLowerCase();(m[k]=m[k]||[]).push(i);});
  return m;
}
// "23 Nov 2020, 18:03:54", "Nov 23, 2020, 6:03:54 PM" or ISO. Strava writes these in UTC.
function stravaParseDate(s){
  s=String(s||'').trim();if(!s)return null;
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if(m)return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0));
  let d,mo,y,rest;
  if((m=s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4}),?\s*(.*)$/))){d=+m[1];mo=m[2];y=+m[3];rest=m[4];}
  else if((m=s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4}),?\s*(.*)$/))){mo=m[1];d=+m[2];y=+m[3];rest=m[4];}
  else return null;
  const mi=STRAVA_MONTHS[mo.toLowerCase().slice(0,3)];
  if(mi==null||!(d>=1&&d<=31))return null;
  const t=String(rest||'').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
  let hh=t?+t[1]:12,mm=t?+t[2]:0,ss=t?+(t[3]||0):0;
  if(t&&t[4]){const pm=/p/i.test(t[4]);if(hh===12)hh=pm?12:0;else if(pm)hh+=12;}
  return Date.UTC(y,mi,d,hh,mm,ss);
}
// Strava's activity type (or a GPX/TCX sport) → this app's type. Rucks are logged on Strava as walks or
// hikes, so the name decides. Weight training is kept apart: lifts are logged here set by set.
function stravaType(type,name){
  const t=String(type||'').toLowerCase().replace(/[^a-z]/g,'');
  const ruck=/\bruck/i.test(String(name||''));
  if(/run|jog/.test(t))return 'run';
  if(/ride|bik|cycl|velomobile|handcycle|wheelchair/.test(t))return 'bike';
  if(/swim/.test(t))return 'swim';
  if(/hik/.test(t))return ruck?'ruck':'hike';
  if(/walk/.test(t))return ruck?'ruck':'walk';
  if(/weight|strength/.test(t))return 'lift';
  return ruck?'ruck':'other';
}
const STRAVA_KIND_LABEL={run:'Runs',bike:'Rides',swim:'Swims',hike:'Hikes',walk:'Walks',ruck:'Rucks',lift:'Weight training',other:'Other workouts'};

// One activities.csv → { items:[{srcId,at,type,name,stravaType,distMi,durMin}], bad, language }
function stravaFromCsv(text){
  const rows=stravaCsvRows(text);
  if(rows.length<2)return{items:[],bad:0,error:'That file has no activities in it.'};
  const col=stravaColumns(rows[0]);
  if(!col['activity id']||!col['activity date']||!col['activity type'])
    return{items:[],bad:0,error:'This does not look like Strava\'s activities.csv. If your Strava is set to another language, the columns have other names: switch Strava to English, request the archive again, and use the new one.'};
  const num=v=>{const x=parseFloat(String(v==null?'':v).replace(/,/g,''));return isFinite(x)?x:0;};
  const first=(r,k)=>{for(const i of col[k]||[]){const v=r[i];if(v!=null&&String(v).trim()!=='')return v;}return '';};
  const items=[];let bad=0;
  for(const r of rows.slice(1)){
    const id=String(first(r,'activity id')).trim();const at=stravaParseDate(first(r,'activity date'));
    if(!id||at==null){bad++;continue;}
    const name=String(first(r,'activity name')).trim(),stype=String(first(r,'activity type')).trim();
    const dCols=col['distance']||[];
    let meters=0;
    if(dCols.length>1)meters=num(r[dCols[dCols.length-1]]);
    if(!meters&&dCols.length)meters=num(r[dCols[0]])*1000; // only the kilometre column
    const moving=num(first(r,'moving time'));
    const el=(col['elapsed time']||[]).map(i=>num(r[i])).find(v=>v>0)||0;
    const sec=moving>0?moving:el;
    items.push({srcId:id,at,type:stravaType(stype,name),name,stravaType:stype,distMi:meters>0?meters/1609.344:0,durMin:sec>0?sec/60:0});
  }
  return{items,bad};
}
// A single GPX or TCX export: start time, moving distance, total time.
function stravaFromTrack(text,fname){
  text=String(text||'');
  const isTcx=/<TrainingCenterDatabase/i.test(text);
  if(!isTcx&&!/<gpx[\s>]/i.test(text))return null;
  // Track-point times only: a GPX also has a file time in <metadata>, which is when it was exported.
  const body=isTcx?text:((text.match(/<trk[\s>][\s\S]*<\/trk>/i)||[text])[0]);
  const times=[...body.matchAll(/<(?:time|Time)>([^<]+)<\/(?:time|Time)>/g)].map(m=>Date.parse(m[1].trim())).filter(isFinite);
  let at=times.length?Math.min(...times):null,end=times.length?Math.max(...times):null;
  let meters=0,sec=0,sport='',name='';
  if(isTcx){
    sport=(text.match(/<Activity\s+Sport="([^"]+)"/i)||[])[1]||'';
    const id=(text.match(/<Id>([^<]+)<\/Id>/)||[])[1];if(id&&isFinite(Date.parse(id)))at=Date.parse(id);
    for(const lap of text.match(/<Lap[\s>][\s\S]*?<\/Lap>/g)||[]){
      const head=lap.split(/<Track[\s>]/)[0];
      sec+=parseFloat((head.match(/<TotalTimeSeconds>([^<]+)</)||[])[1])||0;
      meters+=parseFloat((head.match(/<DistanceMeters>([^<]+)</)||[])[1])||0;
    }
    if(!meters){const all=[...text.matchAll(/<DistanceMeters>([^<]+)</g)].map(m=>parseFloat(m[1])).filter(isFinite);if(all.length)meters=Math.max(...all);}
    name=(text.match(/<Notes>([^<]{1,120})<\/Notes>/)||[])[1]||'';
  }else{
    const trk=(text.match(/<trk[\s>][\s\S]*?<\/trk>/i)||[text])[0];
    name=((trk.match(/<name>([^<]{1,200})<\/name>/i)||[])[1]||'').replace(/<!\[CDATA\[|\]\]>/g,'').trim();
    sport=(trk.match(/<type>([^<]{1,60})<\/type>/i)||[])[1]||'';
    const pts=[...text.matchAll(/<trkpt\s[^>]*?lat="([-\d.]+)"[^>]*?lon="([-\d.]+)"|<trkpt\s[^>]*?lon="([-\d.]+)"[^>]*?lat="([-\d.]+)"/gi)]
      .map(m=>m[1]!=null?[+m[1],+m[2]]:[+m[4],+m[3]]);
    const R=6371008.8,rad=x=>x*Math.PI/180;
    for(let i=1;i<pts.length;i++){
      const[a1,o1]=pts[i-1],[a2,o2]=pts[i];
      const h=Math.sin(rad(a2-a1)/2)**2+Math.cos(rad(a1))*Math.cos(rad(a2))*Math.sin(rad(o2-o1)/2)**2;
      meters+=2*R*Math.asin(Math.min(1,Math.sqrt(h)));
    }
    if(at!=null&&end!=null)sec=(end-at)/1000;
  }
  if(at==null)return null;
  name=name.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'");
  return{srcId:'',at,type:stravaType(sport||name,name),name:name||String(fname||'').replace(/\.(gpx|tcx)(\.gz)?$/i,''),stravaType:sport,distMi:meters/1609.344,durMin:sec/60};
}

// Turn parsed rows into a plan: what is new, what is already here, and counts per kind.
function stravaPlan(items){
  const have=new Set(S.activities.filter(a=>a.srcId).map(a=>String(a.srcId)));
  const atHave=S.activities.filter(a=>a.at).map(a=>a.at);
  const seen=new Set();
  const plan={add:[],dup:0,already:0,kinds:{},from:null,to:null};
  for(const it of items){
    if(it.srcId&&(have.has(it.srcId)||seen.has(it.srcId))){plan.already++;continue;}
    if(it.srcId)seen.add(it.srcId);
    if(!it.srcId&&atHave.some(t=>Math.abs(t-it.at)<120000)){plan.already++;continue;}
    const date=dayOf(it.at);
    // Logged by hand here already: same day, same kind, distance within 5% (or time within 10%).
    const twin=S.activities.find(a=>!a.srcId&&a.date===date&&a.type===(it.type==='lift'?'other':it.type)&&(()=>{
      const d=parseFloat(a.dist)||0,m=parseFloat(a.dur)||0;
      if(d>0&&it.distMi>0)return Math.abs(d-it.distMi)<=Math.max(0.05,0.05*it.distMi);
      if(m>0&&it.durMin>0)return Math.abs(m-it.durMin)<=Math.max(2,0.1*it.durMin);
      return false;
    })());
    if(twin){plan.dup++;continue;}
    if(!(it.durMin>0)&&!(it.distMi>0)){plan.dup++;continue;} // nothing to log
    plan.add.push(Object.assign({date},it));
    plan.kinds[it.type]=(plan.kinds[it.type]||0)+1;
    if(!plan.from||date<plan.from)plan.from=date;
    if(!plan.to||date>plan.to)plan.to=date;
  }
  return plan;
}
// The activity as this app stores it. Calories use the app's own formula, the same as an activity
// logged here by hand, so totals and trends do not jump between sources.
// "Ruck with 35 lb", "45# ruck", "20 kg ruck": the load in the name, in the app's unit.
function stravaRuckLoad(type,name){
  if(type!=='ruck')return '';
  const m=String(name||'').match(/(\d{1,3}(?:\.\d)?)\s*(lbs?|#|pounds?|kg|kilos?)\b|(\d{1,3})#/i);
  if(!m)return '';
  const v=parseFloat(m[1]||m[3]);const kg=/kg|kilo/i.test(m[2]||'');
  const lb=kg?v*LB_PER_KG:v;if(!(lb>0&&lb<=200))return '';
  return String(Math.round(isKg()?lb/LB_PER_KG:lb));
}
function stravaToActivity(it){
  const type=it.type==='lift'?'other':it.type;
  const t=ACT_TYPES.find(a=>a.id===type)||ACT_TYPES.find(a=>a.id==='other');
  const hasDist=(t.fields||[]).includes('dist');
  const act={id:uid(),type,date:it.date||dayOf(it.at),dist:hasDist&&it.distMi>0?String(+it.distMi.toFixed(2)):'',
    dur:it.durMin>0?String(Math.max(1,Math.round(it.durMin))):'',ruckWeight:stravaRuckLoad(type,it.name),terrain:'flat',
    notes:String(it.name||it.stravaType||'').slice(0,200),src:'strava',at:it.at};
  if(it.srcId)act.srcId=String(it.srcId).slice(0,40);
  if(hasDist&&!act.dist&&act.dur){act.dist=String(estDistanceMi(type,parseFloat(act.dur)));act.distEst=true;}
  if(hasDist&&act.dist&&!act.dur){act.dur=String(estDurationMin(type,parseFloat(act.dist)));act.durEst=true;}
  act.cals=activityCals(act);
  return act;
}
function stravaApply(plan,kinds){
  const pick=plan.add.filter(it=>kinds[it.type]);
  const acts=pick.map(stravaToActivity);
  if(!acts.length)return [];
  S.activities.push(...acts);
  S.activities.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.at||0)-(a.at||0));
  save();bumpMemo();
  return acts.map(a=>a.id);
}

// ─── Reading the files ───
const _u16=(v,o)=>v.getUint16(o,true),_u32=(v,o)=>v.getUint32(o,true),_u64=(v,o)=>v.getUint32(o,true)+v.getUint32(o+4,true)*4294967296;
async function _slice(blob,a,b){return new DataView(await blob.slice(a,b).arrayBuffer());}
async function stravaInflate(bytes,format){
  if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot open zip files. Unzip it in the Files app and choose activities.csv instead.');
  const s=new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
// Find one member of a zip by reading only its index and that member (the archive can be gigabytes).
async function zipRead(blob,want,maxBytes){
  const tail=Math.min(blob.size,65557);
  const end=await _slice(blob,blob.size-tail,blob.size);
  let e=-1;for(let i=tail-22;i>=0;i--){if(_u32(end,i)===0x06054b50){e=i;break;}}
  if(e<0)throw new Error('That zip file is damaged or incomplete. Download it again.');
  let count=_u16(end,e+10),cdSize=_u32(end,e+12),cdOff=_u32(end,e+16);
  if(cdOff===0xFFFFFFFF||cdSize===0xFFFFFFFF||count===0xFFFF){
    const lo=e-20;if(lo<0||_u32(end,lo)!==0x07064b50)throw new Error('That zip file is damaged.');
    const z64=_u64(end,lo+8);const z=await _slice(blob,z64,z64+56);
    if(_u32(z,0)!==0x06064b50)throw new Error('That zip file is damaged.');
    count=_u64(z,32);cdSize=_u64(z,40);cdOff=_u64(z,48);
  }
  if(cdSize>64*1024*1024)throw new Error('That zip has too many files in it to read here.');
  const cd=await _slice(blob,cdOff,cdOff+cdSize);
  const dec=new TextDecoder();let best=null;
  for(let p=0,n=0;n<count&&p+46<=cd.byteLength;n++){
    if(_u32(cd,p)!==0x02014b50)break;
    const flags=_u16(cd,p+8),method=_u16(cd,p+10);let comp=_u32(cd,p+20),size=_u32(cd,p+24);
    const nl=_u16(cd,p+28),xl=_u16(cd,p+30),cl=_u16(cd,p+32);let off=_u32(cd,p+42);
    const name=dec.decode(new Uint8Array(cd.buffer,cd.byteOffset+p+46,nl));
    if(size===0xFFFFFFFF||comp===0xFFFFFFFF||off===0xFFFFFFFF){
      for(let x=p+46+nl;x+4<=p+46+nl+xl;){
        const id=_u16(cd,x),len=_u16(cd,x+2);let y=x+4;
        if(id===1){if(size===0xFFFFFFFF){size=_u64(cd,y);y+=8;}if(comp===0xFFFFFFFF){comp=_u64(cd,y);y+=8;}if(off===0xFFFFFFFF){off=_u64(cd,y);}}
        x+=4+len;
      }
    }
    if(want(name)&&(!best||name.length<best.name.length))best={name,flags,method,comp,size,off};
    p+=46+nl+xl+cl;
  }
  if(!best)return null;
  if(best.flags&1)throw new Error('That zip is password-protected.');
  if(best.size>maxBytes)throw new Error('activities.csv is too large to read here.');
  const lh=await _slice(blob,best.off,best.off+30);
  if(_u32(lh,0)!==0x04034b50)throw new Error('That zip file is damaged.');
  const start=best.off+30+_u16(lh,26)+_u16(lh,28);
  const raw=new Uint8Array(await blob.slice(start,start+best.comp).arrayBuffer());
  if(best.method===0)return raw;
  if(best.method===8)return stravaInflate(raw,'deflate-raw');
  throw new Error('That zip uses a kind of compression this app cannot read. Unzip it in the Files app and choose activities.csv.');
}
async function stravaReadFiles(files){
  const items=[];const notes=[];let bad=0;
  for(const f of files){
    const n=String(f.name||'').toLowerCase();
    try{
      if(n.endsWith('.zip')){
        const bytes=await zipRead(f,p=>/(^|\/)activities\.csv$/i.test(p),STRAVA_MAX_CSV);
        if(!bytes){notes.push(`${f.name}: no activities.csv inside. Is this the archive Strava emailed?`);continue;}
        const r=stravaFromCsv(new TextDecoder().decode(bytes));
        if(r.error){notes.push(r.error);continue;}
        items.push(...r.items);bad+=r.bad;
      }else if(n.endsWith('.csv')){
        if(f.size>STRAVA_MAX_CSV){notes.push(`${f.name} is too large.`);continue;}
        const r=stravaFromCsv(await f.text());
        if(r.error){notes.push(r.error);continue;}
        items.push(...r.items);bad+=r.bad;
      }else if(/\.(gpx|tcx)(\.gz)?$/.test(n)){
        if(f.size>STRAVA_MAX_TRACK){notes.push(`${f.name} is too large.`);continue;}
        let text;
        if(n.endsWith('.gz'))text=new TextDecoder().decode(await stravaInflate(new Uint8Array(await f.arrayBuffer()),'gzip'));
        else text=await f.text();
        const it=stravaFromTrack(text,f.name);
        if(it)items.push(it);else notes.push(`${f.name}: no start time found.`);
      }else if(/\.fit(\.gz)?$/.test(n)){
        notes.push(`${f.name}: FIT files are not supported. On the activity page use Export GPX, or import the whole archive.`);
      }else notes.push(`${f.name}: not a Strava file (use the .zip, activities.csv, or a .gpx/.tcx).`);
    }catch(e){notes.push(`${f.name}: ${e&&e.message?e.message:'could not be read'}`);}
  }
  if(bad)notes.push(`${bad} row${bad>1?'s':''} without a usable date or id were skipped.`);
  return{items,notes};
}

// ─── The sheet ───
function showStravaImport(){
  window._strava=null;
  const ov=makeOv('strava-ov');
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div class="mt">Import from Strava</div>
    <div class="sheet-sub">Brings in your runs, rides, walks, hikes and swims as activities. It reads the file on this phone; nothing is sent anywhere and no Strava login is needed.</div>
    <details class="fold" open><summary>Get your Strava file</summary>
      <ol class="sv-steps">
        <li>On <b>strava.com</b> in a browser (the Strava app cannot export): your picture → <b>Settings</b> → <b>My Account</b> → <b>Download or delete your account</b> → <b>Get started</b> → <b>Request your archive</b>.</li>
        <li>Strava emails a download link, usually within a few hours. Download the <b>.zip</b>; on an iPhone it lands in Files → Downloads.</li>
        <li>Choose it below. You can also choose <b>activities.csv</b> from inside it, or a <b>.gpx</b> / <b>.tcx</b> from a single activity's “Export GPX”.</li>
      </ol>
      <div class="fine">Set Strava's language to English before requesting the archive; the file's columns are named in that language.</div>
    </details>
    <input type="file" id="strava-file" multiple style="display:none" onchange="stravaPicked(this)">
    <button class="btn btp bfw" onclick="document.getElementById('strava-file').click()">Choose file</button>
    <div id="sv-body"></div>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('strava-ov')">Close</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
async function stravaPicked(inp){
  const files=[...(inp.files||[])];inp.value='';if(!files.length)return;
  const body=document.getElementById('sv-body');if(body)body.innerHTML=`<div class="note-box"><span class="ai-spin"></span> Reading ${files.length>1?files.length+' files':esc(files[0].name)}…</div>`;
  let r;try{r=await stravaReadFiles(files);}catch(e){r={items:[],notes:[e&&e.message||'Could not read that file.']};}
  const plan=stravaPlan(r.items);
  const kinds={};Object.keys(plan.kinds).forEach(k=>{kinds[k]=k!=='lift';});
  window._strava={plan,kinds,notes:r.notes};
  stravaPaint();
  // The steps have done their job: fold them so the result is what shows.
  const fold=document.querySelector('#strava-ov details.fold');if(fold)fold.open=false;
  const m=document.querySelector('#strava-ov .modal');if(m)m.scrollTop=0;
}
function stravaToggle(k){const z=window._strava;if(!z)return;z.kinds[k]=!z.kinds[k];stravaPaint();}
function stravaPaint(){
  const z=window._strava,body=document.getElementById('sv-body');if(!z||!body)return;
  const{plan,kinds,notes}=z;
  const n=plan.add.filter(it=>kinds[it.type]).length;
  const order=['run','ruck','walk','hike','bike','swim','other','lift'];
  const rows=order.filter(k=>plan.kinds[k]).map(k=>{
    const its=plan.add.filter(it=>it.type===k);const mi=its.reduce((s,it)=>s+(it.distMi||0),0);
    const sub=[`${its.length}`,mi>=1&&k!=='swim'&&k!=='lift'&&k!=='other'?`${Math.round(mi).toLocaleString()} mi`:'',k==='lift'?'off: your lifts are logged here set by set':''].filter(Boolean).join(' · ');
    return`<div class="frow set-row"><span class="set-lbl">${STRAVA_KIND_LABEL[k]}<br><small>${esc(sub)}</small></span><button class="tog${kinds[k]?' on':''}" role="switch" aria-checked="${kinds[k]?'true':'false'}" aria-label="${STRAVA_KIND_LABEL[k]}" onclick="stravaToggle(${jsq(k)})"></button></div>`;
  }).join('');
  const skipped=[plan.already?`${plan.already} already imported`:'',plan.dup?`${plan.dup} look like ones you logged here, or have no time or distance`:''].filter(Boolean).join('; ');
  body.innerHTML=`${plan.add.length?`<div class="sec-h" style="margin-top:14px">Found ${plan.add.length} new · ${esc(fmtDay(plan.from))} – ${esc(fmtDay(plan.to))}</div><div class="set-sec" style="margin-top:6px">${rows}</div>`:`<div class="note-box" style="margin-top:12px">${plan.already||plan.dup?'Nothing new to import.':'No activities found in that file.'}</div>`}
    ${skipped?`<div class="fine" style="margin:6px 0">Skipped: ${esc(skipped)}.</div>`:''}
    ${notes.length?`<div class="fine" style="margin:6px 0">${notes.slice(0,5).map(esc).join('<br>')}</div>`:''}
    ${n?`<button class="btn btp bfw" style="margin-top:8px" onclick="stravaGo()">Import ${n} activit${n===1?'y':'ies'}</button>`:''}`;
}
function stravaGo(){
  const z=window._strava;if(!z)return;
  const ids=stravaApply(z.plan,z.kinds);window._strava=null;
  closeOv('strava-ov');
  if(!ids.length){toast('Nothing imported');return;}
  render();
  const gone=new Set(ids);
  toast(`Imported ${ids.length} activit${ids.length===1?'y':'ies'} from Strava`,'green',{action:'Undo',onAction:()=>{S.activities=S.activities.filter(a=>!gone.has(a.id));save();bumpMemo();render();toast('Import undone');}});
}
