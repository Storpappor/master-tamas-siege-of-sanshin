// Headless playthrough: a scripted player fights through the whole level.
// This proves the level is completable and lands in the target time range.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { LEVEL_1 } from '../src/level.js';
import { Enemy, Player } from '../src/entities.js';
import { ATTACKS } from '../src/combat.js';
import { STEP, VIEW_W, DEPTH_REACH, GRAB } from '../src/constants.js';

function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const idle = { left: false, right: false, up: false, down: false, duck: false, block: false, jump: false, punch: false, kick: false, kiai: false };

// A simple but competent bot: walk forward, line up with the nearest enemy, block its wind-ups, punch.
function botInput(game) {
  const p = game.player;
  const alive = game.enemies.filter((e) => !e.dead);
  if (!alive.length) {
    const exit = game.openExit;
    if (!exit) return { ...idle, right: true };
    const toDoor = exit.x - p.x;
    return { ...idle, up: true, right: toDoor > 4, left: toDoor < -4 };
  }
  alive.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
  const e = alive[0];
  const dx = e.x - p.x;
  const dz = e.z - p.z;
  const dist = Math.abs(dx);
  const facingEnemy = Math.sign(dx) === p.facing;
  const threat = alive.find((o) => o.attack && o.attackPhase !== 'recovery' && Math.abs(o.x - p.x) < 40 && Math.abs(o.z - p.z) <= DEPTH_REACH);
  if (threat && Math.sign(threat.x - p.x) === p.facing) return { ...idle, block: true };
  const star = game.projectiles.find((s) => Math.abs(s.x - p.x) < 45 && Math.abs(s.z - p.z) <= DEPTH_REACH);
  if (star && Math.sign(star.x - p.x) === p.facing) return { ...idle, block: true };
  const align = Math.abs(dz) > DEPTH_REACH - 2 ? { [dz > 0 ? 'down' : 'up']: true } : {};
  if (!facingEnemy) return { ...idle, ...align, [dx > 0 ? 'right' : 'left']: true };
  if (dist > 18) return { ...idle, ...align, [dx > 0 ? 'right' : 'left']: true };
  if (align.up || align.down) return { ...idle, ...align };
  return { ...idle, punch: !p.attack };
}

function playUntil(game, seconds, input) {
  let steps = 0;
  while (game.state === 'playing' && steps < seconds / STEP) {
    game.step(STEP, input(game));
    steps += 1;
  }
}

test('a scripted player can clear the level in the target time', () => {
  const events = [];
  const ui = { showOverlay: (n) => events.push(n), setHud() {}, showDialogue: (lines, done) => { events.push('dialogue'); done(); } };
  const game = new Game({ input: null, ui, rng: seededRng(7) });
  game.start();
  playUntil(game, 240, botInput);
  assert.equal(game.state, 'victory', `expected victory, got ${game.state} (hp ${game.player.hp}, remaining ${game.remainingEnemies}, x ${game.player.x})`);
  assert.equal(game.remainingEnemies, 0);
  assert.ok(game.elapsed >= 55 && game.elapsed <= 100, `level took ${game.elapsed.toFixed(1)}s`);
  assert.ok(game.score > 0);
  assert.ok(events.includes('victory'));
  assert.ok(events.includes('dialogue'), 'the exchange with Master Kage was shown');
});

test('no seed leaves a fight that cannot be finished', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 8, 9, 10, 12]) {
    const game = new Game({ input: null, rng: seededRng(seed) });
    game.start();
    playUntil(game, 240, botInput);
    assert.ok(['victory', 'gameover'].includes(game.state), `seed ${seed} stuck: ${game.state} at x ${game.player.x}, remaining ${game.remainingEnemies}`);
  }
});

test('the fight freezes during the Master Kage exchange and resumes afterwards', () => {
  let finish = null;
  const ui = { showOverlay() {}, setHud() {}, showDialogue: (lines, done) => { finish = done; } };
  const game = new Game({ input: null, ui, rng: seededRng(5) });
  game.start();
  playUntil(game, 240, botInput);
  assert.equal(game.state, 'dialogue');
  assert.ok(game.boss, 'boss has entered');
  const t = game.elapsed;
  game.step(STEP, botInput(game));
  assert.equal(game.elapsed, t, 'no time passes during the exchange');
  finish();
  assert.equal(game.state, 'playing');
  game.step(STEP, botInput(game));
  assert.ok(game.elapsed > t);
});

