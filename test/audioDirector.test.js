import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudioDirector } from '../src/audioDirector.js';
import { Game } from '../src/game.js';
import { Enemy } from '../src/entities.js';
import { STEP, GRAB } from '../src/constants.js';

// Records what the director asks for; the real Sound and MusicMixer are tested on their own.
function fakeSound() {
  const s = { queue: [], cues: [], suppressed: new Set() };
  s.play = (name) => s.queue.push({ name, suppressed: s.suppressed.has(name) });
  s.suppress = (name, on) => { if (on) s.suppressed.add(name); else s.suppressed.delete(name); };
  s.drain = () => { const q = s.queue; s.queue = []; return q; };
  s.cue = (name) => { s.cues.push(name); return true; };
  return s;
}

function fakeMusic({ tracks = ['stage'] } = {}) {
  const m = { log: [], current: null, intent: 'stopped' };
  m.available = (n) => tracks.includes(n);
  m.play = (n, o = {}) => { if (!m.available(n)) return false; m.log.push(`play:${n}${o.fromStart ? ':top' : ''}`); m.current = n; m.intent = 'playing'; return true; };
  m.pause = () => { m.log.push('pause'); m.intent = 'paused'; };
  m.resume = () => { m.log.push('resume'); m.intent = 'playing'; };
  m.fadeOut = () => { m.log.push('fadeOut'); m.current = null; m.intent = 'stopped'; };
  m.stop = () => { m.log.push('stop'); m.current = null; m.intent = 'stopped'; };
  m.duck = () => {};
  return m;
}

// A minimal stand-in for the game when driving the real one is more than a test needs.
function fakeGame(over = {}) {
  return { state: 'start', ending: null, transition: null, boss: null, player: { attack: null }, enemies: [], ...over };
}

function setup(gameOver, musicOpts) {
  const game = gameOver instanceof Game ? gameOver : fakeGame(gameOver);
  const sound = fakeSound();
  const music = fakeMusic(musicOpts);
  const director = createAudioDirector({ game, sound, music });
  return { game, sound, music, director };
}

const idle = { left: false, right: false, up: false, down: false, duck: false, block: false, jump: false, punch: false, kick: false, kiai: false };

test('the title screen asks for the menu theme and a new run starts the stage track from the top', () => {
  const { game, sound, music, director } = setup({}, { tracks: ['stage', 'menu'] });
  director.update();
  assert.deepEqual(music.log, ['play:menu']);
  game.state = 'playing';
  sound.play('start');
  director.update();
  assert.deepEqual(music.log.slice(1), ['play:stage:top']);
  assert.deepEqual(sound.cues, ['gameStart']);
});

test('a pending menu theme is simply skipped', () => {
  const { music, director } = setup({}, { tracks: ['stage'] });
  director.update();
  assert.deepEqual(music.log, []);
});

test('the start event means a cleared wave or an opened door during a run', () => {
  const { game, sound, director } = setup({ state: 'playing' });
  director.update();
  sound.play('start');
  director.update();
  assert.deepEqual(sound.cues, ['waveClear']);
  game.transition = { phase: 'enter', t: 0 };
  sound.play('start');
  director.update();
  assert.deepEqual(sound.cues.slice(1), ['doorEnter']);
});

test('manual pause cues and holds the music; resume cues and continues it', () => {
  const { game, sound, music, director } = setup({ state: 'playing' });
  director.update();
  music.log.length = 0;
  game.state = 'paused';
  sound.play('pause');
  director.update();
  assert.deepEqual(music.log, ['pause']);
  assert.deepEqual(sound.cues, ['pauseCue']);
  game.state = 'playing';
  director.update();
  assert.deepEqual(music.log, ['pause', 'resume']);
  assert.deepEqual(sound.cues, ['pauseCue', 'resumeCue']);
});

