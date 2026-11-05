// Procedural pixel-art fighters and a tiny bitmap font.
//
// ART PIPELINE NOTE: every fighter is drawn from a small "skeleton" (joint
// positions per pose) using filled pixel blocks. To move to hand-drawn sprite
// sheets later, replace `drawFighter` with an image-based version that maps
// `poseFor(fighter)` to a sprite frame; nothing else in the game needs to change.
import { COLORS } from './constants.js';
import { HIGH_ATTACKS, LOW_ATTACKS } from './combat.js';

export const FIGHTER_PALETTES = {
  player:  { skin: COLORS.skin, skinShade: COLORS.skinShade, hair: COLORS.hairBrown, gi: COLORS.giWhite, giShade: COLORS.giWhiteShade, belt: COLORS.beltBlack, headband: null, ponytail: false, bald: false, big: false },
  striker: { skin: COLORS.skin, skinShade: COLORS.skinShade, hair: COLORS.hairDark, gi: COLORS.giGray, giShade: COLORS.giGrayShade, belt: COLORS.beltWhite, headband: COLORS.headbandRed, ponytail: false, bald: false, big: false },
  kicker:  { skin: COLORS.skin, skinShade: COLORS.skinShade, hair: COLORS.hairDark, gi: COLORS.giBlue, giShade: COLORS.giBlueShade, belt: COLORS.beltBlue, headband: null, ponytail: true, bald: false, big: false },
  boss:    { skin: COLORS.skin, skinShade: COLORS.skinShade, hair: COLORS.hairDark, gi: COLORS.giBlack, giShade: COLORS.giBlackShade, belt: COLORS.beltRed, headband: null, ponytail: false, bald: true, big: true },
};

const solidPalette = (c) => ({ skin: c, skinShade: c, hair: c, gi: c, giShade: c, belt: c, headband: c, ponytail: false, bald: true, big: false });
const FLASH_PALETTE = solidPalette('#fff');

