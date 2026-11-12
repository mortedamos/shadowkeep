// SHADOWKEEP level data.  Rooms are authored with a small builder; all coordinates are in TILES (16px).
// For spawns, `gy` is the ground-surface row the thing stands on.  Flying things use the centre row.
//
// Movement budget (for designing gaps):  a normal jump rises ~3.7 tiles and clears ~4 tiles of gap on level ground;
// rising 3 tiles you can bridge ~2-3 tiles of gap.  Double jump adds ~2.8 tiles of height / ~5 tiles of distance.
// Exits are always 3 tiles tall (rows gy-3 .. gy-1) so barricades/crystals/seals can block them completely.
import { TILE, isSolid } from './world.js';

export const ZONES = {
  1: { name: 'The Graveyard Approach', theme: 'graveyard', music: 'zone1' },
  2: { name: 'The Great Hall', theme: 'hall', music: 'zone2' },
  3: { name: 'The Moonlit Chapel', theme: 'chapel', music: 'zone3' },
  4: { name: 'The Underworks', theme: 'underworks', music: 'zone4' },
  5: { name: 'The Shadow Throne', theme: 'throne', music: 'zone5' },
  6: { name: 'The Burning Village', theme: 'village', music: 'zone6' },
  7: { name: 'The Weeping Swamp', theme: 'swamp', music: 'zone7' },
};
// the three Gothicvania Town houses and where their windows are, as [x offset from centre, height above the street, flame size] - the blazes are the fires burning inside
export const HOUSES = { town_house_1: [[4, 108, 1.3], [7, 36, 1.1], [-12, 150, 1.0]], town_house_2: [[-35, 125, 1.4], [26, 125, 1.2], [4, 62, 1.2], [-50, 214, 0.9]], town_house_3: [[-42, 120, 1.2], [31, 120, 1.2], [-15, 50, 1.4]] };

// where a small fire can burn on each house, as [x offset from centre, height above the street] in pixels: along the roofline, up the two side walls, and in the rubble at the foot
// (read off the silhouettes of the three Gothicvania Town houses)
const SPOTS = {
  town_house_1: { roof: [[-74, 134], [-54, 154], [-34, 172], [-14, 177], [16, 177], [36, 172], [56, 152], [76, 132]], wall: [[-74, 20], [-74, 60], [-74, 100], [72, 30], [72, 75], [72, 110]], foot: [[-62, 2], [-24, 2], [30, 2], [64, 2]] },
  town_house_2: { roof: [[-94, 196], [-80, 234], [-56, 234], [-30, 238], [0, 236], [30, 236], [60, 232], [84, 198], [96, 168]], wall: [[-96, 20], [-96, 60], [-96, 100], [-96, 140], [94, 30], [94, 80], [94, 125], [94, 150]], foot: [[-80, 2], [-40, 2], [0, 2], [40, 2], [76, 2]] },
  town_house_3: { roof: [[-96, 148], [-86, 162], [-60, 168], [-30, 172], [0, 162], [30, 168], [60, 172], [86, 162], [98, 130]], wall: [[-98, 25], [-98, 70], [-98, 110], [-98, 140], [96, 30], [96, 75], [96, 115], [96, 140]], foot: [[-84, 2], [-44, 2], [0, 2], [44, 2], [84, 2]] },
};

// where each house's front door is, as [x offset of its centre, height of its top above the street] in pixels - the shop sign hangs above it
export const DOORS = { town_house_1: [21, 59], town_house_2: [-21, 59], town_house_3: [62, 59] };

