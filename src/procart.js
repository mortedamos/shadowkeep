// Original pixel art drawn in code (no anti-aliasing) to fill gaps the downloaded packs don't cover:
// bat, haunted armor, item icons, props, projectiles.
const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]; };
const mulc = (c, k, add = 0) => [Math.min(255, c[0] * k + add), Math.min(255, c[1] * k + add), Math.min(255, c[2] * k + add), c[3]];

class Px {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (!this.inb(x, y)) return; const i = (y * this.w + x) * 4, d = this.d; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3] === undefined ? 255 : c[3]; }
  a(x, y) { return this.inb(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }
  rect(x, y, w, h, c) { x = Math.round(x); y = Math.round(y); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  disc(cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3) this.set(x, y, c); }
  line(x0, y0, x1, y1, c, t = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy; const off = Math.floor((t - 1) / 2);
    for (;;) { this.rect(x0 - off, y0 - off, t, t, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  poly(pts, c) {
    let mn = 1e9, mx = -1e9; for (const p of pts) { mn = Math.min(mn, p[1]); mx = Math.max(mx, p[1]); }
    for (let y = Math.floor(mn); y <= Math.ceil(mx); y++) {
      const xs = []; const yy = y + 0.5;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + (yy - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, c);
    }
  }
  // rim light on top/left silhouette edges, shadow on bottom/right edges
  shade(hi = 1.28, lo = 0.68) {
    const al = new Uint8Array(this.w * this.h); for (let i = 0; i < al.length; i++) al[i] = this.d[i * 4 + 3];
    const A = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : al[y * this.w + x]);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!A(x, y)) continue; const i = (y * this.w + x) * 4, d = this.d;
      let k = 1; if (!A(x, y - 1) || !A(x - 1, y)) k = hi; else if (!A(x + 1, y) || !A(x, y + 1)) k = lo; else continue;
      d[i] = Math.min(255, d[i] * k + (k > 1 ? 8 : 0)); d[i + 1] = Math.min(255, d[i + 1] * k + (k > 1 ? 8 : 0)); d[i + 2] = Math.min(255, d[i + 2] * k + (k > 1 ? 8 : 0));
    }
  }
  outline(c) {
    const al = new Uint8Array(this.w * this.h); for (let i = 0; i < al.length; i++) al[i] = this.d[i * 4 + 3];
    const A = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : al[y * this.w + x]);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!A(x, y) && (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1))) this.set(x, y, c);
  }
  blitTo(g, ox, oy) { const id = new ImageData(this.d, this.w, this.h); const c = document.createElement('canvas'); c.width = this.w; c.height = this.h; c.getContext('2d').putImageData(id, 0, 0); g.drawImage(c, ox, oy); }
}

function strip(n, w, h, fn) {
  const c = document.createElement('canvas'); c.width = n * w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  for (let k = 0; k < n; k++) { const p = new Px(w, h); fn(p, k); p.blitTo(g, k * w, 0); }
  return c;
}

const OUT = hex('#0a0810');

