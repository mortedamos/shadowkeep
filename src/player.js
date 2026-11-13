// The cloaked stranger (sprites: the "Gothic Hero" by Ansimuz, CC0).
import { Entity, moveX, moveY, touchesSpikes } from './entity.js';
import { Input } from './input.js';
import { drawSheet, SHEET, sheetExtents } from './assets.js';
import { Audio_ as A } from './audio.js';
import { COLORS } from './fx.js';
import { T, clamp, approach, rand, TAU } from './util.js';
import { TILE } from './world.js';
import { Fireball, SwordFire } from './projectiles.js';
import { ENCH, TUNE } from './enchant.js';
import { STAINS, STAIN_KEYS, RAIN_WASH, POOL_WASH, stainSource } from './stain.js';
import { ITEM_ORDER, itemCount, canUseItem, releaseItem } from './items.js';

import { RUN, GRAV, MAXFALL, JUMP, DJUMP, ACC, FRIC, AIRACC, DASH_V, DASH_T, PW, PH } from './physics.js';
export { RUN, GRAV, MAXFALL, JUMP, DJUMP };

// Sword attacks: per-frame durations (in 60ths of a second), which animation frames are "live", damage multiplier and reach.
// Pressing attack again right after a swing chains  slash -> slash -> heavy finisher -> slash ...
const seq = o => { o.starts = []; let t = 0; for (const d of o.durs) { o.starts.push(t); t += d; } o.total = t; o.s0 = o.starts[o.active[0]]; o.s1 = o.starts[o.active[1] + 1] ?? t; return o; };
// The Gothic Hero has one 6-frame swing (frames 0-1 wind up, the big slash arc is baked into frame 2, frame 3 is its tail) and a 6-frame air swing
// (arc on frame 4); the chain is told apart by timing: a quick second cut and a slow, wound-up heavy finisher.
const ATTACKS = [
  seq({ sheet: 'hero_attack', durs: [3, 3, 4, 3, 3, 4], active: [2, 3], dmg: 1.0, reach: 40, kb: 1.6 }),
  seq({ sheet: 'hero_attack', durs: [2, 3, 3, 3, 3, 3], active: [2, 3], dmg: 1.0, reach: 42, kb: 1.6 }),
  seq({ sheet: 'hero_attack', durs: [5, 5, 5, 4, 4, 5], active: [2, 3], dmg: 1.6, reach: 50, kb: 2.8 }),
];
const AIR_ATTACK = seq({ sheet: 'hero_jump_attack', air: true, durs: [3, 3, 3, 3, 4, 4], active: [3, 4], dmg: 1.0, reach: 42, kb: 1.6 });
// ducking (hold Down): a low, quick slash that skims the ground - it hits what a standing swing sails over
const CROUCH_ATTACK = seq({ sheet: 'hero_crouch_slash', crouch: true, durs: [4, 4, 4, 4], active: [1, 2], dmg: 1.0, reach: 40, kb: 1.4 });
const CROUCH_H = 22;                         // hitbox height while ducking (standing is PH)
const JUMP_CY = [56, 46, 31, 24.5, 31.5];      // vertical centre of each hero_jump frame (the art bakes the jump arc into the cell)
const JATK_CY = [59, 49, 34, 27.5, 22.5, 29.5];

export const SPELLS = {
  ember: { name: 'SULPHUR', cost: 12, icon: 'ember', cd: 24 },
  thunder: { name: 'VITRIOL', cost: 28, icon: 'thunder', cd: 50 },
};

export class Player extends Entity {
  constructor(g, x, y) {
    super(x, y, PW, PH); this.g = g;
    this.invT = 0; this.hurtT = 0; this.dashT = 0; this.dashCd = 0; this.castT = 0; this.castCd = 0; this.atk = 0; this.atkDur = 0; this.seq = ATTACKS[0]; this.atkId = 0; this.atkBuf = 0; this.comboT = 0; this.comboN = 0;
    this.coyote = 0; this.jumpBuf = 0; this.canDouble = true; this.canAirDash = true; this.djumpT = 0; this.runT = 0; this.lastSafe = { x, y }; this.safeT = 0;
    this.trail = []; this.fallSpeed = 0; this.dead = false; this.deathT = 0; this.landedT = 0; this.spell = 'ember'; this.castFired = false; this.interactCd = 0; this.idleT = 0; this.hitsThisSwing = 0;
    this.ench = null; this.fireFired = false; this.sunQuad = null; this.crouch = false; this.crouchT = 0;
    this.stain = { soot: 0, mud: 0, blood: 0 };       // what the cloak has picked up (see stain.js)
    this.sel = null; this.castItem = null; this.healT = 0; this.healPer = 0;      // hotbar selection, the item being thrown, bandage healing
  }
  get S() { return this.g.save; }
  get atkPower() { const S = this.S; return S.atk + Math.floor(S.level / 2); }
  get hurtbox() { const b = this.box; return { x: b.x + 1, y: b.y + 2, w: b.w - 2, h: b.h - 2 }; }
  place(x, y, dir = 1) { this.x = x; this.y = y; this.vx = this.vy = 0; this.dir = dir; this.lastSafe = { x, y }; this.atk = 0; this.atkBuf = 0; this.dashT = 0; this.hurtT = 0; this.castT = 0; this.castItem = null; this.healT = 0; this.djumpT = 0; this.crouch = false; this.h = PH; this.trail.length = 0; if (this.g.fx.cloak) this.g.fx.cloak.ready = false; }

