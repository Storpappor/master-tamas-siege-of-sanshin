// Diagnostic Kicker sheet for checking the enemy sheet pipeline (loading, state routing, fallback,
// mirrored placement, the hitbox positions) in the cell the Kicker brief recommends, before the real
// artwork exists. It is NOT artwork: every cell is a flat coloured block labelled PLACEHOLDER with
// its state and cell index, an eye on the left and an arm or a leg to the right so mirroring is
// visible. The two attack cells carry the attack's hitbox as a red outline so its place against
// Tamas can be checked in the game.
//   node docs/art/preview/render-kicker-diagnostic.mjs
// writes docs/art/preview/kicker-diagnostic-sheet.png and .json. To see it in the game, copy both
// files to assets/sprites/ as kicker.png and kicker.json, start the dev server, and remove them
// afterwards; never commit them there.
import { writeFileSync } from 'node:fs';
import { encodePng } from '../../../scripts/append-sheet.mjs';
import { drawText } from '../../../src/sprites.js';
import { ATTACKS } from '../../../src/combat.js';

const CELL = { w: 128, h: 112 };
const ANCHOR = { x: 64, y: 111 };
const COLS = 4;
// One state per row, the layout of the brief's JSON map.
const STATES = {
  idle: [0], walk: [4, 5, 6, 7], enemyHighKick: [8, 9, 10], enemyLowSweep: [12, 13, 14], hurt: [16, 17],
  knockdown: [20, 21, 22], held: [24], thrownDown1: [28], thrownDown2: [32], fallen: [36], getUp: [40],
};
const ROWS = 11;
const STAND = 96; // the recommended standing height in px
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
const COLOURS = ['#ff00ff', '#00ffff', '#ffff00', '#ff8800', '#ff3366', '#66aaff', '#00ff66', '#ff9966', '#aaff00', '#ff66ff', '#ffcc66'];
// Rectangle given relative to the anchor: dx from the anchor column, `up` px above the anchor row.
const block = (ox, oy, dx0, dx1, upTop, upBottom) => ctx.fillRect(ox + ANCHOR.x + dx0, oy + ANCHOR.y - upTop, dx1 - dx0 + 1, upTop - upBottom + 1);
const outline = (ox, oy, dx0, dx1, upTop, upBottom) => {
  block(ox, oy, dx0, dx1, upTop, upTop); block(ox, oy, dx0, dx1, upBottom, upBottom);
  block(ox, oy, dx0, dx0, upTop, upBottom); block(ox, oy, dx1, dx1, upTop, upBottom);
};
// An attack box in art px above the anchor row: x ahead and height from the floor (units x 2).
const boxPx = (name) => { const b = ATTACKS[name].box; return { x0: b.x * 2, x1: (b.x + b.w) * 2 - 1, top: -b.y * 2, bottom: (-b.y - b.h) * 2 + 1 }; };
const KICK = boxPx('enemyHighKick'), SWEEP = boxPx('enemyLowSweep');

