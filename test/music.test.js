import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Music } from '../src/music.js';

// A minimal stand-in for the Web Audio objects the music module touches.
class FakeParam {
  constructor(value) { this.value = value; this.events = []; }
  setValueAtTime(v, t) { this.events.push(['set', v, t]); this.value = v; }
  linearRampToValueAtTime(v, t) { this.events.push(['ramp', v, t]); }
  cancelScheduledValues(t) { this.events.push(['cancel', t]); }
}

class FakeSource {
  constructor(ctx) { this.ctx = ctx; this.loop = false; this.started = null; this.stopped = null; }
  connect() {}
  disconnect() {}
  start(when, offset) { if (this.started) throw new Error('started twice'); this.started = { when, offset }; }
  stop(when = this.ctx.currentTime) { this.stopped = when; }
  get live() { return this.started && this.stopped === null; }
}

class FakeContext {
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; this.sources = []; this.resumed = 0; }
  createGain() { const g = { gain: new FakeParam(1), connect() {} }; this.gainNode = g; return g; }
  createBufferSource() { const s = new FakeSource(this); this.sources.push(s); return s; }
  decodeAudioData() { return Promise.resolve({ duration: 120 }); }
  resume() { this.resumed++; this.state = 'running'; return Promise.resolve(); }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

async function make({ fetchBytes = async () => new ArrayBuffer(8), loopStart = 0, loopEnd = 0, ...opts } = {}) {
  const ctx = new FakeContext();
  const music = new Music({ url: 'x.mp3', createContext: () => ctx, fetchBytes, loopStart, loopEnd, ...opts });
  return { ctx, music };
}

async function loaded(opts) {
  const made = await make(opts);
  await made.music.load();
  made.music.unlock();
  await tick();
  assert.ok(made.music.ready);
  return made;
}

test('start plays once the track has loaded, if it is still wanted', async () => {
  let resolveFetch;
  const { ctx, music } = await make({ fetchBytes: () => new Promise((r) => { resolveFetch = r; }) });
  const loading = music.load();
  music.unlock();
  music.start();
  assert.equal(ctx.sources.length, 0, 'nothing to play yet');
  resolveFetch(new ArrayBuffer(8));
  await loading; await tick();
  assert.equal(ctx.sources.length, 1);
  assert.deepEqual(ctx.sources[0].started, { when: 0, offset: 0 });
  assert.equal(ctx.sources[0].loop, true);
});

for (const [name, act] of [
  ['paused', (m) => m.pause()],
  ['muted', (m) => m.setEnabled(false)],
  ['ended', (m) => m.fadeOut()],
  ['hidden', (m) => m.setPageActive(false)],
]) {
  test(`a late load does not start music that was ${name} meanwhile`, async () => {
    let resolveFetch;
    const { ctx, music } = await make({ fetchBytes: () => new Promise((r) => { resolveFetch = r; }) });
    const loading = music.load();
    music.unlock();
    music.start();
    act(music);
    resolveFetch(new ArrayBuffer(8));
    await loading; await tick();
    assert.ok(music.ready);
    assert.equal(ctx.sources.length, 0);
  });
}

test('pause keeps the position and resume continues from it', async () => {
  const { ctx, music } = await loaded();
  music.start();
  ctx.currentTime = 10.5;
  music.pause();
  assert.equal(ctx.sources[0].stopped, 10.5);
  assert.equal(music.playing, false);
  ctx.currentTime = 20;
  music.resume();
  assert.equal(ctx.sources.length, 2);
  assert.deepEqual(ctx.sources[1].started, { when: 20, offset: 10.5 });
  assert.equal(ctx.sources[0].live, false, 'exactly one live source');
});

test('the position folds into the loop range', async () => {
  const { ctx, music } = await loaded({ loopStart: 2, loopEnd: 12 });
  music.start();
  assert.equal(ctx.sources[0].loopStart, 2);
  assert.equal(ctx.sources[0].loopEnd, 12);
  ctx.currentTime = 25; // 0 -> 12 is the first pass, then 10 s loops: 25 = 12 + 13 -> 2 + 3
  music.pause();
  assert.equal(music.position, 5);
});