  // ------------------------------------------------------------------ combat helpers
  swordDamage() { const E = this.ench; return Math.max(1, Math.round(this.atkPower * this.seq.dmg * (E ? ENCH[E.type].dmg : 1))); }
  attackBox() {
    const d = this.dir, x = this.x, y = this.y, r = this.seq.reach;
    if (this.seq.crouch) return { x: d > 0 ? x : x - r, y: y - 24, w: r, h: 22 };
    return { x: d > 0 ? x : x - r, y: y - 52, w: r, h: 48 };
  }
  attackActive() {
    if (!this.atk) return false; const e = this.atkDur - this.atk;
    return e >= this.seq.s0 && e < this.seq.s1;
  }
  hurt(dmg, fromX, opts = {}) {
    const g = this.g, S = this.S, E = this.ench;
    if (this.invT > 0 || this.dead || g.cutscene) return false;
    { const el = opts.el || stainSource(g, fromX);
      if (el === 'soot' && S.flags.got_mantle) { dmg = Math.max(1, Math.round(dmg * 0.5)); g.popup(this.x, this.y - 52, 'ASHEN', '#ffb070'); }          // the Ashen Mantle: fire hurts half as much (and leaves no soot)
      else if (el) this.addStain(el, clamp(dmg / 14, 0.18, 0.5)); }      // fire singes, filth dirties, claws and fangs draw blood
    S.hp -= Math.max(1, Math.round(dmg)); this.hurtT = opts.stun || 18; this.invT = opts.inv || 80; this.atk = 0; this.atkBuf = 0; this.dashT = 0; this.castT = 0;
    const d = this.x < fromX ? -1 : 1; this.vx = d * (opts.kb === undefined ? 2.0 : opts.kb); this.vy = -2.6; this.onGround = false; this.dir = -d;
    g.fx.hurtFlash(0.9); g.fx.sparks(this.x, this.y - 18, 10, COLORS.red, 3); g.shake(3, 10); g.hitstop = 5; A.sfx('hurt');
    if (S.hp <= 0) { S.hp = 0; this.die(); }
    return true;
  }
  die() { this.dead = true; this.deathT = 0; this.vx = 0; this.clearEnchant(false); A.sfx('gameover'); this.g.onPlayerDeath(); }
  heal(n) { const S = this.S; const b = S.hp; S.hp = Math.min(S.maxHp, S.hp + n); if (S.hp > b) { this.g.popup(this.x, this.y - 40, '+' + Math.round(S.hp - b), '#7dff8a'); this.g.fx.souls(this.x, this.y - 16, 5, COLORS.green); } }
  gainMp(n) { const S = this.S; S.mp = Math.min(S.maxMp, S.mp + n); }
  gainXp(n) {
    const S = this.S; S.xp += n;
    while (S.xp >= this.xpNext()) {
      S.xp -= this.xpNext(); S.level++; S.maxHp += 6; S.maxMp += 2; S.hp = Math.min(S.maxHp, S.hp + 20); S.mp = S.maxMp; A.sfx('levelup');
      this.g.banner('LEVEL ' + S.level, 'HP AND POWER GROW'); this.g.fx.ring(this.x, this.y - 16, 40, [1, 0.9, 0.4], 30); this.g.fx.souls(this.x, this.y - 16, 12, COLORS.gold);
    }
  }
  xpNext() { return 18 + this.S.level * this.S.level * 10; }
  setSpell(s) { this.spell = s; }
  // the hotbar: unlocked spells first, then every carried item (in a fixed order)
  hotbar() { const out = this.unlockedSpells().map(id => ({ kind: 'spell', id })); for (const id of ITEM_ORDER) if (itemCount(this.S, id) > 0) out.push({ kind: 'item', id }); return out; }
  unlockedSpells() { const S = this.S.abilities, r = []; if (S.ember) r.push('ember'); if (S.thunder) r.push('thunder'); return r; }

