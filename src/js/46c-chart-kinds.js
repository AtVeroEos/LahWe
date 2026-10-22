// ═══════════════════════════════════════════════════
// CHART KINDS — how custom charts (46b) and the fitness-test radar are drawn
// ═══════════════════════════════════════════════════
// Inline SVG on the theme's own variables, like 38-charts.js. One series is the accent; a second
// line is a quiet neutral; a split uses the fixed categorical colours --cs1…--cs5 (the same in every
// accent theme, kept clear of the status colours) with Other in grey. Every chart with more than one
// series has a legend, and every chart has a table of the real numbers in its sheet.

const CCH_W=326;
function cchChart(c,r){
  if(r.kind==='hist')return cchHistChart(r,c);
  if(r.kind==='box')return cchBoxChart(r,c);
  if(r.kind==='radar')return cchRadarChart(r,c);
  if(r.kind==='heat')return cchHeatChart(r,c);
  if(r.kind==='split')return cchSplitChart(r,c);
  if(r.view==='scatter')return cchScatter(r,c);
  if(!cchIsTime(c.by))return cchCatChart(r,c);
  return c.view==='bars'?cchBarChart(r,c):cchLineChart(r,c);
}
function cchAxisFmt(r,c){return r.idx?(v=>String(Math.round(v))):(v=>cchFmt(c.a,v));}

