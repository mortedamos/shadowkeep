// Procedural castle.  The world seed decides every room's layout; each room is then PROVEN beatable by validate.js
// (real jump physics) before it is accepted.  If a room can't be made valid it falls back to its hand-built layout, so an
// impossible level can never reach the player.
//
//   - corridors are built from segments that respect the jump budget (steps <= 2 rows, gaps <= 3 tiles, platform bridges for
//     anything wider) with "modules" dropped in: save door, double-jump ledge, secret cell, the dash gulf, lore tablets
//   - towers zig-zag upward in 2-3 row hops;  boss arenas get randomised platforms;  sanctuaries are fixed
//   - the macro structure (zones, bosses, ability order, exits, save rooms) never changes, only the rooms' insides
import { B, ZONES, ROOMS as AUTHORED, HOUSES, DOORS, arrangeCandelabras, tidyRoom } from './rooms.js';
import { ITEMS, ITEM_ORDER } from './itemdata.js';
const offerOf = (item, o = {}) => ({ item, qty: o.qty || ITEMS[item].pack, price: o.price || ITEMS[item].price, stock: o.stock || 3 });          // what a merchant sells: one pack, for its price, three times at most
import { TILE } from './world.js';
import { validateRoom, checkSpawns, roomOf, surfaces } from './validate.js';
import { mulberry32 } from './util.js';

export const GEN_VERSION = 3;
const MAX_TRY = 60;

// ------------------------------------------------------------------------------------------------ seeded random helpers
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
function makeRng(seed, id, attempt) {
  const f = mulberry32((Math.imul(seed | 0, 0x9e3779b1) ^ hashStr(id) ^ Math.imul(attempt + 1, 0x85ebca6b)) >>> 0);
  const r = { f, i: (a, b) => a + Math.floor(f() * (b - a + 1)), pick: a => a[Math.floor(f() * a.length)], chance: p => f() < p };
  r.shuffle = a => { const o = [...a]; for (let k = o.length - 1; k > 0; k--) { const j = Math.floor(f() * (k + 1)); [o[k], o[j]] = [o[j], o[k]]; } return o; };
  r.wpick = table => { let t = 0; for (const [, w] of table) t += w; let x = f() * t; for (const [k, w] of table) if ((x -= w) < 0) return k; return table[0][0]; };
  return r;
}

