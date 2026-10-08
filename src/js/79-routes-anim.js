// ═══════════════════════════════════════════════════
// ROUTES — every route drawn from one starting point
// ═══════════════════════════════════════════════════
// Each route is moved so that it begins at the centre, keeps its real direction (north is up),
// and all of them are drawn outward at the same time: the shape of where your running goes.
// It is drawn on a canvas, and each frame adds only the new piece of every line, so a few hundred
// routes stay smooth. Faster efforts are brighter, in the one accent colour.
// Nothing here leaves the device, and nothing here is in S: routes are read from the device database.
const RV_MS=6500;          // how long the longest route takes to draw
const RV_LEVELS=[0.28,0.4,0.53,0.67,0.83,1]; // opacity, slowest to fastest
const RV_TIMES=[{id:'30d',label:'30 days'},{id:'3m',label:'3 months'},{id:'year',label:'This year'},{id:'all',label:'All'},{id:'custom',label:'Custom'}];
const RV_KINDS=[{id:'run',label:'Runs',types:['run']},{id:'ruck',label:'Rucks',types:['ruck']},{id:'walk',label:'Walks',types:['walk','hike']},{id:'bike',label:'Rides',types:['bike']}];
const RV_BANDS=[{id:'any',label:'Any distance',lo:0,hi:1e9},{id:'s',label:'Under 3 mi',lo:0,hi:3},{id:'m',label:'3 to 6 mi',lo:3,hi:6},{id:'l',label:'6 to 10 mi',lo:6,hi:10},{id:'xl',label:'Over 10 mi',lo:10,hi:1e9}];
let _rv=null;