// Joint positions relative to the feet, for a fighter facing right.
// lead = limbs on the side facing the opponent, rear = the other side.
// arm: [elbow, hand], leg: [knee, foot].
const POSES = {
  idle:   { head: [0, -36], sh: [0, -30], hip: [0, -18], lead: { arm: [[4, -25], [8, -31]], leg: [[3, -10], [5, 0]] }, rear: { arm: [[-3, -24], [2, -29]], leg: [[-3, -10], [-5, 0]] } },
  walk1:  { head: [0, -36], sh: [0, -30], hip: [0, -18], lead: { arm: [[3, -25], [7, -30]], leg: [[5, -10], [8, 0]] }, rear: { arm: [[-4, -24], [1, -28]], leg: [[-4, -9], [-7, 0]] } },
  walk2:  { head: [0, -37], sh: [0, -31], hip: [0, -19], lead: { arm: [[4, -25], [8, -31]], leg: [[2, -10], [3, 0]] }, rear: { arm: [[-3, -24], [2, -29]], leg: [[-1, -10], [-2, 0]] } },
  walk3:  { head: [0, -36], sh: [0, -30], hip: [0, -18], lead: { arm: [[4, -25], [8, -30]], leg: [[-1, -10], [-3, 0]] }, rear: { arm: [[-3, -24], [1, -28]], leg: [[3, -9], [6, 0]] } },
  walk4:  { head: [0, -37], sh: [0, -31], hip: [0, -19], lead: { arm: [[4, -25], [8, -31]], leg: [[1, -10], [1, 0]] }, rear: { arm: [[-3, -24], [2, -29]], leg: [[0, -10], [-1, 0]] } },
  crouch: { head: [0, -26], sh: [0, -21], hip: [0, -12], lead: { arm: [[4, -16], [8, -22]], leg: [[6, -7], [6, 0]] }, rear: { arm: [[-3, -15], [2, -19]], leg: [[-6, -7], [-6, 0]] } },
  jump:   { head: [0, -38], sh: [0, -32], hip: [0, -20], lead: { arm: [[5, -28], [7, -35]], leg: [[4, -12], [3, -6]] }, rear: { arm: [[-4, -27], [-6, -34]], leg: [[-3, -12], [-5, -7]] } },
  punchWind: { head: [-1, -36], sh: [-1, -30], hip: [0, -18], lead: { arm: [[-4, -27], [-6, -31]], leg: [[4, -10], [6, 0]] }, rear: { arm: [[-3, -25], [1, -29]], leg: [[-3, -10], [-6, 0]] } },
  punch:  { head: [1, -36], sh: [2, -30], hip: [0, -18], lead: { arm: [[9, -30], [16, -30]], leg: [[5, -10], [8, 0]] }, rear: { arm: [[-4, -26], [-2, -21]], leg: [[-4, -9], [-8, 0]] } },
  kickWind: { head: [-1, -36], sh: [-1, -30], hip: [0, -18], lead: { arm: [[3, -25], [6, -30]], leg: [[6, -18], [5, -11]] }, rear: { arm: [[-4, -24], [-1, -28]], leg: [[-2, -9], [-3, 0]] } },
  kick:   { head: [-2, -36], sh: [-2, -30], hip: [0, -18], lead: { arm: [[3, -25], [6, -30]], leg: [[8, -20], [19, -21]] }, rear: { arm: [[-5, -24], [-2, -28]], leg: [[-2, -9], [-3, 0]] } },
  highKick: { head: [-4, -35], sh: [-3, -29], hip: [0, -18], lead: { arm: [[1, -24], [4, -29]], leg: [[7, -23], [18, -35]] }, rear: { arm: [[-6, -24], [-4, -28]], leg: [[-2, -9], [-3, 0]] } },
  crouchPunch: { head: [1, -26], sh: [1, -21], hip: [0, -12], lead: { arm: [[8, -21], [15, -20]], leg: [[6, -7], [6, 0]] }, rear: { arm: [[-4, -18], [-2, -14]], leg: [[-6, -7], [-6, 0]] } },
  crouchKick: { head: [-1, -26], sh: [-1, -21], hip: [0, -12], lead: { arm: [[4, -16], [8, -22]], leg: [[9, -11], [20, -12]] }, rear: { arm: [[-3, -15], [2, -19]], leg: [[-5, -7], [-6, 0]] } },
  block:  { head: [0, -35], sh: [0, -29], hip: [0, -17], lead: { arm: [[5, -23], [5, -33]], leg: [[4, -9], [6, 0]] }, rear: { arm: [[3, -21], [7, -28]], leg: [[-4, -9], [-6, 0]] } },
  hurt:   { head: [-3, -36], sh: [-2, -30], hip: [0, -18], lead: { arm: [[4, -27], [7, -23]], leg: [[4, -10], [6, 0]] }, rear: { arm: [[-5, -28], [-9, -25]], leg: [[-3, -9], [-6, 0]] } },
  fallen: { lying: true, head: [-14, -4], sh: [-8, -5], hip: [2, -5], lead: { arm: [[-6, -9], [-10, -11]], leg: [[7, -7], [13, -5]] }, rear: { arm: [[-4, -3], [-8, -2]], leg: [[6, -3], [12, -2]] } },
};

const WALK_FRAMES = ['walk1', 'walk2', 'walk3', 'walk4'];

// Map a fighter's current state to a pose name.
export function poseFor(f) {
  if (f.dead) return f.deadTimer < 0.25 ? 'hurt' : 'fallen';
  if (f.state === 'hurt') return 'hurt';
  if (f.attack) {
    const name = f.attack.name;
    const isKick = /kick/i.test(name);
    const isCrouch = name.startsWith('crouch') || LOW_ATTACKS.has(name);
    if (f.attackPhase === 'startup') {
      if (isCrouch) return 'crouch';
      return isKick ? 'kickWind' : 'punchWind';
    }
    if (isCrouch) return isKick ? 'crouchKick' : 'crouchPunch';
    if (isKick) return HIGH_ATTACKS.has(name) ? 'highKick' : 'kick';
    return 'punch';
  }
  if (f.state === 'block') return 'block';
  if (!f.grounded) return 'jump';
  if (f.crouching) return 'crouch';
  if (f.state === 'walk') return WALK_FRAMES[Math.floor(f.walkCycle) % WALK_FRAMES.length];
  return 'idle';
}