test('a player who walks forward and stops fighting is eventually knocked out', () => {
  const game = new Game({ input: null, rng: seededRng(3) });
  game.start();
  playUntil(game, 120, (g) => (g.spawner.active ? idle : { ...idle, right: true }));
  assert.equal(game.state, 'gameover');
  assert.equal(game.player.hp, 0);
});

test('the camera locks during a wave, never scrolls back, and the player stays on screen', () => {
  const game = new Game({ input: null, rng: seededRng(11) });
  game.start();
  let prevCam = 0;
  let locked = false;
  for (let i = 0; i < 2000 && game.state === 'playing'; i++) {
    game.step(STEP, { ...idle, right: true });
    assert.ok(game.camX >= prevCam, 'camera never moves backwards');
    prevCam = game.camX;
    assert.ok(game.player.x >= game.camX && game.player.x <= game.camX + VIEW_W, 'player stays on screen');
    if (game.spawner.active) {
      locked = true;
      assert.ok(game.player.x <= game.spawner.lockX + VIEW_W, 'cannot walk past a locked fight');
    }
  }
  assert.ok(locked, 'the first wave locked the camera');
});

test('the GO prompt appears after a wave is cleared and a banner marks each new zone', () => {
  const game = new Game({ input: null, rng: seededRng(7) });
  game.start();
  assert.equal(game.showGo, false, 'not during the opening FIGHT! text');
  let sawGoAfterWave = false;
  let wasActive = false;
  const banners = new Set();
  for (let i = 0; i < 240 / STEP && game.state === 'playing'; i++) {
    game.step(STEP, botInput(game));
    if (wasActive && game.showGo) sawGoAfterWave = true;
    if (game.spawner.active) wasActive = true;
    if (game.banner) banners.add(game.banner.text);
  }
  assert.ok(sawGoAfterWave);
  for (const zone of LEVEL_1.zones.slice(1)) assert.ok(banners.has(zone.name), `banner for ${zone.name}`);
});

// A game with the street already won and the player standing at (x, z).
function streetWon(x, z) {
  const game = new Game({ input: null, rng: () => 0.5 });
  game.start();
  const street = LEVEL_1.zones[0];
  game.spawner.waveIndex = LEVEL_1.waves.findIndex((w) => w.x >= street.to);
  game.camX = street.to - VIEW_W;
  Object.assign(game.player, { x, z });
  return game;
}

const walkThroughDoor = (game) => {
  for (let i = 0; i < 300 && game.zoneIndex === 0; i++) game.step(STEP, { ...idle, up: true });
  for (let i = 0; i < 60 && game.transition; i++) game.step(STEP, idle);
};

test('the dojo stays hidden and out of reach while on the street', () => {
  const street = LEVEL_1.zones[0];
  const game = streetWon(street.to - 20, 40);
  for (let i = 0; i < 200; i++) game.step(STEP, { ...idle, right: true });
  assert.equal(game.zoneIndex, 0, 'walking past the door does not leave the street');
  assert.ok(game.player.x <= street.to - 10, 'stopped at the end of the street');
  assert.ok(game.camX + VIEW_W <= street.to, 'the camera never shows the dojo');
});

test('going in through the door fades out and brings up the dojo', () => {
  const [street, dojo] = LEVEL_1.zones;
  const game = streetWon(street.exit.x, 30);
  assert.deepEqual(game.openExit, street.exit);
  let sawBlack = false;
  for (let i = 0; i < 300 && (game.zoneIndex === 0 || game.transition); i++) {
    game.step(STEP, { ...idle, up: true });
    if (game.fade === 1) sawBlack = true;
  }
  assert.ok(sawBlack, 'the screen went black on the way through');
  assert.equal(game.zoneIndex, 1);
  assert.equal(game.fade, 0, 'the picture came back');
  assert.equal(game.camX, dojo.from);
  assert.ok(game.player.x >= dojo.from && game.player.x < dojo.from + VIEW_W);
  assert.equal(game.banner.text, dojo.name);
});

test('the door stays shut until the street has been won', () => {
  const street = LEVEL_1.zones[0];
  const game = new Game({ input: null, rng: () => 0.5 });
  game.start();
  game.camX = street.to - VIEW_W;
  Object.assign(game.player, { x: street.exit.x, z: 0 });
  assert.equal(game.openExit, null, 'a street wave is still ahead');
  game.step(STEP, idle);
  assert.equal(game.transition, null);
  assert.equal(game.zoneIndex, 0);
});

