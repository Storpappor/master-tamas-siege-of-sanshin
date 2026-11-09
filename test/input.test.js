// The input layer, driven headlessly with fake elements and the browser event names it listens
// to. These are pointer *logic* tests: they prove what the code does with the events it is given,
// not how a real phone browser delivers them. Device validation is a separate, manual step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Input, padDirections, padRunning, PAD } from '../src/input.js';

// Minimal element: listeners, classList, inline style, pointer capture and a fixed box for the pad.
class FakeEl {
  constructor(rect = { left: 0, top: 0, width: 100, height: 100 }) {
    this.handlers = {};
    this.classes = new Set();
    this.classList = {
      add: (c) => this.classes.add(c),
      remove: (c) => this.classes.delete(c),
      toggle: (c, on) => { if (on) this.classes.add(c); else this.classes.delete(c); },
      contains: (c) => this.classes.has(c),
    };
    this.vars = {};
    this.style = { setProperty: (k, v) => { this.vars[k] = v; }, removeProperty: (k) => { delete this.vars[k]; } };
    this.rect = rect;
    this.captured = [];
  }
  addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
  setPointerCapture(id) { this.captured.push(id); }
  getBoundingClientRect() { return this.rect; }
  fire(type, props = {}) {
    for (const fn of this.handlers[type] || []) fn({ preventDefault() {}, pointerId: 0, clientX: 0, clientY: 0, ...props });
  }
}

// The game's input set as the player reads it (NO_INPUT in game.js plus the pad's sprint request).
const GAME_KEYS = ['left', 'right', 'up', 'down', 'duck', 'block', 'jump', 'punch', 'kick', 'kiai', 'sprint'];

function touchInput() {
  const buttons = { jump: new FakeEl(), punch: new FakeEl(), kick: new FakeEl(), throw: new FakeEl(), kiai: new FakeEl() };
  const pad = new FakeEl({ left: 0, top: 0, width: 100, height: 100 }); // centre (50, 50), radius 50
  const input = new Input();
  input.attachTouch(buttons, pad);
  return { input, buttons, pad };
}

test('a snapshot has exactly the game input set and consumes edges', () => {
  const { input, buttons } = touchInput();
  buttons.jump.fire('pointerdown', { pointerId: 1 });
  const s = input.snapshot();
  assert.deepEqual(Object.keys(s).sort(), [...GAME_KEYS].sort(), 'no extra keys such as throw reach the game');
  assert.equal(s.jump, true);
  assert.equal(input.snapshot().jump, false, 'the edge fires once');
});

test('two thumbs on two different buttons do not disturb each other', () => {
  const { input, buttons } = touchInput();
  buttons.punch.fire('pointerdown', { pointerId: 1 });
  buttons.kick.fire('pointerdown', { pointerId: 2 });
  let s = input.snapshot();
  assert.equal(s.punch, true);
  assert.equal(s.kick, true);
  buttons.punch.fire('pointerup', { pointerId: 1 });
  buttons.punch.fire('lostpointercapture', { pointerId: 1 });
  assert.equal(input.held.kick, true, 'the other thumb is still down');
  assert.equal(input.held.punch, false);
});

test('a direction held on the pad survives taps of the other thumb', () => {
  const { input, buttons, pad } = touchInput();
  pad.fire('pointerdown', { pointerId: 1, clientX: 20, clientY: 50 }); // left, walk zone
  for (let i = 0; i < 20; i++) {
    buttons.punch.fire('pointerdown', { pointerId: 10 + i });
    buttons.punch.fire('pointerup', { pointerId: 10 + i });
    buttons.punch.fire('lostpointercapture', { pointerId: 10 + i });
    const s = input.snapshot();
    assert.equal(s.left, true, `still walking left after tap ${i + 1}`);
    assert.equal(s.punch, true, `punch ${i + 1} registered`);
  }
});

test('two fingers on one button: lifting one keeps it held, lifting both releases it', () => {
  const { input, buttons } = touchInput();
  buttons.kick.fire('pointerdown', { pointerId: 1 });
  buttons.kick.fire('pointerdown', { pointerId: 2 });
  buttons.kick.fire('pointerup', { pointerId: 1 });
  assert.equal(input.held.kick, true, 'finger 2 is still on the button');
  assert.equal(buttons.kick.classes.has('is-active'), true);
  buttons.kick.fire('pointerup', { pointerId: 2 });
  assert.equal(input.held.kick, false);
  assert.equal(buttons.kick.classes.has('is-active'), false);
});

test('a stray release for a pointer that never pressed is ignored', () => {
  const { input, buttons } = touchInput();
  buttons.jump.fire('pointerdown', { pointerId: 1 });
  buttons.jump.fire('pointerup', { pointerId: 99 });
  assert.equal(input.held.jump, true);
});

