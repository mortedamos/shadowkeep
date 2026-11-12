// More inhabitants: the panicking villagers of the burning town (Gothicvania Town, ansimuz CC0), the swamp creatures (Gothicvania Swamp, ansimuz CC0)
// and the cultists / gnu knight from "Bosses and Monsters Spritesheets" (Balmer, CC-BY 3.0, with Redshrike).
import { Enemy, Armor, Wizard, Zombie, Hound } from './enemies.js';
import { drawSheet } from './assets.js';
import { Audio_ as A } from './audio.js';
import { dropItem } from './props.js';
import { ITEMS, addItem, itemCount } from './itemdata.js';
import { COLORS } from './fx.js';
import { groundAhead, wallAhead } from './entity.js';
import { T, rand, dist, approach, overlap } from './util.js';

// ------------------------------------------------------------------------------------------------ VILLAGER (harmless, terrified)
const SHOUTS = ['HELP!', 'RUN!', 'THEY COME!', 'MERCY!', 'THE FIRE!', 'NO, NO!', 'SAVE US!', 'MONSTERS!'];
const THANKS = ['THANK YOU!', 'BLESS YOU!', 'BRAVE ONE!'];
// what they say.  Out in the street they are frightened; indoors they are calm.  Each has a gift for you the first time you talk (and a different line after).
const TITLES = { woman: 'WOMAN', bearded: 'BEARDED MAN', hatman: 'MAN IN A HAT', oldman: 'OLD MAN' };
const LINES = {
  woman: { street: ['THE THINGS CAME DOWN FROM THE HILL AT DUSK. IF YOU ARE GOING UP TO THE KEEP, PLEASE - TAKE THIS. IT IS ALL I CAN SPARE.', 'THE FIRE TOOK OUR HOUSE FIRST. DO NOT LET THEM CATCH ME, STRANGER. TAKE THIS FOR THE ROAD.'], home: 'WE BARRED THE DOOR AND LIT EVERY CANDLE WE HAD. THE FIRE WILL NOT COME IN WHILE THEY BURN. HERE - YOU LOOK LIKE YOU NEED THIS.', again: ['BLESS YOU, STRANGER. BE CAREFUL OUT THERE.', 'I PRAY FOR YOU EVERY TIME THE BELLS STAY SILENT.'] },
  bearded: { street: ['I HEARD THE BELLS STOP. THEN THE SCREAMING. KEEP YOUR BLADE UP, STRANGER, AND TAKE THIS FOR THE ROAD.', 'I WAS A SOLDIER ONCE. THESE THINGS DO NOT BLEED RIGHT. HIT THEM TWICE. HERE - TAKE THIS.'], home: 'I SHARPENED EVERY BLADE IN THE HOUSE AND STILL I HIDE. SHAME, THAT. YOU TAKE ONE - YOU WILL USE IT BETTER.', again: ['THE ROAD NORTH IS BAD. THE ROAD SOUTH IS WORSE.', 'AIM LOW AT THE HOUNDS. THEY LEAP.'] },
  hatman: { street: ['NOBODY LEAVES THE VILLAGE. THE GATE IS SHUT FROM THE OTHER SIDE. DO YOU HEAR ME? FROM THE OTHER SIDE. TAKE THIS.', 'I HAVE A COIN OR TWO AND NOWHERE TO SPEND THEM. THE MARKET IS ASH. TAKE IT.'], home: 'MY CELLAR HAS HELD OUT THREE NIGHTS. IF YOU REACH THE KEEP, TELL THEM THE VILLAGE STILL STANDS. TAKE THIS FOR LUCK.', again: ['TELL THEM THE VILLAGE STILL STANDS.', 'KEEP YOUR HAT ON. IT IS LUCKY. MINE IS.'] },
  oldman: { street: ['I HAVE SEEN THIS FIRE BEFORE, WHEN I WAS A BOY. THE LORD OF THE KEEP DOES NOT FORGET A DEBT. GO ON - AND TAKE THIS.', 'RUN? AT MY AGE? NO. BUT YOU, YOU CAN STILL RUN - OR FIGHT. TAKE THIS.'], home: 'MY KNEES ARE TOO OLD FOR RUNNING, AND MY HOUSE IS TOO OLD FOR BURNING. IT WILL HOLD. HERE, FOR THE LONG WALK.', again: ['THE KEEP SWALLOWED THE SUN. SOMEONE MUST COAX IT BACK.', 'STAY AND SIT A WHILE. NO? THEN GO WITH GOD.'] },
};
// what a merchant says when you speak to him (the offer follows)
const plural = (n, w) => n === 1 || /S$|WATER$/.test(w) ? w : /(X|CH|SH)$/.test(w) ? w + 'ES' : w + 'S';
const SHOP = { woman: ['WELCOME, STRANGER. I HAVE A LITTLE TO SPARE - FOR A PRICE.', 'COME IN, COME IN. MIND THE FLOOR.'], bearded: ['YOU LOOK LIKE YOU CAN PAY. GOOD.', 'I TRADE IN WHAT I CAN CARRY OUT OF THE FIRE.'], hatman: ['A CUSTOMER! IN THESE TIMES!', 'COIN IS COIN, EVEN NOW. LET US TALK.'], oldman: ['AH. A BUYER. SIT, IF YOU LIKE.', 'I HAVE KEPT A FEW THINGS BACK FOR A RAINY DAY. IT IS RAINING.'] };
const GIFTS = { woman: ['it_bandage'], bearded: ['it_dagger'], hatman: ['coin', 'it_torch'], oldman: ['it_holy', 'heart'] };
export class Villager extends Enemy {
  constructor(g, x, y, o) {
    super(g, x, y, 12, 40, o); this.name = 'villager'; this.hp = this.maxHp = 99; this.invuln = true; this.harmless = true; this.kind = o.kind || ['woman', 'bearded', 'hatman', 'oldman'][Math.floor(rand(4))];
    this.dir = Math.random() < 0.5 ? -1 : 1; this.mode = 'run'; this.st = 0; this.len = 50 + rand(90); this.speed = (this.kind === 'oldman' ? 0.7 : 1.0) + rand(0.35); this.shout = 60 + rand(240); this.kills = g.kills; this.o = o; this.uid = o.uid; this.calm = !!o.calm; this.stand = !!o.stand; this.sells = o.sells || null;
    if (this.calm) { this.speed = 0.28 + rand(0.14); this.mode = this.stand || Math.random() < 0.5 ? 'idle' : 'walk'; this.len = 60 + rand(120); }
  }
  hitBy() { return false; }                                  // the sword passes through them
  // UP: a few words, and a gift the first time
  talk(g) {
    const key = 'talk_' + (this.uid || g.room.id + '_' + Math.round(this.x / 16)), L = LINES[this.kind] || LINES.woman, first = !g.save.flags[key], pickOne = a => a[Math.floor(rand(a.length))];
    const name = this.o.title || TITLES[this.kind] || 'VILLAGER', gifts = this.o.gifts || (this.sells ? [] : GIFTS[this.kind] || ['coin']);
    A.sfx('select'); this.dir = g.player.x >= this.x ? 1 : -1;
    if (this.sells && !(first && gifts.length)) { g.save.flags[key] = true; return this.offer(g, name, first ? pickOne(SHOP[this.kind] || SHOP.woman) : (this.o.again || pickOne(SHOP[this.kind] || SHOP.woman))); }       // a merchant: a greeting and the offer in one box
    const text = first ? (this.o.text || (this.calm ? L.home : pickOne(L.street))) : (this.o.again || pickOne(L.again));
    g.showDialog(text, { name, onClose: () => {
      if (first) {
        g.save.flags[key] = true; const hx = this.x + this.dir * 8, hy = this.y - 22;
        for (const k of gifts) dropItem(g, k, hx + rand(-6, 6), hy);
        if (gifts.length) { g.popup(this.x, this.y - 58, 'A GIFT', '#ffe9a0'); A.sfx('pickup'); }
      }
      if (this.sells) this.offer(g, name, '');                                           // (after the gift, he has something to sell as well)
    } });
  }
  // A MERCHANT'S OFFER: a pack of one item for coins.  If you can pay, a YES / NO box asks; if you cannot, he says so.  He only has so much stock, and will not sell what you cannot carry.
  offer(g, name, greeting) {
    const S = g.save, s = this.sells, it = ITEMS[s.item], stockKey = 'stock_' + (this.uid || g.room.id), sold = S.flags[stockKey] || 0, have = itemCount(S, s.item), pre = greeting ? greeting + ' ' : '';
    if (sold >= (s.stock || 3)) return g.showDialog(pre + 'I HAVE NOTHING MORE TO SELL YOU.', { name });
    if (have >= it.max) return g.showDialog(pre + 'YOU ARE ALREADY CARRYING ALL THE ' + it.short + ' YOU CAN HOLD.', { name });
    const qty = Math.min(s.qty || it.pack, it.max - have), price = s.price || it.price, line = pre + 'I CAN SELL YOU ' + qty + ' ' + plural(qty, it.short) + ' FOR ' + price + ' COINS.';
    if (S.gold < price) return g.showDialog(line + ' BUT YOU DO NOT HAVE ENOUGH. COME BACK WHEN YOU DO.', { name, footer: 'COINS ' + S.gold });
    g.showDialog(line + ' WILL YOU TAKE IT?', { name, choices: ['YES', 'NO'], footer: 'COINS ' + S.gold, onClose: ch => {
      if (ch !== 0) return;
      S.gold -= price; const n = addItem(S, s.item, qty); S.flags[stockKey] = sold + 1; A.sfx('coin');
      g.popup(g.player.x, g.player.y - 46, '+' + n + ' ' + plural(n, it.short), '#ffe9a0'); g.popup(this.x, this.y - 58, '-' + price, '#ffd36a');
    } });
  }
  // indoors they are calm: they stand about, or amble a few steps, and turn to face you when you come near
  calmAi(g) {
    const p = g.player, near = Math.abs(p.x - this.x) < 70 && Math.abs(p.y - this.y) < 40;
    if (this.stand || this.mode === 'idle') {
      this.vx = approach(this.vx, 0, 0.15); if (near) this.dir = p.x >= this.x ? 1 : -1;
      if (!this.stand && this.st > this.len) { this.mode = 'walk'; this.st = 0; this.len = 40 + rand(80); this.dir = Math.random() < 0.5 ? -1 : 1; }
      return;
    }
    if (wallAhead(this, g.room, 3) || !groundAhead(this, g.room, 6)) { this.dir *= -1; this.st = Math.max(this.st, this.len - 12); }
    this.vx = approach(this.vx, this.dir * this.speed, 0.04);
    if (this.st > this.len) { this.mode = 'idle'; this.st = 0; this.len = 90 + rand(160); }
  }
  threat() {                                                 // nearest monster that could hurt them
    let best = null, bd = 95;
    for (const e of this.g.enemies) { if (e === this || e.dead || e.harmless || e.invuln || e instanceof Villager) continue; const d = Math.abs(e.x - this.x); if (d < bd && Math.abs(e.y - this.y) < 50) { bd = d; best = e; } }
    return best;
  }
  ai(g) {
    this.st++; if (this.calm) return this.calmAi(g);
    if (this.shout > 0) this.shout--;
    const th = this.threat(), p = g.player;
    if (g.kills > this.kills && Math.abs(p.x - this.x) < 110 && Math.random() < 0.5) g.popup(this.x, this.y - 54, THANKS[Math.floor(rand(THANKS.length))], '#ffe9a0');     // you just killed something nearby
    this.kills = g.kills;
    if (th) {                                                // flee from the monster, flat out
      this.dir = this.x >= th.x ? 1 : -1; if (wallAhead(this, g.room, 3) || !groundAhead(this, g.room, 6)) this.dir *= -1;
      this.vx = approach(this.vx, this.dir * this.speed * 1.7, 0.12); this.mode = 'run';
      if (this.shout === 0) { this.shout = 140 + rand(160); g.popup(this.x, this.y - 54, SHOUTS[Math.floor(rand(SHOUTS.length))], '#ff9a7a'); }
      return;
    }
    if (this.mode === 'run') {                               // milling about in a panic: dash one way, stop, dash back
      if (wallAhead(this, g.room, 3) || !groundAhead(this, g.room, 6)) this.dir *= -1;
      this.vx = approach(this.vx, this.dir * this.speed, 0.08);
      if (this.st > this.len) { this.mode = Math.random() < 0.4 ? 'cower' : 'run'; this.st = 0; this.len = this.mode === 'cower' ? 50 + rand(70) : 40 + rand(110); if (this.mode === 'run' && Math.random() < 0.6) this.dir *= -1; }
    } else { this.vx = approach(this.vx, 0, 0.2); if (this.st > this.len) { this.mode = 'run'; this.st = 0; this.len = 50 + rand(80); this.dir = Math.random() < 0.5 ? -1 : 1; } }
    if (this.shout === 0 && Math.abs(p.x - this.x) < 150) { this.shout = 200 + rand(240); g.popup(this.x, this.y - 54, SHOUTS[Math.floor(rand(SHOUTS.length))], '#ffd0a0'); }
  }
  draw(ctx, cx, cy) { const moving = Math.abs(this.vx) > 0.15, id = `npc_${this.kind}_${moving ? 'walk' : 'idle'}`, sh = SHEETS_N[id] || 4; this.spr(ctx, id, Math.floor(this.t / (moving ? 5 : 9)) % sh, cx, cy, { dir: moving ? Math.sign(this.vx) : this.dir }); }     // always face the way they are actually running (dir flips a beat before vx does)
}
const SHEETS_N = { npc_bearded_idle: 5, npc_bearded_walk: 6, npc_hatman_idle: 4, npc_hatman_walk: 6, npc_oldman_idle: 8, npc_oldman_walk: 12, npc_woman_idle: 7, npc_woman_walk: 6 };

