// Loads sprite sheets / environment images, builds recolors, and draws frames.
// Sheets are horizontal strips of `n` equal cells.  Anchor (ax, ay) is a fraction of the cell;
// default is bottom-center (feet).  `face` = direction the original art faces (1 = right, -1 = left).
import { drawProcedural } from './procart.js';
import { ENCH } from './enchant.js';

export const SHEET = {};   // id -> { img, n, w, h, face, ax, ay }
export const IMG = {};     // environment images by name
export const PORTRAIT = { img: null, w: 48, h: 60, chars: [] };      // the pixelated portraits (see tools/pixelate-portraits.ps1): one atlas, a row per person, a column per expression

const ENV = [
  'cemetery_tileset', 'cemetery_sky', 'cemetery_mountains', 'cemetery_graveyard',
  'cemetery_statue', 'cemetery_stone-1', 'cemetery_stone-2', 'cemetery_stone-3', 'cemetery_stone-4',
  'cemetery_tree-1', 'cemetery_tree-2', 'cemetery_tree-3', 'cemetery_bush-large', 'cemetery_bush-small',
  'church_tileset', 'church_backgrounds', 'church_column',
  'gcastle_tileset', 'gcastle_background', 'oldcastle_tileset', 'oldcastle_background',
  // Mountain at Dusk parallax (ansimuz, CC0), Haunted Forest Trees (ETTiNGRiNDER, CC0), Gothicvania Swamp + Town (ansimuz, CC0), Castlevania-esque stone and bricks (Chloe Wolfe, CC-BY 4.0)
  'dusk_sky', 'dusk_far', 'dusk_mountains', 'dusk_trees', 'dusk_fore', 'forest_tree_1', 'forest_tree_2', 'forest_tree_3', 'forest_tree_4',
  'swamp_background', 'swamp_mid01', 'swamp_mid02', 'swamp_props', 'swamp_tileset', 'swamp_trees',
  // Anokolisa 'Final' (moonlit graveyard), The Sidescroller's Dungeon tiles (32px art)
  'moon_sky', 'moon_tombs', 'moon_foliage1', 'moon_foliage2', 'dg_pillar_1', 'dg_pillar_2', 'dg_pillar_3', 'dg_pillar_4', 'dg_arch', 'dg_door', 'dg_crates', 'dg_urn_1', 'dg_urn_2', 'dg_urn_3', 'dg_banner_1', 'dg_banner_2', 'dg_banner_3', 'dg_banner_4', 'dg_banner_5', 'dg_banner_6',
  'town_sky', 'town_mid', 'town_house_1', 'town_house_2', 'town_house_3', 'town_barrel', 'town_crates', 'town_crate', 'town_lamp', 'town_cart', 'town_well', 'town_sign', 'crypt_tilemap',
];

