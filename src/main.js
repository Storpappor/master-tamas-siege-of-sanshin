// Entry point: wires the DOM, input, audio, renderer and game loop together.
import { STEP } from './constants.js';
import { Input } from './input.js';
import { Sound } from './sound.js';
import { MusicMixer, MUSIC } from './music.js';
import { createAudioDirector } from './audioDirector.js';
import { Renderer } from './renderer.js';
import { Game } from './game.js';
import { createUi } from './ui.js';
import { HeroSprite, SpriteSheet } from './heroSprite.js';
import { ENEMY_SHEETS } from './enemySprite.js';
import { ART_SCALE } from './artScale.js';
import { BACKGROUNDS, loadBackground } from './background.js';

const SPRITE_URL = new URL('../assets/tamas-hero-spritesheet.png', import.meta.url).href;
const HERO_SHEET_URL = new URL('../assets/sprites/tamas.json', import.meta.url).href;

// Opening story, one card per entry. Lines are drawn exactly as written. Story, narration and
// character lines are Swedish; menus and system UI are English (docs/ui-display-names.md).
export const INTRO_SCREENS = [
  ['STOCKHOLM. MIDNATT.'],
  ['BUDAPEST 1942. ALGERIET 1960.', 'STOCKHOLM I NATT.'],
  ['TVÅ ARMÉER. EN DOJO.', 'HAN ÄR INTE FÄRDIG.'],
  ['HANS BÄSTA ELEV GICK.', 'HAN TOG FEM DOJOR MED SIG.'],
  ['DE KALLAR SIG', 'SKUGGLIGAN.'],
  ['I NATT KOMMER DE FÖR', 'NAMNET SANSHINKAN.'],
  ['TRE HJÄRTAN:', 'MOD. FOKUS. DISCIPLIN.'],
  ['VID 84 KNYTER TAMAS WEBER', 'BÄLTET EN GÅNG TILL.'],
];

const SOUND_KEY = 'karate-challenge-sound';
const INTRO_KEY = 'karate-challenge-intro-seen';