  // ------------------------------------------------------------------ sword enchantments
  setEnchant(type) {
    const E = this.ench, def = ENCH[type], g = this.g;
    if (E && E.type === type) E.t = Math.min(TUNE.maxTime, E.t + TUNE.addTime); else { this.clearEnchant(false); this.ench = { type, t: TUNE.time }; }
    A.sfx('enchant'); g.fx.ring(this.x, this.y - 18, 46, def.rgb, 30, 0.14); g.fx.flash(def.rgb, 0.22); g.fx.sparks(this.x, this.y - 18, 20, [[1, 1, 1], def.rgb], 3.2);
    g.banner(def.title, def.desc + ' ' + Math.round(this.ench.t / 3600) + ' MIN LEFT.', 200, { y: 56, color: '#ffe9a0' });
  }
  clearEnchant(announce) {
    if (this.sunQuad) { this.sunQuad.kill = true; this.sunQuad = null; }
    if (announce && this.ench) { this.g.popup(this.x, this.y - 44, ENCH[this.ench.type].name + ' FADES', '#cfc2a0'); A.sfx('back'); this.g.fx.souls(this.x, this.y - 18, 6, COLORS.white); }
    this.ench = null;
  }
  // called by the game for every successful sword hit
  onSwordHit(e) {
    const E = this.ench; if (!E) return;
    if (E.type === 'ice') {
      const boss = e.isBoss, chance = boss ? TUNE.bossFreezeChance : TUNE.freezeChance;
      if (Math.random() < chance) e.freeze(boss ? rand(TUNE.bossFreezeMin, TUNE.bossFreezeMax) : rand(TUNE.freezeMin, TUNE.freezeMax), boss ? TUNE.bossFreezeImmune : TUNE.freezeImmune);
    }
  }
  // world positions of blade / slash-arc pixels in the current frame (empty while the sword is sheathed)
  swordPoints() {
    const fi = this.frameInfo(), out = [], dir = this.dir;
    const sh = SHEET[fi.sheet], pts = sh && sh.pts && sh.pts[fi.f];
    if (pts) { const jump = fi.cy !== undefined, ay = jump ? fi.cy / fi.ch : sh.ay, oy = jump ? this.y - this.h / 2 + 1 : this.y; for (const [px, py] of pts) out.push([this.x + dir * (px - sh.ax * sh.w), oy + (py - ay * sh.h)]); }
    return out;
  }
  updateEnchant() {
    const g = this.g, fx = g.fx, E = this.ench; if (!E) return; const def = ENCH[E.type], t = this.t, c = def.rgb;
    if (!g.cutscene) E.t--;
    if (E.t <= 0) { this.clearEnchant(true); return; }
    // FIRE: every slash flings a small fireball
    if (E.type === 'fire' && this.atk && !this.fireFired && this.atkDur - this.atk >= this.seq.s0) {
      this.fireFired = true; const heavy = this.seq.dmg > 1;
      g.addProjectile(new SwordFire(this.x + this.dir * 30, this.y - 22, this.dir, Math.max(1, Math.round(this.swordDamage() * TUNE.fireballFrac * (heavy ? 0.8 : 1))))); A.sfx('fireball');
      fx.burst(this.x + this.dir * 28, this.y - 22, 8, COLORS.fire, { speed: 1.8, s0: 12 });
    }
    // visuals: heavy emission along the visible blade/arc, a trickle from the cloak while it is sheathed
    const pts = this.swordPoints(), hip = [this.x - this.dir * 4, this.y - 16], n = pts.length ? 3 : (t % 3 === 0 ? 1 : 0);
    const pick = () => pts.length ? pts[(Math.random() * pts.length) | 0] : [hip[0] + rand(-5, 5), hip[1] + rand(-7, 7)];
    for (let i = 0; i < n; i++) {
      const [x, y] = pick();
      if (E.type === 'fire') fx.emit({ x, y, vx: rand(-0.2, 0.2), vy: -rand(0.5, 1.3), life: rand(12, 22), s0: pts.length ? 10 : 7, s1: 2, c0: COLORS.fire[0], c1: COLORS.fire[1], a0: 0.9, a1: 0, kind: 2 });
      else if (E.type === 'ice') { fx.emit({ x, y, vx: rand(-0.2, 0.2), vy: rand(0.1, 0.5), gy: 0.01, life: rand(24, 44), s0: 6, s1: 1, c0: [0.85, 0.97, 1], c1: [0.4, 0.75, 1], a0: 0.95, a1: 0, kind: 6 }); if (pts.length && Math.random() < 0.5) fx.emit({ x, y, vx: rand(-0.6, 0.6), vy: rand(0, 0.8), gy: 0.06, life: rand(14, 24), s0: 2.5, s1: 1, c0: [0.9, 1, 1], a0: 1, a1: 0, kind: 1 }); }
      else if (E.type === 'sun') fx.emit({ x, y, vx: rand(-0.3, 0.3), vy: -rand(0.1, 0.7), life: rand(26, 46), s0: 8, s1: 1, c0: [1, 0.97, 0.7], c1: [1, 0.75, 0.2], a0: 1, a1: 0, kind: 6 });
      else fx.emit({ x, y, vx: rand(-0.4, 0.4), vy: -rand(0.1, 0.6), life: rand(16, 30), s0: 3, s1: 1, c0: [0.9, 0.96, 1], c1: [0.4, 0.6, 1], a0: 1, a1: 0, kind: 1 });
    }
    fx.glow(hip[0], hip[1], 20 + (pts.length ? 16 : 0) + Math.sin(t * 0.5) * 3, def.rgb, E.type === 'sun' ? 0.32 : 0.2);
    fx.light(this.x, this.y - 20, E.type === 'sun' ? 120 : E.type === 'fire' ? 78 : 62, E.type === 'sun' ? 0.95 : 0.55);   // SUN also lights up dark rooms
    // SUN: slow rotating sunburst behind the hero
    if (E.type === 'sun') { if (!this.sunQuad || !fx.quads.includes(this.sunQuad)) this.sunQuad = fx.quad({ kind: 'rays', x: this.x, y: this.y - 20, w: 76, h: 76, color: [1, 0.9, 0.5], life: 1, hold: true, spin: 0.015, p: [0, 10], a0: 0.3, a1: 0.3, order: 2 }); this.sunQuad.x = this.x; this.sunQuad.y = this.y - 20; }
  }