// per-sheet overrides.  face: which way the art faces.  ax/ay: anchor fractions.  dx/dy: pixel nudges.
const META = {
  ghost_idle: { face: -1, ay: 0.6 }, ghost_appear: { face: -1, ay: 0.9 }, ghost_vanish: { face: -1, ay: 0.7 }, ghost_shriek: { face: -1, ay: 0.6 },
  fireskull: { face: -1, ay: 0.55 },
  hound_idle: { face: -1 }, hound_walk: { face: -1 }, hound_run: { face: -1 }, hound_jump: { face: -1 },
  skeleton_walk: { face: -1 }, skeleton_rise: { face: -1 }, zombie_walk: { face: -1 }, zombie_rise: { face: -1 },
  wraith: { face: -1 }, wraith_halo: { face: -1 }, hellcat: { face: -1 },
  ghoul_burning: { face: -1 }, wizard_idle: { face: -1 }, wizard_cast: { face: -1 },
  beast_idle: { face: -1 }, beast_breath: { face: -1 }, beast_burn: { face: -1 },
  nightmare_idle: { face: -1 }, nightmare_gallop: { face: -1 },
  angel_idle: { ay: 0.6 }, angel_attack: { ay: 0.6 },
  demon_idle: { face: -1 }, demon_attack: { face: -1 }, demon_attack_nb: { face: -1 },
  fireball: { ay: 0.5 }, death_small: {}, death_big: {},
  // (Szadi's sickle fighter, reaper_*, is drawn facing RIGHT in every animation - the default - so it has no entry here; it was once marked as facing left, which made him run backwards)
};
// the Crimson Count (xxg_4_free): his feet are on row 130 of each 144px cell
Object.assign(META, { vampire_idle: { ay: 0.9 }, vampire_run: { ay: 0.9 }, vampire_atk: { ay: 0.9 }, vampire_jump: { ay: 0.9 }, vampire_hurt: { ay: 0.9 }, vampire_dead: { ay: 0.9 } });
// Some Ars Notoria cells leave empty rows under the feet (the gnu 7-9, the archmage 7); `dy` pushes them down (those rows + 2: enemies are drawn 1px high, and the feet should dip 1px into the floor) so the creature stands ON the ground instead of hovering over it.
// (an entry here replaces the "Ars sheets face left" default, so each says face: -1 itself)
Object.assign(META, { ars_gnu_r0: { face: -1, dy: 11 }, ars_gnu_r1: { face: -1, dy: 11 }, ars_gnu_r2: { face: -1, dy: 10 }, ars_gnu_r3: { face: -1, dy: 9 }, ars_mage2_r0: { face: -1, dy: 9 }, ars_mage2_r1: { face: -1, dy: 9 } });
// the bronze-robed, silver-masked mage (mage 1) fills its whole 85x94 cell: the hem of the robe is the bottom row
Object.assign(META, { ars_mage1_r0: { face: -1, dy: 2 }, ars_mage1_r1: { face: -1, dy: 2 } });
// the Gothic Hero (Ansimuz): feet on the bottom row of each cell, faces right.  hero_attack's body sits a little left of the cell centre.
Object.assign(META, { hero_idle: { ax: 0.5 }, hero_run: { ax: 0.5 }, hero_attack: { ax: 0.47 }, hero_jump: { ay: 1 }, hero_jump_attack: {}, hero_crouch: {}, hero_hurt: {} });

// the swamp creature and the Ars Notoria battle sprites are drawn facing LEFT (the townsfolk face RIGHT - the Gothicvania Town demo flips them with scale.x = -1 to go left)
const FACES_LEFT = /^(ars_|swamp_thing)/;

const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('failed to load ' + src)); i.src = src; });

function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function addSheet(id, img, n, w, h, meta = {}) {
  SHEET[id] = { id, img, n, w, h, face: 1, ax: 0.5, ay: 1, dx: 0, dy: 0, ...meta };
  return SHEET[id];
}

export async function loadAll(progress = () => {}) {
  const manifest = await (await fetch('assets/sprites.json')).json();
  const ids = Object.keys(manifest);
  const total = ids.length + ENV.length + 1; let done = 0, cyberImg = null;
  await Promise.all([
    loadImg('assets/sprites/cybertooth_sheet.png').then(img => { cyberImg = img; progress(++done / total); }),
    ...ids.map(async id => {
      const m = manifest[id]; const img = await loadImg('assets/' + m.file);
      addSheet(id, img, m.n, m.w, m.h, META[id] || (FACES_LEFT.test(id) ? { face: -1 } : {}));
      progress(++done / total);
    }),
    ...ENV.map(async name => { IMG[name] = await loadImg(`assets/env/${name}.png`); progress(++done / total); }),
    loadImg('assets/portraits/pixel/portraits.png').then(img => { PORTRAIT.img = img; }).catch(() => {}),                                  // (without the atlas the portraits are just empty frames)
    fetch('assets/portraits/pixel/portraits.json').then(r => r.json()).then(j => { PORTRAIT.w = j.w; PORTRAIT.h = j.h; PORTRAIT.chars = j.chars.map(c => c.id); }).catch(() => {}),
  ]);
  buildCyberTooth(cyberImg);              // the skull-headed serpent: one big grid sliced into strips
  buildRecolors();
  buildHair();                            // the hero's quiff is lifted out of his sprites (it is simulated and drawn by hair.js)
  buildEvil();                            // the mirror twin: the hero in silver and violet (hero_*_evil)
  buildWhiteCape();                       // the hero's baked red cape -> white (used while the White Cloak option is on)
  drawProcedural(addSheet, SHEET, IMG);   // custom pixel art: bat, icons, props
  buildEnchants();                        // enchanted sword variants (needs the hero sheets)
}

