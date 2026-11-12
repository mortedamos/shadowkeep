// Rooms: tile grid, collision queries, tile-art themes (auto-tiled from the Gothicvania tilesets) and parallax backgrounds.
import { W, H, T, mulberry32, hash1 } from './util.js';
import { IMG, SHEET, drawSheet } from './assets.js';

export const TILE = { EMPTY: 0, SOLID: 1, PLAT: 2, SPIKE: 3, CRACK: 4, BARRICADE: 5, CRYSTAL: 6, SEAL: 7 };
export const isSolid = v => v === 1 || v === 4 || v === 5 || v === 6 || v === 7;

// ------------------------------------------------------------------ image helpers
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function tinted(img, mul) { // multiply colour channels; returns canvas
  const c = canvasOf(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { p[i] = Math.min(255, p[i] * mul[0]); p[i + 1] = Math.min(255, p[i + 1] * mul[1]); p[i + 2] = Math.min(255, p[i + 2] * mul[2]); }
  g.putImageData(d, 0, 0); return c;
}
function hueTo(img, hue, sat = 1, lit = 1) { // rotate all hues to `hue` (0..1)
  const c = canvasOf(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] < 8) continue; const r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2;
    let s = 0; if (mx !== mn) s = l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
    s = Math.min(1, s * sat); const L = Math.min(1, l * lit);
    const q = L < 0.5 ? L * (1 + s) : L + s - L * s, pp = 2 * L - q, f = t => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
    if (s === 0) { p[i] = p[i + 1] = p[i + 2] = L * 255; } else { p[i] = f(hue + 1 / 3) * 255; p[i + 1] = f(hue) * 255; p[i + 2] = f(hue - 1 / 3) * 255; }
  }
  g.putImageData(d, 0, 0); return c;
}
let EXTRA = null;
export function extra() { // derived images built once
  if (EXTRA) return EXTRA;
  EXTRA = {
    throne_tiles: hueTo(IMG.church_tileset, 0.98, 1.1, 0.85), throne_bg: hueTo(IMG.church_backgrounds, 0.98, 1.0, 0.8), throne_col: hueTo(IMG.church_column, 0.98, 1.0, 0.8),
    under_tint_bg: tinted(IMG.gcastle_background, [0.75, 1.0, 0.95]),
  };
  return EXTRA;
}

