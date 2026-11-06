// Generates HomeStock's house-and-shelves logo using pure Node + zlib.
// Standard tiles have transparent rounded corners; maskable versions keep
// the mark inside the safe zone. Run: node tools/generate-icons.js
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---- PNG encoder (RGBA, 8-bit) ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter byte
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- House with three storage compartments: canonical SVG geometry ----
const Brand = require('../brand.js');
const FOREST = [49,95,69]; // #315f45
const SAGE = [224,230,217]; // #e0e6d9
function inRoundedRect(u,v,rn) {
  const qx=Math.max(rn-u,u-(1-rn),0),qy=Math.max(rn-v,v-(1-rn),0);
  return qx*qx+qy*qy<=rn*rn;
}
function segmentDistance(x,y,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
}
function emblemColor(x,y) {
  const px=x*64,py=y*64;
  for(const points of Brand.paths)for(let i=1;i<points.length;i++){
    if(segmentDistance(px,py,points[i-1],points[i])<=Brand.strokeWidth/2)return SAGE;
  }
  return null;
}

function render(size, opts) {
  const maskable = !!(opts && opts.maskable);
  const SS = 4; // supersample
  const S = size * SS;
  const rgba = Buffer.alloc(size * size * 4);
  const rn = 0.22; // rounded-rect corner radius (normalized)
  const ei = maskable ? 0.12 : 0.10; // emblem inset (larger safe zone for maskable)
  const es = 1 - 2 * ei;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px * SS + sx + 0.5) / S;
          const v = (py * SS + sy + 0.5) / S;
          let col;
          let alpha;
          const insideTile = maskable ? true : inRoundedRect(u, v, rn);
          if (!insideTile) {
            col = SAGE;
            alpha = 0; // transparent corners
          } else {
            col = FOREST;
            alpha = 255;
            const em = emblemColor((u - ei) / es, (v - ei) / es);
            if (em) col = em;
          }
          r += col[0] * (alpha / 255);
          g += col[1] * (alpha / 255);
          b += col[2] * (alpha / 255);
          a += alpha;
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      const av = a / n; // average alpha (0..255)
      // un-premultiply (straight color) so edges stay crisp on any background
      const f = a > 0 ? 255 / a : 0;
      rgba[i] = Math.round(r * f);
      rgba[i + 1] = Math.round(g * f);
      rgba[i + 2] = Math.round(b * f);
      rgba[i + 3] = Math.round(av);
    }
  }
  return encodePng(size, size, rgba);
}

function write(name, buf) {
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
  console.log('wrote', name, buf.length + ' bytes');
}

// Standard (rounded-tile, transparent corners).
[16, 32, 48, 72, 96, 128, 192, 256, 384, 512].forEach(function (s) {
  write('icon-' + s + '.png', render(s, { maskable: false }));
});
// Apple touch icon: opaque full bleed; iOS supplies its own corner mask.
write('apple-touch-icon-180.png', render(180, { maskable: true }));
// Maskable (full-bleed, mark within safe zone).
write('icon-maskable-192.png', render(192, { maskable: true }));
write('icon-maskable-512.png', render(512, { maskable: true }));

// Vector assets use exactly the same paths as all PNG sizes and the UI.
function vector(name,color) {
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="הום סטוק" style="color:'+color+'">'+Brand.pathMarkup+'</svg>\n';
  fs.writeFileSync(path.join(OUT_DIR,name),svg);
}
vector('logo-mark.svg','#315f45');
vector('logo-mark-light.svg','#b9d7bd');
const tile='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="הום סטוק"><rect width="64" height="64" rx="14" fill="#315f45"/><g transform="translate(6.4 6.4) scale(.8)" style="color:#e0e6d9">'+Brand.pathMarkup+'</g></svg>\n';
fs.writeFileSync(path.join(OUT_DIR,'icon.svg'),tile);
