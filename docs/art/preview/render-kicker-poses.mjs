// Measured reference strip of the procedural Kicker: every pose its sheet replaces, rasterised from
// `drawFighter` at one pixel per game unit and shown at 4x, with the fixed collision box (green) and,
// on the two attacks, the attack's hitbox (red) overlaid. The caption gives the pose's extents in
// units relative to the feet. This is the game's current figure, NOT the approved K1 design: it
// shows where the simulation puts contact and collision, which K1 is drawn around.
//   node docs/art/preview/render-kicker-poses.mjs
// writes docs/art/preview/kicker-procedural-poses.png.
import { writeFileSync } from 'node:fs';
import { encodePng } from '../../../scripts/append-sheet.mjs';
import { drawFighter, drawText, poseFor } from '../../../src/sprites.js';
import { ATTACKS, HURTBOX } from '../../../src/combat.js';

const ZOOM = 4;
// One fighter stub per pose, in the state that makes `poseFor` pick it.
const POSES = [
  ['idle', {}], ['walk1', { state: 'walk', walkCycle: 0 }], ['walk2', { state: 'walk', walkCycle: 1 }], ['walk3', { state: 'walk', walkCycle: 2 }], ['walk4', { state: 'walk', walkCycle: 3 }],
  ['kickWind', { attack: { name: 'enemyHighKick' }, attackPhase: 'startup' }, 'enemyHighKick'],
  ['highKick', { attack: { name: 'enemyHighKick' }, attackPhase: 'active' }, 'enemyHighKick'],
  ['crouch', { attack: { name: 'enemyLowSweep' }, attackPhase: 'startup' }, 'enemyLowSweep'],
  ['crouchPunch', { attack: { name: 'enemyLowSweep' }, attackPhase: 'active' }, 'enemyLowSweep'],
  ['hurt', { state: 'hurt', hurtTimer: 0.3 }], ['held', { held: true }], ['thrownDown1', { thrown: true, vy: -10 }], ['thrownDown2', { thrown: true, vy: 10 }],
  ['fallen', { state: 'hurt', down: true, hurtTimer: 0.5 }], ['getUp', { state: 'hurt', down: true, hurtTimer: 0.1 }],
];
const COLS = 5, PANEL_W = 72, PANEL_H = 60, CAPTION = 24; // panel in units; the feet sit at (28, 52)
const FOOTER = 14;
const W = COLS * PANEL_W * ZOOM, H = Math.ceil(POSES.length / COLS) * (PANEL_H * ZOOM + CAPTION) + FOOTER;
const rgba = Buffer.alloc(W * H * 4);
const ctx = {
  fillStyle: '#000', globalAlpha: 1, tx: 0, ty: 0, sx: 1, stack: [],
  save() { this.stack.push([this.tx, this.ty, this.sx]); }, restore() { [this.tx, this.ty, this.sx] = this.stack.pop(); },
  translate(x, y) { this.tx += x * this.sx; this.ty += y; }, scale(x) { this.sx *= x; },
  fillRect(x, y, w, h) {
    const m = /^#([0-9a-f]{6})$/i.exec(this.fillStyle); if (!m) return;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    for (let py = this.ty + y; py < this.ty + y + h; py++) for (let px = this.tx + x; px < this.tx + x + w; px++) {
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const o = (py * W + px) * 4; rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
    }
  },
};
// Unit-space drawing into a panel: a 4x4 block per unit.
const unitRect = (ox, oy, x, y, w, h, colour) => { ctx.fillStyle = colour; ctx.fillRect(ox + x * ZOOM, oy + y * ZOOM, w * ZOOM, h * ZOOM); };
const unitOutline = (ox, oy, x, y, w, h, colour) => {
  unitRect(ox, oy, x, y, w, 0.25, colour); unitRect(ox, oy, x, y + h - 0.25, w, 0.25, colour);
  unitRect(ox, oy, x, y, 0.25, h, colour); unitRect(ox, oy, x + w - 0.25, y, 0.25, h, colour);
};
// Extents of the pose at one pixel per unit, for the caption.
function extents(f) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const rec = { fillStyle: '', globalAlpha: 1, tx: 0, ty: 0, sx: 1, stack: [], save: ctx.save, restore: ctx.restore, translate: ctx.translate, scale: ctx.scale,
    fillRect(x, y, w, h) { x0 = Math.min(x0, this.tx + x); x1 = Math.max(x1, this.tx + x + w - 1); y0 = Math.min(y0, this.ty + y); y1 = Math.max(y1, this.ty + y + h - 1); } };
  drawFighter(rec, f, { y: 0 });
  return { x0, x1, y0, y1 };
}

