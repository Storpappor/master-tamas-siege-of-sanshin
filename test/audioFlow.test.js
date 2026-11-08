// The director and the real mixer together: what happens to the music when tracks are missing,
// starting from a stage track that is actually playing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudioDirector } from '../src/audioDirector.js';
import { MusicMixer } from '../src/music.js';

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
  start(when, offset) { this.started = { when, offset }; }
  stop(when = this.ctx.currentTime) { this.stopped = when; }
  get live() { return this.started && (this.stopped === null || this.stopped > this.ctx.currentTime); }
}
class FakeContext {
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; this.sources = []; }
  createGain() { return { gain: new FakeParam(1), connect() {} }; }
  createBufferSource() { const s = new FakeSource(this); this.sources.push(s); return s; }
  decodeAudioData() { return Promise.resolve({ duration: 120 }); }
  resume() { return Promise.resolve(); }
}
const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeSound() {
  const s = { queue: [], cues: [], suppressed: new Set() };
  s.play = (name) => s.queue.push({ name, suppressed: s.suppressed.has(name) });
  s.suppress = (name, on) => { if (on) s.suppressed.add(name); else s.suppressed.delete(name); };
  s.drain = () => { const q = s.queue; s.queue = []; return q; };
  s.cue = (name) => { s.cues.push(name); return true; };
  return s;
}

// Stage track playing in a run; menu and boss tracks as given (null = pending).
async function playingStage({ menu = null, boss = null } = {}) {
  const ctx = new FakeContext();
  const music = new MusicMixer({
    tracks: { stage: { src: 's.mp3', loopStart: 1, loopEnd: 100 }, menu: { src: menu }, boss: { src: boss } },
    createContext: () => ctx, fetchBytes: async () => new ArrayBuffer(8),
  });
  await music.load();
  music.unlock();
  await tick();
  const game = { state: 'start', ending: null, transition: null, boss: null, player: { attack: null }, enemies: [] };
  const sound = fakeSound();
  const director = createAudioDirector({ game, sound, music });
  director.update();
  game.state = 'playing';
  sound.play('start');
  director.update();
  ctx.currentTime = 30;
  const stageSource = ctx.sources.at(-1);
  assert.ok(stageSource.live && music.current === 'stage', 'precondition: the stage track is playing');
  sound.cues.length = 0;
  return { ctx, music, game, sound, director, stageSource };
}

const liveSources = (ctx) => ctx.sources.filter((s) => s.live).length;

test('boss with no boss track: the stage track carries on, unrestarted, under the entrance cue', async () => {
  const { ctx, music, game, sound, director, stageSource } = await playingStage();
  game.boss = { dead: false };
  game.state = 'dialogue';
  sound.play('bossAppear');
  director.update();
  game.state = 'playing';
  director.update();
  assert.deepEqual(sound.cues, ['bossEnter']);
  assert.equal(music.current, 'stage');
  assert.equal(ctx.sources.at(-1), stageSource, 'same source: no restart, no second track');
  assert.equal(liveSources(ctx), 1);
  game.boss.dead = true;
  director.update();
  assert.equal(ctx.sources.at(-1), stageSource, 'the boss falling changes nothing either');
});

test('run ends with no menu track: the stage fades under the jingle and the result screen stays quiet', async () => {
  const { ctx, music, game, sound, director, stageSource } = await playingStage();
  game.ending = 'gameover';
  sound.play('gameOver');
  director.update();
  assert.deepEqual(sound.cues, ['gameOver']);
  assert.equal(stageSource.stopped, 30.5, 'half-second fade on the stage track');
  ctx.currentTime = 32;
  game.state = 'gameover';
  for (let i = 0; i < 5; i++) director.update();
  assert.equal(music.current, null);
  assert.equal(liveSources(ctx), 0, 'nothing plays on the result screen');
  assert.equal(ctx.sources.length, 1, 'no track was started as a fallback');
  assert.deepEqual(sound.cues, ['gameOver'], 'only the jingle');
});

test('run ends with a menu track present: the menu theme takes the result screen after the fade', async () => {
  const { ctx, music, game, sound, director } = await playingStage({ menu: 'm.mp3' });
  game.ending = 'victory';
  sound.play('victory');
  director.update();
  ctx.currentTime = 32;
  game.state = 'victory';
  director.update();
  assert.equal(music.current, 'menu');
  assert.equal(liveSources(ctx), 1);
  assert.deepEqual(sound.cues, ['victory']);
});

test('pause, a hidden tab and the global mute silence the music whatever the fallbacks', async () => {
  const { ctx, music, game, sound, director } = await playingStage({ menu: 'm.mp3', boss: 'b.mp3' });
  game.state = 'paused';
  sound.play('pause');
  director.update();
  assert.equal(liveSources(ctx), 0, 'paused: silent');
  assert.deepEqual(sound.cues, ['pauseCue']);
  for (let i = 0; i < 3; i++) director.update();
  assert.equal(liveSources(ctx), 0, 'still silent while paused');
  game.state = 'playing';
  director.update();
  assert.equal(liveSources(ctx), 1, 'resume brings the stage back');
  assert.equal(ctx.sources.at(-1).started.offset, 30, 'from where it was');

  music.setPageActive(false);
  director.update();
  game.boss = { dead: false };            // Kage's dialogue opens while the tab is hidden
  game.state = 'dialogue';
  sound.play('bossAppear');
  director.update();
  assert.equal(liveSources(ctx), 0, 'hidden tab: the boss track is wanted but held');
  assert.equal(music.current, 'boss');
  music.setPageActive(true);
  assert.equal(liveSources(ctx), 1, 'back: the boss track plays');
  game.state = 'playing';
  director.update();

  music.setEnabled(false);
  director.update();
  game.ending = 'victory';
  director.update();
  ctx.currentTime = 40;
  game.state = 'victory';
  for (let i = 0; i < 3; i++) director.update();
  assert.equal(liveSources(ctx), 0, 'muted: the menu theme is wanted on the result screen but silent');
  assert.equal(music.current, 'menu');
  music.setEnabled(true);
  assert.equal(liveSources(ctx), 1, 'unmuted on the result screen: the menu theme plays');
});

test('a new run from a quiet result screen restarts the stage track once', async () => {
  const { ctx, game, sound, director } = await playingStage();
  game.ending = 'gameover';
  sound.play('gameOver');
  director.update();
  ctx.currentTime = 33;
  game.state = 'gameover';
  director.update();
  game.state = 'playing'; game.ending = null;
  sound.play('start');
  director.update();
  assert.equal(liveSources(ctx), 1);
  assert.deepEqual(ctx.sources.at(-1).started, { when: 33, offset: 0 });
  assert.deepEqual(sound.cues, ['gameOver', 'gameStart']);
});
