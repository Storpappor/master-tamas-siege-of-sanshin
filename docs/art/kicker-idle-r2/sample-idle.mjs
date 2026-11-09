// Native export of ONE revised Kicker idle cell from the idle look study (the S1 method): every
// opaque output pixel is the most common palette colour of the source block it covers, at one
// shared source-to-native scale chosen so the figure stands exactly 96 px with its soles on the
// anchor row; alpha is binary; the palette is derived from the study's own colours. No drawing
// is generated here: nothing is painted, only sampled and palette-mapped.
//   node sample-idle.mjs <study.png> [--anchor-x <srcX>] [--out <dir>]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { decodePng, encodePng } from '../../../scripts/append-sheet.mjs';

const args = process.argv.slice(2);
const studyPath = args.find((a) => !a.startsWith('--'));
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const outDir = opt('--out', fileURLToPath(new URL('./', import.meta.url)));
mkdirSync(outDir, { recursive: true });
const CELL = { w: 128, h: 112 }, ANCHOR = { x: 64, y: 111 }, TARGET_HEIGHT = 96;
const ALPHA_THRESHOLD = 128, COVERAGE = 0.5, MAX_COLOURS = 28;

const src = decodePng(readFileSync(studyPath));
const studySha = createHash('sha256').update(readFileSync(studyPath)).digest('hex');
const { width: SW, height: SH, rgba } = src;
const opaque = (x, y) => x >= 0 && y >= 0 && x < SW && y < SH && rgba[(y * SW + x) * 4 + 3] >= ALPHA_THRESHOLD;

// Figure bounds and the ground line (the lowest opaque row).
let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1;
for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (opaque(x, y)) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
const figureH = by1 - by0 + 1;
const scale = TARGET_HEIGHT / figureH; // native px per source px, both axes
const groundBottom = by1 + 1;          // exclusive bottom edge of the sole row
const anchorSrcX = Number(opt('--anchor-x', Math.round((bx0 + bx1) / 2)));

// Palette from the study: popular 5-bit bins merged by weighted distance, averaged.
const W = [2, 3, 1.5];
const dist = (a, b) => W[0] * (a[0] - b[0]) ** 2 + W[1] * (a[1] - b[1]) ** 2 + W[2] * (a[2] - b[2]) ** 2;
const bins = new Map();
for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
  if (!opaque(x, y)) continue;
  const o = (y * SW + x) * 4, k = ((rgba[o] >> 3) << 10) | ((rgba[o + 1] >> 3) << 5) | (rgba[o + 2] >> 3);
  const b = bins.get(k) || { n: 0, r: 0, g: 0, bl: 0 }; b.n++; b.r += rgba[o]; b.g += rgba[o + 1]; b.bl += rgba[o + 2]; bins.set(k, b);
}
const sorted = [...bins.values()].sort((a, b) => b.n - a.n).map((b) => ({ n: b.n, c: [b.r / b.n, b.g / b.n, b.bl / b.n] }));
const clusters = [];
const MERGE = 26 ** 2 * 3; // weighted squared distance under which a bin joins an existing cluster
for (const b of sorted) {
  const near = clusters.find((c) => dist(c.c, b.c) < MERGE);
  if (near) { const n = near.n + b.n; near.c = near.c.map((v, i) => (v * near.n + b.c[i] * b.n) / n); near.n = n; }
  else if (clusters.length < MAX_COLOURS) clusters.push({ n: b.n, c: [...b.c] });
  else { let best = clusters[0], bd = Infinity; for (const c of clusters) { const d = dist(c.c, b.c); if (d < bd) { bd = d; best = c; } } best.n += b.n; }
}
const palette = clusters.map((c) => c.c.map(Math.round));
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const cache = new Map();
const nearest = (r, g, b) => { const k = (r << 16) | (g << 8) | b; let i = cache.get(k); if (i === undefined) { let bd = Infinity; i = 0; palette.forEach((p, j) => { const d = dist(p, [r, g, b]); if (d < bd) { bd = d; i = j; } }); cache.set(k, i); } return i; };