// ---------- "Cyber-tooth" by Emcee Flesher (OGA-BY 3.0 / CC0): the original is one big grid, sliced here into the strips the engine uses ----------
// head 48x48: 5 shimmer columns x 3 poses (0 jaw shut, 1 maw wide open, 2 fangs forward)  -> strip frame = pose * 5 + shimmer
// vertebra and tail 36x36: 16 rotations x 5 shimmer rows                                  -> strip frame = shimmer * 16 + rotation
// vertebra rotation r points its peg (the end that plugs into the part ahead) at angle PI + r*PI/8 (r=0 left, 4 up, 8 right, 12 down), claws underneath
// when r=0; tail rotation r points the tip away from the body at angle r*PI/8 (0 right, 4 down, 8 left, 12 up).
const CT = { bone: [1512, 1], frost: [1008, 5], ember: [504, 5] };   // variant -> [top of its block in the sheet, shimmer frames] (the bone one has no shimmer)
function buildCyberTooth(img) {
  const strip = (id, w, h, n, cell, meta) => {
    const c = canvasOf(w * n, h), g = c.getContext('2d');
    for (let i = 0; i < n; i++) { const [sx, sy] = cell(i); g.drawImage(img, sx, sy, w, h, i * w, 0, w, h); }
    addSheet(id, c, n, w, h, meta);
  };
  for (const [v, [y0, sh]] of Object.entries(CT)) {
    const segY = y0 + 144, tailY = segY + sh * 36, k = i => (i < sh ? i : 0);
    strip(`ct_${v}_head`, 48, 48, 15, i => [k(i % 5) * 48, y0 + Math.floor(i / 5) * 48], { face: -1, ay: 0.5 });
    strip(`ct_${v}_seg`, 36, 36, 80, i => [(i % 16) * 36, segY + k(Math.floor(i / 16)) * 36], { ay: 0.5 });
    strip(`ct_${v}_tail`, 36, 36, 80, i => [(i % 16) * 36, tailY + k(Math.floor(i / 16)) * 36], { ay: 0.5 });
  }
}

// ---------- recolor helpers ----------
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
// fn(h,s,l) -> [h,s,l]   (h in 0..1)
export function recolor(srcId, dstId, fn) {
  const s = SHEET[srcId]; const c = canvasOf(s.img.width, s.img.height); const g = c.getContext('2d');
  g.drawImage(s.img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height); const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] < 8) continue;
    const [h, sa, l] = rgb2hsl(p[i], p[i + 1], p[i + 2]); const o = fn(h, sa, l, p[i], p[i + 1], p[i + 2]);
    const [r, gg, b] = hsl2rgb(((o[0] % 1) + 1) % 1, Math.min(1, Math.max(0, o[1])), Math.min(1, Math.max(0, o[2])));
    p[i] = r; p[i + 1] = gg; p[i + 2] = b;
  }
  g.putImageData(d, 0, 0);
  addSheet(dstId, c, s.n, s.w, s.h, { face: s.face, ax: s.ax, ay: s.ay, dx: s.dx, dy: s.dy, jump: s.jump });
}

