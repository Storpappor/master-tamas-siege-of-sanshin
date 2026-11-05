import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectFrames, heroFrameIndex, HERO_FRAMES } from '../src/heroSprite.js';
import { Player } from '../src/entities.js';
import { STEP } from '../src/constants.js';

// Build a synthetic 4x2 sheet: 8 opaque blobs; the third blob of row 0 spills across the cell border.
function syntheticSheet() {
  const w = 400, h = 200;
  const alpha = new Uint8Array(w * h);
  const blob = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) alpha[y * w + x] = 255; };
  blob(10, 10, 80, 90);     // row 0, frame 0 (feet 10..80)
  blob(120, 20, 170, 90);   // frame 1
  blob(210, 15, 310, 90);   // frame 2: spills past x=300 (the nominal cell border)
  blob(330, 5, 380, 90);    // frame 3
  blob(10, 110, 80, 190);   // row 1
  blob(120, 120, 170, 190);
  blob(210, 150, 315, 190); // knockdown: wide and short, ends before the next figure
  blob(330, 105, 380, 190);
  // Give frame 0 a narrow "standing foot" so the anchor is the foot, not the body centre.
  for (let y = 85; y <= 90; y++) for (let x = 10; x <= 80; x++) alpha[y * w + x] = (x >= 60 && x <= 70) ? 255 : 0;
  return { alpha, w, h };
}

test('detectFrames finds eight frames even when a pose spills over the grid', () => {
  const { alpha, w, h } = syntheticSheet();
  const frames = detectFrames(alpha, w, h);
  assert.equal(frames.length, HERO_FRAMES.length);
  assert.deepEqual(frames.map((f) => f.x), [10, 120, 210, 330, 10, 120, 210, 330]);
  assert.equal(frames[2].w, 101, 'spilled frame keeps its full width');
  assert.equal(frames[2].y, 15);
  assert.equal(frames[6].h, 41, 'knockdown frame height from content');
  assert.equal(frames[0].anchorX, 55, 'anchor sits under the foot (65 - 10)');
  assert.equal(frames[1].anchorX, 25, 'anchor centred when the whole base is opaque');
});

test('detectFrames falls back to the plain grid when a row has an unexpected layout', () => {
  const w = 40, h = 20;
  const alpha = new Uint8Array(w * h).fill(255);
  const frames = detectFrames(alpha, w, h);
  assert.equal(frames.length, 8);
  assert.deepEqual(frames.slice(0, 4).map((f) => f.x), [0, 10, 20, 30]);
});

test('hero frames follow the player state machine', () => {
  const idle = { left: false, right: false, down: false, block: false, jump: false, punch: false, kick: false, kiai: false };
  const p = new Player(100);
  assert.equal(heroFrameIndex(p), 0, 'idle');
  const seen = new Set();
  for (let t = 0; t < 1; t += STEP) { p.update(STEP, { ...idle, right: true }); seen.add(heroFrameIndex(p)); }
  assert.deepEqual([...seen].sort(), [0, 1], 'walking alternates idle and step');
  p.update(STEP, { ...idle, punch: true });
  assert.equal(heroFrameIndex(p), 2, 'punch');
  const k = new Player(100);
  k.update(STEP, { ...idle, kick: true });
  assert.equal(heroFrameIndex(k), 3, 'kick');
  const b = new Player(100);
  b.update(STEP, { ...idle, block: true });
  assert.equal(heroFrameIndex(b), 4, 'block');
  const j = new Player(100);
  j.update(STEP, { ...idle, jump: true });
  assert.equal(heroFrameIndex(j), 7, 'jump borrows the raised-arm pose');
  const c = new Player(100);
  c.update(STEP, { ...idle, duck: true });
  assert.equal(heroFrameIndex(c), 5, 'crouch borrows the low pose');
  const h = new Player(100);
  h.takeHit({ damage: 10, blocked: false, direction: 1, knockback: 10 });
  assert.equal(heroFrameIndex(h), 5, 'hit reaction');
  assert.equal(heroFrameIndex(h, { victory: true }), 7, 'victory pose wins while alive');
  const d = new Player(100);
  d.takeHit({ damage: 100, blocked: false, direction: 1, knockback: 10 });
  d.deadTimer = 1;
  assert.equal(heroFrameIndex(d), 6, 'knockdown');
  assert.equal(heroFrameIndex(d, { victory: true }), 6, 'a defeated fighter never celebrates');
});
