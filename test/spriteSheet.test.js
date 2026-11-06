import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SpriteSheet, heroState } from '../src/heroSprite.js';
import { Player } from '../src/entities.js';
import { STEP } from '../src/constants.js';

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
  for (const absent of ['victory']) {
    assert.equal(sheet.frameFor(absent, { phase: 'active', progress: 0.5, loop: 1 }), null, `${absent} falls back`);
  }
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