// ─── Lines and bars through time ───
// Two lines on one time axis. a is drawn in the accent colour, b in a quiet neutral, a target dashed.
function cchLineChart(r,c,o){
  o=o||{};
  const A=r.a.filter(x=>x.v!=null),B=r.b?r.b.filter(x=>x.v!=null):[],T=r.tgt?r.tgt.filter(x=>x.v!=null):[];
  if(A.length+B.length<2)return`<div class="ch-empty">Not enough in this period to draw. Log more, widen the range, or loosen a filter.</div>`;
  const W=CCH_W,H=o.h||186,top=12,bot=26;const id='ch'+(++_chartSeq);
  const vs=A.concat(B,T).map(x=>x.v);let lo=Math.min(...vs),hi=Math.max(...vs);
  const base=r.idx?100:(c.a.tr||(c.b&&c.b.tr)||lo<0)?0:null;
  if(base!=null){lo=Math.min(lo,base);hi=Math.max(hi,base);}
  const pad=(hi-lo||Math.abs(hi)||1)*0.12;lo-=pad;hi+=pad;
  const ts=r.a.map(x=>x.t);const t0=Math.min(...ts),t1=Math.max(...ts)||t0+1;
  const X=t=>4+(t-t0)/((t1-t0)||1)*(W-10);const Y=v=>top+(1-(v-lo)/(hi-lo))*(H-top-bot);
  const fmt=cchAxisFmt(r,c);
  let g='';
  niceTicks(lo,hi,3).forEach(v=>{const y=chN(Y(v));g+=`<line class="ch-grid" x1="0" y1="${y}" x2="${W}" y2="${y}"/><text class="ch-ax" x="0" y="${chN(y-5)}">${fmt(v)}</text>`;});
  if(base!=null)g+=`<line class="${r.idx?'sp-fit':'xc-base'}" x1="0" y1="${chN(Y(base))}" x2="${W}" y2="${chN(Y(base))}"/>`;
  const poly=(list,cls)=>{const segs=[];let cur=[];list.forEach(x=>{if(x.v==null){if(cur.length)segs.push(cur);cur=[];}else cur.push(chN(X(x.t))+','+chN(Y(x.v)));});if(cur.length)segs.push(cur);
    return segs.map(s=>s.length===1?`<circle class="${cls}-pt" cx="${s[0].split(',')[0]}" cy="${s[0].split(',')[1]}" r="2.6"/>`:`<polyline class="${cls}" points="${s.join(' ')}"/>`).join('');};
  let marks='',hits='';
  const many=r.a.length>45;
  r.a.forEach((x,i)=>{
    const px=X(x.t);
    if(!many&&x.v!=null)marks+=`<circle class="ch-dot" id="${id}-d${i}" cx="${chN(px)}" cy="${chN(Y(x.v))}" r="2.8"/>`;
    const y=r.b&&r.b[i];
    if(!many&&y&&y.v!=null)marks+=`<circle class="xc-dot2" cx="${chN(px)}" cy="${chN(Y(y.v))}" r="2.4"/>`;
    const x0=i?(X(r.a[i-1].t)+px)/2:0,x1=i===r.a.length-1?W:(px+X(r.a[i+1].t))/2;
    hits+=`<rect class="ch-hit" x="${chN(x0)}" y="0" width="${chN(Math.max(1,x1-x0))}" height="${H-bot}" onclick="chartPick(${jsq(id)},${i},${jsq(cchRead(r,c,i))})"/>`;
  });
  const last=r.a.length-1;
  return`<div class="ch-box"><div class="ch-read" id="${id}-read">${esc(cchRead(r,c,last))}</div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cchName(c))}">${g}${r.tgt?poly(r.tgt,'xc-tgt'):''}${r.b?poly(r.b,'xc-line2'):''}${poly(r.a,'ch-line')}${marks}${chAxisDates(t0,t1,W,0,0,H-6)}${hits}</svg>
    ${cchLegend(c,r)}</div>`;
}
// Bars on a time axis, one a bucket or a pair with two series. Bars grow from a baseline: zero, or
// 100 when two lines start at 100, so a week below the start points down instead of being a slightly
// shorter bar among bars that all look the same. A week still under way is drawn hollow.
function cchBarChart(r,c){
  const n=r.a.length;
  const val=p=>p?(p.v!=null?p.v:(p.open&&p.sofar!=null&&!r.idx&&!(c.a.tr)?p.sofar:null)):null;
  const all=r.a.map(val).concat(r.b?r.b.map(val):[],r.tgt?r.tgt.map(x=>x&&x.v):[]).filter(v=>v!=null);
  if(!all.length||!all.some(v=>v!==(r.idx?100:0)))return`<div class="ch-empty">Nothing in this period yet.</div>`;
  const W=CCH_W,H=186,top=12,bot=26;const id='ch'+(++_chartSeq);
  const base=r.idx?100:0;
  let lo=Math.min(base,...all),hi=Math.max(base,...all);const pad=(hi-lo||1)*0.1;
  if(hi>base)hi+=pad;if(lo<base)lo-=pad;
  const Y=v=>top+(1-(v-lo)/((hi-lo)||1))*(H-top-bot);
  const gap=n>40?1:n>20?2:n>10?4:8;const bw=(W-gap*(n-1))/n;const two=!!r.b;const w=two?Math.max(1,bw/2-0.5):bw;const rx=Math.min(3,w/2.2);
  const fmt=cchAxisFmt(r,c);
  let g='',bars='',hits='',tg='';
  niceTicks(lo,hi,3).forEach(v=>{const y=chN(Y(v));g+=`<line class="ch-grid" x1="0" y1="${y}" x2="${W}" y2="${y}"/><text class="ch-ax" x="0" y="${chN(y-5)}">${fmt(v)}</text>`;});
  const yb=Y(base);
  const bar=(p,x,cls,di)=>{
    const v=val(p);if(v==null)return'';
    const hollow=p.v==null&&p.open;
    if(v===base)return`<rect class="sp-nil" x="${chN(x)}" y="${chN(yb-0.75)}" width="${chN(w)}" height="1.5"/>`;
    const y0=Math.min(Y(v),yb),h=Math.max(1.5,Math.abs(Y(v)-yb));
    return`<rect class="${hollow?'sp-hollow':cls}"${di!=null?` id="${id}-d${di}"`:''} x="${chN(x)}" y="${chN(y0)}" width="${chN(w)}" height="${chN(h)}" rx="${chN(rx)}"/>`;
  };
  r.a.forEach((x,i)=>{
    const bx=i*(bw+gap);
    bars+=bar(x,bx,'sp-bar',i);
    if(two)bars+=bar(r.b[i],bx+w+1,'xc-bar2');
    const t=r.tgt&&r.tgt[i];if(t&&t.v!=null)tg+=`<line class="xc-tgtb" x1="${chN(bx-1)}" y1="${chN(Y(t.v))}" x2="${chN(bx+bw+1)}" y2="${chN(Y(t.v))}"/>`;
    hits+=`<rect class="ch-hit" x="${chN(bx-gap/2)}" y="0" width="${chN(bw+gap)}" height="${H-bot}" onclick="chartPick(${jsq(id)},${i},${jsq(cchRead(r,c,i))})"/>`;
  });
  const bl=`<line class="xc-base" x1="0" y1="${chN(yb)}" x2="${W}" y2="${chN(yb)}"/>`;
  return`<div class="ch-box"><div class="ch-read" id="${id}-read">${esc(cchRead(r,c,n-1))}</div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cchName(c))}">${g}${bars}${bl}${tg}${chAxisDates(r.a[0].t,r.a[n-1].t,W,0,0,H-6)}${hits}</svg>${cchLegend(c,r)}</div>`;
}
// By weekday or by a column: a row per category, the bar's length is the value. Reads on a phone
// where 30 exercise names under a chart would not.
function cchCatChart(r,c){
  const rows=r.a.map((x,i)=>({x,y:r.b?r.b[i]:null})).filter(p=>p.x.v!=null||(p.y&&p.y.v!=null));
  if(!rows.length)return`<div class="ch-empty">Nothing in this period yet.</div>`;
  const shown=rows.slice(0,CCH_CAT_ROWS);
  const maxA=Math.max(...rows.map(p=>Math.abs(p.x.v||0)),1e-9),maxB=r.b?Math.max(...rows.map(p=>Math.abs(p.y&&p.y.v||0)),1e-9):1;
  const bar=(v,max,cls)=>`<span class="xc-track"><span class="${cls}" style="width:${v>0?Math.max(2,Math.round(v/max*100)):0}%"></span></span>`;
  return`<div class="ch-box xc-cats">${shown.map(p=>`<div class="xc-cat">
      <span class="xc-cl">${esc(p.x.label)}</span>
      <span class="xc-cb">${bar(p.x.v,maxA,'xc-fill')}${r.b?bar(p.y&&p.y.v,maxB,'xc-fill2'):''}</span>
      <span class="xc-cv">${esc(cchFmt(c.a,p.x.v))}${r.b?`<i>${esc(cchFmt(c.b,p.y&&p.y.v))}</i>`:''}</span></div>`).join('')}
    ${rows.length>shown.length?`<div class="fine" style="margin:6px 0 2px">And ${rows.length-shown.length} more in the table below.</div>`:''}${cchLegend(c,r)}</div>`;
}
// One series against the other: a dot per bucket, with the straight line through them and r.
function cchScatter(r,c){
  const P=r.pairs||[];
  if(P.length<3)return`<div class="ch-empty">A comparison needs at least three ${cchUnitWord(c.by)} that have both numbers. ${P.length?`There ${P.length===1?'is':'are'} ${P.length}.`:''}</div>`;
  const W=CCH_W,H=210,padL=4,top=12,bot=30;const id='ch'+(++_chartSeq);
  const xs=P.map(p=>p.x),ys=P.map(p=>p.y);
  let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const px=(x1-x0||Math.abs(x1)||1)*0.08,py=(y1-y0||Math.abs(y1)||1)*0.12;x0-=px;x1+=px;y0-=py;y1+=py;
  const X=v=>padL+(v-x0)/(x1-x0)*(W-padL-8),Y=v=>top+(1-(v-y0)/(y1-y0))*(H-top-bot);
  let g='';
  niceTicks(y0,y1,3).forEach(v=>{const y=chN(Y(v));g+=`<line class="ch-grid" x1="0" y1="${y}" x2="${W}" y2="${y}"/><text class="ch-ax" x="0" y="${chN(y-5)}">${cchFmt(c.a,v)}</text>`;});
  niceTicks(x0,x1,3).forEach(v=>{const x=chN(X(v));g+=`<text class="ch-ax" x="${x}" y="${H-12}" text-anchor="middle">${cchFmt(c.b,v)}</text>`;});
  if(c.a.tr&&y0<0&&y1>0)g+=`<line class="xc-base" x1="0" y1="${chN(Y(0))}" x2="${W}" y2="${chN(Y(0))}"/>`;
  const f=fitLine(P.map(p=>({t:p.x,v:p.y})));
  const mn=Math.min(...xs),mx=Math.max(...xs);
  const fit=f?`<line class="sp-fit" x1="${chN(X(mn))}" y1="${chN(Y(f.a+(mn-P[0].x)*f.perDay))}" x2="${chN(X(mx))}" y2="${chN(Y(f.a+(mx-P[0].x)*f.perDay))}"/>`:'';
  const dots=P.map((p,i)=>`<circle class="ch-dot" id="${id}-d${i}" cx="${chN(X(p.x))}" cy="${chN(Y(p.y))}" r="4"/><circle class="ch-hit" cx="${chN(X(p.x))}" cy="${chN(Y(p.y))}" r="13" onclick="chartPick(${jsq(id)},${i},${jsq(`${p.label} · ${cchFmt(c.a,p.raw[0])} · ${cchFmt(c.b,p.raw[1])}`)})"/>`).join('');
  return`<div class="ch-box"><div class="ch-read" id="${id}-read">Each dot is a ${cchByLabel(c.by).toLowerCase()}. Tap one.</div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cchName(c))}">${g}${fit}${dots}<text class="ch-ax" x="${W}" y="${H}" text-anchor="end">${esc(cchShort(c.b))} →</text></svg>
    <div class="xc-leg"><span><b class="xc-k1"></b>Up: ${esc(cchSeriesLabel(c.a))}</span><span><b class="xc-k0"></b>Across: ${esc(cchSeriesLabel(c.b))}${r.lag?esc(cchLagText(c,r.lag)):''}</span></div></div>`;
}
function cchLagText(c,n){return`, ${n} ${cchUnitWord(c.by,n)} earlier`;}
function cchLegend(c,r){
  const keys=[];
  if(c.b){keys.push(`<span><b class="xc-k1"></b>${esc(cchSeriesLabel(c.a))}</span>`,`<span><b class="xc-k2"></b>${esc(cchSeriesLabel(c.b))}${r.lag?esc(cchLagText(c,r.lag)):''}</span>`);}
  if(r.tgt)keys.push(`<span><b class="xc-k0"></b>${esc(r.tgtLabel||'Target')}</span>`);
  if(!keys.length)return'';
  return`<div class="xc-leg">${keys.join('')}${r.idx?'<span class="xc-legn">Both start at 100</span>':''}</div>`;
}
function cchRead(r,c,i){
  const x=r.a[i];if(!x)return'';
  const val=(s,p)=>{
    if(p==null)return'–';
    if(p.open&&p.sofar!=null)return`${cchFmt(s,p.sofar)} so far`;
    if(p.v==null)return'–';
    if(r.idx&&s.m!=='strength')return`${cchFmt(s,p.raw)} (${Math.round(p.v)})`;
    if(s.tr==='chg'&&p.lvl!=null)return`${cchFmt(s,p.v)} (${cchFmt(Object.assign({},s,{tr:null}),p.lvl)})`;
    return cchFmt(s,p.v);
  };
  const short=s=>cchShort(s);
  const t=r.tgt&&r.tgt[i]&&r.tgt[i].v!=null?` · ${(r.tgtLabel||'target').toLowerCase()} ${cchFmt(Object.assign({},c.a,{tr:null}),r.tgt[i].v)}`:'';
  if(!r.b)return`${x.label} · ${val(c.a,x)}${t}`;
  const y=r.b[i];const from=r.lag&&y&&y.from?` (${y.from.replace(/^Week of /,'')})`:'';
  return`${x.label} · ${short(c.a)} ${val(c.a,x)} · ${short(c.b)}${from} ${val(c.b,y)}`;
}