  // ------------------------------------------------------------------ update
  update() {
    const g = this.g, S = this.S, room = g.room, I = Input; this.t++;
    if (this.dead) { this.deathT++; this.vy = Math.min(this.vy + GRAV, MAXFALL); moveY(this, room); this.vx *= 0.9; this.stepCloak(); return; }
    for (const k of ['invT', 'hurtT', 'dashCd', 'castCd', 'dropThrough', 'coyote', 'jumpBuf', 'interactCd', 'djumpT', 'atkBuf']) if (this[k] > 0) this[k]--;
    if (!this.atk && this.comboT > 0) this.comboT--;
    const locked = this.hurtT > 0 || g.cutscene || g.playerFrozen;
    const was = this.onGround;
    if (this.ride) { if (room.gears && this.ride.active) { this.x += this.ride.dx; this.y += this.ride.dy; } else this.ride = null; }          // (standing on a turning gear's tooth: carried with it)
    let dx = locked ? 0 : I.horiz;

    // ---- duck: hold Down on the ground.  You can't start a duck mid-swing, and you only stand back up when there is headroom.
    const kneel = !!(g.cutscene && g.cutscene.scene && g.cutscene.scene.kneel), wantCrouch = (kneel && this.onGround) || (!locked && I.held.down && this.onGround && !this.dashT && !this.castT && !(this.atk && !this.crouch));          // (kneel: the opening scene - he kneels at her grave)
    if (wantCrouch && !this.crouch) { this.crouch = true; this.h = CROUCH_H; this.crouchT = 0; }
    else if (!wantCrouch && this.crouch && !this.atk && this.canStand(room)) { this.crouch = false; this.h = PH; }
    if (this.crouch) this.crouchT++;

    if (!locked) {
      // ---- spells
      // ---- the hotbar: spells and carried items.  Q / V move the selection; the spell key (C / I) uses whatever is selected.
      const bar = this.hotbar(); if (this.sel === null && S.sel) this.sel = S.sel;
      if (bar.length > 1 && (I.pressed.itemNext || I.pressed.itemPrev)) { let i = bar.findIndex(e => e.id === this.sel); i = (i + (I.pressed.itemNext ? 1 : -1) + bar.length) % bar.length; this.sel = bar[i].id; A.sfx('click'); }
      if (!bar.some(e => e.id === this.sel)) this.sel = bar.length ? bar[0].id : null;
      S.sel = this.sel; const cur = bar.find(e => e.id === this.sel); if (cur && cur.kind === 'spell') this.spell = cur.id;
      if (I.pressed.spell && cur && !this.castT && !this.atk && this.castCd === 0) {
        if (cur.kind === 'spell') {
          const sp = SPELLS[cur.id];
          if (S.mp >= sp.cost) { S.mp -= sp.cost; this.spell = cur.id; this.castT = 20; this.castCd = sp.cd; this.castFired = false; A.sfx('cast'); } else { g.popup(this.x, this.y - 42, 'NO MANA', '#6aa8ff'); A.sfx('back'); }
        } else if (canUseItem(g, this, cur.id)) { this.castT = 18; this.castCd = 14; this.castFired = true; this.castItem = cur.id; }      // the item leaves your hand mid-animation
      }
      // ---- attack (a press near the end of a swing is remembered, so combos flow)
      if (I.pressed.attack && this.atk > 0 && this.atk <= 7) this.atkBuf = 9;
      if ((I.pressed.attack || this.atkBuf > 0) && !this.atk && !this.castT && !this.dashT) {
        this.atkBuf = 0; const air = !this.onGround;
        const idx = air ? 1 : this.crouch ? 0 : (this.comboT > 0 ? (this.comboN + 1) % 3 : 0);
        this.seq = air ? AIR_ATTACK : this.crouch ? CROUCH_ATTACK : ATTACKS[idx]; this.comboN = idx; if (!air) this.vx = 0;     // a ground swing is planted: no sliding, no lunging
        this.atkDur = this.atk = this.seq.total; this.atkId = ++g.attackCounter; this.hitsThisSwing = 0; this.fireFired = false;
        if (dx) this.dir = dx; A.sfx('slash');
      }
      // ---- dash
      if (I.pressed.dash && S.abilities.dash && this.dashCd === 0 && !this.dashT && (this.onGround || this.canAirDash) && (!this.crouch || this.canStand(room))) {
        if (this.crouch) { this.crouch = false; this.h = PH; }
        this.dashT = DASH_T; this.dashCd = S.flags.got_spring ? 15 : 34; this.atk = 0; this.atkBuf = 0; this.castT = 0; if (dx) this.dir = dx; if (!this.onGround) this.canAirDash = false; this.invT = Math.max(this.invT, DASH_T + 3); this.dashAtkId = ++g.attackCounter; this.dashHitDone = false;
        A.sfx('dash'); g.fx.burst(this.x, this.y - 18, 8, COLORS.purple, { speed: 1.5, s0: 10, s1: 2 });
      }
      // ---- jump
      if (I.pressed.jump) {
        if (I.held.down && this.onGround && room.get(Math.floor(this.x / T), Math.floor((this.y + 2) / T)) === TILE.PLAT) { this.dropThrough = 10; this.y += 2; this.onGround = false; this.jumpBuf = 0; }
        else this.jumpBuf = 7;
      }
      if (this.jumpBuf > 0 && !this.crouch) {
        if (this.coyote > 0 || this.onGround) { this.vy = JUMP; this.jumpBuf = 0; this.coyote = 0; this.onGround = false; A.sfx('jump'); g.fx.burst(this.x, this.y - 1, 4, [[0.7, 0.7, 0.8], [0.4, 0.4, 0.5]], { speed: 0.8, s0: 7, s1: 2, l0: 10, l1: 18 }); }
        else if (S.abilities.djump && this.canDouble && !this.dashT) {
          this.vy = DJUMP; this.canDouble = false; this.jumpBuf = 0; this.djumpT = 18; A.sfx('djump'); g.fx.ring(this.x, this.y - 6, 18, [0.6, 0.8, 1], 18, 0.25, 4);
          g.fx.burst(this.x, this.y - 4, 12, COLORS.ice, { speed: 1.6, s0: 9, s1: 1, up: -0.6 });
        }
      }
      if (!I.held.jump && this.vy < -2.4 && !this.dashT) this.vy = -2.4;      // variable jump height
      // ---- interact
      if (I.pressed.interact && this.onGround && !this.atk && this.interactCd === 0 && !this.dashT) { if (g.interact(this)) this.interactCd = 20; }
    }

    // ---- cast animation: the spell fires mid-animation
    if (this.castT > 0) {
      this.castT--; if (this.castItem && this.castT <= 9) { releaseItem(g, this, this.castItem); this.castItem = null; }
      if (!this.castFired && this.castT <= 11) {
        this.castFired = true; const sp = this.spell;
        if (sp === 'ember') { g.addProjectile(new Fireball(this.x + this.dir * 16, this.y - 24, this.dir, this.atkPower + 8, 'player')); A.sfx('fireball'); g.fx.burst(this.x + this.dir * 14, this.y - 24, 8, COLORS.fire, { speed: 1.5 }); }
        else if (sp === 'thunder') g.castThunder(this);
      }
    }
    if (this.atk > 0) {
      this.atk--; const e = this.atkDur - this.atk;
      if (this.atk === 0) this.comboT = 24;
    }
    if (!this.castT) this.castItem = null;                       // hurt / dashed mid-throw: the item is not spent
    if (this.attackActive()) g.swordHit(this);

    // ---- horizontal motion
    const RUNV = RUN * (S.flags.got_shoes ? 1.1 : 1);                       // the Magic Shoes: 10% faster
    const groundLock = (this.atk && this.onGround) || this.castT || this.crouch;
    if (this.crouch && dx && !this.atk) this.dir = dx;
    if (this.dashT > 0) { if (S.flags.got_tide) g.dashHit(this); this.dashT--; this.vx = this.dir * DASH_V; this.vy = 0; if (this.dashT === 0) this.vx = this.dir * 2.2; if (this.t % 2 === 0) g.fx.burst(this.x - this.dir * 6, this.y - 18, 1, COLORS.purple, { speed: 0.3, s0: 12, s1: 3, l0: 14, l1: 22 }); this.trail.push({ x: this.x, y: this.y, f: this.frameInfo(), dir: this.dir, life: 14 }); }
    else if (groundLock) { this.vx = approach(this.vx, 0, FRIC * 1.4); }
    else if (dx) { this.vx = approach(this.vx, dx * RUNV, this.onGround ? ACC : AIRACC); if (!this.atk || !this.onGround) this.dir = dx; }
    else this.vx = approach(this.vx, 0, this.onGround ? FRIC : 0.05);
    if (this.dashT === 0 && Math.abs(this.vx) > RUNV && !locked && !(this.atk && this.onGround)) this.vx = approach(this.vx, Math.sign(this.vx) * RUNV, 0.06);

    // ---- vertical motion
    if (!this.dashT) this.vy = Math.min(this.vy + GRAV, MAXFALL);
    this.fallSpeed = this.vy;
    // flowing water carries the hero: fully when wading, a little when in the air above it
    let drift = 0; if (room.currents) for (const c of room.currents) if (this.x >= c.x0 && this.x <= c.x1 && this.y <= c.y + 4 && this.y >= c.y - 40) { drift = c.vx * (this.onGround ? 1 : 0.4); break; }
    if (drift) { const v0 = this.vx; this.vx = v0 + drift; moveX(this, room); if (this.vx !== 0) this.vx = v0; } else moveX(this, room);
    moveY(this, room);
    if (room.gears) room.gears.land(this);

    // landing / coyote
    if (this.onGround) {
      this.coyote = 6; this.canDouble = true; this.canAirDash = true; this.djumpT = 0;
      if (!was) { A.sfx('land'); this.landedT = 8; if (this.fallSpeed > 3) g.fx.burst(this.x, this.y - 1, 5, [[0.7, 0.68, 0.75], [0.3, 0.3, 0.4]], { speed: 1, s0: 8, s1: 2, l0: 10, l1: 20 }); }
      // remember a safe spot to respawn after spikes/pits
      if (++this.safeT > 10 && this.hurtT === 0 && this.nearFloor(room) && !touchesSpikes({ x: this.x + this.dir * 10, y: this.y, w: this.w, h: this.h, box: { x: this.x + this.dir * 10 - 6, y: this.y - 36, w: 13, h: 36 } }, room)) { this.lastSafe = { x: this.x, y: this.y }; this.safeT = 0; }
    }
    if (this.landedT > 0) this.landedT--;
    for (let i = this.trail.length - 1; i >= 0; i--) if (--this.trail[i].life <= 0) this.trail.splice(i, 1);
    // footsteps / run animation
    if (this.onGround && Math.abs(this.vx) > 0.3) { this.runT += Math.abs(this.vx) * 0.13; if (Math.floor(this.runT) % 6 === 0 && Math.floor(this.runT) !== this._lastStep) { this._lastStep = Math.floor(this.runT); A.sfx('step'); } } else this.runT = 0;
    this.idleT = (Math.abs(this.vx) < 0.1 && this.onGround) ? this.idleT + 1 : 0;
    this.updateEnchant(); this.updateStains(); this.updateHeal(); this.swishWind(); this.stepCloak(); this.stepLantern();
    if (touchesSpikes(this, room)) this.hurtSpikes();
  }
  updateHeal() {            // bandage: life flows back over ~1.5s
    if (this.healT <= 0) return; this.healT--; const S = this.S; S.hp = Math.min(S.maxHp, S.hp + this.healPer);
    if (this.healT % 6 === 0) this.g.fx.souls(this.x + rand(-5, 5), this.y - 14, 1, COLORS.green);
    if (this.healT === 0) { this.g.popup(this.x, this.y - 42, 'HEALED', '#9fe8a8'); }
  }
  // The Marshlight Lantern: a little wisp that follows the hero (a lazy bob a step behind and above), sheds light, thins the fog around it (fx.lantern: the fog shader's spare slot), and draws loot (see Pickup)
  stepLantern() {
    const g = this.g, fx = g.fx;
    if (!this.S.flags.got_lantern) { fx.lantern = null; this.lan = null; return; }
    // (the wisp is HER: it floats where the ghost used to, a step behind him, at the height of her head.  Small things say it is a person and not a lamp:
    //  she keeps close and lowers herself to his shoulder when he stands still; she darts in front of him, flaring, when he is hurt; her light falters when his life is low;
    //  she sighs - a slow pale-rose swell and a drift of motes - now and then; and she trails a thin veil of light behind her, like long hair or a shroud, that follows her movement)
    this.stillT = (Math.abs(this.vx) < 0.05 && this.onGround) ? (this.stillT || 0) + 1 : 0; const still = Math.min(1, Math.max(0, (this.stillT - 90) / 90));
    if (this.lanHp === undefined) this.lanHp = this.S.hp; if (this.S.hp < this.lanHp) { this.lanFlare = 50; this.lanDart = 28; } this.lanHp = this.S.hp;
    if (this.lanDart > 0) this.lanDart--; const dart = this.lanDart > 0 ? Math.sin(Math.PI * this.lanDart / 28) : 0;
    let tx = this.x - this.dir * (20 - 12 * still - 36 * dart) + Math.sin(this.t * (0.045 - 0.02 * still)) * (6 - 3 * still), ty = this.y - 38 + 6 * still + Math.sin(this.t * 0.07) * (4 - 2 * still); if (this.lanFlare > 0) this.lanFlare--;          // (lanFlare: a gravestone has spoken - the wisp flares)
    if (!this.lan || Math.hypot(this.lan.x - tx, this.lan.y - ty) > 150) this.lan = { x: tx, y: ty, trail: [] };
    const L = this.lan; let k = dart > 0 ? 3 : 1;
    // LOOT: she flies out to the nearest thing lying within reach, touches it (a little burst of light), and only then does it drift to him; she lingers a moment, then comes back
    let pk = this.lanTarget; if (pk && (pk.dead || pk.magnet || this.dead)) pk = this.lanTarget = null;
    if (!pk && !this.dead && !(this.lanHold > 0) && this.t % 4 === 0) { let best = 1e9; for (const q of g.pickups) { if (q.dead || q.magnet || q.touched || q.t <= 24 || q.fullT > 0) continue; const dd = Math.hypot(q.x - this.x, q.y - 5 - (this.y - 16)); if (dd < 112 && dd < best) { best = dd; pk = q; } } if (pk) { this.lanTarget = pk; this.lanChase = 0; } }
    if (this.lanHold > 0) this.lanHold--;
    if (pk) {
      tx = pk.x; ty = pk.y - 8; k = 3.2; this.lanChase = (this.lanChase || 0) + 1;
      if (Math.hypot(L.x - tx, L.y - ty) < 7 || this.lanChase > 60) { pk.touched = true; pk.touchT = 14; this.lanTarget = null; this.lanHold = 10; g.fx.burst(pk.x, pk.y - 6, 7, [[0.7, 0.85, 1], [0.4, 0.6, 1]], { speed: 1.4, s0: 5, s1: 1.5 }); g.fx.ring(pk.x, pk.y - 6, 12, [0.6, 0.8, 1], 10); A.sfx('select'); }
    }
    L.x += (tx - L.x) * 0.07 * k; L.y += (ty - L.y) * 0.09 * Math.min(k, 3.2); fx.lantern = { x: L.x, y: L.y };
    const fl = Math.min(1, (this.lanFlare || 0) / 40), low = this.S.hp <= Math.max(2, this.S.maxHp * 0.25) ? 0.5 + 0.5 * Math.sin(this.t * 0.9) * Math.sin(this.t * 0.37) : 1;      // (low life: she gutters)
    this.sighT = (this.sighT || 0) + 1; if (this.sighT > 900 + (this.t * 7 % 400)) this.sighT = -80; const sigh = this.sighT < 0 ? Math.sin(Math.PI * (this.sighT + 80) / 80) : 0;
    if (sigh > 0.9 && this.sighT % 6 === 0) fx.emit({ x: L.x + rand(-4, 4), y: L.y, vx: rand(-0.2, 0.2), vy: rand(-0.3, -0.1), life: rand(40, 70), s0: 4, s1: 1, c0: [1, 0.8, 0.85], c1: [0.8, 0.5, 0.7], a0: 0.8, a1: 0, kind: 6 });
    const rose = sigh * 0.6;
    fx.glow(L.x, L.y, 30 + 14 * fl + 8 * sigh, [0.3 + rose * 0.7, 0.55 - rose * 0.1, 1 - rose * 0.2], (0.34 + 0.3 * fl + 0.2 * sigh) * low); fx.glow(L.x, L.y, 12 + 4 * fl, [0.62 + rose * 0.38, 0.8 - rose * 0.1, 1], 0.7 * low); fx.glow(L.x, L.y, 4.5, [1, 1, 1], 1 * low); fx.light(L.x, L.y, (118 + 30 * fl + 14 * sigh) * (0.7 + 0.3 * low), 0.9 + 0.3 * fl, [0.4 + rose * 0.5, 0.66, 1 - rose * 0.1]);
    if (this.t % 4 === 0) fx.emit({ x: L.x + rand(-2, 2), y: L.y + 2, vx: rand(-0.1, 0.1), vy: rand(0.05, 0.3), life: rand(24, 44), s0: 5, s1: 1, c0: [0.6, 0.8, 1], c1: [0.25, 0.4, 0.8], a0: 0.8, a1: 0, kind: 6 });
    // the veil: her last positions, drawn as a fading thread of tiny lights that sways (like hair in water)
    L.trail ||= []; if (this.t % 2 === 0) { L.trail.unshift({ x: L.x, y: L.y }); if (L.trail.length > 9) L.trail.pop(); }
    L.trail.forEach((q, i) => { if (i < 1) return; const f = 1 - i / L.trail.length; fx.glow(q.x + Math.sin(this.t * 0.08 + i * 0.8) * i * 0.5, q.y + i * 1.2, 3.2 * f + 1, [0.55, 0.72, 1], 0.32 * f * low); });
  }