function limb(ctx, x1, y1, x2, y2, t, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  const off = Math.floor(t / 2);
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const px = Math.round(x1 + (x2 - x1) * i / steps);
    const py = Math.round(y1 + (y2 - y1) * i / steps);
    ctx.fillRect(px - off, py - off, t, t);
  }
}

// Draw a fighter with its feet at (x, y) in canvas space.
export function drawFighter(ctx, f, { flash = false, alpha = 1, outline = null } = {}) {
  // An outline is drawn by stamping a solid silhouette around the fighter first (used for Kiai).
  if (outline && !flash) {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      drawFighter(ctx, { ...f, x: f.x + ox, y: f.y + oy, attackPhase: f.attackPhase }, { flash: outline, alpha });
    }
  }
  const pal = flash ? (typeof flash === 'string' ? solidPalette(flash) : FLASH_PALETTE) : (FIGHTER_PALETTES[f.kind] || FIGHTER_PALETTES.player);
  const big = (FIGHTER_PALETTES[f.kind] || {}).big;
  const k = big ? 1.2 : 1;
  const S = (v) => Math.round(v * k);
  const pose = POSES[poseFor(f)];
  const armT = big ? 4 : 3, legT = big ? 5 : 4, headS = big ? 10 : 8, torsoW = big ? 12 : 10;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(f.x), Math.round(f.y));
  if (f.facing < 0) ctx.scale(-1, 1);

  const sh = [S(pose.sh[0]), S(pose.sh[1])];
  const hip = [S(pose.hip[0]), S(pose.hip[1])];
  const head = [S(pose.head[0]), S(pose.head[1])];
  const pt = (p) => [S(p[0]), S(p[1])];

  const drawArm = (arm, shoulder) => {
    const [e, h] = [pt(arm[0]), pt(arm[1])];
    limb(ctx, shoulder[0], shoulder[1], e[0], e[1], armT, pal.gi);
    limb(ctx, e[0], e[1], h[0], h[1], armT, pal.gi);
    ctx.fillStyle = pal.skin;
    ctx.fillRect(h[0] - 1, h[1] - 1, armT, armT);
  };
  const drawLeg = (leg, hipPt) => {
    const [kn, ft] = [pt(leg[0]), pt(leg[1])];
    limb(ctx, hipPt[0], hipPt[1], kn[0], kn[1], legT, pal.gi);
    limb(ctx, kn[0], kn[1], ft[0], ft[1], legT, pal.gi);
    ctx.fillStyle = pal.skin;
    ctx.fillRect(ft[0] - 2, ft[1] - 2, legT + 1, 3);
  };

  // Rear limbs first so the lead side reads on top.
  drawArm(pose.rear.arm, [sh[0] - 1, sh[1] + 1]);
  drawLeg(pose.rear.leg, [hip[0] - 2, hip[1]]);

  // Torso (gi jacket) and belt.
  const half = Math.floor(torsoW / 2);
  if (pose.lying) {
    ctx.fillStyle = pal.gi;
    ctx.fillRect(sh[0], sh[1] - half, hip[0] - sh[0], torsoW);
    ctx.fillStyle = pal.belt;
    ctx.fillRect(hip[0] - 2, sh[1] - half, 2, torsoW);
  } else {
    const h = hip[1] - sh[1];
    const upper = Math.ceil(h / 2);
    ctx.fillStyle = pal.gi;
    ctx.fillRect(sh[0] - half, sh[1], torsoW, upper);
    ctx.fillRect(hip[0] - half, sh[1] + upper, torsoW, h - upper);
    // Lapel line gives the jacket its V shape.
    ctx.fillStyle = pal.giShade;
    ctx.fillRect(sh[0] + 1, sh[1] + 1, 1, 2);
    ctx.fillRect(sh[0], sh[1] + 3, 1, 2);
    ctx.fillRect(sh[0] - 1, sh[1] + 5, 1, 1);
    ctx.fillStyle = pal.belt;
    ctx.fillRect(hip[0] - half, hip[1] - 2, torsoW, 2);
    ctx.fillRect(hip[0] + 1, hip[1], 1, 3); // belt tail
  }

  drawLeg(pose.lead.leg, [hip[0] + 2, hip[1]]);

  // Head: skin block, hair cap, one eye on the facing side.
  const hx = head[0] - Math.floor(headS / 2), hy = head[1] - Math.floor(headS / 2);
  ctx.fillStyle = pal.skin;
  ctx.fillRect(hx, hy, headS, headS);
  if (!pal.bald) {
    ctx.fillStyle = pal.hair;
    ctx.fillRect(hx, hy, headS, 3);
    ctx.fillRect(hx, hy + 3, 2, 2);
    if (pal.ponytail) ctx.fillRect(hx - 3, hy + 2, 3, 2);
  } else {
    ctx.fillStyle = pal.skinShade;
    ctx.fillRect(hx, hy, headS, 1);
    ctx.fillStyle = COLORS.eye;
    ctx.fillRect(hx + headS - 5, hy + 3, 4, 1); // heavy brow
  }
  if (pal.headband) {
    ctx.fillStyle = pal.headband;
    ctx.fillRect(hx - 1, hy + 2, headS + 1, 2);
    ctx.fillRect(hx - 3, hy + 3, 2, 1);
  }
  ctx.fillStyle = COLORS.eye;
  ctx.fillRect(hx + headS - 3, hy + 4, 1, 1);
  ctx.fillStyle = pal.skinShade;
  ctx.fillRect(hx, hy + headS - 1, headS, 1);

  drawArm(pose.lead.arm, [sh[0] + 1, sh[1] + 1]);
  ctx.restore();
}