// ------------------------------------------------------------------ tile themes
// Each theme draws one 16x16 cell (tx,ty) onto g.  nb: {u,d,l,r} neighbour-solid flags, depth: solid tiles directly above (0 = surface)
const blit = (g, img, sx, sy, w, h, dx, dy) => g.drawImage(img, sx, sy, w, h, dx, dy, w, h);
const THEME = {
  graveyard: {
    solid(g, tx, ty, nb, depth) {
      const im = IMG.cemetery_tileset, dx = tx * T, dy = ty * T, v = Math.floor(hash1(tx * 7.3 + ty) * 4);
      if (depth === 0) blit(g, im, 64 + v * 16, 55, 16, 25, dx, dy - 9);          // grass top row + blades poking above the tile
      else if (depth === 1) blit(g, im, 64 + v * 16, 80, 16, 16, dx, dy);
      else blit(g, im, hash1(tx * 3.1 + ty * 1.7) < 0.18 ? 16 : 32, 96, 16, 16, dx, dy);
    },
    plat(g, tx, ty) { const im = IMG.cemetery_tileset, v = Math.floor(hash1(tx * 5.1) * 4); blit(g, im, 64 + v * 16, 55, 16, 25, tx * T, ty * T - 9); g.fillStyle = 'rgba(0,0,10,0.55)'; g.fillRect(tx * T, ty * T + 8, 16, 2); },
  },
  // Gothicvania Swamp: mossy mud blocks (the third block, 5 tiles wide, is used) - top lip, mid, dark underside
  swamp: {
    solid(g, tx, ty, nb, depth) { const im = IMG.swamp_tileset, c = ((tx % 5) + 5) % 5; blit(g, im, 224 + c * 16, depth === 0 ? 0 : depth === 1 ? 16 : 32, 16, 16, tx * T, ty * T); },       // the mud block is 5 tiles wide (x=224..303); the 6th column of the sheet is empty and used to leave a hole in the ground
    plat(g, tx, ty) { const im = IMG.swamp_tileset, c = ((tx % 5) + 5) % 5; blit(g, im, 224 + c * 16, 0, 16, 10, tx * T, ty * T); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(tx * T, ty * T + 10, 16, 2); },
  },
  // the burning village: cobbles and brickwork from the Castlevania-esque stone-and-bricks tilemap (Chloe Wolfe, CC-BY 4.0)
  // The wall in that tilemap repeats every 32px both ways.  The surface course is the six fully-opaque tiles x=288..383 (their wrap-around seam is as good as the
  // natural ones) and the body is the 32x32 block at (224,16), which lines up with it - so the street reads as ONE brick surface (the block's border tiles have
  // transparent corners, which showed up as gaps between tiles).
  village: {
    solid(g, tx, ty, nb, depth) { const im = IMG.crypt_tilemap, m = ((tx % 6) + 6) % 6; if (depth === 0) blit(g, im, 288 + m * 16, 0, 16, 16, tx * T, ty * T); else blit(g, im, 224 + (m & 1) * 16, 16 + ((depth - 1) & 1) * 16, 16, 16, tx * T, ty * T); },
    plat(g, tx, ty) { const im = IMG.crypt_tilemap, m = ((tx % 6) + 6) % 6; blit(g, im, 288 + m * 16, 0, 16, 9, tx * T, ty * T); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(tx * T, ty * T + 9, 16, 2); },
  },
  hall: {
    solid(g, tx, ty, nb, depth) { const im = IMG.gcastle_tileset, c = tx & 1; blit(g, im, 32 + c * 16, depth === 0 ? 32 : 48, 16, 16, tx * T, ty * T); },
    plat(g, tx, ty) { const im = IMG.gcastle_tileset; blit(g, im, 240 + (tx & 1) * 16, 96, 16, 10, tx * T, ty * T); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(tx * T, ty * T + 10, 16, 2); },
  },
  chapel: {
    solid(g, tx, ty, nb, depth, im = IMG.church_tileset) {
      const x0 = [0, 64, 128][Math.floor(tx / 3 + ty * 0.0) % 3], col = ((tx % 3) + 3) % 3;
      if (depth === 0) blit(g, im, x0 + col * 16, 168, 16, 16, tx * T, ty * T);
      else if (depth === 1) blit(g, im, x0 + col * 16, 184, 16, 16, tx * T, ty * T);
      else { blit(g, im, 16, 80, 16, 16, tx * T, ty * T); if (hash1(tx * 9.1 + ty * 3.3) < 0.25) blit(g, im, 24, 124, 16, 16, tx * T, ty * T); }
    },
    plat(g, tx, ty, im = IMG.church_tileset) { blit(g, im, 192 + (tx & 1) * 16, 160, 16, 12, tx * T, ty * T); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(tx * T, ty * T + 12, 16, 2); },
  },
  underworks: {
    solid(g, tx, ty, nb, depth) {
      const im = IMG.oldcastle_tileset, c = tx & 1;
      if (depth === 0) blit(g, im, 416 + c * 16, 154, 16, 16, tx * T, ty * T);
      else if (depth === 1) blit(g, im, 416 + c * 16, 170, 16, 16, tx * T, ty * T);
      else blit(g, im, 512 + c * 16, 190 + ((ty & 1) * 16 % 32 > 0 ? 0 : 0), 16, 16, tx * T, ty * T);
    },
    plat(g, tx, ty) { const im = IMG.oldcastle_tileset; blit(g, im, 464 + (tx & 1) * 16, 154, 16, 16, tx * T, ty * T); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(tx * T, ty * T + 12, 16, 2); },
  },
  throne: {
    solid(g, tx, ty, nb, depth) { THEME.chapel.solid(g, tx, ty, nb, depth, extra().throne_tiles); },
    plat(g, tx, ty) { THEME.chapel.plat(g, tx, ty, extra().throne_tiles); },
  },
};

// ------------------------------------------------------------------ backgrounds
// panel strips from the kit-piece backgrounds, repeated horizontally with parallax
const PANELS = {
  hall: { img: () => IMG.gcastle_background, rects: [[192, 0, 80, 160], [288, 0, 80, 160], [16, 0, 160, 160], [192, 0, 80, 160], [384, 0, 80, 160], [288, 0, 80, 160], [192, 0, 80, 160], [16, 0, 160, 160]], base: '#05080a' },
  chapel: { img: () => IMG.church_backgrounds, rects: [[0, 0, 160, 192], [176, 0, 128, 192], [0, 0, 160, 192], [464, 0, 80, 192], [176, 0, 128, 192], [560, 0, 64, 192]], base: '#0f0d1c' },
  throne: { img: () => extra().throne_bg, rects: [[320, 0, 128, 192], [176, 0, 128, 192], [0, 0, 160, 192], [176, 0, 128, 192], [320, 0, 128, 192], [464, 0, 80, 192]], base: '#150a14' },
  underworks: { img: () => extra().under_tint_bg, rects: [[16, 176, 128, 128], [160, 176, 64, 128], [304, 176, 64, 128], [16, 176, 128, 128], [384, 176, 64, 128], [16, 176, 128, 128]], base: '#040708' },
};

