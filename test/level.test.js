import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_1, Spawner, totalEnemies } from '../src/level.js';
import { ENEMY_TYPES } from '../src/entities.js';
import { STEP, WORLD_WIDTH } from '../src/constants.js';

test('level is laid out in order, inside the world, and ends with the boss', () => {
  let prevX = -1;
  for (const wave of LEVEL_1.waves) {
    assert.ok(wave.x > prevX, 'waves ordered along the level');
    assert.ok(wave.x < WORLD_WIDTH);
    prevX = wave.x;
    let prevDelay = -1;
    for (const s of wave.spawns) {
      assert.ok(s.delay >= prevDelay, 'spawns sorted by delay');
      assert.ok(ENEMY_TYPES[s.type], `known type ${s.type}`);
      assert.ok(['left', 'right'].includes(s.side));
      prevDelay = s.delay;
    }
  }
  const all = LEVEL_1.waves.flatMap((w) => w.spawns);
  assert.equal(totalEnemies(LEVEL_1), all.length);
  assert.equal(all.at(-1).type, 'boss');
  assert.equal(all.filter((s) => s.type === 'boss').length, 1);

  const zones = LEVEL_1.zones;
  assert.equal(zones[0].from, 0);
  assert.equal(zones.at(-1).to, WORLD_WIDTH);
  for (let i = 1; i < zones.length; i++) assert.equal(zones[i].from, zones[i - 1].to, 'zones are contiguous');
});

test('nothing spawns until the player reaches the wave', () => {
  const sp = new Spawner(LEVEL_1);
  for (let t = 0; t < 5; t += STEP) {
    assert.deepEqual(sp.update(STEP, { playerX: LEVEL_1.waves[0].x - 1, alive: 0 }), []);
  }
  assert.equal(sp.lockX, null);
  sp.update(STEP, { playerX: LEVEL_1.waves[0].x, alive: 0 });
  assert.notEqual(sp.lockX, null, 'camera locks when the wave starts');
});

test('a wave holds the lock until beaten, respecting the max-alive cap', () => {
  const level = {
    maxAlive: 2,
    zones: [],
    waves: [{ x: 10, spawns: [0, 0, 0].map(() => ({ delay: 0, side: 'right', type: 'striker' })) }],
  };
  const sp = new Spawner(level);
  const first = sp.update(STEP, { playerX: 10, alive: 0 });
  assert.equal(first.length, 2, 'capped at maxAlive');
  assert.notEqual(sp.lockX, null);
  assert.equal(sp.update(STEP, { playerX: 10, alive: 2 }).length, 0);
  assert.equal(sp.update(STEP, { playerX: 10, alive: 1 }).length, 1, 'next enemy once there is room');
  sp.update(STEP, { playerX: 10, alive: 1 });
  assert.notEqual(sp.lockX, null, 'still locked with an enemy alive');
  sp.update(STEP, { playerX: 10, alive: 0 });
  assert.equal(sp.lockX, null, 'unlocked when the wave is beaten');
  assert.equal(sp.finished, true);
});
