// The Mirror Room.  A great gilt mirror is set into the end wall; the glass shows the stranger, mirrored, doing whatever he does.  Walk up to it and it cracks - and the reflection
// steps out as THE REFLECTION (BossMirror in bosses.js), his own sheets recoloured silver and violet (assets.js buildEvil), with his sword and the same items he carries.
//   MirrorView   - the frame, the glass (whole / cracking / shattered) and the cracks; the reflection itself is drawn by the boss, clipped to the glass
//   Twin*        - the items the twin throws (they hurt YOU; the sword can cut daggers and arrows out of the air)
// def.mirror (from levelgen genArena): { fx, fy, fw, fh, band (the frame), plane (the glass's left edge: the mirror's plane), x1, y0, y1 (the glass), wall }
import { drawSheet } from './assets.js';
import { drawFrameRect } from './portraitart.js';
import { Audio_ as A } from './audio.js';
import { T, rand, clamp } from './util.js';
import { FirePatch } from './projectiles.js';

export const JUMP_CY = [56, 46, 31, 24.5, 31.5], JATK_CY = [59, 49, 34, 27.5, 22.5, 29.5];      // the heights of the centres of the hero's jump / air-swing frames (see player.js)

// one frame of a hero sheet (or of its recoloured twin: id 'hero_idle_evil') at feet (x, y) - the jump frames' art bakes the arc into the cell, as the player's own drawing does
export function heroFrame(ctx, id, fi, x, y, dir, h, o = {}) {
  const jump = fi.cy !== undefined, yy = jump ? y - h / 2 + 1 : y, extra = jump ? { ay: fi.cy / fi.ch } : {};
  drawSheet(ctx, id, fi.f, x, yy, { dir, ...extra, ...o });
}