function buildRecolors() {
  // bone-white skeleton (the original is brown-red like the zombie)
  recolor('skeleton_walk', 'skeleton_w', (h, s, l) => [0.11, s * 0.28, Math.min(0.95, l * 1.35 + 0.12)]);
  recolor('skeleton_rise', 'skeleton_rise_w', (h, s, l) => [0.11, s * 0.28, Math.min(0.95, l * 1.35 + 0.12)]);
  // sickly green zombie
  recolor('zombie_walk', 'zombie_g', (h, s, l) => [0.24, Math.min(0.55, s * 0.7), l * 0.92 + 0.03]);
  recolor('zombie_rise', 'zombie_rise_g', (h, s, l) => [0.24, Math.min(0.55, s * 0.7), l * 0.92 + 0.03]);
  // frost hound
  for (const k of ['idle', 'walk', 'run', 'jump']) recolor('hound_' + k, 'houndb_' + k, (h, s, l) => [h > 0.5 || h < 0.08 ? 0.58 : h, s * 0.9, l * 1.05]);
  // pale-green specter variant of the ghost
  for (const k of ['idle', 'appear', 'vanish', 'shriek']) recolor('ghost_' + k, 'ghostg_' + k, (h, s, l) => [0.42, s * 0.9, l]);
  // blue "frozen" nightmare is the original; make a cursed-green wraith lantern ghost
  recolor('wraith', 'wraith_g', (h, s, l) => [0.45, s, l * 1.05]);
}

