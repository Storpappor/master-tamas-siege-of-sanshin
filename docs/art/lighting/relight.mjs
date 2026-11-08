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
  // Surface grade: L' = base + gain * L^gamma, then tinted toward the night colour.
  base: 0.02, gain: 0.26, gamma: 2.3,
  night: [0.30, 0.16, 1.0],      // navy/purple tint of unlit surfaces (normalised internally)
  keepHue: 0.18,                 // how much of the original hue survives on unlit surfaces
  skyFade: 0.45,                 // the upper floors fall away into the dark (0 = no falloff)
  pavementLift: 1.2, pavementTint: [0.62, 0.3, 1.0], // the pavement takes a purple cast
  roadLevel: 0.75,               // the road is darker than the pavement
  wash: 0.11, washRadius: 70,    // broad coloured wash each tube throws over its facade
  warmKeep: 1.05, warmSat: 1.2,  // warm light sources (lamps, door, lit interiors)
  windowGlass: [1.0, 0.56, 0.22], windowLevel: 0.72, // ground-floor glass becomes amber-lit
  upperGlass: [0.12, 0.08, 0.36], upperLevel: 0.5,    // upper-floor glass stays dark and cool
  magenta: [1.0, 0.2, 0.85], cyan: [0.15, 0.95, 1.0],
  signTube: 1.0, signGlow: 0.45, signGlowRadius: 22,
  pipeTube: 0.95, pipeGlow: 0.32, pipeGlowRadius: 30, pipeTop: 60,
  bloomNear: 0.3, bloomFar: 0.08, bloomFarRadius: 36,
  reflect: 1.6, reflectBlur: 10, reflectRows: [244, 360], reflectPavement: 0.5,
  wetContrast: 0.9,
};

