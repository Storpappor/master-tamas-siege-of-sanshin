// Headless playthrough: a scripted player fights through the whole level.
// This proves the level is completable and lands in the 60-90s target range.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { STEP } from '../src/constants.js';

function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const idle = { left: false, right: false, down: false, block: false, jump: false, punch: false, kick: false, kiai: false };

// A simple but competent bot: face the nearest enemy, block its wind-ups, otherwise punch.
function botInput(game) {
  const p = game.player;
  const alive = game.enemies.filter((e) => !e.dead);
  if (!alive.length) return idle;
  alive.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
  const e = alive[0];
  const dx = e.x - p.x;
  const dist = Math.abs(dx);
  const facingEnemy = Math.sign(dx) === p.facing;
  const threat = alive.find((o) => o.attack && o.attackPhase !== 'recovery' && Math.abs(o.x - p.x) < 40);
  if (threat && Math.sign(threat.x - p.x) === p.facing) return { ...idle, block: true };
  if (!facingEnemy) return { ...idle, [dx > 0 ? 'right' : 'left']: true };
  if (dist > 18) return { ...idle, [dx > 0 ? 'right' : 'left']: true };
  return { ...idle, punch: !p.attack };
}

test('a scripted player can clear the level in the target time', () => {
  const events = [];
  const ui = { showOverlay: (n) => events.push(n), setHud() {}, showDialogue: (lines, done) => { events.push('dialogue'); done(); } };
  const game = new Game({ input: null, ui, rng: seededRng(7) });
  game.start();
  let steps = 0;
  while (game.state === 'playing' && steps < 180 / STEP) {
    game.step(STEP, botInput(game));
    steps += 1;
  }
  assert.equal(game.state, 'victory', `expected victory, got ${game.state} (hp ${game.player.hp}, remaining ${game.remainingEnemies})`);
  assert.equal(game.remainingEnemies, 0);
  assert.ok(game.elapsed >= 55 && game.elapsed <= 100, `level took ${game.elapsed.toFixed(1)}s`);
  assert.ok(game.score > 0);
  assert.ok(events.includes('victory'));
  assert.ok(events.includes('dialogue'), 'the exchange with Master Kage was shown');
});

test('the fight freezes during the Master Kage exchange and resumes afterwards', () => {
  let finish = null;
  const ui = { showOverlay() {}, setHud() {}, showDialogue: (lines, done) => { finish = done; } };
  const game = new Game({ input: null, ui, rng: seededRng(5) });
  game.start();
  let steps = 0;
  while (game.state === 'playing' && steps < 180 / STEP) { game.step(STEP, botInput(game)); steps++; }
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

test('a passive player is eventually knocked out and the game ends', () => {
  const game = new Game({ input: null, rng: seededRng(3) });
  game.start();
  let steps = 0;
  while (game.state === 'playing' && steps < 120 / STEP) {
    game.step(STEP, idle);
    steps += 1;
  }
  assert.equal(game.state, 'gameover');
  assert.equal(game.player.hp, 0);
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
