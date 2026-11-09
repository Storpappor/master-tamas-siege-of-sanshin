import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SpriteSheet, heroState, resolveFrame, SPRINT_CELL_RATE } from '../src/heroSprite.js';
import { Player } from '../src/entities.js';
import { STEP, SPRINT } from '../src/constants.js';

const idle = { left: false, right: false, up: false, down: false, duck: false, block: false, jump: false, punch: false, kick: false, kiai: false };
const run = (seconds, fn) => { for (let t = 0; t < seconds; t += STEP) fn(); };

test('the shipped tamas.json map is valid and follows the spec cell and anchor', () => {
  const map = JSON.parse(readFileSync(new URL('../assets/sprites/tamas.json', import.meta.url), 'utf8'));
  const sheet = new SpriteSheet({ map });
  assert.deepEqual(sheet.cell, { w: 96, h: 96 });
  assert.deepEqual(sheet.anchor, { x: 48, y: 95 });
  assert.equal(sheet.has('idle'), true);
  assert.equal(sheet.frameFor('idle', { progress: 0 }), 0);
  // The briefs' layout: idle row 1, walk row 2, punch row 3, standing kick row 4, block row 5, hurt row 6.
  assert.deepEqual(sheet.states.walk, [4, 5, 6, 7]);
  assert.deepEqual(sheet.states.punch, [8, 9, 10]);
  assert.deepEqual(sheet.states.kick, [12, 13, 14]);
  assert.deepEqual(sheet.states.block, [16]);
  assert.deepEqual(sheet.states.hurt, [20, 21]);
  assert.deepEqual(sheet.states.crouch, [24]);
  assert.deepEqual(sheet.states.crouchPunch, [28, 29]);
  assert.deepEqual(sheet.states.crouchKick, [32, 33]);
  assert.deepEqual(sheet.states.jump, [36, 37]);
  assert.deepEqual(sheet.states.knockdown, [40, 41, 42]);
  assert.deepEqual(sheet.states.victory, [44]);
  // Controls artwork appended below the original rows 0-11: sprint rows 12-13, grab row 14, throw row 15.
  assert.deepEqual(sheet.states.sprint, [48, 49, 50, 51, 52, 53]);
  assert.deepEqual(sheet.states.grab, [56, 57, 58]);
  assert.deepEqual(sheet.states.throw, [60, 61, 62]);
  assert.equal(sheet.frameFor('kick', { phase: 'active' }), 13, 'a 3-cell state shows its middle cell while active');
  assert.equal(sheet.frameFor('block', { progress: 0 }), 16, 'block is a single held cell');
  assert.equal(sheet.frameFor('hurt', { progress: 0.2 }), 20, 'hurt impact for the first half');
  assert.equal(sheet.frameFor('hurt', { progress: 0.7 }), 21, 'hurt stagger for the second half');
  assert.equal(sheet.frameFor('crouch', { progress: 0 }), 24, 'crouch is a single held cell (also the low-attack wind-up)');
  assert.equal(sheet.frameFor('crouchPunch', { phase: 'active' }), 28, 'a 2-cell attack shows its first cell while active');
  assert.equal(sheet.frameFor('crouchPunch', { phase: 'recovery' }), 29, 'and its second during recovery');
  assert.equal(sheet.frameFor('crouchKick', { phase: 'active' }), 32);
  assert.equal(sheet.frameFor('crouchKick', { phase: 'recovery' }), 33);
  assert.equal(sheet.frameFor('jump', { progress: 0 }), 36, 'rising shows the first jump cell');
  assert.equal(sheet.frameFor('jump', { progress: 1 }), 37, 'falling shows the second jump cell');
  assert.equal(sheet.frameFor('knockdown', { progress: 0 }), 40, 'knockdown starts toppling');
  assert.equal(sheet.frameFor('knockdown', { progress: 0.5 }), 41, 'then hits the floor');
  assert.equal(sheet.frameFor('knockdown', { progress: 1 }), 42, 'and holds the lying cell');
  assert.equal(sheet.frameFor('victory', { progress: 0 }), 44, 'victory is a single held cell');
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((l) => sheet.frameFor('sprint', { loop: l })), [48, 49, 50, 51, 52, 53, 48], 'the sprint loops over six cells');
  assert.equal(sheet.frameFor('grab', { phase: 'startup' }), 56, 'grab reach');
  assert.equal(sheet.frameFor('grab', { phase: 'active' }), 57, 'grab extended');
  assert.equal(sheet.frameFor('grab', { phase: 'recovery' }), 58, 'grab miss recovery');
  assert.equal(sheet.frameFor('throw', { phase: 'startup' }), 60, 'the hold shows the GRAB cell');
  assert.equal(sheet.frameFor('throw', { phase: 'active' }), 61, 'the throw-down shows the THROW DOWN cell');
  assert.equal(sheet.frameFor('throw', { phase: 'recovery' }), 62, 'landing and after show the GROUND IMPACT cell');
  const SPEC_STATES = ['idle', 'walk', 'punch', 'kick', 'block', 'hurt', 'crouch', 'crouchPunch', 'crouchKick', 'jump', 'knockdown', 'victory', 'sprint', 'grab', 'throw'];
  for (const state of SPEC_STATES) {
    assert.notEqual(sheet.frameFor(state, { phase: 'active', progress: 0.5, loop: 1 }), null, `${state} resolves on the shipped sheet`);
  }
  assert.equal(sheet.frameFor('unmapped', { progress: 0 }), null, 'a state missing from the map still falls back');
  assert.deepEqual(sheet.cellRect(0), { x: 0, y: 0, w: 96, h: 96 });
});

