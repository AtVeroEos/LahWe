// ═══════════════════════════════════════════════════
// ROUTES — GPS tracks, kept outside the main state
// ═══════════════════════════════════════════════════
// A route is the line an activity followed: where it went, and how far and how long into the
// effort each point was. Routes are large next to everything else the app keeps, so they are NOT
// part of S. Each one is a record in the device database under "route:<activity id>", and the
// activity in S carries only a small summary (a.rt: best efforts, climb, heart rate). No coordinate
// is ever in S, so none can reach a backup of S alone, an undo snapshot, or the coach.
//
// A record:  {v:1, at, n, f, p, sec, m, el, sp, lp, up, dn, eq, ge, hr, hrx}
//   at   start, ms            n   points kept          f   1 = has elevation, 2 = has heart rate
//   p    the points, packed (see routeEncode)
//   sec  moving seconds       m   metres               el  elapsed seconds
//   sp   seconds for each full mile; lp [metres, seconds] of the part-mile at the end
//   up/dn climb and descent in metres; eq 0 none · 1 too rough to use · 2 good
//   ge   metres this would have been on the flat (for grade-adjusted pace), when eq is 2
//   hr / hrx  average and highest heart rate
// The numbers come from the full track at import; the points are thinned for storage.
const ROUTE_KEY='route:';
const ROUTE_ABC='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const ROUTE_IDX=(()=>{const m={};for(let i=0;i<64;i++)m[ROUTE_ABC[i]]=i;return m;})();
const ROUTE_MAX_POINTS=20000;
const ROUTE_MAX_CHARS=400000;
const MILE_M=1609.344;

// ─── Packing ───
// Every point is five or six whole numbers: latitude and longitude in 1e-5 degrees (about a
// metre), moving seconds, distance in tenths of a metre, then elevation in tenths of a metre and
// heart rate when the file had them. Each is stored as the change from the point before, which is
// small, written five bits to a character. A 5 km run is about 2 KB.
function _rtPut(out,v){
  let u=v<0?-v*2-1:v*2;
  do{const c=u%32;u=Math.floor(u/32);out.push(ROUTE_ABC[c+(u>0?32:0)]);}while(u>0);
}
// tr: {lat,lon,t,d,ele,hr} arrays of the same length (ele and hr may be null).
function routeEncode(tr){
  const n=tr.lat.length;const out=[];
  const hasE=!!tr.ele,hasH=!!tr.hr;
  let a=0,o=0,t=0,d=0,e=0,h=0;
  for(let i=0;i<n;i++){
    const qa=Math.round(tr.lat[i]*1e5),qo=Math.round(tr.lon[i]*1e5),qt=Math.round(tr.t[i]),qd=Math.round(tr.d[i]*10);
    _rtPut(out,qa-a);_rtPut(out,qo-o);_rtPut(out,qt-t);_rtPut(out,qd-d);a=qa;o=qo;t=qt;d=qd;
    if(hasE){const qe=Math.round((tr.ele[i]||0)*10);_rtPut(out,qe-e);e=qe;}
    if(hasH){const qh=Math.round(tr.hr[i]||0);_rtPut(out,qh-h);h=qh;}
  }
  return{n,f:(hasE?1:0)|(hasH?2:0),p:out.join('')};
}
// → {n,lat,lon,t,d,ele,hr} or null when the record cannot be read.
function routeDecode(rec){
  if(!isObj(rec)||rec.v!==1||typeof rec.p!=='string')return null;
  const s=rec.p;const hasE=!!(rec.f&1),hasH=!!(rec.f&2);const per=4+(hasE?1:0)+(hasH?1:0);
  const vals=[];let v=0,mult=1;
  for(let i=0;i<s.length;i++){
    const c=ROUTE_IDX[s[i]];if(c==null)return null;
    v+=(c&31)*mult;
    if(c&32){mult*=32;continue;}
    vals.push(v%2?-(v+1)/2:v/2);v=0;mult=1;
  }
  if(mult!==1||vals.length%per)return null;
  const n=vals.length/per;if(!n||n>ROUTE_MAX_POINTS)return null;
  const out={n,lat:new Array(n),lon:new Array(n),t:new Array(n),d:new Array(n),ele:hasE?new Array(n):null,hr:hasH?new Array(n):null};
  let a=0,o=0,t=0,d=0,e=0,h=0,k=0;
  for(let i=0;i<n;i++){
    a+=vals[k++];o+=vals[k++];t+=vals[k++];d+=vals[k++];
    out.lat[i]=a/1e5;out.lon[i]=o/1e5;out.t[i]=t;out.d[i]=d/10;
    if(hasE){e+=vals[k++];out.ele[i]=e/10;}
    if(hasH){h+=vals[k++];out.hr[i]=h;}
  }
  return out;
}
// A record from a backup file is someone else's data until proven otherwise: every field is
// rebuilt with the type it must have, and anything that does not decode is dropped.
function cleanRouteRec(r){
  if(!isObj(r)||r.v!==1||typeof r.p!=='string'||r.p.length>ROUTE_MAX_CHARS||!/^[A-Za-z0-9_-]+$/.test(r.p))return null;
  const num=(v,max)=>{const x=Number(v);return isFinite(x)&&x>=0?Math.min(x,max):0;};
  const out={v:1,at:num(r.at,4e12),n:0,f:(parseInt(r.f)||0)&3,p:r.p,sec:num(r.sec,1e7),m:num(r.m,1e7),el:num(r.el,1e7),
    sp:(Array.isArray(r.sp)?r.sp:[]).slice(0,400).map(x=>num(x,1e6)),lp:null,up:num(r.up,1e5),dn:num(r.dn,1e5),eq:[0,1,2].includes(r.eq)?r.eq:0,ge:num(r.ge,1e7),hr:num(r.hr,260),hrx:num(r.hrx,260)};
  if(Array.isArray(r.lp)&&r.lp.length===2)out.lp=[num(r.lp[0],MILE_M),num(r.lp[1],1e6)];
  const d=routeDecode(out);if(!d)return null;
  out.n=d.n;
  return out;
}

