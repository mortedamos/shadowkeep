// Bosses.  Each fight: dormant -> (player approaches) intro/seal doors/music -> pattern loop -> dying sequence -> relic reward.
//
// TELEGRAPHING - every attack announces itself three ways so it can be read and dodged:
//   1. an ICON + NAME floats over the boss during the last ~50 frames of its rest period (toggle: Options > Boss Hints)
//   2. a coloured aura, a warning sound and (for most attacks) a DANGER ZONE painted on the floor/air during the windup
//   3. a windup that always lasts at least ~0.75s before anything can hurt you; after an attack the boss is open for a beat
// Passive body contact only does a fraction of damage; the full amount is reserved for the moment the attack is live.
import { Enemy } from './enemies.js';
import { drawSheet } from './assets.js';
import { ICON } from './procart.js';
import { Audio_ as A } from './audio.js';
import { COLORS } from './fx.js';
import { Projectile, Shockwave, FirePatch } from './projectiles.js';
import { dropItem, rollEnchantDrop } from './props.js';
import { drawText } from './font.js';
import { PW as HPW, PH as HPH } from './physics.js';
import { heroFrame, JUMP_CY, JATK_CY, TwinDagger, TwinAxe, TwinTorch, TwinFlask, TwinArrow } from './mirror.js';
import { clamp, rand, approach, overlap } from './util.js';

// name shown over the boss + colour + pictogram for each attack
const ATTACKS = {
  charge: { label: 'CHARGE', rgb: [255, 90, 70], glyph: 'chevrons' },
  gallop: { label: 'GALLOP', rgb: [255, 90, 70], glyph: 'chevrons' },
  breath: { label: 'FIRE BREATH', rgb: [255, 150, 60], icon: 'ember' },
  leap: { label: 'LEAP SLAM', rgb: [255, 208, 74], glyph: 'down' },
  stomp: { label: 'STOMP', rgb: [255, 208, 74], glyph: 'down' },
  slam: { label: 'SLAM', rgb: [255, 208, 74], glyph: 'down' },
  pillars: { label: 'FLAME PILLARS', rgb: [255, 120, 60], glyph: 'bars' },
  vents: { label: 'STEAM VENTS', rgb: [210, 222, 238], glyph: 'bars' },
  strikes: { label: 'LIGHTNING', rgb: [150, 200, 255], icon: 'thunder' },
  feathers: { label: 'FEATHERS', rgb: [200, 220, 255], icon: 'feather' },
  skulls: { label: 'SKULL VOLLEY', rgb: [100, 220, 255], icon: 'skull' },
  gears: { label: 'GEAR TOSS', rgb: [230, 180, 80], sheet: 'gear' },
  summon: { label: 'SUMMONS', rgb: [180, 110, 255], icon: 'skull' },
  dive: { label: 'DIVE', rgb: [255, 255, 255], glyph: 'diag' },
  embers: { label: 'EMBER VOLLEY', rgb: [255, 130, 50], icon: 'ember' },
  tentacles: { label: 'TENTACLES', rgb: [150, 110, 220], glyph: 'bars' },
  spores: { label: 'SPORE BURST', rgb: [140, 255, 120], icon: 'orb' },
  lunge: { label: 'BLOOD LUNGE', rgb: [255, 70, 90], glyph: 'chevrons' },
  bolts: { label: 'BLOOD BOLTS', rgb: [255, 60, 90], icon: 'orb' },
  mist: { label: 'MIST STEP', rgb: [190, 110, 255], glyph: 'diag' },
  slash: { label: 'SWORD', rgb: [214, 214, 255], glyph: 'chevrons' },
  dash: { label: 'SHADOW DASH', rgb: [170, 110, 255], glyph: 'chevrons' },
  dagger: { label: 'DAGGERS', rgb: [200, 205, 240], icon: 'dagger' },
  axe: { label: 'AXE', rgb: [255, 190, 120], icon: 'axe' },
  torch: { label: 'TORCH', rgb: [255, 140, 60], icon: 'torchi' },
  marrow: { label: 'MAGIC ARROW', rgb: [200, 190, 255], icon: 'marrow' },
  holy: { label: 'HOLY WATER', rgb: [190, 225, 255], icon: 'holy' },
  bandage: { label: 'BANDAGE', rgb: [180, 255, 190], icon: 'bandage' },
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function drawGlyph(ctx, kind, x, y, dir, col, t) {
  ctx.fillStyle = col;
  if (kind === 'chevrons') { const hot = Math.floor(t / 4) % 3; for (let i = 0; i < 3; i++) { ctx.globalAlpha = i === hot ? 1 : 0.5; const cx = x + dir * (i * 5 - 5); for (let r = -4; r <= 4; r++) ctx.fillRect(cx + dir * (4 - Math.abs(r)) - (dir < 0 ? 1 : 0), y + r, 2, 1); } }
  else if (kind === 'down') { ctx.fillRect(x - 1, y - 8, 3, 8); for (let r = 0; r < 5; r++) ctx.fillRect(x - (4 - r), y + r, 2 * (4 - r) + 1, 1); ctx.fillRect(x - 8, y + 7, 17, 2); ctx.globalAlpha = 0.6; ctx.fillRect(x - 10, y + 5, 2, 1); ctx.fillRect(x + 9, y + 5, 2, 1); }
  else if (kind === 'bars') { for (const [i, h] of [[-1, 8], [0, 13], [1, 8]]) ctx.fillRect(x - 1 + i * 6 - 1, y + 7 - h, 3, h); ctx.fillRect(x - 9, y + 7, 19, 1); }
  else if (kind === 'diag') { for (let i = 0; i < 9; i++) ctx.fillRect(x - 6 + i, y - 6 + i, 3, 2); ctx.fillRect(x + 1, y + 3, 7, 2); ctx.fillRect(x + 6, y - 2, 2, 7); }
  ctx.globalAlpha = 1;
}

// -------------------------------------------------------------------------------------------- telegraphed hazard column
// kind: fire (flame pillar), bolt (lightning), steam (vent), shadow (dark flame)
export class Column {
  constructor(x, y, kind, o = {}) {
    this.x = x; this.y = y; this.kind = kind; this.warn = o.warn || 45; this.active = o.active || 30; this.dmg = o.dmg || 16; this.w = o.w || 26; this.h = o.h || 150; this.t = 0; this.dead = false; this.owner = 'enemy'; this.vx = 0; this.vy = 0; this.fired = false;
  }
  get box() { return this.t >= this.warn && this.t < this.warn + this.active ? { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h } : { x: -999, y: -999, w: 0, h: 0 }; }
  update(g) {
    this.t++; const col = { fire: [1, 0.5, 0.15], bolt: [0.7, 0.85, 1], steam: [0.8, 0.85, 0.95], shadow: [0.6, 0.2, 1], tentacle: [0.55, 0.4, 0.9] }[this.kind];
    if (this.t < this.warn) {                      // telegraph: pulsing marker on the floor + a faint beam that brightens until it fires
      const k = this.t / this.warn; if (this.t === 1) this.q = g.fx.quad({ kind: 'beam', x: this.x, y: this.y - this.h / 2, w: this.w * 1.1, h: this.h, color: col, life: this.warn, a0: 0.05, a1: 0.7 });
      g.fx.glow(this.x, this.y - 2, 14 + k * 14, col, 0.3 + k * 0.5); if (this.t % 6 === 0) g.fx.ring(this.x, this.y - 2, 16 + k * 10, col, 12, 0.3, 3);
      if (this.kind === 'steam' && this.t % 3 === 0) g.fx.smoke(this.x, this.y - 2, 1, { s0: 5, s1: 12, c0: [0.8, 0.85, 0.9], c1: [0.5, 0.55, 0.6], a: 0.3 });
    } else if (this.t < this.warn + this.active) {
      if (!this.fired) {
        this.fired = true;
        if (this.kind === 'bolt') { g.fx.bolt(this.x + rand(-6, 6), g.camera.y - 20, this.x, this.y - 2, { width: 22, life: 24, segs: 20 }); g.fx.flash([0.7, 0.8, 1], 0.4); A.sfx('crack'); g.shake(3, 10); }
        else if (this.kind === 'fire' || this.kind === 'shadow') { A.sfx('fire'); g.shake(2, 14); g.fx.ring(this.x, this.y - 2, 40, col, 18, 0.2); }
        else if (this.kind === 'tentacle') { A.sfx('hit'); g.shake(2, 8); g.fx.burst(this.x, this.y - 2, 8, [[0.5, 0.3, 0.8], [0.15, 0.1, 0.3]], { speed: 1.8, s0: 10, up: 1 }); }
        else A.sfx('steam');
      }
      if (this.kind === 'fire' || this.kind === 'shadow') { g.fx.fire(this.x, this.y, { scale: 1.6, n: 4, color: this.kind === 'fire' ? 'fire' : 'purple' }); g.fx.glow(this.x, this.y - 60, 70, col, 0.35); }
      if (this.kind === 'fire') this.pillar(g);
      else if (this.kind === 'steam') g.fx.jet(this.x, this.y, -Math.PI / 2, [[0.95, 0.97, 1], [0.5, 0.55, 0.65]], { n: 3, speed: 5, spread: 0.1, size: 20 });
      else g.fx.glow(this.x, this.y - 40, 60, col, 0.5);
      g.fx.light(this.x, this.y - 40, 90, 1);
      const p = g.player; if (overlap(this.box, p.hurtbox)) p.hurt(this.dmg, this.x);
    } else this.dead = true;
  }
  // The pillar of fire: a tall column of burning light (two beams, a wide orange one around a hot yellow core) with flames streaming up its whole height, a roaring base and sparks.
  // It shoots up over a few steps, and dies down over the last ten.  All of it is drawn by the three.js effects layer.
  pillar(g) {
    const act = this.t - this.warn, grow = Math.min(1, (act + 1) / 5), fade = Math.min(1, (this.active - act) / 10), H = this.h * grow;
    if (!this.beams) {
      this.beams = [g.fx.quad({ kind: 'beam', x: this.x, y: this.y - this.h / 2, w: this.w * 3.4, h: this.h, color: [1, 0.42, 0.08], life: this.active, a0: 0.85, a1: 0.15 }),
        g.fx.quad({ kind: 'beam', x: this.x, y: this.y - this.h / 2, w: this.w * 1.5, h: this.h, color: [1, 0.9, 0.55], life: this.active, a0: 0.95, a1: 0.2 })];
    }
    for (const q of this.beams) { q.h = q.h1 = this.h * grow; q.y = this.y - q.h / 2; }
    for (let i = 0; i < 6; i++) {                                                                   // soft fiery puffs fill the column, big tongues of flame lick up through it
      const f = Math.random(), y = this.y - f * H, half = this.w * 0.5 * (1 - f * 0.4);
      g.fx.emit({ x: this.x + rand(-half, half), y, vx: rand(-0.3, 0.3), vy: -rand(1, 2.4), drag: 0.97, life: rand(10, 20), s0: rand(22, 34) * (1 - f * 0.3), s1: 8, c0: [1, 0.55, 0.14], c1: [0.8, 0.14, 0.04], a0: 0.45 * fade, a1: 0, kind: 0 });
      if (i < 3) g.fx.emit({ x: this.x + rand(-half, half), y, vx: rand(-0.4, 0.4), vy: -rand(1.6, 3.4), drag: 0.97, life: rand(12, 24), s0: rand(20, 32) * (1 - f * 0.35), s1: 4, c0: [1, 0.85, 0.35], c1: [0.9, 0.2, 0.05], a0: 0.9 * fade, a1: 0, kind: 2 });
    }
    if (this.t % 2 === 0) g.fx.emit({ x: this.x + rand(-this.w / 2, this.w / 2), y: this.y - rand(0, H), vx: rand(-0.6, 0.6), vy: -rand(1, 2.4), life: rand(24, 50), s0: 3, s1: 0.8, c0: [1, 0.85, 0.4], c1: [1, 0.3, 0.1], a0: 1, a1: 0, kind: 1 });
    g.fx.fire(this.x, this.y + 2, { scale: 2.1, n: 3 });
  }
  draw(ctx, cx, cy) {
    if (this.kind === 'tentacle') {            // a hole opens in the ground (the warning), then a tentacle heaves out of it and sways
      const act = this.t - this.warn, k = this.t / this.warn;
      if (act < 0) drawSheet(ctx, 'ars_tentacles_r0', Math.min(4, Math.floor(k * 5)), this.x - cx, this.y - cy + 2, { alpha: 0.5 + 0.5 * k });
      else if (act < 16) drawSheet(ctx, 'ars_tentacles_r1', Math.min(7, Math.floor(act / 2)), this.x - cx, this.y - cy + 2, {});
      else drawSheet(ctx, 'ars_tentacles_r2', Math.floor(this.t / 3) % 8, this.x - cx, this.y - cy + 2, { alpha: Math.min(1, (this.warn + this.active - this.t) / 8) });
    } else if (this.kind === 'fire' && this.t >= this.warn) { /* the pillar of fire is light and flame in the effects layer (see pillar()), not a sprite */ }
    else if (this.t < this.warn) { // floor marker that fills as the attack nears
      const k = this.t / this.warn, c = { fire: [255, 120, 50], bolt: [150, 200, 255], steam: [210, 222, 238], shadow: [170, 80, 255], tentacle: [150, 110, 220] }[this.kind];
      ctx.fillStyle = rgba(c, 0.15 + 0.35 * k); ctx.fillRect(Math.round(this.x - cx - this.w / 2), Math.round(this.y - cy - 3), this.w, 3);
      ctx.fillStyle = rgba(c, 0.5 + 0.5 * k); ctx.fillRect(Math.round(this.x - cx - this.w / 2), Math.round(this.y - cy - 1), Math.round(this.w * k), 1);
    }
  }
}

// -------------------------------------------------------------------------------------------- Boss base
export class Boss extends Enemy {
  constructor(g, x, y, w, h, o) {
    super(g, x, y, w, h, o); this.isBoss = true; this.active = false; this.invuln = true; this.harmless = true; this.state = 'dormant'; this.st = 0; this.dying = 0; this.reward = o.reward; this.bossName = 'BOSS'; this.phase = 1; this.cool = 60; this.triggerDist = 200; this.kbRes = 1; this.noKb = true; this.heavy = true; this.sub = '';
    this.plan = null; this.lastAtk = null; this.intent = null; this.warns = null; this.tellP = 0; this._tellKind = null;
  }
  start() { this.active = true; this.state = 'intro'; this.st = 0; this.g.startBoss(this); }
  hurt(dmg, dir, opts = {}) { opts.noKb = true; return super.hurt(dmg, dir, opts); }
  onHurt() { if (this.phase === 1 && this.hp < this.maxHp * 0.5) { this.phase = 2; this.onPhase2(); } }
  onPhase2() {
    const g = this.g; g.fx.flash([1, 0.4, 0.3], 0.5); g.shake(5, 24); A.sfx('roar'); g.fx.ring(this.x, this.cy, 90, [1, 0.4, 0.3], 34, 0.14);
    dropItem(g, 'heart', this.x - 36, this.cy - 20); dropItem(g, 'heart', this.x + 36, this.cy - 20); dropItem(g, 'mana', this.x, this.cy - 30);     // a breather when the fight escalates
    this.state = this.state === 'dormant' ? this.state : 'idle'; this.st = -40; this.plan = null;
  }
  die() {
    if (this.dying) return; this.dying = 1; this.invuln = true; this.harmless = true; this.hp = 0; this.g.bossDying(this); A.sfx('roar');
  }
  dyingSeq() {
    const g = this.g; this.dying++; this.vx = 0; this.flashT = this.dying % 6 < 3 ? 4 : 0;
    if (this.dying % 5 === 0) { const px = this.x + rand(-this.w, this.w), py = this.cy + rand(-this.h / 2, this.h / 2); g.fx.burst(px, py, 10, COLORS.fire, { speed: 3, s0: 18 }); g.fx.sparks(px, py, 8, COLORS.gold, 4); g.fx.ring(px, py, 24, [1, 0.8, 0.4], 14); A.sfx('boom'); g.shake(4, 8); }
    if (this.dying === 150) { g.fx.flash([1, 1, 1], 1.0); g.fx.ring(this.x, this.cy, 160, [1, 0.9, 0.7], 44, 0.1); g.fx.burst(this.x, this.cy, 60, COLORS.gold, { speed: 5, s0: 22 }); g.fx.souls(this.x, this.cy, 30, COLORS.blue); A.sfx('thunder'); this.dead = true; g.player.gainXp(this.xp); rollEnchantDrop(g, this, true); g.bossDefeated(this); }
  }
  update() {
    if (this.freezeT > 0 && this.active && !this.dying) { this.freezeTick(); return; }     // frozen mid-move: everything pauses, then resumes
    if (this.freezeImmune > 0) this.freezeImmune--;
    this.t++; const g = this.g, p = g.player; if (this.active && !this.dying) this.tickStatus();
    if (!this.active) { if (!g.save.flags['boss_' + g.room.id] && Math.abs(p.x - this.x) < this.triggerDist && p.onGround) this.start(); this.physics(); return; }
    if (this.dying) { this.dyingSeq(); this.physics(); return; }
    this.st++; if (this.state === 'intro') { this.intro(g); if (this.st > 100) { this.state = 'idle'; this.st = -20; this.invuln = false; this.harmless = false; } this.physics(); return; }
    this.warns = null; this.intent = null;
    this.ai(g); if (!this.intent) this._tellKind = null;
    this.physics(); this.touch();
  }
  intro() {}
  // Is the boss "live" right now?  (only then does touching it hurt for full damage)
  dangerous() { return false; }
  touch() {
    const p = this.g.player; if (this.harmless || this.dead || this.dying) return;
    if (overlap(this.hurtbox, p.hurtbox)) p.hurt(this.dangerous() ? this.dmg : Math.max(3, Math.round(this.dmg * 0.4)), this.x);
  }
  faceP() { this.dir = this.g.player.x >= this.x ? 1 : -1; }

  // ---- attack selection with a visible lead-in
  choose(list) { const pool = list.length > 1 ? list.filter(k => k !== this.lastAtk) : list; return pool[Math.floor(Math.random() * pool.length)]; }
  // call every idle step.  Picks the next attack right away, shows its icon for the last ~54 frames of the wait, then enters it.
  planNext(list, wait) {
    if (!this.plan) this.plan = this.choose(list);
    const lead = 54; if (this.st > wait - lead) this.tell(this.plan, clamp((this.st - (wait - lead)) / lead, 0, 1));
    if (this.st >= wait) { const k = this.plan; this.plan = null; this.lastAtk = k; this.state = k; this.st = 0; return true; }
    return false;
  }
  // announce an attack: icon, aura, warning sound, optional danger zones.  `p` = windup progress 0..1
  tell(kind, p, warns) {
    const info = ATTACKS[kind] || ATTACKS.charge, g = this.g, c = info.rgb.map(v => v / 255);
    this.intent = kind; this.tellP = p; if (warns) this.warns = warns;
    if (this._tellKind !== kind) { this._tellKind = kind; A.sfx('tell'); g.fx.ring(this.x, this.cy, 34, c, 22, 0.2, 6); this.flashT = 4; }
    g.fx.glow(this.x, this.cy, 34 + this.w * 0.5 + p * 22, c, 0.16 + 0.34 * p);
    if (this.t % 3 === 0) g.fx.emit({ x: this.x + rand(-this.w / 2, this.w / 2), y: this.y - rand(0, this.h), vx: 0, vy: -rand(0.5, 1.3), life: 24, s0: 5, s1: 1, c0: c, a0: 0.9, a1: 0, kind: 1 });
  }
  drawWarn(ctx, cx, cy) {
    if (!this.warns || !this.warns.length) return; const t = this.t, p = this.tellP, c = (ATTACKS[this.intent] || ATTACKS[this.lastAtk] || ATTACKS.charge).rgb, a =0.1 + 0.2 * p + 0.05 * Math.sin(t * 0.5);
    for (const w of this.warns) {
      ctx.save();
      if (w.type === 'lane') { // charge path along the floor
        const x0 = Math.min(w.x0, w.x1) - cx, len = Math.abs(w.x1 - w.x0), dir = Math.sign(w.x1 - w.x0) || 1; ctx.fillStyle = rgba(c, a); ctx.fillRect(Math.round(x0), Math.round(w.y - cy - 22), Math.round(len), 22);
        ctx.fillStyle = rgba(c, 0.55 + 0.4 * p); ctx.fillRect(Math.round(x0), Math.round(w.y - cy - 1), Math.round(len), 1); ctx.fillRect(Math.round(x0), Math.round(w.y - cy - 22), Math.round(len), 1);
        for (let i = 0; i < Math.ceil(len / 28); i++) { const px = (w.x0 - cx) + dir * (((t * 3 + i * 28) % Math.max(28, len))); ctx.fillStyle = rgba(c, 0.35 + 0.4 * p); for (let r = -5; r <= 5; r++) ctx.fillRect(Math.round(px + dir * (5 - Math.abs(r))), Math.round(w.y - cy - 11 + r), 2, 1); }
      } else if (w.type === 'rect') { ctx.fillStyle = rgba(c, a); ctx.fillRect(Math.round(w.x - cx), Math.round(w.y - cy), w.w, w.h); ctx.strokeStyle = rgba(c, 0.5 + 0.4 * p); ctx.lineWidth = 1; ctx.strokeRect(Math.round(w.x - cx) + 0.5, Math.round(w.y - cy) + 0.5, w.w - 1, w.h - 1); }
      else if (w.type === 'ring') { const x = w.x - cx, y = w.y - cy; ctx.fillStyle = rgba(c, a * 0.8); ctx.beginPath(); ctx.ellipse(x, y - 1, w.r, w.r * 0.28, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = rgba(c, 0.6 + 0.4 * Math.sin(t * 0.6) * 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y - 1, w.r * (1 - 0.25 * (p % 1)), w.r * 0.28 * (1 - 0.25 * (p % 1)), 0, 0, Math.PI * 2); ctx.stroke(); }
      else if (w.type === 'line') { ctx.strokeStyle = rgba(c, 0.5 + 0.4 * p); ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -t * 0.8; ctx.beginPath(); ctx.moveTo(w.x0 - cx, w.y0 - cy); ctx.lineTo(w.x1 - cx, w.y1 - cy); ctx.stroke(); }
      else if (w.type === 'poly') { ctx.fillStyle = rgba(c, a); ctx.beginPath(); w.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x - cx, y - cy) : ctx.moveTo(x - cx, y - cy))); ctx.closePath(); ctx.fill(); ctx.strokeStyle = rgba(c, 0.4 + 0.4 * p); ctx.lineWidth = 1; ctx.stroke(); }
      ctx.restore();
    }
  }
  drawIntent(ctx, cx, cy) {
    if (!this.intent || !A.settings.hints || this.dying) return; const info = ATTACKS[this.intent]; if (!info) return;
    const x = Math.round(this.x - cx), y = Math.round(Math.max(40, this.y - this.h - 22 - cy)), t = this.t, col = rgba(info.rgb, 1), pulse = 0.55 + 0.45 * Math.sin(t * 0.35);
    ctx.fillStyle = 'rgba(8,4,14,0.82)'; ctx.fillRect(x - 13, y - 13, 26, 26); ctx.strokeStyle = rgba(info.rgb, 0.45 + 0.55 * pulse); ctx.lineWidth = 1; ctx.strokeRect(x - 12.5, y - 12.5, 25, 25);
    if (info.icon) drawSheet(ctx, 'icons', ICON.indexOf(info.icon), x, y, { ay: 0.5, scale: 1.4 }); else if (info.sheet) drawSheet(ctx, info.sheet, Math.floor(t / 6) % 4, x, y, { ay: 0.5, scale: 1.4 });
    else drawGlyph(ctx, info.glyph, x, y, this.dir, col, t);
    drawText(ctx, info.label, x, y - 24, { align: 'center', color: '#ffe9c0', outline: '#000' });
    ctx.fillStyle = rgba(info.rgb, 0.9); ctx.fillRect(x - 12, y + 15, Math.round(24 * clamp(this.tellP, 0, 1)), 2);      // fills as the attack gets closer
  }
}