test('frame selection follows attack phases, loops and progress', () => {
  const sheet = new SpriteSheet({ map: { cell: { w: 96, h: 96 }, anchor: { x: 48, y: 95 }, columns: 4,
    states: { idle: [0], walk: [4, 5, 6, 7], punch: [8, 9, 10], crouchPunch: [20, 21], hurt: [36, 37] } } });
  assert.equal(sheet.frameFor('punch', { phase: 'startup' }), 8);
  assert.equal(sheet.frameFor('punch', { phase: 'active' }), 9);
  assert.equal(sheet.frameFor('punch', { phase: 'recovery' }), 10);
  assert.equal(sheet.frameFor('crouchPunch', { phase: 'active' }), 20);
  assert.equal(sheet.frameFor('crouchPunch', { phase: 'recovery' }), 21);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((l) => sheet.frameFor('walk', { loop: l })), [4, 5, 6, 7, 4, 5]);
  assert.equal(sheet.frameFor('hurt', { progress: 0 }), 36);
  assert.equal(sheet.frameFor('hurt', { progress: 0.6 }), 37);
  assert.equal(sheet.frameFor('hurt', { progress: 1 }), 37);
  assert.deepEqual(sheet.cellRect(9), { x: 96, y: 192, w: 96, h: 96 });
});

test('heroState mirrors the player state machine', () => {
  const p = new Player(100);
  assert.deepEqual(heroState(p), { state: 'idle', progress: 0 });
  run(0.2, () => p.update(STEP, { ...idle, right: true }));
  assert.equal(heroState(p).state, 'walk');
  assert.equal(heroState(p).fallback, undefined, 'a plain walk has no fallback to resolve');
  p.update(STEP, { ...idle, punch: true });
  assert.deepEqual(heroState(p), { state: 'punch', phase: 'startup', progress: 0 });
  run(0.1, () => p.update(STEP, idle));
  assert.equal(heroState(p).phase, 'active');
  const c = new Player(100);
  c.update(STEP, { ...idle, duck: true, punch: true });
  assert.equal(heroState(c).state, 'crouch', 'a low attack winds up in the crouch pose');
  run(0.1, () => c.update(STEP, idle));
  assert.deepEqual(heroState(c), { state: 'crouchPunch', phase: 'active', progress: 0 });
  const b = new Player(100);
  b.update(STEP, { ...idle, block: true });
  assert.equal(heroState(b).state, 'block');
  const j = new Player(100);
  j.update(STEP, { ...idle, jump: true });
  assert.deepEqual(heroState(j), { state: 'jump', progress: 0 });
  const h = new Player(100);
  h.takeHit({ damage: 10, blocked: false, direction: 1, knockback: 10 });
  assert.equal(heroState(h).state, 'hurt');
  assert.equal(heroState(h, { victory: true }).state, 'victory', 'victory wins over a late hit');
  const d = new Player(100);
  d.takeHit({ damage: 100, blocked: false, direction: 1, knockback: 10 });
  d.deadTimer = 1;
  assert.equal(heroState(d).state, 'knockdown');
  assert.equal(heroState(d, { victory: true }).state, 'knockdown', 'a beaten fighter never celebrates');
});