export class B {
  constructor(id, name, zone, w, h, o = {}) {
    this.def = {
      id, name, zone, w, h, theme: o.theme || ZONES[zone].theme, bg: o.bg || null, tiles: new Uint8Array(w * h), spawns: [], decos: [], exits: [], doors: [], seals: [],
      horizon: (o.horizon !== undefined ? o.horizon : h - 2) * 16, fog: o.fog || 0, weather: o.weather || null, storm: !!o.storm, ambient: o.ambient === undefined ? 0.3 : o.ambient,
      tint: o.tint || [0.015, 0.01, 0.05], music: o.music || ZONES[zone].music, boss: o.boss || null, save: !!o.save, indoor: !!o.indoor, map: o.map || { x: 0, y: 0 }, vig: o.vig === undefined ? 0.5 : o.vig,
    };
    this.w = w; this.h = h;
  }
  put(x, y, v) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.def.tiles[y * this.w + x] = v; return this; }
  rect(x, y, w, h, v = TILE.SOLID) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, v); return this; }
  floor(x0, x1, gy) { return this.rect(x0, gy, x1 - x0, this.h - gy); }              // solid from surface row down to the bottom
  ceil(x0, x1, rows = 2) { return this.rect(x0, 0, x1 - x0, rows); }
  block(x, gy, w, h) { return this.rect(x, gy, w, h); }                                 // raised block whose surface row is gy
  ledge(x, len, gy) { return this.rect(x, gy, len, 1); }                                // 1-thick solid ledge
  plat(x, len, gy) { return this.rect(x, gy, len, 1, TILE.PLAT); }                      // one-way platform
  pit(x0, x1) { return this.rect(x0, this.h - 1, x1 - x0, 1, TILE.SPIKE); }            // bottomless pit with spikes at the bottom row
  spikes(x0, x1, gy) { return this.rect(x0, gy - 1, x1 - x0, 1, TILE.SPIKE); }          // spikes sitting on ground surface gy
  crack(x, y, w, h) { return this.rect(x, y, w, h, TILE.CRACK); }                      // breakable with the sword
  barricade(x, y, w, h) { return this.rect(x, y, w, h, TILE.BARRICADE); }              // burns with Ember
  crystal(x, y, w, h) { return this.rect(x, y, w, h, TILE.CRYSTAL); }                  // shatters with Thunder
  // A closed cell (3 tiles tall inside) sitting on ground row `gy`, spanning x..x+w-1.  Its entrance is on the RIGHT wall
  // and is a tile that must be destroyed (CRACK = sword, BARRICADE = Ember, CRYSTAL = Thunder).  Steps on the left side let
  // the player climb over the roof so the cell never blocks the corridor.  Returns the tile x of the cell's centre.
  cell(x, w, gate, gy = 12) {
    this.rect(x, gy - 4, w, 4).rect(x + 1, gy - 3, w - 2, 3, TILE.EMPTY).rect(x + w - 1, gy - 3, 1, 3, gate);
    this.rect(x - 2, gy - 2, 2, 2).rect(x - 4, gy - 1, 2, 1);
    return x + Math.floor(w / 2) - 1;
  }
  // entities
  e(type, x, gy, o = {}) { this.def.spawns.push({ type, x, y: gy, o }); return this; }
  many(type, xs, gy, o = {}) { for (const x of xs) this.e(type, x, gy, o); return this; }
  candle(x, gy) { return this.d('cdl', x, gy); }                                       // a lit candelabra - decor only (the breakable treasure is the statue)
  // decor
  d(t, x, gy, o = {}) { this.def.decos.push({ t, x: x * 16 + 8, y: gy * 16, ...o }); return this; }
  torches(xs, row) { for (const x of xs) this.d('torch', x, row); return this; }
  // a burning house, drawn behind everything: big blazes in the windows, plus lots of small fires (they smoke) licking along the roof, up the walls and in the rubble at its foot.
  // The small ones are placed from a hash of the house's position, so they are the same every time and never touch the level generator's random numbers.
  // (`sign`: hang the shop sign above the door - by default about two houses in five have one;  `enter`: the id of the room behind the door - the door can then be used with UP)
  house(x, gy, img, burn = [], sign, enter) {
    const h = n => { const s = Math.sin(x * 12.9898 + gy * 78.233 + n * 37.719) * 43758.5453; return s - Math.floor(s); }, sp = SPOTS[img];
    this.d('img', x, gy, { img, back: true });
    if (enter) this.door(Math.round(x + DOORS[img][0] / 16), gy, enter, 3, 12, 'house');
    if (sign === undefined ? h(9) < 0.4 : sign) { const [dx, up] = DOORS[img]; this.d('img', x + (dx + 8) / 16, gy - (up + 5) / 16, { img: 'town_sign', back: true }); }
    for (const i of burn) { const [dx, up, sc] = HOUSES[img][i]; this.d('blaze', x + dx / 16, gy - up / 16, { scale: sc }); }
    const scatter = (list, n, salt) => {
      list.map((_, k) => k).filter(k => gy - list[k][1] / 16 >= 2).sort((a, b) => h(salt + a) - h(salt + b)).slice(0, n).forEach(k => {
        const [dx, up] = list[k], s = salt * 17 + k;
        this.d('blaze', x + (dx + (h(s) - 0.5) * 10) / 16, gy - (up + (h(s + 0.5) - 0.5) * 8) / 16, { scale: 0.4 + 0.4 * h(s + 0.25), small: true });
      });
    };
    scatter(sp.roof, 3, 1); scatter(sp.wall, 3, 2); scatter(sp.foot, 2, 3);
    return this;
  }
  tablet(x, gy, text, id) { return this.e('tablet', x, gy, { text, id }); }
  // transitions  (side, first row, last row, target room, target tile x, target ground row)
  exit(side, from, to, room, tx, gy) { this.def.exits.push({ side, from, to, room, tx, gy }); return this; }
  door(x, gy, room, tx, tgy, kind = 'wood') { this.def.doors.push({ x, gy, room, tx, tgy, house: kind === 'house' }); if (kind !== 'house') this.d('door', x, gy, { kind }); return this; }      // (kind 'house': no sprite - the house's own painted door is the door)
  bossSeals(...cols) { this.def.seals = cols; return this; }                           // [{x, y0, y1}]
  build() { return this.def; }
}