export function drawBackground(g, room, camX, camY, t) {
  const th = room.theme;
  if (th === 'village') {            // dusk sky over a town in flames: pink cloud bank, building silhouettes, an orange glow rising from the street
    const hz = room.horizon - camY, grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#3a1f3a'); grd.addColorStop(0.6, '#8a4a52'); grd.addColorStop(1, '#c0683a'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
    layerRepeat(g, IMG.town_sky, camX * 0.03, hz - IMG.town_sky.height + 70, 0);
    layerRepeat(g, IMG.dusk_far, camX * 0.05, hz - IMG.dusk_far.height + 36, 0);                  // Mountain at Dusk (ansimuz, CC0): ranges behind the town
    layerRepeat(g, IMG.dusk_mountains, camX * 0.1, hz - IMG.dusk_mountains.height + 40, 0);
    layerRepeat(g, IMG.town_mid, camX * 0.22, hz - IMG.town_mid.height + 18, 0);
    const fl = 0.22 + 0.05 * Math.sin(t * 0.13) + 0.03 * Math.sin(t * 0.41), gr = g.createLinearGradient(0, H * 0.35, 0, H); gr.addColorStop(0, 'rgba(255,90,20,0)'); gr.addColorStop(1, `rgba(255,110,30,${fl})`); g.fillStyle = gr; g.fillRect(0, H * 0.35, W, H * 0.65);
    return;
  }
  if (th === 'swamp') {              // Gothicvania Swamp: murky green layers
    const hz = room.horizon - camY, grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#0a1a14'); grd.addColorStop(1, '#16301f'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
    layerRepeat(g, IMG.swamp_background, camX * 0.05, hz - IMG.swamp_background.height + 44, 0);
    layerRepeat(g, IMG.swamp_mid01, camX * 0.2, hz - IMG.swamp_mid01.height + 40, 0);
    layerRepeat(g, IMG.swamp_mid02, camX * 0.38, hz - IMG.swamp_mid02.height + 44, 0);
    return;
  }
  if (th === 'graveyard') {
    if (room.bg === 'dusk') {        // Mountain at Dusk (ansimuz, CC0): five parallax layers behind the headstones
      const hz = room.horizon - camY, grd = g.createLinearGradient(0, 0, 0, hz); grd.addColorStop(0, '#2a1a3a'); grd.addColorStop(1, '#8a5a82'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
      layerRepeat(g, IMG.dusk_sky, camX * 0.02, hz - IMG.dusk_sky.height + 24, 0);
      layerRepeat(g, IMG.dusk_far, camX * 0.06, hz - IMG.dusk_far.height + 24, 0);
      layerRepeat(g, IMG.dusk_mountains, camX * 0.14, hz - IMG.dusk_mountains.height + 24, 0);
      layerRepeat(g, IMG.dusk_trees, camX * 0.3, hz - IMG.dusk_trees.height + 28, 0);
      return;
    }
    // the moonlit graveyard (Anokolisa 'Final', 32px art drawn at half size so the 768px sky exactly fills the 384px screen): moon and clouds, a mausoleum + chapel with lit windows, ivy and headstones nearer
    const hz = room.horizon - camY; g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, H);
    layerScaled(g, IMG.moon_sky, 0.5, camX * 0.02, hz - 208 - 8);
    layerScaled(g, IMG.moon_tombs, 0.5, camX * 0.12, hz - 208 + 44);
    layerScaled(g, [IMG.moon_foliage1, IMG.moon_foliage2, IMG.moon_foliage1, IMG.moon_foliage1, IMG.moon_foliage2], 0.5, camX * 0.3, hz - 208 + 62);
    return;
  }
  const P = PANELS[th]; g.fillStyle = P.base; g.fillRect(0, 0, W, H);
  const img = P.img(), par = th === 'underworks' ? 0.4 : 0.5; let x = -(camX * par) % 2000, i = 0;
  const bottom = room.horizon - camY * par + (th === 'underworks' ? 40 : 4), base = P.rects;
  // total strip width for seamless wrap
  const total = base.reduce((a, r) => a + r[2] + 6, 0), off = ((-camX * par) % total + total) % total - total;
  for (let rep = 0; rep < 4; rep++) {
    let xx = off + rep * total;
    for (const r of base) { if (xx > W) break; if (xx + r[2] > 0) g.drawImage(img, r[0], r[1], r[2], r[3], Math.round(xx), Math.round(bottom - r[3]), r[2], r[3]); xx += r[2] + 6; }
  }
  // soft fog at the floor line
  const gr = g.createLinearGradient(0, bottom - 70, 0, bottom + 20); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = gr; g.fillRect(0, bottom - 70, W, 90);
}
// like layerRepeat, drawn at `sc` of its size; `img` may be a list of images that follow one another
function layerScaled(g, img, sc, scroll, y) {
  const list = Array.isArray(img) ? img : [img], ws = list.map(m => Math.round(m.width * sc)), total = ws.reduce((a, b) => a + b, 0); let x = -(((scroll % total) + total) % total), i = 0;
  while (x < W) { const m = list[i % list.length], w = ws[i % list.length]; if (x + w > 0) g.drawImage(m, Math.round(x), Math.round(y), w, Math.round(m.height * sc)); x += w; i++; }
}
function layerRepeat(g, img, scroll, y, gap) {
  const w = img.width + gap, off = -(((scroll % w) + w) % w);
  for (let x = off; x < W; x += w) g.drawImage(img, Math.round(x), Math.round(y));
}

