// ═══════════════════════════════════════════════════
// CHARTS — small vector charts drawn by the app itself
// ═══════════════════════════════════════════════════
// No chart library. Everything is an inline SVG coloured by the theme's own variables, so a
// chart follows light, dark and the accent without being redrawn.
// A point is {t,v}: t is a day number, so the horizontal axis is TIME. Two weigh-ins three
// weeks apart sit three weeks apart, not side by side as "entry 7" and "entry 8".

const DAY0='2020-01-01';
function dayNum(d){return daysBetween(DAY0,typeof d==='number'?dayOf(d):d);}
function dayFromNum(n){return addDays(DAY0,n);}
function chN(v){return Math.round(v*10)/10;}
// Maps a series into a w×h box. o: {t0,t1,lo,hi} fix the ends; invert draws low values at the top
// (a pace, where lower is better, then rises as you improve).
function chScale(pts,w,h,pad,o){
  o=o||{};
  const ts=pts.map(p=>p.t),vs=pts.map(p=>p.v);
  let t0=o.t0!=null?o.t0:Math.min(...ts),t1=o.t1!=null?o.t1:Math.max(...ts);
  let lo=o.lo!=null?o.lo:Math.min(...vs),hi=o.hi!=null?o.hi:Math.max(...vs);
  if(hi===lo){hi+=1;lo-=1;}
  if(t1===t0)t1=t0+1;
  const top=o.top!=null?o.top:pad,bot=o.bot!=null?o.bot:pad;
  return{t0,t1,lo,hi,
    X:t=>pad+(t-t0)/(t1-t0)*(w-2*pad),
    Y:v=>{const f=(v-lo)/(hi-lo);return top+(o.invert?f:1-f)*(h-top-bot);}};
}

// ─── Tile-sized ───
// A line with a dot on the latest point. o.fit: {a,b} values of a trend line at the first and last point.
function svgSpark(pts,o){
  o=o||{};const w=o.w||141,h=o.h||36;const cls='spark'+(o.cls?' '+o.cls:'');
  if(!pts||!pts.length)return`<svg class="${cls}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><line class="sp-fit" x1="3" y1="${h/2}" x2="${w-3}" y2="${h/2}"/></svg>`;
  if(pts.length===1)return`<svg class="${cls}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><line class="sp-fit" x1="3" y1="${h/2}" x2="${w-6}" y2="${h/2}"/><circle class="sp-dot" cx="${w-5}" cy="${h/2}" r="2.4"/></svg>`;
  const sc=chScale(pts,w,h,3,o);
  const line=pts.map(p=>chN(sc.X(p.t))+','+chN(sc.Y(p.v))).join(' ');
  const last=pts[pts.length-1];
  const fit=o.fit?`<line class="sp-fit" x1="${chN(sc.X(pts[0].t))}" y1="${chN(sc.Y(Math.max(sc.lo,Math.min(sc.hi,o.fit.a))))}" x2="${chN(sc.X(last.t))}" y2="${chN(sc.Y(Math.max(sc.lo,Math.min(sc.hi,o.fit.b))))}"/>`:'';
  return`<svg class="${cls}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${fit}<polyline class="sp-line" points="${line}"/><circle class="sp-dot" cx="${chN(sc.X(last.t))}" cy="${chN(sc.Y(last.v))}" r="2.2"/></svg>`;
}
// Bars. vals: [{v, tone:'good'|'warn'|'', hollow}] (v null = nothing recorded).
// o.target draws a line at that value and sizes the box so the line sits at 80% of the height;
// o.plan does the same with a dashed line (a plan, not a limit).
function svgBars(vals,o){
  o=o||{};const w=o.w||141,h=o.h||36;const n=vals.length;if(!n)return svgSpark([],o);
  const gap=n>26?1:n>12?2:n>8?4:6;const bw=(w-gap*(n-1))/n;
  const ref=o.target!=null?o.target:o.plan!=null?o.plan:null;
  const maxV=Math.max(0,...vals.map(x=>+x.v||0));
  const max=Math.max(ref!=null?ref*1.25:0,maxV,1e-9);
  const rx=Math.min(3,bw/2.2);
  let out='';
  vals.forEach((x,i)=>{
    const v=+x.v||0;const bh=v>0?Math.max(2,v/max*h):1.5;const bx=i*(bw+gap);
    const cls=!(v>0)?'sp-nil':x.hollow?'sp-hollow':x.tone==='good'?'sp-good':x.tone==='warn'?'sp-warn':'sp-bar';
    out+=x.hollow&&v>0?`<rect class="${cls}" x="${chN(bx+0.75)}" y="${chN(h-bh+0.75)}" width="${chN(Math.max(1,bw-1.5))}" height="${chN(Math.max(1,bh-1.5))}" rx="${chN(rx)}"/>`
      :`<rect class="${cls}" x="${chN(bx)}" y="${chN(h-bh)}" width="${chN(bw)}" height="${chN(bh)}" rx="${chN(rx)}"/>`;
  });
  if(ref!=null&&ref>0){const y=chN(h-ref/max*h);out+=`<line class="${o.plan!=null&&o.target==null?'sp-fit':'sp-target'}" x1="0" y1="${y}" x2="${w}" y2="${y}"/>`;}
  return`<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true">${out}</svg>`;
}
// A filled track with an optional tick (a pass mark).
function svgMeter(frac,tick,o){
  o=o||{};const w=o.w||141,h=o.h||36;const f=Math.max(0,Math.min(1,frac||0));
  return`<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><rect class="sp-track" x="0" y="${h-16}" width="${w}" height="10" rx="5"/>${f>0?`<rect class="sp-bar" x="0" y="${h-16}" width="${chN(Math.max(10,f*w))}" height="10" rx="5"/>`:''}${tick!=null?`<line class="sp-target" x1="${chN(tick*w)}" y1="${h-22}" x2="${chN(tick*w)}" y2="${h}"/>`:''}</svg>`;
}