test('player controls are ignored on the way through the door', () => {
  const game = streetWon(LEVEL_1.zones[0].exit.x, 5);
  game.step(STEP, idle);
  assert.ok(game.transition, 'the door was reached');
  game.step(STEP, { ...idle, punch: true });
  assert.equal(game.player.attack, null);
  walkThroughDoor(game);
  assert.equal(game.zoneIndex, 1);
  assert.equal(game.transition, null);
});

// A thrower lined up with the player, already winding up its throw.
function throwerGame(playerOver = {}) {
  const game = new Game({ input: null, rng: () => 0.5 });
  game.start();
  Object.assign(game.player, playerOver);
  const t = new Enemy('thrower', game.player.x + 90, -1, () => 0.5);
  t.cooldown = 0;
  game.enemies.push(t);
  return { game, thrower: t };
}

const untilStarGone = (game, input = idle) => {
  let thrown = false;
  for (let i = 0; i < 180; i++) {
    game.step(STEP, input);
    if (game.projectiles.length) thrown = true;
    if (thrown && !game.projectiles.length) break;
  }
  return thrown;
};

test('a thrower hurts from a distance without ever getting close', () => {
  const { game, thrower } = throwerGame();
  assert.ok(untilStarGone(game), 'a star was thrown');
  assert.equal(game.player.hp, 100 - ATTACKS.shuriken.damage);
  assert.ok(Math.abs(thrower.x - game.player.x) > 40, 'still at range');
});

test('a star is stopped by a block, passes over a duck and misses another depth lane', () => {
  const blocked = throwerGame();
  assert.ok(untilStarGone(blocked.game, { ...idle, block: true }));
  assert.equal(blocked.game.player.hp, 100, 'blocked');

  const ducked = throwerGame();
  ducked.game.step(STEP, { ...idle, duck: true });
  ducked.thrower.attack = null;
  ducked.game.projectiles.push({ x: ducked.game.player.x + 30, y: ducked.game.player.y, z: ducked.game.player.z, facing: -1 });
  ducked.thrower.cooldown = 99;
  for (let i = 0; i < 60; i++) ducked.game.step(STEP, { ...idle, duck: true });
  assert.equal(ducked.game.player.hp, 100, 'flew overhead');

  const aside = throwerGame();
  aside.thrower.cooldown = 99;
  const p = aside.game.player;
  aside.game.projectiles.push({ x: p.x + 30, y: p.y, z: p.z + DEPTH_REACH + 1, facing: -1 });
  for (let i = 0; i < 60; i++) aside.game.step(STEP, idle);
  assert.equal(p.hp, 100, 'missed');
});

test('hitting a thrower during its wind-up cancels the throw', () => {
  const t = new Enemy('thrower', 200, -1, () => 0.5);
  t.startAttack('enemyThrow');
  t.takeHit({ damage: 10, blocked: false, direction: 1, knockback: 10 });
  const p = new Player(100);
  for (let i = 0; i < 60; i++) { t.update(STEP, p); assert.notEqual(t.lastEvent, 'throw'); }
});

test('stars leave the game when they fly off screen', () => {
  const { game, thrower } = throwerGame();
  thrower.cooldown = 99;
  game.projectiles.push({ x: game.player.x + 20, y: game.player.y, z: game.player.z + DEPTH_REACH + 1, facing: 1 });
  for (let i = 0; i < 240; i++) game.step(STEP, idle);
  assert.equal(game.projectiles.length, 0);
});

// A game with one enemy standing right in front of the player, lined up in depth.
function duel(type, gap = 12) {
  const game = new Game({ input: null, rng: () => 0.5 });
  game.start();
  const p = game.player;
  const e = new Enemy(type, p.x + gap, -1, () => 0.5, p.z);
  e.cooldown = 99;
  game.enemies.push(e);
  return { game, enemy: e };
}

