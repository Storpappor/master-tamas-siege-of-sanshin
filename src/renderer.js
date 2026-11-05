// Canvas renderer: draws the world into a small native-resolution buffer and
// scales it up with nearest-neighbour filtering for crisp pixels.
import { VIEW_W, VIEW_H, GROUND_Y, HALL_WIDTH, COLORS } from './constants.js';
import { drawFighter, drawText } from './sprites.js';
import { heroFrameIndex } from './heroSprite.js';

const BG = {
  ceiling: '#2d1d13', ceilingTrim: '#4a3121', wall: '#d8c7a1', wallShade: '#c6b48d',
  rail: '#6b452b', railLight: '#8a5c38', paper: '#f1e9d2', lattice: '#5c3b25',
  pillar: '#4b2f1c', pillarLight: '#6a4327', floorA: '#a9733f', floorB: '#946235',
  floorSeam: '#7a4f2a', baseboard: '#3f2816', scroll: '#f6f1e3', ink: '#1d1a1a',
  lantern: '#e2a53b', lanternGlow: '#f3c86d', lanternFrame: '#3a2415',
  signFrame: '#2e1b10', signWood: '#5a3a22', signWoodLight: '#6e4a2c', signText: '#f0c85a', signTextShadow: '#3a2008',
};

// Wooden name boards on the back wall. Panels and scrolls are skipped where a board hangs.
const SIGN_TEXT = 'SANSHIN KAN KARATE';
const SIGN_W = 160, SIGN_H = 26, SIGN_Y = 42;
const SIGN_CENTERS = [160, HALL_WIDTH - 160];
const inSignZone = (x0, x1) => SIGN_CENTERS.some((cx) => x1 > cx - SIGN_W / 2 - 8 && x0 < cx + SIGN_W / 2 + 8);

