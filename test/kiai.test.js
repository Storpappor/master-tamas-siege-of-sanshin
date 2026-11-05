import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player, Enemy } from '../src/entities.js';
import { Game } from '../src/game.js';
import { resolveHit } from '../src/combat.js';
import { STEP, KIAI, GROUND_Y, COMBO } from '../src/constants.js';

const idle = { left: false, right: false, down: false, block: false, jump: false, punch: false, kick: false, kiai: false };
const run = (seconds, fn) => { for (let t = 0; t < seconds; t += STEP) fn(); };

test('kiai activates on the I action, lasts its duration, then needs to recharge', () => {
  const p = new Player(100);
  assert.equal(p.kiaiReady, true);
  p.update(STEP, { ...idle, kiai: true });
  assert.equal(p.kiaiActive, true);
  assert.equal(p.lastEvent, 'kiai');
  run(KIAI.duration + 0.1, () => p.update(STEP, idle));
  assert.equal(p.kiaiActive, false);
  assert.equal(p.kiaiReady, false, 'still cooling down');
  p.update(STEP, { ...idle, kiai: true });
  assert.equal(p.kiaiActive, false, 'cannot re-activate during cooldown');
  run(KIAI.cooldown, () => p.update(STEP, idle));
  assert.equal(p.kiaiReady, true);
});

test('kiai strikes do double damage and break the Master\'s guard', () => {
  const game = new Game({ input: null, rng: () => 0.5 });
  game.start();
  const p = game.player;
  const boss = new Enemy('boss', p.x + 14, -1, () => 0.5);
  boss.blockTimer = 5; boss.blocking = true; boss.state = 'block';
  game.enemies.push(boss);
  const hpBefore = boss.hp;
  // Without kiai the guard holds.
  p.startAttack('punch');
  run(0.3, () => game.step(STEP, idle));
  assert.equal(boss.hp, hpBefore, 'blocked normally');
  // With kiai the same punch lands for double damage.
  boss.blockTimer = 5; boss.blocking = true; boss.state = 'block'; boss.invulnerable = 0;
  p.attack = null;
  p.activateKiai();
  p.startAttack('punch');
  run(0.3, () => game.step(STEP, idle));
  assert.equal(hpBefore - boss.hp, 10 * KIAI.damageMultiplier);
  assert.ok(game.texts.some((t) => t.text === 'BREAK!'));
});

test('combo multiplier grows with unanswered hits and resets when hit', () => {
  const game = new Game({ input: null, rng: () => 0.5 });
  game.start();
  const [need, mult] = COMBO.tiers.at(-1);
  game.combo = need;
  assert.equal(game.comboMultiplier, mult);
  game.combo = need - 1;
  assert.equal(game.comboMultiplier, 1);
  game.combo = 10;
  const striker = new Enemy('striker', game.player.x + 14, -1, () => 0.5);
  striker.startAttack('enemyPunch');
  game.enemies.push(striker);
  run(0.6, () => game.step(STEP, idle));
  assert.ok(game.player.hp < 100, 'player was hit');
  assert.equal(game.combo, 0);
});

test('the low sweep catches crouching fighters but passes under a jump', () => {
  const kicker = { x: 100, y: GROUND_Y, facing: 1 };
  const standing = { x: 118, y: GROUND_Y, facing: -1, blocking: false, crouching: false };
  const crouching = { ...standing, crouching: true };
  const jumping = { ...standing, y: GROUND_Y - 20 };
  assert.equal(resolveHit(kicker, standing, 'enemyLowSweep').hit, true);
  assert.equal(resolveHit(kicker, crouching, 'enemyLowSweep').hit, true);
  assert.equal(resolveHit(kicker, jumping, 'enemyLowSweep').hit, false);
});

test('the Master counters immediately after its guard drops', () => {
  const p = new Player(100);
  const boss = new Enemy('boss', 118, -1, () => 0.9);
  boss.cooldown = 3;
  boss.blockTimer = 0.05; boss.blocking = true; boss.state = 'block';
  run(0.2, () => { boss.update(STEP, p); p.update(STEP, idle); });
  assert.ok(boss.attack, 'boss attacked right after blocking');
});