// ------------------------------------------------------------------------------------------------ SWAMP SPIDER (springs at you)
class SwampSpider extends Enemy {
  constructor(g, x, y, o) { super(g, x, y, 22, 14, o); this.name = 'swampspider'; this.hp = this.maxHp = 9; this.dmg = 7; this.xp = 8; this.state = 'patrol'; this.st = 0; this.cool = 30 + rand(40); this.dir = Math.random() < 0.5 ? -1 : 1; this.kbRes = 0.2; this.deathFx = COLORS.green; }
  ai(g) {
    const p = g.player, d = Math.abs(this.dx()), same = Math.abs(p.y - this.y) < 40; this.st++; if (this.cool > 0) this.cool--;
    if (this.state === 'patrol') {
      if (!groundAhead(this, g.room, 6) || wallAhead(this, g.room, 3)) this.dir *= -1; this.vx = approach(this.vx, this.dir * 0.5, 0.05);
      if (same && d < 110 && this.cool === 0) { this.state = 'crouch'; this.st = 0; this.vx = 0; this.face(); A.sfx('tell'); }
    } else if (this.state === 'crouch') { this.vx = 0; if (this.st > 22) { this.state = 'leap'; this.st = 0; this.vy = -3.1; this.vx = this.dir * 2.1; A.sfx('flap'); } }       // TELL: it squats before it springs
    else if (this.state === 'leap') { if (this.onGround && this.st > 6) { this.state = 'patrol'; this.cool = 80 + rand(40); this.vx = 0; } }
  }
  draw(ctx, cx, cy) { const f = this.state === 'crouch' ? 0 : this.state === 'leap' ? 2 : Math.floor(this.t / 8) % 4; this.spr(ctx, 'swamp_spider', f, cx, cy + 1, { dy: this.state === 'crouch' ? 2 : 0 }); }
}

