// Disposable items: thrown with the SPELL key (C / I) once selected on the hotbar (Q / V move the selection).  Counts are capped per item,
// saved with the game, and found as drops, in statues and lying around the castle.
//   dagger   - weak, fast, long flat throw                       axe      - slow heavy arc that cuts through everything in its path
//   torch    - slow arc; sets what it hits ablaze (damage over time), burns wooden barricades, leaves a short ground fire
//   marrow   - the magic arrow: a dagger that homes in on the nearest foe, trailing white sparks
//   holy     - a flask that shatters into a pool of holy light; the undead take much more      bandage - heals 35% of your max HP over ~1.5 s
import { Audio_ as A } from './audio.js';
import { COLORS } from './fx.js';
import { T, rand, clamp, choice } from './util.js';
import { TILE } from './world.js';

import { ITEMS, ITEM_ORDER, itemCount, addItem, randomItemId } from './itemdata.js';
export { ITEMS, ITEM_ORDER, itemCount, addItem, randomItemId };
const UNDEAD = new Set(['skeleton', 'zombie', 'ghost', 'wraith', 'ghoul', 'wyrm', 'frostwyrm', 'emberwyrm', 'fireskull']);

const hitId = () => -Math.floor(Math.random() * 1e9) - 1e6;

// ------------------------------------------------------------------------------------------------ thrown things
class Thrown {
  constructor(x, y, vx, vy, o = {}) {
    Object.assign(this, { x, y, vx, vy, owner: 'player', dead: false, t: 0, dmg: 4, w: 6, h: 6, grav: 0, life: 120, rot: 0, spin: 0, pierce: false, hits: new Set(), dir: vx >= 0 ? 1 : -1, kind: 'thrown' }, o);
  }
  get box() { return { x: -9999, y: -9999, w: 0, h: 0 }; }          // the game's generic projectile test must not touch these: they resolve their own hits
  hb() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  solidAt(g, x, y) { return g.room.solid(Math.floor(x / T), Math.floor(y / T)); }
  // enemies currently touched (that haven't been hit by this throw yet)
  touching(g) { const b = this.hb(), out = []; for (const e of g.enemies) if (!e.dead && !this.hits.has(e) && e.hitBy(b)) out.push(e); return out; }
  strike(g, e, dmg, color) { this.hits.add(e); return e.hurt(dmg, this.dir, { id: hitId(), color, kb: 1.1 }); }
  explode() { this.dead = true; }
  step(g) {                                                       // returns 'wall' | 'floor' | null after moving one step
    this.t++; this.vy += this.grav; this.rot += this.spin; const nx = this.x + this.vx, ny = this.y + this.vy;
    if (--this.life <= 0) { this.dead = true; return 'life'; }
    if (this.solidAt(g, nx, this.y)) { this.hitTile = [Math.floor(nx / T), Math.floor(this.y / T)]; return 'wall'; }
    if (this.vy > 0 && this.solidAt(g, this.x, ny + 2)) { this.hitTile = [Math.floor(this.x / T), Math.floor((ny + 2) / T)]; return 'floor'; }
    if (this.vy < 0 && this.solidAt(g, this.x, ny - 2)) { this.vy = 0.5; }
    this.x = nx; this.y = ny; return null;
  }
  tileAt() { return this.hitTile ? this.hitTile : null; }
}