// FIRE BREATH is a crescent, not a cone: an arc OVERHEAD.  Two curves ([forward distance from the boss's centre, height above the floor]) leave the mouth
// together and meet again on the floor ~200px away.  The OUTER curve is a tall round arch (up to ~140px); the INNER curve drops from the mouth to just
// above head height (~29px) and hangs there before sweeping down to the floor.  The fire fills the moon between them, so:
//   * right under the mouth (f < ~55) you are below the flames,  * in the pocket beside the boss (f ~57-90) a standing hero (34px) is burned but a DUCKING one (20px) is not,
//   * the hollow under the crown of the arch (f ~95-150) is simply tall enough to stand in,  * beyond ~150 the arc comes down on the floor, and past ~200 it can't reach you.
const CURVE_OUT = [[46, 70], [55, 95], [72, 122], [100, 140], [132, 134], [160, 108], [180, 66], [193, 26], [200, 0]];
const CURVE_IN = [[46, 70], [51, 52], [57, 33], [68, 29], [88, 33], [112, 50], [136, 56], [156, 40], [174, 21], [190, 7], [200, 0]];
const resample = (P, n) => {        // Catmull-Rom through the control points -> n evenly-spaced-in-parameter points
  const out = [];
  for (let k = 0; k < n; k++) {
    const u = k / (n - 1) * (P.length - 1), i = Math.min(P.length - 2, Math.floor(u)), t = u - i, p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const cr = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t * t * t);
    out.push([cr(0), Math.max(0, cr(1))]);
  }
  return out;
};
export const BREATH = { out: resample(CURVE_OUT, 40), inn: resample(CURVE_IN, 40) };
// world-space corners of the slice of the crescent between samples i and i+1 (a quad: outer i, outer i+1, inner i+1, inner i)
const breathQuad = (i, x, y, D) => [BREATH.out[i], BREATH.out[i + 1], BREATH.inn[i + 1], BREATH.inn[i]].map(([f, h]) => [x + D * f, y - h]);
function breathOutline(x, y, D) { return BREATH.out.map(([f, h]) => [x + D * f, y - h]).concat(BREATH.inn.slice().reverse().map(([f, h]) => [x + D * f, y - h])); }
const inTri = (px, py, a, b, c) => { const d1 = (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1]), d2 = (px - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (py - c[1]), d3 = (px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1]); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
const inQuad = (px, py, q) => inTri(px, py, q[0], q[1], q[2]) || inTri(px, py, q[0], q[2], q[3]);
// does the fire between samples i0..i1 touch this rectangle?  (15 sample points across the box)
function breathHits(i0, i1, x, y, D, r) {
  for (let i = i0; i < i1; i++) {
    const q = breathQuad(i, x, y, D);
    for (let cx = 0; cx < 3; cx++) for (let cy = 0; cy < 5; cy++) if (inQuad(r.x + 1 + (r.w - 2) * cx / 2, r.y + 1 + (r.h - 2) * cy / 4, q)) return true;
  }
  return false;
}
// ============================================================================================== 1. THE GATEKEEPER (hell beast)
// Plenty of warning, generous openings:  CHARGE (stuns itself on the wall), FIRE BREATH (a crescent of flame - duck beneath it, right next to the boss),
// LEAP SLAM (landing spot is marked), and in phase 2 FLAME PILLARS.
export class BossBeast extends Boss {
  constructor(g, x, y, o) { super(g, x, y, 46, 84, o); this.hp = this.maxHp = 210; this.dmg = 12; this.xp = 120; this.bossName = 'THE GATEKEEPER'; this.sub = 'WARDEN OF THE GRAVEYARD'; this.scale = 2; this.dir = -1; this.deathFx = COLORS.fire; this.stunDur = 100; this.tx = x; this.ice = { w: 94, h: 124 }; }
  get spd() { return this.phase === 2 ? 1.2 : 1; }
  tele(k) { return Math.round({ charge: 60, breath: 48, leap: 50 }[k] / this.spd); }
  dangerous() { return (this.state === 'charge' && this.st >= this.tele('charge')) || (this.state === 'leap' && this.st >= this.tele('leap')); }
  intro(g) { if (this.st === 8) { A.sfx('roar'); g.shake(4, 40); g.fx.flash([1, 0.5, 0.2], 0.3); g.fx.ring(this.x, this.cy, 120, [1, 0.5, 0.2], 40, 0.1); } if (this.st % 4 === 0) g.fx.fire(this.x + rand(-20, 20), this.y - 20, { scale: 1.2, n: 1 }); this.faceP(); }
  ai(g) {
    const p = g.player, spd = this.spd, d = Math.abs(this.dx());
    switch (this.state) {
      case 'idle':
        this.faceP(); this.vx = approach(this.vx, d > 120 ? this.dir * 0.65 : 0, 0.06);
        this.planNext(this.phase === 2 ? ['charge', 'breath', 'leap', 'pillars'] : ['charge', 'breath', 'leap'], Math.round(92 / spd)); break;
      case 'charge': {
        const T0 = this.tele('charge');
        if (this.st < T0) {
          this.vx = 0; if (this.st < T0 - 24) this.faceP();                                  // direction locks 24 frames before it runs
          const x1 = this.dir > 0 ? g.room.pw - 24 : 24; this.tell('charge', this.st / T0, [{ type: 'lane', x0: this.x, x1, y: this.y }]);
          if (this.st === 2) A.sfx('roar'); if (this.st % 5 === 0) { g.fx.fire(this.x + this.dir * 18, this.y - 70, { scale: 0.7, n: 1 }); g.fx.burst(this.x - this.dir * 20, this.y - 2, 2, [[0.6, 0.55, 0.5], [0.2, 0.2, 0.25]], { speed: 1, s0: 8, up: 0.5 }); }
        } else {
          this.vx = this.dir * 3.1 * spd; if (this.st % 3 === 0) g.fx.fire(this.x - this.dir * 20, this.y - 4, { scale: 1.1, n: 1 }); if (this.st % 12 === 0) A.sfx('step');
          if (this.hitX) { this.vx = 0; this.state = 'stun'; this.st = 0; this.stunDur = 110; g.shake(5, 20); A.sfx('boom'); g.fx.burst(this.x + this.dir * 24, this.y - 40, 16, [[0.7, 0.65, 0.6], [0.3, 0.3, 0.35]], { speed: 3, s0: 14, up: 1 }); g.fx.ring(this.x + this.dir * 24, this.y - 40, 50, [1, 0.8, 0.5], 18); }
          else if (this.st > T0 + 110) { this.vx = 0; this.state = 'stun'; this.st = 0; this.stunDur = 50; }
        } break; }
      case 'stun':      // OPEN: free hits while it's dizzy
        this.vx = 0; if (this.st % 8 === 0) g.fx.sparks(this.x + rand(-14, 14), this.y - this.h - 4, 2, COLORS.gold, 1.2, { kind: 6, size: 6 });
        if (this.st > this.stunDur) { this.state = 'idle'; this.st = -10; } break;
      case 'breath': {      // an arc of fire overhead: arches high from the mouth and comes down on the floor - the pocket under it (duck!) is the safe spot
        const T0 = this.tele('breath'), SW = 86, D = this.dir; this.vx = 0;
        if (this.st < T0) {
          if (this.st < T0 - 24) this.faceP();
          this.tell('breath', this.st / T0, [{ type: 'poly', pts: breathOutline(this.x, this.y, D) }]);          // the warning paints the crescent itself; the hollow beneath it stays clear
        } else if (this.st < T0 + SW) {
          const t = this.st - T0, last = BREATH.out.length - 1, i1 = Math.floor(clamp(t / 28, 0, 1) * last), i0 = Math.floor(clamp((t - (SW - 30)) / 30, 0, 1) * last);   // the flame grows out along the arc, then its tail burns away
          if (i0 < i1) {
            for (let n = 0; n < 10; n++) {      // flames scattered through the moon between the two curves
              const i = i0 + Math.floor(Math.random() * (i1 - i0)), k = Math.random(), po = BREATH.out[i], pi = BREATH.inn[i], f = pi[0] + (po[0] - pi[0]) * k, h = pi[1] + (po[1] - pi[1]) * k;
              g.fx.fire(this.x + D * f + rand(-3, 3), this.y - h + 6, { scale: 0.7 + 0.5 * Math.random(), n: 1 });
            }
            const lead = BREATH.out[i1], mid = BREATH.out[Math.floor((i0 + i1) / 2)]; g.fx.glow(this.x + D * lead[0], this.y - lead[1] * 0.7, 22, [1, 0.5, 0.15], 0.5); g.fx.light(this.x + D * mid[0], this.y - mid[1] * 0.7, 140, 1);
            if (t === 0) A.sfx('fire'); if (t % 20 === 0) A.sfx('fire');
            if (this.st % 3 === 0 && breathHits(i0, i1, this.x, this.y, D, p.hurtbox)) p.hurt(9, this.x, { kb: 1.2 });
          }
        } else if (this.st > T0 + SW + 18) { this.state = 'idle'; this.st = -24; } break; }
      case 'leap': {
        const T0 = this.tele('leap');
        if (this.st === 1) { this.tx = clamp(p.x, 70, g.room.pw - 70); A.sfx('roar'); }
        if (this.st < T0) { this.vx = 0; this.dir = this.tx >= this.x ? 1 : -1; this.tell('leap', this.st / T0, [{ type: 'ring', x: this.tx, y: this.y, r: 38 }]); }
        else if (this.st === T0) { this.vy = -6.6; this.vx = clamp((this.tx - this.x) / 62.9, -3.8, 3.8); this.onGround = false; A.sfx('jump'); }
        else if (this.st > T0 + 8 && this.onGround) {
          this.vx = 0; g.shake(6, 20); A.sfx('boom'); g.fx.ring(this.x, this.y - 4, 90, [1, 0.6, 0.2], 26, 0.15);
          g.addProjectile(new Shockwave(this.x - 20, this.y, -1, { dmg: 9, speed: 2.0, life: 70, big: true })); g.addProjectile(new Shockwave(this.x + 20, this.y, 1, { dmg: 9, speed: 2.0, life: 70, big: true }));
          this.state = 'idle'; this.st = -24;
        } else this.warns = [{ type: 'ring', x: this.tx, y: this.y, r: 38 }]; break; }
      case 'pillars':
        this.vx = 0; this.faceP(); if (this.st < 30) this.tell('pillars', this.st / 30);
        if (this.st === 30) { A.sfx('roar'); const base = p.x; for (let i = -1; i <= 1; i++) { const x = clamp(base + i * 70 + (i ? rand(-6, 6) : 0), 30, g.room.pw - 30); g.addProjectile(new Column(x, this.y, 'fire', { warn: 60, active: 28, dmg: 14, w: 34 })); } }
        if (this.st > 130) { this.state = 'idle'; this.st = -16; } break;
    }
  }
  draw(ctx, cx, cy) {
    let id = 'beast_idle', f = Math.floor(this.t / 8) % 6, ox = 0; const st = this.state;
    if (st === 'breath') { id = 'beast_breath'; f = this.st < this.tele('breath') * 0.6 ? 0 : this.st < this.tele('breath') ? 1 : this.st < this.tele('breath') + 86 ? 2 : 3; }
    else if (st === 'charge' && this.st < this.tele('charge')) { id = 'beast_breath'; f = 0; ox = Math.sin(this.t * 2.5) * 1.5 * (this.st / this.tele('charge')); }
    else if (st === 'charge') f = Math.floor(this.t / 3) % 6;
    else if (st === 'leap') { id = 'beast_breath'; f = this.st < this.tele('leap') ? 0 : 2; }
    else if (st === 'stun') { id = 'beast_breath'; f = 3; }
    if (this.dying) { id = 'beast_burn'; f = 1 + Math.min(2, Math.floor(this.dying / 25)); }
    this.spr(ctx, id, f, cx + ox, cy, { flash: this.flashT > 0 });
    if (this.phase === 2 && !this.dying) this.g.fx.glow(this.x + this.dir * -6, this.y - 70, 16, [1, 0.2, 0.1], 0.5);
    this.g.fx.light(this.x, this.y - 50, 80, 0.6);
  }
}