// ------------------------------------------------------------------------------------------------ SWAMP THING (slow, heavy swing)
class SwampThing extends Enemy {
  constructor(g, x, y, o) { super(g, x, y, 18, 40, o); this.name = 'swampthing'; this.hp = this.maxHp = 22; this.dmg = 11; this.xp = 14; this.kbRes = 0.5; this.state = 'walk'; this.st = 0; this.cool = 0; this.deathFx = COLORS.green; this.heavy = true; }
  ai(g) {
    const p = g.player, d = Math.abs(this.dx()); this.st++; if (this.cool > 0) this.cool--;
    if (this.state === 'walk') {
      this.face(); if (d > 26 && d < 240 && groundAhead(this, g.room, 6) && !wallAhead(this, g.room, 3)) this.vx = approach(this.vx, this.dir * 0.42, 0.05); else this.vx = approach(this.vx, 0, 0.1);
      if (d < 36 && this.cool === 0 && Math.abs(p.y - this.y) < 40) { this.state = 'wind'; this.st = 0; this.vx = 0; A.sfx('tell'); }
    } else if (this.state === 'wind') { this.vx = 0; this.face(); if (this.st % 8 === 0) g.fx.burst(this.x + this.dir * 8, this.y - 34, 2, COLORS.green, { speed: 0.6, s0: 6 }); if (this.st > 30) { this.state = 'strike'; this.st = 0; A.sfx('slash'); } }      // TELL: it rears up, dripping
    else if (this.state === 'strike') { if (this.st === 2) { const hb = { x: this.dir > 0 ? this.x + 2 : this.x - 38, y: this.y - 40, w: 36, h: 40 }; g.fx.sparks(this.x + this.dir * 24, this.y - 18, 8, COLORS.green, 2.6); if (overlap(hb, p.hurtbox)) p.hurt(this.dmg, this.x); } if (this.st > 12) { this.state = 'rec'; this.st = 0; } }
    else if (this.state === 'rec') { this.vx = 0; if (this.st > 30) { this.state = 'walk'; this.cool = 50; } }
  }
  draw(ctx, cx, cy) { const f = this.state === 'wind' ? 0 : this.state === 'strike' ? 2 : this.state === 'rec' ? 1 : Math.floor(this.t / 12) % 4; this.spr(ctx, 'swamp_thing', f, cx, cy + 1); }
}