class Dagger extends Thrown {
  constructor(g, x, y, dir, dmg) { super(x, y, dir * 5.4, 0, { dmg, w: 8, h: 4, grav: 0.015, life: 55 }); }
  update(g) {
    const r = this.step(g);
    if (r === 'wall' || r === 'floor') { g.fx.sparks(this.x + this.dir * 4, this.y, 4, [[1, 1, 1], [0.7, 0.75, 0.9]], 1.6); A.sfx('block'); this.dead = true; return; }
    for (const e of this.touching(g)) { if (this.strike(g, e, this.dmg, '#dfe6f5')) { g.fx.sparks(this.x, this.y, 4, [[1, 1, 1], [1, 0.9, 0.5]], 2); this.dead = true; return; } }
    for (const o of g.props) if (o.hit && !o.dead && o.box && this.x > o.box.x && this.x < o.box.x + o.box.w && this.y > o.box.y && this.y < o.box.y + o.box.h) { o.hit(g, this.dmg, this.dir); this.dead = true; return; }
  }
  draw(ctx, cx, cy) { const x = this.x - cx, y = this.y - cy, d = this.dir; ctx.fillStyle = '#dfe6f5'; ctx.fillRect(Math.round(x - 4 * d - (d < 0 ? 4 : 0)), Math.round(y - 1), 8, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x + (d > 0 ? 1 : -4)), Math.round(y - 1), 3, 1); ctx.fillStyle = '#8a5a2a'; ctx.fillRect(Math.round(x - (d > 0 ? 6 : -3)), Math.round(y - 1), 3, 2); }
}

// the magic arrow: it leaves the hand like a dagger, then bends toward the nearest foe it can see (turning at a limited rate, so it can still be dodged round a corner)
// and trails white sparks.  It breaks on walls and on the first thing it hits.
const seen = (g, x0, y0, x1, y1) => { for (let i = 1; i < 8; i++) { const k = i / 8; if (g.room.solid(Math.floor((x0 + (x1 - x0) * k) / T), Math.floor((y0 + (y1 - y0) * k) / T))) return false; } return true; };
class MagicArrow extends Thrown {
  constructor(g, x, y, dir, dmg) { super(x, y, dir * 4, -0.3, { dmg, w: 8, h: 6, life: 160 }); this.ang = dir > 0 ? -0.07 : Math.PI + 0.07; this.spd = 4; this.target = null; }
  pick(g) {
    let best = null, bs = 1e9; const ca = Math.cos(this.ang), sa = Math.sin(this.ang);
    for (const e of g.enemies) {
      if (e.dead || e.invuln || e.talk || (e.harmless && !e.isBoss)) continue; const dx = e.x - this.x, dy = e.cy - this.y, d = Math.hypot(dx, dy); if (d > 280) continue;
      const ahead = (dx * ca + dy * sa) / (d || 1); if (ahead < -0.3 || !seen(g, this.x, this.y, e.x, e.cy)) continue;                  // not behind it, and not through a wall
      const score = d * (1.5 - 0.5 * ahead); if (score < bs) { bs = score; best = e; }
    }
    return best;
  }
  update(g) {
    if (!this.target || this.target.dead || this.target.invuln || this.t % 12 === 0) this.target = this.pick(g) || (this.target && !this.target.dead && !this.target.invuln ? this.target : null);
    if (this.target) { const da = Math.atan2(this.target.cy - this.y, this.target.x - this.x) - this.ang; this.ang += clamp(Math.atan2(Math.sin(da), Math.cos(da)), -0.15, 0.15); }
    this.spd = Math.min(5.2, this.spd + 0.04); this.vx = Math.cos(this.ang) * this.spd; this.vy = Math.sin(this.ang) * this.spd; this.dir = this.vx >= 0 ? 1 : -1;
    const r = this.step(g), ca = Math.cos(this.ang), sa = Math.sin(this.ang);
    for (let i = 0; i < 2; i++) g.fx.emit({ x: this.x - ca * (3 + i * 4) + rand(-1, 1), y: this.y - sa * (3 + i * 4) + rand(-1, 1), vx: rand(-0.25, 0.25) - this.vx * 0.05, vy: rand(-0.25, 0.2), life: rand(18, 36), s0: i ? 3 : 6, s1: 0.5, c0: [1, 1, 1], c1: [0.72, 0.86, 1], a0: 1, a1: 0, kind: i ? 1 : 6, drag: 0.96 });      // white sparks behind it
    g.fx.glow(this.x, this.y, 8, [0.9, 0.95, 1], 0.5); g.fx.light(this.x, this.y, 30, 0.4, [0.85, 0.92, 1]);
    if (r === 'wall' || r === 'floor') { g.fx.sparks(this.x + ca * 4, this.y + sa * 4, 6, [[1, 1, 1], [0.7, 0.85, 1]], 2); A.sfx('block'); this.dead = true; return; }
    for (const q of g.projectiles) if (q.destructible && !q.dead && Math.abs(q.x - this.x) < 9 && Math.abs(q.y - this.y) < 9) { q.explode(g); g.fx.sparks(this.x, this.y, 8, [[1, 1, 1], [0.7, 0.85, 1]], 2.4); this.dead = true; return; }          // it shoots down a wisp
    for (const e of this.touching(g)) if (this.strike(g, e, this.dmg, '#e8f0ff')) { g.fx.sparks(this.x, this.y, 8, [[1, 1, 1], [0.7, 0.85, 1]], 2.6); g.fx.ring(this.x, this.y, 12, [0.9, 0.95, 1], 12, 0.25); this.dead = true; return; }
    for (const o of g.props) if (o.hit && !o.dead && o.box && this.x > o.box.x && this.x < o.box.x + o.box.w && this.y > o.box.y && this.y < o.box.y + o.box.h) { o.hit(g, this.dmg, this.dir); this.dead = true; return; }
  }
  draw(ctx, cx, cy) {
    ctx.save(); ctx.translate(Math.round(this.x - cx), Math.round(this.y - cy)); ctx.rotate(this.ang);
    ctx.fillStyle = '#9bb0ff'; ctx.fillRect(-8, -3, 3, 2); ctx.fillRect(-8, 1, 3, 2); ctx.fillStyle = '#d8e2ff'; ctx.fillRect(-6, -1, 2, 2);        // feathers
    ctx.fillStyle = '#e9efff'; ctx.fillRect(-6, -0.5, 10, 1);                                                                                         // shaft
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(3, -2.5); ctx.lineTo(8, 0); ctx.lineTo(3, 2.5); ctx.closePath(); ctx.fill();                  // head
    ctx.restore();
  }
}