const ROOMS = {};
const add = b => { ROOMS[b.def.id] = b.def; return b; };

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Candelabras are scenery: lit, and nothing to break.  Wherever a room's builder dropped them loosely ("loose" ones, as the breakable candles used to be placed), they are lifted
// and set again the way a castle's steward would: in pairs flanking the doors and the waystone, one beside each tablet, at the foot of walls and steps, and - with what is left -
// spaced evenly along the floor.  Never on top of statues, barrels, loot or doors.  The result is the same every time (a hash of the room's id, not the generator's random numbers).
// (A candelabra placed with { keep: true } is deliberate - the pair beside an altar - and stays where it is.)
const STATIC_SPAWNS = new Set(['statue', 'barrel', 'tablet', 'altar', 'chest', 'waystone', 'itemspawn', 'upgrade']);
const BLOCK_DECOS = new Set(['brazier', 'column', 'pool', 'door', 'gate']);
export function arrangeCandelabras(def) {
  if (def.cdlDone) return; def.cdlDone = true;                                                          // (hand-built rooms are shared between worlds: do it once)
  const loose = def.decos.filter(d => d.t === 'cdl' && !d.keep); if (!loose.length && !def.spawns.some(s => s.type === 'waystone')) return;
  def.decos = def.decos.filter(d => !(d.t === 'cdl' && !d.keep));
  if (def.theme === 'village' && def.h <= 20) return;                                              // a burning street has lamps and braziers, not candelabras (the bell tower inside is another matter)
  const W = def.w, H = def.h, T = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 1 : def.tiles[y * W + x]);
  let seed = 2166136261; for (const ch of def.id) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const spots = [];                                                                                  // everywhere one can stand: flat solid floor or platform with headroom
  for (let x = 3; x < W - 3; x++) for (let y = 2; y < H; y++) {
    const v = T(x, y); if (v !== TILE.SOLID && v !== TILE.PLAT) continue;
    if (T(x, y - 1) !== 0 || T(x, y - 2) !== 0 || T(x, y - 3) !== 0) continue;
    if (![x - 1, x + 1].every(xx => { const u = T(xx, y); return u === TILE.SOLID || u === TILE.PLAT; })) continue;
    spots.push({ x, y, wall: isSolid(T(x - 1, y - 1)) || isSolid(T(x + 1, y - 1)) || isSolid(T(x - 2, y - 1)) || isSolid(T(x + 2, y - 1)) });
  }
  const block = [];                                                                                  // [tile x, standing row, how close is too close]
  for (const s of def.spawns) if (STATIC_SPAWNS.has(s.type)) block.push([s.x, s.y, s.type === 'tablet' || s.type === 'waystone' || s.type === 'altar' ? 2.2 : 1.8]);
  for (const d of def.doors) block.push([d.x, d.gy, 2.6]);
  for (const d of def.decos) if (BLOCK_DECOS.has(d.t) || (d.t === 'img' && !d.back) || (d.t === 'cdl')) block.push([(d.x - 8) / 16, d.y / 16, d.t === 'pool' ? Math.max(2, (d.w || 48) / 32) : d.t === 'img' ? 2.2 : 1.8]);
  const placed = [], clear = (s, gap) => !block.some(([bx, by, hw]) => Math.abs(s.x - bx) < hw && Math.abs(s.y - by) <= 3) && !placed.some(p => Math.abs(p.x - s.x) < gap && Math.abs(p.y - s.y) <= 3);
  const put = (s, gap) => { if (s && clear(s, gap)) { placed.push(s); return true; } return false; };
  const near = (x, y, tol = 1.6) => { let best = null, bd = 1e9; for (const s of spots) { const d = Math.abs(s.x - x) + (y === undefined ? 0 : Math.abs(s.y - y) * 3); if (d < bd && Math.abs(s.x - x) <= tol) { bd = d; best = s; } } return best; };
  for (const d of def.doors) { put(near(d.x - 3.5, d.gy), 3); put(near(d.x + 3.5, d.gy), 3); }      // a pair either side of every door
  for (const s of def.spawns) if (s.type === 'waystone') { put(near(s.x - 3.5, s.y), 3); put(near(s.x + 3.5, s.y), 3); }        // and of the waystone
  for (const s of def.spawns) if (s.type === 'tablet') { rnd() < 0.5 ? (put(near(s.x + 3, s.y)) || put(near(s.x - 3, s.y))) : (put(near(s.x - 3, s.y)) || put(near(s.x + 3, s.y))); }      // one beside each tablet
  const total = Math.min(10, Math.max(loose.length, placed.length, Math.round(W / 16))), left = () => total - placed.length;
  const wallSpots = spots.filter(s => s.wall).sort(() => rnd() - 0.5);                               // at the foot of walls and steps
  for (let i = 0, want = Math.ceil(Math.max(0, left()) / 2); i < wallSpots.length && want > 0; i++) if (put(wallSpots[i], 8)) want--;
  const m = Math.max(0, left());                                                                     // the rest, evenly spaced along the room
  for (let k = 0; k < m; k++) {
    const tx = 4 + (W - 8) * (k + 0.5) / m + (rnd() - 0.5) * 3, order = spots.filter(s => clear(s, 5)).sort((a, b) => Math.abs(a.x - tx) - Math.abs(b.x - tx)); if (order.length) put(order[0], 5);
  }
  for (const s of placed) def.decos.push({ t: 'cdl', x: s.x * 16 + 8, y: s.y * 16, keep: true });
}