// ------------------------------------------------------------------------------------------------ the castle's blueprint
// (ids, zones, secrets and the order of everything are fixed; sizes and layouts are randomised)
//
// The castle has seven zones, each with ONE look (so a level never mixes tilesets):
//   6 Burning Village  ->  1 Graveyard  ->  7 Weeping Swamp  ->  2 Great Hall  ->  3 Moonlit Chapel  ->  4 Underworks  ->  5 Shadow Throne
// Every zone opens with a WAYSTONE chamber (the teleport room), has a boss at its far end, and a sanctuary (save room) off one of its corridors.
const T1 = 'THE SHADOWKEEP SWALLOWED THE SUN LONG AGO. ONLY A STRANGER FOOLISH ENOUGH TO ENTER WILL SEE IT RISE AGAIN.';
// how each zone's weather / light looks (shared by all its rooms, including the waystone chamber)
const LOOK = {
  6: { weather: 'embers', ambient: 0.34, horizon: 12, tint: [0.16, 0.05, 0.0], vig: 0.55 },
  1: { weather: 'rain', storm: true, ambient: 0.12, horizon: 12 },
  7: { weather: 'wisps', wisps: 4, ambient: 0.16, horizon: 12, tint: [0.0, 0.03, 0.02] },          // (weather 'wisps' = drifting motes; wisps: 4 = four will-o'-the-wisps, see fx.js)
  2: { weather: 'dust', ambient: 0.35, horizon: 12 },
  3: { weather: 'wisps', ambient: 0.3, horizon: 12 },
  4: { weather: 'sparks', ambient: 0.42, horizon: 12 },
  5: { weather: 'mist', ambient: 0.58, horizon: 12, vig: 0.7, tint: [0.03, 0.0, 0.04] },
};
const SPEC = {
  // ======== ZONE 6 - THE BURNING VILLAGE (Gothicvania Town)
  v1: { kind: 'authored', zone: 6, name: 'Market Street' },
  tv: { kind: 'teleport', zone: 6, name: 'Waystone Square', outdoor: true, opts: LOOK[6] },
  v2: { kind: 'corridor', zone: 6, name: 'Smouldering Lane', w: [72, 86], outdoor: true, opts: LOOK[6],
    mods: [{ t: 'door', to: 'sv', kind: 'wood' }, { t: 'door', to: 'hv4', kind: 'house' }, { t: 'djLedge', kind: 'atkup', id: 'v2_atk' }, { t: 'tablet', id: 'tab9', near: 'start', text: 'THE BELLS WERE THE FIRST TO FALL SILENT. THE PRIEST BARRED THE CHAPEL DOOR AND PRAYED. IT DID NOT HELP.' }],
    candles: [3, 5], barrels: [1, 2], mix: { zombie: [2, 3], skeleton: [1, 2], hound: [1, 1], bat: [1, 2], fireskull: [1, 1], villager: [2, 3] } },
  v3: { kind: 'tower', zone: 6, name: 'The Bell Tower', w: [28, 32], h: [34, 38], top: [8, 10], opts: { ...LOOK[6], ambient: 0.4 },
    mods: [{ t: 'tablet', id: 'tab10', text: 'HE CALLS IT MERCY, TO BURN WHAT HE CANNOT PROTECT. THE WARDEN WAITS IN THE SQUARE BELOW THE HILL ROAD.' }], topItem: { kind: 'mpup', id: 'v3_mp' }, candles: [3, 4], mix: { bat: [2, 3], fireskull: [2, 3], zombie: [1, 2] } },
  vb: { kind: 'arena', zone: 6, name: 'The Burning Square', w: [40, 46], outdoor: true, boss: 'cinder', reward: 'hpup', plats: 2, rise: 3, seal: 'both', candles: [3, 3], decor: 'village',
    opts: { ...LOOK[6], boss: 'cinder', music: 'boss' } },
  sv: { kind: 'sanctuary', zone: 6, name: 'Chapel Cellar', parent: 'v2' },
  // the houses of the village can be entered (UP at the door): calm people inside, who give you something for listening
  hv1: { kind: 'interior', zone: 6, name: "Weaver's Cottage", parent: 'v1', look: 'cottage', npcs: [2, 2] },
  hv2: { kind: 'interior', zone: 6, name: "Smith's House", parent: 'v1', look: 'cottage', npcs: [1, 2], sellers: 1 },
  hv3: { kind: 'interior', zone: 6, name: "Baker's House", parent: 'v1', look: 'cottage', npcs: [2, 3] },
  hv4: { kind: 'interior', zone: 6, name: "Cooper's House", parent: 'v2', look: 'cottage', npcs: [1, 2] },

  // ======== ZONE 1 - THE GRAVEYARD APPROACH (Gothicvania Cemetery)
  tg: { kind: 'teleport', zone: 1, name: 'Waystone Crossroads', outdoor: true, opts: LOOK[1] },
  g1: { kind: 'corridor', zone: 1, name: 'Iron Gate', w: [64, 76], outdoor: true, deck: true, opts: { ...LOOK[1], ambient: 0.1 },
    mods: [{ t: 'tablet', id: 'tab1', near: 'start', text: T1 }, { t: 'deckDoor', to: 'ga', kind: 'crypt' }], candles: [3, 5], mix: { zombie: [2, 3], skeleton: [1, 1], bat: [1, 1] } },
  g2: { kind: 'corridor', zone: 1, name: 'Grave Hollow', w: [78, 92], outdoor: true, opts: { ...LOOK[1], fog: 0.85 },
    mods: [{ t: 'door', to: 's1', kind: 'crypt' }, { t: 'djLedge', kind: 'hpup', id: 'g2_hp' }, { t: 'cell', gate: 'barricade', kind: 'atkup', id: 'g2_atk' }, { t: 'tablet', id: 'tab2', text: 'THE DEAD HERE DO NOT REST. STRIKE THEM DOWN - OR BE LAID BESIDE THEM.' }],
    candles: [4, 6], mix: { skeleton: [2, 3], zombie: [2, 3], hound: [1, 2], bat: [2, 2] } },
  g4: { kind: 'corridor', zone: 1, name: 'The Mourning Fields', w: [70, 84], outdoor: true, deck: true, opts: { ...LOOK[1], fog: 0.7 },
    mods: [{ t: 'cell', gate: 'crack', kind: 'mpup', id: 'g4_mp' }, { t: 'tablet', id: 'tab11', text: 'THE VILLAGERS WHO FELL ARE BURIED HERE. THEY WALK AGAIN, LOOKING FOR THEIR HOMES.' }],
    candles: [3, 5], mix: { zombie: [2, 3], skeleton: [2, 2], hound: [1, 2], bat: [2, 2], wyrm: [1, 1] } },
  g3: { kind: 'arena', zone: 1, name: "Gatekeeper's Court", w: [36, 42], outdoor: true, boss: 'beast', reward: 'djump', plats: 2, rise: 3, seal: 'both', candles: [3, 3], decor: 'brazier',
    opts: { ...LOOK[1], ambient: 0.16, boss: 'beast', music: 'boss' } },
  s1: { kind: 'sanctuary', zone: 1, name: "Gravekeeper's Crypt", parent: 'g2' },
  ga: { kind: 'interior', zone: 1, name: "Gravedigger's Shed", parent: 'g1', look: 'crypt', theme: 'chapel', npc: { kind: 'bearded', title: 'GRAVEDIGGER', text: 'THEY WALK AGAIN, AND I HAVE RUN OUT OF GROUND TO PUT THEM IN. THE HOLLOW BEYOND IS WORSE THAN THE GATE. TAKE THIS - IT HAS CLEARED MORE GRAVES THAN I CAN COUNT.', again: 'DIG DEEP. NEVER LOOK DOWN THE HOLE.', gifts: ['it_axe', 'it_axe'], sells: { item: 'axe', price: 55 } } },

  // ======== ZONE 7 - THE WEEPING SWAMP (Gothicvania Swamp) - you arrive with the Raven Feather
  tw: { kind: 'teleport', zone: 7, name: 'Waystone Boardwalk', outdoor: true, abilities: ['djump'], opts: LOOK[7] },
  w1: { kind: 'corridor', zone: 7, name: 'Mire Edge', w: [72, 86], outdoor: true, abilities: ['djump'], opts: { ...LOOK[7], fog: 0.75 },
    mods: [{ t: 'djLedge', kind: 'hpup', id: 'w1_hp' }, { t: 'tablet', id: 'tab12', near: 'start', text: 'THE MIRE TAKES WHAT THE GRAVE REFUSES. DO NOT STAND STILL.' }],
    candles: [3, 5], barrels: [2, 3], mix: { zombie: [1, 2], skeleton: [1, 2], bat: [1, 2], swampspider: [2, 3], swampthing: [1, 1] } },
  w2: { kind: 'corridor', zone: 7, name: 'Weeping Hollow', w: [80, 94], outdoor: true, abilities: ['djump'], deck: true, opts: { ...LOOK[7], fog: 0.9 },
    mods: [{ t: 'door', to: 'sw', kind: 'wood' }, { t: 'cell', gate: 'crystal', kind: 'mpup', id: 'w2_mp' }],
    candles: [4, 6], barrels: [2, 3], mix: { swampspider: [2, 3], swampthing: [2, 2], hound: [1, 2], bat: [2, 2], skeleton: [1, 2] } },
  w3: { kind: 'corridor', zone: 7, name: 'Drowned Boardwalk', w: [80, 94], outdoor: true, abilities: ['djump'], deck: true, opts: { ...LOOK[7], fog: 0.8 },
    mods: [{ t: 'cell', gate: 'crack', kind: 'atkup', id: 'w3_atk' }, { t: 'deckDoor', to: 'wa', kind: 'wood' }, { t: 'tablet', id: 'tab13', text: 'SOMETHING SINGS BENEATH THE WATER. IT KNOWS YOUR NAME.' }],
    candles: [4, 5], barrels: [2, 3], mix: { swampthing: [2, 3], swampspider: [2, 3], zombie: [1, 2], bat: [2, 2], wyrm: [1, 1] } },
  wb: { kind: 'arena', zone: 7, name: "The Mother's Hollow", w: [40, 46], outdoor: true, abilities: ['djump'], boss: 'bramble', reward: 'mpup', plats: 3, rise: 3, seal: 'both', flyRow: 6, candles: [3, 3], decor: 'swamp',
    opts: { ...LOOK[7], boss: 'bramble', music: 'boss', fog: 0.45 } },
  sw: { kind: 'sanctuary', zone: 7, name: 'Boardwalk Chapel', parent: 'w2' },
  wa: { kind: 'interior', zone: 7, name: "Fisherman's Hut", parent: 'w3', look: 'hut', theme: 'hall', tint: [0.0, 0.05, 0.02], npc: { kind: 'hatman', title: 'FISHERMAN', text: 'SOMETHING SINGS BENEATH THE BOARDS AT NIGHT. I STOPPED FISHING. I START COUNTING THE NOTES INSTEAD. TAKE THIS, AND KEEP MOVING.', again: 'IT HAS NOT SUNG FOR TWO NIGHTS. I DO NOT LIKE THE QUIET.', gifts: ['it_holy', 'it_marrow'], sells: { item: 'marrow', price: 40 } } },

  // ======== ZONE 2 - THE GREAT HALL
  th: { kind: 'teleport', zone: 2, name: 'Waystone Vestibule', opts: LOOK[2] },
  h1: { kind: 'corridor', zone: 2, name: 'Entrance Hall', w: [66, 76], deck: true, opts: { ...LOOK[2], ambient: 0.34 },
    mods: [{ t: 'door', to: 's2', kind: 'wood' }, { t: 'deckDoor', to: 'ha', kind: 'wood' }, { t: 'deckDoor', to: 'mr', kind: 'crypt' }, { t: 'tablet', id: 'tab3', near: 'start', text: 'THE GREAT HALL ONCE RANG WITH FEASTING. NOW THE FACES ON THE WALLS WATCH - AND SOME OF THEM WATCH BACK.' }],
    candles: [4, 6], barrels: [2, 4], mix: { bat: [3, 3], ghost: [1, 1], zealot: [3, 5] } },
  h2: { kind: 'corridor', zone: 2, name: 'Portrait Gallery', w: [84, 98], opts: { ...LOOK[2], ambient: 0.36 },
    mods: [{ t: 'djLedge', kind: 'mpup', id: 'h2_mp' }, { t: 'cell', gate: 'crystal', kind: 'hpup', id: 'h2_hp' }],
    candles: [5, 6], barrels: [2, 4], mix: { skeleton: [1, 1], ghost: [2, 2], fireskull: [2, 2], bat: [3, 3], wyrm: [1, 1], zealot: [5, 5] } },
  h4: { kind: 'arena', zone: 2, name: 'Phantom Stable', w: [40, 46], boss: 'nightmare', reward: 'dash', plats: 2, rise: 3, seal: 'both', abilities: ['djump'], decor: 'torch',
    opts: { weather: 'embers', ambient: 0.3, horizon: 12, boss: 'nightmare', music: 'boss' } },
  h3: { kind: 'tower', zone: 2, name: 'Belfry Stairs', w: [28, 32], h: [34, 40], top: [8, 10], opts: { ...LOOK[2], ambient: 0.4 },
    mods: [{ t: 'tablet', id: 'tab4', text: 'THE BELFRY STAIRS CLIMB TO THE CHAPEL. THE BELLS HAVE NOT RUNG SINCE THE LORD DESCENDED.' }], candles: [3, 4], barrels: [1, 2], mix: { bat: [3, 3], ghost: [1, 1], fireskull: [2, 2], zealot: [3, 3] } },
  s2: { kind: 'sanctuary', zone: 2, name: 'Hall Sanctuary', parent: 'h1' },
  ha: { kind: 'interior', zone: 2, name: "Servants' Quarters", parent: 'h1', look: 'study', theme: 'hall', npc: { kind: 'woman', title: 'LAST SERVANT', text: 'THE LORD DISMISSED US ALL AT DUSK, BUT THE PICTURES WOULD NOT STOP WATCHING. I HID. I AM VERY GOOD AT HIDING. HERE - IT IS NOT MUCH, BUT IT IS HONEST.', again: 'THERE IS A MIRROR BEHIND THE OTHER DOOR UPSTAIRS. I DO NOT LOOK AT IT. NEITHER SHOULD YOU.', gifts: ['it_bandage', 'heart', 'it_dagger'], sells: { item: 'bandage', price: 70 } } },

  // another OPTIONAL boss: a second door on the upper floor of the Entrance Hall opens on a room with a great mirror set into its end wall.  Walk up to it and it cracks - your reflection steps out, in silver and
  // violet, and fights with a sword and the very items you carry (the fight is sealed in until it falls; it leaves a mana container)
  mr: { kind: 'arena', lair: true, mirror: true, zone: 2, name: 'The Mirror Room', parent: 'h1', w: [44, 48], boss: 'mirror', reward: 'mpup', plats: 2, rise: 3, candles: [2, 2], decor: 'torch',
    opts: { ...LOOK[2], ambient: 0.26, tint: [0.02, 0, 0.08], vig: 0.62, boss: 'mirror', music: 'boss' } },

  // ======== ZONE 3 - THE MOONLIT CHAPEL
  tc: { kind: 'teleport', zone: 3, name: 'Waystone Chancel', opts: LOOK[3] },
  c1: { kind: 'corridor', zone: 3, name: 'The Nave', w: [76, 88], deck: true, opts: { ...LOOK[3], ambient: 0.32, fog: 0.45 },
    mods: [{ t: 'door', to: 's3', kind: 'wood' }, { t: 'deckDoor', to: 'cv', kind: 'crypt' }, { t: 'cell', gate: 'crack', chest: true, kind: 'hpup', id: 'c1_chest' }, { t: 'tablet', id: 'tab5', near: 'start', text: 'HERE THE FAITHFUL PRAYED. HERE THEY WERE FIRST TAKEN.' }],
    candles: [4, 5], barrels: [1, 2], mix: { ghost: [2, 2], ghoul: [2, 3], wizard: [1, 1], acolyte: [1, 1], bat: [1, 1], frostwyrm: [1, 1], zealot: [1, 1] } },
  c2: { kind: 'corridor', zone: 3, name: 'Bell Gallery', w: [72, 84], abilities: ['djump', 'dash'], opts: LOOK[3],
    mods: [{ t: 'gap' }, { t: 'tablet', id: 'tab6', near: 'gap', text: 'THE GULF IS TOO WIDE FOR ANY LEAP. ONLY ONE WHO STEPS THROUGH SHADOW MAY CROSS.' }],
    candles: [3, 4], mix: { wraith: [2, 2], ghost: [1, 1], wizard: [1, 1], acolyte: [1, 1], archmage: [1, 1], ghoul: [1, 2], bat: [2, 2], frostwyrm: [1, 1] } },
  c3: { kind: 'arena', zone: 3, name: 'Sanctum of the Seraph', w: [40, 46], h: 16, boss: 'angel', reward: 'ember', plats: 3, rise: 4, seal: 'both', exitGate: 'barricade', abilities: ['djump'], decor: 'column', flyRow: 6,
    opts: { weather: 'wisps', ambient: 0.28, horizon: 14, boss: 'angel', music: 'boss' } },
  s3: { kind: 'sanctuary', zone: 3, name: 'Chapel Sanctuary', parent: 'c1' },
  // an OPTIONAL boss: a door on the upper floor of the Nave leads down into the Count's crypt (the fight is sealed in until he falls; he leaves a heart container)
  cv: { kind: 'arena', lair: true, zone: 3, name: 'The Crimson Crypt', parent: 'c1', w: [40, 44], boss: 'vampire', reward: 'hpup', plats: 2, rise: 3, candles: [2, 2], decor: 'torch',
    opts: { ...LOOK[3], ambient: 0.22, tint: [0.07, 0, 0.04], vig: 0.6, boss: 'vampire', music: 'boss' } },

  // ======== ZONE 4 - THE UNDERWORKS
  tu: { kind: 'teleport', zone: 4, name: 'Waystone Boilerhouse', opts: LOOK[4] },
  u1: { kind: 'corridor', zone: 4, name: 'Boiler Corridor', w: [70, 82], opts: LOOK[4],
    mods: [{ t: 'door', to: 's5', kind: 'wood' }, { t: 'djLedge', kind: 'hpup', id: 'u1_hp' }, { t: 'tablet', id: 'tab7', near: 'start', text: 'THE LORD BUILT HIS SERVANTS OF BRASS AND SPRING SO THEY WOULD NEVER TIRE, NEVER PRAY, NEVER FLEE.' }],
    candles: [3, 4], barrels: [2, 3], mix: { skeleton: [2, 2], sorcerer: [1, 2], fireskull: [1, 1], hound: [1, 1], bat: [2, 2], emberwyrm: [1, 1], zealot: [1, 2] } },
  u2: { kind: 'tower', zone: 4, name: 'Gear Shaft', w: [28, 32], h: [36, 42], top: [9, 11], opts: { ...LOOK[4], ambient: 0.45 },
    topItem: { kind: 'atkup', id: 'u2_atk' }, candles: [3, 4], barrels: [1, 2], mix: { skeleton: [2, 2], sorcerer: [1, 1], fireskull: [3, 3], bat: [2, 2], emberwyrm: [1, 1], zealot: [1, 1] } },
  u3: { kind: 'arena', zone: 4, name: 'The Foundry', w: [44, 50], h: 16, boss: 'colossus', reward: 'thunder', plats: 2, rise: 3, seal: 'both', exitGate: 'crystal', abilities: ['djump'], decor: 'brazier',
    opts: { weather: 'sparks', ambient: 0.35, horizon: 14, boss: 'colossus', music: 'boss' } },
  s5: { kind: 'sanctuary', zone: 4, name: 'Furnace Sanctuary', parent: 'u1' },

  // ======== ZONE 5 - THE SHADOW THRONE (the waystone chamber is the last thing before the Shadow Lord)
  tt: { kind: 'teleport', zone: 5, name: 'Waystone Antechamber', opts: LOOK[5] },
  t1: { kind: 'corridor', zone: 5, name: 'Hall of Shadows', w: [80, 92], deck: true, opts: { ...LOOK[5], fog: 0.55 },
    mods: [{ t: 'door', to: 's4', kind: 'wood' }, { t: 'deckDoor', to: 'ta', kind: 'wood' }, { t: 'cell', gate: 'crystal', kind: 'mpup', id: 't1_mp' }, { t: 'tablet', id: 'tab8', near: 'start', text: 'HE WAITS ABOVE. THE ONE WHO TOOK THE SUN. TURN BACK, STRANGER - OR BRING THE DAWN.' }],
    candles: [3, 3], barrels: [2, 3], mix: { skeleton: [1, 1], wraith: [2, 2], archmage: [1, 1], bat: [4, 4], ghost: [2, 2], sorcerer: [1, 1], fireskull: [2, 2], wyrm: [1, 2], zealot: [4, 4] } },
  t2: { kind: 'arena', zone: 5, name: 'Throne of Shadows', w: [44, 50], h: 16, boss: 'shadow', reward: 'dawn', plats: 3, rise: 3, seal: 'left', abilities: ['djump'], decor: 'banner', flyRow: 5,
    opts: { ...LOOK[5], ambient: 0.5, weather: 'embers', vig: 0.75, boss: 'shadow', music: 'boss_final' } },
  s4: { kind: 'sanctuary', zone: 5, name: 'Last Sanctuary', parent: 't1' },
  ta: { kind: 'interior', zone: 5, name: 'The Hidden Study', parent: 't1', look: 'study', theme: 'hall', ambient: 0.5, tint: [0.03, 0.0, 0.05], npc: { kind: 'oldman', title: 'THE LORD\'S SCRIBE', text: 'I WROTE DOWN EVERYTHING HE DID, AND NEVER ONCE LOOKED UP. NOW I CANNOT STOP LOOKING. HE IS ABOVE US. TAKE THIS, STRANGER - AND WHEN YOU MEET HIM, DO NOT LET HIM SPEAK.', again: 'I HAVE NO MORE PAGES. ONLY THE ONES I CANNOT BURN.', gifts: ['it_holy', 'it_holy', 'heart'], sells: { item: 'holy', price: 50 } } },
};
const ORDER = ['v1', 'tv', 'v2', 'v3', 'vb', 'sv', 'tg', 'g1', 'g2', 'g4', 'g3', 's1', 'tw', 'w1', 'w2', 'w3', 'wb', 'sw', 'th', 'h1', 'h2', 'h4', 'h3', 's2', 'tc', 'c1', 'c2', 'c3', 's3', 'tu', 'u1', 'u2', 'u3', 's5', 'tt', 't1', 't2', 's4', 'hv1', 'hv2', 'hv3', 'hv4', 'ga', 'wa', 'ha', 'ta', 'cv', 'mr'];
// the main road: each room's right door leads into the next room's left door
const CHAIN = ['v1', 'tv', 'v2', 'v3', 'vb', 'tg', 'g1', 'g2', 'g4', 'g3', 'tw', 'w1', 'w2', 'w3', 'wb', 'th', 'h1', 'h2', 'h4', 'h3', 'tc', 'c1', 'c2', 'c3', 'tu', 'u1', 'u2', 'u3', 'tt', 't1', 't2'];
const LINKS = CHAIN.slice(1).map((id, i) => [CHAIN[i], 'R', id, 'L']);
// some neighbouring areas are joined by a DOOR at each end (UP) instead of an open edge: 'a>b' = a's far-right door leads to b's far-left door.  (Only when both are generated rooms: the hand-built classic ones keep their open edges.)
const DOOR_LINK = { 'v2>v3': 'wood', 'g1>g2': 'crypt', 'w1>w2': 'wood', 'h1>h2': 'wood', 'c1>c2': 'wood', 'u1>u2': 'wood' };
// abilities the player owns when coming BACK through a zone (they've beaten that zone's boss by then)
const BACK = { 6: [], 1: ['djump'], 7: ['djump'], 2: ['djump', 'dash'], 3: ['djump', 'dash', 'ember'], 4: ['djump', 'dash', 'ember', 'thunder'], 5: ['djump', 'dash', 'ember', 'thunder', 'dawn'] };
const GATE = { barricade: TILE.BARRICADE, crystal: TILE.CRYSTAL, crack: TILE.CRACK };
// haunted portraits lurk among the pictures in the castle's halls: more in the Portrait Gallery and the Shadow Throne, a chance of one elsewhere indoors
for (const id of ['h1', 'h2', 'h3', 'c1', 'c2', 'c3', 'u1', 'u2', 't1']) if (SPEC[id] && SPEC[id].mix) SPEC[id].mix.portrait = id === 'h2' || id === 't1' ? [1, 1] : [0, 1];
const PORTRAIT_PEOPLE = 15;
const BOSS_TYPE = { vampire: 'boss_vampire', beast: 'boss_beast', nightmare: 'boss_nightmare', angel: 'boss_angel', colossus: 'boss_colossus', shadow: 'boss_shadow', cinder: 'boss_cinder', bramble: 'boss_bramble', mirror: 'boss_mirror' };
const FLYERS = new Set(['bat', 'ghost', 'wraith', 'fireskull', 'wyrm', 'frostwyrm', 'emberwyrm']);
const FLYING_BOSS = new Set(['angel', 'shadow', 'bramble']);