function rvKindOf(type){const k=RV_KINDS.find(x=>x.types.includes(type));return k?k.id:null;}
// Which kinds have a route at all, and the filters the page opens with: runs when there are
// any (a single long ride would shrink every run to a dot), otherwise whatever there is.
function rvKindsWithRoutes(){const have={};(S.activities||[]).forEach(a=>{const k=a.rt&&rvKindOf(a.type);if(k)have[k]=(have[k]||0)+1;});return have;}
function rvDefaults(){
  const have=rvKindsWithRoutes();const kinds={};
  RV_KINDS.forEach(k=>{kinds[k.id]=have.run?k.id==='run':!!have[k.id];});
  return{time:'all',from:'',to:'',band:'any',kinds,mode:'dist'};
}
function rvFrom(f){
  const td=today();
  if(f.time==='30d')return[daysAgoStr(30),td];
  if(f.time==='3m')return[daysAgoStr(91),td];
  if(f.time==='year')return[td.slice(0,4)+'-01-01',td];
  if(f.time==='custom')return[isRealDate(f.from)?f.from:'0000-00-00',isRealDate(f.to)?f.to:'9999-99-99'];
  return['0000-00-00','9999-99-99'];
}
// The activities with a route that pass the filters, newest first.
function rvActs(f){
  const[from,to]=rvFrom(f);const band=RV_BANDS.find(b=>b.id===f.band)||RV_BANDS[0];
  return(S.activities||[]).filter(a=>{
    if(!a.rt)return false;
    const k=rvKindOf(a.type);if(!k||!f.kinds[k])return false;
    if(a.date<from||a.date>to)return false;
    const mi=parseFloat(a.dist)||0;return mi>=band.lo&&mi<band.hi;
  }).sort((x,y)=>(y.date<x.date?-1:y.date>x.date?1:(y.at||0)-(x.at||0)));
}
// One route ready to draw: metres east (x) and north (y) of its own start, with the distance and
// moving time at each point.
function rvItem(a,got){
  const rt=got.rt,n=rt.n;const k=Math.PI/180*6371008.8,cos=Math.cos(rt.lat[0]*Math.PI/180);
  const x=new Array(n),y=new Array(n);let rx=0,ry=0; // how far it gets from its start, east–west and north–south
  for(let i=0;i<n;i++){x[i]=(rt.lon[i]-rt.lon[0])*k*cos;y[i]=(rt.lat[i]-rt.lat[0])*k;if(Math.abs(x[i])>rx)rx=Math.abs(x[i]);if(Math.abs(y[i])>ry)ry=Math.abs(y[i]);}
  const m=rt.d[n-1],sec=got.rec.sec>0?rt.t[n-1]:0;
  return{id:a.id,a,rec:got.rec,x,y,d:rt.d,t:rt.t,n,m,sec,rx,ry,r:Math.max(rx,ry),speed:sec>0?m/sec:0,kind:rvKindOf(a.type),level:2,done:0,at:0};
}
// Brightness: each route's speed ranked among routes of its own kind (a ride is not "faster" than
// a run), into six steps. Routes with no time sit in the middle.
function rvShade(items){
  RV_KINDS.forEach(k=>{
    const set=items.filter(it=>it.kind===k.id&&it.speed>0).sort((a,b)=>a.speed-b.speed);
    set.forEach((it,i)=>{it.level=set.length===1?RV_LEVELS.length-2:Math.min(RV_LEVELS.length-1,Math.floor(i/(set.length-1)*(RV_LEVELS.length-1)+0.5));});
  });
  return items;
}
// How far along a route the drawing has got, in metres, when the animation is frac of the way through.
// 'dist': every route grows at the same rate, so short ones finish first.
// 'time': every route is at the same moment of its effort, so faster ones are further out.
function rvReach(it,mode,frac,maxM,maxSec){
  frac=Math.max(0,Math.min(1,frac));
  if(mode==='time'&&it.sec>0&&maxSec>0){
    const t=frac*maxSec;if(t>=it.sec)return it.m;
    let i=it.at;while(i<it.n-2&&it.t[i+1]<t)i++;while(i>0&&it.t[i]>t)i--;
    const t0=it.t[i],t1=it.t[i+1];const f=t1>t0?(t-t0)/(t1-t0):1;
    return it.d[i]+f*(it.d[i+1]-it.d[i]);
  }
  return Math.min(it.m,frac*maxM);
}
function rvIndexAt(it,dist,hint){let i=hint||0;while(i<it.n-2&&it.d[i+1]<dist)i++;while(i>0&&it.d[i]>dist)i--;return i;}
function rvPointAt(it,dist,hint){
  const i=rvIndexAt(it,dist,hint);const d0=it.d[i],d1=it.d[i+1];const f=d1>d0?Math.max(0,Math.min(1,(dist-d0)/(d1-d0))):0;
  return{i,x:it.x[i]+f*(it.x[i+1]-it.x[i]),y:it.y[i]+f*(it.y[i+1]-it.y[i])};
}
// The routes nearest a point (in metres from the shared start), closest first: [{it,dist}].
function rvNearest(items,mx,my,limit){
  const out=[];
  for(const it of items){
    let best=Infinity;
    for(let i=1;i<it.n;i++){
      const ax=it.x[i-1],ay=it.y[i-1],bx=it.x[i]-ax,by=it.y[i]-ay;const len2=bx*bx+by*by;
      let u=len2?((mx-ax)*bx+(my-ay)*by)/len2:0;u=Math.max(0,Math.min(1,u));
      const dx=mx-ax-u*bx,dy=my-ay-u*by;const q=dx*dx+dy*dy;if(q<best)best=q;
    }
    out.push({it,dist:Math.sqrt(best)});
  }
  return out.sort((a,b)=>a.dist-b.dist).slice(0,limit||5);
}
// What a tap means: tol is the reach of a fingertip in metres. One route clearly nearest → that
// one. Several within reach (always the case near the centre) → a short list to choose from.
function rvPick(items,mx,my,tol){
  const near=rvNearest(items,mx,my,5).filter(n=>n.dist<=tol);
  if(!near.length)return{none:true};
  if(near.length===1||near[1].dist-near[0].dist>tol*0.45)return{one:near[0].it};
  return{many:near.map(n=>n.it)};
}