// ------------------------------------------------------------------------------------------------
// HAUNTED ARMOR  (poleaxe knight; floating helm and gauntlets).  Faces right.
// ------------------------------------------------------------------------------------------------
const ARM = { main: hex('#7d89a6'), hi: hex('#c3cee6'), lo: hex('#434c66'), dark: hex('#22283a'), gold: hex('#b8913f'), cloth: hex('#6a1d2e'), eye: hex('#5ff3ff'), plume: hex('#7a2f9a') };
const AW = 56, AH = 64, AY = 60;
function armorFrame(p, pose, pal = ARM) {
  const cx = 26 + (pose.lean || 0), bob = pose.bob || 0, hipY = 41 + bob;
  const wob = pose.legs ? 0 : 0;
  for (const L of pose.legs || []) {
    const hx = cx + (L.back ? -2 : 2), fx = cx + L.fx, fy = AY - (L.lift || 0), kx = (hx + fx) / 2 + 3, ky = (hipY + fy) / 2 - 1;
    const col = L.back ? pal.lo : pal.main;
    p.line(hx, hipY, kx, ky, col, 5); p.line(kx, ky, fx, fy - 3, col, 4);
    p.rect(fx - 3, fy - 3, 10, 3, L.back ? pal.dark : pal.lo); p.rect(fx - 3, fy - 3, 10, 1, L.back ? pal.lo : pal.hi);
    p.disc(kx, ky, 2.6, L.back ? pal.lo : pal.gold);
  }
  // torso + tabard
  p.poly([[cx - 8, 24 + bob], [cx + 9, 24 + bob], [cx + 6, 42 + bob], [cx - 6, 42 + bob]], pal.main);
  p.rect(cx - 3, 26 + bob, 8, 4, pal.hi); p.rect(cx - 6, 36 + bob, 11, 2, pal.gold);
  p.poly([[cx - 4, 42 + bob], [cx + 5, 42 + bob], [cx + 4, 51 + bob], [cx, 49 + bob], [cx - 3, 52 + bob]], pal.cloth);
  p.rect(cx - 1, 31 + bob, 2, 4, pal.gold); p.rect(cx - 2, 32 + bob, 4, 1, pal.gold);
  // pauldrons
  p.disc(cx - 8, 25 + bob, 4.5, pal.lo); p.disc(cx + 9, 25 + bob, 5, pal.main); p.rect(cx + 5, 22 + bob, 8, 1, pal.hi); p.rect(cx + 6, 28 + bob, 7, 1, pal.gold);
  // poleaxe
  const w = pose.weapon; const dx = Math.cos(w.a), dy = Math.sin(w.a), hx = cx + w.hx, hy = 28 + bob + w.hy;
  const tipx = hx + dx * 17, tipy = hy + dy * 17, butx = hx - dx * 12, buty = hy - dy * 12;
  p.line(butx, buty, tipx, tipy, hex('#4a3a2a'), 2);
  const px = -dy, py = dx;                         // perpendicular
  p.poly([[tipx - dx * 4, tipy - dy * 4], [tipx + px * 8 + dx * 1, tipy + py * 8 + dy * 1], [tipx + px * 6 + dx * 6, tipy + py * 6 + dy * 6], [tipx + dx * 5, tipy + dy * 5]], pal.hi);
  p.line(tipx - dx * 3, tipy - dy * 3, tipx + px * 7 + dx * 2, tipy + py * 7 + dy * 2, pal.main, 1);
  p.line(tipx, tipy, tipx + dx * 6, tipy + dy * 6, pal.hi, 1);
  // arms (floating gauntlets)
  p.line(cx + 9, 27 + bob, (cx + 9 + hx) / 2 + 1, (27 + bob + hy) / 2 + 3, pal.main, 4);
  p.disc(hx, hy, 3.4, pal.main); p.disc(hx - dx * 7, hy - dy * 7, 3, pal.lo);
  p.rect(hx - 2, hy - 3, 4, 1, pal.hi);
  // floating helm
  const hc = cx + 1 + (pose.headX || 0), hy2 = 13 + bob + (pose.headY || 0);
  p.disc(hc, hy2 - 1, 6, pal.main); p.rect(hc - 6, hy2 - 1, 12, 8, pal.main); p.rect(hc - 4, hy2 + 5, 9, 3, pal.lo);
  p.rect(hc - 1, hy2 + 1, 7, 2, pal.dark); p.rect(hc + 1, hy2 + 1, 5, 2, pal.eye);
  p.rect(hc - 5, hy2 - 4, 6, 1, pal.hi); p.line(hc + 1, hy2 - 7, hc + 1, hy2 + 3, pal.gold, 1);
  const pw = pose.plume || 0;
  p.poly([[hc - 2, hy2 - 6], [hc - 6, hy2 - 10], [hc - 12, hy2 - 6 + pw], [hc - 15, hy2 - 1 + pw * 1.5], [hc - 9, hy2 - 2 + pw], [hc - 4, hy2 - 1]], pal.plume);
  p.shade(); p.outline(OUT);
  // soul wisps in the gap between helm and torso
  p.set(cx, 20 + bob, pal.eye); p.set(cx + 2, 21 + bob, hex('#9ff8ff')); p.set(cx - 1, 22 + bob, hex('#2aa6b8'));
}
function armorPose(kind, k) {
  const idleW = (b) => ({ a: -Math.PI / 2 + 0.12, hx: 10, hy: 4 + b });
  if (kind === 'idle') { const b = [0, 0, 1, 1][k]; return { bob: b, plume: [0, 1, 2, 1][k], legs: [{ back: true, fx: -4 }, { fx: 4 }], weapon: idleW(0) }; }
  if (kind === 'walk') {
    const ph = k / 6 * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
    return { bob: Math.abs(c) > 0.7 ? 1 : 0, plume: Math.round(s * 2), lean: 1, legs: [{ back: true, fx: -s * 8, lift: Math.max(0, c) * 4 }, { fx: s * 8, lift: Math.max(0, -c) * 4 }], weapon: idleW(Math.round(s)) };
  }
  if (kind === 'attack') { // 0,1 windup (telegraph) 2,3 strike 4 recover
    const A = [-2.5, -2.2, -0.9, 0.35, 0.1][k], hx = [4, 2, 12, 15, 11][k], hy = [-8, -12, 0, 6, 4][k], lean = [-2, -3, 3, 4, 1][k];
    return { bob: k === 2 ? 1 : 0, lean, plume: [0, -2, 3, 3, 1][k], headX: lean > 0 ? 1 : -1, legs: [{ back: true, fx: -7 }, { fx: 7 }], weapon: { a: A, hx, hy } };
  }
  return { bob: 2, lean: -3, headX: -2, headY: 2, plume: -2, legs: [{ back: true, fx: -3 }, { fx: 3 }], weapon: { a: 1.0, hx: 4, hy: 12 } }; // hurt
}