// =====================================================================================================================
// ZONE 1 - THE GRAVEYARD APPROACH
// =====================================================================================================================
{
  // THE BURNING VILLAGE - the opening level.  Gothicvania Town art (ansimuz, CC0) on a cobbled street (Castlevania-esque bricks, Chloe Wolfe, CC-BY 4.0).
  // Flat and forgiving: monsters roam the street, houses burn, and terrified villagers run about (they are harmless - you can't hurt them).
  const b = new B('v1', 'Market Street', 6, 90, 14, { theme: 'village', weather: 'embers', ambient: 0.34, horizon: 12, tint: [0.16, 0.05, 0.0], vig: 0.55, map: { x: 0, y: 4 } });
  b.floor(0, 90, 12).block(24, 10, 3, 2).block(41, 10, 4, 2).plat(48, 4, 8).block(62, 10, 3, 2).plat(70, 4, 9).block(78, 10, 2, 2);
  // houses (each lists its windows / doors as [x offset from its centre, height above the street, flame size]; the blazes are the fires burning in them)
  for (const [tx, img, burn, sign, enter] of [[12, 'town_house_1', [0, 1, 2], false, 'hv1'], [30, 'town_house_3', [0, 2]], [50, 'town_house_2', [0, 1, 3], true, 'hv2'], [68, 'town_house_1', [0, 2], true, 'hv3'], [83, 'town_house_3', [1, 2]]]) {
    b.house(tx, 12, img, burn, !!sign, enter);          // three of the houses can be entered (UP at the door)
  }
  b.d('img', 22, 12, { img: 'town_lamp' }).d('img', 40, 12, { img: 'town_lamp' }).d('img', 59, 12, { img: 'town_lamp' }).d('img', 3, 12, { img: 'town_cart' }).d('img', 36, 12, { img: 'town_well' }).d('img', 57, 12, { img: 'town_crates' });
  b.e('barrel', 61, 12, { drop: 'coin' });                                  // (a breakable one: barrels and crates you can smash look like this, and nothing else does)
  b.d('brazier', 28, 12).d('brazier', 46, 12).d('brazier', 65, 12);          // (the first one used to stand at 26, hidden behind the stone block at 24-26)
  b.d('pool', 17, 12, { w: 80 });                                             // a puddle in the street (water washes the white cloak)
  b.tablet(6, 12, 'THE BELLS RANG AT DUSK. THEN THE THINGS CAME DOWN FROM THE HILL, AND THE FIRES BEGAN. THE KEEP IS BEYOND THE GATE.', 'tab0');
  b.candle(16, 12, 'heart').candle(38, 12, 'coin').e('statue', 55, 12, { drop: 'mana' }).candle(77, 12, 'heart');
  b.many('zombie', [20, 34, 58, 72], 12).e('skeleton', 46, 12).e('hound', 66, 12).e('fireskull', 40, 5).e('bat', 28, 3).e('bat', 60, 4);
  for (const [x, kind] of [[9, 'woman'], [18, 'oldman'], [30, 'bearded'], [47, 'hatman'], [56, 'woman'], [67, 'bearded'], [76, 'oldman']]) b.e('villager', x, 12, { kind });
  b.exit('R', 9, 11, 'g1', 1, 12);
  add(b);
}
{
  const b = new B('g1', 'Iron Gate', 1, 60, 14, { weather: 'rain', storm: true, ambient: 0.1, horizon: 12, map: { x: 0, y: 3 } });
  b.floor(0, 60, 12).block(30, 10, 4, 2).block(37, 9, 3, 3).plat(14, 4, 9).plat(46, 5, 8);
  b.d('img', 3, 12, { img: 'cemetery_statue' }).d('img', 9, 12, { img: 'cemetery_stone-1' }).d('img', 21, 12, { img: 'cemetery_stone-3' }).d('img', 26, 12, { img: 'cemetery_bush-large', back: true })
    .d('img', 44, 12, { img: 'cemetery_stone-2' }).d('img', 52, 12, { img: 'cemetery_stone-4' }).d('img', 57, 12, { img: 'cemetery_bush-small' })
    .d('img', 12, 12, { img: 'cemetery_tree-1', back: true }).d('img', 33, 12, { img: 'cemetery_tree-2', back: true }).d('img', 50, 12, { img: 'cemetery_tree-3', back: true });
  b.tablet(7, 12, 'THE SHADOWKEEP SWALLOWED THE SUN LONG AGO. ONLY A STRANGER FOOLISH ENOUGH TO ENTER WILL SEE IT RISE AGAIN.', 'tab1');
  b.candle(12, 12, 'heart').e('statue', 24, 12, { drop: 'coin' }).candle(41, 12, 'mana').candle(55, 12, 'heart');
  b.many('zombie', [18, 28, 42], 12).e('bat', 38, 5).e('skeleton', 50, 12);
  b.exit('L', 9, 11, 'v1', 88, 12).exit('R', 9, 11, 'g2', 1, 12);
  add(b);
}
{
  const b = new B('g2', 'Grave Hollow', 1, 84, 14, { weather: 'rain', storm: true, ambient: 0.12, horizon: 12, fog: 0.85, map: { x: 1, y: 3 } });
  b.floor(0, 22, 12).pit(22, 26).floor(26, 48, 12).pit(48, 52).floor(52, 84, 12);
  b.block(30, 10, 3, 2).block(34, 8, 3, 4).plat(40, 4, 8).block(58, 10, 3, 2);
  b.plat(63, 4, 9).ledge(68, 6, 4);                                         // double-jump ledge (needs the Raven Feather)
  b.e('upgrade', 71, 4, { kind: 'hpup', id: 'g2_hp' });
  const cx = b.cell(75, 7, TILE.BARRICADE);                                // Ember secret cell
  b.e('upgrade', cx, 12, { kind: 'atkup', id: 'g2_atk' });
  b.d('img', 5, 12, { img: 'cemetery_stone-2' }).d('img', 15, 12, { img: 'cemetery_tree-1', back: true }).d('img', 28, 12, { img: 'cemetery_stone-1' }).d('img', 44, 12, { img: 'cemetery_tree-3', back: true })
    .d('img', 56, 12, { img: 'cemetery_stone-3' }).d('img', 66, 12, { img: 'cemetery_tree-2', back: true });
  b.door(37, 12, 's1', 3, 12, 'crypt');
  b.e('statue', 10, 12, { drop: 'heart' }).candle(30, 10, 'mana').candle(46, 12, 'coin').e('statue', 56, 12, { drop: 'potion' }).candle(68, 12, 'heart');
  b.e('skeleton', 14, 12).e('zombie', 20, 12).e('hound', 28, 12).e('bat', 40, 4).e('bat', 66, 6).e('hound', 62, 12).e('skeleton', 64, 12).e('zombie', 69, 12).e('skeleton', 44, 12);
  b.tablet(18, 12, 'THE DEAD HERE DO NOT REST. STRIKE THEM DOWN - OR BE LAID BESIDE THEM.', 'tab2');
  b.exit('L', 9, 11, 'g1', 58, 12).exit('R', 9, 11, 'g3', 1, 12);
  add(b);
}
{
  const b = new B('g3', "Gatekeeper's Court", 1, 38, 14, { weather: 'rain', storm: true, ambient: 0.16, horizon: 12, boss: 'beast', music: 'boss', map: { x: 2, y: 3 } });
  b.floor(0, 38, 12).plat(6, 4, 9).plat(28, 4, 9);
  b.d('brazier', 4, 12).d('brazier', 33, 12).d('img', 18, 12, { img: 'cemetery_statue', back: true }).d('img', 10, 12, { img: 'cemetery_stone-4' }).d('img', 26, 12, { img: 'cemetery_stone-1' });
  b.candle(9, 12, 'heart').e('statue', 31, 12, { drop: 'heart' }).candle(19, 12, 'mana');                 // a little healing in the arena
  b.e('boss_beast', 28, 12, { reward: 'djump' });
  b.bossSeals({ x: 0, y0: 9, y1: 11 }, { x: 37, y0: 9, y1: 11 });
  b.exit('L', 9, 11, 'g2', 82, 12).exit('R', 9, 11, 'h1', 1, 12);
  add(b);
}
// ---- save-room factory (small, calm, purple)
function saveRoom(id, name, zone, back, bx, bgy, mapx, mapy) {
  const b = new B(id, name, zone, 22, 14, { theme: 'chapel', music: 'save', ambient: 0.35, save: true, weather: 'wisps', horizon: 12, map: { x: mapx, y: mapy } });
  b.floor(0, 22, 12).ceil(0, 22, 2).torches([4, 18], 7).d('cdl', 7, 12, { keep: true }).d('cdl', 15, 12, { keep: true }).e('altar', 11, 12).door(3, 12, back, bx, bgy, 'wood');
  b.d('banner', 9, 2, { len: 5, color: '#5a2a6a' }).d('banner', 13, 2, { len: 5, color: '#5a2a6a' });
  return add(b);
}
saveRoom('s1', "Gravekeeper's Crypt", 1, 'g2', 37, 12, 1, 2);