// ============================================================================================== 2. THE PHANTOM STEED (nightmare)
export class BossNightmare extends Boss {
  constructor(g, x, y, o) { super(g, x, y, 84, 54, o); this.hp = this.maxHp = 290; this.dmg = 14; this.xp = 160; this.bossName = 'THE PHANTOM STEED'; this.sub = 'NIGHTMARE OF THE GREAT HALL'; this.dir = -1; this.deathFx = COLORS.blue; this.passes = 0; this.gT = 54; this.tx = x; this.ice = { w: 112, h: 80 }; }
  get spd() { return this.phase === 2 ? 1.2 : 1; }
  dangerous() { return (this.state === 'gallop' && this.st >= this.gT) || (this.state === 'stomp' && this.st >= 50); }
  intro(g) { if (this.st === 8) { A.sfx('roar'); g.shake(4, 40); g.fx.flash([0.4, 0.7, 1], 0.3); g.fx.ring(this.x, this.cy, 120, [0.4, 0.8, 1], 40, 0.1); } this.faceP(); g.fx.fire(this.x + rand(-30, 30), this.y - 40, { scale: 1.1, n: 1, color: 'blue' }); }
  ai(g) {
    const p = g.player, spd = this.spd;
    g.fx.fire(this.x - this.dir * 36, this.y - 46, { scale: 0.9, n: 1, color: 'blue' }); g.fx.light(this.x, this.y - 40, 100, 0.6);
    switch (this.state) {
      case 'idle': this.faceP(); this.vx = approach(this.vx, 0, 0.1); this.planNext(this.phase === 2 ? ['gallop', 'gallop', 'summon', 'stomp'] : ['gallop', 'summon', 'stomp'], Math.round(92 / spd)); break;
      case 'gallop': {
        if (this.st === 1) { this.passes = 0; this.faceP(); this.gT = Math.round(56 / spd); }
        if (this.st < this.gT) {   // windup (the second/third pass gets a shorter, still-marked windup)
          this.vx = 0; if (this.passes === 0 && this.st < this.gT - 24) this.faceP();
          this.tell('gallop', this.st / this.gT, [{ type: 'lane', x0: this.x, x1: this.dir > 0 ? g.room.pw - 20 : 20, y: this.y }]);
          if (this.st === 3) A.sfx('roar'); if (this.st % 5 === 0) g.fx.burst(this.x, this.y - 4, 3, [[0.5, 0.8, 1], [0.1, 0.3, 0.8]], { speed: 1.3, s0: 10, up: 0.6 });
        } else {
          this.vx = this.dir * 4.0 * spd; if (this.st % 6 === 0) A.sfx('step'); if (this.st % 10 === 0) g.addProjectile(new FirePatch(this.x - this.dir * 34, this.y, this.phase === 2 ? 130 : 90, { dmg: 7, color: 'blue', w: 24 }));
          if (this.hitX) {
            this.vx = 0; this.passes++; g.shake(4, 14); A.sfx('boom');
            if (this.passes < (this.phase === 2 ? 3 : 2)) { this.dir *= -1; this.st = this.gT - 40; }
            else { this.state = 'idle'; this.st = -44; }       // winded: open for a counter-attack
          }
        } break; }
      case 'summon':
        this.vx = 0; this.faceP(); if (this.st < 44) this.tell('summon', this.st / 44); if (this.st === 6) A.sfx('roar');
        if (this.st === 44) { const n = this.phase === 2 ? 4 : 3; let cnt = g.enemies.filter(e => e.name === 'fireskull' && !e.dead).length; for (let i = 0; i < n && cnt < 5; i++, cnt++) g.spawnEnemy('fireskull', (g.room.pw / (n + 1)) * (i + 1) / 16, 5, {}); g.fx.flash([0.4, 0.7, 1], 0.2); A.sfx('cast'); }
        if (this.st > 100) { this.state = 'idle'; this.st = -20; } break;
      case 'stomp':
        if (this.st === 1) { this.tx = clamp(p.x, 70, g.room.pw - 70); A.sfx('roar'); }
        if (this.st < 50) { this.vx = 0; this.dir = this.tx >= this.x ? 1 : -1; this.tell('stomp', this.st / 50, [{ type: 'ring', x: this.tx, y: this.y, r: 44 }]); break; }
        if (this.st === 50) { this.vy = -7; this.onGround = false; this.vx = clamp((this.tx - this.x) / 66.7, -3.4, 3.4); A.sfx('jump'); }
        if (this.st > 56 && this.onGround) { this.vx = 0; g.shake(7, 22); A.sfx('boom'); g.fx.ring(this.x, this.y - 4, 100, [0.4, 0.8, 1], 28, 0.15); for (const s of [-1, 1]) g.addProjectile(new Shockwave(this.x + s * 30, this.y, s, { dmg: 10, speed: 2.2, life: 80, big: true, color: COLORS.blue })); this.state = 'idle'; this.st = -30; }
        else this.warns = [{ type: 'ring', x: this.tx, y: this.y, r: 44 }]; break;
    }
  }
  draw(ctx, cx, cy) {
    const moving = (this.state === 'gallop' && this.st >= this.gT) || (this.state === 'stomp' && this.st >= 50);
    const id = moving ? 'nightmare_gallop' : 'nightmare_idle', f = Math.floor(this.t / (moving ? 4 : 9)) % 4;
    const dy = this.state === 'gallop' && this.st < this.gT ? -Math.abs(Math.sin(this.st * 0.2)) * 3 : 0;
    this.spr(ctx, id, f, cx, cy + dy, { flash: this.flashT > 0 });
  }
}