ctx.fillStyle = '#6d6a7a'; ctx.fillRect(0, 0, W, H);
POSES.forEach(([pose, stub, attack], i) => {
  const f = { kind: 'kicker', x: 0, y: 0, facing: 1, state: 'idle', walkCycle: 0, grounded: true, ...stub };
  if (poseFor(f) !== pose) throw new Error(`${pose} resolves to ${poseFor(f)}`);
  const ox = (i % COLS) * PANEL_W * ZOOM, oy = Math.floor(i / COLS) * (PANEL_H * ZOOM + CAPTION);
  const fx = 28, fy = 52;
  ctx.fillStyle = '#8f8ba0'; ctx.fillRect(ox, oy, PANEL_W * ZOOM, PANEL_H * ZOOM);
  unitRect(ox, oy, 0, fy, PANEL_W, PANEL_H - fy, '#5c5868'); // floor
  // The figure, at 4 px per unit: drawFighter's own translate calls are tracked on the stub.
  const scaled = { fillStyle: '#000', globalAlpha: 1, save() {}, restore() {}, translate(x, y) { f._tx = (f._tx || 0) + x; f._ty = (f._ty || 0) + y; }, scale() {},
    fillRect(x, y, w, h) { unitRect(ox, oy, fx + (f._tx || 0) + x, fy + (f._ty || 0) + y, w, h, this.fillStyle); } };
  drawFighter(scaled, f, { y: 0 });
  // Collision box (fixed, green) and the attack's hitbox (red), both from combat.js.
  const hb = HURTBOX.standing; // enemies never crouch for collision: the box is the standing one in every pose
  unitOutline(ox, oy, fx + hb.x, fy + hb.y, hb.w, hb.h, '#36e36a');
  if (attack && f.attackPhase === 'active') { const b = ATTACKS[attack].box; unitOutline(ox, oy, fx + b.x, fy + b.y, b.w, b.h, '#ff3b30'); }
  unitRect(ox, oy, fx - 0.5, fy - 0.5, 1, 1, '#ff3b30'); // the feet origin
  const e = extents(f);
  const label = attack ? `${pose} = ${attack} ${f.attackPhase}` : pose;
  drawText(ctx, label.toUpperCase(), ox + 4, oy + PANEL_H * ZOOM + 3, { color: '#f4f1e6', scale: 2 });
  drawText(ctx, `X ${e.x0}..${e.x1}  Y ${e.y0}..${e.y1}  ${e.x1 - e.x0 + 1}X${e.y1 - e.y0 + 1}`, ox + 4, oy + PANEL_H * ZOOM + 14, { color: '#ffd166', scale: 1 });
});
drawText(ctx, 'PROCEDURAL KICKER AT 1 PX PER UNIT X4. GREEN: COLLISION BOX. RED: HITBOX. NOT THE K1 DESIGN.', 6, H - 8, { color: '#ffffff', scale: 1 });
writeFileSync(new URL('./kicker-procedural-poses.png', import.meta.url), encodePng({ width: W, height: H, rgba }));
console.log(`wrote ${W} x ${H} reference strip (${POSES.length} poses)`);
