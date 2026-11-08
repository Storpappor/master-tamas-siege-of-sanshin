// The hand-drawn background path through the real world builder: a valid image is blitted 1:1 at its
// zone's art column, anything else keeps the procedural painter, and each zone is decided on its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld } from '../src/renderer.js';
import { validateBackground } from '../src/background.js';
import { LEVEL_1 } from '../src/level.js';

// A canvas whose context records every call it receives and accepts every property it is given.
function recordingCanvas(calls) {
  return (w, h) => ({ width: w, height: h, getContext: () => new Proxy({}, {
    get: (_, name) => (...args) => { calls.push([name, args]); },
    set: () => true,
  }) });
}
const street = LEVEL_1.zones.find((z) => z.art === 'street');
const dojo = LEVEL_1.zones.find((z) => z.art === 'dojo');
const valid = { naturalWidth: 1840, naturalHeight: 360 };
const validStreet = { naturalWidth: 2000, naturalHeight: 360 };

test('a valid street image is blitted 1:1 at art column 0 and both zones can be hand-drawn at once', () => {
  const calls = [];
  buildWorld(recordingCanvas(calls), LEVEL_1.zones, { street: validStreet, dojo: valid });
  const blits = calls.filter(([name]) => name === 'drawImage');
  assert.equal(blits.length, 2, 'one blit per zone');
  assert.deepEqual(blits[0][1], [validStreet, 0, 0], 'street at art column 0, row 0, no scaling');
  assert.deepEqual(blits[1][1], [valid, dojo.from * 2, 0], 'dojo at art column 2000');
  assert.equal(calls.filter(([name]) => name === 'fillRect').length, 0, 'nothing painted procedurally');
  assert.equal(validateBackground(validStreet, street), null);
  assert.match(validateBackground(valid, street), /expected 2000x360/);
});

test('a valid dojo image is blitted 1:1 at the zone art column and the street keeps its painter', () => {
  const calls = [];
  buildWorld(recordingCanvas(calls), LEVEL_1.zones, { dojo: valid });
  const blits = calls.filter(([name]) => name === 'drawImage');
  assert.equal(blits.length, 1, 'exactly one image blit');
  assert.deepEqual(blits[0][1], [valid, dojo.from * 2, 0], 'art column 2000, row 0, no scaling');
  const reset = calls.findIndex(([name, args]) => name === 'setTransform' && args.join() === '1,0,0,1,0,0');
  assert.ok(reset >= 0 && reset < calls.indexOf(blits[0]), 'the blit happens in art-pixel space');
  assert.ok(calls.some(([name]) => name === 'fillRect'), 'the street zone was still painted procedurally');
});

test('a missing, failed or wrong-sized image keeps the procedural dojo', () => {
  for (const images of [null, {}, { dojo: null }, { dojo: { naturalWidth: 640, naturalHeight: 360 } }]) {
    const calls = [];
    buildWorld(recordingCanvas(calls), LEVEL_1.zones, images);
    assert.equal(calls.filter(([name]) => name === 'drawImage').length, 0, `no blit for ${JSON.stringify(images)}`);
    assert.ok(calls.filter(([name]) => name === 'fillRect').length > 0, 'both zones painted procedurally');
  }
  assert.equal(validateBackground(valid, dojo), null);
  assert.match(validateBackground({ naturalWidth: 1840, naturalHeight: 359 }, dojo), /expected 1840x360/);
  assert.match(validateBackground(null, dojo), /no background image/);
});
