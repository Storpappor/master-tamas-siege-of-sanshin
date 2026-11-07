// Entry point: wires the DOM, input, audio, renderer and game loop together.
import { STEP } from './constants.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { createUi } from './ui.js';
import { HeroSprite, SpriteSheet } from './heroSprite.js';
import { ART_SCALE } from './artScale.js';
import { BACKGROUNDS, loadBackground } from './background.js';

const SPRITE_URL = new URL('../assets/tamas-hero-spritesheet.png', import.meta.url).href;
const HERO_SHEET_URL = new URL('../assets/sprites/tamas.json', import.meta.url).href;

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
  const input = new Input();
  const ui = createUi(root);
  const hero = new HeroSprite({ artScale: ART_SCALE });
  const heroSheet = new SpriteSheet();
  const renderer = new Renderer(canvas, { reducedMotion, hero, heroSheet });
  // The hand-drawn dojo is optional: until it loads, and if it fails or is the wrong size, the
  // renderer keeps the procedural room. Installing it only rebuilds the pre-rendered world once.
  loadBackground(new URL(BACKGROUNDS.dojo, import.meta.url).href)
    .then((img) => { if (renderer.setBackgrounds({ dojo: img })) root.karateBackgrounds = { dojo: img }; })
    .catch((err) => console.warn(`${err.message}; keeping the procedural dojo.`));
  // The production sheet is optional: any state it lacks is drawn from the fallback sheet.
  heroSheet.load(HERO_SHEET_URL).catch((err) => console.warn('Production hero sheet not loaded; using fallback art.', err));
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

  const startGame = () => { if (!hero.ready) return; audio.unlock(); game.start(); };
  for (const b of root.querySelectorAll('[data-action="intro"]')) b.addEventListener('click', () => playIntro(() => ui.showOverlay('start')));
  for (const b of root.querySelectorAll('[data-action="start"]')) b.addEventListener('click', startGame);
  for (const b of root.querySelectorAll('[data-action="resume"]')) b.addEventListener('click', () => { audio.unlock(); game.resume(); });
  for (const b of root.querySelectorAll('[data-action="pause"]')) b.addEventListener('click', () => game.togglePause());
  for (const b of root.querySelectorAll('[data-action="sound"]')) {
    b.addEventListener('click', () => {
      soundOn = !soundOn;
      audio.setEnabled(soundOn);
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
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });
  window.addEventListener('blur', () => game.pause());

  // Responsive, pixel-perfect scaling.
  const resize = () => renderer.resize(stage.clientWidth, window.devicePixelRatio || 1);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);
  resize();

  // Fixed-step game loop; rendering runs every animation frame.
  let last = null;
  let acc = 0;
  const frame = (now) => {
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
  root.karateHeroSheet = heroSheet;
  return game;
}

const root = document.getElementById('karate-game');
// The game instance is attached to its element (not a global) for debugging and automated tests.
if (root) root.karateGame = boot(root);