// `geometry`: { floorRow, signBox: [x0, y0, x1, y1] (half-open), doorBox, groundFloorTop, pipes? }
export function relightStreet(img, geometry, params = {}) {
  const P = { ...STREET_DEFAULTS, ...params };
  const { w, h } = img;
  const src = planes(img);
  const n = src.n;
  const out = { r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n) };
  const warm = new Float32Array(n), lightMask = new Float32Array(n), lightR = new Float32Array(n), lightG = new Float32Array(n), lightB = new Float32Array(n);
  const nightL = lum(...P.night); const night = P.night.map((c) => c / nightL);
  const floorRow = geometry.floorRow;
  const [sx0, sy0, sx1, sy1] = geometry.signBox;

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const r = src.r[i], g = src.g[i], b = src.b[i];
    const [hue, sat, val] = hsv(r, g, b);
    const L = lum(r, g, b);
    const inSign = x >= sx0 && x < sx1 && y >= sy0 && y < sy1;
    const isWhite = val > 0.9 && sat < 0.14;                               // sign letters, lamp cores
    // Lamps, door timber, lit interiors. Inside a "cool zone" (the pale yellow building) only the
    // brightest cores count, so a yellow wall does not become a light source.
    const inCool = (geometry.coolZones || []).some(([cx0, cx1]) => x >= cx0 && x < cx1);
    const isWarm = hue >= 8 && hue <= 62 && sat > 0.32 && val > (inCool ? 0.97 : 0.5);
    const isGlass = hue >= 180 && hue <= 250 && sat > 0.14 && val > 0.33 && y < floorRow; // window glass
    if (isWhite && inSign) {                                               // keep the lettering crisp
      out.r[i] = r; out.g[i] = g; out.b[i] = b; lightMask[i] = 1; lightR[i] = r; lightG[i] = g; lightB[i] = b; continue;
    }
    if (isWarm) {
      const k = P.warmKeep; const m = (r + g + b) / 3;
      out.r[i] = (m + (r - m) * P.warmSat) * k; out.g[i] = (m + (g - m) * P.warmSat) * k; out.b[i] = (m + (b - m) * P.warmSat) * k;
      warm[i] = clamp01((val - 0.5) * 2.2);
      lightMask[i] = warm[i] * 0.8; lightR[i] = out.r[i]; lightG[i] = out.g[i]; lightB[i] = out.b[i];
      continue;
    }
    if (isGlass) {
      const t = 0.55 + 0.45 * L;                                            // keep the pane's own shading
      const c = y >= geometry.groundFloorTop ? P.windowGlass : P.upperGlass;
      const level = y >= geometry.groundFloorTop ? P.windowLevel : P.upperLevel;
      out.r[i] = c[0] * level * t; out.g[i] = c[1] * level * t; out.b[i] = c[2] * level * t;
      if (y >= geometry.groundFloorTop) { lightMask[i] = 0.55; lightR[i] = out.r[i]; lightG[i] = out.g[i]; lightB[i] = out.b[i]; }
      continue;
    }
    // Unlit surface: dark night grade with a trace of the original hue, darker toward the roofline.
    let Lp = P.base + P.gain * Math.pow(L, P.gamma);
    if (y < floorRow) { const t = y / floorRow; Lp *= 1 - P.skyFade * (1 - t) * (1 - t); }
    let tint = night;
    if (y >= floorRow) {
      Lp *= P.pavementLift;
      if (y >= geometry.kerbRow) Lp *= P.roadLevel;
      const pl = lum(...P.pavementTint); tint = P.pavementTint.map((c) => c / pl);
    }
    const mx = Math.max(r, g, b) || 1;
    const hr = r / mx, hg = g / mx, hb = b / mx;                           // original hue, full value
    const hl = lum(hr, hg, hb) || 1;
    const k = P.keepHue;
    out.r[i] = Lp * ((1 - k) * tint[0] + k * hr / hl);
    out.g[i] = Lp * ((1 - k) * tint[1] + k * hg / hl);
    out.b[i] = Lp * ((1 - k) * tint[2] + k * hb / hl);
  }

  // Neon: a magenta tube around the sign, cyan/magenta tubes on the drainpipes.
  const tube = new Float32Array(n), tubeR = new Float32Array(n), tubeG = new Float32Array(n), tubeB = new Float32Array(n);
  const paint = (x0, y0, x1, y1, colour, gain) => {
    for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
      const i = y * w + x; tube[i] = Math.max(tube[i], gain); tubeR[i] = colour[0]; tubeG[i] = colour[1]; tubeB[i] = colour[2];
    }
  };
  paint(sx0 - 3, sy0 - 3, sx1 + 3, sy0 - 1, P.magenta, P.signTube);
  paint(sx0 - 3, sy1 + 1, sx1 + 3, sy1 + 3, P.magenta, P.signTube);
  paint(sx0 - 3, sy0 - 3, sx0 - 1, sy1 + 3, P.magenta, P.signTube);
  paint(sx1 + 1, sy0 - 3, sx1 + 3, sy1 + 3, P.magenta, P.signTube);
  const pipes = geometry.pipes || findPipes(img);
  pipes.forEach(([x0, x1], idx) => {
    const colour = (geometry.pipeColours && geometry.pipeColours[idx]) === 'magenta' ? P.magenta : (geometry.pipeColours && geometry.pipeColours[idx]) === 'cyan' ? P.cyan : (idx % 2 ? P.magenta : P.cyan);
    const cx = Math.round((x0 + x1) / 2);
    const top = geometry.pipeTop ?? P.pipeTop;
    for (let y = top; y < floorRow; y++) {                                 // fades in over the first 40 rows
      const ramp = Math.min(1, (y - top) / 40);
      paint(cx - 1, y, cx + 2, y + 1, colour, P.pipeTube * ramp);
    }
  });
  // Tube cores: a saturated bright core, white only at the very centre.
  for (let i = 0; i < n; i++) if (tube[i] > 0) {
    const t = tube[i];
    out.r[i] = Math.max(out.r[i], t * (0.12 + 0.8 * tubeR[i])); out.g[i] = Math.max(out.g[i], t * (0.12 + 0.8 * tubeG[i])); out.b[i] = Math.max(out.b[i], t * (0.12 + 0.8 * tubeB[i]));
    lightMask[i] = Math.max(lightMask[i], t); lightR[i] = tubeR[i]; lightG[i] = tubeG[i]; lightB[i] = tubeB[i];
  }
  // Blurred, coloured copy of a light mask. A thin source loses amplitude in proportion to the blur
  // width, so the result is scaled by (2r+1)/3: a 3 px tube keeps roughly its own brightness at its
  // centre whatever the radius, and the gains below read as "how bright next to the source".
  const glowOf = (maskPlane, radius) => {
    const mr = new Float32Array(n), mg = new Float32Array(n), mb = new Float32Array(n);
    for (let i = 0; i < n; i++) { const m = maskPlane[i]; mr[i] = m * lightR[i]; mg[i] = m * lightG[i]; mb[i] = m * lightB[i]; }
    const k = (2 * radius + 1) / 3;
    const scale = (p) => { for (let i = 0; i < n; i++) p[i] *= k; return p; };
    return { r: scale(blur(mr, w, h, radius)), g: scale(blur(mg, w, h, radius)), b: scale(blur(mb, w, h, radius)) };
  };
  const signGlow = glowOf(tube.map((t, i) => (Math.abs(i % w - (sx0 + sx1) / 2) < (sx1 - sx0) ? t : 0)), P.signGlowRadius);
  const pipeGlow = glowOf(tube.map((t, i) => (Math.abs(i % w - (sx0 + sx1) / 2) < (sx1 - sx0) ? 0 : t)), P.pipeGlowRadius);
  const wash = glowOf(tube, P.washRadius);                                  // broad neon wash over the facades
  const bloomN = glowOf(lightMask, 6), bloomF = glowOf(lightMask, P.bloomFarRadius);
  for (let i = 0; i < n; i++) {
    out.r[i] += signGlow.r[i] * P.signGlow + pipeGlow.r[i] * P.pipeGlow + wash.r[i] * P.wash + bloomN.r[i] * P.bloomNear + bloomF.r[i] * P.bloomFar;
    out.g[i] += signGlow.g[i] * P.signGlow + pipeGlow.g[i] * P.pipeGlow + wash.g[i] * P.wash + bloomN.g[i] * P.bloomNear + bloomF.g[i] * P.bloomFar;
    out.b[i] += signGlow.b[i] * P.signGlow + pipeGlow.b[i] * P.pipeGlow + wash.b[i] * P.wash + bloomN.b[i] * P.bloomNear + bloomF.b[i] * P.bloomFar;
  }

  // Wet-street reflections: each column collects the coloured light above the floor and smears it
  // down the ground, modulated by the ground's own texture so it reads as puddles, not a gradient.
  const colR = new Float32Array(w), colG = new Float32Array(w), colB = new Float32Array(w);
  let peak = 0;
  for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0;
    for (let y = 40; y < floorRow; y++) { const i = y * w + x; const m = lightMask[i] * (0.4 + 0.6 * y / floorRow); r += m * lightR[i]; g += m * lightG[i]; b += m * lightB[i]; }
    colR[x] = r; colG[x] = g; colB[x] = b; peak = Math.max(peak, lum(r, g, b));
  }
  if (peak > 0) for (let x = 0; x < w; x++) { colR[x] /= peak; colG[x] /= peak; colB[x] /= peak; }
  const smear = (arr, rad) => { const o = new Float32Array(w); for (let x = 0; x < w; x++) { let s = 0, c = 0; for (let k = -rad; k <= rad; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += arr[xx]; c++; } } o[x] = s / c; } return o; };
  const sR = smear(colR, P.reflectBlur), sG = smear(colG, P.reflectBlur), sB = smear(colB, P.reflectBlur);
  const aR = smear(colR, 48), aG = smear(colG, 48), aB = smear(colB, 48);   // broad ambient wash
  const [ry0, ry1] = P.reflectRows;
  for (let y = ry0; y < ry1; y++) {
    const depth = (y - ry0) / (ry1 - ry0);
    const fall = y < geometry.kerbRow ? P.reflectPavement : (0.5 + 0.5 * depth);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const tex = lum(src.r[i], src.g[i], src.b[i]);
      const wet = clamp01(0.3 + P.wetContrast * (tex - 0.42) * 2.2);   // brighter slabs reflect more
      const m = P.reflect * fall;
      out.r[i] += (sR[x] * wet + aR[x] * 0.6) * m; out.g[i] += (sG[x] * wet + aG[x] * 0.6) * m; out.b[i] += (sB[x] * wet + aB[x] * 0.6) * m;
    }
  }
  return pack(w, h, out.r, out.g, out.b);
}