// ------------------------------------------------------------------ Room
export class Room {
  constructor(def) {
    Object.assign(this, def);
    this.pw = this.w * T; this.ph = this.h * T;
    this.exitRows = { L: {}, R: {} }; this.exitCols = { U: {}, D: {} };
    for (const e of this.exits) { if (e.side === 'L' || e.side === 'R') for (let y = e.from; y <= e.to; y++) this.exitRows[e.side][y] = e; else for (let x = e.from; x <= e.to; x++) this.exitCols[e.side][x] = e; }
    this.anim = []; this.canvas = null; this.dirty = true;
  }
  get(tx, ty) {
    if (tx >= 0 && tx < this.w && ty >= 0 && ty < this.h) return this.tiles[ty * this.w + tx];
    if (ty >= this.h) return 0;
    if (ty < 0) return this.exitCols.U[tx] ? 0 : (tx >= 0 && tx < this.w ? 1 : 1);
    return this.exitRows[tx < 0 ? 'L' : 'R'][ty] ? 0 : 1;
  }
  set(tx, ty, v) { if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return; this.tiles[ty * this.w + tx] = v; this.dirty = true; }
  solid(tx, ty) { return isSolid(this.get(tx, ty)); }

  prerender() {
    this.canvas = this.canvas || canvasOf(this.pw, this.ph); const g = this.canvas.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, this.pw, this.ph);
    const th = THEME[this.theme]; this.anim.length = 0;
    // depth: contiguous solid tiles above
    for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) {
      const v = this.tiles[ty * this.w + tx]; if (!v) continue;
      if (v === TILE.SOLID) {
        let depth = 0; while (depth < 3 && this.solid(tx, ty - 1 - depth) && ty - 1 - depth >= 0) depth++;
        // ceilings/overhangs: tile with air below and solid above shouldn't look like grass-top
        th.solid(g, tx, ty, { u: this.solid(tx, ty - 1), d: this.solid(tx, ty + 1), l: this.solid(tx - 1, ty), r: this.solid(tx + 1, ty) }, depth);
      } else if (v === TILE.PLAT) th.plat(g, tx, ty);
      else if (v === TILE.SPIKE) drawSheet(g, 'spikes', 0, tx * T, ty * T, { ax: 0, ay: 0 });
      else if (v === TILE.CRACK) drawSheet(g, 't_crack', 0, tx * T, ty * T, { ax: 0, ay: 0 });
      else if (v === TILE.BARRICADE) drawSheet(g, 't_barricade', 0, tx * T, ty * T, { ax: 0, ay: 0 });
      else if (v === TILE.CRYSTAL || v === TILE.SEAL) this.anim.push([tx, ty, v]);
    }
    this.dirty = false;
  }
  drawTiles(g, camX, camY, t) {
    if (this.dirty) this.prerender();
    const sx = Math.max(0, Math.floor(camX)), sy = Math.max(0, Math.floor(camY)), sw = Math.min(W + 1, this.pw - sx), sh = Math.min(H + 1, this.ph - sy);
    if (sw > 0 && sh > 0) g.drawImage(this.canvas, sx, sy, sw, sh, sx - Math.floor(camX), sy - Math.floor(camY), sw, sh);
    // grass blades / ledges that poke above the room's top edge are clipped; animated tiles:
    for (const [tx, ty, v] of this.anim) {
      const x = tx * T - Math.floor(camX), y = ty * T - Math.floor(camY); if (x < -16 || x > W || y < -16 || y > H) continue;
      if (v === TILE.CRYSTAL) drawSheet(g, 't_crystal', Math.floor(t / 20 + tx) % 2, x, y, { ax: 0, ay: 0 });
      else drawSheet(g, 't_seal', Math.floor(t / 6) % 4, x, y, { ax: 0, ay: 0 });
    }
  }
}