// ─── Tiles ───
function cchSpark(r){
  const w=141,h=36;const all=r.a.concat(r.b||[]).filter(x=>x.v!=null&&x.t!=null);
  if(all.length<2)return svgSpark([],{w,h});
  const sc=chScale(all,w,h,3);
  const line=(list,cls)=>{const p=list.filter(x=>x.v!=null).map(x=>chN(sc.X(x.t))+','+chN(sc.Y(x.v)));return p.length>1?`<polyline class="${cls}" points="${p.join(' ')}"/>`:'';};
  return`<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true">${r.b?line(r.b,'xc-line2'):''}${line(r.a,'sp-line')}</svg>`;
}
// The biggest few categories as bars, and a small scatter: a tile is never just a number in space.
function cchCatSpark(r){
  const top=r.a.filter(x=>x.v!=null&&x.v>0).slice(0,8);
  return top.length?svgBars(top.map(x=>({v:x.v}))):'';
}
function cchScatterSpark(r){
  const P=r.pairs||[];if(P.length<2)return'';
  const w=141,h=36;const xs=P.map(p=>p.x),ys=P.map(p=>p.y);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const X=v=>4+(v-x0)/((x1-x0)||1)*(w-8),Y=v=>h-4-(v-y0)/((y1-y0)||1)*(h-8);
  return`<svg class="spark xc-scs" viewBox="0 0 ${w} ${h}" aria-hidden="true">${P.map(p=>`<circle class="sp-dot" cx="${chN(X(p.x))}" cy="${chN(Y(p.y))}" r="2.4"/>`).join('')}</svg>`;
}