// ------------------------------------------------------------------------------------------------ CULTISTS (cast, then blink away - the Wizard's brain in new robes)
// disciple (45x51): blue-robed acolyte.  mage-2 (122x110, drawn at 0.55): the archmage with the glowing staff.
class Cultist extends Wizard {
  constructor(g, x, y, o, cfg) {
    super(g, x, y, o); Object.assign(this, cfg.stats); this.cfg = cfg; this.hp = this.maxHp = cfg.stats.hp; this.scale = cfg.scale || 1; this.name = cfg.name; this.deathFx = cfg.fx;
  }
  draw(ctx, cx, cy) {
    const c = this.cfg, cast = this.state === 'cast', sc = this.scale || 1, row = cast && c.cast ? c.cast : c.idle, n = c.n;
    this.spr(ctx, row, cast && c.cast ? Math.min(n - 1, Math.floor(this.st / (52 / n))) : Math.floor(this.t / 9) % n, cx, cy + 1);
    if (this.alpha > 0.3) {
      const tx = this.x - this.dir * c.tip[0] * sc, ty = this.y - c.tip[1] * sc;           // the staff tip: swells while a spell gathers (the tell), then flashes as it fires
      this.g.fx.glow(tx, ty, cast ? 6 + Math.min(22, this.st * 0.5) : 5, c.glow, (cast ? 0.35 + this.st * 0.012 : 0.22) * this.alpha);
    }
  }
}
class Acolyte extends Cultist { constructor(g, x, y, o) { super(g, x, y, o, { name: 'acolyte', idle: 'ars_disciple_r0', cast: null, tip: [13, 47], n: 4, scale: 1, fx: COLORS.blue, glow: [0.2, 0.45, 1], stats: { hp: 16, dmg: 6, xp: 14, shot: 'orb', shotDmg: 8, shotSpd: 1.6 } }); } }
class Archmage extends Cultist { constructor(g, x, y, o) { super(g, x, y, o, { name: 'archmage', idle: 'ars_mage2_r0', cast: 'ars_mage2_r1', tip: [-45, 98], n: 4, scale: 0.55, fx: COLORS.purple, glow: [0.7, 0.3, 1], stats: { hp: 30, dmg: 8, xp: 26, shot: 'fire', shotDmg: 12, shotSpd: 2.0 } }); this.h = 40; } }

