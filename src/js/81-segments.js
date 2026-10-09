// ═══════════════════════════════════════════════════
// STRETCHES — a piece of a route you mark, timed on every run that passes along it
// ═══════════════════════════════════════════════════
// Mark a stretch on any activity's route: a hill, a lap of the park, the mile home. Every other
// route of the same kind is then checked, and each run that follows the stretch from its start
// to its end, in that direction, is timed over it and ranked. All of it is worked out on the
// device from the stored routes.
// In S a stretch is {id, name, kind, m, from, made, efforts:[{a, sec}]}: its name, its length and
// the times. Its line is a route record of its own in the device database ("seg-<id>"), so it
// outlives the activity it was drawn on and travels in backups; no coordinate is in S.
const SEG_MAX=30;
const SEG_TOL=35;        // metres a run may be from the line and still be "on" it (GPS, the other pavement)
const SEG_MIN=150;       // a stretch shorter than this is mostly GPS error
function normalizeSegments(v,acts){
  if(!Array.isArray(v))return[];
  const have=new Set((acts||[]).map(a=>String(a.id)));
  return v.filter(isObj).slice(0,SEG_MAX).map(g=>({
    id:String(g.id||uid()).replace(/[^0-9A-Za-z_-]/g,'').slice(0,24)||uid(),
    name:String(g.name||'Stretch').trim().slice(0,40)||'Stretch',
    kind:RV_KINDS.some(k=>k.id===g.kind)?g.kind:'run',
    m:Math.max(0,Math.min(1e6,Number(g.m)||0)),from:g.from!=null?String(g.from).slice(0,40):'',made:Number(g.made)||0,
    efforts:(Array.isArray(g.efforts)?g.efforts:[]).filter(e=>isObj(e)&&have.has(String(e.a))&&Number(e.sec)>0).slice(0,2000).map(e=>({a:String(e.a),sec:Math.round(Number(e.sec)*10)/10})),
  }));
}
// ─── Geometry ───
// The part of a decoded route between two distances, as arrays ready for routeEncode.
function segSlice(rt,d0,d1){
  const lat=[],lon=[],t=[],d=[];
  const put=x=>{const p=routePointAt(rt,x);const tm=_timeAt(rt,x,0).t;lat.push(p[0]);lon.push(p[1]);t.push(tm);d.push(x-d0);};
  put(d0);for(let i=0;i<rt.n;i++)if(rt.d[i]>d0&&rt.d[i]<d1)put(rt.d[i]);put(d1);
  const t0=t[0];return{lat,lon,t:t.map(x=>x-t0),d};
}
// A stretch ready for matching: K points evenly along it, in metres from its own start.
function segShape(sg){
  const len=sg.d[sg.n-1];const K=Math.max(6,Math.min(40,Math.round(len/60)+1));
  const k=Math.PI/180*6371008.8,cos=Math.cos(sg.lat[0]*Math.PI/180);
  const x=[],y=[];
  for(let i=0;i<K;i++){const p=routePointAt(sg,len*i/(K-1));x.push((p[1]-sg.lon[0])*k*cos);y.push((p[0]-sg.lat[0])*k);}
  return{len,K,x,y,lat0:sg.lat[0],lon0:sg.lon[0],k,cos,minX:Math.min(...x),maxX:Math.max(...x),minY:Math.min(...y),maxY:Math.max(...y)};
}
// The fastest time a route takes over a stretch, in seconds, or null if it never follows it.
// The route has to come within reach of every point of the stretch in order, and cover about the
// stretch's own length doing it (80% to 125%): cutting a corner, or wandering off and back, is
// not the same stretch. A route that laps it more than once is given its fastest lap.
function segMatch(P,rt){
  if(!rt.timed&&rt.timed!==undefined)return null;
  const n=rt.n;if(n<2)return null;
  const X=new Array(n),Y=new Array(n);let inBox=false;const tol=SEG_TOL,tol2=tol*tol;
  for(let i=0;i<n;i++){X[i]=(rt.lon[i]-P.lon0)*P.k*P.cos;Y[i]=(rt.lat[i]-P.lat0)*P.k;
    if(X[i]>=P.minX-tol&&X[i]<=P.maxX+tol&&Y[i]>=P.minY-tol&&Y[i]<=P.maxY+tol)inBox=true;}
  if(!inBox)return null;
  // Closest approach of route segment i (from fraction u0 onward) to a point: {d2,u}.
  const near=(i,px,py,u0)=>{
    const ax=X[i],ay=Y[i],bx=X[i+1]-ax,by=Y[i+1]-ay;const len2=bx*bx+by*by;
    let u=len2?((px-ax)*bx+(py-ay)*by)/len2:0;u=Math.max(u0||0,Math.min(1,u));
    const dx=px-ax-u*bx,dy=py-ay-u*by;return{d2:dx*dx+dy*dy,u};
  };
  const along=p=>rt.d[p.i]+p.u*(rt.d[p.i+1]-rt.d[p.i]),when=p=>rt.t[p.i]+p.u*(rt.t[p.i+1]-rt.t[p.i]);
  // From a position, the next time the route comes within reach of a point, at its closest; null if it has not by `limit` metres along.
  const next=(from,px,py,limit)=>{
    let i=from.i,u0=from.u;
    for(;i<n-1;i++,u0=0){
      if(rt.d[i]>limit)return null;
      let q=near(i,px,py,u0);if(q.d2>tol2)continue;
      let best={i,u:q.u,d2:q.d2};
      for(let j=i+1;j<n-1;j++){const r=near(j,px,py,0);if(r.d2>tol2)break;if(r.d2<best.d2)best={i:j,u:r.u,d2:r.d2};}
      return best;
    }
    return null;
  };
  let bestSec=null;let pos={i:0,u:0};
  for(let guard=0;guard<200;guard++){
    const start=next(pos,P.x[0],P.y[0],Infinity);if(!start)break;
    const d0=along(start);let p=start,ok=true;
    for(let k=1;k<P.K;k++){p=next(p,P.x[k],P.y[k],d0+P.len*1.3+tol);if(!p){ok=false;break;}}
    if(ok){
      const run=along(p)-d0,sec=when(p)-when(start);
      if(run>=P.len*0.8&&run<=P.len*1.25&&sec>0&&(bestSec==null||sec<bestSec))bestSec=sec;
    }
    // look for another pass, starting once the route has left the start point's reach
    let i=start.i+1;while(i<n-1&&near(i,P.x[0],P.y[0],0).d2<=tol2)i++;
    if(i>=n-1)break;pos={i,u:0};
  }
  return bestSec;
}
async function segLoad(id){
  const rec=await Routes.get('seg-'+id);const sg=rec?routeDecode(rec):null;
  return sg?{rec,sg,shape:segShape(sg)}:null;
}
// Time every route of the right kind over a stretch (or only the given activities), and store the result.
async function segRefresh(seg,onlyIds){
  const got=await segLoad(seg.id);if(!got)return 0;
  const keep=new Map((seg.efforts||[]).map(e=>[e.a,e.sec]));
  const acts=(S.activities||[]).filter(a=>a.rt&&rvKindOf(a.type)===seg.kind&&(!onlyIds||onlyIds.includes(a.id)));
  for(const a of acts){
    let r=null;try{r=await routeLoad(a.id);}catch(e){}
    if(!r||!r.rt.timed)continue;
    const sec=segMatch(got.shape,r.rt);
    if(sec)keep.set(a.id,Math.round(sec*10)/10);else keep.delete(a.id);
  }
  const have=new Set(S.activities.map(a=>a.id));
  seg.efforts=[...keep].filter(([a])=>have.has(a)).map(([a,sec])=>({a,sec})).sort((x,y)=>x.sec-y.sec);
  return seg.efforts.length;
}
// After an import brings in new routes: time them over every stretch.
async function segRefreshAll(onlyIds){
  if(!S.segments.length)return;
  for(const seg of S.segments){try{await segRefresh(seg,onlyIds);}catch(e){logError(e,'stretch');}}
  save();
}
// A stretch's efforts with their activities, fastest first (efforts whose activity is gone are left out).
function segEfforts(seg){
  const by=new Map(S.activities.map(a=>[a.id,a]));
  return(seg.efforts||[]).map(e=>({a:by.get(e.a),sec:e.sec})).filter(e=>e.a).sort((x,y)=>x.sec-y.sec);
}
async function segCreate(actId,d0,d1,name){
  const a=S.activities.find(x=>x.id===actId);const got=a&&await routeLoad(actId);
  if(!got||!(d1-d0>=SEG_MIN))return null;
  if(S.segments.length>=SEG_MAX){toast(`Up to ${SEG_MAX} stretches. Delete one first.`);return null;}
  const id=uid();const sl=segSlice(got.rt,d0,d1);const enc=routeEncode(sl);
  const rec={v:1,at:0,n:enc.n,f:enc.f,p:enc.p,sec:0,m:Math.round((d1-d0)*10)/10,el:0,sp:[],lp:null,up:0,dn:0,eq:0,ge:0,hr:0,hrx:0};
  await Routes.put('seg-'+id,rec);
  const seg={id,name:String(name||'').trim().slice(0,40)||`Stretch ${S.segments.length+1}`,kind:rvKindOf(a.type)||'run',m:rec.m,from:actId,made:Date.now(),efforts:[]};
  S.segments.push(seg);
  await segRefresh(seg);
  save();
  return seg;
}
function segDelete(id){
  const seg=S.segments.find(g=>g.id===id);if(!seg)return;
  customConfirm(`Delete “${esc(seg.name)}” and its times? The runs themselves are not touched.`,'Delete stretch',()=>{
    S.segments=S.segments.filter(g=>g.id!==id);save();
    Routes.del('seg-'+id).catch(e=>logError(e,'stretch'));
    closeOv('seg-ov');if(document.getElementById('run-ov'))renderRunning();
    toast('Stretch deleted');
  });
}
function segRename(id,name){
  const seg=S.segments.find(g=>g.id===id);name=String(name||'').trim().slice(0,40);if(!seg||!name||name===seg.name)return;
  seg.name=name;save();if(document.getElementById('run-ov'))renderRunning();toast('Renamed','green');
}

