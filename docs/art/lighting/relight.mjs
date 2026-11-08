// Re-lighting of the production backgrounds to the approved colour and lighting references
// (docs/art/lighting/ref-street-neon.webp: dark midnight street with vivid cyan/magenta neon;
// docs/art/lighting/ref-dojo-muted.webp: calmer, warmer dojo with restrained accents).
//
// Pure pixel code over {w, h, data} RGBA buffers, no DOM: relight.html runs it in a browser and
// writes the PNGs. The geometry of the strips is untouched; only colour and light change.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

function hsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max > 0 ? d / max : 0, max];
}

// Separable box blur, `passes` times (3 passes approximate a gaussian). Works on a Float32 plane.
export function blur(src, w, h, radius, passes = 3) {
  if (radius <= 0) return Float32Array.from(src);
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  const span = 2 * radius + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let s = 0;
      for (let x = -radius; x <= radius; x++) s += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[row + x] = s / span;
        s += a[row + Math.min(w - 1, x + radius + 1)] - a[row + Math.max(0, x - radius)];
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = -radius; y <= radius; y++) s += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = s / span;
        s += b[Math.min(h - 1, y + radius + 1) * w + x] - b[Math.max(0, y - radius) * w + x];
      }
    }
  }
  return a;
}

function planes(img) {
  const n = img.w * img.h;
  const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++) { r[i] = img.data[i * 4] / 255; g[i] = img.data[i * 4 + 1] / 255; b[i] = img.data[i * 4 + 2] / 255; }
  return { r, g, b, n };
}

function pack(w, h, r, g, b) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = Math.round(clamp01(r[i]) * 255);
    data[i * 4 + 1] = Math.round(clamp01(g[i]) * 255);
    data[i * 4 + 2] = Math.round(clamp01(b[i]) * 255);
    data[i * 4 + 3] = 255;
  }
  return { w, h, data };
}

// Add `mask * colour * gain` into the output planes.
function addLight(out, mask, colour, gain) {
  for (let i = 0; i < mask.length; i++) {
    const m = mask[i] * gain;
    if (m <= 0) continue;
    out.r[i] += m * colour[0]; out.g[i] += m * colour[1]; out.b[i] += m * colour[2];
  }
}

// Columns of the drainpipes / building joints: dark, thin, vertical runs through the wall band.
export function findPipes(img, { y0 = 20, y1 = 230, minRun = 150, maxWidth = 14 } = {}) {
  const { w } = img;
  const counts = new Array(w).fill(0);
  for (let x = 0; x < w; x++) {
    for (let y = y0; y < y1; y++) {
      const i = (y * w + x) * 4;
      const v = Math.max(img.data[i], img.data[i + 1], img.data[i + 2]) / 255;
      if (v < 0.32) counts[x]++;
    }
  }
  const pipes = [];
  let start = -1;
  for (let x = 0; x <= w; x++) {
    const on = x < w && counts[x] >= minRun;
    if (on && start < 0) start = x;
    if (!on && start >= 0) { if (x - start <= maxWidth) pipes.push([start, x - 1]); start = -1; }
  }
  return pipes;
}

export const STREET_DEFAULTS = {
  // Unlit surfaces: L' = base + gain * L^gamma, tinted toward the night colour, darker toward the roofline.
  base: 0.02, gain: 0.26, gamma: 2.3,
  night: [0.30, 0.16, 1.0], keepHue: 0.2, skyFade: 0.45,
  pavementLift: 1.2, pavementTint: [0.62, 0.3, 1.0], roadLevel: 0.7,
  // Sign: dark face, warm readable lettering, the red roundel kept; only the frame emits.
  signFace: 0.6, signLetter: [1.0, 0.9, 0.72],
  // Lamp cores stay bright and small; warm materials (door, awning, tables) are lit but do not emit.
  lampKeep: 1.0, lampBloomRadius: 4, lampBloom: 0.2,
  facadeKnee: 0.1, facadeKneeSlope: 0.25,
  stripTube: 1.0, stripSpillRadius: 16, stripSpill: 0.8, tubeWeight: 12,
  warmKeep: 0.78, doorEmit: 0.35,
  // Window glass: ground floor amber-lit keeping the pane's own shading, upper floor dark and cool.
  windowGlass: [1.0, 0.58, 0.24], windowBase: 0.14, windowRange: 0.8, windowEmit: 0.22,
  upperGlass: [0.12, 0.08, 0.36], upperLevel: 0.5,
  // Neon tubes and their local spill on the facade.
  magenta: [1.0, 0.2, 0.85], cyan: [0.15, 0.95, 1.0],
  signTube: 1.0, pipeTube: 0.95, pipeTop: 60,
  spillRadius: 10, spill: 0.55, signSpillRadius: 9, signSpill: 0.5,
  // Pavement: limited pools under each light; road: irregular clusters of short horizontal strokes.
  pool: 0.85, poolRows: 0.75, road: 1.1, roadBand: 0.6, roadRowGate: 0.4, roadSeed: 7,
};