// ─── The sheet ───
function showRoutes(){
  if(!runningOn()){toast('Running is switched off in Settings');return;}
  rvStop();
  _rv={canvas:'rv-canvas',f:rvDefaults(),items:[],sel:null,list:null,frac:0,run:0,done:false,loading:false};
  const ov=makeOv('routes-ov');
  ov.innerHTML=`<div class="modal metric-sheet" style="max-height:94vh"><div class="mh"></div><div id="rv-body"></div></div>`;
  document.body.appendChild(ov);attachSwipeDown(ov);
  rvRender();rvReload();
}
function rvChip(on,label,js,extra){return`<button class="chip${on?' on':''}" role="switch" aria-checked="${on?'true':'false'}" onclick="${js}"${extra||''}>${label}</button>`;}
function rvRender(){
  const el=document.getElementById('rv-body');if(!el||!_rv)return;
  const f=_rv.f;const have=rvKindsWithRoutes();const any=Object.keys(have).length>0;
  el.innerHTML=`<div class="mt" style="margin-bottom:2px">Routes</div>
    <div class="sheet-sub" style="margin-bottom:10px">Every route drawn from one starting point, north up. Faster efforts are brighter.</div>
    ${any?`<div class="chips-x" id="rv-time">${RV_TIMES.map(t=>rvChip(f.time===t.id,t.label,`rvSet('time',${jsq(t.id)})`)).join('')}</div>
    ${f.time==='custom'?`<div class="frow" style="gap:10px;margin-bottom:10px"><div style="flex:1"><label class="fl">From</label><input type="date" id="rv-from" value="${esc(f.from)}" max="${today()}" onchange="rvSet('from',this.value)"></div><div style="flex:1"><label class="fl">To</label><input type="date" id="rv-to" value="${esc(f.to)}" max="${today()}" onchange="rvSet('to',this.value)"></div></div>`:''}
    <div class="chips-x" id="rv-kinds">${RV_KINDS.filter(k=>have[k.id]).map(k=>rvChip(!!f.kinds[k.id],`${k.label} <small>${have[k.id]}</small>`,`rvKind(${jsq(k.id)})`)).join('')}</div>
    <div class="chips-x" id="rv-bands">${RV_BANDS.map(b=>rvChip(f.band===b.id,b.label,`rvSet('band',${jsq(b.id)})`)).join('')}</div>`:''}
    <div class="ch-box rv-box"><div class="rv-wrap"><canvas id="rv-canvas" aria-label="Your routes, drawn from one starting point"></canvas><span class="rv-n">N ↑</span><div class="rv-empty" id="rv-empty"></div></div>
      <div class="rv-cap" id="rv-cap"></div></div>
    ${any?`<div class="rv-ctl"><div class="seg" role="tablist" style="margin:0;flex:1"><button class="seg-b${f.mode==='dist'?' on':''}" id="rv-mode-dist" onclick="rvSet('mode','dist')">Same speed</button><button class="seg-b${f.mode==='time'?' on':''}" id="rv-mode-time" onclick="rvSet('mode','time')">Real speed</button></div>
      <button class="btn bts bsm" id="rv-replay" onclick="rvReplay()">Replay</button></div>
    <div class="fine" style="margin-top:6px">${f.mode==='dist'?'Same speed: every route grows at the same rate, so the short ones finish first.':'Real speed: every route is at the same minute of its effort, so the faster ones pull ahead.'}</div>`:''}
    <div id="rv-card"></div>
    <button class="btn btg bfw" style="margin-top:8px" onclick="closeOv('routes-ov')">Close</button>`;
  rvCard();
}
function rvSet(k,v){
  if(!_rv)return;
  if(k==='mode'){if(_rv.f.mode===v)return;_rv.f.mode=v;rvRender();rvSize();rvReplay();return;}
  _rv.f[k]=v;if(k==='from'||k==='to')_rv.f.time='custom';
  _rv.sel=null;_rv.list=null;rvRender();rvReload();
}
function rvKind(k){if(!_rv)return;_rv.f.kinds[k]=!_rv.f.kinds[k];_rv.sel=null;_rv.list=null;rvRender();rvReload();}
// Read the routes the filters ask for, then draw them.
async function rvReload(){
  const rv=_rv;if(!rv)return;
  rvStop();const turn=++rv.run;rv.loading=true;rv.items=[];rvEmpty('Reading your routes…');rvCap();
  const acts=rvActs(rv.f);const items=[];
  for(const a of acts){
    let got=null;try{got=await routeLoad(a.id);}catch(e){}
    if(_rv!==rv||rv.run!==turn)return; // the filters changed again, or the sheet was closed
    if(got&&got.rt.n>=2)items.push(rvItem(a,got));
  }
  rv.items=rvShade(items);rv.loading=false;
  rv.maxM=Math.max(1,...items.map(it=>it.m));rv.maxSec=Math.max(0,...items.map(it=>it.sec));rv.maxR=Math.max(1,...items.map(it=>it.r));
  if(!items.length){
    const total=(S.activities||[]).filter(a=>a.rt).length;
    rvEmpty(total?(acts.length?'These routes are not on this device. Import the same Strava file again to bring them back.':'No routes match these filters.')
      :'No routes yet. Import your Strava archive in Settings and they are drawn here.');
    rvSize();rvCap();rvCard();rv.done=true;return;
  }
  rvEmpty('');rvSize();rvCap();rvCard();rvReplay();
}
function rvEmpty(text){const e=document.getElementById('rv-empty');if(e){e.textContent=text;e.style.display=text?'flex':'none';}}
function rvCap(){
  const c=document.getElementById('rv-cap');if(!c||!_rv)return;const n=_rv.items.length;
  if(!n){c.textContent='';return;}
  const mi=_rv.items.reduce((t,it)=>t+it.m,0)/MILE_M;const far=_rv.maxR/MILE_M;
  c.textContent=`${n} route${n===1?'':'s'} · ${Math.round(mi).toLocaleString()} mi · the edge is ${fmt1(far)} mi from the start`;
}
// ─── Drawing ───
// A "view" is one drawing: the sheet's (_rv) or the board tile's (_rvT). It names its canvas and
// holds its own routes, so the two never disturb each other.
function rvvCtx(v){
  const cv=v&&document.getElementById(v.canvas);if(!cv||!cv.getContext)return null;
  const ctx=cv.getContext('2d');return ctx?{cv,ctx}:null;
}
// Fit the canvas to its box at the screen's real pixel density. ratio is height ÷ width (1 = square).
// The start is the centre; the scale is whatever lets the furthest route reach the nearer edge.
function rvvSize(v,ratio){
  const g=rvvCtx(v);if(!g)return false;
  const w=Math.max(120,Math.round(g.cv.clientWidth||g.cv.parentNode.clientWidth||320));const h=Math.round(w*(ratio||v.ratio||1));const dpr=Math.min(3,window.devicePixelRatio||1);
  g.cv.width=Math.round(w*dpr);g.cv.height=Math.round(h*dpr);g.cv.style.height=h+'px';
  v.w=w;v.h=h;v.dpr=dpr;v.ratio=h/w;
  const rx=Math.max(1,...v.items.map(it=>it.rx)),ry=Math.max(1,...v.items.map(it=>it.ry));
  v.scale=Math.min((w/2-14)/rx,(h/2-14)/ry);
  const cs=getComputedStyle(document.documentElement);
  v.color=(cs.getPropertyValue('--navy')||'').trim()||'#4553ee';v.muted=(cs.getPropertyValue('--muted')||'').trim()||'#888';
  return true;
}
// Adds one route's line between two distances to the current path.
function rvPath(ctx,it,from,to,sc,cx,cy){
  if(!(to>from))return;
  const a=rvPointAt(it,from,it.at),b=rvPointAt(it,to,a.i);
  ctx.moveTo(cx+a.x*sc,cy-a.y*sc);
  for(let i=a.i+1;i<=b.i;i++)ctx.lineTo(cx+it.x[i]*sc,cy-it.y[i]*sc);
  ctx.lineTo(cx+b.x*sc,cy-b.y*sc);
  it.at=b.i;
}
function rvStyle(ctx,v,w){ctx.lineWidth=w;ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle=v.color;}
// Everything drawn so far, from nothing: each route as one stroke (used when a route is picked,
// and once at the end so that every line has an even weight).
function rvvRedraw(v){
  const g=rvvCtx(v);if(!g)return;
  const{ctx}=g;const cx=v.w/2,cy=v.h/2,sc=v.scale;
  ctx.setTransform(v.dpr,0,0,v.dpr,0,0);ctx.clearRect(0,0,v.w,v.h);
  const dim=!!v.sel;
  for(let L=0;L<RV_LEVELS.length;L++){
    ctx.beginPath();let any=false;
    for(const it of v.items){if(it.level!==L||it===v.sel||!(it.done>0))continue;it.at=0;rvPath(ctx,it,0,it.done,sc,cx,cy);any=true;}
    if(!any)continue;
    rvStyle(ctx,v,v.line||2);ctx.globalAlpha=RV_LEVELS[L]*(dim?0.3:1);ctx.stroke();
  }
  if(v.sel&&v.sel.done>0){
    const it=v.sel;ctx.beginPath();it.at=0;rvPath(ctx,it,0,it.done,sc,cx,cy);rvStyle(ctx,v,3.2);ctx.globalAlpha=1;ctx.stroke();
    const e=rvPointAt(it,it.done,0);ctx.beginPath();ctx.arc(cx+e.x*sc,cy-e.y*sc,4.5,0,Math.PI*2);ctx.fillStyle=v.color;ctx.fill();
  }
  ctx.globalAlpha=1;ctx.beginPath();ctx.arc(cx,cy,v.line?3:4,0,Math.PI*2);ctx.fillStyle=v.muted;ctx.fill();
}
// One step of the animation: only the piece each route gained since the last step is drawn.
function rvvStep(v,frac){
  const g=rvvCtx(v);if(!g)return;
  const{ctx}=g;const cx=v.w/2,cy=v.h/2,sc=v.scale;
  ctx.setTransform(v.dpr,0,0,v.dpr,0,0);
  for(let L=0;L<RV_LEVELS.length;L++){
    ctx.beginPath();let any=false;
    for(const it of v.items){
      if(it.level!==L||it===v.sel||it.done>=it.m)continue;
      const to=rvReach(it,v.f.mode,frac,v.maxM,v.maxSec);
      if(to>it.done){rvPath(ctx,it,it.done,to,sc,cx,cy);it.done=to;any=true;}
    }
    if(!any)continue;
    rvStyle(ctx,v,v.line||2);ctx.globalAlpha=RV_LEVELS[L]*(v.sel?0.3:1);ctx.stroke();
  }
  // The picked route keeps its heavy line while the rest are still being drawn.
  const it=v.sel;
  if(it&&it.done<it.m){
    const to=rvReach(it,v.f.mode,frac,v.maxM,v.maxSec);
    if(to>it.done){ctx.beginPath();rvPath(ctx,it,it.done,to,sc,cx,cy);it.done=to;rvStyle(ctx,v,3.2);ctx.globalAlpha=1;ctx.stroke();}
  }
  ctx.globalAlpha=1;
}
function rvvStop(v){if(v&&v.raf){cancelAnimationFrame(v.raf);v.raf=0;}}
function rvvFinish(v){v.items.forEach(it=>{it.done=it.m;});v.frac=1;v.done=true;v.raf=0;rvvRedraw(v);}
// Draw the view's routes from nothing. alive() says whether the view is still the one on screen.
function rvvPlay(v,alive){
  if(!v||!v.items.length)return;
  rvvStop(v);v.items.forEach(it=>{it.done=0;it.at=0;});v.frac=0;v.done=false;
  const g=rvvCtx(v);if(g){g.ctx.setTransform(1,0,0,1,0,0);g.ctx.clearRect(0,0,g.cv.width,g.cv.height);}
  const still=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(still||typeof requestAnimationFrame!=='function'){rvvFinish(v);return;}
  let t0=0;
  const tick=now=>{
    if(!alive()||!document.getElementById(v.canvas)){v.raf=0;return;} // the sheet or the tile has gone
    if(!t0)t0=now;
    const frac=Math.min(1,(now-t0)/RV_MS);v.frac=frac;
    rvvStep(v,frac);
    if(frac<1)v.raf=requestAnimationFrame(tick);else rvvFinish(v);
  };
  v.raf=requestAnimationFrame(tick);
}
// The sheet's own view.
function rvSize(){
  if(!_rv)return;if(!rvvSize(_rv,1))return;
  const cv=document.getElementById(_rv.canvas);if(cv&&!cv._rvTap){cv._rvTap=true;cv.addEventListener('click',rvTap);}
}
function rvRedraw(){if(_rv)rvvRedraw(_rv);}
function rvStop(){rvvStop(_rv);}
function rvReplay(){const rv=_rv;if(rv)rvvPlay(rv,()=>_rv===rv);}

