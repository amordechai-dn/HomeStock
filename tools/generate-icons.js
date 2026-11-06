// Generates HomeStock's cobalt fridge/shelf mark using pure Node + zlib.
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

// ---- Palette (HomeStock brand) ----
const COBALT = [48, 71, 201]; // #3047C9 primary
const APRICOT = [237, 133, 83]; // #ED8553 handle accent
const WHITE = [255, 255, 255];

// ---- Geometry helpers (all in normalized [0,1] space) ----
function inRoundedRect(u, v, rn) {
  // distance from the point to the "core" rect inset by rn on all sides
  const qx = Math.max(rn - u, u - (1 - rn), 0);
  const qy = Math.max(rn - v, v - (1 - rn), 0);
  return qx * qx + qy * qy <= rn * rn;
}
function inRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}
// Fridge/shelf mark matches the app navigation: two compartments, two handles.
function emblemColor(x, y) {
  if (!inRect(x, y, .18, .06, .82, .94)) return null;
  if (!inRect(x, y, .23, .11, .77, .89)) return WHITE;
  if (inRect(x, y, .23, .39, .77, .44)) return WHITE;
  if (inRect(x, y, .62, .20, .67, .31) || inRect(x, y, .62, .53, .67, .70)) return APRICOT;
  return COBALT;
}

function render(size, opts) {
  const maskable = !!(opts && opts.maskable);
  const SS = 4; // supersample
  const S = size * SS;
  const rgba = Buffer.alloc(size * size * 4);
  const rn = 0.22; // rounded-rect corner radius (normalized)
  const ei = maskable ? 0.26 : 0.16; // emblem inset (larger safe zone for maskable)
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
            col = WHITE;
            alpha = 0; // transparent corners
          } else {
            col = COBALT;
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
// Apple touch icon (no transparency needed, but rounded tile is fine).
write('apple-touch-icon-180.png', render(180, { maskable: false }));
// Maskable (full-bleed, mark within safe zone).
write('icon-maskable-192.png', render(192, { maskable: true }));
write('icon-maskable-512.png', render(512, { maskable: true }));
