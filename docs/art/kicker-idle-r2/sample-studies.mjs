// Assemble the Kicker sheet from pose studies drawn in the approved idle's style: the same block-mode
// sampling as sample-idle.mjs, at the idle's FIXED scale and FIXED palette (export-report.json of the
// approved idle), one study per cell. Cells without a study stay transparent, and a state is mapped
// only when every one of its cells has a study, so a partial set stages with the procedural fallback.
//   node sample-studies.mjs studies.json [--out <dir>]
// studies.json: { "scale": 0.08488..., "palette": ["#rrggbb", ...], "studies": [
//   { "file": "kicker-idle-look-study.png", "cell": 0, "state": "idle", "anchorX": 625 }, ... ] }
// `anchorX` is the source column under the anchor (the stance midpoint, or the hips when lying);
// the ground row is the study's lowest opaque row, which lands on the anchor row 111.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { decodePng, encodePng } from '../../../scripts/append-sheet.mjs';
import { ATTACKS } from '../../../src/combat.js';

const args = process.argv.slice(2);
const configPath = args.find((a) => !a.startsWith('--'));
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : fileURLToPath(new URL('./', import.meta.url));
mkdirSync(outDir, { recursive: true });
const cfgDir = new URL('./', `file://${fileURLToPath(new URL(configPath, `file://${process.cwd()}/`))}`);
const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
const CELL = { w: 128, h: 112 }, ANCHOR = { x: 64, y: 111 }, COLS = 4, ROWS = 11;
const ALPHA_THRESHOLD = 128, COVERAGE = 0.5;
const scale = cfg.scale;
const palette = cfg.palette.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const W = [2, 3, 1.5];
const dist = (a, b) => W[0] * (a[0] - b[0]) ** 2 + W[1] * (a[1] - b[1]) ** 2 + W[2] * (a[2] - b[2]) ** 2;
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const outlineIdx = palette.reduce((bi, c, i) => (lum(c) < lum(palette[bi]) ? i : bi), 0);
const STATES = { idle: [0], walk: [4, 5, 6, 7], enemyHighKick: [8, 9, 10], enemyLowSweep: [12, 13, 14], hurt: [16, 17], knockdown: [20, 21, 22], held: [24], thrownDown1: [28], thrownDown2: [32], fallen: [36], getUp: [40] };
const sha = (b) => createHash('sha256').update(b).digest('hex');

function sampleStudy(study) {
  const bytes = readFileSync(new URL(study.file, cfgDir));
  const src = decodePng(bytes);
  const { width: SW, height: SH, rgba } = src;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < SW && y < SH && rgba[(y * SW + x) * 4 + 3] >= ALPHA_THRESHOLD;
  let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1;
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (opaque(x, y)) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  if (bx1 < 0) throw new Error(`${study.file}: no opaque pixels`);
  const groundBottom = (study.groundY ?? by1) + 1;
  const anchorSrcX = study.anchorX ?? Math.round((bx0 + bx1) / 2);
  const cache = new Map();
  const nearest = (r, g, b) => { const k = (r << 16) | (g << 8) | b; let i = cache.get(k); if (i === undefined) { let bd = Infinity; i = 0; palette.forEach((p, j) => { const d = dist(p, [r, g, b]); if (d < bd) { bd = d; i = j; } }); cache.set(k, i); } return i; };
  const cell = new Int16Array(CELL.w * CELL.h).fill(-1);
  for (let row = 0; row < CELL.h; row++) for (let col = 0; col < CELL.w; col++) {
    const sx0 = anchorSrcX + (col - ANCHOR.x) / scale, sx1 = anchorSrcX + (col - ANCHOR.x + 1) / scale;
    const sy0 = groundBottom - (ANCHOR.y - row + 1) / scale, sy1 = groundBottom - (ANCHOR.y - row) / scale;
    let n = 0, hit = 0; const votes = new Map();
    for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
      const wx = Math.min(sx1, x + 1) - Math.max(sx0, x), wy = Math.min(sy1, y + 1) - Math.max(sy0, y);
      if (wx <= 0 || wy <= 0) continue; const w = wx * wy; n += w;
      if (!opaque(x, y)) continue; hit += w;
      const o = (y * SW + x) * 4, i = nearest(rgba[o], rgba[o + 1], rgba[o + 2]);
      votes.set(i, (votes.get(i) || 0) + w);
    }
    if (!n || hit / n < COVERAGE) continue;
    let best = -1, bv = -1; for (const [i, v] of votes) if (v > bv) { bv = v; best = i; }
    cell[row * CELL.w + col] = best;
  }
  const before = Int16Array.from(cell);
  let outlined = 0;
  for (let row = 0; row < CELL.h; row++) for (let col = 0; col < CELL.w; col++) {
    const v = before[row * CELL.w + col]; if (v < 0 || lum(palette[v]) < 70) continue;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const r = row + dy, c = col + dx; return r < 0 || c < 0 || r >= CELL.h || c >= CELL.w || before[r * CELL.w + c] < 0; });
    if (edge) { cell[row * CELL.w + col] = outlineIdx; outlined++; }
  }
  let l = 1e9, r = -1, t = 1e9, b = -1;
  for (let row = 0; row < CELL.h; row++) for (let col = 0; col < CELL.w; col++) if (cell[row * CELL.w + col] >= 0) { l = Math.min(l, col); r = Math.max(r, col); t = Math.min(t, row); b = Math.max(b, row); }
  return { cell, info: { file: study.file, sha256: sha(bytes), sourceBounds: { x: [bx0, bx1], y: [by0, by1] }, anchorSrcX, groundBottom, outlined, bounds: { w: r - l + 1, h: b - t + 1, dx: [l - ANCHOR.x, r - ANCHOR.x], up: [ANCHOR.y - b, ANCHOR.y - t], rows: [t, b] } } };
}

