// THE HAUNTED PORTRAIT.  Most of the portraits in the castle are only pictures.  Some are not.  It hangs like the others (in the same frame, and starts with the same hopeful face),
// but as you walk up to it the face turns - happy, then neutral, then sad, then furious - and when you are close it wakes.  Each one has a way of fighting:
//   fire   - its eyes burn red, then it spits two fireballs at you (sometimes a second pair)
//   wisp   - its eyes burn blue, then it releases wisps of blue fire that follow you for a while.  A wisp can be cut down with the sword.
//   fly    - the frame tears off the wall and it flies at you, now and then lunging (it winds up first)
//   or two of those at once: it flies AND shoots.
// While it is still a picture it cannot be hurt or hurt you.  Every attack is announced (eyes glowing, a sound) before it comes.
import { Enemy } from './enemies.js';
import { Projectile, HomingWisp } from './projectiles.js';
import { Audio_ as A } from './audio.js';
import { COLORS } from './fx.js';
import { rand, clamp, TAU, T } from './util.js';
import { drawFramedPortrait, eyePoints, EMO, CHARS, FRAME_N } from './portraitart.js';

// the road from the face you first see to the furious one
const LADDERS = [[EMO.happy, EMO.neutral, EMO.sad, EMO.angry], [EMO.happy, EMO.neutral, EMO.sad, EMO.angry], [EMO.extra, EMO.neutral, EMO.sad, EMO.angry], [EMO.neutral, EMO.sad, EMO.angry]];
const KINDS = [['fire', false, 3], ['wisp', false, 3], [null, true, 2], ['fire', true, 2], ['wisp', true, 2]];          // [what it shoots, does it fly, how common]
const GLOW = { fire: [1, 0.32, 0.08], wisp: [0.4, 0.72, 1], none: [0.95, 0.2, 0.25] };

export class HauntedPortrait extends Enemy {
  // x = centre, y = the bottom edge of the frame (like a hanging picture), o: { ci, frame, kind: 'fire'|'wisp'|'fly'|'firefly'|'wispfly' }
  constructor(g, x, y, o = {}) {
    super(g, x, y, 26, 36, o);
    this.name = 'portrait'; this.hp = this.maxHp = 18; this.dmg = 11; this.xp = 24; this.gravity = false; this.kbRes = 0.85; this.deathFx = COLORS.gold;
    this.invuln = true; this.harmless = true;                                                         // a picture: nothing to hit, nothing to fear (until it wakes)
    this.ci = o.ci !== undefined ? o.ci : Math.floor(Math.random() * CHARS); this.frame = o.frame !== undefined ? o.frame : Math.floor(Math.random() * FRAME_N);
    const ks = o.kind ? KINDS.find(k => (k[0] || '') + (k[1] ? 'fly' : '') === o.kind) : null, tot = KINDS.reduce((s, k) => s + k[2], 0); let pick = ks;
    if (!pick) { let r = Math.random() * tot; pick = KINDS[0]; for (const k of KINDS) if ((r -= k[2]) < 0) { pick = k; break; } }
    this.shoot = pick[0]; this.fly = pick[1]; this.ladder = LADDERS[Math.floor(Math.random() * LADDERS.length)];
    this.state = 'dormant'; this.st = 0; this.mood = 0; this.cool = 40; this.cool2 = 130; this.rot = 0; this.shake = 0; this.ph = rand(TAU); this.volley2 = false; this.back = 'idle'; this.lungeDir = [1, 0];
  }
  glowColor() { return GLOW[this.shoot || 'none']; }
  eyes() { return eyePoints(this.x, this.y, this.ci, this.rot); }
  glowEyes(g, a, r) { const col = this.glowColor(); for (const [ex, ey] of this.eyes()) { g.fx.glow(ex, ey, r, col, a); g.fx.light(ex, ey, 16 + r * 2, 0.35 * a, col); } }

