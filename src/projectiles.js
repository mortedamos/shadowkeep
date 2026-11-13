// Projectiles & ground hazards.
import { drawSheet } from './assets.js';
import { Audio_ as A } from './audio.js';
import { COLORS } from './fx.js';
import { T, rand, TAU, clamp } from './util.js';
import { TILE } from './world.js';
import { TUNE } from './enchant.js';

const KINDS = {
  bone: { sheet: 'bone', n: 4, w: 8, h: 8, grav: 0.12, spin: 0.3, glow: null, hitFx: COLORS.white, dmg: 7 },
  orb: { sheet: 'orb_dark', n: 2, w: 9, h: 9, grav: 0, glow: [0.7, 0.3, 1], hitFx: COLORS.purple, dmg: 8, fxTrail: COLORS.purple },
  feather: { sheet: 'feather_p', n: 1, w: 12, h: 6, grav: 0, aim: true, glow: [0.7, 0.85, 1], hitFx: COLORS.white, dmg: 10, fxTrail: COLORS.white },
  gear: { sheet: 'gear', n: 4, w: 10, h: 10, grav: 0.16, bounce: 0.75, spin: 0.25, glow: [1, 0.75, 0.3], hitFx: COLORS.gold, dmg: 12, bounces: 4 },
  fire: { sheet: 'fireball', n: 3, w: 12, h: 12, grav: 0, glow: [1, 0.5, 0.15], hitFx: COLORS.fire, dmg: 10, flipDir: true, orb: true },
  skull: { sheet: 'fireskull', n: 8, w: 14, h: 14, grav: 0, glow: [0.4, 0.9, 1], hitFx: COLORS.blue, dmg: 12, scale: 0.38, fxTrail: COLORS.blue, spinFrames: true },
  spore: { sheet: 'orb_dark', n: 2, w: 10, h: 10, grav: 0, glow: [0.4, 1, 0.4], hitFx: COLORS.green, dmg: 9, scale: 1.5, fxTrail: COLORS.green },
  tide: { sheet: 'orb_dark', n: 2, w: 10, h: 10, grav: 0, glow: [0.4, 0.8, 1], hitFx: COLORS.blue, dmg: 9, scale: 1.5, fxTrail: COLORS.blue },
  blood: { sheet: 'orb_dark', n: 2, w: 9, h: 9, grav: 0, glow: [1, 0.1, 0.2], hitFx: COLORS.red, dmg: 9, scale: 1.3, fxTrail: COLORS.red },
  wisp: { sheet: 'orb_dark', n: 1, w: 12, h: 12, grav: 0, glow: [0.4, 0.7, 1], hitFx: COLORS.blue, dmg: 8, orb: true },                                  // (a haunted portrait's blue fire - see HomingWisp)
  ember: { sheet: 'fireball', n: 3, w: 8, h: 8, grav: 0.04, glow: [1, 0.4, 0.1], hitFx: COLORS.fire, dmg: 7, scale: 0.6, orb: true },          // (orb: burning light + flame particles in the effects layer, not the fireball sprite)
};