// ------------------------------------------------------------------------------------------------ shared: populate + decorate
// is there empty room for a framed portrait (about 3 tiles across, 3 high) hanging with its bottom edge on tile row `row`, centred on column x?
const wallRoom = (b, x, row) => { const W = b.w; for (let ty = row - 3; ty < row; ty++) for (let tx = x - 1; tx <= x + 1; tx++) { if (tx < 0 || tx >= W || ty < 0) return false; if (b.def.tiles[ty * W + tx] !== 0) return false; } return true; };
function reachSurfaces(S, seen) { return S.list.filter(sf => seen.has(sf.id)); }

// enemies, candles and decor go ONLY onto surfaces the validator proved reachable
function populate(b, W, H, spec, r, S, seen, g, hasCeiling, pads) {
  const reach = reachSurfaces(S, seen), ground = reach.filter(sf => sf.x1 - sf.x0 >= 2), used = [];
  const farFromPad = x => pads.every(p => Math.abs(x - p) >= 8), free = (x, gap = 3) => !used.some(u => Math.abs(u - x) < gap);
  const pickGround = (minLen = 3, gap = 3) => { for (let t = 0; t < 60; t++) { const c = ground.filter(sf => sf.x1 - sf.x0 + 1 >= minLen); if (!c.length) return null; const sf = r.pick(c), x = r.i(sf.x0 + 1, Math.max(sf.x0 + 1, sf.x1 - 1)); if (farFromPad(x) && free(x, gap)) { used.push(x); return { sf, x }; } } return null; };
  const rows = { candle: [] };
  for (const [type, [lo, hi]] of Object.entries(spec.mix || {})) {
    const n = r.i(lo, hi);
    for (let i = 0; i < n; i++) {
      if (type === 'portrait') {                                                                           // on a wall, three tiles above the floor, where there is room for the whole frame
        let c = null; for (let tr = 0; tr < 10 && !c; tr++) { const q = pickGround(3, 1); if (q && wallRoom(b, q.x, q.sf.ty - 3)) c = q; } if (!c) continue;          // (a picture on the wall needs no floor space of its own)
        b.e('portrait', c.x, c.sf.ty - 3, { ci: r.i(0, PORTRAIT_PEOPLE - 1), frame: r.i(0, 4) }); continue;
      }
      if (type === 'bat') {
        const c = pickGround(1) || null; if (!c) continue;
        if (hasCeiling) b.e('bat', c.x, 3); else b.e('bat', c.x, Math.max(3, c.sf.ty - r.i(5, 7)));
      } else if (FLYERS.has(type)) { const c = pickGround(1); if (!c) continue; b.e(type, c.x, Math.max(hasCeiling ? 4 : 3, c.sf.ty - r.i(4, 6))); }
      else { const c = pickGround(type === 'hound' ? 6 : 3); if (!c) continue; b.e(type, c.x, c.sf.ty); }
    }
  }
  for (let i = 0, n = spec.barrels ? Math.round(r.i(spec.barrels[0], spec.barrels[1]) * 0.6) : 0; i < n; i++) { const c = pickGround(2, 2); if (c) b.e('barrel', c.x, c.sf.ty, { drop: r.pick(['coin', 'coin', 'heart', 'mana', 'coin', 'heart']) }); }          // clay pots: one hit, one small treat
  const nCandle = spec.candles ? r.i(spec.candles[0], spec.candles[1]) : 0, drops = ['heart', 'mana', 'coin', 'coin', 'potion', 'heart'];
  for (let i = 0; i < nCandle; i++) { const c = pickGround(3); if (c) b.candle(c.x, c.sf.ty); }                                   // lit candelabras: ambiance only, nothing to break
  const ns = nCandle / 2.5, nStatue = Math.floor(ns) + (r.chance(ns - Math.floor(ns)) ? 1 : 0);                                  // statues: breakable (2-3 hits), rich, and 2.5x rarer
  for (let i = 0; i < nStatue; i++) { const c = pickGround(3); if (c) b.e('statue', c.x, c.sf.ty, { drop: r.pick(drops) }); }
  if (r.chance(0.35)) { const c = pickGround(2); if (c) { const item = r.wpick(ITEM_ORDER.map(k => [k, ITEMS[k].weight])); b.e('itemspawn', c.x, c.sf.ty, { item, qty: ITEMS[item].pack, id: 'ip_' + b.def.id + '_' + c.x }); } }       // a carried item lying on the floor (gone for good once picked up)
  return { used, ground };
}