// =====================================================================================================================
// ZONE 2 - THE GREAT HALL
// =====================================================================================================================
{
  const b = new B('h1', 'Entrance Hall', 2, 60, 14, { weather: 'dust', ambient: 0.34, horizon: 12, map: { x: 3, y: 3 } });
  b.floor(0, 60, 12).ceil(0, 60, 2).plat(12, 5, 8).plat(36, 6, 8).block(22, 9, 3, 3).block(48, 10, 4, 2);
  b.torches([6, 17, 28, 40, 52], 6).d('banner', 14, 2, { len: 6, color: '#7a1e2a' }).d('banner', 30, 2, { len: 6, color: '#7a1e2a' }).d('banner', 46, 2, { len: 6, color: '#7a1e2a' });
  b.d('cdl', 9, 12).d('cdl', 33, 12).d('cdl', 55, 12);
  b.door(57, 12, 's2', 3, 12, 'wood');
  b.candle(14, 12, 'heart').e('statue', 26, 12, { drop: 'mana' }).candle(38, 8, 'potion').candle(44, 12, 'coin').e('statue', 18, 12, { drop: 'coin' });
  b.many('bat', [14, 30, 42], 2).many('armor', [26, 40], 12).e('ghost', 50, 7);
  b.tablet(4, 12, 'THE GREAT HALL ONCE RANG WITH FEASTING. NOW THE ARMOR ITSELF STALKS THE FLOOR.', 'tab3');
  b.exit('L', 9, 11, 'g3', 36, 12).exit('R', 9, 11, 'h2', 1, 12);
  add(b);
}
{
  const b = new B('h2', 'Hall of Armor', 2, 90, 14, { weather: 'dust', ambient: 0.36, horizon: 12, map: { x: 4, y: 3 } });
  b.floor(0, 30, 12).pit(30, 34).floor(34, 90, 12).ceil(0, 90, 2).plat(31, 2, 9);
  b.block(42, 10, 4, 2).block(48, 8, 3, 4).plat(54, 3, 9).ledge(59, 6, 4).block(72, 10, 4, 2);
  b.e('upgrade', 62, 4, { kind: 'mpup', id: 'h2_mp' });
  const cx = b.cell(80, 7, TILE.CRYSTAL);                                  // Thunder secret cell
  b.e('upgrade', cx, 12, { kind: 'hpup', id: 'h2_hp' });
  b.torches([8, 20, 38, 52, 68, 86], 6).d('cdl', 14, 12).d('cdl', 40, 12).d('cdl', 70, 12).d('banner', 26, 2, { len: 5, color: '#7a1e2a' }).d('banner', 62, 2, { len: 5, color: '#7a1e2a' });
  b.candle(10, 12, 'heart').candle(24, 12, 'mana').e('statue', 36, 12, { drop: 'coin' }).candle(52, 12, 'potion').candle(66, 12, 'heart').e('statue', 88, 12, { drop: 'mana' });
  b.many('armor', [18, 36, 56, 70], 12).e('ghost', 28, 6).e('ghost', 64, 7).e('fireskull', 44, 6).e('fireskull', 76, 5).many('bat', [20, 50, 66], 2).e('wyrm', 46, 4);
  b.exit('L', 9, 11, 'h1', 58, 12).exit('R', 9, 11, 'h4', 1, 12);
  add(b);
}
{
  const b = new B('h4', 'Phantom Stable', 2, 42, 14, { weather: 'embers', ambient: 0.3, horizon: 12, boss: 'nightmare', music: 'boss', map: { x: 5, y: 3 } });
  b.floor(0, 42, 12).ceil(0, 42, 2).plat(5, 4, 9).plat(33, 4, 9);
  b.torches([4, 12, 21, 30, 38], 6).d('banner', 10, 2, { len: 6, color: '#7a1e2a' }).d('banner', 32, 2, { len: 6, color: '#7a1e2a' });
  b.e('boss_nightmare', 30, 12, { reward: 'dash' });
  b.bossSeals({ x: 0, y0: 9, y1: 11 }, { x: 41, y0: 9, y1: 11 });
  b.exit('L', 9, 11, 'h2', 88, 12).exit('R', 9, 11, 'h3', 1, 34);
  add(b);
}
{
  // vertical climb: platforms every 3 rows, <= 2 tile gaps between them
  const b = new B('h3', 'Belfry Stairs', 2, 30, 36, { weather: 'dust', ambient: 0.4, horizon: 34, map: { x: 6, y: 1 } });
  b.floor(0, 30, 34).ceil(0, 30, 2);
  b.plat(4, 6, 31).plat(12, 6, 28).plat(20, 6, 25).plat(12, 6, 22).plat(4, 6, 19).plat(12, 6, 16).plat(20, 6, 13).plat(12, 6, 10).ledge(18, 12, 8);
  b.torches([2, 27], 30).torches([2, 27], 22).torches([2, 27], 14).torches([2, 27], 6);
  b.many('bat', [8, 24], 5).e('bat', 16, 12).e('armor', 24, 34).e('armor', 24, 8).e('ghost', 10, 18).e('fireskull', 22, 20).e('fireskull', 8, 14);
  b.candle(7, 31, 'heart').candle(23, 25, 'mana').e('statue', 7, 19, { drop: 'potion' }).candle(21, 8, 'heart');
  b.tablet(20, 8, 'THE BELFRY STAIRS CLIMB TO THE CHAPEL. THE BELLS HAVE NOT RUNG SINCE THE LORD DESCENDED.', 'tab4');
  b.exit('L', 31, 33, 'h4', 40, 12).exit('R', 5, 7, 'c1', 1, 12);
  add(b);
}
saveRoom('s2', 'Hall Sanctuary', 2, 'h1', 57, 12, 3, 2);

