// ═══════════════════════════════════════════════════
// IMPORT FROM STRAVA
// ═══════════════════════════════════════════════════
// Strava's export is a file, not a connection: on strava.com (not the app) you request your archive
// (Settings → My Account → Download your account) and Strava emails a .zip. Inside it,
// activities.csv has one row per activity: id, date (UTC), name, type, times, distance, calories.
// Single activities can also be exported from their page as GPX or TCX.
// Everything here runs on the device. Nothing is sent anywhere, and no Strava account or key is used.
// Imported activities carry src:'strava' and srcId so importing the same archive twice adds nothing.
// The archive also holds each activity's original recording (activities/123.fit.gz, .gpx, .tcx.gz):
// the CSV's Filename column says which. Those are read one at a time into routes (21-routes.js,
// 76-tracks.js). Importing the same archive again adds the routes to activities that are already
// here, matched on srcId, and never makes a second copy of an activity.

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
    const it={srcId:id,at,type:stravaType(stype,name),name,stravaType:stype,distMi:meters>0?meters/1609.344:0,durMin:sec>0?sec/60:0,sec:sec>0?sec:0};
    const file=String(first(r,'filename')).trim();if(file&&trackKind(file))it.file=file.replace(/^\/+/,'');
    const gear=String(first(r,'activity gear')).trim();if(gear)it.gear=gear.slice(0,80);
    const gain=String(first(r,'elevation gain')).trim();if(gain!==''&&num(gain)>=0)it.gain=num(gain); // metres, Strava's own figure
    items.push(it);
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
  // touch: activities that are already here and can gain something from this file — a route,
  // the time to the second, the shoes. They are updated in place, never added again.
  const plan={add:[],dup:0,already:0,kinds:{},from:null,to:null,touch:[]};
  const gains=(it,a)=>(!a.rt&&(it.file||it.route))||(it.sec>0&&!(a.sec>0))||(it.gear&&!a.gear);
  for(const it of items){
    if(it.srcId&&(have.has(it.srcId)||seen.has(it.srcId))){
      plan.already++;
      if(!seen.has(it.srcId)){seen.add(it.srcId);const a=S.activities.find(x=>String(x.srcId)===it.srcId);if(a&&gains(it,a))plan.touch.push({it,id:a.id});}
      continue;
    }
    if(it.srcId)seen.add(it.srcId);
    if(!it.srcId&&atHave.some(t=>Math.abs(t-it.at)<120000)){
      plan.already++;
      const a=S.activities.find(x=>x.at&&Math.abs(x.at-it.at)<120000);if(a&&gains(it,a))plan.touch.push({it,id:a.id});
      continue;
    }
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
  if(it.sec>0)act.sec=Math.round(it.sec*10)/10; // the time to the second; "dur" stays whole minutes for display
  if(it.gear)act.gear=String(it.gear).slice(0,80);
  if(hasDist&&!act.dist&&act.dur){act.dist=String(estDistanceMi(type,parseFloat(act.dur)));act.distEst=true;}
  if(hasDist&&act.dist&&!act.dur){act.dur=String(estDurationMin(type,parseFloat(act.dist)));act.durEst=true;}
  act.cals=activityCals(act);
  return act;
}
function stravaApply(plan,kinds){
  const pick=plan.add.filter(it=>kinds[it.type]);
  const acts=pick.map(stravaToActivity);
  plan.made=pick.map((it,i)=>({it,id:acts[i].id})); // which activity each row became, for reading its route
  if(!acts.length)return [];
  S.activities.push(...acts);
  S.activities.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.at||0)-(a.at||0));
  save();bumpMemo();
  return acts.map(a=>a.id);
}

