import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enemyState, ENEMY_SHEETS } from '../src/enemySprite.js';
import { SpriteSheet, resolveFrame } from '../src/heroSprite.js';
import { Renderer } from '../src/renderer.js';
import { Game } from '../src/game.js';
import { Player, Enemy, ENEMY_TYPES } from '../src/entities.js';
import { ATTACKS, attackDuration } from '../src/combat.js';
import { STEP, GRAB, PHYSICS } from '../src/constants.js';
import { GET_UP_TIME, poseFor } from '../src/sprites.js';
import { readFileSync } from 'node:fs';
import { decodePng } from '../scripts/append-sheet.mjs';

const idle = { left: false, right: false, up: false, down: false, duck: false, block: false, jump: false, punch: false, kick: false, kiai: false };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// A striker-shaped map in the layout the brief asks for: one state per row, in the wider cell the
// brief recommends so the lying poses fit (the loader reads cell and anchor per map).
const STRIKER_MAP = { cell: { w: 128, h: 96 }, anchor: { x: 64, y: 95 }, columns: 4, states: {
  idle: [0], walk: [4, 5, 6, 7], enemyPunch: [8, 9, 10], hurt: [12, 13], knockdown: [16, 17, 18],
  held: [20], thrownDown1: [24], thrownDown2: [28], fallen: [32], getUp: [36],
} };

test('the shipped striker.json and striker.png follow the brief\'s delivery contract', () => {
  const map = JSON.parse(readFileSync(new URL('../assets/sprites/striker.json', import.meta.url), 'utf8'));
  const sheet = new SpriteSheet({ map });
  assert.deepEqual(sheet.cell, { w: 128, h: 96 });
  assert.deepEqual(sheet.anchor, { x: 64, y: 95 });
  assert.equal(sheet.columns, 4);
  assert.deepEqual(map.states, STRIKER_MAP.states, 'one state per row, the agreed 18 cells');
  const png = decodePng(readFileSync(new URL('../assets/sprites/striker.png', import.meta.url)));
  assert.equal(png.width, 512);
  assert.equal(png.height, 960);
  let semi = 0;
  for (let i = 3; i < png.rgba.length; i += 4) if (png.rgba[i] !== 0 && png.rgba[i] !== 255) semi++;
  assert.equal(semi, 0, 'binary alpha: the hit flash and the Kiai outline work on the alpha channel');
  // The idle figure stands 86 px tall with its feet on the anchor row.
  const alphaAt = (x, y) => png.rgba[(y * png.width + x) * 4 + 3];
  let top = 96, bottom = -1;
  for (let y = 0; y < 96; y++) for (let x = 0; x < 128; x++) if (alphaAt(x, y)) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  assert.equal(top, 10);
  assert.equal(bottom, 95);
  for (const state of Object.keys(map.states)) {
    assert.notEqual(resolveFrame(sheet, { state, phase: 'active', progress: 0.5, loop: 1 }), null, `${state} resolves on the shipped sheet`);
  }
});

test('every enemy type has a sheet path next to tamas.json', () => {
  assert.deepEqual(Object.keys(ENEMY_SHEETS).sort(), Object.keys(ENEMY_TYPES).sort());
  for (const [kind, path] of Object.entries(ENEMY_SHEETS)) assert.equal(path, `../assets/sprites/${kind}.json`);
});

test('a throw victim runs through held, rising, falling, fallen and getUp in step with the procedural poses', () => {
  const game = new Game({ input: null, rng: () => 0.5 });
  game.start();
  const p = game.player;
  const e = new Enemy('striker', p.x + 12, -1, () => 0.5, p.z);
  e.cooldown = 99;
  game.enemies.push(e);
  game.step(STEP, { ...idle, punch: true, kick: true });
  const frames = [];
  for (let i = 1; i <= 90; i++) {
    const es = enemyState(e);
    frames.push({ i, es, pose: poseFor(e), vy: e.vy });
    game.step(STEP, idle);
  }
  const byState = (s) => frames.filter((f) => f.es.state === s).map((f) => f.i);
  assert.deepEqual(byState('held'), [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17], 'the hold is frames 5-17');
  const held = frames.filter((f) => f.es.state === 'held').map((f) => f.es.progress);
  assert.ok(held[0] < 0.1 && held[held.length - 1] >= 0.9, `the hold reports its progress (${held[0]} .. ${held[held.length - 1]})`);
  assert.equal(byState('thrownDown1')[0], 18, 'the release starts the rising pose');
  const falling = byState('thrownDown2');
  assert.ok(falling.length > 0 && falling[falling.length - 1] === 30, 'the falling pose holds until the last airborne frame');
  assert.equal(byState('fallen')[0], 31, 'the touchdown frame shows the lying pose');
  const fallen = frames.filter((f) => f.es.state === 'fallen');
  assert.ok(near(fallen[0].es.progress, 0), 'lying starts at progress 0');
  assert.ok(fallen[fallen.length - 1].es.progress > 0.9, 'and runs toward 1 before the get-up');
  const getUp = frames.filter((f) => f.es.state === 'getUp');
  assert.ok(getUp.length > 0, 'the victim kneels up before the floor time ends');
  assert.ok(getUp.every((f) => f.i > 31 + (GRAB.downTime - GET_UP_TIME) * 60 - 1), 'the get-up is the last 0.25 s of the floor time');
  // The sheet states shadow poseFor one to one.
  for (const f of frames) if (f.pose !== 'idle') assert.equal(f.es.state, f.pose, `frame ${f.i}`);
  // Rising and falling report their progress through the hop.
  const rising = frames.filter((f) => f.es.state === 'thrownDown1');
  assert.ok(rising[0].es.progress < 0.1 && rising[rising.length - 1].es.progress > 0.8, 'rising progress climbs to the apex');
  const fall = frames.filter((f) => f.es.state === 'thrownDown2');
  assert.ok(fall[0].es.progress < 0.2 && fall[fall.length - 1].es.progress > 0.8, 'falling progress climbs to the touchdown');
});