// =====================================================================================================================
// ZONE 3 - THE MOONLIT CHAPEL
// =====================================================================================================================
{
  const b = new B('c1', 'The Nave', 3, 66, 14, { weather: 'wisps', ambient: 0.32, horizon: 12, fog: 0.45, map: { x: 7, y: 1 } });
  b.floor(0, 66, 12).ceil(0, 66, 2).plat(16, 6, 8).plat(40, 6, 8).block(28, 10, 3, 2);
  const cx = b.cell(55, 7, TILE.CRACK);                                    // breakable-wall secret (sword)
  b.e('chest', cx, 12, { contents: 'hpup', id: 'c1_chest' });
  b.d('column', 6, 12).d('column', 24, 12).d('column', 46, 12).d('column', 62, 12).torches([14, 34, 52], 6);
  b.d('cdl', 10, 12).d('cdl', 20, 12).d('cdl', 36, 12).d('cdl', 50, 12);
  b.door(33, 12, 's3', 3, 12, 'wood');
  b.candle(8, 12, 'heart').e('statue', 30, 10, { drop: 'mana' }).candle(43, 8, 'potion').candle(47, 12, 'coin');
  b.e('ghost', 20, 7).e('ghoul', 26, 12).e('wizard', 38, 12).e('ghoul', 48, 12).e('ghost', 44, 5).e('bat', 12, 4).e('frostwyrm', 34, 4);
  b.tablet(4, 12, 'HERE THE FAITHFUL PRAYED. HERE THEY WERE FIRST TAKEN.', 'tab5');
  b.exit('L', 5, 7, 'h3', 28, 8).exit('R', 9, 11, 'c2', 1, 12);
  add(b);
}
{
  const b = new B('c2', 'Bell Gallery', 3, 78, 14, { weather: 'wisps', ambient: 0.3, horizon: 12, map: { x: 8, y: 1 } });
  b.floor(0, 27, 12).pit(27, 37).floor(37, 78, 12).ceil(0, 78, 2);          // a 10-tile gulf: needs double jump + Shadow Step
  b.d('column', 12, 12).d('column', 44, 12).d('column', 70, 12).torches([6, 20, 42, 56, 74], 6);
  b.d('cdl', 18, 12).d('cdl', 50, 12).d('cdl', 64, 12);
  b.e('statue', 14, 12, { drop: 'heart' }).candle(46, 12, 'mana').candle(60, 12, 'potion');
  b.tablet(22, 12, 'THE GULF IS TOO WIDE FOR ANY LEAP. ONLY ONE WHO STEPS THROUGH SHADOW MAY CROSS.', 'tab6');
  b.e('wraith', 30, 8).e('wraith', 34, 6).e('ghost', 42, 6).e('wizard', 50, 12).e('ghoul', 58, 12).e('wizard', 68, 12).e('bat', 32, 3).e('bat', 52, 4).e('frostwyrm', 40, 4);
  b.exit('L', 9, 11, 'c1', 64, 12).exit('R', 9, 11, 'c3', 1, 14);
  add(b);
}
{
  const b = new B('c3', 'Sanctum of the Seraph', 3, 42, 16, { weather: 'wisps', ambient: 0.28, horizon: 14, boss: 'angel', music: 'boss', map: { x: 9, y: 1 } });
  b.floor(0, 42, 14).ceil(0, 42, 2).plat(5, 4, 10).plat(33, 4, 10).plat(19, 5, 8);
  b.d('column', 4, 14).d('column', 37, 14).torches([10, 16, 26, 32], 7).d('cdl', 12, 14).d('cdl', 30, 14);
  b.e('boss_angel', 21, 8, { reward: 'ember' });
  b.barricade(41, 11, 1, 3);                                              // burn it with the Ember rune to leave
  b.bossSeals({ x: 0, y0: 11, y1: 13 }, { x: 40, y0: 11, y1: 13 });
  b.exit('L', 11, 13, 'c2', 76, 12).exit('R', 11, 13, 'u1', 1, 12);
  add(b);
}
saveRoom('s3', 'Chapel Sanctuary', 3, 'c1', 33, 12, 7, 0);