// ─── Reading the files ───
const _u16=(v,o)=>v.getUint16(o,true),_u32=(v,o)=>v.getUint32(o,true),_u64=(v,o)=>v.getUint32(o,true)+v.getUint32(o+4,true)*4294967296;
async function _slice(blob,a,b){return new DataView(await blob.slice(a,b).arrayBuffer());}
// Unpacks deflate or gzip, stopping once the output passes maxOut: a few kilobytes can be made to
// unpack into gigabytes, and the size a zip claims for a member is only a claim.
async function stravaInflate(bytes,format,maxOut){
  if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot open zip files. Unzip it in the Files app and choose activities.csv instead.');
  const rd=new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format)).getReader();
  const chunks=[];let n=0;
  for(;;){
    const{done,value}=await rd.read();if(done)break;
    n+=value.length;
    if(maxOut&&n>maxOut){try{await rd.cancel();}catch(e){}throw new Error('That file is too large to read here.');}
    chunks.push(value);
  }
  const out=new Uint8Array(n);let o=0;for(const c of chunks){out.set(c,o);o+=c.length;}
  return out;
}
// The list of files in a zip, from its index alone (the archive can be gigabytes; nothing else is read).
async function zipIndex(blob){
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
  const dec=new TextDecoder();const out=[];
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
    out.push({name,flags,method,comp,size,off});
    p+=46+nl+xl+cl;
  }
  return out;
}
// One member's bytes. Refuses a password-protected member and anything over maxBytes, packed or unpacked.
async function zipExtract(blob,ent,maxBytes,what){
  if(ent.flags&1)throw new Error('That zip is password-protected.');
  if(ent.size>maxBytes||ent.comp>maxBytes)throw new Error(`${what||'That file'} is too large to read here.`);
  const lh=await _slice(blob,ent.off,ent.off+30);
  if(_u32(lh,0)!==0x04034b50)throw new Error('That zip file is damaged.');
  const start=ent.off+30+_u16(lh,26)+_u16(lh,28);
  const raw=new Uint8Array(await blob.slice(start,start+ent.comp).arrayBuffer());
  if(ent.method===0)return raw;
  if(ent.method===8)return stravaInflate(raw,'deflate-raw',maxBytes);
  throw new Error('That zip uses a kind of compression this app cannot read. Unzip it in the Files app and choose activities.csv.');
}
// Find one member of a zip by name (the shortest path that matches) and return its bytes.
async function zipRead(blob,want,maxBytes){
  let best=null;
  for(const ent of await zipIndex(blob))if(want(ent.name)&&(!best||ent.name.length<best.name.length))best=ent;
  return best?zipExtract(blob,best,maxBytes,'activities.csv'):null;
}
// A single recording (GPX, TCX or FIT): the activity it describes, with its route already worked out.
function stravaFromFit(bytes,fname){
  const raw=trackFromFit(bytes);const ses=raw.session;
  const at=raw.at||(()=>{const t=raw.ts.find(isFinite);return t?t*1000:null;})();
  if(at==null)return null;
  const name=String(fname||'').replace(/^.*\//,'').replace(/\.fit(\.gz)?$/i,'');
  const it={srcId:'',at,type:stravaType(raw.sport||name,name),name,stravaType:raw.sport,distMi:ses&&ses.meters>0?ses.meters/MILE_M:0,durMin:ses&&(ses.timer||ses.elapsed)>0?(ses.timer||ses.elapsed)/60:0,sec:ses&&ses.timer>0?ses.timer:0};
  return stravaWithRoute(it,raw);
}
function stravaWithRoute(it,raw){
  let r=null;try{r=routeFromTrack(raw,it.type==='lift'?'other':it.type,0);}catch(e){logError(e,'route');}
  if(r){
    it.route={rec:r.rec,sum:r.sum};
    it.distMi=r.meters/MILE_M; // what was actually covered, with GPS spikes and standing still taken out
    if(r.sec>0&&!(it.sec>0)){it.sec=r.sec;it.durMin=r.sec/60;}
  }
  return it;
}
async function stravaReadFiles(files){
  const items=[];const notes=[];const zips=[];let bad=0;
  for(const f of files){
    const n=String(f.name||'').toLowerCase();
    try{
      if(n.endsWith('.zip')){
        const index=await zipIndex(f);
        let csv=null;for(const ent of index)if(/(^|\/)activities\.csv$/i.test(ent.name)&&(!csv||ent.name.length<csv.name.length))csv=ent;
        if(!csv){notes.push(`${f.name}: no activities.csv inside. Is this the archive Strava emailed?`);continue;}
        const r=stravaFromCsv(new TextDecoder().decode(await zipExtract(f,csv,STRAVA_MAX_CSV,'activities.csv')));
        if(r.error){notes.push(r.error);continue;}
        // Only files activities.csv names are ever opened, each by its exact path beside the CSV.
        const dir=csv.name.slice(0,csv.name.length-'activities.csv'.length);
        const byName=new Map();index.forEach(ent=>byName.set(ent.name,ent));
        const zi=zips.length;zips.push({blob:f,byName,dir});
        r.items.forEach(it=>{if(it.file){if(byName.has(dir+it.file))it.zi=zi;else delete it.file;}});
        items.push(...r.items);bad+=r.bad;
      }else if(n.endsWith('.csv')){
        if(f.size>STRAVA_MAX_CSV){notes.push(`${f.name} is too large.`);continue;}
        const r=stravaFromCsv(await f.text());
        if(r.error){notes.push(r.error);continue;}
        r.items.forEach(it=>{delete it.file;}); // the CSV alone: the recordings are in the zip
        items.push(...r.items);bad+=r.bad;
      }else if(trackKind(n)){
        const k=trackKind(n);
        if(f.size>STRAVA_MAX_TRACK){notes.push(`${f.name} is too large.`);continue;}
        let bytes=new Uint8Array(await f.arrayBuffer());
        if(k.gz)bytes=await stravaInflate(bytes,'gzip',STRAVA_MAX_TRACK);
        let it;
        if(k.kind==='fit')it=stravaFromFit(bytes,f.name);
        else{
          const text=new TextDecoder().decode(bytes);
          it=stravaFromTrack(text,f.name);
          if(it)stravaWithRoute(it,/<TrainingCenterDatabase/i.test(text)?trackFromTcx(text):trackFromGpx(text));
        }
        if(it)items.push(it);else notes.push(`${f.name}: no start time found.`);
      }else notes.push(`${f.name}: not a Strava file (use the .zip, activities.csv, or a .gpx, .tcx or .fit).`);
    }catch(e){notes.push(`${f.name}: ${e&&e.message?e.message:'could not be read'}`);}
  }
  if(bad)notes.push(`${bad} row${bad>1?'s':''} without a usable date or id were skipped.`);
  return{items,notes,zips};
}
// One activity's recording out of the archive → {rec,sum}, or null when it has no usable positions.
async function stravaRouteFor(it,act,zips){
  if(it.route)return it.route;
  const z=it.file&&it.zi!=null?zips[it.zi]:null;const ent=z&&z.byName.get(z.dir+it.file);const k=trackKind(it.file);
  if(!ent||!k)return null;
  let bytes=await zipExtract(z.blob,ent,STRAVA_MAX_TRACK,it.file);
  if(k.gz)bytes=await stravaInflate(bytes,'gzip',STRAVA_MAX_TRACK);
  const raw=trackParse(k.kind,bytes);
  const r=routeFromTrack(raw,act.type,it.distMi>0&&!act.distEst?it.distMi*MILE_M:0);
  if(!r)return null;
  // The climb is Strava's figure when the CSV has one, like the distance and the time: a phone's
  // altitude wobbles by a metre a second, and adding that up invents hills.
  if(it.gain!=null){r.rec.up=Math.round(it.gain);if(it.gain>=1)r.sum.up=Math.round(it.gain);else delete r.sum.up;}
  return{rec:r.rec,sum:r.sum};
}
// Reads the route for every activity in the job, one file at a time, and fills in what an
// activity that was already here was missing. job: {pairs:[{it,id}], zips, stop}. Returns what it
// did, with enough kept to undo all of it.
async function stravaRoutes(job,onStep){
  const res={routes:0,failed:0,none:0,put:[],prev:[]};let tick=Date.now();
  const todo=job.pairs.map(p=>({it:p.it,act:S.activities.find(a=>a.id===p.id)})).filter(p=>p.act);
  for(let i=0;i<todo.length;i++){
    if(job.stop)break;
    const{it,act}=todo[i];
    const before={id:act.id,sec:act.sec,gear:act.gear,rt:act.rt};let changed=false;
    if(it.sec>0&&!(act.sec>0)){act.sec=Math.round(it.sec*10)/10;changed=true;}
    if(it.gear&&!act.gear){act.gear=String(it.gear).slice(0,80);changed=true;}
    if(!act.rt&&(it.file||it.route)){
      if(onStep)onStep(i,todo.length);
      try{
        const r=await stravaRouteFor(it,act,job.zips||[]);
        if(r){await Routes.put(act.id,r.rec);act.rt=r.sum;res.put.push(act.id);res.routes++;changed=true;}
        else res.none++;
      }catch(e){res.failed++;if(!res.error)res.error=e&&e.message?e.message:String(e);}
      // Let the screen draw between files (at most twenty times a second, so it costs little).
      if(Date.now()-tick>50){await new Promise(r=>setTimeout(r,0));tick=Date.now();}
    }
    if(changed&&!(job.fresh&&job.fresh.has(act.id)))res.prev.push(before);
  }
  if(onStep)onStep(todo.length,todo.length);
  save();bumpMemo();
  if(res.put.length)try{await segRefreshAll(res.put);}catch(e){logError(e,'stretch');} // time the new routes over any marked stretches
  return res;
}
// Take an import back out: the activities it added, the routes it stored, and whatever it filled
// in on activities that were already here.
async function stravaUndo(done){
  const gone=new Set(done.added);
  S.activities=S.activities.filter(a=>!gone.has(a.id));
  done.prev.forEach(p=>{const a=S.activities.find(x=>x.id===p.id);if(!a)return;['sec','gear','rt'].forEach(k=>{if(p[k]===undefined)delete a[k];else a[k]=p[k];});});
  save();bumpMemo();
  await Routes.del(done.put);
}

// ─── The sheet ───
function showStravaImport(){
  window._strava=null;
  const ov=makeOv('strava-ov');
  ov._keep=()=>!!(window._strava&&window._strava.busy); // not closed by a stray tap while routes are being read
  ov.innerHTML=`<div class="modal" style="max-height:92vh"><div class="mh"></div><div class="mt">Import from Strava</div>
    <div class="sheet-sub">Brings in your runs, rides, walks, hikes and swims as activities, with the route each one followed. It reads the file on this phone; nothing is sent anywhere and no Strava login is needed.</div>
    <details class="fold" open><summary>Get your Strava file</summary>
      <ol class="sv-steps">
        <li>On <b>strava.com</b> in a browser (the Strava app cannot export): your picture → <b>Settings</b> → <b>My Account</b> → <b>Download or delete your account</b> → <b>Get started</b> → <b>Request your archive</b>.</li>
        <li>Strava emails a download link, usually within a few hours. Download the <b>.zip</b>; on an iPhone it lands in Files → Downloads.</li>
        <li>Choose it below. You can also choose <b>activities.csv</b> from inside it (no routes that way), or one activity's own <b>.gpx</b>, <b>.tcx</b> or <b>.fit</b> file.</li>
      </ol>
      <div class="fine">Set Strava's language to English before requesting the archive; the file's columns are named in that language. Already imported? Choose the same .zip again to add the routes: nothing is added twice.</div>
    </details>
    <input type="file" id="strava-file" multiple style="display:none" onchange="stravaPicked(this)">
    <button class="btn btp bfw" id="sv-choose" onclick="document.getElementById('strava-file').click()">Choose file</button>
    <div id="sv-body"></div>
    <button class="btn btg bfw" id="sv-close" style="margin-top:7px" onclick="stravaClose()">Close</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
}
function stravaClose(){const z=window._strava;if(z&&z.busy){z.job.stop=true;return;}window._strava=null;closeOv('strava-ov');}
async function stravaPicked(inp){
  const files=[...(inp.files||[])];inp.value='';if(!files.length)return;
  if(window._strava&&window._strava.busy)return;
  const body=document.getElementById('sv-body');if(body)body.innerHTML=`<div class="note-box"><span class="ai-spin"></span> Reading ${files.length>1?files.length+' files':esc(files[0].name)}…</div>`;
  let r;try{r=await stravaReadFiles(files);}catch(e){r={items:[],notes:[e&&e.message||'Could not read that file.'],zips:[]};}
  const plan=stravaPlan(r.items);
  const kinds={};Object.keys(plan.kinds).forEach(k=>{kinds[k]=k!=='lift';});
  window._strava={plan,kinds,notes:r.notes,zips:r.zips};
  stravaPaint();
  // The steps have done their job: fold them so the result is what shows.
  const fold=document.querySelector('#strava-ov details.fold');if(fold)fold.open=false;
  const m=document.querySelector('#strava-ov .modal');if(m)m.scrollTop=0;
}
function stravaToggle(k){const z=window._strava;if(!z||z.busy)return;z.kinds[k]=!z.kinds[k];stravaPaint();}
function stravaPaint(){
  const z=window._strava,body=document.getElementById('sv-body');if(!z||!body)return;
  const{plan,kinds,notes}=z;
  const picked=plan.add.filter(it=>kinds[it.type]);const n=picked.length;
  const tracked=picked.filter(it=>it.file||it.route).length;
  const gain=plan.touch.filter(t=>t.it.file||t.it.route).length; // already here, and this file has their route
  const order=['run','ruck','walk','hike','bike','swim','other','lift'];
  const rows=order.filter(k=>plan.kinds[k]).map(k=>{
    const its=plan.add.filter(it=>it.type===k);const mi=its.reduce((s,it)=>s+(it.distMi||0),0);
    const sub=[`${its.length}`,mi>=1&&k!=='swim'&&k!=='lift'&&k!=='other'?`${Math.round(mi).toLocaleString()} mi`:'',k==='lift'?'off: your lifts are logged here set by set':''].filter(Boolean).join(' · ');
    return`<div class="frow set-row"><span class="set-lbl">${STRAVA_KIND_LABEL[k]}<br><small>${esc(sub)}</small></span><button class="tog${kinds[k]?' on':''}" role="switch" aria-checked="${kinds[k]?'true':'false'}" aria-label="${STRAVA_KIND_LABEL[k]}" onclick="stravaToggle(${jsq(k)})"></button></div>`;
  }).join('');
  const skipped=[plan.already?`${plan.already} already imported`:'',plan.dup?`${plan.dup} look like ones you logged here, or have no time or distance`:''].filter(Boolean).join('; ');
  const label=n?`Import ${n} activit${n===1?'y':'ies'}`:gain?`Add the route to ${gain} activit${gain===1?'y':'ies'}`:plan.touch.length?`Update ${plan.touch.length} activit${plan.touch.length===1?'y':'ies'}`:'';
  body.innerHTML=`${plan.add.length?`<div class="sec-h" style="margin-top:14px">Found ${plan.add.length} new · ${esc(fmtDay(plan.from))} – ${esc(fmtDay(plan.to))}</div><div class="set-sec" style="margin-top:6px">${rows}</div>`:`<div class="note-box" style="margin-top:12px">${plan.already||plan.dup?(plan.touch.length?'No new activities.':'Nothing new to import.'):'No activities found in that file.'}</div>`}
    ${tracked||gain?`<div class="fine" id="sv-routes" style="margin:6px 0">${[tracked?`${tracked} of the ${n} ${tracked===1?'has':'have'} a route.`:'',gain?`${gain} you already imported will get ${gain===1?'its':'their'} route.`:''].filter(Boolean).join(' ')} Reading them takes a little while; keep the app open.</div>`:''}
    ${skipped?`<div class="fine" style="margin:6px 0">Skipped: ${esc(skipped)}.</div>`:''}
    ${notes.length?`<div class="fine" style="margin:6px 0">${notes.slice(0,5).map(esc).join('<br>')}</div>`:''}
    ${label?`<button class="btn btp bfw" id="sv-go" style="margin-top:8px" onclick="stravaGo()">${label}</button>`:''}`;
}
async function stravaGo(){
  const z=window._strava;if(!z||z.busy)return;
  const added=stravaApply(z.plan,z.kinds);
  const pairs=(z.plan.made||[]).concat(z.plan.touch);
  const job={pairs,zips:z.zips,stop:false,fresh:new Set(added)};
  let res={routes:0,failed:0,none:0,put:[],prev:[]};
  if(pairs.some(p=>p.it.file||p.it.route||p.it.sec>0||p.it.gear)){
    z.busy=true;z.job=job;
    const body=document.getElementById('sv-body');const ch=document.getElementById('sv-choose');const cl=document.getElementById('sv-close');
    if(ch)ch.style.display='none';if(cl)cl.textContent='Stop';
    if(body)body.innerHTML=`<div class="note-box" style="margin-top:12px"><span class="ai-spin"></span> <span id="sv-prog">Reading routes…</span><div class="sv-bar"><i id="sv-bar"></i></div><div class="fine" style="margin-top:6px">Keep the app open. Stop keeps what has been read so far.</div></div>`;
    try{
      res=await stravaRoutes(job,(i,total)=>{
        const p=document.getElementById('sv-prog'),b=document.getElementById('sv-bar');
        if(p)p.textContent=`Reading routes… ${Math.min(i+1,total)} of ${total}`;if(b)b.style.width=Math.round(100*i/Math.max(1,total))+'%';
      });
    }catch(e){logError(e,'strava routes');}
    z.busy=false;
  }
  window._strava=null;
  closeOv('strava-ov');
  const touched=res.prev.length;
  if(!added.length&&!touched){toast(res.failed?'The routes could not be read':'Nothing imported');return;}
  render();
  const done={added,put:res.put,prev:res.prev};
  const parts=[added.length?`Imported ${added.length} activit${added.length===1?'y':'ies'}`:'',res.routes?`${res.routes} route${res.routes===1?'':'s'}${added.length?'':' added'}`:(!added.length&&touched?`Updated ${touched} activit${touched===1?'y':'ies'}`:'')].filter(Boolean);
  toast(parts.join(' · ')+(res.failed?` (${res.failed} route${res.failed===1?'':'s'} could not be read)`:''),'green',{ms:9000,action:'Undo',onAction:()=>{stravaUndo(done).then(()=>{render();toast('Import undone');});}});
}
