// HUD, menus and overlay screens (all drawn with the pixel font on the 384x216 canvas).
import { W, H, clamp, lerp, fmtTime, easeOut } from './util.js';
import { drawText, textWidth, wrapText } from './font.js';
import { Input } from './input.js';
import { Touch } from './touch.js';
import { Audio_ as A } from './audio.js';
import { SHEET, IMG, drawSheet } from './assets.js';
import { ICON } from './procart.js';
import { ZONES } from './rooms.js';
import { SPELLS } from './player.js';
import { ENCH, TUNE } from './enchant.js';
import { ITEMS } from './itemdata.js';

const GOLD = '#e8b84a', PALE = '#e8dcc0', DIM = '#8a7d9a', RED = '#c23b2a';
const icon = (ctx, name, x, y, sc = 1, a) => drawSheet(ctx, 'icons', ICON.indexOf(name), x, y, { ay: 0.5, scale: sc, alpha: a });

export function panel(ctx, x, y, w, h, alpha = 0.9) {
  ctx.fillStyle = `rgba(8,5,16,${alpha})`; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#6b5a2e'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = '#b8913f'; ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
}
function bar(ctx, x, y, w, h, frac, c1, c2, lag) {
  ctx.fillStyle = '#05030a'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = '#2a2236'; ctx.fillRect(x, y, w, h);
  if (lag !== undefined && lag > frac) { ctx.fillStyle = '#e8d8a8'; ctx.fillRect(x, y, Math.round(w * lag), h); }
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(x, y, Math.round(w * clamp(frac, 0, 1)), h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, Math.round(w * clamp(frac, 0, 1)), 1);
  ctx.fillStyle = '#b8913f'; ctx.fillRect(x - 2, y - 2, w + 4, 1); ctx.fillRect(x - 2, y + h + 1, w + 4, 1); ctx.fillRect(x - 2, y - 2, 1, h + 4); ctx.fillRect(x + w + 1, y - 2, 1, h + 4);
}

