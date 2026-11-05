// Keyboard and touch input, normalised into one action set.
// "held" actions are true while the key/button is down; "pressed" actions fire once per press.
const KEY_MAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  KeyJ: 'punch',
  KeyK: 'kick',
  KeyL: 'block',
  KeyI: 'kiai',
};
// Fallback by key name for environments that do not report `code` (some virtual keyboards).
const KEY_NAME_MAP = {
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowDown: 'down', s: 'down',
  ArrowUp: 'jump', w: 'jump', ' ': 'jump', j: 'punch', k: 'kick', l: 'block', i: 'kiai',
};
const EDGE_ACTIONS = new Set(['jump', 'punch', 'kick', 'kiai']);

function actionFor(e) {
  return KEY_MAP[e.code] || KEY_NAME_MAP[(e.key || '').toLowerCase()] || KEY_NAME_MAP[e.key] || null;
}


export class Input {
  constructor() {
    this.held = { left: false, right: false, down: false, block: false, jump: false, punch: false, kick: false, kiai: false };
    this.pressed = { jump: false, punch: false, kick: false, kiai: false };
    this.active = false;          // when false, game keys are not captured (page scrolls normally)
    this.onPause = null;
    this.onConfirm = null;
    this.touchUsed = false;
    this.onTouchDetected = null;
  }

  attachKeyboard(target = window) {
    target.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP' || e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.active && this.onPause) { e.preventDefault(); this.onPause(); }
        return;
      }
      if ((e.code === 'Enter' || e.key === 'Enter') && this.onConfirm) { this.onConfirm(); return; }
      const action = actionFor(e);
      if (!action) return;
      if (!this.active) return;
      e.preventDefault();
      if (e.repeat) return;
      this.press(action);
    });
    target.addEventListener('keyup', (e) => {
      const action = actionFor(e);
      if (action) this.release(action);
    });
    // Losing focus must release every key or the fighter keeps walking.
    window.addEventListener('blur', () => this.reset());
  }

  // `buttons` maps action name -> element. Multi-touch is handled per pointer.
  attachTouch(buttons) {
    for (const [action, el] of Object.entries(buttons)) {
      if (!el) continue;
      const down = (e) => {
        e.preventDefault();
        if (!this.touchUsed) { this.touchUsed = true; this.onTouchDetected?.(); }
        el.classList.add('is-active');
        try { el.setPointerCapture(e.pointerId); } catch { /* not all browsers support capture */ }
        this.press(action);
      };
      const up = (e) => {
        e.preventDefault();
        el.classList.remove('is-active');
        this.release(action);
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  press(action) {
    if (!this.held[action] && EDGE_ACTIONS.has(action)) this.pressed[action] = true;
    this.held[action] = true;
  }

  release(action) {
    this.held[action] = false;
  }

  // Snapshot for one simulation frame; edges are then consumed.
  snapshot() {
    const s = { ...this.held, jump: this.pressed.jump, punch: this.pressed.punch, kick: this.pressed.kick, kiai: this.pressed.kiai };
    this.pressed.jump = this.pressed.punch = this.pressed.kick = this.pressed.kiai = false;
    return s;
  }

  reset() {
    for (const k of Object.keys(this.held)) this.held[k] = false;
    for (const k of Object.keys(this.pressed)) this.pressed[k] = false;
  }
}
