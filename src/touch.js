// On-screen controls for phones and tablets.  They are drawn as HTML over the game (not in the canvas), appear by themselves on a touch screen (a coarse pointer, or the first touch), and hide again
// if a physical key is pressed.  ?touch=1 forces them on (handy on a desktop for testing), ?touch=0 keeps them off; Options > TOUCH PAD switches them by hand.
//   * the D-PAD is one round pad: slide a thumb round it to run, duck or go through a door (UP is also USE, like the arrow key);
//   * JUMP and HIT are the two big buttons (and double as OK / BACK in the menus, as Z and X do);  DASH, ITEM (use what is selected) and the two small arrows that change it are on the right;
//   * the buttons along the top: pause, map, full screen.  In menus only the D-pad, OK and BACK show; tapping a menu item picks it, and tapping the item box in the corner changes the item.
// Every button holds the same named actions a key would (Input.touchHold / touchRelease), so the game does not know the difference.
import { Input } from './input.js';

const W = 384, H = 216;
const CSS = `
#touch { position: fixed; inset: 0; z-index: 4; pointer-events: none; display: none; --u: clamp(38px, min(15vmin, 8.2vw), 96px);
  font-family: Georgia, 'Times New Roman', serif; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: none; -webkit-tap-highlight-color: transparent; }
#touch .tb, #touch .dpad { position: absolute; pointer-events: auto; touch-action: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  color: #f0dcae; font-weight: bold; font-size: calc(var(--u) * 0.3); letter-spacing: 0.5px; text-shadow: 0 1px 2px #000; border: 2px solid rgba(214,166,80,0.7);
  background: radial-gradient(circle at 35% 30%, rgba(96,62,40,0.55), rgba(22,10,16,0.64)); box-shadow: 0 2px 8px rgba(0,0,0,0.6), inset 0 0 10px rgba(0,0,0,0.5); opacity: 0.72; }
#touch .tb.on { transform: scale(0.92); opacity: 1; background: radial-gradient(circle at 40% 35%, rgba(205,142,60,0.8), rgba(96,42,20,0.85)); }
#touch .hide { display: none; }
#touch .tb.small { font-size: calc(var(--u) * 0.42); border-radius: 30%; }
#touch .dpad { left: calc(env(safe-area-inset-left, 0px) + var(--u) * 0.45); bottom: calc(env(safe-area-inset-bottom, 0px) + var(--u) * 0.45); width: calc(var(--u) * 3.3); height: calc(var(--u) * 3.3); }
#touch .dpad i { position: absolute; font-style: normal; font-size: calc(var(--u) * 0.55); line-height: 1; color: rgba(240,220,174,0.75); width: 33%; height: 33%; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
#touch .dpad i.on { color: #fff; background: rgba(205,142,60,0.7); }
#touch .dpad .u { top: 4%; left: 33.5%; } #touch .dpad .d { bottom: 4%; left: 33.5%; } #touch .dpad .l { left: 4%; top: 33.5%; } #touch .dpad .r { right: 4%; top: 33.5%; }
#touch .dpad b { position: absolute; width: 26%; height: 26%; left: 37%; top: 37%; border-radius: 50%; background: rgba(0,0,0,0.35); border: 1px solid rgba(214,166,80,0.35); }
#touch .hint { position: absolute; left: 0; right: 0; top: calc(56.25vw + 10px); text-align: center; color: #b58a4a; font-size: 13px; letter-spacing: 1px; display: none; animation: tfade 12s forwards; }
@keyframes tfade { 0%, 75% { opacity: 1; } 100% { opacity: 0; } }
@media (orientation: portrait) { body.touch #wrap { align-items: flex-start; } #touch .hint { display: block; } }
`;