// ------------------------------------------------------------------------------------------------ the mirror
export class MirrorView {
  constructor(m, broken) {
    this.m = m; this.broken = !!broken; this.cr = 0; this.lines = []; this.t = 0;
    let s = (m.fx * 31 + m.fy * 7) >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const W = m.x1 - m.plane, H = m.y1 - m.y0, teeth = []; this.teeth = teeth;                       // the jagged teeth of glass left in the frame once it is shattered
    for (let i = 0; i < 9; i++) { const x = m.plane + (i + rnd() * 0.5) * W / 9; teeth.push([[x, m.y0], [x + 10 + rnd() * 20, m.y0], [x + rnd() * 12, m.y0 + 8 + rnd() * 26]]); }
    for (let i = 0; i < 5; i++) { const y = m.y0 + (i + rnd() * 0.5) * H / 5; teeth.push([[m.plane, y], [m.plane, y + 10 + rnd() * 18], [m.plane + 6 + rnd() * 16, y + rnd() * 12]]); teeth.push([[m.x1, y + 6], [m.x1, y + 16 + rnd() * 16], [m.x1 - 6 - rnd() * 16, y + 8 + rnd() * 10]]); }
    for (let i = 0; i < 6; i++) { const x = m.plane + (i + rnd() * 0.6) * W / 6; teeth.push([[x, m.y1], [x + 12 + rnd() * 18, m.y1], [x + 4 + rnd() * 10, m.y1 - 6 - rnd() * 18]]); }
  }
  get mid() { const m = this.m; return [(m.plane + m.x1) / 2, (m.y0 + m.y1) / 2]; }
  clip(ctx, cx, cy) { const m = this.m; ctx.save(); ctx.beginPath(); ctx.rect(Math.round(m.plane - cx), Math.round(m.y0 - cy), m.x1 - m.plane, m.y1 - m.y0); ctx.clip(); }       // (the caller restores)
  update(g) {
    this.t++; const m = this.m, [mx, my] = this.mid, cam = g.camera; if (m.x1 < cam.x - 120 || m.plane > cam.x + 384 + 120) return;
    if (this.broken) { g.fx.light(mx, my, 110, 0.38, [0.6, 0.3, 1]); if (this.t % 12 === 0) g.fx.emit({ x: rand(m.plane, m.x1), y: rand(m.y0 + 20, m.y1), vx: rand(-0.1, 0.1), vy: -rand(0.1, 0.4), life: rand(40, 80), s0: 7, s1: 1, c0: [0.7, 0.4, 1], c1: [0.3, 0.1, 0.6], a0: 0.7, a1: 0, kind: 6 }); }
    else g.fx.light(mx, my, 130, 0.5 + 0.1 * this.cr, [0.5, 0.62, 1]);
  }
  // cracks spread from where the reflection's hand would meet yours: a fan of jagged lines (each branch waits for the line it grows from)
  startCrack(oy) {
    const m = this.m, ox = m.plane + 1; let s = (Math.round(oy) * 977 + 13) >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    this.lines = []; this.cr = 0;
    const grow = (x, y, a, len, start, depth) => {
      const pts = [[x, y]]; let L = 0; const me = { pts, len: 1, start }; this.lines.push(me);
      while (L < len) {
        const seg = 8 + rnd() * 13; a += (rnd() - 0.5) * 0.75; x += Math.cos(a) * seg; y += Math.sin(a) * seg; pts.push([x, y]); L += seg;
        if (depth < 2 && rnd() < 0.24) grow(x, y, a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6), len * 0.38, start + (1 - start) * (L / len) * 0.9, depth + 1);
        if (x > m.x1 + 2 || y < m.y0 - 2 || y > m.y1 + 2) break;
      }
      me.len = L;
    };
    for (let i = 0; i < 11; i++) grow(ox, oy, -1.35 + i * 0.27 + (rnd() - 0.5) * 0.25, 70 + rnd() * 150, 0, 0);
  }
  // the glass bursts: a spray of shards at the hero, a flash, and what is left is a dark window with teeth of glass in the frame
  shatter(g) {
    const m = this.m, fx = g.fx; this.broken = true; this.cr = 1;
    for (let i = 0; i < 16; i++) fx.sparks(rand(m.plane + 6, m.x1 - 6), rand(m.y0 + 8, m.y1 - 8), 7, [[1, 1, 1], [0.7, 0.85, 1]], rand(2.4, 4.6), { dir: Math.PI, spread: 1.5, gy: 0.2 });
    fx.flash([0.75, 0.8, 1], 0.7); fx.ring(m.plane, (m.y0 + m.y1) / 2, 90, [0.7, 0.8, 1], 28, 0.14); A.sfx('break'); A.sfx('boom'); g.shake(5, 22);
  }
  draw(ctx, cx, cy) {
    const m = this.m; if (m.fx + m.fw < cx - 4 || m.fx > cx + 392) return;
    drawFrameRect(ctx, Math.round(m.fx - cx), Math.round(m.fy - cy), m.fw, m.fh, 0, m.band);
    const gx = Math.round(m.plane - cx), gy = Math.round(m.y0 - cy), gw = m.x1 - m.plane, gh = m.y1 - m.y0;
    const gr = ctx.createLinearGradient(0, gy, 0, gy + gh);
    if (!this.broken) { gr.addColorStop(0, '#3a4c78'); gr.addColorStop(0.55, '#212c4e'); gr.addColorStop(1, '#101734'); } else { gr.addColorStop(0, '#0a0514'); gr.addColorStop(0.6, '#180a2c'); gr.addColorStop(1, '#2a1048'); }
    ctx.fillStyle = gr; ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(gx, gy, gw, 1); ctx.fillRect(gx, gy, 1, gh);              // the glass sits a little way back in its frame
    if (this.broken) {
      ctx.fillStyle = '#9db4e8'; ctx.strokeStyle = 'rgba(235,242,255,0.7)'; ctx.lineWidth = 1;
      for (const tr of this.teeth) { ctx.beginPath(); tr.forEach(([x, y], i) => (i ? ctx.lineTo(Math.round(x - cx) + 0.5, Math.round(y - cy) + 0.5) : ctx.moveTo(Math.round(x - cx) + 0.5, Math.round(y - cy) + 0.5))); ctx.closePath(); ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); }
    }
  }
  // drawn over the reflection: the slow sheen of the glass, and the cracks
  over(ctx, cx, cy) {
    if (this.broken) return; const m = this.m, t = this.t, gx = m.plane - cx, gy = m.y0 - cy, gw = m.x1 - m.plane, gh = m.y1 - m.y0;
    this.clip(ctx, cx, cy);
    const sl = gh * 0.55; ctx.fillStyle = 'rgba(210,225,255,0.07)';
    for (const [off, w] of [[0, 22], [58, 8]]) { const x = ((t * 0.22 + off) % (gw + 120)) - 60; ctx.beginPath(); ctx.moveTo(gx + x, gy + gh); ctx.lineTo(gx + x + w, gy + gh); ctx.lineTo(gx + x + w + sl, gy); ctx.lineTo(gx + x + sl, gy); ctx.closePath(); ctx.fill(); }
    if (this.cr > 0) for (const L of this.lines) {
      const k = clamp((this.cr - L.start) / (1 - L.start || 1), 0, 1); if (k <= 0) continue; let left = L.len * k;
      ctx.beginPath(); ctx.moveTo(L.pts[0][0] - cx, L.pts[0][1] - cy);
      for (let i = 1; i < L.pts.length && left > 0; i++) { const [x0, y0] = L.pts[i - 1], [x1, y1] = L.pts[i], d = Math.hypot(x1 - x0, y1 - y0), f = Math.min(1, left / d); ctx.lineTo(Math.round(x0 + (x1 - x0) * f - cx) + 0.5, Math.round(y0 + (y1 - y0) * f - cy) + 0.5); left -= d; }
      ctx.strokeStyle = 'rgba(8,10,24,0.65)'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = 'rgba(236,242,255,0.95)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------------------------------------ what the twin throws (the same five things the stranger can carry)
class Throw {
  constructor(x, y, vx, vy, o = {}) {
    Object.assign(this, { x, y, vx, vy, owner: 'enemy', dead: false, t: 0, dmg: 6, w: 8, h: 6, grav: 0, life: 120, rot: 0, spin: 0, pierce: false, destructible: false, kind: 'twin', k: { glow: null, hitFx: [[1, 1, 1], [0.7, 0.8, 1]] } }, o);
    this.dir = vx >= 0 ? 1 : -1;
  }
  get box() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  solidAt(g, x, y) { return g.room.solid(Math.floor(x / T), Math.floor(y / T)); }
  step(g) {                                                       // 'wall' | 'floor' | 'life' | null after one step
    this.t++; this.vy += this.grav; this.rot += this.spin; const nx = this.x + this.vx, ny = this.y + this.vy;
    if (--this.life <= 0) { this.dead = true; return 'life'; }
    if (this.solidAt(g, nx, this.y)) return 'wall';
    if (this.vy > 0 && this.solidAt(g, this.x, ny + 2)) return 'floor';
    if (this.vy < 0 && this.solidAt(g, this.x, ny - 2)) this.vy = 0.5;
    this.x = nx; this.y = ny; return null;
  }
  explode(g) { this.dead = true; g.fx.sparks(this.x, this.y, 5, [[1, 1, 1], [0.7, 0.75, 1]], 1.8); A.sfx('block'); }
}

export class TwinDagger extends Throw {
  constructor(x, y, dir, vy = 0, dmg = 7) { super(x, y, dir * 4.3, vy, { dmg, w: 8, h: 4, grav: 0.012, life: 80, destructible: true }); }
  update(g) { const r = this.step(g); if (r === 'wall' || r === 'floor') this.explode(g); }
  draw(ctx, cx, cy) { const x = this.x - cx, y = this.y - cy, d = this.dir; ctx.fillStyle = '#c9c4ee'; ctx.fillRect(Math.round(x - 4 * d - (d < 0 ? 4 : 0)), Math.round(y - 1), 8, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x + (d > 0 ? 1 : -4)), Math.round(y - 1), 3, 1); ctx.fillStyle = '#4a2a78'; ctx.fillRect(Math.round(x - (d > 0 ? 6 : -3)), Math.round(y - 1), 3, 2); }
}

export class TwinAxe extends Throw {
  constructor(x, y, vx, dmg = 13) { super(x, y, vx, -3.4, { dmg, w: 12, h: 12, grav: 0.17, life: 130, spin: 0.28 * (vx >= 0 ? 1 : -1) }); }
  update(g) { const r = this.step(g); if (r === 'wall' || r === 'floor') { this.explode(g); g.fx.sparks(this.x, this.y, 6, [[1, 1, 1], [0.7, 0.6, 1]], 2.2); } }
  draw(ctx, cx, cy) { ctx.save(); ctx.translate(Math.round(this.x - cx), Math.round(this.y - cy)); ctx.rotate(this.rot); ctx.fillStyle = '#3a2a58'; ctx.fillRect(-1, -7, 2, 14); ctx.fillStyle = '#cfcdf0'; ctx.beginPath(); ctx.moveTo(1, -7); ctx.lineTo(7, -9); ctx.lineTo(7, -1); ctx.lineTo(1, -3); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.fillRect(6, -8, 1, 6); ctx.restore(); }
}

export class TwinTorch extends Throw {
  constructor(x, y, vx, dmg = 6) { super(x, y, vx, -2.3, { dmg, w: 8, h: 8, grav: 0.14, life: 140, spin: 0.22 * (vx >= 0 ? 1 : -1) }); }
  landFire(g) { const gy = g.groundBelow(this.x, this.y); g.addProjectile(new FirePatch(this.x, gy, 150, { w: 22, dmg: 5 })); }
  update(g) {
    const r = this.step(g); g.fx.fire(this.x, this.y, { scale: 0.5, n: 1 }); g.fx.light(this.x, this.y, 46, 0.7);
    if (r === 'wall' || r === 'floor') { if (r === 'floor') this.landFire(g); else g.fx.burst(this.x, this.y, 5, [[1, 0.6, 0.2], [0.8, 0.15, 0.05]], { speed: 1.2, s0: 8 }); A.sfx('fire'); this.dead = true; }
  }
  explode(g) { this.dead = true; g.fx.burst(this.x, this.y, 8, [[1, 0.6, 0.2], [0.8, 0.15, 0.05]], { speed: 1.6, s0: 10 }); A.sfx('fire'); this.landFire(g); }
  draw(ctx, cx, cy) { ctx.save(); ctx.translate(Math.round(this.x - cx), Math.round(this.y - cy)); ctx.rotate(this.rot); ctx.fillStyle = '#6a4220'; ctx.fillRect(-1, -2, 2, 8); ctx.fillStyle = '#2a1a0c'; ctx.fillRect(-2, -3, 4, 3); ctx.restore(); }
}

// a pool of holy water on the floor: it burns the one who made the mistake of standing in it (pierce: it stays when it hurts)
class TwinPool {
  constructor(x, y, dmg = 5) { this.x = x; this.y = y; this.dmg = dmg; this.life = 190; this.owner = 'enemy'; this.dead = false; this.t = 0; this.w = 44; this.h = 8; this.vx = 0; this.vy = 0; this.pierce = true; this.hazard = true; }
  get box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  explode() { this.dead = true; }
  update(g) {
    this.t++; if (--this.life <= 0) { this.dead = true; return; } const k = Math.min(1, this.life / 40);
    if (this.t % 3 === 0) g.fx.emit({ x: this.x + rand(-this.w / 2, this.w / 2), y: this.y - 2, vx: rand(-0.1, 0.1), vy: -rand(0.5, 1.2), life: rand(24, 44), s0: 4, s1: 1, c0: [1, 0.97, 0.7], c1: [0.7, 0.9, 1], a0: k, a1: 0, kind: 6 });
    g.fx.glow(this.x, this.y - 4, 30, [0.8, 0.9, 1], 0.28 * k); g.fx.light(this.x, this.y - 6, 70, 0.8 * k);
  }
  draw(ctx, cx, cy) { const k = Math.min(1, this.life / 40), x = Math.round(this.x - cx), y = Math.round(this.y - cy), w = this.w; ctx.fillStyle = `rgba(190,225,255,${0.45 * k})`; ctx.fillRect(x - w / 2, y - 2, w, 2); ctx.fillStyle = `rgba(255,250,210,${0.55 * k})`; ctx.fillRect(x - w / 2 + 3, y - 3, w - 6, 1); }
}
export class TwinFlask extends Throw {
  constructor(x, y, vx, dmg = 4) { super(x, y, vx, -2.5, { dmg, w: 8, h: 8, grav: 0.16, life: 130, spin: 0.2 * (vx >= 0 ? 1 : -1) }); }
  shatter(g, y) { g.addProjectile(new TwinPool(this.x, y, 5)); g.fx.burst(this.x, y - 3, 10, [[0.85, 0.93, 1], [1, 0.97, 0.7]], { speed: 1.8, s0: 8 }); g.fx.ring(this.x, y - 3, 22, [0.8, 0.9, 1], 16, 0.25); A.sfx('break'); this.dead = true; }
  update(g) { const r = this.step(g); if (r === 'floor') this.shatter(g, Math.floor((this.y + 4) / T) * T); else if (r === 'wall') this.shatter(g, Math.floor(this.y / T + 1) * T); }
  explode(g) { this.shatter(g, g.groundBelow(this.x, this.y)); }
  draw(ctx, cx, cy) { ctx.save(); ctx.translate(Math.round(this.x - cx), Math.round(this.y - cy)); ctx.rotate(this.rot); ctx.fillStyle = '#d8ecff'; ctx.fillRect(-3, -2, 6, 6); ctx.fillStyle = '#9ccaf0'; ctx.fillRect(-2, 0, 4, 3); ctx.fillStyle = '#c9a14a'; ctx.fillRect(-1, -4, 2, 2); ctx.restore(); }
}

// the magic arrow, turned: it bends toward YOU (slowly enough to be outrun round a corner) and the sword can cut it down
export class TwinArrow extends Throw {
  constructor(x, y, dir, dmg = 8) { super(x, y, dir * 3, -0.4, { dmg, w: 8, h: 6, life: 190, destructible: true }); this.ang = dir > 0 ? -0.12 : Math.PI + 0.12; this.spd = 2.8; }
  update(g) {
    const p = g.player, da0 = Math.atan2(p.y - 20 - this.y, p.x - this.x) - this.ang, da = Math.atan2(Math.sin(da0), Math.cos(da0));
    this.ang += clamp(da, -0.05, 0.05); this.spd = Math.min(3.7, this.spd + 0.03); this.vx = Math.cos(this.ang) * this.spd; this.vy = Math.sin(this.ang) * this.spd; this.dir = this.vx >= 0 ? 1 : -1;
    const r = this.step(g), ca = Math.cos(this.ang), sa = Math.sin(this.ang);
    for (let i = 0; i < 2; i++) g.fx.emit({ x: this.x - ca * (3 + i * 4) + rand(-1, 1), y: this.y - sa * (3 + i * 4) + rand(-1, 1), vx: rand(-0.25, 0.25) - this.vx * 0.05, vy: rand(-0.25, 0.2), life: rand(18, 36), s0: i ? 3 : 6, s1: 0.5, c0: [0.9, 0.85, 1], c1: [0.55, 0.35, 1], a0: 1, a1: 0, kind: i ? 1 : 6, drag: 0.96 });
    g.fx.glow(this.x, this.y, 8, [0.8, 0.7, 1], 0.5); g.fx.light(this.x, this.y, 30, 0.4, [0.75, 0.65, 1]);
    if (r === 'wall' || r === 'floor') { g.fx.sparks(this.x + ca * 4, this.y + sa * 4, 6, [[1, 1, 1], [0.7, 0.55, 1]], 2); A.sfx('block'); this.dead = true; }
  }
  draw(ctx, cx, cy) {
    ctx.save(); ctx.translate(Math.round(this.x - cx), Math.round(this.y - cy)); ctx.rotate(this.ang);
    ctx.fillStyle = '#8a6ad8'; ctx.fillRect(-8, -3, 3, 2); ctx.fillRect(-8, 1, 3, 2); ctx.fillStyle = '#d8ccff'; ctx.fillRect(-6, -1, 2, 2);
    ctx.fillStyle = '#e9e2ff'; ctx.fillRect(-6, -0.5, 10, 1); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(3, -2.5); ctx.lineTo(8, 0); ctx.lineTo(3, 2.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
