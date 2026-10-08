// ═══════════════════════════════════════════════════
// TRACKS — from a GPS file to a stored route and its numbers
// ═══════════════════════════════════════════════════
// A track is what a file holds: a position about once a second, with a time and often an
// elevation and a heart rate. It becomes a route in four steps, all on the device:
//   1. read    GPX, TCX or FIT into plain arrays;
//   2. clean   drop positions that cannot be real (a speed no one does) and tell moving from
//              standing, so a wait at a crossing is not part of the pace;
//   3. measure splits, best efforts, climb and heart rate, from every point;
//   4. thin    keep only the points that hold the shape, plus one at least every 20 seconds so
//              pace and heart rate inside a long straight are not lost. That is what is stored.
const RUN_DISTS=[
  {id:'m1',label:'1 mile',short:'Mile',m:MILE_M},
  {id:'m2',label:'2 miles',short:'2 mi',m:2*MILE_M},
  {id:'k5',label:'5K',short:'5K',m:5000},
  {id:'k10',label:'10K',short:'10K',m:10000},
  {id:'hm',label:'Half marathon',short:'Half',m:21097.5},
];
// A run within half a percent of a distance counts as that distance: 3.1 miles is 11 m short of 5K.
const RUN_DIST_SLACK=0.995;
// Faster than this between two fixes is a GPS error, not movement (metres a second).
const TRACK_VMAX={run:12.5,ruck:7,walk:7,hike:7,bike:30,swim:4,other:20};
// Slower than this over ten seconds is standing still.
const TRACK_VMIN={run:0.8,ruck:0.4,walk:0.4,hike:0.3,bike:1.2,swim:0.15,other:0.3};
const TRACK_THIN_M=4;     // Douglas–Peucker tolerance
const TRACK_THIN_SEC=20;  // and never more than this between kept points