// Sample: each native pixel covers one source block; opaque when at least half of it is.
const cell = new Int16Array(CELL.w * CELL.h).fill(-1);
let topRow = 1e9, bottomRow = -1, left = 1e9, right = -1;
for (let row = 0; row < CELL.h; row++) for (let col = 0; col < CELL.w; col++) {
  const sx0 = anchorSrcX + (col - ANCHOR.x) / scale, sx1 = anchorSrcX + (col - ANCHOR.x + 1) / scale;
  const sy0 = groundBottom - (ANCHOR.y - row + 1) / scale, sy1 = groundBottom - (ANCHOR.y - row) / scale;
  let n = 0, hit = 0; const votes = new Map();
  for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
    // Weight by the overlap of the source pixel with the block.
    const wx = Math.min(sx1, x + 1) - Math.max(sx0, x), wy = Math.min(sy1, y + 1) - Math.max(sy0, y);
    if (wx <= 0 || wy <= 0) continue; const w = wx * wy; n += w;
    if (!opaque(x, y)) continue; hit += w;
    const o = (y * SW + x) * 4, i = nearest(rgba[o], rgba[o + 1], rgba[o + 2]);
    votes.set(i, (votes.get(i) || 0) + w);
  }
  if (!n || hit / n < COVERAGE) continue;
  let best = -1, bv = -1; for (const [i, v] of votes) if (v > bv) { bv = v; best = i; }
  cell[row * CELL.w + col] = best;
  topRow = Math.min(topRow, row); bottomRow = Math.max(bottomRow, row); left = Math.min(left, col); right = Math.max(right, col);
}
// Outline integrity: an edge pixel keeps the study's dark outline; a light edge pixel (lost to
// sampling) takes the darkest palette colour, as H1 and S1 are outlined all round.
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const outlineIdx = palette.reduce((bi, c, i) => (lum(c) < lum(palette[bi]) ? i : bi), 0);
let outlined = 0;
const before = Int16Array.from(cell);
for (let row = 0; row < CELL.h; row++) for (let col = 0; col < CELL.w; col++) {
  const v = before[row * CELL.w + col]; if (v < 0 || lum(palette[v]) < 70) continue;
  const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const r = row + dy, c = col + dx; return r < 0 || c < 0 || r >= CELL.h || c >= CELL.w || before[r * CELL.w + c] < 0; });
  if (edge) { cell[row * CELL.w + col] = outlineIdx; outlined++; }
}

// Write the one-cell sheet, its map and the report.
const out = Buffer.alloc(CELL.w * CELL.h * 4);
const used = new Set();
for (let i = 0; i < cell.length; i++) { const v = cell[i]; if (v < 0) continue; const c = palette[v]; out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255; used.add(v); }
const png = encodePng({ width: CELL.w, height: CELL.h, rgba: out });
const map = { image: 'kicker-idle-r2.png', cell: CELL, anchor: ANCHOR, columns: 1, states: { idle: [0] } };
const json = Buffer.from(JSON.stringify(map, null, 2) + '\n');
writeFileSync(`${outDir}/kicker-idle-r2.png`, png);
writeFileSync(`${outDir}/kicker-idle-r2.json`, json);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const report = {
  status: 'revised native idle cell, UNAPPROVED candidate for visual review',
  method: 'block-mode sampling of the idle look study at one shared scale, palette from the study, binary alpha, edge pixels kept dark',
  study: { path: studyPath.split('/').pop(), sha256: studySha, size: [SW, SH], figureBounds: { x: [bx0, bx1], y: [by0, by1], w: bx1 - bx0 + 1, h: figureH } },
  sampling: { scale, nativePxPerSourcePx: scale, sourcePxPerNativePx: 1 / scale, anchorSrcX, groundBottom, alphaThreshold: ALPHA_THRESHOLD, coverage: COVERAGE, lightEdgePixelsDarkened: outlined },
  palette: palette.map(hex), coloursUsed: used.size,
  cell: { bounds: { cols: [left, right], rows: [topRow, bottomRow], w: right - left + 1, h: bottomRow - topRow + 1, dx: [left - ANCHOR.x, right - ANCHOR.x], up: [ANCHOR.y - bottomRow, ANCHOR.y - topRow] } },
  output: { png: { file: 'kicker-idle-r2.png', width: CELL.w, height: CELL.h, sha256: sha(png) }, map: { file: 'kicker-idle-r2.json', sha256: sha(json) } },
};
writeFileSync(`${outDir}/export-report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(`idle r2: ${report.cell.bounds.w} x ${report.cell.bounds.h} px, cols ${left}-${right}, rows ${topRow}-${bottomRow} (dx ${left - 64}..${right - 64}); scale ${scale.toFixed(5)} (${(1 / scale).toFixed(2)} src px per native px); ${used.size} of ${palette.length} colours; ${outlined} edge pixels darkened; sha256 ${report.output.png.sha256.slice(0, 12)}`);
