// Entry point: wires the DOM, input, audio, renderer and game loop together.
import { STEP } from './constants.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { Music, MUSIC } from './music.js';
import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { createUi } from './ui.js';
import { HeroSprite, SpriteSheet } from './heroSprite.js';
import { ENEMY_SHEETS } from './enemySprite.js';
import { ART_SCALE } from './artScale.js';
import { BACKGROUNDS, loadBackground } from './background.js';

const SPRITE_URL = new URL('../assets/tamas-hero-spritesheet.png', import.meta.url).href;
const HERO_SHEET_URL = new URL('../assets/sprites/tamas.json', import.meta.url).href;
const MUSIC_URL = new URL(MUSIC.src, import.meta.url).href;

// Opening story, one card per entry. Lines are drawn exactly as written.
export const INTRO_SCREENS = [
  ['STOCKHOLM. MIDNIGHT.'],
  ['BUDAPEST 1942. ALGERIA 1960.', 'STOCKHOLM TONIGHT.'],
  ['TWO ARMIES. ONE DOJO.', 'HE IS NOT DONE.'],
  ['HIS BEST STUDENT LEFT.', 'HE TOOK FIVE DOJOS WITH HIM.'],
  ['THEY CALL THEMSELVES', 'THE SHADOW LEAGUE.'],
  ['TONIGHT THEY COME FOR', 'THE SANSHINKAN NAME.'],
  ['THREE HEARTS:', 'COURAGE. FOCUS. DISCIPLINE.'],
  ['AT 84, TAMAS WEBER', 'TIES HIS BELT ONE MORE TIME.'],
];

const SOUND_KEY = 'karate-challenge-sound';