export class Projectile {
  constructor(x, y, vx, vy, kind, o = {}) {
    const K = KINDS[kind]; this.k = K; this.kind = kind; this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.owner = 'enemy'; this.dmg = o.dmg || K.dmg; this.w = K.w; this.h = K.h;
    this.life = o.life || 300; this.t = 0; this.dead = false; this.bounces = K.bounces || 0; this.rot = 0; this.pierce = !!o.pierce; this.hitSet = new Set(); this.fireTiles = false;
    this.grav = o.grav !== undefined ? o.grav : K.grav; this.scale = o.scale || K.scale || 1; this.dir = vx >= 0 ? 1 : -1; Object.assign(this, o.extra || {});
  }
  get box() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  update(g) {
    this.t++; this.vy += this.grav; this.x += this.vx; this.y += this.vy; if (this.k.aim) this.rot = Math.atan2(this.vy, this.vx); else if (this.k.spin) this.rot += this.k.spin * Math.sign(this.vx || 1);
    this.dir = this.vx >= 0 ? 1 : -1;
    if (--this.life <= 0) this.dead = true;
    const tx = Math.floor(this.x / T), ty = Math.floor(this.y / T), v = g.room.get(tx, ty);
    if (g.room.solid(tx, ty)) {
      if (this.fireTiles && v === TILE.BARRICADE) g.burnBarricade(tx, ty);
      if (this.bounces > 0 && this.k.bounce) { this.bounces--; this.y -= this.vy; this.vy = -Math.abs(this.vy) * this.k.bounce; this.x -= this.vx; A.sfx('gear'); if (this.bounces === 0) this.dead = true; }
      else { this.explode(g); return; }
    }
    if (this.k.orb) g.fx.fireOrb(this.x, this.y, this.vx, this.vy, this.scale * (this.k.scale ? 1.4 : 1));
    else if (this.k.glow) g.fx.glow(this.x, this.y, 16 * this.scale + 6, this.k.glow, 0.35);
    if (this.k.fxTrail && this.t % 2 === 0) g.fx.emit({ x: this.x + rand(-2, 2), y: this.y + rand(-2, 2), vx: -this.vx * 0.1, vy: rand(-0.2, 0.2), life: rand(10, 20), s0: 8 * this.scale + 4, s1: 1, c0: this.k.fxTrail[0], c1: this.k.fxTrail[1], a0: 0.8, a1: 0, kind: 2 });
  }
  explode(g) { this.dead = true; g.fx.burst(this.x, this.y, 8, this.k.hitFx, { speed: 1.8, s0: 12, s1: 2 }); g.fx.sparks(this.x, this.y, 5, this.k.hitFx, 2); if (this.k.glow) g.fx.glow(this.x, this.y, 30, this.k.glow, 0.6, 6); }
  draw(ctx, cx, cy) {
    if (this.k.orb) return;                                                  // a burning ball is drawn by the effects layer (fx.fireOrb)
    const f = this.k.spinFrames ? Math.floor(this.t / 4) : this.k.n > 1 ? Math.floor(this.t / 4) : 0;
    drawSheet(ctx, this.k.sheet, f, this.x - cx, this.y - cy, { dir: this.k.flipDir ? this.dir : 1, scale: this.scale, rot: this.k.aim || this.k.spin ? this.rot : 0, ay: 0.5 });
  }
}

// a wisp of blue fire that follows the hero for a while (a haunted portrait lets them go).  It turns at a limited rate, so it can be dodged; the sword can cut it down.
export class HomingWisp extends Projectile {
  constructor(x, y, vx, vy, dmg = 8) { super(x, y, vx, vy, 'wisp', { dmg, life: 330 }); this.destructible = true; this.w = 12; this.h = 12; this.spd = Math.hypot(vx, vy) || 1; this.ph = rand(TAU); }
  update(g) {
    this.t++; if (--this.life <= 0) { this.explode(g); return; }
    const p = g.player, want = Math.atan2(p.y - 20 - this.y, p.x - this.x), cur = Math.atan2(this.vy, this.vx);
    let da = want - cur; da = Math.atan2(Math.sin(da), Math.cos(da)); const a = cur + clamp(da, -0.06, 0.06) + Math.sin(this.t * 0.12 + this.ph) * 0.035;       // a little waver, like a flame
    this.spd = Math.min(1.5, this.spd + 0.012); this.vx = Math.cos(a) * this.spd; this.vy = Math.sin(a) * this.spd; this.x += this.vx; this.y += this.vy; this.dir = this.vx >= 0 ? 1 : -1;
    if (g.room.solid(Math.floor(this.x / T), Math.floor(this.y / T))) { this.explode(g); return; }
    g.fx.fire(this.x, this.y + 4, { scale: 0.5, color: 'blue', n: 1 }); g.fx.glow(this.x, this.y, 10, [0.4, 0.7, 1], 0.5); g.fx.light(this.x, this.y, 40, 0.55, [0.4, 0.7, 1]);
    if (this.t % 3 === 0) g.fx.emit({ x: this.x - this.vx * 2 + rand(-2, 2), y: this.y + rand(-2, 2), vx: rand(-0.1, 0.1), vy: -rand(0.1, 0.4), life: rand(16, 28), s0: 6, s1: 1, c0: [0.5, 0.8, 1], c1: [0.2, 0.4, 1], a0: 0.8, a1: 0, kind: 6 });
  }
  explode(g) { this.dead = true; g.fx.burst(this.x, this.y, 8, COLORS.blue, { speed: 1.6, s0: 9, s1: 2 }); g.fx.sparks(this.x, this.y, 6, [[1, 1, 1], [0.5, 0.8, 1]], 2.2); g.fx.ring(this.x, this.y, 12, [0.5, 0.8, 1], 12, 0.25); A.sfx('hit'); }
  draw() {}                                                                                                                                       // (all of it is in the effects layer)
}

