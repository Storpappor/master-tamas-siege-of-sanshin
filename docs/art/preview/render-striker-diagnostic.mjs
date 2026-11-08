// Diagnostic Striker sheet for checking the enemy sheet pipeline (loading, state routing, fallback,
// mirrored placement) before the real artwork exists. It is NOT artwork: every cell is a flat
// coloured block labelled PLACEHOLDER with its state and cell index, an eye on the left and an
// arm to the right so mirroring is visible, in the cell size the Striker brief recommends.
//   node docs/art/preview/render-striker-diagnostic.mjs
// writes docs/art/preview/striker-diagnostic-sheet.png and .json. To see it in the game, copy both
// files to assets/sprites/ as striker.png and striker.json, start the dev server, and remove them
// afterwards; never commit them there.
import { writeFileSync } from 'node:fs';
import { encodePng } from '../../../scripts/append-sheet.mjs';
import { drawText } from '../../../src/sprites.js';

const CELL = { w: 128, h: 96 };
const ANCHOR = { x: 64, y: 95 };
const COLS = 4;
// One state per row, the layout of the brief's JSON map.
const STATES = {
  idle: [0], walk: [4, 5, 6, 7], enemyPunch: [8, 9, 10], hurt: [12, 13], knockdown: [16, 17, 18],
  held: [20], thrownDown1: [24], thrownDown2: [28], fallen: [32], getUp: [36],
};
const ROWS = 10;
const W = CELL.w * COLS, H = CELL.h * ROWS;
const rgba = Buffer.alloc(W * H * 4);
const ctx = {
  fillStyle: '#000',
  fillRect(x, y, w, h) {
    const m = /^#([0-9a-f]{6})$/i.exec(this.fillStyle);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    for (let py = Math.max(0, y); py < Math.min(H, y + h); py++) for (let px = Math.max(0, x); px < Math.min(W, x + w); px++) {
      const o = (py * W + px) * 4; rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
    }
  },
};
const COLOURS = ['#ff00ff', '#00ffff', '#ffff00', '#ff8800', '#00ff66', '#ff3366', '#66aaff', '#ffffff', '#aaff00', '#ff66ff'];
const LYING = new Set(['thrownDown2', 'fallen']);
let n = 0;
for (const [state, cells] of Object.entries(STATES)) {
  const colour = COLOURS[n++ % COLOURS.length];
  cells.forEach((index, k) => {
    const ox = (index % COLS) * CELL.w, oy = Math.floor(index / COLS) * CELL.h;
    const lying = LYING.has(state) || (state === 'knockdown' && k === 2);
    ctx.fillStyle = colour;
    // Standing: 86 px tall block (rows 10-95) over the anchor. Lying: the measured 100 px span of the
    // fallen pose, head end 57 px behind the anchor, feet 42 px ahead, to prove the wide cell holds it.
    if (lying) ctx.fillRect(ox + ANCHOR.x - 57, oy + 70, 100, 26);
    else ctx.fillRect(ox + ANCHOR.x - 20, oy + 10, 40, 86);
    ctx.fillStyle = '#000000';
    if (lying) ctx.fillRect(ox + ANCHOR.x - 57, oy + 70, 14, 26);                 // dark head end (behind)
    else { ctx.fillRect(ox + ANCHOR.x + 20, oy + 36 + k * 4, 24, 10); ctx.fillRect(ox + ANCHOR.x - 18, oy + 14, 12, 12); } // arm ahead, eye behind
    drawText(ctx, 'PLACEHOLDER', ox + 2, oy + 1, { color: '#ff0000', scale: 1 });
    drawText(ctx, state.toUpperCase().slice(0, 11), ox + 2, oy + 60, { color: '#000000', scale: 1 });
    drawText(ctx, `C${index}`, ox + 2, oy + 88, { color: '#ff0000', scale: 1 });
    // Anchor tick on the floor row.
    ctx.fillStyle = '#ff0000'; ctx.fillRect(ox + ANCHOR.x, oy + ANCHOR.y, 1, 1);
  });
}
writeFileSync(new URL('./striker-diagnostic-sheet.png', import.meta.url), encodePng({ width: W, height: H, rgba }));
writeFileSync(new URL('./striker-diagnostic-sheet.json', import.meta.url), JSON.stringify({
  cell: CELL, anchor: ANCHOR, columns: COLS, image: 'striker-diagnostic-sheet.png',
  diagnostic: 'PLACEHOLDER: pipeline check only, not artwork', states: STATES,
}, null, 2) + '\n');
console.log(`wrote ${W} x ${H} diagnostic sheet (${Object.values(STATES).flat().length} cells, ${CELL.w} x ${CELL.h}, anchor ${ANCHOR.x},${ANCHOR.y})`);