// ============================================================================================== 3. THE SERAPH OF ASH (angel)
export class BossAngel extends Boss {
  constructor(g, x, y, o) { super(g, x, y + 36, 34, 72, o); this.hp = this.maxHp = 340; this.dmg = 14; this.xp = 200; this.bossName = 'THE SERAPH OF ASH'; this.sub = 'FALLEN GUARDIAN OF THE CHAPEL'; this.gravity = false; this.deathFx = COLORS.ice; this.dive = null; this.ice = { w: 84, h: 88 }; }
  get spd() { return this.phase === 2 ? 1.25 : 1; }
  dangerous() { return this.state === 'dive' && this.st >= 44 && this.st < 92; }
  intro(g) { if (this.st === 8) { A.sfx('shriek'); g.shake(3, 40); g.fx.flash([1, 1, 1], 0.5); g.fx.ring(this.x, this.cy, 130, [0.9, 0.95, 1], 40, 0.1); } g.fx.glow(this.x, this.cy, 70, [0.8, 0.9, 1], 0.5); this.faceP(); }
  physics() { this.x += this.vx; this.y += this.vy; const r = this.g.room; this.x = clamp(this.x, 34, r.pw - 34); this.y = clamp(this.y, 70, r.ph - 40); if (this.flashT > 0) this.flashT--; }
  moveTo(tx, ty, k = 0.04, max = 2.2) { this.vx = clamp((tx - this.x) * k, -max, max); this.vy = clamp((ty - this.cy) * k, -max, max); }
  groundY() { return this.g.room.ph - 32; }
  ai(g) {
    const p = g.player, spd = this.spd;
    g.fx.glow(this.x, this.cy, 56 + Math.sin(this.t * 0.1) * 6, [0.85, 0.92, 1], 0.28); g.fx.light(this.x, this.cy, 110, 0.9);
    if (this.t % 7 === 0) g.fx.emit({ x: this.x + rand(-34, 34), y: this.cy + rand(-30, 20), vx: rand(-0.2, 0.2), vy: rand(0.1, 0.4), life: 50, s0: 6, s1: 1, c0: [1, 1, 1], c1: [0.7, 0.8, 1], a0: 1, a1: 0, kind: 6 });
    switch (this.state) {
      case 'idle': this.faceP(); this.moveTo(clamp(p.x + Math.sin(this.t * 0.02) * 80, 60, g.room.pw - 60), 80 + Math.sin(this.t * 0.05) * 12, 0.03);
        this.planNext(this.phase === 2 ? ['feathers', 'strikes', 'dive', 'strikes'] : ['feathers', 'strikes', 'dive'], Math.round(96 / spd)); break;
      case 'feathers': {
        this.faceP(); this.moveTo(this.x, 80, 0.05); const times = this.phase === 2 ? [38, 68, 98] : [38, 72];
        if (this.st < 38) this.tell('feathers', this.st / 38, [{ type: 'line', x0: this.x, y0: this.cy, x1: p.x, y1: p.y - 20 }]);
        if (times.includes(this.st)) { A.sfx('cast'); const base = Math.atan2(p.y - 24 - this.cy, p.x - this.x), n = this.phase === 2 ? 7 : 5; for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.22; g.addProjectile(new Projectile(this.x, this.cy, Math.cos(a) * 2.0, Math.sin(a) * 2.0, 'feather', { dmg: 9, life: 260 })); } g.fx.ring(this.x, this.cy, 40, [0.9, 0.95, 1], 16); }
        if (this.st > times[times.length - 1] + 40) { this.state = 'idle'; this.st = -20; } break; }
      case 'strikes':
        this.moveTo(g.room.pw / 2, 78, 0.04); if (this.st < 18) this.tell('strikes', this.st / 18);
        if (this.st === 18) { A.sfx('shriek'); const waves = this.phase === 2 ? 2 : 1; for (let w = 0; w < waves; w++) for (let i = 0; i < 3; i++) { const x = clamp(w === 0 ? p.x + (i - 1) * 64 + rand(-8, 8) : rand(50, g.room.pw - 50), 30, g.room.pw - 30); g.addProjectile(new Column(x, this.groundY(), 'bolt', { warn: 62 + w * 44, active: 14, dmg: 14, w: 28, h: 220 })); } }
        if (this.st > (this.phase === 2 ? 190 : 130)) { this.state = 'idle'; this.st = -20; } break;
      case 'dive': {
        if (this.st < 20) { this.moveTo(clamp(p.x, 80, g.room.pw - 80) + (p.x < g.room.pw / 2 ? 90 : -90), 66, 0.05); this.faceP(); this.tell('dive', this.st / 44); if (this.st === 2) A.sfx('shriek'); }
        else if (this.st < 44) { this.vx *= 0.8; this.vy *= 0.8; if (this.st === 20) this.dive = { x: p.x, y: p.y - 18 };    // target locks here - you have ~0.4s to move out of the line
          this.tell('dive', this.st / 44, [{ type: 'line', x0: this.x, y0: this.cy, x1: this.dive.x + (this.dive.x - this.x) * 0.6, y1: this.dive.y + (this.dive.y - this.cy) * 0.6 }]); g.fx.ring(this.x, this.cy, 20 + (this.st - 20) * 1.5, [1, 0.9, 0.6], 10, 0.3, 4); }
        else if (this.st === 44) { const a = Math.atan2(this.dive.y - this.cy, this.dive.x - this.x); this.vx = Math.cos(a) * 4.2 * spd; this.vy = Math.sin(a) * 4.2 * spd; A.sfx('slash'); }
        else if (this.st < 92) { g.fx.burst(this.x, this.cy, 2, [[1, 1, 1], [0.6, 0.7, 1]], { speed: 0.5, s0: 20, s1: 4, l0: 12, l1: 22 }); const r = g.room; if (this.cy > r.ph - 70 || this.x < 50 || this.x > r.pw - 50) this.st = 92; }
        else { this.moveTo(this.x, 84, 0.04); this.vx *= 0.9; if (this.st > 120) { this.state = 'idle'; this.st = -30; } } break; }
    }
  }
  draw(ctx, cx, cy) {
    let id = 'angel_idle', f = Math.floor(this.t / 7) % 8; if (this.state === 'feathers' || this.state === 'strikes' || (this.state === 'dive' && this.st < 44)) { id = 'angel_attack'; f = Math.floor(this.t / 6) % 3; }
    drawSheet(ctx, id, f, this.x - cx, this.cy - cy + Math.sin(this.t * 0.08) * 2, { flash: this.flashT > 0, ay: 0.6, scale: 1, dir: this.dir });
  }
}

// ============================================================================================== 4. THE BRAZEN HIEROPHANT  (code id: colossus)
// The master of the Underworks: a giant of the bronze-robed, silver-masked mage (Ars Notoria mage 1, drawn at 1.15).  He hovers a little above the floor; the quake attack lifts him high (the tell), then drops him.
export class BossColossus extends Boss {
  constructor(g, x, y, o) { super(g, x, y, 46, 100, o); this.hp = this.maxHp = 420; this.dmg = 16; this.xp = 260; this.bossName = 'THE BRAZEN HIEROPHANT'; this.sub = 'MASTER OF THE UNDERWORKS'; this.scale = 1.15; this.dir = -1; this.deathFx = COLORS.gold; this.ice = { w: 84, h: 116 }; }
  get spd() { return this.phase === 2 ? 1.25 : 1; }
  intro(g) { if (this.st === 8) { A.sfx('boom'); g.shake(5, 50); g.fx.flash([1, 0.6, 0.3], 0.3); A.sfx('steam'); } if (this.st % 8 === 0) g.fx.smoke(this.x + rand(-20, 20), this.y - 96, 1, { s0: 10, s1: 26, c0: [0.8, 0.82, 0.88], c1: [0.4, 0.42, 0.5], a: 0.4 }); this.faceP(); }
  ai(g) {
    const p = g.player, spd = this.spd, d = Math.abs(this.dx());
    if (this.t % 4 === 0) g.fx.glow(this.x, this.y - 84, 14, [1, 0.62, 0.2], 0.55); g.fx.light(this.x, this.y - 60, 90, 0.6);
    switch (this.state) {
      case 'idle': this.faceP(); this.vx = approach(this.vx, d > 70 ? this.dir * 0.4 * spd : 0, 0.05); if (this.t % 28 === 0 && Math.abs(this.vx) > 0.2) { A.sfx('boom'); g.shake(1, 6); }
        this.planNext(d < 120 ? ['slam', 'slam', 'vents', 'gears'] : ['vents', 'gears', 'slam'], Math.round(92 / spd)); break;
      case 'slam': {
        const T0 = Math.round(54 / spd); this.vx = 0; if (this.st === 1) { this.faceP(); A.sfx('steam'); }
        const hb = { x: this.dir > 0 ? this.x : this.x - 110, y: this.y - 100, w: 110, h: 100 };
        if (this.st < T0) { this.tell('slam', this.st / T0, [{ type: 'rect', ...hb }]); if (this.st % 6 === 0) g.fx.smoke(this.x - this.dir * 10, this.y - 90, 1, { s0: 8, s1: 18, c0: [0.8, 0.85, 0.9], c1: [0.4, 0.45, 0.5], a: 0.35 }); }
        else if (this.st === T0) { A.sfx('boom'); g.shake(8, 22); g.fx.ring(this.x + this.dir * 54, this.y - 4, 70, [1, 0.85, 0.5], 22, 0.15); g.fx.sparks(this.x + this.dir * 54, this.y - 10, 24, COLORS.gold, 5, { gy: 0.2 });
          if (overlap(hb, p.hurtbox)) p.hurt(this.dmg, this.x); for (const s of [-1, 1]) g.addProjectile(new Shockwave(this.x + s * 40, this.y, s, { dmg: 9, speed: 2.0, life: 60, color: COLORS.gold })); }
        else if (this.st > T0 + 50) { this.state = 'idle'; this.st = -10; } break; }     // 50 frames stuck in the floor = your opening
      case 'vents':
        this.vx = 0; if (this.st < 22) this.tell('vents', this.st / 22);
        if (this.st === 22) { A.sfx('steam'); const n = this.phase === 2 ? 4 : 3; for (let i = 0; i < n; i++) { const x = clamp(i === 0 ? p.x : p.x + rand(-130, 130), 30, g.room.pw - 30); g.addProjectile(new Column(x, this.y, 'steam', { warn: 62 + i * 14, active: 44, dmg: 12, w: 30, h: 150 })); } }
        if (this.st > 170) { this.state = 'idle'; this.st = -10; } break;
      case 'gears': {
        this.vx = 0; this.faceP(); const times = this.phase === 2 ? [38, 62, 86] : [38, 66];
        if (this.st < 38) this.tell('gears', this.st / 38);
        if (times.includes(this.st)) { A.sfx('gear'); const vx = clamp((p.x - this.x) / 75, -2.8, 2.8); g.addProjectile(Object.assign(new Projectile(this.x + this.dir * 40, this.y - 80, vx, -3.4, 'gear', { dmg: 12, life: 400, scale: 1.8 }), { w: 18, h: 18 })); g.fx.sparks(this.x + this.dir * 40, this.y - 80, 8, COLORS.gold, 3); }
        if (this.st > times[times.length - 1] + 40) { this.state = 'idle'; this.st = -10; } break; }
    }
  }
  draw(ctx, cx, cy) {
    const T0 = Math.round(54 / this.spd); let id = 'ars_mage1_r0', f = Math.floor(this.t / 9) % 4, lift = 6 + Math.sin(this.t * 0.07) * 3;          // hovers a little above the floor
    if (this.state === 'slam') { id = 'ars_mage1_r1'; f = Math.floor(this.t / 6) % 4; lift = this.st < T0 ? 6 + Math.sin(Math.min(1, this.st / T0) * Math.PI / 2) * 40 : Math.max(0, 6 - (this.st - T0) * 3); }      // rises (the tell), then crashes down on the beat
    else if (this.state === 'gears') { id = 'ars_mage1_r1'; f = Math.floor(this.t / 6) % 4; lift += this.st < 38 ? Math.min(14, this.st * 0.6) : 4; }
    else if (this.state === 'vents') { id = 'ars_mage1_r1'; f = Math.floor(this.t / 8) % 4; }
    this.spr(ctx, id, f, cx, cy + lift, { flash: this.flashT > 0 });
  }
}