export const DOJO_DEFAULTS = {
  base: 0.02, gain: 0.9, gamma: 1.2,
  shadow: [0.62, 0.52, 1.0], keepHue: 0.8,   // navy/purple shadows with the original hue mostly kept
  greenDesat: 0.2, greenDarken: 0.95,         // mat centres toward sage/grey
  redDesat: 0.15, redDarken: 0.72,            // pillar and mat borders: natural muted reds
  emblemGlow: [1.0, 0.62, 0.3], emblemGain: 0.3, emblemRadius: 56,
  tubeNeutral: [0.9, 0.95, 1.0], tubeWarm: [1.0, 0.72, 0.4], tubeGain: 0.55, tubeRadius: 30,
  floorPool: 0.3,
};

// `geometry`: { floorRow, emblemBox: [x0,y0,x1,y1], tubes: [{ x0, x1, warm }] }
export function relightDojo(img, geometry, params = {}) {
  const P = { ...DOJO_DEFAULTS, ...params };
  const { w, h } = img;
  const src = planes(img);
  const n = src.n;
  const out = { r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n) };
  const shadowL = lum(...P.shadow); const shadow = P.shadow.map((c) => c / shadowL);
  const lightMask = new Float32Array(n), lightR = new Float32Array(n), lightG = new Float32Array(n), lightB = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let r = src.r[i], g = src.g[i], b = src.b[i];
    const [hue, sat, val] = hsv(r, g, b);
    const isLight = val > 0.86 && sat < 0.3;                                 // tube faces, exit sign face
    const isExit = hue >= 90 && hue <= 170 && sat > 0.45 && val > 0.6;       // the green exit sign
    if (isLight || isExit) { out.r[i] = r; out.g[i] = g; out.b[i] = b; lightMask[i] = 1; lightR[i] = r; lightG[i] = g; lightB[i] = b; continue; }
    const m = (r + g + b) / 3;
    if (hue >= 60 && hue <= 160 && sat > 0.12) {                              // mats: sage / grey-green
      r = (m + (r - m) * (1 - P.greenDesat)) * P.greenDarken; g = (m + (g - m) * (1 - P.greenDesat)) * P.greenDarken; b = (m + (b - m) * (1 - P.greenDesat)) * P.greenDarken;
    } else if ((hue >= 340 || hue <= 18) && sat > 0.35) {                      // reds: pillar, mat borders
      r = (m + (r - m) * (1 - P.redDesat)) * P.redDarken; g = (m + (g - m) * (1 - P.redDesat)) * P.redDarken; b = (m + (b - m) * (1 - P.redDesat)) * P.redDarken;
    }
    const L = lum(r, g, b);
    const Lp = P.base + P.gain * Math.pow(L, P.gamma);
    const mx = Math.max(r, g, b) || 1;
    const hr = r / mx, hg = g / mx, hb = b / mx; const hl = lum(hr, hg, hb) || 1;
    const k = P.keepHue;
    out.r[i] = Lp * ((1 - k) * shadow[0] + k * hr / hl);
    out.g[i] = Lp * ((1 - k) * shadow[1] + k * hg / hl);
    out.b[i] = Lp * ((1 - k) * shadow[2] + k * hb / hl);
  }
  // Warm glow around the emblem, soft glow under each tube, a pool on the floor beneath each.
  const glow = new Float32Array(n), gR = new Float32Array(n), gG = new Float32Array(n), gB = new Float32Array(n);
  const [ex0, ey0, ex1, ey1] = geometry.emblemBox;
  for (let y = ey0; y < ey1; y++) for (let x = ex0; x < ex1; x++) { const i = y * w + x; glow[i] = P.emblemGain; gR[i] = P.emblemGlow[0]; gG[i] = P.emblemGlow[1]; gB[i] = P.emblemGlow[2]; }
  const eg = { r: blur(gR.map((v, i) => v * glow[i]), w, h, P.emblemRadius), g: blur(gG.map((v, i) => v * glow[i]), w, h, P.emblemRadius), b: blur(gB.map((v, i) => v * glow[i]), w, h, P.emblemRadius) };
  const tg = { r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n) };
  for (const t of geometry.tubes) {
    const c = t.warm ? P.tubeWarm : P.tubeNeutral;
    const m = new Float32Array(n);
    for (let y = t.y0; y < t.y1; y++) for (let x = t.x0; x < t.x1; x++) m[y * w + x] = P.tubeGain;
    const bm = blur(m, w, h, P.tubeRadius);
    for (let i = 0; i < n; i++) { tg.r[i] += bm[i] * c[0]; tg.g[i] += bm[i] * c[1]; tg.b[i] += bm[i] * c[2]; }
    // Floor pool: an ellipse under the tube on the mats.
    const cx = (t.x0 + t.x1) / 2, cy = geometry.floorRow + 48, rx = (t.x1 - t.x0) * 1.6 + 60, ry = 46;
    for (let y = geometry.floorRow; y < h; y++) for (let x = Math.max(0, cx - rx); x < Math.min(w, cx + rx); x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d > 1) continue;
      const i = y * w + x; const k = (1 - d) * P.floorPool; out.r[i] += k * c[0] * 0.5; out.g[i] += k * c[1] * 0.5; out.b[i] += k * c[2] * 0.5;
    }
  }
  for (let i = 0; i < n; i++) { out.r[i] += eg.r[i] * 2.2 + tg.r[i] * 2.0; out.g[i] += eg.g[i] * 2.2 + tg.g[i] * 2.0; out.b[i] += eg.b[i] * 2.2 + tg.b[i] * 2.0; }
  return pack(w, h, out.r, out.g, out.b);
}
