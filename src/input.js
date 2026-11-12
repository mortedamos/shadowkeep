// Keyboard + gamepad input mapped to named actions, with per-step edge detection.
const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyZ', 'KeyK'], attack: ['KeyX', 'KeyJ'], dash: ['ShiftLeft', 'ShiftRight', 'KeyL'],
  spell: ['KeyC', 'KeyI'], itemPrev: ['KeyQ'], itemNext: ['KeyV'], interact: ['ArrowUp', 'KeyW', 'KeyE'],
  map: ['KeyM', 'Tab'], pause: ['Escape', 'KeyP', 'Enter'],
  confirm: ['Enter', 'Space', 'KeyZ', 'KeyJ'], back: ['Escape', 'Backspace', 'KeyX'],
  mute: ['KeyN'], pkey: ['KeyP'], esc: ['Escape'],
};
const PAD = { // standard gamepad mapping -> action
  jump: [0], attack: [2], dash: [1, 7], spell: [3, 6], itemPrev: [4], itemNext: [5], pause: [9], map: [8], confirm: [0, 9], back: [1],
  up: [12], down: [13], left: [14], right: [15], interact: [12],
};
const actions = Object.keys(KEYMAP);
const codeToActions = {};
for (const a of actions) for (const c of KEYMAP[a]) (codeToActions[c] ||= []).push(a);

export const Input = {
  held: Object.fromEntries(actions.map(a => [a, false])),
  pressed: Object.fromEntries(actions.map(a => [a, false])),
  released: Object.fromEntries(actions.map(a => [a, false])),
  _keys: new Set(), _pend: new Set(), _pendRel: new Set(), _padHeld: {}, anyKey: false, _anyPend: false, gamepad: false, typed: [],
  // on-screen touch controls (touch.js): a touch button holds the same named actions a key would (a count per action, since two fingers may hold one); taps = where a finger touched a menu screen, in 384x216 game pixels
  _touch: {}, touchOn: false, taps: [], _taps: [],
  touchHold(a) { this._touch[a] = (this._touch[a] || 0) + 1; this._pend.add(a); this._anyPend = true; },
  touchRelease(a) { if (!this._touch[a]) return; this._touch[a]--; this._pendRel.add(a); },
  releaseTouch() { for (const a in this._touch) { if (this._touch[a] > 0) this._pendRel.add(a); this._touch[a] = 0; } },
  tap(x, y) { this._taps.push({ x, y }); this._anyPend = true; },
  // a hint written for the keyboard, reworded for the on-screen buttons when they are showing
  hint(s) { return !this.touchOn ? s : s.replace('PRESS SHIFT TO DASH', 'TAP THE DASH BUTTON TO DASH').replace('PRESS C TO', 'TAP THE ITEM BUTTON TO').replace('Q / V CHANGE WHAT C USES', 'THE ARROWS BESIDE IT CHANGE WHAT IT USES'); },

  init() {
    const block = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
    addEventListener('keydown', e => {
      if (block.has(e.code)) e.preventDefault();
      if (/^[0-9]$/.test(e.key)) this.typed.push(e.key); else if (e.key === 'Backspace') this.typed.push('<'); if (this.typed.length > 32) this.typed.shift();      // typed digits (seed entry)
      if (e.repeat) return;
      this._keys.add(e.code); this._anyPend = true;
      for (const a of codeToActions[e.code] || []) this._pend.add(a);
    });
    addEventListener('keyup', e => {
      this._keys.delete(e.code);
      for (const a of codeToActions[e.code] || []) this._pendRel.add(a);
    });
    addEventListener('blur', () => { this._keys.clear(); });
  },

  // call once at the start of each logic step
  poll() {
    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find(p => p && p.connected);
    const padNow = {};
    if (pad) {
      this.gamepad = true;
      for (const a in PAD) padNow[a] = PAD[a].some(b => pad.buttons[b] && pad.buttons[b].pressed);
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (ax < -0.45) padNow.left = true; if (ax > 0.45) padNow.right = true;
      if (ay < -0.55) { padNow.up = true; padNow.interact = true; } if (ay > 0.55) padNow.down = true;
    }
    for (const a of actions) {
      const keyHeld = KEYMAP[a].some(c => this._keys.has(c)) || (this._touch[a] || 0) > 0;          // (an on-screen button counts as a key)
      const padHeld = !!padNow[a];
      const was = this.held[a];
      const now = keyHeld || padHeld;
      this.pressed[a] = this._pend.has(a) || (padHeld && !this._padHeld[a]);
      this.released[a] = this._pendRel.has(a) || (!now && was);
      this.held[a] = now || this.pressed[a];      // a tap shorter than one poll still counts as held for a step
      this._padHeld[a] = padHeld;
    }
    this.anyKey = this._anyPend || Object.values(padNow).some(Boolean) && !this._padAny;
    this._padAny = Object.values(padNow).some(Boolean);
    this._anyPend = false; this.taps = this._taps; this._taps = [];
    this._pend.clear(); this._pendRel.clear();
  },
  get horiz() { return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0); },
};