// =====================================================================================================================
// ZONE 4 - THE UNDERWORKS
// =====================================================================================================================
{
  const b = new B('u1', 'Boiler Corridor', 4, 76, 14, { weather: 'sparks', ambient: 0.42, horizon: 12, map: { x: 10, y: 1 } });
  b.floor(0, 24, 12).pit(24, 28).floor(28, 76, 12).ceil(0, 76, 2).block(36, 10, 4, 2).plat(44, 4, 8).block(56, 10, 3, 2);
  b.plat(63, 3, 9).ledge(67, 6, 5); b.e('upgrade', 70, 5, { kind: 'hpup', id: 'u1_hp' });   // double-jump ledge
  b.torches([8, 20, 34, 48, 62], 6).d('brazier', 14, 12).d('brazier', 40, 12).d('brazier', 66, 12);
  b.door(31, 12, 's5', 3, 12, 'wood');
  b.e('statue', 10, 12, { drop: 'heart' }).candle(42, 12, 'mana').candle(60, 12, 'potion');
  b.many('knight', [16, 48], 12).many('sorcerer', [34, 60], 12).e('fireskull', 40, 6).e('hound', 54, 12).e('bat', 18, 4).e('bat', 66, 5).e('emberwyrm', 44, 4);
  b.tablet(6, 12, 'THE LORD BUILT HIS SERVANTS OF BRASS AND SPRING SO THEY WOULD NEVER TIRE, NEVER PRAY, NEVER FLEE.', 'tab7');
  b.exit('L', 9, 11, 'c3', 40, 14).exit('R', 9, 11, 'u2', 1, 36);
  add(b);
}
{
  const b = new B('u2', 'Gear Shaft', 4, 30, 38, { weather: 'sparks', ambient: 0.45, horizon: 36, map: { x: 11, y: 0 } });
  b.floor(0, 30, 36).ceil(0, 30, 2);
  b.plat(4, 6, 33).plat(12, 6, 30).plat(20, 6, 27).plat(12, 6, 24).plat(4, 6, 21).plat(12, 6, 18).plat(20, 6, 15).plat(12, 6, 12).ledge(18, 12, 10);
  b.torches([2, 27], 32).torches([2, 27], 24).torches([2, 27], 16).d('brazier', 26, 36).d('brazier', 4, 36);
  b.e('knight', 22, 10).e('sorcerer', 14, 12).e('knight', 22, 27).e('fireskull', 12, 28).e('fireskull', 20, 18).e('bat', 8, 20).e('bat', 24, 22).e('fireskull', 6, 14).e('emberwyrm', 16, 23);
  b.e('statue', 7, 33, { drop: 'heart' }).candle(23, 27, 'mana').candle(7, 21, 'potion').e('statue', 22, 10, { drop: 'heart' });
  b.e('upgrade', 28, 10, { kind: 'atkup', id: 'u2_atk' });
  b.exit('L', 33, 35, 'u1', 74, 12).exit('R', 7, 9, 'u3', 1, 14);
  add(b);
}
{
  const b = new B('u3', 'The Foundry', 4, 46, 16, { weather: 'sparks', ambient: 0.35, horizon: 14, boss: 'colossus', music: 'boss', map: { x: 12, y: 0 } });
  b.floor(0, 46, 14).ceil(0, 46, 2).plat(6, 5, 10).plat(35, 5, 10);
  b.d('brazier', 4, 14).d('brazier', 41, 14).torches([12, 18, 28, 34], 7);
  b.e('boss_colossus', 32, 14, { reward: 'thunder' });
  b.crystal(45, 11, 1, 3);                                                // shatter it with Thunder to leave
  b.bossSeals({ x: 0, y0: 11, y1: 13 }, { x: 44, y0: 11, y1: 13 });
  b.exit('L', 11, 13, 'u2', 28, 10).exit('R', 11, 13, 't1', 1, 12);
  add(b);
}
saveRoom('s5', 'Furnace Sanctuary', 4, 'u1', 31, 12, 10, 0);