test('punch and kick together grab the enemy in front and throw them forward', () => {
  const { game, enemy } = duel('striker');
  const hp = enemy.hp;
  const startX = enemy.x;
  game.step(STEP, { ...idle, punch: true, kick: true });
  assert.equal(game.player.attack.name, 'grab');
  for (let i = 0; i < 20 && !enemy.thrown; i++) game.step(STEP, idle);
  assert.equal(enemy.thrown, true, 'the grab connected');
  assert.equal(game.player.attack.name, 'throw');
  assert.equal(enemy.hp, hp - GRAB.damage);
  assert.equal(game.combo, 1);
  assert.ok(game.texts.some((t) => t.text === 'THROW!'));
  for (let i = 0; i < 120 && !enemy.grounded; i++) game.step(STEP, idle);
  assert.ok(enemy.x > startX + 40, `landed well ahead (${enemy.x - startX})`);
  assert.equal(enemy.down, true);
  // Strikes pass over a fighter on the floor.
  game.player.x = enemy.x - 12;
  game.player.facing = 1;
  game.step(STEP, { ...idle, punch: true });
  for (let i = 0; i < 12; i++) game.step(STEP, idle);
  assert.equal(enemy.hp, hp - GRAB.damage, 'no damage while down');
});

test('a grab goes through a guard, so it beats Master Kage blocking', () => {
  const { game, enemy } = duel('boss');
  enemy.blockTimer = 2;
  enemy.blocking = true;
  const hp = enemy.hp;
  game.step(STEP, { ...idle, punch: true, kick: true });
  for (let i = 0; i < 20 && !enemy.thrown; i++) game.step(STEP, idle);
  assert.equal(enemy.thrown, true);
  assert.equal(enemy.hp, hp - GRAB.damage);
  assert.ok(!game.texts.some((t) => t.text === 'BLOCK'));
});

test('a grab with nobody in reach just whiffs', () => {
  const { game, enemy } = duel('striker', 60);
  game.step(STEP, { ...idle, punch: true, kick: true });
  for (let i = 0; i < 30; i++) game.step(STEP, idle);
  assert.equal(enemy.thrown, false);
  assert.equal(enemy.hp, enemy.maxHp);
  assert.equal(game.player.attack, null, 'the grab finished on its own');
});

test('holding back while an enemy strikes blocks the strike', () => {
  const { game, enemy } = duel('striker', 16);
  enemy.cooldown = 0;
  const p = game.player;
  let blockedFrames = 0, facedWhileBlocking = true, sawBlockText = false;
  for (let i = 0; i < 90; i++) {
    game.step(STEP, { ...idle, left: true });
    if (p.blocking) { blockedFrames++; if (p.facing !== 1) facedWhileBlocking = false; }
    if (game.texts.some((t) => t.text === 'BLOCK')) sawBlockText = true;
  }
  assert.ok(enemy.attack || enemy.cooldown > 0, 'the striker attacked');
  assert.ok(blockedFrames > 0, 'the player raised a guard by holding back');
  assert.equal(p.hp, 100, 'the punch was blocked');
  assert.ok(facedWhileBlocking, 'kept facing the striker while the guard was up');
  assert.ok(sawBlockText, 'the BLOCK text appeared');

  // With nothing coming in, holding back simply walks away from the enemy.
  const calm = duel('striker', 16);
  calm.enemy.cooldown = 99;
  const x = calm.game.player.x;
  for (let i = 0; i < 30; i++) calm.game.step(STEP, { ...idle, left: true });
  assert.ok(calm.game.player.x < x - 20, 'walked away');
  assert.equal(calm.game.player.facing, -1);
});

test('holding back once a throwing star is in flight blocks it', () => {
  const { game } = throwerGame();
  // Stand still until the star is on its way, then hold away from it.
  let thrown = false, blocked = 0;
  for (let i = 0; i < 180; i++) {
    game.step(STEP, game.projectiles.length ? { ...idle, left: true } : idle);
    if (game.projectiles.length) thrown = true;
    if (game.player.blocking) blocked++;
    if (thrown && !game.projectiles.length) break;
  }
  assert.ok(thrown, 'a star was thrown');
  assert.ok(blocked > 0, 'the guard went up as the star came close');
  assert.equal(game.player.hp, 100, 'blocked by holding back');
  assert.equal(game.player.facing, 1);
});

test('pause stops the simulation and restart resets everything', () => {
  const game = new Game({ input: null, rng: seededRng(1) });
  game.start();
  for (let i = 0; i < 120; i++) game.step(STEP, idle);
  const before = game.elapsed;
  game.pause();
  assert.equal(game.state, 'paused');
  game.step(STEP, idle);
  assert.equal(game.elapsed, before, 'no time passes while paused');
  game.resume();
  game.step(STEP, idle);
  assert.ok(game.elapsed > before);
  game.start();
  assert.equal(game.elapsed, 0);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.score, 0);
});