export function boot(root) {
  const canvas = root.querySelector('canvas');
  const stage = root.querySelector('[data-stage]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch { /* storage may be blocked */ }

  // Effects and music share one AudioContext (created on the first gesture) but have separate
  // gains. The game only sees `audio`; the director below turns its events into cues and music.
  const audio = new Sound({ enabled: soundOn, onError: (err) => console.warn('Sound effect failed.', err) });
  audio.onDuck = () => music.duck();
  // The music is optional: a track that fails to load, or is not supplied yet, is simply skipped.
  const musicErrors = {};
  const music = new MusicMixer({
    tracks: MUSIC.tracks, enabled: soundOn, createContext: () => audio.ctx,
    resolveUrl: (src) => new URL(src, import.meta.url).href,
    onError: (name, err) => {
      musicErrors[name] = (err && (err.message || err.name)) || String(err);
      console.warn(`Music track "${name}" unavailable; playing without it.`, err);
    },
  });
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
  const director = createAudioDirector({ game, sound: audio, music });
  ui.onMenu = (kind) => director.menu(kind);

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
  // The first key press or tap anywhere in the game unlocks audio, so the menu theme can start
  // on the intro cards without an extra step.
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, unlockAudio, { capture: true, passive: true });
  const startGame = () => { if (!hero.ready) return; unlockAudio(); game.start(); };
  for (const b of root.querySelectorAll('[data-action="intro"]')) b.addEventListener('click', () => { director.menu('confirm'); playIntro(() => ui.showOverlay('start')); });
  for (const b of root.querySelectorAll('[data-action="start"]')) b.addEventListener('click', startGame);
  for (const b of root.querySelectorAll('[data-action="resume"]')) b.addEventListener('click', () => { unlockAudio(); game.resume(); });
  for (const b of root.querySelectorAll('[data-action="pause"]')) b.addEventListener('click', () => game.togglePause());

  // ---- Menu shell: How to play, Restart run, Title screen -------------------------------
  // How to play opens over the title or the pause screen and goes back to exactly that screen,
  // refocusing the button it was opened from. The game stays paused throughout: nothing here
  // calls resume, and Esc while help is open only closes help.
  const helpOverlay = root.querySelector('[data-overlay="help"]');
  const helpOpen = () => Boolean(helpOverlay && !helpOverlay.hidden);
  const HELP_FROM = ['start', 'paused', 'gameover', 'victory'];
  let helpOrigin = null;   // { overlay: one of HELP_FROM, focus: Element | null }
  const openHelp = () => {
    const from = ui.overlay;
    if (helpOpen() || !helpOverlay || !HELP_FROM.includes(from)) return;
    helpOrigin = { overlay: from, focus: root.contains(document.activeElement) ? document.activeElement : null };
    director.menu('confirm');
    ui.showOverlay('help');
  };
  const closeHelp = () => {
    if (!helpOpen()) return;
    const back = helpOrigin || { overlay: HELP_FROM.includes(game.state) ? game.state : 'start', focus: null };
    helpOrigin = null;
    director.menu('back');
    ui.showOverlay(back.overlay, null, { focus: back.focus });
  };
  for (const b of root.querySelectorAll('[data-action="help"]')) b.addEventListener('click', openHelp);
  for (const b of root.querySelectorAll('[data-action="help-back"]')) b.addEventListener('click', closeHelp);
  // Restart run: the existing game.start() resets the whole run (score, zone, waves), so the
  // button says so. Title screen: the run is discarded and the title shows, no confirmation.
  for (const b of root.querySelectorAll('[data-action="restart"]')) b.addEventListener('click', () => { if (game.state !== 'paused') return; director.menu('confirm'); startGame(); });
  const toTitle = () => {
    if (!['paused', 'gameover', 'victory'].includes(game.state)) return;
    director.menu('back');
    game.reset();
    game.state = 'start';
    input.active = false;
    input.reset();
    ui.showOverlay('start');
  };
  for (const b of root.querySelectorAll('[data-action="title"]')) b.addEventListener('click', toTitle);
  window.addEventListener('keydown', (e) => {
    if (ui.storyActive || e.repeat) return;
    const key = e.key;
    if ((key === 'h' || key === 'H') && !helpOpen() && HELP_FROM.includes(ui.overlay)) { e.preventDefault(); openHelp(); }
    // The Input is inactive whenever a menu is open (see the frame loop), so Esc and P are
    // handled here: Esc closes help, or resumes from the pause screen; P resumes too.
    else if (key === 'Escape' && helpOpen()) { e.preventDefault(); closeHelp(); }
    // `!input.active` keeps this off the very key press that paused (the Input is still active
    // for that event and has just handled it); the loop deactivates the Input a frame later.
    else if ((key === 'Escape' || key === 'p' || key === 'P') && !input.active && game.state === 'paused' && ui.overlay === 'paused') { e.preventDefault(); unlockAudio(); game.resume(); }
  });
  const pauseStatus = root.querySelector('[data-pause-status]');
  let lastStatus = '';
  const syncPauseStatus = () => {
    if (!pauseStatus || game.state !== 'paused') return;
    const total = game.remainingEnemies + game.defeated;
    const m = Math.floor(game.elapsed / 60), sec = String(Math.floor(game.elapsed % 60)).padStart(2, '0');
    const text = `Score ${game.score.toLocaleString()} · ${game.remainingEnemies} of ${total} left · ${m}:${sec}${game.zone ? ` · ${game.zone.name}` : ''}`;
    if (text !== lastStatus) { pauseStatus.textContent = text; lastStatus = text; }
  };
  // The result screens show how many enemies the run cleared, from the same values as the pause
  // status (the game passes score, time and bonuses; the counts are read here).
  const resultCleared = [...root.querySelectorAll('[data-result="cleared"]')];
  const resultTotal = [...root.querySelectorAll('[data-result="total"]')];
  let lastCleared = '';
  const syncResultStats = () => {
    if (game.state !== 'gameover' && game.state !== 'victory') return;
    const total = game.remainingEnemies + game.defeated;
    const key = `${game.defeated}/${total}`;
    if (key === lastCleared) return;
    lastCleared = key;
    for (const el of resultCleared) el.textContent = String(game.defeated);
    for (const el of resultTotal) el.textContent = String(total);
  };
  for (const b of root.querySelectorAll('[data-action="sound"]')) {
    b.addEventListener('click', () => {
      soundOn = !soundOn;
      if (soundOn) unlockAudio();
      audio.setEnabled(soundOn);
      music.setEnabled(soundOn);
      ui.setSound(soundOn);
      try { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); } catch { /* ignore */ }
      if (soundOn) director.menu('confirm');
    });
  }

  input.onPause = () => { if (helpOpen()) closeHelp(); else game.togglePause(); };
  input.onConfirm = () => {
    if (ui.storyActive || helpOpen()) return; // the story cards and the help screen handle Enter themselves
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

  // Pause when the tab is hidden or the window loses focus: silently, unlike a manual pause.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) director.pauseSilently(() => game.pause());
    music.setPageActive(!document.hidden);
  });
  window.addEventListener('blur', () => director.pauseSilently(() => game.pause()));

  // Menu navigation sound when Tab or an arrow key moves the focus to another overlay button
  // (an overlay focusing its own button when it opens is not a selection change).
  const NAV_KEYS = ['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  let lastNavKeyAt = -1;
  let lastFocused = null;
  window.addEventListener('keydown', (e) => { if (NAV_KEYS.includes(e.key)) lastNavKeyAt = performance.now(); }, true);
  root.addEventListener('focusin', (e) => {
    const b = e.target.closest ? e.target.closest('.kg-overlay button') : null;
    if (b && b !== lastFocused && performance.now() - lastNavKeyAt < 150) director.menu('move');
    lastFocused = b;
  });

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
    // Menus own the input while the game is not playing: the touch panel is inert (taps cannot
    // reach the gameplay buttons, and the buttons cannot cover a menu), and the title screen
    // shows no HUD, since its numbers only mean something during a run.
    const playing = game.state === 'playing';
    if (touchArea && touchArea.inert !== !playing) touchArea.inert = !playing;
    // Gameplay keys are captured only while playing: on a menu, Space and the letters belong to
    // the buttons (Space must activate a focused button, not queue a jump for the resume).
    if (input.active !== playing) input.active = playing;
    root.classList.toggle('kg-root--title', game.state === 'start');
    // While a menu owns the screen the root must not clip: on phones the menu layer is fixed to
    // the viewport, and Safari clips a fixed descendant at an overflow-clipped ancestor's box.
    root.classList.toggle('kg-root--menu', !playing);
    syncPauseStatus();
    syncResultStats();
    // Music and sound cues follow the state the steps just produced.
    director.update();
    renderer.render(game, now / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Opening story plays on the first visit (and from the Intro button); later visits open on the
  // title. Add ?intro=1 to the address to see it again.
  let introSeen = false;
  try { introSeen = localStorage.getItem(INTRO_KEY) === 'yes'; } catch { /* storage may be blocked */ }
  const wantIntro = new URLSearchParams(window.location.search).has('intro');
  const markIntroSeen = () => { try { localStorage.setItem(INTRO_KEY, 'yes'); } catch { /* ignore */ } };
  if (introSeen && !wantIntro) ui.showOverlay('start');
  else playIntro(() => { markIntroSeen(); ui.showOverlay('start'); });

  root.karateHero = hero; // exposed for debugging alongside root.karateGame
  root.karateRenderer = renderer;
  root.karateMusic = music;
  root.karateSound = audio;
  // Audio diagnostics for devices without a console: open the game with ?audiodebug=1.
  if (new URLSearchParams(window.location.search).has('audiodebug')) {
    const box = document.createElement('pre');
    box.className = 'kg-audiodebug';
    box.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:9999;margin:0;padding:6px 8px;max-width:95vw;font:11px/1.35 monospace;color:#fff;background:rgba(0,0,0,.75);white-space:pre-wrap;pointer-events:none;';
    document.body.appendChild(box);
    const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : String(v));
    setInterval(() => {
      const ctx = audio.ctx;
      const lines = [`audio ${ctx ? `${ctx.state} @${ctx.sampleRate}Hz t=${fmt(ctx.currentTime)}` : 'no context yet (tap or press a key)'} sound=${audio.enabled ? 'on' : 'off'} game=${game.state} current=${music.current}`];
      for (const [name, t] of Object.entries(music.tracks)) {
        lines.push(`${name.padEnd(5)} bytes=${t.bytes ? Math.round(t.bytes.byteLength / 1024) + 'k' : '-'} decoding=${t.decoding} ready=${t.ready} failed=${t.failed} intent=${t.intent} playing=${t.playing} pos=${fmt(t.playing ? t.currentPosition() : t.position)} gain=${t.gain ? fmt(t.gain.gain.value) : '-'}${musicErrors[name] ? ` error=${musicErrors[name]}` : ''}`);
      }
      box.textContent = lines.join('\n');
    }, 500);
  }
  root.karateHeroSheet = heroSheet;
  root.karateEnemySheets = enemySheets;
  return game;
}

const root = document.getElementById('karate-game');
// The game instance is attached to its element (not a global) for debugging and automated tests.
if (root) root.karateGame = boot(root);
