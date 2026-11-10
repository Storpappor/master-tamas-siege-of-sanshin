// Assemble an enemy sheet (Kage or Thrower) from pose studies with the Kicker idle-r2 sampling rules
// (block-mode, alpha >= 128, coverage >= 0.5, majority colour snapped to the fixed palette, light edge
// pixels darkened to the outline), at the character's FIXED scale and palette from its approved idle.
//   node assemble-enemy.mjs <config.json> [--out <dir>]
// config: { character, cell:{w,h}, anchor:{x,y}, columns:4, rows, states:{key:[cells]}, scale, palette:[hex],
//           studies:[{ file, cell, state, anchorX }] }   (file paths relative to the config)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { decodePng, encodePng } from '../../../scripts/append-sheet.mjs';
const args = process.argv.slice(2); const cfgPath = resolve(args.find((a) => !a.startsWith('--')));
const out = args.includes('--out') ? resolve(args[args.indexOf('--out') + 1]) : dirname(cfgPath); mkdirSync(out, { recursive: true });
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')); const cfgDir = dirname(cfgPath);
const { cell: CELL, anchor: ANCHOR, rows: ROWS } = cfg; const COLS = cfg.columns || 4; const scale = cfg.scale;
const ALPHA = 128, COVERAGE = 0.5, W = [2, 3, 1.5];
const palette = cfg.palette.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const outlineIdx = palette.reduce((bi, c, i) => (lum(c) < lum(palette[bi]) ? i : bi), 0);
const dist = (a, b) => W[0] * (a[0] - b[0]) ** 2 + W[1] * (a[1] - b[1]) ** 2 + W[2] * (a[2] - b[2]) ** 2;
function sample(study) {
  const bytes = readFileSync(resolve(cfgDir, study.file)); const src = decodePng(bytes); const { width: SW, height: SH, rgba } = src;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < SW && y < SH && rgba[(y * SW + x) * 4 + 3] >= ALPHA;
  let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1; for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (opaque(x, y)) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  const groundBottom = (study.groundY ?? by1) + 1; const ax = study.anchorX ?? Math.round((bx0 + bx1) / 2);
  const cache = new Map(); const nearest = (r, g, b) => { const k = (r << 16) | (g << 8) | b; let i = cache.get(k); if (i === undefined) { let bd = Infinity; i = 0; palette.forEach((p, j) => { const d = dist(p, [r, g, b]); if (d < bd) { bd = d; i = j; } }); cache.set(k, i); } return i; };
  const cellPx = new Int16Array(CELL.w * CELL.h).fill(-1);
  for (let row = 0; row < CELL.h; row++) for (let col = 0; col < CELL.w; col++) {
    const sx0 = ax + (col - ANCHOR.x) / scale, sx1 = ax + (col - ANCHOR.x + 1) / scale, sy0 = groundBottom - (ANCHOR.y - row + 1) / scale, sy1 = groundBottom - (ANCHOR.y - row) / scale;
    let n = 0, hit = 0; const votes = new Map();
    for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) { const wx = Math.min(sx1, x + 1) - Math.max(sx0, x), wy = Math.min(sy1, y + 1) - Math.max(sy0, y); if (wx <= 0 || wy <= 0) continue; const w = wx * wy; n += w; if (!opaque(x, y)) continue; hit += w; const o = (y * SW + x) * 4; const i = nearest(rgba[o], rgba[o + 1], rgba[o + 2]); votes.set(i, (votes.get(i) || 0) + w); }
    if (!n || hit / n < COVERAGE) continue; let best = -1, bv = -1; for (const [i, v] of votes) if (v > bv) { bv = v; best = i; } cellPx[row * CELL.w + col] = best;
  }
  const before = Int16Array.from(cellPx); let outlined = 0;
  for (let row = 0; row < CELL.h; row++) for (let col = 0; col < CELL.w; col++) { const v = before[row * CELL.w + col]; if (v < 0 || lum(palette[v]) < 70) continue; const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const r = row + dy, c = col + dx; return r < 0 || c < 0 || r >= CELL.h || c >= CELL.w || before[r * CELL.w + c] < 0; }); if (edge) { cellPx[row * CELL.w + col] = outlineIdx; outlined++; } }
  let l = 1e9, r = -1, t = 1e9, b = -1; for (let row = 0; row < CELL.h; row++) for (let col = 0; col < CELL.w; col++) if (cellPx[row * CELL.w + col] >= 0) { l = Math.min(l, col); r = Math.max(r, col); t = Math.min(t, row); b = Math.max(b, row); }
  return { cellPx, info: { file: study.file, sha256: createHash('sha256').update(bytes).digest('hex'), anchorX: ax, groundBottom, outlined, bounds: { w: r - l + 1, h: b - t + 1, cols: [l, r], rows: [t, b], up: [ANCHOR.y - b, ANCHOR.y - t], dx: [l - ANCHOR.x, r - ANCHOR.x] } } };
}
const cells = new Map(), report = [];
for (const s of cfg.studies) { if (cells.has(s.cell)) throw new Error(`cell ${s.cell} twice`); const { cellPx, info } = sample(s); cells.set(s.cell, cellPx); report.push({ cell: s.cell, state: s.state, ...info }); }
const SW2 = CELL.w * COLS, SH2 = CELL.h * ROWS; const sheet = Buffer.alloc(SW2 * SH2 * 4);
for (const [index, cellPx] of cells) { const cx = index % COLS, cy = Math.floor(index / COLS); for (let row = 0; row < CELL.h; row++) for (let col = 0; col < CELL.w; col++) { const v = cellPx[row * CELL.w + col]; if (v < 0) continue; const o = ((cy * CELL.h + row) * SW2 + cx * CELL.w + col) * 4; const c = palette[v]; sheet[o] = c[0]; sheet[o + 1] = c[1]; sheet[o + 2] = c[2]; sheet[o + 3] = 255; } }
// Recorded pixel patches (cfg.patches: [{cell, x, y, from, to}], hex colours) applied after assembly so a correction survives rebuilding;
// each patch must find the colour it expects, otherwise the build stops.
const hexAt = (o) => sheet[o + 3] ? '#' + [sheet[o], sheet[o + 1], sheet[o + 2]].map((v) => v.toString(16).padStart(2, '0')).join('') : null;
for (const pt of cfg.patches || []) { const cx = pt.cell % COLS, cy = Math.floor(pt.cell / COLS); const o = ((cy * CELL.h + pt.y) * SW2 + cx * CELL.w + pt.x) * 4; const have = hexAt(o); if (have !== pt.from) throw new Error(`patch cell ${pt.cell} (${pt.x},${pt.y}) expected ${pt.from} found ${have}`); if (!cfg.palette.includes(pt.to)) throw new Error(`patch colour ${pt.to} is not in the palette`); const c = [1, 3, 5].map((i) => parseInt(pt.to.slice(i, i + 2), 16)); sheet[o] = c[0]; sheet[o + 1] = c[1]; sheet[o + 2] = c[2]; sheet[o + 3] = 255; }
if (cfg.patches) console.log(`applied ${cfg.patches.length} recorded pixel patches`);
// Recorded cell edits (cfg.edits, see cell-edits.mjs): region shifts applied after the patches, with before/after cell hashes.
if (cfg.edits) { const { applyCellEdits } = await import('./cell-edits.mjs'); applyCellEdits({ width: SW2, height: SH2, rgba: sheet }, CELL.w, CELL.h, COLS, cfg.edits, console.log); }
const states = {}; for (const [key, list] of Object.entries(cfg.states)) if (list.every((i) => cells.has(i))) states[key] = list;
const png = encodePng({ width: SW2, height: SH2, rgba: sheet });
writeFileSync(join(out, `${cfg.character}.png`), png);
writeFileSync(join(out, `${cfg.character}.json`), JSON.stringify({ image: `${cfg.character}.png`, cell: CELL, anchor: ANCHOR, columns: COLS, states }, null, 2) + '\n');
writeFileSync(join(out, `${cfg.character}-assembly-report.json`), JSON.stringify({ character: cfg.character, scale, sheet: { width: SW2, height: SH2, sha256: createHash('sha256').update(png).digest('hex') }, mappedStates: Object.keys(states), unmappedStates: Object.keys(cfg.states).filter((k) => !states[k]), cells: report }, null, 2));
for (const r of report) console.log(`cell ${String(r.cell).padStart(2)} ${r.state.padEnd(12)} ${r.bounds.w}x${r.bounds.h} cols ${r.bounds.cols} rows ${r.bounds.rows} up ${r.bounds.up}  (${r.file})`);
console.log(`${cfg.character}.png ${SW2}x${SH2} sha256 ${createHash('sha256').update(png).digest('hex').slice(0, 16)}; mapped: ${Object.keys(states).join(',') || '-'}; unmapped: ${Object.keys(cfg.states).filter((k) => !states[k]).join(',')}`);
