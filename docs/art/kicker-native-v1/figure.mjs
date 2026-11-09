// The Kicker's body, painted from a pose: joint positions in figure space (px, y up, origin on
// the anchor, facing right). Costume per the approved K1 concept: dark gi with sleeves, blue belt,
// gold chest emblem, cream shin wraps, bare feet, brown hair in a ponytail with a blue tie.
import { Layer, C, poly, ellipse, disc, capsule, line, px, xf, part, ellipsePts } from './paint.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const perp = (v) => [-v[1], v[0]];
const ang = (v) => Math.atan2(v[1], v[0]);

// ---- limbs -------------------------------------------------------------------------------
function arm(layer, sh, elbow, hand, { rear = false, hand: handType = 'fist', handAngle = null }) {
  const gi = rear ? C.GI_S : C.GI, skin = C.SKIN;
  // Upper sleeve (baggy) and the forearm sleeve to about 65 % of the forearm, then bare wrist.
  capsule(layer, sh, elbow, 8, gi, rear ? { light: C.GI, dark: C.GI_D } : {});
  const cuff = lerp(elbow, hand, 0.62);
  capsule(layer, elbow, cuff, 7, gi, rear ? { light: C.GI, dark: C.GI_D } : {});
  capsule(layer, lerp(elbow, hand, 0.5), hand, 4.4, skin);
  // Cuff edge.
  const d = norm(sub(hand, elbow)), n = perp(d);
  line(layer, add(cuff, mul(n, 3)), add(cuff, mul(n, -3)), C.GI_D);
  const a = handAngle ?? ang(d);
  const T = xf(hand, a);
  if (handType === 'fist') {
    poly(layer, [[-2.5, -2.8], [3.4, -2.8], [3.9, 0], [3.4, 2.8], [-2.5, 2.8]].map(T), skin);
    px(layer, ...T([2.3, 1.2]), C.SKIN_S); px(layer, ...T([2.3, -0.6]), C.SKIN_S);
  } else if (handType === 'open') {
    // Open hand: palm plus four fingers fanned a little, thumb toward the body side.
    poly(layer, [[-2, -2.5], [3, -2.5], [6.5, -1], [7, 1], [6, 2.8], [2, 3.2], [-2, 2.5]].map(T), skin);
    line(layer, T([3.5, -1.2]), T([6.3, -0.8]), C.SKIN_S); line(layer, T([3.5, 1.3]), T([6, 1.6]), C.SKIN_S);
  } else if (handType === 'flat') {
    // Palm on the floor / flat hand.
    poly(layer, [[-2, -2], [6.5, -2], [7.5, 0], [6.5, 2], [-2, 2]].map(T), skin);
    line(layer, T([2.5, -1]), T([6, -1]), C.SKIN_S);
  }
}

function foot(layer, ankle, angle, { rear = false, flex = 0 } = {}) {
  const skin = rear ? C.SKIN : C.SKIN;
  const T = xf(ankle, angle);
  // Heel behind the ankle, toes ahead; the sole 5 px under the ankle. `flex` lifts the toes.
  const pts = [[-4.5, -5], [9.5, -5 + flex], [9.5, -3 + flex], [7, -1.2], [2.5, 0.6], [-3.5, 0.6], [-4.8, -2]];
  poly(layer, pts.map(T), skin);
  // Toe marks and the instep shade.
  for (const tx of [5.5, 7.3]) px(layer, ...T([tx, -3.6 + flex]), C.SKIN_S);
  line(layer, T([-2, -1]), T([3, -0.4]), rear ? C.SKIN_S : C.SKIN_L);
}

function leg(layer, hip, knee, ankle, footAngle, { rear = false, flex = 0, wrap = true } = {}) {
  const gi = rear ? C.GI_S : C.GI;
  const opt = rear ? { light: C.GI, dark: C.GI_D } : {};
  // Trouser: thigh and the upper shin; the wrap covers the lower shin.
  capsule(layer, hip, knee, 11, gi, opt);
  const d = norm(sub(ankle, knee));
  const wrapTop = lerp(knee, ankle, wrap ? 0.42 : 1);
  capsule(layer, knee, add(wrapTop, mul(d, 1.5)), 9.5, gi, opt);
  // Knee crease.
  const n = perp(norm(sub(knee, hip)));
  line(layer, add(knee, mul(n, 3.5)), add(knee, mul(n, -3.5)), C.GI_D);
  foot(layer, ankle, footAngle, { rear, flex });
  if (wrap) {
    capsule(layer, wrapTop, add(ankle, mul(d, -0.5)), 8.4, C.WRAP, { light: C.WRAP_L, dark: C.WRAP_S });
    // Centre seam and two bands.
    line(layer, add(wrapTop, mul(d, 1)), add(ankle, mul(d, -1.5)), C.WRAP_LINE);
    for (const t of [0.35, 0.7]) { const p = lerp(wrapTop, ankle, t); const nn = perp(d); line(layer, add(p, mul(nn, 3)), add(p, mul(nn, -3)), C.WRAP_S); }
  }
}

