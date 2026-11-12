// World objects: pickups, breakable candles, save altar, lore tablets, chests, upgrades, ability relics.
import { Entity, moveX, moveY } from './entity.js';
import { drawSheet, IMG } from './assets.js';
import { ICON } from './procart.js';
import { Audio_ as A } from './audio.js';
import { COLORS } from './fx.js';
import { T, rand, dist, overlap, TAU, choice } from './util.js';
import { ENCH, ENCH_TYPES, ENCH_BIAS, TUNE } from './enchant.js';
import { ITEMS, addItem, randomItemId } from './itemdata.js';

export const ABILITIES = {
  djump: { name: 'RAVEN FEATHER', desc: 'PRESS JUMP AGAIN IN MIDAIR TO DOUBLE JUMP.', icon: 'feather', color: [0.6, 0.85, 1] },
  dash: { name: 'SHADOW STEP', desc: 'PRESS SHIFT TO DASH. YOU CANNOT BE HURT WHILE STEPPING THROUGH SHADOW.', icon: 'boot', color: [0.75, 0.5, 1] },
  ember: { name: 'EMBER RUNE', desc: 'PRESS C TO HURL FIRE. IT BURNS WOODEN BARRICADES. Q / V CHANGE WHAT C USES.', icon: 'ember', color: [1, 0.55, 0.2] },
  thunder: { name: 'THUNDER RUNE', desc: 'PRESS C TO CALL LIGHTNING DOWN ON YOUR FOES AND SHATTER CRYSTAL.', icon: 'thunder', color: [0.9, 0.95, 1] },
  dawn: { name: 'THE DAWN', desc: '', icon: 'orb', color: [1, 0.9, 0.5] },
};
export const UPGRADES = {
  hpup: { name: 'HEART CONTAINER', desc: 'MAX HP UP', icon: 'hpup', color: [1, 0.3, 0.35] },
  mpup: { name: 'MANA CRYSTAL', desc: 'MAX MP UP', icon: 'mpup', color: [0.4, 0.7, 1] },
  atkup: { name: 'WHETSTONE OF WOE', desc: 'SWORD POWER UP', icon: 'atkup', color: [1, 0.85, 0.4] },
};
export const iconFrame = name => ICON.indexOf(name);