// ============================================================================================== 5. THE SHADOW LORD (final)
export class BossShadow extends Boss {
  constructor(g, x, y, o) { super(g, x, y + 44, 50, 88, o); this.hp = this.maxHp = 680; this.dmg = 16; this.xp = 600; this.bossName = 'THE SHADOW LORD'; this.sub = 'WHO TOOK THE SUN'; this.gravity = false; this.dir = -1; this.deathFx = COLORS.purple; this.triggerDist = 260; this.zapT = 0; this.alphaT = 1; this.summonCd = 0; this.ice = { w: 96, h: 100 }; }
  get spd() { return this.phase === 2 ? 1.25 : 1; }
  dangerous() { return this.state === 'slam' && this.st >= 60 && this.st < 80; }
  intro(g) { if (this.st === 6) { A.sfx('roar'); g.shake(6, 70); g.fx.flash([0.6, 0.3, 1], 0.5); g.fx.ring(this.x, this.cy, 160, [0.6, 0.3, 1], 50, 0.1); g.fx.strike(this.x, g.room.ph - 32, { flash: 0.4 }); } this.faceP(); g.fx.glow(this.x, this.cy, 80, [0.5, 0.2, 1], 0.4); }
  physics() { this.x += this.vx; this.y += this.vy; const r = this.g.room; this.x = clamp(this.x, 50, r.pw - 50); this.y = clamp(this.y, 90, r.ph - 32); if (this.flashT > 0) this.flashT--; }
  moveTo(tx, ty, k = 0.04, max = 2) { this.vx = clamp((tx - this.x) * k, -max, max); this.vy = clamp((ty - this.cy) * k, -max, max); }
  onPhase2() { super.onPhase2(); const g = this.g; g.fx.setAmbient(0.8, [0.03, 0, 0.06], 0.9); g.banner('THE ECLIPSE', 'DARKNESS FALLS'); g.fx.setStorm(true, 0); }
  ai(g) {
    const p = g.player, spd = this.spd, gy = g.room.ph - 34;
    g.fx.glow(this.x, this.cy, 64 + Math.sin(this.t * 0.07) * 6, [0.45, 0.2, 0.9], 0.25); g.fx.light(this.x, this.cy, this.phase === 2 ? 70 : 120, 0.8);
    if (this.t % 5 === 0) g.fx.emit({ x: this.x + rand(-26, 26), y: this.cy + rand(0, 40), vx: rand(-0.2, 0.2), vy: -rand(0.2, 0.8), life: 60, s0: 8, s1: 2, c0: [0.5, 0.25, 1], c1: [0.1, 0.0, 0.3], a0: 0.8, a1: 0, kind: 2 });
    if (this.phase === 2 && --this.zapT <= 0) { this.zapT = 150 + rand(60); g.addProjectile(new Column(clamp(p.x + rand(-80, 80), 30, g.room.pw - 30), g.room.ph - 32, 'bolt', { warn: 46, active: 12, dmg: 14, w: 26, h: 240 })); }   // eclipse: random sky bolts (marked on the floor first)
    if (this.summonCd > 0) this.summonCd--;
    switch (this.state) {
      case 'idle': this.faceP(); this.alphaT = 1; this.moveTo(clamp(p.x + Math.sin(this.t * 0.02) * 110, 70, g.room.pw - 70), 96 + Math.sin(this.t * 0.04) * 14, 0.025);
        { const opts = ['skulls', 'breath', 'slam']; if (this.summonCd === 0) opts.push('summon'); if (this.phase === 2) opts.push('skulls', 'slam'); this.planNext(opts, Math.round(90 / spd)); } break;
      case 'skulls': {
        this.faceP(); this.moveTo(this.x, 100, 0.05); const T0 = this.phase === 2 ? [40, 68, 96] : [40, 74];
        if (this.st < 40) this.tell('skulls', this.st / 40, [{ type: 'line', x0: this.x, y0: this.cy, x1: p.x, y1: p.y - 20 }]);
        if (T0.includes(this.st)) { A.sfx('cast'); const base = Math.atan2(p.y - 24 - this.cy, p.x - this.x), n = this.phase === 2 ? 5 : 4; for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.26, sp = 1.4 + (i % 2) * 0.35; g.addProjectile(new Projectile(this.x + this.dir * 20, this.cy - 10, Math.cos(a) * sp, Math.sin(a) * sp, 'skull', { dmg: 12, life: 300 })); } g.fx.ring(this.x + this.dir * 20, this.cy - 10, 36, [0.4, 0.9, 1], 16); }
        if (this.st > T0[T0.length - 1] + 40) { this.state = 'idle'; this.st = -20; } break; }
      case 'breath': {
        const side = this.side === undefined || this.st === 1 ? (p.x < g.room.pw / 2 ? 1 : -1) : this.side; this.side = side;
        if (this.st < 30) { this.moveTo(side > 0 ? 80 : g.room.pw - 80, 130, 0.06); this.faceP(); }
        else if (this.st < 62) {                       // windup: sweep zone shown, boss holds still
          this.vx = this.vy = 0; this.faceP(); const mx = this.x + this.dir * 44, my = this.cy - 4, L = 190, a0 = 0.55, a1 = -0.05, pt = a => [mx + Math.cos(a) * this.dir * L, my + Math.sin(a) * L];
          this.tell('breath', (this.st - 30) / 32, [{ type: 'poly', pts: [[mx, my], pt(a0), pt(a1)] }]);
        } else if (this.st < 142) {
          this.vx = this.vy = 0; this.faceP(); const s = (this.st - 62) / 80, a = 0.55 - 0.6 * s, mx = this.x + this.dir * 44, my = this.cy - 4, ang = this.dir > 0 ? a : Math.PI - a;
          g.fx.jet(mx, my, ang, [[0.6, 1, 1], [0.1, 0.5, 1]], { n: 6, speed: 6, size: 28, spread: 0.08 }); g.fx.light(mx + Math.cos(ang) * 60, my + Math.sin(ang) * 60, 130, 1); if (this.st === 62 || this.st % 20 === 0) A.sfx('fire');
          if (this.st % 4 === 0) for (let k = 1; k <= 6; k++) { const hx = mx + Math.cos(ang) * k * 24, hy = my + Math.sin(ang) * k * 24; if (overlap({ x: hx - 13, y: hy - 13, w: 26, h: 26 }, p.hurtbox)) { p.hurt(12, this.x, { kb: 1.4 }); break; } }
        } else { this.state = 'idle'; this.st = -30; this.side = undefined; } break; }
      case 'slam':
        if (this.st < 28) { this.alphaT = Math.max(0.1, 1 - this.st / 20); this.moveTo(this.x, this.y - this.h / 2 - 20, 0.02); this.tell('slam', this.st / 60); if (this.st === 2) A.sfx('ghost'); }
        else if (this.st === 28) { this.x = clamp(p.x, 70, g.room.pw - 70); this.y = 110 + 44; this.vx = this.vy = 0; }
        else if (this.st < 60) { this.alphaT = Math.min(1, (this.st - 28) / 14); if (this.st < 52) this.x += (p.x - this.x) * 0.03;      // tracks you, then commits for the last 8 frames
          this.tell('slam', this.st / 60, [{ type: 'ring', x: this.x, y: gy + 2, r: 44 }]); if (this.st % 4 === 0) g.fx.ring(this.x, gy, 8 + (60 - this.st), [0.7, 0.4, 1], 10, 0.3, 4); }
        else if (this.st < 78) { this.vy = 7; this.vx = 0; this.warns = [{ type: 'ring', x: this.x, y: gy + 2, r: 44 }]; if (this.y >= g.room.ph - 32 - 3) { this.vy = 0; this.st = 78; } }
        else if (this.st === 78) { A.sfx('boom'); g.shake(8, 24); g.fx.ring(this.x, gy, 110, [0.7, 0.4, 1], 28, 0.15); for (const s of [-1, 1]) { g.addProjectile(new Shockwave(this.x + s * 20, g.room.ph - 32, s, { dmg: 11, speed: 2.4, life: 90, big: true, color: COLORS.purple })); g.addProjectile(new Column(this.x + s * 80, g.room.ph - 32, 'shadow', { warn: 30, active: 26, dmg: 12, w: 28, h: 100 })); } }
        else if (this.st > 126) { this.state = 'idle'; this.st = -20; } this.alphaT = this.st > 60 ? 1 : this.alphaT; break;
      case 'summon':
        this.moveTo(g.room.pw / 2, 100, 0.04); this.faceP(); if (this.st < 40) this.tell('summon', this.st / 40);
        if (this.st === 40) { A.sfx('roar'); g.fx.flash([0.5, 0.2, 1], 0.3); const cnt = g.enemies.filter(e => !e.isBoss && !e.dead).length; if (cnt < 4) { g.spawnEnemy('wraith', 5, 7); g.spawnEnemy('wraith', g.room.w - 6, 7); if (this.phase === 2) g.spawnEnemy('bat', g.room.w / 2, 5); } this.summonCd = 600; }
        if (this.st > 100) { this.state = 'idle'; this.st = -20; } break;
    }
  }
  draw(ctx, cx, cy) {
    let id = 'demon_idle', f = Math.floor(this.t / 9) % 6;
    if (this.state === 'breath' && this.st >= 30) { id = 'demon_attack'; f = this.st < 62 ? clamp(Math.floor((this.st - 30) / 32 * 6), 0, 5) : 6 + Math.floor(this.t / 4) % 5; }
    // the body sits ~18px above the bottom of the idle cell and ~27px above the bottom of the attack cell
    drawSheet(ctx, id, f, this.x - cx, this.y - cy + Math.sin(this.t * 0.06) * 3, { dir: this.dir, flash: this.flashT > 0, ay: 1, dy: id === 'demon_attack' ? 27 : 18, alpha: this.alphaT < 1 ? this.alphaT : undefined });
  }
}


// ============================================================================================== 6. THE CINDER WARDEN (the burning village)
// The first boss: a horned staff-bearer wreathed in the fires he set.  Easy to read - EMBER VOLLEY (arcing fireballs), STAFF SLAM (a marked box in front of him, then shockwaves),
// LEAP (the landing spot is ringed) and, once he is hurt, FLAME PILLARS.
export class BossCinder extends Boss {
  constructor(g, x, y, o) { super(g, x, y, 40, 84, o); this.hp = this.maxHp = 160; this.dmg = 10; this.xp = 90; this.bossName = 'THE CINDER WARDEN'; this.sub = 'WHO SET THE VILLAGE ALIGHT'; this.scale = 0.95; this.dir = -1; this.deathFx = COLORS.fire; this.tx = x; this.ice = { w: 80, h: 100 }; }
  get spd() { return this.phase === 2 ? 1.2 : 1; }
  tele(k) { return Math.round({ embers: 52, slam: 56, leap: 52 }[k] / this.spd); }
  dangerous() { return (this.state === 'slam' && this.st >= this.tele('slam') && this.st < this.tele('slam') + 12) || (this.state === 'leap' && this.st >= this.tele('leap')); }
  intro(g) { if (this.st === 8) { A.sfx('roar'); g.shake(4, 40); g.fx.flash([1, 0.5, 0.2], 0.3); g.fx.ring(this.x, this.cy, 110, [1, 0.5, 0.2], 40, 0.1); } if (this.st % 4 === 0) g.fx.fire(this.x + rand(-18, 18), this.y - 10, { scale: 1.0, n: 1 }); this.faceP(); }
  ai(g) {
    const p = g.player, spd = this.spd, d = Math.abs(this.dx());
    if (this.t % 5 === 0) g.fx.fire(this.x + rand(-14, 14), this.y - rand(8, 60), { scale: 0.5, n: 1 }); g.fx.light(this.x, this.y - 40, 90, 0.6);
    switch (this.state) {
      case 'idle':
        this.faceP(); this.vx = approach(this.vx, d > 110 ? this.dir * 0.7 : 0, 0.06);
        this.planNext(this.phase === 2 ? ['embers', 'slam', 'leap', 'pillars'] : ['embers', 'slam', 'leap'], Math.round(90 / spd)); break;
      case 'embers': {
        const T0 = this.tele('embers'); this.vx = 0; this.faceP();
        if (this.st < T0) { this.tell('embers', this.st / T0, [{ type: 'line', x0: this.x, y0: this.y - 60, x1: p.x, y1: p.y - 20 }]); g.fx.glow(this.x + this.dir * 16, this.y - 76, 8 + this.st * 0.4, [1, 0.5, 0.15], 0.5); }
        else if (this.st === T0 || (this.phase === 2 && (this.st === T0 + 16 || this.st === T0 + 32))) {
          A.sfx('fire'); const base = Math.atan2(p.y - 24 - (this.y - 70), p.x - this.x), n = 3;
          for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.24 - 0.12, sp = 2.3 + i * 0.25; g.addProjectile(new Projectile(this.x + this.dir * 22, this.y - 70, Math.cos(a) * sp, Math.sin(a) * sp, 'ember', { dmg: 8, scale: 1.5, grav: 0.045, life: 220 })); }
          g.fx.ring(this.x + this.dir * 22, this.y - 70, 30, [1, 0.5, 0.2], 14);
        } else if (this.st > T0 + (this.phase === 2 ? 56 : 34)) { this.state = 'idle'; this.st = -16; } break; }
      case 'slam': {
        const T0 = this.tele('slam'); this.vx = 0; if (this.st === 1) this.faceP();
        const hb = { x: this.dir > 0 ? this.x : this.x - 96, y: this.y - 72, w: 96, h: 72 };
        if (this.st < T0) this.tell('slam', this.st / T0, [{ type: 'rect', ...hb }]);
        else if (this.st === T0) {
          A.sfx('boom'); g.shake(6, 18); g.fx.ring(this.x + this.dir * 56, this.y - 4, 60, [1, 0.6, 0.2], 20, 0.15); g.fx.sparks(this.x + this.dir * 56, this.y - 8, 18, COLORS.fire, 4, { gy: 0.2 });
          if (overlap(hb, p.hurtbox)) p.hurt(this.dmg + 2, this.x); for (const sd of [-1, 1]) g.addProjectile(new Shockwave(this.x + sd * 36, this.y, sd, { dmg: 8, speed: 2.0, life: 50, big: true }));
        } else if (this.st > T0 + 44) { this.state = 'idle'; this.st = -10; } break; }
      case 'leap': {
        const T0 = this.tele('leap');
        if (this.st === 1) { this.tx = clamp(p.x, 70, g.room.pw - 70); A.sfx('roar'); }
        if (this.st < T0) { this.vx = 0; this.dir = this.tx >= this.x ? 1 : -1; this.tell('leap', this.st / T0, [{ type: 'ring', x: this.tx, y: this.y, r: 38 }]); }
        else if (this.st === T0) { this.vy = -6.4; this.vx = clamp((this.tx - this.x) / 61, -3.8, 3.8); this.onGround = false; A.sfx('jump'); }
        else if (this.st > T0 + 8 && this.onGround) { this.vx = 0; g.shake(6, 20); A.sfx('boom'); g.fx.ring(this.x, this.y - 4, 90, [1, 0.6, 0.2], 26, 0.15); for (const sd of [-1, 1]) g.addProjectile(new Shockwave(this.x + sd * 20, this.y, sd, { dmg: 8, speed: 2.0, life: 66, big: true })); this.state = 'idle'; this.st = -26; }
        else this.warns = [{ type: 'ring', x: this.tx, y: this.y, r: 38 }];
        break; }
      case 'pillars':
        this.vx = 0; this.faceP(); if (this.st < 30) this.tell('pillars', this.st / 30);
        if (this.st === 30) { A.sfx('roar'); const base = p.x; for (let i = -1; i <= 1; i++) { const x = clamp(base + i * 70 + (i ? rand(-6, 6) : 0), 30, g.room.pw - 30); g.addProjectile(new Column(x, this.y, 'fire', { warn: 64, active: 26, dmg: 12, w: 34 })); } }
        if (this.st > 130) { this.state = 'idle'; this.st = -16; } break;
    }
  }
  draw(ctx, cx, cy) {
    const T = this.tele(this.state === 'embers' ? 'embers' : this.state === 'slam' ? 'slam' : 'leap'); let id = 'ars_gnu_r0', f = Math.floor(this.t / 12) % 5, dx = 0;
    if (this.dying) { id = 'ars_gnu_r3'; f = this.dying > 50 ? 1 : 0; }
    else if (this.state === 'embers') { id = 'ars_gnu_r2'; f = this.st < T * 0.55 ? 0 : 1; }
    else if (this.state === 'slam') { id = 'ars_gnu_r2'; f = this.st < T * 0.6 ? 0 : this.st < T ? 1 : this.st < T + 6 ? 2 : this.st < T + 26 ? 3 : 4; dx = this.st >= T && this.st < T + 6 ? this.dir * 4 : 0; }
    else if (this.state === 'leap') { id = 'ars_gnu_r2'; f = this.st < T ? 0 : 2; }
    else if (this.state === 'pillars') { id = 'ars_gnu_r2'; f = this.st < 30 ? 0 : 1; }
    else if (Math.abs(this.vx) > 0.15) { id = 'ars_gnu_r1'; f = Math.floor(this.t / 8) % 5; }
    this.spr(ctx, id, f, cx, cy + 1, { dx, flash: this.flashT > 0 });
    this.g.fx.light(this.x, this.y - 44, 70, 0.5);
  }
}