// ---- torso, belt, emblem -------------------------------------------------------------------
function torso(layer, shC, hipC, { sw = 21, ww = 15, hw = 17, skirt = 4, lapel = true, emblem = true, front = null } = {}) {
  const axis = norm(sub(shC, hipC)); // hips -> shoulders
  const n = perp(axis); // points to the figure's back for an upright figure facing right (n = [-1, 0])
  const fwd = front || mul(n, -1);
  const waist = lerp(hipC, shC, 0.42);
  const bottom = add(hipC, mul(axis, -skirt));
  const P = (c, w) => [add(c, mul(n, w / 2)), add(c, mul(n, -w / 2))];
  const [sb, sf] = P(shC, sw), [wb, wf] = P(waist, ww), [bb, bf] = P(bottom, hw);
  // Shoulders slightly rounded, waist tapered, the gi skirt flaring below the belt.
  poly(layer, [sb, add(shC, mul(axis, 2.2)), sf, lerp(sf, wf, 0.5), wf, bf, bb, wb, lerp(wb, sb, 0.5)], C.GI);
  if (lapel) {
    // Collar: skin V at the neck; lapels crossing to the belt.
    const neck = add(shC, mul(axis, 1));
    const v1 = add(neck, mul(fwd, 5)), v2 = add(neck, mul(fwd, 1)), v3 = add(add(neck, mul(fwd, 3)), mul(axis, -6));
    poly(layer, [v1, v2, v3], C.SKIN);
    line(layer, add(add(neck, mul(fwd, -3)), mul(axis, 0)), add(add(waist, mul(fwd, 3.5)), mul(axis, 1)), C.GI_L);
    line(layer, add(add(neck, mul(fwd, 5.5)), mul(axis, -1)), add(add(waist, mul(fwd, 1.5)), mul(axis, 1)), C.GI_D);
  }
  if (emblem) {
    // Gold dragon mark on the chest, a 3 x 5 S.
    const e = add(add(shC, mul(fwd, 6)), mul(axis, -8));
    const T = xf(e, ang(axis) - Math.PI / 2);
    for (const [x, y] of [[1, 2], [2, 2], [0, 1], [1, 0], [2, -1], [1, -2], [0, -2]]) px(layer, ...T([x - 1, y]), C.GOLD);
    px(layer, ...T([1, 2]), C.GOLD_L);
  }
}
function belt(layer, shC, hipC, { ww = 15, sway = 0, front = null, ends = true } = {}) {
  const axis = norm(sub(shC, hipC)), n = perp(axis);
  const fwd = front || mul(n, -1);
  const waist = lerp(hipC, shC, 0.42);
  capsule(layer, add(waist, mul(n, ww / 2 + 0.5)), add(waist, mul(n, -ww / 2 - 0.5)), 5, C.BELT, { shade: false });
  line(layer, add(waist, mul(n, ww / 2)), add(waist, mul(n, -ww / 2)), C.BELT_L);
  // Knot at the front, two ends hanging down and swinging back.
  const knot = add(waist, mul(fwd, ww / 2 - 1.5));
  disc(layer, knot[0], knot[1], 2.2, C.BELT);
  px(layer, knot[0], knot[1], C.BELT_S);
  if (ends) {
    const down = [0, -1];
    for (const [k, off] of [[0, 0.5], [1, 3]]) {
      const start = add(knot, [off - 1.5, -1.5]);
      const end = add(add(start, mul(down, 12 - k * 2)), [sway + k * 1.5, 0]);
      capsule(layer, start, end, 2.2, C.BELT, { shade: false });
      px(layer, ...end, C.BELT_S);
    }
  }
}