class Axe extends Thrown {
  constructor(g, x, y, dir, dmg) { super(x, y, dir * 2.5, -3.4, { dmg, w: 12, h: 12, grav: 0.17, life: 110, spin: 0.28 * dir, pierce: true }); }
  update(g) {
    const r = this.step(g);
    if (r === 'wall' || r === 'floor') { g.fx.sparks(this.x, this.y, 6, [[1, 1, 1], [0.7, 0.75, 0.9]], 2.2); A.sfx('block'); this.dead = true; return; }
    for (const e of this.touching(g)) { if (this.strike(g, e, this.dmg, '#ffd8a0')) g.fx.sparks(e.x, e.cy, 5, [[1, 1, 1], [1, 0.8, 0.4]], 2.6); }
    for (const o of g.props) if (o.hit && !o.dead && !this.hits.has(o) && o.box && this.x > o.box.x - 4 && this.x < o.box.x + o.box.w + 4 && this.y > o.box.y && this.y < o.box.y + o.box.h) { this.hits.add(o); o.hit(g, this.dmg, this.dir); }
  }
  draw(ctx, cx, cy) { ctx.save(); ctx.translate(Math.round(this.x - cx), Math.round(this.y - cy)); ctx.rotate(this.rot); ctx.fillStyle = '#7a4a22'; ctx.fillRect(-1, -7, 2, 14); ctx.fillStyle = '#cfd6e6'; ctx.beginPath(); ctx.moveTo(1, -7); ctx.lineTo(7, -9); ctx.lineTo(7, -1); ctx.lineTo(1, -3); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.fillRect(6, -8, 1, 6); ctx.restore(); }
}

// ground fire left by a torch: ignites ground enemies that walk through it
class GroundFlame {
  constructor(x, y, dmg) { this.x = x; this.y = y; this.dmg = dmg; this.life = 170; this.owner = 'player'; this.dead = false; this.t = 0; this.w = 20; this.h = 12; this.vx = 0; this.vy = 0; }
  get box() { return { x: -9999, y: -9999, w: 0, h: 0 }; }
  explode() { this.dead = true; }
  update(g) {
    this.t++; if (--this.life <= 0) { this.dead = true; return; }
    g.fx.fire(this.x + rand(-4, 4), this.y, { scale: 0.55 + 0.35 * Math.min(1, this.life / 50), n: 1 }); g.fx.light(this.x, this.y - 6, 50, 0.7);
    if (this.t % 10 === 0) for (const e of g.enemies) if (!e.dead && !e.invuln && Math.abs(e.x - this.x) < this.w / 2 + e.w / 2 && e.y > this.y - 4 && e.y - e.h < this.y + 4 && (e.burnT || 0) < 80) e.ignite(150, this.dmg);
  }
  draw() {}
}

