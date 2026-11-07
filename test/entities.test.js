import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player, Enemy, ENEMY_TYPES, separate } from '../src/entities.js';
import { ATTACKS, attackDuration } from '../src/combat.js';
import { GROUND_Y, STEP, DEPTH, DEPTH_REACH, PHYSICS, SPRINT, GRAB } from '../src/constants.js';

const idle = { left: false, right: false, down: false, block: false, jump: false, punch: false, kick: false };
const run = (f, seconds, fn) => { for (let t = 0; t < seconds; t += STEP) fn(); };

test('player walks, turns and stays inside the hall', () => {
  const p = new Player(100);
  run(p, 1, () => p.update(STEP, { ...idle, right: true }));
  assert.ok(p.x > 160 && p.x < 180, `moved right (${p.x})`);
  assert.equal(p.facing, 1);
  run(p, 0.1, () => p.update(STEP, { ...idle, left: true }));
  assert.equal(p.facing, -1);
  run(p, 10, () => p.update(STEP, { ...idle, left: true }));
  assert.equal(p.x, 10, 'clamped at the left wall');
});

test('player walks in depth, stays on the floor and keeps facing the same way', () => {
  const p = new Player(100);
  const start = p.z;
  p.update(STEP, { ...idle, down: true });
  assert.ok(p.z > start, 'down moves toward the viewer');
  assert.equal(p.state, 'walk');
  assert.equal(p.crouching, false, 'down no longer crouches');
  assert.equal(p.facing, 1);
  run(p, 3, () => p.update(STEP, { ...idle, down: true }));
  assert.equal(p.z, DEPTH, 'clamped at the front of the floor');
  run(p, 3, () => p.update(STEP, { ...idle, up: true }));
  assert.equal(p.z, 0, 'clamped at the back wall');
  assert.equal(p.x, 100, 'depth movement does not change x');
});

test('double-tapping a direction sprints that way until the key is released', () => {
  const p = new Player(100);
  p.update(STEP, { ...idle, right: true });
  p.update(STEP, idle);
  p.update(STEP, { ...idle, right: true });
  assert.equal(p.sprinting, true, 'second tap inside the window starts the sprint');
  assert.equal(p.lastEvent, 'sprint');
  assert.ok(Math.abs(p.vx - PHYSICS.playerSpeed * SPRINT.speedMultiplier) < 1e-9, 'sprint speed');
  run(p, 0.5, () => p.update(STEP, { ...idle, right: true }));
  assert.equal(p.sprinting, true, 'still sprinting while held');
  p.update(STEP, idle);
  assert.equal(p.sprinting, false, 'letting go ends the sprint');

  const slow = new Player(100);
  slow.update(STEP, { ...idle, up: true });
  run(slow, SPRINT.tapWindow + 0.05, () => slow.update(STEP, idle));
  slow.update(STEP, { ...idle, up: true });
  assert.equal(slow.sprinting, false, 'a second tap after the window is just a walk');
  assert.equal(slow.vz, -PHYSICS.playerDepthSpeed);
});

test('punch and kick together become a grab', () => {
  const p = new Player(100);
  p.update(STEP, { ...idle, punch: true, kick: true });
  assert.equal(p.attack.name, 'grab', 'both on the same frame');
  const q = new Player(100);
  q.update(STEP, { ...idle, punch: true });
  q.update(STEP, { ...idle, kick: true });
  assert.equal(q.attack.name, 'grab', 'kick during the punch wind-up');
  const r = new Player(100);
  r.update(STEP, { ...idle, kick: true });
  r.update(STEP, { ...idle, punch: true });
  assert.equal(r.attack.name, 'grab', 'punch during the kick wind-up');
  const air = new Player(100);
  air.update(STEP, { ...idle, jump: true });
  air.update(STEP, { ...idle, punch: true, kick: true });
  assert.notEqual(air.attack?.name, 'grab', 'no grabs in the air');
});