// ------------------------------------------------------------------------------------------------ GNU KNIGHT (the heavy guard - Armor's shield-and-swing logic, new body)
class GnuKnight extends Armor {
  constructor(g, x, y, o) { super(g, x, y, o); this.name = 'gnuknight'; this.hp = this.maxHp = 40; this.dmg = 15; this.xp = 24; this.scale = 0.6; this.deathFx = COLORS.gold; }
  draw(ctx, cx, cy) {
    let id = 'ars_gnu_r0', f = Math.floor(this.t / 12) % 5, dx = 0;
    if (this.state === 'walk') { id = 'ars_gnu_r1'; f = Math.floor(this.t / 8) % 5; }
    else if (this.state === 'wind') { f = 3; dx = -this.dir * Math.min(5, this.st * 0.3) + Math.sin(this.st * 1.7); this.g.fx.glow(this.x + this.dir * 10, this.y - 52, 8 + this.st * 0.35, [1, 0.85, 0.45], 0.25 + this.st * 0.015); }
    else if (this.state === 'strike') { id = 'ars_gnu_r1'; f = 2; dx = this.dir * (this.st < 6 ? 10 : 5); }
    else if (this.state === 'rec') f = 0;
    this.spr(ctx, id, f, cx, cy + 1, { dx }); this.g.fx.light(this.x, this.y - 24, 38, 0.3);
  }
}