// ─── The tile on the Progress board ───
// The same drawing with the standard filter (runs when there are any, all time, every distance).
// It draws itself once when the board first shows it; after that it is simply there. Tapping it
// opens the full page, where the filters, the speed and Replay are.
let _rvT=null;
function rvTileData(){
  const f=rvDefaults();const n=rvActs(f).length;
  if(!n)return{title:'Routes',empty:'Import your Strava archive and every route is drawn here from one starting point.'};
  const kinds=RV_KINDS.filter(k=>f.kinds[k.id]).map(k=>k.label).join(', ');
  return{title:'Routes',note:`${kinds} · all time`,canvas:true,foot:`${n} route${n===1?'':'s'} from one start · tap to filter and replay`};
}
async function rvTileMount(){
  if(!document.getElementById('rvt-canvas'))return;
  const f=rvDefaults();const acts=rvActs(f);const sig=acts.map(a=>a.id).join(',');
  let v=_rvT;let fresh=false;
  if(!v||v.sig!==sig){
    rvvStop(v);
    const items=[];
    for(const a of acts){let got=null;try{got=await routeLoad(a.id);}catch(e){}if(got&&got.rt.n>=2)items.push(rvItem(a,got));}
    v=_rvT={canvas:'rvt-canvas',f,sig,items:rvShade(items),sel:null,line:1.6,ratio:0.8,done:false,
      maxM:Math.max(1,...items.map(it=>it.m)),maxSec:Math.max(0,...items.map(it=>it.sec))};
    fresh=true;
  }
  if(!document.getElementById('rvt-canvas')||!rvvSize(v,0.8))return; // the board was redrawn while the routes were being read
  if(!v.items.length)return;
  if(fresh)rvvPlay(v,()=>_rvT===v);
  else if(v.raf)rvvRedraw(v); // the board was redrawn mid-drawing: put back what was there and carry on
  else rvvFinish(v);
}

