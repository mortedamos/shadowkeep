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

// the five mud top tiles with every transparent pixel filled from the mud below it (a solid tile whose top row is its first row of moss)
let SWAMP_LIP = null;
function swampLip() {
  if (SWAMP_LIP) return SWAMP_LIP; SWAMP_LIP = [];
  for (let c = 0; c < 5; c++) {
    const cv = canvasOf(16, 16), g = cv.getContext('2d'); g.drawImage(IMG.swamp_tileset, 224 + c * 16, 0, 16, 16, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16), p = d.data;
    for (let x = 0; x < 16; x++) {
      let r = -1, gr = 0, b = 0;
      for (let y = 15; y >= 0; y--) { const i = (y * 16 + x) * 4; if (p[i + 3] >= 128) { r = p[i]; gr = p[i + 1]; b = p[i + 2]; p[i + 3] = 255; } else if (r >= 0) { p[i] = r; p[i + 1] = gr; p[i + 2] = b; p[i + 3] = 255; } }
      const i0 = x * 4; p[i0] = Math.min(255, p[i0] * 1.16); p[i0 + 1] = Math.min(255, p[i0 + 1] * 1.16); p[i0 + 2] = Math.min(255, p[i0 + 2] * 1.1);
    }
    g.putImageData(d, 0, 0); SWAMP_LIP.push(cv);
  }
  return SWAMP_LIP;
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
  // The lip tiles are solid() from their first opaque row down, but the art starts 3-8px below the tile's top and ragged: the visible ground sat lower than the ground you walk on, with
  // dark gaps between.  swampLip() fills every transparent pixel from the mud below it (and lightens the top row a little for an edge), so the ground you see IS the ground you stand on.
  swamp: {
    solid(g, tx, ty, nb, depth) { const c = ((tx % 5) + 5) % 5; if (depth === 0) g.drawImage(swampLip()[c], tx * T, ty * T); else blit(g, IMG.swamp_tileset, 224 + c * 16, depth === 1 ? 16 : 32, 16, 16, tx * T, ty * T); },       // the mud block is 5 tiles wide (x=224..303); the 6th column of the sheet is empty and used to leave a hole in the ground
    plat(g, tx, ty) { const c = ((tx % 5) + 5) % 5; g.drawImage(swampLip()[c], 0, 0, 16, 10, tx * T, ty * T, 16, 10); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(tx * T, ty * T + 10, 16, 2); },
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
    // The even platform tile's art leaves its top 6 rows EMPTY (the stone starts half way down the tile), so those platforms looked 6px lower than the ones you stand on, next to the full
    // slab of the odd tile: the surface was unclear.  It is set upside down, so the empty part faces DOWN and the stone starts at the walking surface.
    plat(g, tx, ty, im = IMG.church_tileset) {
      if ((tx & 1) === 0) { g.save(); g.translate(tx * T, ty * T + 12); g.scale(1, -1); g.drawImage(im, 192, 160, 16, 12, 0, 0, 16, 12); g.restore(); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(tx * T, ty * T + 6, 16, 2); }
      else { blit(g, im, 208, 160, 16, 12, tx * T, ty * T); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(tx * T, ty * T + 12, 16, 2); }
    },
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
  // the Cistern: wet, dark teal stonework, a film of moss on the walking surface
  cistern: {
    solid(g, tx, ty, nb, depth) {
      const x = tx * T, y = ty * T, h = hash1(tx * 5.7 + ty * 2.3);
      g.fillStyle = depth === 0 ? '#2b3d42' : (h < 0.5 ? '#1e2d33' : '#1a272c'); g.fillRect(x, y, T, T);
      if (depth === 0) { g.fillStyle = '#4f7f7c'; g.fillRect(x, y, T, 2); g.fillStyle = '#7fb5ae'; g.fillRect(x, y, T, 1); if (h > 0.55) { g.fillStyle = '#3f8a5a'; g.fillRect(x + ((h * 10) | 0), y + 2, 3, 2); } }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + 7, T, 1); g.fillRect(x + ((ty & 1) ? 4 : 11), y, 1, 8); g.fillRect(x + ((ty & 1) ? 11 : 4), y + 8, 1, 8);
      if (h < 0.3) { g.fillStyle = 'rgba(140,210,220,0.10)'; g.fillRect(x + 3, y + 1, 1, 14); }
    },
    plat(g, tx, ty) { const x = tx * T, y = ty * T; g.fillStyle = '#35575a'; g.fillRect(x, y, T, 5); g.fillStyle = '#7fb5ae'; g.fillRect(x, y, T, 1); g.fillStyle = '#12201f'; for (let i = 2; i < T; i += 5) g.fillRect(x + i, y + 2, 2, 2); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y + 5, T, 2); },
  },
  // the Clockwork Dungeon: iron plates riveted together, with a brass lip on the walking surface
  clockwork: {
    solid(g, tx, ty, nb, depth) {
      const x = tx * T, y = ty * T, h = hash1(tx * 7.3 + ty * 3.1);
      g.fillStyle = depth === 0 ? '#3e3629' : (h < 0.5 ? '#2c2822' : '#26231e'); g.fillRect(x, y, T, T);
      if (depth === 0) { g.fillStyle = '#9a7a34'; g.fillRect(x, y, T, 3); g.fillStyle = '#d4b258'; g.fillRect(x, y, T, 1); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + 3, T, 1); }
      g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(x, y + T - 1, T, 1); g.fillRect(x + T - 1, y, 1, T); g.fillStyle = 'rgba(255,230,160,0.10)'; g.fillRect(x, y + 1, 1, T - 2);
      g.fillStyle = '#76683f'; for (const [rx, ry] of [[3, 5], [11, 5], [3, 12], [11, 12]]) if (depth > 0 || ry > 8) g.fillRect(x + rx, y + ry, 2, 2);
      if (depth > 0 && h < 0.14) { g.fillStyle = '#16130f'; g.fillRect(x + 4, y + 7, 8, 2); }
    },
    plat(g, tx, ty) { const x = tx * T, y = ty * T; g.fillStyle = '#8a6a2a'; g.fillRect(x, y, T, 5); g.fillStyle = '#c8a24a'; g.fillRect(x, y, T, 1); g.fillStyle = '#2a1c0a'; for (let i = 2; i < T; i += 5) g.fillRect(x + i, y + 2, 2, 2); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y + 5, T, 2); },
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