// ------------------------------------------------------------------------------------------------ pickups
export class Pickup extends Entity {
  constructor(kind, x, y, vx = rand(-1, 1), vy = -2.8) {
    super(x, y, 10, 10); this.kind = kind; this.vx = vx; this.vy = vy; this.life = kind.startsWith('e_') ? 1500 : 720; this.magnet = false;      // enchant gems linger 25s
    this.ench = kind.startsWith('e_') ? ENCH[kind.slice(2)] : null;
    this.item = kind.startsWith('it_') ? kind.slice(3) : null; this.qty = this.item ? ITEMS[this.item].pack : 0; this.flagId = null; this.fullT = 0;      // carried-item pickups (dagger, torch, ...)
  }
  update(g) {
    this.t++; const p = g.player, room = g.room;
    const pc = { x: p.x, y: p.y - 16 }, d = dist(this.x, this.y - 5, pc.x, pc.y);
    if (this.t > 24 && d < 44 && !p.dead) this.magnet = true;
    if (this.magnet) { const a = Math.atan2(pc.y - (this.y - 5), pc.x - this.x), sp = Math.min(4.5, 2 + this.t * 0.01 + (44 - Math.min(d, 44)) * 0.05); this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp; this.x += this.vx; this.y += this.vy; }
    else { this.vy = Math.min(this.vy + 0.14, 4); this.vx *= 0.97; moveX(this, room); const vy0 = this.vy; moveY(this, room); if (this.onGround && Math.abs(vy0) > 1) { this.vy = -vy0 * 0.35; this.onGround = false; } }
    if (--this.life <= 0) this.dead = true;
    if (d < 11 && !p.dead) this.collect(g, p);
    const col = this.ench ? this.ench.rgb : (this.item ? [0.85, 0.9, 1] : { heart: [1, 0.3, 0.35], potion: [1, 0.3, 0.35], mana: [0.4, 0.7, 1], coin: [1, 0.85, 0.3], gem: [0.4, 0.95, 1] }[this.kind]);
    if (col) g.fx.glow(this.x, this.y - 6, this.ench ? 22 : 12, col, this.ench ? 0.55 : 0.35);
    if (this.ench) { g.fx.light(this.x, this.y - 6, 46, 0.6); if (this.t % 6 === 0) g.fx.emit({ x: this.x + rand(-6, 6), y: this.y - 6 + rand(-6, 6), vx: 0, vy: -rand(0.2, 0.6), life: 30, s0: 5, s1: 1, c0: col, a0: 1, a1: 0, kind: 6 }); }
  }
  collect(g, p) {
    const S = g.save;
    if (this.item) {         // a carried item: stack it (up to the item's maximum) - if you're full it stays where it is
      const it = ITEMS[this.item], add = addItem(S, this.item, this.qty);
      if (add <= 0) { if (this.fullT-- <= 0) { g.popup(p.x, p.y - 42, it.short + ' FULL', '#cfc2a0'); this.fullT = 90; A.sfx('back'); } return; }
      this.dead = true; if (this.flagId) S.flags[this.flagId] = true; A.sfx('pickup'); g.popup(p.x, p.y - 40, '+' + add + ' ' + it.short, '#e8dcc0'); g.fx.sparks(this.x, this.y - 6, 6, [[1, 1, 1], [0.7, 0.8, 1]], 1.8);
      if (!p.sel) p.sel = this.item; return;
    }
    this.dead = true;
    if (this.ench) { p.setEnchant(this.kind.slice(2)); return; }
    switch (this.kind) {
      case 'heart': p.heal(10); A.sfx('pickup'); break;
      case 'potion': p.heal(45); A.sfx('heal'); g.fx.ring(p.x, p.y - 16, 22, [0.5, 1, 0.6], 18); break;
      case 'mana': p.gainMp(18); A.sfx('mana'); g.popup(p.x, p.y - 40, '+MP', '#6aa8ff'); break;
      case 'coin': S.gold += 15; A.sfx('coin'); break;
      case 'gem': S.gold += 50; p.gainXp(10); A.sfx('coin'); g.popup(p.x, p.y - 40, '+50', '#7ff'); break;
    }
    g.fx.sparks(this.x, this.y - 6, 5, COLORS.gold, 1.6);
  }
  draw(ctx, cx, cy) {
    if (this.life < 150 && Math.floor(this.life / 5) % 2) return;
    const bob = this.magnet ? 0 : Math.sin(this.t * 0.1) * 1;
    if (this.kind === 'gem') { drawSheet(ctx, 'szadi_gem', Math.floor(this.t / 6) % 5, this.x - cx, this.y - 6 - cy + bob, { ay: 0.5, scale: 1.8 }); return; }       // Szadi's sparkling diamond
    drawSheet(ctx, 'icons', iconFrame(this.item ? ITEMS[this.item].icon : this.ench ? this.kind : { heart: 'heart', potion: 'potion', mana: 'mana', coin: 'coin', gem: 'gem' }[this.kind]), this.x - cx, this.y - 6 - cy + bob, { ay: 0.5, scale: this.ench ? 1.35 : this.item ? 1.15 : 1 });
  }
}

// Sometimes an enemy leaves a sword-enchantment gem.  Elite enemies drop more often; a "pity" bonus grows with every kill
// that drops nothing, so gems arrive about every 13 kills on average.  Bosses always drop one.
export function rollEnchantDrop(g, e, guaranteed = false) {
  g.enchPity = (g.enchPity || 0) + 1;
  const base = (e.xp || 0) >= 14 ? TUNE.dropElite : TUNE.dropBase, chance = guaranteed ? 1 : base + Math.min(TUNE.dropPityMax, g.enchPity * TUNE.dropPity);
  if (Math.random() >= chance) return false;
  g.enchPity = 0; const bias = ENCH_BIAS[e.name], type = bias && Math.random() < 0.55 ? bias : choice(ENCH_TYPES);
  g.pickups.push(new Pickup('e_' + type, e.x, e.cy - 8, rand(-0.6, 0.6), -3.4)); return true;
}

export function dropItem(g, kind, x, y) {
  if (!kind) return;
  if (kind === 'coin') { for (let i = 0; i < 2; i++) g.pickups.push(new Pickup('coin', x, y, rand(-1.4, 1.4), -rand(2, 3.4))); return; }
  g.pickups.push(new Pickup(kind, x, y));
}
export function randomDrop(g, x, y, bonus = 0) {
  const r = Math.random();
  // about three kills in ten leave something (it used to be six in ten), and a coin drop is two coins worth 15 each (it was three worth 10)
  if (r < 0.08 + bonus) dropItem(g, 'heart', x, y); else if (r < 0.14 + bonus) dropItem(g, 'mana', x, y); else if (r < 0.26 + bonus) dropItem(g, 'coin', x, y); else if (r < 0.275 + bonus) dropItem(g, 'gem', x, y);
  else if (r < 0.30 + bonus) dropItem(g, 'it_' + randomItemId(), x, y);      // now and then a thrown weapon / bandage
}