// ─── Full width, in a detail sheet ───
// Round numbers for the gridlines: about three of them across lo…hi.
function niceTicks(lo,hi,want){
  want=want||3;const span=hi-lo;if(!(span>0))return[lo];
  const raw=span/want;const mag=Math.pow(10,Math.floor(Math.log10(raw)));
  const step=[1,2,2.5,5,10].map(m=>m*mag).find(s=>span/s<=want+0.5)||10*mag;
  const out=[];for(let v=Math.ceil(lo/step)*step;v<=hi+1e-9;v+=step)out.push(Math.round(v*1e6)/1e6);
  return out;
}
function chAxisDates(t0,t1,W,padL,padR,y){
  const lab=t=>fmtDay(dayFromNum(Math.round(t)));
  if(t1-t0<1)return`<text class="ch-ax" x="${padL}" y="${y}">${lab(t0)}</text>`;
  return`<text class="ch-ax" x="${padL}" y="${y}">${lab(t0)}</text><text class="ch-ax" x="${(W+padL-padR)/2}" y="${y}" text-anchor="middle">${lab((t0+t1)/2)}</text><text class="ch-ax" x="${W-padR}" y="${y}" text-anchor="end">${lab(t1)}</text>`;
}
let _chartSeq=0;
// A line through time. pts: {t,v,read} where read is what tapping the point shows.
// o: {fmt(v) for the gridline labels, invert, fit:{a,b}, empty}
function chartLine(pts,o){
  o=o||{};
  if(!pts||pts.length<2)return`<div class="ch-empty">${o.empty||(pts&&pts.length?'One entry in this period. A second one draws the line.':'Nothing in this period yet.')}</div>`;
  const W=326,H=176,padL=4,padR=6,top=12,bot=26;const id='ch'+(++_chartSeq);
  const vs=pts.map(p=>p.v);let lo=Math.min(...vs),hi=Math.max(...vs);
  if(o.fit){lo=Math.min(lo,o.fit.a,o.fit.b);hi=Math.max(hi,o.fit.a,o.fit.b);}
  const padV=(hi-lo||Math.abs(hi)||1)*0.12;lo-=padV;hi+=padV;
  const sc=chScale(pts,W,H,0,{lo,hi,invert:o.invert,top,bot});
  const X=t=>padL+(t-sc.t0)/(sc.t1-sc.t0)*(W-padL-padR);
  const fmt=o.fmt||(v=>String(Math.round(v*10)/10));
  let g='';
  niceTicks(lo,hi,3).forEach(v=>{const y=chN(sc.Y(v));g+=`<line class="ch-grid" x1="0" y1="${y}" x2="${W}" y2="${y}"/><text class="ch-ax" x="0" y="${chN(y-5)}">${fmt(v)}</text>`;});
  const fit=o.fit?`<line class="sp-fit" x1="${chN(X(pts[0].t))}" y1="${chN(sc.Y(o.fit.a))}" x2="${chN(X(pts[pts.length-1].t))}" y2="${chN(sc.Y(o.fit.b))}"/>`:'';
  const line=pts.map(p=>chN(X(p.t))+','+chN(sc.Y(p.v))).join(' ');
  const dots=pts.length<=45;let marks='',hits='';
  pts.forEach((p,i)=>{
    const x=X(p.t),y=sc.Y(p.v);const lastPt=i===pts.length-1;
    if(dots||lastPt)marks+=`<circle class="${lastPt?'ch-dot ch-last':'ch-dot'}" id="${id}-d${i}" cx="${chN(x)}" cy="${chN(y)}" r="${lastPt?4.2:3}"/>`;
    // The tap area is the strip of the chart nearest this point, full height: a fingertip, not a 6-pixel dot.
    const x0=i?(X(pts[i-1].t)+x)/2:0,x1=lastPt?W:(x+X(pts[i+1].t))/2;
    hits+=`<rect class="ch-hit" x="${chN(x0)}" y="0" width="${chN(Math.max(1,x1-x0))}" height="${H-bot}" onclick="chartPick(${jsq(id)},${i},${jsq(p.read||'')})"/>`;
  });
  return`<div class="ch-box"><div class="ch-read" id="${id}-read">${esc(pts[pts.length-1].read||'')}</div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'Chart')}">${g}${fit}<polyline class="ch-line" points="${line}"/>${marks}${chAxisDates(sc.t0,sc.t1,W,0,0,H-6)}${hits}</svg></div>`;
}
// Bars through time. items: {t (day number of the bar's start), v, tone, hollow, read}. o.target / o.plan as svgBars.
function chartBars(items,o){
  o=o||{};
  if(!items||!items.some(x=>x.v>0))return`<div class="ch-empty">${o.empty||'Nothing in this period yet.'}</div>`;
  const W=326,H=176,top=12,bot=26;const id='ch'+(++_chartSeq);const n=items.length;
  const ref=o.target!=null?o.target:o.plan!=null?o.plan:null;
  const maxV=Math.max(...items.map(x=>+x.v||0),ref||0);const hi=maxV*1.12||1;
  const Y=v=>top+(1-v/hi)*(H-top-bot);
  const fmt=o.fmt||(v=>Math.round(v).toLocaleString());
  const gap=n>40?1:n>20?2:n>10?4:8;const bw=(W-gap*(n-1))/n;const rx=Math.min(4,bw/2.2);
  let g='',bars='',hits='';
  niceTicks(0,hi,3).filter(v=>v>0).forEach(v=>{const y=chN(Y(v));g+=`<line class="ch-grid" x1="0" y1="${y}" x2="${W}" y2="${y}"/><text class="ch-ax" x="0" y="${chN(y-5)}">${fmt(v)}</text>`;});
  items.forEach((x,i)=>{
    const v=+x.v||0;const bx=i*(bw+gap);const y=v>0?Math.min(Y(v),H-bot-2):H-bot-1.5;const bh=H-bot-y;
    const cls=!(v>0)?'sp-nil':x.hollow?'sp-hollow':x.tone==='good'?'sp-good':x.tone==='warn'?'sp-warn':'sp-bar';
    bars+=`<rect class="${cls}" id="${id}-d${i}" x="${chN(bx)}" y="${chN(y)}" width="${chN(bw)}" height="${chN(bh)}" rx="${chN(rx)}"/>`;
    hits+=`<rect class="ch-hit" x="${chN(bx-gap/2)}" y="0" width="${chN(bw+gap)}" height="${H-bot}" onclick="chartPick(${jsq(id)},${i},${jsq(x.read||'')})"/>`;
  });
  const line=ref!=null&&ref>0?`<line class="${o.plan!=null&&o.target==null?'sp-fit':'sp-target'}" x1="0" y1="${chN(Y(ref))}" x2="${W}" y2="${chN(Y(ref))}"/>`:'';
  const last=items[n-1];
  return`<div class="ch-box"><div class="ch-read" id="${id}-read">${esc(o.read!=null?o.read:(last.read||''))}</div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'Chart')}">${g}${bars}${line}${chAxisDates(items[0].t,last.t,W,0,0,H-6)}${hits}</svg></div>`;
}
// Tapping a point or a bar shows its date and value above the chart and marks it.
function chartPick(id,i,read){
  const r=document.getElementById(id+'-read');if(r)r.textContent=read;
  document.querySelectorAll(`[id^="${id}-d"]`).forEach(el=>el.classList.remove('ch-on'));
  const d=document.getElementById(id+'-d'+i);if(d)d.classList.add('ch-on');
}
