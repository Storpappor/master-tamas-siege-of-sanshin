import test from 'node:test';
import assert from 'node:assert/strict';
import { displayText, DISPLAY_NAMES } from '../src/names.js';
import { KAGE_DIALOGUE } from '../src/game.js';
import { ENEMY_TYPES } from '../src/entities.js';

test('the boss is presented as Råttfällan while the internal name stays Master Kage', () => {
  assert.equal(ENEMY_TYPES.boss.label, 'Master Kage', 'internal label untouched');
  assert.equal(DISPLAY_NAMES[ENEMY_TYPES.boss.label], 'Råttfällan');
  assert.equal(displayText('MASTER KAGE APPROACHES'), 'RÅTTFÄLLAN APPROACHES');
  assert.equal(displayText('Master Kage'), 'Råttfällan');
  assert.equal(displayText("Kage's red bar"), "Råttfällan's red bar");
  assert.equal(displayText('TAMAS: DET ÄR JÄVLA SHIT.'), 'TAMAS: DET ÄR JÄVLA SHIT.', 'other lines pass through');
});

test('the boss dialogue speaker label maps to the display name', () => {
  const spoken = KAGE_DIALOGUE.flat().map(displayText);
  assert.ok(spoken.some((l) => l.startsWith('RÅTTFÄLLAN:')), spoken.join(' | '));
  assert.ok(!spoken.some((l) => /KAGE/.test(l)));
});