test('the loop end defaults to the end of the track', async () => {
  const { ctx, music } = await loaded();
  music.start();
  assert.equal(ctx.sources[0].loopEnd, 120);
});

test('fade out ramps only the music gain and stops the source after the fade', async () => {
  const { ctx, music } = await loaded({ fadeOut: 0.5 });
  music.start();
  ctx.currentTime = 3;
  music.fadeOut();
  const events = ctx.gainNode.gain.events;
  assert.deepEqual(events.slice(-2), [['set', 0.15, 3], ['ramp', 0, 3.5]]);
  assert.equal(ctx.sources[0].stopped, 3.5);
  assert.equal(music.playing, false);
  assert.equal(music.intent, 'stopped');
  music.resume();
  assert.equal(ctx.sources.length, 1, 'resume after the end does nothing');
});

test('a new run during the fade cuts the fade and restarts at full volume', async () => {
  const { ctx, music } = await loaded();
  music.start();
  ctx.currentTime = 3;
  music.fadeOut();
  ctx.currentTime = 3.2;
  music.start();
  assert.equal(ctx.sources[0].stopped, 3.2, 'fading source cut now');
  assert.equal(ctx.sources.length, 2);
  assert.deepEqual(ctx.sources[1].started, { when: 3.2, offset: 0 });
  assert.equal(ctx.gainNode.gain.value, 0.15);
});

test('restarting keeps exactly one playback instance', async () => {
  const { ctx, music } = await loaded();
  music.start();
  ctx.currentTime = 5;
  music.start();
  assert.equal(ctx.sources.filter((s) => s.live).length, 1);
  assert.deepEqual(ctx.sources[1].started, { when: 5, offset: 0 });
});

test('the sound toggle holds the music and only resumes it when a run is still on', async () => {
  const { ctx, music } = await loaded();
  music.start();
  ctx.currentTime = 4;
  music.setEnabled(false);
  assert.equal(ctx.sources[0].stopped, 4);
  music.setEnabled(true);
  assert.deepEqual(ctx.sources[1].started, { when: 4, offset: 4 });
  music.pause();
  music.setEnabled(false);
  music.setEnabled(true);
  assert.equal(ctx.sources.filter((s) => s.live).length, 0, 'paused game: toggling sound on plays nothing');
  music.resume();
  assert.equal(ctx.sources.filter((s) => s.live).length, 1);
});

test('a hidden page holds the music and a visible one lets it continue', async () => {
  const { ctx, music } = await loaded();
  music.start();
  ctx.currentTime = 7;
  music.setPageActive(false);
  assert.equal(ctx.sources[0].stopped, 7);
  ctx.currentTime = 9;
  music.setPageActive(true);
  assert.deepEqual(ctx.sources[1].started, { when: 9, offset: 7 });
});

test('a failed download leaves the music inert and reports the error', async () => {
  const errors = [];
  const { ctx, music } = await make({ fetchBytes: async () => { throw new Error('404'); }, onError: (e) => errors.push(e.message) });
  await music.load();
  music.unlock();
  music.start();
  music.pause();
  music.resume();
  music.fadeOut();
  assert.deepEqual(errors, ['404']);
  assert.equal(ctx.sources.length, 0);
});

test('no Web Audio support leaves the music inert', async () => {
  const music = new Music({ url: 'x.mp3', createContext: () => null, fetchBytes: async () => new ArrayBuffer(8) });
  await music.load();
  music.unlock();
  music.start();
  assert.equal(music.playing, false);
});

test('unlock resumes a suspended context', async () => {
  const { ctx, music } = await make();
  ctx.state = 'suspended';
  music.unlock();
  assert.equal(ctx.resumed, 1);
});