test('the striker, kicker, thrower and boss report their attacks by name and phase', () => {
  const p = new Player(100);
  const cases = [['striker', 'enemyPunch'], ['kicker', 'enemyHighKick'], ['thrower', 'enemyThrow'], ['boss', 'bossPunch']];
  for (const [kind, attack] of cases) {
    const e = new Enemy(kind, p.x + (ENEMY_TYPES[kind].range - 2), -1, () => 0.1, p.z);
    e.cooldown = 0;
    e.update(STEP, p);
    assert.deepEqual(enemyState(e), { state: attack, phase: 'startup', progress: 0 }, `${kind} winds up ${attack}`);
    const a = ATTACKS[attack];
    for (let t = STEP; t < a.startup + STEP; t += STEP) e.update(STEP, p);
    assert.equal(enemyState(e).phase, 'active', `${kind} ${attack} active`);
    for (let t = 0; t < a.active + STEP; t += STEP) e.update(STEP, p);
    assert.equal(enemyState(e).phase, 'recovery', `${kind} ${attack} recovery`);
    for (let i = 0; i < attackDuration(a) * 60 && e.attack; i++) e.update(STEP, p);
    assert.equal(e.attack, null, `${kind} finishes ${attack} within its duration`);
    assert.notEqual(enemyState(e).state, attack, `${kind} leaves the attack state`);
  }
  // The kicker's second attack keeps its own name; the low sweep's wind-up is the crouch in the procedural art.
  const k = new Enemy('kicker', p.x + 20, -1, () => 0.9, p.z);
  k.cooldown = 0;
  k.update(STEP, p);
  assert.deepEqual(enemyState(k), { state: 'enemyLowSweep', phase: 'startup', progress: 0 });
  assert.equal(poseFor(k), 'crouch');
});

test('idle, walk, block, hurt and knockdown follow the enemy state machine', () => {
  const p = new Player(100);
  const e = new Enemy('striker', p.x + 200, -1, () => 0.5, p.z);
  e.cooldown = 0;
  assert.deepEqual(enemyState(e), { state: 'idle', progress: 0 });
  e.update(STEP, p);
  assert.equal(enemyState(e).state, 'walk');
  assert.ok(near(enemyState(e).loop, e.walkCycle), 'the walk loops on the walk counter');
  const loops = new Set();
  for (let t = 0; t < 1; t += STEP) { e.update(STEP, p); loops.add(Math.floor(enemyState(e).loop)); }
  assert.ok(loops.size >= 8, 'the enemy walk counter advances about 8 per second');

  const b = new Enemy('boss', p.x + 20, -1, () => 0.5, p.z);
  b.blockTimer = 0.5;
  b.update(STEP, p);
  assert.equal(b.state, 'block');
  assert.deepEqual(enemyState(b), { state: 'block', progress: 0 });

  const h = new Enemy('striker', p.x + 20, -1, () => 0.5, p.z);
  h.takeHit({ damage: 10, blocked: false, direction: 1, knockback: 10 });
  assert.deepEqual(enemyState(h), { state: 'hurt', progress: 0 });
  for (let t = 0; t < PHYSICS.hurtTime / 2; t += STEP) h.update(STEP, p);
  assert.ok(enemyState(h).progress > 0.4 && enemyState(h).progress < 0.6, 'hurt progress runs over the hurt time');

  const d = new Enemy('striker', p.x + 20, -1, () => 0.5, p.z);
  d.takeHit({ damage: 100, blocked: false, direction: 1, knockback: 10 });
  assert.deepEqual(enemyState(d), { state: 'hurt', progress: 0 }, 'a beaten fighter shows the hit first');
  d.deadTimer = 0.25;
  assert.deepEqual(enemyState(d), { state: 'knockdown', progress: 0 }, 'then starts to topple');
  d.deadTimer = 1;
  assert.deepEqual(enemyState(d), { state: 'knockdown', progress: 1 }, 'and lies on the last cell');

  // Killed by the throw: rising and falling as usual, then straight to the lying cell on the touchdown.
  const t = new Enemy('striker', p.x + 12, -1, () => 0.5, p.z);
  t.takeThrow({ damage: 100, direction: 1 });
  assert.equal(t.dead, true);
  assert.equal(enemyState(t).state, 'thrownDown1');
  for (let i = 0; i < 60 && t.thrown; i++) t.update(STEP, p);
  assert.deepEqual(enemyState(t), { state: 'knockdown', progress: 1 });
});

