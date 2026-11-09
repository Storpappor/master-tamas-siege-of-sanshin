// Deterministic native Kicker export: paints the 18 first-package cells from poses.mjs, packs the
// 512 x 1232 sheet, writes the partial-delivery kicker.json, a labelled 4x contact sheet (with the
// two hitboxes outlined on the hit cells) and an export report with per-cell bounds and SHA-256s.
//   node build-kicker.mjs [--out <dir>]
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { encodePng } from '../../../scripts/append-sheet.mjs';
import { drawText } from '../../../src/sprites.js';
import { ATTACKS } from '../../../src/combat.js';
import { CELL, ANCHOR, PALETTE, Layer, measure } from './paint.mjs';
import { paintFigure } from './figure.mjs';
import { POSES, CELLS, MAP } from './poses.mjs';

const outDir = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : fileURLToPath(new URL('./', import.meta.url));
mkdirSync(outDir, { recursive: true });
const COLS = 4, ROWS = 11, W = CELL.w * COLS, H = CELL.h * ROWS;
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const PAL_RGB = PALETTE.map((h) => (h ? rgbOf(h) : null));

const cells = new Map();
const report = [];
for (const [index, poseName, state] of CELLS) {
  // Every slot is its own drawing: a pose name may be used by one slot only.
  if ([...cells.values()].some((c) => c.pose === poseName)) throw new Error(`pose ${poseName} is already used by another slot`);
  const cell = new Layer(); cell.pose = poseName; paintFigure(cell, POSES[poseName]);
  cells.set(index, cell);
  report.push({ cell: index, state, pose: poseName, bounds: measure(cell) });
}

// Pack the sheet.
const rgba = Buffer.alloc(W * H * 4);
const colours = new Set();
for (const [index, cell] of cells) {
  const ox = (index % COLS) * CELL.w, oy = Math.floor(index / COLS) * CELL.h;
  for (let row = 0; row < CELL.h; row++) for (let col = 0; col < CELL.w; col++) {
    const v = cell.idx[row * CELL.w + col]; if (!v) continue;
    const o = ((oy + row) * W + ox + col) * 4; const [r, g, b] = PAL_RGB[v];
    rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255; colours.add(v);
  }
}
const png = encodePng({ width: W, height: H, rgba });
const json = Buffer.from(JSON.stringify(MAP, null, 2) + '\n');
writeFileSync(`${outDir}/kicker.png`, png);
writeFileSync(`${outDir}/kicker.json`, json);
const sha = (b) => createHash('sha256').update(b).digest('hex');

// Contact sheet at 4x with labels, the floor row and the hitboxes on the hit cells.
{
  const Z = 4, LABEL = 22, PW = CELL.w * Z, PH = CELL.h * Z + LABEL, CC = 4;
  const rows = Math.ceil(CELLS.length / CC);
  const SW = CC * PW, SH = rows * PH;
  const sheet = Buffer.alloc(SW * SH * 4);
  const fill = (x, y, w, h, [r, g, b]) => { for (let yy = Math.max(0, y); yy < Math.min(SH, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(SW, x + w); xx++) { const o = (yy * SW + xx) * 4; sheet[o] = r; sheet[o + 1] = g; sheet[o + 2] = b; sheet[o + 3] = 255; } };
  const ctx = { fillStyle: '#000', fillRect(x, y, w, h) { fill(x, y, w, h, rgbOf(this.fillStyle)); } };
  fill(0, 0, SW, SH, rgbOf('#98a0b8'));
  const boxPx = (name) => { const b = ATTACKS[name].box; return { x0: b.x * 2, x1: (b.x + b.w) * 2 - 1, top: -b.y * 2, bottom: (-b.y - b.h) * 2 + 1 }; };
  CELLS.forEach(([index, poseName, state], i) => {
    const px0 = (i % CC) * PW, py0 = Math.floor(i / CC) * PH + LABEL;
    fill(px0, py0, PW, CELL.h * Z, rgbOf('#8f8ba0'));
    fill(px0, py0 + ANCHOR.y * Z + Z, PW, 1, rgbOf('#ff3b30')); // the floor: just under the anchor row
    fill(px0 + ANCHOR.x * Z, py0, 1, CELL.h * Z, rgbOf('#6a6680'));
    const cell = cells.get(index);
    for (let row = 0; row < CELL.h; row++) for (let col = 0; col < CELL.w; col++) { const v = cell.idx[row * CELL.w + col]; if (v) fill(px0 + col * Z, py0 + row * Z, Z, Z, PAL_RGB[v]); }
    const box = index === 9 ? boxPx('enemyHighKick') : index === 13 ? boxPx('enemyLowSweep') : null;
    if (box) {
      const bx0 = px0 + (ANCHOR.x + box.x0) * Z, bx1 = px0 + (ANCHOR.x + box.x1 + 1) * Z, by0 = py0 + (ANCHOR.y - box.top) * Z, by1 = py0 + (ANCHOR.y - box.bottom + 1) * Z;
      fill(bx0, by0, bx1 - bx0, 1, rgbOf('#ff3b30')); fill(bx0, by1, bx1 - bx0, 1, rgbOf('#ff3b30')); fill(bx0, by0, 1, by1 - by0, rgbOf('#ff3b30')); fill(bx1, by0, 1, by1 - by0, rgbOf('#ff3b30'));
    }
    const m = report[i].bounds;
    drawText(ctx, `C${index} ${state} ${m.w}X${m.h}`, px0 + 4, py0 - LABEL + 3, { color: '#fff4d8', scale: 2 });
    drawText(ctx, `X ${m.dx[0]}..${m.dx[1]} UP ${m.up[0]}..${m.up[1]}`, px0 + 4, py0 - LABEL + 14, { color: '#ffd166', scale: 1 });
  });
  writeFileSync(`${outDir}/kicker-contact-sheet-4x.png`, encodePng({ width: SW, height: SH, rgba: sheet }));
}

const out = { status: 'native artwork candidate for visual review (first package, 18 cells)', sheet: { width: W, height: H, cell: CELL, anchor: ANCHOR, columns: COLS },
  colours: colours.size, pngSha256: sha(png), jsonSha256: sha(json), cells: report };
writeFileSync(`${outDir}/export-report.json`, JSON.stringify(out, null, 2) + '\n');
console.log(`kicker.png ${W} x ${H}, ${cells.size} cells, ${colours.size} colours; sha256 ${out.pngSha256.slice(0, 12)}`);
for (const r of report) console.log(`  c${String(r.cell).padEnd(3)} ${r.state.padEnd(24)} ${String(r.bounds.w).padStart(3)} x ${String(r.bounds.h).padEnd(3)} x ${r.bounds.dx[0]}..${r.bounds.dx[1]}  up ${r.bounds.up[0]}..${r.bounds.up[1]}`);