// ---------- the hero's hair ----------
// The Gothic Hero's baked hair is a pompadour in the two cream tones ffd9b9 / af9785: one small patch on top of his head (the sword's slash arcs use the same tones, but they are big
// or far from the head, so only a patch of 25-70 pixels no wider than 11 counts).  For every frame the whole patch is taken out of the sprite, and new hair is painted on a sheet of
// its own, <sheet>_hair: it sweeps over the forehead and FALLS around the face - behind the head, past the shoulder blades, and in a lock beside the cheek.  It is placed by the
// frame's FACE (the skin pixels beside the old patch), so it sits right however the head is turned or bobbing.  hair.js draws that picture as a bendable mesh (or, with 3D Hair off, plain).
// HAIR_BOX[sheet][frame] = { bx, by, bw, bh }: where the painted hair is in the sheet frame (null if the frame has none).
const HAIR_TONES = new Set([0xffd9b9, 0xaf9785]), SKIN_TONES = new Set([0xe1924d, 0xffc98b]), HAIR_BOX = {};
export const hairBox = id => HAIR_BOX[id];
const HAIR_LIGHT = [0xff, 0xd9, 0xb9], HAIR_SHADE = [0xaf, 0x97, 0x85];
// the hair of one frame as spans per row (x relative to the face's left edge, facing right; W = the face's width): [row, x0, x1, shade?]
function hairSpans(W) {
  const out = [], R = 16;                                             // rows from the top of the head
  const add = (r, x0, x1) => { if (x1 >= x0) out.push([r, x0, x1]); };
  add(0, 2, W - 1); add(1, 0, W); add(2, -2, W + 1); add(3, -3, W + 1);                       // the crown, and a fringe swept forward over the forehead
  add(4, -3, 3); add(4, W - 1, W + 1);                                                          // a gap where the brow and the eye show, the fringe's tip in front
  for (let r = 5; r < R; r++) {                                                                 // the curtain behind the head, and a lock beside the cheek
    const left = r <= 13 ? -3 : -2, right = r <= 8 ? 1 : r <= 11 ? -1 : r <= 13 ? -2 : -1; add(r, left, right);                 // (a lock beside the cheek down to the jaw, then the hair hangs strictly behind the head)
  }
  return out;
}
function buildHair() {
  for (const id of HERO_SHEETS) {
    const s = SHEET[id]; if (!s) continue;
    const W = s.img.width, base = canvasOf(W, s.img.height), bg = base.getContext('2d'); bg.drawImage(s.img, 0, 0);
    const bd = bg.getImageData(0, 0, W, base.height), p = bd.data, layer = new Uint8ClampedArray(p.length), boxes = [];
    for (let f = 0; f < s.n; f++) {
      const at = (x, y) => (y * W + f * s.w + x) * 4, key = (x, y) => { if (x < 0 || y < 0 || x >= s.w || y >= s.h) return -1; const i = at(x, y); return p[i + 3] < 128 ? -1 : (p[i] << 16) | (p[i + 1] << 8) | p[i + 2]; };
      const seen = new Uint8Array(s.w * s.h); let box = null;
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
        if (seen[y * s.w + x] || !HAIR_TONES.has(key(x, y))) continue;
        const st = [[x, y]], comp = []; seen[y * s.w + x] = 1; let a0 = x, a1 = x, b0 = y, b1 = y;
        while (st.length) { const [a, b] = st.pop(); comp.push([a, b]); a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = a + dx, ny = b + dy; if (nx >= 0 && ny >= 0 && nx < s.w && ny < s.h && !seen[ny * s.w + nx] && HAIR_TONES.has(key(nx, ny))) { seen[ny * s.w + nx] = 1; st.push([nx, ny]); } } }
        if (comp.length < 25 || comp.length > 70 || a1 - a0 + 1 > 11 || b1 - b0 + 1 > 12) continue;                     // not the hair: a slash arc, or a speck of it
        for (const [a, b] of comp) p[at(a, b) + 3] = 0;                                                                 // the pompadour comes out of the sprite
        // the face: skin pixels within a pixel or two of the old patch, grown over the skin around them
        const fs = new Set(), q = []; for (const [a, b] of comp) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = a + dx, ny = b + dy, kk = ny * s.w + nx; if (SKIN_TONES.has(key(nx, ny)) && !fs.has(kk)) { fs.add(kk); q.push([nx, ny]); } }
        while (q.length) { const [a, b] = q.pop(); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = a + dx, ny = b + dy, kk = ny * s.w + nx; if (nx >= a0 - 6 && nx <= a1 + 6 && ny <= b1 + 10 && !fs.has(kk) && SKIN_TONES.has(key(nx, ny))) { fs.add(kk); q.push([nx, ny]); } } }
        let fx0 = 1e9, fx1 = -1, fy0 = 1e9; for (const kk of fs) { const fx = kk % s.w, fy = Math.floor(kk / s.w); fx0 = Math.min(fx0, fx); fx1 = Math.max(fx1, fx); fy0 = Math.min(fy0, fy); }
        if (fx1 < 0) { fx0 = a0 + 1; fx1 = a1 - 2; fy0 = b1 - 3; }                                                      // (no face found: guess from the patch)
        const FW = Math.max(5, Math.min(8, fx1 - fx0)), top = fy0 - 4; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (const [r, sx0, sx1] of hairSpans(FW)) for (let xx = sx0; xx <= sx1; xx++) {
          const px = fx0 + xx, py = top + r; if (px < 0 || py < 0 || px >= s.w || py >= s.h) continue;
          const edge = xx === sx0, strand = r > 4 && ((xx - sx0 + (r >> 2)) % 3 === 1) && r % 2 === 0, shade = edge || r === 4 || r >= 14 || (xx === sx1 && r >= 9) || strand;       // shadow along the back edge, in streaks like strands, under the crown, at the tips
          const c = shade ? HAIR_SHADE : HAIR_LIGHT, i = at(px, py); layer[i] = c[0]; layer[i + 1] = c[1]; layer[i + 2] = c[2]; layer[i + 3] = 255;
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        }
        if (x1 >= 0) box = { bx: x0, by: y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1 };
      }
      boxes.push(box);
    }
    bg.putImageData(bd, 0, 0); s.img = base;
    const lc = canvasOf(W, base.height); lc.getContext('2d').putImageData(new ImageData(layer, W, base.height), 0, 0);
    addSheet(id + '_hair', lc, s.n, s.w, s.h, { face: s.face, ax: s.ax, ay: s.ay, dx: s.dx, dy: s.dy }); HAIR_BOX[id] = boxes;
  }
}

