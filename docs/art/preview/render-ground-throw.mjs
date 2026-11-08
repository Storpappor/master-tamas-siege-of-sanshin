// Renders a contact sheet of the ground throw from the real simulation, using the procedural
// fighters (the production hero cells for grab/throw do not exist yet). No browser needed:
//   node docs/art/preview/render-ground-throw.mjs
// writes docs/art/preview/ground-throw.png and prints the frame timings it used.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Game } from '../../../src/game.js';
import { Enemy } from '../../../src/entities.js';
import { drawFighter, drawText, poseFor } from '../../../src/sprites.js';
import { STEP, GROUND_Y, screenY, GRAB } from '../../../src/constants.js';

const SCALE = 3;                 // image pixels per game unit
const PANEL = { w: 110, h: 64 }; // game units shown per panel
const COLS = 4;
const SHIFT = 90;                // screen rows cut off above the panel (feet land near the bottom)

// A minimal 2D context: only what the procedural fighters and the bitmap font use.
class Raster {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Uint8ClampedArray(w * h * 4); this.m = [1, 0, 0, 1, 0, 0]; this.stack = []; this.fillStyle = '#000'; this.globalAlpha = 1; this.imageSmoothingEnabled = false; }
  save() { this.stack.push({ m: [...this.m], a: this.globalAlpha, f: this.fillStyle }); }
  restore() { const s = this.stack.pop(); if (s) { this.m = s.m; this.globalAlpha = s.a; this.fillStyle = s.f; } }
  translate(x, y) { this.m[4] += this.m[0] * x; this.m[5] += this.m[3] * y; }
  scale(x, y) { this.m[0] *= x; this.m[3] *= y; }
  color() {
    const c = this.fillStyle;
    let m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) return [...m[1]].map((h) => parseInt(h + h, 16)).concat(1);
    m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
    m = /^rgba?\(([^)]+)\)$/.exec(c);
    if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
    throw new Error(`colour ${c}`);
  }
  fillRect(x, y, w, h) {
    const xa = this.m[0] * x + this.m[4], xb = this.m[0] * (x + w) + this.m[4];
    const ya = this.m[3] * y + this.m[5], yb = this.m[3] * (y + h) + this.m[5];
    const x0 = Math.max(0, Math.round(Math.min(xa, xb))), x1 = Math.min(this.w, Math.round(Math.max(xa, xb)));
    const y0 = Math.max(0, Math.round(Math.min(ya, yb))), y1 = Math.min(this.h, Math.round(Math.max(ya, yb)));
    const [r, g, b, a0] = this.color();
    const a = a0 * this.globalAlpha;
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      const i = (py * this.w + px) * 4;
      this.px[i] = this.px[i] * (1 - a) + r * a;
      this.px[i + 1] = this.px[i + 1] * (1 - a) + g * a;
      this.px[i + 2] = this.px[i + 2] * (1 - a) + b * a;
      this.px[i + 3] = 255;
    }
  }
}

