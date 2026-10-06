// Writes a short video of a barcode in the raw Y4M format, which Chromium can play as a fake camera
// (--use-file-for-fake-video-capture). Pure Node: no image library and no ffmpeg.
'use strict';
const fs = require('fs');
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = L.map(p => p.replace(/[01]/g, c => (c === '0' ? '1' : '0')));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
// GS1 check digit for the first n-1 digits of a code.
function checkDigit(body) { let s = 0; const d = body.split('').reverse(); d.forEach((c, i) => { s += Number(c) * (i % 2 === 0 ? 3 : 1); }); return String((10 - (s % 10)) % 10); }
// 95 modules (1 = dark) for a 13-digit EAN. A 12-digit UPC-A is the same bars with a leading 0.
function ean13Modules(code) {
  if (!/^\d{13}$/.test(code)) throw new Error('need 13 digits');
  if (checkDigit(code.slice(0, 12)) !== code[12]) throw new Error('bad check digit for ' + code);
  const par = PARITY[Number(code[0])];
  let m = '101';
  for (let i = 0; i < 6; i++) m += (par[i] === 'L' ? L : G)[Number(code[i + 1])];
  m += '01010';
  for (let i = 0; i < 6; i++) m += R[Number(code[i + 7])];
  return m + '101';
}
// opts: {width, height, frames, fps, scale (pixels per module), offsetX, offsetY, dark, light, blank (frames with no barcode first)}
function writeBarcodeY4M(file, code, opts) {
  const o = Object.assign({ width: 1280, height: 720, frames: 40, fps: 10, scale: 5, dark: 30, light: 225, blank: 0 }, opts || {});
  const W = o.width, H = o.height; const mods = ean13Modules(code);
  const bw = mods.length * o.scale, bh = Math.round(H * 0.3);
  const x0 = o.offsetX != null ? o.offsetX : Math.round((W - bw) / 2), y0 = o.offsetY != null ? o.offsetY : Math.round((H - bh) / 2);
  const plain = Buffer.alloc(W * H, o.light), withCode = Buffer.alloc(W * H, o.light);
  for (let y = y0; y < y0 + bh; y++) for (let i = 0; i < mods.length; i++) if (mods[i] === '1') withCode.fill(o.dark, y * W + x0 + i * o.scale, y * W + x0 + (i + 1) * o.scale);
  const chroma = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const fd = fs.openSync(file, 'w');
  fs.writeSync(fd, `YUV4MPEG2 W${W} H${H} F${o.fps}:1 Ip A1:1 C420jpeg\n`);
  for (let f = 0; f < o.frames; f++) { fs.writeSync(fd, 'FRAME\n'); fs.writeSync(fd, f < o.blank ? plain : withCode); fs.writeSync(fd, chroma); }
  fs.closeSync(fd);
  return file;
}
module.exports = { writeBarcodeY4M, ean13Modules, checkDigit };