// ─── Radar ───
// o: {labels, max, ticks:[values], fmt, shapes:[{v:[…], cls}], band:[{lo,hi}], ring (a value drawn
// dashed, e.g. the 60-point minimum), reads:[text], size:'full'|'tile', label}
function radarSVG(o){
  const n=o.labels.length;const tile=o.size==='tile';
  const W=tile?141:CCH_W,H=tile?76:262;const cx=W/2,cy=tile?H/2:H/2+2,R=tile?35:90;
  const ang=i=>-Math.PI/2+2*Math.PI*i/n;
  const pt=(v,i)=>{const f=Math.max(0,Math.min(1.08,(v||0)/o.max));return[cx+R*f*Math.cos(ang(i)),cy+R*f*Math.sin(ang(i))];};
  const ring=v=>o.labels.map((x,i)=>pt(v,i).map(chN).join(',')).join(' ');
  const id='ch'+(++_chartSeq);
  let g='';
  if(!tile){
    (o.ticks||[]).forEach(v=>{g+=`<polygon class="ch-grid xc-ring" points="${ring(v)}"/>`;});
    o.labels.forEach((x,i)=>{const[x2,y2]=pt(o.max,i);g+=`<line class="ch-grid" x1="${cx}" y1="${cy}" x2="${chN(x2)}" y2="${chN(y2)}"/>`;});
    // Ring values sit halfway between the first two spokes, where no point of a shape can land on them.
    (o.ticks||[]).filter(v=>!o.tickLabels||o.tickLabels.includes(v)).forEach(v=>{const a=-Math.PI/2+Math.PI/n,f=v/o.max*Math.cos(Math.PI/n);const x=cx+R*f*Math.cos(a),y=cy+R*f*Math.sin(a);
      g+=`<text class="ch-ax xc-rtick" x="${chN(x+2)}" y="${chN(y-2)}">${esc(o.fmt(v))}</text>`;});
  }else g+=`<polygon class="xc-ring-t" points="${ring(o.max)}"/>`;
  if(o.band){
    const path=list=>'M'+list.map(([x,y])=>chN(x)+','+chN(y)).join('L')+'Z';
    g+=`<path class="xc-band" fill-rule="evenodd" d="${path(o.band.map((b,i)=>pt(b.hi,i)))}${path(o.band.map((b,i)=>pt(b.lo,i)))}"/>`;
  }
  if(o.ring!=null)g+=`<polygon class="xc-rmin" points="${ring(o.ring)}"/>`;
  (o.shapes||[]).forEach(s=>{if(!s.v.some(v=>v!=null))return;g+=`<polygon class="${s.cls}" points="${s.v.map((v,i)=>pt(v,i).map(chN).join(',')).join(' ')}"/>`;});
  const main=(o.shapes||[]).find(s=>s.main);
  let dots='',labels='',hits='';
  if(main&&!tile)main.v.forEach((v,i)=>{if(v==null)return;const[x,y]=pt(v,i);dots+=`<circle class="ch-dot" id="${id}-d${i}" cx="${chN(x)}" cy="${chN(y)}" r="3.4"/>`;});
  if(!tile)o.labels.forEach((l,i)=>{
    const a=ang(i);const lx=cx+(R+14)*Math.cos(a),ly=cy+(R+14)*Math.sin(a);
    const anchor=Math.cos(a)>0.3?'start':Math.cos(a)<-0.3?'end':'middle';
    const dy=Math.sin(a)>0.5?10:Math.sin(a)<-0.5?-2:4;
    const t=String(l).length>18?String(l).slice(0,17)+'…':String(l);
    labels+=`<text class="ch-ax xc-rlab" x="${chN(lx)}" y="${chN(ly+dy)}" text-anchor="${anchor}">${esc(t)}</text>`;
    const[hx,hy]=pt(o.max*0.72,i);
    if(o.reads)hits+=`<circle class="ch-hit" cx="${chN((hx+lx)/2)}" cy="${chN((hy+ly)/2)}" r="26" onclick="chartPick(${jsq(id)},${i},${jsq(o.reads[i])})"/>`;
  });
  if(tile)return`<svg class="spark xc-rspark" viewBox="0 0 ${W} ${H}" aria-hidden="true">${g}</svg>`;
  return{id,svg:`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'Radar')}">${g}${dots}${labels}${hits}</svg>`};
}
function cchRadarMax(vals){
  const m=Math.max(...vals.filter(v=>v!=null),0)||1;
  const t=niceTicks(0,m,3);const step=t.length>1?t[1]-t[0]:m;
  const max=Math.ceil(m/step-1e-9)*step||m;
  const ticks=[];for(let v=step;v<=max+1e-9;v+=step)ticks.push(Math.round(v*1e6)/1e6);
  return{max,ticks};
}
function cchRadarChart(r,c){
  if(r.bad)return`<div class="ch-empty">A radar needs ${CCH_RADAR_MIN} to ${CCH_RADAR_MAX} ${cchUnitWord(c.by)} with something logged. There ${r.axes.length===1?'is':'are'} ${r.axes.length}. Change the range or the grouping.</div>`;
  if(!r.axes.some(x=>x.v))return`<div class="ch-empty">Nothing in this period yet.</div>`;
  const vals=r.axes.map(x=>x.v);
  const sc=cchRadarMax(vals.concat(r.prev||[]).concat(r.band?r.band.map(b=>b.hi):[]));
  const shapes=[];
  if(r.prev)shapes.push({v:r.prev,cls:'xc-rprev'});
  shapes.push({v:vals,cls:'xc-rshape',main:true});
  const reads=r.axes.map((x,i)=>`${x.label} · ${cchFmt(c.a,x.v)}${r.prev?` · before ${cchFmt(c.a,r.prev[i])}`:''}${r.band?` · useful ${r.band[i].lo}–${r.band[i].hi}`:''}`);
  const s=radarSVG({labels:r.axes.map(x=>x.label),max:sc.max,ticks:sc.ticks,fmt:v=>cchFmt(c.a,v),shapes,band:r.band,reads,label:cchName(c)});
  const keys=[`<span><b class="xc-k1"></b>${esc(r.prev?'This period':cchShort(c.a))}</span>`];
  if(r.prev)keys.push(`<span><b class="xc-k2"></b>Period before</span>`);
  if(r.band)keys.push(`<span><b class="xc-kband"></b>Useful range</span>`);
  return`<div class="ch-box"><div class="ch-read" id="${s.id}-read">Tap a spoke for its number.</div>${s.svg}${r.prev||r.band?`<div class="xc-leg">${keys.join('')}</div>`:''}</div>`;
}
function cchRadarSpark(r){
  if(r.bad)return'';
  const vals=r.axes.map(x=>x.v);const sc=cchRadarMax(vals.concat(r.prev||[]).concat(r.band?r.band.map(b=>b.hi):[]));
  const shapes=(r.prev?[{v:r.prev,cls:'xc-rprev'}]:[]).concat([{v:vals,cls:'xc-rshape'}]);
  return radarSVG({labels:r.axes.map(x=>x.label),max:sc.max,shapes,band:r.band,size:'tile'});
}