test('holding away from an incoming strike blocks instead of walking', () => {
  const p = new Player(100);
  p.update(STEP, { ...idle, left: true }, { threatDir: 1 });
  assert.equal(p.blocking, true);
  assert.equal(p.state, 'block');
  assert.equal(p.facing, 1, 'keeps facing the attacker');
  assert.equal(p.x, 100, 'does not move');
  const free = new Player(100);
  free.update(STEP, { ...idle, left: true }, { threatDir: 0 });
  assert.equal(free.blocking, false);
  assert.equal(free.facing, -1, 'with nothing coming, back is just a turn');
  const wrongWay = new Player(100);
  wrongWay.update(STEP, { ...idle, right: true }, { threatDir: 1 });
  assert.equal(wrongWay.blocking, false, 'walking into the strike is not a block');
  const near = new Player(100);
  run(near, 0.2, () => near.update(STEP, { ...idle, left: true }, { nearDir: 1 }));
  assert.equal(near.facing, 1, 'backs away from a close enemy without turning');
  assert.ok(near.x < 100, 'still moves');
  assert.equal(near.blocking, false);
});

test('a thrown fighter flies, lands, stays down for a moment and then gets up', () => {
  const e = new Enemy('striker', 120, -1, () => 0.5);
  const p = new Player(100);
  assert.equal(e.takeThrow({ damage: GRAB.damage, direction: 1 }), true);
  assert.equal(e.hp, ENEMY_TYPES.striker.hp - GRAB.damage);
  assert.equal(e.thrown, true);
  assert.equal(e.grounded, false);
  assert.equal(e.facing, -1);
  let landedAt = null, peak = GROUND_Y;
  run(e, 2, () => {
    e.update(STEP, p);
    peak = Math.min(peak, e.y);
    if (landedAt === null && e.grounded) landedAt = e.x;
  });
  assert.ok(GROUND_Y - peak > 8, `flew up (${GROUND_Y - peak})`);
  assert.ok(landedAt > 160, `flew forward (${landedAt})`);
  assert.equal(e.thrown, false);
  assert.equal(e.down, false, 'back on its feet after the floor time');
  assert.equal(e.state, 'idle');
  const d = new Enemy('striker', 120, -1, () => 0.5);
  d.takeThrow({ damage: GRAB.damage, direction: 1 });
  run(d, 0.6, () => d.update(STEP, p));
  assert.equal(d.grounded, true);
  assert.equal(d.down, true, 'lying on the floor right after landing');
  assert.equal(d.state, 'hurt');
});

test('a jump kick keeps its momentum', () => {
  const p = new Player(100);
  p.update(STEP, { ...idle, right: true, jump: true });
  p.update(STEP, { ...idle, right: true, kick: true });
  assert.equal(p.attack.name, 'kick');
  const x = p.x;
  p.update(STEP, idle);
  assert.ok(p.x > x, 'still moving forward while airborne');
});

test('an enemy lines up in depth before attacking', () => {
  const p = new Player(100);
  p.z = 0;
  const e = new Enemy('striker', 110, -1, () => 0.5, DEPTH);
  e.cooldown = 0;
  e.update(STEP, p);
  assert.equal(e.attack, null, 'in x range but too far in depth');
  assert.ok(e.z < DEPTH, 'closing the depth gap');
  let attacked = false;
  run(e, 3, () => { e.update(STEP, p); if (e.attack) attacked = true; });
  assert.ok(attacked);
  assert.ok(Math.abs(e.z - p.z) <= DEPTH_REACH);
});

test('player jumps and lands again', () => {
  const p = new Player(100);
  p.update(STEP, { ...idle, jump: true });
  assert.equal(p.grounded, false);
  assert.equal(p.state, 'jump');
  let peak = GROUND_Y;
  run(p, 1.5, () => { p.update(STEP, idle); peak = Math.min(peak, p.y); });
  assert.ok(GROUND_Y - peak > 25, `jump height ${GROUND_Y - peak}`);
  assert.equal(p.grounded, true);
  assert.equal(p.y, GROUND_Y);
});