// The inside of a tower: a shaft of dark brickwork with wooden beams and narrow lit windows, in the colours of the zone (so a tower is never open sky).
const INTERIOR_TINT = { village: ['#2c1d19', '#3c2820', '#150d0b', [255, 150, 70]], hall: ['#232a2c', '#323c3f', '#0e1214', [140, 170, 200]], chapel: ['#262234', '#34304a', '#100e18', [150, 140, 230]], underworks: ['#1e2628', '#2a3639', '#0b1112', [120, 190, 180]], throne: ['#2a1a28', '#3a2638', '#120a14', [220, 120, 200]], graveyard: ['#222a28', '#303b38', '#0e1211', [140, 190, 170]], swamp: ['#1b2a22', '#26382d', '#0a120e', [120, 200, 120]] };
const INTERIOR_CACHE = {};
function interiorBrick(th) {
  if (INTERIOR_CACHE[th]) return INTERIOR_CACHE[th]; const P = INTERIOR_TINT[th] || INTERIOR_TINT.hall, c = canvasOf(64, 32), q = c.getContext('2d');
  q.fillStyle = P[2]; q.fillRect(0, 0, 64, 32);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) { const x = i * 16 + (row ? 8 : 0), y = row * 16, v = hash1(i * 3.7 + row * 11.3); q.fillStyle = v > 0.5 ? P[0] : P[1]; q.fillRect(x % 64 + 1, y + 1, 14, 14); if (x + 16 > 64) q.fillRect(1 - 8, y + 1, 7, 14); q.fillStyle = 'rgba(255,255,255,0.05)'; q.fillRect(x % 64 + 1, y + 1, 14, 1); }
  return INTERIOR_CACHE[th] = c;
}
function drawInterior(g, room, camX, camY, t) {
  const th = room.theme, P = INTERIOR_TINT[th] || INTERIOR_TINT.hall, tile = interiorBrick(th), ox = -(Math.floor(camX) % 64), oy = -(Math.floor(camY) % 32);
  for (let y = oy - 32; y < H + 32; y += 32) for (let x = ox - 64; x < W + 64; x += 64) g.drawImage(tile, x, y);
  const wx = Math.floor(camX), wy = Math.floor(camY);
  for (let bx = Math.floor((wx - 40) / 160) * 160 + 24; bx < wx + W + 40; bx += 160) { g.fillStyle = '#1d140f'; g.fillRect(bx - wx, 0, 10, H); g.fillStyle = '#2e2018'; g.fillRect(bx - wx + 1, 0, 3, H); g.fillStyle = '#120b08'; g.fillRect(bx - wx + 8, 0, 2, H); }          // upright beams
  for (let by = Math.floor((wy - 20) / 128) * 128 + 40; by < wy + H + 20; by += 128) {
    g.fillStyle = '#1d140f'; g.fillRect(0, by - wy, W, 8); g.fillStyle = '#2e2018'; g.fillRect(0, by - wy, W, 2); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, by - wy + 8, W, 5);                                   // cross beams
    const row = Math.round(by / 128), wxx = ((Math.floor(hash1(row * 5.1) * 3) * 53 + 70) % 160);
    for (let bx = Math.floor((wx - 90) / 160) * 160; bx < wx + W + 90; bx += 160) {                                                                                                                          // a narrow arched window in each bay
      const x = bx + wxx - wx, y = by - wy + 22; if (x < -30 || x > W + 30) continue; const fl = 0.8 + 0.2 * Math.sin(t * 0.07 + row);
      g.fillStyle = '#0b0807'; g.fillRect(x - 8, y - 2, 16, 52); g.beginPath(); g.arc(x, y - 2, 8, Math.PI, 0); g.fill();
      const gr = g.createLinearGradient(0, y - 8, 0, y + 48); gr.addColorStop(0, 'rgba(' + P[3] + ',' + (0.55 * fl) + ')'); gr.addColorStop(1, 'rgba(' + P[3] + ',' + (0.18 * fl) + ')'); g.fillStyle = gr; g.fillRect(x - 5, y, 10, 46); g.beginPath(); g.arc(x, y, 5, Math.PI, 0); g.fill();
      g.fillStyle = '#0b0807'; g.fillRect(x - 5, y + 18, 10, 2); g.fillRect(x - 1, y - 6, 2, 52);
    }
  }
  const vg = g.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(0,0,0,0.35)'); vg.addColorStop(1, 'rgba(0,0,0,0.15)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- the Clockwork Dungeon: gears