// ─── Heat map: a square a day, weekdays down, weeks across ───
// Shades split the days that have something into five even groups (quintiles), so one huge day does
// not wash out the rest. Grey is a day logged as zero; an outline is a day with nothing logged.
function cchHeatLevels(list){
  const nz=list.map(x=>x.v).filter(v=>v!=null&&v>0).sort((a,b)=>a-b);
  // A few distinct values (a workout or not, a 1–5 rating) each get their own shade, the biggest the darkest.
  const uniq=[...new Set(nz)];
  if(uniq.length<=5)return v=>v==null?-1:v<=0?0:5-(uniq.length-1-uniq.indexOf(v));
  const cut=[0.2,0.4,0.6,0.8].map(p=>cchQuant(nz,p));
  return v=>v==null?-1:v<=0?0:1+cut.filter(t=>t!=null&&v>t).length;
}
function cchHeatGrid(list){
  const days=list.filter(x=>x.k<=today());
  if(!days.length)return null;
  const start=weekStartOf(days[0].k);const order=weekOrder();
  const cols=Math.floor(daysBetween(start,days[days.length-1].k)/7)+1;
  return{start,order,cols,days:days.map(x=>Object.assign({col:Math.floor(daysBetween(start,x.k)/7),row:order.indexOf(dayDate(x.k).getDay())},x))};
}
function cchHeatChart(r,c){
  const G=cchHeatGrid(r.a);
  if(!G||!r.a.some(x=>x.v!=null))return`<div class="ch-empty">Nothing in this period yet.</div>`;
  const lv=cchHeatLevels(r.a);const id='ch'+(++_chartSeq);
  const W=CCH_W,lab=18,topL=14;const gap=G.cols>30?1.5:G.cols>14?2:3;
  const cw=(W-lab-gap*(G.cols-1))/G.cols;const ch=Math.max(9,Math.min(cw,24));
  const H=topL+7*ch+6*gap+4;
  let cells='',hits='',ml='';let lastX=-99;
  G.days.forEach((d,i)=>{
    const x=lab+d.col*(cw+gap),y=topL+d.row*(ch+gap);const l=lv(d.v);
    cells+=`<rect class="xc-h${l<0?'n':l}" id="${id}-d${i}" x="${chN(x)}" y="${chN(y)}" width="${chN(cw)}" height="${chN(ch)}" rx="${chN(Math.min(3,cw/3))}"/>`;
    hits+=`<rect class="ch-hit" x="${chN(x-gap/2)}" y="${chN(y-gap/2)}" width="${chN(cw+gap)}" height="${chN(ch+gap)}" onclick="chartPick(${jsq(id)},${i},${jsq(`${QD_DOW[dayDate(d.k).getDay()]} ${fmtDay(d.k)} · ${d.v==null?'nothing logged':cchFmt(c.a,d.v)}`)})"/>`;
    if((d.k.slice(8)==='01'||i===0)&&x-lastX>=26){ml+=`<text class="ch-ax" x="${chN(x)}" y="10">${CAL_MONTHS[+d.k.slice(5,7)-1].slice(0,3)}</text>`;lastX=x;}
  });
  const rl=G.order.map((d,i)=>ch>=12||i%2===0?`<text class="ch-ax" x="0" y="${chN(topL+i*(ch+gap)+ch/2+4)}">${QD_DOW[d].slice(0,1)}</text>`:'').join('');
  const nz=r.a.map(x=>x.v).filter(v=>v!=null&&v>0);
  const lvs=[...new Set(r.a.map(x=>lv(x.v)).filter(l=>l>=0))].sort();
  const key=`<div class="xc-hkey"><span>${lvs.includes(0)?esc(cchFmt(c.a,0)):'Less'}</span>${lvs.map(l=>`<i class="xc-hk${l}"></i>`).join('')}<span>${nz.length?esc(cchFmt(c.a,Math.max(...nz))):'More'}</span><span class="xc-legn"><i class="xc-hkn"></i>Nothing logged</span></div>`;
  return`<div class="ch-box"><div class="ch-read" id="${id}-read">Tap a day for its number.</div>
    <svg class="chart" viewBox="0 0 ${W} ${chN(H)}" role="img" aria-label="${esc(cchName(c))}">${ml}${rl}${cells}${hits}</svg>${key}</div>`;
}
function cchHeatSpark(r){
  const G=cchHeatGrid(r.a);if(!G)return'';
  const w=141,h=36,gap=1;const cols=Math.min(G.cols,18);const first=G.cols-cols;
  const cw=(w-gap*(cols-1))/cols,ch=(h-gap*6)/7;const lv=cchHeatLevels(r.a);
  return`<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true">${G.days.filter(d=>d.col>=first).map(d=>{const l=lv(d.v);
    return`<rect class="xc-h${l<0?'n':l}" x="${chN((d.col-first)*(cw+gap))}" y="${chN(d.row*(ch+gap))}" width="${chN(cw)}" height="${chN(ch)}" rx="1"/>`;}).join('')}</svg>`;
}

// ─── Spread (histogram) ───
function cchHistChart(r,c){
  if(!r.bins||!r.bins.length)return`<div class="ch-empty">A spread needs at least three ${CCH_SRC[c.a.t].many} with a ${cchColLabel(c.a.m).toLowerCase()} in this period.</div>`;
  const W=CCH_W,H=186,top=12,bot=26;const id='ch'+(++_chartSeq);const n=r.bins.length;
  const hi=Math.max(...r.bins.map(b=>b.n))*1.12||1;const Y=v=>top+(1-v/hi)*(H-top-bot);
  const gap=n>24?1:2;const bw=(W-gap*(n-1))/n;const lo=r.bins[0].lo,span=r.bins[n-1].hi-lo;
  const X=v=>(v-lo)/(span||1)*W;
  const many=CCH_SRC[c.a.t].many,one=CCH_SRC[c.a.t].one;
  const lab=b=>r.ints&&r.step===1?cchFmt(c.a,b.lo):`${cchFmt(c.a,b.lo)}–${cchFmt(c.a,b.hi)}`;
  let g='',bars='',hits='';
  niceTicks(0,hi,3).filter(v=>v>0&&Number.isInteger(v)).forEach(v=>{const y=chN(Y(v));g+=`<line class="ch-grid" x1="0" y1="${y}" x2="${W}" y2="${y}"/><text class="ch-ax" x="0" y="${chN(y-5)}">${v}</text>`;});
  r.bins.forEach((b,i)=>{const x=i*(bw+gap);const y=b.n?Math.min(Y(b.n),H-bot-2):H-bot-1.5;
    bars+=`<rect class="${b.n?'sp-bar':'sp-nil'}" id="${id}-d${i}" x="${chN(x)}" y="${chN(y)}" width="${chN(bw)}" height="${chN(H-bot-y)}" rx="${chN(Math.min(3,bw/2.2))}"/>`;
    hits+=`<rect class="ch-hit" x="${chN(x-gap/2)}" y="0" width="${chN(bw+gap)}" height="${H-bot}" onclick="chartPick(${jsq(id)},${i},${jsq(`${lab(b)} · ${b.n} ${b.n===1?one:many}`)})"/>`;});
  const mx=chN(Math.max(1,Math.min(W-1,X(r.med))));
  const med=`<line class="xc-med" x1="${mx}" y1="${top-4}" x2="${mx}" y2="${H-bot}"/><text class="ch-ax xc-medl" x="${mx}" y="${top-6}" text-anchor="${mx>W*0.8?'end':mx<W*0.2?'start':'middle'}">median ${esc(cchFmt(c.a,r.med))}</text>`;
  const ax=r.ints&&r.step===1?[0,Math.floor((n-1)/2),n-1].map(i=>`<text class="ch-ax" x="${chN(i*(bw+gap)+bw/2)}" y="${H-6}" text-anchor="middle">${esc(cchFmt(c.a,r.bins[i].lo))}</text>`).join('')
    :`<text class="ch-ax" x="0" y="${H-6}">${esc(cchFmt(c.a,lo))}</text><text class="ch-ax" x="${W}" y="${H-6}" text-anchor="end">${esc(cchFmt(c.a,r.bins[n-1].hi))}</text>`;
  return`<div class="ch-box"><div class="ch-read" id="${id}-read">${esc(`${r.n} ${many} · middle half ${cchFmt(c.a,r.q1)}–${cchFmt(c.a,r.q3)}`)}</div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cchName(c))}">${g}${bars}${med}${ax}${hits}</svg></div>`;
}

