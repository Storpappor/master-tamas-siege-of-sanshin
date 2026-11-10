// The founder's verification list for the pad, end to end: the real Input class with a fake
// pad element driving the real Game. Logic only, not a device test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { Input } from '../src/input.js';
import { STEP, PHYSICS, SPRINT } from '../src/constants.js';

class FakeEl {
  constructor(rect = { left: 0, top: 0, width: 100, height: 100 }) {
    this.handlers = {};
    this.classes = new Set();
    this.classList = { add: (c) => this.classes.add(c), remove: (c) => this.classes.delete(c), toggle: (c, on) => { if (on) this.classes.add(c); else this.classes.delete(c); }, contains: (c) => this.classes.has(c) };
    this.style = { setProperty() {}, removeProperty() {} };
    this.rect = rect;
  }
  addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
  setPointerCapture() {}
  getBoundingClientRect() { return this.rect; }
  fire(type, props = {}) { for (const fn of this.handlers[type] || []) fn({ preventDefault() {}, pointerId: 0, pointerType: 'touch', buttons: 1, clientX: 50, clientY: 50, ...props }); }
}

function world() {
  const input = new Input();
  const pad = new FakeEl();
  input.attachTouch({}, pad);
  const game = new Game({ input, rng: () => 0.5 });
  game.start();
  game.enemies.length = 0;           // nobody near: facing follows the stick
  game.spawner.update = () => [];    // and nobody arrives
  const steps = (s) => { for (let i = 0; i < Math.round(s / STEP); i++) game.step(STEP); };
  // Thumb at a fraction of the pad radius along x (negative = left); 0 = centre.
  const thumb = (type, fx, id = 1) => pad.fire(type, { pointerId: id, clientX: 50 + fx * 50, clientY: 50 });
  return { input, pad, game, p: game.player, steps, thumb };
}

const SPRINT_VX = PHYSICS.playerSpeed * SPRINT.speedMultiplier;

test('running into the left edge, then reversing right without lifting, comes straight back off the edge', () => {
  const { game, p, steps, thumb } = world();
  thumb('pointerdown', -0.9);
  steps(2);
  assert.equal(p.sprinting, true);
  assert.equal(p.facing, -1);
  steps(2.0);
  assert.equal(p.x, game.player.minX, 'pinned at the left edge of the picture');
  assert.equal(p.sprinting, true, 'still running against the edge');
  thumb('pointermove', 0.9); // reverse without lifting
  steps(0.1);
  assert.equal(p.facing, 1, 'turned right');
  assert.equal(p.sprinting, true, 'still running');
  assert.ok(p.x > game.player.minX + 5, `moved off the edge (x ${p.x.toFixed(1)}, minX ${game.player.minX})`);
  assert.ok(Math.abs(p.vx - SPRINT_VX) < 1e-9, 'at sprint speed to the right');
  thumb('pointermove', 0); // neutral: stop
  steps(0.1);
  assert.equal(p.vx, 0);
  assert.equal(p.sprinting, false);
  assert.equal(p.state, 'idle');
  thumb('pointermove', 0.5); // walk right
  steps(0.1);
  assert.ok(Math.abs(p.vx - PHYSICS.playerSpeed) < 1e-9);
  thumb('pointerup', 0.5); // release: stop
  steps(0.1);
  assert.equal(p.vx, 0);
  assert.equal(p.state, 'idle');
});

test('the same the other way: running into the right edge, then reversing left', () => {
  const { game, p, steps, thumb } = world();
  thumb('pointerdown', 0.9);
  // The camera follows a player who runs right, so the right edge is reached only where the zone
  // ends: run until the player stops gaining ground while still pushing.
  let last = -1, pinned = 0;
  for (let i = 0; i < 20 / STEP && pinned < 3; i++) {
    game.step(STEP);
    if (p.vx > 0 && Math.abs(p.x - last) < 1e-9) pinned += 1; else pinned = 0;
    last = p.x;
  }
  assert.equal(pinned, 3, 'pinned at the right edge');
  assert.equal(p.x, game.player.maxX);
  assert.equal(p.facing, 1);
  assert.equal(p.sprinting, true);
  const edge = p.x;
  thumb('pointermove', -0.9);
  steps(0.1);
  assert.equal(p.facing, -1);
  assert.equal(p.sprinting, true);
  assert.ok(p.x < edge - 5, 'moved off the right edge');
  thumb('pointerup', -0.9);
  steps(0.1);
  assert.equal(p.vx, 0);
});

test('a lost pointerup at the edge cannot pin the player: the next touch takes over', () => {
  const { game, p, steps, thumb } = world();
  thumb('pointerdown', -0.9, 1);
  steps(2.0);
  assert.equal(p.x, game.player.minX);
  // The thumb lifts but the browser never reports it; the player touches again, to the right.
  thumb('pointerdown', 0.9, 2);
  steps(0.2);
  assert.equal(p.facing, 1);
  assert.ok(p.x > game.player.minX + 10, 'came back off the edge');
  assert.ok(Math.abs(p.vx - SPRINT_VX) < 1e-9);
  thumb('pointerup', 0.9, 2);
  steps(0.1);
  assert.equal(p.vx, 0);
  assert.equal(p.sprinting, false);
});

test('a pause and resume mid-run leaves nothing held: the thumb must press again', () => {
  const { input, game, p, steps, thumb } = world();
  thumb('pointerdown', -0.9);
  steps(0.3);
  assert.equal(p.sprinting, true);
  game.pause();
  game.resume();
  thumb('pointermove', 0.9); // the old contact keeps moving, but it was forgotten at the pause
  steps(0.2);
  assert.equal(p.vx, 0, 'a forgotten thumb cannot move the player');
  assert.equal(p.sprinting, false);
  assert.deepEqual(input.padPointerIds(), []);
  thumb('pointerdown', 0.9);
  steps(0.2);
  assert.ok(Math.abs(p.vx - SPRINT_VX) < 1e-9, 'a fresh press runs again');
});