// Pre-render the whole hall once; the camera just slides across it.
function buildHall(createCanvas) {
  const c = createCanvas(HALL_WIDTH, VIEW_H);
  const g = c.getContext('2d');

  g.fillStyle = BG.wall; g.fillRect(0, 0, HALL_WIDTH, VIEW_H);
  g.fillStyle = BG.ceiling; g.fillRect(0, 0, HALL_WIDTH, 18);
  g.fillStyle = BG.ceilingTrim; g.fillRect(0, 18, HALL_WIDTH, 3);
  g.fillStyle = BG.wallShade; g.fillRect(0, 21, HALL_WIDTH, 2);

  // Shoji (paper) panels with a wooden lattice.
  for (let x = 20; x < HALL_WIDTH; x += 96) {
    if (inSignZone(x - 2, x + 50)) continue;
    g.fillStyle = BG.lattice; g.fillRect(x - 2, 36, 52, 84);
    g.fillStyle = BG.paper; g.fillRect(x, 38, 48, 80);
    g.fillStyle = BG.lattice;
    for (let i = 0; i <= 48; i += 12) g.fillRect(x + i, 38, 1, 80);
    for (let j = 0; j <= 80; j += 16) g.fillRect(x, 38 + j, 48, 1);
    g.fillRect(x + 47, 38, 1, 80);
    g.fillRect(x, 117, 48, 1);
  }

  // Hanging scrolls between some panels, with an abstract brush circle.
  for (let x = 82; x < HALL_WIDTH; x += 192) {
    if (inSignZone(x - 1, x + 17)) continue;
    g.fillStyle = BG.ink; g.fillRect(x - 1, 34, 18, 2);
    g.fillStyle = BG.scroll; g.fillRect(x, 36, 16, 44);
    g.fillStyle = BG.ink;
    const cx = x + 8, cy = 56;
    for (let a = 0; a < Math.PI * 1.75; a += 0.25) {
      g.fillRect(Math.round(cx + Math.cos(a) * 5), Math.round(cy + Math.sin(a) * 5), 2, 2);
    }
    g.fillRect(x + 4, 70, 8, 1);
    g.fillRect(x + 6, 73, 4, 1);
    g.fillRect(x - 1, 80, 18, 2);
  }

  // Dojo name boards.
  for (const cx of SIGN_CENTERS) {
    const x = cx - SIGN_W / 2;
    g.fillStyle = BG.signFrame; g.fillRect(x - 2, SIGN_Y - 2, SIGN_W + 4, SIGN_H + 4);
    g.fillStyle = BG.signWood; g.fillRect(x, SIGN_Y, SIGN_W, SIGN_H);
    g.fillStyle = BG.signWoodLight;
    for (let i = 0; i < SIGN_W; i += 7) g.fillRect(x + i, SIGN_Y, 1, SIGN_H); // wood grain
    g.fillStyle = BG.signFrame;
    g.fillRect(cx - 40, 28, 2, SIGN_Y - 30); g.fillRect(cx + 38, 28, 2, SIGN_Y - 30); // hanging cords
    drawText(g, SIGN_TEXT, cx, SIGN_Y + 8, { color: BG.signText, scale: 2, align: 'center', shadow: BG.signTextShadow });
  }

  // Wall rail and base board.
  g.fillStyle = BG.rail; g.fillRect(0, 124, HALL_WIDTH, 4);
  g.fillStyle = BG.railLight; g.fillRect(0, 124, HALL_WIDTH, 1);
  g.fillStyle = BG.wallShade; g.fillRect(0, 128, HALL_WIDTH, 14);
  g.fillStyle = BG.baseboard; g.fillRect(0, 142, HALL_WIDTH, 8);

  // Pillars.
  for (let x = 0; x <= HALL_WIDTH; x += 192) {
    g.fillStyle = BG.pillar; g.fillRect(x - 5, 18, 10, 132);
    g.fillStyle = BG.pillarLight; g.fillRect(x - 5, 18, 2, 132);
    g.fillStyle = BG.ceilingTrim; g.fillRect(x - 7, 18, 14, 4);
  }

  // Lanterns on alternate pillars.
  for (let x = 96; x < HALL_WIDTH; x += 192) {
    g.fillStyle = BG.lanternFrame; g.fillRect(x - 1, 22, 2, 6);
    g.fillRect(x - 6, 28, 12, 1);
    g.fillStyle = BG.lantern; g.fillRect(x - 5, 29, 10, 12);
    g.fillStyle = BG.lanternGlow; g.fillRect(x - 3, 31, 6, 8);
    g.fillStyle = BG.lanternFrame; g.fillRect(x - 6, 41, 12, 1);
    g.fillRect(x - 5, 34, 10, 1); g.fillRect(x - 5, 37, 10, 1);
  }

  // Wooden floor planks.
  for (let y = GROUND_Y; y < VIEW_H; y += 6) {
    g.fillStyle = ((y - GROUND_Y) / 6) % 2 === 0 ? BG.floorA : BG.floorB;
    g.fillRect(0, y, HALL_WIDTH, 6);
    g.fillStyle = BG.floorSeam;
    g.fillRect(0, y, HALL_WIDTH, 1);
    const offset = ((y - GROUND_Y) / 6) % 2 === 0 ? 0 : 24;
    for (let x = offset; x < HALL_WIDTH; x += 48) g.fillRect(x, y, 1, 6);
  }
  g.fillStyle = BG.baseboard; g.fillRect(0, GROUND_Y, HALL_WIDTH, 1);

  // Training posts near both ends of the hall.
  for (const x of [34, HALL_WIDTH - 34]) {
    g.fillStyle = BG.pillar; g.fillRect(x - 2, 112, 4, 38);
    g.fillStyle = '#b48c5a'; g.fillRect(x - 3, 108, 6, 12);
    g.fillStyle = '#8f6b3f'; g.fillRect(x - 3, 112, 6, 1); g.fillRect(x - 3, 116, 6, 1);
  }
  return c;
}