export const Touch = {
  on: false, forced: false, mode: '', game: null, btns: [], rels: [],

  init(game) {
    const q = new URLSearchParams(location.search).get('touch'); this.game = game; this.forced = q === '1'; const off = q === '0';
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this.build();
    const coarse = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches);
    this.show(!off && (this.forced || coarse));
    if (!off) {
      addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !this.on) this.show(true); }, true);                                 // a first touch brings the pad up
      addEventListener('keydown', e => { if (this.on && !this.forced && e.isTrusted && !this.manual) this.show(false); });                     // a real key press sends it away
    }
    const letGo = () => { for (const f of this.rels) f(); Input.releaseTouch(); };                                                             // (never leave a button stuck down)
    addEventListener('blur', letGo); document.addEventListener('visibilitychange', () => { if (document.hidden) letGo(); });
    // tapping the game: a menu item, a dialogue, the item box in the corner
    const stage = document.getElementById('stage');
    stage.addEventListener('pointerdown', e => {
      if (!this.on) return; const g = this.game, s = g.state, r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
      if (s === 'play') { if (!g.cutscene && x > 322 && y < 52) this.blip('itemNext'); return; }
      Input.tap(x, y); if (s === 'dialog' || s === 'dead' || s === 'intro' || s === 'ending') this.blip('confirm');
    });
  },

  show(v, manual = false) {
    if (v === this.on) return; this.on = v; this.manual = v && manual; Input.touchOn = v; this.root.style.display = v ? 'block' : 'none'; document.body.classList.toggle('touch', v);
    if (!v) { for (const f of this.rels) f(); Input.releaseTouch(); } this.mode = ''; if (this.game && this.game.resize) this.game.resize();
  },
  blip(a) { Input.touchHold(a); setTimeout(() => Input.touchRelease(a), 70); },

  // called every step: which buttons make sense right now (the whole set while playing; just pad, OK and BACK in menus)
  sync(g) {
    if (!this.on) return; const s = g.state, mode = s === 'play' ? 'play' : (s === 'pause' || s === 'map') ? 'pause' : 'menu'; if (mode === this.mode) return; this.mode = mode;
    for (const b of this.btns) b.el.classList.toggle('hide', !b.modes.includes(mode));
  },

  build() {
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };
    const root = this.root = el('div'); root.id = 'touch'; document.body.appendChild(root);
    root.addEventListener('contextmenu', e => e.preventDefault());
    root.appendChild(el('div', 'hint', 'TURN YOUR DEVICE SIDEWAYS FOR A BIGGER PICTURE'));
    const ALL = ['play', 'pause', 'menu'];
    // a round button that holds some actions while a finger is on it
    const button = (label, acts, pos, size, modes, cls = '', wide = size) => {
      const e = el('div', 'tb ' + cls, label); let id = null; e.style.height = `calc(var(--u) * ${size})`; e.style.width = `calc(var(--u) * ${wide})`;
      for (const k in pos) e.style[k] = typeof pos[k] === 'string' ? pos[k] : k === 'left' ?`calc(env(safe-area-inset-left, 0px) + var(--u) * ${pos[k]})` : k === 'right' ? `calc(env(safe-area-inset-right, 0px) + var(--u) * ${pos[k]})` : k === 'bottom' ? `calc(env(safe-area-inset-bottom, 0px) + var(--u) * ${pos[k]})` : pos[k];
      const down = ev => { ev.preventDefault(); if (id !== null) return; id = ev.pointerId; try { e.setPointerCapture(id); } catch {} e.classList.add('on'); for (const a of acts) Input.touchHold(a); };
      const up = ev => { if (ev && ev.pointerId !== id) return; if (id === null) return; id = null; e.classList.remove('on'); for (const a of acts) Input.touchRelease(a); };
      e.addEventListener('pointerdown', down); e.addEventListener('pointerup', up); e.addEventListener('pointercancel', up); e.addEventListener('lostpointercapture', up); this.rels.push(() => up(null));
      root.appendChild(e); this.btns.push({ el: e, modes }); return e;
    };
    button('JUMP', ['jump', 'confirm'], { right: 0.3, bottom: 1.5 }, 1.35, ALL);
    button('HIT', ['attack', 'back'], { right: 1.95, bottom: 0.4 }, 1.35, ALL);
    button('DASH', ['dash'], { right: 3.65, bottom: 1.55 }, 1.05, ['play']);
    button('ITEM', ['spell'], { right: 1.95, bottom: 2.95 }, 1.05, ['play']);
    button('‹', ['itemPrev'], { right: 3.2, bottom: 3.15 }, 0.62, ['play'], 'small');
    button('›', ['itemNext'], { right: 1.2, bottom: 3.15 }, 0.62, ['play'], 'small');
    // along the top, in the middle (the corners belong to the game's own bars and item box)
    const top = (at, w, label, acts, modes) => button(label, acts, { top: 'calc(env(safe-area-inset-top, 0px) + 6px)', left: `calc(50% + var(--u) * ${at})` }, 0.74, modes, 'small', w);          // (centred as a row: MAP 1.15 wide, II and the full-screen square 0.8, 0.15 between)
    top(-1.525, 1.15, 'MAP', ['map'], ['play']);
    top(-0.225, 0.8, 'II', ['pause', 'back', 'esc'], ALL);
    const de = document.documentElement, reqFs = de.requestFullscreen || de.webkitRequestFullscreen, exitFs = document.exitFullscreen || document.webkitExitFullscreen;
    if (reqFs) {                                                                                                                       // (phones that have no full screen, such as the iPhone's Safari, get no button)
      const fs = top(0.725, 0.8, '⛶', [], ALL); fs.addEventListener('pointerup', () => {
        try { if (document.fullscreenElement || document.webkitFullscreenElement) exitFs.call(document); else { const p = reqFs.call(de); if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } } catch {}
      });
    }
    // the D-pad: one round pad, a thumb slides round it
    const pad = el('div', 'dpad'), arrows = { up: el('i', 'u', '▲'), down: el('i', 'd', '▼'), left: el('i', 'l', '◀'), right: el('i', 'r', '▶') };
    pad.appendChild(el('b')); for (const k in arrows) pad.appendChild(arrows[k]); root.appendChild(pad); this.btns.push({ el: pad, modes: ALL });
    const ACTS = { left: ['left'], right: ['right'], up: ['up', 'interact'], down: ['down'] }, held = { left: false, right: false, up: false, down: false }; let pid = null;
    const set = d => { for (const k in held) if (held[k] !== !!d[k]) { held[k] = !!d[k]; arrows[k].classList.toggle('on', held[k]); for (const a of ACTS[k]) held[k] ? Input.touchHold(a) : Input.touchRelease(a); } };
    const read = ev => { const r = pad.getBoundingClientRect(), dx = (ev.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (ev.clientY - (r.top + r.height / 2)) / (r.height / 2); set({ left: dx < -0.28, right: dx > 0.28, up: dy < -0.42, down: dy > 0.42 }); };
    pad.addEventListener('pointerdown', ev => { ev.preventDefault(); if (pid !== null) return; pid = ev.pointerId; try { pad.setPointerCapture(pid); } catch {} read(ev); });
    pad.addEventListener('pointermove', ev => { if (ev.pointerId === pid) read(ev); });
    const end = ev => { if (ev && ev.pointerId !== pid) return; pid = null; set({}); };
    pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end); pad.addEventListener('lostpointercapture', end); this.rels.push(() => end(null));
  },
};
