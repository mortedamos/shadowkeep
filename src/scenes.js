// Short scripted scenes: the game holds the world still (the hero can neither move nor strike, and the monsters neither move nor attack), black bars slide in, and a few things happen.
// A scene is started by the game (see Game.stepPlay) by setting game.cutscene = { scene }; it ends itself by clearing game.cutscene.
import { W, H, T, rand, clamp } from './util.js';
import { drawText } from './font.js';
import { isSolid } from './world.js';
import { STORY } from './story.js';
import { Input } from './input.js';
import { Audio_ as A } from './audio.js';
import { drawSheet } from './assets.js';
import { roomFlames } from './decor.js';

const BAR = 26;                                                        // the letterbox bars, in screen pixels

// ------------------------------------------------------------------------------------------------ the Cinder Warden sets Prague alight
// Played once, near the start of Smouldering Lane, the first street beyond the Waystone Square.  The Warden steps out, hurls three torches at the houses - each one that lands
// sets its house burning - turns to look at the hero, and strides off east.  From then on the whole village burns (save flag `village_fire`).
export class VillageScene {
  constructor(g) {
    this.g = g; this.r = g.room; this.t = 0; this.bars = 0; this.torches = []; this.done = false;
    const wx = Math.min(this.r.pw - 3 * T, g.player.x + 125); let ty = Math.max(0, Math.floor(g.player.y / T) - 5); while (ty < this.r.h - 1 && !isSolid(this.r.get(Math.floor(wx / T), ty))) ty++;          // (the street is as tall as the Orloj: he stands on the ground wherever it is)
    this.w = { x: wx, y: ty * T, dir: -1, vx: 0, on: false, pose: 'idle', st: 0 };          // (he steps out of the dark a little way ahead of the hero)
    const best = new Map();                                            // the houses of this street: where the biggest fire of each will burn
    for (const d of this.r.decos) if (d.t === 'blaze' && d.burn) { const b = best.get(d.burn); if (!b || (b.small && !d.small)) best.set(d.burn, d); }
    const near = [...best.values()].map(d => ({ key: d.burn, x: d.x, y: d.y })).sort((a, b) => Math.abs(a.x - this.w.x) - Math.abs(b.x - this.w.x));
    const houses = near.filter(h => Math.abs(h.x - g.player.x) < 185).concat(near.filter(h => Math.abs(h.x - g.player.x) >= 185));          // (those in view first)
    this.throws = [50, 86, 122].slice(0, houses.length).map((t, i) => ({ t, target: houses[i] }));
    g.playerFrozen = true; g.player.invT = 9999; g.player.vx = 0; g.player.dir = 1;
  }
  appear() {
    const g = this.g, w = this.w; w.on = true; A.sfx('roar'); g.shake(4, 36); g.fx.flash([1, 0.5, 0.2], 0.35); g.fx.ring(w.x, w.y - 40, 120, [1, 0.5, 0.2], 40, 0.1);
    for (let i = 0; i < 8; i++) g.fx.fire(w.x + rand(-22, 22), w.y - rand(0, 70), { scale: 1.0, n: 1 });
    g.fx.sparks(w.x, w.y - 40, 26, [[1, 0.7, 0.3], [1, 0.4, 0.1]], 4, { gy: 0.05 });
  }
  launch(th) {
    const g = this.g, w = this.w, x0 = w.x + w.dir * 22, y0 = w.y - 70, N = 40, grav = 0.12, tx = th.target.x, ty = th.target.y;
    A.sfx('fire'); g.fx.ring(x0, y0, 26, [1, 0.5, 0.2], 14);
    this.torches.push({ x: x0, y: y0, vx: (tx - x0) / N, vy: (ty - y0 - 0.5 * grav * N * N) / N, grav, t: 0, N, rot: 0, key: th.target.key });
  }
  land(th) {
    const g = this.g, r = this.r; A.sfx('boom'); g.shake(3, 12); g.fx.flash([1, 0.55, 0.2], 0.22); g.fx.ring(th.x, th.y, 70, [1, 0.55, 0.2], 22, 0.14);
    g.fx.sparks(th.x, th.y, 22, [[1, 0.8, 0.4], [1, 0.45, 0.1]], 4, { gy: 0.12 });
    r.ignited.add(th.key); g.flames = roomFlames(r);                   // the house catches
  }
  update() {
    const g = this.g, fx = g.fx, p = g.player, w = this.w, r = this.r, t = ++this.t;
    p.vx = 0; p.dir = 1; p.invT = Math.max(p.invT, 9999);
    this.bars = t < 20 ? t / 20 : t > 255 ? Math.max(0, 1 - (t - 255) / 20) : 1;
    if (t === 24) this.appear();
    if (w.on) {
      fx.light(w.x, w.y - 40, 100, 0.7); if (t % 5 === 0) fx.fire(w.x + rand(-14, 14), w.y - rand(8, 60), { scale: 0.5, n: 1 });
      if (t < 215) w.pose = 'idle';
      for (const th of this.throws) { if (t >= th.t && t < th.t + 40) { w.pose = 'throw'; w.st = t - th.t; } if (t === th.t + 22) this.launch(th); }
      if (t === 200) { A.sfx('roar'); g.shake(4, 30); fx.flash([1, 0.5, 0.2], 0.2); fx.ring(w.x, w.y - 40, 100, [1, 0.5, 0.2], 36, 0.1); }       // he turns on the hero, and roars
      if (t >= 215 && t < 246) { w.dir = 1; w.pose = 'walk'; w.vx = 2.2; w.x += w.vx; if (t % 3 === 0) fx.fire(w.x - 12, w.y - rand(0, 34), { scale: 0.6, n: 1 }); }
      if (t === 246) { w.on = false; A.sfx('boom'); g.shake(3, 14); fx.flash([1, 0.5, 0.2], 0.25); fx.ring(w.x, w.y - 40, 90, [1, 0.5, 0.2], 28, 0.12); for (let i = 0; i < 10; i++) fx.fire(w.x + rand(-20, 20), w.y - rand(0, 70), { scale: 1.0, n: 1 }); fx.sparks(w.x, w.y - 40, 30, [[1, 0.7, 0.3], [1, 0.4, 0.1]], 4, { gy: 0.05 }); }          // he turns to flame and is gone
    }
    for (let i = this.torches.length - 1; i >= 0; i--) {
      const th = this.torches[i]; th.vy += th.grav; th.x += th.vx; th.y += th.vy; th.rot += 0.3; th.t++;
      fx.fire(th.x, th.y - 3, { scale: 0.45, n: 1 }); fx.light(th.x, th.y, 46, 0.7);
      if (th.t >= th.N) { this.land(th); this.torches.splice(i, 1); }
    }
    if (t >= 275) this.finish();
  }
  finish() {
    const g = this.g, S = g.save, p = g.player, r = this.r, def = g.world.rooms[r.id];
    S.flags.village_fire = true; g.flames = roomFlames(r); this.done = true;
    g.fx.setAmbient(def.ambient, def.tint, def.vig); g.fx.setAmbientFx(def.weather);          // the dusk is over: the village burns
    g.cutscene = null; g.playerFrozen = false; p.invT = 60; g.saveGame();
    g.banner('PRAGUE BURNS', '', 150, { y: 52, color: '#ffb070' });
  }
  drawWorld(ctx, cx, cy) {
    const w = this.w, t = this.t;
    if (w.on) {
      let id = 'ars_gnu_r0', f = Math.floor(t / 12) % 5;
      if (w.pose === 'throw') { id = 'ars_gnu_r2'; f = w.st < 20 ? 0 : 1; } else if (w.pose === 'walk') { id = 'ars_gnu_r1'; f = Math.floor(t / 8) % 5; }
      drawSheet(ctx, id, f, w.x - cx, w.y - cy + 1, { dir: w.dir, scale: 0.95 });
    }
    for (const th of this.torches) { ctx.save(); ctx.translate(Math.round(th.x - cx), Math.round(th.y - cy)); ctx.rotate(th.rot); ctx.fillStyle = '#4a2c14'; ctx.fillRect(-1, -5, 3, 10); ctx.fillStyle = '#ffb040'; ctx.fillRect(-2, -7, 5, 3); ctx.restore(); }
  }
  drawTop(top) { if (this.bars > 0) { top.fillStyle = '#000'; const h = Math.round(BAR * this.bars); top.fillRect(0, 0, W, h); top.fillRect(0, H - h, W, h); } }
}

