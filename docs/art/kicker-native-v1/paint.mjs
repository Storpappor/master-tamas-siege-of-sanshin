// Native-resolution pixel painter for the Kicker sheet: an indexed cell buffer, filled shapes in
// figure space (x to the right, y up, origin on the anchor), parts composited with a 1 px outline,
// and a light-from-the-upper-left rim pass. Deterministic, zero dependencies.
export const CELL = { w: 128, h: 112 };
export const ANCHOR = { x: 64, y: 111 };

// K1 palette (sampled from the approved concept image, 24 colours + outline).
export const PALETTE = [
  null,
  '#1a0a1a', // 1 outline
  '#100410', // 2 outline deep (eye, mouth line)
  '#2c2440', // 3 gi base
  '#403858', // 4 gi light
  '#4c4466', // 5 gi highlight
  '#201830', // 6 gi shade
  '#181020', // 7 gi dark
  '#f8a860', // 8 skin
  '#ffc080', // 9 skin light
  '#d07840', // 10 skin shade
  '#a85838', // 11 skin dark
  '#3858c0', // 12 belt
  '#5878d8', // 13 belt light
  '#284090', // 14 belt shade
  '#e8c8a0', // 15 wrap
  '#f8e0b8', // 16 wrap light
  '#c8a878', // 17 wrap shade
  '#a08868', // 18 wrap line
  '#503028', // 19 hair
  '#684030', // 20 hair light
  '#301820', // 21 hair shade
  '#d88820', // 22 gold
  '#f0b040', // 23 gold light
  '#fff2d8', // 24 eye white
];
export const C = { OUT: 1, OUT2: 2, GI: 3, GI_L: 4, GI_H: 5, GI_S: 6, GI_D: 7, SKIN: 8, SKIN_L: 9, SKIN_S: 10, SKIN_D: 11,
  BELT: 12, BELT_L: 13, BELT_S: 14, WRAP: 15, WRAP_L: 16, WRAP_S: 17, WRAP_LINE: 18, HAIR: 19, HAIR_L: 20, HAIR_S: 21, GOLD: 22, GOLD_L: 23, EYE: 24 };
// Ramps for the rim pass: base -> [light, dark].
export const RAMP = { [C.GI]: [C.GI_L, C.GI_S], [C.SKIN]: [C.SKIN_L, C.SKIN_S], [C.BELT]: [C.BELT_L, C.BELT_S], [C.WRAP]: [C.WRAP_L, C.WRAP_S], [C.HAIR]: [C.HAIR_L, C.HAIR_S], [C.GI_S]: [C.GI, C.GI_D], [C.GOLD]: [C.GOLD_L, C.GOLD] };

export class Layer {
  constructor() { this.idx = new Uint8Array(CELL.w * CELL.h); }
  at(x, y) { const col = ANCHOR.x + x, row = ANCHOR.y - y; return col < 0 || row < 0 || col >= CELL.w || row >= CELL.h ? -1 : this.idx[row * CELL.w + col]; }
  set(x, y, v) { const col = ANCHOR.x + x, row = ANCHOR.y - y; if (col < 0 || row < 0 || col >= CELL.w || row >= CELL.h) return; this.idx[row * CELL.w + col] = v; }
}

// Figure-space pixel (x, y) is the unit square whose centre is (x + 0.5, y + 0.5).
const inside = (px, py, pts) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const bounds = (pts) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0: Math.floor(x0) - 1, x1: Math.ceil(x1) + 1, y0: Math.floor(y0) - 1, y1: Math.ceil(y1) + 1 }; };

export function poly(layer, pts, colour) {
  const b = bounds(pts);
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (inside(x + 0.5, y + 0.5, pts)) layer.set(x, y, colour);
}
export function ellipsePts(cx, cy, rx, ry, angle = 0, n = 28) {
  const pts = []; const ca = Math.cos(angle), sa = Math.sin(angle);
  for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; const ex = rx * Math.cos(t), ey = ry * Math.sin(t); pts.push([cx + ex * ca - ey * sa, cy + ex * sa + ey * ca]); }
  return pts;
}
export const ellipse = (layer, cx, cy, rx, ry, colour, angle = 0) => poly(layer, ellipsePts(cx, cy, rx, ry, angle), colour);
export const disc = (layer, cx, cy, r, colour) => ellipse(layer, cx, cy, r, r, colour);