// ─── Box plot, one row a category ───
function cchBoxChart(r,c){
  const B=r.boxes;if(!B.length)return`<div class="ch-empty">Nothing in this period yet.</div>`;
  const W=CCH_W,row=30,top=4,axisH=20,labW=84,valW=58;const id='ch'+(++_chartSeq);
  const H=top+B.length*row+axisH;
  const all=B.flatMap(b=>[b.wlo,b.whi].concat(b.out));let lo=Math.min(...all),hi=Math.max(...all);const pad=(hi-lo||Math.abs(hi)||1)*0.05;lo-=pad;hi+=pad;
  const x0=labW,x1=W-valW;const X=v=>x0+(v-lo)/((hi-lo)||1)*(x1-x0);
  let g='',rows='',hits='';
  niceTicks(lo,hi,3).forEach(v=>{const x=chN(X(v));g+=`<line class="ch-grid" x1="${x}" y1="${top}" x2="${x}" y2="${H-axisH}"/><text class="ch-ax" x="${x}" y="${H-5}" text-anchor="middle">${esc(cchFmt(c.a,v))}</text>`;});
  B.forEach((b,i)=>{
    const cy=top+i*row+row/2;const t=String(b.label).length>12?String(b.label).slice(0,11)+'…':b.label;
    rows+=`<text class="xc-blab" x="0" y="${chN(cy+4)}">${esc(t)}</text>
      <line class="xc-wh" x1="${chN(X(b.wlo))}" y1="${cy}" x2="${chN(X(b.whi))}" y2="${cy}"/>
      <line class="xc-wh" x1="${chN(X(b.wlo))}" y1="${cy-4}" x2="${chN(X(b.wlo))}" y2="${cy+4}"/><line class="xc-wh" x1="${chN(X(b.whi))}" y1="${cy-4}" x2="${chN(X(b.whi))}" y2="${cy+4}"/>
      <rect class="xc-box" id="${id}-d${i}" x="${chN(X(b.q1))}" y="${cy-7}" width="${chN(Math.max(2,X(b.q3)-X(b.q1)))}" height="14" rx="3"/>
      <line class="xc-bmed" x1="${chN(X(b.med))}" y1="${cy-7}" x2="${chN(X(b.med))}" y2="${cy+7}"/>
      ${b.out.map(v=>`<circle class="xc-out" cx="${chN(X(v))}" cy="${cy}" r="2.4"/>`).join('')}
      <text class="xc-bval" x="${W}" y="${chN(cy+4)}" text-anchor="end">${esc(cchFmt(c.a,b.med))}</text>`;
    hits+=`<rect class="ch-hit" x="0" y="${top+i*row}" width="${W}" height="${row}" onclick="chartPick(${jsq(id)},${i},${jsq(`${b.label} · median ${cchFmt(c.a,b.med)} · middle half ${cchFmt(c.a,b.q1)}–${cchFmt(c.a,b.q3)} · ${b.n}`)})"/>`;
  });
  return`<div class="ch-box"><div class="ch-read" id="${id}-read">Tap a row. The figure on the right is the median.</div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cchName(c))}">${g}${rows}${hits}</svg></div>`;
}
function cchBoxSpark(r){return svgBars(r.boxes.slice(0,10).map(b=>({v:Math.max(0,b.med)})));}