// Deterministic noise in [0, 1) from integer coordinates, for the broken road reflections.
function hash(x, y, s = 0) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// `geometry`: { floorRow, kerbRow, groundFloorTop, signBox, doorBox, pipes, pipeColours, coolZones }
// (boxes are half-open [x0, y0, x1, y1] in art pixels).
export function relightStreet(img, geometry, params = {}) {
  const P = { ...STREET_DEFAULTS, ...params };
  const { w, h } = img;
  const src = planes(img);
  const n = src.n;
  const out = { r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n) };
  const floorRow = geometry.floorRow, kerbRow = geometry.kerbRow;
  const inBox = (x, y, b) => x >= b[0] && x < b[2] && y >= b[1] && y < b[3];
  const nightL = lum(...P.night); const night = P.night.map((c) => c / nightL);
  const paveL = lum(...P.pavementTint); const pave = P.pavementTint.map((c) => c / paveL);
  // Emission planes feed the facade spill, the pavement pools and the road reflections; they
  // hold only true light sources (tubes, lamp cores, the lit door and ground-floor panes).
  const emit = new Float32Array(n), eR = new Float32Array(n), eG = new Float32Array(n), eB = new Float32Array(n);
  const lamp = new Float32Array(n), tube = new Float32Array(n);
  const setEmit = (i, m, c) => { if (m > emit[i]) { emit[i] = m; eR[i] = c[0]; eG[i] = c[1]; eB[i] = c[2]; } };
  const WARM = [1.0, 0.72, 0.4];

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const r = src.r[i], g = src.g[i], b = src.b[i];
    const [hue, sat, val] = hsv(r, g, b);
    const L = lum(r, g, b);
    if (inBox(x, y, geometry.signBox)) {
      // The sign face stays dark; lettering is kept warm and readable; the roundel keeps its red.
      const isLetter = val > 0.7 && sat < 0.4;
      const isLogo = (hue >= 335 || hue <= 15) && sat > 0.45 && val > 0.35;
      if (isLetter) { out.r[i] = r * P.signLetter[0]; out.g[i] = g * P.signLetter[1]; out.b[i] = b * P.signLetter[2]; }
      else if (isLogo) { out.r[i] = r; out.g[i] = g; out.b[i] = b; }
      else { out.r[i] = r * P.signFace * 0.9; out.g[i] = g * P.signFace * 0.85; out.b[i] = b * P.signFace; }
      continue;
    }
    const inCool = (geometry.coolZones || []).some(([cx0, cx1]) => x >= cx0 && x < cx1);
    // Lamp glass only: saturated yellow and very bright. Pale cream (the painted lamp cones on the
    // wall, curtains, sills) is ordinary material and goes through the night grade.
    const isLampCore = !inCool && val > 0.9 && sat >= 0.28 && sat < 0.7 && hue >= 30 && hue <= 58;
    if (isLampCore) {
      out.r[i] = r * P.lampKeep; out.g[i] = g * P.lampKeep; out.b[i] = b * P.lampKeep;
      lamp[i] = 1; setEmit(i, 1, [r, g, b]);
      continue;
    }
    const isGlass = hue >= 180 && hue <= 250 && sat > 0.14 && val > 0.33 && y < floorRow;
    if (isGlass) {
      if (y >= geometry.groundFloorTop) {
        const t = P.windowBase + P.windowRange * L;              // the pane keeps its own shading
        out.r[i] = P.windowGlass[0] * t; out.g[i] = P.windowGlass[1] * t; out.b[i] = P.windowGlass[2] * t;
        setEmit(i, P.windowEmit, P.windowGlass);
      } else {
        const t = 0.4 + 0.6 * L;
        out.r[i] = P.upperGlass[0] * P.upperLevel * t; out.g[i] = P.upperGlass[1] * P.upperLevel * t; out.b[i] = P.upperGlass[2] * P.upperLevel * t;
      }
      continue;
    }
    const isRedText = (hue >= 340 || hue <= 8) && sat > 0.5 && val > 0.45;   // PIZZERIA SÖDER lettering
    // Timber, awning, lamp housings: strongly saturated. The pale painted lamp cones on the wall
    // (saturation about 0.45, value 0.9) are ordinary material and take the night grade.
    const isWarm = !inCool && ((hue >= 8 && hue <= 62 && sat > 0.6 && val > 0.45) || isRedText);
    if (isWarm) {
      // Lit warm material: the door, the awning, tables, lamp housings. Lit, but only the door emits.
      const k = P.warmKeep;
      out.r[i] = r * k; out.g[i] = g * k; out.b[i] = b * k * 0.9;
      if (inBox(x, y, geometry.doorBox)) setEmit(i, P.doorEmit, WARM);
      continue;
    }
    // Unlit surface: dark night grade that keeps the material's own shading and a trace of its hue.
    let Lp = P.base + P.gain * Math.pow(L, P.gamma);
    let tint = night;
    if (y < floorRow) {
      const t = y / floorRow; Lp *= 1 - P.skyFade * (1 - t) * (1 - t);
      // Soft knee: pale material (painted lamp cones, cream trim) must not read as a lit patch.
      if (Lp > P.facadeKnee) Lp = P.facadeKnee + (Lp - P.facadeKnee) * P.facadeKneeSlope;
    } else { Lp *= P.pavementLift; tint = pave; if (y >= kerbRow) Lp *= P.roadLevel; }
    const mx = Math.max(r, g, b) || 1;
    const hr = r / mx, hg = g / mx, hb = b / mx; const hl = lum(hr, hg, hb) || 1;
    const k = P.keepHue;
    out.r[i] = Lp * ((1 - k) * tint[0] + k * hr / hl);
    out.g[i] = Lp * ((1 - k) * tint[1] + k * hg / hl);
    out.b[i] = Lp * ((1 - k) * tint[2] + k * hb / hl);
  }

  // Neon tubes: a ring just outside the sign box, and the drainpipes at the building joints.
  const [sx0, sy0, sx1, sy1] = geometry.signBox;
  const tR = new Float32Array(n), tG = new Float32Array(n), tB = new Float32Array(n);
  const paintTube = (x0, y0, x1, y1, colour, gain) => {
    for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
      const i = y * w + x; if (gain <= tube[i]) continue; tube[i] = gain; tR[i] = colour[0]; tG[i] = colour[1]; tB[i] = colour[2];
    }
  };
  paintTube(sx0 - 3, sy0 - 3, sx1 + 3, sy0 - 1, P.magenta, P.signTube);
  paintTube(sx0 - 3, sy1 + 1, sx1 + 3, sy1 + 3, P.magenta, P.signTube);
  paintTube(sx0 - 3, sy0 - 3, sx0 - 1, sy1 + 3, P.magenta, P.signTube);
  paintTube(sx1 + 1, sy0 - 3, sx1 + 3, sy1 + 3, P.magenta, P.signTube);
  (geometry.pipes || []).forEach(([x0, x1], idx) => {
    const name = geometry.pipeColours && geometry.pipeColours[idx];
    const colour = name === 'magenta' ? P.magenta : name === 'cyan' ? P.cyan : (idx % 2 ? P.magenta : P.cyan);
    const cx = Math.round((x0 + x1) / 2);
    for (let y = P.pipeTop; y < floorRow; y++) paintTube(cx - 1, y, cx + 2, y + 1, colour, P.pipeTube * Math.min(1, (y - P.pipeTop) / 40));
  });
  // Short horizontal strips attached to the shopfronts (under an awning, along a sign edge, above a window).
  for (const s of geometry.neonStrips || []) {
    const [x0, y0, x1, y1] = s.box;
    paintTube(x0, y0, x1, y1, s.colour === 'cyan' ? P.cyan : P.magenta, P.stripTube);
  }
  const signRing = new Float32Array(n), pipeTubes = new Float32Array(n);
  for (let i = 0; i < n; i++) if (tube[i] > 0) {
    const t = tube[i], x = i % w;
    out.r[i] = Math.max(out.r[i], t * (0.12 + 0.8 * tR[i])); out.g[i] = Math.max(out.g[i], t * (0.12 + 0.8 * tG[i])); out.b[i] = Math.max(out.b[i], t * (0.12 + 0.8 * tB[i]));
    setEmit(i, t, [tR[i], tG[i], tB[i]]);
    if (x >= sx0 - 3 && x < sx1 + 3 && (i / w | 0) >= sy0 - 3 && (i / w | 0) < sy1 + 3) signRing[i] = t; else pipeTubes[i] = t;
  }

  // Local spill on the facade: a short-radius glow from each tube and a tiny bloom from lamp cores,
  // never onto the sign face and never onto the ground (the ground gets its own treatment below).
  const glowOf = (mask, colR, colG, colB, radius) => {
    const mr = new Float32Array(n), mg = new Float32Array(n), mb = new Float32Array(n);
    for (let i = 0; i < n; i++) { const m = mask[i]; if (m) { mr[i] = m * colR[i]; mg[i] = m * colG[i]; mb[i] = m * colB[i]; } }
    const k = (2 * radius + 1) / 3;
    const s = (p) => { for (let i = 0; i < n; i++) p[i] *= k; return p; };
    return { r: s(blur(mr, w, h, radius)), g: s(blur(mg, w, h, radius)), b: s(blur(mb, w, h, radius)) };
  };
  // Shopfront strips get a wider, stronger spill than the sign ring: they are meant to bathe their
  // own shopfront in colour, with dark sections between shops.
  const stripMask = new Float32Array(n), pipeMask = new Float32Array(n);
  for (let i = 0; i < n; i++) if (pipeTubes[i] > 0) { const x = i % w, y = (i / w) | 0; const inStrip = (geometry.neonStrips || []).some((s) => inBox(x, y, s.box)); if (inStrip) stripMask[i] = pipeTubes[i]; else pipeMask[i] = pipeTubes[i]; }
  const pipeSpill = glowOf(pipeMask, tR, tG, tB, P.spillRadius);
  const stripSpill = glowOf(stripMask, tR, tG, tB, P.stripSpillRadius);
  const signSpill = glowOf(signRing, tR, tG, tB, P.signSpillRadius);
  const lampBloom = glowOf(lamp, eR, eG, eB, P.lampBloomRadius);
  for (let y = 0; y < floorRow; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (inBox(x, y, geometry.signBox) || tube[i] > 0) continue;
    const tex = 0.7 + 0.6 * lum(src.r[i], src.g[i], src.b[i]);      // lighter stone catches more light
    out.r[i] += (pipeSpill.r[i] * P.spill + stripSpill.r[i] * P.stripSpill + signSpill.r[i] * P.signSpill) * tex + lampBloom.r[i] * P.lampBloom;
    out.g[i] += (pipeSpill.g[i] * P.spill + stripSpill.g[i] * P.stripSpill + signSpill.g[i] * P.signSpill) * tex + lampBloom.g[i] * P.lampBloom;
    out.b[i] += (pipeSpill.b[i] * P.spill + stripSpill.b[i] * P.stripSpill + signSpill.b[i] * P.signSpill) * tex + lampBloom.b[i] * P.lampBloom;
  }

  // Light sources along the street: clusters of emitting columns, each with a colour, a strength
  // and a width. Low sources (near the ground) count more than high ones.
  const colS = new Float32Array(w), colR = new Float32Array(w), colG = new Float32Array(w), colB = new Float32Array(w);
  let peak = 0;
  for (let x = 0; x < w; x++) {
    let s = 0, r = 0, g = 0, b = 0;
    for (let y = 40; y < floorRow; y++) { const i = y * w + x; const m = emit[i]; if (!m) continue; const wgt = m * (0.3 + 0.7 * y / floorRow) * (tube[i] > 0 ? P.tubeWeight : 1); s += wgt; r += wgt * eR[i]; g += wgt * eG[i]; b += wgt * eB[i]; }
    colS[x] = s; if (s > 0) { colR[x] = r / s; colG[x] = g / s; colB[x] = b / s; } peak = Math.max(peak, s);
  }
  const sources = [];
  for (let x = 0; x <= w; x++) {
    const on = x < w && colS[x] > 0.03 * peak;
    if (on && (sources.length === 0 || sources[sources.length - 1].closed)) sources.push({ x0: x, x1: x, s: 0, r: 0, g: 0, b: 0, closed: false });
    if (on) { const c = sources[sources.length - 1]; c.x1 = x; c.s += colS[x]; c.r += colS[x] * colR[x]; c.g += colS[x] * colG[x]; c.b += colS[x] * colB[x]; }
    else if (sources.length && !sources[sources.length - 1].closed) sources[sources.length - 1].closed = true;
  }
  for (const c of sources) { c.r /= c.s; c.g /= c.s; c.b /= c.s; c.cx = (c.x0 + c.x1) / 2; c.width = c.x1 - c.x0 + 1; c.strength = Math.min(1, c.s / (peak * 6)); }

  // Pavement: a limited pool under each source, following the slab texture.
  const poolH = (kerbRow - floorRow) * P.poolRows;
  for (const c of sources) {
    const rx = Math.max(16, c.width * 0.7 + 10), ry = poolH, cy = floorRow + 6;
    for (let y = floorRow; y < kerbRow; y++) for (let x = Math.max(0, c.cx - rx) | 0; x < Math.min(w, c.cx + rx); x++) {
      const d = ((x - c.cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d > 1) continue;
      const i = y * w + x;
      const tex = clamp01(0.35 + 1.4 * (lum(src.r[i], src.g[i], src.b[i]) - 0.5));
      const m = P.pool * c.strength * (1 - d) * (1 - d) * tex;
      out.r[i] += m * c.r; out.g[i] += m * c.g; out.b[i] += m * c.b;
    }
  }

  // Road: broken, mostly horizontal pixel reflections anchored under each source. Rows are gated by
  // deterministic noise so there are dark gaps; dashes vary in length, offset and intensity and
  // spread a little with depth.
  // Strokes come in clusters: a slow noise over bands of rows switches whole bands off, rows inside an
  // active band are gated again, strokes are 1 or 2 rows thick, and width, offset and intensity all
  // vary, so nothing lines up into a ladder.
  for (let si = 0; si < sources.length; si++) {
    const c = sources[si];
    const reach = Math.max(10, c.width * 0.6);
    for (let y = kerbRow; y < h; y++) {
      const depth = (y - kerbRow) / (h - kerbRow);
      const band = Math.floor((y - kerbRow) / (5 + Math.floor(hash(si, 0, P.roadSeed + 8) * 5)));
      if (hash(si, band, P.roadSeed + 9) > P.roadBand) continue;                // whole band dark
      if (hash(si, y, P.roadSeed) > P.roadRowGate) continue;                   // dark row inside the band
      const thick = hash(si, y, P.roadSeed + 5) < 0.3 ? 2 : 1;
      const dashes = 1 + Math.floor(hash(si, y, P.roadSeed + 1) * 3);
      for (let k = 0; k < dashes; k++) {
        const len = 2 + Math.floor(hash(si + 11 * k, y, P.roadSeed + 2) ** 1.5 * (8 + reach));
        const off = (hash(si + 7 * k, y, P.roadSeed + 3) - 0.5) * (reach + 36 * depth);
        const amp = P.road * c.strength * (1 - 0.55 * depth) * (0.3 + 0.7 * hash(si + 3 * k, y, P.roadSeed + 4));
        const x0 = Math.round(c.cx + off - len / 2);
        for (let yy = y; yy < Math.min(h, y + thick); yy++) for (let x = Math.max(0, x0); x < Math.min(w, x0 + len); x++) {
          const i = yy * w + x;
          const tex = 0.6 + 0.8 * lum(src.r[i], src.g[i], src.b[i]);
          const edge = 1 - Math.abs((x - x0) / len - 0.5) * 0.8;
          out.r[i] += amp * tex * edge * c.r; out.g[i] += amp * tex * edge * c.g; out.b[i] += amp * tex * edge * c.b;
        }
      }
      if (thick === 2) y++;
    }
  }
  return pack(w, h, out.r, out.g, out.b);
}