// ============================================================================================== 7. THE MIRE MOTHER (the weeping swamp)
// A floating, many-tentacled head.  TENTACLES erupt from marked holes in the ground (stay out of the circles), SPORE BURST is a slow fan of poison orbs, SUMMONS calls swamp spiders.
export class BossBramble extends Boss {
  constructor(g, x, y, o) { super(g, x, y + 36, 36, 70, o); this.hp = this.maxHp = 260; this.dmg = 12; this.xp = 150; this.bossName = 'THE MIRE MOTHER'; this.sub = 'WHAT THE SWAMP DREAMS'; this.scale = 1.05; this.gravity = false; this.dir = -1; this.deathFx = COLORS.green; this.ice = { w: 76, h: 96 }; }
  get spd() { return this.phase === 2 ? 1.25 : 1; }
  intro(g) { if (this.st === 8) { A.sfx('shriek'); g.shake(3, 40); g.fx.flash([0.4, 1, 0.5], 0.4); g.fx.ring(this.x, this.cy, 120, [0.4, 1, 0.5], 40, 0.1); } g.fx.glow(this.x, this.cy, 70, [0.4, 1, 0.5], 0.4); this.faceP(); }
  physics() { this.x += this.vx; this.y += this.vy; const r = this.g.room; this.x = clamp(this.x, 34, r.pw - 34); this.y = clamp(this.y, 70, r.ph - 40); if (this.flashT > 0) this.flashT--; }
  moveTo(tx, ty, k = 0.04, max = 2) { this.vx = clamp((tx - this.x) * k, -max, max); this.vy = clamp((ty - this.cy) * k, -max, max); }
  groundY() { return this.g.room.ph - 32; }
  ai(g) {
    const p = g.player, spd = this.spd;
    g.fx.glow(this.x, this.cy, 52 + Math.sin(this.t * 0.09) * 6, [0.4, 1, 0.5], 0.2); g.fx.light(this.x, this.cy, 100, 0.7);
    if (this.t % 9 === 0) g.fx.emit({ x: this.x + rand(-26, 26), y: this.cy + rand(-10, 30), vx: rand(-0.15, 0.15), vy: rand(0.1, 0.4), life: 50, s0: 5, s1: 1, c0: [0.5, 1, 0.5], c1: [0.2, 0.5, 0.3], a0: 0.9, a1: 0, kind: 6 });
    switch (this.state) {
      case 'idle': this.faceP(); this.moveTo(clamp(p.x + Math.sin(this.t * 0.02) * 90, 60, g.room.pw - 60), 86 + Math.sin(this.t * 0.05) * 12, 0.03);
        this.planNext(this.phase === 2 ? ['tentacles', 'spores', 'tentacles', 'summon'] : ['tentacles', 'spores', 'summon'], Math.round(94 / spd)); break;
      case 'tentacles': {
        this.moveTo(this.x, 84, 0.05); this.faceP(); if (this.st < 24) this.tell('tentacles', this.st / 24);
        if (this.st === 24) { A.sfx('shriek'); const n = this.phase === 2 ? 4 : 3; for (let i = 0; i < n; i++) { const x = clamp(i === 0 ? p.x : p.x + rand(-140, 140), 30, g.room.pw - 30); g.addProjectile(new Column(x, this.groundY(), 'tentacle', { warn: 54 + i * 12, active: 40, dmg: 11, w: 22, h: 90 })); } }
        if (this.st > (this.phase === 2 ? 150 : 128)) { this.state = 'idle'; this.st = -16; } break; }
      case 'spores': {
        this.faceP(); this.moveTo(this.x, 90, 0.05); const T0 = this.phase === 2 ? [40, 72] : [40];
        if (this.st < 40) this.tell('spores', this.st / 40, [{ type: 'line', x0: this.x, y0: this.cy, x1: p.x, y1: p.y - 20 }]);
        if (T0.includes(this.st)) { A.sfx('cast'); const base = Math.atan2(p.y - 24 - this.cy, p.x - this.x), n = this.phase === 2 ? 5 : 4; for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.3; g.addProjectile(new Projectile(this.x, this.cy, Math.cos(a) * 1.5, Math.sin(a) * 1.5, 'spore', { dmg: 9, life: 280 })); } g.fx.ring(this.x, this.cy, 36, [0.4, 1, 0.5], 16); }
        if (this.st > T0[T0.length - 1] + 40) { this.state = 'idle'; this.st = -20; } break; }
      case 'summon':
        this.moveTo(g.room.pw / 2, 90, 0.04); this.faceP(); if (this.st < 40) this.tell('summon', this.st / 40);
        if (this.st === 40) { A.sfx('roar'); g.fx.flash([0.4, 1, 0.5], 0.25); const cnt = g.enemies.filter(e => !e.isBoss && !e.dead).length, row = Math.floor(g.room.ph / 16) - 2; if (cnt < 4) { g.spawnEnemy('swampspider', 5, row, {}); g.spawnEnemy('swampspider', g.room.w - 6, row, {}); if (this.phase === 2) g.spawnEnemy('swampspider', Math.round(g.room.w / 2), row, {}); } }
        if (this.st > 104) { this.state = 'idle'; this.st = -20; } break;
    }
  }
  draw(ctx, cx, cy) {
    let id = 'ars_andromalius_r0', f = Math.floor(this.t / 8) % 8; if (this.state === 'tentacles' || this.state === 'spores' || this.state === 'summon') { id = 'ars_andromalius_r2'; f = 4 + Math.floor(this.t / 6) % 4; }
    drawSheet(ctx, id, f, this.x - cx, this.cy - cy + Math.sin(this.t * 0.07) * 2, { flash: this.flashT > 0, ay: 0.55, scale: this.scale, dir: this.dir });
  }
}