// ─── Split: one measure, a line or bar for each of the biggest five ───
function cchSlot(g){return g.slot?String(g.slot):'0';}
function cchSplitMatrix(r){
  return r.groups.map(g=>g.list.map(p=>p.v));
}
function cchSplitChart(r,c){
  const G=r.groups;
  if(!G.length||!G.some(g=>g.list.some(p=>p.v!=null)))return`<div class="ch-empty">Nothing in this period yet.</div>`;
  const W=CCH_W,H=196,top=12,bot=26;const id='ch'+(++_chartSeq);
  const K=r.keys,n=K.length,view=r.view;const M=cchSplitMatrix(r);
  const colTot=K.map((k,i)=>M.reduce((t,row)=>t+(row[i]||0),0));
  const share=view==='share';
  let lo=0,hi;
  if(view==='stack'||view==='area')hi=Math.max(...colTot,0);
  else if(share)hi=100;
  else{const vs=M.flat().filter(v=>v!=null);lo=view==='line'?Math.min(...vs):Math.min(0,...vs);hi=Math.max(...vs,0);}
  const pad=(hi-lo||1)*(share?0:0.1);hi+=pad;if(view==='line')lo-=pad;
  const Y=v=>top+(1-(v-lo)/((hi-lo)||1))*(H-top-bot);
  const gap=n>40?1:n>20?2:n>10?3:6;const bw=(W-gap*(n-1))/n;const cx=i=>i*(bw+gap)+bw/2;
  const fmt=share?(v=>Math.round(v)+'%'):(v=>cchFmt(c.a,v));
  let g='',marks='',hits='';
  niceTicks(lo,hi,3).forEach(v=>{const y=chN(Y(v));g+=`<line class="ch-grid" x1="0" y1="${y}" x2="${W}" y2="${y}"/><text class="ch-ax" x="0" y="${chN(y-5)}">${fmt(v)}</text>`;});
  const rx=w=>chN(Math.min(3,w/2.2));
  if(view==='bars'){
    const k=G.length,w=Math.max(1,(bw-(k-1))/k);
    K.forEach((key,i)=>G.forEach((gr,j)=>{const v=M[j][i];if(v==null)return;const y0=Math.min(Y(v),Y(0)),h=Math.max(1.5,Math.abs(Y(v)-Y(0)));
      marks+=`<rect class="xc-f${cchSlot(gr)}" x="${chN(i*(bw+gap)+j*(w+1))}" y="${chN(y0)}" width="${chN(w)}" height="${chN(h)}" rx="${rx(w)}"/>`;}));
  }else if(view==='stack'||view==='share'){
    K.forEach((key,i)=>{let acc=0;const tot=colTot[i];if(!tot)return;
      G.forEach((gr,j)=>{const v=M[j][i]||0;if(v<=0)return;const a=share?acc/tot*100:acc,b=share?(acc+v)/tot*100:acc+v;acc+=v;
        const y=Y(b),h=Math.max(1,Y(a)-Y(b)-1);
        marks+=`<rect class="xc-f${cchSlot(gr)}" x="${chN(i*(bw+gap))}" y="${chN(y)}" width="${chN(bw)}" height="${chN(h)}" rx="${rx(bw)}"/>`;});});
  }else if(view==='area'){
    const cum=K.map(()=>0);
    G.forEach((gr,j)=>{
      const lower=cum.slice();K.forEach((key,i)=>{cum[i]+=M[j][i]||0;});
      const ok=K.map((key,i)=>colTot[i]>0||M[j][i]!=null);
      const upper=K.map((key,i)=>[cx(i),Y(cum[i])]).filter((p,i)=>ok[i]);
      const low=K.map((key,i)=>[cx(i),Y(lower[i])]).filter((p,i)=>ok[i]).reverse();
      if(upper.length>1)marks+=`<polygon class="xc-f${cchSlot(gr)} xc-area" points="${upper.concat(low).map(p=>p.map(chN).join(',')).join(' ')}"/>`;
    });
  }else{
    G.slice().reverse().forEach(gr=>{const j=G.indexOf(gr);const segs=[];let cur=[];
      K.forEach((key,i)=>{const v=M[j][i];if(v==null){if(cur.length)segs.push(cur);cur=[];}else cur.push(chN(cx(i))+','+chN(Y(v)));});if(cur.length)segs.push(cur);
      marks+=segs.map(s=>s.length===1?`<circle class="xc-f${cchSlot(gr)}" cx="${s[0].split(',')[0]}" cy="${s[0].split(',')[1]}" r="2.6"/>`:`<polyline class="xc-l${cchSlot(gr)}" points="${s.join(' ')}"/>`).join('');});
  }
  K.forEach((key,i)=>{
    const parts=G.map((gr,j)=>{const p=gr.list[i];const v=M[j][i];
      const s=p&&p.open&&p.sofar!=null?`${cchFmt(c.a,p.sofar)} so far`:v==null?null:share&&colTot[i]?`${Math.round(v/colTot[i]*100)}%`:cchFmt(c.a,v);
      return s==null?null:`${gr.name} ${s}`;}).filter(Boolean);
    hits+=`<rect class="ch-hit" x="${chN(i*(bw+gap)-gap/2)}" y="0" width="${chN(bw+gap)}" height="${H-bot}" onclick="chartPick(${jsq(id)},${i},${jsq(`${key.label} · ${parts.join(' · ')||'nothing'}`)})"/>`;
  });
  const ax=cchIsTime(r.by)?chAxisDates(K[0].t,K[n-1].t,W,0,0,H-6)
    :K.map((key,i)=>`<text class="ch-ax" x="${chN(cx(i))}" y="${H-6}" text-anchor="middle">${esc(String(key.label).slice(0,3))}</text>`).join('');
  const leg=`<div class="xc-leg">${G.map(gr=>`<span><b class="xc-key${cchSlot(gr)}"></b>${esc(gr.other?`Other (${gr.other})`:gr.name)}</span>`).join('')}</div>`;
  return`<div class="ch-box"><div class="ch-read" id="${id}-read">Tap a ${cchByLabel(r.by).toLowerCase()} for its numbers.</div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cchName(c))}">${g}${marks}${ax}${hits}</svg>${leg}</div>`;
}
function cchSplitSpark(r){
  const w=141,h=36;const K=r.keys,n=K.length;if(!n)return'';const M=cchSplitMatrix(r);const G=r.groups;
  if(r.view==='line'){
    const vs=M.flat().filter(v=>v!=null);if(vs.length<2)return'';const lo=Math.min(...vs),hi=Math.max(...vs);
    const X=i=>3+i/((n-1)||1)*(w-6),Y=v=>h-3-(v-lo)/((hi-lo)||1)*(h-6);
    return`<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true">${G.map((gr,j)=>{const p=M[j].map((v,i)=>v==null?null:chN(X(i))+','+chN(Y(v))).filter(Boolean);return p.length>1?`<polyline class="xc-l${cchSlot(gr)}" points="${p.join(' ')}"/>`:'';}).join('')}</svg>`;
  }
  const tot=K.map((k,i)=>M.reduce((t,row)=>t+Math.max(0,row[i]||0),0));const max=Math.max(...tot,1e-9);
  const gap=n>26?1:n>12?2:4;const bw=(w-gap*(n-1))/n;
  let out='';K.forEach((k,i)=>{let acc=0;G.forEach((gr,j)=>{const v=Math.max(0,M[j][i]||0);if(!v)return;const y0=h-(acc+v)/max*h,hh=v/max*h;acc+=v;
    out+=`<rect class="xc-f${cchSlot(gr)}" x="${chN(i*(bw+gap))}" y="${chN(y0)}" width="${chN(bw)}" height="${chN(Math.max(0.8,hh-0.6))}"/>`;});});
  return`<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true">${out}</svg>`;
}