// ------------------------------------------------------------------------------------------------ statue (breakable: 2-3 hits, but pays out 2-3 times what a candle does - and turns up about 2.5x less often)
const STATUE_SC = 0.72;
// a statue's glow: its own silhouette filled with the glow colour (made once per colour), drawn a little larger behind it so it reads as a glowing rim
const HALO = {};
function haloOf(im, rgb) { const k = rgb.join(','); if (!HALO[k]) { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgb(' + k + ')'; g.fillRect(0, 0, c.width, c.height); HALO[k] = c; } return HALO[k]; }

export class Statue {
  constructor(x, y, o = {}) { this.x = x; this.y = y; this.drop = o.drop; this.id = o.id; this.dead = false; this.maxHp = this.hp = Math.random() < 0.5 ? 2 : 3; this.shake = 0; this.lastAtk = -1; this.t = 0; }
  get box() { const im = IMG.cemetery_statue, w = Math.round(im.width * STATUE_SC * 0.6), h = Math.round(im.height * STATUE_SC); return { x: this.x - w / 2, y: this.y - h, w, h }; }
  hit(g, dmg, from) {
    if (this.dead || this.lastAtk === g.player.atkId) return false; this.lastAtk = g.player.atkId;     // one chip per swing
    const b = this.box, cx = this.x, cy = b.y + b.h * 0.55, stone = [[0.78, 0.78, 0.86], [0.42, 0.42, 0.52]]; this.hp--; this.shake = 8;
    if (this.hp > 0) { A.sfx('block'); g.fx.sparks(cx, cy, 8, stone, 2.4, { gy: 0.15 }); g.fx.burst(cx, cy, 5, stone, { speed: 1.2, s0: 8 }); g.shake(1.5, 4); return true; }
    this.dead = true; A.sfx('break'); g.shake(3, 10); g.fx.burst(cx, cy, 16, stone, { speed: 2.2, s0: 14 }); g.fx.sparks(cx, cy, 14, stone, 3, { gy: 0.2 }); g.fx.souls(cx, cy, 4, COLORS.warm);
    dropItem(g, this.drop || 'coin', cx, cy);                                                           // the assigned treasure, then 1-2 more things from inside
    for (let i = 0, extra = this.maxHp === 3 ? 1 : (Math.random() < 0.4 ? 1 : 0); i < extra; i++) dropItem(g, Math.random() < 0.12 ? 'gem' : Math.random() < 0.3 ? 'it_' + randomItemId() : choice(['coin', 'coin', 'heart', 'mana', 'potion']), cx + rand(-9, 9), cy);
    return true;
  }
  // A statue has treasure inside, so it glows a little: a soft aura that slowly breathes (gold - or rose / blue when it holds a heart / mana), and now and then a twinkle drifts up off it.
  glowColor() { const d = this.drop || ''; return d === 'heart' ? [255, 130, 150] : d === 'mana' ? [130, 170, 255] : [255, 214, 120]; }
  update(g) {
    this.t++; if (this.shake > 0) this.shake--;
    if (g && this.t % 20 === 0 && Math.random() < 0.55 && this.x > g.camera.x - 30 && this.x < g.camera.x + 420) {
      const k = this.glowColor().map(v => v / 255), b = this.box;
      g.fx.emit({ x: this.x + rand(-b.w * 0.6, b.w * 0.6), y: b.y + rand(b.h * 0.15, b.h * 0.9), vx: rand(-0.05, 0.05), vy: -rand(0.12, 0.3), life: rand(50, 90), s0: rand(4, 6.5), s1: 1.5, c0: k, c1: [1, 1, 0.9], a0: 0.95, a1: 0, kind: 6 });
    }
  }
  draw(ctx, cx, cy) {
    const im = IMG.cemetery_statue, w = Math.round(im.width * STATUE_SC), h = Math.round(im.height * STATUE_SC), sx = this.shake ? Math.round(Math.sin(this.t * 2.4) * 1.5) : 0;
    { const gc = this.glowColor(), slow = 0.5 + 0.5 * Math.sin(this.t * 0.06 + this.x * 0.37), tw = Math.sin(this.t * 0.37 + this.x) * 0.5 + Math.sin(this.t * 0.91 + this.x * 2.3) * 0.3 + Math.sin(this.t * 1.7 + this.x * 0.7) * 0.2, pulse = Math.max(0, Math.min(1, slow + tw * 0.2)), R = h * (0.85 + 0.1 * pulse + 0.015 * tw), X = this.x - cx, Y = this.y - cy - h * 0.5, gr = ctx.createRadialGradient(X, Y, 2, X, Y, R);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; gr.addColorStop(0, 'rgba(' + gc + ',' + (0.32 + 0.1 * pulse).toFixed(3) + ')'); gr.addColorStop(0.55, 'rgba(' + gc + ',' + (0.12 + 0.04 * pulse).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + gc + ',0)');
      ctx.fillStyle = gr; ctx.fillRect(X - R, Y - R, R * 2, R * 2);
      const hw = Math.round(w * 1.2), hh = Math.round(h * 1.16); ctx.globalAlpha = 0.32 + 0.16 * pulse; ctx.drawImage(haloOf(im, gc), Math.round(X - hw / 2), Math.round(this.y - cy - hh + h * 0.04), hw, hh);          // the glowing rim
      ctx.restore(); }
    ctx.drawImage(im, Math.round(this.x - cx - w / 2 + sx), Math.round(this.y - cy - h), w, h);
    if (this.hp < this.maxHp) {       // cracks, one more per hit taken
      ctx.save(); ctx.strokeStyle = 'rgba(12,8,22,0.85)'; ctx.lineWidth = 1; const x0 = Math.round(this.x - cx + sx), y0 = Math.round(this.y - cy - h);
      const lines = [[[-4, 0.30], [-1, 0.38], [-5, 0.5], [-2, 0.6]], [[5, 0.25], [2, 0.36], [6, 0.47], [3, 0.58]]];
      for (let k = 0; k < this.maxHp - this.hp; k++) { ctx.beginPath(); lines[k % 2].forEach(([dx, fy], i) => { const X = x0 + dx, Y = y0 + h * fy; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke(); }
      ctx.restore();
    }
  }
}

// ------------------------------------------------------------------------------------------------ barrel / crate (Gothicvania Town art): one hit, one small treat
export class Barrel {
  constructor(x, y, o = {}) { this.x = x; this.y = y; this.drop = o.drop; this.dead = false; this.t = 0; this.crate = Math.abs(Math.floor(x / 16)) % 3 === 0; this.broken = 0; }
  get box() { return this.crate ? { x: this.x - 11, y: this.y - 20, w: 22, h: 20 } : { x: this.x - 9, y: this.y - 24, w: 18, h: 24 }; }
  hit(g) {
    if (this.dead || this.broken) return false; this.broken = 1; const wood = [[0.62, 0.42, 0.22], [0.3, 0.18, 0.08]]; A.sfx('break'); g.shake(1, 4);
    g.fx.burst(this.x, this.y - 11, 10, wood, { speed: 1.7, s0: 8 }); g.fx.sparks(this.x, this.y - 11, 9, wood, 2.6, { gy: 0.22 }); if (Math.random() < 0.7) dropItem(g, this.drop || choice(['coin', 'coin', 'heart', 'mana', 'coin']), this.x, this.y - 12); return true;       // (three in ten are empty)
  }
  update() { this.t++; if (this.broken && ++this.broken > 80) this.dead = true; }
  draw(ctx, cx, cy) {
    const im = IMG[this.crate ? 'town_crate' : 'town_barrel'], sc = this.crate ? 0.6 : 0.82, w = Math.round(im.width * sc), h = Math.round(im.height * sc), X = Math.round(this.x - cx - w / 2), Y = Math.round(this.y - cy - h);
    if (!this.broken) { ctx.drawImage(im, X, Y, w, h); return; }
    ctx.save(); ctx.globalAlpha = this.broken > 50 ? Math.max(0, 1 - (this.broken - 50) / 30) : 1;                   // what is left: the bottom third of it, splintered
    const keep = Math.round(im.height * 0.34), kh = Math.round(h * 0.34); ctx.drawImage(im, 0, im.height - keep, im.width, keep, X, Y + h - kh, w, kh); ctx.restore();
  }
}

// ------------------------------------------------------------------------------------------------ save altar
export class Altar {
  constructor(x, y) { this.x = x; this.y = y; this.t = 0; this.used = 0; this.dead = false; }
  get box() { return { x: this.x - 24, y: this.y - 40, w: 48, h: 40 }; }
  update(g) {
    this.t++;
    if (this.t === 1) this.circle = g.fx.quad({ kind: 'circle', x: this.x, y: this.y - 1, w: 88, h: 34, color: [0.7, 0.45, 1], life: 1, hold: true, spin: 0.01, p: [0, 12], a0: 0.55, a1: 0.55, pulse: 3, order: 1 });
    for (const [ox, oy, s] of [[-8.5, -23, 0.8], [8.5, -23, 0.8], [-0.5, -26, 1]]) g.fx.flame(this.x + ox, this.y + oy, { scale: s, seed: ox, color: 'purple', sparks: false });
    g.fx.light(this.x, this.y - 20, 80, 0.9);
    if (this.t % 6 === 0) g.fx.emit({ x: this.x + rand(-14, 14), y: this.y - 4, vx: 0, vy: -rand(0.3, 0.9), life: rand(50, 90), s0: 6, s1: 1, c0: [0.8, 0.6, 1], c1: [0.4, 0.3, 1], a0: 0.9, a1: 0, kind: 6 });
    if (this.used > 0) this.used--;
  }
  interact(g) {
    const p = g.player, S = g.save; S.hp = S.maxHp; S.mp = S.maxMp; this.used = 60; A.sfx('save');
    g.fx.ring(this.x, this.y - 20, 56, [0.8, 0.6, 1], 40, 0.14); g.fx.quad({ kind: 'beam', x: this.x, y: this.y - 80, w: 36, h: 190, color: [0.8, 0.6, 1], life: 50, a0: 1, a1: 0 });
    g.fx.souls(this.x, this.y - 10, 18, COLORS.purple); g.fx.flash([0.7, 0.5, 1], 0.2);
    S.room = g.room.id; S.spawnX = this.x; S.spawnY = this.y; g.saveGame(); g.banner('GAME SAVED', 'HEALTH AND MANA RESTORED'); return true;
  }
  draw(ctx, cx, cy) { drawSheet(ctx, 'altar', 0, this.x - cx, this.y - cy); }
}

// ------------------------------------------------------------------------------------------------ waystone (teleport)
// Every zone opens with a waystone chamber.  Walking up to the stone attunes it (once); pressing UP then opens the map, where any attuned waystone can be chosen.
export class Waystone {
  constructor(x, y, o = {}) { this.x = x; this.y = y; this.id = o.id; this.t = 0; this.dead = false; this.flare = 0; }
  get box() { return { x: this.x - 24, y: this.y - 48, w: 48, h: 48 }; }
  get lit() { return !!this.g.save.flags[this.id]; }
  attune(g) {
    g.save.flags[this.id] = true; this.flare = 90; A.sfx('ability'); g.fx.flash([0.45, 0.85, 1], 0.35); g.fx.ring(this.x, this.y - 24, 70, [0.45, 0.85, 1], 40, 0.12); g.fx.souls(this.x, this.y - 10, 16, COLORS.blue);
    g.fx.quad({ kind: 'beam', x: this.x, y: this.y - 90, w: 30, h: 200, color: [0.45, 0.85, 1], life: 60, a0: 1, a1: 0 }); g.banner('WAYSTONE ATTUNED', 'TRAVEL TO IT FROM ANY OTHER WAYSTONE', 230, { y: 60, color: '#9fe8ff' });
  }
  update(g) {
    this.g = g; this.t++; const p = g.player, lit = this.lit;
    if (this.t === 1) this.circle = g.fx.quad({ kind: 'circle', x: this.x, y: this.y - 1, w: 96, h: 36, color: [0.4, 0.85, 1], life: 1, hold: true, spin: 0.012, p: [0, 12], a0: 0.2, a1: 0.2, pulse: 3, order: 1 });
    if (this.circle) { const a = lit ? 0.6 + (this.flare > 0 ? 0.4 : 0) : 0.16; this.circle.a0 = this.circle.a1 = a; }
    if (this.flare > 0) this.flare--;
    if (lit) { g.fx.glow(this.x, this.y - 30, 34 + Math.sin(this.t * 0.07) * 4, [0.4, 0.85, 1], 0.4); g.fx.light(this.x, this.y - 30, 110, 0.9); if (this.t % 7 === 0) g.fx.emit({ x: this.x + rand(-12, 12), y: this.y - 4, vx: 0, vy: -rand(0.4, 1.0), life: rand(40, 80), s0: 5, s1: 1, c0: [0.5, 0.9, 1], c1: [0.2, 0.5, 1], a0: 0.9, a1: 0, kind: 6 }); }
    else if (this.t % 20 === 0) g.fx.emit({ x: this.x + rand(-6, 6), y: this.y - 34, vx: 0, vy: -rand(0.1, 0.3), life: 40, s0: 4, s1: 1, c0: [0.5, 0.7, 1], a0: 0.6, a1: 0, kind: 6 });
    if (!lit && !p.dead && Math.abs(p.x - this.x) < 44 && Math.abs(p.y - this.y) < 30) this.attune(g);
  }
  interact(g) { this.g = g; if (!this.lit) this.attune(g); g.openMap({ teleport: g.room.id }); return true; }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy), lit = this.g ? this.lit : false, pulse = 0.55 + 0.45 * Math.sin(this.t * 0.08);
    ctx.fillStyle = '#1c1828'; ctx.fillRect(x - 16, y - 4, 32, 4); ctx.fillStyle = '#2c2840'; ctx.fillRect(x - 12, y - 8, 24, 4); ctx.fillStyle = '#3a3552'; ctx.fillRect(x - 12, y - 8, 24, 1);
    ctx.fillStyle = '#3a3652'; ctx.beginPath(); ctx.moveTo(x - 8, y - 8); ctx.lineTo(x - 6, y - 40); ctx.lineTo(x, y - 48); ctx.lineTo(x + 6, y - 40); ctx.lineTo(x + 8, y - 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#26223a'; ctx.beginPath(); ctx.moveTo(x + 1, y - 8); ctx.lineTo(x + 1, y - 46); ctx.lineTo(x + 6, y - 40); ctx.lineTo(x + 8, y - 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4e4870'; ctx.fillRect(x - 6, y - 40, 1, 31);
    ctx.save(); ctx.globalAlpha = lit ? 0.55 + 0.45 * pulse : 0.28; ctx.fillStyle = lit ? '#8fe8ff' : '#4a6a8a';           // the rune: a diamond over a stem, glowing once attuned
    ctx.fillRect(x - 1, y - 34, 2, 16); ctx.fillRect(x - 3, y - 30, 6, 2); ctx.fillRect(x - 2, y - 38, 4, 2); ctx.fillRect(x - 1, y - 40, 2, 1); ctx.fillRect(x - 4, y - 20, 8, 1); ctx.restore();
  }
}

// ------------------------------------------------------------------------------------------------ lore tablet
export class Tablet {
  constructor(x, y, o) { this.x = x; this.y = y; this.text = o.text; this.id = o.id; this.t = 0; this.dead = false; }
  get box() { return { x: this.x - 12, y: this.y - 26, w: 24, h: 26 }; }
  update(g) { this.t++; if (this.t % 10 === 0 && !g.save.flags['read_' + this.id]) g.fx.emit({ x: this.x + rand(-5, 5), y: this.y - 18, vx: 0, vy: -rand(0.2, 0.5), life: 40, s0: 5, s1: 1, c0: [0.7, 0.85, 1], a0: 0.8, a1: 0, kind: 6 }); }
  interact(g) { g.save.flags['read_' + this.id] = true; g.showDialog(this.text); A.sfx('select'); return true; }
  draw(ctx, cx, cy) { drawSheet(ctx, 'tablet', 0, this.x - cx, this.y - cy); }
}

// ------------------------------------------------------------------------------------------------ chest
export class Chest {
  constructor(x, y, o) { this.x = x; this.y = y; this.contents = o.contents; this.id = o.id; this.open = false; this.t = 0; this.dead = false; }
  get box() { return { x: this.x - 11, y: this.y - 16, w: 22, h: 16 }; }
  update(g) { this.t++; if (!this.open && this.t % 14 === 0) g.fx.emit({ x: this.x + rand(-8, 8), y: this.y - 14, vx: 0, vy: -rand(0.2, 0.5), life: 36, s0: 5, s1: 1, c0: [1, 0.9, 0.5], a0: 0.9, a1: 0, kind: 6 }); }
  interact(g) {
    if (this.open) return false; this.open = true; g.save.flags[this.id] = true; A.sfx('door'); g.fx.burst(this.x, this.y - 12, 14, COLORS.gold, { speed: 2 }); g.fx.flash([1, 0.9, 0.5], 0.15);
    g.props.push(new Upgrade(this.x, this.y - 22, { kind: this.contents, id: this.id + '_u' })); return true;
  }
  draw(ctx, cx, cy) { drawSheet(ctx, 'chest', this.open ? 1 : 0, this.x - cx, this.y - cy); }
}

// ------------------------------------------------------------------------------------------------ permanent upgrade (floating item)
export class Upgrade {
  constructor(x, y, o) { this.x = x; this.y = y; this.kind = o.kind; this.id = o.id; this.t = 0; this.dead = false; this.U = UPGRADES[o.kind]; }
  get box() { return { x: this.x - 8, y: this.y - 16, w: 16, h: 16 }; }
  update(g) {
    this.t++; const bob = Math.sin(this.t * 0.07) * 2, p = g.player; this.by = bob;
    g.fx.glow(this.x, this.y - 8 + bob, 26, this.U.color, 0.5); g.fx.light(this.x, this.y - 8, 50, 0.7);
    if (this.t % 5 === 0) g.fx.emit({ x: this.x + rand(-9, 9), y: this.y - 8 + rand(-6, 6), vx: 0, vy: -rand(0.1, 0.5), life: 36, s0: 5, s1: 1, c0: this.U.color, a0: 0.9, a1: 0, kind: 6 });
    if (!p.dead && dist(p.x, p.y - 16, this.x, this.y - 8) < 14) this.collect(g);
  }
  collect(g) {
    this.dead = true; const S = g.save; g.save.flags[this.id] = true;
    if (this.kind === 'hpup') { S.maxHp += 20; S.hp = S.maxHp; } else if (this.kind === 'mpup') { S.maxMp += 10; S.mp = S.maxMp; } else if (this.kind === 'atkup') S.atk += 2;
    A.sfx('item'); A.sting('sting_item'); g.fx.ring(this.x, this.y - 8, 44, this.U.color, 30); g.fx.flash(this.U.color, 0.3); g.fx.sparks(this.x, this.y - 8, 18, [[1, 1, 0.8], this.U.color], 3);
    g.banner(this.U.name, this.U.desc);
  }
  draw(ctx, cx, cy) { drawSheet(ctx, 'icons', iconFrame(this.U.icon), this.x - cx, this.y - 8 - cy + (this.by || 0), { ay: 0.5, scale: 1.4 }); }
}

// ------------------------------------------------------------------------------------------------ ability relic dropped by bosses
export class Relic {
  constructor(x, y, kind) { this.x = x; this.y = y; this.kind = kind; this.A = ABILITIES[kind]; this.t = 0; this.dead = false; this.ray = null; }
  get box() { return { x: this.x - 8, y: this.y - 16, w: 16, h: 16 }; }
  update(g) {
    this.t++; const p = g.player, bob = Math.sin(this.t * 0.06) * 3; this.by = bob; const col = this.A.color;
    if (!this.ray) this.ray = g.fx.quad({ kind: 'rays', x: this.x, y: this.y - 14, w: 120, h: 120, color: col, life: 1, hold: true, spin: 0.01, p: [0, 8], a0: 0.5, a1: 0.5, order: 2 });
    this.ray.x = this.x; this.ray.y = this.y - 14 + bob; g.fx.glow(this.x, this.y - 14 + bob, 40, col, 0.6); g.fx.light(this.x, this.y - 14, 90, 1);
    if (this.t % 4 === 0) g.fx.emit({ x: this.x + rand(-12, 12), y: this.y - 14 + rand(-12, 12), vx: 0, vy: -rand(0.2, 0.7), life: 50, s0: 6, s1: 1, c0: col, a0: 1, a1: 0, kind: 6 });
    if (!p.dead && dist(p.x, p.y - 16, this.x, this.y - 14) < 16) { this.dead = true; if (this.ray) this.ray.kill = true; g.gainAbility(this.kind, this.x, this.y - 14); }
  }
  draw(ctx, cx, cy) { drawSheet(ctx, 'pedestal', 0, this.x - cx, this.y - cy); drawSheet(ctx, 'icons', iconFrame(this.A.icon), this.x - cx, this.y - 24 - cy + (this.by || 0), { ay: 0.5, scale: 1.8 }); }
}
