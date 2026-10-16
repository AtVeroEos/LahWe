// ═══════════════════════════════════════════════════
// CUES — the sounds for rest ending, sprint/walk changes and timed sets
// ═══════════════════════════════════════════════════
// One engine for every cue. Settings → Workout → Sounds: which sound (chime, beep, ring), how loud
// (Normal is the old level; Loud, Louder and Max push it through a limiter, so it gets louder
// without crackling), and whether other audio (Spotify) is lowered while a cue plays.
//
// Why it can be louder: a phone speaker is weak below ~600 Hz and strongest around 1-3 kHz, and a
// pure sine is the quietest tone there is for its level. So the cues sit in that range, louder levels
// add harmonics, and the gain is driven into a compressor that keeps the peaks from clipping.
//
// Lowering other audio uses Safari's Audio Session API: while a cue plays the page asks to be a
// "transient" sound, which the phone may answer by ducking what else is playing; afterwards it goes
// back to how it was. Where the API is missing nothing changes. A web page cannot touch the phone's
// own volume, and Spotify's remote volume does not work for music playing on an iPhone.
const CUE_SOUNDS=[{id:'chime',label:'Chime'},{id:'beep',label:'Beep'},{id:'ring',label:'Ring'}];
const CUE_VOLS=[{v:1,label:'Normal',gain:1},{v:2,label:'Loud',gain:2.2},{v:3,label:'Louder',gain:3.6},{v:4,label:'Max',gain:6}];
const CUE_PEAK=0.34; // one voice at Normal: the level the old beeps used

// Each pattern is a list of notes: [frequency, start (s), length (s)]. Ring notes trill between two.
const CUE_PATTERNS={
  chime:{rest:[[988,0,.32],[1319,.17,.42]],sprint:[[1319,0,.18],[1319,.22,.18]],walk:[[784,0,.6]],tick:[[1175,0,.07]],hold:[[1319,0,.18],[1568,.2,.4]]},
  beep:{rest:[[1800,0,.12],[1800,.18,.12],[1800,.36,.12]],sprint:[[2000,0,.1],[2000,.16,.1]],walk:[[1200,0,.5]],tick:[[1500,0,.05]],hold:[[1800,0,.12],[2200,.18,.3]]},
  ring:{rest:[[[1400,1800],0,.7],[[1400,1800],1,.7]],sprint:[[[1600,2000],0,.5]],walk:[[[900,1100],0,.6]],tick:[[1400,0,.05]],hold:[[[1600,2000],0,.6]]},
};
let _cueBus=null;
function cueBus(ctx){
  if(_cueBus&&_cueBus.ctx===ctx)return _cueBus;
  const input=ctx.createGain();const comp=ctx.createDynamicsCompressor();
  // A limiter: anything above -6 dBFS is held there, quickly, so louder levels fill out rather than clip.
  try{comp.threshold.value=-6;comp.knee.value=0;comp.ratio.value=20;comp.attack.value=0.002;comp.release.value=0.12;}catch(e){}
  input.connect(comp);comp.connect(ctx.destination);
  _cueBus={ctx,input,comp};
  return _cueBus;
}
function cueVolume(){return CUE_VOLS.find(x=>x.v===S.cueVol)||CUE_VOLS[2];}
function cueSoundId(){return CUE_SOUNDS.some(c=>c.id===S.cueSound)?S.cueSound:'chime';}
// One note: a fast attack (no click) and a smooth fall. Louder levels add the 2nd and 3rd harmonics.
function cueNote(ctx,dest,freq,at,dur,peak,rich,square){
  const g=ctx.createGain();g.connect(dest);
  g.gain.setValueAtTime(0.0001,at);
  g.gain.exponentialRampToValueAtTime(peak,at+0.01);
  g.gain.setValueAtTime(peak,at+Math.max(0.02,dur*0.55));
  g.gain.exponentialRampToValueAtTime(0.0001,at+dur);
  const trill=Array.isArray(freq);
  const parts=square||trill?[[1,1]]:rich?[[1,1],[2,0.35],[3,0.15]]:[[1,1]];
  parts.forEach(([h,amp])=>{
    const o=ctx.createOscillator();o.type=square||trill?'square':'sine';
    if(trill){ // a phone bell: the two tones swapped every 25 ms
      for(let t=0,i=0;t<dur;t+=0.025,i++)o.frequency.setValueAtTime(freq[i%2]*h,at+t);
    }else o.frequency.value=freq*h;
    const og=ctx.createGain();og.gain.value=amp*(trill||square?0.45:1); // square waves are louder per volt
    o.connect(og);og.connect(g);o.start(at);o.stop(at+dur+0.03);
  });
}
// Play a cue: 'rest' (rest is over), 'sprint', 'walk', 'tick' (a countdown second), 'hold' (time up).
// Returns how long it lasts, in seconds, or 0 when sound could not play.
function playCue(kind,opts){
  opts=opts||{};
  const ctx=getAudioCtx();if(!ctx)return 0;
  const sound=opts.sound||cueSoundId();const vol=opts.vol?CUE_VOLS.find(x=>x.v===opts.vol)||cueVolume():cueVolume();
  const pat=(CUE_PATTERNS[sound]||CUE_PATTERNS.chime)[kind]||CUE_PATTERNS.chime.rest;
  const bus=cueBus(ctx);
  bus.input.gain.setValueAtTime(vol.gain,ctx.currentTime);
  const rich=vol.v>=3;const square=sound==='beep';
  // Max plays it twice (not the countdown ticks), a beat apart.
  const len=pat.reduce((m,n)=>Math.max(m,n[1]+n[2]),0);
  const reps=vol.v>=4&&kind!=='tick'?2:1;
  const t0=ctx.currentTime+0.03;
  for(let r=0;r<reps;r++)pat.forEach(([f,at,dur])=>cueNote(ctx,bus.input,f,t0+r*(len+0.18)+at,dur,CUE_PEAK,rich,square));
  const total=reps*len+(reps-1)*0.18;
  if(kind!=='tick')cueDuck(total);
  return total;
}
// ─── Lowering other audio while a cue plays ───
let _duck={n:0,prev:null,timer:null};
function cueDuckSupported(){try{return !!(typeof navigator!=='undefined'&&navigator.audioSession&&'type' in navigator.audioSession);}catch(e){return false;}}
function cueDuck(secs){
  if(!S.cueDuck||!cueDuckSupported())return;
  try{
    if(!_duck.n)_duck.prev=navigator.audioSession.type||'auto';
    _duck.n++;
    navigator.audioSession.type='transient';
  }catch(e){return;}
  setTimeout(()=>{
    _duck.n=Math.max(0,_duck.n-1);
    if(_duck.n)return; // another cue is still playing
    try{navigator.audioSession.type=_duck.prev||'auto';}catch(e){}
    _duck.prev=null;
  },Math.round((secs+0.35)*1000));
}
// ─── Settings ───
function setCue(k,v){
  if(k==='vol'&&CUE_VOLS.some(x=>x.v===v))S.cueVol=v;
  if(k==='sound'&&CUE_SOUNDS.some(x=>x.id===v))S.cueSound=v;
  save();playCue('rest'); // hear what was picked (and it unlocks audio, inside the tap)
  if(typeof setPageRefresh==='function')setPageRefresh();
}
function cueSummary(){return`${CUE_SOUNDS.find(c=>c.id===cueSoundId()).label} · ${cueVolume().label}${S.restSound?'':' · rest end off'}`;}