// ------------------------------------------------------------------------------------------------ ZEALOT (Szadi pixel platformer set, public domain: the sickle fighter)
// A quick red-robed cultist.  He closes the distance, plants his feet (the tell: a raised sickle and a ring), then lunges through a wide slash.
class Zealot extends Enemy {
  constructor(g, x, y, o) { super(g, x, y, 14, 32, o); this.name = 'zealot'; this.hp = this.maxHp = 17; this.dmg = 9; this.xp = 13; this.kbRes = 0.3; this.state = 'idle'; this.st = 0; this.cool = 30 + rand(40); this.deathFx = COLORS.red; this.dir = Math.random() < 0.5 ? -1 : 1; this.speed = 0.65 + rand(0.2); }
  ai(g) {
    const p = g.player, d = Math.abs(this.dx()), same = Math.abs(p.y - this.y) < 44; this.st++; if (this.cool > 0) this.cool--;
    if (this.state === 'idle') {
      if (d < 170 && same) {
        this.face(); if (d > 52 && groundAhead(this, g.room, 6) && !wallAhead(this, g.room, 3)) this.vx = approach(this.vx, this.dir * this.speed * 1.4, 0.08); else this.vx = approach(this.vx, 0, 0.2);
        if (d < 72 && this.cool <= 0) { this.state = 'wind'; this.st = 0; this.vx = 0; A.sfx('tell'); g.fx.ring(this.x, this.y - 18, 14, [1, 0.4, 0.3], 14, 0.3); }
      } else { if (!groundAhead(this, g.room, 6) || wallAhead(this, g.room, 3)) this.dir *= -1; this.vx = approach(this.vx, this.dir * this.speed * 0.6, 0.05); }
    } else if (this.state === 'wind') { this.vx = 0; if (this.st === 1) this.face(); if (this.st > 22) { this.state = 'slash'; this.st = 0; A.sfx('slash'); } }
    else if (this.state === 'slash') {
      this.vx = this.dir * (this.st < 10 ? 3.1 : 0.4); if (!groundAhead(this, g.room, 4) || wallAhead(this, g.room, 3)) this.vx = 0;
      if (this.st >= 2 && this.st <= 9) { const hb = { x: this.dir > 0 ? this.x - 4 : this.x - 36, y: this.y - 36, w: 40, h: 36 }; if (overlap(hb, p.hurtbox)) p.hurt(this.dmg, this.x); }
      if (this.st > 14) { this.state = 'rec'; this.st = 0; }
    } else if (this.state === 'rec') { this.vx = approach(this.vx, 0, 0.2); if (this.st > 28) { this.state = 'idle'; this.cool = 45 + rand(40); } }
  }
  draw(ctx, cx, cy) {
    let id = 'reaper_idle', f = Math.floor(this.t / 9) % 6;
    if (this.state === 'idle' && Math.abs(this.vx) > 0.2) { id = 'reaper_run'; f = Math.floor(this.t / 6) % 7; }
    else if (this.state === 'wind') { id = 'reaper_attack'; f = Math.min(2, Math.floor(this.st / 8)); }
    else if (this.state === 'slash') { id = 'reaper_attack'; f = Math.min(7, 3 + Math.floor(this.st / 3)); }
    this.spr(ctx, id, f, cx, cy + 1, { scale: 1.1 });
  }
}

export const BEAST_TYPES = { villager: Villager, swampspider: SwampSpider, swampthing: SwampThing, acolyte: Acolyte, archmage: Archmage, knight: GnuKnight, zealot: Zealot };