  ai(g) {
    const p = g.player, dx = p.x - this.x, dy = (p.y - 22) - this.cy, d = Math.hypot(dx, dy); this.st++; if (this.cool > 0) this.cool--; if (this.cool2 > 0) this.cool2--; if (this.shake > 0) this.shake--;
    if (this.state === 'dormant') {                                                                    // a picture: the nearer you come, the worse the face
      const R0 = 240, R1 = 88; this.mood = clamp((R0 - d) / (R0 - R1), 0, 1);
      if (this.mood > 0.7 && this.t % 4 === 0) this.shake = 2;
      if (d < R1) { this.state = 'wake'; this.st = 0; A.sfx('shriek'); g.fx.ring(this.x, this.cy, 26, this.glowColor(), 22, 0.25); g.shake(2, 10); }
      return;
    }
    if (this.state === 'wake') {                                                                       // the picture shudders and the eyes ignite
      this.mood = 1; this.shake = 2; const k = this.st / 36; this.glowEyes(g, 0.3 + 0.7 * k, 2 + 3.5 * k);
      if (this.st % 7 === 0) g.fx.burst(this.x + rand(-11, 11), this.cy + rand(-14, 14), 3, [[0.8, 0.75, 0.6], [0.3, 0.25, 0.2]], { speed: 1, s0: 4, s1: 1 });
      if (this.st >= 36) { this.invuln = false; this.state = this.fly ? 'peel' : 'idle'; this.st = 0; this.cool = 28; A.sfx('crack'); }
      return;
    }
    this.mood = 1; this.glowEyes(g, 0.32 + 0.08 * Math.sin(this.t * 0.2), 2.2);
    switch (this.state) {
      case 'idle': this.vx = this.vy = 0; this.maybeShoot(g, d, dy); break;
      case 'peel':                                                                                     // the frame tears free of the wall
        this.shake = 2; this.vx = this.vy = 0; if (this.st % 6 === 0) g.fx.burst(this.x + rand(-12, 12), this.cy - 12, 2, [[0.7, 0.65, 0.55], [0.3, 0.25, 0.2]], { speed: 0.8, s0: 4, s1: 1 });
        if (this.st > 30) { this.state = 'drift'; this.harmless = false; this.vy = 1.4; this.st = 0; this.cool2 = Math.max(this.cool2, 90); A.sfx('break'); g.fx.burst(this.x, this.cy, 8, [[0.8, 0.75, 0.6], [0.3, 0.25, 0.2]], { speed: 1.6, s0: 6, s1: 2 }); }
        break;
      case 'drift': this.drift(p); this.maybeShoot(g, d, dy); this.maybeLunge(p, d); break;
      case 'aim': {                                                                                    // eyes burn: the warning, then the shot
        this.vx *= 0.9; this.vy *= 0.9; const k = Math.min(1, this.st / 40); this.glowEyes(g, 0.5 + 0.5 * k, 2.5 + 4.5 * k);
        if (this.st === 1) A.sfx('tell'); if (this.st % 10 === 0) { const col = this.glowColor(); for (const [ex, ey] of this.eyes()) g.fx.ring(ex, ey, 4 + 3 * k, col, 10, 0.3); }
        if (this.shoot === 'fire') { if (this.st === 40 || (this.volley2 && this.st === 54)) this.fireVolley(g, p); if (this.st > 62) this.endAim(150 + rand(40)); }
        else { if (this.st === 40) this.releaseWisps(g, p); if (this.st > 58) this.endAim(220 + rand(70)); }
        break; }
      case 'ltell': {                                                                                  // winds up for a lunge: pulls back, tilts, glows
        const k = this.st / 30; this.vx = -this.lungeDir[0] * 0.35; this.vy = -this.lungeDir[1] * 0.35; this.rot = -this.lungeDir[0] * 0.3 * k; this.glowEyes(g, 0.5 + 0.5 * k, 2.5 + 4 * k); if (this.st === 1) A.sfx('tell');
        if (this.st >= 30) { const dd = Math.hypot(dx, dy) || 1; this.lungeDir = [dx / dd, dy / dd]; this.state = 'lunge'; this.st = 0; A.sfx('slash'); }
        break; }
      case 'lunge': this.vx = this.lungeDir[0] * 3.3; this.vy = this.lungeDir[1] * 3.3; this.rot = this.lungeDir[0] * 0.3; if (this.t % 2 === 0) g.fx.emit({ x: this.x + rand(-8, 8), y: this.cy + rand(-8, 8), vx: -this.vx * 0.2, vy: -this.vy * 0.2, life: 18, s0: 6, s1: 2, c0: this.glowColor(), a0: 0.5, a1: 0, kind: 0 });
        if (this.st > 22) { this.state = 'drift'; this.st = 0; this.cool2 = this.shoot ? 240 + rand(80) : 150 + rand(60); this.vx *= 0.3; this.vy *= 0.3; }
        break;
    }
  }
  endAim(cool) { this.state = this.back; this.st = 0; this.cool = cool; }
  maybeShoot(g, d, dy) {
    if (!this.shoot || this.cool > 0 || d > 300 || Math.abs(dy) > 210) return;
    this.back = this.state; this.state = 'aim'; this.st = 0; this.volley2 = Math.random() < 0.5;
  }
  maybeLunge(p, d) {
    if (this.cool2 > 0 || d > 230 || d < 40) return;
    const dd = d || 1; this.lungeDir = [(p.x - this.x) / dd, ((p.y - 22) - this.cy) / dd]; this.state = 'ltell'; this.st = 0;
  }
  drift(p) {                                                                                           // hovers about the hero, a little above, weaving
    const tx = p.x + Math.sin(this.t * 0.021 + this.ph) * 64, ty = p.y - 54 + Math.sin(this.t * 0.033 + this.ph * 2) * 22;
    this.vx += clamp((tx - this.x) * 0.0018, -0.035, 0.035); this.vy += clamp((ty - this.cy) * 0.0018, -0.035, 0.035);
    this.vx = clamp(this.vx * 0.994, -1.3, 1.3); this.vy = clamp(this.vy * 0.994, -1.3, 1.3);
  }
  fireVolley(g, p) {                                                                                   // two fireballs, one from each eye
    A.sfx('fireball');
    for (const [ex, ey] of this.eyes()) {
      const a = Math.atan2((p.y - 20) - ey, p.x - ex) + rand(-0.06, 0.06), sp = 2.3;
      g.addProjectile(new Projectile(ex, ey, Math.cos(a) * sp, Math.sin(a) * sp, 'fire', { dmg: 9, life: 170 })); g.fx.burst(ex, ey, 5, COLORS.fire, { speed: 1.4, s0: 7 });
    }
  }
  releaseWisps(g, p) {                                                                                 // wisps of blue fire that hunt the hero (they can be cut down)
    const live = g.projectiles.filter(q => q.kind === 'wisp' && !q.dead).length; let n = 0; A.sfx('cast');
    for (const [ex, ey] of this.eyes()) {
      if (live + n >= 4) break; n++;
      const a = Math.atan2((p.y - 20) - ey, p.x - ex) + rand(-0.7, 0.7); g.addProjectile(new HomingWisp(ex, ey, Math.cos(a) * 0.9, Math.sin(a) * 0.9, 8)); g.fx.burst(ex, ey, 6, COLORS.blue, { speed: 1.2, s0: 7 });
    }
  }
  physics() {
    if (this.fly && this.state !== 'idle' && this.state !== 'peel') {
      const room = this.g.room, nx = this.x + this.vx, ny = this.y + this.vy;
      if (room.solid(Math.floor(nx / T), Math.floor(this.cy / T))) this.vx *= -0.7; else this.x = nx;
      if (room.solid(Math.floor(this.x / T), Math.floor((ny - this.h * 0.5) / T)) || room.solid(Math.floor(this.x / T), Math.floor(ny / T))) this.vy *= -0.7; else this.y = ny;
    }
    const want = this.fly && this.state === 'drift' ? clamp(this.vx * 0.16, -0.35, 0.35) : this.state === 'lunge' || this.state === 'ltell' ? this.rot : 0; this.rot += (want - this.rot) * 0.12;
    if (this.flashT > 0) this.flashT--; if (this.hurtT > 0) this.hurtT--;
  }
  onDeath() {
    const g = this.g; A.sfx('break'); g.shake(3, 12);
    g.fx.burst(this.x, this.cy, 16, [[0.85, 0.7, 0.3], [0.4, 0.25, 0.1]], { speed: 2.6, s0: 8, s1: 2 }); g.fx.sparks(this.x, this.cy, 14, [[1, 1, 0.9], [0.7, 0.85, 1]], 3.6, { gy: 0.2 });
    for (const [ex, ey] of this.eyes()) g.fx.ring(ex, ey, 9, this.glowColor(), 14, 0.3);
  }
  draw(ctx, cx, cy) {
    const L = this.ladder, pos = this.mood * (L.length - 1), i = Math.min(L.length - 2, Math.floor(pos)), t = pos - i, awake = this.state !== 'dormant';
    const jx = this.shake > 0 ? Math.round(rand(-1, 1)) : 0, jy = this.shake > 0 ? Math.round(rand(-0.7, 0.7)) : 0;
    drawFramedPortrait(ctx, this.x - cx + jx, this.y - cy + jy, { ci: this.ci, a: L[i], b: L[i + 1], t, frame: this.frame },
      { rot: this.rot, flash: this.flashT > 0, tint: awake ? 'rgba(110,0,14,' + (0.1 + 0.05 * Math.sin(this.t * 0.18)).toFixed(2) + ')' : null, alpha: this.alpha < 1 ? this.alpha : undefined });
  }
}
