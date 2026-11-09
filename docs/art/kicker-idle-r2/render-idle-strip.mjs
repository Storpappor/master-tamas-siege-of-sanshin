// Artwork preview (not a game capture): the revised Kicker idle at 1x and at 3x, facing right as
// drawn and facing left as the renderer mirrors it, beside the H1 Tamas idle reference (90 px)
// and the shipped S1 Striker idle (86 px), all soles on one floor line.
//   node render-idle-strip.mjs <tamas-idle-h1.png>
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePng, encodePng } from '../../../scripts/append-sheet.mjs';
import { drawText } from '../../../src/sprites.js';

const dir = new URL('./', import.meta.url);
const load = (u) => decodePng(readFileSync(u));
const h1 = load(process.argv[2]);
const s1 = load(new URL('../../../assets/sprites/striker.png', dir));
const k = load(new URL('kicker-idle-r2.png', dir));
const W = 1180, H = 560;
const out = Buffer.alloc(W * H * 4);
const fill = (x, y, w, h, [r, g, b]) => { for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) { const o = (yy * W + xx) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; } };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const ctx = { fillStyle: '#000', fillRect(x, y, w, h) { fill(x, y, w, h, rgb(this.fillStyle)); } };
fill(0, 0, W, H, rgb('#98a0b8'));
function blit(png, cellIndex, cols, cw, ch, anchor, ax, ay, z, flip = false) {
  const ox = (cellIndex % cols) * cw, oy = Math.floor(cellIndex / cols) * ch;
  let top = 1e9, bottom = -1;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const o = ((oy + y) * png.width + ox + x) * 4; if (!png.rgba[o + 3]) continue;
    top = Math.min(top, y); bottom = Math.max(bottom, y);
    const dx = flip ? anchor.x - x : x - anchor.x;
    fill(ax + dx * z, ay + (y - anchor.y) * z - z, z, z, [png.rgba[o], png.rgba[o + 1], png.rgba[o + 2]]);
  }
  return bottom - top + 1;
}
const label = (t, x, y, scale = 2) => drawText(ctx, t, x, y, { color: '#fff4d8', scale, align: 'center' });
// 3x row.
let floor = 330, x = 110;
fill(0, floor, W, 2, rgb('#5c5868'));
let h = blit(h1, 0, 1, 96, 96, { x: 48, y: 95 }, x, floor, 3); label(`H1 TAMAS ${h} PX`, x, floor + 10);
x += 200; h = blit(s1, 0, 4, 128, 96, { x: 64, y: 95 }, x, floor, 3); label(`S1 STRIKER ${h} PX`, x, floor + 10);
x += 230; h = blit(k, 0, 1, 128, 112, { x: 64, y: 111 }, x, floor, 3); label(`KICKER IDLE R2 ${h} PX`, x, floor + 10); label('FACING RIGHT AS DRAWN', x, floor + 24, 1);
x += 230; blit(k, 0, 1, 128, 112, { x: 64, y: 111 }, x, floor, 3, true); label('KICKER IDLE R2 MIRRORED', x, floor + 10); label('FACING LEFT AS THE RENDERER DRAWS IT', x, floor + 24, 1);
// 1x row (art pixels, the size the renderer draws before the screen zoom).
floor = 480; x = 110;
fill(0, floor, W, 1, rgb('#5c5868'));
blit(h1, 0, 1, 96, 96, { x: 48, y: 95 }, x, floor, 1); x += 70; blit(s1, 0, 4, 128, 96, { x: 64, y: 95 }, x, floor, 1); x += 80;
blit(k, 0, 1, 128, 112, { x: 64, y: 111 }, x, floor, 1); x += 80; blit(k, 0, 1, 128, 112, { x: 64, y: 111 }, x, floor, 1, true);
label('1X: H1, S1, KICKER R2 RIGHT, KICKER R2 LEFT', 240, floor + 8, 1);
drawText(ctx, 'ARTWORK PREVIEW. SOLES ON ONE FLOOR LINE. H1 = 96X96 IDLE REFERENCE, S1 = SHIPPED STRIKER CELL 0. NOT A GAME CAPTURE.', 8, H - 12, { color: '#ffffff', scale: 1 });
writeFileSync(new URL('kicker-idle-r2-beside-h1-s1.png', dir), encodePng({ width: W, height: H, rgba: out }));
console.log('wrote kicker-idle-r2-beside-h1-s1.png');