function decorate(b, W, spec, r, g, ceilRows, flatCols) {
  const th = spec.theme || ZONES[spec.zone].theme;
  if (th === 'swamp') {          // Gothicvania Swamp: huge twisted trees behind, ferns and vines on the ground, the odd headstone
    let last = -99; for (let i = 0; i < Math.round(W / 9) && flatCols.length; i++) { const x = r.pick(flatCols); if (Math.abs(x - last) < 14) continue; last = x; b.d('img', x, g[x], { img: 'swamp_trees', back: true, sink: 3 }); }
    last = -9; for (let i = 0; i < Math.round(W / 4) && flatCols.length; i++) { const x = r.pick(flatCols); if (Math.abs(x - last) < 6) continue; last = x; const im = r.chance(0.6) ? 'swamp_props' : r.pick(['cemetery_stone-1', 'cemetery_stone-3', 'cemetery_bush-small']); b.d('img', x, g[x], { img: im, back: false, sink: im === 'swamp_props' ? 4 : 1 }); }          // (the vine sheet's pictures end 1-4px above the bottom of the image: sunk so they stand IN the ground)
    // shallow pools on flat ground (clear stretches only: no pits, steps or spikes): wading through one washes the white cloak
    const placed = [];
    for (let tries = 0, pools = 0; tries < 60 && pools < Math.max(1, Math.round(W / 30)) && flatCols.length; tries++) {
      const x = r.pick(flatCols), half = 3; let ok = x - half >= 3 && x + half < W - 3 && placed.every(q => Math.abs(q - x) > 14);
      for (let k = -half; ok && k <= half; k++) if (g[x + k] !== g[x] || b.def.tiles[(g[x + k] - 1) * W + x + k] !== 0) ok = false;
      if (ok) { b.d('pool', x, g[x], { w: (half * 2 + 1) * 16 }); placed.push(x); pools++; }
    }
    return;
  }
  if (th === 'village') {         // a street of burning houses (drawn behind the tiles), with lamps, carts, barrels and braziers along it
    const homes = [];                                                                               // houses whose door is a real door (UP) are set first, so the door lines up with the house's own painted one
    for (const d of b.def.doors) if (d.house) { const img = r.pick(Object.keys(HOUSES)), hx = d.x - Math.round(DOORS[img][0] / 16); homes.push(hx); b.house(hx, d.gy, img, r.shuffle(HOUSES[img].map((_, k) => k)).slice(0, r.i(1, 2)), true); }
    for (let i = 0; i < Math.round(W / 14) && flatCols.length; i++) { const x = r.pick(flatCols); if (homes.some(h => Math.abs(h - x) < 15)) continue; homes.push(x); const img = r.pick(Object.keys(HOUSES)); b.house(x, g[x], img, r.shuffle(HOUSES[img].map((_, k) => k)).slice(0, r.i(1, 2))); }
    let last = -9; for (let i = 0; i < Math.round(W / 5) && flatCols.length; i++) { const x = r.pick(flatCols); if (Math.abs(x - last) < 5) continue; last = x; b.d('img', x, g[x], { img: r.pick(['town_lamp', 'town_lamp', 'town_crates', 'town_crates', 'town_cart', 'town_well', 'town_lamp', 'town_cart', 'town_crates']) }); }      // (the shop sign hangs above house doors - see B.house - never on the street)
    for (let i = 0, n = r.i(1, 3); i < n && flatCols.length; i++) { const x = r.pick(flatCols); b.d('brazier', x, g[x]); }
    return;
  }
  if (th === 'graveyard') {
    const kinds = [['cemetery_stone-1', 5, false], ['cemetery_stone-2', 5, false], ['cemetery_stone-3', 4, false], ['cemetery_stone-4', 4, false], ['cemetery_bush-small', 4, false], ['cemetery_bush-large', 3, true], ['cemetery_tree-1', 3, true], ['cemetery_tree-2', 3, true], ['cemetery_tree-3', 3, true],
      ['forest_tree_1', 3, true], ['forest_tree_2', 3, true], ['forest_tree_3', 3, true], ['forest_tree_4', 3, true]];       // the four gnarled dead trees are from Haunted Forest Trees (ETTiNGRiNDER, CC0)
    let last = -9; const n = Math.round(W / 6);
    for (let i = 0; i < n && flatCols.length; i++) { const x = r.pick(flatCols); if (Math.abs(x - last) < 4) continue; last = x; const k = r.wpick(kinds.map(k => [k, k[1]])); b.d('img', x, g[x], { img: k[0], back: k[2] }); }
    if (flatCols.length) { const x = r.pick(flatCols.slice(0, Math.max(1, flatCols.length >> 1))); b.d('img', x, g[x], { img: 'cemetery_statue', back: false }); }
    return;
  }
  const xs = []; for (let x = r.i(7, 11); x < W - 5; x += r.i(10, 15)) xs.push(x);
  if (th === 'hall') for (const x of xs) b.d('dgtorch', x, spec.deck ? 11 : 7); else b.torches(xs, spec.deck ? 10 : 6);
  if (spec.deck) { const lo = xs.map(x => x + 5).filter(x => x < W - 4); if (th === 'hall') for (const x of lo) b.d('dgtorch', x, 20); else b.torches(lo, 19); }          // a second row of torches for the lower floor          // the Hall's torches are the Sidescroller's Dungeon ones (the flame is in the sprite)
  const spread = (n, gap, fn) => { const used = []; for (let i = 0; i < n * 4 && used.length < n && flatCols.length; i++) { const x = r.pick(flatCols); if (used.some(u => Math.abs(u - x) < gap)) continue; used.push(x); fn(x); } };
  const banner = th === 'hall' ? '#7a1e2a' : th === 'throne' ? '#6a1020' : th === 'chapel' ? '#5a2a6a' : null;
  if (banner) for (let i = 0; i < Math.round(W / 20); i++) b.d('banner', r.i(8, W - 9), 2, { len: r.i(4, 7), color: banner });
  const place = (t, n) => { for (let i = 0; i < n && flatCols.length; i++) { const x = r.pick(flatCols); b.d(t, x, g[x]); } };
  if (th === 'hall' || th === 'chapel' || th === 'throne') place('cdl', r.i(2, 4));
  if (th === 'chapel' || th === 'throne') place('column', r.i(2, 4));
  if (th === 'underworks') place('brazier', r.i(2, 3));
  // set dressing: the Hall is a library of bookcases (drawn in code) between teal Sidescroller's pillars; the Chapel and the Throne keep to their columns, banners and candelabras;
  // the Underworks is crates, urns and barred windows
  if (th === 'hall' || th === 'chapel' || th === 'throne' || th === 'underworks') spread(r.i(1, 3), 15, x => { if (wallRoom(b, x, g[x] - 3)) b.d('portrait', x, g[x] - 3, { ci: r.i(0, PORTRAIT_PEOPLE - 1), emo: r.pick([0, 0, 1, 1, 4, 2, 3]), frame: r.i(0, 4) }); });          // framed portraits on the walls (some are not just pictures: see portraits.js)
  if (th === 'hall') {
    spread(r.i(1, 2), 16, x => b.d('bookcase', x, g[x], { back: true })); spread(r.i(1, 2), 14, x => b.d('img', x, g[x], { img: 'dg_pillar_' + r.i(1, 4), back: true }));
    spread(r.i(1, 2), 12, x => b.d('img', x, g[x], { img: 'dg_urn_' + r.i(1, 3) })); spread(1, 12, x => b.d('hang', x, 2, { img: 'dg_banner_' + r.i(1, 6) }));
  } else if (th === 'throne') spread(1, 12, x => b.d('hang', x, 2, { img: 'dg_banner_' + r.pick([1, 4]) }));
  else if (th === 'underworks') {
    spread(r.i(1, 2), 14, x => b.d('img', x, g[x], { img: 'dg_crates' })); spread(1, 14, x => b.d('img', x, g[x], { img: 'dg_urn_' + r.i(1, 3) })); spread(r.i(1, 2), 16, x => b.d('barwin', x, 8, { back: true }));
  }
}