function _hav(a1,o1,a2,o2){
  const R=6371008.8,k=Math.PI/180;
  const h=Math.sin((a2-a1)*k/2)**2+Math.cos(a1*k)*Math.cos(a2*k)*Math.sin((o2-o1)*k/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
function _trkNew(){return{lat:[],lon:[],ts:[],ele:[],hr:[],dist:[],at:null,sport:'',name:'',session:null};}
function _xmlText(s){return String(s||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").trim();}

// ─── 1. Read ───
function trackFromGpx(text){
  text=String(text||'');const tr=_trkNew();
  const trk=(text.match(/<trk[\s>][\s\S]*<\/trk>/i)||[text])[0];
  tr.name=_xmlText((trk.match(/<name>([^<]{1,200})<\/name>/i)||[])[1]);
  tr.sport=_xmlText((trk.match(/<type>([^<]{1,60})<\/type>/i)||[])[1]);
  const re=/<trkpt\b([^>]*?)\/>|<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/gi;let m;
  while((m=re.exec(trk))){
    const attrs=m[1]||m[2]||'',inner=m[3]||'';
    const la=/\blat\s*=\s*["']([-\d.eE]+)["']/i.exec(attrs),lo=/\blon\s*=\s*["']([-\d.eE]+)["']/i.exec(attrs);if(!la||!lo)continue;
    const tm=/<time>([^<]+)<\/time>/i.exec(inner),el=/<ele>([^<]+)<\/ele>/i.exec(inner),hr=/<(?:[\w.-]+:)?hr>\s*(\d+)\s*<\//i.exec(inner);
    tr.lat.push(+la[1]);tr.lon.push(+lo[1]);tr.ts.push(tm?Date.parse(tm[1].trim())/1000:NaN);
    tr.ele.push(el?parseFloat(el[1]):NaN);tr.hr.push(hr?+hr[1]:NaN);tr.dist.push(NaN);
  }
  return tr;
}
function trackFromTcx(text){
  text=String(text||'');const tr=_trkNew();
  tr.sport=(text.match(/<Activity\s+Sport="([^"]+)"/i)||[])[1]||'';
  tr.name=_xmlText((text.match(/<Notes>([^<]{1,120})<\/Notes>/)||[])[1]);
  const id=(text.match(/<Id>([^<]+)<\/Id>/)||[])[1];if(id&&isFinite(Date.parse(id)))tr.at=Date.parse(id);
  const one=(s,tag)=>{const m=new RegExp('<'+tag+'>\\s*([^<]+?)\\s*</'+tag+'>').exec(s);return m?m[1]:null;};
  const re=/<Trackpoint>([\s\S]*?)<\/Trackpoint>/g;let m;
  while((m=re.exec(text))){
    const s=m[1];const la=one(s,'LatitudeDegrees'),lo=one(s,'LongitudeDegrees');if(la==null||lo==null)continue;
    const tm=one(s,'Time'),el=one(s,'AltitudeMeters'),di=one(s,'DistanceMeters');
    const hr=/<HeartRateBpm[^>]*>\s*<Value>\s*(\d+)/.exec(s);
    tr.lat.push(+la);tr.lon.push(+lo);tr.ts.push(tm?Date.parse(tm)/1000:NaN);
    tr.ele.push(el!=null?parseFloat(el):NaN);tr.hr.push(hr?+hr[1]:NaN);tr.dist.push(di!=null?parseFloat(di):NaN);
  }
  return tr;
}
function trackFromFit(bytes){
  const f=fitDecode(bytes);const tr=_trkNew();
  tr.lat=f.lat;tr.lon=f.lon;tr.ts=f.ts;tr.ele=f.ele;tr.hr=f.hr;tr.dist=f.dist;
  tr.session=f.session;
  if(f.session){tr.sport=f.session.sport;if(f.session.start)tr.at=f.session.start;}
  return tr;
}
// Which reader a file name calls for: 'gpx' | 'tcx' | 'fit' | null, and whether it is gzipped.
function trackKind(name){
  const m=/\.(gpx|tcx|fit)(\.gz)?$/i.exec(String(name||''));
  return m?{kind:m[1].toLowerCase(),gz:!!m[2]}:null;
}
function trackParse(kind,bytes){
  if(kind==='fit')return trackFromFit(bytes);
  const text=new TextDecoder().decode(bytes);
  return kind==='tcx'||/<TrainingCenterDatabase/i.test(text)?trackFromTcx(text):trackFromGpx(text);
}

// ─── 2. Clean ───
// → {n,lat,lon,t,d,ele,hr,el,at} with t in MOVING seconds and d in metres, or null when there
// is nothing usable (fewer than two real positions).
function trackClean(raw,type){
  const N=raw.lat.length;const vmax=TRACK_VMAX[type]||TRACK_VMAX.other,vmin=TRACK_VMIN[type]||TRACK_VMIN.other;
  const okPos=i=>{const a=raw.lat[i],o=raw.lon[i];return isFinite(a)&&isFinite(o)&&Math.abs(a)<=90&&Math.abs(o)<=180&&!(a===0&&o===0);};
  let timed=0,pos=0;for(let i=0;i<N;i++)if(okPos(i)){pos++;if(isFinite(raw.ts[i]))timed++;}
  if(pos<2)return null;
  const hasT=timed>=pos*0.9;
  // Spikes. A fix that would need an impossible speed from the last good one is dropped. Five in
  // a row means the last good one was the bad one, or the watch was paused and carried somewhere
  // else: the line starts again from there, and that hop counts for no distance and no time.
  const keep=[];const jump=new Set();let last=-1,rej=0,firstRej=-1;
  for(let i=0;i<N;i++){
    if(!okPos(i)||(hasT&&!isFinite(raw.ts[i])))continue;
    if(last<0){keep.push(i);last=i;continue;}
    if(hasT){
      const dt=raw.ts[i]-raw.ts[last];if(!(dt>0))continue;
      if(_hav(raw.lat[last],raw.lon[last],raw.lat[i],raw.lon[i])/dt>vmax){
        if(!rej)firstRej=i;
        if(++rej>=5){
          if(keep.length<5)keep.length=0;else jump.add(firstRej);
          i=firstRej;keep.push(i);last=i;rej=0;
        }
        continue;
      }
    }
    rej=0;keep.push(i);last=i;
  }
  const n=keep.length;if(n<2)return null;
  const lat=keep.map(i=>raw.lat[i]),lon=keep.map(i=>raw.lon[i]);
  const ts=hasT?keep.map(i=>raw.ts[i]):keep.map((_,j)=>j);
  // The watch's own running distance, when nearly every point has one and it never goes backwards.
  let dev=null;
  {let have=0,mono=true,prev=-Infinity;keep.forEach(i=>{const v=raw.dist[i];if(isFinite(v)){have++;if(v<prev-1)mono=false;prev=v;}});
    if(have>=n*0.9&&mono){dev=new Array(n);let cur=NaN;for(let j=0;j<n;j++){const v=raw.dist[keep[j]];if(isFinite(v))cur=v;dev[j]=cur;}
      let f=dev.find(isFinite);if(f==null)dev=null;else for(let j=0;j<n;j++)dev[j]=(isFinite(dev[j])?dev[j]:f)-f;}}
  // Moving or standing, hop by hop: how far the track got over the ten seconds around the hop.
  // Distance from positions alone: a fix wanders a metre or so each second, and adding up every
  // wobble makes a run longer than it was. Where the track is dense (a fix every second or two)
  // the hops are measured between positions averaged over five fixes. The line that is kept and
  // drawn is still the recorded one.
  let la=lat,lo=lon;
  if(!dev&&hasT&&n>=8&&(ts[n-1]-ts[0])/(n-1)<=2.5){
    la=new Array(n);lo=new Array(n);
    for(let j=0;j<n;j++){
      const h=Math.min(2,j,n-1-j); // the same number of fixes either side, so the ends stay where they were recorded
      let sa=0,so=0,c=0;for(let q=j-h;q<=j+h;q++){if(Math.abs(ts[q]-ts[j])<=6&&!jump.has(keep[q])){sa+=lat[q];so+=lon[q];c++;}}
      la[j]=c?sa/c:lat[j];lo[j]=c?so/c:lon[j];}
  }
  // The window grows five seconds each way but never across a long gap (a pause), so the second
  // either side of a stop still counts as running.
  const t=new Array(n),d=new Array(n);t[0]=0;d[0]=0;
  for(let j=1;j<n;j++){
    const dt=hasT?ts[j]-ts[j-1]:1;const hop=_hav(la[j-1],lo[j-1],la[j],lo[j]);
    let moving=true;
    if(jump.has(keep[j]))moving=false;
    else if(hasT){
      let a=j-1;while(a>0&&ts[j-1]-ts[a]<5&&ts[a]-ts[a-1]<=10&&!jump.has(keep[a]))a--;
      let b=j;while(b<n-1&&ts[b]-ts[j]<5&&ts[b+1]-ts[b]<=10&&!jump.has(keep[b+1]))b++;
      const span=ts[b]-ts[a];
      if(span>0&&_hav(lat[a],lon[a],lat[b],lon[b])/span<vmin)moving=false;
    }
    t[j]=t[j-1]+(moving&&hasT?dt:0);
    d[j]=dev?dev[j]:d[j-1]+(moving?hop:0);
  }
  const fill=arr=>{ // carry the last reading across gaps; null when the file mostly had none
    let have=0;keep.forEach(i=>{if(isFinite(arr[i]))have++;});if(have<n*0.9)return null;
    const out=new Array(n);let cur=NaN;for(let j=0;j<n;j++){const v=arr[keep[j]];if(isFinite(v))cur=v;out[j]=cur;}
    const f=out.find(isFinite);for(let j=0;j<n&&!isFinite(out[j]);j++)out[j]=f;
    return out;
  };
  return{n,lat,lon,t,d,ele:fill(raw.ele),hr:fill(raw.hr),timed:hasT,el:hasT?ts[n-1]-ts[0]:0,at:raw.at||(hasT?ts[0]*1000:null)};
}

// ─── 3. Measure ───
// Seconds into the effort at a given distance along it (straight-line between points).
function _timeAt(tr,dist,hint){
  let i=hint||0;const n=tr.n;
  while(i<n-2&&tr.d[i+1]<dist)i++;
  while(i>0&&tr.d[i]>dist)i--;
  const d0=tr.d[i],d1=tr.d[i+1];
  const f=d1>d0?Math.max(0,Math.min(1,(dist-d0)/(d1-d0))):0;
  return{t:tr.t[i]+f*(tr.t[i+1]-tr.t[i]),i};
}
// The fastest stretch of a given length anywhere in the effort: seconds, or null if it is shorter.
// With time a straight line between points, the best window always starts or ends on a point.
// sm is the smoothed elevation, when the file has one: a stretch that drops more than 1% of its
// length (16 m in a mile) is passed over, the way a downhill course does not count for a record.
// Without that, the fastest mile of a hilly run is whichever one went down the hill.
const BEST_MAX_DROP=0.01;
function trackBest(tr,meters,sm){
  const total=tr.d[tr.n-1];if(!tr.timed)return null;
  if(total<meters)return total>=meters*RUN_DIST_SLACK?tr.t[tr.n-1]:null; // "3.1 miles" is a 5K
  const eleAt=x=>{const i=x.i,j=Math.min(tr.n-1,i+1);const d0=tr.d[i],d1=tr.d[j];const f=d1>d0?Math.max(0,Math.min(1,(x.dist-d0)/(d1-d0))):0;return sm[i]+f*(sm[j]-sm[i]);};
  const fair=(a,b)=>!sm||eleAt(a)-eleAt(b)<=BEST_MAX_DROP*meters;
  let best=Infinity,h=0;
  for(let j=0;j<tr.n;j++){ // windows ending at a point
    if(tr.d[j]<meters)continue;
    const s=_timeAt(tr,tr.d[j]-meters,h);h=s.i;s.dist=tr.d[j]-meters;
    const w=tr.t[j]-s.t;if(w<best&&fair(s,{i:Math.max(0,j-1),dist:tr.d[j]}))best=w;
  }
  h=0;
  for(let i=0;i<tr.n&&tr.d[i]+meters<=total;i++){ // windows starting at a point
    const e=_timeAt(tr,tr.d[i]+meters,h);h=e.i;e.dist=tr.d[i]+meters;
    const w=e.t-tr.t[i];if(w<best&&fair({i,dist:tr.d[i]},e))best=w;
  }
  return isFinite(best)&&best>0?best:null;
}
function trackSplits(tr){
  const total=tr.d[tr.n-1];const sp=[];let prev=0,h=0;
  for(let k=1;k*MILE_M<=total;k++){const x=_timeAt(tr,k*MILE_M,h);h=x.i;sp.push(Math.round((x.t-prev)*10)/10);prev=x.t;}
  const rem=total-sp.length*MILE_M;const left=Math.round((tr.t[tr.n-1]-prev)*10)/10;
  if(rem>=MILE_M*RUN_DIST_SLACK){sp.push(left);return{sp,lp:null};} // a "two-mile" run two metres short still has two miles
  return{sp,lp:rem>=80?[Math.round(rem),left]:null};
}
// Elevation averaged over the 50 m either side, so a jittery reading does not count as a hill.
function trackSmoothEle(tr,half){
  half=half||50;const n=tr.n,out=new Array(n);let a=0,b=0,sum=0;
  for(let i=0;i<n;i++){
    while(b<n&&tr.d[b]<=tr.d[i]+half){sum+=tr.ele[b];b++;}
    while(tr.d[a]<tr.d[i]-half){sum-=tr.ele[a];a++;}
    out[i]=sum/(b-a);
  }
  return out;
}
// What a grade costs a runner next to flat ground (Minetti's curve), as a multiplier on distance.
// The lab curve says steep downhills are nearly free; real runners gain much less, so the
// credit for going down stops at 13%.
function gradeCost(g){
  g=Math.max(-0.3,Math.min(0.3,g));
  const c=155.4*g**5-30.4*g**4-43.3*g**3+46.3*g*g+19.5*g+3.6;
  return Math.max(0.87,c/3.6);
}
function trackElevation(tr){
  if(!tr.ele)return{eq:0,up:0,dn:0,ge:0};
  const sm=trackSmoothEle(tr);const n=tr.n;
  let tvRaw=0,tvSm=0,up=0,dn=0,ref=sm[0],maxG=0,ge=0;
  for(let i=1;i<n;i++){tvRaw+=Math.abs(tr.ele[i]-tr.ele[i-1]);tvSm+=Math.abs(sm[i]-sm[i-1]);}
  // Climb: only moves of two metres or more off the last turning point count.
  for(let i=1;i<n;i++){const dv=sm[i]-ref;if(dv>=2){up+=dv;ref=sm[i];}else if(dv<=-2){dn-=dv;ref=sm[i];}}
  // Grade over stretches of about 80 m, for the flat-ground equivalent.
  let j0=0;
  for(let i=1;i<n;i++){
    const run=tr.d[i]-tr.d[j0];
    if(run>=80||i===n-1){if(run>0){const g=(sm[i]-sm[j0])/run;if(Math.abs(g)>maxG)maxG=Math.abs(g);ge+=run*gradeCost(g);}j0=i;}
  }
  const km=Math.max(0.2,tr.d[n-1]/1000);
  const rough=tvRaw>3*tvSm+15*km||maxG>0.4;
  return{eq:rough?1:2,up:Math.round(up),dn:Math.round(dn),ge:rough?0:Math.round(ge)};
}
function trackHeart(tr){
  if(!tr.hr)return{hr:0,hrx:0};
  let sum=0,w=0,mx=0;
  for(let i=1;i<tr.n;i++){const dt=tr.t[i]-tr.t[i-1];if(dt>0){sum+=(tr.hr[i]+tr.hr[i-1])/2*dt;w+=dt;}if(tr.hr[i]>mx)mx=tr.hr[i];}
  if(tr.hr[0]>mx)mx=tr.hr[0];
  return{hr:w?Math.round(sum/w):0,hrx:Math.round(mx)};
}

// ─── 4. Thin ───
// Indices to keep. Douglas–Peucker on a flat local map, then the 20-second rule.
function trackThin(tr,tolM,maxSec){
  const n=tr.n;if(n<=2)return[...Array(n).keys()];
  tolM=tolM||TRACK_THIN_M;maxSec=maxSec||TRACK_THIN_SEC;
  const k=Math.PI/180*6371008.8,cos=Math.cos(tr.lat[0]*Math.PI/180);
  const x=tr.lon.map(o=>(o-tr.lon[0])*k*cos),y=tr.lat.map(a=>(a-tr.lat[0])*k);
  const on=new Uint8Array(n);on[0]=on[n-1]=1;
  const stack=[[0,n-1]];const tol2=tolM*tolM;
  while(stack.length){
    const[a,b]=stack.pop();if(b-a<2)continue;
    const dx=x[b]-x[a],dy=y[b]-y[a],len2=dx*dx+dy*dy;let far=-1,fd=tol2;
    for(let i=a+1;i<b;i++){
      let px=x[i]-x[a],py=y[i]-y[a],dd;
      if(len2===0)dd=px*px+py*py;
      else{const u=Math.max(0,Math.min(1,(px*dx+py*dy)/len2));px-=u*dx;py-=u*dy;dd=px*px+py*py;}
      if(dd>fd){fd=dd;far=i;}
    }
    if(far>0){on[far]=1;stack.push([a,far],[far,b]);}
  }
  let lastT=tr.t[0];
  for(let i=1;i<n;i++){
    if(on[i]){lastT=tr.t[i];continue;}
    if(tr.t[i+1]-lastT>maxSec){on[i]=1;lastT=tr.t[i];}
  }
  const out=[];for(let i=0;i<n;i++)if(on[i])out.push(i);
  return out;
}

// ─── A file's track → what is stored ───
// type is the app's activity type; meters is the activity's own distance when it is known (the
// track is scaled to it when they agree within 8%, so splits add up to the distance shown).
// → {rec, sum, sec, meters} or null when the file has no usable positions.
function routeFromTrack(raw,type,meters){
  const tr=trackClean(raw,type);if(!tr)return null;
  let total=tr.d[tr.n-1];if(!(total>=50))return null;
  if(meters>0&&Math.abs(meters-total)<=meters*0.08&&meters!==total){const f=meters/total;for(let i=0;i<tr.n;i++)tr.d[i]*=f;total=meters;}
  const{sp,lp}=trackSplits(tr);const el=trackElevation(tr);const hr=trackHeart(tr);
  const be={};
  const sm=tr.ele?trackSmoothEle(tr):null;
  if(type==='run'||type==='ruck'||type==='walk'||type==='hike')RUN_DISTS.forEach(d=>{const s=trackBest(tr,d.m,sm);if(s)be[d.id]=Math.round(s*10)/10;});
  const idx=trackThin(tr);
  const pick=arr=>arr?idx.map(i=>arr[i]):null;
  const enc=routeEncode({lat:pick(tr.lat),lon:pick(tr.lon),t:pick(tr.t),d:pick(tr.d),ele:pick(tr.ele),hr:pick(tr.hr)});
  const sec=tr.timed?Math.round(tr.t[tr.n-1]*10)/10:0;
  const rec={v:1,at:tr.at||0,n:enc.n,f:enc.f,p:enc.p,sec,m:Math.round(total*10)/10,el:Math.round(tr.el),sp:tr.timed?sp:[],lp:tr.timed?lp:null,
    up:el.up,dn:el.dn,eq:el.eq,ge:el.ge,hr:hr.hr,hrx:hr.hrx};
  const sum=cleanRouteSummary({n:enc.n,be,up:el.eq===2?el.up:0,hr:hr.hr,hrx:hr.hrx});
  return{rec,sum,sec,meters:total,at:tr.at};
}

// ─── Reading a stored route back ───
// Position at a distance along a decoded route: [lat, lon].
function routePointAt(rt,dist){
  const x=_timeAt(rt,dist,0);const i=x.i;const d0=rt.d[i],d1=rt.d[Math.min(rt.n-1,i+1)];
  const f=d1>d0?Math.max(0,Math.min(1,(dist-d0)/(d1-d0))):0;const j=Math.min(rt.n-1,i+1);
  return[rt.lat[i]+f*(rt.lat[j]-rt.lat[i]),rt.lon[i]+f*(rt.lon[j]-rt.lon[i])];
}
// The same route: starts within 150 m, within 5% of the distance, and the two lines stay close
// all the way (on average within 50 m, or 2% of the length on a long one: GPS never measures the
// same road the same twice). The lines are compared two ways and either will do: point for point
// at the same distance from the start, so running a little past the usual finish does not break
// the match; and at the same share of the way round, so a run made longer by waiting at lights
// still lines up. A loop run the other way round is a different route: its hills come in a
// different order.
function sameRoute(a,b){
  const la=a.d[a.n-1],lb=b.d[b.n-1];
  if(!(la>0&&lb>0)||Math.abs(la-lb)>0.05*Math.max(la,lb))return false;
  if(_hav(a.lat[0],a.lon[0],b.lat[0],b.lon[0])>150)return false;
  const len=Math.min(la,lb),K=40;let abs=0,rel=0;
  for(let i=0;i<K;i++){
    const f=i/(K-1);
    const p=routePointAt(a,len*f),q=routePointAt(b,len*f);abs+=_hav(p[0],p[1],q[0],q[1]);
    const u=routePointAt(a,la*f),v=routePointAt(b,lb*f);rel+=_hav(u[0],u[1],v[0],v[1]);
  }
  return Math.min(abs,rel)/K<=Math.max(50,0.02*len);
}
// Seconds spent in each of five heart-rate zones (under 60% of max, then 10% steps).
function routeZones(rt,maxHr){
  const z=[0,0,0,0,0];if(!rt.hr||!(maxHr>0))return z;
  for(let i=1;i<rt.n;i++){
    const dt=rt.t[i]-rt.t[i-1];if(!(dt>0))continue;
    const p=(rt.hr[i]+rt.hr[i-1])/2/maxHr;
    z[p<0.6?0:p<0.7?1:p<0.8?2:p<0.9?3:4]+=dt;
  }
  return z;
}