// ------------------------------------------------------------------------------------------------
// BAT
// ------------------------------------------------------------------------------------------------
function batFrame(p, k) {
  const BODY = hex('#2c1b3d'), WING = hex('#46285e'), VEIN = hex('#7a4a9e'), EYE = hex('#ff3b3b');
  const cx = 14, cy = 11;
  if (k === 4) { // hanging, wings wrapped (drawn upright, game flips vertically)
    p.poly([[cx - 6, cy - 6], [cx + 6, cy - 6], [cx + 5, cy + 5], [cx, cy + 8], [cx - 5, cy + 5]], WING);
    p.line(cx, cy - 6, cx, cy + 7, VEIN, 1);
    p.disc(cx, cy + 6, 3, BODY); p.set(cx - 2, cy + 6, EYE); p.set(cx + 2, cy + 6, EYE);
    p.set(cx - 3, cy + 9, BODY); p.set(cx + 3, cy + 9, BODY); p.shade(); p.outline(OUT); return;
  }
  const tipDy = [-8, -3, 4, -2][k], low = [-2, 0, 3, 0][k];
  for (const s of [-1, 1]) {
    const X = v => cx + s * v;
    p.poly([[X(2), cy - 2], [X(5), cy - 4 + tipDy * 0.4], [X(12), cy - 1 + tipDy], [X(9.5), cy + 2 + tipDy * 0.55 + 2], [X(7), cy + 3 + low + 1], [X(5), cy + 5 + low], [X(2), cy + 3]], WING);
    p.line(X(2), cy - 1, X(12), cy - 1 + tipDy, VEIN, 1); p.line(X(2), cy, X(9.5), cy + 2 + tipDy * 0.55 + 2, VEIN, 1); p.line(X(2), cy + 1, X(7), cy + 3 + low + 1, VEIN, 1);
  }
  p.disc(cx, cy + 1, 3.2, BODY); p.disc(cx, cy - 2, 3, BODY);
  p.set(cx - 3, cy - 5, BODY); p.set(cx + 3, cy - 5, BODY); p.set(cx - 3, cy - 4, BODY); p.set(cx + 3, cy - 4, BODY);
  p.set(cx - 1, cy - 2, EYE); p.set(cx + 1, cy - 2, EYE); p.set(cx - 1, cy, hex('#f2efe6')); p.set(cx + 1, cy, hex('#f2efe6'));
  p.shade(1.2, 0.75); p.outline(OUT);
  p.set(cx - 1, cy - 2, EYE); p.set(cx + 1, cy - 2, EYE);
}