// A gear is painted once (a toothed wheel with spokes you can see through) and then simply turned, so any number of them are cheap.  Tooth k stands at angle 2*PI*k/n when the wheel is not
// turned: the playable gears (gears.js) rely on that to put each tooth's platform where the picture's tooth is.
const GEAR_CACHE = new Map(), GEAR_PAL = [['#6a4c1c', '#a8822e', '#e0be66', '#2a1c0a'], ['#26242c', '#403d4a', '#6a6678', '#100e14'], ['#3e2c14', '#6e5220', '#a07c34', '#160e06']];   // [shade, body, highlight, dark]
export function gearSprite(R, n, style = 0) {
  const key = R + '_' + n + '_' + style, hit = GEAR_CACHE.get(key); if (hit) return hit;
  const S = Math.ceil(R * 2 + 6), c = canvasOf(S, S), g = c.getContext('2d'), mid = S / 2, pal = GEAR_PAL[style % 3], TAU = Math.PI * 2;
  const root = R - Math.max(4, R * 0.13), hw = Math.PI / n;
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const a = k * TAU / n, pts = [[a - hw * 0.9, root], [a - hw * 0.4, R], [a + hw * 0.4, R], [a + hw * 0.9, root]];
    for (const [aa, rr] of pts) { const x = mid + Math.cos(aa) * rr, y = mid + Math.sin(aa) * rr; if (k === 0 && aa === pts[0][0]) g.moveTo(x, y); else g.lineTo(x, y); }
  }
  g.closePath();
  const gr = g.createRadialGradient(mid - R * 0.3, mid - R * 0.3, R * 0.1, mid, mid, R); gr.addColorStop(0, pal[2]); gr.addColorStop(0.45, pal[1]); gr.addColorStop(1, pal[0]);
  g.fillStyle = gr; g.fill(); g.lineWidth = 1; g.strokeStyle = pal[3]; g.stroke();
  const spokes = R > 40 ? 6 : R > 16 ? 5 : 0;
  if (spokes) {                                                                                                     // see-through windows between the spokes
    g.save(); g.globalCompositeOperation = 'destination-out'; const rin = R * 0.3, rout = root - Math.max(4, R * 0.16), sw = Math.max(0.12, 3 / R);
    for (let i = 0; i < spokes; i++) { const a0 = i * TAU / spokes + sw + 0.2, a1 = (i + 1) * TAU / spokes - sw + 0.2; g.beginPath(); g.arc(mid, mid, rout, a0, a1); g.arc(mid, mid, rin, a1, a0, true); g.closePath(); g.fill(); }
    g.restore();
  }
  g.fillStyle = pal[3]; g.beginPath(); g.arc(mid, mid, Math.max(2, R * 0.12), 0, TAU); g.fill();                    // the axle
  g.fillStyle = pal[2]; g.beginPath(); g.arc(mid - 0.5, mid - 0.5, Math.max(1, R * 0.07), 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,240,190,0.35)'; g.beginPath(); g.arc(mid, mid, root - 1, Math.PI * 1.1, Math.PI * 1.55); g.stroke();      // a glint along the rim
  GEAR_CACHE.set(key, c); return c;
}
// the background of the Clockwork Dungeon: gears behind gears, from ones barely half a hero tall to ones the size of the room, each layer turning at its own pace and sliding by at its own depth
const GEAR_LAYERS = [
  { par: 0.1, style: 2, dim: 0.5, n: 4, r: [110, 200], strip: 1500 },          // massive: the works of the whole dungeon
  { par: 0.22, style: 1, dim: 0.62, n: 6, r: [60, 110], strip: 1500 },
  { par: 0.38, style: 2, dim: 0.78, n: 8, r: [28, 56], strip: 1400 },
  { par: 0.6, style: 0, dim: 0.95, n: 10, r: [9, 26], strip: 1300 },           // the smallest are half the hero's height across
];
function drawGears(g, room, camX, camY, t) {
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#171008'); bg.addColorStop(1, '#0a0705'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const seed = (room.w * 7 + (room.id ? room.id.charCodeAt(0) * 3 + room.id.charCodeAt(room.id.length - 1) : 0));
  GEAR_LAYERS.forEach((L, li) => {
    for (let i = 0; i < L.n; i++) {
      const hs = k => hash1(seed + li * 101.3 + i * 17.7 + k * 3.9), R = Math.round(L.r[0] + (L.r[1] - L.r[0]) * hs(1)), n = Math.max(8, Math.round(R / 3.4)), spin = (i % 2 ? 1 : -1) * 0.55 / R;
      const wx = hs(2) * L.strip, wy = (hs(3) * 1.15 - 0.1) * Math.max(H, room.ph * L.par + H * 0.9), sy = wy - camY * L.par, ang = hs(4) * 6.28 + spin * t;
      const spr = gearSprite(R, n, L.style); let sx = (((wx - camX * L.par) % L.strip) + L.strip) % L.strip;
      for (const ox of [-L.strip, 0, L.strip]) {
        const x = sx + ox; if (x < -R - 6 || x > W + R + 6 || sy < -R - 6 || sy > H + R + 6) continue;
        g.save(); g.globalAlpha = L.dim; g.translate(Math.round(x), Math.round(sy)); g.rotate(ang); g.drawImage(spr, -spr.width / 2, -spr.height / 2); g.restore();
      }
    }
  });
  g.fillStyle = 'rgba(8,5,2,0.28)'; g.fillRect(0, 0, W, H);
  const fl = g.createLinearGradient(0, H * 0.6, 0, H); fl.addColorStop(0, 'rgba(0,0,0,0)'); fl.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = fl; g.fillRect(0, H * 0.6, W, H * 0.4);
}

