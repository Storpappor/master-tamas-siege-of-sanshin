import { readFileSync } from 'node:fs';
import { decodePng } from '../../../scripts/append-sheet.mjs';
import { fileURLToPath } from 'node:url';
const HERE = fileURLToPath(new URL('./', import.meta.url));
const [file, cw, ch, ay, cell, bx, by, bw, bh, sx, sy, ...skin] = process.argv.slice(2); const [CW, CH, AY, CELL, BX, BY, BW, BH, SX, SY] = [cw, ch, ay, cell, bx, by, bw, bh, sx, sy].map(Number);
const img = decodePng(readFileSync(file)); const tam = decodePng(readFileSync(HERE + '../../../assets/sprites/tamas.png'));
const px = (im, w, h, cols, c, x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return null; const o = ((Math.floor(c / cols) * h + y) * im.width + (c % cols) * w + x) * 4; return im.rgba[o + 3] ? '#' + [im.rgba[o], im.rgba[o + 1], im.rgba[o + 2]].map((v) => v.toString(16).padStart(2, '0')).join('') : null; };
const skinSet = new Set(skin); const seen = new Set(); const hand = []; const stack = [[SX, SY]];
while (stack.length) { const [x, y] = stack.pop(); if (x < BX || x >= BX + BW || y < BY || y >= BY + BH || seen.has(x * 1000 + y)) continue; seen.add(x * 1000 + y); const c = px(img, CW, CH, 4, CELL, x, y); if (!c || !skinSet.has(c)) continue; hand.push([x, y]); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) stack.push([x + dx, y + dy]); }
const rows = [...new Set(hand.map((p) => p[1]))].sort((a, b) => a - b);
for (const facing of [1, -1]) { const hidden = []; for (const [hx, hy] of hand) { const sxp = facing === 1 ? 48 + 64 - hx - 1 : -48 - 64 + hx; const syp = -AY - 1 + hy; const tx = facing === 1 ? sxp + 48 : 48 - sxp - 1; const ty = syp + 96; if (px(tam, 96, 96, 4, 61, tx, ty)) hidden.push([hx, hy]); }
  console.log(`${file.split('/').slice(-2).join('/')} cell ${CELL} facing ${facing}: hand ${hand.length} px rows ${rows[0]}-${rows[rows.length - 1]} (${AY - rows[rows.length - 1]}-${AY - rows[0]} px up), hidden by Tamas cell 61: ${hidden.length} ${JSON.stringify(hidden)}`); }