// ─── Picking a route ───
function rvTap(e){
  const rv=_rv;if(!rv||!rv.items.length)return;
  const r=e.currentTarget.getBoundingClientRect();
  const mx=(e.clientX-r.left-rv.w/2)/rv.scale,my=-(e.clientY-r.top-rv.h/2)/rv.scale;
  const p=rvPick(rv.items,mx,my,18/rv.scale);
  if(p.one){rvChoose(p.one.id);return;}
  rv.sel=null;rv.list=p.many?p.many.map(it=>it.id):null;
  rvRedraw();rvCard();
}
function rvChoose(id){
  const rv=_rv;if(!rv)return;
  rv.sel=rv.items.find(it=>it.id===id)||null;rv.list=null;
  if(rv.sel&&!(rv.sel.done>0)){rv.sel.done=rv.sel.m;} // picked from the list before its line had started
  rvRedraw();rvCard();
}
function rvClear(){if(!_rv)return;_rv.sel=null;_rv.list=null;rvRedraw();rvCard();}
function rvName(a){return a.src==='strava'&&a.notes?String(a.notes).split('\n')[0].slice(0,48):(ACT_TYPES.find(t=>t.id===a.type)||{label:'Activity'}).label;}
function rvCard(){
  const el=document.getElementById('rv-card');const rv=_rv;if(!el||!rv)return;
  if(rv.sel){
    const it=rv.sel,a=it.a;const mi=parseFloat(a.dist)||it.m/MILE_M;const sec=actSec(a)||it.sec;
    const sp=(it.rec.sp||[]).slice(0,30);
    el.innerHTML=`<div class="rv-card" id="rv-sel"><div class="rv-card-h"><div><div class="row-t">${esc(rvName(a))}</div><div class="row-s">${esc(fmtDate(a.date+'T12:00:00'))}</div></div>
        <button class="ib" aria-label="Clear" onclick="rvClear()">✕</button></div>
      <div class="st-grid" style="margin-top:8px"><div class="st"><div class="st-v">${esc(fmt1(mi))}</div><div class="st-l">Miles</div></div><div class="st"><div class="st-v">${sec>0?fmtClock(sec):'–'}</div><div class="st-l">Time</div></div>
        <div class="st"><div class="st-v">${sec>0&&mi>0&&a.type!=='bike'?fmtPace(sec/mi):'–'}</div><div class="st-l">A mile</div></div></div>
      ${sp.length?`<div class="rv-splits" aria-label="Mile splits">${sp.map((s,i)=>`<span><small>${i+1}</small>${fmtClock(s)}</span>`).join('')}</div>`:''}
      <button class="btn btp bfw" style="margin-top:8px" id="rv-open" onclick="showActivityDetail(${jsq(a.id)})">Open this activity</button></div>`;
    return;
  }
  if(rv.list&&rv.list.length){
    const rows=rv.list.map(id=>rv.items.find(it=>it.id===id)).filter(Boolean);
    el.innerHTML=`<div class="sec-h" id="rv-many">${rows.length} routes pass there. Which one?</div><div class="list">${rows.map(it=>{const a=it.a;const mi=parseFloat(a.dist)||it.m/MILE_M;const sec=actSec(a)||it.sec;
      return`<button class="row row-tap" onclick="rvChoose(${jsq(it.id)})"><span class="row-main"><span class="row-t">${esc(rvName(a))}</span><span class="row-s">${esc(fmtDay(a.date))} · ${esc(fmt1(mi))} mi${sec>0&&mi>0&&a.type!=='bike'?` · ${fmtPace(sec/mi)} a mile`:''}</span></span><span class="row-chev">${ICON('chev',16)}</span></button>`;}).join('')}</div>`;
    return;
  }
  el.innerHTML=rv.items.length?`<div class="fine" id="rv-hint">Tap a line to see which run it was.</div>`:'';
}
// The entry on the Running page.
RUN_SECTIONS.push(()=>{
  const n=(S.activities||[]).filter(a=>a.rt).length;
  return`<div class="sec-h">Routes</div><div class="list"><button class="row row-tap" id="run-routes" onclick="showRoutes()"><span class="row-ic tone-info">${ICON('run',17)}</span><span class="row-main"><span class="row-t">All your routes from one start</span><span class="row-s">${n?`${n} route${n===1?'':'s'}, drawn together`:'Import your Strava archive to see them'}</span></span><span class="row-chev">${ICON('chev',16)}</span></button></div>`;
});
