// Full check of the staged Kage/Thrower sheets (node check-remaining.mjs; SHEETS=<dir> checks another pair): dimensions, binary alpha, palette, per-cell bounds, baseline-cell identity.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodePng } from '../../../scripts/append-sheet.mjs';
import { fileURLToPath } from 'node:url';
const HERE = fileURLToPath(new URL('./', import.meta.url));
const C = process.env.SHEETS || HERE + '../../../assets/sprites';
const chars = {
  kage: { cand: C + '/boss.png', map: C + '/boss.json', ref: HERE + 'baseline/boss-attack-baseline.png', refMap: HERE + 'baseline/boss-attack-baseline.json', pal: HERE + 'baseline/boss-idle-report.json', cw: 128, ch: 128, ax: 64, ay: 127, idleH: 109, lyingMax: 120, expect: { w: 512, h: 1536 } },
  thrower: { cand: C + '/thrower.png', map: C + '/thrower.json', ref: HERE + 'baseline/thrower-attack-baseline.png', refMap: HERE + 'baseline/thrower-attack-baseline.json', pal: HERE + 'baseline/thrower-idle-report.json', cw: 128, ch: 96, ax: 64, ay: 95, idleH: 78, lyingMax: 100, expect: { w: 512, h: 960 } },
};
const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
for (const [name, c] of Object.entries(chars)) {
  const bytes = readFileSync(c.cand); const p = decodePng(bytes); const map = JSON.parse(readFileSync(c.map, 'utf8'));
  const ref = decodePng(readFileSync(c.ref)); const refMap = JSON.parse(readFileSync(c.refMap, 'utf8'));
  const rep = JSON.parse(readFileSync(c.pal, 'utf8')); const palette = new Set((rep.palette || rep.colours || rep.colors || []).map((x) => (typeof x === 'string' ? x : hex(...x)).toLowerCase()));
  console.log(`\n== ${name}: ${c.cand.split('/').pop()} ${p.width}x${p.height} sha256 ${createHash('sha256').update(bytes).digest('hex')}  (expected ${c.expect.w}x${c.expect.h}: ${p.width === c.expect.w && p.height === c.expect.h ? 'OK' : 'MISMATCH'}); palette entries from idle report: ${palette.size}`);
  console.log(`   map cell ${map.cell.w}x${map.cell.h} anchor (${map.anchor.x},${map.anchor.y}) columns ${map.columns}: ${map.cell.w === c.cw && map.cell.h === c.ch && map.anchor.x === c.ax && map.anchor.y === c.ay && map.columns === 4 ? 'OK' : 'MISMATCH'}`);
  let nonBinary = 0, offPalette = new Map();
  for (let i = 0; i < p.width * p.height; i++) { const a = p.rgba[i * 4 + 3]; if (a !== 0 && a !== 255) nonBinary++; if (a === 255) { const h = hex(p.rgba[i * 4], p.rgba[i * 4 + 1], p.rgba[i * 4 + 2]); if (!palette.has(h)) offPalette.set(h, (offPalette.get(h) || 0) + 1); } }
  console.log(`   non-binary alpha pixels: ${nonBinary}; off-palette colours: ${offPalette.size}${offPalette.size ? ' ' + JSON.stringify([...offPalette].slice(0, 8)) : ''}`);
  const rows = p.height / c.ch; const populated = [];
  const cellBounds = (img, cell) => { const cx = cell % 4, cy = Math.floor(cell / 4); let l = 1e9, r = -1, t = 1e9, b = -1, n = 0; for (let y = 0; y < c.ch; y++) for (let x = 0; x < c.cw; x++) { const o = ((cy * c.ch + y) * img.width + cx * c.cw + x) * 4; if (img.rgba[o + 3]) { n++; l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); } } return n ? { n, l, r, t, b, w: r - l + 1, h: b - t + 1 } : null; };
  const sameCell = (cell) => { const cx = cell % 4, cy = Math.floor(cell / 4); for (let y = 0; y < c.ch; y++) for (let x = 0; x < c.cw; x++) { const o = ((cy * c.ch + y) * p.width + cx * c.cw + x) * 4; for (let k = 0; k < 4; k++) if (p.rgba[o + k] !== ref.rgba[o + k]) return false; } return true; };
  const stateOf = {}; for (const [st, cells] of Object.entries(map.states)) cells.forEach((ci, k) => (stateOf[ci] = `${st}[${k}]`));
  const refCells = new Set(Object.values(refMap.states).flat());
  const hashes = new Map();
  for (let cell = 0; cell < rows * 4; cell++) {
    const bd = cellBounds(p, cell); if (!bd) { if (stateOf[cell]) console.log(`   cell ${cell} ${stateOf[cell]} EMPTY but mapped`); continue; }
    populated.push(cell);
    const cx = cell % 4, cy = Math.floor(cell / 4); const h = createHash('sha256'); for (let y = 0; y < c.ch; y++) h.update(p.rgba.subarray(((cy * c.ch + y) * p.width + cx * c.cw) * 4, ((cy * c.ch + y) * p.width + cx * c.cw + c.cw) * 4)); const hh = h.digest('hex').slice(0, 12);
    const dup = hashes.get(hh); hashes.set(hh, cell);
    const edge = [bd.l === 0 ? 'L' : '', bd.r === c.cw - 1 ? 'R' : '', bd.t === 0 ? 'T' : ''].join('');
    const soles = bd.b === c.ay ? 'floor' : `bottom row ${bd.b} (${c.ay - bd.b} up)`;
    const st = stateOf[cell] || 'UNMAPPED';
    const isBase = refCells.has(cell);
    const flags = [];
    if (!st.startsWith('knockdown') && !/^(fallen|thrownDown|held|getUp)/.test(st) && Math.abs(bd.h - c.idleH) > 2) flags.push(`height ${bd.h} vs idle ${c.idleH}`);
    if (/^(knockdown\[2\]|fallen)/.test(st) && bd.w > c.lyingMax) flags.push(`lying ${bd.w} > ${c.lyingMax}`);
    if (edge) flags.push('touches edge ' + edge);
    if (dup !== undefined) flags.push(`DUPLICATE of cell ${dup}`);
    console.log(`   cell ${String(cell).padStart(2)} ${st.padEnd(15)} ${String(bd.w).padStart(3)}x${String(bd.h).padStart(3)} cols ${bd.l}-${bd.r} rows ${bd.t}-${bd.b} dx ${bd.l - c.ax}..${bd.r - c.ax} ${soles.padEnd(22)} ${isBase ? (sameCell(cell) ? 'BASELINE identical' : 'BASELINE CHANGED') : 'new'} ${flags.length ? ' !! ' + flags.join('; ') : ''}`);
  }
  console.log(`   populated cells: ${populated.length} [${populated.join(',')}]; mapped: ${Object.values(map.states).flat().length}`);
}