// Thick segment with round caps, shaded across its width: light toward the upper left.
// `w` is the full width; shade bands are about 1.3 px on either edge. Pass shade: false for flat.
export function capsule(layer, a, b, w, colour, { shade = true, light = null, dark = null, taper = 1 } = {}) {
  const [ax, ay] = a, [bx, by] = b;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  let nx = -uy, ny = ux; // a normal
  if (nx * -1 + ny * 1 < 0) { nx = -nx; ny = -ny; } // point it toward the upper left (the light)
  const r = w / 2;
  const x0 = Math.floor(Math.min(ax, bx) - r) - 1, x1 = Math.ceil(Math.max(ax, bx) + r) + 1;
  const y0 = Math.floor(Math.min(ay, by) - r) - 1, y1 = Math.ceil(Math.max(ay, by) + r) + 1;
  const ramp = RAMP[colour] || [colour, colour];
  const lightC = light ?? ramp[0], darkC = dark ?? ramp[1];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5 - ax, py = y + 0.5 - ay;
    let t = (px * ux + py * uy) / len; t = Math.max(0, Math.min(1, t));
    const cx = ux * len * t, cy = uy * len * t;
    const rr = r * (1 - (1 - taper) * t);
    const d = Math.hypot(px - cx, py - cy);
    if (d > rr) continue;
    const s = (px - cx) * nx + (py - cy) * ny; // lateral, positive toward the light
    let c = colour;
    if (shade && rr >= 3) { if (s > rr - 1.4) c = lightC; else if (s < -(rr - 1.4)) c = darkC; }
    layer.set(x, y, c);
  }
}
export function line(layer, a, b, colour) {
  let [x0, y0] = a.map(Math.round), [x1, y1] = b.map(Math.round);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) { layer.set(x0, y0, colour); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
export const px = (layer, x, y, colour) => layer.set(Math.round(x), Math.round(y), colour);

// Local-to-world transform: origin, rotation (radians, counter-clockwise in figure space), scale x.
export const xf = ([ox, oy], angle = 0, sx = 1) => { const c = Math.cos(angle), s = Math.sin(angle); return ([x, y]) => [ox + (x * sx) * c - y * s, oy + (x * sx) * s + y * c]; };

// Composite a part onto the cell: outline ring (8-neighbourhood) under the part, rim light/dark
// on the part's own edges, then the part's pixels. Later parts overwrite earlier ones.
export function part(cell, draw, { outline = true, rim = true, rimDark = true } = {}) {
  const layer = new Layer();
  draw(layer);
  const { w, h } = CELL;
  const src = layer.idx, dst = cell.idx;
  if (rim) {
    const copy = Uint8Array.from(src);
    for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
      const v = copy[row * w + col]; if (!v || !RAMP[v]) continue;
      const up = row > 0 ? copy[(row - 1) * w + col] : 0, left = col > 0 ? copy[row * w + col - 1] : 0;
      const down = row < h - 1 ? copy[(row + 1) * w + col] : 0, right = col < w - 1 ? copy[row * w + col + 1] : 0;
      if (!up || !left) src[row * w + col] = RAMP[v][0];
      else if (rimDark && (!down || !right)) src[row * w + col] = RAMP[v][1];
    }
  }
  if (outline) {
    for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
      if (src[row * w + col]) continue;
      let near = false;
      for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1; dc++) { const r = row + dr, c = col + dc; if (r < 0 || c < 0 || r >= h || c >= w) continue; if (src[r * w + c]) { near = true; break; } }
      if (near) dst[row * w + col] = C.OUT;
    }
  }
  for (let i = 0; i < src.length; i++) if (src[i]) dst[i] = src[i];
}

// Measure a cell: opaque bounds relative to the anchor.
export function measure(cell) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
  for (let row = 0; row < CELL.h; row++) for (let col = 0; col < CELL.w; col++) if (cell.idx[row * CELL.w + col]) { n++; x0 = Math.min(x0, col); x1 = Math.max(x1, col); y0 = Math.min(y0, row); y1 = Math.max(y1, row); }
  if (!n) return null;
  return { cols: [x0, x1], rows: [y0, y1], w: x1 - x0 + 1, h: y1 - y0 + 1, dx: [x0 - ANCHOR.x, x1 - ANCHOR.x], up: [ANCHOR.y - y1, ANCHOR.y - y0], pixels: n };
}