function png(raster) {
  const { w, h, px } = raster;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(px.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Run a duel and keep a snapshot of every frame.
const idle = { left: false, right: false, up: false, down: false, duck: false, block: false, jump: false, punch: false, kick: false, kiai: false };
const game = new Game({ input: null, rng: () => 0.5 });
game.start();
const p = game.player;
const e = new Enemy('striker', p.x + 12, -1, () => 0.5, p.z);
e.cooldown = 99;
game.enemies.push(e);
const snap = (f) => ({ x: f.x, y: f.y, z: f.z, facing: f.facing, kind: f.kind, state: f.state, attack: f.attack ? { ...f.attack } : null, attackPhase: f.attackPhase, held: f.held, thrown: f.thrown, down: f.down, dead: f.dead, deadTimer: f.deadTimer, hurtTimer: f.hurtTimer, vy: f.vy, walkCycle: f.walkCycle, crouching: f.crouching, grounded: f.grounded });
const frames = [];
game.step(STEP, { ...idle, punch: true, kick: true });
for (let i = 1; i <= 110; i++) {
  frames.push({ i, t: i * STEP, p: snap(p), e: snap(e), pose: poseFor(e), heroPose: poseFor(p), texts: game.texts.map((t) => ({ ...t })) });
  game.step(STEP, idle);
}
const first = (pred) => frames.find(pred);
const picks = [
  ['GRAB REACH', first((f) => f.p.attack?.name === 'grab')],
  ['HOLD (THROW START-UP)', first((f) => f.e.held)],
  ['HOLD, LAST FRAME', [...frames].reverse().find((f) => f.e.held)],
  ['THROW DOWN, RISING', first((f) => f.e.thrown && f.e.vy < 0)],
  ['THROW DOWN, FALLING', first((f) => f.e.thrown && f.e.vy > 0 && GROUND_Y - f.e.y < 2.5)],
  ['GROUND IMPACT', first((f) => f.e.down)],
  ['LYING (RECOVERY)', first((f) => f.e.down && f.p.attack === null)],
  ['GET UP', first((f) => f.pose === 'getUp')],
];
for (const [label, f] of picks) if (!f) throw new Error(`no frame for ${label}`);

const BAR = 18; // caption bar height in panel units: label, frame + time, poses
const rows = Math.ceil(picks.length / COLS);
const img = new Raster(PANEL.w * SCALE * COLS, (PANEL.h + BAR) * SCALE * rows);
img.fillStyle = '#2a2420'; img.fillRect(0, 0, img.w, img.h);
picks.forEach(([label, f], n) => {
  const ox = (n % COLS) * PANEL.w * SCALE, oy = Math.floor(n / COLS) * (PANEL.h + BAR) * SCALE;
  img.save();
  img.translate(ox, oy);
  img.scale(SCALE, SCALE);
  // Floor band and a left margin so the camera sits 30 units behind Tamas.
  const camX = f.p.x - 30;
  const floorY = screenY(GROUND_Y, 0) - SHIFT;
  img.fillStyle = '#4b3b32'; img.fillRect(0, 0, PANEL.w, PANEL.h);
  img.fillStyle = '#7a5a46'; img.fillRect(0, floorY, PANEL.w, PANEL.h - floorY);
  img.fillStyle = '#5c4335'; img.fillRect(0, floorY, PANEL.w, 1);
  img.translate(-camX, -SHIFT);
  const fighters = [f.e, f.p].sort((a, b) => a.z - b.z || (a.held ? 1 : 0) - (b.held ? 1 : 0));
  img.fillStyle = 'rgba(0,0,0,0.28)';
  for (const g of fighters) img.fillRect(Math.round(g.x - 7), Math.round(screenY(GROUND_Y, g.z)) - 1, 14, 2);
  for (const g of fighters) drawFighter(img, g, { y: screenY(g.y, g.z) });
  for (const t of f.texts) drawText(img, t.text, Math.round(t.x), Math.round(t.y), { color: t.color, scale: t.scale || 1, align: 'center', shadow: '#1a1210' });
  img.restore();
  img.save();
  img.translate(ox, oy + PANEL.h * SCALE);
  img.scale(SCALE, SCALE);
  img.fillStyle = '#1a1512'; img.fillRect(0, 0, PANEL.w, BAR);
  drawText(img, `${label}`, 2, 1, { color: '#ffd166', scale: 1 });
  const ahead = ((f.e.x - f.p.x) * f.p.facing).toFixed(0);
  // Three decimals and a separated unit: an earlier "T 0.52S" was read as 0.525 (the S looked like a 5).
  drawText(img, `FRAME ${f.i}  ${f.t.toFixed(3)} SEC`, 2, 7, { color: '#cfc8b6', scale: 1 });
  drawText(img, `${(f.heroPose).toUpperCase()}  V ${f.pose.toUpperCase()}  +${ahead}`, 2, 13, { color: '#cfc8b6', scale: 1 });
  img.restore();
});
writeFileSync(new URL('./ground-throw.png', import.meta.url), png(img));
for (const [label, f] of picks) console.log(`${label.padEnd(22)} frame ${String(f.i).padStart(3)}  t=${f.t.toFixed(3)}s  tamas=${f.heroPose}/${f.p.attackPhase ?? '-'}  victim=${f.pose}  ahead=${((f.e.x - f.p.x) * f.p.facing).toFixed(1)}  up=${(GROUND_Y - f.e.y).toFixed(1)}`);
console.log(`hold distance ${GRAB.holdDistance}, image ${img.w}x${img.h}`);