  // ------------------------------------------------------------------ cloak stains (see stain.js)
  addStain(el, amt) {
    if (el === 'soot' && this.S.flags.got_mantle) return;
    const g = this.g, st = this.stain, x = this.x - this.dir * 4, y = this.y - 24; st[el] = Math.min(1, st[el] + amt);
    if (el === 'soot') { g.fx.smoke(x, y, 2, { s0: 5, s1: 13, c0: [0.3, 0.27, 0.27], c1: [0.1, 0.09, 0.09], a: 0.5 }); g.fx.sparks(x, y, 5, [[1, 0.6, 0.2], [1, 0.3, 0.1]], 1.6, { gy: 0.1 }); }
    else if (el === 'mud') g.fx.burst(x, y, 6, [[0.43, 0.3, 0.17], [0.25, 0.17, 0.1]], { speed: 1.4, s0: 6, s1: 2 });
    else g.fx.burst(x, y, 7, [[0.75, 0.05, 0.08], [0.45, 0.03, 0.06]], { speed: 1.8, s0: 5, s1: 1.5 });
  }
  inWater() {              // standing in a pool?
    if (!this.onGround) return false;
    for (const d of this.g.room.decos) if (d.t === 'pool' && Math.abs(this.x - d.x) < d.w / 2 && Math.abs(this.y - d.y) < 3) return true;
    return false;
  }
  updateStains() {
    const g = this.g, st = this.stain, inPool = this.inWater(), rain = g.room.weather === 'rain', wash = inPool ? POOL_WASH : rain ? RAIN_WASH : 0;
    if (inPool && Math.abs(this.vx) > 0.2 && this.t % 4 === 0) g.fx.burst(this.x - this.dir * 3, this.y - 2, 3, [[0.6, 0.8, 0.9], [0.3, 0.5, 0.65]], { speed: 0.9, s0: 4, s1: 1, up: 0.8 });     // splashes
    let top = null, worst = 0.01;
    for (const k of STAIN_KEYS) { if (st[k] <= 0) continue; st[k] = Math.max(0, st[k] - STAINS[k].fade - wash); if (st[k] > worst) { worst = st[k]; top = k; } }   // they fade by themselves, and water takes them off quickly
    if (wash && top && this.t % 5 === 0) {                  // grubby drips off the hem while it washes
      const c = g.fx.cloak, c3 = STAINS[top].rgb; if (c && c.ready) { const hm = c.hem(); g.fx.emit({ x: hm.x + rand(-3, 3), y: hm.y, vx: rand(-0.2, 0.2), vy: 0.1, gy: 0.12, life: 22, s0: 3, s1: 1.5, c0: c3, a0: 0.9, a1: 0, kind: 1 }); }
    }
  }
  canStand(room) {          // is there room to stand up? (a duck under a low ceiling stays a duck)
    const t0 = Math.floor((this.y - PH + 1) / T), t1 = Math.floor((this.y - CROUCH_H - 1) / T);
    for (let tx = Math.floor((this.x - 6) / T); tx <= Math.floor((this.x + 6) / T); tx++) for (let ty = t0; ty <= t1; ty++) if (room.solid(tx, ty)) return false;
    return true;
  }
  nearFloor(room) { const tx = Math.floor(this.x / T), ty = Math.floor((this.y + 2) / T); const v = room.get(tx, ty); return v === TILE.SOLID || v === TILE.PLAT || v === TILE.CRACK; }
  hurtSpikes() {
    if (this.invT > 0 && this.hurtT > 0) return;
    if (this.hurt(14, this.x + this.dir * 4, { kb: 1.2, unblockable: true, el: 'blood' }) && !this.dead) this.g.respawnAtSafe(this);
  }