export function boot(root) {
  const canvas = root.querySelector('canvas');
  const stage = root.querySelector('[data-stage]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch { /* storage may be blocked */ }

  const audio = new Sfx({ enabled: soundOn });
  // The music is optional: if it fails to load or play, the game runs without it.
  const music = new Music({ url: MUSIC_URL, enabled: soundOn, onError: (err) => console.warn('Music unavailable; playing without it.', err) });
  music.load();
  const input = new Input();
  const ui = createUi(root);
  const hero = new HeroSprite({ artScale: ART_SCALE });
  const heroSheet = new SpriteSheet();
  const enemySheets = {};
  const renderer = new Renderer(canvas, { reducedMotion, hero, heroSheet, enemySheets });
  // The hand-drawn backgrounds are optional: until one loads, and if it fails or is the wrong size,
  // the renderer keeps that zone's procedural painter. Each image that arrives rebuilds the
  // pre-rendered world once, with every image accepted so far.
  const loadedBackgrounds = {};
  for (const [art, path] of Object.entries(BACKGROUNDS)) {
    loadBackground(new URL(path, import.meta.url).href)
      .then((img) => {
        loadedBackgrounds[art] = img;
        if (renderer.setBackgrounds(loadedBackgrounds)) root.karateBackgrounds = { ...renderer.backgrounds };
      })
      .catch((err) => console.warn(`${err.message}; keeping the procedural ${art}.`));
  }
  // The production sheet is optional: any state it lacks is drawn from the fallback sheet.
  heroSheet.load(HERO_SHEET_URL).catch((err) => console.warn('Production hero sheet not loaded; using fallback art.', err));
  // Enemy sheets are optional, one per type: a type whose sheet is missing or does not load keeps its
  // procedural art, which is the normal state until that type's artwork is staged. The renderer picks
  // a sheet up the moment it is installed here, so a sheet that arrives mid-fight simply takes over.
  for (const [kind, path] of Object.entries(ENEMY_SHEETS)) {
    const sheet = new SpriteSheet();
    sheet.load(new URL(path, import.meta.url).href)
      .then(() => { enemySheets[kind] = sheet; })
      .catch(() => { /* no sheet for this type yet: procedural art */ });
  }
  const game = new Game({ input, audio, ui, reducedMotion });

  // The hero artwork must be present: the game cannot start without it.
  const startButtons = [...root.querySelectorAll('[data-action="start"]')];
  const loadNote = root.querySelector('[data-load-note]');
  for (const b of startButtons) b.disabled = true;
  hero.load(SPRITE_URL).then(() => {
    for (const b of startButtons) b.disabled = false;
    if (loadNote) loadNote.hidden = true;
    ui.heroPainter = (canvasEl, name) => hero.paintTo(canvasEl, name === 'victory' ? 7 : 0, 3);
  }).catch((err) => {
    console.error(err);
    if (loadNote) loadNote.textContent = 'Hero artwork missing: add karate-game/assets/tamas-hero-spritesheet.png';
  });

  const playIntro = (onDone) => ui.showStory(INTRO_SCREENS, { onDone, skippable: true, hint: 'Enter · Space · tap to continue · Esc to skip' });

  ui.setSound(soundOn);
  input.attachKeyboard(window);
  input.attachTouch({
    left: root.querySelector('[data-btn="left"]'),
    right: root.querySelector('[data-btn="right"]'),
    up: root.querySelector('[data-btn="up"]'),
    down: root.querySelector('[data-btn="down"]'),
    duck: root.querySelector('[data-btn="duck"]'),
    jump: root.querySelector('[data-btn="jump"]'),
    punch: root.querySelector('[data-btn="punch"]'),
    kick: root.querySelector('[data-btn="kick"]'),
    block: root.querySelector('[data-btn="block"]'),
    kiai: root.querySelector('[data-btn="kiai"]'),
  });

  const unlockAudio = () => { audio.unlock(); music.unlock(); };
  const startGame = () => { if (!hero.ready) return; unlockAudio(); game.start(); };
  for (const b of root.querySelectorAll('[data-action="intro"]')) b.addEventListener('click', () => playIntro(() => ui.showOverlay('start')));
  for (const b of root.querySelectorAll('[data-action="start"]')) b.addEventListener('click', startGame);
  for (const b of root.querySelectorAll('[data-action="resume"]')) b.addEventListener('click', () => { unlockAudio(); game.resume(); });
  for (const b of root.querySelectorAll('[data-action="pause"]')) b.addEventListener('click', () => game.togglePause());
  for (const b of root.querySelectorAll('[data-action="sound"]')) {
    b.addEventListener('click', () => {
      soundOn = !soundOn;
      if (soundOn) unlockAudio();
      audio.setEnabled(soundOn);
      music.setEnabled(soundOn);
      ui.setSound(soundOn);
      try { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); } catch { /* ignore */ }
      if (soundOn) audio.play('start');
    });
  }

  input.onPause = () => game.togglePause();
  input.onConfirm = () => {
    if (ui.storyActive) return; // the story cards handle Enter themselves
    if (['start', 'gameover', 'victory'].includes(game.state)) startGame();
    else if (game.state === 'paused') game.resume();
  };

  // Touch controls: shown on coarse pointers, or as soon as a touch is detected.
  ui.setTouchVisible(window.matchMedia('(pointer: coarse)').matches);
  input.onTouchDetected = () => ui.setTouchVisible(true);
  // Stop the page from scrolling/zooming while thumbs are on the controls.
  const touchArea = root.querySelector('[data-touch]');
  for (const el of [touchArea, stage]) {
    if (el) el.addEventListener('touchmove', (e) => { if (game.state === 'playing') e.preventDefault(); }, { passive: false });
  }

  // Pause when the tab is hidden or the window loses focus.
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); music.setPageActive(!document.hidden); });
  window.addEventListener('blur', () => game.pause());

  // Responsive, pixel-perfect scaling.
  const resize = () => renderer.resize(stage.clientWidth, window.devicePixelRatio || 1);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);
  resize();

  // The music follows the game's state from here, so game logic stays free of media concerns:
  // a run starts it from the top, pause holds it, dialogue and the boss leave it alone, and
  // the end of a run fades it out under the result jingle.
  const inRun = (s) => s === 'playing' || s === 'dialogue';
  let seenState = game.state;
  let seenEnding = game.ending;
  const followGame = () => {
    const { state, ending } = game;
    if (ending && !seenEnding) music.fadeOut();
    else if (state !== seenState) {
      if (inRun(state) && !inRun(seenState)) {
        if (seenState === 'paused') music.resume(); else music.start();
      } else if (state === 'paused') music.pause();
      else if (!inRun(state)) music.stop();
    }
    seenState = state;
    seenEnding = ending;
  };

  // Fixed-step game loop; rendering runs every animation frame.
  let last = null;
  let acc = 0;
  const frame = (now) => {
    followGame();
    if (last !== null && game.state === 'playing') {
      acc += Math.min(0.1, (now - last) / 1000);
      let steps = 0;
      while (acc >= STEP && steps < 6) { game.step(STEP); acc -= STEP; steps++; }
    } else {
      acc = 0;
    }
    last = now;
    renderer.render(game, now / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Opening story plays once, then the title card.
  playIntro(() => ui.showOverlay('start'));

  root.karateHero = hero; // exposed for debugging alongside root.karateGame
  root.karateRenderer = renderer;
  root.karateMusic = music;
  root.karateHeroSheet = heroSheet;
  root.karateEnemySheets = enemySheets;
  return game;
}

const root = document.getElementById('karate-game');
// The game instance is attached to its element (not a global) for debugging and automated tests.
if (root) root.karateGame = boot(root);