test('the pad reads the thumb position: dead zone, four directions and diagonals', () => {
  const rect = { left: 0, top: 0, width: 100, height: 100 };
  assert.deepEqual(padDirections(50, 50, rect), []);
  assert.deepEqual(padDirections(50 + PAD.deadZone * 50 - 1, 50, rect), [], 'just inside the dead zone');
  assert.deepEqual(padDirections(5, 50, rect), ['left']);
  assert.deepEqual(padDirections(95, 50, rect), ['right']);
  assert.deepEqual(padDirections(50, 5, rect), ['up']);
  assert.deepEqual(padDirections(50, 95, rect), ['down']);
  assert.deepEqual(padDirections(10, 10, rect), ['left', 'up'], 'a corner holds both axes');
  assert.deepEqual(padDirections(90, 90, rect), ['right', 'down']);
  assert.deepEqual(padDirections(-40, 50, rect), ['left'], 'the thumb may leave the pad');
});

test('the run zone has separate entry and exit thresholds, both inside the pad', () => {
  assert.ok(PAD.runEnter > PAD.runExit, 'hysteresis');
  assert.ok(PAD.runEnter < 1 && PAD.runExit > PAD.axisThreshold, 'both comfortably inside the pad');
  assert.equal(padRunning(PAD.runEnter - 0.01, false), false, 'just short of the line: still walking');
  assert.equal(padRunning(PAD.runEnter, false), true, 'on the line: running');
  assert.equal(padRunning(PAD.runEnter - 0.01, true), true, 'drifting back a little keeps the run');
  assert.equal(padRunning(PAD.runExit, true), true, 'at the exit line: still running');
  assert.equal(padRunning(PAD.runExit - 0.01, true), false, 'inside the exit line: walking again');
  assert.equal(padRunning(1.4, false), true, 'a thumb outside the pad runs');
});

test('drag farther to run: walk, run, pull back, release, with no simulated re-taps', () => {
  const { input, pad } = touchInput();
  const events = [];
  input.onEvent = (ev) => events.push(`${ev.type}:${ev.action}`);
  pad.fire('pointerdown', { pointerId: 1, clientX: 20, clientY: 50 }); // d = 0.60: walk zone
  let s = input.snapshot();
  assert.equal(s.left, true);
  assert.equal(s.sprint, false, 'inner zone walks');
  pad.fire('pointermove', { pointerId: 1, clientX: 8, clientY: 50 }); // d = 0.84: run zone
  s = input.snapshot();
  assert.equal(s.left, true);
  assert.equal(s.sprint, true, 'outer zone runs');
  assert.equal(pad.classes.has('is-running'), true);
  pad.fire('pointermove', { pointerId: 1, clientX: 16, clientY: 50 }); // d = 0.68: between the lines
  assert.equal(input.snapshot().sprint, true, 'still running until the exit line');
  pad.fire('pointermove', { pointerId: 1, clientX: 22, clientY: 50 }); // d = 0.56: inside the exit line
  s = input.snapshot();
  assert.equal(s.sprint, false, 'pulled inward: walking');
  assert.equal(s.left, true, 'direction kept the whole time');
  assert.equal(pad.classes.has('is-running'), false);
  pad.fire('pointerup', { pointerId: 1, clientX: 22, clientY: 50 });
  s = input.snapshot();
  assert.equal(s.left || s.sprint, false, 'release stops');
  assert.deepEqual(events.filter((e) => e.endsWith(':left')), ['press:left', 'release:left'], 'the direction was never released and re-pressed to run');
});

test('running on a diagonal keeps both directions and the run; the thumb may leave the pad', () => {
  const { input, pad } = touchInput();
  pad.fire('pointerdown', { pointerId: 1, clientX: 12, clientY: 12 }); // d = 1.07 (corner), beyond the pad circle
  const s = input.snapshot();
  assert.deepEqual([s.left, s.up, s.sprint], [true, true, true]);
  pad.fire('pointermove', { pointerId: 1, clientX: -30, clientY: 50 }); // far outside, left
  const t = input.snapshot();
  assert.deepEqual([t.left, t.up, t.sprint], [true, false, true]);
});

test('a running thumb that goes back to the centre stops everything', () => {
  const { input, pad } = touchInput();
  pad.fire('pointerdown', { pointerId: 1, clientX: 95, clientY: 50 });
  assert.equal(input.snapshot().sprint, true);
  pad.fire('pointermove', { pointerId: 1, clientX: 50, clientY: 50 });
  const s = input.snapshot();
  assert.equal(s.right || s.sprint, false);
  assert.equal(pad.classes.has('is-active') || pad.classes.has('is-running'), false);
});