// ------------------------------------------------------------------------------------------------ the opening: a grave on a hill above Prague
// Played once, when a new game begins (flag opening_seen).  Rain, a tolling bell, the Stranger kneeling at a grave with a blue candle burning on it - the ghost who walks behind him shows faintly in
// its light - and the title card PRAGUE 1541.  Then the glow of fire rises over the roofs far below; he lifts his head, rises, draws Silberzahn, turns to the city and walks down to it.
export class OpeningScene {
  constructor(g) {
    this.g = g; this.r = g.room; this.t = 0; this.bars = 0; this.kneel = true; this.done = false;
    const gv = this.r.decos.find(d => d.t === 'grave'); this.gx = gv ? gv.x : 168;
    const p = g.player; p.x = this.gx + 36; p.y = 12 * T; p.vx = p.vy = 0; p.dir = -1; p.onGround = true; p.invT = 9999; p.crouch = false;
    g.playerFrozen = true; this.r.glow = 0; g.snapCamera(); g.ghost.snap(); g.ghost.update();
  }
  update() {
    const g = this.g, p = g.player, fx = g.fx, r = this.r, t = ++this.t;
    if (t > 30 && (Input.pressed.confirm || Input.pressed.pause || Input.pressed.back)) { p.dir = 1; this.finish(); return; }          // (a key skips it)
    p.invT = 9999; this.bars = t < 24 ? t / 24 : t > 700 ? Math.max(0, 1 - (t - 700) / 24) : 1;
    r.glow = clamp((t - 330) / 320, 0, 1) * 0.95;
    if (t === 40 || t === 440) A.sfx('toll');
    if (t === 500) this.kneel = false;                                                      // he rises
    if (t === 525) p.dir = 1;                                                               // and turns to the city
    if (t === 590) { A.sfx('slash'); fx.flash([0.8, 0.9, 1], 0.28); fx.sparks(p.x + 14, p.y - 22, 14, [[1, 1, 1], [0.7, 0.85, 1]], 3, {}); }          // the silver glints
    if (t >= 650) { p.dir = 1; p.vx = 1.6; }                                                // and he walks
    if (r.glow > 0.1 && t % 7 === 0) fx.emit({ x: fx.camX + W + 4, y: fx.camY + rand(30, 150), vx: -rand(0.6, 1.4), vy: -rand(0.1, 0.5), life: rand(90, 160), s0: 3, s1: 1, c0: [1, 0.6, 0.2], c1: [0.7, 0.1, 0.05], a0: 0.8, a1: 0, kind: 1, gy: -0.002 });          // sparks on the wind
    if (t >= 724) this.finish();
  }
  finish() {
    const g = this.g, p = g.player; this.done = true; this.kneel = false; g.save.flags.opening_seen = true; this.r.glow = 0;
    g.cutscene = null; g.playerFrozen = false; p.invT = 60;
  }
  drawWorld() {}
  drawTop(top) {
    const t = this.t, fade = (a, b) => clamp(Math.min((t - a) / 30, (b - t) / 30), 0, 1);
    if (this.bars > 0) { top.fillStyle = '#000'; const h = Math.round(26 * this.bars); top.fillRect(0, 0, W, h); top.fillRect(0, H - h, W, h); }
    const O = STORY.opening;
    let k = fade(40, 200); if (k > 0) drawText(top, O.title, W / 2, 70, { align: 'center', scale: 3, color: '#e8b84a', outline: '#200', alpha: k });
    k = fade(215, 360); if (k > 0) drawText(top, O.sun, W / 2, H - 19, { align: 'center', color: '#e8dcc0', outline: '#000', alpha: k });
    k = fade(390, 560); if (k > 0) drawText(top, O.fire, W / 2, H - 19, { align: 'center', color: '#ffb070', outline: '#000', alpha: k });
    k = fade(590, 720); if (k > 0) { drawText(top, O.sword[0], W / 2, 64, { align: 'center', scale: 2.4, color: '#cfe0ff', outline: '#10182a', alpha: k }); drawText(top, O.sword[1], W / 2, 88, { align: 'center', color: '#a8b8d8', outline: '#000', alpha: k }); }
  }
}
