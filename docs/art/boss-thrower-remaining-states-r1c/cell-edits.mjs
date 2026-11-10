// Recorded native-cell edits for an assembled enemy sheet, applied after assembly and patches.
// edit = { cell, op: 'shift', region: { box: [x, y, w, h], colours: [...hex], seed: [x, y] }, dx, dy, note }
//   The region is the 8-connected set of pixels inside `box` whose colour is in `colours`, grown from `seed`.
//   Every region pixel moves by (dx, dy); a vacated pixel takes the colour the original image had at
//   (x - dx, y - dy) (what lay "behind" the moved edge: body or transparency), so the wrist side stays joined.
//   Each edit can carry expected cell hashes before and after (sha256 of the cell's RGBA) for a reproducible check.
import { createHash } from 'node:crypto';
export const cellRgbaSha256 = (img, cw, ch, cols, cell) => { const cx = cell % cols, cy = Math.floor(cell / cols); const h = createHash('sha256'); for (let y = 0; y < ch; y++) h.update(img.rgba.subarray(((cy * ch + y) * img.width + cx * cw) * 4, ((cy * ch + y) * img.width + cx * cw + cw) * 4)); return h.digest('hex'); };
export function applyCellEdits(img, cw, ch, cols, edits, log = () => {}) {
  const regions = [];
  for (const e of edits) {
    const cx = e.cell % cols, cy = Math.floor(e.cell / cols); const base = (x, y) => ((cy * ch + y) * img.width + cx * cw + x) * 4;
    const hex = (x, y) => { const o = base(x, y); return img.rgba[o + 3] ? '#' + [img.rgba[o], img.rgba[o + 1], img.rgba[o + 2]].map((v) => v.toString(16).padStart(2, '0')).join('') : null; };
    if (e.expectBefore) { const have = cellRgbaSha256(img, cw, ch, cols, e.cell); if (have !== e.expectBefore) throw new Error(`cell ${e.cell} before-hash ${have} != expected ${e.expectBefore}`); }
    if (e.op !== 'shift') throw new Error(`unknown op ${e.op}`);
    const [bx, by, bw, bh] = e.region.box; const colours = new Set(e.region.colours.map((c) => c.toLowerCase()));
    const inBox = (x, y) => x >= bx && x < bx + bw && y >= by && y < by + bh;
    const key = (x, y) => y * cw + x; const R = new Map(); const stack = [e.region.seed];
    for (const [x, y] of e.region.extra || []) if (hex(x, y)) R.set(key(x, y), [x, y]);
    while (stack.length) { const [x, y] = stack.pop(); if (!inBox(x, y) || R.has(key(x, y))) continue; const c = hex(x, y); if (!c || !colours.has(c)) continue; R.set(key(x, y), [x, y]); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) stack.push([x + dx, y + dy]); }
    const orig = Buffer.from(img.rgba); const ob = (x, y) => base(x, y);
    for (const [x, y] of R.values()) { const sx = x - e.dx, sy = y - e.dy; const o = base(x, y); if (sx < 0 || sy < 0 || sx >= cw || sy >= ch) { img.rgba[o + 3] = 0; continue; } orig.copy(img.rgba, o, ob(sx, sy), ob(sx, sy) + 4); }
    for (const [x, y] of R.values()) { const tx = x + e.dx, ty = y + e.dy; if (tx < 0 || ty < 0 || tx >= cw || ty >= ch) throw new Error(`shift leaves cell at (${x},${y})`); orig.copy(img.rgba, base(tx, ty), ob(x, y), ob(x, y) + 4); }
    const after = cellRgbaSha256(img, cw, ch, cols, e.cell);
    if (e.expectAfter && after !== e.expectAfter) throw new Error(`cell ${e.cell} after-hash ${after} != expected ${e.expectAfter}`);
    const xs = [...R.values()].map((p) => p[0]), ys = [...R.values()].map((p) => p[1]);
    log(`edit cell ${e.cell}: shifted ${R.size} region pixels by (${e.dx},${e.dy}); region cols ${Math.min(...xs)}-${Math.max(...xs)} rows ${Math.min(...ys)}-${Math.max(...ys)}; cell rgba sha256 after ${after}`);
    regions.push({ cell: e.cell, pixels: [...R.values()], after });
  }
  return regions;
}
