import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTACKS, attackPhase, attackDuration, worldBox, resolveHit, HIGH_ATTACKS } from '../src/combat.js';
import { GROUND_Y } from '../src/constants.js';

const fighter = (over = {}) => ({ x: 100, y: GROUND_Y, facing: 1, blocking: false, crouching: false, ...over });

test('attack phases follow startup → active → recovery → done', () => {
  const a = ATTACKS.punch;
  assert.equal(attackPhase(a, 0), 'startup');
  assert.equal(attackPhase(a, a.startup), 'active');
  assert.equal(attackPhase(a, a.startup + a.active), 'recovery');
  assert.equal(attackPhase(a, attackDuration(a)), 'done');
});

test('world boxes mirror when facing left', () => {
  const box = { x: 6, y: -34, w: 15, h: 9 };
  const right = worldBox(box, 100, GROUND_Y, 1);
  const left = worldBox(box, 100, GROUND_Y, -1);
  assert.equal(right.x, 106);
  assert.equal(left.x + left.w, 94);
  assert.equal(right.y, GROUND_Y - 34);
});

test('a punch connects in range and misses out of range', () => {
  const a = fighter({ x: 100, facing: 1 });
  assert.equal(resolveHit(a, fighter({ x: 114, facing: -1 }), 'punch').hit, true);
  assert.equal(resolveHit(a, fighter({ x: 140, facing: -1 }), 'punch').hit, false);
  assert.equal(resolveHit(a, fighter({ x: 86, facing: 1 }), 'punch').hit, false, 'cannot hit behind');
});

test('blocking only works when facing the attacker', () => {
  const a = fighter({ x: 100, facing: 1 });
  const facingAttacker = resolveHit(a, fighter({ x: 114, facing: -1, blocking: true }), 'punch');
  assert.equal(facingAttacker.hit, true);
  assert.equal(facingAttacker.blocked, true);
  assert.equal(facingAttacker.damage, 0);
  const backTurned = resolveHit(a, fighter({ x: 114, facing: 1, blocking: true }), 'punch');
  assert.equal(backTurned.blocked, false);
  assert.equal(backTurned.damage, ATTACKS.punch.damage);
});

test('high kicks pass over a crouching fighter', () => {
  const kicker = fighter({ x: 100, facing: 1 });
  for (const name of HIGH_ATTACKS) {
    assert.equal(resolveHit(kicker, fighter({ x: 118, facing: -1 }), name).hit, true, `${name} hits standing`);
    assert.equal(resolveHit(kicker, fighter({ x: 118, facing: -1, crouching: true }), name).hit, false, `${name} misses crouching`);
  }
  // A mid-height punch still reaches a crouching fighter, so crouching is not a free escape.
  assert.equal(resolveHit(kicker, fighter({ x: 114, facing: -1, crouching: true }), 'enemyPunch').hit, true);
  // Low attacks reach crouching fighters.
  assert.equal(resolveHit(kicker, fighter({ x: 114, facing: -1, crouching: true }), 'crouchPunch').hit, true);
});