// ------------------------------------------------------------------------------------------------
// ICONS (14x14) and props
// ------------------------------------------------------------------------------------------------
export const ICON = ['heart', 'potion', 'mana', 'coin', 'gem', 'key', 'feather', 'boot', 'ember', 'thunder', 'hpup', 'mpup', 'atkup', 'skull', 'orb', 'scroll', 'e_fire', 'e_ice', 'e_sun', 'e_aegis', 'dagger', 'axe', 'torchi', 'caltrop', 'holy', 'bandage'];
const IW = 14;
function iconFrame(p, k) {
  const R = hex('#d4263a'), R2 = hex('#ff7a86'), GL = hex('#f2c14e'), GL2 = hex('#fff0a8'), BL = hex('#3a8bff'), BL2 = hex('#a8d4ff'), WH = hex('#f4f6ff');
  const name = ICON[k];
  switch (name) {
    case 'heart': p.poly([[2, 5], [4, 3], [7, 5], [10, 3], [12, 5], [12, 8], [7, 12], [2, 8]], R); p.rect(4, 4, 2, 2, R2); break;
    case 'potion': p.rect(6, 2, 3, 3, hex('#8a6a3a')); p.poly([[6, 5], [9, 5], [12, 10], [11, 12], [4, 12], [3, 10]], hex('#c9d0e0')); p.poly([[4, 9], [11, 9], [12, 10], [11, 12], [4, 12], [3, 10]], R); p.rect(5, 10, 2, 1, R2); break;
    case 'mana': p.rect(6, 2, 3, 3, hex('#8a6a3a')); p.poly([[6, 5], [9, 5], [12, 10], [11, 12], [4, 12], [3, 10]], hex('#c9d0e0')); p.poly([[4, 9], [11, 9], [12, 10], [11, 12], [4, 12], [3, 10]], BL); p.rect(5, 10, 2, 1, BL2); break;
    case 'coin': p.disc(6.5, 6.5, 4.6, GL); p.disc(6.5, 6.5, 3, hex('#c9962c')); p.rect(6, 4, 1, 5, GL2); p.rect(5, 4, 3, 1, GL2); break;
    case 'gem': p.poly([[7, 1], [11, 5], [7, 12], [3, 5]], hex('#40d8e8')); p.poly([[7, 1], [11, 5], [7, 6]], hex('#b6faff')); p.poly([[7, 6], [11, 5], [7, 12]], hex('#1e9db4')); break;
    case 'key': p.disc(4.5, 4.5, 3, GL); p.disc(4.5, 4.5, 1.2, [0, 0, 0, 0]); p.rect(6, 6, 2, 7, GL); p.rect(8, 10, 2, 1, GL); p.rect(8, 12, 2, 1, GL); break;
    case 'feather': p.poly([[12, 1], [4, 5], [2, 11], [5, 9], [11, 6]], BL2); p.line(2, 12, 11, 2, WH, 1); p.line(4, 8, 8, 8, BL, 1); p.line(5, 6, 8, 5, BL, 1); break;
    case 'boot': p.poly([[4, 2], [8, 2], [8, 8], [12, 9], [12, 12], [3, 12], [3, 7]], hex('#6a3aa8')); p.rect(3, 10, 9, 2, hex('#2b1850')); p.rect(4, 3, 4, 1, hex('#b78cff')); p.line(1, 5, 3, 5, hex('#b78cff'), 1); p.line(0, 8, 3, 8, hex('#b78cff'), 1); break;
    case 'ember': p.poly([[7, 1], [10, 5], [11, 9], [9, 12], [5, 12], [3, 9], [4, 5], [6, 7]], hex('#ff6a1e')); p.poly([[7, 5], [9, 8], [8, 11], [6, 11], [5, 8]], hex('#ffd24a')); p.rect(7, 9, 1, 2, WH); break;
    case 'thunder': p.poly([[8, 1], [3, 8], [6, 8], [5, 13], [11, 5], [8, 5], [10, 1]], hex('#ffe45a')); p.poly([[8, 3], [5, 8], [7, 8], [6, 11], [9, 6], [7, 6]], WH); break;
    case 'hpup': p.poly([[1, 5], [4, 2], [7, 4], [10, 2], [13, 5], [13, 8], [7, 13], [1, 8]], GL); p.poly([[3, 5], [4, 4], [7, 6], [10, 4], [11, 5], [11, 8], [7, 11], [3, 8]], R); p.rect(4, 5, 2, 2, R2); break;
    case 'mpup': p.disc(6.5, 6.5, 5.4, GL); p.disc(6.5, 6.5, 4, BL); p.disc(5, 5, 1.5, BL2); break;
    case 'atkup': p.line(2, 12, 11, 3, hex('#d6deee'), 2); p.rect(9, 1, 4, 3, hex('#d6deee')); p.line(2, 12, 5, 9, GL, 3); p.rect(1, 11, 3, 3, hex('#6a3a1a')); break;
    case 'skull': p.disc(6.5, 5.5, 4.5, hex('#e8e2d0')); p.rect(4, 8, 6, 4, hex('#e8e2d0')); p.rect(4, 5, 2, 2, hex('#1a1220')); p.rect(8, 5, 2, 2, hex('#1a1220')); p.rect(6, 8, 2, 1, hex('#1a1220')); p.rect(5, 11, 1, 2, hex('#1a1220')); p.rect(8, 11, 1, 2, hex('#1a1220')); break;
    case 'orb': p.disc(6.5, 6.5, 5.4, hex('#7a3ad8')); p.disc(6.5, 6.5, 3.6, hex('#b87aff')); p.disc(5, 5, 1.5, WH); break;
    // sword-enchantment gems: a dark-rimmed orb with the element's emblem
    case 'e_fire': p.disc(6.5, 6.5, 6.2, hex('#4a1006')); p.disc(6.5, 6.5, 5, hex('#d8420f')); p.poly([[7, 2], [10, 6], [10, 9], [7, 12], [4, 9], [4, 6], [6, 7]], hex('#ffb02a')); p.poly([[7, 6], [9, 9], [7, 11], [5, 9]], hex('#fff0a0')); break;
    case 'e_ice': p.disc(6.5, 6.5, 6.2, hex('#0c2a4a')); p.disc(6.5, 6.5, 5, hex('#3a8fd8')); p.poly([[7, 1.5], [10, 7], [7, 12.5], [4, 7]], hex('#c8f0ff')); p.line(7, 3, 7, 11, WH, 1); p.line(4, 7, 10, 7, WH, 1); p.poly([[7, 4], [8.5, 7], [7, 10], [5.5, 7]], hex('#6ec8ff')); break;
    case 'e_sun': p.disc(6.5, 6.5, 6.2, hex('#5a3a06')); p.disc(6.5, 6.5, 5, hex('#e0a020')); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; p.line(6.5 + Math.cos(a) * 2.8, 6.5 + Math.sin(a) * 2.8, 6.5 + Math.cos(a) * 4.8, 6.5 + Math.sin(a) * 4.8, hex('#fff6c0'), 1); } p.disc(6.5, 6.5, 2.4, hex('#fffbe0')); break;
    case 'e_aegis': p.disc(6.5, 6.5, 6.2, hex('#0a1c4a')); p.disc(6.5, 6.5, 5, hex('#3a66d8')); p.poly([[3.5, 3], [9.5, 3], [9.5, 8], [6.5, 11.5], [3.5, 8]], hex('#d6e8ff')); p.poly([[4.5, 4], [8.5, 4], [8.5, 7.6], [6.5, 10], [4.5, 7.6]], hex('#5a8cff')); p.rect(6, 4, 1, 5, hex('#d6e8ff')); break;
    case 'dagger': p.poly([[12, 1], [13, 2], [6, 9], [4, 8]], hex('#dfe6f5')); p.poly([[12, 1], [13, 2], [11, 4]], WH); p.line(3, 7, 7, 10, hex('#c9a14a'), 2); p.line(4, 9, 2, 12, hex('#6a3a1a'), 2); p.rect(1, 12, 2, 2, GL); break;
    case 'axe': p.line(3, 12, 10, 3, hex('#8a5a2a'), 2); p.poly([[8, 1], [13, 3], [12, 8], [9, 6]], hex('#cfd6e6')); p.poly([[9, 2], [12, 3], [11, 6]], WH); p.rect(2, 11, 2, 2, hex('#6a3a1a')); break;
    case 'torchi': p.line(4, 12, 8, 6, hex('#8a5a2a'), 2); p.rect(7, 5, 3, 2, hex('#3a2410')); p.poly([[9, 0], [12, 4], [11, 7], [8, 7], [7, 4], [8, 2]], hex('#ff6a1e')); p.poly([[9, 3], [11, 5], [10, 7], [8, 6]], hex('#ffd24a')); break;
    case 'caltrop': p.line(7, 1, 7, 12, hex('#aab3c8'), 2); p.line(2, 10, 12, 10, hex('#aab3c8'), 2); p.line(7, 7, 2, 4, hex('#aab3c8'), 1); p.line(7, 7, 12, 4, hex('#aab3c8'), 1); p.rect(6, 1, 2, 2, WH); p.rect(1, 9, 2, 2, WH); p.rect(11, 9, 2, 2, WH); break;
    case 'holy': p.rect(6, 1, 3, 2, GL); p.poly([[6, 3], [9, 3], [12, 9], [11, 12], [4, 12], [3, 9]], hex('#d8ecff')); p.poly([[4, 8], [11, 8], [12, 9], [11, 12], [4, 12], [3, 9]], hex('#8fc4f0')); p.rect(5, 9, 2, 1, WH); p.rect(8, 5, 1, 2, WH); break;
    case 'bandage': p.disc(6.5, 6.5, 5.2, hex('#efeadb')); p.disc(6.5, 6.5, 2.2, hex('#b9b09a')); p.rect(2, 5, 10, 1, hex('#cfc7b2')); p.rect(2, 8, 10, 1, hex('#cfc7b2')); p.rect(6, 4, 2, 6, R); p.rect(4, 6, 6, 2, R); break;
    case 'scroll': p.rect(3, 2, 8, 10, hex('#e8d9a8')); p.rect(2, 1, 10, 2, hex('#b68a4a')); p.rect(2, 11, 10, 2, hex('#b68a4a')); for (let i = 0; i < 3; i++) p.rect(4, 4 + i * 2, 6, 1, hex('#8a6a3a')); break;
  }
  if (name !== 'coin' && name !== 'mana' && name !== 'potion') { p.shade(1.18, 0.78); } p.outline(OUT);
}