// ---- 3x5 bitmap font ----------------------------------------------------
const GLYPHS = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '001', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
  A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'],
  C: ['111', '100', '100', '100', '111'], D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
  G: ['111', '100', '101', '101', '111'], H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'], J: ['001', '001', '001', '101', '111'],
  K: ['101', '110', '100', '110', '101'], L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'], N: ['110', '101', '101', '101', '101'],
  O: ['111', '101', '101', '101', '111'], P: ['111', '101', '111', '100', '100'],
  Q: ['111', '101', '101', '111', '001'], R: ['110', '101', '110', '101', '101'],
  S: ['111', '100', '111', '001', '111'], T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'], V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'], X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'], Z: ['111', '001', '010', '100', '111'],
  '+': ['000', '010', '111', '010', '000'], '-': ['000', '000', '111', '000', '000'],
  '!': ['010', '010', '010', '000', '010'], ':': ['000', '010', '000', '010', '000'],
  '.': ['000', '000', '000', '000', '010'], ' ': ['000', '000', '000', '000', '000'],
};

export function textWidth(text, scale = 1) {
  return text.length * 4 * scale - scale;
}

// Draws uppercase pixel text. align: 'left' | 'center' | 'right'.
export function drawText(ctx, text, x, y, { color = '#fff', scale = 1, align = 'left', shadow = null } = {}) {
  const str = String(text).toUpperCase();
  const w = textWidth(str, scale);
  let cx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  const draw = (ox, oy, col) => {
    ctx.fillStyle = col;
    let px = cx + ox;
    for (const ch of str) {
      const g = GLYPHS[ch] || GLYPHS[' '];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
          if (g[r][c] === '1') ctx.fillRect(px + c * scale, y + oy + r * scale, scale, scale);
        }
      }
      px += 4 * scale;
    }
  };
  if (shadow) { const o = Math.max(1, Math.floor(scale / 2)); draw(o, o, shadow); }
  draw(0, 0, color);
}