export class Fireball extends Projectile {
  constructor(x, y, dir, dmg, owner = 'player') {
    super(x, y, dir * 3.3, 0, 'fire', { dmg, life: 120, extra: { owner } }); this.fireTiles = true; this.w = 14; this.h = 12; this.scale = 1;
  }
  explode(g) { super.explode(g); A.sfx('hit'); g.fx.ring(this.x, this.y, 16, [1, 0.6, 0.2], 14, 0.3); }
}

// the small fireball a Flame-enchanted sword flings with every slash: weak and short-ranged (does NOT burn barricades)
export class SwordFire extends Fireball {
  constructor(x, y, dir, dmg) { super(x, y, dir, dmg, 'player'); this.life = TUNE.fireballLife; this.fireTiles = false; this.scale = 0.75; this.w = 12; this.h = 10; }
}

// moving ground wave (boss stomps)
export class Shockwave {
  constructor(x, y, dir, o = {}) { this.x = x; this.y = y; this.dir = dir; this.speed = o.speed || 2.2; this.dmg = o.dmg || 12; this.w = 16; this.h = o.h || 16; this.life = o.life || 60; this.owner = 'enemy'; this.t = 0; this.dead = false; this.color = o.color || COLORS.warm; this.k = { glow: null }; this.vx = dir; this.vy = 0; this.big = o.big || false; this.flame = o.fire || (o.big ? 'fire' : 'warm'); }
  get box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  update(g) {
    this.t++; this.x += this.dir * this.speed; if (--this.life <= 0) this.dead = true;
    const tx = Math.floor((this.x + this.dir * 8) / T), ty = Math.floor((this.y - 4) / T); if (g.room.solid(tx, ty)) this.dead = true;
    if (!g.room.solid(Math.floor(this.x / T), Math.floor((this.y + 4) / T))) this.dead = true;
    g.fx.fire(this.x, this.y, { scale: 0.9, color: this.flame, n: 2 }); if (this.t % 3 === 0) g.fx.burst(this.x, this.y - 2, 2, [[0.6, 0.55, 0.5], [0.2, 0.2, 0.25]], { speed: 0.8, s0: 8, s1: 2, up: 0.6, l0: 10, l1: 22 });
  }
  draw() {}
}

// stationary flames on the floor (from burning ghouls, boss attacks)
export class FirePatch {
  constructor(x, y, life = 200, o = {}) { this.x = x; this.y = y; this.life = life; this.max = life; this.w = o.w || 18; this.h = 12; this.dmg = o.dmg || 6; this.owner = 'enemy'; this.dead = false; this.t = 0; this.hazard = true; this.color = o.color || 'fire'; this.vx = 0; this.vy = 0; }
  get box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  update(g) { this.t++; if (--this.life <= 0) this.dead = true; const k = Math.min(1, this.life / 40); g.fx.fire(this.x + (this.w > 20 ? (Math.random() - 0.5) * (this.w - 14) : 0), this.y, { scale: (0.6 + 0.4 * k) * (this.w / 18), color: this.color, n: 1 }); }
  draw() {}
}