// ---------- the mirror twin, as <sheet>_evil ----------
// The same sheets as the hero (his baked cape and his new hair included) with every one of the 19 colours of his sprite swapped: the crimson cape goes deep violet, the gold armour cold steel,
// the pale skin, hair and sword-arcs ghostly silver.  The twin is drawn with these; its eyes burn red in the effects layer.
const EVIL = new Map([[0xed053e, [74, 20, 104]], [0x810936, [50, 12, 76]], [0x800735, [40, 10, 62]], [0x983e1d, [96, 48, 120]], [0x671915, [32, 16, 44]], [0x691a17, [32, 16, 44]], [0x130a1b, [8, 5, 14]],
  [0xbc6c17, [84, 92, 138]], [0xffcc61, [176, 184, 222]], [0xe1924d, [132, 126, 150]], [0xffd9b9, [226, 226, 244]], [0xffdbb9, [226, 226, 244]], [0xaf9785, [108, 106, 140]], [0xc69985, [128, 120, 156]],
  [0xffc98b, [196, 192, 214]], [0x573b60, [50, 28, 82]], [0x966495, [112, 76, 150]]]);
function buildEvil() {
  for (const id of HERO_SHEETS) {
    const s = SHEET[id]; if (!s) continue;
    const c = canvasOf(s.img.width, s.img.height), g = c.getContext('2d'); g.drawImage(s.img, 0, 0); const hl = SHEET[id + '_hair']; if (hl) g.drawImage(hl.img, 0, 0);          // (his hair, as a still picture)
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 8) continue; const to = EVIL.get((p[i] << 16) | (p[i + 1] << 8) | p[i + 2]);
      if (to) { p[i] = to[0]; p[i + 1] = to[1]; p[i + 2] = to[2]; } else { p[i] *= 0.55; p[i + 1] *= 0.45; p[i + 2] *= 0.8; }
    }
    g.putImageData(d, 0, 0); addSheet(id + '_evil', c, s.n, s.w, s.h, { face: s.face, ax: s.ax, ay: s.ay, dx: s.dx, dy: s.dy });
  }
}

// ---------- the white cloak, as <sheet>_cw ----------
// The Gothic Hero's baked crimson cape has two parts: a mantle draped over his shoulder and chest (kept, recolored white) and the long train streaming out behind his back.
// The train is CLEARED: the cloak is a sheet of cloth simulated in cloak.js and drawn behind the sprite, hung from the two ends of his shoulder line.
// (<sheet>_cwm is a mask of the kept cape pixels, used to stain them.)
const HERO_SHEETS = ['hero_idle', 'hero_run', 'hero_jump', 'hero_attack', 'hero_jump_attack', 'hero_crouch', 'hero_crouch_slash', 'hero_hurt'];
const CAPE = new Map([[0xed053e, [246, 246, 252]], [0x810936, [180, 184, 212]], [0x800735, [150, 154, 190]], [0x983e1d, [206, 208, 228]]]);
function buildWhiteCape() {
  for (const id of HERO_SHEETS) {
    const s = SHEET[id]; if (!s) continue;
    const c = canvasOf(s.img.width, s.img.height), g = c.getContext('2d'); g.drawImage(s.img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data, mk = new Uint8ClampedArray(p.length);
    for (let f = 0; f < s.n; f++) for (let y = 0; y < s.h; y++) {
      let lo = -1, hi = -1;                                                        // the body on this row: every opaque pixel that is not cape
      for (let x = 0; x < s.w; x++) { const i = (y * c.width + f * s.w + x) * 4; if (p[i + 3] >= 8 && !CAPE.has((p[i] << 16) | (p[i + 1] << 8) | p[i + 2])) { if (lo < 0) lo = x; hi = x; } }
      for (let x = 0; x < s.w; x++) {
        const i = (y * c.width + f * s.w + x) * 4; if (p[i + 3] < 8) continue; const to = CAPE.get((p[i] << 16) | (p[i + 1] << 8) | p[i + 2]); if (!to) continue;
        if (lo < 0 || (s.face === 1 ? x < lo : x > hi)) { p[i + 3] = 0; continue; }          // behind his back: the train (cleared)
        p[i] = to[0]; p[i + 1] = to[1]; p[i + 2] = to[2]; mk[i] = mk[i + 1] = mk[i + 2] = mk[i + 3] = 255;     // over the body: the mantle (white)
      }
    }
    g.putImageData(d, 0, 0); const meta = { face: s.face, ax: s.ax, ay: s.ay, dx: s.dx, dy: s.dy }; addSheet(id + '_cw', c, s.n, s.w, s.h, meta);
    const mc = canvasOf(c.width, c.height); mc.getContext('2d').putImageData(new ImageData(mk, c.width, c.height), 0, 0); addSheet(id + '_cwm', mc, s.n, s.w, s.h, meta);     // cape pixels only: drawn tinted on top to stain the sprite's cloak
  }
}

// Per-frame silhouette of a sheet: for every pixel row, the leftmost / rightmost opaque column (-1 = empty row).  Used to let the cloak
// wrap around the sprite.  Computed once per sheet, on demand.
const EXT = new Map();
export function sheetExtents(id) {
  if (EXT.has(id)) return EXT.get(id);
  const s = SHEET[id]; if (!s) return null;
  const c = canvasOf(s.img.width, s.img.height), g = c.getContext('2d'); g.drawImage(s.img, 0, 0); const px = g.getImageData(0, 0, c.width, c.height).data;
  const lo = new Int16Array(s.n * s.h).fill(-1), hi = new Int16Array(s.n * s.h).fill(-1);          // every opaque pixel
  const blo = new Int16Array(s.n * s.h).fill(-1), bhi = new Int16Array(s.n * s.h).fill(-1);         // the BODY: everything except the (crimson) cape pixels
  for (let f = 0; f < s.n; f++) for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const i = (y * c.width + f * s.w + x) * 4; if (px[i + 3] <= 20) continue; const k = f * s.h + y;
    if (lo[k] < 0) lo[k] = x; hi[k] = x;
    if (!CAPE.has((px[i] << 16) | (px[i + 1] << 8) | px[i + 2])) { if (blo[k] < 0) blo[k] = x; bhi[k] = x; }
  }
  const ex = { lo, hi, blo, bhi }; EXT.set(id, ex); return ex;
}