const cells = new Map(), report = [];
for (const s of cfg.studies) {
  if (cells.has(s.cell)) throw new Error(`cell ${s.cell} has two studies`);
  const { cell, info } = sampleStudy(s);
  cells.set(s.cell, cell);
  report.push({ cell: s.cell, state: s.state, ...info });
}
// Contract checks per cell.
const boxPx = (name) => { const b = ATTACKS[name].box; return { x0: b.x * 2, x1: (b.x + b.w) * 2 - 1, top: -b.y * 2, bottom: (-b.y - b.h) * 2 + 1 }; };
const warn = [];
for (const r of report) {
  const c = cells.get(r.cell), at = (dx, up) => c[(ANCHOR.y - up) * CELL.w + ANCHOR.x + dx] >= 0;
  if (r.bounds.rows[1] !== ANCHOR.y && !['thrownDown1', 'thrownDown2'].includes(r.state)) warn.push(`cell ${r.cell}: lowest pixel on row ${r.bounds.rows[1]}, not the anchor row 111`);
  if (r.bounds.dx[0] < -63 || r.bounds.dx[1] > 62 || r.bounds.rows[0] < 1) warn.push(`cell ${r.cell}: touches the cell edge (${JSON.stringify(r.bounds)})`);
  if (r.state === 'idle' && r.bounds.h !== 96) warn.push(`cell ${r.cell}: idle is ${r.bounds.h} px, not 96`);
  if (r.state === 'walk' && r.bounds.h > 98) warn.push(`cell ${r.cell}: walk is ${r.bounds.h} px, over 98`);
  if (r.cell === 9) { const b = boxPx('enemyHighKick'); let n = 0; for (let up = b.bottom; up <= b.top; up++) for (let dx = 36; dx <= b.x1; dx++) if (at(dx, up)) n++; if (n < 60) warn.push(`cell 9: only ${n} px in the kick box's far part`); let low = 0; for (let up = 30; up <= 57; up++) for (let dx = 24; dx <= 63; dx++) if (at(dx, up)) low++; if (low) warn.push(`cell 9: ${low} px of the leg within 2 px of a crouching head`); }
  if (r.cell === 13) { const b = boxPx('enemyLowSweep'); let n = 0; for (let up = b.bottom; up <= b.top; up++) for (let dx = 30; dx <= b.x1; dx++) if (at(dx, up)) n++; if (n < 60) warn.push(`cell 13: only ${n} px in the sweep box's far part`); }
  if ((r.cell === 22 || r.cell === 36) && (r.bounds.w > 120 || r.bounds.dx[0] > -40)) warn.push(`cell ${r.cell}: lying figure not head toward -x within 120 px`);
}
// Map: only states whose cells all have studies; the pending victim states are never mapped here.
const states = {};
for (const [state, idx] of Object.entries(STATES)) if (!['held', 'thrownDown1', 'thrownDown2'].includes(state) && idx.every((i) => cells.has(i))) states[state] = idx;
const SWW = CELL.w * COLS, SHH = CELL.h * ROWS;
const rgba = Buffer.alloc(SWW * SHH * 4);
for (const [index, cell] of cells) {
  const ox = (index % COLS) * CELL.w, oy = Math.floor(index / COLS) * CELL.h;
  for (let row = 0; row < CELL.h; row++) for (let col = 0; col < CELL.w; col++) { const v = cell[row * CELL.w + col]; if (v < 0) continue; const o = ((oy + row) * SWW + ox + col) * 4; const c = palette[v]; rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255; }
}
const png = encodePng({ width: SWW, height: SHH, rgba });
const map = { image: 'kicker.png', cell: CELL, anchor: ANCHOR, columns: COLS, states };
const json = Buffer.from(JSON.stringify(map, null, 2) + '\n');
writeFileSync(`${outDir}/kicker.png`, png);
writeFileSync(`${outDir}/kicker.json`, json);
writeFileSync(`${outDir}/assembly-report.json`, JSON.stringify({ scale, palette: cfg.palette, cells: report, mappedStates: Object.keys(states), unmappedCells: Object.values(STATES).flat().filter((i) => !cells.has(i)), warnings: warn, pngSha256: sha(png), jsonSha256: sha(json) }, null, 2) + '\n');
console.log(`kicker.png ${SWW} x ${SHH}: ${cells.size} cells from studies, states mapped: ${Object.keys(states).join(', ') || 'none'}; sha256 ${sha(png).slice(0, 12)}`);
for (const r of report) console.log(`  c${String(r.cell).padEnd(3)} ${r.state.padEnd(14)} ${r.bounds.w} x ${r.bounds.h}  dx ${r.bounds.dx[0]}..${r.bounds.dx[1]}  up ${r.bounds.up[0]}..${r.bounds.up[1]}  <- ${r.file} (anchorX ${r.anchorSrcX})`);
for (const w of warn) console.log('  WARN ' + w);