// =====================================================================================================================
// ZONE 5 - THE SHADOW THRONE
// =====================================================================================================================
{
  const b = new B('t1', 'Hall of Shadows', 5, 72, 14, { weather: 'mist', ambient: 0.58, horizon: 12, fog: 0.55, vig: 0.7, tint: [0.03, 0.0, 0.04], map: { x: 13, y: 0 } });
  b.floor(0, 72, 12).ceil(0, 72, 2).block(18, 10, 3, 2).plat(26, 5, 8).block(36, 9, 3, 3).plat(46, 5, 8).block(62, 10, 4, 2);
  const cx = b.cell(9, 7, TILE.CRYSTAL); b.e('upgrade', cx, 12, { kind: 'mpup', id: 't1_mp' });
  b.torches([14, 24, 40, 54, 68], 6).d('banner', 16, 2, { len: 7, color: '#6a1020' }).d('banner', 32, 2, { len: 7, color: '#6a1020' }).d('banner', 50, 2, { len: 7, color: '#6a1020' }).d('banner', 66, 2, { len: 7, color: '#6a1020' });
  b.door(57, 12, 's4', 3, 12, 'wood');
  b.candle(22, 12, 'heart').candle(44, 12, 'mana').e('statue', 62, 10, { drop: 'potion' });
  b.many('armor', [22, 34, 52], 12).many('wraith', [24, 40, 56], 7).many('bat', [12, 28, 48, 64], 2).e('ghost', 20, 6).e('ghost', 46, 5).e('sorcerer', 67, 12).e('fireskull', 30, 6).e('fireskull', 58, 5).e('wyrm', 38, 4);
  b.tablet(3, 12, 'HE WAITS ABOVE. THE ONE WHO TOOK THE SUN. TURN BACK, STRANGER - OR BRING THE DAWN.', 'tab8');
  b.exit('L', 9, 11, 'u3', 44, 14).exit('R', 9, 11, 't2', 1, 14);
  add(b);
}
{
  const b = new B('t2', 'Throne of Shadows', 5, 46, 16, { weather: 'embers', ambient: 0.5, horizon: 14, boss: 'shadow', music: 'boss_final', vig: 0.75, tint: [0.03, 0.0, 0.04], map: { x: 14, y: 0 } });
  b.floor(0, 46, 14).ceil(0, 46, 2).plat(6, 5, 10).plat(35, 5, 10).plat(20, 6, 8);
  b.d('banner', 8, 2, { len: 8, color: '#6a1020' }).d('banner', 14, 2, { len: 8, color: '#6a1020' }).d('banner', 31, 2, { len: 8, color: '#6a1020' }).d('banner', 37, 2, { len: 8, color: '#6a1020' });
  b.d('column', 4, 14).d('column', 41, 14).d('brazier', 11, 14).d('brazier', 34, 14);
  b.e('boss_shadow', 30, 9, { reward: 'dawn' });
  b.bossSeals({ x: 0, y0: 11, y1: 13 });
  b.exit('L', 11, 13, 't1', 70, 12);
  add(b);
}
saveRoom('s4', 'Last Sanctuary', 5, 't1', 57, 12, 13, 2);

export { ROOMS };
export const START = { room: 'v1', x: 4, gy: 12 };
