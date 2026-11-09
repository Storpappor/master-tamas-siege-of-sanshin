// File checks of the delivered kicker.png / kicker.json against the brief's first-package contract.
// Zero dependencies; reads the files next to this script. Exit code 1 on any failure.
//   node verify-kicker.mjs
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodePng } from '../../../scripts/append-sheet.mjs';
import { SpriteSheet, resolveFrame } from '../../../src/heroSprite.js';

const dir = new URL('./', import.meta.url);
const pngBytes = readFileSync(new URL('kicker.png', dir)), jsonBytes = readFileSync(new URL('kicker.json', dir));
const map = JSON.parse(jsonBytes.toString());
const png = decodePng(pngBytes);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const checks = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok, detail }); };

check('sheet is 512 x 1232', png.width === 512 && png.height === 1232, `${png.width} x ${png.height}`);
check('map cell 128 x 112, anchor (64, 111), 4 columns', map.cell.w === 128 && map.cell.h === 112 && map.anchor.x === 64 && map.anchor.y === 111 && map.columns === 4);
const EXPECTED = { idle: [0], walk: [4, 5, 6, 7], enemyHighKick: [8, 9, 10], enemyLowSweep: [12, 13, 14], hurt: [16, 17], knockdown: [20, 21, 22], fallen: [36], getUp: [40] };
check('partial-delivery map: exactly the brief\'s 8 states and 18 cells', JSON.stringify(map.states) === JSON.stringify(EXPECTED), JSON.stringify(map.states));
for (const s of ['held', 'thrownDown1', 'thrownDown2']) check(`${s} is not mapped (procedural fallback)`, !(s in map.states));

let semi = 0; const colours = new Set();
for (let i = 0; i < png.rgba.length; i += 4) { const a = png.rgba[i + 3]; if (a !== 0 && a !== 255) semi++; if (a) colours.add((png.rgba[i] << 16) | (png.rgba[i + 1] << 8) | png.rgba[i + 2]); }
check('binary alpha', semi === 0, `${semi} semi-transparent pixels`);
check('colour count within 32', colours.size <= 32, `${colours.size} opaque colours`);

const alphaAt = (x, y) => png.rgba[(y * png.width + x) * 4 + 3];
const cellBounds = (index) => {
  const ox = (index % 4) * 128, oy = Math.floor(index / 4) * 112;
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
  for (let y = 0; y < 112; y++) for (let x = 0; x < 128; x++) if (alphaAt(ox + x, oy + y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return x1 < 0 ? null : { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};
const populated = Object.values(map.states).flat();
const bounds = {};
for (const c of populated) { bounds[c] = cellBounds(c); check(`cell ${c} has artwork`, bounds[c] !== null); }
for (let c = 0; c < 44; c++) if (!populated.includes(c)) check(`cell ${c} is empty`, cellBounds(c) === null);
for (const c of populated) { const b = bounds[c]; if (b) check(`cell ${c} keeps clear of the cell edge`, b.x0 >= 1 && b.x1 <= 126 && b.y0 >= 1 && b.y1 <= 111, `x ${b.x0}-${b.x1} y ${b.y0}-${b.y1}`); }
const idle = bounds[0];
check('idle stands 96 px (94-98) with soles on row 111', idle && idle.y1 === 111 && idle.h >= 94 && idle.h <= 98, idle ? `${idle.w} x ${idle.h}, rows ${idle.y0}-${idle.y1}` : 'no idle');
for (const c of [4, 5, 6, 7]) check(`walk cell ${c} stands on row 111, at most 98 px`, bounds[c].y1 === 111 && bounds[c].h <= 98, `${bounds[c].h} px`);
// Hit cells: an opaque pixel inside each hitbox (12-54 px ahead, 60-84 px up; 8-52 ahead, 4-24 up).
const inBox = (c, dx0, dx1, up0, up1) => { const ox = (c % 4) * 128, oy = Math.floor(c / 4) * 112; let n = 0; for (let up = up0; up <= up1; up++) for (let dx = dx0; dx <= dx1; dx++) if (alphaAt(ox + 64 + dx, oy + 111 - up)) n++; return n; };
check('high kick hit cell 9: the foot sits in the hitbox (12-54 ahead, 60-84 up)', inBox(9, 36, 54, 60, 84) > 60, `${inBox(9, 36, 54, 60, 84)} opaque pixels in the foot region`);
check('high kick hit cell 9: nothing of the kicking leg within 2 px of a crouching head (below 58 px, beyond +24)', inBox(9, 24, 63, 30, 57) === 0, `${inBox(9, 24, 63, 30, 57)} pixels`);
check('sweep hit cell 13: the foot sits in the hitbox (8-52 ahead, 4-24 up)', inBox(13, 30, 52, 4, 24) > 60, `${inBox(13, 30, 52, 4, 24)} opaque pixels`);
check('cells 22 (KO lying) and 36 (fallen) are distinct drawings', !(() => { const a = cellBounds(22), b = cellBounds(36); const ox = (22 % 4) * 128, oy = Math.floor(22 / 4) * 112, ox2 = (36 % 4) * 128, oy2 = Math.floor(36 / 4) * 112; for (let y = 0; y < 112; y++) for (let x = 0; x < 128; x++) { const p = ((oy + y) * png.width + ox + x) * 4, q = ((oy2 + y) * png.width + ox2 + x) * 4; for (let k = 0; k < 4; k++) if (png.rgba[p + k] !== png.rgba[q + k]) return false; } return Boolean(a && b); })());
for (const c of [22, 36]) check(`lying cell ${c} lies head toward -x (at most 120 px long)`, bounds[c].w <= 120 && bounds[c].x0 < 64 - 40, `${bounds[c].w} px, x ${bounds[c].x0}-${bounds[c].x1}`);
// Distinct drawings everywhere: no two populated slots share their pixels.
{ const sig = (c) => { const ox = (c % 4) * 128, oy = Math.floor(c / 4) * 112; let h = ''; for (let y = 0; y < 112; y++) h += png.rgba.subarray(((oy + y) * png.width + ox) * 4, ((oy + y) * png.width + ox + 128) * 4).toString('hex'); return sha(Buffer.from(h)); };
  const sigs = populated.map(sig); check('no two populated slots share one drawing', new Set(sigs).size === populated.length, `${new Set(sigs).size} distinct of ${populated.length}`); }
const sheet = new SpriteSheet({ map });
for (const state of Object.keys(map.states)) check(`${state} resolves through SpriteSheet`, resolveFrame(sheet, { state, phase: 'active', progress: 0.5, loop: 1 }) !== null);
check('enemyHighKick phases resolve to cells 8, 9, 10', ['startup', 'active', 'recovery'].map((phase) => resolveFrame(sheet, { state: 'enemyHighKick', phase })).join() === '8,9,10');
check('enemyLowSweep phases resolve to cells 12, 13, 14', ['startup', 'active', 'recovery'].map((phase) => resolveFrame(sheet, { state: 'enemyLowSweep', phase })).join() === '12,13,14');

const failed = checks.filter((c) => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed\nkicker.png  sha256 ${sha(pngBytes)}\nkicker.json sha256 ${sha(jsonBytes)}`);
if (failed.length) process.exit(1);