test('resolveFrame picks the cells of a striker map and returns null for whatever is unmapped', () => {
  const sheet = new SpriteSheet({ map: STRIKER_MAP });
  assert.equal(resolveFrame(sheet, { state: 'enemyPunch', phase: 'startup', progress: 0 }), 8);
  assert.equal(resolveFrame(sheet, { state: 'enemyPunch', phase: 'active', progress: 0 }), 9);
  assert.equal(resolveFrame(sheet, { state: 'enemyPunch', phase: 'recovery', progress: 0 }), 10);
  assert.deepEqual([0, 1, 2, 3, 4].map((l) => resolveFrame(sheet, { state: 'walk', loop: l })), [4, 5, 6, 7, 4]);
  assert.equal(resolveFrame(sheet, { state: 'held', progress: 0.5 }), 20);
  assert.equal(resolveFrame(sheet, { state: 'knockdown', progress: 1 }), 18);
  assert.equal(resolveFrame(sheet, { state: 'block', progress: 0 }), null, 'the striker never blocks: nothing to map');
  assert.equal(resolveFrame(sheet, { state: 'enemyHighKick', phase: 'active', progress: 0 }), null, 'another type\'s attack is not on this sheet');
  const bare = new SpriteSheet({ map: { cell: { w: 96, h: 96 }, anchor: { x: 48, y: 95 }, columns: 4, states: {} } });
  assert.equal(resolveFrame(bare, { state: 'idle', progress: 0 }), null);
  assert.deepEqual(sheet.cellRect(5), { x: 128, y: 96, w: 128, h: 96 }, 'cells are cut at the map\'s own size');
});

// The Kicker map of its brief: its own cell (the 96 px figure plus the walk bob needs the taller
// cell, the lying poses the wide one) and anchor, one state per row, both attacks as 3-cell states.
const KICKER_MAP = { cell: { w: 128, h: 112 }, anchor: { x: 64, y: 111 }, columns: 4, states: {
  idle: [0], walk: [4, 5, 6, 7], enemyHighKick: [8, 9, 10], enemyLowSweep: [12, 13, 14], hurt: [16, 17],
  knockdown: [20, 21, 22], held: [24], thrownDown1: [28], thrownDown2: [32], fallen: [36], getUp: [40],
} };

test('the Kicker map of its brief resolves both attacks by phase and the walk forward in both directions', () => {
  const sheet = new SpriteSheet({ map: KICKER_MAP });
  assert.deepEqual(sheet.cellRect(5), { x: 128, y: 112, w: 128, h: 112 }, 'cells are cut at the Kicker map\'s own size');
  for (const [attack, cells] of [['enemyHighKick', [8, 9, 10]], ['enemyLowSweep', [12, 13, 14]]]) {
    assert.deepEqual(['startup', 'active', 'recovery'].map((phase) => resolveFrame(sheet, { state: attack, phase, progress: 0 })), cells, attack);
  }
  assert.equal(resolveFrame(sheet, { state: 'enemyPunch', phase: 'active', progress: 0 }), null, 'the Striker\'s punch is not on this sheet');
  // From the simulation: the sweep's crouched preparation is the sweep's own first cell, not a crouch state.
  const p = new Player(100);
  const k = new Enemy('kicker', p.x + 20, -1, () => 0.9, p.z);
  k.cooldown = 0;
  k.update(STEP, p);
  assert.equal(resolveFrame(sheet, enemyState(k)), 12);
  // After a kick the Kicker steps back for 0.5 s; the walk cells still play forward on the walk counter.
  const r = new Enemy('kicker', p.x + 20, -1, () => 0.1, p.z);
  r.cooldown = 0;
  r.update(STEP, p);
  assert.equal(r.attack.name, 'enemyHighKick');
  for (let i = 0; i < 80 && r.attack; i++) r.update(STEP, p);
  r.update(STEP, p);
  assert.equal(r.state, 'walk');
  assert.ok(r.vx * r.facing < 0, 'moving away from Tamas while facing him');
  const cells = new Set();
  for (let i = 0; i < 29; i++) { cells.add(resolveFrame(sheet, enemyState(r))); r.update(STEP, p); }
  assert.deepEqual([...cells].sort(), [4, 5, 6, 7], 'one full forward cycle during the retreat');
});

