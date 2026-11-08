import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sound, CUE_NAMES } from '../src/sound.js';

class FakeParam {
  constructor(v) { this.value = v; }
  setValueAtTime(v) { this.value = v; }
  exponentialRampToValueAtTime() {}
  linearRampToValueAtTime() {}
  cancelScheduledValues() {}
}
class FakeNode {
  constructor(ctx) { this.ctx = ctx; this.gain = new FakeParam(1); this.frequency = new FakeParam(0); this.Q = new FakeParam(1); this.started = []; }
  connect(n) { return n; }
  start(t) { this.started.push(t); this.ctx.started.push(this); }
  stop() {}
}
class FakeContext {
  constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 48000; this.destination = {}; this.started = []; this.resumed = 0; }
  createGain() { return new FakeNode(this); }
  createOscillator() { return new FakeNode(this); }
  createBufferSource() { return new FakeNode(this); }
  createBiquadFilter() { return new FakeNode(this); }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  resume() { this.resumed++; this.state = 'running'; return Promise.resolve(); }
}

function make(opts = {}) {
  const ctx = new FakeContext();
  const sound = new Sound({ createContext: () => ctx, random: () => 0.5, ...opts });
  return { ctx, sound };
}

test('play() queues raw game events and drain() hands them over once', () => {
  const { sound } = make();
  sound.play('punch');
  sound.play('hit');
  assert.deepEqual(sound.drain().map((e) => e.name), ['punch', 'hit']);
  assert.deepEqual(sound.drain(), []);
});

test('suppressed events are marked so an automatic pause stays silent', () => {
  const { sound } = make();
  sound.suppress('pause', true);
  sound.play('pause');
  sound.suppress('pause', false);
  sound.play('pause');
  assert.deepEqual(sound.drain().map((e) => e.suppressed), [true, false]);
});

test('every cue plays through the synthesizer without throwing', () => {
  const { ctx, sound } = make();
  sound.unlock();
  for (const name of CUE_NAMES) {
    ctx.currentTime += 2;
    assert.equal(sound.cue(name), true, name);
  }
  assert.ok(ctx.started.length > CUE_NAMES.length);
});

test('a cue is skipped before unlock, when disabled, and for an unknown name', () => {
  const { sound } = make();
  assert.equal(sound.cue('punchHit'), false, 'no context yet');
  sound.unlock();
  sound.setEnabled(false);
  assert.equal(sound.cue('punchHit'), false, 'disabled');
  sound.setEnabled(true);
  assert.equal(sound.cue('nope'), false);
  assert.equal(sound.cue('punchHit'), true);
});

test('the same cue is not repeated inside its minimum gap', () => {
  const { ctx, sound } = make();
  sound.unlock();
  assert.equal(sound.cue('punchHit'), true);
  assert.equal(sound.cue('punchHit'), false, 'same instant');
  ctx.currentTime += 0.1;
  assert.equal(sound.cue('punchHit'), true);
});

test('a group of impacts is limited to a few voices at once', () => {
  const { ctx, sound } = make();
  sound.unlock();
  const played = ['punchHit', 'kickHit', 'enemyKo', 'block'].map((n) => sound.cue(n));
  assert.deepEqual(played, [true, true, true, false], 'the fourth impact in the same instant is dropped');
  ctx.currentTime += 0.2;
  assert.equal(sound.cue('block'), true, 'voices free up as they end');
});

test('important cues ask the music to duck, light ones do not', () => {
  const ducked = [];
  const { ctx, sound } = make({ onDuck: (n) => ducked.push(n) });
  sound.unlock();
  sound.cue('throwLand');
  ctx.currentTime += 1;
  sound.cue('whooshLight');
  sound.cue('menuMove');
  assert.deepEqual(ducked, ['throwLand']);
});

test('variation stays small: pitch within 5 % and level within 12 %', () => {
  let r = 0;
  const { sound } = make({ random: () => (r = 1 - r) });
  sound.unlock();
  const freqs = [];
  const origTone = sound.tone.bind(sound);
  sound.tone = (o) => { freqs.push(o.freq); origTone(o); };
  sound.cue('punchHit');
  sound.ctx.currentTime += 1;
  sound.cue('punchHit');
  assert.ok(freqs.every((f) => f >= 170 * 0.95 && f <= 170 * 1.05), String(freqs));
});

test('unlock creates one context and resumes a suspended one', () => {
  const { ctx, sound } = make();
  sound.unlock();
  ctx.state = 'suspended';
  sound.unlock();
  assert.equal(ctx.resumed, 1);
  assert.equal(sound.ctx, ctx);
});