// ---------------------------------------------------------------- the Cistern: a flooded waterworks
// Great stone vaults and arches in teal darkness, shafts of pale light from grilles far above, a thin white veil of falling water here and there, and a cold shimmer low down where the
// flood laps the pillars.  Everything slides by at its own depth.
function drawCistern(g, room, camX, camY, t) {
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#05100f'); bg.addColorStop(0.7, '#0b1c20'); bg.addColorStop(1, '#10282c'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const seed = room.w * 5 + (room.id ? room.id.charCodeAt(0) * 7 + room.id.charCodeAt(room.id.length - 1) : 0);
  const floorY = room.horizon - camY * 0.5;
  // far arches
  for (let layer = 0; layer < 2; layer++) {
    const par = 0.18 + layer * 0.22, span = 120 + layer * 56, col = layer ? '#0c1c20' : '#081416', hi = layer ? 'rgba(120,190,200,0.10)' : 'rgba(120,190,200,0.05)';
    const off = -(((camX * par) % span) + span) % span, base = floorY + (layer ? 8 : -6), top = base - (layer ? 150 : 120);
    for (let x = off - span; x < W + span; x += span) {
      const k = Math.round((x + camX * par) / span), px = x + span / 2;
      g.fillStyle = col; g.fillRect(px - 9, top + 28, 18, base - top);                                              // a pillar
      g.beginPath(); g.moveTo(px - 9, top + 30); g.quadraticCurveTo(px - span / 2, top - 16, px - span + 9, top + 30); g.lineTo(px - span + 9, top - 4); g.lineTo(px - 9, top - 4); g.closePath(); g.fill();          // the arch springing to the left
      g.fillStyle = hi; g.fillRect(px - 9, top + 28, 2, base - top);
      if (hash1(seed + k * 3.1 + layer) < 0.4) { const wx = px - span / 2, wh = 70 + hash1(seed + k) * 60; g.fillStyle = 'rgba(150,215,225,0.07)'; g.fillRect(wx - 5, top + 18, 10, base - top); g.fillStyle = 'rgba(190,235,240,0.10)'; for (let yy = 0; yy < wh; yy += 5) g.fillRect(wx - 3 + ((yy + t * 2) % 6 < 3 ? 0 : 5), top + 18 + ((yy + t * 3) % (base - top)), 1, 4); }          // a thin fall of water down the back wall
    }
  }
  // shafts of light from the grilles above
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) { const x = ((hash1(seed + i * 9.7) * 900 - camX * 0.3) % 600 + 600) % 600 - 100, w = 20 + hash1(seed + i) * 26, a = 0.04 + 0.025 * Math.sin(t * 0.02 + i * 2); g.fillStyle = 'rgba(170,230,235,' + a.toFixed(3) + ')'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w + 70, H); g.lineTo(x + 30, H); g.closePath(); g.fill(); }
  g.restore();
  // the flood's cold shimmer along the foot of the walls
  const shy = Math.min(H - 6, floorY + 2), sg = g.createLinearGradient(0, shy - 30, 0, shy + 8); sg.addColorStop(0, 'rgba(60,140,160,0)'); sg.addColorStop(1, 'rgba(60,140,160,0.22)'); g.fillStyle = sg; g.fillRect(0, shy - 30, W, 38);
  g.fillStyle = 'rgba(190,235,240,0.18)'; for (let i = 0; i < 14; i++) { const x = (((i * 61 + t * (0.3 + (i % 3) * 0.15)) % (W + 40)) - 20); g.fillRect(x | 0, (shy - 3 - (i % 4) * 4) | 0, 6 + (i % 3) * 4, 1); }
  g.fillStyle = 'rgba(0,6,8,0.3)'; g.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- the disco room