  // ------------------------------------------------------------------ drawing
  frameInfo() { // {sheet, f, fx?} chosen from the current state
    const S = this;
    if (S.dead) return { sheet: 'hero_hurt', f: 2 };
    if (S.hurtT > 0) return { sheet: 'hero_hurt', f: S.hurtT > 12 ? 0 : S.hurtT > 5 ? 1 : 2 };
    if (S.atk) { const e = S.atkDur - S.atk, sq = S.seq; let f = 0; while (f + 1 < sq.starts.length && sq.starts[f + 1] <= e) f++; return sq.air ? { sheet: sq.sheet, f, cy: JATK_CY[f], ch: 80 } : { sheet: sq.sheet, f }; }
    if (S.castT) return { sheet: 'hero_attack', f: S.castT > 14 ? 0 : S.castT > 6 ? 1 : 2 };
    if (S.dashT > 0 || (S.dashCd > 22 && !S.onGround)) return { sheet: 'hero_run', f: 3 };
    if (!S.onGround) { const f = S.vy < -3 ? 1 : S.vy < -0.6 ? 2 : S.vy < 1.2 ? 3 : 4; return { sheet: 'hero_jump', f, cy: JUMP_CY[f], ch: 77 }; }
    if (S.crouch) return { sheet: 'hero_crouch', f: S.crouchT < 4 ? 1 : 2 };
    if (S.landedT > 4) return { sheet: 'hero_crouch', f: 1 };
    if (Math.abs(S.vx) > 0.3) return { sheet: 'hero_run', f: Math.floor(S.runT) % 12 };
    return { sheet: 'hero_idle', f: Math.floor(S.idleT / 11) % 4 };
  }
  // The swish of a swing stirs the air: it flings smoke, embers and fog along the blade's path and bends nearby flames away (see FX.gust).  A dash makes a wind of its own.
  swishWind() {
    const fx = this.g.fx, pts = this.swordPoints();
    if (this.dashT > 0 && this.t % 2 === 0) fx.gust(this.x - this.dir * 6, this.y - 16, this.dir * 3.2, 0, 38, 1.1, 22);
    if (!pts.length) { this.swishPrev = null; return; }
    let cx = 0, cy = 0, tx = 0, ty = 0, bd = -1; for (const [x, y] of pts) { cx += x; cy += y; const d = (x - this.x) ** 2 + (y - (this.y - 20)) ** 2; if (d > bd) { bd = d; tx = x; ty = y; } }       // the centre of the arc, and its tip (furthest from the hero)
    cx /= pts.length; cy /= pts.length; const pv = this.swishPrev; this.swishPrev = [cx, cy, tx, ty]; if (!pv) return;
    const clampv = v => Math.max(-7, Math.min(7, v)), vx = clampv((tx - pv[2]) * 0.8 + this.dir * 1.2), vy = clampv((ty - pv[3]) * 0.8), sp = Math.hypot(vx, vy);
    if (sp < 0.9) return;
    fx.gust(tx, ty, vx, vy, 30, Math.min(1.5, sp / 3.2)); fx.gust(cx, cy, vx * 0.6, vy * 0.6, 26, 0.8);
  }
  // the white cloak lives in the three.js layer: a hanging chain of points pinned to the shoulders (see cloak.js)
  stepCloak() {
    const c = this.g.fx.cloak; if (!c) return;
    c.setStain(this.stain);
    c.step({ x: Math.round(this.x), ay: Math.round(this.y) - (this.crouch ? 15 : 27), dir: this.dir, vx: this.vx, vy: this.vy, floorY: this.onGround ? Math.round(this.y) : undefined, sil: this.silhouette() });
  }
  // Where a point of the current frame's picture is in the world (mirrors exactly what drawSheet does with the frame: anchor, flip, jump-frame offset).
  spritePoint() {
    const fi = this.frameInfo(), s = SHEET[fi.sheet]; if (!s) return null;
    const jump = fi.cy !== undefined, ay = jump ? fi.cy / fi.ch : s.ay, flip = this.dir !== s.face, tx = Math.round(this.x), ty = Math.round(jump ? this.y - this.h / 2 + 1 : this.y);
    const X0 = Math.round(-s.w * s.ax) + s.dx * (flip ? -1 : 1), Y0 = Math.round(-s.h * ay) + s.dy;
    return { fi, rest: (sx, sy) => [flip ? tx - X0 - sx : tx + X0 + sx, ty + Y0 + sy] };
  }
  // The hero's silhouette for the frame being drawn: row (world y) -> { back, front } = world x of the sprite's back / front edge on that row, or null.
  // (mirrors exactly what drawSheet does with the frame: anchor, flip, jump-frame offset)
  silhouette() {
    const fi = this.frameInfo(), s = SHEET[fi.sheet], ex = s && sheetExtents(fi.sheet); if (!ex) return null;
    const jump = fi.cy !== undefined, ay = jump ? fi.cy / fi.ch : s.ay, flip = this.dir !== s.face, tx = Math.round(this.x), ty = Math.round(jump ? this.y - this.h / 2 + 1 : this.y);
    const X0 = Math.round(-s.w * s.ax) + s.dx * (flip ? -1 : 1), Y0 = Math.round(-s.h * ay) + s.dy, f = ((Math.floor(fi.f) % s.n) + s.n) % s.n, h = s.h, face = s.face;
    return wy => {
      const v = Math.floor(wy - ty - Y0); if (v < 0 || v >= h) return null;
      const lo = ex.blo[f * h + v], hi = ex.bhi[f * h + v]; if (lo < 0) return null;          // the body's outline (the baked cape is ignored: the cloak hangs from the shoulder)
      // the art faces `face`; its leftmost opaque column is the BACK when face = 1 (the rightmost when face = -1)
      const back = face === 1 ? lo : hi + 1, front = face === 1 ? hi + 1 : lo;
      return flip ? { back: tx - X0 - back, front: tx - X0 - front } : { back: tx + X0 + back, front: tx + X0 + front };
    };
  }
  drawFrame(ctx, fi, x, y, dir, o = {}) {
    const cw = A.settings.cloak && SHEET[fi.sheet + '_cw'] ? '_cw' : '', base = fi.sheet + cw;      // White Cloak on: the sprite without its baked cape (the cloak is drawn separately, behind it)
    const suf = this.ench && !o.flash ? '_' + this.ench.type : '';
    const sid = suf && SHEET[base + suf] ? base + suf : base;       // enchanted variants recolor the slash arc
    const jump = fi.cy !== undefined, yy = jump ? y - this.h / 2 + 1 : y, extra = jump ? { ay: fi.cy / fi.ch } : {};
    drawSheet(ctx, sid, fi.f, x, yy, { dir, ...extra, ...o });
    if (cw && !o.flash && !o.noFx) for (const k of STAIN_KEYS) {       // stains on the sprite's mantle: its cape-only mask, tinted, laid over it
      const a = this.stain[k]; if (a > 0.02) drawSheet(ctx, fi.sheet + '_cwm', fi.f, x, yy, { dir, ...extra, flash: STAINS[k].color, alpha: (o.alpha !== undefined ? o.alpha : 1) * Math.min(0.6, a * 0.65) });
    }
  }
  draw(ctx, cx, cy) {
    const x = this.x - cx, y = this.y - cy;
    for (const t of this.trail) this.drawFrame(ctx, t.f, t.x - cx, t.y - cy, t.dir, { flash: '#7c5cff', alpha: t.life / 14 * 0.45, noFx: true });
    if (this.invT > 0 && this.hurtT === 0 && this.dashT === 0 && this.dashCd < 22 && Math.floor(this.invT / 3) % 2 === 0) { ctx.globalAlpha = 0.35; }
    if (this.onGround) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(x - 7), Math.round(y - 1), 14, 2); }     // soft shadow
    const cl = this.g.fx.cloak; if (cl && A.settings.cloak) cl.draw(ctx, cx, cy, this.dead ? Math.max(0, 1 - Math.max(0, this.deathT - 60) / 60) : 1);       // the cloak hangs BEHIND the hero
    this.drawFrame(ctx, this.frameInfo(), x, y, this.dir, this.dead ? { alpha: Math.max(0, 1 - Math.max(0, this.deathT - 60) / 60) } : {});
    ctx.globalAlpha = 1;
  }
}