class ThrownTorch extends Thrown {
  constructor(g, x, y, dir, dmg, burn) { super(x, y, dir * 2.2, -2.3, { dmg, burn, w: 8, h: 8, grav: 0.14, life: 140, spin: 0.22 * dir }); }
  update(g) {
    const r = this.step(g);
    g.fx.fire(this.x, this.y, { scale: 0.5, n: 1 }); g.fx.light(this.x, this.y, 46, 0.7);
    if (r === 'wall' || r === 'floor') {
      const [tx, ty] = this.tileAt() || [0, 0]; if (g.room.get(tx, ty) === TILE.BARRICADE) { g.burnBarricade(tx, ty); this.dead = true; return; }      // wooden barricades go up in flames
      if (r === 'floor') g.addProjectile(new GroundFlame(this.x, Math.floor((this.y + 4) / T) * T, this.burn)); else g.fx.burst(this.x, this.y, 5, COLORS.fire, { speed: 1.2, s0: 8 });
      A.sfx('fire'); this.dead = true; return;
    }
    for (const e of this.touching(g)) {
      if (this.strike(g, e, this.dmg, '#ff9a40')) { e.ignite(200, this.burn); g.fx.burst(this.x, this.y, 8, COLORS.fire, { speed: 1.6, s0: 10 }); A.sfx('fire'); this.dead = true; return; }
    }
  }
  draw(ctx, cx, cy) { ctx.save(); ctx.translate(Math.round(this.x - cx), Math.round(this.y - cy)); ctx.rotate(this.rot); ctx.fillStyle = '#6a4220'; ctx.fillRect(-1, -2, 2, 8); ctx.fillStyle = '#2a1a0c'; ctx.fillRect(-2, -3, 4, 3); ctx.restore(); }
}