export class Renderer {
  constructor(displayCanvas, { reducedMotion = false, createCanvas, hero = null } = {}) {
    this.hero = hero; // HeroSprite for the player; enemies stay procedurally drawn
    this.display = displayCanvas;
    this.ctx = displayCanvas.getContext('2d');
    this.createCanvas = createCanvas || ((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
    this.buffer = this.createCanvas(VIEW_W, VIEW_H);
    this.bctx = this.buffer.getContext('2d');
    this.hall = buildHall(this.createCanvas);
    this.reducedMotion = reducedMotion;
    this.scale = 1;
  }

  // Pick the largest integer zoom that fits the container for pixel-perfect scaling.
  resize(containerCssWidth, dpr = 1) {
    const scale = Math.max(1, Math.floor((containerCssWidth * dpr) / VIEW_W));
    this.scale = scale;
    this.display.width = VIEW_W * scale;
    this.display.height = VIEW_H * scale;
    this.display.style.width = `${(VIEW_W * scale) / dpr}px`;
    this.display.style.height = `${(VIEW_H * scale) / dpr}px`;
  }

  render(game, time) {
    const g = this.bctx;
    const camX = Math.round(game.camX);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(this.hall, -camX, 0);

    g.save();
    g.translate(-camX, 0);

    const fighters = [...game.enemies, game.player];
    // Shadows stay on the floor even when a fighter jumps.
    g.fillStyle = COLORS.shadow;
    for (const f of fighters) {
      if (f.remove) continue;
      const w = f.dead && f.deadTimer > 0.25 ? 30 : 14;
      g.fillRect(Math.round(f.x - w / 2), GROUND_Y - 1, w, 2);
    }

    for (const f of game.enemies) this.drawOne(g, f, time);
    this.drawOne(g, game.player, time, game.ending === 'victory');

    for (const p of game.particles) {
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    for (const t of game.texts) {
      drawText(g, t.text, Math.round(t.x), Math.round(t.y), { color: t.color, scale: t.scale || 1, align: 'center', shadow: '#1a1210' });
    }
    g.restore();

    if (game.banner) {
      const a = Math.min(1, game.banner.life * 2);
      g.globalAlpha = a;
      g.fillStyle = 'rgba(20,12,8,0.75)';
      g.fillRect(0, 70, VIEW_W, 26);
      drawText(g, game.banner.text, VIEW_W / 2, 76, { color: '#ffd166', scale: 2, align: 'center', shadow: '#5a1e12' });
      g.globalAlpha = 1;
    }
    if (game.state === 'playing' && game.elapsed < 2.2) {
      g.globalAlpha = game.elapsed < 1.8 ? 1 : (2.2 - game.elapsed) / 0.4;
      drawText(g, 'FIGHT!', VIEW_W / 2, 86, { color: '#ffffff', scale: 3, align: 'center', shadow: '#5a1e12' });
      g.globalAlpha = 1;
    }

    // Blit to the visible canvas (with optional screen shake).
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.display.width, this.display.height);
    let sx = 0, sy = 0;
    if (game.shake > 0 && !this.reducedMotion) {
      sx = Math.round((Math.random() - 0.5) * 4) * this.scale;
      sy = Math.round((Math.random() - 0.5) * 3) * this.scale;
    }
    ctx.drawImage(this.buffer, sx, sy, this.display.width, this.display.height);
  }

  drawOne(g, f, time, victory = false) {
    if (f.remove) return;
    let alpha = 1;
    // Beaten enemies fade out; the hero stays on the floor so the knockdown reads on the game-over screen.
    if (f.dead && f.deadTimer > 0.5 && f.kind !== 'player') alpha = Math.max(0, 1 - (f.deadTimer - 0.5) / 0.4);
    if (f.invulnerable > 0 && !f.dead) {
      if (this.reducedMotion) alpha = 0.6;
      else if (Math.floor(time * 24) % 2 === 0) return;
    }
    const flash = f.flashTimer > 0 && !this.reducedMotion;
    // Kiai aura: a warm outline that flickers (steady when reduced motion is preferred).
    let outline = null;
    if (f.kiaiActive) outline = this.reducedMotion || Math.floor(time * 12) % 3 !== 0 ? COLORS.kiai : '#ffe9b0';
    if (f.kind === 'player' && this.hero && this.hero.ready) {
      this.hero.draw(g, heroFrameIndex(f, { victory }), f.x, f.y, f.facing, { alpha, flash: flash ? '#fff' : null, outline });
      return;
    }
    drawFighter(g, f, { flash, alpha, outline });
  }
}