// ---------- sword enchantments: recolored slash-arc sheets, and sample points to emit particles from ----------
// The Gothic Hero's sword swings leave a cream-coloured slash arc baked into the attack frames.  Face and hair use the same two cream tones,
// but those patches are small (<= 10px wide), so we take cream clusters wider than 12px as "arc" - those get recolored per enchantment and
// supply the particle emission points.  (Frames without an arc simply emit from the hip.)
const CREAM = new Set([0xffd9b9, 0xaf9785]);
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const thin = (list, n) => { if (list.length <= n) return list; const o = []; for (let i = 0; i < n; i++) o.push(list[Math.floor(i * list.length / n)]); return o; };

function buildEnchants() {
  const ARC_SHEETS = ['hero_attack', 'hero_jump_attack', 'hero_crouch_slash'];
  for (const id of [...ARC_SHEETS, ...ARC_SHEETS.map(i => i + '_cw')]) {
    const s = SHEET[id]; if (!s) continue;
    const src = canvasOf(s.img.width, s.img.height), sg = src.getContext('2d'); sg.drawImage(s.img, 0, 0); const data = sg.getImageData(0, 0, src.width, src.height).data;
    const arcMask = new Uint8Array(src.width * src.height), pts = [];
    for (let f = 0; f < s.n; f++) {
      const px = [], seen = new Uint8Array(s.w * s.h);
      const key = (x, y) => { if (x < 0 || y < 0 || x >= s.w || y >= s.h) return -1; const i = (y * src.width + f * s.w + x) * 4; return data[i + 3] < 10 ? -1 : (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]; };
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
        if (seen[y * s.w + x] || !CREAM.has(key(x, y))) continue;
        const stack = [[x, y]], comp = []; let x0 = x, x1 = x; seen[y * s.w + x] = 1;
        while (stack.length) { const [a, b] = stack.pop(); comp.push([a, b]); x0 = Math.min(x0, a); x1 = Math.max(x1, a);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = a + dx, ny = b + dy; if (nx >= 0 && ny >= 0 && nx < s.w && ny < s.h && !seen[ny * s.w + nx] && CREAM.has(key(nx, ny))) { seen[ny * s.w + nx] = 1; stack.push([nx, ny]); } } }
        if (x1 - x0 > 12) for (const p of comp) { px.push(p); arcMask[p[1] * src.width + f * s.w + p[0]] = 1; }
      }
      pts.push(thin(px, 56));
    }
    s.pts = pts;
    for (const type of Object.keys(ENCH)) {
      const pal = ENCH[type].pal, c = canvasOf(src.width, src.height), g = c.getContext('2d'); g.drawImage(s.img, 0, 0);
      const out = g.getImageData(0, 0, c.width, c.height), p = out.data;
      for (let i = 0; i < p.length; i += 4) {
        if (!arcMask[i >> 2] || p[i + 3] < 10) continue;
        const l = (p[i] + p[i + 1] + p[i + 2]) / 765, col = l < 0.45 ? mixc(pal.dark, pal.mid, l / 0.45) : mixc(pal.mid, pal.bright, l * l * 0.55);      // brightness -> dark/mid/bright ramp
        p[i] = col[0]; p[i + 1] = col[1]; p[i + 2] = col[2];
      }
      g.putImageData(out, 0, 0); addSheet(`${id}_${type}`, c, s.n, s.w, s.h, { face: s.face, ax: s.ax, ay: s.ay, dx: s.dx, dy: s.dy });
    }
  }
}