// ============================================================================================== 8. THE CRIMSON COUNT (an optional lair behind a door in the Nave)
// A vampire lord in crimson armour (sprites: xxg_4_free).  BLOOD LUNGE: he crouches, then dashes through the air where you stand with his blade.  BLOOD BOLTS: a fan of crimson orbs.
// MIST STEP: he dissolves and returns behind you with a slash (the ring on the floor shows where).  In the second half he also LEAPS onto where you stand, and is quicker.
export class BossVampire extends Boss {
  constructor(g, x, y, o) {
    super(g, x, y, 26, 66, o); this.hp = this.maxHp = 200; this.dmg = 12; this.xp = 120; this.bossName = 'THE CRIMSON COUNT'; this.sub = 'WHO DRINKS THE DARK'; this.dir = -1; this.deathFx = COLORS.red; this.ice = { w: 56, h: 84 };
    this.live = false; this.hitDone = false; this.tx = x;
  }
  get spd() { return this.phase === 2 ? 1.2 : 1; }
  tele(k) { return Math.round({ lunge: 52, bolts: 50, mist: 46, leap: 54 }[k] / this.spd); }
  dangerous() { return this.live; }
  intro(g) {
    if (this.st === 8) { A.sfx('roar'); g.shake(3, 36); g.fx.flash([0.9, 0.1, 0.2], 0.3); g.fx.ring(this.x, this.cy, 100, [1, 0.2, 0.3], 40, 0.1); g.fx.burst(this.x, this.cy, 24, [[0.8, 0.05, 0.12], [0.15, 0, 0.05]], { speed: 3, s0: 14, up: 0.4 }); }
    this.faceP();
  }
  swordBox(reach = 58) { return { x: this.dir > 0 ? this.x - 4 : this.x - reach + 4, y: this.y - 66, w: reach, h: 58 }; }
  strike(g, extra = 0) { const p = g.player; if (!this.hitDone && overlap(this.swordBox(), p.hurtbox)) { this.hitDone = true; p.hurt(this.dmg + extra, this.x); } }
  ai(g) {
    const p = g.player, spd = this.spd, d = Math.abs(this.dx()); this.live = false;
    if (this.t % 6 === 0 && this.alpha > 0.5) g.fx.emit({ x: this.x + rand(-12, 12), y: this.y - rand(6, 60), vx: rand(-0.2, 0.2), vy: -rand(0.2, 0.6), life: 30, s0: 6, s1: 1, c0: [0.7, 0.05, 0.12], c1: [0.2, 0, 0.05], a0: 0.7, a1: 0, kind: 6 });     // a faint crimson haze
    g.fx.light(this.x, this.y - 40, 70, 0.4 * this.alpha);
    switch (this.state) {
      case 'idle':
        this.alpha = 1; this.faceP(); this.vx = approach(this.vx, d > 130 ? this.dir * 1.1 : d < 56 ? -this.dir * 0.8 : 0, 0.06);
        this.planNext(this.phase === 2 ? ['lunge', 'bolts', 'mist', 'leap'] : ['lunge', 'bolts', 'mist'], Math.round(80 / spd)); break;
      case 'lunge': {
        const T0 = this.tele('lunge'), run = 30, sp = this.phase === 2 ? 6.2 : 5.2;
        if (this.st < T0) { this.vx = 0; if (this.st === 1) { this.faceP(); this.hitDone = false; } this.tell('lunge', this.st / T0, [{ type: 'lane', x0: this.x, x1: this.x + this.dir * sp * run, y: this.y }]); }
        else if (this.st < T0 + run) { if (this.st === T0) { A.sfx('dash'); g.fx.ring(this.x, this.cy, 40, [1, 0.2, 0.3], 14, 0.2); } this.vx = this.dir * sp; this.live = true; this.strike(g, 3); g.fx.emit({ x: this.x - this.dir * 10, y: this.y - rand(8, 56), vx: -this.dir * 0.6, vy: rand(-0.2, 0.2), life: 14, s0: 10, s1: 2, c0: [0.9, 0.1, 0.2], c1: [0.3, 0, 0.1], a0: 0.8, a1: 0, kind: 0 }); }
        else { this.vx = approach(this.vx, 0, 0.5); if (this.st > T0 + run + 26) { this.state = 'idle'; this.st = -10; } }
        break; }
      case 'bolts': {
        const T0 = this.tele('bolts'); this.vx = 0; this.faceP();
        if (this.st < T0) { this.tell('bolts', this.st / T0, [{ type: 'line', x0: this.x, y0: this.y - 46, x1: p.x, y1: p.y - 20 }]); g.fx.glow(this.x + this.dir * 20, this.y - 40, 8 + this.st * 0.35, [1, 0.1, 0.2], 0.5); }
        else if (this.st === T0 || (this.phase === 2 && this.st === T0 + 18)) {
          A.sfx('cast'); const n = this.st === T0 ? (this.phase === 2 ? 5 : 3) : 3, base = Math.atan2(p.y - 24 - (this.y - 46), p.x - this.x);
          for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.22, sp = 2.4 + (i % 2) * 0.3; g.addProjectile(new Projectile(this.x + this.dir * 24, this.y - 46, Math.cos(a) * sp, Math.sin(a) * sp, 'blood', { dmg: 8, life: 220 })); }
          g.fx.ring(this.x + this.dir * 24, this.y - 46, 26, [1, 0.15, 0.25], 14);
        } else if (this.st > T0 + (this.phase === 2 ? 40 : 26)) { this.state = 'idle'; this.st = -12; }
        break; }
      case 'mist': {
        const T0 = this.tele('mist'), V = 16;                                   // T0: the warning, then V steps as a cloud, then a slash behind you
        if (this.st === 1) { const side = p.dir > 0 ? -1 : 1; this.tx = clamp(p.x + side * 72, 50, g.room.pw - 50); this.hitDone = false; }
        if (this.st < T0) { this.vx = 0; this.faceP(); this.tell('mist', this.st / T0, [{ type: 'ring', x: this.tx, y: this.y, r: 34 }]); }
        else if (this.st < T0 + V) {
          if (this.st === T0) { A.sfx('flap'); g.fx.burst(this.x, this.cy, 22, [[0.55, 0.05, 0.12], [0.12, 0, 0.06]], { speed: 2.4, s0: 16, up: 0.3 }); this.invuln = true; this.harmless = true; }
          this.vx = 0; this.alpha = Math.max(0, 1 - (this.st - T0) / 6);
          if (this.st === T0 + V - 1) { this.x = this.tx; this.dir = p.x >= this.x ? 1 : -1; g.fx.burst(this.x, this.cy, 22, [[0.55, 0.05, 0.12], [0.12, 0, 0.06]], { speed: 2.4, s0: 16, up: 0.3 }); A.sfx('flap'); }
        } else if (this.st < T0 + V + 18) {
          this.invuln = false; this.harmless = false; this.faceP(); this.alpha = Math.min(1, (this.st - T0 - V) / 6);
          if (this.st >= T0 + V + 8) { this.live = true; this.strike(g, 2); if (this.st === T0 + V + 8) { A.sfx('slash'); g.fx.ring(this.x + this.dir * 28, this.y - 36, 30, [1, 0.2, 0.3], 12, 0.2); } }
        } else { this.alpha = 1; if (this.st > T0 + V + 18 + 22) { this.state = 'idle'; this.st = -10; } }
        break; }
      case 'leap': {
        const T0 = this.tele('leap');
        if (this.st === 1) { this.tx = clamp(p.x, 60, g.room.pw - 60); this.hitDone = false; }
        if (this.st < T0) { this.vx = 0; this.dir = this.tx >= this.x ? 1 : -1; this.tell('leap', this.st / T0, [{ type: 'ring', x: this.tx, y: this.y, r: 38 }]); }
        else if (this.st === T0) { this.vy = -6.2; this.vx = clamp((this.tx - this.x) / 58, -3.8, 3.8); this.onGround = false; A.sfx('jump'); }
        else if (this.st > T0 + 8 && this.onGround) { this.vx = 0; g.shake(5, 16); A.sfx('boom'); g.fx.ring(this.x, this.y - 4, 70, [1, 0.2, 0.3], 22, 0.15); g.fx.burst(this.x, this.y - 4, 16, [[0.6, 0.05, 0.12], [0.15, 0, 0.06]], { speed: 2.4, s0: 14, up: 0.6 }); if (Math.abs(g.player.x - this.x) < 42 && Math.abs(g.player.y - this.y) < 30) g.player.hurt(this.dmg + 2, this.x); this.state = 'idle'; this.st = -24; }
        else { this.live = true; this.warns = [{ type: 'ring', x: this.tx, y: this.y, r: 38 }]; }
        break; }
    }
  }
  draw(ctx, cx, cy) {
    const T = this.tele(this.state === 'bolts' ? 'bolts' : this.state === 'mist' ? 'mist' : this.state === 'leap' ? 'leap' : 'lunge'); let id = 'vampire_idle', f = Math.floor(this.t / 9) % 6;
    if (this.dying) { if (this.dying < 54) { id = 'vampire_hurt'; f = Math.min(3, Math.floor(this.dying / 14)); } else { id = 'vampire_dead'; f = Math.min(2, Math.floor((this.dying - 54) / 16)); } }
    else if (this.state === 'lunge') { id = 'vampire_atk'; f = this.st < T * 0.5 ? 0 : this.st < T ? 1 : this.st < T + 14 ? 2 : 3; }
    else if (this.state === 'bolts') { id = 'vampire_atk'; f = this.st < T * 0.55 ? 0 : this.st < T ? 1 : 2; }
    else if (this.state === 'mist') { id = this.st < T + 16 ? 'vampire_idle' : 'vampire_atk'; f = this.st < T + 16 ? 0 : this.st < T + 16 + 8 ? 1 : this.st < T + 16 + 14 ? 2 : 3; }
    else if (this.state === 'leap') { id = 'vampire_jump'; f = this.st < T * 0.6 ? 0 : this.st < T ? 1 : !this.onGround ? (this.vy < -2.5 ? 2 : this.vy < 0 ? 3 : this.vy < 2 ? 4 : 5) : 6; }
    else if (Math.abs(this.vx) > 0.2) { id = 'vampire_run'; f = Math.floor(this.t / 6) % 5; }
    this.spr(ctx, id, f, cx, cy + 1, { dy: 1, flash: this.flashT > 0 });
  }
}

