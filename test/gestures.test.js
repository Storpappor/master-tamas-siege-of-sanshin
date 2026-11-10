// The gesture guard, driven with fake document and window objects. Logic only: whether the
// browser actually honours a prevented gesture is a device question.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installGestureGuard, ZOOM_RESET } from '../src/gestures.js';

class FakeNode {
  constructor(parent = null) { this.parent = parent; this.nodeName = 'DIV'; this.className = ''; this.dataset = {}; }
  contains(node) { for (let n = node; n; n = n.parent) if (n === this) return true; return false; }
  closest() { return null; }
}

function fakeWorld({ scale = 1 } = {}) {
  const listeners = { doc: {}, vv: {}, orient: {} };
  const on = (bag) => (type, fn) => { (bag[type] ||= []).push(fn); };
  const fire = (bag, type, e) => { for (const fn of bag[type] || []) fn(e); };
  const metaAttrs = { content: 'width=device-width, initial-scale=1, viewport-fit=cover' };
  const meta = { getAttribute: (k) => metaAttrs[k], setAttribute: (k, v) => { metaAttrs[k] = v; writes.push(v); } };
  const writes = [];
  const root = new FakeNode();
  const inside = new FakeNode(root);
  const outside = new FakeNode();
  const vv = { scale, width: 390, height: 844, offsetLeft: 0, offsetTop: 0, addEventListener: on(listeners.vv) };
  const rafs = [];
  const win = {
    visualViewport: vv,
    innerWidth: 390, innerHeight: 844,
    screen: { orientation: { type: 'portrait-primary', addEventListener: on(listeners.orient) } },
    requestAnimationFrame: (fn) => { rafs.push(fn); },
    performance: { now: () => Date.now() },
  };
  const doc = { addEventListener: on(listeners.doc), querySelector: () => meta };
  const flushRaf = () => { while (rafs.length) rafs.shift()(); };
  return { root, inside, outside, vv, win, doc, listeners, fire, writes, metaAttrs, flushRaf };
}

const prevented = () => { const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; return e; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('pinch moves inside the game are refused in menus and in play; a one-finger move only in play', () => {
  const w = fakeWorld();
  let playing = false;
  const guard = installGestureGuard({ root: w.root, isPlaying: () => playing, doc: w.doc, win: w.win });
  const move = (targets) => { const e = { ...prevented(), touches: targets.map((target) => ({ target })) }; w.fire(w.listeners.doc, 'touchmove', e); return e.defaultPrevented; };
  assert.equal(move([w.inside, w.inside]), true, 'two fingers in a menu: refused');
  assert.equal(move([w.inside, w.outside]), true, 'one finger in the game is enough to refuse a pinch');
  assert.equal(move([w.outside, w.outside]), false, 'pinches outside the game are not ours');
  assert.equal(move([w.inside]), false, 'a single finger may scroll a menu');
  playing = true;
  assert.equal(move([w.inside]), true, 'while playing a single finger is a control, not a scroll');
  assert.equal(move([w.outside]), false);
  assert.equal(guard.stats.blockedPinchMoves, 2);
  assert.equal(guard.stats.blockedPlayMoves, 1);
});

test("WebKit gesture events that start inside the game are refused and counted", () => {
  const w = fakeWorld();
  const guard = installGestureGuard({ root: w.root, doc: w.doc, win: w.win });
  const g = (type, target) => { const e = { ...prevented(), target }; w.fire(w.listeners.doc, type, e); return e.defaultPrevented; };
  assert.equal(g('gesturestart', w.inside), true);
  assert.equal(g('gesturechange', w.inside), true);
  assert.equal(g('gesturestart', w.outside), false);
  assert.equal(guard.stats.blockedGestures, 1);
});

test('a zoom while playing is snapped back once, by rewriting and restoring the viewport meta', async () => {
  const w = fakeWorld({ scale: 1.8 });
  const guard = installGestureGuard({ root: w.root, isPlaying: () => true, doc: w.doc, win: w.win, settleMs: 5 });
  w.fire(w.listeners.vv, 'resize', {});
  await wait(20);
  assert.equal(guard.stats.zoomResets, 1);
  assert.match(w.writes[0], /maximum-scale=1, user-scalable=no/);
  w.flushRaf();
  assert.equal(w.metaAttrs.content, 'width=device-width, initial-scale=1, viewport-fit=cover', 'original meta restored');
});

test('no snap-back in a menu, unless a rotation just happened', async () => {
  const w = fakeWorld({ scale: 1.5 });
  const guard = installGestureGuard({ root: w.root, isPlaying: () => false, doc: w.doc, win: w.win, settleMs: 5 });
  w.fire(w.listeners.vv, 'resize', {});
  await wait(20);
  assert.equal(guard.stats.zoomResets, 0, 'a reader zooming a menu on purpose is left alone');
  let rotations = 0;
  const w2 = fakeWorld({ scale: 1.5 });
  const guard2 = installGestureGuard({ root: w2.root, isPlaying: () => false, onRotate: () => { rotations += 1; }, doc: w2.doc, win: w2.win, settleMs: 5 });
  w2.fire(w2.listeners.orient, 'change', {});
  await wait(20);
  assert.equal(rotations, 1, 'rotation clears the held input');
  assert.equal(guard2.stats.zoomResets, 1, 'and snaps the zoom back even in a menu');
});

test('the snap-back is bounded: repeated viewport resizes cannot reset the page in a loop', async () => {
  const w = fakeWorld({ scale: 2 }); // a browser that ignores the meta: the scale never returns to 1
  const guard = installGestureGuard({ root: w.root, isPlaying: () => true, doc: w.doc, win: w.win, settleMs: 2 });
  for (let i = 0; i < 12; i++) { w.fire(w.listeners.vv, 'resize', {}); await wait(8); }
  assert.equal(guard.stats.zoomResets, ZOOM_RESET.maxResets, `at most ${ZOOM_RESET.maxResets} resets inside the window`);
  assert.equal(guard.stats.suppressedResets, 12 - ZOOM_RESET.maxResets);
  assert.equal(w.writes.filter((v) => /maximum-scale/.test(v)).length, ZOOM_RESET.maxResets, 'the meta was rewritten only that many times');
  assert.match(guard.describe(), /suppressed=9/);
});

test('a scale of 1 never triggers a reset and the diagnostic line reports the viewport', async () => {
  const w = fakeWorld({ scale: 1 });
  const guard = installGestureGuard({ root: w.root, isPlaying: () => true, doc: w.doc, win: w.win, settleMs: 2 });
  w.fire(w.listeners.vv, 'resize', {});
  await wait(10);
  assert.equal(guard.stats.zoomResets, 0);
  assert.match(guard.describe(), /scale=1\.00 vv=390x844/);
});