// ---------------------------------------------------------------------------------------------- HUD
export const HUD = {
  lagHp: 1, lagBoss: 1,
  draw(ctx, g) {
    const S = g.save, p = g.player; if (!S) return;
    const hpW = clamp(50 + S.maxHp * 0.45, 70, 150), mpW = clamp(36 + S.maxMp * 0.8, 50, 110);
    const hf = S.hp / S.maxHp; this.lagHp += (hf - this.lagHp) * (hf < this.lagHp ? 0.04 : 1);
    drawText(ctx, 'HP', 7, 6.5, { color: '#ff8a8a', outline: '#000', scale: 1.15 }); bar(ctx, 24, 7, hpW, 6, hf, '#ff4a4a', '#9a1a2a', this.lagHp);
    drawText(ctx, 'MP', 7, 16.5, { color: '#8ab4ff', outline: '#000', scale: 1.15 }); bar(ctx, 24, 17, mpW, 5, S.mp / S.maxMp, '#5a9aff', '#2a4ab0');
    drawText(ctx, 'LV ' + S.level, 7, 25.5, { color: GOLD, outline: '#000', scale: 1.15 });
    const xf = p.xpNext ? S.xp / p.xpNext() : 0; ctx.fillStyle = '#000'; ctx.fillRect(34, 28, 40, 3); ctx.fillStyle = '#6a5a1a'; ctx.fillRect(35, 29, 38, 1); ctx.fillStyle = GOLD; ctx.fillRect(35, 29, Math.round(38 * clamp(xf, 0, 1)), 1);
    // active sword enchantment: icon, name, time left, and (Aegis) whether the shield is up
    const E = p.ench;
    if (E) {
      const def = ENCH[E.type], css = `rgb(${def.rgb.map(v => Math.round(v * 255)).join(',')})`, secs = Math.ceil(E.t / 60), low = E.t < 600 && Math.floor(E.t / 12) % 2;
      icon(ctx, def.icon, 15, 44, 1.1, low ? 0.4 : 1); drawText(ctx, `${def.name} ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, 26, 36, { color: low ? '#8a7d9a' : css, outline: '#000' });
      ctx.fillStyle = '#000'; ctx.fillRect(25, 46, 52, 4); ctx.fillStyle = css; ctx.fillRect(26, 47, Math.round(50 * clamp(E.t / TUNE.time, 0, 1)), 2);
      if (E.type === 'aegis') drawText(ctx, E.shield > 0 ? 'SHIELD READY' : 'NO SHIELD', 26, 53, { color: E.shield > 0 ? '#9cd0ff' : '#5a5a70', outline: '#000' });
    }
    // hotbar: unlocked spells + carried items.  Q / V move the box, C / I uses what is selected.
    const slots = p.hotbar();
    if (slots.length) {
      const sw = 21, gap = 2, tot = slots.length * (sw + gap) - gap, x0 = W - 6 - tot, y = 5;
      slots.forEach((e, i) => {
        const sel = e.id === p.sel, sx = x0 + i * (sw + gap); panel(ctx, sx, y, sw, sw, sel ? 0.96 : 0.68);
        if (sel) { ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 1; ctx.strokeRect(sx - 0.5, y - 0.5, sw + 1, sw + 1); ctx.strokeStyle = 'rgba(255,233,160,0.4)'; ctx.strokeRect(sx - 1.5, y - 1.5, sw + 3, sw + 3); }
        if (e.kind === 'spell') { const sp = SPELLS[e.id], ok = S.mp >= sp.cost; icon(ctx, sp.icon, sx + sw / 2, y + sw / 2 - 1, 1.15, ok ? 1 : 0.4); drawText(ctx, String(sp.cost), sx + sw - 2, y + sw - 8.5, { align: 'right', color: ok ? '#8ab4ff' : '#666', outline: '#000' }); }
        else { const it = ITEMS[e.id], n = S.items[e.id]; icon(ctx, it.icon, sx + sw / 2, y + sw / 2 - 1, 1.15); drawText(ctx, String(n), sx + sw - 2, y + sw - 8.5, { align: 'right', color: n >= it.max ? GOLD : PALE, outline: '#000' }); }
      });
      const cur = slots.find(e => e.id === p.sel);
      if (cur) drawText(ctx, cur.kind === 'spell' ? SPELLS[cur.id].name : ITEMS[cur.id].short, W - 6, y + sw + 3, { align: 'right', color: PALE, outline: '#000' });
      if (slots.length > 1) drawText(ctx, 'Q', x0 - 9, y + 5, { color: DIM, outline: '#000' });
    }
    // gold
    icon(ctx, 'coin', W - 24, 43, 1); drawText(ctx, S.gold, W - 8, 40, { align: 'right', color: PALE, outline: '#000' });
    // abilities
    let ax = W - 24; for (const [k, ic] of [['djump', 'feather'], ['dash', 'boot'], ['ember', 'ember'], ['thunder', 'thunder']]) if (S.abilities[k]) { icon(ctx, ic, ax, 56, 0.8); ax -= 12; }
    // boss bar
    const b = g.boss; if (b && b.active && !b.dead) {
      const w = 220, x = (W - w) / 2, y = H - 22, f = Math.max(0, b.hp / b.maxHp); this.lagBoss += (f - this.lagBoss) * (f < this.lagBoss ? 0.03 : 1);
      drawText(ctx, b.bossName, W / 2, y - 12, { align: 'center', color: '#ffd08a', outline: '#200' }); bar(ctx, x, y, w, 7, f, '#e04a3a', '#7a1010', this.lagBoss);
    } else this.lagBoss = 1;
  },
};

// ---------------------------------------------------------------------------------------------- banners, popups, prompts
export function drawBanner(ctx, b) {
  if (!b) return; const t = b.t, a = t < 20 ? t / 20 : t > b.dur - 30 ? Math.max(0, (b.dur - t) / 30) : 1;
  ctx.globalAlpha = a; const y = b.y || 56;
  const lines = b.sub ? wrapText(b.sub, W - 60, 1.1, 'body') : []; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, y - 8, W, lines.length ? 26 + lines.length * 10 : 28);
  drawText(ctx, b.title, W / 2, y, { align: 'center', scale: 2, color: b.color || GOLD, outline: '#200' });
  if (b.sub) { lines.forEach((l, i) => drawText(ctx, l, W / 2, y + 20 + i * 10, { align: 'center', color: PALE, outline: '#000', scale: 1.1, font: 'body' })); }
  ctx.globalAlpha = 1;
}
export function drawPopups(ctx, list, cx, cy) {
  for (const p of list) { const a = Math.min(1, p.life / 20); drawText(ctx, p.text, p.x - cx, p.y - cy - (60 - p.life) * 0.35, { align: 'center', color: p.color, outline: '#000', alpha: a }); }
}
// a small UP arrow on a plate that bobs over anything the player can use with UP (doors, altars, tablets, chests, waystones, people); a word under it for the ones worth naming
function arrowPlate(ctx, X, Y) {
  ctx.fillStyle = '#05030a'; ctx.fillRect(X - 6, Y - 6, 13, 13);                          // dark rim
  ctx.fillStyle = '#d8b25a'; ctx.fillRect(X - 5, Y - 5, 11, 11);                           // gold border
  ctx.fillStyle = '#2a2236'; ctx.fillRect(X - 4, Y - 4, 9, 9);                             // plate
}
export function drawPrompt(ctx, x, y, t, text) {
  const X = Math.round(x), Y = Math.round(y + 4 + Math.sin(t * 0.12) * 1.5), pulse = 0.75 + 0.25 * Math.sin(t * 0.2);
  arrowPlate(ctx, X, Y); ctx.globalAlpha = pulse; ctx.fillStyle = '#fff3c8';
  ctx.fillRect(X, Y - 3, 1, 1); ctx.fillRect(X - 1, Y - 2, 3, 1); ctx.fillRect(X - 2, Y - 1, 5, 1); ctx.fillRect(X - 1, Y, 3, 3);     // the arrow: head, then stem
  ctx.globalAlpha = 1;
  if (text && text !== 'UP') drawText(ctx, text, X, Y + 9, { align: 'center', color: PALE, outline: '#000', scale: 0.8 });
}
// the same plate with a sideways arrow, on the edge of the screen where a room opens into the next one (dir -1 = left, +1 = right); it nudges toward the exit
export function drawExitArrow(ctx, x, y, t, dir) {
  const X = Math.round(x + dir * (1 + Math.sin(t * 0.14) * 1.5)), Y = Math.round(y), pulse = 0.75 + 0.25 * Math.sin(t * 0.2);
  arrowPlate(ctx, X, Y); ctx.globalAlpha = pulse; ctx.fillStyle = '#fff3c8';
  const px = (dx, dy, w, h) => ctx.fillRect(dir > 0 ? X + dx : X - dx - w + 1, Y + dy, w, h);     // dx counts from the centre toward the arrow's tip
  px(3, 0, 1, 1); px(2, -1, 1, 3); px(1, -2, 1, 5); px(-3, -1, 4, 3);                              // the tip, the head widening, then the stem
  ctx.globalAlpha = 1;
}

export class Dialog {
  constructor(text, o = {}) { this.lines = wrapText(text, 300); this.full = this.lines.join('\n'); this.t = 0; this.done = false; this.closed = false; this.name = o.name || null; this.onClose = o.onClose || null; this.choices = o.choices || null; this.sel = 0; this.choice = -1; this.footer = o.footer || null; }
  update() {
    this.t += 1.2; const skip = Input.pressed.confirm || Input.pressed.back || Input.pressed.attack || Input.pressed.jump;
    if (this.choices && this.t >= this.full.length) {                                       // a question: LEFT / RIGHT (or UP / DOWN) choose, ENTER / SPACE answers, ESC says no
      this.done = true; const n = this.choices.length;
      if (Input.pressed.left || Input.pressed.up) { this.sel = (this.sel + n - 1) % n; A.sfx('click'); } if (Input.pressed.right || Input.pressed.down) { this.sel = (this.sel + 1) % n; A.sfx('click'); }
      for (const t of Input.taps) { const i = Math.floor((t.x - 40) / 52); if (t.y > H - 60 && i >= 0 && i < n) { this.sel = i; this.choice = i; this.closed = true; } }          // (a tap on an answer)
      if (this.closed) return;
      if (Input.pressed.confirm || Input.pressed.jump) { this.choice = this.sel; this.closed = true; } else if (Input.pressed.back) { this.choice = n - 1; this.closed = true; }
      return;
    }
    if (skip) { if (this.t < this.full.length) this.t = this.full.length; else this.closed = true; } if (this.t > this.full.length) this.done = true;
  }
  draw(ctx) {
    const bottom = this.choices || this.footer, h = this.lines.length * 11 + 16 + (bottom ? 13 : 0), y = H - h - 14; panel(ctx, 30, y, W - 60, h);
    if (this.name) { const nw = textWidth(this.name, 1, { outline: true }) + 14; panel(ctx, 34, y - 12, nw, 14); drawText(ctx, this.name, 41, y - 9, { color: GOLD, outline: '#000' }); }       // who is speaking
    let n = Math.floor(this.t), yy = y + 8;
    for (const l of this.lines) { const s = l.slice(0, Math.max(0, Math.min(l.length, n))); drawText(ctx, s, 40, yy, { color: PALE }); n -= l.length + 1; yy += 11; }
    if (this.footer) drawText(ctx, this.footer, W - 42, y + h - 12, { align: 'right', color: '#b5a47a' });
    if (this.choices && this.done) this.choices.forEach((c, i) => { const sel = i === this.sel, x = 44 + i * 52; drawText(ctx, (sel ? '> ' : '  ') + c, x, y + h - 12, { color: sel ? GOLD : PALE, outline: '#000' }); });
    else if (this.done && !this.footer && Math.floor(performance.now() / 350) % 2) drawText(ctx, '>', W - 44, y + h - 11, { color: GOLD });
  }
}

// ---------------------------------------------------------------------------------------------- logo
let LOGO = null;
function logo() {
  if (LOGO) return LOGO; const sc = 6.5, text = 'Shadowkeep', w = Math.ceil(textWidth(text, sc, 'title')) + 20, h = 7 * sc + 24, K = (window.game && window.game.K) || 3;
  const mk = () => { const c = document.createElement('canvas'); c.width = w * K; c.height = h * K; c.lw = w; c.lh = h; const g = c.getContext('2d'); g.setTransform(K, 0, 0, K, 0, 0); return [c, g]; };
  const [c, g] = mk(), [t, tg] = mk(), [o, og] = mk();
  drawText(tg, text, w / 2, 10, { align: 'center', scale: sc, color: '#fff', font: 'title' });                  // letter shapes
  tg.globalCompositeOperation = 'source-in'; const gr = tg.createLinearGradient(0, 8, 0, 8 + 7 * sc + 6); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.45, '#f0b43a'); gr.addColorStop(1, '#9a2a14'); tg.fillStyle = gr; tg.fillRect(0, 0, w, h);
  drawText(og, text, w / 2, 10, { align: 'center', scale: sc, color: '#2a0a0e', font: 'title' });               // dark outline source
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2], [3, 3], [4, 4]]) g.drawImage(o, dx, dy, w, h);   // outline + drop shadow
  g.drawImage(t, 0, 0, w, h); LOGO = c; return c;
}

// ---------------------------------------------------------------------------------------------- menus
class Menu {
  constructor(items) { this.items = items; this.i = 0; this.hit = []; }
  update(g) {
    for (const t of Input.taps) for (let k = 0; k < this.hit.length; k++) {                  // a finger on an item (the rows are measured when the menu is drawn)
      const r = this.hit[k]; if (!r || t.x < r.x0 || t.x > r.x1 || t.y < r.y0 || t.y > r.y1) continue;
      this.i = k; const it = this.items[k]; if (it.adjust) { it.adjust(t.x < (r.x0 + r.x1) / 2 ? -1 : 1); A.sfx('click'); } else if (it.action && !it.disabled) { A.sfx('select'); it.action(); } return;
    }
    const n = this.items.length; if (Input.pressed.up) { this.i = (this.i + n - 1) % n; A.sfx('click'); } if (Input.pressed.down) { this.i = (this.i + 1) % n; A.sfx('click'); }
    const it = this.items[this.i];
    if (Input.pressed.left && it.adjust) { it.adjust(-1); A.sfx('click'); } if (Input.pressed.right && it.adjust) { it.adjust(1); A.sfx('click'); }
    if ((Input.pressed.confirm) && it.action && !it.disabled) { A.sfx('select'); it.action(); }
  }
  draw(ctx, x, y, gap = 14, align = 'center') {
    this.hit = [];
    this.items.forEach((it, i) => {
      const sel = i === this.i, label = typeof it.label === 'function' ? it.label() : it.label, yy = y + i * gap, col = it.disabled ? '#4a4258' : sel ? GOLD : PALE;
      const sc = 1.25, w = textWidth(label, sc, { outline: true }), lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, o = { color: col, outline: '#000', scale: sc };
      drawText(ctx, label, lx, yy, o);
      this.hit[i] = align === 'center' ? { x0: x - Math.max(w / 2 + 14, 56), x1: x + Math.max(w / 2 + 14, 56), y0: yy - 2, y1: yy + gap - 3 } : { x0: lx - 14, x1: lx + Math.max(w + 14, 150), y0: yy - 2, y1: yy + gap - 3 };
      if (it.bar) { const v = clamp(it.bar(), 0, 1), bx = lx + 84; for (let k = 0; k < 10; k++) { ctx.fillStyle = '#05030a'; ctx.fillRect(bx + k * 7 - 1, yy - 0.5, 7, 8); ctx.fillStyle = k < Math.round(v * 10) ? col : '#3a3048'; ctx.fillRect(bx + k * 7, yy + 0.5, 5, 6); } }
      if (it.val) drawText(ctx, it.val(), lx + 84, yy, o);
      if (sel) { drawText(ctx, '>', lx - 11, yy, o); if (!it.bar && !it.val) drawText(ctx, '<', lx + w + 5, yy, o); }
    });
  }
}

// credits.txt -> a list of lines to scroll.   # heading   ## subheading   --- rule   blank = gap   ; comment (not shown)   anything else = text (wrapped)
function layoutCredits(text) {
  const items = []; let y = 0;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, ''); if (line.startsWith(';')) continue;
    if (line === '') { y += 7; continue; }
    if (line.startsWith('---')) { items.push({ k: 'rule', y: y + 3 }); y += 11; continue; }
    if (line.startsWith('## ')) { items.push({ k: 'h2', text: line.slice(3), y }); y += 14; continue; }
    if (line.startsWith('# ')) { y += 4; items.push({ k: 'h1', text: line.slice(2), y }); y += 20; continue; }
    for (const l of wrapText(line, 262)) { items.push({ k: 'p', text: l, y }); y += 11; }
  }
  return { items, height: y };
}

export class TitleScreen {
  constructor(g) {
    this.g = g; this.t = 0; this.mode = 'main'; const has = g.hasSave();
    this.main = new Menu([
      { label: 'NEW GAME', action: () => g.newGame() }, { label: 'CONTINUE', disabled: !has, action: () => g.continueGame() },
      { label: 'CHOOSE SEED', action: () => {
        if (Input.touchOn) { const v = window.prompt('Choose a seed: numbers only (0 = the classic castle, empty = a random castle)', ''); if (v !== null) { const d = v.replace(/\D/g, '').slice(0, 9); g.newGame(d === '' ? undefined : +d); } }          // (a phone has no keys to type the number with: its own keyboard asks)
        else { this.mode = 'seed'; this.seed = ''; Input.typed.length = 0; } } },
      { label: 'CONTROLS', action: () => { this.mode = 'controls'; } }, { label: 'OPTIONS', action: () => { this.mode = 'options'; this.opts.i = 0; } }, { label: 'CREDITS', action: () => this.openCredits() },
    ]); if (has) this.main.i = 1;
    this.opts = optionsMenu(() => { this.mode = 'main'; });
  }
  // the credits are read from credits.txt (a plain text file the game's owner can edit) each time they are opened
  openCredits() {
    this.mode = 'credits'; const cr = this.cr = { lines: null, scroll: 0, t: 0 };
    fetch('credits.txt', { cache: 'no-cache' }).then(r => r.ok ? r.text() : Promise.reject(new Error(r.status))).then(t => { cr.lines = layoutCredits(t); })
      .catch(() => { cr.lines = layoutCredits('# CREDITS\ncredits.txt could not be loaded.'); });
  }
  update() {
    this.t++; const g = this.g;
    if (this.mode === 'main') this.main.update(g);
    else if (this.mode === 'credits') {
      const c = this.cr;
      if (c.lines) { const view = H - 44 - 30, max = Math.max(0, c.lines.height - view); c.t++; if (Input.held.down) c.scroll += 2; else if (Input.held.up) c.scroll -= 2; else if (c.t > 100) c.scroll += 0.2; c.scroll = clamp(c.scroll, 0, max); }
      if (Input.pressed.back || Input.pressed.confirm || Input.taps.length) { this.mode = 'main'; A.sfx('back'); }
    }
    else if (this.mode === 'seed') {
      for (const k of Input.typed.splice(0)) { if (k === '<') this.seed = this.seed.slice(0, -1); else if (this.seed.length < 9) this.seed += k; }
      if (Input.pressed.esc) { this.mode = 'main'; A.sfx('back'); } else if (Input.pressed.confirm) g.newGame(this.seed === '' ? undefined : +this.seed);
    } else if (this.mode === 'options') { this.opts.update(g); if (Input.pressed.back) { this.mode = 'main'; A.sfx('back'); } }
    else if (Input.pressed.back || Input.pressed.confirm || Input.taps.length) { this.mode = 'main'; A.sfx('back'); }
  }
  draw(ctx) {
    const t = this.t; ctx.fillStyle = '#0a0a1c'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(IMG.cemetery_sky, 0, 0);
    const mx = -((t * 0.15) % 192); for (let x = mx; x < W; x += 192) ctx.drawImage(IMG.cemetery_mountains, Math.round(x), 52);
    const gx = -((t * 0.4) % 384); for (let x = gx; x < W; x += 384) ctx.drawImage(IMG.cemetery_graveyard, Math.round(x), H - 123 + 20);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
    const lg = logo(); const bob = Math.sin(t * 0.03) * 1.5; ctx.drawImage(lg, Math.round(W / 2 - lg.lw / 2), Math.round(14 + bob), lg.lw, lg.lh);
    if (this.mode === 'main') { this.main.draw(ctx, W / 2, 110); drawText(ctx, Input.touchOn ? 'TAP AN ITEM' : 'ENTER / Z TO SELECT', W / 2, H - 14, { align: 'center', color: DIM }); }
    else if (this.mode === 'credits') {
      const c = this.cr; ctx.fillStyle = 'rgba(6,4,14,0.95)'; ctx.fillRect(0, 0, W, H); drawText(ctx, 'CREDITS', W / 2, 12, { align: 'center', scale: 1.8, color: GOLD, outline: '#000' });
      const top = 38, view = H - top - 30; ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, view); ctx.clip();
      if (!c.lines) drawText(ctx, 'LOADING...', W / 2, top + 20, { align: 'center', color: DIM });
      else for (const it of c.lines.items) {
        const y = Math.round(top + 4 + it.y - c.scroll); if (y < top - 22 || y > top + view) continue;
        if (it.k === 'rule') { ctx.fillStyle = '#4a3a2a'; ctx.fillRect(W / 2 - 60, y, 120, 1); }
        else if (it.k === 'h1') drawText(ctx, it.text, W / 2, y, { align: 'center', scale: 1.5, color: GOLD, outline: '#000' });
        else if (it.k === 'h2') drawText(ctx, it.text, W / 2, y, { align: 'center', color: '#e6c27a', outline: '#000' });
        else drawText(ctx, it.text, W / 2, y, { align: 'center', color: PALE, outline: '#000' });
      }
      ctx.restore(); ctx.fillStyle = 'rgba(10,10,28,0.9)'; ctx.fillRect(0, top - 6, W, 6);
      drawText(ctx, Input.touchOn ? 'UP / DOWN SCROLL     TAP TO GO BACK' : 'UP / DOWN SCROLL     ESC BACK', W / 2, H - 14, { align: 'center', color: DIM });
    }
    else if (this.mode === 'options') { panel(ctx, 60, 66, W - 120, 148); drawText(ctx, 'OPTIONS', W / 2, 73, { align: 'center', scale: 1.5, color: GOLD, outline: '#000' }); this.opts.draw(ctx, 84, 92, 14, 'left'); }
    else if (this.mode === 'seed') {
      panel(ctx, 50, 84, W - 100, 112); drawText(ctx, 'CHOOSE A SEED', W / 2, 91, { align: 'center', scale: 1.5, color: GOLD, outline: '#000' });
      const tw = textWidth(this.seed, 2); drawText(ctx, this.seed || 'RANDOM', W / 2 - (this.seed ? 3 : 0), 112, { align: 'center', scale: 2, color: this.seed ? PALE : DIM });
      if (this.seed && Math.floor(t / 24) % 2) { ctx.fillStyle = PALE; ctx.fillRect(Math.round(W / 2 - 3 + tw / 2 + 2), 112, 8, 12); }
      drawText(ctx, 'THE SAME SEED ALWAYS BUILDS THE SAME CASTLE.', W / 2, 138, { align: 'center', color: '#b5a47a' });
      drawText(ctx, 'TYPE NUMBERS.   0 = THE CLASSIC CASTLE.', W / 2, 150, { align: 'center', color: DIM });
      drawText(ctx, 'ENTER = BEGIN     ESC = BACK', W / 2, 176, { align: 'center', color: PALE });
    }
    else controlsScreen(ctx);
  }
}

function optionsMenu(onBack) {
  return new Menu([
    { label: 'MUSIC', bar: () => A.settings.music, adjust: d => A.setVolume('music', A.settings.music + d * 0.1) },
    { label: 'SOUND', bar: () => A.settings.sfx, adjust: d => { A.setVolume('sfx', A.settings.sfx + d * 0.1); A.sfx('select'); } },
    { label: 'MUTE', val: () => (A.settings.muted ? 'ON' : 'OFF'), action: () => A.toggleMute() },
    { label: 'BOSS HINTS', val: () => (A.settings.hints ? 'ON' : 'OFF'), action: () => { A.settings.hints = !A.settings.hints; A.save(); } },
    { label: 'WHITE CLOAK', val: () => (A.settings.cloak ? 'ON' : 'OFF'), action: () => { A.settings.cloak = !A.settings.cloak; A.save(); } },
    { label: '3D HAIR', val: () => (A.settings.hair ? 'ON' : 'OFF'), action: () => { A.settings.hair = !A.settings.hair; A.save(); } },
    { label: 'TOUCH PAD', val: () => (Touch.on ? 'ON' : 'OFF'), action: () => Touch.show(!Touch.on, true) },
    { label: 'BACK', action: onBack },
  ]);
}
export function controlsScreen(ctx) {
  panel(ctx, 36, 14, W - 72, H - 28, 0.96); drawText(ctx, 'CONTROLS', W / 2, 22, { align: 'center', color: GOLD, scale: 2 });
  const rows = Input.touchOn ? [['MOVE', 'SLIDE A THUMB ROUND THE PAD'], ['JUMP', 'JUMP  (AGAIN IN THE AIR = DOUBLE)'], ['ATTACK', 'HIT  (TAP AGAIN TO CHAIN A COMBO)'], ['DUCK', 'HOLD THE PAD DOWN  (HIT WHILE DUCKING)'], ['DROP DOWN', 'PAD DOWN + JUMP (THIN PLATFORMS)'], ['DASH', 'DASH'], ['USE SELECTED', 'ITEM  (SPELL OR ITEM)'], ['SELECT', 'ARROWS BESIDE ITEM / TOP BOX'], ['USE / DOOR', 'PAD UP'], ['MAP', 'MAP'], ['PAUSE', 'II'], ['FULL SCREEN', 'THE SQUARE AT THE TOP']] : [['MOVE', 'ARROWS / WASD'], ['JUMP', 'SPACE / Z / K (AGAIN = DOUBLE)'], ['ATTACK', 'X / J  (TAP AGAIN TO CHAIN A COMBO)'], ['DUCK', 'HOLD DOWN / S  (ATTACK WHILE DUCKING)'], ['DROP DOWN', 'DOWN / S + JUMP (THIN PLATFORMS)'], ['DASH', 'SHIFT / L'], ['USE SELECTED', 'C / I  (SPELL OR ITEM)'], ['SELECT', 'Q / V  (THE BOX AT THE TOP)'], ['USE / DOOR', 'UP / W / E'], ['MAP', 'M / TAB'], ['PAUSE', 'ESC / P / ENTER'], ['MUTE', 'N']];
  rows.forEach(([a, b], i) => { drawText(ctx, a, 50, 46 + i * 11, { color: PALE }); drawText(ctx, b, 148, 46 + i * 11, { color: '#b5a47a' }); });
  drawText(ctx, Input.touchOn ? 'TAP ANYWHERE TO RETURN' : 'GAMEPAD WORKS TOO.   ANY KEY TO RETURN', W / 2, H - 28, { align: 'center', color: DIM });
}

export class PauseMenu {
  constructor(g) {
    this.g = g; this.mode = 'main'; this.opts = optionsMenu(() => { this.mode = 'main'; });
    this.main = new Menu([{ label: 'RESUME', action: () => g.resume() }, { label: 'MAP', action: () => g.openMap() }, { label: 'OPTIONS', action: () => { this.mode = 'options'; this.opts.i = 0; } }, { label: 'CONTROLS', action: () => { this.mode = 'controls'; } }, { label: 'QUIT TO TITLE', action: () => g.toTitle() }]);
  }
  update() { if (this.mode === 'main') { this.main.update(this.g); if (Input.pressed.pkey || Input.pressed.back) this.g.resume(); } else if (this.mode === 'options') { this.opts.update(this.g); if (Input.pressed.back) this.mode = 'main'; } else if (Input.pressed.back || Input.pressed.confirm || Input.taps.length) this.mode = 'main'; }
  draw(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    if (this.mode === 'main') {
      const g = this.g, S = g.save; panel(ctx, 100, 36, W - 200, 150); drawText(ctx, 'PAUSED', W / 2, 46, { align: 'center', scale: 2, color: GOLD });
      this.main.draw(ctx, W / 2, 74, 13);
      drawText(ctx, `LV ${S.level}   HP ${S.hp}/${S.maxHp}   MP ${S.mp}/${S.maxMp}`, W / 2, 146, { align: 'center', color: PALE }); drawText(ctx, `POWER ${g.player.atkPower}   GOLD ${S.gold}   TIME ${fmtTime(S.time)}`, W / 2, 158, { align: 'center', color: '#b5a47a' }); drawText(ctx, S.seed ? 'CASTLE SEED ' + S.seed : 'THE CLASSIC CASTLE', W / 2, 170, { align: 'center', color: DIM });
    } else if (this.mode === 'options') { panel(ctx, 70, 40, W - 140, 150); drawText(ctx, 'OPTIONS', W / 2, 47, { align: 'center', scale: 1.5, color: GOLD, outline: '#000' }); this.opts.draw(ctx, 94, 68, 14, 'left'); }
    else controlsScreen(ctx);
  }
}

// ---------------------------------------------------------------------------------------------- map
// The castle is ~40 rooms wide, so the map scrolls: it centres on you (or, at a waystone, on the destination you are choosing).
const ZCOL = { 1: '#4a6a3a', 2: '#8a6a2a', 3: '#6a4a9a', 4: '#4a7a7a', 5: '#9a2a3a', 6: '#a8542a', 7: '#3a7a5a' };
const CW = 22, CH = 22;
export class MapScreen {
  // o.teleport = id of the waystone room we are standing in: the map becomes a destination picker for every attuned waystone
  constructor(g, o = {}) {
    this.g = g; this.t = 0; this.here = o.teleport || null; this.tele = !!o.teleport; this.pan = 0;
    const S = g.save; this.stones = (g.world.stones || []).filter(id => S.flags['tp_' + id]);
    if (this.tele) { const i = this.stones.indexOf(this.here); this.sel = i > 0 ? i - 1 : Math.min(1, this.stones.length - 1); if (this.sel < 0) this.sel = 0; }
    const f = this.focusRoom(); this.cam = { x: f.map.x * CW + CW / 2 };
  }
  focusRoom() { const g = this.g; return this.tele ? g.world.rooms[this.stones[this.sel]] : g.world.rooms[g.room.id]; }
  update() {
    this.t++; const g = this.g;
    if (this.tele) {
      if (Input.pressed.left && this.sel > 0) { this.sel--; A.sfx('select'); } if (Input.pressed.right && this.sel < this.stones.length - 1) { this.sel++; A.sfx('select'); }
      if (Input.pressed.confirm) { const id = this.stones[this.sel]; if (id && id !== this.here) g.teleportTo(id); else A.sfx('back'); return; }
      if (Input.pressed.map || Input.pressed.back || Input.pressed.pkey) g.resume();
    } else {
      if (Input.held.left) this.pan -= 3; if (Input.held.right) this.pan += 3; this.pan = clamp(this.pan, -900, 900);
      if (Input.pressed.map || Input.pressed.back || Input.pressed.pause || Input.pressed.confirm) g.resume();
    }
    const f = this.focusRoom(), want = f.map.x * CW + CW / 2 + (this.tele ? 0 : this.pan); this.cam.x += (want - this.cam.x) * 0.2;
  }
  draw(ctx) {
    const g = this.g, S = g.save, ROOMS = g.world.rooms; ctx.fillStyle = 'rgba(4,2,10,0.95)'; ctx.fillRect(0, 0, W, H);
    drawText(ctx, this.tele ? 'WAYSTONE' : 'CASTLE MAP', W / 2, 8, { align: 'center', scale: 2, color: this.tele ? '#9fe8ff' : GOLD });
    const rect = r => { const w = clamp(Math.round(r.w / 4.6), 9, 20), h = clamp(Math.round(r.h / 2.6), 7, 15); return { x: r.map.x * CW, y: r.map.y * CH + Math.round((CH - h) / 2), w, h }; };
    const rooms = Object.values(ROOMS).filter(r => S.visited[r.id]);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 28, W, 140); ctx.clip(); ctx.translate(Math.round(W / 2 - this.cam.x), 24);
    // lines between the rooms that are joined: a plain dark corridor where one room opens into the next, and a lighter line with a little door mark where the way is a DOOR (houses,
    // side rooms, an upper floor's door, the doors that join two areas).  A line is drawn once both of its rooms have been visited.
    const drawn = new Set();
    const join = (A, C, door) => {
      const key = [A.id, C.id].sort().join('|') + (door ? 'd' : 'e'); if (drawn.has(key)) return; drawn.add(key);
      const a = rect(A), c = rect(C), acy = a.y + a.h / 2, ccy = c.y + c.h / 2; let mx, my;
      ctx.fillStyle = door ? '#6f5f8c' : '#2a2236';
      if (Math.abs(acy - ccy) < 4) {                                                  // side by side: straight across
        const l = a.x < c.x ? a : c, r2 = a.x < c.x ? c : a, y = Math.round((acy + ccy) / 2) - 1; ctx.fillRect(l.x + l.w, y, Math.max(2, r2.x - l.x - l.w), 2); mx = Math.round((l.x + l.w + r2.x) / 2); my = y;
      } else {                                                                        // one above the other: down from the upper one, jogging sideways halfway if they are not lined up
        const u = acy < ccy ? a : c, d2 = acy < ccy ? c : a, ux = Math.round(u.x + u.w / 2), dx2 = Math.round(d2.x + d2.w / 2), y0 = u.y + u.h, y1 = d2.y, ym = Math.round((y0 + y1) / 2);
        ctx.fillRect(ux, y0, 2, Math.max(2, ym - y0 + 2)); if (dx2 !== ux) ctx.fillRect(Math.min(ux, dx2), ym, Math.abs(dx2 - ux) + 2, 2); ctx.fillRect(dx2, ym, 2, Math.max(2, y1 - ym + 1)); mx = dx2; my = ym;
      }
      if (door) { ctx.fillStyle = '#05030a'; ctx.fillRect(mx - 2, my - 2, 6, 6); ctx.fillStyle = '#d8b25a'; ctx.fillRect(mx - 1, my - 1, 4, 4); ctx.fillStyle = '#2a2236'; ctx.fillRect(mx, my, 2, 3); }
    };
    for (const r of rooms) {
      for (const e of r.exits) { const t = ROOMS[e.room]; if (t && S.visited[t.id] && e.side !== 'L') join(r, t, false); }
      for (const d of r.doors) { const t = ROOMS[d.room]; if (t && S.visited[t.id]) join(r, t, true); }
    }
    for (const r of rooms) {
      const q = rect(r), x = q.x, y = q.y, w = q.w, h = q.h, stone = r.spawns.some(sp => sp.type === 'waystone');
      ctx.fillStyle = ZCOL[r.zone] || '#555'; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 1, y + h - 2, w - 2, 1); ctx.strokeStyle = '#05030a'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      if (r.save) { ctx.fillStyle = '#e8b0ff'; ctx.fillRect(x + w / 2 - 1, y + h / 2 - 1, 3, 3); }
      if (stone) { const lit = S.flags['tp_' + r.id], cx = x + w / 2, cy = y + h / 2; ctx.fillStyle = lit ? '#8fe8ff' : '#3a5a6a'; ctx.fillRect(cx - 1, cy - 3, 3, 7); ctx.fillRect(cx - 3, cy - 1, 7, 3); ctx.fillStyle = '#05030a'; ctx.fillRect(cx, cy - 1, 1, 3); }
      if (r.boss) { const done = S.flags['boss_' + r.id]; icon(ctx, 'skull', x + w / 2, y + h / 2, 0.6, done ? 0.35 : 1); }
      if (r.id === g.room.id && Math.floor(this.t / 20) % 2) { ctx.strokeStyle = '#fff'; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1); }
    }
    if (this.tele) for (let i = 0; i < this.stones.length; i++) {       // brackets round every attuned waystone; the chosen one pulses
      const r = ROOMS[this.stones[i]]; if (!r) continue; const q = rect(r), on = i === this.sel, pad = on ? 3 + (Math.floor(this.t / 8) % 2) : 2;
      ctx.strokeStyle = on ? '#bff4ff' : (r.id === this.here ? '#ffffff' : '#4aa8c8'); ctx.lineWidth = on ? 2 : 1; ctx.strokeRect(q.x - pad + 0.5, q.y - pad + 0.5, q.w + pad * 2 - 1, q.h + pad * 2 - 1);
    }
    ctx.restore();
    if (this.tele) {
      const id = this.stones[this.sel], r = id && ROOMS[id];
      if (this.stones.length < 2) drawText(ctx, 'NO OTHER WAYSTONE IS ATTUNED YET', W / 2, H - 38, { align: 'center', color: PALE });
      else if (r) { drawText(ctx, (ZONES[r.zone].name + ' - ' + r.name).toUpperCase(), W / 2, H - 40, { align: 'center', color: '#bff4ff', scale: 1.2 }); drawText(ctx, id === this.here ? 'YOU ARE HERE' : (this.sel + 1) + ' / ' + this.stones.length, W / 2, H - 28, { align: 'center', color: DIM }); }
      drawText(ctx, Input.touchOn ? 'PAD LEFT / RIGHT CHOOSE     JUMP = TRAVEL     HIT = CANCEL' : 'LEFT / RIGHT CHOOSE     ENTER TRAVEL     ESC CANCEL', W / 2, H - 12, { align: 'center', color: PALE });
      return;
    }
    { const here = ROOMS[g.room.id]; if (here) drawText(ctx, 'YOU ARE IN:  ' + (ZONES[here.zone].name + ' - ' + here.name).toUpperCase(), W / 2, H - 47, { align: 'center', color: '#ffffff', scale: 1.1 }); }          // where the hero is
    const done = Object.keys(S.flags).filter(k => /^(g2|h2|c1|u1|u2|t1|c2|v2|v3|g4|w1|w2|w3|bu)_/.test(k) && !k.endsWith('_u')).length;
    drawText(ctx, 'WHITE = YOU   PURPLE = SAVE   CYAN CROSS = WAYSTONE', W / 2, H - 35, { align: 'center', color: DIM }); drawText(ctx, 'SKULL = BOSS   ARROWS SCROLL', W / 2, H - 24, { align: 'center', color: DIM }); drawText(ctx, `ROOMS ${Object.keys(S.visited).length}/${Object.keys(ROOMS).length}   SECRETS ${done}   ${S.seed ? 'SEED ' + S.seed : 'CLASSIC CASTLE'}`, W / 2, H - 12, { align: 'center', color: PALE });
  }
}

// ---------------------------------------------------------------------------------------------- story screens
const INTRO = [
  'FOR A HUNDRED YEARS THE SUN HAS NOT RISEN OVER THE VALE.',
  'IT WAS TAKEN BY THE LORD OF THE SHADOWKEEP, WHO WALLED THE DAWN BEHIND HIS THRONE.',
  'THOSE WHO ENTERED NEVER RETURNED. THEIR PORTRAITS STILL WATCH THE HALLS.',
  'YOU HAVE NO NAME. ONLY A CLOAK, A BLADE, AND A DEBT THE DARKNESS OWES.',
  'THE GATE IS OPEN. THE STORM IS WAITING.',
];
export class IntroCrawl {
  constructor(g) { this.g = g; this.t = 0; this.i = 0; this.chars = 0; this.hold = 0; this.done = false; }
  update() {
    this.t++; const line = INTRO[this.i];
    if (this.chars < line.length) this.chars += 0.7; else { this.hold++; if (this.hold > 150) this.next(); }
    if (Input.pressed.confirm || Input.pressed.attack) { if (this.chars < line.length) this.chars = line.length; else this.next(); }
    if (Input.pressed.pkey || Input.pressed.esc) this.g.beginPlay();
  }
  next() { this.i++; this.chars = 0; this.hold = 0; if (this.i >= INTRO.length) this.g.beginPlay(); }
  draw(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); const l = INTRO[Math.min(this.i, INTRO.length - 1)];
    const SC = 1.3, rows = wrapText(l, 330, SC, 'body'), y0 = H / 2 - rows.length * 8;
    rows.reduce((y, row, k, arr) => { const n = Math.max(0, Math.floor(this.chars) - arr.slice(0, k).join(' ').length - (k ? 1 : 0)); drawText(ctx, row.slice(0, n), W / 2 - textWidth(row, SC, 'body') / 2, y, { color: PALE, outline: '#000', scale: SC, font: 'body' }); return y + 16; }, y0);
    drawText(ctx, Input.touchOn ? 'TAP TO CONTINUE   II TO SKIP' : 'ENTER TO CONTINUE   ESC TO SKIP', W / 2, H - 12, { align: 'center', color: '#5a4a6a' });
  }
}

export class GameOver {
  constructor(g) { this.g = g; this.t = 0; this.menu = new Menu([{ label: 'CONTINUE FROM LAST SAVE', action: () => g.respawn() }, { label: 'QUIT TO TITLE', action: () => g.toTitle() }]); }
  update() { this.t++; if (this.t > 80) this.menu.update(this.g); }
  draw(ctx) {
    const a = clamp(this.t / 70, 0, 1); ctx.fillStyle = `rgba(10,0,4,${a * 0.9})`; ctx.fillRect(0, 0, W, H);
    if (this.t > 30) drawText(ctx, 'YOU DIED', W / 2, 62, { align: 'center', scale: 4, color: '#b01a2a', outline: '#000', alpha: clamp((this.t - 30) / 50, 0, 1) });
    if (this.t > 80) { this.menu.draw(ctx, W / 2, 120, 16); }
  }
}

export class Ending {
  constructor(g) { this.g = g; this.t = 0; this.menu = null; }
  update() { this.t++; if (this.t > 780 && !this.menu) this.menu = new Menu([{ label: 'RETURN TO TITLE', action: () => this.g.toTitle() }]); if (this.menu) this.menu.update(this.g); }
  draw(ctx) {
    const t = this.t, g = this.g, S = g.save; const a = clamp(t / 240, 0, 1);
    const grd = ctx.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, `rgba(${Math.round(30 + 200 * a)},${Math.round(20 + 120 * a)},${Math.round(60 + 30 * a)},${0.35 + 0.65 * a})`); grd.addColorStop(1, `rgba(${Math.round(120 + 130 * a)},${Math.round(60 + 90 * a)},${Math.round(30 + 40 * a)},${0.5 + 0.5 * a})`);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    const sy = H - 20 - easeOut(clamp((t - 40) / 400, 0, 1)) * 110; ctx.fillStyle = `rgba(255,236,170,${0.4 + 0.6 * a})`; ctx.beginPath(); ctx.arc(W / 2, sy + 60, 34 + a * 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a0612'; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, H - 36); for (let x = 0; x <= W; x += 24) ctx.lineTo(x, H - 36 - Math.abs(Math.sin(x * 0.07)) * 14); ctx.lineTo(W, H); ctx.fill();
    if (t > 200) { const k = clamp((t - 200) / 60, 0, 1); drawText(ctx, 'THE SUN RISES OVER THE VALE', W / 2, 30, { align: 'center', scale: 2, color: '#fff0b0', outline: '#3a1008', alpha: k }); }
    [['THE SHADOWKEEP CRUMBLES.', 54, 330], ['THE STRANGER WALKS INTO THE LIGHT,', 66, 360], ['AND IS NEVER SEEN AGAIN.', 78, 400]].forEach(([txt, yy, t0]) => { if (t > t0) drawText(ctx, txt, W / 2, yy, { align: 'center', scale: 1.15, color: '#3a1008', alpha: clamp((t - t0) / 60, 0, 1) }); });
    if (t > 520) { const k = clamp((t - 520) / 60, 0, 1); panel(ctx, 100, 100, W - 200, 62, 0.8 * k); ctx.globalAlpha = k; drawText(ctx, `TIME ${fmtTime(S.time)}    LEVEL ${S.level}`, W / 2, 108, { align: 'center', color: PALE }); drawText(ctx, `FOES SLAIN ${g.kills + (S.kills || 0)}    ITEMS ${g.itemPercent()}%`, W / 2, 122, { align: 'center', color: PALE }); drawText(ctx, 'THANK YOU FOR PLAYING', W / 2, 142, { align: 'center', color: GOLD }); ctx.globalAlpha = 1; }
    if (this.menu) this.menu.draw(ctx, W / 2, H - 38, 14);
  }
}