test('a sprinting player resolves to the sprint cells at 12 cells per second, or to walk on a sheet without them', () => {
  const p = new Player(100);
  p.update(STEP, { ...idle, right: true });
  p.update(STEP, idle);
  p.update(STEP, { ...idle, right: true });
  assert.equal(p.sprinting, true);
  const hs = heroState(p);
  assert.equal(hs.state, 'sprint');
  assert.equal(hs.fallback, 'walk');
  assert.ok(Math.abs(hs.loop - p.walkCycle * SPRINT_CELL_RATE) < 1e-9, 'the walk counter is scaled to the sprint cell rate');
  assert.ok(Math.abs(9 * SPRINT.speedMultiplier * SPRINT_CELL_RATE - 12) < 1e-9, '15.75 counts per second become 12 cells per second');
  // Five simulation frames per cell: the loop counter gains 0.2 per 60 Hz step while sprinting.
  const before = heroState(p).loop;
  run(1, () => p.update(STEP, { ...idle, right: true }));
  assert.ok(Math.abs(heroState(p).loop - before - 12) < 1e-6, 'one second of sprinting advances twelve cells');
  const full = new SpriteSheet({ map: { cell: { w: 96, h: 96 }, anchor: { x: 48, y: 95 }, columns: 4, states: { walk: [4, 5, 6, 7], sprint: [48, 49, 50, 51, 52, 53] } } });
  const walkOnly = new SpriteSheet({ map: { cell: { w: 96, h: 96 }, anchor: { x: 48, y: 95 }, columns: 4, states: { walk: [4, 5, 6, 7] } } });
  const bare = new SpriteSheet({ map: { cell: { w: 96, h: 96 }, anchor: { x: 48, y: 95 }, columns: 4, states: { idle: [0] } } });
  const sprinting = { state: 'sprint', loop: 2, fallback: 'walk' };
  assert.equal(resolveFrame(full, sprinting), 50, 'the sprint cells when the sheet has them');
  assert.equal(resolveFrame(walkOnly, sprinting), 6, 'the walk cells on a sheet without a sprint state');
  assert.equal(resolveFrame(bare, sprinting), null, 'nothing mapped: fall through to the legacy sheet');
  assert.equal(resolveFrame(walkOnly, { state: 'walk', loop: 2 }), 6, 'a plain walk is unchanged');
});

// The shipped hero sheet is checked cell by cell against the expectations recorded when the
// approved H1-family artwork was assembled: every 96 x 96 cell's RGBA bytes must hash to the
// value derived from its frozen source (or from the preserved main baseline for sprint, grab,
// throw and the empty cells), so a stale or wrongly assembled sheet fails here instead of
// shipping silently.
test('the shipped tamas.png matches the recorded per-cell artwork expectations', async () => {
  const { createHash } = await import('node:crypto');
  const { decodePng } = await import('../scripts/append-sheet.mjs');
  const expected = JSON.parse(readFileSync(new URL('./fixtures/hero-cells.json', import.meta.url), 'utf8'));
  const png = readFileSync(new URL('../assets/sprites/tamas.png', import.meta.url));
  const image = decodePng(png);
  assert.equal(image.width, expected.columns * expected.cellSize, 'sheet width');
  assert.equal(image.height, expected.rows * expected.cellSize, 'sheet height');
  const size = expected.cellSize, columns = expected.columns;
  for (let k = 0; k < expected.columns * expected.rows; k++) {
    const hash = createHash('sha256');
    const x0 = (k % columns) * size, y0 = Math.floor(k / columns) * size;
    for (let y = 0; y < size; y++) {
      const start = ((y0 + y) * image.width + x0) * 4;
      hash.update(image.rgba.subarray(start, start + size * 4));
    }
    assert.equal(hash.digest('hex'), expected.cells[String(k)].sha256, `cell ${k} (${expected.cells[String(k)].source})`);
  }
  for (let i = 3; i < image.rgba.length; i += 4) assert.ok(image.rgba[i] === 0 || image.rgba[i] === 255, 'binary alpha');
});