// ---------- drawing ----------
const flashCache = new Map();   // key -> canvas
export function silhouette(id, color = '#ffffff') {
  const key = id + '|' + color; let c = flashCache.get(key);
  if (!c) {
    const s = SHEET[id]; c = canvasOf(s.img.width, s.img.height); const g = c.getContext('2d');
    g.drawImage(s.img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    flashCache.set(key, c);
  }
  return c;
}

// Draw frame `f` of sheet `id` so its anchor lands on (x,y).
// o: { dir (entity facing: 1/-1), scale, alpha, flash (true or css color), flipY, rot, dy, dx, tint }
export function drawSheet(ctx, id, f, x, y, o = {}) {
  const s = SHEET[id]; if (!s) return;
  f = ((Math.floor(f) % s.n) + s.n) % s.n;
  const dir = o.dir === undefined ? 1 : o.dir; const flip = dir !== s.face;
  const sc = o.scale || 1;
  const src = o.flash ? silhouette(id, o.flash === true ? '#ffffff' : o.flash) : s.img;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.translate(Math.round(x + (o.dx || 0)), Math.round(y + (o.dy || 0)));
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale((flip ? -1 : 1) * sc, (o.flipY ? -1 : 1) * sc);
  const ax = o.ax !== undefined ? o.ax : s.ax, ay = o.ay !== undefined ? o.ay : s.ay;
  ctx.drawImage(src, f * s.w, 0, s.w, s.h, Math.round(-s.w * ax) + s.dx * (flip ? -1 : 1), Math.round(-s.h * ay) + s.dy, s.w, s.h);
  ctx.restore();
}

// Draw a plain image (environment) with integer snapping
export function drawImg(ctx, img, sx, sy, sw, sh, dx, dy, flip = false) {
  if (!flip) { ctx.drawImage(img, sx, sy, sw, sh, Math.round(dx), Math.round(dy), sw, sh); return; }
  ctx.save(); ctx.translate(Math.round(dx) + sw, Math.round(dy)); ctx.scale(-1, 1); ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh); ctx.restore();
}

// A simple animation player. frames: array of frame indices (or count), fps
export class Anim {
  constructor(id, fps = 10, frames = null, loop = true) { this.id = id; this.fps = fps; this.loop = loop; this.frames = frames || Array.from({ length: SHEET[id].n }, (_, i) => i); this.t = 0; this.done = false; }
  reset() { this.t = 0; this.done = false; }
  update(dt = 1) {
    this.t += dt * this.fps / 60;
    if (!this.loop && this.t >= this.frames.length) { this.t = this.frames.length - 0.001; this.done = true; }
  }
  get frame() { return this.frames[Math.floor(this.t) % this.frames.length]; }
}