// holy water
class HolyPool {
  constructor(x, y, dmg) { this.x = x; this.y = y; this.dmg = dmg; this.life = 210; this.owner = 'player'; this.dead = false; this.t = 0; this.w = 44; this.h = 8; this.vx = 0; this.vy = 0; this.seen = new Map(); }
  get box() { return { x: -9999, y: -9999, w: 0, h: 0 }; }
  explode() { this.dead = true; }
  update(g) {
    this.t++; if (--this.life <= 0) { this.dead = true; return; }
    const k = Math.min(1, this.life / 40);
    if (this.t % 3 === 0) g.fx.emit({ x: this.x + rand(-this.w / 2, this.w / 2), y: this.y - 2, vx: rand(-0.1, 0.1), vy: -rand(0.5, 1.2), life: rand(24, 44), s0: 4, s1: 1, c0: [1, 0.97, 0.7], c1: [0.7, 0.9, 1], a0: k, a1: 0, kind: 6 });
    g.fx.glow(this.x, this.y - 4, 30, [0.8, 0.9, 1], 0.28 * k); g.fx.light(this.x, this.y - 6, 70, 0.8 * k);
    for (const e of g.enemies) {
      if (e.dead || e.invuln || Math.abs(e.x - this.x) > this.w / 2 + e.w / 2 || e.y < this.y - 6 || e.y - e.h > this.y + 4) continue;
      const last = this.seen.get(e) || -99; if (this.t - last < 24) continue; this.seen.set(e, this.t);
      e.hurt(Math.round(this.dmg * (UNDEAD.has(e.name) ? 1.8 : 1)), 0, { id: hitId(), color: '#fff6c8', noKb: true }); g.fx.sparks(e.x, e.cy, 4, [[1, 1, 0.8], [0.7, 0.9, 1]], 1.6, { gy: -0.03 });
    }
  }
  draw(ctx, cx, cy) { const k = Math.min(1, this.life / 40), x = Math.round(this.x - cx), y = Math.round(this.y - cy), w = this.w; ctx.fillStyle = `rgba(190,225,255,${0.45 * k})`; ctx.fillRect(x - w / 2, y - 2, w, 2); ctx.fillStyle = `rgba(255,250,210,${0.55 * k})`; ctx.fillRect(x - w / 2 + 3, y - 3, w - 6, 1); }
}
class HolyFlask extends Thrown {
  constructor(g, x, y, dir, dmg) { super(x, y, dir * 2.0, -2.5, { dmg, w: 8, h: 8, grav: 0.16, life: 120, spin: 0.2 * dir }); }
  shatter(g, y) { g.addProjectile(new HolyPool(this.x, y, this.dmg)); g.fx.burst(this.x, y - 3, 10, [[0.85, 0.93, 1], [1, 0.97, 0.7]], { speed: 1.8, s0: 8 }); g.fx.ring(this.x, y - 3, 22, [0.8, 0.9, 1], 16, 0.25); A.sfx('break'); this.dead = true; }
  update(g) {
    const r = this.step(g);
    if (r === 'floor') return this.shatter(g, Math.floor((this.y + 4) / T) * T);
    if (r === 'wall') return this.shatter(g, Math.floor(this.y / T + 1) * T);      // slides down the wall and breaks at its foot
    for (const e of this.touching(g)) { this.shatter(g, e.y); return; }
  }
  draw(ctx, cx, cy) { ctx.save(); ctx.translate(Math.round(this.x - cx), Math.round(this.y - cy)); ctx.rotate(this.rot); ctx.fillStyle = '#d8ecff'; ctx.fillRect(-3, -2, 6, 6); ctx.fillStyle = '#9ccaf0'; ctx.fillRect(-2, 0, 4, 3); ctx.fillStyle = '#c9a14a'; ctx.fillRect(-1, -4, 2, 2); ctx.restore(); }
}

// ------------------------------------------------------------------------------------------------ using an item
// Returns false (and tells the player why) when the item can't be used right now; the count is taken when it actually leaves your hand.
export function canUseItem(g, p, id) {
  if (itemCount(g.save, id) <= 0) return false;
  if (id === 'bandage' && g.save.hp >= g.save.maxHp - 0.5) { g.popup(p.x, p.y - 42, 'HP FULL', '#9fe8a8'); A.sfx('back'); return false; }
  return true;
}
export function releaseItem(g, p, id) {            // called mid-animation
  const S = g.save; if (itemCount(S, id) <= 0) return; S.items[id]--;
  const atk = p.atkPower, d = p.dir, x = p.x + d * 12, y = p.y - (p.crouch ? 13 : 24);
  switch (id) {
    case 'dagger': g.addProjectile(new Dagger(g, x, y, d, Math.max(2, Math.round(2 + atk * 0.45)))); A.sfx('slash'); break;
    case 'axe': g.addProjectile(new Axe(g, x, y - 2, d, Math.round(4 + atk * 0.95))); A.sfx('slash'); break;
    case 'torch': g.addProjectile(new ThrownTorch(g, x, y - 2, d, Math.max(1, Math.round(1 + atk * 0.2)), Math.max(1, Math.round(atk * 0.22)))); A.sfx('cast'); break;
    case 'marrow': g.addProjectile(new MagicArrow(g, x, y, d, Math.max(2, Math.round(2 + atk * 0.42)))); A.sfx('cast'); break;
    case 'holy': g.addProjectile(new HolyFlask(g, x, y - 2, d, Math.max(1, Math.round(1 + atk * 0.12)))); A.sfx('cast'); break;
    case 'bandage': p.healT = 100; p.healPer = S.maxHp * 0.35 / 100; A.sfx('heal'); g.fx.ring(p.x, p.y - 18, 20, [0.95, 0.95, 0.9], 18, 0.2); g.popup(p.x, p.y - 42, 'PANACEA', '#f2efe6'); break;
  }
  if (S.items[id] <= 0) delete S.items[id];
}
