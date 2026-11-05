import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_1, Spawner, totalEnemies } from '../src/level.js';
import { ENEMY_TYPES } from '../src/entities.js';
import { STEP } from '../src/constants.js';

test('level spawns are ordered, use known enemy types and end within the target window', () => {
  let prev = -1;
  for (const s of LEVEL_1.spawns) {
    assert.ok(s.t >= prev, 'spawns sorted by time');
    assert.ok(ENEMY_TYPES[s.type], `known type ${s.type}`);
    assert.ok(['left', 'right'].includes(s.side));
    prev = s.t;
  }
  assert.equal(totalEnemies(LEVEL_1), LEVEL_1.spawns.length + 1);
  assert.ok(prev >= 40 && prev <= 60, `last regular spawn at ${prev}s`);
  const kinds = new Set(LEVEL_1.spawns.map((s) => s.type));
  assert.ok(kinds.size >= 2, 'at least two enemy behaviours');
});

test('spawner respects the max-alive cap and releases the boss only when the hall is clear', () => {
  const sp = new Spawner(LEVEL_1);
  let alive = 0, defeated = 0, spawned = 0, boss = null;
  for (let t = 0; t < 120 && !boss; t += STEP) {
    for (const s of sp.update(STEP, { alive, defeatedRegular: defeated })) {
      if (s.type === 'boss') { boss = { t }; break; }
      spawned += 1;
      alive += 1;
      assert.ok(alive <= LEVEL_1.maxAlive, 'never more than maxAlive');
    }
    // Pretend the player beats one enemy every 1.5 seconds.
    if (alive > 0 && Math.round(t / STEP) % Math.round(1.5 / STEP) === 0) { alive -= 1; defeated += 1; }
  }
  assert.equal(spawned, LEVEL_1.spawns.length);
  assert.ok(boss, 'boss spawned');
  assert.ok(boss.t > LEVEL_1.spawns.at(-1).t, 'boss comes after the last regular spawn');
});