test('an automatic pause is silent', () => {
  const { game, sound, music, director } = setup({ state: 'playing' });
  director.update();
  director.pauseSilently(() => { game.state = 'paused'; sound.play('pause'); });
  director.update();
  assert.deepEqual(music.log, ['pause']);
  assert.deepEqual(sound.cues, []);
  assert.equal(sound.suppressed.size, 0, 'suppression does not linger');
});

test('dialogue keeps the current track running', () => {
  const { game, music, director } = setup({ state: 'playing' });
  director.update();
  game.state = 'dialogue';
  director.update();
  game.state = 'playing';
  director.update();
  assert.deepEqual(music.log, []);
});

test('the boss entrance cues once and hands over to the boss track when it exists', () => {
  const { game, sound, music, director } = setup({ state: 'playing' }, { tracks: ['stage', 'boss'] });
  director.update();
  game.boss = { dead: false };
  sound.play('bossAppear');
  director.update();
  director.update();
  assert.deepEqual(sound.cues, ['bossEnter']);
  assert.deepEqual(music.log, ['play:boss:top']);
  game.boss.dead = true;
  director.update();
  assert.deepEqual(music.log.slice(1), ['play:stage'], 'back to the stage if play goes on');
});

test('without a boss track the stage music carries on through the boss', () => {
  const { game, sound, music, director } = setup({ state: 'playing' }, { tracks: ['stage'] });
  director.update();
  game.boss = { dead: false };
  sound.play('bossAppear');
  director.update();
  assert.deepEqual(sound.cues, ['bossEnter']);
  assert.deepEqual(music.log, []);
});

test('the end of a run fades the music under the result jingle, then the menu theme returns', () => {
  const { game, sound, music, director } = setup({ state: 'playing' }, { tracks: ['stage', 'menu'] });
  director.update();
  game.ending = 'victory';
  sound.play('victory');
  director.update();
  assert.deepEqual(music.log, ['fadeOut']);
  assert.deepEqual(sound.cues, ['victory']);
  game.state = 'victory';
  director.update();
  assert.deepEqual(music.log.slice(1), ['play:menu']);
  game.state = 'playing'; game.ending = null;
  sound.play('start');
  director.update();
  assert.deepEqual(music.log.slice(2), ['play:stage:top'], 'a new run restarts the stage track');
  assert.deepEqual(sound.cues.slice(1), ['gameStart']);
});

test('strikes: punch and kick whooshes, and the impact matches the last strike', () => {
  const { game, sound, director } = setup({ state: 'playing' });
  director.update();
  game.player.attack = { name: 'kick' };
  sound.play('kick');
  sound.play('hit');
  director.update();
  game.player.attack = { name: 'punch' };
  sound.play('punch');
  sound.play('hit');
  director.update();
  assert.deepEqual(sound.cues, ['whooshHeavy', 'kickHit', 'whooshLight', 'punchHit']);
});

test('a kiai strike landing is a heavy hit, a finishing blow a knockout', () => {
  const { sound, director } = setup({ state: 'playing' });
  director.update();
  sound.play('kiai');
  sound.play('hitHeavy');
  sound.play('enemyDown');
  director.update();
  assert.deepEqual(sound.cues, ['kiaiStrike', 'kiaiHit', 'enemyKo']);
});

test('grab and throw: reach, grip, toss, then the landing when the victim hits the floor', () => {
  const enemy = { thrown: false, dead: false, held: false, attack: null };
  const { game, sound, director } = setup({ state: 'playing', enemies: [enemy] });
  director.update();
  game.player.attack = { name: 'grab' };
  sound.play('punch');                       // the game reports a grab's start as a punch
  director.update();
  game.player.attack = { name: 'throw', released: false };
  enemy.held = true;
  director.update();
  game.player.attack.released = true;
  enemy.held = false; enemy.thrown = true;
  director.update();
  enemy.thrown = false; enemy.down = true;
  sound.play('hitHeavy');                    // the game's slam sound
  director.update();
  assert.deepEqual(sound.cues, ['grabReach', 'grabHold', 'throwToss', 'throwLand']);
});

