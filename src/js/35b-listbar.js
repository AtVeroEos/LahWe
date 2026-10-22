// ═══════════════════════════════════════════════════
// LIST BAR — one way to narrow and order a long list, used everywhere
// ═══════════════════════════════════════════════════
// Foods, History, Records and Lifts each register a list here: an optional search, a row of
// chips (one picked at a time; "All" first) and an optional sort. The bar and the list are
// painted separately, so typing in the search keeps the keyboard up while only the rows change.
// The chip and sort picked are remembered per list (S.listPrefs); a search is not.
//
//   lbDef(id, {search:'placeholder'|()=>placeholder|null|null, chips:()=>[{id,l,n}], sorts:[{id,l}], sort:'default id',
//              body:state=>html, after:()=>void})
//   lbHTML(id) → the bar and the rows, for a screen to put where the list goes.
// A chip with n:0 is not drawn (nothing to show is not an option), and a bar with nothing to
// choose is not drawn at all.

const LB={};
const _lbQ={};
function lbDef(id,def){LB[id]=def;}
function lbState(id){
  const d=LB[id]||{};const p=(isObj(S.listPrefs)&&isObj(S.listPrefs[id]))?S.listPrefs[id]:{};
  const chips=d.chips?d.chips().filter(c=>c.id==='all'||c.n!==0):[];
  const chip=chips.some(c=>c.id===p.chip)?p.chip:'all';
  const sort=(d.sorts||[]).some(s=>s.id===p.sort)?p.sort:(d.sort||(d.sorts&&d.sorts[0]?d.sorts[0].id:''));
  return{chip,sort,q:(_lbQ[id]||'').trim().toLowerCase(),chips};
}
function lbBarHTML(id,st){
  const d=LB[id];if(!d)return'';st=st||lbState(id);
  const chips=st.chips.length>2?`<div class="lb-chips" role="tablist">${st.chips.map(c=>`<button class="chip${st.chip===c.id?' on':''}" role="tab" aria-selected="${st.chip===c.id}" onclick="lbSet(${jsq(id)},'chip',${jsq(c.id)})">${esc(c.l)}${c.n!=null&&c.id!=='all'?`<small>${c.n}</small>`:''}</button>`).join('')}</div>`:'';
  const sorts=d.sorts&&d.sorts.length>1?`<span class="range-pick lb-sort">${ICON('sliders',13)}<select aria-label="Sort" onchange="lbSet(${jsq(id)},'sort',this.value)">${d.sorts.map(s=>`<option value="${esc(s.id)}"${s.id===st.sort?' selected':''}>${esc(s.l)}</option>`).join('')}</select>${ICON('chev',13)}</span>`:'';
  return chips||sorts?`<div class="lb-row">${chips}${sorts}</div>`:'';
}
function lbHTML(id){
  const d=LB[id];if(!d)return'';const st=lbState(id);
  let body;try{body=d.body(st);}catch(e){logError(e,'list '+id);body=`<div class="ch-empty">This list could not be drawn.</div>`;}
  setTimeout(()=>lbReveal(id),0); // a remembered chip may sit off to the right
  const ph=typeof d.search==='function'?d.search():d.search; // a short list needs no search
  return`<div class="lb" id="lb-${id}">
    ${ph?`<div class="lb-search">${ICON('search',15)}<input type="search" id="lbq-${id}" value="${esc(_lbQ[id]||'')}" placeholder="${esc(ph)}" oninput="lbSet(${jsq(id)},'q',this.value)" enterkeyhint="search" autocomplete="off" autocorrect="off"></div>`:''}
    <div id="lbt-${id}">${lbBarHTML(id,st)}</div></div>
    <div id="lbb-${id}">${body}</div>`;
}
// Repaint what changed: a search repaints the rows only; a chip or a sort, the bar and the rows.
function lbSet(id,k,v){
  const d=LB[id];if(!d)return;
  if(k==='q')_lbQ[id]=String(v||'').slice(0,60);
  else{
    if(!isObj(S.listPrefs))S.listPrefs={};
    S.listPrefs[id]=Object.assign({},S.listPrefs[id],{[k]:String(v).slice(0,40)});save();
  }
  lbPaint(id,k!=='q');
}
function lbPaint(id,bar){
  const d=LB[id];if(!d)return;const st=lbState(id);
  const b=document.getElementById('lbb-'+id);
  if(b){try{b.innerHTML=d.body(st);}catch(e){logError(e,'list '+id);}}
  if(bar){const t=document.getElementById('lbt-'+id);if(t)t.innerHTML=lbBarHTML(id,st);}
  if(bar)lbReveal(id);
  if(d.after)d.after();
}
// The picked chip is always in sight, so a filtered list never looks like the whole one.
function lbReveal(id){
  const row=document.querySelector(`#lbt-${id} .lb-chips`);const on=row&&row.querySelector('.chip.on');if(!on)return;
  const l=on.offsetLeft-row.offsetLeft,r=l+on.offsetWidth;
  if(l<row.scrollLeft||r>row.scrollLeft+row.clientWidth)row.scrollLeft=Math.max(0,l-24);
}
// Does a row match the search? Every word has to be somewhere in its text.
function lbMatch(q,text){
  if(!q)return true;const t=String(text||'').toLowerCase();
  return q.split(/\s+/).filter(Boolean).every(w=>t.includes(w));
}
function normalizeListPrefs(v){
  const out={};if(!isObj(v))return out;
  Object.keys(v).slice(0,30).forEach(k=>{const p=v[k];if(!isObj(p))return;const o={};
    if(typeof p.chip==='string')o.chip=p.chip.slice(0,40);if(typeof p.sort==='string')o.sort=p.sort.slice(0,40);
    if(Object.keys(o).length)out[String(k).slice(0,30)]=o;});
  return out;
}
// Muscle groups, as people think of them: used by Records and Lifts.
const LB_MUSCLE_GROUPS=[
  {id:'chest',l:'Chest',m:['Chest']},
  {id:'back',l:'Back',m:['Lats','Traps','Lower Back']},
  {id:'shoulders',l:'Shoulders',m:['Front Delts','Side Delts','Rear Delts']},
  {id:'arms',l:'Arms',m:['Biceps','Triceps','Forearms']},
  {id:'legs',l:'Legs',m:['Quads','Hamstrings','Glutes','Calves']},
  {id:'core',l:'Core',m:['Abs','Obliques']},
];
function exMuscleGroup(exId){const pm=exMuscles(exId).pm;const g=LB_MUSCLE_GROUPS.find(x=>x.m.includes(pm));return g?g.id:'other';}
// Chips for a list of exercise ids: All, then each group that has something, with its count.
function lbMuscleChips(ids){
  const n={};ids.forEach(id=>{const g=exMuscleGroup(id);n[g]=(n[g]||0)+1;});
  return[{id:'all',l:'All'}].concat(LB_MUSCLE_GROUPS.map(g=>({id:g.id,l:g.l,n:n[g.id]||0})),n.other?[{id:'other',l:'Other',n:n.other}]:[]);
}
