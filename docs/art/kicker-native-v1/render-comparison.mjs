// Artwork preview (not a game capture): the three fighters at 3x with their anchors on one floor
// line, H1 Tamas (the 96 x 96 idle reference, anchor 48,95), the shipped native S1 Striker idle
// (cell 0 of assets/sprites/striker.png) and the Kicker idle (cell 0 of kicker.png), plus the
// Kicker's two hit cells beside Tamas's crouch (cell 24) and jump (cell 37) at the brief's
// contact distances. Labels name the source and the measured heights.
//   node render-comparison.mjs <path-to-tamas-idle-h1.png>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from '../../../scripts/append-sheet.mjs';
import { drawText } from '../../../src/sprites.js';

const dir = new URL('./', import.meta.url);
const h1Path = process.argv[2];
const load = (p) => decodePng(readFileSync(p));
const kicker = load(new URL('kicker.png', dir)), striker = load(new URL('../../../assets/sprites/striker.png', dir)), tamas = load(new URL('../../../assets/sprites/tamas.png', dir));
const h1 = h1Path ? load(h1Path) : null;
const Z = 3, W = 1140, H = 420;
const out = Buffer.alloc(W * H * 4);
const fill = (x, y, w, h, [r, g, b]) => { for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) { const o = (yy * W + xx) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; } };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const ctx = { fillStyle: '#000', fillRect(x, y, w, h) { fill(x, y, w, h, rgb(this.fillStyle)); } };
fill(0, 0, W, H, rgb('#98a0b8'));
const FLOOR = 330;
fill(0, FLOOR, W, 2, rgb('#5c5868'));
// Blit a cell with its anchor at (ax, ay) on the output, scaled by Z.
function blit(png, cellIndex, cols, cw, ch, anchor, ax, ay, flip = false) {
  const ox = (cellIndex % cols) * cw, oy = Math.floor(cellIndex / cols) * ch;
  let top = 1e9, bottom = -1;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const o = ((oy + y) * png.width + ox + x) * 4; if (!png.rgba[o + 3]) continue;
    top = Math.min(top, y); bottom = Math.max(bottom, y);
    const dx = flip ? anchor.x - x : x - anchor.x;
    fill(ax + dx * Z, ay + (y - anchor.y) * Z - Z, Z, Z, [png.rgba[o], png.rgba[o + 1], png.rgba[o + 2]]);
  }
  return bottom - top + 1;
}
let x = 90;
const label = (text, lx, ly) => drawText(ctx, text, lx, ly, { color: '#fff4d8', scale: 2, align: 'center' });
if (h1) { const h = blit(h1, 0, 1, 96, 96, { x: 48, y: 95 }, x, FLOOR); label(`H1 TAMAS ${h} PX`, x, FLOOR + 12); }
else label('H1 REF MISSING', x, FLOOR + 12);
x += 170; { const h = blit(striker, 0, 4, 128, 96, { x: 64, y: 95 }, x, FLOOR); label(`S1 STRIKER ${h} PX`, x, FLOOR + 12); }
x += 170; { const h = blit(kicker, 0, 4, 128, 112, { x: 64, y: 111 }, x, FLOOR); label(`K1 KICKER ${h} PX`, x, FLOOR + 12); }
// Contact previews: the Kicker (facing left, mirrored as the renderer does) 20 units = 40 px from Tamas.
x += 250; { blit(tamas, 24, 4, 96, 96, { x: 48, y: 95 }, x, FLOOR); blit(kicker, 9, 4, 128, 112, { x: 64, y: 111 }, x + 40 * Z, FLOOR, true); label('HIGH KICK VS CROUCH C24 AT 20 UNITS', x + 40, FLOOR + 12); }
x += 290; { blit(tamas, 37, 4, 96, 96, { x: 48, y: 95 }, x, FLOOR - 36 * Z); blit(kicker, 13, 4, 128, 112, { x: 64, y: 111 }, x + 40 * Z, FLOOR, true); label('SWEEP VS JUMP C37 AT 20 UNITS', x + 40, FLOOR + 12); }
drawText(ctx, 'ARTWORK PREVIEW AT 3X. FEET ON ONE FLOOR LINE. NOT A GAME CAPTURE.', 8, H - 14, { color: '#ffffff', scale: 1 });
writeFileSync(new URL('kicker-comparison-3x.png', dir), encodePng({ width: W, height: H, rgba: out }));
console.log('wrote kicker-comparison-3x.png');