// ============================================================================================== THE REFLECTION (the Mirror Room's optional boss)
// The mirror on the back wall shows you, mirrored across its middle.  Walk in front of it and meet your reflection in the middle: the glass cracks, the reflection turns silver and violet and crashes out to fight you: with a SWORD (a two-blow combo, three in the
// second half), a SHADOW DASH that cuts as it ends, a LEAP (second half), and the very same things you can carry - DAGGERS (flat: duck under them), an AXE and a TORCH and HOLY WATER (lobbed at where you
// stand: the landing spot is marked), a homing MAGIC ARROW (cut it down, or outrun it) - and it will bind its wounds with a BANDAGE if it can find a quiet moment (that is your opening).
// While it is still a reflection it IS the boss: its position tracks yours mirrored across the glass (x = 2 * axis - yours) and it draws itself clipped to the glass (see mirror.js).
const TOSS = new Set(['dagger', 'axe', 'torch', 'marrow', 'holy']), LOB = { axe: [46, 3.4], torch: [42, 3], holy: [39, 3] };          // LOB: [frames in the air, fastest sideways speed]
const P1 = ['slash', 'slash', 'dash', 'dagger', 'axe', 'torch', 'marrow', 'holy'], P2 = ['slash', 'slash', 'dash', 'dash', 'dagger', 'axe', 'torch', 'marrow', 'holy', 'leap'];
export class BossMirror extends Boss {
  constructor(g, x, y, o) {
    super(g, x, y, HPW, HPH, o); this.hp = this.maxHp = 230; this.dmg = 12; this.xp = 150; this.bossName = 'THE REFLECTION'; this.sub = 'WHAT THE GLASS KEPT'; this.dir = -1; this.deathFx = [[0.85, 0.85, 1], [0.3, 0.2, 0.6]]; this.ice = { w: 30, h: 56 };
    this.mv = g.mirrorView; this.axis = this.mv ? this.mv.m.axis : x; this.triggerDist = 26; this.name = 'twin';
    this.reflecting = true; this.evil = 0; this.hold = null; this.live = false; this.hitDone = false; this.blow = 0; this.bt = 0; this.tx = x; this.trail = []; this.heals = 0; this.thrown = 0; this.lastToss = -99; this.hi = false;
  }
  get spd() { return this.phase === 2 ? 1.18 : 1; }
  tele(k) { return Math.round({ slash: 46, dash: 50, dagger: 46, axe: 48, torch: 48, marrow: 46, holy: 48, leap: 54, bandage: 34 }[k] / this.spd); }
  dangerous() { return this.live; }
  physics() { if (this.reflecting) return; super.physics(); }                 // (inside the glass it has no body: nothing pushes it about)
  update() {
    if (!this.active) {
      const g = this.g, p = g.player; this.t++;
      this.x = 2 * this.axis - p.x; this.y = p.y; this.dir = -p.dir; this.vx = this.vy = 0;                  // the reflection: it IS the boss, standing in the glass and doing what you do
      if (!g.save.flags['boss_' + g.room.id] && Math.abs(p.x - this.axis) < this.triggerDist && p.onGround && !p.dead && g.state === 'play' && !g.cutscene) this.start();
      return;
    }
    super.update();
  }
  intro(g) {
    const st = this.st, p = g.player, mv = this.mv, m = mv ? mv.m : null;
    if (st < 26) { this.x = 2 * this.axis - p.x; this.y = p.y; this.dir = -p.dir; } else if (this.reflecting) { this.dir = p.x >= this.x ? 1 : -1; if (st === 26) this.hold = p.frameInfo(); }          // (it stops copying you, and looks at you)
    if (st === 1) { if (mv) mv.startCrack(this.x, this.y - 22); A.sfx('crack'); g.shake(2, 50); g.fx.flash([0.7, 0.8, 1], 0.2); }
    if (st < 56) {
      const k = st / 56; if (mv) mv.cr = k; this.evil = k * k; if (mv) g.fx.light(this.x, this.y - 20, 70, 0.6 * k, [1, 0.2, 0.3]);
      if (st === 18 || st === 34 || st === 46) { A.sfx('crack'); g.shake(2 + st / 18, 12); if (mv) g.fx.sparks(this.x + rand(-14, 14), this.y - rand(8, 34), 6, [[1, 1, 1], [0.7, 0.85, 1]], 2.4, { dir: rand(0, Math.PI * 2), spread: 1.2, gy: 0.15 }); }
      if (this.evil > 0.2) g.fx.glow(this.x + this.dir * 4, this.y - 28, 7, [1, 0.12, 0.2], 0.8 * this.evil);
    }
    if (st === 56 && this.reflecting) {
      this.reflecting = false; if (mv) mv.shatter(g, this.x, this.y - 22);                                                    // it crashes out of the glass and lands beside you, never on top of you
      const side = this.x >= p.x ? 1 : -1, tgt = clamp(p.x + side * Math.max(46, Math.abs(this.x - p.x)), 28, g.room.pw - 28);
      this.y = m ? m.y1 : this.y; this.vx = (tgt - this.x) / 32; this.vy = -3.4; this.onGround = false; this.dir = tgt >= this.x ? 1 : -1; this.evil = 1; this.hold = null;
      g.fx.ring(this.x, this.cy, 60, [0.7, 0.45, 1], 26, 0.12); g.fx.burst(this.x, this.cy, 18, [[0.7, 0.5, 1], [0.15, 0.05, 0.3]], { speed: 2.6, s0: 14 }); A.sfx('roar');
    }
    if (st > 56) { this.faceP(); if (this.onGround) this.vx = approach(this.vx, 0, 0.3); g.fx.glow(this.x + this.dir * 4, this.y - 28, 7, [1, 0.12, 0.2], 0.8); }
  }
  swordBox(reach) { return { x: this.dir > 0 ? this.x : this.x - reach, y: this.y - 52, w: reach, h: 48 }; }
  strike(g, reach, extra = 0) { const p = g.player; if (!this.hitDone && overlap(this.swordBox(reach), p.hurtbox)) { this.hitDone = true; p.hurt(this.dmg + extra, this.x); } }
  hand() { return [this.x + this.dir * 12, this.y - 24]; }
  lobVx(k) { const L = LOB[k], hx = this.hand()[0]; return clamp((this.g.player.x - hx) / L[0], -L[1], L[1]); }          // an item lobbed at where you stand (it falls short if you are far: the mark shows where it will really land)
  lobLand(k) { return this.hand()[0] + this.lobVx(k) * LOB[k][0]; }
  // let go of an item (the aim is made when it leaves the hand, as yours is)
  toss(g, k) {
    const p = g.player, [hx, hy] = this.hand(), d = this.dir; A.sfx(k === 'dagger' ? 'slash' : 'cast'); this.lastToss = this.t;
    if (k === 'dagger') { const n = this.phase === 2 ? 3 : 1; for (let i = 0; i < n; i++) g.addProjectile(new TwinDagger(hx, hy, d, (i - (n - 1) / 2) * 0.32)); }
    else if (k === 'axe') g.addProjectile(new TwinAxe(hx, hy - 2, this.lobVx(k)));
    else if (k === 'torch') g.addProjectile(new TwinTorch(hx, hy - 2, this.lobVx(k)));
    else if (k === 'holy') g.addProjectile(new TwinFlask(hx, hy - 2, this.lobVx(k)));
    else if (k === 'marrow') g.addProjectile(new TwinArrow(hx, hy, d));
    if (LOB[k]) { this.landX = this.lobLand(k); this.landT = LOB[k][0] - 6; }                    // (the spot stays marked while it is in the air)
    g.fx.ring(hx, hy, 14, [0.75, 0.6, 1], 12, 0.2);
  }
  ai(g) {
    const p = g.player, spd = this.spd, d = Math.abs(this.dx()), [hx, hy] = this.hand(); this.live = false;
    for (const q of this.trail) q.life--; this.trail = this.trail.filter(q => q.life > 0);
    if (this.landT > 0) { this.landT--; if (!this.warns) this.warns = [{ type: 'ring', x: this.landX, y: this.y, r: 26 }]; }
    g.fx.light(this.x, this.y - 20, 56, 0.45, [0.65, 0.5, 1]); g.fx.glow(this.x + this.dir * 4, this.y - 28, 7, [1, 0.12, 0.2], 0.75);
    if (this.t % 5 === 0) g.fx.emit({ x: this.x + rand(-6, 6), y: this.y - rand(4, 34), vx: rand(-0.15, 0.15), vy: -rand(0.2, 0.6), life: 28, s0: 5, s1: 1, c0: [0.65, 0.4, 1], c1: [0.2, 0.05, 0.4], a0: 0.6, a1: 0, kind: 6 });      // a faint violet haze
    switch (this.state) {
      case 'idle': {
        this.faceP(); this.vx = approach(this.vx, d > 110 ? this.dir * 1.5 : d < 42 ? -this.dir * 1.2 : 0, 0.14);
        if (this.hp < this.maxHp * 0.6 && this.heals < (this.phase === 2 ? 2 : 1) && d > 70 && this.st > 20 && Math.random() < 0.025) { this.state = 'bandage'; this.st = 0; this.plan = null; break; }
        this.planNext(this.phase === 2 ? P2 : P1, Math.round(70 / spd)); break; }
      case 'slash': {                                                                                  // a combo: a long wind-up and a cut, then quick follow-ups
        const n = this.phase === 2 ? 3 : 2, T0 = this.tele('slash'); if (this.st === 1) { this.blow = 0; this.bt = 0; this.hitDone = false; this.faceP(); }
        const wind = this.blow === 0 ? T0 : Math.round(24 / spd), reach = this.blow === n - 1 && n === 3 ? 54 : 46, LIVE = 7; this.bt++;
        if (this.bt <= wind) {
          if (this.bt === 1 && this.blow > 0) { this.faceP(); this.hitDone = false; }
          this.vx = d > 30 && this.bt < wind * 0.7 ? this.dir * 1.3 : 0; this.tell('slash', this.bt / wind, [{ type: 'rect', x: this.dir > 0 ? this.x : this.x - reach - 14, y: this.y - 52, w: reach + 14, h: 48 }]);
        } else if (this.bt <= wind + LIVE) {
          if (this.bt === wind + 1) { A.sfx('slash'); g.fx.ring(this.x + this.dir * 30, this.y - 30, 30, [0.75, 0.65, 1], 12, 0.2); g.fx.gust && g.fx.gust(this.x + this.dir * 30, this.y - 30, this.dir * 3, 0, 36, 1, 20); }
          this.vx = this.dir * 1.8; this.live = true; this.strike(g, reach + 8, this.blow === n - 1 ? 3 : 0);
        } else {
          this.vx = approach(this.vx, 0, 0.4);
          if (this.bt > wind + LIVE + (this.blow < n - 1 ? 8 : 26)) { if (this.blow < n - 1) { this.blow++; this.bt = 0; } else { this.state = 'idle'; this.st = -10; } }
        }
        break; }
      case 'dash': {                                                                                   // through where you stand, a cut at the end of it
        const T0 = this.tele('dash'), run = 24, sp = this.phase === 2 ? 6.4 : 5.4;
        if (this.st === 1) { this.faceP(); this.hitDone = false; this.trail.length = 0; }
        if (this.st < T0) { this.vx = 0; this.tell('dash', this.st / T0, [{ type: 'lane', x0: this.x, x1: this.x + this.dir * sp * run, y: this.y }]); }
        else if (this.st < T0 + run) {
          if (this.st === T0) { A.sfx('dash'); g.fx.ring(this.x, this.cy, 36, [0.7, 0.45, 1], 14, 0.2); }
          this.vx = this.dir * sp; this.live = true; if (this.st >= T0 + run - 9) { if (this.st === T0 + run - 9) A.sfx('slash'); this.strike(g, 42, 2); }
          if (this.st % 2 === 0) this.trail.push({ x: this.x, y: this.y, fi: this.pose(), dir: this.dir, life: 14 });
        } else { this.vx = approach(this.vx, 0, 0.6); if (this.st > T0 + run + 22) { this.state = 'idle'; this.st = -10; } }
        break; }
      case 'dagger': case 'axe': case 'torch': case 'marrow': case 'holy': {
        const k = this.state, T0 = this.tele(k), V = k === 'dagger' ? 2 : this.phase === 2 ? 2 : 1, gap = k === 'dagger' ? 16 : 26; this.vx = approach(this.vx, 0, 0.3);
        if (this.st === 1) { this.faceP(); this.thrown = 0; this.tx = clamp(p.x, 30, g.room.pw - 30); }
        if (this.st < T0) this.tell(k, this.st / T0, k === 'dagger' ? [{ type: 'lane', x0: hx, x1: hx + this.dir * 220, y: this.y - 6 }] : k === 'marrow' ? [{ type: 'line', x0: hx, y0: hy, x1: p.x, y1: p.y - 20 }] : [{ type: 'ring', x: this.lobLand(k), y: this.y, r: 28 }]);
        else if (this.thrown < V && this.st >= T0 + gap * this.thrown) { if (this.thrown > 0) this.faceP(); this.toss(g, k); this.thrown++; }
        else if (this.thrown >= V && this.st > T0 + gap * (V - 1) + 26) { this.state = 'idle'; this.st = -12; }
        break; }
      case 'bandage': {                                                                                // it kneels and binds its wounds: a quiet moment - strike now
        const T0 = this.tele('bandage'); this.vx = approach(this.vx, 0, 0.3);
        if (this.st < T0) this.tell('bandage', this.st / T0);
        else if (this.st < T0 + 100) {
          if (this.st === T0) { A.sfx('heal'); this.heals++; g.popup(this.x, this.y - 46, 'BANDAGE', '#f2efe6'); g.fx.ring(this.x, this.y - 18, 20, [0.95, 0.95, 0.9], 18, 0.2); }
          this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.15 / 100);
          if (this.t % 5 === 0) g.fx.emit({ x: this.x + rand(-7, 7), y: this.y - rand(2, 26), vx: rand(-0.1, 0.1), vy: -rand(0.3, 0.8), life: 30, s0: 5, s1: 1, c0: [0.75, 1, 0.8], c1: [0.3, 0.9, 0.5], a0: 0.9, a1: 0, kind: 6 });
        } else { this.state = 'idle'; this.st = -16; }
        break; }
      case 'leap': {                                                                                   // (second half) it jumps onto where you stand - even up on a platform - and cuts on the way down
        const T0 = this.tele('leap');
        if (this.st === 1) { this.tx = clamp(p.x, 40, g.room.pw - 40); this.hitDone = false; this.hi = p.y < this.y - 20; }
        if (this.st < T0) { this.vx = 0; this.dir = this.tx >= this.x ? 1 : -1; this.tell('leap', this.st / T0, [{ type: 'ring', x: this.tx, y: this.hi ? p.y : this.y, r: 34 }]); }
        else if (this.st === T0) { this.vy = -5.1; this.vx = clamp((this.tx - this.x) / (this.hi ? 36 : 48), -3.6, 3.6); this.onGround = false; A.sfx('jump'); }
        else if (this.st > T0 + 8 && this.onGround) { this.vx = 0; g.shake(3, 10); A.sfx('boom'); g.fx.ring(this.x, this.y - 4, 50, [0.7, 0.45, 1], 18, 0.15); g.fx.burst(this.x, this.y - 4, 8, [[0.6, 0.45, 0.9], [0.15, 0.1, 0.3]], { speed: 1.8, s0: 10, up: 0.5 }); this.state = 'idle'; this.st = -22; }
        else if (this.vy > 0.4) { this.live = true; this.strike(g, 46, 2); }
        break; }
    }
  }
  // which picture of the hero's sheets it is wearing (the same sheets as his, recoloured)
  pose() {
    const s = this.state, st = this.st, t = this.t;
    if (this.dying) return { sheet: 'hero_hurt', f: this.dying < 20 ? 0 : this.dying < 44 ? 1 : 2 };
    if (this.state === 'intro') return { sheet: 'hero_idle', f: Math.floor(t / 11) % 4 };
    if (s === 'slash') { const wind = this.blow === 0 ? this.tele('slash') : Math.round(24 / this.spd), bt = this.bt; return { sheet: 'hero_attack', f: bt <= wind ? (bt < wind * 0.6 ? 0 : 1) : bt <= wind + 4 ? 2 : bt <= wind + 7 ? 3 : bt <= wind + 11 ? 4 : 5 }; }
    if (s === 'dash') { const T0 = this.tele('dash'); return st < T0 ? { sheet: 'hero_crouch', f: 1 } : st < T0 + 15 ? { sheet: 'hero_run', f: 3 } : st < T0 + 24 ? { sheet: 'hero_attack', f: 2 } : { sheet: 'hero_attack', f: 3 }; }
    if (TOSS.has(s)) { const T0 = this.tele(s); return { sheet: 'hero_attack', f: t - this.lastToss < 9 ? 2 : st < T0 * 0.55 ? 0 : 1 }; }
    if (s === 'bandage') return { sheet: 'hero_crouch', f: this.st < this.tele('bandage') ? 1 : 2 };
    if (!this.onGround) {
      if (s === 'leap' && this.vy > 0.4) { const f = this.vy < 2 ? 3 : 4; return { sheet: 'hero_jump_attack', f, cy: JATK_CY[f], ch: 80 }; }
      const f = this.vy < -3 ? 1 : this.vy < -0.6 ? 2 : this.vy < 1.2 ? 3 : 4; return { sheet: 'hero_jump', f, cy: JUMP_CY[f], ch: 77 };
    }
    if (s === 'leap') return { sheet: 'hero_crouch', f: 1 };
    if (Math.abs(this.vx) > 0.3) return { sheet: 'hero_run', f: Math.floor(t / 4) % 12 };
    return { sheet: 'hero_idle', f: Math.floor(t / 11) % 4 };
  }
  dyingSeq() {
    const g = this.g; if (this.dying % 4 === 0) g.fx.sparks(this.x + rand(-9, 9), this.y - rand(6, 34), 6, [[1, 1, 1], [0.7, 0.8, 1], [0.6, 0.4, 1]], 3.4, { gy: 0.15 });
    super.dyingSeq();
  }
  onPhase2() {
    const g = this.g; g.fx.flash([0.7, 0.5, 1], 0.5); g.shake(5, 24); A.sfx('roar'); g.fx.ring(this.x, this.cy, 90, [0.7, 0.5, 1], 34, 0.14);
    const X = x => clamp(x, 20, g.room.pw - 20); dropItem(g, 'heart', X(this.x - 36), this.cy - 20); dropItem(g, 'heart', X(this.x + 36), this.cy - 20); dropItem(g, 'mana', X(this.x), this.cy - 30);          // (a breather, as every boss gives)
    this.state = 'idle'; this.st = -40; this.plan = null; g.banner('IT LEARNS', 'FROM YOU', 150, { y: 60, color: '#c9c0ff' });
  }
  // inside the glass: you, mirrored, turning silver and violet as the cracks spread (the glass itself is MirrorView's)
  drawReflection(ctx, cx, cy) {
    const mv = this.mv, p = this.g.player; if (!mv) return;
    const fi = this.hold || p.frameInfo(), x = this.x - cx, y = this.y - cy, k = this.evil;
    mv.clip(ctx, cx, cy);
    if (k < 1) { const o = { alpha: 0.94 * (1 - k) }; heroFrame(ctx, fi.sheet, fi, x, y, this.dir, p.h, o); heroFrame(ctx, fi.sheet + '_hair', fi, x, y, this.dir, p.h, o); }
    if (k > 0) heroFrame(ctx, fi.sheet + '_evil', fi, x, y, this.dir, p.h, { alpha: 0.94 * k });
    ctx.restore(); mv.over(ctx, cx, cy);
  }
  draw(ctx, cx, cy) {
    if (this.reflecting) { this.drawReflection(ctx, cx, cy); return; }
    const fi = this.pose(), x = this.x - cx, y = this.y - cy, a = this.dying > 70 ? Math.max(0, 1 - (this.dying - 70) / 80) : 1;
    for (const q of this.trail) heroFrame(ctx, q.fi.sheet + '_evil', q.fi, q.x - cx, q.y - cy, q.dir, this.h, { flash: '#7c5cff', alpha: q.life / 14 * 0.45 });
    if (this.onGround && !this.dying) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(x - 7), Math.round(y - 1), 14, 2); }
    const sc = this.state === 'intro' ? 0.82 + 0.18 * clamp((this.st - 56) / 28, 0, 1) : 1;                // (it comes forward out of the glass: a little smaller, still far back, then full size)
    heroFrame(ctx, fi.sheet + '_evil', fi, x, y, this.dir, this.h, { flash: this.flashT > 0, alpha: a < 1 ? a : undefined, scale: sc });
  }
}

export const BOSS_TYPES = { boss_vampire: BossVampire, boss_beast: BossBeast, boss_nightmare: BossNightmare, boss_angel: BossAngel, boss_colossus: BossColossus, boss_shadow: BossShadow, boss_cinder: BossCinder, boss_bramble: BossBramble, boss_mirror: BossMirror };