// ─── Marking a stretch (from an activity's route) ───
let _sg=null;
async function showSegMark(actId){
  const a=S.activities.find(x=>x.id===actId);const got=a&&await routeLoad(actId);if(!got)return;
  const total=got.rt.d[got.rt.n-1];
  _sg={id:actId,rt:got.rt,total,d0:Math.round(total*0.25),d1:Math.round(total*0.5)};
  const ov=makeOv('segmark-ov');
  ov.innerHTML=`<div class="modal" style="max-height:94vh"><div class="mh"></div>
    <div class="mt" style="margin-bottom:2px">Mark a stretch</div>
    <div class="sheet-sub">Choose where it starts and ends along this route. Every ${esc((RV_KINDS.find(k=>k.id===rvKindOf(a.type))||RV_KINDS[0]).label.toLowerCase().replace(/s$/,''))} that follows it in the same direction is then timed over it.</div>
    <div id="sgm-map"></div>
    <div class="fg" style="margin-top:10px"><label class="fl" for="sgm-a">Starts at <span id="sgm-a-v"></span></label><input type="range" id="sgm-a" min="0" max="${Math.round(total)}" step="${Math.max(5,Math.round(total/400))}" value="${_sg.d0}" oninput="segMarkSet('d0',this.value)"></div>
    <div class="fg"><label class="fl" for="sgm-b">Ends at <span id="sgm-b-v"></span></label><input type="range" id="sgm-b" min="0" max="${Math.round(total)}" step="${Math.max(5,Math.round(total/400))}" value="${_sg.d1}" oninput="segMarkSet('d1',this.value)"></div>
    <div class="fg"><label class="fl" for="sgm-name">Name</label><input id="sgm-name" maxlength="40" placeholder="The hill, the park lap, the mile home"></div>
    <div class="fine" id="sgm-len" style="margin:-4px 2px 10px"></div>
    <button class="btn btp bfw" id="sgm-save" onclick="segMarkSave()">Save and time my runs</button>
    <button class="btn btg bfw" style="margin-top:7px" onclick="closeOv('segmark-ov')">Cancel</button></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  segMarkPaint();
}
function segMarkSet(k,v){
  const s=_sg;if(!s)return;v=Math.max(0,Math.min(s.total,parseFloat(v)||0));
  s[k]=v;
  // The two ends push each other along rather than cross.
  if(s.d1-s.d0<SEG_MIN){if(k==='d0')s.d1=Math.min(s.total,s.d0+SEG_MIN);else s.d0=Math.max(0,s.d1-SEG_MIN);
    if(s.d1-s.d0<SEG_MIN){s.d0=Math.max(0,s.total-SEG_MIN);s.d1=s.total;}
    const a=document.getElementById('sgm-a'),b=document.getElementById('sgm-b');if(a)a.value=s.d0;if(b)b.value=s.d1;}
  segMarkPaint();
}
function segMarkPaint(){
  const s=_sg;const m=document.getElementById('sgm-map');if(!s||!m)return;
  m.innerHTML=routeSvg(s.rt,{hl:[s.d0,s.d1],h:200,noKey:true,label:'The route, with the stretch marked'});
  const mi=x=>fmt1(x/MILE_M);
  const a=document.getElementById('sgm-a-v'),b=document.getElementById('sgm-b-v'),l=document.getElementById('sgm-len');
  if(a)a.textContent=`mile ${(s.d0/MILE_M).toFixed(2)}`;if(b)b.textContent=`mile ${(s.d1/MILE_M).toFixed(2)}`;
  const len=s.d1-s.d0;const sec=_timeAt(s.rt,s.d1,0).t-_timeAt(s.rt,s.d0,0).t;
  if(l)l.textContent=`${len<MILE_M*0.2?Math.round(len)+' m':mi(len)+' mi'} long. On this run it took ${fmtClock(sec)}.`;
}
async function segMarkSave(){
  const s=_sg;if(!s)return;
  const btn=document.getElementById('sgm-save');if(btn){btn.disabled=true;btn.textContent='Timing your runs…';}
  let seg=null;try{seg=await segCreate(s.id,s.d0,s.d1,document.getElementById('sgm-name')?.value);}catch(e){logError(e,'stretch');}
  if(!seg){if(btn){btn.disabled=false;btn.textContent='Save and time my runs';}return;}
  _sg=null;closeOv('segmark-ov');
  if(document.getElementById('run-ov'))renderRunning();
  showSegment(seg.id);
}

// ─── A stretch and its times ───
async function showSegment(id){
  const seg=S.segments.find(g=>g.id===id);if(!seg)return;
  const ov=makeOv('seg-ov');
  ov.innerHTML=`<div class="modal metric-sheet" style="max-height:94vh"><div class="mh"></div><div id="seg-body"><div class="mt">${esc(seg.name)}</div><div class="fine">Reading the stretch…</div></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  let got=null;try{got=await segLoad(id);}catch(e){}
  const el=document.getElementById('seg-body');if(!el)return;
  const eff=segEfforts(seg);const best=eff[0];
  const byDate=eff.slice().sort((x,y)=>(x.a.date<y.a.date?-1:x.a.date>y.a.date?1:(x.a.at||0)-(y.a.at||0)));
  const last=byDate[byDate.length-1];
  const mi=seg.m/MILE_M;const len=seg.m<MILE_M*0.2?`${Math.round(seg.m)} m`:`${fmt1(mi)} mi`;
  const f=byDate.length>=3?fitLine(byDate.map(e=>({t:dayNum(e.a.date),v:e.sec}))):null;const perMonth=f&&f.span>=14?f.perDay*30:null;
  const st=(v,t)=>`<div class="st"><div class="st-v">${esc(v)}</div><div class="st-l">${esc(t)}</div></div>`;
  el.innerHTML=`<div class="mt" style="margin-bottom:2px" id="seg-title">${esc(seg.name)}</div>
    <div class="sheet-sub" style="margin-bottom:8px">${esc(len)} · ${eff.length} time${eff.length===1?'':'s'} on it</div>
    ${got?routeSvg(got.sg,{h:170,noKey:true,label:'The stretch, north up'}):`<div class="note-box">The line of this stretch is not on this device, so new runs cannot be timed on it. The times already found are kept.</div>`}
    ${eff.length?`<div class="st-grid" style="margin-top:10px">${st(fmtClock(best.sec),`Fastest, ${fmtDay(best.a.date)}`)}${st(fmtClock(last.sec),`Latest, ${fmtDay(last.a.date)}`)}${st(perMonth==null?'–':Math.abs(perMonth)<0.5?'Level':`${Math.round(Math.abs(perMonth))} s`,perMonth==null||Math.abs(perMonth)<0.5?'Trend':perMonth<0?'Faster a month':'Slower a month')}</div>
      ${byDate.length>=2?chartLine(byDate.map(e=>({t:dayNum(e.a.date),v:e.sec,read:`${fmtDay(e.a.date)} · ${fmtClock(e.sec)}`})),{invert:true,fmt:fmtClock,label:'Time over the stretch',fit:f&&perMonth!=null?{a:f.a,b:f.b}:null}):''}
      <div class="sec-h">Ranked</div><div class="list" id="seg-rank">${eff.slice(0,40).map((e,i)=>`<button class="row row-tap" onclick="showActivityDetail(${jsq(e.a.id)})"><span class="row-ic${i===0?' tone-info':''}">${i+1}</span><span class="row-main"><span class="row-t">${esc(fmtDate(e.a.date+'T12:00:00').replace(/, \d{4}$/,''))}</span><span class="row-s">${esc(rvName(e.a))}${mi>=0.2&&seg.kind!=='bike'?` · ${fmtPace(e.sec/mi)} a mile`:''}</span></span><span class="aim"><span class="aim-v">${fmtClock(e.sec)}</span>${i?`<span class="aim-f">+${fmtClock(e.sec-best.sec)}</span>`:''}</span></button>`).join('')}</div>`
      :`<div class="ch-empty">No run has followed this stretch yet.</div>`}
    <div class="fine">A run counts when it comes within ${SEG_TOL} m of the whole stretch, in order and in this direction, and covers about its length. One that laps it is given its fastest lap. Times leave out standing still.</div>
    <div class="fg" style="margin-top:6px"><label class="fl" for="seg-name">Name</label><div class="frow" style="gap:8px"><input id="seg-name" maxlength="40" value="${esc(seg.name)}" style="flex:1"><button class="btn bts" onclick="segRename(${jsq(seg.id)},document.getElementById('seg-name').value);document.getElementById('seg-title').textContent=S.segments.find(g=>g.id===${jsq(seg.id)}).name">Rename</button></div></div>
    <div class="sheet-acts"><button class="btn btg" onclick="closeOv('seg-ov')">Close</button><button class="btn btg" style="color:var(--red)" onclick="segDelete(${jsq(seg.id)})">Delete</button></div>`;
}
function segSectionHTML(){
  const list=S.segments||[];
  const rows=list.map(seg=>{const eff=segEfforts(seg);const mi=seg.m/MILE_M;
    return{t:seg.name,s:`${seg.m<MILE_M*0.2?Math.round(seg.m)+' m':fmt1(mi)+' mi'} · ${eff.length} time${eff.length===1?'':'s'}${eff.length?` · fastest on ${fmtDay(eff[0].a.date)}`:''}`,v:eff.length?fmtClock(eff[0].sec):'–',js:`showSegment(${JSON.stringify(seg.id)})`};});
  return`<div class="sec-h">Your stretches</div>${rows.length?`<div id="seg-list">${mRowsHTML(rows)}</div>`:''}
    <div class="fine" id="seg-how">${rows.length?'':'A stretch is a piece of a route you mark: a hill, a lap, the last mile home. Every run that follows it is timed and ranked. '}To mark one, open a run that has a route and choose “Mark a stretch of this route”.</div>`;
}
function ordinal(n){const t=n%100;return n+(t>=11&&t<=13?'th':['th','st','nd','rd'][n%10]||'th');}
// On an activity's sheet: how this run did on each stretch it followed.
function segOnActivityHTML(a){
  const rows=[];
  (S.segments||[]).forEach(seg=>{const eff=segEfforts(seg);const i=eff.findIndex(e=>e.a.id===a.id);if(i<0)return;
    rows.push({t:seg.name,s:`${i===0?'Your fastest':`${ordinal(i+1)} fastest`} of ${eff.length}`,v:fmtClock(eff[i].sec),js:`showSegment(${JSON.stringify(seg.id)})`});});
  return rows.length?`<div id="ad-segs">${mRowsHTML(rows,'Stretches on this run')}</div>`:'';
}
RUN_SECTIONS.push(()=>{const n=(S.segments||[]).length;return runFold('segs','Your stretches',n?`${n} marked`:'none yet',segSectionHTML());});