// ---- head --------------------------------------------------------------------------------
function head(layer, hc, { tilt = 0, flutter = 0, tail = true, eyesShut = false, mouthOpen = false } = {}) {
  const T = xf(hc, tilt);
  // Ponytail first (behind everything): tie at the back, tail swinging back and down.
  if (tail) {
    const tie = T([-6.5, 1]);
    const t1 = T([-9, 0.5 + flutter]), t2 = T([-13.5, -3 + flutter * 1.5]), t3 = T([-16.5, -7.5 + flutter * 2]);
    capsule(layer, tie, t1, 4.5, C.HAIR);
    capsule(layer, t1, t2, 4, C.HAIR, { taper: 0.8 });
    capsule(layer, t2, t3, 3, C.HAIR, { taper: 0.4 });
    line(layer, T([-9.5, 1.5 + flutter]), T([-14, -3 + flutter * 1.5]), C.HAIR_L);
  }
  // Skull in hair, then the face over its front.
  poly(layer, ellipsePts(0, 0.5, 6.2, 7.2, 0).map(T), C.HAIR);
  poly(layer, [[6.6, 3.5], [7.2, 0.5], [7.4, -2], [6.3, -5.2], [3, -6.8], [-0.5, -6.3], [-2.8, -3.5], [-3, 0.5], [-1.5, 2.5], [1, 3.8], [4, 4.3]].map(T), C.SKIN);
  // Hairline sweep over the forehead and the sideburn.
  poly(layer, [[-0.5, 4.5], [4.5, 4.6], [6.5, 3.6], [3.5, 2.3], [-0.5, 2.6]].map(T), C.HAIR);
  poly(layer, [[-3.2, 1], [-1.4, 1.2], [-1.6, -2.4], [-3, -3.2]].map(T), C.HAIR);
  line(layer, T([0.5, 5.5]), T([4, 5.6]), C.HAIR_L);
  // Ear, brow, eye, nose, mouth.
  ellipse(layer, ...T([-1.4, -0.8]), 1.3, 1.7, C.SKIN_S);
  px(layer, ...T([-1.4, -0.8]), C.SKIN_D);
  line(layer, T([2.5, 1.9]), T([5.6, 2.2]), C.HAIR_S);
  if (eyesShut) line(layer, T([3.4, 0.8]), T([5.4, 0.8]), C.OUT2);
  else { px(layer, ...T([4.6, 0.6]), C.EYE); px(layer, ...T([5.4, 0.6]), C.OUT2); px(layer, ...T([4.6, 1.3]), C.OUT2); }
  px(layer, ...T([7.6, -1.4]), C.SKIN); px(layer, ...T([7.2, -2.4]), C.SKIN_S);
  if (mouthOpen) { px(layer, ...T([5.3, -4]), C.OUT2); px(layer, ...T([5.3, -3.2]), C.OUT2); }
  else line(layer, T([4.5, -3.8]), T([6, -3.6]), C.SKIN_D);
  line(layer, T([3, -6.2]), T([5.5, -5.5]), C.SKIN_S);
  // Blue tie over the tail root.
  if (tail) { const tie = T([-6.2, 1]); poly(layer, [[-1.2, -1.6], [1.2, -1.6], [1.2, 1.6], [-1.2, 1.6]].map(xf(tie, tilt)), C.BELT); px(layer, ...tie, C.BELT_L); }
}
function neck(layer, hc, shC, tilt = 0) {
  const T = xf(hc, tilt);
  capsule(layer, T([2.5, -4]), lerp(shC, hc, 0.25), 5, C.SKIN, { light: C.SKIN, dark: C.SKIN_S });
}

// ---- the figure ----------------------------------------------------------------------------
// pose: { head, tilt, flutter, shC, hipC, sw, ww, hw, skirt, lead: {sh, elbow, hand, handType, handAngle, hip, knee, ankle, footAngle, flex},
//         rear: {...}, sway, front, eyesShut, mouthOpen, order }
export function paintFigure(cell, p) {
  const o = p.order || ['tail', 'rearArm', 'rearLeg', 'torso', 'leadLeg', 'head', 'leadArm'];
  const L = p.lead, R = p.rear;
  const draw = {
    tail: () => {},
    rearArm: () => part(cell, (l) => arm(l, R.sh, R.elbow, R.hand, { rear: true, hand: R.handType || 'fist', handAngle: R.handAngle ?? null })),
    rearLeg: () => part(cell, (l) => leg(l, R.hip, R.knee, R.ankle, R.footAngle ?? 0, { rear: true, flex: R.flex || 0, wrap: R.wrap !== false })),
    torso: () => {
      part(cell, (l) => torso(l, p.shC, p.hipC, { sw: p.sw, ww: p.ww, hw: p.hw, skirt: p.skirt, front: p.front, emblem: p.emblem !== false, lapel: p.lapel !== false }));
      part(cell, (l) => belt(l, p.shC, p.hipC, { ww: p.ww, sway: p.sway || 0, front: p.front, ends: p.beltEnds !== false }), { rim: false });
    },
    leadLeg: () => part(cell, (l) => leg(l, L.hip, L.knee, L.ankle, L.footAngle ?? 0, { flex: L.flex || 0, wrap: L.wrap !== false })),
    head: () => {
      part(cell, (l) => neck(l, p.head, p.shC, p.tilt || 0), { rim: false });
      part(cell, (l) => head(l, p.head, { tilt: p.tilt || 0, flutter: p.flutter || 0, tail: p.tail !== false, eyesShut: p.eyesShut, mouthOpen: p.mouthOpen }));
    },
    leadArm: () => part(cell, (l) => arm(l, L.sh, L.elbow, L.hand, { hand: L.handType || 'fist', handAngle: L.handAngle ?? null })),
  };
  for (const k of o) draw[k]();
}