// Skeletons dance in the background on a floor that runs back into the dark: three rows, small and dim far away, big and bright up close.  Coloured beams sweep from the ceiling.  When the
// hero reaches the middle of the floor (see Game.discoStop) the music dies, every skeleton stops and turns to look at them, and all the beams swing round to find them.  Once the party is
// over (flag disco_done) the room is dark and empty.
const BPM_FRAMES = 30.5;                                                                                    // one beat of a 118 bpm song, in frames
export function discoBeams(room, t) {
  const st = room.discoState || { mode: 'party' }, out = [];
  if (st.mode === 'gone') return out;
  if (st.mode === 'stopped') { const hx = room.playerX || room.pw / 2; for (const f of [0.3, 0.5, 0.7]) out.push({ fx: room.pw * f, tx: hx, hue: 0, white: true }); return out; }
  for (let i = 0; i < 5; i++) { const fx = room.pw * (0.1 + 0.2 * i); out.push({ fx, tx: fx + Math.sin(t * 0.025 + i * 1.7) * 90 + Math.sin(t * 0.011 + i) * 40, hue: (t * 1.2 + i * 70) % 360 }); }
  return out;
}
function discoCrowd(room) {
  if (room._crowd) return room._crowd;
  const rows = [{ y: -26, sc: 0.5, n: 15, dim: 0.55 }, { y: -13, sc: 0.75, n: 11, dim: 0.8 }, { y: -2, sc: 1.0, n: 8, dim: 1 }], out = [];          // y: how far up the screen (behind the floor line) the row stands
  rows.forEach((rw, ri) => { for (let i = 0; i < rw.n; i++) out.push({ x: (i + 0.5 + (hash1(ri * 9.1 + i * 3.3 + room.w) - 0.5) * 0.7) * room.pw / rw.n, row: ri, y: rw.y, sc: rw.sc, dim: rw.dim, green: hash1(i * 5.7 + ri * 11.9) < 0.4, ph: hash1(i * 2.3 + ri * 17.7), move: Math.floor(hash1(i * 7.1 + ri * 3.1) * 3) }); });
  return room._crowd = out;
}
function drawDisco(g, room, camX, camY, t) {
  const st = room.discoState || { mode: 'party' }, mode = st.mode, gone = mode === 'gone', stopped = mode === 'stopped', floorY = room.horizon - camY, ceilY = 32 - camY, pw = room.pw;
  const wall = g.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, '#120a1c'); wall.addColorStop(1, '#241236'); g.fillStyle = wall; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.025)'; for (let x = -((camX | 0) % 48); x < W; x += 48) g.fillRect(x, 0, 2, H);                       // wall panels
  const bt = (stopped ? st.t0 : t) / BPM_FRAMES;                                                                  // (time stands still for the dancers once the music stops)
  // the dance floor runs back from the floor line: a chequered band, each square pulsing in colour with the beat
  const depth = 30, fy = floorY - depth; g.fillStyle = gone ? '#1a1224' : '#1c1028'; g.fillRect(0, fy, W, depth + 2);
  if (!gone) for (let row = 0; row < 3; row++) {
    const y0 = fy + row * 10, sq = 12 + row * 4, ox = -(((camX * (0.9 + row * 0.05)) | 0) % (sq * 2));
    for (let x = ox - sq * 2; x < W + sq; x += sq) {
      const k = Math.round((x + camX * (0.9 + row * 0.05)) / sq), on = (k + row) & 1; if (!on) continue;
      const hue = (k * 47 + row * 90 + bt * 40) % 360, a = stopped ? 0.07 : 0.16 + 0.12 * Math.sin(bt * Math.PI * 2 + k + row);
      g.fillStyle = `hsla(${hue},80%,55%,${a})`; g.fillRect(x, y0, sq, 10);
    }
  }
  // the dancers, back row first
  if (!gone) for (const d of discoCrowd(room)) {
    const x = d.x - camX; if (x < -30 || x > W + 30) continue;
    const beat = bt + d.ph * 4, hop = stopped ? 0 : Math.abs(Math.sin(beat * Math.PI)) * (d.move === 1 ? 7 : 3) * d.sc;
    const flip = stopped ? ((room.playerX || pw / 2) >= d.x ? 1 : -1) : (Math.floor(beat / 2) % 2 ? 1 : -1) * (d.move === 2 ? Math.sign(Math.sin(bt * 0.7 + d.ph * 9) || 1) : 1);
    const f = stopped ? 0 : Math.floor((bt * 4 + d.ph * 8) % 8);
    g.save(); g.globalAlpha = 0.35 + 0.65 * d.dim * (stopped ? 0.75 : 1);
    drawSheet(g, d.green ? 'skeleton_g' : 'skeleton_w', f, x, floorY + d.y - hop, { dir: flip, scale: d.sc * 1.1, rot: stopped ? 0 : Math.sin(beat * Math.PI) * 0.1 });
    g.restore();
  }
  // the ceiling rail, the mirror ball, the beams
  g.fillStyle = '#0c0614'; g.fillRect(0, ceilY - 4, W, 6);
  const bx = pw / 2 - camX, by = ceilY + 26 + (gone ? 0 : Math.sin(t * 0.04) * 1.2);
  g.fillStyle = '#2a2236'; g.fillRect(bx - 1, ceilY, 2, by - ceilY - 12);
  g.fillStyle = gone ? '#3a3448' : '#aab4c8'; g.beginPath(); g.arc(bx, by, 12, 0, Math.PI * 2); g.fill();
  if (!gone) {
    g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 9; i++) { const a = t * 0.04 + i * 0.7, px = bx + Math.cos(a) * 10 * Math.sin(i * 1.3), py = by + Math.sin(i * 2.1 + t * 0.03) * 9; g.fillRect(px | 0, py | 0, 2, 2); }
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const b of discoBeams(room, t)) {
      const fx = b.fx - camX, tx = b.tx - camX, col = b.white ? '255,255,255' : null, c = col || (() => { const h = b.hue / 60, c1 = Math.floor(h) % 6, f2 = h - Math.floor(h), q = Math.round(255 * (1 - f2)), u = Math.round(255 * f2); return [[255, u, 0], [q, 255, 0], [0, 255, u], [0, q, 255], [u, 0, 255], [255, 0, q]][c1].join(','); })();
      const gr = g.createLinearGradient(fx, ceilY, tx, floorY); gr.addColorStop(0, `rgba(${c},${stopped ? 0.34 : 0.3})`); gr.addColorStop(1, `rgba(${c},0.04)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(fx - 3, ceilY); g.lineTo(fx + 3, ceilY); g.lineTo(tx + 26, floorY); g.lineTo(tx - 26, floorY); g.closePath(); g.fill();
      g.fillStyle = `rgba(${c},0.22)`; g.beginPath(); g.ellipse(tx, floorY + 1, 28, 5, 0, 0, Math.PI * 2); g.fill();           // the pool of light where it lands
    }
    if (!stopped) for (let i = 0; i < 16; i++) {                                                                      // the ball's sparkles, wheeling round the walls
      const a = t * 0.012 + i * 0.39, px = bx + Math.cos(a * 2 + i) * (60 + (i % 5) * 38), py = ceilY + 20 + ((Math.sin(a * 3 + i * 1.7) + 1) * 0.5) * (floorY - ceilY - 30);
      g.fillStyle = `hsla(${(t * 3 + i * 40) % 360},90%,70%,0.55)`; g.fillRect(px | 0, py | 0, 3, 3);
    }
    g.restore();
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W, H);
}

export function drawBackground(g, room, camX, camY, t) {
  const th = room.theme;
  if (room.disco) { drawDisco(g, room, camX, camY, t); return; }
  if (th === 'clockwork') { drawGears(g, room, camX, camY, t); return; }
  if (th === 'cistern') { drawCistern(g, room, camX, camY, t); return; }          // (a gear shaft too: the tower's brickwork gives way to the wheels)
  if (room.interior) { drawInterior(g, room, camX, camY, t); return; }
  if (th === 'village') {            // dusk sky over a town in flames: pink cloud bank, building silhouettes, an orange glow rising from the street
    // (before the Cinder Warden's torches the sky is a calm violet dusk; each house that catches turns it a little more towards the burning one)
    const burn = Math.max(room.flags && room.flags.village_fire ? 1 : Math.min(1, (room.ignited ? room.ignited.size : 0) / 3), room.glow || 0);          // (room.glow: the opening scene, on the hill - the city far off begins to burn)
    const hz = room.horizon - camY, grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#2a1f42'); grd.addColorStop(0.6, '#6a5078'); grd.addColorStop(1, '#a8708a'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
    if (burn > 0) { const fg = g.createLinearGradient(0, 0, 0, H); fg.addColorStop(0, '#3a1f3a'); fg.addColorStop(0.6, '#8a4a52'); fg.addColorStop(1, '#c0683a'); g.globalAlpha = burn; g.fillStyle = fg; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    layerRepeat(g, IMG.town_sky, camX * 0.03, hz - IMG.town_sky.height + 70, 0);
    layerRepeat(g, IMG.dusk_far, camX * 0.05, hz - IMG.dusk_far.height + 36, 0);                  // Mountain at Dusk (ansimuz, CC0): ranges behind the town
    layerRepeat(g, IMG.dusk_mountains, camX * 0.1, hz - IMG.dusk_mountains.height + 40, 0);
    layerRepeat(g, IMG.town_mid, camX * 0.22, hz - IMG.town_mid.height + 18, 0);
    if (room.glow > 0.04) for (let i = 0; i < 10; i++) {                                            // fires, far off among the roofs, one by one
      const wx = i * 187 + 70 + hash1(i * 3.3) * 60, sx = (((wx - camX * 0.22) % 1900) + 1900) % 1900 - 160; if (sx < -30 || sx > W + 30) continue;
      const k = room.glow * (0.45 + 0.55 * hash1(i * 7.1)), base = hz + 14 - (i % 3) * 4, fh = (7 + 12 * hash1(i * 1.9)) * k * (0.85 + 0.15 * Math.sin(t * 0.3 + i * 2.1));
      const fg = g.createRadialGradient(sx, base - fh * 0.5, 1, sx, base - fh * 0.5, 14 + fh); fg.addColorStop(0, 'rgba(255,150,50,' + (0.5 * k).toFixed(3) + ')'); fg.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = fg; g.fillRect(sx - 34, base - fh - 34, 68, fh + 46);
      g.fillStyle = 'rgba(255,205,95,' + Math.min(1, 1.1 * k).toFixed(3) + ')'; g.beginPath(); g.moveTo(sx - 2.5, base); g.lineTo(sx, base - fh); g.lineTo(sx + 2.5, base); g.closePath(); g.fill();
    }
    const fl = (0.22 + 0.05 * Math.sin(t * 0.13) + 0.03 * Math.sin(t * 0.41)) * burn, gr = g.createLinearGradient(0, H * 0.35, 0, H); gr.addColorStop(0, 'rgba(255,90,20,0)'); gr.addColorStop(1, `rgba(255,110,30,${fl})`); g.fillStyle = gr; g.fillRect(0, H * 0.35, W, H * 0.65);
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
  while (x < W) { const m = list[i % list.length], w = ws[i % list.length]; if (x + w > 0) { if (y > 0 && topOpaque(m)) g.drawImage(m, 0, 0, m.width, 1, Math.round(x), 0, w, Math.round(y)); g.drawImage(m, Math.round(x), Math.round(y), w, Math.round(m.height * sc)); } x += w; i++; }
}
function layerRepeat(g, img, scroll, y, gap) {
  const w = img.width + gap, off = -(((scroll % w) + w) % w), ext = y > 0 && topOpaque(img);
  for (let x = off; x < W; x += w) { if (ext) g.drawImage(img, 0, 0, img.width, 1, Math.round(x), 0, img.width, Math.round(y)); g.drawImage(img, Math.round(x), Math.round(y)); }          // (above the picture: its own top row, stretched - so the top edge of a layer never shows when the camera climbs)
}
const TOPOP = new WeakMap();
function topOpaque(img) {                                   // is the picture's top row solid (a layer that fills the sky above it), as opposed to a silhouette?
  let v = TOPOP.get(img); if (v === undefined) { const c = canvasOf(img.width, 1), g = c.getContext('2d'); g.drawImage(img, 0, 0, img.width, 1, 0, 0, img.width, 1); const p = g.getImageData(0, 0, img.width, 1).data; v = true; for (let i = 3; i < p.length; i += 4) if (p[i] < 250) { v = false; break; } TOPOP.set(img, v); }
  return v;
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
    const th = THEME[this.theme]; this.anim.length = 0; this.spikes = []; this.brk = [];          // (spikes are also drawn again on the clear layer above fog and darkness: a hazard must always be seen)
    // depth: contiguous solid tiles above
    for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) {
      const v = this.tiles[ty * this.w + tx]; if (!v) continue;
      if (v === TILE.SOLID) {
        let depth = 0; while (depth < 3 && this.solid(tx, ty - 1 - depth) && ty - 1 - depth >= 0) depth++;
        // ceilings/overhangs: tile with air below and solid above shouldn't look like grass-top
        th.solid(g, tx, ty, { u: this.solid(tx, ty - 1), d: this.solid(tx, ty + 1), l: this.solid(tx - 1, ty), r: this.solid(tx + 1, ty) }, depth);
      } else if (v === TILE.PLAT) th.plat(g, tx, ty);
      else if (v === TILE.SPIKE) { drawSheet(g, 'spikes', 0, tx * T, ty * T, { ax: 0, ay: 0 }); this.spikes.push([tx, ty]); }
      else if (v === TILE.CRACK) { drawSheet(g, 't_crack', 0, tx * T, ty * T, { ax: 0, ay: 0 }); this.brk.push([tx, ty, v]); }
      else if (v === TILE.BARRICADE) { drawSheet(g, 't_barricade', 0, tx * T, ty * T, { ax: 0, ay: 0 }); this.brk.push([tx, ty, v]); }
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
      else { const k = 0.2 + 0.08 * Math.sin(t * 0.21 + tx * 1.7 + ty * 0.9); g.fillStyle = 'rgba(40,90,255,' + k + ')'; g.fillRect(x, y, 16, 16); g.fillStyle = 'rgba(170,215,255,' + (k * 0.9) + ')'; g.fillRect(x + 5 + Math.round(Math.sin(t * 0.17 + ty) * 1.5), y, 6, 16); }          // (the blue flames themselves are drawn by Game.sealFlames)
    }
  }
}