// ─── The store ───
// mem holds every record read or written this session. Where there is no device database (some
// private windows), mem is the only copy and routes last until the app is closed.
const Routes={
  mem:new Map(),all_:false,
  durable(){return !!Store.db;},
  async put(id,rec){
    id=String(id);this.mem.set(id,rec);
    return Store.db?Store.idbSet(ROUTE_KEY+id,rec):true;
  },
  async get(id){
    id=String(id);
    if(this.mem.has(id))return this.mem.get(id);
    if(!Store.db||this.all_)return null;
    const rec=await Store.idbGet(ROUTE_KEY+id);
    if(isObj(rec)&&rec.v===1){this.mem.set(id,rec);return rec;}
    return null;
  },
  async del(ids){
    ids=(Array.isArray(ids)?ids:[ids]).map(String);
    ids.forEach(id=>this.mem.delete(id));
    if(Store.db&&ids.length)await Store.idbDel(ids.map(id=>ROUTE_KEY+id));
  },
  // Every route on the device, as a Map of id → record.
  async all(){
    if(Store.db&&!this.all_){
      const rows=await Store.idbAll(ROUTE_KEY);
      rows.forEach(r=>{const id=String(r.key).slice(ROUTE_KEY.length);if(isObj(r.val)&&r.val.v===1&&!this.mem.has(id))this.mem.set(id,r.val);});
      this.all_=true;
    }
    return this.mem;
  },
  async clear(){
    const ids=[...(await this.all()).keys()];
    await this.del(ids);this.all_=false;
  },
};
// Ids something in S still points at: activities, and marked stretches (which keep their own copy).
function routeIdsInUse(s){
  s=s||S;const ids=new Set((s.activities||[]).map(a=>String(a.id)));
  (Array.isArray(s.segments)?s.segments:[]).forEach(g=>{if(g&&g.id)ids.add('seg-'+g.id);});
  return ids;
}
// Routes whose activity is gone are removed. This runs at launch rather than at the moment of
// deleting, so that an Undo (of an import, of the coach's delete) still finds the route. While an
// "Undo last restore" is on offer nothing is removed: the earlier data may come back.
async function routesSweep(){
  try{
    if(!Store.ready||hasUndoSnapshot())return 0;
    const keep=routeIdsInUse();const all=await Routes.all();
    const gone=[...all.keys()].filter(id=>!keep.has(id));
    if(gone.length)await Routes.del(gone);
    return gone.length;
  }catch(e){logError(e,'routes');return 0;}
}
// The small summary an activity carries in S. Nothing here says where the activity was.
function cleanRouteSummary(v){
  if(!isObj(v))return null;
  const num=(x,max)=>{x=Number(x);return isFinite(x)&&x>0?Math.min(x,max):0;};
  const out={n:Math.round(num(v.n,ROUTE_MAX_POINTS))};
  if(isObj(v.be)){const be={};RUN_DISTS.forEach(d=>{const s=num(v.be[d.id],1e6);if(s)be[d.id]=Math.round(s*10)/10;});if(Object.keys(be).length)out.be=be;}
  const up=num(v.up,1e5);if(up)out.up=Math.round(up);
  const hr=num(v.hr,260);if(hr)out.hr=Math.round(hr);
  const hrx=num(v.hrx,260);if(hrx)out.hrx=Math.round(hrx);
  return out;
}
// What normalizeState does to one activity's import and route fields.
function cleanActivityExtras(a){
  if(a.rt!=null){const rt=cleanRouteSummary(a.rt);if(rt)a.rt=rt;else delete a.rt;}
  if(a.sec!=null){const s=Number(a.sec);if(isFinite(s)&&s>0&&s<1e7)a.sec=Math.round(s*10)/10;else delete a.sec;}
  if(a.gear!=null){const g=String(a.gear).trim().slice(0,80);if(g)a.gear=g;else delete a.gear;}
  return a;
}
// Seconds an activity took: to the second when it was imported, from whole minutes otherwise.
function actSec(a){return a&&a.sec>0?a.sec:(parseFloat(a&&a.dur)||0)*60;}

// ─── Backups ───
// Routes travel in the backup file as "_routes": {activity id: record}. A backup made before
// routes existed has no such block and restores exactly as it always did.
async function routesForBackup(){
  const keep=routeIdsInUse();const out={};
  (await Routes.all()).forEach((rec,id)=>{if(keep.has(id))out[id]=rec;});
  return out;
}
// Takes the block out of a parsed backup (so it never becomes part of S) and returns the clean records.
function routesFromBackup(data){
  const raw=isObj(data)?data._routes:null;if(isObj(data))delete data._routes;
  const out=new Map();if(!isObj(raw))return out;
  Object.keys(raw).slice(0,20000).forEach(id=>{const rec=cleanRouteRec(raw[id]);if(rec)out.set(String(id).slice(0,60),rec);});
  return out;
}
async function routesRestore(map){
  for(const[id,rec]of map)await Routes.put(id,rec);
}