function propStrip(id, n, w, h, fn, meta = {}) { return { id, n, w, h, fn, meta }; }
const PROPS = [
  // candelabra: iron stand with three candles (flames added by three.js)
  propStrip('candelabra', 2, 20, 34, (p, k) => {
    const iron = hex('#3b3447'), wax = hex('#e8dcc0'), wax2 = hex('#b8a888');
    if (k === 1) { p.rect(9, 30, 3, 3, hex('#8a7d6a')); p.rect(6, 31, 9, 2, iron); p.rect(5, 27, 2, 3, wax2); p.rect(13, 29, 2, 2, wax2); return; }  // broken
    p.rect(5, 31, 11, 3, iron); p.rect(8, 28, 5, 3, iron); p.rect(9, 12, 3, 17, iron);
    p.line(10, 15, 3, 11, iron, 2); p.line(10, 15, 17, 11, iron, 2); p.rect(2, 10, 3, 2, iron); p.rect(16, 10, 3, 2, iron); p.rect(7, 11, 7, 2, iron);
    for (const x of [3, 9, 15]) { p.rect(x, 5 + (x === 9 ? -2 : 3), 3, 6, wax); p.rect(x + 2, 5 + (x === 9 ? -2 : 3), 1, 6, wax2); }
    p.shade(); p.outline(OUT);
  }, { ax: 0.5, ay: 1 }),
  propStrip('torch', 1, 12, 20, p => { const iron = hex('#3b3447'); p.rect(4, 8, 5, 3, iron); p.rect(5, 11, 3, 7, iron); p.rect(3, 5, 7, 3, hex('#5a4a3a')); p.rect(4, 14, 5, 2, iron); p.shade(); p.outline(OUT); }, { ax: 0.5, ay: 1 }),
  propStrip('brazier', 1, 22, 26, p => { const iron = hex('#3b3447'), ember = hex('#e0541c'); p.poly([[3, 8], [19, 8], [16, 16], [6, 16]], iron); p.rect(5, 8, 12, 2, hex('#6a5a78')); p.rect(7, 9, 8, 2, ember); p.rect(9, 16, 4, 8, iron); p.rect(5, 23, 12, 3, iron); p.shade(); p.outline(OUT); }, { ax: 0.5, ay: 1 }),
  propStrip('altar', 2, 34, 28, (p, k) => {
    const st = hex('#6d647e'), st2 = hex('#4a4360'), wax = hex('#e8dcc0');
    p.rect(2, 20, 30, 8, st2); p.rect(5, 12, 24, 9, st); p.rect(3, 22, 28, 2, st); p.rect(5, 12, 24, 1, hex('#a49bb8'));
    p.rect(15, 14, 4, 5, hex('#b78cff')); p.rect(16, 15, 2, 3, hex('#e9d6ff'));            // sigil
    p.rect(7, 5, 3, 7, wax); p.rect(24, 5, 3, 7, wax); p.rect(15, 2, 4, 10, wax);
    if (k === 1) p.rect(15, 2, 4, 10, [0, 0, 0, 0]);
    p.shade(); p.outline(OUT);
  }, { ax: 0.5, ay: 1 }),
  propStrip('tablet', 1, 18, 24, p => { p.poly([[2, 23], [2, 6], [5, 2], [13, 2], [16, 6], [16, 23]], hex('#6d647e')); p.rect(5, 7, 8, 1, hex('#2e2840')); p.rect(5, 10, 8, 1, hex('#2e2840')); p.rect(5, 13, 6, 1, hex('#2e2840')); p.rect(5, 16, 8, 1, hex('#2e2840')); p.shade(); p.outline(OUT); }, { ax: 0.5, ay: 1 }),
  propStrip('chest', 2, 22, 18, (p, k) => {
    const wood = hex('#7a4a22'), wood2 = hex('#4e2d12'), gold = hex('#d9a93a');
    if (k === 0) { p.rect(2, 7, 18, 10, wood); p.poly([[2, 7], [4, 2], [18, 2], [20, 7]], wood2); p.rect(2, 7, 18, 2, gold); p.rect(10, 6, 2, 4, gold); p.rect(2, 7, 1, 10, gold); p.rect(19, 7, 1, 10, gold); }
    else { p.rect(2, 8, 18, 9, wood2); p.rect(4, 9, 14, 3, hex('#f2c14e')); p.poly([[2, 8], [5, 1], [17, 1], [20, 8]], wood); p.rect(2, 7, 18, 1, gold); }
    p.shade(); p.outline(OUT);
  }, { ax: 0.5, ay: 1 }),
  propStrip('pedestal', 1, 24, 16, p => { p.rect(2, 12, 20, 4, hex('#4a4360')); p.rect(5, 6, 14, 7, hex('#6d647e')); p.rect(3, 4, 18, 3, hex('#8a82a0')); p.rect(7, 8, 10, 1, hex('#3a3350')); p.shade(); p.outline(OUT); }, { ax: 0.5, ay: 1 }),
  propStrip('spikes', 1, 16, 16, p => { for (let i = 0; i < 4; i++) { const x = i * 4; p.poly([[x, 15], [x + 2, 6], [x + 4, 15]], hex('#aab3c4')); p.set(x + 2, 7, hex('#e8edf8')); p.set(x + 1, 11, hex('#e8edf8')); } p.rect(0, 14, 16, 2, hex('#2e2a3c')); p.shade(); p.outline(OUT); }, { ax: 0, ay: 0 }),
  // special tiles
  propStrip('t_crack', 1, 16, 16, p => { p.rect(0, 0, 16, 16, hex('#50486a')); for (const [x, y] of [[2, 3], [9, 1], [5, 10], [11, 9]]) p.rect(x, y, 4, 3, hex('#625a80')); p.line(8, 0, 6, 5, hex('#17121f'), 1); p.line(6, 5, 9, 9, hex('#17121f'), 1); p.line(9, 9, 7, 15, hex('#17121f'), 1); p.line(6, 5, 2, 7, hex('#17121f'), 1); p.rect(0, 0, 16, 1, hex('#7a7298')); p.rect(0, 15, 16, 1, hex('#2a2440')); }, { ax: 0, ay: 0 }),
  propStrip('t_barricade', 1, 16, 16, p => { const w = hex('#7a4a22'), w2 = hex('#4e2d12'); p.rect(0, 0, 16, 16, w2); for (let i = 0; i < 4; i++) { p.rect(0, i * 4 + 1, 16, 3, w); p.rect(0, i * 4 + 1, 16, 1, hex('#a06a3a')); } p.line(0, 15, 15, 0, hex('#5a3a1a'), 2); p.set(2, 2, hex('#aab3c4')); p.set(13, 13, hex('#aab3c4')); }, { ax: 0, ay: 0 }),
  propStrip('t_crystal', 2, 16, 16, (p, k) => { p.poly([[8, 0], [14, 5], [14, 12], [8, 16], [2, 12], [2, 5]], k ? hex('#9fe8ff') : hex('#4aa8d8')); p.poly([[8, 0], [14, 5], [8, 7]], hex('#e8fbff')); p.poly([[8, 7], [14, 5], [14, 12], [8, 16]], hex('#2a78a8')); p.outline(OUT); }, { ax: 0, ay: 0 }),
  propStrip('t_seal', 4, 16, 16, (p, k) => { p.rect(0, 0, 16, 16, hex('#2a1450')); p.rect(0, 0, 2, 16, hex('#6a3ad8')); p.rect(14, 0, 2, 16, hex('#6a3ad8')); for (let y = 0; y < 16; y++) { const x = 8 + Math.round(Math.sin((y + k * 4) * 0.7) * 3); p.set(x, y, hex('#d8b8ff')); p.set(x + 1, y, hex('#b87aff')); } p.set(8, (k * 5) % 16, [255, 255, 255, 255]); }, { ax: 0, ay: 0 }),
  // projectiles
  propStrip('bone', 4, 14, 14, (p, k) => { const b = hex('#e8e2cf'); const a = k * Math.PI / 4; const dx = Math.cos(a) * 5, dy = Math.sin(a) * 5; p.line(7 - dx, 7 - dy, 7 + dx, 7 + dy, b, 2); p.disc(7 - dx, 7 - dy, 1.8, b); p.disc(7 + dx, 7 + dy, 1.8, b); p.outline(OUT); }, { ay: 0.5 }),
  propStrip('gear', 4, 14, 14, (p, k) => { const c = hex('#d6a548'); p.disc(7, 7, 4.6, c); p.disc(7, 7, 1.6, [0, 0, 0, 0]); const a0 = k * Math.PI / 8; for (let i = 0; i < 6; i++) { const a = a0 + i * Math.PI / 3; p.rect(7 + Math.cos(a) * 5.4 - 1, 7 + Math.sin(a) * 5.4 - 1, 3, 3, c); } p.shade(); p.outline(OUT); }, { ay: 0.5 }),
  propStrip('feather_p', 1, 20, 10, p => { p.poly([[19, 5], [10, 1], [2, 4], [2, 6], [10, 9]], hex('#e8f2ff')); p.line(1, 5, 18, 5, hex('#8fb8ff'), 1); p.line(6, 3, 10, 5, hex('#8fb8ff'), 1); p.outline(OUT); }, { ay: 0.5 }),
  propStrip('orb_dark', 2, 14, 14, (p, k) => { p.disc(7, 7, 5 - k * 0.5, hex('#4a1a7a')); p.disc(7, 7, 3.5 - k * 0.4, hex('#b060ff')); p.set(6, 6, [255, 255, 255, 255]); p.outline(OUT); }, { ay: 0.5 }),
];

// ------------------------------------------------------------------------------------------------
export function drawProcedural(addSheet) {
  const armorKinds = [['idle', 4], ['walk', 6], ['attack', 5], ['hurt', 1]];
  for (const [kind, n] of armorKinds) {
    addSheet('armor_' + kind, strip(n, AW, AH, (p, k) => armorFrame(p, armorPose(kind, k))), n, AW, AH, { face: 1, ax: 26 / AW, ay: AY / AH });
  }
  addSheet('bat', strip(5, 28, 22, batFrame), 5, 28, 22, { ax: 0.5, ay: 0.5 });
  addSheet('icons', strip(ICON.length, IW, IW, iconFrame), ICON.length, IW, IW, { ax: 0.5, ay: 0.5 });
  for (const P of PROPS) addSheet(P.id, strip(P.n, P.w, P.h, P.fn), P.n, P.w, P.h, P.meta);
}