test('sliding the thumb across the pad changes direction without lifting', () => {
  const { input, pad } = touchInput();
  pad.fire('pointerdown', { pointerId: 1, clientX: 20, clientY: 50 });
  assert.equal(input.snapshot().left, true);
  assert.deepEqual(pad.captured, [1], 'the pad captured the pointer');
  pad.fire('pointermove', { pointerId: 1, clientX: 80, clientY: 50 });
  let s = input.snapshot();
  assert.equal(s.left, false, 'left released on the way across');
  assert.equal(s.right, true, 'right pressed');
  pad.fire('pointermove', { pointerId: 1, clientX: 78, clientY: 22 });
  s = input.snapshot();
  assert.equal(s.right, true);
  assert.equal(s.up, true, 'diagonal: both held');
  pad.fire('pointermove', { pointerId: 1, clientX: 50, clientY: 50 });
  s = input.snapshot();
  assert.equal(s.right || s.up || s.left || s.down, false, 'centre releases everything');
  assert.equal(pad.classes.has('is-active'), false);
  pad.fire('pointermove', { pointerId: 1, clientX: 50, clientY: 80 });
  assert.equal(input.snapshot().down, true);
  pad.fire('pointerup', { pointerId: 1, clientX: 50, clientY: 80 });
  assert.equal(input.snapshot().down, false, 'lifting releases');
});

test('a pointermove from a pointer that did not start on the pad does nothing', () => {
  const { input, pad } = touchInput();
  pad.fire('pointermove', { pointerId: 7, clientX: 5, clientY: 50 });
  assert.equal(input.held.left, false);
});

test('pointercancel and lost capture release only that pointer\'s actions, run included', () => {
  const { input, buttons, pad } = touchInput();
  pad.fire('pointerdown', { pointerId: 1, clientX: 5, clientY: 5 });
  buttons.kick.fire('pointerdown', { pointerId: 2 });
  assert.equal(input.held.sprint, true);
  pad.fire('pointercancel', { pointerId: 1 });
  assert.equal(input.held.left || input.held.up || input.held.sprint, false);
  assert.equal(input.held.kick, true, 'the other thumb is unaffected');
  pad.fire('pointerdown', { pointerId: 3, clientX: 95, clientY: 50 });
  assert.equal(input.held.sprint, true);
  pad.fire('lostpointercapture', { pointerId: 3 });
  assert.equal(input.held.right || input.held.sprint, false);
});

test('reset (pause, blur, rotation) clears the run and forgets the thumb until it presses again', () => {
  const { input, pad } = touchInput();
  pad.fire('pointerdown', { pointerId: 1, clientX: 95, clientY: 50 });
  assert.equal(input.held.sprint, true);
  input.reset();
  assert.equal(input.held.right || input.held.sprint, false);
  assert.equal(pad.classes.has('is-running'), false);
  pad.fire('pointermove', { pointerId: 1, clientX: 95, clientY: 50 });
  assert.equal(input.held.right, false, 'a forgotten thumb cannot move the player by sliding');
  pad.fire('pointerdown', { pointerId: 1, clientX: 95, clientY: 50 });
  assert.equal(input.held.right && input.held.sprint, true, 'a fresh press works');
});

test('THROW becomes punch and kick on the same step, which is the grab chord', () => {
  const { input, buttons } = touchInput();
  buttons.throw.fire('pointerdown', { pointerId: 1 });
  const s = input.snapshot();
  assert.equal(s.punch, true);
  assert.equal(s.kick, true);
  assert.equal('throw' in s, false);
  const next = input.snapshot();
  assert.equal(next.punch || next.kick, false, 'consumed');
});

test('the Ajsich meter is a plain edge action', () => {
  const { input, buttons } = touchInput();
  buttons.kiai.fire('pointerdown', { pointerId: 1 });
  assert.equal(input.snapshot().kiai, true);
  assert.equal(input.snapshot().kiai, false);
});

test('keyboard and touch holding the same action: releasing one keeps the other', () => {
  const { input, pad } = touchInput();
  input.active = true;
  const win = new FakeEl();
  input.attachKeyboard(win);
  win.fire('keydown', { code: 'ArrowLeft', key: 'ArrowLeft', repeat: false });
  pad.fire('pointerdown', { pointerId: 1, clientX: 20, clientY: 50 });
  win.fire('keyup', { code: 'ArrowLeft', key: 'ArrowLeft' });
  assert.equal(input.held.left, true, 'the thumb still holds left');
  pad.fire('pointerup', { pointerId: 1, clientX: 20, clientY: 50 });
  assert.equal(input.held.left, false);
});

test('the keyboard has no sprint key; key repeat fires no second edge; reset clears every source', () => {
  const input = new Input();
  input.active = true;
  const win = new FakeEl();
  input.attachKeyboard(win);
  win.fire('keydown', { code: 'Space', key: ' ', repeat: false });
  win.fire('keydown', { code: 'Space', key: ' ', repeat: true });
  assert.equal(input.snapshot().jump, true);
  assert.equal(input.snapshot().jump, false);
  assert.equal(input.held.jump, true);
  for (const code of ['ShiftLeft', 'KeyR', 'ArrowRight']) win.fire('keydown', { code, key: code, repeat: false });
  assert.equal(input.held.sprint, false, 'no key maps to the pad sprint request');
  input.reset();
  assert.equal(input.held.jump, false);
  assert.equal(input.sources.jump.size, 0);
});
