// Geometry pin: every number the artwork is measured against, and every gameplay table, must
// stay byte-identical to the recorded baseline. Visual work can never move the floor, the
// zones, the door, a hitbox or an attack timing without this test failing.
// Refresh the baseline on purpose with: UPDATE_BASELINE=1 node --test test/geometry.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import * as constants from '../src/constants.js';
import { ATTACKS, HIGH_ATTACKS, LOW_ATTACKS, HURTBOX } from '../src/combat.js';
import { ENEMY_TYPES } from '../src/entities.js';
import { LEVEL_1 } from '../src/level.js';

const FIXTURE = new URL('./fixtures/geometry.json', import.meta.url);

export function geometrySnapshot() {
  const { screenY, COLORS, ...numbers } = constants; // colours are art, not geometry
  return {
    constants: numbers,
    attacks: ATTACKS,
    highAttacks: [...HIGH_ATTACKS].sort(),
    lowAttacks: [...LOW_ATTACKS].sort(),
    hurtbox: HURTBOX,
    enemies: ENEMY_TYPES,
    level: LEVEL_1,
    screenYSamples: [[150, 0], [150, 24], [150, 48], [110, 24]].map(([y, z]) => screenY(y, z)),
  };
}

test('geometry, attack tables, enemy stats and level layout match the recorded baseline', () => {
  const current = JSON.stringify(geometrySnapshot(), null, 2);
  if (process.env.UPDATE_BASELINE) { writeFileSync(FIXTURE, current + '\n'); return; }
  const baseline = readFileSync(FIXTURE, 'utf8').trimEnd();
  assert.equal(current, baseline, 'gameplay geometry changed: if intentional, refresh test/fixtures/geometry.json');
});