export const DOJO_DEFAULTS = {
  // Albedo per material under white light, 0..1.
  wall: [0.52, 0.46, 0.66], wallTop: 1.0, wallBottom: 0.68, wallMottle: 0.1, wallGrain: 0.045,
  letters: 0.85, brush: [0.72, 0.12, 0.17],
  pillar: [0.86, 0.26, 0.36], ivory: [0.84, 0.78, 0.66], pillarRound: 0.42, pillarEdge: 0.6,
  mat: [0.41, 0.49, 0.37], band: [0.44, 0.14, 0.2],
  matEmboss: 0.06, matBlotch: 0.11, matGrain: 0.05, matCellVary: 0.07, seamDark: 0.8, seamLight: 1.08, seamPeriod: 64, wearChance: 0.45, wear: 1.16,
  wallPaletteShare: 0.012,
  bandGrain: 0.04, bandEdge: 0.8,
  wood: [0.68, 0.43, 0.22], woodShadeRef: 0.5, banner: [0.84, 0.76, 0.6], other: 0.9,
  // Light.
  ambient: [0.23, 0.19, 0.4], junctionDrop: 0.3, ceilingDrop: 0.35, floorAmbient: 1.08, floorTint: [1.0, 1.25, 1.0], floorFall: 0.3,
  neutral: [0.92, 0.94, 1.0], warm: [1.0, 0.6, 0.2],
  wallGain: 0.5, wallSx: 120, wallSy: 130, warmWallGain: 2.3, warmWallSx: 140,
  poolGain: 0.5, poolRx: 260, poolRy: 120, poolDrop: 30, warmPoolGain: 0.7,
  // Shadows.
  wallBase: 0.45, wallBaseRows: 5, contact: 0.55, contactRows: 10, objectShadow: 0.5,
  seed: 3,
};

