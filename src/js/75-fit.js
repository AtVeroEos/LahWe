// ═══════════════════════════════════════════════════
// FIT — reading a watch's own activity file
// ═══════════════════════════════════════════════════
// Garmin, Wahoo, Coros and most other watches record in FIT, and Strava's archive hands the
// original file back. This reads the little of it the app uses and skips the rest by size:
//   · the file header (12 or 14 bytes) and one or more files end to end;
//   · definition messages, which say what the data messages after them contain, in either byte
//     order, with developer fields (skipped);
//   · data messages, including the short form whose header carries a five-bit time offset;
//   · "record" (message 20): time, position, altitude, distance, heart rate, cadence;
//   · "session" (message 18): start, sport and the totals.
// Positions are in semicircles (2^31 of them to 180°), times in seconds since the end of 1989.
// The checksums are not verified: a damaged file simply stops being read where it stops making sense.
const FIT_EPOCH=631065600;
const FIT_SEMI=180/2147483648;
const FIT_SPORT={1:'Run',2:'Ride',5:'Swim',11:'Walk',17:'Hike',10:'Workout',4:'Workout',13:'Alpine Ski',15:'Rowing',19:'Paddling'};

// bytes: Uint8Array or ArrayBuffer → {lat,lon,ts,ele,hr,dist,cad (arrays, NaN where missing), session}
// Throws when the bytes are not a FIT file at all.
function fitDecode(bytes){
  const u8=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
  const out={lat:[],lon:[],ts:[],ele:[],hr:[],dist:[],cad:[],session:null,messages:0};
  let pos=0,lastTs=0,files=0;
  while(pos+12<=u8.length){
    const hs=u8[pos];
    if(hs<12||pos+hs>u8.length||u8[pos+8]!==0x2E||u8[pos+9]!==0x46||u8[pos+10]!==0x49||u8[pos+11]!==0x54)break; // ".FIT"
    files++;
    let p=pos+hs;const end=Math.min(u8.length,p+dv.getUint32(pos+4,true));
    const defs={};
    while(p<end){
      const h=u8[p++];
      if(!(h&0x80)&&(h&0x40)){
        // Definition: reserved, byte order, global message number, then the fields as (number, size, type).
        if(p+5>end)break;
        const be=u8[p+1]===1;const gm=dv.getUint16(p+2,!be);const nf=u8[p+4];p+=5;
        if(p+nf*3>end)break;
        const fields=[];let size=0;
        for(let i=0;i<nf;i++){fields.push({num:u8[p],size:u8[p+1],off:size});size+=u8[p+1];p+=3;}
        if(h&0x20){ // developer fields: counted so the data that follows is skipped correctly
          if(p>=end)break;
          const nd=u8[p++];if(p+nd*3>end)break;
          for(let i=0;i<nd;i++){size+=u8[p+1];p+=3;}
        }
        defs[h&15]={gm,be,fields,size};
        continue;
      }
      let def,cts=null;
      if(h&0x80){
        // Compressed header: two bits of message type and a time offset that rolls over every 32 s.
        def=defs[(h>>5)&3];const off=h&31;
        const low=lastTs%32;cts=lastTs-low+off+(off<low?32:0);
      }else def=defs[h&15];
      if(!def||p+def.size>end)break;
      const rd=(f,signed)=>{
        const at=p+f.off;
        if(f.size===1){const v=u8[at];return v===0xFF?NaN:v;}
        if(f.size===2){const v=dv.getUint16(at,!def.be);return v===0xFFFF?NaN:v;}
        if(f.size===4){if(signed){const v=dv.getInt32(at,!def.be);return v===0x7FFFFFFF?NaN:v;}const v=dv.getUint32(at,!def.be);return v===0xFFFFFFFF?NaN:v;}
        return NaN;
      };
      const m={};
      if(def.gm===20||def.gm===18){
        for(const f of def.fields)m[f.num]=rd(f,def.gm===20&&(f.num===0||f.num===1));
      }else{const tf=def.fields.find(f=>f.num===253&&f.size===4);if(tf)m[253]=rd(tf);}
      let ts=cts!=null?cts:m[253];
      if(isFinite(ts))lastTs=ts;else ts=NaN;
      out.messages++;
      if(def.gm===20){
        const alt=isFinite(m[78])?m[78]:m[2];
        out.lat.push(isFinite(m[0])?m[0]*FIT_SEMI:NaN);out.lon.push(isFinite(m[1])?m[1]*FIT_SEMI:NaN);
        out.ts.push(isFinite(ts)?ts+FIT_EPOCH:NaN);
        out.ele.push(isFinite(alt)?alt/5-500:NaN);
        out.hr.push(m[3]>0?m[3]:NaN);out.dist.push(isFinite(m[5])?m[5]/100:NaN);out.cad.push(isFinite(m[4])?m[4]:NaN);
      }else if(def.gm===18){
        out.session={start:isFinite(m[2])?(m[2]+FIT_EPOCH)*1000:null,sport:FIT_SPORT[m[5]]||'',
          elapsed:isFinite(m[7])?m[7]/1000:0,timer:isFinite(m[8])?m[8]/1000:0,meters:isFinite(m[9])?m[9]/100:0,
          calories:isFinite(m[11])?m[11]:0,hr:isFinite(m[16])?m[16]:0,hrx:isFinite(m[17])?m[17]:0,ascent:isFinite(m[22])?m[22]:0};
      }
      p+=def.size;
    }
    pos=end+2; // the two-byte checksum, then possibly another file
  }
  if(!files)throw new Error('This is not a FIT file.');
  return out;
}