// A recording 2D context: enough for drawFighter (fillRect) and SpriteSheet.draw (drawImage).
function recordingContext() {
  const calls = { fillRect: 0, drawImage: 0, scale: [] };
  return { calls, fillStyle: '', globalAlpha: 1, imageSmoothingEnabled: false,
    save() {}, restore() {}, translate() {}, setTransform() {},
    scale(x, y) { calls.scale.push([x, y]); }, fillRect() { calls.fillRect++; }, drawImage() { calls.drawImage++; } };
}

// A ready sheet that never touches the DOM: frameCanvas is stubbed with a bare size.
function readySheet(map) {
  const sheet = new SpriteSheet({ map });
  sheet.ready = true;
  sheet.frameCanvas = () => ({ width: 96, height: 96 });
  return sheet;
}

test('Renderer.drawOne draws an enemy from its sheet when it has one and procedurally otherwise', () => {
  const p = new Player(100);
  const draw = (renderer, f) => { const g = recordingContext(); Renderer.prototype.drawOne.call(renderer, g, f, 0); return g.calls; };
  const base = { hero: null, heroSheet: null, reducedMotion: false, camX: 0 };
  const striker = new Enemy('striker', 120, -1, () => 0.5, p.z);
  const kicker = new Enemy('kicker', 140, -1, () => 0.5, p.z);

  // No sheets at all: every enemy is procedural (many fillRect calls, no image).
  const none = draw({ ...base, enemySheets: {} }, striker);
  assert.ok(none.fillRect > 50 && none.drawImage === 0, 'procedural fallback without a sheet');

  // A striker sheet routes the striker only; the kicker keeps the procedural art.
  const sheets = { striker: readySheet(STRIKER_MAP) };
  const onSheet = draw({ ...base, enemySheets: sheets }, striker);
  assert.ok(onSheet.drawImage === 1 && onSheet.fillRect === 0, 'the striker is drawn from its sheet');
  assert.deepEqual(onSheet.scale, [[-1, 1]], 'a left-facing enemy is mirrored, the sheet is drawn facing right');
  striker.facing = 1;
  assert.deepEqual(draw({ ...base, enemySheets: sheets }, striker).scale, [], 'a right-facing enemy is not mirrored');
  const other = draw({ ...base, enemySheets: sheets }, kicker);
  assert.ok(other.fillRect > 50 && other.drawImage === 0, 'a type without a sheet stays procedural');

  // A state the sheet does not map falls through to the procedural art for that frame.
  const partial = { striker: readySheet({ ...STRIKER_MAP, states: { idle: [0] } }) };
  striker.takeHit({ damage: 10, blocked: false, direction: 1, knockback: 10 });
  const unmapped = draw({ ...base, enemySheets: partial }, striker);
  assert.ok(unmapped.fillRect > 50 && unmapped.drawImage === 0, 'hurt is not on the partial sheet: procedural');
  // The throw victim's states fall back one by one as well: a sheet with only idle keeps the
  // procedural held, airborne, lying and get-up poses.
  const game = new Game({ input: null, rng: () => 0.5 });
  game.start();
  const victim = new Enemy('striker', game.player.x + 12, -1, () => 0.5, game.player.z);
  victim.cooldown = 99;
  game.enemies.push(victim);
  game.step(STEP, { ...idle, punch: true, kick: true });
  const seen = new Set();
  for (let i = 1; i <= 90; i++) {
    const es = enemyState(victim);
    if (['held', 'thrownDown1', 'thrownDown2', 'fallen', 'getUp'].includes(es.state)) {
      seen.add(es.state);
      const calls = draw({ ...base, enemySheets: partial }, victim);
      assert.ok(calls.fillRect > 50 && calls.drawImage === 0, `${es.state} unmapped: procedural`);
      const full = draw({ ...base, enemySheets: sheets }, victim);
      assert.ok(full.drawImage === 1 && full.fillRect === 0, `${es.state} mapped: sheet`);
    }
    game.step(STEP, idle);
  }
  assert.deepEqual([...seen].sort(), ['fallen', 'getUp', 'held', 'thrownDown1', 'thrownDown2']);
  // A sheet that is not ready yet (still loading) is ignored.
  const loading = new SpriteSheet({ map: STRIKER_MAP });
  const notReady = draw({ ...base, enemySheets: { striker: loading } }, new Enemy('striker', 120, -1, () => 0.5, p.z));
  assert.ok(notReady.fillRect > 50 && notReady.drawImage === 0);
});