let n = 0;
for (const [state, cells] of Object.entries(STATES)) {
  const colour = COLOURS[n++ % COLOURS.length];
  cells.forEach((index, k) => {
    const ox = (index % COLS) * CELL.w, oy = Math.floor(index / COLS) * CELL.h;
    ctx.fillStyle = colour;
    let eye = [-17, STAND - 6], arm = null; // eye: [dx, up]; arm: [dx0, dx1, upTop, upBottom]
    switch (state) {
      case 'walk': // the walk cells bob one unit (2 px) on cells 1 and 3
        block(ox, oy, -21, 18, k % 2 ? STAND + 2 : STAND, 0); arm = [19, 35, 70, 60]; break;
      case 'enemyHighKick':
        block(ox, oy, -21, 18, STAND, 0);
        if (k === 1) { arm = [10, 54, 84, 66]; } else { arm = [8, 22, 52, 34]; } // the kick, or the chambered knee
        break;
      case 'enemyLowSweep': // crouched 75 px tall; the sweep skims the floor
        block(ox, oy, -20, 20, 75, 0); eye = [-16, 70];
        if (k === 1) { arm = [8, 52, 24, 4]; } else { arm = [21, 30, 46, 36]; }
        break;
      case 'hurt':
        block(ox, oy, -31, 10, STAND - 2 * k, 0); arm = [11, 20, 72, 62]; break;
      case 'knockdown':
        if (k === 0) { block(ox, oy, -31, 10, STAND - 4, 0); arm = [11, 20, 70, 60]; }
        else if (k === 1) { block(ox, oy, -45, 20, 50, 0); eye = [-41, 46]; arm = [21, 30, 30, 20]; }
        else { block(ox, oy, -50, 33, 32, 0); eye = null; ctx.fillStyle = '#000000'; block(ox, oy, -50, -37, 32, 0); }
        break;
      case 'held':
        block(ox, oy, -21, 21, STAND - 2, 0); eye = [-17, STAND - 8]; arm = [22, 30, 72, 60]; break;
      case 'thrownDown1': // hips at the anchor, the figure tilting back; drawn 10 px off the floor
        block(ox, oy, -38, 31, 83, 10); eye = [-34, 79]; arm = [20, 31, 40, 30]; break;
      case 'thrownDown2': // nearly flat, legs up toward +x, head toward -x
        block(ox, oy, -52, 38, 63, 10); eye = null; ctx.fillStyle = '#000000'; block(ox, oy, -52, -39, 63, 10); break;
      case 'fallen':
        block(ox, oy, -50, 33, 32, 0); eye = null; ctx.fillStyle = '#000000'; block(ox, oy, -50, -37, 32, 0); break;
      case 'getUp':
        block(ox, oy, -25, 25, 70, 0); eye = [-21, 66]; arm = [26, 34, 20, 10]; break;
      default: // idle
        block(ox, oy, -21, 18, STAND, 0); arm = [19, 35, 70, 60];
    }
    ctx.fillStyle = '#000000';
    if (eye) block(ox, oy, eye[0], eye[0] + 9, eye[1], eye[1] - 9);
    if (arm) block(ox, oy, arm[0], arm[1], arm[2], arm[3]);
    // The attack cells carry the hitbox outline (units x 2) so its place against Tamas can be checked.
    ctx.fillStyle = '#ff0000';
    if (state === 'enemyHighKick' && k === 1) outline(ox, oy, KICK.x0, KICK.x1, KICK.top, KICK.bottom);
    if (state === 'enemyLowSweep' && k === 1) outline(ox, oy, SWEEP.x0, SWEEP.x1, SWEEP.top, SWEEP.bottom);
    drawText(ctx, 'PLACEHOLDER', ox + 2, oy + 1, { color: '#ff0000', scale: 1 });
    drawText(ctx, state.toUpperCase().slice(0, 13), ox + 2, oy + 8, { color: '#000000', scale: 1 });
    drawText(ctx, `C${index}`, ox + CELL.w - 14, oy + 1, { color: '#ff0000', scale: 1 });
    // Anchor tick on the floor row.
    ctx.fillStyle = '#ff0000'; ctx.fillRect(ox + ANCHOR.x, oy + ANCHOR.y, 1, 1);
  });
}
writeFileSync(new URL('./kicker-diagnostic-sheet.png', import.meta.url), encodePng({ width: W, height: H, rgba }));
writeFileSync(new URL('./kicker-diagnostic-sheet.json', import.meta.url), JSON.stringify({
  cell: CELL, anchor: ANCHOR, columns: COLS, image: 'kicker-diagnostic-sheet.png',
  diagnostic: 'PLACEHOLDER: pipeline check only, not artwork', states: STATES,
}, null, 2) + '\n');
console.log(`wrote ${W} x ${H} diagnostic sheet (${Object.values(STATES).flat().length} cells, ${CELL.w} x ${CELL.h}, anchor ${ANCHOR.x},${ANCHOR.y})`);
