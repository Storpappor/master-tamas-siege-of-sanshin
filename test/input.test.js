// The input layer, driven headlessly with fake elements and the browser event names it listens
// to. These are pointer *logic* tests: they prove what the code does with the events it is given,
// not how a real phone browser delivers them. Device validation is a separate, manual step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Input, padDirections, PAD } from '../src/input.js';

// Minimal element: listeners, classList, pointer capture and a fixed box for the pad.
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

const GAME_KEYS = ['left', 'right', 'up', 'down', 'duck', 'block', 'jump', 'punch', 'kick', 'kiai'];

function touchInput() {
  const buttons = { jump: new FakeEl(), punch: new FakeEl(), kick: new FakeEl(), throw: new FakeEl(), kiai: new FakeEl() };
  const pad = new FakeEl({ left: 0, top: 0, width: 100, height: 100 });
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
  pad.fire('pointerdown', { pointerId: 1, clientX: 10, clientY: 50 }); // far left
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

test('sliding the thumb across the pad changes direction without lifting', () => {
  const { input, pad } = touchInput();
  pad.fire('pointerdown', { pointerId: 1, clientX: 10, clientY: 50 });
  assert.equal(input.snapshot().left, true);
  assert.deepEqual(pad.captured, [1], 'the pad captured the pointer');
  pad.fire('pointermove', { pointerId: 1, clientX: 90, clientY: 50 });
  let s = input.snapshot();
  assert.equal(s.left, false, 'left released on the way across');
  assert.equal(s.right, true, 'right pressed');
  pad.fire('pointermove', { pointerId: 1, clientX: 90, clientY: 10 });
  s = input.snapshot();
  assert.equal(s.right, true);
  assert.equal(s.up, true, 'diagonal: both held');
  pad.fire('pointermove', { pointerId: 1, clientX: 50, clientY: 50 });
  s = input.snapshot();
  assert.equal(s.right || s.up || s.left || s.down, false, 'centre releases everything');
  assert.equal(pad.classes.has('is-active'), false);
  pad.fire('pointermove', { pointerId: 1, clientX: 50, clientY: 95 });
  assert.equal(input.snapshot().down, true);
  pad.fire('pointerup', { pointerId: 1, clientX: 50, clientY: 95 });
  assert.equal(input.snapshot().down, false, 'lifting releases');
});

test('a pointermove from a pointer that did not start on the pad does nothing', () => {
  const { input, pad } = touchInput();
  pad.fire('pointermove', { pointerId: 7, clientX: 5, clientY: 50 });
  assert.equal(input.held.left, false);
});

test('a double-tap on the pad is seen as two separate presses of the same direction', () => {
  const { input, pad } = touchInput();
  pad.fire('pointerdown', { pointerId: 1, clientX: 95, clientY: 50 });
  pad.fire('pointerup', { pointerId: 1, clientX: 95, clientY: 50 });
  pad.fire('pointerdown', { pointerId: 2, clientX: 95, clientY: 50 });
  const presses = [];
  const { input: logged, pad: pad2 } = touchInput();
  logged.onEvent = (ev) => presses.push(`${ev.type}:${ev.action}`);
  pad2.fire('pointerdown', { pointerId: 1, clientX: 95, clientY: 50 });
  pad2.fire('pointerup', { pointerId: 1, clientX: 95, clientY: 50 });
  pad2.fire('pointerdown', { pointerId: 2, clientX: 95, clientY: 50 });
  assert.deepEqual(presses, ['press:right', 'release:right', 'press:right']);
  assert.equal(input.held.right, true);
});

test('pointercancel releases only that pointer\'s actions', () => {
  const { input, buttons, pad } = touchInput();
  pad.fire('pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
  buttons.kick.fire('pointerdown', { pointerId: 2 });
  pad.fire('pointercancel', { pointerId: 1 });
  assert.equal(input.held.left, false);
  assert.equal(input.held.up, false);
  assert.equal(input.held.kick, true, 'the other thumb is unaffected');
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
  pad.fire('pointerdown', { pointerId: 1, clientX: 5, clientY: 50 });
  win.fire('keyup', { code: 'ArrowLeft', key: 'ArrowLeft' });
  assert.equal(input.held.left, true, 'the thumb still holds left');
  pad.fire('pointerup', { pointerId: 1, clientX: 5, clientY: 50 });
  assert.equal(input.held.left, false);
});

test('key repeat does not fire a second edge; reset clears every source', () => {
  const input = new Input();
  input.active = true;
  const win = new FakeEl();
  input.attachKeyboard(win);
  win.fire('keydown', { code: 'Space', key: ' ', repeat: false });
  win.fire('keydown', { code: 'Space', key: ' ', repeat: true });
  assert.equal(input.snapshot().jump, true);
  assert.equal(input.snapshot().jump, false);
  assert.equal(input.held.jump, true);
  input.reset();
  assert.equal(input.held.jump, false);
  assert.equal(input.sources.jump.size, 0);
});