test('a grab that already holds its victim when the frame ends is still the reach', () => {
  const { game, sound, director } = setup({ state: 'playing' });
  director.update();
  game.player.attack = { name: 'throw', released: false };
  sound.play('punch');
  director.update();
  assert.deepEqual(sound.cues, ['grabReach', 'grabHold']);
});

test('a slam that knocks the victim out is still the landing, not a plain knockout', () => {
  const enemy = { thrown: true, dead: false, held: false, attack: null };
  const { sound, director } = setup({ state: 'playing', enemies: [enemy] });
  director.update();
  enemy.thrown = false; enemy.dead = true;
  sound.play('enemyDown');
  director.update();
  assert.deepEqual(sound.cues, ['throwLand']);
});

test('an enemy starting a strike gets a quiet whoosh; shuriken keep their own sound', () => {
  const striker = { attack: null, dead: false, held: false, thrown: false };
  const thrower = { attack: null, dead: false, held: false, thrown: false };
  const { sound, director } = setup({ state: 'playing', enemies: [striker, thrower] });
  director.update();
  striker.attack = { name: 'enemyPunch' };
  thrower.attack = { name: 'enemyThrow' };
  director.update();
  director.update();
  assert.deepEqual(sound.cues, ['enemyWhoosh'], 'once per strike, not per frame');
});

test('menu interactions map to their cues', () => {
  const { sound, director } = setup({});
  director.menu('move'); director.menu('confirm'); director.menu('back');
  assert.deepEqual(sound.cues, ['menuMove', 'menuConfirm', 'menuBack']);
});

test('with the real game: start, a landed punch, a throw and a pause resolve as expected', () => {
  const sound = fakeSound();
  const game = new Game({ input: null, rng: () => 0.5, audio: sound });
  const music = fakeMusic({ tracks: ['stage'] });
  const director = createAudioDirector({ game, sound, music });
  director.update();
  game.start();
  director.update();
  assert.deepEqual(music.log, ['play:stage:top']);
  assert.deepEqual(sound.cues, ['gameStart']);

  // A striker right in front: punch it.
  const p = game.player;
  const e = new Enemy('striker', p.x + 14, -1, () => 0.5, p.z);
  game.enemies.push(e);
  for (let t = 0; t < 0.5; t += STEP) {
    game.step(STEP, t < STEP ? { ...idle, punch: true } : idle);
    director.update();
  }
  assert.ok(sound.cues.includes('whooshLight'), sound.cues.join(','));
  assert.ok(sound.cues.includes('punchHit'), sound.cues.join(','));

  // Grab and throw: a fresh enemy in reach, Tamas untouchable so nothing interrupts the throw.
  sound.cues.length = 0;
  game.enemies.length = 0;
  game.enemies.push(new Enemy('striker', p.x + p.facing * 12, -p.facing, () => 0.5, p.z));
  p.invulnerable = 5;
  for (let t = 0; t < 2 && !sound.cues.includes('throwLand'); t += STEP) {
    game.step(STEP, sound.cues.includes('grabReach') ? idle : { ...idle, punch: true, kick: true });
    director.update();
  }
  const order = ['grabReach', 'grabHold', 'throwToss', 'throwLand'].map((c) => sound.cues.indexOf(c));
  assert.ok(order.every((i) => i >= 0), sound.cues.join(','));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'reach, grip, toss, landing in that order');
  assert.equal(sound.cues.filter((c) => c === 'throwLand').length, 1, 'one landing');

  sound.cues.length = 0;
  game.pause();
  director.update();
  assert.deepEqual(sound.cues, ['pauseCue']);
  assert.equal(music.intent, 'paused');
  game.resume();
  director.update();
  assert.deepEqual(sound.cues, ['pauseCue', 'resumeCue']);
  assert.equal(music.intent, 'playing');
  assert.ok(GRAB.damage > 0);
});