// ------------------------------------------------------------------------------------------------ CORRIDOR
function genCorridor(id, spec, r) {
  // DECK: a tall room with TWO floors - a staircase of one-way platforms climbs to an upper floor over the middle of the room (its standing row is DK) and another staircase comes down at the far end
  const outdoor = !!spec.outdoor, DECK = !!spec.deck, DY = DECK ? 12 : 0, H = 14 + DY, BASE = 12 + DY, DK = 13, PAD = 6, ceil = outdoor ? 0 : 2, gyMin = (outdoor ? 8 : 9) + DY;
  const mods = (spec.mods || []).map(m => ({ ...m })), flatMods = mods.filter(m => ['door', 'djLedge', 'cell', 'gap'].includes(m.t)), tablets = mods.filter(m => m.t === 'tablet'), deckDoors = mods.filter(m => m.t === 'deckDoor');
  const target = r.i(spec.w[0], spec.w[1]);
  const g = [], plats = [], ledges = [], doors = [], items = [], cells = [], climbs = []; let x = 0, gy = BASE, gapStart = -1, gapEnd = -1;
  const col = v => { g[x++] = v; };
  const flat = n => { for (let i = 0; i < n; i++) col(gy); };
  const canStep = (up, h) => { const ng = gy + (up ? -h : h); return ng >= gyMin && ng <= BASE; };
  const step = (up, h) => { gy += up ? -h : h; };
  const toBase = () => { while (gy < BASE) { step(false, Math.min(2, BASE - gy)); flat(r.i(2, 3)); } };

  const SEG = {
    flat: () => flat(r.i(2, 5)),
    step: () => { const up = gy >= BASE ? true : r.chance(0.5), h = r.i(1, 2); if (canStep(up, h)) { step(up, h); flat(r.i(2, 4)); } else flat(3); },
    pit: () => { flat(2); const w = r.i(2, 3); for (let i = 0; i < w; i++) col(-1); flat(r.i(3, 4)); },
    bridge: () => { flat(2); const len = r.i(6, 10), x0 = x; for (let i = 0; i < len; i++) col(-1); const n = Math.ceil(len / 4); for (let k = 0; k < n; k++) { const c = Math.round(x0 + (k + 1) * len / (n + 1)), pl = r.i(2, 3); plats.push([c - Math.floor(pl / 2), pl, gy - r.i(0, 1)]); } flat(r.i(3, 4)); },
    block: () => { const h = r.i(1, 2); if (!canStep(true, h)) return flat(3); flat(2); step(true, h); flat(r.i(2, 4)); step(false, h); flat(r.i(2, 3)); },
    stairs: () => { const n = r.i(2, 3), up = gy > gyMin + n && r.chance(0.6); for (let i = 0; i < n; i++) { if (!canStep(up, 1)) break; step(up, 1); flat(2); } flat(1); },
    loot: () => { const len = r.i(3, 5); flat(1); plats.push([x + 1, len, gy - 3]); flat(len + 2); },
  };
  const WEIGHTS = [['flat', 21], ['step', 18], ['pit', 19], ['bridge', 10], ['block', 13], ['stairs', 10], ['loot', 9]];      // spikes live ONLY at the bottom of pits and gaps (never on open ground, where scenery can hide them)
  const MOD = {
    door: m => { toBase(); flat(2); const w = r.i(5, 7), x0 = x; flat(w); doors.push({ x: x0 + (w >> 1), gy, to: m.to, kind: m.kind || 'wood' }); flat(2); },
    djLedge: m => { toBase(); flat(2); const padX = x; flat(3); plats.push([padX, 3, gy - 3]); const lx = x, row = gy - 3 - (outdoor ? 5 : 4); ledges.push([lx, 6, row]); flat(8); items.push({ ...m, tx: lx + 3, gy: row, needs: 'djump' }); },
    cell: m => { toBase(); flat(2); const xs = x + 4; flat(14); cells.push({ ...m, xs, gy }); },
    climb: side => { toBase(); const x0 = x; flat(14); climbs.push({ x0, side }); },                                  // 14 flat columns: the foot of a staircase up to the upper floor
    gap: () => { toBase(); flat(6); gapStart = x; const G = r.i(spec.gapW?.[0] ?? 9, spec.gapW?.[1] ?? 9); for (let i = 0; i < G; i++) col(-1); gapEnd = x - 1; flat(6); },
  };
  flat(PAD); if (DECK) MOD.climb('L');
  const tEnd = target - (DECK ? 15 : 0), order = r.shuffle(flatMods), need = { door: 9, djLedge: 15, cell: 18, gap: 22 }, reserved = order.reduce((s, m) => s + need[m.t], 0);
  const slotW = Math.max(6, (tEnd - PAD * 2 - reserved) / (order.length + 1));
  for (let s = 0; s <= order.length; s++) {
    const left = order.slice(s).reduce((t, m) => t + need[m.t], 0), until = Math.min(x + Math.max(5, Math.round(slotW * (0.7 + 0.6 * r.f()))), Math.max(x + 5, tEnd - PAD - left));
    while (x < until) SEG[r.wpick(WEIGHTS)]();
    if (s < order.length) MOD[order[s].t](order[s]);
  }
  while (x < tEnd - PAD) SEG[r.wpick(WEIGHTS)]();
  if (DECK) MOD.climb('R'); toBase(); flat(PAD);

  const W = x, b = new B(id, spec.name, spec.zone, W, H, { ...spec.opts, theme: spec.theme, ...(DECK ? { horizon: BASE } : {}) });
  for (let cx = 0; cx < W; cx++) { if (g[cx] >= 0) b.rect(cx, g[cx], 1, H - g[cx]); else b.put(cx, H - 1, TILE.SPIKE); }
  if (!outdoor) b.ceil(0, W, ceil);
  for (const [px, len, row] of plats) b.plat(px, len, row);
  for (const [lx, len, row] of ledges) b.ledge(lx, len, row);
  if (DECK) {                                                                                      // the upper floor, with the odd hole, raised block and floating platform
    const L = climbs.find(c => c.side === 'L'), R = climbs.find(c => c.side === 'R'), da = L.x0 + 14, db = R.x0 - 1, len = db - da + 1;
    if (len < 14) return { ok: false, errs: ['upper floor too short'] };
    for (let k = 0; k < 3; k++) { b.plat(L.x0 + 1 + k * 4, 4, BASE - 3 - 3 * k); b.plat(R.x0 + 9 - k * 4, 4, BASE - 3 - 3 * k); }          // a staircase of one-way platforms up each end
    b.rect(da, DK, len, 2);
    const feats = r.shuffle(['hole', 'block', 'hole', 'block', 'plat']).slice(0, r.i(2, 4)), nf = Math.min(feats.length, Math.floor((len - 10) / 8)), keepOut = [], holes = [];
    for (let k = 0; k < nf; k++) {
      const cx = da + 5 + Math.round((len - 10) * (k + 0.5) / nf), f = feats[k];
      if (f === 'hole') { const w = r.i(2, 3); b.rect(cx, DK, w, 2, TILE.EMPTY); keepOut.push([cx - 2, cx + w + 1]); holes.push([cx, w]); }                   // a gap to jump (fall and you land on the lower floor)
      else if (f === 'block') { const w = r.i(3, 4), h = r.i(1, 2); b.rect(cx, DK - h, w, h); keepOut.push([cx - 2, cx + w + 1]); }
      else { b.plat(cx, 4, DK - 3); keepOut.push([cx - 1, cx + 5]); }
    }
    if ((spec.theme || ZONES[spec.zone].theme) === 'swamp') {                                          // a tall mire room has WATERFALLS: through every hole in the upper floor, from the sky to the lower floor, and a couple of cascades that seep through the slab
      const low = c => (g[c] >= 0 ? g[c] : BASE), taken = [];
      for (const [hx, hw] of holes) { b.d('waterfall', hx + hw / 2 - 0.5, low(hx + (hw >> 1)), { top: -80, w: hw * 16 - 10 }); taken.push(hx + hw / 2); }
      const cand = []; for (let c = da + 6; c <= db - 6; c++) if (!keepOut.some(([a, z]) => c >= a && c <= z) && g[c - 1] >= 17 && g[c] >= 17 && g[c + 1] >= 17) cand.push(c);
      for (let i = 0, want = holes.length >= 2 ? 1 : 2; i < want; i++) {
        const ok = r.shuffle(cand.filter(c => taken.every(q => Math.abs(q - c) >= 14))); if (!ok.length) break; const c = ok[0]; taken.push(c);
        b.d('waterfall', c, DK, { top: -80, w: 22 }); b.d('waterfall', c, g[c], { top: (DK + 2) * 16, w: 16 });          // (it falls on to the upper floor, and comes out again under it)
      }
    }
    for (const m of deckDoors) {                                                                   // a door on the upper floor leads to a small room of its own (and two of them stand well apart)
      const cand = []; for (let cx = da + 4; cx <= db - 4; cx++) if (!keepOut.some(([a, z]) => cx >= a && cx <= z) && doors.every(d => !d.deck || Math.abs(d.x - cx) >= 13)) cand.push(cx);
      if (!cand.length) return { ok: false, errs: ['no place for the upper door'] };
      const mid = cand.filter(cx => cx > da + len * 0.25 && cx < da + len * 0.75); doors.push({ x: r.pick(mid.length ? mid : cand), gy: DK, to: m.to, kind: m.kind || 'wood', deck: true });
    }
  } else if (deckDoors.length) return { ok: false, errs: ['an upper door needs an upper floor'] };
  if (spec.doorL) doors.push({ x: 4, gy: BASE, to: spec.doorL.to, kind: spec.doorL.kind }); if (spec.doorR) doors.push({ x: W - 5, gy: BASE, to: spec.doorR.to, kind: spec.doorR.kind });       // doors between areas
  const meta = { abilities: [...(spec.abilities || [])], back: BACK[spec.zone], entry: { L: { tx: 1, gy: BASE }, R: { tx: W - 2, gy: BASE } }, must: [], items: [], start: { tx: 4, gy: BASE } };
  if (spec.closedLeft) { meta.entry.L = null; b.d('gate', 0, BASE); }
  for (const d of doors) { b.door(d.x, d.gy, d.to, 3, 12, d.kind); if (d.deck) meta.must.push({ tx: d.x, gy: d.gy, name: 'upper door' }); }
  for (const it of items) { b.e('upgrade', it.tx, it.gy, { kind: it.kind, id: it.id }); meta.items.push({ id: it.id, tx: it.tx, gy: it.gy, needs: 'djump' }); }
  for (const c of cells) {
    const cx = b.cell(c.xs, 7, GATE[c.gate], c.gy), gate = [[c.xs + 6, c.gy - 3], [c.xs + 6, c.gy - 2], [c.xs + 6, c.gy - 1]];
    if (c.chest) b.e('chest', cx, c.gy, { contents: c.kind, id: c.id }); else b.e('upgrade', cx, c.gy, { kind: c.kind, id: c.id });
    meta.items.push({ id: c.id, tx: cx, gy: c.gy, gate });
  }
  if (gapStart >= 0) { meta.abilities = ['djump', 'dash']; meta.gap = { x0: gapStart, x1: gapEnd }; }
  // tablets: near the start, or just before the gulf
  const flatCols = []; for (let cx = 2; cx < W - 2; cx++) if (g[cx] >= 0 && g[cx - 1] === g[cx] && g[cx + 1] === g[cx]) flatCols.push(cx);
  const solidAt = (tx, ty) => b.def.tiles[ty * W + tx];
  for (const t of tablets) {
    let tx = -1;
    if (t.near === 'gap' && gapStart >= 0) tx = gapStart - 3; else { const cand = flatCols.filter(c => c >= PAD + 2 && c <= PAD + 16 && !solidAt(c, g[c] - 1) && !doors.some(d => Math.abs(d.x - c) < 4)); if (cand.length) tx = r.pick(cand); }
    if (tx < 0) { const cand = flatCols.filter(c => !solidAt(c, g[c] - 1) && !doors.some(d => Math.abs(d.x - c) < 4)); tx = cand.length ? r.pick(cand) : -1; }          // (never in front of a door: a tablet would take the UP key)
    if (tx < 0) return { ok: false, errs: ['no place for tablet'] };
    b.tablet(tx, g[tx], t.text, t.id); meta.must.push({ tx, gy: g[tx], name: 'tablet ' + t.id });
  }
  b.def.meta = meta; b.def.entries = { L: meta.entry.L, R: meta.entry.R };
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  populate(b, W, H, spec, r, v.S, v.seen, g, !outdoor, [1, W - 2]);
  decorate(b, W, spec, r, g, ceil, flatCols);
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ TOWER (vertical climb)
function genTower(id, spec, r) {
  const W = r.i(spec.w[0], spec.w[1]), H = r.i(spec.h[0], spec.h[1]), floor = H - 2, top = r.i(spec.top[0], spec.top[1]);
  const b = new B(id, spec.name, spec.zone, W, H, { ...spec.opts, horizon: floor });
  b.floor(0, W, floor).ceil(0, W, 2);
  const plats = []; let prev = { x: r.i(3, 6), len: r.i(5, 6), row: floor - r.i(2, 3) }; plats.push(prev); let dir = 1, guard = 0;
  const add = (nx, len, row) => { prev = { x: Math.max(1, Math.min(W - 2 - len, nx)), len, row }; plats.push(prev); };
  while (prev.row - top > 3 && guard++ < 60) {
    let rise = r.i(2, 3); if (prev.row - rise < top + 2) rise = Math.max(1, prev.row - (top + 2));
    const len = r.i(5, 6), gap = r.i(0, 2); let nx;
    if (dir > 0) { nx = prev.x + prev.len + gap; if (nx + len > W - 2) dir = -1; }
    if (dir < 0) { nx = prev.x - gap - len; if (nx < 1) { dir = 1; nx = prev.x + prev.len + gap; } }
    add(nx, len, prev.row - rise);
  }
  while (prev.x + prev.len < W - 17 && guard++ < 90) add(prev.x + prev.len + r.i(0, 2), r.i(5, 6), prev.row);       // work over to the right side, under the top ledge
  for (const p of plats) b.plat(p.x, p.len, p.row);
  b.plat(W - 14, 14, top);                                                   // the top landing (one-way, so you can jump up through it)
  const meta = { abilities: [...(spec.abilities || [])], back: BACK[spec.zone], entry: { L: { tx: 1, gy: floor }, R: { tx: W - 2, gy: top } }, must: [], items: [] };
  if (spec.doorL) b.door(W - 9, floor, spec.doorL.to, 0, 0, spec.doorL.kind);                       // the door from the previous area
  if (spec.topItem) { b.e('upgrade', W - 7, top, { kind: spec.topItem.kind, id: spec.topItem.id }); meta.must.push({ tx: W - 7, gy: top, name: 'top item' }); }
  b.def.meta = meta; b.def.entries = { L: meta.entry.L, R: meta.entry.R };
  for (const t of (spec.mods || []).filter(m => m.t === 'tablet')) { b.tablet(W - 4, top, t.text, t.id); meta.must.push({ tx: W - 4, gy: top, name: 'tablet' }); }
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  const g = new Array(W).fill(floor);
  populate(b, W, H, spec, r, v.S, v.seen, g, true, [1, W - 2]);
  for (const rr of [floor - 6, floor - 14, floor - 22].filter(y => y > top)) b.torches([2, W - 3], rr);
  b.d('brazier', 4, floor).d('brazier', W - 5, floor);
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ BOSS ARENA
function genArena(id, spec, r) {
  const outdoor = !!spec.outdoor, H = spec.h || 14, BASE = H - 2, W = r.i(spec.w[0], spec.w[1]), rise = spec.rise || 3;
  const b = new B(id, spec.name, spec.zone, W, H, { ...spec.opts, theme: spec.theme });
  b.floor(0, W, BASE); if (!outdoor) b.ceil(0, W, 2);
  const mirror = !!spec.mirror, MW = mirror ? 14 : 0, mx0 = W - MW;                              // the mirror room: its last 14 columns are a solid wall with the great mirror set into it
  const L = r.i(5, 9), len1 = r.i(4, 5), Rr = mirror ? mx0 - r.i(5, 7) - len1 : W - r.i(9, 13) - len1;
  b.plat(L, len1, BASE - rise); b.plat(Rr, len1, BASE - rise);
  if (mirror) {
    b.rect(mx0, 2, MW, BASE - 2);
    const band = 7, fx = mx0 * 16 + 3, fx1 = W * 16 - 13, fy = 36, gy1 = BASE * 16;               // the frame, the glass inside it (its left edge is the mirror's plane: the reflection stands where you would, seen from the other side) and the floor it stands on
    b.def.mirror = { fx, fy, fw: fx1 - fx, fh: gy1 + band - fy, band, plane: fx + band, x1: fx1 - band, y0: fy + band, y1: gy1, wall: mx0 * 16 };
  }
  const must = [{ tx: L + 1, gy: BASE - rise, name: 'left platform' }, { tx: Rr + 1, gy: BASE - rise, name: 'right platform' }];
  if (spec.plats >= 3) { const ml = r.i(5, 7), mx = Math.round(W / 2 - ml / 2) + r.i(-2, 2), mr = BASE - rise - 2; b.plat(mx, ml, mr); must.push({ tx: mx + 2, gy: mr, name: 'middle platform' }); }
  const bossX = mirror ? mx0 - 3 : Math.round(W * 0.7) + r.i(-3, 2), flying = FLYING_BOSS.has(spec.boss), brow = flying ? BASE - (spec.flyRow || 6) : BASE;
  b.e(BOSS_TYPE[spec.boss], bossX, brow, { reward: spec.reward });
  const lair = !!spec.lair;                                                                       // a lair is entered by a door (at x=3), has no other way out, and needs no seals
  const seals = lair ? [] : [{ x: 0, y0: BASE - 3, y1: BASE - 1 }];
  if (!lair && spec.seal === 'both') seals.push({ x: spec.exitGate ? W - 2 : W - 1, y0: BASE - 3, y1: BASE - 1 });
  b.bossSeals(...seals);
  if (lair) b.door(3, BASE, spec.parent, 0, BASE, 'crypt');
  if (spec.exitGate) b.rect(W - 1, BASE - 3, 1, 3, GATE[spec.exitGate]);
  const g = new Array(W).fill(BASE), meta = { abilities: spec.abilities || [], back: BACK[spec.zone], entry: { L: { tx: 1, gy: BASE }, R: spec.seal === 'left' || lair ? null : { tx: spec.exitGate ? W - 4 : W - 2, gy: BASE } }, must, items: [], start: { tx: 3, gy: BASE } };
  b.def.meta = meta; b.def.entries = { L: meta.entry.L, R: spec.seal === 'left' || lair ? null : { tx: W - 2, gy: BASE } };
  if (spec.candles) { const n = spec.candles[0];                                                                          // (a boss room has candelabras only: no treasure statues)
    const span = (mirror ? mx0 - 6 : W - 8) - 8; for (let k = 0; k < n; k++) { const cx = Math.round(8 + span * (k + 0.5) / n) + r.i(-2, 2); b.candle(cx, BASE); } }
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  // decor
  const flat = []; for (let cx = 3; cx < W - 3; cx++) flat.push(cx);
  const th = ZONES[spec.zone].theme;
  if (th === 'graveyard') { b.d('brazier', 4, BASE).d('brazier', W - 5, BASE).d('img', Math.round(W / 2), BASE, { img: 'cemetery_statue', back: true }); for (const k of ['cemetery_stone-4', 'cemetery_stone-1']) b.d('img', r.i(8, W - 9), BASE, { img: k }); }
  else if (th === 'village' || th === 'swamp') { decorate(b, W, spec, r, g, 0, flat); b.d('brazier', 4, BASE).d('brazier', W - 5, BASE); }
  else { const lim = mirror ? mx0 - 2 : W - 2; b.torches([4, 12, Math.round(W / 2), W - 13, W - 5, mx0 - 2].filter(cx => cx > 2 && cx < lim), 6); if (spec.decor === 'column') { b.d('column', 4, BASE).d('column', W - 5, BASE); b.d('cdl', r.i(10, 16), BASE).d('cdl', W - r.i(12, 18), BASE); } else if (spec.decor === 'brazier') { b.d('brazier', 4, BASE).d('brazier', W - 5, BASE); } else if (spec.decor === 'banner') { b.d('column', 4, BASE).d('column', W - 5, BASE).d('brazier', 11, BASE).d('brazier', W - 12, BASE); for (const bx of [8, 14, W - 15, W - 9]) b.d('banner', bx, 2, { len: 8, color: '#6a1020' }); } else for (const bx of mirror ? [10, mx0 - 9] : [10, W - 11]) b.d('banner', bx, 2, { len: 6, color: mirror ? '#3a1a5a' : '#7a1e2a' }); }
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ SANCTUARY (save room)
function genSanctuary(id, spec, r) {
  const b = new B(id, spec.name, spec.zone, 22, 14, { theme: 'chapel', music: 'save', ambient: 0.35, save: true, weather: 'wisps', horizon: 12, map: spec.map });
  b.floor(0, 22, 12).ceil(0, 22, 2).torches([4, 18], 7); const flip = r.chance(0.5);
  b.d('cdl', flip ? 15 : 7, 12, { keep: true }).d('cdl', flip ? 7 : 15, 12, { keep: true }).e('altar', 11, 12).door(3, 12, spec.parent, 0, 12, 'wood');
  const col = r.pick(['#5a2a6a', '#2a3a6a', '#6a2a3a']); b.d('banner', 9, 2, { len: 5, color: col }).d('banner', 13, 2, { len: 5, color: col });
  b.def.meta = { abilities: [], entry: {}, start: { tx: 3, gy: 12 }, must: [{ tx: 11, gy: 12, name: 'altar' }], items: [] }; b.def.entries = {};
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ WAYSTONE CHAMBER (the teleport room that opens every zone)
// A calm, enemy-free room in the zone's own look (open sky in the outdoor zones) with the waystone in the middle.  Walking up to it attunes it; UP opens the travel map.
function genTeleport(id, spec, r) {
  const W = r.i(26, 32), H = 14, BASE = 12, outdoor = !!spec.outdoor, cx = W >> 1;
  const b = new B(id, spec.name, spec.zone, W, H, { ...spec.opts, music: 'save', theme: spec.theme });
  b.floor(0, W, BASE); if (!outdoor) b.ceil(0, W, 2);
  b.e('waystone', cx, BASE, { id: 'tp_' + id }); b.d('brazier', cx - 7, BASE).d('brazier', cx + 7, BASE);
  const meta = { abilities: [...(spec.abilities || [])], back: BACK[spec.zone], entry: { L: { tx: 1, gy: BASE }, R: { tx: W - 2, gy: BASE } }, must: [{ tx: cx, gy: BASE, name: 'waystone' }], items: [], start: { tx: 3, gy: BASE } };
  b.def.meta = meta; b.def.entries = { L: meta.entry.L, R: meta.entry.R };
  const g = new Array(W).fill(BASE), flatCols = []; for (let x = 3; x < W - 3; x++) if (Math.abs(x - cx) > 6) flatCols.push(x);
  decorate(b, W, spec, r, g, outdoor ? 0 : 2, flatCols);
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ INTERIOR (a house, a hut, a crypt: one calm room behind a door)
// People stand about or amble slowly; each gives you something for listening (UP).  A few barrels, a thing on the floor, and the room is furnished from the same props the castle uses.
function genInterior(id, spec, r) {
  const W = r.i(spec.w ? spec.w[0] : 22, spec.w ? spec.w[1] : 28), H = 14, look = spec.look || 'cottage';
  const b = new B(id, spec.name, spec.zone, W, H, { theme: spec.theme || 'hall', ambient: spec.ambient === undefined ? 0.4 : spec.ambient, tint: spec.tint || [0.14, 0.06, 0.01], vig: 0.6, horizon: 12, weather: spec.weather || null, indoor: true });
  b.floor(0, W, 12).ceil(0, W, 2).door(3, 12, spec.parent, 0, 12, 'wood').torches([7, W - 5], 6);
  const slots = r.shuffle(Array.from({ length: Math.floor((W - 13) / 3) + 1 }, (_, i) => 8 + i * 3)), take = () => slots.pop();
  const furnish = {
    cottage: [['bookcase', null, true], ['bookcase', null, true], ['img', 'town_crates'], ['img', 'dg_crates'], ['img', 'dg_urn_' + r.i(1, 3)], ['img', 'dg_urn_' + r.i(1, 3)]],
    hut: [['img', 'dg_crates'], ['img', 'town_crates'], ['img', 'dg_urn_' + r.i(1, 3)], ['img', 'dg_urn_' + r.i(1, 3)]],
    crypt: [['img', 'dg_urn_' + r.i(1, 3)], ['column', null, true], ['img', 'dg_urn_' + r.i(1, 3)], ['column', null, true], ['img', 'dg_crates']],
    study: [['bookcase', null, true], ['bookcase', null, true], ['bookcase', null, true], ['column', null, true], ['img', 'dg_urn_' + r.i(1, 3)]],
  }[look] || [];
  for (const [t, img, back, scale] of furnish) { const x = take(); if (x === undefined) break; if (t === 'img') b.d('img', x, 12, { img, back: !!back, ...(scale ? { scale } : {}) }); else b.d(t, x, 12, { back: !!back }); }
  for (const x of [Math.floor(W * 0.35), Math.floor(W * 0.7)]) if (r.chance(0.8)) b.d('barwin', x, 8, { back: true });
  for (let i = 0; i < 3; i++) b.candle(8, 12);                                                      // (set properly by arrangeCandelabras: beside the door and about the room)
  const used = [];
  const spot = () => { for (let k = 0; k < 40; k++) { const x = r.i(7, W - 4); if (used.every(u => Math.abs(u - x) >= 3)) { used.push(x); return x; } } return null; };
  if (spec.npc) { const x = Math.floor(W * 0.55); used.push(x); b.e('villager', x, 12, { kind: spec.npc.kind, calm: true, stand: true, title: spec.npc.title, text: spec.npc.text, gifts: spec.npc.gifts, again: spec.npc.again, ...(spec.npc.sells ? { sells: offerOf(spec.npc.sells.item, spec.npc.sells) } : {}) }); }
  else {
    const n = r.i(spec.npcs ? spec.npcs[0] : 1, spec.npcs ? spec.npcs[1] : 2), kinds = r.shuffle(['woman', 'bearded', 'hatman', 'oldman']), shops = r.shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, spec.sellers === undefined ? (r.chance(0.55) ? 1 : 0) : spec.sellers);       // some of them sell
    for (let i = 0; i < n; i++) { const x = spot(); if (x !== null) b.e('villager', x, 12, { kind: kinds[i % 4], calm: true, stand: r.chance(0.4), ...(shops.includes(i) ? { sells: offerOf(r.wpick(ITEM_ORDER.map(k => [k, ITEMS[k].weight + 1]))) } : {}) }); }
  }
  for (let i = 0, n = r.i(1, 2); i < n; i++) { const x = spot(); if (x !== null) b.e('barrel', x, 12, { drop: r.pick(['coin', 'coin', 'heart', 'mana', 'heart']) }); }
  if (r.chance(0.5)) { const x = spot(); if (x !== null) { const item = r.wpick(ITEM_ORDER.map(k => [k, ITEMS[k].weight])); b.e('itemspawn', x, 12, { item, qty: ITEMS[item].pack, id: 'ip_' + id + '_' + x }); } }
  b.def.meta = { abilities: [], entry: {}, start: { tx: 3, gy: 12 }, must: [], items: [] }; b.def.entries = {};
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

const GEN = { authored: id => ({ ok: true, def: authoredDef(id) }), corridor: genCorridor, tower: genTower, arena: genArena, sanctuary: genSanctuary, teleport: genTeleport, interior: genInterior };

// ------------------------------------------------------------------------------------------------ authored fallback + linking
function authoredDef(id) {
  const a = AUTHORED[id], def = { ...a, tiles: Uint8Array.from(a.tiles), spawns: JSON.parse(JSON.stringify(a.spawns)), decos: JSON.parse(JSON.stringify(a.decos)), doors: JSON.parse(JSON.stringify(a.doors)), seals: JSON.parse(JSON.stringify(a.seals)), exits: [] };
  // arrival pads = wherever the hand-built neighbours drop you; doorway rows = this room's own exits (the two can differ, e.g. the belfry's high exit)
  def.entries = {}; def.doorway = {}; for (const e of a.exits) def.doorway[e.side] = { from: e.from, to: e.to };
  for (const o of Object.values(AUTHORED)) for (const e of o.exits) if (e.room === id) def.entries[e.side === 'R' ? 'L' : 'R'] = { tx: e.tx, gy: e.gy };
  for (const e of a.exits) if (!def.entries[e.side]) def.entries[e.side] = { tx: e.side === 'L' ? 1 : a.w - 2, gy: e.to + 1 };
  return def;
}
function link(rooms, linked = new Set()) {
  for (const [a, sa, b, sb] of LINKS) {
    const A = rooms[a], Bd = rooms[b];
    if (linked.has(a + '>' + b)) { const da = A.doors.find(d => d.room === b), db = Bd.doors.find(d => d.room === a); da.tx = db.x; da.tgy = db.gy; db.tx = da.x; db.tgy = da.gy; continue; }     // joined by doors, not an open edge
    const ea = A.entries[sa], eb = Bd.entries[sb];
    const da = A.doorway?.[sa] || { from: ea.gy - 3, to: ea.gy - 1 }, db = Bd.doorway?.[sb] || { from: eb.gy - 3, to: eb.gy - 1 };
    A.exits.push({ side: sa, from: da.from, to: da.to, room: b, tx: eb.tx, gy: eb.gy });
    Bd.exits.push({ side: sb, from: db.from, to: db.to, room: a, tx: ea.tx, gy: ea.gy });
  }
  for (const id of ORDER) if (rooms[id] && (SPEC[id].kind === 'sanctuary' || SPEC[id].kind === 'interior' || SPEC[id].lair)) {
    const S = rooms[id], P = rooms[SPEC[id].parent], pd = P.doors.find(d => d.room === id) || P.doors[0];
    pd.room = id; pd.tx = 3; pd.tgy = 12; S.doors = [{ x: 3, gy: 12, room: P.id, tx: pd.x, tgy: pd.gy }];
  }
}

// every transition must be walkable: the doorway rows are open on the leaving side, and the arrival spot is real standable ground
const GATES = new Set([TILE.SEAL, TILE.BARRICADE, TILE.CRYSTAL, TILE.CRACK]);
function checkLinks(rooms) {
  const errs = [], open = {};
  const ids = ORDER.filter(id => rooms[id]);
  for (const id of ids) { const d = rooms[id], t = Uint8Array.from(d.tiles); for (let i = 0; i < t.length; i++) if (GATES.has(t[i])) t[i] = 0; open[id] = surfaces(roomOf({ ...d, tiles: t })); }
  for (const id of ids) for (const e of rooms[id].exits) {
    const A = rooms[id], col = e.side === 'L' ? 0 : A.w - 1;
    for (let y = e.from; y <= e.to; y++) { const v = A.tiles[y * A.w + col]; if (v !== 0 && !GATES.has(v)) errs.push(`${id} ${e.side} doorway blocked at row ${y}`); }
    const S = open[e.room], T2 = rooms[e.room];
    if (S.id[e.gy * T2.w + e.tx] < 0) errs.push(`${id} -> ${e.room}: arrival (${e.tx},${e.gy}) is not standable`);
    const back = rooms[e.room].exits.find(x => x.room === id); if (!back) errs.push(`${e.room} has no way back to ${id}`);
  }
  for (const id of ids) for (const d of rooms[id].doors) { const T2 = rooms[d.room]; if (!T2 || open[d.room].id[d.tgy * T2.w + d.tx] < 0) errs.push(`${id} door -> ${d.room}: arrival not standable`); }
  return errs;
}

// ------------------------------------------------------------------------------------------------ the map
// Main-road rooms run left to right (towers a row higher); side rooms (sanctuaries) hang below their parent.
function layoutMap(rooms) {
  const pos = {}, taken = new Set(), key = (x, y) => x + ',' + y;
  CHAIN.forEach((id, x) => { const y = SPEC[id].kind === 'tower' ? 2 : 3; pos[id] = { x, y }; taken.add(key(x, y)); });
  for (const id of ORDER) if (rooms[id] && !pos[id]) { const P = pos[SPEC[id].parent]; let y = P.y + 1; while (taken.has(key(P.x, y))) y++; pos[id] = { x: P.x, y }; taken.add(key(P.x, y)); }
  for (const id of ORDER) if (rooms[id]) rooms[id].map = pos[id];
}

// ------------------------------------------------------------------------------------------------ the world
const cache = new Map();
export function buildWorld(seed, opts = {}) {
  seed = seed | 0; if (cache.has(seed) && !opts.fresh) return cache.get(seed);
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()), t0 = now();
  const rooms = {}, report = { seed, attempts: {}, fallbacks: [], errors: {}, version: GEN_VERSION };
  const isHand = id => !!AUTHORED[id] && (seed === 0 || (opts.authored || []).includes(id));
  const ends = {};                                           // the doors that join neighbouring areas (only between two generated rooms)
  for (const [k, kind] of Object.entries(DOOR_LINK)) { const [a, b2] = k.split('>'); if (!isHand(a) && !isHand(b2)) { (ends[a] ||= {}).doorR = { to: b2, kind }; (ends[b2] ||= {}).doorL = { to: a, kind }; } }
  for (const id of ORDER) {
    let def = null; const spec = { ...SPEC[id], ...(ends[id] || {}) }, hand = !!AUTHORED[id];
    if ((spec.kind === 'interior' || spec.lair) && !(rooms[spec.parent] && rooms[spec.parent].doors.some(d => d.room === id))) continue;          // no door leads here in this world (a hand-built parent): no room
    // seed 0 is the classic castle: every hand-built room as authored (the rooms that were added later have no hand-built version, so they use seed 1)
    const useHand = isHand(id), tries = hand ? MAX_TRY : MAX_TRY * 6;
    if (!useHand) for (let a = 0; a < tries && !def; a++) {
      try { const res = GEN[spec.kind](id, spec, makeRng(seed === 0 ? 1 : seed, id, a)); if (res.ok) { def = res.def; report.attempts[id] = a + 1; } else (report.errors[id] ||= []).push(res.errs[0]); }
      catch (e) { (report.errors[id] ||= []).push('exception: ' + e.message); }
    }
    if (!def) {
      if (!hand) throw new Error('level generator could not build room ' + id + ' for seed ' + seed + ': ' + (report.errors[id] || []).slice(0, 3).join(' | '));
      def = authoredDef(id); report.attempts[id] = seed === 0 ? 0 : MAX_TRY; if (seed !== 0) report.fallbacks.push(id);
    }
    def.id = id; tidyRoom(def); arrangeCandelabras(def); rooms[id] = def;          // (candelabras are scenery: set them once the room's doors and loot are known)
  }
  const linked = new Set();
  for (const k of Object.keys(DOOR_LINK)) {
    const [a, b2] = k.split('>'), A = rooms[a], Bd = rooms[b2], da = A.doors.find(d => d.room === b2), db = Bd.doors.find(d => d.room === a);
    if (da && db) linked.add(k);
    else for (const [R, d] of [[A, da], [Bd, db]]) if (d) { R.doors = R.doors.filter(q => q !== d); R.decos = R.decos.filter(q => !(q.t === 'door' && q.x === d.x * 16 + 8 && q.y === d.gy * 16)); }       // only one side got its door (a fallback room): back to an open edge
  }
  report.doorLinks = [...linked];
  link(rooms, linked); layoutMap(rooms); report.linkErrors = checkLinks(rooms);
  const world = { seed, rooms, start: { room: 'v1', x: 4, gy: 12 }, order: ORDER.filter(id => rooms[id]), stones: ORDER.filter(id => SPEC[id].kind === 'teleport'), report };
  report.ms = Math.round(now() - t0); cache.set(seed, world); if (cache.size > 6) cache.delete(cache.keys().next().value);
  return world;
}
export const randomSeed = () => 1 + Math.floor(Math.random() * 999999);

// ASCII picture of a room (for debugging / tests):  # solid  = one-way  ^ spikes  X gate  o entity  . air
export function ascii(def) {
  const ch = { 0: '.', 1: '#', 2: '=', 3: '^', 4: 'x', 5: 'X', 6: 'C', 7: '|' }, rows = [];
  for (let y = 0; y < def.h; y++) { let s = ''; for (let x = 0; x < def.w; x++) s += ch[def.tiles[y * def.w + x]]; rows.push(s); }
  for (const sp of def.spawns) { const y = FLYERS.has(sp.type) ? sp.y : sp.y - 1; if (rows[y]) rows[y] = rows[y].slice(0, sp.x) + (sp.type === 'candle' ? 'i' : sp.type === 'upgrade' ? '*' : sp.type === 'tablet' ? 'T' : 'o') + rows[y].slice(sp.x + 1); }
  for (const d of def.doors) if (rows[d.gy - 1]) rows[d.gy - 1] = rows[d.gy - 1].slice(0, d.x) + 'D' + rows[d.gy - 1].slice(d.x + 1);
  return rows.join('\n');
}
export const _dbg = { GEN, SPEC, makeRng };