export function findPillars(img, { y0 = 40, y1 = 240, minRun = 80 } = {}) {
  const { w } = img;
  const counts = new Array(w).fill(0);
  for (let x = 0; x < w; x++) for (let y = y0; y < y1; y++) {
    const i = (y * w + x) * 4; const r = img.data[i] / 255, g = img.data[i + 1] / 255, b = img.data[i + 2] / 255;
    const [h, s, v] = hsv(r, g, b);
    if ((h <= 20 || h >= 345) && s > 0.5 && v > 0.4) counts[x]++;
  }
  const runs = []; let start = -1;
  for (let x = 0; x <= w; x++) {
    const on = x < w && counts[x] >= minRun;
    if (on && start < 0) start = x;
    if (!on && start >= 0) { if (x - start >= 8) runs.push([start, x - 1]); start = -1; }
  }
  return runs;
}

// `geometry`: { floorRow, tubes: [{x0,x1,y0,y1,warm}], lettersBox, haloBox, bannerBox, pillars?,
//               matBorderRows: [[y0,y1],...], matBorderCols: [[x0,x1],...] }
export function relightDojo(img, geometry, params = {}) {
  const P = { ...DOJO_DEFAULTS, ...params };
  const { w, h } = img;
  const src = planes(img);
  const n = src.n;
  const floorRow = geometry.floorRow;
  const inBox = (x, y, b) => b && x >= b[0] && x < b[2] && y >= b[1] && y < b[3];
  const pillars = geometry.pillars || findPillars(img);
  const pillarOf = (x) => pillars.find(([a, b]) => x >= a - 1 && x <= b + 1);
  const rows = geometry.matBorderRows || [], cols = geometry.matBorderCols || [];
  const inBorderRow = (y) => rows.some(([a, b]) => y >= a && y <= b);
  const inBorderCol = (x) => cols.some(([a, b]) => x >= a && x <= b);
  const hashf = (x, y, s) => { let v = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0; v = Math.imul(v ^ (v >>> 13), 1274126177) | 0; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
  // Mat cells: the rectangles between border rows and border columns.
  const cellRows = []; for (let i = 0; i + 1 < rows.length; i++) cellRows.push([rows[i][1] + 1, rows[i + 1][0] - 1]);
  const cellCols = []; for (let i = 0; i + 1 < cols.length; i++) cellCols.push([cols[i][1] + 1, cols[i + 1][0] - 1]);
  if (cols.length && cols[cols.length - 1][1] < w - 1) cellCols.push([cols[cols.length - 1][1] + 1, w - 1]);
  const cellOf = (x, y) => { const r = cellRows.findIndex(([a, b]) => y >= a && y <= b); const c = cellCols.findIndex(([a, b]) => x >= a && x <= b); return r < 0 || c < 0 ? null : { r, c, y0: cellRows[r][0], y1: cellRows[r][1], x0: cellCols[c][0], x1: cellCols[c][1] }; };
  // Low-frequency mottling planes (blurred noise) for plaster and mats.
  const noise = new Float32Array(n); for (let i = 0; i < n; i++) noise[i] = hashf(i % w, (i / w) | 0, P.seed + 7) - 0.5;
  const mottle = blur(noise, w, h, 5, 2);
  let mmax = 0; for (let i = 0; i < n; i++) mmax = Math.max(mmax, Math.abs(mottle[i])); for (let i = 0; i < n; i++) mottle[i] /= mmax || 1;

  // Wall colours: the source wall is a few large flat colours, so the exact colours that cover more
  // than wallPaletteShare of the wall band are plaster; everything else up there is an object.
  const counts = new Map(); let wallPx = 0;
  for (let y = 24; y < floorRow; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const k = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]; counts.set(k, (counts.get(k) || 0) + 1); wallPx++; }
  const palette = new Set([...counts.entries()].filter(([, c]) => c > P.wallPaletteShare * wallPx).map(([k]) => k));
  // The exit sign: the teal plate and its cream face stay emissive; the pale glow painted around it
  // becomes plaster like the emblem halo.
  let ex0 = 1e9, ey0 = 1e9, ex1 = -1, ey1 = -1;
  for (let y = 24; y < floorRow; y++) for (let x = 0; x < w; x++) { const i = y * w + x; const [hh, ss, vv] = hsv(src.r[i], src.g[i], src.b[i]); if (hh >= 165 && hh <= 200 && ss > 0.5 && vv > 0.4) { ex0 = Math.min(ex0, x); ey0 = Math.min(ey0, y); ex1 = Math.max(ex1, x); ey1 = Math.max(ey1, y); } }
  const exitBox = ex1 < 0 ? null : [ex0 - 1, ey0 - 1, ex1 + 2, ey1 + 2];
  const exitGlow = ex1 < 0 ? null : [ex0 - 16, ey0 - 14, ex1 + 17, ey1 + 15];
  // 1. Albedo, emissive and object masks.
  const aR = new Float32Array(n), aG = new Float32Array(n), aB = new Float32Array(n), emis = new Uint8Array(n), obj = new Uint8Array(n), isWall = new Uint8Array(n);
  const wallShade = (y) => { const t = Math.min(1, Math.max(0, (y - 120) / (floorRow - 120))); return P.wallTop + (P.wallBottom - P.wallTop) * t * t; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const r = src.r[i], g = src.g[i], b = src.b[i];
    const [hue, sat, val] = hsv(r, g, b);
    const L = lum(r, g, b);
    const set = (c, shade = 1) => { aR[i] = c[0] * shade; aG[i] = c[1] * shade; aB[i] = c[2] * shade; };
    const shadeOf = (ref) => Math.min(1.35, Math.max(0.55, L / ref));
    const isTube = y < 24 && val > 0.86 && sat < 0.3;
    const isExit = inBox(x, y, exitBox) && val > 0.3;
    if (isTube || isExit) { set([r, g, b]); emis[i] = 1; if (isExit) obj[i] = 1; continue; }
    if (inBox(x, y, exitGlow) && y >= 24) { const s = wallShade(y) * (1 + P.wallMottle * mottle[i] + P.wallGrain * (hashf(x, y, P.seed + 1) - 0.5) * 2); set(P.wall, s); isWall[i] = 1; continue; }
    const red = (hue <= 20 || hue >= 345) && sat > 0.5 && val > 0.35;
    if (y >= floorRow) {
      // The floor is drawn from the grid, not from the source: mats, bands, seams and wear.
      const onBand = inBorderRow(y) || inBorderCol(x);
      if (onBand) {
        let s = 1 + P.bandGrain * (hashf(x, y, P.seed + 2) - 0.5) * 2;
        const nearMat = (!inBorderRow(y - 1) && !inBorderCol(x) && y > floorRow) || (!inBorderRow(y + 1) && !inBorderCol(x)) || (!inBorderCol(x - 1) && !inBorderRow(y)) || (!inBorderCol(x + 1) && !inBorderRow(y));
        if (nearMat) s *= P.bandEdge;
        set(P.band, s); continue;
      }
      const cell = cellOf(x, y);
      let s = 1;
      const d1 = (x + y) & 3, d2 = (x - y) & 3;                                                // embossed cross-hatch
      s += P.matEmboss * ((d1 === 0 ? 1 : d1 === 2 ? -0.7 : 0) + (d2 === 0 ? 0.6 : d2 === 2 ? -0.4 : 0));
      s += P.matBlotch * mottle[i];                                                            // worn variation
      s += P.matGrain * (hashf(x, y, P.seed + 3) - 0.5) * 2;
      if (cell) {
        s *= 1 + P.matCellVary * (hashf(cell.r * 31, cell.c * 17, P.seed + 9) - 0.5) * 2;        // each mat its own tone
        const dL = x - cell.x0, dR = cell.x1 - x, dT = y - cell.y0, dB = cell.y1 - y;
        const edge = Math.min(dL, dR, dT, dB);
        if (edge === 0) s *= P.seamDark; else if (edge === 1) s *= P.seamLight;                 // rim and bevel
        const period = P.seamPeriod + Math.floor(hashf(cell.r, cell.c, P.seed + 4) * 24);
        const off = Math.floor(hashf(cell.c, cell.r, P.seed + 5) * period);
        if (dL > 4 && dR > 4 && ((dL + off) % period) === 0) s *= 0.9;                           // panel seam
        if (dL > 4 && dR > 4 && ((dL + off) % period) === 1) s *= 1.04;
        const mid = Math.floor((cell.y0 + cell.y1) / 2);
        if (y === mid && dL > 2 && dR > 2) s *= 0.9; else if (y === mid + 1 && dL > 2 && dR > 2) s *= 1.04;
        const wearSide = hashf(cell.r * 7, cell.c * 13, P.seed + 6);
        if (wearSide < P.wearChance) {                                                           // compressed, lighter edge on one side
          const side = Math.floor(wearSide / P.wearChance * 4); const d = [dT, dB, dL, dR][side];
          if (d >= 1 && d <= 3 && hashf(x, y, P.seed + 8) < 0.55 - d * 0.12) s *= P.wear;
        }
      }
      set(P.mat, s); continue;
    }
    const pil = y >= 30 ? pillarOf(x) : null;
    if (pil) {
      const [a, b] = pil; const half = (b - a) / 2 || 1; const t = Math.max(-1, Math.min(1, (x - (a + half * 0.8)) / (half * 1.15)));
      const round = (1 - P.pillarRound) + P.pillarRound * Math.sqrt(Math.max(0, 1 - t * t));
      const edge = (x <= a || x >= b) ? P.pillarEdge : 1;
      if (sat < 0.3 && val > 0.65) { set(P.ivory, round * edge * shadeOf(0.72) ** 0.4); obj[i] = 0; continue; }
      if (red) { set(P.pillar, round * edge); continue; }
    }
    if (inBox(x, y, geometry.lettersBox) && hue >= 195 && hue <= 265 && val < 0.3) { set([r * P.letters, g * P.letters, b * P.letters]); continue; }
    if (inBox(x, y, geometry.haloBox)) {
      // Inside the halo panel only the brush stroke survives; the painted peach gradient and the
      // panel's own shading become continuous plaster, lit by the fixture instead.
      if ((hue <= 9 || hue >= 345) && sat > 0.6 && val > 0.35) { set(P.brush, shadeOf(0.5)); continue; }
      const s = wallShade(y) * (1 + P.wallMottle * mottle[i] + P.wallGrain * (hashf(x, y, P.seed + 1) - 0.5) * 2);
      set(P.wall, s); isWall[i] = 1; continue;
    }
    const peach = hue >= 12 && hue <= 48 && sat > 0.22 && val > 0.7;
    if (inBox(x, y, geometry.bannerBox) && (peach || (sat < 0.3 && val > 0.6))) { set(P.banner, shadeOf(0.72)); obj[i] = 1; continue; }
    const wood = hue >= 18 && hue <= 45 && sat > 0.45 && val > 0.3 && val < 0.85;
    if (wood) { set(P.wood, shadeOf(P.woodShadeRef)); obj[i] = 1; continue; }
    if (red) { set(P.pillar, shadeOf(0.5)); obj[i] = 1; continue; }
    const key = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
    const wallLike = palette.has(key) || peach;      // painted light pools on the wall are plaster too
    if (wallLike && y >= 24) {
      // Continuous plaster: a smooth vertical gradient plus mottling and grain, independent of the
      // source's flat colour bands (which also removes the halo panel and the step below it).
      const s = wallShade(y) * (1 + P.wallMottle * mottle[i] + P.wallGrain * (hashf(x, y, P.seed + 1) - 0.5) * 2);
      set(P.wall, s); isWall[i] = 1; continue;
    }
    set([r * P.other, g * P.other, b * P.other]); if (y >= 24) obj[i] = 1;
  }

  // 2. Light: indigo ambient with falloff, fixture cones on the wall, continuous pools on the floor.
  const lR = new Float32Array(n), lG = new Float32Array(n), lB = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    let amb = 1; const tint = y >= floorRow ? P.floorTint : [1, 1, 1];
    if (y < floorRow) { const d = (floorRow - y) / floorRow; amb *= 1 - P.junctionDrop * Math.max(0, 1 - d * 3); amb *= 1 - P.ceilingDrop * Math.max(0, 1 - y / 40); }
    else amb *= P.floorAmbient * (1 - P.floorFall * (y - floorRow) / (h - floorRow));
    for (let x = 0; x < w; x++) { const i = y * w + x; lR[i] = P.ambient[0] * amb * tint[0]; lG[i] = P.ambient[1] * amb * tint[1]; lB[i] = P.ambient[2] * amb * tint[2]; }
  }
  for (const t of geometry.tubes) {
    const c = t.warm ? P.warm : P.neutral;
    const cx = (t.x0 + t.x1) / 2, sx = t.warm ? P.warmWallSx : P.wallSx, gain = t.warm ? P.warmWallGain : P.wallGain;
    for (let y = t.y1; y < floorRow; y++) {
      const fy = Math.exp(-(((y - t.y1) / P.wallSy) ** 2));
      for (let x = 0; x < w; x++) { const fx = Math.exp(-(((x - cx) / sx) ** 2)); const I = gain * fx * fy; if (I < 0.004) continue; const i = y * w + x; lR[i] += I * c[0]; lG[i] += I * c[1]; lB[i] += I * c[2]; }
    }
    const pg = t.warm ? P.warmPoolGain : P.poolGain, cy = floorRow + P.poolDrop;
    for (let y = floorRow; y < h; y++) for (let x = 0; x < w; x++) {
      const d = ((x - cx) / P.poolRx) ** 2 + ((y - cy) / P.poolRy) ** 2; const I = pg * Math.exp(-d * 1.4); if (I < 0.004) continue;
      const i = y * w + x; lR[i] += I * c[0]; lG[i] += I * c[1]; lB[i] += I * c[2];
    }
  }

  // 3. Shadows: cool wall-base shadow on the floor, pillar bases and feet, drop shadows under wall objects.
  const shade = new Float32Array(n).fill(1);
  for (let y = floorRow; y < floorRow + P.wallBaseRows * 3; y++) { const k = P.wallBase * Math.exp(-(y - floorRow) / P.wallBaseRows); for (let x = 0; x < w; x++) shade[y * w + x] *= 1 - k; }
  for (const [a, b] of pillars) {
    for (let y = floorRow; y < floorRow + P.contactRows; y++) for (let x = a - 12; x <= b + 12; x++) {
      if (x < 0 || x >= w) continue; const dx = x < a ? a - x : x > b ? x - b : 0;
      shade[y * w + x] *= 1 - Math.exp(-(y - floorRow) / 4) * Math.exp(-dx / 6) * P.contact;
    }
    for (let y = floorRow - 36; y < floorRow; y++) for (let x = a - 9; x <= b + 9; x++) {
      if (x < 0 || x >= w || (x >= a && x <= b)) continue; const dx = x < a ? a - x : x - b;
      shade[y * w + x] *= 1 - Math.exp(-dx / 4) * (1 - (floorRow - y) / 36) * P.contact * 0.5;
    }
  }
  for (let y = 24; y < floorRow; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!isWall[i]) continue;
    let s = 0;
    for (let dy = 1; dy <= 5; dy++) for (let dx = 0; dx <= 2; dx++) { const xx = x - dx, yy = y - dy; if (xx < 0 || yy < 0) continue; if (obj[yy * w + xx]) s = Math.max(s, (1 - dy / 6) * (1 - dx / 4)); }
    if (s > 0) shade[i] *= 1 - P.objectShadow * s;
  }

  // 4. Compose.
  const out = { r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    if (emis[i]) { out.r[i] = aR[i]; out.g[i] = aG[i]; out.b[i] = aB[i]; continue; }
    out.r[i] = aR[i] * lR[i] * shade[i]; out.g[i] = aG[i] * lG[i] * shade[i]; out.b[i] = aB[i] * lB[i] * shade[i];
  }
  return pack(w, h, out.r, out.g, out.b);
}
