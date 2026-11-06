// Replay checksum: a scripted playthrough with a fixed random seed must produce exactly the
// same positions, health, score and state on every frame as the recorded baseline. Any change
// to movement, combat, AI, waves or scoring changes the checksum; drawing code cannot.
// Refresh on purpose with: UPDATE_BASELINE=1 node --test test/replay.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { Game } from '../src/game.js';
import { STEP, DEPTH_REACH } from '../src/constants.js';

const FIXTURE = new URL('./fixtures/replay.json', import.meta.url);
const SEEDS = [7, 3];
const MAX_SECONDS = 180;

function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const idle = { left: false, right: false, up: false, down: false, duck: false, block: false, jump: false, punch: false, kick: false, kiai: false };

// Same bot as the playthrough test, plus Kiai against the boss so that code path is covered.
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
  return { ...idle, punch: !p.attack, kiai: Boolean(e.cfg.boss) && p.kiaiReady };
}

// FNV-1a over the frame summaries, kept as a 32-bit hex string.
function fnv(hash, str) {
  for (let i = 0; i < str.length; i++) { hash ^= str.charCodeAt(i); hash = Math.imul(hash, 16777619) >>> 0; }
  return hash;
}
const r = (v) => Math.round(v * 1000) / 1000;

export function replay(seed) {
  const game = new Game({ input: null, rng: seededRng(seed) });
  game.start();
  let hash = 2166136261, steps = 0;
  while (game.state === 'playing' && steps < MAX_SECONDS / STEP) {
    game.step(STEP, botInput(game));
    steps += 1;
    const p = game.player;
    const frame = [
      r(p.x), r(p.z), r(p.y), p.hp, p.state, p.facing, p.kiaiActive ? 1 : 0,
      game.enemies.map((e) => `${e.kind}:${r(e.x)}:${r(e.z)}:${e.hp}:${e.state}`).join('|'),
      game.projectiles.length, game.score, game.combo, r(game.camX), game.zoneIndex, game.state,
    ].join(',');
    hash = fnv(hash, frame);
  }
  return { seed, steps, hash: hash.toString(16).padStart(8, '0'), finalState: game.state, score: game.score, elapsed: r(game.elapsed) };
}

test('scripted playthroughs replay frame-for-frame identically to the recorded baseline', () => {
  const current = JSON.stringify(SEEDS.map(replay), null, 2);
  if (process.env.UPDATE_BASELINE) { writeFileSync(FIXTURE, current + '\n'); return; }
  const baseline = readFileSync(FIXTURE, 'utf8').trimEnd();
  assert.equal(current, baseline, 'simulation diverged from the baseline: gameplay behaviour changed');
});