test('punch has a fixed duration and blocks other actions meanwhile', () => {
  const p = new Player(100);
  p.update(STEP, { ...idle, punch: true });
  assert.equal(p.attack.name, 'punch');
  run(p, ATTACKS.punch.startup, () => p.update(STEP, idle));
  p.update(STEP, { ...idle, kick: true });
  assert.equal(p.attack.name, 'punch', 'cannot cancel into a kick once the punch is on its way');
  run(p, attackDuration(ATTACKS.punch) + 0.05, () => p.update(STEP, idle));
  assert.equal(p.attack, null);
  assert.equal(p.state, 'idle');
});

test('crouching uses low attacks and blocking prevents movement', () => {
  const p = new Player(100);
  p.update(STEP, { ...idle, duck: true, kick: true });
  assert.equal(p.crouching, true);
  assert.equal(p.attack.name, 'crouchKick');
  const q = new Player(100);
  run(q, 0.5, () => q.update(STEP, { ...idle, block: true, right: true }));
  assert.equal(q.blocking, true);
  assert.equal(q.x, 100);
});

test('taking hits reduces health and eventually knocks out', () => {
  const p = new Player(100);
  assert.equal(p.takeHit({ damage: 30, blocked: false, direction: 1, knockback: 40 }), true);
  assert.equal(p.hp, 70);
  assert.equal(p.state, 'hurt');
  assert.equal(p.takeHit({ damage: 30, blocked: true, direction: 1, knockback: 40 }), false, 'blocked hits do no damage');
  assert.equal(p.hp, 70);
  p.takeHit({ damage: 100, blocked: false, direction: 1, knockback: 40 });
  assert.equal(p.dead, true);
  assert.equal(p.state, 'dead');
});

test('striker walks to the player and throws a punch', () => {
  const p = new Player(100);
  const e = new Enemy('striker', 200, -1, () => 0.5);
  let attacked = false;
  run(e, 4, () => { e.update(STEP, p); p.update(STEP, idle); if (e.attack) attacked = true; });
  assert.ok(attacked, 'striker attacked');
  assert.ok(Math.abs(e.x - p.x) <= ENEMY_TYPES.striker.range + 1, `in range (${e.x})`);
  assert.equal(e.facing, -1);
});

test('kicker retreats after its high kick', () => {
  const p = new Player(100);
  const e = new Enemy('kicker', 150, -1, () => 0.5);
  let closest = Infinity, sawRetreat = false;
  run(e, 5, () => {
    e.update(STEP, p);
    const d = Math.abs(e.x - p.x);
    closest = Math.min(closest, d);
    if (e.retreatTimer > 0 && e.vx > 0) sawRetreat = true;
  });
  assert.ok(sawRetreat, 'kicker stepped back');
  assert.ok(closest < ENEMY_TYPES.kicker.range + 1);
});

test('boss raises a guard when the player winds up nearby', () => {
  const p = new Player(100);
  const e = new Enemy('boss', 120, -1, () => 0.1);
  e.cooldown = 5; // keep it from attacking so we can observe the block
  p.update(STEP, { ...idle, punch: true });
  e.update(STEP, p);
  assert.equal(e.blocking, true);
  assert.equal(e.state, 'block');
  const never = new Enemy('striker', 120, -1, () => 0.1);
  never.cooldown = 5;
  never.update(STEP, p);
  assert.equal(never.blocking, false, 'regular enemies never block');
});

test('separate pushes overlapping fighters apart', () => {
  const a = new Player(100);
  const b = new Enemy('striker', 103, -1);
  separate(a, b, 11);
  assert.ok(b.x - a.x >= 11 - 1e-9);
  const front = new Enemy('striker', 103, -1, Math.random, a.z + DEPTH_REACH + 1);
  const before = front.x;
  separate(a, front, 11);
  assert.equal(front.x, before, 'fighters on different parts of the floor pass freely');
});