// ═══ The fitness test as a radar (a fixed tile on the board) ═══
// Points (0–100) for each of the five events: where you started, where you are, and your goal, on the
// same scale, with the 60-point minimum drawn as a dashed ring. Start is the test-date plan's starting
// results, or without a plan the first saved snapshot.
function aftRadarData(){
  const col=aftColumn();
  const now=AFT_EVENTS.map(e=>aftScore(e.id,(S.aftCurrent||{})[e.id],col));
  const goal=AFT_EVENTS.map(e=>aftScore(e.id,(S.aftGoals||{})[e.id],col));
  let start=null,startLabel='';
  let pc=null;try{pc=S.testPlan?testPlanCalc():null;}catch(e){logError(e,'aft radar plan');}
  if(pc&&pc.events&&pc.events.some(e=>e.from!=null)){
    start=AFT_EVENTS.map(e=>{const p=pc.events.find(x=>x.id===e.id);return p&&p.from!=null?aftScore(e.id,p.from,col):null;});startLabel='Plan start';
  }else{
    const h=(S.aftHistory||[]).slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0)[0];
    if(h&&h.scores){start=AFT_EVENTS.map(e=>aftScore(e.id,h.scores[e.id],col));startLabel='First snapshot, '+fmtDay(h.date);}
  }
  if(start&&start.every((v,i)=>v===now[i]))start=null;
  const sum=l=>l.reduce((t,v)=>t+(v||0),0);
  return{now,goal:goal.some(v=>v!=null)?goal:null,start:start&&start.some(v=>v!=null)?start:null,startLabel,
    n:now.filter(v=>v!=null).length,total:sum(now),goalTotal:sum(goal)};
}
const AFT_SHORT={MDL:'Deadlift',HRP:'Push-ups',SDC:'Sprint-drag-carry',PLK:'Plank','2MR':'2-mile run'};
function aftRadarSVG(d,size){
  const shapes=[];
  if(d.start)shapes.push({v:d.start,cls:'xc-rprev xc-rstart'});
  if(d.goal)shapes.push({v:d.goal,cls:'xc-rgoal'});
  shapes.push({v:d.now,cls:'xc-rshape',main:true});
  const reads=AFT_EVENTS.map((e,i)=>`${e.name} · ${d.now[i]==null?'not entered':d.now[i]+' pts'}${d.goal&&d.goal[i]!=null?` · goal ${d.goal[i]}`:''}${d.start&&d.start[i]!=null?` · start ${d.start[i]}`:''}`);
  return radarSVG({labels:AFT_EVENTS.map(e=>AFT_SHORT[e.id]||e.name),
    max:100,ticks:[20,40,60,80,100],tickLabels:[60,100],fmt:v=>String(v),shapes,ring:60,reads,size,label:'Fitness test events'});
}
function aftRadarTile(){
  const d=aftRadarData();
  if(d.n<3)return{title:'Fitness test events',empty:'Enter at least three event results to see their shape.'};
  const weak=AFT_EVENTS.map((e,i)=>({e,v:d.now[i]})).filter(x=>x.v!=null).sort((a,b)=>a.v-b.v)[0];
  return{title:'Fitness test events',value:String(d.total),unit:d.goal?` of ${d.goalTotal} goal`:' pts',
    sub:weak?`Weakest: ${weak.e.name}`:'',tone:d.now.some(v=>v!=null&&v<60)?'bad':'flat',spark:aftRadarSVG(d,'tile')};
}
function aftRadarDetail(){
  const d=aftRadarData();
  const head={title:'Fitness test events',sub:'Points in each event, out of 100',plain:true,noRange:true};
  if(d.n<3)return Object.assign(head,{body:`<div class="ch-empty">Enter at least three event results to see their shape.</div>`,
    acts:`<button class="btn btp" onclick="closeOv('metric-ov');setTimeout(()=>openTile('aft'),220)">Enter results</button>`});
  const s=aftRadarSVG(d,'full');
  const keys=[`<span><b class="xc-k1"></b>Now</span>`].concat(d.goal?[`<span><b class="xc-kgoal"></b>Goal</span>`]:[]).concat(d.start?[`<span><b class="xc-k2"></b>${esc(d.startLabel)}</span>`]:[]).concat([`<span><b class="xc-k0"></b>60-point minimum</span>`]);
  const raw=(id,v)=>v===''||v==null?'':`<small>${esc(aftFmtRaw(id,v))}</small>`;
  const rows=AFT_EVENTS.map((e,i)=>`<tr><td>${esc(AFT_SHORT[e.id])}</td>${d.start?`<td>${d.start[i]==null?'–':d.start[i]}</td>`:''}<td>${d.now[i]==null?'–':d.now[i]+raw(e.id,(S.aftCurrent||{})[e.id])}</td>${d.goal?`<td>${d.goal[i]==null?'–':d.goal[i]+raw(e.id,(S.aftGoals||{})[e.id])}</td>`:''}</tr>`).join('');
  const st=[{v:d.total,l:'Points now'}].concat(d.goal?[{v:d.goalTotal,l:'Goal'}]:[]).concat(d.start?[{v:(d.total-d.start.reduce((t,v)=>t+(v||0),0)>=0?'+':'−')+Math.abs(d.total-d.start.reduce((t,v)=>t+(v||0),0)),l:'Since '+(d.startLabel==='Plan start'?'plan start':'first snapshot')}]:[]);
  return Object.assign(head,{
    chart:`<div class="ch-box"><div class="ch-read" id="${s.id}-read">Tap an event for its points.</div>${s.svg}<div class="xc-leg">${keys.join('')}</div></div>`,
    stats:st,
    body:`<div class="sec-h">The numbers</div><div class="xc-tbl-wrap"><table class="xc-tbl"><thead><tr><th>Event</th>${d.start?'<th>Start</th>':''}<th>Now</th>${d.goal?'<th>Goal</th>':''}</tr></thead><tbody>${rows}</tbody></table></div>`,
    how:'Every event is scored 0 to 100 on the Army\'s tables for your age and standard, so the spokes share one scale. The dashed ring is the 60 points each event needs. A dent is the event to train.',
    acts:`<button class="btn btp" onclick="closeOv('metric-ov');setTimeout(()=>openTile('aft'),220)">Enter results</button>`});
}
